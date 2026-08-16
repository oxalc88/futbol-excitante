/**
 * @module browser-scenario-selector-tests
 *
 * Tests for PLAYABLE-SECOND-SLOT: the scenario selector that wires the
 * browser composition to load either the one-player foundation scenario
 * or the two-player duel scenario based on URL query parameters.
 *
 * Tests:
 *  1. Empty search → one-player scenario (no slot-2).
 *  2. ?scenario=two-player → two-player scenario (slot-1 + slot-2 HUMAN).
 *  3. ?slots=2 alias → same as ?scenario=two-player.
 *  4. Unknown query → falls back to one-player.
 *  5. Two-player world has two players and one independent ball.
 *
 * No DOM, Date, or Node I/O in this module.
 */

import { describe, it, expect } from "vitest";
import { selectBrowserScenario } from "../../src/apps/browser/scenario-selector.js";
import { createWorld } from "../../src/simulation/world/create.js";
import type { WorldState } from "../../src/contracts/state.js";

// ---------------------------------------------------------------------------
// 1. Empty search → one-player scenario
// ---------------------------------------------------------------------------

describe("BROWSER-SCENARIO-SELECTOR-001: default to one-player", () => {
  it("empty search returns one-player scenario", () => {
    const scenario = selectBrowserScenario("");
    // Foundation scenario has exactly one player.
    const world = createWorld({ scenario });
    expect(world.players.length).toBe(1);
    // No slot-2 assignment.
    expect(world.controlAssignments["slot-2"]).toBeUndefined();
    expect(world.controlAssignments["slot-1"]).toBeDefined();
  });

  it("undefined search returns one-player scenario", () => {
    const scenario = selectBrowserScenario("");
    const world = createWorld({ scenario });
    expect(world.players.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 2. ?scenario=two-player → two-player scenario
// ---------------------------------------------------------------------------

describe("BROWSER-SCENARIO-SELECTOR-002: ?scenario=two-player", () => {
  it("returns two-player scenario", () => {
    const scenario = selectBrowserScenario("?scenario=two-player");
    const world = createWorld({ scenario });
    expect(world.players.length).toBe(2);
  });

  it("two-player scenario has slot-1 and slot-2 HUMAN assignments", () => {
    const scenario = selectBrowserScenario("?scenario=two-player");
    const slot1 = scenario.controlAssignments["slot-1"];
    const slot2 = scenario.controlAssignments["slot-2"];
    expect(slot1).toBeDefined();
    expect(slot1.mode).toBe("HUMAN");
    expect(slot2).toBeDefined();
    expect(slot2.mode).toBe("HUMAN");
  });

  it("after selection, two-player world has two players and one independent ball", () => {
    const scenario = selectBrowserScenario("?scenario=two-player");
    const world: WorldState = createWorld({ scenario });
    expect(world.players.length).toBe(2);
    expect(world.ball).toBeDefined();
    expect((world.ball as unknown as Record<string, unknown>)?.ownerPlayerId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. ?slots=2 alias
// ---------------------------------------------------------------------------

describe("BROWSER-SCENARIO-SELECTOR-003: ?slots=2 alias", () => {
  it("returns two-player scenario for ?slots=2", () => {
    const scenario = selectBrowserScenario("?slots=2");
    const world = createWorld({ scenario });
    expect(world.players.length).toBe(2);
    expect(world.controlAssignments["slot-2"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Unknown query → falls back to one-player
// ---------------------------------------------------------------------------

describe("BROWSER-SCENARIO-SELECTOR-004: unknown query falls back", () => {
  it("unknown scenario value returns one-player", () => {
    const scenario = selectBrowserScenario("?scenario=unknown");
    const world = createWorld({ scenario });
    expect(world.players.length).toBe(1);
  });

  it("extra params with unknown value returns one-player", () => {
    const scenario = selectBrowserScenario("?scenario=foo&debug=1");
    const world = createWorld({ scenario });
    expect(world.players.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5. ?mode=ai-match&scenario=2v2 → 2v2 AI match scenario
// ---------------------------------------------------------------------------

describe("BROWSER-SCENARIO-SELECTOR-005: ?mode=ai-match&scenario=2v2", () => {
  it("returns 2v2 scenario for ?mode=ai-match&scenario=2v2", async () => {
    const { FOUNDATION_SCENARIO_2V2 } =
      await import("../../src/apps/browser/foundation-scenario.js");
    const scenario = selectBrowserScenario("?mode=ai-match&scenario=2v2");
    expect(scenario).toBe(FOUNDATION_SCENARIO_2V2);
    const world = createWorld({ scenario });
    expect(world.players.length).toBe(4);
    // 4 control slots → 4 CPU adapters.
    expect(Object.keys(scenario.controlAssignments)).toHaveLength(4);
  });

  it("mode=ai-match alone returns 1v1 AI-vs-AI (not 2v2)", async () => {
    const { FOUNDATION_SCENARIO_AI_VS_AI } =
      await import("../../src/apps/browser/foundation-scenario.js");
    const scenario = selectBrowserScenario("?mode=ai-match");
    expect(scenario).toBe(FOUNDATION_SCENARIO_AI_VS_AI);
  });

  it("scenario=2v2 without mode=ai-match returns 2v2", async () => {
    const { FOUNDATION_SCENARIO_2V2 } =
      await import("../../src/apps/browser/foundation-scenario.js");
    const scenario = selectBrowserScenario("?scenario=2v2");
    expect(scenario).toBe(FOUNDATION_SCENARIO_2V2);
  });
});

// ---------------------------------------------------------------------------
// 6. ?mode=human-vs-ai → human-vs-CPU scenario
// ---------------------------------------------------------------------------

describe("BROWSER-SCENARIO-SELECTOR-006: ?mode=human-vs-ai", () => {
  it("returns human-vs-CPU scenario for ?mode=human-vs-ai", async () => {
    const { FOUNDATION_SCENARIO_HUMAN_VS_CPU } =
      await import("../../src/apps/browser/foundation-scenario.js");
    const scenario = selectBrowserScenario("?mode=human-vs-ai");
    expect(scenario).toBe(FOUNDATION_SCENARIO_HUMAN_VS_CPU);
  });

  it("human-vs-CPU scenario has 4 players", () => {
    const scenario = selectBrowserScenario("?mode=human-vs-ai");
    const world = createWorld({ scenario });
    expect(world.players.length).toBe(4);
  });

  it("human-vs-CPU scenario has 1 HUMAN slot and 3 AI_FALLBACK slots", () => {
    const scenario = selectBrowserScenario("?mode=human-vs-ai");
    const assignments = scenario.controlAssignments;
    const modes = Object.values(assignments).map((a) => a.mode);
    const humanCount = modes.filter((m) => m === "HUMAN").length;
    const cpuCount = modes.filter((m) => m === "AI_FALLBACK").length;
    expect(humanCount).toBe(1);
    expect(cpuCount).toBe(3);
  });

  it("slot-1 is HUMAN and slots 2-4 are AI_FALLBACK", () => {
    const scenario = selectBrowserScenario("?mode=human-vs-ai");
    expect(scenario.controlAssignments["slot-1"].mode).toBe("HUMAN");
    expect(scenario.controlAssignments["slot-2"].mode).toBe("AI_FALLBACK");
    expect(scenario.controlAssignments["slot-3"].mode).toBe("AI_FALLBACK");
    expect(scenario.controlAssignments["slot-4"].mode).toBe("AI_FALLBACK");
  });

  it("human-vs-CPU scenario has 5400 ticks duration", () => {
    const scenario = selectBrowserScenario("?mode=human-vs-ai");
    expect(scenario.durationTicks).toBe(5400);
  });
});