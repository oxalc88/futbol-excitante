/**
 * Node-side evidence producer for ADVANTAGE-SUITE-REGISTRATION.
 *
 * Registers ADVANTAGE-PLAYED (FOULS_CARDS_SPEC §6 / §10) as the fifth
 * executable protected oracle in suite-fouls-v1 over the ACCEPTED
 * ADVANTAGE-MACHINERY streams, and records the executed per-criterion verdict
 * over each stream:
 *
 *   - `advantage-driven-gate-off`: the driven control with the advantage gate
 *     off — no advantage decision, no observable window → ADVANTAGE-PLAYED
 *     honest NOT_EVALUATED.
 *   - `advantage-driven-cancelled`: the driven §6.3 last-touch-loss cancellation
 *     shape.  The window decisions live in the CORE's persistent state (the
 *     driven shape does not serialize committed events into the per-step
 *     observation array), so ADVANTAGE-PLAYED is honestly NOT_EVALUATED (the
 *     oracle cannot confirm the decision from the observations it receives).
 *   - `advantage-driven-close-tick-free-kick`: the driven deferred-call shape;
 *     the committed decisions are again commit-only → NOT_EVALUATED.
 *   - `advantage-driven-stoppage`: the driven §6.3 new-stoppage cancellation
 *     shape; commit-only → NOT_EVALUATED.
 *   - `advantage-organic-expired`: the coherent 3v3 CPU-vs-CPU press with
 *     detectFouls + awardFreeKicks + issueCards + playAdvantage +
 *     serializeRestartFacts.  The observation stream carries the committed
 *     `advantage-opened` / `advantage-expired` decisions, so ADVANTAGE-PLAYED
 *     executes a real PASS over the accepted stream.
 *   - `advantage-organic-stoppage`: the organic window cancelled by a goal
 *     (§6.3 new stoppage) — the stream carries the opened/cancelled decisions →
 *     real PASS.
 *   - `advantage-gate-off-pin`: the accepted legacy gate-off pin with no
 *     advantage decision → NOT_EVALUATED, byte-identical to the pre-change
 *     baseline.
 *
 * FOUL-DETECT, FOUL-CLEAN-TACKLE, FREE-KICK-AWARD and CARD-ISSUED remain
 * registered from the prior suite registrations.  The §6.2a judged-retained path
 * is NOT implemented: no stream carries a retained judgment, and a retained
 * input would be reported honestly as BLOCKED_MISSING_REFERENCE
 * (advantage_retention_ref, §11) — the oracle never PASSes it.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:ADVANTAGE-SUITE-REGISTRATION`.  An ordinary run
 * writes the same artifacts under the ignored `test-results/gauntlet-capture/**`
 * tree and leaves `docs/` byte-identical.  The artifact carries NO wall-clock
 * field, so consecutive ordinary-mode runs are byte-identical.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:ADVANTAGE-SUITE-REGISTRATION \
 *     mise exec -- pnpm exec tsx scripts/capture-advantage-suite-registration.ts
 *
 * Node I/O is allowed here; the simulation core is untouched (git diff src/ is
 * EMPTY for this objective).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import { runDefensiveDuel } from "../eval/runners/defensive-duel-driver.js";
import { detectFoulEvents, countFoulEvents } from "../eval/runners/foul-detection.js";
import { evaluateSuite } from "../eval/runners/foundation-evaluator.js";
import { withProximateHumanDefence } from "../eval/scenarios/proximate-5v5.js";
import type { ScenarioDefinition, SimulationEvent } from "../src/contracts/scenario.js";
import type { TelemetryObservation } from "../src/contracts/telemetry.js";
import type { DefensiveDuelResult } from "../eval/runners/defensive-duel-driver.js";

const OBJECTIVE_ID = "ADVANTAGE-SUITE-REGISTRATION";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");

/** Pre-change baseline (the accepted FOUL-DETECTION-MACHINERY pin). */
const BASELINE_HASH_OF_HASHES =
  "fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a";

/** The accepted ADVANTAGE-MACHINERY state-hash-of-hashes pins (record ea654bf):
 * the exact streams this objective re-evaluates.  Character-identity to the
 * accepted pin attests that the streams are unchanged. */
const ACCEPTED_PINS: Record<string, string> = {
  "advantage-driven-gate-off": "87fdd04de37556c7e43310b29049ef37c70d3a382181e9d8f3581318609e073b",
  "advantage-driven-cancelled": "e230d2404135f4a738dc14d6f58ff1c0c77b121aac4d6ed0331e503a9d09a17e",
  "advantage-driven-close-tick-free-kick": "77a9aa470661c32ce71daec6c4cfdf0cc27aff5c80dfb3545173c1a69786483a",
  "advantage-driven-stoppage": "c2630deb47b1c9544415e24df60c0159ba54bb6bf782aa83e44c19c6c155eb13",
  "advantage-organic-expired": "76a982759e2e14d1c4f2a2eccb82b4d53b1b283dd734c0e9e1f59c9111998930",
  "advantage-organic-stoppage": "bd296c7ab3851df56394b43dbfbb52c5a453e0733c0cdc7591e74b139281c831",
  "advantage-gate-off-pin": "fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a",
};

const ADVANTAGE_OPEN_KIND = "advantage-opened";
const ADVANTAGE_CLOSED_KINDS: ReadonlySet<string> = new Set<string>([
  "advantage-cancelled",
  "advantage-expired",
]);

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

/** The full fouls-suite verdict table (all five registered criteria). */
function foulsVerdicts(observations: TelemetryObservation[]): Record<string, string> {
  const suite = evaluateSuite("fouls", observations);
  const out: Record<string, string> = {};
  for (const t of suite.tests) for (const c of t.criteria) out[c.criterion_id] = c.outcome;
  return out;
}

/** The ADVANTAGE-PLAYED criterion outcome over a stream. */
function advantagePlayedOutcome(observations: TelemetryObservation[]): string {
  return foulsVerdicts(observations)["ADVANTAGE-PLAYED"] ?? "NOT_EVALUATED";
}

/** Every advantage-window decision event carried by the observation stream. */
function advantageDecisionFacts(observations: TelemetryObservation[]): {
  opened: Array<{ tick: number; id: string; foulTick: number | null; fouledTeam: string | null; windowTicks: number | null }>;
  closed: Array<{ tick: number; id: string; kind: string; openTick: number | null; reason: string | null; windowTicks: number | null }>;
} {
  const opened: Array<{ tick: number; id: string; foulTick: number | null; fouledTeam: string | null; windowTicks: number | null }> = [];
  const closed: Array<{ tick: number; id: string; kind: string; openTick: number | null; reason: string | null; windowTicks: number | null }> = [];
  for (const o of observations) {
    for (const ev of o.events) {
      const kind: string = ev.kind;
      const p = (ev.payload ?? {}) as Record<string, unknown>;
      if (kind === ADVANTAGE_OPEN_KIND) {
        opened.push({
          tick: ev.tick,
          id: ev.id,
          foulTick: (p.foulTick as number) ?? null,
          fouledTeam: (p.fouledTeam as string) ?? null,
          windowTicks: (p.windowTicks as number) ?? null,
        });
      } else if (ADVANTAGE_CLOSED_KINDS.has(kind)) {
        closed.push({
          tick: ev.tick,
          id: ev.id,
          kind,
          openTick: (p.openTick as number) ?? null,
          reason: (p.reason as string) ?? null,
          windowTicks: (p.windowTicks as number) ?? null,
        });
      }
    }
  }
  return { opened, closed };
}

/** Every `card-issued` event in the observation stream. */
function cardIssuedFacts(observations: TelemetryObservation[]): Array<{
  tick: number;
  id: string;
  cardType: string;
  playerId: string;
  accumulatedFouls: number;
  foulSourceEventId: string;
}> {
  const out: Array<{ tick: number; id: string; cardType: string; playerId: string; accumulatedFouls: number; foulSourceEventId: string }> = [];
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

/** Every `free-kick-executed` event in the observation stream. */
function freeKickFacts(observations: TelemetryObservation[]): Array<{
  tick: number;
  id: string;
  teamId: string;
  position: { x: number; y: number } | null;
}> {
  const out: Array<{ tick: number; id: string; teamId: string; position: { x: number; y: number } | null }> = [];
  for (const o of observations) for (const ev of o.events) {
    if (ev.kind !== "free-kick-executed") continue;
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    out.push({
      tick: ev.tick,
      id: ev.id,
      teamId: (p.teamId as string) ?? "",
      position: (p.freeKickPosition as { x: number; y: number }) ?? null,
    });
  }
  return out;
}

/** The commit-only advantage decisions a driven run exposes off the core's
 * persistent state (the per-step observation array does not carry them). */
function committedAdvantageFacts(events: readonly SimulationEvent[]): Array<{
  tick: number;
  id: string;
  kind: string;
  openTick: number | null;
  reason: string | null;
}> {
  return events
    .filter((e) => {
      const kind: string = e.kind;
      return kind === ADVANTAGE_OPEN_KIND || ADVANTAGE_CLOSED_KINDS.has(kind);
    })
    .map((e) => {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      return {
        tick: e.tick,
        id: e.id,
        kind: e.kind as string,
        openTick: (p.openTick as number) ?? null,
        reason: (p.reason as string) ?? null,
      };
    });
}

interface RunRecord {
  id: string;
  role: string;
  stream: string;
  ticks: number;
  observation_count: number;
  event_kind_counts: Record<string, number>;
  state_hash_of_hashes: string;
  accepted_state_hash_of_hashes: string | null;
  state_hash_chain_identical_to_accepted: boolean;
  determinism_run2_hash_of_hashes: string | null;
  two_run_attested: boolean;
  foul_count: number;
  advantage_decisions_observable_in_stream: boolean;
  advantage_opened: Array<{ tick: number; id: string; foulTick: number | null; fouledTeam: string | null; windowTicks: number | null }>;
  advantage_closed: Array<{ tick: number; id: string; kind: string; openTick: number | null; reason: string | null; windowTicks: number | null }>;
  committed_advantage_decisions: Array<{ tick: number; id: string; kind: string; openTick: number | null; reason: string | null }> | null;
  cards: Array<{ tick: number; id: string; cardType: string; playerId: string; accumulatedFouls: number; foulSourceEventId: string }>;
  free_kicks: Array<{ tick: number; id: string; teamId: string; position: { x: number; y: number } | null }>;
  fouls_suite_verdicts: Record<string, string>;
  advantage_played_outcome: string;
}

function makeRunRecord(opts: {
  id: string;
  role: string;
  stream: string;
  stateHashes: string[];
  observations: TelemetryObservation[];
  commitOnlyAdvantageEvents?: readonly SimulationEvent[];
  run2StateHashes?: string[];
}): RunRecord {
  const hashOfHashes = sha256(JSON.stringify(opts.stateHashes));
  const accepted = ACCEPTED_PINS[opts.id] ?? null;
  const decisions = advantageDecisionFacts(opts.observations);
  const run2Hash = opts.run2StateHashes ? sha256(JSON.stringify(opts.run2StateHashes)) : null;
  return {
    id: opts.id,
    role: opts.role,
    stream: opts.stream,
    ticks: opts.stateHashes.length,
    observation_count: opts.observations.length,
    event_kind_counts: countKinds(opts.observations),
    state_hash_of_hashes: hashOfHashes,
    accepted_state_hash_of_hashes: accepted,
    state_hash_chain_identical_to_accepted: accepted !== null && hashOfHashes === accepted,
    determinism_run2_hash_of_hashes: run2Hash,
    two_run_attested: run2Hash !== null && run2Hash === hashOfHashes,
    foul_count: countFoulEvents(opts.observations),
    advantage_decisions_observable_in_stream: decisions.opened.length + decisions.closed.length > 0,
    advantage_opened: decisions.opened,
    advantage_closed: decisions.closed,
    committed_advantage_decisions: opts.commitOnlyAdvantageEvents
      ? committedAdvantageFacts(opts.commitOnlyAdvantageEvents)
      : null,
    cards: cardIssuedFacts(opts.observations),
    free_kicks: freeKickFacts(opts.observations),
    fouls_suite_verdicts: foulsVerdicts(opts.observations),
    advantage_played_outcome: advantagePlayedOutcome(opts.observations),
  };
}

// ---------------------------------------------------------------------------
// Stream producers (reproduce the accepted ADVANTAGE-MACHINERY streams)
// ---------------------------------------------------------------------------

function runDriven(opts: {
  maxTicks: number;
  attemptsThrough: number;
  freeKick: boolean;
  advantage?: boolean;
  matchDurationTicks?: number;
}): DefensiveDuelResult {
  const base = withProximateHumanDefence(loadScenario("eval/scenarios/5v5-human-vs-cpu.v1.json"));
  const scenario = opts.matchDurationTicks === undefined ? base : { ...base, matchDurationTicks: opts.matchDurationTicks };
  const attempts: Array<{ kind: "standing"; commitDistance: number; earliestTick: number }> = [];
  for (let t = 44; t <= opts.attemptsThrough; t += 16) {
    attempts.push({ kind: "standing", commitDistance: 3.0, earliestTick: t });
  }
  const r = runDefensiveDuel({
    scenario,
    maxTicks: opts.maxTicks,
    attempts,
    freeKickConfig: opts.freeKick ? { awardFreeKicks: true } : undefined,
    cardConfig: { issueCards: true },
    advantageConfig: opts.advantage === undefined ? undefined : { playAdvantage: opts.advantage },
  });
  detectFoulEvents(r.observations);
  return r;
}

function runOrganic(playAdvantage: boolean, maxTicks: number) {
  return runHeadlessMatch({
    scenario: loadScenario("eval/scenarios/3v3-press-scenario.v1.json"),
    maxTicks,
    cpuAntiHuddle: false,
    lifecyclePhaseSync: "core-owned",
    cpuDefensiveTackle: true,
    detectFouls: true,
    awardFreeKicks: true,
    issueCards: true,
    playAdvantage,
    serializeRestartFacts: true,
  });
}

function runGateOffLegacy() {
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
// Assemble
// ---------------------------------------------------------------------------

mkdirSync(OUTPUT_ROOT, { recursive: true });

const drivenOff1 = runDriven({ maxTicks: 200, attemptsThrough: 160, freeKick: false, advantage: undefined });
const drivenOff2 = runDriven({ maxTicks: 200, attemptsThrough: 160, freeKick: false, advantage: undefined });
const driven1 = runDriven({ maxTicks: 200, attemptsThrough: 160, freeKick: false, advantage: true });
const driven2 = runDriven({ maxTicks: 200, attemptsThrough: 160, freeKick: false, advantage: true });
const drivenFull = runDriven({ maxTicks: 380, attemptsThrough: 340, freeKick: true, advantage: true });
const drivenStoppage = runDriven({
  maxTicks: 200,
  attemptsThrough: 160,
  freeKick: false,
  advantage: true,
  matchDurationTicks: 120,
});
const organic1 = runOrganic(true, 600);
const organic2 = runOrganic(true, 600);
const stoppage = runOrganic(true, 1440);
const gateOff = runGateOffLegacy();

const runs: RunRecord[] = [
  makeRunRecord({
    id: "advantage-driven-gate-off",
    role: "gate-off driven control: no advantage event, pre-change path",
    stream: "5v5 human-vs-CPU defensive duel (scripted standing tackles, advantage off)",
    stateHashes: drivenOff1.stateHashes,
    observations: drivenOff1.observations,
    run2StateHashes: drivenOff2.stateHashes,
  }),
  makeRunRecord({
    id: "advantage-driven-cancelled",
    role: "driven foul → window → §6.3 last-touch-loss cancellation → deferred card (commit-only decisions)",
    stream: "5v5 human-vs-CPU defensive duel (scripted standing tackles, playAdvantage on)",
    stateHashes: driven1.stateHashes,
    observations: driven1.observations,
    commitOnlyAdvantageEvents: driven1.advantageEvents,
    run2StateHashes: driven2.stateHashes,
  }),
  makeRunRecord({
    id: "advantage-driven-close-tick-free-kick",
    role: "driven deferred call: free kick + card at the close tick (commit-only decisions)",
    stream: "5v5 human-vs-CPU defensive duel (longer run, awardFreeKicks + playAdvantage on)",
    stateHashes: drivenFull.stateHashes,
    observations: drivenFull.observations,
    commitOnlyAdvantageEvents: drivenFull.advantageEvents,
  }),
  makeRunRecord({
    id: "advantage-driven-stoppage",
    role: "driven half ending inside the window: §6.3 new-stoppage cancellation (commit-only decisions)",
    stream: "5v5 human-vs-CPU defensive duel (first half ends inside the window)",
    stateHashes: drivenStoppage.stateHashes,
    observations: drivenStoppage.observations,
    commitOnlyAdvantageEvents: drivenStoppage.advantageEvents,
  }),
  makeRunRecord({
    id: "advantage-organic-expired",
    role: "organic foul → window → §6.2c expiry at 24 ticks → free kick at the close (observable decisions)",
    stream: "3v3-press CPU-vs-CPU (detectFouls + awardFreeKicks + issueCards + playAdvantage + serializeRestartFacts)",
    stateHashes: organic1.stateHashes,
    observations: organic1.observations,
    run2StateHashes: organic2.stateHashes,
  }),
  makeRunRecord({
    id: "advantage-organic-stoppage",
    role: "organic window cancelled by a goal (§6.3 new stoppage), caution at the close (observable decisions)",
    stream: "3v3-press CPU-vs-CPU (1440 ticks, playAdvantage + serializeRestartFacts)",
    stateHashes: stoppage.stateHashes,
    observations: stoppage.observations,
  }),
  makeRunRecord({
    id: "advantage-gate-off-pin",
    role: "gate-off legacy control reproducing the pre-change pin byte-for-byte",
    stream: "3v3-press CPU-vs-CPU (legacy gate-off pin)",
    stateHashes: gateOff.stateHashes,
    observations: gateOff.observations,
  }),
];

const allStreamsIdenticalToAccepted = runs.every((r) => r.state_hash_chain_identical_to_accepted);
const gateOffPin = sha256(JSON.stringify(gateOff.stateHashes)) === BASELINE_HASH_OF_HASHES;
const organicRuns = runs.filter((r) => r.id.startsWith("advantage-organic-"));
const drivenRuns = runs.filter((r) => r.id.startsWith("advantage-driven-"));
const organicAdvantagePass = organicRuns.some(
  (r) => r.advantage_decisions_observable_in_stream && r.advantage_played_outcome === "PASS",
);
const drivenAdvantageNotEvaluated = drivenRuns.every(
  (r) => r.advantage_played_outcome === "NOT_EVALUATED",
);

const trajectoryArtifact: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
  produced_by: "scripts/capture-advantage-suite-registration.ts",
  driver:
    "the registered `fouls` suite (suite-fouls-v1) evaluated over the accepted ADVANTAGE-MACHINERY streams via evaluateSuite('fouls', observations); the streams are reproduced with eval/runners/headless-match.ts (playAdvantage gate + serializeRestartFacts) and eval/runners/defensive-duel-driver.ts (scripted standing tackles, advantageConfig). ADVANTAGE-PLAYED reads the committed advantage-opened / advantage-cancelled / advantage-expired decisions and the shared src/simulation/advantage-policy.ts + src/simulation/foul-predicate.ts modules.",
  activation: {
    field: "evaluateSuite('fouls', observations) over the committed advantage streams",
    meaning:
      "the registered `fouls` suite (suite-fouls-v1) evaluates FOUL-DETECT, FOUL-CLEAN-TACKLE, FREE-KICK-AWARD, CARD-ISSUED and ADVANTAGE-PLAYED over the accepted advantage streams. ADVANTAGE-PLAYED verifies the §6.2–§6.4 window semantics: every window open/call must be grounded in a recognized §5.1 man-not-ball foul, every close must carry a recognized reason (cancelled-last-touch-loss / cancelled-stoppage / expired) with a matching open and agree with the shared advantage policy. A window decision with no recognized foul FAILs; a stream with no observable advantage decision is honest NOT_EVALUATED; the unimplemented §6.2a judged-retained path is reported as BLOCKED_MISSING_REFERENCE (advantage_retention_ref) and never PASSed.",
    set_by: [
      "eval/contracts/suites.ts FOULS_SUITE (suite-fouls-v1, +FOULS-ADVANTAGE-PLAYED-001)",
      "eval/contracts/bindings.ts BINDING_FOULS_ADVANTAGE_PLAYED_001",
      "eval/contracts/common-criteria.ts ADVANTAGE_PLAYED",
      "eval/contracts/invariant-definitions.ts INV_FOUL_ADVANTAGE_PLAYED",
      "eval/oracles/fouls.ts checkFoulAdvantagePlayed (imports the shared src/simulation/foul-predicate.ts predicate and src/simulation/advantage-policy.ts window policy)",
      "eval/oracles/wire.ts + eval/runners/foundation-evaluator.ts CRITERION_TO_ORACLE",
      "NOT the browser composition root",
    ],
  },
  guard_state: {
    all_streams_character_identical_to_accepted: allStreamsIdenticalToAccepted,
    driven_two_run_attestation: runs.find((r) => r.id === "advantage-driven-cancelled")?.two_run_attested ?? false,
    organic_two_run_attestation: runs.find((r) => r.id === "advantage-organic-expired")?.two_run_attested ?? false,
    driven_gate_off_two_run_attestation: runs.find((r) => r.id === "advantage-driven-gate-off")?.two_run_attested ?? false,
    gate_off_byte_identity_to_pre_change: gateOffPin,
    baseline_hash_of_hashes: BASELINE_HASH_OF_HASHES,
    organic_advantage_decision_observable: organicRuns.some((r) => r.advantage_decisions_observable_in_stream),
    organic_advantage_played_pass: organicAdvantagePass,
    driven_advantage_played_not_evaluated: drivenAdvantageNotEvaluated,
    gate_off_advantage_played_not_evaluated:
      runs.find((r) => r.id === "advantage-gate-off-pin")?.advantage_played_outcome === "NOT_EVALUATED",
    retained_path_implemented: false,
    retained_path_reference: "advantage_retention_ref",
    retained_path_status: "BLOCKED_MISSING_REFERENCE",
  },
  runs,
  disclosures: [
    "ADVANTAGE-PLAYED is registered as the fifth executable protected oracle in suite-fouls-v1: criterion record ADVANTAGE_PLAYED (HARD_INVARIANT) -> INV_FOUL_ADVANTAGE_PLAYED (foul-advantage-played-evidence) -> foul-advantage-played-oracle-v1 (eval/oracles/fouls.ts checkFoulAdvantagePlayed). The registration's observation-definition and scenario are the SHARED registered obs-fouls-v1 and scn-fouls-lifecycle-v1, exactly as the three prior foul registrations — the advantage-window facts are carried by the same committed event stream the other foul oracles read.",
    "The §6.2a judged-retained path is NOT implemented and advantage_retention_ref is BLOCKED_MISSING_REFERENCE (§11). No accepted stream carries a retained-advantage decision, so no retained verdict is produced; the oracle reports a retained-path input honestly as blocked (status not_evaluated + blockedReference) and NEVER PASSes it. No retention envelope (territory / distance / possession) is invented.",
    "The driven-shape advantage decisions live in the CORE's persistent state (runDefensiveDuel.advantageEvents), not the per-step observation array (the runner serialization limit); the oracle therefore reports honest NOT_EVALUATED there and never invents a PASS. The runner serialization is NOT changed to make the oracle's job easier.",
    "Each reproduced stream is character-identical to its accepted ADVANTAGE-MACHINERY state-hash-of-hashes pin, so the verdicts are honest over the accepted streams, not over a re-shaped stream. NO suite-level PASS: verdicts are reported per criterion and per stream.",
    "Adding the fifth criterion is ADDITIVE: the four pre-existing foul criteria keep their unchanged oracles and produce the same verdicts on every stream the fouls suite previously evaluated. The only non-PASS verdict this objective newly records on an advantage stream is FREE-KICK-AWARD=FAIL on `advantage-organic-stoppage`: there the §6.3 new-stoppage cancellation (a goal at tick 1436) wins over the pending advantage, so the cancelled window's pending free-kick consequence cannot open a restart (the documented same-tick arbitration of §2.2 / ADVANTAGE-MACHINERY). The unchanged FREE-KICK-AWARD oracle — which requires every detected foul to be matched by a free kick — honestly FAILs that stream. That is a pre-existing criterion's honest read of an ADVANTAGE-MACHINERY-only stream, not a regression introduced by this objective; no free-kick stream's verdict changed.",
    "No PES fidelity claim: the window length (24 ticks) and pending-caution budget (12 ticks) are fouls-v1 VERSIONED_PROVISIONAL engine-tick budgets at foundation-fixed-dt-v1, not measured wall-clock latencies (advantage_window_ref_ms stays BLOCKED_MISSING_REFERENCE). No FOUNDATION_LAB_PASS or invented reference envelope.",
  ],
};

const claimsNotMade = [
  "No PASS for the retained path: the §6.2a judged-retained judgment is not implemented and advantage_retention_ref is BLOCKED_MISSING_REFERENCE; no stream carries a retained decision and the oracle never PASSes one.",
  "No ADVANTAGE-PLAYED PASS on the driven commit-only streams: their window decisions are not in the per-step observation array, so the oracle reports honest NOT_EVALUATED (the PASS/FAIL guards are proven by the canary tests, not by a re-shaped accepted stream).",
  "No retained-path implementation, no invented retention envelope, and no invented advantage_window_ref_ms.",
  "No suite-level PASS claim (verdicts are per criterion and per stream). No FOUNDATION_LAB_PASS, milestone or regression PASS claim, and no PES 2017 fidelity claim.",
  "No machinery change: git diff src/ is EMPTY (the advantage gate behavior, policy and event kinds are frozen at the accepted ADVANTAGE-MACHINERY state) and the runner serialization is UNCHANGED.",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  produced_by: "scripts/capture-advantage-suite-registration.ts",
  evidence_class: "MULTI_TICK",
  spec_sections: [
    "FOULS_CARDS_SPEC §5.1",
    "FOULS_CARDS_SPEC §6.2",
    "FOULS_CARDS_SPEC §6.3",
    "FOULS_CARDS_SPEC §6.4",
    "FOULS_CARDS_SPEC §6.5",
    "FOULS_CARDS_SPEC §10",
    "FOULS_CARDS_SPEC §11",
  ],
  runs: runs.map((r) => ({
    id: r.id,
    role: r.role,
    stream: r.stream,
    ticks: r.ticks,
    observation_count: r.observation_count,
    event_kind_counts: r.event_kind_counts,
    state_hash_of_hashes: r.state_hash_of_hashes,
    accepted_state_hash_of_hashes: r.accepted_state_hash_of_hashes,
    state_hash_chain_identical_to_accepted: r.state_hash_chain_identical_to_accepted,
    determinism_run2_hash_of_hashes: r.determinism_run2_hash_of_hashes,
    two_run_attested: r.two_run_attested,
    foul_count: r.foul_count,
    advantage_decisions_observable_in_stream: r.advantage_decisions_observable_in_stream,
    advantage_opened: r.advantage_opened,
    advantage_closed: r.advantage_closed,
    committed_advantage_decisions: r.committed_advantage_decisions,
    cards: r.cards,
    free_kicks: r.free_kicks,
    fouls_suite_verdicts: r.fouls_suite_verdicts,
    advantage_played_outcome: r.advantage_played_outcome,
  })),
  claims_not_made: claimsNotMade,
};

const forHashing: Record<string, unknown> = { ...record };
delete forHashing.record_sha256;
record.record_sha256 = sha256(JSON.stringify(forHashing));

writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectoryArtifact, null, 2)}\n`, "utf-8");
console.log(`[advantage-suite] wrote ${TRAJECTORY_PATH}`);
console.log(`[advantage-suite] all_streams_character_identical_to_accepted=${String(allStreamsIdenticalToAccepted)}`);
console.log(`[advantage-suite] gate_off_byte_identity_to_pre_change=${String(gateOffPin)}`);
for (const r of runs) {
  console.log(
    `[advantage-suite] ${r.id}: ADVANTAGE-PLAYED=${r.advantage_played_outcome} ` +
      `observable=${String(r.advantage_decisions_observable_in_stream)} ` +
      `opens=${r.advantage_opened.length} closes=${r.advantage_closed.length} ` +
      `acceptedIdentical=${String(r.state_hash_chain_identical_to_accepted)}`,
  );
}
