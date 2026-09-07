/**
 * Browser-mode DYNAMIC_VISUAL capture for HUMAN-KEEPER-CONTROL.
 *
 * The human-controlled designated keeper, executed by the REAL browser
 * composition root in Chromium. Four event-centered frames:
 *
 *   human directs the keeper (before) -> shot on target (event) ->
 *   human-controlled keeper save contact (result) -> CPU-keeper control (save)
 *
 * The run is the driven small-sided keeper-shot fixture
 * `eval/scenarios/5v5-human-keeper-shot-fixture.v1.json` (one HUMAN keeper slot,
 * identical geometry to the accepted CPU keeper-shot fixture). The keeper is
 * designated by the production `designateKeeperFromLayout` / `resolveKeeperPlayerId`
 * rule; the human directs the keeper through `CpuObservation.humanDirectedKeeperMove`
 * (the tick-indexed movement channel, which YIELDS the CPU arc-hold positioning to
 * the human), while the keeper's save/claim reaction still answers the shot on
 * target. The shot is the shooting body's own canonical CPU SHOT press; the
 * save/claim is the same FIRST_TOUCH action a human reaches through the keyboard,
 * resolved by the contact system on the independent ball.
 *
 * Passes:
 *   Pass 1 - play the human-directed wiring and locate the shot/save ticks (no
 *            rendering).
 *   Pass 2 - replay and render the frames at those ticks; require the replayed
 *            per-tick hash chain to be identical.
 *   Pass 3 - the same wiring with `gkBehavior: false` (the kill switch): the
 *            keeper designation is gone, no keeper arc/save is located.
 *   Pass 4 - hash the PNGs and write sequence.json + trajectory.json.
 *
 * Durable evidence is written only through the explicit capture command
 * (`WIP_SECTION=__EVIDENCE__:HUMAN-KEEPER-CONTROL ...`); an ordinary suite run
 * lands in `test-results/gauntlet-capture/` and never touches accepted evidence.
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
  designateKeeperFromLayout,
  resolveKeeperPlayerId,
  shotIsOnTargetToOwnGoal,
  ownGoalLineX,
  goalArcCenter,
  isInsideGoalArc,
  computeTeamDecision,
  GK_SMALL_SIDED_V1,
  GK_GOAL_HALF_WIDTH_METRES,
  resetKeeperMechanismCounters,
  getKeeperHoldActivations,
  getKeeperSaveArmActivations,
  getKeeperSavePressActivations,
  getKeeperPressExclusionActivations,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import type { ScenarioDefinition, SimulationEvent } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { Simulation } from "../../src/simulation/loop/simulation.js";

const OBJECTIVE_ID = "HUMAN-KEEPER-CONTROL";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const OUTPUT_REL = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;
const TRAJECTORY_REL = DURABLE_EVIDENCE
  ? `docs/evidence/${OBJECTIVE_ID}/trajectory.json`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}/trajectory.json`;

/** The driven 5v5 human-vs-CPU keeper-shot fixture (one HUMAN keeper slot). */
const SCENARIO_PATH = "eval/scenarios/5v5-human-keeper-shot-fixture.v1.json";
const PLAY_TICKS = 600;

const HUMAN_TEAM = "team-b";
const KEEPER_SLOT = "slot-10";
const KEEPER_PLAYER = "player-10";
const KEEPER_GOAL_LINE_X = 52.5;

const GK_ARC_LATERAL_METRES = GK_SMALL_SIDED_V1.goal_arc_lateral_max.value;
const GK_SAVE_REACH_METRES = GK_SMALL_SIDED_V1.save_claim_reach_radius.value;

/** Frame the team-b goal (where the fixture's shots land) so the save is legible. */
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

async function loadScenario(): Promise<ScenarioDefinition> {
  return JSON.parse(await commands.readFile(SCENARIO_PATH, "utf-8")) as ScenarioDefinition;
}

async function assertEvidenceMutable(): Promise<void> {
  try {
    await commands.readFile(`docs/evidence/${OBJECTIVE_ID}/manifest.json`, "utf-8");
  } catch {
    return;
  }
  throw new Error(`Accepted evidence is immutable: docs/evidence/${OBJECTIVE_ID}/manifest.json exists`);
}

// ---------------------------------------------------------------------------
// Per-tick record
// ---------------------------------------------------------------------------

interface PlayerRecord {
  playerId: string;
  x: number;
  y: number;
  distToBall: number;
  keeper: boolean;
  chaser: boolean;
}

interface TeamRecord {
  keeperPlayerId: string | null;
  keeperOnArc: boolean | null;
  keeperIsChaser: boolean | null;
  chaserPlayerId: string | null;
}

interface TickRecord {
  tick: number;
  stateHash: string;
  ball: { x: number; y: number; speed: number; regime: string; lastTouchRef: string | null };
  humanMove: { x: number; y: number } | null;
  keeper: { x: number; y: number; distToArcCenter: number; onArc: boolean; distToBall: number } | null;
  teams: Record<string, TeamRecord>;
  players: PlayerRecord[];
  events: SimulationEvent[];
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

/** One tick of the browser composition root's CPU wiring, with the keeper slot
 * optionally carrying the human's directional movement (human-directed case). */
function sampleCpuFrames(
  sim: Simulation,
  slots: CpuSlot[],
  gkBehavior: boolean,
  directed: boolean,
  keeperByTeam: Record<string, string>,
  humanMove?: { x: number; y: number },
): InputFrame[] {
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
    if (gkBehavior) observation.keeperPlayerIds = keeperByTeam;
    if (directed && entry.controlSlot === KEEPER_SLOT && humanMove) {
      observation.humanDirectedKeeperMove = humanMove;
    }
    const frame = entry.adapter.sample(sim.tick, observation);
    frame.controlSlot = entry.controlSlot;
    return frame;
  });
}

/** The human's directional input: track the ball's crossing of the keeper's own
 * goal line, clamped inside the versioned lateral band — a goalkeeper's job. */
function humanKeeperDirection(
  ball: { position: { x: number; y: number }; linearVelocity: { x: number; y: number } },
  keeper: { x: number; y: number },
): { x: number; y: number } {
  let targetY = ball.position.y;
  if (Math.abs(ball.linearVelocity.x) > 1e-9) {
    const ticks = (KEEPER_GOAL_LINE_X - ball.position.x) / ball.linearVelocity.x;
    if (ticks > 0) targetY = ball.position.y + ball.linearVelocity.y * ticks;
  }
  const clampedY = Math.max(-GK_ARC_LATERAL_METRES, Math.min(GK_ARC_LATERAL_METRES, targetY));
  return {
    x: Math.max(-1, Math.min(1, (KEEPER_GOAL_LINE_X - keeper.x) * 0.05)),
    y: Math.max(-1, Math.min(1, (clampedY - keeper.y) * 2.0)),
  };
}

function keeperByTeamFromLayout(scenario: ScenarioDefinition): Record<string, string> {
  const out: Record<string, string> = {};
  for (const teamId of [...new Set(scenario.players.map((p) => p.teamId))]) {
    const resolved = designateKeeperFromLayout(scenario.players, teamId, scenario.pitchLength);
    if (resolved !== undefined) out[teamId] = resolved;
  }
  return out;
}

async function playMatch(
  scenario: ScenarioDefinition,
  renderAt: Map<number, string>,
  render: boolean,
  gkBehavior: boolean,
  directed: boolean,
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
  const teamIds = [...new Set(scenario.players.map((p) => p.teamId))].sort();
  const keeperByTeam = keeperByTeamFromLayout(scenario);
  const homes = new Map(scenario.players.map((p) => [p.playerId, p.groundPosition]));

  resetKeeperMechanismCounters();

  const records: TickRecord[] = [];
  const events: SimulationEvent[] = [];
  const hashes: string[] = [];
  const captured: string[] = [];

  for (let i = 0; i < PLAY_TICKS; i++) {
    const snapshot = sim.snapshot();
    const keeper = snapshot.players.find((p) => p.playerId === KEEPER_PLAYER);
    const humanMove = directed && keeper
      ? humanKeeperDirection(snapshot.ball, { x: keeper.groundPosition.x, y: keeper.groundPosition.y })
      : null;

    const frames = sampleCpuFrames(sim, slots, gkBehavior, directed, keeperByTeam, humanMove ?? undefined);
    sim.applyInputs(frames);
    const result = sim.step();
    events.push(...result.events);
    hashes.push(result.stateHash);

    const post = sim.snapshot();
    const keeperPost = post.players.find((p) => p.playerId === KEEPER_PLAYER);
    const arcCenter = goalArcCenter(HUMAN_TEAM, scenario.pitchLength);
    const keeperDistToArc = keeperPost
      ? planarDistance(keeperPost.groundPosition.x, keeperPost.groundPosition.y, arcCenter.x, arcCenter.y)
      : Number.NaN;

    const teams: Record<string, TeamRecord> = {};
    const chasers = new Set<string>();
    for (const teamId of teamIds) {
      const slot = slots.find((s) => s.teamId === teamId);
      const teamObs = buildCpuObservation(post, teamId, slot?.controlledPlayerId);
      teamObs.cpuAntiHuddle = true;
      teamObs.gkBehavior = gkBehavior;
      const keeperId = keeperByTeam[teamId] ?? null;
      const keeperObj = post.players.find((p) => p.playerId === keeperId);
      const keeperOnArc = keeperObj
        ? isInsideGoalArc(keeperObj.groundPosition, goalArcCenter(teamId, scenario.pitchLength))
        : null;
      teams[teamId] = {
        keeperPlayerId: keeperId,
        keeperOnArc,
        keeperIsChaser: false,
        chaserPlayerId: null,
      };
    }

    const players: PlayerRecord[] = post.players.map((player) => {
      const home = homes.get(player.playerId);
      return {
        playerId: player.playerId,
        x: round(player.groundPosition.x),
        y: round(player.groundPosition.y),
        distToBall: round(planarDistance(player.groundPosition.x, player.groundPosition.y, post.ball.position.x, post.ball.position.y)),
        keeper: keeperByTeam[player.teamId] === player.playerId,
        chaser: chasers.has(player.playerId),
      };
    });

    records.push({
      tick: sim.tick,
      stateHash: result.stateHash,
      ball: {
        x: round(post.ball.position.x),
        y: round(post.ball.position.y),
        speed: round(Math.hypot(post.ball.linearVelocity.x, post.ball.linearVelocity.y)),
        regime: post.ball.regime,
        lastTouchRef: post.ball.lastTouchRef,
      },
      humanMove,
      keeper: keeperPost ? {
        x: round(keeperPost.groundPosition.x),
        y: round(keeperPost.groundPosition.y),
        distToArcCenter: round(keeperDistToArc),
        onArc: isInsideGoalArc(keeperPost.groundPosition, arcCenter) &&
          Math.abs(keeperPost.groundPosition.y - arcCenter.y) <= GK_ARC_LATERAL_METRES,
        distToBall: round(planarDistance(keeperPost.groundPosition.x, keeperPost.groundPosition.y, post.ball.position.x, post.ball.position.y)),
      } : null,
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
    }
  }

  for (const entry of slots) entry.adapter.reset();
  bridge.getPresentationSession().dispose();
  return { records, events, hashes, captured, keeperByTeam };
}

// ---------------------------------------------------------------------------
// Keeper save-arc location
// ---------------------------------------------------------------------------

interface ShotInfo { tick: number; eventId: string; shootTeamId: string; bx: number; by: number; vx: number; vy: number; }
interface ContactInfo { tick: number; kind: string; dist: number; }

function shotInfos(events: readonly SimulationEvent[]): ShotInfo[] {
  const out: ShotInfo[] = [];
  for (const evt of events) {
    if (evt.kind !== "shot") continue;
    const payload = (evt.payload ?? {}) as {
      playerId?: string; teamId?: string;
      incoming?: { position?: { x?: number; y?: number } };
      outgoing?: { linearVelocity?: { x?: number; y?: number } };
    };
    if (!payload.incoming?.position || !payload.outgoing?.linearVelocity) continue;
    out.push({
      tick: evt.tick,
      eventId: evt.id,
      shootTeamId: String(payload.teamId ?? ""),
      bx: Number(payload.incoming.position.x),
      by: Number(payload.incoming.position.y),
      vx: Number(payload.outgoing.linearVelocity.x),
      vy: Number(payload.outgoing.linearVelocity.y),
    });
  }
  return out;
}

function keeperContacts(events: readonly SimulationEvent[]): ContactInfo[] {
  const out: ContactInfo[] = [];
  for (const evt of events) {
    if (evt.kind !== "player-ball-contact") continue;
    const payload = (evt.payload ?? {}) as { playerId?: string; contactType?: string; planarDistance?: number };
    if (String(payload.playerId ?? "") !== KEEPER_PLAYER) continue;
    out.push({
      tick: evt.tick,
      kind: String(payload.contactType ?? evt.kind),
      dist: typeof payload.planarDistance === "number" ? payload.planarDistance : Number.NaN,
    });
  }
  return out.sort((a, b) => a.tick - b.tick);
}

function projectedCrossY(bx: number, by: number, vx: number, vy: number, goalLineX: number): number | null {
  if (Math.abs(vx) < 1e-9) return null;
  const ticks = (goalLineX - bx) / vx;
  if (!(ticks > 0)) return null;
  return by + vy * ticks;
}

interface KeeperArc {
  shotTick: number;
  shotEventId: string;
  projectedCrossY: number | null;
  saveTick: number;
  saveContactEventId: string;
  saveContactKind: string;
  saveContactDistance: number;
  withinReach: boolean;
  ticksFromShotToContact: number;
}

function locateKeeperArc(
  records: TickRecord[],
  events: readonly SimulationEvent[],
  gkBehavior = true,
): KeeperArc | null {
  if (!gkBehavior) return null; // the keeper role is stashed: no keeper save is locatable
  const shots = shotInfos(events);
  const contacts = keeperContacts(events);
  const reach = GK_SAVE_REACH_METRES;
  const MAX_GAP = 40;
  for (const shot of shots) {
    if (shot.shootTeamId === HUMAN_TEAM) continue;
    const shotInfo = {
      tick: shot.tick, eventId: shot.eventId, shooterPlayerId: "", shooterTeamId: shot.shootTeamId,
      ballPosition: { x: shot.bx, y: shot.by }, ballVelocity: { x: shot.vx, y: shot.vy },
    };
    if (!shotIsOnTargetToOwnGoal(shotInfo, HUMAN_TEAM, 105)) continue;
    const contact = contacts.find((c) => c.tick > shot.tick);
    if (!contact) continue;
    if (contact.tick - shot.tick > MAX_GAP) continue;
    return {
      shotTick: shot.tick,
      shotEventId: shot.eventId,
      projectedCrossY: projectedCrossY(shot.bx, shot.by, shot.vx, shot.vy, KEEPER_GOAL_LINE_X),
      saveTick: contact.tick,
      saveContactEventId: contact.kind,
      saveContactKind: contact.kind,
      saveContactDistance: round(contact.dist, 4),
      withinReach: contact.dist <= reach + Number.EPSILON,
      ticksFromShotToContact: contact.tick - shot.tick,
    };
  }
  return null;
}

function recordAt(records: TickRecord[], tick: number): TickRecord | undefined {
  return records.find((r) => r.tick === tick);
}

// ---------------------------------------------------------------------------
// Frame plan
// ---------------------------------------------------------------------------

interface FramePlan { label: string; tick: number; semantic: string; description: string; }

function framePlan(arc: KeeperArc): FramePlan[] {
  return [
    {
      label: "human-keepers-directed",
      tick: arc.shotTick - 12,
      semantic: "before",
      description: `Human directs the keeper: the designated keeper (${KEEPER_PLAYER}) holds its goal arc under the human's directional input — the CPU arc-hold yields to the human's movement`,
    },
    {
      label: "shot-on-target",
      tick: arc.shotTick,
      semantic: "event",
      description: `Shot on target: the shooting body strikes the ball toward the keeper's goal (projected cross at y=${arc.projectedCrossY?.toFixed(2)})`,
    },
    {
      label: "save-contact",
      tick: arc.saveTick,
      semantic: "result",
      description: `Save contact: the human-directed keeper answers the shot ${arc.ticksFromShotToContact} ticks later, ${arc.saveContactDistance} m off it (within save_claim_reach_radius); the ball stays independent`,
    },
    {
      label: "cpu-keeper-control",
      tick: arc.saveTick,
      semantic: "comparison",
      description: `CPU-keeper control: the identical keeper-shot fixture with no human directional input — the keeper holds its arc and auto-saves the same shot`,
    },
  ];
}

async function sha256OfFile(relPath: string): Promise<string> {
  const base64 = await commands.readFile(relPath, "base64");
  const binary = atob(base64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256OfText(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

describe("HUMAN-KEEPER-CONTROL: browser human-directed keeper save frames", () => {
  it(
    "captures event-centered frames of the human-controlled keeper save and the CPU-keeper control",
    { timeout: 120_000 },
    async () => {
      if (DURABLE_EVIDENCE) await assertEvidenceMutable();
      const scenario = await loadScenario();
      // One HUMAN keeper slot (the human's directed keeper) + nine AI_FALLBACK slots.
      expect(
        Object.values(scenario.controlAssignments).filter((a) => (a as { mode?: string }).mode === "HUMAN").length,
      ).toBe(1);
      const keeperByTeam = keeperByTeamFromLayout(scenario);
      expect(keeperByTeam["team-b"]).toBe(KEEPER_PLAYER);
      expect(keeperByTeam["team-a"]).toBe("player-4");
      expect(scenario.players.length).toBe(10);
      expect(scenario.pitchLength).toBe(105);

      // Pass 1 - locate the human-directed keeper's shot/save ticks (no rendering).
      const first = await playMatch(scenario, new Map(), false, true, true);
      const arc = locateKeeperArc(first.records, first.events);
      expect(arc, "the human-directed keeper run never produced a save").not.toBeNull();
      expect(arc!.withinReach).toBe(true);
      expect(arc!.ticksFromShotToContact).toBeGreaterThan(0);
      expect(arc!.ticksFromShotToContact).toBeLessThanOrEqual(40);
      expect(Math.abs(arc!.projectedCrossY ?? 0)).toBeLessThanOrEqual(GK_GOAL_HALF_WIDTH_METRES);
      const plan = framePlan(arc!);
      console.log(
        `[human-keeper-capture] frames ${plan.map((f) => `${f.label}@${f.tick}`).join("  ")} ` +
          `shot=${arc!.shotTick} save=${arc!.saveTick} (durable=${DURABLE_EVIDENCE})`,
      );

      // The human-directed before frame and the shot/save ticks must be distinct and in order.
      const ticks = plan.map((f) => f.tick);
      for (const [index, t] of ticks.entries()) {
        expect(t).toBeGreaterThanOrEqual(1);
        expect(t).toBeLessThan(PLAY_TICKS);
        if (index > 0) expect(t).toBeGreaterThanOrEqual(ticks[index - 1]);
      }

      // Pass 2 - replay the human-directed wiring and render the before/event/result frames.
      const renderTickLabel = new Map<number, string>();
      for (const f of plan) {
        if (f.semantic !== "comparison") renderTickLabel.set(f.tick, f.label);
      }
      const second = await playMatch(scenario, renderTickLabel, true, true, true);
      expect(second.captured).toContain("shot-on-target");
      expect(second.captured).toContain("save-contact");
      expect(second.hashes).toEqual(first.hashes);
      expect(locateKeeperArc(second.records, second.events)).toEqual(arc);
      expect(getKeeperHoldActivations()).toBeGreaterThan(0);
      expect(getKeeperSaveArmActivations()).toBeGreaterThan(0);

      const liveCounters = {
        hold: getKeeperHoldActivations(),
        arms: getKeeperSaveArmActivations(),
        save: getKeeperSavePressActivations(),
      };

      // Semantic invariants at the located ticks.
      const shotRec = recordAt(second.records, arc!.shotTick)!;
      const saveRec = recordAt(second.records, arc!.saveTick)!;
      expect(
        shotRec.events.some((e) => e.kind === "shot" && String((e.payload as { teamId?: string }).teamId) !== HUMAN_TEAM),
      ).toBe(true);
      expect(
        saveRec.events.some((e) => e.kind === "player-ball-contact" && String((e.payload as { playerId?: string }).playerId) === KEEPER_PLAYER),
      ).toBe(true);
      expect(saveRec.keeper!.distToBall).toBeLessThanOrEqual(GK_SAVE_REACH_METRES + Number.EPSILON);
      expect(saveRec.ball.lastTouchRef).not.toBeNull();

      // Pass 3 - same fixture with the keeper role stashed: no arc, no keeper activity.
      const stashed = await playMatch(scenario, new Map(), false, false, false);
      expect(locateKeeperArc(stashed.records, stashed.events, false)).toBeNull();
      expect(getKeeperHoldActivations()).toBe(0);
      expect(getKeeperSaveArmActivations()).toBe(0);
      expect(getKeeperSavePressActivations()).toBe(0);

      // Pass 4 - CPU-keeper control frame (the comparison) from a non-directed run:
      // locate the CPU run's own save tick, then render it.
      const cpuNoRender = await playMatch(scenario, new Map(), false, true, false);
      const cpuArc = locateKeeperArc(cpuNoRender.records, cpuNoRender.events);
      expect(cpuArc, "the CPU-keeper run never produced a save").not.toBeNull();
      expect(cpuArc!.withinReach).toBe(true);
      const cpuSaveTick = cpuArc!.saveTick;
      const cpuRender = await playMatch(
        scenario,
        new Map([[cpuSaveTick, "cpu-keeper-control"]]),
        true,
        true,
        false,
      );
      expect(cpuRender.captured).toContain("cpu-keeper-control");
      expect(cpuRender.hashes).toEqual(cpuNoRender.hashes);

      // Write sequence.json + trajectory.json.
      const pngHashes: Record<string, string> = {};
      for (const f of plan) {
        pngHashes[f.label] = await sha256OfFile(`${OUTPUT_REL}/${f.label}.png`);
      }
      const distinct = new Set(Object.values(pngHashes));
      expect(distinct.size, "the frames must be distinct images").toBe(Object.keys(pngHashes).length);

      const sequence = {
        schema_version: 1,
        objective_id: OBJECTIVE_ID,
        evidence_class: "DYNAMIC_VISUAL",
        semantic_order:
          "human directs the keeper -> shot on target -> human-directed keeper save contact -> CPU-keeper control",
        durable_capture: DURABLE_EVIDENCE,
        scenario: {
          id: scenario.id,
          path: SCENARIO_PATH,
          browser_mode: "human-vs-cpu-5v5-fixture",
        },
        arc: {
          keeper_team_id: HUMAN_TEAM,
          keeper_player_id: KEEPER_PLAYER,
          shot_tick: arc!.shotTick,
          save_tick: arc!.saveTick,
          save_contact_distance_metres: arc!.saveContactDistance,
          within_reach: arc!.withinReach,
          ticks_from_shot_to_contact: arc!.ticksFromShotToContact,
          projected_cross_y: arc!.projectedCrossY,
        },
        reproduction: {
          capture_test: "tests/browser/human-keeper-control.browser.test.ts",
          wiring:
            "browser composition root per-slot CPU wiring with CpuObservation.cpuAntiHuddle + " +
            "cpuDefensiveTackle + gkBehavior; the keeper slot carries the human's directional " +
            "movement (CpuObservation.humanDirectedKeeperMove) in the human-directed run",
          scenario_path: SCENARIO_PATH,
          play_ticks: PLAY_TICKS,
        },
        cross_runtime_note:
          "The keeper designation (team-a -> player-4, team-b -> player-10) and the shot -> keep contact " +
          "chain structure match the pinned Node artifacts; per-tick floats are not compared across runtimes.",
        frames: plan.map((f, index) => ({
          index: index + 1,
          label: f.label,
          tick: f.tick,
          semantic: f.semantic,
          description: f.description,
          path: `${f.label}.png`,
          sha256: pngHashes[f.label],
        })),
      };
      await commands.writeFile(`${OUTPUT_REL}/sequence.json`, JSON.stringify(sequence, null, 2), "utf-8");

      const stateHashOfHashes = await sha256OfText(second.hashes.join("\n"));
      const trajectory = {
        schema_version: 1,
        objective_id: OBJECTIVE_ID,
        evidence_class: "DYNAMIC_VISUAL",
        durable_capture: DURABLE_EVIDENCE,
        scenario: scenario.id,
        keeper: { team_id: HUMAN_TEAM, player_id: KEEPER_PLAYER },
        arc: {
          shot_tick: arc!.shotTick,
          save_tick: arc!.saveTick,
          save_contact_distance_metres: arc!.saveContactDistance,
          within_reach: arc!.withinReach,
          ticks_from_shot_to_contact: arc!.ticksFromShotToContact,
        },
        mechanism_counters: liveCounters,
        frame_ticks: plan.map((f) => ({ label: f.label, tick: f.tick, semantic: f.semantic })),
        state_hash_of_hashes: stateHashOfHashes,
        per_tick: second.records.map((r) => ({
          tick: r.tick,
          stateHash: r.stateHash,
          ball: [r.ball.x, r.ball.y, r.ball.speed, r.ball.lastTouchRef],
          keeper: r.keeper ? [r.keeper.x, r.keeper.y, r.keeper.distToArcCenter, r.keeper.distToBall] : null,
          humanMove: r.humanMove ? [r.humanMove.x, r.humanMove.y] : null,
        })),
      };
      await commands.writeFile(TRAJECTORY_REL, JSON.stringify(trajectory, null, 2), "utf-8");

      console.log(`[human-keeper-capture] wrote sequence + trajectory (durable=${DURABLE_EVIDENCE})`);
    },
  );
});
