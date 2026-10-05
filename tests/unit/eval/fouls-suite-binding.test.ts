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
 * mutated / weakened stream (canary guards).  FREE-KICK-AWARD, CARD-ISSUED and
 * ADVANTAGE-PLAYED are registered by their suite-registration objectives.  The
 * §6.2a judged-retained advantage path is NOT implemented: a retained-path input
 * is reported honestly as BLOCKED_MISSING_REFERENCE (advantage_retention_ref)
 * and never PASSed.
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
import { checkFoulAdvantagePlayed } from "../../../eval/oracles/fouls.js";
import {
  foulContactSeverity,
  resolveDirectRedForFoul,
  FOUL_CARD_DIRECT_RED_SEVERITY_THRESHOLD,
} from "../../../src/simulation/card-policy.js";
import { TEST_BINDINGS } from "../../../eval/contracts/bindings.js";
import { INVARIANT_DEFINITIONS } from "../../../eval/contracts/invariant-definitions.js";
import { COMMON_CRITERIA } from "../../../eval/contracts/common-criteria.js";
import { SUITES, FOULS_SUITE } from "../../../eval/contracts/suites.js";
import { EXPANSION_MANIFESTS } from "../../../eval/contracts/policies.js";
import { loadRegistrySet, validateRegistrySet } from "../../../eval/contracts/loader.js";
import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";

import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// The §10 criteria bound to a protected foul oracle (the four registered).
// ---------------------------------------------------------------------------

const FOULS_ORACLE_CRITERIA: Record<string, string> = {
  "FOUL-DETECT": "foul-detect-oracle-v1",
  "FOUL-CLEAN-TACKLE": "foul-clean-tackle-oracle-v1",
  "FREE-KICK-AWARD": "foul-free-kick-award-oracle-v1",
  "CARD-ISSUED": "foul-card-issued-oracle-v1",
  "CARD-DIRECT-RED": "foul-card-direct-red-oracle-v1",
  "ADVANTAGE-PLAYED": "foul-advantage-played-oracle-v1",
};

/**
 * §6.2a judged-retained inputs are NOT registered as a passing criterion: the
 * retained-advantage predicate is unimplemented and its reference
 * (advantage_retention_ref) is BLOCKED_MISSING_REFERENCE.  The oracle reports a
 * retained-path input honestly as blocked and never PASSes it.
 */
const RETAINED_PATH_REFERENCE = "advantage_retention_ref";

const FOULS_TEST_IDS = [
  "FOULS-DETECT-001",
  "FOULS-CLEAN-TACKLE-001",
  "FOULS-FREE-KICK-AWARD-001",
  "FOULS-CARD-ISSUED-001",
  "FOULS-CARD-DIRECT-RED-001",
  "FOULS-ADVANTAGE-PLAYED-001",
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

/** A card-issued event payload (CARD-ISSUED reads it). */
function cardIssuedEvent(
  id: string,
  payload: Record<string, unknown>,
  tick: number,
): TelemetryObservation["events"][number] {
  return {
    id,
    tick,
    sequence: 1,
    kind: "card-issued",
    label: "card issued",
    payload,
  };
}

/**
 * A card-bearing stream: two genuine man-not-ball fouls for def-1 (the tackler),
 * with a caution issued at the 2nd accumulated count (fouls_yellow=2).  The
 * `card-issued` event is present in the observation stream (the
 * serializeRestartFacts committed-events shape).
 */
function cardIssuedStream(): TelemetryObservation[] {
  const obs = [
    mk(10, [contactEvent("ppc-10-1", MAN_NOT_BALL)]),
    mk(20, [contactEvent("ppc-20-2", { ...MAN_NOT_BALL, attemptStartTick: 18, activeWindowStartTick: 20, activeWindowEndTick: 23 })]),
  ];
  detectFoulEvents(obs);
  // The 2nd foul (tick 20) accumulates to 2 → caution at accumulation count 2.
  const card = cardIssuedEvent("card-20-1", {
    cardType: "caution",
    playerId: "def-1",
    teamId: "team-a",
    fouledPlayerId: "carrier-1",
    accumulatedFouls: 2,
    foulSourceEventId: "ppc-20-2",
    foulTick: 20,
  }, 20);
  return [...obs, mk(20, [card])];
}

/**
 * A committed SLIDING man-not-ball tackle contact deep inside the versioned
 * slide reach (2.8 m): the committed contact severity crosses the §9.1
 * direct-red threshold.  Only accepted tackle-contact fields are used.
 */
const DEEP_SLIDE = {
  ...MAN_NOT_BALL,
  contactType: "slide-tackle",
  reach: 2.8,
  planarDistance: 0.42,
  activeWindowStartTick: 10,
  activeWindowEndTick: 18,
};

/**
 * A direct-red stream: a genuine deep sliding man-not-ball foul whose committed
 * severity crosses the §9.1 threshold, carrying the committed direct-red
 * `card-issued` event (cardReason "direct-severity") the §7 path emits.
 */
function directRedStream(contact: Record<string, unknown> = DEEP_SLIDE): TelemetryObservation[] {
  const obs = [mk(10, [contactEvent("ppc-10-1", contact)])];
  detectFoulEvents(obs);
  const card = cardIssuedEvent("card-10-1", {
    cardType: "expulsion",
    cardReason: "direct-severity",
    directRedSeverity: foulContactSeverity(contact),
    playerId: "def-1",
    teamId: "team-a",
    fouledPlayerId: "carrier-1",
    accumulatedFouls: 1,
    foulSourceEventId: "ppc-10-1",
    foulTick: 10,
  }, 10);
  return [...obs, mk(10, [card])];
}

/** The CARD-DIRECT-RED criterion outcome of a fouls-suite evaluation. */
function directRedOutcome(observations: TelemetryObservation[]): string {
  const suite = evaluateSuite("fouls", observations);
  return suite.tests
    .find((t) => t.test_id === "FOULS-CARD-DIRECT-RED-001")!
    .criteria.find((c) => c.criterion_id === "CARD-DIRECT-RED")!.outcome;
}

/** A per-tick observation with an explicit ball lastTouchRef. */
function mkRef(
  tick: number,
  events: TelemetryObservation["events"],
  lastTouchRef: string | null,
): TelemetryObservation {
  const obs = mk(tick, events);
  obs.ball = { ...obs.ball, lastTouchRef };
  return obs;
}

/** A committed touch event carrying a teamId (resolves a lastTouchRef). */
function touchEvent(id: string, teamId: string, tick: number): TelemetryObservation["events"][number] {
  return { id, tick, sequence: 1, kind: "pass", label: "touch", payload: { playerId: "carrier-1", teamId } };
}

/** A core-match-phase event (the phase the shared advantage policy reads). */
function phaseEvent(tick: number, matchPhase: string): TelemetryObservation["events"][number] {
  return { id: `core-match-phase-${tick}-1`, tick, sequence: 2, kind: "core-match-phase", label: "phase", payload: { matchPhase } };
}

/** A committed advantage-window decision event. */
function advantageEvent(
  id: string,
  kind: "advantage-opened" | "advantage-cancelled" | "advantage-expired",
  payload: Record<string, unknown>,
  tick: number,
): TelemetryObservation["events"][number] {
  return { id, tick, sequence: 1, kind, label: "advantage window", payload };
}

/** The opened payload of the accepted ADVANTAGE-MACHINERY shape (§6.2). */
function advantageOpenedPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    openTick: 10,
    windowTicks: 24,
    pendingFoulCount: 1,
    foulSourceEventId: "ppc-10-1",
    foulTick: 10,
    fouledTeam: "team-b",
    offenderId: "def-1",
    fouledPlayerId: "carrier-1",
    ...overrides,
  };
}

/** The close payload of the accepted ADVANTAGE-MACHINERY shape (§6.2–§6.4). */
function advantageClosedPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    openTick: 10,
    closeTick: 34,
    windowTicks: 24,
    reason: "expired",
    pendingFoulCount: 1,
    cautionPendingBudgetTicks: 12,
    cautionPendingTicksUsed: 0,
    foulSourceEventId: "ppc-10-1",
    foulTick: 10,
    fouledTeam: "team-b",
    offenderId: "def-1",
    fouledPlayerId: "carrier-1",
    ...overrides,
  };
}

/**
 * A stream carrying a genuine man-not-ball foul and the committed §6.2–§6.4
 * window decisions: the window opens on the contact tick (10) and expires at the
 * 24-tick budget (tick 34), with the fouled team still in possession.
 */
function advantageStream(): TelemetryObservation[] {
  const open = mk(10, [
    contactEvent("ppc-10-1", MAN_NOT_BALL),
    advantageEvent("advantage-opened-10-1", "advantage-opened", advantageOpenedPayload(), 10),
  ]);
  detectFoulEvents([open]);
  return [
    open,
    mkRef(20, [touchEvent("pass-20-1", "team-b", 20)], "pass-20-1"),
    mkRef(33, [], "pass-20-1"),
    mkRef(34, [
      advantageEvent("advantage-expired-34-1", "advantage-expired", advantageClosedPayload(), 34),
      phaseEvent(34, "playing"),
    ], "pass-20-1"),
  ];
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

  it("registers ADVANTAGE-PLAYED as a criterion bound to the protected advantage oracle", () => {
    const criterion = COMMON_CRITERIA["ADVANTAGE-PLAYED"];
    expect(criterion, "ADVANTAGE-PLAYED must be a registered criterion").toBeDefined();
    expect(criterion!.class).toBe("HARD_INVARIANT");
    // ADVANTAGE-PLAYED is a criterion, never a tackle contact kind.
    expect(FOUL_CONTACT_TYPES.has("ADVANTAGE-PLAYED")).toBe(false);
    const binding = Object.entries(TEST_BINDINGS).find(
      ([, b]) => b.criterion_bindings["ADVANTAGE-PLAYED"] !== undefined,
    );
    expect(binding, "ADVANTAGE-PLAYED must be bound in a test binding").toBeDefined();
    expect(getOracle("foul-advantage-played-oracle-v1", "oracle-foul-advantage-played-v1")).toBeDefined();
    // The unimplemented retained path is not a registered oracle.
    expect(getOracle("foul-advantage-retained-oracle-v1", "oracle-foul-advantage-retained-v1")).toBeUndefined();
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

  it("fouls suite has exactly the six §10 registered test ids", () => {
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

  it("a committed advantage window (open → §6.2c expiry) yields ADVANTAGE-PLAYED PASS", () => {
    const result = evaluateSuite("fouls", advantageStream());
    const advantage = result.tests
      .find((t) => t.test_id === "FOULS-ADVANTAGE-PLAYED-001")!
      .criteria.find((c) => c.criterion_id === "ADVANTAGE-PLAYED");
    expect(advantage!.outcome).toBe("PASS");
  });

  it("a detected foul with NO observable advantage decision is ADVANTAGE-PLAYED NOT_EVALUATED (never PASS)", () => {
    // The accepted driven shape commits its window decisions in the core's
    // persistent state, not the per-step observation array; the oracle must not
    // invent a PASS from the absence of a decision.
    const result = evaluateSuite("fouls", foulStream());
    const advantage = result.tests
      .find((t) => t.test_id === "FOULS-ADVANTAGE-PLAYED-001")!
      .criteria.find((c) => c.criterion_id === "ADVANTAGE-PLAYED");
    expect(advantage!.outcome).toBe("NOT_EVALUATED");
  });

  it("a deep sliding foul crossing the §9.1 threshold yields CARD-DIRECT-RED PASS", () => {
    // The committed severity is the shared derivation; the threshold is the
    // exported fouls-v1 §9.1 value.  The crossing is genuine, not invented.
    expect(foulContactSeverity(DEEP_SLIDE)).toBeGreaterThanOrEqual(
      FOUL_CARD_DIRECT_RED_SEVERITY_THRESHOLD,
    );
    expect(resolveDirectRedForFoul(DEEP_SLIDE)).toBe("expulsion");
    expect(directRedOutcome(directRedStream())).toBe("PASS");
  });

  it("a below-threshold genuine foul (standing / grazing slide) with no direct-red card is NOT_EVALUATED", () => {
    // The driven standing contact is below the direct-red threshold; with no
    // observable direct-red card the oracle returns honest NOT_EVALUATED, never
    // an invented PASS.  The grazing slide (near the reach edge) is likewise
    // below threshold — the same honest absence.
    expect(resolveDirectRedForFoul(MAN_NOT_BALL)).toBeNull();
    expect(directRedOutcome(foulStream())).toBe("NOT_EVALUATED");
    const grazing = { ...MAN_NOT_BALL, contactType: "slide-tackle", reach: 2.8, planarDistance: 2.6 };
    expect(resolveDirectRedForFoul(grazing)).toBeNull();
    const grazingStream = [mk(10, [contactEvent("ppc-10-1", grazing)])];
    detectFoulEvents(grazingStream);
    expect(directRedOutcome(grazingStream)).toBe("NOT_EVALUATED");
  });

  it("an accumulation card (no direct-red marker) is NOT_EVALUATED for CARD-DIRECT-RED", () => {
    // The accumulation path's caution carries no cardReason, so CARD-DIRECT-RED
    // has nothing to adjudicate — the two card dispositions stay separate.
    expect(directRedOutcome(cardIssuedStream())).toBe("NOT_EVALUATED");
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

  it("CARD-ISSUED PASSes when each card matches the accumulation semantics", () => {
    // Two genuine man-not-ball fouls for def-1; a caution issued at accumulated
    // count 2 to the offender with a backing foul → PASS.
    const result = evaluateSuite("fouls", cardIssuedStream());
    const card = result.tests
      .find((t) => t.test_id === "FOULS-CARD-ISSUED-001")!
      .criteria.find((c) => c.criterion_id === "CARD-ISSUED");
    expect(card!.outcome).toBe("PASS");
  });

  it("CARD-ISSUED is NOT_EVALUATED over a no-card stream (below threshold / gate off)", () => {
    // A single genuine foul (below the caution threshold) with no observable
    // `card-issued` event: the oracle cannot confirm the accumulation semantic,
    // so it is honest NOT_EVALUATED — never an invented PASS or a false FAIL.
    const result = evaluateSuite("fouls", foulStream());
    const card = result.tests
      .find((t) => t.test_id === "FOULS-CARD-ISSUED-001")!
      .criteria.find((c) => c.criterion_id === "CARD-ISSUED");
    expect(card!.outcome).toBe("NOT_EVALUATED");
  });

  it("CARD-ISSUED FAILs when a card is issued with NO qualifying foul (power guard)", () => {
    // A `card-issued` event whose foulSourceEventId does not resolve to a genuine
    // man-not-ball foul → the card is not the consequence of a recognized foul.
    const obs = mk(10, [cardIssuedEvent("card-10-1", {
      cardType: "caution",
      playerId: "def-1",
      teamId: "team-a",
      fouledPlayerId: "carrier-1",
      accumulatedFouls: 2,
      foulSourceEventId: "ppc-nonexistent",
      foulTick: 10,
    }, 10)]);
    const result = evaluateSuite("fouls", [obs]);
    const card = result.tests
      .find((t) => t.test_id === "FOULS-CARD-ISSUED-001")!
      .criteria.find((c) => c.criterion_id === "CARD-ISSUED");
    expect(card!.outcome).toBe("FAIL");
  });

  it("CARD-ISSUED FAILs when a card goes to the WRONG player", () => {
    // A genuine foul for def-1, but the card is issued to carrier-1 (a bystander,
    // not the offending tackler) → FAIL.
    const obs = [mk(10, [contactEvent("ppc-10-1", MAN_NOT_BALL)])];
    detectFoulEvents(obs);
    const card = cardIssuedEvent("card-10-1", {
      cardType: "caution",
      playerId: "carrier-1",
      teamId: "team-b",
      fouledPlayerId: "carrier-1",
      accumulatedFouls: 2,
      foulSourceEventId: "ppc-10-1",
      foulTick: 10,
    }, 10);
    const result = evaluateSuite("fouls", [...obs, mk(10, [card])]);
    const crit = result.tests
      .find((t) => t.test_id === "FOULS-CARD-ISSUED-001")!
      .criteria.find((c) => c.criterion_id === "CARD-ISSUED");
    expect(crit!.outcome).toBe("FAIL");
  });

  it("CARD-ISSUED FAILs when the card type is wrong at the accumulated count", () => {
    // Two genuine fouls for def-1 reach accumulated count 2 (a caution is
    // warranted), but the card claims an expulsion → wrong card type at the
    // count → FAIL.
    const obs = [mk(10, [contactEvent("ppc-10-1", MAN_NOT_BALL)]), mk(20, [contactEvent("ppc-20-2", { ...MAN_NOT_BALL, attemptStartTick: 18, activeWindowStartTick: 20, activeWindowEndTick: 23 })])];
    detectFoulEvents(obs);
    const card = cardIssuedEvent("card-20-1", {
      cardType: "expulsion",
      playerId: "def-1",
      teamId: "team-a",
      fouledPlayerId: "carrier-1",
      accumulatedFouls: 2,
      foulSourceEventId: "ppc-20-2",
      foulTick: 20,
    }, 20);
    const result = evaluateSuite("fouls", [...obs, mk(20, [card])]);
    const crit = result.tests
      .find((t) => t.test_id === "FOULS-CARD-ISSUED-001")!
      .criteria.find((c) => c.criterion_id === "CARD-ISSUED");
    expect(crit!.outcome).toBe("FAIL");
  });

  it("ADVANTAGE-PLAYED FAILs when the window decision is not grounded in a recognized foul (power guard)", () => {
    // A clean tackle (duelWon true) is not a §5.1 foul candidate, so an
    // advantage window opened off it is invalid: the advantage decision is only
    // the consequence of a recognized man-not-ball foul.
    const clean = { ...MAN_NOT_BALL, duelWon: true, ballReachable: true };
    const obs = mk(10, [
      contactEvent("clean-10-1", clean),
      advantageEvent("advantage-opened-10-1", "advantage-opened", advantageOpenedPayload({ foulSourceEventId: "clean-10-1" }), 10),
    ]);
    const result = evaluateSuite("fouls", [obs]);
    const advantage = result.tests
      .find((t) => t.test_id === "FOULS-ADVANTAGE-PLAYED-001")!
      .criteria.find((c) => c.criterion_id === "ADVANTAGE-PLAYED");
    expect(advantage!.outcome).toBe("FAIL");
  });

  it("ADVANTAGE-PLAYED FAILs on a close with an unrecognized reason", () => {
    const open = mk(10, [
      contactEvent("ppc-10-1", MAN_NOT_BALL),
      advantageEvent("advantage-opened-10-1", "advantage-opened", advantageOpenedPayload(), 10),
    ]);
    detectFoulEvents([open]);
    const close = mk(34, [
      advantageEvent("advantage-cancelled-34-1", "advantage-cancelled", advantageClosedPayload({ reason: "cancelled-unknown" }), 34),
    ]);
    const result = evaluateSuite("fouls", [open, close]);
    const advantage = result.tests
      .find((t) => t.test_id === "FOULS-ADVANTAGE-PLAYED-001")!
      .criteria.find((c) => c.criterion_id === "ADVANTAGE-PLAYED");
    expect(advantage!.outcome).toBe("FAIL");
  });

  it("ADVANTAGE-PLAYED FAILs on a close with no matching opening window", () => {
    const obs = [
      mk(10, [contactEvent("ppc-10-1", MAN_NOT_BALL)]),
      mk(34, [advantageEvent("advantage-expired-34-1", "advantage-expired", advantageClosedPayload({ openTick: 5 }), 34)]),
    ];
    detectFoulEvents(obs);
    const result = evaluateSuite("fouls", obs);
    const advantage = result.tests
      .find((t) => t.test_id === "FOULS-ADVANTAGE-PLAYED-001")!
      .criteria.find((c) => c.criterion_id === "ADVANTAGE-PLAYED");
    expect(advantage!.outcome).toBe("FAIL");
  });

  it("ADVANTAGE-PLAYED FAILs when a close disagrees with the shared §6.2–§6.3 policy", () => {
    // The fouled team still holds the ball and the window budget is not reached,
    // so the shared policy leaves the window open (null); a committed
    // cancelled-last-touch-loss close contradicts it.
    const open = mk(10, [
      contactEvent("ppc-10-1", MAN_NOT_BALL),
      advantageEvent("advantage-opened-10-1", "advantage-opened", advantageOpenedPayload(), 10),
    ]);
    detectFoulEvents([open]);
    const obs = [
      open,
      mkRef(12, [touchEvent("pass-12-1", "team-b", 12)], "pass-12-1"),
      mkRef(14, [], "pass-12-1"),
      mkRef(15, [
        advantageEvent("advantage-cancelled-15-1", "advantage-cancelled", advantageClosedPayload({ closeTick: 15, reason: "cancelled-last-touch-loss" }), 15),
        phaseEvent(15, "playing"),
      ], "pass-12-1"),
    ];
    const result = evaluateSuite("fouls", obs);
    const advantage = result.tests
      .find((t) => t.test_id === "FOULS-ADVANTAGE-PLAYED-001")!
      .criteria.find((c) => c.criterion_id === "ADVANTAGE-PLAYED");
    expect(advantage!.outcome).toBe("FAIL");
  });

  it("ADVANTAGE-PLAYED reports a §6.2a retained-path input as BLOCKED_MISSING_REFERENCE, never PASS", () => {
    const open = mk(10, [
      contactEvent("ppc-10-1", MAN_NOT_BALL),
      advantageEvent("advantage-opened-10-1", "advantage-opened", advantageOpenedPayload(), 10),
    ]);
    detectFoulEvents([open]);
    const retainedClose = mk(20, [
      advantageEvent("advantage-cancelled-20-1", "advantage-cancelled", advantageClosedPayload({ closeTick: 20, reason: "judged-retained" }), 20),
    ]);
    const stream = [open, retainedClose];
    const result = evaluateSuite("fouls", stream);
    const advantage = result.tests
      .find((t) => t.test_id === "FOULS-ADVANTAGE-PLAYED-001")!
      .criteria.find((c) => c.criterion_id === "ADVANTAGE-PLAYED");
    expect(advantage!.outcome, "a retained judgment must never PASS").not.toBe("PASS");
    expect(advantage!.outcome).toBe("NOT_EVALUATED");

    const direct = checkFoulAdvantagePlayed(stream);
    expect(direct).toHaveLength(1);
    expect(direct[0].status).toBe("not_evaluated");
    expect(direct[0].description).toContain("BLOCKED_MISSING_REFERENCE");
    expect(direct[0].details?.blockedReference).toBe(RETAINED_PATH_REFERENCE);
  });

  it("CARD-DIRECT-RED FAILs on a direct red with NO qualifying man-not-ball foul (power guard)", () => {
    // A direct-red card whose foulSourceEventId resolves to no genuine §5.1
    // contact: a direct red is only the consequence of a recognized foul.
    const obs = mk(10, [cardIssuedEvent("card-10-1", {
      cardType: "expulsion",
      cardReason: "direct-severity",
      directRedSeverity: 0.95,
      playerId: "def-1",
      teamId: "team-a",
      fouledPlayerId: "carrier-1",
      accumulatedFouls: 1,
      foulSourceEventId: "ppc-nonexistent",
      foulTick: 10,
    }, 10)]);
    expect(directRedOutcome([obs])).toBe("FAIL");
  });

  it("CARD-DIRECT-RED FAILs on a direct red to the WRONG player", () => {
    // A genuine deep slide foul for def-1, but the direct red names carrier-1.
    const stream = directRedStream();
    const card = cardIssuedEvent("card-10-2", {
      cardType: "expulsion",
      cardReason: "direct-severity",
      directRedSeverity: foulContactSeverity(DEEP_SLIDE),
      playerId: "carrier-1",
      teamId: "team-b",
      fouledPlayerId: "carrier-1",
      accumulatedFouls: 1,
      foulSourceEventId: "ppc-10-1",
      foulTick: 10,
    }, 10);
    expect(directRedOutcome([...stream, mk(10, [card])])).toBe("FAIL");
  });

  it("CARD-DIRECT-RED FAILs on a direct red for a BELOW-threshold contact", () => {
    // A genuine standing man-not-ball foul (below the threshold) claimed as a
    // direct red: a below-threshold contact is not a direct red.
    const obs = [mk(10, [contactEvent("ppc-10-1", MAN_NOT_BALL)])];
    detectFoulEvents(obs);
    const card = cardIssuedEvent("card-10-1", {
      cardType: "expulsion",
      cardReason: "direct-severity",
      directRedSeverity: foulContactSeverity(MAN_NOT_BALL),
      playerId: "def-1",
      teamId: "team-a",
      fouledPlayerId: "carrier-1",
      accumulatedFouls: 1,
      foulSourceEventId: "ppc-10-1",
      foulTick: 10,
    }, 10);
    expect(directRedOutcome([...obs, mk(10, [card])])).toBe("FAIL");
  });

  it("CARD-DIRECT-RED FAILs on a wrong card type for the direct-red path", () => {
    // A direct-red marker on a caution is contradictory: the §7 severity path
    // is an expulsion.
    const stream = directRedStream();
    const card = cardIssuedEvent("card-10-2", {
      cardType: "caution",
      cardReason: "direct-severity",
      directRedSeverity: foulContactSeverity(DEEP_SLIDE),
      playerId: "def-1",
      teamId: "team-a",
      fouledPlayerId: "carrier-1",
      accumulatedFouls: 1,
      foulSourceEventId: "ppc-10-1",
      foulTick: 10,
    }, 10);
    expect(directRedOutcome([...stream, mk(10, [card])])).toBe("FAIL");
  });

  it("CARD-DIRECT-RED FAILs on a DUPLICATE direct red for the same foul", () => {
    const stream = directRedStream();
    const duplicate = cardIssuedEvent("card-10-2", {
      cardType: "expulsion",
      cardReason: "direct-severity",
      directRedSeverity: foulContactSeverity(DEEP_SLIDE),
      playerId: "def-1",
      teamId: "team-a",
      fouledPlayerId: "carrier-1",
      accumulatedFouls: 1,
      foulSourceEventId: "ppc-10-1",
      foulTick: 10,
    }, 10);
    expect(directRedOutcome([...stream, mk(10, [duplicate])])).toBe("FAIL");
  });

  it("CARD-DIRECT-RED FAILs when the recorded severity disagrees with the shared derivation", () => {
    const stream = directRedStream();
    const card = cardIssuedEvent("card-10-2", {
      cardType: "expulsion",
      cardReason: "direct-severity",
      directRedSeverity: 0.1,
      playerId: "def-1",
      teamId: "team-a",
      fouledPlayerId: "carrier-1",
      accumulatedFouls: 1,
      foulSourceEventId: "ppc-10-1",
      foulTick: 10,
    }, 10);
    expect(directRedOutcome([...stream, mk(10, [card])])).toBe("FAIL");
  });
});

// ---------------------------------------------------------------------------
// 5. Registry integrity: content hash + the registered foul artefacts
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
    expect(registry.invariant_definitions["foul-card-issued-evidence"]).toBeDefined();
    expect(registry.invariant_definitions["foul-card-direct-red-evidence"]).toBeDefined();
    expect(registry.invariant_definitions["foul-advantage-played-evidence"]).toBeDefined();
    expect(registry.observation_definitions["obs-fouls-v1"]).toBeDefined();
  });
});
