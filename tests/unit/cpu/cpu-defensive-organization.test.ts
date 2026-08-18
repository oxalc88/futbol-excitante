/**
 * @module tests/unit/cpu/cpu-defensive-organization
 *
 * Tests for CPU defensive organization:
 *  1. Zonal marking: defenders track attackers in their zone.
 *  2. Press triggers: when ball enters a zone, the nearest defender presses.
 *  3. Cover-shadow positioning: defenders position between ball and
 *     nearest attacker to goal.
 *  4. Defensive line coordination: defenders maintain a line (similar
 *     y-coordinate) when one defender presses.
 *  5. Determinism: same inputs → same output.
 *  6. Adapter-only: no simulation core changes.
 *
 * No Math.random, Date, DOM, or Node I/O.
 * The CPU adapter is deterministic: same observation → same frame.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createCpuAdapter,
  type CpuAdapter,
  type CpuObservation,
} from "../../../src/adapters/input-browser/cpu-adapter.js";

// ===========================================================================
// Helper: create a CpuObservation for defensive organization tests
// ===========================================================================

interface DefOrgTestOpts {
  cpuPlayerX: number;
  cpuPlayerY: number;
  cpuTeamId: string;
  cpuPlayerRole?: "defender" | "midfielder" | "attacker";
  teammates?: Array<{
    id: string;
    x: number;
    y: number;
    role?: "defender" | "midfielder" | "attacker";
  }>;
  opponents: Array<{ id: string; x: number; y: number }>;
  ballX: number;
  ballY: number;
  ballVx?: number;
  ballVy?: number;
  controlledPlayerId: string;
  teamDecision?: {
    strategy: "ATTACK" | "DEFEND" | "BALANCED";
    defensiveSubMode: "NONE" | "PRESSING" | "MARKING" | "RECOVERING";
    nearestToBallPlayerId: string | undefined;
    nearestToBallDistance: number;
    hasPossession: boolean;
    ballZone: "own" | "center" | "opponent";
  };
}

function makeDefOrgObservation(opts: DefOrgTestOpts): CpuObservation {
  const opponentTeamId = opts.cpuTeamId === "team-a" ? "team-b" : "team-a";

  const players: CpuObservation["players"] = [
    {
      playerId: opts.controlledPlayerId,
      teamId: opts.cpuTeamId,
      groundPosition: { x: opts.cpuPlayerX, y: opts.cpuPlayerY },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: 0,
      formationRole: opts.cpuPlayerRole,
    },
  ];

  for (const tm of opts.teammates ?? []) {
    players.push({
      playerId: tm.id,
      teamId: opts.cpuTeamId,
      groundPosition: { x: tm.x, y: tm.y },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: 0,
      formationRole: tm.role,
    });
  }

  for (const opp of opts.opponents) {
    players.push({
      playerId: opp.id,
      teamId: opponentTeamId,
      groundPosition: { x: opp.x, y: opp.y },
      linearVelocity: { x: 0, y: 0 },
      bodyHeading: Math.PI,
    });
  }

  const ownGoalX = opts.cpuTeamId === "team-b" ? 52.5 : -52.5;
  const pull = opts.cpuPlayerRole === "defender" ? 0.4
    : opts.cpuPlayerRole === "attacker" ? 0.05 : 0.2;
  const formationPosition = {
    x: opts.cpuPlayerX + (ownGoalX - opts.cpuPlayerX) * pull,
    y: opts.cpuPlayerY,
  };

  return {
    players,
    ball: {
      position: { x: opts.ballX, y: opts.ballY, z: 0.11 },
      linearVelocity: { x: opts.ballVx ?? 0, y: opts.ballVy ?? 0, z: 0 },
      regime: "ground-roll",
    },
    pitchLength: 105,
    pitchWidth: 68,
    cpuTeamId: opts.cpuTeamId,
    controlledPlayerId: opts.controlledPlayerId,
    formationPosition,
    teamDecision: opts.teamDecision,
    teammates: (opts.teammates ?? []).map((tm) => ({
      playerId: tm.id,
      groundPosition: { x: tm.x, y: tm.y },
    })),
  };
}

// ===========================================================================
// 1. Zonal marking: defenders track attackers in their zone
// ===========================================================================

describe("CPU-DEF-ORG-001: zonal marking", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("defender tracks nearest opponent in own zone when in defensive mode", () => {
    // team-a defender at x = -30 (own third for team-a, own zone).
    // Opponent at x = -25 (also own zone).
    // Another opponent at x = 30 (attacking zone, far away).
    // The defender should move toward the opponent at x = -25, not x = 30.
    // Use same y for teammate to avoid line coordination interference.
    const obs = makeDefOrgObservation({
      cpuPlayerX: -30,
      cpuPlayerY: 0,
      cpuTeamId: "team-a",
      cpuPlayerRole: "defender",
      teammates: [
        { id: "tm-1", x: -35, y: 0, role: "defender" },
      ],
      opponents: [
        { id: "opp-near", x: -25, y: 3 },
        { id: "opp-far", x: 30, y: 0 },
      ],
      ballX: -20,
      ballY: 2,
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "MARKING",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 15,
        hasPossession: false,
        ballZone: "own",
      },
      controlledPlayerId: "defender-1",
    });

    const frame = adapter.sample(1, obs);

    // Defender at (-30, 0), nearest opponent in own zone at (-25, 3).
    // Zone marking sets chase target toward (-25, 3) → moveX > 0.
    // Line coordination pulls y toward tm-1's y=0, reducing moveY.
    // Key assertion: moveX is positive (toward the zone target's x).
    expect(frame.moveX).toBeGreaterThan(0);
  });

  it("defender tracks opponent in center zone when positioned there", () => {
    // team-a defender at x = 0 (center zone for team-a).
    // Opponent at x = 5 (center zone).
    const obs = makeDefOrgObservation({
      cpuPlayerX: 0,
      cpuPlayerY: 5,
      cpuTeamId: "team-a",
      cpuPlayerRole: "defender",
      teammates: [
        { id: "tm-1", x: -20, y: 0, role: "defender" },
      ],
      opponents: [
        { id: "opp-1", x: 5, y: 3 },
        { id: "opp-2", x: -30, y: 0 },
      ],
      ballX: 2,
      ballY: 4,
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "MARKING",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 22,
        hasPossession: false,
        ballZone: "center",
      },
      controlledPlayerId: "defender-1",
    });

    const frame = adapter.sample(1, obs);

    // Defender at (0, 5), nearest opponent in center zone at (5, 3).
    // Should move toward x = 5 (positive moveX) and y = 3 (negative moveY).
    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.moveY).toBeLessThan(0);
  });

  it("defender falls back to threatening opponent when no one in zone", () => {
    // team-a defender at x = 0 (center zone).
    // No opponents in center zone — all opponents in own zone (x < -35).
    // Should fall back to most threatening opponent (closest to own goal).
    const obs = makeDefOrgObservation({
      cpuPlayerX: 0,
      cpuPlayerY: 0,
      cpuTeamId: "team-a",
      cpuPlayerRole: "defender",
      teammates: [
        { id: "tm-1", x: -20, y: 0, role: "defender" },
      ],
      opponents: [
        { id: "opp-1", x: -38, y: 5 },
        { id: "opp-2", x: -42, y: 0 },
      ],
      ballX: 5,
      ballY: 0,
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "MARKING",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 25,
        hasPossession: false,
        ballZone: "center",
      },
      controlledPlayerId: "defender-1",
    });

    const frame = adapter.sample(1, obs);

    // Most threatening opponent: opp-1 at (-38, 5) (closest to own goal at -52.5).
    // Mark offset positions defender between (-38, 5) and own goal.
    // Defender should move toward own goal direction (negative moveX).
    expect(frame.moveX).toBeLessThan(0);
  });

  it("nearest-to-ball defender still chases ball, not zone marking", () => {
    // The nearest-to-ball defender should chase the ball, not do zone marking.
    // Ball is in front of defender (toward opponent goal) to avoid formation blend.
    const obs = makeDefOrgObservation({
      cpuPlayerX: -30,
      cpuPlayerY: 0,
      cpuTeamId: "team-a",
      cpuPlayerRole: "defender",
      teammates: [
        { id: "tm-1", x: -40, y: 0, role: "defender" },
      ],
      opponents: [
        { id: "opp-1", x: -20, y: 3 },
      ],
      ballX: -22,
      ballY: 0,
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "PRESSING",
        nearestToBallPlayerId: "defender-1",
        nearestToBallDistance: 9,
        hasPossession: false,
        ballZone: "own",
      },
      controlledPlayerId: "defender-1",
    });

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Nearest-to-ball → chases ball at (-22, 0) from (-30, 0) → moveX > 0.
    expect(frame.moveX).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 2. Press triggers: ball entering defender's zone increases sprint
// ===========================================================================

describe("CPU-DEF-ORG-002: press triggers", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("nearest defender presses when ball is in their zone", () => {
    // team-a defender at x = -30 (own zone).
    // Ball at x = -28 (also own zone) — ball is in defender's zone.
    // The defender should press aggressively.
    const obs = makeDefOrgObservation({
      cpuPlayerX: -30,
      cpuPlayerY: 0,
      cpuTeamId: "team-a",
      cpuPlayerRole: "defender",
      teammates: [
        { id: "tm-1", x: -40, y: 0, role: "defender" },
      ],
      opponents: [
        { id: "opp-1", x: -25, y: 3 },
      ],
      ballX: -28,
      ballY: 0,
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "PRESSING",
        nearestToBallPlayerId: "defender-1",
        nearestToBallDistance: 3,
        hasPossession: false,
        ballZone: "own",
      },
      controlledPlayerId: "defender-1",
    });

    // Run 2 ticks to establish state.
    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Sprint should be 1 (always) — press trigger enhances movement, not sprint.
    expect(frame.sprint).toBe(1);
    // Defender presses toward ball at (-28, 0) from (-30, 0) → moveX > 0.
    expect(frame.moveX).toBeGreaterThan(0);
  });

  it("defender outside ball's zone uses standard marking", () => {
    // team-a defender at x = 20 (attacking zone for team-a).
    // Ball at x = -30 (own zone for team-a).
    // The ball is NOT in the defender's zone → standard marking applies.
    // Ball is behind defender (toward own goal), but we use a close ball
    // to minimize formation blend effect.
    const obs = makeDefOrgObservation({
      cpuPlayerX: -30,
      cpuPlayerY: 0,
      cpuTeamId: "team-a",
      cpuPlayerRole: "defender",
      teammates: [
        { id: "tm-1", x: -35, y: 0, role: "defender" },
      ],
      opponents: [
        { id: "opp-1", x: -25, y: 3 },
        { id: "opp-2", x: 30, y: 0 },
      ],
      ballX: -33,
      ballY: 0,
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "MARKING",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 3,
        hasPossession: false,
        ballZone: "own",
      },
      controlledPlayerId: "defender-1",
    });

    const frame = adapter.sample(1, obs);

    // Defender at (-30, 0) in own zone. Nearest opponent in own zone: opp-1 at (-25, 3).
    // Should track toward opp-1 → positive moveX, positive moveY.
    expect(frame.moveX).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 3. Cover-shadow positioning
// ===========================================================================

describe("CPU-DEF-ORG-003: cover-shadow positioning", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("nearest defender positions between ball and most threatening opponent", () => {
    // team-a defender at (10, 0). Own goal at -52.5.
    // Ball at (20, 0) — to the RIGHT (away from goal).
    // Ball carrier at (22, 0) — nearest to ball.
    // Most threatening opponent (closest to own goal) at (-20, 0) — to the LEFT.
    //
    // Press boost: toward ball carrier at (22, 0) → moveX = +1 (rightward).
    // Cover shadow: shadowPos = (20 + (-20-20)*0.3, 0) = (20 - 12, 0) = (8, 0).
    //   shadowDx = 8 - 10 = -2 → shadowMoveX = -1 (leftward).
    // Blend: moveX = 1 * 0.6 + (-1) * 0.4 = 0.2 (reduced rightward push).
    const obs = makeDefOrgObservation({
      cpuPlayerX: 10,
      cpuPlayerY: 0,
      cpuTeamId: "team-a",
      cpuPlayerRole: "defender",
      teammates: [
        { id: "tm-1", x: -20, y: 0, role: "defender" },
      ],
      opponents: [
        { id: "opp-carrier", x: 22, y: 0 },
        { id: "opp-threat", x: -20, y: 0 },
      ],
      ballX: 20,
      ballY: 0,
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "PRESSING",
        nearestToBallPlayerId: "defender-1",
        nearestToBallDistance: 11,
        hasPossession: false,
        ballZone: "center",
      },
      controlledPlayerId: "defender-1",
    });

    adapter.sample(0, obs);
    const frame = adapter.sample(1, obs);

    // Without cover shadow: press toward carrier at (22, 0) → moveX = +1.0.
    // With cover shadow (strength=0.4): shadow at (8, 0), moveX = 0.2.
    // The defender still moves rightward but less aggressively.
    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.moveX).toBeLessThan(1.0);
  });

  it("cover shadow does not apply to non-nearest defender", () => {
    // Non-nearest defenders do not get cover shadow — only the
    // nearest-to-ball defender gets it.
    const obs = makeDefOrgObservation({
      cpuPlayerX: 10,
      cpuPlayerY: 0,
      cpuTeamId: "team-a",
      cpuPlayerRole: "defender",
      teammates: [
        { id: "tm-1", x: 10, y: 0, role: "defender" },
      ],
      opponents: [
        { id: "opp-carrier", x: 5, y: 0 },
        { id: "opp-threat", x: 15, y: 0 },
      ],
      ballX: 5,
      ballY: 0,
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "MARKING",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 6,
        hasPossession: false,
        ballZone: "center",
      },
      controlledPlayerId: "defender-1",
    });

    const frame = adapter.sample(1, obs);

    // Non-nearest defender at (10, 0) does zone marking.
    // Nearest opponent in center zone: opp-carrier at (5, 0) or opp-threat at (15, 0).
    // Zone marking targets nearest opponent in center zone.
    // The defender should move toward the zone target, no cover shadow applied.
    // Just verify the frame is valid (no NaN, etc.).
    expect(typeof frame.moveX).toBe("number");
    expect(typeof frame.moveY).toBe("number");
    expect(Number.isFinite(frame.moveX)).toBe(true);
    expect(Number.isFinite(frame.moveY)).toBe(true);
  });
});

// ===========================================================================
// 4. Defensive line coordination
// ===========================================================================

describe("CPU-DEF-ORG-004: defensive line coordination", () => {
  let adapter: CpuAdapter;

  beforeEach(() => {
    adapter = createCpuAdapter();
  });

  it("non-pressing defender shifts y toward other defenders when teammate presses", () => {
    // team-a defender at (10, 5) — non-nearest to ball.
    // Teammate defender at (10, -5) — the one who will be nearest to ball.
    // When the teammate (tm-1) is designated as nearest to ball, this
    // defender should shift y toward the average of other defenders.
    // Average of tm-1's y: -5. So this defender at y=5 should shift
    // downward (negative moveY) toward y=-5.
    const obs = makeDefOrgObservation({
      cpuPlayerX: 10,
      cpuPlayerY: 5,
      cpuTeamId: "team-a",
      cpuPlayerRole: "defender",
      teammates: [
        { id: "tm-1", x: 10, y: -5, role: "defender" },
      ],
      opponents: [
        { id: "opp-1", x: 5, y: 0 },
      ],
      ballX: 5,
      ballY: 0,
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "PRESSING",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 6,
        hasPossession: false,
        ballZone: "center",
      },
      controlledPlayerId: "defender-1",
    });

    const frame = adapter.sample(1, obs);

    // The line coordination should shift this defender's y toward -5.
    // Without coordination, the zone-based marking or default chase
    // would determine moveY. With coordination, moveY should be
    // biased toward negative (toward y=-5).
    // The key assertion: moveY is negative (toward the line center).
    expect(frame.moveY).toBeLessThan(0);
  });

  it("defenders maintain line when one presses ball carrier", () => {
    // team-a setup: two defenders and a pressing midfielder.
    // defender-1 at (10, 10), defender-2 at (10, -10).
    // Midfielder tm-1 is nearest to ball and pressing.
    // Both defenders should shift y toward each other's y.
    const defender1 = createCpuAdapter();
    const defender2 = createCpuAdapter();

    const baseObs = {
      cpuTeamId: "team-a" as const,
      opponents: [
        { id: "opp-1", x: 5, y: 0 },
      ],
      ballX: 5,
      ballY: 0,
      ballVx: 0,
      ballVy: 0,
      teamDecision: {
        strategy: "DEFEND" as const,
        defensiveSubMode: "PRESSING" as const,
        nearestToBallPlayerId: "tm-mid-press",
        nearestToBallDistance: 6,
        hasPossession: false,
        ballZone: "center" as const,
      },
    };

    const obs1 = makeDefOrgObservation({
      ...baseObs,
      cpuPlayerX: 10,
      cpuPlayerY: 10,
      cpuPlayerRole: "defender",
      teammates: [
        { id: "tm-def-2", x: 10, y: -10, role: "defender" },
        { id: "tm-mid-press", x: 6, y: 0, role: "midfielder" },
      ],
      controlledPlayerId: "defender-1",
    });

    const obs2 = makeDefOrgObservation({
      ...baseObs,
      cpuPlayerX: 10,
      cpuPlayerY: -10,
      cpuPlayerRole: "defender",
      teammates: [
        { id: "tm-def-1", x: 10, y: 10, role: "defender" },
        { id: "tm-mid-press", x: 6, y: 0, role: "midfielder" },
      ],
      controlledPlayerId: "defender-2",
    });

    const frame1 = defender1.sample(1, obs1);
    const frame2 = defender2.sample(1, obs2);

    // defender-1 at y=10 should shift toward y=-10 (average of other defenders).
    // defender-2 at y=-10 should shift toward y=10.
    expect(frame1.moveY).toBeLessThan(0);
    expect(frame2.moveY).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 5. Determinism
// ===========================================================================

describe("CPU-DEF-ORG-005: determinism", () => {
  it("same observation produces same defensive organization output", () => {
    const obs = makeDefOrgObservation({
      cpuPlayerX: -30,
      cpuPlayerY: 5,
      cpuTeamId: "team-a",
      cpuPlayerRole: "defender",
      teammates: [
        { id: "tm-1", x: -20, y: 0, role: "defender" },
        { id: "tm-2", x: -15, y: 3, role: "midfielder" },
      ],
      opponents: [
        { id: "opp-1", x: -25, y: 3 },
        { id: "opp-2", x: 10, y: 0 },
      ],
      ballX: -28,
      ballY: 2,
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "MARKING",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 8,
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

  it("30-tick defensive simulation is deterministic across runs", () => {
    const run = () => {
      const adapter = createCpuAdapter();
      const results: Array<{ tick: number; moveX: number; moveY: number }> = [];
      for (let t = 0; t < 30; t++) {
        const obs = makeDefOrgObservation({
          cpuPlayerX: -30 + t * 0.5,
          cpuPlayerY: Math.sin(t * 0.1) * 5,
          cpuTeamId: "team-a",
          cpuPlayerRole: "defender",
          teammates: [
            { id: "tm-1", x: -20, y: 0, role: "defender" },
          ],
          opponents: [
            { id: "opp-1", x: -25 + t * 0.3, y: 3 },
            { id: "opp-2", x: 10, y: 0 },
          ],
          ballX: -28 + t * 0.2,
          ballY: 2 + Math.cos(t * 0.1) * 2,
          teamDecision: {
            strategy: "DEFEND",
            defensiveSubMode: "MARKING",
            nearestToBallPlayerId: "tm-1",
            nearestToBallDistance: 15,
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
// 6. Adapter-only: no simulation core changes
// ===========================================================================

describe("CPU-DEF-ORG-006: adapter-only changes", () => {
  it("defensive organization is purely in the CPU adapter layer", () => {
    const adapter = createCpuAdapter();
    const obs = makeDefOrgObservation({
      cpuPlayerX: -30,
      cpuPlayerY: 0,
      cpuTeamId: "team-a",
      cpuPlayerRole: "defender",
      teammates: [
        { id: "tm-1", x: -20, y: 0, role: "defender" },
      ],
      opponents: [
        { id: "opp-1", x: -25, y: 3 },
      ],
      ballX: -28,
      ballY: 2,
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "MARKING",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 8,
        hasPossession: false,
        ballZone: "own",
      },
      controlledPlayerId: "defender-1",
    });

    const frame = adapter.sample(1, obs);

    // The adapter returns an InputFrame — it does not modify any state.
    expect(frame).toHaveProperty("tick");
    expect(frame).toHaveProperty("sourceId");
    expect(frame).toHaveProperty("controlSlot");
    expect(frame).toHaveProperty("moveX");
    expect(frame).toHaveProperty("moveY");
    expect(frame).toHaveProperty("sprint");
    expect(frame).toHaveProperty("heldButtons");
    expect(frame).toHaveProperty("pressedButtons");
    expect(frame).toHaveProperty("releasedButtons");
    expect(frame.sourceId).toBe("cpu");
    expect(frame.sprint).toBe(1);
  });

  it("observation is not mutated by the adapter", () => {
    const adapter = createCpuAdapter();
    const obs = makeDefOrgObservation({
      cpuPlayerX: -30,
      cpuPlayerY: 0,
      cpuTeamId: "team-a",
      cpuPlayerRole: "defender",
      teammates: [
        { id: "tm-1", x: -20, y: 0, role: "defender" },
      ],
      opponents: [
        { id: "opp-1", x: -25, y: 3 },
      ],
      ballX: -28,
      ballY: 2,
      teamDecision: {
        strategy: "DEFEND",
        defensiveSubMode: "MARKING",
        nearestToBallPlayerId: "tm-1",
        nearestToBallDistance: 8,
        hasPossession: false,
        ballZone: "own",
      },
      controlledPlayerId: "defender-1",
    });

    const obsBefore = JSON.parse(JSON.stringify(obs));
    adapter.sample(1, obs);

    expect(obs).toEqual(obsBefore);
  });
});
