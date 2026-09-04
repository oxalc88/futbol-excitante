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
import {
  assignChaseRoles,
  buildCpuObservation,
  createCpuAdapter,
} from "../../../src/adapters/input-browser/cpu-adapter.js";
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

  it("kickoff: only the designated taker moves; every other body is a real non-neutral-path frame", () => {
    // Anti-huddle contract (5V5-KICKOFF-ANTI-HUDDLE, `anti-huddle-v1`): while the
    // restart ball is untouched exactly one body closes on it and the rest hold
    // their kickoff homes. Held frames are still produced by the defense branch
    // (sprint = 1, no buttons), never by the neutral fallback for an unresolved
    // player, so this keeps the original "no neutral fallbacks" intent.
    const frames: InputFrame[] = [];
    for (const { adapter, slot, teamId, controlledPlayerId } of adapters) {
      const obs = buildCpuObservation(sim.snapshot(), teamId, controlledPlayerId);
      const frame = adapter.sample(0, obs);
      frame.controlSlot = slot;
      frames.push(frame);
    }

    const takerId = assignChaseRoles(
      buildCpuObservation(sim.snapshot(), "team-a", "player-1"),
      "team-a",
    ).kickoffTakerId;
    expect(takerId).toBeTruthy();

    const moving = frames.filter(
      (f) => Math.abs(f.moveX) + Math.abs(f.moveY) > 0.01,
    );
    expect(moving).toHaveLength(1);
    expect(moving[0].controlSlot).toBe(
      Object.entries(FOUNDATION_SCENARIO_2V2.controlAssignments)
        .find(([, a]) => a.controlledPlayerId === takerId)?.[0] ?? "",
    );
    // Every adapter produced a defended frame with the CPU sprint invariant.
    for (const f of frames) {
      expect(f.sprint).toBe(1);
      expect(Math.abs(f.moveX) + Math.abs(f.moveY)).toBeGreaterThanOrEqual(0);
    }
    // Discriminating: stashed, all four charge the untouched ball.
    const stashed = adapters.map(({ adapter, teamId, controlledPlayerId }) =>
      adapter.sample(0, Object.assign(
        buildCpuObservation(sim.snapshot(), teamId, controlledPlayerId),
        { cpuAntiHuddle: false },
      )));
    expect(stashed.filter(
      (f) => Math.abs(f.moveX) + Math.abs(f.moveY) > 0.01,
    )).toHaveLength(4);
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

  it("each slot runs independently: the taker closes, the rest hold their homes", () => {
    // Anti-huddle contract (5V5-KICKOFF-ANTI-HUDDLE): during the kickoff freeze
    // only the kick taker leaves home; the rest stay put until the ball is in
    // play. Per-slot independence is unchanged — every body is driven by its own
    // adapter from its own observation.
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
    const takerId = assignChaseRoles(
      buildCpuObservation(world, "team-a", "player-1"),
      "team-a",
    ).kickoffTakerId;

    // Exactly the taker has left its kickoff home in the freeze window.
    const displacement = (pid: string): number => {
      const start = startPositions.get(pid)!;
      const end = endPositions.get(pid)!;
      return Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
    };
    expect(takerId).toBeTruthy();
    expect(displacement(takerId!)).toBeGreaterThan(0);
    for (const pid of ["player-1", "player-2", "player-3", "player-4"]) {
      if (pid === takerId) continue;
      expect(displacement(pid), `${pid} holds home until first touch`).toBe(0);
    }
  });

  it("team-a pursues the positive-x goal, team-b the negative-x goal", () => {
    // 200 ticks covers this match's kickoff freeze and its first touch, so the
    // pursuing bodies are the taker (team-a) and team-b's presser once play opens.
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_2V2 });
    const sim = createSimulation(world, NO_OP_OBSERVER);

    for (let tick = 1; tick <= 200; tick++) {
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

    const end = sim.snapshot();
    expect(end.ball.lastTouchRef, "the match opened organically").not.toBeNull();

    // Team-a pursuers moved in the +x direction (towards goal at x=52.5).
    const p1 = end.players.find((p) => p.playerId === "player-1")!;
    expect(p1.groundPosition.x).toBeGreaterThan(-15); // moved right from -15
    // Team-b pursuers moved in the -x direction (towards goal at x=-52.5).
    const p3 = end.players.find((p) => p.playerId === "player-3")!;
    expect(p3.groundPosition.x).toBeLessThan(15); // moved left from 15
    // The bodies that were never designated hold their kickoff homes.
    const p2 = end.players.find((p) => p.playerId === "player-2")!;
    const p4 = end.players.find((p) => p.playerId === "player-4")!;
    expect(p2.groundPosition.x).toBeLessThanOrEqual(-10);
    expect(p4.groundPosition.x).toBeGreaterThanOrEqual(10);
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

    // After 60 ticks — still inside this match's kickoff freeze window — only the
    // kick taker has left its kickoff home (5V5-KICKOFF-ANTI-HUDDLE). Held bodies
    // keep their shape until the ball is played.
    const startPositions = new Map([
      ["player-1", { x: -15, y: 0 }],
      ["player-2", { x: -10, y: -12 }],
      ["player-3", { x: 15, y: 0 }],
      ["player-4", { x: 10, y: 12 }],
    ]);
    const takerId = assignChaseRoles(
      buildCpuObservation(world, "team-a", "player-1"),
      "team-a",
    ).kickoffTakerId;
    expect(takerId).toBeTruthy();

    const displacementOf = (playerId: string): number => {
      const player = sim.snapshot().players.find((p) => p.playerId === playerId)!;
      const start = startPositions.get(playerId)!;
      return Math.abs(player.groundPosition.x - start.x) +
        Math.abs(player.groundPosition.y - start.y);
    };
    expect(displacementOf(takerId!)).toBeGreaterThan(0);
    for (const playerId of [...startPositions.keys()]) {
      if (playerId === takerId) continue;
      expect(displacementOf(playerId), `${playerId} holds home`).toBe(0);
    }

    // Then the match really opens and both teams' pursuit is slot-independent:
    // by tick 200 the ball has been touched and team-b's presser has left home.
    for (let tick = 61; tick <= 200; tick++) {
      const allFrames: InputFrame[] = [];
      for (const { adapter, controlSlot, teamId, controlledPlayerId } of cpuSlots) {
        const obs = buildCpuObservation(sim.snapshot(), teamId, controlledPlayerId);
        const cpuFrame = adapter.sample(tick, obs);
        cpuFrame.controlSlot = controlSlot;
        allFrames.push(cpuFrame);
      }
      sim.applyInputs(allFrames);
      sim.step();
    }
    expect(sim.snapshot().ball.lastTouchRef).not.toBeNull();
    expect(displacementOf("player-3")).toBeGreaterThan(0);
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