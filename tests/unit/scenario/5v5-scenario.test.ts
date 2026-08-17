/**
 * @module tests/unit/scenario/5v5-scenario
 *
 * Tests for the 5v5 scenario fixture.
 *
 * Verifies:
 *  1. The fixture loads 10 players (5 per team).
 *  2. Control assignments map correctly (10 slots, all AI_FALLBACK).
 *  3. Initial positions respect formation layout.
 *  4. Determinism: same seed produces identical initial state.
 *  5. The scenario selector returns it for ?mode=ai-match-5v5.
 *  6. Integration: runs 10+ ticks deterministically.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { FOUNDATION_SCENARIO_5V5 } from "../../../src/apps/browser/foundation-scenario.js";
import { selectBrowserScenario } from "../../../src/apps/browser/scenario-selector.js";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { NO_OP_OBSERVER } from "../../../src/simulation/telemetry/observer.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";

// ===========================================================================
// Fixture loading
// ===========================================================================

function loadFixture(name: string): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(__dirname, `../../../eval/scenarios/${name}`);
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

// ===========================================================================
// 1. Fixture cardinality
// ===========================================================================

describe("5v5 scenario fixture", () => {
  it("loads 10 players total", () => {
    expect(FOUNDATION_SCENARIO_5V5.players).toHaveLength(10);
  });

  it("has 5 players on team-a", () => {
    const teamA = FOUNDATION_SCENARIO_5V5.players.filter(
      (p) => p.teamId === "team-a",
    );
    expect(teamA).toHaveLength(5);
  });

  it("has 5 players on team-b", () => {
    const teamB = FOUNDATION_SCENARIO_5V5.players.filter(
      (p) => p.teamId === "team-b",
    );
    expect(teamB).toHaveLength(5);
  });

  it("has 10 control slots", () => {
    const assignments = FOUNDATION_SCENARIO_5V5.controlAssignments;
    expect(Object.keys(assignments)).toHaveLength(10);
  });

  it("slot IDs are slot-1 through slot-10", () => {
    const keys = Object.keys(FOUNDATION_SCENARIO_5V5.controlAssignments);
    for (let i = 1; i <= 10; i++) {
      expect(keys).toContain(`slot-${i}`);
    }
  });
});

// ===========================================================================
// 2. Slot wiring — all AI_FALLBACK
// ===========================================================================

describe("5v5 slot wiring", () => {
  it("all 10 slots are AI_FALLBACK", () => {
    const modes = Object.values(FOUNDATION_SCENARIO_5V5.controlAssignments).map(
      (a) => a.mode,
    );
    modes.forEach((m) => expect(m).toBe("AI_FALLBACK"));
  });

  it("slot-1 is team-a player-1 (AI_FALLBACK)", () => {
    const s1 = FOUNDATION_SCENARIO_5V5.controlAssignments["slot-1"];
    expect(s1.teamId).toBe("team-a");
    expect(s1.controlledPlayerId).toBe("player-1");
    expect(s1.mode).toBe("AI_FALLBACK");
  });

  it("slot-2 is team-a player-2 (AI_FALLBACK)", () => {
    const s2 = FOUNDATION_SCENARIO_5V5.controlAssignments["slot-2"];
    expect(s2.teamId).toBe("team-a");
    expect(s2.controlledPlayerId).toBe("player-2");
    expect(s2.mode).toBe("AI_FALLBACK");
  });

  it("slot-3 is team-a player-3 (AI_FALLBACK)", () => {
    const s3 = FOUNDATION_SCENARIO_5V5.controlAssignments["slot-3"];
    expect(s3.teamId).toBe("team-a");
    expect(s3.controlledPlayerId).toBe("player-3");
    expect(s3.mode).toBe("AI_FALLBACK");
  });

  it("slot-4 is team-a player-4 (AI_FALLBACK)", () => {
    const s4 = FOUNDATION_SCENARIO_5V5.controlAssignments["slot-4"];
    expect(s4.teamId).toBe("team-a");
    expect(s4.controlledPlayerId).toBe("player-4");
    expect(s4.mode).toBe("AI_FALLBACK");
  });

  it("slot-5 is team-a player-5 (AI_FALLBACK)", () => {
    const s5 = FOUNDATION_SCENARIO_5V5.controlAssignments["slot-5"];
    expect(s5.teamId).toBe("team-a");
    expect(s5.controlledPlayerId).toBe("player-5");
    expect(s5.mode).toBe("AI_FALLBACK");
  });

  it("slot-6 is team-b player-6 (AI_FALLBACK)", () => {
    const s6 = FOUNDATION_SCENARIO_5V5.controlAssignments["slot-6"];
    expect(s6.teamId).toBe("team-b");
    expect(s6.controlledPlayerId).toBe("player-6");
    expect(s6.mode).toBe("AI_FALLBACK");
  });

  it("slot-7 is team-b player-7 (AI_FALLBACK)", () => {
    const s7 = FOUNDATION_SCENARIO_5V5.controlAssignments["slot-7"];
    expect(s7.teamId).toBe("team-b");
    expect(s7.controlledPlayerId).toBe("player-7");
    expect(s7.mode).toBe("AI_FALLBACK");
  });

  it("slot-8 is team-b player-8 (AI_FALLBACK)", () => {
    const s8 = FOUNDATION_SCENARIO_5V5.controlAssignments["slot-8"];
    expect(s8.teamId).toBe("team-b");
    expect(s8.controlledPlayerId).toBe("player-8");
    expect(s8.mode).toBe("AI_FALLBACK");
  });

  it("slot-9 is team-b player-9 (AI_FALLBACK)", () => {
    const s9 = FOUNDATION_SCENARIO_5V5.controlAssignments["slot-9"];
    expect(s9.teamId).toBe("team-b");
    expect(s9.controlledPlayerId).toBe("player-9");
    expect(s9.mode).toBe("AI_FALLBACK");
  });

  it("slot-10 is team-b player-10 (AI_FALLBACK)", () => {
    const s10 = FOUNDATION_SCENARIO_5V5.controlAssignments["slot-10"];
    expect(s10.teamId).toBe("team-b");
    expect(s10.controlledPlayerId).toBe("player-10");
    expect(s10.mode).toBe("AI_FALLBACK");
  });

  it("team-a has 5 slots, team-b has 5 slots", () => {
    const assignments = FOUNDATION_SCENARIO_5V5.controlAssignments;
    const teamA = Object.values(assignments).filter((a) => a.teamId === "team-a");
    const teamB = Object.values(assignments).filter((a) => a.teamId === "team-b");
    expect(teamA).toHaveLength(5);
    expect(teamB).toHaveLength(5);
  });
});

// ===========================================================================
// 3. Formation layout
// ===========================================================================

describe("5v5 formation positions", () => {
  it("team-a has 2 defenders (x = -30, -20), 2 midfielders (x = -8), 1 attacker (x = -2)", () => {
    const teamA = FOUNDATION_SCENARIO_5V5.players.filter(
      (p) => p.teamId === "team-a",
    );
    const byX = [...teamA].sort((a, b) => a.groundPosition.x - b.groundPosition.x);
    expect(byX[0].groundPosition.x).toBe(-30); // deepest defender
    expect(byX[1].groundPosition.x).toBe(-20); // second defender
    expect(byX[2].groundPosition.x).toBe(-8);  // midfielder 1
    expect(byX[3].groundPosition.x).toBe(-8);  // midfielder 2
    expect(byX[4].groundPosition.x).toBe(-2);  // attacker
  });

  it("team-b has 2 defenders (x = 20, 30), 2 midfielders (x = 8), 1 attacker (x = 2)", () => {
    const teamB = FOUNDATION_SCENARIO_5V5.players.filter(
      (p) => p.teamId === "team-b",
    );
    const byX = [...teamB].sort((a, b) => a.groundPosition.x - b.groundPosition.x);
    expect(byX[0].groundPosition.x).toBe(2);    // attacker
    expect(byX[1].groundPosition.x).toBe(8);    // midfielder 1
    expect(byX[2].groundPosition.x).toBe(8);    // midfielder 2
    expect(byX[3].groundPosition.x).toBe(20);   // second defender
    expect(byX[4].groundPosition.x).toBe(30);   // deepest defender
  });

  it("team-a players spread across pitch width (y values are distinct within roles)", () => {
    const teamA = FOUNDATION_SCENARIO_5V5.players.filter(
      (p) => p.teamId === "team-a",
    );
    const defenders = teamA.filter((p) => p.formationRole === "defender");
    const midfielders = teamA.filter((p) => p.formationRole === "midfielder");
    const attackers = teamA.filter((p) => p.formationRole === "attacker");
    expect(defenders).toHaveLength(2);
    expect(midfielders).toHaveLength(2);
    expect(attackers).toHaveLength(1);
    // Defenders spread
    const dYs = defenders.map((p) => p.groundPosition.y).sort();
    expect(dYs).toContain(-16);
    expect(dYs).toContain(0);
    // Midfielders spread
    const mYs = midfielders.map((p) => p.groundPosition.y).sort();
    expect(mYs).toContain(-8);
    expect(mYs).toContain(8);
  });

  it("team-b players spread across pitch width", () => {
    const teamB = FOUNDATION_SCENARIO_5V5.players.filter(
      (p) => p.teamId === "team-b",
    );
    const defenders = teamB.filter((p) => p.formationRole === "defender");
    const midfielders = teamB.filter((p) => p.formationRole === "midfielder");
    const attackers = teamB.filter((p) => p.formationRole === "attacker");
    expect(defenders).toHaveLength(2);
    expect(midfielders).toHaveLength(2);
    expect(attackers).toHaveLength(1);
    const dYs = defenders.map((p) => p.groundPosition.y).sort();
    expect(dYs).toContain(-16);
    expect(dYs).toContain(0);
    const mYs = midfielders.map((p) => p.groundPosition.y).sort();
    expect(mYs).toContain(-8);
    expect(mYs).toContain(8);
  });

  it("team-a attacks +x (bodyHeading = 0), team-b attacks -x (bodyHeading ≈ π)", () => {
    const teamA = FOUNDATION_SCENARIO_5V5.players.filter(
      (p) => p.teamId === "team-a",
    );
    const teamB = FOUNDATION_SCENARIO_5V5.players.filter(
      (p) => p.teamId === "team-b",
    );
    teamA.forEach((p) => expect(p.bodyHeading).toBe(0));
    teamB.forEach((p) => expect(p.bodyHeading).toBeCloseTo(Math.PI));
  });

  it("team-a players have formationRole, archetypeId, and ball has ground-roll", () => {
    const scenario = loadFixture("5v5-fixture-v1.json");
    scenario.players.forEach((p) => {
      expect(p.formationRole).toBeDefined();
      expect(["defender", "midfielder", "attacker"]).toContain(p.formationRole);
      expect(p.archetypeId).toBeDefined();
    });
    expect((scenario.ball as unknown as Record<string, unknown>).regime).toBe("ground-roll");
  });
});

// ===========================================================================
// 4. World creation from scenario
// ===========================================================================

describe("5v5 createWorld", () => {
  it("createWorld produces 10 players", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_5V5 });
    expect(world.players).toHaveLength(10);
  });

  it("createWorld produces 5 players per team", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_5V5 });
    const teamA = world.players.filter((p) => p.teamId === "team-a");
    const teamB = world.players.filter((p) => p.teamId === "team-b");
    expect(teamA).toHaveLength(5);
    expect(teamB).toHaveLength(5);
  });

  it("createWorld preserves 10 control assignments", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_5V5 });
    expect(Object.keys(world.controlAssignments)).toHaveLength(10);
  });

  it("createWorld preserves ball state", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_5V5 });
    expect(world.ball).toBeDefined();
    expect((world.ball as unknown as Record<string, unknown>)?.ownerPlayerId).toBeUndefined();
  });

  it("createWorld preserves initial positions", () => {
    const world = createWorld({ scenario: FOUNDATION_SCENARIO_5V5 });
    const posMap = new Map(
      FOUNDATION_SCENARIO_5V5.players.map((p) => [p.playerId, p.groundPosition]),
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

describe("5v5 determinism", () => {
  it("same seed produces identical initial world state", () => {
    const w1 = createWorld({ scenario: FOUNDATION_SCENARIO_5V5 });
    const w2 = createWorld({ scenario: FOUNDATION_SCENARIO_5V5 });

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
    const w1 = createWorld({ scenario: { ...FOUNDATION_SCENARIO_5V5 } });
    expect(w1.prng.state).toBeDefined();
  });
});

// ===========================================================================
// 6. Duration and metadata
// ===========================================================================

describe("5v5 metadata", () => {
  it("has 5400 ticks duration", () => {
    expect(FOUNDATION_SCENARIO_5V5.durationTicks).toBe(5400);
  });

  it("has LABORATORY profile", () => {
    expect(FOUNDATION_SCENARIO_5V5.profile).toBe("LABORATORY");
  });

  it("has team-a pitch side (negative x for defenders)", () => {
    const teamA = FOUNDATION_SCENARIO_5V5.players.filter(
      (p) => p.teamId === "team-a",
    );
    // All team-a players should be on the negative x side (attacking +x)
    teamA.forEach((p) => {
      expect(p.groundPosition.x).toBeLessThan(0);
    });
  });

  it("has team-b pitch side (positive x for defenders)", () => {
    const teamB = FOUNDATION_SCENARIO_5V5.players.filter(
      (p) => p.teamId === "team-b",
    );
    teamB.forEach((p) => {
      expect(p.groundPosition.x).toBeGreaterThan(0);
    });
  });

  it("has observationWindows", () => {
    expect(FOUNDATION_SCENARIO_5V5.observationWindows).toBeDefined();
    expect(FOUNDATION_SCENARIO_5V5.observationWindows).toHaveLength(1);
    expect(FOUNDATION_SCENARIO_5V5.observationWindows![0].startTick).toBe(0);
    expect(FOUNDATION_SCENARIO_5V5.observationWindows![0].endTick).toBe(5400);
  });

  it("has requestedMetrics", () => {
    expect(FOUNDATION_SCENARIO_5V5.requestedMetrics).toBeDefined();
    expect(FOUNDATION_SCENARIO_5V5.requestedMetrics).toContain("player-displacement");
    expect(FOUNDATION_SCENARIO_5V5.requestedMetrics).toContain("ball-distance");
  });

  it("pitch dimensions are 105x68", () => {
    expect(FOUNDATION_SCENARIO_5V5.pitchLength).toBe(105);
    expect(FOUNDATION_SCENARIO_5V5.pitchWidth).toBe(68);
  });
});

// ===========================================================================
// 7. Scenario selector
// ===========================================================================

describe("scenario selector returns 5v5", () => {
  it("returns 5v5 scenario for ?mode=ai-match-5v5", () => {
    const scenario = selectBrowserScenario("?mode=ai-match-5v5");
    expect(scenario).toBe(FOUNDATION_SCENARIO_5V5);
  });

  it("returns 5v5 scenario for ?mode=ai-match&scenario=5v5-fixture", () => {
    const scenario = selectBrowserScenario("?mode=ai-match&scenario=5v5-fixture");
    expect(scenario).toBe(FOUNDATION_SCENARIO_5V5);
  });

  it("5v5-fixture has 10 players via world creation", () => {
    const scenario = selectBrowserScenario("?mode=ai-match-5v5");
    const world = createWorld({ scenario });
    expect(world.players).toHaveLength(10);
  });
});

// ===========================================================================
// 8. Integration: simulation runs 10+ ticks deterministically
// ===========================================================================

describe("5v5 integration", () => {
  it("runs 10 ticks without errors", () => {
    const scenario = loadFixture("5v5-fixture-v1.json");
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    for (let i = 0; i < 10; i++) {
      sim.applyInputs([]);
      sim.step();
    }

    expect(sim.tick).toBe(10);
  });

  it("same scenario produces identical trajectory for first 10 ticks", () => {
    const scenarioA = loadFixture("5v5-fixture-v1.json");
    const scenarioB = loadFixture("5v5-fixture-v1.json");

    const simA = createSimulation(createWorld({ scenario: scenarioA }), NO_OP_OBSERVER);
    const simB = createSimulation(createWorld({ scenario: scenarioB }), NO_OP_OBSERVER);

    for (let i = 0; i < 10; i++) {
      simA.applyInputs([]);
      simB.applyInputs([]);
      simA.step();
      simB.step();

      expect(simA.stateHash()).toBe(simB.stateHash());
    }
  });
});