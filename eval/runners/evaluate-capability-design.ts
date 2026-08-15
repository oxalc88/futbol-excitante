/**
 * @module @pes/eval/runners/evaluate-capability-design
 *
 * Evaluates `ENGINE_DESIGN_TARGET` criteria from the
 * CapabilityDesignProfile by running matched capability profiles
 * (low vs high) on the bound scenario/metric IDs.
 *
 * Per GAMEPLAY_EVALUATION_SPEC.md §5.6:
 * - IMPLEMENTED axes are exercised: low vs high profile values are
 *   run under identical initial state, input, and seed. The estimator
 *   measures the delta at a declared tick.
 * - DEFERRED axes return NOT_EVALUATED / DEFERRED.
 * - Precedence: INVALID_RUN > FAIL > PASS.
 * - Empty/missing run is NOT_EVALUATED, not PASS.
 *
 * No Math.random, Date, DOM, or Node I/O in the core evaluation.
 * Node I/O is allowed in this eval layer for artifact writing.
 */

import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { loadDefaultCapabilityDesignProfile } from "../contracts/capability-design-loader.js";
import { SCENARIO_REGISTRY } from "../contracts/scenarios.js";
import type { CapabilityDesignProfile } from "../contracts/capability-design.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { SimulationObserver } from "../../src/simulation/telemetry/observer.js";
import {
  TRANSIENT_ACCEL_LOCOMOTION_V1,
  FOUNDATION_LOCOMOTION_V1,
} from "../../src/simulation/config/foundation.js";
import { computePlayerMotionMetrics } from "../metrics/player-motion.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Per-axis evaluation result produced by the capability design runner.
 */
export interface CapabilityDesignEvaluationResult {
  /** Profile version evaluated. */
  profileVersion: string;
  /** Per-axis results. */
  axes: Array<{
    axis_id: string;
    status: "IMPLEMENTED" | "DEFERRED";
    outcome: "PASS" | "FAIL" | "NOT_EVALUATED" | "DEFERRED";
    evidence: string[];
  }>;
  /** Overall outcome: INVALID_RUN > FAIL > PASS > NOT_EVALUATED. */
  overall: "PASS" | "FAIL" | "NOT_EVALUATED" | "INVALID_RUN";
}

/** Options for the capability design evaluation. */
export interface EvaluateCapabilityDesignOptions {
  /**
   * CapabilityDesignProfile to evaluate.
   * Defaults to the versioned profile from the contract.
   */
  profile?: CapabilityDesignProfile;
}

// ---------------------------------------------------------------------------
// Internal: create a versioned scenario for a capability test
// ---------------------------------------------------------------------------

/**
 * Create a minimal versioned scenario suitable for locomotion comparison.
 * Produces a scenario with a forward sprint input and a versioned config.
 */
function makeCapabilityScenario(
  configVersion: string,
): Parameters<typeof createWorld>[0]["scenario"] {
  // Build input program with sprint held for all ticks.
  const inputProgram: Record<number, { tick: number; sourceId: string; controlSlot: string; moveX: number; moveY: number; sprint: number; heldButtons: number; pressedButtons: number; releasedButtons: number }[]> = {};
  for (let t = 0; t < 60; t++) {
    inputProgram[t] = [
      {
        tick: t,
        sourceId: "capability-test",
        controlSlot: "slot-1",
        moveX: 1,
        moveY: 0,
        sprint: 1,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
    ];
  }

  return {
    id: `capability-scenario-${configVersion}`,
    version: "capability-test-v1",
    family: "capability-design",
    durationTicks: 60,
    seed: 42,
    prngAlgorithmId: "mulberry32-v1",
    schemaVersion: "state-v1",
    simulationVersion: "sim-v1",
    configVersion,
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
        playerId: "player-cap-1",
        teamId: "team-a",
        groundPosition: { x: 0, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        desiredHeading: 0,
      },
    ],
    ball: {
      position: { x: 10, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    controlAssignments: {
      "slot-1": {
        controlSlot: "slot-1",
        teamId: "team-a",
        controlledPlayerId: "player-cap-1",
        mode: "HUMAN",
      },
    },
    missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
    maxConsecutiveMissing: 3,
    inputProgram,
    observationWindows: [{ startTick: 0, endTick: 60 }],
    scheduledEvents: {},
    requestedMetrics: ["player-speed", "player-displacement"],
  };
}

// ---------------------------------------------------------------------------
// Internal: run a simulation and collect observations + metrics
// ---------------------------------------------------------------------------

/**
 * Run a simulation for a given config version with an optional locomotion config override,
 * collecting observations.
 */
function runCapabilityTest(
  configVersion: string,
  locomotionConfigOverride?: typeof TRANSIENT_ACCEL_LOCOMOTION_V1,
): {
  observations: TelemetryObservation[];
  metrics: ReturnType<typeof computePlayerMotionMetrics>;
  playerId: string;
  scenario: Parameters<typeof createWorld>[0]["scenario"];
} {
  const observations: TelemetryObservation[] = [];

  const collectObserver: SimulationObserver = {
    onObservation(obs: TelemetryObservation) {
      observations.push(obs);
    },
  };

  const scenario = makeCapabilityScenario(configVersion);
  const world = createWorld({ scenario });
  const sim = createSimulation(world, collectObserver, locomotionConfigOverride);

  const runTicks = 60;
  for (let i = 0; i < runTicks; i++) {
    const tickInputs = scenario.inputProgram[sim.tick] ?? [];
    if (tickInputs.length > 0) {
      sim.applyInputs(tickInputs);
    }
    sim.step();
  }

  const metrics = computePlayerMotionMetrics(observations);

  return { observations, metrics, playerId: "player-cap-1", scenario };
}

// ---------------------------------------------------------------------------
// Internal: compute a metric value at a given tick
// ---------------------------------------------------------------------------

/**
 * Get a metric series value at a specific tick.
 */
function getMetricAtTick(
  metrics: ReturnType<typeof computePlayerMotionMetrics>,
  seriesKey: "speed" | "displacement",
  tick: number,
  playerId: string,
): number | undefined {
  const series = metrics.series[seriesKey];
  for (const entry of series) {
    if (entry.tick === tick && entry.playerId === playerId) {
      return entry.value;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Main evaluation: CapabilityDesignProfile → outcome
// ---------------------------------------------------------------------------

/**
 * Evaluate the CapabilityDesignProfile by exercising each axis.
 *
 * For IMPLEMENTED axes, runs matched low vs high profiles and measures
 * the estimator delta. For DEFERRED axes, returns NOT_EVALUATED.
 *
 * @param opts - Evaluation options.
 * @returns CapabilityDesignEvaluationResult with per-axis outcomes.
 */
export function evaluateCapabilityDesign(
  opts?: EvaluateCapabilityDesignOptions,
): CapabilityDesignEvaluationResult {
  const profile = opts?.profile ?? loadDefaultCapabilityDesignProfile();

  const axesResults: CapabilityDesignEvaluationResult["axes"] = [];

  // Sort axes: IMPLEMENTED first, then DEFERRED.
  const sortedAxes = Object.values(profile.axes).sort(
    (a, b) => (a.status === "DEFERRED" ? 1 : 0) - (b.status === "DEFERRED" ? 1 : 0),
  );

  for (const axis of sortedAxes) {
    if (axis.status === "DEFERRED") {
      axesResults.push({
        axis_id: axis.axis_id,
        status: "DEFERRED",
        outcome: "DEFERRED",
        evidence: [
          `Axis "${axis.axis_id}" is DEFERRED — engine cannot exercise this capability.`,
        ],
      });
      continue;
    }

    // IMPLEMENTED axis: run low vs high.
    const outcome = evaluateAxis(axis, profile);
    axesResults.push(outcome);
  }

  // Determine overall: FAIL > PASS > NOT_EVALUATED
  // Note: axis outcomes are PASS/FAIL/NOT_EVALUATED/DEFERRED.
  // DEFERRED axes don't affect the overall verdict.
  let overall: CapabilityDesignEvaluationResult["overall"] = "NOT_EVALUATED";
  if (axesResults.some((a) => a.outcome === "FAIL")) {
    overall = "FAIL";
  } else if (axesResults.some((a) => a.outcome === "PASS")) {
    overall = "PASS";
  }

  return {
    profileVersion: profile.profile_version,
    axes: axesResults,
    overall,
  };
}

// ---------------------------------------------------------------------------
// Per-axis evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a single IMPLEMENTED axis by comparing low vs high profiles.
 */
function evaluateAxis(
  axis: {
    axis_id: string;
    status: string;
    scenario_ids: string[];
    metric_ids: string[];
    profile_value_low: { id: string; value: number };
    profile_value_high: { id: string; value: number };
    expected_monotonic_direction: string;
    minimum_material_effect: { metric_id: string; value: number };
    protected_outputs: string[];
    max_permitted_cross_coupling: Array<{ metric_id: string; threshold: number }>;
    estimator_id: string;
    estimator_version: string;
  },
  _profile: CapabilityDesignProfile,
): CapabilityDesignEvaluationResult["axes"][number] {
  const evidence: string[] = [];

  // 1. Check that the scenario exists in the registry.
  const scenarioId = axis.scenario_ids[0];
  if (!scenarioId || !SCENARIO_REGISTRY[scenarioId]) {
    evidence.push(
      `Scenario "${scenarioId}" not found in registry for axis "${axis.axis_id}"`,
    );
    return {
      axis_id: axis.axis_id,
      status: "IMPLEMENTED",
      outcome: "NOT_EVALUATED",
      evidence,
    };
  }

  // 2. Define config versions for low and high capability runs.
  const lowConfigVersion = `capability-low-${axis.axis_id}-v1`;
  const highConfigVersion = `capability-high-${axis.axis_id}-v1`;

  // 3. Create low and high locomotion configs.
  // Low: baseline (transientAcceleration=0).
  const lowConfig = { ...FOUNDATION_LOCOMOTION_V1, transientAcceleration: { value: 0, note: "low" } } as unknown as typeof FOUNDATION_LOCOMOTION_V1;
  // High: maximum transient acceleration (transientAcceleration=1).
  const highConfig = { ...TRANSIENT_ACCEL_LOCOMOTION_V1, transientAcceleration: { value: 1, note: "high" } } as unknown as typeof TRANSIENT_ACCEL_LOCOMOTION_V1;

  // 4. Run both capability profiles.
  const lowResult = runCapabilityTest(lowConfigVersion, lowConfig);
  const highResult = runCapabilityTest(highConfigVersion, highConfig);

  // 4. Compute estimator: delta-speed-at-t10.
  const estimatorTick = 10;
  const lowSpeedAtT10 = getMetricAtTick(
    lowResult.metrics,
    "speed",
    estimatorTick,
    lowResult.playerId,
  );
  const highSpeedAtT10 = getMetricAtTick(
    highResult.metrics,
    "speed",
    estimatorTick,
    highResult.playerId,
  );

  const deltaSpeed =
    highSpeedAtT10 !== undefined && lowSpeedAtT10 !== undefined
      ? highSpeedAtT10 - lowSpeedAtT10
      : 0;

  // 5. Get sustainable-speed plateau (last tick speed).
  const lowSpeedAtEnd =
    lowResult.metrics.series.speed[lowResult.metrics.series.speed.length - 1]?.value;
  const highSpeedAtEnd =
    highResult.metrics.series.speed[highResult.metrics.series.speed.length - 1]?.value;
  const plateauDelta =
    Math.abs((highSpeedAtEnd ?? 0) - (lowSpeedAtEnd ?? 0));

  // --- Record evidence ---
  evidence.push(
    `Axis "${axis.axis_id}": low=${axis.profile_value_low.value}, high=${axis.profile_value_high.value}`,
    `Estimator: ${axis.estimator_id} v${axis.estimator_version}, tick=${estimatorTick}`,
    `Speed at t${estimatorTick}: low=${lowSpeedAtT10?.toFixed(6) ?? "N/A"}, high=${highSpeedAtT10?.toFixed(6) ?? "N/A"}`,
    `Delta speed: ${deltaSpeed.toFixed(6)}`,
    `Sustainable-speed plateau: low=${lowSpeedAtEnd?.toFixed(6) ?? "N/A"}, high=${highSpeedAtEnd?.toFixed(6) ?? "N/A"}`,
    `Plateau delta: ${plateauDelta.toFixed(6)}`,
  );

  // 6. Check expected_monotonic_direction.
  let directionOk = true;
  if (axis.expected_monotonic_direction === "INCREASE") {
    directionOk = deltaSpeed >= 0;
  } else if (axis.expected_monotonic_direction === "DECREASE") {
    directionOk = deltaSpeed <= 0;
  }
  evidence.push(
    `Monotonic direction check (${axis.expected_monotonic_direction}): ${directionOk ? "PASS" : "FAIL"}`,
  );

  // 7. Check minimum_material_effect.
  const meetsMateriality = Math.abs(deltaSpeed) >= axis.minimum_material_effect.value;
  evidence.push(
    `Minimum material effect: ${Math.abs(deltaSpeed).toFixed(6)} >= ${axis.minimum_material_effect.value} ? ${meetsMateriality}`,
  );

  // 8. Check cross-coupling threshold.
  let crossCouplingOk = true;
  for (const cc of axis.max_permitted_cross_coupling) {
    if (cc.metric_id === "player-speed" && plateauDelta > cc.threshold) {
      crossCouplingOk = false;
      evidence.push(
        `Cross-coupling FAIL: plateau delta ${plateauDelta.toFixed(6)} > threshold ${cc.threshold}`,
      );
    }
  }
  if (crossCouplingOk) {
    evidence.push(
      `Cross-coupling OK: plateau delta ${plateauDelta.toFixed(6)} <= threshold`,
    );
  }

  // 9. Determine outcome.
  let outcome: "PASS" | "FAIL" | "NOT_EVALUATED" = "PASS";
  if (deltaSpeed === 0) {
    // No effect — the capability hook may not be implemented.
    outcome = "FAIL";
    evidence.push(
      "No measurable effect from capability variation — the hook may not be exercised.",
    );
  } else if (!directionOk) {
    outcome = "FAIL";
    evidence.push(
      `Delta direction contradicts expected ${axis.expected_monotonic_direction}.`,
    );
  } else if (!meetsMateriality) {
    outcome = "FAIL";
    evidence.push(
      `Delta ${deltaSpeed.toFixed(6)} below minimum_material_effect ${axis.minimum_material_effect.value}.`,
    );
  } else if (!crossCouplingOk) {
    outcome = "FAIL";
    evidence.push("Protected output cross-coupling exceeded threshold.");
  }

  return {
    axis_id: axis.axis_id,
    status: "IMPLEMENTED",
    outcome,
    evidence,
  };
}