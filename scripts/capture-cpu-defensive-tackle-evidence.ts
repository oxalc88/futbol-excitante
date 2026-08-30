/**
 * Node-side evidence producer for CPU-DEFENSIVE-TACKLE.
 *
 * Writes `docs/evidence/CPU-DEFENSIVE-TACKLE/trajectory.json`: coherent
 * CPU-vs-CPU small-sided matches in which every defensive tackle is committed
 * by the CPU team-decision profile itself (no scripted tackle input anywhere in
 * these runs), recorded as per-tick committed hashes with the tackle phases,
 * contacts, outcomes and recovery cost of each committed attempt, plus the
 * honest situation-scanner read of `PHYSICAL_DUEL`.
 *
 * Usage (each step is long; the artifact merges by run id):
 *   npx tsx scripts/capture-cpu-defensive-tackle-evidence.ts --only=3v3-cpu-vs-cpu,5v5-cpu-vs-cpu
 *   npx tsx scripts/capture-cpu-defensive-tackle-evidence.ts --only=3v3-cpu-vs-cpu-extended
 *
 * Node I/O is allowed here; the simulation core is untouched.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  runCpuTackleMatch,
  trimToCompleteAttempts,
  type CpuTackleMatchResult,
} from "../eval/runners/cpu-tackle-match.js";
import { scanMatchResult } from "../eval/runners/small-sided-match-situation-scanner.js";
import { evaluateSuite } from "../eval/runners/foundation-evaluator.js";
import {
  getCpuTackleCommitActivations,
  resetMechanismCounters,
} from "../src/adapters/input-browser/cpu-adapter.js";
import {
  FOUNDATION_CPU_TACKLE_V1,
  FOUNDATION_TACKLE_V1,
} from "../src/simulation/config/foundation.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "CPU-DEFENSIVE-TACKLE";
const EVIDENCE_DIR = resolve("docs/evidence", OBJECTIVE_ID);
const ARTIFACT_PATH = resolve(EVIDENCE_DIR, "trajectory.json");

/** One pinned run: label, scenario path and tick budget. */
interface RunSpec {
  id: string;
  scenarioPath: string;
  ticks: number;
  /** Per-tick records and full hashes are only written for the primary windows. */
  detailed: boolean;
}

const RUNS: RunSpec[] = [
  {
    id: "3v3-cpu-vs-cpu",
    scenarioPath: "eval/scenarios/3v3-press-scenario.v1.json",
    ticks: 600,
    detailed: true,
  },
  {
    id: "5v5-cpu-vs-cpu",
    scenarioPath: "eval/scenarios/5v5-continuous-play.v1.json",
    ticks: 600,
    detailed: true,
  },
  {
    id: "3v3-cpu-vs-cpu-extended",
    scenarioPath: "eval/scenarios/3v3-press-scenario.v1.json",
    ticks: 1800,
    detailed: false,
  },
];

const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const selected = onlyArg
  ? new Set(onlyArg.slice("--only=".length).split(",").map((id) => id.trim()))
  : new Set(RUNS.map((run) => run.id));

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

function outcomeTally(result: CpuTackleMatchResult): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const attempt of result.attempts) {
    tally[attempt.outcome] = (tally[attempt.outcome] ?? 0) + 1;
  }
  return tally;
}

/** Executable duels-suite outcome for one protected criterion. */
function criterionOutcome(
  observations: CpuTackleMatchResult["observations"],
  testId: string,
  criterionId: string,
): string {
  const result = evaluateSuite("duels", observations);
  const test = result.tests.find((t) => t.test_id === testId);
  const criterion = test?.criteria.find((c) => c.criterion_id === criterionId);
  return criterion?.outcome ?? "MISSING";
}

interface RunRecord {
  id: string;
  scenario: string;
  scenario_path: string;
  ticks: number;
  reproduction: string;
  state_hashes?: string[];
  state_hash_samples?: Array<{ tick: number; hash: string }>;
  per_tick?: unknown[];
  cpu_tackle_presses: unknown[];
  attempts: unknown[];
  summary: Record<string, unknown>;
  duels_suite: Record<string, string>;
  situation_scan: {
    physical_duel: Record<string, unknown>;
    summary: Record<string, number>;
  };
}

function buildRunRecord(spec: RunSpec): RunRecord {
  const scenario = loadScenario(spec.scenarioPath);

  resetMechanismCounters();
  const result = trimToCompleteAttempts(
    runCpuTackleMatch({ scenario, maxTicks: spec.ticks, cpuDefensiveTackle: true }),
  );
  const cpuPresses = getCpuTackleCommitActivations();

  const scan = scanMatchResult(result.events, result.observations);
  const duel = scan.localizations.find((l) => l.situation_id === "PHYSICAL_DUEL");
  const rejections = result.events.filter((e) => e.kind === "input-rejection");

  const record: RunRecord = {
    id: spec.id,
    scenario: scenario.id,
    scenario_path: spec.scenarioPath,
    ticks: result.totalTicks,
    reproduction:
      `runCpuTackleMatch({ scenario: load(${JSON.stringify(spec.scenarioPath)}), ` +
      `maxTicks: ${spec.ticks}, cpuDefensiveTackle: true }) then trimToCompleteAttempts(...)`,
    cpu_tackle_presses: result.presses,
    attempts: result.attempts,
    summary: {
      cpu_presses_reported_by_adapters: cpuPresses,
      presses_recorded: result.presses.length,
      attempts: result.attempts.length,
      attempts_issued_by_cpu: result.attempts.filter((a) => a.cpuIssued).length,
      teams_that_committed: [...new Set(result.attempts.map((a) => a.teamId))].sort(),
      players_that_committed: [...new Set(result.attempts.map((a) => a.playerId))].sort(),
      kinds_committed: [...new Set(result.attempts.map((a) => a.kind))].sort(),
      outcomes: outcomeTally(result),
      duel_contacts: result.attempts.filter((a) => a.opponentContactTick !== null).length,
      ball_contacts: result.attempts.filter((a) => a.ballContactTick !== null).length,
      duels_won: result.attempts.filter((a) => a.duelWon === true).length,
      duels_lost: result.attempts.filter((a) => a.duelWon === false).length,
      ground_conceded_during_recovery_metres: result.attempts
        .filter((a) => a.recovery)
        .map((a) => Number(a.recovery!.concededMetres.toFixed(3))),
      input_rejections: rejections.length,
    },
    duels_suite: {
      "TACK-ST-001-PHASE": criterionOutcome(
        result.observations,
        "TACK-ST-001",
        "TACK-ST-001-PHASE",
      ),
      "TACK-SL-001-PHASE": criterionOutcome(
        result.observations,
        "TACK-SL-001",
        "TACK-SL-001-PHASE",
      ),
    },
    situation_scan: {
      physical_duel: duel
        ? {
            presence: duel.presence,
            total_relevant_events: duel.totalRelevantEvents,
            observed_kinds: duel.observedKinds,
            tick_range: duel.tickRange ?? null,
            verdicts: duel.clusters.map((cluster) => ({
              ticks: [cluster.startTick, cluster.endTick],
              verdict: cluster.verdict,
              reason: cluster.verdictReason,
            })),
          }
        : { presence: "MISSING" },
      summary: { ...scan.summary },
    },
  };

  if (spec.detailed) {
    record.state_hashes = result.stateHashes;
    record.per_tick = result.ticks;
  } else {
    // Long window: keep the attempt-boundary hashes so the record stays
    // verifiable without pinning thousands of duplicate lines.
    const samples = new Set<number>();
    for (const attempt of result.attempts) {
      samples.add(attempt.startTick);
      if (attempt.phaseTicks.release !== null) samples.add(attempt.phaseTicks.release);
    }
    samples.add(result.totalTicks);
    record.state_hash_samples = [...samples]
      .sort((a, b) => a - b)
      .map((tick) => ({ tick, hash: result.stateHashes[tick - 1] ?? "" }));
  }

  console.log(
    `[cpu-tackle-evidence] ${spec.id}: ticks=${record.ticks}` +
      ` attempts=${record.summary.attempts} presses=${cpuPresses}` +
      ` outcomes=${JSON.stringify(record.summary.outcomes)}` +
      ` duels=${JSON.stringify(record.duels_suite)}` +
      ` PHYSICAL_DUEL=${duel?.presence} scan=${JSON.stringify(scan.summary)}`,
  );
  return record;
}

// ---------------------------------------------------------------------------
// Artifact assembly (merges by run id so long windows can be captured in steps)
// ---------------------------------------------------------------------------

interface Artifact {
  schema_version: number;
  objective_id: string;
  evidence_class: string;
  produced_by: string;
  driver: string;
  activation: Record<string, unknown>;
  configs: Record<string, unknown>;
  no_scripted_tackle_input: string;
  runs: RunRecord[];
  disclosures: string[];
}

const scaffold: Artifact = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  produced_by: "scripts/capture-cpu-defensive-tackle-evidence.ts",
  driver: "eval/runners/cpu-tackle-match.ts over the accepted eval/runners/headless-match.ts wiring",
  activation: {
    field: "CpuObservation.cpuDefensiveTackle",
    meaning:
      "the CPU slot's controller exposes STANDING_TACKLE_BIT / SLIDE_TACKLE_BIT — the same bits the human keyboard binds — and grants no knowledge beyond what the observation already carries",
    set_by: [
      "src/apps/browser/main.ts (browser match composition root)",
      "runHeadlessMatch({ cpuDefensiveTackle: true }) (these pinned runs)",
    ],
  },
  configs: {
    cpu_tackle_decision: FOUNDATION_CPU_TACKLE_V1.id,
    tackle_action: FOUNDATION_TACKLE_V1.id,
    all_values_provisional: true,
    cpu_tackle_decision_values: Object.fromEntries(
      Object.entries(FOUNDATION_CPU_TACKLE_V1)
        .filter(([key]) => key !== "id" && key !== "label")
        .map(([key, entry]) => [key, (entry as { value: unknown }).value]),
    ),
  },
  no_scripted_tackle_input:
    "Every control slot in these runs is driven by the CPU adapter with the team-decision profile; no frame carries a tackle bit that a script pressed.",
  runs: [],
  disclosures: [
    "PHYSICAL_DUEL stays insufficient_context in the accepted scanner for CPU-vs-CPU play: the required kind (player-player-contact) is now produced by genuine CPU tackle duels, but the situation's indicative kind (input-rejection) still needs a ball action pressed into a rejection window, which organic CPU-vs-CPU play did not produce in these windows.",
    "No CPU commit in these windows ended with no contact at all: a justifiable commit normally wins or contests the ball. The failed challenge that is recorded (contact made, ball not won) pays its full recovery window while the opposition gains ground.",
    "Every CPU tackle threshold used here is provisional configuration (foundation-cpu-tackle-v1). No PES 2017 envelope, timing or rating mapping is claimed.",
  ],
};

let artifact: Artifact = scaffold;
try {
  const existing = JSON.parse(readFileSync(ARTIFACT_PATH, "utf-8")) as Artifact;
  if (existing?.objective_id === OBJECTIVE_ID && Array.isArray(existing.runs)) {
    artifact = existing;
  }
} catch {
  /* first pass: start from the scaffold */
}

mkdirSync(EVIDENCE_DIR, { recursive: true });

for (const spec of RUNS) {
  if (!selected.has(spec.id)) continue;
  const record = buildRunRecord(spec);
  const index = artifact.runs.findIndex((run) => run.id === spec.id);
  if (index >= 0) artifact.runs[index] = record;
  else artifact.runs.push(record);
}

// Keep the declared order regardless of the capture sequence.
artifact.runs.sort(
  (a, b) => RUNS.findIndex((run) => run.id === a.id) - RUNS.findIndex((run) => run.id === b.id),
);

writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, "utf-8");
console.log(
  `[cpu-tackle-evidence] wrote ${ARTIFACT_PATH} (runs: ${artifact.runs.map((r) => r.id).join(", ")})`,
);
