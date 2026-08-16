/**
 * @module tests/unit/cpu-adapter/2v2-passing
 *
 * Tests for CPU teammate-aware passing in 2v2 topology.
 *
 * 2v2 context: 2 players per team. When a CPU player has possession,
 * the single teammate should always be in forward range (both on same
 * side of the pitch). The pass AI should trigger more naturally than
 * in 1v1 because there's a guaranteed forward teammate.
 *
 * Covers:
 *  1. CPU-FORMATION-PASS-001: When beyond shot range (> 20m), CPU presses PASS_BIT
 *  2. CPU-FORMATION-PASS-002: Pass target points toward teammate (correct direction)
 *  3. CPU-FORMATION-PASS-003: Pass overrides move direction toward teammate
 *  4. CPU-FORMATION-PASS-004: 2v2 topology — teammate always in forward range
 *  5. CPU-FORMATION-PASS-005: Multiple ticks — CPU continues to pass (edge detection)
 *  6. CPU-FORMATION-PASS-006: When in shooting range, CPU shoots instead of passing
 *  7. CPU-FORMATION-PASS-007: Determinism: same state → same pass decision
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
// 1. CPU-FORMATION-PASS-001: When beyond shot range, CPU presses PASS_BIT
// ===========================================================================

describe("CPU-FORMATION-PASS-001: beyond shot range triggers PASS_BIT", () => {
  it("2v2: CPU at (15, 0), ball at (15.5, 0), 1 teammate at (25, 3) → PASS_BIT pressed", () => {
    // distToGoal ≈ 37.5m > SHOT_RANGE_WIDE (20m) → should pass.
    // Facing away from goal (π) → not facing goal either.
    const obs = make2v2Observation(15, 0, 15.5, 0, "team-a", [25, 3]);
    obs.players[0].bodyHeading = Math.PI;

    // Tick 0: gain possession (ballWasInRange).
    createCpuAdapter().sample(0, obs);
    // Tick 1: has possession, beyond shot range → PASS_BIT.
    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.pressedButtons & PASS_BIT).not.toBe(0);
  });

  it("2v2: CPU at (5, 0), ball at (5.5, 0), teammate at (15, 0) → PASS_BIT pressed", () => {
    // distToGoal ≈ 47.5m > 20m. Facing away.
    const obs = make2v2Observation(5, 0, 5.5, 0, "team-a", [15, 0]);
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.pressedButtons & PASS_BIT).not.toBe(0);
  });

  it("2v2: CPU at midfield (30, 0), ball at (30.5, 0) → PASS_BIT pressed", () => {
    // distToGoal ≈ 22.5m > 20m.
    const obs = make2v2Observation(30, 0, 30.5, 0, "team-a", [40, 5]);
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.pressedButtons & PASS_BIT).not.toBe(0);
  });

  it("2v2: team-b attacks -x → CPU at (-15, 0), teammate at (-25, 3) → PASS_BIT", () => {
    // team-b attacks -x, goal at -52.5. CPU at -15, distToGoal ≈ 37.5m > 20m.
    const obs = make2v2Observation(-15, 0, -15.5, 0, "team-b", [-25, 3]);
    obs.players[0].bodyHeading = 0; // facing +x, away from -x goal.

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.pressedButtons & PASS_BIT).not.toBe(0);
  });
});

// ===========================================================================
// 2. CPU-FORMATION-PASS-002: Pass target points toward teammate
// ===========================================================================

describe("CPU-FORMATION-PASS-002: pass target direction is toward teammate", () => {
  it("2v2: moveX/moveY point toward teammate at (30, 5) from (20, 0)", () => {
    const obs = make2v2Observation(20, 0, 20.5, 0, "team-a", [30, 5]);
    obs.players[0].bodyHeading = Math.PI; // Force pass trigger.

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Direction from (20, 0) to (30, 5): dx=10, dy=5.
    // Normalized: ≈ (0.894, 0.447).
    expect(frame.moveX).toBeGreaterThan(0.85);
    expect(frame.moveX).toBeLessThan(0.95);
    expect(frame.moveY).toBeGreaterThan(0.4);
    expect(frame.moveY).toBeLessThan(0.5);
    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
  });

  it("2v2: straight forward pass (teammate at same Y)", () => {
    const obs = make2v2Observation(20, 0, 20.5, 0, "team-a", [30, 0]);
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Straight forward: moveY ≈ 0, moveX ≈ 1.
    expect(frame.moveX).toBeGreaterThan(0.95);
    expect(Math.abs(frame.moveY)).toBeLessThan(0.05);
    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
  });

  it("2v2: teammate with lateral offset → correct diagonal direction", () => {
    const obs = make2v2Observation(10, 2, 10.5, 2, "team-a", [25, 12]);
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Direction from (10, 2) to (25, 12): dx=15, dy=10.
    // Normalized: ≈ (0.832, 0.555).
    expect(frame.moveX).toBeGreaterThan(0.8);
    expect(frame.moveY).toBeGreaterThan(0.5);
    expect(frame.moveY).toBeLessThan(0.6);
  });

  it("2v2 team-b: teammate at lower x → moveX negative", () => {
    const obs = make2v2Observation(-20, 0, -20.5, 0, "team-b", [-30, 5]);
    obs.players[0].bodyHeading = 0; // facing +x, away from -x goal.

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.moveX).toBeLessThan(-0.8);
    expect(frame.moveY).toBeGreaterThan(0.4);
    expect(frame.moveY).toBeLessThan(0.5);
  });
});

// ===========================================================================
// 3. CPU-FORMATION-PASS-003: Pass overrides move direction toward teammate
// ===========================================================================

describe("CPU-FORMATION-PASS-003: pass overrides move direction", () => {
  it("2v2: move direction is toward teammate, NOT toward goal", () => {
    // CPU at (20, 5), goal aim is toward (52.5, 0) but teammate at (30, 8).
    // Pass should override to aim at teammate (30, 8).
    const obs = make2v2Observation(20, 5, 20.5, 5, "team-a", [30, 8]);
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Direction from (20, 5) to (30, 8): dx=10, dy=3.
    // Normalized: ≈ (0.970, 0.291).
    expect(frame.moveX).toBeGreaterThan(0.9);
    expect(frame.moveY).toBeGreaterThan(0.2);
    expect(frame.moveY).toBeLessThan(0.4);
    // moveX positive (forward toward teammate).
    expect(frame.moveX).toBeGreaterThan(0);
  });

  it("2v2: when teammate is slightly behind Y but still forward X, pass aims correctly", () => {
    // CPU at (30, 3), teammate at (40, 1). Forward X check passes.
    const obs = make2v2Observation(30, 3, 30.5, 3, "team-a", [40, 1]);
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Direction from (30, 3) to (40, 1): dx=10, dy=-2.
    // Normalized: ≈ (0.981, -0.196).
    expect(frame.moveX).toBeGreaterThan(0.95);
    expect(frame.moveY).toBeLessThan(0);
    expect(frame.moveY).toBeGreaterThan(-0.3);
  });

  it("2v2: teammate directly ahead → pure forward move", () => {
    const obs = make2v2Observation(20, 0, 20.5, 0, "team-a", [25, 0]);
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.moveX).toBeCloseTo(1, 2);
    expect(frame.moveY).toBeCloseTo(0, 3);
  });
});

// ===========================================================================
// 4. CPU-FORMATION-PASS-004: 2v2 topology — teammate always in forward range
// ===========================================================================

describe("CPU-FORMATION-PASS-004: 2v2 teammate always in forward range", () => {
  it("2v2: teammate behind CPU (toward own goal) → no forward teammate, falls back to goal", () => {
    // CPU at (30, 0), teammate at (20, 5). Teammate is behind (toward own goal).
    // getBestTeammateTarget filters by forward direction → no forward teammate.
    // Should fall back to goal direction.
    const obs = make2v2Observation(30, 0, 30.5, 0, "team-a", [20, 5]);
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // No forward teammate → move toward goal (+x).
    expect(frame.moveX).toBeGreaterThan(0);
    // But PASS_BIT still pressed because beyond shot range.
    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
  });

  it("2v2: standard formation — both players on attacking side", () => {
    // Standard 2v2 formation: player at (25, 0), teammate at (35, 0).
    // Both on attacking side. Teammate at (35, 0) is forward of (25, 0).
    const obs = make2v2Observation(25, 0, 25.5, 0, "team-a", [35, 0]);
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // PASS_BIT pressed.
    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    // moveX positive (forward to teammate).
    expect(frame.moveX).toBeGreaterThan(0.95);
  });

  it("2v2: teammate at midfield while CPU is deep → still forward", () => {
    // CPU at (5, 0), teammate at (30, 0). Both forward direction from CPU.
    const obs = make2v2Observation(5, 0, 5.5, 0, "team-a", [30, 0]);
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.moveX).toBeGreaterThan(0.95);
  });

  it("2v2: both near own goal → teammate still forward if at higher X", () => {
    // CPU at (-40, 0), teammate at (-30, 0). Both in own half.
    // But teammate at -30 is forward of CPU at -40.
    const obs = make2v2Observation(-40, 0, -39.5, 0, "team-a", [-30, 0]);
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // PASS_BIT pressed.
    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    // moveX positive (toward teammate at -30 from -40).
    expect(frame.moveX).toBeGreaterThan(0.95);
  });
});

// ===========================================================================
// 5. CPU-FORMATION-PASS-005: Multiple ticks — CPU continues to pass
// ===========================================================================

describe("CPU-FORMATION-PASS-005: multi-tick pass continuity", () => {
  it("2v2: PASS_BIT pressed on first pass tick, held on subsequent ticks", () => {
    const obs = make2v2Observation(20, 0, 20.5, 0, "team-a", [30, 0]);
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();

    // Tick 0: gain possession.
    adapter.sample(0, obs);

    // Tick 1: first pass → pressed + held.
    const frame1 = adapter.sample(1, obs);
    expect(frame1.pressedButtons & PASS_BIT).not.toBe(0);
    expect(frame1.heldButtons & PASS_BIT).not.toBe(0);

    // Tick 2: hold pass → only held.
    const frame2 = adapter.sample(2, obs);
    expect(frame2.pressedButtons & PASS_BIT).toBe(0);
    expect(frame2.heldButtons & PASS_BIT).not.toBe(0);

    // Tick 3: still holding.
    const frame3 = adapter.sample(3, obs);
    expect(frame3.pressedButtons & PASS_BIT).toBe(0);
    expect(frame3.heldButtons & PASS_BIT).not.toBe(0);
  });

  it("2v2: CPU passes continuously for 10 ticks", () => {
    const obs = make2v2Observation(15, 0, 15.5, 0, "team-a", [25, 0]);
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);

    for (let tick = 1; tick <= 10; tick++) {
      const frame = adapter.sample(tick, obs);
      expect(
        frame.heldButtons & PASS_BIT,
        `tick ${tick}: PASS_BIT should be held`,
      ).not.toBe(0);
    }
  });

  it("2v2: when beyond 20m, PASS_BIT held even when facing goal (dist > wide range)", () => {
    // CPU at (20, 0), ball at (20.5, 0) — distToGoal ≈ 32.5m > SHOT_RANGE_WIDE (20m).
    // On tick 0-1: face away → pass pressed + held.
    // On tick 2: face toward goal → but dist > 20m → shouldPressPass = true (dist > 20m).
    // PASS_BIT should still be held because the condition is dist > 20m (true), not just !facing.
    const obs = make2v2Observation(20, 0, 20.5, 0, "team-a", [30, 0]);
    // Tick 0-1: face away → pass.
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const passFrame = adapter.sample(1, obs);

    expect(passFrame.heldButtons & PASS_BIT).not.toBe(0);
    expect(passFrame.pressedButtons & PASS_BIT).not.toBe(0);

    // Now face the goal → shouldPressPass = true (because dist > 20m still).
    obs.players[0].bodyHeading = 0; // facing +x toward goal.
    const faceFrame = adapter.sample(2, obs);

    // distToGoal ≈ 32.5m > 20m → shouldPressPass = true regardless of facing.
    // So PASS_BIT continues to be held.
    expect(faceFrame.heldButtons & PASS_BIT).not.toBe(0);
    // pressedButtons should be 0 (not newly pressed, condition already held).
    expect(faceFrame.pressedButtons & PASS_BIT).toBe(0);
  });

  it("2v2: PASS_BIT released when player enters shooting range (≤ 20m) AND faces goal", () => {
    // When within shooting range and facing well, the CPU shoots instead of passing.
    // Create scenario: player at (36, 0), ball at (36.5, 0).
    // distToGoal ≈ 16.5m ≤ 20m, and if facing goal → shot, not pass.
    const obs = make2v2Observation(36, 0, 36.5, 0, "team-a", [45, 0]);
    // Start facing away → pass.
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const passFrame = adapter.sample(1, obs);

    expect(passFrame.heldButtons & PASS_BIT).not.toBe(0);

    // Now move closer and face goal → shot, no pass.
    // Use a new observation with player closer to goal and facing it.
    const closeObs = make2v2Observation(36, 0, 36.5, 0, "team-a", [45, 0]);
    closeObs.players[0].bodyHeading = 0; // facing goal.
    const shotFrame = adapter.sample(2, closeObs);

    // 16.5m ≤ 20m, facing well → shot should be pressed, no pass.
    expect(shotFrame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(shotFrame.heldButtons & PASS_BIT).toBe(0);
    expect(shotFrame.pressedButtons & PASS_BIT).toBe(0);
  });
});

// ===========================================================================
// 6. CPU-FORMATION-PASS-006: Shooting takes priority over passing
// ===========================================================================

describe("CPU-FORMATION-PASS-006: shot priority over pass in 2v2", () => {
  it("2v2: within close range (≤ 5m) → SHOT_BIT, no PASS_BIT", () => {
    const obs = make2v2Observation(48, 0, 48.5, 0, "team-a", [55, 0]);
    obs.players[0].bodyHeading = 0; // facing goal.

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.pressedButtons & SHOT_BIT).not.toBe(0);
    expect(frame.heldButtons & PASS_BIT).toBe(0);
    expect(frame.pressedButtons & PASS_BIT).toBe(0);
  });

  it("2v2: within 5-20m, facing goal → SHOT_BIT, no PASS_BIT", () => {
    const obs = make2v2Observation(35, 0, 35.5, 0, "team-a", [45, 0]);
    obs.players[0].bodyHeading = 0;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.heldButtons & PASS_BIT).toBe(0);
  });

  it("2v2: at 6m from goal with good angle → shoots not passes", () => {
    // distToGoal ≈ 17.5m (35m from origin, goal at 52.5). Within 20m.
    const obs = make2v2Observation(35, 0, 35.5, 0, "team-a", [50, 0]);
    obs.players[0].bodyHeading = 0;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frame.heldButtons & PASS_BIT).toBe(0);
  });

  it("2v2: beyond 20m, facing goal → still dribble (no shot), may pass", () => {
    // CPU at (10, 0), distToGoal ≈ 42.5m > 20m.
    // Facing goal but beyond range → no shot.
    // If facing goal, shouldPressPass = dist > 20 || !facing → true || false = true.
    // So pass is pressed when beyond 20m regardless of facing.
    const obs = make2v2Observation(10, 0, 10.5, 0, "team-a", [20, 0]);
    obs.players[0].bodyHeading = 0; // facing goal.

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Beyond 20m → pass pressed (shouldPressPass = true because dist > 20).
    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.pressedButtons & PASS_BIT).not.toBe(0);
    // No shot (beyond range).
    expect(frame.heldButtons & SHOT_BIT).toBe(0);
  });

  it("2v2: beyond 20m, facing away → pass (both conditions true)", () => {
    const obs = make2v2Observation(10, 0, 10.5, 0, "team-a", [20, 0]);
    obs.players[0].bodyHeading = Math.PI; // facing away.

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.pressedButtons & PASS_BIT).not.toBe(0);
    expect(frame.heldButtons & SHOT_BIT).toBe(0);
  });
});

// ===========================================================================
// 7. CPU-FORMATION-PASS-007: Determinism
// ===========================================================================

describe("CPU-FORMATION-PASS-007: determinism in 2v2 passing", () => {
  it("same 2v2 state → identical pass frames across adapters", () => {
    const obs = make2v2Observation(20, 0, 20.5, 0, "team-a", [30, 5]);
    obs.players[0].bodyHeading = Math.PI;

    const a1 = createCpuAdapter();
    const a2 = createCpuAdapter();

    a1.sample(0, obs);
    a2.sample(0, obs);

    for (let tick = 1; tick <= 10; tick++) {
      const f1 = a1.sample(tick, obs);
      const f2 = a2.sample(tick, obs);

      expect(f1.heldButtons).toBe(f2.heldButtons);
      expect(f1.pressedButtons).toBe(f2.pressedButtons);
      expect(f1.moveX).toBe(f2.moveX);
      expect(f1.moveY).toBe(f2.moveY);
      expect(f1.sprint).toBe(f2.sprint);
    }
  });

  it("2v2: multi-tick pass pattern is deterministic", () => {
    const obs = make2v2Observation(15, 3, 15.5, 3, "team-a", [25, 8]);
    obs.players[0].bodyHeading = Math.PI;

    const a1 = createCpuAdapter();
    const a2 = createCpuAdapter();

    a1.sample(0, obs);
    a2.sample(0, obs);

    for (let tick = 1; tick <= 20; tick++) {
      const f1 = a1.sample(tick, obs);
      const f2 = a2.sample(tick, obs);

      expect(f1.heldButtons, `tick ${tick} heldButtons`).toBe(f2.heldButtons);
      expect(f1.pressedButtons, `tick ${tick} pressedButtons`).toBe(f2.pressedButtons);
    }
  });

  it("2v2: PASS_BIT pattern matches teammate-pass test determinism", () => {
    const obs = make2v2Observation(20, 0, 20.5, 0, "team-a", [30, 0]);
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

  it("2v2: different body heading → different pass decision is still deterministic", () => {
    // Pass scenario: facing away → pass.
    const obsPass = make2v2Observation(20, 0, 20.5, 0, "team-a", [30, 0]);
    obsPass.players[0].bodyHeading = Math.PI;

    // Face-goal scenario: facing goal, still beyond 20m → pass (dist > 20).
    const obsFace = make2v2Observation(20, 0, 20.5, 0, "team-a", [30, 0]);
    obsFace.players[0].bodyHeading = 0;

    const pa = createCpuAdapter();
    const fa = createCpuAdapter();

    pa.sample(0, obsPass);
    fa.sample(0, obsFace);

    // Both scenarios still pass (beyond 20m), but move direction differs.
    const pf = pa.sample(1, obsPass);
    const ff = fa.sample(1, obsFace);

    // Both should press PASS_BIT.
    expect(pf.heldButtons & PASS_BIT).not.toBe(0);
    expect(ff.heldButtons & PASS_BIT).not.toBe(0);

    // Determinism within each scenario.
    const pf2 = pa.sample(2, obsPass);
    const ff2 = fa.sample(2, obsFace);
    expect(pf2.heldButtons).toBe(pf.heldButtons);
    expect(ff2.heldButtons).toBe(ff.heldButtons);
  });
});

// ===========================================================================
// 8. 2v2-specific: teammate-directed pass in various positions
// ===========================================================================

describe("CPU-FORMATION-PASS-008: 2v2 teammate-directed pass at various positions", () => {
  it("2v2: CPU near own goal, teammate ahead → pass forward", () => {
    const obs = make2v2Observation(-45, 0, -44.5, 0, "team-a", [-30, 0]);
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    expect(frame.pressedButtons & PASS_BIT).not.toBe(0);
    // Move toward teammate at x=-30 from x=-45.
    expect(frame.moveX).toBeGreaterThan(0.95);
  });

  it("2v2: CPU at opponent penalty area, still pass if beyond 20m from goal", () => {
    // CPU at (40, 0), distToGoal ≈ 12.5m. Wait, that's within 20m.
    // For beyond 20m: CPU at (30, 0), dist ≈ 22.5m.
    const obs = make2v2Observation(30, 0, 30.5, 0, "team-a", [40, 5]);
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    expect(frame.heldButtons & PASS_BIT).not.toBe(0);
    // Aim at teammate.
    expect(frame.moveX).toBeGreaterThan(0.85);
    expect(frame.moveY).toBeGreaterThan(0.3);
    expect(frame.moveY).toBeLessThan(0.5);
  });

  it("2v2: teammate at different Y → lateral movement in pass", () => {
    const obs = make2v2Observation(20, 10, 20.5, 10, "team-a", [30, 20]);
    obs.players[0].bodyHeading = Math.PI;

    const adapter = createCpuAdapter();
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Direction from (20, 10) to (30, 20): dx=10, dy=10.
    // Normalized: ≈ (0.707, 0.707).
    expect(frame.moveX).toBeGreaterThan(0.65);
    expect(frame.moveX).toBeLessThan(0.75);
    expect(frame.moveY).toBeGreaterThan(0.65);
    expect(frame.moveY).toBeLessThan(0.75);
  });
});

// ===========================================================================
// Helper: create a 2v2 CpuObservation
// ===========================================================================

/**
 * Create a CpuObservation that mimics 2v2 topology:
 *  - Two players on the same team (cpuTeamId).
 *  - One is the controlled player, the other is a teammate.
 *  - Ball just in range of the controlled player.
 */
function make2v2Observation(
  playerX: number,
  playerY: number,
  ballX: number,
  ballY: number,
  cpuTeamId: string,
  teammatePos: [number, number],
  controlledPlayerId: string = "cpu-player",
): CpuObservation {
  const teammateId = controlledPlayerId === "cpu-player"
    ? "teammate-2v2"
    : "cpu-player";

  return {
    players: [
      {
        playerId: controlledPlayerId,
        teamId: "team-cpu",
        groundPosition: { x: playerX, y: playerY },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
      },
      {
        playerId: teammateId,
        teamId: "team-cpu",
        groundPosition: { x: teammatePos[0], y: teammatePos[1] },
        linearVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
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
    teammates: [
      { playerId: teammateId, groundPosition: { x: teammatePos[0], y: teammatePos[1] } },
    ],
    controlledPlayerId,
  };
}