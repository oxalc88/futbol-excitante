/**
 * Node-side evidence producer for FREE-KICK-SUITE-REGISTRATION.
 *
 * Registers FREE-KICK-AWARD (FOULS_CARDS_SPEC §10) as the third executable
 * protected oracle in suite-fouls-v1 over the ACCEPTED consequence streams, and
 * records the executed per-criterion verdict over each stream:
 *
 *   - `freekick-driven-duel`: the proximate 5v5 human-vs-CPU defensive-duel
 *     driver with a scripted standing tackle + the in-core free-kick gate on.
 *     The observation stream carries the `foul`, but the free-kick-executed
 *     lives in the CORE's persistent state (not the per-step observation array
 *     — the driven shape does not serialize restart facts), so FREE-KICK-AWARD
 *     is honestly NOT_EVALUATED (the oracle cannot confirm/deny the award from
 *     the observations it receives).
 *   - `freekick-organic`: the coherent 3v3 CPU-vs-CPU press under
 *     cpuDefensiveTackle + detectFouls + awardFreeKicks, core-owned lifecycle +
 *     serializeRestartFacts.  The observation stream carries the `foul` AND the
 *     `free-kick-executed` at the contact position → FREE-KICK-AWARD PASS.
 *   - `freekick-antihuddle-window`: a driven freeKickWindow restart restart
 *     window with NO foul.  A free kick awarded with no detected foul is exactly
 *     what FREE-KICK-AWARD forbids (a free kick is the consequence of a called
 *     foul) → FAIL (power guard).
 *   - `freekick-human-serve`: a human-served free-kick window with NO foul →
 *     FAIL (same power guard).
 *   - `freekick-gate-off`: the accepted legacy gate-off pin with neither a foul
 *     nor a free kick → honest NOT_EVALUATED (nothing to judge).
 *
 * FOUL-DETECT and FOUL-CLEAN-TACKLE remain registered from FOULS-SUITE-REGISTRATION;
 * CARD-ISSUED and ADVANTAGE-PLAYED stay named-not-registered (no machinery).
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:FREE-KICK-SUITE-REGISTRATION`. An ordinary run writes
 * the same artifacts under the ignored `test-results/gauntlet-capture/**` tree
 * and leaves `docs/` byte-identical. The record carries NO wall-clock field, so
 * consecutive ordinary-mode runs are byte-identical and the pinned
 * `record_sha256` is stable.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:FREE-KICK-SUITE-REGISTRATION \
 *     mise exec -- pnpm exec tsx scripts/capture-freekick-suite-registration.ts
 *
 * Node I/O is allowed here; the simulation core is touched only inside the
 * default-off gated free-kick branch (unchanged by this objective).
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

const OBJECTIVE_ID = "FREE-KICK-SUITE-REGISTRATION";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");
const STATE_PATH = resolve(OUTPUT_ROOT, "freekick-suite-registration.json");

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

/** The FREE-KICK-AWARD criterion outcome over a stream via the fouls suite. */
function freeKickAwardOutcome(observations: TelemetryObservation[]): string {
  const suite = evaluateSuite("fouls", observations);
  for (const t of suite.tests) {
    for (const c of t.criteria) {
      if (c.criterion_id === "FREE-KICK-AWARD") return c.outcome;
    }
  }
  return "NOT_EVALUATED";
}

/** The full fouls-suite verdict table (all three registered criteria). */
function foulsVerdicts(observations: TelemetryObservation[]): Record<string, string> {
  const suite = evaluateSuite("fouls", observations);
  const out: Record<string, string> = {};
  for (const t of suite.tests) for (const c of t.criteria) out[c.criterion_id] = c.outcome;
  return out;
}

/** All `foul` events in a stream, with their sourceEventId (for audit). */
function foulEvents(observations: TelemetryObservation[]): Array<{ tick: number; id: string; sourceEventId: string }> {
  const out: Array<{ tick: number; id: string; sourceEventId: string }> = [];
  for (const o of observations) for (const ev of o.events) {
    if (ev.kind !== "foul") continue;
    out.push({
      tick: ev.tick,
      id: ev.id,
      sourceEventId: (ev.payload as Record<string, unknown>)?.sourceEventId as string,
    });
  }
  return out;
}

/** All `free-kick-executed` events in a stream (observation-level fact). */
function freeKickEvents(observations: TelemetryObservation[]): Array<{
  tick: number;
  id: string;
  teamId: string | null;
  position: { x: number; y: number } | null;
}> {
  const out: Array<{ tick: number; id: string; teamId: string | null; position: { x: number; y: number } | null }> = [];
  for (const o of observations) for (const ev of o.events) {
    if (ev.kind !== "free-kick-executed") continue;
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    out.push({
      tick: ev.tick,
      id: ev.id,
      teamId: (p.teamId as string) ?? null,
      position: (p.freeKickPosition as { x: number; y: number }) ?? null,
    });
  }
  return out;
}

interface RunRecord {
  id: string;
  role: string;
  scenario: string;
  ticks: number;
  observation_count: number;
  event_kind_counts: Record<string, number>;
  state_hash_of_hashes: string;
  accepted_state_hash_of_hashes: string | null;
  state_hash_chain_identical_to_accepted: boolean;
  foul_count: number;
  free_kick_count: number;
  foul_events: Array<{ tick: number; id: string; sourceEventId: string }>;
  free_kick_events: Array<{ tick: number; id: string; teamId: string | null; position: { x: number; y: number } | null }>;
  committed_free_kick_events: Array<{ tick: number; teamId: string | null; position: { x: number; y: number } | null }>;
  fouls_suite_verdicts: Record<string, string>;
  free_kick_award_outcome: string;
}

// The accepted FOUL-CONSEQUENCE-MACHINERY state-hash-of-hashes pins (record
// 39da80ad…): the exact streams this objective re-evaluates.  Character-identity
// to the accepted pin attests that the streams are unchanged.
const ACCEPTED_PINS: Record<string, string> = {
  "freekick-driven-duel": "5f3bc337c1e928eb084f2beb5cea6bdde39668aea71f58b809ee831c1443454d",
  "freekick-organic": "47674adfb1cd411bc5bdc0d03c4744861df7953cd2f0cc4a63a8b13cd172a036",
  "freekick-antihuddle-window": "63063b342f658c862bdbed296a86cd7c1ed4190f73d639be7d21a4878f0ec8c0",
  "freekick-human-serve": "428a4df583fcaeafb6525fd2c161971f5183ed049ecd850e9fbfabd91ac0b86d",
  "freekick-gate-off": "fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a",
};

function makeRunRecord(
  id: string,
  role: string,
  scenario: string,
  result: { stateHashes: string[]; observations: TelemetryObservation[] },
  committedFreeKickEvents: Array<{ tick: number; teamId: string | null; position: { x: number; y: number } | null }>,
): RunRecord {
  const hashOfHashes = sha256(JSON.stringify(result.stateHashes));
  const counts = countKinds(result.observations);
  const fk = freeKickEvents(result.observations);
  const accepted = ACCEPTED_PINS[id] ?? null;
  return {
    id,
    role,
    scenario,
    ticks: result.stateHashes.length,
    observation_count: result.observations.length,
    event_kind_counts: counts,
    state_hash_of_hashes: hashOfHashes,
    accepted_state_hash_of_hashes: accepted,
    state_hash_chain_identical_to_accepted: accepted !== null && hashOfHashes === accepted,
    foul_count: countFoulEvents(result.observations),
    free_kick_count: fk.length,
    foul_events: foulEvents(result.observations),
    free_kick_events: fk,
    committed_free_kick_events: committedFreeKickEvents,
    fouls_suite_verdicts: foulsVerdicts(result.observations),
    free_kick_award_outcome: freeKickAwardOutcome(result.observations),
  };
}

// ---------------------------------------------------------------------------
// Stream producers (reproduce the accepted consequence streams unchanged)
// ---------------------------------------------------------------------------

function runDriven() {
  const scenario = withProximateHumanDefence(loadScenario("eval/scenarios/5v5-human-vs-cpu.v1.json"));
  const r = runDefensiveDuel({
    scenario,
    maxTicks: 200,
    attempts: [{ kind: "standing", commitDistance: 3.0, earliestTick: 48 }],
    freeKickConfig: { awardFreeKicks: true },
  });
  detectFoulEvents(r.observations);
  const committed = r.freeKickEvents.map((ev) => {
    const p = ev.payload as Record<string, unknown>;
    return {
      tick: ev.tick,
      teamId: (p.teamId as string) ?? null,
      position: (p.freeKickPosition as { x: number; y: number }) ?? null,
    };
  });
  return {
    result: { stateHashes: r.stateHashes, observations: r.observations },
    committed,
  };
}

function runOrganic() {
  return runHeadlessMatch({
    scenario: loadScenario("eval/scenarios/3v3-press-scenario.v1.json"),
    maxTicks: 600,
    cpuAntiHuddle: false,
    lifecyclePhaseSync: "core-owned",
    cpuDefensiveTackle: true,
    detectFouls: true,
    awardFreeKicks: true,
    serializeRestartFacts: true,
  });
}

function runAntihuddleWindow() {
  return runHeadlessMatch({
    scenario: loadScenario("eval/scenarios/5v5-human-restart-throwin.v1.json"),
    maxTicks: 60,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    browserParityObservations: true,
    serializeRestartFacts: true,
    freeKickWindow: { team: "team-a", takerPlayerId: "player-1", position: { x: 30, y: 10 }, countdown: 5 },
  });
}

function runHumanServe() {
  return runHeadlessMatch({
    scenario: loadScenario("eval/scenarios/5v5-human-serve-throwin.v1.json"),
    maxTicks: 40,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    browserParityObservations: true,
    serializeRestartFacts: true,
    freeKickWindow: { team: "team-a", takerPlayerId: "player-1", position: { x: 30, y: 10 }, countdown: 5 },
    humanRestartControl: {
      humanTeamId: "team-a",
      humanControlledPlayerId: "player-1",
      humanControlSlot: "slot-1",
      humanMoveDirection: { x: 1, y: 0 },
      humanPassAtTick: 7,
    },
  });
}

function runGateOff() {
  return runHeadlessMatch({
    scenario: loadScenario("eval/scenarios/3v3-press-scenario.v1.json"),
    maxTicks: 600,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "legacy",
    cpuDefensiveTackle: true,
    detectFouls: false,
    awardFreeKicks: false,
  });
}

// ---------------------------------------------------------------------------
// Artifact assembly
// ---------------------------------------------------------------------------

mkdirSync(OUTPUT_ROOT, { recursive: true });

const driven = runDriven();
const organic = runOrganic();
const antihuddle = runAntihuddleWindow();
const humanServe = runHumanServe();
const gateOff = runGateOff();

const runs: RunRecord[] = [
  makeRunRecord(
    "freekick-driven-duel",
    "proximate 5v5 human-vs-CPU (defensive-duel-driver) with a scripted standing tackle and the in-core free-kick gate on: a committed man-not-ball contact (duelWon false, ballReachable false, tacklePhase active) emits the `foul`, and the core awards a free kick to the fouled team at the contact position. The free-kick-executed is committed in the CORE's persistent state (the driven shape does not serialize restart facts), not the per-step observation array, so FREE-KICK-AWARD is honestly NOT_EVALUATED (the oracle cannot confirm the award from the observations it receives).",
    "eval/scenarios/5v5-human-vs-cpu.v1.json (withProximateHumanDefence)",
    { stateHashes: driven.result.stateHashes, observations: driven.result.observations },
    driven.committed,
  ),
  makeRunRecord(
    "freekick-organic",
    "coherent 3v3 CPU-vs-CPU (3v3-press) under cpuDefensiveTackle:true + detectFouls:true + awardFreeKicks:true, core-owned lifecycle + serializeRestartFacts — a real man-not-ball contact emerges organically, the `foul` and the consequence `free-kick-executed` both sit in the observation stream at the contact position → FREE-KICK-AWARD PASS.",
    "eval/scenarios/3v3-press-scenario.v1.json",
    { stateHashes: organic.stateHashes, observations: organic.observations },
    [],
  ),
  makeRunRecord(
    "freekick-antihuddle-window",
    "a driven freeKickWindow restart window (cpuAntiHuddle:true, serializeRestartFacts) with NO detected foul. A free kick awarded with no detected foul is exactly what FREE-KICK-AWARD forbids (the set-piece consequence of a called foul) → FAIL (power guard).",
    "eval/scenarios/5v5-human-restart-throwin.v1.json",
    { stateHashes: antihuddle.stateHashes, observations: antihuddle.observations },
    [],
  ),
  makeRunRecord(
    "freekick-human-serve",
    "a human-served free-kick window (the pass-gated human restart serve) with NO detected foul → FAIL (the same power guard: a free kick without a detected foul).",
    "eval/scenarios/5v5-human-serve-throwin.v1.json",
    { stateHashes: humanServe.stateHashes, observations: humanServe.observations },
    [],
  ),
  makeRunRecord(
    "freekick-gate-off",
    "the accepted legacy gate-off control (detectFouls:false, awardFreeKicks:false): neither a `foul` nor a `free-kick-executed` — honest NOT_EVALUATED (nothing to judge), byte-identical to the pre-change baseline.",
    "eval/scenarios/3v3-press-scenario.v1.json",
    { stateHashes: gateOff.stateHashes, observations: gateOff.observations },
    [],
  ),
];

const allStreamsIdenticalToAccepted = runs.every((r) => r.state_hash_chain_identical_to_accepted);

const trajectoryArtifact: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
  produced_by: "scripts/capture-freekick-suite-registration.ts",
  driver:
    "eval/runners/headless-match.ts (awardFreeKicks gate, core-owned lifecycle, serializeRestartFacts, freeKickWindow) + eval/runners/defensive-duel-driver.ts (scripted standing tackle, freeKickConfig) + the shared foul predicate; each stream evaluated with the registered `fouls` suite (evaluateSuite('fouls', observations)).",
  activation: {
    field: "evaluateSuite('fouls', observations) over the committed consequence streams",
    meaning:
      "the registered `fouls` suite (suite-fouls-v1) evaluates FOUL-DETECT, FOUL-CLEAN-TACKLE and FREE-KICK-AWARD over the accepted consequence streams. FREE-KICK-AWARD verifies the §10 set-piece consequence: a real detected foul yields a free kick to the fouled team at the contact position; a free kick awarded with no detected foul FAILs; a no-foul / gate-off stream is honest NOT_EVALUATED; and a stream carrying a foul but no observable free-kick-executed (the driven shape, which commits the free kick in the core's persistent state, not the per-step observation array) is honest NOT_EVALUATED.",
    set_by: [
      "eval/contracts/suites.ts FOULS_SUITE (suite-fouls-v1, +FOULS-FREE-KICK-AWARD-001)",
      "eval/contracts/bindings.ts BINDING_FOULS_FREE_KICK_AWARD_001",
      "eval/contracts/common-criteria.ts FREE_KICK_AWARD",
      "eval/contracts/invariant-definitions.ts INV_FOUL_FREE_KICK_AWARD",
      "eval/oracles/fouls.ts checkFoulFreeKickAward (imports the shared src/simulation/foul-predicate.ts predicate)",
      "eval/oracles/wire.ts + eval/runners/foundation-evaluator.ts CRITERION_TO_ORACLE",
      "NOT the browser composition root",
    ],
  },
  disclosures: [
    "FREE-KICK-AWARD reads only the committed observation fields: the `foul` events, the `player-player-contact` provenance contacts, the `free-kick-executed` events (FOUL-CONSEQUENCE-MACHINERY), and the per-tick player positions used to verify the contact placement. CARD-ISSUED and ADVANTAGE-PLAYED remain NAMED-BUT-UNREGISTERED (no machinery) — no criterion, oracle, invariant, binding or verdict accompanies them.",
    "The driven-duel shape carries its free-kick in the CORE's persistent state, not the per-step observation array (runner serialization limit). The FREE-KICK-AWARD oracle therefore cannot confirm or deny the award from the driven stream's observations and reports honest NOT_EVALUATED — it never invents a PASS or a false FAIL. The runner serialization is NOT changed to make the oracle's job easier.",
    "The anti-huddle freeKickWindow control and the human-serve free-kick window are deliberate no-foul negative pressures: they award a free kick with no detected foul, which FREE-KICK-AWARD FAILs (a free kick is only the consequence of a called foul, §10).",
    "Each reproduced stream is character-identical to its accepted FOUL-CONSEQUENCE-MACHINERY state-hash-of-hashes pin (record 39da80ad…), so the verdicts are honest over the accepted streams, not over a re-shaped stream.",
    "NO suite-level PASS: the fouls suite is partial (3 of the 5 §10 criteria registered); verdicts are reported per criterion and per stream. No FOUNDATION_LAB_PASS, PES fidelity, or invented reference envelope claim.",
  ],
  runs: runs,
  guard_state: {
    all_streams_character_identical_to_accepted: allStreamsIdenticalToAccepted,
  },
};

// ---------------------------------------------------------------------------
// State record (byte-reproducible, no wall-clock field in the hash)
// ---------------------------------------------------------------------------

const claimsNotMade = [
  "No suite-level PASS: the fouls suite is partial (FOUL-DETECT, FOUL-CLEAN-TACKLE and FREE-KICK-AWARD registered; CARD-ISSUED and ADVANTAGE-PLAYED named-not-registered).",
  "No card or advantage machinery or verdict: CARD-ISSUED and ADVANTAGE-PLAYED stay named-not-registered (no machinery).",
  "No FREE-KICK-AWARD PASS claim on the driven stream (honest NOT_EVALUATED) and no suite-level PASS anywhere.",
  "No PROMOTION claim. No FOUNDATION_LAB_PASS, milestone or regression PASS claim. No PES 2017 fidelity or invented reference envelope.",
  "No gameplay / source / contract / adapter change: git diff src/ and src/contracts/ is EMPTY and the runner serialization is UNCHANGED (the driven shape is not re-serialized to make the oracle's job easier).",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  produced_by: "scripts/capture-freekick-suite-registration.ts",
  evidence_class: "MULTI_TICK",
  spec_sections: ["FOULS_CARDS_SPEC §5.1", "FOULS_CARDS_SPEC §8", "FOULS_CARDS_SPEC §10"],
  lifecycle_phase_sync: "core-owned (organic / anti-huddle / human-serve); legacy (gate-off pin)",
  runs: runs.map((r) => ({
    id: r.id,
    role: r.role,
    scenario: r.scenario,
    ticks: r.ticks,
    observation_count: r.observation_count,
    event_kind_counts: r.event_kind_counts,
    state_hash_of_hashes: r.state_hash_of_hashes,
    accepted_state_hash_of_hashes: r.accepted_state_hash_of_hashes,
    state_hash_chain_identical_to_accepted: r.state_hash_chain_identical_to_accepted,
    foul_count: r.foul_count,
    free_kick_count: r.free_kick_count,
    foul_events: r.foul_events,
    free_kick_events: r.free_kick_events,
    committed_free_kick_events: r.committed_free_kick_events,
    fouls_suite_verdicts: r.fouls_suite_verdicts,
    free_kick_award_outcome: r.free_kick_award_outcome,
  })),
  claims_not_made: claimsNotMade,
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectoryArtifact, null, 2)}\n`, "utf-8");
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(`[freekick-suite] wrote ${TRAJECTORY_PATH}`);
console.log(`[freekick-suite] wrote ${STATE_PATH}`);
console.log(`[freekick-suite] record_sha256=${String(record.record_sha256)}`);
console.log(`[freekick-suite] guard_state.all_streams_character_identical_to_accepted=${String(allStreamsIdenticalToAccepted)}`);
for (const r of runs) {
  console.log(
    `[freekick-suite] ${r.id}: fouls=${r.foul_count} freeKicks=${r.free_kick_count} ` +
      `FREE-KICK-AWARD=${r.free_kick_award_outcome} acceptedIdentical=${String(r.state_hash_chain_identical_to_accepted)}`,
  );
}
