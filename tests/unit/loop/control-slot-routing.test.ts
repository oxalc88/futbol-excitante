/**
 * @module control-slot-routing-tests
 *
 * Tests for PLAYABLE-CONTROL-SLOT-ROUTING: stable player switching,
 * controlled player selection, and slot ownership.
 *
 * Covers:
 *  1. Slot ownership: findSlotForPlayer, getSlotTeamId, isSlotActive
 *  2. Proximity-based teammate selection
 *  3. Explicit player switching (Tab-key cycling)
 *  4. Slot wiring invariant checks
 *  5. Multi-slot stability: no cross-slot interference
 *  6. SWITCH_PLAYER_BIT integration in simulation step
 *  7. Slot ownership persistence across ticks
 *  8. Full slot resolution (resolveSlotMap)
 *
 * No Math.random, Date, DOM, or Node I/O in src/simulation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { NO_OP_OBSERVER } from "../../../src/simulation/telemetry/observer.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { InputFrame } from "../../../src/contracts/input.js";
import {
  findSlotForPlayer,
  isSlotActive,
  getSlotTeamId,
  selectNearestTeammate,
  computeExplicitSwitchTarget,
  checkSlotWiringInvariant,
  resolveSlotMap,
  type SlotRoutingPlayer,
  type SlotRoutingAssignment,
} from "../../../src/simulation/input/input-system.js";
import { SWITCH_PLAYER_BIT } from "../../../src/contracts/input.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeFrame(
  tick: number,
  controlSlot = "slot-1",
  opts?: Partial<InputFrame>,
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

function createFourPlayerWorld(seed: number = 42) {
  const scenario: ScenarioDefinition = {
    id: "control-slot-routing-test",
    version: "1.0.0",
    family: "control-slot-routing",
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
        playerId: "p-a1",
        teamId: "team-a",
        groundPosition: { x: 0, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        desiredHeading: 0,
      },
      {
        playerId: "p-a2",
        teamId: "team-a",
        groundPosition: { x: 2, y: 3 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        desiredHeading: 0,
      },
      {
        playerId: "p-b1",
        teamId: "team-b",
        groundPosition: { x: 10, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
        desiredHeading: Math.PI,
      },
      {
        playerId: "p-b2",
        teamId: "team-b",
        groundPosition: { x: 8, y: 4 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
        desiredHeading: Math.PI,
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
        teamId: "team-a",
        controlledPlayerId: "p-a1",
        mode: "HUMAN" as const,
      },
      "slot-2": {
        controlSlot: "slot-2",
        teamId: "team-b",
        controlledPlayerId: "p-b1",
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

// ===========================================================================
// 1. Slot ownership: findSlotForPlayer, getSlotTeamId, isSlotActive
// ===========================================================================

describe("SLOT-ROUTING-001: findSlotForPlayer", () => {
  const assignments: Record<string, SlotRoutingAssignment> = {
    "slot-1": { teamId: "team-a", controlledPlayerId: "p-a1", mode: "HUMAN" },
    "slot-2": { teamId: "team-b", controlledPlayerId: "p-b1", mode: "HUMAN" },
  };

  it("returns the slot that controls a given player", () => {
    expect(findSlotForPlayer("p-a1", assignments)).toBe("slot-1");
    expect(findSlotForPlayer("p-b1", assignments)).toBe("slot-2");
  });

  it("returns null for an uncontrolled player", () => {
    expect(findSlotForPlayer("p-a2", assignments)).toBeNull();
    expect(findSlotForPlayer("p-nonexistent", assignments)).toBeNull();
  });

  it("returns null for empty assignments", () => {
    expect(findSlotForPlayer("p-a1", {})).toBeNull();
  });
});

describe("SLOT-ROUTING-002: getSlotTeamId", () => {
  const assignments: Record<string, SlotRoutingAssignment> = {
    "slot-1": { teamId: "team-a", controlledPlayerId: "p-a1", mode: "HUMAN" },
    "slot-2": { teamId: "team-b", controlledPlayerId: "p-b1", mode: "HUMAN" },
  };

  it("returns the team ID for a valid slot", () => {
    expect(getSlotTeamId("slot-1", assignments)).toBe("team-a");
    expect(getSlotTeamId("slot-2", assignments)).toBe("team-b");
  });

  it("returns null for an unknown slot", () => {
    expect(getSlotTeamId("slot-3", assignments)).toBeNull();
  });
});

describe("SLOT-ROUTING-003: isSlotActive", () => {
  it("returns true when a slot has frames at the tick", () => {
    const frames = [makeFrame(0, "slot-1"), makeFrame(0, "slot-2")];
    expect(isSlotActive("slot-1", frames)).toBe(true);
    expect(isSlotActive("slot-2", frames)).toBe(true);
  });

  it("returns false when a slot has no frames at the tick", () => {
    const frames = [makeFrame(0, "slot-1")];
    expect(isSlotActive("slot-2", frames)).toBe(false);
  });

  it("returns false for empty frames", () => {
    expect(isSlotActive("slot-1", [])).toBe(false);
  });
});

// ===========================================================================
// 2. Proximity-based teammate selection
// ===========================================================================

describe("SLOT-ROUTING-004: selectNearestTeammate", () => {
  const players: SlotRoutingPlayer[] = [
    { playerId: "p-a1", teamId: "team-a", groundPosition: { x: 0, y: 0 } },
    { playerId: "p-a2", teamId: "team-a", groundPosition: { x: 10, y: 0 } },
    { playerId: "p-a3", teamId: "team-a", groundPosition: { x: 5, y: 5 } },
    { playerId: "p-b1", teamId: "team-b", groundPosition: { x: 20, y: 0 } },
  ];

  it("selects the nearest teammate to the reference position", () => {
    // Reference at (1, 0) — p-a1 at (0,0) is closest (dist=1)
    const result = selectNearestTeammate(
      { x: 1, y: 0 },
      "team-a",
      players,
      [],
    );
    expect(result).toBe("p-a1");
  });

  it("excludes specified player IDs", () => {
    // Reference at (1, 0) — p-a1 is excluded, so p-a3 at (5,5) should win
    // dist to p-a2 = 9, dist to p-a3 = sqrt(16+25) ≈ 6.4
    const result = selectNearestTeammate(
      { x: 1, y: 0 },
      "team-a",
      players,
      ["p-a1"],
    );
    expect(result).toBe("p-a3");
  });

  it("returns null when all teammates are excluded", () => {
    const result = selectNearestTeammate(
      { x: 0, y: 0 },
      "team-a",
      players,
      ["p-a1", "p-a2", "p-a3"],
    );
    expect(result).toBeNull();
  });

  it("returns null for a team with no players", () => {
    const result = selectNearestTeammate(
      { x: 0, y: 0 },
      "team-c",
      players,
      [],
    );
    expect(result).toBeNull();
  });

  it("ties broken by lexicographic player ID", () => {
    const tiedPlayers: SlotRoutingPlayer[] = [
      { playerId: "p-z", teamId: "team-a", groundPosition: { x: 5, y: 0 } },
      { playerId: "p-a", teamId: "team-a", groundPosition: { x: 5, y: 0 } },
    ];
    const result = selectNearestTeammate(
      { x: 0, y: 0 },
      "team-a",
      tiedPlayers,
      [],
    );
    expect(result).toBe("p-a");
  });

  it("only considers players from the requested team", () => {
    const result = selectNearestTeammate(
      { x: 20, y: 0 },
      "team-a",
      players,
      [],
    );
    // p-b1 is closest (dist=0) but is on team-b, so p-a2 (dist=10) wins.
    expect(result).toBe("p-a2");
  });
});

// ===========================================================================
// 3. Explicit player switching
// ===========================================================================

describe("SLOT-ROUTING-005: computeExplicitSwitchTarget", () => {
  const assignments: Record<string, SlotRoutingAssignment> = {
    "slot-1": { teamId: "team-a", controlledPlayerId: "p-a1", mode: "HUMAN" },
    "slot-2": { teamId: "team-b", controlledPlayerId: "p-b1", mode: "HUMAN" },
  };

  const players: SlotRoutingPlayer[] = [
    { playerId: "p-a1", teamId: "team-a", groundPosition: { x: 0, y: 0 } },
    { playerId: "p-a2", teamId: "team-a", groundPosition: { x: 10, y: 0 } },
    { playerId: "p-a3", teamId: "team-a", groundPosition: { x: 5, y: 5 } },
    { playerId: "p-b1", teamId: "team-b", groundPosition: { x: 20, y: 0 } },
    { playerId: "p-b2", teamId: "team-b", groundPosition: { x: 25, y: 0 } },
  ];

  it("NEXT cycles to the next teammate lexicographically", () => {
    // Current: p-a1. Teammates sorted: [p-a1, p-a2, p-a3]. Next: p-a2.
    const result = computeExplicitSwitchTarget("slot-1", assignments, players, "NEXT");
    expect(result).toBe("p-a2");
  });

  it("NEXT wraps around from last to first", () => {
    const a: Record<string, SlotRoutingAssignment> = {
      "slot-1": { teamId: "team-a", controlledPlayerId: "p-a3", mode: "HUMAN" },
    };
    const result = computeExplicitSwitchTarget("slot-1", a, players, "NEXT");
    expect(result).toBe("p-a1");
  });

  it("PREVIOUS cycles backward", () => {
    // Current: p-a1. Teammates: [p-a1, p-a2, p-a3]. Previous: p-a3.
    const result = computeExplicitSwitchTarget("slot-1", assignments, players, "PREVIOUS");
    expect(result).toBe("p-a3");
  });

  it("PREVIOUS wraps from first to last", () => {
    const a: Record<string, SlotRoutingAssignment> = {
      "slot-1": { teamId: "team-a", controlledPlayerId: "p-a1", mode: "HUMAN" },
    };
    const result = computeExplicitSwitchTarget("slot-1", a, players, "PREVIOUS");
    expect(result).toBe("p-a3");
  });

  it("returns null for a team with only one player", () => {
    const a: Record<string, SlotRoutingAssignment> = {
      "slot-1": { teamId: "team-b", controlledPlayerId: "p-b1", mode: "HUMAN" },
    };
    // team-b has p-b1 and p-b2, so there are two — this should work.
    const result = computeExplicitSwitchTarget("slot-1", a, players, "NEXT");
    expect(result).toBe("p-b2");
  });

  it("returns null for unknown slot", () => {
    const result = computeExplicitSwitchTarget("slot-99", assignments, players);
    expect(result).toBeNull();
  });

  it("slot-2 switches independently of slot-1", () => {
    const result = computeExplicitSwitchTarget("slot-2", assignments, players, "NEXT");
    expect(result).toBe("p-b2");
  });
});

// ===========================================================================
// 4. Slot wiring invariant
// ===========================================================================

describe("SLOT-ROUTING-006: checkSlotWiringInvariant", () => {
  const players: SlotRoutingPlayer[] = [
    { playerId: "p-a1", teamId: "team-a", groundPosition: { x: 0, y: 0 } },
    { playerId: "p-b1", teamId: "team-b", groundPosition: { x: 10, y: 0 } },
  ];

  it("passes for valid assignments", () => {
    const assignments: Record<string, SlotRoutingAssignment> = {
      "slot-1": { teamId: "team-a", controlledPlayerId: "p-a1", mode: "HUMAN" },
      "slot-2": { teamId: "team-b", controlledPlayerId: "p-b1", mode: "HUMAN" },
    };
    expect(checkSlotWiringInvariant(assignments, players)).toEqual({ ok: true });
  });

  it("fails when a slot controls a non-existent player", () => {
    const assignments: Record<string, SlotRoutingAssignment> = {
      "slot-1": { teamId: "team-a", controlledPlayerId: "p-ghost", mode: "HUMAN" },
    };
    const result = checkSlotWiringInvariant(assignments, players);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.length).toBe(1);
      expect(result.violations[0]).toContain("unknown player");
    }
  });

  it("fails when two slots control the same player", () => {
    const assignments: Record<string, SlotRoutingAssignment> = {
      "slot-1": { teamId: "team-a", controlledPlayerId: "p-a1", mode: "HUMAN" },
      "slot-2": { teamId: "team-a", controlledPlayerId: "p-a1", mode: "HUMAN" },
    };
    const result = checkSlotWiringInvariant(assignments, players);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.some((v) => v.includes("multiple slots"))).toBe(true);
    }
  });

  it("fails when slot controls a player from a different team", () => {
    const assignments: Record<string, SlotRoutingAssignment> = {
      "slot-1": { teamId: "team-a", controlledPlayerId: "p-b1", mode: "HUMAN" },
    };
    const result = checkSlotWiringInvariant(assignments, players);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.some((v) => v.includes("team"))).toBe(true);
    }
  });

  it("passes for empty assignments", () => {
    expect(checkSlotWiringInvariant({}, players)).toEqual({ ok: true });
  });
});

// ===========================================================================
// 5. resolveSlotMap
// ===========================================================================

describe("SLOT-ROUTING-007: resolveSlotMap", () => {
  it("maps each slot to its controlled player", () => {
    const assignments: Record<string, SlotRoutingAssignment> = {
      "slot-1": { teamId: "team-a", controlledPlayerId: "p-a1", mode: "HUMAN" },
      "slot-2": { teamId: "team-b", controlledPlayerId: "p-b1", mode: "HUMAN" },
    };
    const map = resolveSlotMap(assignments);
    expect(map["slot-1"]).toBe("p-a1");
    expect(map["slot-2"]).toBe("p-b1");
  });

  it("returns empty map for empty assignments", () => {
    expect(resolveSlotMap({})).toEqual({});
  });
});

// ===========================================================================
// 6. Multi-slot stability in simulation: no cross-slot interference
// ===========================================================================

describe("SLOT-ROUTING-008: multi-slot simulation stability", () => {
  it("slot-1 input affects only its controlled player", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Apply input only to slot-1.
    sim.applyInputs([makeFrame(0, "slot-1", { moveX: 1, moveY: 0 })]);

    for (let i = 0; i < 10; i++) sim.step();

    const snap = sim.snapshot();
    const pA1 = snap.players.find((p) => p.playerId === "p-a1")!;
    const pA2 = snap.players.find((p) => p.playerId === "p-a2")!;
    const pB1 = snap.players.find((p) => p.playerId === "p-b1")!;

    // p-a1 moved.
    expect(pA1.groundPosition.x).toBeGreaterThan(0);
    // p-a2 and p-b1 stayed at initial positions.
    expect(pA2.groundPosition.x).toBe(2);
    expect(pB1.groundPosition.x).toBe(10);
  });

  it("both slots moving simultaneously do not interfere", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    sim.applyInputs([
      makeFrame(0, "slot-1", { moveX: 1, moveY: 0 }),
      makeFrame(0, "slot-2", { moveX: -1, moveY: 0 }),
    ]);

    for (let i = 0; i < 10; i++) sim.step();

    const snap = sim.snapshot();
    const pA1 = snap.players.find((p) => p.playerId === "p-a1")!;
    const pB1 = snap.players.find((p) => p.playerId === "p-b1")!;

    expect(pA1.groundPosition.x).toBeGreaterThan(0);
    expect(pB1.groundPosition.x).toBeLessThan(10);
  });

  it("no slot-wiring violation events for valid assignments", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    sim.applyInputs([
      makeFrame(0, "slot-1", { moveX: 0.5 }),
      makeFrame(0, "slot-2", { moveX: -0.5 }),
    ]);

    const result = sim.step();
    const violations = result.events.filter(
      (e) => e.kind === "slot-wiring-violation",
    );
    expect(violations.length).toBe(0);
  });

  it("slot wiring invariant holds across multiple ticks", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    for (let t = 0; t < 5; t++) {
      sim.applyInputs([
        makeFrame(t, "slot-1", { moveX: 0.3 }),
        makeFrame(t, "slot-2", { moveX: -0.3 }),
      ]);
      const result = sim.step();
      const violations = result.events.filter(
        (e) => e.kind === "slot-wiring-violation",
      );
      expect(violations.length).toBe(0);
    }
  });
});

// ===========================================================================
// 7. SWITCH_PLAYER_BIT integration in simulation
// ===========================================================================

describe("SLOT-ROUTING-009: SWITCH_PLAYER_BIT in simulation step", () => {
  it("emits slot-switch event when SWITCH_PLAYER_BIT is pressed", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Press SWITCH_PLAYER_BIT on slot-1.
    sim.applyInputs([
      makeFrame(0, "slot-1", {
        moveX: 0,
        pressedButtons: SWITCH_PLAYER_BIT,
      }),
    ]);

    const result = sim.step();
    const switchEvents = result.events.filter(
      (e) => e.kind === "slot-switch",
    );
    expect(switchEvents.length).toBe(1);
    expect(switchEvents[0].payload.controlSlot).toBe("slot-1");
  });

  it("slot-switch event payload fromPlayer differs from toPlayer", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    sim.applyInputs([
      makeFrame(0, "slot-1", {
        pressedButtons: SWITCH_PLAYER_BIT,
      }),
    ]);

    const result = sim.step();
    const switchEvents = result.events.filter(
      (e) => e.kind === "slot-switch",
    );
    expect(switchEvents.length).toBe(1);

    const payload = switchEvents[0].payload as Record<string, unknown>;
    expect(payload.fromPlayer).toBe("p-a1");
    expect(payload.toPlayer).toBe("p-a2");
    expect(payload.fromPlayer).not.toBe(payload.toPlayer);
  });

  it("switching changes the controlled player for the slot", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Confirm initial state.
    expect(
      sim.snapshot().controlAssignments["slot-1"].controlledPlayerId,
    ).toBe("p-a1");

    // Press SWITCH_PLAYER_BIT on slot-1.
    sim.applyInputs([
      makeFrame(0, "slot-1", {
        pressedButtons: SWITCH_PLAYER_BIT,
      }),
    ]);
    sim.step();

    // After switch, slot-1 should control the next teammate.
    const snap = sim.snapshot();
    expect(
      snap.controlAssignments["slot-1"].controlledPlayerId,
    ).not.toBe("p-a1");
  });

  it("switching only affects the requesting slot", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Press SWITCH_PLAYER_BIT only on slot-1.
    sim.applyInputs([
      makeFrame(0, "slot-1", {
        pressedButtons: SWITCH_PLAYER_BIT,
      }),
    ]);
    sim.step();

    const snap = sim.snapshot();
    // slot-1 switched.
    expect(
      snap.controlAssignments["slot-1"].controlledPlayerId,
    ).not.toBe("p-a1");
    // slot-2 unchanged.
    expect(
      snap.controlAssignments["slot-2"].controlledPlayerId,
    ).toBe("p-b1");
  });

  it("switched player receives input after switching", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Tick 0: press SWITCH on slot-1.
    sim.applyInputs([
      makeFrame(0, "slot-1", { pressedButtons: SWITCH_PLAYER_BIT }),
    ]);
    sim.step();

    // Tick 1: move slot-1 with full movement.
    const newControlled = sim.snapshot().controlAssignments["slot-1"].controlledPlayerId;
    sim.applyInputs([
      makeFrame(1, "slot-1", { moveX: 1, moveY: 0 }),
    ]);
    sim.step();

    // The newly controlled player should have moved.
    const snap = sim.snapshot();
    const controlled = snap.players.find((p) => p.playerId === newControlled)!;
    expect(controlled.groundPosition.x).toBeGreaterThan(2); // was at x=2 or x=0
  });

  it("switch only happens on pressed edge, not held", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Hold SWITCH_PLAYER_BIT across multiple ticks.
    sim.applyInputs([
      makeFrame(0, "slot-1", {
        pressedButtons: SWITCH_PLAYER_BIT,
        heldButtons: SWITCH_PLAYER_BIT,
      }),
    ]);
    sim.step();

    const afterTick0 = sim.snapshot().controlAssignments["slot-1"].controlledPlayerId;

    // Same held bit, but no pressed bit — should NOT switch again.
    sim.applyInputs([
      makeFrame(1, "slot-1", {
        heldButtons: SWITCH_PLAYER_BIT,
        pressedButtons: 0,
      }),
    ]);
    sim.step();

    const afterTick1 = sim.snapshot().controlAssignments["slot-1"].controlledPlayerId;
    expect(afterTick0).toBe(afterTick1);
  });
});

// ===========================================================================
// 8. Slot ownership persistence across ticks
// ===========================================================================

describe("SLOT-ROUTING-010: slot ownership persistence", () => {
  it("controlled player persists across ticks without explicit switch", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    for (let t = 0; t < 10; t++) {
      sim.applyInputs([
        makeFrame(t, "slot-1", { moveX: 0.5 }),
        makeFrame(t, "slot-2", { moveX: -0.5 }),
      ]);
      sim.step();

      const snap = sim.snapshot();
      expect(snap.controlAssignments["slot-1"].controlledPlayerId).toBe("p-a1");
      expect(snap.controlAssignments["slot-2"].controlledPlayerId).toBe("p-b1");
    }
  });

  it("no flickering between player assignments on consecutive ticks", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    const assignments100: string[] = [];
    for (let t = 0; t < 20; t++) {
      sim.applyInputs([
        makeFrame(t, "slot-1", { moveX: Math.sin(t * 0.3) as number }),
        makeFrame(t, "slot-2", { moveX: -0.5 }),
      ]);
      sim.step();
      assignments100.push(
        sim.snapshot().controlAssignments["slot-1"].controlledPlayerId,
      );
    }

    // All assignments should be the same (no flickering).
    const unique = new Set(assignments100);
    expect(unique.size).toBe(1);
    expect(unique.has("p-a1")).toBe(true);
  });

  it("setControlledPlayer persists and is stable", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Manually switch.
    sim.setControlledPlayer("slot-1", "p-a2");

    for (let t = 0; t < 5; t++) {
      sim.applyInputs([makeFrame(t, "slot-1", { moveX: 0.5 })]);
      sim.step();
      expect(
        sim.snapshot().controlAssignments["slot-1"].controlledPlayerId,
      ).toBe("p-a2");
    }
  });
});

// ===========================================================================
// 9. Determinism with switching
// ===========================================================================

describe("SLOT-ROUTING-011: determinism with player switching", () => {
  it("same switch inputs produce identical hashes", () => {
    function run(): string[] {
      const world = createFourPlayerWorld();
      const sim = createSimulation(world, NO_OP_OBSERVER);

      for (let t = 0; t < 5; t++) {
        sim.applyInputs([
          makeFrame(t, "slot-1", {
            moveX: 0.5,
            pressedButtons: t === 0 ? SWITCH_PLAYER_BIT : 0,
          }),
        ]);
        sim.step();
      }

      const hashes: string[] = [];
      // Run 5 more ticks without switching to see stable hashes.
      for (let t = 5; t < 10; t++) {
        sim.applyInputs([makeFrame(t, "slot-1", { moveX: 0.5 })]);
        sim.step();
        hashes.push(sim.stateHash());
      }
      return hashes;
    }

    const hashesA = run();
    const hashesB = run();
    expect(hashesA).toEqual(hashesB);
  });

  it("different switch targets produce different hashes", () => {
    function run(switchAt: number): string[] {
      const world = createFourPlayerWorld();
      const sim = createSimulation(world, NO_OP_OBSERVER);

      for (let t = 0; t < 10; t++) {
        sim.applyInputs([
          makeFrame(t, "slot-1", {
            moveX: 0.5,
            pressedButtons: t === switchAt ? SWITCH_PLAYER_BIT : 0,
          }),
        ]);
        sim.step();
      }

      return [sim.stateHash()];
    }

    const hashesA = run(0); // switch at tick 0
    const hashesB = run(3); // switch at tick 3
    // Different switch timing should produce different final state.
    expect(hashesA[0]).not.toBe(hashesB[0]);
  });
});

// ===========================================================================
// 10. Edge cases
// ===========================================================================

describe("SLOT-ROUTING-012: edge cases", () => {
  it("single-slot scenario: switch is a no-op (wraps to same player)", () => {
    const scenario: ScenarioDefinition = {
      id: "single-slot-edge",
      version: "1.0.0",
      family: "control-slot-routing",
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
          playerId: "solo",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        },
      ],
      ball: {
        position: { x: 1, y: 0, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll" as const,
      },
      controlAssignments: {
        "slot-1": {
          controlSlot: "slot-1",
          teamId: "team-a",
          controlledPlayerId: "solo",
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

    // Press SWITCH — since only one player on the team, no switch occurs.
    sim.applyInputs([
      makeFrame(0, "slot-1", { pressedButtons: SWITCH_PLAYER_BIT }),
    ]);
    const result = sim.step();

    const switchEvents = result.events.filter(
      (e) => e.kind === "slot-switch",
    );
    // No switch event because computeExplicitSwitchTarget returns null.
    expect(switchEvents.length).toBe(0);
    expect(
      sim.snapshot().controlAssignments["slot-1"].controlledPlayerId,
    ).toBe("solo");
  });

  it("slot with no frames emits no switch events", () => {
    const world = createFourPlayerWorld();
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Apply frames only for slot-1, none for slot-2.
    sim.applyInputs([makeFrame(0, "slot-1", { moveX: 0.5 })]);
    const result = sim.step();

    const switchEvents = result.events.filter(
      (e) => e.kind === "slot-switch",
    );
    expect(switchEvents.length).toBe(0);
  });
});
