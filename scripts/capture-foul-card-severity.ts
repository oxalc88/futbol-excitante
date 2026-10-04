/**
 * Node-side evidence producer for FOUL-CARD-SEVERITY (Horizon v39 1/2).
 *
 * The FOULS_CARDS_SPEC §7 contact-severity direct-red path: a recognized
 * man-not-ball foul whose committed contact severity crosses the exported
 * `fouls-v1` §9.1 `foul_card_direct_red_severity_threshold` is issued as a
 * direct expulsion (CARD-DIRECT-RED).  This producer drives:
 *
 *   - a scripted sliding tackle (deep committed contact) whose severity crosses
 *     the threshold → the core commits a direct-red `card-issued` event, the
 *     registered `fouls` suite adjudicates CARD-DIRECT-RED PASS over the
 *     observation stream (the driver's `serializeCommittedEvents` injection),
 *     and two identical runs are byte-identical;
 *   - the standing-tackle control (below the threshold) → the accumulation
 *     caution only, no direct red, CARD-DIRECT-RED NOT_EVALUATED;
 *   - the gate-off shape twice → no card / no bookings and byte-identity, plus
 *     the accepted pre-change legacy pin fb5e9b02…;
 *   - the accepted organic 3v3-press stream with the card gate on → its grazing
 *     slide foul is below the threshold, so no direct red and the accepted
 *     CARD-ISSUED state-hash pin 88a08d27… is reproduced unchanged.
 *
 * No PES fidelity or reference envelope is claimed: the severity normalization
 * is a `fouls-v1` VERSIONED_PROVISIONAL design (src/simulation/card-policy.ts).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import type { HeadlessMatchResult } from "../eval/runners/headless-match.js";
import { runDefensiveDuel } from "../eval/runners/defensive-duel-driver.js";
import type { DefensiveDuelResult } from "../eval/runners/defensive-duel-driver.js";
import { detectFoulEvents, countFoulEvents } from "../eval/runners/foul-detection.js";
import { evaluateSuite } from "../eval/runners/foundation-evaluator.js";
import { withProximateHumanDefence } from "../eval/scenarios/proximate-5v5.js";
import { loadRegistrySet } from "../eval/contracts/loader.js";
import { ALL_TEST_IDS } from "../eval/contracts/bindings.js";
import { FOULS_SUITE } from "../eval/contracts/suites.js";
import type { TelemetryObservation } from "../src/contracts/telemetry.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "FOUL-CARD-SEVERITY";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");
const STATE_PATH = resolve(OUTPUT_ROOT, "foul-card-severity.json");

const ORGANIC_SCENARIO = "eval/scenarios/3v3-press-scenario.v1.json";
const DUEL_SCENARIO = "eval/scenarios/5v5-human-vs-cpu.v1.json";

/** The accepted pre-change pins this objective must not alter (gate-off / unaffected). */
const ACCEPTED_PINS: Record<string, string> = {
  "gate-off-legacy": "fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a",
  "gate-off-legacy-2": "fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a",
  "organic-card-gate-on": "88a08d2786a29c4dead92e4201d63fa5719f43f464938f1595c1f5cac83c243f",
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

function countKinds(observations: TelemetryObservation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of observations) {
    for (const ev of o.events) counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
  }
  return counts;
}

function foulsVerdicts(observations: TelemetryObservation[]): Record<string, string> {
  const suite = evaluateSuite("fouls", observations);
  const out: Record<string, string> = {};
  for (const t of suite.tests) {
    for (const c of t.criteria) out[c.criterion_id] = c.outcome;
  }
  return out;
}

interface CardEvent {
  tick: number;
  id: string;
  cardType: string;
  cardReason: string;
  playerId: string;
  accumulatedFouls: number;
  directRedSeverity: number | null;
  foulSourceEventId: string;
}

function cardEvents(observations: TelemetryObservation[]): CardEvent[] {
  const out: CardEvent[] = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "card-issued") continue;
      const p = (ev.payload ?? {}) as Record<string, unknown>;
      out.push({
        tick: ev.tick,
        id: ev.id,
        cardType: typeof p.cardType === "string" ? p.cardType : "",
        cardReason: typeof p.cardReason === "string" ? p.cardReason : "",
        playerId: typeof p.playerId === "string" ? p.playerId : "",
        accumulatedFouls: typeof p.accumulatedFouls === "number" ? p.accumulatedFouls : Number.NaN,
        directRedSeverity: typeof p.directRedSeverity === "number" ? p.directRedSeverity : null,
        foulSourceEventId: typeof p.foulSourceEventId === "string" ? p.foulSourceEventId : "",
      });
    }
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
  direct_red_card_count: number;
  card_events: CardEvent[];
  fouls_suite_verdicts: Record<string, string>;
}

function makeRunRecord(
  id: string,
  role: string,
  scenario: string,
  result: { stateHashes: string[]; observations: TelemetryObservation[] },
): RunRecord {
  const hashOfHashes = sha256(JSON.stringify(result.stateHashes));
  const accepted = ACCEPTED_PINS[id] ?? null;
  const cards = cardEvents(result.observations);
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
    direct_red_card_count: cards.filter((c) => c.cardReason === "direct-severity").length,
    card_events: cards,
    fouls_suite_verdicts: foulsVerdicts(result.observations),
  };
}

// ---------------------------------------------------------------------------
// Stream producers
// ---------------------------------------------------------------------------

const SLIDE_ATTEMPTS: Array<{ kind: "slide"; commitDistance: number; earliestTick: number }> = [
  { kind: "slide", commitDistance: 4.0, earliestTick: 48 },
];

function standingAttempts(): Array<{ kind: "standing"; commitDistance: number; earliestTick: number }> {
  const attempts: Array<{ kind: "standing"; commitDistance: number; earliestTick: number }> = [];
  for (let t = 44; t <= 100; t += 16) attempts.push({ kind: "standing", commitDistance: 3.0, earliestTick: t });
  return attempts;
}

function runSlide(cards: boolean, serializeCommittedEvents: boolean): DefensiveDuelResult {
  return runDefensiveDuel({
    scenario: withProximateHumanDefence(loadScenario(DUEL_SCENARIO)),
    maxTicks: 140,
    attempts: SLIDE_ATTEMPTS,
    cardConfig: cards ? { issueCards: true } : undefined,
    serializeCommittedEvents,
  });
}

function runStanding(cards: boolean, serializeCommittedEvents: boolean): DefensiveDuelResult {
  return runDefensiveDuel({
    scenario: withProximateHumanDefence(loadScenario(DUEL_SCENARIO)),
    maxTicks: 120,
    attempts: standingAttempts(),
    cardConfig: cards ? { issueCards: true } : undefined,
    serializeCommittedEvents,
  });
}

function runOrganicCardGateOn(): HeadlessMatchResult {
  return runHeadlessMatch({
    scenario: loadScenario(ORGANIC_SCENARIO),
    maxTicks: 600,
    cpuAntiHuddle: false,
    lifecyclePhaseSync: "core-owned",
    cpuDefensiveTackle: true,
    detectFouls: true,
    issueCards: true,
    serializeRestartFacts: true,
  });
}

function runGateOffLegacy(): HeadlessMatchResult {
  return runHeadlessMatch({
    scenario: loadScenario(ORGANIC_SCENARIO),
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

const slide1 = runSlide(true, true);
const slide2 = runSlide(true, true);
detectFoulEvents(slide1.observations);
detectFoulEvents(slide2.observations);
const standing = runStanding(true, true);
detectFoulEvents(standing.observations);
const gateOff1 = runSlide(false, false);
const gateOff2 = runSlide(false, false);
const organic = runOrganicCardGateOn();
const legacyGateOff1 = runGateOffLegacy();
const legacyGateOff2 = runGateOffLegacy();

const runs: RunRecord[] = [
  makeRunRecord(
    "driven-slide-direct-red-1",
    "proximate 5v5 human-vs-CPU (defensive-duel-driver) with ONE scripted slide tackle (commitDistance 4.0, earliestTick 48) and the card gate on (issueCards): the committed slide man-not-ball contact is deep inside the versioned slide reach (2.8 m), so its committed severity crosses the §9.1 threshold and the core commits a direct-red expulsion. serializeCommittedEvents injects the committed card-issued fact into the matching-tick observation, so the registered fouls suite adjudicates CARD-DIRECT-RED over the observation stream.",
    `${DUEL_SCENARIO} (withProximateHumanDefence)`,
    { stateHashes: slide1.stateHashes, observations: slide1.observations },
  ),
  makeRunRecord(
    "driven-slide-direct-red-2",
    "the identical scripted slide run repeated: two-run determinism of the direct-red driven stream.",
    `${DUEL_SCENARIO} (withProximateHumanDefence)`,
    { stateHashes: slide2.stateHashes, observations: slide2.observations },
  ),
  makeRunRecord(
    "driven-standing-control",
    "the standing-tackle control (repeated scripted standing tackles, commitDistance 3.0 every 16 ticks from t=44): every committed standing contact is below the direct-red threshold, so the only card is the §7 accumulation caution at the 2nd foul and CARD-DIRECT-RED is honestly NOT_EVALUATED.",
    `${DUEL_SCENARIO} (withProximateHumanDefence)`,
    { stateHashes: standing.stateHashes, observations: standing.observations },
  ),
  makeRunRecord(
    "driven-gate-off-1",
    "the scripted slide shape with the card gate OFF (issueCards undefined): no booking field, no card event — the default-off path is byte-identical to pre-change.",
    `${DUEL_SCENARIO} (withProximateHumanDefence)`,
    { stateHashes: gateOff1.stateHashes, observations: gateOff1.observations },
  ),
  makeRunRecord(
    "driven-gate-off-2",
    "the identical gate-off slide run repeated: two-run byte-identity of the gate-off path.",
    `${DUEL_SCENARIO} (withProximateHumanDefence)`,
    { stateHashes: gateOff2.stateHashes, observations: gateOff2.observations },
  ),
  makeRunRecord(
    "organic-card-gate-on",
    "the accepted organic 3v3 CPU-vs-CPU stream (3v3-press, 600 ticks, core-owned, cpuDefensiveTackle + detectFouls + issueCards + serializeRestartFacts): its single man-not-ball contact is a GRAZING slide foul (committed contact near the reach edge), below the direct-red threshold, so no direct red is committed and the accepted CARD-ISSUED state-hash pin is reproduced unchanged.",
    ORGANIC_SCENARIO,
    { stateHashes: organic.stateHashes, observations: organic.observations },
  ),
  makeRunRecord(
    "gate-off-legacy",
    "the accepted legacy gate-off control (3v3-press, detectFouls:false, awardFreeKicks:false, issueCards:false), run twice: byte-identical to the accepted pre-change pin fb5e9b02….",
    ORGANIC_SCENARIO,
    { stateHashes: legacyGateOff1.stateHashes, observations: legacyGateOff1.observations },
  ),
  makeRunRecord(
    "gate-off-legacy-2",
    "the identical legacy gate-off run repeated for the two-run attestation.",
    ORGANIC_SCENARIO,
    { stateHashes: legacyGateOff2.stateHashes, observations: legacyGateOff2.observations },
  ),
];

const slideDirectRed = runs[0];
const standingControl = runs[2];
const gateOffTwoRunIdentical =
  sha256(JSON.stringify(gateOff1.stateHashes)) === sha256(JSON.stringify(gateOff2.stateHashes));
const legacyGateOffTwoRunIdentical =
  sha256(JSON.stringify(legacyGateOff1.stateHashes)) === sha256(JSON.stringify(legacyGateOff2.stateHashes));
const slideTwoRunIdentical =
  sha256(JSON.stringify(slide1.stateHashes)) === sha256(JSON.stringify(slide2.stateHashes));
const acceptedPinsHeld = runs.every(
  (r) => r.accepted_state_hash_of_hashes === null || r.state_hash_chain_identical_to_accepted,
);

const trajectoryArtifact: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
  produced_by: "scripts/capture-foul-card-severity.ts",
  driver:
    "eval/runners/defensive-duel-driver.ts (scripted slide/standing tackles + cardConfig + serializeCommittedEvents) and eval/runners/headless-match.ts (organic / legacy gate-off); each stream evaluated with the registered `fouls` suite (evaluateSuite('fouls', observations)).",
  activation: {
    field: "cardConfig.issueCards (the SAME default-OFF card gate as CARD-MACHINERY; no new createSimulation parameter)",
    meaning:
      "with the gate ON a recognized man-not-ball foul whose committed contact severity reaches the exported fouls-v1 §9.1 foul_card_direct_red_severity_threshold is issued as a direct expulsion to the offending player, independent of the accumulation ladder; with the gate OFF no booking field is added and no card event is emitted, so the core is byte-identical to pre-change.",
    set_by: [
      "src/simulation/card-policy.ts FOUL_CARD_DIRECT_RED_SEVERITY_THRESHOLD + foulContactSeverity + resolveDirectRedForFoul",
      "src/simulation/loop/simulation.ts issueCardForFoul direct-red branch",
      "eval/contracts/common-criteria.ts CARD_DIRECT_RED",
      "eval/contracts/invariant-definitions.ts INV_FOUL_CARD_DIRECT_RED",
      "eval/contracts/bindings.ts BINDING_FOULS_CARD_DIRECT_RED_001",
      "eval/oracles/fouls.ts checkFoulCardDirectRed",
      "eval/oracles/wire.ts + eval/runners/foundation-evaluator.ts CRITERION_TO_ORACLE",
    ],
  },
  disclosures: [
    "The spike rule §9.1 threshold (0.85) is a fouls-v1 VERSIONED_PROVISIONAL value, NOT a PES 2017 magnitude. The severity normalization is a fouls-v1 VERSIONED_PROVISIONAL design choice: it averages the committed challenge span (slide vs standing versioned reach) with the contact penetration within the committed reach ((reach - planarDistance) / reach), read from the already-committed tackle-contact fields only. No contact speed or ball-play-timing envelope is invented.",
    "The driven slide stream's direct red is observed at the observation level only because the driver's serializeCommittedEvents injection places the committed card-issued fact into the matching-tick observation (the same post-loop, hash-neutral technique the headless runner's serializeRestartFacts gate uses); the injection is off by default and cannot affect inputs/steps/state hashes.",
    "CARD-DIRECT-RED is not a second-yellow rule and does not remove the offender from play (no regulation/removal mechanics).",
    "The organic stream's grazing slide foul is below the threshold, so the accepted CARD-ISSUED state-hash pin 88a08d27… and the legacy gate-off pin fb5e9b02… are reproduced unchanged (no accepted pin altered).",
    "No FOUNDATION_LAB_PASS, milestone or regression PASS claim, and no PES fidelity claim.",
  ],
  runs,
  guard_state: {
    slide_direct_red_committed: slideDirectRed.direct_red_card_count,
    slide_direct_red_oracle: slideDirectRed.fouls_suite_verdicts["CARD-DIRECT-RED"] ?? "NOT_EVALUATED",
    standing_control_direct_red_count: standingControl.direct_red_card_count,
    standing_control_oracle: standingControl.fouls_suite_verdicts["CARD-DIRECT-RED"] ?? "NOT_EVALUATED",
    slide_two_run_identical: slideTwoRunIdentical,
    gate_off_two_run_identical: gateOffTwoRunIdentical,
    gate_off_no_booking: runs[3].card_count === 0 && runs[4].card_count === 0,
    legacy_gate_off_two_run_identical: legacyGateOffTwoRunIdentical,
    accepted_pins_held: acceptedPinsHeld,
  },
};

const claimsNotMade = [
  "No PES 2017 fidelity or invented reference envelope: the severity normalization is a fouls-v1 VERSIONED_PROVISIONAL design choice, and foul_severity_distribution_ref / disciplinary_scale_ref stay BLOCKED_MISSING_REFERENCE.",
  "No second-yellow-to-red rule: the direct red reads only the committed contact severity, never the accumulated count.",
  "No regulation/removal mechanics: the direct red does not remove the offender from play.",
  "No FOUNDATION_LAB_PASS, milestone or regression PASS claim.",
  "No accepted pin altered: the legacy gate-off pin and the organic card-gate-on pin are reproduced byte-identically.",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  produced_by: "scripts/capture-foul-card-severity.ts",
  evidence_class: "MULTI_TICK",
  spec_sections: [
    "FOULS_CARDS_SPEC §5.1",
    "FOULS_CARDS_SPEC §7",
    "FOULS_CARDS_SPEC §9.1",
    "FOULS_CARDS_SPEC §10",
    "FOULS_CARDS_SPEC §11",
  ],
  direct_red_severity_threshold: 0.85,
  registry: {
    content_hash: loadRegistrySet().content_hash,
    test_binding_count: ALL_TEST_IDS.length,
    fouls_suite_direct_test_ids: FOULS_SUITE.direct_test_ids,
    card_direct_red_invariant: "foul-card-direct-red-evidence",
  },
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
    direct_red_card_count: r.direct_red_card_count,
    card_events: r.card_events,
    fouls_suite_verdicts: r.fouls_suite_verdicts,
  })),
  claims_not_made: claimsNotMade,
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectoryArtifact, null, 2)}\n`, "utf-8");
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
console.log(`[foul-card-severity] wrote ${TRAJECTORY_PATH}`);
console.log(`[foul-card-severity] wrote ${STATE_PATH}`);
console.log(`[foul-card-severity] record_sha256=${String(record.record_sha256)}`);
console.log(`[foul-card-severity] guard_state=${JSON.stringify(trajectoryArtifact.guard_state)}`);
for (const r of runs) {
  console.log(
    `[foul-card-severity] ${r.id}: fouls=${r.foul_count} cards=${r.card_count} directRed=${r.direct_red_card_count} ` +
      `CARD-DIRECT-RED=${r.fouls_suite_verdicts["CARD-DIRECT-RED"] ?? "NOT_EVALUATED"} ` +
      `pinHeld=${String(r.state_hash_chain_identical_to_accepted)}`,
  );
}
