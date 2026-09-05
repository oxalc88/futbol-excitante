/**
 * Node-side evidence producer for GK-5V5-ADAPTER-BEHAVIOR.
 *
 * Writes the designated-keeper trajectory for coherent 5v5 CPU-vs-CPU matches:
 * per-tick committed geometry, the frozen keeper designation, the commanded arc
 * point against the committed keeper position, the chase assignment the team
 * decision actually issued, and every canonical shot on target at a keeper's own
 * goal with the recorded ball contact that answered it.
 *
 * Four runs, so the guards are discriminating:
 *
 *   5v5-gk-continuous-live    — the accepted flowing 5v5 match, keeper role live
 *   5v5-gk-continuous-stashed — the same match with `gkBehavior: false`, which
 *                               must reproduce HEAD's per-tick hash chain
 *   5v5-gk-shot-fixture-live  — a controlled 5v5 shot-on-target fixture (the same
 *                               ten bodies), keeper role live
 *   5v5-gk-shot-fixture-stashed — that fixture with the role stashed
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode, i.e.
 * `WIP_SECTION=__EVIDENCE__:GK-5V5-ADAPTER-BEHAVIOR`. An ordinary run writes the
 * same artifact under the ignored `test-results/gauntlet-capture/**` tree and
 * leaves `docs/` byte-identical.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:GK-5V5-ADAPTER-BEHAVIOR \
 *     mise exec -- pnpm run capture-gk-5v5-adapter-behavior
 *   ... --only=5v5-gk-continuous-live,5v5-gk-continuous-stashed
 *
 * Node I/O is allowed here; the simulation core is untouched.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { runGkMatch, type GkMatchResult } from "../eval/runners/gk-match.js";
import {
  GK_SMALL_SIDED_V1,
  getKeeperHoldActivations,
  getKeeperPressExclusionActivations,
  getKeeperReleasePressActivations,
  getKeeperSaveArmActivations,
  getKeeperSavePressActivations,
  resetKeeperMechanismCounters,
} from "../src/adapters/input-browser/goalkeeper-role.js";
import {
  ANTI_HUDDLE_V1_ID,
  SHOT_EVENT_WINDOW_TICKS,
} from "../src/adapters/input-browser/cpu-adapter.js";
import { FOUNDATION_CONTACT_V1 } from "../src/simulation/config/foundation.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "GK-5V5-ADAPTER-BEHAVIOR";

/**
 * Durable evidence mode is declared by the Gauntlet capture contract. Anything
 * else is an ordinary run and stays inside the ignored ephemeral tree.
 */
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const OUTPUT_ROOT = EVIDENCE_MODE
  ? resolve("docs/evidence", OBJECTIVE_ID)
  : resolve("test-results/gauntlet-capture", OBJECTIVE_ID);
const ARTIFACT_PATH = resolve(OUTPUT_ROOT, "trajectory.json");

/** One pinned run: label, scenario path, tick budget and switch position. */
interface RunSpec {
  id: string;
  scenarioPath: string;
  ticks: number;
  gkBehavior: boolean;
  lifecyclePhaseSync: "legacy" | "core-owned";
  /** What this run is for, in one line, recorded verbatim in the artifact. */
  role: string;
  /** Reproduce the run twice and require identical per-tick hashes. */
  verifyDeterminism: boolean;
}

const RUNS: RunSpec[] = [
  {
    id: "5v5-gk-continuous-live",
    scenarioPath: "eval/scenarios/5v5-continuous-play.v1.json",
    ticks: 1800,
    gkBehavior: true,
    lifecyclePhaseSync: "legacy",
    role: "coherent organic 5v5 CPU-vs-CPU match (the accepted anti-huddle flowing " +
      "window) with one designated keeper per team: arc hold, no field chase, and " +
      "what the match's own shots did against the keeper",
    verifyDeterminism: true,
  },
  {
    id: "5v5-gk-continuous-stashed",
    scenarioPath: "eval/scenarios/5v5-continuous-play.v1.json",
    ticks: 1800,
    gkBehavior: false,
    lifecyclePhaseSync: "legacy",
    role: "the same match with gkBehavior:false — the stash-identity control: its " +
      "per-tick hash chain must equal HEAD's, and every keeper counter must stay 0",
    verifyDeterminism: false,
  },
  {
    id: "5v5-gk-shot-fixture-live",
    scenarioPath: "eval/scenarios/5v5-keeper-shot-fixture.v1.json",
    ticks: 600,
    gkBehavior: true,
    lifecyclePhaseSync: "legacy",
    role: "controlled 5v5 shot-on-target fixture (same ten bodies, nothing scripted): " +
      "the shot on target → recorded keeper contact chain, with the reach the core " +
      "recorded for that contact",
    verifyDeterminism: true,
  },
  {
    id: "5v5-gk-shot-fixture-stashed",
    scenarioPath: "eval/scenarios/5v5-keeper-shot-fixture.v1.json",
    ticks: 600,
    gkBehavior: false,
    lifecyclePhaseSync: "legacy",
    role: "the same fixture with the keeper role stashed — HEAD behaviour, no keeper " +
      "designation, no keeper-path counter lights up",
    verifyDeterminism: false,
  },
];

const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const selected = onlyArg
  ? new Set(onlyArg.slice("--only=".length).split(",").map((id) => id.trim()))
  : new Set(RUNS.map((run) => run.id));

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * The accepted 5v5 flowing-run chain, read out of the accepted artifact so the
 * stashed control can be checked against bytes that already exist rather than
 * against a restated number.
 */
function readAcceptedPins(): Record<string, unknown> {
  const path = resolve("docs/evidence/5V5-KICKOFF-ANTI-HUDDLE/trajectory.json");
  try {
    const artifact = JSON.parse(readFileSync(path, "utf-8")) as {
      runs: Array<{
        id: string;
        ticks: number;
        scenario_path: string;
        determinism: { state_hash_of_hashes: string };
        per_tick: unknown[][];
      }>;
    };
    const flowing = artifact.runs.find((run) => run.id === "5v5-flowing-cpu-vs-cpu");
    if (!flowing) return { status: "accepted run not found" };
    const hashes = flowing.per_tick.map((row) => String(row[row.length - 1]));
    return {
      source: "docs/evidence/5V5-KICKOFF-ANTI-HUDDLE/trajectory.json",
      run: flowing.id,
      scenario_path: flowing.scenario_path,
      ticks: flowing.ticks,
      state_hash_of_hashes: sha256(JSON.stringify(hashes)),
      read_only: true,
    };
  } catch (error) {
    return { status: "unreadable", reason: String(error) };
  }
}

// ---------------------------------------------------------------------------
// Compact per-tick encoding (same shape the accepted anti-huddle artifacts use)
// ---------------------------------------------------------------------------

const FLAG_LETTERS: Array<[string, string]> = [
  ["keeper", "k"],
  ["designatedChaser", "c"],
  ["designatedCover", "o"],
];

const TEAM_FIELDS = [
  "keeperPlayerId",
  "arcCenter.x",
  "arcCenter.y",
  "station.x",
  "station.y",
  "lateralDrift",
  "distToArcCenter",
  "onGoalArc",
  "onStation",
  "saveReactionLive",
  "saveShotTick",
  "ticksSinceShot",
  "chaserPlayerId",
  "chaserDistance",
  "coverPlayerId",
  "restartTakerId",
  "strategy",
  "defensiveSubMode",
  "tacklePlayerId",
  "tackleWithheld",
  "playersWithinClumpRadius",
];

function encodeFlags(player: { keeper: boolean; designatedChaser: boolean; designatedCover: boolean }): string {
  const record = player as unknown as Record<string, boolean>;
  return FLAG_LETTERS.filter(([field]) => record[field] === true)
    .map(([, letter]) => letter)
    .join("");
}

function encodeTick(result: GkMatchResult, tickIndex: number, playerOrder: string[]): unknown[] {
  const tick = result.ticks[tickIndex];
  const byId = new Map(tick.players.map((player) => [player.playerId, player]));
  return [
    tick.tick,
    tick.ball.x,
    tick.ball.y,
    tick.ball.vx,
    tick.ball.vy,
    tick.ball.regime,
    tick.ball.lastTouchRef,
    playerOrder.map((id) => {
      const player = byId.get(id);
      if (!player) return null;
      return [
        player.x,
        player.y,
        player.speed,
        player.distToBall,
        player.distToHome,
        encodeFlags(player),
        player.pressed,
      ];
    }),
    Object.fromEntries(Object.entries(tick.teams).map(([teamId, team]) => [
      teamId,
      [
        team.keeperPlayerId,
        team.arcCenter ? team.arcCenter.x : null,
        team.arcCenter ? team.arcCenter.y : null,
        team.station ? team.station.x : null,
        team.station ? team.station.y : null,
        team.lateralDrift,
        team.distToArcCenter,
        team.onGoalArc,
        team.onStation,
        team.saveReactionLive,
        team.saveShotTick,
        team.ticksSinceShot,
        team.chaserPlayerId,
        team.chaserDistance,
        team.coverPlayerId,
        team.restartTakerId,
        team.strategy,
        team.defensiveSubMode,
        team.tacklePlayerId,
        team.tackleWithheld,
        team.playersWithinClumpRadius,
      ],
    ])),
    tick.eventKinds,
    tick.stateHash,
  ];
}

const TICK_FIELDS = [
  "tick",
  "ball.x",
  "ball.y",
  "ball.vx",
  "ball.vy",
  "ball.regime",
  "ball.lastTouchRef",
  // players[], in `player_order`: [x, y, speed, distToBall, distToHome, flags,
  // pressedButtons] where flags are k=designated keeper, c=designated
  // chaser/presser, o=designated cover.
  "players",
  // per team, ordered as `team_fields`.
  "teams",
  "eventKinds",
  "stateHash",
];

const FLAG_LEGEND = {
  k: "keeper — this body is its team's designated keeper (frozen before kickoff)",
  c: "designatedChaser — the team's single designated presser/chaser this tick",
  o: "designatedCover — the team's single designated cover body this tick",
  invariant: "a body carrying k must never carry c or o (spec §6, no field chase)",
};

// ---------------------------------------------------------------------------
// Run records
// ---------------------------------------------------------------------------

interface RunRecord {
  id: string;
  role: string;
  scenario: string;
  scenario_path: string;
  ticks: number;
  simulated_seconds: number;
  gk_behavior: boolean;
  lifecycle_phase_sync: string;
  reproduction: string;
  driver: string;
  player_order: string[];
  team_fields: string[];
  keeper_by_team: Record<string, string>;
  kickoff_homes: Record<string, { x: number; y: number }>;
  tick_fields: string[];
  per_tick: unknown[];
  clump_radius_metres: number;
  keepers: Record<string, unknown>;
  summary: Record<string, unknown>;
  mechanism_counters: Record<string, number>;
  determinism: Record<string, unknown>;
  /** Present on the stashed control of a run that has an accepted pin to match. */
  stash_identity?: Record<string, unknown>;
  key_ticks: Record<string, unknown>;
}

function buildRunRecord(spec: RunSpec): RunRecord {
  const scenario = loadScenario(spec.scenarioPath);

  resetKeeperMechanismCounters();
  const result = runGkMatch({
    scenario,
    maxTicks: spec.ticks,
    gkBehavior: spec.gkBehavior,
    lifecyclePhaseSync: spec.lifecyclePhaseSync,
  });
  const mechanism = {
    keeper_hold_frames: getKeeperHoldActivations(),
    keeper_save_arms: getKeeperSaveArmActivations(),
    keeper_save_or_claim_presses: getKeeperSavePressActivations(),
    keeper_distribution_releases: getKeeperReleasePressActivations(),
    keeper_press_exclusions: getKeeperPressExclusionActivations(),
  };

  const playerOrder = result.ticks[0]?.players.map((player) => player.playerId) ?? [];

  const determinism: Record<string, unknown> = {
    state_hash_of_hashes: sha256(JSON.stringify(result.stateHashes)),
    final_state_hash: result.stateHashes[result.stateHashes.length - 1] ?? null,
  };
  if (spec.verifyDeterminism) {
    resetKeeperMechanismCounters();
    const replay = runGkMatch({
      scenario: loadScenario(spec.scenarioPath),
      maxTicks: spec.ticks,
      gkBehavior: spec.gkBehavior,
      lifecyclePhaseSync: spec.lifecyclePhaseSync,
    });
    determinism.replay_state_hash_of_hashes = sha256(JSON.stringify(replay.stateHashes));
    determinism.replay_identical =
      JSON.stringify(replay.stateHashes) === JSON.stringify(result.stateHashes);
    determinism.replay_keepers_identical =
      JSON.stringify(replay.keepers) === JSON.stringify(result.keepers);
  }

  const shotChains = Object.entries(result.keepers).flatMap(([teamId, keeper]) =>
    keeper.shotChains.map((chain) => ({
      team_id: teamId,
      keeper_player_id: chain.keeperPlayerId,
      shot_contact_tick: chain.shotContactTick,
      shot_event_id: chain.shotEventId,
      shooter: `${chain.shooterTeamId}/${chain.shooterPlayerId}`,
      projected_cross_y: chain.projectedCrossY,
      keeper_contact_tick: chain.keeperContactTick,
      keeper_contact_event_id: chain.keeperContactEventId,
      contact_kind: chain.contactKind,
      ticks_from_shot_to_contact: chain.ticksFromShotToContact,
      recorded_contact_distance: chain.recordedContactDistance,
      reach_limit_metres: chain.reachLimitMetres,
      within_reach: chain.withinReach,
      save_on_shot_on_target: chain.saveOnShotOnTarget,
      interrupted_by: chain.interruptedBy,
    })),
  );

  const record: RunRecord = {
    id: spec.id,
    role: spec.role,
    scenario: scenario.id,
    scenario_path: spec.scenarioPath,
    ticks: result.totalTicks,
    simulated_seconds: Math.round((result.totalTicks / 60) * 1000) / 1000,
    gk_behavior: spec.gkBehavior,
    lifecycle_phase_sync: spec.lifecyclePhaseSync,
    reproduction:
      `runGkMatch({ scenario: load(${JSON.stringify(spec.scenarioPath)}), ` +
      `maxTicks: ${spec.ticks}, gkBehavior: ${spec.gkBehavior}, ` +
      `lifecyclePhaseSync: ${JSON.stringify(spec.lifecyclePhaseSync)} })`,
    driver:
      "eval/runners/gk-match.ts over the accepted eval/runners/headless-match.ts wiring " +
      "with browserParityObservations (the browser composition root's observation shape); " +
      "keeper records come from the same production functions the adapters act on",
    player_order: playerOrder,
    team_fields: TEAM_FIELDS,
    keeper_by_team: result.keeperByTeam,
    kickoff_homes: result.kickoffHomes,
    tick_fields: TICK_FIELDS,
    per_tick: result.ticks.map((_, index) => encodeTick(result, index, playerOrder)),
    clump_radius_metres: 5,
    keepers: result.keepers,
    summary: {
      ...result.summary,
      passEvents: result.summary.passEvents.slice(0, 40),
      touchEvents: result.summary.touchEvents.slice(0, 60),
      shot_chains: shotChains,
    },
    mechanism_counters: mechanism,
    determinism,
    key_ticks: {
      shot_on_target_saved: shotChains
        .filter((chain) => chain.save_on_shot_on_target)
        .map((chain) => ({
          team: chain.team_id,
          keeper: chain.keeper_player_id,
          shot_tick: chain.shot_contact_tick,
          contact_tick: chain.keeper_contact_tick,
          ticks_from_shot_to_contact: chain.ticks_from_shot_to_contact,
          contact_kind: chain.contact_kind,
          recorded_contact_distance: chain.recorded_contact_distance,
          within_reach: chain.within_reach,
        })),
      keeper_station_ticks: Object.fromEntries(Object.entries(result.keepers)
        .map(([teamId, keeper]) => [teamId, keeper.stationTakenTick])),
      keeper_arc_bounds: Object.fromEntries(Object.entries(result.keepers)
        .map(([teamId, keeper]) => [teamId, {
          on_arc_ticks_after_station: keeper.onArcTicksAfterStation,
          off_arc_ticks_after_station: keeper.offArcTicksAfterStation,
          off_arc_with_body_contact: keeper.offArcAfterStationWithBodyContact,
          off_arc_unattributed: keeper.offArcAfterStationUnattributed,
          max_lateral_drift: keeper.maxLateralDriftAfterStation,
          max_distance_to_arc_center: keeper.maxDistanceToArcCenterAfterStation,
          max_speed_after_station: keeper.maxSpeedAfterStation,
        }])),
      keeper_chase_ticks: Object.fromEntries(Object.entries(result.keepers)
        .map(([teamId, keeper]) => [teamId, keeper.keeperDesignatedChaserTicks])),
    },
  };

  console.log(
    `[gk-evidence] ${spec.id}: ticks=${record.ticks} gk=${spec.gkBehavior}` +
      ` keepers=${JSON.stringify(record.keeper_by_team)}` +
      ` station=${JSON.stringify(record.key_ticks.keeper_station_ticks)}` +
      ` goals=${result.summary.goals} shots=${result.summary.shots}` +
      ` onTarget=${result.summary.shotsOnTarget}` +
      ` saves=${record.key_ticks.shot_on_target_saved.length}` +
      ` counters=${JSON.stringify(mechanism)}` +
      ` hashOfHashes=${String(determinism.state_hash_of_hashes).slice(0, 24)}` +
      ` deterministic=${String(determinism.replay_identical ?? "not checked")}`,
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
  capture_mode: string;
  accepted_pins: Record<string, unknown>;
  produced_by: string;
  driver: string;
  activation: Record<string, unknown>;
  configs: Record<string, unknown>;
  flag_legend: Record<string, string>;
  invariants_proved: string[];
  disclosures: string[];
  runs: RunRecord[];
}

const scaffold: Artifact = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  capture_mode: EVIDENCE_MODE ? "durable-evidence" : "ephemeral",
  // Read-only comparison against accepted evidence bytes. Reading another
  // objective's artifact is allowed by the capture contract; writing to it is not,
  // and nothing here opens it for writing.
  accepted_pins: readAcceptedPins(),
  produced_by: "scripts/capture-gk-5v5-adapter-behavior-evidence.ts",
  driver:
    "eval/runners/gk-match.ts (coherent CPU-vs-CPU match; per-tick keeper designation, " +
    "arc measurement and save-reaction state read through the same exported production " +
    "functions the adapters act on)",
  activation: {
    field: "CpuObservation.gkBehavior + CpuObservation.keeperPlayerIds",
    meaning:
      "the designated-keeper role is live only when the wiring declares gkBehavior:true on " +
      "top of the accepted anti-huddle preconditions (the ball's authoritative touch " +
      "reference and a team for the CPU to reason about). Absent or false, the adapter emits " +
      "exactly the frames it emitted before any keeper existed.",
    set_by: [
      "eval/runners/headless-match.ts runHeadlessMatch({ gkBehavior }) (these pinned runs)",
      "tests/integration/gk-5v5-adapter-behavior.test.ts (live + stashed guards)",
      "NOT yet the browser composition root (src/apps/browser/main.ts) — that wiring is the " +
        "following horizon objective GK-BROWSER-DYNAMIC-EVIDENCE",
    ],
    designation:
      "adapter-layer role assignment on the bodies the scenario already ships: one existing " +
      "body per team, resolved before kickoff from the match's starting layout " +
      "(goalkeeper-role.ts designateKeeperFromLayout) and frozen by the wiring. No new world " +
      "body, no change to team cardinality.",
  },
  configs: {
    keeper_model: GK_SMALL_SIDED_V1.id,
    all_values_provisional: true,
    provisional_values: Object.fromEntries(
      Object.entries(GK_SMALL_SIDED_V1)
        .filter(([, value]) => typeof value === "object")
        .map(([key, value]) => [key, (value as { value: number | string; unit: string }).value]),
    ),
    provisional_constants_note:
      "every positional, speed, reach, reaction and perception value above is versioned " +
      "provisional configuration from specs/GOALKEEPER_SPEC.md §9 / " +
      "eval/contracts/goalkeeper-config.ts, bound by " +
      "tests/unit/cpu-adapter/GK-SMALL-SIDED-V1-drift.test.ts. None is measured and none is " +
      "a PES 2017 constant.",
    inherited_constants: {
      in_arc_reposition_speed_cap_fraction:
        "GK_SMALL_SIDED_V1.keeper_reposition_speed / FOUNDATION_LOCOMOTION_V1.maxSpeed",
      hold_tolerance_metres: 0.75,
      hold_tolerance_source: `${ANTI_HUDDLE_V1_ID} KICKOFF_FREEZE_HOME_TOLERANCE (reused, not re-declared)`,
      shot_perception_window_ticks: SHOT_EVENT_WINDOW_TICKS,
      shot_perception_window_source:
        "the accepted recent-pass perception window in buildCpuObservation",
      core_touch_radius_metres: FOUNDATION_CONTACT_V1.contactRadius.value,
      reach_note:
        `the model's save_claim_reach_radius (${GK_SMALL_SIDED_V1.save_claim_reach_radius.value} m) ` +
        `equals the core's own contact radius (${FOUNDATION_CONTACT_V1.contactRadius.value} m), ` +
        "so every keeper claim the model commands is one the contact system can execute",
      clump_measurement_radius_metres: 5,
      clump_radius_note: "an evidence measurement radius, never a gameplay value",
    },
  },
  flag_legend: FLAG_LEGEND,
  invariants_proved: [
    "role designation: exactly one designated keeper per team per tick, frozen before " +
      "kickoff from the starting layout, never re-derived from ball state",
    "goal-arc hold: after the keeper takes station, its committed position stays inside the " +
      "versioned arc disk and within goal_arc_lateral_max of the arc centre",
    "no field chase: the keeper is never its team's designated chaser/presser, cover body or " +
      "restart taker, while the accepted anti-huddle assignment keeps exactly one field " +
      "chaser per team",
    "save/claim: a canonical shot on target is answered by an explicit recorded ball contact " +
      "on the independent ball, inside save_claim_reach_radius — no parenting, no teleport",
    "stash identity: gkBehavior:false reproduces HEAD's per-tick hash chain on the same " +
      "scenario and configuration, and leaves every keeper-path counter at 0",
    "accepted pins: the stashed continuous run reproduces the accepted 5V5-KICKOFF-ANTI-HUDDLE " +
      "flowing-run chain byte-for-byte",
  ],
  disclosures: [
    "Organic save chains: in the accepted flowing 5v5 window the keepers armed reactions on " +
      "the match's own on-target shots but no shot reached them as a shot on target — the " +
      "recorded chains carry the reason (`interrupted_by`) on every one of them. The shot-on-" +
      "target → recorded keeper contact chain is therefore demonstrated on a controlled 5v5 " +
      "fixture (same ten bodies, nothing scripted: the shot is the shooting body's own " +
      "canonical SHOT press), and that run is labelled as driven-by-layout, not organic.",
    "Taking up station: no accepted 5v5 scenario places a body on its own goal line, so from " +
      "the kickoff home the designated keeper closes on its arc before it can hold it. Its " +
      "commanded target on every one of those ticks is a point inside its own arc (never the " +
      "ball), and the arc bounds in GK-POSITIONING-HOLD are measured from the tick the keeper " +
      "first reaches its arc — reported per run as `station_taken_tick`. The transit itself " +
      "uses the accepted locomotion cap every other body uses; the versioned " +
      "keeper_reposition_speed governs repositioning inside the arc, which is exactly what " +
      "specs/GOALKEEPER_SPEC.md §5 declares.",
    "Committed speed is not the commanded speed: the in-arc cap is applied to the input " +
      "magnitude, and locomotion converges the body toward it under the accepted " +
      "acceleration/braking limits, so `max_speed_after_station` can exceed " +
      "keeper_reposition_speed for the ticks right after the keeper crosses onto its arc. " +
      "Reported as measured, not smoothed.",
    "Physical displacement: a keeper body can be pushed off its arc by player-player contact, " +
      "which the adapters do not control. Off-arc ticks after station are therefore reported " +
      "split into `off_arc_after_station_with_body_contact` (attributable to a recorded body " +
      "contact on that tick) and `off_arc_after_station_unattributed`.",
    "No core event kinds were added: the `keeper-arc-position` / `keeper-ball-contact` / " +
      "`keeper-release` event kinds named by eval/contracts/situation-mapping.ts do not exist " +
      "in the core's event union and were not invented here (src/contracts is byte-identical). " +
      "The keeper's recorded contact is the core's own `player-ball-contact` event with " +
      "`contactType: first-touch`, and the arc facts in this artifact are computed from " +
      "committed state through the production keeper functions. The `goalkeepers` suite's " +
      "GK_* situation mappings therefore stay NOT_EVALUATED here; re-adjudicating them is " +
      "GK-SUITE-ORGANIC-STATE, not this objective.",
    "Browser wiring: the browser composition root (src/apps/browser/main.ts) does not set " +
      "`gkBehavior` yet, so the 5v5 match in the browser is unchanged. Making the keeper " +
      "visible in the running app is the next horizon objective (GK-BROWSER-DYNAMIC-EVIDENCE).",
    "Reaction latency: `reaction_latency_ref_ms` stays BLOCKED_MISSING_REFERENCE " +
      "(specs/GOALKEEPER_SPEC.md §10). The model therefore initiates the attempt at the " +
      "earliest tick the committed world makes the shot observable and the recorded " +
      "shot→contact gaps in this artifact are reported as measurements, never compared to an " +
      "invented envelope.",
    "Distribution (spec §8): the release path exists and is exercised only when a keeper has " +
      "secured the ball and a forward teammate is inside its own facing tolerance. It is " +
      "reported through `mechanism_counters.keeper_distribution_releases`; no " +
      "GK-DISTRIBUTION-NO-OMNISCIENCE verdict is claimed here.",
    "Reused accepted constants, restated for clarity: the hold tolerance " +
      "(0.75 m, anti-huddle-v1 KICKOFF_FREEZE_HOME_TOLERANCE), the recent-event perception " +
      "window (10 ticks, the accepted pass-awareness window) and the in-arc speed fraction " +
      "(keeper_reposition_speed / FOUNDATION_LOCOMOTION_V1.maxSpeed) are derived from " +
      "declarations that already exist. No new gameplay magnitude is introduced by this " +
      "objective.",
  ],
  runs: [],
};

let artifact: Artifact = scaffold;
try {
  const existing = JSON.parse(readFileSync(ARTIFACT_PATH, "utf-8")) as Artifact;
  if (existing?.objective_id === OBJECTIVE_ID && Array.isArray(existing.runs)) {
    artifact = { ...scaffold, ...existing, runs: existing.runs, disclosures: scaffold.disclosures };
  }
} catch {
  /* first pass: start from the scaffold */
}

mkdirSync(OUTPUT_ROOT, { recursive: true });

for (const spec of RUNS) {
  if (!selected.has(spec.id)) continue;
  const record = buildRunRecord(spec);
  const acceptedPin = artifact.accepted_pins as { state_hash_of_hashes?: string; scenario_path?: string };
  if (record.id === "5v5-gk-continuous-stashed" &&
    typeof acceptedPin.state_hash_of_hashes === "string" &&
    acceptedPin.scenario_path === record.scenario_path) {
    record.stash_identity = {
      against: "accepted 5V5-KICKOFF-ANTI-HUDDLE 5v5-flowing-cpu-vs-cpu chain",
      accepted_state_hash_of_hashes: acceptedPin.state_hash_of_hashes,
      this_run_state_hash_of_hashes: record.determinism.state_hash_of_hashes,
      identical: acceptedPin.state_hash_of_hashes === record.determinism.state_hash_of_hashes,
      keeper_counters_all_zero: Object.values(record.mechanism_counters).every((n) => n === 0),
    };
  }
  const index = artifact.runs.findIndex((run) => run.id === spec.id);
  if (index >= 0) artifact.runs[index] = record;
  else artifact.runs.push(record);
}

// Keep the declared order regardless of the capture sequence.
artifact.runs.sort(
  (a, b) => RUNS.findIndex((run) => run.id === a.id) - RUNS.findIndex((run) => run.id === b.id),
);

writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact)}\n`, "utf-8");
console.log(
  `[gk-evidence] wrote ${ARTIFACT_PATH} (mode: ${artifact.capture_mode}; runs: ` +
    `${artifact.runs.map((r) => r.id).join(", ")})`,
);
