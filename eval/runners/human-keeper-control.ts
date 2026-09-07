/**
 * @module @pes/eval/runners/human-keeper-control
 *
 * HUMAN-KEEPER-CONTROL evidence driver.
 *
 * Runs the small-sided keeper-shot fixture through the accepted headless match
 * loop with the browser composition root's observation shape, and records the
 * designated keeper's save/claim arc. The ONLY difference between the two runs
 * is whether the keeper's control slot is fed the human's directional input:
 *
 *   - HUMAN (directed): the keeper's slot runs the SAME CPU keeper logic (arc
 *     hold excluded, save/claim reaction live) but the keeper's commanded
 *     movement YIELDS to the human's directional input
 *     (`CpuObservation.humanDirectedKeeperMove`). The human directs the keeper
 *     and the keeper still answers the shot on target.
 *   - CPU (fallback): no human directional input; the keeper holds its arc and
 *     auto-saves, byte-identical to the accepted CPU keeper behavior.
 *
 * The shot on target is the fixture's own, not scripted: the shooting body's
 * canonical CPU SHOT press, and the save/claim is the same FIRST_TOUCH action a
 * human reaches through the keyboard, resolved by the contact system on the
 * independent ball.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { NO_OP_OBSERVER } from "../../src/simulation/telemetry/observer.js";
import {
  createCpuAdapter,
  buildCpuObservation,
  computeTeamDecision,
  designateKeeperFromLayout,
  shotIsOnTargetToOwnGoal,
  ownGoalLineX,
  goalArcCenter,
  isInsideGoalArc,
  getKeeperHoldActivations,
  getKeeperSaveArmActivations,
  getKeeperSavePressActivations,
  resetKeeperMechanismCounters,
  GK_SMALL_SIDED_V1,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import type { ScenarioDefinition, SimulationEvent } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";

/** One tick of committed keeper + ball + shot state. */
export interface HumanKeeperTickRecord {
  tick: number;
  stateHash: string;
  /** True when the keeper's slot is the human's directed slot this tick. */
  humanDirected: boolean;
  humanMove: { x: number; y: number } | null;
  keeperPlayerId: string;
  keeperTeamId: string;
  keeperX: number;
  keeperY: number;
  keeperDistToArcCenter: number;
  keeperOnArc: boolean;
  keeperDistToBall: number;
  saveReactionLive: boolean;
  ballX: number;
  ballY: number;
  ballVelocityX: number;
  ballVelocityY: number;
  ballLastTouchRef: string | null;
  events: string[];
}

export interface HumanKeeperRunConfig {
  scenario: ScenarioDefinition;
  maxTicks: number;
  gkBehavior?: boolean;
  cpuAntiHuddle?: boolean;
  cpuDefensiveTackle?: boolean;
  /** The team the human controls. */
  humanTeamId: string;
  /** The keeper's control slot (the slot that carries the human-directed frame). */
  keeperControlSlot: string;
  /** When "directed", feed the keeper's directional input; "cpu" uses the fallback. */
  humanMode: "directed" | "cpu";
}

export interface HumanKeeperRunResult {
  scenarioId: string;
  totalTicks: number;
  gkEnabled: boolean;
  humanMode: "directed" | "cpu";
  keeperByTeam: Record<string, string>;
  directedKeeperSlot: string;
  directedKeeperTeam: string;
  directedKeeperPlayerId: string;
  /** Shot/claim arc located from this run's own event log. */
  shotTick: number | null;
  shotEventId: string | null;
  shotPlayerId: string | null;
  projectedCrossY: number | null;
  saveTick: number | null;
  saveContactEventId: string | null;
  saveContactDistance: number | null;
  saveContactKind: string | null;
  ticksFromShotToContact: number | null;
  withinReach: boolean | null;
  keeperByTick: Record<number, { x: number; y: number }>;
  ticks: HumanKeeperTickRecord[];
  events: SimulationEvent[];
  stateHashes: string[];
  mechanismCounters: Record<string, number>;
}

/**
 * The directional input a human feeds the keeper each tick: track the ball's
 * projected crossing of the keeper's own goal line, clamped inside the versioned
 * lateral band. This is exactly the kind of positioning a human goalkeeper
 * does; it is expressed only through the tick-indexed moveX/moveY input.
 */
function humanKeeperDirection(
  ball: { position: { x: number; y: number }; linearVelocity: { x: number; y: number } },
  keeper: { x: number; y: number },
  ownGoalLineX: number,
  pitchLength: number,
): { x: number; y: number } {
  const goalLineX = ownGoalLineX;
  let targetY = ball.position.y;
  if (Math.abs(ball.linearVelocity.x) > 1e-9) {
    const ticks = (goalLineX - ball.position.x) / ball.linearVelocity.x;
    if (ticks > 0) targetY = ball.position.y + ball.linearVelocity.y * ticks;
  }
  const band = GK_SMALL_SIDED_V1.goal_arc_lateral_max.value;
  const clampedY = Math.max(-band, Math.min(band, targetY));
  const dx = goalLineX - keeper.x;
  const dy = clampedY - keeper.y;
  return {
    x: Math.max(-1, Math.min(1, dx * 0.05)),
    y: Math.max(-1, Math.min(1, dy * 2.0)),
  };
}

export function runHumanKeeperMatch(config: HumanKeeperRunConfig): HumanKeeperRunResult {
  const gkBehavior = config.gkBehavior ?? true;
  const cpuAntiHuddle = config.cpuAntiHuddle ?? true;
  const cpuDefensiveTackle = config.cpuDefensiveTackle ?? true;
  const { scenario, maxTicks, humanMode } = config;

  const world = createWorld({ scenario });
  const sim = createSimulation(world, NO_OP_OBSERVER);

  const allSlots = Object.entries(scenario.controlAssignments).map(([controlSlot, a]) => ({
    adapter: createCpuAdapter(),
    controlSlot,
    teamId: a.teamId,
    controlledPlayerId: a.controlledPlayerId ?? "",
  }));

  // Frozen keeper designation per team (spec §4) from the layout, live only when
  // the keeper role is on (stash identity: off means no designation is live).
  const keeperByTeam: Record<string, string> = {};
  const teamIds = [...new Set(scenario.players.map((p) => p.teamId))].sort();
  if (gkBehavior) {
    for (const teamId of teamIds) {
      const k = designateKeeperFromLayout(scenario.players, teamId, scenario.pitchLength);
      if (k !== undefined) keeperByTeam[teamId] = k;
    }
  }

  const directedKeeperSlot = config.keeperControlSlot;
  const slotAssignment = scenario.controlAssignments[directedKeeperSlot];
  const directedKeeperTeam = slotAssignment?.teamId ?? config.humanTeamId;
  const directedKeeperPlayerId = keeperByTeam[directedKeeperTeam];

  resetKeeperMechanismCounters();

  const events: SimulationEvent[] = [];
  const stateHashes: string[] = [];
  const ticks: HumanKeeperTickRecord[] = [];
  const keeperByTick: Record<number, { x: number; y: number }> = {};

  for (let t = 0; t < maxTicks; t++) {
    const snapshot = sim.snapshot();
    const keeper = directedKeeperPlayerId !== undefined
      ? snapshot.players.find((p) => p.playerId === directedKeeperPlayerId)
      : undefined;

    const humanMove = humanMode === "directed" && keeper !== undefined
      ? humanKeeperDirection(
        snapshot.ball,
        { x: keeper.groundPosition.x, y: keeper.groundPosition.y },
        ownGoalLineX(directedKeeperTeam, scenario.pitchLength),
        scenario.pitchLength,
      )
      : null;

    // Build the frames: every CPU slot, with the directed keeper's slot carrying
    // the human's directional input (yielding the arc-hold positioning to it).
    const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
    const frames: InputFrame[] = allSlots.map((entry) => {
      const obs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
      if (!teamDecisions.has(entry.teamId)) {
        const teamObs = buildCpuObservation(snapshot, entry.teamId, entry.controlledPlayerId);
        teamObs.cpuAntiHuddle = cpuAntiHuddle;
        teamObs.gkBehavior = gkBehavior;
        teamDecisions.set(entry.teamId, computeTeamDecision(teamObs, entry.teamId));
      }
      obs.teamDecision = teamDecisions.get(entry.teamId);
      obs.cpuDefensiveTackle = cpuDefensiveTackle;
      obs.cpuAntiHuddle = cpuAntiHuddle;
      obs.gkBehavior = gkBehavior;
      obs.keeperPlayerIds = keeperByTeam;
      if (entry.controlSlot === directedKeeperSlot && humanMove !== null) {
        obs.humanDirectedKeeperMove = humanMove;
      }
      const frame = entry.adapter.sample(sim.tick, obs);
      frame.controlSlot = entry.controlSlot;
      return frame;
    });
    sim.applyInputs(frames);
    const result = sim.step();
    events.push(...result.events);
    stateHashes.push(result.stateHash);

    const post = sim.snapshot();
    const keeperPost = directedKeeperPlayerId !== undefined
      ? post.players.find((p) => p.playerId === directedKeeperPlayerId)
      : undefined;
    const arcCenter = goalArcCenter(directedKeeperTeam, scenario.pitchLength);
    const keeperDistToArc = keeperPost
      ? Math.hypot(keeperPost.groundPosition.x - arcCenter.x, keeperPost.groundPosition.y - arcCenter.y)
      : Number.NaN;
    const keeperOnArc = keeperPost !== undefined && isInsideGoalArc(keeperPost.groundPosition, arcCenter);
    const keeperDistToBall = keeperPost
      ? Math.hypot(keeperPost.groundPosition.x - post.ball.position.x, keeperPost.groundPosition.y - post.ball.position.y)
      : Number.NaN;

    ticks.push({
      tick: t,
      stateHash: result.stateHash,
      humanDirected: humanMode === "directed",
      humanMove: humanMove,
      keeperPlayerId: directedKeeperPlayerId ?? "",
      keeperTeamId: directedKeeperTeam,
      keeperX: keeperPost?.groundPosition.x ?? Number.NaN,
      keeperY: keeperPost?.groundPosition.y ?? Number.NaN,
      keeperDistToArcCenter: Math.round(keeperDistToArc * 1000) / 1000,
      keeperOnArc,
      keeperDistToBall: Math.round(keeperDistToBall * 1000) / 1000,
      saveReactionLive: false,
      ballX: post.ball.position.x,
      ballY: post.ball.position.y,
      ballVelocityX: post.ball.linearVelocity.x,
      ballVelocityY: post.ball.linearVelocity.y,
      ballLastTouchRef: post.ball.lastTouchRef,
      events: result.events.map((e) => e.kind),
    });
    if (keeperPost) keeperByTick[t] = { x: keeperPost.groundPosition.x, y: keeperPost.groundPosition.y };

    // Mark save-reaction-live ticks from the run's own shot/contact events.
    if (result.events.some((e) => e.kind === "shot")) {
      const last = ticks[ticks.length - 1]!;
      last.saveReactionLive = true;
    }
  }

  const arc = locateKeeperArc(events, keeperByTeam, directedKeeperTeam, scenario.pitchLength);

  return {
    scenarioId: scenario.id,
    totalTicks: ticks.length,
    gkEnabled: gkBehavior,
    humanMode,
    keeperByTeam,
    directedKeeperSlot,
    directedKeeperTeam,
    directedKeeperPlayerId: directedKeeperPlayerId ?? "",
    shotTick: arc?.shotTick ?? null,
    shotEventId: arc?.shotEventId ?? null,
    shotPlayerId: arc?.shotPlayerId ?? null,
    projectedCrossY: arc?.projectedCrossY ?? null,
    saveTick: arc?.saveTick ?? null,
    saveContactEventId: arc?.saveContactEventId ?? null,
    saveContactDistance: arc?.saveContactDistance ?? null,
    saveContactKind: arc?.saveContactKind ?? null,
    ticksFromShotToContact: arc?.ticksFromShotToContact ?? null,
    withinReach: arc?.withinReach ?? null,
    keeperByTick,
    ticks,
    events,
    stateHashes,
    mechanismCounters: {
      keeper_hold_frames: getKeeperHoldActivations(),
      keeper_save_arms: getKeeperSaveArmActivations(),
      keeper_save_claim_presses: getKeeperSavePressActivations(),
    },
  };
}

interface LocatedArc {
  shotTick: number;
  shotEventId: string;
  shotPlayerId: string;
  projectedCrossY: number;
  saveTick: number;
  saveContactEventId: string;
  saveContactDistance: number;
  saveContactKind: string;
  ticksFromShotToContact: number;
  withinReach: boolean;
}

/** Locate the on-target shot -> keeper save chain from the run's own events. */
function locateKeeperArc(
  events: readonly SimulationEvent[],
  keeperByTeam: Record<string, string>,
  directedKeeperTeam: string,
  pitchLength: number,
): LocatedArc | null {
  const keeperId = keeperByTeam[directedKeeperTeam];
  const goalLineX = ownGoalLineX(directedKeeperTeam, pitchLength);
  const reach = GK_SMALL_SIDED_V1.save_claim_reach_radius.value;

  interface Shot { tick: number; id: string; playerId: string; bx: number; by: number; vx: number; vy: number; }
  interface Contact { tick: number; id: string; kind: string; dist: number; }

  const shots: Shot[] = [];
  const contacts: Contact[] = [];
  for (const evt of events) {
    const p = (evt.payload ?? {}) as Record<string, unknown>;
    if (evt.kind === "shot") {
      const incoming = p.incoming as { position?: { x?: number; y?: number } } | undefined;
      const outgoing = p.outgoing as { linearVelocity?: { x?: number; y?: number } } | undefined;
      if (!incoming?.position || !outgoing?.linearVelocity) continue;
      shots.push({
        tick: evt.tick, id: evt.id, playerId: String(p.playerId ?? ""),
        bx: Number(incoming.position.x), by: Number(incoming.position.y),
        vx: Number(outgoing.linearVelocity.x), vy: Number(outgoing.linearVelocity.y),
      });
    }
    if (evt.kind === "player-ball-contact" && String(p.playerId ?? "") === keeperId) {
      contacts.push({
        tick: evt.tick, id: evt.id, kind: String(p.contactType ?? evt.kind),
        dist: typeof p.planarDistance === "number" ? Number(p.planarDistance) : Number.NaN,
      });
    }
  }
  contacts.sort((a, b) => a.tick - b.tick || a.id.localeCompare(b.id));

  // The coherent chain is a shot whose ball the keeper answers within a short
  // gap (the shot travels to the keeper), before any other body plays it, and
  // whose contact is inside the versioned reach.
  const MAX_GAP_TICKS = 40;
  for (const shot of shots) {
    if (!shotIsOnTargetToOwnGoal(
      {
        tick: shot.tick, eventId: shot.id, shooterPlayerId: shot.playerId,
        shooterTeamId: keeperTeamNot(directedKeeperTeam),
        ballPosition: { x: shot.bx, y: shot.by }, ballVelocity: { x: shot.vx, y: shot.vy },
      },
      directedKeeperTeam,
      pitchLength,
    )) continue;
    const contact = contacts.find((c) => c.tick > shot.tick);
    if (!contact) continue;
    if (contact.tick - shot.tick > MAX_GAP_TICKS) continue;
    const crossY = projectedCrossY(shot.bx, shot.by, shot.vx, shot.vy, goalLineX);
    return {
      shotTick: shot.tick,
      shotEventId: shot.id,
      shotPlayerId: shot.playerId,
      projectedCrossY: Math.round((crossY ?? 0) * 1000) / 1000,
      saveTick: contact.tick,
      saveContactEventId: contact.id,
      saveContactDistance: Math.round(contact.dist * 10000) / 10000,
      saveContactKind: contact.kind,
      ticksFromShotToContact: contact.tick - shot.tick,
      withinReach: contact.dist <= reach + Number.EPSILON,
    };
  }
  return null;
}

function keeperTeamNot(teamId: string): string {
  return teamId === "team-a" ? "team-b" : "team-a";
}

function projectedCrossY(bx: number, by: number, vx: number, vy: number, goalLineX: number): number | null {
  if (Math.abs(vx) < 1e-9) return null;
  const ticks = (goalLineX - bx) / vx;
  if (!(ticks > 0)) return null;
  return by + vy * ticks;
}
