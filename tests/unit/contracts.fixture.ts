/**
 * Test fixtures for contracts.
 *
 * These build legal one-player/one-ball states and scenarios
 * that pass all validation.
 */

import type { Vec2, Vec3 } from "../../src/contracts/math.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { PlayerState, BallState, WorldState, SchedulerMemory } from "../../src/contracts/state.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { PresentationSnapshot } from "../../src/contracts/presentation.js";
import type { ReplayV1, ReplayV1Header } from "../../src/contracts/replay.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import { MISSING_INPUT_POLICY_REPEAT_HELD_WITH_ZERO_EDGES } from "../../src/contracts/input.js";
import { FOUNDATION_CONFIG } from "../../src/simulation/config/foundation.js";

// ---------------------------------------------------------------------------
// Fixture builders (pure data — no side effects)
// ---------------------------------------------------------------------------

export function makeVec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function makeVec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function makeInputFrame(
  tick: number,
  controlSlot: string,
  opts?: Partial<InputFrame>
): InputFrame {
  return {
    tick,
    sourceId: opts?.sourceId ?? "test-source",
    controlSlot,
    moveX: opts?.moveX ?? 0,
    moveY: opts?.moveY ?? 0,
    sprint: opts?.sprint ?? 0,
    heldButtons: opts?.heldButtons ?? 0,
    pressedButtons: opts?.pressedButtons ?? 0,
    releasedButtons: opts?.releasedButtons ?? 0,
  };
}

export function makePlayerState(
  playerId: string,
  teamId: string,
  opts?: Partial<PlayerState>
): PlayerState {
  return {
    playerId,
    teamId,
    groundPosition: makeVec2(0, 0),
    linearVelocity: makeVec2(0, 0),
    desiredVelocity: makeVec2(0, 0),
    bodyHeading: 0,
    desiredHeading: 0,
    ...opts,
  };
}

export function makeBallState(
  opts?: Partial<BallState>
): BallState {
  return {
    position: makeVec3(0, 0, 0),
    linearVelocity: makeVec3(0, 0, 0),
    angularVelocity: makeVec3(0, 0, 0),
    regime: "settled",
    lastTouchRef: null,
    ...opts,
  };
}

export function makeSchedulerMemory(
  opts?: Partial<SchedulerMemory>
): SchedulerMemory {
  return {
    missingInputPolicyId: MISSING_INPUT_POLICY_REPEAT_HELD_WITH_ZERO_EDGES,
    maxConsecutiveMissing: 3,
    missingInputCounters: {},
    lastHeldFrames: {},
    ...opts,
  };
}

// ---------------------------------------------------------------------------
// Legal one-player/one-ball WorldState
// ---------------------------------------------------------------------------

export function makeWorldState(
  opts?: {
    tick?: number;
    player?: Partial<PlayerState>;
    ball?: Partial<BallState>;
    events?: any[];
  }
): WorldState {
  return {
    schemaVersion: "state-v1",
    simulationVersion: "sim-v1",
    configVersion: FOUNDATION_CONFIG.id,
    tick: opts?.tick ?? 0,
    fixedDt: FOUNDATION_CONFIG.fixedDt,
    prng: {
      algorithmId: FOUNDATION_CONFIG.prngAlgorithmId,
      seed: 42,
      state: {},
    },
    players: [
      makePlayerState("player-1", "team-a", opts?.player),
    ],
    ball: makeBallState(opts?.ball),
    events: opts?.events ?? [],
    schedulerMemory: makeSchedulerMemory(),
  };
}

// ---------------------------------------------------------------------------
// Legal one-player/one-ball ScenarioDefinition
// ---------------------------------------------------------------------------

export function makeScenario(): ScenarioDefinition {
  return {
    id: "foundation-one-player-v1",
    version: "1.0.0",
    family: "bootstrap",
    durationTicks: 60,
    seed: 42,
    prngAlgorithmId: FOUNDATION_CONFIG.prngAlgorithmId,
    schemaVersion: "state-v1",
    simulationVersion: "sim-v1",
    configVersion: FOUNDATION_CONFIG.id,
    profile: "LABORATORY",
    pitchLength: 105,
    pitchWidth: 68,
    safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
    players: [
      {
        playerId: "player-1",
        teamId: "team-a",
        groundPosition: makeVec2(0, 0),
        linearVelocity: makeVec2(0, 0),
        desiredVelocity: makeVec2(0, 0),
        bodyHeading: 0,
        desiredHeading: 0,
      },
    ],
    ball: {
      position: makeVec3(0, 0, 0.11),
      linearVelocity: makeVec3(0, 0, 0),
      angularVelocity: makeVec3(0, 0, 0),
      regime: "settled",
    },
    controlAssignments: {
      "slot-1": {
        controlSlot: "slot-1",
        teamId: "team-a",
        controlledPlayerId: "player-1",
        mode: "HUMAN",
      },
    },
    missingInputPolicy: MISSING_INPUT_POLICY_REPEAT_HELD_WITH_ZERO_EDGES,
    maxConsecutiveMissing: 3,
    inputProgram: {
      "0": [makeInputFrame(0, "slot-1")],
      "1": [makeInputFrame(1, "slot-1", { moveX: 0.5 })],
      "2": [makeInputFrame(2, "slot-1", { moveX: 0.5, sprint: 1 })],
    },
    scheduledEvents: {},
    observationWindows: [
      { startTick: 0, endTick: 60 },
    ],
    requestedMetrics: ["player-displacement", "ball-distance"],
  };
}

// ---------------------------------------------------------------------------
// Minimal PresentationSnapshot
// ---------------------------------------------------------------------------

export function makePresentationSnapshot(): PresentationSnapshot {
  return {
    tick: 0,
    simulationTime: 0,
    players: [
      {
        playerId: "player-1",
        teamId: "team-a",
        groundPosition: makeVec2(0, 0),
        bodyHeading: 0,
        speed: 0,
        locomotionPhase: "idle",
        isControlled: true,
        actionState: null,
        contactState: null,
      },
    ],
    ball: {
      position: makeVec3(0, 0, 0.11),
      speed: 0,
      regime: "settled",
      isGrounded: true,
      angularVelocity: makeVec3(0, 0, 0),
    },
    events: [],
    controlAssignments: {
      bySlot: {
        "slot-1": { teamId: "team-a", controlledPlayerId: "player-1" },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Minimal TelemetryObservation
// ---------------------------------------------------------------------------

export function makeTelemetryObservation(): TelemetryObservation {
  return {
    tick: 0,
    simulationTime: 0,
    prngAlgorithmId: FOUNDATION_CONFIG.prngAlgorithmId,
    stateHash: "abc123",
    committedTick: 0,
    inputs: [makeInputFrame(0, "slot-1")],
    players: [
      {
        playerId: "player-1",
        teamId: "team-a",
        groundPosition: makeVec2(0, 0),
        linearVelocity: makeVec2(0, 0),
        desiredVelocity: makeVec2(0, 0),
        bodyHeading: 0,
        desiredHeading: 0,
      },
    ],
    ball: {
      position: makeVec3(0, 0, 0.11),
      linearVelocity: makeVec3(0, 0, 0),
      angularVelocity: makeVec3(0, 0, 0),
      regime: "settled",
      lastTouchRef: null,
    },
    events: [],
  };
}

// ---------------------------------------------------------------------------
// Minimal ReplayV1
// ---------------------------------------------------------------------------

export function makeReplayV1(): ReplayV1 {
  const header: ReplayV1Header = {
    replayVersion: "replay-v1",
    schemaVersion: "state-v1",
    simulationVersion: "sim-v1",
    runtimeIdentity: "node-v24.18.0",
    configVersion: FOUNDATION_CONFIG.id,
    configHash: "config-hash-1",
    pitchRulesHash: "pitch-hash-1",
    rosterCapabilityHash: "roster-hash-1",
    scenarioHash: "scenario-hash-1",
    initialStateHash: "initial-hash-1",
    prngAlgorithmId: FOUNDATION_CONFIG.prngAlgorithmId,
    prngSeed: 42,
    prngState: { algorithmId: FOUNDATION_CONFIG.prngAlgorithmId, seed: 42, state: {} },
    recordedAt: "2026-01-01T00:00:00.000Z",
    runId: "run-001",
  };

  return {
    header,
    inputs: [
      makeInputFrame(0, "slot-1"),
      makeInputFrame(1, "slot-1", { moveX: 0.5 }),
      makeInputFrame(2, "slot-1", { moveX: 0.5, sprint: 1 }),
    ],
    scheduledEvents: [],
    hashes: [
      { tick: 0, stateHash: "hash-0" },
      { tick: 1, stateHash: "hash-1" },
      { tick: 2, stateHash: "hash-2" },
    ],
    checkpoints: [
      { tick: 0, stateHash: "hash-0" },
    ],
    checkpointsState: [],
  };
}