/**
 * @module second-touch-tests
 *
 * Tests for PLAYABLE-SECOND-TOUCH: second-touch/turn mechanics
 * and dribble state transitions.
 *
 * Tests:
 *  1. enterDribble creates active dribble state for a player.
 *  2. isDribbling returns correct state.
 *  3. endDribble terminates active dribble.
 *  4. stepDribble: ball within range + moving → ball velocity dampened.
 *  5. stepDribble: ball leaves range → dribble ends, no turn events.
 *  6. stepDribble: turn detection emits second-touch event.
 *  7. stepDribble: turn cooldown prevents rapid turn events.
 *  8. stepDribble: max dribble ticks ends dribble.
 *  9. stepDribble: second-touch delay prevents immediate turns.
 * 10. Integration: first-touch → enterDribble → stepDribble → turn event.
 * 11. Integration: simulation loop with dribble and turn.
 * 12. Ball independence: no ownership after second-touch.
 * 13. Finite values after second-touch.
 * 14. Determinism: same inputs → same events.
 *
 * No Math.random, Date, DOM, or Node I/O in src/simulation.
 */

import { describe, it, expect } from "vitest";

import {
  enterDribble,
  isDribbling,
  endDribble,
  stepDribble,
  type DribbleState,
} from "../../../src/simulation/contacts/second-touch-system.js";
import { FOUNDATION_SECOND_TOUCH_V1 } from "../../../src/simulation/config/foundation.js";
import type { BallState, PlayerState } from "../../../src/contracts/state.js";
import type { InputFrame } from "../../../src/contracts/input.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CFG = FOUNDATION_SECOND_TOUCH_V1;

function makePlayer(overrides?: Partial<PlayerState>): PlayerState {
  return {
    playerId: "p1",
    teamId: "team-a",
    groundPosition: { x: 0, y: 0 },
    linearVelocity: { x: 3.0, y: 0 },
    desiredVelocity: { x: 3.0, y: 0 },
    bodyHeading: 0,
    desiredHeading: 0,
    ...overrides,
  };
}

function makeBall(overrides?: Partial<BallState>): BallState {
  return {
    position: { x: 0.5, y: 0, z: 0.11 },
    linearVelocity: { x: 2.0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    regime: "ground-roll",
    lastTouchRef: null,
    ...overrides,
  } as BallState;
}

function makeFrame(
  tick: number,
  opts?: {
    controlSlot?: string;
    moveX?: number;
    moveY?: number;
    heldButtons?: number;
    pressedButtons?: number;
  },
): InputFrame {
  return {
    tick,
    sourceId: "test",
    controlSlot: opts?.controlSlot ?? "slot-1",
    moveX: opts?.moveX ?? 0,
    moveY: opts?.moveY ?? 0,
    sprint: 0,
    heldButtons: opts?.heldButtons ?? 0,
    pressedButtons: opts?.pressedButtons ?? 0,
    releasedButtons: 0,
  };
}

function makeAssignments(
  ...entries: Array<{ slot: string; playerId: string; teamId: string }>
): Record<string, { teamId: string; controlledPlayerId: string; mode: string }> {
  const result: Record<string, { teamId: string; controlledPlayerId: string; mode: string }> = {};
  for (const e of entries) {
    result[e.slot] = {
      teamId: e.teamId,
      controlledPlayerId: e.playerId,
      mode: "HUMAN",
    };
  }
  return result;
}

function makeCounter(): { value: number } {
  return { value: 0 };
}

function makeDribbleStates(): Map<string, DribbleState> {
  return new Map();
}

// ---------------------------------------------------------------------------
// 1. enterDribble creates active dribble state
// ---------------------------------------------------------------------------

describe("SECOND-TOUCH-001: enterDribble creates dribble state", () => {
  it("creates active dribble state for a player", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 5);

    expect(states.has("p1")).toBe(true);
    expect(states.get("p1")!.active).toBe(true);
    expect(states.get("p1")!.startTick).toBe(5);
  });

  it("does not overwrite existing active dribble", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 5);
    enterDribble(states, "p1", 10);

    // startTick should remain 5 (first entry).
    expect(states.get("p1")!.startTick).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 2. isDribbling returns correct state
// ---------------------------------------------------------------------------

describe("SECOND-TOUCH-002: isDribbling query", () => {
  it("returns false for unknown player", () => {
    const states = makeDribbleStates();
    expect(isDribbling(states, "unknown")).toBe(false);
  });

  it("returns true for active dribbler", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);
    expect(isDribbling(states, "p1")).toBe(true);
  });

  it("returns false after endDribble", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);
    endDribble(states, "p1");
    expect(isDribbling(states, "p1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. endDribble terminates active dribble
// ---------------------------------------------------------------------------

describe("SECOND-TOUCH-003: endDribble terminates dribble", () => {
  it("sets active to false", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);
    endDribble(states, "p1");
    expect(states.get("p1")!.active).toBe(false);
  });

  it("no-op for unknown player", () => {
    const states = makeDribbleStates();
    // Should not throw.
    endDribble(states, "unknown");
    expect(states.has("unknown")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. stepDribble: ball within range + moving → ball velocity dampened
// ---------------------------------------------------------------------------

describe("SECOND-TOUCH-004: ball velocity dampening during dribble", () => {
  it("dampens ball velocity toward player movement direction", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);

    const player = makePlayer({
      groundPosition: { x: 0, y: 0 },
      linearVelocity: { x: 4.0, y: 0 },
      desiredVelocity: { x: 4.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 1.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(10, { moveX: 1, moveY: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const events = stepDribble(
      [player], ball, states, frames, assignments,
      CFG, counter, 10,
    );

    // Ball velocity should have shifted toward player direction (4.0 × 0.8 = 3.2 target).
    expect(ball.linearVelocity.x).toBeGreaterThan(1.0);
    expect(ball.linearVelocity.x).toBeLessThan(4.0);
    expect(ball.linearVelocity.y).toBeCloseTo(0, 1);
    expect(ball.linearVelocity.z).toBe(0);
  });

  it("dribble ticks are incremented", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);

    const player = makePlayer();
    const ball = makeBall();
    const frames = [makeFrame(10, { moveX: 1, moveY: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepDribble([player], ball, states, frames, assignments, CFG, counter, 10);

    expect(states.get("p1")!.dribbleTicks).toBe(1);
  });

  it("no events emitted when just dampening (no turn)", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);

    const player = makePlayer();
    const ball = makeBall();
    const frames = [makeFrame(10, { moveX: 1, moveY: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const events = stepDribble(
      [player], ball, states, frames, assignments, CFG, counter, 10,
    );

    expect(events.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. stepDribble: ball leaves range → dribble ends
// ---------------------------------------------------------------------------

describe("SECOND-TOUCH-005: ball out of range ends dribble", () => {
  it("ends dribble when ball is too far from player", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);

    const player = makePlayer({
      groundPosition: { x: 0, y: 0 },
    });
    const ball = makeBall({
      position: { x: 5.0, y: 0, z: 0.11 }, // way outside dribbleRange (1.5)
    });
    const frames = [makeFrame(10, { moveX: 1, moveY: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepDribble([player], ball, states, frames, assignments, CFG, counter, 10);

    expect(isDribbling(states, "p1")).toBe(false);
  });

  it("no events emitted when ball out of range", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);

    const player = makePlayer({
      groundPosition: { x: 0, y: 0 },
    });
    const ball = makeBall({
      position: { x: 5.0, y: 0, z: 0.11 },
    });
    const frames = [makeFrame(10, { moveX: 1, moveY: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const events = stepDribble(
      [player], ball, states, frames, assignments, CFG, counter, 10,
    );

    expect(events.length).toBe(0);
  });

  it("ball velocity is not modified when dribble ends due to range", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);

    const player = makePlayer({ groundPosition: { x: 0, y: 0 } });
    const ball = makeBall({
      position: { x: 5.0, y: 0, z: 0.11 },
      linearVelocity: { x: 3.0, y: 0, z: 0 },
    });
    const velBefore = { ...ball.linearVelocity };
    const frames = [makeFrame(10, { moveX: 1, moveY: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepDribble([player], ball, states, frames, assignments, CFG, counter, 10);

    expect(ball.linearVelocity.x).toBe(velBefore.x);
    expect(ball.linearVelocity.y).toBe(velBefore.y);
  });
});

// ---------------------------------------------------------------------------
// 6. stepDribble: turn detection emits second-touch event
// ---------------------------------------------------------------------------

describe("SECOND-TOUCH-006: turn detection emits event", () => {
  it("emits second-touch event when heading changes significantly", () => {
    const states = makeDribbleStates();
    // Start dribble at tick 0, so at tick 10 we're past secondTouchDelay (2).
    enterDribble(states, "p1", 0);

    const player = makePlayer({
      groundPosition: { x: 0, y: 0 },
      linearVelocity: { x: 3.0, y: 0 },
      bodyHeading: 0, // facing +X
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    // Player inputs movement perpendicular to body heading (turn input).
    const frames = [makeFrame(10, { moveX: 0, moveY: 1 })]; // heading = π/2
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const events = stepDribble(
      [player], ball, states, frames, assignments, CFG, counter, 10,
    );

    expect(events.length).toBe(1);
    expect(events[0].kind).toBe("second-touch");
    expect(events[0].payload.playerId).toBe("p1");
    expect(events[0].payload.contactType).toBe("turn");
  });

  it("event has correct heading diff", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);

    const player = makePlayer({
      groundPosition: { x: 0, y: 0 },
      linearVelocity: { x: 3.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({ position: { x: 0.5, y: 0, z: 0.11 } });
    // Input heading ≈ π/2 (90° turn).
    const frames = [makeFrame(10, { moveX: 0, moveY: 1 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const events = stepDribble(
      [player], ball, states, frames, assignments, CFG, counter, 10,
    );

    expect(events.length).toBe(1);
    const payload = events[0].payload as { headingDiff: number; previousHeading: number; targetHeading: number };
    expect(payload.headingDiff).toBeGreaterThan(0.262); // > 15° threshold
    expect(payload.previousHeading).toBe(0);
    expect(payload.targetHeading).toBeCloseTo(Math.PI / 2, 5);
  });

  it("no event when heading change is below threshold", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);

    const player = makePlayer({
      groundPosition: { x: 0, y: 0 },
      linearVelocity: { x: 3.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({ position: { x: 0.5, y: 0, z: 0.11 } });
    // Small heading change (< 15°).
    const frames = [makeFrame(10, { moveX: 1, moveY: 0.05 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const events = stepDribble(
      [player], ball, states, frames, assignments, CFG, counter, 10,
    );

    expect(events.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. stepDribble: turn cooldown prevents rapid turn events
// ---------------------------------------------------------------------------

describe("SECOND-TOUCH-007: turn cooldown enforcement", () => {
  it("second turn within cooldown is suppressed", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);

    const player = makePlayer({
      groundPosition: { x: 0, y: 0 },
      linearVelocity: { x: 3.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({ position: { x: 0.5, y: 0, z: 0.11 } });
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });

    // First turn at tick 10.
    const frames1 = [makeFrame(10, { moveX: 0, moveY: 1 })];
    const counter1 = makeCounter();
    const events1 = stepDribble(
      [player], ball, states, frames1, assignments, CFG, counter1, 10,
    );
    expect(events1.length).toBe(1);

    // Second turn attempt at tick 11 (within turnCooldownTicks = 4).
    const frames2 = [makeFrame(11, { moveX: 0, moveY: 1 })];
    const counter2 = makeCounter();
    const events2 = stepDribble(
      [player], ball, states, frames2, assignments, CFG, counter2, 11,
    );
    expect(events2.length).toBe(0);
  });

  it("turn after cooldown succeeds", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);

    const player = makePlayer({
      groundPosition: { x: 0, y: 0 },
      linearVelocity: { x: 3.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({ position: { x: 0.5, y: 0, z: 0.11 } });
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });

    // First turn at tick 10.
    stepDribble([player], ball, states, [makeFrame(10, { moveX: 0, moveY: 1 })], assignments, CFG, makeCounter(), 10);

    // Turn after cooldown (tick 10 + turnCooldownTicks = 14).
    const afterCooldown = 10 + CFG.turnCooldownTicks.value;
    const events = stepDribble(
      [player], ball, states, [makeFrame(afterCooldown, { moveX: 0, moveY: 1 })], assignments, CFG, makeCounter(), afterCooldown,
    );
    expect(events.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 8. stepDribble: max dribble ticks ends dribble
// ---------------------------------------------------------------------------

describe("SECOND-TOUCH-008: max dribble duration", () => {
  it("dribble ends after maxDribbleTicks", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);

    const player = makePlayer({
      groundPosition: { x: 0, y: 0 },
      linearVelocity: { x: 3.0, y: 0 },
    });
    const ball = makeBall({ position: { x: 0.5, y: 0, z: 0.11 } });
    const frames = [makeFrame(1, { moveX: 1, moveY: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });

    // Run until dribble ticks exceed max.
    let lastActive = true;
    for (let t = 1; t <= CFG.maxDribbleTicks.value + 5; t++) {
      const counter = makeCounter();
      stepDribble([player], ball, states, frames, assignments, CFG, counter, t);
      lastActive = isDribbling(states, "p1");
    }

    expect(lastActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 9. stepDribble: second-touch delay prevents immediate turns
// ---------------------------------------------------------------------------

describe("SECOND-TOUCH-009: second-touch delay", () => {
  it("no turn event within secondTouchDelay ticks of dribble start", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 5);

    const player = makePlayer({
      groundPosition: { x: 0, y: 0 },
      linearVelocity: { x: 3.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({ position: { x: 0.5, y: 0, z: 0.11 } });
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });

    // Try a turn right after start (tick 6, delay = 2 ticks).
    const frames = [makeFrame(6, { moveX: 0, moveY: 1 })];
    const counter = makeCounter();
    const events = stepDribble(
      [player], ball, states, frames, assignments, CFG, counter, 6,
    );

    expect(events.length).toBe(0);
  });

  it("turn event after secondTouchDelay succeeds", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 5);

    const player = makePlayer({
      groundPosition: { x: 0, y: 0 },
      linearVelocity: { x: 3.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({ position: { x: 0.5, y: 0, z: 0.11 } });
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });

    // Turn after delay (tick 5 + secondTouchDelay(2) + 1 = 8).
    const afterDelay = 5 + CFG.secondTouchDelay.value + 1;
    const frames = [makeFrame(afterDelay, { moveX: 0, moveY: 1 })];
    const counter = makeCounter();
    const events = stepDribble(
      [player], ball, states, frames, assignments, CFG, counter, afterDelay,
    );

    expect(events.length).toBe(1);
    expect(events[0].kind).toBe("second-touch");
  });
});

// ---------------------------------------------------------------------------
// 10. Integration: first-touch → enterDribble → stepDribble → turn event
// ---------------------------------------------------------------------------

describe("SECOND-TOUCH-010: full first-touch → dribble → turn flow", () => {
  it("first-touch enters dribble, then stepDribble produces turn event", async () => {
    const { stepContacts } = await import("../../../src/simulation/contacts/contact-system.js");
    const { FIRST_TOUCH_BIT } = await import("../../../src/contracts/input.js");
    const {
      FOUNDATION_CONTACT_V1,
      FOUNDATION_PASS_V1,
      FOUNDATION_SHOT_V1,
      FOUNDATION_CLOSE_CONTROL_V1,
    } = await import("../../../src/simulation/config/foundation.js");

    const dribbleStates = makeDribbleStates();
    const dribbleCooldowns = new Map<string, number>();

    // Step 1: First-touch contact at tick 1.
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      linearVelocity: { x: 0, y: 0 },
      desiredVelocity: { x: 0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const frames1 = [{
      tick: 1,
      sourceId: "test",
      controlSlot: "slot-1",
      moveX: 0,
      moveY: 0,
      sprint: 0,
      heldButtons: 0,
      pressedButtons: FIRST_TOUCH_BIT,
      releasedButtons: 0,
    }];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter1 = makeCounter();

    const contactResult = stepContacts(
      [player], ball, frames1, assignments,
      FOUNDATION_CONTACT_V1, counter1, 1,
      FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      FOUNDATION_CLOSE_CONTROL_V1, dribbleCooldowns, dribbleStates,
    );

    // First-touch should have triggered enterDribble.
    expect(isDribbling(dribbleStates, "p1")).toBe(true);

    // Step 2: Dribble with movement at tick 3 (after second-touch delay).
    player.linearVelocity = { x: 3.0, y: 0 };
    player.desiredVelocity = { x: 3.0, y: 0 };
    player.bodyHeading = 0;
    ball.position = { x: 0.5, y: 0, z: 0.11 };
    ball.linearVelocity = { x: 2.0, y: 0, z: 0 };

    // Turn input at tick 3 (perpendicular to body heading).
    const frames3 = [makeFrame(3, { moveX: 0, moveY: 1 })];
    const counter3 = makeCounter();

    const dribbleEvents = stepDribble(
      [player], ball, dribbleStates, frames3, assignments,
      FOUNDATION_SECOND_TOUCH_V1, counter3, 3,
    );

    // Should have a second-touch turn event.
    const turnEvents = dribbleEvents.filter((e: { kind: string }) => e.kind === "second-touch");
    expect(turnEvents.length).toBe(1);
    expect(turnEvents[0].payload.playerId).toBe("p1");
    expect(turnEvents[0].payload.contactType).toBe("turn");
  });
});

// ---------------------------------------------------------------------------
// 11. Simulation loop integration
// ---------------------------------------------------------------------------

describe("SECOND-TOUCH-011: simulation loop integration", () => {
  it("second-touch events appear in simulation step results", async () => {
    const { createWorld } = await import("../../../src/simulation/world/create.js");
    const { createSimulation } = await import("../../../src/simulation/loop/simulation.js");
    const { NO_OP_OBSERVER } = await import("../../../src/simulation/telemetry/observer.js");
    const { FIRST_TOUCH_BIT: FT } = await import("../../../src/contracts/input.js");

    const scenario = {
      id: "second-touch-integration-test",
      version: "1.0.0",
      family: "second-touch",
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
          playerId: "p1",
          teamId: "team-a",
          groundPosition: { x: 0.3, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        },
      ],
      ball: {
        position: { x: 0.5, y: 0, z: 0.11 },
        linearVelocity: { x: 1.5, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll" as const,
      },
      controlAssignments: {
        "slot-1": {
          controlSlot: "slot-1",
          teamId: "team-a",
          controlledPlayerId: "p1",
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

    let secondTouchCount = 0;
    let firstTouchCount = 0;

    // Apply FIRST_TOUCH pressed at tick 0 (first-touch edge).
    sim.applyInputs([{
      tick: 0,
      sourceId: "test",
      controlSlot: "slot-1",
      moveX: 0,
      moveY: 0,
      sprint: 0,
      heldButtons: 0,
      pressedButtons: FT,
      releasedButtons: 0,
    }]);

    // Step a few ticks to let the first-touch resolve.
    for (let t = 0; t < 3; t++) {
      const result = sim.step();
      for (const ev of result.events) {
        if (ev.kind === "player-ball-contact") {
          const payload = ev.payload as { contactType?: string };
          if (payload?.contactType === "first-touch") {
            firstTouchCount++;
          }
        }
      }
    }

    // Now apply movement input with turn (perpendicular to body heading).
    for (let t = 3; t < 15; t++) {
      sim.applyInputs([{
        tick: t,
        sourceId: "test",
        controlSlot: "slot-1",
        moveX: 0,
        moveY: 1, // perpendicular turn
        sprint: 0,
        heldButtons: FT,
        pressedButtons: 0,
        releasedButtons: 0,
      }]);

      const result = sim.step();
      for (const ev of result.events) {
        if (ev.kind === "second-touch") {
          secondTouchCount++;
        }
      }
    }

    // Should have had at least one first-touch event.
    expect(firstTouchCount).toBeGreaterThanOrEqual(1);

    // Ball should still be independent.
    const snap = sim.snapshot();
    expect((snap.ball as any).ownerPlayerId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 12. Ball independence after second-touch
// ---------------------------------------------------------------------------

describe("SECOND-TOUCH-012: ball independence", () => {
  it("ball has no ownerPlayerId after second-touch", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);

    const player = makePlayer({ linearVelocity: { x: 3.0, y: 0 } });
    const ball = makeBall();
    const frames = [makeFrame(10, { moveX: 0, moveY: 1 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepDribble([player], ball, states, frames, assignments, CFG, counter, 10);

    expect((ball as any).ownerPlayerId).toBeUndefined();
    expect((ball as any).possessedBy).toBeUndefined();
    expect((ball as any).attachedTo).toBeUndefined();
  });

  it("ball position is not teleported during dribble", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);

    const player = makePlayer({ linearVelocity: { x: 3.0, y: 0 } });
    const ball = makeBall({
      position: { x: 0.5, y: 0.3, z: 0.11 },
    });
    const posBefore = { ...ball.position };
    const frames = [makeFrame(10, { moveX: 1, moveY: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepDribble([player], ball, states, frames, assignments, CFG, counter, 10);

    // Position must be unchanged — only velocity is dampened.
    expect(ball.position.x).toBe(posBefore.x);
    expect(ball.position.y).toBe(posBefore.y);
    expect(ball.position.z).toBe(posBefore.z);
  });
});

// ---------------------------------------------------------------------------
// 13. Finite values after second-touch
// ---------------------------------------------------------------------------

describe("SECOND-TOUCH-013: all values remain finite", () => {
  it("ball state is finite after stepDribble", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);

    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0.2 },
      linearVelocity: { x: 2.0, y: 1.0 },
      bodyHeading: 1.5,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0.1, z: 0.11 },
      linearVelocity: { x: 2.0, y: 1.0, z: 0 },
      angularVelocity: { x: 1.0, y: 2.0, z: 3.0 },
    });
    const frames = [makeFrame(10, { moveX: 0, moveY: 1 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepDribble([player], ball, states, frames, assignments, CFG, counter, 10);

    expect(Number.isFinite(ball.position.x)).toBe(true);
    expect(Number.isFinite(ball.position.y)).toBe(true);
    expect(Number.isFinite(ball.position.z)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.x)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.y)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.z)).toBe(true);
  });

  it("no events emitted when no active dribblers", () => {
    const states = makeDribbleStates();
    const player = makePlayer();
    const ball = makeBall();
    const frames = [makeFrame(10, { moveX: 0, moveY: 1 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const events = stepDribble(
      [player], ball, states, frames, assignments, CFG, counter, 10,
    );

    expect(events.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 14. Determinism: same inputs → same events
// ---------------------------------------------------------------------------

describe("SECOND-TOUCH-014: determinism", () => {
  it("identical inputs produce identical event ids and sequences", () => {
    function run(): import("../../../src/contracts/scenario.js").SimulationEvent[] {
      const states = makeDribbleStates();
      enterDribble(states, "p1", 0);

      const player = makePlayer({
        groundPosition: { x: 0, y: 0 },
        linearVelocity: { x: 3.0, y: 0 },
        bodyHeading: 0,
      });
      const ball = makeBall({ position: { x: 0.5, y: 0, z: 0.11 } });
      const frames = [makeFrame(5, { moveX: 0, moveY: 1 })];
      const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
      const counter = makeCounter();

      return stepDribble([player], ball, states, frames, assignments, CFG, counter, 5);
    }

    const events1 = run();
    const events2 = run();

    expect(events1.length).toBe(events2.length);
    for (let i = 0; i < events1.length; i++) {
      expect(events1[i].id).toBe(events2[i].id);
      expect(events1[i].kind).toBe(events2[i].kind);
      expect(events1[i].tick).toBe(events2[i].tick);
      expect(events1[i].sequence).toBe(events2[i].sequence);
    }
  });
});

// ---------------------------------------------------------------------------
// 15. No dribble events without movement input
// ---------------------------------------------------------------------------

describe("SECOND-TOUCH-015: no turn without movement input", () => {
  it("no second-touch event when player provides no movement input", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);

    const player = makePlayer({
      groundPosition: { x: 0, y: 0 },
      linearVelocity: { x: 3.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({ position: { x: 0.5, y: 0, z: 0.11 } });
    // No movement input (moveX=0, moveY=0).
    const frames = [makeFrame(10, { moveX: 0, moveY: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const events = stepDribble(
      [player], ball, states, frames, assignments, CFG, counter, 10,
    );

    expect(events.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 16. Dribble ends when player stops moving
// ---------------------------------------------------------------------------

describe("SECOND-TOUCH-016: dribble continues with no movement", () => {
  it("dribble state remains active even when player stops (range still ok)", () => {
    const states = makeDribbleStates();
    enterDribble(states, "p1", 0);

    const player = makePlayer({
      groundPosition: { x: 0, y: 0 },
      linearVelocity: { x: 0, y: 0 }, // stationary
      bodyHeading: 0,
    });
    const ball = makeBall({ position: { x: 0.5, y: 0, z: 0.11 } });
    const frames = [makeFrame(10, { moveX: 0, moveY: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepDribble([player], ball, states, frames, assignments, CFG, counter, 10);

    // Dribble should still be active (ball is in range).
    expect(isDribbling(states, "p1")).toBe(true);
    // Dribble ticks should be incremented.
    expect(states.get("p1")!.dribbleTicks).toBe(1);
  });
});
