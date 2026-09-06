/**
 * @module @pes/eval/runners/cpu-tackle-match
 *
 * CPU-DEFENSIVE-TACKLE evidence driver.
 *
 * Runs a coherent CPU-vs-CPU small-sided match through the accepted headless
 * match runner — the same wiring the situation scanner uses — with the CPU
 * slots given the defensive tackle buttons, then reads the tackle story back
 * out of the committed event stream:
 *
 *   • every ordered `tackle-phase` transition per attempt (prepare → active →
 *     recover → release) with the active window the action declared,
 *   • the contact evidence each attempt produced inside that window
 *     (`player-player-contact` duel, `player-ball-contact` on the ball),
 *   • the attempt outcome: ball won, duel contact only, or missed,
 *   • the recovery cost of a miss: the speed cap the attempt imposes and how
 *     much ground toward the tackler's own goal the opposition gained while the
 *     body was still in recovery (the opened lane),
 *   • and a per-tick view of hashes plus the tackle activity of that tick.
 *
 * Nothing here drives a tackle: the only input is the CPU adapter's own tick-
 * indexed frames. No Math.random, Date, performance, DOM, or Node I/O.
 */

import { runHeadlessMatch } from "./headless-match.js";
import { FOUNDATION_LOCOMOTION_V1, FOUNDATION_TACKLE_V1 } from "../../src/simulation/config/foundation.js";
import { STANDING_TACKLE_BIT, SLIDE_TACKLE_BIT } from "../../src/contracts/input.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { ScenarioDefinition, SimulationEvent } from "../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How an attempt's single allowed contact resolved. */
export type TackleOutcome = "ball-won" | "duel-contact-only" | "missed";

/** Recovery consequence recorded for one committed attempt. */
export interface RecoveryConsequence {
  /** Ticks the attempt spent in the recovery phase. */
  recoverTicks: number;  /** Speed cap the action declares for recovery (m/s). */
  speedCap: number;
  /** Highest planar speed the tackler actually held during recovery (m/s). */
  observedMaxSpeed: number;
  /**
   * Metres the ball travelled toward the tackler's own goal across the
   * recovery window. Positive = ground conceded while the defender was caught
   * out (the opened lane); negative = the attack was pushed back.
   */
  concededMetres: number;
}

/** One committed CPU tackle attempt, reconstructed from committed evidence. */
export interface CpuTackleAttemptRecord {
  playerId: string;
  teamId: string;
  kind: "standing" | "slide";
  startTick: number;
  phaseTicks: {
    prepare: number | null;
    active: number | null;
    recover: number | null;
    release: number | null;
  };
  activeWindowStartTick: number;
  activeWindowEndTick: number;
  reach: number;
  /** Tick of the duel contact with an opposing body, when one happened. */
  opponentContactTick: number | null;
  /** Tick of the tackle's ball contact, when one happened. */
  ballContactTick: number | null;
  /** `duelWon` as reported by the duel contact itself. */
  duelWon: boolean | null;
  outcome: TackleOutcome;
  recovery: RecoveryConsequence | null;
  /** True when a CPU adapter pressed this attempt (never a scripted input). */
  cpuIssued: boolean;
}

/** The per-tick view written into the trajectory artifact. */
export interface CpuTackleTickRecord {
  tick: number;
  stateHash: string;
  tacklePhases: Array<{ playerId: string; kind: string; phase: string }>;
  contacts: Array<{ playerId: string; kind: string; contactType: string; outcome: string }>;
  rejections: Array<{ playerId: string; policy: string }>;
}

export interface CpuTackleMatchResult {
  scenarioId: string;
  totalTicks: number;
  /** Per-tick committed state hashes, index 0 = the tick-1 step. */
  stateHashes: string[];
  events: SimulationEvent[];
  observations: TelemetryObservation[];
  attempts: CpuTackleAttemptRecord[];
  ticks: CpuTackleTickRecord[];
  /**
   * The tick-indexed input program the CPU adapters actually issued, in the
   * order the simulation consumed it. A replay of these frames must reproduce
   * `stateHashes` exactly, which is what lets a browser-side capture re-run the
   * very match a trajectory recorded instead of inventing its own.
   */
  frameLog: Array<{ tick: number; frames: InputFrame[] }>;
  /** Tackle presses the CPU adapters reported issuing. */
  cpuPressCount: number;
  /** Frames carrying a defensive tackle bit, per control slot. */
  presses: Array<{
    /** Tick the committed attempt opened on (frame tick + 1). */
    tick: number;
    /** Tick the adapter stamped the frame with. */
    frameTick: number;
    controlSlot: string;
    playerId: string;
    kind: string;
  }>;
}

export interface CpuTackleMatchConfig {
  scenario: ScenarioDefinition;
  maxTicks: number;
  /** Give the CPU slots the tackle buttons. Default true. */
  cpuDefensiveTackle?: boolean;
  /**
   * Anti-huddle team shape (5V5-KICKOFF-ANTI-HUDDLE). Default true. Accepted
   * evidence captured before `anti-huddle-v1` replays with `false` so its
   * historical CPU configuration is reproduced byte-for-byte.
   */
  cpuAntiHuddle?: boolean;
  /**
   * Lifecycle phase-sync policy (RESTART-ANTI-HUDDLE-COHERENCE, migration
   * completed by LIFECYCLE-MIGRATION-ASSESSMENT). CPU-DEFENSIVE-TACKLE accepted
   * evidence was captured under the historical "legacy" policy, so this driver
   * keeps the same explicit policy gk-match uses, independent of the runner's
   * migrated default. Default "legacy".
   */
  lifecyclePhaseSync?: "legacy" | "core-owned";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function payloadOf(event: SimulationEvent): Record<string, unknown> {
  return (event.payload ?? {}) as Record<string, unknown>;
}

function num(payload: Record<string, unknown>, key: string): number | null {
  const v = payload[key];
  return typeof v === "number" ? v : null;
}

function str(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  return typeof v === "string" ? v : "";
}

function planarSpeed(v: { x: number; y: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/** Signed ground conceded toward a team's own goal between two ball x-values. */
function concededTowardOwnGoal(
  teamId: string,
  fromX: number,
  toX: number,
): number {
  // team-a defends -x, team-b defends +x (the profile's own convention).
  return teamId === "team-b" ? toX - fromX : fromX - toX;
}

/** Windows declared for one tackle kind. */
function windowsFor(kind: "standing" | "slide"): {
  prepare: number;
  active: number;
  recover: number;
  reach: number;
} {
  return kind === "standing"
    ? {
        prepare: FOUNDATION_TACKLE_V1.standingPrepareTicks.value,
        active: FOUNDATION_TACKLE_V1.standingActiveTicks.value,
        recover: FOUNDATION_TACKLE_V1.standingRecoverTicks.value,
        reach: FOUNDATION_TACKLE_V1.standingReach.value,
      }
    : {
        prepare: FOUNDATION_TACKLE_V1.slidePrepareTicks.value,
        active: FOUNDATION_TACKLE_V1.slideActiveTicks.value,
        recover: FOUNDATION_TACKLE_V1.slideRecoverTicks.value,
        reach: FOUNDATION_TACKLE_V1.slideReach.value,
      };
}

/** Observation for a committed tick, when the telemetry carries it. */
function observationAt(
  observations: readonly TelemetryObservation[],
  tick: number,
): TelemetryObservation | undefined {
  return observations.find((o) => o.tick === tick);
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

/**
 * Run one coherent CPU-vs-CPU match and reconstruct its defensive-tackle story
 * from committed evidence only (events, telemetry, input frames).
 */
export function runCpuTackleMatch(
  config: CpuTackleMatchConfig,
): CpuTackleMatchResult {
  const cpuDefensiveTackle = config.cpuDefensiveTackle ?? true;
  const match = runHeadlessMatch({
    scenario: config.scenario,
    maxTicks: config.maxTicks,
    cpuDefensiveTackle,
    cpuAntiHuddle: config.cpuAntiHuddle ?? true,
    lifecyclePhaseSync: config.lifecyclePhaseSync ?? "legacy",
  });

  const { events, observations } = match;

  // --- CPU presses: tackle bits present on a committed input frame ----------
  const slotToPlayer = new Map<string, string>();
  for (const [slotId, assignment] of Object.entries(config.scenario.controlAssignments)) {
    const controlled = (assignment as { controlledPlayerId?: string }).controlledPlayerId;
    if (controlled) slotToPlayer.set(slotId, controlled);
  }
  const presses: CpuTackleMatchResult["presses"] = [];
  // Frames are stamped with the tick they were sampled on and consumed by the
  // step that commits the next tick, so an attempt's `startTick` is the press
  // tick plus the one tick the sim advances when it consumes the frame.
  const consumeTickOf = (frameTick: number) => frameTick + 1;
  for (const observation of observations) {
    for (const frame of observation.inputs as readonly InputFrame[]) {
      const bits = frame.pressedButtons;
      if ((bits & STANDING_TACKLE_BIT) === 0 && (bits & SLIDE_TACKLE_BIT) === 0) {
        continue;
      }
      presses.push({
        tick: consumeTickOf(frame.tick),
        frameTick: frame.tick,
        controlSlot: frame.controlSlot,
        playerId: slotToPlayer.get(frame.controlSlot) ?? "",
        kind: (bits & STANDING_TACKLE_BIT) !== 0 ? "standing" : "slide",
      });
    }
  }

  // --- Attempts, in first-seen order ---------------------------------------
  type Partial = {
    playerId: string;
    teamId: string;
    kind: "standing" | "slide";
    startTick: number;
    phaseTicks: CpuTackleAttemptRecord["phaseTicks"];
    activeWindowStartTick: number;
    activeWindowEndTick: number;
    reach: number;
    opponentContactTick: number | null;
    ballContactTick: number | null;
    duelWon: boolean | null;
  };
  const attempts = new Map<string, Partial>();
  const keyOf = (playerId: string, startTick: number) => `${playerId}@${startTick}`;

  for (const event of events) {
    const payload = payloadOf(event);
    if (event.kind === "tackle-phase") {
      const kind = str(payload, "tackleKind");
      if (kind !== "standing" && kind !== "slide") continue;
      const playerId = str(payload, "playerId");
      const startTick = num(payload, "startTick");
      if (!playerId || startTick === null) continue;
      const key = keyOf(playerId, startTick);
      let attempt = attempts.get(key);
      if (!attempt) {
        const windows = windowsFor(kind);
        attempt = {
          playerId,
          teamId: str(payload, "teamId"),
          kind,
          startTick,
          phaseTicks: { prepare: null, active: null, recover: null, release: null },
          activeWindowStartTick:
            num(payload, "activeWindowStartTick") ?? startTick + windows.prepare,
          activeWindowEndTick:
            num(payload, "activeWindowEndTick") ??
            startTick + windows.prepare + windows.active - 1,
          reach: num(payload, "reach") ?? windows.reach,
          opponentContactTick: null,
          ballContactTick: null,
          duelWon: null,
        };
        attempts.set(key, attempt);
      }
      const phase = str(payload, "phase") as keyof CpuTackleAttemptRecord["phaseTicks"];
      if (
        phase === "prepare" ||
        phase === "active" ||
        phase === "recover" ||
        phase === "release"
      ) {
        if (attempt.phaseTicks[phase] === null) attempt.phaseTicks[phase] = event.tick;
      }
      continue;
    }

    if (event.kind === "player-player-contact") {
      const contactType = str(payload, "contactType");
      if (contactType !== "standing-tackle" && contactType !== "slide-tackle") continue;
      const startTick = num(payload, "attemptStartTick");
      const playerId = str(payload, "playerIdA");
      if (!playerId || startTick === null) continue;
      const attempt = attempts.get(keyOf(playerId, startTick));
      if (!attempt) continue;
      if (attempt.opponentContactTick === null) attempt.opponentContactTick = event.tick;
      if (attempt.duelWon === null) attempt.duelWon = payload.duelWon === true;
      continue;
    }

    if (event.kind === "player-ball-contact") {
      const contactType = str(payload, "contactType");
      if (contactType !== "standing-tackle" && contactType !== "slide-tackle") continue;
      const startTick = num(payload, "attemptStartTick");
      const playerId = str(payload, "playerId");
      if (!playerId || startTick === null) continue;
      const attempt = attempts.get(keyOf(playerId, startTick));
      if (!attempt) continue;
      if (attempt.ballContactTick === null) attempt.ballContactTick = event.tick;
    }
  }

  const cpuPressKeys = new Set(
    presses.map((press) => keyOf(press.playerId, press.tick)),
  );

  const records: CpuTackleAttemptRecord[] = [];
  for (const attempt of attempts.values()) {
    const windows = windowsFor(attempt.kind);
    const outcome: TackleOutcome =
      attempt.ballContactTick !== null
        ? "ball-won"
        : attempt.opponentContactTick !== null
          ? "duel-contact-only"
          : "missed";

    const recovery = describeRecovery(observations, attempt, windows.recover);

    records.push({
      playerId: attempt.playerId,
      teamId: attempt.teamId,
      kind: attempt.kind,
      startTick: attempt.startTick,
      phaseTicks: attempt.phaseTicks,
      activeWindowStartTick: attempt.activeWindowStartTick,
      activeWindowEndTick: attempt.activeWindowEndTick,
      reach: attempt.reach,
      opponentContactTick: attempt.opponentContactTick,
      ballContactTick: attempt.ballContactTick,
      duelWon: attempt.duelWon,
      outcome,
      recovery,
      cpuIssued: cpuPressKeys.has(keyOf(attempt.playerId, attempt.startTick)),
    });
  }
  records.sort((a, b) => a.startTick - b.startTick || a.playerId.localeCompare(b.playerId));

  // --- Per-tick view -------------------------------------------------------
  const ticks: CpuTackleTickRecord[] = observations.map((observation) => {
    const tickEvents = observation.events as readonly SimulationEvent[];
    const record: CpuTackleTickRecord = {
      tick: observation.tick,
      stateHash: observation.stateHash,
      tacklePhases: [],
      contacts: [],
      rejections: [],
    };
    for (const event of tickEvents) {
      const payload = payloadOf(event);
      if (event.kind === "tackle-phase") {
        record.tacklePhases.push({
          playerId: str(payload, "playerId"),
          kind: str(payload, "tackleKind"),
          phase: str(payload, "phase"),
        });
      } else if (
        event.kind === "player-player-contact" ||
        event.kind === "player-ball-contact"
      ) {
        const contactType = str(payload, "contactType");
        if (contactType !== "standing-tackle" && contactType !== "slide-tackle") continue;
        record.contacts.push({
          playerId:
            event.kind === "player-ball-contact"
              ? str(payload, "playerId")
              : str(payload, "playerIdA"),
          kind: event.kind,
          contactType,
          outcome:
            event.kind === "player-player-contact"
              ? payload.duelWon === true
                ? "duel-won"
                : "duel-contested"
              : "ball-touched",
        });
      } else if (event.kind === "input-rejection") {
        record.rejections.push({
          playerId: str(payload, "playerId"),
          policy: str(payload, "policy"),
        });
      }
    }
    return record;
  });

  return {
    scenarioId: config.scenario.id,
    totalTicks: match.tick,
    stateHashes: match.stateHashes,
    events,
    observations,
    attempts: records,
    ticks,
    frameLog: observations.map((observation) => ({
      tick: observation.tick,
      frames: observation.inputs.map((frame) => ({ ...frame })),
    })),
    cpuPressCount: presses.length,
    presses,
  };
}

/**
 * Describe what the recovery window cost this attempt: the declared speed cap,
 * the top speed actually observed inside it, and the ground conceded along the
 * axis the tackler's own goal sits on.
 */
function describeRecovery(
  observations: readonly TelemetryObservation[],
  attempt: {
    playerId: string;
    teamId: string;
    startTick: number;
    phaseTicks: { recover: number | null; release: number | null };
  },
  recoverTicks: number,
): RecoveryConsequence | null {
  const start = attempt.phaseTicks.recover;
  const end = attempt.phaseTicks.release;
  if (start === null || end === null || end <= start) return null;

  const speedCap =
    FOUNDATION_LOCOMOTION_V1.maxSpeed.value *
    FOUNDATION_TACKLE_V1.recoverySpeedFactor.value;
  let observedMaxSpeed = 0;
  let fromX: number | null = null;
  let toX: number | null = null;

  // The recovery window is [recover, release): on the release tick the attempt
  // is gone and the cap no longer applies, so including it would understate the
  // cost the commitment actually imposed.
  for (const observation of observations) {
    if (observation.tick < start || observation.tick >= end) continue;
    const player = observation.players.find((p) => p.playerId === attempt.playerId);
    if (player) observedMaxSpeed = Math.max(observedMaxSpeed, planarSpeed(player.linearVelocity));
    if (fromX === null) fromX = observation.ball.position.x;
    toX = observation.ball.position.x;
  }

  if (fromX === null || toX === null) return null;
  return {
    recoverTicks,
    speedCap,
    observedMaxSpeed,
    concededMetres: concededTowardOwnGoal(attempt.teamId, fromX, toX),
  };
}

// ---------------------------------------------------------------------------
// Window trimming
// ---------------------------------------------------------------------------

/**
 * Shorten a match result to the last tick by which every attempt opened before
 * it had fully released.
 *
 * The protected tackle-phase oracle requires the whole ordered
 * prepare→active→recover→release chain, so an evidence window that cuts a
 * commitment in half would report a failure the simulation never produced. This
 * keeps only complete attempts and the ticks that cover them.
 */
export function trimToCompleteAttempts(
  result: CpuTackleMatchResult,
): CpuTackleMatchResult {
  let keepThroughTick = result.totalTicks;
  for (;;) {
    // Anything at or before the kept window must be a whole attempt: no
    // attempt may still be open there, and no attempt kept there may have its
    // release outside it.
    const offenders = result.attempts
      .filter(
        (a) =>
          a.startTick <= keepThroughTick &&
          (a.phaseTicks.release === null || a.phaseTicks.release > keepThroughTick),
      )
      .map((a) => a.startTick);
    if (offenders.length === 0) break;
    const next = Math.min(...offenders) - 1;
    if (next >= keepThroughTick) break;
    keepThroughTick = next;
  }

  const attempts = result.attempts.filter((a) => a.startTick <= keepThroughTick);
  const observations = result.observations.filter((o) => o.tick <= keepThroughTick);
  const ticks = result.ticks.filter((t) => t.tick <= keepThroughTick);
  const presses = result.presses.filter((p) =>
    attempts.some((a) => a.playerId === p.playerId && a.startTick === p.tick),
  );
  const events = result.events.filter((e) => e.tick <= keepThroughTick);
  // stateHashes[0] is the tick-1 step, so the prefix length is the tick itself.
  const stateHashes = result.stateHashes.slice(0, keepThroughTick);

  return {
    ...result,
    totalTicks: keepThroughTick,
    stateHashes,
    events,
    observations,
    attempts,
    ticks,
    frameLog: result.frameLog.filter((entry) => entry.tick <= keepThroughTick),
    presses,
    cpuPressCount: presses.length,
  };
}
