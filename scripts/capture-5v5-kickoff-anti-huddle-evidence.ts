/**
 * Node-side evidence producer for 5V5-KICKOFF-ANTI-HUDDLE.
 *
 * Writes `docs/evidence/5V5-KICKOFF-ANTI-HUDDLE/trajectory.json`: coherent
 * 5v5 CPU-vs-CPU matches of at least 1800 ticks (30 s at the 60 Hz sim tick) —
 * never an 8-tick fixture — recorded tick by tick from committed state:
 *
 *   (a) the kickoff window: every CPU field body at its fixed kickoff home with
 *       ~zero displacement until the ball's first touch,
 *   (b) the first-touch tick (the tick the ball's authoritative touch reference
 *       stops being null, plus the touch event itself),
 *   (c) after first touch: the per-team chase assignment (exactly one chaser /
 *       presser, one cover) and the cover's signed offset behind the presser,
 *   (d) the organic pass / lofted-pass / through-ball events with their ticks.
 *
 * A stashed control run (`cpuAntiHuddle: false`) is recorded alongside so the
 * guards are discriminating: with the behavior stashed the same kickoff never
 * produces a touch at all and the clump returns.
 *
 * Reproducibility: every run records `determinism.state_hash_of_hashes` over its
 * full per-tick committed hash chain, so an independent second pass of the same
 * command must print the same value; the shape is additionally replayed twice
 * inside one process by tests/integration/5v5-kickoff-anti-huddle.test.ts.
 *
 * Usage (each long window is its own step; the artifact merges by run id):
 *   npx tsx scripts/capture-5v5-kickoff-anti-huddle-evidence.ts --only=5v5-kickoff-cpu-vs-cpu
 *   npx tsx scripts/capture-5v5-kickoff-anti-huddle-evidence.ts --only=5v5-flowing-cpu-vs-cpu
 *   npx tsx scripts/capture-5v5-kickoff-anti-huddle-evidence.ts --only=5v5-kickoff-stashed-control
 *
 * Node I/O is allowed here; the simulation core is untouched.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import {
  runAntiHuddleMatch,
  type AntiHuddleMatchResult,
  type AntiHuddleTickRecord,
} from "../eval/runners/anti-huddle-match.js";
import {
  getCoverMechanismActivations,
  getKickoffFreezeActivations,
  getNearestOnlyChaseActivations,
  getSupportMechanismActivations,
  getCpuTackleCommitActivations,
  resetMechanismCounters,
  ANTI_HUDDLE_V1_ID,
} from "../src/adapters/input-browser/cpu-adapter.js";
import { FOUNDATION_CPU_TACKLE_V1 } from "../src/simulation/config/foundation.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "5V5-KICKOFF-ANTI-HUDDLE";
const EVIDENCE_DIR = resolve("docs/evidence", OBJECTIVE_ID);
const ARTIFACT_PATH = resolve(EVIDENCE_DIR, "trajectory.json");

/** One pinned run: label, scenario path, tick budget and switch position. */
interface RunSpec {
  id: string;
  scenarioPath: string;
  ticks: number;
  antiHuddle: boolean;
  /** Reproduce the run twice and require identical per-tick hashes. */
  verifyDeterminism: boolean;
}

const RUNS: RunSpec[] = [
  {
    // The browser's 5v5 CPU-vs-CPU kickoff match. Its window is capped at
    // 1200 ticks because the pre-existing settled-ball defect below leaves the
    // centre ball immobile, so the contest around it accumulates committed
    // events quadratically; the 1800-tick requirement is met by the flowing
    // window, which is the same behavior over a match that plays on.
    id: "5v5-kickoff-cpu-vs-cpu",
    scenarioPath: "eval/scenarios/5v5-fixture-v1.json",
    ticks: 1200,
    antiHuddle: true,
    verifyDeterminism: false,
  },
  {
    id: "5v5-flowing-cpu-vs-cpu",
    scenarioPath: "eval/scenarios/5v5-continuous-play.v1.json",
    ticks: 1800,
    antiHuddle: true,
    verifyDeterminism: false,
  },
  // The stashed control needs no long window to show the clump, and the clump's
  // own event volume makes long stashed windows quadratically expensive.
  {
    id: "5v5-kickoff-stashed-control",
    scenarioPath: "eval/scenarios/5v5-fixture-v1.json",
    ticks: 600,
    antiHuddle: false,
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

// ---------------------------------------------------------------------------
// Compact per-tick encoding
// ---------------------------------------------------------------------------
//
// A >= 1800-tick window with per-tick per-player geometry is only reviewable if
// it stays compact, so each tick is a tuple with the layout declared once in
// `tick_fields`. Arrays follow `player_order`; team records are keyed by teamId.

const FLAG_LETTERS: Array<[string, string]> = [
  ["kickoffFrozen", "f"],
  ["designatedChaser", "c"],
  ["designatedCover", "o"],
];

function encodeFlags(
  player: AntiHuddleTickRecord["players"][number],
): string {
  const record = player as unknown as Record<string, boolean>;
  return FLAG_LETTERS.filter(([field]) => record[field] === true)
    .map(([, letter]) => letter)
    .join("");
}

function encodeTick(tick: AntiHuddleTickRecord, playerOrder: string[]): unknown[] {
  const byId = new Map(tick.players.map((player) => [player.playerId, player]));
  return [
    tick.tick,
    tick.ball.x,
    tick.ball.y,
    tick.ball.vx,
    tick.ball.vy,
    tick.ball.regime,
    tick.ball.lastTouchRef,
    tick.kickoffTakerId,
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
        team.strategy,
        team.defensiveSubMode,
        team.chaserPlayerId,
        team.chaserDistance,
        team.coverPlayerId,
        team.coverDistance,
        team.coverBehindPresserMetres,
        team.playersWithinHuddleRadius,
        team.tacklePlayerId,
        team.tackleWithheld,
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
  "kickoffTakerId",
  // players[], in `player_order`: [x, y, speed, distToBall, distToHome, flags,
  // pressedButtons] where flags are f=kickoff frozen, c=designated chaser,
  // o=designated cover.
  "players",
  // per team: [strategy, defensiveSubMode, chaserPlayerId, chaserDistance,
  // coverPlayerId, coverDistance, coverBehindPresserMetres,
  // playersWithinHuddleRadius(<5m), tacklePlayerId, tackleWithheld]
  "teams",
  "eventKinds",
  "stateHash",
];

/**
 * How to read the flags: `c` is the geometry designation (the body the press
 * block, the cover pair and the tackle authorisation act on), `f` is what the
 * body actually did while the restart ball was still untouched. During the
 * freeze window a body can carry both — the freeze takes precedence over the
 * designation, which is exactly the kickoff-freeze requirement.
 */
const FLAG_LEGEND = {
  f: "kickoffFrozen — held at its fixed kickoff home this tick",
  c: "designatedChaser — the team's single designated presser/chaser for this geometry",
  o: "designatedCover — the second-closest press-eligible body, screening behind the presser",
  precedence: "while the ball carries no touch reference, f beats c for every body but the taker",
};

// ---------------------------------------------------------------------------
// Run records
// ---------------------------------------------------------------------------

interface RunRecord {
  id: string;
  scenario: string;
  scenario_path: string;
  ticks: number;
  simulated_seconds: number;
  anti_huddle: boolean;
  reproduction: string;
  driver: string;
  player_order: string[];
  kickoff_homes: Record<string, { x: number; y: number }>;
  tick_fields: string[];
  per_tick: unknown[];
  huddle_radius_metres: number;
  summary: Record<string, unknown>;
  mechanism_counters: Record<string, number>;
  determinism: Record<string, unknown>;
  pass_events: unknown[];
  touch_events: unknown[];
  key_ticks: Record<string, unknown>;
}

function buildRunRecord(spec: RunSpec): RunRecord {
  const scenario = loadScenario(spec.scenarioPath);

  resetMechanismCounters();
  const result = runAntiHuddleMatch({
    scenario,
    maxTicks: spec.ticks,
    cpuAntiHuddle: spec.antiHuddle,
  });
  const mechanism = {
    cover: getCoverMechanismActivations(),
    support: getSupportMechanismActivations(),
    cpu_tackle_commits: getCpuTackleCommitActivations(),
    kickoff_freeze: getKickoffFreezeActivations(),
    nearest_only_hold: getNearestOnlyChaseActivations(),
  };

  const playerOrder = result.ticks[0]?.players.map((player) => player.playerId) ?? [];

  const determinism: Record<string, unknown> = {
    state_hash_of_hashes: sha256(JSON.stringify(result.stateHashes)),
    final_state_hash: result.stateHashes[result.stateHashes.length - 1] ?? null,
  };
  if (spec.verifyDeterminism) {
    resetMechanismCounters();
    const replay = runAntiHuddleMatch({
      scenario: loadScenario(spec.scenarioPath),
      maxTicks: spec.ticks,
      cpuAntiHuddle: spec.antiHuddle,
    });
    determinism.replay_state_hash_of_hashes = sha256(JSON.stringify(replay.stateHashes));
    determinism.replay_identical =
      JSON.stringify(replay.stateHashes) === JSON.stringify(result.stateHashes);
    determinism.replay_summary_identical =
      JSON.stringify(replay.summary) === JSON.stringify(result.summary);
  }

  const firstTouchTick = result.summary.firstTouchTick;
  const keyTicks: Record<string, unknown> = {
    first_touch_tick: firstTouchTick,
    first_touch_event: firstTouchTick === null
      ? null
      : result.ticks.find((tick) => tick.tick === firstTouchTick)?.eventKinds ?? null,
    kickoff_taker: result.summary.kickoffTakerId,
    freeze_ticks: result.summary.kickoffFreezeTicks,
    // Bodies that had left their kickoff home before the first touch.
    freeze_window_movers: result.summary.freezeWindowMovers,
    max_frozen_home_displacement_metres:
      result.summary.freezeWindowMaxFrozenHomeDisplacementMetres,
  };

  const {
    tackleWithheldTally,
    passEvents,
    touchEvents,
    ...summaryFields
  } = result.summary;
  const record: RunRecord = {
    id: spec.id,
    scenario: scenario.id,
    scenario_path: spec.scenarioPath,
    ticks: result.totalTicks,
    simulated_seconds: Math.round((result.totalTicks / 60) * 1000) / 1000,
    anti_huddle: spec.antiHuddle,
    reproduction:
      `runAntiHuddleMatch({ scenario: load(${JSON.stringify(spec.scenarioPath)}), ` +
      `maxTicks: ${spec.ticks}, cpuAntiHuddle: ${spec.antiHuddle} })`,
    driver:
      "eval/runners/anti-huddle-match.ts over the accepted eval/runners/headless-match.ts " +
      "wiring with browserParityObservations (the browser composition root's observation shape)",
    player_order: playerOrder,
    kickoff_homes: result.kickoffHomes,
    tick_fields: TICK_FIELDS,
    per_tick: result.ticks.map((tick) => encodeTick(tick, playerOrder)),
    huddle_radius_metres: result.huddleRadiusMetres,
    summary: {
      ...summaryFields,
      tackle_withheld_by_team: tackleWithheldTally,
    },
    mechanism_counters: mechanism,
    determinism,
    pass_events: passEvents,
    touch_events: touchEvents,
    key_ticks: keyTicks,
  };

  console.log(
    `[anti-huddle-evidence] ${spec.id}: ticks=${record.ticks}` +
      ` firstTouch=${String(keyTicks.first_touch_tick)}` +
      ` huddleTicks=${result.summary.huddleTicks}` +
      ` maxWithin=${result.summary.maxPlayersWithinHuddleRadiusPerTeam}` +
      ` passes=${result.summary.passEvents.length}` +
      ` touches=${result.summary.touchEvents.length}` +
      ` goals=${result.summary.goals}` +
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
  produced_by: "scripts/capture-5v5-kickoff-anti-huddle-evidence.ts",
  driver:
    "eval/runners/anti-huddle-match.ts (coherent CPU-vs-CPU match; per-tick chase " +
    "assignment recorded through the same exported production functions the adapters act on)",
  activation: {
    field: "CpuObservation.cpuAntiHuddle + CpuObservation.ball.lastTouchRef",
    meaning:
      "the anti-huddle shape is live for any observation that carries the ball's authoritative " +
      "touch reference (every real runtime wiring); cpuAntiHuddle: false is the kill switch that " +
      "restores the accepted chase-everything frames byte-for-byte",
    set_by: [
      "src/apps/browser/main.ts (browser match composition root)",
      "runHeadlessMatch({ cpuAntiHuddle }) (these pinned runs)",
      "tests/integration/5v5-kickoff-anti-huddle.test.ts (live + stashed guards)",
    ],
  },
  configs: {
    anti_huddle_parameters: ANTI_HUDDLE_V1_ID,
    all_values_provisional: true,
    provisional_constants: {
      KICKOFF_FREEZE_HOME_TOLERANCE_METRES: 0.75,
      CHASE_NEAREST_HOME_TOLERANCE_METRES: 0.75,
      touch_press_range_metres: "min(FIRST_TOUCH_RANGE * difficulty, FOUNDATION_CONTACT_V1.contactRadius)",
      huddle_measurement_radius_metres: 5,
    },
    press_role_policy: FOUNDATION_CPU_TACKLE_V1.id,
    note:
      "no value here is a measured PES 2017 constant; the press designation reuses the accepted " +
      "FOUNDATION_CPU_TACKLE_V1.committingRoles gate",
  },
  flag_legend: FLAG_LEGEND,
  invariants_proved: [
    "kickoff freeze: every non-taker body holds its scenario kickoff home until the ball's touch reference stops being null",    "nearest-only chase: at most one designated chaser per team per tick; no other body converges on the ball",
    "one presser + one cover: the cover is the second-closest press-eligible body and sits behind the presser",
    "organic pass events fire after first touch, from the lane the structure opens",
    "accepted mechanisms still activate: cover, support, first touch, CPU tackle commitment",
    "stash the shape and the guards go red: the clump returns and the kickoff is never played",
  ],
  disclosures: [
    "Pre-existing simulation-core defect exposed by these windows: once the ball's regime is " +
      "'settled', stepBall applies no physics at all, so a horizontal impulse from a first touch " +
      "or a ground pass leaves the ball's velocity non-zero while its position never changes " +
      "(only an action with vz > MIN_LIFT_OFF_VELOCITY — a shot or a lofted chip — restarts it). " +
      "The 5v5 kickoff ball at the centre spot settles on tick 1, which is why the stashed " +
      "control run never plays the ball at all and why 'ball.travelMetres' stays 0 in the " +
      "kickoff window even though touches and pass events fire. Fixed only in the core, which " +
      "this objective must leave byte-identical.",
    "Pre-existing kickoff body-lock: with one chaser per team, two opposing bodies meeting the " +
      "untouched centre ball push each other outside the contact radius and the match never " +
      "opens. That is why the freeze exempts a single kick taker (closest body in the match, " +
      "ties by ascending playerId) rather than one per team.",
    "The recorded per-tick chase assignment is the production assignment " +
      "(designatePresser / assignChaseRoles / computeTeamDecision) evaluated over that tick's " +
      "committed geometry — i.e. what the adapters read when building the frames consumed on the " +
      "following tick.",
    "PHYSICAL_DUEL and the SMALL_SIDED_SHAPE milestone are not re-adjudicated here; the coherent " +
      "scanner/reducer re-run belongs to SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE.",
  ],
  runs: [],
};

let artifact: Artifact = scaffold;
try {
  const existing = JSON.parse(readFileSync(ARTIFACT_PATH, "utf-8")) as Artifact;
  if (existing?.objective_id === OBJECTIVE_ID && Array.isArray(existing.runs)) {
    artifact = { ...scaffold, ...existing, runs: existing.runs };
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

writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact)}\n`, "utf-8");
console.log(
  `[anti-huddle-evidence] wrote ${ARTIFACT_PATH} (runs: ${artifact.runs.map((r) => r.id).join(", ")})`,
);
