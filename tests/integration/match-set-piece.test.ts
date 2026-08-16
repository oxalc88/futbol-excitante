/**
 * @module tests/integration/match-set-piece
 *
 * Integration tests for match restart logic (MATCH-SET-PIECE).
 *
 * Tests:
 *  - After goal event: players reset to formation positions.
 *  - Ball resets to center with zero velocity.
 *  - matchPhase transitions: playing → goal → (wait) → playing.
 *  - Same reset state from same pre-goal state = deterministic.
 *  - Half-time phase transition works.
 *  - Full match with 3v3 AI match + auto-goal-reset.
 *
 * No Math.random, Date, DOM, or Node I/O in simulation-facing code.
 * Node I/O is allowed here in tests (for assertions).
 */

import { describe, it, expect } from "vitest";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { deepClone } from "../../src/simulation/world/clone.js";
import {
  buildCpuObservation,
  createCpuAdapter,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { FOUNDATION_SCENARIO_3V3 } from "../../src/apps/browser/foundation-scenario.js";
import {
  runHeadlessMatch,
  makeAiMatchScenario,
  type MatchPhase,
} from "../../eval/runners/headless-match.js";
import type { MatchPhase as SimMatchPhase } from "../../src/contracts/state.js";

const slotKeys = Object.keys(FOUNDATION_SCENARIO_3V3.controlAssignments);
const assignments = FOUNDATION_SCENARIO_3V3.controlAssignments;

// ---------------------------------------------------------------------------
// 1. Goal countdown and auto-reset (3v3 simulation)
// ---------------------------------------------------------------------------

describe("MATCH-SET-PIECE-001: goal countdown with 3v3 simulation", () => {
  it("playing → goal → countdown → playing after 3 ticks", () => {
    const sim = createSimulation(createWorld({ scenario: FOUNDATION_SCENARIO_3V3 }));
    const adapters = slotKeys.map(() => createCpuAdapter());

    // Verify initial state.
    const pres = sim.presentation();
    expect(pres.matchPhase).toBe("playing");
    const initSnap = sim.snapshot() as { goalResetCountdown: number };
    expect(initSnap.goalResetCountdown).toBe(0);

    // Run a few ticks with CPU adapters, then manually set goal phase.
    for (let i = 0; i < 3; i++) {
      const snapshot = sim.snapshot();
      const frames: Parameters<typeof sim.applyInputs>[0] = [];
      for (let s = 0; s < slotKeys.length; s++) {
        const slot = assignments[slotKeys[s]];
        const frame = adapters[s].sample(
          sim.tick,
          buildCpuObservation(snapshot, slot.teamId, slot.controlledPlayerId),
        );
        frame.controlSlot = slot.controlSlot;
        frames.push(frame);
      }
      sim.applyInputs(frames);
      sim.step();
    }

    // Manually trigger goal phase (simulating a goal event fired).
    const goalMutable = deepClone(sim.snapshot()) as { matchPhase: SimMatchPhase; goalResetCountdown: number };
    goalMutable.matchPhase = "goal";
    goalMutable.goalResetCountdown = 3;
    sim.restore(goalMutable);

    expect(sim.presentation().matchPhase).toBe("goal");

    // Step through countdown (3 ticks).
    for (let i = 0; i < 3; i++) {
      const snapshot = sim.snapshot();
      const frames: Parameters<typeof sim.applyInputs>[0] = [];
      for (let s = 0; s < slotKeys.length; s++) {
        const slot = assignments[slotKeys[s]];
        const frame = adapters[s].sample(
          sim.tick,
          buildCpuObservation(snapshot, slot.teamId, slot.controlledPlayerId),
        );
        frame.controlSlot = slot.controlSlot;
        frames.push(frame);
      }
      sim.applyInputs(frames);
      sim.step();
    }

    expect(sim.presentation().matchPhase).toBe("playing");
  });

  it("ball resets to initial position after goal countdown", () => {
    const sim = createSimulation(createWorld({ scenario: FOUNDATION_SCENARIO_3V3 }));

    // Record initial ball position.
    const initBall = sim.presentation().ball;
    const initX = initBall.position.x;
    const initY = initBall.position.y;
    const initZ = initBall.position.z;

    // Move ball away and set countdown in one step.
    const mutable = deepClone(sim.snapshot()) as {
      ball: { position: { x: number; y: number; z: number } };
      matchPhase: SimMatchPhase;
      goalResetCountdown: number;
    };
    mutable.ball.position = { x: 50, y: 15, z: 8 };
    mutable.matchPhase = "goal";
    mutable.goalResetCountdown = 3;
    sim.restore(mutable);

    for (let i = 0; i < 3; i++) { sim.step(); }

    const finalBall = sim.presentation().ball;
    expect(finalBall.position.x).toBe(initX);
    expect(finalBall.position.y).toBe(initY);
    expect(finalBall.position.z).toBe(initZ);
  });

  it("player velocities reset to zero after goal countdown", () => {
    const sim = createSimulation(createWorld({ scenario: FOUNDATION_SCENARIO_3V3 }));
    const adapters = slotKeys.map(() => createCpuAdapter());

    for (let i = 0; i < 5; i++) {
      const snapshot = sim.snapshot();
      const frames: Parameters<typeof sim.applyInputs>[0] = [];
      for (let s = 0; s < slotKeys.length; s++) {
        const slot = assignments[slotKeys[s]];
        const frame = adapters[s].sample(
          sim.tick,
          buildCpuObservation(snapshot, slot.teamId, slot.controlledPlayerId),
        );
        frame.controlSlot = slot.controlSlot;
        frames.push(frame);
      }
      sim.applyInputs(frames);
      sim.step();
    }

    // Set goal countdown.
    const mutable = deepClone(sim.snapshot()) as { matchPhase: SimMatchPhase; goalResetCountdown: number };
    mutable.matchPhase = "goal";
    mutable.goalResetCountdown = 3;
    sim.restore(mutable);

    for (let i = 0; i < 3; i++) { sim.step(); }

    // After reset, all player velocities should be zero.
    const finalSnap = sim.snapshot() as {
      players: Array<{ linearVelocity: { x: number; y: number } }>;
    };
    for (const p of finalSnap.players) {
      expect(p.linearVelocity.x).toBe(0);
      expect(p.linearVelocity.y).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Headless match integration: phase transitions
// ---------------------------------------------------------------------------

describe("MATCH-SET-PIECE-002: headless match phase transitions", () => {
  it("full match has correct final phase (fulltime)", () => {
    const result = runHeadlessMatch({ scenario: makeAiMatchScenario(), maxTicks: 120, halfDurationTicks: 60 });
    expect(result.matchPhase).toBe("fulltime");
  });

  it("match at halftime tick shows correct progression", () => {
    const result = runHeadlessMatch({ scenario: makeAiMatchScenario(), maxTicks: 61, halfDurationTicks: 60 });
    // maxTicks=61 means ticks 0..60. Tick 60 is halftime (i === halfDurationTicks).
    const lastPhase = result.phaseHistory[result.phaseHistory.length - 1].phase;
    expect(lastPhase).toBe("halftime");
  });

  it("phaseHistory includes halftime transition", () => {
    const result = runHeadlessMatch({
      scenario: makeAiMatchScenario(),
      maxTicks: 200,
      halfDurationTicks: 60,
    });
    const entry = result.phaseHistory.find((p) => p.phase === "halftime");
    expect(entry).toBeDefined();
    expect(entry!.tick).toBe(60);
  });

  it("phaseHistory includes fulltime transition", () => {
    const result = runHeadlessMatch({
      scenario: makeAiMatchScenario(),
      maxTicks: 200,
      halfDurationTicks: 60,
    });
    const entry = result.phaseHistory.find((p) => p.phase === "fulltime");
    expect(entry).toBeDefined();
    expect(entry!.tick).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// 3. 3v3 AI match with auto-goal-reset
// ---------------------------------------------------------------------------

describe("MATCH-SET-PIECE-003: 3v3 AI match with auto-goal-reset", () => {
  it("3v3 match runs to completion without error", () => {
    const scenario = {
      ...FOUNDATION_SCENARIO_3V3,
      id: "3v3-auto-reset-v1",
      profile: "SMALL_SIDED" as const,
      durationTicks: 120,
    };
    const result = runHeadlessMatch({ scenario, maxTicks: 120 });
    expect(result.tick).toBe(120);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.matchPhase).toBe("fulltime");
  });

  it("forced goal in short match triggers score", () => {
    const scenario = {
      ...FOUNDATION_SCENARIO_3V3,
      id: "3v3-forced-goal-v1",
      profile: "SMALL_SIDED" as const,
      durationTicks: 120,
      players: [
        {
          playerId: "player-1", teamId: "team-a",
          groundPosition: { x: 50, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0, desiredHeading: 0,
          archetypeId: "archetype-burst-v1",
        },
        {
          playerId: "player-2", teamId: "team-b",
          groundPosition: { x: -40, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: Math.PI, desiredHeading: Math.PI,
          archetypeId: "archetype-steady-v1",
        },
      ],
      ball: {
        position: { x: 50, y: 0, z: 0.11 },
        linearVelocity: { x: 30, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
      controlAssignments: {
        "slot-1": { controlSlot: "slot-1", teamId: "team-a", controlledPlayerId: "player-1", mode: "AI_FALLBACK" },
        "slot-2": { controlSlot: "slot-2", teamId: "team-b", controlledPlayerId: "player-2", mode: "AI_FALLBACK" },
      },
    };

    const result = runHeadlessMatch({ scenario, maxTicks: 60 });
    const goalEvents = result.events.filter((e) => e.kind === "goal");
    expect(goalEvents.length).toBeGreaterThan(0);
    expect(result.score["team-a"]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Determinism: same pre-goal state → same post-reset
// ---------------------------------------------------------------------------

describe("MATCH-SET-PIECE-004: determinism of goal reset", () => {
  it("same pre-goal state → same post-reset trajectory", () => {
    const run = (countdown: number) => {
      const sim = createSimulation(createWorld({ scenario: FOUNDATION_SCENARIO_3V3 }));
      const mutable = deepClone(sim.snapshot()) as {
        ball: { position: { x: number; y: number; z: number } };
        players: Array<{ groundPosition: { x: number; y: number } }>;
      };
      mutable.ball.position = { x: 40, y: 10, z: 5 };
      for (const p of mutable.players) {
        p.groundPosition = { x: p.groundPosition.x + 20, y: p.groundPosition.y + 5 };
      }
      sim.restore(mutable);

      const pm = deepClone(sim.snapshot()) as { matchPhase: SimMatchPhase; goalResetCountdown: number };
      pm.matchPhase = "goal";
      pm.goalResetCountdown = countdown;
      sim.restore(pm);

      for (let i = 0; i < countdown + 1; i++) { sim.step(); }
      return sim.snapshot();
    };

    const r1 = run(5); const r2 = run(5);
    const s1 = r1 as { ball: { position: { x: number; y: number; z: number } } };
    const s2 = r2 as { ball: { position: { x: number; y: number; z: number } } };

    expect(s1.ball.position.x).toBe(s2.ball.position.x);
    expect(s1.ball.position.y).toBe(s2.ball.position.y);
    expect(s1.ball.position.z).toBe(s2.ball.position.z);
  });
});

// ---------------------------------------------------------------------------
// 5. Custom countdown
// ---------------------------------------------------------------------------

describe("MATCH-SET-PIECE-005: custom countdown config", () => {
  it("short countdown (5 ticks) resets faster", () => {
    const sim = createSimulation(createWorld({ scenario: FOUNDATION_SCENARIO_3V3 }));
    const mutable = deepClone(sim.snapshot()) as { matchPhase: SimMatchPhase; goalResetCountdown: number };
    mutable.matchPhase = "goal";
    mutable.goalResetCountdown = 5;
    sim.restore(mutable);

    for (let i = 0; i < 6; i++) { sim.step(); }
    expect(sim.presentation().matchPhase).toBe("playing");
  });
});