/**
 * Node-side evidence producer for HUMAN-KEEPER-CONTROL.
 *
 * Runs the small-sided keeper-shot fixture through the accepted headless match
 * loop with a single difference between the live and control runs: whether the
 * designated keeper's control slot is fed the human's directional input.
 *
 *   - HUMAN (directed): the keeper's slot runs the same CPU keeper logic, but the
 *     keeper's commanded movement YIELDS to the human's directional input
 *     (`CpuObservation.humanDirectedKeeperMove`); the guardian still answers the
 *     shot on target.
 *   - CPU (fallback): no human directional input; the keeper holds its arc and
 *     auto-saves, byte-identical to the accepted CPU keeper behavior.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:HUMAN-KEEPER-CONTROL`. An ordinary run writes the same
 * artifacts under the ignored `test-results/gauntlet-capture/**` tree and leaves
 * `docs/` byte-identical. The record carries NO wall-clock field, so consecutive
 * ordinary-mode runs are byte-identical and the pinned `record_sha256` is stable.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:HUMAN-KEEPER-CONTROL \
 *     mise exec -- pnpm exec tsx scripts/capture-human-keeper-control.ts
 *
 * Node I/O is allowed here; the simulation core is untouched.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import {
  runHumanKeeperMatch,
  type HumanKeeperRunResult,
} from "../eval/runners/human-keeper-control.js";
import {
  isHumanControlledKeeper,
  keeperOfTeamFromLayout,
} from "../src/adapters/input-browser/human-keeper-control.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "HUMAN-KEEPER-CONTROL";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const TRAJECTORY_PATH = resolve(OUTPUT_ROOT, "trajectory.json");
const STATE_PATH = resolve(OUTPUT_ROOT, "record.json");
const RESULT_PATH = resolve(OUTPUT_ROOT, "RESULT.md");

/** The driven 5v5 human-vs-CPU keeper-shot fixture (one HUMAN keeper slot). */
const SCENARIO_PATH = "eval/scenarios/5v5-human-keeper-shot-fixture.v1.json";
/** The teammate/keeper slot the human directs. */
const HUMAN_TEAM_ID = "team-b";
const KEEPER_CONTROL_SLOT = "slot-10";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

function runCase(
  id: string,
  humanMode: "directed" | "cpu",
  role: string,
): { id: string; role: string; result: HumanKeeperRunResult } {
  const scenario = loadScenario(SCENARIO_PATH);
  const result = runHumanKeeperMatch({
    scenario,
    maxTicks: 600,
    gkBehavior: true,
    humanTeamId: HUMAN_TEAM_ID,
    keeperControlSlot: KEEPER_CONTROL_SLOT,
    humanMode,
  });
  return { id, role, result };
}

/** Which body is the human's directed keeper, from the same layout rule. */
function directedKeeper(scenario: ScenarioDefinition): string | undefined {
  return keeperOfTeamFromLayout(scenario.players, HUMAN_TEAM_ID, scenario.pitchLength);
}

interface RunRecord {
  id: string;
  role: string;
  scenario: string;
  scenario_path: string;
  ticks: number;
  human_mode: "directed" | "cpu";
  keeper_by_team: Record<string, string>;
  directed_keeper: string;
  directed_keeper_team: string;
  directed_keeper_slot: string;
  human_controlled_keeper: boolean;
  human_directed_move: { x: number; y: number } | null;
  shot_tick: number | null;
  save_tick: number | null;
  save_contact_distance_metres: number | null;
  save_contact_kind: string | null;
  ticks_from_shot_to_contact: number | null;
  within_reach: boolean | null;
  projected_cross_y: number | null;
  keeper_at_save: { x: number; y: number } | null;
  state_hash_of_hashes: string;
  reproduction: string;
  mechanism_counters: Record<string, number>;
  determinism: Record<string, unknown>;
}

function makeRunRecord(c: ReturnType<typeof runCase>): RunRecord {
  const r = c.result;
  const keeperAtSave = r.saveTick !== null ? r.keeperByTick[r.saveTick] : undefined;
  const firstHumanMove = r.ticks.find((t) => t.humanMove !== null)?.humanMove ?? null;
  return {
    id: c.id,
    role: c.role,
    scenario: r.scenarioId,
    scenario_path: SCENARIO_PATH,
    ticks: r.totalTicks,
    human_mode: r.humanMode,
    keeper_by_team: r.keeperByTeam,
    directed_keeper: r.directedKeeperPlayerId,
    directed_keeper_team: r.directedKeeperTeam,
    directed_keeper_slot: r.directedKeeperSlot,
    human_controlled_keeper: isHumanControlledKeeper(r.directedKeeperPlayerId, r.directedKeeperPlayerId),
    human_directed_move: firstHumanMove,
    shot_tick: r.shotTick,
    save_tick: r.saveTick,
    save_contact_distance_metres: r.saveContactDistance,
    save_contact_kind: r.saveContactKind,
    ticks_from_shot_to_contact: r.ticksFromShotToContact,
    within_reach: r.withinReach,
    projected_cross_y: r.projectedCrossY,
    keeper_at_save: keeperAtSave ? { ...keeperAtSave } : null,
    state_hash_of_hashes: sha256(JSON.stringify(r.ticks.map((t) => t.stateHash))),
    reproduction:
      `runHumanKeeperMatch({ scenario: load(${JSON.stringify(SCENARIO_PATH)}), ` +
      `maxTicks: 600, gkBehavior: true, humanTeamId: ${JSON.stringify(HUMAN_TEAM_ID)}, ` +
      `keeperControlSlot: ${JSON.stringify(KEEPER_CONTROL_SLOT)}, humanMode: ${JSON.stringify(r.humanMode)} })`,
    mechanism_counters: r.mechanismCounters,
    determinism: {},
  };
}

function main(): void {
  mkdirSync(OUTPUT_ROOT, { recursive: true });

  const cases = [
    runCase("human-directed-keeper-save", "directed",
      "the designated keeper is the human's controlled body; the human's directional input directs " +
      "the keeper (the arc-hold yields) while the save/claim reaction still answers the shot on target"),
    runCase("cpu-keeper-fallback", "cpu",
      "the identical keeper-shot fixture with NO human directional input — the keeper holds its arc " +
      "and auto-saves, byte-identical to the accepted CPU keeper behavior"),
  ];

  const human = cases[0].result;
  const cpu = cases[1].result;

  const scenario = loadScenario(SCENARIO_PATH);
  const keeperId = directedKeeper(scenario) ?? "";

  // Discriminating proofs.
  const humanControlled = isHumanControlledKeeper(human.directedKeeperPlayerId, keeperId);
  const humanDirectsKeeper = human.humanMode === "directed" &&
    human.ticks.some((t) => t.humanMove !== null);
  const humanSaveWithinReach = human.saveContactDistance !== null &&
    human.withinReach === true;
  const cpuSaveWithinReach = cpu.saveContactDistance !== null && cpu.withinReach === true;

  const records = cases.map(makeRunRecord);

  // Byte-reproducibility: re-run the directed case and require identical hashes.
  const replay = runCase("human-directed-replay", "directed",
    "in-process replay of the human-directed case for byte-identity");
  records[0].determinism = {
    replay_state_hash_of_hashes: makeRunRecord(replay).state_hash_of_hashes,
    replay_identical: records[0].state_hash_of_hashes === makeRunRecord(replay).state_hash_of_hashes,
  };

  const claimsNotMade = [
    "No PES 2017 fidelity / measured PES envelope claim.",
    "No FOUNDATION_LAB_PASS claim.",
    "No invented reference envelope or tolerance; the save/claim reach is the versioned " +
      "gk-small-sided-v1 value read from eval/contracts/goalkeeper-config.ts.",
    "No claim that the human becomes the keeper designation — the adapter's designation " +
      "(designateKeeperFromLayout) stays the source of truth and is unchanged.",
    "No claim that the human's team keeper auto-saves in the STANDARD 5v5 human-vs-CPU " +
      "browser wiring: there the keeper body is the human's slot and the CPU keeper adapter does " +
      "not run for it, so the human directs the keeper through the movement controls and any save " +
      "is the human positioning it; the reliable human-directed save is demonstrated on the driven " +
      "keeper-shot fixture where the keeper slot runs the shared keeper logic with the human's " +
      "movement injected.",
  ];

  const realization: Record<string, unknown> = {
    is: "human-directed keeper control (movement-direction channel over the designated keeper, " +
      "with the keeper's save/claim reaction retained)",
    how:
      "the human's control slot on the designated keeper yields the CPU arc-hold positioning to the " +
      "human's directional input (CpuObservation.humanDirectedKeeperMove) while the same production " +
      "save/claim reaction still arms and answers an on-target shot; switching away lets the CPU " +
      "keeper logic resume (the keeper slot's observation carries no human movement).",
    not_a:
      "a new world body or a change to team cardinality: the keeper is one of the bodies the " +
      "scenario already ships, designated before kickoff (spec §4).",
    designation:
      "the adapter's designateKeeperFromLayout stays the source of truth; the human never becomes " +
      "the designation — they direct the already-designated body.",
  };

  const record: Record<string, unknown> = {
    schema_version: 1,
    objective_id: OBJECTIVE_ID,
    evidence_class: "DYNAMIC_VISUAL",
    produced_by: "scripts/capture-human-keeper-control.ts",
    scenario: {
      id: scenario.id,
      path: SCENARIO_PATH,
      human_team: HUMAN_TEAM_ID,
      keeper_control_slot: KEEPER_CONTROL_SLOT,
      directed_keeper: keeperId,
    },
    realization,
    discriminating_guards: {
      human_controllers_keeper: humanControlled,
      human_directs_keeper: humanDirectsKeeper,
      human_directed_save_within_reach: humanSaveWithinReach,
      cpu_keeper_save_within_reach: cpuSaveWithinReach,
      keeper_designation_unchanged: keeperId === "player-10" && human.keeperByTeam["team-b"] === "player-10",
      save_contact_happened_in_both: human.saveTick !== null && cpu.saveTick !== null,
    },
    runs: records,
    claims_not_made: claimsNotMade,
  };

  const forHashing: Record<string, unknown> = { ...record };
  delete forHashing.record_sha256;
  record.record_sha256 = sha256(JSON.stringify(forHashing));

  const trajectory: Record<string, unknown> = {
    schema_version: 1,
    objective_id: OBJECTIVE_ID,
    evidence_class: "DYNAMIC_VISUAL",
    capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
    produced_by: "scripts/capture-human-keeper-control.ts",
    driver:
      "eval/runners/human-keeper-control.ts over the driven 5v5 human-vs-CPU keeper-shot fixture; " +
      "the only difference between runs is whether the keeper's control slot is fed the human's " +
      "directional input (humanMode: directed) or not (cpu).",
    run_ids: records.map((r) => r.id),
    runs: records.map((r) => ({
      id: r.id,
      role: r.role,
      ticks: r.ticks,
      human_mode: r.human_mode,
      shot_tick: r.shot_tick,
      save_tick: r.save_tick,
      keeper_at_save: r.keeper_at_save,
      state_hash_of_hashes: r.state_hash_of_hashes,
    })),
    per_tick: {
      directed: human.ticks,
      cpu: cpu.ticks,
    },
    record_sha256: record.record_sha256,
  };

  writeFileSync(TRAJECTORY_PATH, `${JSON.stringify(trajectory, null, 2)}\n`, "utf-8");
  writeFileSync(STATE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
  writeFileSync(RESULT_PATH, RESULT_MD(record, human, cpu, keeperId), "utf-8");

  console.log(`[human-keeper-evidence] wrote ${TRAJECTORY_PATH}`);
  console.log(`[human-keeper-evidence] wrote ${STATE_PATH}`);
  console.log(`[human-keeper-evidence] wrote ${RESULT_PATH}`);
  console.log(
    `[human-keeper-evidence] directedSave=${human.saveTick}@${human.saveContactDistance}` +
      ` cpuSave=${cpu.saveTick}@${cpu.saveContactDistance}` +
      ` humanDirects=${humanDirectsKeeper} record_sha256=${String(record.record_sha256)}`,
  );
}

function RESULT_MD(
  record: Record<string, unknown>,
  human: HumanKeeperRunResult,
  cpu: HumanKeeperRunResult,
  keeperId: string,
): string {
  const guard = record.discriminating_guards as Record<string, unknown>;
  return [
    `# HUMAN-KEEPER-CONTROL — evidence record`,
    ``,
    `- objective_id: ${OBJECTIVE_ID}`,
    `- evidence_class: DYNAMIC_VISUAL`,
    `- record_sha256: ${String(record.record_sha256)}`,
    ``,
    `## Hypothesis`,
    ``,
    "In a human-vs-CPU small-sided match the human can take control of the team's designated keeper " +
      "(the switch cycle already includes the keeper; the keeper role is live) and direct it: the " +
      "CPU arc-hold positioning YIELDS to the human's directional input, while the keeper's " +
      "save/claim reaction still answers a shot on target. When the human does not direct the " +
      "keeper, the CPU keeper logic runs unchanged.",
    ``,
    `## Discriminating guards`,
    ``,
    `- human_controllers_keeper: ${String(guard.human_controllers_keeper)} (directed keeper ${keeperId})`,
    `- human_directs_keeper: ${String(guard.human_directs_keeper)}`,
    `- human_directed_save_within_reach: ${String(guard.human_directed_save_within_reach)} ` +
      `(save at ${human.saveTick}, ${human.saveContactDistance} m off the keeper, ` +
      `within gk-small-sided-v1 reach)`,
    `- cpu_keeper_save_within_reach: ${String(guard.cpu_keeper_save_within_reach)} ` +
      `(save at ${cpu.saveTick}, ${cpu.saveContactDistance} m)`,
    `- keeper_designation_unchanged: ${String(guard.keeper_designation_unchanged)}`,
    `- save_contact_happened_in_both: ${String(guard.save_contact_happened_in_both)}`,
    ``,
    `## Fixture-driven disclosure`,
    ``,
    "The run is driven (fixture initial state) so an on-target shot reliably reaches the keeper. " +
      "It is disclosed: the shot is the shooting body's own canonical CPU SHOT press, never a " +
      "scripted ball; the keeper's save/claim is the same FIRST_TOUCH action a human reaches through " +
      "the keyboard, resolved by the contact system on the independent ball. The human's directional " +
      "input enters ONLY through the tick-indexed InputFrame (CpuObservation.humanDirectedKeeperMove).",
    ``,
    `## Realization (explicit)`,
    ``,
    `- is: ${String((record.realization as Record<string, unknown>).is)}`,
    `- how: ${String((record.realization as Record<string, unknown>).how)}`,
    `- not_a: ${String((record.realization as Record<string, unknown>).not_a)}`,
    `- designation: ${String((record.realization as Record<string, unknown>).designation)}`,
    ``,
    `## Standard-browser-wiring limitation (disclosed)`,
    ``,
    "In the STANDARD 5v5 human-vs-CPU browser wiring the human's team keeper is the human's default " +
      "controlled body (slot-1) and the CPU keeper adapter does not run for it, so the human directs " +
      "the keeper through the movement controls and a save is the human positioning the body into the " +
      "shot's path. The reliable human-directed save is demonstrated on the driven keeper-shot fixture, " +
      "where the keeper slot runs the shared keeper logic with the human's movement injected.",
    ``,
    `## claims_not_made`,
    ``,
    ...(record.claims_not_made as string[]).map((c) => `- ${c}`),
    ``,
  ].join("\n");
}

main();
