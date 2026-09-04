/**
 * @module @pes/eval/runners/headless-match
 *
 * Headless CPU-vs-CPU match runner.
 *
 * Creates `CpuAdapter` instances (one per AI_FALLBACK control slot),
 * runs them against each other in a headless simulation (no browser,
 * no keyboard), and returns all events, observations, and state hashes.
 *
 * Supports multi-slot scenarios (e.g. 2v2 with 4 slots) by creating one
 * CPU adapter per AI_FALLBACK control slot, building team-filtered
 * observations, and submitting per-slot input frames.
 *
 * No Math.random, Date, DOM, or Node I/O.
 * Deterministic: same scenario (with same seed) → same results.
 */

import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { deepClone } from "../../src/simulation/world/clone.js";
import type { WorldState } from "../../src/contracts/state.js";
import { createCpuAdapter, buildCpuObservation, type CpuObservation } from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import { NO_OP_OBSERVER } from "../../src/simulation/telemetry/observer.js";
import type { SimulationObserver } from "../../src/simulation/telemetry/observer.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { SimulationEvent } from "../../src/contracts/scenario.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { GoalResetConfig } from "../../src/simulation/loop/simulation.js";

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
  /**
   * Enable automatic goal reset: after each goal, reset ball to center
   * and players to their starting positions.  Match clock continues
   * (score accumulates).  Default: true for SMALL_SIDED / REGULATION
   * profiles, false for LABORATORY profile.
   */
  autoGoalReset?: boolean;
  /**
   * Give every CPU slot the defensive tackle buttons (CPU-DEFENSIVE-TACKLE).
   * Same semantics as the browser composition root: it is an input-device
   * capability, not extra knowledge. Default false, which reproduces the
   * tackle-free control shape the strictly-additive baselines pin.
   */
  cpuDefensiveTackle?: boolean;
  /**
   * Anti-huddle team shape (5V5-KICKOFF-ANTI-HUDDLE): kickoff freeze to fixed
   * homes plus nearest-only chasing of the ball. Default true, which is what the
   * browser composition root runs with. Explicitly false restores the
   * chase-everything shape this runner produced before the objective — the
   * discriminating guards stash the behavior through this switch.
   */
  cpuAntiHuddle?: boolean;
  /**
   * Build each CPU slot's observation through `buildCpuObservation` with the
   * slot's team and player resolved — the browser composition root's shape,
   * which carries the fixed formation anchor and the teammate list. Opt-in: the
   * runner's own minimal team-filtered shape stays byte-identical for every
   * accepted headless evidence run.
   */
  browserParityObservations?: boolean;
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
 * Initial player positions for goal reset.
 */
export interface GoalResetPositions {
  /** Starting ground positions for each player, keyed by playerId. */
  playerPositions: Record<string, { x: number; y: number }>;
  /** Starting ball position. */
  ballPosition: { x: number; y: number; z: number };
  /** Starting ball linear velocity. */
  ballVelocity: { x: number; y: number; z: number };
}

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
 * Build a GoalResetPositions record from the scenario's initial state.
 *
 * @param scenario - The scenario definition (unmutated).
 * @returns Positions that can be used to reset after a goal.
 */
export function buildGoalResetPositions(
  scenario: ScenarioDefinition,
): GoalResetPositions {
  const playerPositions: Record<string, { x: number; y: number }> = {};
  for (const p of scenario.players) {
    playerPositions[p.playerId] = {
      x: p.groundPosition.x,
      y: p.groundPosition.y,
    };
  }
  return {
    playerPositions,
    ballPosition: { ...scenario.ball.position },
    ballVelocity: { ...scenario.ball.linearVelocity },
  };
}

/**
 * Reset the simulation state after a goal: ball to center, players to start.
 *
 * Mutates the simulation in place via restore. The committed state is
 * reset so that the next tick starts from a neutral configuration.
 *
 * @param sim - The simulation instance.
 * @param reset - The goal reset positions.
 */
export function resetAfterGoal(
  sim: import("../../src/simulation/loop/simulation.js").Simulation,
  reset: GoalResetPositions,
): void {
  // snapshot() returns a deep-frozen clone; use deepClone to get a mutable copy.
  const mutable = deepClone(sim.snapshot()) as WorldState;

  // Reset ball position and velocity.
  mutable.ball.position = { ...reset.ballPosition };
  mutable.ball.linearVelocity = { ...reset.ballVelocity };
  mutable.ball.regime = "ground-roll";
  // Reset each player to starting position.
  for (const player of mutable.players) {
    const startPos = reset.playerPositions[player.playerId];
    if (startPos) {
      player.groundPosition = { x: startPos.x, y: startPos.y };
      player.linearVelocity = { x: 0, y: 0 };
      player.desiredVelocity = { x: 0, y: 0 };
    }
  }
  sim.restore(mutable);
}

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
  controlledPlayerId?: string,
): CpuObservation {
  // Filter and reorder: controlled team's player first.
  const teamPlayers = fullObs.players.filter(
    (p) => p.teamId === teamId,
  );
  const otherPlayers = fullObs.players.filter(
    (p) => p.teamId !== teamId,
  );
  const orderedPlayers = [...teamPlayers, ...otherPlayers];

  const result: CpuObservation = {
    players: orderedPlayers,
    ball: { ...fullObs.ball },
    pitchLength: fullObs.pitchLength,
    pitchWidth: fullObs.pitchWidth,
    cpuTeamId: teamId,
  };
  if (controlledPlayerId) {
    result.controlledPlayerId = controlledPlayerId;
  }
  return result;
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
 *
 * Supports multi-slot scenarios (e.g. 2v2 with 4 slots) by creating one
 * CPU adapter per AI_FALLBACK control slot.
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
    autoGoalReset,
    cpuDefensiveTackle = false,
    cpuAntiHuddle = true,
    browserParityObservations = false,
  } = config;
  const halfDurationTicks = halfDurationTicksRaw;

  // Auto-reset: enable for non-LABORATORY profiles, respect explicit config.
  const doGoalReset = autoGoalReset ?? scenario.profile !== "LABORATORY";

  // 1. Create world and simulation.
  const world = createWorld({ scenario });
  const observations: TelemetryObservation[] = [];

  // Build observer that collects observations AND delegates to any user observer.
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

  // Build goal reset config for the simulation's built-in phase-aware reset.
  // The simulation handles countdown → reset → playing automatically.
  const goalResetConfig: GoalResetConfig | undefined = doGoalReset
    ? { goalResetTicks: 60 }
    : undefined;

  const sim = createSimulation(world, collectObserver, undefined, undefined, undefined, undefined, goalResetConfig);

  // 2. Create a CPU adapter per AI_FALLBACK control slot.
  //    Each adapter has its own internal state (hasPossession, ballWasInRange),
  //    so they don't interfere with each other.
  type SlotCpu = {
    adapter: ReturnType<typeof createCpuAdapter>;
    controlSlot: string;
    teamId: string;
    controlledPlayerId: string;
  };
  const slotCpus: SlotCpu[] = [];
  for (const [slotId, assignment] of Object.entries(scenario.controlAssignments)) {
    const mode = (assignment as { mode?: string }).mode;
    if (mode === "AI_FALLBACK") {
      slotCpus.push({
        adapter: createCpuAdapter(),
        controlSlot: slotId,
        teamId: assignment.teamId,
        controlledPlayerId: assignment.controlledPlayerId ?? "",
      });
    }
  }

  // Build a teamId → set of controlSlots mapping from the scenario.
  const teamToSlots = new Map<string, Set<string>>();
  for (const [slotId, assignment] of Object.entries(scenario.controlAssignments)) {
    const mode = (assignment as { mode?: string }).mode;
    if (mode === "AI_FALLBACK") {
      let slots = teamToSlots.get(assignment.teamId);
      if (!slots) {
        slots = new Set();
        teamToSlots.set(assignment.teamId, slots);
      }
      slots.add(slotId);
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

    // Sync high-level match lifecycle phases to the simulation core.
    // The simulation maps: first-half → playing, halftime → halftime,
    // second-half → playing, fulltime → fulltime, kickoff → kickoff.
    // Goal phase is handled internally by the simulation's countdown.
    let syncedState: WorldState | null = null;
    {
      let simPhase: import("../../src/contracts/state.js").MatchPhase;
      switch (phase) {
        case "first-half": case "second-half":
          simPhase = "playing";
          break;
        case "halftime":
          simPhase = "halftime";
          break;
        case "fulltime":
          simPhase = "fulltime";
          break;
        case "kickoff":
          simPhase = "kickoff";
          break;
        default:
          simPhase = "playing";
      }
      // `snapshot()` already hands back a deep clone, so the extra mutable copy
      // is only taken on the ticks where the phase actually differs. The
      // resulting state — and every hash — is unchanged either way.
      const current = sim.snapshot();
      syncedState = current;
      if (current.matchPhase !== simPhase) {
        const mutable = deepClone(current) as WorldState;
        mutable.matchPhase = simPhase;
        sim.restore(mutable);
        syncedState = sim.snapshot();
      }
    }

    // a. Snapshot the world (deep clone — CPU adapters only read).
    const snapshot = syncedState ?? sim.snapshot();

    // b. Build full CpuObservation, then filter per team.
    //    Each CPU sees the full world but its OWN player is always first
    //    in the array (so the CpuAdapter picks the right player).
    const fullObs = buildCpuObservation(snapshot);

    // Compute score differential for score-aware AI.
    // Use the score accumulated so far (from events processed in prior ticks).
    const scoreAccum: MatchScore = {};
    for (const evt of events) {
      if (evt.kind === "goal") {
        const goalIndex = (evt.payload.goalIndex as number) ?? -1;
        const scoringTeamId = goalTeamMapping[goalIndex] ?? "unknown";
        scoreAccum[scoringTeamId] = (scoreAccum[scoringTeamId] ?? 0) + 1;
      }
    }

    // c. Sample input frames from each CPU slot.
    const tick = sim.tick;
    const frames: import("../../src/contracts/input.js").InputFrame[] = [];

    // Compute one team decision per team per tick, then inject into
    // all CPU observations for that team.  This mirrors the browser
    // test-bridge wiring and activates coordinated defensive behaviors
    // (pressing, covering, marking, defensive line coordination).
    const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
    for (const { teamId } of slotCpus) {
      if (!teamDecisions.has(teamId)) {
        const teamObs = buildTeamCpuObservation(fullObs, teamId);
        // The press designation lives or dies with the same switch the slots
        // are given, so a stashed run is one shape end to end.
        teamObs.cpuAntiHuddle = cpuAntiHuddle;
        const cpuGoals = scoreAccum[teamId] ?? 0;
        const opponentTeamId = teamId === "team-a" ? "team-b" : "team-a";
        const opponentGoals = scoreAccum[opponentTeamId] ?? 0;
        teamObs.scoreDifferential = cpuGoals - opponentGoals;
        teamDecisions.set(teamId, computeTeamDecision(teamObs, teamId));
      }
    }

    for (const { adapter, controlSlot, teamId, controlledPlayerId } of slotCpus) {
      // Browser parity: the composition root resolves the slot's team/player
      // through buildCpuObservation, which also supplies the fixed formation
      // anchor and the teammate list the support mechanisms read.
      const teamObs = browserParityObservations
        ? buildCpuObservation(snapshot, teamId, controlledPlayerId)
        : buildTeamCpuObservation(fullObs, teamId, controlledPlayerId);
      // Inject score differential for score-aware AI.
      const cpuGoals = scoreAccum[teamId] ?? 0;
      const opponentTeamId = teamId === "team-a" ? "team-b" : "team-a";
      const opponentGoals = scoreAccum[opponentTeamId] ?? 0;
      teamObs.scoreDifferential = cpuGoals - opponentGoals;
      // Inject the precomputed team decision for coordinated behavior.
      teamObs.teamDecision = teamDecisions.get(teamId);
      // CPU-DEFENSIVE-TACKLE: give the slot's controller the tackle buttons.
      if (cpuDefensiveTackle) {
        teamObs.cpuDefensiveTackle = true;
      }
      // 5V5-KICKOFF-ANTI-HUDDLE: the anti-huddle shape is live unless a caller
      // explicitly stashes it (the discriminating guards do exactly that).
      teamObs.cpuAntiHuddle = cpuAntiHuddle;

      const frame = adapter.sample(tick, teamObs);
      frame.controlSlot = controlSlot;
      frames.push(frame);
    }

    // d. Apply all input frames to the simulation.
    sim.applyInputs(frames);

    // e. Advance simulation by one tick.
    const stepResult = sim.step();

    // f. Collect results.
    stateHashes.push(stepResult.stateHash);
    for (const evt of stepResult.events) {
      events.push(evt);
      if (evt.kind === "goal") {
        hadGoal = true;
        // Goal reset is handled automatically by the simulation loop
        // via its built-in goal countdown → reset → playing transition.
        // No manual resetAfterGoal call needed.
      }
    }
  }

  // 5. Clean up CPU adapters.
  for (const { adapter } of slotCpus) {
    adapter.reset();
  }

  // 6. Compute match stats (clock + score) from events.
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