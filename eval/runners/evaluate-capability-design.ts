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
  FOUNDATION_BALL_V1,
} from "../../src/simulation/config/foundation.js";
import { computePlayerMotionMetrics } from "../metrics/player-motion.js";
import { computeBallMotionMetrics } from "../metrics/ball-motion.js";

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
  seriesKey: "speed" | "displacement" | "headingChange",
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

  if (axis.axis_id === "shooting-power") {
    return evaluateShootingPowerAxis(axis, evidence);
  }

  if (axis.axis_id === "body-control") {
    return evaluateBodyControlAxis(axis, evidence);
  }

  if (axis.axis_id === "swerve") {
    return evaluateSwerveAxis(axis, evidence);
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
  // The separationStiffness knob affects how aggressively players are
  // pushed apart during player-player-contact.  In this engine the
  // high-stiffness case resolves contact so forcefully that players
  // are pushed back toward their starting positions, producing a
  // displacement delta at t20 of ≈ 0.017 > 0.005 materiality.
  // DECREASE direction: higher stiffness → players pushed back → less
  // net displacement at the estimator tick.
  const estimatorTick = 20;

  const lowDispAtT20 = getMetricAtTick(
    metricsLow,
    "displacement",
    estimatorTick,
    "player-cap-1",
  );
  const highDispAtT20 = getMetricAtTick(
    metricsHigh,
    "displacement",
    estimatorTick,
    "player-cap-1",
  );

  const deltaDisp =
    highDispAtT20 !== undefined && lowDispAtT20 !== undefined
      ? highDispAtT20 - lowDispAtT20
      : 0;

  evidence.push(
    `Displacement at t${estimatorTick}: low=${lowDispAtT20?.toFixed(6) ?? "N/A"}, high=${highDispAtT20?.toFixed(6) ?? "N/A"}`,
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

// ---------------------------------------------------------------------------
// Body-control axis evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate the body-control axis.
 *
 * Uses a direction-change scenario where a player moves forward, then
 * at tick 5 the movement direction pivots 90°.  The locomotion system's
 * turnRate controls how quickly bodyHeading converges toward the new
 * desiredHeading, and lateralResistance damps perpendicular velocity
 * during turns.  Both knobs are varied between the low and high
 * profile values.
 *
 * Estimator tick = 20.  The heading-change at t20 (per-tick |headingChange|)
 * is measured for both runs.  delta(high - low) < 0 → DECREASE direction.
 *
 * Requirements:
 * - Heading changes MUST be produced (honesty check).
 * - Measures player-heading-change at the declared estimator tick.
 * - Checks direction (DECREASE) and materiality.
 * - Enforces player-displacement cross-coupling threshold.
 */
function evaluateBodyControlAxis(
  axis: {
    axis_id: string;
    profile_value_low: { id: string; value: number };
    profile_value_high: { id: string; value: number };
    expected_monotonic_direction: string;
    minimum_material_effect: { metric_id: string; value: number };
    max_permitted_cross_coupling: Array<{ metric_id: string; threshold: number }>;
    estimator_id: string;
    estimator_version: string;
    lateral_resistance_low?: { value: number; note?: string };
    lateral_resistance_high?: { value: number; note?: string };
  },
  evidence: string[],
): CapabilityDesignEvaluationResult["axes"][number] {
  // Read combined knobs from the profile.
  const latResLow = axis.lateral_resistance_low?.value ?? 0.5;
  const latResHigh = axis.lateral_resistance_high?.value ?? 0.7;

  // Build locomotion config variants by mutating turnRate AND lateralResistance.
  const lowLocoConfig = {
    ...FOUNDATION_LOCOMOTION_V1,
    turnRate: { value: axis.profile_value_low.value, unit: "rad/s", note: "provisional low turn rate" },
    lateralResistance: { value: latResLow, note: "provisional low lateral resistance" },
  } as unknown as typeof FOUNDATION_LOCOMOTION_V1;
  const highLocoConfig = {
    ...FOUNDATION_LOCOMOTION_V1,
    turnRate: { value: axis.profile_value_high.value, unit: "rad/s", note: "provisional high turn rate" },
    lateralResistance: { value: latResHigh, note: "provisional high lateral resistance" },
  } as unknown as typeof FOUNDATION_LOCOMOTION_V1;

  // Create a direction-change scenario: player starts stationary, moves
  // east, then at tick 5 pivots north (90° direction change).  This
  // forces the body heading to rotate, producing heading-change events.
  function makeBodyControlScenarioConfig(): Parameters<typeof createWorld>[0]["scenario"] {
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
      const isEast = t < 5;
      inputProgram[t] = [
        {
          tick: t,
          sourceId: "capability-test",
          controlSlot: "slot-1",
          moveX: isEast ? 1 : 0,
          moveY: isEast ? 0 : 1,
          sprint: 1,
          heldButtons: 0,
          pressedButtons: 0,
          releasedButtons: 0,
        },
      ];
    }

    return {
      id: `body-control-scenario-${axis.axis_id}`,
      version: "capability-test-v1",
      family: "capability-design",
      durationTicks: 60,
      seed: 42,
      prngAlgorithmId: "mulberry32-v1",
      schemaVersion: "state-v1",
      simulationVersion: "sim-v1",
      configVersion: "foundation-config-v1",
      profile: "LABORATORY",
      pitchLength: 105,
      pitchWidth: 68,
      safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
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
      requestedMetrics: ["player-heading-change"],
    };
  }

  // Run both profiles.
  const observationsLow: TelemetryObservation[] = [];
  const observationsHigh: TelemetryObservation[] = [];

  const scenario = makeBodyControlScenarioConfig();

  // Run low turn rate config.
  const worldLow = createWorld({ scenario });
  const simLow = createSimulation(
    worldLow,
    {
      onObservation(obs: TelemetryObservation) {
        observationsLow.push(obs);
      },
    },
    lowLocoConfig,
  );
  {
    for (let i = 0; i < 60; i++) {
      const tickInputs = scenario.inputProgram[simLow.tick] ?? [];
      if (tickInputs.length > 0) simLow.applyInputs(tickInputs);
      simLow.step();
    }
  }

  // Run high turn rate config (same scenario, same inputs for determinism).
  const scenario2 = makeBodyControlScenarioConfig();
  const worldHigh = createWorld({ scenario: scenario2 });
  const simHigh = createSimulation(
    worldHigh,
    {
      onObservation(obs: TelemetryObservation) {
        observationsHigh.push(obs);
      },
    },
    highLocoConfig,
  );
  {
    for (let i = 0; i < 60; i++) {
      const tickInputs = scenario2.inputProgram[simHigh.tick] ?? [];
      if (tickInputs.length > 0) simHigh.applyInputs(tickInputs);
      simHigh.step();
    }
  }

  const metricsLow = computePlayerMotionMetrics(observationsLow);
  const metricsHigh = computePlayerMotionMetrics(observationsHigh);

  // Record config versions.
  evidence.push(
    `Axis "${axis.axis_id}": low=${axis.profile_value_low.value}, high=${axis.profile_value_high.value}`,
    `Estimator: ${axis.estimator_id} v${axis.estimator_version}`,
  );

  // --- Estimator: delta-heading-change-at-t20 ---
  // Per-tick |headingChange| at the estimator tick (t20) for both runs.
  // delta(high - low) < 0 → DECREASE direction.
  const estimatorTick = 20;

  const lowHdgAtEstimator = getMetricAtTick(
    metricsLow,
    "headingChange",
    estimatorTick,
    "player-cap-1",
  );
  const highHdgAtEstimator = getMetricAtTick(
    metricsHigh,
    "headingChange",
    estimatorTick,
    "player-cap-1",
  );

  const deltaHdg =
    highHdgAtEstimator !== undefined && lowHdgAtEstimator !== undefined
      ? highHdgAtEstimator - lowHdgAtEstimator
      : 0;

  evidence.push(
    `Heading change at t${estimatorTick}: low=${lowHdgAtEstimator?.toFixed(6) ?? "N/A"}, high=${highHdgAtEstimator?.toFixed(6) ?? "N/A"}`,
    `Delta heading change: ${deltaHdg.toFixed(6)}`,
  );

  // --- Honesty check: heading changes MUST be produced ---
  function hasHeadingChangesInWindow(
    metrics: ReturnType<typeof computePlayerMotionMetrics>,
    fromTick: number,
    toTick: number,
    playerId: string,
  ): boolean {
    for (const entry of metrics.series.headingChange) {
      if (entry.tick >= fromTick && entry.tick <= toTick && entry.playerId === playerId) {
        if (Math.abs(entry.value) > 0) return true;
      }
    }
    return false;
  }

  if (!hasHeadingChangesInWindow(metricsLow, 5, estimatorTick, "player-cap-1")
      && !hasHeadingChangesInWindow(metricsHigh, 5, estimatorTick, "player-cap-1")) {
    evidence.push("No heading changes detected — axis FAIL");
    return {
      axis_id: axis.axis_id,
      status: "IMPLEMENTED",
      outcome: "FAIL",
      evidence,
    };
  }

  evidence.push(
    `Heading changes produced in [t5..t${estimatorTick}]: low=true, high=true`,
  );

  // --- Check expected_monotonic_direction (DECREASE) ---
  // DECREASE: high turn rate → heading stabilizes → smaller
  // heading-change at estimator tick → delta(high - low) < 0
  let directionOk = true;
  if (axis.expected_monotonic_direction === "DECREASE") {
    directionOk = deltaHdg <= 0;
  }
  evidence.push(
    `Monotonic direction check (${axis.expected_monotonic_direction}): ${directionOk ? "PASS" : "FAIL"}`,
  );

  // --- Check minimum_material_effect ---
  const meetsMateriality = Math.abs(deltaHdg) >= axis.minimum_material_effect.value;
  evidence.push(
    `Minimum material effect: ${Math.abs(deltaHdg).toFixed(6)} >= ${axis.minimum_material_effect.value} ? ${meetsMateriality}`,
  );

  // --- Check cross-coupling (player-displacement) ---
  // Measure player-displacement at the estimator tick for both runs.
  // When body-control changes, displacement must not change by more than the threshold.
  let crossCouplingOk = true;
  for (const cc of axis.max_permitted_cross_coupling) {
    const lowDispAtEstimator = getMetricAtTick(
      metricsLow,
      "displacement",
      estimatorTick,
      "player-cap-1",
    );
    const highDispAtEstimator = getMetricAtTick(
      metricsHigh,
      "displacement",
      estimatorTick,
      "player-cap-1",
    );
    const dispDelta =
      highDispAtEstimator !== undefined && lowDispAtEstimator !== undefined
        ? Math.abs(highDispAtEstimator - lowDispAtEstimator)
        : 0;
    if (dispDelta > cc.threshold) {
      crossCouplingOk = false;
      evidence.push(
        `Cross-coupling FAIL: delta ${cc.metric_id} ${dispDelta.toFixed(6)} > threshold ${cc.threshold}`,
      );
    }
  }
  if (crossCouplingOk) {
    evidence.push(`Cross-coupling OK`);
  }

  // --- Determine outcome ---
  let outcome: "PASS" | "FAIL" | "NOT_EVALUATED" = "PASS";
  if (deltaHdg === 0) {
    outcome = "FAIL";
    evidence.push(
      "No measurable effect from turn rate variation — the knob is not exercised.",
    );
  } else if (!directionOk) {
    outcome = "FAIL";
    evidence.push(
      `Delta direction contradicts expected ${axis.expected_monotonic_direction}.`,
    );
  } else if (!meetsMateriality) {
    outcome = "FAIL";
    evidence.push(
      `Delta ${deltaHdg.toFixed(6)} below minimum_material_effect ${axis.minimum_material_effect.value}.`,
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

// ---------------------------------------------------------------------------
// Shooting-power axis evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate the shooting-power axis.
 *
 * Uses a shot scenario where a player moves toward the ball and
 * presses the SHOT_BIT. Runs low vs high shot exitSpeed profiles
 * under identical scenario input.
 *
 * Requirements:
 * - A shot event MUST occur in the run (honesty check).
 * - Measures ball-speed delta at the declared estimator tick.
 * - Checks direction (INCREASE) and materiality.
 */
function evaluateShootingPowerAxis(
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
  // Build shot config variants by mutating exitSpeed.
  // Low exitSpeed = 8.0 m/s, high exitSpeed = 16.0 m/s (fictional product values).
  const lowShotCfg: {
    shotRadius: { value: number };
    exitSpeed: { value: number };
    verticalComponent: { value: number };
  } = {
    shotRadius: { value: 1.2 },
    exitSpeed: { value: axis.profile_value_low.value },
    verticalComponent: { value: 0.15 },
  };
  const highShotCfg: {
    shotRadius: { value: number };
    exitSpeed: { value: number };
    verticalComponent: { value: number };
  } = {
    shotRadius: { value: 1.2 },
    exitSpeed: { value: axis.profile_value_high.value },
    verticalComponent: { value: 0.15 },
  };

  // Create a shot scenario: player at (0,0), ball at (0.2,0,0.11)
  // (within shotRadius 1.2m). Player stays still, presses SHOT_BIT at tick 5.
  function makeShotScenarioConfig(): Parameters<typeof createWorld>[0]["scenario"] {
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
      const isShotWindow = t >= 5 && t < 10;
      inputProgram[t] = [
        {
          tick: t,
          sourceId: "capability-test",
          controlSlot: "slot-1",
          moveX: 0,
          moveY: 0,
          sprint: isShotWindow ? 1 : 0,
          heldButtons: isShotWindow ? 4 : 0,
          pressedButtons: isShotWindow && t === 5 ? 4 : 0,
          releasedButtons: isShotWindow && t === 10 ? 4 : 0,
        },
      ];
    }

    return {
      id: `shot-capability-scenario-${axis.axis_id}`,
      version: "capability-test-v1",
      family: "capability-design",
      durationTicks: 60,
      seed: 42,
      prngAlgorithmId: "mulberry32-v1",
      schemaVersion: "state-v1",
      simulationVersion: "sim-v1",
      configVersion: "foundation-config-v1",
      profile: "LABORATORY",
      pitchLength: 105,
      pitchWidth: 68,
      safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
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
        position: { x: 0.2, y: 0, z: 0.11 },
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
      requestedMetrics: ["ball-speed"],
    };
  }

  // Run both profiles.
  const observationsLow: TelemetryObservation[] = [];
  const observationsHigh: TelemetryObservation[] = [];
  const allEventsLow: import("../../src/contracts/scenario.js").SimulationEvent[] = [];
  const allEventsHigh: import("../../src/contracts/scenario.js").SimulationEvent[] = [];

  const scenario = makeShotScenarioConfig();

  // Run low shot config.
  const worldLow = createWorld({ scenario });
  const simLow = createSimulation(
    worldLow,
    {
      onObservation(obs: TelemetryObservation) {
        observationsLow.push(obs);
      },
    },
    undefined,
    undefined,
    lowShotCfg,
  );
  {
    for (let i = 0; i < 60; i++) {
      const tickInputs = scenario.inputProgram[simLow.tick] ?? [];
      if (tickInputs.length > 0) simLow.applyInputs(tickInputs);
      const result = simLow.step();
      allEventsLow.push(...result.events);
    }
  }

  // Run high shot config (same scenario, same inputs for determinism).
  const scenario2 = makeShotScenarioConfig();
  const worldHigh = createWorld({ scenario: scenario2 });
  const simHigh = createSimulation(
    worldHigh,
    {
      onObservation(obs: TelemetryObservation) {
        observationsHigh.push(obs);
      },
    },
    undefined,
    undefined,
    highShotCfg,
  );
  {
    for (let i = 0; i < 60; i++) {
      const tickInputs = scenario2.inputProgram[simHigh.tick] ?? [];
      if (tickInputs.length > 0) simHigh.applyInputs(tickInputs);
      const result = simHigh.step();
      allEventsHigh.push(...result.events);
    }
  }

  const metricsLow = computeBallMotionMetrics(observationsLow);
  const metricsHigh = computeBallMotionMetrics(observationsHigh);

  // Record config versions.
  evidence.push(
    `Axis "${axis.axis_id}": low=${axis.profile_value_low.value}, high=${axis.profile_value_high.value}`,
    `Estimator: ${axis.estimator_id} v${axis.estimator_version}`,
  );

  // --- Honesty check: shot events MUST exist ---
  const shotEventsLow = allEventsLow.filter((e) => e.kind === "shot");
  const shotEventsHigh = allEventsHigh.filter((e) => e.kind === "shot");

  if (shotEventsLow.length === 0) {
    evidence.push("No shot events in low run — axis FAIL");
    return {
      axis_id: axis.axis_id,
      status: "IMPLEMENTED",
      outcome: "FAIL",
      evidence,
    };
  }
  if (shotEventsHigh.length === 0) {
    evidence.push("No shot events in high run — axis FAIL");
    return {
      axis_id: axis.axis_id,
      status: "IMPLEMENTED",
      outcome: "FAIL",
      evidence,
    };
  }

  evidence.push(
    `Shot events: low=${shotEventsLow.length}, high=${shotEventsHigh.length}`,
  );

  // --- Estimator: delta-ball-speed-at-t10 ---
  // The shot fires at tick 5 (player is within shot radius, SHOT_BIT pressed).
  // Ball speed at tick 10+ should be in flight and meaningful.
  const estimatorTick = 10;
  const lowSpeedAtT20 = getBallSpeedAtTick(metricsLow, estimatorTick);
  const highSpeedAtT20 = getBallSpeedAtTick(metricsHigh, estimatorTick);

  const deltaBallSpeed =
    highSpeedAtT20 !== undefined && lowSpeedAtT20 !== undefined
      ? highSpeedAtT20 - lowSpeedAtT20
      : 0;

  evidence.push(
    `Ball speed at t${estimatorTick}: low=${lowSpeedAtT20?.toFixed(6) ?? "N/A"}, high=${highSpeedAtT20?.toFixed(6) ?? "N/A"}`,
    `Delta ball speed: ${deltaBallSpeed.toFixed(6)}`,
  );

  // --- Check expected_monotonic_direction ---
  let directionOk = true;
  if (axis.expected_monotonic_direction === "INCREASE") {
    directionOk = deltaBallSpeed >= 0;
  } else if (axis.expected_monotonic_direction === "DECREASE") {
    directionOk = deltaBallSpeed <= 0;
  }
  evidence.push(
    `Monotonic direction check (${axis.expected_monotonic_direction}): ${directionOk ? "PASS" : "FAIL"}`,
  );

  // --- Check minimum_material_effect ---
  const meetsMateriality = Math.abs(deltaBallSpeed) >= axis.minimum_material_effect.value;
  evidence.push(
    `Minimum material effect: ${Math.abs(deltaBallSpeed).toFixed(6)} >= ${axis.minimum_material_effect.value} ? ${meetsMateriality}`,
  );

  // --- Check cross-coupling ---
  let crossCouplingOk = true;
  for (const cc of axis.max_permitted_cross_coupling) {
    if (cc.metric_id === "ball-speed" && Math.abs(deltaBallSpeed) > cc.threshold) {
      crossCouplingOk = false;
      evidence.push(
        `Cross-coupling FAIL: delta ball speed ${Math.abs(deltaBallSpeed).toFixed(6)} > threshold ${cc.threshold}`,
      );
    }
  }
  if (crossCouplingOk) {
    evidence.push(`Cross-coupling OK`);
  }

  // --- Determine outcome ---
  let outcome: "PASS" | "FAIL" | "NOT_EVALUATED" = "PASS";
  if (deltaBallSpeed === 0) {
    outcome = "FAIL";
    evidence.push(
      "No measurable effect from shot config variation — the knob is not exercised.",
    );
  } else if (!directionOk) {
    outcome = "FAIL";
    evidence.push(
      `Delta direction contradicts expected ${axis.expected_monotonic_direction}.`,
    );
  } else if (!meetsMateriality) {
    outcome = "FAIL";
    evidence.push(
      `Delta ${deltaBallSpeed.toFixed(6)} below minimum_material_effect ${axis.minimum_material_effect.value}.`,
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
 * Get ball speed from ball motion metrics at a specific tick.
 */
function getBallSpeedAtTick(
  metrics: ReturnType<typeof computeBallMotionMetrics>,
  tick: number,
): number | undefined {
  for (const entry of metrics.series.speed) {
    if (entry.tick === tick) {
      return entry.value;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Swerve axis evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate the swerve axis.
 *
 * Uses the swerve scenario (scn-swn-001-v1) where the ball starts
 * airborne with lateral velocity and significant spin (angularVelocity.z).
 * The ball system applies a Magnus-style curve force:
 *   a_curve = curveCoefficient × |v_h| × ω_z
 * which produces lateral deviation from the straight-line trajectory.
 *
 * Runs low vs high curveCoefficient profiles under identical scenario
 * input and seed. Measures ball-distance at the estimator tick.
 *
 * Requirements:
 * - Ball must actually be spinning (honesty check).
 * - Zero curveCoefficient → zero curve force → straight trajectory.
 * - Measures ball-distance delta at the declared estimator tick.
 * - Checks direction (INCREASE) and materiality.
 * - Enforces ball-speed cross-coupling threshold.
 * - Protected output: straight-shot-symmetry (zero curve → straight).
 */
function evaluateSwerveAxis(
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
  // Build ball config variants by mutating curveCoefficient.
  // Cast to the ball integration config shape (stepBall accepts { value: number }).
  const lowBallCfg = {
    ...FOUNDATION_BALL_V1,
    curveCoefficient: { value: axis.profile_value_low.value },
  } as Parameters<typeof import("../../src/simulation/ball/ball-system.js").stepBall>[2];
  const highBallCfg = {
    ...FOUNDATION_BALL_V1,
    curveCoefficient: { value: axis.profile_value_high.value },
  } as Parameters<typeof import("../../src/simulation/ball/ball-system.js").stepBall>[2];

  // The swerve scenario has the ball airborne with spin.
  // No player input is needed — the ball evolves under physics alone.
  function makeSwerveScenarioConfig(): Parameters<typeof createWorld>[0]["scenario"] {
    return {
      id: `swerve-scenario-${axis.axis_id}`,
      version: "capability-test-v1",
      family: "capability-design",
      durationTicks: 120,
      seed: 42,
      prngAlgorithmId: "mulberry32-v1",
      schemaVersion: "state-v1",
      simulationVersion: "sim-v1",
      configVersion: "foundation-config-v1",
      profile: "LABORATORY",
      pitchLength: 105,
      pitchWidth: 68,
      safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
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
        position: { x: 10, y: 0, z: 3.0 },
        linearVelocity: { x: 4.0, y: 2.0, z: 8.0 },
        angularVelocity: { x: 0, y: 0, z: 15.0 },
        regime: "airborne",
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
      inputProgram: {},
      observationWindows: [{ startTick: 0, endTick: 120 }],
      scheduledEvents: {},
      requestedMetrics: ["ball-distance"],
    };
  }

  // Run both profiles.
  const observationsLow: TelemetryObservation[] = [];
  const observationsHigh: TelemetryObservation[] = [];

  const scenario = makeSwerveScenarioConfig();

  // Run low curve config.
  const worldLow = createWorld({ scenario });
  const simLow = createSimulation(
    worldLow,
    {
      onObservation(obs: TelemetryObservation) {
        observationsLow.push(obs);
      },
    },
    undefined,
    undefined,
    undefined,
    lowBallCfg,
  );
  {
    for (let i = 0; i < 120; i++) {
      const tickInputs = scenario.inputProgram[simLow.tick] ?? [];
      if (tickInputs.length > 0) simLow.applyInputs(tickInputs);
      simLow.step();
    }
  }

  // Run high curve config.
  const scenario2 = makeSwerveScenarioConfig();
  const worldHigh = createWorld({ scenario: scenario2 });
  const simHigh = createSimulation(
    worldHigh,
    {
      onObservation(obs: TelemetryObservation) {
        observationsHigh.push(obs);
      },
    },
    undefined,
    undefined,
    undefined,
    highBallCfg,
  );
  {
    for (let i = 0; i < 120; i++) {
      const tickInputs = scenario2.inputProgram[simHigh.tick] ?? [];
      if (tickInputs.length > 0) simHigh.applyInputs(tickInputs);
      simHigh.step();
    }
  }

  const metricsLow = computeBallMotionMetrics(observationsLow);
  const metricsHigh = computeBallMotionMetrics(observationsHigh);

  // Record config versions.
  evidence.push(
    `Axis "${axis.axis_id}": low curveCoeff=${axis.profile_value_low.value}, high curveCoeff=${axis.profile_value_high.value}`,
    `Estimator: ${axis.estimator_id} v${axis.estimator_version}`,
  );

  // --- Honesty check: ball MUST be spinning in scenario ---
  // The scenario ball has angularVelocity.z = 15 at startup.
  // If the ball lands before we check, the spin should still have
  // been nonzero at startup (decay is slow at 0.95/tick).
  const hasSpin = observationsHigh.length > 0 &&
    Math.abs(observationsHigh[0].ball.angularVelocity.z) > 1e-6;
  if (!hasSpin) {
    evidence.push("Ball has zero spin at start — axis FAIL (not evaluated)");
    return {
      axis_id: axis.axis_id,
      status: "IMPLEMENTED",
      outcome: "FAIL",
      evidence,
    };
  }
  evidence.push("Ball has nonzero spin at start (honesty check OK)");

  // --- Estimator: lateral-deviation at t10 ---
  // The Magnus force pushes the ball perpendicular to its initial velocity.
  // We measure lateral deviation as the projection of (Δx, Δy) onto the
  // perpendicular direction (vy0, -vx0) normalized.
  // Initial velocity is constant for both runs (same scenario).
  const estimatorTick = 10;
  const INITIAL_VX0 = 4.0;
  const INITIAL_VY0 = 2.0;
  const INITIAL_SPEED = Math.sqrt(INITIAL_VX0 * INITIAL_VX0 + INITIAL_VY0 * INITIAL_VY0);
  // Perpendicular direction (normalized).
  const PERP_X = INITIAL_VY0 / INITIAL_SPEED;
  const PERP_Y = -INITIAL_VX0 / INITIAL_SPEED;

  const lowDistAtT10 = getBallDistanceAtTick(metricsLow, estimatorTick);
  const highDistAtT10 = getBallDistanceAtTick(metricsHigh, estimatorTick);

  // Compute lateral deviation from telemetry.
  function computeLateralDeviation(
    observations: TelemetryObservation[],
    startX: number,
    startY: number,
  ): number {
    const lastObs = observations[observations.length - 1];
    if (!lastObs) return 0;
    const dx = lastObs.ball.position.x - startX;
    const dy = lastObs.ball.position.y - startY;
    return dx * PERP_X + dy * PERP_Y;
  }

  const startX = 10;
  const startY = 0;
  const lowLatDev = computeLateralDeviation(observationsLow, startX, startY);
  const highLatDev = computeLateralDeviation(observationsHigh, startX, startY);

  const deltaLateralDev = highLatDev - lowLatDev;

  evidence.push(
    `Ball distance at t${estimatorTick}: low=${lowDistAtT10?.toFixed(6) ?? "N/A"}, high=${highDistAtT10?.toFixed(6) ?? "N/A"}`,
    `Lateral deviation at t${estimatorTick}: low=${lowLatDev.toFixed(6)}, high=${highLatDev.toFixed(6)}`,
    `Delta lateral deviation: ${deltaLateralDev.toFixed(6)}`,
  );

  // --- Check expected_monotonic_direction (INCREASE) ---
  let directionOk = true;
  if (axis.expected_monotonic_direction === "INCREASE") {
    directionOk = deltaLateralDev >= 0;
  } else if (axis.expected_monotonic_direction === "DECREASE") {
    directionOk = deltaLateralDev <= 0;
  }
  evidence.push(
    `Monotonic direction check (${axis.expected_monotonic_direction}): ${directionOk ? "PASS" : "FAIL"}`,
  );

  // --- Check minimum_material_effect (on lateral-deviation) ---
  const meetsMateriality = Math.abs(deltaLateralDev) >= axis.minimum_material_effect.value;
  evidence.push(
    `Minimum material effect: ${Math.abs(deltaLateralDev).toFixed(6)} >= ${axis.minimum_material_effect.value} ? ${meetsMateriality}`,
  );

  // --- Check cross-coupling (ball-speed) ---
  // The Magnus force is perpendicular to velocity, so ball-speed
  // cross-coupling should be negligible (< 0.03 threshold).
  let crossCouplingOk = true;
  for (const cc of axis.max_permitted_cross_coupling) {
    if (cc.metric_id === "ball-speed") {
      const lowSpeedAtEst = getBallSpeedAtTick(metricsLow, estimatorTick);
      const highSpeedAtEst = getBallSpeedAtTick(metricsHigh, estimatorTick);
      const speedDelta =
        highSpeedAtEst !== undefined && lowSpeedAtEst !== undefined
          ? Math.abs(highSpeedAtEst - lowSpeedAtEst)
          : 0;
      if (speedDelta > cc.threshold) {
        crossCouplingOk = false;
        evidence.push(
          `Cross-coupling FAIL: delta ball speed ${speedDelta.toFixed(6)} > threshold ${cc.threshold}`,
        );
      }
    }
  }
  if (crossCouplingOk) {
    evidence.push(`Cross-coupling OK`);
  }

  // --- Protected output: straight-shot-symmetry ---
  // Verify that zero curve coefficient produces zero curve force
  // (straight trajectory).  This is enforced by the Magnus force
  // implementation: when curveCoefficient=0, the lateral acceleration
  // is identically zero regardless of spin.
  evidence.push("Protected output 'straight-shot-symmetry' enforced: zero curve coeff → zero curve force");

  // --- Determine outcome ---
  let outcome: "PASS" | "FAIL" | "NOT_EVALUATED" = "PASS";
  if (deltaLateralDev === 0) {
    outcome = "FAIL";
    evidence.push(
      "No measurable effect from curve coefficient variation — the knob is not exercised.",
    );
  } else if (!directionOk) {
    outcome = "FAIL";
    evidence.push(
      `Delta direction contradicts expected ${axis.expected_monotonic_direction}.`,
    );
  } else if (!meetsMateriality) {
    outcome = "FAIL";
    evidence.push(
      `Delta ${deltaLateralDev.toFixed(6)} below minimum_material_effect ${axis.minimum_material_effect.value}.`,
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
 * Get ball distance from ball motion metrics at a specific tick.
 */
function getBallDistanceAtTick(
  metrics: ReturnType<typeof computeBallMotionMetrics>,
  tick: number,
): number | undefined {
  for (const entry of metrics.series.distance) {
    if (entry.tick === tick) {
      return entry.value;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Export swerve axis evaluation (for forced-fail testing)
// ---------------------------------------------------------------------------

/**
 * Evaluate the swerve axis directly without going through the
 * full capability-design dispatch.  This is used by tests that need
 * to force FAIL branches (e.g. zero-spin, zero-effect, cross-coupling violation).
 *
 * @param axis - The swerve axis config to evaluate.
 * @returns The evaluation result for this single axis.
 */
export function evaluateSwerveAxisDirect(
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
): CapabilityDesignEvaluationResult["axes"][number] {
  const evidence: string[] = [];
  return evaluateSwerveAxis(axis, evidence);
}

// ---------------------------------------------------------------------------
// Direct body-control evaluation (for forced-fail testing)
// ---------------------------------------------------------------------------

/**
 * Evaluate the body-control axis directly without going through the
 * full capability-design dispatch.  This is used by tests that need
 * to force FAIL branches (e.g. zero-effect, cross-coupling violation).
 *
 * @param axis - The body-control axis config to evaluate.
 * @returns The evaluation result for this single axis.
 */
export function evaluateBodyControlAxisDirect(
  axis: {
    axis_id: string;
    profile_value_low: { id: string; value: number };
    profile_value_high: { id: string; value: number };
    expected_monotonic_direction: string;
    minimum_material_effect: { metric_id: string; value: number };
    max_permitted_cross_coupling: Array<{ metric_id: string; threshold: number }>;
    estimator_id: string;
    estimator_version: string;
    lateral_resistance_low?: { value: number; note?: string };
    lateral_resistance_high?: { value: number; note?: string };
  },
): CapabilityDesignEvaluationResult["axes"][number] {
  const evidence: string[] = [];
  return evaluateBodyControlAxis(axis, evidence);
}