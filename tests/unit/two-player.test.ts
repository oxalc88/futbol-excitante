/**
 * @module two-player-tests
 *
 * Tests for PLAYABLE-SECOND-SLOT: two human players, each on opposite teams,
 * with independent control slots, keyboard adapters, and input resolution.
 *
 * Tests:
 *  1. Scenario createWorld: two players, one ball, two assignments.
 *  2. Slot-1 input moves player A only; slot-2 input moves player B only.
 *  3. Both slots can first-touch / pass independently when in range.
 *  4. Determinism: same two-slot input program yields same hashes.
 *  5. One-player foundation scenario still works unchanged.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect } from "vitest";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { NO_OP_OBSERVER } from "../../src/simulation/telemetry/observer.js";
import { FIRST_TOUCH_BIT, PASS_BIT, SHOT_BIT } from "../../src/contracts/input.js";
import type { WorldState } from "../../src/contracts/state.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DT = 1 / 60;

function createTwoPlayerWorld(seed: number = 42): WorldState {
  const scenario = {
    id: "two-player-duel-test",
    version: "1.0.0",
    family: "two-player",
    durationTicks: 60,
    seed,
    prngAlgorithmId: "mulberry32-v1",
    schemaVersion: "state-v1",
    simulationVersion: "sim-v1",
    configVersion: "foundation-config-v1",
    profile: "LABORATORY" as const,
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
      },
      {
        playerId: "player-b",
        teamId: "team-b",
        groundPosition: { x: 5, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
        desiredHeading: Math.PI,
      },
    ],
    ball: {
      position: { x: 2.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll" as const,
    },
    controlAssignments: {
      "slot-1": {
        controlSlot: "slot-1",
        teamId: "team-a",
        controlledPlayerId: "player-a",
        mode: "HUMAN" as const,
      },
      "slot-2": {
        controlSlot: "slot-2",
        teamId: "team-b",
        controlledPlayerId: "player-b",
        mode: "HUMAN" as const,
      },
    },
    missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
    maxConsecutiveMissing: 3,
    inputProgram: {},
    scheduledEvents: {},
    requestedMetrics: [],
  };
  return createWorld({ scenario });
}

// ---------------------------------------------------------------------------
// 1. Two-player scenario createWorld: two players, one ball, two assignments
// ---------------------------------------------------------------------------

describe("PLAYABLE-SECOND-SLOT-001: two-player scenario createWorld", () => {
  it("creates world with exactly two players", () => {
    const world = createTwoPlayerWorld();
    expect(world.players.length).toBe(2);
  });

  it("creates world with exactly one ball", () => {
    const world = createTwoPlayerWorld();
    // The ball entity must exist and be independent.
    expect(world.ball).toBeDefined();
    expect((world.ball as unknown as Record<string, unknown>)?.ownerPlayerId).toBeUndefined();
  });

  it("ball is independent (no ownerPlayerId)", () => {
    const world = createTwoPlayerWorld();
    expect((world.ball as unknown as Record<string, unknown>).ownerPlayerId).toBeUndefined();
  });

  it("has two control assignments (slot-1 and slot-2)", () => {
    const world = createTwoPlayerWorld();
    const assignments = world.controlAssignments;
    expect(assignments["slot-1"]).toBeDefined();
    expect(assignments["slot-2"]).toBeDefined();
  });

  it("slot-1 controls a player on team-a", () => {
    const world = createTwoPlayerWorld();
    expect(world.controlAssignments["slot-1"].teamId).toBe("team-a");
    expect(world.controlAssignments["slot-1"].controlledPlayerId).toBe("player-a");
    expect(world.controlAssignments["slot-1"].mode).toBe("HUMAN");
  });

  it("slot-2 controls a player on team-b", () => {
    const world = createTwoPlayerWorld();
    expect(world.controlAssignments["slot-2"].teamId).toBe("team-b");
    expect(world.controlAssignments["slot-2"].controlledPlayerId).toBe("player-b");
    expect(world.controlAssignments["slot-2"].mode).toBe("HUMAN");
  });

  it("players are sorted by playerId for deterministic iteration", () => {
    const world = createTwoPlayerWorld();
    expect(world.players[0].playerId).toBe("player-a");
    expect(world.players[1].playerId).toBe("player-b");
  });

  it("initial state has both players at their declared positions", () => {
    const world = createTwoPlayerWorld();
    const playerA = world.players.find((p) => p.playerId === "player-a")!;
    const playerB = world.players.find((p) => p.playerId === "player-b")!;
    expect(playerA.groundPosition.x).toBe(0);
    expect(playerA.groundPosition.y).toBe(0);
    expect(playerB.groundPosition.x).toBe(5);
    expect(playerB.groundPosition.y).toBe(0);
  });

  it("scenario validation passes for two-player scenario", () => {
    const scenario = {
      id: "validation-test",
      version: "1.0.0",
      family: "two-player",
      durationTicks: 60,
      seed: 42,
      prngAlgorithmId: "mulberry32-v1",
      schemaVersion: "state-v1",
      simulationVersion: "sim-v1",
      configVersion: "foundation-config-v1",
      profile: "LABORATORY" as const,
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
        },
        {
          playerId: "player-b",
          teamId: "team-b",
          groundPosition: { x: 5, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: Math.PI,
          desiredHeading: Math.PI,
        },
      ],
      ball: {
        position: { x: 2.5, y: 0, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll" as const,
      },
      controlAssignments: {
        "slot-1": {
          controlSlot: "slot-1",
          teamId: "team-a",
          controlledPlayerId: "player-a",
          mode: "HUMAN" as const,
        },
        "slot-2": {
          controlSlot: "slot-2",
          teamId: "team-b",
          controlledPlayerId: "player-b",
          mode: "HUMAN" as const,
        },
      },
      missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
      maxConsecutiveMissing: 3,
      inputProgram: {},
      scheduledEvents: {},
      requestedMetrics: [],
    };
    const world = createWorld({ scenario });
    expect(world.players.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 2. Slot-1 input moves player A only; slot-2 input moves player B only
// ---------------------------------------------------------------------------

describe("PLAYABLE-SECOND-SLOT-002: slot-1 moves player A, slot-2 moves player B", () => {
  it("slot-1 moveX=1 moves player-a in +X direction", () => {
    const world = createTwoPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Apply slot-1 input for tick 0.
    sim.applyInputs([
      {
        tick: 0,
        sourceId: "test",
        controlSlot: "slot-1",
        moveX: 1,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
    ]);

    // Run a few ticks.
    for (let i = 0; i < 10; i++) {
      sim.step();
    }

    const snap = sim.snapshot();
    const playerA = snap.players.find((p) => p.playerId === "player-a")!;
    const playerB = snap.players.find((p) => p.playerId === "player-b")!;

    // Player A moved in +X.
    expect(playerA.groundPosition.x).toBeGreaterThan(0);
    // Player B stayed at initial position (no input for slot-2).
    expect(playerB.groundPosition.x).toBe(5);
  });

  it("slot-2 moveX=-1 moves player-b in -X direction", () => {
    const world = createTwoPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Apply slot-2 input for tick 0.
    sim.applyInputs([
      {
        tick: 0,
        sourceId: "test",
        controlSlot: "slot-2",
        moveX: -1,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
    ]);

    for (let i = 0; i < 10; i++) {
      sim.step();
    }

    const snap = sim.snapshot();
    const playerA = snap.players.find((p) => p.playerId === "player-a")!;
    const playerB = snap.players.find((p) => p.playerId === "player-b")!;

    // Player B moved in -X direction from x=5.
    expect(playerB.groundPosition.x).toBeLessThan(5);
    // Player A stayed at origin (no input for slot-1).
    expect(playerA.groundPosition.x).toBe(0);
  });

  it("both slots simultaneously: player-a moves +X, player-b moves -X", () => {
    const world = createTwoPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Apply BOTH slot-1 and slot-2 inputs for tick 0.
    sim.applyInputs([
      {
        tick: 0,
        sourceId: "test",
        controlSlot: "slot-1",
        moveX: 1,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
      {
        tick: 0,
        sourceId: "test",
        controlSlot: "slot-2",
        moveX: -1,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
    ]);

    for (let i = 0; i < 10; i++) {
      sim.step();
    }

    const snap = sim.snapshot();
    const playerA = snap.players.find((p) => p.playerId === "player-a")!;
    const playerB = snap.players.find((p) => p.playerId === "player-b")!;

    // Both players moved independently.
    expect(playerA.groundPosition.x).toBeGreaterThan(0);
    expect(playerB.groundPosition.x).toBeLessThan(5);
  });

  it("slot-1 moveY moves only player-a on the Y axis", () => {
    const world = createTwoPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    sim.applyInputs([
      {
        tick: 0,
        sourceId: "test",
        controlSlot: "slot-1",
        moveX: 0,
        moveY: 1,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
    ]);

    for (let i = 0; i < 10; i++) {
      sim.step();
    }

    const snap = sim.snapshot();
    const playerA = snap.players.find((p) => p.playerId === "player-a")!;
    const playerB = snap.players.find((p) => p.playerId === "player-b")!;

    expect(playerA.groundPosition.y).toBeGreaterThan(0);
    // Player B unchanged on Y.
    expect(playerB.groundPosition.y).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Both slots can first-touch / pass independently
// ---------------------------------------------------------------------------

describe("PLAYABLE-SECOND-SLOT-003: independent first-touch and pass", () => {
  it("slot-1 player first-touches the ball when in range", () => {
    const world = createTwoPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Position player-a near the ball (already at x=0, ball at x=2.5).
    // Player-a will move towards the ball. Apply FIRST_TOUCH on every tick
    // until contact is found.
    let foundContactA = false;
    for (let t = 0; t < 30; t++) {
      sim.applyInputs([
        {
          tick: t,
          sourceId: "test",
          controlSlot: "slot-1",
          moveX: 1,
          moveY: 0,
          sprint: 0,
          heldButtons: 0,
          pressedButtons: FIRST_TOUCH_BIT,
          releasedButtons: 0,
        },
        {
          tick: t,
          sourceId: "test",
          controlSlot: "slot-2",
          moveX: 0,
          moveY: 0,
          sprint: 0,
          heldButtons: 0,
          pressedButtons: 0,
          releasedButtons: 0,
        },
      ]);

      const result = sim.step();
      const contactEvents = result.events.filter(
        (e) => e.kind === "player-ball-contact" && (e.payload as Record<string, unknown>)?.playerId === "player-a",
      );
      if (contactEvents.length > 0) {
        foundContactA = true;
        break;
      }
    }

    // Player A should be able to touch the ball within 30 ticks (moving at ~7 m/s).
    expect(foundContactA).toBe(true);
  });

  it("slot-2 player passes the ball when in range", () => {
    // Create a scenario where player-b is very close to the ball.
    const scenario = {
      id: "two-slot-pass-test",
      version: "1.0.0",
      family: "two-player",
      durationTicks: 60,
      seed: 42,
      prngAlgorithmId: "mulberry32-v1",
      schemaVersion: "state-v1",
      simulationVersion: "sim-v1",
      configVersion: "foundation-config-v1",
      profile: "LABORATORY" as const,
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
        },
        {
          playerId: "player-b",
          teamId: "team-b",
          groundPosition: { x: 2.5, y: 0 }, // right next to ball
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        },
      ],
      ball: {
        position: { x: 2.5, y: 0, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll" as const,
      },
      controlAssignments: {
        "slot-1": {
          controlSlot: "slot-1",
          teamId: "team-a",
          controlledPlayerId: "player-a",
          mode: "HUMAN" as const,
        },
        "slot-2": {
          controlSlot: "slot-2",
          teamId: "team-b",
          controlledPlayerId: "player-b",
          mode: "HUMAN" as const,
        },
      },
      missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
      maxConsecutiveMissing: 3,
      inputProgram: {},
      scheduledEvents: {},
      requestedMetrics: [],
    };

    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Player-b presses PASS_BIT on tick 0.
    sim.applyInputs([
      {
        tick: 0,
        sourceId: "test",
        controlSlot: "slot-1",
        moveX: 0,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
      {
        tick: 0,
        sourceId: "test",
        controlSlot: "slot-2",
        moveX: 0,
        moveY: 0,
        sprint: 0,
        heldButtons: PASS_BIT,
        pressedButtons: PASS_BIT,
        releasedButtons: 0,
      },
    ]);

    let foundPass = false;
    for (let i = 0; i < 10; i++) {
      const result = sim.step();
      const passEvents = result.events.filter(
        (e) => e.kind === "pass" && (e.payload as Record<string, unknown>)?.playerId === "player-b",
      );
      if (passEvents.length > 0) {
        foundPass = true;
        break;
      }
    }

    expect(foundPass).toBe(true);
  });

  it("both slots act independently without interference", () => {
    const scenario = {
      id: "two-slot-independent-test",
      version: "1.0.0",
      family: "two-player",
      durationTicks: 60,
      seed: 42,
      prngAlgorithmId: "mulberry32-v1",
      schemaVersion: "state-v1",
      simulationVersion: "sim-v1",
      configVersion: "foundation-config-v1",
      profile: "LABORATORY" as const,
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
        },
        {
          playerId: "player-b",
          teamId: "team-b",
          groundPosition: { x: 2.5, y: 0.01 }, // right next to ball
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        },
      ],
      ball: {
        position: { x: 2.5, y: 0, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll" as const,
      },
      controlAssignments: {
        "slot-1": {
          controlSlot: "slot-1",
          teamId: "team-a",
          controlledPlayerId: "player-a",
          mode: "HUMAN" as const,
        },
        "slot-2": {
          controlSlot: "slot-2",
          teamId: "team-b",
          controlledPlayerId: "player-b",
          mode: "HUMAN" as const,
        },
      },
      missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
      maxConsecutiveMissing: 3,
      inputProgram: {},
      scheduledEvents: {},
      requestedMetrics: [],
    };

    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Slot-1 moves in +Y (away from ball).
    // Slot-2 presses FIRST_TOUCH on ball.
    sim.applyInputs([
      {
        tick: 0,
        sourceId: "test",
        controlSlot: "slot-1",
        moveX: 0,
        moveY: 1,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
      {
        tick: 0,
        sourceId: "test",
        controlSlot: "slot-2",
        moveX: 0,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: FIRST_TOUCH_BIT,
        releasedButtons: 0,
      },
    ]);

    let foundTouch = false;
    for (let i = 0; i < 10; i++) {
      const result = sim.step();
      const contactEvents = result.events.filter(
        (e) => e.kind === "player-ball-contact" && (e.payload as Record<string, unknown>)?.playerId === "player-b",
      );
      if (contactEvents.length > 0) {
        foundTouch = true;
        break;
      }
    }

    expect(foundTouch).toBe(true);

    // Player A moved independently in +Y direction.
    const snap = sim.snapshot();
    const playerA = snap.players.find((p) => p.playerId === "player-a")!;
    expect(playerA.groundPosition.y).toBeGreaterThan(0);
  });

  it("slot-2 shot works independently", () => {
    const scenario = {
      id: "two-slot-shot-test",
      version: "1.0.0",
      family: "two-player",
      durationTicks: 60,
      seed: 42,
      prngAlgorithmId: "mulberry32-v1",
      schemaVersion: "state-v1",
      simulationVersion: "sim-v1",
      configVersion: "foundation-config-v1",
      profile: "LABORATORY" as const,
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
        },
        {
          playerId: "player-b",
          teamId: "team-b",
          groundPosition: { x: 2.5, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        },
      ],
      ball: {
        position: { x: 2.5, y: 0, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll" as const,
      },
      controlAssignments: {
        "slot-1": {
          controlSlot: "slot-1",
          teamId: "team-a",
          controlledPlayerId: "player-a",
          mode: "HUMAN" as const,
        },
        "slot-2": {
          controlSlot: "slot-2",
          teamId: "team-b",
          controlledPlayerId: "player-b",
          mode: "HUMAN" as const,
        },
      },
      missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
      maxConsecutiveMissing: 3,
      inputProgram: {},
      scheduledEvents: {},
      requestedMetrics: [],
    };

    const world = createWorld({ scenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    sim.applyInputs([
      {
        tick: 0,
        sourceId: "test",
        controlSlot: "slot-1",
        moveX: 0,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: 0,
        releasedButtons: 0,
      },
      {
        tick: 0,
        sourceId: "test",
        controlSlot: "slot-2",
        moveX: 0,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: SHOT_BIT,
        releasedButtons: 0,
      },
    ]);

    let foundShot = false;
    for (let i = 0; i < 10; i++) {
      const result = sim.step();
      const shotEvents = result.events.filter(
        (e) => e.kind === "shot" && (e.payload as Record<string, unknown>)?.playerId === "player-b",
      );
      if (shotEvents.length > 0) {
        foundShot = true;
        break;
      }
    }

    expect(foundShot).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Determinism: same two-slot input program yields same hashes
// ---------------------------------------------------------------------------

describe("PLAYABLE-SECOND-SLOT-004: deterministic two-slot simulation", () => {
  it("same two-slot input program produces identical hashes", () => {
    function run(): string[] {
      const world = createTwoPlayerWorld();
      const sim = createSimulation(world, NO_OP_OBSERVER);

      // Apply identical two-slot input program for ticks 0-9.
      for (let t = 0; t < 10; t++) {
        sim.applyInputs([
          {
            tick: t,
            sourceId: "test",
            controlSlot: "slot-1",
            moveX: 1,
            moveY: 0,
            sprint: 0,
            heldButtons: 0,
            pressedButtons: 0,
            releasedButtons: 0,
          },
          {
            tick: t,
            sourceId: "test",
            controlSlot: "slot-2",
            moveX: -1,
            moveY: 0,
            sprint: 0,
            heldButtons: 0,
            pressedButtons: 0,
            releasedButtons: 0,
          },
        ]);
      }

      const hashes: string[] = [];
      for (let i = 0; i < 10; i++) {
        sim.step();
        hashes.push(sim.stateHash());
      }
      return hashes;
    }

    const hashesA = run();
    const hashesB = run();

    expect(hashesA.length).toBe(hashesB.length);
    for (let i = 0; i < hashesA.length; i++) {
      expect(hashesA[i]).toBe(hashesB[i]);
    }
  });

  it("different two-slot input programs produce different hashes", () => {
    function run(moveX: number): string[] {
      const world = createTwoPlayerWorld();
      const sim = createSimulation(world, NO_OP_OBSERVER);

      for (let t = 0; t < 5; t++) {
        sim.applyInputs([
          {
            tick: t,
            sourceId: "test",
            controlSlot: "slot-1",
            moveX,
            moveY: 0,
            sprint: 0,
            heldButtons: 0,
            pressedButtons: 0,
            releasedButtons: 0,
          },
          {
            tick: t,
            sourceId: "test",
            controlSlot: "slot-2",
            moveX: -1,
            moveY: 0,
            sprint: 0,
            heldButtons: 0,
            pressedButtons: 0,
            releasedButtons: 0,
          },
        ]);
      }

      const hashes: string[] = [];
      for (let i = 0; i < 5; i++) {
        sim.step();
        hashes.push(sim.stateHash());
      }
      return hashes;
    }

    const hashesA = run(1); // player-a moves +X
    const hashesB = run(0); // player-a stays still

    // At least one hash should differ.
    let differ = false;
    for (let i = 0; i < hashesA.length; i++) {
      if (hashesA[i] !== hashesB[i]) {
        differ = true;
        break;
      }
    }
    expect(differ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. One-player foundation scenario still works unchanged
// ---------------------------------------------------------------------------

describe("PLAYABLE-SECOND-SLOT-005: existing one-player scenario still works", () => {
  it("foundation scenario with one slot still runs correctly", () => {
    const foundationScenario = {
      id: "foundation-move-and-roll-v1",
      version: "1.0.0",
      family: "bootstrap",
      durationTicks: 60,
      seed: 42,
      prngAlgorithmId: "mulberry32-v1",
      schemaVersion: "state-v1",
      simulationVersion: "sim-v1",
      configVersion: "foundation-config-v1",
      profile: "LABORATORY" as const,
      pitchLength: 105,
      pitchWidth: 68,
      safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
      players: [
        {
          playerId: "stable-player-1",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        },
      ],
      ball: {
        position: { x: 0.05, y: 0.02, z: 0.11 },
        linearVelocity: { x: 0.3, y: 0.1, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0.5 },
        regime: "ground-roll" as const,
      },
      controlAssignments: {
        "slot-1": {
          controlSlot: "slot-1",
          teamId: "team-a",
          controlledPlayerId: "stable-player-1",
          mode: "HUMAN" as const,
        },
      },
      missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
      maxConsecutiveMissing: 3,
      inputProgram: {
        "0": [
          {
            tick: 0,
            sourceId: "test-input",
            controlSlot: "slot-1",
            moveX: 0.5,
            moveY: 0,
            sprint: 0,
            heldButtons: 0,
            pressedButtons: 0,
            releasedButtons: 0,
          },
        ],
      },
      scheduledEvents: {},
      requestedMetrics: [],
    };

    const world = createWorld({ scenario: foundationScenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Run the scenario as-is.
    for (let i = 0; i < 60; i++) {
      sim.step();
    }

    const snap = sim.snapshot();
    // Foundation scenario has one player on team-a.
    expect(snap.players.length).toBe(1);
    expect(snap.players[0].teamId).toBe("team-a");
    // Only slot-1 assignment exists.
    expect(snap.controlAssignments["slot-1"]).toBeDefined();
    expect(snap.controlAssignments["slot-2"]).toBeUndefined();
  });

  it("foundation scenario is not broken by the two-player scenario file", () => {
    const foundationScenario = {
      id: "foundation-move-and-roll-v1",
      version: "1.0.0",
      family: "bootstrap",
      durationTicks: 60,
      seed: 42,
      prngAlgorithmId: "mulberry32-v1",
      schemaVersion: "state-v1",
      simulationVersion: "sim-v1",
      configVersion: "foundation-config-v1",
      profile: "LABORATORY" as const,
      pitchLength: 105,
      pitchWidth: 68,
      safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
      players: [
        {
          playerId: "stable-player-1",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        },
      ],
      ball: {
        position: { x: 0.05, y: 0.02, z: 0.11 },
        linearVelocity: { x: 0.3, y: 0.1, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0.5 },
        regime: "ground-roll" as const,
      },
      controlAssignments: {
        "slot-1": {
          controlSlot: "slot-1",
          teamId: "team-a",
          controlledPlayerId: "stable-player-1",
          mode: "HUMAN" as const,
        },
      },
      missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
      maxConsecutiveMissing: 3,
      inputProgram: {
        "0": [
          {
            tick: 0,
            sourceId: "test-input",
            controlSlot: "slot-1",
            moveX: 0.5,
            moveY: 0,
            sprint: 0,
            heldButtons: 0,
            pressedButtons: 0,
            releasedButtons: 0,
          },
        ],
      },
      scheduledEvents: {},
      requestedMetrics: [],
    };

    const world = createWorld({ scenario: foundationScenario });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Apply movement input for all 10 ticks.
    for (let i = 0; i < 10; i++) {
      sim.applyInputs([
        {
          tick: i,
          sourceId: "test",
          controlSlot: "slot-1",
          moveX: 0.5,
          moveY: 0,
          sprint: 0,
          heldButtons: 0,
          pressedButtons: 0,
          releasedButtons: 0,
        },
      ]);
      sim.step();
    }

    const snap = sim.snapshot();
    expect(snap.players.length).toBe(1);
    expect(snap.players[0].groundPosition.x).toBeGreaterThan(0);
  });
});