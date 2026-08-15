/**
 * @module cpu-adapter-distance-shooting-tests
 *
 * Tests for distance-based shooting, shot cooldown, and deterministic shot aim.
 *
 * New features from AI-GOAL-IMPROVEMENT:
 *  - Close-range (< 5m): always shoot.
 *  - Mid-range (5–20m): shoot if facing within ±60° of goal.
 *  - Long-range (> 20m): no auto-shot.
 *  - Shot cooldown: suppress FIRST_TOUCH after shooting for 15 ticks.
 *  - Deterministic shot aim: lateral offset within goal width from tick hash.
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
import { SHOT_BIT, FIRST_TOUCH_BIT } from "../../../src/contracts/input.js";

// ===========================================================================
// 1. Shot aim determinism
// ===========================================================================

describe("AI-SHOOT-001: deterministic shot aim offset", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("same tick → same lateral aim (moveY consistent)", () => {
    // CPU at (30, 0), ball at (31, 0), team A, facing +x.
    const obs: CpuObservation = makeObservation(30, 0, 31, 0, 0, 0, "team-a");
    adapter.sample(0, obs); // gain possession.
    const frame1 = adapter.sample(42, obs); // tick 42 → OFFENSE.

    // Re-create fresh adapter with same observation at same tick.
    const adapter2 = createCpuAdapter();
    adapter2.sample(0, obs);
    const frame2 = adapter2.sample(42, obs);

    expect(frame1.moveY).toBe(frame2.moveY);
    expect(frame1.moveX).toBe(frame2.moveX);
  });

  it("different ticks → different lateral aim", () => {
    const obs: CpuObservation = makeObservation(30, 0, 31, 0, 0, 0, "team-a");
    adapter.sample(0, obs);
    const frame1 = adapter.sample(42, obs);
    const frame2 = adapter.sample(99, obs);

    // Different ticks should produce different aim points.
    // Note: if both ticks hash to the same offset by coincidence, this
    // could be false, but the hash space is 2^32 so probability ≈ 0.
    expect(frame1.moveY).not.toBe(frame2.moveY);
    expect(frame1.moveX).not.toBe(frame2.moveX);
  });
});

// ===========================================================================
// 2. Shot cooldown: prevents immediate re-possession
// ===========================================================================

describe("AI-SHOOT-002: shot cooldown prevents immediate re-possession", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("after shooting, FIRST_TOUCH is suppressed during cooldown", () => {
    // CPU at (50, 0), ball at (50.5, 0) — very close to goal.
    // Facing +x (toward goal), bodyHeading = 0.
    const obs: CpuObservation = makeObservation(50, 0, 50.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = 0;

    // First sample: gain possession (ballWasInRange).
    adapter.sample(0, obs);
    // Second sample: hasPossession = true, shoot (within 5m, facing goal).
    const frame1 = adapter.sample(1, obs);
    expect(frame1.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame1.pressedButtons & SHOT_BIT).not.toBe(0);

    // During cooldown, even if ball is near, FIRST_TOUCH should be suppressed.
    for (let tick = 2; tick < 17; tick++) {
      const frame = adapter.sample(tick, obs);
      expect(
        frame.heldButtons & FIRST_TOUCH_BIT,
        `tick ${tick}: FIRST_TOUCH should be suppressed during cooldown`,
      ).toBe(0);
    }
  });

  it("after cooldown expires, FIRST_TOUCH works again in defense mode", () => {
    // Use a scenario where the ball is far from the CPU,
    // so the CPU is in defense mode (chasing) and FIRST_TOUCH
    // would apply. Move ball to near the goal so cooldown
    // ends and then move ball back near CPU.
    const obs: CpuObservation = makeObservation(50, 0, 50.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = 0;

    // Shoot at tick 1.
    adapter.sample(0, obs);
    adapter.sample(1, obs);

    // During cooldown, CPU regains possession and shoots again,
    // resetting cooldown. After a few ticks, move ball away so CPU
    // enters defense mode.
    // Tick 2-5: CPU shoots repeatedly (possession re-established).
    for (let tick = 2; tick <= 10; tick++) {
      adapter.sample(tick, obs);
    }

    // Now move ball far away: CPU enters defense mode.
    // After cooldown expires, FIRST_TOUCH should work.
    // Make a new observation with ball far away.
    const obsFar: CpuObservation = makeObservation(0, 0, 20, 0, 0, 0, "team-a");

    // Wait until cooldown has fully expired from all previous shots.
    // Each shot resets cooldown to 15, so the last shot at tick 10
    // means cooldown expires at tick 25. We need to advance enough.
    for (let tick = 11; tick <= 26; tick++) {
      adapter.sample(tick, obsFar);
    }
    // At tick 26, cooldown should have expired (shot at tick 10, 15 ticks later = tick 25, at tick 26 it's 0).
    // Now the ball is at (20, 0) which is 20m away from CPU at (0, 0).
    // That's beyond FIRST_TOUCH_RANGE (1.5m), so FIRST_TOUCH won't press.
    // We need ball within 1.5m for FIRST_TOUCH. Let's check FIRST_TOUCH suppression is gone.
    const frame = adapter.sample(26, obsFar);
    // FIRST_TOUCH should not be suppressed anymore (cooldown expired).
    // But ball is far (20m), so no FIRST_TOUCH actually.
    expect(frame.heldButtons & FIRST_TOUCH_BIT).toBe(0);
    // The important check: no error thrown, meaning cooldown has passed.
    // Let's verify by moving ball into range.
    const obsClose: CpuObservation = makeObservation(0, 0, 1, 0, 0, 0, "team-a");
    const frame2 = adapter.sample(27, obsClose);
    // FIRST_TOUCH should now be pressed (ball near, no cooldown).
    expect(frame2.heldButtons & FIRST_TOUCH_BIT).not.toBe(0);
    expect(frame2.pressedButtons & FIRST_TOUCH_BIT).not.toBe(0);
  });

  it("cooldown resets after next shot", () => {
    const obs: CpuObservation = makeObservation(50, 0, 50.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = 0;

    // First shot at tick 1.
    adapter.sample(0, obs);
    adapter.sample(1, obs); // shot.

    // At tick 10, cooldown still active.
    const frameBefore = adapter.sample(10, obs);
    expect(frameBefore.heldButtons & FIRST_TOUCH_BIT).toBe(0);

    // Force possession again: move ball closer (simulating ball returning).
    // Actually, since ball is at 50.5 and effective possession range during cooldown is 3m,
    // the CPU should still have possession. Let's just shoot again from a new observation.
    // Create a new sample where we still have possession.
    adapter.sample(11, obs); // cooldown continues.
    adapter.sample(12, obs); // cooldown continues.
    // Shoot again when facing goal.
    const frameShoot2 = adapter.sample(15, obs);
    expect(frameShoot2.pressedButtons & SHOT_BIT).not.toBe(0);

    // Now cooldown should restart.
    const frameAfter = adapter.sample(16, obs);
    expect(frameAfter.heldButtons & FIRST_TOUCH_BIT).toBe(0);
  });
});

// ===========================================================================
// 3. Distance-based shooting decisions
// ===========================================================================

describe("AI-SHOOT-003: distance-based shooting", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("within 5m of goal: always shoots (close range)", () => {
    // CPU at (50, 0), ball at (50.5, 0), goal at (52.5, 0) → dist ≈ 2.5m.
    const obs: CpuObservation = makeObservation(50, 0, 50.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = 0; // facing +x.

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).not.toBe(0);
  });

  it("within 5m: shoots regardless of body heading (always shoot)", () => {
    // CPU at (50, 0), ball at (50.5, 0), dist ≈ 2.5m.
    // bodyHeading = 180° (π) — facing away from goal.
    const obs: CpuObservation = makeObservation(50, 0, 50.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Within 5m: always shoot regardless of heading.
    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).not.toBe(0);
  });

  it("within 5-20m: shoots only when facing within ±60° of goal", () => {
    // CPU at (20, 0), ball at (20.5, 0), goal at (52.5, 0) → dist ≈ 32.5m.
    // This is actually beyond 20m. Let's use a closer position.
    // CPU at (40, 0), ball at (40.5, 0), dist ≈ 12.5m (mid-range).
    const obs: CpuObservation = makeObservation(40, 0, 40.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = 0; // facing +x, toward goal.

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).not.toBe(0);
  });

  it("within 5-20m: does NOT shoot when facing away from goal", () => {
    // CPU at (40, 0), ball at (40.5, 0), dist ≈ 12.5m.
    // bodyHeading = π (facing -x, away from goal).
    const obs: CpuObservation = makeObservation(40, 0, 40.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Beyond 5m: needs to face the goal to shoot.
    expect(frame.heldButtons & SHOT_BIT).toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).toBe(0);
  });

  it("beyond 20m: does NOT shoot (dribble only)", () => {
    // CPU at (10, 0), ball at (10.5, 0), goal at (52.5, 0) → dist ≈ 42.5m.
    const obs: CpuObservation = makeObservation(10, 0, 10.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = 0;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & SHOT_BIT).toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).toBe(0);
  });

  it("dribbling beyond 20m: moves toward goal", () => {
    const obs: CpuObservation = makeObservation(10, 0, 10.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = 0;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Should still move toward the goal (dribble).
    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.heldButtons & SHOT_BIT).toBe(0);
  });
});

// ===========================================================================
// 4. Determinism: same input → same output
// ===========================================================================

describe("AI-SHOOT-004: determinism under full sequence", () => {
  it("full possession sequence is deterministic across adapters", () => {
    const obs: CpuObservation = makeObservation(50, 0, 50.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = 0;

    const a1 = createCpuAdapter();
    const a2 = createCpuAdapter();

    const frames1: number[] = [];
    const frames2: number[] = [];

    for (let tick = 0; tick < 30; tick++) {
      const f1 = a1.sample(tick, obs);
      const f2 = a2.sample(tick, obs);
      frames1.push(f1.heldButtons | (f1.pressedButtons << 16));
      frames2.push(f2.heldButtons | (f2.pressedButtons << 16));
    }

    expect(frames1).toEqual(frames2);
  });

  it("moveX/moveY are deterministic across adapters", () => {
    const obs: CpuObservation = makeObservation(40, 3, 40.5, 3, 0, 0, "team-a");
    obs.players[0].bodyHeading = 0.5;

    const a1 = createCpuAdapter();
    const a2 = createCpuAdapter();

    a1.sample(0, obs);
    a2.sample(0, obs);

    for (let tick = 1; tick < 20; tick++) {
      const f1 = a1.sample(tick, obs);
      const f2 = a2.sample(tick, obs);
      expect(f1.moveX).toBe(f2.moveX);
      expect(f1.moveY).toBe(f2.moveY);
      expect(f1.heldButtons).toBe(f2.heldButtons);
      expect(f1.pressedButtons).toBe(f2.pressedButtons);
    }
  });
});

// ===========================================================================
// Helper
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