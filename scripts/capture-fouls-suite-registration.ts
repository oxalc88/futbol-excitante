/**
 * Node-side evidence producer for FOULS-SUITE-REGISTRATION.
 *
 * Registers the FOULS_CARDS_SPEC §10 criteria the accepted detection machinery
 * makes answerable — FOUL-DETECT and FOUL-CLEAN-TACKLE — as executable protected
 * oracles over a `fouls` evaluator suite (suite-fouls-v1), and records the
 * executed per-criterion verdicts over the ACCEPTED detection streams:
 *
 *   - `driven-foul-live`: the proximate 5v5 human-vs-CPU match driven by the
 *     accepted defensive-duel-driver with a scripted standing tackle. The pure
 *     `detectFoulEvents` read emits one genuine `foul` event.
 *   - `organic-foul-live`: the coherent 3v3 CPU-vs-CPU match (3v3-press) under
 *     `cpuDefensiveTackle:true` + `detectFouls:true` (the runner gate) — one
 *     organic `foul` event.
 *   - `organic-foul-stashed`: the SAME organic match with `detectFouls:false` —
 *     the gate-off negative control (0 emitted `foul` events).
 *
 * The `fouls` suite is evaluated over each stream via
 * `evaluateSuite("fouls", observations)`.  The suite registers only FOUL-DETECT
 * and FOUL-CLEAN-TACKLE; CARD-ISSUED / ADVANTAGE-PLAYED / FREE-KICK-AWARD stay
 * named-but-unregistered and no verdict is reported for them (no machinery).
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:FOULS-SUITE-REGISTRATION`. An ordinary run writes the
 * same artifacts under the ignored `test-results/gauntlet-capture/**` tree and
 * leaves `docs/` byte-identical. The record carries NO wall-clock field, so
 * consecutive ordinary-mode runs are byte-identical and the pinned
 * `record_sha256` is stable.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:FOULS-SUITE-REGISTRATION \
 *     mise exec -- pnpm exec tsx scripts/capture-fouls-suite-registration.ts
 *
 * Node I/O is allowed here; the simulation core is untouched.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { runDefensiveDuel } from "../eval/runners/defensive-duel-driver.js";
import { detectFoulEvents, countFoulEvents } from "../eval/runners/foul-detection.js";
import { evaluateSuite } from "../eval/runners/foundation-evaluator.js";
import { withProximateHumanDefence } from "../eval/scenarios/proximate-5v5.js";
import type { TelemetryObservation } from "../src/contracts/telemetry.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "FOULS-SUITE-REGISTRATION";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");
const STATE_PATH = resolve(OUTPUT_ROOT, "fouls-suite-registration.json");

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

function countKinds(observations: TelemetryObservation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of observations) for (const ev of o.events) counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
  return counts;
}

/** All `foul` events in a stream, with their emitted payloads (for audit). */
function foulEvents(observations: TelemetryObservation[]): Array<{
  tick: number;
  id: string;
  sourceEventId: string;
  payload: Record<string, unknown>;
}> {
  const out: Array<{ tick: number; id: string; sourceEventId: string; payload: Record<string, unknown> }> = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "foul") continue;
      out.push({
        tick: ev.tick,
        id: ev.id,
        sourceEventId: (ev.payload as Record<string, unknown>)?.sourceEventId as string,
        payload: (ev.payload ?? {}) as Record<string, unknown>,
      });
    }
  }
  return out;
}

/** Validate an emitted `foul` payload against the FOULS_CARDS_SPEC §5.1 fields. */
function validateFoulPayload(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (payload.contactType !== "standing-tackle" && payload.contactType !== "slide-tackle")
    errors.push("contactType must be standing-tackle | slide-tackle");
  if (payload.tacklePhase !== "active") errors.push("tacklePhase must be active");
  if (payload.duelWon !== false) errors.push("duelWon must be false");
  if (payload.ballReachable !== false) errors.push("ballReachable must be false");
  for (const key of ["playerIdA", "playerIdB", "teamIdA", "teamIdB", "sourceEventId"]) {
    if (typeof payload[key] !== "string") errors.push(`${key} must be a string`);
  }
  for (const key of ["attemptStartTick", "activeWindowStartTick", "activeWindowEndTick", "reach", "planarDistance"]) {
    if (typeof payload[key] !== "number") errors.push(`${key} must be a number`);
  }
  return errors;
}

interface RunRecord {
  id: string;
  role: string;
  scenario: string;
  scenario_path: string;
  ticks: number;
  detect_fouls: boolean;
  reproduction: string;
  observation_count: number;
  event_kind_counts: Record<string, number>;
  player_player_contact_count: number;
  foul_count: number;
  foul_events: Array<{ tick: number; id: string; sourceEventId: string; payload: Record<string, unknown> }>;
  foul_payload_validation: { errors: string[]; valid: boolean };
  determinism: {
    state_hash_of_hashes: string;
    final_state_hash: string | null;
  };
  suite_verdict: ReturnType<typeof evaluateSuite>;
  stash_identity?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Driven stream (defensive-duel-driver + pure detection read)
// ---------------------------------------------------------------------------

function drivenRecord(): RunRecord {
  const scenario = withProximateHumanDefence(
    loadScenario("eval/scenarios/5v5-human-vs-cpu.v1.json"),
  );
  const result = runDefensiveDuel({
    scenario,
    maxTicks: 120,
    attempts: [{ kind: "standing", commitDistance: 3.0, earliestTick: 48 }],
  });
  const detected = detectFoulEvents(result.observations);
  const counts = countKinds(result.observations);
  const fouls = foulEvents(result.observations);
  const validation = fouls.length
    ? { errors: validateFoulPayload(fouls[0].payload), valid: validateFoulPayload(fouls[0].payload).length === 0 }
    : { errors: ["no foul emitted"], valid: false };
  const hashOfHashes = sha256(JSON.stringify(result.stateHashes));
  const suiteVerdict = evaluateSuite("fouls", result.observations);
  console.log(
    `[fouls-suite] driven-foul-live: ticks=${result.stateHashes.length}` +
      ` hashOfHashes=${hashOfHashes.slice(0, 20)} fouls=${detected}` +
      ` ppc=${counts["player-player-contact"] ?? 0}`,
  );
  return {
    id: "driven-foul-live",
    role:
      "proximate 5v5 human-vs-CPU (defensive-duel-driver) with a scripted standing tackle at " +
      "earliestTick 48: the committed contact is a man-not-ball tackle (duelWon false, " +
      "ballReachable false, tacklePhase active) — a genuine foul candidate. The pure " +
      "detectFoulEvents read emits the `foul` event, and the registered `fouls` suite " +
      "evaluates over the committed stream.",
    scenario: scenario.id,
    scenario_path: "eval/scenarios/5v5-human-vs-cpu.v1.json (withProximateHumanDefence)",
    ticks: result.stateHashes.length,
    detect_fouls: true,
    reproduction:
      `runDefensiveDuel({ scenario: withProximateHumanDefence(load("eval/scenarios/5v5-human-vs-cpu.v1.json")), ` +
      `maxTicks: 120, attempts: [{ kind: "standing", commitDistance: 3.0, earliestTick: 48 }] }) ` +
      `+ detectFoulEvents(observations) + evaluateSuite("fouls", observations)`,
    observation_count: result.observations.length,
    event_kind_counts: counts,
    player_player_contact_count: counts["player-player-contact"] ?? 0,
    foul_count: detected,
    foul_events: fouls,
    foul_payload_validation: validation,
    determinism: {
      state_hash_of_hashes: hashOfHashes,
      final_state_hash: result.stateHashes[result.stateHashes.length - 1] ?? null,
    },
    suite_verdict: suiteVerdict,
  };
}

// ---------------------------------------------------------------------------
// Organic stream (runHeadlessMatch gate) + stash-identity control
// ---------------------------------------------------------------------------

const ORGANIC_SCENARIO_PATH = "eval/scenarios/3v3-press-scenario.v1.json";
const ORGANIC_TICKS = 600;
// Pre-change baseline captured with the unmodified runner (identical scenario /
// config): `runHeadlessMatch` with cpuDefensiveTackle:true, lifecycle "legacy".
// This is the byte-identity anchor the stash control must reproduce.
const BASELINE_HASH_OF_HASHES =
  "fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a";

function organicRun(detectFouls: boolean): ReturnType<typeof runHeadlessMatch> {
  return runHeadlessMatch({
    scenario: loadScenario(ORGANIC_SCENARIO_PATH),
    maxTicks: ORGANIC_TICKS,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "legacy",
    cpuDefensiveTackle: true,
    detectFouls,
  });
}

function organicRecord(spec: { id: string; gated: boolean; role: string }, gatedOther?: RunRecord): RunRecord {
  const result = organicRun(spec.gated);
  const counts = countKinds(result.observations);
  const hashOfHashes = sha256(JSON.stringify(result.stateHashes));
  const fouls = foulEvents(result.observations);
  const validation = fouls.length
    ? { errors: validateFoulPayload(fouls[0].payload), valid: validateFoulPayload(fouls[0].payload).length === 0 }
    : { errors: ["no foul emitted"], valid: false };
  const suiteVerdict = evaluateSuite("fouls", result.observations);
  const record: RunRecord = {
    id: spec.id,
    role: spec.role,
    scenario: ORGANIC_SCENARIO_PATH,
    scenario_path: ORGANIC_SCENARIO_PATH,
    ticks: result.stateHashes.length,
    detect_fouls: spec.gated,
    reproduction:
      `runHeadlessMatch({ scenario: load("${ORGANIC_SCENARIO_PATH}"), maxTicks: ${ORGANIC_TICKS}, ` +
      `cpuAntiHuddle: true, lifecyclePhaseSync: "legacy", cpuDefensiveTackle: true, detectFouls: ${spec.gated} }) ` +
      `+ evaluateSuite("fouls", observations)`,
    observation_count: result.observations.length,
    event_kind_counts: counts,
    player_player_contact_count: counts["player-player-contact"] ?? 0,
    foul_count: countFoulEvents(result.observations),
    foul_events: fouls,
    foul_payload_validation: validation,
    determinism: {
      state_hash_of_hashes: hashOfHashes,
      final_state_hash: result.stateHashes[result.stateHashes.length - 1] ?? null,
    },
    suite_verdict: suiteVerdict,
  };
  if (!spec.gated) {
    record.stash_identity = {
      injected_foul_events: countFoulEvents(result.observations),
      gated_on_state_hash_of_hashes: gatedOther?.determinism.state_hash_of_hashes,
      state_hash_chain_identical: gatedOther
        ? hashOfHashes === gatedOther.determinism.state_hash_of_hashes
        : undefined,
      byte_identical_to_pre_change_baseline: hashOfHashes === BASELINE_HASH_OF_HASHES,
      baseline_hash_of_hashes: BASELINE_HASH_OF_HASHES,
    };
  }
  console.log(
    `[fouls-suite] ${spec.id}: ticks=${record.ticks} gated=${spec.gated}` +
      ` hashOfHashes=${hashOfHashes.slice(0, 20)} fouls=${record.foul_count}` +
      ` ppc=${record.player_player_contact_count}`,
  );
  return record;
}

// ---------------------------------------------------------------------------
// Artifact assembly
// ---------------------------------------------------------------------------

mkdirSync(OUTPUT_ROOT, { recursive: true });

const driven = drivenRecord();
const organicLive = organicRecord({
  id: "organic-foul-live",
  gated: true,
  role:
    "coherent 3v3 CPU-vs-CPU (3v3-press) with cpuDefensiveTackle:true and the runner gate " +
    "detectFouls:true — a real man-not-ball contact emerges organically and is emitted as a `foul` event.",
});
const organicStashed = organicRecord({
  id: "organic-foul-stashed",
  gated: false,
  role:
    "the SAME organic match with detectFouls:false — stash-identity control: state-hash chain " +
    "identical to the gated run, 0 injected `foul` events, byte-identical to the pre-change baseline.",
}, organicLive);

const allRuns = [driven, organicLive, organicStashed];

const trajectoryArtifact: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
  produced_by: "scripts/capture-fouls-suite-registration.ts",
  driver:
    "eval/runners/headless-match.ts with cpuDefensiveTackle:true, lifecyclePhaseSync:'legacy', " +
    "and the gated detectFouls observation extension (FOUL-DETECTION-MACHINERY); plus the driven " +
    "proximate-5v5 stream via the accepted defensive-duel-driver with the pure detectFoulEvents read. " +
    "Each stream is evaluated with the registered `fouls` suite (evaluateSuite('fouls', observations)).",
  activation: {
    field: "evaluateSuite('fouls', observations) over the committed detection streams",
    meaning:
      "the registered `fouls` suite (suite-fouls-v1) evaluates FOUL-DETECT and FOUL-CLEAN-TACKLE over " +
      "the observation streams produced by the accepted detection machinery. FOUL-DETECT validates the " +
      "spec §5.1 definition of every emitted `foul` event; FOUL-CLEAN-TACKLE validates the §5.2 complement " +
      "(clean tackles / symmetric shoulder contacts emit no foul). CARD-ISSUED / ADVANTAGE-PLAYED / " +
      "FREE-KICK-AWARD are named-but-unregistered (no machinery) and are not evaluated.",
    set_by: [
      "eval/contracts/suites.ts FOULS_SUITE (suite-fouls-v1)",
      "eval/contracts/bindings.ts BINDING_FOULS_DETECT_001 / BINDING_FOULS_CLEAN_TACKLE_001",
      "eval/oracles/fouls.ts checkFoulDetect / checkFoulCleanTackle",
      "eval/runners/foundation-evaluator.ts CRITERION_TO_ORACLE",
      "NOT the browser composition root",
    ],
  },
  disclosures: [
    "Only FOUL-DETECT and FOUL-CLEAN-TACKLE are registered as executable protected oracles. CARD-ISSUED, ADVANTAGE-PLAYED and FREE-KICK-AWARD remain NAMED-BUT-UNREGISTERED (no machinery) — no criterion, oracle, invariant, binding or verdict accompanies them, and the suite never claims a PASS for them.",
    "The suite is partial (2 of the 5 §10 criteria are registered) so NO suite-level PASS is claimed; verdicts are reported per criterion and per stream.",
    "FOUL-DETECT and FOUL-CLEAN-TACKLE return NOT_EVALUATED (via the shared computeOutcome on an empty result) on streams with no emitted `foul` event — honest absence semantics. The stashed gate-off control (0 fouls) therefore does not PASS anything.",
    "The detection predicate and the producer are untouched: eval/runners/foul-detection.ts is unchanged, and git diff src/ and src/contracts/ is empty. The suite is an additive read over the already-committed detection streams.",
    "No PES 2017 fidelity, no invented reference envelope, no fouls-v1 constant is consumed; the oracles read only the committed event payload structure and the §5.1/§5.2 complement.",
  ],
  runs: allRuns,
};

// ---------------------------------------------------------------------------
// State record (byte-reproducible, no wall-clock field in the hash)
// ---------------------------------------------------------------------------

const claimsNotMade = [
  "No suite-level PASS: the fouls suite is new and partial (only FOUL-DETECT and FOUL-CLEAN-TACKLE are registered; the three remaining §10 criteria exist unimplemented).",
  "No card / advantage / free-kick machinery or verdict: CARD-ISSUED, ADVANTAGE-PLAYED and FREE-KICK-AWARD are named-but-unregistered (no machinery), and no verdict is reported for them.",
  "No PROMOTION claim.",
  "No FOUNDATION_LAB_PASS, milestone or regression PASS claim.",
  "No PES 2017 fidelity or invented reference envelope.",
  "No gameplay / source / contract / adapter / spec change: src/ and src/contracts/ are EMPTY and the detection producer (eval/runners/foul-detection.ts) is unchanged.",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  produced_by: "scripts/capture-fouls-suite-registration.ts",
  evidence_class: "MULTI_TICK",
  spec_sections: ["FOULS_CARDS_SPEC §4.2", "FOULS_CARDS_SPEC §5.1", "FOULS_CARDS_SPEC §5.2", "FOULS_CARDS_SPEC §10"],
  runs: allRuns.map((r) => ({
    id: r.id,
    role: r.role,
    scenario: r.scenario,
    scenario_path: r.scenario_path,
    ticks: r.ticks,
    detect_fouls: r.detect_fouls,
    reproduction: r.reproduction,
    observation_count: r.observation_count,
    event_kind_counts: r.event_kind_counts,
    player_player_contact_count: r.player_player_contact_count,
    foul_count: r.foul_count,
    foul_events: r.foul_events,
    foul_payload_validation: r.foul_payload_validation,
    determinism: r.determinism,
    suite_verdict: r.suite_verdict,
    ...(r.stash_identity ? { stash_identity: r.stash_identity } : {}),
  })),
  claims_not_made: claimsNotMade,
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectoryArtifact, null, 2)}\n`, "utf-8");
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(`[fouls-suite] wrote ${TRAJECTORY_PATH}`);
console.log(`[fouls-suite] wrote ${STATE_PATH}`);
console.log(`[fouls-suite] record_sha256=${String(record.record_sha256)}`);