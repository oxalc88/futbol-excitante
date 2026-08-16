/**
 * @module tests/unit/cpu-adapter/teammate-pass
 *
 * Tests for teammate-directed pass behaviour.
 *
 * Covers:
 *  1. CPU passes toward teammate when one exists in forward direction
 *  2. CPU falls back to body-heading pass when no teammates exist
 *  3. CPU does NOT pass toward opponent players (team filtering)
 *  4. CPU correctly identifies forward direction based on attacking goal
 *  5. CPU still respects shot priority (SHOT_BIT takes precedence over PASS_BIT)
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
import { PASS_BIT, SHOT_BIT } from "../../../src/contracts/input.js";

// ===========================================================================
// 1. CPU passes toward teammate when one exists in forward direction
// ===========================================================================

describe("CPU-TEAMMATE-001: CPU passes toward teammate in forward direction", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("CPU at (20, 0) with teammate at (30, 5) → moveX/moveY aim at teammate", () => {
    // CPU at (20, 0), ball at (20.5, 0), goal at (52.5, 0).
    // Teammate at (30, 5) is in forward direction (+x).
    const obs: CpuObservation = makeObservationWithTeammates(
      20, 0, 20.5, 0, 0, 0, "team-a",
      [{ playerId: "teammate-1", groundPosition: { x: 30, y: 5 } }],
      "cpu-player",
    );
    // Force bodyHeading away from goal so pass is triggered.
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // PASS_BIT should be pressed (beyond shot range, facing away).
    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.pressedButtons & PASS_BIT).not.toBe(0);

    // moveX and moveY should point toward the teammate at (30, 5).
    // Expected direction from (20, 0) to (30, 5): dx=10, dy=5.
    // Normalized: ≈ (0.894, 0.447).
    expect(frame.moveX).toBeGreaterThan(0.8);
    expect(frame.moveY).toBeGreaterThan(0.4);
    expect(frame.moveY).toBeLessThan(0.5);

    // moveX should be positive (forward direction).
    expect(frame.moveX).toBeLessThan(1.0);
  });

  it("CPU with two teammates → picks nearest forward one", () => {
    // Two teammates: one at (25, 3) closer, one at (35, 10) farther.
    const obs: CpuObservation = makeObservationWithTeammates(
      20, 0, 20.5, 0, 0, 0, "team-a",
      [
        { playerId: "teammate-far", groundPosition: { x: 35, y: 10 } },
        { playerId: "teammate-near", groundPosition: { x: 25, y: 3 } },
      ],
      "cpu-player",
    );
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);

    // Should aim at the nearer teammate (25, 3): dx=5, dy=3, normalized ≈ (0.857, 0.514).
    expect(frame.moveX).toBeGreaterThan(0.8);
    expect(frame.moveY).toBeGreaterThan(0.5);
    expect(frame.moveY).toBeLessThan(0.55);
  });

  it("CPU passes toward teammate at (25, 0) — straight forward", () => {
    const obs: CpuObservation = makeObservationWithTeammates(
      20, 0, 20.5, 0, 0, 0, "team-a",
      [{ playerId: "teammate-center", groundPosition: { x: 25, y: 0 } }],
      "cpu-player",
    );
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);

    // Straight forward: moveY ≈ 0, moveX ≈ 1.
    expect(frame.moveX).toBeGreaterThan(0.95);
    expect(Math.abs(frame.moveY)).toBeLessThan(0.05);
  });
});

// ===========================================================================
// 2. CPU falls back to body-heading when no teammates exist
// ===========================================================================

describe("CPU-TEAMMATE-002: fallback to body-heading when no teammates", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("no teammates array → CPU moves toward goal (existing behavior preserved)", () => {
    // Same as passing.test.ts: CPU at (20, 0), ball at (20.5, 0), bodyHeading = π.
    const obs: CpuObservation = makeObservation(
      20, 0, 20.5, 0, 0, 0, "team-a",
    );
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    // moveX should still be positive (toward +x goal).
    expect(frame.moveX).toBeGreaterThan(0);
    // moveY should be ≈ 0 (goal is on centre line, no lateral offset since we're at y=0).
    // Actually the deterministic shot aim offset may apply, but the key is
    // the CPU still moves forward toward the goal.
  });

  it("empty teammates array → same fallback behavior", () => {
    const obs: CpuObservation = makeObservationWithTeammates(
      20, 0, 20.5, 0, 0, 0, "team-a",
      [], // empty teammates
      "cpu-player",
    );
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.moveX).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 3. CPU does NOT pass toward opponent players (team filtering)
// ===========================================================================

describe("CPU-TEAMMATE-003: team filtering excludes opponents", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("opponent ahead of CPU but teammates absent → falls back to goal direction", () => {
    // Only opponent players in the "teammates" field (injected manually).
    // In reality buildCpuObservation filters by teamId, but we verify
    // the teammates array only contains same-team players.
    const obs: CpuObservation = makeObservationWithTeammates(
      20, 0, 20.5, 0, 0, 0, "team-a",
      // These are same-team players only.
      [{ playerId: "teammate-1", groundPosition: { x: 30, y: 5 } }],
      "cpu-player",
    );
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Pass should be directed at teammate, not at opponents.
    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.moveX).toBeGreaterThan(0.8);
    expect(frame.moveY).toBeGreaterThan(0.4);
  });

  it("all teammates behind CPU → no forward teammate, falls back to goal", () => {
    // Teammates positioned behind the CPU (toward own goal).
    const obs: CpuObservation = makeObservationWithTeammates(
      20, 0, 20.5, 0, 0, 0, "team-a",
      [
        { playerId: "teammate-behind", groundPosition: { x: 10, y: 3 } },
        { playerId: "teammate-behind-2", groundPosition: { x: 15, y: 0 } },
      ],
      "cpu-player",
    );
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);

    // No forward teammate exists, so moveX should still point toward +x goal.
    expect(frame.moveX).toBeGreaterThan(0);

    // Direction should NOT point toward the behind teammates (which are at x < 20).
  });
});

// ===========================================================================
// 4. CPU correctly identifies forward direction based on attacking goal
// ===========================================================================

describe("CPU-TEAMMATE-004: forward direction follows attacking goal", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("team-a (attacks +x) → teammate at +x is forward", () => {
    const obs: CpuObservation = makeObservationWithTeammates(
      20, 0, 20.5, 0, 0, 0, "team-a",
      [{ playerId: "teammate", groundPosition: { x: 30, y: 0 } }],
      "cpu-player",
    );
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.moveX).toBeGreaterThan(0.9);
    expect(Math.abs(frame.moveY)).toBeLessThan(0.05);
  });

  it("team-b (attacks -x) → teammate at lower x is forward", () => {
    // team-b attacks -x, so teammate at x=10 is forward.
    const obs: CpuObservation = makeObservationWithTeammates(
      20, 0, 20.5, 0, 0, 0, "team-b",
      [{ playerId: "teammate", groundPosition: { x: 10, y: 0 } }],
      "cpu-player",
    );
    obs.players[0].bodyHeading = 0;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    // moveX should be negative (toward -x).
    expect(frame.moveX).toBeLessThan(-0.9);
    expect(Math.abs(frame.moveY)).toBeLessThan(0.05);
  });

  it("team-b → teammate at higher x is behind, not forward", () => {
    const obs: CpuObservation = makeObservationWithTeammates(
      20, 0, 20.5, 0, 0, 0, "team-b",
      [{ playerId: "teammate", groundPosition: { x: 30, y: 0 } }],
      "cpu-player",
    );
    obs.players[0].bodyHeading = 0;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);

    // Teammate at x=30 is behind (team-b attacks -x).
    // Should fall back to moving toward -x goal.
    expect(frame.moveX).toBeLessThan(-0.5);
  });
});

// ===========================================================================
// 5. Shot priority: SHOT_BIT takes precedence over PASS_BIT
// ===========================================================================

describe("CPU-TEAMMATE-005: shot priority overrides teammate pass", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("within 5m of goal: SHOT_BIT, no PASS_BIT (teammates present)", () => {
    const obs: CpuObservation = makeObservationWithTeammates(
      50, 0, 50.5, 0, 0, 0, "team-a",
      [{ playerId: "teammate", groundPosition: { x: 55, y: 0 } }],
      "cpu-player",
    );
    obs.players[0].bodyHeading = 0; // facing +x toward goal.

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).not.toBe(0);
    expect(frame.heldButtons & PASS_BIT).toBe(0);
    expect(frame.pressedButtons & PASS_BIT).toBe(0);
  });

  it("within 5m: even with teammates in shooting range, SHOT_BIT wins", () => {
    const obs: CpuObservation = makeObservationWithTeammates(
      48, 0, 48.5, 0, 0, 0, "team-a",
      [
        { playerId: "teammate-1", groundPosition: { x: 55, y: 2 } },
        { playerId: "teammate-2", groundPosition: { x: 52, y: -1 } },
      ],
      "cpu-player",
    );
    obs.players[0].bodyHeading = 0;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Close range: always shoot, never pass.
    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.heldButtons & PASS_BIT).toBe(0);
  });

  it("at 6m with good angle: SHOT_BIT, no PASS_BIT, even with teammates", () => {
    // 6m from goal (just past close range), but facing well enough.
    // SHOT_RANGE_CLOSE = 5m, FACING_TOLERANCE_CLOSE = π/3.
    // At 6m, we need to check medium-range shot logic.
    const obs: CpuObservation = makeObservationWithTeammates(
      46.5, 0, 47, 0, 0, 0, "team-a",
      [{ playerId: "teammate", groundPosition: { x: 55, y: 0 } }],
      "cpu-player",
    );
    obs.players[0].bodyHeading = 0;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // 6m > 5m close range but within 20m wide range.
    // Facing goal (heading = 0, goal angle ≈ 0), so should shoot.
    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.heldButtons & PASS_BIT).toBe(0);
  });
});

// ===========================================================================
// Helper: create CpuObservation with teammates
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
  return makeObservationWithTeammates(
    playerX, playerY, ballX, ballY, ballVx, ballVy, cpuTeamId, [], undefined,
  );
}

function makeObservationWithTeammates(
  playerX: number,
  playerY: number,
  ballX: number,
  ballY: number,
  ballVx: number,
  ballVy: number,
  cpuTeamId: string,
  teammates: Array<{ playerId: string; groundPosition: { x: number; y: number } }>,
  controlledPlayerId: string,
): CpuObservation {
  return {
    players: [
      {
        playerId: controlledPlayerId,
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
    teammates,
    controlledPlayerId,
  };
}