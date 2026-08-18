/**
 * @module shot-direction-tests
 *
 * Tests for HUMAN-SHOT-DIRECTION-CONTROL: shot direction uses moveX/moveY
 * input when available, falls back to bodyHeading.
 *
 * Tests:
 *  1. Non-zero moveX/moveY produces shot in that direction (not bodyHeading).
 *  2. Zero moveX/moveY falls back to bodyHeading.
 *  3. Normalized direction works correctly for diagonal input.
 *  4. Shot power/vertical component unchanged by directional input.
 *  5. SHOT_BIT priority: directional shot doesn't interfere with pass/lofted-pass.
 *  6. Determinism: same inputs produce same results.
 *  7. Ball remains independent 3D entity (no teleport, no ownership).
 *  8. All values finite after shot.
 *
 * No Math.random, Date, DOM, or Node I/O in src/simulation.
 */

import { describe, it, expect } from "vitest";

import { stepContacts } from "../../../src/simulation/contacts/contact-system.js";
import {
  FOUNDATION_CONTACT_V1,
  FOUNDATION_PASS_V1,
  FOUNDATION_SHOT_V1,
} from "../../../src/simulation/config/foundation.js";
import {
  SHOT_BIT,
  PASS_BIT,
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
    pressedButtons: opts?.pressedButtons ?? SHOT_BIT,
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
// 1. Non-zero moveX/moveY produces shot in that direction
// ---------------------------------------------------------------------------

describe("SHOT-DIRECTION-001: shot direction uses moveX/moveY when non-zero", () => {
  it("shot direction follows moveX=1, moveY=0 (+X direction) even when bodyHeading faces -X", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: Math.PI, // facing -X
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: 1, moveY: 0, pressedButtons: SHOT_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Ball should move in +X direction (input direction), NOT -X (bodyHeading).
    expect(ball.linearVelocity.x).toBeGreaterThan(0);
    expect(ball.linearVelocity.y).toBeCloseTo(0, 5);
  });

  it("shot direction follows moveY=1 (+Y direction) even when bodyHeading faces +X", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0, // facing +X
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: 0, moveY: 1, pressedButtons: SHOT_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Ball should move in +Y direction (input direction), NOT +X (bodyHeading).
    expect(ball.linearVelocity.x).toBeCloseTo(0, 5);
    expect(ball.linearVelocity.y).toBeGreaterThan(0);
  });

  it("shot direction follows moveX=-1, moveY=-1 diagonal input", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0.3 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: -1, moveY: -1, pressedButtons: SHOT_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Ball should move in the -X, -Y direction.
    expect(ball.linearVelocity.x).toBeLessThan(0);
    expect(ball.linearVelocity.y).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Zero moveX/moveY falls back to bodyHeading
// ---------------------------------------------------------------------------

describe("SHOT-DIRECTION-002: zero input falls back to bodyHeading", () => {
  it("shot direction follows bodyHeading when moveX/moveY are both zero", () => {
    const heading = Math.PI / 2; // facing +Y
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: heading,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: 0, moveY: 0, pressedButtons: SHOT_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Ball should move in +Y direction (per bodyHeading = PI/2).
    expect(ball.linearVelocity.x).toBeCloseTo(0, 5);
    expect(ball.linearVelocity.y).toBeGreaterThan(0);
  });

  it("shot direction follows bodyHeading when no frame exists for the player", () => {
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
    // Frame for cpu-p1 with SHOT_BIT but no directional input.
    const framesWithShot = [makeFrame(1, { controlSlot: "cpu-slot", pressedButtons: SHOT_BIT })];
    const assignments = makeAssignments({ slot: "cpu-slot", playerId: "cpu-p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, framesWithShot, assignments, CFG, counter, 1);

    // Ball should move in -X direction (per bodyHeading = PI).
    expect(ball.linearVelocity.x).toBeLessThan(0);
    expect(ball.linearVelocity.y).toBeCloseTo(0, 5);
  });
});

// ---------------------------------------------------------------------------
// 3. Normalized direction works correctly
// ---------------------------------------------------------------------------

describe("SHOT-DIRECTION-003: normalized direction", () => {
  it("diagonal input (moveX=1, moveY=1) normalizes to 45-degree shot", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: 1, moveY: 1, pressedButtons: SHOT_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Normalized direction: (1,1) / sqrt(2) → 45-degree angle.
    expect(ball.linearVelocity.x).toBeGreaterThan(0);
    expect(ball.linearVelocity.y).toBeGreaterThan(0);
    expect(ball.linearVelocity.x).toBeCloseTo(ball.linearVelocity.y, 3);

    // Speed should be the shot exit speed (12.0 m/s).
    const speed = Math.sqrt(ball.linearVelocity.x ** 2 + ball.linearVelocity.y ** 2);
    expect(speed).toBeCloseTo(FOUNDATION_SHOT_V1.exitSpeed.value, 1);
  });

  it("non-unit input (moveX=2, moveY=0) normalizes to +X shot", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: Math.PI, // facing -X
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: 2, moveY: 0, pressedButtons: SHOT_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Ball should move in +X direction, speed = shot exit speed.
    expect(ball.linearVelocity.x).toBeCloseTo(FOUNDATION_SHOT_V1.exitSpeed.value, 1);
    expect(ball.linearVelocity.y).toBeCloseTo(0, 5);
  });
});

// ---------------------------------------------------------------------------
// 4. Shot power/vertical component unchanged by directional input
// ---------------------------------------------------------------------------

describe("SHOT-DIRECTION-004: shot power unchanged by direction", () => {
  it("shot with directional input has same vertical component as bodyHeading shot", () => {
    // Shot with directional input.
    const playerDir = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: Math.PI,
    });
    const ballDir = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const framesDir = [makeFrame(1, { moveX: 0, moveY: 1, pressedButtons: SHOT_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counterDir = makeCounter();
    stepContacts([playerDir], ballDir, framesDir, assignments, CFG, counterDir, 1);

    // Shot with zero input (bodyHeading).
    const playerBH = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: Math.PI / 2,
    });
    const ballBH = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const framesBH = [makeFrame(2, { moveX: 0, moveY: 0, pressedButtons: SHOT_BIT })];
    const assignmentsBH = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counterBH = makeCounter();
    stepContacts([playerBH], ballBH, framesBH, assignmentsBH, CFG, counterBH, 2);

    // Vertical components must be identical — direction doesn't affect power/loft.
    expect(ballDir.linearVelocity.z).toBeCloseTo(ballBH.linearVelocity.z, 10);

    // Vertical should be exitSpeed * verticalComponent = 12.0 * 0.15 = 1.8.
    expect(ballDir.linearVelocity.z).toBeCloseTo(
      FOUNDATION_SHOT_V1.exitSpeed.value * FOUNDATION_SHOT_V1.verticalComponent.value,
      2,
    );
  });

  it("shot speed magnitude is always shot exit speed regardless of direction", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: -0.7, moveY: 0.3, pressedButtons: SHOT_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Horizontal speed = exitSpeed * sqrt(dirX^2 + dirY^2) = exitSpeed (normalized).
    const hSpeed = Math.sqrt(ball.linearVelocity.x ** 2 + ball.linearVelocity.y ** 2);
    expect(hSpeed).toBeCloseTo(FOUNDATION_SHOT_V1.exitSpeed.value, 1);
  });
});

// ---------------------------------------------------------------------------
// 5. SHOT_BIT priority: directional shot doesn't interfere with pass
// ---------------------------------------------------------------------------

describe("SHOT-DIRECTION-005: action priority", () => {
  it("shot takes priority over pass when both bits are set", () => {
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
    expect(result.events[0].id).toMatch(/^shot-/);
  });

  it("shot still works when only SHOT_BIT is pressed", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { pressedButtons: SHOT_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.events[0].kind).toBe("shot");
  });
});

// ---------------------------------------------------------------------------
// 6. Determinism: same inputs produce same results
// ---------------------------------------------------------------------------

describe("SHOT-DIRECTION-006: deterministic shot direction", () => {
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
      const frames = [makeFrame(5, { moveX: 0, moveY: 1, pressedButtons: SHOT_BIT })];
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

  it("directional shot determinism with diagonal input", () => {
    function run(): SimulationEvent[] {
      const player = makePlayer({
        groundPosition: { x: 0.3, y: 0 },
        bodyHeading: 0,
      });
      const ball = makeBall({
        position: { x: 0.5, y: 0, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
      });
      const frames = [makeFrame(5, { moveX: 1, moveY: 1, pressedButtons: SHOT_BIT })];
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
// 7. Ball remains independent (no teleport, no ownership)
// ---------------------------------------------------------------------------

describe("SHOT-DIRECTION-007: ball independence after shot", () => {
  it("ball position is unchanged after shot with moveX/moveY", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0.3, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: 1, moveY: 1, pressedButtons: SHOT_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const posBefore = { ...ball.position };
    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(ball.position.x).toBe(posBefore.x);
    expect(ball.position.y).toBe(posBefore.y);
    expect(ball.position.z).toBe(posBefore.z);
  });

  it("ball has no ownerPlayerId after shot with moveX/moveY", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: 1, moveY: 0, pressedButtons: SHOT_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect((ball as unknown as Record<string, unknown>).ownerPlayerId).toBeUndefined();
    expect((ball as unknown as Record<string, unknown>).possessedBy).toBeUndefined();
    expect((ball as unknown as Record<string, unknown>).attachedTo).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 8. All values finite after shot
// ---------------------------------------------------------------------------

describe("SHOT-DIRECTION-008: all values remain finite", () => {
  it("ball state is finite after shot with moveX/moveY input", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0.2 },
      bodyHeading: 1.5,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0.1, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: -0.5, moveY: 0.8, pressedButtons: SHOT_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(Number.isFinite(ball.linearVelocity.x)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.y)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.z)).toBe(true);
    expect(Number.isFinite(ball.angularVelocity.x)).toBe(true);
    expect(Number.isFinite(ball.angularVelocity.y)).toBe(true);
    expect(Number.isFinite(ball.angularVelocity.z)).toBe(true);
  });

  it("ball state is finite after shot with zero input (bodyHeading fallback)", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0.2 },
      bodyHeading: 1.5,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0.1, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { moveX: 0, moveY: 0, pressedButtons: SHOT_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(Number.isFinite(ball.linearVelocity.x)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.y)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.z)).toBe(true);
  });
});
