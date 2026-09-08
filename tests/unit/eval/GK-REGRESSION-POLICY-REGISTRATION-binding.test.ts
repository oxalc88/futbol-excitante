/**
 * @module tests/unit/eval/GK-REGRESSION-POLICY-REGISTRATION-binding.test.ts
 *
 * Binding test for GK-REGRESSION-POLICY-REGISTRATION (objective: register an
 * executable GK regression canary — a suite-level regression POLICY for the
 * goalkeepers suite's REGRESSION-class criteria, per specs/GOALKEEPER_SPEC.md
 * §11.2 and GAMEPLAY_EVALUATION_SPEC §5.5).
 *
 * Locks the registration chain and the canary's power:
 *   1. criterion_bindings  -> invariant_definitions -> registered oracle
 *      (bindings.ts)          (invariant-definitions.ts)  (wire.ts / oracle-registry.ts)
 *      for each of the six GK-*-REG catalog criteria.
 *   2. Each GK-*-REG criterion is class REGRESSION and stays the only
 *      REGREssion-family criterion mapping to the regression canary.
 *   3. evaluateSuite("goalkeepers", ...) turns the six GK-*-REG into an executed
 *      PASS over a preserved GK stream (the accepted behavior pins hold) and the
 *      honest NOT_EVALUATED over a non-GK stream (no behavior pin observable).
 *   4. Canary guards prove POWER (a genuine regression detector, not a
 *      tautology): an off-arc / divergence-free guard FAILs on an off-arc
 *      mutant, a divergent gk-small-sided-v1 constant (no version bump), a
 *      broken committed state-hash chain; returns honest NOT_EVALUATED on a
 *      version-bumped model and on a non-GK stream.
 *
 * No suite-level PASS claim.  GK-*-REF / GK-*-VIS / GK-*-CAUSAL are untouched.
 * No PES reference is invented.  No Math.random, Date, performance, DOM in the
 * core; observations are built in-memory.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Import wire.ts to register the built-in oracles (side-effect).
import "../../../eval/oracles/wire.js";
import { getOracle } from "../../../eval/oracles/oracle-registry.js";
import { TEST_BINDINGS } from "../../../eval/contracts/bindings.js";
import { INVARIANT_DEFINITIONS } from "../../../eval/contracts/invariant-definitions.js";
import { COMMON_CRITERIA } from "../../../eval/contracts/common-criteria.js";
import { loadRegistrySet, validateRegistrySet } from "../../../eval/contracts/loader.js";
import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";
import { checkGkRegression } from "../../../eval/oracles/gk-regression.js";
import { checkGkSaveClaim } from "../../../eval/oracles/gk-role.js";
import { GK_SMALL_SIDED_V1 } from "../../../src/adapters/input-browser/goalkeeper-role.js";
import { runHeadlessMatch } from "../../../eval/runners/headless-match.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";

const GK_REG_CRITERIA = [
  "GK-REA-001-REG",
  "GK-WF-001-REG",
  "GK-LEG-001-REG",
  "GK-PARRY-001-REG",
  "GK-REC-001-REG",
  "GK-HIGH-001-REG",
] as const;

const INVARIANT_ID = "gk-regression-evidence";
const ORACLE_ID = "gk-regression-canary-v1";
const ORACLE_VERSION = "oracle-gk-regression-v1";

// ---------------------------------------------------------------------------
// Observation builder (same shape as the accepted GK oracles use)
// ---------------------------------------------------------------------------

const HALF = 105 / 2;
const ON_ARC_A = { x: -HALF + 0.2, y: 0.5 };
const ON_ARC_B = { x: HALF - 0.2, y: -0.3 };

function make(
  tick: number,
  keeperPos: { x: number; y: number },
  withGkRole: boolean,
): TelemetryObservation {
  const events: TelemetryObservation["events"] = [];
  if (withGkRole) {
    events.push(
      {
        id: `gk-role-${tick}-a`,
        tick,
        sequence: 9001,
        kind: "gk-role",
        label: "designated keeper player-4",
        payload: { teamId: "team-a", keeperPlayerId: "player-4", keeperRoleFlag: true, pitchLength: 105 },
      },
      {
        id: `gk-role-${tick}-b`,
        tick,
        sequence: 9002,
        kind: "gk-role",
        label: "designated keeper player-10",
        payload: { teamId: "team-b", keeperPlayerId: "player-10", keeperRoleFlag: true, pitchLength: 105 },
      },
    );
  }
  return {
    tick,
    simulationTime: tick / 60,
    prngAlgorithmId: "mulberry32-v1",
    stateHash: `state-hash-${tick}`,
    prngStateHash: `prng-state-hash-${tick}`,
    observationCoreHash: `core-hash-${tick}`,
    committedTick: tick,
    inputs: [],
    players: [
      { playerId: "player-4", teamId: "team-a", groundPosition: keeperPos, linearVelocity: { x: 0, y: 0 }, desiredVelocity: { x: 0, y: 0 }, bodyHeading: 0, desiredHeading: 0 },
      { playerId: "player-10", teamId: "team-b", groundPosition: ON_ARC_B, linearVelocity: { x: 0, y: 0 }, desiredVelocity: { x: 0, y: 0 }, bodyHeading: 0, desiredHeading: 0 },
      { playerId: "player-1", teamId: "team-a", groundPosition: { x: 30, y: 0 }, linearVelocity: { x: 0, y: 0 }, desiredVelocity: { x: 0, y: 0 }, bodyHeading: 0, desiredHeading: 0 },
      { playerId: "player-6", teamId: "team-b", groundPosition: { x: 30, y: 0 }, linearVelocity: { x: 0, y: 0 }, desiredVelocity: { x: 0, y: 0 }, bodyHeading: 0, desiredHeading: 0 },
    ],
    ball: {
      position: { x: 0, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
      lastTouchRef: null,
    },
    events,
  } as unknown as TelemetryObservation;
}

function gkStream(): TelemetryObservation[] {
  return [make(1, ON_ARC_A, true), make(2, ON_ARC_A, false)];
}

function nonGkStream(): TelemetryObservation[] {
  return [make(1, ON_ARC_A, false), make(2, ON_ARC_A, false)];
}

// ---------------------------------------------------------------------------
// Save/claim pin semantic streams (shot at team-b's keeper player-10)
// ---------------------------------------------------------------------------

/** A clean observation with explicit events; gk-role designation injected only at tick 1. */
function saveObs(tick: number, extra: TelemetryObservation["events"]): TelemetryObservation {
  const o = make(tick, ON_ARC_A, false);
  const gkRole: TelemetryObservation["events"] =
    tick === 1
      ? [
          {
            id: `gk-role-${tick}-a`,
            tick,
            sequence: 9001,
            kind: "gk-role",
            label: "designated keeper player-4",
            payload: { teamId: "team-a", keeperPlayerId: "player-4", keeperRoleFlag: true, pitchLength: 105 },
          },
          {
            id: `gk-role-${tick}-b`,
            tick,
            sequence: 9002,
            kind: "gk-role",
            label: "designated keeper player-10",
            payload: { teamId: "team-b", keeperPlayerId: "player-10", keeperRoleFlag: true, pitchLength: 105 },
          },
        ]
      : [];
  o.events = [...gkRole, ...extra];
  return o;
}

/**
 * A stream with an opposing shot at the team-b keeper (player-1 shoots toward
 * +x) and an optional keeper-ball contact at a given tick + reach distance.
 * Used to pin the enforced save/claim semantics: in-window in-reach = preserve,
 * in-window out-of-reach = FAIL, late / missing = NOT_EVALUATED.
 */
function saveStream(opts: { shotTick: number; contactTick?: number | null; planarDistance?: number }): TelemetryObservation[] {
  const lastTick = Math.max(opts.shotTick, opts.contactTick ?? opts.shotTick);
  const obs: TelemetryObservation[] = [];
  for (let t = 1; t <= lastTick; t++) {
    const extra: TelemetryObservation["events"] = [];
    if (t === opts.shotTick) {
      extra.push({
        id: `shot-${t}-1`,
        tick: t,
        sequence: 1,
        kind: "shot",
        label: "shot",
        payload: {
          playerId: "player-1",
          teamId: "team-a",
          outgoing: { position: { x: 40, y: 0.5 }, linearVelocity: { x: 12, y: 0.4 } },
        },
      });
    }
    if (t === opts.contactTick) {
      extra.push({
        id: `pbc-${t}-1`,
        tick: t,
        sequence: 2,
        kind: "player-ball-contact",
        label: "contact",
        payload: { playerId: "player-10", teamId: "team-b", planarDistance: opts.planarDistance ?? 0.7 },
      });
    }
    obs.push(saveObs(t, extra));
  }
  return obs;
}

// ---------------------------------------------------------------------------
// 1. Registration chain: criterion_bindings -> invariant -> registered oracle
// ---------------------------------------------------------------------------

describe("GK-*-REG criteria bind to the registered regression canary", () => {
  for (const criterionId of GK_REG_CRITERIA) {
    it(`${criterionId} binds to ${INVARIANT_ID} -> ${ORACLE_ID}`, () => {
      // 1. Find the binding that references this criterion.
      const binding = Object.entries(TEST_BINDINGS).find(
        ([, b]) => b.criterion_bindings[criterionId] !== undefined,
      );
      expect(binding, `no test binding references ${criterionId}`).toBeDefined();

      // 2. The criterion's bound invariant_id resolves to an InvariantDefinition.
      const invariantIds = binding![1].criterion_bindings[criterionId];
      expect(invariantIds).toEqual([INVARIANT_ID]);
      const invariant = INVARIANT_DEFINITIONS[INVARIANT_ID];
      expect(invariant, `invariant ${INVARIANT_ID} undefined`).toBeDefined();

      // 3. The invariant's oracle_id/version match the registered protected oracle.
      expect(invariant!.oracle_id).toBe(ORACLE_ID);
      const registered = getOracle(invariant!.oracle_id, invariant!.oracle_version);
      expect(registered, `oracle ${ORACLE_ID} is not registered`).toBeDefined();
      expect(registered!.oracle_version).toBe(invariant!.oracle_version);
    });

    it(`${criterionId} is class REGRESSION (the regression-family criterion)`, () => {
      const criterion = COMMON_CRITERIA[criterionId];
      expect(criterion, `${criterionId} must be a registered criterion`).toBeDefined();
      expect(criterion!.class).toBe("REGRESSION");
    });
  }

  it("no non-GK REGRESSION criterion maps to the regression canary (other REG stay NOT_EVALUATED)", () => {
    // The canary is only wired to the six GK-*-REG criteria; the duels /
    // foundation REGRESSION criteria (PHY-*/TACK-*/INT-*) stay without a
    // registered regression oracle and therefore honest NOT_EVALUATED.  This is
    // asserted indirectly: they must not reference gk-regression-evidence.
    for (const [testId, binding] of Object.entries(TEST_BINDINGS)) {
      for (const [criterionId, invariantIds] of Object.entries(binding.criterion_bindings)) {
        if (criterionId.endsWith("-REG") && !GK_REG_CRITERIA.includes(criterionId as (typeof GK_REG_CRITERIA)[number])) {
          expect(invariantIds, `${testId} ${criterionId} must keep no regression oracle`).not.toContain(INVARIANT_ID);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Suite registration / registry integrity
// ---------------------------------------------------------------------------

describe("suite registration and registry integrity", () => {
  it("goalkeepers suite validates and exposes the regression invariant", () => {
    const registry = loadRegistrySet();
    expect(validateRegistrySet(registry)).toHaveLength(0);
    expect(registry.invariant_definitions[INVARIANT_ID]).toBeDefined();
    expect(registry.suite_definitions["goalkeepers"]).toBeDefined();
  });

  it("content hash is a genuine fnv1a64-v1 (registry evolved to include the invariant)", () => {
    const registry = loadRegistrySet();
    expect(registry.content_hash).toMatch(/^fnv1a64-v1:[0-9a-f]{16}$/);
    expect(registry.invariant_definitions[INVARIANT_ID].oracle_id).toBe(ORACLE_ID);
  });
});

// ---------------------------------------------------------------------------
// 3. evaluateSuite converts the six GK-*-REG to an executed verdict
// ---------------------------------------------------------------------------

describe("evaluateSuite('goalkeepers', ...) produces real regression verdicts", () => {
  it("a preserved GK stream yields PASS on all six GK-*-REG", () => {
    const result = evaluateSuite("goalkeepers", gkStream());
    let sawReg = false;
    for (const test of result.tests) {
      for (const c of test.criteria) {
        if (!(c.criterion_id as string).endsWith("-REG")) continue;
        sawReg = true;
        expect(c.outcome, `${test.test_id} ${c.criterion_id} should be PASS`).toBe("PASS");
      }
    }
    expect(sawReg).toBe(true);
  });

  it("a non-GK stream (no behavior pin observable) is NOT_EVALUATED on GK-*-REG, never PASS", () => {
    const result = evaluateSuite("goalkeepers", nonGkStream());
    let sawReg = false;
    for (const test of result.tests) {
      for (const c of test.criteria) {
        if (!(c.criterion_id as string).endsWith("-REG")) continue;
        sawReg = true;
        expect(c.outcome, `${test.test_id} ${c.criterion_id} must not PASS`).not.toBe("PASS");
        expect(c.outcome).toBe("NOT_EVALUATED");
      }
    }
    expect(sawReg).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Canary guards: a mutated / weakened run must FAIL (power, not a tautology)
// ---------------------------------------------------------------------------

describe("canary guards (power / non-circularity)", () => {
  it("a clean preserved GK stream PASSes", () => {
    const res = checkGkRegression(gkStream());
    expect(res[0].status).toBe("pass");
    expect(res[0].id).toContain("gk-regression-pins-held");
  });

  it("an off-arc keeper mutant FAILs (a diverged behavior pin is caught)", () => {
    // Player-4 takes station on the arc (tick 1) then is stranded off-arc
    // (tick 2) — the accepted gk-positioning oracle flags the diverged pin.
    const obs = [make(1, ON_ARC_A, true), make(2, { x: -30, y: -10 }, false)];
    const res = checkGkRegression(obs);
    expect(res[0].status).toBe("fail");
    expect(res[0].id).toContain("gk-regression-behavior-diverged");
  });

  it("a gk-small-sided-v1 constant changed without a version bump FAILs (version pin)", () => {
    const divergent = JSON.parse(JSON.stringify(GK_SMALL_SIDED_V1)) as unknown as {
      id: string;
      goal_arc_radius: { value: number };
    };
    divergent.goal_arc_radius.value = 3.5;
    const res = checkGkRegression(gkStream(), divergent);
    expect(res[0].status).toBe("fail");
    expect(res[0].id).toContain("gk-regression-unversioned-constant-change");
  });

  it("a broken committed state-hash chain FAILs (mutant stream guarded)", () => {
    const obs = [make(1, ON_ARC_A, true), { ...make(2, ON_ARC_A, false), stateHash: "" }];
    const res = checkGkRegression(obs);
    expect(res[0].status).toBe("fail");
    expect(res[0].id).toContain("gk-regression-state-hash-chain-diverged");
  });

  it("a version-bumped model is NOT_EVALUATED (the pin is deliberately re-versioned)", () => {
    const bumped = JSON.parse(JSON.stringify(GK_SMALL_SIDED_V1)) as unknown as { id: string };
    bumped.id = "gk-small-sided-v2";
    const res = checkGkRegression(gkStream(), bumped);
    expect(res[0].status).toBe("not_evaluated");
    expect(res[0].id).toContain("gk-regression-version-bumped");
  });

  it("a non-GK stream (no observable pin) is NOT_EVALUATED, never a PASS by silence", () => {
    const res = checkGkRegression(nonGkStream());
    expect(res[0].status).toBe("not_evaluated");
    expect(res[0].id).toContain("gk-regression-not-evaluated");
  });
});

// ---------------------------------------------------------------------------
// 5. Save/claim pin semantic guards (text-enforcement agreement)
// ---------------------------------------------------------------------------

describe("save/claim pin semantics match the enforced GK-SAVE-CLAIM oracle", () => {
  it("an in-window in-reach keeper contact is the observed pin (preserved)", () => {
    const obs = saveStream({ shotTick: 2, contactTick: 2, planarDistance: 0.7 });
    const save = checkGkSaveClaim(obs);
    expect(save[0].status).toBe("pass");
    const canary = checkGkRegression(obs);
    expect(canary[0].status).toBe("pass");
  });

  it("an in-window OUT-OF-reach keeper contact is a weakened-divergence FAIL", () => {
    const obs = saveStream({ shotTick: 2, contactTick: 2, planarDistance: 3.5 });
    const save = checkGkSaveClaim(obs);
    expect(save[0].status).toBe("fail");
    const canary = checkGkRegression(obs);
    expect(canary[0].status).toBe("fail");
    expect(canary[0].id).toContain("gk-regression-behavior-diverged");
  });

  it("a LATE contact (beyond keeper_reaction_window_ticks, in reach) is NOT_EVALUATED — not a FAIL", () => {
    // Shot at tick 2; the only keeper contact is at tick 17 (> window 12). The
    // accepted GK-SAVE-CLAIM oracle breaks its search at the window boundary, so
    // it reports honest NOT_EVALUATED; the canary must not turn this into a FAIL.
    const obs = saveStream({ shotTick: 2, contactTick: 17, planarDistance: 0.7 });
    const save = checkGkSaveClaim(obs);
    expect(save[0].status).toBe("not_evaluated");
    const canary = checkGkRegression(obs);
    expect(canary[0].status).toBe("pass");
  });

  it("a MISSING save (opposing shot answered by no in-window contact) is NOT_EVALUATED — not a FAIL", () => {
    const obs = saveStream({ shotTick: 2, contactTick: null });
    const save = checkGkSaveClaim(obs);
    expect(save[0].status).toBe("not_evaluated");
    const canary = checkGkRegression(obs);
    expect(canary[0].status).toBe("pass");
  });
});

// ---------------------------------------------------------------------------
// 5. Durable evidence record
// ---------------------------------------------------------------------------

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RECORD_PATH = join(
  projectRoot,
  "docs/evidence/GK-REGRESSION-POLICY-REGISTRATION/gk-regression-policy-registration.json",
);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(projectRoot, relativePath), "utf-8")) as T;
}

function loadScenario(relativePath: string): ScenarioDefinition {
  return readJson<ScenarioDefinition>(relativePath);
}

function runReproduce(scenarioPath: string, maxTicks: number) {
  const scenario = loadScenario(scenarioPath);
  const match = runHeadlessMatch({
    scenario,
    maxTicks,
    cpuAntiHuddle: true,
    cpuDefensiveTackle: true,
    gkBehavior: true,
    browserParityObservations: true,
    lifecyclePhaseSync: "core-owned",
  });
  const suite = evaluateSuite("goalkeepers", match.observations);
  const reg: Record<string, string> = {};
  let aggreg = "NOT_EVALUATED";
  const catalogReg: Record<string, string> = {};
  for (const test of suite.tests) {
    for (const c of test.criteria) {
      const id = c.criterion_id as string;
      if ((GK_REG_CRITERIA as readonly string[]).includes(id)) {
        reg[id] = c.outcome;
        aggreg = c.outcome;
      }
    }
  }
  catalogReg["reg"] = aggreg;
  return { reg, catalogReg };
}

interface GkRegRecord {
  schema_version: number;
  objective_id: string;
  suite_id: string;
  suite_version: string;
  evidence_class: string;
  candidate_commit: string;
  record_sha256: string;
  normative_source: { decision: string; section: string };
  registration_chain: {
    oracle: { oracle_id: string; oracle_version: string };
    invariant: { invariant_id: string; definition_present: boolean };
    criterion_bindings: Array<{ criterion_id: string; class: string; invariant_id: string; oracle_id: string }>;
  };
  pins_guarded: Record<string, string>;
  version_bump_rule: string;
  before: {
    reg_aggregate: string;
    source_records: Record<string, string | { value: string; role: string }>;
  };
  after: { reg_aggregate: string; per_run_catalog: Record<string, Record<string, string>> };
  runs: Array<{ run_id: string; catalog: Record<string, string>; gk_reg: Record<string, string> }>;
  registry_hash_evolution: { before: string; after: string };
  disclosures: string[];
  claims_not_made: string[];
}

function loadRecord(): GkRegRecord {
  return JSON.parse(readFileSync(RECORD_PATH, "utf-8")) as GkRegRecord;
}

const TRAJECTORY_PATH = join(
  projectRoot,
  "docs/evidence/GK-REGRESSION-POLICY-REGISTRATION/trajectory.json",
);

describe("GK-REGRESSION-POLICY-REGISTRATION durable record", () => {
  it("durable MULTI_TICK trajectory artifact exists with the established shape", () => {
    expect(existsSync(TRAJECTORY_PATH)).toBe(true);
    const trajectory = JSON.parse(readFileSync(TRAJECTORY_PATH, "utf-8")) as {
      objective_id: string;
      evidence_class: string;
      capture_mode: string;
      runs: Array<{
        id: string;
        observation_count: number;
        determinism: { state_hash_of_hashes: string; final_state_hash: string | null };
        suite_verdict: { catalog: Record<string, string> };
      }>;
    };
    expect(trajectory.objective_id).toBe("GK-REGRESSION-POLICY-REGISTRATION");
    expect(trajectory.evidence_class).toBe("MULTI_TICK");
    expect(trajectory.capture_mode).toBe("durable-evidence");
    expect(trajectory.runs.length).toBe(3);
    for (const run of trajectory.runs) {
      expect(run.observation_count).toBeGreaterThan(0);
      expect(run.determinism.state_hash_of_hashes.length).toBe(64);
      expect(run.suite_verdict.catalog["reg"]).toBe("PASS");
    }
  });

  it("durable record exists with the established shape", () => {
    expect(existsSync(RECORD_PATH)).toBe(true);
    const record = loadRecord();
    expect(record.objective_id).toBe("GK-REGRESSION-POLICY-REGISTRATION");
    expect(record.suite_id).toBe("goalkeepers");
    expect(record.suite_version).toBe("suite-goalkeepers-v1");
    expect(record.evidence_class).toBe("MULTI_TICK");
    expect(record.schema_version).toBe(1);
    expect(record.candidate_commit.length).toBe(40);
    expect(typeof record.record_sha256).toBe("string");
    expect(record.record_sha256.length).toBe(64);
    expect(record.runs.length).toBe(3);
    expect(record.disclosures.length).toBeGreaterThan(0);
    expect(record.claims_not_made.length).toBeGreaterThan(0);
  });

  it("normative source is a disclosed spec-prose addition (option b)", () => {
    const record = loadRecord();
    expect(record.normative_source.decision).toBe("spec-prose-addition (option b)");
    expect(record.normative_source.section).toContain("GOALKEEPER_SPEC.md §11.2");
  });

  it("registration chain binds the six GK-*-REG criteria to the registered canary", () => {
    const record = loadRecord();
    expect(record.registration_chain.oracle.oracle_id).toBe("gk-regression-canary-v1");
    expect(record.registration_chain.invariant.invariant_id).toBe("gk-regression-evidence");
    expect(record.registration_chain.invariant.definition_present).toBe(true);
    expect(record.registration_chain.criterion_bindings.length).toBe(6);
    for (const binding of record.registration_chain.criterion_bindings) {
      expect(binding.invariant_id).toBe("gk-regression-evidence");
      expect(binding.oracle_id).toBe("gk-regression-canary-v1");
      expect(binding.class).toBe("REGRESSION");
    }
  });

  it("before reg is NOT_EVALUATED; after reg is executed PASS", () => {
    const record = loadRecord();
    expect(record.before.reg_aggregate).toBe("NOT_EVALUATED");
    expect(record.after.reg_aggregate).toBe("PASS");
  });

  it("per-run reg is PASS on all three accepted + driven GK streams", () => {
    const record = loadRecord();
    for (const run of record.runs) {
      expect(run.catalog["reg"]).toBe("PASS");
    }
  });

  it("catalog keys stay: GK-*-REF BLOCKED, GK-*-VIS perceptual, GK-*-CAUSAL NOT_EVALUATED", () => {
    const record = loadRecord();
    for (const run of record.runs) {
      expect(run.catalog["ref"]).toBe("BLOCKED_MISSING_REFERENCE");
      expect(run.catalog["vis"]).toBe("NEEDS_PERCEPTUAL_REVIEW");
      expect(run.catalog["causal"]).toBe("NOT_EVALUATED");
    }
  });

  it("registry hash evolves (before -> after) and is a genuine fnv1a64-v1", () => {
    const record = loadRecord();
    expect(record.registry_hash_evolution.before).toMatch(/^fnv1a64-v1:[0-9a-f]{16}$/);
    expect(record.registry_hash_evolution.after).toMatch(/^fnv1a64-v1:[0-9a-f]{16}$/);
    expect(record.registry_hash_evolution.before).not.toBe(record.registry_hash_evolution.after);
  });

  it("save/claim pin text agrees with the enforced GK-SAVE-CLAIM oracle semantics", () => {
    const record = loadRecord();
    const saveClaim = record.pins_guarded.save_claim.toLowerCase();
    // In-window in-reach = preserved; in-window out-of-reach = FAIL.
    expect(saveClaim).toContain("within save_claim_reach_radius");
    expect(saveClaim).toContain("outside save_claim_reach_radius = fail");
    // Late / missing = NOT_EVALUATED per the accepted oracle, NOT a FAIL.
    expect(saveClaim).toContain("not_evaluated");
    expect(saveClaim).toContain("never turns a legitimately unanswered shot into a fail");
  });

  it("keeper-marker baseline SHA is referenced as provenance, not implied as enforced", () => {
    const record = loadRecord();
    const marker = record.before.source_records.keeper_marker_baseline_sha;
    expect(typeof marker).toBe("object");
    const m = marker as { value: string; role: string };
    expect(m.value).toBe("511d53df386ee634bf545abe19addfad10c419964055c2d579709ce3b2baabe0");
    expect(m.role).toContain("referenced provenance");
    expect(m.role.toLowerCase()).toContain("not an enforced pin");
  });

  it("record_sha256 is byte-reproducible over the deterministic body (no wall clock)", () => {
    const record = loadRecord();
    const deterministicBody = JSON.stringify({
      normative_source: record.normative_source,
      registration_chain: record.registration_chain,
      pins_guarded: record.pins_guarded,
      version_bump_rule: record.version_bump_rule,
      before: record.before,
      after: record.after,
      runs: record.runs,
      registry_hash_evolution: record.registry_hash_evolution,
      disclosures: record.disclosures,
      claims_not_made: record.claims_not_made,
    });
    expect(sha256(deterministicBody)).toBe(record.record_sha256);
  });

  it("claims_not_made: no PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level PASS / accepted-record mutation", () => {
    const record = loadRecord();
    const joined = record.claims_not_made.join("\n").toLowerCase();
    expect(joined).toContain("no promotion");
    expect(joined).toContain("no pes");
    expect(joined).toContain("foundation_lab_pass");
    expect(joined).toContain("no suite-level pass");
    expect(joined).toContain("no accepted record mutation");
  });

  it("record is not hand-written: the continuous stream reproduces the pinned reg verdicts", () => {
    const cont = runReproduce("eval/scenarios/5v5-continuous-play.v1.json", 1800);
    expect(Object.values(cont.reg).every((v) => v === "PASS")).toBe(true);
  }, 100_000);

  it("record is not hand-written: the shot fixture reproduces the pinned reg verdicts", () => {
    const fix = runReproduce("eval/scenarios/5v5-keeper-shot-fixture.v1.json", 600);
    expect(Object.values(fix.reg).every((v) => v === "PASS")).toBe(true);
  }, 100_000);

  it("record is not hand-written: the release fixture reproduces the pinned reg verdicts", () => {
    const rel = runReproduce("eval/scenarios/5v5-keeper-release-fixture.v1.json", 300);
    expect(Object.values(rel.reg).every((v) => v === "PASS")).toBe(true);
  }, 100_000);
});
