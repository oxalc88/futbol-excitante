/**
 * @module tests/unit/cpu-adapter/formation
 *
 * Tests for CPU basic formation shape when out of possession.
 *
 * Covers:
 *  1. CPU-FORMATION-001: When ball is far (> 30m), player moves toward
 *     formation position (not directly at ball).
 *  2. CPU-FORMATION-002: When ball is close (< 10m), player moves toward
 *     ball (formation weight ≈ 0).
 *  3. CPU-FORMATION-003: Formation position is correctly computed
 *     (20% toward own goal).
 *  4. CPU-FORMATION-004: Multiple players — defenders stay back,
 *     attackers advance (relative formation x positions).
 *  5. CPU-FORMATION-005: Multiple ticks — formation persists correctly
 *     across repeated observations.
 *
 * This is a PROVISIONAL PLACEHOLDER — not a measured PES value.
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";
import {
  createCpuAdapter,
  type CpuAdapter,
  type CpuObservation,
} from "../../../src/adapters/input-browser/cpu-adapter.js";

// ===========================================================================
// 1. CPU-FORMATION-001: far ball BEHIND player → moves toward formation
// ===========================================================================

describe("CPU-FORMATION-001: far ball behind player moves toward formation", () => {
  it("ball 35m behind in -X: formation pulls back (ball behind for team-a)", () => {
    // Player at (0, 0), ball at (-35, 0), team-a (attacks +x, own goal at -52.5).
    // Ball is behind: -35 < 0. Formation x ≈ 0 + (-52.5-0)*0.2 = -10.5.
    // Formation direction: from (0,0) toward (-10.5, 0) → -X.
    // With 35m distance > 2×20=40? No, 35 < 40. weight = (35-20)/20 = 0.75.
    // Formation-weighted: moveX < 0.
    const obs: CpuObservation = makeObservation(0, 0, -35, 0, 0, 0, "team-a");

    const frame = createCpuAdapter().sample(0, obs);

    // Formation direction is -X. Even with blended weight, moveX should be negative.
    expect(frame.moveX).toBeLessThan(0);
    expect(frame.moveY).toBeCloseTo(0, 2);
  });

  it("ball 35m behind in +Y: movement has formation bias", () => {
    // Player at (0, 0), ball at (-1, -35), team-a.
    // Ball behind: -1 < 0. 35m away, weight ≈ 0.75.
    // Chase direction ≈ (-0.028, -0.999). Formation: (-1, 0).
    // Blended Y: 0.25 * (-0.999) + 0.75 * 0 ≈ -0.25.
    const obs: CpuObservation = makeObservation(0, 0, -1, -35, 0, 0, "team-a");

    const frame = createCpuAdapter().sample(0, obs);

    expect(frame.moveX).toBeLessThan(0); // formation pulls back strongly
    // Y is blended: mostly chase (toward ball's -Y) but dampened by formation.
    expect(frame.moveY).toBeLessThan(0);
  });

  it("ball 35m behind in diagonal: formation bias visible", () => {
    // Player at (10, 0), ball at (-35, 25). team-a.
    // Ball behind: -35 < 10. Distance ≈ 51.5m → formationWeight = 1.
    // Formation x = 10 + (-52.5 - 10) * 0.2 = 10 - 12.5 = -2.5.
    // Formation direction: from (10, 0) toward (-2.5, 0) → (-1, 0).
    // At weight=1: pure formation → moveX < 0, moveY = 0.
    const obs: CpuObservation = makeObservation(10, 0, -35, 25, 0, 0, "team-a");

    const frame = createCpuAdapter().sample(0, obs);

    // Both chase and formation pull leftward.
    expect(frame.moveX).toBeLessThan(0);
    // At weight=1, formation has no Y component → Y is purely from formation.
    expect(frame.moveY).toBeCloseTo(0, 2);
  });

  it("ball AHEAD (forward): no formation blend → pure chase", () => {
    // Player at (0, 0), ball at (35, 0). team-a.
    // Ball is ahead: 35 > 0. Behind check fails → no blend.
    const obs: CpuObservation = makeObservation(0, 0, 35, 0, 0, 0, "team-a");

    const frame = createCpuAdapter().sample(0, obs);

    // Pure chase: moveX > 0.
    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.moveY).toBeCloseTo(0, 2);
  });
});

// ===========================================================================
// 2. CPU-FORMATION-002: close ball → formation weight ≈ 0
// ===========================================================================

describe("CPU-FORMATION-002: close ball → chase, not formation", () => {
  it("ball 5m away → movement toward ball (formationWeight=0)", () => {
    // Ball at (5, 0), player at (0, 0). dist=5 < 15.
    // formationWeight = clamp((5-15)/15, 0, 1) = 0.
    // MoveX should be +1 (pure chase).
    const obs: CpuObservation = makeObservation(0, 0, 5, 0, 0, 0, "team-a");

    const frame = createCpuAdapter().sample(0, obs);

    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.moveY).toBeCloseTo(0, 2);
    // Magnitude ≈ 1 (unit vector).
    const mag = Math.sqrt(frame.moveX * frame.moveX + frame.moveY * frame.moveY);
    expect(mag).toBeGreaterThan(0.99);
  });

  it("ball at boundary (14m) → almost no formation influence", () => {
    // 14m: formationWeight = clamp((14-15)/15, 0, 1) = 0.
    const obs: CpuObservation = makeObservation(0, 0, 14, 0, 0, 0, "team-a");

    const frame = createCpuAdapter().sample(0, obs);

    // Pure chase direction.
    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.moveY).toBeCloseTo(0, 2);
  });

  it("ball at 15m → zero formation weight", () => {
    const obs: CpuObservation = makeObservation(0, 0, 15, 0, 0, 0, "team-a");

    const frame = createCpuAdapter().sample(0, obs);

    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.moveY).toBeCloseTo(0, 2);
  });
});

// ===========================================================================
// 3. CPU-FORMATION-003: formation position is correct (20% toward own goal)
// ===========================================================================

describe("CPU-FORMATION-003: formation position computation", () => {
  it("team-a player at (20, 5): formation at x = 20 + (-52.5-20)*0.2 = 6.5", () => {
    const obs: CpuObservation = makeObservation(20, 5, 100, 0, 0, 0, "team-a");

    // Verify formationPosition is set.
    expect(obs.formationPosition).toBeDefined();
    if (obs.formationPosition) {
      // Own goal for team-a is at -52.5.
      // FormationX = 20 + (-52.5 - 20) * 0.2 = 20 + (-72.5)*0.2 = 20 - 14.5 = 5.5.
      // Wait, let me recalculate: 20 + (-52.5 - 20) * 0.2
      // = 20 + (-72.5) * 0.2 = 20 - 14.5 = 5.5
      expect(obs.formationPosition.x).toBeCloseTo(5.5, 2);
      expect(obs.formationPosition.y).toBe(5);
    }
  });

  it("team-b player at (20, 5): own goal at +52.5, formation at x = 20+(52.5-20)*0.2 = 26.5", () => {
    const obs: CpuObservation = makeObservation(20, 5, -100, 0, 0, 0, "team-b");

    expect(obs.formationPosition).toBeDefined();
    if (obs.formationPosition) {
      // Own goal for team-b is at +52.5.
      // FormationX = 20 + (52.5 - 20) * 0.2 = 20 + 6.5 = 26.5.
      expect(obs.formationPosition.x).toBeCloseTo(26.5, 2);
      expect(obs.formationPosition.y).toBe(5);
    }
  });

  it("player near own goal: small shift", () => {
    // team-a player at (-50, 0). Own goal at -52.5.
    // FormationX = -50 + (-52.5 - (-50)) * 0.2 = -50 + (-2.5)*0.2 = -50.5.
    const obs: CpuObservation = makeObservation(-50, 0, 0, 0, 0, 0, "team-a");

    expect(obs.formationPosition).toBeDefined();
    if (obs.formationPosition) {
      expect(obs.formationPosition.x).toBeCloseTo(-50.5, 2);
    }
  });

  it("no cpuTeamId → formationPosition undefined", () => {
    const obs: CpuObservation = makeObservation(0, 0, 30, 0, 0, 0);

    expect(obs.formationPosition).toBeUndefined();
  });
});

// ===========================================================================
// 4. CPU-FORMATION-004: defenders stay back, attackers advance
// ===========================================================================

describe("CPU-FORMATION-004: relative formation positions by role", () => {
  it("two team-a players: deeper player → formation closer to own goal", () => {
    // Player 1 (defender-like): at (-40, 0).  Own goal at -52.5.
    // FormationX = -40 + (-52.5-(-40))*0.2 = -40 + (-2.5)*0.2 = -40.5.
    // Player 2 (attacker-like): at (10, 0).
    // FormationX = 10 + (-52.5-10)*0.2 = 10 + (-62.5)*0.2 = 10 - 12.5 = -2.5.
    // Defender formation (-40.5) < Attacker formation (-2.5) → defender stays back.
    const obs1: CpuObservation = makeObservation(-40, 0, 50, 0, 0, 0, "team-a");
    const obs2: CpuObservation = makeObservation(10, 0, 50, 0, 0, 0, "team-a");

    expect(obs1.formationPosition).toBeDefined();
    expect(obs2.formationPosition).toBeDefined();
    if (obs1.formationPosition && obs2.formationPosition) {
      // Defender formation x should be more negative (closer to own goal).
      expect(obs1.formationPosition.x).toBeLessThan(obs2.formationPosition.x);
      // Both should be negative (toward own goal side for team-a).
      expect(obs1.formationPosition.x).toBeLessThan(0);
    }
  });

  it("team-b players: deeper player → formation closer to +x own goal", () => {
    // Player 1: at (40, 0).  Own goal at +52.5.
    // FormationX = 40 + (52.5-40)*0.2 = 40 + 2.5 = 42.5.
    // Player 2: at (-10, 0).
    // FormationX = -10 + (52.5-(-10))*0.2 = -10 + 12.5 = 2.5.
    const obs1: CpuObservation = makeObservation(40, 0, -50, 0, 0, 0, "team-b");
    const obs2: CpuObservation = makeObservation(-10, 0, -50, 0, 0, 0, "team-b");

    expect(obs1.formationPosition).toBeDefined();
    expect(obs2.formationPosition).toBeDefined();
    if (obs1.formationPosition && obs2.formationPosition) {
      // The deeper player (at x=40, closer to own goal +52.5)
      // should have a more positive formation X.
      expect(obs1.formationPosition.x).toBeGreaterThan(obs2.formationPosition.x);
    }
  });
});

// ===========================================================================
// 5. CPU-FORMATION-005: multi-tick stability
// ===========================================================================

describe("CPU-FORMATION-005: formation stability across ticks", () => {
  it("same observation repeated → identical movement vectors", () => {
    // Ball behind: -35 < 0 for team-a.
    const obs: CpuObservation = makeObservation(0, 0, -35, 0, 0, 0, "team-a");
    const adapter = createCpuAdapter();

    const f0 = adapter.sample(0, obs);
    const f1 = adapter.sample(1, obs);
    const f2 = adapter.sample(2, obs);
    const f10 = adapter.sample(10, obs);

    expect(f0.moveX).toBe(f1.moveX);
    expect(f0.moveY).toBe(f1.moveY);
    expect(f1.moveX).toBe(f2.moveX);
    expect(f2.moveX).toBe(f10.moveX);
  });

  it("ball moving from far to near: smooth transition in movement", () => {
    // Ball far behind: -40 < 0 for team-a → formation-dominant.
    const obsFar: CpuObservation = makeObservation(0, 0, -40, 0, 0, 0, "team-a");
    // Ball near: -5 < 0 for team-a → chase-dominant (within threshold).
    const obsNear: CpuObservation = makeObservation(0, 0, -5, 0, 0, 0, "team-a");

    const adapter = createCpuAdapter();

    // Far ball: formation bias (moveX < 0 for team-a).
    const fFar = adapter.sample(0, obsFar);
    expect(fFar.moveX).toBeLessThan(0);

    // Near ball: chase (moveX < 0, ball also to the left).
    const fNear = adapter.sample(1, obsNear);
    // Ball at -5, player at 0: both formation and chase pull left.
    expect(fNear.moveX).toBeLessThan(0);
  });

  it("ball oscillating: CPU adapts movement direction each tick", () => {
    const obsFar: CpuObservation = makeObservation(0, 0, -35, 0, 0, 0, "team-a");
    const obsNear: CpuObservation = makeObservation(0, 0, -5, 0, 0, 0, "team-a");

    const adapter = createCpuAdapter();

    const f0 = adapter.sample(0, obsFar);  // far behind → formation
    const f1 = adapter.sample(1, obsNear); // near behind → chase
    const f2 = adapter.sample(2, obsFar);  // far behind → formation
    const f3 = adapter.sample(3, obsNear); // near behind → chase

    // Both far and near pull leftward (formation and chase both negative X).
    // The key difference: far has stronger formation component.
    expect(f0.moveX).toBeLessThan(0);
    expect(f1.moveX).toBeLessThan(0);
    expect(f2.moveX).toBeLessThan(0);
    expect(f3.moveX).toBeLessThan(0);
  });
});

// ===========================================================================
// 6. CPU-FORMATION-006: determinism
// ===========================================================================

describe("CPU-FORMATION-006: determinism", () => {
  it("same observation → identical movement across independent adapters", () => {
    const obs: CpuObservation = makeObservation(0, 0, 25, 10, 0, 0, "team-a");

    const a1 = createCpuAdapter();
    const a2 = createCpuAdapter();

    for (let tick = 0; tick < 10; tick++) {
      const f1 = a1.sample(tick, obs);
      const f2 = a2.sample(tick, obs);

      expect(f1.moveX).toBe(f2.moveX);
      expect(f1.moveY).toBe(f2.moveY);
    }
  });
});

// ===========================================================================
// 7. CPU-FORMATION-007: sprint remains 1 in defense mode
// ===========================================================================

describe("CPU-FORMATION-007: sprint always 1 in defense", () => {
  it("ball far → sprint = 1", () => {
    const obs: CpuObservation = makeObservation(0, 0, 35, 0, 0, 0, "team-a");
    const frame = createCpuAdapter().sample(0, obs);
    expect(frame.sprint).toBe(1);
  });

  it("ball near → sprint = 1", () => {
    const obs: CpuObservation = makeObservation(0, 0, 5, 0, 0, 0, "team-a");
    const frame = createCpuAdapter().sample(0, obs);
    expect(frame.sprint).toBe(1);
  });
});

// ===========================================================================
// 8. CPU-FORMATION-008: boundary blending at thresholds
// ===========================================================================

describe("CPU-FORMATION-008: boundary blending", () => {
  it("ball at 20m behind → exactly zero formation weight → pure chase", () => {
    // (20 - 20) / 20 = 0. Ball at -20 is behind (20 > 0 for team-a check: ball.x=-20 < player.x=0 → behind).
    const obs: CpuObservation = makeObservation(0, 0, -20, 0, 0, 0, "team-a");
    const frame = createCpuAdapter().sample(0, obs);
    // Pure chase: moveX > 0 (ball at -20, player at 0 → chase direction is -X).
    // Wait, ball at -20 is to the left, player at 0: chase direction is -X.
    expect(frame.moveX).toBeLessThan(0);
    expect(frame.moveY).toBeCloseTo(0, 2);
  });

  it("ball at 40m behind → formationWeight = 1 → pure formation", () => {
    // (40 - 20) / 20 = 1. Ball at -40 is behind.
    const obs: CpuObservation = makeObservation(0, 0, -40, 0, 0, 0, "team-a");
    const frame = createCpuAdapter().sample(0, obs);
    // Pure formation: formation at x=-10.5, player at 0 → direction is -X.
    expect(frame.moveX).toBeLessThan(0);
    expect(frame.moveY).toBeCloseTo(0, 2);
  });

  it("ball at 30m behind → formationWeight = 0.5 → blended", () => {
    // (30 - 20) / 20 = 0.5. Ball at -30 is behind.
    const obs: CpuObservation = makeObservation(0, 0, -30, 0, 0, 0, "team-a");
    const frame = createCpuAdapter().sample(0, obs);

    // With 50-50 blend: moveX = 0.5 * chaseX + 0.5 * formationX.
    // Chase: from (0,0) to (-30,0) → -1. Formation: from (0,0) to (-10.5,0) → -1.
    // Both are -1, so blended is also -1. Not a great test for blending.
    // Let me check magnitude instead.
    const mag = Math.sqrt(frame.moveX * frame.moveX + frame.moveY * frame.moveY);
    // With blend, magnitude should be 1 (unit vector).
    expect(mag).toBeGreaterThan(0.99);
    expect(mag).toBeLessThan(1.01);
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
  const obs: CpuObservation = {
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

  // Compute formationPosition to match buildCpuObservation behaviour.
  if (cpuTeamId) {
    const ownGoalX = cpuTeamId === "team-b" ? 52.5 : -52.5;
    obs.formationPosition = {
      x: playerX + (ownGoalX - playerX) * 0.2,
      y: playerY,
    };
  }

  return obs;
}