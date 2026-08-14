/**
 * @module @pes/eval/contracts/metric-definitions
 *
 * MetricDefinition registry entries.
 *
 * Covers existing estimator-backed metrics (player-speed,
 * player-displacement, ball-speed, ball-distance, ball-height,
 * ball-contact) and catalog-only metrics that have no estimator yet
 * (t25, t50, t90, stopping-distance, t-stop, etc.).
 *
 * Catalog metrics without an estimator register with an empty
 * estimator_id and estimator_version "absent" so that loading a
 * required MEASURED_TARGET criterion referencing them is detected.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { MetricDefinition } from "./types.js";

// ---------------------------------------------------------------------------
// Estimator-backed metrics (implementation present in eval/metrics/*.ts)
// ---------------------------------------------------------------------------

export const METRIC_PLAYER_SPEED: MetricDefinition = {
  metric_id: "player-speed",
  metric_version: "metric-player-speed-v1",
  input_observation_ids: ["obs-per-tick-v1"],
  units: "m/s",
  estimator_id: "player-speed-estimator-v1",
  estimator_version: "estimator-player-speed-v1",
  filters: [],
  window_ids: [],
  boundary_policy_id: "boundary-default-v1",
  boundary_policy_version: "boundary-policy-v1",
  invalid_data_behavior: "NOT_EVALUATED",
  output_schema_id: "metric-series-v1",
  output_schema_version: "schema-metric-series-v1",
};

export const METRIC_PLAYER_DISPLACEMENT: MetricDefinition = {
  metric_id: "player-displacement",
  metric_version: "metric-player-displacement-v1",
  input_observation_ids: ["obs-per-tick-v1"],
  units: "m",
  estimator_id: "player-displacement-estimator-v1",
  estimator_version: "estimator-player-displacement-v1",
  filters: [],
  window_ids: [],
  boundary_policy_id: "boundary-default-v1",
  boundary_policy_version: "boundary-policy-v1",
  invalid_data_behavior: "NOT_EVALUATED",
  output_schema_id: "metric-series-v1",
  output_schema_version: "schema-metric-series-v1",
};

export const METRIC_BALL_SPEED: MetricDefinition = {
  metric_id: "ball-speed",
  metric_version: "metric-ball-speed-v1",
  input_observation_ids: ["obs-per-tick-v1"],
  units: "m/s",
  estimator_id: "ball-speed-estimator-v1",
  estimator_version: "estimator-ball-speed-v1",
  filters: [],
  window_ids: [],
  boundary_policy_id: "boundary-default-v1",
  boundary_policy_version: "boundary-policy-v1",
  invalid_data_behavior: "NOT_EVALUATED",
  output_schema_id: "metric-series-v1",
  output_schema_version: "schema-metric-series-v1",
};

export const METRIC_BALL_DISTANCE: MetricDefinition = {
  metric_id: "ball-distance",
  metric_version: "metric-ball-distance-v1",
  input_observation_ids: ["obs-per-tick-v1"],
  units: "m",
  estimator_id: "ball-distance-estimator-v1",
  estimator_version: "estimator-ball-distance-v1",
  filters: [],
  window_ids: [],
  boundary_policy_id: "boundary-default-v1",
  boundary_policy_version: "boundary-policy-v1",
  invalid_data_behavior: "NOT_EVALUATED",
  output_schema_id: "metric-series-v1",
  output_schema_version: "schema-metric-series-v1",
};

export const METRIC_BALL_HEIGHT: MetricDefinition = {
  metric_id: "ball-height",
  metric_version: "metric-ball-height-v1",
  input_observation_ids: ["obs-per-tick-v1"],
  units: "m",
  estimator_id: "ball-height-estimator-v1",
  estimator_version: "estimator-ball-height-v1",
  filters: [],
  window_ids: [],
  boundary_policy_id: "boundary-default-v1",
  boundary_policy_version: "boundary-policy-v1",
  invalid_data_behavior: "NOT_EVALUATED",
  output_schema_id: "metric-series-v1",
  output_schema_version: "schema-metric-series-v1",
};

export const METRIC_BALL_CONTACT: MetricDefinition = {
  metric_id: "ball-contact",
  metric_version: "metric-ball-contact-v1",
  input_observation_ids: ["obs-per-tick-v1"],
  units: "count",
  estimator_id: "ball-contact-estimator-v1",
  estimator_version: "estimator-ball-contact-v1",
  filters: [],
  window_ids: [],
  boundary_policy_id: "boundary-default-v1",
  boundary_policy_version: "boundary-policy-v1",
  invalid_data_behavior: "NOT_EVALUATED",
  output_schema_id: "metric-series-v1",
  output_schema_version: "schema-metric-series-v1",
};

// ---------------------------------------------------------------------------
// Catalog-only metrics (no estimator yet — absent placeholder)
// ---------------------------------------------------------------------------

function makeCatalogMetric(
  id: string,
  units: string,
  inputObs: string[],
  windowIds: string[] = [],
): MetricDefinition {
  return {
    metric_id: id,
    metric_version: `${id}-v1`,
    input_observation_ids: inputObs,
    units,
    estimator_id: "absent",
    estimator_version: "absent",
    filters: [],
    window_ids: windowIds,
    boundary_policy_id: "boundary-default-v1",
    boundary_policy_version: "boundary-policy-v1",
    invalid_data_behavior: "NOT_EVALUATED",
    output_schema_id: "metric-series-v1",
    output_schema_version: "schema-metric-series-v1",
  };
}

/** Time-to-25%-plateau metric (from acceleration test catalog). */
export const METRIC_T25 = makeCatalogMetric(
  "t25",
  "ticks",
  ["obs-per-tick-v1"],
);

/** Time-to-50%-plateau metric (from acceleration test catalog). */
export const METRIC_T50 = makeCatalogMetric(
  "t50",
  "ticks",
  ["obs-per-tick-v1"],
);

/** Time-to-90%-plateau metric (from acceleration test catalog). */
export const METRIC_T90 = makeCatalogMetric(
  "t90",
  "ticks",
  ["obs-per-tick-v1"],
);

/** Stopping distance metric (from deceleration test catalog). */
export const METRIC_STOPPING_DISTANCE = makeCatalogMetric(
  "stopping-distance",
  "m",
  ["obs-per-tick-v1"],
);

/** t_stop metric (from deceleration test catalog). */
export const METRIC_T_STOP = makeCatalogMetric(
  "t_stop",
  "ticks",
  ["obs-per-tick-v1"],
);

/** Peak deceleration metric (from deceleration test catalog). */
export const METRIC_PEAK_DECELERATION = makeCatalogMetric(
  "peak-deceleration",
  "m/s²",
  ["obs-per-tick-v1"],
);

/** Turn duration metric (from turning test catalog). */
export const METRIC_TURN_DURATION = makeCatalogMetric(
  "turn-duration",
  "ticks",
  ["obs-per-tick-v1"],
);

/** Minimum speed during a turn. */
export const METRIC_MIN_TURN_SPEED = makeCatalogMetric(
  "min-turn-speed",
  "m/s",
  ["obs-per-tick-v1"],
);

/** All registered metric definitions keyed by metric_id. */
export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  [METRIC_PLAYER_SPEED.metric_id]: METRIC_PLAYER_SPEED,
  [METRIC_PLAYER_DISPLACEMENT.metric_id]: METRIC_PLAYER_DISPLACEMENT,
  [METRIC_BALL_SPEED.metric_id]: METRIC_BALL_SPEED,
  [METRIC_BALL_DISTANCE.metric_id]: METRIC_BALL_DISTANCE,
  [METRIC_BALL_HEIGHT.metric_id]: METRIC_BALL_HEIGHT,
  [METRIC_BALL_CONTACT.metric_id]: METRIC_BALL_CONTACT,
  [METRIC_T25.metric_id]: METRIC_T25,
  [METRIC_T50.metric_id]: METRIC_T50,
  [METRIC_T90.metric_id]: METRIC_T90,
  [METRIC_STOPPING_DISTANCE.metric_id]: METRIC_STOPPING_DISTANCE,
  [METRIC_T_STOP.metric_id]: METRIC_T_STOP,
  [METRIC_PEAK_DECELERATION.metric_id]: METRIC_PEAK_DECELERATION,
  [METRIC_TURN_DURATION.metric_id]: METRIC_TURN_DURATION,
  [METRIC_MIN_TURN_SPEED.metric_id]: METRIC_MIN_TURN_SPEED,
};

/**
 * Get a metric definition by metric_id.
 */
export function getMetricDefinition(
  id: string,
): MetricDefinition | undefined {
  return METRIC_DEFINITIONS[id];
}

/**
 * Check if a metric has an implementation (estimator is present).
 * Returns true only if the estimator is not "absent".
 */
export function hasMetricEstimator(metricDef: MetricDefinition): boolean {
  return (
    metricDef.estimator_id !== "absent" &&
    metricDef.estimator_version !== "absent"
  );
}