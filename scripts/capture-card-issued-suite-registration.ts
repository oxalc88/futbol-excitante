/**
 * Node-side evidence producer for CARD-ISSUED-SUITE-REGISTRATION.
 *
 * Registers CARD-ISSUED (FOULS_CARDS_SPEC §10) as the fourth executable
 * protected oracle in suite-fouls-v1 over the ACCEPTED card streams, and records
 * the executed per-criterion verdict over each stream:
 *
 *   - `card-driven-duel`: the proximate 5v5 human-vs-CPU defensive-duel driver
 *     with repeated scripted standing tackles and the in-core card gate on
 *     (issueCards).  The observation stream carries the `foul` events, but the
 *     card-issued events live in the core's committed state (the driven shape
 *     does not serialize restart facts / committed events into the per-step
 *     observation array), so CARD-ISSUED is honestly NOT_EVALUATED (the oracle
 *     cannot confirm or deny the card from the observations it receives).
 *   - `card-combined`: the same driven shape with BOTH the free-kick and the
 *     card gate on.  The cards are again commit-only → CARD-ISSUED NOT_EVALUATED.
 *   - `card-organic`: the coherent 3v3 CPU-vs-CPU press with detectFouls +
 *     issueCards + serializeRestartFacts.  Only one man-not-ball foul emerges
 *     (below the caution threshold), so no card-issued is committed and the
 *     observation stream carries none → CARD-ISSUED NOT_EVALUATED (honest
 *     below-threshold no-card; the oracle cannot observe the accumulation).
 *   - `card-gate-off`: the accepted legacy gate-off pin with neither a foul nor
 *     a card → CARD-ISSUED NOT_EVALUATED (nothing to judge).
 *
 * FOUL-DETECT, FOUL-CLEAN-TACKLE and FREE-KICK-AWARD remain registered from the
 * prior suite registrations; ADVANTAGE-PLAYED stays named-not-registered (no
 * advantage machinery).
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:CARD-ISSUED-SUITE-REGISTRATION`. An ordinary run
 * writes the same artifacts under the ignored `test-results/gauntlet-capture/**`
 * tree and leaves `docs/` byte-identical. The record carries NO wall-clock
 * field, so consecutive ordinary-mode runs are byte-identical and the pinned
 * `record_sha256` is stable.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:CARD-ISSUED-SUITE-REGISTRATION \
 *     mise exec -- pnpm exec tsx scripts/capture-card-issued-suite-registration.ts
 *
 * Node I/O is allowed here; the simulation core is touched only inside the
 * default-off gated card branch (unchanged by this objective).
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

const OBJECTIVE_ID = "CARD-ISSUED-SUITE-REGISTRATION";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");
const STATE_PATH = resolve(OUTPUT_ROOT, "card-issued-suite-registration.json");

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

/** The CARD-ISSUED criterion outcome over a stream via the fouls suite. */
function cardIssuedOutcome(observations: TelemetryObservation[]): string {
  const suite = evaluateSuite("fouls", observations);
  for (const t of suite.tests) {
    for (const c of t.criteria) {
      if (c.criterion_id === "CARD-ISSUED") return c.outcome;
    }
  }
  return "NOT_EVALUATED";
}

/** The full fouls-suite verdict table (all four registered criteria). */
function foulsVerdicts(observations: TelemetryObservation[]): Record<string, string> {
  const suite = evaluateSuite("fouls", observations);
  const out: Record<string, string> = {};
  for (const t of suite.tests) for (const c of t.criteria) out[c.criterion_id] = c.outcome;
  return out;
}

/** All `card-issued` events in the observation stream (the fact the oracle reads). */
function cardIssuedEvents(observations: TelemetryObservation[]): Array<{
  tick: number;
  id: string;
  cardType: string;
  playerId: string;
  accumulatedFouls: number;
  foulSourceEventId: string;
}> {
  const out: Array<{
    tick: number;
    id: string;
    cardType: string;
    playerId: string;
    accumulatedFouls: number;
    foulSourceEventId: string;
  }> = [];
  for (const o of observations) for (const ev of o.events) {
    if (ev.kind !== "card-issued") continue;
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    out.push({
      tick: ev.tick,
      id: ev.id,
      cardType: (p.cardType as string) ?? "",
      playerId: (p.playerId as string) ?? "",
      accumulatedFouls: (p.accumulatedFouls as number) ?? NaN,
      foulSourceEventId: (p.foulSourceEventId as string) ?? "",
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
  card_count: number;
  card_events: Array<{ tick: number; id: string; cardType: string; playerId: string; accumulatedFouls: number; foulSourceEventId: string }>;
  fouls_suite_verdicts: Record<string, string>;
  card_issued_outcome: string;
}

// The accepted CARD-MACHINERY state-hash-of-hashes pins (record 01d731ad…): the
// exact streams this objective re-evaluates.  Character-identity to the accepted
// pin attests that the streams are unchanged.
const ACCEPTED_PINS: Record<string, string> = {
  "card-driven-duel": "a53e18277fec9da4469284420c333743061648791c7a0d2cecd5bc182886138b",
  "card-combined": "df5a1b00e383c3100bf77d4a562bbee273fa07ead163e6240d412632173d8b94",
  "card-organic": "88a08d2786a29c4dead92e4201d63fa5719f43f464938f1595c1f5cac83c243f",
  "card-gate-off": "fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a",
};

function makeRunRecord(
  id: string,
  role: string,
  scenario: string,
  result: { stateHashes: string[]; observations: TelemetryObservation[] },
): RunRecord {
  const hashOfHashes = sha256(JSON.stringify(result.stateHashes));
  const accepted = ACCEPTED_PINS[id] ?? null;
  const cards = cardIssuedEvents(result.observations);
  return {
    id,
    role,
    scenario,
    ticks: result.stateHashes.length,
    observation_count: result.observations.length,
    event_kind_counts: countKinds(result.observations),
    state_hash_of_hashes: hashOfHashes,
    accepted_state_hash_of_hashes: accepted,
    state_hash_chain_identical_to_accepted: accepted !== null && hashOfHashes === accepted,
    foul_count: countFoulEvents(result.observations),
    card_count: cards.length,
    card_events: cards,
    fouls_suite_verdicts: foulsVerdicts(result.observations),
    card_issued_outcome: cardIssuedOutcome(result.observations),
  };
}

// ---------------------------------------------------------------------------
// Stream producers (reproduce the accepted card streams unchanged)
// ---------------------------------------------------------------------------

// The same repeated-scripted-standing-tackle pattern the accepted
// CARD-MACHINERY the driven streams use (t = 44..400 step 16, max 420 ticks).
const DRIVEN_ATTEMPTS: Array<{ kind: "standing"; commitDistance: number; earliestTick: number }> = [];
for (let t = 44; t <= 400; t += 16) {
  DRIVEN_ATTEMPTS.push({ kind: "standing", commitDistance: 3.0, earliestTick: t });
}

function runDriven(cardOnly: boolean): ReturnType<typeof runDefensiveDuel> {
  const scenario = withProximateHumanDefence(loadScenario("eval/scenarios/5v5-human-vs-cpu.v1.json"));
  return runDefensiveDuel({
    scenario,
    maxTicks: 420,
    attempts: DRIVEN_ATTEMPTS,
    freeKickConfig: cardOnly ? undefined : { awardFreeKicks: true },
    cardConfig: { issueCards: true },
  });
}

function runOrganic(): ReturnType<typeof runHeadlessMatch> {
  return runHeadlessMatch({
    scenario: loadScenario("eval/scenarios/3v3-press-scenario.v1.json"),
    maxTicks: 600,
    cpuAntiHuddle: false,
    lifecyclePhaseSync: "core-owned",
    cpuDefensiveTackle: true,
    detectFouls: true,
    issueCards: true,
    serializeRestartFacts: true,
  });
}

function runGateOff(): ReturnType<typeof runHeadlessMatch> {
  return runHeadlessMatch({
    scenario: loadScenario("eval/scenarios/3v3-press-scenario.v1.json"),
    maxTicks: 600,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "legacy",
    cpuDefensiveTackle: true,
    detectFouls: false,
    awardFreeKicks: false,
    issueCards: false,
  });
}

// ---------------------------------------------------------------------------
// Artifact assembly
// ---------------------------------------------------------------------------

mkdirSync(OUTPUT_ROOT, { recursive: true });

const driven1 = runDriven(true);
const combined = runDriven(false);
detectFoulEvents(driven1.observations);
detectFoulEvents(combined.observations);
const organic = runOrganic();
const gateOff = runGateOff();

const runs: RunRecord[] = [
  makeRunRecord(
    "card-driven-duel",
    "proximate 5v5 human-vs-CPU (defensive-duel-driver) with repeated scripted standing tackles and the in-core card gate on (issueCards): player-1 accumulates 5 man-not-ball fouls and receives a caution at the 2nd and an expulsion at the 5th. The card-issued events are committed in the CORE's persistent state (the driven shape does not serialize committed events into the per-step observation array) and are exposed only via runDefensiveDuel.cardEvents, so CARD-ISSUED is honestly NOT_EVALUATED (the oracle cannot confirm the card from the observations it receives).",
    "eval/scenarios/5v5-human-vs-cpu.v1.json (withProximateHumanDefence)",
    { stateHashes: driven1.stateHashes, observations: driven1.observations },
  ),
  makeRunRecord(
    "card-combined",
    "the same driven shape with BOTH the free-kick gate (awardFreeKicks) and the card gate (issueCards) on. The caution and the free-kick-executed coexist on the committed foul tick, but the card-issued again lives in core committed state, not the per-step observation array → CARD-ISSUED NOT_EVALUATED.",
    "eval/scenarios/5v5-human-vs-cpu.v1.json (withProximateHumanDefence)",
    { stateHashes: combined.stateHashes, observations: combined.observations },
  ),
  makeRunRecord(
    "card-organic",
    "coherent 3v3 CPU-vs-CPU (3v3-press) under cpuDefensiveTackle:true + detectFouls:true + issueCards:true, core-owned lifecycle + serializeRestartFacts. One man-not-ball contact emerges organically (below the caution threshold), so no card-issued is committed and the observation stream carries none → CARD-ISSUED NOT_EVALUATED (honest below-threshold no-card; the oracle cannot observe the accumulation semantic).",
    "eval/scenarios/3v3-press-scenario.v1.json",
    { stateHashes: organic.stateHashes, observations: organic.observations },
  ),
  makeRunRecord(
    "card-gate-off",
    "the accepted legacy gate-off control (detectFouls:false, issueCards:false): neither a `foul` nor a `card-issued` — honest NOT_EVALUATED (nothing to judge), byte-identical to the pre-change baseline.",
    "eval/scenarios/3v3-press-scenario.v1.json",
    { stateHashes: gateOff.stateHashes, observations: gateOff.observations },
  ),
];

const allStreamsIdenticalToAccepted = runs.every((r) => r.state_hash_chain_identical_to_accepted);

const trajectoryArtifact: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
  produced_by: "scripts/capture-card-issued-suite-registration.ts",
  driver:
    "eval/runners/headless-match.ts (issueCards gate, core-owned lifecycle, serializeRestartFacts) + eval/runners/defensive-duel-driver.ts (scripted standing tackles, cardConfig) + the shared foul predicate and card-policy; each stream evaluated with the registered `fouls` suite (evaluateSuite('fouls', observations)).",
  activation: {
    field: "evaluateSuite('fouls', observations) over the committed card streams",
    meaning:
      "the registered `fouls` suite (suite-fouls-v1) evaluates FOUL-DETECT, FOUL-CLEAN-TACKLE, FREE-KICK-AWARD and CARD-ISSUED over the accepted card streams. CARD-ISSUED verifies the §7 / §9.1 accumulation semantics: a committed card-issued event must be the consequence of a genuine man-not-ball foul, awarded to the offending player, of the card type the card-policy warrants at the player's accumulated foul count. A card with no qualifying foul, to the wrong player, or of the wrong type FAILs; a stream that carries no observable card-issued event (below threshold, gate off, or a commit-only card the observation array does not carry) is honest NOT_EVALUATED.",
    set_by: [
      "eval/contracts/suites.ts FOULS_SUITE (suite-fouls-v1, +FOULS-CARD-ISSUED-001)",
      "eval/contracts/bindings.ts BINDING_FOULS_CARD_ISSUED_001",
      "eval/contracts/common-criteria.ts CARD_ISSUED",
      "eval/contracts/invariant-definitions.ts INV_FOUL_CARD_ISSUED",
      "eval/oracles/fouls.ts checkFoulCardIssued (imports the shared src/simulation/foul-predicate.ts predicate and src/simulation/card-policy.ts thresholds)",
      "eval/oracles/wire.ts + eval/runners/foundation-evaluator.ts CRITERION_TO_ORACLE",
      "NOT the browser composition root",
    ],
  },
  disclosures: [
    "CARD-ISSUED reads only the committed observation fields: the `card-issued` events, the `foul` events, and the `player-player-contact` provenance contacts. The card-issued event is commit-only to state.events; it surfaces into the observation stream only through the committed-events injection (the serializeRestartFacts gate). The driven shape exposes cards via runDefensiveDuel.cardEvents, NOT the per-step observation array, so the CARD-ISSUED oracle reports honest NOT_EVALUATED there — it never invents a PASS or a false FAIL. The runner serialization is NOT changed to make the oracle's job easier.",
    "ADVANTAGE-PLAYED remains NAMED-BUT-UNREGISTERED (no advantage machinery) — no criterion, oracle, invariant, binding or verdict accompanies it.",
    "Each reproduced stream is character-identical to its accepted CARD-MACHINERY state-hash-of-hashes pin (record 01d731ad…), so the verdicts are honest over the accepted streams, not over a re-shaped stream.",
    "NO suite-level PASS: the fouls suite is partial (4 of the 5 §10 criteria registered); verdicts are reported per criterion and per stream. No FOUNDATION_LAB_PASS, PES fidelity, or invented reference envelope claim.",
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
  "No suite-level PASS: the fouls suite is partial (FOUL-DETECT, FOUL-CLEAN-TACKLE, FREE-KICK-AWARD and CARD-ISSUED registered; ADVANTAGE-PLAYED named-not-registered).",
  "No CARD-ISSUED PASS claim on any accepted stream: the accepted card streams carry no observable card-issued event (the driven shape is commit-only; the organic shape is below threshold), so CARD-ISSUED is honestly NOT_EVALUATED over all four. The oracle's PASS/FAIL guards are proven by the canary tests, not by a re-shaped accepted stream.",
  "No advantage machinery or verdict: ADVANTAGE-PLAYED stays named-not-registered (no machinery).",
  "No PROMOTION claim. No FOUNDATION_LAB_PASS, milestone or regression PASS claim. No PES 2017 fidelity or invented reference envelope.",
  "No gameplay / source / contract / adapter change: git diff src/ and src/contracts/ is EMPTY and the runner serialization is UNCHANGED (the card-issued event is not re-serialized into the observation array to make the oracle's job easier).",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  produced_by: "scripts/capture-card-issued-suite-registration.ts",
  evidence_class: "MULTI_TICK",
  spec_sections: [
    "FOULS_CARDS_SPEC §5.1",
    "FOULS_CARDS_SPEC §7",
    "FOULS_CARDS_SPEC §9.1",
    "FOULS_CARDS_SPEC §10",
  ],
  lifecycle_phase_sync: "core-owned (organic); legacy (gate-off pin); driven (core-committed card)",
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
    card_count: r.card_count,
    card_events: r.card_events,
    fouls_suite_verdicts: r.fouls_suite_verdicts,
    card_issued_outcome: r.card_issued_outcome,
  })),
  claims_not_made: claimsNotMade,
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectoryArtifact, null, 2)}\n`, "utf-8");
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(`[card-issued-suite] wrote ${TRAJECTORY_PATH}`);
console.log(`[card-issued-suite] wrote ${STATE_PATH}`);
console.log(`[card-issued-suite] record_sha256=${String(record.record_sha256)}`);
console.log(`[card-issued-suite] guard_state.all_streams_character_identical_to_accepted=${String(allStreamsIdenticalToAccepted)}`);
for (const r of runs) {
  console.log(
    `[card-issued-suite] ${r.id}: fouls=${r.foul_count} cards=${r.card_count} ` +
      `CARD-ISSUED=${r.card_issued_outcome} acceptedIdentical=${String(r.state_hash_chain_identical_to_accepted)}`,
  );
}
