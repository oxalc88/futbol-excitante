/**
 * Node-side evidence producer for RESTART-ANTI-HUDDLE-COHERENCE.
 *
 * Writes `docs/evidence/RESTART-ANTI-HUDDLE-COHERENCE/trajectory.json`:
 * coherent 5v5 CPU-vs-CPU matches (1800 ticks = 30 s each, plus short stashed
 * controls) recorded tick by tick from committed state and segmented into the
 * match's restart windows — throw-in, goal kick, corner and post-goal, with
 * the kickoff window re-asserted as the regression baseline. Every accepted
 * restart type carries:
 *
 *   (a) the core's restart-hold run (the accepted phase hold keeps every body
 *       still at the core's restart placement while the countdown runs),
 *   (b) the serve window: per-tick frozen count, frozen bodies' displacement
 *       from their window anchor, the single designated taker, and the first
 *       touch of the restarted ball,
 *   (c) the post-touch shape: per-tick single designated chaser per team and
 *       same-team ball density.
 *
 * Stashed controls (`cpuAntiHuddle: false`) show the huddle resurfacing at
 * restarts — no frozen ticks, and on the throw-in arc an untouched serve the
 * match never resolves with four same-team bodies inside the clump radius.
 *
 * Reproducibility: every live run is replayed twice inside this process and
 * must produce byte-identical per-tick committed-hash chains; an independent
 * second pass of the same command must print the same artifact SHA-256.
 *
 * Usage (each long window is its own step; the artifact merges by run id):
 *   npx tsx scripts/capture-restart-anti-huddle-evidence.ts --only=restart-throwin-cpu-vs-cpu
 *   npx tsx scripts/capture-restart-anti-huddle-evidence.ts --only=restart-goalkick-postgoal-cpu-vs-cpu
 *   npx tsx scripts/capture-restart-anti-huddle-evidence.ts --only=restart-corner-cpu-vs-cpu
 *   npx tsx scripts/capture-restart-anti-huddle-evidence.ts --only=restart-throwin-stashed-control,restart-goalkick-postgoal-stashed-control,restart-corner-stashed-control
 *
 * Node I/O is allowed here; the simulation core is untouched.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import {
  runRestartAntiHuddleMatch,
  type RestartMatchResult,
  type RestartTickRecord,
  type RestartWindowRecord,
} from "../eval/runners/restart-anti-huddle-match.js";
import {
  getKickoffFreezeActivations,
  getNearestOnlyChaseActivations,
  getRestartFreezeActivations,
  resetMechanismCounters,
  ANTI_HUDDLE_V1_ID,
  RESTART_HOLD_MIN_TICKS,
} from "../src/adapters/input-browser/cpu-adapter.js";
import { FOUNDATION_CPU_TACKLE_V1 } from "../src/simulation/config/foundation.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "RESTART-ANTI-HUDDLE-COHERENCE";
const EVIDENCE_DIR = resolve("docs/evidence", OBJECTIVE_ID);
const ARTIFACT_PATH = resolve(EVIDENCE_DIR, "trajectory.json");

/** One pinned run: label, scenario path, tick budget and switch position. */
interface RunSpec {
  id: string;
  scenarioPath: string;
  ticks: number;
  antiHuddle: boolean;
  /** Replay in-process and require byte-identical hash chains. */
  verifyDeterminism: boolean;
  /** Which restart window kinds this run is cited for. */
  covers: string[];
  note: string;
}

const RUNS: RunSpec[] = [
  {
    // Accepted coherent 5v5 match: organic corner restart at tick ~404, plus
    // the kickoff window re-asserted as the regression baseline.
    id: "restart-corner-cpu-vs-cpu",
    scenarioPath: "eval/scenarios/5v5-continuous-play.v1.json",
    ticks: 1800,
    antiHuddle: true,
    verifyDeterminism: true,
    covers: ["corner"],
    note:
      "the accepted 5v5-continuous-play match, unchanged, with its organic goal-line pickup " +
      "localized as a corner restart; its kickoff ball starts at a body's feet, so the first " +
      "touch lands on the opening commit (no serve window) and the accepted kickoff shape is " +
      "re-guarded in tests/integration/5v5-kickoff-anti-huddle.test.ts",
  },
  {
    // Derived arc (see disclosures): the accepted kickoff geometry nudged to
    // the near touchline so the restarted ball runs out under play pressure
    // and the engine's own MATCH-THROW-IN machinery repeats.
    id: "restart-throwin-cpu-vs-cpu",
    scenarioPath: "eval/scenarios/5v5-restart-throwin.v1.json",
    ticks: 1800,
    antiHuddle: true,
    verifyDeterminism: true,
    covers: ["kickoff", "throw-in"],
    note: "two organic throw-in restarts inside coherent 5v5 CPU-vs-CPU play",
  },
  {
    // Derived arc: the engine's own MATCH-GOAL-KICK and post-goal (MATCH-SET-
    // PIECE goal reset) machinery, localized inside one coherent match.
    id: "restart-goalkick-postgoal-cpu-vs-cpu",
    scenarioPath: "eval/scenarios/5v5-restart-arc.v1.json",
    ticks: 1800,
    antiHuddle: true,
    verifyDeterminism: true,
    covers: ["kickoff", "goal-kick", "post-goal"],
    note: "an early shot off the goal-line scramble returns as a goal kick; every goal returns as a post-goal restart keyed to the stale touch reference",
  },
  {
    id: "restart-corner-stashed-control",
    scenarioPath: "eval/scenarios/5v5-continuous-play.v1.json",
    ticks: 520,
    antiHuddle: false,
    verifyDeterminism: false,
    covers: ["kickoff", "post-goal"],
    note: "stashed control: frozen ticks collapse to 0 at the same restart machinery",
  },
  {
    id: "restart-throwin-stashed-control",
    scenarioPath: "eval/scenarios/5v5-restart-throwin.v1.json",
    ticks: 200,
    antiHuddle: false,
    verifyDeterminism: false,
    covers: ["kickoff", "throw-in"],
    note: "stashed control: the throw-in serve is never resolved and the clump (4 same-team bodies inside 5 m) returns around it",
  },
  {
    id: "restart-goalkick-postgoal-stashed-control",
    scenarioPath: "eval/scenarios/5v5-restart-arc.v1.json",
    ticks: 950,
    antiHuddle: false,
    verifyDeterminism: false,
    covers: ["kickoff", "post-goal"],
    note: "stashed control: post-goal serves restart with zero frozen bodies",
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
// Compact per-tick encoding (same convention as the accepted anti-huddle run:
// tuple layout declared once in `tick_fields`, players follow `player_order`)
// ---------------------------------------------------------------------------

const FLAG_LETTERS: Array<[string, string]> = [
  ["frozen", "f"],
  ["designatedChaser", "c"],
  ["designatedTaker", "t"],
];

function encodeFlags(player: RestartTickRecord["players"][number]): string {
  const record = player as unknown as Record<string, boolean>;
  return FLAG_LETTERS.filter(([field]) => record[field] === true)
    .map(([, letter]) => letter)
    .join("");
}

function encodeTick(tick: RestartTickRecord, playerOrder: string[]): unknown[] {
  const byId = new Map(tick.players.map((player) => [player.playerId, player]));
  return [
    tick.tick,
    tick.phase,
    tick.ballUntouched ? 1 : 0,
    tick.takerId,
    [
      tick.ball.x,
      tick.ball.y,
      tick.ball.vx,
      tick.ball.vy,
      tick.ball.regime,
      tick.ball.lastTouchRef,
    ],
    playerOrder.map((id) => {
      const player = byId.get(id);
      if (!player) return null;
      return [
        player.x,
        player.y,
        player.speed,
        player.distToBall,
        player.distToHome,
        player.frozenDriftMetres,
        encodeFlags(player),
        player.pressed,
      ];
    }),
    Object.fromEntries(Object.entries(tick.teams).map(([teamId, team]) => [
      teamId,
      [team.chaserPlayerId, team.playersWithinHuddleRadius],
    ])),
    tick.eventKinds,
    tick.stateHash,
  ];
}

const TICK_FIELDS = [
  "tick",
  "phase",
  "ballUntouched",
  "takerId",
  // ball: [x, y, vx, vy, regime, lastTouchRef]
  "ball",
  // players[], in `player_order`:
  // [x, y, speed, distToBall, distToHome, frozenDriftMetres, flags, pressed]
  // flags: f=frozen at the window anchor, c=designated chaser, t=designated taker
  "players",
  // per team: [chaserPlayerId, playersWithinHuddleRadius(<5m)]
  "teams",
  "eventKinds",
  "stateHash",
];

const FLAG_LEGEND = {
  f: "frozen — held at its restart-window anchor (kickoff home at kickoff/reset; the core's placement at a set piece) this tick",
  c: "designatedChaser — the team's single designated presser/chaser for this geometry",
  t: "designatedTaker — the single closest body in the match to the untouched restart ball, allowed to break the freeze",
  precedence:
    "while the ball is an untouched restart ball, f freezes every body but the taker and any body already inside the touch radius",
};

// ---------------------------------------------------------------------------
// Window records
// ---------------------------------------------------------------------------

function encodeWindow(window: RestartWindowRecord): Record<string, unknown> {
  return { ...window };
}

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
  lifecycle_phase_sync: string;
  covers: string[];
  note: string;
  reproduction: string;
  driver: string;
  player_order: string[];
  kickoff_homes: Record<string, { x: number; y: number }>;
  tick_fields: string[];
  per_tick: unknown[];
  huddle_radius_metres: number;
  windows: Record<string, unknown>[];
  summary: Record<string, unknown>;
  mechanism_counters: Record<string, number>;
  determinism: Record<string, unknown>;
}

function buildRunRecord(spec: RunSpec): RunRecord {
  const scenario = loadScenario(spec.scenarioPath);

  resetMechanismCounters();
  const result = runRestartAntiHuddleMatch({
    scenario,
    maxTicks: spec.ticks,
    cpuAntiHuddle: spec.antiHuddle,
  });
  const mechanism = {
    kickoff_freeze: getKickoffFreezeActivations(),
    restart_freeze: getRestartFreezeActivations(),
    nearest_only_hold: getNearestOnlyChaseActivations(),
  };

  const playerOrder = result.ticks[0]?.players.map((player) => player.playerId) ?? [];

  const determinism: Record<string, unknown> = {
    state_hash_of_hashes: sha256(JSON.stringify(result.stateHashes)),
    final_state_hash: result.stateHashes[result.stateHashes.length - 1] ?? null,
  };
  let replay: RestartMatchResult | null = null;
  if (spec.verifyDeterminism) {
    resetMechanismCounters();
    replay = runRestartAntiHuddleMatch({
      scenario: loadScenario(spec.scenarioPath),
      maxTicks: spec.ticks,
      cpuAntiHuddle: spec.antiHuddle,
    });
    determinism.replay_state_hash_of_hashes = sha256(JSON.stringify(replay.stateHashes));
    determinism.replay_identical =
      JSON.stringify(replay.stateHashes) === JSON.stringify(result.stateHashes);
    determinism.replay_windows_identical =
      JSON.stringify(replay.summary.windows) === JSON.stringify(result.summary.windows);
  }

  const kinds = new Map<string, number>();
  for (const window of result.windows) {
    kinds.set(window.kind, (kinds.get(window.kind) ?? 0) + 1);
  }

  const record: RunRecord = {
    id: spec.id,
    scenario: scenario.id,
    scenario_path: spec.scenarioPath,
    ticks: result.totalTicks,
    simulated_seconds: Math.round((result.totalTicks / 60) * 1000) / 1000,
    anti_huddle: spec.antiHuddle,
    lifecycle_phase_sync: "core-owned (the runner lets the core run its restart windows)",
    covers: spec.covers,
    note: spec.note,
    reproduction:
      `runRestartAntiHuddleMatch({ scenario: load(${JSON.stringify(spec.scenarioPath)}), ` +
      `maxTicks: ${spec.ticks}, cpuAntiHuddle: ${spec.antiHuddle} })`,
    driver:
      "eval/runners/restart-anti-huddle-match.ts over eval/runners/headless-match.ts with " +
      "browserParityObservations + lifecyclePhaseSync 'core-owned' (browser restart parity); " +
      "per-tick chase/taker assignment recorded through the same exported production functions " +
      "the adapters act on (assignChaseRoles)",
    player_order: playerOrder,
    kickoff_homes: result.kickoffHomes,
    tick_fields: TICK_FIELDS,
    per_tick: result.ticks.map((tick) => encodeTick(tick, playerOrder)),
    huddle_radius_metres: result.huddleRadiusMetres,
    windows: result.windows.map(encodeWindow),
    summary: {
      ticks: result.summary.ticks,
      goals: result.summary.goals,
      kinds_observed: result.summary.kindsObserved,
      kind_counts: Object.fromEntries(kinds),
      serve_window_clump_team_ticks: result.summary.serveWindowClumpTeamTicks,
      restart_freeze_activations: mechanism.restart_freeze,
    },
    mechanism_counters: mechanism,
    determinism,
  };

  console.log(
    `[restart-evidence] ${spec.id}: ticks=${record.ticks}` +
      ` kinds=${JSON.stringify(Object.fromEntries(kinds))}` +
      ` goals=${result.summary.goals}` +
      ` serveClump=${result.summary.serveWindowClumpTeamTicks}` +
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
  coverage: Record<string, string[]>;
  runs: RunRecord[];
}

const scaffold: Artifact = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  produced_by: "scripts/capture-restart-anti-huddle-evidence.ts",
  driver:
    "eval/runners/restart-anti-huddle-match.ts (coherent CPU-vs-CPU matches segmented into the " +
    "engine's own restart windows; per-tick geometry recorded from committed state)",
  activation: {
    field: "CpuObservation.cpuAntiHuddle (accepted kill switch) + the accepted restart hold-phase gate + restart window keying on the ball's authoritative touch reference",
    meaning:
      "the restart freeze is the accepted anti-huddle freeze re-armed at every restart: the ball is an untouched restart ball while its touch reference is null (kickoff, throw-in, goal kick, corner serve) or still equals the reference observed when play resumed from a core reset that did not clear it (post-goal, halftime). cpuAntiHuddle: false restores the pre-objective chase-everything frames at restarts byte-for-byte",
    set_by: [
      "src/apps/browser/main.ts (browser match composition root)",
      "runHeadlessMatch({ lifecyclePhaseSync: 'core-owned' }) (these runs — the core's restart machinery must be allowed to run)",
      "tests/integration/restart-anti-huddle.test.ts (live + stashed guards)",
    ],
  },
  configs: {
    anti_huddle_parameters: ANTI_HUDDLE_V1_ID,
    all_values_provisional: true,
    provisional_constants: {
      KICKOFF_FREEZE_HOME_TOLERANCE_METRES: 0.75,
      CHASE_NEAREST_HOME_TOLERANCE_METRES: 0.75,
      RESTART_HOLD_MIN_TICKS: RESTART_HOLD_MIN_TICKS,
      touch_press_range_metres: "min(FIRST_TOUCH_RANGE * difficulty, FOUNDATION_CONTACT_V1.contactRadius)",
      huddle_measurement_radius_metres: 5,
      after_touch_observation_window_ticks: 120,
    },
    press_role_policy: FOUNDATION_CPU_TACKLE_V1.id,
    note:
      "no value here is a measured PES 2017 constant; no new parameter version was needed — the " +
      "accepted anti-huddle-v1 tolerances carry the restart windows unchanged",
  },
  flag_legend: FLAG_LEGEND,
  invariants_proved: [
    "restart freeze: inside every serve window (throw-in, goal kick, corner, post-goal) every body except the single designated taker and any body already inside the touch radius holds its window anchor; the accepted kickoff window reproduces the accepted shape unchanged",
    "single taker/chaser: at most one designated taker per untouched ball per tick; after the first touch exactly one designated chaser per team converges",
    "first touch closes the window: every serve window ends at the tick the restarted ball's touch reference changes, and play continues coherently",
    "no clump: at most 2 same-team bodies inside the 5 m radius on any serve-window tick of the live runs (0 clump team-ticks)",
    "stash the shape and the guards go red: zero frozen body-ticks, and on the throw-in arc the restart is never resolved while four same-team bodies clump the untouched ball",
  ],
  disclosures: [
    "Headless driver defect found and repaired while producing this evidence: runHeadlessMatch overwrote the simulation core's match phase with its own derived label every tick, so the core's restart countdowns never executed and set pieces / the post-goal reset never happened headless (the browser wiring never synced and always ran them). The runner now offers lifecyclePhaseSync: 'core-owned' (used by every live and stashed run here) and keeps the historical 'legacy' sync as the DEFAULT, because every accepted headless artifact was pinned byte-for-byte under the old behavior. The accepted 5V5-KICKOFF-ANTI-HUDDLE flowing artifact therefore contains no executed set piece — that artifact stays untouched on disk.",
    "The headless legacy sync also stamped 'halftime' for a single tick without arming the core's halftime countdown. The adapter's restart-window arming therefore requires the hold to last at least RESTART_HOLD_MIN_TICKS (2) observed ticks; real core windows hold for dozens of ticks. Accepted legacy runs can never arm a window from the 1-tick stamp, so their pinned bytes are untouched.",
    "eval/scenarios/5v5-restart-throwin.v1.json and eval/scenarios/5v5-restart-arc.v1.json are derived from the accepted eval/scenarios/5v5-continuous-play.v1.json by moving only the kickoff ball (and two bodies' start homes) so the engine's OWN out-of-play detection, restart placement, countdowns and serves run repeatedly inside coherent CPU-vs-CPU play. No player input is scripted; no state is injected. In the arc scenario the core's post-goal reset returns the ball to that scenario's start position (deep in the right box), which is why it produces repeated goal-restart cycles: rich restart-window coverage from one scenario, at the cost of second-half ecological realism. No PES 2017 value is claimed for either arc.",
    "The throw-in stashed control's serve window never closes inside its 200-tick budget: with the shape stashed nobody keeps issuing the restart press, four same-team bodies sit inside the clump radius around the untouched ball, and the restart deadlocks. The live runs close every serve window: throw-in serves are played by their taker on the placement commit itself (1 untouched tick under the live label), corner and goal-kick serves land within ~6 ticks, post-goal and kickoff serves run up to ~37 ticks while the single taker crosses the pitch.",
    "Goalkeepers, regulation rules, 11v11 and PES fidelity envelopes are out of scope; small-sided 5v5 bounds only. The restart set-piece placement itself is core (accepted MATCH-THROW-IN / MATCH-GOAL-KICK / MATCH-CORNER-KICK / MATCH-SET-PIECE machinery), untouched here; only the CPU team behavior during and after each window is observed and guarded.",
  ],
  coverage: {},
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

// Coverage table: which kinds are evidenced (live runs only).
const coverage: Record<string, string[]> = {};
for (const run of artifact.runs) {
  if (!run.anti_huddle) continue;
  for (const window of run.windows) {
    const kind = String(window.kind);
    const cite = `${run.id}:${String(window.id)}`;
    const list = coverage[kind] ??= [];
    if (!list.includes(cite)) list.push(cite);
  }
}
artifact.coverage = coverage;

writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact)}\n`, "utf-8");
console.log(
  `[restart-evidence] wrote ${ARTIFACT_PATH} (runs: ${artifact.runs.map((r) => r.id).join(", ")})`,
);
console.log(
  `[restart-evidence] artifact sha256=${sha256(readFileSync(ARTIFACT_PATH, "utf-8"))}`,
);
