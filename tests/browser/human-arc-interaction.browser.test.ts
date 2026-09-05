/**
 * Browser-mode DYNAMIC_VISUAL capture for HUMAN-VS-CPU-ARC-INTERACTION.
 *
 * Five event-centered frames of the HUMAN side of the anti-huddle arc inside
 * the REAL 5v5 human-vs-CPU browser match (`?mode=human-vs-ai-5v5`,
 * eval/scenarios/5v5-human-vs-cpu.v1.json, slot-1 HUMAN controlling player-1):
 *
 *   arc opens (CPU kickoff touch) -> human Tab switch mid-arc -> human
 *   slide-tackle commit on the CPU carrier -> tackle result (duel won) ->
 *   human pass
 *
 * The human never writes simulation state. Every discrete action enters
 * through the tick-indexed `InputFrame` contract with exactly the bits the
 * browser keyboard produces (Tab -> SWITCH_PLAYER_BIT, I -> SLIDE_TACKLE_BIT,
 * J -> PASS_BIT; WASD-style axis steering in {-1,0,1}), the same input path
 * the accepted SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY and
 * HUMAN-DEFENSIVE-DUEL-CONTROL evidence pinned. The CPU slots run the
 * accepted anti-huddle adapter (`cpuAntiHuddle: true` +
 * `cpuDefensiveTackle: true`, the `main.ts` human-vs-ai-5v5 wiring).
 *
 * Passes, all inside Chromium (the accepted anti-huddle capture precedent):
 *   Pass 1 - play the match with the human program and locate the event ticks
 *            from the run's own event log (no rendering).
 *   Pass 2 - replay the same wiring from scratch, render the five frames at
 *            those ticks, and require the replayed per-tick hash chain and the
 *            located arc (including every input-tick binding) to be identical.
 *   Pass 3 - the same wiring with the human program idling (neutral frames
 *            only): the CPU arc still opens, but none of the named human
 *            interactions occur, so no frame of this sequence can be located.
 *   Pass 3b - the full human program with the anti-huddle shape stashed
 *            (`cpuAntiHuddle: false`): the kickoff ball is never touched, the
 *            arc never opens, every geometry-gated human press stays armed
 *            and no arc is located.
 *   Pass 4 - hash the PNG bytes and write `sequence.json` plus the browser-side
 *            `trajectory.json` (per-tick committed hashes, geometry, per-team
 *            chase/cover designation, and the human input rows byte-bound to
 *            the events they cause at the same commit).
 *
 * Durable evidence is written only through the explicit capture command
 * (`WIP_SECTION=__EVIDENCE__:HUMAN-VS-CPU-ARC-INTERACTION ...`); an ordinary
 * suite run lands in `test-results/gauntlet-capture/` and never touches
 * accepted evidence.
 *
 * Cross-runtime note (disclosed, not hidden): the human-program event ticks
 * are this Chromium run's own; they are located from the run itself, never
 * transcribed. The kickoff structure (first touch on tick 18 by player-10) is
 * compared to the pinned Node artifacts of the same scenario geometry;
 * per-tick floats are not compared across runtimes (known pinned-runtime gap).
 *
 * No Math.random, wall clock, DOM, or Node I/O in the simulation core; this
 * test only consumes it through the accepted composition root.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { commands } from "@vitest/browser/context";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5 } from "../../src/apps/browser/foundation-scenario.js";
import { DEFAULT_RENDERER_CONFIG } from "../../src/adapters/renderer-three/renderer.js";
import {
  createCpuAdapter,
  buildCpuObservation,
  assignChaseRoles,
  getKickoffFreezeActivations,
  getNearestOnlyChaseActivations,
  getRestartFreezeActivations,
  getCpuTackleCommitActivations,
  resetMechanismCounters,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import {
  PASS_BIT,
  SWITCH_PLAYER_BIT,
  SLIDE_TACKLE_BIT,
} from "../../src/contracts/input.js";
import {
  FOUNDATION_CONTACT_V1,
  FOUNDATION_PASS_V1,
} from "../../src/simulation/config/foundation.js";
import type { ScenarioDefinition, SimulationEvent } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";

const OBJECTIVE_ID = "HUMAN-VS-CPU-ARC-INTERACTION";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const OUTPUT_REL = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;
const TRAJECTORY_REL = DURABLE_EVIDENCE
  ? `docs/evidence/${OBJECTIVE_ID}/trajectory.json`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}/trajectory.json`;
const SEQUENCE_REL = `${OUTPUT_REL}/sequence.json`;

/** The browser's own 5v5 human-vs-CPU match (`?mode=human-vs-ai-5v5`). */
const SCENARIO = FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5;
const SCENARIO_PATH = "eval/scenarios/5v5-human-vs-cpu.v1.json";
/** Coherent browser window: >= 600 committed ticks (12 s at the 60 Hz tick). */
const PLAY_TICKS = 720;

/**
 * Measurement thresholds for the evidence only - provisional, never gameplay
 * values. The home tolerance, the huddle radius and the touch-press exempt
 * radius are the accepted provisional constants of the pinned anti-huddle
 * artifacts; the pass radius is the pinned versioned config value. The Tab
 * cadence and the tackle-commit range bound what a plausible keyboard player
 * does; they gate the human program, they never touch a simulation constant.
 * No new rubric.
 */
const HOME_TOLERANCE_METRES = 0.75;
const HUDDLE_RADIUS_METRES = 5;
/** How far inside the freeze window the arc-open frame's freeze baseline holds. */
const FREEZE_LEAD_TICKS = 8;
/** Bodies that must still hold their kickoff home before the first touch. */
const BODIES_AT_HOME_BEFORE_TOUCH = 8;
/** Ticks after the kickoff first touch before the human starts the Tab cycle. */
const SWITCH_DELAY_TICKS = 25;
/** Ticks between consecutive Tab presses (a plausible mashing cadence). */
const SWITCH_SPACING_TICKS = 6;
/** Full 5-teammate cycle: press -> player-2, ... -> player-1 (core-native NEXT). */
const SWITCH_COUNT = 5;
/** A CPU body this close to the ball counts as the carrier (metres). */
const CARRIER_BALL_METRES = 2.2;
/** Human commits the slide tackle no farther than this from the carrier. */
const TACKLE_COMMIT_METRES = 2.6;
/** Axis deadzone turning a chase vector into WASD-style {-1, 0, 1} moves. */
const KEYBOARD_AXIS_DEADZONE_METRES = 0.25;
/** Ball planar speed that counts as "moving" (m/s). */
const BALL_MOVING_SPEED = 0.3;
/** Ticks the human pass travels before its displacement is measured. */
const PASS_TRAVEL_TICKS = 60;
/** Minimum ball displacement the human pass must show (metres). */
const MIN_PASS_DISPLACEMENT_METRES = 1;
/** A keyboard pass direction needs this much clear lane (m; just beyond the
 * versioned receiving radius so the ball actually flies before a touch). */
const PASS_LANE_CLEARANCE_METRES = 1.4;
/** How far down the lane the clearance is checked (metres). */
const PASS_LANE_LENGTH_METRES = 12;
/** Another body this close to the ball counts as crowd around the strike. */
const PASS_CROWD_RADIUS_METRES = 2;
/** Max other bodies near the ball before a human pass would be smothered. */
const PASS_CROWD_LIMIT = 1;
/** The eight WASD directions (raw axis pairs, normalised by the core). */
const PASS_LANE_DIRECTIONS: Array<[number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
/** The pinned kickoff structure of this scenario geometry (Node artifacts). */
const ENGINE_FIRST_TOUCH_TICK = 18;
const ENGINE_KICKOFF_TAKER_ID = "player-10";

const HUMAN_SLOT = "slot-1";
const HUMAN_START_PLAYER = "player-1";

const PASS_RADIUS_METRES = FOUNDATION_PASS_V1.passRadius.value;
const TOUCH_PRESS_RANGE_METRES = FOUNDATION_CONTACT_V1.contactRadius.value;

const BIT_NAMES: Array<[number, string]> = [
  [SWITCH_PLAYER_BIT, "SWITCH_PLAYER_BIT"],
  [PASS_BIT, "PASS_BIT"],
  [SLIDE_TACKLE_BIT, "SLIDE_TACKLE_BIT"],
];

/** Static presentation-only framing, identical for every frame (as accepted). */
const CAMERA = {
  position: { x: 0, y: 48, z: 54 },
  target: { x: 0, y: 0, z: 0 },
};

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "600px";
  document.body.appendChild(container);
});

afterEach(() => {
  if (container?.parentElement) container.parentElement.removeChild(container);
});

function planarDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function round(value: number, decimals = 3): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function bitLabels(pressed: number): string[] {
  return BIT_NAMES.filter(([bit]) => (pressed & bit) !== 0).map(([, name]) => name);
}

/** Distance from a body to the nearest point of the lane segment. */
function laneDistance(
  px: number,
  py: number,
  fromX: number,
  fromY: number,
  dirX: number,
  dirY: number,
  length: number,
): number {
  const vx = dirX * length;
  const vy = dirY * length;
  const lenSq = vx * vx + vy * vy;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, ((px - fromX) * vx + (py - fromY) * vy) / lenSq)) : 0;
  return Math.hypot(px - (fromX + t * vx), py - (fromY + t * vy));
}

/**
 * Deterministic "look up before you pass": of the eight WASD directions, the
 * lane that keeps every other body farthest from the strike-to-receipt path
 * (body proximity counts both raw and projected, so a shoulder-right body
 * blocks a lane no matter where it projects). The human only plays when that
 * best lane is clear beyond the receiving radius AND the ball is not smothered
 * by the pack.
 */
function choosePassLane(
  snapshot: ReturnType<Simulation["snapshot"]>,
  striker: { playerId: string; groundPosition: { x: number; y: number } },
  ball: { position: { x: number; y: number } },
): { moveX: number; moveY: number; clearance: number } | null {
  let crowd = 0;
  for (const other of snapshot.players) {
    if (other.playerId === striker.playerId) continue;
    if (
      planarDistance(other.groundPosition.x, other.groundPosition.y, ball.position.x, ball.position.y) <=
      PASS_CROWD_RADIUS_METRES
    ) {
      crowd += 1;
    }
  }
  if (crowd > PASS_CROWD_LIMIT) return null;
  let best: { moveX: number; moveY: number; clearance: number } | null = null;
  for (const [rawX, rawY] of PASS_LANE_DIRECTIONS) {
    const mag = Math.hypot(rawX, rawY);
    const dirX = rawX / mag;
    const dirY = rawY / mag;
    let clearance = Number.POSITIVE_INFINITY;
    for (const other of snapshot.players) {
      if (other.playerId === striker.playerId) continue;
      const d = Math.min(
        laneDistance(
          other.groundPosition.x,
          other.groundPosition.y,
          ball.position.x,
          ball.position.y,
          dirX,
          dirY,
          PASS_LANE_LENGTH_METRES,
        ),
        planarDistance(
          other.groundPosition.x,
          other.groundPosition.y,
          ball.position.x,
          ball.position.y,
        ),
      );
      if (d < clearance) clearance = d;
    }
    if (!best || clearance > best.clearance) {
      best = { moveX: rawX, moveY: rawY, clearance: round(clearance) };
    }
  }
  if (!best || best.clearance < PASS_LANE_CLEARANCE_METRES) return null;
  return best;
}

/** Accepted evidence is immutable: a manifest means the objective is closed. */
async function assertEvidenceMutable(): Promise<void> {
  try {
    await commands.readFile(`docs/evidence/${OBJECTIVE_ID}/manifest.json`, "utf-8");
  } catch {
    return; // no manifest yet: durable capture for this candidate is allowed
  }
  throw new Error(
    `Accepted evidence is immutable: docs/evidence/${OBJECTIVE_ID}/manifest.json exists`,
  );
}

// ---------------------------------------------------------------------------
// Per-tick record (the browser run's own committed geometry + human input)
// ---------------------------------------------------------------------------

interface PlayerRecord {
  playerId: string;
  teamId: string;
  x: number;
  y: number;
  speed: number;
  distToBall: number;
  distToHome: number;
  /** Held at its fixed kickoff home by the anti-huddle kickoff freeze. */
  frozen: boolean;
  /** The team's single designated presser/chaser for this geometry. */
  chaser: boolean;
  /** The designated cover body screening behind the presser. */
  cover: boolean;
}

interface TeamRecord {
  chaserPlayerId: string | null;
  coverPlayerId: string | null;
  /** Signed metres the cover sits behind the presser on the ball-presser axis. */
  coverBehindPresserMetres: number | null;
  playersWithinHuddleRadius: number;
}

/** The human `InputFrame` the step that committed this tick consumed. */
interface HumanRecord {
  /** Tick stamped on the consumed frame (`InputFrame.tick`). */
  inputTick: number;
  controlledAtInput: string;
  /** Slot-1's controlled player after this commit (switch lands here). */
  controlledCommitted: string;
  moveX: number;
  moveY: number;
  sprint: number;
  heldButtons: number;
  pressedButtons: number;
  pressedBits: string[];
}

interface TickRecord {
  tick: number;
  stateHash: string;
  ball: { x: number; y: number; speed: number; regime: string; lastTouchRef: string | null };
  ballTravelledMetres: number;
  kickoffTakerId: string | null;
  human: HumanRecord;
  teams: Record<string, TeamRecord>;
  players: PlayerRecord[];
  events: SimulationEvent[];
}

// ---------------------------------------------------------------------------
// The human program - keyboard bits through the tick-indexed InputFrame path
// ---------------------------------------------------------------------------

type HumanMode = "full" | "idle";

interface HumanPolicyState {
  switchesRemaining: number;
  lastSwitchInputTick: number;
  firstTouchSeenTick: number;
  tacklePressed: boolean;
  passLanded: boolean;
}

function quantizeAxis(delta: number): number {
  if (delta > KEYBOARD_AXIS_DEADZONE_METRES) return 1;
  if (delta < -KEYBOARD_AXIS_DEADZONE_METRES) return -1;
  return 0;
}

/**
 * One tick of the slot-1 keyboard frame. Every press is gated on committed
 * geometry only (no wall clock, no randomness): Tab-cycle mid-arc, then a
 * slide tackle the moment a CPU carrier comes inside the commit range, then
 * the J pass while the ball is inside the versioned pass radius. After the
 * pass lands the human idles with no further discrete presses.
 */
function sampleHumanFrame(
  snapshot: ReturnType<Simulation["snapshot"]>,
  scenario: ScenarioDefinition,
  mode: HumanMode,
  state: HumanPolicyState,
): InputFrame {
  const controlledId = snapshot.controlAssignments[HUMAN_SLOT].controlledPlayerId;
  const controlled = snapshot.players.find((p) => p.playerId === controlledId)!;
  const ball = snapshot.ball;
  const toBallX = ball.position.x - controlled.groundPosition.x;
  const toBallY = ball.position.y - controlled.groundPosition.y;
  const distToBall = Math.hypot(toBallX, toBallY);

  let moveX = 0;
  let moveY = 0;
  let pressedButtons = 0;
  let heldButtons = 0;

  if (mode === "full" && distToBall > 0.01) {
    moveX = quantizeAxis(toBallX);
    moveY = quantizeAxis(toBallY);
  }

  if (mode === "full") {
    if (state.firstTouchSeenTick < 0 && ball.lastTouchRef !== null) {
      state.firstTouchSeenTick = snapshot.tick;
    }
    const teamAIds = new Set(
      scenario.players.filter((p) => p.teamId === controlled.teamId).map((p) => p.playerId),
    );

    if (state.switchesRemaining > 0) {
      const gateOpen =
        state.firstTouchSeenTick >= 0 &&
        snapshot.tick >= state.firstTouchSeenTick + SWITCH_DELAY_TICKS &&
        snapshot.tick >= state.lastSwitchInputTick + SWITCH_SPACING_TICKS;
      if (gateOpen) {
        pressedButtons = SWITCH_PLAYER_BIT;
        heldButtons = 0;
        state.lastSwitchInputTick = snapshot.tick;
        state.switchesRemaining -= 1;
      }
    } else if (!state.tacklePressed) {
      // Nearest opposing carrier (a body inside the carrier radius of the
      // ball) that is also inside the human's commit range.
      let target: { x: number; y: number; d: number } | null = null;
      for (const other of snapshot.players) {
        if (teamAIds.has(other.playerId)) continue;
        const otherToBall = planarDistance(
          other.groundPosition.x,
          other.groundPosition.y,
          ball.position.x,
          ball.position.y,
        );
        if (otherToBall > CARRIER_BALL_METRES) continue;
        const d = planarDistance(
          controlled.groundPosition.x,
          controlled.groundPosition.y,
          other.groundPosition.x,
          other.groundPosition.y,
        );
        if (!target || d < target.d) target = { x: other.groundPosition.x, y: other.groundPosition.y, d };
      }
      if (target && target.d <= TACKLE_COMMIT_METRES) {
        const chaseX = target.x - controlled.groundPosition.x;
        const chaseY = target.y - controlled.groundPosition.y;
        if (Math.abs(chaseX) > 0.01 || Math.abs(chaseY) > 0.01) {
          moveX = quantizeAxis(chaseX);
          moveY = quantizeAxis(chaseY);
        }
        pressedButtons = SLIDE_TACKLE_BIT;
        heldButtons = SLIDE_TACKLE_BIT;
        state.tacklePressed = true;
      }
    } else if (!state.passLanded) {
      // Press J - but only into a clear lane, the way a human looks up first.
      if (distToBall <= PASS_RADIUS_METRES) {
        const lane = choosePassLane(snapshot, controlled, ball);
        if (lane) {
          moveX = lane.moveX;
          moveY = lane.moveY;
          pressedButtons = PASS_BIT;
          heldButtons = PASS_BIT;
        }
      }
    }
  }

  return {
    tick: snapshot.tick,
    sourceId: "keyboard",
    controlSlot: HUMAN_SLOT,
    moveX,
    moveY,
    sprint: mode === "full" ? 1 : 0,
    heldButtons,
    pressedButtons,
    releasedButtons: 0,
  };
}

// ---------------------------------------------------------------------------
// Play
// ---------------------------------------------------------------------------

interface CpuSlot {
  adapter: ReturnType<typeof createCpuAdapter>;
  controlSlot: string;
  teamId: string;
  controlledPlayerId: string;
}

interface MechanismCounters {
  kickoff_freeze: number;
  nearest_only_chase: number;
  restart_freeze: number;
  cpu_tackle_commit: number;
}

interface PlayResult {
  records: TickRecord[];
  events: SimulationEvent[];
  hashes: string[];
  captured: string[];
  framePresentations: Record<string, string[]>;
  counters: MechanismCounters;
}

function cpuSlots(scenario: ScenarioDefinition): CpuSlot[] {
  return Object.entries(scenario.controlAssignments)
    .filter(([, assignment]) => assignment.mode !== "HUMAN")
    .map(([controlSlot, assignment]) => ({
      adapter: createCpuAdapter(),
      controlSlot,
      teamId: assignment.teamId,
      controlledPlayerId: assignment.controlledPlayerId ?? "",
    }));
}

/**
 * One tick of the browser composition root's CPU wiring for
 * `?mode=human-vs-ai-5v5` - the frames `main.ts` samples for every
 * non-HUMAN slot, with the accepted anti-huddle + defensive-tackle switches
 * explicit so this capture can also play the stashed control through it.
 */
function sampleCpuFrames(
  sim: Simulation,
  slots: CpuSlot[],
  cpuAntiHuddle: boolean,
): InputFrame[] {
  const snapshot = sim.snapshot();
  const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
  for (const entry of slots) {
    if (!teamDecisions.has(entry.teamId)) {
      const teamObs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
      teamObs.cpuAntiHuddle = cpuAntiHuddle;
      teamDecisions.set(entry.teamId, computeTeamDecision(teamObs, entry.teamId));
    }
  }
  return slots.map((entry) => {
    const observation = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
    observation.teamDecision = teamDecisions.get(entry.teamId);
    observation.cpuDefensiveTackle = true;
    observation.cpuAntiHuddle = cpuAntiHuddle;
    const frame = entry.adapter.sample(sim.tick, observation);
    frame.controlSlot = entry.controlSlot;
    return frame;
  });
}

/**
 * Play the 5v5 human-vs-CPU match through the browser composition root,
 * recording the committed geometry, the human keyboard frames and the event
 * stream the accepted tackle machinery emits.
 *
 * @param renderAt - tick -> frame label; the frame is rendered and written
 *   through the real Three renderer when the simulation commits that tick.
 */
async function playMatch(
  scenario: ScenarioDefinition,
  renderAt: Map<number, string>,
  render: boolean,
  cpuAntiHuddle: boolean,
  humanMode: HumanMode,
): Promise<PlayResult> {
  const bridge = createTestBridge(container, scenario, undefined, {
    ...DEFAULT_RENDERER_CONFIG,
    cameraPosition: CAMERA.position,
    cameraTarget: CAMERA.target,
  });
  await bridge.reset();
  const sim = bridge.getSimulation();
  const slots = cpuSlots(scenario);
  const teamIds = [...new Set(scenario.players.map((player) => player.teamId))].sort();
  const homes = new Map(
    scenario.players.map((player) => [player.playerId, player.groundPosition]),
  );

  resetMechanismCounters();

  const records: TickRecord[] = [];
  const events: SimulationEvent[] = [];
  const hashes: string[] = [];
  const captured: string[] = [];
  const framePresentations: Record<string, string[]> = {};
  const policy: HumanPolicyState = {
    switchesRemaining: humanMode === "full" ? SWITCH_COUNT : 0,
    lastSwitchInputTick: Number.NEGATIVE_INFINITY,
    firstTouchSeenTick: -1,
    tacklePressed: false,
    passLanded: false,
  };
  let previousBall: { x: number; y: number } | null = null;

  for (let i = 0; i < PLAY_TICKS; i++) {
    const preSnapshot = sim.snapshot();
    const humanFrame = sampleHumanFrame(preSnapshot, scenario, humanMode, policy);
    const frames = sampleCpuFrames(sim, slots, cpuAntiHuddle);
    frames.push(humanFrame);
    sim.applyInputs(frames);
    const result = sim.step();
    events.push(...result.events);
    hashes.push(result.stateHash);

    if (result.events.some(
      (event) =>
        event.kind === "pass" &&
        String(payloadOf(event).playerId ?? "") ===
          sim.snapshot().controlAssignments[HUMAN_SLOT].controlledPlayerId,
    )) {
      policy.passLanded = true;
    }

    // A record is the committed geometry the adapters read on the next tick.
    const snapshot = sim.snapshot();
    const ballUntouched = snapshot.ball.lastTouchRef === null;
    let kickoffTakerId: string | null = null;
    const teams: Record<string, TeamRecord> = {};
    const chasers = new Set<string>();
    const covers = new Set<string>();
    for (const teamId of teamIds) {
      const slot = slots.find((entry) => entry.teamId === teamId);
      const teamObs = buildCpuObservation(snapshot, teamId, slot?.controlledPlayerId);
      teamObs.cpuAntiHuddle = cpuAntiHuddle;
      const roles = assignChaseRoles(teamObs, teamId);
      if (roles.chaserPlayerId) chasers.add(roles.chaserPlayerId);
      if (roles.coverPlayerId) covers.add(roles.coverPlayerId);
      kickoffTakerId = roles.kickoffTakerId ?? kickoffTakerId;

      const presser = teamObs.players.find((player) => player.playerId === roles.chaserPlayerId);
      const cover = teamObs.players.find((player) => player.playerId === roles.coverPlayerId);
      let coverBehindPresserMetres: number | null = null;
      if (presser && cover && presser.playerId !== cover.playerId) {
        const axisX = presser.groundPosition.x - teamObs.ball.position.x;
        const axisY = presser.groundPosition.y - teamObs.ball.position.y;
        const axisLength = Math.hypot(axisX, axisY);
        if (axisLength > 0.001) {
          coverBehindPresserMetres = round(
            ((cover.groundPosition.x - presser.groundPosition.x) * axisX +
              (cover.groundPosition.y - presser.groundPosition.y) * axisY) /
              axisLength,
          );
        }
      }
      let playersWithinHuddleRadius = 0;
      for (const player of teamObs.players) {
        if (player.teamId !== teamId) continue;
        if (
          planarDistance(
            player.groundPosition.x,
            player.groundPosition.y,
            teamObs.ball.position.x,
            teamObs.ball.position.y,
          ) < HUDDLE_RADIUS_METRES
        ) {
          playersWithinHuddleRadius += 1;
        }
      }
      teams[teamId] = {
        chaserPlayerId: roles.chaserPlayerId ?? null,
        coverPlayerId: roles.coverPlayerId ?? null,
        coverBehindPresserMetres,
        playersWithinHuddleRadius,
      };
    }

    const players: PlayerRecord[] = snapshot.players.map((player) => {
      const home = homes.get(player.playerId);
      const distToBall = planarDistance(
        player.groundPosition.x,
        player.groundPosition.y,
        snapshot.ball.position.x,
        snapshot.ball.position.y,
      );
      const exemptFromFreeze =
        kickoffTakerId === player.playerId || distToBall <= TOUCH_PRESS_RANGE_METRES;
      return {
        playerId: player.playerId,
        teamId: player.teamId,
        x: round(player.groundPosition.x),
        y: round(player.groundPosition.y),
        speed: round(Math.hypot(player.linearVelocity.x, player.linearVelocity.y)),
        distToBall: round(distToBall),
        distToHome: home
          ? round(planarDistance(player.groundPosition.x, player.groundPosition.y, home.x, home.y))
          : 0,
        frozen: ballUntouched && cpuAntiHuddle && !exemptFromFreeze,
        chaser: chasers.has(player.playerId),
        cover: covers.has(player.playerId),
      };
    });

    const ballTravelledMetres = previousBall
      ? round(
          planarDistance(
            previousBall.x,
            previousBall.y,
            snapshot.ball.position.x,
            snapshot.ball.position.y,
          ),
        )
      : 0;
    previousBall = { x: snapshot.ball.position.x, y: snapshot.ball.position.y };

    records.push({
      tick: sim.tick,
      stateHash: result.stateHash,
      ball: {
        x: round(snapshot.ball.position.x),
        y: round(snapshot.ball.position.y),
        speed: round(Math.hypot(snapshot.ball.linearVelocity.x, snapshot.ball.linearVelocity.y)),
        regime: snapshot.ball.regime,
        lastTouchRef: snapshot.ball.lastTouchRef,
      },
      ballTravelledMetres,
      kickoffTakerId: ballUntouched ? kickoffTakerId : null,
      human: {
        inputTick: humanFrame.tick,
        controlledAtInput: preSnapshot.controlAssignments[HUMAN_SLOT].controlledPlayerId,
        controlledCommitted: snapshot.controlAssignments[HUMAN_SLOT].controlledPlayerId,
        moveX: humanFrame.moveX,
        moveY: humanFrame.moveY,
        sprint: humanFrame.sprint,
        heldButtons: humanFrame.heldButtons,
        pressedButtons: humanFrame.pressedButtons,
        pressedBits: bitLabels(humanFrame.pressedButtons),
      },
      teams,
      players,
      events: [...result.events],
    });

    const label = renderAt.get(sim.tick);
    if (render && label) {
      const capture = await bridge.capture();
      const base64 = capture.screenshot.split(",")[1] ?? "";
      if (!base64 || base64.length < 100) {
        throw new Error(`renderer produced no PNG bytes for ${label}`);
      }
      await commands.writeFile(`${OUTPUT_REL}/${label}.png`, base64, "base64");
      captured.push(label);
      framePresentations[label] = sim
        .presentation()
        .players.filter((player) => player.isControlled)
        .map((player) => player.playerId);
    }
  }

  for (const entry of slots) entry.adapter.reset();
  const counters: MechanismCounters = {
    kickoff_freeze: getKickoffFreezeActivations(),
    nearest_only_chase: getNearestOnlyChaseActivations(),
    restart_freeze: getRestartFreezeActivations(),
    cpu_tackle_commit: getCpuTackleCommitActivations(),
  };
  resetMechanismCounters();
  bridge.getPresentationSession().dispose();
  return { records, events, hashes, captured, framePresentations, counters };
}

// ---------------------------------------------------------------------------
// Human-arc location (from the run's own event log)
// ---------------------------------------------------------------------------

interface SwitchStep {
  /** Input frame tick stamped on the Tab press (`InputFrame.tick`). */
  inputTick: number;
  /** Committed tick whose record carries both the press and the event. */
  commitTick: number;
  fromPlayer: string;
  toPlayer: string;
}

interface HumanArc {
  firstTouchTick: number;
  kickoffTakerId: string;
  freezeBaselineTick: number;
  switches: SwitchStep[];
  tackleInputTick: number;
  tackleCommitTick: number;
  tackleCarrierId: string;
  tackleCarrierDistanceMetres: number;
  tackleBallDistanceMetres: number;
  contactTick: number;
  contactOpponentId: string;
  passInputTick: number;
  passEventTick: number;
  passPlayerId: string;
  passBallSpeedAfter: number;
  passDisplacementMetres: number;
}

function payloadOf(event: SimulationEvent): Record<string, unknown> {
  return (event.payload ?? {}) as Record<string, unknown>;
}

function recordAt(records: TickRecord[], tick: number): TickRecord | undefined {
  return records.find((record) => record.tick === tick);
}

function bodiesAtHome(record: TickRecord): number {
  return record.players.filter((player) => player.distToHome <= HOME_TOLERANCE_METRES).length;
}

function hasPressAndCoverStructure(record: TickRecord): boolean {
  return Object.values(record.teams).every(
    (team) =>
      team.chaserPlayerId !== null &&
      team.coverPlayerId !== null &&
      team.chaserPlayerId !== team.coverPlayerId,
  );
}

/**
 * Locate the human-interaction arc in a recorded browser run, or return null
 * when the run never shows it - which is what the idling-human and the
 * stashed-anti-huddle controls must produce.
 */
function locateHumanArc(records: TickRecord[]): HumanArc | null {
  const dbg = (why: string): null => {
    console.log(`[human-arc-locate] null: ${why}`);
    return null;
  };
  const firstTouch = records.find(
    (record) => record.ball.lastTouchRef !== null && record.tick >= FREEZE_LEAD_TICKS + 1,
  );
  if (!firstTouch) return dbg("no first touch");
  const freezeBaseline = recordAt(records, firstTouch.tick - FREEZE_LEAD_TICKS);
  if (
    !freezeBaseline ||
    freezeBaseline.ball.lastTouchRef !== null ||
    bodiesAtHome(freezeBaseline) < BODIES_AT_HOME_BEFORE_TOUCH
  ) {
    return dbg("freeze baseline failed");
  }
  const kickoffTakerId = records.find((record) => record.kickoffTakerId !== null)?.kickoffTakerId;
  if (!kickoffTakerId || !hasPressAndCoverStructure(firstTouch)) {
    return dbg(`taker=${kickoffTakerId} pressCover=${hasPressAndCoverStructure(firstTouch)}`);
  }

  // The mid-arc Tab cycle: SWITCH presses whose commit carries the
  // slot-switch event, chaining player-1 -> ... -> player-1.
  const switches: SwitchStep[] = [];
  for (const record of records) {
    if (record.tick <= firstTouch.tick) continue;
    if (!record.human.pressedBits.includes("SWITCH_PLAYER_BIT")) continue;
    const switchEvent = record.events.find(
      (event) =>
        event.kind === "slot-switch" &&
        String(payloadOf(event).controlSlot ?? "") === HUMAN_SLOT,
    );
    if (!switchEvent) continue;
    switches.push({
      inputTick: record.human.inputTick,
      commitTick: record.tick,
      fromPlayer: String(payloadOf(switchEvent).fromPlayer ?? ""),
      toPlayer: String(payloadOf(switchEvent).toPlayer ?? ""),
    });
  }
  if (switches.length !== SWITCH_COUNT) return dbg(`switches=${switches.length}`);
  let expectFrom = HUMAN_START_PLAYER;
  for (const step of switches) {
    if (step.fromPlayer !== expectFrom) return dbg(`switch chain broken at ${step.fromPlayer}`);
    expectFrom = step.toPlayer;
  }
  if (expectFrom !== HUMAN_START_PLAYER) return dbg(`switch chain ends at ${expectFrom}`);
  const lastSwitch = switches[switches.length - 1]!;

  // The slide-tackle commit on a CPU carrier.
  let tackle: TickRecord | null = null;
  for (const record of records) {
    if (record.tick <= lastSwitch.commitTick) continue;
    if (record.human.pressedBits.includes("SLIDE_TACKLE_BIT")) {
      if (
        record.events.some(
          (event) =>
            event.kind === "tackle-phase" &&
            String(payloadOf(event).playerId ?? "") === record.human.controlledAtInput &&
            String(payloadOf(event).phase ?? "") === "prepare" &&
            String(payloadOf(event).tackleKind ?? "") === "slide",
        )
      ) {
        tackle = record;
      }
      break;
    }
  }
  if (!tackle) return dbg("no slide-tackle press with prepare event");
  const tacklerId = tackle.human.controlledAtInput;
  // The commit range was evaluated on the geometry the pressed frame saw.
  const previous = recordAt(records, tackle.tick - 1);
  if (!previous) return dbg("no previous record for tackle");
  const tacklerPrev = previous.players.find((player) => player.playerId === tacklerId);
  let carrierRecord: PlayerRecord | null = null;
  for (const player of previous.players) {
    if (player.teamId === tacklerPrev?.teamId) continue;
    if (!tacklerPrev) continue;
    if (player.distToBall > CARRIER_BALL_METRES) continue;
    const d = planarDistance(tacklerPrev.x, tacklerPrev.y, player.x, player.y);
    if (d > TACKLE_COMMIT_METRES) continue;
    if (!carrierRecord || d < planarDistance(tacklerPrev.x, tacklerPrev.y, carrierRecord.x, carrierRecord.y)) {
      carrierRecord = player;
    }
  }
  if (!carrierRecord || !tacklerPrev) return dbg("no carrier in commit range at tackle input");

  // The duel result inside the accepted active window.
  let contact: TickRecord | null = null;
  let contactDuel: SimulationEvent | null = null;
  for (const record of records) {
    if (record.tick <= tackle.tick) continue;
    const duel = record.events.find(
      (event) =>
        event.kind === "player-player-contact" &&
        String(payloadOf(event).playerIdA ?? "") === tacklerId &&
        String(payloadOf(event).contactType ?? "") === "slide-tackle",
    );
    if (!duel) continue;
    const won = Boolean(payloadOf(duel).duelWon) && Boolean(payloadOf(duel).ballReachable);
    const ballTouch = record.events.some(
      (event) =>
        event.kind === "player-ball-contact" &&
        String(payloadOf(event).playerId ?? "") === tacklerId &&
        String(payloadOf(event).contactType ?? "") === "slide-tackle",
    );
    if (!won || !ballTouch) continue;
    contact = record;
    contactDuel = duel;
    break;
  }
  if (!contact || !contactDuel) return dbg("no won slide-tackle duel contact");

  // The human pass after the arc opened: PASS press + pass event at the same
  // commit, by the human-controlled player.
  let pass: TickRecord | null = null;
  for (const record of records) {
    if (record.tick <= contact.tick) continue;
    if (!record.human.pressedBits.includes("PASS_BIT")) continue;
    const passEvent = record.events.find(
      (event) =>
        event.kind === "pass" &&
        String(payloadOf(event).playerId ?? "") === record.human.controlledAtInput,
    );
    if (passEvent) {
      pass = record;
      break;
    }
  }
  if (!pass) return dbg("no PASS press with same-commit pass event");
  const after = recordAt(records, pass.tick + PASS_TRAVEL_TICKS);
  if (!after) return dbg("pass too late in the window");
  const displacement = round(planarDistance(pass.ball.x, pass.ball.y, after.ball.x, after.ball.y), 2);
  if (displacement < MIN_PASS_DISPLACEMENT_METRES) return dbg(`pass displacement ${displacement}m too small`);

  return {
    firstTouchTick: firstTouch.tick,
    kickoffTakerId,
    freezeBaselineTick: freezeBaseline.tick,
    switches,
    tackleInputTick: tackle.human.inputTick,
    tackleCommitTick: tackle.tick,
    tackleCarrierId: carrierRecord.playerId,
    tackleCarrierDistanceMetres: round(
      planarDistance(tacklerPrev.x, tacklerPrev.y, carrierRecord.x, carrierRecord.y),
      2,
    ),
    tackleBallDistanceMetres: carrierRecord.distToBall,
    contactTick: contact.tick,
    contactOpponentId: String(payloadOf(contactDuel).playerIdB ?? ""),
    passInputTick: pass.human.inputTick,
    passEventTick: pass.tick,
    passPlayerId: pass.human.controlledAtInput,
    passBallSpeedAfter: pass.ball.speed,
    passDisplacementMetres: displacement,
  };
}

// ---------------------------------------------------------------------------
// Frame plan
// ---------------------------------------------------------------------------

interface FramePlan {
  label: string;
  tick: number;
  semantic: string;
  description: string;
  binding: Record<string, unknown> | null;
}

function framePlan(arc: HumanArc): FramePlan[] {
  const first = arc.switches[0]!;
  const last = arc.switches[arc.switches.length - 1]!;
  return [
    {
      label: "arc-open",
      tick: arc.firstTouchTick,
      semantic: "arc",
      description: `Anti-huddle arc opens: the kickoff freeze holds ${BODIES_AT_HOME_BEFORE_TOUCH} bodies at home through tick ${arc.freezeBaselineTick}; ${arc.kickoffTakerId}'s first touch at this tick releases it, the ball moves, and every team shows exactly one designated presser + cover`,
      binding: null,
    },
    {
      label: "tab-switch",
      tick: first.commitTick,
      semantic: "human-switch",
      description: `Human Tab press mid-arc (input tick ${first.inputTick}): slot-switch ${first.fromPlayer} -> ${first.toPlayer}; the cycle completes at tick ${last.commitTick} and control lands back on ${HUMAN_START_PLAYER}`,
      binding: {
        kind: "human-input",
        source_id: "keyboard",
        control_slot: HUMAN_SLOT,
        input_tick: first.inputTick,
        pressed_bits: ["SWITCH_PLAYER_BIT"],
        event: { tick: first.commitTick, kind: "slot-switch", from: first.fromPlayer, to: first.toPlayer },
      },
    },
    {
      label: "tackle-commit",
      tick: arc.tackleCommitTick,
      semantic: "human-tackle-input",
      description: `Human slide-tackle press (input tick ${arc.tackleInputTick}, the I key): the CPU carrier ${arc.tackleCarrierId} sits ${arc.tackleCarrierDistanceMetres} m away with the ball ${arc.tackleBallDistanceMetres} m off it; the accepted phase machine enters prepare at this commit`,
      binding: {
        kind: "human-input",
        source_id: "keyboard",
        control_slot: HUMAN_SLOT,
        input_tick: arc.tackleInputTick,
        pressed_bits: ["SLIDE_TACKLE_BIT"],
        event: { tick: arc.tackleCommitTick, kind: "tackle-phase", phase: "prepare", tackle_kind: "slide" },
      },
    },
    {
      label: "tackle-result",
      tick: arc.contactTick,
      semantic: "tackle-result",
      description: `Tackle result inside the accepted active window: the human slide-tackle contacts CPU carrier ${arc.contactOpponentId} (player-player duel won, finite-reach ball touch, velocity-only deflection)`,
      binding: {
        kind: "tackle-outcome",
        caused_by_input_tick: arc.tackleInputTick,
        events: [
          { tick: arc.contactTick, kind: "player-player-contact", contact_type: "slide-tackle", duel_won: true },
          { tick: arc.contactTick, kind: "player-ball-contact", contact_type: "slide-tackle" },
        ],
      },
    },
    {
      label: "human-pass",
      tick: arc.passEventTick,
      semantic: "human-pass",
      description: `Human pass (input tick ${arc.passInputTick}, the J key): ${arc.passPlayerId} strikes the ball after winning the duel; by ${arc.passEventTick + PASS_TRAVEL_TICKS} it has travelled ${arc.passDisplacementMetres} m`,
      binding: {
        kind: "human-input",
        source_id: "keyboard",
        control_slot: HUMAN_SLOT,
        input_tick: arc.passInputTick,
        pressed_bits: ["PASS_BIT"],
        event: { tick: arc.passEventTick, kind: "pass", player_id: arc.passPlayerId },
      },
    },
  ];
}

async function sha256OfFile(rootRelativePath: string): Promise<string> {
  const base64 = await commands.readFile(rootRelativePath, "base64");
  const binary = atob(base64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256OfText(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Compact per-tick encoding (layout declared once, like the accepted capture)
// ---------------------------------------------------------------------------

const TICK_FIELDS = [
  "tick",
  "stateHash",
  "ball.x",
  "ball.y",
  "ball.speed",
  "ball.travelledMetres",
  "ball.regime",
  "ball.lastTouchRef",
  "kickoffTakerId",
  "human",
  "events",
  "teams",
  "players",
] as const;

const HUMAN_TICK_FIELDS = [
  "inputTick",
  "controlledAtInput",
  "controlledCommitted",
  "moveX",
  "moveY",
  "sprint",
  "heldButtons",
  "pressedButtons",
  "pressedBits",
] as const;

const TEAM_FIELDS = [
  "chaserPlayerId",
  "coverPlayerId",
  "coverBehindPresserMetres",
  "playersWithinHuddleRadius",
] as const;

const PLAYER_FIELDS = ["playerId", "teamId", "x", "y", "speed", "distToBall", "distToHome", "flags"] as const;

const PLAYER_FLAGS: Array<[keyof PlayerRecord, string]> = [
  ["frozen", "f"],
  ["chaser", "c"],
  ["cover", "o"],
];

function encodePlayer(player: PlayerRecord): unknown[] {
  const flags = PLAYER_FLAGS.filter(([field]) => player[field] === true)
    .map(([, letter]) => letter)
    .join("");
  return [
    player.playerId,
    player.teamId,
    player.x,
    player.y,
    player.speed,
    player.distToBall,
    player.distToHome,
    flags,
  ];
}

function encodeHuman(human: HumanRecord): unknown[] {
  return [
    human.inputTick,
    human.controlledAtInput,
    human.controlledCommitted,
    human.moveX,
    human.moveY,
    human.sprint,
    human.heldButtons,
    human.pressedButtons,
    human.pressedBits.join("+"),
  ];
}

function encodeTick(record: TickRecord, teamOrder: string[]): unknown[] {
  return [
    record.tick,
    record.stateHash,
    record.ball.x,
    record.ball.y,
    record.ball.speed,
    record.ballTravelledMetres,
    record.ball.regime,
    record.ball.lastTouchRef,
    record.kickoffTakerId,
    encodeHuman(record.human),
    record.events.map((event) => {
      const payload = payloadOf(event);
      return {
        kind: event.kind,
        playerId: String(payload.playerId ?? payload.playerIdA ?? ""),
        teamId: String(payload.teamId ?? payload.teamIdA ?? ""),
      };
    }),
    teamOrder.map((teamId) => {
      const team = record.teams[teamId];
      return [
        team.chaserPlayerId,
        team.coverPlayerId,
        team.coverBehindPresserMetres,
        team.playersWithinHuddleRadius,
      ];
    }),
    record.players.map(encodePlayer),
  ];
}

function compactEvent(event: SimulationEvent): Record<string, unknown> {
  const payload = payloadOf(event);
  const row: Record<string, unknown> = {
    tick: event.tick,
    kind: event.kind,
    playerId: String(payload.playerId ?? payload.playerIdA ?? ""),
    teamId: String(payload.teamId ?? payload.teamIdA ?? ""),
  };
  for (const key of ["phase", "tackleKind", "contactType", "duelWon", "ballReachable", "fromPlayer", "toPlayer", "controlSlot"] as const) {
    if (payload[key] !== undefined) row[key] = payload[key];
  }
  return row;
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

describe("HUMAN-VS-CPU-ARC-INTERACTION: browser human-vs-CPU arc frames", () => {
  it(
    "captures 5 event-centered frames of the human arc interactions with input-tick bindings",
    async () => {
      if (DURABLE_EVIDENCE) await assertEvidenceMutable();

      // The scenario is the browser app's own human-vs-ai-5v5 match.
      const assignments = SCENARIO.controlAssignments;
      expect(Object.keys(assignments).length).toBe(10);
      expect(assignments[HUMAN_SLOT].mode).toBe("HUMAN");
      expect(assignments[HUMAN_SLOT].teamId).toBe("team-a");
      expect(assignments[HUMAN_SLOT].controlledPlayerId).toBe(HUMAN_START_PLAYER);
      expect(SCENARIO.players.length).toBe(10);

      // Pass 1 - locate the human arc's event ticks (no rendering).
      const first = await playMatch(SCENARIO, new Map(), false, true, "full");
      const arc = locateHumanArc(first.records);
      expect(arc, "the browser 5v5 human-vs-CPU match never produced the human arc").not.toBeNull();
      const plan = framePlan(arc!);
      const ticks = plan.map((frame) => frame.tick);
      expect(new Set(ticks).size, "frame ticks must be distinct").toBe(plan.length);
      for (const [index, tick] of ticks.entries()) {
        expect(tick, `frame ${index + 1} inside the play window`).toBeGreaterThanOrEqual(1);
        expect(tick, `frame ${index + 1} inside the play window`).toBeLessThan(PLAY_TICKS);
        if (index > 0) expect(tick, "frames in event order").toBeGreaterThan(ticks[index - 1]);
      }
      console.log(
        `[human-arc-capture] frames ${ticks.join("/")} switches=${arc!.switches.length}` +
          ` tackle=${arc!.tackleInputTick}->${arc!.contactTick} pass=${arc!.passEventTick}` +
          ` disp=${arc!.passDisplacementMetres}m (durable=${DURABLE_EVIDENCE})`,
      );

      // Pass 2 - replay the same wiring and render the five frames.
      const renderAt = new Map(plan.map((frame) => [frame.tick, frame.label]));
      const second = await playMatch(SCENARIO, renderAt, true, true, "full");
      expect(second.captured).toEqual(plan.map((frame) => frame.label));
      expect(second.hashes, "the browser replay lost the run").toEqual(first.hashes);
      expect(locateHumanArc(second.records)).toEqual(arc);
      expect(second.counters).toEqual(first.counters);

      // The accepted anti-huddle adapter actually ran inside Chromium.
      expect(first.counters.kickoff_freeze).toBeGreaterThan(0);
      expect(first.counters.nearest_only_chase).toBeGreaterThan(0);

      // Semantic invariants at the captured ticks (the browser-visible binding).
      const arcOpen = recordAt(second.records, arc!.firstTouchTick)!;
      const freeze = recordAt(second.records, arc!.freezeBaselineTick)!;
      expect(arcOpen.ball.lastTouchRef, "the arc opens on a real first touch").not.toBeNull();
      expect(arcOpen.ball.speed, "the struck kickoff ball moves").toBeGreaterThan(BALL_MOVING_SPEED);
      expect(
        arc!.firstTouchTick,
        "the browser kickoff first touch must match the pinned Node read",
      ).toBe(ENGINE_FIRST_TOUCH_TICK);
      expect(arc!.kickoffTakerId).toBe(ENGINE_KICKOFF_TAKER_ID);
      expect(freeze.ball.lastTouchRef).toBeNull();
      expect(
        bodiesAtHome(freeze),
        "the accepted kickoff freeze must hold the homes before the touch",
      ).toBeGreaterThanOrEqual(BODIES_AT_HOME_BEFORE_TOUCH);
      expect(hasPressAndCoverStructure(arcOpen), "arc opens with one presser + cover per team").toBe(
        true,
      );

      const switchSteps = arc!.switches;
      for (const step of switchSteps) {
        const record = recordAt(second.records, step.commitTick)!;
        expect(record.human.pressedBits).toContain("SWITCH_PLAYER_BIT");
        expect(record.human.inputTick).toBe(step.inputTick);
        expect(record.human.controlledAtInput).toBe(step.fromPlayer);
        expect(record.human.controlledCommitted).toBe(step.toPlayer);
        expect(record.events.some((event) => event.kind === "slot-switch")).toBe(true);
      }
      const lastSwitch = switchSteps[switchSteps.length - 1]!;
      expect(
        recordAt(second.records, lastSwitch.commitTick + 1)!.human.controlledCommitted,
        "the Tab cycle returns slot-1 control to player-1",
      ).toBe(HUMAN_START_PLAYER);
      expect(second.framePresentations["tab-switch"]).toEqual([switchSteps[0]!.toPlayer]);

      const tackleRecord = recordAt(second.records, arc!.tackleCommitTick)!;
      expect(tackleRecord.human.pressedBits).toContain("SLIDE_TACKLE_BIT");
      expect(tackleRecord.human.inputTick).toBe(arc!.tackleInputTick);
      const prepare = tackleRecord.events.find(
        (event) =>
          event.kind === "tackle-phase" &&
          String(payloadOf(event).phase) === "prepare" &&
          String(payloadOf(event).tackleKind) === "slide",
      );
      expect(prepare, "the pressed I bit starts the accepted phase machine").toBeDefined();
      expect(String(payloadOf(prepare!).playerId)).toBe(tackleRecord.human.controlledAtInput);
      expect(tackleRecord.human.controlledAtInput).toBe(HUMAN_START_PLAYER);
      expect(arc!.tackleCarrierDistanceMetres).toBeLessThanOrEqual(TACKLE_COMMIT_METRES);

      const contactRecord = recordAt(second.records, arc!.contactTick)!;
      const duel = contactRecord.events.find(
        (event) =>
          event.kind === "player-player-contact" &&
          String(payloadOf(event).contactType) === "slide-tackle",
      );
      expect(duel, "the slide tackle lands inside the accepted active window").toBeDefined();
      expect(Boolean(payloadOf(duel!).duelWon)).toBe(true);
      expect(Boolean(payloadOf(duel!).ballReachable)).toBe(true);
      expect(String(payloadOf(duel!).playerIdA)).toBe(HUMAN_START_PLAYER);
      expect(String(payloadOf(duel!).playerIdB)).toBe(arc!.contactOpponentId);
      const ballTeamBIds = new Set(
        SCENARIO.players.filter((p) => p.teamId === "team-b").map((p) => p.playerId),
      );
      expect(ballTeamBIds.has(arc!.contactOpponentId), "the contacted carrier is a CPU body").toBe(
        true,
      );
      expect(contactRecord.ball.lastTouchRef, "the tackle touch owns the ball now").toContain(
        "tackle-ball-contact",
      );

      const passRecord = recordAt(second.records, arc!.passEventTick)!;
      expect(passRecord.human.pressedBits).toContain("PASS_BIT");
      expect(passRecord.human.inputTick).toBe(arc!.passInputTick);
      expect(passRecord.human.controlledAtInput).toBe(HUMAN_START_PLAYER);
      const passEvent = passRecord.events.find(
        (event) =>
          event.kind === "pass" && String(payloadOf(event).playerId) === HUMAN_START_PLAYER,
      );
      expect(passEvent, "the pressed J bit produces the human pass at this commit").toBeDefined();
      expect(passRecord.ball.speed, "the ball leaves the striker's feet").toBeGreaterThan(
        BALL_MOVING_SPEED,
      );
      const afterPass = recordAt(second.records, arc!.passEventTick + PASS_TRAVEL_TICKS)!;
      expect(
        planarDistance(passRecord.ball.x, passRecord.ball.y, afterPass.ball.x, afterPass.ball.y),
        "the human pass must show real ball displacement",
      ).toBeGreaterThanOrEqual(MIN_PASS_DISPLACEMENT_METRES);
      expect(arc!.passDisplacementMetres).toBeGreaterThanOrEqual(MIN_PASS_DISPLACEMENT_METRES);

      // Pass 3 - the same wiring with the human idling: the CPU arc still
      // opens, but none of the named human interactions can be located.
      const idle = await playMatch(SCENARIO, new Map(), false, true, "idle");
      expect(locateHumanArc(idle.records), "no human interaction without human inputs").toBeNull();
      expect(
        idle.records.some((record) => record.human.pressedButtons !== 0),
        "the idling human frame carries no press edges",
      ).toBe(false);
      expect(
        idle.events.some(
          (event) => event.kind === "slot-switch" && payloadOf(event).controlSlot === HUMAN_SLOT,
        ),
      ).toBe(false);
      expect(
        idle.events.some(
          (event) =>
            event.kind === "tackle-phase" &&
            String(payloadOf(event).playerId ?? "") === HUMAN_START_PLAYER,
        ),
        "player-1 tackles only when the human presses",
      ).toBe(false);
      expect(
        idle.events.some(
          (event) => event.kind === "pass" && String(payloadOf(event).playerId ?? "") === HUMAN_START_PLAYER,
        ),
        "player-1 passes only when the human presses",
      ).toBe(false);
      expect(idle.counters.kickoff_freeze, "the CPU arc still opened").toBeGreaterThan(0);

      // Pass 3b - the full human program with the anti-huddle stashed: the
      // kickoff is never touched, so the arc never opens and every
      // geometry-gated press stays armed.
      const stashed = await playMatch(SCENARIO, new Map(), false, false, "full");
      expect(locateHumanArc(stashed.records), "the stashed shape must not produce the arc").toBeNull();
      expect(
        stashed.records.some((record) => record.ball.lastTouchRef !== null),
        "the stashed kickoff must not touch the ball",
      ).toBe(false);
      expect(stashed.records.some((record) => record.human.pressedButtons !== 0)).toBe(false);
      expect(stashed.counters.kickoff_freeze).toBe(0);
      expect(stashed.counters.nearest_only_chase).toBe(0);

      // Pass 4 - hash the PNGs, then write sequence.json + trajectory.json.
      const pngHashes: string[] = [];
      for (const frame of plan) {
        pngHashes.push(await sha256OfFile(`${OUTPUT_REL}/${frame.label}.png`));
      }
      expect(new Set(pngHashes).size, "the five frames must be distinct images").toBe(plan.length);

      const teamOrder = [...new Set(SCENARIO.players.map((player) => player.teamId))].sort();
      const playerOrder = second.records[0]!.players.map((player) => player.playerId);
      const stateHashOfHashes = await sha256OfText(second.hashes.join("\n"));

      const humanInputs = second.records
        .filter((record) => record.human.pressedBits.length > 0)
        .map((record) => ({
          input_tick: record.human.inputTick,
          commit_tick: record.tick,
          control_slot: HUMAN_SLOT,
          source_id: "keyboard",
          controlled_at_input: record.human.controlledAtInput,
          controlled_committed: record.human.controlledCommitted,
          pressed_buttons: record.human.pressedButtons,
          pressed_bits: record.human.pressedBits,
          move: [record.human.moveX, record.human.moveY],
          sprint: record.human.sprint,
          events_at_commit: record.events.map(compactEvent),
        }));
      const wiringViolations = second.events.filter((event) => event.kind === "slot-wiring-violation");

      const sequence = {
        schema_version: 1,
        objective_id: OBJECTIVE_ID,
        evidence_class: "DYNAMIC_VISUAL",
        semantic_order:
          "arc opens (CPU kickoff touch) -> human Tab switch mid-arc -> human slide-tackle commit on the CPU carrier -> tackle result (duel won) -> human pass",
        durable_capture: DURABLE_EVIDENCE,
        scenario: { id: SCENARIO.id, path: SCENARIO_PATH, browser_mode: "human-vs-ai-5v5" },
        input_contract: {
          source_id: "keyboard",
          control_slot: HUMAN_SLOT,
          convention:
            "an InputFrame stamped at tick T is resolved by the step that commits tick T+1; the record at T+1 carries both the consumed press and the events it caused - the same binding convention the accepted HUMAN-DEFENSIVE-DUEL-CONTROL trajectory pins (attempt tick 43 -> phase event tick 44)",
        },
        arc: {
          first_touch_tick: arc!.firstTouchTick,
          kickoff_taker_id: arc!.kickoffTakerId,
          freeze_baseline_tick: arc!.freezeBaselineTick,
          switches: arc!.switches,
          tackle_input_tick: arc!.tackleInputTick,
          tackle_commit_tick: arc!.tackleCommitTick,
          tackle_carrier_id: arc!.tackleCarrierId,
          contact_tick: arc!.contactTick,
          contact_opponent_id: arc!.contactOpponentId,
          pass_input_tick: arc!.passInputTick,
          pass_event_tick: arc!.passEventTick,
          pass_player_id: arc!.passPlayerId,
          pass_ball_displacement_metres: arc!.passDisplacementMetres,
        },
        reproduction: {
          capture_test: "tests/browser/human-arc-interaction.browser.test.ts",
          wiring:
            "src/apps/browser/main.ts per-slot CPU composition root with CpuObservation.cpuAntiHuddle + cpuDefensiveTackle, slot-1 keyboard InputFrames",
          scenario_path: SCENARIO_PATH,
          play_ticks: PLAY_TICKS,
          browser_trajectory: TRAJECTORY_REL,
        },
        cross_runtime_note:
          "Ticks and per-tick hashes are this Chromium run's own; the human-program event ticks are located from this run, never transcribed. The kickoff structure matches the pinned Node artifacts for the same scenario geometry (docs/evidence/5V5-KICKOFF-ANTI-HUDDLE). Per-tick floats are not compared across runtimes (known pinned-runtime gap).",
        frames: plan.map((frame, index) => ({
          index: index + 1,
          label: frame.label,
          tick: frame.tick,
          semantic: frame.semantic,
          description: frame.description,
          path: `${frame.label}.png`,
          sha256: pngHashes[index],
          binding: frame.binding,
        })),
      };
      await commands.writeFile(SEQUENCE_REL, `${JSON.stringify(sequence, null, 2)}\n`);

      const trajectory = {
        schema_version: 1,
        objective_id: OBJECTIVE_ID,
        evidence_class: "DYNAMIC_VISUAL",
        durable_capture: DURABLE_EVIDENCE,
        produced_by: "tests/browser/human-arc-interaction.browser.test.ts",
        runtime: "Chromium (vitest --project browser) through src/apps/browser/test-bridge.ts",
        driver:
          "browser composition-root CPU wiring (main.ts per-slot CpuAdapter + computeTeamDecision) under the accepted anti-huddle + defensive-tackle switches, with slot-1 human keyboard InputFrames; chase/cover designation recorded through the same exported production function the adapters act on (assignChaseRoles)",
        scenario: {
          id: SCENARIO.id,
          path: SCENARIO_PATH,
          browser_mode: "human-vs-ai-5v5",
          players: SCENARIO.players.length,
          control_slots: Object.keys(SCENARIO.controlAssignments).length,
          human_slot: {
            control_slot: HUMAN_SLOT,
            controlled_player_id: HUMAN_START_PLAYER,
            team_id: SCENARIO.controlAssignments[HUMAN_SLOT].teamId,
          },
          pitch: { length: SCENARIO.pitchLength, width: SCENARIO.pitchWidth },
          kickoff_ball: SCENARIO.ball.position,
        },
        activation: {
          fields: ["CpuObservation.cpuAntiHuddle", "CpuObservation.cpuDefensiveTackle"],
          live_value: true,
          kill_switch: "cpuAntiHuddle: false (see stashed_control)",
        },
        human_program: {
          description:
            "deterministic keyboard policy: steer with WASD-style {-1,0,1} axes toward the ball; mid-arc press Tab SWITCH_COUNT times spaced SWITCH_SPACING_TICKS apart (control cycles back to player-1); press I SLIDE_TACKLE_BIT once the nearest CPU carrier is inside the commit range; press J PASS_BIT when the ball is inside the versioned pass radius, the pack has cleared off it (at most PASS_CROWD_LIMIT other bodies within PASS_CROWD_RADIUS_METRES) and the clearest of the eight WASD lanes is open past PASS_LANE_CLEARANCE_METRES - the pass direction is that lane's axis pair, exactly as a keyboard hold would send it",
          discrete_bits: ["SWITCH_PLAYER_BIT", "SLIDE_TACKLE_BIT", "PASS_BIT"],
          parameters: {
            switch_delay_ticks: SWITCH_DELAY_TICKS,
            switch_spacing_ticks: SWITCH_SPACING_TICKS,
            switch_count: SWITCH_COUNT,
            carrier_ball_radius_metres: CARRIER_BALL_METRES,
            tackle_commit_metres: TACKLE_COMMIT_METRES,
            pass_press_metres: PASS_RADIUS_METRES,
            pass_lane_clearance_metres: PASS_LANE_CLEARANCE_METRES,
            pass_lane_length_metres: PASS_LANE_LENGTH_METRES,
            pass_crowd_radius_metres: PASS_CROWD_RADIUS_METRES,
            pass_crowd_limit: PASS_CROWD_LIMIT,
            keyboard_axis_deadzone_metres: KEYBOARD_AXIS_DEADZONE_METRES,
            pass_travel_ticks: PASS_TRAVEL_TICKS,
            note: "evidence measurement/policy thresholds only - no simulation constant and no PES value",
          },
          inputs: humanInputs,
        },
        thresholds: {
          all_values_provisional_measurement_only: true,
          home_tolerance_metres: HOME_TOLERANCE_METRES,
          huddle_radius_metres: HUDDLE_RADIUS_METRES,
          freeze_lead_ticks: FREEZE_LEAD_TICKS,
          bodies_at_home_before_touch: BODIES_AT_HOME_BEFORE_TOUCH,
          ball_moving_speed_metres_per_second: BALL_MOVING_SPEED,
          min_pass_displacement_metres: MIN_PASS_DISPLACEMENT_METRES,
          note: "evidence measurement thresholds only - no simulation constant and no PES value",
        },
        arc: {
          first_touch_tick: arc!.firstTouchTick,
          kickoff_taker_id: arc!.kickoffTakerId,
          freeze_baseline_tick: arc!.freezeBaselineTick,
          switch_ticks: arc!.switches.map((step) => [step.inputTick, step.commitTick]),
          switch_chain: arc!.switches.map((step) => `${step.fromPlayer}->${step.toPlayer}`),
          tackle_input_tick: arc!.tackleInputTick,
          tackle_commit_tick: arc!.tackleCommitTick,
          tackle_carrier_id: arc!.tackleCarrierId,
          tackle_carrier_distance_metres: arc!.tackleCarrierDistanceMetres,
          tackle_ball_distance_metres: arc!.tackleBallDistanceMetres,
          contact_tick: arc!.contactTick,
          contact_opponent_id: arc!.contactOpponentId,
          duel_won: true,
          pass_input_tick: arc!.passInputTick,
          pass_event_tick: arc!.passEventTick,
          pass_player_id: arc!.passPlayerId,
          pass_ball_speed_after: arc!.passBallSpeedAfter,
          pass_displacement_metres: arc!.passDisplacementMetres,
        },
        frames: plan.map((frame, index) => ({
          index: index + 1,
          label: frame.label,
          tick: frame.tick,
          semantic: frame.semantic,
          png_sha256: pngHashes[index],
        })),
        presentation: {
          note:
            "static presentation-only framing, identical for every frame so the sequence stays comparable; the renderer never writes simulation state",
          camera: CAMERA,
          container: { width: 800, height: 600 },
        },
        event_log: {
          slot_switch_events: second.events.filter((event) => event.kind === "slot-switch").map(compactEvent),
          tackle_phase_events: second.events
            .filter(
              (event) =>
                event.kind === "tackle-phase" &&
                String(payloadOf(event).playerId ?? "") === HUMAN_START_PLAYER,
            )
            .map(compactEvent),
          tackle_contact_events: second.events
            .filter(
              (event) =>
                event.kind === "player-player-contact" &&
                String(payloadOf(event).contactType ?? "").endsWith("tackle") &&
                String(payloadOf(event).playerIdA ?? "") === HUMAN_START_PLAYER,
            )
            .map(compactEvent),
          human_pass_events: second.events
            .filter(
              (event) =>
                event.kind === "pass" &&
                String(payloadOf(event).playerId ?? "") === HUMAN_START_PLAYER,
            )
            .map(compactEvent),
        },
        disclosures: {
          slot_wiring_violation_events: wiringViolations.length,
          slot_wiring_note:
            "the accepted core-native Tab switch moves slot-1 onto players the AI_FALLBACK slots keep assigned (main.ts behaviour); while slot-1 controls one of them the core records a diagnostic slot-wiring-violation event per resolved tick and the human slot wins movement/switching for that body. The discrete tackle/pass presses here are deliberately taken only after the cycle lands back on player-1, the one body no CPU slot controls.",
          cpu_defensive_tackle_commit_activations: first.counters.cpu_tackle_commit,
        },
        mechanism_counters: {
          note: "module counters of the accepted adapter, reset around each recorded pass",
          anti_huddle_run: first.counters,
          replay_run: second.counters,
          idling_human_run: idle.counters,
          stashed_control_run: stashed.counters,
        },
        tick_fields: TICK_FIELDS,
        human_fields: HUMAN_TICK_FIELDS,
        team_fields: TEAM_FIELDS,
        player_fields: PLAYER_FIELDS,
        player_flag_legend: {
          f: "kickoffFrozen - held at its fixed kickoff home this tick",
          c: "designatedChaser - the team's single designated presser/chaser",
          o: "designatedCover - the body screening behind the presser",
        },
        team_order: teamOrder,
        player_order: playerOrder,
        kickoff_homes: Object.fromEntries(
          SCENARIO.players.map((player) => [
            player.playerId,
            { x: player.groundPosition.x, y: player.groundPosition.y },
          ]),
        ),
        ticks: second.records.length,
        simulated_seconds: round(second.records.length / 60, 2),
        per_tick: second.records.map((record) => encodeTick(record, teamOrder)),
        ball_travel_metres: round(
          second.records.reduce((total, record) => total + record.ballTravelledMetres, 0),
          2,
        ),
        determinism: {
          state_hash_of_hashes: stateHashOfHashes,
          final_state_hash: second.hashes[second.hashes.length - 1] ?? "",
          replay_identical: true,
          replay_note:
            "pass 1 and pass 2 are independent Chromium runs of the same wiring; their per-tick hash chains, the located arc (every input-tick binding included) and the mechanism counters compared equal inside the test",
        },
        idling_human_control: {
          wiring: "identical browser run, anti-huddle live, slot-1 frames neutral (no press edges)",
          ticks: idle.records.length,
          human_arc_located: false,
          first_touch_tick:
            idle.records.find((record) => record.ball.lastTouchRef !== null)?.tick ?? null,
          slot_switch_events: idle.events.filter((event) => event.kind === "slot-switch").length,
          player_1_tackle_phase_events: idle.events.filter(
            (event) =>
              event.kind === "tackle-phase" &&
              String(payloadOf(event).playerId ?? "") === HUMAN_START_PLAYER,
          ).length,
          player_1_pass_events: idle.events.filter(
            (event) =>
              event.kind === "pass" && String(payloadOf(event).playerId ?? "") === HUMAN_START_PLAYER,
          ).length,
          note:
            "the CPU arc still opens (first touch on tick 18) but no named human interaction exists, so none of the five frames can be located from this run",
        },
        stashed_control: {
          wiring: "identical browser composition-root run with the full human program but cpuAntiHuddle: false",
          ticks: stashed.records.length,
          human_arc_located: false,
          first_touch_tick: null,
          ball_touched_ticks: stashed.records.filter((record) => record.ball.lastTouchRef !== null).length,
          human_press_ticks: stashed.records.filter((record) => record.human.pressedButtons !== 0).length,
          kickoff_freeze_activations: stashed.counters.kickoff_freeze,
          note:
            "with the anti-huddle shape stashed the kickoff ball is never touched, the arc never opens and every geometry-gated human press stays armed - no frame of this sequence can be located",
        },
        cross_runtime: {
          engine_artifacts: [
            "docs/evidence/5V5-KICKOFF-ANTI-HUDDLE/trajectory.json#5v5-kickoff-cpu-vs-cpu",
          ],
          engine_first_touch_tick: ENGINE_FIRST_TOUCH_TICK,
          engine_kickoff_taker_id: ENGINE_KICKOFF_TAKER_ID,
          browser_first_touch_tick: arc!.firstTouchTick,
          browser_kickoff_taker_id: arc!.kickoffTakerId,
          browser_tick_1_state_hash: second.hashes[0] ?? "",
          arc_structure_matches_engine:
            arc!.firstTouchTick === ENGINE_FIRST_TOUCH_TICK &&
            arc!.kickoffTakerId === ENGINE_KICKOFF_TAKER_ID,
          note:
            "the kickoff structure the human interacts with reproduces the pinned Node read for this scenario geometry; the human-program event ticks are this Chromium artifact's own. Committed per-tick hashes are NOT compared across runtimes (known pinned-runtime gap): this trajectory is the Chromium run's chain",
        },
        video: {
          status: "NOT_PRODUCED",
          reason:
            "the repository video path (package.json capture-ai-video -> scripts/capture-ai-match-video.mjs) is absent in this tree, so no provider artifact exists to reference; video is optional diagnostic evidence and never replaces this trajectory",
        },
      };
      await commands.writeFile(TRAJECTORY_REL, `${JSON.stringify(trajectory, null, 2)}\n`);
    },
    540_000,
  );

  it("sequence.json is byte-coherent with the PNGs and the trajectory anchors", async () => {
    const sequence = JSON.parse(await commands.readFile(SEQUENCE_REL, "utf-8")) as {
      schema_version: number;
      objective_id: string;
      evidence_class: string;
      frames: Array<{
        index: number;
        label: string;
        tick: number;
        semantic: string;
        path: string;
        sha256: string;
        binding: { input_tick?: number } | null;
      }>;
    };
    const trajectory = JSON.parse(await commands.readFile(TRAJECTORY_REL, "utf-8")) as {
      objective_id: string;
      ticks: number;
      frames: Array<{ label: string; tick: number; png_sha256: string }>;
      per_tick: unknown[][];
      human_fields: string[];
      arc: { first_touch_tick: number; pass_displacement_metres: number; contact_tick: number };
      determinism: { replay_identical: boolean };
      idling_human_control: { human_arc_located: boolean; player_1_pass_events: number };
      stashed_control: { human_arc_located: boolean; first_touch_tick: number | null };
      mechanism_counters: { anti_huddle_run: { kickoff_freeze: number; nearest_only_chase: number } };
      cross_runtime: { arc_structure_matches_engine: boolean };
    };

    expect(sequence.schema_version).toBe(1);
    expect(sequence.objective_id).toBe(OBJECTIVE_ID);
    expect(sequence.evidence_class).toBe("DYNAMIC_VISUAL");
    expect(trajectory.objective_id).toBe(OBJECTIVE_ID);
    expect(trajectory.ticks).toBeGreaterThanOrEqual(600);
    expect(trajectory.per_tick.length).toBe(trajectory.ticks);
    expect(trajectory.arc.first_touch_tick).toBe(ENGINE_FIRST_TOUCH_TICK);
    expect(trajectory.arc.pass_displacement_metres).toBeGreaterThanOrEqual(
      MIN_PASS_DISPLACEMENT_METRES,
    );
    expect(trajectory.determinism.replay_identical).toBe(true);
    expect(trajectory.cross_runtime.arc_structure_matches_engine).toBe(true);
    expect(trajectory.mechanism_counters.anti_huddle_run.kickoff_freeze).toBeGreaterThan(0);
    expect(trajectory.mechanism_counters.anti_huddle_run.nearest_only_chase).toBeGreaterThan(0);
    expect(trajectory.idling_human_control.human_arc_located).toBe(false);
    expect(trajectory.idling_human_control.player_1_pass_events).toBe(0);
    expect(trajectory.stashed_control.human_arc_located).toBe(false);
    expect(trajectory.stashed_control.first_touch_tick).toBeNull();

    expect(sequence.frames.length).toBeGreaterThanOrEqual(3);
    expect(sequence.frames.length).toBeLessThanOrEqual(5);
    expect(sequence.frames.map((frame) => frame.label)).toEqual(
      trajectory.frames.map((frame) => frame.label),
    );
    expect(sequence.frames.map((frame) => frame.tick)).toEqual(
      trajectory.frames.map((frame) => frame.tick),
    );
    expect(sequence.frames.map((frame) => frame.sha256)).toEqual(
      trajectory.frames.map((frame) => frame.png_sha256),
    );

    let previousTick = -1;
    const hashes = new Set<string>();
    for (const [index, frame] of sequence.frames.entries()) {
      expect(frame.index).toBe(index + 1);
      expect(frame.path).toBe(`${frame.label}.png`);
      expect(frame.tick).toBeGreaterThan(previousTick);
      previousTick = frame.tick;
      expect(frame.sha256).toBe(await sha256OfFile(`${OUTPUT_REL}/${frame.path}`));
      expect(frame.sha256).toMatch(/^[0-9a-f]{64}$/);
      hashes.add(frame.sha256);
    }
    expect(hashes.size).toBe(sequence.frames.length);

    // The per-tick human rows carry exactly the discrete presses the
    // sequence claims, byte-bound to their commits.
    const humanIndex = trajectory.human_fields.indexOf("pressedBits");
    expect(humanIndex).toBeGreaterThan(-1);
    const pressedRows = trajectory.per_tick
      .map((row) => row[9] as unknown[])
      .filter((human) => String(human[humanIndex] ?? "") !== "");
    const pressedLabels = pressedRows.map((human) => String(human[humanIndex]));
    expect(pressedLabels.filter((label) => label === "SWITCH_PLAYER_BIT").length).toBe(5);
    expect(pressedLabels.filter((label) => label === "SLIDE_TACKLE_BIT").length).toBe(1);
    expect(pressedLabels.filter((label) => label === "PASS_BIT").length).toBeGreaterThanOrEqual(1);
    expect(pressedLabels.length).toBeGreaterThanOrEqual(7);
    expect(pressedLabels.length).toBeLessThanOrEqual(20);
  });
});
