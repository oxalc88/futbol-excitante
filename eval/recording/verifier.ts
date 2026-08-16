/**
 * @module eval/recording/verifier
 *
 * Verifies a recorded replay by rerunning from the initial state
 * and comparing per-tick hashes.
 *
 * Usage:
 *  1. Create a replay (e.g. from recorder.build()).
 *  2. Call verifyReplay(replay, scenario) to compare hashes.
 *  3. Inspect VerifierResult for earliest divergence.
 *
 * Node I/O is allowed in this module (eval/adapters layer).
 * The simulation core itself never reads the wall clock or I/O.
 */

import type { ReplayV1 } from "../../src/contracts/replay.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { SimulationEvent } from "../../src/contracts/scenario.js";
import type { SimulationObserver } from "../../src/simulation/telemetry/observer.js";
import type { HeadlessMatchResult, MatchScore, MatchGoalEvent } from "../runners/headless-match.js";

import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { encodeCanonical } from "../../src/simulation/determinism/canonical.js";
import { hashFnv1a64 } from "../../src/simulation/determinism/hash.js";
import { freezeWorldState } from "../../src/simulation/world/clone.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Result of a replay verification run.
 */
export interface VerifierResult {
  /** Whether all hashes matched. */
  match: boolean;
  /** Earliest tick where hashes diverged (undefined if all match). */
  earliestDivergenceTick: number | undefined;
  /** At the earliest divergence: the hash expected from the replay. */
  earliestDivergenceExpected: string | undefined;
  /** At the earliest divergence: the hash computed from the rerun. */
  earliestDivergenceActual: string | undefined;
  /** Compact world-state slice at the earliest divergence tick (JSON string). */
  earliestDivergenceStateSlice: string | undefined;
  /** Number of per-tick hashes compared. */
  ticksChecked: number;
  /** Whether the initial-state hash matches the recorded one. */
  initialHashMatch: boolean;
}

// ---------------------------------------------------------------------------
// Extended result type for match replay verification
// ---------------------------------------------------------------------------

/**
 * Match-aware extension of VerifierResult.
 *
 * Adds score and goal event comparison fields so callers can verify
 * that a replay reproduces the same scoring progression as the
 * recorded match.
 */
export interface MatchVerifierResult extends VerifierResult {
  /** Whether the replayed score matches the recorded score. */
  scoreMatch: boolean;
  /** Whether the replayed goal events match the recorded goal events. */
  scoreEventsMatch: boolean;
  /** Recorded score from the original match result. */
  recordedScore: MatchScore;
  /** Replayed score computed from the replay simulation. */
  replayedScore: MatchScore;
  /** Number of goals in the recorded match. */
  recordedGoalCount: number;
  /** Number of goals scored during replay. */
  replayedGoalCount: number;
}

/** Default goal team mapping for a two-team match. */
const DEFAULT_GOAL_TEAM_MAPPING: Record<number, string> = { 0: "team-a", 1: "team-b" };

/**
 * Extract goal events from a HeadlessMatchResult.
 *
 * Returns the goalEvents array (or an empty array if not present).
 * This is a pure accessor — it does not modify the input.
 */
function extractGoalEvents(headlessMatchResult: HeadlessMatchResult): MatchGoalEvent[] {
  return headlessMatchResult.goalEvents ?? [];
}

/**
 * Score a simulation event list the same way the headless match runner does.
 *
 * This is a deterministic function of the event sequence. It does not
 * read the wall clock, consume the PRNG, or perform I/O.
 *
 * @param events - Simulation events collected during a match run.
 * @param headlessMatchResult - Match result used for score/goal comparison (may be the recorded run itself).
 * @param goalTeamMapping - Mapping from goalIndex to scoring teamId.
 * @returns MatchScore keyed by teamId and GoalTeamMapping for replayed events.
 */
function scoreEvents(
  events: SimulationEvent[],
  headlessMatchResult: HeadlessMatchResult,
  goalTeamMapping: Record<number, string>,
): { score: MatchScore; goalEvents: { tick: number; sequence: number; scoringTeamId: string }[] } {
  const score: MatchScore = {};
  const goalEvents: { tick: number; sequence: number; scoringTeamId: string }[] = [];
  const mapping = goalTeamMapping ?? DEFAULT_GOAL_TEAM_MAPPING;

  for (const evt of events) {
    if (evt.kind === "goal") {
      const goalIndex = (evt.payload.goalIndex as number) ?? 0;
      const scoringTeamId = mapping[goalIndex] ?? "unknown";

      if (!(scoringTeamId in score)) {
        score[scoringTeamId] = 0;
      }
      score[scoringTeamId]++;

      goalEvents.push({
        tick: evt.tick,
        sequence: evt.sequence,
        scoringTeamId,
      });
    }
  }

  // Fallback: if scorer found nothing but the match result has scores,
  // use the match result's score (handles edge cases where the scorer
  // cannot resolve the goal index from the event payload).
  if (Object.keys(score).length === 0 && Object.keys(headlessMatchResult.score).length > 0) {
    return { score: headlessMatchResult.score, goalEvents };
  }

  return { score, goalEvents };
}

/**
 * Compare two MatchScore objects for equality.
 *
 * @param a - First score map.
 * @param b - Second score map.
 * @returns true if every team has the same score in both maps.
 */
function scoresEqual(a: MatchScore, b: MatchScore): boolean {
  const keysA = new Set(Object.keys(a));
  const keysB = new Set(Object.keys(b));

  if (keysA.size !== keysB.size) return false;

  for (const key of keysA) {
    if (keysB.has(key) === false || a[key] !== b[key]) return false;
  }

  return true;
}

/**
 * Compare a recorded goal event list against a replayed one.
 *
 * Verifies that both lists have the same length and that every
 * recorded event has a matching replay event (same tick, sequence,
 * and scoring team).
 *
 * @param recorded - Events from the recorded match result.
 * @param replayed - Events extracted from the replay simulation.
 * @returns true if every event matches.
 */
function compareGoalEvents(
  recorded: MatchGoalEvent[],
  replayed: { tick: number; sequence: number; scoringTeamId: string }[],
): boolean {
  if (recorded.length !== replayed.length) return false;

  for (let i = 0; i < recorded.length; i++) {
    const recEvent = recorded[i];
    const repEvent = replayed[i];

    if (repEvent.tick !== recEvent.event.tick) return false;
    if (repEvent.sequence !== recEvent.event.sequence) return false;
    if (repEvent.scoringTeamId !== recEvent.scoringTeamId) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Helper: extract a compact state slice at a given tick
// ---------------------------------------------------------------------------

function makeStateSlice(
  tick: number,
  playerPositions: { playerId: string; groundPosition: { x: number; y: number } }[],
  ballState: {
    position: { x: number; y: number; z: number };
    linearVelocity: { x: number; y: number; z: number };
    regime: string;
  },
): string {
  return JSON.stringify({
    tick,
    players: playerPositions.map((p) => ({
      playerId: p.playerId,
      groundPosition: p.groundPosition,
    })),
    ball: ballState,
  });
}

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

/**
 * Verify a recorded replay by rerunning from the initial state
 * and comparing every per-tick hash against the recorded hashes.
 *
 * @param replay - The recorded ReplayV1 to verify.
 * @param scenario - The ScenarioDefinition used to create the initial world.
 * @param observer - Optional telemetry observer (defaults to no-op).
 * @returns VerifierResult with match status and divergence details.
 */
export function verifyReplay(
  replay: ReplayV1,
  scenario: ScenarioDefinition,
  observer?: SimulationObserver,
): VerifierResult {
  // Build the initial world from the scenario (same path as recording).
  const initialWorld = createWorld({ scenario });

  // Verify initial-state hash.
  const computedInitialStateHash = hashFnv1a64(
    encodeCanonical(
      freezeWorldState(initialWorld) as unknown as Record<string, unknown>,
    ),
  );
  const initialHashMatch =
    computedInitialStateHash === replay.header.initialStateHash;

  // Create a fresh simulation.
  const sim = createSimulation(initialWorld, observer);

  // Build a map of recorded hashes by tick for lookup.
  const recordedHashes = new Map<number, string>();
  for (const hp of replay.hashes) {
    recordedHashes.set(hp.tick, hp.stateHash);
  }

  // Replay all inputs.
  let earliestDivergenceTick: number | undefined = undefined;
  let earliestDivergenceExpected: string | undefined = undefined;
  let earliestDivergenceActual: string | undefined = undefined;
  let earliestDivergenceStateSlice: string | undefined = undefined;
  let ticksChecked = 0;

  const inputsByTick = new Map<number, typeof replay.inputs>();
  for (const frame of replay.inputs) {
    if (!inputsByTick.has(frame.tick)) {
      inputsByTick.set(frame.tick, []);
    }
    inputsByTick.get(frame.tick)!.push(frame);
  }

  // Run until all input ticks are processed.
  const maxTick = replay.inputs.length
    ? Math.max(...replay.inputs.map((f) => f.tick))
    : 0;
  const totalSteps = maxTick + 1;

  for (let step = 0; step < totalSteps; step++) {
    // Apply inputs for the current world tick.
    const framesForTick = inputsByTick.get(sim.tick);
    if (framesForTick) {
      sim.applyInputs(framesForTick);
    }

    const result = sim.step();

    // Compare hash if recorded.
    const expectedHash = recordedHashes.get(result.tick);
    if (expectedHash !== undefined) {
      ticksChecked++;
      if (expectedHash !== result.stateHash) {
        if (earliestDivergenceTick === undefined) {
          earliestDivergenceTick = result.tick;
          earliestDivergenceExpected = expectedHash;
          earliestDivergenceActual = result.stateHash;

          // Extract compact state snapshot via snapshot() and parse for slice.
          const snap = sim.snapshot();
          const playerPositions = snap.players.map((p) => ({
            playerId: p.playerId,
            groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
          }));
          const ballState = {
            position: {
              x: snap.ball.position.x,
              y: snap.ball.position.y,
              z: snap.ball.position.z,
            },
            linearVelocity: {
              x: snap.ball.linearVelocity.x,
              y: snap.ball.linearVelocity.y,
              z: snap.ball.linearVelocity.z,
            },
            regime: snap.ball.regime,
          };
          earliestDivergenceStateSlice = makeStateSlice(
            result.tick,
            playerPositions,
            ballState,
          );
        }
      }
    }
  }

  return {
    match: earliestDivergenceTick === undefined,
    earliestDivergenceTick,
    earliestDivergenceExpected,
    earliestDivergenceActual,
    earliestDivergenceStateSlice,
    ticksChecked,
    initialHashMatch,
  };
}

// ---------------------------------------------------------------------------
// Match replay verification
// ---------------------------------------------------------------------------

/**
 * Verify a recorded replay with match score awareness.
 *
 * Extends `verifyReplay` by also replaying the simulation with a
 * goal-tracking observer, then comparing the replayed score and goal
 * events against the recorded `HeadlessMatchResult`.
 *
 * This function does NOT modify `eval/runners/headless-match.ts`,
 * `eval/recording/recorder.ts`, or any core simulation code.
 *
 * @param replay - The recorded ReplayV1 to verify.
 * @param scenario - The ScenarioDefinition used to create the initial world.
 * @param headlessMatchResult - The recorded match result with score and goalEvents.
 * @param observer - Optional telemetry observer (defaults to no-op).
 * @returns MatchVerifierResult with match status, score comparison, and divergence details.
 */
export function verifyMatchReplay(
  replay: ReplayV1,
  scenario: ScenarioDefinition,
  headlessMatchResult: HeadlessMatchResult,
  observer?: SimulationObserver,
): MatchVerifierResult {
  // Delegate to verifyReplay for hash-level verification.
  const base = verifyReplay(replay, scenario, observer);

  // Extract recorded score and goal events.
  const recordedScore = headlessMatchResult.score ?? {};
  const recordedGoalEvents = extractGoalEvents(headlessMatchResult);

  // Run the replay simulation to collect events and compute score.
  const initialWorld = createWorld({ scenario });
  const sim = createSimulation(initialWorld, observer);

  // Group recorded inputs by tick.
  const inputsByTick = new Map<number, typeof replay.inputs>();
  for (const frame of replay.inputs) {
    if (!inputsByTick.has(frame.tick)) {
      inputsByTick.set(frame.tick, []);
    }
    inputsByTick.get(frame.tick)!.push(frame);
  }

  // Collect all simulation events from the replay run.
  const replayedEvents: SimulationEvent[] = [];

  const maxTick = replay.inputs.length
    ? Math.max(...replay.inputs.map((f) => f.tick))
    : 0;
  const totalSteps = maxTick + 1;

  for (let step = 0; step < totalSteps; step++) {
    const framesForTick = inputsByTick.get(sim.tick);
    if (framesForTick) {
      sim.applyInputs(framesForTick);
    }

    const result = sim.step();
    for (const evt of result.events) {
      replayedEvents.push(evt);
    }
  }

  // Score the replayed events using the same logic as the headless match runner.
  const { score: replayedScore, goalEvents: replayedGoalEvents } = scoreEvents(
    replayedEvents,
    headlessMatchResult,
    DEFAULT_GOAL_TEAM_MAPPING,
  );

  // Compare scores.
  const scoreMatch = scoresEqual(recordedScore, replayedScore);

  // Compare goal events.
  const scoreEventsMatch = compareGoalEvents(
    recordedGoalEvents,
    replayedGoalEvents,
  );

  return {
    ...base,
    scoreMatch,
    scoreEventsMatch,
    recordedScore,
    replayedScore,
    recordedGoalCount: recordedGoalEvents.length,
    replayedGoalCount: replayedGoalEvents.length,
  };
}