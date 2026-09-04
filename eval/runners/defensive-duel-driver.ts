/**
 * @module @pes/eval/runners/defensive-duel-driver
 *
 * Deterministic driver for the coherent 5v5 human-vs-CPU match used by the
 * HUMAN-DEFENSIVE-DUEL-CONTROL objective.
 *
 * The driver is pure: it builds tick-indexed `InputFrame`s for every control
 * slot of a scenario — CPU slots through the same CPU adapter + team-decision
 * profile the browser composition root uses, and the HUMAN slot through a
 * scripted policy that reproduces what a person at the keyboard does:
 *
 *   1. run at the opposing ball carrier (steer toward the challenge point),
 *   2. commit to a defensive tackle (standing / slide) once inside that
 *      action's reach of both the ball and the carrier,
 *   3. press the same tackle bit again a couple of ticks later — that press
 *      lands inside the action's lock-out window and is what proves recovery
 *      prevents an instant re-tackle,
 *   4. keep steering/sprinting normally between attempts.
 *
 * `attempts: []` selects the strictly-additive control shape: the human never
 * presses a defensive action, which is how the no-tackle behaviour baseline is
 * pinned.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import {
  createCpuAdapter,
  buildCpuObservation,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import { FOUNDATION_TACKLE_V1 } from "../../src/simulation/config/foundation.js";
import {
  STANDING_TACKLE_BIT,
  SLIDE_TACKLE_BIT,
} from "../../src/contracts/input.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { SimulationEvent, ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One scripted defensive attempt issued by the human policy. */
export interface TackleAttempt {
  /** `standing` → STANDING_TACKLE_BIT, `slide` → SLIDE_TACKLE_BIT. */
  kind: "standing" | "slide";
  /**
   * Ticks after the attempt at which the same bit is pressed again. That
   * follow-up lands inside the action's lock-out window. 0 disables it.
   */
  lockoutFollowUpTicks?: number;
  /**
   * Planar distance (metres) at which the attempt is committed. Defaults to
   * the versioned reach for that kind.
   */
  commitDistance?: number;
  /**
   * Earliest input tick at which this attempt may be committed. Lets an
   * evidence run place a standing tackle and a slide tackle in different
   * phases of the same coherent match.
   */
  earliestTick?: number;
}

export interface DefensiveDuelConfig {
  /** Scenario to run (the 5v5 human-vs-CPU match by default). */
  scenario: ScenarioDefinition;
  /** Ticks to advance. */
  maxTicks: number;
  /** Scripted human attempts, consumed in order. Default: none. */
  attempts?: TackleAttempt[];
  /** Ticks the human holds a sprint while closing down. Default 1. */
  sprint?: number;
  /**
   * Anti-huddle team shape for the CPU slots (5V5-KICKOFF-ANTI-HUDDLE). Default
   * true. Accepted evidence captured before `anti-huddle-v1` replays with
   * `false` so the historical CPU configuration is reproduced byte-for-byte.
   */
  cpuAntiHuddle?: boolean;
}

/** A press the human policy actually issued, with its tick and bit mask. */
export interface HumanPressRecord {
  tick: number;
  bits: number;
  kind: "standing" | "slide";
  /** True when this press was issued inside the previous attempt's lock-out. */
  lockout: boolean;
}

export interface HumanInputRecord {
  tick: number;
  controlSlot: string;
  moveX: number;
  moveY: number;
  sprint: number;
  heldButtons: number;
  pressedButtons: number;
  releasedButtons: number;
}

export interface DefensiveDuelResult {
  tick: number;
  /** Per-tick committed state hashes (index 0 = tick 1). */
  stateHashes: string[];
  /** Every ordered event emitted during the run. */
  events: SimulationEvent[];
  /** Every committed telemetry observation. */
  observations: TelemetryObservation[];
  /** The HUMAN slot's per-tick input frames. */
  humanInputs: HumanInputRecord[];
  /** Every defensive press the human policy issued. */
  humanPresses: HumanPressRecord[];
  /** Control slot of the HUMAN player. */
  humanControlSlot: string;
  /** Player id controlled by the HUMAN slot at the start of the run. */
  humanPlayerId: string;
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

/** Planar distance helper. */
function planarDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Bit mask for one scripted attempt kind. */
export function tackleBitFor(kind: "standing" | "slide"): number {
  return kind === "standing" ? STANDING_TACKLE_BIT : SLIDE_TACKLE_BIT;
}

/**
 * Run the coherent 5v5 human-vs-CPU match with a scripted human defensive
 * policy. Fully deterministic: the same config produces identical hashes.
 */
export function runDefensiveDuel(config: DefensiveDuelConfig): DefensiveDuelResult {
  const { scenario, maxTicks } = config;
  const attempts = config.attempts ?? [];
  const sprint = config.sprint ?? 1;
  const cpuAntiHuddle = config.cpuAntiHuddle ?? true;

  const world = createWorld({ scenario });
  const observations: TelemetryObservation[] = [];
  const sim = createSimulation(world, {
    onObservation(obs) {
      observations.push(obs);
    },
  });

  // --- HUMAN slot resolution (the match declares exactly one) ------------
  let humanControlSlot = "";
  let humanPlayerId = "";
  for (const [slotId, assignment] of Object.entries(scenario.controlAssignments)) {
    const mode = (assignment as { mode?: string }).mode;
    if (mode === "HUMAN") {
      humanControlSlot = slotId;
      humanPlayerId = assignment.controlledPlayerId ?? "";
      break;
    }
  }

  type CpuSlot = {
    adapter: ReturnType<typeof createCpuAdapter>;
    controlSlot: string;
    teamId: string;
    controlledPlayerId: string;
  };
  const cpuSlots: CpuSlot[] = [];
  for (const [slotId, assignment] of Object.entries(scenario.controlAssignments)) {
    const mode = (assignment as { mode?: string }).mode;
    if (mode === "HUMAN") continue;
    cpuSlots.push({
      adapter: createCpuAdapter(),
      controlSlot: slotId,
      teamId: assignment.teamId,
      controlledPlayerId: assignment.controlledPlayerId ?? "",
    });
  }

  const events: SimulationEvent[] = [];
  const stateHashes: string[] = [];
  const humanInputs: HumanInputRecord[] = [];
  const humanPresses: HumanPressRecord[] = [];

  // Scripted attempt queue.
  let nextAttempt = 0;
  // Input tick after which the previous attempt's lock-out window is clear.
  let lastAttemptReleaseTick = -1;
  let lockoutTick = -1;
  let lockoutBits = 0;
  let lockoutKind: "standing" | "slide" = "standing";

  for (let i = 0; i < maxTicks; i++) {
    const snapshot = sim.snapshot();
    const tick = sim.tick;

    // --- CPU slots: same wiring as the browser composition root ----------
    const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
    for (const entry of cpuSlots) {
      if (!teamDecisions.has(entry.teamId)) {
        const teamObs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
        teamObs.cpuAntiHuddle = cpuAntiHuddle;
        teamDecisions.set(entry.teamId, computeTeamDecision(teamObs, entry.teamId));
      }
    }

    const frames: InputFrame[] = [];
    for (const entry of cpuSlots) {
      const obs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
      obs.teamDecision = teamDecisions.get(entry.teamId);
      obs.cpuAntiHuddle = cpuAntiHuddle;
      const frame = entry.adapter.sample(tick, obs);
      frame.controlSlot = entry.controlSlot;
      frames.push(frame);
    }

    // --- HUMAN slot: scripted defensive policy --------------------------
    let moveX = 0;
    let moveY = 0;
    let held = 0;
    let pressed = 0;

    const human = snapshot.players.find((p) => p.playerId === humanPlayerId);
    if (human) {
      const ball = snapshot.ball;
      // Closest opposing player to the ball = the carrier to challenge.
      let carrier: { playerId: string; x: number; y: number } | null = null;
      let carrierDist = Number.POSITIVE_INFINITY;
      for (const p of snapshot.players) {
        if (p.teamId === human.teamId) continue;
        const d = planarDistance(p.groundPosition.x, p.groundPosition.y, ball.position.x, ball.position.y);
        if (d < carrierDist) {
          carrierDist = d;
          carrier = { playerId: p.playerId, x: p.groundPosition.x, y: p.groundPosition.y };
        }
      }
      const chaseX = carrier !== null && carrierDist < 3 ? carrier.x : ball.position.x;
      const chaseY = carrier !== null && carrierDist < 3 ? carrier.y : ball.position.y;
      const dx = chaseX - human.groundPosition.x;
      const dy = chaseY - human.groundPosition.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.01) {
        moveX = dx / dist;
        moveY = dy / dist;
      }

      const distToBall = planarDistance(
        human.groundPosition.x,
        human.groundPosition.y,
        ball.position.x,
        ball.position.y,
      );

      // Deliberate lock-out press (recovery prevents an instant re-tackle).
      let pressedThisTick = false;
      if (lockoutTick === tick) {
        pressed |= lockoutBits;
        held |= lockoutBits;
        humanPresses.push({ tick, bits: lockoutBits, kind: lockoutKind, lockout: true });
        pressedThisTick = true;
      } else if (nextAttempt < attempts.length && carrier !== null) {
        const attempt = attempts[nextAttempt];
        const bits = tackleBitFor(attempt.kind);
        const commitAt =
          attempt.commitDistance ??
          (attempt.kind === "standing"
            ? FOUNDATION_TACKLE_V1.standingReach.value
            : FOUNDATION_TACKLE_V1.slideReach.value);
        const inRange =
          distToBall <= commitAt &&
          planarDistance(human.groundPosition.x, human.groundPosition.y, carrier.x, carrier.y) <=
            commitAt;
        const timingOk =
          attempt.earliestTick === undefined || tick >= attempt.earliestTick;
        // The previous attempt must be released before the next one commits,
        // otherwise the run would only ever show lock-out rejections.
        const clearOfPrevious =
          lastAttemptReleaseTick < 0 || tick > lastAttemptReleaseTick;
        if (inRange && timingOk && clearOfPrevious) {
          pressed |= bits;
          held |= bits;
          humanPresses.push({ tick, bits, kind: attempt.kind, lockout: false });
          const windows =
            attempt.kind === "standing"
              ? FOUNDATION_TACKLE_V1.standingPrepareTicks.value +
                FOUNDATION_TACKLE_V1.standingActiveTicks.value +
                FOUNDATION_TACKLE_V1.standingRecoverTicks.value
              : FOUNDATION_TACKLE_V1.slidePrepareTicks.value +
                FOUNDATION_TACKLE_V1.slideActiveTicks.value +
                FOUNDATION_TACKLE_V1.slideRecoverTicks.value;
          lastAttemptReleaseTick = tick + windows;
          const followUp = attempt.lockoutFollowUpTicks ?? 0;
          if (followUp > 0) {
            lockoutTick = tick + followUp;
            lockoutBits = bits;
            lockoutKind = attempt.kind;
          }
          nextAttempt += 1;
          pressedThisTick = true;
        }
      }
      // Nothing defensive is being pressed: keep the held mask clean so the
      // human's later touches stay edge-triggered like a real keyboard.
      void pressedThisTick;
    }

    frames.push({
      tick,
      sourceId: "keyboard",
      controlSlot: humanControlSlot,
      moveX,
      moveY,
      sprint,
      heldButtons: held,
      pressedButtons: pressed,
      releasedButtons: 0,
    });
    humanInputs.push({
      tick,
      controlSlot: humanControlSlot,
      moveX,
      moveY,
      sprint,
      heldButtons: held,
      pressedButtons: pressed,
      releasedButtons: 0,
    });

    sim.applyInputs(frames);
    const stepResult = sim.step();
    stateHashes.push(stepResult.stateHash);
    for (const evt of stepResult.events) {
      events.push(evt);
    }
  }

  for (const entry of cpuSlots) entry.adapter.reset();

  return {
    tick: sim.tick,
    stateHashes,
    events,
    observations,
    humanInputs,
    humanPresses,
    humanControlSlot,
    humanPlayerId,
  };
}
