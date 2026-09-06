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
import type { WorldState, MatchPhase as SimMatchPhase } from "../../src/contracts/state.js";
import { createCpuAdapter, buildCpuObservation, getKeeperReleaseRecords, type CpuObservation } from "../../src/adapters/input-browser/cpu-adapter.js";
import {
  designateKeeperFromLayout,
  goalArcCenter,
  isInsideGoalArc,
  keeperArcSetPoint,
} from "../../src/adapters/input-browser/goalkeeper-role.js";
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
 * The default lifecyclePhaseSync policy.
 *
 * "core-owned" (RESTART-ANTI-HUDDLE-COHERENCE migration completed by
 * LIFECYCLE-MIGRATION-ASSESSMENT): the simulation core owns every phase it
 * opens and its restart machinery runs exactly as in the browser. "legacy" is
 * retained as an explicit opt-out for the accepted pre-migration pins.
 */
export const DEFAULT_LIFECYCLE_PHASE_SYNC = "core-owned";

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
   * Designated-keeper role (GK-5V5-ADAPTER-BEHAVIOR): assign one of the bodies
   * the scenario already ships per team as its SMALL-SIDED keeper and let the
   * adapter-layer keeper path run (goal-arc hold, no field chase, save/claim on
   * shots on target).
   *
   * Default false — the shape every accepted headless artifact was produced
   * with, and the explicit stash the discriminating guards use to reproduce the
   * pre-keeper frames. No body is added and no player count changes: the role is
   * an adapter-layer assignment resolved once from the match's starting layout
   * and injected as a stable actor id.
   */
  gkBehavior?: boolean;
  /**
   * Build each CPU slot's observation through `buildCpuObservation` with the
   * slot's team and player resolved — the browser composition root's shape,
   * which carries the fixed formation anchor and the teammate list. Opt-in: the
   * runner's own minimal team-filtered shape stays byte-identical for every
   * accepted headless evidence run.
   */
  browserParityObservations?: boolean;
  /**
   * Lifecycle phase-sync policy (RESTART-ANTI-HUDDLE-COHERENCE, migration
   * completed by LIFECYCLE-MIGRATION-ASSESSMENT).
   * - "core-owned" (default): the corrected policy — the core owns every phase
   *   it opens and its restart machinery (set pieces + the post-goal/halftime
   *   reset) executes exactly as it does in the browser, which never syncs.
   * - "legacy": the historical driver behavior, in which the runner overwrote
   *   the core's match phase with its own derived label on every tick. That
   *   froze the core's restart countdowns, so set pieces and the
   *   post-goal/halftime reset never executed headless — a driver defect the
   *   browser wiring never had. Retained as an explicit opt-out ONLY to
   *   reproduce the accepted pre-migration pins byte-for-byte (documented in
   *   docs/evidence/LIFECYCLE-MIGRATION-ASSESSMENT/RESULT.md).
   */
  lifecyclePhaseSync?: "legacy" | "core-owned";
  /**
   * Serialize the restart facts the protected rules oracles need
   * (RESTART-RULES-CONFORMANCE). When true, the runner injects, as
   * observation-level telemetry annotations (the gk-role precedent, post-loop
   * and additive):
   *   - the core's per-tick post-step `matchPhase` and `matchTimer` (a
   *     `core-match-phase` event per observation), and
   *   - the committed restart-executed events (`throw-in-executed`,
   *     `goal-kick-executed`, `corner-kick-executed`) read from the core's
   *     persistent `state.events`, placed into the matching-tick observation.
   * This closes the serialization limitation so `MATCH-TIMER-FREEZE` and the
   * `MATCH-*-AWARD` criteria become honestly measurable. It never affects
   * inputs, steps, or state hashes (all are committed before the injection),
   * and when false (the default) the observation stream is byte-identical to
   * every accepted non-gated run.
   */
  serializeRestartFacts?: boolean;
  /**
   * Re-home a designated keeper whose kickoff home is off its own goal arc onto
   * that arc (GK-CORE-OWNED-ARC-FIX). Under the core-owned lifecycle a
   * post-goal/halftime reset re-places every body at its kickoff home; a keeper
   * designated from a field position would thereby be stranded off its arc (a
   * core action the adapters do not control). The runner re-homes such a keeper
   * onto its arc before the world is created. Default auto: true when
   * `gkBehavior && lifecyclePhaseSync === "core-owned"` (so the `gkBehavior:false`
   * stash identity and the accepted legacy pins are untouched). Explicitly false
   * reproduces the pre-fix drift (the before-state for the evidence record).
   */
  rehomeKeeper?: boolean;
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
  /**
   * Committed simulation-core match phase per tick (index-aligned with
   * `observations`), as recorded by RESTART-ANTI-HUDDLE-COHERENCE so evidence
   * can label the core's own restart windows. `null`-free: every tick carries
   * the core's phase at sample time.
   */
  coreMatchPhases: SimMatchPhase[];
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
 * Re-home every designated keeper onto its own goal arc when the keeper role is
 * live under the core-owned lifecycle (GK-CORE-OWNED-ARC-FIX).
 *
 * A designated keeper is anchored to its goal arc (GOALKEEPER_SPEC §5).  A
 * scenario's kickoff home for that body may, however, be a field position (this
 * fixture designates team-a's keeper from a defender that starts ~24.6 m off its
 * arc).  Under core-owned the simulation resets every body to its kickoff home
 * after a goal/halftime, so that keeper would be re-placed off its arc and the
 * run would fail GK-POSITIONING-HOLD / GK-NO-FIELD-CHASE — even though the
 * keeper itself never chose to leave the arc (the reset is a core action the
 * adapters do not control).
 *
 * The fix is to re-home such a keeper to its goal arc before the world is
 * created, so its kickoff home IS the arc (the same condition that lets team-b's
 * keeper hold its arc).  The re-home is a pure function of the scenario layout
 * (the same designation the runner injects), requires no core change, and is
 * gated to `gkBehavior && lifecyclePhaseSync === "core-owned"` so the accepted
 * legacy pins (which let the keeper transit from its kickoff home) and the
 * `gkBehavior:false` stash-identity control stay byte-identical.
 *
 * Deterministic: same scenario → same re-homed scenario.  No Math.random, Date,
 * DOM, or Node I/O.
 */
export function rehomeKeeperToArc(scenario: ScenarioDefinition): ScenarioDefinition {
  const layout = scenario.players.map((p) => ({
    playerId: p.playerId,
    teamId: p.teamId,
    groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
    formationRole: (p as { formationRole?: "defender" | "midfielder" | "attacker" })
      .formationRole,
  }));
  const teamIds = [...new Set(scenario.players.map((p) => p.teamId))].sort();
  const players = scenario.players.map((p) => ({ ...p }));
  let changed = false;
  for (const teamId of teamIds) {
    const center = goalArcCenter(teamId, scenario.pitchLength);
    const keeperId = designateKeeperFromLayout(layout, teamId, scenario.pitchLength);
    if (keeperId === undefined) continue;
    const keeper = players.find((p) => p.playerId === keeperId);
    if (keeper === undefined) continue;
    // A keeper already at its arc (team-b's kickoff home is on the arc) stays put.
    if (isInsideGoalArc(keeper.groundPosition, center)) continue;
    // Otherwise re-home it onto the arc: goal-line centre, lateral drift clamped
    // inside the versioned band (this never commands a field position).
    keeper.groundPosition = keeperArcSetPoint(
      teamId,
      scenario.pitchLength,
      keeper.groundPosition.y,
    );
    changed = true;
  }
  return changed ? { ...scenario, players } : scenario;
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
    gkBehavior = false,
    browserParityObservations = false,
    lifecyclePhaseSync = DEFAULT_LIFECYCLE_PHASE_SYNC,
    serializeRestartFacts = false,
    rehomeKeeper,
  } = config;
  const halfDurationTicks = halfDurationTicksRaw;

  // Auto-reset: enable for non-LABORATORY profiles, respect explicit config.
  const doGoalReset = autoGoalReset ?? scenario.profile !== "LABORATORY";

  // GK-CORE-OWNED-ARC-FIX: under the core-owned lifecycle a post-goal/halftime
  // reset re-places every body at its kickoff home.  A designated keeper whose
  // kickoff home is far off its goal arc would then be stranded off-arc (the
  // run would fail GK-POSITIONING-HOLD / GK-NO-FIELD-CHASE even though the
  // keeper never chose to leave its arc).  Re-home the keeper onto its arc before
  // the world is created so its home IS the arc.  Gated to `gkBehavior` (the
  // stash-identity control is untouched) and to the core-owned policy (the
  // accepted legacy pins, which let the keeper transit from its kickoff home,
  // stay byte-identical).
  const shouldRehomeKeeper =
    rehomeKeeper ??
    (gkBehavior && lifecyclePhaseSync === "core-owned");
  const worldScenario =
    shouldRehomeKeeper ? rehomeKeeperToArc(scenario) : scenario;

  // 1. Create world and simulation.
  const world = createWorld({ scenario: worldScenario });
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

  // GK-5V5-ADAPTER-BEHAVIOR: the keeper role is an adapter-layer assignment on
  // the bodies the scenario already ships. It is resolved once, from the layout
  // the match starts with — never from a ball fact — and then injected into
  // every observation of that team, so a team's keeper is a stable actor id for
  // the whole run (spec §4). No world body is added and no player count changes.
  const keeperByTeam = new Map<string, string>();
  if (gkBehavior) {
    const layout = scenario.players.map((p) => ({
      playerId: p.playerId,
      teamId: p.teamId,
      groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
      formationRole: (p as { formationRole?: "defender" | "midfielder" | "attacker" })
        .formationRole,
    }));
    for (const { teamId } of slotCpus) {
      if (keeperByTeam.has(teamId)) continue;
      const keeperId = designateKeeperFromLayout(layout, teamId, scenario.pitchLength);
      if (keeperId !== undefined) keeperByTeam.set(teamId, keeperId);
    }
  }

  const keeperRoles = gkBehavior
    ? Object.fromEntries(keeperByTeam.entries())
    : undefined;
  const applyGkRole = (teamObs: CpuObservation): void => {
    if (!gkBehavior || keeperRoles === undefined) return;
    teamObs.gkBehavior = true;
    teamObs.keeperPlayerIds = keeperRoles;
  };

  // 3. Run the match loop.
  const events: SimulationEvent[] = [];
  const stateHashes: string[] = [];
  // Per-tick committed core match phase, index-aligned with the observations.
  // This is the phase the core actually ran the window with (the same one the
  // browser wiring hands its adapters), not the runner's derived phase label.
  const coreMatchPhases: SimMatchPhase[] = [];

  // RESTART-RULES-CONFORMANCE: per-tick POST-STEP core phase + timer, index-
  // aligned with the observations (this is the phase/timer that governed the
  // core's timer block for that tick, so the TIMER-FREEZE oracle can adjudicate
  // it). Populated only when `serializeRestartFacts` is on; value is captured
  // from the state at the start of the following iteration (the previous
  // tick's post-step state) and, for the final tick, from one snapshot after
  // the loop. Never affects inputs / steps / hashes.
  const postStepPhases: SimMatchPhase[] = [];
  const postStepTimers: number[] = [];

  // Phase tracking.
  let hadGoal = false;
  let currentPhase: MatchPhase = "kickoff";
  const phaseHistory: PhaseHistoryRecord[] = [{ tick: 0, phase: "kickoff" }];
  // GK-DISTRIBUTION-BEHAVIOR: capture the release-record baseline before the
  // loop so this run's keeper-release actions can be turned into committed
  // telemetry below, without disturbing any records a prior run left behind.
  const releaseRecordsStart = gkBehavior ? getKeeperReleaseRecords().length : 0;

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
    // RESTART-ANTI-HUDDLE-COHERENCE: before this change the runner rewrote the
    // core's phase to its own derived label every tick, which killed the core's
    // restart windows (set pieces and the post-goal/halftime reset never
    // executed) — a headless driver defect the browser wiring never had (the
    // browser does no phase sync). The policy now is in the block below.
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
      const syncToRunnerPhase = () => {
        const mutable = deepClone(current) as WorldState;
        mutable.matchPhase = simPhase;
        sim.restore(mutable);
        syncedState = sim.snapshot();
      };
      if (lifecyclePhaseSync === "legacy") {
        // Historical driver behavior: the runner's derived label wins every
        // tick, which kills the core's own restart windows. Left as the
        // default so every accepted pinned replay stays byte-identical.
        if (current.matchPhase !== simPhase) syncToRunnerPhase();
      } else {
        // "core-owned" (RESTART-ANTI-HUDDLE-COHERENCE): the core owns every
        // phase it opens; its set-piece and post-goal/halftime machinery runs
        // exactly as it does in the browser (which never syncs). The runner
        // may only (a) seed the opening "kickoff" tick and release that seed,
        // and (b) stamp the terminal "fulltime" tick — in both cases only
        // from a live "playing" phase.
        const forceable = simPhase === "kickoff" || simPhase === "fulltime";
        const releaseKickoffSeed =
          current.matchPhase === "kickoff" && simPhase === "playing";
        if (
          current.matchPhase !== simPhase &&
          (forceable || releaseKickoffSeed) &&
          (current.matchPhase === "playing" || releaseKickoffSeed)
        ) {
          syncToRunnerPhase();
        }
      }
      // Evidence records the phase the CPU slots were actually sampled with —
      // equal to the core's own phase on every restart tick under the
      // core-owned policy (browser parity).
      coreMatchPhases.push(syncedState.matchPhase);
      // RESTART-RULES-CONFORMANCE: the `current` snapshot (taken before any
      // lifecycle sync) is the post-step state of the PREVIOUS tick, so it is
      // the phase/timer that governed that tick's timer block. Capture it at
      // index i-1 (the loop starts at i=0, so skip i=0 and fill the final tick
      // after the loop). Gated on serializeRestartFacts.
      if (serializeRestartFacts && i > 0) {
        postStepPhases[i - 1] = current.matchPhase;
        postStepTimers[i - 1] = current.matchTimer;
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
        // With the keeper role live the shared press designation can never name
        // a team's keeper, so the chase, the press block and the tackle
        // authorisation all stay field-body decisions.
        applyGkRole(teamObs);
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
      applyGkRole(teamObs);

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

  // GK-KEEPER-ORACLE-REGISTRATION: propagate the adapter-layer keeper
  // designation into the observation stream so the protected GK oracles
  // (eval/oracles/gk-role.ts) read the actual designated keeper rather than
  // re-deriving it.  Emitted once on the first observation, and only when
  // gkBehavior is on (gkBehavior:false — every accepted non-GK pin — stays
  // byte-identical).  This is a runner observation annotation; the simulation
  // core, its event union and its contracts are untouched.
  if (gkBehavior && keeperRoles !== undefined && observations.length > 0) {
    const first = observations[0];
    let maxSeq = 0;
    for (const ev of first.events) {
      if (ev.sequence > maxSeq) maxSeq = ev.sequence;
    }
    const teams = Object.keys(keeperRoles).sort();
    for (let i = 0; i < teams.length; i++) {
      const teamId = teams[i];
      first.events.push({
        id: `gk-role-${first.tick}-${teamId}`,
        tick: first.tick,
        sequence: maxSeq + 1 + i,
        kind: "gk-role",
        label: `designated keeper ${keeperRoles[teamId]}`,
        payload: {
          teamId,
          keeperPlayerId: keeperRoles[teamId],
          keeperRoleFlag: true,
          pitchLength: scenario.pitchLength,
        },
      });
    }
  }

  // GK-DISTRIBUTION-BEHAVIOR: turn the adapter's committed keeper-release
  // actions into `keeper-release` telemetry events so the protected distribution
  // oracle (checkGkDistributionNoOmniscience) has real observations. The keeper
  // designation is an adapter-layer fact the simulation core does not and must
  // not know, so (as with the `gk-role` designation) the release event is an
  // observation-level annotation injected by the runner — never a core event —
  // and is emitted only when `gkBehavior` is on (a gkBehavior:false run stays
  // byte-identical). Only the release edges recorded during THIS run are used.
  if (gkBehavior && keeperRoles !== undefined) {
    const releases = getKeeperReleaseRecords().slice(releaseRecordsStart);
    const obsByTick = new Map<number, (typeof observations)[number]>();
    for (const o of observations) obsByTick.set(o.tick, o);
    for (const release of releases) {
      const o = obsByTick.get(release.tick);
      if (o === undefined) continue;
      let maxSeq = 0;
      for (const ev of o.events) if (ev.sequence > maxSeq) maxSeq = ev.sequence;
      o.events.push({
        id: `keeper-release-${release.tick}-${release.keeperPlayerId}-${maxSeq + 1}`,
        tick: release.tick,
        sequence: maxSeq + 1,
        kind: "keeper-release",
        label: `keeper ${release.keeperPlayerId} released to ${release.releaseTargetPlayerId}`,
        payload: {
          keeperPlayerId: release.keeperPlayerId,
          teamId: release.teamId,
          releaseTargetPlayerId: release.releaseTargetPlayerId,
          releaseTargetPosition: release.releaseTargetPosition,
          keeperPosition: release.keeperPosition,
        },
      });
    }
  }

  // RESTART-RULES-CONFORMANCE: close the serialization limitation so the
  // protected rules oracles can adjudicate the restart-AWARD (throw-in /
  // goal-kick / corner-kick) and the TIMER-FREEZE criteria. This is gated on
  // `serializeRestartFacts` (off => every accepted non-gated stream stays
  // byte-identical), runs post-loop (inputs, steps and state hashes are all
  // already committed, so it provably cannot affect them) and is additive
  // (observation-level annotations, the gk-role precedent; the core, its event
  // union and its contracts are untouched).
  if (serializeRestartFacts && observations.length > 0) {
    // The final snapshot after the loop is the post-step state of the last
    // tick, so its phase/timer fill the final index (the loop captured indices
    // 0..n-2 from the state at the start of each following iteration).
    const finalState = sim.snapshot();
    postStepPhases[observations.length - 1] = finalState.matchPhase;
    postStepTimers[observations.length - 1] = finalState.matchTimer;

    const obsByTick = new Map<number, (typeof observations)[number]>();
    for (const o of observations) obsByTick.set(o.tick, o);

    // 1. Inject the committed restart-executed events into the matching-tick
    //    observation. The core writes these to its persistent `state.events`,
    //    not to the per-step event array the observation stream carries, which
    //    is exactly why the restart-AWARD criteria were NOT_EVALUATED. Each
    //    event keeps its committed id/tick/sequence so the award oracles pair
    //    it with the right boundary event.
    const committedEvents = finalState.events;
    const restartExecKinds = new Set([
      "throw-in-executed",
      "goal-kick-executed",
      "corner-kick-executed",
    ]);
    for (const ev of committedEvents) {
      if (!restartExecKinds.has(ev.kind)) continue;
      const o = obsByTick.get(ev.tick);
      if (o === undefined) continue;
      o.events.push({
        id: ev.id,
        tick: ev.tick,
        sequence: ev.sequence,
        kind: ev.kind,
        label: ev.label,
        payload: ev.payload,
      });
    }

    // 2. Inject the per-tick core post-step matchPhase + matchTimer as a single
    //    `core-match-phase` observation event (the contract checkTimerFreeze
    //    reads). Sequence is computed after the restart-executed events so it
    //    never collides with an existing event id/sequence in that observation.
    for (let i = 0; i < observations.length; i++) {
      const o = observations[i];
      let maxSeq = 0;
      for (const ev of o.events) if (ev.sequence > maxSeq) maxSeq = ev.sequence;
      o.events.push({
        id: `core-match-phase-${o.tick}`,
        tick: o.tick,
        sequence: maxSeq + 1,
        kind: "core-match-phase",
        label: `core post-step phase ${String(postStepPhases[i])} timer ${postStepTimers[i]}`,
        payload: {
          // postPhase + matchTimer drive the TIMER-FREEZE oracle; startPhase is
          // the phase the core saw at the START of this tick, which the restart
          // machinery opens a window from (so `pairRestartBoundaries` can tell
          // a phase-opening boundary from one the core ignored mid-window).
          matchPhase: postStepPhases[i],
          matchTimer: postStepTimers[i],
          startPhase: coreMatchPhases[i],
        },
      });
    }
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
    coreMatchPhases,
  };
}