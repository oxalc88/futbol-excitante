/**
 * @module @pes/eval/runners/anti-huddle-match
 *
 * 5V5-KICKOFF-ANTI-HUDDLE evidence driver.
 *
 * Runs a coherent CPU-vs-CPU small-sided match through the accepted headless
 * match runner with the browser composition root's observation shape (the
 * runner's `browserParityObservations` switch), then reads the anti-huddle arc
 * back out of the committed tick stream:
 *
 *   • per-tick committed geometry: every body's position, its speed, its
 *     distance to the ball and to its fixed kickoff home,
 *   • per-tick per-team chase assignment: the single designated chaser, the
 *     single cover body, and how far behind the presser that cover sits,
 *   • the kickoff freeze window (the ball carries no touch reference) and the
 *     tick the first touch lands,
 *   • the organic pass / lofted-pass / through-ball events that follow, with the
 *     CPU frames that produced them,
 *   • the accepted mechanism reads that must survive: press designation, cover,
 *     and the tackle authorisation (issued, or with its disclosed withheld
 *     reason).
 *
 * The recorded assignment comes from the same exported production functions the
 * adapters act on (`assignChaseRoles`, `computeTeamDecision`) evaluated over that
 * tick's committed geometry, so evidence and behavior share one implementation.
 * A record is what the adapters read when building the frames consumed on the
 * following tick — the pre-step state of that following tick.
 *
 * Nothing here drives a touch, a pass or a tackle: the only inputs are the CPU
 * adapters' own tick-indexed frames.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { runHeadlessMatch } from "./headless-match.js";
import {
  assignChaseRoles,
  type CpuObservation,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { computeTeamDecision } from "../../src/adapters/input-browser/team-decision-profile.js";
import { FOUNDATION_CONTACT_V1 } from "../../src/simulation/config/foundation.js";
import {
  FIRST_TOUCH_BIT,
  PASS_BIT,
  SHOT_BIT,
  SLIDE_TACKLE_BIT,
  STANDING_TACKLE_BIT,
} from "../../src/contracts/input.js";
import type { ScenarioDefinition, SimulationEvent } from "../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InputFrame } from "../../src/contracts/input.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Planar radius (m) inside which the contact system honours a touch. */
const TOUCH_PRESS_RANGE_METRES = FOUNDATION_CONTACT_V1.contactRadius.value;

/** One body's committed geometry for one tick. */
export interface AntiHuddlePlayerRecord {
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
  /** True when this body is its team's designated chaser/presser this tick. */
  designatedChaser: boolean;
  /** True when this body is its team's designated cover this tick. */
  designatedCover: boolean;
  /** True while the kickoff freeze holds this body at its home. */
  kickoffFrozen: boolean;
  /** Button names the CPU frame consumed on the next tick pressed for this body. */
  pressed: string[];
}

/** One team's committed chase structure for one tick. */
export interface AntiHuddleTeamRecord {
  strategy: string;
  defensiveSubMode: string;
  chaserPlayerId: string | null;
  chaserDistance: number;
  coverPlayerId: string | null;
  coverDistance: number;
  /**
   * Metres the cover body sits behind the presser along the ball→presser axis.
   * Negative = behind the presser, away from the ball (the screen). Positive =
   * the cover has got between the ball and the presser.
   */
  coverBehindPresserMetres: number | null;
  /** Bodies of this team inside the huddle radius of the ball this tick. */
  playersWithinHuddleRadius: number;
  /** Tackle authorisation issued to this team this tick, if any. */
  tacklePlayerId: string | null;
  tackleWithheld: string;
}

export interface AntiHuddleTickRecord {
  tick: number;
  stateHash: string;
  /** The single body allowed to converge on an untouched restart ball. */
  kickoffTakerId: string | null;
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    regime: string;
    lastTouchRef: string | null;
  };
  /** Ball metres travelled since the previous recorded tick. */
  ballTravelledMetres: number;
  eventKinds: string[];
  players: AntiHuddlePlayerRecord[];
  teams: Record<string, AntiHuddleTeamRecord>;
}

export interface AntiHuddleRunSummary {
  ticks: number;
  firstTouchTick: number | null;
  /** Ticks on which at least one body was frozen at its kickoff home. */
  kickoffFreezeTicks: number;
  /** The body that broke the kickoff freeze, when the window produced one. */
  kickoffTakerId: string | null;
  /** Widest displacement of a *frozen* body from its home in the freeze window. */
  freezeWindowMaxFrozenHomeDisplacementMetres: number;
  /** Widest displacement from a kickoff home seen during the freeze window. */
  freezeWindowMaxHomeDisplacementMetres: number;
  /** Bodies that moved at all during the freeze window. */
  freezeWindowMovers: string[];
  /** Team-ticks after first touch where a team had >2 bodies in the radius. */
  huddleTicks: number;
  maxPlayersWithinHuddleRadiusPerTeam: number;
  meanPlayersWithinHuddleRadiusPerTeam: number;
  /** Team-ticks after first touch carrying exactly one designated chaser. */
  teamTicksWithDesignatedChaser: number;
  teamTicksWithPressAndCoverStructure: number;
  teamTicksWithCoverBehindPresser: number;
  passEvents: Array<{ tick: number; kind: string; playerId: string; teamId: string }>;
  touchEvents: Array<{ tick: number; kind: string; playerId: string }>;
  ballTravelMetres: number;
  ballDisplacementMetres: number;
  goals: number;
  cpuTacklePressTicks: number[];
  tackleWithheldTally: Record<string, Record<string, number>>;
}

export interface AntiHuddleMatchResult {
  scenarioId: string;
  totalTicks: number;
  /** True when the anti-huddle shape was live for this run (else the stash). */
  antiHuddleEnabled: boolean;
  huddleRadiusMetres: number;
  ticks: AntiHuddleTickRecord[];
  events: SimulationEvent[];
  stateHashes: string[];
  summary: AntiHuddleRunSummary;
  kickoffHomes: Record<string, { x: number; y: number }>;
}

export interface AntiHuddleMatchConfig {
  scenario: ScenarioDefinition;
  maxTicks: number;
  /** Anti-huddle kill switch. Default true; false restores chase-everything. */
  cpuAntiHuddle?: boolean;
  /** Give the CPU slots the defensive tackle buttons. Default true. */
  cpuDefensiveTackle?: boolean;
  /**
   * Planar radius (metres) at which same-team bodies count as one clump.
   * Provisional measurement threshold for evidence, never a gameplay value.
   */
  huddleRadiusMetres?: number;
}

/**
 * A formation role is scenario-static, so the driver reads it from the scenario
 * rather than assuming the telemetry carries it.
 */
type PlayerIdentity = {
  teamId: string;
  formationRole?: "defender" | "midfielder" | "attacker";
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const BIT_NAMES: Array<[number, string]> = [
  [FIRST_TOUCH_BIT, "first-touch"],
  [PASS_BIT, "pass"],
  [SHOT_BIT, "shot"],
  [STANDING_TACKLE_BIT, "standing-tackle"],
  [SLIDE_TACKLE_BIT, "slide-tackle"],
];

function pressedNames(frame: InputFrame | undefined): string[] {
  if (!frame) return [];
  return BIT_NAMES.filter(([bit]) => (frame.pressedButtons & bit) !== 0)
    .map(([, name]) => name);
}

/** Event kinds that mean "a body played the ball". */
const TOUCH_EVENT_KINDS = new Set([
  "player-ball-contact",
  "pass",
  "lofted-pass",
  "through-ball",
  "shot",
]);

const PASS_EVENT_KINDS = new Set(["pass", "lofted-pass", "through-ball"]);

/** Goal index → scoring team, the accepted headless-match convention. */
const GOAL_TEAM_BY_INDEX: Record<number, string> = { 0: "team-a", 1: "team-b" };

/**
 * Rebuild the observation shape the production role functions consume from a
 * committed telemetry observation plus the scenario's static player identity.
 * Only fields a CPU is already allowed to see are carried across.
 */
function observationFromTelemetry(
  observation: TelemetryObservation,
  identities: ReadonlyMap<string, PlayerIdentity>,
  pitchLength: number,
  pitchWidth: number,
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
  };
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

/**
 * Run one coherent CPU-vs-CPU match and record the anti-huddle arc from the
 * committed tick stream.
 */
export function runAntiHuddleMatch(
  config: AntiHuddleMatchConfig,
): AntiHuddleMatchResult {
  const cpuAntiHuddle = config.cpuAntiHuddle ?? true;
  const cpuDefensiveTackle = config.cpuDefensiveTackle ?? true;
  const huddleRadiusMetres = config.huddleRadiusMetres ?? 5;

  const match = runHeadlessMatch({
    scenario: config.scenario,
    maxTicks: config.maxTicks,
    cpuAntiHuddle,
    cpuDefensiveTackle,
    browserParityObservations: true,
  });

  const { scenario } = config;
  const identities = new Map<string, PlayerIdentity>();
  const kickoffHomes: Record<string, { x: number; y: number }> = {};
  for (const p of scenario.players) {
    identities.set(p.playerId, {
      teamId: p.teamId,
      formationRole: (p as { formationRole?: "defender" | "midfielder" | "attacker" })
        .formationRole,
    });
    kickoffHomes[p.playerId] = { x: p.groundPosition.x, y: p.groundPosition.y };
  }
  const teamIds = [...new Set(scenario.players.map((p) => p.teamId))].sort();

  // Control slot → body, so the consumed frames can be attributed.
  const slotToPlayer = new Map<string, string>();
  for (const assignment of Object.values(scenario.controlAssignments)) {
    if (assignment.controlledPlayerId) {
      slotToPlayer.set(assignment.controlSlot, assignment.controlledPlayerId);
    }
  }

  const ticks: AntiHuddleTickRecord[] = [];
  const tackleWithheldTally: Record<string, Record<string, number>> = {};
  const goalsSoFar: Record<string, number> = {};
  let previousBall: { x: number; y: number } | null = null;
  let firstTouchTick: number | null = null;

  for (const observation of match.observations) {
    const baseObs = observationFromTelemetry(
      observation,
      identities,
      scenario.pitchLength,
      scenario.pitchWidth,
    );
    const ballUntouched = observation.ball.lastTouchRef === null;
    if (firstTouchTick === null && !ballUntouched) {
      firstTouchTick = observation.tick;
    }

    const framesByPlayer = new Map<string, InputFrame>();
    for (const frame of observation.inputs) {
      const playerId = slotToPlayer.get(frame.controlSlot);
      if (playerId) framesByPlayer.set(playerId, frame);
    }

    const teams: Record<string, AntiHuddleTeamRecord> = {};
    const chasers = new Set<string>();
    const covers = new Set<string>();
    let kickoffTakerId: string | undefined;

    for (const teamId of teamIds) {
      const opponentTeamId = teamId === "team-a" ? "team-b" : "team-a";
      const teamObs: CpuObservation = {
        ...baseObs,
        cpuTeamId: teamId,
        scoreDifferential: (goalsSoFar[teamId] ?? 0) - (goalsSoFar[opponentTeamId] ?? 0),
      };
      const decision = computeTeamDecision(teamObs, teamId);
      teamObs.teamDecision = decision;
      const roles = assignChaseRoles(teamObs, teamId);
      if (roles.chaserPlayerId) chasers.add(roles.chaserPlayerId);
      if (roles.coverPlayerId) covers.add(roles.coverPlayerId);
      // The kick taker is team-independent: the closest body in the match.
      kickoffTakerId = roles.kickoffTakerId ?? kickoffTakerId;

      const presser = teamObs.players.find((p) => p.playerId === roles.chaserPlayerId);
      const cover = teamObs.players.find((p) => p.playerId === roles.coverPlayerId);
      let coverBehindPresserMetres: number | null = null;
      let coverDistance = Number.NaN;
      if (cover) {
        coverDistance = planarDistance(
          cover.groundPosition.x,
          cover.groundPosition.y,
          teamObs.ball.position.x,
          teamObs.ball.position.y,
        );
        if (presser && presser.playerId !== cover.playerId) {
          const axisX = presser.groundPosition.x - teamObs.ball.position.x;
          const axisY = presser.groundPosition.y - teamObs.ball.position.y;
          const axisLen = Math.sqrt(axisX * axisX + axisY * axisY);
          if (axisLen > 0.001) {
            coverBehindPresserMetres = round(
              ((cover.groundPosition.x - presser.groundPosition.x) * axisX +
                (cover.groundPosition.y - presser.groundPosition.y) * axisY) / axisLen,
            );
          }
        }
      }

      let playersWithinHuddleRadius = 0;
      for (const p of teamObs.players) {
        if (p.teamId !== teamId) continue;
        if (
          planarDistance(
            p.groundPosition.x,
            p.groundPosition.y,
            teamObs.ball.position.x,
            teamObs.ball.position.y,
          ) < huddleRadiusMetres
        ) {
          playersWithinHuddleRadius++;
        }
      }

      const withheldTally = (tackleWithheldTally[teamId] ??= {});
      withheldTally[decision.tackleWithheld] = (withheldTally[decision.tackleWithheld] ?? 0) + 1;

      teams[teamId] = {
        strategy: decision.strategy,
        defensiveSubMode: decision.defensiveSubMode,
        chaserPlayerId: roles.chaserPlayerId ?? null,
        chaserDistance: round(decision.nearestToBallDistance),
        coverPlayerId: roles.coverPlayerId ?? null,
        coverDistance: round(coverDistance),
        coverBehindPresserMetres,
        playersWithinHuddleRadius,
        tacklePlayerId: decision.tackleCommit?.playerId ?? null,
        tackleWithheld: decision.tackleWithheld,
      };
    }

    const players: AntiHuddlePlayerRecord[] = observation.players.map((p) => {
      const home = kickoffHomes[p.playerId];
      const distToBall = planarDistance(
        p.groundPosition.x,
        p.groundPosition.y,
        observation.ball.position.x,
        observation.ball.position.y,
      );
      // The adapter exempts the kick taker and any body already inside the
      // radius a touch can actually land in.
      const exemptFromFreeze = kickoffTakerId === p.playerId ||
        distToBall <= TOUCH_PRESS_RANGE_METRES;
      return {
        playerId: p.playerId,
        teamId: p.teamId,
        formationRole: identities.get(p.playerId)?.formationRole ?? "none",
        x: round(p.groundPosition.x),
        y: round(p.groundPosition.y),
        speed: round(Math.sqrt(p.linearVelocity.x ** 2 + p.linearVelocity.y ** 2)),
        distToBall: round(distToBall),
        distToHome: home
          ? round(planarDistance(p.groundPosition.x, p.groundPosition.y, home.x, home.y))
          : 0,
        designatedChaser: chasers.has(p.playerId),
        designatedCover: covers.has(p.playerId),
        kickoffFrozen: ballUntouched && cpuAntiHuddle && !exemptFromFreeze,
        pressed: pressedNames(framesByPlayer.get(p.playerId)),
      };
    });

    const ballTravelledMetres = previousBall === null
      ? 0
      : round(planarDistance(
          previousBall.x,
          previousBall.y,
          observation.ball.position.x,
          observation.ball.position.y,
        ));
    previousBall = { x: observation.ball.position.x, y: observation.ball.position.y };

    ticks.push({
      tick: observation.tick,
      stateHash: observation.stateHash,
      kickoffTakerId: ballUntouched ? kickoffTakerId ?? null : null,
      ball: {
        x: round(observation.ball.position.x),
        y: round(observation.ball.position.y),
        vx: round(observation.ball.linearVelocity.x),
        vy: round(observation.ball.linearVelocity.y),
        regime: observation.ball.regime,
        lastTouchRef: observation.ball.lastTouchRef,
      },
      ballTravelledMetres,
      eventKinds: observation.events.map((event) => event.kind),
      players,
      teams,
    });

    for (const event of observation.events) {
      if (event.kind !== "goal") continue;
      const scoringTeamId = GOAL_TEAM_BY_INDEX[Number(event.payload?.goalIndex ?? -1)];
      if (scoringTeamId) {
        goalsSoFar[scoringTeamId] = (goalsSoFar[scoringTeamId] ?? 0) + 1;
      }
    }
  }

  const summary = summarizeAntiHuddleRun(ticks, {
    huddleRadiusMetres,
    firstTouchTick,
    matchEvents: match.events,
    tackleWithheldTally,
  });

  return {
    scenarioId: scenario.id,
    totalTicks: match.tick,
    antiHuddleEnabled: cpuAntiHuddle,
    huddleRadiusMetres,
    ticks,
    events: match.events,
    stateHashes: match.stateHashes,
    summary,
    kickoffHomes,
  };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface AntiHuddleSummaryOptions {
  huddleRadiusMetres: number;
  firstTouchTick: number | null;
  matchEvents: readonly SimulationEvent[];
  tackleWithheldTally: Record<string, Record<string, number>>;
}

/**
 * Derive the run-level anti-huddle read from per-tick records.
 *
 * Pure function of the records, so a reviewer can re-run it over any window.
 */
export function summarizeAntiHuddleRun(
  ticks: readonly AntiHuddleTickRecord[],
  options: AntiHuddleSummaryOptions,
): AntiHuddleRunSummary {
  const { firstTouchTick } = options;
  const kickoffFreezeTicks = ticks.filter(
    (tick) => tick.players.some((player) => player.kickoffFrozen),
  ).length;

  const freezeWindow = firstTouchTick === null
    ? ticks
    : ticks.filter((tick) => tick.tick < firstTouchTick);
  let freezeWindowMaxHomeDisplacementMetres = 0;
  let freezeWindowMaxFrozenHomeDisplacementMetres = 0;
  let kickoffTakerId: string | null = null;
  const freezeWindowMovers = new Set<string>();
  for (const tick of freezeWindow) {
    if (kickoffTakerId === null) kickoffTakerId = tick.kickoffTakerId;
    for (const player of tick.players) {
      freezeWindowMaxHomeDisplacementMetres = Math.max(
        freezeWindowMaxHomeDisplacementMetres,
        player.distToHome,
      );
      if (player.kickoffFrozen) {
        freezeWindowMaxFrozenHomeDisplacementMetres = Math.max(
          freezeWindowMaxFrozenHomeDisplacementMetres,
          player.distToHome,
        );
      }
      if (player.distToHome > 0.25) freezeWindowMovers.add(player.playerId);
    }
  }

  let huddleTicks = 0;
  let maxWithin = 0;
  let withinSum = 0;
  let withinCount = 0;
  let teamTicksWithChaser = 0;
  let teamTicksWithPressAndCover = 0;
  let teamTicksWithCoverBehind = 0;
  for (const tick of ticks) {
    if (firstTouchTick !== null && tick.tick <= firstTouchTick) continue;
    let huddledThisTick = false;
    const chaserCountByTeam = new Map<string, number>();
    for (const player of tick.players) {
      if (!player.designatedChaser) continue;
      chaserCountByTeam.set(player.teamId, (chaserCountByTeam.get(player.teamId) ?? 0) + 1);
    }
    for (const teamRecord of Object.values(tick.teams)) {
      maxWithin = Math.max(maxWithin, teamRecord.playersWithinHuddleRadius);
      withinSum += teamRecord.playersWithinHuddleRadius;
      withinCount++;
      if (teamRecord.playersWithinHuddleRadius > 2) huddledThisTick = true;
      if (teamRecord.chaserPlayerId) teamTicksWithChaser++;
      if (teamRecord.chaserPlayerId && teamRecord.coverPlayerId &&
          teamRecord.chaserPlayerId !== teamRecord.coverPlayerId) {
        teamTicksWithPressAndCover++;
        if (teamRecord.coverBehindPresserMetres !== null &&
            teamRecord.coverBehindPresserMetres < 0) {
          teamTicksWithCoverBehind++;
        }
      }
    }
    if ([...chaserCountByTeam.values()].some((count) => count > 1)) huddledThisTick = true;
    if (huddledThisTick) huddleTicks++;
  }

  const eventByTickKind = new Map<string, SimulationEvent>();
  for (const event of options.matchEvents) {
    const key = `${event.tick}:${event.kind}`;
    if (!eventByTickKind.has(key)) eventByTickKind.set(key, event);
  }
  const passEvents: AntiHuddleRunSummary["passEvents"] = [];
  const touchEvents: AntiHuddleRunSummary["touchEvents"] = [];
  for (const tick of ticks) {
    for (const kind of tick.eventKinds) {
      const event = eventByTickKind.get(`${tick.tick}:${kind}`);
      const playerId = String(event?.payload?.playerId ?? "");
      const teamId = String(event?.payload?.teamId ?? "");
      if (PASS_EVENT_KINDS.has(kind)) {
        passEvents.push({ tick: tick.tick, kind, playerId, teamId });
      }
      if (TOUCH_EVENT_KINDS.has(kind)) {
        touchEvents.push({ tick: tick.tick, kind, playerId });
      }
    }
  }

  let ballTravelMetres = 0;
  for (const tick of ticks) ballTravelMetres += tick.ballTravelledMetres;
  const first = ticks[0]?.ball;
  const last = ticks[ticks.length - 1]?.ball;

  return {
    ticks: ticks.length,
    firstTouchTick,
    kickoffFreezeTicks,
    kickoffTakerId,
    freezeWindowMaxFrozenHomeDisplacementMetres: round(
      freezeWindowMaxFrozenHomeDisplacementMetres,
    ),
    freezeWindowMaxHomeDisplacementMetres: round(freezeWindowMaxHomeDisplacementMetres),
    freezeWindowMovers: [...freezeWindowMovers].sort(),
    huddleTicks,
    maxPlayersWithinHuddleRadiusPerTeam: maxWithin,
    meanPlayersWithinHuddleRadiusPerTeam: withinCount === 0 ? 0 : round(withinSum / withinCount),
    teamTicksWithDesignatedChaser: teamTicksWithChaser,
    teamTicksWithPressAndCoverStructure: teamTicksWithPressAndCover,
    teamTicksWithCoverBehindPresser: teamTicksWithCoverBehind,
    passEvents,
    touchEvents,
    ballTravelMetres: round(ballTravelMetres, 2),
    ballDisplacementMetres: first && last
      ? round(planarDistance(first.x, first.y, last.x, last.y), 2)
      : 0,
    goals: options.matchEvents.filter((event) => event.kind === "goal").length,
    cpuTacklePressTicks: ticks
      .filter((tick) => tick.players.some(
        (player) => player.pressed.includes("standing-tackle") ||
          player.pressed.includes("slide-tackle"),
      ))
      .map((tick) => tick.tick),
    tackleWithheldTally: options.tackleWithheldTally,
  };
}
