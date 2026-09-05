/**
 * @module @pes/eval/runners/gk-match
 *
 * GK-5V5-ADAPTER-BEHAVIOR evidence driver.
 *
 * Runs a coherent 5v5 CPU-vs-CPU small-sided match through the accepted headless
 * match runner with the browser composition root's observation shape (the
 * runner's `browserParityObservations` switch) and one adapter-layer switch more
 * — `gkBehavior` — then reads the designated-keeper arc back out of the
 * committed tick stream:
 *
 *   • per-tick committed geometry for every body, with the designated keeper
 *     labelled and measured against its own goal arc (arc centre, signed lateral
 *     drift, distance to that centre, on-arc or not) and against the arc point
 *     the production positioning rule commands for that tick;
 *   • the per-tick chase assignment the team-decision layer actually issued
 *     (one chaser, one cover, one restart taker), so "the keeper was never the
 *     chaser/presser" is a read of the production assignment rather than a
 *     restatement of intent;
 *   • every canonical shot on target at a keeper's own goal, and the recorded
 *     ball contact that answered it — with the shot tick, the contact tick, the
 *     gap between them, and the planar distance the core recorded for that
 *     contact against the versioned reach;
 *   • the pass / touch / goal events and ball travel the match produced anyway,
 *     so the run is checkable as a match and not only as a keeper trace.
 *
 * Everything recorded about the keeper comes from the same exported production
 * functions the adapters act on (`resolveKeeperPlayerId`, `designatePresser`,
 * `assignChaseRoles`, `computeTeamDecision`, `latestOnTargetShotAgainst`,
 * `shotIsOnTargetToOwnGoal`, `keeperStationTarget`, `goalArcCenter`), evaluated
 * over that tick's committed geometry, so evidence and behavior share one
 * implementation. A record is what the adapters read when building the frames
 * consumed on the following tick — the pre-step state of that following tick.
 *
 * Nothing here drives a touch, a pass, a shot or a save: the only inputs are the
 * CPU adapters' own tick-indexed frames.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { runHeadlessMatch } from "./headless-match.js";
import {
  assignChaseRoles,
  computeTeamDecision,
  resolveKeeperPlayerId,
  SHOT_EVENT_WINDOW_TICKS,
  type CpuObservation,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import {
  GK_SMALL_SIDED_V1,
  designateKeeperFromLayout,
  distanceToArcCenter,
  goalArcCenter,
  isApproachingGoalLine,
  advanceKeeperReaction,
  isInsideGoalArc,
  keeperStationTarget,
  lateralDriftMetres,
  ownGoalLineX,
  shotIsOnTargetToOwnGoal,
  KEEPER_REACTION_IDLE,
  type KeeperReactionState,
  type KeeperShotInfo,
} from "../../src/adapters/input-browser/goalkeeper-role.js";
import {
  FOUNDATION_CONTACT_V1,
  FOUNDATION_LOCOMOTION_V1,
} from "../../src/simulation/config/foundation.js";
import {
  FIRST_TOUCH_BIT,
  PASS_BIT,
  SHOT_BIT,
  SLIDE_TACKLE_BIT,
  STANDING_TACKLE_BIT,
} from "../../src/contracts/input.js";
import type { ScenarioDefinition, SimulationEvent } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One body's committed geometry for one tick. */
export interface GkPlayerRecord {
  playerId: string;
  teamId: string;
  formationRole: string;
  x: number;
  y: number;
  /** Planar speed (m/s) of the body this tick. */
  speed: number;
  /** Metres from this body to the ball. */
  distToBall: number;
  /** Metres from this body to its fixed kickoff home. */
  distToHome: number;
  /** True when this body is its team's designated keeper (spec §4). */
  keeper: boolean;
  /** True when this body is its team's designated chaser/presser this tick. */
  designatedChaser: boolean;
  /** True when this body is its team's designated cover this tick. */
  designatedCover: boolean;
  /** Button names the CPU frame consumed on the next tick pressed for this body. */
  pressed: string[];
}

/** One team's committed keeper + chase state for one tick. */
export interface GkTeamRecord {
  /** The designated keeper this team is playing with (null when stashed). */
  keeperPlayerId: string | null;
  /** Arc centre: goal-line centre plus the versioned longitudinal offset. */
  arcCenter: { x: number; y: number } | null;
  /** The commanded arc point for that keeper this tick (production function). */
  station: { x: number; y: number } | null;
  /** Keeper's signed lateral drift from the arc centre, along the goal line. */
  lateralDrift: number | null;
  /** Metres from the keeper to the arc centre. */
  distToArcCenter: number | null;
  /** Whether the committed keeper position is inside the versioned arc disk. */
  onGoalArc: boolean | null;
  /** Whether the keeper has taken station on its arc yet this run. */
  onStation: boolean;
  /** A canonical on-target shot at this goal is the live ball this tick. */
  saveReactionLive: boolean;
  /** Tick the live shot on target landed, if any. */
  saveShotTick: number | null;
  /** Ticks elapsed since that shot landed. */
  ticksSinceShot: number | null;
  /** The team's single designated chaser/presser. */
  chaserPlayerId: string | null;
  chaserDistance: number | null;
  /** The team's single designated cover body. */
  coverPlayerId: string | null;
  /** The body allowed to take an untouched restart ball this tick. */
  restartTakerId: string | null;
  strategy: string;
  defensiveSubMode: string;
  tacklePlayerId: string | null;
  tackleWithheld: string;
  /** Bodies of this team inside the clump radius of the ball this tick. */
  playersWithinClumpRadius: number;
}

export interface GkTickRecord {
  tick: number;
  stateHash: string;
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    regime: string;
    lastTouchRef: string | null;
  };
  eventKinds: string[];
  players: GkPlayerRecord[];
  teams: Record<string, GkTeamRecord>;
}

/** One shot on target at a keeper's goal, and what answered it. */
export interface GkShotChainRecord {
  teamId: string;
  keeperPlayerId: string;
  /** Tick the canonical shot contact landed. */
  shotContactTick: number;
  /** Canonical event id of the shot — the ball reference it wrote. */
  shotEventId: string;
  shooterPlayerId: string;
  shooterTeamId: string;
  /** Where the shot projected onto this goal line, inside the versioned band? */
  projectedCrossY: number;
  /** Tick of the keeper's recorded contact that answered it, null if none. */
  keeperContactTick: number | null;
  keeperContactEventId: string | null;
  /** Contact type the core recorded for that contact. */
  contactKind: string | null;
  /** Ticks from shot contact to the keeper's contact, null if none. */
  ticksFromShotToContact: number | null;
  /** Metres player→ball the core recorded for that contact. */
  recordedContactDistance: number | null;
  /** Versioned reach that contact had to stay inside (metres). */
  reachLimitMetres: number;
  /** True when the keeper's contact is inside the versioned reach. */
  withinReach: boolean;
  /** True when a keeper contact answered this shot before any other body did. */
  saveOnShotOnTarget: boolean;
  /** Why no save answered it, when that is the case. */
  interruptedBy: string | null;
}

/** Per-keeper readout reduced over the whole run. */
export interface GkKeeperSummary {
  keeperPlayerId: string;
  ownGoalLineX: number;
  /** First tick the committed keeper geometry is inside its own goal arc. */
  stationTakenTick: number | null;
  /** Ticks from the first sample until the keeper is on its arc. */
  ticksToStation: number | null;
  /** Ticks with the keeper on the arc after it first got there. */
  onArcTicksAfterStation: number;
  /** Ticks after station where the keeper is off the arc. */
  offArcTicksAfterStation: number;
  /** Off-arc ticks after station coinciding with a body contact on the keeper. */
  offArcAfterStationWithBodyContact: number;
  /** Off-arc ticks after station with no body contact to attribute them to. */
  offArcAfterStationUnattributed: number;
  maxLateralDriftAfterStation: number;
  maxDistanceToArcCenterAfterStation: number;
  /**
   * Fastest committed keeper speed after station (m/s). Locomotion converges the
   * body toward its commanded target under the accepted acceleration/braking
   * limits, so the arrival from the transit onto the arc can briefly exceed the
   * in-arc command; reported, not asserted.
   */
  maxSpeedAfterStation: number;
  /** Fastest *commanded* keeper speed on in-arc ticks (m/s). */
  maxCommandedInArcSpeed: number;
  /** In-arc commanded ticks that broke `keeper_reposition_speed`. Must be 0. */
  commandedInArcSpeedBoundBreaches: number;
  /** In-arc repositioning cap the model declares (m/s). */
  repositionSpeedLimit: number;
  /** Ticks the keeper was its team's designated chaser/presser. Must be 0. */
  keeperDesignatedChaserTicks: number;
  /** Ticks the keeper was its team's designated cover. Must be 0. */
  keeperDesignatedCoverTicks: number;
  /** Ticks the keeper was the match's designated restart taker. Must be 0. */
  keeperDesignatedTakerTicks: number;
  /** Ticks the per-tick designation rule differs from the frozen assignment. */
  designationDriftTicks: number;
  /** Canonical shots on target this keeper faced. */
  shotsOnTargetFaced: number;
  /** Of those, the ones this keeper recorded a contact against. */
  savesOnShotsOnTarget: number;
  /** Recorded ball contacts by this keeper of any kind. */
  keeperBallContacts: Array<{
    tick: number;
    kind: string;
    contactType: string;
    recordedDistance: number | null;
  }>;
  shotChains: GkShotChainRecord[];
}

export interface GkRunSummary {
  ticks: number;
  goals: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  touches: number;
  passEvents: Array<{ tick: number; kind: string; playerId: string; teamId: string }>;
  touchEvents: Array<{ tick: number; kind: string; playerId: string }>;
  ballTravelMetres: number;
  ballDisplacementMetres: number;
  maxBodiesWithinClumpRadiusPerTeam: number;
  /** Ticks where at least one body of the match is a designated keeper. */
  ticksWithKeeperDesignation: number;
  /** Team-ticks with exactly one designated chaser and it is not the keeper. */
  teamTicksWithFieldChaser: number;
  /** Team-ticks carrying a keeper designation at all. */
  keeperTeamTicks: number;
  /** Team-ticks where the keeper was off its arc while chasing (never). */
  keeperChaseTeamTicks: number;
}

export interface GkMatchResult {
  scenarioId: string;
  totalTicks: number;
  /** True when the keeper role was live for this run (else the stash). */
  gkEnabled: boolean;
  /** Frozen keeper designation per team, as the wiring assigns it. */
  keeperByTeam: Record<string, string>;
  kickoffHomes: Record<string, { x: number; y: number }>;
  ticks: GkTickRecord[];
  events: SimulationEvent[];
  stateHashes: string[];
  keepers: Record<string, GkKeeperSummary>;
  summary: GkRunSummary;
}

export interface GkMatchConfig {
  scenario: ScenarioDefinition;
  maxTicks: number;
  /** Keeper-role kill switch. Default true; false restores HEAD behavior. */
  gkBehavior?: boolean;
  /** Anti-huddle shape. Default true (the accepted directed contract). */
  cpuAntiHuddle?: boolean;
  /** Give CPU slots the defensive tackle buttons. Default true. */
  cpuDefensiveTackle?: boolean;
  /** Headless lifecycle phase policy. Default "legacy" (the accepted pins). */
  lifecyclePhaseSync?: "legacy" | "core-owned";
  /** Planar radius (metres) at which same-team bodies count as one clump. */
  clumpRadiusMetres?: number;
}

// ---------------------------------------------------------------------------
// Constants and helpers
// ---------------------------------------------------------------------------

/** Planar radius (m) the contact system honours a touch inside. */
const CORE_TOUCH_RADIUS_METRES = FOUNDATION_CONTACT_V1.contactRadius.value;



/** Canonical events that mean "a body played the ball". */
const BALL_CONTACT_EVENT_KINDS = new Set([
  "player-ball-contact",
  "pass",
  "shot",
  "lofted-pass",
  "through-ball",
]);

const BIT_NAMES: Array<[number, string]> = [
  [FIRST_TOUCH_BIT, "first-touch"],
  [PASS_BIT, "pass"],
  [SHOT_BIT, "shot"],
  [STANDING_TACKLE_BIT, "standing-tackle"],
  [SLIDE_TACKLE_BIT, "slide-tackle"],
];

function planarDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function round(value: number, decimals = 3): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function pressedNames(frame: InputFrame | undefined): string[] {
  if (!frame) return [];
  return BIT_NAMES.filter(([bit]) => (frame.pressedButtons & bit) !== 0)
    .map(([, name]) => name);
}

/** Ball-played events, in tick order, with the fields the chain needs. */
interface ContactRecord {
  tick: number;
  eventId: string;
  kind: string;
  contactType: string;
  playerId: string;
  teamId: string;
  /** Metres player→ball the core recorded for this contact. */
  recordedDistance: number | null;
}

function contactRecords(events: readonly SimulationEvent[]): ContactRecord[] {
  const out: ContactRecord[] = [];
  for (const evt of events) {
    if (!BALL_CONTACT_EVENT_KINDS.has(evt.kind)) continue;
    const payload = evt.payload as {
      playerId?: string;
      teamId?: string;
      contactType?: string;
      planarDistance?: number;
    };
    if (typeof payload.playerId !== "string") continue;
    out.push({
      tick: evt.tick,
      eventId: evt.id,
      kind: evt.kind,
      contactType: String(payload.contactType ?? evt.kind),
      playerId: payload.playerId,
      teamId: String(payload.teamId ?? ""),
      recordedDistance: typeof payload.planarDistance === "number"
        ? round(payload.planarDistance, 4)
        : null,
    });
  }
  return out.sort((a, b) => a.tick - b.tick || a.eventId.localeCompare(b.eventId));
}

/** Rebuild the canonical shot facts a keeper may perceive. */
function shotInfos(events: readonly SimulationEvent[]): KeeperShotInfo[] {
  const out: KeeperShotInfo[] = [];
  for (const evt of events) {
    if (evt.kind !== "shot") continue;
    const payload = evt.payload as {
      playerId?: string;
      teamId?: string;
      incoming?: { position?: { x?: number; y?: number } };
      outgoing?: { linearVelocity?: { x?: number; y?: number } };
    };
    const position = payload.incoming?.position;
    const velocity = payload.outgoing?.linearVelocity;
    if (!position || !velocity) continue;
    out.push({
      tick: evt.tick,
      eventId: evt.id,
      shooterPlayerId: String(payload.playerId),
      shooterTeamId: String(payload.teamId),
      ballPosition: { x: Number(position.x), y: Number(position.y) },
      ballVelocity: { x: Number(velocity.x), y: Number(velocity.y) },
    });
  }
  return out;
}

/**
 * Rebuild the observation shape the production keeper functions consume from a
 * committed telemetry observation plus the scenario's static identity. Only
 * fields a CPU is already allowed to see are carried across.
 */
function observationFromTelemetry(
  observation: TelemetryObservation,
  identities: ReadonlyMap<string, {
    teamId: string;
    formationRole?: "defender" | "midfielder" | "attacker";
  }>,
  pitchLength: number,
  pitchWidth: number,
  recentShots: KeeperShotInfo[],
): CpuObservation {
  return {
    players: observation.players.map((p) => ({
      playerId: p.playerId,
      teamId: p.teamId,
      groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
      linearVelocity: { x: p.linearVelocity.x, y: p.linearVelocity.y },
      bodyHeading: p.bodyHeading,
      formationRole: identities.get(p.playerId)?.formationRole,
    })),
    ball: {
      position: {
        x: observation.ball.position.x,
        y: observation.ball.position.y,
        z: observation.ball.position.z,
      },
      linearVelocity: {
        x: observation.ball.linearVelocity.x,
        y: observation.ball.linearVelocity.y,
        z: observation.ball.linearVelocity.z,
      },
      regime: observation.ball.regime,
      lastTouchRef: observation.ball.lastTouchRef,
    },
    pitchLength,
    pitchWidth,
    keeperPlayerIds: undefined,
    recentShotEvents: recentShots,
  };
}

/**
 * Ticks a committed shot stays perceptible to a keeper: the window the
 * production observation extraction uses, imported rather than restated so
 * evidence and behavior see the same shots.
 */
const SHOT_PERCEPTION_WINDOW_TICKS = SHOT_EVENT_WINDOW_TICKS;

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

/**
 * Run one coherent CPU-vs-CPU match and record the designated-keeper arc from
 * the committed tick stream.
 */
export function runGkMatch(config: GkMatchConfig): GkMatchResult {
  const gkBehavior = config.gkBehavior ?? true;
  const cpuAntiHuddle = config.cpuAntiHuddle ?? true;
  const cpuDefensiveTackle = config.cpuDefensiveTackle ?? true;
  const clumpRadiusMetres = config.clumpRadiusMetres ?? 5;
  const { scenario } = config;

  const match = runHeadlessMatch({
    scenario,
    maxTicks: config.maxTicks,
    cpuAntiHuddle,
    cpuDefensiveTackle,
    gkBehavior,
    browserParityObservations: true,
    lifecyclePhaseSync: config.lifecyclePhaseSync ?? "legacy",
  });

  // ---- static identity, kickoff homes and the frozen designation ----
  const identities = new Map<string, {
    teamId: string;
    formationRole?: "defender" | "midfielder" | "attacker";
  }>();
  const kickoffHomes: Record<string, { x: number; y: number }> = {};
  const layout = scenario.players.map((p) => {
    const formationRole = (p as { formationRole?: "defender" | "midfielder" | "attacker" })
      .formationRole;
    identities.set(p.playerId, { teamId: p.teamId, formationRole });
    kickoffHomes[p.playerId] = { x: p.groundPosition.x, y: p.groundPosition.y };
    return {
      playerId: p.playerId,
      teamId: p.teamId,
      groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
      formationRole,
    };
  });
  const teamIds = [...new Set(scenario.players.map((p) => p.teamId))].sort();
  const keeperByTeam: Record<string, string> = {};
  if (gkBehavior) {
    for (const teamId of teamIds) {
      const keeperId = designateKeeperFromLayout(layout, teamId, scenario.pitchLength);
      if (keeperId !== undefined) keeperByTeam[teamId] = keeperId;
    }
  }

  const slotToPlayer = new Map<string, string>();
  for (const assignment of Object.values(scenario.controlAssignments)) {
    if (assignment.controlledPlayerId) {
      slotToPlayer.set(assignment.controlSlot, assignment.controlledPlayerId);
    }
  }

  const allShots = shotInfos(match.events);
  const allContacts = contactRecords(match.events);
  const eventsByTick = new Map<number, SimulationEvent[]>();
  for (const evt of match.events) {
    const bucket = eventsByTick.get(evt.tick);
    if (bucket) bucket.push(evt);
    else eventsByTick.set(evt.tick, [evt]);
  }

  // ---- per-keeper walkers ----
  interface KeeperWalk {
    summary: GkKeeperSummary;
    onStation: boolean;
    /** Whether the geometry the current tick's frame was resolved from was inside the arc. */
    commandedFromInsideArc: boolean;
  }
  const walks = new Map<string, KeeperWalk>();
  for (const teamId of teamIds) {
    const keeperPlayerId = keeperByTeam[teamId];
    if (keeperPlayerId === undefined) continue;
    walks.set(teamId, {
      onStation: false,
      commandedFromInsideArc: false,
      summary: {
        keeperPlayerId,
        ownGoalLineX: ownGoalLineX(teamId, scenario.pitchLength),
        stationTakenTick: null,
        ticksToStation: null,
        onArcTicksAfterStation: 0,
        offArcTicksAfterStation: 0,
        offArcAfterStationWithBodyContact: 0,
        offArcAfterStationUnattributed: 0,
        maxLateralDriftAfterStation: 0,
        maxDistanceToArcCenterAfterStation: 0,
        maxSpeedAfterStation: 0,
        maxCommandedInArcSpeed: 0,
        commandedInArcSpeedBoundBreaches: 0,
        repositionSpeedLimit: GK_SMALL_SIDED_V1.keeper_reposition_speed.value,
        keeperDesignatedChaserTicks: 0,
        keeperDesignatedCoverTicks: 0,
        keeperDesignatedTakerTicks: 0,
        designationDriftTicks: 0,
        shotsOnTargetFaced: 0,
        savesOnShotsOnTarget: 0,
        keeperBallContacts: [],
        shotChains: [],
      },
    });
  }

  // ---- per-tick records ----
  // Each team's save-reaction state advances through the same production rule the
  // adapters act on, so a recorded "the keeper was reacting here" tick and an
  // executed one cannot drift apart.
  const reactions = new Map<string, KeeperReactionState>();
  for (const teamId of teamIds) reactions.set(teamId, { ...KEEPER_REACTION_IDLE });

  const ticks: GkTickRecord[] = [];
  const goalsSoFar: Record<string, number> = {};
  let previousBall: { x: number; y: number } | null = null;
  let firstBall: { x: number; y: number } | null = null;
  let ballTravel = 0;
  let maxWithinClump = 0;
  let ticksWithKeeperDesignation = 0;
  let teamTicksWithFieldChaser = 0;
  let keeperTeamTicks = 0;
  let keeperChaseTeamTicks = 0;

  for (const observation of match.observations) {
    const tickNumber = observation.tick;
    const ballPos = { x: observation.ball.position.x, y: observation.ball.position.y };
    const ballVel = {
      x: observation.ball.linearVelocity.x,
      y: observation.ball.linearVelocity.y,
    };
    if (firstBall === null) firstBall = { ...ballPos };
    if (previousBall !== null) {
      ballTravel += planarDistance(previousBall.x, previousBall.y, ballPos.x, ballPos.y);
    }
    previousBall = { ...ballPos };

    const recentShots = allShots
      .filter((shot) =>
        shot.tick <= tickNumber && tickNumber - shot.tick <= SHOT_PERCEPTION_WINDOW_TICKS)
      .sort((a, b) => b.tick - a.tick || b.eventId.localeCompare(a.eventId));
    const tickEvents = eventsByTick.get(tickNumber) ?? [];
    const bodiesInContactThisTick = new Set<string>();
    for (const evt of tickEvents) {
      if (evt.kind !== "player-player-contact") continue;
      const payload = evt.payload as { playerId?: string; otherPlayerId?: string };
      if (typeof payload.playerId === "string") bodiesInContactThisTick.add(payload.playerId);
      if (typeof payload.otherPlayerId === "string") {
        bodiesInContactThisTick.add(payload.otherPlayerId);
      }
    }

    const baseObs = observationFromTelemetry(
      observation,
      identities,
      scenario.pitchLength,
      scenario.pitchWidth,
      recentShots,
    );
    const positionOf = (playerId: string | null | undefined) => {
      if (playerId === null || playerId === undefined) return undefined;
      const p = observation.players.find((pl) => pl.playerId === playerId);
      return p ? { x: p.groundPosition.x, y: p.groundPosition.y } : undefined;
    };

    /** Count one keeper-designation fact against that team's run-level readout. */
    const bumpKeeper = (
      teamId: string,
      field: "keeperDesignatedChaserTicks" | "keeperDesignatedCoverTicks" |
        "keeperDesignatedTakerTicks",
    ): void => {
      const walk = walks.get(teamId);
      if (walk !== undefined) walk.summary[field]++;
    };

    const teams: Record<string, GkTeamRecord> = {};
    let keeperThisTick = false;
    for (const teamId of teamIds) {
      const opponentTeamId = teamId === "team-a" ? "team-b" : "team-a";
      const teamObs: CpuObservation = {
        ...baseObs,
        cpuTeamId: teamId,
        gkBehavior,
        cpuAntiHuddle,
        keeperPlayerIds: gkBehavior ? keeperByTeam : undefined,
        scoreDifferential: (goalsSoFar[teamId] ?? 0) - (goalsSoFar[opponentTeamId] ?? 0),
      };
      const decision = computeTeamDecision(teamObs, teamId);
      teamObs.teamDecision = decision;
      const roles = assignChaseRoles(
        teamObs,
        teamId,
        observation.ball.lastTouchRef === null,
      );
      const keeperId = resolveKeeperPlayerId(teamObs, teamId) ?? null;
      const arcCenter = goalArcCenter(teamId, scenario.pitchLength);
      const keeperPosition = positionOf(keeperId);
      const reaction = gkBehavior
        ? advanceKeeperReaction(reactions.get(teamId) ?? KEEPER_REACTION_IDLE, {
          tick: tickNumber,
          teamId,
          pitchLength: scenario.pitchLength,
          recentShotEvents: recentShots,
          ballPosition: ballPos,
          ballVelocity: ballVel,
          lastTouchRef: observation.ball.lastTouchRef,
        })
        : null;
      if (reaction !== null) reactions.set(teamId, reaction.state);
      // Same signal the adapter acts on: the reaction is live while the shot ball
      // is still the shot ball, which outlasts the shot's perception window.
      const saveArmed = reaction !== null && reaction.state.shotTick !== null;
      const shotTick = reaction !== null ? reaction.state.shotTick : null;
      const station = keeperPosition !== undefined
        ? keeperStationTarget(teamId, scenario.pitchLength, ballPos, ballVel, saveArmed)
        : null;

      if (keeperId !== null) {
        keeperThisTick = true;
        keeperTeamTicks++;
        const walk = walks.get(teamId);
        if (walk && keeperPosition) {
          const onArc = isInsideGoalArc(keeperPosition, arcCenter);
          if (!walk.onStation && onArc) {
            walk.onStation = true;
            walk.summary.stationTakenTick = tickNumber;
            walk.summary.ticksToStation = tickNumber;
          }
          {
            // The model bounds what the keeper is *commanded* to run, and that
            // command is judged against the geometry it was built from: the frame
            // consumed on this tick was resolved from the previous committed tick,
            // so the in-arc test is applied to that tick's membership. The
            // committed velocity converges on the command under the accepted
            // acceleration/braking limits and is reported separately.
            const frame = observation.inputs.find(
              (candidate) => slotToPlayer.get(candidate.controlSlot) === keeperId,
            );
            if (frame !== undefined && walk.commandedFromInsideArc) {
              const commanded = Math.hypot(frame.moveX, frame.moveY) *
                FOUNDATION_LOCOMOTION_V1.maxSpeed.value;
              walk.summary.maxCommandedInArcSpeed = Math.max(
                walk.summary.maxCommandedInArcSpeed,
                commanded,
              );
              if (commanded > GK_SMALL_SIDED_V1.keeper_reposition_speed.value + 1e-9) {
                walk.summary.commandedInArcSpeedBoundBreaches++;
              }
            }
            walk.commandedFromInsideArc = onArc;
          }
          if (walk.onStation) {
            const body = observation.players.find((p) => p.playerId === keeperId)!;
            if (onArc) walk.summary.onArcTicksAfterStation++;
            else {
              walk.summary.offArcTicksAfterStation++;
              if (bodiesInContactThisTick.has(keeperId)) {
                walk.summary.offArcAfterStationWithBodyContact++;
              } else {
                walk.summary.offArcAfterStationUnattributed++;
              }
            }
            walk.summary.maxLateralDriftAfterStation = Math.max(
              walk.summary.maxLateralDriftAfterStation,
              Math.abs(lateralDriftMetres(keeperPosition, arcCenter)),
            );
            walk.summary.maxDistanceToArcCenterAfterStation = Math.max(
              walk.summary.maxDistanceToArcCenterAfterStation,
              distanceToArcCenter(keeperPosition, arcCenter),
            );
            walk.summary.maxSpeedAfterStation = Math.max(
              walk.summary.maxSpeedAfterStation,
              Math.hypot(body.linearVelocity.x, body.linearVelocity.y),
            );
          }
          if (roles.keeperPlayerId !== keeperId) walk.summary.designationDriftTicks++;
        }
      }

      if (roles.chaserPlayerId !== undefined) {
        if (roles.chaserPlayerId !== keeperId) teamTicksWithFieldChaser++;
        else {
          bumpKeeper(teamId, "keeperDesignatedChaserTicks");
          keeperChaseTeamTicks++;
        }
      }
      if (roles.coverPlayerId !== undefined && roles.coverPlayerId === keeperId) {
        bumpKeeper(teamId, "keeperDesignatedCoverTicks");
      }
      if (roles.kickoffTakerId !== undefined && roles.kickoffTakerId === keeperId) {
        bumpKeeper(teamId, "keeperDesignatedTakerTicks");
      }

      let within = 0;
      for (const p of observation.players) {
        if (p.teamId !== teamId) continue;
        if (planarDistance(p.groundPosition.x, p.groundPosition.y, ballPos.x, ballPos.y) <
          clumpRadiusMetres) within++;
      }
      maxWithinClump = Math.max(maxWithinClump, within);

      const chaserPosition = positionOf(roles.chaserPlayerId);
      teams[teamId] = {
        keeperPlayerId: keeperId,
        arcCenter: keeperId !== null
          ? { x: round(arcCenter.x), y: round(arcCenter.y) }
          : null,
        station: station !== null ? { x: round(station.x), y: round(station.y) } : null,
        lateralDrift: keeperPosition !== undefined
          ? round(lateralDriftMetres(keeperPosition, arcCenter))
          : null,
        distToArcCenter: keeperPosition !== undefined
          ? round(distanceToArcCenter(keeperPosition, arcCenter))
          : null,
        onGoalArc: keeperPosition !== undefined
          ? isInsideGoalArc(keeperPosition, arcCenter)
          : null,
        onStation: walks.get(teamId)?.onStation ?? false,
        saveReactionLive: saveArmed,
        saveShotTick: shotTick,
        ticksSinceShot: shotTick !== null ? tickNumber - shotTick : null,
        chaserPlayerId: roles.chaserPlayerId ?? null,
        chaserDistance: chaserPosition !== undefined
          ? round(planarDistance(chaserPosition.x, chaserPosition.y, ballPos.x, ballPos.y))
          : null,
        coverPlayerId: roles.coverPlayerId ?? null,
        restartTakerId: roles.kickoffTakerId ?? null,
        strategy: decision.strategy,
        defensiveSubMode: decision.defensiveSubMode,
        tacklePlayerId: decision.tackleCommit?.playerId ?? null,
        tackleWithheld: decision.tackleWithheld,
        playersWithinClumpRadius: within,
      };
    }
    if (keeperThisTick) ticksWithKeeperDesignation++;

    const playerRecords: GkPlayerRecord[] = observation.players.map((p) => {
      const frame = observation.inputs.find(
        (f) => slotToPlayer.get(f.controlSlot) === p.playerId,
      );
      return {
        playerId: p.playerId,
        teamId: p.teamId,
        formationRole: identities.get(p.playerId)?.formationRole ?? "",
        x: round(p.groundPosition.x),
        y: round(p.groundPosition.y),
        speed: round(Math.hypot(p.linearVelocity.x, p.linearVelocity.y)),
        distToBall: round(planarDistance(
          p.groundPosition.x,
          p.groundPosition.y,
          ballPos.x,
          ballPos.y,
        )),
        distToHome: round(planarDistance(
          p.groundPosition.x,
          p.groundPosition.y,
          kickoffHomes[p.playerId]?.x ?? 0,
          kickoffHomes[p.playerId]?.y ?? 0,
        )),
        keeper: teams[p.teamId]?.keeperPlayerId === p.playerId,
        designatedChaser: teams[p.teamId]?.chaserPlayerId === p.playerId,
        designatedCover: teams[p.teamId]?.coverPlayerId === p.playerId,
        pressed: pressedNames(frame),
      };
    });

    for (const evt of tickEvents) {
      if (evt.kind !== "goal") continue;
      const goalIndex = Number((evt.payload as { goalIndex?: number }).goalIndex ?? -1);
      // Accepted headless convention: the ball crossing +52.5 is scored by the
      // team attacking -x (team-b's own goal is at +52.5), and vice versa.
      const concedingTeamId = goalIndex === 0 ? "team-b" : "team-a";
      const scoringTeamId = concedingTeamId === "team-a" ? "team-b" : "team-a";
      goalsSoFar[scoringTeamId] = (goalsSoFar[scoringTeamId] ?? 0) + 1;
    }

    ticks.push({
      tick: tickNumber,
      stateHash: match.stateHashes[ticks.length] ?? "",
      ball: {
        x: round(ballPos.x),
        y: round(ballPos.y),
        vx: round(ballVel.x),
        vy: round(ballVel.y),
        regime: observation.ball.regime,
        lastTouchRef: observation.ball.lastTouchRef ?? null,
      },
      eventKinds: tickEvents.map((e) => e.kind),
      players: playerRecords,
      teams,
    });
  }

  // ---- shot → keeper contact chains ----
  const reachLimit = GK_SMALL_SIDED_V1.save_claim_reach_radius.value;
  for (const [teamId, walk] of walks.entries()) {
    const keeperId = walk.summary.keeperPlayerId;
    for (const shot of allShots) {
      if (shot.shooterTeamId === teamId) continue;
      if (!shotIsOnTargetToOwnGoal(shot, teamId, scenario.pitchLength)) continue;
      const projected = projectedCrossYAtGoalLine(shot, teamId, scenario.pitchLength);
      const chain: GkShotChainRecord = {
        teamId,
        keeperPlayerId: keeperId,
        shotContactTick: shot.tick,
        shotEventId: shot.eventId,
        shooterPlayerId: shot.shooterPlayerId,
        shooterTeamId: shot.shooterTeamId,
        projectedCrossY: round(projected ?? 0, 3),
        keeperContactTick: null,
        keeperContactEventId: null,
        contactKind: null,
        ticksFromShotToContact: null,
        recordedContactDistance: null,
        reachLimitMetres: reachLimit,
        withinReach: false,
        saveOnShotOnTarget: false,
        interruptedBy: null,
      };
      for (const contact of allContacts) {
        if (contact.tick <= shot.tick) continue;
        if (contact.playerId === keeperId) {
          chain.keeperContactTick = contact.tick;
          chain.keeperContactEventId = contact.eventId;
          chain.contactKind = contact.contactType;
          chain.ticksFromShotToContact = contact.tick - shot.tick;
          chain.recordedContactDistance = contact.recordedDistance;
          chain.withinReach = contact.recordedDistance !== null &&
            contact.recordedDistance <= reachLimit + Number.EPSILON;
          // The keeper's own recorded contact answered this shot: no other body
          // played the shot ball first, so this is the model's save/claim.
          chain.saveOnShotOnTarget = true;
          break;
        }
        // Another body played the shot ball first: this keeper never answered it.
        chain.interruptedBy = `contact-by:${contact.playerId}@${contact.tick}`;
        break;
      }
      walk.summary.shotChains.push(chain);
      walk.summary.shotsOnTargetFaced++;
      if (chain.keeperContactTick !== null) walk.summary.savesOnShotsOnTarget++;
    }
    for (const contact of allContacts) {
      if (contact.playerId !== keeperId) continue;
      walk.summary.keeperBallContacts.push({
        tick: contact.tick,
        kind: contact.kind,
        contactType: contact.contactType,
        recordedDistance: contact.recordedDistance,
      });
    }
  }

  const keepers: Record<string, GkKeeperSummary> = {};
  for (const [teamId, walk] of walks.entries()) keepers[teamId] = walk.summary;

  const passEvents = match.events
    .filter((e) => ["pass", "lofted-pass", "through-ball"].includes(e.kind))
    .map((e) => ({
      tick: e.tick,
      kind: e.kind,
      playerId: String((e.payload as { playerId?: string }).playerId),
      teamId: String((e.payload as { teamId?: string }).teamId),
    }));
  const touchEvents = allContacts
    .filter((c) => c.kind === "player-ball-contact")
    .map((c) => ({ tick: c.tick, kind: c.contactType, playerId: c.playerId }));
  const shotsOnTargetCount = Object.values(keepers)
    .reduce((total, keeper) => total + keeper.shotsOnTargetFaced, 0);
  const lastBall = ticks[ticks.length - 1]?.ball;

  const summary: GkRunSummary = {
    ticks: ticks.length,
    goals: match.events.filter((e) => e.kind === "goal").length,
    shots: allShots.length,
    shotsOnTarget: gkBehavior ? shotsOnTargetCount : countShotsOnTarget(allShots, teamIds, scenario.pitchLength),
    passes: passEvents.length,
    touches: touchEvents.length,
    passEvents,
    touchEvents,
    ballTravelMetres: round(ballTravel, 2),
    ballDisplacementMetres: firstBall && lastBall
      ? round(planarDistance(firstBall.x, firstBall.y, lastBall.x, lastBall.y), 2)
      : 0,
    maxBodiesWithinClumpRadiusPerTeam: maxWithinClump,
    ticksWithKeeperDesignation,
    teamTicksWithFieldChaser,
    keeperTeamTicks,
    keeperChaseTeamTicks,
  };

  return {
    scenarioId: scenario.id,
    totalTicks: ticks.length,
    gkEnabled: gkBehavior,
    keeperByTeam,
    kickoffHomes,
    ticks,
    events: match.events,
    stateHashes: match.stateHashes,
    keepers,
    summary,
  };
}

/** Every team's on-target shots against the other team, for stashed runs. */
function countShotsOnTarget(
  shots: readonly KeeperShotInfo[],
  teamIds: readonly string[],
  pitchLength: number,
): number {
  let count = 0;
  for (const shot of shots) {
    for (const teamId of teamIds) {
      if (shot.shooterTeamId === teamId) continue;
      if (shotIsOnTargetToOwnGoal(shot, teamId, pitchLength)) count++;
    }
  }
  return count;
}

/** Where a shot crosses the goal it is on target for, if it crosses it ahead. */
function projectedCrossYAtGoalLine(
  shot: KeeperShotInfo,
  teamId: string,
  pitchLength: number,
): number | null {
  const goalLineX = ownGoalLineX(teamId, pitchLength);
  if (Math.abs(shot.ballVelocity.x) < 1e-9) return null;
  const ticks = (goalLineX - shot.ballPosition.x) / shot.ballVelocity.x;
  if (!(ticks > 0)) return null;
  return shot.ballPosition.y + shot.ballVelocity.y * ticks;
}

/** Planar radius (metres) the core honours a touch inside. */
export const GK_CORE_TOUCH_RADIUS_METRES = CORE_TOUCH_RADIUS_METRES;

/** Versioned reach (metres) a save/claim must stay inside. */
export const GK_SAVE_REACH_METRES = GK_SMALL_SIDED_V1.save_claim_reach_radius.value;
