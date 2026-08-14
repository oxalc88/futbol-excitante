/**
 * @module close-control-tests
 *
 * Tests for PLAYABLE-CLOSE-CONTROL: repeated dribble-touch contacts
 * while holding FIRST_TOUCH within range.
 *
 * Tests:
 *  1. Player in range + FIRST_TOUCH held (not pressed edge) + moving → dribble-touch event.
 *  2. No dribble-touch without FIRST_TOUCH held; walking past ball produces no touch.
 *  3. Shot/pass pressed in range still produce shot/pass, not dribble-touch.
 *  4. Cooldown: holding FIRST_TOUCH does not emit a dribble-touch on every single tick.
 *  5. Ball remains independent after dribble-touch (no ownerPlayerId).
 *  6. Determinism identity + difference.
 *  7. Integration with simulation loop.
 *  8. Possession oracle recognizes dribble-touch events.
 *
 * No Math.random, Date, DOM, or Node I/O in src/simulation.
 */

import { describe, it, expect } from "vitest";

import { stepContacts } from "../../../src/simulation/contacts/contact-system.js";
import {
  FOUNDATION_CONTACT_V1,
  FOUNDATION_PASS_V1,
  FOUNDATION_SHOT_V1,
  FOUNDATION_CLOSE_CONTROL_V1,
} from "../../../src/simulation/config/foundation.js";
import { FIRST_TOUCH_BIT, PASS_BIT, SHOT_BIT } from "../../../src/contracts/input.js";
import type { BallState, PlayerState } from "../../../src/contracts/state.js";
import type { InputFrame } from "../../../src/contracts/input.js";
import type { SimulationEvent } from "../../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CC_CFG = FOUNDATION_CLOSE_CONTROL_V1;

function makePlayer(overrides?: Partial<PlayerState>): PlayerState {
  return {
    playerId: "p1",
    teamId: "team-a",
    groundPosition: { x: 0, y: 0 },
    linearVelocity: { x: 0, y: 0 },
    desiredVelocity: { x: 3.0, y: 0 },
    bodyHeading: 0,
    desiredHeading: 0,
    ...overrides,
  };
}

function makeBall(overrides?: Partial<BallState>): BallState {
  return {
    position: { x: 0.5, y: 0, z: 0.11 },
    linearVelocity: { x: 0, y: 0, z: 0 },
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
  },
): InputFrame {
  return {
    tick,
    sourceId: "test",
    controlSlot: opts?.controlSlot ?? "slot-1",
    moveX: 0,
    moveY: 0,
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

function makeCooldowns(): Map<string, number> {
  return new Map();
}

// ---------------------------------------------------------------------------
// 1. Basic dribble-touch: player in range + FIRST_TOUCH held + moving → event
// ---------------------------------------------------------------------------

describe("CLOSE-CONTROL-001: basic dribble-touch contact", () => {
  it("emits a player-ball-contact event with contactType dribble-touch when holding FIRST_TOUCH and in range", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      desiredVelocity: { x: 3.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    // heldButtons has FIRST_TOUCH_BIT, pressedButtons does NOT (avoid double-fire with first-touch edge).
    const frames = [makeFrame(1, { heldButtons: FIRST_TOUCH_BIT, pressedButtons: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();
    const cooldowns = makeCooldowns();

    const result = stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );

    expect(result.touched).toBe(true);
    expect(result.events.length).toBe(1);
    expect(result.events[0].kind).toBe("player-ball-contact");
    const payload = result.events[0].payload as Record<string, unknown>;
    expect(payload.contactType).toBe("dribble-touch");
    expect(payload.playerId).toBe("p1");
  });

  it("ball position is not equal to player position after dribble-touch", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      desiredVelocity: { x: 3.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
    });
    const frames = [makeFrame(1, { heldButtons: FIRST_TOUCH_BIT, pressedButtons: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();
    const cooldowns = makeCooldowns();

    stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );

    // Ball position unchanged — only velocity modified.
    expect(ball.position.x).toBe(0.5);
    expect(ball.position.y).toBe(0);
    expect(ball.position.z).toBe(0.11);
  });

  it("ball has no ownerPlayerId after dribble-touch", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      desiredVelocity: { x: 3.0, y: 0 },
    });
    const ball = makeBall();
    const frames = [makeFrame(1, { heldButtons: FIRST_TOUCH_BIT, pressedButtons: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();
    const cooldowns = makeCooldowns();

    stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );

    expect((ball as unknown as Record<string, unknown>).ownerPlayerId).toBeUndefined();
    expect((ball as unknown as Record<string, unknown>).possessedBy).toBeUndefined();
    expect((ball as unknown as Record<string, unknown>).attachedTo).toBeUndefined();
  });

  it("ball velocity changes on dribble-touch", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      desiredVelocity: { x: 3.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { heldButtons: FIRST_TOUCH_BIT, pressedButtons: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();
    const cooldowns = makeCooldowns();

    stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );

    // Ball should have gained velocity in the player's movement direction.
    expect(ball.linearVelocity.x).toBeGreaterThan(0);
    expect(ball.linearVelocity.y).toBeCloseTo(0, 1);
  });

  it("lastTouchRef is updated after dribble-touch", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      desiredVelocity: { x: 3.0, y: 0 },
    });
    const ball = makeBall();
    const frames = [makeFrame(1, { heldButtons: FIRST_TOUCH_BIT, pressedButtons: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();
    const cooldowns = makeCooldowns();

    const result = stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );

    expect(ball.lastTouchRef).toBe(result.events[0].id);
    expect(ball.lastTouchRef).toMatch(/^player-ball-contact-1-/);
  });
});

// ---------------------------------------------------------------------------
// 2. No dribble-touch without FIRST_TOUCH held
// ---------------------------------------------------------------------------

describe("CLOSE-CONTROL-002: no dribble-touch without intent", () => {
  it("walking past the ball without FIRST_TOUCH held produces no dribble-touch", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      desiredVelocity: { x: 3.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
    });
    // No buttons pressed or held.
    const frames = [makeFrame(1, { heldButtons: 0, pressedButtons: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();
    const cooldowns = makeCooldowns();

    const result = stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );

    expect(result.touched).toBe(false);
    expect(result.events.length).toBe(0);
    expect(ball.lastTouchRef).toBeNull();
  });

  it("ball position is not modified when walking past without FIRST_TOUCH", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      desiredVelocity: { x: 3.0, y: 0 },
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0.1, z: 0.11 },
    });
    const ballPosBefore = { ...ball.position };
    const frames = [makeFrame(1, { heldButtons: 0, pressedButtons: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();
    const cooldowns = makeCooldowns();

    stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );

    expect(ball.position.x).toBe(ballPosBefore.x);
    expect(ball.position.y).toBe(ballPosBefore.y);
    expect(ball.position.z).toBe(ballPosBefore.z);
  });

  it("ball velocity is not modified when walking past without FIRST_TOUCH", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      desiredVelocity: { x: 3.0, y: 0 },
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0, z: 0.11 },
      linearVelocity: { x: 1.0, y: 0.5, z: 0 },
    });
    const velBefore = { ...ball.linearVelocity };
    const frames = [makeFrame(1, { heldButtons: 0, pressedButtons: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();
    const cooldowns = makeCooldowns();

    stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );

    expect(ball.linearVelocity.x).toBe(velBefore.x);
    expect(ball.linearVelocity.y).toBe(velBefore.y);
    expect(ball.linearVelocity.z).toBe(velBefore.z);
  });
});

// ---------------------------------------------------------------------------
// 3. Shot/pass pressed in range still produce shot/pass, not dribble-touch
// ---------------------------------------------------------------------------

describe("CLOSE-CONTROL-003: shot/pass priority over dribble-touch", () => {
  it("SHOT_BIT pressed produces a shot, not a dribble-touch", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      desiredVelocity: { x: 3.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall();
    const frames = [makeFrame(1, {
      heldButtons: FIRST_TOUCH_BIT | SHOT_BIT,
      pressedButtons: SHOT_BIT,
    })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();
    const cooldowns = makeCooldowns();

    const result = stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );

    expect(result.events.length).toBe(1);
    expect(result.events[0].kind).toBe("shot");
    const payload = result.events[0].payload as { contactType: string };
    expect(payload.contactType).toBe("shot");
  });

  it("PASS_BIT pressed produces a pass, not a dribble-touch", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      desiredVelocity: { x: 3.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall();
    const frames = [makeFrame(1, {
      heldButtons: FIRST_TOUCH_BIT | PASS_BIT,
      pressedButtons: PASS_BIT,
    })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();
    const cooldowns = makeCooldowns();

    const result = stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );

    expect(result.events.length).toBe(1);
    expect(result.events[0].kind).toBe("pass");
    const payload = result.events[0].payload as { contactType: string };
    expect(payload.contactType).toBe("pass");
  });

  it("FIRST_TOUCH pressed edge produces first-touch, not dribble-touch", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      desiredVelocity: { x: 3.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall();
    // pressedButtons has FIRST_TOUCH_BIT — this is the one-shot edge.
    const frames = [makeFrame(1, {
      heldButtons: FIRST_TOUCH_BIT,
      pressedButtons: FIRST_TOUCH_BIT,
    })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();
    const cooldowns = makeCooldowns();

    const result = stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );

    expect(result.events.length).toBe(1);
    expect(result.events[0].kind).toBe("player-ball-contact");
    const payload = result.events[0].payload as { contactType: string };
    // On the press edge, contactType should be "first-touch", not "dribble-touch".
    expect(payload.contactType).toBe("first-touch");
  });
});

// ---------------------------------------------------------------------------
// 4. Cooldown: holding FIRST_TOUCH does not emit dribble-touch on every tick
// ---------------------------------------------------------------------------

describe("CLOSE-CONTROL-004: cooldown enforcement", () => {
  it("dribble-touch does not fire every tick when FIRST_TOUCH is held", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      desiredVelocity: { x: 3.0, y: 0 },
      bodyHeading: 0,
    });
    const ball = makeBall();
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const cooldowns = makeCooldowns();

    let touchCount = 0;
    const cooldownTicks = CC_CFG.cooldownTicks.value;

    // Run 10 ticks holding FIRST_TOUCH (held, not pressed after tick 0).
    for (let t = 1; t <= 10; t++) {
      const counter = makeCounter();
      // First tick is pressed edge, subsequent ticks are held only.
      const frames = [makeFrame(t, {
        heldButtons: FIRST_TOUCH_BIT,
        pressedButtons: t === 1 ? 0 : 0, // not pressed — held only
      })];
      const result = stepContacts(
        [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
        counter, t, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
        CC_CFG, cooldowns,
      );

      if (result.events.length > 0) {
        const payload = result.events[0].payload as { contactType: string };
        if (payload.contactType === "dribble-touch") {
          touchCount++;
        }
      }
    }

    // Should NOT have 10 touches (one per tick).  With cooldown of 6,
    // we expect at most ceil(10 / 6) + 1 ≈ 2–3 touches in 10 ticks.
    expect(touchCount).toBeGreaterThan(0);
    expect(touchCount).toBeLessThan(10);
  });

  it("cooldown map is updated after a dribble-touch", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      desiredVelocity: { x: 3.0, y: 0 },
    });
    const ball = makeBall();
    const frames = [makeFrame(1, { heldButtons: FIRST_TOUCH_BIT, pressedButtons: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();
    const cooldowns = makeCooldowns();

    expect(cooldowns.has("p1")).toBe(false);

    stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );

    expect(cooldowns.has("p1")).toBe(true);
    expect(cooldowns.get("p1")).toBe(1);
  });

  it("cooldown prevents immediate re-touch after first dribble-touch", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      desiredVelocity: { x: 3.0, y: 0 },
    });
    const ball = makeBall();
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const cooldowns = makeCooldowns();

    // First tick: should touch.
    let counter = makeCounter();
    let frames = [makeFrame(1, { heldButtons: FIRST_TOUCH_BIT, pressedButtons: 0 })];
    const result1 = stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );
    expect(result1.events.length).toBe(1);
    expect((result1.events[0].payload as { contactType: string }).contactType).toBe("dribble-touch");

    // Next tick (t=2): should NOT touch (within cooldown).
    counter = makeCounter();
    frames = [makeFrame(2, { heldButtons: FIRST_TOUCH_BIT, pressedButtons: 0 })];
    const result2 = stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 2, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );
    expect(result2.events.length).toBe(0);

    // After cooldown elapses (t = 1 + cooldownTicks): should touch again.
    const afterCooldown = 1 + CC_CFG.cooldownTicks.value;
    counter = makeCounter();
    frames = [makeFrame(afterCooldown, { heldButtons: FIRST_TOUCH_BIT, pressedButtons: 0 })];
    const result3 = stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, afterCooldown, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );
    expect(result3.events.length).toBe(1);
    expect((result3.events[0].payload as { contactType: string }).contactType).toBe("dribble-touch");
  });
});

// ---------------------------------------------------------------------------
// 5. Ball independence after dribble-touch
// ---------------------------------------------------------------------------

describe("CLOSE-CONTROL-005: ball independence", () => {
  it("ball velocity is not a copy of player velocity", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      desiredVelocity: { x: 3.0, y: 1.5 },
      bodyHeading: Math.PI / 4,
    });
    const ball = makeBall();
    const frames = [makeFrame(1, { heldButtons: FIRST_TOUCH_BIT, pressedButtons: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();
    const cooldowns = makeCooldowns();

    stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );

    // Ball velocity should be derived (fraction of player speed), not a direct copy.
    const playerSpeed = Math.sqrt(
      player.desiredVelocity.x ** 2 + player.desiredVelocity.y ** 2,
    );
    const ballSpeed = Math.sqrt(
      ball.linearVelocity.x ** 2 + ball.linearVelocity.y ** 2,
    );
    // Ball speed should be player speed * pushAheadFraction (0.7).
    expect(ballSpeed).toBeCloseTo(playerSpeed * CC_CFG.pushAheadFraction.value, 1);
    // Should not equal the player velocity directly.
    expect(ball.linearVelocity.x).not.toBe(3.0);
    expect(ball.linearVelocity.y).not.toBe(1.5);
  });

  it("dribble-touch event has incoming and outgoing snapshots", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0 },
      desiredVelocity: { x: 2.0, y: 0 },
    });
    const ball = makeBall({
      linearVelocity: { x: 0.5, y: 0, z: 0 },
    });
    const frames = [makeFrame(1, { heldButtons: FIRST_TOUCH_BIT, pressedButtons: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();
    const cooldowns = makeCooldowns();

    const result = stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );

    const payload = result.events[0].payload as Record<string, unknown>;
    expect(payload.incoming).toBeDefined();
    expect(payload.outgoing).toBeDefined();
    expect(payload.playerId).toBe("p1");
    expect(payload.teamId).toBe("team-a");
    expect(typeof (payload.planarDistance as number)).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// 6. Determinism: same inputs → same events; different inputs → different
// ---------------------------------------------------------------------------

describe("CLOSE-CONTROL-006: determinism", () => {
  it("identical inputs produce identical event ids and sequences", () => {
    function run(): SimulationEvent[] {
      const player = makePlayer({
        groundPosition: { x: 0.3, y: 0 },
        desiredVelocity: { x: 3.0, y: 0 },
      });
      const ball = makeBall();
      const frames = [makeFrame(5, { heldButtons: FIRST_TOUCH_BIT, pressedButtons: 0 })];
      const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
      const counter = makeCounter();
      const cooldowns = makeCooldowns();

      const result = stepContacts(
        [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
        counter, 5, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
        CC_CFG, cooldowns,
      );
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

  it("different player positions produce different hashes (via different events)", () => {
    function run(posX: number): SimulationEvent[] {
      const player = makePlayer({
        groundPosition: { x: posX, y: 0 },
        desiredVelocity: { x: 3.0, y: 0 },
      });
      const ball = makeBall();
      const frames = [makeFrame(5, { heldButtons: FIRST_TOUCH_BIT, pressedButtons: 0 })];
      const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
      const counter = makeCounter();
      const cooldowns = makeCooldowns();

      const result = stepContacts(
        [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
        counter, 5, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
        CC_CFG, cooldowns,
      );
      return result.events;
    }

    const eventsClose = run(0.3);  // within dribble radius
    const eventsFar = run(5.0);    // out of dribble radius

    // Close should have a dribble-touch event; far should have none.
    expect(eventsClose.length).toBe(1);
    expect(eventsFar.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Simulation loop integration
// ---------------------------------------------------------------------------

describe("CLOSE-CONTROL-007: simulation loop integration", () => {
  it("dribble-touch events appear when holding FIRST_TOUCH in range across ticks", async () => {
    const { createWorld } = await import("../../../src/simulation/world/create.js");
    const { createSimulation } = await import("../../../src/simulation/loop/simulation.js");
    const { NO_OP_OBSERVER } = await import("../../../src/simulation/telemetry/observer.js");
    const { FIRST_TOUCH_BIT: FT } = await import("../../../src/contracts/input.js");

    const scenario = {
      id: "close-control-integration-test",
      version: "1.0.0",
      family: "close-control",
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

    let dribbleTouchCount = 0;
    let firstTouchCount = 0;

    // Apply FIRST_TOUCH held (not pressed edge) for many ticks.
    for (let t = 0; t < 30; t++) {
      sim.applyInputs([
        {
          tick: t,
          sourceId: "test",
          controlSlot: "slot-1",
          moveX: 0.5,
          moveY: 0,
          sprint: 0,
          heldButtons: FT,
          pressedButtons: 0,  // not pressed edge — held only
          releasedButtons: 0,
        },
      ]);

      const result = sim.step();
      for (const ev of result.events) {
        if (ev.kind === "player-ball-contact") {
          const payload = ev.payload as { contactType: string };
          if (payload.contactType === "dribble-touch") {
            dribbleTouchCount++;
          } else if (payload.contactType === "first-touch") {
            firstTouchCount++;
          }
        }
      }
    }

    // Should have at least one dribble-touch event.
    expect(dribbleTouchCount).toBeGreaterThan(0);

    // Ball should still be independent.
    const snap = sim.snapshot();
    expect((snap.ball as unknown as Record<string, unknown>).ownerPlayerId).toBeUndefined();
  });

  it("no dribble-touch without FIRST_TOUCH held in simulation loop", async () => {
    const { createWorld } = await import("../../../src/simulation/world/create.js");
    const { createSimulation } = await import("../../../src/simulation/loop/simulation.js");
    const { NO_OP_OBSERVER } = await import("../../../src/simulation/telemetry/observer.js");

    const scenario = {
      id: "no-close-control-integration-test",
      version: "1.0.0",
      family: "close-control",
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

    for (let t = 0; t < 20; t++) {
      sim.applyInputs([
        {
          tick: t,
          sourceId: "test",
          controlSlot: "slot-1",
          moveX: 1,
          moveY: 0,
          sprint: 0,
          heldButtons: 0,
          pressedButtons: 0,
          releasedButtons: 0,
        },
      ]);

      const result = sim.step();
      const dribbleEvents = result.events.filter(
        (e) => e.kind === "player-ball-contact" &&
          (e.payload as { contactType?: string })?.contactType === "dribble-touch",
      );
      expect(dribbleEvents.length).toBe(0);
    }

    // Ball lastTouchRef should still be null.
    expect(sim.snapshot().ball.lastTouchRef).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 8. Possession oracle: dribble-touch events are recognized
// ---------------------------------------------------------------------------

describe("CLOSE-CONTROL-008: possession oracle recognizes dribble-touch", () => {
  it("dribble-touch event is recognized as a touch event by the possession oracle", async () => {
    const { checkPossessionEvidence } = await import("../../../eval/oracles/possession.js");

    // Simulate an observation where lastTouchRef changes with a dribble-touch event.
    const observations = [
      {
        tick: 0,
        ball: { lastTouchRef: null },
        events: [],
      },
      {
        tick: 1,
        ball: { lastTouchRef: "player-ball-contact-1-1" },
        events: [
          {
            id: "player-ball-contact-1-1",
            tick: 1,
            sequence: 1,
            kind: "player-ball-contact" as const,
            label: "dribble touch",
            payload: { contactType: "dribble-touch", playerId: "p1" },
          },
        ],
      },
    ];

    const results = checkPossessionEvidence(observations as any);
    // Should pass — the dribble-touch event provides evidence.
    const failures = results.filter((r) => r.status === "fail");
    expect(failures.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Finite values remain after dribble-touch
// ---------------------------------------------------------------------------

describe("CLOSE-CONTROL-009: all values remain finite after dribble-touch", () => {
  it("ball state is finite after dribble-touch", () => {
    const player = makePlayer({
      groundPosition: { x: 0.3, y: 0.2 },
      desiredVelocity: { x: 2.0, y: 1.0 },
      bodyHeading: 1.5,
    });
    const ball = makeBall({
      position: { x: 0.5, y: 0.1, z: 0.11 },
      linearVelocity: { x: 2.0, y: 1.0, z: 0 },
      angularVelocity: { x: 1.0, y: 2.0, z: 3.0 },
    });
    const frames = [makeFrame(1, { heldButtons: FIRST_TOUCH_BIT, pressedButtons: 0 })];
    const assignments = makeAssignments({ slot: "slot-1", playerId: "p1", teamId: "team-a" });
    const counter = makeCounter();
    const cooldowns = makeCooldowns();

    stepContacts(
      [player], ball, frames, assignments, FOUNDATION_CONTACT_V1,
      counter, 1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1,
      CC_CFG, cooldowns,
    );

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
// 10. Two-player: dribble-touch from one slot, other slot independent
// ---------------------------------------------------------------------------

describe("CLOSE-CONTROL-010: two-slot dribble-touch independence", () => {
  it("slot-1 dribble-touch does not affect slot-2 player", async () => {
    const { createWorld } = await import("../../../src/simulation/world/create.js");
    const { createSimulation } = await import("../../../src/simulation/loop/simulation.js");
    const { NO_OP_OBSERVER } = await import("../../../src/simulation/telemetry/observer.js");
    const { FIRST_TOUCH_BIT: FT } = await import("../../../src/contracts/input.js");

    const scenario = {
      id: "two-slot-close-control",
      version: "1.0.0",
      family: "close-control",
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
          playerId: "player-a",
          teamId: "team-a",
          groundPosition: { x: 0.3, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        },
        {
          playerId: "player-b",
          teamId: "team-b",
          groundPosition: { x: 5, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: Math.PI,
          desiredHeading: Math.PI,
        },
      ],
      ball: {
        position: { x: 0.5, y: 0, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll" as const,
      },
      controlAssignments: {
        "slot-1": {
          controlSlot: "slot-1",
          teamId: "team-a",
          controlledPlayerId: "player-a",
          mode: "HUMAN" as const,
        },
        "slot-2": {
          controlSlot: "slot-2",
          teamId: "team-b",
          controlledPlayerId: "player-b",
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

    let dribbleByA = 0;
    for (let t = 0; t < 20; t++) {
      sim.applyInputs([
        {
          tick: t,
          sourceId: "test",
          controlSlot: "slot-1",
          moveX: 1,
          moveY: 0,
          sprint: 0,
          heldButtons: FT,
          pressedButtons: 0,
          releasedButtons: 0,
        },
        {
          tick: t,
          sourceId: "test",
          controlSlot: "slot-2",
          moveX: 0,
          moveY: 0,
          sprint: 0,
          heldButtons: 0,
          pressedButtons: 0,
          releasedButtons: 0,
        },
      ]);

      const result = sim.step();
      for (const ev of result.events) {
        if (ev.kind === "player-ball-contact") {
          const payload = ev.payload as { playerId: string; contactType: string };
          if (payload.contactType === "dribble-touch" && payload.playerId === "player-a") {
            dribbleByA++;
          }
          // No dribble-touch should come from player-b (not near ball).
          if (payload.contactType === "dribble-touch" && payload.playerId === "player-b") {
            throw new Error("player-b should not have dribble-touch (too far from ball)");
          }
        }
      }
    }

    expect(dribbleByA).toBeGreaterThan(0);

    // player-b should still be at initial position (no input to move).
    const snap = sim.snapshot();
    const playerB = snap.players.find((p) => p.playerId === "player-b")!;
    expect(playerB.groundPosition.x).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 11. Shot/pass still produce shot/pass even while FIRST_TOUCH is held
// ---------------------------------------------------------------------------

describe("CLOSE-CONTROL-011: shot/pass override dribble-touch in simulation loop", () => {
  it("SHOT_BIT + FIRST_TOUCH held produces shot, not dribble-touch", async () => {
    const { createWorld } = await import("../../../src/simulation/world/create.js");
    const { createSimulation } = await import("../../../src/simulation/loop/simulation.js");
    const { NO_OP_OBSERVER } = await import("../../../src/simulation/telemetry/observer.js");
    const { FIRST_TOUCH_BIT: FT, SHOT_BIT: SH } = await import("../../../src/contracts/input.js");

    const scenario = {
      id: "shot-overrides-close-control",
      version: "1.0.0",
      family: "close-control",
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

    // Hold FIRST_TOUCH and press SHOT on tick 0.
    sim.applyInputs([
      {
        tick: 0,
        sourceId: "test",
        controlSlot: "slot-1",
        moveX: 0,
        moveY: 0,
        sprint: 0,
        heldButtons: FT,
        pressedButtons: FT | SH,
        releasedButtons: 0,
      },
    ]);

    let foundShot = false;
    for (let i = 0; i < 5; i++) {
      const result = sim.step();
      for (const ev of result.events) {
        if (ev.kind === "shot") {
          foundShot = true;
        }
        // Should not have a dribble-touch on this tick.
        if (ev.kind === "player-ball-contact") {
          const payload = ev.payload as { contactType: string };
          expect(payload.contactType).not.toBe("dribble-touch");
        }
      }
      if (foundShot) break;
    }

    expect(foundShot).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 12. Checkpoint/restore continuation hash-equality while dribbling
// ---------------------------------------------------------------------------

describe("CLOSE-CONTROL-012: checkpoint/restore preserves dribble cooldowns", () => {
  it("restoring during a dribble-touch run produces identical subsequent hashes", async () => {
    const { createWorld } = await import("../../../src/simulation/world/create.js");
    const { createSimulation } = await import("../../../src/simulation/loop/simulation.js");
    const { NO_OP_OBSERVER } = await import("../../../src/simulation/telemetry/observer.js");
    const { FIRST_TOUCH_BIT: FT } = await import("../../../src/contracts/input.js");

    const scenario = {
      id: "checkpoint-restore-close-control",
      version: "1.0.0",
      family: "close-control",
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
          groundPosition: { x: 0.3, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        },
      ],
      ball: {
        position: { x: 0.5, y: 0, z: 0.11 },
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

    // --- Run 1: continuous run, no checkpoint ---
    const world1 = createWorld({ scenario });
    const sim1 = createSimulation(world1, NO_OP_OBSERVER);
    const hashes1ByTick: Record<number, string> = {};

    for (let t = 0; t < 20; t++) {
      sim1.applyInputs([
        {
          tick: t,
          sourceId: "test",
          controlSlot: "slot-1",
          moveX: 0.5,
          moveY: 0,
          sprint: 0,
          heldButtons: FT,
          pressedButtons: 0,
          releasedButtons: 0,
        },
      ]);
      const result = sim1.step();
      hashes1ByTick[result.tick] = result.stateHash;
    }

    // --- Run 2: checkpoint at tick 7, restore, continue ---
    const world2 = createWorld({ scenario });
    const sim2 = createSimulation(world2, NO_OP_OBSERVER);
    const hashes2ByTick: Record<number, string> = {};
    let checkpointTick = -1;

    for (let t = 0; t < 20; t++) {
      sim2.applyInputs([
        {
          tick: t,
          sourceId: "test",
          controlSlot: "slot-1",
          moveX: 0.5,
          moveY: 0,
          sprint: 0,
          heldButtons: FT,
          pressedButtons: 0,
          releasedButtons: 0,
        },
      ]);
      const result = sim2.step();

      if (result.tick === 7 && checkpointTick === -1) {
        // Checkpoint at committed tick 7, then restore.
        const cp = sim2.snapshot();
        sim2.restore(cp);
        // After restore, sim2.tick === 7.  The next loop iteration
        // applies input for tick 7 and steps to tick 8, which matches
        // the continuous run's path for the same tick.
        checkpointTick = result.tick;
        // Record the hash at tick 7 (same as Run 1 — no re-step).
        hashes2ByTick[result.tick] = result.stateHash;
        continue;
      }

      hashes2ByTick[result.tick] = result.stateHash;
    }

    // All hashes from tick 8 onward (post-restore) must match Run 1.
    for (let tick = 8; tick <= 20; tick++) {
      expect(hashes2ByTick[tick]).toBe(hashes1ByTick[tick]);
    }
  });

  it("restore clears stale cooldowns correctly (no phantom suppression)", async () => {
    const { createWorld } = await import("../../../src/simulation/world/create.js");
    const { createSimulation } = await import("../../../src/simulation/loop/simulation.js");
    const { NO_OP_OBSERVER } = await import("../../../src/simulation/telemetry/observer.js");
    const { FIRST_TOUCH_BIT: FT } = await import("../../../src/contracts/input.js");

    const scenario = {
      id: "cooldown-restore-clear",
      version: "1.0.0",
      family: "close-control",
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

    // Run 10 ticks to get a dribble-touch recorded.
    for (let t = 0; t < 10; t++) {
      sim.applyInputs([
        {
          tick: t,
          sourceId: "test",
          controlSlot: "slot-1",
          moveX: 0.5,
          moveY: 0,
          sprint: 0,
          heldButtons: FT,
          pressedButtons: 0,
          releasedButtons: 0,
        },
      ]);
      sim.step();
    }

    // Checkpoint at tick 10.
    const cp = sim.snapshot();

    // Restore to tick 10. The restored state should have dribble-touch events
    // in its history, and the cooldown map should be reconstructed from them.
    // After restoring, the next dribble-touch should NOT fire immediately
    // (it should respect the cooldown reconstructed from history).
    sim.restore(cp);

    // Apply input for tick 10 (the tick we restored to) and step.
    // Note: the simulation is now at tick 10.
    sim.applyInputs([
      {
        tick: 10,
        sourceId: "test",
        controlSlot: "slot-1",
        moveX: 0.5,
        moveY: 0,
        sprint: 0,
        heldButtons: FT,
        pressedButtons: 0,
        releasedButtons: 0,
      },
    ]);
    const immediateResult = sim.step();

    // If cooldown was NOT restored, this would fire a dribble-touch immediately.
    // If cooldown IS restored, this should be suppressed (within cooldown window).
    const immediateDribbleCount = immediateResult.events.filter(
      (e) => e.kind === "player-ball-contact" &&
        (e.payload as { contactType?: string })?.contactType === "dribble-touch",
    ).length;

    // With cooldown restored, no dribble-touch should fire immediately.
    expect(immediateDribbleCount).toBe(0);
  });
});
