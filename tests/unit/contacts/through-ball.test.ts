/**
 * @module through-ball-tests
 *
 * Tests for HUMAN-THROUGH-BALL: through-ball action (Q+J modifier) plays
 * the ball into space ahead of the best forward teammate.
 *
 * Tests:
 *  1. Through-ball with Q+J modifier finds the best forward teammate.
 *  2. Through-ball with directional input (moveX/moveY) overrides automatic targeting.
 *  3. Through-ball fallback to normal pass when no forward teammate exists.
 *  4. Determinism: same inputs produce same results.
 *  5. Ball independence preserved (position not modified, only velocity).
 *  6. All values finite.
 *  7. Through-ball action bit doesn't interfere with pass/shot bits (action priority).
 *  8. BodyHeading fallback when no input direction and no movement.
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
  FIRST_TOUCH_BIT,
  PASS_BIT,
  SHOT_BIT,
  THROUGH_BALL_BIT,
} from "../../../src/contracts/input.js";
import type { BallState, PlayerState } from "../../../src/contracts/state.js";
import type { InputFrame } from "../../../src/contracts/input.js";

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
    pressedButtons: opts?.pressedButtons ?? THROUGH_BALL_BIT,
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
// 1. Through-ball finds the best forward teammate (highest y)
// ---------------------------------------------------------------------------

describe("THROUGH-BALL-001: finds best forward teammate", () => {
  it("targets the teammate with the highest y value", () => {
    const passer = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0, y: 0 },
      bodyHeading: 0,
    });
    // Midfielder at y=10.
    const midfielder = makePlayer({
      playerId: "p2",
      groundPosition: { x: 2, y: 10 },
      teamId: "team-a",
      bodyHeading: Math.PI / 2,
      desiredVelocity: { x: 0, y: 3 },
    });
    // Forward at y=20 (best).
    const forward = makePlayer({
      playerId: "p3",
      groundPosition: { x: 1, y: 20 },
      teamId: "team-a",
      bodyHeading: Math.PI / 2,
      desiredVelocity: { x: 0, y: 5 },
    });
    // Opponent — should be ignored.
    const opponent = makePlayer({
      playerId: "opp1",
      groundPosition: { x: 3, y: 25 },
      teamId: "team-b",
      bodyHeading: Math.PI / 2,
    });

    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    const frames = [makeFrame(1)];
    const assignments = makeAssignments(
      { slot: "slot-1", playerId: "p1", teamId: "team-a" },
    );
    const counter = makeCounter();

    const result = stepContacts(
      [passer, midfielder, forward, opponent], ball, frames, assignments, CFG, counter, 1,
    );

    expect(result.touched).toBe(true);
    expect(result.events.length).toBe(1);
    expect(result.events[0].kind).toBe("through-ball");
    expect(result.events[0].label).toContain("p3");
    expect(result.events[0].label).toContain("through-ball");

    // The ball should move in the +Y direction (toward p3 who is ahead).
    expect(ball.linearVelocity.y).toBeGreaterThan(0);
  });

  it("emits a through-ball event kind", () => {
    const passer = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0, y: 0 },
    });
    const forward = makePlayer({
      playerId: "p2",
      groundPosition: { x: 0, y: 15 },
      teamId: "team-a",
      desiredVelocity: { x: 0, y: 3 },
    });

    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([passer, forward], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(true);
    expect(result.events[0].kind).toBe("through-ball");
    expect(result.events[0].id).toMatch(/^through-ball-/);
  });

  it("event payload contains contactType 'through-ball'", () => {
    const passer = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0, y: 0 },
    });
    const forward = makePlayer({
      playerId: "p2",
      groundPosition: { x: 0, y: 15 },
      teamId: "team-a",
      desiredVelocity: { x: 0, y: 3 },
    });

    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([passer, forward], ball, frames, assignments, CFG, counter, 1);
    const payload = result.events[0].payload as Record<string, unknown>;

    expect(payload.contactType).toBe("through-ball");
    expect(payload.playerId).toBe("p1");
    expect(payload.teamId).toBe("team-a");
  });
});

// ---------------------------------------------------------------------------
// 2. Directional input (moveX/moveY) overrides automatic targeting
// ---------------------------------------------------------------------------

describe("THROUGH-BALL-002: directional input overrides targeting", () => {
  it("pass direction follows moveX=1, moveY=0 (+X) when forward is at +Y", () => {
    const passer = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0, y: 0 },
      bodyHeading: 0,
    });
    const forward = makePlayer({
      playerId: "p2",
      groundPosition: { x: 0, y: 20 },
      teamId: "team-a",
      desiredVelocity: { x: 0, y: 3 },
    });

    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    // Explicitly override: human says pass right (+X), not toward the forward (+Y).
    const frames = [makeFrame(1, { moveX: 1, moveY: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([passer, forward], ball, frames, assignments, CFG, counter, 1);

    // Ball should move in +X direction (input direction), NOT +Y (automatic target).
    expect(ball.linearVelocity.x).toBeGreaterThan(0);
    expect(ball.linearVelocity.y).toBeCloseTo(0, 5);
  });

  it("pass direction follows moveX=-1, moveY=-1 diagonal input", () => {
    const passer = makePlayer({
      playerId: "p1",
      groundPosition: { x: 5, y: 5 },
      bodyHeading: 0,
    });
    const forward = makePlayer({
      playerId: "p2",
      groundPosition: { x: 5, y: 20 },
      teamId: "team-a",
      desiredVelocity: { x: 0, y: 3 },
    });

    const ball = makeBall({
      position: { x: 5, y: 5, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    const frames = [makeFrame(1, { moveX: -1, moveY: -1 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([passer, forward], ball, frames, assignments, CFG, counter, 1);

    // Ball should move in the -X,-Y direction (input).
    expect(ball.linearVelocity.x).toBeLessThan(0);
    expect(ball.linearVelocity.y).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Fallback to body heading when no forward teammate exists
// ---------------------------------------------------------------------------

describe("THROUGH-BALL-003: fallback when no forward teammate", () => {
  it("uses bodyHeading when passer is the only teammate", () => {
    const passer = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0, y: 0 },
      bodyHeading: Math.PI / 2, // facing +Y
    });

    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([passer], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(true);
    expect(result.events[0].kind).toBe("through-ball");
    // Body heading is PI/2 (+Y direction).
    expect(ball.linearVelocity.y).toBeGreaterThan(0);
    expect(ball.linearVelocity.x).toBeCloseTo(0, 5);
  });

  it("uses bodyHeading when only opponents are on the field", () => {
    const passer = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0, y: 0 },
      bodyHeading: 0, // facing +X
    });
    const opponent = makePlayer({
      playerId: "opp1",
      groundPosition: { x: 5, y: 10 },
      teamId: "team-b",
    });

    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([passer, opponent], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(true);
    expect(result.events[0].kind).toBe("through-ball");
    // Body heading is 0 (+X direction).
    expect(ball.linearVelocity.x).toBeGreaterThan(0);
    expect(ball.linearVelocity.y).toBeCloseTo(0, 5);
  });
});

// ---------------------------------------------------------------------------
// 4. Determinism: same inputs produce same results
// ---------------------------------------------------------------------------

describe("THROUGH-BALL-004: deterministic through-ball", () => {
  it("identical inputs produce identical events", () => {
    function run() {
      const passer = makePlayer({
        playerId: "p1",
        groundPosition: { x: 0, y: 0 },
      });
      const forward = makePlayer({
        playerId: "p2",
        groundPosition: { x: 1, y: 20 },
        teamId: "team-a",
        desiredVelocity: { x: 0, y: 4 },
      });

      const ball = makeBall({
        position: { x: 0.5, y: 0, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
      });

      const frames = [makeFrame(5)];
      const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
      const counter = makeCounter();

      return stepContacts([passer, forward], ball, frames, assignments, CFG, counter, 5);
    }

    const r1 = run();
    const r2 = run();

    expect(r1.events.length).toBe(r2.events.length);
    expect(r1.events[0].id).toBe(r2.events[0].id);
    expect(r1.events[0].kind).toBe(r2.events[0].kind);
    expect(r1.events[0].tick).toBe(r2.events[0].tick);
    expect(r1.events[0].label).toBe(r2.events[0].label);
  });

  it("deterministic event sequence with multiple teammates", () => {
    function run() {
      const passer = makePlayer({
        playerId: "p1",
        groundPosition: { x: 0, y: 0 },
      });
      const f1 = makePlayer({
        playerId: "p2",
        groundPosition: { x: 2, y: 10 },
        teamId: "team-a",
        desiredVelocity: { x: 0, y: 3 },
      });
      const f2 = makePlayer({
        playerId: "p3",
        groundPosition: { x: -1, y: 25 },
        teamId: "team-a",
        desiredVelocity: { x: 0, y: 5 },
      });

      const ball = makeBall({
        position: { x: 0.5, y: 0, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
      });

      const frames = [makeFrame(10)];
      const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
      const counter = makeCounter();

      return stepContacts([passer, f1, f2], ball, frames, assignments, CFG, counter, 10);
    }

    const r1 = run();
    const r2 = run();

    expect(r1.events[0].id).toBe(r2.events[0].id);
    // Both should target p3 (highest y = 25).
    expect(r1.events[0].label).toContain("p3");
    expect(r2.events[0].label).toContain("p3");
  });
});

// ---------------------------------------------------------------------------
// 5. Ball independence: position not modified, only velocity
// ---------------------------------------------------------------------------

describe("THROUGH-BALL-005: ball independence", () => {
  it("ball position is unchanged after through-ball", () => {
    const passer = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0, y: 0 },
    });
    const forward = makePlayer({
      playerId: "p2",
      groundPosition: { x: 0, y: 15 },
      teamId: "team-a",
      desiredVelocity: { x: 0, y: 3 },
    });

    const ball = makeBall({
      position: { x: 0.5, y: 0.3, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const posBefore = { ...ball.position };
    stepContacts([passer, forward], ball, frames, assignments, CFG, counter, 1);

    expect(ball.position.x).toBe(posBefore.x);
    expect(ball.position.y).toBe(posBefore.y);
    expect(ball.position.z).toBe(posBefore.z);
  });

  it("ball has no owner after through-ball", () => {
    const passer = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0, y: 0 },
    });
    const forward = makePlayer({
      playerId: "p2",
      groundPosition: { x: 0, y: 15 },
      teamId: "team-a",
      desiredVelocity: { x: 0, y: 3 },
    });

    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([passer, forward], ball, frames, assignments, CFG, counter, 1);

    expect((ball as unknown as Record<string, unknown>).ownerPlayerId).toBeUndefined();
    expect((ball as unknown as Record<string, unknown>).possessedBy).toBeUndefined();
    expect((ball as unknown as Record<string, unknown>).attachedTo).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 6. All values remain finite
// ---------------------------------------------------------------------------

describe("THROUGH-BALL-006: all values remain finite", () => {
  it("ball state is finite after through-ball to teammate", () => {
    const passer = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0.3, y: 0.2 },
      bodyHeading: 1.5,
    });
    const forward = makePlayer({
      playerId: "p2",
      groundPosition: { x: -1, y: 20 },
      teamId: "team-a",
      bodyHeading: 2.0,
      desiredVelocity: { x: -1, y: 4 },
    });

    const ball = makeBall({
      position: { x: 0.5, y: 0.1, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([passer, forward], ball, frames, assignments, CFG, counter, 1);

    expect(Number.isFinite(ball.linearVelocity.x)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.y)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.z)).toBe(true);
    expect(Number.isFinite(ball.position.x)).toBe(true);
    expect(Number.isFinite(ball.position.y)).toBe(true);
    expect(Number.isFinite(ball.position.z)).toBe(true);
  });

  it("ball state is finite after through-ball with directional input", () => {
    const passer = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0.3, y: 0.2 },
      bodyHeading: 1.5,
    });
    const forward = makePlayer({
      playerId: "p2",
      groundPosition: { x: 0, y: 20 },
      teamId: "team-a",
      desiredVelocity: { x: 0, y: 3 },
    });

    const ball = makeBall({
      position: { x: 0.5, y: 0.1, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    const frames = [makeFrame(1, { moveX: -0.5, moveY: 0.8 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([passer, forward], ball, frames, assignments, CFG, counter, 1);

    expect(Number.isFinite(ball.linearVelocity.x)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.y)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.z)).toBe(true);
  });

  it("ball state is finite after through-ball fallback (no teammates)", () => {
    const passer = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0.3, y: 0.2 },
      bodyHeading: 1.5,
    });

    const ball = makeBall({
      position: { x: 0.5, y: 0.1, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([passer], ball, frames, assignments, CFG, counter, 1);

    expect(Number.isFinite(ball.linearVelocity.x)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.y)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.z)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Action priority: through-ball vs pass vs shot
// ---------------------------------------------------------------------------

describe("THROUGH-BALL-007: action priority", () => {
  it("shot takes priority over through-ball", () => {
    const player = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const forward = makePlayer({
      playerId: "p2",
      groundPosition: { x: 0, y: 20 },
      teamId: "team-a",
      desiredVelocity: { x: 0, y: 3 },
    });

    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    // Both SHOT and THROUGH_BALL pressed — shot wins.
    const frames = [makeFrame(1, { pressedButtons: SHOT_BIT | THROUGH_BALL_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player, forward], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(true);
    expect(result.events[0].kind).toBe("shot");
  });

  it("pass takes priority over through-ball", () => {
    const player = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const forward = makePlayer({
      playerId: "p2",
      groundPosition: { x: 0, y: 20 },
      teamId: "team-a",
      desiredVelocity: { x: 0, y: 3 },
    });

    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    // Both PASS and THROUGH_BALL pressed — pass wins.
    const frames = [makeFrame(1, { pressedButtons: PASS_BIT | THROUGH_BALL_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player, forward], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(true);
    expect(result.events[0].kind).toBe("pass");
  });

  it("through-ball takes priority over first-touch", () => {
    const player = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const forward = makePlayer({
      playerId: "p2",
      groundPosition: { x: 0, y: 20 },
      teamId: "team-a",
      desiredVelocity: { x: 0, y: 3 },
    });

    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    // Both THROUGH_BALL and FIRST_TOUCH pressed — through-ball wins.
    const frames = [makeFrame(1, { pressedButtons: THROUGH_BALL_BIT | FIRST_TOUCH_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player, forward], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(true);
    expect(result.events[0].kind).toBe("through-ball");
  });
});

// ---------------------------------------------------------------------------
// 8. BodyHeading fallback when no movement direction and no input
// ---------------------------------------------------------------------------

describe("THROUGH-BALL-008: bodyHeading fallback", () => {
  it("uses desiredVelocity direction when forward teammate is stationary", () => {
    const passer = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0, y: 0 },
      bodyHeading: 0,
    });
    // Forward teammate is stationary — has no desiredVelocity movement.
    // But has a bodyHeading of PI/2 (+Y direction).
    const forward = makePlayer({
      playerId: "p2",
      groundPosition: { x: 0, y: 15 },
      teamId: "team-a",
      desiredVelocity: { x: 0, y: 0 }, // stationary
      bodyHeading: Math.PI / 2, // facing +Y
    });

    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([passer, forward], ball, frames, assignments, CFG, counter, 1);

    // Ball should move toward the forward (general +Y direction).
    expect(ball.linearVelocity.y).toBeGreaterThan(0);
  });

  it("uses desiredVelocity when forward teammate is moving", () => {
    const passer = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0, y: 0 },
      bodyHeading: 0,
    });
    // Forward teammate is moving in the +X direction.
    const forward = makePlayer({
      playerId: "p2",
      groundPosition: { x: 5, y: 15 },
      teamId: "team-a",
      desiredVelocity: { x: 3, y: 0 }, // moving right
      bodyHeading: 0,
    });

    const ball = makeBall({
      position: { x: 0, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([passer, forward], ball, frames, assignments, CFG, counter, 1);

    // Ball should move in +X direction (toward the point ahead of the forward
    // in their movement direction).
    expect(ball.linearVelocity.x).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Normal pass still works independently
// ---------------------------------------------------------------------------

describe("THROUGH-BALL-009: normal pass unaffected", () => {
  it("PASS_BIT alone still produces a normal pass event", () => {
    const player = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    const frames = [makeFrame(1, { pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(true);
    expect(result.events[0].kind).toBe("pass");
    expect(result.events[0].id).toMatch(/^pass-/);
  });
});

// ---------------------------------------------------------------------------
// 10. Through-ball velocity uses pass exit speed
// ---------------------------------------------------------------------------

describe("THROUGH-BALL-010: pass exit speed", () => {
  it("through-ball velocity magnitude matches pass exit speed", () => {
    const passer = makePlayer({
      playerId: "p1",
      groundPosition: { x: 0, y: 0 },
    });
    const forward = makePlayer({
      playerId: "p2",
      groundPosition: { x: 0, y: 15 },
      teamId: "team-a",
      desiredVelocity: { x: 0, y: 3 },
    });

    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });

    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([passer, forward], ball, frames, assignments, CFG, counter, 1);

    // Horizontal speed should be the pass exit speed.
    const hSpeed = Math.sqrt(
      ball.linearVelocity.x ** 2 + ball.linearVelocity.y ** 2,
    );
    expect(hSpeed).toBeCloseTo(FOUNDATION_PASS_V1.exitSpeed.value, 1);

    // Vertical should be the pass vertical component.
    expect(ball.linearVelocity.z).toBeCloseTo(
      FOUNDATION_PASS_V1.exitSpeed.value * FOUNDATION_PASS_V1.verticalComponent.value,
      2,
    );
  });
});
