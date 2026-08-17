/**
 * @module pass-direction-tests
 *
 * Tests for HUMAN-PASS-DIRECTION-CONTROL: pass direction uses moveX/moveY
 * input when available, falls back to bodyHeading. Plus lofted pass support.
 *
 * Tests:
 *  1. Non-zero moveX/moveY produces pass in that direction (not bodyHeading).
 *  2. Zero moveX/moveY falls back to bodyHeading.
 *  3. Normalized direction works correctly for diagonal input.
 *  4. Lofted pass (LOFTED_PASS_BIT) produces different trajectory than normal pass.
 *  5. Lofted pass has higher vertical component.
 *  6. Keyboard modifier (E+PASS) produces LOFTED_PASS_BIT.
 *  7. Determinism: same inputs produce same results.
 *  8. Finite values after pass.
 *  9. Pass direction from moveX/moveY respects the direction exactly.
 * 10. Normal pass and lofted pass have the same event kind differentiation.
 *
 * No Math.random, Date, DOM, or Node I/O in src/simulation.
 */

import { describe, it, expect } from "vitest";

import { stepContacts } from "../../../src/simulation/contacts/contact-system.js";
import {
  FOUNDATION_CONTACT_V1,
  FOUNDATION_PASS_V1,
  FOUNDATION_SHOT_V1,
  FOUNDATION_LOFTED_PASS_V1,
} from "../../../src/simulation/config/foundation.js";
import {
  FIRST_TOUCH_BIT,
  PASS_BIT,
  SHOT_BIT,
  LOFTED_PASS_BIT,
} from "../../../src/contracts/input.js";
import type { BallState, PlayerState } from "../../../src/contracts/state.js";
import type { InputFrame } from "../../../src/contracts/input.js";
import type { SimulationEvent } from "../../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CFG = FOUNDATION_CONTACT_V1;

function makePlayer(overrides?: Partial<PlayerState>): PlayerState {
  return {
    playerId: "p1",
    teamId: "team-a",
    groundPosition: { x: 0, y: 0 },
    linearVelocity: { x: 0, y: 0 },
    desiredVelocity: { x: 0, y: 0 },
    bodyHeading: 0,
    desiredHeading: 0,
    ...overrides,
  };
}

function makeBall(overrides?: Partial<BallState>): BallState {
  return {
    position: { x: 0.5, y: 0, z: 0.11 },
    linearVelocity: { x: 0.5, y: 0, z: 0 },
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
    pressedButtons?: number;
    heldButtons?: number;
    moveX?: number;
    moveY?: number;
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
    pressedButtons: opts?.pressedButtons ?? PASS_BIT,
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

// ---------------------------------------------------------------------------
// 1. Non-zero moveX/moveY produces pass in that direction
// ---------------------------------------------------------------------------

describe("PASS-DIRECTION-001: pass direction uses moveX/moveY when non-zero", () => {
  it("pass direction follows moveX=1, moveY=0 (+X direction) even when bodyHeading faces -X", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: Math.PI, // facing -X
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    // Input says move in +X direction.
    const frames = [makeFrame(1, { moveX: 1, moveY: 0, pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Ball should move in +X direction (input direction), NOT -X (bodyHeading).
    expect(ball.linearVelocity.x).toBeGreaterThan(0);
    expect(ball.linearVelocity.y).toBeCloseTo(0, 5);
  });

  it("pass direction follows moveY=1 (+Y direction) even when bodyHeading faces +X", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0, // facing +X
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    // Input says move in +Y direction.
    const frames = [makeFrame(1, { moveX: 0, moveY: 1, pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Ball should move in +Y direction (input direction), NOT +X (bodyHeading).
    expect(ball.linearVelocity.x).toBeCloseTo(0, 5);
    expect(ball.linearVelocity.y).toBeGreaterThan(0);
  });

  it("pass direction follows moveX=-1, moveY=-1 diagonal input", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0.3 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: -1, moveY: -1, pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Ball should move in the -X,-Y direction.
    expect(ball.linearVelocity.x).toBeLessThan(0);
    expect(ball.linearVelocity.y).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Zero moveX/moveY falls back to bodyHeading
// ---------------------------------------------------------------------------

describe("PASS-DIRECTION-002: zero input falls back to bodyHeading", () => {
  it("pass direction follows bodyHeading when moveX/moveY are both zero", () => {
    const heading = Math.PI / 2; // facing +Y
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: heading,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: 0, moveY: 0, pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Ball should move in +Y direction (per bodyHeading = PI/2).
    expect(ball.linearVelocity.x).toBeCloseTo(0, 5);
    expect(ball.linearVelocity.y).toBeGreaterThan(0);
  });

  it("pass direction follows bodyHeading when no frame exists for the player", () => {
    const heading = Math.PI; // facing -X
    const player = makePlayer({
      playerId: "cpu-p1",
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: heading,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    // No frame for cpu-p1 — simulated CPU pass.
    const frames: InputFrame[] = [];
    const assignments = makeAssignments({ slot: "cpu-slot", playerId: "cpu-p1", teamId: "team-a" });
    const counter = makeCounter();

    // CPU doesn't use PASS_BIT via frames — this is a fallback test.
    // When there's no frame, the player isn't in candidates.
    // We need a frame for this player to trigger pass.
    const framesWithPass = [makeFrame(1, { controlSlot: "cpu-slot", pressedButtons: PASS_BIT })];
    stepContacts([player], ball, framesWithPass, assignments, CFG, counter, 1);

    // Ball should move in -X direction (per bodyHeading = PI).
    expect(ball.linearVelocity.x).toBeLessThan(0);
    expect(ball.linearVelocity.y).toBeCloseTo(0, 5);
  });
});

// ---------------------------------------------------------------------------
// 3. Normalized direction works correctly
// ---------------------------------------------------------------------------

describe("PASS-DIRECTION-003: normalized direction", () => {
  it("diagonal input (moveX=1, moveY=1) normalizes to 45-degree pass", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: 1, moveY: 1, pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Normalized direction: (1,1) / sqrt(2) → 45-degree angle.
    // vx ≈ vy.
    expect(ball.linearVelocity.x).toBeGreaterThan(0);
    expect(ball.linearVelocity.y).toBeGreaterThan(0);
    expect(ball.linearVelocity.x).toBeCloseTo(ball.linearVelocity.y, 3);

    // Speed should be the pass exit speed (8.0 m/s).
    const speed = Math.sqrt(ball.linearVelocity.x ** 2 + ball.linearVelocity.y ** 2);
    expect(speed).toBeCloseTo(FOUNDATION_PASS_V1.exitSpeed.value, 1);
  });
});

// ---------------------------------------------------------------------------
// 4. Lofted pass produces different trajectory than normal pass
// ---------------------------------------------------------------------------

describe("PASS-DIRECTION-004: lofted pass vs normal pass", () => {
  it("lofted pass has higher vertical component than normal pass", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });

    // Normal pass.
    const ballNormal = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const framesNormal = [makeFrame(1, { pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counterNormal = makeCounter();
    stepContacts([player], ballNormal, framesNormal, assignments, CFG, counterNormal, 1);

    // Lofted pass.
    const ballLofted = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const framesLofted = [makeFrame(1, { pressedButtons: LOFTED_PASS_BIT })];
    const counterLofted = makeCounter();
    stepContacts([player], ballLofted, framesLofted, assignments, CFG, counterLofted, 1);

    // Lofted pass must have higher vz than normal pass.
    expect(ballLofted.linearVelocity.z).toBeGreaterThan(ballNormal.linearVelocity.z);

    // Lofted vz should be ~exitSpeed * 0.25 = 7.5 * 0.25 = 1.875.
    expect(ballLofted.linearVelocity.z).toBeCloseTo(
      FOUNDATION_LOFTED_PASS_V1.exitSpeed.value * FOUNDATION_LOFTED_PASS_V1.verticalComponent.value,
      2,
    );

    // Normal pass vz should be ~exitSpeed * 0.05 = 8.0 * 0.05 = 0.4.
    expect(ballNormal.linearVelocity.z).toBeCloseTo(
      FOUNDATION_PASS_V1.exitSpeed.value * FOUNDATION_PASS_V1.verticalComponent.value,
      2,
    );
  });

  it("lofted pass emits 'lofted-pass' event kind", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { pressedButtons: LOFTED_PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(true);
    expect(result.events.length).toBe(1);
    expect(result.events[0].kind).toBe("lofted-pass");
    expect(result.events[0].id).toMatch(/^lofted-pass-/);
  });

  it("lofted pass uses moveX/moveY direction like normal pass", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: Math.PI, // facing -X (should be overridden by input)
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: 0, moveY: 1, pressedButtons: LOFTED_PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Ball should move in +Y direction (per input), not -X (bodyHeading).
    expect(ball.linearVelocity.x).toBeCloseTo(0, 5);
    expect(ball.linearVelocity.y).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Lofted pass priority: shot > pass > lofted-pass
// ---------------------------------------------------------------------------

describe("PASS-DIRECTION-005: action priority", () => {
  it("shot takes priority over pass", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    // Both SHOT and PASS pressed — shot wins.
    const frames = [makeFrame(1, { pressedButtons: SHOT_BIT | PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.events[0].kind).toBe("shot");
  });

  it("pass takes priority over lofted-pass", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    // Both PASS and LOFTED_PASS pressed — pass wins.
    const frames = [makeFrame(1, { pressedButtons: PASS_BIT | LOFTED_PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.events[0].kind).toBe("pass");
  });
});

// ---------------------------------------------------------------------------
// 6. Determinism: same inputs produce same results
// ---------------------------------------------------------------------------

describe("PASS-DIRECTION-006: deterministic pass direction", () => {
  it("identical inputs produce identical events", () => {
    function run(): SimulationEvent[] {
      const player = makePlayer({
        groundPosition: { x: 0.3, y: 0 },
        bodyHeading: Math.PI,
      });
      const ball = makeBall({
        position: { x: 0.5, y: 0, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
      });
      const frames = [makeFrame(5, { moveX: 0, moveY: 1, pressedButtons: PASS_BIT })];
      const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
      const counter = makeCounter();
      const result = stepContacts([player], ball, frames, assignments, CFG, counter, 5);
      return result.events;
    }

    const events1 = run();
    const events2 = run();

    expect(events1.length).toBe(events2.length);
    for (let i = 0; i < events1.length; i++) {
      expect(events1[i].id).toBe(events2[i].id);
      expect(events1[i].kind).toBe(events2[i].kind);
      expect(events1[i].tick).toBe(events2[i].tick);
    }
  });

  it("lofted pass determinism", () => {
    function run(): SimulationEvent[] {
      const player = makePlayer({
        groundPosition: { x: 0.3, y: 0 },
        bodyHeading: 0,
      });
      const ball = makeBall({
        position: { x: 0.5, y: 0, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
      });
      const frames = [makeFrame(5, { moveX: -1, moveY: 0, pressedButtons: LOFTED_PASS_BIT })];
      const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
      const counter = makeCounter();
      const result = stepContacts([player], ball, frames, assignments, CFG, counter, 5);
      return result.events;
    }

    const events1 = run();
    const events2 = run();

    expect(events1.length).toBe(events2.length);
    expect(events1[0].id).toBe(events2[0].id);
  });
});

// ---------------------------------------------------------------------------
// 7. Finite values after pass
// ---------------------------------------------------------------------------

describe("PASS-DIRECTION-007: all values remain finite", () => {
  it("ball state is finite after pass with moveX/moveY input", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0.2 },
      bodyHeading: 1.5,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0.1, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: -0.5, moveY: 0.8, pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(Number.isFinite(ball.linearVelocity.x)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.y)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.z)).toBe(true);
  });

  it("ball state is finite after lofted pass", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0.2 },
      bodyHeading: 1.5,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0.1, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: 0.7, moveY: -0.3, pressedButtons: LOFTED_PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(Number.isFinite(ball.linearVelocity.x)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.y)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.z)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. Ball position is never teleported
// ---------------------------------------------------------------------------

describe("PASS-DIRECTION-008: ball position continuity", () => {
  it("ball position is unchanged after pass with moveX/moveY", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0.3, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: 1, moveY: 1, pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const posBefore = { ...ball.position };
    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(ball.position.x).toBe(posBefore.x);
    expect(ball.position.y).toBe(posBefore.y);
    expect(ball.position.z).toBe(posBefore.z);
  });

  it("ball position is unchanged after lofted pass", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0.3, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { pressedButtons: LOFTED_PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const posBefore = { ...ball.position };
    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(ball.position.x).toBe(posBefore.x);
    expect(ball.position.y).toBe(posBefore.y);
    expect(ball.position.z).toBe(posBefore.z);
  });
});

// ---------------------------------------------------------------------------
// 9. Ball remains independent (no parent/owner)
// ---------------------------------------------------------------------------

describe("PASS-DIRECTION-009: ball independence after pass", () => {
  it("ball has no ownerPlayerId after pass with moveX/moveY", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: 1, moveY: 0, pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect((ball as unknown as Record<string, unknown>).ownerPlayerId).toBeUndefined();
    expect((ball as unknown as Record<string, unknown>).possessedBy).toBeUndefined();
    expect((ball as unknown as Record<string, unknown>).attachedTo).toBeUndefined();
  });

  it("ball has no ownerPlayerId after lofted pass", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { pressedButtons: LOFTED_PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect((ball as unknown as Record<string, unknown>).ownerPlayerId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 10. Normal pass event kind is still "pass"
// ---------------------------------------------------------------------------

describe("PASS-DIRECTION-010: normal pass event kind unchanged", () => {
  it("PASS_BIT still produces 'pass' event kind", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: 0, moveY: 1, pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.events[0].kind).toBe("pass");
    expect(result.events[0].id).toMatch(/^pass-/);
  });

  it("LOFTED_PASS_BIT produces 'lofted-pass' event kind", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: 0, moveY: 1, pressedButtons: LOFTED_PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.events[0].kind).toBe("lofted-pass");
    expect(result.events[0].id).toMatch(/^lofted-pass-/);
  });
});
