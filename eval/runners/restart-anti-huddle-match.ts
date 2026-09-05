/**
 * @module @pes/eval/runners/restart-anti-huddle-match
 *
 * RESTART-ANTI-HUDDLE-COHERENCE evidence driver.
 *
 * Runs a coherent CPU-vs-CPU small-sided match through the accepted headless
 * match runner (browser observation shape) and segments the committed tick
 * stream into the match's RESTART windows — kickoff, throw-in, goal kick,
 * corner, post-goal (and the halftime reset, which reuses the same core
 * machinery) — recording per-tick geometry inside each window:
 *
 *   • the core's restart-hold run (the accepted adapter phase hold issues zero
 *     movement while the core prepares the restart at its own placement),
 *   • the serve window: every tick from the moment the ball is an untouched
 *     restart ball until its first touch, with the per-tick frozen count, the
 *     single designated taker (closest body in the match to the untouched
 *     ball), and each frozen body's displacement from where it stood when the
 *     window opened,
 *   • per-tick per-team chase assignment read from the same exported
 *     production function the adapters act on (`assignChaseRoles`,
 *     window-aware), so evidence and behavior share one implementation,
 *   • same-team bodies inside the huddle radius during the serve window and
 *     in the 120 ticks after the first touch, plus double-chaser team-ticks.
 *
 * The untouched condition mirrors the adapter exactly: the ball is an
 * untouched restart ball while its authoritative touch reference is null
 * (kickoff and every set-piece serve until its taker plays it) or still
 * equals the stale reference that carried through a full core restart hold
 * and survives the resume — the signature of a reset that did not clear it
 * (post-goal, halftime). Only committed, observable per-tick data is read;
 * nothing here drives a touch, a pass or a restart.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { runHeadlessMatch } from "./headless-match.js";
import {
  assignChaseRoles,
  RESTART_HOLD_MIN_TICKS,
  type CpuObservation,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { FOUNDATION_CONTACT_V1 } from "../../src/simulation/config/foundation.js";
import {
  FIRST_TOUCH_BIT,
  PASS_BIT,
  SHOT_BIT,
  SLIDE_TACKLE_BIT,
  STANDING_TACKLE_BIT,
} from "../../src/contracts/input.js";
import type { ScenarioDefinition, SimulationEvent } from "../../src/contracts/scenario.js";
import type { MatchPhase } from "../../src/contracts/state.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InputFrame } from "../../src/contracts/input.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Planar radius (m) inside which the contact system honours a touch. */
const TOUCH_PRESS_RANGE_METRES = FOUNDATION_CONTACT_V1.contactRadius.value;

/** Ticks of live-play geometry sampled after a first touch, for the reopen. */
const AFTER_TOUCH_WINDOW_TICKS = 120;

/** Core phases that hold play while a restart is prepared. */
export const RESTART_HOLD_PHASES: ReadonlySet<MatchPhase> = new Set<MatchPhase>([
  "goal",
  "corner-kick",
  "throw-in",
  "goal-kick",
  "halftime",
]);

/** Restart window categories observed in coherent small-sided play. */
export type RestartWindowKind =
  | "kickoff"
  | "corner"
  | "throw-in"
  | "goal-kick"
  | "post-goal"
  | "halftime";

/** One body's committed geometry for one tick. */
export interface RestartPlayerRecord {
  playerId: string;
  teamId: string;
  x: number;
  y: number;
  /** Planar speed (m/s) of the body this tick. */
  speed: number;
  /** Metres from this body to the ball. */
  distToBall: number;
  /** Metres from this body to its fixed kickoff home. */
  distToHome: number;
  /** True when this body is its team's designated chaser/presser this tick. */
  designatedChaser: boolean;
  /** True when this body may break the freeze as the single restart taker. */
  designatedTaker: boolean;
  /** True while the restart freeze holds this body at its window anchor. */
  frozen: boolean;
  /** Metres this body stands from where it stood when the window opened. */
  frozenDriftMetres: number | null;
  /** Button names the CPU frame consumed on the next tick pressed for this body. */
  pressed: string[];
}

/** One team's committed chase structure for one tick. */
export interface RestartTeamRecord {
  /** The single designated chaser of this team (shared press designation). */
  chaserPlayerId: string | null;
  /** Bodies of this team inside the huddle radius of the ball this tick. */
  playersWithinHuddleRadius: number;
}

export interface RestartTickRecord {
  tick: number;
  stateHash: string;
  /** Committed core match phase sampled by the adapters for this tick. */
  phase: MatchPhase;
  /** True while the ball is an untouched restart ball (freeze live). */
  ballUntouched: boolean;
  /** The single body allowed to converge on the untouched ball, if any. */
  takerId: string | null;
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    regime: string;
    lastTouchRef: string | null;
  };
  eventKinds: string[];
  players: RestartPlayerRecord[];
  teams: Record<string, RestartTeamRecord>;
}

export interface RestartWindowRecord {
  id: string;
  kind: RestartWindowKind;
  /** First tick of the core restart-hold run preceding this serve, if any. */
  holdStartTick: number | null;
  /** Last hold tick, if any. */
  holdEndTick: number | null;
  /** Hold ticks with zero core-side ball movement (placement settled). */
  holdTicks: number;
  /** First tick where the ball reads as an untouched restart ball. */
  serveStartTick: number;
  /** Tick the restarted ball was first touched; null when never. */
  firstTouchTick: number | null;
  /** Stale touch reference the post-goal/halftime window is keyed to. */
  baselineTouchRef: string | null;
  /** Committed ball position at the serve-window opening. */
  ballPositionAtServe: { x: number; y: number };
  /** Ticks inside the serve window (inclusive). */
  serveTicks: number;
  /** Serve ticks with at least one frozen body. */
  frozenTicks: number;
  /** Frozen body-ticks summed over the serve window. */
  frozenBodyTicks: number;
  /** Total non-exempt bodies frozen on the first serve tick. */
  frozenCountAtServe: number;
  /** Widest displacement of a frozen body from its window anchor (metres). */
  maxFrozenDriftMetres: number;
  /** The designated taker first seen in this window. */
  takerId: string | null;
  /** Widest same-team ball-density seen inside the serve window. */
  maxBodiesWithinHuddleRadius: number;
  /** Widest same-team ball-density in the ticks after the first touch. */
  maxBodiesWithinHuddleRadiusAfterTouch: number;
  /** Team-ticks after touch where a team had >1 designated chaser. */
  doubleChaserTeamTicks: number;
  /** True when the window never closed before the run ended. */
  open: boolean;
}

export interface RestartRunSummary {
  ticks: number;
  goals: number;
  /** One entry per restart window, in tick order. */
  windows: RestartWindowRecord[];
  /** Window kinds covered by this run. */
  kindsObserved: RestartWindowKind[];
  /** Team-ticks inside serve windows where a team had >2 bodies in radius. */
  serveWindowClumpTeamTicks: number;
}

export interface RestartMatchResult {
  scenarioId: string;
  totalTicks: number;
  antiHuddleEnabled: boolean;
  huddleRadiusMetres: number;
  ticks: RestartTickRecord[];
  windows: RestartWindowRecord[];
  events: SimulationEvent[];
  stateHashes: string[];
  coreMatchPhases: MatchPhase[];
  summary: RestartRunSummary;
  kickoffHomes: Record<string, { x: number; y: number }>;
}

export interface RestartMatchConfig {
  scenario: ScenarioDefinition;
  maxTicks: number;
  /** Anti-huddle kill switch. Default true; false restores chase-everything. */
  cpuAntiHuddle?: boolean;
  /** Give the CPU slots the defensive tackle buttons. Default true. */
  cpuDefensiveTackle?: boolean;
  /** Planar radius (metres) at which same-team bodies count as one clump. */
  huddleRadiusMetres?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function planarDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function round(value: number, decimals = 3): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

const BIT_NAMES: Array<[number, string]> = [
  [FIRST_TOUCH_BIT, "first-touch"],
  [PASS_BIT, "pass"],
  [SHOT_BIT, "shot"],
  [STANDING_TACKLE_BIT, "standing-tackle"],
  [SLIDE_TACKLE_BIT, "slide-tackle"],
];

function pressedNames(frame: InputFrame | undefined): string[] {
  if (!frame) return [];
  return BIT_NAMES.filter(([bit]) => (frame.pressedButtons & bit) !== 0)
    .map(([, name]) => name);
}

/**
 * Rebuild the observation shape the production role functions consume from a
 * committed telemetry observation. Only observable fields are carried across.
 */
function observationFromTelemetry(
  observation: TelemetryObservation,
  identities: ReadonlyMap<string, { formationRole?: "defender" | "midfielder" | "attacker" }>,
  pitchLength: number,
  pitchWidth: number,
): CpuObservation {
  return {
    players: observation.players.map((p) => ({
      playerId: p.playerId,
      teamId: p.teamId,
      groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
      linearVelocity: { x: p.linearVelocity.x, y: p.linearVelocity.y },
      bodyHeading: p.bodyHeading,
      formationRole: identities.get(p.playerId)?.formationRole,
    })),
    ball: {
      position: {
        x: observation.ball.position.x,
        y: observation.ball.position.y,
        z: observation.ball.position.z,
      },
      linearVelocity: {
        x: observation.ball.linearVelocity.x,
        y: observation.ball.linearVelocity.y,
        z: observation.ball.linearVelocity.z,
      },
      regime: observation.ball.regime,
      lastTouchRef: observation.ball.lastTouchRef,
    },
    pitchLength,
    pitchWidth,
  };
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

/**
 * Run one coherent CPU-vs-CPU match and segment the committed tick stream into
 * restart windows, recording the anti-huddle geometry inside each.
 */
export function runRestartAntiHuddleMatch(
  config: RestartMatchConfig,
): RestartMatchResult {
  const cpuAntiHuddle = config.cpuAntiHuddle ?? true;
  const cpuDefensiveTackle = config.cpuDefensiveTackle ?? true;
  const huddleRadiusMetres = config.huddleRadiusMetres ?? 5;

  const match = runHeadlessMatch({
    scenario: config.scenario,
    maxTicks: config.maxTicks,
    cpuAntiHuddle,
    cpuDefensiveTackle,
    browserParityObservations: true,
    // The restart evidence can only exist where the core's own restart
    // machinery runs: the legacy default overwrote the core's restart phases
    // and the windows never executed (a driver defect the browser never had).
    lifecyclePhaseSync: "core-owned",
  });

  const { scenario } = config;
  type Identity = { formationRole?: "defender" | "midfielder" | "attacker" };
  const identities = new Map<string, Identity>();
  const kickoffHomes: Record<string, { x: number; y: number }> = {};
  for (const p of scenario.players) {
    identities.set(p.playerId, {
      formationRole: (p as { formationRole?: "defender" | "midfielder" | "attacker" })
        .formationRole,
    });
    kickoffHomes[p.playerId] = { x: p.groundPosition.x, y: p.groundPosition.y };
  }
  const teamIds = [...new Set(scenario.players.map((p) => p.teamId))].sort();

  // Control slot → body, so the consumed frames can be attributed.
  const slotToPlayer = new Map<string, string>();
  for (const assignment of Object.values(scenario.controlAssignments)) {
    if (assignment.controlledPlayerId) {
      slotToPlayer.set(assignment.controlSlot, assignment.controlledPlayerId);
    }
  }

  const ticks: RestartTickRecord[] = [];
  // Mirrors of the adapter's per-instance restart bookkeeping, rebuilt here
  // from the committed stream: the stale-reference baseline captured the tick
  // play resumes from a reset that did not clear the reference, and the
  // per-body window anchor captured when the serve window opens.
  let baselineRef: string | null = null;
  let holdTicks = 0;
  let previousRef: string | null | undefined;
  let anchors: Map<string, { x: number; y: number }> | null = null;
  const phases = match.coreMatchPhases;

  for (let i = 0; i < match.observations.length; i++) {
    const observation = match.observations[i];
    const phase = phases[i];
    const ref = observation.ball.lastTouchRef;

    // Resume detection mirrors the adapter exactly (including the
    // RESTART_HOLD_MIN_TICKS gate and the carried-through-hold test): play
    // just resumed from a real core restart hold while the ball still carries
    // the SAME touch reference it carried through the whole hold → the core
    // reset WITHOUT clearing it (post-goal / halftime), so that value is the
    // window baseline: while it stands, the restart ball is untouched. A
    // set-piece serve writes a fresh (or null) reference at placement and is
    // governed by the null-ref signal instead.
    if (RESTART_HOLD_PHASES.has(phase)) {
      holdTicks++;
    } else {
      if (
        holdTicks >= RESTART_HOLD_MIN_TICKS &&
        ref !== null &&
        previousRef !== undefined &&
        ref === previousRef
      ) {
        baselineRef = ref;
      }
      holdTicks = 0;
    }
    previousRef = ref;

    const untouched = ref === null || (baselineRef !== null && ref === baselineRef);
    if (baselineRef !== null && ref !== baselineRef) baselineRef = null;

    const baseObs = observationFromTelemetry(
      observation,
      identities,
      scenario.pitchLength,
      scenario.pitchWidth,
    );

    const framesByPlayer = new Map<string, InputFrame>();
    for (const frame of observation.inputs) {
      const playerId = slotToPlayer.get(frame.controlSlot);
      if (playerId) framesByPlayer.set(playerId, frame);
    }

    const teams: Record<string, RestartTeamRecord> = {};
    const chasers = new Set<string>();
    let takerId: string | undefined;
    for (const teamId of teamIds) {
      const teamObs: CpuObservation = { ...baseObs, cpuTeamId: teamId };
      const roles = assignChaseRoles(teamObs, teamId, untouched);
      if (roles.chaserPlayerId) chasers.add(roles.chaserPlayerId);
      takerId = roles.kickoffTakerId ?? takerId;
      let within = 0;
      for (const p of observation.players) {
        if (p.teamId !== teamId) continue;
        if (
          planarDistance(
            p.groundPosition.x,
            p.groundPosition.y,
            observation.ball.position.x,
            observation.ball.position.y,
          ) < huddleRadiusMetres
        ) {
          within++;
        }
      }
      teams[teamId] = {
        chaserPlayerId: roles.chaserPlayerId ?? null,
        playersWithinHuddleRadius: within,
      };
    }

    if (untouched && anchors === null) {
      anchors = new Map();
      for (const p of observation.players) {
        anchors.set(p.playerId, { x: p.groundPosition.x, y: p.groundPosition.y });
      }
    } else if (!untouched && anchors !== null) {
      anchors = null;
    }

    const players: RestartPlayerRecord[] = observation.players.map((p) => {
      const home = kickoffHomes[p.playerId];
      const distToBall = planarDistance(
        p.groundPosition.x,
        p.groundPosition.y,
        observation.ball.position.x,
        observation.ball.position.y,
      );
      // The adapter exempts the single taker and any body already inside the
      // radius a touch can actually land in.
      const exempt = takerId === p.playerId || distToBall <= TOUCH_PRESS_RANGE_METRES;
      const frozen = untouched && cpuAntiHuddle && !exempt;
      const anchor = anchors?.get(p.playerId);
      return {
        playerId: p.playerId,
        teamId: p.teamId,
        x: round(p.groundPosition.x),
        y: round(p.groundPosition.y),
        speed: round(Math.sqrt(p.linearVelocity.x ** 2 + p.linearVelocity.y ** 2)),
        distToBall: round(distToBall),
        distToHome: home
          ? round(planarDistance(p.groundPosition.x, p.groundPosition.y, home.x, home.y))
          : 0,
        designatedChaser: chasers.has(p.playerId),
        designatedTaker: untouched && takerId === p.playerId,
        frozen,
        frozenDriftMetres: anchor
          ? round(planarDistance(p.groundPosition.x, p.groundPosition.y, anchor.x, anchor.y))
          : null,
        pressed: pressedNames(framesByPlayer.get(p.playerId)),
      };
    });

    ticks.push({
      tick: observation.tick,
      stateHash: observation.stateHash,
      phase,
      ballUntouched: untouched,
      takerId: untouched ? takerId ?? null : null,
      ball: {
        x: round(observation.ball.position.x),
        y: round(observation.ball.position.y),
        vx: round(observation.ball.linearVelocity.x),
        vy: round(observation.ball.linearVelocity.y),
        regime: observation.ball.regime,
        lastTouchRef: observation.ball.lastTouchRef,
      },
      eventKinds: observation.events.map((event) => event.kind),
      players,
      teams,
    });
  }

  const windows = segmentRestartWindows(ticks, phases);
  const summary = summarizeRestartRun(ticks, windows, match.events);

  return {
    scenarioId: scenario.id,
    totalTicks: match.tick,
    antiHuddleEnabled: cpuAntiHuddle,
    huddleRadiusMetres,
    ticks,
    windows,
    events: match.events,
    stateHashes: match.stateHashes,
    coreMatchPhases: phases,
    summary,
    kickoffHomes,
  };
}

// ---------------------------------------------------------------------------
// Window segmentation
// ---------------------------------------------------------------------------

/**
 * Derive the restart windows from the per-tick records. Pure function of the
 * committed stream: each maximal run of untouched ticks is a serve window; its
 * kind comes from the restart-hold phase run immediately before it (no hold
 * run and starting at tick 0 means the match-opening kickoff).
 */
export function segmentRestartWindows(
  ticks: readonly RestartTickRecord[],
  phases: readonly MatchPhase[],
): RestartWindowRecord[] {
  const windows: RestartWindowRecord[] = [];
  let ordinal = 0;
  let i = 0;
  while (i < ticks.length) {
    if (!ticks[i].ballUntouched) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < ticks.length && ticks[j + 1].ballUntouched) j++;

    // Walk back through the restart-hold run that prepared this serve.
    let holdStart = -1;
    for (let h = i - 1; h >= 0 && RESTART_HOLD_PHASES.has(phases[h]); h--) {
      holdStart = h;
    }
    let kind: RestartWindowKind;
    if (holdStart !== -1) {
      kind = kindForPhase(phases[holdStart]) ?? "kickoff";
    } else if (i === 0) {
      kind = "kickoff";
    } else {
      // Untouched ball mid-flow with no preceding hold: a serve whose ball
      // was placed while the phase was already live (accepted re-arm shape).
      kind = "kickoff";
    }

    const closed = j + 1 < ticks.length;
    ordinal++;
    windows.push(
      finalizeWindow(
        buildWindow(`restart-${ordinal}`, kind, i, j, closed, holdStart, ticks, phases),
        ticks,
        j,
        closed,
      ),
    );
    i = j + 1;
  }
  return windows;
}

function kindForPhase(phase: MatchPhase): RestartWindowKind | null {
  switch (phase) {
    case "corner-kick":
      return "corner";
    case "throw-in":
      return "throw-in";
    case "goal-kick":
      return "goal-kick";
    case "goal":
      return "post-goal";
    case "halftime":
      return "halftime";
    default:
      return null;
  }
}

function buildWindow(
  id: string,
  kind: RestartWindowKind,
  startIndex: number,
  endIndex: number,
  closed: boolean,
  holdStartIndex: number,
  ticks: readonly RestartTickRecord[],
  phases: readonly MatchPhase[],
): RestartWindowRecord {
  const serve = ticks[startIndex];
  let holdStartTick: number | null = null;
  let holdEndTick: number | null = null;
  let holdTicks = 0;
  if (holdStartIndex !== -1) {
    holdStartTick = ticks[holdStartIndex].tick;
    holdEndTick = ticks[startIndex - 1].tick;
    for (let k = holdStartIndex; k < startIndex; k++) {
      if (RESTART_HOLD_PHASES.has(phases[k])) holdTicks++;
    }
  }
  return {
    id,
    kind,
    holdStartTick,
    holdEndTick,
    holdTicks,
    serveStartTick: serve.tick,
    firstTouchTick: closed ? ticks[endIndex + 1].tick : null,
    baselineTouchRef: serve.ball.lastTouchRef,
    ballPositionAtServe: { x: serve.ball.x, y: serve.ball.y },
    serveTicks: endIndex - startIndex + 1,
    frozenTicks: 0,
    frozenBodyTicks: 0,
    frozenCountAtServe: 0,
    maxFrozenDriftMetres: 0,
    takerId: serve.takerId,
    maxBodiesWithinHuddleRadius: 0,
    maxBodiesWithinHuddleRadiusAfterTouch: 0,
    doubleChaserTeamTicks: 0,
    open: !closed,
  };
}

/** Compute the window's geometric aggregates over its serve + reopen ranges. */
function finalizeWindow(
  window: RestartWindowRecord,
  ticks: readonly RestartTickRecord[],
  endIndex: number,
  closed: boolean,
): RestartWindowRecord {
  const startIndex = ticks.findIndex((t) => t.tick === window.serveStartTick);
  let firstServe = true;
  for (let i = startIndex; i <= endIndex; i++) {
    const tick = ticks[i];
    if (tick.takerId !== null && window.takerId === null) window.takerId = tick.takerId;
    let frozenThisTick = 0;
    for (const p of tick.players) {
      if (p.frozen) {
        frozenThisTick++;
        if (p.frozenDriftMetres !== null) {
          window.maxFrozenDriftMetres = Math.max(window.maxFrozenDriftMetres, p.frozenDriftMetres);
        }
      }
    }
    if (frozenThisTick > 0) window.frozenTicks++;
    window.frozenBodyTicks += frozenThisTick;
    if (firstServe) {
      window.frozenCountAtServe = frozenThisTick;
      firstServe = false;
    }
    for (const team of Object.values(tick.teams)) {
      window.maxBodiesWithinHuddleRadius = Math.max(
        window.maxBodiesWithinHuddleRadius,
        team.playersWithinHuddleRadius,
      );
    }
  }
  if (!closed) return window;
  const afterEnd = Math.min(endIndex + 1 + AFTER_TOUCH_WINDOW_TICKS, ticks.length);
  for (let i = endIndex + 1; i < afterEnd; i++) {
    const tick = ticks[i];
    const chaserCount = new Map<string, number>();
    for (const p of tick.players) {
      if (p.designatedChaser) chaserCount.set(p.teamId, (chaserCount.get(p.teamId) ?? 0) + 1);
    }
    if ([...chaserCount.values()].some((c) => c > 1)) window.doubleChaserTeamTicks++;
    for (const team of Object.values(tick.teams)) {
      window.maxBodiesWithinHuddleRadiusAfterTouch = Math.max(
        window.maxBodiesWithinHuddleRadiusAfterTouch,
        team.playersWithinHuddleRadius,
      );
    }
  }
  return window;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/** Derive the run-level read from per-tick records and windows. Pure. */
export function summarizeRestartRun(
  ticks: readonly RestartTickRecord[],
  windows: readonly RestartWindowRecord[],
  matchEvents: readonly SimulationEvent[],
): RestartRunSummary {
  let serveWindowClumpTeamTicks = 0;
  for (const tick of ticks) {
    if (!tick.ballUntouched) continue;
    for (const team of Object.values(tick.teams)) {
      if (team.playersWithinHuddleRadius > 2) serveWindowClumpTeamTicks++;
    }
  }
  return {
    ticks: ticks.length,
    goals: matchEvents.filter((event) => event.kind === "goal").length,
    windows: [...windows],
    kindsObserved: [...new Set(windows.map((w) => w.kind))],
    serveWindowClumpTeamTicks,
  };
}
