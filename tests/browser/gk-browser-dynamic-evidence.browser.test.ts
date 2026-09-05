/**
 * Browser-mode DYNAMIC_VISUAL capture for GK-BROWSER-DYNAMIC-EVIDENCE.
 *
 * The SMALL-SIDED goalkeeper role, executed by the REAL browser composition
 * root in Chromium (Vite + real Three renderer through the accepted test
 * bridge). Four event-centered frames of a designated keeper's goal arc and
 * the save/claim it answers:
 *
 *   keeper arc hold -> anti-huddle spread/press (keeper excluded) ->
 *   shot on target -> recorded save contact inside the reach radius
 *
 * The run is the driven SMALL-SIDED save fixture
 * `eval/scenarios/5v5-keeper-shot-fixture.v1.json` (same ten bodies, nothing
 * scripted: the shooting body's own canonical CPU SHOT press, never an input
 * program). The keeper designation comes from the production
 * `designateKeeperFromLayout`/`resolveKeeperPlayerId` rule on the match's
 * starting layout; the save/claim is the same `FIRST_TOUCH` action a human
 * reaches through the keyboard bindings, resolved by the contact system on the
 * independent ball and recorded as a `player-ball-contact` event. The ball is
 * never parented, carried or teleported.
 *
 * Passes, all inside Chromium (the accepted anti-huddle / human-arc capture
 * precedent):
 *   Pass 1 - play the fixture with the keeper role live and locate the
 *            keeper's event ticks from the run's own event log (no rendering).
 *   Pass 2 - replay the same wiring from scratch, render the four frames at
 *            those ticks, and require the replayed per-tick hash chain and the
 *            located arc to be identical.
 *   Pass 3 - the same wiring with `gkBehavior: false` (the kill switch): no
 *            keeper designation, no arc hold, no save chain - the frame the
 *            tree emitted before any keeper existed. Every keeper-path counter
 *            stays 0 while the match still runs.
 *   Pass 4 - hash the PNG bytes and write `sequence.json` plus the browser-side
 *            `trajectory.json` (per-tick committed hashes, keeper designation
 *            fields, and the shot/save event log anchored to the frame ticks).
 *
 * Durable evidence is written only through the explicit capture command
 * (`WIP_SECTION=__EVIDENCE__:GK-BROWSER-DYNAMIC-EVIDENCE ...`); an ordinary
 * suite run lands in `test-results/gauntlet-capture/` and never touches
 * accepted evidence.
 *
 * Cross-runtime note (disclosed, not hidden): per-tick hashes/ticks are this
 * Chromium run's own; they are located from the run itself, never transcribed.
 * The keeper designation (team-a -> player-4, team-b -> player-10) and the
 * shot -> keeper-contact chain structure are compared to the pinned Node read
 * (docs/evidence/GK-5V5-ADAPTER-BEHAVIOR); per-tick floats are not compared
 * across runtimes (known pinned-runtime gap).
 *
 * No Math.random, wall clock, DOM, or Node I/O in the simulation core; this
 * test only consumes it through the accepted composition root.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { commands } from "@vitest/browser/context";
import { createTestBridge } from "../../src/apps/browser/test-bridge.js";
import { DEFAULT_RENDERER_CONFIG } from "../../src/adapters/renderer-three/renderer.js";
import {
  createCpuAdapter,
  buildCpuObservation,
  assignChaseRoles,
  designateKeeperFromLayout,
  resolveKeeperPlayerId,
  shotIsOnTargetToOwnGoal,
  ownGoalLineX,
  goalArcCenter,
  isInsideGoalArc,
  GK_SMALL_SIDED_V1,
  GK_GOAL_HALF_WIDTH_METRES,
  computeTeamDecision,
  resetMechanismCounters,
  getKeeperHoldActivations,
  getKeeperSaveArmActivations,
  getKeeperSavePressActivations,
  getKeeperPressExclusionActivations,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import type { ScenarioDefinition, SimulationEvent } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";

const OBJECTIVE_ID = "GK-BROWSER-DYNAMIC-EVIDENCE";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const OUTPUT_REL = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;
const TRAJECTORY_REL = DURABLE_EVIDENCE
  ? `docs/evidence/${OBJECTIVE_ID}/trajectory.json`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}/trajectory.json`;
const SEQUENCE_REL = `${OUTPUT_REL}/sequence.json`;

/** The driven SMALL-SIDED save fixture the browser composition root plays. */
const SCENARIO_PATH = "eval/scenarios/5v5-keeper-shot-fixture.v1.json";
/** Coherent browser window: the fixture's own observation window (600 ticks). */
const PLAY_TICKS = 600;

/**
 * Measurement thresholds for the evidence only - provisional, never gameplay
 * values. The arc radius / lateral bound / save reach are the versioned
 * provisional `gk-small-sided-v1` design values (not PES magnitudes); the
 * keeper-station / spread-press cadences gate the frame selection, never a
 * simulation constant. No new rubric.
 */
const GK_ARC_RADIUS_METRES = GK_SMALL_SIDED_V1.goal_arc_radius.value;
const GK_ARC_LATERAL_METRES = GK_SMALL_SIDED_V1.goal_arc_lateral_max.value;
const GK_SAVE_REACH_METRES = GK_SMALL_SIDED_V1.save_claim_reach_radius.value;
const GK_REACTION_WINDOW_TICKS = GK_SMALL_SIDED_V1.keeper_reaction_window_ticks.value;
/** OBSERVED position slack: a contact can shove a body, so the bound is
 * checked with the accepted slack (no hidden envelope added). */
const OBSERVED_POSITION_SLACK_METRES = 0.35;
/** First tick after which the keeper-station baseline is taken (transit window). */
const KEEPER_STATION_MIN_TICK = 40;
/** The press frame must sit at least this many ticks before the shot to stay distinct. */
const PRESS_LEAD_TICKS = 10;
/** A save chain needs at least this many ticks between shot and contact for
 * the shot/save frames to be visibly distinct (event-centered, never scripted). */
const SAVE_CHAIN_MIN_GAP_TICKS = 3;
/** Ball planar speed that counts as "moving" (m/s) - evidence threshold. */
const BALL_MOVING_SPEED = 0.3;
/** Kickoff home tolerance (metres) - the accepted anti-huddle constant. */
const HOME_TOLERANCE_METRES = 0.75;

/**
 * Static presentation-only framing, identical for every frame so the sequence
 * stays comparable. It is aimed at the keeper's defending goal (the team-b
 * goal at +x, where the fixture's shots land) so the arc hold and the save
 * contact are legible on the pitch; the renderer consumes immutable snapshots,
 * so framing cannot move a football.
 */
const CAMERA = {
  position: { x: 46, y: 22, z: 18 },
  target: { x: 52, y: 0, z: 0 },
};
const CAMERA_FOV = 46;

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
// Per-tick record (the browser run's own committed geometry + keeper fields)
// ---------------------------------------------------------------------------

interface PlayerRecord {
  playerId: string;
  teamId: string;
  x: number;
  y: number;
  speed: number;
  distToBall: number;
  distToHome: number;
  /** Held at its fixed kickoff home by the accepted anti-huddle freeze. */
  frozen: boolean;
  /** The team's single designated presser/chaser. */
  chaser: boolean;
  /** The designated cover body screening behind the presser. */
  cover: boolean;
  /** The team's designated SMALL-SIDED keeper (spec §4). */
  keeper: boolean;
}

interface TeamRecord {
  keeperPlayerId: string | null;
  /** Keeper's planar distance from its goal-arc centre (metres). */
  keeperDistToArcCenter: number | null;
  /** Keeper's signed lateral drift from the arc centre (metres). */
  keeperLateralDrift: number | null;
  /** Whether the keeper is inside `goal_arc_radius` and the lateral band. */
  keeperOnArc: boolean;
  /** Whether the designated keeper is the presser/chaser (must be false). */
  keeperIsChaser: boolean;
  chaserPlayerId: string | null;
  coverPlayerId: string | null;
}

interface TickEvent {
  kind: string;
  playerId: string;
  teamId: string;
  contactType?: string;
  planarDistance?: number | null;
}

interface TickRecord {
  tick: number;
  stateHash: string;
  ball: { x: number; y: number; speed: number; regime: string; lastTouchRef: string | null };
  ballTravelledMetres: number;
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

interface PlayResult {
  records: TickRecord[];
  events: SimulationEvent[];
  hashes: string[];
  captured: string[];
  keeperByTeam: Record<string, string>;
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
 * samples for the 5v5 CPU-vs-CPU match, with the keeper switch explicit so the
 * stashed control can be played through this same code path.
 */
function sampleCpuFrames(sim: Simulation, slots: CpuSlot[], gkBehavior: boolean): InputFrame[] {
  const snapshot = sim.snapshot();
  const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
  for (const entry of slots) {
    if (!teamDecisions.has(entry.teamId)) {
      const teamObs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
      teamObs.cpuAntiHuddle = true;
      teamObs.gkBehavior = gkBehavior;
      teamDecisions.set(entry.teamId, computeTeamDecision(teamObs, entry.teamId));
    }
  }
  return slots.map((entry) => {
    const observation = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
    observation.teamDecision = teamDecisions.get(entry.teamId);
    observation.cpuDefensiveTackle = true;
    observation.cpuAntiHuddle = true;
    observation.gkBehavior = gkBehavior;
    const frame = entry.adapter.sample(sim.tick, observation);
    frame.controlSlot = entry.controlSlot;
    return frame;
  });
}

/** The keeper a team designates from the layout it starts the match with. */
function keeperByTeamFromLayout(scenario: ScenarioDefinition): Record<string, string> {
  const out: Record<string, string> = {};
  for (const teamId of [...new Set(scenario.players.map((p) => p.teamId))]) {
    const resolved = designateKeeperFromLayout(scenario.players, teamId, scenario.pitchLength);
    if (resolved !== undefined) out[teamId] = resolved;
  }
  return out;
}

/**
 * Play the driven 5v5 SMALL-SIDED save fixture through the browser composition
 * root, recording the committed keeper geometry and the event stream.
 *
 * @param renderAt - tick -> frame label; the frame is rendered and written when
 *   the simulation commits that tick.
 */
async function playMatch(
  scenario: ScenarioDefinition,
  renderAt: Map<number, string>,
  render: boolean,
  gkBehavior: boolean,
): Promise<PlayResult> {
  const bridge = createTestBridge(container, scenario, undefined, {
    ...DEFAULT_RENDERER_CONFIG,
    cameraPosition: CAMERA.position,
    cameraTarget: CAMERA.target,
    cameraFov: CAMERA_FOV,
  });
  await bridge.reset();
  const sim = bridge.getSimulation();
  const slots = cpuSlots(scenario);
  const teamIds = [...new Set(scenario.players.map((player) => player.teamId))].sort();
  const homes = new Map(scenario.players.map((player) => [player.playerId, player.groundPosition]));

  // The keeper designation is a layout fact resolved once per team through the
  // production rule, honoring the wiring switch: with the role stashed there is
  // no keeper, so the stashed run reproduces HEAD (adapter-layer opt-in, §4-§6).
  const firstSnapshot = sim.snapshot();
  const keeperByTeam: Record<string, string> = {};
  for (const teamId of teamIds) {
    const slot = slots.find((entry) => entry.teamId === teamId);
    const obs = buildCpuObservation(firstSnapshot, teamId, slot?.controlledPlayerId);
    obs.cpuAntiHuddle = true;
    obs.gkBehavior = gkBehavior;
    const keeper = resolveKeeperPlayerId(obs, teamId);
    if (keeper !== undefined) keeperByTeam[teamId] = keeper;
  }

  resetMechanismCounters();

  const records: TickRecord[] = [];
  const events: SimulationEvent[] = [];
  const hashes: string[] = [];
  const captured: string[] = [];
  let previousBall: { x: number; y: number } | null = null;

  for (let i = 0; i < PLAY_TICKS; i++) {
    sim.applyInputs(sampleCpuFrames(sim, slots, gkBehavior));
    const result = sim.step();
    events.push(...result.events);
    hashes.push(result.stateHash);

    // A record is the committed geometry the adapters read on the next tick.
    const snapshot = sim.snapshot();
    const ballUntouched = snapshot.ball.lastTouchRef === null;
    const teams: Record<string, TeamRecord> = {};
    const chasers = new Set<string>();
    const covers = new Set<string>();
    const keepers = new Set<string>();
    for (const teamId of teamIds) {
      const slot = slots.find((entry) => entry.teamId === teamId);
      const teamObs = buildCpuObservation(snapshot, teamId, slot?.controlledPlayerId);
      teamObs.cpuAntiHuddle = true;
      teamObs.gkBehavior = gkBehavior;
      const roles = assignChaseRoles(teamObs, teamId);
      if (roles.chaserPlayerId) chasers.add(roles.chaserPlayerId);
      if (roles.coverPlayerId) covers.add(roles.coverPlayerId);

      const keeperId = keeperByTeam[teamId] ?? null;
      if (keeperId) keepers.add(keeperId);
      const keeper = snapshot.players.find((player) => player.playerId === keeperId);
      const arcCenter = goalArcCenter(teamId, scenario.pitchLength);
      let keeperDist: number | null = null;
      let keeperLat: number | null = null;
      let keeperOnArc = false;
      if (keeper) {
        keeperDist = round(
          planarDistance(keeper.groundPosition.x, keeper.groundPosition.y, arcCenter.x, arcCenter.y),
        );
        keeperLat = round(keeper.groundPosition.y - arcCenter.y);
        keeperOnArc = isInsideGoalArc(
          { x: keeper.groundPosition.x, y: keeper.groundPosition.y },
          arcCenter,
        ) && Math.abs(keeperLat) <= GK_ARC_LATERAL_METRES;
      }

      teams[teamId] = {
        keeperPlayerId: keeperId,
        keeperDistToArcCenter: keeperDist,
        keeperLateralDrift: keeperLat,
        keeperOnArc,
        keeperIsChaser: keeperId !== null && roles.chaserPlayerId === keeperId,
        chaserPlayerId: roles.chaserPlayerId ?? null,
        coverPlayerId: roles.coverPlayerId ?? null,
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
        frozen: ballUntouched && gkBehavior && !keepers.has(player.playerId),
        chaser: chasers.has(player.playerId),
        cover: covers.has(player.playerId),
        keeper: keepers.has(player.playerId),
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
      teams,
      players,
      events: result.events.map((event) => {
        const payload = (event.payload ?? {}) as Record<string, unknown>;
        return {
          kind: event.kind,
          playerId: String(payload.playerId ?? payload.playerIdA ?? ""),
          teamId: String(payload.teamId ?? payload.teamIdA ?? ""),
          contactType: payload.contactType !== undefined ? String(payload.contactType) : undefined,
          planarDistance:
            typeof payload.planarDistance === "number" ? round(payload.planarDistance, 4) : null,
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
  return { records, events, hashes, captured, keeperByTeam };
}

// ---------------------------------------------------------------------------
// Keeper arc location (from the run's own event log)
// ---------------------------------------------------------------------------

interface ShotInfo {
  tick: number;
  eventId: string;
  shooterPlayerId: string;
  shooterTeamId: string;
  ballPosition: { x: number; y: number };
  ballVelocity: { x: number; y: number };
}

interface ContactInfo {
  tick: number;
  eventId: string;
  playerId: string;
  teamId: string;
  contactType: string;
  planarDistance: number | null;
}

const BALL_CONTACT_KINDS = new Set(["player-ball-contact"]);

function shotInfos(events: SimulationEvent[]): ShotInfo[] {
  const out: ShotInfo[] = [];
  for (const evt of events) {
    if (evt.kind !== "shot") continue;
    const payload = (evt.payload ?? {}) as {
      playerId?: string;
      teamId?: string;
      incoming?: { position?: { x?: number; y?: number } };
      outgoing?: { linearVelocity?: { x?: number; y?: number } };
    };
    if (!payload.incoming?.position || !payload.outgoing?.linearVelocity) continue;
    out.push({
      tick: evt.tick,
      eventId: evt.id,
      shooterPlayerId: String(payload.playerId),
      shooterTeamId: String(payload.teamId),
      ballPosition: { x: Number(payload.incoming.position.x), y: Number(payload.incoming.position.y) },
      ballVelocity: {
        x: Number(payload.outgoing.linearVelocity.x),
        y: Number(payload.outgoing.linearVelocity.y),
      },
    });
  }
  return out;
}

function contactInfos(events: SimulationEvent[]): ContactInfo[] {
  const out: ContactInfo[] = [];
  for (const evt of events) {
    if (!BALL_CONTACT_KINDS.has(evt.kind)) continue;
    const payload = (evt.payload ?? {}) as {
      playerId?: string;
      teamId?: string;
      contactType?: string;
      planarDistance?: number;
    };
    if (typeof payload.playerId !== "string") continue;
    out.push({
      tick: evt.tick,
      eventId: evt.id,
      playerId: payload.playerId,
      teamId: String(payload.teamId ?? ""),
      contactType: String(payload.contactType ?? evt.kind),
      planarDistance: typeof payload.planarDistance === "number" ? payload.planarDistance : null,
    });
  }
  return out.sort((a, b) => a.tick - b.tick || a.eventId.localeCompare(b.eventId));
}

interface GkArc {
  shotTick: number;
  shotEventId: string;
  shotPlayerId: string;
  shotTeamId: string;
  shotBallPosition: { x: number; y: number };
  shotBallVelocity: { x: number; y: number };
  projectedCrossY: number;
  keeperContactTick: number;
  keeperContactEventId: string;
  keeperContactKind: string;
  keeperContactDistance: number;
  withinReach: boolean;
  ticksFromShotToContact: number;
  stationTick: number;
  pressTick: number;
  keeperByTeam: Record<string, string>;
  keeperTeamId: string;
}

function recordAt(records: TickRecord[], tick: number): TickRecord | undefined {
  return records.find((record) => record.tick === tick);
}

/** A tick where every team has exactly one presser + cover and no keeper is
 * the presser - the anti-huddle shape the keeper role inherits (spec §6). */
function hasPressCoverStructure(record: TickRecord): boolean {
  return Object.values(record.teams).every(
    (team) =>
      team.chaserPlayerId !== null &&
      team.coverPlayerId !== null &&
      team.chaserPlayerId !== team.coverPlayerId &&
      team.keeperIsChaser === false,
  );
}

/** A tick where every team's keeper is on its goal arc (spec §§5-6). */
function allKeepersOnArc(record: TickRecord): boolean {
  return Object.values(record.teams).every(
    (team) => team.keeperPlayerId !== null && team.keeperOnArc,
  );
}

function keeperOnArcWithSlack(record: TickRecord, teamId: string): boolean {
  const team = record.teams[teamId];
  if (!team || team.keeperPlayerId === null || team.keeperDistToArcCenter === null) return false;
  return (
    team.keeperDistToArcCenter <= GK_ARC_RADIUS_METRES + OBSERVED_POSITION_SLACK_METRES &&
    Math.abs(team.keeperLateralDrift ?? 0) <= GK_ARC_LATERAL_METRES + OBSERVED_POSITION_SLACK_METRES
  );
}

/**
 * Locate the keeper's event arc in a recorded browser run, or null when the run
 * never shows it - which is what the stashed control must produce.
 */
function locateGkArc(
  records: TickRecord[],
  keeperByTeam: Record<string, string>,
  events: SimulationEvent[],
  pitchLength: number,
): GkArc | null {
  const shots = shotInfos(events);
  const contacts = contactInfos(events);

  interface Chain {
    teamId: string;
    shot: ShotInfo;
    contact: ContactInfo;
  }
  const chains: Chain[] = [];
  for (const shot of shots) {
    for (const teamId of Object.keys(keeperByTeam)) {
      if (shot.shooterTeamId === teamId) continue;
      if (!shotIsOnTargetToOwnGoal(shot, teamId, pitchLength)) continue;
      // The next ball contact after the shot, and who made it.
      for (const contact of contacts) {
        if (contact.tick <= shot.tick) continue;
        if (contact.playerId === keeperByTeam[teamId]) {
          const within = contact.planarDistance !== null &&
            contact.planarDistance <= GK_SAVE_REACH_METRES + Number.EPSILON;
          if (within) chains.push({ teamId, shot, contact });
        }
        break;
      }
    }
  }
  if (chains.length === 0) return null;

  // Prefer the chain with the largest shot->contact gap (for distinct frames),
  // ties broken by earliest shot tick; fall back to the first within-reach one.
  let best = chains[0];
  for (const chain of chains) {
    const gap = chain.contact.tick - chain.shot.tick;
    if (gap < SAVE_CHAIN_MIN_GAP_TICKS) continue;
    const bestGap = best.contact.tick - best.shot.tick;
    if (
      gap > bestGap ||
      (gap === bestGap && chain.shot.tick < best.shot.tick) ||
      (bestGap < SAVE_CHAIN_MIN_GAP_TICKS)
    ) {
      best = chain;
    }
  }

  const keeperTeamId = best.teamId;
  const shot = best.shot;
  const contact = best.contact;

  // Keeper-station baseline: the first tick on which every keeper is on its
  // arc and the anti-huddle press/cover shape holds, inside the transit window
  // and before the shot.
  let stationTick: number | null = null;
  for (const record of records) {
    if (record.tick < KEEPER_STATION_MIN_TICK || record.tick >= shot.tick) continue;
    if (allKeepersOnArc(record) && hasPressCoverStructure(record)) {
      stationTick = record.tick;
      break;
    }
  }
  if (stationTick === null) return null;

  // Press-and-cover context frame: the last tick before the shot (at least
  // PRESS_LEAD_TICKS away) whose shape holds and whose keeper is on its arc.
  let pressTick: number | null = null;
  for (const record of records) {
    if (record.tick < stationTick || record.tick >= shot.tick - PRESS_LEAD_TICKS) continue;
    if (hasPressCoverStructure(record) && keeperOnArcWithSlack(record, keeperTeamId)) {
      pressTick = record.tick;
    }
  }
  if (pressTick === null) return null;

  const crossY = projectedCrossYAtGoalLine(shot, keeperTeamId, pitchLength);

  return {
    shotTick: shot.tick,
    shotEventId: shot.eventId,
    shotPlayerId: shot.shooterPlayerId,
    shotTeamId: shot.shooterTeamId,
    shotBallPosition: shot.ballPosition,
    shotBallVelocity: shot.ballVelocity,
    projectedCrossY: round(crossY ?? 0, 3),
    keeperContactTick: contact.tick,
    keeperContactEventId: contact.eventId,
    keeperContactKind: contact.contactType,
    keeperContactDistance: round(contact.planarDistance ?? 0, 4),
    withinReach: contact.planarDistance !== null &&
      contact.planarDistance <= GK_SAVE_REACH_METRES + Number.EPSILON,
    ticksFromShotToContact: contact.tick - shot.tick,
    stationTick,
    pressTick,
    keeperByTeam,
    keeperTeamId,
  };
}

function projectedCrossYAtGoalLine(
  shot: ShotInfo,
  teamId: string,
  pitchLength: number,
): number | null {
  const goalLineX = ownGoalLineX(teamId, pitchLength);
  if (Math.abs(shot.ballVelocity.x) < 1e-9) return null;
  const ticks = (goalLineX - shot.ballPosition.x) / shot.ballVelocity.x;
  if (!(ticks > 0)) return null;
  return shot.ballPosition.y + shot.ballVelocity.y * ticks;
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

function framePlan(arc: GkArc): FramePlan[] {
  const keeperId = arc.keeperByTeam[arc.keeperTeamId];
  return [
    {
      label: "keeper-arc-hold",
      tick: arc.stationTick,
      semantic: "before",
      description: `Goal-arc hold: the designated keepers hold their goal arcs while the anti-huddle shape runs - exactly one field presser + cover per team, the keeper (${keeperId}) never the chaser`,
    },
    {
      label: "press-and-cover",
      tick: arc.pressTick,
      semantic: "transition",
      description: `Anti-huddle spread/press: one field presser + cover per team, the keeper ${keeperId} on its arc and excluded from the field chase (spec §6)`,
    },
    {
      label: "shot-on-target",
      tick: arc.shotTick,
      semantic: "event",
      description: `Shot on target: ${arc.shotPlayerId} strikes the ball toward the keeper's goal (projected cross at y=${arc.projectedCrossY})`,
    },
    {
      label: "save-contact",
      tick: arc.keeperContactTick,
      semantic: "result",
      description: `Save contact: the keeper ${keeperId} answers the shot with a recorded ball contact ${arc.keeperContactDistance} m off it (within save_claim_reach_radius) ${arc.ticksFromShotToContact} ticks later; the ball stays independent`,
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
// Compact per-tick encoding (layout declared once, like the accepted captures)
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
  "events",
  "teams",
  "players",
] as const;

const TEAM_FIELDS = [
  "keeperPlayerId",
  "keeperDistToArcCenter",
  "keeperLateralDrift",
  "keeperOnArc",
  "keeperIsChaser",
  "chaserPlayerId",
  "coverPlayerId",
] as const;

const PLAYER_FIELDS = ["playerId", "teamId", "x", "y", "speed", "distToBall", "distToHome", "flags"] as const;

const PLAYER_FLAGS: Array<[keyof PlayerRecord, string]> = [
  ["frozen", "f"],
  ["chaser", "c"],
  ["cover", "o"],
  ["keeper", "k"],
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
    record.events,
    teamOrder.map((teamId) => {
      const team = record.teams[teamId];
      return [
        team.keeperPlayerId,
        team.keeperDistToArcCenter,
        team.keeperLateralDrift,
        team.keeperOnArc,
        team.keeperIsChaser,
        team.chaserPlayerId,
        team.coverPlayerId,
      ];
    }),
    record.players.map(encodePlayer),
  ];
}

function payloadOf(event: SimulationEvent): Record<string, unknown> {
  return (event.payload ?? {}) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

describe("GK-BROWSER-DYNAMIC-EVIDENCE: browser goalkeeper arc + save frames", () => {
  it(
    "captures 4 event-centered frames of the keeper arc hold and the save contact",
    async () => {
      if (DURABLE_EVIDENCE) await assertEvidenceMutable();
      const scenario = await loadScenario();
      for (const assignment of Object.values(scenario.controlAssignments)) {
        expect((assignment as { mode?: string }).mode).not.toBe("HUMAN");
      }
      expect(scenario.players.length).toBe(10);
      const keeperByTeam = keeperByTeamFromLayout(scenario);
      expect(keeperByTeam["team-a"]).toBe("player-4");
      expect(keeperByTeam["team-b"]).toBe("player-10");
      expect(scenario.pitchLength).toBe(105);

      // Pass 1 - locate the keeper's event ticks (no rendering).
      const first = await playMatch(scenario, new Map(), false, true);
      const arc = locateGkArc(first.records, first.keeperByTeam, first.events, scenario.pitchLength);
      expect(arc, "the browser keeper-shot run never produced the keeper arc").not.toBeNull();
      const plan = framePlan(arc!);
      const ticks = plan.map((frame) => frame.tick);
      expect(new Set(ticks).size, "frame ticks must be distinct").toBe(plan.length);
      for (const [index, tick] of ticks.entries()) {
        expect(tick, `frame ${index + 1} inside the play window`).toBeGreaterThanOrEqual(1);
        expect(tick, `frame ${index + 1} inside the play window`).toBeLessThan(PLAY_TICKS);
        if (index > 0) expect(tick, "frames in event order").toBeGreaterThan(ticks[index - 1]);
      }
      console.log(
        `[gk-browser-capture] frames ${ticks.join("/")} shot=${arc!.shotTick}` +
          ` save=${arc!.keeperContactTick} dist=${arc!.keeperContactDistance}` +
          ` keeper=${arc!.keeperByTeam[arc!.keeperTeamId]} (durable=${DURABLE_EVIDENCE})`,
      );

      // Pass 2 - replay the same wiring and render the four frames.
      const renderAt = new Map(plan.map((frame) => [frame.tick, frame.label]));
      const second = await playMatch(scenario, renderAt, true, true);
      expect(second.captured).toEqual(plan.map((frame) => frame.label));
      expect(second.hashes, "the browser replay lost the run").toEqual(first.hashes);
      expect(
        locateGkArc(second.records, second.keeperByTeam, second.events, scenario.pitchLength),
      ).toEqual(arc);
      expect(getKeeperHoldActivations()).toBeGreaterThan(0);
      expect(getKeeperSaveArmActivations()).toBeGreaterThan(0);
      const liveCounters = {
        hold: getKeeperHoldActivations(),
        arms: getKeeperSaveArmActivations(),
        save: getKeeperSavePressActivations(),
        excl: getKeeperPressExclusionActivations(),
      };

      // Semantic invariants at the captured ticks (the browser-visible binding).
      const station = recordAt(second.records, arc!.stationTick)!;
      const press = recordAt(second.records, arc!.pressTick)!;
      const shot = recordAt(second.records, arc!.shotTick)!;
      const save = recordAt(second.records, arc!.keeperContactTick)!;
      const keeperTeam = arc!.keeperTeamId;
      const keeperId = arc!.keeperByTeam[keeperTeam];

      // before: keepers hold their arcs and no keeper is the presser.
      expect(allKeepersOnArc(station)).toBe(true);
      expect(hasPressCoverStructure(station)).toBe(true);
      expect(station.teams[keeperTeam].keeperIsChaser).toBe(false);
      expect(station.teams[keeperTeam].keeperPlayerId).toBe(keeperId);

      // transition: the press/cover shape holds with the keeper on its arc.
      expect(hasPressCoverStructure(press)).toBe(true);
      expect(keeperOnArcWithSlack(press, keeperTeam)).toBe(true);
      expect(press.teams[keeperTeam].keeperIsChaser).toBe(false);

      // event: the shot crosses the keeper's goal inside the posts.
      expect(
        shot.events.some((event) => event.kind === "shot" && event.playerId === arc!.shotPlayerId),
      ).toBe(true);
      expect(Math.abs(arc!.projectedCrossY)).toBeLessThanOrEqual(GK_GOAL_HALF_WIDTH_METRES);

      // result: the keeper's own recorded contact, inside reach, on its arc.
      const keeperContact = save.events.find(
        (event) =>
          event.kind === "player-ball-contact" &&
          event.playerId === keeperId &&
          event.planarDistance !== null,
      );
      expect(keeperContact, "the keeper must record a ball contact").toBeDefined();
      expect(keeperContact!.planarDistance!).toBeLessThanOrEqual(
        GK_SAVE_REACH_METRES + Number.EPSILON,
      );
      expect(arc!.withinReach).toBe(true);
      expect(arc!.ticksFromShotToContact).toBeGreaterThan(0);
      expect(arc!.ticksFromShotToContact).toBeLessThanOrEqual(GK_REACTION_WINDOW_TICKS);
      expect(keeperOnArcWithSlack(save, keeperTeam)).toBe(true);
      expect(save.ball.lastTouchRef, "the ball was played after the shot").not.toBeNull();

      // Pass 3 - the same wiring with the keeper role stashed shows no arc and
      // no keeper activity (matches HEAD before any keeper existed).
      const stashed = await playMatch(scenario, new Map(), false, false);
      expect(
        locateGkArc(stashed.records, stashed.keeperByTeam, stashed.events, scenario.pitchLength),
        "the stashed run must not produce the arc",
      ).toBeNull();
      expect(getKeeperHoldActivations()).toBe(0);
      expect(getKeeperSaveArmActivations()).toBe(0);
      expect(getKeeperSavePressActivations()).toBe(0);
      expect(
        stashed.events.some(
          (event) =>
            event.kind === "player-ball-contact" && String(payloadOf(event).playerId) === keeperId,
        ),
        "with the keeper stashed the fixture run still touches the ball, but never as a keeper",
      ).toBe(true);

      // Pass 4 - hash the PNGs, then write sequence.json + trajectory.json.
      const pngHashes: string[] = [];
      for (const frame of plan) {
        pngHashes.push(await sha256OfFile(`${OUTPUT_REL}/${frame.label}.png`));
      }
      expect(new Set(pngHashes).size, "the four frames must be distinct images").toBe(plan.length);

      const teamOrder = [...new Set(scenario.players.map((player) => player.teamId))].sort();
      const playerOrder = second.records[0]!.players.map((player) => player.playerId);
      const stateHashOfHashes = await sha256OfText(second.hashes.join("\n"));
      const shots = shotInfos(second.events);
      const keeperContacts = contactInfos(second.events).filter(
        (contact) => contact.playerId === keeperId,
      );

      const sequence = {
        schema_version: 1,
        objective_id: OBJECTIVE_ID,
        evidence_class: "DYNAMIC_VISUAL",
        semantic_order:
          "keeper goal-arc hold -> anti-huddle spread/press (keeper excluded) -> shot on target -> recorded save contact",
        durable_capture: DURABLE_EVIDENCE,
        scenario: scenario.id,
        arc: {
          keeper_team_id: keeperTeam,
          keeper_player_id: keeperId,
          shot_tick: arc!.shotTick,
          shot_player_id: arc!.shotPlayerId,
          projected_cross_y: arc!.projectedCrossY,
          save_tick: arc!.keeperContactTick,
          save_kind: arc!.keeperContactKind,
          save_distance_metres: arc!.keeperContactDistance,
          within_reach: arc!.withinReach,
          ticks_from_shot_to_contact: arc!.ticksFromShotToContact,
          station_tick: arc!.stationTick,
          press_tick: arc!.pressTick,
        },
        reproduction: {
          capture_test: "tests/browser/gk-browser-dynamic-evidence.browser.test.ts",
          wiring:
            "src/apps/browser/main.ts 5v5 CPU-vs-CPU composition root with CpuObservation.cpuAntiHuddle + cpuDefensiveTackle + gkBehavior",
          scenario_path: SCENARIO_PATH,
          play_ticks: PLAY_TICKS,
          browser_trajectory: TRAJECTORY_REL,
        },
        cross_runtime_note:
          "Ticks and per-tick hashes are this Chromium run's own, located from the run itself. The keeper designation (team-a -> player-4, team-b -> player-10) and the shot -> keeper-contact chain structure are compared to the pinned Node artifacts (docs/evidence/GK-5V5-ADAPTER-BEHAVIOR); per-tick floats are not compared across runtimes (known pinned-runtime gap).",
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
        produced_by: "tests/browser/gk-browser-dynamic-evidence.browser.test.ts",
        runtime: "Chromium (vitest --project browser) through src/apps/browser/test-bridge.ts",
        driver:
          "browser composition-root 5v5 CPU-vs-CPU wiring (main.ts per-slot CpuAdapter + computeTeamDecision) under the accepted anti-huddle switch plus gkBehavior; keeper designation recorded through the same exported production function the adapters act on (designateKeeperFromLayout / resolveKeeperPlayerId)",
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
          field: "CpuObservation.gkBehavior",
          live_value: true,
          kill_switch: "gkBehavior: false (see stashed_control)",
        },
        thresholds: {
          all_values_provisional_measurement_only: true,
          goal_arc_radius_metres: GK_ARC_RADIUS_METRES,
          goal_arc_lateral_metres: GK_ARC_LATERAL_METRES,
          save_claim_reach_metres: GK_SAVE_REACH_METRES,
          keeper_reaction_window_ticks: GK_REACTION_WINDOW_TICKS,
          observed_position_slack_metres: OBSERVED_POSITION_SLACK_METRES,
          keeper_station_min_tick: KEEPER_STATION_MIN_TICK,
          press_lead_ticks: PRESS_LEAD_TICKS,
          save_chain_min_gap_ticks: SAVE_CHAIN_MIN_GAP_TICKS,
          ball_moving_speed_metres_per_second: BALL_MOVING_SPEED,
          home_tolerance_metres: HOME_TOLERANCE_METRES,
          note: "evidence measurement thresholds only - no simulation constant and no PES value; the arc / reach / reaction are the versioned provisional gk-small-sided-v1 design values",
        },
        arc: {
          keeper_team_id: keeperTeam,
          keeper_player_id: keeperId,
          shot_tick: arc!.shotTick,
          shot_event_id: arc!.shotEventId,
          shot_player_id: arc!.shotPlayerId,
          shot_team_id: arc!.shotTeamId,
          shot_ball_position: { x: arc!.shotBallPosition.x, y: arc!.shotBallPosition.y },
          shot_ball_velocity: { x: arc!.shotBallVelocity.x, y: arc!.shotBallVelocity.y },
          projected_cross_y: arc!.projectedCrossY,
          save_tick: arc!.keeperContactTick,
          save_event_id: arc!.keeperContactEventId,
          save_kind: arc!.keeperContactKind,
          save_distance_metres: arc!.keeperContactDistance,
          within_reach: arc!.withinReach,
          ticks_from_shot_to_contact: arc!.ticksFromShotToContact,
          station_tick: arc!.stationTick,
          press_tick: arc!.pressTick,
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
          fov: CAMERA_FOV,
          container: { width: 800, height: 600 },
        },
        event_log: {
          shots: shots.map((shot) => ({
            tick: shot.tick,
            player_id: shot.shooterPlayerId,
            team_id: shot.shooterTeamId,
          })),
          keeper_contacts: keeperContacts.map((contact) => ({
            tick: contact.tick,
            kind: contact.contactType,
            planar_distance_metres:
              contact.planarDistance === null ? null : round(contact.planarDistance, 4),
          })),
        },
        keeper_metrics: {
          note: "module counters of the accepted keeper path, reset around each recorded pass",
          live: liveCounters,
          stashed: { hold: 0, arms: 0, save: 0, excl: 0 },
        },
        determinism: {
          state_hash_of_hashes: stateHashOfHashes,
          final_state_hash: second.hashes[second.hashes.length - 1] ?? "",
          replay_identical: true,
          replay_note:
            "pass 1 and pass 2 are independent Chromium runs of the same wiring; their per-tick hash chains and the located keeper arc compared equal inside the test",
        },
        stashed_control: {
          wiring: "identical browser composition-root run with gkBehavior: false",
          ticks: stashed.records.length,
          arc_located: false,
          keeper_hold_activations: 0,
          keeper_save_arm_activations: 0,
          keeper_save_press_activations: 0,
          note:
            "with the keeper role stashed the fixture run still touches the ball but no keeper designation exists, so the arc never locates and every keeper-path counter stays 0 - the shape HEAD emitted before any keeper existed",
        },
        cross_runtime: {
          engine_artifacts: ["docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/trajectory.json#5v5-gk-shot-fixture-live"],
          engine_keeper_designations: { "team-a": "player-4", "team-b": "player-10" },
          browser_keeper_designations: keeperByTeam,
          designation_matches_engine:
            keeperByTeam["team-a"] === "player-4" && keeperByTeam["team-b"] === "player-10",
          note:
            "the keeper designation and the shot -> keeper-contact chain structure reproduce the pinned Node read; the fixture's drive path is the shooting body's own canonical CPU SHOT press, nothing scripted. Committed per-tick hashes are NOT compared across runtimes (known pinned-runtime gap): this trajectory is the Chromium run's chain",
        },
        video: {
          status: "NOT_PRODUCED",
          reason:
            "the repository video path is absent in this tree, so no provider artifact exists to reference; video is optional diagnostic evidence and never replaces this trajectory",
        },
        tick_fields: TICK_FIELDS,
        team_fields: TEAM_FIELDS,
        player_fields: PLAYER_FIELDS,
        player_flag_legend: {
          f: "kickoffFrozen - held at its fixed kickoff home this tick",
          c: "designatedChaser - the team's single designated presser/chaser",
          o: "designatedCover - the body screening behind the presser",
          k: "designatedKeeper - the team's SMALL-SIDED goalkeeper (spec §4)",
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
      arc: { keeper_player_id: string; save_tick: number; within_reach: boolean };
      frames: Array<{ index: number; label: string; tick: number; semantic: string; path: string; sha256: string }>;
    };
    const trajectory = JSON.parse(await commands.readFile(TRAJECTORY_REL, "utf-8")) as {
      objective_id: string;
      ticks: number;
      frames: Array<{ label: string; tick: number; png_sha256: string }>;
      per_tick: unknown[][];
      team_fields: string[];
      arc: {
        keeper_player_id: string;
        save_tick: number;
        within_reach: boolean;
        ticks_from_shot_to_contact: number;
      };
      determinism: { replay_identical: boolean };
      stashed_control: { arc_located: boolean; keeper_hold_activations: number };
      cross_runtime: { designation_matches_engine: boolean };
    };

    expect(sequence.schema_version).toBe(1);
    expect(sequence.objective_id).toBe(OBJECTIVE_ID);
    expect(sequence.evidence_class).toBe("DYNAMIC_VISUAL");
    expect(trajectory.objective_id).toBe(OBJECTIVE_ID);
    expect(trajectory.ticks).toBeGreaterThanOrEqual(300);
    expect(trajectory.per_tick.length).toBe(trajectory.ticks);
    expect(trajectory.arc.keeper_player_id).toBe("player-10");
    expect(trajectory.arc.within_reach).toBe(true);
    expect(trajectory.arc.ticks_from_shot_to_contact).toBeGreaterThan(0);
    expect(trajectory.determinism.replay_identical).toBe(true);
    expect(trajectory.cross_runtime.designation_matches_engine).toBe(true);
    expect(trajectory.stashed_control.arc_located).toBe(false);
    expect(trajectory.stashed_control.keeper_hold_activations).toBe(0);

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

    // The per-tick team rows carry the keeper designation at the captured ticks.
    const teamIndex = trajectory.team_fields.indexOf("keeperPlayerId");
    expect(teamIndex).toBeGreaterThan(-1);
    for (const saveTick of trajectory.frames.map((frame) => frame.tick)) {
      const row = trajectory.per_tick.find((entry) => (entry as unknown[])[0] === saveTick) as unknown[];
      const teams = row[9] as unknown[][];
      expect(
        teams.some((team) => team[teamIndex] === "player-10" || team[teamIndex] === "player-4"),
      ).toBe(true);
    }
  });
});
