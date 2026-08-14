/**
 * @module apps/headless/run
 *
 * Headless simulation runner: validates a scenario, advances the simulation
 * for exactly the declared tick count, and produces structured output.
 *
 * The runner itself does NOT perform simulation — it delegates to the core.
 * It validates inputs, runs the loop, and writes artifacts.
 *
 * Node I/O allowed in this module (headless adapter layer).
 * Simulation core never reads I/O.
 *
 * No Math.random, Date, performance, DOM.
 */

import type { ScenarioDefinition } from "../../contracts/scenario.js";
import type { ReplayV1 } from "../../contracts/replay.js";
import type { TelemetryObservation } from "../../contracts/telemetry.js";
import type { SimulationObserver } from "../../simulation/telemetry/observer.js";
import type { InvariantResult } from "../../contracts/telemetry.js";
import type { EvaluationMetrics } from "../../contracts/telemetry.js";

import { createWorld } from "../../simulation/world/create.js";
import { createSimulation } from "../../simulation/loop/simulation.js";
import { encodeCanonical } from "../../simulation/determinism/canonical.js";
import { hashFnv1a64 } from "../../simulation/determinism/hash.js";
import { freezeWorldState } from "../../simulation/world/clone.js";
import { checkFiniteNumber } from "@pes/eval/invariants/finite.js";
import { checkEventReferences } from "@pes/eval/invariants/references.js";
import { checkBounds, type SafetyBounds } from "@pes/eval/invariants/bounds.js";
import { checkBallContinuity } from "@pes/eval/invariants/ball-continuity.js";
import { computePlayerMotionMetrics } from "@pes/eval/metrics/player-motion.js";
import { computeBallMotionMetrics } from "@pes/eval/metrics/ball-motion.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Result of a headless run.
 */
export interface RunResult {
  /** Scenario ID. */
  scenarioId: string;
  /** Total ticks advanced. */
  totalTicks: number;
  /** All telemetry observations. */
  observations: TelemetryObservation[];
  /** Per-tick state hashes. */
  hashes: Array<{ tick: number; hash: string }>;
  /** All events. */
  events: Array<{ tick: number; id: string; kind: string; label: string }>;
  /** Final state hash. */
  finalStateHash: string;
  /** Final world state. */
  finalState: Record<string, unknown>;
  /** Replay structure. */
  replay: ReplayV1;
  /** Computed metrics from observations. */
  metrics: EvaluationMetrics;
  /** Invariant check results. */
  invariants: InvariantResult[];
  /** Whether the run completed successfully. */
  success: boolean;
  /** Error message if the run failed. */
  error?: string;
}

/**
 * Options for running a headless scenario.
 */
export interface RunOptions {
  /** Scenario definition to run. */
  scenario: ScenarioDefinition;
  /** Simulation version string. */
  simulationVersion: string;
  /** Runtime identity string. */
  runtimeIdentity: string;
  /** Config version string. */
  configVersion: string;
  /** Config hash string. */
  configHash: string;
  /** Pitch/rules config hash. */
  pitchRulesHash: string;
  /** Roster/capability config hash. */
  rosterCapabilityHash: string;
  /** Full scenario hash. */
  scenarioHash: string;
  /** Observer for telemetry (optional). */
  observer?: SimulationObserver;
  /** Run identifier. */
  runId: string;
  /** Safety bounds for the scenario (used by bounds invariant). */
  safetyBounds?: { maxX: number; maxY: number; minZ: number; maxZ: number };
  /**
   * If set, called with (replay, scenario) to verify the replay.
   * Return true if the replay is valid, false if divergent.
   * This allows the caller to inject a verifier without importing from eval.
   */
  replayVerifier?: (replay: ReplayV1, scenario: ScenarioDefinition) => boolean;
  /**
   * Additional invariant check functions (optional).
   * Each function receives the full observations array and returns a result.
   */
  invariantChecks?: Array<
    (observations: TelemetryObservation[]) => InvariantResult
  >;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate a scenario definition for headless execution.
 *
 * @param scenario - The scenario to validate.
 * @throws {Error} on validation failure.
 */
function validateScenario(scenario: ScenarioDefinition): void {
  if (!scenario.id) {
    throw new Error("Scenario must have an id");
  }
  if (!scenario.version) {
    throw new Error("Scenario must have a version");
  }
  if (scenario.durationTicks <= 0) {
    throw new Error(`Scenario durationTicks must be positive, got ${scenario.durationTicks}`);
  }
  if (scenario.durationTicks > 1_000_000) {
    throw new Error(`Scenario durationTicks exceeds maximum of 1_000_000`);
  }
  if (scenario.players.length === 0) {
    throw new Error("Scenario must have at least one player");
  }
  if (!scenario.ball) {
    throw new Error("Scenario must have a ball definition");
  }
  if (scenario.seed < 0) {
    throw new Error("Scenario seed must be non-negative");
  }
}

// ---------------------------------------------------------------------------
// Headless run
// ---------------------------------------------------------------------------

/**
 * Run a headless simulation for a scenario.
 *
 * Steps:
 *  1. Validate the scenario.
 *  2. Create the world.
 *  3. Create an observer that collects observations.
 *  4. Advance the simulation for exactly scenario.durationTicks steps.
 *  5. Build a replay structure.
 *  6. Return the result.
 *
 * @param opts - Run options.
 * @returns RunResult with all collected data.
 * @throws {Error} on validation failure or invalid input.
 */
export function runHeadless(opts: RunOptions): RunResult {
  try {
    // 1. Validate scenario.
    validateScenario(opts.scenario);

    // 2. Create world.
    const world = createWorld({ scenario: opts.scenario });

    // 3. Create observer that collects observations.
    const observations: TelemetryObservation[] = [];
    const collectObserver: SimulationObserver = {
      onObservation(obs: TelemetryObservation) {
        observations.push(obs);
      },
      ...opts.observer,
    };

    // 4. Create simulation.
    const sim = createSimulation(world, collectObserver);

    // 5. Run the simulation.
    const hashes: Array<{ tick: number; hash: string }> = [];
    const events: Array<{ tick: number; id: string; kind: string; label: string }> = [];

    for (let i = 0; i < opts.scenario.durationTicks; i++) {
      // Apply inputs for the current tick.
      const tickInputs = opts.scenario.inputProgram[sim.tick] ?? [];
      if (tickInputs.length > 0) {
        sim.applyInputs(tickInputs);
      }

      const result = sim.step();
      hashes.push({ tick: result.tick, hash: result.stateHash });

      for (const e of result.events) {
        events.push({ tick: e.tick, id: e.id, kind: e.kind, label: e.label });
      }
    }

    // 6. Build replay structure.
    const replay: ReplayV1 = buildReplay(opts, world, observations, hashes);

    // 7. Final state.
    const finalState = freezeWorldState(
      sim.snapshot(),
    ) as unknown as Record<string, unknown>;

    // 8. Compute metrics from observations.
    const playerMetrics = computePlayerMotionMetrics(observations);
    const ballMetrics = computeBallMotionMetrics(observations);
    const metrics: EvaluationMetrics = {
      "player-speed": playerMetrics.series.speed,
      "player-displacement": playerMetrics.series.displacement,
      "player-heading-change": playerMetrics.series.headingChange,
      "ball-speed": ballMetrics.series.speed,
      "ball-distance": ballMetrics.series.distance,
      "ball-height": ballMetrics.series.height,
      "ball-contact": ballMetrics.series.contactCount,
      "ball-total-distance": ballMetrics.totalDistance,
    };

    // 9. Run default invariants (finite, references, bounds, ball-continuity).
    const invariants: InvariantResult[] = [];

    // Per-observation invariants.
    for (const obs of observations) {
      invariants.push(checkFiniteNumber(obs));
      invariants.push(checkEventReferences(obs));
      if (opts.safetyBounds) {
        invariants.push(checkBounds(obs, opts.safetyBounds as SafetyBounds));
      }
    }

    // Ball continuity (between consecutive observations).
    const dtFloat = world.fixedDt.numerator / world.fixedDt.denominator;
    const ballContinuityResults = checkBallContinuity(observations, {
      fixedDt: dtFloat,
    });
    for (const bc of ballContinuityResults) {
      invariants.push(bc);
    }

    // Final-state hash consistency.
    const finalCanonicalHash = hashFnv1a64(encodeCanonical(finalState));
    invariants.push({
      id: "final-state-hash-consistent",
      status: sim.stateHash() === finalCanonicalHash ? "pass" : "fail",
      description: "Final state hash matches canonical encoding",
      details: sim.stateHash() === finalCanonicalHash
        ? undefined
        : { computed: sim.stateHash(), canonical: finalCanonicalHash },
    });

    // Optional additional invariant checks.
    if (opts.invariantChecks) {
      for (const check of opts.invariantChecks) {
        invariants.push(check(observations));
      }
    }

    // 10. Optional replay verification.
    let replayDivergence = false;
    if (opts.replayVerifier) {
      replayDivergence = !opts.replayVerifier(replay, opts.scenario);
    }

    // Determine overall success.
    const hasInvariantFailure = invariants.some((inv) => inv.status === "fail");
    const success = !replayDivergence && !hasInvariantFailure;

    if (replayDivergence) {
      return {
        scenarioId: opts.scenario.id,
        totalTicks: sim.tick,
        observations,
        hashes,
        events,
        finalStateHash: sim.stateHash(),
        finalState,
        replay,
        metrics,
        invariants,
        success: false,
        error: `Replay divergence detected at tick ${replayDivergence ? "unknown" : "N/A"}`,
      };
    }

    if (hasInvariantFailure) {
      return {
        scenarioId: opts.scenario.id,
        totalTicks: sim.tick,
        observations,
        hashes,
        events,
        finalStateHash: sim.stateHash(),
        finalState,
        replay,
        metrics,
        invariants,
        success: false,
        error: `Invariant failure: ${invariants.filter((i) => i.status === "fail").map((i) => i.id).join(", ")}`,
      };
    }

    return {
      scenarioId: opts.scenario.id,
      totalTicks: sim.tick,
      observations,
      hashes,
      events,
      finalStateHash: sim.stateHash(),
      finalState,
      replay,
      metrics,
      invariants,
      success: true,
    };
  } catch (err) {
    return {
      scenarioId: opts.scenario.id ?? "unknown",
      totalTicks: 0,
      observations: [],
      hashes: [],
      events: [],
      finalStateHash: "",
      finalState: {},
      replay: createEmptyReplay(opts),
      metrics: {},
      invariants: [],
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Replay construction
// ---------------------------------------------------------------------------

/**
 * Build a ReplayV1 structure from a run.
 */
function buildReplay(
  opts: RunOptions,
  world: { schemaVersion: string; prng: { algorithmId: string; seed: number } },
  observations: TelemetryObservation[],
  hashes: Array<{ tick: number; hash: string }>,
): ReplayV1 {
  // Collect all input frames from observations.
  const inputs: Array<{
    tick: number;
    sourceId: string;
    controlSlot: string;
    moveX: number;
    moveY: number;
    sprint: number;
    heldButtons: number;
    pressedButtons: number;
    releasedButtons: number;
  }> = [];
  for (const obs of observations) {
    for (const frame of obs.inputs) {
      inputs.push({ ...frame });
    }
  }

  return {
    header: {
      replayVersion: "replay-v1",
      schemaVersion: world.schemaVersion,
      simulationVersion: opts.simulationVersion,
      runtimeIdentity: opts.runtimeIdentity,
      configVersion: opts.configVersion,
      configHash: opts.configHash,
      pitchRulesHash: opts.pitchRulesHash,
      rosterCapabilityHash: opts.rosterCapabilityHash,
      scenarioHash: opts.scenarioHash,
      initialStateHash: hashes[0]?.hash ?? "",
      prngAlgorithmId: opts.scenario.prngAlgorithmId,
      prngSeed: opts.scenario.seed,
      prngState: {
        algorithmId: opts.scenario.prngAlgorithmId,
        seed: opts.scenario.seed,
        state: {},
      },
      recordedAt: new Date().toISOString(),
      runId: opts.runId,
    },
    inputs,
    scheduledEvents: [],
    hashes: hashes.map((h) => ({ tick: h.tick, stateHash: h.hash })),
    checkpoints: [],
    checkpointsState: [],
  };
}

/**
 * Create an empty replay structure for failed runs.
 */
function createEmptyReplay(opts: RunOptions): ReplayV1 {
  return {
    header: {
      replayVersion: "replay-v1",
      schemaVersion: "",
      simulationVersion: opts.simulationVersion,
      runtimeIdentity: opts.runtimeIdentity,
      configVersion: opts.configVersion,
      configHash: opts.configHash,
      pitchRulesHash: opts.pitchRulesHash,
      rosterCapabilityHash: opts.rosterCapabilityHash,
      scenarioHash: opts.scenarioHash,
      initialStateHash: "",
      prngAlgorithmId: opts.scenario.prngAlgorithmId,
      prngSeed: opts.scenario.seed,
      prngState: {
        algorithmId: opts.scenario.prngAlgorithmId,
        seed: opts.scenario.seed,
        state: {},
      },
      recordedAt: new Date().toISOString(),
      runId: opts.runId,
    },
    inputs: [],
    scheduledEvents: [],
    hashes: [],
    checkpoints: [],
    checkpointsState: [],
  };
}