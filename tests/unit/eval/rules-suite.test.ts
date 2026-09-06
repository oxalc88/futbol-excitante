/**
 * @module tests/unit/eval/rules-suite
 *
 * Tests for the rules suite (suite-rules-v1), objective RULES-SUITE-REGISTRATION.
 *
 *  1. RULES_SUITE is registered in SUITES.
 *  2. expandSuite / expansion manifest for the rules suite exists.
 *  3. evaluateSuite("rules", ...) runs and produces test results.
 *  4. Every §15 criterion is honestly non-PASS where the criterion has no oracle
 *     (NOT_EVALUATED) or is a MEASURED_TARGET (BLOCKED_MISSING_REFERENCE), and
 *     the oracle-bound criteria produce their real verdict over a constructed
 *     restart stream.
 *  5. Registry validates cleanly with the rules suite present.
 *
 * No gameplay PASS is claimed beyond what the execut-able evaluator returns.
 * No PES reference is invented.
 *
 * No Math.random, Date, performance, DOM in core; tests may read fixtures.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";
import { SUITES, RULES_SUITE } from "../../../eval/contracts/suites.js";
import { TEST_BINDINGS } from "../../../eval/contracts/bindings.js";
import { EXPANSION_MANIFESTS } from "../../../eval/contracts/policies.js";
import { evaluate } from "../../../eval/runners/evaluate.js";
import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";
import { loadRegistrySet, validateRegistrySet } from "../../../eval/contracts/loader.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RULES_TEST_IDS = [
  "RULES-OOP-001",
  "RULES-THROWIN-001",
  "RULES-GOALKICK-001",
  "RULES-CORNERKICK-001",
  "RULES-KICKOFF-001",
  "RULES-SCORING-001",
  "RULES-TIMING-001",
  "RULES-ANTIHUDDLE-001",
];

/** Criteria bound to a registered protected rules oracle. */
const RULES_ORACLE_CRITERIA = [
  "MATCH-OUT-OF-PLAY-DETECT",
  "MATCH-OUT-OF-PLAY-NO-LAST-TOUCH",
  "MATCH-THROW-IN-AWARD",
  "MATCH-GOAL-KICK-AWARD",
  "MATCH-CORNER-KICK-AWARD",
  "MATCH-SCORING-GOAL-DEVENT",
  "MATCH-KICKOFF-FREEZE",
  "MATCH-TIMER-FREEZE",
];

function loadFixture(): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(
    __dirname,
    "../../../eval/scenarios/foundation-move-and-roll.v1.json",
  );
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

function runRulesSuiteOver(observations: TelemetryObservation[]): ReturnType<typeof evaluateSuite> {
  return evaluateSuite("rules", observations);
}

/** Run over the (restart-free) foundation fixture → all rule criteria NOT_EVALUATED. */
function runRulesSuiteOnFoundation(): ReturnType<typeof evaluateSuite> {
  const scenario = loadFixture();
  const evalResult = evaluate({ scenario });
  return runRulesSuiteOver(evalResult.observations);
}

/** A constructed throw-in window: end-to-end award + detection verdicts. */
function throwInStream(): TelemetryObservation[] {
  const mk = (tick: number, events: TelemetryObservation["events"], lastTouchRef?: string | null): TelemetryObservation => ({
    tick,
    simulationTime: tick / 60,
    prngAlgorithmId: "mulberry32-v1",
    stateHash: `hash-${tick}`,
    prngStateHash: `prng-${tick}`,
    observationCoreHash: `core-${tick}`,
    committedTick: tick,
    inputs: [],
    players: [
      { playerId: "player-1", teamId: "team-a", groundPosition: { x: 20, y: 0 }, linearVelocity: { x: 0, y: 0 }, desiredVelocity: { x: 0, y: 0 }, bodyHeading: 0, desiredHeading: 0 },
      { playerId: "player-2", teamId: "team-b", groundPosition: { x: -20, y: 0 }, linearVelocity: { x: 0, y: 0 }, desiredVelocity: { x: 0, y: 0 }, bodyHeading: 3.14159, desiredHeading: 3.14159 },
    ],
    ball: { position: { x: 0, y: 0, z: 0.11 }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, regime: "ground-roll", lastTouchRef: lastTouchRef ?? null },
    events,
  });
  return [
    mk(1, [{ id: "c-1", tick: 1, sequence: 1, kind: "player-ball-contact", payload: { teamId: "team-b", playerId: "player-2" } }], "c-1"),
    mk(2, [{ id: "t-2", tick: 2, sequence: 2, kind: "ball-touchline-out-of-play", payload: { touchlineIndex: 0, ballPosition: { x: 10, y: 34, z: 0.11 }, lastTouchRef: "c-1" } }], "c-1"),
    mk(3, [{ id: "ti-3", tick: 3, sequence: 3, kind: "throw-in-executed", payload: { teamId: "team-a", kickTakerId: "player-1" } }]),
  ];
}

// ---------------------------------------------------------------------------
// 1. Suite registration
// ---------------------------------------------------------------------------

describe("rules suite registration", () => {
  it("RULES_SUITE is exported", () => {
    expect(RULES_SUITE).toBeDefined();
    expect(RULES_SUITE.suite_id).toBe("rules");
    expect(RULES_SUITE.suite_version).toBe("suite-rules-v1");
  });

  it("RULES_SUITE is registered in SUITES", () => {
    expect(SUITES["rules"]).toBe(RULES_SUITE);
  });

  it("rules suite has the §15 family test ids", () => {
    expect(RULES_SUITE.direct_test_ids).toEqual(RULES_TEST_IDS);
  });

  it("rules suite requires the MATCH_RULES capability", () => {
    expect(RULES_SUITE.prerequisite_capabilities).toContain("MATCH_RULES");
  });

  it("expansion manifest for rules exists", () => {
    const manifest = EXPANSION_MANIFESTS["expansion-rules-v1"];
    expect(manifest).toBeDefined();
    expect(manifest.suite_id).toBe("rules");
    expect(manifest.impact_closure).toBe("NONE");
    expect(manifest.direct_test_ids).toEqual(RULES_SUITE.direct_test_ids);
  });

  it("all rules test_ids have bindings", () => {
    for (const testId of RULES_TEST_IDS) {
      expect(TEST_BINDINGS[testId]).toBeDefined(`Binding must exist for "${testId}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. evaluateSuite("rules", ...) runs
// ---------------------------------------------------------------------------

describe("evaluateSuite: rules suite execution", () => {
  it("returns a SuiteEvaluationResult with suite_id=rules", () => {
    const result = runRulesSuiteOnFoundation();
    expect(result.suite_id).toBe("rules");
    expect(result.suite_version).toBe("suite-rules-v1");
    expect(Array.isArray(result.tests)).toBe(true);
    expect(result.tests.length).toBeGreaterThan(0);
  });

  it("includes all 8 rules test IDs", () => {
    const result = runRulesSuiteOnFoundation();
    const testIds = result.tests.map((t) => t.test_id);
    for (const expected of RULES_TEST_IDS) {
      expect(testIds).toContain(expected);
    }
  });

  it("registry validates cleanly with the rules suite present", () => {
    const registry = loadRegistrySet();
    expect(validateRegistrySet(registry)).toHaveLength(0);
    expect(registry.suite_definitions["rules"]).toBeDefined();
    expect(registry.test_bindings["RULES-THROWIN-001"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Honest outcomes over the restart-free foundation fixture
// ---------------------------------------------------------------------------

describe("rules criteria honesty over a restart-free run", () => {
  it("no rules criterion claims PASS on a restart-free run", () => {
    const result = runRulesSuiteOnFoundation();
    for (const test of result.tests) {
      for (const c of test.criteria) {
        if (c.criterion_id.startsWith("MATCH-")) {
          expect(c.outcome, `${test.test_id} ${c.criterion_id} must not PASS`).not.toBe("PASS");
        }
      }
    }
  });

  it("oracle-less §15 criteria are NOT_EVALUATED", () => {
    const result = runRulesSuiteOnFoundation();
    const noOracle = [
      "MATCH-THROW-IN-PLACEMENT",
      "MATCH-THROW-IN-SERVE",
      "MATCH-KICKOFF-FIRST-TOUCH",
      "MATCH-SCORING-GOAL-PHASE",
    ];
    for (const test of result.tests) {
      for (const c of test.criteria) {
        if (noOracle.includes(c.criterion_id)) {
          expect(c.outcome).toBe("NOT_EVALUATED");
        }
      }
    }
  });

  it("MEASURED_TARGET rule criteria resolve to BLOCKED_MISSING_REFERENCE", () => {
    const result = runRulesSuiteOnFoundation();
    for (const test of result.tests) {
      for (const c of test.criteria) {
        if (c.criterion_id === "MATCH-GOAL-KICK-DISTRIBUTION" || c.criterion_id === "MATCH-CORNER-KICK-CROSS") {
          expect(c.class).toBe("MEASURED_TARGET");
          expect(c.outcome).toBe("BLOCKED_MISSING_REFERENCE");
        }
      }
    }
  });

  it("the timer-freeze oracle honestly reports NOT_EVALUATED (no core phase in the observation stream)", () => {
    const result = runRulesSuiteOnFoundation();
    let sawTimerFreeze = false;
    for (const test of result.tests) {
      for (const c of test.criteria) {
        if (c.criterion_id === "MATCH-TIMER-FREEZE") {
          sawTimerFreeze = true;
          expect(c.outcome).toBe("NOT_EVALUATED");
        }
      }
    }
    expect(sawTimerFreeze).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Oracle-bound criteria produce real verdicts over a restart stream
// ---------------------------------------------------------------------------

describe("rules suite produces real oracle verdicts over a restart stream", () => {
  it("MATCH-THROW-IN-AWARD passes over a valid throw-in window", () => {
    const result = runRulesSuiteOver(throwInStream());
    const throwInTest = result.tests.find((t) => t.test_id === "RULES-THROWIN-001");
    expect(throwInTest).toBeDefined();
    const award = throwInTest!.criteria.find((c) => c.criterion_id === "MATCH-THROW-IN-AWARD");
    expect(award).toBeDefined();
    expect(award!.outcome).toBe("PASS");
  });

  it("MATCH-OUT-OF-PLAY-DETECT passes over a stream with a boundary event", () => {
    const result = runRulesSuiteOver(throwInStream());
    const oopTest = result.tests.find((t) => t.test_id === "RULES-OOP-001");
    expect(oopTest).toBeDefined();
    const detect = oopTest!.criteria.find((c) => c.criterion_id === "MATCH-OUT-OF-PLAY-DETECT");
    expect(detect).toBeDefined();
    expect(detect!.outcome).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// 5. Negative control: registry wiring integrity
// ---------------------------------------------------------------------------

describe("negative control: rules registry wiring integrity", () => {
  it("removing a rules binding fails registry validation", () => {
    const base = loadRegistrySet();
    const registry = {
      ...base,
      suite_definitions: { ...base.suite_definitions },
      test_bindings: { ...base.test_bindings },
    };
    delete registry.test_bindings["RULES-THROWIN-001"];
    const errors = validateRegistrySet(registry);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes("RULES-THROWIN-001"))).toBe(true);
  });

  it("a rules binding referencing a missing invariant fails registry validation", () => {
    const base = loadRegistrySet();
    const registry = {
      ...base,
      test_bindings: { ...base.test_bindings },
    };
    const binding = { ...registry.test_bindings["RULES-THROWIN-001"] };
    binding.invariant_ids = ["bad-invariant-id"];
    registry.test_bindings["RULES-THROWIN-001"] = binding as typeof binding;
    const errors = validateRegistrySet(registry);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes("bad-invariant-id"))).toBe(true);
  });
});
