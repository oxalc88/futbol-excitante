/**
 * @module eval/runners/evaluate
 *
 * Evaluates a scenario by running the simulation core with telemetry
 * collection, invariant checking, and metric computation.
 *
 * This module is Node-aware (uses Node I/O for artifact writing) but
 * delegates all simulation to the DOM-free core.
 *
 * No Math.random, Date, performance, DOM in src/simulation.
 * Node I/O is allowed here in the eval layer.
 */

import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { SimulationObserver } from "../../src/simulation/telemetry/observer.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";
import type { EvaluationMetrics } from "../../src/contracts/telemetry.js";

import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { encodeCanonical } from "../../src/simulation/determinism/canonical.js";
import { hashFnv1a64 } from "../../src/simulation/determinism/hash.js";
import { freezeWorldState } from "../../src/simulation/world/clone.js";
import { computePlayerMotionMetrics } from "../metrics/player-motion.js";
import { computeBallMotionMetrics } from "../metrics/ball-motion.js";
import { checkFiniteNumber } from "../invariants/finite.js";
import { checkEventReferences } from "../invariants/references.js";
import { checkBounds, type SafetyBounds } from "../invariants/bounds.js";
import { checkBallContinuity } from "../invariants/ball-continuity.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Result of an evaluation run.
 */
export interface EvaluationResult {
  /** Scenario ID. */
  scenarioId: string;
  /** Scenario version. */
  scenarioVersion: string;
  /** Total ticks advanced. */
  totalTicks: number;
  /** All telemetry observations collected. */
  observations: TelemetryObservation[];
  /** Computed metrics. */
  metrics: EvaluationMetrics;
  /** Invariant check results. */
  invariants: InvariantResult[];
  /** Final state hash. */
  finalStateHash: string;
  /** All per-tick hashes. */
  hashes: Map<number, string>;
  /** All events. */
  events: Array<{ tick: number; id: string; kind: string; label: string }>;
  /** Final state (JSON-serializable). */
  finalState: Record<string, unknown>;
  /** PRNG seed used (from scenario). */
  seed: number;
  /** Scenario config version (from scenario definition). */
  scenarioConfigVersion: string;
  /** Whether any invariant failed. */
  hasInvariantFailures: boolean;
}

/**
 * Options for the evaluation runner.
 */
export interface EvaluateOptions {
  /** Scenario definition to run. */
  scenario: ScenarioDefinition;
  /** Observer for telemetry (defaults to no-op). */
  observer?: SimulationObserver;
  /** Hard safety bounds for the bounds invariant (optional). */
  safetyBounds?: SafetyBounds;
  /** Additional invariant check functions. */
  invariantChecks?: Array<
    (obs: TelemetryObservation, observations: TelemetryObservation[]) => InvariantResult
  >;
}

// ---------------------------------------------------------------------------
// Evaluation runner
// ---------------------------------------------------------------------------

/**
 * Run an evaluation: advance the simulation, collect observations,
 * compute metrics, and run invariants.
 *
 * @param opts - Evaluation options.
 * @returns EvaluationResult with all collected data.
 */
export function evaluate(opts: EvaluateOptions): EvaluationResult {
  const { scenario, observer, invariantChecks } = opts;

  // Build the world.
  const world = createWorld({ scenario });

  // Create observer that collects observations.
  const observations: TelemetryObservation[] = [];
  const collectObserver: SimulationObserver = {
    onObservation(obs: TelemetryObservation) {
      observations.push(obs);
    },
    ...observer,
  };

  // Create simulation.
  const sim = createSimulation(world, collectObserver);

  // Run the simulation.
  const hashes = new Map<number, string>();
  const allEvents: Array<{ tick: number; id: string; kind: string; label: string }> = [];

  for (let i = 0; i < scenario.durationTicks; i++) {
    // Apply inputs for the tick that step() will resolve.
    // step() reads inputBuffers[world.tick] before incrementing, so frames for
    // tick sim.tick must be buffered under key String(sim.tick). This matches
    // the headless runner and every other eval runner (inputProgram[sim.tick]).
    const tickInputs = scenario.inputProgram[sim.tick] ?? [];
    if (tickInputs.length > 0) {
      sim.applyInputs(tickInputs);
    }

    const result = sim.step();
    hashes.set(result.tick, result.stateHash);

    // Collect events from this step.
    for (const e of result.events) {
      allEvents.push({ tick: e.tick, id: e.id, kind: e.kind, label: e.label });
    }
  }

  // Collect all observations (including those from observer callbacks).
  // The collectObserver's onObservation already captured them.

  // Compute metrics.
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

  // Run default invariants (finite, references, bounds, ball-continuity).
  // These come from the eval/invariants/* modules — the authoritative source.
  const invariants: InvariantResult[] = [];

  // Per-observation invariants: finite-number (each observation),
  // event-references (each observation), bounds (if safetyBounds provided).
  for (const obs of observations) {
    invariants.push(checkFiniteNumber(obs));
    invariants.push(checkEventReferences(obs));
    if (opts.safetyBounds) {
      invariants.push(checkBounds(obs, opts.safetyBounds));
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

  // Optional additional invariant checks (caller-provided, per observation).
  if (invariantChecks) {
    for (const obs of observations) {
      for (const check of invariantChecks) {
        invariants.push(check(obs, observations));
      }
    }
  }

  // Run final-state checks.
  const finalHash = sim.stateHash();
  const frozenState = freezeWorldState(
    sim.snapshot(),
  ) as unknown as Record<string, unknown>;
  const finalCanonicalHash = hashFnv1a64(encodeCanonical(frozenState));

  invariants.push({
    id: "final-state-hash-consistent",
    status: finalHash === finalCanonicalHash ? "pass" : "fail",
    description: "Final state hash matches canonical encoding",
    details:
      finalHash === finalCanonicalHash
        ? undefined
        : { computed: finalHash, canonical: finalCanonicalHash },
  });

  const hasInvariantFailures = invariants.some((inv) => inv.status === "fail");

  return {
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    totalTicks: sim.tick,
    observations,
    metrics,
    invariants,
    finalStateHash: finalHash,
    hashes,
    events: allEvents,
    finalState: frozenState,
    seed: scenario.seed,
    scenarioConfigVersion: scenario.configVersion,
    hasInvariantFailures,
  };
}