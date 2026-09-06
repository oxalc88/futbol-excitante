/**
 * @module tests/unit/eval/RULES-SUITE-REGISTRATION-binding
 *
 * Binding tests for RULES-SUITE-REGISTRATION (objective: register the rules
 * evaluator suite per MATCH_RULES_SPEC §15 with protected oracles).
 *
 * These lock the §15 oracle-bound criteria to their registered protected
 * oracles through the full chain:
 *   criterion_bindings  -> invariant_definitions -> registered oracle
 *   (bindings.ts)          (invariant-definitions.ts)   (wire.ts / oracle-registry.ts)
 *
 * and confirm evaluateSuite("rules", observations) turns those bindings into
 * real verdicts over a constructed restart stream, while a non-rule stream
 * stays NOT_EVALUATED.  No gameplay PASS is claimed beyond what the executed
 * evaluator returns.
 *
 * No Math.random, Date, performance, DOM in core; observations are built in-memory.
 */

import { describe, it, expect } from "vitest";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

// Import wire.ts to register the built-in oracles (side-effect).
import "../../../eval/oracles/wire.js";
import { getOracle } from "../../../eval/oracles/oracle-registry.js";
import { TEST_BINDINGS } from "../../../eval/contracts/bindings.js";
import { INVARIANT_DEFINITIONS } from "../../../eval/contracts/invariant-definitions.js";
import { loadRegistrySet } from "../../../eval/contracts/loader.js";
import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";

// ---------------------------------------------------------------------------
// The §15 criteria bound to a protected rules oracle.
// ---------------------------------------------------------------------------

const RULES_ORACLE_CRITERIA: Record<string, string> = {
  "MATCH-OUT-OF-PLAY-DETECT": "rules-out-of-play-detect-oracle-v1",
  "MATCH-OUT-OF-PLAY-NO-LAST-TOUCH": "rules-out-of-play-no-last-touch-oracle-v1",
  "MATCH-THROW-IN-AWARD": "rules-throw-in-award-oracle-v1",
  "MATCH-GOAL-KICK-AWARD": "rules-goal-kick-award-oracle-v1",
  "MATCH-CORNER-KICK-AWARD": "rules-corner-kick-award-oracle-v1",
  "MATCH-SCORING-GOAL-DEVENT": "rules-goal-detection-oracle-v1",
  "MATCH-KICKOFF-FREEZE": "rules-kickoff-freeze-oracle-v1",
  "MATCH-TIMER-FREEZE": "rules-timer-freeze-oracle-v1",
  "MATCH-THROW-IN-PLACEMENT": "rules-throw-in-placement-oracle-v1",
  "MATCH-THROW-IN-SERVE": "rules-throw-in-serve-oracle-v1",
  "MATCH-THROW-IN-TIMER-FREEZE": "rules-throw-in-timer-freeze-oracle-v1",
  "MATCH-GOAL-KICK-PLACEMENT": "rules-goal-kick-placement-oracle-v1",
  "MATCH-GOAL-KICK-TIMER-FREEZE": "rules-goal-kick-timer-freeze-oracle-v1",
  "MATCH-KICKOFF-FIRST-TOUCH": "rules-kickoff-first-touch-oracle-v1",
  "MATCH-SCORING-GOAL-PHASE": "rules-goal-phase-oracle-v1",
  "MATCH-TIMER-DECREMENT": "rules-timer-decrement-oracle-v1",
  "MATCH-TIMER-HALFTIME": "rules-timer-halftime-oracle-v1",
  "MATCH-TIMER-FULLTIME": "rules-timer-fulltime-oracle-v1",
};

// ---------------------------------------------------------------------------
// Observation builder (compact)
// ---------------------------------------------------------------------------

function mk(tick: number, events: TelemetryObservation["events"], lastTouchRef?: string | null): TelemetryObservation {
  return {
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
  };
}

function throwInStream(): TelemetryObservation[] {
  return [
    mk(1, [{ id: "c-1", tick: 1, sequence: 1, kind: "player-ball-contact", payload: { teamId: "team-b", playerId: "player-2" } }], "c-1"),
    mk(2, [{ id: "t-2", tick: 2, sequence: 2, kind: "ball-touchline-out-of-play", payload: { touchlineIndex: 0, ballPosition: { x: 10, y: 34, z: 0.11 }, lastTouchRef: "c-1" } }], "c-1"),
    mk(3, [{ id: "ti-3", tick: 3, sequence: 3, kind: "throw-in-executed", payload: { teamId: "team-a", kickTakerId: "player-1" } }]),
  ];
}

// ---------------------------------------------------------------------------
// 1. Criterion_bindings → invariant → registered oracle chain
// ---------------------------------------------------------------------------

describe("§15 criterion bindings resolve to registered protected oracles", () => {
  for (const [criterionId, oracleId] of Object.entries(RULES_ORACLE_CRITERIA)) {
    it(`${criterionId} binds to ${oracleId}`, () => {
      // 1. Find the binding that references this criterion.
      const binding = Object.entries(TEST_BINDINGS).find(
        ([, b]) => b.criterion_bindings[criterionId] !== undefined,
      );
      expect(binding, `no test binding references ${criterionId}`).toBeDefined();

      // 2. The criterion's bound invariant_id resolves to an InvariantDefinition.
      const invariantIds = binding![1].criterion_bindings[criterionId];
      expect(invariantIds.length).toBeGreaterThan(0);
      const invariant = INVARIANT_DEFINITIONS[invariantIds[0]];
      expect(invariant, `invariant ${invariantIds[0]} undefined`).toBeDefined();

      // 3. The invariant's oracle_id/version match the registered protected oracle.
      expect(invariant!.oracle_id).toBe(oracleId);
      const registered = getOracle(invariant!.oracle_id, invariant!.oracle_version);
      expect(registered, `oracle ${oracleId} is not registered`).toBeDefined();
      expect(registered!.oracle_version).toBe(invariant!.oracle_version);
    });
  }

  it("every rules test binding references at least the scenario and observation IDs the loader requires", () => {
    const registry = loadRegistrySet();
    const rulesBindings = Object.entries(TEST_BINDINGS).filter(([id]) => id.startsWith("RULES-"));
    expect(rulesBindings.length).toBe(8);
    for (const [, binding] of rulesBindings) {
      expect(binding.scenario_ids.length).toBeGreaterThan(0);
      expect(binding.observation_ids.length).toBeGreaterThan(0);
      for (const sid of binding.scenario_ids) {
        expect(registry.scenario_definitions[sid]).toBeDefined();
      }
      for (const oid of binding.observation_ids) {
        expect(registry.observation_definitions[oid]).toBeDefined();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Evaluator verdicts over a rule stream
// ---------------------------------------------------------------------------

describe("evaluateSuite('rules', ...) produces real verdicts", () => {
  it("a valid throw-in window yields a PASS on MATCH-THROW-IN-AWARD", () => {
    const result = evaluateSuite("rules", throwInStream());
    const test = result.tests.find((t) => t.test_id === "RULES-THROWIN-001");
    expect(test).toBeDefined();
    const award = test!.criteria.find((c) => c.criterion_id === "MATCH-THROW-IN-AWARD");
    expect(award!.outcome).toBe("PASS");
  });

  it("a throw-in window with no restart-free run leaves the no-oracle criteria NOT_EVALUATED", () => {
    const result = evaluateSuite("rules", throwInStream());
    const test = result.tests.find((t) => t.test_id === "RULES-THROWIN-001");
    const placement = test!.criteria.find((c) => c.criterion_id === "MATCH-THROW-IN-PLACEMENT");
    expect(placement!.outcome).toBe("NOT_EVALUATED");
  });

  it("a non-rule stream (no boundary) leaves the rules oracles NOT_EVALUATED", () => {
    const obs = [mk(1, []), mk(2, [])];
    const result = evaluateSuite("rules", obs);
    const test = result.tests.find((t) => t.test_id === "RULES-OOP-001");
    const detect = test!.criteria.find((c) => c.criterion_id === "MATCH-OUT-OF-PLAY-DETECT");
    expect(detect!.outcome).toBe("NOT_EVALUATED");
  });
});

// ---------------------------------------------------------------------------
// 3. Registry has the rules suite and is self-consistent
// ---------------------------------------------------------------------------

describe("registry consistency", () => {
  it("content hash is a genuine fnv1a64-v1 (registry evolved to include the rules suite)", () => {
    const registry = loadRegistrySet();
    expect(registry.content_hash).toMatch(/^fnv1a64-v1:[0-9a-f]{16}$/);
    expect(registry.suite_definitions["rules"]).toBeDefined();
    expect(registry.expansion_manifests["expansion-rules-v1"]).toBeDefined();
    expect(registry.config_policies["config-rules-v1"]).toBeDefined();
  });
});
