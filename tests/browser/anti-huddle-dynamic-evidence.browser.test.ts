/**
 * Browser-mode DYNAMIC_VISUAL capture for BROWSER-5V5-ANTI-HUDDLE-DYNAMIC-EVIDENCE.
 *
 * Five event-centered frames of the anti-huddle arc inside a coherent 5v5
 * CPU-vs-CPU match played by the browser composition root itself:
 *
 *   kickoff freeze -> first touch -> spread to homes -> one presser + cover -> organic pass
 *
 * Nothing is scripted. The only inputs are the per-slot CPU adapter frames
 * `src/apps/browser/main.ts` samples for the `ai-match-5v5` mode, including the
 * accepted `cpuAntiHuddle` switch and the defensive tackle authority. The ball
 * visibly travelling after the kickoff strike is the accepted
 * BALL-SETTLED-REGIME-FIX: the pass frame asserts real displacement, so a
 * dead-ball kickoff can never produce these frames again.
 *
 * Passes, all inside Chromium (the CPU-tackle capture precedent):
 *   Pass 1 - play the match and locate the arc's event ticks (no rendering).
 *   Pass 2 - replay the same wiring from scratch, render the five frames at
 *            those ticks, and require the replayed per-tick hash chain and the
 *            located arc to be identical.
 *   Pass 3 - the same wiring with `cpuAntiHuddle: false` (the kill switch): the
 *            kickoff must not even touch the ball and no arc may be located.
 *   Pass 4 - hash the PNG bytes and write `sequence.json` plus the browser-side
 *            `trajectory.json` (per-tick committed hashes, geometry, chase
 *            designation, and the event log that anchors the frame ticks).
 *
 * Durable evidence is written only through the explicit capture command
 * (`WIP_SECTION=__EVIDENCE__:BROWSER-5V5-ANTI-HUDDLE-DYNAMIC-EVIDENCE ...`); an
 * ordinary suite run lands in `test-results/gauntlet-capture/` and never touches
 * accepted evidence.
 *
 * Cross-runtime note (disclosed, not hidden): this artifact is the Chromium
 * run's own. The pinned Node artifacts for the same scenario are quoted in
 * `trajectory.json:cross_runtime`; the arc structure is compared, per-tick
 * floats are not.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { commands } from "@vitest/browser/context";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { DEFAULT_RENDERER_CONFIG } from "../../src/adapters/renderer-three/renderer.js";
import {
  createCpuAdapter,
  buildCpuObservation,
  assignChaseRoles,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import { FOUNDATION_CONTACT_V1 } from "../../src/simulation/config/foundation.js";
import type { ScenarioDefinition, SimulationEvent } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";

const OBJECTIVE_ID = "BROWSER-5V5-ANTI-HUDDLE-DYNAMIC-EVIDENCE";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const OUTPUT_REL = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;
const TRAJECTORY_REL = DURABLE_EVIDENCE
  ? `docs/evidence/${OBJECTIVE_ID}/trajectory.json`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}/trajectory.json`;
const SEQUENCE_REL = `${OUTPUT_REL}/sequence.json`;

/** The browser's own 5v5 CPU-vs-CPU kickoff match (`?mode=ai-match-5v5`). */
const SCENARIO_PATH = "eval/scenarios/5v5-fixture-v1.json";
/** Coherent browser window: >= 600 committed ticks (10 s at the 60 Hz tick). */
const PLAY_TICKS = 620;

/**
 * Measurement thresholds for the evidence only - provisional, never gameplay
 * values. The home tolerance, the huddle radius and the same-team live-ball
 * density bound are the accepted provisional constants of the pinned
 * 5V5-KICKOFF-ANTI-HUDDLE artifact and its integration suite. No new rubric.
 */
const HOME_TOLERANCE_METRES = 0.75;
const HUDDLE_RADIUS_METRES = 5;
const LIVE_BALL_DENSITY_LIMIT_PER_TEAM = 3;
/** How far inside the freeze window the kickoff-freeze frame is taken. */
const FREEZE_LEAD_TICKS = 8;
/** Bodies that must still hold their kickoff home in the spread frame. */
const SPREAD_BODIES_AT_HOME = 8;
/** A designated presser counts as moving above this planar speed (m/s). */
const PRESSER_MOVING_SPEED = 1;
/** The press frame needs a designated presser at least this close to the ball. */
const PRESS_CLOSING_METRES = 8;
/** Ball planar speed that counts as "moving" (m/s). */
const BALL_MOVING_SPEED = 0.3;
/** Ticks the organic-pass frame waits after the pass to show real travel. */
const PASS_TRAVEL_TICKS = 60;
/** Minimum ball displacement the pass frame must show (metres). */
const MIN_PASS_DISPLACEMENT_METRES = 1;

/**
 * The accepted post-BALL-SETTLED-REGIME-FIX Node read of this same scenario
 * (`docs/evidence/BALL-SETTLED-REGIME-FIX/trajectory.json`, run
 * `5v5-kickoff-cpu-vs-cpu`): the kickoff ball is first touched on tick 18 by
 * the closest body to the centre spot, and the CPU passes on ticks 19/47/122/132.
 * Quoted, not re-measured inside Chromium.
 */
const ENGINE_FIRST_TOUCH_TICK = 18;
const ENGINE_KICKOFF_TAKER_ID = "player-10";
const ENGINE_PASS_TICKS = [19, 47, 122, 132];
/** The same artifact's committed tick-1 hash, quoted for the runtime note. */
const ENGINE_TICK_1_STATE_HASH = "fnv1a64-v1:61b20bf0db9677ba";

const TOUCH_EVENT_KINDS = new Set([
  "player-ball-contact",
  "pass",
  "lofted-pass",
  "through-ball",
  "shot",
]);
const PASS_EVENT_KINDS = new Set(["pass", "lofted-pass", "through-ball"]);

/**
 * Static presentation-only framing: one laboratory view pulled in from the
 * default so every frame of the sequence is comparable and still holds all ten
 * kickoff homes plus the centre contest the arc plays out in. The renderer
 * consumes immutable snapshots, so framing cannot move a football.
 */
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

/** Scenario bytes come through Vitest's browser command API (no `node:fs`). */
async function loadScenario(): Promise<ScenarioDefinition> {
  return JSON.parse(await commands.readFile(SCENARIO_PATH, "utf-8")) as ScenarioDefinition;
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
// Per-tick record (the browser run's own committed geometry)
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

interface TickEvent {
  kind: string;
  playerId: string;
  teamId: string;
}

interface TickRecord {
  tick: number;
  stateHash: string;
  ball: { x: number; y: number; speed: number; regime: string; lastTouchRef: string | null };
  ballTravelledMetres: number;
  kickoffTakerId: string | null;
  teams: Record<string, TeamRecord>;
  players: PlayerRecord[];
  events: TickEvent[];
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

function cpuSlots(scenario: ScenarioDefinition): CpuSlot[] {
  return Object.entries(scenario.controlAssignments).map(([controlSlot, assignment]) => ({
    adapter: createCpuAdapter(),
    controlSlot,
    teamId: assignment.teamId,
    controlledPlayerId: assignment.controlledPlayerId ?? "",
  }));
}

/**
 * One tick of the browser composition root's CPU wiring - the frames `main.ts`
 * samples for `ai-match-5v5`, with the anti-huddle switch explicit so the
 * stashed control can be played through this same code path.
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

interface PlayResult {
  records: TickRecord[];
  events: SimulationEvent[];
  hashes: string[];
  captured: string[];
}

/**
 * Play the 5v5 CPU-vs-CPU kickoff match through the browser composition root,
 * recording the committed geometry the anti-huddle adapters act on each tick.
 *
 * @param renderAt - tick -> frame label; the frame is rendered and written when
 *   the simulation commits that tick.
 */
async function playMatch(
  scenario: ScenarioDefinition,
  renderAt: Map<number, string>,
  render: boolean,
  cpuAntiHuddle: boolean,
  camera: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } },
): Promise<PlayResult> {
  const bridge = createTestBridge(container, scenario, undefined, {
    ...DEFAULT_RENDERER_CONFIG,
    cameraPosition: camera.position,
    cameraTarget: camera.target,
  });
  await bridge.reset();
  const sim = bridge.getSimulation();
  const slots = cpuSlots(scenario);
  const teamIds = [...new Set(scenario.players.map((player) => player.teamId))].sort();
  const homes = new Map(scenario.players.map((player) => [player.playerId, player.groundPosition]));
  const touchPressRange = FOUNDATION_CONTACT_V1.contactRadius.value;

  const records: TickRecord[] = [];
  const events: SimulationEvent[] = [];
  const hashes: string[] = [];
  const captured: string[] = [];
  let previousBall: { x: number; y: number } | null = null;

  for (let i = 0; i < PLAY_TICKS; i++) {
    sim.applyInputs(sampleCpuFrames(sim, slots, cpuAntiHuddle));
    const result = sim.step();
    events.push(...result.events);
    hashes.push(result.stateHash);

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
      // The adapter exempts the kick taker and any body already inside the
      // radius a touch can actually land in.
      const exemptFromFreeze =
        kickoffTakerId === player.playerId || distToBall <= touchPressRange;
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
      teams,
      players,
      events: result.events.map((event) => {
        const payload = (event.payload ?? {}) as Record<string, unknown>;
        return {
          kind: event.kind,
          playerId: String(payload.playerId ?? payload.playerIdA ?? ""),
          teamId: String(payload.teamId ?? payload.teamIdA ?? ""),
        };
      }),
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
    }
  }

  for (const entry of slots) entry.adapter.reset();
  bridge.getPresentationSession().dispose();
  return { records, events, hashes, captured };
}

// ---------------------------------------------------------------------------
// Arc location
// ---------------------------------------------------------------------------

interface ArcPlan {
  firstTouchTick: number;
  kickoffTakerId: string;
  freezeTick: number;
  spreadTick: number;
  pressTick: number;
  passTick: number;
  passFrameTick: number;
  passKind: string;
  passPlayerId: string;
  passTeamId: string;
  passDisplacementMetres: number;
}

function recordAt(records: TickRecord[], tick: number): TickRecord | undefined {
  return records.find((record) => record.tick === tick);
}

function bodiesAtHome(record: TickRecord): number {
  return record.players.filter((player) => player.distToHome <= HOME_TOLERANCE_METRES).length;
}

function designatedChasers(record: TickRecord): PlayerRecord[] {
  return record.players.filter((player) => player.chaser);
}

function hasPressAndCoverStructure(record: TickRecord): boolean {
  return Object.values(record.teams).every(
    (team) =>
      team.chaserPlayerId !== null &&
      team.coverPlayerId !== null &&
      team.chaserPlayerId !== team.coverPlayerId,
  );
}

function coverBehindPresser(record: TickRecord): boolean {
  return Object.values(record.teams).some(
    (team) => team.coverBehindPresserMetres !== null && team.coverBehindPresserMetres < 0,
  );
}

function presserClosing(record: TickRecord): boolean {
  return record.players.some(
    (player) => player.chaser && player.distToBall <= PRESS_CLOSING_METRES,
  );
}

function teamBallDensity(record: TickRecord): number {
  return Math.max(...Object.values(record.teams).map((team) => team.playersWithinHuddleRadius));
}

/**
 * Locate the arc's event ticks in a recorded browser run, or return null when
 * the run never shows the arc - which is what the stashed control does.
 */
function locateArc(records: TickRecord[]): ArcPlan | null {
  const firstTouch = records.find((record) => record.ball.lastTouchRef !== null);
  if (!firstTouch || firstTouch.tick < FREEZE_LEAD_TICKS + 1) return null;
  const firstTouchTick = firstTouch.tick;

  const freeze = recordAt(records, firstTouchTick - FREEZE_LEAD_TICKS);
  if (!freeze || freeze.ball.lastTouchRef !== null) return null;
  const kickoffTakerId = records.find((record) => record.kickoffTakerId !== null)?.kickoffTakerId;
  if (!kickoffTakerId) return null;

  const spread = records.find(
    (record) =>
      record.tick >= firstTouchTick + 5 &&
      designatedChasers(record).length === Object.keys(record.teams).length &&
      record.players.some((player) => player.chaser && player.speed >= PRESSER_MOVING_SPEED) &&
      bodiesAtHome(record) >= SPREAD_BODIES_AT_HOME,
  );
  if (!spread) return null;

  const press = records.find(
    (record) =>
      record.tick > spread.tick &&
      hasPressAndCoverStructure(record) &&
      coverBehindPresser(record) &&
      presserClosing(record) &&
      record.ball.speed >= BALL_MOVING_SPEED,
  );
  if (!press) return null;

  for (const record of records) {
    if (record.tick <= press.tick || record.tick + PASS_TRAVEL_TICKS >= PLAY_TICKS) continue;
    const passEvent = record.events.find((event) => PASS_EVENT_KINDS.has(event.kind));
    if (!passEvent) continue;
    const frame = recordAt(records, record.tick + PASS_TRAVEL_TICKS);
    if (!frame) continue;
    const displacement = round(
      planarDistance(record.ball.x, record.ball.y, frame.ball.x, frame.ball.y),
      2,
    );
    if (displacement < MIN_PASS_DISPLACEMENT_METRES) continue;
    return {
      firstTouchTick,
      kickoffTakerId,
      freezeTick: freeze.tick,
      spreadTick: spread.tick,
      pressTick: press.tick,
      passTick: record.tick,
      passFrameTick: frame.tick,
      passKind: passEvent.kind,
      passPlayerId: passEvent.playerId,
      passTeamId: passEvent.teamId,
      passDisplacementMetres: displacement,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Frame plan
// ---------------------------------------------------------------------------

interface FramePlan {
  label: string;
  tick: number;
  semantic: string;
  description: string;
}

function framePlan(arc: ArcPlan): FramePlan[] {
  return [
    {
      label: "kickoff-freeze",
      tick: arc.freezeTick,
      semantic: "before",
      description: `Kickoff freeze: every body but the kick taker (${arc.kickoffTakerId}) holds its fixed kickoff home and the ball sits untouched on the centre spot`,
    },
    {
      label: "first-touch",
      tick: arc.firstTouchTick,
      semantic: "event",
      description: `First touch: ${arc.kickoffTakerId} strikes the frozen kickoff ball, the freeze releases and the ball starts travelling`,
    },
    {
      label: "spread-to-homes",
      tick: arc.spreadTick,
      semantic: "transition",
      description: "Spread to homes: the non-chasers still hold their kickoff homes while exactly one designated presser per team moves on the ball",
    },
    {
      label: "press-and-cover",
      tick: arc.pressTick,
      semantic: "result-press",
      description: "One presser + cover: a single designated presser closes on the moving ball with its cover behind it, nobody else converges",
    },
    {
      label: "organic-pass",
      tick: arc.passFrameTick,
      semantic: "result-pass",
      description: `Organic pass: the CPU fired a ${arc.passKind} from ${arc.passPlayerId} at tick ${arc.passTick}; by this frame the ball has travelled ${arc.passDisplacementMetres} m since it was struck`,
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
// Compact per-tick encoding (layout declared once, like the pinned artifact)
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
  "events",
  "teams",
  "players",
] as const;

const TEAM_FIELDS = [
  "chaserPlayerId",
  "coverPlayerId",
  "coverBehindPresserMetres",
  "playersWithinHuddleRadius",
] as const;

const PLAYER_FIELDS = [
  "playerId",
  "teamId",
  "x",
  "y",
  "speed",
  "distToBall",
  "distToHome",
  "flags",
] as const;

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
    record.events,
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

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

describe("BROWSER-5V5-ANTI-HUDDLE-DYNAMIC-EVIDENCE: browser anti-huddle frames", () => {
  it(
    "captures 5 event-centered frames of the kickoff freeze / organic pass arc",
    async () => {
      if (DURABLE_EVIDENCE) await assertEvidenceMutable();
      const scenario = await loadScenario();
      for (const assignment of Object.values(scenario.controlAssignments)) {
        expect((assignment as { mode?: string }).mode).not.toBe("HUMAN");
      }
      expect(scenario.players.length).toBe(10);

      // Pass 1 - locate the arc's event ticks (no rendering).
      const first = await playMatch(scenario, new Map(), false, true, CAMERA);
      const arc = locateArc(first.records);
      expect(arc, "the browser 5v5 kickoff never produced the anti-huddle arc").not.toBeNull();
      const plan = framePlan(arc!);
      const ticks = plan.map((frame) => frame.tick);
      expect(new Set(ticks).size, "frame ticks must be distinct").toBe(plan.length);
      for (const [index, tick] of ticks.entries()) {
        expect(tick, `frame ${index + 1} inside the play window`).toBeGreaterThanOrEqual(1);
        expect(tick, `frame ${index + 1} inside the play window`).toBeLessThan(PLAY_TICKS);
        if (index > 0) expect(tick, "frames in event order").toBeGreaterThan(ticks[index - 1]);
      }
      console.log(
        `[anti-huddle-capture] frames ${ticks.join("/")} pass=${arc!.passKind}@${arc!.passTick}` +
          ` disp=${arc!.passDisplacementMetres}m (durable=${DURABLE_EVIDENCE})`,
      );

      // Pass 2 - replay the same CPU-only wiring and render the five frames.
      const renderAt = new Map(plan.map((frame) => [frame.tick, frame.label]));
      const second = await playMatch(scenario, renderAt, true, true, CAMERA);
      expect(second.captured).toEqual(plan.map((frame) => frame.label));
      expect(second.hashes, "the browser replay lost the run").toEqual(first.hashes);
      expect(locateArc(second.records)).toEqual(arc);

      // Semantic invariants at the captured ticks (the browser-visible binding).
      const freeze = recordAt(second.records, arc!.freezeTick)!;
      const touch = recordAt(second.records, arc!.firstTouchTick)!;
      const spread = recordAt(second.records, arc!.spreadTick)!;
      const press = recordAt(second.records, arc!.pressTick)!;
      const strike = recordAt(second.records, arc!.passTick)!;
      const passFrame = recordAt(second.records, arc!.passFrameTick)!;
      const kickoffSpot = scenario.ball.position;

      // before: the freeze holds every non-exempt body at home, ball unmoved.
      expect(freeze.ball.lastTouchRef).toBeNull();
      expect(
        planarDistance(freeze.ball.x, freeze.ball.y, kickoffSpot.x, kickoffSpot.y),
        "the kickoff ball must still sit on the centre spot",
      ).toBeLessThan(0.01);
      expect(bodiesAtHome(freeze)).toBeGreaterThanOrEqual(SPREAD_BODIES_AT_HOME);
      expect(
        freeze.players.filter(
          (player) => player.frozen && player.distToHome > HOME_TOLERANCE_METRES,
        ).length,
        "no frozen body may drift off its kickoff home",
      ).toBe(0);
      expect(
        freeze.players.filter(
          (player) => player.speed > 0.5 && player.playerId !== arc!.kickoffTakerId,
        ).length,
        "only the kick taker may move during the freeze",
      ).toBe(0);

      // event: the taker's touch is what starts the ball.
      expect(touch.events.some((event) => TOUCH_EVENT_KINDS.has(event.kind))).toBe(true);
      expect(touch.ball.lastTouchRef).not.toBeNull();
      expect(touch.ball.speed).toBeGreaterThan(0);
      expect(
        arc!.firstTouchTick,
        "the browser first touch must match the pinned Node read",
      ).toBe(ENGINE_FIRST_TOUCH_TICK);
      expect(arc!.kickoffTakerId).toBe(ENGINE_KICKOFF_TAKER_ID);

      // transition: exactly one presser per team, the rest still at home.
      expect(designatedChasers(spread).length).toBe(Object.keys(spread.teams).length);
      expect(
        spread.players.some((player) => player.chaser && player.speed >= PRESSER_MOVING_SPEED),
        "the designated presser must be moving",
      ).toBe(true);
      expect(bodiesAtHome(spread)).toBeGreaterThanOrEqual(SPREAD_BODIES_AT_HOME);

      // result-press: one presser + a cover behind it, ball in play.
      expect(hasPressAndCoverStructure(press)).toBe(true);
      expect(coverBehindPresser(press)).toBe(true);
      expect(presserClosing(press)).toBe(true);
      expect(press.ball.speed).toBeGreaterThanOrEqual(BALL_MOVING_SPEED);

      // result-pass: the organic pass actually moved the ball.
      expect(strike.events.some((event) => PASS_EVENT_KINDS.has(event.kind))).toBe(true);
      expect(arc!.passDisplacementMetres).toBeGreaterThanOrEqual(MIN_PASS_DISPLACEMENT_METRES);
      expect(
        planarDistance(strike.ball.x, strike.ball.y, passFrame.ball.x, passFrame.ball.y),
        "the pass must show real ball displacement",
      ).toBeGreaterThanOrEqual(MIN_PASS_DISPLACEMENT_METRES);
      expect(passFrame.ball.lastTouchRef).not.toBeNull();
      // The lane the structure opened: no team has clumped at the pass frame.
      expect(teamBallDensity(passFrame)).toBeLessThanOrEqual(LIVE_BALL_DENSITY_LIMIT_PER_TEAM);

      // Pass 3 - the same wiring with the kill switch stashed shows no arc.
      const stashed = await playMatch(scenario, new Map(), false, false, CAMERA);
      expect(locateArc(stashed.records), "the stashed shape must not produce the arc").toBeNull();
      const stashedTouch = stashed.records.find((record) => record.ball.lastTouchRef !== null);
      expect(stashedTouch?.tick ?? null, "the stashed kickoff must not touch the ball").toBeNull();
      expect(
        stashed.records.some(
          (record) =>
            teamBallDensity(record) > LIVE_BALL_DENSITY_LIMIT_PER_TEAM || bodiesAtHome(record) < 2,
        ),
        "the stashed shape must collapse into the kickoff huddle",
      ).toBe(true);

      // Pass 4 - hash the PNGs, then write sequence.json + trajectory.json.
      const pngHashes: string[] = [];
      for (const frame of plan) {
        pngHashes.push(await sha256OfFile(`${OUTPUT_REL}/${frame.label}.png`));
      }
      expect(new Set(pngHashes).size, "the five frames must be distinct images").toBe(plan.length);

      const teamOrder = [...new Set(scenario.players.map((player) => player.teamId))].sort();
      const playerOrder = second.records[0]!.players.map((player) => player.playerId);
      const stateHashOfHashes = await sha256OfText(second.hashes.join("\n"));
      const touchEvents = second.events
        .filter((event) => TOUCH_EVENT_KINDS.has(event.kind))
        .map((event) => {
          const payload = (event.payload ?? {}) as Record<string, unknown>;
          return {
            tick: event.tick,
            kind: event.kind,
            playerId: String(payload.playerId ?? payload.playerIdA ?? ""),
          };
        });
      const passEvents = second.events
        .filter((event) => PASS_EVENT_KINDS.has(event.kind))
        .map((event) => {
          const payload = (event.payload ?? {}) as Record<string, unknown>;
          return {
            tick: event.tick,
            kind: event.kind,
            playerId: String(payload.playerId ?? ""),
            teamId: String(payload.teamId ?? ""),
          };
        });

      // Cross-runtime structure: the same arc the accepted Node artifacts pin
      // for this scenario. Structure only - per-tick hashes are runtime-specific.
      expect(
        passEvents.slice(0, ENGINE_PASS_TICKS.length).map((event) => event.tick),
        "the browser pass sequence must reproduce the pinned Node arc",
      ).toEqual(ENGINE_PASS_TICKS);

      const sequence = {
        schema_version: 1,
        objective_id: OBJECTIVE_ID,
        evidence_class: "DYNAMIC_VISUAL",
        semantic_order:
          "kickoff freeze -> first touch -> spread to homes -> one presser + cover -> organic pass",
        durable_capture: DURABLE_EVIDENCE,
        scenario: scenario.id,
        arc: {
          first_touch_tick: arc!.firstTouchTick,
          kickoff_taker_id: arc!.kickoffTakerId,
          spread_tick: arc!.spreadTick,
          press_tick: arc!.pressTick,
          pass_event: {
            tick: arc!.passTick,
            kind: arc!.passKind,
            player_id: arc!.passPlayerId,
            team_id: arc!.passTeamId,
          },
          pass_ball_displacement_metres: arc!.passDisplacementMetres,
        },
        reproduction: {
          capture_test: "tests/browser/anti-huddle-dynamic-evidence.browser.test.ts",
          wiring:
            "src/apps/browser/main.ts per-slot CPU composition root with CpuObservation.cpuAntiHuddle + cpuDefensiveTackle",
          scenario_path: SCENARIO_PATH,
          play_ticks: PLAY_TICKS,
          browser_trajectory: TRAJECTORY_REL,
          engine_trajectory: "docs/evidence/5V5-KICKOFF-ANTI-HUDDLE/trajectory.json",
        },
        cross_runtime_note:
          "Ticks and per-tick hashes are this Chromium run's own; the pinned Node artifacts for the same scenario (docs/evidence/5V5-KICKOFF-ANTI-HUDDLE and docs/evidence/BALL-SETTLED-REGIME-FIX) pin the same arc structure. Per-tick floats are not compared across runtimes (known pinned-runtime gap).",
        frames: plan.map((frame, index) => ({
          index: index + 1,
          label: frame.label,
          tick: frame.tick,
          semantic: frame.semantic,
          description: frame.description,
          path: `${frame.label}.png`,
          sha256: pngHashes[index],
        })),
      };
      await commands.writeFile(SEQUENCE_REL, `${JSON.stringify(sequence, null, 2)}\n`);

      const trajectory = {
        schema_version: 1,
        objective_id: OBJECTIVE_ID,
        evidence_class: "DYNAMIC_VISUAL",
        durable_capture: DURABLE_EVIDENCE,
        produced_by: "tests/browser/anti-huddle-dynamic-evidence.browser.test.ts",
        runtime: "Chromium (vitest --project browser) through src/apps/browser/test-bridge.ts",
        driver:
          "browser composition-root CPU wiring (main.ts per-slot CpuAdapter + computeTeamDecision) under the accepted anti-huddle switch; chase/cover designation recorded through the same exported production function the adapters act on (assignChaseRoles)",
        scenario: {
          id: scenario.id,
          path: SCENARIO_PATH,
          browser_mode: "ai-match-5v5",
          players: scenario.players.length,
          control_slots: Object.keys(scenario.controlAssignments).length,
          pitch: { length: scenario.pitchLength, width: scenario.pitchWidth },
          kickoff_ball: scenario.ball.position,
        },
        activation: {
          field: "CpuObservation.cpuAntiHuddle",
          live_value: true,
          kill_switch: "cpuAntiHuddle: false (see stashed_control)",
        },
        thresholds: {
          all_values_provisional_measurement_only: true,
          home_tolerance_metres: HOME_TOLERANCE_METRES,
          huddle_radius_metres: HUDDLE_RADIUS_METRES,
          live_ball_density_limit_per_team: LIVE_BALL_DENSITY_LIMIT_PER_TEAM,
          freeze_lead_ticks: FREEZE_LEAD_TICKS,
          spread_bodies_at_home: SPREAD_BODIES_AT_HOME,
          presser_moving_speed_metres_per_second: PRESSER_MOVING_SPEED,
          press_closing_metres: PRESS_CLOSING_METRES,
          ball_moving_speed_metres_per_second: BALL_MOVING_SPEED,
          pass_travel_ticks: PASS_TRAVEL_TICKS,
          min_pass_displacement_metres: MIN_PASS_DISPLACEMENT_METRES,
          note: "evidence measurement thresholds only - no simulation constant and no PES value",
        },
        arc: {
          first_touch_tick: arc!.firstTouchTick,
          kickoff_taker_id: arc!.kickoffTakerId,
          freeze_tick: arc!.freezeTick,
          spread_tick: arc!.spreadTick,
          press_tick: arc!.pressTick,
          pass_tick: arc!.passTick,
          pass_frame_tick: arc!.passFrameTick,
          pass_kind: arc!.passKind,
          pass_player_id: arc!.passPlayerId,
          pass_team_id: arc!.passTeamId,
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
        event_log: { touch_events: touchEvents, pass_events: passEvents },
        tick_fields: TICK_FIELDS,
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
          scenario.players.map((player) => [
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
            "pass 1 and pass 2 are independent Chromium runs of the same wiring; their per-tick hash chains compared equal inside the test",
        },
        stashed_control: {
          wiring: "identical browser composition-root run with cpuAntiHuddle: false",
          ticks: stashed.records.length,
          arc_located: false,
          first_touch_tick: null,
          huddle_ticks: stashed.records.filter(
            (record) => teamBallDensity(record) > LIVE_BALL_DENSITY_LIMIT_PER_TEAM,
          ).length,
          max_players_within_huddle_radius: Math.max(...stashed.records.map(teamBallDensity)),
          bodies_at_home_final_tick: bodiesAtHome(stashed.records[stashed.records.length - 1]!),
          note:
            "with the anti-huddle shape stashed the kickoff ball is never touched and the clump returns, so none of the five frames can be located",
        },
        cross_runtime: {
          engine_artifacts: [
            "docs/evidence/5V5-KICKOFF-ANTI-HUDDLE/trajectory.json#5v5-kickoff-cpu-vs-cpu",
            "docs/evidence/BALL-SETTLED-REGIME-FIX/trajectory.json#5v5-kickoff-cpu-vs-cpu",
          ],
          engine_first_touch_tick: ENGINE_FIRST_TOUCH_TICK,
          engine_kickoff_taker_id: ENGINE_KICKOFF_TAKER_ID,
          engine_pass_ticks: ENGINE_PASS_TICKS,
          engine_tick_1_state_hash: ENGINE_TICK_1_STATE_HASH,
          browser_first_touch_tick: arc!.firstTouchTick,
          browser_kickoff_taker_id: arc!.kickoffTakerId,
          browser_pass_ticks: passEvents.map((event) => event.tick),
          browser_tick_1_state_hash: second.hashes[0] ?? "",
          arc_structure_matches_engine:
            arc!.firstTouchTick === ENGINE_FIRST_TOUCH_TICK &&
            arc!.kickoffTakerId === ENGINE_KICKOFF_TAKER_ID &&
            passEvents.length >= ENGINE_PASS_TICKS.length &&
            ENGINE_PASS_TICKS.every((tick, index) => passEvents[index]?.tick === tick),
          tick_1_hash_matches_engine: (second.hashes[0] ?? "") === ENGINE_TICK_1_STATE_HASH,
          note:
            "the Node values are quoted from the accepted artifacts for this scenario, not re-measured inside Chromium. The arc structure (first touch on tick 18 by player-10, passes on 19/47/122/132) reproduces exactly; the committed per-tick hashes do NOT match the Node chain, so this browser chain is recorded as the Chromium run's own and per-tick floats are never compared across runtimes (known pinned-runtime gap)",
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
      }>;
    };
    const trajectory = JSON.parse(await commands.readFile(TRAJECTORY_REL, "utf-8")) as {
      objective_id: string;
      ticks: number;
      frames: Array<{ label: string; tick: number; png_sha256: string }>;
      per_tick: unknown[][];
      arc: { first_touch_tick: number; pass_displacement_metres: number };
      cross_runtime: { arc_structure_matches_engine: boolean };
      stashed_control: { arc_located: boolean; first_touch_tick: number | null };
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
    expect(trajectory.cross_runtime.arc_structure_matches_engine).toBe(true);
    expect(trajectory.stashed_control.arc_located).toBe(false);
    expect(trajectory.stashed_control.first_touch_tick).toBeNull();

    expect(sequence.frames.length).toBeGreaterThanOrEqual(3);
    expect(sequence.frames.length).toBeLessThanOrEqual(5);
    expect(sequence.frames.map((frame) => frame.semantic)).toEqual([
      "before",
      "event",
      "transition",
      "result-press",
      "result-pass",
    ]);
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
  });
});
