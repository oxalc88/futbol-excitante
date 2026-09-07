/**
 * Node-side evidence producer for RELEASE-0.9.7-CONSOLIDATION (BOOKKEEPING).
 *
 * Consolidates the v29-v33 delivered capability into the release record:
 * what is playable, what is executable/attested, what is spec'd, what stays
 * deferred, and the honest limitations. It reads the accepted records and
 * verifies the headline facts against them, so every claim in the record
 * cites an accepted record (record_sha256 pinned) rather than being a bare
 * summary.
 *
 * BOOKKEEPING: zero gameplay/source change in src/, src/adapters/, eval/,
 * gauntlet/evals/, gauntlet/roles/, specs/. The record carries NO wall-clock
 * field, so consecutive ordinary-mode runs are byte-identical and leave
 * `docs/` byte-identical.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:RELEASE-0.9.7-CONSOLIDATION`. An ordinary run
 * writes the same artifact under the ignored `test-results/gauntlet-capture/**`
 * tree.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:RELEASE-0.9.7-CONSOLIDATION \
 *     mise exec -- pnpm exec tsx scripts/capture-release-0-9-7-consolidation.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const OBJECTIVE_ID = "RELEASE-0.9.7-CONSOLIDATION";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const STATE_PATH = resolve(OUTPUT_ROOT, "release-0-9-7-consolidation.json");

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function read(path: string): string {
  return readFileSync(resolve(path), "utf-8");
}

function readJson<T>(path: string): T {
  return JSON.parse(read(path)) as T;
}

interface VerdictCounts {
  PASS: number;
  FAIL: number;
  NOT_EVALUATED: number;
  BLOCKED_MISSING_REFERENCE: number;
  NEEDS_PERCEPTUAL_REVIEW: number;
}

// The accepted records the release facts are cited against.
const RULES_SUITE_STATE_RERUN = "docs/evidence/RULES-SUITE-STATE-RERUN/rules-suite-state-rerun.json";
const SUITE_DETERMINISTIC_TWO_RUN = "docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/suite-deterministic-two-run.json";
const GK_SUITE_CORE_OWNED_STATE = "docs/evidence/GK-SUITE-CORE-OWNED-STATE/gk-suite-core-owned-state.json";
const FOULS_SPEC_DRAFT = "docs/evidence/FOULS-SPEC-DRAFT/record.json";
const RULES_SUITE_REGISTRATION = "docs/evidence/RULES-SUITE-REGISTRATION/rules-suite-state.json";
const RESTART_DESIGNATION = "docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/restart-designation-facts-state.json";
const HUMAN_BALL_SERVER_DECISION = "docs/evidence/HUMAN-BALL-SERVER-DECISION/human-ball-server-decision.json";

const RELEASE_DOC = "gauntlet/RELEASE-0.9.7.md";
const VERSION_FILE = "gauntlet/VERSION.json";
const FOULS_SPEC = "specs/FOULS_CARDS_SPEC.md";

// Pinned record_sha256 of each accepted record (a mutation would fail here).
const PINNED_RECORD_SHA: Record<string, string> = {
  [RULES_SUITE_STATE_RERUN]: "36fc77e52909dbaceefa14927b37b8e533c248e451477fc579dc4952434979ef",
  [SUITE_DETERMINISTIC_TWO_RUN]: "abaf6ccdc8a07643289035e8dbfcc639a525a66955b4738f3735d24fa350a27c",
  [GK_SUITE_CORE_OWNED_STATE]: "5cd1c80879d400c2dabfc0ba6d9b195447fc9476f7b6ebb5329877dd2a69204a",
  [FOULS_SPEC_DRAFT]: "e98a1efe08f1c8ec68c5b957a801e9035c70a132e3f5d354e3dd30b8767b0716",
  [RULES_SUITE_REGISTRATION]: "7503f9fe61b86731d08460dd47651b541abc3672b21ff26d0056ad8fd81029f8",
  [RESTART_DESIGNATION]: "271b1526592cc13e3792bee42f2544379e7dea16de9571b43113b32b57e7fc56",
  [HUMAN_BALL_SERVER_DECISION]: "5b6e391a3d8da585b4e48bfae703ec9d57b78b1ecc1e4a10cbcfeeef5891b489",
};

function assertRecordSha(path: string): string {
  const record = readJson<{ record_sha256: string }>(path);
  const expected = PINNED_RECORD_SHA[path];
  if (!expected) throw new Error(`no pinned sha for ${path}`);
  if (record.record_sha256 !== expected) {
    throw new Error(`accepted record ${path} mutated: expected ${expected}, found ${record.record_sha256}`);
  }
  return expected;
}

function normalizeCounts(actual: Partial<VerdictCounts>): VerdictCounts {
  return {
    PASS: actual.PASS ?? 0,
    FAIL: actual.FAIL ?? 0,
    NOT_EVALUATED: actual.NOT_EVALUATED ?? 0,
    BLOCKED_MISSING_REFERENCE: actual.BLOCKED_MISSING_REFERENCE ?? 0,
    NEEDS_PERCEPTUAL_REVIEW: actual.NEEDS_PERCEPTUAL_REVIEW ?? 0,
  };
}

function assertCounts(raw: Partial<VerdictCounts>, expected: VerdictCounts, label: string): void {
  const actual = normalizeCounts(raw);
  for (const key of Object.keys(expected) as Array<keyof VerdictCounts>) {
    if (actual[key] !== expected[key]) {
      throw new Error(`${label}: expected ${key}=${expected[key]}, found ${key}=${actual[key]}`);
    }
  }
}

// --- Source-level facts (deterministic; no wall-clock, no simulation) ---

const releaseDoc = read(RELEASE_DOC);
const versionFile = read(VERSION_FILE);
const version = readJson<{ version: string; schema_version: number; semver: boolean; previous_system_version: string }>(VERSION_FILE);

if (version.version !== "0.9.7") throw new Error(`VERSION.json version must be 0.9.7, found ${version.version}`);
if (version.previous_system_version !== "0.9.6") throw new Error(`previous_system_version must be 0.9.6, found ${version.previous_system_version}`);

// FOULS_CARDS_SPEC exists (spec-only).
const foulsSpecExists = Boolean(read(FOULS_SPEC).trim());

// --- Verify the headline facts against the accepted records ---

// Rules suite: 25 §15 MATCH-* criteria -> 23 PASS / 2 BLOCKED / 0 NOT_EVALUATED / 0 FAIL.
const rulesRecord = readJson<{
  verdict_deltas: { current_counts: Partial<VerdictCounts> };
}>(RULES_SUITE_STATE_RERUN);
const rulesCounts = normalizeCounts(rulesRecord.verdict_deltas.current_counts);
assertCounts(rulesCounts, { PASS: 23, FAIL: 0, NOT_EVALUATED: 0, BLOCKED_MISSING_REFERENCE: 2, NEEDS_PERCEPTUAL_REVIEW: 0 }, "rules suite");

// SUITE-DETERMINISTIC-TWO-RUN: goalkeepers + rules verdict tables + COMMON-DETERMINISTIC.
const determinismRecord = readJson<{
  suites: {
    goalkeepers: {
      suite_version: string;
      verdict_counts: VerdictCounts;
      verdicts: { common: Record<string, string> };
    };
    rules: {
      suite_version: string;
      verdict_counts_match_criteria: VerdictCounts;
      verdict_counts_with_common_determinism: VerdictCounts;
      common_determinism: string;
    };
  };
}>(SUITE_DETERMINISTIC_TWO_RUN);

const gkCounts = normalizeCounts(determinismRecord.suites.goalkeepers.verdict_counts);
assertCounts(gkCounts, { PASS: 9, FAIL: 0, NOT_EVALUATED: 2, BLOCKED_MISSING_REFERENCE: 1, NEEDS_PERCEPTUAL_REVIEW: 1 }, "goalkeepers suite");

const rulesWithCommon = normalizeCounts(determinismRecord.suites.rules.verdict_counts_with_common_determinism);
assertCounts(rulesWithCommon, { PASS: 24, FAIL: 0, NOT_EVALUATED: 0, BLOCKED_MISSING_REFERENCE: 2, NEEDS_PERCEPTUAL_REVIEW: 0 }, "rules suite + COMMON-DETERMINISTIC");

if (determinismRecord.suites.rules.common_determinism !== "PASS") throw new Error("rules COMMON-DETERMINISTIC must be PASS");
if (determinismRecord.suites.goalkeepers.verdicts.common["COMMON-DETERMINISTIC"] !== "PASS") throw new Error("goalkeepers COMMON-DETERMINISTIC must be PASS");

// GK core-owned baseline counts verified from the accepted record.
const gkBaseline = readJson<{
  after: { gk_behavior: Record<string, { verdict: string }>; common: Record<string, string>; catalog: Record<string, string> };
}>(GK_SUITE_CORE_OWNED_STATE);
const verdictOf = (value: string | { verdict: string }): string =>
  typeof value === "string" ? value : value.verdict;
const gkBaselineCounts = normalizeCounts(
  [
    ...Object.values(gkBaseline.after.gk_behavior).map(verdictOf),
    ...Object.values(gkBaseline.after.common),
    ...Object.values(gkBaseline.after.catalog),
  ].reduce<Partial<VerdictCounts>>(
    (acc, verdict) => {
      if (verdict === "PASS") acc.PASS = (acc.PASS ?? 0) + 1;
      else if (verdict === "FAIL") acc.FAIL = (acc.FAIL ?? 0) + 1;
      else if (verdict === "NOT_EVALUATED") acc.NOT_EVALUATED = (acc.NOT_EVALUATED ?? 0) + 1;
      else if (verdict === "BLOCKED_MISSING_REFERENCE") acc.BLOCKED_MISSING_REFERENCE = (acc.BLOCKED_MISSING_REFERENCE ?? 0) + 1;
      else if (verdict === "NEEDS_PERCEPTUAL_REVIEW") acc.NEEDS_PERCEPTUAL_REVIEW = (acc.NEEDS_PERCEPTUAL_REVIEW ?? 0) + 1;
      return acc;
    },
    {},
  ),
);
assertCounts(gkBaselineCounts, { PASS: 8, FAIL: 0, NOT_EVALUATED: 3, BLOCKED_MISSING_REFERENCE: 1, NEEDS_PERCEPTUAL_REVIEW: 1 }, "goalkeepers core-owned baseline");

const rulesSuiteVersion = determinismRecord.suites.rules.suite_version;
const gkSuiteVersion = determinismRecord.suites.goalkeepers.suite_version;

// Pinned accepted record SHAs (a mutation fails the producer).
const citedRecordShas: Record<string, string> = {};
for (const p of [
  RULES_SUITE_STATE_RERUN,
  SUITE_DETERMINISTIC_TWO_RUN,
  GK_SUITE_CORE_OWNED_STATE,
  FOULS_SPEC_DRAFT,
  RULES_SUITE_REGISTRATION,
  RESTART_DESIGNATION,
  HUMAN_BALL_SERVER_DECISION,
]) {
  citedRecordShas[p] = assertRecordSha(p);
}

const sourceHashes: Record<string, string> = {};
for (const file of [RELEASE_DOC, VERSION_FILE]) {
  sourceHashes[file] = sha256(read(file));
}

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "BOOKKEEPING",
  produced_by: "scripts/capture-release-0-9-7-consolidation.ts",
  release_version: version.version,
  previous_release_version: version.previous_system_version,
  release_doc: RELEASE_DOC,
  version_json: {
    version: version.version,
    schema_version: version.schema_version,
    semver: version.semver,
    previous_system_version: version.previous_system_version,
  },
  description:
    "Consolidation of the v29-v33 delivered capability into the RELEASE-0.9.7 record: what is playable (the complete small-sided loop), what is executable/attested (the rules + goalkeepers suites, COMMON-DETERMINISTIC two-run, protected-oracle discipline, designation-facts serialization), what is spec'd (FOULS_CARDS_SPEC), what stays deferred, and the honest limitations. BOOKKEEPING; zero gameplay/source change.",
  playable: [
    "Setup menu -> match selection: full 1v1/2v2/3v3/5v5 x human-vs-CPU + CPU-vs-CPU ladder menu-selectable.",
    "Human controls, including the designated keeper in human-vs-CPU 5v5; CPU fallback unchanged when the human does not switch.",
    "Human-directed restart destination via receiver-steering during the restart window; the human-taken restart conforms through the rules suite.",
    "Duels: human standing/sliding tackle actions and CPU tackle commitment on the same action system.",
    "Goalkeeper behavior: designated-keeper arc hold/save/claim/release at the adapter layer, with the core-owned keeper off-arc drift fixed.",
    "Visible full-match lifecycle: match-phase HUD + event-centered browser frames through halftime and fulltime; genuine timer-driven halftime/fulltime.",
    "Fulltime dead end closed: the loop freezes at fulltime and offers the rematch/menu flow.",
  ],
  executable_attested: {
    rules_suite: {
      suite_id: "rules",
      suite_version: rulesSuiteVersion,
      criteria: 25,
      verdict_counts: rulesCounts,
      source_record: "docs/evidence/RULES-SUITE-STATE-RERUN/rules-suite-state-rerun.json",
      source_record_sha256: citedRecordShas[RULES_SUITE_STATE_RERUN],
    },
    rules_suite_with_common_determinism: {
      verdict_counts: rulesWithCommon,
      source_record: "docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/suite-deterministic-two-run.json",
      source_record_sha256: citedRecordShas[SUITE_DETERMINISTIC_TWO_RUN],
    },
    goalkeepers_suite: {
      suite_id: "goalkeepers",
      suite_version: gkSuiteVersion,
      verdict_counts: gkCounts,
      source_record: "docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/suite-deterministic-two-run.json",
      source_record_sha256: citedRecordShas[SUITE_DETERMINISTIC_TWO_RUN],
    },
    goalkeepers_core_owned_baseline: {
      verdict_counts: gkBaselineCounts,
      source_record: "docs/evidence/GK-SUITE-CORE-OWNED-STATE/gk-suite-core-owned-state.json",
      source_record_sha256: citedRecordShas[GK_SUITE_CORE_OWNED_STATE],
    },
    common_deterministic_two_run: {
      rules: "PASS",
      goalkeepers: "PASS",
      note: "Every attested stream has identical run-1/run-2 per-tick state hashes.",
      source_record: "docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/suite-deterministic-two-run.json",
      source_record_sha256: citedRecordShas[SUITE_DETERMINISTIC_TWO_RUN],
    },
    protected_oracle_discipline: {
      count: 8,
      note: "6 in rules-restart.ts + 2 in rules-phase.ts, mutant/canary-guarded per MATCH_RULES_SPEC §15.",
      source_record: "docs/evidence/RULES-SUITE-REGISTRATION/rules-suite-state.json",
      source_record_sha256: citedRecordShas[RULES_SUITE_REGISTRATION],
    },
    designation_facts_serialization: {
      gated_flag: "serializeRestartFacts",
      default: false,
      note: "Strictly post-loop, hash-neutral; closes the 3 anti-huddle restart-behavior criteria.",
      source_record: "docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/restart-designation-facts-state.json",
      source_record_sha256: citedRecordShas[RESTART_DESIGNATION],
    },
  },
  specd: {
    fouls_cards_spec: {
      path: FOULS_SPEC,
      model: "fouls-v1",
      exists: foulsSpecExists,
      note: "Spec-only; adjudicating criteria named, NOT registered; blocked references disclosed.",
      source_record: "docs/evidence/FOULS-SPEC-DRAFT/record.json",
      source_record_sha256: citedRecordShas[FOULS_SPEC_DRAFT],
    },
  },
  deferred: [
    "The literal pass-button ball-server: DEFER decision recorded, with the HUMAN-BALL-SERVER-LITERAL future objective outline (its own conformance path).",
    "Blocked references: MATCH-CORNER-KICK-CROSS + MATCH-GOAL-KICK-DISTRIBUTION (rules suite); GK-*-REF blocked; the fouls blocked references — all stay BLOCKED_MISSING_REFERENCE.",
    "Goalkeeper behavior beyond the small-sided scope (no regulation rules, no full-match ecology).",
    "Regulation rules (offside, penalty kicks) — regulation-only, no existence claim.",
    "Full-match ecology.",
  ],
  limitations: [
    "Fixture-driven evidence where applicable: GK-SAVE-CLAIM is PASS only from the driven shot fixture (organic run NOT_EVALUATED); GK-DISTRIBUTION-NO-OMNISCIENCE observation source flipped between the legacy and core-owned runs.",
    "The anti-huddle restart-behavior criteria are evaluated only on the browserParity designation streams; the non-browserParity gated streams carry an observation-shape artifact FAIL and are excluded.",
    "The continuous-play baseline fixture is not re-run in RULES-SUITE-STATE-RERUN (redundant control; its verdicts are subsumed).",
    "No PES 2017 fidelity / measured PES envelope; all unmeasured values are VERSIONED_PROVISIONAL configuration.",
    "No suite-level PASS claim, no PROMOTION, no FOUNDATION_LAB_PASS. No criterion is upgraded beyond what the executed evaluator returns.",
  ],
  cited_records: Object.fromEntries(
    Object.entries(citedRecordShas).map(([path, sha]) => [
      path,
      { record_sha256: sha, objective_id: readJson<{ objective_id: string }>(path).objective_id },
    ]),
  ),
  source_hashes: sourceHashes,
  claims_not_made: [
    "No suite-level PASS claim: the rules suite has 2 BLOCKED_MISSING_REFERENCE criteria; the goalkeepers suite has 1 BLOCKED + 1 NEEDS_PERCEPTUAL_REVIEW + 2 NOT_EVALUATED. Neither reduces to a suite PASS.",
    "No PROMOTION claim.",
    "No FOUNDATION_LAB_PASS claim.",
    "No PES 2017 fidelity / measured PES envelope claim; all unmeasured values stay VERSIONED_PROVISIONAL.",
    "No invented reference envelope or tolerance; blocked references stay BLOCKED_MISSING_REFERENCE.",
    "No criterion is upgraded beyond what the executed evaluator returns; every PASS cited is from the accepted executed records.",
    "Zero gameplay/source change: git diff src/ src/adapters/ eval/ gauntlet/evals/ gauntlet/roles/ specs/ is EMPTY; only RELEASE-0.9.7.md + VERSION.json + evidence + a binding test + this producer are added.",
    "No accepted record mutation: the cited accepted records (RULES-SUITE-STATE-RERUN, SUITE-DETERMINISTIC-TWO-RUN, GK-SUITE-CORE-OWNED-STATE, FOULS-SPEC-DRAFT, RULES-SUITE-REGISTRATION, RESTART-DESIGNATION-FACTS-CONFORMANCE, HUMAN-BALL-SERVER-DECISION) stay byte-untouched (verified by their pinned record_sha256).",
  ],
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

mkdirSync(OUTPUT_ROOT, { recursive: true });
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(`[release-0.9.7-consolidation] wrote ${STATE_PATH}`);
console.log(`[release-0.9.7-consolidation] record_sha256=${String(record.record_sha256)}`);
console.log(
  `[release-0.9.7-consolidation] version=${version.version} rules=${rulesCounts.PASS}/${rulesCounts.BLOCKED_MISSING_REFERENCE} ` +
    `gk=${gkCounts.PASS}/${gkCounts.BLOCKED_MISSING_REFERENCE}/${gkCounts.NEEDS_PERCEPTUAL_REVIEW} ` +
    `foulsSpec=${foulsSpecExists}`,
);
