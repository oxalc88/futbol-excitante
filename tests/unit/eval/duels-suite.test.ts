/**
 * @module tests/unit/eval/duels-suite
 *
 * Tests for the duels suite (suite-duels-v1):
 *  1. Suite is registered in SUITES.
 *  2. expandSuite includes all 9 duels tests.
 *  3. evaluateSuite("duels", ...) runs and produces test results.
 *  4. PHY-SHLD-001 criteria: CONT may run, REF is BLOCKED, REG is NOT_EVAL.
 *  5. PHY-STR/PHY-BC/PHY-PC: all NOT_EVALUATED.
 *  6. TACK and INT tests: all NOT_EVALUATED (unimplemented).
 *  7. COMMON criteria run on all tests.
 *  8. duels is no longer reported as MISSING_SUITE in playable-evaluator.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { SCENARIO_DUELS_PHY_SHLD_001, getScenario } from "../../../eval/contracts/scenarios.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";
import { SUITES } from "../../../eval/contracts/suites.js";
import { DUELS_SUITE } from "../../../eval/contracts/suites.js";
import { TEST_BINDINGS } from "../../../eval/contracts/bindings.js";
import { EXPANSION_MANIFESTS } from "../../../eval/contracts/policies.js";
import { evaluate } from "../../../eval/runners/evaluate.js";
import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";
import { evaluatePlayable1v1 } from "../../../eval/runners/playable-evaluator.js";
import { loadRegistrySet } from "../../../eval/contracts/loader.js";
import { makeInputFrame, makeTelemetryObservation } from "../contracts.fixture.js";

// Two-player duel scenario (JSON file).
function loadTwoPlayerDuelFixture(): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(
    __dirname,
    "../../../eval/scenarios/two-player-duel.v1.json",
  );
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(
    __dirname,
    "../../../eval/scenarios/foundation-move-and-roll.v1.json",
  );
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

function buildInputProgram(
  durationTicks: number,
  slots: Array<{ controlSlot: string; moveX: number }>,
): Record<number, Parameters<typeof makeInputFrame>[]> {
  const program: Record<number, { tick: number; sourceId: string; controlSlot: string; moveX: number; moveY: number; sprint: number; heldButtons: number; pressedButtons: number; releasedButtons: number }[]> = {};
  for (let t = 0; t < durationTicks; t++) {
    program[t] = slots.map((s) =>
      makeInputFrame(t, s.controlSlot, { moveX: s.moveX }),
    );
  }
  return program;
}

function runDuelsSuite(
  overrideScenario?: { load: () => ScenarioDefinition; durationTicks?: number },
): ReturnType<typeof evaluateSuite> {
  const { load, durationTicks = 60 } = overrideScenario ?? { load: loadFixture };
  const scenario = load();
  const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
  modified.durationTicks = durationTicks;
  modified.inputProgram = buildInputProgram(durationTicks, [
    { controlSlot: "slot-1", moveX: 1 },
    { controlSlot: "slot-2", moveX: -1 },
  ]);

  const evalResult = evaluate({ scenario: modified });
  return evaluateSuite("duels", evalResult.observations);
}

// ---------------------------------------------------------------------------
// 1. Suite registration
// ---------------------------------------------------------------------------

describe("duels suite registration", () => {
  it("DUELS_SUITE is exported", () => {
    expect(DUELS_SUITE).toBeDefined();
    expect(DUELS_SUITE.suite_id).toBe("duels");
    expect(DUELS_SUITE.suite_version).toBe("suite-duels-v1");
  });

  it("DUELS_SUITE is registered in SUITES", () => {
    expect(SUITES["duels"]).toBe(DUELS_SUITE);
  });

  it("duels suite has correct direct_test_ids", () => {
    const expected = [
      "PHY-SHLD-001",
      "PHY-STR-001",
      "PHY-BC-001",
      "PHY-PC-001",
      "TACK-ST-001",
      "TACK-SL-001",
      "TACK-ANG-001",
      "INT-PASS-001",
      "INT-FAST-001",
    ];
    expect(DUELS_SUITE.direct_test_ids).toEqual(expected);
  });

  it("duels suite has COMMON criteria", () => {
    const expected = [
      "COMMON-FINITE",
      "COMMON-DETERMINISTIC",
      "COMMON-REFERENCES",
      "COMMON-BOUNDS",
    ];
    expect(DUELS_SUITE.common_criterion_ids).toEqual(expected);
  });

  it("duels suite requires PLAYER_DUELS capability", () => {
    expect(DUELS_SUITE.prerequisite_capabilities).toContain("PLAYER_DUELS");
  });

  it("duels suite does NOT include HEAD-DUEL-001", () => {
    expect(DUELS_SUITE.direct_test_ids).not.toContain("HEAD-DUEL-001");
  });

  it("expansion manifest for duels exists", () => {
    const manifest = EXPANSION_MANIFESTS["expansion-duels-v1"];
    expect(manifest).toBeDefined();
    expect(manifest.suite_id).toBe("duels");
    expect(manifest.impact_closure).toBe("NONE");
    expect(manifest.direct_test_ids).toEqual(DUELS_SUITE.direct_test_ids);
  });

  it("all duels test_ids have bindings", () => {
    for (const testId of DUELS_SUITE.direct_test_ids) {
      expect(TEST_BINDINGS[testId]).toBeDefined(
        `Binding must exist for "${testId}"`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 2. evaluateSuite("duels", ...) runs
// ---------------------------------------------------------------------------

describe("evaluateSuite: duels suite execution", () => {
  it("returns a SuiteEvaluationResult with suite_id=duels", () => {
    const result = runDuelsSuite();
    expect(result.suite_id).toBe("duels");
    expect(result.suite_version).toBe("suite-duels-v1");
    expect(Array.isArray(result.tests)).toBe(true);
    expect(result.tests.length).toBeGreaterThan(0);
  });

  it("includes all 9 duels test IDs", () => {
    const result = runDuelsSuite();
    const testIds = result.tests.map((t) => t.test_id);
    for (const expected of [
      "PHY-SHLD-001",
      "PHY-STR-001",
      "PHY-BC-001",
      "PHY-PC-001",
      "TACK-ST-001",
      "TACK-SL-001",
      "TACK-ANG-001",
      "INT-PASS-001",
      "INT-FAST-001",
    ]) {
      expect(testIds).toContain(expected);
    }
  });

  it("HEAD-DUEL-001 is NOT in duels suite", () => {
    const result = runDuelsSuite();
    const testIds = result.tests.map((t) => t.test_id);
    expect(testIds).not.toContain("HEAD-DUEL-001");
  });
});

// ---------------------------------------------------------------------------
// 3. PHY-SHLD-001 criteria evaluation
// ---------------------------------------------------------------------------

describe("PHY-SHLD-001 criteria", () => {
  it("PHY-SHLD-001-REF is BLOCKED_MISSING_REFERENCE (MEASURED_TARGET)", () => {
    const result = runDuelsSuite();
    const phyShld = result.tests.find((t) => t.test_id === "PHY-SHLD-001");
    expect(phyShld).toBeDefined();
    const refCriterion = phyShld!.criteria.find(
      (c) => c.criterion_id === "PHY-SHLD-001-REF",
    );
    expect(refCriterion).toBeDefined();
    expect(refCriterion!.class).toBe("MEASURED_TARGET");
    expect(refCriterion!.outcome).toBe("BLOCKED_MISSING_REFERENCE");
  });

  it("PHY-SHLD-001-REG is NOT_EVALUATED (REGRESSION)", () => {
    const result = runDuelsSuite();
    const phyShld = result.tests.find((t) => t.test_id === "PHY-SHLD-001");
    expect(phyShld).toBeDefined();
    const regCriterion = phyShld!.criteria.find(
      (c) => c.criterion_id === "PHY-SHLD-001-REG",
    );
    expect(regCriterion).toBeDefined();
    expect(regCriterion!.class).toBe("REGRESSION");
    expect(regCriterion!.outcome).toBe("NOT_EVALUATED");
  });

  it("PHY-SHLD-001-CONT maps to player-contact-evidence oracle", () => {
    const result = runDuelsSuite();
    const phyShld = result.tests.find((t) => t.test_id === "PHY-SHLD-001");
    expect(phyShld).toBeDefined();
    const contCriterion = phyShld!.criteria.find(
      (c) => c.criterion_id === "PHY-SHLD-001-CONT",
    );
    expect(contCriterion).toBeDefined();
    expect(contCriterion!.class).toBe("HARD_INVARIANT");
    // On a single-player foundation fixture there is no second player, so
    // the player-contact-evidence oracle returns an empty array, and
    // computeOutcome handles it as NOT_EVALUATED (oracleResults.length === 0).
    expect(contCriterion!.outcome).toBe("NOT_EVALUATED");
  });

  it("PHY-SHLD-001-CONT PASS on two-player overlap scenario", () => {
    const result = runDuelsSuite({ load: loadTwoPlayerDuelFixture });
    const phyShld = result.tests.find((t) => t.test_id === "PHY-SHLD-001");
    expect(phyShld).toBeDefined();
    const contCriterion = phyShld!.criteria.find(
      (c) => c.criterion_id === "PHY-SHLD-001-CONT",
    );
    expect(contCriterion).toBeDefined();
    // Two players approach each other (moveX=1 vs moveX=-1) from 5 m apart;
    // the player-contact system detects overlap and emits
    // player-player-contact events → PASS.
    expect(contCriterion!.outcome).toBe("PASS");
  });

  it("PHY-SHLD-001-CONT FAIL when 2+ players but no contact events", () => {
    const scenario = loadTwoPlayerDuelFixture();
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    // Replace the contact-producing input program with a no-op program
    // so both players remain at their initial positions (0,0 and 5,0)
    // and no player-player-contact events are generated.
    const noContactProgram: Record<
      number,
      { tick: number; sourceId: string; controlSlot: string; moveX: number; moveY: number; sprint: number; heldButtons: number; pressedButtons: number; releasedButtons: number }[]
    > = {};
    for (let t = 0; t < 60; t++) {
      noContactProgram[t] = [
        { tick: t, sourceId: "eval-input", controlSlot: "slot-1", moveX: 0, moveY: 0, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 },
        { tick: t, sourceId: "eval-input", controlSlot: "slot-2", moveX: 0, moveY: 0, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0 },
      ];
    }
    modified.inputProgram = noContactProgram;

    const evalResult = evaluate({ scenario: modified });
    const result = evaluateSuite("duels", evalResult.observations);
    const phyShld = result.tests.find((t) => t.test_id === "PHY-SHLD-001");
    expect(phyShld).toBeDefined();
    const contCriterion = phyShld!.criteria.find(
      (c) => c.criterion_id === "PHY-SHLD-001-CONT",
    );
    expect(contCriterion).toBeDefined();
    // Two players are present but no contact events occurred → FAIL.
    expect(contCriterion!.outcome).toBe("FAIL");
  });

  // -----------------------------------------------------------------------
  // PHY-SHLD-001 from registered catalog scenario (not fixture override)
  // -----------------------------------------------------------------------

  describe("PHY-SHLD-001-CONT from registered catalog scenario", () => {
    /**
     * Convert a catalog (eval-contracts) scenario — snake_case fields —
     * to the simulation-core ScenarioDefinition shape (camelCase).
     *
     * This is required because the eval catalog uses the spec-quoted
     * snake_case names while the simulation core expects camelCase.
     */
    function toCoreScenario(
      cat: Record<string, unknown>,
    ): Record<string, unknown> {
      const rawState = cat.initial_state as Record<string, unknown> | undefined;
      return {
        id: cat.scenario_id as string,
        version: (cat.scenario_version as string) ?? "catalog",
        family: "duel",
        durationTicks: cat.duration_ticks as number,
        seed: 42,
        prngAlgorithmId: "mulberry32-v1",
        schemaVersion: (cat.initial_state_schema as string) ?? "state-v1",
        simulationVersion: "sim-v1",
        configVersion: (cat.config_refs as Record<string, string>)?.foundation
          ? "foundation-locomotion-v1"
          : "foundation-config-v1",
        profile: "LABORATORY",
        pitchLength: 105,
        pitchWidth: 68,
        safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
        players: (rawState?.players as Record<string, unknown>[]) ?? [],
        ball: (rawState?.ball as Record<string, unknown>) ?? {
          position: { x: 0, y: 0, z: 0.11 },
          linearVelocity: { x: 0, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
          regime: "ground-roll",
        },
        controlAssignments: {
          "slot-1": {
            controlSlot: "slot-1",
            teamId: "team-A",
            controlledPlayerId: "player-a",
            mode: "HUMAN",
          },
          "slot-2": {
            controlSlot: "slot-2",
            teamId: "team-B",
            controlledPlayerId: "player-b",
            mode: "HUMAN",
          },
        },
        missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
        maxConsecutiveMissing: 3,
        inputProgram: (cat.input_program as { value: Record<number, unknown[]> })
          ?.value as Record<number, Parameters<Simulation["applyInputs"]>[0]>,
        scheduledEvents: {},
        observationWindows: [
          { startTick: 0, endTick: (cat.duration_ticks as number) ?? 60 },
        ],
        requestedMetrics: ["player-displacement", "ball-distance"],
      };
    }

    function runScenario(
      catalogScenario: Record<string, unknown>,
    ): TelemetryObservation[] {
      // Convert to core scenario format and run through the simulation.
      const coreScenario = toCoreScenario(catalogScenario);
      const world = createWorld({ scenario: coreScenario as ScenarioDefinition });
      const observations: TelemetryObservation[] = [];
      const sim = createSimulation(world, {
        onObservation(obs) {
          observations.push(obs);
        },
      });
      for (let i = 0; i < (coreScenario.durationTicks as number); i++) {
        const tickInputs = ((coreScenario.inputProgram as Record<number, Parameters<Simulation["applyInputs"]>[0]>) ?? {})[sim.tick] ?? [];
        if (tickInputs.length > 0) {
          sim.applyInputs(tickInputs);
        }
        sim.step();
      }
      return observations;
    }

    it("loads SCENARIO_DUELS_PHY_SHLD_001 from registry and yields PASS", () => {
      // Load the scenario directly from the registered catalog (not via JSON fixture).
      const scenario = getScenario("scn-duels-phy-shld-001-v1");
      expect(scenario).toBeDefined();
      expect(scenario!.scenario_id).toBe("scn-duels-phy-shld-001-v1");
      expect(scenario!.scenario_id).toBe(SCENARIO_DUELS_PHY_SHLD_001.scenario_id);

      // Run the simulation with the registered scenario's own input program.
      const observations = runScenario(scenario!);
      expect(observations.length).toBeGreaterThan(0);

      // Evaluate the duels suite on the observations produced by the
      // registered scenario — this is NOT a fixture override.
      const result = evaluateSuite("duels", observations);
      const phyShld = result.tests.find((t) => t.test_id === "PHY-SHLD-001");
      expect(phyShld).toBeDefined();
      const contCriterion = phyShld!.criteria.find(
        (c) => c.criterion_id === "PHY-SHLD-001-CONT",
      );
      expect(contCriterion).toBeDefined();
      // The registered scenario has two players moving toward each other
      // (y: 0 and y: 1.5 with sprint=±Y inputs for 60 ticks), so the
      // player-contact system detects overlap and emits
      // player-player-contact events → PASS.
      expect(contCriterion!.outcome).toBe("PASS");
    });

    it("SCENARIO_DUELS_PHY_SHLD_001 input program is non-empty", () => {
      const scenario = SCENARIO_DUELS_PHY_SHLD_001;
      const inputMap = scenario.input_program.value as Record<
        number,
        unknown[]
      >;
      expect(Object.keys(inputMap).length).toBeGreaterThan(0);
      // Tick 0 must have inputs for both slots.
      const tick0 = inputMap[0] as Array<{ controlSlot: string }>;
      expect(tick0.length).toBe(2);
      const slots = new Set(tick0.map((t) => t.controlSlot));
      expect(slots.has("slot-1")).toBe(true);
      expect(slots.has("slot-2")).toBe(true);
    });

    it("SCENARIO_DUELS_PHY_SHLD_001 has two players in initial state", () => {
      const scenario = SCENARIO_DUELS_PHY_SHLD_001;
      const state = scenario.initial_state as { players: Array<{ playerId: string; groundPosition: { x: number; y: number } }> };
      expect(state.players.length).toBe(2);
      const ids = new Set(state.players.map((p) => p.playerId));
      expect(ids.has("player-a")).toBe(true);
      expect(ids.has("player-b")).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 4. PHY-STR/PHY-BC/PHY-PC: all NOT_EVALUATED
// ---------------------------------------------------------------------------

describe("PHY-STR/PHY-BC/PHY-PC: no implemented oracles", () => {
  function findTest(testId: string) {
    const result = runDuelsSuite();
    return result.tests.find((t) => t.test_id === testId);
  }

  it("PHY-STR-001-DESIGN is NOT_EVALUATED (ENGINE_DESIGN_TARGET)", () => {
    const test = findTest("PHY-STR-001");
    expect(test).toBeDefined();
    const criterion = test!.criteria.find((c) => c.criterion_id === "PHY-STR-001-DESIGN");
    expect(criterion).toBeDefined();
    expect(criterion!.class).toBe("ENGINE_DESIGN_TARGET");
    expect(criterion!.outcome).toBe("NOT_EVALUATED");
  });

  it("PHY-BC-001-DESIGN is NOT_EVALUATED (ENGINE_DESIGN_TARGET)", () => {
    const test = findTest("PHY-BC-001");
    expect(test).toBeDefined();
    const criterion = test!.criteria.find((c) => c.criterion_id === "PHY-BC-001-DESIGN");
    expect(criterion).toBeDefined();
    expect(criterion!.class).toBe("ENGINE_DESIGN_TARGET");
    expect(criterion!.outcome).toBe("NOT_EVALUATED");
  });

  it("PHY-PC-001-DESIGN is NOT_EVALUATED (ENGINE_DESIGN_TARGET)", () => {
    const test = findTest("PHY-PC-001");
    expect(test).toBeDefined();
    const criterion = test!.criteria.find((c) => c.criterion_id === "PHY-PC-001-DESIGN");
    expect(criterion).toBeDefined();
    expect(criterion!.class).toBe("ENGINE_DESIGN_TARGET");
    expect(criterion!.outcome).toBe("NOT_EVALUATED");
  });
});

// ---------------------------------------------------------------------------
// 5. TACK-* and INT-*: all NOT_EVALUATED
// ---------------------------------------------------------------------------

describe("TACK-*/INT-*: unimplemented → NOT_EVALUATED", () => {
  function findCriterion(testId: string, criterionId: string) {
    const result = runDuelsSuite();
    const test = result.tests.find((t) => t.test_id === testId);
    expect(test).toBeDefined();
    return test!.criteria.find((c) => c.criterion_id === criterionId);
  }

  // TACK-ST-001
  it("TACK-ST-001-CAUSAL is NOT_EVALUATED", () => {
    const c = findCriterion("TACK-ST-001", "TACK-ST-001-CAUSAL");
    expect(c).toBeDefined();
    expect(c!.class).toBe("UNKNOWN");
    expect(c!.outcome).toBe("NOT_EVALUATED");
  });

  // TACK-SL-001
  it("TACK-SL-001-CAUSAL is NOT_EVALUATED", () => {
    const c = findCriterion("TACK-SL-001", "TACK-SL-001-CAUSAL");
    expect(c).toBeDefined();
    expect(c!.class).toBe("UNKNOWN");
    expect(c!.outcome).toBe("NOT_EVALUATED");
  });

  // TACK-ANG-001
  it("TACK-ANG-001-CAUSAL is NOT_EVALUATED", () => {
    const c = findCriterion("TACK-ANG-001", "TACK-ANG-001-CAUSAL");
    expect(c).toBeDefined();
    expect(c!.class).toBe("UNKNOWN");
    expect(c!.outcome).toBe("NOT_EVALUATED");
  });

  // INT-PASS-001
  it("INT-PASS-001-CAUSAL is NOT_EVALUATED", () => {
    const c = findCriterion("INT-PASS-001", "INT-PASS-001-CAUSAL");
    expect(c).toBeDefined();
    expect(c!.class).toBe("UNKNOWN");
    expect(c!.outcome).toBe("NOT_EVALUATED");
  });

  // INT-FAST-001
  it("INT-FAST-001-CAUSAL is NOT_EVALUATED", () => {
    const c = findCriterion("INT-FAST-001", "INT-FAST-001-CAUSAL");
    expect(c).toBeDefined();
    expect(c!.class).toBe("UNKNOWN");
    expect(c!.outcome).toBe("NOT_EVALUATED");
  });
});

// ---------------------------------------------------------------------------
// 6. Common criteria run on duels tests
// ---------------------------------------------------------------------------

describe("Common criteria on duels tests", () => {
  it("COMMON-FINITE runs on PHY-SHLD-001", () => {
    const result = runDuelsSuite();
    const phyShld = result.tests.find((t) => t.test_id === "PHY-SHLD-001");
    expect(phyShld).toBeDefined();
    const finite = phyShld!.criteria.find((c) => c.criterion_id === "COMMON-FINITE");
    expect(finite).toBeDefined();
    expect(finite!.outcome).toBe("PASS");
  });

  it("COMMON-REFERENCES runs on PHY-SHLD-001", () => {
    const result = runDuelsSuite();
    const phyShld = result.tests.find((t) => t.test_id === "PHY-SHLD-001");
    const refs = phyShld!.criteria.find((c) => c.criterion_id === "COMMON-REFERENCES");
    expect(refs).toBeDefined();
    expect(refs!.outcome).toBe("PASS");
  });

  it("COMMON-BOUNDS runs on PHY-SHLD-001", () => {
    const result = runDuelsSuite();
    const phyShld = result.tests.find((t) => t.test_id === "PHY-SHLD-001");
    const bounds = phyShld!.criteria.find((c) => c.criterion_id === "COMMON-BOUNDS");
    expect(bounds).toBeDefined();
    expect(bounds!.outcome).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// 7. duels is no longer reported as missing suite in playable-evaluator
// ---------------------------------------------------------------------------

describe("duels suite no longer missing in playable-evaluator", () => {
  it("PLAYABLE_1V1 does NOT report duels as MISSING_SUITE", () => {
    const scenario = loadFixture();
    const result = evaluatePlayable1v1(scenario);

    const missingSuites = result.subComponents.filter(
      (s) => s.componentId.startsWith("MISSING_SUITE:"),
    );

    // Neither duels nor touch_and_actions is missing — both are registered.
    expect(missingSuites.length).toBe(0);
  });
});