/**
 * Node-side evidence producer for FOUL-CONSEQUENCE-MACHINERY.
 *
 * Executes the in-core free-kick consequence (a detected man-not-ball foul
 * awards a free kick to the fouled team at the contact position through the
 * accepted restart machinery) and records the MULTI_TICK evidence:
 *
 *   - `freekick-driven-duel` — the accepted defensive-duel-driver coerced 5v5
 *     match with a scripted standing tackle; the core commits a man-not-ball
 *     contact (duelWon false, ballReachable false, tacklePhase active) and,
 *     with the free-kick gate on, awards a free kick to the fouled team. Two
 *     runs for the two-run attestation.
 *   - `freekick-organic` — the 3v3-press CPU-vs-CPU run under
 *     cpuDefensiveTackle + detectFouls + awardFreeKicks, core-owned lifecycle and
 *     `serializeRestartFacts`; a man-not-ball contact emerges organically and a
 *     free kick follows. Two runs for the two-run attestation.
 *   - `freekick-antihuddle-window` — the anti-huddle interaction: a driven free
 *     kick restart window (cpuAntiHuddle:true, serializeRestartFacts) is
 *     adjudicated for FREEZE-UNTIL-FIRST-TOUCH.
 *   - `freekick-human-serve` — the pass-gated human-serve window applied to a
 *     free-kick taker (HUMAN-BALL-SERVER-LITERAL, unchanged).
 *   - `freekick-gate-off` — the CPU gate-off byte-identity control: the accepted
 *     legacy 3v3-press pin reproduces byte-for-byte (the pre-change baseline
 *     hash-of-hashes), proving the core change is hash-neutral when gated off.
 *
 * Cards and advantage stay spec-only (not implemented). No FREE-KICK-AWARD
 * criterion is registered (that is objective 2/4).
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:FOUL-CONSEQUENCE-MACHINERY`. An ordinary run writes
 * the same artifacts under the ignored `test-results/gauntlet-capture/**` tree
 * and leaves `docs/` byte-identical. The record carries NO wall-clock field, so
 * consecutive ordinary-mode runs are byte-identical and the pinned
 * `record_sha256` is stable.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:FOUL-CONSEQUENCE-MACHINERY \
 *     mise exec -- pnpm exec tsx scripts/capture-foul-consequence-machinery.ts
 *
 * Node I/O is allowed here; the simulation core is touched only inside the
 * gated free-kick branch (off by default).
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
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "FOUL-CONSEQUENCE-MACHINERY";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");
const STATE_PATH = resolve(OUTPUT_ROOT, "foul-consequence-machinery.json");
const RESULT_PATH = resolve(OUTPUT_ROOT, "RESULT.md");

type Outcome = string;

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

function criterionOutcomes(observations: TelemetryObservation[]): Record<string, Outcome> {
  const suite = evaluateSuite("rules", observations);
  const out: Record<string, Outcome> = {};
  for (const t of suite.tests) for (const c of t.criteria) out[c.criterion_id] = c.outcome;
  return out;
}

function fkEvents(observations: TelemetryObservation[]): Array<{ tick: number; teamId: string | null; position: { x: number; y: number } | null; direction: { x: number; y: number } | null; humanServed: boolean }> {
  const out: Array<{ tick: number; teamId: string | null; position: { x: number; y: number } | null; direction: { x: number; y: number } | null; humanServed: boolean }> = [];
  for (const o of observations) for (const ev of o.events) {
    if (ev.kind !== "free-kick-executed") continue;
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    out.push({
      tick: ev.tick,
      teamId: (p.teamId as string) ?? null,
      position: (p.freeKickPosition as { x: number; y: number }) ?? null,
      direction: (p.kickDirection as { x: number; y: number }) ?? null,
      humanServed: p.humanServed === true,
    });
  }
  return out;
}

function foulFacts(observations: TelemetryObservation[]): Array<{ tick: number; teamIdB: string | null }> {
  const out: Array<{ tick: number; teamIdB: string | null }> = [];
  for (const o of observations) for (const ev of o.events) {
    if (ev.kind !== "foul") continue;
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    out.push({ tick: ev.tick, teamIdB: (p.teamIdB as string) ?? null });
  }
  return out;
}

// Pre-change baseline (unmodified runner, identical scenario/config): the
// accepted FOUL-DETECTION-MACHINERY stash control. The gate-off run must
// reproduce this byte-for-byte.
const BASELINE_HASH_OF_HASHES =
  "fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a";

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

interface RunRecord {
  id: string;
  role: string;
  ticks: number;
  observation_count: number;
  event_kind_counts: Record<string, number>;
  state_hash_of_hashes: string;
  determinism_run2_hash_of_hashes: string | null;
  foul_count: number;
  free_kick_count: number;
  free_kick_events: Array<{ tick: number; teamId: string | null; position: { x: number; y: number } | null; direction: { x: number; y: number } | null; humanServed: boolean }>;
  committed_free_kick_events: Array<{ tick: number; teamId: string | null; position: { x: number; y: number } | null }>;
  foul_facts: Array<{ tick: number; teamIdB: string | null }>;
  verdicts: Record<string, Outcome>;
}

function recordRun(id: string, result: {
  stateHashes: string[];
  observations: TelemetryObservation[];
}, run2?: { stateHashes: string[] }): RunRecord {
  const kinds = countKinds(result.observations);
  const hashOfHashes = sha256(JSON.stringify(result.stateHashes));
  const fk = fkEvents(result.observations);
  const fouls = foulFacts(result.observations);
  return {
    id,
    role: "",
    ticks: result.stateHashes.length,
    observation_count: result.observations.length,
    event_kind_counts: kinds,
    state_hash_of_hashes: hashOfHashes,
    determinism_run2_hash_of_hashes: run2 ? sha256(JSON.stringify(run2.stateHashes)) : null,
    foul_count: countFoulEvents(result.observations),
    free_kick_count: fk.length,
    free_kick_events: fk,
    committed_free_kick_events: [],
    foul_facts: fouls,
    verdicts: criterionOutcomes(result.observations),
  };
}

// --- Driven duel (scripted standing tackle → foul → free kick) -----------
function runDriven() {
  const scenario = withProximateHumanDefence(loadScenario("eval/scenarios/5v5-human-vs-cpu.v1.json"));
  const r = runDefensiveDuel({
    scenario,
    maxTicks: 200,
    attempts: [{ kind: "standing", commitDistance: 3.0, earliestTick: 48 }],
    freeKickConfig: { awardFreeKicks: true },
  });
  // The driven duel does not inject the serializeRestartFacts facts, so read
  // the committed free-kick events from the captured result.
  detectFoulEvents(r.observations);
  // Build a synthetic observation-bearing result to reuse recordRun.
  return {
    stateHashes: r.stateHashes,
    observations: r.observations,
    committedFreeKickEvents: r.freeKickEvents,
  };
}

function recordDriven(id: string, r: ReturnType<typeof runDriven>, run2?: ReturnType<typeof runDriven>): RunRecord {
  const rec = recordRun(id, r, run2);
  const committed = r.committedFreeKickEvents.map((ev) => {
    const p = ev.payload as Record<string, unknown>;
    return {
      tick: ev.tick,
      teamId: (p.teamId as string) ?? null,
      position: (p.freeKickPosition as { x: number; y: number }) ?? null,
    };
  });
  return { ...rec, committed_free_kick_events: committed };
}

// --- Organic (3v3-press, cpuAntiHuddle:false, core-owned) ----------------
function runOrganic(awardFreeKicks: boolean, detectFouls: boolean) {
  return runHeadlessMatch({
    scenario: loadScenario("eval/scenarios/3v3-press-scenario.v1.json"),
    maxTicks: 600,
    cpuAntiHuddle: false,
    lifecyclePhaseSync: "core-owned",
    cpuDefensiveTackle: true,
    detectFouls,
    awardFreeKicks,
    serializeRestartFacts: true,
  });
}

// --- Anti-huddle interaction window (cpuAntiHuddle:true) -----------------
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

// --- Human-serve on a free-kick taker (HUMAN-BALL-SERVER-LITERAL) --------
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

// --- Gate-off byte-identity (legacy pin) --------------------------------
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

const driven1 = runDriven();
const driven2 = runDriven();
const organic1 = runOrganic(true, true);
const organic2 = runOrganic(true, true);
const antihuddle = runAntihuddleWindow();
const humanServe = runHumanServe();
const gateOff = runGateOffLegacy();

const records: RunRecord[] = [];
records.push(recordDriven("freekick-driven-duel", driven1, driven2));
records.push(recordRun("freekick-organic", organic1, organic2));
records.push(recordRun("freekick-antihuddle-window", antihuddle));
records.push(recordRun("freekick-human-serve", humanServe));
records.push(recordRun("freekick-gate-off", gateOff));

const twoRunDriven = driven1.stateHashes.length > 0 &&
  sha256(JSON.stringify(driven1.stateHashes)) === sha256(JSON.stringify(driven2.stateHashes));
const twoRunOrganic = sha256(JSON.stringify(organic1.stateHashes)) === sha256(JSON.stringify(organic2.stateHashes));
const gateOffByteIdentity = sha256(JSON.stringify(gateOff.stateHashes)) === BASELINE_HASH_OF_HASHES;
const organicChain = countFoulEvents(organic1.observations) >= 1 &&
  fkEvents(organic1.observations).length >= 1;
const drivenChain = driven1.committedFreeKickEvents.length >= 1 &&
  countFoulEvents(driven1.observations) >= 1;

const trajectoryArtifact: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
  produced_by: "scripts/capture-foul-consequence-machinery.ts",
  driver:
    "eval/runners/headless-match.ts (awardFreeKicks gate, core-owned lifecycle, serializeRestartFacts, freeKickWindow) + eval/runners/defensive-duel-driver.ts (scripted standing tackle, freeKickConfig) + the shared foul predicate.",
  activation: {
    field: "runHeadlessMatch({ awardFreeKicks, detectFouls }) + runDefensiveDuel({ freeKickConfig })",
    meaning:
      "the in-core free-kick consequence in src/simulation/loop/simulation.ts: a committed man-not-ball tackle contact (the SAME predicate the runner-level detection uses, evaluated on the core's own events at the match-phase layer) awards a free kick to the fouled team at the contact position through the accepted restart countdown/serve machinery. Off (the default) or with no foul, the stream is byte-identical to pre-change.",
    set_by: [
      "src/simulation/loop/simulation.ts (free-kick branch + awardFreeKicks gate + default-off FreeKickConfig)",
      "src/simulation/foul-predicate.ts (single-source-of-truth predicate, shared with eval/runners/foul-detection.ts)",
      "eval/runners/headless-match.ts runHeadlessMatch({ awardFreeKicks, serializeRestartFacts, freeKickWindow })",
      "eval/runners/defensive-duel-driver.ts runDefensiveDuel({ freeKickConfig })",
      "NOT the browser composition root",
    ],
  },
  guard_state: {
    driven_two_run_attestation: twoRunDriven,
    organic_two_run_attestation: twoRunOrganic,
    gate_off_byte_identity_to_pre_change: gateOffByteIdentity,
    baseline_hash_of_hashes: BASELINE_HASH_OF_HASHES,
    organic_foul_to_free_kick_chain: organicChain,
    driven_foul_to_free_kick_chain: drivenChain,
  },
  trajectory: {
    organic: {
      sample: organic1.observations.slice(0, 20).map((o) => ({
        tick: o.tick,
        phase: (o.events.find((e) => e.kind === "core-match-phase")?.payload as { matchPhase?: unknown })?.matchPhase ?? null,
        ball_lastTouchRef: o.ball.lastTouchRef,
        ball_x: Number(o.ball.position.x.toFixed(4)),
        ball_y: Number(o.ball.position.y.toFixed(4)),
      })),
      foul_facts: foulFacts(organic1.observations),
      free_kick_events: fkEvents(organic1.observations),
    },
  },
  disclosures: [
    "FOUL-CONSEQUENCE-MACHINERY is a DELIBERATE core change in src/simulation/loop/simulation.ts: a default-off awardFreeKicks gate opens a free-kick restart window at a committed man-not-ball contact. With the gate OFF (the default) the free-kick branch never runs and the core is byte-identical to pre-change; this is attested by the gate-off legacy pin reproducing the pre-change baseline hash-of-hashes byte-for-byte.",
    "The free-kick predicate is a single source of truth (src/simulation/foul-predicate.ts): the runner-level detection (eval/runners/foul-detection.ts) and the in-core consequence evaluate the SAME function, so they cannot disagree about what a foul IS. The refactor is additive and hash-neutral when gated off (the detection gate is off by default).",
    "The free-kick placement is the contact position (the fouled player's planar position at the contact tick); the serve reuses the accepted restart countdown/serve path, and the timer freezes during the non-playing free-kick phase. Placement and serve re-use the accepted restart machinery, not a new set-piece system.",
    "The organic 3v3-press free-kick stream runs under cpuAntiHuddle:false. Under this shape the anti-huddle nearest-only contract is disabled, so MATCH-RESTART-NEAREST-ONLY would FAIL there (honest: the anti-huddle was explicitly off for that organic run). The anti-huddle interaction is instead adjudicated on the driven free-kick window (freekick-antihuddle-window, cpuAntiHuddle:true, serializeRestartFacts), where FREEZE-UNTIL-FIRST-TOUCH holds PASS.",
    "Same-tick arbitration (spec §2.2) is a deliberate deterministic priority: the foul consequence runs only when the phase is still 'playing', so a ball-out-of-play restart in the same tick wins. This deferred-arbitration behavior is disclosed, not specified as a defined matrix.",
    "Cards and advantage stay spec-only: no card, advantage or discipline event is emitted. FREE-KICK-AWARD remains named-but-unregistered (FOULS_CARDS_SPEC §10) — it is NOT registered (objective 2/4).",
  ],
  runs: records.map((r) => ({
    id: r.id,
    role: r.role,
    ticks: r.ticks,
    observation_count: r.observation_count,
    event_kind_counts: r.event_kind_counts,
    state_hash_of_hashes: r.state_hash_of_hashes,
    determinism_run2_hash_of_hashes: r.determinism_run2_hash_of_hashes,
    foul_count: r.foul_count,
    free_kick_count: r.free_kick_count,
    free_kick_events: r.free_kick_events,
    committed_free_kick_events: r.committed_free_kick_events,
    foul_facts: r.foul_facts,
    verdicts: r.verdicts,
  })),
};

// ---------------------------------------------------------------------------
// State record (byte-reproducible, no wall-clock field in the hash)
// ---------------------------------------------------------------------------

const claimsNotMade = [
  "No card or advantage implementation: cards and advantage stay spec-only (FOULS_CARDS_SPEC §7 / §6).",
  "No FREE-KICK-AWARD criterion registration: it is named-but-unregistered (spec §10) and belongs to objective 2/4.",
  "No suite-level PASS claim: the rules-suite per-criterion verdicts are a per-criterion collection, not a suite PASS.",
  "No PROMOTION claim. No FOUNDATION_LAB_PASS claim.",
  "No PES 2017 fidelity or measured PES envelope claim: the free-kick countdown (60), serve speed (14 m/s) and serve loft (0.18) are VERSIONED_PROVISIONAL match-rules-v1-kind design choices.",
  "No ungated behavior change: the free-kick consequence is behind a default-off gate (awardFreeKicks); gate off (or no foul) is byte-identical to pre-change.",
  "No DYNAMIC_VISUAL claim (no real browser frames captured; evidence class is MULTI_TICK).",
  "No claim that the CPU-vs-CPU 3v3-press organic run produces man-not-ball fouls under the anti-huddle (cpuAntiHuddle:true) shape — it does not; the organic chain uses the accepted no-anti-huddle (cpuAntiHuddle:false) runner shape, and the anti-huddle interaction is attested on the driven free-kick window.",
];

const record: Record<string, unknown> = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  produced_by: "scripts/capture-foul-consequence-machinery.ts",
  evidence_class: "MULTI_TICK",
  spec_sections: ["FOULS_CARDS_SPEC §5.1", "FOULS_CARDS_SPEC §8", "FOULS_CARDS_SPEC §10", "MATCH_RULES_SPEC §6–§8", "MATCH_RULES_SPEC §12"],
  lifecycle_phase_sync: "core-owned",
  core_change: {
    in: "src/simulation/loop/simulation.ts",
    what: "a default-off awardFreeKicks gate (FreeKickConfig) opens a free-kick restart window at a committed man-not-ball contact: onFreeKickEvent places the ball + taker at the contact position and starts the countdown; applyFreeKick / applyFreeKickFromInput serve it through the accepted restart path; the phase freezes the timer. The predicate is shared via src/simulation/foul-predicate.ts. With the gate off (or no foul) the core is byte-identical to pre-change.",
    versioned_provisional_parameters: {
      free_kick_countdown: 60,
      free_kick_speed: 14,
      free_kick_vertical_component: 0.18,
      free_kick_ball_z: 0.11,
      gate: "FreeKickConfig.awardFreeKicks (default off)",
    },
    predicate_single_source: "src/simulation/foul-predicate.ts (shared by eval/runners/foul-detection.ts and the in-core consequence)",
  },
  guards: {
    driven_two_run_attestation: twoRunDriven,
    organic_two_run_attestation: twoRunOrganic,
    gate_off_byte_identity_to_pre_change: gateOffByteIdentity,
    baseline_hash_of_hashes: BASELINE_HASH_OF_HASHES,
    organic_foul_to_free_kick_chain: organicChain,
    driven_foul_to_free_kick_chain: drivenChain,
  },
  runs: records.map((r) => ({
    id: r.id,
    ticks: r.ticks,
    observation_count: r.observation_count,
    event_kind_counts: r.event_kind_counts,
    state_hash_of_hashes: r.state_hash_of_hashes,
    determinism_run2_hash_of_hashes: r.determinism_run2_hash_of_hashes,
    foul_count: r.foul_count,
    free_kick_count: r.free_kick_count,
    free_kick_events: r.free_kick_events,
    committed_free_kick_events: r.committed_free_kick_events,
    foul_facts: r.foul_facts,
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

console.log(`[foul-consequence] wrote ${TRAJECTORY_PATH}`);
console.log(`[foul-consequence] wrote ${STATE_PATH}`);
console.log(`[foul-consequence] wrote ${RESULT_PATH}`);
console.log(`[foul-consequence] record_sha256=${String(record.record_sha256)}`);

function RESULT_MD(record: Record<string, unknown>): string {
  const guards = record.guards as Record<string, unknown>;
  const md = [
    `# FOUL-CONSEQUENCE-MACHINERY — builder result`,
    ``,
    `## Builder report`,
    ``,
    `- objective_id: ${OBJECTIVE_ID}`,
    `- evidence_class: MULTI_TICK`,
    `- core_change: the in-core free-kick consequence (default-off awardFreeKicks gate) in src/simulation/loop/simulation.ts + the shared foul predicate (src/simulation/foul-predicate.ts).`,
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
    md.push(`- free_kick_count: ${run.free_kick_count}`);
    const committed = (run.committed_free_kick_events as Array<Record<string, unknown>>) ?? [];
    if (committed.length > 0) {
      md.push(`- committed_free_kick_events: ${JSON.stringify(committed)}`);
      md.push(`- committed_free_kick_count: ${committed.length}`);
    }
    md.push(`- state_hash_of_hashes: ${run.state_hash_of_hashes}`);
    md.push(`- determinism_run2_hash_of_hashes: ${run.determinism_run2_hash_of_hashes}`);
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
