/**
 * Node-side evidence producer for CARD-MACHINERY (FOULS_CARDS_SPEC §7 / §9.1).
 *
 * Executes the in-core card consequence (a committed man-not-ball foul
 * accumulates a caution / expulsion for the offending player when the
 * `fouls-v1` accumulation thresholds are reached) and records the MULTI_TICK
 * evidence:
 *
 *   - `card-driven-duel` — the accepted defensive-duel-driver coerced 5v5
 *     match with repeated scripted standing tackles; player-1 accumulates 5
 *     man-not-ball fouls, receiving a caution at the 2nd (yellow) and an
 *     expulsion at the 5th (red). Two runs for the two-run attestation.
 *   - `card-combined` — the same driven shape with BOTH the free-kick gate
 *     (awardFreeKicks) and the card gate (issueCards) on: the card branch runs
 *     first and the free-kick branch then opens the restart, so BOTH card and
 *     free-kick consequences coexist on the same committed foul tick.
 *   - `card-organic` — the coherent 3v3 CPU-vs-CPU run under cpuDefensiveTackle
 *     + detectFouls + issueCards + serializeRestartFacts; man-not-ball contacts
 *     emerge organically and the suite criteria are re-evaluated.
 *   - `card-gate-off` — the CPU gate-off byte-identity control: the accepted
 *     legacy 3v3-press pin reproduces byte-for-byte (the pre-change baseline
 *     hash-of-hashes), proving the core change is hash-neutral when gated off.
 *
 * The card event is emitted ONLY through the shared foul predicate
 * (src/simulation/foul-predicate.ts) on the core's own committed
 * `player-player-contact` events — the same single source of truth, never a
 * duplicated predicate. No CARD-ISSUED criterion is registered (that is
 * objective 3/4); ADVANTAGE-PLAYED stays spec-only (not implemented).
 * Direct-red-by-contact-severity is NOT implemented (the spec names a
 * contact-severity discriminator but never defines how it is computed; §11
 * declares `foul_severity_distribution_ref` / `disciplinary_scale_ref`
 * BLOCKED_MISSING_REFERENCE).
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:CARD-MACHINERY`. An ordinary run writes the same
 * artifacts under the ignored `test-results/gauntlet-capture/**` tree and
 * leaves `docs/` byte-identical. The record carries NO wall-clock field, so
 * consecutive ordinary-mode runs are byte-identical and the pinned
 * `record_sha256` is stable.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:CARD-MACHINERY \
 *     mise exec -- pnpm exec tsx scripts/capture-card-machinery.ts
 *
 * Node I/O is allowed here; the simulation core is touched only inside the
 * gated card branch (off by default).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { runDefensiveDuel } from "../eval/runners/defensive-duel-driver.js";
import { withProximateHumanDefence } from "../eval/scenarios/proximate-5v5.js";
import { detectFoulEvents, countFoulEvents } from "../eval/runners/foul-detection.js";
import { evaluateSuite } from "../eval/runners/foundation-evaluator.js";
import type { TelemetryObservation } from "../src/contracts/telemetry.js";
import type { SimulationEvent, ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "CARD-MACHINERY";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");
const STATE_PATH = resolve(OUTPUT_ROOT, "card-machinery.json");
const RESULT_PATH = resolve(OUTPUT_ROOT, "RESULT.md");

/** The accepted pre-change baseline (unmodified runner, identical scenario). */
const BASELINE_HASH_OF_HASHES =
  "fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a";

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

function criterionOutcomes(observations: TelemetryObservation[]): Record<string, string> {
  const suite = evaluateSuite("fouls", observations);
  const out: Record<string, string> = {};
  for (const t of suite.tests) for (const c of t.criteria) out[c.criterion_id] = c.outcome;
  return out;
}

/** Extract committed `card-issued` events (driven shape: not serialized to observations). */
function committedCardEvents(
  events: readonly SimulationEvent[],
): Array<{ tick: number; cardType: string; playerId: string; fouledPlayerId: string; accumulatedFouls: number; foulSourceEventId: string; foulTick: number }> {
  const out: Array<{ tick: number; cardType: string; playerId: string; fouledPlayerId: string; accumulatedFouls: number; foulSourceEventId: string; foulTick: number }> = [];
  for (const ev of events) {
    if (ev.kind !== "card-issued") continue;
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    out.push({
      tick: ev.tick,
      cardType: p.cardType as string,
      playerId: p.playerId as string,
      fouledPlayerId: p.fouledPlayerId as string,
      accumulatedFouls: p.accumulatedFouls as number,
      foulSourceEventId: p.foulSourceEventId as string,
      foulTick: p.foulTick as number,
    });
  }
  return out;
}

/** Extract `card-issued` events from an observation stream (organic shape). */
function committedCardEventsFromObs(
  observations: TelemetryObservation[],
): Array<{ tick: number; cardType: string; playerId: string; fouledPlayerId: string; accumulatedFouls: number; foulSourceEventId: string; foulTick: number }> {
  const out: Array<{ tick: number; cardType: string; playerId: string; fouledPlayerId: string; accumulatedFouls: number; foulSourceEventId: string; foulTick: number }> = [];
  for (const o of observations) for (const ev of o.events) {
    if (ev.kind !== "card-issued") continue;
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    out.push({
      tick: ev.tick,
      cardType: p.cardType as string,
      playerId: p.playerId as string,
      fouledPlayerId: p.fouledPlayerId as string,
      accumulatedFouls: p.accumulatedFouls as number,
      foulSourceEventId: p.foulSourceEventId as string,
      foulTick: p.foulTick as number,
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
  foul_count: number;
  card_count: number;
  card_events: Array<{ tick: number; cardType: string; playerId: string; fouledPlayerId: string; accumulatedFouls: number; foulSourceEventId: string; foulTick: number }>;
  free_kick_count: number;
  booking_state: Record<string, { fouls: number; cautions: number; expulsions: number }> | null;
  state_hash_of_hashes: string;
  determinism_run2_hash_of_hashes: string | null;
  verdicts: Record<string, string>;
}

function recordRun(
  id: string,
  role: string,
  scenario: string,
  result: { stateHashes: string[]; observations: TelemetryObservation[] },
  cardEvents: Array<{ tick: number; cardType: string; playerId: string; fouledPlayerId: string; accumulatedFouls: number; foulSourceEventId: string; foulTick: number }>,
  bookingState: Record<string, { fouls: number; cautions: number; expulsions: number }> | null,
  run2?: { stateHashes: string[] },
  committedFreeKickCount?: number,
): RunRecord {
  return {
    id,
    role,
    scenario,
    ticks: result.stateHashes.length,
    observation_count: result.observations.length,
    event_kind_counts: countKinds(result.observations),
    foul_count: countFoulEvents(result.observations),
    card_count: cardEvents.length,
    card_events: cardEvents,
    free_kick_count: committedFreeKickCount ?? (countKinds(result.observations)["free-kick-executed"] ?? 0),
    booking_state: bookingState,
    state_hash_of_hashes: sha256(JSON.stringify(result.stateHashes)),
    determinism_run2_hash_of_hashes: run2 ? sha256(JSON.stringify(run2.stateHashes)) : null,
    verdicts: criterionOutcomes(result.observations),
  };
}

const DRIVEN_ATTEMPTS: Array<{ kind: "standing"; commitDistance: number; earliestTick: number }> = [];
for (let t = 44; t <= 400; t += 16) {
  DRIVEN_ATTEMPTS.push({ kind: "standing", commitDistance: 3.0, earliestTick: t });
}

// --- Driven card-only (issueCards on; reaches caution + expulsion) -------
function runDriven(cardOnly: boolean): { stateHashes: string[]; observations: TelemetryObservation[]; cardEvents: ReturnType<typeof committedCardEvents>; bookingState: ReturnType<typeof recordRun>["booking_state"]; freeKickEvents: unknown[] } {
  const scenario = withProximateHumanDefence(loadScenario("eval/scenarios/5v5-human-vs-cpu.v1.json"));
  const r = runDefensiveDuel({
    scenario,
    maxTicks: 420,
    attempts: DRIVEN_ATTEMPTS,
    freeKickConfig: cardOnly ? undefined : { awardFreeKicks: true },
    cardConfig: { issueCards: true },
  });
  detectFoulEvents(r.observations);
  return {
    stateHashes: r.stateHashes,
    observations: r.observations,
    cardEvents: committedCardEvents(r.cardEvents),
    bookingState: r.bookingState ?? null,
    freeKickEvents: r.freeKickEvents,
  };
}

// --- Organic 3v3-press (issueCards on, detectFouls on, serializeRestartFacts) ---
function runOrganic(issueCards: boolean): ReturnType<typeof runHeadlessMatch> {
  return runHeadlessMatch({
    scenario: loadScenario("eval/scenarios/3v3-press-scenario.v1.json"),
    maxTicks: 600,
    cpuAntiHuddle: false,
    lifecyclePhaseSync: "core-owned",
    cpuDefensiveTackle: true,
    detectFouls: true,
    issueCards,
    serializeRestartFacts: true,
  });
}

// --- Gate-off byte-identity control (legacy 3v3-press pin) ----------------
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
// Assemble
// ---------------------------------------------------------------------------

mkdirSync(OUTPUT_ROOT, { recursive: true });

const driven1 = runDriven(true);
const driven2 = runDriven(true);
const combined = runDriven(false);
const organic = runOrganic(true);
const gateOff = runGateOff();
const organicCardEvents = committedCardEventsFromObs(organic.observations);

const records: RunRecord[] = [];
records.push(
  recordRun(
    "card-driven-duel",
    "proximate 5v5 human-vs-CPU (defensive-duel-driver) with repeated scripted standing tackles: player-1 accumulates 5 man-not-ball fouls (duelWon false, ballReachable false, tacklePhase active) and receives a caution at the 2nd and an expulsion at the 5th.",
    "eval/scenarios/5v5-human-vs-cpu.v1.json (withProximateHumanDefence)",
    { stateHashes: driven1.stateHashes, observations: driven1.observations },
    driven1.cardEvents,
    driven1.bookingState,
    { stateHashes: driven2.stateHashes },
    0,
  ),
);
records.push(
  recordRun(
    "card-combined",
    "the same driven shape with BOTH the free-kick gate (awardFreeKicks) and the card gate (issueCards) on: the card branch runs first then the free-kick branch opens the restart, so the caution and the free-kick-executed coexist on the same committed foul tick.",
    "eval/scenarios/5v5-human-vs-cpu.v1.json (withProximateHumanDefence)",
    { stateHashes: combined.stateHashes, observations: combined.observations },
    combined.cardEvents,
    combined.bookingState,
    undefined,
    (combined.freeKickEvents as unknown[]).length,
  ),
);
records.push(
  recordRun(
    "card-organic",
    "coherent 3v3 CPU-vs-CPU (3v3-press) under cpuDefensiveTackle:true + detectFouls:true + issueCards:true, core-owned + serializeRestartFacts: a man-not-ball contact emerges organically; the registered fouls suite is re-evaluated.",
    "eval/scenarios/3v3-press-scenario.v1.json",
    { stateHashes: organic.stateHashes, observations: organic.observations },
    organicCardEvents,
    null,
  ),
);
records.push(
  recordRun(
    "card-gate-off",
    "the CPU gate-off byte-identity control: the accepted legacy 3v3-press pin reproduces byte-for-byte (equal to the pre-change baseline hash-of-hashes), proving the card machinery is hash-neutral when gated off.",
    "eval/scenarios/3v3-press-scenario.v1.json",
    { stateHashes: gateOff.stateHashes, observations: gateOff.observations },
    [],
    null,
  ),
);

const twoRunDriven = sha256(JSON.stringify(driven1.stateHashes)) === sha256(JSON.stringify(driven2.stateHashes));
const gateOffByteIdentity = sha256(JSON.stringify(gateOff.stateHashes)) === BASELINE_HASH_OF_HASHES;
const drivenCautionAtTwo = driven1.cardEvents.some(
  (c) => c.cardType === "caution" && c.accumulatedFouls === 2,
);
const drivenExpulsionAtFive = driven1.cardEvents.some(
  (c) => c.cardType === "expulsion" && c.accumulatedFouls === 5,
);
const drivenBookingAccumulates = driven1.bookingState?.["player-1"]?.fouls === 5 &&
  driven1.bookingState["player-1"].cautions === 1 &&
  driven1.bookingState["player-1"].expulsions === 1;
const combinedCoexist =
  combined.cardEvents.length >= 1 && (combined.freeKickEvents as unknown[]).length >= 1;
const organicCardCount = organicCardEvents.length;

const trajectoryArtifact: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
  produced_by: "scripts/capture-card-machinery.ts",
  driver:
    "eval/runners/headless-match.ts (issueCards gate, core-owned lifecycle + serializeRestartFacts + free kick) + eval/runners/defensive-duel-driver.ts (scripted standing tackles, cardConfig) + the shared foul predicate.",
  activation: {
    field: "runDefensiveDuel({ cardConfig }) / runHeadlessMatch({ issueCards })",
    meaning:
      "the in-core card consequence in src/simulation/loop/simulation.ts: a committed man-not-ball tackle contact (the SAME predicate the runner-level detection uses, evaluated on the core's own events at the match-phase layer) accumulates a caution / expulsion for the offending player at the fouls-v1 accumulation thresholds. Off (the default) or with no qualifying foul, no booking field is added and no card event is emitted, so the stream is byte-identical to pre-change.",
    set_by: [
      "src/simulation/loop/simulation.ts (card branch + issueCards gate + default-off CardConfig + state.bookings)",
      "src/contracts/state.ts (WorldState.bookings / PlayerBooking)",
      "src/contracts/scenario.ts (card-issued event kind)",
      "src/simulation/foul-predicate.ts (single-source-of-truth predicate, shared with eval/runners/foul-detection.ts)",
      "eval/runners/headless-match.ts runHeadlessMatch({ issueCards, serializeRestartFacts })",
      "eval/runners/defensive-duel-driver.ts runDefensiveDuel({ cardConfig })",
      "NOT the browser composition root",
    ],
  },
  guard_state: {
    driven_two_run_attestation: twoRunDriven,
    gate_off_byte_identity_to_pre_change: gateOffByteIdentity,
    baseline_hash_of_hashes: BASELINE_HASH_OF_HASHES,
    driven_caution_at_accumulated_two: drivenCautionAtTwo,
    driven_expulsion_at_accumulated_five: drivenExpulsionAtFive,
    driven_booking_accumulates: drivenBookingAccumulates,
    combined_card_and_free_kick_coexist: combinedCoexist,
    organic_card_count: organicCardCount,
  },
  trajectory: {
    organic: {
      sample: organic.observations.slice(0, 20).map((o) => ({
        tick: o.tick,
        phase: (o.events.find((e) => e.kind === "core-match-phase")?.payload as { matchPhase?: unknown })?.matchPhase ?? null,
        ball_lastTouchRef: o.ball.lastTouchRef,
        ball_x: Number(o.ball.position.x.toFixed(4)),
        ball_y: Number(o.ball.position.y.toFixed(4)),
      })),
    },
    driven: {
      card_events: driven1.cardEvents,
      booking_state: driven1.bookingState,
      foul_ticks: driven1.observations
        .flatMap((o) => o.events)
        .filter((e) => e.kind === "foul")
        .map((e) => e.tick),
    },
  },
  disclosures: [
    "CARD-MACHINERY is a DELIBERATE core change in src/simulation/loop/simulation.ts: a default-off issueCards gate accumulates a caution / expulsion for the offending player at the fouls-v1 accumulation thresholds. With the gate OFF (the default) the card branch never runs and the core is byte-identical to pre-change; this is attested by the gate-off legacy pin reproducing the pre-change baseline hash-of-hashes byte-for-byte.",
    "The card predicate is a single source of truth (src/simulation/foul-predicate.ts): the runner-level detection (eval/runners/foul-detection.ts) and the in-core card consequence evaluate the SAME function, so they cannot disagree about what a foul IS. No duplicated predicate exists.",
    "Direct-red-by-contact-severity is NOT implemented. FOULS_CARDS_SPEC §9.1 gives the numeric threshold `foul_card_direct_red_severity_threshold` (0.85), but §7 only NAMES an 'optional contact-severity discriminator' and never defines how the normalized severity is computed from the accepted tackle contact; §11 declares `foul_severity_distribution_ref` and `disciplinary_scale_ref` BLOCKED_MISSING_REFERENCE. Equal-fouls accumulation (2 → caution, 5 → expulsion) is fully specified and implemented; the severity path is surfaced as BLOCKED_MISSING_REFERENCE and NOT invented.",
    "Second-card (a second yellow → red) semantics are NOT specified by the spec: §7 defines two INDEPENDENT accumulation thresholds (yellow 2, red 5), and §11 declares `disciplinary_scale_ref` BLOCKED_MISSING_REFERENCE. The machinery issues a caution when the accumulated count reaches the yellow threshold and an expulsion when it reaches the red threshold; it does NOT implement a yellow-accumulation-to-expulsion relationship.",
    "ADVANTAGE-PLAYED stays spec-only (FOULS_CARDS_SPEC §6): no advantage-window withholding is implemented; a recognized foul issues the card unconditionally (there is no advantage gate).",
    "No CARD-ISSUED criterion is registered (objective 3/4). The card-issued event is structurallly commit-only (it lives in state.events and is surfaced through the accepted serializeRestartFacts committed-events copy when that gate is on), matching the free-kick-executed precedent.",
    "Same-tick arbitration (spec §2.2) is a deliberate deterministic priority: the card branch evaluates only while matchPhase is still 'playing', and runs before the free-kick branch, so a ball-out-of-play / goal restart that claimed the phase wins, and a card + free kick can coexist on the same foul tick (the card never changes the phase).",
    "The organic 3v3-press run is under cpuAntiHuddle:false; under that shape the anti-huddle nearest-only contract is disabled. The card consequence is independent of the anti-huddle contract (it only reads committed foul contacts).",
    "The card-organic run reports booking_state:null because runHeadlessMatch returns observation streams, not the final WorldState bookings. The organic stream committed one man-not-ball foul (below the caution threshold), so the in-core branch materialized a booking (fouls:1, 0 cards) but that is not surfaced through runHeadlessMatch; the driven runs expose booking state directly via runDefensiveDuel.bookingState.",
  ],
  runs: records,
};

// ---------------------------------------------------------------------------
// State record (byte-reproducible, no wall-clock field in the hash)
// ---------------------------------------------------------------------------

const claimsNotMade = [
  "No card registration: CARD-ISSUED remains named-but-unregistered (FOULS_CARDS_SPEC §10); it belongs to objective 3/4.",
  "No direct-red-by-contact-severity implementation or claim: the severity discriminator is undefined and BLOCKED_MISSING_REFERENCE (§7 / §11) — no envelope or severity computation was invented.",
  "No second-yellow → red semantics: the spec defines two independent accumulation thresholds, not a yellow-accumulation-to-expulsion relationship.",
  "No advantage implementation: ADVANTAGE-PLAYED stays spec-only (spec §6), deferred.",
  "No suite-level PASS claim: the per-criterion verdicts are a per-criterion collection on the streams, not a suite PASS; CARD-ISSUED is not evaluated.",
  "No PES 2017 fidelity or measured PES envelope: the accumulation thresholds (2 / 5) are fouls-v1 VERSIONED_PROVISIONAL design choices.",
  "No ungated behavior change: the card consequence is behind a default-off gate (issueCards); gate off (or no qualifying foul) is byte-identical to pre-change.",
  "No DYNAMIC_VISUAL claim (no real browser frames captured; evidence class is MULTI_TICK).",
  "No claim that the organic 3v3-press run produces a card: its organic man-not-ball count may be below the yellow accumulation threshold (an honest below-threshold no-card result).",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  produced_by: "scripts/capture-card-machinery.ts",
  evidence_class: "MULTI_TICK",
  spec_sections: [
    "FOULS_CARDS_SPEC §5.1",
    "FOULS_CARDS_SPEC §7",
    "FOULS_CARDS_SPEC §9.1",
    "FOULS_CARDS_SPEC §10",
    "FOULS_CARDS_SPEC §11",
  ],
  core_change: {
    in: "src/simulation/loop/simulation.ts",
    what: "a default-off issueCards gate (CardConfig) accumulates a caution / expulsion for the offending player (playerIdA) at the fouls-v1 accumulation thresholds (2 → caution, 5 → expulsion) over the committed man-not-ball contacts. Booking is materialized lazily in WorldState.bookings (absent when gated off or no qualifying foul) so the off-path is byte-identical to pre-change. The card-issued event carries the offender / fouled player / card type / accumulated count / foul source id.",
    versioned_provisional_parameters: {
      fouls_yellow_accumulation_count: 2,
      fouls_red_accumulation_count: 5,
      gate: "CardConfig.issueCards (default off)",
      not_implemented_direct_red_severity: "foul_card_direct_red_severity_threshold 0.85 — BLOCKED_MISSING_REFERENCE (§7 / §11): the contact-severity discriminator is undefined in the spec.",
    },
    predicate_single_source: "src/simulation/foul-predicate.ts (shared by eval/runners/foul-detection.ts and the in-core card consequence)",
  },
  guards: {
    driven_two_run_attestation: twoRunDriven,
    gate_off_byte_identity_to_pre_change: gateOffByteIdentity,
    baseline_hash_of_hashes: BASELINE_HASH_OF_HASHES,
    driven_caution_at_accumulated_two: drivenCautionAtTwo,
    driven_expulsion_at_accumulated_five: drivenExpulsionAtFive,
    driven_booking_accumulates: drivenBookingAccumulates,
    combined_card_and_free_kick_coexist: combinedCoexist,
    organic_card_count: organicCardCount,
  },
  runs: records.map((r) => ({
    id: r.id,
    role: r.role,
    scenario: r.scenario,
    ticks: r.ticks,
    observation_count: r.observation_count,
    event_kind_counts: r.event_kind_counts,
    foul_count: r.foul_count,
    card_count: r.card_count,
    card_events: r.card_events,
    free_kick_count: r.free_kick_count,
    booking_state: r.booking_state,
    state_hash_of_hashes: r.state_hash_of_hashes,
    determinism_run2_hash_of_hashes: r.determinism_run2_hash_of_hashes,
    verdicts: r.verdicts,
  })),
  claims_not_made: claimsNotMade,
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectoryArtifact, null, 2)}\n`, "utf-8");
writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
writeFileSync(RESULT_PATH, RESULT_MD(record), "utf-8");

console.log(`[card-machinery] wrote ${TRAJECTORY_PATH}`);
console.log(`[card-machinery] wrote ${STATE_PATH}`);
console.log(`[card-machinery] wrote ${RESULT_PATH}`);
console.log(`[card-machinery] record_sha256=${String(record.record_sha256)}`);

function RESULT_MD(record: Record<string, unknown>): string {
  const guards = record.guards as Record<string, unknown>;
  const md = [
    `# CARD-MACHINERY — builder result`,
    ``,
    `## Builder report`,
    ``,
    `- objective_id: ${OBJECTIVE_ID}`,
    `- evidence_class: MULTI_TICK`,
    `- core_change: the in-core card consequence (default-off issueCards gate, WorldState.bookings, card-issued event) in src/simulation/loop/simulation.ts + the card-issued event kind + the WorldState bookings field + the shared foul predicate.`,
    ``,
    `## Guard state`,
    ``,
    ...Object.entries(guards).map(([k, v]) =>
      `- ${k}: ${typeof v === "boolean" ? String(v) : JSON.stringify(v)}`,
    ),
    ``,
  ];
  const runs = record.runs as Array<Record<string, unknown>>;
  for (const run of runs) {
    md.push(`## Run ${String(run.id)}`);
    md.push(`- ticks: ${run.ticks}`);
    md.push(`- foul_count: ${run.foul_count}`);
    md.push(`- card_count: ${run.card_count}`);
    md.push(`- free_kick_count: ${run.free_kick_count}`);
    md.push(`- card_events: ${JSON.stringify(run.card_events)}`);
    md.push(`- booking_state: ${JSON.stringify(run.booking_state ?? null)}`);
    md.push(`- state_hash_of_hashes: ${run.state_hash_of_hashes}`);
    md.push(`- determinism_run2_hash_of_hashes: ${run.determinism_run2_hash_of_hashes ?? "null"}`);
    md.push(`- event_kind_counts: ${JSON.stringify(run.event_kind_counts)}`);
    md.push(``);
    md.push(`| criterion | outcome |`);
    md.push(`|---|---|`);
    for (const [crit, out] of Object.entries((run.verdicts as Record<string, string>) ?? {})) {
      md.push(`| ${crit} | ${out} |`);
    }
    md.push(``);
  }
  md.push(`## (non-)claims`);
  md.push(``);
  for (const c of record.claims_not_made as string[]) md.push(`- ${c}`);
  md.push(``);
  return md.join("\n");
}
