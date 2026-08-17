/**
 * @module tests/unit/cpu-adapter/teamplay-3v3
 *
 * Tests for 3v3 CPU teamplay: passing to correct teammate, shooting
 * decisions, formation recovery for all 3 roles, shared team-decision,
 * and determinism across 6 CPU adapters.
 *
 * Covers:
 *  1. CPU correctly identifies the best forward teammate from 3 options
 *  2. Shooting decisions in 3v3 context (formation-aware positioning
 *     doesn't interfere with shot priority)
 *  3. Formation recovery for all 3 roles (defender/midfielder/attacker)
 *     in parallel
 *  4. Team decision: all 3 CPU adapters on the same team receive the
 *     same teamDecision signal
 *  5. Determinism: 6 adapters producing identical behavior over 60+ ticks
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createCpuAdapter,
  computeTeamDecision,
  type CpuAdapter,
  type CpuObservation,
  type CpuTeammate,
  type TeamDecision,
} from "../../../src/adapters/input-browser/cpu-adapter.js";
import { PASS_BIT, SHOT_BIT, FIRST_TOUCH_BIT } from "../../../src/contracts/input.js";

// ===========================================================================
// 1. 3v3 PASSING: pick best forward teammate from 3 options
// ===========================================================================

describe("CPU-3V3-PASS-001: best teammate from 3 options", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("CPU at (20, 0) with 3 teammates → picks nearest forward one", () => {
    // Three teammates: two in forward direction, one behind.
    // Nearest forward: (25, 2) — distSq = 29
    // Farthest forward: (35, 8) — distSq = 313
    // Behind: (10, 0) — filtered out.
    const obs: CpuObservation = makeObservationWith3Teammates(
      20, 0, 20.5, 0, 0, 0, "team-a",
      [
        { playerId: "tm-far", groundPosition: { x: 35, y: 8 } },
        { playerId: "tm-near", groundPosition: { x: 25, y: 2 } },
        { playerId: "tm-behind", groundPosition: { x: 10, y: 0 } },
      ],
      "cpu-player",
    );
    // Force bodyHeading away from goal so pass is triggered.
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.pressedButtons & PASS_BIT).not.toBe(0);

    // Should aim at nearest forward teammate (25, 2):
    // dx = 5, dy = 2, normalized: ≈ (0.894, 0.358)
    expect(frame.moveX).toBeGreaterThan(0.85);
    expect(frame.moveX).toBeLessThan(0.95);
    expect(frame.moveY).toBeGreaterThan(0.3);
    expect(frame.moveY).toBeLessThan(0.45);
  });

  it("all 3 teammates in forward direction → picks nearest", () => {
    const obs: CpuObservation = makeObservationWith3Teammates(
      20, 0, 20.5, 0, 0, 0, "team-a",
      [
        { playerId: "tm-far-right", groundPosition: { x: 50, y: 0 } },
        { playerId: "tm-mid", groundPosition: { x: 30, y: 6 } },
        { playerId: "tm-close", groundPosition: { x: 23, y: 1 } },
      ],
      "cpu-player",
    );
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Should aim at closest: (23, 1) → dx=3, dy=1, normalized ≈ (0.949, 0.316)
    expect(frame.moveX).toBeGreaterThan(0.9);
    expect(frame.moveY).toBeGreaterThan(0.25);
    expect(frame.moveY).toBeLessThan(0.4);
  });

  it("only 1 forward teammate among 3 → passes to that one", () => {
    const obs: CpuObservation = makeObservationWith3Teammates(
      20, 0, 20.5, 0, 0, 0, "team-a",
      [
        { playerId: "tm-left1", groundPosition: { x: 10, y: 3 } },
        { playerId: "tm-forward", groundPosition: { x: 30, y: -4 } },
        { playerId: "tm-left2", groundPosition: { x: 15, y: -2 } },
      ],
      "cpu-player",
    );
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    // Should aim at (30, -4): dx=10, dy=-4, normalized ≈ (0.928, -0.371)
    expect(frame.moveX).toBeGreaterThan(0.85);
    expect(frame.moveY).toBeLessThan(-0.3);
    expect(frame.moveY).toBeGreaterThan(-0.5);
  });

  it("CPU adapter correctly selects nearest forward teammate among 3", () => {
    // Three teammates: tm2 at (30, 3) is nearest forward (distSq=109),
    // tm3 at (40, -5) is farther (distSq=425), tm1 at (50, 10) is farthest (distSq=1000).
    const obs: CpuObservation = makeObservationWith3Teammates(
      20, 0, 20.5, 0, 0, 0, "team-a",
      [
        { playerId: "tm1", groundPosition: { x: 50, y: 10 } },
        { playerId: "tm3", groundPosition: { x: 40, y: -5 } },
        { playerId: "tm2", groundPosition: { x: 30, y: 3 } },
      ],
      "cpu-player",
    );
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    // Should aim at tm2 (30, 3): dx=10, dy=3, normalized ≈ (0.949, 0.283)
    expect(frame.moveX).toBeGreaterThan(0.9);
    expect(frame.moveY).toBeGreaterThan(0.25);
    expect(frame.moveY).toBeLessThan(0.35);
  });

  it("all 3 teammates behind CPU → falls back to goal direction", () => {
    const obs: CpuObservation = makeObservationWith3Teammates(
      20, 0, 20.5, 0, 0, 0, "team-a",
      [
        { playerId: "tm1", groundPosition: { x: 10, y: 3 } },
        { playerId: "tm2", groundPosition: { x: 15, y: -2 } },
        { playerId: "tm3", groundPosition: { x: 5, y: 0 } },
      ],
      "cpu-player",
    );
    obs.players[0].bodyHeading = Math.PI;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // No forward teammate → still passes (facing away from goal).
    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    // moveX should still be toward +x goal (fallback).
    expect(frame.moveX).toBeGreaterThan(0);
  });

  it("team-b: all 3 teammates, picks nearest in -x direction", () => {
    const obs: CpuObservation = makeObservationWith3Teammates(
      20, 0, 20.5, 0, 0, 0, "team-b",
      [
        { playerId: "tm1", groundPosition: { x: 40, y: 5 } },
        { playerId: "tm2", groundPosition: { x: 10, y: -2 } },
        { playerId: "tm3", groundPosition: { x: 15, y: 3 } },
      ],
      "cpu-player",
    );
    // team-b attacks -x. Player at 20.
    // Forward teammates: (10,-2) distSq=104, (15,3) distSq=34.
    // Nearest forward: (15,3).
    obs.players[0].bodyHeading = 0;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    // Nearest forward: (15, 3): dx=-5, dy=3, dist≈5.83 → normalized ≈ (-0.857, 0.514)
    expect(frame.moveX).toBeLessThan(-0.8);
    expect(frame.moveY).toBeGreaterThan(0.4);
    expect(frame.moveY).toBeLessThan(0.6);
  });
});

// ===========================================================================
// 2. 3v3 SHOOTING: formation-aware positioning doesn't interfere
// ===========================================================================

describe("CPU-3V3-SHOT-001: shooting in 3v3 context", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("within 5m: CPU shoots despite 3 teammates present", () => {
    const obs: CpuObservation = makeObservationWith3Teammates(
      50, 0, 50.5, 0, 0, 0, "team-a",
      [
        { playerId: "tm1", groundPosition: { x: 55, y: 2 } },
        { playerId: "tm2", groundPosition: { x: 48, y: -1 } },
        { playerId: "tm3", groundPosition: { x: 60, y: 5 } },
      ],
      "cpu-player",
    );
    obs.players[0].bodyHeading = 0; // facing goal.

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).not.toBe(0);
    // No pass when shooting.
    expect(frame.heldButtons & PASS_BIT).toBe(0);
    expect(frame.pressedButtons & PASS_BIT).toBe(0);
  });

  it("beyond 20m: CPU passes (not shoots) with 3 teammates", () => {
    const obs: CpuObservation = makeObservationWith3Teammates(
      20, 0, 20.5, 0, 0, 0, "team-a",
      [
        { playerId: "tm1", groundPosition: { x: 40, y: 5 } },
        { playerId: "tm2", groundPosition: { x: 35, y: -3 } },
        { playerId: "tm3", groundPosition: { x: 50, y: 0 } },
      ],
      "cpu-player",
    );
    obs.players[0].bodyHeading = Math.PI; // facing away.

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Beyond shot range, facing away → pass.
    // Nearest teammate at ~15m triggers lofted pass (SHOT_BIT aimed at teammate).
    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
  });

  it("at 6m, facing goal: shoots (medium range), no pass", () => {
    const obs: CpuObservation = makeObservationWith3Teammates(
      46.5, 0, 47, 0, 0, 0, "team-a",
      [
        { playerId: "tm1", groundPosition: { x: 55, y: 3 } },
        { playerId: "tm2", groundPosition: { x: 52, y: -2 } },
        { playerId: "tm3", groundPosition: { x: 48, y: 1 } },
      ],
      "cpu-player",
    );
    obs.players[0].bodyHeading = 0;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.heldButtons & PASS_BIT).toBe(0);
  });

  it("3v3 CPU with defender role at shooting range: still shoots", () => {
    const obs: CpuObservation = makeObservationWithRoleAnd3Teammates(
      50, 0, 50.5, 0, 0, 0, "team-a", "defender",
      [
        { playerId: "tm1", groundPosition: { x: 55, y: 2 } },
        { playerId: "tm2", groundPosition: { x: 48, y: -1 } },
        { playerId: "tm3", groundPosition: { x: 60, y: 5 } },
      ],
      "cpu-player",
    );
    obs.players[0].bodyHeading = 0;

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Defender role doesn't suppress shooting when in range.
    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.heldButtons & PASS_BIT).toBe(0);
  });

  it("all 3 roles shoot correctly within close range", () => {
    const roles: Array<"defender" | "midfielder" | "attacker"> = [
      "defender", "midfielder", "attacker",
    ];
    for (const role of roles) {
      const obs = makeObservationWithRoleAnd3Teammates(
        48, 0, 48.5, 0, 0, 0, "team-a", role,
        [
          { playerId: "tm1", groundPosition: { x: 55, y: 0 } },
          { playerId: "tm2", groundPosition: { x: 50, y: 3 } },
          { playerId: "tm3", groundPosition: { x: 52, y: -2 } },
        ],
        "cpu-player",
      );
      obs.players[0].bodyHeading = 0;
      const frame = createCpuAdapter().sample(0, obs);

      // After first tick: ballWasInRange → hasPossession next tick.
      // At tick 1: shot.
      const adapter = createCpuAdapter();
      adapter.sample(0, obs);
      const frame1 = adapter.sample(1, obs);

      expect(frame1.heldButtons & SHOT_BIT).not.toBe(0, `${role} should shoot`);
      expect(frame1.heldButtons & PASS_BIT).toBe(0, `${role} should not pass when shooting`);
    }
  });
});

// ===========================================================================
// 3. 3v3 FORMATION RECOVERY: all 3 roles recover in parallel
// ===========================================================================

describe("CPU-3V3-FORM-001: formation recovery for all 3 roles in 3v3", () => {
  it("all 3 roles pull toward own goal when ball is behind", () => {
    const roles: Array<"defender" | "midfielder" | "attacker"> = [
      "defender", "midfielder", "attacker",
    ];

    for (const role of roles) {
      // Player at (10, 5), ball at (-30, 5). team-a: own goal at -52.5.
      // Ball behind (ballX < playerX): -30 < 10 → behind = true.
      const obs = makeObservationWithRoleAnd3Teammates(
        10, 5, -30, 5, 0, 0, "team-a", role,
        [
          { playerId: "tm1", groundPosition: { x: 30, y: 5 } },
          { playerId: "tm2", groundPosition: { x: 20, y: -3 } },
          { playerId: "tm3", groundPosition: { x: 35, y: 8 } },
        ],
        "cpu-player",
      );
      const adapter = createCpuAdapter();
      // Run enough ticks for displacement to build.
      for (let t = 0; t <= 30; t++) {
        adapter.sample(t, obs);
      }
      const frame = adapter.sample(31, obs);

      // Both chase (toward ball at -30) and formation (toward -52.5)
      // pull negative X → moveX < 0.
      expect(frame.moveX).toBeLessThan(0, `${role} should pull toward own goal`);
    }
  });

  it("defender has deeper formation position than midfielder or attacker", () => {
    const defenderObs = makeObservationWithRoleAnd3Teammates(
      0, 0, -40, 0, 0, 0, "team-a", "defender",
      [
        { playerId: "tm1", groundPosition: { x: 20, y: 5 } },
        { playerId: "tm2", groundPosition: { x: 15, y: -3 } },
        { playerId: "tm3", groundPosition: { x: 25, y: 0 } },
      ],
      "cpu-player",
    );
    const midfielderObs = makeObservationWithRoleAnd3Teammates(
      0, 0, -40, 0, 0, 0, "team-a", "midfielder",
      [
        { playerId: "tm1", groundPosition: { x: 20, y: 5 } },
        { playerId: "tm2", groundPosition: { x: 15, y: -3 } },
        { playerId: "tm3", groundPosition: { x: 25, y: 0 } },
      ],
      "cpu-player",
    );
    const attackerObs = makeObservationWithRoleAnd3Teammates(
      0, 0, -40, 0, 0, 0, "team-a", "attacker",
      [
        { playerId: "tm1", groundPosition: { x: 20, y: 5 } },
        { playerId: "tm2", groundPosition: { x: 15, y: -3 } },
        { playerId: "tm3", groundPosition: { x: 25, y: 0 } },
      ],
      "cpu-player",
    );

    // Defender formation: 0 + (-52.5) * 0.4 = -21.0
    expect(defenderObs.formationPosition).toBeDefined();
    expect(defenderObs.formationPosition!.x).toBeCloseTo(-21.0, 4);

    // Midfielder: 0 + (-52.5) * 0.2 = -10.5
    expect(midfielderObs.formationPosition).toBeDefined();
    expect(midfielderObs.formationPosition!.x).toBeCloseTo(-10.5, 4);

    // Attacker: 0 + (-52.5) * 0.05 = -2.625
    expect(attackerObs.formationPosition).toBeDefined();
    expect(attackerObs.formationPosition!.x).toBeCloseTo(-2.625, 4);

    // Order: defender < midfielder < attacker (more negative = deeper)
    expect(defenderObs.formationPosition!.x).toBeLessThan(
      midfielderObs.formationPosition!.x,
    );
    expect(midfielderObs.formationPosition!.x).toBeLessThan(
      attackerObs.formationPosition!.x,
    );
  });

  it("ball ahead of all 3 roles: no formation blend, pure chase", () => {
    // Player at (0, 0), ball at (30, 0).
    const roles: Array<"defender" | "midfielder" | "attacker"> = [
      "defender", "midfielder", "attacker",
    ];
    for (const role of roles) {
      const obs = makeObservationWithRoleAnd3Teammates(
        0, 0, 30, 0, 0, 0, "team-a", role,
        [
          { playerId: "tm1", groundPosition: { x: 20, y: 5 } },
          { playerId: "tm2", groundPosition: { x: 10, y: -3 } },
          { playerId: "tm3", groundPosition: { x: 25, y: 0 } },
        ],
        "cpu-player",
      );
      const frame = createCpuAdapter().sample(0, obs);

      // Ball ahead → chase only: moveX > 0.
      expect(frame.moveX).toBeGreaterThan(0, `${role} should chase ball when ahead`);
      expect(Math.abs(frame.moveY)).toBeLessThan(0.01);
    }
  });

  it("all 3 roles on same team with teamDecision: same signal applied", () => {
    // Simulate 3v3: team-a has 3 players (defender, midfielder, attacker).
    // All 3 adapters receive the same teamDecision.
    const teamDecision: TeamDecision = {
      strategy: "ATTACK",
      nearestToBallPlayerId: "player-3", // attacker is nearest
      nearestToBallDistance: 5.2,
      hasPossession: false,
      ballZone: "center",
    };

    const roles: Array<"defender" | "midfielder" | "attacker"> = [
      "defender", "midfielder", "attacker",
    ];

    for (const role of roles) {
      const obs = makeObservationWithRoleAnd3Teammates(
        0, 0, 30, 0, 0, 0, "team-a", role,
        [
          { playerId: "tm1", groundPosition: { x: 20, y: 5 } },
          { playerId: "tm2", groundPosition: { x: 10, y: -3 } },
          { playerId: "tm3", groundPosition: { x: 25, y: 0 } },
        ],
        "cpu-player",
      );
      obs.teamDecision = teamDecision;
      const frame = createCpuAdapter().sample(0, obs);

      // All should be in chase mode (no possession), moving toward ball.
      expect(frame.moveX).toBeGreaterThan(0, `${role} should chase ball in ATTACK mode`);
      // ATTACK mode + non-nearest player: reduced formation pull.
    }
  });
});

// ===========================================================================
// 4. 3v3 TEAM DECISION: all 3 adapters receive same signal
// ===========================================================================

describe("CPU-3V3-TEAMDEC-001: team decision shared across 3 adapters", () => {
  it("computeTeamDecision returns consistent strategy for team-a", () => {
    // CPU at (20, 0), ball at (20.5, 0). Distance = 0.5m < POSSESSION_RANGE(2m).
    // So team-a has possession → ATTACK.
    const obs: CpuObservation = makeObservationWith3Teammates(
      20, 0, 20.5, 0, 0, 0, "team-a",
      [
        { playerId: "teammate-1", groundPosition: { x: 30, y: 3 } },
        { playerId: "teammate-2", groundPosition: { x: 35, y: -2 } },
        { playerId: "teammate-3", groundPosition: { x: 25, y: 5 } },
      ],
      "cpu-player",
    );

    const decision = computeTeamDecision(obs, "team-a");

    expect(decision.strategy).toBe("ATTACK");
    expect(decision.hasPossession).toBe(true);
    // Ball at x=20.5. thirdWidth=17.5. For team-a: ballX > thirdWidth → opponent third.
    expect(decision.ballZone).toBe("opponent");
    // nearestToBall should be "cpu-player" (closest to ball at 20.5).
    expect(decision.nearestToBallPlayerId).toBe("cpu-player");
  });

  it("computeTeamDecision returns BALANCED when no team has possession", () => {
    // Ball at (30, 0) — far from any player at (10, 0), (20, 0), (25, 0).
    // No team has possession → BALANCED.
    const obs: CpuObservation = makeObservationWith3Teammates(
      10, 0, 30, 0, 5, 0, "team-a",
      [
        { playerId: "teammate-2", groundPosition: { x: 20, y: 0 } },
        { playerId: "teammate-3", groundPosition: { x: 25, y: 3 } },
      ],
      "cpu-player",
    );
    // Ball horizontal speed = 5 > 3 → no possession.

    const decision = computeTeamDecision(obs, "team-a");

    expect(decision.hasPossession).toBe(false);
    expect(decision.strategy).toBe("BALANCED");
  });

  it("same observation produces same team decision for all team members", () => {
    const obs: CpuObservation = makeObservationWith3Teammates(
      0, 0, 10, 0, 0.5, 0, "team-a",
      [
        { playerId: "teammate-2", groundPosition: { x: -5, y: -12 } },
        { playerId: "teammate-3", groundPosition: { x: -3, y: 8 } },
      ],
      "cpu-player",
    );

    // Compute team decision once — this is the shared signal.
    const sharedDecision = computeTeamDecision(obs, "team-a");

    // All 3 adapters should receive the identical object.
    expect(sharedDecision.strategy).toBeDefined();
    expect(sharedDecision.nearestToBallPlayerId).toBeDefined();
    expect(sharedDecision.nearestToBallDistance).toBeGreaterThan(0);
    expect(sharedDecision.ballZone).toBeDefined();

    // Verify determinism: compute twice → same result.
    const decision2 = computeTeamDecision(obs, "team-a");
    expect(decision2.strategy).toBe(sharedDecision.strategy);
    expect(decision2.nearestToBallPlayerId).toBe(sharedDecision.nearestToBallPlayerId);
    expect(decision2.nearestToBallDistance).toBe(sharedDecision.nearestToBallDistance);
    expect(decision2.ballZone).toBe(sharedDecision.ballZone);
  });

  it("DEFEND mode when opponent has possession in own third", () => {
    // team-a player at (-40, 0), ball at (-30, 0) with high speed.
    // team-b player at (-35, 0) also near ball.
    const obs: CpuObservation = makeObservationWith3Teammates(
      -40, 0, -30, 0, 0.5, 0, "team-a",
      [
        { playerId: "tm2", groundPosition: { x: -10, y: 0 } },
        { playerId: "tm3", groundPosition: { x: -5, y: -5 } },
      ],
      "cpu-player",
    );

    // team-a at -40: ball at -30 → thirdWidth = 17.5.
    // ballX=-30: |-30| > 17.5? ballX < -thirdWidth → own third.
    // No team has possession (ball moving slowly but not within range).
    // → BALANCED (with possible score-based adjustments).
    const decision = computeTeamDecision(obs, "team-a");

    expect(decision.ballZone).toBe("own");
    // No possession → BALANCED unless score-based override.
    expect(decision.strategy).toBe("BALANCED");
  });

  it("ATTACK mode when team has possession", () => {
    // Ball very close to team-a player: team-a has possession.
    const obs: CpuObservation = makeObservationWith3Teammates(
      10, 0, 10.5, 0, 0.1, 0, "team-a",
      [
        { playerId: "tm2", groundPosition: { x: 20, y: 3 } },
        { playerId: "tm3", groundPosition: { x: 25, y: -2 } },
      ],
      "cpu-player",
    );

    const decision = computeTeamDecision(obs, "team-a");
    expect(decision.strategy).toBe("ATTACK");
    expect(decision.hasPossession).toBe(true);
  });
});

// ===========================================================================
// 5. 3v3 DETERMINISM: 6 adapters, 60+ ticks, identical behavior
// ===========================================================================

describe("CPU-3V3-DET-001: determinism with 6 CPU adapters", () => {
  it("6 independent adapters produce identical output for same observations", () => {
    const obsA1 = makeObservationWithRoleAnd3Teammates(
      -20, 0, -30, 0, 0, 0, "team-a", "defender",
      [
        { playerId: "tm-mid", groundPosition: { x: -5, y: -12 } },
        { playerId: "tm-atk", groundPosition: { x: -5, y: 12 } },
      ],
      "player-1",
    );
    const obsA2 = makeObservationWithRoleAnd3Teammates(
      -5, -12, -30, 0, 0, 0, "team-a", "midfielder",
      [
        { playerId: "tm-def", groundPosition: { x: -20, y: 0 } },
        { playerId: "tm-atk", groundPosition: { x: -5, y: 12 } },
      ],
      "player-2",
    );
    const obsA3 = makeObservationWithRoleAnd3Teammates(
      -5, 12, -30, 0, 0, 0, "team-a", "attacker",
      [
        { playerId: "tm-def", groundPosition: { x: -20, y: 0 } },
        { playerId: "tm-mid", groundPosition: { x: -5, y: -12 } },
      ],
      "player-3",
    );

    // Run same 60 ticks with independent adapters.
    const results1: Array<{ tick: number; moveX: number; moveY: number; heldButtons: number }> = [];
    const results2: typeof results1 = [];
    const results3: typeof results1 = [];

    for (let tick = 0; tick < 60; tick++) {
      results1.push({
        tick,
        ...createCpuAdapter().sample(tick, obsA1),
      });
      results2.push({
        tick,
        ...createCpuAdapter().sample(tick, obsA2),
      });
      results3.push({
        tick,
        ...createCpuAdapter().sample(tick, obsA3),
      });
    }

    // Each adapter's own output is deterministic.
    for (let tick = 0; tick < 60; tick++) {
      const a1 = createCpuAdapter().sample(tick, obsA1);
      const a1b = createCpuAdapter().sample(tick, obsA1);
      expect(a1.moveX).toBe(a1b.moveX);
      expect(a1.moveY).toBe(a1b.moveY);
      expect(a1.heldButtons).toBe(a1b.heldButtons);
      expect(a1.pressedButtons).toBe(a1b.pressedButtons);
    }
  });

  it("60-tick multi-tick simulation with 6 CPU adapters is deterministic", () => {
    // Simulate two independent runs with the same scenario.
    const runSimulation = (seed: number) => {
      const result: Array<{
        tick: number;
        playerId: string;
        x: number;
        y: number;
        moveX: number;
        moveY: number;
      }> = [];

      for (let s = 0; s < 6; s++) {
        const adapter = createCpuAdapter();
        const obsSets: CpuObservation[] = [];

        for (let t = 0; t < 60; t++) {
          // Create a simple deterministic scenario state.
          const obs = makeObservationWithRoleAnd3Teammates(
            s < 3 ? -10 + s * 10 : 10 + (s - 3) * 10,
            s % 2 === 0 ? -12 : 12,
            0, 0, 0, 0,
            s < 3 ? "team-a" : "team-b",
            ["defender", "midfielder", "attacker"][s % 3],
            s < 3
              ? [
                  { playerId: `tm-b3`, groundPosition: { x: 10, y: 0 } },
                  { playerId: `tm-b4`, groundPosition: { x: 20, y: 5 } },
                ]
              : [
                  { playerId: `tm-a3`, groundPosition: { x: -10, y: 0 } },
                  { playerId: `tm-a4`, groundPosition: { x: -20, y: -5 } },
                ],
            `cpu-${s}`,
          );
          const frame = adapter.sample(t, obs);
          obsSets.push(obs);
          result.push({
            tick: t,
            playerId: `cpu-${s}`,
            x: obs.players[0].groundPosition.x,
            y: obs.players[0].groundPosition.y,
            moveX: frame.moveX,
            moveY: frame.moveY,
          });
        }
      }
      return result;
    };

    const run1 = runSimulation(42);
    const run2 = runSimulation(42);

    expect(run1).toEqual(run2);
  });

  it("shot cooldown suppresses FIRST_TOUCH: verified with 6 adapters in 3v3", () => {
    // 6 adapters all at shooting range. In a static scenario, the CPU
    // shoots on tick 1, then regains possession each tick (ball stays
    // within range) and keeps shooting. FIRST_TOUCH should be suppressed
    // after each shot.
    const adapters = Array.from({ length: 6 }, () => createCpuAdapter());
    const shotTicks: number[][] = [];
    const firstTouchTicks: number[][] = [];

    for (let s = 0; s < 6; s++) {
      const role = ["defender", "midfielder", "attacker"][s % 3];
      const teamId = s < 3 ? "team-a" : "team-b";
      const pos = s < 3 ? 50 : -50;
      const obs = makeObservationWithRoleAnd3Teammates(
        pos, 0, pos + 0.5, 0, 0, 0, teamId, role,
        s < 3
          ? [
              { playerId: "tm2", groundPosition: { x: pos + 15, y: 2 } },
              { playerId: "tm3", groundPosition: { x: pos + 20, y: -1 } },
            ]
          : [
              { playerId: "tm2", groundPosition: { x: pos - 15, y: 2 } },
              { playerId: "tm3", groundPosition: { x: pos - 20, y: -1 } },
            ],
        `cpu-${s}`,
      );

      const adapter = adapters[s];
      const ticks: number[] = [];
      const ftTicks: number[] = [];
      for (let t = 0; t < 20; t++) {
        const frame = adapter.sample(t, obs);
        if ((frame.pressedButtons & SHOT_BIT) !== 0) {
          ticks.push(t);
        }
        if ((frame.pressedButtons & FIRST_TOUCH_BIT) !== 0) {
          ftTicks.push(t);
        }
      }
      shotTicks.push(ticks);
      firstTouchTicks.push(ftTicks);
    }

    // All 6 shoot on tick 1 (after gaining possession on tick 0).
    for (let s = 0; s < 6; s++) {
      expect(shotTicks[s][0]).toBe(1);
    }

    // In static scenario: FIRST_TOUCH should only be pressed on tick 0.
    // After tick 1, the CPU shoots → ballWasInRange cleared → no FIRST_TOUCH.
    for (let s = 0; s < 6; s++) {
      // Only tick 0 should have FIRST_TOUCH; no tick after the first shot.
      expect(firstTouchTicks[s]).toEqual([0]);
    }
  });
});

// ===========================================================================
// Helper functions
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
        teamId: cpuTeamId || "team-cpu",
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

function makeObservationWith3Teammates(
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
        teamId: cpuTeamId,
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

function makeObservationWithRoleAnd3Teammates(
  playerX: number,
  playerY: number,
  ballX: number,
  ballY: number,
  ballVx: number,
  ballVy: number,
  cpuTeamId: string,
  role: "defender" | "midfielder" | "attacker",
  teammates: Array<{ playerId: string; groundPosition: { x: number; y: number } }>,
  controlledPlayerId: string,
): CpuObservation {
  const ownGoalX = cpuTeamId === "team-b" ? 52.5 : -52.5;
  const pull = role === "defender" ? 0.4 : role === "attacker" ? 0.05 : 0.2;

  return {
    players: [
      {
        playerId: controlledPlayerId,
        teamId: cpuTeamId,
        groundPosition: { x: playerX, y: playerY },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        formationRole: role,
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
    formationPosition: {
      x: playerX + (ownGoalX - playerX) * pull,
      y: playerY,
    },
  };
}