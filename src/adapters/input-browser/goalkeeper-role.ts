/**
 * @module @pes/adapters/input-browser/goalkeeper-role
 *
 * Adapter-layer SMALL-SIDED goalkeeper role (objective GK-5V5-ADAPTER-BEHAVIOR).
 *
 * Everything here is a pure function of information a CPU is already allowed to
 * read, plus the versioned provisional configuration declared by
 * `specs/GOALKEEPER_SPEC.md` under model id `gk-small-sided-v1`. It owns no
 * gameplay authority: the keeper acts only through tick-indexed `InputFrame`s
 * emitted by the CPU adapter, so the ball stays an independently integrated 3D
 * entity and no body's position is ever assigned from here.
 *
 * The simulation core and its contracts are untouched. A designated keeper is
 * one of the bodies the scenario already ships — the role is an adapter-layer
 * assignment, never a new world entity and never a change to team cardinality.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { FOUNDATION_GOAL_V1 } from "../../simulation/config/foundation.js";

// ---------------------------------------------------------------------------
// Versioned provisional configuration (model `gk-small-sided-v1`)
// ---------------------------------------------------------------------------

/**
 * Owning model id. The values below mirror the versioned provisional records in
 * `eval/contracts/goalkeeper-config.ts` (the spec's machine-readable record);
 * the binding test
 * `tests/unit/cpu-adapter/GK-SMALL-SIDED-V1-drift.test.ts` fails if the two
 * ever disagree, so this module can never quietly invent a keeper constant.
 *
 * None of these values is measured, calibrated, or a PES 2017 magnitude.
 */
export const GK_SMALL_SIDED_V1 = {
  id: "gk-small-sided-v1",
  label: "provisional",
  /** §5 longitudinal offset of the arc center from the goal-line centre. */
  goal_arc_center_x_offset: {
    value: 0,
    unit: "m",
    note: "provisional goal-arc centre offset from the goal-line centre",
  },
  /** §5 nominal repositioning region: disk of this radius about the arc center. */
  goal_arc_radius: {
    value: 4.0,
    unit: "m",
    note: "provisional goal-arc radius",
  },
  /** §5 bounded lateral drift along the goal line. */
  goal_arc_lateral_max: {
    value: 2.5,
    unit: "m",
    note: "provisional bounded lateral drift inside the goal arc",
  },
  /** §5 repositioning speed inside the arc. */
  keeper_reposition_speed: {
    value: 2.0,
    unit: "m/s",
    note: "provisional keeper in-arc repositioning speed",
  },
  /** §7 window from shot contact within which the save/claim attempt starts. */
  keeper_reaction_window_ticks: {
    value: 12,
    unit: "ticks",
    note: "provisional reaction window; tick rate itself is provisional",
  },
  /** §7 reach radius within which a save/claim is physically feasible. */
  save_claim_reach_radius: {
    value: 1.2,
    unit: "m",
    note: "provisional save/claim contact reach radius",
  },
  /** §8 window in which a keeper that has secured the ball may release it. */
  distribution_release_window_ticks: {
    value: 10,
    unit: "ticks",
    note: "provisional hold/release window",
  },
  /** §8 release target selection uses only the keeper's modelled information. */
  distribution_no_omniscience: {
    value: "on",
    unit: "",
    note: "flag: no hidden future state is used to pick a release target",
  },
} as const;

/** Planar goal half-width the keeper defends, read from the core's own declaration. */
export const GK_GOAL_HALF_WIDTH_METRES = FOUNDATION_GOAL_V1.goalWidth.value / 2;

// ---------------------------------------------------------------------------
// Geometry helpers (pure)
// ---------------------------------------------------------------------------

/** Minimal readable shape of a body the designation rule may use. */
export interface KeeperLayoutBody {
  playerId: string;
  teamId: string;
  groundPosition: { x: number; y: number };
  /** The scenario's declared role for this body, when it declares one. */
  formationRole?: "defender" | "midfielder" | "attacker";
}

/**
 * X of the goal a team defends. Convention inherited from the accepted team
 * geometry: team-a attacks +x (so it defends -x), team-b attacks -x.
 */
export function ownGoalLineX(teamId: string, pitchLength: number): number {
  return teamId === "team-a" ? -pitchLength / 2 : pitchLength / 2;
}

/**
 * Centre of a team's goal arc (§5): the goal-line centre, offset longitudinally
 * by the versioned `goal_arc_center_x_offset`.
 */
export function goalArcCenter(
  teamId: string,
  pitchLength: number,
): { x: number; y: number } {
  return {
    x: ownGoalLineX(teamId, pitchLength) + GK_SMALL_SIDED_V1.goal_arc_center_x_offset.value,
    y: 0,
  };
}

/** Signed lateral drift of a point from the arc centre along the goal line. */
export function lateralDriftMetres(
  position: { x: number; y: number },
  arcCenter: { x: number; y: number },
): number {
  return position.y - arcCenter.y;
}

/** Planar distance from a point to the arc centre. */
export function distanceToArcCenter(
  position: { x: number; y: number },
  arcCenter: { x: number; y: number },
): number {
  const dx = position.x - arcCenter.x;
  const dy = position.y - arcCenter.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** True when a point is inside the nominal repositioning disk (§5). */
export function isInsideGoalArc(
  position: { x: number; y: number },
  arcCenter: { x: number; y: number },
): boolean {
  return distanceToArcCenter(position, arcCenter) <= GK_SMALL_SIDED_V1.goal_arc_radius.value;
}

/** Clamp a lateral coordinate to the versioned bounded drift (§5). */
export function clampToArcLateralBand(y: number): number {
  const bound = GK_SMALL_SIDED_V1.goal_arc_lateral_max.value;
  return Math.max(-bound, Math.min(bound, y));
}

/**
 * The point the keeper holds: the arc centre's longitudinal line, drifted
 * laterally toward the ball but never past `goal_arc_lateral_max`. The result is
 * always inside the arc disk, so the commanded target can never be a field
 * chase.
 */
export function keeperArcSetPoint(
  teamId: string,
  pitchLength: number,
  trackY: number,
): { x: number; y: number } {
  const center = goalArcCenter(teamId, pitchLength);
  return { x: center.x, y: clampToArcLateralBand(trackY) };
}

// ---------------------------------------------------------------------------
// Role designation (§4) — adapter-layer assignment on an existing body
// ---------------------------------------------------------------------------

/**
 * How deep a declared outfield role sits in the team's own half. `defender` is
 * the keeper's natural source, then an undeclared role (the accepted formation
 * machinery treats an absent role as a midfielder), and only as a last resort
 * the forward line — a scenario whose striker happens to stand deeper than its
 * defenders must not end up with that striker in goal.
 */
function keeperRoleRank(role?: "defender" | "midfielder" | "attacker"): number {
  if (role === "defender") return 0;
  if (role === undefined || role === "midfielder") return 1;
  return 2;
}

/**
 * Designate the team's keeper from the role layout it starts the match with
 * (spec §4): the body on the team's deepest declared role that sits nearest its
 * own goal-arc centre, ties resolved by that distance and then by ascending
 * playerId. Nothing here reads the ball, so the designation is a layout fact
 * fixed before kickoff rather than a transient possession fact (§4), and every
 * wiring that observes the same layout resolves the same body.
 *
 * The role preference exists because a scenario's forward line can be positioned
 * deeper than its own defenders; designating on raw geometry alone would put the
 * team's striker in goal and change the cardinality the outfield shape is tuned
 * for.
 *
 * The body is not modified: only its `playerId` is returned.
 */
export function designateKeeperFromLayout(
  players: readonly KeeperLayoutBody[],
  teamId: string,
  pitchLength: number,
): string | undefined {
  const center = goalArcCenter(teamId, pitchLength);
  let bestId: string | undefined;
  let bestRank = Number.POSITIVE_INFINITY;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const p of players) {
    if (p.teamId !== teamId) continue;
    const rank = keeperRoleRank(p.formationRole);
    const dist = distanceToArcCenter(p.groundPosition, center);
    if (
      rank < bestRank ||
      (rank === bestRank &&
        (dist < bestDist ||
          (dist === bestDist && bestId !== undefined && p.playerId < bestId)))
    ) {
      bestRank = rank;
      bestDist = dist;
      bestId = p.playerId;
    }
  }
  return bestId;
}

// ---------------------------------------------------------------------------
// Shot-on-target perception (§7) — modelled information only
// ---------------------------------------------------------------------------

/** The shot facts a keeper may perceive from the canonical event record. */
export interface KeeperShotInfo {
  /** Tick the shot contact was committed. */
  tick: number;
  /** Canonical event id of the shot (the ball's touch reference it wrote). */
  eventId: string;
  /** Player who struck it. */
  shooterPlayerId: string;
  /** Team of the shooter. */
  shooterTeamId: string;
  /** Ball ground position at the shot. */
  ballPosition: { x: number; y: number };
  /** Ball planar velocity immediately after the shot. */
  ballVelocity: { x: number; y: number };
}

/**
 * Where a planar ray crosses a goal line, or null when it never crosses it
 * ahead of the ball. Linear projection of the state the keeper can currently
 * observe — no future simulation state is read.
 */
export function projectedGoalLineCrossY(
  position: { x: number; y: number },
  velocity: { x: number; y: number },
  goalLineX: number,
): number | null {
  if (Math.abs(velocity.x) < 1e-9) return null;
  const ticks = (goalLineX - position.x) / velocity.x;
  if (!(ticks > 0)) return null;
  return position.y + velocity.y * ticks;
}

/** True when the planar ball velocity currently carries it toward `goalLineX`. */
export function isApproachingGoalLine(
  position: { x: number; y: number },
  velocity: { x: number; y: number },
  goalLineX: number,
): boolean {
  return (goalLineX - position.x) * velocity.x > 0 ||
    (Math.abs(velocity.x) < 1e-9 && Math.abs(goalLineX - position.x) < 1e-9);
}

/**
 * Is this shot on target against the team's own goal (§7)? Canonical shot state
 * projected onto the goal line against the core's own declared goal width.
 */
export function shotIsOnTargetToOwnGoal(
  shot: KeeperShotInfo,
  teamId: string,
  pitchLength: number,
): boolean {
  const goalLineX = ownGoalLineX(teamId, pitchLength);
  if (!isApproachingGoalLine(shot.ballPosition, shot.ballVelocity, goalLineX)) {
    return false;
  }
  const crossY = projectedGoalLineCrossY(shot.ballPosition, shot.ballVelocity, goalLineX);
  if (crossY === null) return false;
  return Math.abs(crossY) <= GK_GOAL_HALF_WIDTH_METRES;
}

/**
 * The newest opponent shot in the keeper's perception window that is on target
 * at this team's own goal, or `undefined` when nothing in the window qualifies.
 *
 * Shared by the adapter (which arms its reaction on it) and by evidence drivers
 * (which label the tick they are reacting on), so a recorded keeper reaction and
 * an executed one can never drift apart. The window is delivered newest first by
 * `buildCpuObservation`.
 */
export function latestOnTargetShotAgainst(
  shots: readonly KeeperShotInfo[] | undefined,
  teamId: string,
  pitchLength: number,
): KeeperShotInfo | undefined {
  if (shots === undefined) return undefined;
  for (const shot of shots) {
    if (shot.shooterTeamId === teamId) continue;
    if (!shotIsOnTargetToOwnGoal(shot, teamId, pitchLength)) continue;
    return shot;
  }
  return undefined;
}

/**
 * The point a keeper holds for this observation: its arc set point, drifted
 * toward where the live ball crosses its own goal line when it is travelling
 * there, and toward the ball's lateral position otherwise — always clamped
 * inside the versioned lateral band.
 *
 * Reading the crossing point of an inbound ball is the same class of information
 * the accepted interception awareness already uses (a linear projection of
 * observed state), and it is what lets a keeper limited in-arc speed meet a fast
 * shot without ever leaving its arc.
 *
 * Exported as the single definition of "where the keeper should be", so the
 * adapter's commanded target and the evidence's recorded target are the same
 * production function.
 */
export function keeperStationTarget(
  teamId: string,
  pitchLength: number,
  ballPosition: { x: number; y: number },
  ballVelocity: { x: number; y: number },
  saveArmed: boolean,
): { x: number; y: number } {
  const goalLineX = ownGoalLineX(teamId, pitchLength);
  const inbound = saveArmed ||
    isApproachingGoalLine(ballPosition, ballVelocity, goalLineX);
  const trackY = inbound
    ? (projectedGoalLineCrossY(ballPosition, ballVelocity, goalLineX) ?? ballPosition.y)
    : ballPosition.y;
  return keeperArcSetPoint(teamId, pitchLength, trackY);
}

/**
 * The on-target shot a keeper is reacting to, and the reaction's own bookkeeping.
 *
 * The state is owned by the caller — one per CPU adapter instance, or one per
 * team in an evidence driver — and advanced by the single production rule below,
 * so a recorded keeper reaction and an executed one cannot drift apart.
 */
export interface KeeperReactionState {
  /** Tick of the canonical shot contact being reacted to, null while idle. */
  shotTick: number | null;
  /** That shot's event id — i.e. the ball reference this reaction is for. */
  shotEventId: string | null;
  /** Tick the keeper first perceived the shot (attempt initiation). */
  initiatedTick: number | null;
}

/** The idle reaction state. */
export const KEEPER_REACTION_IDLE: KeeperReactionState = {
  shotTick: null,
  shotEventId: null,
  initiatedTick: null,
};

/**
 * Advance one keeper's save/claim reaction across a committed tick (spec §7).
 *
 * Arming: the newest canonical opponent `shot` inside the keeper's perception
 * window that projects onto this team's own goal inside the posts. The attempt
 * initiates on the first tick that shot is observable, which is always within
 * the versioned `keeper_reaction_window_ticks` — `reaction_latency_ref_ms` stays
 * BLOCKED_MISSING_REFERENCE, so the model invents no latency and initiates at
 * the earliest moment the committed world allows.
 *
 * Disarming: the reaction lives exactly as long as the shot ball is still the
 * shot ball. Any touch — this keeper's own claim included — rewrites the ball's
 * authoritative reference, and a ball no longer travelling at this goal is not a
 * shot on target. Both signals are observable; neither is a timer the model has
 * not versioned.
 */
export function advanceKeeperReaction(
  previous: KeeperReactionState,
  input: {
    tick: number;
    teamId: string;
    pitchLength: number;
    recentShotEvents?: readonly KeeperShotInfo[];
    ballPosition: { x: number; y: number };
    ballVelocity: { x: number; y: number };
    lastTouchRef?: string | null;
  },
): {
  state: KeeperReactionState;
  /** True only on the tick this rule newly armed the reaction. */
  armedNow: boolean;
  /** The shot that armed it, present only on `armedNow`. */
  armedShot: KeeperShotInfo | undefined;
} {
  let state: KeeperReactionState = {
    shotTick: previous.shotTick,
    shotEventId: previous.shotEventId,
    initiatedTick: previous.initiatedTick,
  };
  let armedNow = false;

  const candidate = latestOnTargetShotAgainst(
    input.recentShotEvents,
    input.teamId,
    input.pitchLength,
  );
  if (candidate !== undefined &&
    (state.shotTick === null || candidate.tick > state.shotTick)) {
    state = {
      shotTick: candidate.tick,
      shotEventId: candidate.eventId,
      initiatedTick: input.tick,
    };
    armedNow = true;
  }

  const stillTheShotBall = state.shotEventId !== null &&
    (input.lastTouchRef ?? null) === state.shotEventId;
  const stillApproaching = state.shotEventId !== null && isApproachingGoalLine(
    input.ballPosition,
    input.ballVelocity,
    ownGoalLineX(input.teamId, input.pitchLength),
  );
  if (state.shotTick !== null && (!stillTheShotBall || !stillApproaching)) {
    state = { shotTick: null, shotEventId: null, initiatedTick: null };
  }

  return { state, armedNow, armedShot: armedNow ? candidate : undefined };
}

// ---------------------------------------------------------------------------
// Reachability counters (discriminating-guard reads)
// ---------------------------------------------------------------------------

/**
 * Module-level counters for the keeper paths. Stash `gkBehavior` and every one
 * of them stays 0 while the match still runs, which is what makes the
 * discriminating guards executable rather than rhetorical.
 */
let _keeperHoldTicks = 0;
let _keeperSaveArms = 0;
let _keeperSavePresses = 0;
let _keeperReleasePresses = 0;
let _keeperPressExclusions = 0;

/** Ticks on which a designated keeper emitted an arc-hold frame. */
export function getKeeperHoldActivations(): number {
  return _keeperHoldTicks;
}

/**
 * Shots on target a designated keeper actually armed a reaction on. Zero means
 * no keeper ever perceived an on-target shot, which is a reachability fact the
 * evidence must disclose rather than hide behind a recorded contact.
 */
export function getKeeperSaveArmActivations(): number {
  return _keeperSaveArms;
}

/** Ticks on which a designated keeper pressed the save/claim contact. */
export function getKeeperSavePressActivations(): number {
  return _keeperSavePresses;
}

/** Ticks on which a designated keeper pressed a distribution release. */
export function getKeeperReleasePressActivations(): number {
  return _keeperReleasePresses;
}

/** Ticks on which a designated keeper was excluded from press designation. */
export function getKeeperPressExclusionActivations(): number {
  return _keeperPressExclusions;
}

/** Zero every keeper-path counter and release record (call before a measured run). */
export function resetKeeperMechanismCounters(): void {
  _keeperHoldTicks = 0;
  _keeperSaveArms = 0;
  _keeperSavePresses = 0;
  _keeperReleasePresses = 0;
  _keeperPressExclusions = 0;
  _keeperReleases = [];
}

/** Called by the team-decision layer whenever it excludes the keeper. */
export function noteKeeperPressExclusion(): void {
  _keeperPressExclusions++;
}

/** Called by the CPU adapter for each keeper frame it emits. */
export function noteKeeperHoldTick(): void {
  _keeperHoldTicks++;
}

/** Called by the CPU adapter when a shot on target arms a keeper reaction. */
export function noteKeeperSaveArm(): void {
  _keeperSaveArms++;
}

/** Called by the CPU adapter when it presses the save/claim contact. */
export function noteKeeperSavePress(): void {
  _keeperSavePresses++;
}

/** Called by the CPU adapter when it presses a distribution release. */
export function noteKeeperReleasePress(): void {
  _keeperReleasePresses++;
}

// ---------------------------------------------------------------------------
// Release observability record (§8) — a keeper-release event source
// ---------------------------------------------------------------------------

/**
 * One committed keeper-release action, recorded by the adapter at the moment it
 * presses the distribution pass.  The target and positions are the observing
 * keeper's OWN view at that tick (observed teammate/opponent positions only),
 * so the protected distribution oracle can re-verify that no hidden future
 * state was read.  This is the source the runner turns into a `keeper-release`
 * telemetry event; it carries no core authority.
 */
export interface KeeperReleaseRecord {
  /** Tick the release action was issued. */
  tick: number;
  teamId: string;
  /** The designated keeper that released. */
  keeperPlayerId: string;
  /** The observed teammate the keeper released toward. */
  releaseTargetPlayerId: string;
  /** The target's observed position at the release tick. */
  releaseTargetPosition: { x: number; y: number };
  /** The keeper's own observed position at the release tick. */
  keeperPosition: { x: number; y: number };
}

/** Release records appended since the last reset. */
let _keeperReleases: KeeperReleaseRecord[] = [];

/** Append one released-action record (called by the CPU adapter). */
export function noteKeeperRelease(record: KeeperReleaseRecord): void {
  _keeperReleases.push(record);
}

/** All release records accumulated since the last reset (ordered by issue). */
export function getKeeperReleaseRecords(): readonly KeeperReleaseRecord[] {
  return _keeperReleases;
}

/** Discard every accumulated release record. */
export function resetKeeperReleaseRecords(): void {
  _keeperReleases = [];
}
