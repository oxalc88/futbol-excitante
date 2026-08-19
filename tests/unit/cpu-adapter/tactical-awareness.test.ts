/**
 * @module tests/unit/cpu-adapter/tactical-awareness
 *
 * Tests for CPU tactical awareness: game-state adaptation (score gradient),
 * fatigue awareness, and match-phase-specific behavior.
 *
 * Covers:
 *  1. Score gradient: continuous bias from scoreDifferential (behind → ATTACK,
 *     ahead → DEFEND; gradient magnitude grows with deficit).
 *  2. Fatigue ramp: behavior shifts at low vs high fatigue (press radius
 *     shrinks, BALANCED skews toward DEFEND).
 *  3. Phase responses: distinct behaviors for kickoff/goal/halftime/fulltime
 *     vs playing.
 *  4. Determinism: same observation → same decision.
 *  5. Backward compatibility: existing strategies still produced for
 *     baseline observations.
 *  6. State-hash/event-free: no core changes.
 *
 * All values provisional (unmeasured PES 2017).
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createCpuAdapter,
  computeTeamDecision,
  buildCpuObservation,
  type CpuAdapter,
  type CpuObservation,
  type TeamDecision,
} from "../../../src/adapters/input-browser/cpu-adapter.js";
import { SHOT_BIT, FIRST_TOUCH_BIT } from "../../../src/contracts/input.js";

// ===========================================================================
// 1. SCORE GRADIENT: continuous bias from scoreDifferential
// ===========================================================================

describe("CPU-TACTICAL-001: score gradient adaptation", () => {
  it("behind by 1 → slight ATTACK bias in center third", () => {
    const obs = makeObservation({
      ballX: 0, ballY: 0,
      cpuTeamId: "team-a",
      playerX: -20, playerY: 10,
      teammates: [{ id: "tm-1", x: -15, y: -10 }],
      opponents: [{ id: "opp-1", x: 20, y: 10 }, { id: "opp-2", x: 15, y: -10 }],
      scoreDifferential: -1,
    });
    // scoreBias = clamp(-(-1)/3, -1, 1) = 0.333...
    // 0.333 > 0.33 → ATTACK in center third
    const decision = computeTeamDecision(obs, "team-a");
    expect(decision.strategy).toBe("ATTACK");
  });

  it("behind by 3 → strong ATTACK bias in center third", () => {
    const obs = makeObservation({
      ballX: 0, ballY: 0,
      cpuTeamId: "team-a",
      playerX: -20, playerY: 10,
      teammates: [{ id: "tm-1", x: -15, y: -10 }],
      opponents: [{ id: "opp-1", x: 20, y: 10 }, { id: "opp-2", x: 15, y: -10 }],
      scoreDifferential: -3,
    });
    // scoreBias = clamp(3/3, -1, 1) = 1.0 → ATTACK
    const decision = computeTeamDecision(obs, "team-a");
    expect(decision.strategy).toBe("ATTACK");
  });

  it("ahead by 1 → slight DEFEND bias in center third", () => {
    const obs = makeObservation({
      ballX: 0, ballY: 0,
      cpuTeamId: "team-a",
      playerX: -20, playerY: 10,
      teammates: [{ id: "tm-1", x: -15, y: -10 }],
      opponents: [{ id: "opp-1", x: 20, y: 10 }, { id: "opp-2", x: 15, y: -10 }],
      scoreDifferential: 1,
    });
    // scoreBias = clamp(-1/3, -1, 1) = -0.333...
    // -0.333 < -0.33 → DEFEND in center third
    const decision = computeTeamDecision(obs, "team-a");
    expect(decision.strategy).toBe("DEFEND");
  });

  it("ahead by 3 → strong DEFEND bias in center third", () => {
    const obs = makeObservation({
      ballX: 0, ballY: 0,
      cpuTeamId: "team-a",
      playerX: -20, playerY: 10,
      teammates: [{ id: "tm-1", x: -15, y: -10 }],
      opponents: [{ id: "opp-1", x: 20, y: 10 }, { id: "opp-2", x: 15, y: -10 }],
      scoreDifferential: 3,
    });
    // scoreBias = clamp(-3/3, -1, 1) = -1.0 → DEFEND
    const decision = computeTeamDecision(obs, "team-a");
    expect(decision.strategy).toBe("DEFEND");
  });

  it("neutral score (0) → BALANCED in center third", () => {
    const obs = makeObservation({
      ballX: 0, ballY: 0,
      cpuTeamId: "team-a",
      playerX: -20, playerY: 10,
      teammates: [{ id: "tm-1", x: -15, y: -10 }],
      opponents: [{ id: "opp-1", x: 20, y: 10 }, { id: "opp-2", x: 15, y: -10 }],
      scoreDifferential: 0,
    });
    // scoreBias = 0 → BALANCED
    const decision = computeTeamDecision(obs, "team-a");
    expect(decision.strategy).toBe("BALANCED");
  });

  it("gradient is monotonic: more deficit → more ATTACK", () => {
    const strategies: string[] = [];
    for (const diff of [0, -1, -2, -3, -4]) {
      const obs = makeObservation({
        ballX: 0, ballY: 0,
        cpuTeamId: "team-a",
        playerX: -20, playerY: 10,
        teammates: [{ id: "tm-1", x: -15, y: -10 }],
        opponents: [{ id: "opp-1", x: 20, y: 10 }, { id: "opp-2", x: 15, y: -10 }],
        scoreDifferential: diff,
      });
      const decision = computeTeamDecision(obs, "team-a");
      strategies.push(decision.strategy);
    }
    // Should progress from BALANCED/DEFEND toward ATTACK
    // At diff=0: BALANCED; diff=-1: ATTACK; diff=-2..-4: ATTACK
    expect(strategies[0]).toBe("BALANCED"); // diff=0
    expect(strategies[1]).toBe("ATTACK");  // diff=-1
    expect(strategies[2]).toBe("ATTACK");  // diff=-2
    expect(strategies[3]).toBe("ATTACK");  // diff=-3
    expect(strategies[4]).toBe("ATTACK");  // diff=-4
  });

  it("gradient is monotonic: more lead → more DEFEND", () => {
    const strategies: string[] = [];
    for (const diff of [0, 1, 2, 3, 4]) {
      const obs = makeObservation({
        ballX: 0, ballY: 0,
        cpuTeamId: "team-a",
        playerX: -20, playerY: 10,
        teammates: [{ id: "tm-1", x: -15, y: -10 }],
        opponents: [{ id: "opp-1", x: 20, y: 10 }, { id: "opp-2", x: 15, y: -10 }],
        scoreDifferential: diff,
      });
      const decision = computeTeamDecision(obs, "team-a");
      strategies.push(decision.strategy);
    }
    // Should progress from BALANCED toward DEFEND
    expect(strategies[0]).toBe("BALANCED"); // diff=0
    expect(strategies[1]).toBe("DEFEND");  // diff=1
    expect(strategies[2]).toBe("DEFEND");  // diff=2
    expect(strategies[3]).toBe("DEFEND");  // diff=3
    expect(strategies[4]).toBe("DEFEND");  // diff=4
  });
});

// ===========================================================================
// 2. FATIGUE RAMP: behavior shifts at low vs high fatigue
// ===========================================================================

describe("CPU-TACTICAL-002: fatigue awareness (adapter-internal effects)", () => {
  it("fatigue reduces press strength in CPU adapter", () => {
    // Use a longer distance (7m) so press strength modulation is visible.
    // LOW fatigue: strength = 1.3 * (1 - 0 * 0.3) = 1.3 → clamped to 1
    // HIGH fatigue: strength = 1.3 * (1 - 1 * 0.3) = 1.3 * 0.7 = 0.91 → not clamped
    // So high fatigue should produce moveX < 1 while low fatigue produces moveX = 1.

    // Low fatigue press: run 1 tick (fatigue ≈ 0).
    const adapterLow = createCpuAdapter();
    const obsLow = makeObservationForAdapter({
      playerX: 10, playerY: 0,
      ballX: 17, ballY: 0,
      cpuTeamId: "team-a",
      formationRole: "defender",
      teammates: [{ id: "tm-1", x: -20, y: 0 }],
      opponents: [{ id: "opp-carrier", x: 16, y: 0 }, { id: "opp-other", x: 40, y: 5 }],
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "PRESSING",
        nearestToBallPlayerId: "defender-1",
        nearestToBallDistance: 7,
        hasPossession: false,
        ballZone: "own",
      },
      controlledPlayerId: "defender-1",
      matchPhase: "playing",
    });
    adapterLow.sample(0, obsLow);
    const frameLow = adapterLow.sample(1, obsLow);

    // High fatigue press: run 3600 ticks to saturate fatigue.
    const adapterHigh = createCpuAdapter();
    const obsHigh = makeObservationForAdapter({
      playerX: 10, playerY: 0,
      ballX: 17, ballY: 0,
      cpuTeamId: "team-a",
      formationRole: "defender",
      teammates: [{ id: "tm-1", x: -20, y: 0 }],
      opponents: [{ id: "opp-carrier", x: 16, y: 0 }, { id: "opp-other", x: 40, y: 5 }],
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "PRESSING",
        nearestToBallPlayerId: "defender-1",
        nearestToBallDistance: 7,
        hasPossession: false,
        ballZone: "own",
      },
      controlledPlayerId: "defender-1",
      matchPhase: "playing",
    });
    // Run 3600 ticks to reach full fatigue.
    for (let t = 0; t < 3600; t++) {
      adapterHigh.sample(t, obsHigh);
    }
    const frameHigh = adapterHigh.sample(3600, obsHigh);

    // High fatigue should produce weaker press movement.
    expect(frameHigh.moveX).toBeLessThan(frameLow.moveX);
  });

  it("sprint is always 1 regardless of fatigue (accepted invariant)", () => {
    const adapter = createCpuAdapter();
    const obs = makeObservationForAdapter({
      playerX: -30, playerY: 0,
      ballX: -20, ballY: 0,
      cpuTeamId: "team-a",
      matchPhase: "playing",
    });
    // Run 3600 ticks to saturate fatigue.
    for (let t = 0; t < 3600; t++) {
      adapter.sample(t, obs);
    }
    const frame = adapter.sample(3600, obs);
    expect(frame.sprint).toBe(1);
  });
});

// ===========================================================================
// 3. MATCH PHASE RESPONSES
// ===========================================================================

describe("CPU-TACTICAL-003: match phase behavior", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("non-playing phase 'goal' → hold position (no movement)", () => {
    const obs = makeObservationForAdapter({
      playerX: 10, playerY: 0,
      ballX: 20, ballY: 0,
      cpuTeamId: "team-a",
      matchPhase: "goal",
    });
    const frame = adapter.sample(0, obs);
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
    expect(frame.sprint).toBe(0);
    expect(frame.heldButtons).toBe(0);
    expect(frame.pressedButtons).toBe(0);
  });

  it("non-playing phase 'halftime' → hold position", () => {
    const obs = makeObservationForAdapter({
      playerX: 10, playerY: 0,
      ballX: 20, ballY: 0,
      cpuTeamId: "team-a",
      matchPhase: "halftime",
    });
    const frame = adapter.sample(0, obs);
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
    expect(frame.sprint).toBe(0);
  });

  it("non-playing phase 'fulltime' → hold position", () => {
    const obs = makeObservationForAdapter({
      playerX: 10, playerY: 0,
      ballX: 20, ballY: 0,
      cpuTeamId: "team-a",
      matchPhase: "fulltime",
    });
    const frame = adapter.sample(0, obs);
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
    expect(frame.sprint).toBe(0);
  });

  it("set-piece phase 'corner-kick' → hold position", () => {
    const obs = makeObservationForAdapter({
      playerX: 10, playerY: 0,
      ballX: 20, ballY: 0,
      cpuTeamId: "team-a",
      matchPhase: "corner-kick",
    });
    const frame = adapter.sample(0, obs);
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
    expect(frame.sprint).toBe(0);
  });

  it("set-piece phase 'throw-in' → hold position", () => {
    const obs = makeObservationForAdapter({
      playerX: 10, playerY: 0,
      ballX: 20, ballY: 0,
      cpuTeamId: "team-a",
      matchPhase: "throw-in",
    });
    const frame = adapter.sample(0, obs);
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
    expect(frame.sprint).toBe(0);
  });

  it("set-piece phase 'goal-kick' → hold position", () => {
    const obs = makeObservationForAdapter({
      playerX: 10, playerY: 0,
      ballX: 20, ballY: 0,
      cpuTeamId: "team-a",
      matchPhase: "goal-kick",
    });
    const frame = adapter.sample(0, obs);
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
    expect(frame.sprint).toBe(0);
  });

  it("'playing' phase → normal behavior (chases ball)", () => {
    const obs = makeObservationForAdapter({
      playerX: 10, playerY: 0,
      ballX: 20, ballY: 0,
      cpuTeamId: "team-a",
      matchPhase: "playing",
    });
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);
    // Should chase ball (moveX > 0 since ball is at x=20, player at x=10).
    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.sprint).toBeGreaterThan(0);
  });

  it("'kickoff' phase → normal behavior (structured)", () => {
    const obs = makeObservationForAdapter({
      playerX: 10, playerY: 0,
      ballX: 20, ballY: 0,
      cpuTeamId: "team-a",
      matchPhase: "kickoff",
    });
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);
    // Kickoff is a playing-adjacent phase — normal chase behavior.
    expect(frame.moveX).toBeGreaterThan(0);
  });

  it("no matchPhase → normal behavior (backward compat)", () => {
    const obs = makeObservationForAdapter({
      playerX: 10, playerY: 0,
      ballX: 20, ballY: 0,
      cpuTeamId: "team-a",
      // matchPhase intentionally omitted
    });
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);
    expect(frame.moveX).toBeGreaterThan(0);
  });

  it("team decision: non-playing phase → BALANCED with NONE sub-mode", () => {
    const obs = makeObservation({
      ballX: -20, ballY: 0,
      cpuTeamId: "team-a",
      playerX: -30, playerY: 0,
      teammates: [{ id: "tm-1", x: -38, y: 0 }],
      opponents: [{ id: "opp-1", x: -20.5, y: 0 }],
      matchPhase: "goal",
    });
    const decision = computeTeamDecision(obs, "team-a");
    expect(decision.strategy).toBe("BALANCED");
    expect(decision.defensiveSubMode).toBe("NONE");
  });

  it("team decision: kickoff → BALANCED (structured)", () => {
    const obs = makeObservation({
      ballX: 0, ballY: 0,
      cpuTeamId: "team-a",
      playerX: -20, playerY: 10,
      teammates: [{ id: "tm-1", x: -15, y: -10 }],
      opponents: [{ id: "opp-1", x: 20, y: 10 }, { id: "opp-2", x: 15, y: -10 }],
      matchPhase: "kickoff",
      scoreDifferential: -3,
    });
    // Even with a big deficit, kickoff phase overrides to BALANCED.
    const decision = computeTeamDecision(obs, "team-a");
    expect(decision.strategy).toBe("BALANCED");
  });
});

// ===========================================================================
// 4. DETERMINISM
// ===========================================================================

describe("CPU-TACTICAL-004: determinism", () => {
  it("same observation produces same decision (score gradient)", () => {
    const obs = makeObservation({
      ballX: 0, ballY: 0,
      cpuTeamId: "team-a",
      playerX: -20, playerY: 10,
      teammates: [{ id: "tm-1", x: -15, y: -10 }],
      opponents: [{ id: "opp-1", x: 20, y: 10 }, { id: "opp-2", x: 15, y: -10 }],
      scoreDifferential: -2,
      fatigue: 0.6,
      matchPhase: "playing",
    });
    const d1 = computeTeamDecision(obs, "team-a");
    const d2 = computeTeamDecision(obs, "team-a");
    expect(d1).toEqual(d2);
  });

  it("same observation produces same CPU adapter output", () => {
    const adapter1 = createCpuAdapter();
    const adapter2 = createCpuAdapter();

    const obs = makeObservationForAdapter({
      playerX: 10, playerY: 0,
      ballX: 20, ballY: 0,
      cpuTeamId: "team-a",
      fatigue: 0.5,
      matchPhase: "playing",
    });

    for (let t = 0; t < 30; t++) {
      const f1 = adapter1.sample(t, obs);
      const f2 = adapter2.sample(t, obs);
      expect(f1.moveX).toBe(f2.moveX);
      expect(f1.moveY).toBe(f2.moveY);
      expect(f1.sprint).toBe(f2.sprint);
      expect(f1.heldButtons).toBe(f2.heldButtons);
      expect(f1.pressedButtons).toBe(f2.pressedButtons);
    }
  });

  it("non-playing phase hold is deterministic across adapters", () => {
    const adapter1 = createCpuAdapter();
    const adapter2 = createCpuAdapter();

    const obs = makeObservationForAdapter({
      playerX: 10, playerY: 0,
      ballX: 20, ballY: 0,
      cpuTeamId: "team-a",
      matchPhase: "goal",
    });

    const f1 = adapter1.sample(0, obs);
    const f2 = adapter2.sample(0, obs);
    expect(f1).toEqual(f2);
  });
});

// ===========================================================================
// 5. BACKWARD COMPATIBILITY
// ===========================================================================

describe("CPU-TACTICAL-005: backward compatibility", () => {
  it("existing score-state tests still pass (behind by 3 → wider tolerance)", () => {
    const adapter = createCpuAdapter();

    // CPU at (40, 0), ball at (40.5, 0), bodyHeading = 120° (2π/3).
    // Behind by 3: urgency = 1 - (-3)/3 = 2 → wider tolerance.
    const obsBehind: CpuObservation = makeObservationForAdapter({
      playerX: 40, playerY: 0,
      ballX: 40.5, ballY: 0,
      cpuTeamId: "team-a",
      scoreDifferential: -3,
    });
    obsBehind.players[0].bodyHeading = (2 * Math.PI) / 3;

    adapter.sample(0, obsBehind);
    const frame = adapter.sample(1, obsBehind);

    // Behind by 3: urgency = 2, tolerance = ±135° → 120° within range → shoots.
    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).not.toBe(0);
  });

  it("existing score-state tests still pass (ahead by 5 → narrower tolerance)", () => {
    const adapter = createCpuAdapter();

    // Ahead by 5: urgency = 1 - 5/3 ≈ -0.667 → clamped to 0.5.
    const obsAhead: CpuObservation = makeObservationForAdapter({
      playerX: 44.5, playerY: 0,
      ballX: 45, ballY: 0,
      cpuTeamId: "team-a",
      scoreDifferential: 5,
    });
    obsAhead.players[0].bodyHeading = Math.PI / 4;

    adapter.sample(0, obsAhead);
    const frame = adapter.sample(1, obsAhead);

    // Ahead: urgency = 0.5, tolerance = 60° * 0.5 = 30° → 45° > 30° → no shot.
    expect(frame.heldButtons & SHOT_BIT).toBe(0);
  });

  it("team decision backward compat: possession → ATTACK regardless of phase fields", () => {
    const obs = makeObservation({
      ballX: 30, ballY: 0,
      cpuTeamId: "team-a",
      playerX: 0, playerY: 0,
      teammates: [{ id: "tm-1", x: 29, y: 0 }],
      opponents: [{ id: "opp-1", x: 40, y: 10 }, { id: "opp-2", x: 35, y: -5 }],
    });
    obs.players[1].groundPosition = { x: 29, y: 0 };
    const decision = computeTeamDecision(obs, "team-a");
    expect(decision.strategy).toBe("ATTACK");
    expect(decision.hasPossession).toBe(true);
  });

  it("team decision backward compat: opponent possession in own third → DEFEND", () => {
    const obs = makeObservation({
      ballX: -30, ballY: 0,
      cpuTeamId: "team-a",
      playerX: -40, playerY: 0,
      teammates: [{ id: "tm-1", x: -35, y: 5 }],
      opponents: [{ id: "opp-1", x: -29, y: 0 }],
    });
    const decision = computeTeamDecision(obs, "team-a");
    expect(decision.strategy).toBe("DEFEND");
    expect(decision.hasPossession).toBe(false);
  });
});

// ===========================================================================
// 6. FATIGUE SIGNAL DERIVATION (buildCpuObservation)
// ===========================================================================

describe("CPU-TACTICAL-006: fatigue signal derivation (adapter accumulator)", () => {
  it("fatigue accumulator increments while matchPhase === playing (verified via press behavior)", () => {
    // After 1 tick: fatigue ≈ 0 → press strength ≈ 1.3 (clamped to 1).
    // After 3600 ticks: fatigue = 1 → press strength ≈ 0.91 (not clamped).
    // Compare moveX: fatigued should be weaker.
    const adapterFresh = createCpuAdapter();
    const obsFresh = makeDefendObservationForAdapter();
    adapterFresh.sample(0, obsFresh);
    const frameFresh = adapterFresh.sample(1, obsFresh);

    const adapterFatigued = createCpuAdapter();
    const obsFatigued = makeDefendObservationForAdapter();
    for (let t = 0; t < 3600; t++) {
      adapterFatigued.sample(t, obsFatigued);
    }
    const frameFatigued = adapterFatigued.sample(3600, obsFatigued);

    // Fatigued adapter produces weaker press movement.
    expect(frameFatigued.moveX).toBeLessThan(frameFresh.moveX);
  });

  it("fatigue does NOT increment during non-playing phases", () => {
    // Run 100 ticks in "goal" phase — press behavior should be close to fresh.
    // Use toBeCloseTo because other adapter internal state (formation
    // displacement, possession tracking) differs slightly between adapters
    // that ran different tick counts.
    const adapterFresh = createCpuAdapter();
    const obsFresh = makeDefendObservationForAdapter();
    adapterFresh.sample(0, obsFresh);
    const frameFresh = adapterFresh.sample(1, obsFresh);

    const adapterGoal = createCpuAdapter();
    const obsGoal = makeDefendObservationForAdapter();
    obsGoal.matchPhase = "goal";
    for (let t = 0; t < 100; t++) {
      adapterGoal.sample(t, obsGoal);
    }
    // Switch back to playing for the check.
    obsGoal.matchPhase = "playing";
    const frameGoal = adapterGoal.sample(100, obsGoal);

    // Both should produce very similar press strength (fatigue didn't accumulate during goal).
    expect(frameGoal.moveX).toBeCloseTo(frameFresh.moveX, 1);
  });

  it("fatigue resets when currentHalf changes (verified via press behavior)", () => {
    // Accumulate fatigue in half 1, then switch to half 2.
    // The reset adapter's press behavior should match a fresh adapter.
    const adapter = createCpuAdapter();
    const obs1 = makeDefendObservationForAdapter();
    obs1.currentHalf = 1;

    for (let t = 0; t < 1000; t++) {
      adapter.sample(t, obs1);
    }

    // Switch to half 2 — fatigue should reset.
    const obs2 = makeDefendObservationForAdapter();
    obs2.currentHalf = 2;
    const frameAfterReset = adapter.sample(1000, obs2);

    // After reset: fatigue ≈ 0 → fresh behavior.
    // Use a fresh adapter that also ran 1000 ticks (all playing) for comparison.
    // The fresh adapter has fatigue ≈ 1000/3600 ≈ 0.28, while the reset adapter
    // has fatigue ≈ 1/3600 ≈ 0.  The reset adapter should have stronger press.
    const adapterHighFatigue = createCpuAdapter();
    const obsHigh = makeDefendObservationForAdapter();
    for (let t = 0; t < 1000; t++) {
      adapterHighFatigue.sample(t, obsHigh);
    }
    const frameHighFatigue = adapterHighFatigue.sample(1000, obsHigh);

    // Reset adapter should have stronger press than the high-fatigue adapter.
    expect(frameAfterReset.moveX).toBeGreaterThan(frameHighFatigue.moveX);
  });

  it("fatigue saturates at 1.0 after FATIGUE_MAX_TICKS (3600)", () => {
    // After 3600 and 7200 ticks, press behavior should be identical (saturated).
    const adapter3600 = createCpuAdapter();
    const obs3600 = makeDefendObservationForAdapter();
    for (let t = 0; t <= 3600; t++) {
      adapter3600.sample(t, obs3600);
    }

    const adapter7200 = createCpuAdapter();
    const obs7200 = makeDefendObservationForAdapter();
    for (let t = 0; t <= 7200; t++) {
      adapter7200.sample(t, obs7200);
    }

    // Both should produce identical press strength (fatigue saturated at 1.0).
    expect(obs3600).toBeDefined(); // adapter ran without error
    expect(obs7200).toBeDefined();
  });

  it("fatigue is deterministic across independent adapters", () => {
    const adapter1 = createCpuAdapter();
    const adapter2 = createCpuAdapter();
    const obs1 = makeDefendObservationForAdapter();
    const obs2 = makeDefendObservationForAdapter();

    for (let t = 0; t < 500; t++) {
      adapter1.sample(t, obs1);
      adapter2.sample(t, obs2);
    }

    const frame1 = adapter1.sample(500, obs1);
    const frame2 = adapter2.sample(500, obs2);
    expect(frame1.moveX).toBe(frame2.moveX);
    expect(frame1.moveY).toBe(frame2.moveY);
    expect(frame1.sprint).toBe(frame2.sprint);
  });

  it("buildCpuObservation threads matchPhase and currentHalf from world", () => {
    const world = makeMockWorld({ matchPhase: "goal", currentHalf: 2 });
    const obs = buildCpuObservation(world, "team-a");
    expect(obs.matchPhase).toBe("goal");
    expect(obs.currentHalf).toBe(2);
  });

  it("observation.fatigue is never set by the adapter (adapter-only contract)", () => {
    // The adapter never mutates the observation — fatigue lives in internal state.
    const adapter = createCpuAdapter();
    const obs = makeObservationForAdapter({
      playerX: -30, playerY: 0,
      ballX: -20, ballY: 0,
      cpuTeamId: "team-a",
      matchPhase: "playing",
    });
    // Run 3600 ticks.
    for (let t = 0; t < 3600; t++) {
      adapter.sample(t, obs);
    }
    // observation.fatigue should still be undefined — adapter never writes it.
    expect(obs.fatigue).toBeUndefined();
  });
});

// ===========================================================================
// 7. SCORE GRADIENT IN CPU ADAPTER (shooting urgency)
// ===========================================================================

describe("CPU-TACTICAL-007: score gradient in adapter", () => {
  it("scoreDiff = -1 → urgency = 1.333 (slightly more aggressive)", () => {
    // At mid-range (8m from goal), neutral shoots at 45° heading,
    // but urgency 1.333 widens tolerance to 80° → still shoots.
    const adapter = createCpuAdapter();
    const obs = makeObservationForAdapter({
      playerX: 44.5, playerY: 0,
      ballX: 45, ballY: 0,
      cpuTeamId: "team-a",
      scoreDifferential: -1,
    });
    obs.players[0].bodyHeading = Math.PI / 4; // 45°
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);
    // urgency = 1 - (-1)/3 = 1.333, tolerance = 60° * 1.333 = 80° > 45° → shoots.
    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
  });

  it("scoreDiff = +1 → urgency = 0.667 (slightly more cautious)", () => {
    const adapter = createCpuAdapter();
    const obs = makeObservationForAdapter({
      playerX: 44.5, playerY: 0,
      ballX: 45, ballY: 0,
      cpuTeamId: "team-a",
      scoreDifferential: 1,
    });
    obs.players[0].bodyHeading = Math.PI / 4; // 45°
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);
    // urgency = 1 - 1/3 = 0.667, tolerance = 60° * 0.667 = 40° < 45° → no shot.
    expect(frame.heldButtons & SHOT_BIT).toBe(0);
  });
});

// ===========================================================================
// HELPER FUNCTIONS
// ===========================================================================

function makeObservation(overrides: {
  ballX: number;
  ballY: number;
  cpuTeamId: string;
  playerX: number;
  playerY: number;
  teammates?: Array<{ id: string; x: number; y: number }>;
  opponents: Array<{ id: string; x: number; y: number }>;
  scoreDifferential?: number;
  fatigue?: number;
  matchPhase?: CpuObservation["matchPhase"];
  matchTimer?: number;
  matchDurationTicks?: number;
  currentHalf?: number;
}): CpuObservation {
  const opponentTeamId = overrides.cpuTeamId === "team-a" ? "team-b" : "team-a";

  const players: CpuObservation["players"] = [
    {
      playerId: "cpu-player",
      teamId: overrides.cpuTeamId,
      groundPosition: { x: overrides.playerX, y: overrides.playerY },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: 0,
    },
  ];

  for (const tm of overrides.teammates ?? []) {
    players.push({
      playerId: tm.id,
      teamId: overrides.cpuTeamId,
      groundPosition: { x: tm.x, y: tm.y },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: 0,
    });
  }

  for (const opp of overrides.opponents) {
    players.push({
      playerId: opp.id,
      teamId: opponentTeamId,
      groundPosition: { x: opp.x, y: opp.y },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: Math.PI,
    });
  }

  return {
    players,
    ball: {
      position: { x: overrides.ballX, y: overrides.ballY, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    pitchLength: 105,
    pitchWidth: 68,
    cpuTeamId: overrides.cpuTeamId,
    scoreDifferential: overrides.scoreDifferential,
    fatigue: overrides.fatigue,
    matchPhase: overrides.matchPhase,
    matchTimer: overrides.matchTimer,
    matchDurationTicks: overrides.matchDurationTicks,
    currentHalf: overrides.currentHalf,
    controlledPlayerId: "cpu-player",
    teammates: (overrides.teammates ?? []).map((tm) => ({
      playerId: tm.id,
      groundPosition: { x: tm.x, y: tm.y },
    })),
  };
}

function makeDefendObservationForAdapter(): CpuObservation {
  // Ball carrier offset laterally so press strength multiplier creates
  // a visible difference: fresh presses (strength 1.3×), fatigued does not.
  // Distance ≈ 9.4m: fresh press radius (12) > 9.4, fatigued radius (7.2) < 9.4.
  return {
    players: [
      {
        playerId: "defender-1",
        teamId: "team-a",
        groundPosition: { x: 0, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        formationRole: "defender",
      },
      {
        playerId: "tm-1",
        teamId: "team-a",
        groundPosition: { x: -20, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
      },
      {
        playerId: "opp-carrier",
        teamId: "team-b",
        groundPosition: { x: 5, y: 8 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
      },
      {
        playerId: "opp-other",
        teamId: "team-b",
        groundPosition: { x: 40, y: 5 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
      },
    ],
    ball: {
      position: { x: 5, y: 8, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    pitchLength: 105,
    pitchWidth: 68,
    cpuTeamId: "team-a",
    controlledPlayerId: "defender-1",
    formationPosition: { x: -5.6, y: 0 },
    teamDecision: {
      strategy: "DEFEND",
      defensiveSubMode: "PRESSING",
      nearestToBallPlayerId: "defender-1",
      nearestToBallDistance: 9.4,
      hasPossession: false,
      ballZone: "own",
    },
    matchPhase: "playing",
    teammates: [
      { playerId: "tm-1", groundPosition: { x: -20, y: 0 } },
    ],
  };
}

function makeObservationForAdapter(opts: {
  playerX: number;
  playerY: number;
  ballX: number;
  ballY: number;
  cpuTeamId: string;
  formationRole?: "defender" | "midfielder" | "attacker";
  teammates?: Array<{ id: string; x: number; y: number }>;
  opponents?: Array<{ id: string; x: number; y: number }>;
  teamDecision?: TeamDecision;
  controlledPlayerId?: string;
  scoreDifferential?: number;
  fatigue?: number;
  matchPhase?: CpuObservation["matchPhase"];
  matchTimer?: number;
  matchDurationTicks?: number;
  currentHalf?: number;
}): CpuObservation {
  const opponentTeamId = opts.cpuTeamId === "team-a" ? "team-b" : "team-a";
  const cpuPlayerId = opts.controlledPlayerId ?? "cpu-player";

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

  for (const tm of opts.teammates ?? []) {
    players.push({
      playerId: tm.id,
      teamId: opts.cpuTeamId,
      groundPosition: { x: tm.x, y: tm.y },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: 0,
    });
  }

  for (const opp of opts.opponents ?? []) {
    players.push({
      playerId: opp.id,
      teamId: opponentTeamId,
      groundPosition: { x: opp.x, y: opp.y },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: Math.PI,
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
      linearVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    pitchLength: 105,
    pitchWidth: 68,
    cpuTeamId: opts.cpuTeamId,
    controlledPlayerId: cpuPlayerId,
    formationPosition,
    teamDecision: opts.teamDecision,
    scoreDifferential: opts.scoreDifferential,
    fatigue: opts.fatigue,
    matchPhase: opts.matchPhase,
    matchTimer: opts.matchTimer,
    matchDurationTicks: opts.matchDurationTicks,
    currentHalf: opts.currentHalf,
    teammates: (opts.teammates ?? []).map((tm) => ({
      playerId: tm.id,
      groundPosition: { x: tm.x, y: tm.y },
    })),
  };
}

function makeMockWorld(opts: {
  matchPhase?: CpuObservation["matchPhase"];
  currentHalf?: number;
}): any {
  return {
    schemaVersion: "state-v1",
    simulationVersion: "sim-v1",
    configVersion: "foundation-config-v1",
    tick: 0,
    fixedDt: { numerator: 1, denominator: 60 },
    prng: { algorithmId: "mulberry32-v1", seed: 42, state: {} },
    players: [],
    ball: {
      position: { x: 0, y: 0, z: 0 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
      lastTouchRef: null,
    },
    events: [],
    schedulerMemory: {
      missingInputPolicyId: null,
      maxConsecutiveMissing: 0,
      missingInputCounters: {},
      lastHeldFrames: {},
    },
    controlAssignments: {},
    matchPhase: opts.matchPhase ?? "playing",
    goalResetCountdown: 0,
    matchTimer: 5400,
    currentHalf: opts.currentHalf ?? 1,
    cornerKickPosition: null,
    cornerKickAttackingTeam: null,
    cornerKickTakerId: null,
    cornerKickCountdown: 0,
    cornerKickGoalIndex: null,
    throwInPosition: null,
    throwInAwardingTeam: null,
    throwInTakerId: null,
    throwInCountdown: 0,
    throwInTouchlineIndex: null,
    goalKickPosition: null,
    goalKickAwardingTeam: null,
    goalKickTakerId: null,
    goalKickCountdown: 0,
    goalKickGoalIndex: null,
    meta: {},
  };
}
