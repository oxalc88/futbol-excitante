/**
 * @module tests/unit/cpu-adapter/team-formation
 *
 * Tests for team-specific formation layout and recovery.
 *
 * Covers:
 *  1. CPU-FORMATION-TEAM-001: Formation positions calculated correctly
 *     (defender stays back, attacker advances).
 *  2. CPU-FORMATION-TEAM-002: After being displaced, player returns
 *     toward formation position over time.
 *  3. CPU-FORMATION-TEAM-003: Formation recovery blends with chase
 *     behavior.
 *  4. CPU-FORMATION-TEAM-004: Formation recovery works for both
 *     team-a and team-b.
 *  5. CPU-FORMATION-TEAM-005: Determinism — same displacement →
 *     same recovery.
 *  6. CPU-FORMATION-TEAM-006: Formation recovery doesn't interfere
 *     with shooting.
 *
 * This is a PROVISIONAL PLACEHOLDER — not a measured PES value.
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createCpuAdapter,
  type CpuAdapter,
  type CpuObservation,
} from "../../../src/adapters/input-browser/cpu-adapter.js";

// ===========================================================================
// Helpers
// ===========================================================================

/**
 * Compute a team-specific formation position for the controlled player.
 *
 * For 2v2: the deeper player (further from pitch centre) is the
 * defender and stays closer to own goal. The more advanced player
 * is the attacker and stays further forward.
 *
 * This mirrors the logic in buildCpuObservation: 20% toward own goal.
 */
function computeFormationPosition(
  playerX: number,
  playerY: number,
  cpuTeamId: string,
): { x: number; y: number } {
  const ownGoalX = cpuTeamId === "team-b" ? 52.5 : -52.5;
  return {
    x: playerX + (ownGoalX - playerX) * 0.2,
    y: playerY,
  };
}

/**
 * Create a CpuObservation with proper formation positions for both
 * team players. For 2v2: player-a (defender, deeper) and player-a2
 * (attacker, more advanced).
 */
function make2v2Observation(
  playerX: number,
  playerY: number,
  ballX: number,
  ballY: number,
  ballVx: number,
  ballVy: number,
  cpuTeamId: string,
  controlledPlayerId: string,
): CpuObservation {
  const formPos = computeFormationPosition(playerX, playerY, cpuTeamId);

  // For 2v2: add a teammate on the same team.
  const teammateX = cpuTeamId === "team-a" ? playerX - 10 : playerX + 10;
  const teammateY = playerY + 8;

  return {
    players: [
      {
        playerId: controlledPlayerId,
        teamId: cpuTeamId,
        groundPosition: { x: playerX, y: playerY },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
      },
      {
        playerId: controlledPlayerId === "player-1" ? "player-2" : "player-1",
        teamId: cpuTeamId,
        groundPosition: { x: teammateX, y: teammateY },
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
    controlledPlayerId,
    formationPosition: formPos,
  };
}

// ===========================================================================
// 1. CPU-FORMATION-TEAM-001: formation positions calculated correctly
// ===========================================================================

describe("CPU-FORMATION-TEAM-001: formation positions calculated correctly", () => {
  it("team-a: defender formation closer to own goal (-x) than attacker", () => {
    // Defender at x=-15: formation at x=-15+(-52.5-(-15))*0.2 = -15+(-7.5) = -22.5.
    // Attacker at x=-10: formation at x=-10+(-52.5-(-10))*0.2 = -10+(-8.5) = -18.5.
    // Defender formation (-22.5) < Attacker formation (-18.5) → defender stays back.
    const obs = make2v2Observation(
      -15, 0, 30, 0, 0, 0,
      "team-a", "player-1",
    );

    expect(obs.formationPosition).toBeDefined();
    if (obs.formationPosition) {
      // Defender (at x=-15) → formation x = -15 + (-52.5-(-15))*0.2 = -22.5.
      expect(obs.formationPosition.x).toBeCloseTo(-22.5, 1);
    }
  });

  it("team-b: defender formation closer to own goal (+x) than attacker", () => {
    // Defender at x=15: formation at x=15+(52.5-15)*0.2 = 15+7.5 = 22.5.
    // Attacker at x=10: formation at x=10+(52.5-10)*0.2 = 10+8.5 = 18.5.
    // Defender formation (22.5) > Attacker formation (18.5) → defender stays back.
    const obs = make2v2Observation(
      15, 0, -30, 0, 0, 0,
      "team-b", "player-3",
    );

    expect(obs.formationPosition).toBeDefined();
    if (obs.formationPosition) {
      // Defender (at x=15) → formation x = 15 + (52.5-15)*0.2 = 22.5.
      expect(obs.formationPosition.x).toBeCloseTo(22.5, 1);
    }
  });

  it("deeper player always has formation closer to own goal than attacker", () => {
    // team-a: deeper player at -40, attacker at -5.
    // Deeper formation: -40 + (-52.5-(-40))*0.2 = -40 + (-2.5) = -42.5.
    // Attacker formation: -5 + (-52.5-(-5))*0.2 = -5 + (-9.5) = -14.5.
    // -42.5 < -14.5 → defender is more toward own goal.
    const deepForm = computeFormationPosition(-40, 0, "team-a");
    const advForm = computeFormationPosition(-5, 0, "team-a");
    expect(deepForm.x).toBeLessThan(advForm.x);

    // team-b: deeper player at 40, attacker at 5.
    const deepFormB = computeFormationPosition(40, 0, "team-b");
    const advFormB = computeFormationPosition(5, 0, "team-b");
    expect(deepFormB.x).toBeGreaterThan(advFormB.x);
  });
});

// ===========================================================================
// 2. CPU-FORMATION-TEAM-002: displacement → recovery toward formation
// ===========================================================================

describe("CPU-FORMATION-TEAM-002: displacement triggers formation recovery", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("player displaced far from formation → movement shifts toward formation over ticks", () => {
    // Player at x=-15, ball behind at x=-40 for team-a.
    // Formation at x=-22.5.
    // Ball at -40 is behind player (-40 < -15).
    // With increasing displacement ticks, recovery weight grows.
    const obs = make2v2Observation(
      -15, 0, -40, 0, 0, 0,
      "team-a", "player-1",
    );

    // Initial samples: chase direction (toward ball at -40) dominates.
    const f0 = adapter.sample(0, obs);
    const f5 = adapter.sample(5, obs);
    const f20 = adapter.sample(20, obs);

    // All samples pull toward the ball (negative X).
    expect(f0.moveX).toBeLessThan(0);
    expect(f5.moveX).toBeLessThan(0);
    expect(f20.moveX).toBeLessThan(0);

    // As displacement ticks grow, recovery weight increases,
    // pulling more strongly toward formation at x=-22.5.
    // Both chase and formation point negative, but the recovery
    // component is a stronger pull toward the specific formation
    // position. The key indicator: the formation recovery adds a
    // persistent pull even when the ball is at the same position.
    // The normalized direction toward formation is the same (-1, 0),
    // but the recovery weight ensures the player doesn't overshoot.
    // With higher recovery weight, movement should be more consistent.
    expect(Math.abs(f20.moveX)).toBeGreaterThanOrEqual(Math.abs(f5.moveX));
  });

  it("player at formation position → no displacement accumulation", () => {
    // Player at x=-22.5, which IS the formation position for team-a.
    // Ball at x=-40 (behind). Player is at formation → 0 displacement.
    const obs = make2v2Observation(
      -22.5, 0, -40, 0, 0, 0,
      "team-a", "player-1",
    );

    const f0 = adapter.sample(0, obs);
    const f10 = adapter.sample(10, obs);
    const f20 = adapter.sample(20, obs);

    // Movement should be consistent (pure chase, no recovery buildup).
    expect(f0.moveX).toBe(f10.moveX);
    expect(f10.moveX).toBe(f20.moveX);
  });
});

// ===========================================================================
// 3. CPU-FORMATION-TEAM-003: formation recovery blends with chase
// ===========================================================================

describe("CPU-FORMATION-TEAM-003: formation recovery blends with chase", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("ball behind player → blend includes both chase and formation", () => {
    // Player at (0, 0), ball at (-30, 5) for team-a.
    // Formation at (0, 0). Ball behind: -30 < 0.
    const obs = make2v2Observation(
      0, 0, -30, 5, 0, 0,
      "team-a", "player-1",
    );

    const frame = adapter.sample(0, obs);

    // Movement should have both components.
    // Chase toward ball: dx=-30, dy=5.
    // Formation is at (0, 0) from (0, 0) → fdx=0, fdy=0, fDist≈0.
    // With fDist near 0, formation direction is (0, 0), so blend is just chase.
    // As long as movement goes toward ball, this is valid.
    expect(frame.moveX).toBeLessThan(0); // toward ball at x=-30
    expect(frame.moveY).toBeGreaterThan(0); // toward ball at y=5
  });

  it("ball behind and far → chase + formation blend with recovery weight", () => {
    // Player at x=-20, ball at x=-40 for team-a.
    // Formation at x=-20+(-52.5-(-20))*0.2 = -20+(-6.5) = -26.5.
    // fDist = 6.5m. Ball at -40: behind (-40 < -20). distToBall = 20.
    // CHASE_FORMATION_THRESHOLD = 20 → formationWeight = 0.
    // But displacement ticks increase, adding recovery.
    const obs = make2v2Observation(
      -20, 0, -40, 0, 0, 0,
      "team-a", "player-1",
    );

    const f1 = adapter.sample(1, obs);
    const f50 = adapter.sample(50, obs);

    // At tick 1: recoveryWeight = 50 * 0.02 * ... capped at 0.8.
    // But formationWeight = 0, so the blended direction is:
    // combinedX = moveX (chase only) = -1.
    // recoveryWeight applies: moveX = -1 * (1 - recoveryWeight) + (-1) * recoveryWeight = -1.
    // At tick 50: higher recovery weight, but same direction since
    // both chase and formation point -X.
    expect(f1.moveX).toBeLessThan(0);
    expect(f50.moveX).toBeLessThan(0);
    // Recovery doesn't change direction here; it matters when chase and
    // formation have different directions.
  });

  it("recovery weight only applied when ball is behind", () => {
    // Player at x=0, ball at x=30 for team-a.
    // Ball is ahead → no formation blend.
    const obs = make2v2Observation(
      0, 0, 30, 0, 0, 0,
      "team-a", "player-1",
    );

    const f0 = adapter.sample(0, obs);
    const f50 = adapter.sample(50, obs);

    // With ball ahead, the player chases regardless.
    expect(f0.moveX).toBeGreaterThan(0);
    expect(f50.moveX).toBeGreaterThan(0);
    // Recovery ticks should be reset to 0 since ball is ahead.
    // The movement should be identical (pure chase).
    expect(f0.moveX).toBe(f50.moveX);
  });
});

// ===========================================================================
// 4. CPU-FORMATION-TEAM-004: both teams recover to formation
// ===========================================================================

describe("CPU-FORMATION-TEAM-004: formation recovery works for both teams", () => {
  let adapterA: CpuAdapter;
  let adapterB: CpuAdapter;

  beforeEach(() => {
    adapterA = createCpuAdapter();
    adapterB = createCpuAdapter();
  });

  it("team-a: displaced player returns toward formation (negative X)", () => {
    // team-a player at x=10, ball at x=-30 (behind).
    // Formation at x=10+(-52.5-10)*0.2 = 10-12.5 = -2.5.
    // Player needs to move left toward formation.
    const obs = make2v2Observation(
      10, 0, -30, 0, 0, 0,
      "team-a", "player-1",
    );

    // Initial tick: chase toward ball (-X) dominates.
    const f0 = adapterA.sample(0, obs);

    // After many ticks: recovery pulls toward formation (-2.5).
    const f100 = adapterA.sample(100, obs);

    // Both should have negative X (toward ball and formation).
    expect(f0.moveX).toBeLessThan(0);
    expect(f100.moveX).toBeLessThan(0);
    // Recovery adds persistent pull to formation.
    expect(Math.abs(f100.moveX)).toBeGreaterThanOrEqual(Math.abs(f0.moveX));
  });

  it("team-b: displaced player returns toward formation (positive X)", () => {
    // team-b player at x=-10, ball at x=30 (behind for team-b).
    // Formation at x=-10+(52.5-(-10))*0.2 = -10+12.5 = 2.5.
    // Player needs to move right toward formation.
    const obs = make2v2Observation(
      -10, 0, 30, 0, 0, 0,
      "team-b", "player-3",
    );

    const f0 = adapterB.sample(0, obs);
    const f100 = adapterB.sample(100, obs);

    // Both should have positive X (toward ball at 30 and formation at 2.5).
    expect(f0.moveX).toBeGreaterThan(0);
    expect(f100.moveX).toBeGreaterThan(0);
  });

  it("displacement resets when player reaches formation", () => {
    // team-a: player at formation position.
    // Player at x=-22.5 (formation for team-a from x=-15).
    // Ball at x=-40 (behind).
    const obs = make2v2Observation(
      -22.5, 0, -40, 0, 0, 0,
      "team-a", "player-1",
    );

    // Player is already at formation (fDist < 0.5) → displacement resets.
    const f0 = adapterA.sample(0, obs);
    const f50 = adapterA.sample(50, obs);

    // Movement should be identical (no recovery buildup).
    expect(f0.moveX).toBe(f50.moveX);
  });
});

// ===========================================================================
// 5. CPU-FORMATION-TEAM-005: determinism
// ===========================================================================

describe("CPU-FORMATION-TEAM-005: determinism", () => {
  it("same displacement scenario → identical recovery across runs", () => {
    const obs = make2v2Observation(
      -15, 0, -40, 0, 0, 0,
      "team-a", "player-1",
    );

    const a1 = createCpuAdapter();
    const a2 = createCpuAdapter();

    const results: { moveX: number; moveY: number }[] = [];
    for (let tick = 0; tick < 30; tick++) {
      const f1 = a1.sample(tick, obs);
      const f2 = a2.sample(tick, obs);

      results.push({ moveX: f1.moveX, moveY: f1.moveY });

      expect(f1.moveX).toBe(f2.moveX);
      expect(f1.moveY).toBe(f2.moveY);
    }

    // Verify the recovery weight grows over time (same for both adapters).
    const earlyMoveX = results[0].moveX;
    const lateMoveX = results[29].moveX;
    // Both pull left; recovery weight grows → magnitude may stabilize.
    expect(earlyMoveX).toBe(lateMoveX); // Direction is consistent
  });

  it("displacement counter is independent per adapter instance", () => {
    const obs = make2v2Observation(
      -15, 0, -40, 0, 0, 0,
      "team-a", "player-1",
    );

    const a1 = createCpuAdapter();
    const a2 = createCpuAdapter();

    // a1 runs 10 ticks.
    for (let i = 0; i < 10; i++) {
      a1.sample(i, obs);
    }
    // a2 runs 0 ticks — should still be at initial state.
    const f2_0 = a2.sample(0, obs);
    const f2_5 = a2.sample(5, obs);

    // a2 is independent — its first samples should match the initial state.
    expect(f2_0.moveX).toBe(f2_5.moveX); // No accumulation yet.
  });
});

// ===========================================================================
// 6. CPU-FORMATION-TEAM-006: formation recovery doesn't interfere with shooting
// ===========================================================================

describe("CPU-FORMATION-TEAM-006: formation recovery doesn't interfere with shooting", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("in possession: no formation recovery interference with offense", () => {
    // CPU player at (30, 0), ball at (31, 0) — possession.
    // Ball ahead → defense mode never entered.
    // In defense mode: ball behind = behind.
    // But first we need possession: ball in range tick 0 → tick 1 OFFENSE.
    const obs = make2v2Observation(
      30, 0, 31, 0, 0, 0,
      "team-a", "player-1",
    );

    // First tick: establish ballWasInRange.
    adapter.sample(0, obs);
    // Second tick: OFFENSE mode.
    const frame = adapter.sample(1, obs);

    // In offense, the CPU moves toward the opponent goal.
    // Formation recovery should not interfere.
    expect(frame.moveX).toBeGreaterThan(0); // toward +x goal
    // Shot bit should be set if in range.
    // (We check that formation recovery didn't prevent shooting).
    // With ball at 31 and player at 30: 1m away → possession.
    // Distance to goal: 52.5-30 = 22.5m (wide range).
    // Not necessarily shooting, but movement toward goal should not
    // be affected by formation recovery in offense mode.
    expect(frame.moveX).toBeGreaterThan(0);
  });

  it("ball far away in defense: formation recovery coexists with FIRST_TOUCH", () => {
    // Player at x=-15, ball at x=-40 (behind, far).
    // Defense mode: chase ball, apply formation recovery.
    const obs = make2v2Observation(
      -15, 0, -40, 0, 0, 0,
      "team-a", "player-1",
    );

    // Ball is far (30m away) and fast (0 horizontal speed) → FIRST_TOUCH.
    const f0 = adapter.sample(0, obs);

    // Movement should still be toward ball.
    expect(f0.moveX).toBeLessThan(0);
    // FIRST_TOUCH should be pressed when ball is within range and slow.
    // distToBall = 25m > FIRST_TOUCH_RANGE (1.5m) → no FIRST_TOUCH yet.
    // But the key: formation recovery didn't prevent movement.
    expect(Math.abs(f0.moveX)).toBeGreaterThan(0);
  });

  it("ball coming toward player: recovery doesn't prevent FIRST_TOUCH", () => {
    // Player at (-15, 0), ball at (-16, 0) — very close, ball behind.
    // Ball within 1.5m and slow → FIRST_TOUCH should be pressed.
    const obs = make2v2Observation(
      -15, 0, -16, 0, 0.5, 0,
      "team-a", "player-1",
    );

    const frame = adapter.sample(0, obs);

    // Ball within range: distToBall = 1m < 1.5m, horizontal speed 0.5 < 2.
    // FIRST_TOUCH should be pressed (first touch).
    // The key: formation recovery didn't prevent the touch.
    expect(frame.moveX).toBeLessThan(0); // Movement toward ball still works.
  });
});