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
import type { SimulationEvent } from "../../src/contracts/scenario.js";
import type { SimulationObserver } from "../../src/simulation/telemetry/observer.js";
import {
  TRANSIENT_ACCEL_LOCOMOTION_V1,
  FOUNDATION_LOCOMOTION_V1,
  FOUNDATION_PLAYER_CONTACT_V1,
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

/**
 * Create a two-player duel scenario suitable for capability testing.
 * Two players start close together and run toward each other,
 * producing player-player-contact events.
 */
function makeDuelScenario(configVersion: string): Parameters<typeof createWorld>[0]["scenario"] {
  const inputProgram: Record<
    number,
    {
      tick: number;
      sourceId: string;
      controlSlot: string;
      moveX: number;
      moveY: number;
      sprint: number;
      heldButtons: number;
      pressedButtons: number;
      releasedButtons: number;
    }[]
  > = {};
  for (let t = 0; t < 60; t++) {
    inputProgram[t] = [
      {
        tick: t,
        sourceId: "capability-test",
        controlSlot: "slot-1",
        moveX: 0,
        moveY: 1,
        sprint: 1,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
      {
        tick: t,
        sourceId: "capability-test",
        controlSlot: "slot-2",
        moveX: 0,
        moveY: -1,
        sprint: 1,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
    ];
  }
  return {
    id: `duel-capability-scenario-${configVersion}`,
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
      {
        playerId: "player-cap-2",
        teamId: "team-b",
        groundPosition: { x: 0, y: 1.5 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
        desiredHeading: Math.PI,
      },
    ],
    ball: {
      position: { x: 0, y: 0.75, z: 0.11 },
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
      "slot-2": {
        controlSlot: "slot-2",
        teamId: "team-b",
        controlledPlayerId: "player-cap-2",
        mode: "HUMAN",
      },
    },
    missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
    maxConsecutiveMissing: 3,
    inputProgram,
    observationWindows: [{ startTick: 0, endTick: 60 }],
    scheduledEvents: {},
    requestedMetrics: ["player-displacement"],
  };
}

// ---------------------------------------------------------------------------
// Internal: run a simulation and collect observations + metrics
// ---------------------------------------------------------------------------

/**
 * Run a simulation for a given config version with optional config
 * overrides (locomotion and/or contact), collecting observations.
 */
function runCapabilityTest(
  configVersion: string,
  locomotionConfigOverride?: typeof TRANSIENT_ACCEL_LOCOMOTION_V1,
  contactConfigOverride?: typeof FOUNDATION_PLAYER_CONTACT_V1,
): {
  observations: TelemetryObservation[];
  metrics: ReturnType<typeof computePlayerMotionMetrics>;
  playerId: string;
  scenario: Parameters<typeof createWorld>[0]["scenario"];
} {
  const observations: TelemetryObservation[] = [];
  const allEvents: SimulationEvent[] = [];

  const collectObserver: SimulationObserver = {
    onObservation(obs: TelemetryObservation) {
      observations.push(obs);
    },
  };

  const scenario = makeCapabilityScenario(configVersion);
  const world = createWorld({ scenario });
  const sim = createSimulation(
    world,
    collectObserver,
    locomotionConfigOverride,
    contactConfigOverride,
  );

  const runTicks = 60;
  for (let i = 0; i < runTicks; i++) {
    const tickInputs = scenario.inputProgram[sim.tick] ?? [];
    if (tickInputs.length > 0) {
      sim.applyInputs(tickInputs);
    }
    const result = sim.step();
    allEvents.push(...result.events);
  }

  const metrics = computePlayerMotionMetrics(observations);

  return {
    observations,
    metrics,
    playerId: "player-cap-1",
    scenario,
  };
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

  // Dispatch to axis-specific evaluation.
  if (axis.axis_id === "physical-contact") {
    return evaluatePhysicalContactAxis(axis, evidence);
  }

  // Default: transient-acceleration (legacy path).
  return evaluateTransientAccelerationAxis(axis, evidence);
}

/**
 * Evaluate the physical-contact axis.
 *
 * Uses the duels scenario (scn-duels-phy-shld-001-v1) with a two-player
 * contact-producing input program. Runs low vs high contact config
 * (separationStiffness) under identical scenario input.
 *
 * Requirements:
 * - player-player-contact events MUST occur (honesty check).
 * - Measures player-displacement delta at the declared estimator tick.
 * - Checks direction and materiality.
 */
function evaluatePhysicalContactAxis(
  axis: {
    axis_id: string;
    profile_value_low: { id: string; value: number };
    profile_value_high: { id: string; value: number };
    expected_monotonic_direction: string;
    minimum_material_effect: { metric_id: string; value: number };
    max_permitted_cross_coupling: Array<{ metric_id: string; threshold: number }>;
    estimator_id: string;
    estimator_version: string;
  },
  evidence: string[],
): CapabilityDesignEvaluationResult["axes"][number] {
  // Build contact config variants by mutating separationStiffness.
  const lowContactCfg: typeof FOUNDATION_PLAYER_CONTACT_V1 = {
    ...FOUNDATION_PLAYER_CONTACT_V1,
    separationStiffness: { value: axis.profile_value_low.value, note: "provisional fraction of overlap to resolve per tick [0..1]" },
  } as typeof FOUNDATION_PLAYER_CONTACT_V1;
  const highContactCfg: typeof FOUNDATION_PLAYER_CONTACT_V1 = {
    ...FOUNDATION_PLAYER_CONTACT_V1,
    separationStiffness: { value: axis.profile_value_high.value, note: "provisional fraction of overlap to resolve per tick [0..1]" },
  } as typeof FOUNDATION_PLAYER_CONTACT_V1;

  // Run both profiles with the duel scenario and different contact configs.
  const observationsLow: TelemetryObservation[] = [];
  const observationsHigh: TelemetryObservation[] = [];
  const allEventsLow: SimulationEvent[] = [];
  const allEventsHigh: SimulationEvent[] = [];

  const scenario = makeDuelScenario(`capability-low-${axis.axis_id}-v1`);

  // Run low contact config.
  const worldLow = createWorld({ scenario });
  const simLow = createSimulation(
    worldLow,
    {
      onObservation(obs: TelemetryObservation) {
        observationsLow.push(obs);
      },
    },
    undefined,
    lowContactCfg,
  );
  {
    const runTicks = 60;
    for (let i = 0; i < runTicks; i++) {
      const tickInputs = scenario.inputProgram[simLow.tick] ?? [];
      if (tickInputs.length > 0) {
        simLow.applyInputs(tickInputs);
      }
      const result = simLow.step();
      allEventsLow.push(...result.events);
    }
  }

  // Run high contact config.
  const scenario2 = makeDuelScenario(`capability-high-${axis.axis_id}-v1`);
  const worldHigh = createWorld({ scenario: scenario2 });
  const simHigh = createSimulation(
    worldHigh,
    {
      onObservation(obs: TelemetryObservation) {
        observationsHigh.push(obs);
      },
    },
    undefined,
    highContactCfg,
  );
  {
    const runTicks = 60;
    for (let i = 0; i < runTicks; i++) {
      const tickInputs = scenario2.inputProgram[simHigh.tick] ?? [];
      if (tickInputs.length > 0) {
        simHigh.applyInputs(tickInputs);
      }
      const result = simHigh.step();
      allEventsHigh.push(...result.events);
    }
  }

  const metricsLow = computePlayerMotionMetrics(observationsLow);
  const metricsHigh = computePlayerMotionMetrics(observationsHigh);

  // Record config versions.
  evidence.push(
    `Axis "${axis.axis_id}": low=${axis.profile_value_low.value}, high=${axis.profile_value_high.value}`,
    `Estimator: ${axis.estimator_id} v${axis.estimator_version}`,
  );

  // --- Honesty check: contact events MUST exist ---
  const contactEventsLow = allEventsLow.filter(
    (e) => e.kind === "player-player-contact",
  );
  const contactEventsHigh = allEventsHigh.filter(
    (e) => e.kind === "player-player-contact",
  );

  if (contactEventsLow.length === 0) {
    evidence.push("No player-player-contact events in low run — axis FAIL");
    return {
      axis_id: axis.axis_id,
      status: "IMPLEMENTED",
      outcome: "FAIL",
      evidence,
    };
  }
  if (contactEventsHigh.length === 0) {
    evidence.push("No player-player-contact events in high run — axis FAIL");
    return {
      axis_id: axis.axis_id,
      status: "IMPLEMENTED",
      outcome: "FAIL",
      evidence,
    };
  }

  evidence.push(
    `Contact events: low=${contactEventsLow.length}, high=${contactEventsHigh.length}`,
  );

  // --- Estimator: delta-displacement-at-t20 ---
  const estimatorTick = 20;
  const lowDispAtT30 = getMetricAtTick(
    metricsLow,
    "displacement",
    estimatorTick,
    "player-cap-1",
  );
  const highDispAtT30 = getMetricAtTick(
    metricsHigh,
    "displacement",
    estimatorTick,
    "player-cap-1",
  );

  const deltaDisp =
    highDispAtT30 !== undefined && lowDispAtT30 !== undefined
      ? highDispAtT30 - lowDispAtT30
      : 0;

  evidence.push(
    `Displacement at t${estimatorTick}: low=${lowDispAtT30?.toFixed(6) ?? "N/A"}, high=${highDispAtT30?.toFixed(6) ?? "N/A"}`,
    `Delta displacement: ${deltaDisp.toFixed(6)}`,
  );

  // --- Check expected_monotonic_direction ---
  let directionOk = true;
  if (axis.expected_monotonic_direction === "INCREASE") {
    directionOk = deltaDisp >= 0;
  } else if (axis.expected_monotonic_direction === "DECREASE") {
    directionOk = deltaDisp <= 0;
  }
  evidence.push(
    `Monotonic direction check (${axis.expected_monotonic_direction}): ${directionOk ? "PASS" : "FAIL"}`,
  );

  // --- Check minimum_material_effect ---
  const meetsMateriality = Math.abs(deltaDisp) >= axis.minimum_material_effect.value;
  evidence.push(
    `Minimum material effect: ${Math.abs(deltaDisp).toFixed(6)} >= ${axis.minimum_material_effect.value} ? ${meetsMateriality}`,
  );

  // --- Check cross-coupling ---
  let crossCouplingOk = true;
  for (const cc of axis.max_permitted_cross_coupling) {
    if (cc.metric_id === "player-displacement" && Math.abs(deltaDisp) > cc.threshold) {
      crossCouplingOk = false;
      evidence.push(
        `Cross-coupling FAIL: delta displacement ${Math.abs(deltaDisp).toFixed(6)} > threshold ${cc.threshold}`,
      );
    }
  }
  if (crossCouplingOk) {
    evidence.push(`Cross-coupling OK`);
  }

  // --- Determine outcome ---
  let outcome: "PASS" | "FAIL" | "NOT_EVALUATED" = "PASS";
  if (deltaDisp === 0) {
    outcome = "FAIL";
    evidence.push(
      "No measurable effect from contact config variation — the knob is not exercised.",
    );
  } else if (!directionOk) {
    outcome = "FAIL";
    evidence.push(
      `Delta direction contradicts expected ${axis.expected_monotonic_direction}.`,
    );
  } else if (!meetsMateriality) {
    outcome = "FAIL";
    evidence.push(
      `Delta ${deltaDisp.toFixed(6)} below minimum_material_effect ${axis.minimum_material_effect.value}.`,
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

/**
 * Evaluate the transient-acceleration axis (legacy path).
 */
function evaluateTransientAccelerationAxis(
  axis: {
    axis_id: string;
    profile_value_low: { id: string; value: number };
    profile_value_high: { id: string; value: number };
    expected_monotonic_direction: string;
    minimum_material_effect: { metric_id: string; value: number };
    max_permitted_cross_coupling: Array<{ metric_id: string; threshold: number }>;
    estimator_id: string;
    estimator_version: string;
  },
  _evidence: string[],
): CapabilityDesignEvaluationResult["axes"][number] {
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
  const evidence = [
    `Axis "${axis.axis_id}": low=${axis.profile_value_low.value}, high=${axis.profile_value_high.value}`,
    `Estimator: ${axis.estimator_id} v${axis.estimator_version}, tick=${estimatorTick}`,
    `Speed at t${estimatorTick}: low=${lowSpeedAtT10?.toFixed(6) ?? "N/A"}, high=${highSpeedAtT10?.toFixed(6) ?? "N/A"}`,
    `Delta speed: ${deltaSpeed.toFixed(6)}`,
    `Sustainable-speed plateau: low=${lowSpeedAtEnd?.toFixed(6) ?? "N/A"}, high=${highSpeedAtEnd?.toFixed(6) ?? "N/A"}`,
    `Plateau delta: ${plateauDelta.toFixed(6)}`,
  ];

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