/**
 * @module @pes/eval/runners/headless-match
 *
 * Headless CPU-vs-CPU match runner.
 *
 * Creates two `CpuAdapter` instances (one per team), runs them against
 * each other in a headless simulation (no browser, no keyboard), and
 * returns all events, observations, and state hashes.
 *
 * No Math.random, Date, DOM, or Node I/O.
 * Deterministic: same scenario (with same seed) → same results.
 */

import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { createCpuAdapter, buildCpuObservation, type CpuObservation } from "../../src/adapters/input-browser/cpu-adapter.js";
import { NO_OP_OBSERVER } from "../../src/simulation/telemetry/observer.js";
import type { SimulationObserver } from "../../src/simulation/telemetry/observer.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { SimulationEvent } from "../../src/contracts/scenario.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fixed tick duration in seconds (1/60 s). */
const FIXED_DT = 1 / 60;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Match lifecycle phase.
 */
export type MatchPhase =
  | "kickoff"
  | "first-half"
  | "halftime"
  | "second-half"
  | "fulltime";

/**
 * Phase history record — marks when a phase began.
 */
export interface PhaseHistoryRecord {
  /** Simulation tick at which this phase began. */
  tick: number;
  /** Phase value at that tick. */
  phase: MatchPhase;
}

/**
 * Mapping from goal index to the team that scores.
 *
 * Convention (ai-match):
 *   goalIndex 0 → ball crosses x = +52.5 → the team attacking +x scores.
 *   goalIndex 1 → ball crosses x = -52.5 → the team attacking -x scores.
 *
 * In the default ai-match fixture:
 *   goalIndex 0 → team-a scores (team-a attacks +x).
 *   goalIndex 1 → team-b scores (team-b attacks -x).
 */
export type GoalTeamMapping = Record<number, string>;

/**
 * Default mapping: goalIndex 0 → team-a, goalIndex 1 → team-b.
 * This matches the ai-match fixture convention.
 */
const DEFAULT_GOAL_TEAM_MAPPING: GoalTeamMapping = {
  0: "team-a",
  1: "team-b",
};

/**
 * Configuration for a headless CPU-vs-CPU match.
 */
export interface HeadlessMatchConfig {
  /** Scenario definition — must have two players, both AI_FALLBACK. */
  scenario: ScenarioDefinition;
  /** Total ticks to simulate (default: 600). */
  maxTicks?: number;
  /** Match duration in ticks (default: maxTicks). Used for clock reporting. */
  matchDurationTicks?: number;
  /** Half duration in ticks (default: matchDurationTicks / 2). */
  halfDurationTicks?: number;
  /** Optional telemetry observer. */
  observer?: SimulationObserver;
  /**
   * Mapping from goalIndex (0 or 1) to the teamId that scores.
   * Defaults to the ai-match convention: { 0: "team-a", 1: "team-b" }.
   *
   * Convention:
   *   goalIndex 0 → ball crosses x = +52.5 → team attacking +x scores.
   *   goalIndex 1 → ball crosses x = -52.5 → team attacking -x scores.
   */
  goalTeamMapping?: GoalTeamMapping;
}

/**
 * A derived goal event record that attaches the scoring teamId.
 * Does not mutate the original SimulationEvent.
 */
export interface MatchGoalEvent {
  /** The original simulation event (defensive copy). */
  event: SimulationEvent;
  /** The teamId that scored this goal. */
  scoringTeamId: string;
}

/**
 * Score keyed by teamId.
 */
export type MatchScore = Record<string, number>;

/**
 * Result of a headless CPU-vs-CPU match.
 */
export interface HeadlessMatchResult {
  /** Final committed tick (equals maxTicks). */
  tick: number;
  /** All simulation events. */
  events: SimulationEvent[];
  /** Per-tick telemetry observations. */
  observations: TelemetryObservation[];
  /** State hash per tick (indexed by tick). */
  stateHashes: string[];
  /** Match clock — total configured duration in ticks. */
  matchDurationTicks: number;
  /** Elapsed ticks so far (equals tick for a completed match). */
  elapsedTicks: number;
  /** Remaining ticks (matchDurationTicks - elapsedTicks). */
  remainingTicks: number;
  /** Elapsed simulated time in seconds (elapsedTicks * FIXED_DT). */
  matchTimeSeconds: number;
  /** Score keyed by teamId. */
  score: MatchScore;
  /** Derived goal events with scoring teamId attached. */
  goalEvents: MatchGoalEvent[];
  /** Current match phase. */
  matchPhase: MatchPhase;
  /** Phase history — ordered list of {tick, phase} marking transitions. */
  phaseHistory: PhaseHistoryRecord[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format elapsed seconds as mm:ss (count-up).
 *
 * @param totalSeconds - elapsed simulated seconds (non-negative).
 * @returns "mm:ss" string, e.g. "00:00", "00:10", "01:30".
 */
export function formatMatchTime(totalSeconds: number): string {
  const totalSecs = Math.floor(totalSeconds);
  const minutes = Math.floor(totalSecs / 60);
  const seconds = totalSecs % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Scenario fixture — two-player AI duel
// ---------------------------------------------------------------------------

/**
 * Create a minimal two-player AI match scenario.
 *
 * Two players on opposite sides, ball between them.
 * Both slots use AI_FALLBACK so the CPU adapters drive both teams.
 */
export function makeAiMatchScenario(): ScenarioDefinition {
  return {
    id: "ai-match-v1",
    version: "1.0.0",
    family: "ai-match",
    durationTicks: 600,
    seed: 42,
    prngAlgorithmId: "mulberry32-v1",
    schemaVersion: "state-v1",
    simulationVersion: "sim-v1",
    configVersion: "foundation-config-v1",
    profile: "LABORATORY",
    pitchLength: 105,
    pitchWidth: 68,
    safetyBounds: {
      maxX: 52.5,
      maxY: 34,
      minZ: -0.5,
      maxZ: 20,
    },
    players: [
      {
        playerId: "cpu-a",
        teamId: "team-a",
        groundPosition: { x: 0, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        desiredHeading: 0,
        archetypeId: "archetype-burst-v1",
      },
      {
        playerId: "cpu-b",
        teamId: "team-b",
        groundPosition: { x: 40, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
        desiredHeading: Math.PI,
        archetypeId: "archetype-steady-v1",
      },
    ],
    ball: {
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    controlAssignments: {
      "slot-a": {
        controlSlot: "slot-a",
        teamId: "team-a",
        controlledPlayerId: "cpu-a",
        mode: "AI_FALLBACK",
      },
      "slot-b": {
        controlSlot: "slot-b",
        teamId: "team-b",
        controlledPlayerId: "cpu-b",
        mode: "AI_FALLBACK",
      },
    },
    missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
    maxConsecutiveMissing: 3,
    inputProgram: {},
    scheduledEvents: {},
    observationWindows: [{ startTick: 0, endTick: 600 }],
    requestedMetrics: ["player-displacement", "ball-distance"],
  };
}

// ---------------------------------------------------------------------------
// Match runner
// ---------------------------------------------------------------------------

/**
 * Build a CpuObservation filtered for a specific team.
 *
 * The CpuAdapter uses `players[0]` as the controlled player.
 * We filter to ensure the controlled player (from the given teamId)
 * appears first in the array.
 */
function buildTeamCpuObservation(
  fullObs: {
    players: CpuObservation["players"];
    ball: CpuObservation["ball"];
    pitchLength: number;
    pitchWidth: number;
  },
  teamId: string,
): CpuObservation {
  // Filter and reorder: controlled team's player first.
  const teamPlayers = fullObs.players.filter(
    (p) => p.teamId === teamId,
  );
  const otherPlayers = fullObs.players.filter(
    (p) => p.teamId !== teamId,
  );
  const orderedPlayers = [...teamPlayers, ...otherPlayers];

  return {
    players: orderedPlayers,
    ball: { ...fullObs.ball },
    pitchLength: fullObs.pitchLength,
    pitchWidth: fullObs.pitchWidth,
    cpuTeamId: teamId,
  };
}

/**
 * Process simulation events to extract score information.
 *
 * This is a pure function of the event list. It does not mutate events.
 * It is called after the match loop completes.
 *
 * @param events - all simulation events collected during the match.
 * @param matchDurationTicks - total configured match duration.
 * @param goalTeamMapping - mapping from goalIndex to scoring teamId.
 * @param totalElapsedTicks - total ticks simulated (from simulation, not events).
 * @returns { score, goalEvents, elapsedTicks, matchTimeSeconds }
 */
function computeMatchStats(
  events: SimulationEvent[],
  totalElapsedTicks: number,
  matchDurationTicks: number,
  goalTeamMapping: GoalTeamMapping,
): {
  score: MatchScore;
  goalEvents: MatchGoalEvent[];
  elapsedTicks: number;
  matchTimeSeconds: number;
} {
  const score: MatchScore = {};
  const goalEvents: MatchGoalEvent[] = [];

  for (const evt of events) {
    if (evt.kind === "goal") {
      const goalIndex = (evt.payload.goalIndex as number) ?? -1;
      const scoringTeamId = goalTeamMapping[goalIndex] ?? "unknown";

      // Initialize team score if not present.
      if (!(scoringTeamId in score)) {
        score[scoringTeamId] = 0;
      }
      score[scoringTeamId]++;

      goalEvents.push({
        event: { ...evt },
        scoringTeamId,
      });
    }
  }

  return {
    score,
    goalEvents,
    elapsedTicks: totalElapsedTicks,
    matchTimeSeconds: totalElapsedTicks * FIXED_DT,
  };
}

/**
 * Run a headless CPU-vs-CPU match.
 */
export function runHeadlessMatch(
  config: HeadlessMatchConfig,
): HeadlessMatchResult {
  const {
    scenario,
    maxTicks = scenario.durationTicks,
    matchDurationTicks = maxTicks,
    halfDurationTicks: halfDurationTicksRaw = Math.floor(matchDurationTicks / 2),
    observer,
    goalTeamMapping = DEFAULT_GOAL_TEAM_MAPPING,
  } = config;
  const halfDurationTicks = halfDurationTicksRaw;

  // 1. Create world and simulation.
  const world = createWorld({ scenario });
  const observations: TelemetryObservation[] = [];

  // Build observer that collects observations AND delegates to any user observer.
  // We can't use spread because user onObservation would override ours.
  const collectObserver: SimulationObserver = {
    onBeforeStep: observer?.onBeforeStep,
    onAfterStep: observer?.onAfterStep,
    onObservation(obs: TelemetryObservation) {
      observations.push(obs);
      observer?.onObservation?.(obs);
    },
    onInvariantPass: observer?.onInvariantPass,
    onInvariantFail: observer?.onInvariantFail,
    onPresent: observer?.onPresent,
  };
  const sim = createSimulation(world, collectObserver);

  // 2. Create two CPU adapters — one per team.
  //    Each adapter has its own internal state (hasPossession, ballWasInRange),
  //    so they don't interfere with each other.
  const cpuA = createCpuAdapter();
  const cpuB = createCpuAdapter();

  // Build a teamId → controlSlot mapping from the scenario's assignments
  // so we can assign each CPU frame the correct slot.
  const teamToSlot = new Map<string, string>();
  for (const [slot, assignment] of Object.entries(scenario.controlAssignments)) {
    const mode = (assignment as { mode?: string }).mode;
    if (mode === "AI_FALLBACK") {
      teamToSlot.set(assignment.teamId, assignment.controlSlot);
    }
  }

  // 3. Run the match loop.
  const events: SimulationEvent[] = [];
  const stateHashes: string[] = [];

  // Phase tracking.
  let hadGoal = false;
  let currentPhase: MatchPhase = "kickoff";
  const phaseHistory: PhaseHistoryRecord[] = [{ tick: 0, phase: "kickoff" }];

  for (let i = 0; i < maxTicks; i++) {
    // Phase derivation for this tick.
    // The last tick of a match (with maxTicks > 1 and at least 2 half-durations)
    // is always "fulltime" since the match is complete.
    const isLastTickAndFulltime =
      maxTicks > 1 && maxTicks >= 2 * halfDurationTicks && i === maxTicks - 1;
    let phase: MatchPhase;
    if (isLastTickAndFulltime) {
      phase = "fulltime";
    } else if (hadGoal && i < 2 * halfDurationTicks) {
      phase = "kickoff";
      hadGoal = false;
    } else if (i === 0) {
      phase = "kickoff";
    } else if (i < halfDurationTicks) {
      phase = "first-half";
    } else if (i === halfDurationTicks) {
      phase = "halftime";
    } else if (i < 2 * halfDurationTicks) {
      phase = "second-half";
    } else {
      phase = "fulltime";
    }
    if (phase !== currentPhase) {
      phaseHistory.push({ tick: i, phase });
      currentPhase = phase;
    }

    // a. Snapshot the world (deep clone — CPU adapters only read).
    const snapshot = sim.snapshot();

    // b. Build full CpuObservation, then filter per team.
    //    Each CPU sees the full world but its OWN player is always first
    //    in the array (so the CpuAdapter picks the right player).
    const fullObs = buildCpuObservation(snapshot);
    const obsA = buildTeamCpuObservation(fullObs, "team-a");
    const obsB = buildTeamCpuObservation(fullObs, "team-b");

    // c. Sample input frames from each CPU adapter.
    const tick = sim.tick;
    const frameA = cpuA.sample(tick, obsA);
    const frameB = cpuB.sample(tick, obsB);

    // d. Set the correct controlSlot for each frame (matching scenario assignments).
    //    The CpuAdapter uses a default "slot-cpu"; we override it to match
    //    the actual slot in the scenario so the simulation can resolve inputs.
    frameA.controlSlot = teamToSlot.get("team-a") ?? frameA.controlSlot;
    frameB.controlSlot = teamToSlot.get("team-b") ?? frameB.controlSlot;

    // e. Apply both input frames to the simulation.
    sim.applyInputs([frameA, frameB]);

    // f. Advance simulation by one tick.
    const stepResult = sim.step();

    // g. Collect results.
    stateHashes.push(stepResult.stateHash);
    for (const evt of stepResult.events) {
      events.push(evt);
      if (evt.kind === "goal") {
        hadGoal = true;
      }
    }
  }

  // 4. Clean up CPU adapters.
  cpuA.reset();
  cpuB.reset();

  // 5. Compute match stats (clock + score) from events.
  const { score, goalEvents, elapsedTicks, matchTimeSeconds } = computeMatchStats(
    events,
    sim.tick,
    matchDurationTicks,
    goalTeamMapping,
  );

  return {
    tick: sim.tick,
    events,
    observations,
    stateHashes,
    matchDurationTicks,
    elapsedTicks,
    remainingTicks: matchDurationTicks - elapsedTicks,
    matchTimeSeconds,
    score,
    goalEvents,
    matchPhase: currentPhase,
    phaseHistory,
  };
}