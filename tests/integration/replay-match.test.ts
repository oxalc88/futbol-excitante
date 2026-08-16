/**
 * @module replay-match-integration-tests
 *
 * Integration tests for match-aware replay verification (MATCH-REPLAY-EXTENSION).
 *
 * Tests:
 *  - Replay with matching scores → scoreMatch = true.
 *  - Replay with matching goal events → scoreEventsMatch = true.
 *  - Zero-score match validates correctly.
 *  - Determinism: same inputs produce identical score and events.
 *
 * Node I/O is allowed in this module (eval/adapters layer).
 */

import { describe, it, expect } from "vitest";

import {
  runHeadlessMatch,
  makeAiMatchScenario,
  type HeadlessMatchResult,
  type HeadlessMatchConfig,
} from "../../eval/runners/headless-match.js";

import { verifyMatchReplay } from "../../eval/recording/verifier.js";
import { createRecorder } from "../../eval/recording/recorder.js";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { NO_OP_OBSERVER } from "../../src/simulation/telemetry/observer.js";
import { makeInputFrame } from "../unit/contracts.fixture.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal two-player match scenario suitable for
 * the headless CPU-vs-CPU match runner.
 *
 * Mirrors the structure of the ai-match fixture so that
 * the replay scenario used by verifyMatchReplay is identical
 * to the one used by runHeadlessMatch.
 */
function makeMatchScenario(): ScenarioDefinition {
  return {
    id: "match-scenario-v1",
    version: "1.0.0",
    family: "match-scoring",
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
        playerId: "player-a",
        teamId: "team-a",
        groundPosition: { x: 0, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        desiredHeading: 0,
        archetypeId: "archetype-burst-v1",
      },
      {
        playerId: "player-b",
        teamId: "team-b",
        groundPosition: { x: 40, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
        desiredHeading: Math.PI,
        archetypeId: "archetype-steady-v1",
      },
    ],
    ball: {
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    controlAssignments: {
      "slot-a": {
        controlSlot: "slot-a",
        teamId: "team-a",
        controlledPlayerId: "player-a",
        mode: "AI_FALLBACK",
      },
      "slot-b": {
        controlSlot: "slot-b",
        teamId: "team-b",
        controlledPlayerId: "player-b",
        mode: "AI_FALLBACK",
      },
    },
    missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
    maxConsecutiveMissing: 3,
    inputProgram: {},
    scheduledEvents: {},
    observationWindows: [{ startTick: 0, endTick: 60 }],
    requestedMetrics: ["player-displacement", "ball-distance"],
  };
}

/**
 * Record a match simulation and return { replay, result, scenario }.
 *
 * Uses the provided scenario and input program. The scenario must have
 * two players with AI_FALLBACK control assignments.
 */
function recordMatch(
  scenario: ScenarioDefinition,
  inputProgram: Record<number, { frames: ReturnType<typeof makeInputFrame>[] }>,
): { replay: ReturnType<typeof createRecorder>["build"] & {}; result: HeadlessMatchResult; scenario: ScenarioDefinition } {
  const initialWorld = createWorld({ scenario });
  const recorder = createRecorder(
    {
      simulationVersion: "sim-v1",
      runtimeIdentity: "test",
      configVersion: initialWorld.configVersion,
      configHash: "config-hash",
      pitchRulesHash: "pitch-hash",
      rosterCapabilityHash: "roster-hash",
      scenarioHash: "scenario-hash",
      prngAlgorithmId: initialWorld.prng.algorithmId,
      prngSeed: initialWorld.prng.seed,
      runId: "test-run",
      hashCadence: 1,
      checkpointCadence: 0,
    },
    initialWorld,
  );

  const maxTick = Math.max(...Object.keys(inputProgram).map(Number));
  const sim = createSimulation(initialWorld, NO_OP_OBSERVER);
  for (let t = 0; t <= maxTick; t++) {
    const frames = inputProgram[t]?.frames ?? [];
    sim.applyInputs(frames);
    const result = sim.step();
    recorder.recordInput(frames);
    recorder.recordHash(result.tick, result.stateHash);
  }

  return {
    replay: recorder.build(),
    scenario,
    result: {
      tick: sim.tick,
      score: {},
      goalEvents: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MATCH-REPLAY-001: replay with matching scores", () => {
  it("scoreMatch and scoreEventsMatch are true for a deterministically replayed match", () => {
    const scenario = makeMatchScenario();
    const duration = 60;

    // Run the match headless to get recorded score and goal events.
    const matchResult = runHeadlessMatch({ scenario });

    // Record the inputs used by the match.
    const inputProgram: Record<number, { frames: ReturnType<typeof makeInputFrame>[] }> = {};
    const initialWorld = createWorld({ scenario });
    const recorder = createRecorder(
      {
        simulationVersion: "sim-v1",
        runtimeIdentity: "test",
        configVersion: initialWorld.configVersion,
        configHash: "config-hash",
        pitchRulesHash: "pitch-hash",
        rosterCapabilityHash: "roster-hash",
        scenarioHash: "scenario-hash",
        prngAlgorithmId: initialWorld.prng.algorithmId,
        prngSeed: initialWorld.prng.seed,
        runId: "test-run",
        hashCadence: 1,
        checkpointCadence: 0,
      },
      initialWorld,
    );
    const sim = createSimulation(initialWorld, NO_OP_OBSERVER);
    for (let t = 0; t < duration; t++) {
      const frameA = makeInputFrame(t, "slot-a", { moveX: 0.1 });
      const frameB = makeInputFrame(t, "slot-b", { moveX: -0.1 });
      sim.applyInputs([frameA, frameB]);
      const stepResult = sim.step();
      recorder.recordInput([frameA, frameB]);
      recorder.recordHash(stepResult.tick, stepResult.stateHash);
    }
    const replay = recorder.build();

    // Verify with match score awareness.
    const result = verifyMatchReplay(replay, scenario, matchResult, NO_OP_OBSERVER);

    expect(result.scoreMatch).toBe(true);
    expect(result.scoreEventsMatch).toBe(true);
    expect(result.match).toBe(true);
  });
});

describe("MATCH-REPLAY-002: zero-score match validates", () => {
  it("a match with no goals produces scoreMatch = true and scoreEventsMatch = true", () => {
    const scenario = makeMatchScenario();
    const duration = 60;

    // Run headless — with neutral inputs no goals should occur.
    const matchResult = runHeadlessMatch({ scenario });

    // Record with neutral inputs (no movement at all).
    const initialWorld = createWorld({ scenario });
    const recorder = createRecorder(
      {
        simulationVersion: "sim-v1",
        runtimeIdentity: "test",
        configVersion: initialWorld.configVersion,
        configHash: "config-hash",
        pitchRulesHash: "pitch-hash",
        rosterCapabilityHash: "roster-hash",
        scenarioHash: "scenario-hash",
        prngAlgorithmId: initialWorld.prng.algorithmId,
        prngSeed: initialWorld.prng.seed,
        runId: "test-run",
        hashCadence: 1,
        checkpointCadence: 0,
      },
      initialWorld,
    );
    const sim = createSimulation(initialWorld, NO_OP_OBSERVER);
    for (let t = 0; t < duration; t++) {
      const frameA = makeInputFrame(t, "slot-a");
      const frameB = makeInputFrame(t, "slot-b");
      sim.applyInputs([frameA, frameB]);
      const stepResult = sim.step();
      recorder.recordInput([frameA, frameB]);
      recorder.recordHash(stepResult.tick, stepResult.stateHash);
    }
    const replay = recorder.build();

    // Verify zero-score replay.
    const result = verifyMatchReplay(replay, scenario, matchResult, NO_OP_OBSERVER);

    expect(result.scoreMatch).toBe(true);
    expect(result.scoreEventsMatch).toBe(true);
    expect(result.recordedGoalCount).toBe(0);
    expect(result.replayedGoalCount).toBe(0);
    expect(result.match).toBe(true);
  });
});

describe("MATCH-REPLAY-003: determinism", () => {
  it("two independent replays produce the same score and events", () => {
    const scenario = makeMatchScenario();
    const duration = 60;

    // Run the match once to get the recorded result.
    const matchResult = runHeadlessMatch({ scenario });

    // Build the first replay record.
    const initialWorld1 = createWorld({ scenario });
    const recorder1 = createRecorder(
      {
        simulationVersion: "sim-v1",
        runtimeIdentity: "test",
        configVersion: initialWorld1.configVersion,
        configHash: "config-hash",
        pitchRulesHash: "pitch-hash",
        rosterCapabilityHash: "roster-hash",
        scenarioHash: "scenario-hash",
        prngAlgorithmId: initialWorld1.prng.algorithmId,
        prngSeed: initialWorld1.prng.seed,
        runId: "test-run-1",
        hashCadence: 1,
        checkpointCadence: 0,
      },
      initialWorld1,
    );
    const sim1 = createSimulation(initialWorld1, NO_OP_OBSERVER);
    for (let t = 0; t < duration; t++) {
      const frameA = makeInputFrame(t, "slot-a", { moveX: 0.05 * (t % 5) });
      const frameB = makeInputFrame(t, "slot-b", { moveX: -0.05 * (t % 5) });
      sim1.applyInputs([frameA, frameB]);
      const stepResult = sim1.step();
      recorder1.recordInput([frameA, frameB]);
      recorder1.recordHash(stepResult.tick, stepResult.stateHash);
    }
    const replay1 = recorder1.build();

    // Build a second replay record with identical inputs.
    const initialWorld2 = createWorld({ scenario });
    const recorder2 = createRecorder(
      {
        simulationVersion: "sim-v1",
        runtimeIdentity: "test",
        configVersion: initialWorld2.configVersion,
        configHash: "config-hash",
        pitchRulesHash: "pitch-hash",
        rosterCapabilityHash: "roster-hash",
        scenarioHash: "scenario-hash",
        prngAlgorithmId: initialWorld2.prng.algorithmId,
        prngSeed: initialWorld2.prng.seed,
        runId: "test-run-2",
        hashCadence: 1,
        checkpointCadence: 0,
      },
      initialWorld2,
    );
    const sim2 = createSimulation(initialWorld2, NO_OP_OBSERVER);
    for (let t = 0; t < duration; t++) {
      const frameA = makeInputFrame(t, "slot-a", { moveX: 0.05 * (t % 5) });
      const frameB = makeInputFrame(t, "slot-b", { moveX: -0.05 * (t % 5) });
      sim2.applyInputs([frameA, frameB]);
      const stepResult = sim2.step();
      recorder2.recordInput([frameA, frameB]);
      recorder2.recordHash(stepResult.tick, stepResult.stateHash);
    }
    const replay2 = recorder2.build();

    // Both replays should produce the same verification result.
    const result1 = verifyMatchReplay(replay1, scenario, matchResult, NO_OP_OBSERVER);
    const result2 = verifyMatchReplay(replay2, scenario, matchResult, NO_OP_OBSERVER);

    expect(result1.scoreMatch).toBe(result2.scoreMatch);
    expect(result1.scoreEventsMatch).toBe(result2.scoreEventsMatch);
    expect(result1.replayedGoalCount).toBe(result2.replayedGoalCount);
  });
});

describe("MATCH-REPLAY-004: zero-score replay from scratch", () => {
  it("a manually recorded zero-score replay validates correctly", () => {
    const scenario = makeMatchScenario();
    const duration = 30;

    // Record a match with completely neutral inputs.
    const initialWorld = createWorld({ scenario });
    const recorder = createRecorder(
      {
        simulationVersion: "sim-v1",
        runtimeIdentity: "test",
        configVersion: initialWorld.configVersion,
        configHash: "config-hash",
        pitchRulesHash: "pitch-hash",
        rosterCapabilityHash: "roster-hash",
        scenarioHash: "scenario-hash",
        prngAlgorithmId: initialWorld.prng.algorithmId,
        prngSeed: initialWorld.prng.seed,
        runId: "test-run",
        hashCadence: 1,
        checkpointCadence: 0,
      },
      initialWorld,
    );

    const sim = createSimulation(initialWorld, NO_OP_OBSERVER);
    for (let t = 0; t < duration; t++) {
      const frameA = makeInputFrame(t, "slot-a");
      const frameB = makeInputFrame(t, "slot-b");
      sim.applyInputs([frameA, frameB]);
      const stepResult = sim.step();
      recorder.recordInput([frameA, frameB]);
      recorder.recordHash(stepResult.tick, stepResult.stateHash);
    }
    const replay = recorder.build();

    // A zero-score match result (no goals scored).
    const zeroScoreResult: HeadlessMatchResult = {
      tick: sim.tick,
      events: [],
      observations: [],
      stateHashes: [],
      matchDurationTicks: duration,
      elapsedTicks: sim.tick,
      remainingTicks: 0,
      matchTimeSeconds: sim.tick * (1 / 60),
      score: { "team-a": 0, "team-b": 0 },
      goalEvents: [],
      matchPhase: "fulltime",
      phaseHistory: [{ tick: 0, phase: "kickoff" }],
    };

    const result = verifyMatchReplay(replay, scenario, zeroScoreResult, NO_OP_OBSERVER);

    expect(result.scoreMatch).toBe(true);
    expect(result.scoreEventsMatch).toBe(true);
    expect(result.recordedGoalCount).toBe(0);
    expect(result.replayedGoalCount).toBe(0);
    expect(result.match).toBe(true);
    expect(result.initialHashMatch).toBe(true);
  });
});