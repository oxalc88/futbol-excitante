/**
 * @module contact-system-tests
 *
 * Tests for player-ball first-touch contact system (PLAYABLE-FIRST-TOUCH).
 *
 * Tests:
 *  1. Approaching player + within radius + FIRST_TOUCH bit → touch event,
 *     lastTouchRef set, velocity changes, ball remains independent.
 *  2. No teleport: ball position is continuous across contact.
 *  3. Without FIRST_TOUCH bit or out of range → no lastTouchRef change.
 *  4. Possession-evidence oracle: lastTouchRef change requires a touch event.
 *  5. Ball independence: ball state is not parented to any player.
 *  6. Multiple eligible players: closest wins, deterministic.
 *  7. Integration with simulation loop: events appear in StepResult.
 *  8. Existing HARD_INVARIANTs: finite numbers, ball continuity, determinism.
 *
 * No Math.random, Date, DOM, or Node I/O in src/simulation.
 */

import { describe, it, expect, beforeEach } from "vitest";

import { stepContacts } from "../../../src/simulation/contacts/contact-system.js";
import { FOUNDATION_CONTACT_V1, FOUNDATION_PASS_V1 } from "../../../src/simulation/config/foundation.js";
import { FIRST_TOUCH_BIT, PASS_BIT } from "../../../src/contracts/input.js";
import type { BallState, PlayerState } from "../../../src/contracts/state.js";
import type { InputFrame } from "../../../src/contracts/input.js";
import type { SimulationEvent } from "../../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CFG = FOUNDATION_CONTACT_V1;
const RADIUS = CFG.contactRadius.value;

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
    linearVelocity: { x: 3.0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 2.0 },
    regime: "ground-roll",
    lastTouchRef: null,
    ...overrides,
  } as BallState;
}

function makeFrame(
  tick: number,
  opts?: { controlSlot?: string; pressedButtons?: number; heldButtons?: number },
): InputFrame {
  return {
    tick,
    sourceId: "test",
    controlSlot: opts?.controlSlot ?? "slot-1",
    moveX: 0,
    moveY: 0,
    sprint: 0,
    heldButtons: opts?.heldButtons ?? 0,
    pressedButtons: opts?.pressedButtons ?? FIRST_TOUCH_BIT,
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
// 1. Basic first-touch: player in range + FIRST_TOUCH bit → contact event
// ---------------------------------------------------------------------------

describe("CONTACT-TOUCH-001: basic first-touch contact", () => {
  it("emits a player-ball-contact event when player is in range with FIRST_TOUCH bit", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(true);
    expect(result.events.length).toBe(1);
    expect(result.events[0].kind).toBe("player-ball-contact");
    expect(result.events[0].tick).toBe(1);
    expect(result.events[0].sequence).toBe(1);
  });

  it("sets ball.lastTouchRef to the contact event id", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(ball.lastTouchRef).toBe(result.events[0].id);
    expect(ball.lastTouchRef).toMatch(/^player-ball-contact-1-/);
  });

  it("changes ball velocity on contact", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Ball velocity should change (outgoing direction based on body heading).
    // Body heading is 0 (facing +X), so outgoing should be along +X.
    const speed = Math.sqrt(ball.linearVelocity.x ** 2 + ball.linearVelocity.y ** 2);
    expect(speed).toBeGreaterThan(0);
    expect(ball.linearVelocity.x).toBeGreaterThan(0);
  });

  it("event payload contains incoming and outgoing ball state snapshots", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);
    const payload = result.events[0].payload as Record<string, unknown>;

    expect(payload.incoming).toBeDefined();
    expect(payload.outgoing).toBeDefined();
    expect(payload.contactType).toBe("first-touch");
    expect(payload.playerId).toBe("p1");
    expect(payload.teamId).toBe("team-a");

    const incoming = payload.incoming as { position: { x: number; y: number; z: number }; linearVelocity: { x: number; y: number; z: number } };
    expect(incoming.position.x).toBe(0.5);
    expect(incoming.linearVelocity.x).toBe(2.0);
  });
});

// ---------------------------------------------------------------------------
// 2. No teleport: ball position is continuous (no snap to player)
// ---------------------------------------------------------------------------

describe("CONTACT-NO-TELEPORT-001: ball position continuity", () => {
  it("does not teleport ball position to player ground position", () => {
    const player = makePlayer({
      groundPosition: { x: 0, y: 0 },
      bodyHeading: Math.PI, // facing -X
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0.3, z: 0.5 }, // airborne ball
      linearVelocity: { x: -2.0, y: 0, z: -5.0 },
      regime: "airborne",
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const ballPosBefore = { ...ball.position };
    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Ball position must be unchanged — only velocity is modified.
    expect(ball.position.x).toBe(ballPosBefore.x);
    expect(ball.position.y).toBe(ballPosBefore.y);
    expect(ball.position.z).toBe(ballPosBefore.z);
  });

  it("ball z stays reasonable on ground touch", () => {
    const player = makePlayer({
      groundPosition: { x: 0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 5.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Ball z should remain at 0.11 (no teleport to player z or any other height).
    expect(ball.position.z).toBe(0.11);
  });
});

// ---------------------------------------------------------------------------
// 3. No touch without FIRST_TOUCH bit or out of range
// ---------------------------------------------------------------------------

describe("CONTACT-NO-TOUCH-001: no touch without input or range", () => {
  it("no touch event when FIRST_TOUCH bit is not set", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    // Frame without FIRST_TOUCH bit.
    const frames = [makeFrame(1, { pressedButtons: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(false);
    expect(result.events.length).toBe(0);
    expect(ball.lastTouchRef).toBeNull();
  });

  it("no touch event when player is out of range", () => {
    const player = makePlayer({
      groundPosition: { x: 5.0, y: 0 }, // far away
    });
    const ball = makeBall({
      position: { x: 0, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(false);
    expect(result.events.length).toBe(0);
    expect(ball.lastTouchRef).toBeNull();
  });

  it("no touch event when ball speed exceeds maxApproachSpeed", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 50.0, y: 0, z: 0 }, // too fast
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(false);
    expect(result.events.length).toBe(0);
    expect(ball.lastTouchRef).toBeNull();
  });

  it("no touch event when no input frames are provided", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, [], assignments, CFG, counter, 1);

    expect(result.touched).toBe(false);
    expect(result.events.length).toBe(0);
    expect(ball.lastTouchRef).toBeNull();
  });

  it("no touch event when player has no matching assignment", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      playerId: "unassigned-player",
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1)];
    // No assignment for "unassigned-player"
    const assignments = makeAssignments({ slot: "slot-1", playerId: "other-player", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(false);
    expect(result.events.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Possession-evidence oracle: lastTouchRef change requires event
// ---------------------------------------------------------------------------

describe("CONTACT-POSSESSION-001: possession evidence", () => {
  it("lastTouchRef change is always backed by a contact event", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const prevRef = ball.lastTouchRef;
    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // If lastTouchRef changed, there must be a player-ball-contact event.
    if (ball.lastTouchRef !== prevRef) {
      const touchEvents = result.events.filter(
        (e) => e.kind === "player-ball-contact",
      );
      expect(touchEvents.length).toBeGreaterThanOrEqual(1);

      // The event id must match the lastTouchRef.
      expect(ball.lastTouchRef).toBe(touchEvents[0].id);
    }
  });

  it("without contact event, lastTouchRef stays null", () => {
    const ball = makeBall({
      position: { x: 10, y: 10, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const counter = makeCounter();

    // No players, no frames.
    const result = stepContacts([], ball, [], {}, CFG, counter, 1);

    expect(ball.lastTouchRef).toBeNull();
    expect(result.events.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Ball independence: ball state is not parented to any player
// ---------------------------------------------------------------------------

describe("CONTACT-INDEPENDENCE-001: ball remains independent", () => {
  it("ball has no ownerPlayerId after contact", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Ball must never gain an ownerPlayerId or any player-parenting field.
    expect((ball as unknown as Record<string, unknown>).ownerPlayerId).toBeUndefined();
    expect((ball as unknown as Record<string, unknown>).possessedBy).toBeUndefined();
    expect((ball as unknown as Record<string, unknown>).attachedTo).toBeUndefined();
  });

  it("ball velocity is not teleported to match player velocity", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      linearVelocity: { x: 0.5, y: 0.3 },
      bodyHeading: Math.PI / 2, // facing +Y
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Ball velocity should NOT be the player's velocity.
    // It should be a derived impulse, not a copy.
    expect(ball.linearVelocity.x).not.toBe(0.5);
    expect(ball.linearVelocity.y).not.toBe(0.3);
  });
});

// ---------------------------------------------------------------------------
// 6. Multiple eligible players: closest wins, deterministic
// ---------------------------------------------------------------------------

describe("CONTACT-PRIORITY-001: closest player wins", () => {
  it("picks the closest eligible player", () => {
    const playerA = makePlayer({
      playerId: "pA",
      groundPosition: { x: 0.4, y: 0 }, // distance = 0.1
    });
    const playerB = makePlayer({
      playerId: "pB",
      groundPosition: { x: 0.3, y: 0 }, // distance = 0.2
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1), makeFrame(1, { controlSlot: "slot-2" })];
    const assignments = makeAssignments(
      { slot: "slot-1", playerId: "pB", teamId: "team-a" },
      { slot: "slot-2", playerId: "pA", teamId: "team-a" },
    );
    const counter = makeCounter();

    const result = stepContacts([playerA, playerB], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(true);
    const payload = result.events[0].payload as { playerId: string };
    // pA is closer to the ball (distance 0.1) than pB (distance 0.2).
    expect(payload.playerId).toBe("pA");
  });

  it("deterministic tie-break: lower playerId wins", () => {
    const playerA = makePlayer({
      playerId: "pA",
      groundPosition: { x: 0.4, y: 0 },
    });
    const playerB = makePlayer({
      playerId: "pB",
      groundPosition: { x: 0.4, y: 0 }, // same distance
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1), makeFrame(1, { controlSlot: "slot-2" })];
    const assignments = makeAssignments(
      { slot: "slot-1", playerId: "pA", teamId: "team-a" },
      { slot: "slot-2", playerId: "pB", teamId: "team-a" },
    );
    const counter = makeCounter();

    const result = stepContacts([playerA, playerB], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(true);
    const payload = result.events[0].payload as { playerId: string };
    expect(payload.playerId).toBe("pA");
  });
});

// ---------------------------------------------------------------------------
// 7. Velocity change model correctness
// ---------------------------------------------------------------------------

describe("CONTACT-VELOCITY-001: velocity change model", () => {
  it("outgoing horizontal direction matches player body heading", () => {
    const heading = Math.PI / 2; // +Y direction
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: heading,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 5.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Outgoing horizontal direction should be ~ +Y (per bodyHeading).
    expect(ball.linearVelocity.x).toBeCloseTo(0, 1);
    expect(ball.linearVelocity.y).toBeGreaterThan(0);
  });

  it("outgoing speed is fraction of incoming speed", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 10.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const incomingSpeed = Math.sqrt(
      ball.linearVelocity.x ** 2 + ball.linearVelocity.y ** 2,
    );

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    const outgoingSpeed = Math.sqrt(
      ball.linearVelocity.x ** 2 + ball.linearVelocity.y ** 2,
    );

    // Outgoing speed ≈ impulseFraction × incomingSpeed.
    const expectedSpeed = incomingSpeed * CFG.impulseFraction.value;
    expect(outgoingSpeed).toBeCloseTo(expectedSpeed, 1);
  });

  it("near-stationary ball gets default exit speed", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0.01, y: 0, z: 0 }, // nearly stopped
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    const outgoingSpeed = Math.sqrt(
      ball.linearVelocity.x ** 2 + ball.linearVelocity.y ** 2,
    );
    expect(outgoingSpeed).toBeCloseTo(CFG.defaultExitSpeed.value, 1);
  });

  it("angular velocity is damped on contact", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 3.0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 10.0 },
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(Math.abs(ball.angularVelocity.z)).toBeLessThan(10.0);
    expect(Math.abs(ball.angularVelocity.z)).toBeCloseTo(5.0, 5);
  });
});

// ---------------------------------------------------------------------------
// 8. Determinism: same inputs produce same event sequence
// ---------------------------------------------------------------------------

describe("CONTACT-DETERMINISM-001: deterministic contact", () => {
  it("identical inputs produce identical event ids and sequences", () => {
    function run(): SimulationEvent[] {
      const player = makePlayer({
        groundPosition: { x: 0.3, y: 0 },
      });
      const ball = makeBall({
        position: { x: 0.5, y: 0, z: 0.11 },
        linearVelocity: { x: 2.0, y: 0, z: 0 },
      });
      const frames = [makeFrame(5)];
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
      expect(events1[i].sequence).toBe(events2[i].sequence);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Finite values: all ball state remains finite after contact
// ---------------------------------------------------------------------------

describe("CONTACT-FINITE-001: all values remain finite", () => {
  it("ball state is finite after contact", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0.2 },
      bodyHeading: 1.5,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0.1, z: 0.11 },
      linearVelocity: { x: 2.0, y: 1.0, z: 0 },
      angularVelocity: { x: 1.0, y: 2.0, z: 3.0 },
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(Number.isFinite(ball.position.x)).toBe(true);
    expect(Number.isFinite(ball.position.y)).toBe(true);
    expect(Number.isFinite(ball.position.z)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.x)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.y)).toBe(true);
    expect(Number.isFinite(ball.linearVelocity.z)).toBe(true);
    expect(Number.isFinite(ball.angularVelocity.x)).toBe(true);
    expect(Number.isFinite(ball.angularVelocity.y)).toBe(true);
    expect(Number.isFinite(ball.angularVelocity.z)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. Integration with simulation loop: events appear in StepResult
// ---------------------------------------------------------------------------

describe("CONTACT-LOOP-001: contact events in simulation step results", () => {
  it("player-ball-contact event appears in simulation StepResult when player runs to ball", async () => {
    const { createWorld } = await import("../../../src/simulation/world/create.js");
    const { createSimulation } = await import("../../../src/simulation/loop/simulation.js");
    const { NO_OP_OBSERVER } = await import("../../../src/simulation/telemetry/observer.js");
    const { FIRST_TOUCH_BIT: FT } = await import("../../../src/contracts/input.js");

    // Scenario: player starts very close to the ball, ball is rolling.
    // Player presses FIRST_TOUCH on tick 0.
    const scenario = {
      id: "first-touch-test",
      version: "1.0.0",
      family: "contact",
      durationTicks: 30,
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

    // Apply FIRST_TOUCH input for tick 0.
    sim.applyInputs([
      {
        tick: 0,
        sourceId: "test",
        controlSlot: "slot-1",
        moveX: 0,
        moveY: 0,
        sprint: 0,
        heldButtons: 0,
        pressedButtons: FT,
        releasedButtons: 0,
      },
    ]);

    let foundContact = false;
    for (let i = 0; i < 10; i++) {
      const result = sim.step();
      const contactEvents = result.events.filter(
        (e) => e.kind === "player-ball-contact",
      );
      if (contactEvents.length > 0) {
        foundContact = true;

        // Verify ball.lastTouchRef matches the event.
        const snapshot = sim.snapshot();
        expect(snapshot.ball.lastTouchRef).toBe(contactEvents[0].id);

        // Verify ball still has its own independent position.
        expect(typeof snapshot.ball.position.x).toBe("number");
        expect(typeof snapshot.ball.position.y).toBe("number");
        expect(typeof snapshot.ball.position.z).toBe("number");

        // Verify no ownership field on ball.
        expect((snapshot.ball as any).ownerPlayerId).toBeUndefined();
        break;
      }
    }

    expect(foundContact).toBe(true);
  });

  it("no contact event when player does not press FIRST_TOUCH", async () => {
    const { createWorld } = await import("../../../src/simulation/world/create.js");
    const { createSimulation } = await import("../../../src/simulation/loop/simulation.js");
    const { NO_OP_OBSERVER } = await import("../../../src/simulation/telemetry/observer.js");

    const scenario = {
      id: "no-first-touch-test",
      version: "1.0.0",
      family: "contact",
      durationTicks: 30,
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

    // Apply input WITHOUT FIRST_TOUCH bit — player doesn't try to control.
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
    ]);

    for (let i = 0; i < 10; i++) {
      const result = sim.step();
      const contactEvents = result.events.filter(
        (e) => e.kind === "player-ball-contact",
      );
      expect(contactEvents.length).toBe(0);
    }

    // lastTouchRef should still be null.
    expect(sim.snapshot().ball.lastTouchRef).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 11. Existing locomotion and ball integration still work
// ---------------------------------------------------------------------------

describe("CONTACT-REGRESSION-001: existing systems still work", () => {
  it("locomotion still advances player position", async () => {
    const { createWorld } = await import("../../../src/simulation/world/create.js");
    const { createSimulation } = await import("../../../src/simulation/loop/simulation.js");
    const { NO_OP_OBSERVER } = await import("../../../src/simulation/telemetry/observer.js");

    const scenario = {
      id: "regression-loco-test",
      version: "1.0.0",
      family: "regression",
      durationTicks: 30,
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
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        },
      ],
      ball: {
        position: { x: 0, y: 0, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
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

    // Apply movement input for tick 0.
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
    ]);

    // Step enough ticks for player to start moving.
    for (let i = 0; i < 5; i++) {
      sim.step();
    }

    const snap = sim.snapshot();
    // Player should have moved in +X direction.
    expect(snap.players[0].groundPosition.x).toBeGreaterThan(0);
  });

  it("ball ground-roll deceleration still works", async () => {
    const { createWorld } = await import("../../../src/simulation/world/create.js");
    const { createSimulation } = await import("../../../src/simulation/loop/simulation.js");
    const { NO_OP_OBSERVER } = await import("../../../src/simulation/telemetry/observer.js");

    const scenario = {
      id: "regression-ball-test",
      version: "1.0.0",
      family: "regression",
      durationTicks: 120,
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
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        },
      ],
      ball: {
        position: { x: 0, y: 0, z: 0.11 },
        linearVelocity: { x: 3.0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 5.0 },
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

    // Step until ball settles.
    for (let i = 0; i < 400; i++) {
      sim.step();
    }

    const snap = sim.snapshot();
    // Ball should have settled (speed near zero).
    const speed = Math.sqrt(
      snap.ball.linearVelocity.x ** 2 +
        snap.ball.linearVelocity.y ** 2 +
        snap.ball.linearVelocity.z ** 2,
    );
    expect(speed).toBeLessThan(0.1);
    expect(snap.ball.regime).toBe("settled");
  });
});

// ---------------------------------------------------------------------------
// 12. PASS_BIT: directed pass along body heading
// ---------------------------------------------------------------------------

describe("CONTACT-PASS-001: directed pass contact", () => {
  it("emits a pass event when player is in range with PASS_BIT", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0.5, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(true);
    expect(result.events.length).toBe(1);
    expect(result.events[0].kind).toBe("pass");
    expect(result.events[0].tick).toBe(1);
  });

  it("sets ball.lastTouchRef to the pass event id", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0.5, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(ball.lastTouchRef).toBe(result.events[0].id);
    expect(ball.lastTouchRef).toMatch(/^pass-1-/);
  });

  it("ball velocity is along body heading at exitSpeed", () => {
    const heading = Math.PI / 2; // facing +Y
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: heading,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0.5, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    // Ball should move in +Y direction (body heading).
    expect(ball.linearVelocity.x).toBeCloseTo(0, 1);
    expect(ball.linearVelocity.y).toBeGreaterThan(0);
    // Horizontal speed should be exitSpeed.
    const hSpeed = Math.sqrt(ball.linearVelocity.x ** 2 + ball.linearVelocity.y ** 2);
    expect(hSpeed).toBeCloseTo(FOUNDATION_PASS_V1.exitSpeed.value, 1);
  });

  it("does not teleport ball position", () => {
    const player = makePlayer({
      groundPosition: { x: 0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0.3, z: 0.5 },
      linearVelocity: { x: 0.5, y: 0, z: 0 },
      regime: "airborne",
    });
    const frames = [makeFrame(1, { pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const ballPosBefore = { ...ball.position };
    stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(ball.position.x).toBe(ballPosBefore.x);
    expect(ball.position.y).toBe(ballPosBefore.y);
    expect(ball.position.z).toBe(ballPosBefore.z);
  });

  it("pass event payload contains contactType 'pass'", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0.5, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);
    const payload = result.events[0].payload as Record<string, unknown>;

    expect(payload.contactType).toBe("pass");
    expect(payload.playerId).toBe("p1");
    expect(payload.teamId).toBe("team-a");
    expect(payload.incoming).toBeDefined();
    expect(payload.outgoing).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 13. PASS_BIT without proximity → no pass
// ---------------------------------------------------------------------------

describe("CONTACT-PASS-002: no pass without proximity", () => {
  it("no pass event when player is out of range", () => {
    const player = makePlayer({
      groundPosition: { x: 5.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0, y: 0, z: 0.11 },
      linearVelocity: { x: 0.5, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(false);
    expect(result.events.length).toBe(0);
    expect(ball.lastTouchRef).toBeNull();
  });

  it("no pass when PASS_BIT not set even if in range", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0.5, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { pressedButtons: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(false);
    expect(result.events.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 14. FIRST_TOUCH_BIT still does first-touch (regression)
// ---------------------------------------------------------------------------

describe("CONTACT-REGRESSION-002: FIRST_TOUCH_BIT still works", () => {
  it("FIRST_TOUCH_BIT produces player-ball-contact event, not pass", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { pressedButtons: FIRST_TOUCH_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(true);
    expect(result.events.length).toBe(1);
    expect(result.events[0].kind).toBe("player-ball-contact");
    expect(result.events[0].payload.contactType).toBe("first-touch");
  });

  it("both PASS_BIT and FIRST_TOUCH_BIT → PASS_BIT wins (priority)", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    // Both bits set simultaneously.
    const frames = [makeFrame(1, { pressedButtons: PASS_BIT | FIRST_TOUCH_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    expect(result.touched).toBe(true);
    expect(result.events[0].kind).toBe("pass");
  });
});

// ---------------------------------------------------------------------------
// 15. Possession-evidence oracle for pass: lastTouchRef without event → FAIL
// ---------------------------------------------------------------------------

describe("CONTACT-PASS-POSSESSION-001: pass possession evidence", () => {
  it("lastTouchRef change after pass is backed by a pass event", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0.5, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { pressedButtons: PASS_BIT })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const prevRef = ball.lastTouchRef;
    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);

    if (ball.lastTouchRef !== prevRef) {
      const passEvents = result.events.filter((e) => e.kind === "pass");
      expect(passEvents.length).toBeGreaterThanOrEqual(1);
      expect(ball.lastTouchRef).toBe(passEvents[0].id);
    }
  });
});

// ---------------------------------------------------------------------------
// 12. Contact event payload includes planar distance
// ---------------------------------------------------------------------------

describe("CONTACT-PAYLOAD-001: event payload details", () => {
  it("payload includes planarDistance", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);
    const payload = result.events[0].payload as { planarDistance: number };

    expect(payload.planarDistance).toBeCloseTo(0.2, 10);
  });

  it("payload incoming/outgoing have consistent shapes", () => {
    const player = makePlayer({ groundPosition: { x: 0.3, y: 0 } });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 2.0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1)];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();

    const result = stepContacts([player], ball, frames, assignments, CFG, counter, 1);
    const payload = result.events[0].payload as {
      incoming: { position: { x: number; y: number; z: number }; linearVelocity: { x: number; y: number; z: number }; angularVelocity: { x: number; y: number; z: number }; regime: string };
      outgoing: { position: { x: number; y: number; z: number }; linearVelocity: { x: number; y: number; z: number }; angularVelocity: { x: number; y: number; z: number }; regime: string };
    };

    // Incoming position matches ball's original position.
    expect(payload.incoming.position.x).toBe(0.5);
    expect(payload.incoming.position.z).toBe(0.11);

    // Outgoing velocity is different from incoming.
    expect(payload.outgoing.linearVelocity.x).not.toBe(payload.incoming.linearVelocity.x);
  });
});
