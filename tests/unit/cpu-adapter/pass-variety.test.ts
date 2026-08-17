/**
 * @module tests/unit/cpu-adapter/pass-variety
 *
 * Tests for CPU pass variety: ground vs lofted pass selection,
 * defender-aware target selection, and urgency-driven pass power.
 *
 * Covers:
 *  1. CPU-PASS-VARIETY-001: Short distance → ground pass (PASS_BIT)
 *  2. CPU-PASS-VARIETY-002: Long distance → lofted pass (SHOT_BIT at teammate)
 *  3. CPU-PASS-VARIETY-003: Defender near primary target → selects safer teammate
 *  4. CPU-PASS-VARIETY-004: Urgency (behind) → favors lofted passes
 *  5. CPU-PASS-VARIETY-005: Caution (ahead) → favors ground passes
 *  6. CPU-PASS-VARIETY-006: All defenders near all teammates → still passes
 *  7. CPU-PASS-VARIETY-007: Determinism across fresh adapters
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
import { PASS_BIT, SHOT_BIT, FIRST_TOUCH_BIT } from "../../../src/contracts/input.js";

// ===========================================================================
// 1. CPU-PASS-VARIETY-001: Short distance → ground pass (PASS_BIT)
// ===========================================================================

describe("CPU-PASS-VARIETY-001: short distance → ground pass", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("teammate 8m away → PASS_BIT (ground pass)", () => {
    // CPU at (20, 0), teammate at (28, 0) → 8m away.
    // distToGoal ≈ 32.5m > SHOT_RANGE_WIDE → pass triggered.
    // 8m < 15m threshold → ground pass.
    const obs = makeObs(20, 0, 20.5, 0, 0, "team-a", [
      { id: "tm1", x: 28, y: 0 },
    ]);
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.pressedButtons & PASS_BIT).not.toBe(0);
    expect(frame.heldButtons & SHOT_BIT).toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).toBe(0);

    // Aims at teammate: straight forward (+x).
    expect(frame.moveX).toBeGreaterThan(0.95);
    expect(Math.abs(frame.moveY)).toBeLessThan(0.05);
  });

  it("teammate 5m away → PASS_BIT (ground pass)", () => {
    const obs = makeObs(20, 0, 20.5, 0, 0, "team-a", [
      { id: "tm1", x: 25, y: 0 },
    ]);
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.heldButtons & SHOT_BIT).toBe(0);
  });
});

// ===========================================================================
// 2. CPU-PASS-VARIETY-002: Long distance → lofted pass (SHOT_BIT at teammate)
// ===========================================================================

describe("CPU-PASS-VARIETY-002: long distance → lofted pass", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("teammate 20m away → SHOT_BIT (lofted pass), no shot cooldown", () => {
    // CPU at (20, 0), teammate at (40, 0) → 20m away.
    // 20m >= 15m threshold → lofted pass.
    const obs = makeObs(20, 0, 20.5, 0, 0, "team-a", [
      { id: "tm1", x: 40, y: 0 },
    ]);
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Lofted pass: SHOT_BIT pressed (not PASS_BIT).
    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).not.toBe(0);
    expect(frame.heldButtons & PASS_BIT).toBe(0);
    expect(frame.pressedButtons & PASS_BIT).toBe(0);

    // Aims at teammate: straight forward (+x).
    expect(frame.moveX).toBeGreaterThan(0.95);
    expect(Math.abs(frame.moveY)).toBeLessThan(0.05);
  });

  it("lofted pass does NOT trigger shot cooldown", () => {
    const obs = makeObs(20, 0, 20.5, 0, 0, "team-a", [
      { id: "tm1", x: 40, y: 0 },
    ]);
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame1 = adapter.sample(1, obs);

    // SHOT_BIT was pressed (lofted pass).
    expect(frame1.pressedButtons & SHOT_BIT).not.toBe(0);

    // Verify shotCooldownRemaining was NOT set for lofted pass.
    // After a real shot, cooldown would be 15. After lofted pass, it stays 0.
    // We verify this by checking that FIRST_TOUCH works again once ball
    // returns into range (no cooldown suppression).

    // Bring ball far to lose possession (ball at 50, player at 20 → 30m away).
    const farObs = makeObs(20, 0, 50, 0, 0, "team-a", [
      { id: "tm1", x: 40, y: 0 },
    ]);
    farObs.players[0].bodyHeading = Math.PI;
    adapter.sample(2, farObs); // lose possession
    adapter.sample(3, farObs); // confirm lost

    // Now bring ball back into FIRST_TOUCH range.
    // Two-tick possession acquisition: tick 9 ballInRange, tick 10 hasPossession.
    const closeObs = makeObs(20, 0, 21, 0, 0, "team-a", [
      { id: "tm1", x: 40, y: 0 },
    ]);
    closeObs.players[0].bodyHeading = Math.PI;

    const tickA = adapter.sample(9, closeObs);
    const tickB = adapter.sample(10, closeObs);

    // After lofted pass (no cooldown), pass/shot should work normally.
    // Ball is within range, in possession, distToGoal > 20m → PASS_BIT or
    // SHOT_BIT should be active (not suppressed by cooldown).
    const hasPassAction = (tickB.heldButtons & (PASS_BIT | SHOT_BIT)) !== 0;
    expect(hasPassAction).toBe(true);
  });
});

// ===========================================================================
// 3. CPU-PASS-VARIETY-003: Defender near primary target → selects safer teammate
// ===========================================================================

describe("CPU-PASS-VARIETY-003: defender near primary target → safer teammate", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("nearest forward teammate is marked → picks farther unmarked teammate", () => {
    // CPU at (20, 0), team-a.
    // Primary teammate at (28, 5) → 9.43m, but opponent at (29, 5) is 1m away (marked).
    // Alternative teammate at (28, -3) → 9.43m, no nearby opponent (unmarked).
    // Both are under the 15m loft threshold → ground pass.
    const obs = makeObs(20, 0, 20.5, 0, 0, "team-a", [
      { id: "tm-primary", x: 28, y: 5 },
      { id: "tm-alt", x: 28, y: -3 },
    ]);
    obs.players[0].bodyHeading = Math.PI;
    // Add an opponent near the primary teammate.
    obs.players.push({
      playerId: "opp1",
      teamId: "team-b",
      groundPosition: { x: 29, y: 5 },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: 0,
    });

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Ground pass (both targets under 15m).
    expect(frame.heldButtons & PASS_BIT).not.toBe(0);

    // Should aim at the alternative teammate (28, -3) not the primary (28, 5).
    // Direction to (28, -3) from (20, 0): dx=8, dy=-3.
    // Normalized: (0.936, -0.351).
    expect(frame.moveX).toBeGreaterThan(0.9);
    expect(frame.moveY).toBeLessThan(0);
    expect(frame.moveY).toBeGreaterThan(-0.4);
  });

  it("no opponents → picks nearest forward (legacy behavior)", () => {
    const obs = makeObs(20, 0, 20.5, 0, 0, "team-a", [
      { id: "tm-near", x: 25, y: 3 },
      { id: "tm-far", x: 35, y: 10 },
    ]);
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);

    // Should aim at nearest teammate (25, 3): dx=5, dy=3.
    expect(frame.moveX).toBeGreaterThan(0.8);
    expect(frame.moveY).toBeGreaterThan(0.4);
    expect(frame.moveY).toBeLessThan(0.55);
  });
});

// ===========================================================================
// 4. CPU-PASS-VARIETY-004: Urgency (behind) → favors lofted passes
// ===========================================================================

describe("CPU-PASS-VARIETY-004: urgency → favors lofted passes", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("CPU behind by 3 goals, teammate 10m away → lofted pass (SHOT_BIT)", () => {
    // urgency = 2 (behind by ≥2).
    // Threshold = 15 / 2 = 7.5m. Teammate at 10m > 7.5m → lofted.
    const obs = makeObs(20, 0, 20.5, 0, 0, "team-a", [
      { id: "tm1", x: 30, y: 0 },
    ]);
    obs.players[0].bodyHeading = Math.PI;
    obs.scoreDifferential = -3;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).not.toBe(0);
    expect(frame.heldButtons & PASS_BIT).toBe(0);
  });

  it("same distance, neutral urgency → ground pass", () => {
    // urgency = 1 (neutral). Threshold = 15m. Teammate at 10m < 15m → ground.
    const obs = makeObs(20, 0, 20.5, 0, 0, "team-a", [
      { id: "tm1", x: 30, y: 0 },
    ]);
    obs.players[0].bodyHeading = Math.PI;
    // No scoreDifferential → urgency = 1.

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.heldButtons & SHOT_BIT).toBe(0);
  });
});

// ===========================================================================
// 5. CPU-PASS-VARIETY-005: Caution (ahead) → favors ground passes
// ===========================================================================

describe("CPU-PASS-VARIETY-005: caution → favors ground passes", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("CPU ahead by 3 goals, teammate 18m away → ground pass (PASS_BIT)", () => {
    // urgency = 0.5 (ahead by ≥2).
    // Threshold = 15 / 0.5 = 30m. Teammate at 18m < 30m → ground.
    const obs = makeObs(20, 0, 20.5, 0, 0, "team-a", [
      { id: "tm1", x: 38, y: 0 },
    ]);
    obs.players[0].bodyHeading = Math.PI;
    obs.scoreDifferential = 3;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.pressedButtons & PASS_BIT).not.toBe(0);
    expect(frame.heldButtons & SHOT_BIT).toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).toBe(0);
  });
});

// ===========================================================================
// 6. CPU-PASS-VARIETY-006: All defenders near all teammates → still passes
// ===========================================================================

describe("CPU-PASS-VARIETY-006: all teammates marked → still passes", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("every forward teammate has a nearby opponent → still selects one and passes", () => {
    // CPU at (20, 0), team-a.
    // Teammate at (28, 3) marked by opponent at (29, 4).
    // Teammate at (26, -4) marked by opponent at (27, -3).
    const obs = makeObs(20, 0, 20.5, 0, 0, "team-a", [
      { id: "tm1", x: 28, y: 3 },
      { id: "tm2", x: 26, y: -4 },
    ]);
    obs.players[0].bodyHeading = Math.PI;
    obs.players.push(
      {
        playerId: "opp1",
        teamId: "team-b",
        groundPosition: { x: 29, y: 4 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
      },
      {
        playerId: "opp2",
        teamId: "team-b",
        groundPosition: { x: 27, y: -3 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
      },
    );

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Must still pass — no infinite stall.
    const hasAnyPass = (frame.heldButtons & PASS_BIT) !== 0 ||
      (frame.heldButtons & SHOT_BIT) !== 0;
    expect(hasAnyPass).toBe(true);

    // moveX must be positive (forward).
    expect(frame.moveX).toBeGreaterThan(0);
  });

  it("all forward teammates marked → lofted pass if distance qualifies", () => {
    // CPU at (10, 0), teammate at (30, 2) marked by opponent at (31, 3).
    // Distance ≈ 20m ≥ 15m → lofted pass.
    const obs = makeObs(10, 0, 10.5, 0, 0, "team-a", [
      { id: "tm1", x: 30, y: 2 },
    ]);
    obs.players[0].bodyHeading = Math.PI;
    obs.players.push({
      playerId: "opp1",
      teamId: "team-b",
      groundPosition: { x: 31, y: 3 },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: 0,
    });

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Even though marked, the lofted pass should fire.
    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).not.toBe(0);
  });
});

// ===========================================================================
// 7. CPU-PASS-VARIETY-007: Determinism across fresh adapters
// ===========================================================================

describe("CPU-PASS-VARIETY-007: determinism across fresh adapters", () => {
  it("same observation with opponents → identical pass outcomes", () => {
    const makeObsWithOpponents = (): CpuObservation => {
      const obs = makeObs(20, 0, 20.5, 0, 0, "team-a", [
        { id: "tm1", x: 30, y: 5 },
        { id: "tm2", x: 35, y: -3 },
      ]);
      obs.players[0].bodyHeading = Math.PI;
      obs.players.push({
        playerId: "opp1",
        teamId: "team-b",
        groundPosition: { x: 31, y: 5 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
      });
      obs.scoreDifferential = -3;
      return obs;
    };

    const a1 = createCpuAdapter();
    const a2 = createCpuAdapter();
    const obs1 = makeObsWithOpponents();
    const obs2 = makeObsWithOpponents();

    for (let tick = 0; tick < 20; tick++) {
      const f1 = a1.sample(tick, obs1);
      const f2 = a2.sample(tick, obs2);
      expect(f1.heldButtons).toBe(f2.heldButtons);
      expect(f1.pressedButtons).toBe(f2.pressedButtons);
      expect(f1.moveX).toBe(f2.moveX);
      expect(f1.moveY).toBe(f2.moveY);
    }
  });

  it("same observation → same pass type across adapters", () => {
    const makeObsLong = (): CpuObservation => {
      const obs = makeObs(15, 0, 15.5, 0, 0, "team-a", [
        { id: "tm1", x: 40, y: 0 },
      ]);
      obs.players[0].bodyHeading = Math.PI;
      return obs;
    };

    const a1 = createCpuAdapter();
    const a2 = createCpuAdapter();
    const obs1 = makeObsLong();
    const obs2 = makeObsLong();

    // Both should produce lofted pass (25m > 15m threshold).
    a1.sample(0, obs1);
    a2.sample(0, obs2);

    const f1 = a1.sample(1, obs1);
    const f2 = a2.sample(1, obs2);

    expect(f1.heldButtons).toBe(f2.heldButtons);
    expect(f1.pressedButtons).toBe(f2.pressedButtons);
    expect(f1.heldButtons & SHOT_BIT).not.toBe(0);
    expect(f2.heldButtons & SHOT_BIT).not.toBe(0);
  });
});

// ===========================================================================
// Helper: create a CpuObservation with teammates and optional opponents
// ===========================================================================

function makeObs(
  playerX: number,
  playerY: number,
  ballX: number,
  ballY: number,
  bodyHeading: number,
  cpuTeamId: string,
  teammates: Array<{ id: string; x: number; y: number }>,
): CpuObservation {
  return {
    players: [
      {
        playerId: "cpu-player",
        teamId: "team-cpu",
        groundPosition: { x: playerX, y: playerY },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading,
      },
    ],
    ball: {
      position: { x: ballX, y: ballY, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    pitchLength: 105,
    pitchWidth: 68,
    cpuTeamId,
    teammates: teammates.map((t) => ({
      playerId: t.id,
      groundPosition: { x: t.x, y: t.y },
    })),
    controlledPlayerId: "cpu-player",
  };
}
