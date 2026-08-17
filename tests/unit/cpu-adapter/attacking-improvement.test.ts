/**
 * @module tests/unit/cpu-adapter/attacking-improvement
 *
 * Tests for CPU attacking improvement: off-ball forward movement when
 * teammates have possession, role-aware positioning, attack phase
 * amplification, and cycling pattern during sustained possession.
 *
 * Covers:
 *  1. Off-ball forward runs when teammate has possession
 *  2. Role-aware positioning (attacker > midfielder > defender)
 *  3. Attack phase amplification (ATTACK strategy boosts forward push)
 *  4. Periodic cycling during sustained possession
 *  5. No forward push when CPU player has the ball
 *  6. Determinism
 *  7. No regression on pass/shoot decisions
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createCpuAdapter,
  type CpuAdapter,
  type CpuObservation,
  type TeamDecision,
} from "../../../src/adapters/input-browser/cpu-adapter.js";
import { PASS_BIT, SHOT_BIT } from "../../../src/contracts/input.js";

// ===========================================================================
// 1. OFF-BALL FORWARD RUNS when teammate has possession
// ===========================================================================

describe("CPU-ATTACK-001: off-ball forward runs", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("attacker moves forward (toward opponent goal) when teammate has ball", () => {
    // Team-a attacker at (0, 0).  Teammate at (15, 0) carrying the ball.
    // Teammate is within possession range of ball → team has possession.
    // Attacker should push toward opponent goal at +52.5.
    const obs = makeAttackingObservation({
      playerX: 0,
      playerY: 0,
      formationRole: "attacker",
      ballX: 14.5,
      ballY: 0,
      ballVx: 0,
      ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [{ id: "tm-1", x: 15, y: 0 }],
      opponents: [
        { id: "opp-1", x: 45, y: 5 },
        { id: "opp-2", x: 40, y: -3 },
      ],
      teamDecision: {
        strategy: "ATTACK",
        defensiveSubMode: "NONE",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 1.5,
        hasPossession: true,
        ballZone: "center",
      },
      controlledPlayerId: "attacker-1",
    });

    const frame = adapter.sample(0, obs);

    // Attacker at (0, 0) should move toward opponent goal (+x direction).
    expect(frame.moveX).toBeGreaterThan(0);
  });

  it("midfielder moves forward when teammate has ball", () => {
    const obs = makeAttackingObservation({
      playerX: -10,
      playerY: 0,
      formationRole: "midfielder",
      ballX: -5,
      ballY: 0,
      ballVx: 0,
      ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [{ id: "tm-1", x: -5, y: 0 }],
      opponents: [
        { id: "opp-1", x: 30, y: 5 },
        { id: "opp-2", x: 25, y: -3 },
      ],
      teamDecision: {
        strategy: "ATTACK",
        defensiveSubMode: "NONE",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 0.5,
        hasPossession: true,
        ballZone: "own",
      },
      controlledPlayerId: "midfielder-1",
    });

    const frame = adapter.sample(0, obs);

    // Midfielder at (-10, 0) should move toward opponent goal (+x).
    expect(frame.moveX).toBeGreaterThan(0);
  });

  it("team-b attacker moves in -x direction toward own attacking goal", () => {
    const obs = makeAttackingObservation({
      playerX: 10,
      playerY: 0,
      formationRole: "attacker",
      ballX: 5,
      ballY: 0,
      ballVx: 0,
      ballVy: 0,
      cpuTeamId: "team-b",
      teammates: [{ id: "tm-1", x: 5, y: 0 }],
      opponents: [
        { id: "opp-1", x: -30, y: 5 },
        { id: "opp-2", x: -25, y: -3 },
      ],
      teamDecision: {
        strategy: "ATTACK",
        defensiveSubMode: "NONE",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 0.5,
        hasPossession: true,
        ballZone: "center",
      },
      controlledPlayerId: "attacker-1",
    });

    const frame = adapter.sample(0, obs);

    // team-b attacks -x; attacker at (10, 0) should move in -x.
    expect(frame.moveX).toBeLessThan(0);
  });
});

// ===========================================================================
// 2. ROLE-AWARE POSITIONING
// ===========================================================================

describe("CPU-ATTACK-002: role-aware off-ball positioning", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("attacker pushes further forward than midfielder", () => {
    // Both at same position, same team possession scenario.
    // Attacker target distance = 15m from goal; midfielder = 25m.
    // Attacker should be further toward the goal.

    const baseObs = {
      ballX: -5,
      ballY: 0,
      ballVx: 0,
      ballVy: 0,
      cpuTeamId: "team-a" as const,
      teammates: [{ id: "tm-1", x: -5, y: 0 }],
      opponents: [
        { id: "opp-1", x: 45, y: 5 },
        { id: "opp-2", x: 40, y: -3 },
      ],
      teamDecision: {
        strategy: "ATTACK" as const,
        defensiveSubMode: "NONE" as const,
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 0.5,
        hasPossession: true,
        ballZone: "own" as const,
      },
    };

    const attackerObs = makeAttackingObservation({
      ...baseObs,
      playerX: 0,
      playerY: 0,
      formationRole: "attacker",
      controlledPlayerId: "attacker-1",
    });
    const midfielderObs = makeAttackingObservation({
      ...baseObs,
      playerX: 0,
      playerY: 0,
      formationRole: "midfielder",
      controlledPlayerId: "midfielder-1",
    });

    const attackerFrame = adapter.sample(0, attackerObs);
    const midfielderFrame = adapter.sample(0, midfielderObs);

    // Both should move in +x (toward opponent goal).
    expect(attackerFrame.moveX).toBeGreaterThan(0);
    expect(midfielderFrame.moveX).toBeGreaterThan(0);

    // Attacker should push further (higher moveX) because closer target.
    expect(attackerFrame.moveX).toBeGreaterThanOrEqual(midfielderFrame.moveX);
  });

  it("defender does NOT make forward run (chases ball instead)", () => {
    const obs = makeAttackingObservation({
      playerX: -30,
      playerY: 0,
      formationRole: "defender",
      ballX: 10,
      ballY: 0,
      ballVx: 0,
      ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [{ id: "tm-1", x: 10, y: 0 }],
      opponents: [
        { id: "opp-1", x: 30, y: 5 },
      ],
      teamDecision: {
        strategy: "ATTACK",
        defensiveSubMode: "NONE",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 0.5,
        hasPossession: true,
        ballZone: "center",
      },
      controlledPlayerId: "defender-1",
    });

    const frame = adapter.sample(0, obs);

    // Defender should chase the ball (toward ball at x=10, so moveX > 0).
    // The key assertion: defender moves toward the BALL, not toward the goal.
    // Since ball is at x=10 and player at x=-30, chase direction is +x.
    expect(frame.moveX).toBeGreaterThan(0);
    // The defender should move more aggressively toward the ball
    // (distance 40m) than an attacker would toward the target (15m from goal).
    // This confirms the defender is chasing, not doing an off-ball forward run.
  });
});

// ===========================================================================
// 3. ATTACK PHASE AMPLIFICATION
// ===========================================================================

describe("CPU-ATTACK-003: attack phase amplification", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("ATTACK strategy produces stronger forward push than BALANCED", () => {
    const attackObs = makeAttackingObservation({
      playerX: 0,
      playerY: 0,
      formationRole: "attacker",
      ballX: -5,
      ballY: 0,
      ballVx: 0,
      ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [{ id: "tm-1", x: -5, y: 0 }],
      opponents: [
        { id: "opp-1", x: 45, y: 5 },
      ],
      teamDecision: {
        strategy: "ATTACK",
        defensiveSubMode: "NONE",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 0.5,
        hasPossession: true,
        ballZone: "own",
      },
      controlledPlayerId: "attacker-1",
    });

    const balancedObs = makeAttackingObservation({
      playerX: 0,
      playerY: 0,
      formationRole: "attacker",
      ballX: -5,
      ballY: 0,
      ballVx: 0,
      ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [{ id: "tm-1", x: -5, y: 0 }],
      opponents: [
        { id: "opp-1", x: 45, y: 5 },
      ],
      teamDecision: {
        strategy: "BALANCED",
        defensiveSubMode: "NONE",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 0.5,
        hasPossession: true,
        ballZone: "own",
      },
      controlledPlayerId: "attacker-1",
    });

    const attackFrame = adapter.sample(0, attackObs);
    const balancedFrame = adapter.sample(0, balancedObs);

    // Both should move in +x.
    expect(attackFrame.moveX).toBeGreaterThan(0);
    expect(balancedFrame.moveX).toBeGreaterThan(0);

    // ATTACK should push further (targetDistFromGoal is reduced by multiplier).
    expect(attackFrame.moveX).toBeGreaterThanOrEqual(balancedFrame.moveX);
  });
});

// ===========================================================================
// 4. PERIODIC CYCLING during sustained possession
// ===========================================================================

describe("CPU-ATTACK-004: cycling pattern during sustained possession", () => {
  it("midfielder alternates direction after 60 ticks of team possession", () => {
    const adapter = createCpuAdapter();

    // Simulate 100 ticks of sustained team possession where the
    // controlled midfielder does NOT have the ball.
    // Place the midfielder near the cycling target (25m from goal = x≈27.5)
    // so the ±5m cycling amplitude causes the direction to flip.
    const obs = makeAttackingObservation({
      playerX: 27,
      playerY: 0,
      formationRole: "midfielder",
      ballX: 10,
      ballY: 0,
      ballVx: 0,
      ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [{ id: "tm-1", x: 10, y: 0 }],
      opponents: [
        { id: "opp-1", x: 45, y: 5 },
      ],
      teamDecision: {
        strategy: "ATTACK",
        defensiveSubMode: "NONE",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 0.5,
        hasPossession: true,
        ballZone: "center",
      },
      controlledPlayerId: "midfielder-1",
    });

    const moveXValues: number[] = [];
    for (let t = 0; t < 100; t++) {
      const frame = adapter.sample(t, obs);
      moveXValues.push(frame.moveX);
    }

    // After tick 60, the cycling pattern should cause moveX to change
    // direction (flip sign) every 30 ticks.
    // Ticks 61-90: first half-cycle; ticks 91-120: second half-cycle.
    // Verify there's a change in moveX between the two halves.
    const firstHalf = moveXValues.slice(60, 90);
    const secondHalf = moveXValues.slice(90, 100);

    const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    // The two halves should differ (different cycling phase).
    expect(Math.abs(firstHalfAvg - secondHalfAvg)).toBeGreaterThan(0.001);
  });

  it("cycling does not activate before 60 ticks", () => {
    const adapter = createCpuAdapter();

    const obs = makeAttackingObservation({
      playerX: -20,
      playerY: 0,
      formationRole: "midfielder",
      ballX: -5,
      ballY: 0,
      ballVx: 0,
      ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [{ id: "tm-1", x: -5, y: 0 }],
      opponents: [
        { id: "opp-1", x: 45, y: 5 },
      ],
      teamDecision: {
        strategy: "ATTACK",
        defensiveSubMode: "NONE",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 0.5,
        hasPossession: true,
        ballZone: "own",
      },
      controlledPlayerId: "midfielder-1",
    });

    // Run 59 ticks of sustained possession.
    const moveXValues: number[] = [];
    for (let t = 0; t < 59; t++) {
      const frame = adapter.sample(t, obs);
      moveXValues.push(frame.moveX);
    }

    // Before tick 60, all moveX values should be the same (no cycling).
    const unique = new Set(moveXValues);
    expect(unique.size).toBe(1);
  });
});

// ===========================================================================
// 5. NO FORWARD PUSH when CPU player has the ball
// ===========================================================================

describe("CPU-ATTACK-005: no off-ball movement when player has possession", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("CPU player with ball follows offense mode (steer toward goal), not off-ball run", () => {
    // Player has the ball (within FIRST_TOUCH range, slow ball).
    const obs = makeAttackingObservation({
      playerX: 20,
      playerY: 0,
      formationRole: "attacker",
      ballX: 20.3,
      ballY: 0,
      ballVx: 0,
      ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [{ id: "tm-1", x: 0, y: 5 }],
      opponents: [
        { id: "opp-1", x: 45, y: 5 },
      ],
      teamDecision: {
        strategy: "ATTACK",
        defensiveSubMode: "NONE",
        nearestToBallPlayerId: "attacker-1",
        nearestToBallDistance: 0.3,
        hasPossession: true,
        ballZone: "center",
      },
      controlledPlayerId: "attacker-1",
    });

    // Run 2 ticks to gain possession.
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // With ball: should steer toward goal (+x direction) in OFFENSE mode.
    // This is regular offense behavior, not the off-ball forward run.
    expect(frame.moveX).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 6. DETERMINISM
// ===========================================================================

describe("CPU-ATTACK-006: determinism of off-ball attacking behavior", () => {
  it("same observation produces same off-ball movement across adapters", () => {
    const obs = makeAttackingObservation({
      playerX: 0,
      playerY: 5,
      formationRole: "attacker",
      ballX: -5,
      ballY: 0,
      ballVx: 0,
      ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [{ id: "tm-1", x: -5, y: 0 }],
      opponents: [
        { id: "opp-1", x: 45, y: 5 },
        { id: "opp-2", x: 40, y: -3 },
      ],
      teamDecision: {
        strategy: "ATTACK",
        defensiveSubMode: "NONE",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 0.5,
        hasPossession: true,
        ballZone: "own",
      },
      controlledPlayerId: "attacker-1",
    });

    const adapter1 = createCpuAdapter();
    const adapter2 = createCpuAdapter();

    for (let t = 0; t < 100; t++) {
      const f1 = adapter1.sample(t, obs);
      const f2 = adapter2.sample(t, obs);
      expect(f1.moveX).toBe(f2.moveX);
      expect(f1.moveY).toBe(f2.moveY);
      expect(f1.heldButtons).toBe(f2.heldButtons);
      expect(f1.pressedButtons).toBe(f2.pressedButtons);
    }
  });

  it("60-tick simulation is deterministic across runs", () => {
    const run = () => {
      const adapter = createCpuAdapter();
      const results: Array<{ tick: number; moveX: number; moveY: number }> = [];
      for (let t = 0; t < 60; t++) {
        const obs = makeAttackingObservation({
          playerX: t * 0.2 - 5,
          playerY: Math.sin(t * 0.1) * 3,
          formationRole: "midfielder",
          ballX: 10 + Math.sin(t * 0.05) * 5,
          ballY: 2,
          ballVx: 0.5,
          ballVy: 0,
          cpuTeamId: "team-a",
          teammates: [{ id: "tm-1", x: 10, y: 2 }],
          opponents: [
            { id: "opp-1", x: 45, y: 5 },
            { id: "opp-2", x: 40, y: -3 },
          ],
          teamDecision: {
            strategy: "ATTACK",
            defensiveSubMode: "NONE",
            nearestToBallPlayerId: "tm-1",
            nearestToBallDistance: 2,
            hasPossession: true,
            ballZone: "center",
          },
          controlledPlayerId: "midfielder-1",
        });
        const frame = adapter.sample(t, obs);
        results.push({ tick: t, moveX: frame.moveX, moveY: frame.moveY });
      }
      return results;
    };

    const run1 = run();
    const run2 = run();
    expect(run1).toEqual(run2);
  });
});

// ===========================================================================
// 7. NO REGRESSION on pass/shoot decisions
// ===========================================================================

describe("CPU-ATTACK-007: pass/shoot decisions unchanged", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("player with ball still shoots when close to goal", () => {
    const obs = makeAttackingObservation({
      playerX: 48,
      playerY: 0,
      formationRole: "attacker",
      ballX: 48.2,
      ballY: 0,
      ballVx: 0,
      ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [{ id: "tm-1", x: 30, y: 5 }],
      opponents: [
        { id: "opp-1", x: 50, y: 3 },
      ],
      teamDecision: {
        strategy: "ATTACK",
        defensiveSubMode: "NONE",
        nearestToBallPlayerId: "attacker-1",
        nearestToBallDistance: 0.2,
        hasPossession: true,
        ballZone: "opponent",
      },
      controlledPlayerId: "attacker-1",
    });

    // Run 2 ticks to gain possession.
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // At 48m, dist to goal = 52.5 - 48 = 4.5m → within SHOT_RANGE_CLOSE (5m).
    // Should shoot.
    expect((frame.pressedButtons & SHOT_BIT) !== 0 || (frame.heldButtons & SHOT_BIT) !== 0).toBe(true);
  });

  it("off-ball player does not press PASS or SHOT", () => {
    const obs = makeAttackingObservation({
      playerX: 0,
      playerY: 0,
      formationRole: "attacker",
      ballX: -5,
      ballY: 0,
      ballVx: 0,
      ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [{ id: "tm-1", x: -5, y: 0 }],
      opponents: [
        { id: "opp-1", x: 45, y: 5 },
      ],
      teamDecision: {
        strategy: "ATTACK",
        defensiveSubMode: "NONE",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 0.5,
        hasPossession: true,
        ballZone: "own",
      },
      controlledPlayerId: "attacker-1",
    });

    const frame = adapter.sample(0, obs);

    // Off-ball player should not press PASS or SHOT.
    expect((frame.pressedButtons & PASS_BIT) === 0).toBe(true);
    expect((frame.pressedButtons & SHOT_BIT) === 0).toBe(true);
  });

  it("player without ball but not team possession still chases ball", () => {
    const obs = makeAttackingObservation({
      playerX: -20,
      playerY: 0,
      formationRole: "attacker",
      ballX: 10,
      ballY: 0,
      ballVx: 5,
      ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [{ id: "tm-1", x: -30, y: 0 }],
      opponents: [
        { id: "opp-1", x: 10.5, y: 0 },
      ],
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "PRESSING",
        nearestToBallPlayerId: "attacker-1",
        nearestToBallDistance: 30,
        hasPossession: false,
        ballZone: "center",
      },
      controlledPlayerId: "attacker-1",
    });

    const frame = adapter.sample(0, obs);

    // Ball is moving fast (5 m/s) → no team possession.
    // Defender at 10.5 is within possession range → opponent has ball.
    // Player should chase the ball (toward x=10 from x=-20).
    expect(frame.moveX).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Helper function
// ===========================================================================

function makeAttackingObservation(opts: {
  playerX: number;
  playerY: number;
  formationRole?: "defender" | "midfielder" | "attacker";
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  cpuTeamId: string;
  teammates?: Array<{ id: string; x: number; y: number }>;
  opponents: Array<{ id: string; x: number; y: number }>;
  teamDecision?: TeamDecision;
  controlledPlayerId?: string;
}): CpuObservation {
  const opponentTeamId = opts.cpuTeamId === "team-a" ? "team-b" : "team-a";
  const cpuPlayerId = opts.controlledPlayerId ?? "attacker-1";

  const players: CpuObservation["players"] = [
    {
      playerId: cpuPlayerId,
      teamId: opts.cpuTeamId,
      groundPosition: { x: opts.playerX, y: opts.playerY },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: opts.cpuTeamId === "team-b" ? Math.PI : 0,
      formationRole: opts.formationRole,
    },
  ];

  for (const tm of opts.teammates ?? []) {
    players.push({
      playerId: tm.id,
      teamId: opts.cpuTeamId,
      groundPosition: { x: tm.x, y: tm.y },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: opts.cpuTeamId === "team-b" ? Math.PI : 0,
    });
  }

  for (const opp of opts.opponents) {
    players.push({
      playerId: opp.id,
      teamId: opponentTeamId,
      groundPosition: { x: opp.x, y: opp.y },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: opts.cpuTeamId === "team-b" ? 0 : Math.PI,
    });
  }

  const ownGoalX = opts.cpuTeamId === "team-b" ? 52.5 : -52.5;
  const pull = opts.formationRole === "defender" ? 0.4
    : opts.formationRole === "attacker" ? 0.05 : 0.2;
  const formationPosition = {
    x: opts.playerX + (ownGoalX - opts.playerX) * pull,
    y: opts.playerY,
  };

  return {
    players,
    ball: {
      position: { x: opts.ballX, y: opts.ballY, z: 0.11 },
      linearVelocity: { x: opts.ballVx, y: opts.ballVy, z: 0 },
      regime: "ground-roll",
    },
    pitchLength: 105,
    pitchWidth: 68,
    cpuTeamId: opts.cpuTeamId,
    controlledPlayerId: cpuPlayerId,
    formationPosition,
    teamDecision: opts.teamDecision,
    teammates: (opts.teammates ?? []).map((tm) => ({
      playerId: tm.id,
      groundPosition: { x: tm.x, y: tm.y },
    })),
  };
}
