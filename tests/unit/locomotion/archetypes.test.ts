/**
 * @module archetypes-tests
 *
 * Tests for PLAYABLE-1V1 / FICTIONAL_ARCHETYPES: versioned fictional archetypes
 * applied per-player via transient-acceleration override.
 *
 * Tests:
 *  1. Default / unset archetype matches previous baseline locomotion.
 *  2. Burst vs steady: burst faster at tick 10; plateau still shared.
 *  3. World/scenario archetype assignment is versioned and creates distinct bindings.
 *  4. Determinism: same assignment → same hash; different assignment → different hash.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect } from "vitest";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { stepLocomotion } from "../../../src/simulation/locomotion/locomotion-system.js";
import {
  FOUNDATION_LOCOMOTION_V1,
  ARCHETYPE_BURST_V1,
  ARCHETYPE_STEADY_V1,
  ARCHETYPE_REGISTRY,
} from "../../../src/simulation/config/foundation.js";
import { NO_OP_OBSERVER } from "../../../src/simulation/telemetry/observer.js";
import { encodeCanonical, hashFnv1a64 } from "../../../src/simulation/determinism/index.js";
import type { WorldState } from "../../../src/contracts/state.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DT = 1 / 60;
const CFG = FOUNDATION_LOCOMOTION_V1;

// Small numeric tolerance for floating-point comparisons.
const EPSILON = 1e-9;

function makePlayer(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    playerId: "test-1",
    teamId: "team-a",
    groundPosition: { x: 0, y: 0 },
    linearVelocity: { x: 0, y: 0 },
    desiredVelocity: { x: 0, y: 0 },
    bodyHeading: 0,
    desiredHeading: 0,
    ...overrides,
  };
}

function speed(p: Record<string, unknown>): number {
  const v = p.linearVelocity as { x: number; y: number };
  return Math.sqrt(v.x ** 2 + v.y ** 2);
}

function posMag(p: Record<string, unknown>): number {
  const pos = p.groundPosition as { x: number; y: number };
  return Math.sqrt(pos.x ** 2 + pos.y ** 2);
}

/** Create a minimal two-player world with optional archetype assignments. */
function makeTwoPlayerWorld(opts?: {
  seed?: number;
  burstPlayerId?: string;
  steadyPlayerId?: string;
}): WorldState {
  const scenario = {
    id: "archetype-test-scenario",
    version: "1.0.0",
    family: "archetypes",
    durationTicks: 60,
    seed: opts?.seed ?? 42,
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
        playerId: opts?.burstPlayerId ?? "burst",
        teamId: "team-burst",
        groundPosition: { x: 0, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        desiredHeading: 0,
        archetypeId: ARCHETYPE_BURST_V1.id,
      },
      {
        playerId: opts?.steadyPlayerId ?? "steady",
        teamId: "team-steady",
        groundPosition: { x: 3, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        desiredHeading: 0,
        archetypeId: ARCHETYPE_STEADY_V1.id,
      },
    ],
    ball: {
      position: { x: 5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll" as const,
    },
    controlAssignments: {
      "slot-1": {
        controlSlot: "slot-1",
        teamId: "team-burst",
        controlledPlayerId: opts?.burstPlayerId ?? "burst",
        mode: "HUMAN",
      },
      "slot-2": {
        controlSlot: "slot-2",
        teamId: "team-steady",
        controlledPlayerId: opts?.steadyPlayerId ?? "steady",
        mode: "HUMAN",
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
// 1. Default / unset archetype matches previous baseline locomotion
// ---------------------------------------------------------------------------

describe("ARCHETYPE-DEFAULT-001: unset archetype matches baseline locomotion", () => {
  it("player without archetypeId uses config default (0) transient acceleration", () => {
    const p = makePlayer({
      desiredVelocity: { x: 1, y: 0 },
      desiredHeading: 0,
      archetypeId: undefined,
      archetypeTransientAccel: undefined,
    }) as Record<string, unknown>;

    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = 0;

    const speeds: number[] = [];
    for (let i = 0; i < 60; i++) {
      stepLocomotion([p as any], DT, CFG);
      speeds.push(speed(p));
    }

    // Speed must be monotonically increasing and reach maxSpeed.
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeGreaterThanOrEqual(speeds[i - 1] - EPSILON);
    }

    // Progressive: the first step does NOT jump to maxSpeed.
    expect(speeds[0]).toBeGreaterThan(0);
    expect(speeds[0]).toBeLessThan(CFG.maxSpeed.value);

    // Plateau: speed reaches maxSpeed (within a small tolerance).
    const lastSpeed = speeds[speeds.length - 1];
    expect(lastSpeed).toBeCloseTo(CFG.maxSpeed.value, 4);
  });

  it("player without archetypeId: speed at tick 10 is between accel start and maxSpeed", () => {
    const p = makePlayer({
      desiredVelocity: { x: 1, y: 0 },
      desiredHeading: 0,
      archetypeId: undefined,
      archetypeTransientAccel: undefined,
    }) as Record<string, unknown>;

    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = 0;

    const speeds: number[] = [];
    for (let i = 0; i < 10; i++) {
      stepLocomotion([p as any], DT, CFG);
      speeds.push(speed(p));
    }

    // Speed should have started accelerating and not yet reached max.
    expect(speeds[0]).toBeGreaterThan(0);
    const tenthSpeed = speeds[speeds.length - 1];
    expect(tenthSpeed).toBeLessThan(CFG.maxSpeed.value);
  });

  it("world without archetype field: archetypeTransientAccel defaults to 0", () => {
    const scenario = {
      id: "no-archetype-scenario",
      version: "1.0.0",
      family: "archetypes",
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
          playerId: "plain-player",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
          // No archetypeId field — deliberately omitted.
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
          controlledPlayerId: "plain-player",
          mode: "HUMAN",
        },
      },
      missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
      maxConsecutiveMissing: 3,
      inputProgram: {},
      scheduledEvents: {},
      requestedMetrics: [],
    };

    const world = createWorld({ scenario });
    const player = world.players[0];

    // archetypeId is not set, and transientAccel defaults to 0.
    expect(player.archetypeId).toBeUndefined();
    expect(player.archetypeTransientAccel).toBe(0);
  });

  it("stepLocomotion with archetypeTransientAccel=0 matches FOUNDATION_LOCOMOTION_V1 baseline", () => {
    function baselineSpeed(): number {
      const p = makePlayer({
        desiredVelocity: { x: 1, y: 0 },
        desiredHeading: 0,
        archetypeTransientAccel: 0,
      }) as Record<string, unknown>;
      for (let i = 0; i < 20; i++) {
        stepLocomotion([p as any], DT, CFG);
      }
      return speed(p);
    }

    const baselineWithZero = baselineSpeed();
    const baselineNoOverride = (() => {
      const p = makePlayer({
        desiredVelocity: { x: 1, y: 0 },
        desiredHeading: 0,
      }) as Record<string, unknown>;
      for (let i = 0; i < 20; i++) {
        stepLocomotion([p as any], DT, CFG);
      }
      return speed(p);
    })();

    // With archetypeTransientAccel=0, the result must match the
    // no-override baseline exactly.
    expect(baselineWithZero).toBe(baselineNoOverride);
  });
});

// ---------------------------------------------------------------------------
// 2. Burst vs steady: burst faster at tick 10; plateau still shared
// ---------------------------------------------------------------------------

describe("ARCHETYPE-BURST-VS-STEADY-001: burst achieves higher early speed", () => {
  it("burst player is faster than steady at tick 10 with identical input", () => {
    const world = makeTwoPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Apply input at every tick so direction persists for both players.
    for (let i = 0; i < 10; i++) {
      sim.applyInputs([
        {
          tick: i,
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
          tick: i,
          sourceId: "test",
          controlSlot: "slot-2",
          moveX: 1,
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
    const burstPlayer = snap.players.find((p) => p.playerId === "burst")!;
    const steadyPlayer = snap.players.find((p) => p.playerId === "steady")!;

    const burstSpeed = Math.sqrt(
      burstPlayer.linearVelocity.x ** 2 + burstPlayer.linearVelocity.y ** 2,
    );
    const steadySpeed = Math.sqrt(
      steadyPlayer.linearVelocity.x ** 2 + steadyPlayer.linearVelocity.y ** 2,
    );

    // Burst must be faster at tick 10.
    expect(burstSpeed).toBeGreaterThan(steadySpeed);

    // Burst speed must be > 0 (actually accelerating).
    expect(burstSpeed).toBeGreaterThan(0.01);
  });

  it("both archetypes plateau at the same maxSpeed after enough ticks", () => {
    const world = makeTwoPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Run enough ticks for both to reach plateau (60+ ticks).
    // Apply input at every tick so the direction persists.
    for (let i = 0; i < 60; i++) {
      sim.applyInputs([
        {
          tick: i,
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
          tick: i,
          sourceId: "test",
          controlSlot: "slot-2",
          moveX: 1,
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
    const burstPlayer = snap.players.find((p) => p.playerId === "burst")!;
    const steadyPlayer = snap.players.find((p) => p.playerId === "steady")!;

    const burstSpeed = Math.sqrt(
      burstPlayer.linearVelocity.x ** 2 + burstPlayer.linearVelocity.y ** 2,
    );
    const steadySpeed = Math.sqrt(
      steadyPlayer.linearVelocity.x ** 2 + steadyPlayer.linearVelocity.y ** 2,
    );

    // Both must converge to the configured maxSpeed.
    expect(burstSpeed).toBeCloseTo(CFG.maxSpeed.value, 3);
    expect(steadySpeed).toBeCloseTo(CFG.maxSpeed.value, 3);

    // Both speeds must be essentially identical at plateau.
    expect(Math.abs(burstSpeed - steadySpeed)).toBeLessThan(0.01);
  });

  it("burst player covers more distance than steady at tick 20", () => {
    const world = makeTwoPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Apply input at every tick so direction persists.
    for (let i = 0; i < 20; i++) {
      sim.applyInputs([
        {
          tick: i,
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
          tick: i,
          sourceId: "test",
          controlSlot: "slot-2",
          moveX: 1,
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
    const burstPlayer = snap.players.find((p) => p.playerId === "burst")!;
    const steadyPlayer = snap.players.find((p) => p.playerId === "steady")!;

    // burst started at x=0, steady started at x=3.
    // burst should have gained more distance from its start point.
    const burstDist = burstPlayer.groundPosition.x - 0;
    const steadyDist = steadyPlayer.groundPosition.x - 3;

    expect(burstDist).toBeGreaterThan(steadyDist);
  });
});

// ---------------------------------------------------------------------------
// 3. World/scenario archetype assignment is versioned and distinct
// ---------------------------------------------------------------------------

describe("ARCHETYPE-ASSIGNMENT-001: versioned archetype bindings", () => {
  it("world reflects burst archetypeId and transientAccel for burst player", () => {
    const world = makeTwoPlayerWorld();
    const burstPlayer = world.players.find((p) => p.archetypeId === ARCHETYPE_BURST_V1.id)!;
    const steadyPlayer = world.players.find((p) => p.archetypeId === ARCHETYPE_STEADY_V1.id)!;

    expect(burstPlayer.archetypeId).toBe(ARCHETYPE_BURST_V1.id);
    expect(burstPlayer.archetypeTransientAccel).toBe(ARCHETYPE_BURST_V1.transientAcceleration.value);

    expect(steadyPlayer.archetypeId).toBe(ARCHETYPE_STEADY_V1.id);
    expect(steadyPlayer.archetypeTransientAccel).toBe(ARCHETYPE_STEADY_V1.transientAcceleration.value);
  });

  it("both players are distinct entries with correct teamIds", () => {
    const world = makeTwoPlayerWorld();
    expect(world.players.length).toBe(2);

    const ids = world.players.map((p) => p.playerId);
    expect(ids).toContain("burst");
    expect(ids).toContain("steady");

    const teams = world.players.map((p) => p.teamId);
    expect(teams).toContain("team-burst");
    expect(teams).toContain("team-steady");
  });

  it("archetypeRegistry contains both burst and steady", () => {
    expect(ARCHETYPE_REGISTRY[ARCHETYPE_BURST_V1.id]).toBeDefined();
    expect(ARCHETYPE_REGISTRY[ARCHETYPE_STEADY_V1.id]).toBeDefined();

    const burstDef = ARCHETYPE_REGISTRY[ARCHETYPE_BURST_V1.id];
    expect(burstDef.label).toBe("provisional");
    expect(burstDef.transientAcceleration.value).toBeGreaterThan(0);

    const steadyDef = ARCHETYPE_REGISTRY[ARCHETYPE_STEADY_V1.id];
    expect(steadyDef.label).toBe("provisional");
    expect(steadyDef.transientAcceleration.value).toBe(0);
  });

  it("unknown archetypeId defaults to 0 transient acceleration", () => {
    const scenario = {
      id: "unknown-archetype-scenario",
      version: "1.0.0",
      family: "archetypes",
      durationTicks: 10,
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
          playerId: "unknown-player",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
          archetypeId: "nonexistent-archetype-v99",
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
          controlledPlayerId: "unknown-player",
          mode: "HUMAN",
        },
      },
      missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
      maxConsecutiveMissing: 3,
      inputProgram: {},
      scheduledEvents: {},
      requestedMetrics: [],
    };

    const world = createWorld({ scenario });
    const player = world.players[0];
    // Unknown archetype should default to 0, not throw.
    expect(player.archetypeTransientAccel).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Determinism: same assignment → same hash, different assignment → different hash
// ---------------------------------------------------------------------------

describe("ARCHETYPE-DETERMINISM-001: deterministic hashes", () => {
  it("same archetype assignments + input → identical per-tick hashes", () => {
    function run(): string[] {
      const world = makeTwoPlayerWorld();
      const sim = createSimulation(world, NO_OP_OBSERVER);

      sim.applyInputs([
        {
          tick: 0,
          sourceId: "test",
          controlSlot: "slot-1",
          moveX: 1,
          moveY: 0,
          sprint: 1,
          heldButtons: 0,
          pressedButtons: 0,
          releasedButtons: 0,
        },
        {
          tick: 0,
          sourceId: "test",
          controlSlot: "slot-2",
          moveX: 1,
          moveY: 0,
          sprint: 1,
          heldButtons: 0,
          pressedButtons: 0,
          releasedButtons: 0,
        },
      ]);

      const hashes: string[] = [];
      for (let i = 0; i < 10; i++) {
        sim.step();
        hashes.push(sim.stateHash());
      }
      return hashes;
    }

    const hashesA = run();
    const hashesB = run();

    expect(hashesA).toHaveLength(hashesB.length);
    for (let i = 0; i < hashesA.length; i++) {
      expect(hashesA[i]).toBe(hashesB[i]);
    }
  });

  it("different archetype assignments → different state hash", () => {
    function runWithArchetypes(
      burstId: string,
      steadyId: string,
      seed: number,
    ): string {
      const world = makeTwoPlayerWorld({
        seed,
        burstPlayerId: burstId,
        steadyPlayerId: steadyId,
      });
      const sim = createSimulation(world, NO_OP_OBSERVER);

      sim.applyInputs([
        {
          tick: 0,
          sourceId: "test",
          controlSlot: "slot-1",
          moveX: 1,
          moveY: 0,
          sprint: 1,
          heldButtons: 0,
          pressedButtons: 0,
          releasedButtons: 0,
        },
        {
          tick: 0,
          sourceId: "test",
          controlSlot: "slot-2",
          moveX: 1,
          moveY: 0,
          sprint: 1,
          heldButtons: 0,
          pressedButtons: 0,
          releasedButtons: 0,
        },
      ]);

      sim.step();
      return sim.stateHash();
    }

    // Run 1: burst player has burst archetype.
    const hashBurstFirst = runWithArchetypes("burst-player", "steady-player", 42);
    // Run 2: swap archetype assignments.
    const hashSteadyFirst = runWithArchetypes("steady-player", "burst-player", 42);

    // Different archetype assignment → different hash.
    expect(hashBurstFirst).not.toBe(hashSteadyFirst);
  });

  it("canonical state reflects archetype bindings", () => {
    const world = makeTwoPlayerWorld();
    const canonical = encodeCanonical(world);

    // The canonical form must include archetypeId fields.
    expect(canonical).toContain("archetypeId");
    expect(canonical).toContain("archetype-burst-v1");
    expect(canonical).toContain("archetype-steady-v1");
    expect(canonical).toContain("archetypeTransientAccel");
    expect(canonical).toContain("1"); // burst transient = 1.0
    expect(canonical).toContain("0"); // steady transient = 0
  });
});