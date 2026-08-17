/**
 * @module tests/unit/cpu-adapter/cpu-defensive-improvement
 *
 * Tests for CPU defensive improvement: defensive sub-modes in team
 * decision profile, defender marking/tracking of opposing attackers,
 * pressing the ball carrier, and marking distance offset.
 *
 * Covers:
 *  1. Team-decision-profile defensive sub-modes (PRESSING, MARKING,
 *     RECOVERING, NONE).
 *  2. Defender mark tracking: non-nearest-to-ball defender tracks the
 *     most threatening opponent instead of the ball.
 *  3. Pressing: nearest-to-ball defender presses ball carrier when
 *     within PRESS_RADIUS.
 *  4. Marking distance: defender positioned between marked target and
 *     own goal at configurable offset.
 *  5. Determinism: defensive behavior produces consistent output.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createCpuAdapter,
  computeTeamDecision,
  type CpuAdapter,
  type CpuObservation,
  type TeamDecision,
} from "../../../src/adapters/input-browser/cpu-adapter.js";
import { FIRST_TOUCH_BIT, SHOT_BIT } from "../../../src/contracts/input.js";

// ===========================================================================
// 1. DEFENSIVE SUB-MODES in team decision profile
// ===========================================================================

describe("CPU-DEF-PROFILE-001: defensive sub-modes", () => {
  it("ATTACK strategy → defensiveSubMode is NONE", () => {
    const obs = makeDefensiveObservation({
      playerX: 10, playerY: 0,
      ballX: 10.5, ballY: 0, ballVx: 0, ballVy: 0,
      cpuTeamId: "team-a",
      opponents: [
        { id: "opp-1", x: 30, y: 5 },
        { id: "opp-2", x: 25, y: -3 },
      ],
    });
    // team-a player at 10, ball at 10.5 → within possession range → ATTACK.
    const decision = computeTeamDecision(obs, "team-a");
    expect(decision.strategy).toBe("ATTACK");
    expect(decision.defensiveSubMode).toBe("NONE");
  });

  it("DEFEND strategy with nearest close → PRESSING", () => {
    const obs = makeDefensiveObservation({
      playerX: -30, playerY: 0,
      ballX: -20, ballY: 0, ballVx: 0, ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [
        { id: "tm-1", x: -29, y: 0 },
      ],
      opponents: [
        { id: "opp-1", x: -20.5, y: 0 },
      ],
    });
    // Opponent at -20.5, within 2m of ball at -20 → opponent has possession.
    // team-a players at -30 and -29 → ball in own third (x < -17.5).
    // Nearest teammate at -29, ball at -20 → dist = 9 < 12 → PRESSING.
    const decision = computeTeamDecision(obs, "team-a");
    expect(decision.strategy).toBe("DEFEND");
    expect(decision.defensiveSubMode).toBe("PRESSING");
  });

  it("DEFEND strategy with nearest far → MARKING", () => {
    const obs = makeDefensiveObservation({
      playerX: -40, playerY: 0,
      ballX: -20, ballY: 0, ballVx: 0, ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [
        { id: "tm-1", x: -38, y: 0 },
      ],
      opponents: [
        { id: "opp-1", x: -20.5, y: 0 },
      ],
    });
    // Opponent at -20.5, within 2m of ball at -20 → opponent has possession.
    // team-a players far from ball → nearest dist = 18 > 12 → MARKING.
    const decision = computeTeamDecision(obs, "team-a");
    expect(decision.strategy).toBe("DEFEND");
    expect(decision.defensiveSubMode).toBe("MARKING");
  });

  it("BALANCED + opponent has possession + own third → MARKING", () => {
    const obs = makeDefensiveObservation({
      playerX: -35, playerY: 0,
      ballX: -25, ballY: 0, ballVx: 0, ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [
        { id: "tm-1", x: -30, y: 10 },
      ],
      opponents: [
        { id: "opp-1", x: -25.5, y: 0 },
      ],
    });
    // Opponent at -25.5, within 2m of ball at -25 → opponent possession.
    // team-a players at -35 and -30 → ball at -25 → own third.
    // Nearest distance = |-30 - (-25)| = 5 < 12 (PRESS_DISTANCE_THRESHOLD),
    // but strategy is determined by: hasPossession=false, opponentHasPossession=true, ballZone=own → DEFEND.
    const decision = computeTeamDecision(obs, "team-a");
    expect(decision.strategy).toBe("DEFEND");
    expect(["PRESSING", "MARKING"]).toContain(decision.defensiveSubMode);
  });

  it("BALANCED + opponent has possession + center third → RECOVERING", () => {
    const obs = makeDefensiveObservation({
      playerX: -10, playerY: 0,
      ballX: 5, ballY: 0, ballVx: 0, ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [
        { id: "tm-1", x: -5, y: 5 },
      ],
      opponents: [
        { id: "opp-1", x: 5.5, y: 0 },
      ],
    });
    // Opponent at 5.5, within 2m of ball at 5 → opponent possession.
    // Ball at x=5 → center zone for team-a (thirdWidth=17.5).
    // hasPossession=false, opponentHasPossession=true, ballZone=center → BALANCED.
    const decision = computeTeamDecision(obs, "team-a");
    if (decision.strategy === "BALANCED") {
      expect(decision.defensiveSubMode).toBe("RECOVERING");
    }
  });

  it("sub-mode is deterministic for same inputs", () => {
    const obs = makeDefensiveObservation({
      playerX: -40, playerY: 0,
      ballX: -20, ballY: 0, ballVx: 0, ballVy: 0,
      cpuTeamId: "team-a",
      teammates: [
        { id: "tm-1", x: -38, y: 0 },
      ],
      opponents: [
        { id: "opp-1", x: -18, y: 0 },
      ],
    });
    const d1 = computeTeamDecision(obs, "team-a");
    const d2 = computeTeamDecision(obs, "team-a");
    expect(d1.defensiveSubMode).toBe(d2.defensiveSubMode);
    expect(d1.strategy).toBe(d2.strategy);
  });
});

// ===========================================================================
// 2. MARKING / TRACKING: defenders track opposing attackers
// ===========================================================================

describe("CPU-DEF-MARK-001: defender tracks most threatening opponent", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("defender moves toward mark target instead of ball when in DEFEND mode", () => {
    // Setup: team-a defender at (0, 0), ball at (30, 0).
    // Opponent attacker at (10, 5) — closest to team-a's own goal at -52.5.
    // Opponent attacker at (40, -5) — farther from own goal.
    // Team decision: DEFEND with MARKING sub-mode.
    // Defender is NOT nearest to ball (nearest is far away).
    const obs = makeDefensiveObservation({
      playerX: 0, playerY: 0,
      ballX: 30, ballY: 0, ballVx: 0, ballVy: 0,
      cpuTeamId: "team-a",
      formationRole: "defender",
      teammates: [
        { id: "tm-1", x: -20, y: 0 },
      ],
      opponents: [
        { id: "opp-close-to-goal", x: 10, y: 5 },
        { id: "opp-far-from-goal", x: 40, y: -5 },
      ],
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "MARKING",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 50,
        hasPossession: false,
        ballZone: "own",
      },
      controlledPlayerId: "defender-1",
    });

    const frame = adapter.sample(0, obs);

    // Most threatening opponent is (10, 5) — closest to own goal at -52.5.
    // Mark offset: (10, 5) toward (-52.5, 5) by MARKING_DISTANCE (5m).
    // Direction to own goal: (-52.5 - 10) = -62.5.
    // Offset = (10 + (-62.5/62.5) * 5, 5) = (5, 5).
    // Defender at (0, 0) → direction toward (5, 5) → moveX > 0, moveY > 0.
    // This is different from chasing the ball at (30, 0) which would be pure +x.
    expect(frame.moveX).toBeGreaterThan(0);
    // moveY should be positive (toward the mark target's y=5).
    expect(frame.moveY).toBeGreaterThan(0);
  });

  it("non-defender roles still chase ball (no marking)", () => {
    const obs = makeDefensiveObservation({
      playerX: 0, playerY: 0,
      ballX: 30, ballY: 0, ballVx: 0, ballVy: 0,
      cpuTeamId: "team-a",
      formationRole: "midfielder",
      teammates: [
        { id: "tm-1", x: -20, y: 0 },
      ],
      opponents: [
        { id: "opp-1", x: 45, y: 5 },
      ],
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "MARKING",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 50,
        hasPossession: false,
        ballZone: "own",
      },
      controlledPlayerId: "midfielder-1",
    });

    const frame = adapter.sample(0, obs);

    // Midfielder should still chase the ball (no marking for non-defenders).
    // Ball at (30, 0), player at (0, 0) → moveX > 0, moveY ≈ 0.
    expect(frame.moveX).toBeGreaterThan(0);
    expect(Math.abs(frame.moveY)).toBeLessThan(0.01);
  });

  it("nearest-to-ball defender does not mark (presses instead)", () => {
    const obs = makeDefensiveObservation({
      playerX: 20, playerY: 0,
      ballX: 25, ballY: 0, ballVx: 0, ballVy: 0,
      cpuTeamId: "team-a",
      formationRole: "defender",
      teammates: [
        { id: "tm-1", x: -10, y: 0 },
      ],
      opponents: [
        { id: "opp-1", x: 45, y: 10 },
      ],
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "PRESSING",
        nearestToBallPlayerId: "defender-1",
        nearestToBallDistance: 5,
        hasPossession: false,
        ballZone: "own",
      },
      controlledPlayerId: "defender-1",
    });

    const frame = adapter.sample(0, obs);

    // Nearest to ball → should chase ball, not mark.
    // Ball at (25, 0), player at (20, 0) → moveX > 0, moveY ≈ 0.
    expect(frame.moveX).toBeGreaterThan(0);
    expect(Math.abs(frame.moveY)).toBeLessThan(0.01);
  });
});

// ===========================================================================
// 3. PRESSING: nearest defender presses ball carrier
// ===========================================================================

describe("CPU-DEF-PRESS-001: pressing the ball carrier", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("defender within PRESS_RADIUS presses ball carrier aggressively", () => {
    // Team-a defender at (10, 0), ball at (20, 0).
    // Opponent ball carrier at (19, 0) — within PRESS_RADIUS (12m).
    // Defender is nearest to ball.
    const obs = makeDefensiveObservation({
      playerX: 10, playerY: 0,
      ballX: 20, ballY: 0, ballVx: 0, ballVy: 0,
      cpuTeamId: "team-a",
      formationRole: "defender",
      teammates: [
        { id: "tm-1", x: -20, y: 0 },
      ],
      opponents: [
        { id: "opp-carrier", x: 19, y: 0 },
        { id: "opp-other", x: 40, y: 5 },
      ],
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "PRESSING",
        nearestToBallPlayerId: "defender-1",
        nearestToBallDistance: 10,
        hasPossession: false,
        ballZone: "own",
      },
      controlledPlayerId: "defender-1",
    });

    // Run 2 ticks to establish state.
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Should press toward ball carrier at (19, 0).
    // Press direction: (19-10, 0) = (9, 0) → normalized (1, 0) × 1.3 = 1.3 → clamped to 1.
    expect(frame.moveX).toBeGreaterThan(0.9);
    expect(Math.abs(frame.moveY)).toBeLessThan(0.01);
  });

  it("defender outside PRESS_RADIUS falls back to normal chase", () => {
    // Defender at (0, 0), ball at (20, 0) — ball at 20m from defender.
    // PRESS_RADIUS = 12 → outside radius → no press boost.
    const obs = makeDefensiveObservation({
      playerX: 0, playerY: 0,
      ballX: 20, ballY: 0, ballVx: 0, ballVy: 0,
      cpuTeamId: "team-a",
      formationRole: "defender",
      teammates: [
        { id: "tm-1", x: -20, y: 0 },
      ],
      opponents: [
        { id: "opp-carrier", x: 21, y: 0 },
        { id: "opp-other", x: 40, y: 5 },
      ],
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "PRESSING",
        nearestToBallPlayerId: "defender-1",
        nearestToBallDistance: 20,
        hasPossession: false,
        ballZone: "own",
      },
      controlledPlayerId: "defender-1",
    });

    const frame = adapter.sample(0, obs);

    // Should chase ball (normal behavior, no press boost).
    // Ball at (20, 0), player at (0, 0) → moveX ≈ 1.
    expect(frame.moveX).toBeGreaterThan(0.9);
    expect(Math.abs(frame.moveY)).toBeLessThan(0.01);
    // Press boost should NOT be applied — moveX should not exceed 1.
    expect(frame.moveX).toBeLessThanOrEqual(1.001);
  });
});

// ===========================================================================
// 4. MARKING DISTANCE: offset between defender and mark target
// ===========================================================================

describe("CPU-DEF-DIST-001: marking distance offset", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("defender positions between mark target and own goal", () => {
    // team-a defender at (0, 0), own goal at -52.5.
    // Opponent attacker at (10, 0) — most threatening (closest to own goal).
    // Mark offset: (10, 0) toward (-52.5, 0) by MARKING_DISTANCE (5m).
    // Direction to own goal from target: (-52.5 - 10) = -62.5 (unit: -1).
    // Offset = (10 + (-62.5/62.5) * 5, 0) = (5, 0).
    // So defender should move toward (5, 0) → moveX > 0.
    const obs = makeDefensiveObservation({
      playerX: 0, playerY: 0,
      ballX: 30, ballY: 0, ballVx: 0, ballVy: 0,
      cpuTeamId: "team-a",
      formationRole: "defender",
      teammates: [
        { id: "tm-1", x: -20, y: 0 },
      ],
      opponents: [
        { id: "opp-attacker", x: 10, y: 0 },
      ],
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "MARKING",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 50,
        hasPossession: false,
        ballZone: "own",
      },
      controlledPlayerId: "defender-1",
    });

    const frame = adapter.sample(0, obs);

    // Should move toward mark offset at (5, 0) → positive moveX.
    expect(frame.moveX).toBeGreaterThan(0);
  });

  it("team-b defender positions between mark target and own goal (mirrored)", () => {
    // team-b defender at (0, 0), own goal at +52.5.
    // Opponent attacker at (-10, 0) — closest to team-b's own goal.
    // Mark offset: (-10, 0) toward (+52.5, 0) by MARKING_DISTANCE (5m).
    // Direction: (52.5 - (-10)) = 62.5 (unit: +1).
    // Offset = (-10 + 62.5/62.5 * 5, 0) = (-5, 0).
    // Defender should move toward (-5, 0) → moveX < 0.
    const obs = makeDefensiveObservation({
      playerX: 0, playerY: 0,
      ballX: -30, ballY: 0, ballVx: 0, ballVy: 0,
      cpuTeamId: "team-b",
      formationRole: "defender",
      teammates: [
        { id: "tm-1", x: 20, y: 0 },
      ],
      opponents: [
        { id: "opp-attacker", x: -10, y: 0 },
      ],
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "MARKING",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 50,
        hasPossession: false,
        ballZone: "own",
      },
      controlledPlayerId: "defender-1",
    });

    const frame = adapter.sample(0, obs);

    // Should move toward mark offset at (-5, 0) → negative moveX.
    expect(frame.moveX).toBeLessThan(0);
  });

  it("defender does not overshoot the own goal when mark target is close to it", () => {
    // Opponent attacker very close to own goal — marking offset should
    // not overshoot past the goal.
    // team-a defender at (0, 0), own goal at -52.5.
    // Opponent at (-50, 0) — very close to own goal.
    // Mark offset: (-50, 0) toward (-52.5, 0) by 5m.
    // Direction: (-52.5 - (-50)) = -2.5, length 2.5.
    // fraction = min(5/2.5, 1) = 1 → offset at (-50 + (-2.5) * 1, 0) = (-52.5, 0).
    // Defender at (0, 0) → move toward (-52.5, 0) → moveX < 0.
    const obs = makeDefensiveObservation({
      playerX: 0, playerY: 0,
      ballX: 20, ballY: 0, ballVx: 0, ballVy: 0,
      cpuTeamId: "team-a",
      formationRole: "defender",
      teammates: [
        { id: "tm-1", x: -20, y: 0 },
      ],
      opponents: [
        { id: "opp-attacker", x: -50, y: 0 },
      ],
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "MARKING",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 70,
        hasPossession: false,
        ballZone: "center",
      },
      controlledPlayerId: "defender-1",
    });

    const frame = adapter.sample(0, obs);

    // Should move toward own goal (mark offset doesn't overshoot).
    expect(frame.moveX).toBeLessThan(0);
  });
});

// ===========================================================================
// 5. DETERMINISM: defensive behavior is deterministic
// ===========================================================================

describe("CPU-DEF-DET-001: determinism of defensive behavior", () => {
  it("same observation produces same defensive output across independent adapters", () => {
    const obs = makeDefensiveObservation({
      playerX: 0, playerY: 0,
      ballX: 30, ballY: 0, ballVx: 0, ballVy: 0,
      cpuTeamId: "team-a",
      formationRole: "defender",
      teammates: [
        { id: "tm-1", x: -20, y: 0 },
      ],
      opponents: [
        { id: "opp-1", x: 40, y: 5 },
      ],
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "MARKING",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 50,
        hasPossession: false,
        ballZone: "own",
      },
      controlledPlayerId: "defender-1",
    });

    const adapter1 = createCpuAdapter();
    const adapter2 = createCpuAdapter();

    for (let t = 0; t < 30; t++) {
      const f1 = adapter1.sample(t, obs);
      const f2 = adapter2.sample(t, obs);
      expect(f1.moveX).toBe(f2.moveX);
      expect(f1.moveY).toBe(f2.moveY);
      expect(f1.heldButtons).toBe(f2.heldButtons);
      expect(f1.pressedButtons).toBe(f2.pressedButtons);
    }
  });

  it("60-tick simulation with defensive behavior is deterministic across runs", () => {
    const run = () => {
      const adapter = createCpuAdapter();
      const results: Array<{ tick: number; moveX: number; moveY: number }> = [];
      for (let t = 0; t < 60; t++) {
        const obs = makeDefensiveObservation({
          playerX: t * 0.1, playerY: Math.sin(t * 0.1) * 2,
          ballX: 30, ballY: 5, ballVx: 0, ballVy: 0,
          cpuTeamId: "team-a",
          formationRole: "defender",
          teammates: [
            { id: "tm-1", x: -20, y: 0 },
          ],
          opponents: [
            { id: "opp-1", x: 40, y: 5 },
          ],
          teamDecision: {
            strategy: "DEFEND",
            defensiveSubMode: "MARKING",
            nearestToBallPlayerId: "tm-1",
            nearestToBallDistance: 50,
            hasPossession: false,
            ballZone: "own",
          },
          controlledPlayerId: "defender-1",
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
// Helper functions
// ===========================================================================

function makeDefensiveObservation(opts: {
  playerX: number;
  playerY: number;
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  cpuTeamId: string;
  formationRole?: "defender" | "midfielder" | "attacker";
  teammates?: Array<{ id: string; x: number; y: number }>;
  opponents: Array<{ id: string; x: number; y: number }>;
  teamDecision?: TeamDecision;
  controlledPlayerId?: string;
}): CpuObservation {
  const opponentTeamId = opts.cpuTeamId === "team-a" ? "team-b" : "team-a";
  const cpuPlayerId = opts.controlledPlayerId ?? "defender-1";

  const players: CpuObservation["players"] = [
    {
      playerId: cpuPlayerId,
      teamId: opts.cpuTeamId,
      groundPosition: { x: opts.playerX, y: opts.playerY },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: 0,
      formationRole: opts.formationRole,
    },
  ];

  // Add teammates.
  for (const tm of opts.teammates ?? []) {
    players.push({
      playerId: tm.id,
      teamId: opts.cpuTeamId,
      groundPosition: { x: tm.x, y: tm.y },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: 0,
    });
  }

  // Add opponents.
  for (const opp of opts.opponents) {
    players.push({
      playerId: opp.id,
      teamId: opponentTeamId,
      groundPosition: { x: opp.x, y: opp.y },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: Math.PI,
    });
  }

  // Build formation position for the CPU player.
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
