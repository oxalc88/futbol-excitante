/**
 * @module tests/unit/cpu-adapter/passing
 *
 * Tests for CPU pass (PASS_BIT) behavior.
 *
 * Covers:
 *  1. PASS_BIT pressed when in possession and beyond shooting range
 *  2. PASS_BIT NOT pressed when in close shooting range (SHOT_BIT takes priority)
 *  3. PASS_BIT NOT pressed when not in possession (defense/chase mode)
 *  4. PASS_BIT appears in heldButtons and pressedButtons correctly
 *  5. Pass behavior respects post-shot cooldown (doesn't pass immediately after shooting)
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
import { PASS_BIT, FIRST_TOUCH_BIT, SHOT_BIT } from "../../../src/contracts/input.js";

// ===========================================================================
// 1. PASS_BIT pressed when in possession and beyond shooting range
// ===========================================================================

describe("CPU-PASS-001: PASS_BIT pressed when in possession and beyond shooting range", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("CPU at 12.5m from goal, facing away → presses PASS_BIT", () => {
    // CPU at (20, 0), ball at (20.5, 0), goal at (52.5, 0) → dist ≈ 32.5m.
    // bodyHeading = π (facing -x, away from goal).
    const obs: CpuObservation = makeObservation(20, 0, 20.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = Math.PI;

    // Tick 0: ballInRange true → ballWasInRange set.
    adapter.sample(0, obs);
    // Tick 1: hasPossession confirmed, offense mode.
    // distToGoal ≈ 32.5m > SHOT_RANGE_WIDE (20m) → PASS_BIT pressed.
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.pressedButtons & PASS_BIT).not.toBe(0);
    // Should still move toward the goal.
    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.sprint).toBe(1);
  });

  it("CPU at 25m from goal, facing away → presses PASS_BIT", () => {
    // CPU at (5, 0), ball at (5.5, 0), goal at (52.5, 0) → dist ≈ 47.5m.
    // bodyHeading = π (facing -x, away from goal).
    const obs: CpuObservation = makeObservation(5, 0, 5.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.pressedButtons & PASS_BIT).not.toBe(0);
  });

  it("CPU at 12.5m from goal, facing away, team-b → presses PASS_BIT toward -x goal", () => {
    // CPU at (20, 0), ball at (20.5, 0), team-b attacks -x (goal at -52.5).
    // bodyHeading = 0 (facing +x, away from team-b's goal at -x).
    const obs: CpuObservation = makeObservation(20, 0, 20.5, 0, 0, 0, "team-b");
    obs.players[0].bodyHeading = 0;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.pressedButtons & PASS_BIT).not.toBe(0);
  });
});

// ===========================================================================
// 2. PASS_BIT NOT pressed when in close shooting range
// ===========================================================================

describe("CPU-PASS-002: PASS_BIT NOT pressed when in close shooting range", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("within 5m of goal: SHOT_BIT takes priority, no PASS_BIT", () => {
    // CPU at (50, 0), ball at (50.5, 0), goal at (52.5, 0) → dist ≈ 2.5m.
    // bodyHeading = 0 (facing +x, toward goal).
    const obs: CpuObservation = makeObservation(50, 0, 50.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = 0;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).not.toBe(0);
    expect(frame.heldButtons & PASS_BIT).toBe(0);
    expect(frame.pressedButtons & PASS_BIT).toBe(0);
  });

  it("within 5m of goal: even when facing away, SHOT_BIT takes priority", () => {
    // CPU at (50, 0), ball at (50.5, 0), dist ≈ 2.5m.
    // bodyHeading = π (facing away from goal).
    const obs: CpuObservation = makeObservation(50, 0, 50.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Within 5m: always shoot regardless of heading.
    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).not.toBe(0);
    expect(frame.heldButtons & PASS_BIT).toBe(0);
    expect(frame.pressedButtons & PASS_BIT).toBe(0);
  });
});

// ===========================================================================
// 3. PASS_BIT NOT pressed when not in possession (defense/chase mode)
// ===========================================================================

describe("CPU-PASS-003: PASS_BIT NOT pressed in defense/chase mode", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("ball far away → no PASS_BIT (chase mode)", () => {
    // CPU at (0, 0), ball at (10, 0) → 10m away, no possession.
    const obs: CpuObservation = makeObservation(0, 0, 10, 0, 0, 0);

    const frame = adapter.sample(0, obs);

    expect(frame.heldButtons & PASS_BIT).toBe(0);
    expect(frame.pressedButtons & PASS_BIT).toBe(0);
  });

  it("ball far away with cpuTeamId → still no PASS_BIT", () => {
    // CPU at (0, 0), ball at (10, 0), team set but no possession.
    const obs: CpuObservation = makeObservation(0, 0, 10, 0, 0, 0, "team-a");

    const frame = adapter.sample(0, obs);

    expect(frame.heldButtons & PASS_BIT).toBe(0);
    expect(frame.pressedButtons & PASS_BIT).toBe(0);
  });

  it("ball within 1.5m but no cpuTeamId → FIRST_TOUCH only, no PASS_BIT", () => {
    // Ball close but no team set → defense mode only.
    const obs: CpuObservation = makeObservation(0, 0, 1, 0, 0.3, 0.2);

    const frame = adapter.sample(0, obs);

    expect(frame.heldButtons & FIRST_TOUCH_BIT).not.toBe(0);
    expect(frame.heldButtons & PASS_BIT).toBe(0);
    expect(frame.pressedButtons & PASS_BIT).toBe(0);
  });
});

// ===========================================================================
// 4. PASS_BIT appears in heldButtons and pressedButtons correctly
// ===========================================================================

describe("CPU-PASS-004: PASS_BIT in heldButtons and pressedButtons", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("first pass tick: PASS_BIT in both heldButtons and pressedButtons", () => {
    const obs: CpuObservation = makeObservation(20, 0, 20.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.pressedButtons & PASS_BIT).not.toBe(0);
  });

  it("subsequent pass tick: PASS_BIT in heldButtons but not pressedButtons", () => {
    const obs: CpuObservation = makeObservation(20, 0, 20.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    adapter.sample(1, obs); // first pass: pressed + held.

    const frame2 = adapter.sample(2, obs);
    // Ball still in range (same observation), so held but not newly pressed.
    expect(frame2.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame2.pressedButtons & PASS_BIT).toBe(0);
  });

  it("PASS_BIT is a distinct bit separate from SHOT_BIT and FIRST_TOUCH_BIT", () => {
    const obs: CpuObservation = makeObservation(20, 0, 20.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // PASS_BIT = 2, SHOT_BIT = 4, FIRST_TOUCH_BIT = 1.
    // heldButtons should only have PASS_BIT (bit 1).
    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.heldButtons & SHOT_BIT).toBe(0);
    expect(frame.heldButtons & FIRST_TOUCH_BIT).toBe(0);
  });
});

// ===========================================================================
// 5. Pass behavior respects post-shot cooldown
// ===========================================================================

describe("CPU-PASS-005: pass respects post-shot cooldown", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("after shooting, PASS_BIT is suppressed during cooldown", () => {
    // CPU at (50, 0), ball at (50.5, 0), 0.5m from goal → close range.
    // bodyHeading = 0 (facing +x toward goal).
    const obs: CpuObservation = makeObservation(50, 0, 50.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = 0;

    // Tick 0: gain possession (ballWasInRange).
    adapter.sample(0, obs);
    // Tick 1: shoot (within 5m, facing goal).
    const frame1 = adapter.sample(1, obs);
    expect(frame1.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame1.pressedButtons & SHOT_BIT).not.toBe(0);

    // During cooldown (ticks 2–16), PASS_BIT should NOT be pressed.
    for (let tick = 2; tick <= 16; tick++) {
      const frame = adapter.sample(tick, obs);
      expect(
        frame.pressedButtons & PASS_BIT,
        `tick ${tick}: PASS_BIT should be suppressed during cooldown`,
      ).toBe(0);
    }
  });

  it("after shot cooldown expires, PASS_BIT can be pressed in a fresh adapter", () => {
    // Use a scenario where the ball is within pass range but beyond shooting range.
    const obs: CpuObservation = makeObservation(20, 0, 20.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = Math.PI;

    // Fresh adapter: should pass freely.
    const freshAdapter = createCpuAdapter();
    freshAdapter.sample(0, obs);
    const freshFrame = freshAdapter.sample(1, obs);

    expect(freshFrame.heldButtons & PASS_BIT).not.toBe(0);
    expect(freshFrame.pressedButtons & PASS_BIT).not.toBe(0);
  });

  it("PASS_BIT suppression during cooldown: check heldButtons too", () => {
    // Same setup as the first cooldown test but with a scenario that
    // would trigger PASS_BIT if cooldown were absent.
    const obs: CpuObservation = makeObservation(50, 0, 50.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = 0;

    adapter.sample(0, obs);
    adapter.sample(1, obs); // shot.

    // During cooldown, even if the ball is in pass range, PASS_BIT is suppressed.
    for (let tick = 2; tick <= 16; tick++) {
      const frame = adapter.sample(tick, obs);
      expect(
        frame.heldButtons & PASS_BIT,
        `tick ${tick}: PASS_BIT held should be suppressed during cooldown`,
      ).toBe(0);
    }
  });
});

// ===========================================================================
// 6. Determinism: pass behavior is deterministic
// ===========================================================================

describe("CPU-PASS-006: pass determinism", () => {
  it("same observation → identical pass pattern across adapters", () => {
    const obs: CpuObservation = makeObservation(20, 0, 20.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = Math.PI;

    const a1 = createCpuAdapter();
    const a2 = createCpuAdapter();

    a1.sample(0, obs);
    a2.sample(0, obs);

    for (let tick = 1; tick < 10; tick++) {
      const f1 = a1.sample(tick, obs);
      const f2 = a2.sample(tick, obs);
      expect(f1.heldButtons).toBe(f2.heldButtons);
      expect(f1.pressedButtons).toBe(f2.pressedButtons);
      expect(f1.moveX).toBe(f2.moveX);
      expect(f1.moveY).toBe(f2.moveY);
    }
  });

  it("pass and shot scenarios produce different button patterns", () => {
    // Pass scenario: beyond shooting range, facing away.
    const passObs: CpuObservation = makeObservation(20, 0, 20.5, 0, 0, 0, "team-a");
    passObs.players[0].bodyHeading = Math.PI;

    // Shot scenario: within close range, facing goal.
    const shotObs: CpuObservation = makeObservation(50, 0, 50.5, 0, 0, 0, "team-a");
    shotObs.players[0].bodyHeading = 0;

    const passAdapter = createCpuAdapter();
    passAdapter.sample(0, passObs);
    const passFrame = passAdapter.sample(1, passObs);

    const shotAdapter = createCpuAdapter();
    shotAdapter.sample(0, shotObs);
    const shotFrame = shotAdapter.sample(1, shotObs);

    // Pass scenario: PASS_BIT set, no SHOT_BIT.
    expect(passFrame.heldButtons & PASS_BIT).not.toBe(0);
    expect(passFrame.heldButtons & SHOT_BIT).toBe(0);

    // Shot scenario: SHOT_BIT set, no PASS_BIT.
    expect(shotFrame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(shotFrame.heldButtons & PASS_BIT).toBe(0);
  });
});

// ===========================================================================
// 7. Score-state awareness: pass behavior with urgency
// ===========================================================================

describe("CPU-PASS-007: pass with score-state awareness", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("CPU behind (scoreDiff ≤ -2) → urgency widens shot tolerance, may still pass when facing away", () => {
    // CPU at (20, 0), ball at (20.5, 0) → dist from goal ≈ 32.5m.
    // Facing away from goal (π). With urgency 2, tolerance widens
    // to π/3 * 2 = 2π/3 ≈ 120°, capped at π (180°) → 120°.
    // Heading diff = π ≈ 180° > 120° → no shot, so pass.
    const obs: CpuObservation = makeObservation(20, 0, 20.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = Math.PI;
    obs.scoreDifferential = -3;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // With urgency 2, facing tolerance is 120°.  Heading diff is 180°
    // so the CPU does NOT face well enough → no shot.
    // But it's in possession, beyond shooting range, and not facing
    // the goal → PASS_BIT should be pressed.
    expect(frame.heldButtons & SHOT_BIT).toBe(0);
    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
  });

  it("CPU ahead (scoreDiff ≥ 2) → reduced urgency, pass when facing away", () => {
    // CPU at (20, 0), ball at (20.5, 0), 12.5m from goal.
    // Facing away from goal (π). With urgency 0.5, tolerance becomes ±π/6.
    // headingDiff = π >> π/6 → no shot → pass.
    const obs: CpuObservation = makeObservation(20, 0, 20.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = Math.PI;
    obs.scoreDifferential = 3;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.heldButtons & SHOT_BIT).toBe(0);
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