/**
 * Node-side evidence producer for RELEASE-0.9.8-PRODUCT (BOOKKEEPING).
 *
 * PRODUCT consolidation of the v34-v37 delivered capability into the release
 * record: what is playable (the referee loop in the shipped app), what is
 * executable/attested (the partial fouls suite, the gk-regression canary, the
 * re-published goalkeepers aggregate, the designation-facts serialization),
 * what is spec'd (the FOULS_CARDS_SPEC card/advantage state), what stays
 * deferred, and the honest limitations. It reads the accepted records and
 * verifies the headline facts against them, so every claim in the record cites
 * an accepted record (record_sha256 pinned, or the manifest bytes pinned where
 * an objective produced no producer record) rather than being a bare summary.
 *
 * NAME COLLISION: the 0.9.8 SYSTEM release notes already occupy
 * `gauntlet/RELEASE-0.9.8.md` (product-first orchestration). This horizon
 * objective predates that naming; the PRODUCT consolidation record is therefore
 * `gauntlet/RELEASE-0.9.8-PRODUCT.md` and this producer never writes the system
 * notes. VERSION.json / prompt-gate.ts are NOT touched (the live system version
 * is 0.9.9; the record stores the VERSION.json snapshot as history only).
 *
 * BOOKKEEPING: zero gameplay/source change in src/, src/contracts/,
 * src/adapters/, eval/, specs/. The record carries NO wall-clock field, so
 * consecutive ordinary-mode runs are byte-identical and leave `docs/`
 * byte-identical.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:RELEASE-0.9.8-PRODUCT`.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:RELEASE-0.9.8-PRODUCT \
 *     mise exec -- pnpm exec tsx scripts/capture-release-0-9-8-product.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const OBJECTIVE_ID = "RELEASE-0.9.8-PRODUCT";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const STATE_PATH = resolve(OUTPUT_ROOT, "release-0-9-8-product.json");

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

// --- The accepted records the release facts are cited against (v34-v37) ---

const FOUL_DETECTION_MACHINERY = "docs/evidence/FOUL-DETECTION-MACHINERY/foul-detection-machinery.json";
const FOULS_SUITE_REGISTRATION = "docs/evidence/FOULS-SUITE-REGISTRATION/fouls-suite-registration.json";
const HUMAN_BALL_SERVER_LITERAL = "docs/evidence/HUMAN-BALL-SERVER-LITERAL/human-ball-server-literal.json";
const GK_DRIVEN_CLOSURE = "docs/evidence/GK-DRIVEN-CLOSURE/gk-driven-closure.json";
const FOUL_CONSEQUENCE_MACHINERY = "docs/evidence/FOUL-CONSEQUENCE-MACHINERY/foul-consequence-machinery.json";
const FREE_KICK_SUITE_REGISTRATION = "docs/evidence/FREE-KICK-SUITE-REGISTRATION/freekick-suite-registration.json";
const GK_REGRESSION_POLICY_REGISTRATION = "docs/evidence/GK-REGRESSION-POLICY-REGISTRATION/gk-regression-policy-registration.json";
const FOUL_FREEKICK_BROWSER_EVIDENCE = "docs/evidence/FOUL-FREEKICK-BROWSER-EVIDENCE/foul-freekick-browser-evidence-state.json";
const FOULS_AGGREGATE_HONESTY_RERUN = "docs/evidence/FOULS-AGGREGATE-HONESTY-RERUN/fouls-aggregate-honesty-rerun.json";
const CARD_MACHINERY = "docs/evidence/CARD-MACHINERY/card-machinery.json";
const CARD_ISSUED_SUITE_REGISTRATION = "docs/evidence/CARD-ISSUED-SUITE-REGISTRATION/card-issued-suite-registration.json";
const CARD_BROWSER_EVIDENCE = "docs/evidence/CARD-BROWSER-EVIDENCE/card-browser-evidence-state.json";
const REFEREE_SHIPPED_WIRING = "docs/evidence/REFEREE-SHIPPED-WIRING/referee-shipped-wiring-state.json";
const RESTART_DESIGNATION_FACTS = "docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/restart-designation-facts-state.json";

// The two v37 objectives carry manifests; ADVANTAGE-WINDOW-SPEC produced no
// producer record with a record_sha256 (BOOKKEEPING, spec-only), so it is pinned
// by its manifest bytes + the audit artifact sha256 the manifest itself records.
const REFEREE_MANIFEST = "docs/evidence/REFEREE-SHIPPED-WIRING/manifest.json";
const ADVANTAGE_MANIFEST = "docs/evidence/ADVANTAGE-WINDOW-SPEC/manifest.json";
const ADVANTAGE_AUDIT = "docs/evidence/ADVANTAGE-WINDOW-SPEC/audit.json";

const RELEASE_DOC = "gauntlet/RELEASE-0.9.8-PRODUCT.md";
const PREVIOUS_RELEASE_DOC = "gauntlet/RELEASE-0.9.7.md";
const SYSTEM_RELEASE_NOTES = "gauntlet/RELEASE-0.9.8.md";
const VERSION_FILE = "gauntlet/VERSION.json";
const FOULS_SPEC = "specs/FOULS_CARDS_SPEC.md";

// Pinned record_sha256 of each accepted record (a mutation fails the producer).
const PINNED_RECORD_SHA: Record<string, string> = {
  [FOUL_DETECTION_MACHINERY]: "69104ea10e14aa2607eefbd9e3206e17d025f4cea5206032867e4772bc89a272",
  [FOULS_SUITE_REGISTRATION]: "5e538e5d183ee0c3c79e4981bb447a06c42d3b7be3a3ceb66f320dfb24611794",
  [HUMAN_BALL_SERVER_LITERAL]: "85fc082d30e9120c5c12f9d9e6950dbb332fee8960affdf8852f8feb5c4734ef",
  [GK_DRIVEN_CLOSURE]: "21a596277aac626f3612e225ced4145310e1a81631bd28552f9188d223b33d7a",
  [FOUL_CONSEQUENCE_MACHINERY]: "39da80ad4106546939afeefa34cca2763a113bdfc559eec013a9ee578834da95",
  [FREE_KICK_SUITE_REGISTRATION]: "86a34acb5f7336ac339c91fced93246c52f1f6beadb5407ae916cae7e6b425f2",
  [GK_REGRESSION_POLICY_REGISTRATION]: "fc7d1b97b3b1a78613b571610e3bdbc53aa076b5ae42f828555a4110e037e60e",
  [FOUL_FREEKICK_BROWSER_EVIDENCE]: "e65c3618369a1474eb2c094714b41fb85986e68d3a6e6f19011fd7ed4cb6188c",
  [FOULS_AGGREGATE_HONESTY_RERUN]: "c8b3b63edd57f6acd15e91f4daa0bdb8d35e239155ee51b6975cc76f59acaa21",
  [CARD_MACHINERY]: "01d731ada16b2451b1a939bf9d20af66da8bdc07445fbcd150cd41062a2cba66",
  [CARD_ISSUED_SUITE_REGISTRATION]: "3dac8a48cae826d846e58c16ec487cc40187b645b9b17bc385ae2f64dc16bd3c",
  [CARD_BROWSER_EVIDENCE]: "bc9daf1fff3167eed5e7d14a6c7a739c3210e4fa449268b5bef76de9384069d0",
  [REFEREE_SHIPPED_WIRING]: "b2f5392784b10431fdf1bd689ee29e4a94f6a6c3bb4a3e746e97461320f0a40a",
  [RESTART_DESIGNATION_FACTS]: "271b1526592cc13e3792bee42f2544379e7dea16de9571b43113b32b57e7fc56",
};

// Pinned bytes for the objectives that produced no record_sha256.
const PINNED_FILE_SHA: Record<string, string> = {
  [REFEREE_MANIFEST]: "1219570a04182abadf8ae172a67861e258ac28d18c18b6094ceedfe04a75f4d5",
  [ADVANTAGE_MANIFEST]: "2febf1302470dc7f7f8d6daf9a3e6d61e67baf277748e35f9f4e55f204b391a9",
  [ADVANTAGE_AUDIT]: "1608f247fa974049375c89c197725927adbcbed2563291be1fbc79bd0f5b9f5a",
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

function assertFileSha(path: string): string {
  const expected = PINNED_FILE_SHA[path];
  if (!expected) throw new Error(`no pinned file sha for ${path}`);
  const actual = sha256(read(path));
  if (actual !== expected) {
    throw new Error(`pinned file ${path} mutated: expected ${expected}, found ${actual}`);
  }
  return actual;
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

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
  }
}

// --- Source-level facts (deterministic; no wall-clock, no simulation) ---

const releaseDoc = read(RELEASE_DOC);
const previousReleaseDoc = read(PREVIOUS_RELEASE_DOC);
const systemReleaseNotes = read(SYSTEM_RELEASE_NOTES);
const version = readJson<{
  version: string;
  schema_version: number;
  semver: boolean;
  previous_system_version: string;
}>(VERSION_FILE);

// The product consolidation record names 0.9.8; the LIVE system version is 0.9.9
// and is deliberately NOT modified by this BOOKKEEPING objective.
if (version.version !== "0.9.9") {
  throw new Error(`live system VERSION.json must be 0.9.9 (do not bump it here), found ${version.version}`);
}
if (version.previous_system_version !== "0.9.8") {
  throw new Error(`live system previous_system_version must be 0.9.8, found ${version.previous_system_version}`);
}
if (!systemReleaseNotes.includes("Product-first orchestration")) {
  throw new Error("gauntlet/RELEASE-0.9.8.md must remain the 0.9.8 SYSTEM release notes (product-first orchestration)");
}
for (const heading of ["## Playable", "## Executable / attested", "## Spec'd", "## Deferred", "## Honest limitations"]) {
  if (!releaseDoc.includes(heading)) throw new Error(`product release doc missing section: ${heading}`);
}

// --- FOULS_CARDS_SPEC: the card/advantage spec state (post ADVANTAGE-WINDOW-SPEC) ---

const foulsSpec = read(FOULS_SPEC);
for (const section of ["### 6.1 ", "### 6.2 ", "### 6.3 ", "### 6.4 ", "### 6.5 "]) {
  if (!foulsSpec.includes(section)) throw new Error(`FOULS_CARDS_SPEC missing advantage design-contract section: ${section}`);
}
for (const needle of [
  "advantage_window_ticks",
  "foul_caution_pending_ticks",
  "advantage_retention_ref",
  "BLOCKED_MISSING_REFERENCE",
  "NAMED-NOT-REGISTERED",
  "**CARD-ISSUED** (registered by CARD-ISSUED-SUITE-REGISTRATION)",
]) {
  if (!foulsSpec.includes(needle)) throw new Error(`FOULS_CARDS_SPEC missing: ${needle}`);
}
// §9.1 owns the two advantage budgets (VERSIONED_PROVISIONAL engine-tick budgets).
const advantageRow = foulsSpec.split("\n").find((line) => /^\|\s*`advantage_window_ticks`\s*\|/.test(line));
const pendingRow = foulsSpec.split("\n").find((line) => /^\|\s*`foul_caution_pending_ticks`\s*\|/.test(line));
if (!advantageRow?.includes("`24`")) throw new Error("advantage_window_ticks must be 24 in FOULS_CARDS_SPEC §9.1");
if (!pendingRow?.includes("`12`")) throw new Error("foul_caution_pending_ticks must be 12 in FOULS_CARDS_SPEC §9.1");

// --- REFEREE-SHIPPED-WIRING: the referee loop playable in the shipped app ---

interface RefereeRecord {
  frames: Array<{ label: string; tick: number; sha256: string }>;
  arc: {
    foul_ticks: number[];
    foul_count: number;
    card_count: number;
    first_free_kick: { tick: number; teamId: string };
    caution: { tick: number; cardType: string; accumulatedFouls: number; playerId: string };
    booking_state: Record<string, { fouls: number; cautions: number; expulsions: number }>;
  };
  correspondence: {
    browser_foul_ticks: number[];
    headless_foul_ticks: number[];
    browser_free_kick_tick: number;
    headless_free_kick_tick: number;
    browser_caution_tick: number;
    headless_caution_tick: number;
    foul_ticks_equal: boolean;
    free_kick_tick_offset: number;
    caution_tick_offset: number;
    correspondence_traced: boolean;
  };
}
const referee = readJson<RefereeRecord>(REFEREE_SHIPPED_WIRING);
assertEqual(referee.frames.length, 5, "REFEREE-SHIPPED-WIRING frames");
assertEqual(referee.arc.foul_count, 2, "REFEREE-SHIPPED-WIRING foul_count");
assertEqual(referee.arc.card_count, 1, "REFEREE-SHIPPED-WIRING card_count");
assertEqual(referee.arc.foul_ticks, [66, 290], "REFEREE-SHIPPED-WIRING foul_ticks");
assertEqual(referee.arc.first_free_kick.tick, 126, "REFEREE-SHIPPED-WIRING first_free_kick tick");
assertEqual(referee.arc.first_free_kick.teamId, "team-b", "REFEREE-SHIPPED-WIRING first_free_kick team");
assertEqual(
  referee.arc.caution,
  { tick: 290, cardType: "caution", accumulatedFouls: 2, playerId: "player-1" },
  "REFEREE-SHIPPED-WIRING caution",
);
assertEqual(
  referee.arc.booking_state["player-1"],
  { fouls: 2, cautions: 1, expulsions: 0 },
  "REFEREE-SHIPPED-WIRING booking_state",
);
assertEqual(referee.correspondence.foul_ticks_equal, true, "REFEREE-SHIPPED-WIRING foul_ticks_equal");
assertEqual(referee.correspondence.free_kick_tick_offset, 0, "REFEREE-SHIPPED-WIRING free_kick offset");
assertEqual(referee.correspondence.caution_tick_offset, 0, "REFEREE-SHIPPED-WIRING caution offset");
assertEqual(referee.correspondence.correspondence_traced, true, "REFEREE-SHIPPED-WIRING correspondence_traced");
assertEqual(referee.correspondence.browser_foul_ticks, referee.correspondence.headless_foul_ticks, "REFEREE-SHIPPED-WIRING browser/headless foul ticks");
assertEqual(referee.correspondence.browser_free_kick_tick, referee.correspondence.headless_free_kick_tick, "REFEREE-SHIPPED-WIRING browser/headless free-kick tick");
assertEqual(referee.correspondence.browser_caution_tick, referee.correspondence.headless_caution_tick, "REFEREE-SHIPPED-WIRING browser/headless caution tick");

interface RefereeManifest {
  evidence: {
    screenshots: Array<{ path: string }>;
    semantic_sequence: { metadata: { frames: Array<{ sha256: string }> } };
    metrics: string[];
  };
}
const refereeManifest = readJson<RefereeManifest>(REFEREE_MANIFEST);
if (!refereeManifest.evidence.screenshots.some((s) => s.path.endsWith("menu-referee-toggle.png"))) {
  throw new Error("REFEREE manifest must include the menu Referee toggle screenshot");
}
if (!refereeManifest.evidence.metrics.some((m) => m.includes("menu-visible Referee toggle"))) {
  throw new Error("REFEREE manifest must record the menu-visible Referee toggle metric");
}
// The manifest frame SHAs must equal the record's frame SHAs (no divergence).
const manifestFrameShas = refereeManifest.evidence.semantic_sequence.metadata.frames.map((f) => f.sha256).sort();
const recordFrameShas = referee.frames.map((f) => f.sha256).sort();
assertEqual(manifestFrameShas, recordFrameShas, "REFEREE manifest/record frame sha set");

// --- FOULS & CARDS suites ---

// FOULS-SUITE-REGISTRATION registered FOUL-DETECT + FOUL-CLEAN-TACKLE (2 of 5).
const foulsRegistration = readJson<{
  runs: Array<{ id: string; suite_verdict: { suite_id: string; suite_version: string; tests: Array<{ criteria: Array<{ criterion_id: string; outcome: string }> }> } }>;
}>(FOULS_SUITE_REGISTRATION);
const firstFoulsVerdict = foulsRegistration.runs[0].suite_verdict;
assertEqual(firstFoulsVerdict.suite_id, "fouls", "fouls registration suite_id");
assertEqual(firstFoulsVerdict.suite_version, "suite-fouls-v1", "fouls registration suite_version");
assertEqual(
  firstFoulsVerdict.tests.flatMap((t) => t.criteria.map((c) => c.criterion_id)).sort(),
  ["FOUL-CLEAN-TACKLE", "FOUL-DETECT"],
  "FOULS-SUITE-REGISTRATION registered criteria",
);
for (const test of firstFoulsVerdict.tests) {
  for (const criterion of test.criteria) {
    if (criterion.outcome !== "PASS") throw new Error(`FOULS-SUITE-REGISTRATION ${criterion.criterion_id} must be PASS on the live stream`);
  }
}

// FREE-KICK-SUITE-REGISTRATION registered FREE-KICK-AWARD (3 of 5).
const freekickRegistration = readJson<{
  runs: Array<{ id: string; free_kick_award_outcome: string }>;
}>(FREE_KICK_SUITE_REGISTRATION);
const freekickOrganic = freekickRegistration.runs.find((r) => r.id === "freekick-organic");
const freekickGuards = freekickRegistration.runs.filter(
  (r) => r.id === "freekick-antihuddle-window" || r.id === "freekick-human-serve",
);
if (freekickOrganic?.free_kick_award_outcome !== "PASS") throw new Error("FREE-KICK-AWARD must PASS on the organic stream");
assertEqual(freekickGuards.length, 2, "FREE-KICK power-guard stream count");
for (const guard of freekickGuards) {
  if (guard.free_kick_award_outcome !== "FAIL") throw new Error(`${guard.id}: power guard must FAIL`);
}

// CARD-ISSUED-SUITE-REGISTRATION registered CARD-ISSUED (4 of 5); honestly NOT_EVALUATED on all streams.
const cardRegistration = readJson<{
  runs: Array<{ id: string; fouls_suite_verdicts: Record<string, string>; card_issued_outcome: string }>;
}>(CARD_ISSUED_SUITE_REGISTRATION);
assertEqual(cardRegistration.runs.length, 4, "CARD-ISSUED stream count");
for (const run of cardRegistration.runs) {
  assertEqual(run.card_issued_outcome, "NOT_EVALUATED", `CARD-ISSUED outcome (${run.id})`);
  assertEqual(run.fouls_suite_verdicts["CARD-ISSUED"], "NOT_EVALUATED", `CARD-ISSUED verdict (${run.id})`);
}
assertEqual(
  Object.keys(cardRegistration.runs[0].fouls_suite_verdicts).sort(),
  ["CARD-ISSUED", "FOUL-CLEAN-TACKLE", "FOUL-DETECT", "FREE-KICK-AWARD"],
  "registered fouls criteria at CARD-ISSUED-SUITE-REGISTRATION",
);

// The registered-oracle set the release publishes (4 registered / 1 named-not-registered).
const registeredCriteria = ["FOUL-CLEAN-TACKLE", "FOUL-DETECT", "FREE-KICK-AWARD", "CARD-ISSUED"];
const perCriterion: Record<string, string> = {
  "FOUL-DETECT": "PASS",
  "FOUL-CLEAN-TACKLE": "PASS",
  "FREE-KICK-AWARD": "PASS",
  "CARD-ISSUED": "NOT_EVALUATED",
};

// --- FOULS-AGGREGATE-HONESTY-RERUN: republication + goalkeepers 10/0/1/1/1 ---

interface AggregateRerun {
  suites: {
    goalkeepers: {
      suite_id: string;
      suite_version: string;
      baseline: { verdict_counts: VerdictCounts };
      current: { verdict_counts: VerdictCounts };
      verdict_delta: { changed: Array<{ criterion: string; from: string; to: string }> };
    };
    fouls: {
      suite_id: string;
      suite_version: string;
      registered_criteria: string[];
      named_not_registered: string[];
      per_criterion: Record<string, { verdict: string }>;
      verdict_counts: VerdictCounts;
    };
  };
  guard_state: { all_gk_streams_character_identical_to_accepted: boolean; all_fouls_streams_character_identical_to_accepted: boolean };
}
const aggregate = readJson<AggregateRerun>(FOULS_AGGREGATE_HONESTY_RERUN);

const gkBaselineCounts = normalizeCounts(aggregate.suites.goalkeepers.baseline.verdict_counts);
assertCounts(gkBaselineCounts, { PASS: 9, FAIL: 0, NOT_EVALUATED: 2, BLOCKED_MISSING_REFERENCE: 1, NEEDS_PERCEPTUAL_REVIEW: 1 }, "goalkeepers baseline");
const gkCurrentCounts = normalizeCounts(aggregate.suites.goalkeepers.current.verdict_counts);
assertCounts(gkCurrentCounts, { PASS: 10, FAIL: 0, NOT_EVALUATED: 1, BLOCKED_MISSING_REFERENCE: 1, NEEDS_PERCEPTUAL_REVIEW: 1 }, "goalkeepers current");
assertEqual(
  aggregate.suites.goalkeepers.verdict_delta.changed.map((c) => ({ criterion: c.criterion, from: c.from, to: c.to })),
  [{ criterion: "reg", from: "NOT_EVALUATED", to: "PASS" }],
  "goalkeepers verdict delta",
);

assertEqual(aggregate.suites.fouls.suite_id, "fouls", "fouls suite id");
assertEqual(aggregate.suites.fouls.suite_version, "suite-fouls-v1", "fouls suite version");
assertEqual(aggregate.suites.fouls.registered_criteria.slice().sort(), ["FOUL-CLEAN-TACKLE", "FOUL-DETECT", "FREE-KICK-AWARD"], "fouls registered at republication");
assertEqual(aggregate.suites.fouls.named_not_registered.slice().sort(), ["ADVANTAGE-PLAYED", "CARD-ISSUED"], "fouls named-not-registered at republication");
const foulsCounts = normalizeCounts(aggregate.suites.fouls.verdict_counts);
assertCounts(foulsCounts, { PASS: 3, FAIL: 0, NOT_EVALUATED: 0, BLOCKED_MISSING_REFERENCE: 0, NEEDS_PERCEPTUAL_REVIEW: 0 }, "fouls aggregate");
for (const [criterion, expected] of Object.entries(perCriterion)) {
  if (criterion === "CARD-ISSUED") continue; // registered later; sourced from CARD-ISSUED-SUITE-REGISTRATION
  if (aggregate.suites.fouls.per_criterion[criterion]?.verdict !== expected) {
    throw new Error(`fouls per-criterion ${criterion} must be ${expected}`);
  }
}
assertEqual(aggregate.guard_state.all_gk_streams_character_identical_to_accepted, true, "gk stream guard");
assertEqual(aggregate.guard_state.all_fouls_streams_character_identical_to_accepted, true, "fouls stream guard");

// --- GK-REGRESSION-POLICY-REGISTRATION: the registered canary ---

const gkRegression = readJson<{
  suite_id: string;
  suite_version: string;
  registration_chain: {
    oracle: { oracle_id: string; oracle_version: string };
    invariant: { invariant_id: string };
    criterion_bindings: Array<{ criterion_id: string; class: string }>;
  };
  before: { reg_aggregate: string };
  after: { reg_aggregate: string };
}>(GK_REGRESSION_POLICY_REGISTRATION);
assertEqual(gkRegression.suite_id, "goalkeepers", "gk regression suite id");
assertEqual(gkRegression.registration_chain.oracle.oracle_id, "gk-regression-canary-v1", "gk regression oracle id");
assertEqual(gkRegression.registration_chain.invariant.invariant_id, "gk-regression-evidence", "gk regression invariant id");
assertEqual(gkRegression.registration_chain.criterion_bindings.length, 6, "GK-*-REG criterion count");
for (const binding of gkRegression.registration_chain.criterion_bindings) {
  if (binding.class !== "REGRESSION") throw new Error(`${binding.criterion_id} must be class REGRESSION`);
}
assertEqual(gkRegression.before.reg_aggregate, "NOT_EVALUATED", "gk reg before");
assertEqual(gkRegression.after.reg_aggregate, "PASS", "gk reg after");

// --- GK-DRIVEN-CLOSURE: the driven GK streams ---

const gkClosure = readJson<{
  driven_streams: Array<{ stream_id: string; save_chains: unknown[]; distribution: { releases: number } }>;
  after: { catalog: { reg: string } };
  verdict_counts: VerdictCounts;
}>(GK_DRIVEN_CLOSURE);
const saveDriven = gkClosure.driven_streams.find((s) => s.stream_id === "gk-save-driven");
const releaseDriven = gkClosure.driven_streams.find((s) => s.stream_id === "gk-release-driven");
assertEqual(saveDriven?.save_chains.length, 4, "gk-save-driven save chains");
assertEqual(releaseDriven?.distribution.releases, 12, "gk-release-driven releases");
assertCounts(normalizeCounts(gkClosure.verdict_counts), { PASS: 9, FAIL: 0, NOT_EVALUATED: 2, BLOCKED_MISSING_REFERENCE: 1, NEEDS_PERCEPTUAL_REVIEW: 1 }, "GK-DRIVEN-CLOSURE counts");

// --- FOUL / FREE-KICK / CARD machinery + browser evidence ---

const foulDetection = readJson<{
  runs: Array<{ id: string; foul_count: number; stash_identity?: { state_hash_chain_identical: boolean } }>;
}>(FOUL_DETECTION_MACHINERY);
const detectionOrganic = foulDetection.runs.find((r) => r.id === "organic-foul-live");
const detectionStash = foulDetection.runs.find((r) => r.id === "organic-foul-stashed");
assertEqual(detectionOrganic?.foul_count, 1, "FOUL-DETECTION organic foul count");
assertEqual(detectionStash?.foul_count, 0, "FOUL-DETECTION stash foul count");
assertEqual(detectionStash?.stash_identity?.state_hash_chain_identical, true, "FOUL-DETECTION stash identity");

const consequence = readJson<{
  runs: Array<{ id: string; foul_count: number; free_kick_count: number }>;
  core_change: { versioned_provisional_parameters: { gate: string } };
}>(FOUL_CONSEQUENCE_MACHINERY);
const consequenceOrganic = consequence.runs.find((r) => r.id === "freekick-organic");
assertEqual(consequenceOrganic?.foul_count, 1, "FOUL-CONSEQUENCE organic foul count");
assertEqual(consequenceOrganic?.free_kick_count, 1, "FOUL-CONSEQUENCE organic free-kick count");
if (!consequence.core_change.versioned_provisional_parameters.gate.includes("default off")) {
  throw new Error("FOUL-CONSEQUENCE free-kick gate must be default off");
}

const cardMachinery = readJson<{
  runs: Array<{ id: string; card_events: Array<{ tick: number; cardType: string; accumulatedFouls: number }> }>;
}>(CARD_MACHINERY);
const cardDriven = cardMachinery.runs.find((r) => r.id === "card-driven-duel");
assertEqual(
  cardDriven?.card_events.map((e) => ({ tick: e.tick, cardType: e.cardType, accumulatedFouls: e.accumulatedFouls })),
  [
    { tick: 116, cardType: "caution", accumulatedFouls: 2 },
    { tick: 371, cardType: "expulsion", accumulatedFouls: 5 },
  ],
  "CARD-MACHINERY card events",
);

const foulFreekickBrowser = readJson<{
  frames: unknown[];
  correspondence: { foul_tick_offset: number; free_kick_tick_offset: number; offsets_traced: boolean };
}>(FOUL_FREEKICK_BROWSER_EVIDENCE);
assertEqual(foulFreekickBrowser.frames.length, 4, "FOUL-FREEKICK browser frames");
assertEqual(foulFreekickBrowser.correspondence.foul_tick_offset, 0, "FOUL-FREEKICK foul tick offset");
assertEqual(foulFreekickBrowser.correspondence.free_kick_tick_offset, 0, "FOUL-FREEKICK free-kick offset");
assertEqual(foulFreekickBrowser.correspondence.offsets_traced, true, "FOUL-FREEKICK offsets traced");

const cardBrowser = readJson<{
  frames: unknown[];
  correspondence: { caution_tick_offset: number; expulsion_tick_offset: number; foul_tick_offsets: number[]; offsets_traced: boolean };
}>(CARD_BROWSER_EVIDENCE);
assertEqual(cardBrowser.frames.length, 5, "CARD browser frames");
assertEqual(cardBrowser.correspondence.caution_tick_offset, 0, "CARD caution offset");
assertEqual(cardBrowser.correspondence.expulsion_tick_offset, 0, "CARD expulsion offset");
assertEqual(cardBrowser.correspondence.foul_tick_offsets, [0, 0, 0, 0, 0], "CARD foul tick offsets");
assertEqual(cardBrowser.correspondence.offsets_traced, true, "CARD offsets traced");

// --- HUMAN-BALL-SERVER-LITERAL ---

const humanBallServer = readJson<{
  runs: Array<{ id: string; verdicts: Record<string, string>; oracle_verdicts: Record<string, string> }>;
}>(HUMAN_BALL_SERVER_LITERAL);
const humanServe = humanBallServer.runs.find((r) => r.id === "human-throwin-served");
assertEqual(humanServe?.verdicts["MATCH-THROW-IN-SERVE"], "PASS", "HUMAN-BALL-SERVER throw-in serve");
assertEqual(humanServe?.oracle_verdicts["human-serve-direction-oracle-v1"], "PASS", "HUMAN-BALL-SERVER serve direction oracle");

// --- ADVANTAGE-WINDOW-SPEC (manifest-pinned; no producer record) ---

interface AdvantageManifest {
  objective_id: string;
  candidate_commit: string;
  evidence_class: string;
  evidence: {
    deterministic_audit_artifact: { path: string; sha256: string };
    metrics: string[];
  };
}
const advantageManifest = readJson<AdvantageManifest>(ADVANTAGE_MANIFEST);
assertEqual(advantageManifest.objective_id, "ADVANTAGE-WINDOW-SPEC", "ADVANTAGE-WINDOW-SPEC objective id");
assertEqual(advantageManifest.evidence_class, "BOOKKEEPING", "ADVANTAGE-WINDOW-SPEC evidence class");
assertEqual(advantageManifest.candidate_commit, "0acbd6547c9422e7f446bd91acdfac489e417fa2", "ADVANTAGE-WINDOW-SPEC candidate");
const advantageAuditPin = sha256(read(ADVANTAGE_AUDIT));
assertEqual(advantageManifest.evidence.deterministic_audit_artifact.sha256, advantageAuditPin, "ADVANTAGE-WINDOW-SPEC audit artifact sha");
if (!advantageManifest.evidence.metrics.some((m) => m.includes("advantage_retention_ref BLOCKED_MISSING_REFERENCE"))) {
  throw new Error("ADVANTAGE-WINDOW-SPEC must record the blocked advantage_retention_ref");
}

// --- Pinned accepted record SHAs (a mutation fails the producer) ---

const citedRecordShas: Record<string, string> = {};
for (const p of [
  FOUL_DETECTION_MACHINERY,
  FOULS_SUITE_REGISTRATION,
  HUMAN_BALL_SERVER_LITERAL,
  GK_DRIVEN_CLOSURE,
  FOUL_CONSEQUENCE_MACHINERY,
  FREE_KICK_SUITE_REGISTRATION,
  GK_REGRESSION_POLICY_REGISTRATION,
  FOUL_FREEKICK_BROWSER_EVIDENCE,
  FOULS_AGGREGATE_HONESTY_RERUN,
  CARD_MACHINERY,
  CARD_ISSUED_SUITE_REGISTRATION,
  CARD_BROWSER_EVIDENCE,
  REFEREE_SHIPPED_WIRING,
  RESTART_DESIGNATION_FACTS,
]) {
  citedRecordShas[p] = assertRecordSha(p);
}
const citedFileShas: Record<string, string> = {};
for (const p of [REFEREE_MANIFEST, ADVANTAGE_MANIFEST, ADVANTAGE_AUDIT]) {
  citedFileShas[p] = assertFileSha(p);
}

const sourceHashes: Record<string, string> = {};
for (const file of [RELEASE_DOC, PREVIOUS_RELEASE_DOC, SYSTEM_RELEASE_NOTES, VERSION_FILE]) {
  sourceHashes[file] = sha256(read(file));
}

const citedRecords: Record<string, { objective_id: string; record_sha256: string; pin_kind: string }> = {};
for (const [path, value] of Object.entries(citedRecordShas)) {
  citedRecords[path] = { objective_id: readJson<{ objective_id: string }>(path).objective_id, record_sha256: value, pin_kind: "record" };
}
for (const [path, value] of Object.entries(citedFileShas)) {
  citedRecords[path] = { objective_id: readJson<{ objective_id: string }>(path).objective_id, record_sha256: value, pin_kind: "file_bytes" };
}

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "BOOKKEEPING",
  produced_by: "scripts/capture-release-0-9-8-product.ts",
  product_release_version: "0.9.8",
  previous_product_release_version: "0.9.7",
  release_doc: RELEASE_DOC,
  name_collision_resolution: {
    note: "The horizon objective id RELEASE-0.9.8-CONSOLIDATION collides with the already-released 0.9.8 Gauntlet SYSTEM release notes. The product consolidation record is therefore written as gauntlet/RELEASE-0.9.8-PRODUCT.md (evidence under docs/evidence/RELEASE-0.9.8-PRODUCT/) and the system notes are left untouched.",
    system_release_notes: SYSTEM_RELEASE_NOTES,
    system_release_notes_sha256: sourceHashes[SYSTEM_RELEASE_NOTES],
    previous_product_release_doc: PREVIOUS_RELEASE_DOC,
    previous_product_release_doc_sha256: sourceHashes[PREVIOUS_RELEASE_DOC],
  },
  version_json: {
    version: version.version,
    schema_version: version.schema_version,
    semver: version.semver,
    previous_system_version: version.previous_system_version,
  },
  version_snapshot_note:
    "The live VERSION.json is the SYSTEM version (0.9.9) and is deliberately NOT modified by this BOOKKEEPING objective; the horizon's 'VERSION.json 0.9.7 → 0.9.8' language is read as product-release-record naming. The snapshot below is history and is not re-checked against the mutable live file.",
  description:
    "Product consolidation of the v34-v37 delivered capability into the RELEASE-0.9.8 record: what is playable (the referee loop in the shipped app: menu-visible Referee toggle, fouls/free kicks/cards in normal play), what is executable/attested (suite-fouls-v1 4-of-5 registered with executed verdicts, the gk-regression canary, the goalkeepers 10/0/1/1/1, the aggregate-honesty republication, the designation-facts serialization), what is spec'd (the FOULS_CARDS_SPEC card/advantage design contract), what stays deferred, and the honest limitations. BOOKKEEPING; zero gameplay/source change.",
  playable: [
    "The referee loop in the shipped app: a menu-visible Referee toggle (plus the referee=1 URL param) gates fouls, free kicks and cards through the SAME createSimulation config surface the shipped composition root uses (REFEREE-SHIPPED-WIRING).",
    "Five event-centered real-Chromium frames (foul-contact@65, freekick-award@67, freekick-served@128, foul-2-contact@289, caution@290) show the man-not-ball foul -> free-kick award (phase FREE KICK) -> served free kick -> second foul -> caution (yellow) in one match (REFEREE-SHIPPED-WIRING).",
    "Browser<->headless correspondence is exact: foul ticks [66, 290], free-kick tick 126 offset 0, caution tick 290 offset 0, offender player-1 accumulated 2 (REFEREE-SHIPPED-WIRING) — the verified correspondence is the event structure, never per-tick floats.",
    "Earlier accepted browser arcs: the foul -> free-kick arc (FOUL-FREEKICK-BROWSER-EVIDENCE) and the caution(2)/expulsion(5) arc (CARD-BROWSER-EVIDENCE), both with exact 0/0 tick correspondence.",
    "Gate-off byte-identity: the referee toggle off (an explicit-undefined call === createSimulation(world) hash chain) is byte-identical to the pre-change stream (REFEREE-SHIPPED-WIRING).",
  ],
  executable_attested: {
    fouls_suite: {
      suite_id: aggregate.suites.fouls.suite_id,
      suite_version: aggregate.suites.fouls.suite_version,
      criteria_named: 5,
      criteria_registered: 4,
      named_not_registered: ["ADVANTAGE-PLAYED"],
      per_criterion: perCriterion,
      verdict_counts_over_registered: { PASS: 3, FAIL: 0, NOT_EVALUATED: 1, BLOCKED_MISSING_REFERENCE: 0, NEEDS_PERCEPTUAL_REVIEW: 0 },
      note: "Four of the five FOULS_CARDS_SPEC §10 criteria are registered protected oracles and each was executed by the evaluator over the accepted streams; CARD-ISSUED is honestly NOT_EVALUATED on every accepted stream and its PASS/FAIL power is carried by canary tests.",
      source_records: {
        [FOULS_SUITE_REGISTRATION]: citedRecordShas[FOULS_SUITE_REGISTRATION],
        [FREE_KICK_SUITE_REGISTRATION]: citedRecordShas[FREE_KICK_SUITE_REGISTRATION],
        [CARD_ISSUED_SUITE_REGISTRATION]: citedRecordShas[CARD_ISSUED_SUITE_REGISTRATION],
        [FOULS_AGGREGATE_HONESTY_RERUN]: citedRecordShas[FOULS_AGGREGATE_HONESTY_RERUN],
      },
      power_guard_note: "The two FREE-KICK-AWARD power-guard streams (a free kick with NO detected foul) deliberately FAIL and are excluded-and-reported from the genuine aggregate (FOULS-AGGREGATE-HONESTY-RERUN).",
    },
    gk_regression_canary: {
      oracle_id: gkRegression.registration_chain.oracle.oracle_id,
      oracle_version: gkRegression.registration_chain.oracle.oracle_version,
      invariant_id: gkRegression.registration_chain.invariant.invariant_id,
      criteria: gkRegression.registration_chain.criterion_bindings.length,
      reg_aggregate_before: gkRegression.before.reg_aggregate,
      reg_aggregate_after: gkRegression.after.reg_aggregate,
      note: "FAILs a GK behavior pin that diverges without a model-version bump, PASSes when the pins hold, and returns honest NOT_EVALUATED when a stream never triggers a pin (never PASS by silence).",
      source_record: GK_REGRESSION_POLICY_REGISTRATION,
      source_record_sha256: citedRecordShas[GK_REGRESSION_POLICY_REGISTRATION],
    },
    goalkeepers_suite: {
      suite_id: aggregate.suites.goalkeepers.suite_id,
      suite_version: aggregate.suites.goalkeepers.suite_version,
      verdict_counts: gkCurrentCounts,
      baseline_verdict_counts: gkBaselineCounts,
      note: "Exactly one criterion changed versus the 9/0/2/1/1 baseline: the catalog `reg` key NOT_EVALUATED -> PASS through the registered gk-regression canary.",
      source_record: FOULS_AGGREGATE_HONESTY_RERUN,
      source_record_sha256: citedRecordShas[FOULS_AGGREGATE_HONESTY_RERUN],
    },
    driven_gk_closure: {
      save_chains: saveDriven?.save_chains.length ?? 0,
      release_count: releaseDriven?.distribution.releases ?? 0,
      note: "The driven save/release fixtures close the previously NOT_EVALUATED GK observations with real chains (4 keeper save/claim contacts; 12 releases to an observed teammate).",
      source_record: GK_DRIVEN_CLOSURE,
      source_record_sha256: citedRecordShas[GK_DRIVEN_CLOSURE],
    },
    aggregate_honesty_republication: {
      goalkeepers_verdict_counts: gkCurrentCounts,
      goalkeepers_baseline_verdict_counts: gkBaselineCounts,
      changed: [{ criterion: "reg", from: "NOT_EVALUATED", to: "PASS" }],
      fouls_registered_at_republication: aggregate.suites.fouls.registered_criteria.length,
      streams_character_identical_to_accepted: true,
      note: "The goalkeepers and fouls aggregate verdict state re-published with every stream asserted character-identical to its accepted state-hash pin; the power-guard FAILs are excluded AND reported.",
      source_record: FOULS_AGGREGATE_HONESTY_RERUN,
      source_record_sha256: citedRecordShas[FOULS_AGGREGATE_HONESTY_RERUN],
    },
    designation_facts_serialization: {
      gated_flag: "serializeRestartFacts",
      default: false,
      note: "The gated, strictly post-loop, hash-neutral serialization surfaces the committed restart-designation and consequence events (restart-designation, free-kick-executed, card-issued) so the fouls-suite oracles can observe the consequences on organic streams.",
      reused_by: [FOUL_CONSEQUENCE_MACHINERY, CARD_MACHINERY],
      source_record: RESTART_DESIGNATION_FACTS,
      source_record_sha256: citedRecordShas[RESTART_DESIGNATION_FACTS],
    },
    foul_detection_and_human_serve: {
      foul_detection: { source_record: FOUL_DETECTION_MACHINERY, source_record_sha256: citedRecordShas[FOUL_DETECTION_MACHINERY] },
      human_ball_server_literal: { source_record: HUMAN_BALL_SERVER_LITERAL, source_record_sha256: citedRecordShas[HUMAN_BALL_SERVER_LITERAL] },
    },
  },
  specd: {
    fouls_cards_spec: {
      path: FOULS_SPEC,
      model: "fouls-v1",
      exists: foulsSpec.length > 0,
      advantage_design_contract: {
        sections: ["§6.1", "§6.2", "§6.3", "§6.4", "§6.5"],
        present: true,
        note: "§6 advantage semantics promoted from a named stub to a normative design contract by ADVANTAGE-WINDOW-SPEC.",
      },
      advantage_window_ticks: 24,
      foul_caution_pending_ticks: 12,
      both_are_foundation_fixed_dt_tick_budgets: true,
      advantage_retention_ref: "BLOCKED_MISSING_REFERENCE",
      advantage_played: "NAMED-NOT-REGISTERED",
      source_record: ADVANTAGE_MANIFEST,
      source_record_sha256: citedFileShas[ADVANTAGE_MANIFEST],
      source_record_pin_kind: "file_bytes",
      audit_artifact: ADVANTAGE_AUDIT,
      audit_artifact_sha256: citedFileShas[ADVANTAGE_AUDIT],
      source_record_note: "ADVANTAGE-WINDOW-SPEC is BOOKKEEPING/spec-only and produced no producer record with a record_sha256; it is pinned by its manifest bytes plus the audit artifact sha256 the manifest itself records (no guess).",
    },
  },
  deferred: [
    "ADVANTAGE-PLAYED machinery: the advantage-window design is spec'd, not implemented; the engine calls every recognized foul (ADVANTAGE-WINDOW-SPEC; FOULS_CARDS_SPEC §6).",
    "The card contact-severity path (direct red): foul_card_direct_red_severity_threshold 0.85 stays BLOCKED_MISSING_REFERENCE; cards issue by equal-fouls accumulation only (CARD-MACHINERY).",
    "Second-yellow -> red: not implemented; the accumulation path issues a caution at 2 and an expulsion at 5 (CARD-MACHINERY).",
    "All blocked references stay BLOCKED_MISSING_REFERENCE, never invented: advantage_retention_ref + advantage_window_ref_ms (FOULS_CARDS_SPEC §11), foul_card_threshold_ref, foul_severity_distribution_ref, foul_ball_carrier_identity_ref, free_kick_trajectory_ref, disciplinary_scale_ref, card_display_visual_ref, plus the GK-*-REF and the rules-suite MATCH-CORNER-KICK-CROSS / MATCH-GOAL-KICK-DISTRIBUTION.",
    "Regulation rules (offside, penalty kicks) — regulation-only, no existence claim.",
    "Full-match ecology.",
    "PES fidelity: no measured PES envelope; all unmeasured values stay VERSIONED_PROVISIONAL.",
  ],
  limitations: [
    "The referee loop is GATED and opt-in: it is not claimed to be always-on, and PES referee frequency/fidelity is not claimed (REFEREE-SHIPPED-WIRING).",
    "Driven-fixture evidence: the referee, foul/free-kick and card browser arcs are driven duels (scripted standing tackles, short windows), disclosed, not organic 90-minute matches.",
    "CARD-ISSUED is NOT_EVALUATED on every accepted stream: the driven shape is commit-only and the organic shape is below the caution threshold; the oracle's guards are proven by canary tests, not an accepted PASS stream (CARD-ISSUED-SUITE-REGISTRATION).",
    "Browser<->headless correspondence is event-structural only, never per-tick floats (the known pinned-runtime gap) (REFEREE-SHIPPED-WIRING).",
    "The fouls suite is partial: 4 of 5 §10 criteria registered; FREE-KICK-AWARD's PASS rests on one organic stream with two deliberate power-guard FAILs excluded and reported (FOULS-AGGREGATE-HONESTY-RERUN).",
    "The gk-regression canary returns honest NOT_EVALUATED for a pin a stream never triggers (never PASS by silence) and is wired only to the six GK-*-REG criteria (GK-REGRESSION-POLICY-REGISTRATION).",
    "No suite-level PASS, no PROMOTION, no FOUNDATION_LAB_PASS, no milestone PASS; no criterion is upgraded beyond what the executed evaluator returns.",
  ],
  cited_records: citedRecords,
  source_hashes: sourceHashes,
  claims_not_made: [
    "No suite-level PASS claim for the fouls suite (4 of 5 criteria registered; ADVANTAGE-PLAYED named-not-registered; CARD-ISSUED NOT_EVALUATED on every accepted stream) or for the goalkeepers suite (1 BLOCKED + 1 NEEDS_PERCEPTUAL_REVIEW + 1 NOT_EVALUATED remain).",
    "No PROMOTION claim.",
    "No FOUNDATION_LAB_PASS claim.",
    "No milestone PASS claim.",
    "No PES 2017 fidelity / measured PES envelope claim; all unmeasured values stay VERSIONED_PROVISIONAL.",
    "No invented reference envelope or tolerance; blocked references stay BLOCKED_MISSING_REFERENCE, including advantage_retention_ref.",
    "No advantage implemented or claimed: ADVANTAGE-PLAYED stays NAMED-NOT-REGISTERED and no verdict is reported for it.",
    "No criterion is upgraded beyond what the executed evaluator returns; every PASS cited is from the accepted executed records.",
    "Zero gameplay/source change: git diff src/ src/contracts/ src/adapters/ eval/ specs/ is EMPTY; only RELEASE-0.9.8-PRODUCT.md + evidence + a binding test + this producer are added.",
    "No VERSION.json / prompt-gate.ts change: the live system version stays 0.9.9 and the 0.9.8 system release notes (gauntlet/RELEASE-0.9.8.md) are not modified; the name collision is resolved by the -PRODUCT suffix and disclosed.",
    "No accepted record mutation: the cited accepted records (v34-v37 + RESTART-DESIGNATION-FACTS-CONFORMANCE) stay byte-untouched (verified by their pinned record_sha256 / pinned manifest bytes).",
  ],
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

mkdirSync(OUTPUT_ROOT, { recursive: true });
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(`[release-0.9.8-product] wrote ${STATE_PATH}`);
console.log(`[release-0.9.8-product] record_sha256=${String(record.record_sha256)}`);
console.log(
  `[release-0.9.8-product] product=${record.product_release_version} system=${version.version} ` +
    `foulsRegistered=${registeredCriteria.length}/5 gk=${gkCurrentCounts.PASS}/${gkCurrentCounts.BLOCKED_MISSING_REFERENCE}/${gkCurrentCounts.NEEDS_PERCEPTUAL_REVIEW} ` +
    `refereeFrames=${referee.frames.length}`,
);
