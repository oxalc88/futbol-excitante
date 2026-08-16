/**
 * @module tests/unit/browser/2v2-with-keyboard-scenario
 *
 * Tests for the 2v2-with-keyboard scenario fixture.
 *
 * Verifies:
 *  1. The fixture loads 4 players (2 per team).
 *  2. Control assignments: slot-1 = HUMAN, slots 2-4 = AI_FALLBACK.
 *  3. The scenario selector returns it for ?mode=2v2.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";
import { FOUNDATION_SCENARIO_2V2_KEYBOARD } from "../../../src/apps/browser/foundation-scenario.js";
import { selectBrowserScenario } from "../../../src/apps/browser/scenario-selector.js";
import { createWorld } from "../../../src/simulation/world/create.js";

describe("2v2-with-keyboard scenario fixture", () => {
  it("loads 4 players total", () => {
    expect(FOUNDATION_SCENARIO_2V2_KEYBOARD.players).toHaveLength(4);
  });

  it("has 2 players on team-a", () => {
    const teamA = FOUNDATION_SCENARIO_2V2_KEYBOARD.players.filter(
      (p) => p.teamId === "team-a",
    );
    expect(teamA).toHaveLength(2);
  });

  it("has 2 players on team-b", () => {
    const teamB = FOUNDATION_SCENARIO_2V2_KEYBOARD.players.filter(
      (p) => p.teamId === "team-b",
    );
    expect(teamB).toHaveLength(2);
  });

  it("has 4 control slots", () => {
    const assignments = FOUNDATION_SCENARIO_2V2_KEYBOARD.controlAssignments;
    expect(Object.keys(assignments)).toHaveLength(4);
  });

  it("maps slot-1 to team-a player-1 (HUMAN)", () => {
    const s1 = FOUNDATION_SCENARIO_2V2_KEYBOARD.controlAssignments["slot-1"];
    expect(s1.teamId).toBe("team-a");
    expect(s1.controlledPlayerId).toBe("player-1");
    expect(s1.mode).toBe("HUMAN");
  });

  it("maps slot-2 to team-b player-3 (AI_FALLBACK)", () => {
    const s2 = FOUNDATION_SCENARIO_2V2_KEYBOARD.controlAssignments["slot-2"];
    expect(s2.teamId).toBe("team-b");
    expect(s2.controlledPlayerId).toBe("player-3");
    expect(s2.mode).toBe("AI_FALLBACK");
  });

  it("maps slot-3 to team-a player-2 (AI_FALLBACK)", () => {
    const s3 = FOUNDATION_SCENARIO_2V2_KEYBOARD.controlAssignments["slot-3"];
    expect(s3.teamId).toBe("team-a");
    expect(s3.controlledPlayerId).toBe("player-2");
    expect(s3.mode).toBe("AI_FALLBACK");
  });

  it("maps slot-4 to team-b player-4 (AI_FALLBACK)", () => {
    const s4 = FOUNDATION_SCENARIO_2V2_KEYBOARD.controlAssignments["slot-4"];
    expect(s4.teamId).toBe("team-b");
    expect(s4.controlledPlayerId).toBe("player-4");
    expect(s4.mode).toBe("AI_FALLBACK");
  });

  it("has 5400 ticks duration", () => {
    expect(FOUNDATION_SCENARIO_2V2_KEYBOARD.durationTicks).toBe(5400);
  });

  it("has 1 HUMAN slot and 3 AI_FALLBACK slots", () => {
    const modes = Object.values(FOUNDATION_SCENARIO_2V2_KEYBOARD.controlAssignments).map(
      (a) => a.mode,
    );
    expect(modes.filter((m) => m === "HUMAN")).toHaveLength(1);
    expect(modes.filter((m) => m === "AI_FALLBACK")).toHaveLength(3);
  });

  it("world creates 4 players from scenario", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_2V2_KEYBOARD });
    expect(world.players).toHaveLength(4);
    expect(world.ball).toBeDefined();
  });
});

describe("scenario selector returns 2v2-with-keyboard for mode=2v2", () => {
  it("returns 2v2 keyboard scenario for ?mode=2v2", () => {
    const scenario = selectBrowserScenario("?mode=2v2");
    expect(scenario).toBe(FOUNDATION_SCENARIO_2V2_KEYBOARD);
  });
});
