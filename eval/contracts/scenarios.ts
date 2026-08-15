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
 *
 * @param scenarioId - Unique scenario identifier.
 * @param durationTicks - Number of simulation ticks.
 * @param capabilityRequirements - Required capability flags.
 * @param seedPolicy - PRNG seed configuration.
 * @param configRefs - Additional config references.
 * @param inputProgram - Optional tick-indexed input program. When omitted,
 *   the scenario has an empty input program (static ball).
 */
function makeScenarioStub(
  scenarioId: string,
  durationTicks: number,
  capabilityRequirements: string[],
  seedPolicy: { kind: "FIXED"; values_or_set_id: string },
  configRefs: Record<string, string> = {},
  inputProgram?: Record<
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
  >,
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
    input_program: inputProgram
      ? {
          schema_id: "input-frame-v1",
          schema_version: "schema-input-v1",
          value: inputProgram,
        }
      : {
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

// ---------------------------------------------------------------------------
// touch_and_actions suite scenarios
// ---------------------------------------------------------------------------

/**
 * Generate a tick-indexed input program for a first-touch reception.
 * Player moves toward the ball (position ~10m away), holds FIRST_TOUCH
 * bit for a few ticks to initiate contact.
 */
function makeTouchInputProgram(durationTicks: number): Record<number, { tick: number; sourceId: string; controlSlot: string; moveX: number; moveY: number; sprint: number; heldButtons: number; pressedButtons: number; releasedButtons: number }[]> {
  const program: Record<number, { tick: number; sourceId: string; controlSlot: string; moveX: number; moveY: number; sprint: number; heldButtons: number; pressedButtons: number; releasedButtons: number }[]> = {};
  for (let t = 0; t < durationTicks; t++) {
    const isContactWindow = t >= 10 && t < 20;
    program[t] = [
      {
        tick: t,
        sourceId: "eval-input",
        controlSlot: "slot-1",
        moveX: t < 10 ? 0.5 : 0,
        moveY: 0,
        sprint: 0,
        heldButtons: isContactWindow ? 1 : 0, // FIRST_TOUCH_BIT
        pressedButtons: isContactWindow && t === 10 ? 1 : 0,
        releasedButtons: isContactWindow && t === 20 ? 1 : 0,
      },
    ];
  }
  return program;
}

/**
 * Generate a tick-indexed input program for a low pass.
 * Player moves toward ball, holds PASS bit to initiate pass, then releases.
 */
function makePassInputProgram(durationTicks: number): Record<number, { tick: number; sourceId: string; controlSlot: string; moveX: number; moveY: number; sprint: number; heldButtons: number; pressedButtons: number; releasedButtons: number }[]> {
  const program: Record<number, { tick: number; sourceId: string; controlSlot: string; moveX: number; moveY: number; sprint: number; heldButtons: number; pressedButtons: number; releasedButtons: number }[]> = {};
  for (let t = 0; t < durationTicks; t++) {
    const isPassWindow = t >= 10 && t < 20;
    program[t] = [
      {
        tick: t,
        sourceId: "eval-input",
        controlSlot: "slot-1",
        moveX: t < 10 ? 0.5 : 0,
        moveY: 0,
        sprint: 0,
        heldButtons: isPassWindow ? 2 : 0, // PASS_BIT
        pressedButtons: isPassWindow && t === 10 ? 2 : 0,
        releasedButtons: isPassWindow && t === 20 ? 2 : 0,
      },
    ];
  }
  return program;
}

/**
 * Generate a tick-indexed input program for a shot.
 * Player moves toward ball, holds SHOT bit to initiate shot.
 */
function makeShotInputProgram(durationTicks: number): Record<number, { tick: number; sourceId: string; controlSlot: string; moveX: number; moveY: number; sprint: number; heldButtons: number; pressedButtons: number; releasedButtons: number }[]> {
  const program: Record<number, { tick: number; sourceId: string; controlSlot: string; moveX: number; moveY: number; sprint: number; heldButtons: number; pressedButtons: number; releasedButtons: number }[]> = {};
  for (let t = 0; t < durationTicks; t++) {
    const isShotWindow = t >= 10 && t < 20;
    program[t] = [
      {
        tick: t,
        sourceId: "eval-input",
        controlSlot: "slot-1",
        moveX: t < 10 ? 0.5 : 0,
        moveY: 0,
        sprint: 1,
        heldButtons: isShotWindow ? 4 : 0, // SHOT_BIT
        pressedButtons: isShotWindow && t === 10 ? 4 : 0,
        releasedButtons: isShotWindow && t === 20 ? 4 : 0,
      },
    ];
  }
  return program;
}

export const SCENARIO_TOUCH_SLOW_001 = makeScenarioStub(
  "scn-touch-slow-001-v1",
  120,
  ["FIRST_TOUCH", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "slow-pass-reception" },
  makeTouchInputProgram(120),
);

export const SCENARIO_TOUCH_FAST_001 = makeScenarioStub(
  "scn-touch-fast-001-v1",
  120,
  ["FIRST_TOUCH", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "fast-pass-reception" },
);

export const SCENARIO_TOUCH_BACK_001 = makeScenarioStub(
  "scn-touch-back-001-v1",
  120,
  ["FIRST_TOUCH", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "back-orientation-reception" },
);

export const SCENARIO_TOUCH_90_001 = makeScenarioStub(
  "scn-touch-90-001-v1",
  120,
  ["FIRST_TOUCH", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "side-on-reception" },
);

export const SCENARIO_TOUCH_WF_001 = makeScenarioStub(
  "scn-touch-wf-001-v1",
  120,
  ["FIRST_TOUCH", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "weak-foot-reception" },
);

export const SCENARIO_PASS_LOW_001 = makeScenarioStub(
  "scn-pass-low-001-v1",
  120,
  ["BASIC_ACTIONS", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "low-pass" },
  makePassInputProgram(120),
);

export const SCENARIO_PASS_ANG_001 = makeScenarioStub(
  "scn-pass-ang-001-v1",
  120,
  ["BASIC_ACTIONS", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "orientation-dependent-pass" },
);

export const SCENARIO_PASS_RUN_001 = makeScenarioStub(
  "scn-pass-run-001-v1",
  120,
  ["BASIC_ACTIONS", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "leading-pass" },
);

export const SCENARIO_PASS_THR_001 = makeScenarioStub(
  "scn-pass-thr-001-v1",
  120,
  ["BASIC_ACTIONS", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "through-pass" },
);

export const SCENARIO_PASS_LOFT_001 = makeScenarioStub(
  "scn-pass-loft-001-v1",
  180,
  ["BASIC_ACTIONS", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "lofted-pass" },
);

export const SCENARIO_CROSS_HI_001 = makeScenarioStub(
  "scn-cross-hi-001-v1",
  180,
  ["BASIC_ACTIONS", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "high-cross" },
);

export const SCENARIO_SHOT_PWR_001 = makeScenarioStub(
  "scn-shot-pwr-001-v1",
  120,
  ["BASIC_ACTIONS", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "shot-power" },
  makeShotInputProgram(120),
);

export const SCENARIO_SHOT_IND_001 = makeScenarioStub(
  "scn-shot-ind-001-v1",
  120,
  ["BASIC_ACTIONS", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "shooting-power-isolation" },
);

export const SCENARIO_SHOT_SWV_001 = makeScenarioStub(
  "scn-shot-spw-001-v1",
  120,
  ["BASIC_ACTIONS", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "shot-curve" },
);

export const SCENARIO_HEAD_FREE_001 = makeScenarioStub(
  "scn-head-free-001-v1",
  120,
  ["BASIC_ACTIONS", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "unopposed-header" },
);

export const SCENARIO_HEAD_DUEL_001 = makeScenarioStub(
  "scn-head-duel-001-v1",
  120,
  ["BASIC_ACTIONS", "INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "contested-header" },
);

export const SCENARIO_CTRL_ACT_001 = makeScenarioStub(
  "scn-ctrl-act-001-v1",
  120,
  ["BASIC_ACTIONS"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "action-command-timing" },
);

// ---------------------------------------------------------------------------
// duels suite scenarios
// ---------------------------------------------------------------------------

/**
 * Generate a tick-indexed input program that drives two players toward
 * each other along the Y axis so they overlap and trigger
 * player-player-contact events.  Player-a starts at (0,0) moving
 * +Y; player-b starts at (0,1.5) moving −Y.  Both move at full
 * sprint for the entire window so contact is guaranteed well before
 * the scenario ends.
 */
function makeDuelInputProgram(
  durationTicks: number,
): Record<
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
> {
  const program: Record<
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
  for (let t = 0; t < durationTicks; t++) {
    program[t] = [
      {
        tick: t,
        sourceId: "eval-input",
        controlSlot: "slot-1",
        moveX: 0,
        moveY: 1,
        sprint: 1,
        heldButtons: 0,
        pressedButtons: t === 0 ? 0 : 0,
        releasedButtons: 0,
      },
      {
        tick: t,
        sourceId: "eval-input",
        controlSlot: "slot-2",
        moveX: 0,
        moveY: -1,
        sprint: 1,
        heldButtons: 0,
        pressedButtons: t === 0 ? 0 : 0,
        releasedButtons: 0,
      },
    ];
  }
  return program;
}

/**
 * Create a two-player duel scenario stub.
 * Two players start close together and run toward each other,
 * suitable for phy-shield/duel evaluation.
 */
function makeDuelScenarioStub(
  scenarioId: string,
  durationTicks: number,
  capabilityRequirements: string[],
  seedPolicy: { kind: "FIXED"; values_or_set_id: string },
  configRefs: Record<string, string> = {},
): ScenarioDefinition {
  const inputProgram = makeDuelInputProgram(durationTicks);
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
          playerId: "player-a",
          teamId: "team-A",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        },
        {
          playerId: "player-b",
          teamId: "team-B",
          groundPosition: { x: 0, y: 1.5 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 3.141592653589793,
          desiredHeading: 3.141592653589793,
        },
      ],
      ball: {
        position: { x: 0, y: 0.75, z: 0.11 },
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
      value: inputProgram,
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

export const SCENARIO_DUELS_PHY_SHLD_001 = makeDuelScenarioStub(
  "scn-duels-phy-shld-001-v1",
  60,
  ["PLAYER_DUELS"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "parallel-shoulder-contact" },
);

export const SCENARIO_DUELS_PHY_STR_001 = makeScenarioStub(
  "scn-duels-phy-str-001-v1",
  60,
  ["PLAYER_DUELS"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "physical-resistance-isolation" },
);

export const SCENARIO_DUELS_PHY_BC_001 = makeScenarioStub(
  "scn-duels-phy-bc-001-v1",
  60,
  ["PLAYER_DUELS"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "body-control-perturbation" },
);

export const SCENARIO_DUELS_PHY_PC_001 = makeScenarioStub(
  "scn-duels-phy-pc-001-v1",
  60,
  ["PLAYER_DUELS"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "physical-contact-variation" },
);

export const SCENARIO_DUELS_TACK_ST_001 = makeScenarioStub(
  "scn-duels-tack-st-001-v1",
  60,
  ["PLAYER_DUELS"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "standing-tackle" },
);

export const SCENARIO_DUELS_TACK_SL_001 = makeScenarioStub(
  "scn-duels-tack-sl-001-v1",
  60,
  ["PLAYER_DUELS"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "sliding-tackle" },
);

export const SCENARIO_DUELS_TACK_ANG_001 = makeScenarioStub(
  "scn-duels-tack-ang-001-v1",
  60,
  ["PLAYER_DUELS"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "tackle-angle" },
);

export const SCENARIO_DUELS_INT_PASS_001 = makeScenarioStub(
  "scn-duels-int-pass-001-v1",
  60,
  ["PLAYER_DUELS"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "intercept-pass" },
);

// ---------------------------------------------------------------------------
// body-control evaluation scenario
// ---------------------------------------------------------------------------

/**
 * Generate a tick-indexed input program for a body-control turn test.
 *
 * The player starts stationary, moves east for a few ticks, then
 * abruptly pivots north at tick 5, forcing the body heading to rotate.
 * This creates heading-change events that measure the locomotion turn rate.
 */
function makeBodyControlInputProgram(
  durationTicks: number,
): Record<
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
> {
  const program: Record<
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
  for (let t = 0; t < durationTicks; t++) {
    const isEast = t < 5;
    program[t] = [
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
  return program;
}

export const SCENARIO_BODY_CTRL_001 = makeScenarioStub(
  "scn-body-ctrl-001-v1",
  60,
  ["LOCOMOTION"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "body-control-turn-rate" },
  makeBodyControlInputProgram(60),
);

// ---------------------------------------------------------------------------
// swerve evaluation scenario
// ---------------------------------------------------------------------------

/**
 * Scenario for swerve capability evaluation.
 *
 * A ball is launched airborne with a lateral velocity and significant
 * spin (angularVelocity.z). The Magnus curve force acts on the spinning
 * ball during flight, producing lateral deviation from the straight-line
 * trajectory.  This scenario is used by the swerve axis runner to
 * compare low vs high curve coefficients.
 */
export const SCENARIO_SWERVE_001 = makeScenarioStub(
  "scn-swn-001-v1",
  120,
  ["INDEPENDENT_BALL"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "swerve-curve" },
  undefined,
);

// Override initial ball state: airborne with lateral velocity and spin.
Object.assign(
  SCENARIO_SWERVE_001.initial_state.ball as Record<string, unknown>,
  {
    position: { x: 10, y: 0, z: 3.0 },
    linearVelocity: { x: 4.0, y: 2.0, z: 8.0 },
    angularVelocity: { x: 0, y: 0, z: 15.0 },
    regime: "airborne" as const,
  },
);

export const SCENARIO_DUELS_INT_FAST_001 = makeScenarioStub(
  "scn-duels-int-fast-001-v1",
  60,
  ["PLAYER_DUELS"],
  { kind: "FIXED", values_or_set_id: "seeds-family-v1" },
  { test_focus: "fast-intercept" },
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

  // touch_and_actions suite scenarios
  [SCENARIO_TOUCH_SLOW_001.scenario_id]: SCENARIO_TOUCH_SLOW_001,
  [SCENARIO_TOUCH_FAST_001.scenario_id]: SCENARIO_TOUCH_FAST_001,
  [SCENARIO_TOUCH_BACK_001.scenario_id]: SCENARIO_TOUCH_BACK_001,
  [SCENARIO_TOUCH_90_001.scenario_id]: SCENARIO_TOUCH_90_001,
  [SCENARIO_TOUCH_WF_001.scenario_id]: SCENARIO_TOUCH_WF_001,
  [SCENARIO_PASS_LOW_001.scenario_id]: SCENARIO_PASS_LOW_001,
  [SCENARIO_PASS_ANG_001.scenario_id]: SCENARIO_PASS_ANG_001,
  [SCENARIO_PASS_RUN_001.scenario_id]: SCENARIO_PASS_RUN_001,
  [SCENARIO_PASS_THR_001.scenario_id]: SCENARIO_PASS_THR_001,
  [SCENARIO_PASS_LOFT_001.scenario_id]: SCENARIO_PASS_LOFT_001,
  [SCENARIO_CROSS_HI_001.scenario_id]: SCENARIO_CROSS_HI_001,
  [SCENARIO_SHOT_PWR_001.scenario_id]: SCENARIO_SHOT_PWR_001,
  [SCENARIO_SHOT_IND_001.scenario_id]: SCENARIO_SHOT_IND_001,
  [SCENARIO_SHOT_SWV_001.scenario_id]: SCENARIO_SHOT_SWV_001,
  [SCENARIO_HEAD_FREE_001.scenario_id]: SCENARIO_HEAD_FREE_001,
  [SCENARIO_HEAD_DUEL_001.scenario_id]: SCENARIO_HEAD_DUEL_001,
  [SCENARIO_CTRL_ACT_001.scenario_id]: SCENARIO_CTRL_ACT_001,

  // duels suite scenarios
  [SCENARIO_DUELS_PHY_SHLD_001.scenario_id]: SCENARIO_DUELS_PHY_SHLD_001,
  [SCENARIO_DUELS_PHY_STR_001.scenario_id]: SCENARIO_DUELS_PHY_STR_001,
  [SCENARIO_DUELS_PHY_BC_001.scenario_id]: SCENARIO_DUELS_PHY_BC_001,
  [SCENARIO_DUELS_PHY_PC_001.scenario_id]: SCENARIO_DUELS_PHY_PC_001,
  [SCENARIO_DUELS_TACK_ST_001.scenario_id]: SCENARIO_DUELS_TACK_ST_001,
  [SCENARIO_DUELS_TACK_SL_001.scenario_id]: SCENARIO_DUELS_TACK_SL_001,
  [SCENARIO_DUELS_TACK_ANG_001.scenario_id]: SCENARIO_DUELS_TACK_ANG_001,
  [SCENARIO_DUELS_INT_PASS_001.scenario_id]: SCENARIO_DUELS_INT_PASS_001,
  [SCENARIO_DUELS_INT_FAST_001.scenario_id]: SCENARIO_DUELS_INT_FAST_001,

  // body-control evaluation scenario
  [SCENARIO_BODY_CTRL_001.scenario_id]: SCENARIO_BODY_CTRL_001,

  // swerve evaluation scenario
  [SCENARIO_SWERVE_001.scenario_id]: SCENARIO_SWERVE_001,
};

/**
 * Get a scenario definition by scenario_id.
 */
export function getScenario(scenarioId: string): ScenarioDefinition | undefined {
  return SCENARIO_REGISTRY[scenarioId];
}