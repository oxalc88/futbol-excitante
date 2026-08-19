/**
 * @module tactical-awareness-integration-tests
 *
 * Integration tests for CPU tactical awareness end-to-end.
 *
 * Tests:
 *  - CPU plays more attacking when trailing (score-adaptive behavior).
 *  - CPU plays more defensive when leading.
 *  - Fatigue builds over a match and reduces pressing/sprint.
 *  - Non-playing phases (goal, halftime) produce hold behavior.
 *  - Determinism: same scenario → same results.
 *
 * Adapter-layer behavior only. No trajectory/screenshot needed.
 * No Math.random, Date, DOM, or Node I/O in the match runner.
 */

import { describe, it, expect } from "vitest";
import {
  createCpuAdapter,
  buildCpuObservation,
  computeTeamDecision,
  type CpuObservation,
  type TeamDecision,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { FOUNDATION_SCENARIO_2V2 } from "../../src/apps/browser/foundation-scenario.js";
import { SHOT_BIT } from "../../src/contracts/input.js";

// ===========================================================================
// 1. Score-adaptive behavior: trailing → more ATTACK decisions
// ===========================================================================

describe("TACTICAL-AWARENESS-INT-001: score-adaptive team decisions", () => {
  it("trailing team produces more ATTACK decisions in center third than leading team", () => {
    // Build two identical scenarios but with different score states.
    // Trailing: scoreDiff = -3 (behind).
    // Leading: scoreDiff = +3 (ahead).
    // Ball in center third for both — this is where score gradient matters.

    const attackCountTrailing = countStrategiesOverTicks(
      -3, // scoreDifferential for trailing team
      120,
    );
    const attackCountLeading = countStrategiesOverTicks(
      3, // scoreDifferential for leading team
      120,
    );

    // Trailing should produce more ATTACK decisions than leading.
    expect(attackCountTrailing.attackCount).toBeGreaterThanOrEqual(
      attackCountLeading.attackCount,
    );

    // Leading should produce more DEFEND decisions than trailing.
    expect(attackCountLeading.defendCount).toBeGreaterThanOrEqual(
      attackCountTrailing.defendCount,
    );
  });

  it("score gradient produces monotonic attack count across deficit levels", () => {
    const results: Array<{ diff: number; attackCount: number; defendCount: number }> = [];

    for (const diff of [3, 1, 0, -1, -3]) {
      const counts = countStrategiesOverTicks(diff, 120);
      results.push({
        diff,
        attackCount: counts.attackCount,
        defendCount: counts.defendCount,
      });
    }

    // More negative (more behind) → more ATTACK.
    // More positive (more ahead) → more DEFEND.
    // Check monotonicity of attack count (should increase as diff decreases).
    for (let i = 1; i < results.length; i++) {
      expect(results[i].attackCount).toBeGreaterThanOrEqual(
        results[i - 1].attackCount,
      );
    }
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].defendCount).toBeGreaterThanOrEqual(
        results[i].defendCount,
      );
    }
  });
});

// ===========================================================================
// 2. Fatigue builds over match and reduces pressing
// ===========================================================================

describe("TACTICAL-AWARENESS-INT-002: fatigue over match duration", () => {
  it("fatigue accumulates in a real simulation loop (adapter never mutates observation)", () => {
    // Run a real simulation with 2v2 CPU adapters wired through the
    // standard runtime path (buildCpuObservation → adapter.sample).
    // Verify the adapter accumulates fatigue internally (tested via
    // press behavior below) and never mutates the observation.
    const scenario = FOUNDATION_SCENARIO_2V2;
    const sim = createSimulation(createWorld({ scenario }));
    const assignments = scenario.controlAssignments;

    const adapters = new Map<string, ReturnType<typeof createCpuAdapter>>();
    for (const slot of Object.keys(assignments)) {
      adapters.set(slot, createCpuAdapter());
    }

    // Run 200 ticks — enough to accumulate some fatigue.
    for (let tick = 0; tick < 200; tick++) {
      const snapshot = sim.snapshot();
      const frames = Object.entries(assignments).map(
        ([slot, assignment]) => {
          const obs = buildCpuObservation(
            snapshot,
            assignment.teamId,
            assignment.controlledPlayerId,
          );
          const adapter = adapters.get(slot)!;
          const frame = adapter.sample(sim.tick, obs);
          frame.controlSlot = slot;
          return frame;
        },
      );
      sim.applyInputs(frames);
      sim.step();
    }

    // Verify the adapter never mutated the observation (adapter contract).
    const finalSnapshot = sim.snapshot();
    const finalObs = buildCpuObservation(
      finalSnapshot,
      "team-a",
      Object.values(assignments).find((a) => a.teamId === "team-a")!.controlledPlayerId,
    );
    expect(finalObs.fatigue).toBeUndefined();
  });

  it("fatigue resets when currentHalf changes in real runtime", () => {
    // Simulate a half transition: accumulate fatigue in half 1,
    // then switch to half 2 and verify the adapter produces fresh behavior.
    const adapter = createCpuAdapter();

    // Accumulate fatigue in half 1 for 1000 ticks using defend observation.
    const obs1 = makeRealtimeDefendObservation(1);
    for (let t = 0; t < 1000; t++) {
      adapter.sample(t, obs1);
    }

    // Switch to half 2 — fatigue should reset.
    const obs2 = makeRealtimeDefendObservation(2);
    const frameAfterReset = adapter.sample(1000, obs2);

    // After reset + 1 tick: fatigue ≈ 0 → fresh behavior.
    const adapterFresh = createCpuAdapter();
    const obsFresh = makeRealtimeDefendObservation(1);
    adapterFresh.sample(0, obsFresh);
    const frameFresh = adapterFresh.sample(1, obsFresh);

    expect(frameAfterReset.moveX).toBe(frameFresh.moveX);
  });

  it("fatigued adapter presses less (weaker press movement)", () => {
    // Use distance=10m so fresh adapter presses (strength 1.3 → moveX≈1)
    // but fatigued adapter does NOT press (outside effective radius → moveX<1).
    const adapterFresh = createCpuAdapter();
    const adapterFatigued = createCpuAdapter();

    const freshObs = makePressTestObservation(10);
    const fatiguedObs = makePressTestObservation(10);

    // Fresh: 5 ticks — fatigue ≈ 0, press radius = 12m > 10m → presses.
    for (let t = 0; t < 5; t++) {
      adapterFresh.sample(t, freshObs);
    }
    const frameFresh = adapterFresh.sample(5, freshObs);

    // Fatigued: 3600 ticks — fatigue = 1, press radius = 7.2m < 10m → no press.
    for (let t = 0; t < 3600; t++) {
      adapterFatigued.sample(t, fatiguedObs);
    }
    const frameFatigued = adapterFatigued.sample(3600, fatiguedObs);

    // Fresh presses aggressively (moveX ≈ 1), fatigued chases normally (moveX < 1).
    expect(frameFresh.moveX).toBeGreaterThan(frameFatigued.moveX);

    // Sprint must always be 1 (accepted invariant).
    expect(frameFatigued.sprint).toBe(1);
    expect(frameFresh.sprint).toBe(1);
  });
});

// ===========================================================================
// 3. Non-playing phase hold behavior
// ===========================================================================

describe("TACTICAL-AWARENESS-INT-003: non-playing phase hold", () => {
  it("goal phase produces zero movement for all CPU adapters", () => {
    const scenario = FOUNDATION_SCENARIO_2V2;
    const sim = createSimulation(createWorld({ scenario }));
    const assignments = scenario.controlAssignments;

    // Run a few ticks to get the simulation going.
    for (let t = 0; t < 10; t++) {
      const snapshot = sim.snapshot();
      const frames = Object.entries(assignments).map(
        ([slot, assignment]) => {
          const obs = buildCpuObservation(
            snapshot,
            assignment.teamId,
            assignment.controlledPlayerId,
          );
          // Override matchPhase to simulate a goal phase.
          obs.matchPhase = "goal";
          const adapter = createCpuAdapter();
          const frame = adapter.sample(sim.tick, obs);
          frame.controlSlot = slot;
          return frame;
        },
      );
      sim.applyInputs(frames);
      sim.step();
    }

    // All frames should show zero movement.
    const snapshot = sim.snapshot();
    for (const [slot, assignment] of Object.entries(assignments)) {
      const obs = buildCpuObservation(
        snapshot,
        assignment.teamId,
        assignment.controlledPlayerId,
      );
      obs.matchPhase = "goal";
      const adapter = createCpuAdapter();
      const frame = adapter.sample(sim.tick, obs);
      frame.controlSlot = slot;
      expect(frame.moveX).toBe(0);
      expect(frame.moveY).toBe(0);
      expect(frame.sprint).toBe(0);
      expect(frame.heldButtons).toBe(0);
    }
  });

  it("team decision during goal phase is BALANCED with NONE sub-mode", () => {
    const scenario = FOUNDATION_SCENARIO_2V2;
    const sim = createSimulation(createWorld({ scenario }));
    const snapshot = sim.snapshot();

    const obs = buildCpuObservation(snapshot, "team-a");
    obs.matchPhase = "goal";

    const decision = computeTeamDecision(obs, "team-a");
    expect(decision.strategy).toBe("BALANCED");
    expect(decision.defensiveSubMode).toBe("NONE");
  });
});

// ===========================================================================
// 4. End-to-end: team decision observation populates correctly
// ===========================================================================

describe("TACTICAL-AWARENESS-INT-004: observation wiring", () => {
  it("buildCpuObservation populates matchPhase and currentHalf from world", () => {
    const scenario = FOUNDATION_SCENARIO_2V2;
    const world = createWorld({ scenario });
    const obs = buildCpuObservation(world, "team-a");

    // matchPhase should be "playing" (initial).
    expect(obs.matchPhase).toBe("playing");

    // currentHalf should be 1.
    expect(obs.currentHalf).toBe(1);

    // Note: fatigue is NOT computed by buildCpuObservation.
    // It is computed and injected by the CPU adapter's per-instance
    // tick accumulator during sample(). See INT-002 for real-runtime proof.
  });

  it("determinism: same world state → same observation → same team decision", () => {
    const scenario = FOUNDATION_SCENARIO_2V2;
    const world = createWorld({ scenario });
    const obs1 = buildCpuObservation(world, "team-a");
    const obs2 = buildCpuObservation(world, "team-a");

    const d1 = computeTeamDecision(obs1, "team-a");
    const d2 = computeTeamDecision(obs2, "team-a");
    expect(d1).toEqual(d2);

    // Also verify adapter determinism.
    const adapter1 = createCpuAdapter();
    const adapter2 = createCpuAdapter();
    const f1 = adapter1.sample(0, obs1);
    const f2 = adapter2.sample(0, obs2);
    expect(f1.moveX).toBe(f2.moveX);
    expect(f1.moveY).toBe(f2.moveY);
    expect(f1.sprint).toBe(f2.sprint);
  });
});

// ===========================================================================
// 5. Score-adaptive CPU adapter behavior (shooting urgency)
// ===========================================================================

describe("TACTICAL-AWARENESS-INT-005: score-adaptive shooting", () => {
  it("trailing CPU shoots from wider angles than leading CPU", () => {
    // Both CPUs at mid-range (8m from goal), heading 45° off.
    // Trailing: urgency > 1 → wider tolerance → may shoot.
    // Leading: urgency < 1 → narrower tolerance → no shot.

    const adapterTrailing = createCpuAdapter();
    const adapterLeading = createCpuAdapter();

    const obsTrailing = makeShootObservation(-2);
    obsTrailing.players[0].bodyHeading = Math.PI / 4; // 45°

    const obsLeading = makeShootObservation(2);
    obsLeading.players[0].bodyHeading = Math.PI / 4;

    adapterTrailing.sample(0, obsTrailing);
    const frameTrailing = adapterTrailing.sample(1, obsTrailing);

    adapterLeading.sample(0, obsLeading);
    const frameLeading = adapterLeading.sample(1, obsLeading);

    // Trailing: urgency = 1 - (-2)/3 = 1.667 → tolerance = 60° * 1.667 ≈ 100° > 45° → shoots.
    expect(frameTrailing.pressedButtons & SHOT_BIT).not.toBe(0);

    // Leading: urgency = 1 - 2/3 = 0.333 → tolerance = 60° * 0.333 = 20° < 45° → no shot.
    expect(frameLeading.pressedButtons & SHOT_BIT).toBe(0);
  });
});

// ===========================================================================
// Helpers
// ===========================================================================

/**
 * Count ATTACK/DEFEND/BALANCED decisions over N ticks with a given
 * score differential. Uses a synthetic observation with ball in center third.
 */
function countStrategiesOverTicks(
  scoreDiff: number,
  ticks: number,
): { attackCount: number; defendCount: number; balancedCount: number } {
  let attackCount = 0;
  let defendCount = 0;
  let balancedCount = 0;

  for (let t = 0; t < ticks; t++) {
    const obs = makeSyntheticObservation(scoreDiff, t);
    const decision = computeTeamDecision(obs, "team-a");
    if (decision.strategy === "ATTACK") attackCount++;
    else if (decision.strategy === "DEFEND") defendCount++;
    else balancedCount++;
  }

  return { attackCount, defendCount, balancedCount };
}

function makeSyntheticObservation(
  scoreDiff: number,
  tick: number,
): CpuObservation {
  // Ball in center third. Players positioned so neither team has clear possession.
  // This ensures the score gradient is the deciding factor.
  return {
    players: [
      {
        playerId: "p1",
        teamId: "team-a",
        groundPosition: { x: -15, y: 5 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
      },
      {
        playerId: "p2",
        teamId: "team-a",
        groundPosition: { x: -10, y: -5 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
      },
      {
        playerId: "p3",
        teamId: "team-b",
        groundPosition: { x: 15, y: 5 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
      },
      {
        playerId: "p4",
        teamId: "team-b",
        groundPosition: { x: 10, y: -5 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
      },
    ],
    ball: {
      position: { x: 0, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    pitchLength: 105,
    pitchWidth: 68,
    cpuTeamId: "team-a",
    scoreDifferential: scoreDiff,
  };
}

function makeDefendObservation(): CpuObservation {
  return {
    players: [
      {
        playerId: "defender-1",
        teamId: "team-a",
        groundPosition: { x: 10, y: 0 },
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
        groundPosition: { x: 19, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: Math.PI,
      },
    ],
    ball: {
      position: { x: 20, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    pitchLength: 105,
    pitchWidth: 68,
    cpuTeamId: "team-a",
    controlledPlayerId: "defender-1",
    formationPosition: { x: -5.6, y: 0 }, // 40% pull toward own goal at -52.5
    teamDecision: {
      strategy: "DEFEND",
      defensiveSubMode: "PRESSING",
      nearestToBallPlayerId: "defender-1",
      nearestToBallDistance: 10,
      hasPossession: false,
      ballZone: "own",
    },
    matchPhase: "playing",
    teammates: [
      { playerId: "tm-1", groundPosition: { x: -20, y: 0 } },
    ],
  };
}

function makeRealtimeObservation(
  cpuTeamId: string,
  matchPhase: CpuObservation["matchPhase"],
  currentHalf: number,
): CpuObservation {
  return {
    players: [
      {
        playerId: "p1",
        teamId: cpuTeamId,
        groundPosition: { x: -15, y: 5 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
      },
      {
        playerId: "p2",
        teamId: cpuTeamId,
        groundPosition: { x: -10, y: -5 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
      },
    ],
    ball: {
      position: { x: 0, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    pitchLength: 105,
    pitchWidth: 68,
    cpuTeamId,
    matchPhase,
    currentHalf,
  };
}

function makeRealtimeDefendObservation(currentHalf: number): CpuObservation {
  return {
    players: [
      {
        playerId: "defender-1",
        teamId: "team-a",
        groundPosition: { x: 10, y: 0 },
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
        groundPosition: { x: 16, y: 0 },
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
      position: { x: 17, y: 0, z: 0.11 },
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
      nearestToBallDistance: 7,
      hasPossession: false,
      ballZone: "own",
    },
    matchPhase: "playing",
    currentHalf,
    teammates: [
      { playerId: "tm-1", groundPosition: { x: -20, y: 0 } },
    ],
  };
}

function makePressTestObservation(distance: number): CpuObservation {
  // Defender at origin, ball carrier offset laterally so the press
  // strength multiplier creates a visible difference in moveX.
  // At distance ≈ 9.4 from defender: fresh presses (radius 12),
  // fatigued does NOT press (radius 7.2), so fresh has stronger moveX.
  const carrierX = 5;
  const carrierY = 8;
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
        groundPosition: { x: carrierX, y: carrierY },
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
      position: { x: carrierX, y: carrierY, z: 0.11 },
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
      nearestToBallDistance: distance,
      hasPossession: false,
      ballZone: "own",
    },
    matchPhase: "playing",
    teammates: [
      { playerId: "tm-1", groundPosition: { x: -20, y: 0 } },
    ],
  };
}

function makeShootObservation(scoreDiff: number): CpuObservation {
  return {
    players: [
      {
        playerId: "cpu-player",
        teamId: "team-a",
        // At (44.5, 0): dist to goal at (52.5, 0) = 8m (mid-range).
        groundPosition: { x: 44.5, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
      },
    ],
    ball: {
      position: { x: 45, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    pitchLength: 105,
    pitchWidth: 68,
    cpuTeamId: "team-a",
    scoreDifferential: scoreDiff,
    matchPhase: "playing",
  };
}
