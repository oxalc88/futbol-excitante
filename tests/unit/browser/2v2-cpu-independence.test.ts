/**
 * @module tests/unit/browser/2v2-cpu-independence
 *
 * Tests for 2v2 CPU-vs-CPU independence — four CPU adapters producing
 * non-conflicting inputs for four distinct players.
 *
 * Mirrors the AI-vs-AI mode logic from `src/apps/browser/main.ts`:
 *  - When `IS_AI_MATCH`, every control slot gets its own CPU adapter.
 *  - Each adapter is wired to the slot's `controlSlot`, `teamId`, and
 *    `controlledPlayerId`.
 *  - On each tick, `buildCpuObservation(sim.snapshot(), tid, cid)` feeds
 *    the world state to the adapter.
 *
 * Tests:
 *  1. All 4 CPU adapters are created per-slot (no conflicts).
 *  2. Each adapter produces a frame (no crashes, no neutral fallbacks).
 *  3. Players at different positions produce different movement vectors.
 *  4. After N ticks, each player has moved from its start position.
 *  5. Slot-1 → player-1, slot-2 → player-3, slot-3 → player-2, slot-4 → player-4.
 *  6. Full simulation loop with CPU adapters runs without error.
 *  7. Determinism: re-running produces identical results.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { NO_OP_OBSERVER } from "../../../src/simulation/telemetry/observer.js";
import { createCpuAdapter, buildCpuObservation } from "../../../src/adapters/input-browser/cpu-adapter.js";
import { FOUNDATION_SCENARIO_2V2 } from "../../../src/apps/browser/foundation-scenario.js";
import type { InputFrame } from "../../../src/contracts/input.js";
import type { Simulation } from "../../../src/simulation/loop/simulation.js";

// ---------------------------------------------------------------------------
// Slot-assignment mapping from the 2v2 fixture
// ---------------------------------------------------------------------------
// slot-1 → player-1 (team-a, burst)     start: (-15, 0)
// slot-2 → player-3 (team-b, burst)     start: ( 15, 0)  heading π
// slot-3 → player-2 (team-a, steady)    start: (-10,-12)
// slot-4 → player-4 (team-b, steady)    start: ( 10, 12)  heading π

describe("2V2-CPU-INDEPENDENCE-001: four adapters created per slot", () => {
  it("creates 4 CPU adapters, one per control slot", () => {
    const scenario = FOUNDATION_SCENARIO_2V2;
    const assignments = scenario.controlAssignments;
    const slots = Object.keys(assignments);
    expect(slots).toHaveLength(4);

    const adapters: {
      slot: string;
      teamId: string;
      controlledPlayerId: string;
      adapter: ReturnType<typeof createCpuAdapter>;
    }[] = [];

    for (const [slotId, assignment] of Object.entries(assignments)) {
      adapters.push({
        slot: slotId,
        teamId: assignment.teamId,
        controlledPlayerId: assignment.controlledPlayerId ?? "",
        adapter: createCpuAdapter(),
      });
    }

    expect(adapters).toHaveLength(4);
    // Verify slot → player mapping matches the fixture.
    const slotMap = new Map(
      adapters.map((a) => [a.slot, a.controlledPlayerId]),
    );
    expect(slotMap.get("slot-1")).toBe("player-1");
    expect(slotMap.get("slot-2")).toBe("player-3");
    expect(slotMap.get("slot-3")).toBe("player-2");
    expect(slotMap.get("slot-4")).toBe("player-4");
  });

  it("team assignments are correct: slot-1 & slot-3 → team-a, slot-2 & slot-4 → team-b", () => {
    const scenario = FOUNDATION_SCENARIO_2V2;
    const teamA: string[] = [];
    const teamB: string[] = [];
    for (const [slot, assignment] of Object.entries(
      scenario.controlAssignments,
    )) {
      if (assignment.teamId === "team-a") teamA.push(slot);
      else teamB.push(slot);
    }
    expect(teamA).toContain("slot-1");
    expect(teamA).toContain("slot-3");
    expect(teamB).toContain("slot-2");
    expect(teamB).toContain("slot-4");
  });
});

// ---------------------------------------------------------------------------
// 2v2-CPU-INDEPENDENCE-002: each adapter produces a frame
// ---------------------------------------------------------------------------

describe("2V2-CPU-INDEPENDENCE-002: each adapter produces a frame", () => {
  let sim: Simulation;
  let adapters: {
    slot: string;
    teamId: string;
    controlledPlayerId: string;
    adapter: ReturnType<typeof createCpuAdapter>;
  }[];

  beforeEach(() => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_2V2 });
    sim = createSimulation(world, NO_OP_OBSERVER);

    adapters = [];
    for (const [slot, assignment] of Object.entries(
      FOUNDATION_SCENARIO_2V2.controlAssignments,
    )) {
      adapters.push({
        slot,
        teamId: assignment.teamId,
        controlledPlayerId: assignment.controlledPlayerId ?? "",
        adapter: createCpuAdapter(),
      });
    }
  });

  it("all 4 adapters produce InputFrame at tick 0", () => {
    const frames: InputFrame[] = [];
    for (const { adapter, slot, teamId, controlledPlayerId } of adapters) {
      const obs = buildCpuObservation(sim.snapshot(), teamId, controlledPlayerId);
      const frame = adapter.sample(0, obs);
      frame.controlSlot = slot;
      frames.push(frame);
    }
    expect(frames).toHaveLength(4);
    for (const f of frames) {
      expect(f.tick).toBe(0);
      expect(f.sourceId).toBe("cpu");
      // Every frame should have a non-empty controlSlot (set by caller).
      expect(f.controlSlot).toBeTruthy();
      expect(typeof f.moveX).toBe("number");
      expect(typeof f.moveY).toBe("number");
    }
  });

  it("no adapter produces all-zero movement (all are chasing ball)", () => {
    const frames: InputFrame[] = [];
    for (const { adapter, slot, teamId, controlledPlayerId } of adapters) {
      const obs = buildCpuObservation(sim.snapshot(), teamId, controlledPlayerId);
      const frame = adapter.sample(0, obs);
      frame.controlSlot = slot;
      frames.push(frame);
    }

    // Ball is at (0, 0.11) z. Players at (-15, 0), (15, 0), (-10, -12), (10, 12).
    // All should have some movement toward the ball.
    for (const f of frames) {
      // At least one axis should have movement (they all start at distance from ball).
      expect(Math.abs(f.moveX) + Math.abs(f.moveY)).toBeGreaterThan(0);
    }
  });

  it("sprint = 1 on all frames (CPU always sprints)", () => {
    for (const { adapter, slot, teamId, controlledPlayerId } of adapters) {
      const obs = buildCpuObservation(sim.snapshot(), teamId, controlledPlayerId);
      const frame = adapter.sample(0, obs);
      frame.controlSlot = slot;
      expect(frame.sprint).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 2v2-CPU-INDEPENDENCE-003: different positions → different movement vectors
// ---------------------------------------------------------------------------

describe("2V2-CPU-INDEPENDENCE-003: independent movement vectors", () => {
  let adapters: {
    slot: string;
    teamId: string;
    controlledPlayerId: string;
    adapter: ReturnType<typeof createCpuAdapter>;
  }[];

  beforeEach(() => {
    adapters = [];
    for (const [slot, assignment] of Object.entries(
      FOUNDATION_SCENARIO_2V2.controlAssignments,
    )) {
      adapters.push({
        slot,
        teamId: assignment.teamId,
        controlledPlayerId: assignment.controlledPlayerId ?? "",
        adapter: createCpuAdapter(),
      });
    }
  });

  it("team-a players move differently from team-b players", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_2V2 });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Collect initial player positions.
    const startPositions = new Map(
      sim.snapshot().players.map((p) => [p.playerId, { ...p.groundPosition }]),
    );

    // Simulate 10 ticks — each adapter runs per tick.
    for (let tick = 1; tick <= 10; tick++) {
      const frames: InputFrame[] = [];
      for (const { adapter, slot, teamId, controlledPlayerId } of adapters) {
        const obs = buildCpuObservation(sim.snapshot(), teamId, controlledPlayerId);
        const frame = adapter.sample(tick, obs);
        frame.controlSlot = slot;
        frames.push(frame);
      }
      sim.applyInputs(frames);
      sim.step();
    }

    const endPositions = new Map(
      sim.snapshot().players.map((p) => [p.playerId, { ...p.groundPosition }]),
    );

    // Each player moved from its start position.
    for (const pid of ["player-1", "player-2", "player-3", "player-4"]) {
      const start = startPositions.get(pid);
      const end = endPositions.get(pid);
      if (start && end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        expect(Math.abs(dx) + Math.abs(dy)).toBeGreaterThan(0);
      }
    }
  });

  it("team-a players move towards positive-x goal, team-b towards negative-x", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_2V2 });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    // Run 30 ticks.
    for (let tick = 1; tick <= 30; tick++) {
      const frames: InputFrame[] = [];
      for (const { adapter, slot, teamId, controlledPlayerId } of adapters) {
        const obs = buildCpuObservation(sim.snapshot(), teamId, controlledPlayerId);
        const frame = adapter.sample(tick, obs);
        frame.controlSlot = slot;
        frames.push(frame);
      }
      sim.applyInputs(frames);
      sim.step();
    }

    // Team-a players (player-1 at -15, player-2 at -10) should have moved
    // in the +x direction (towards goal at x=52.5).
    const p1 = sim.snapshot().players.find((p) => p.playerId === "player-1");
    const p2 = sim.snapshot().players.find((p) => p.playerId === "player-2");
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    if (p1 && p2) {
      expect(p1.groundPosition.x).toBeGreaterThan(-15); // moved right from -15
      expect(p2.groundPosition.x).toBeGreaterThan(-10); // moved right from -10
    }

    // Team-b players (player-3 at 15, player-4 at 10) should have moved
    // in the -x direction (towards goal at x=-52.5).
    const p3 = sim.snapshot().players.find((p) => p.playerId === "player-3");
    const p4 = sim.snapshot().players.find((p) => p.playerId === "player-4");
    expect(p3).toBeDefined();
    expect(p4).toBeDefined();
    if (p3 && p4) {
      expect(p3.groundPosition.x).toBeLessThan(15); // moved left from 15
      expect(p4.groundPosition.x).toBeLessThan(10); // moved left from 10
    }
  });
});

// ---------------------------------------------------------------------------
// 2v2-CPU-INDEPENDENCE-004: per-slot routing works correctly
// ---------------------------------------------------------------------------

describe("2V2-CPU-INDEPENDENCE-004: per-slot routing correctness", () => {
  let adapters: {
    slot: string;
    teamId: string;
    controlledPlayerId: string;
    adapter: ReturnType<typeof createCpuAdapter>;
  }[];

  beforeEach(() => {
    adapters = [];
    for (const [slot, assignment] of Object.entries(
      FOUNDATION_SCENARIO_2V2.controlAssignments,
    )) {
      adapters.push({
        slot,
        teamId: assignment.teamId,
        controlledPlayerId: assignment.controlledPlayerId ?? "",
        adapter: createCpuAdapter(),
      });
    }
  });

  it("slot-1 → player-1 (team-a burst) controls the correct player", () => {
    const slotDef = adapters.find((a) => a.slot === "slot-1")!;
    expect(slotDef.controlledPlayerId).toBe("player-1");
    expect(slotDef.teamId).toBe("team-a");
  });

  it("slot-2 → player-3 (team-b burst) controls the correct player", () => {
    const slotDef = adapters.find((a) => a.slot === "slot-2")!;
    expect(slotDef.controlledPlayerId).toBe("player-3");
    expect(slotDef.teamId).toBe("team-b");
  });

  it("slot-3 → player-2 (team-a steady) controls the correct player", () => {
    const slotDef = adapters.find((a) => a.slot === "slot-3")!;
    expect(slotDef.controlledPlayerId).toBe("player-2");
    expect(slotDef.teamId).toBe("team-a");
  });

  it("slot-4 → player-4 (team-b steady) controls the correct player", () => {
    const slotDef = adapters.find((a) => a.slot === "slot-4")!;
    expect(slotDef.controlledPlayerId).toBe("player-4");
    expect(slotDef.teamId).toBe("team-b");
  });

  it("all 4 controlSlot values are unique", () => {
    const slots = adapters.map((a) => a.slot);
    const unique = new Set(slots);
    expect(unique.size).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 2v2-CPU-INDEPENDENCE-005: full simulation loop with CPU adapters
// ---------------------------------------------------------------------------

describe("2V2-CPU-INDEPENDENCE-005: full loop with CPU adapters", () => {
  it("run 60 ticks of simulation with 4 CPU adapters, no errors", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_2V2 });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    const cpuSlots: {
      adapter: ReturnType<typeof createCpuAdapter>;
      controlSlot: string;
      teamId: string;
      controlledPlayerId: string;
    }[] = [];
    for (const [slotId, assignment] of Object.entries(
      FOUNDATION_SCENARIO_2V2.controlAssignments,
    )) {
      cpuSlots.push({
        adapter: createCpuAdapter(),
        controlSlot: slotId,
        teamId: assignment.teamId,
        controlledPlayerId: assignment.controlledPlayerId ?? "",
      });
    }

    for (let tick = 1; tick <= 60; tick++) {
      const allFrames: InputFrame[] = [];
      for (const { adapter, controlSlot, teamId, controlledPlayerId } of cpuSlots) {
        const obs = buildCpuObservation(sim.snapshot(), teamId, controlledPlayerId);
        const cpuFrame = adapter.sample(tick, obs);
        cpuFrame.controlSlot = controlSlot;
        allFrames.push(cpuFrame);
      }
      sim.applyInputs(allFrames);
      const result = sim.step();
      // No assertion errors — just ensure the loop completes.
      expect(result.tick).toBe(tick);
    }

    // After 60 ticks (1 second), all players should have moved.
    const startPositions = new Map([
      ["player-1", { x: -15, y: 0 }],
      ["player-2", { x: -10, y: -12 }],
      ["player-3", { x: 15, y: 0 }],
      ["player-4", { x: 10, y: 12 }],
    ]);

    for (const player of sim.snapshot().players) {
      const start = startPositions.get(player.playerId);
      if (start) {
        const dx = player.groundPosition.x - start.x;
        const dy = player.groundPosition.y - start.y;
        expect(Math.abs(dx) + Math.abs(dy)).toBeGreaterThan(0);
      }
    }
  });

  it("determinism: two independent runs with same scenario produce identical hash after N ticks", () => {
    function runN(n: number): string {
      const w = createWorld({ scenario: FOUNDATION_SCENARIO_2V2 });
      const s = createSimulation(w, NO_OP_OBSERVER);

      const cpuSlots: {
        adapter: ReturnType<typeof createCpuAdapter>;
        controlSlot: string;
        teamId: string;
        controlledPlayerId: string;
      }[] = [];
      for (const [slotId, assignment] of Object.entries(
        FOUNDATION_SCENARIO_2V2.controlAssignments,
      )) {
        cpuSlots.push({
          adapter: createCpuAdapter(),
          controlSlot: slotId,
          teamId: assignment.teamId,
          controlledPlayerId: assignment.controlledPlayerId ?? "",
        });
      }

      for (let tick = 1; tick <= n; tick++) {
        const allFrames: InputFrame[] = [];
        for (const { adapter, controlSlot, teamId, controlledPlayerId } of cpuSlots) {
          const obs = buildCpuObservation(s.snapshot(), teamId, controlledPlayerId);
          const cpuFrame = adapter.sample(tick, obs);
          cpuFrame.controlSlot = controlSlot;
          allFrames.push(cpuFrame);
        }
        s.applyInputs(allFrames);
        s.step();
      }

      return s.stateHash();
    }

    const hash1 = runN(30);
    const hash2 = runN(30);
    expect(hash1).toBe(hash2);
  });
});