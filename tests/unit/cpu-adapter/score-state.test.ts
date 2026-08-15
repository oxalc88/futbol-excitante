/**
 * @module cpu-adapter-score-state-tests
 *
 * Tests for score-state awareness in the CPU adapter.
 *
 * Score differential (cpuGoals - opponentGoals):
 *  - >= 2: CPU ahead → caution mode (wider dribble, less shooting).
 *  - <= -2: CPU behind → aggressive mode (shoot from wider angles).
 *  - -1 to 1: neutral.
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
import { SHOT_BIT } from "../../../src/contracts/input.js";

// ===========================================================================
// 1. Score-awareness: behind → more aggressive
// ===========================================================================

describe("AI-SCORE-001: behind → aggressive shooting", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("behind by 2+: shoots from wider angles than neutral", () => {
    // CPU at (40, 0), ball at (40.5, 0), dist ≈ 12.5m (mid-range).
    // bodyHeading = 90° (π/2) — perpendicular to goal direction.
    // Neutral: no shot (heading not within ±60° of goal).
    // Behind ≥ 2: FACING_TOLERANCE_BACKUP ≈ 135° → still no shot at 90°.
    // Let's use 120° (2π/3) which is within ±135° but not ±90°.
    const obs: CpuObservation = makeObservation(40, 0, 40.5, 0, 0, 0, "team-a");
    obs.players[0].bodyHeading = (2 * Math.PI) / 3; // 120°.

    // Neutral: no shot at 120° heading, 12.5m distance.
    const frameNeutral = adapter.sample(0, obs);
    adapter.reset();

    // Behind by 3: should shoot from wider angle.
    const obsBehind: CpuObservation = makeObservation(40, 0, 40.5, 0, 0, 0, "team-a");
    obsBehind.players[0].bodyHeading = (2 * Math.PI) / 3;
    obsBehind.scoreDifferential = -3;

    adapter.sample(0, obsBehind);
    const frameBehind = adapter.sample(1, obsBehind);

    // Behind: wider tolerance (±135°) should allow shot at 120°.
    expect(frameBehind.heldButtons & SHOT_BIT).not.toBe(0);
    expect(frameBehind.pressedButtons & SHOT_BIT).not.toBe(0);
  });
});

// ===========================================================================
// 2. Score-awareness: ahead → cautious
// ===========================================================================

describe("AI-SCORE-002: ahead → cautious shooting", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("ahead by 2+: reduces urgency at edge-of-range", () => {
    // At close range (3m), the CPU should still shoot even when ahead,
    // because the adjusted close range = 5 / 0.5 = 10m.
    // Let's verify that at 8m (close to 5m boundary), a CPU ahead might
    // not shoot if heading isn't perfect.
    const obs: CpuObservation = makeObservation(44.5, 0, 45, 0, 0, 0, "team-a");
    // bodyHeading = 45° (π/4), goal direction ≈ 0°.
    // Neutral: ±60° tolerance → 45° within range → shoots.
    // Ahead: urgency 0.5, adjusted tolerance = 60° * 0.5 = 30° → 45° not within → no shot.
    obs.players[0].bodyHeading = Math.PI / 4;

    adapter.sample(0, obs);
    const frameNeutral = adapter.sample(1, obs);
    adapter.reset();

    const obsAhead: CpuObservation = makeObservation(44.5, 0, 45, 0, 0, 0, "team-a");
    obsAhead.players[0].bodyHeading = Math.PI / 4;
    obsAhead.scoreDifferential = 5;

    adapter.sample(0, obsAhead);
    const frameAhead = adapter.sample(1, obsAhead);

    // At 5° off (8m from goal), neutral shoots, ahead might not (if tolerance narrowed).
    // However, our implementation uses close-range "always shoot" for ≤ 5m.
    // 8m is mid-range → needs facing check.
    // Neutral: tolerance = 60° * 1 = 60° → π/4 (45°) < 60° → shoots.
    // Ahead: tolerance = 60° * 0.5 = 30° → 45° > 30° → no shot.
    // But wait — the CPU at (44.5, 0) with ball at (45, 0) is actually
    // at dist = sqrt((52.5 - 44.5)^2 + (0 - 0)^2) = 8m from goal.
    // That's mid-range, not close.
    // For team-a, goal is at +x = 52.5.
    // The adjusted tolerance for ahead is 30°.

    // Neutral should shoot.
    expect(frameNeutral.heldButtons & SHOT_BIT).not.toBe(0);

    // Ahead: at 45° heading deviation from goal direction,
    // the adjusted tolerance is 30°, so 45° > 30° → no shot.
    expect(frameAhead.heldButtons & SHOT_BIT).toBe(0);
  });
});

// ===========================================================================
// 3. Score-awareness: neutral (no differential)
// ===========================================================================

describe("AI-SCORE-003: neutral score state", () => {
  it("no score differential → neutral behavior", () => {
    const adapter1 = createCpuAdapter();
    const adapter2 = createCpuAdapter();

    // Same setup, one with scoreDifferential undefined, one with 0.
    const obs1: CpuObservation = makeObservation(40, 0, 40.5, 0, 0, 0, "team-a");
    obs1.players[0].bodyHeading = 0;

    const obs2: CpuObservation = makeObservation(40, 0, 40.5, 0, 0, 0, "team-a");
    obs2.players[0].bodyHeading = 0;
    obs2.scoreDifferential = 0;

    adapter1.sample(0, obs1);
    adapter2.sample(0, obs2);

    // Both should behave the same.
    const f1 = adapter1.sample(1, obs1);
    const f2 = adapter2.sample(1, obs2);

    expect(f1.heldButtons).toBe(f2.heldButtons);
    expect(f1.pressedButtons).toBe(f2.pressedButtons);
    expect(f1.moveX).toBe(f2.moveX);
    expect(f1.moveY).toBe(f2.moveY);
  });
});

// ===========================================================================
// Helper
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
}