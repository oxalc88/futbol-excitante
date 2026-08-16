/**
 * @module tests/unit/browser/2v2-scenario
 *
 * Tests for the 2v2 scenario fixture.
 *
 * Verifies:
 *  1. The fixture loads 4 players (2 per team).
 *  2. Control assignments map correctly.
 *  3. The scenario selector returns it for ?scenario=2v2.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";
import { FOUNDATION_SCENARIO_2V2 } from "../../../src/apps/browser/foundation-scenario.js";
import { selectBrowserScenario } from "../../../src/apps/browser/scenario-selector.js";

describe("2v2 scenario fixture", () => {
  it("loads 4 players total", () => {
    expect(FOUNDATION_SCENARIO_2V2.players).toHaveLength(4);
  });

  it("has 2 players on team-a", () => {
    const teamA = FOUNDATION_SCENARIO_2V2.players.filter(
      (p) => p.teamId === "team-a",
    );
    expect(teamA).toHaveLength(2);
  });

  it("has 2 players on team-b", () => {
    const teamB = FOUNDATION_SCENARIO_2V2.players.filter(
      (p) => p.teamId === "team-b",
    );
    expect(teamB).toHaveLength(2);
  });

  it("has 4 control slots", () => {
    const assignments = FOUNDATION_SCENARIO_2V2.controlAssignments;
    expect(Object.keys(assignments)).toHaveLength(4);
  });

  it("maps slot-1 to team-a player-1 (AI_FALLBACK)", () => {
    const s1 = FOUNDATION_SCENARIO_2V2.controlAssignments["slot-1"];
    expect(s1.teamId).toBe("team-a");
    expect(s1.controlledPlayerId).toBe("player-1");
    expect(s1.mode).toBe("AI_FALLBACK");
  });

  it("maps slot-2 to team-b player-3 (AI_FALLBACK)", () => {
    const s2 = FOUNDATION_SCENARIO_2V2.controlAssignments["slot-2"];
    expect(s2.teamId).toBe("team-b");
    expect(s2.controlledPlayerId).toBe("player-3");
    expect(s2.mode).toBe("AI_FALLBACK");
  });

  it("maps slot-3 to team-a player-2 (AI_FALLBACK)", () => {
    const s3 = FOUNDATION_SCENARIO_2V2.controlAssignments["slot-3"];
    expect(s3.teamId).toBe("team-a");
    expect(s3.controlledPlayerId).toBe("player-2");
    expect(s3.mode).toBe("AI_FALLBACK");
  });

  it("maps slot-4 to team-b player-4 (AI_FALLBACK)", () => {
    const s4 = FOUNDATION_SCENARIO_2V2.controlAssignments["slot-4"];
    expect(s4.teamId).toBe("team-b");
    expect(s4.controlledPlayerId).toBe("player-4");
    expect(s4.mode).toBe("AI_FALLBACK");
  });

  it("has 5400 ticks duration", () => {
    expect(FOUNDATION_SCENARIO_2V2.durationTicks).toBe(5400);
  });
});

describe("scenario selector returns 2v2", () => {
  it("returns 2v2 scenario for ?scenario=2v2", () => {
    const scenario = selectBrowserScenario("?scenario=2v2");
    expect(scenario).toBe(FOUNDATION_SCENARIO_2V2);
  });
});