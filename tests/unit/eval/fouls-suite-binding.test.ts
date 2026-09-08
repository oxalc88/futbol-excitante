/**
 * @module tests/unit/eval/fouls-suite-binding
 *
 * Binding tests for FOULS-SUITE-REGISTRATION (objective: register the FOULS
 * and_SPEC §10 criteria the accepted detection machinery makes answerable —
 * FOUL-DETECT and FOUL-CLEAN-TACKLE — as executable protected oracles over a
 * `fouls` evaluator suite, suite-fouls-v1).
 *
 * These lock the §10 registered criteria to their protected oracles through the
 * full chain:
 *   criterion_bindings  -> invariant_definitions -> registered oracle
 *   (bindings.ts)          (invariant-definitions.ts)   (wire.ts / oracle-registry.ts)
 *
 * and confirm evaluateSuite("fouls", observations) turns those bindings into real
 * verdicts over a constructed foul-bearing stream (PASS), returns the honest
 * NOT_EVALUATED over a stream with no emitted `foul` event, and FAILs on a
 * mutated / weakened stream (canary guards).  CARD-ISSUED / ADVANTAGE-PLAYED /
 * FREE-KICK-AWARD stay named-but-unregistered — no criterion, oracle, invariant
 * or binding is added for them, and no verdict is claimed for them.
 *
 * No gameplay PASS is claimed beyond what the executed evaluator returns.
 * No PES reference is invented.
 *
 * No Math.random, Date, performance, DOM in core; observations are built
 * in-memory.
 */

import { describe, it, expect } from "vitest";

// Import wire.ts to register the built-in oracles (side-effect).
import "../../../eval/oracles/wire.js";
import { getOracle } from "../../../eval/oracles/oracle-registry.js";
import { detectFoulEvents, FOUL_CONTACT_TYPES } from "../../../eval/runners/foul-detection.js";
import { TEST_BINDINGS } from "../../../eval/contracts/bindings.js";
import { INVARIANT_DEFINITIONS } from "../../../eval/contracts/invariant-definitions.js";
import { COMMON_CRITERIA } from "../../../eval/contracts/common-criteria.js";
import { SUITES, FOULS_SUITE } from "../../../eval/contracts/suites.js";
import { EXPANSION_MANIFESTS } from "../../../eval/contracts/policies.js";
import { loadRegistrySet, validateRegistrySet } from "../../../eval/contracts/loader.js";
import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";

import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// The §10 criteria bound to a protected foul oracle (the three registered).
// ---------------------------------------------------------------------------

const FOULS_ORACLE_CRITERIA: Record<string, string> = {
  "FOUL-DETECT": "foul-detect-oracle-v1",
  "FOUL-CLEAN-TACKLE": "foul-clean-tackle-oracle-v1",
  "FREE-KICK-AWARD": "foul-free-kick-award-oracle-v1",
};

// The two §10 criteria that must remain NAMED-BUT-UNREGISTERED (no machinery).
const NAMED_BUT_UNREGISTERED = [
  "CARD-ISSUED",
  "ADVANTAGE-PLAYED",
];

const FOULS_TEST_IDS = [
  "FOULS-DETECT-001",
  "FOULS-CLEAN-TACKLE-001",
  "FOULS-FREE-KICK-AWARD-001",
];

// ---------------------------------------------------------------------------
// Observation builders
// ---------------------------------------------------------------------------

function mk(tick: number, events: TelemetryObservation["events"]): TelemetryObservation {
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
      { playerId: "def-1", teamId: "team-a", groundPosition: { x: 10, y: 0 }, linearVelocity: { x: 0, y: 0 }, desiredVelocity: { x: 0, y: 0 }, bodyHeading: 0, desiredHeading: 0 },
      { playerId: "carrier-1", teamId: "team-b", groundPosition: { x: 8, y: 0 }, linearVelocity: { x: 0, y: 0 }, desiredVelocity: { x: 0, y: 0 }, bodyHeading: 3.14159, desiredHeading: 3.14159 },
    ],
    ball: { position: { x: 0, y: 0, z: 0.11 }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, regime: "ground-roll", lastTouchRef: null },
    events,
  };
}

const MAN_NOT_BALL = {
  playerIdA: "def-1",
  playerIdB: "carrier-1",
  teamIdA: "team-a",
  teamIdB: "team-b",
  contactType: "standing-tackle",
  tacklePhase: "active",
  attemptStartTick: 8,
  activeWindowStartTick: 10,
  activeWindowEndTick: 13,
  reach: 1.6,
  planarDistance: 0.4,
  committedDirection: { x: 1, y: 0 },
  ballReachable: false,
  duelWon: false,
};

/** A single committed player-player-contact event. */
function contactEvent(id: string, payload: Record<string, unknown>): TelemetryObservation["events"][number] {
  return { id, tick: 10, sequence: 1, kind: "player-player-contact", label: "tackle duel", payload };
}

/**
 * A foul-bearing stream: the accepted detector runs over a man-not-ball contact
 * and emits a genuine `foul` event.
 */
function foulStream(): TelemetryObservation[] {
  const obs = mk(10, [contactEvent("ppc-10-1", MAN_NOT_BALL)]);
  detectFoulEvents([obs]);
  return [obs];
}

/** A stream with only clean / shoulder contacts and NO emitted foul. */
function noFoulStream(): TelemetryObservation[] {
  const clean = { ...MAN_NOT_BALL, duelWon: true, ballReachable: true };
  const shoulder = { ...MAN_NOT_BALL, contactType: "player-player" };
  return [
    mk(10, [
      contactEvent("clean-10-1", clean),
      contactEvent("shoulder-10-2", shoulder),
    ]),
  ];
}

/** A free-kick-executed event payload (FREE-KICK-AWARD reads it). */
function freeKickEvent(
  id: string,
  teamId: string,
  position: { x: number; y: number },
): TelemetryObservation["events"][number] {
  return {
    id,
    tick: 11,
    sequence: 1,
    kind: "free-kick-executed",
    label: `free kick for ${teamId}`,
    payload: {
      teamId,
      kickTakerId: "carrier-1",
      freeKickPosition: position,
      targetPosition: { x: position.x + 10, y: position.y },
      kickDirection: { x: 1, y: 0 },
    },
  };
}

/**
 * A foul-bearing stream that ALSO carries the consequence-free kick: a genuine
 * man-not-ball foul (contact at tick 10) matched by a free-kick-executed for the
 * fouled team at the contact position (the fouled player carrier-1 at (8, 0)).
 */
function foulFreeKickStream(): TelemetryObservation[] {
  const obs = [mk(10, [contactEvent("ppc-10-1", MAN_NOT_BALL)])];
  detectFoulEvents(obs);
  const fk = mk(11, [freeKickEvent("fk-11-1", "team-b", { x: 8, y: 0 })]);
  return [...obs, fk];
}

// ---------------------------------------------------------------------------
// 1. Criterion_bindings → invariant → registered oracle chain
// ---------------------------------------------------------------------------

describe("§10 criterion bindings resolve to registered protected oracles", () => {
  for (const [criterionId, oracleId] of Object.entries(FOULS_ORACLE_CRITERIA)) {
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

  it("each fouls criterion is in COMMON_CRITERIA with HARD_INVARIANT class", () => {
    for (const criterionId of Object.keys(FOULS_ORACLE_CRITERIA)) {
      const criterion = COMMON_CRITERIA[criterionId];
      expect(criterion, `${criterionId} must be a registered criterion`).toBeDefined();
      expect(criterion!.class).toBe("HARD_INVARIANT");
    }
  });

  it("every fouls test binding declares the required scenario and observations", () => {
    const registry = loadRegistrySet();
    for (const [id, binding] of Object.entries(TEST_BINDINGS)) {
      if (!FOULS_TEST_IDS.includes(id)) continue;
      expect(binding.scenario_ids.length).toBeGreaterThan(0);
      expect(binding.observation_ids.length).toBeGreaterThan(0);
      for (const sid of binding.scenario_ids) expect(registry.scenario_definitions[sid]).toBeDefined();
      for (const oid of binding.observation_ids) expect(registry.observation_definitions[oid]).toBeDefined();
    }
  });

  it("the named-but-unregistered criteria (card/advantage) have NO criterion, oracle or binding", () => {
    for (const id of NAMED_BUT_UNREGISTERED) {
      expect(COMMON_CRITERIA[id], `${id} must not be a registered criterion`).toBeUndefined();
      expect(FOUL_CONTACT_TYPES.has(id)).toBe(false);
      const binding = Object.entries(TEST_BINDINGS).find(([, b]) => b.criterion_bindings[id] !== undefined);
      expect(binding, `${id} must not be bound in any test binding`).toBeUndefined();
    }
    expect(getOracle("foul-card-issued-oracle-v1", "oracle-foul-card-issued-v1")).toBeUndefined();
    expect(getOracle("foul-advantage-oracle-v1", "oracle-foul-advantage-v1")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Suite registration
// ---------------------------------------------------------------------------

describe("fouls suite registration", () => {
  it("FOULS_SUITE is exported and registered in SUITES", () => {
    expect(FOULS_SUITE).toBeDefined();
    expect(FOULS_SUITE.suite_id).toBe("fouls");
    expect(FOULS_SUITE.suite_version).toBe("suite-fouls-v1");
    expect(SUITES["fouls"]).toBe(FOULS_SUITE);
  });

  it("fouls suite has exactly the three §10 registered test ids", () => {
    expect(FOULS_SUITE.direct_test_ids).toEqual(FOULS_TEST_IDS);
  });

  it("fouls suite requires the duels/ball capabilities and has no COMMON criteria", () => {
    expect(FOULS_SUITE.prerequisite_capabilities).toContain("PLAYER_DUELS");
    expect(FOULS_SUITE.common_criterion_ids).toEqual([]);
  });

  it("expansion manifest for fouls exists", () => {
    const manifest = EXPANSION_MANIFESTS["expansion-fouls-v1"];
    expect(manifest).toBeDefined();
    expect(manifest.suite_id).toBe("fouls");
    expect(manifest.impact_closure).toBe("NONE");
    expect(manifest.direct_test_ids).toEqual(FOULS_SUITE.direct_test_ids);
  });

  it("all fouls test_ids have bindings and the registry validates cleanly", () => {
    for (const testId of FOULS_TEST_IDS) {
      expect(TEST_BINDINGS[testId], `Binding must exist for "${testId}"`).toBeDefined();
    }
    const registry = loadRegistrySet();
    expect(validateRegistrySet(registry)).toHaveLength(0);
    expect(registry.suite_definitions["fouls"]).toBeDefined();
    expect(registry.test_bindings["FOULS-DETECT-001"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 3. evaluateSuite("fouls", ...) verdicts over constructed streams
// ---------------------------------------------------------------------------

describe("evaluateSuite('fouls', ...) produces real verdicts", () => {
  it("a foul-bearing stream yields PASS on both FOUL-DETECT and FOUL-CLEAN-TACKLE", () => {
    const result = evaluateSuite("fouls", foulStream());
    expect(result.suite_id).toBe("fouls");
    expect(result.suite_version).toBe("suite-fouls-v1");

    const detectTest = result.tests.find((t) => t.test_id === "FOULS-DETECT-001");
    expect(detectTest).toBeDefined();
    const detect = detectTest!.criteria.find((c) => c.criterion_id === "FOUL-DETECT");
    expect(detect!.outcome).toBe("PASS");

    const cleanTest = result.tests.find((t) => t.test_id === "FOULS-CLEAN-TACKLE-001");
    expect(cleanTest).toBeDefined();
    const clean = cleanTest!.criteria.find((c) => c.criterion_id === "FOUL-CLEAN-TACKLE");
    expect(clean!.outcome).toBe("PASS");
  });

  it("a stream with no emitted foul (negative control) is NOT_EVALUATED, never PASS", () => {
    const result = evaluateSuite("fouls", noFoulStream());
    let sawAny = false;
    for (const test of result.tests) {
      for (const c of test.criteria) {
        sawAny = true;
        expect(c.outcome, `${test.test_id} ${c.criterion_id} must not PASS`).not.toBe("PASS");
        expect(c.outcome).toBe("NOT_EVALUATED");
      }
    }
    expect(sawAny).toBe(true);
  });

  it("a genuine foul + consequence free-kick stream yields FREE-KICK-AWARD PASS", () => {
    const result = evaluateSuite("fouls", foulFreeKickStream());
    const fkTest = result.tests.find((t) => t.test_id === "FOULS-FREE-KICK-AWARD-001");
    expect(fkTest).toBeDefined();
    const fk = fkTest!.criteria.find((c) => c.criterion_id === "FREE-KICK-AWARD");
    expect(fk!.outcome).toBe("PASS");
  });

  it("a foul with NO observable free-kick-executed is FREE-KICK-AWARD NOT_EVALUATED (honest absence)", () => {
    // A foul-bearing stream: the foul is detected but the free-kick-executed
    // event is not carried in the observation stream (the accepted driven shape
    // commits the free kick in the core's persistent state).  The oracle must
    // not PASS or FAIL — honest NOT_EVALUATED.
    const result = evaluateSuite("fouls", foulStream());
    const fk = result.tests
      .find((t) => t.test_id === "FOULS-FREE-KICK-AWARD-001")!
      .criteria.find((c) => c.criterion_id === "FREE-KICK-AWARD");
    expect(fk!.outcome).toBe("NOT_EVALUATED");
  });
});

// ---------------------------------------------------------------------------
// 4. Canary / mutant guards: a mutated or weakened oracle must FAIL
// ---------------------------------------------------------------------------

describe("mutant / canary guards", () => {
  it("FOUL-DETECT FAILs on a foul carrying a non-spec contactType (weakened oracle)", () => {
    // A mutated stream: the detector was tricked into emitting a foul for a
    // non-tackle contact.  Emit a `foul` event whose contactType is wrong.
    const obs = mk(10, [
      contactEvent("shoulder-10-1", { ...MAN_NOT_BALL, contactType: "player-player" }),
      {
        id: "foul-10-2",
        tick: 10,
        sequence: 2,
        kind: "foul",
        label: "mutant foul",
        payload: {
          ...MAN_NOT_BALL,
          contactType: "player-player",
          sourceEventId: "shoulder-10-1",
        },
      },
    ]);
    const result = evaluateSuite("fouls", [obs]);
    const detectTest = result.tests.find((t) => t.test_id === "FOULS-DETECT-001");
    const detect = detectTest!.criteria.find((c) => c.criterion_id === "FOUL-DETECT");
    expect(detect!.outcome).toBe("FAIL");
  });

  it("FOUL-DETECT FAILs on a foul sourced from a clean tackle (duelWon true)", () => {
    const obs = mk(10, [
      contactEvent("clean-10-1", { ...MAN_NOT_BALL, duelWon: true, ballReachable: true }),
      {
        id: "foul-10-2",
        tick: 10,
        sequence: 2,
        kind: "foul",
        label: "mutant foul",
        payload: { ...MAN_NOT_BALL, duelWon: true, ballReachable: true, sourceEventId: "clean-10-1" },
      },
    ]);
    const result = evaluateSuite("fouls", [obs]);
    const detect = result.tests
      .find((t) => t.test_id === "FOULS-DETECT-001")!
      .criteria.find((c) => c.criterion_id === "FOUL-DETECT");
    expect(detect!.outcome).toBe("FAIL");
  });

  it("FOUL-CLEAN-TACKLE FAILs when a clean tackle emitted a foul", () => {
    const obs = mk(10, [
      contactEvent("clean-10-1", { ...MAN_NOT_BALL, duelWon: true, ballReachable: true }),
      {
        id: "foul-10-2",
        tick: 10,
        sequence: 2,
        kind: "foul",
        label: "mutant foul",
        payload: { ...MAN_NOT_BALL, ballReachable: true, duelWon: true, sourceEventId: "clean-10-1" },
      },
    ]);
    const result = evaluateSuite("fouls", [obs]);
    const clean = result.tests
      .find((t) => t.test_id === "FOULS-CLEAN-TACKLE-001")!
      .criteria.find((c) => c.criterion_id === "FOUL-CLEAN-TACKLE");
    expect(clean!.outcome).toBe("FAIL");
  });

  it("FOUL-CLEAN-TACKLE FAILs when a symmetric shoulder contact emitted a foul", () => {
    const obs = mk(10, [
      contactEvent("shoulder-10-1", { ...MAN_NOT_BALL, contactType: "player-player" }),
      {
        id: "foul-10-2",
        tick: 10,
        sequence: 2,
        kind: "foul",
        label: "mutant foul",
        payload: { ...MAN_NOT_BALL, contactType: "player-player", sourceEventId: "shoulder-10-1" },
      },
    ]);
    const result = evaluateSuite("fouls", [obs]);
    const clean = result.tests
      .find((t) => t.test_id === "FOULS-CLEAN-TACKLE-001")!
      .criteria.find((c) => c.criterion_id === "FOUL-CLEAN-TACKLE");
    expect(clean!.outcome).toBe("FAIL");
  });

  it("a genuine foul stream does NOT false-positive on the clean complement", () => {
    // The real detection emitted a foul from a man-not-ball contact; a clean
    // and a shoulder contact are ALSO present and emitted no foul.  Both
    // criteria PASS — the oracle must not flag a false positive.
    const clean = { ...MAN_NOT_BALL, duelWon: true, ballReachable: true };
    const shoulder = { ...MAN_NOT_BALL, contactType: "player-player" };
    const obs = mk(10, [
      contactEvent("man-10-1", MAN_NOT_BALL),
      contactEvent("clean-10-2", clean),
      contactEvent("shoulder-10-3", shoulder),
    ]);
    detectFoulEvents([obs]);
    const result = evaluateSuite("fouls", [obs]);
    const detect = result.tests
      .find((t) => t.test_id === "FOULS-DETECT-001")!
      .criteria.find((c) => c.criterion_id === "FOUL-DETECT");
    const cleanT = result.tests
      .find((t) => t.test_id === "FOULS-CLEAN-TACKLE-001")!
      .criteria.find((c) => c.criterion_id === "FOUL-CLEAN-TACKLE");
    expect(detect!.outcome).toBe("PASS");
    expect(cleanT!.outcome).toBe("PASS");
  });

  it("FREE-KICK-AWARD FAILs when a free kick is awarded with NO detected foul (power guard)", () => {
    // A free-kick-executed event with no man-not-ball foul behind it (the
    // freeKickWindow anti-huddle control shape): under §10 a free kick is only
    // the consequence of a called foul, so this is an invalid award.
    const obs = mk(11, [freeKickEvent("fk-11-1", "team-b", { x: 8, y: 0 })]);
    const result = evaluateSuite("fouls", [obs]);
    const fk = result.tests
      .find((t) => t.test_id === "FOULS-FREE-KICK-AWARD-001")!
      .criteria.find((c) => c.criterion_id === "FREE-KICK-AWARD");
    expect(fk!.outcome).toBe("FAIL");
  });

  it("FREE-KICK-AWARD FAILs when a foul's free kick goes to the WRONG team", () => {
    const obs = [mk(10, [contactEvent("ppc-10-1", MAN_NOT_BALL)]), mk(11, [freeKickEvent("fk-11-1", "team-a", { x: 8, y: 0 })])];
    detectFoulEvents(obs);
    const result = evaluateSuite("fouls", obs);
    const fk = result.tests
      .find((t) => t.test_id === "FOULS-FREE-KICK-AWARD-001")!
      .criteria.find((c) => c.criterion_id === "FREE-KICK-AWARD");
    expect(fk!.outcome).toBe("FAIL");
  });

  it("FREE-KICK-AWARD FAILs when a foul's free kick is placed away from the contact position", () => {
    // The foul's contact position is carrier-1 at (8, 0); a free kick placed at
    // (8, 5) is not at the contact spot (beyond the 0.5 m placement tolerance).
    const obs = [mk(10, [contactEvent("ppc-10-1", MAN_NOT_BALL)]), mk(11, [freeKickEvent("fk-11-1", "team-b", { x: 8, y: 5 })])];
    detectFoulEvents(obs);
    const result = evaluateSuite("fouls", obs);
    const fk = result.tests
      .find((t) => t.test_id === "FOULS-FREE-KICK-AWARD-001")!
      .criteria.find((c) => c.criterion_id === "FREE-KICK-AWARD");
    expect(fk!.outcome).toBe("FAIL");
  });
});

// ---------------------------------------------------------------------------
// 5. Registry integrity: content hash + named-but-unregistered absence
// ---------------------------------------------------------------------------

describe("registry integrity", () => {
  it("content hash is a genuine fnv1a64-v1 (registry evolved to include the fouls suite)", () => {
    const registry = loadRegistrySet();
    expect(registry.content_hash).toMatch(/^fnv1a64-v1:[0-9a-f]{16}$/);
    expect(registry.suite_definitions["fouls"]).toBeDefined();
    expect(registry.expansion_manifests["expansion-fouls-v1"]).toBeDefined();
    expect(registry.config_policies["config-fouls-v1"]).toBeDefined();
    expect(registry.invariant_definitions["foul-detect-evidence"]).toBeDefined();
    expect(registry.invariant_definitions["foul-clean-tackle-evidence"]).toBeDefined();
    expect(registry.invariant_definitions["foul-free-kick-award-evidence"]).toBeDefined();
    expect(registry.observation_definitions["obs-fouls-v1"]).toBeDefined();
  });
});
