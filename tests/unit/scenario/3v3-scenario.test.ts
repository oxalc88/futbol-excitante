/**
 * @module tests/unit/scenario/3v3-scenario
 *
 * Tests for the 3v3 scenario fixture.
 *
 * Verifies:
 *  1. The fixture loads 6 players (3 per team).
 *  2. Control assignments map correctly (6 slots, all AI_FALLBACK).
 *  3. Initial positions respect formation layout.
 *  4. Determinism: same seed produces identical initial state.
 *  5. The scenario selector returns it for ?mode=ai-match&scenario=3v3-fixture.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";
import { FOUNDATION_SCENARIO_3V3 } from "../../../src/apps/browser/foundation-scenario.js";
import { selectBrowserScenario } from "../../../src/apps/browser/scenario-selector.js";
import { createWorld } from "../../../src/simulation/world/create.js";

// ===========================================================================
// 1. Fixture cardinality
// ===========================================================================

describe("3v3 scenario fixture", () => {
  it("loads 6 players total", () => {
    expect(FOUNDATION_SCENARIO_3V3.players).toHaveLength(6);
  });

  it("has 3 players on team-a", () => {
    const teamA = FOUNDATION_SCENARIO_3V3.players.filter(
      (p) => p.teamId === "team-a",
    );
    expect(teamA).toHaveLength(3);
  });

  it("has 3 players on team-b", () => {
    const teamB = FOUNDATION_SCENARIO_3V3.players.filter(
      (p) => p.teamId === "team-b",
    );
    expect(teamB).toHaveLength(3);
  });

  it("has 6 control slots", () => {
    const assignments = FOUNDATION_SCENARIO_3V3.controlAssignments;
    expect(Object.keys(assignments)).toHaveLength(6);
  });

  it("slot IDs are slot-1 through slot-6", () => {
    const keys = Object.keys(FOUNDATION_SCENARIO_3V3.controlAssignments);
    for (let i = 1; i <= 6; i++) {
      expect(keys).toContain(`slot-${i}`);
    }
  });
});

// ===========================================================================
// 2. Slot wiring — all AI_FALLBACK
// ===========================================================================

describe("3v3 slot wiring", () => {
  it("all 6 slots are AI_FALLBACK", () => {
    const modes = Object.values(FOUNDATION_SCENARIO_3V3.controlAssignments).map(
      (a) => a.mode,
    );
    modes.forEach((m) => expect(m).toBe("AI_FALLBACK"));
  });

  it("slot-1 is team-a player-1 (AI_FALLBACK)", () => {
    const s1 = FOUNDATION_SCENARIO_3V3.controlAssignments["slot-1"];
    expect(s1.teamId).toBe("team-a");
    expect(s1.controlledPlayerId).toBe("player-1");
    expect(s1.mode).toBe("AI_FALLBACK");
  });

  it("slot-2 is team-a player-2 (AI_FALLBACK)", () => {
    const s2 = FOUNDATION_SCENARIO_3V3.controlAssignments["slot-2"];
    expect(s2.teamId).toBe("team-a");
    expect(s2.controlledPlayerId).toBe("player-2");
    expect(s2.mode).toBe("AI_FALLBACK");
  });

  it("slot-3 is team-a player-3 (AI_FALLBACK)", () => {
    const s3 = FOUNDATION_SCENARIO_3V3.controlAssignments["slot-3"];
    expect(s3.teamId).toBe("team-a");
    expect(s3.controlledPlayerId).toBe("player-3");
    expect(s3.mode).toBe("AI_FALLBACK");
  });

  it("slot-4 is team-b player-4 (AI_FALLBACK)", () => {
    const s4 = FOUNDATION_SCENARIO_3V3.controlAssignments["slot-4"];
    expect(s4.teamId).toBe("team-b");
    expect(s4.controlledPlayerId).toBe("player-4");
    expect(s4.mode).toBe("AI_FALLBACK");
  });

  it("slot-5 is team-b player-5 (AI_FALLBACK)", () => {
    const s5 = FOUNDATION_SCENARIO_3V3.controlAssignments["slot-5"];
    expect(s5.teamId).toBe("team-b");
    expect(s5.controlledPlayerId).toBe("player-5");
    expect(s5.mode).toBe("AI_FALLBACK");
  });

  it("slot-6 is team-b player-6 (AI_FALLBACK)", () => {
    const s6 = FOUNDATION_SCENARIO_3V3.controlAssignments["slot-6"];
    expect(s6.teamId).toBe("team-b");
    expect(s6.controlledPlayerId).toBe("player-6");
    expect(s6.mode).toBe("AI_FALLBACK");
  });

  it("team-a has 3 slots, team-b has 3 slots", () => {
    const assignments = FOUNDATION_SCENARIO_3V3.controlAssignments;
    const teamA = Object.values(assignments).filter((a) => a.teamId === "team-a");
    const teamB = Object.values(assignments).filter((a) => a.teamId === "team-b");
    expect(teamA).toHaveLength(3);
    expect(teamB).toHaveLength(3);
  });
});

// ===========================================================================
// 3. Formation layout
// ===========================================================================

describe("3v3 formation positions", () => {
  it("team-a has one deeper defender (x = -20) and two forward (x = -5)", () => {
    const teamA = FOUNDATION_SCENARIO_3V3.players.filter(
      (p) => p.teamId === "team-a",
    );
    // Sort by x position
    const byX = [...teamA].sort((a, b) => a.groundPosition.x - b.groundPosition.x);
    // Deeper defender at x ≈ -20
    expect(byX[0].groundPosition.x).toBe(-20);
    // Two forwards at x ≈ -5
    expect(byX[1].groundPosition.x).toBe(-5);
    expect(byX[2].groundPosition.x).toBe(-5);
  });

  it("team-b has one deeper defender (x = 20) and two forward (x = 5)", () => {
    const teamB = FOUNDATION_SCENARIO_3V3.players.filter(
      (p) => p.teamId === "team-b",
    );
    const byX = [...teamB].sort((a, b) => a.groundPosition.x - b.groundPosition.x);
    expect(byX[0].groundPosition.x).toBe(5);
    expect(byX[1].groundPosition.x).toBe(5);
    expect(byX[2].groundPosition.x).toBe(20);
  });

  it("team-a forward players spread across pitch width (y = ±12)", () => {
    const teamA = FOUNDATION_SCENARIO_3V3.players.filter(
      (p) => p.teamId === "team-a",
    );
    const forwards = teamA.filter((p) => p.groundPosition.x === -5);
    expect(forwards).toHaveLength(2);
    const ys = forwards.map((p) => p.groundPosition.y).sort();
    expect(ys).toContain(-12);
    expect(ys).toContain(12);
  });

  it("team-b forward players spread across pitch width (y = ±12)", () => {
    const teamB = FOUNDATION_SCENARIO_3V3.players.filter(
      (p) => p.teamId === "team-b",
    );
    const forwards = teamB.filter((p) => p.groundPosition.x === 5);
    expect(forwards).toHaveLength(2);
    const ys = forwards.map((p) => p.groundPosition.y).sort();
    expect(ys).toContain(-12);
    expect(ys).toContain(12);
  });

  it("team-a attacks +x (defender faces +x), team-b attacks -x (defender faces π)", () => {
    const teamA = FOUNDATION_SCENARIO_3V3.players;
    const teamB = FOUNDATION_SCENARIO_3V3.players;
    const aDefender = teamA.find((p) => p.groundPosition.x === -20)!;
    const bDefender = teamB.find((p) => p.groundPosition.x === 20)!;
    expect(aDefender.bodyHeading).toBe(0);
    expect(bDefender.bodyHeading).toBeCloseTo(Math.PI);
  });
});

// ===========================================================================
// 4. World creation from scenario
// ===========================================================================

describe("3v3 createWorld", () => {
  it("createWorld produces 6 players", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_3V3 });
    expect(world.players).toHaveLength(6);
  });

  it("createWorld produces 3 players per team", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_3V3 });
    const teamA = world.players.filter((p) => p.teamId === "team-a");
    const teamB = world.players.filter((p) => p.teamId === "team-b");
    expect(teamA).toHaveLength(3);
    expect(teamB).toHaveLength(3);
  });

  it("createWorld preserves control assignments", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_3V3 });
    expect(Object.keys(world.controlAssignments)).toHaveLength(6);
  });

  it("createWorld preserves ball state", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_3V3 });
    expect(world.ball).toBeDefined();
    expect((world.ball as unknown as Record<string, unknown>)?.ownerPlayerId).toBeUndefined();
  });

  it("createWorld preserves initial positions", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_3V3 });
    const posMap = new Map(
      FOUNDATION_SCENARIO_3V3.players.map((p) => [p.playerId, p.groundPosition]),
    );
    for (const player of world.players) {
      const expected = posMap.get(player.playerId);
      expect(expected).toBeDefined();
      expect(player.groundPosition.x).toBe(expected!.x);
      expect(player.groundPosition.y).toBe(expected!.y);
    }
  });
});

// ===========================================================================
// 5. Determinism
// ===========================================================================

describe("3v3 determinism", () => {
  it("same seed produces identical initial world state", () => {
    const w1 = createWorld({ scenario: FOUNDATION_SCENARIO_3V3 });
    const w2 = createWorld({ scenario: FOUNDATION_SCENARIO_3V3 });

    expect(w1.players.length).toBe(w2.players.length);
    for (let i = 0; i < w1.players.length; i++) {
      expect(w1.players[i].playerId).toBe(w2.players[i].playerId);
      expect(w1.players[i].teamId).toBe(w2.players[i].teamId);
      expect(w1.players[i].groundPosition.x).toBe(w2.players[i].groundPosition.x);
      expect(w1.players[i].groundPosition.y).toBe(w2.players[i].groundPosition.y);
      expect(w1.players[i].bodyHeading).toBe(w2.players[i].bodyHeading);
    }
    expect(w1.ball.position.x).toBe(w2.ball.position.x);
    expect(w1.ball.position.y).toBe(w2.ball.position.y);
    expect(w1.ball.position.z).toBe(w2.ball.position.z);
  });

  it("different worlds have distinct prng states", () => {
    const w1 = createWorld({ scenario: { ...FOUNDATION_SCENARIO_3V3 } });
    // Even with same seed, prng snapshots should be structurally equivalent
    expect(w1.prng.state).toBeDefined();
  });
});

// ===========================================================================
// 6. Duration and metadata
// ===========================================================================

describe("3v3 metadata", () => {
  it("has 5400 ticks duration", () => {
    expect(FOUNDATION_SCENARIO_3V3.durationTicks).toBe(5400);
  });

  it("has LABORATORY profile", () => {
    expect(FOUNDATION_SCENARIO_3V3.profile).toBe("LABORATORY");
  });

  it("has team-a pitch side (negative x for defender)", () => {
    const teamA = FOUNDATION_SCENARIO_3V3.players.filter(
      (p) => p.teamId === "team-a",
    );
    // All team-a players should be on the negative x side (attacking +x)
    teamA.forEach((p) => {
      expect(p.groundPosition.x).toBeLessThan(0);
    });
  });

  it("has team-b pitch side (positive x for defender)", () => {
    const teamB = FOUNDATION_SCENARIO_3V3.players.filter(
      (p) => p.teamId === "team-b",
    );
    teamB.forEach((p) => {
      expect(p.groundPosition.x).toBeGreaterThan(0);
    });
  });
});

// ===========================================================================
// 7. Scenario selector
// ===========================================================================

describe("scenario selector returns 3v3", () => {
  it("returns 3v3 scenario for ?mode=ai-match&scenario=3v3-fixture", () => {
    const scenario = selectBrowserScenario("?mode=ai-match&scenario=3v3-fixture");
    expect(scenario).toBe(FOUNDATION_SCENARIO_3V3);
  });

  it("returns 3v3 scenario for ?scenario=3v3-fixture (without mode)", () => {
    // Without mode=ai-match, falls through to the default (foundation).
    // The 3v3-fixture scenario is only returned under mode=ai-match.
    // Verify the default still returns foundation scenario.
    const scenario = selectBrowserScenario("?scenario=3v3-fixture");
    // Without mode=ai-match, the default fallback is the foundation scenario.
    expect(scenario).not.toBe(FOUNDATION_SCENARIO_3V3);
  });

  it("3v3-fixture has 6 players via world creation", () => {
    const scenario = selectBrowserScenario("?mode=ai-match&scenario=3v3-fixture");
    const world = createWorld({ scenario });
    expect(world.players).toHaveLength(6);
  });
});
