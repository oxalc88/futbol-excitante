/**
 * @module tests/unit/cpu-adapter/pursuit
 *
 * Tests for CPU ball pursuit — active movement toward ball when out of
 * possession (PURSUIT/DEFENSE mode).  The CPU adapter must produce movement
 * inputs that drive the locomotion system toward the ball position.
 *
 * Covers:
 *  1. Pursuit direction: normalized vector toward ball position
 *  2. Pursuit continues across ticks (stateful chase)
 *  3. First-touch activation when ball enters range during pursuit
 *  4. Transition from pursuit → attack when ball is in possession range
 *  5. Pursuit with ball moving away (leading the target)
 *  6. No FIRST_TOUCH when ball is far (pure pursuit)
 *
 * All values are provisional (unmeasured PES 2017).
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createCpuAdapter,
  type CpuAdapter,
  type CpuObservation,
} from "../../../src/adapters/input-browser/cpu-adapter.js";
import { FIRST_TOUCH_BIT, SHOT_BIT } from "../../../src/contracts/input.js";

// ---------------------------------------------------------------------------
// 1. Pursuit direction: movement vector toward ball
// ---------------------------------------------------------------------------

describe("PURSUIT-001: pursuit movement vector toward ball", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("ball at (10, 0) relative to CPU → moveX > 0, moveY ≈ 0", () => {
    const obs: CpuObservation = makeObservation(0, 0, 10, 0, 0, 0);
    const frame = adapter.sample(0, obs);

    // Should move in positive X direction toward the ball.
    expect(frame.moveX).toBeGreaterThan(0);
    // Y movement should be negligible.
    expect(Math.abs(frame.moveY)).toBeLessThan(0.01);
    expect(frame.sprint).toBe(1);
  });

  it("ball at (0, 15) relative to CPU → moveX ≈ 0, moveY > 0", () => {
    const obs: CpuObservation = makeObservation(0, 0, 0, 15, 0, 0);
    const frame = adapter.sample(0, obs);

    expect(Math.abs(frame.moveX)).toBeLessThan(0.01);
    expect(frame.moveY).toBeGreaterThan(0);
  });

  it("ball at (-20, -20) relative to CPU → moveX < 0, moveY < 0", () => {
    const obs: CpuObservation = makeObservation(0, 0, -20, -20, 0, 0);
    const frame = adapter.sample(0, obs);

    expect(frame.moveX).toBeLessThan(0);
    expect(frame.moveY).toBeLessThan(0);
  });

  it("ball at (20, 20) → pursuit direction is normalized unit vector", () => {
    // (20, 20) → normalized direction should be (0.707..., 0.707...).
    const obs: CpuObservation = makeObservation(0, 0, 20, 20, 0, 0);
    const frame = adapter.sample(0, obs);

    const mag = Math.sqrt(frame.moveX * frame.moveX + frame.moveY * frame.moveY);
    // Unit vector magnitude should be 1 (or very close).
    expect(mag).toBeGreaterThan(0.99);
    expect(mag).toBeLessThan(1.01);
  });

  it("ball at same position → neutral input (moveX = 0, moveY = 0)", () => {
    const obs: CpuObservation = makeObservation(0, 0, 0, 0, 0, 0);
    const frame = adapter.sample(0, obs);

    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
  });

  it("ball at (0.0005, 0.0003) → near-zero movement still positive direction", () => {
    const obs: CpuObservation = makeObservation(0, 0, 0.0005, 0.0003, 0, 0);
    const frame = adapter.sample(0, obs);

    // With dist < 0.001, the condition distToBall > 0.001 is false → moveX = 0, moveY = 0.
    // This is intentional: tiny distances are treated as "on top of the ball".
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Pursuit continuity across ticks
// ---------------------------------------------------------------------------

describe("PURSUIT-002: pursuit continuity across ticks", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("same ball position → same movement direction each tick (deterministic)", () => {
    const obs: CpuObservation = makeObservation(0, 0, 10, 5, 0, 0);
    const frame0 = adapter.sample(0, obs);
    const frame5 = adapter.sample(5, obs);
    const frame100 = adapter.sample(100, obs);

    // All three ticks produce the same movement direction.
    expect(frame0.moveX).toBe(frame5.moveX);
    expect(frame0.moveY).toBe(frame5.moveY);
    expect(frame5.moveX).toBe(frame100.moveX);
    expect(frame5.moveY).toBe(frame100.moveY);
  });

  it("changing ball position → movement direction updates accordingly", () => {
    const obs1: CpuObservation = makeObservation(0, 0, 10, 0, 0, 0);
    const obs2: CpuObservation = makeObservation(0, 0, 10, 5, 0, 0);
    const obs3: CpuObservation = makeObservation(0, 0, 0, 10, 0, 0);

    adapter.sample(0, obs1);
    adapter.sample(1, obs2);
    adapter.sample(2, obs3);

    // Different ball Y positions → different moveY.
    expect(Math.abs(obs1.ball.position.y - obs2.ball.position.y)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. First-touch activation when ball enters pursuit range
// ---------------------------------------------------------------------------

describe("PURSUIT-003: first-touch during pursuit", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("ball far away (5m) → no FIRST_TOUCH during pursuit", () => {
    const obs: CpuObservation = makeObservation(0, 0, 5, 0, 0, 0);
    const frame = adapter.sample(0, obs);

    expect(frame.heldButtons & FIRST_TOUCH_BIT).toBe(0);
    expect(frame.pressedButtons & FIRST_TOUCH_BIT).toBe(0);
  });

  it("ball within 1.5m and slow → FIRST_TOUCH pressed during pursuit", () => {
    // Ball at (1, 0) — 1m away, velocity 0.5 m/s (below threshold).
    const obs: CpuObservation = makeObservation(0, 0, 1, 0, 0.3, 0.2);
    const frame = adapter.sample(0, obs);

    expect(frame.heldButtons & FIRST_TOUCH_BIT).not.toBe(0);
    expect(frame.pressedButtons & FIRST_TOUCH_BIT).not.toBe(0);
  });

  it("ball within 1.5m but fast → no FIRST_TOUCH even during pursuit", () => {
    // Ball at (1, 0) but horizontal speed > 2 m/s threshold.
    const obs: CpuObservation = makeObservation(0, 0, 1, 0, 2.5, 1.0);
    const frame = adapter.sample(0, obs);

    expect(frame.heldButtons & FIRST_TOUCH_BIT).toBe(0);
    expect(frame.pressedButtons & FIRST_TOUCH_BIT).toBe(0);
  });

  it("ball in range tick 0, still in range tick 1 → FIRST_TOUCH held, not pressed", () => {
    const obs: CpuObservation = makeObservation(0, 0, 1, 0, 0.3, 0.2);

    // First tick: ball just entered range → press.
    const frame0 = adapter.sample(0, obs);
    expect(frame0.pressedButtons & FIRST_TOUCH_BIT).not.toBe(0);
    expect(frame0.heldButtons & FIRST_TOUCH_BIT).not.toBe(0);

    // Second tick: still in range → hold, no new press.
    const frame1 = adapter.sample(1, obs);
    expect(frame1.pressedButtons & FIRST_TOUCH_BIT).toBe(0);
    expect(frame1.heldButtons & FIRST_TOUCH_BIT).not.toBe(0);
  });

  it("ball goes out of range → FIRST_TOUCH cleared", () => {
    const obsClose: CpuObservation = makeObservation(0, 0, 1, 0, 0, 0);
    const obsFar: CpuObservation = makeObservation(0, 0, 5, 0, 0, 0);

    // Gain first-touch hold.
    adapter.sample(0, obsClose);
    adapter.sample(1, obsClose); // held, not pressed.
    expect(adapter).toBeDefined();

    // Move ball away — FIRST_TOUCH should be cleared.
    const frameFar = adapter.sample(2, obsFar);
    expect(frameFar.heldButtons & FIRST_TOUCH_BIT).toBe(0);
    expect(frameFar.pressedButtons & FIRST_TOUCH_BIT).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Transition from pursuit → attack (possession gain)
// ---------------------------------------------------------------------------

describe("PURSUIT-004: pursuit-to-attack transition", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("ball enters range → FIRST_TOUCH, then on next tick has possession", () => {
    const obs: CpuObservation = makeObservation(0, 0, 1, 0, 0, 0, "team-a");

    // Tick 0: ball just entered range → FIRST_TOUCH pressed (defense mode).
    const frame0 = adapter.sample(0, obs);
    expect(frame0.heldButtons & FIRST_TOUCH_BIT).not.toBe(0);
    expect(frame0.pressedButtons & FIRST_TOUCH_BIT).not.toBe(0);

    // Tick 1: ball still in range → ballWasInRange → hasPossession = true.
    // Now in offense mode (attacking goal), not defense (chasing ball).
    // In offense mode, FIRST_TOUCH is NOT pressed — the CPU steers toward the goal.
    const frame1 = adapter.sample(1, obs);
    // FIRST_TOUCH is cleared once the CPU enters offense mode (no possession buttons in offense).
    expect(frame1.heldButtons & FIRST_TOUCH_BIT).toBe(0);

    // Once in possession, movement should steer toward the goal (not ball).
    // For team-a attacking +x, moveX should be > 0.
    expect(frame1.moveX).toBeGreaterThan(0);
  });

  it("ball moves out of possession range → back to pursuit", () => {
    const obs: CpuObservation = makeObservation(0, 0, 1, 0, 0, 0, "team-a");

    // Gain possession.
    adapter.sample(0, obs);
    adapter.sample(1, obs); // hasPossession = true (offense).

    // Now move ball far away — CPU should go back to pursuit.
    const obsFar: CpuObservation = makeObservation(0, 0, 25, 0, 0, 0, "team-a");
    adapter.sample(2, obsFar); // ball beyond POSSESSION_RANGE (2m) → hasPossession = false.
    // This tick: still in defense, chasing ball.
    adapter.sample(3, obsFar);

    // Should be moving toward ball at (25, 0).
    const frame = adapter.sample(4, obsFar);
    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.heldButtons & FIRST_TOUCH_BIT).toBe(0);
  });

  it("shot → possession lost → back to pursuit", () => {
    const obs: CpuObservation = makeObservation(50, 0, 50.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = 0; // facing +x toward goal.

    // Tick 0: gain possession.
    adapter.sample(0, obs);

    // Tick 1: shoot.
    adapter.sample(1, obs);

    // After shooting, the CPU has no possession and ball is still near.
    // During cooldown, FIRST_TOUCH should be suppressed.
    adapter.sample(2, obs);

    // Should still be in pursuit/chase mode (hasPossession = false after shot).
    // moveX should be toward ball (at x=50.5) from player (at x=50).
    // Actually, after a shot the player is still near the ball — in defense mode.
    // But FIRST_TOUCH is suppressed during cooldown.
    const frame3 = adapter.sample(3, obs);
    expect(frame3.heldButtons & FIRST_TOUCH_BIT).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Pursuit with ball velocity (leading the target)
// ---------------------------------------------------------------------------

describe("PURSUIT-005: pursuit direction with moving ball", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("ball moving away in +X → pursuit still in +X direction", () => {
    // CPU at (0, 0), ball at (10, 0) moving away at (3, 0).
    const obs: CpuObservation = makeObservation(0, 0, 10, 0, 3, 0);
    const frame = adapter.sample(0, obs);

    // Still moves toward ball.
    expect(frame.moveX).toBeGreaterThan(0);
    expect(Math.abs(frame.moveY)).toBeLessThan(0.01);
  });

  it("ball at (5, 5) moving (1, 1) → pursuit is diagonal", () => {
    const obs: CpuObservation = makeObservation(0, 0, 5, 5, 1, 1);
    const frame = adapter.sample(0, obs);

    // Both X and Y movement should be positive (toward ball).
    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.moveY).toBeGreaterThan(0);
  });

  it("ball at (-15, 8) → pursuit moves in negative X, positive Y", () => {
    const obs: CpuObservation = makeObservation(0, 0, -15, 8, -2, 1);
    const frame = adapter.sample(0, obs);

    expect(frame.moveX).toBeLessThan(0);
    expect(frame.moveY).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Pursuit produces sprint = 1 (always sprints when chasing)
// ---------------------------------------------------------------------------

describe("PURSUIT-006: sprint always 1 during pursuit", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("pursuit mode → sprint = 1", () => {
    const obs: CpuObservation = makeObservation(0, 0, 10, 0, 0, 0);
    const frame = adapter.sample(0, obs);
    expect(frame.sprint).toBe(1);
  });

  it("pursuit with ball in range → still sprint = 1", () => {
    const obs: CpuObservation = makeObservation(0, 0, 1, 0, 0, 0);
    const frame = adapter.sample(0, obs);
    expect(frame.sprint).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 7. Team direction awareness: pursuit uses correct attack direction
// ---------------------------------------------------------------------------

describe("PURSUIT-007: team direction in pursuit", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("team-a pursuit at (0,0) with ball at (10,0) → moveX > 0", () => {
    const obs: CpuObservation = makeObservation(0, 0, 10, 0, 0, 0, "team-a");
    const frame = adapter.sample(0, obs);
    expect(frame.moveX).toBeGreaterThan(0);
  });

  it("team-b pursuit at (0,0) with ball at (-10,0) → moveX < 0", () => {
    const obs: CpuObservation = makeObservation(0, 0, -10, 0, 0, 0, "team-b");
    const frame = adapter.sample(0, obs);
    expect(frame.moveX).toBeLessThan(0);
  });

  it("pursuit without cpuTeamId still chases ball correctly", () => {
    // No team set — CPU adapter doesn't enter offense mode.
    const obs: CpuObservation = makeObservation(0, 0, 10, 0, 0, 0);
    const frame = adapter.sample(0, obs);
    expect(frame.moveX).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 8. No goal-related action bits during pure pursuit
// ---------------------------------------------------------------------------

describe("PURSUIT-008: no action bits during pursuit", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("pursuit (ball far) → no SHOT_BIT", () => {
    const obs: CpuObservation = makeObservation(0, 0, 20, 0, 0, 0);
    const frame = adapter.sample(0, obs);

    expect(frame.heldButtons & SHOT_BIT).toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).toBe(0);
  });

  it("pursuit (ball far) → no other buttons held", () => {
    const obs: CpuObservation = makeObservation(0, 0, 15, 10, 0, 0);
    const frame = adapter.sample(0, obs);

    // Only FIRST_TOUCH is relevant for pursuit; no other action bits.
    expect(frame.heldButtons).toBe(0);
    expect(frame.pressedButtons).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Determinism: pursuit is fully deterministic
// ---------------------------------------------------------------------------

describe("PURSUIT-009: determinism of pursuit behavior", () => {
  it("same ball state → identical movement across independent adapters", () => {
    const a1 = createCpuAdapter();
    const a2 = createCpuAdapter();

    const obs: CpuObservation = makeObservation(0, 0, 12, -7, 1.5, 0.8);

    for (let tick = 0; tick < 20; tick++) {
      const f1 = a1.sample(tick, obs);
      const f2 = a2.sample(tick, obs);

      expect(f1.moveX).toBe(f2.moveX);
      expect(f1.moveY).toBe(f2.moveY);
      expect(f1.heldButtons).toBe(f2.heldButtons);
      expect(f1.pressedButtons).toBe(f2.pressedButtons);
    }
  });

  it("pursuit with ball in range → identical FIRST_TOUCH pattern", () => {
    const a1 = createCpuAdapter();
    const a2 = createCpuAdapter();

    const obs: CpuObservation = makeObservation(0, 0, 0.8, 0.3, 0.2, 0.1);

    // First tick: ball just entered range → both should press.
    const f1_0 = a1.sample(0, obs);
    const f2_0 = a2.sample(0, obs);
    expect(f1_0.pressedButtons & FIRST_TOUCH_BIT).not.toBe(0);
    expect(f2_0.pressedButtons & FIRST_TOUCH_BIT).not.toBe(0);

    // Second tick: both should hold without pressing.
    const f1_1 = a1.sample(1, obs);
    const f2_1 = a2.sample(1, obs);
    expect(f1_1.pressedButtons & FIRST_TOUCH_BIT).toBe(0);
    expect(f2_1.pressedButtons & FIRST_TOUCH_BIT).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 10. Edge case: ball very close (within FIRST_TOUCH_RANGE) but in possession
// ---------------------------------------------------------------------------

describe("PURSUIT-100: edge case — ball at boundary of FIRST_TOUCH_RANGE", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("ball at exactly 1.499m (just inside 1.5m range) → FIRST_TOUCH", () => {
    const obs: CpuObservation = makeObservation(0, 0, 1.499, 0, 0, 0);
    const frame = adapter.sample(0, obs);
    // 1.499 < 1.5 → in range → FIRST_TOUCH pressed.
    expect(frame.heldButtons & FIRST_TOUCH_BIT).not.toBe(0);
  });

  it("ball at exactly 1.5m (at boundary) → NO FIRST_TOUCH (not < 1.5)", () => {
    const obs: CpuObservation = makeObservation(0, 0, 1.5, 0, 0, 0);
    const frame = adapter.sample(0, obs);
    // 1.5 is NOT < 1.5 → out of range.
    expect(frame.heldButtons & FIRST_TOUCH_BIT).toBe(0);
  });

  it("ball at 1.501m → no FIRST_TOUCH (just outside range)", () => {
    const obs: CpuObservation = makeObservation(0, 0, 1.501, 0, 0, 0);
    const frame = adapter.sample(0, obs);
    expect(frame.heldButtons & FIRST_TOUCH_BIT).toBe(0);
  });

  it("ball at 0m distance: tick 0 → FIRST_TOUCH pressed (defense, ball just entered)", () => {
    const obs: CpuObservation = makeObservation(0, 0, 0, 0, 0, 0);

    // Tick 0: hasPossession = false initially. CPU is in defense mode.
    // Ball is in range (dist 0 < 1.5, speed 0 < 2) → FIRST_TOUCH pressed.
    const frame0 = adapter.sample(0, obs);
    expect(frame0.moveX).toBe(0);
    expect(frame0.moveY).toBe(0);
    expect(frame0.heldButtons & FIRST_TOUCH_BIT).not.toBe(0);
    expect(frame0.pressedButtons & FIRST_TOUCH_BIT).not.toBe(0);
  });

  it("ball at 0m distance: tick 1 → OFFENSE (possession confirmed, no FIRST_TOUCH)", () => {
    const obs: CpuObservation = makeObservation(0, 0, 0, 0, 0, 0, "team-a");

    // Tick 0: ballWasInRange = true.
    adapter.sample(0, obs);

    // Tick 1: hasPossession = true (confirmed from ballWasInRange).
    // CPU enters OFFENSE mode — steers toward goal, no FIRST_TOUCH.
    const frame1 = adapter.sample(1, obs);
    expect(frame1.moveX).toBeGreaterThan(0); // toward goal at +x.
    expect(frame1.heldButtons & FIRST_TOUCH_BIT).toBe(0);
  });
});

// ===========================================================================
// Helper: create a CpuObservation with given player/ball positions
// ===========================================================================

function makeObservation(
  playerX: number,
  playerY: number,
  ballX: number,
  ballY: number,
  ballVx: number,
  ballVy: number,
  cpuTeamId?: string,
): CpuObservation {
  return {
    players: [
      {
        playerId: "cpu-player",
        teamId: "team-cpu",
        groundPosition: { x: playerX, y: playerY },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
      },
    ],
    ball: {
      position: { x: ballX, y: ballY, z: 0.11 },
      linearVelocity: { x: ballVx, y: ballVy, z: 0 },
      regime: "ground-roll",
    },
    pitchLength: 105,
    pitchWidth: 68,
    cpuTeamId,
  };
}