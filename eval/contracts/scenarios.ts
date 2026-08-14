/**
 * @module @pes/eval/contracts/scenarios
 *
 * ScenarioDefinition stubs for the test catalog.
 *
 * Each test in the fast / locomotion / ball suites gets its own
 * scenario stub with the same simulation config as the bootstrap
 * but a distinct scenario_id and controlled input profile.
 *
 * Initial state is a single player and one ball, matching the
 * bootstrap-scenario shape but versioned per test catalog entry.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { ScenarioDefinition } from "./types.js";

/**
 * Create a minimal scenario stub for a test catalog entry.
 */
function makeScenarioStub(
  scenarioId: string,
  durationTicks: number,
  capabilityRequirements: string[],
  seedPolicy: { kind: "FIXED"; values_or_set_id: string },
  configRefs: Record<string, string> = {},
): ScenarioDefinition {
  return {
    scenario_id: scenarioId,
    scenario_version: "scenario-v1",
    capability_requirements: capabilityRequirements,
    duration_ticks: durationTicks,
    seed_policy: seedPolicy,
    initial_state_schema: "state-v1",
    initial_state: {
      players: [
        {
          playerId: "player-1",
          teamId: "team-A",
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
    },
    config_refs: {
      foundation: "foundation-locomotion-v1",
      ...configRefs,
    },
    input_program: {
      schema_id: "input-frame-v1",
      schema_version: "schema-input-v1",
      value: {},
    },
    scheduled_events: [],
    observation_windows: [
      {
        window_id: "full-run-v1",
        start: { kind: "ABSOLUTE_TICK", tick: 0, offset_ticks: 0, missing_boundary_behavior: "INVALID_RUN" },
        end: { kind: "SCENARIO_END", offset_ticks: 0, missing_boundary_behavior: "INVALID_RUN" },
        boundary_inclusion: "CLOSED",
        discontinuity_policy: "OBSERVE",
      },
    ],
    requested_observation_ids: ["obs-per-tick-v1"],
  };
}

// ---------------------------------------------------------------------------
// fast suite scenarios
// ---------------------------------------------------------------------------

export const SCENARIO_BALL_IND_001 = makeScenarioStub(
  "scn-ball-ind-001-v1",
  60,
  ["INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-smoke-v1" },
  { test_focus: "ball-independence" },
);

export const SCENARIO_LOC_ACC_001 = makeScenarioStub(
  "scn-loc-acc-001-v1",
  120,
  ["LOCOMOTION"],
  { kind: "FIXED", values_or_set_id: "seeds-smoke-v1" },
  { test_focus: "acceleration" },
);

export const SCENARIO_BALL_GND_001 = makeScenarioStub(
  "scn-ball-gnd-001-v1",
  120,
  ["INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-smoke-v1" },
  { test_focus: "ground-ball-decay" },
);

// ---------------------------------------------------------------------------
// locomotion suite scenarios (additional IDs not covered by fast)
// ---------------------------------------------------------------------------

export const SCENARIO_LOC_ACC_002 = makeScenarioStub(
  "scn-loc-acc-002-v1",
  120,
  ["LOCOMOTION"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "transient-acceleration" },
);

export const SCENARIO_LOC_MAX_001 = makeScenarioStub(
  "scn-loc-max-001-v1",
  300,
  ["LOCOMOTION"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "max-speed-plateau" },
);

export const SCENARIO_LOC_DEC_001 = makeScenarioStub(
  "scn-loc-dec-001-v1",
  120,
  ["LOCOMOTION"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "deceleration" },
);

export const SCENARIO_LOC_REV_001 = makeScenarioStub(
  "scn-loc-rev-001-v1",
  120,
  ["LOCOMOTION"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "reversal" },
);

export const SCENARIO_LOC_T45_001 = makeScenarioStub(
  "scn-loc-t45-001-v1",
  120,
  ["LOCOMOTION"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "45-degree-turn" },
);

export const SCENARIO_LOC_T90_001 = makeScenarioStub(
  "scn-loc-t90-001-v1",
  120,
  ["LOCOMOTION"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "90-degree-turn" },
);

export const SCENARIO_LOC_ORI_001 = makeScenarioStub(
  "scn-loc-ori-001-v1",
  120,
  ["LOCOMOTION"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "orientation" },
);

export const SCENARIO_LOC_BALL_001 = makeScenarioStub(
  "scn-loc-ball-001-v1",
  120,
  ["LOCOMOTION", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "on-ball-locomotion" },
);

export const SCENARIO_CTRL_LAT_001 = makeScenarioStub(
  "scn-ctrl-lat-001-v1",
  120,
  ["LOCOMOTION"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "input-latency" },
);

// ---------------------------------------------------------------------------
// ball suite scenarios (additional IDs not covered by fast)
// ---------------------------------------------------------------------------

export const SCENARIO_BALL_GND_002 = makeScenarioStub(
  "scn-ball-gnd-002-v1",
  120,
  ["INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "speed-dependent-decay" },
);

export const SCENARIO_BALL_BNC_001 = makeScenarioStub(
  "scn-ball-bnc-001-v1",
  60,
  ["INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "bounce" },
);

export const SCENARIO_BALL_SPN_001 = makeScenarioStub(
  "scn-ball-spn-001-v1",
  120,
  ["INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "spin-curve" },
);

export const SCENARIO_BALL_SPN_002 = makeScenarioStub(
  "scn-ball-spn-002-v1",
  120,
  ["INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "spin-curve-power" },
);

/** All registered scenario stubs keyed by scenario_id. */
export const SCENARIO_REGISTRY: Record<string, ScenarioDefinition> = {
  [SCENARIO_BALL_IND_001.scenario_id]: SCENARIO_BALL_IND_001,
  [SCENARIO_LOC_ACC_001.scenario_id]: SCENARIO_LOC_ACC_001,
  [SCENARIO_BALL_GND_001.scenario_id]: SCENARIO_BALL_GND_001,
  [SCENARIO_LOC_ACC_002.scenario_id]: SCENARIO_LOC_ACC_002,
  [SCENARIO_LOC_MAX_001.scenario_id]: SCENARIO_LOC_MAX_001,
  [SCENARIO_LOC_DEC_001.scenario_id]: SCENARIO_LOC_DEC_001,
  [SCENARIO_LOC_REV_001.scenario_id]: SCENARIO_LOC_REV_001,
  [SCENARIO_LOC_T45_001.scenario_id]: SCENARIO_LOC_T45_001,
  [SCENARIO_LOC_T90_001.scenario_id]: SCENARIO_LOC_T90_001,
  [SCENARIO_LOC_ORI_001.scenario_id]: SCENARIO_LOC_ORI_001,
  [SCENARIO_LOC_BALL_001.scenario_id]: SCENARIO_LOC_BALL_001,
  [SCENARIO_CTRL_LAT_001.scenario_id]: SCENARIO_CTRL_LAT_001,
  [SCENARIO_BALL_GND_002.scenario_id]: SCENARIO_BALL_GND_002,
  [SCENARIO_BALL_BNC_001.scenario_id]: SCENARIO_BALL_BNC_001,
  [SCENARIO_BALL_SPN_001.scenario_id]: SCENARIO_BALL_SPN_001,
  [SCENARIO_BALL_SPN_002.scenario_id]: SCENARIO_BALL_SPN_002,
};

/**
 * Get a scenario definition by scenario_id.
 */
export function getScenario(scenarioId: string): ScenarioDefinition | undefined {
  return SCENARIO_REGISTRY[scenarioId];
}