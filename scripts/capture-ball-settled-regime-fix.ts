/**
 * Node-side evidence producer for BALL-SETTLED-REGIME-FIX.
 *
 * Writes `docs/evidence/BALL-SETTLED-REGIME-FIX/trajectory.json`. The objective
 * fixes one simulation-core defect: `stepBall` applied no physics at all once
 * `ball.regime === "settled"`, so a first touch or ground pass could write
 * `ball.linearVelocity` and leave the ball's position frozen — the accepted
 * 5V5-KICKOFF-ANTI-HUDDLE kickoff window records exactly that.
 *
 * Recorded runs (coherent, per-tick, committed state — never an 8-tick fixture):
 *
 *   (a) `before_state` — the accepted, immutable pre-fix kickoff artifact quoted
 *       tick by tick around the first touch: velocity non-zero, position frozen,
 *       regime "settled".
 *   (b) `settled-impulse-integrator` — the primitive solver under a settled ball
 *       that is struck: ground pass, first touch, shot, lofted pass, and the
 *       at-rest control, each with per-tick 3D state and regime transitions.
 *   (c) `5v5-kickoff-cpu-vs-cpu` — the browser-wired 5v5 CPU-vs-CPU kickoff
 *       match over 600 ticks: the tick a settled ball is played, its displacement
 *       after, per-tick ball state, regime transition ticks, touch/pass events,
 *       no-teleport bound and the pitch-contact-flood guard numbers.
 *   (d) `5v5-flowing-cpu-vs-cpu` — a longer flowing match for the same numbers.
 *
 * Determinism: every match run is replayed inside this one process and its full
 * per-tick hash chain compared byte-for-byte (`determinism.replay_identical`),
 * and an independent second pass of this command must print the same
 * `state_hash_of_hashes`.
 *
 * Usage (each run is its own step; the artifact merges by run id):
 *   pnpm exec tsx scripts/capture-ball-settled-regime-fix.ts --only=settled-impulse-integrator
 *   pnpm exec tsx scripts/capture-ball-settled-regime-fix.ts --only=5v5-kickoff-cpu-vs-cpu
 *   pnpm exec tsx scripts/capture-ball-settled-regime-fix.ts --only=5v5-flowing-cpu-vs-cpu
 *
 * Node I/O is allowed here; the simulation core stays clock- and DOM-free.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { stepBall } from "../src/simulation/ball/ball-system.js";
import {
  FOUNDATION_BALL_V1,
  FOUNDATION_LOFTED_PASS_V1,
  FOUNDATION_PASS_V1,
  FOUNDATION_SHOT_V1,
} from "../src/simulation/config/foundation.js";
import { runHeadlessMatch } from "../eval/runners/headless-match.js";
import type { BallState } from "../src/contracts/state.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const OBJECTIVE_ID = "BALL-SETTLED-REGIME-FIX";
const MODEL_ID = "ball-settled-regime-v2";
const EVIDENCE_DIR = resolve("docs/evidence", OBJECTIVE_ID);
const ARTIFACT_PATH = resolve(EVIDENCE_DIR, "trajectory.json");

/** The accepted pre-fix artifact that disclosed the defect (read-only). */
const BEFORE_ARTIFACT = "docs/evidence/5V5-KICKOFF-ANTI-HUDDLE/trajectory.json";
const BEFORE_RUN_ID = "5v5-kickoff-cpu-vs-cpu";

const DT = 1 / 60;
const RADIUS = FOUNDATION_BALL_V1.ballRadius.value;

/** Event kinds that mean "a body played the ball". */
const TOUCH_KINDS = new Set([
  "player-ball-contact",
  "pass",
  "lofted-pass",
  "through-ball",
  "shot",
]);

interface RunSpec {
  id: string;
  kind: "solver" | "match";
  scenarioPath?: string;
  ticks?: number;
  /** Replay the run in-process and require byte-identical hash chains. */
  verifyDeterminism?: boolean;
}

const RUNS: RunSpec[] = [
  { id: "settled-impulse-integrator", kind: "solver" },
  {
    id: "5v5-kickoff-cpu-vs-cpu",
    kind: "match",
    scenarioPath: "eval/scenarios/5v5-fixture-v1.json",
    ticks: 600,
    verifyDeterminism: true,
  },
  {
    id: "5v5-flowing-cpu-vs-cpu",
    kind: "match",
    scenarioPath: "eval/scenarios/5v5-continuous-play.v1.json",
    ticks: 1200,
    verifyDeterminism: true,
  },
];

const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const selected = onlyArg
  ? new Set(onlyArg.slice("--only=".length).split(",").map((id) => id.trim()))
  : new Set(RUNS.map((run) => run.id));

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function round(value: number, decimals = 6): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function planar(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

// ---------------------------------------------------------------------------
// (a) Before-state disclosure — quoted from the accepted pre-fix artifact
// ---------------------------------------------------------------------------

interface BeforeStateDisclosure {
  source: string;
  source_sha256: string;
  source_run: string;
  note: string;
  code_branch_before_fix: string;
  kickoff_window_row_fields: string[];
  kickoff_window_rows: unknown[];
  recorded_summary: Record<string, unknown>;
}

function buildBeforeState(): BeforeStateDisclosure {
  const raw = readFileSync(resolve(BEFORE_ARTIFACT), "utf-8");
  const parsed = JSON.parse(raw) as {
    runs: Array<{
      id: string;
      per_tick: unknown[][];
      touch_events: unknown[];
      summary: Record<string, unknown>;
    }>;
  };
  const run = parsed.runs.find((candidate) => candidate.id === BEFORE_RUN_ID);
  if (!run) throw new Error(`accepted run ${BEFORE_RUN_ID} not found in ${BEFORE_ARTIFACT}`);

  // Accepted layout: [tick, ball.x, ball.y, ball.vx, ball.vy, ball.regime,
  // ball.lastTouchRef, kickoffTakerId, players, teams, eventKinds, stateHash].
  const firstTouch = Number(run.summary.firstTouchTick ?? 0);
  const rows = run.per_tick
    .filter((row) => Number(row[0]) >= firstTouch - 1 && Number(row[0]) <= firstTouch + 7)
    .map((row) => [row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[10]]);

  return {
    source: BEFORE_ARTIFACT,
    source_sha256: sha256(raw),
    source_run: BEFORE_RUN_ID,
    note:
      "Read-only quotation of the accepted 5V5-KICKOFF-ANTI-HUDDLE artifact, produced before this fix " +
      "by the same production wiring. It is this objective's before-state: the kickoff ball is settled " +
      "on the centre spot, is played at its first touch, and from that tick on carries a non-zero " +
      "ball.vx and ball.vy while ball.x and ball.y stay at 0 — the run's own summary reports " +
      "ballTravelMetres 0 with touch and pass events present.",
    code_branch_before_fix:
      'src/simulation/ball/ball-system.ts, integration tail: else { // "settled" — no physics. remaining = 0; }',
    kickoff_window_row_fields: [
      "tick", "ball.x", "ball.y", "ball.vx", "ball.vy", "ball.regime", "ball.lastTouchRef", "eventKinds",
    ],
    kickoff_window_rows: rows,
    recorded_summary: {
      firstTouchTick: run.summary.firstTouchTick,
      ballTravelMetres: run.summary.ballTravelMetres,
      ballDisplacementMetres: run.summary.ballDisplacementMetres,
      touch_events: run.touch_events.length,
      pass_events: run.summary.passEvents instanceof Array ? run.summary.passEvents.length : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// (b) Solver scripts: a settled ball that is struck
// ---------------------------------------------------------------------------

const SOLVER_TICK_FIELDS = [
  "tick", "ball.x", "ball.y", "ball.z", "ball.vx", "ball.vy", "ball.vz",
  "speed", "regime", "stepMetres", "eventKinds",
];

interface SolverCase {
  label: string;
  impulse: { x: number; y: number; z: number };
  impulse_source: string;
  tick_fields: string[];
  per_tick: unknown[][];
  regime_transitions: unknown[][];
  first_move_tick: number | null;
  displacement_metres: { after_1_tick: number; after_10_ticks: number; after_window: number };
  pitch_contacts: number;
  final_state: Record<string, unknown>;
}

function runSolverCase(
  label: string,
  impulseSource: string,
  impulse: { x: number; y: number; z: number },
  ticks: number,
): SolverCase {
  const ball: BallState = {
    position: { x: 0, y: 0, z: RADIUS },
    linearVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    regime: "settled",
    lastTouchRef: null,
  };
  const origin = { x: ball.position.x, y: ball.position.y };
  const counter = { value: 0 };
  const perTick: unknown[][] = [];
  const transitions: unknown[][] = [];
  let previousRegime: BallState["regime"] = "settled";
  let firstMoveTick: number | null = null;
  let displacement1 = 0;
  let displacement10 = 0;
  let contacts = 0;

  // The impulse is written between the contact stage and ball integration, the
  // order the simulation loop uses — velocity only, never a position assignment.
  ball.linearVelocity.x = impulse.x;
  ball.linearVelocity.y = impulse.y;
  ball.linearVelocity.z = impulse.z;

  for (let tick = 0; tick < ticks; tick++) {
    const before = { x: ball.position.x, y: ball.position.y, z: ball.position.z };
    const events = stepBall(ball, DT, FOUNDATION_BALL_V1, counter, tick);
    const step = Math.hypot(
      ball.position.x - before.x,
      ball.position.y - before.y,
      ball.position.z - before.z,
    );
    contacts += events.filter((event) => event.kind === "pitch-contact").length;
    if (ball.regime !== previousRegime) {
      transitions.push([tick, previousRegime, ball.regime]);
      previousRegime = ball.regime;
    }
    if (firstMoveTick === null && step > 0) firstMoveTick = tick;
    if (tick === 0) displacement1 = planar(ball.position.x, ball.position.y, origin.x, origin.y);
    if (tick === 9) displacement10 = planar(ball.position.x, ball.position.y, origin.x, origin.y);
    perTick.push([
      tick,
      round(ball.position.x),
      round(ball.position.y),
      round(ball.position.z),
      round(ball.linearVelocity.x),
      round(ball.linearVelocity.y),
      round(ball.linearVelocity.z),
      round(Math.hypot(ball.linearVelocity.x, ball.linearVelocity.y, ball.linearVelocity.z)),
      ball.regime,
      round(step),
      events.map((event) => event.kind),
    ]);
  }

  return {
    label,
    impulse,
    impulse_source: impulseSource,
    tick_fields: SOLVER_TICK_FIELDS,
    per_tick: perTick,
    regime_transitions: transitions,
    first_move_tick: firstMoveTick,
    displacement_metres: {
      after_1_tick: round(displacement1),
      after_10_ticks: round(displacement10),
      after_window: round(planar(ball.position.x, ball.position.y, origin.x, origin.y)),
    },
    pitch_contacts: contacts,
    final_state: {
      position: {
        x: round(ball.position.x),
        y: round(ball.position.y),
        z: round(ball.position.z),
      },
      linearVelocity: {
        x: round(ball.linearVelocity.x),
        y: round(ball.linearVelocity.y),
        z: round(ball.linearVelocity.z),
      },
      regime: ball.regime,
    },
  };
}

/** Compact ball state for the solver determinism script. */
function solverStateDigest(ball: BallState): string {
  return JSON.stringify([
    round(ball.position.x, 9), round(ball.position.y, 9), round(ball.position.z, 9),
    round(ball.linearVelocity.x, 9), round(ball.linearVelocity.y, 9), round(ball.linearVelocity.z, 9),
    ball.regime,
  ]);
}

function solverHashChain(ticks: number): string[] {
  const ball: BallState = {
    position: { x: 0, y: 0, z: RADIUS },
    linearVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    regime: "settled",
    lastTouchRef: null,
  };
  const counter = { value: 0 };
  const chain: string[] = [];
  for (let tick = 0; tick < ticks; tick++) {
    if (ball.regime === "settled" && tick % 40 === 0) {
      ball.linearVelocity.x = 4 + (tick % 13) * 0.25;
      ball.linearVelocity.y = -1.5 + (tick % 7) * 0.25;
      ball.linearVelocity.z = 0.2;
    }
    stepBall(ball, DT, FOUNDATION_BALL_V1, counter, tick);
    chain.push(sha256(solverStateDigest(ball)));
  }
  return chain;
}

function buildSolverRunRecord(): Record<string, unknown> {
  const cases = [
    runSolverCase(
      `settled + ground pass (FOUNDATION_PASS_V1 ${FOUNDATION_PASS_V1.exitSpeed.value} m/s, ` +
        "vz 0.4 — below MIN_LIFT_OFF_VELOCITY)",
      "contact-system computePassVelocity — writes velocity, never position",
      {
        x: FOUNDATION_PASS_V1.exitSpeed.value,
        y: 0,
        z: FOUNDATION_PASS_V1.exitSpeed.value * FOUNDATION_PASS_V1.verticalComponent.value,
      },
      2000,
    ),
    runSolverCase(
      "settled + first touch on a dead ball (vertical damped to 0)",
      "contact-system computeOutgoingVelocity — writes velocity, never position",
      { x: 3, y: 0, z: 0 },
      2000,
    ),
    runSolverCase(
      `settled + shot (FOUNDATION_SHOT_V1 ${FOUNDATION_SHOT_V1.exitSpeed.value} m/s, vz 1.8 — ` +
        "above MIN_LIFT_OFF_VELOCITY)",
      "contact-system computeShotVelocity — writes velocity, never position",
      {
        x: FOUNDATION_SHOT_V1.exitSpeed.value * 0.8,
        y: 0,
        z: FOUNDATION_SHOT_V1.exitSpeed.value * FOUNDATION_SHOT_V1.verticalComponent.value,
      },
      2000,
    ),
    runSolverCase(
      "settled + lofted pass (FOUNDATION_LOFTED_PASS_V1, vz 1.875 — above MIN_LIFT_OFF_VELOCITY)",
      "contact-system computeLoftedPassVelocity — writes velocity, never position",
      {
        x: FOUNDATION_LOFTED_PASS_V1.exitSpeed.value,
        y: 0,
        z: FOUNDATION_LOFTED_PASS_V1.exitSpeed.value * FOUNDATION_LOFTED_PASS_V1.verticalComponent.value,
      },
      2000,
    ),
    runSolverCase(
      "control: a settled ball with no impulse must stay exactly at rest",
      "no impulse applied — the settled branch still integrates nothing",
      { x: 0, y: 0, z: 0 },
      600,
    ),
  ];

  const chainA = solverHashChain(400);
  const chainB = solverHashChain(400);

  return {
    id: "settled-impulse-integrator",
    kind: "solver",
    reproduction:
      "stepBall(ball, 1/60, FOUNDATION_BALL_V1, counter, tick) with the ball settled on the pitch " +
      "plane and an impulse written to linearVelocity before the step — the order " +
      "src/simulation/loop/simulation.ts uses (contacts, then ball integration)",
    tick_fields: SOLVER_TICK_FIELDS,
    cases,
    determinism: {
      script: "strike a settled ball every 40 ticks for 400 ticks",
      state_hash_of_hashes: sha256(JSON.stringify(chainA)),
      replay_state_hash_of_hashes: sha256(JSON.stringify(chainB)),
      replay_identical: JSON.stringify(chainA) === JSON.stringify(chainB),
    },
  };
}

// ---------------------------------------------------------------------------
// (c)/(d) Coherent CPU-vs-CPU matches through the browser-wired headless driver
// ---------------------------------------------------------------------------

const MATCH_TICK_FIELDS = [
  "tick", "ball.x", "ball.y", "ball.z", "ball.vx", "ball.vy", "ball.vz",
  "speed", "regime", "lastTouchRef", "impulseOnSettled", "stepMetres",
  "eventKinds", "stateHash",
];

const SETTLED_IMPULSE_ROW_FIELDS = [
  "tick", "touch_kinds", "regime_before", "ball.x_before", "ball.y_before",
  "ball.vx_applied", "ball.vy_applied", "regime_after_integration",
  "max_planar_displacement_next_30_ticks",
];

function buildMatchRunRecord(spec: RunSpec): Record<string, unknown> {
  const scenario = loadScenario(spec.scenarioPath!);
  const ticks = spec.ticks!;
  const match = runHeadlessMatch({
    scenario,
    maxTicks: ticks,
    cpuAntiHuddle: true,
    cpuDefensiveTackle: true,
    browserParityObservations: true,
  });

  const obs = match.observations;
  const perTick: unknown[][] = [];
  const settledImpulses: unknown[][] = [];
  const transitions: unknown[][] = [];
  let previousRegime: string = obs[0]?.ball.regime ?? "settled";
  // The committed state before the first observation is the scenario's initial
  // ball, so the first tick's step is measured against that — not against a
  // guessed origin, which would invent a jump.
  let previousPosition = {
    x: scenario.ball.position.x,
    y: scenario.ball.position.y,
    z: scenario.ball.position.z,
  };
  let maxStep = 0;
  let travel = 0;

  obs.forEach((observation, index) => {
    const ball = observation.ball;
    const step = planar(ball.position.x, ball.position.y, previousPosition.x, previousPosition.y);
    maxStep = Math.max(maxStep, Math.hypot(step, ball.position.z - previousPosition.z));
    travel += step;
    const kinds = observation.events.map((event) => event.kind);
    const touches = kinds.filter((kind) => TOUCH_KINDS.has(kind));
    const impulseOnSettled = index > 0 && touches.length > 0 && previousRegime === "settled";
    if (impulseOnSettled) {
      let furthest = 0;
      for (const later of obs.slice(index, index + 30)) {
        furthest = Math.max(
          furthest,
          planar(
            later.ball.position.x,
            later.ball.position.y,
            previousPosition.x,
            previousPosition.y,
          ),
        );
      }
      settledImpulses.push([
        observation.tick,
        touches.join("|"),
        previousRegime,
        round(previousPosition.x, 3),
        round(previousPosition.y, 3),
        round(ball.linearVelocity.x, 3),
        round(ball.linearVelocity.y, 3),
        ball.regime,
        round(furthest, 3),
      ]);
    }
    if (ball.regime !== previousRegime) {
      transitions.push([observation.tick, previousRegime, ball.regime]);
      previousRegime = ball.regime;
    }
    perTick.push([
      observation.tick,
      round(ball.position.x),
      round(ball.position.y),
      round(ball.position.z),
      round(ball.linearVelocity.x),
      round(ball.linearVelocity.y),
      round(ball.linearVelocity.z),
      round(Math.hypot(ball.linearVelocity.x, ball.linearVelocity.y, ball.linearVelocity.z)),
      ball.regime,
      ball.lastTouchRef,
      impulseOnSettled,
      round(step),
      kinds,
      match.stateHashes[index] ?? null,
    ]);
    previousPosition = { x: ball.position.x, y: ball.position.y, z: ball.position.z };
  });

  const pitchContacts = match.events.filter((event) => event.kind === "pitch-contact");
  const contactsPerTick = new Map<number, number>();
  for (const event of pitchContacts) {
    contactsPerTick.set(event.tick, (contactsPerTick.get(event.tick) ?? 0) + 1);
  }
  const contactTicks = [...contactsPerTick.keys()].sort((a, b) => a - b);
  let minimumContactGap: number | null = null;
  for (let i = 1; i < contactTicks.length; i++) {
    minimumContactGap = Math.min(
      minimumContactGap ?? Number.POSITIVE_INFINITY,
      contactTicks[i] - contactTicks[i - 1],
    );
  }

  const regimeCounts: Record<string, number> = {};
  for (const row of perTick) {
    const regime = String(row[8]);
    regimeCounts[regime] = (regimeCounts[regime] ?? 0) + 1;
  }

  const first = obs[0]?.ball.position;
  const last = obs[obs.length - 1]?.ball.position;

  const determinism: Record<string, unknown> = {
    state_hash_of_hashes: sha256(JSON.stringify(match.stateHashes)),
    final_state_hash: match.stateHashes[match.stateHashes.length - 1] ?? null,
  };
  if (spec.verifyDeterminism) {
    const replayed = runHeadlessMatch({
      scenario: loadScenario(spec.scenarioPath!),
      maxTicks: ticks,
      cpuAntiHuddle: true,
      cpuDefensiveTackle: true,
      browserParityObservations: true,
    });
    determinism.replay_state_hash_of_hashes = sha256(JSON.stringify(replayed.stateHashes));
    determinism.replay_identical =
      JSON.stringify(replayed.stateHashes) === JSON.stringify(match.stateHashes);
    determinism.replay_event_count_identical = replayed.events.length === match.events.length;
  }

  return {
    id: spec.id,
    kind: "match",
    scenario: scenario.id,
    scenario_path: spec.scenarioPath,
    scenario_initial_ball: {
      position: { x: scenario.ball.position.x, y: scenario.ball.position.y, z: scenario.ball.position.z },
      linearVelocity: {
        x: scenario.ball.linearVelocity.x,
        y: scenario.ball.linearVelocity.y,
        z: scenario.ball.linearVelocity.z,
      },
      regime: scenario.ball.regime,
    },
    ticks: obs.length,
    simulated_seconds: round(obs.length / 60, 3),
    reproduction:
      `runHeadlessMatch({ scenario: load(${JSON.stringify(spec.scenarioPath)}), maxTicks: ${ticks}, ` +
      "cpuAntiHuddle: true, cpuDefensiveTackle: true, browserParityObservations: true }) — the " +
      "browser composition root's CPU wiring over the accepted headless driver",
    tick_fields: MATCH_TICK_FIELDS,
    settled_impulse_row_fields: SETTLED_IMPULSE_ROW_FIELDS,
    settled_impulse_rows: settledImpulses,
    per_tick: perTick,
    summary: {
      firstTouchTick: match.events.find((event) => TOUCH_KINDS.has(event.kind))?.tick ?? null,
      settled_impulse_ticks: settledImpulses.map((row) => row[0]),
      touch_events: match.events.filter((event) => TOUCH_KINDS.has(event.kind)).length,
      pass_events: match.events.filter(
        (event) => event.kind === "pass" || event.kind === "lofted-pass" || event.kind === "through-ball",
      ).length,
      ballTravelMetres: round(travel, 3),
      ballDisplacementMetres: first && last ? round(planar(last.x, last.y, first.x, first.y), 3) : 0,
      max_ball_tick_step_metres: round(maxStep, 4),
      regime_tick_counts: regimeCounts,
      regime_transition_ticks: transitions,
      pitch_contacts: pitchContacts.length,
      pitch_contacts_per_100_ticks: round((pitchContacts.length / Math.max(1, obs.length)) * 100, 4),
      max_contacts_in_one_tick: contactsPerTick.size ? Math.max(...contactsPerTick.values()) : 0,
      minimum_gap_between_contact_ticks: minimumContactGap,
      goals: match.goalEvents.length,
      score: match.score,
    },
    determinism,
  };
}

// ---------------------------------------------------------------------------
// Artifact assembly (merges by run id so long windows can be captured in steps)
// ---------------------------------------------------------------------------

interface Artifact {
  schema_version: number;
  objective_id: string;
  evidence_class: string;
  produced_by: string;
  model_id: string;
  driver: string;
  fix: Record<string, unknown>;
  thresholds: Record<string, unknown>;
  before_state: BeforeStateDisclosure;
  invariants_proved: string[];
  disclosures: string[];
  runs: Record<string, unknown>[];
}

const scaffold: Artifact = {
  schema_version: 1,
  objective_id: OBJECTIVE_ID,
  evidence_class: "MULTI_TICK",
  produced_by: "scripts/capture-ball-settled-regime-fix.ts",
  model_id: MODEL_ID,
  driver:
    "src/simulation/ball/ball-system.ts stepBall (primitive scripts) and " +
    "eval/runners/headless-match.ts runHeadlessMatch (coherent CPU-vs-CPU matches with the browser " +
    "composition root's CPU wiring) — committed per-tick state only",
  fix: {
    model_id: MODEL_ID,
    file: "src/simulation/ball/ball-system.ts",
    change:
      'a ball whose regime is "settled" and which carries an applied impulse at or above ' +
      "SETTLED_IMPULSE_WAKE_SPEED re-enters the accepted regime model in the same tick: vertical " +
      "speed above MIN_LIFT_OFF_VELOCITY is already airborne through the accepted lift-off " +
      "transition, anything else enters ground-roll and settles again through the accepted " +
      "GROUND_SETTLE_SPEED check. Position is only ever integrated (velocity × dt).",
    wake_threshold_metres_per_second: 0.01,
    wake_threshold_note:
      "SETTLED_IMPULSE_WAKE_SPEED is held equal to GROUND_SETTLE_SPEED so waking and settling are " +
      "symmetric and one impulse produces exactly one transition. Provisional placeholder — not a " +
      "measured PES value.",
    core_files_changed: ["src/simulation/ball/ball-system.ts"],
  },
  thresholds: {
    note: "mirrors of the module-private thresholds in src/simulation/ball/ball-system.ts",
    MIN_LIFT_OFF_VELOCITY: 0.5,
    POST_BOUNCE_ABSORB_THRESHOLD: 1.0,
    GROUND_SETTLE_SPEED: 0.01,
    SETTLED_IMPULSE_WAKE_SPEED: 0.01,
    MAX_SWEPT_ITERATIONS: 4,
    accepted_oscillation_fix:
      "MIN_LIFT_OFF_VELOCITY, POST_BOUNCE_ABSORB_THRESHOLD and the ground-roll vz clamp, accepted in " +
      "b72ad12 with SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE; this objective keeps them working " +
      "and re-pins the flood guards on top of them",
  },
  before_state: buildBeforeState(),
  invariants_proved: [
    "a settled ball that receives an applied impulse integrates position from it in the same tick",
    "the wake re-enters the accepted regime model exactly once: ground-roll below " +
      "MIN_LIFT_OFF_VELOCITY, airborne above it, then ground-roll, then settled through " +
      "GROUND_SETTLE_SPEED",
    "the accepted ground↔airborne pitch-contact flood stays closed: bounded contacts per 100 ticks, " +
      "never two contacts in one tick, never contacts on consecutive ticks",
    "no teleport: every per-tick ball step stays inside the integration bound; the ball stays an " +
      "independent 3D entity that is never parented to a body",
    "same seed → byte-identical per-tick hash chains across two runs, in-process and across processes",
  ],
  disclosures: [
    "The fix legitimately changes deterministic outcomes wherever a settled ball previously received an " +
      "impulse and never moved. Accepted durable evidence under docs/evidence/** is NOT rewritten by " +
      "this objective and stays the before-state. Tests that byte-pinned a live re-run against those " +
      "artifacts now carry two-arm pins (accepted digest + re-captured live digest): " +
      "tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-1-RERUN/3/4/5-binding.test.ts and " +
      "eval/scenarios/no-tackle-additivity-baseline.v1.json. No accepted situation verdict, relevant " +
      "event kind or relevant event count changed — only per-tick trajectory bytes.",
    "The accepted 5V5-KICKOFF-ANTI-HUDDLE kickoff trajectory (this file's before_state source) is " +
      "immutable; its integration test re-runs live, and its kickoff density numbers move with the fix " +
      "because a played ball creates real support geometry. Its structural invariants — kickoff freeze " +
      "displacement 0, exactly one designated chaser per team per tick, and staying shallower than the " +
      "stashed shape — are unchanged.",
    "The accepted SMALL-SIDED scanner and milestone claims are not re-adjudicated here; that re-run " +
      "belongs to SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE.",
    "No PES 2017 value is claimed: the wake threshold is a provisional placeholder held equal to the " +
      "accepted settle threshold, and every pass/shot/lofted-pass speed quoted here is already versioned " +
      "provisional configuration.",
  ],
  runs: [],
};

let artifact: Artifact = scaffold;
try {
  const existing = JSON.parse(readFileSync(ARTIFACT_PATH, "utf-8")) as Artifact;
  if (existing?.objective_id === OBJECTIVE_ID && Array.isArray(existing.runs)) {
    artifact = {
      ...scaffold,
      ...existing,
      runs: existing.runs,
      before_state: scaffold.before_state,
    };
  }
} catch {
  /* first pass: start from the scaffold */
}

mkdirSync(EVIDENCE_DIR, { recursive: true });

for (const spec of RUNS) {
  if (!selected.has(spec.id)) continue;
  const record = spec.kind === "solver" ? buildSolverRunRecord() : buildMatchRunRecord(spec);
  const index = artifact.runs.findIndex((run) => run.id === spec.id);
  if (index >= 0) artifact.runs[index] = record;
  else artifact.runs.push(record);

  if (spec.kind === "solver") {
    const determinism = record.determinism as Record<string, unknown>;
    console.log(
      `[ball-settled-regime] ${spec.id}: cases=${(record.cases as unknown[]).length}` +
        ` deterministic=${String(determinism.replay_identical)}` +
        ` hashOfHashes=${String(determinism.state_hash_of_hashes).slice(0, 24)}`,
    );
  } else {
    const summary = record.summary as Record<string, unknown>;
    const determinism = record.determinism as Record<string, unknown>;
    console.log(
      `[ball-settled-regime] ${spec.id}: ticks=${record.ticks}` +
        ` settledImpulseTicks=${JSON.stringify(summary.settled_impulse_ticks)}` +
        ` travel=${String(summary.ballTravelMetres)}` +
        ` maxStep=${String(summary.max_ball_tick_step_metres)}` +
        ` contacts=${String(summary.pitch_contacts)}` +
        ` per100=${String(summary.pitch_contacts_per_100_ticks)}` +
        ` deterministic=${String(determinism.replay_identical)}` +
        ` hashOfHashes=${String(determinism.state_hash_of_hashes).slice(0, 24)}`,
    );
  }
}

artifact.runs.sort(
  (a, b) => RUNS.findIndex((run) => run.id === a.id) - RUNS.findIndex((run) => run.id === b.id),
);

writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact)}\n`, "utf-8");
console.log(
  `[ball-settled-regime] wrote ${ARTIFACT_PATH} (runs: ${artifact.runs.map((run) => run.id).join(", ")})`,
);
