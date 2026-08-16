/**
 * @module tests/unit/scenario/3v3-browser-routing
 *
 * Unit tests for the 3v3 browser URL routing logic.
 *
 * Verifies:
 *  1. ?mode=ai-match-3v3 returns FOUNDATION_SCENARIO_3V3.
 *  2. ?mode=ai-match&scenario=3v3-fixture still works.
 *  3. Other modes do NOT return the 3v3 scenario.
 *  4. createWorld produces correct player counts for the 3v3 scenario.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";
import { selectBrowserScenario } from "../../../src/apps/browser/scenario-selector.js";
import { FOUNDATION_SCENARIO_3V3 } from "../../../src/apps/browser/foundation-scenario.js";
import { createWorld } from "../../../src/simulation/world/create.js";
import { FOUNDATION_SCENARIO } from "../../../src/apps/browser/foundation-scenario.js";
import { FOUNDATION_SCENARIO_2V2 } from "../../../src/apps/browser/foundation-scenario.js";
import { FOUNDATION_SCENARIO_AI_VS_AI } from "../../../src/apps/browser/foundation-scenario.js";

// ===========================================================================
// 1. Direct 3v3 URL mode
// ===========================================================================

describe("3v3 browser routing — direct mode", () => {
  it("returns 3v3 scenario for ?mode=ai-match-3v3", () => {
    const scenario = selectBrowserScenario("?mode=ai-match-3v3");
    expect(scenario).toBe(FOUNDATION_SCENARIO_3V3);
  });

  it("returns 3v3 scenario for ?mode=ai-match-3v3 with other params", () => {
    const scenario = selectBrowserScenario("?mode=ai-match-3v3&seed=42");
    expect(scenario).toBe(FOUNDATION_SCENARIO_3V3);
  });
});

// ===========================================================================
// 2. Existing 3v3 routing still works
// ===========================================================================

describe("3v3 browser routing — existing route", () => {
  it("returns 3v3 scenario for ?mode=ai-match&scenario=3v3-fixture", () => {
    const scenario = selectBrowserScenario("?mode=ai-match&scenario=3v3-fixture");
    expect(scenario).toBe(FOUNDATION_SCENARIO_3V3);
  });
});

// ===========================================================================
// 3. Other modes do NOT return 3v3
// ===========================================================================

describe("3v3 browser routing — exclusivity", () => {
  it("default mode returns foundation (not 3v3)", () => {
    const scenario = selectBrowserScenario("");
    expect(scenario).not.toBe(FOUNDATION_SCENARIO_3V3);
    expect(scenario).toBe(FOUNDATION_SCENARIO);
  });

  it("?mode=ai-match returns 1v1 AI match (not 3v3)", () => {
    const scenario = selectBrowserScenario("?mode=ai-match");
    expect(scenario).not.toBe(FOUNDATION_SCENARIO_3V3);
    expect(scenario).toBe(FOUNDATION_SCENARIO_AI_VS_AI);
  });

  it("?mode=2v2 returns 2v2 scenario (not 3v3)", () => {
    const scenario = selectBrowserScenario("?mode=2v2");
    expect(scenario).not.toBe(FOUNDATION_SCENARIO_3V3);
  });

  it("?mode=2v2-ai returns 2v2 AI scenario (not 3v3)", () => {
    const scenario = selectBrowserScenario("?mode=2v2-ai");
    expect(scenario).not.toBe(FOUNDATION_SCENARIO_3V3);
    expect(scenario).toBe(FOUNDATION_SCENARIO_2V2);
  });

  it("?mode=human-vs-ai returns human-vs-CPU scenario (not 3v3)", () => {
    const scenario = selectBrowserScenario("?mode=human-vs-ai");
    expect(scenario).not.toBe(FOUNDATION_SCENARIO_3V3);
  });
});

// ===========================================================================
// 4. createWorld produces correct player counts
// ===========================================================================

describe("3v3 browser routing — world creation", () => {
  it("createWorld produces 6 players from ai-match-3v3 mode", () => {
    const scenario = selectBrowserScenario("?mode=ai-match-3v3");
    const world = createWorld({ scenario });
    expect(world.players).toHaveLength(6);
  });

  it("createWorld produces 3 players per team from ai-match-3v3 mode", () => {
    const scenario = selectBrowserScenario("?mode=ai-match-3v3");
    const world = createWorld({ scenario });
    const teamA = world.players.filter((p) => p.teamId === "team-a");
    const teamB = world.players.filter((p) => p.teamId === "team-b");
    expect(teamA).toHaveLength(3);
    expect(teamB).toHaveLength(3);
  });

  it("createWorld preserves 6 control assignments from ai-match-3v3", () => {
    const scenario = selectBrowserScenario("?mode=ai-match-3v3");
    const world = createWorld({ scenario });
    expect(Object.keys(world.controlAssignments)).toHaveLength(6);
  });
});
