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
import type { SimulationObserver } from "../../src/simulation/telemetry/observer.js";

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