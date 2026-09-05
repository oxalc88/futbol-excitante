/**
 * @module @pes/adapters/input-browser/cpu-adapter
 *
 * CPU / AI adapter — produces normalized tick-indexed InputFrames
 * for AI_FALLBACK control slots.
 *
 * Responsibilities:
 *  - Read-only world observation (no mutation).
 *  - Goal-aware steering: toward opponent's goal when in possession.
 *  - Shooting: press SHOT_BIT when in range and facing the goal,
 *    with distance-based thresholds.
 *  - Post-shot cooldown: suppress FIRST_TOUCH after shooting.
 *  - Chase-ball: only the team's designated chaser converges on the ball;
 *    every other field body holds its fixed kickoff home (anti-huddle).
 *  - Restart freeze: non-chasing bodies hold their window anchor (the kickoff
 *    home at kickoff and after a reset; the core's restart placement during a
 *    set piece) until the restarted ball's authoritative touch reference shows
 *    it has been played — throw-in, goal kick, corner and post-goal restarts
 *    re-arm the same freeze the kickoff established.
 *  - FIRST_TOUCH: press when within ~1.5 m of a slow ball (defense).
 *  - Always sprint (sprint = 1).
 *  - sourceId is "cpu" — pure provenance, never affects gameplay.
 *  - Formation recovery: displaced players return toward formation
 *    position over time, blended with chase direction.
 *  - Off-ball attacking: non-possessing players push forward during
 *    team possession (role-aware forward runs, cycling pattern).
 *  - Difficulty scaling: optional difficulty level modulates decision
 *    quality and reaction speed (Easy/Medium/Hard).
 *
 * Deterministic: same (tick, observation) → same InputFrame.
 * No Math.random, Date, DOM, or Node I/O.
 *
 * Provisional constants (unmeasured PES 2017 values):
 *  - POSSESSION_RANGE, SHOT_RANGE_CLOSE, SHOT_RANGE_WIDE
 *  - FACING_TOLERANCE_CLOSE, FACING_TOLERANCE_WIDE
 *  - FIRST_TOUCH_RANGE, FIRST_TOUCH_SPEED_THRESHOLD
 *  - POSSESSION_SPEED_THRESHOLD, FACING_TOLERANCE_BACKUP
 *  - SHOT_COOLDOWN_TICKS
 *  - CHASE_FORMATION_THRESHOLD
 *  - FORMATION_RECOVERY_RATE
 *  - OFFBALL_FORWARD_PUSH_ATTACKER, OFFBALL_FORWARD_PUSH_MIDFIELDER
 *  - OFFBALL_FORWARD_PUSH_BASE, ATTACK_PHASE_FORWARD_MULTIPLIER_*
 *  - CYCLING_HALF_PERIOD, CYCLING_AMPLITUDE
 *  - PRESS_RADIUS, MARKING_DISTANCE, PRESS_STRENGTH
 *  - CPU defensive-tackle decision thresholds: FOUNDATION_CPU_TACKLE_V1
 *  - Anti-huddle hold tolerances (anti-huddle-v1):
 *    KICKOFF_FREEZE_HOME_TOLERANCE, CHASE_NEAREST_HOME_TOLERANCE,
 *    RESTART_HOLD_MIN_TICKS
 */

import type { InputFrame } from "../../contracts/input.js";
import {
  FIRST_TOUCH_BIT,
  PASS_BIT,
  SHOT_BIT,
  STANDING_TACKLE_BIT,
  SLIDE_TACKLE_BIT,
} from "../../contracts/input.js";
import type { WorldState } from "../../contracts/state.js";
import {
  FOUNDATION_CONTACT_V1,
  FOUNDATION_CPU_TACKLE_V1,
  FOUNDATION_LOCOMOTION_V1,
  FOUNDATION_TACKLE_V1,
} from "../../simulation/config/foundation.js";
import {
  designatePresser,
  isAntiHuddleActive,
  isKeeperBehaviorActive,
  resolveKeeperPlayerId,
  teamHasPossession,
} from "./team-decision-profile.js";
import type { TeamDecision } from "./team-decision-profile.js";
import {
  GK_SMALL_SIDED_V1,
  designateKeeperFromLayout,
  goalArcCenter,
  isApproachingGoalLine,
  isInsideGoalArc,
  keeperStationTarget,
  latestOnTargetShotAgainst,
  advanceKeeperReaction,
  KEEPER_REACTION_IDLE,
  noteKeeperHoldTick,
  noteKeeperRelease,
  noteKeeperReleasePress,
  noteKeeperSaveArm,
  noteKeeperSavePress,
  resetKeeperMechanismCounters,
  ownGoalLineX,
} from "./goalkeeper-role.js";
import type { KeeperReactionState, KeeperShotInfo, KeeperReleaseRecord } from "./goalkeeper-role.js";
export type {
  TeamDecision,
  DefensiveSubMode,
  CpuTackleCommit,
  CpuTackleKind,
  CpuTackleEvaluation,
  TackleWithheldReason,
} from "./team-decision-profile.js";
export type { KeeperLayoutBody, KeeperShotInfo, KeeperReleaseRecord } from "./goalkeeper-role.js";
export {
  computeTeamDecision,
  getBallZone,
  teamHasPossession,
  evaluateCpuTackleCommit,
  isAntiHuddleActive,
  designatePresser,
  isKeeperBehaviorActive,
  resolveKeeperPlayerId,
} from "./team-decision-profile.js";
export {
  GK_SMALL_SIDED_V1,
  designateKeeperFromLayout,
  goalArcCenter,
  keeperArcSetPoint,
  keeperStationTarget,
  latestOnTargetShotAgainst,
  clampToArcLateralBand,
  distanceToArcCenter,
  lateralDriftMetres,
  isInsideGoalArc,
  shotIsOnTargetToOwnGoal,
  advanceKeeperReaction,
  KEEPER_REACTION_IDLE,
  projectedGoalLineCrossY,
  ownGoalLineX,
  isApproachingGoalLine,
  GK_GOAL_HALF_WIDTH_METRES,
  getKeeperHoldActivations,
  getKeeperSaveArmActivations,
  getKeeperSavePressActivations,
  getKeeperReleasePressActivations,
  getKeeperPressExclusionActivations,
  getKeeperReleaseRecords,
  resetKeeperMechanismCounters,
} from "./goalkeeper-role.js";

// ---------------------------------------------------------------------------
// Mechanism activation tracking (SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH)
// ---------------------------------------------------------------------------

/**
 * Module-level counter incremented every time the cover mechanism or
 * support mechanism code path actually executes in ANY adapter instance.
 * Used by honesty guard tests to prove the mechanisms are exercised.
 *
 * Reset to 0 by `resetMechanismCounters()`.
 * Read via `getMechanismActivationCount()`.
 */
let _coverMechanismActivations = 0;
let _supportMechanismActivations = 0;

/**
 * Module-level counters for the anti-huddle paths (5V5-KICKOFF-ANTI-HUDDLE):
 * ticks on which a non-chasing CPU body was frozen to its kickoff home, and
 * ticks on which a non-chasing CPU body was steered to its home instead of the
 * ball. Stash either path and the counters stay 0 while the match still runs,
 * which is what makes the discriminating guards below executable.
 */
let _kickoffFreezeActivations = 0;
let _nearestOnlyChaseActivations = 0;
/**
 * Restart freeze ticks (RESTART-ANTI-HUDDLE-COHERENCE): ticks inside an
 * untouched window that is not the instance's opening kickoff window —
 * throw-in, goal kick, corner and post-goal restarts. Stash the anti-huddle
 * and this stays 0 while the restart itself still runs.
 */
let _restartFreezeActivations = 0;

/**
 * Module-level counter incremented every time a CPU adapter actually presses a
 * defensive tackle bit (CPU-DEFENSIVE-TACKLE). Read by the reachability guard:
 * stash the tackle press path and the counter stays 0 while the match still
 * runs, which is what proves the observed CPU tackles come from this decision
 * path rather than from a scripted input.
 */
let _cpuTackleCommits = 0;

/**
 * Get the total cover mechanism activation count across all adapter instances.
 * Increments when the cover player code path runs (defense mode, cover assigned).
 */
export function getCoverMechanismActivations(): number {
  return _coverMechanismActivations;
}

/**
 * Get the total support mechanism activation count across all adapter instances.
 * Increments when the off-ball support adjustment runs (possession, support active).
 */
export function getSupportMechanismActivations(): number {
  return _supportMechanismActivations;
}

/**
 * Ticks on which a CPU body was frozen to its kickoff home
 * (5V5-KICKOFF-ANTI-HUDDLE reachability guard).
 */
export function getKickoffFreezeActivations(): number {
  return _kickoffFreezeActivations;
}

/**
 * Ticks on which a non-designated CPU body was steered to its formation home
 * instead of the ball (5V5-KICKOFF-ANTI-HUDDLE reachability guard).
 */
export function getNearestOnlyChaseActivations(): number {
  return _nearestOnlyChaseActivations;
}

/**
 * Ticks on which a CPU body was frozen inside a match-restart window —
 * throw-in, goal kick, corner or post-goal restart (RESTART-ANTI-HUDDLE-COHERENCE
 * reachability guard).
 */
export function getRestartFreezeActivations(): number {
  return _restartFreezeActivations;
}

/**
 * Total number of defensive tackle presses actually issued by CPU adapters
 * (CPU-DEFENSIVE-TACKLE reachability guard).
 */
export function getCpuTackleCommitActivations(): number {
  return _cpuTackleCommits;
}

/**
 * Reset all mechanism activation counters to 0.
 * Call before each test run for clean measurement.
 */
export function resetMechanismCounters(): void {
  _coverMechanismActivations = 0;
  _supportMechanismActivations = 0;
  _cpuTackleCommits = 0;
  _kickoffFreezeActivations = 0;
  _nearestOnlyChaseActivations = 0;
  _restartFreezeActivations = 0;
  resetKeeperMechanismCounters();
}

// ---------------------------------------------------------------------------
// Difficulty configuration (BROWSER-DIFFICULTY-SETTING, provisional)
// ---------------------------------------------------------------------------

/**
 * CPU difficulty level — provisional, not a measured PES 2017 concept.
 * Easy = weakest CPU, Hard = strongest CPU. Monotonically ordered.
 */
export type DifficultyLevel = "easy" | "medium" | "hard";

/**
 * Deterministic difficulty factors modulating CPU adapter behavior.
 * All values are multipliers applied to the base provisional constants.
 *
 * - pressRadiusFactor: scales PRESS_RADIUS (pressing range).
 * - pressStrengthFactor: scales PRESS_STRENGTH (press aggressiveness).
 * - shotAimFactor: scales shot lateral aim offset (higher = wider = less accurate).
 * - shotRangeFactor: scales SHOT_RANGE_CLOSE and SHOT_RANGE_WIDE (higher = shoots from farther).
 * - facingToleranceFactor: scales FACING_TOLERANCE_CLOSE (higher = can shoot from more angles).
 * - firstTouchRangeFactor: scales FIRST_TOUCH_RANGE (higher = reacts to ball from farther = faster reaction).
 *
 * Monotonically ordered: Easy < Medium < Hard in CPU strength.
 * Provisional — not a measured PES 2017 concept.
 */
export interface DifficultyConfig {
  pressRadiusFactor: number;
  pressStrengthFactor: number;
  shotAimFactor: number;
  shotRangeFactor: number;
  facingToleranceFactor: number;
  firstTouchRangeFactor: number;
}

/**
 * Provisional difficulty level → factor mapping.
 * Medium (default) uses factors of 1.0 (no change from baseline).
 * Easy weakens the CPU; Hard strengthens it.
 *
 * Deterministic: same level → same config.
 */
const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  easy: {
    pressRadiusFactor: 0.7,
    pressStrengthFactor: 0.8,
    shotAimFactor: 1.5,       // wider aim = less accurate
    shotRangeFactor: 0.8,     // shorter shot range
    facingToleranceFactor: 0.7, // narrower tolerance = pickier shooter
    firstTouchRangeFactor: 0.8, // shorter reaction range
  },
  medium: {
    pressRadiusFactor: 1.0,
    pressStrengthFactor: 1.0,
    shotAimFactor: 1.0,
    shotRangeFactor: 1.0,
    facingToleranceFactor: 1.0,
    firstTouchRangeFactor: 1.0,
  },
  hard: {
    pressRadiusFactor: 1.3,
    pressStrengthFactor: 1.2,
    shotAimFactor: 0.7,       // narrower aim = more accurate
    shotRangeFactor: 1.3,     // longer shot range
    facingToleranceFactor: 1.3, // wider tolerance = shoots from more angles
    firstTouchRangeFactor: 1.2, // longer reaction range = faster reaction
  },
};

/**
 * Resolve a difficulty level string to its config.
 * Invalid or absent values return the medium (default) config.
 *
 * Deterministic: same input → same output.
 */
export function resolveDifficultyConfig(level?: string | DifficultyLevel): DifficultyConfig {
  if (level === "easy" || level === "medium" || level === "hard") {
    return DIFFICULTY_CONFIGS[level];
  }
  return DIFFICULTY_CONFIGS.medium;
}

// ---------------------------------------------------------------------------
// CpuObservation — minimal read-only subset of world state
// ---------------------------------------------------------------------------

/**
 * Minimal observation the CPU adapter needs from world state.
 *
 * scoreDifferential is an optional score-state awareness signal:
 * (cpuTeamGoals - opponentGoals).  Positive means CPU is ahead.
 */
/** A teammate position known to the CPU. */
export interface CpuTeammate {
  /** Unique identifier for the teammate player. */
  playerId: string;
  /** 2-D ground position on the pitch. */
  groundPosition: { x: number; y: number };
}

/**
 * Summary of a pass event relevant to CPU interception awareness.
 *
 * Extracted from SimulationEvent pass / lofted-pass / through-ball
 * events.  Contains only the fields the CPU adapter needs to compute
 * interception positioning.
 *
 * Provisional — not a measured PES 2017 concept.
 */
export interface PassEventInfo {
  /** Tick at which the pass was executed. */
  tick: number;
  /** Player ID of the passer (the player who touched the ball). */
  passerPlayerId: string;
  /** Team ID of the passer. */
  passerTeamId: string;
  /** Planar position of the passer at the moment of the pass. */
  passerPosition: { x: number; y: number };
  /** Planar velocity vector of the ball after the pass. */
  ballVelocity: { x: number; y: number };
}

export interface CpuObservation {
  /** All players on the pitch. */
  players: Array<{
    playerId: string;
    teamId: string;
    groundPosition: { x: number; y: number };
    linearVelocity: { x: number; y: number };
    bodyHeading: number;
    /**
     * Optional formation role that controls the strength of the
     * pull toward own goal.  When absent, the default 20% pull applies.
     * Roles: "defender" (strong pull), "midfielder" (moderate),
     * "attacker" (weak pull).
     */
    formationRole?: "defender" | "midfielder" | "attacker";
  }>;
  /** The independent ball state. */
  ball: {
    position: { x: number; y: number; z: number };
    linearVelocity: { x: number; y: number; z: number };
    regime: string;
    /**
     * The ball's authoritative last-touch reference (`null` while no player has
     * touched it since the last restart). Read directly from ball state — the
     * same field the match loop already uses for possession attribution — so it
     * is an observable signal, not privileged knowledge. Absent (undefined) in
     * legacy synthetic fixtures, which then keep the pre-anti-huddle behavior.
     */
    lastTouchRef?: string | null;
  };
  /** Pitch dimensions (metres). */
  pitchLength: number;
  pitchWidth: number;
  /** Team ID this CPU controls (determines attacking direction). */
  cpuTeamId?: string;
  /** Optional score differential (cpuGoals - opponentGoals). */
  scoreDifferential?: number;
  /** Optional teammate positions (same team, other controlled players). */
  teammates?: CpuTeammate[];
  /** The CPU's own controlled player ID. */
  controlledPlayerId?: string;
  /**
   * Optional formation position for the controlled player.
   * When present, the CPU blends between chasing the ball and
   * holding its formation position while in defense mode.
   * The position is team-specific and role-aware (deeper players
   * have formation closer to own goal).
   */
  formationPosition?: { x: number; y: number };
  /**
   * Optional team-level decision signal.
   * When present, the CPU adapter uses this shared strategy to
   * coordinate with teammates on the same team. The signal is
   * computed once per tick per team and injected into all CPU
   * adapters on that team.
   */
  teamDecision?: TeamDecision;
  /**
   * Optional recent pass events from the world state.
   * Used by interception-aware defense to detect opponent passes
   * and position toward the pass trajectory.
   *
   * Provisional — not a measured PES 2017 concept.
   */
  recentPassEvents?: PassEventInfo[];

  // -----------------------------------------------------------------
  // Tactical awareness signals (CPU-TACTICAL-AWARENESS)
  // All optional for backward compatibility.
  // -----------------------------------------------------------------

  /**
   * Current match lifecycle phase.
   * When present, the CPU adapter adjusts behavior:
   * - "playing": normal tactical decisions.
   * - "kickoff": structured/calm (first few ticks after restart).
   * - "goal"/"halftime"/"fulltime": hold position (no chasing).
   * - "corner-kick"/"throw-in"/"goal-kick": hold during set pieces.
   * Provisional — not a measured PES 2017 concept.
   */
  matchPhase?: "playing" | "goal" | "halftime" | "fulltime" | "kickoff" | "corner-kick" | "throw-in" | "goal-kick";

  /**
   * Current half number (1 or 2).
   * Used by the adapter to reset fatigue on half transitions.
   * Provisional — not a measured PES 2017 concept.
   */
  currentHalf?: number;

  /**
   * Provisional fatigue signal in [0, 1].
   * 0 = fresh (start of half), 1 = fully fatigued.
   * Derived deterministically by the CPU adapter's per-instance
   * tick accumulator: incremented each tick while matchPhase === "playing",
   * capped at FATIGUE_MAX_TICKS, reset on half transitions.
   * When absent, the adapter assumes fresh (no fatigue effects).
   * Provisional — not a measured PES 2017 concept.
   */
  fatigue?: number;

  // -----------------------------------------------------------------
  // Difficulty scaling (BROWSER-DIFFICULTY-SETTING)
  // All optional for backward compatibility.
  // -----------------------------------------------------------------

  /**
   * CPU difficulty level affecting decision quality and reaction speed.
   * - "easy": weaker CPU (wider aim, shorter range, slower reactions).
   * - "medium": baseline CPU (default when absent).
   * - "hard": stronger CPU (tighter aim, wider range, faster reactions).
   *
   * When absent, the adapter behaves identically to "medium" (all
   * difficulty factors = 1.0).  This preserves byte-identical behavior
   * for all existing tests that do not set difficulty.
   *
   * Provisional — not a measured PES 2017 concept.
   */
  difficulty?: DifficultyLevel;

  // -----------------------------------------------------------------
  // Defensive tackle authority (CPU-DEFENSIVE-TACKLE)
  // -----------------------------------------------------------------

  /**
   * Whether this CPU slot's controller exposes the defensive tackle buttons at
   * all — the same bits a human reaches through the keyboard bindings. It is an
   * input-device capability, not a knowledge advantage: with the flag absent or
   * false the adapter emits exactly the frames it emitted before CPU tackling
   * existed (byte-identical), which is the tackle-free control shape the
   * strictly-additive baselines pin. With it true the adapter may press
   * STANDING_TACKLE_BIT / SLIDE_TACKLE_BIT when, and only when, the shared
   * team authorisation (`teamDecision.tackleCommit`) names this player and the
   * observed geometry justifies the commit.
   *
   * Provisional — not a measured PES 2017 concept.
   */
  cpuDefensiveTackle?: boolean;

  // -----------------------------------------------------------------
  // Anti-huddle team behavior (5V5-KICKOFF-ANTI-HUDDLE)
  // -----------------------------------------------------------------

  /**
   * Kill switch for the anti-huddle team shape: kickoff freeze to fixed homes,
   * nearest-only chasing of the ball, and the single-cover designation that goes
   * with them. It is a configuration switch, not a knowledge advantage — it
   * never widens what the observation exposes. When the flag is absent the
   * behavior is active (any observation that carries the ball's authoritative
   * touch reference, i.e. every real runtime wiring); when it is explicitly false
   * the adapter emits exactly the frames it emitted before the objective existed
   * — every non-possessing body chasing the ball — which is the huddle shape the
   * discriminating guards stash back in.
   *
   * Provisional — not a measured PES 2017 concept.
   */
  cpuAntiHuddle?: boolean;

  // -----------------------------------------------------------------
  // Designated keeper (GK-5V5-ADAPTER-BEHAVIOR)
  // -----------------------------------------------------------------

  /**
   * Kill switch for the SMALL-SIDED goalkeeper role: the arc hold, the
   * no-field-chase exclusion, the save/claim reaction and the distribution
   * release. Unlike the anti-huddle shape this role is strictly opt-in — it is
   * live only when the wiring declares `true`, and with the flag absent or false
   * the adapter emits exactly the frames it emitted before any keeper existed.
   * It is a configuration switch, never extra knowledge: it widens nothing the
   * observation exposes.
   *
   * Provisional — model `gk-small-sided-v1`, not a measured PES 2017 concept.
   */
  gkBehavior?: boolean;

  /**
   * The match's keeper designation, team by team (spec §4): stable actor ids
   * assigned by the wiring from the layout the match starts with, never derived
   * from a ball fact. Both teams are carried so a side's restart-taker
   * selection can exclude the opposing keeper too. For a team the map omits, the
   * adapter-layer designation rule resolves it from the layout this observation
   * carries.
   */
  keeperPlayerIds?: Record<string, string>;

  /**
   * Canonical `shot` events the keeper may perceive, newest first, extracted
   * from the committed world events exactly the way recent passes already are.
   * Only the state the shot itself recorded is carried — never a future ball
   * state.
   *
   * Provisional — model `gk-small-sided-v1`.
   */
  recentShotEvents?: KeeperShotInfo[];
}

// ---------------------------------------------------------------------------
// buildCpuObservation — convert WorldState → CpuObservation
// ---------------------------------------------------------------------------

/**
 * Extract the minimal read-only fields the CPU adapter needs
 * from the authoritative world state.
 *
 * @param world — authoritative WorldState (not mutated).
 * @param cpuTeamId — team ID the CPU controls (determines attacking direction).
 * @param controlledPlayerId — optional explicit controlled player ID.
 *   When set, uses this ID; when not set, defaults to the first player.
 * @returns a CpuObservation containing the fields the CPU needs.
 */
export function buildCpuObservation(
  world: WorldState,
  cpuTeamId?: string,
  controlledPlayerId?: string,
): CpuObservation {
  // Determine pitch dimensions from scenario meta, falling back to defaults.
  let pitchLength = 105;
  let pitchWidth = 68;
  if (world.meta) {
    const pl = world.meta.pitchLength;
    const pw = world.meta.pitchWidth;
    if (typeof pl === "number") pitchLength = pl;
    if (typeof pw === "number") pitchWidth = pw;
  }

  // Resolve the exact player controlled by this CPU slot. Prefer the
  // control assignment supplied by the caller; fall back to the first player
  // on the requested team only for legacy single-CPU callers.
  const resolvedControlledPlayerId = controlledPlayerId ??
    (cpuTeamId ? world.players.find((p) => p.teamId === cpuTeamId)?.playerId : world.players[0]?.playerId);
  const teammates: CpuTeammate[] = [];
  if (cpuTeamId) {
    for (const p of world.players) {
      if (p.teamId === cpuTeamId && p.playerId !== resolvedControlledPlayerId) {
        teammates.push({
          playerId: p.playerId,
          groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
        });
      }
    }
  }

  const result: CpuObservation = {
    players: world.players.map((p) => ({
      playerId: p.playerId,
      teamId: p.teamId,
      groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
      linearVelocity: { x: p.linearVelocity.x, y: p.linearVelocity.y },
      bodyHeading: p.bodyHeading,
      formationRole: p.formationRole,
    })),
    ball: {
      position: {
        x: world.ball.position.x,
        y: world.ball.position.y,
        z: world.ball.position.z,
      },
      linearVelocity: {
        x: world.ball.linearVelocity.x,
        y: world.ball.linearVelocity.y,
        z: world.ball.linearVelocity.z,
      },
      regime: world.ball.regime,
      lastTouchRef: world.ball.lastTouchRef,
    },
    pitchLength,
    pitchWidth,
    cpuTeamId,
    teammates: teammates.length > 0 ? teammates : undefined,
    controlledPlayerId: resolvedControlledPlayerId,
  };

  // Derive a formation position for the controlled player: the pull
  // fraction toward own goal depends on the player's formation role.
  // When no role is set, defaults to the legacy 20% pull.
  if (cpuTeamId) {
    const ownGoalX = cpuTeamId === "team-b" ? pitchLength / 2 : -pitchLength / 2;
    const controlledPlayer = world.players.find(
      (p) => p.playerId === resolvedControlledPlayerId,
    );
    const resolvedX = controlledPlayer?.groundPosition.x ?? world.players[0]?.groundPosition.x ?? 0;
    const resolvedY = controlledPlayer?.groundPosition.y ?? world.players[0]?.groundPosition.y ?? 0;
    const formationRole = controlledPlayer?.formationRole;
    const pull = getFormationPull(formationRole);
    result.formationPosition = {
      x: resolvedX + (ownGoalX - resolvedX) * pull,
      y: resolvedY,
    };
  }

  // Extract recent pass events for interception awareness.
  // Only include pass / lofted-pass / through-ball events from the
  // last 10 ticks (provisional window at 60 Hz ≈ 0.17 s).
  const PASS_EVENT_WINDOW = 10;
  const passEvents: PassEventInfo[] = [];
  if (world.events.length > 0) {
    for (let i = world.events.length - 1; i >= 0; i--) {
      const evt = world.events[i];
      if (evt.kind !== "pass" && evt.kind !== "lofted-pass" && evt.kind !== "through-ball") {
        continue;
      }
      if (world.tick - evt.tick > PASS_EVENT_WINDOW) break;
      const p = evt.payload;
      const passInfo: PassEventInfo = {
        tick: evt.tick,
        passerPlayerId: p.playerId as string,
        passerTeamId: p.teamId as string,
        passerPosition: { x: (p.incoming as any).position.x, y: (p.incoming as any).position.y },
        ballVelocity: { x: (p.outgoing as any).vx, y: (p.outgoing as any).vy },
      };
      passEvents.push(passInfo);
    }
  }
  if (passEvents.length > 0) {
    result.recentPassEvents = passEvents;
  }

  // Extract recent canonical shot events for the designated keeper (spec §7).
  // Same backward walk and the same provisional perception window the pass
  // extraction already uses, so the keeper can only ever read a shot the world
  // has already committed — and it can read nothing about a shot that has not
  // happened yet. Ordered newest first.
  const shotEvents: KeeperShotInfo[] = [];
  if (world.events.length > 0) {
    for (let i = world.events.length - 1; i >= 0; i--) {
      const evt = world.events[i];
      if (evt.kind !== "shot") continue;
      if (world.tick - evt.tick > SHOT_EVENT_WINDOW_TICKS) break;
      const p = evt.payload;
      const incoming = p.incoming as
        { position?: { x?: number; y?: number } } | undefined;
      const outgoing = p.outgoing as
        { linearVelocity?: { x?: number; y?: number } } | undefined;
      if (!incoming?.position || !outgoing?.linearVelocity) continue;
      shotEvents.push({
        tick: evt.tick,
        eventId: evt.id,
        shooterPlayerId: p.playerId as string,
        shooterTeamId: p.teamId as string,
        ballPosition: {
          x: incoming.position.x as number,
          y: incoming.position.y as number,
        },
        ballVelocity: {
          x: outgoing.linearVelocity.x as number,
          y: outgoing.linearVelocity.y as number,
        },
      });
    }
  }
  if (shotEvents.length > 0) {
    result.recentShotEvents = shotEvents;
  }

  // Populate tactical awareness signals from deterministic world state.
  result.matchPhase = world.matchPhase;
  result.currentHalf = world.currentHalf;

  return result;
}

// ---------------------------------------------------------------------------
// CpuAdapter — simple chase-ball CPU opponent
// ---------------------------------------------------------------------------

/**
 * CPU adapter interface.
 *
 * Produces deterministic InputFrames from read-only world observations.
 * Used for AI_FALLBACK control slots where no human input is provided.
 */
export interface CpuAdapter {
  /**
   * Sample the current world observation into an InputFrame.
   *
   * @param tick — simulation tick.
   * @param observation — read-only snapshot of the world.
   * @returns an InputFrame stamped with the given tick.
   */
  sample(tick: number, observation: CpuObservation): InputFrame;

  /** Reset internal state (e.g. between runs). */
  reset(): void;
}

/** Internal state for the goal-aware CPU adapter. */
interface CpuInternalState {
  /** Whether the ball was within FIRST_TOUCH range on the previous sample. */
  ballWasInRange: boolean;
  /** Whether the CPU currently has ball possession. */
  hasPossession: boolean;
  /** Whether PASS_BIT was pressed on the previous tick (for edge detection). */
  passWasPressed: boolean;
  /** Remaining cooldown ticks after a shot (prevents immediate re-possession). */
  shotCooldownRemaining: number;
  /** Whether the current tick's SHOT_BIT is a lofted pass (no cooldown). */
  isLoftedPass: boolean;
  /** Consecutive ticks the CPU player has been displaced from formation.
   * Reset when the player is near their formation position. */
  formationDisplacementTicks: number;
  /**
   * Fixed kickoff home of this slot's body: the ground position it was first
   * observed at, i.e. the scenario-defined start position of the match. It is
   * captured once per match and never re-derived, so displaced bodies have a
   * fixed point to hold (5V5-KICKOFF-ANTI-HUDDLE). null until first sample.
   */
  kickoffHome: { x: number; y: number } | null;
  /**
   * Touch-reference value observed the moment play resumed from a core restart
   * hold whose reset does not clear the ball's reference (post-goal, halftime).
   * While the ball still carries exactly this stale reference it is the
   * untouched restart ball, so the freeze re-arms without any core change.
   * null while no restart baseline is pending (RESTART-ANTI-HUDDLE-COHERENCE).
   */
  restartTouchBaseline: string | null;
  /**
   * Ground point this body is frozen at for the duration of the current
   * untouched restart window, captured on the window's first sample. A kickoff
   * window starts with the body already at its kickoff home, so the anchor then
   * equals the accepted kickoff-home freeze value (5V5-KICKOFF-ANTI-HUDDLE
   * unchanged); a set-piece window anchors the body where the core's restart
   * placement left it. null while no window is open.
   */
  restartAnchor: { x: number; y: number } | null;
  /** Number of untouched restart windows this instance has entered. */
  untouchedWindowOrdinal: number;
  /** True when this instance's very first sample already carried an untouched ball. */
  firstWindowWasKickoff: boolean;
  /** Consecutive observed non-live match phases (restart hold length). */
  restartHoldTicks: number;
  /**
   * The ball's touch reference as observed on the previous sample. A restart
   * baseline arms only when the reference carried through the whole hold
   * unchanged — the signature of a reset that did not clear it (post-goal,
   * halftime), as opposed to a set-piece serve whose reference is freshly
   * written (or null) the tick the ball is placed.
   */
  lastSeenTouchRef: string | null | undefined;
  /** Consecutive ticks the team has had possession while this player
   * does NOT have the ball.  Used for cycling off-ball movement. */
  possessionDuration: number;

  // --- Interception awareness (provisional) ---
  /** Tick at which the current active pass was detected. */
  activePassTick: number;
  /** Passer position at the moment of the active pass. */
  activePasserPosition: { x: number; y: number };
  /** Planar ball velocity after the pass (direction vector of pass trajectory). */
  activePassBallVelocity: { x: number; y: number };
  /** Player ID of the passer. */
  activePasserId: string;

  /** Whether this player is currently making an overlapping run. */
  isOverlapping: boolean;

  // --- Fatigue accumulator (CPU-TACTICAL-AWARENESS) ---
  /** Accumulated ticks while matchPhase === "playing". Capped at FATIGUE_MAX_TICKS. */
  fatigueTicks: number;
  /** The last observed currentHalf, used to detect half transitions for reset. */
  lastCurrentHalf: number;

  // --- Defensive tackle commitment (CPU-DEFENSIVE-TACKLE) ---
  /**
   * Consecutive ticks the team's tackle authorisation has named this player.
   * The press only becomes legal once it reaches the provisional reaction
   * latency, so the CPU never acts on the first tick the geometry appears.
   */
  tackleHoldTicks: number;
  /**
   * Tick at which this body's own tackle attempt is released. Self-knowledge of
   * the action's prepare→active→recover commitment (the same versioned windows
   * the tackle system executes), used to avoid spamming presses into the
   * lock-out window. 0 while no attempt is outstanding.
   */
  tackleReleaseTick: number;

  // --- Designated keeper (GK-5V5-ADAPTER-BEHAVIOR) ---
  /**
   * Frozen keeper designation for this body's team, resolved once at the first
   * sample from the wiring's role assignment (or the adapter-layer layout rule).
   * Never re-derived from ball state afterwards (spec §4).
   */
  keeperPlayerId: string | undefined;
  /**
   * This keeper's live save/claim reaction (spec §7), advanced by the shared
   * production rule so evidence and behavior arm and disarm identically.
   */
  keeperReaction: KeeperReactionState;
  /** Whether the ball was inside `save_claim_reach_radius` last sample. */
  ballWasInSaveReach: boolean;
}

/**
 * Find the best teammate to pass to.
 *
 * Filters to teammates in a forward direction (toward opponent goal)
 * and returns the best target.  Falls back to undefined when no
 * forward teammate exists.
 *
 * When `opponents` is provided, target selection considers defender
 * proximity: unmarked teammates are preferred over marked ones, and
 * among equally marked teammates the closest to the passer wins.
 *
 * Direction is forward when the dot product of
 * (teammatePos - playerPos) with the attack direction is positive.
 * Attack direction: +x for team-a, -x for team-b.
 */
function getBestTeammateTarget(
  teammates: CpuTeammate[],
  playerPos: { x: number; y: number },
  cpuTeamId: string,
  opponents?: Array<{ x: number; y: number }>,
): { x: number; y: number } | undefined {
  const attackingX = cpuTeamId === "team-b" ? -1 : 1;

  // Collect forward teammates with distance-to-passer.
  const forward: Array<{
    x: number;
    y: number;
    distToPlayer: number;
  }> = [];

  for (const tm of teammates) {
    const dx = tm.groundPosition.x - playerPos.x;
    const dy = tm.groundPosition.y - playerPos.y;

    // Forward check: dot product with attack direction > 0.
    if (dx * attackingX <= 0) {
      continue;
    }

    forward.push({
      x: tm.groundPosition.x,
      y: tm.groundPosition.y,
      distToPlayer: Math.sqrt(dx * dx + dy * dy),
    });
  }

  if (forward.length === 0) return undefined;

  // When no opponent data, pick nearest forward (legacy behavior).
  if (!opponents || opponents.length === 0) {
    let best = forward[0];
    for (const tm of forward) {
      if (tm.distToPlayer < best.distToPlayer) {
        best = tm;
      }
    }
    return { x: best.x, y: best.y };
  }

  // Defender-aware selection: prefer unmarked teammates, then closer ones.
  let best = forward[0];
  let bestScore = -Infinity;

  for (const tm of forward) {
    // Minimum distance from this teammate to any opponent.
    let minOppDist = Infinity;
    for (const opp of opponents) {
      const odx = opp.x - tm.x;
      const ody = opp.y - tm.y;
      const oppDist = Math.sqrt(odx * odx + ody * ody);
      if (oppDist < minOppDist) minOppDist = oppDist;
    }

    const isMarked = minOppDist < PASS_DEFENDER_MARKING_RADIUS;
    // Unmarked (2000) vs marked (1000) priority, minus distance penalty.
    const priority = isMarked ? 1000 : 2000;
    const score = priority - tm.distToPlayer;

    if (score > bestScore) {
      bestScore = score;
      best = tm;
    }
  }

  return { x: best.x, y: best.y };
}

/**
 * Normalize a 2-D direction vector, clamping the magnitude to 1.
 */
function normalizeVec2(x: number, y: number): { dx: number; dy: number } {
  const len = Math.sqrt(x * x + y * y);
  if (len < 0.001) return { dx: 0, dy: 0 };
  return { dx: x / len, dy: y / len };
}

// ---------------------------------------------------------------------------
// Constants for goal-awareness
// ---------------------------------------------------------------------------

/** Goal centre x-coordinate (half of 105 m pitch). */
const GOAL_CENTRE_X = 52.5;

/**
 * Goal lateral half-width (metres).
 * Full goal width = 7.32 m → half-width = 3.66 m.
 * Provisional: unmeasured PES 2017 value.
 */
const GOAL_HALF_WIDTH = 3.66;

/** Possession range — ball within this distance = in possession (metres). */
const POSSESSION_RANGE = 2;

/** Close-range shot threshold (metres). Within this distance, always shoot. */
const SHOT_RANGE_CLOSE = 5;

/** Wide-range shot threshold (metres). Beyond this, never auto-shoot. */
const SHOT_RANGE_WIDE = 20;

/** First-touch range — press FIRST_TOUCH within this distance (metres). */
const FIRST_TOUCH_RANGE = 1.5;

/** Ball horizontal speed threshold for FIRST_TOUCH (m/s). */
const FIRST_TOUCH_SPEED_THRESHOLD = 2;

/** Ball horizontal speed threshold for possession (m/s). */
const POSSESSION_SPEED_THRESHOLD = 3;

/** Facing tolerance for close-range shooting (radians, ±π/3 ≈ 60°). */
const FACING_TOLERANCE_CLOSE = Math.PI / 3;

/**
 * Facing tolerance for wide-range shooting (radians, ±π/2 ≈ 90°).
 * Provisional: unmeasured PES 2017 value.
 */
const FACING_TOLERANCE_WIDE = Math.PI / 2;

/**
 * Facing tolerance when CPU is behind (aggressive).
 * Provisional: unmeasured PES 2017 value.
 */
const FACING_TOLERANCE_BACKUP = Math.PI * 0.75;

/**
 * Post-shot cooldown (ticks). Prevents immediate re-possession
 * by suppressing FIRST_TOUCH after a shot.  15 ticks ≈ 0.25 s at 60 Hz.
 * Provisional: unmeasured PES 2017 value.
 */
const SHOT_COOLDOWN_TICKS = 15;

/** Minimum possession range when in shot cooldown.
 * Extends the effective POSSESSION_RANGE during cooldown
 * so the CPU doesn't lose possession the moment the ball
 * stops moving right next to it.
 * Provisional: unmeasured PES 2017 value.
 */
const POSSESSION_RANGE_COOLDOWN = 3;

/**
 * Distance (metres) at which the CPU fully commits to formation
 * positioning during defense.  Below this threshold: chase only.
 * 1.5× this value: formation fully active.
 *
 * The blend is only applied when the ball is behind the player
 * (toward own goal); when the ball is ahead, the CPU chases fully
 * regardless of distance.
 *
 * Provisional placeholder — not a measured PES value.
 */
const CHASE_FORMATION_THRESHOLD = 20;

/**
 * Formation recovery rate (ticks⁻¹). Controls how quickly the CPU
 * returns to formation position after being displaced by gameplay.
 * A value of 0.02 means the recovery weight grows by 0.02 per tick
 * of displacement (capped at 1). This gives a natural return-to-shape
 * that complements the existing 20% pull toward own goal.
 *
 * Provisional placeholder — not a measured PES value.
 */
const FORMATION_RECOVERY_RATE = 0.02;

// ---------------------------------------------------------------------------
// Off-ball attacking movement constants (provisional)
// ---------------------------------------------------------------------------

/**
 * Target distance (metres) from opponent goal for off-ball attackers
 * during team possession.  Attackers push ahead of the ball toward
 * the goal to create passing options.
 *
 * Provisional placeholder — not a measured PES value.
 */
const OFFBALL_FORWARD_PUSH_ATTACKER = 15;

/**
 * Target distance (metres) from opponent goal for off-ball midfielders
 * during team possession.  Midfielders position between defenders
 * and attackers to create passing lanes.
 *
 * Provisional placeholder — not a measured PES value.
 */
const OFFBALL_FORWARD_PUSH_MIDFIELDER = 25;

/**
 * Default target distance (metres) from opponent goal for off-ball
 * players with no recognised formation role.
 *
 * Provisional placeholder — not a measured PES value.
 */
const OFFBALL_FORWARD_PUSH_BASE = 20;

/**
 * Multiplier applied to off-ball forward push when team strategy is
 * ATTACK.  Attackers push 20% further forward.
 *
 * Provisional placeholder — not a measured PES value.
 */
const ATTACK_PHASE_FORWARD_MULTIPLIER_ATTACKER = 1.2;

/**
 * Multiplier applied to off-ball forward push when team strategy is
 * ATTACK.  Midfielders push 15% further forward.
 *
 * Provisional placeholder — not a measured PES value.
 */
const ATTACK_PHASE_FORWARD_MULTIPLIER_MIDFIELDER = 1.15;

/**
 * Tick period for the midfield cycling pattern.  During sustained
 * possession, midfielders alternate pushing forward and dropping
 * back every CYCLING_HALF_PERIOD ticks.
 *
 * Provisional placeholder — not a measured PES value.
 */
const CYCLING_HALF_PERIOD = 30;

/**
 * Cycling amplitude (metres) added or subtracted from the midfielder
 * base target to create alternating forward/drop movement.
 *
 * Provisional placeholder — not a measured PES value.
 */
const CYCLING_AMPLITUDE = 5;

// ---------------------------------------------------------------------------
// Attacking organization constants (provisional)
// ---------------------------------------------------------------------------

/**
 * Lateral offset (metres) applied to a teammate making an overlapping
 * run when the ball carrier is in a wide zone.  The overlap curves
 * around the outside of the carrier, creating a numerical advantage.
 *
 * Provisional placeholder — not a measured PES 2017 value.
 */
const OVERLAP_LATERAL_OFFSET = 10;

/**
 * Minimum distance (metres) between attacking teammates during team
 * possession.  Attacking players adjust laterally to maintain this
 * spacing and avoid clustering near the ball.
 *
 * Provisional placeholder — not a measured PES 2017 value.
 */
const ATTACKING_SPACING_MIN = 10;

/**
 * Maximum distance (metres) between attacking teammates.  If two
 * attackers are farther apart than this, the closer one moves
 * toward the farther one to tighten the attacking shape.
 *
 * Provisional placeholder — not a measured PES 2017 value.
 */
const ATTACKING_SPACING_MAX = 15;

/**
 * Number of ticks after gaining possession during which a forward
 * delays their run to simulate staying onside.  At 60 Hz,
 * 20 ticks ≈ 0.33 s.
 *
 * Provisional placeholder — not a measured PES 2017 value.
 */
const DELAYED_RUN_TICKS = 20;

/**
 * Lateral boundary (metres from centre) at which the ball carrier
 * is considered to be in a "wide" zone.  Used for the cross vs
 * through-ball decision: wide → prefer crossing, central → prefer
 * through-ball.
 *
 * Provisional placeholder — not a measured PES 2017 value.
 */
const WIDE_ZONE_THRESHOLD = 15;

// ---------------------------------------------------------------------------
// Attacking organization helpers (provisional)
// ---------------------------------------------------------------------------

/**
 * Check if the ball carrier is in a wide zone (near the touchline).
 *
 * Wide zones are defined by lateral distance from pitch centre
 * exceeding WIDE_ZONE_THRESHOLD.
 */
function isWideZone(
  carrierY: number,
  pitchWidth: number,
): boolean {
  const centreY = 0;
  return Math.abs(carrierY - centreY) > WIDE_ZONE_THRESHOLD;
}

/**
 * Find the closest teammate to the given position, excluding the
 * specified player ID.
 */
function findClosestTeammate(
  teammates: CpuTeammate[],
  pos: { x: number; y: number },
  excludeId: string,
): CpuTeammate | undefined {
  let best: CpuTeammate | undefined;
  let bestDist = Infinity;
  for (const tm of teammates) {
    if (tm.playerId === excludeId) continue;
    const dx = tm.groundPosition.x - pos.x;
    const dy = tm.groundPosition.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      best = tm;
    }
  }
  return best;
}

/**
 * Find the teammate closest to a given position among players with
 * a specific formation role.  Returns undefined when no matching
 * teammate exists.
 */
function findClosestTeammateByRole(
  players: CpuObservation["players"],
  cpuTeamId: string,
  pos: { x: number; y: number },
  excludeId: string,
  role: "defender" | "midfielder" | "attacker",
): CpuObservation["players"][0] | undefined {
  let best: CpuObservation["players"][0] | undefined;
  let bestDist = Infinity;
  for (const p of players) {
    if (p.teamId !== cpuTeamId) continue;
    if (p.playerId === excludeId) continue;
    if (p.formationRole !== role) continue;
    const dx = p.groundPosition.x - pos.x;
    const dy = p.groundPosition.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}

/**
 * Find the teammate with a specific formation role who is farthest
 * forward (highest X in attack direction).
 */
function findFurthestForwardTeammateByRole(
  players: CpuObservation["players"],
  cpuTeamId: string,
  excludeId: string,
  attackingX: number,
  role: "defender" | "midfielder" | "attacker",
): CpuObservation["players"][0] | undefined {
  let best: CpuObservation["players"][0] | undefined;
  let bestForward = -Infinity;
  for (const p of players) {
    if (p.teamId !== cpuTeamId) continue;
    if (p.playerId === excludeId) continue;
    if (p.formationRole !== role) continue;
    const forward = p.groundPosition.x * attackingX;
    if (forward > bestForward) {
      bestForward = forward;
      best = p;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Defensive behavior constants (provisional)
// ---------------------------------------------------------------------------

/**
 * Radius (metres) within which the nearest defender presses the ball
 * carrier directly instead of marking space.
 * Provisional placeholder — not a measured PES value.
 */
const PRESS_RADIUS = 12;

/**
 * Default offset (metres) between a marking defender and their target,
 * measured toward own goal. At this distance the defender is positioned
 * between the marked attacker and the own goal.
 * Provisional placeholder — not a measured PES value.
 */
const MARKING_DISTANCE = 5;

/**
 * Strength multiplier applied to the press direction vector when the
 * nearest defender presses the ball carrier.  Values > 1 produce a
 * more aggressive press; < 1 a more cautious approach.
 * Provisional placeholder.
 */
const PRESS_STRENGTH = 1.3;

// ---------------------------------------------------------------------------
// Interception awareness constants (provisional)
// ---------------------------------------------------------------------------

/**
 * Maximum tick age (ticks) for a pass event to be considered active
 * for interception.  After this window, the pass is considered
 * completed or stale and the defender reverts to normal chase.
 *
 * At 60 Hz, 60 ticks ≈ 1 second.
 * Provisional placeholder — not a measured PES 2017 value.
 */
const PASS_ACTIVE_TICKS = 60;

/**
 * Maximum distance (metres) at which a CPU defender will consider
 * intercepting a pass.  If the defender is farther from the pass
 * trajectory than this, it falls back to normal chase/marking.
 *
 * Provisional placeholder — not a measured PES 2017 value.
 */
const INTERCEPTION_RANGE = 25;

// ---------------------------------------------------------------------------
// Defensive organization constants (provisional)
// ---------------------------------------------------------------------------

/**
 * Number of defensive zones the pitch is divided into (own, center, attacking).
 * Each zone spans pitchLength / 3.  Defenders are assigned to zones based
 * on their current position, and zone-based marking tracks opponents
 * within each zone.
 *
 * Provisional — not a measured PES 2017 value.
 */
const DEFENSIVE_ZONE_COUNT = 3;

/**
 * Sprint multiplier applied to the nearest defender when the ball enters
 * their zone (press trigger).  Higher values produce a more aggressive
 * press; values below 1 produce a more cautious approach.
 *
 * Provisional — not a measured PES 2017 value.
 */
const ZONE_PRESS_SPRINT_BOOST = 1.2;

/**
 * Default sprint value for the CPU adapter.  When the ball is NOT in a
 * zone-based press trigger, the nearest defender uses this sprint level.
 *
 * Provisional — not a measured PES 2017 value.
 */
const DEFAULT_SPRINT = 1;

/**
 * Maximum lateral shift (metres) applied by defensive line coordination.
 * Prevents defenders from overcommitting to the line when a teammate
 * presses.
 *
 * Provisional — not a measured PES 2017 value.
 */
const LINE_COORDINATION_MAX_SHIFT = 10;

/**
 * Strength of the cover-shadow pull (0–1).  Higher values make defenders
 * more strongly position between the ball and the most threatening
 * attacker; 0 disables cover shadow entirely.
 *
 * Provisional — not a measured PES 2017 value.
 */
const COVER_SHADOW_STRENGTH = 0.4;

/**
 * Weight of the defensive line pull relative to cover-shadow (0–1).
 * Higher values make defenders prefer holding the line; lower values
 * favour cover-shadow positioning.
 *
 * Provisional — not a measured PES 2017 value.
 */
const LINE_WEIGHT = 0.35;

// ---------------------------------------------------------------------------
// Cover player constants (SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH, provisional)
// ---------------------------------------------------------------------------

/**
 * Distance (metres) behind the presser at which the cover defender
 * positions.  The cover sits between the presser and own goal,
 * blocking the through lane.
 *
 * Provisional — not a measured PES 2017 value.
 */
const COVER_DISTANCE_BEHIND_PRESSER = 6;

/**
 * Lateral offset (metres) for the cover defender relative to the
 * ball-to-presser line.  Signed offset placed between the presser
 * and the most threatening opponent.
 *
 * Provisional — not a measured PES 2017 value.
 */
const COVER_LATERAL_OFFSET = 3;

/**
 * Weight (0–1) blending the cover player's own chase direction with
 * the computed cover position.  At 1 the cover goes exactly to the
 * computed position; at 0 the cover chases normally.
 *
 * Provisional — not a measured PES 2017 value.
 */
const COVER_BLEND_WEIGHT = 0.7;

/**
 * Maximum distance (metres) at which a defender is considered for
 * the cover assignment.  Beyond this range the cover mechanism
 * does not activate (falls back to zone marking).
 *
 * Provisional — not a measured PES 2017 value.
 */
const COVER_ACTIVATION_RANGE = 20;

// ---------------------------------------------------------------------------
// Off-ball support constants (SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH, provisional)
// ---------------------------------------------------------------------------

/**
 * Minimum distance (metres) that off-ball attacking players should
 * maintain from the ball carrier.  Prevents collapsing onto the ball.
 *
 * Provisional — not a measured PES 2017 value.
 */
const SUPPORT_MIN_DISTANCE = 6;

/**
 * Maximum distance (metres) that off-ball attackers should maintain
 * from the ball carrier.  Beyond this they drift closer to maintain
 * passing-lane viability.
 *
 * Provisional — not a measured PES 2017 value.
 */
const SUPPORT_MAX_DISTANCE = 18;

/**
 * Weight (0–1) blending the support position with the default
 * forward-run behavior.  Higher values enforce support spacing
 * more strongly.
 *
 * Provisional — not a measured PES 2017 value.
 */
const SUPPORT_BLEND_WEIGHT = 0.5;

// ---------------------------------------------------------------------------
// Defensive organization helpers (provisional)
// ---------------------------------------------------------------------------

/**
 * Determine the defensive zone for a given x-coordinate.
 *
 * Zones are defined as thirds of the pitch, measured from the
 * defending team's own goal:
 *  - "defensive": closest third to own goal
 *  - "middle": center third
 *  - "attacking": farthest third from own goal
 *
 * team-a attacks +x, own goal at -pitchLength/2.
 * team-b attacks -x, own goal at +pitchLength/2.
 *
 * Deterministic: same inputs → same result.
 */
function determineZone(
  x: number,
  pitchLength: number,
  cpuTeamId: string,
): "defensive" | "middle" | "attacking" {
  const thirdWidth = pitchLength / 3;
  if (cpuTeamId === "team-a") {
    if (x < -pitchLength / 2 + thirdWidth) return "defensive";
    if (x > pitchLength / 2 - thirdWidth) return "attacking";
    return "middle";
  }
  // team-b attacks -x, own goal at +pitchLength/2
  if (x > pitchLength / 2 - thirdWidth) return "defensive";
  if (x < -pitchLength / 2 + thirdWidth) return "attacking";
  return "middle";
}

/**
 * Compute the cover-shadow position for a defender.
 *
 * The cover-shadow is the position between the ball and the most
 * threatening opponent (closest to own goal).  The defender positions
 * themselves at `coverFraction` of the way from the ball toward the
 * opponent, blocking the passing lane.
 *
 * When `coverFraction` is 0 the defender holds at the ball position;
 * when 1 the defender sits at the opponent position.
 *
 * Deterministic: same inputs → same result.
 */
function computeCoverShadow(
  ballX: number,
  ballY: number,
  opponentX: number,
  opponentY: number,
  coverFraction: number,
): { x: number; y: number } {
  return {
    x: ballX + (opponentX - ballX) * coverFraction,
    y: ballY + (opponentY - ballY) * coverFraction,
  };
}

/**
 * Compute the average y-coordinate of pressing defenders in a team.
 *
 * Used by defensive line coordination: non-pressing defenders shift
 * their y-coordinate toward this average to maintain a flat defensive
 * line when a teammate commits to pressing.
 *
 * @param players — all players in the observation.
 * @param cpuTeamId — the defending team ID.
 * @param pressingPlayerId — player ID of the pressing defender (excluded from average).
 * @returns the average y-coordinate, or undefined if no pressing defenders exist.
 */
function computePressingDefendersAvgY(
  players: CpuObservation["players"],
  cpuTeamId: string,
  pressingPlayerId: string,
): number | undefined {
  let sumY = 0;
  let count = 0;
  for (const p of players) {
    if (p.teamId !== cpuTeamId) continue;
    if (p.formationRole !== "defender") continue;
    if (p.playerId === pressingPlayerId) continue;
    // A defender is considered "pressing" when they are the nearest to the ball.
    // We detect this by checking if they are within PRESS_RADIUS of the ball
    // in the current tick.  However, we don't have the ball position here.
    // Instead, we simply average ALL other defenders — the effect is that
    // non-pressing defenders align with the pressing group.
    sumY += p.groundPosition.y;
    count++;
  }
  if (count === 0) return undefined;
  return sumY / count;
}

// ---------------------------------------------------------------------------
// Pass variety constants (provisional)
// ---------------------------------------------------------------------------

/**
 * Distance (metres) at which the CPU switches from ground pass (PASS_BIT)
 * to lofted/chip pass (SHOT_BIT aimed at teammate). Adjusted by urgency:
 * higher urgency lowers the threshold (lofted passes sooner).
 * Provisional placeholder — not a measured PES value.
 */
const LOFT_PASS_DISTANCE_THRESHOLD = 15;

/**
 * Radius (metres) within which an opposing player is considered to be
 * "marking" a teammate. Teammates inside this radius from any opponent
 * are treated as less safe pass targets.
 * Provisional placeholder — not a measured PES value.
 */
const PASS_DEFENDER_MARKING_RADIUS = 5;

// ---------------------------------------------------------------------------
// Anti-huddle: kickoff homes, kickoff freeze, nearest-only chase (provisional)
// ---------------------------------------------------------------------------

/**
 * Version id of the provisional anti-huddle parameter set, recorded in
 * evidence so a tuned value can never be mistaken for a measured PES 2017 one.
 */
export const ANTI_HUDDLE_V1_ID = "anti-huddle-v1";

/**
 * Planar slack (metres) inside which a body frozen at its kickoff home issues
 * no movement at all. Larger values leave the kickoff shape visibly still;
 * smaller ones make a held body jitter as locomotion overshoots.
 * Provisional placeholder — not a measured PES value.
 */
const KICKOFF_FREEZE_HOME_TOLERANCE = 0.75;

/**
 * Planar slack (metres) inside which a non-chasing body that has drifted back
 * to its formation home stops steering, so holding shape does not jitter.
 * Provisional placeholder — not a measured PES value.
 */
const CHASE_NEAREST_HOME_TOLERANCE = 0.75;

/**
 * Consecutive observed hold ticks required before a resumption arms a restart
 * freeze window (RESTART-ANTI-HUDDLE-COHERENCE). Every core restart window
 * holds play for dozens of ticks before its reset/serve lands; a lifecycle
 * wiring that stamps a non-playing phase for a single tick and immediately
 * returns to "playing" without resetting anything is not a restart.
 * Provisional placeholder — not a measured PES value. Exported so evidence
 * drivers mirror the exact arming rule the adapters act on.
 */
export const RESTART_HOLD_MIN_TICKS = 2;

/**
 * Ticks a committed `shot` event stays perceptible to a keeper, mirroring the
 * provisional window the accepted pass-awareness extraction already uses. The
 * window is a perception bound, not a reaction threshold: the model's declared
 * reaction window (`keeper_reaction_window_ticks`) is checked against the tick a
 * keeper actually initiates on.
 *
 * Provisional — model `gk-small-sided-v1`.
 */
export const SHOT_EVENT_WINDOW_TICKS = 10;

/**
 * The press/cover pair of a team, computed the way the accepted cover mechanism
 * computes it: the presser is the nearest non-attacker to the ball, the cover is
 * the second-nearest non-attacker.
 *
 * Exported so per-tick evidence records the assignment the adapter actually
 * acts on instead of re-deriving it somewhere else.
 *
 * `excludedPlayerId` (GK-5V5-ADAPTER-BEHAVIOR) removes one body from the pair —
 * the production wiring passes the designated keeper, which is confined to its
 * goal arc and can therefore be neither presser nor cover. Absent, the accepted
 * pair is unchanged.
 */
export function findPressCoverPair(
  observation: CpuObservation,
  teamId: string,
  excludedPlayerId?: string,
): {
  presserId: string | undefined;
  presserDistance: number;
  coverId: string | undefined;
  coverDistance: number;
} {
  let presserId: string | undefined;
  let presserDistance = Infinity;
  let coverId: string | undefined;
  let coverDistance = Infinity;
  for (const p of observation.players) {
    if (p.teamId !== teamId) continue;
    // Attackers stay forward for support and never form the press pair.
    if (p.formationRole === "attacker") continue;
    if (excludedPlayerId !== undefined && p.playerId === excludedPlayerId) continue;
    const dx = observation.ball.position.x - p.groundPosition.x;
    const dy = observation.ball.position.y - p.groundPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < presserDistance) {
      coverId = presserId;
      coverDistance = presserDistance;
      presserId = p.playerId;
      presserDistance = dist;
    } else if (dist < coverDistance) {
      coverId = p.playerId;
      coverDistance = dist;
    }
  }
  return { presserId, presserDistance, coverId, coverDistance };
}

/**
 * The single body allowed to break the kickoff freeze: the nearest player in
 * the match to the untouched ball, i.e. the kick taker. Ties resolve by
 * ascending playerId so the choice never depends on array order.
 *
 * With the keeper role live (GK-5V5-ADAPTER-BEHAVIOR) each team's designated
 * keeper is dropped from that selection: a keeper is never sent out of its goal
 * arc to take a restart. A restart whose serve lands inside a keeper's own arc
 * is still resolved, because that body is separately exempt while it is already
 * at the ball. If a team's keeper is the only body in the match the accepted
 * selection stands, so an untouched ball can never become unplayable.
 */
function findKickoffTaker(
  observation: CpuObservation,
  excludeKeeper = false,
): string | undefined {
  const nearestExcluding = (skip: string[]): string | undefined => {
    let bestId: string | undefined;
    let bestDist = Infinity;
    for (const p of observation.players) {
      if (skip.includes(p.playerId)) continue;
      const dx = observation.ball.position.x - p.groundPosition.x;
      const dy = observation.ball.position.y - p.groundPosition.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (
        dist < bestDist ||
        (dist === bestDist && bestId !== undefined && p.playerId < bestId)
      ) {
        bestDist = dist;
        bestId = p.playerId;
      }
    }
    return bestId;
  };
  const keepers = excludeKeeper ? keeperIdsForMatch(observation) : [];
  if (keepers.length === 0) return nearestExcluding([]);
  // Every body in the match is a keeper: the accepted selection stands.
  return nearestExcluding(keepers) ?? nearestExcluding([]);
}

/**
 * The designated keeper of every team visible in this observation. The
 * taker-selection fallback needs both teams' designations, while a per-team
 * caller only ever reads its own.
 */
function keeperIdsForMatch(observation: CpuObservation): string[] {
  if (!isKeeperBehaviorActive(observation)) return [];
  const teams = new Set<string>();
  for (const p of observation.players) teams.add(p.teamId);
  const ids: string[] = [];
  for (const teamId of teams) {
    const keeperId = resolveKeeperPlayerId(observation, teamId);
    if (keeperId !== undefined) ids.push(keeperId);
  }
  return ids;
}

/** Per-team, per-tick anti-huddle chase assignment. */
export interface ChaseRoleAssignment {
  /** The single body allowed to converge on the ball for this team. */
  chaserPlayerId: string | undefined;
  /** The second-closest non-attacker that screens behind the presser. */
  coverPlayerId: string | undefined;
  /** Whether the ball carries a touch reference (kickoff freeze is over). */
  ballTouched: boolean;
  /**
   * The one body in the match allowed to break the kickoff freeze: the closest
   * player of either team to the untouched ball — the kick taker. Ties resolve
   * by ascending playerId, so every wiring that sees the same observation picks
   * the same body.
   */
  kickoffTakerId: string | undefined;
  /**
   * The team's designated keeper for this tick, or `undefined` when no keeper
   * role is live (GK-5V5-ADAPTER-BEHAVIOR). Recorded here so per-tick evidence
   * and the chase assignment come from one production call.
   */
  keeperPlayerId: string | undefined;
}

/**
 * Assign this tick's chase roles for one team: exactly one chaser — the shared
 * press designation of `designatePresser`, i.e. the same body the accepted press
 * block and tackle authorisation act on — and exactly one cover, the
 * second-closest non-attacker.
 *
 * Pure function of the observation — the same information the accepted tackle
 * authorisation already reads. Deterministic: same observation → same roles.
 */
export function assignChaseRoles(
  observation: CpuObservation,
  teamId: string,
  /**
   * Window-aware untouched signal (RESTART-ANTI-HUDDLE-COHERENCE). The
   * production adapter passes the same flag its freeze acts on, so a restart
   * whose ball carries a stale touch reference (post-goal/halftime reset) still
   * designates one kick taker. Absent, the signal is derived from the
   * reference itself — the accepted kickoff behaviour, byte-identical.
   */
  untouchedOverride?: boolean,
): ChaseRoleAssignment {
  const ballTouched = untouchedOverride !== undefined
    ? !untouchedOverride
    : observation.ball.lastTouchRef !== undefined &&
      observation.ball.lastTouchRef !== null;
  const presser = designatePresser(observation, teamId);
  return {
    chaserPlayerId: presser.playerId,
    // The press pair only forms once the ball is in play; the kick taker only
    // matters while it is not. Each window needs one pass over the bodies.
    coverPlayerId: ballTouched
      ? findPressCoverPair(observation, teamId, resolveKeeperPlayerId(observation, teamId)).coverId
      : undefined,
    ballTouched,
    kickoffTakerId: ballTouched
      ? undefined
      : findKickoffTaker(observation, isKeeperBehaviorActive(observation)),
    keeperPlayerId: resolveKeeperPlayerId(observation, teamId),
  };
}

// ---------------------------------------------------------------------------
// Role-aware formation pull (provisional PES 2017 values)
// ---------------------------------------------------------------------------

/**
 * Pull fraction toward own goal for each formation role.
 *  - defender:  40%  → stays deep, holds defensive shape
 *  - midfielder: 20% → moderate positioning (legacy default)
 *  - attacker:   5%  → pushes forward, minimal pull
 *
 * A value of 0 means the player stays at their current X.
 * A value of 1 means full pull to own-goal X.
 *
 * Provisional: unmeasured PES 2017 values.
 */
const DEFENDER_FORMATION_PULL = 0.4;
const MIDFIELDER_FORMATION_PULL = 0.2;
const ATTACKER_FORMATION_PULL = 0.05;

/**
 * Compute the formation pull factor for a given role.
 * Returns the default 20% when no role is specified (backward compat).
 */
function getFormationPull(role?: "defender" | "midfielder" | "attacker"): number {
  if (role === "defender") return DEFENDER_FORMATION_PULL;
  if (role === "midfielder") return MIDFIELDER_FORMATION_PULL;
  if (role === "attacker") return ATTACKER_FORMATION_PULL;
  return MIDFIELDER_FORMATION_PULL; // default fallback (20%)
}

// ---------------------------------------------------------------------------
// Pass variety helpers (provisional)
// ---------------------------------------------------------------------------

/** Ground or lofted pass type. */
type PassType = "ground" | "lofted";

/**
 * Choose between ground pass and lofted pass based on distance and urgency.
 *
 * Longer distances and higher urgency (behind in score) favor lofted
 * passes (SHOT_BIT, higher exit speed + vertical component).  Short
 * distances and low urgency (ahead) favor ground passes (PASS_BIT).
 *
 * Provisional: unmeasured PES 2017 values.
 */
function choosePassType(
  distanceToTarget: number,
  urgency: number,
): PassType {
  const adjustedThreshold = LOFT_PASS_DISTANCE_THRESHOLD / urgency;
  return distanceToTarget >= adjustedThreshold ? "lofted" : "ground";
}

/**
 * Extract opponent positions from the observation for defender proximity
 * checks during target selection.
 */
function getOpponentPositions(
  observation: CpuObservation,
  cpuTeamId: string,
): Array<{ x: number; y: number }> {
  const opponentTeamId = cpuTeamId === "team-a" ? "team-b" : "team-a";
  return observation.players
    .filter((p) => p.teamId === opponentTeamId)
    .map((p) => ({ x: p.groundPosition.x, y: p.groundPosition.y }));
}

/**
 * Get the opponent goal x-coordinate for a given team.
 *
 * Convention: team-a attacks +x, team-b attacks -x.
 */
function getOpponentGoalX(cpuTeamId: string): number {
  if (cpuTeamId === "team-b") return -GOAL_CENTRE_X;
  return GOAL_CENTRE_X;
}

/**
 * Simple deterministic hash: map a uint32 tick to a float in [-0.5, 0.5].
 * Uses a lightweight XOR-shift mixing approach.
 *
 * This is NOT a PRNG — it is a hash used only for deterministic
 * lateral aim offsets.  Same (tick) always produces the same value.
 */
function tickToFloat01(tick: number): number {
  let x = (tick ^ 0x5bd1e995) | 0;
  x = ((x >>> 13) ^ x) | 0;
  x = (x * 0x5bd1e995) | 0;
  x = (x ^ (x >>> 15)) | 0;
  // Map signed int → [0, 1) via unsigned conversion, then → [-0.5, 0.5].
  return ((x >>> 0) / 4294967296) - 0.5;
}

/**
 * Deterministic lateral shot aim offset (metres) within the goal.
 *
 * Aims at a random offset in [-GOAL_HALF_WIDTH, GOAL_HALF_WIDTH]
 * relative to the goal centre, seeded by tick.  Same tick → same offset.
 *
 * Provisional: unmeasured PES 2017 value.
 */
function getShotAimOffsetY(tick: number): number {
  return tickToFloat01(tick) * GOAL_HALF_WIDTH * 2;
}

/**
 * Compute score-state urgency multiplier (provisional continuous gradient).
 *
 * Replaces the hard ±2 threshold with a continuous mapping:
 * - scoreDiff = 0 → urgency = 1 (neutral)
 * - scoreDiff = -3 → urgency = 2 (very aggressive, behind)
 * - scoreDiff = +3 → urgency = 0.5 (very cautious, ahead)
 *
 * Mapping: urgency = 1 - scoreDiff / 3, clamped to [0.5, 2].
 * This is monotonic and deterministic.
 *
 * Returns a factor in [0.5, 2] that scales shooting/wide-angle thresholds.
 */
function getScoreUrgency(scoreDiff?: number): number {
  if (typeof scoreDiff !== "number") return 1;
  return Math.max(0.5, Math.min(2, 1 - scoreDiff / 3));
}

/**
 * Compute formation recovery weight based on displacement duration
 * and distance from formation position.
 *
 * Returns a value in [0, 1] where:
 *  - 0 = no recovery influence (chase only)
 *  - 1 = full recovery (formation only)
 *
 * The weight grows linearly with displacement ticks and normalized
 * distance, creating a smooth pull back toward formation. Capped at
 * a maximum recovery weight to prevent the CPU from being
 * immobilised when the ball is nearby.
 *
 * Provisional: unmeasured PES 2017 value.
 */
function computeFormationRecoveryWeight(
  displacementTicks: number,
  distanceFromFormation: number,
): number {
  const maxRecoveryWeight = 0.8;
  const recoveryWeight = Math.min(
    displacementTicks * FORMATION_RECOVERY_RATE,
    maxRecoveryWeight,
  );
  // Scale by normalized distance so very close players recover slower.
  const normalizedDistance = Math.min(distanceFromFormation / 5, 1);
  return recoveryWeight * (0.5 + normalizedDistance * 0.5);
}

/**
 * Normalize an angle to the range [-PI, PI].
 */
function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// ---------------------------------------------------------------------------
// Interception awareness helpers (provisional)
// ---------------------------------------------------------------------------

/**
 * Compute the closest point on a line segment (A→B) to a given point P.
 *
 * The line segment is defined by a start point (passer position) and
 * an infinite ray in the direction of the pass velocity. The segment
 * is clamped between start and the projection of the ball's expected
 * arrival (start + velocity × 3 seconds at 60 Hz). This prevents
 * the defender from targeting a point beyond the receiver.
 *
 * Deterministic: same inputs → same result.
 *
 * @param px - Point X coordinate (defender position).
 * @param py - Point Y coordinate (defender position).
 * @param ax - Segment start X (passer position).
 * @param ay - Segment start Y (passer position).
 * @param dirX - Normalized pass direction X.
 * @param dirY - Normalized pass direction Y.
 * @param segLen - Maximum segment length in the pass direction.
 * @returns Closest point on the segment to (px, py).
 */
function closestPointOnPassLine(
  px: number,
  py: number,
  ax: number,
  ay: number,
  dirX: number,
  dirY: number,
  segLen: number,
): { x: number; y: number } {
  const toPx = px - ax;
  const toPy = py - ay;
  // Project onto the direction vector.
  let t = toPx * dirX + toPy * dirY;
  // Clamp to segment bounds [0, segLen].
  t = Math.max(0, Math.min(t, segLen));
  return {
    x: ax + dirX * t,
    y: ay + dirY * t,
  };
}

/**
 * Compute the distance from a point to a line segment (closest-point approach).
 *
 * Deterministic: same inputs → same result.
 */
function distToPassLine(
  px: number,
  py: number,
  ax: number,
  ay: number,
  dirX: number,
  dirY: number,
  segLen: number,
): number {
  const cp = closestPointOnPassLine(px, py, ax, ay, dirX, dirY, segLen);
  const dx = px - cp.x;
  const dy = py - cp.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Detect the most relevant active pass event from the observation's
 * recent pass events, and update the adapter's internal interception state.
 *
 * A pass is "active" when:
 *  1. The pass event is from an opponent (passerTeamId ≠ cpuTeamId).
 *  2. The pass event is within PASS_ACTIVE_TICKS of the current tick.
 *  3. The ball is moving in a direction consistent with the pass
 *     (ball velocity has a significant component along the pass trajectory).
 *
 * If an active pass is found, the internal state is updated.
 * If no active pass is found, the interception state is cleared.
 *
 * Returns true if an active pass was found.
 *
 * Deterministic: same inputs → same result.
 */
function detectActiveOpponentPass(
  observation: CpuObservation,
  cpuTeamId: string,
  currentTick: number,
  state: CpuInternalState,
): boolean {
  const passEvents = observation.recentPassEvents;
  if (!passEvents || passEvents.length === 0) return false;

  // Find the most recent opponent pass within the active window.
  let bestEvent: PassEventInfo | undefined;
  for (const evt of passEvents) {
    if (evt.passerTeamId === cpuTeamId) continue; // skip own-team passes
    if (currentTick - evt.tick > PASS_ACTIVE_TICKS) continue;
    if (!bestEvent || evt.tick > bestEvent.tick) {
      bestEvent = evt;
    }
  }

  if (!bestEvent) return false;

  // Verify the ball is moving in a direction consistent with the pass.
  // The ball's horizontal velocity should have a positive dot product
  // with the pass direction, indicating the ball is still traveling
  // along (or near) the pass trajectory.
  const passDirX = bestEvent.ballVelocity.x;
  const passDirY = bestEvent.ballVelocity.y;
  const passDirLen = Math.sqrt(passDirX * passDirX + passDirY * passDirY);
  if (passDirLen < 0.01) return false;

  const ballVx = observation.ball.linearVelocity.x;
  const ballVy = observation.ball.linearVelocity.y;
  const dot = (ballVx * passDirX + ballVy * passDirY) / passDirLen;

  // Ball should be moving in roughly the pass direction (dot > 0 means
  // ball is still heading toward the receiver). If the ball has been
  // received or deflected (dot ≤ 0), the pass is no longer active.
  if (dot <= 0) return false;

  // Update internal state with the active pass.
  state.activePassTick = bestEvent.tick;
  state.activePasserPosition = { ...bestEvent.passerPosition };
  state.activePassBallVelocity = { ...bestEvent.ballVelocity };
  state.activePasserId = bestEvent.passerPlayerId;

  return true;
}

/**
 * Compute the interception point on the pass trajectory for a given
 * defender.  The interception point is the closest point on the pass
 * line to the defender, projected slightly ahead along the ball's
 * travel direction so the defender arrives before (or at the same
 * time as) the ball.
 *
 * The "slight ahead" offset is computed as a fraction of the distance
 * from the passer to the interception point, proportional to the
 * defender's distance from the trajectory. This gives faster-closing
 * defenders a more aggressive interception angle.
 *
 * Deterministic: same inputs → same result.
 *
 * @param defenderX - Defender's current X position.
 * @param defenderY - Defender's current Y position.
 * @param passerX - Passer's position X.
 * @param passerY - Passer's position Y.
 * @param ballVx - Ball velocity X after the pass.
 * @param ballVy - Ball velocity Y after the pass.
 * @returns The interception point {x, y} on the pass trajectory.
 */
function computeInterceptionPoint(
  defenderX: number,
  defenderY: number,
  passerX: number,
  passerY: number,
  ballVx: number,
  ballVy: number,
): { x: number; y: number } {
  const ballSpeed = Math.sqrt(ballVx * ballVx + ballVy * ballVy);
  if (ballSpeed < 0.01) {
    // Ball nearly stationary — intercept at passer position.
    return { x: passerX, y: passerY };
  }

  const dirX = ballVx / ballSpeed;
  const dirY = ballVy / ballSpeed;

  // Segment length: ball speed × active window gives a reasonable
  // maximum pass distance (ball won't go further than speed × time).
  const segLen = ballSpeed * PASS_ACTIVE_TICKS;

  // Find the closest point on the pass line to the defender.
  const cp = closestPointOnPassLine(
    defenderX, defenderY,
    passerX, passerY,
    dirX, dirY, segLen,
  );

  // Project slightly ahead along the pass direction to give the
  // defender time to arrive before the ball.
  // The ahead offset is proportional to the ball's speed and the
  // distance from passer to interception point (gives faster-closing
  // defenders a more aggressive angle).
  const distFromPasser = (cp.x - passerX) * dirX + (cp.y - passerY) * dirY;
  const aheadOffset = Math.min(ballSpeed * 0.3, distFromPasser * 0.15);

  return {
    x: cp.x + dirX * aheadOffset,
    y: cp.y + dirY * aheadOffset,
  };
}

// ---------------------------------------------------------------------------
// Defensive behavior helpers
// ---------------------------------------------------------------------------

/**
 * Find the opposing player closest to the ball (the "ball carrier").
 *
 * Only considers players on the opposite team.  Returns undefined
 * when no opposing player is present.
 *
 * Deterministic: same observation → same result.
 */
function findBallCarrierPlayer(
  observation: CpuObservation,
  cpuTeamId: string,
): { playerId: string; position: { x: number; y: number } } | undefined {
  const opponentTeamId = cpuTeamId === "team-a" ? "team-b" : "team-a";
  let best: { playerId: string; position: { x: number; y: number }; dist: number } | undefined;

  for (const p of observation.players) {
    if (p.teamId !== opponentTeamId) continue;
    const dx = observation.ball.position.x - p.groundPosition.x;
    const dy = observation.ball.position.y - p.groundPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (!best || dist < best.dist) {
      best = {
        playerId: p.playerId,
        position: { x: p.groundPosition.x, y: p.groundPosition.y },
        dist,
      };
    }
  }

  return best ? { playerId: best.playerId, position: best.position } : undefined;
}

/**
 * Find the most threatening opposing player from the perspective of
 * the defending team.
 *
 * Threat is measured by proximity to own goal (the opposing player
 * closest to the defending team's goal).  When two opposing players
 * are equidistant, the one closer to the ball wins (tie-break).
 *
 * Deterministic: same observation → same result.
 */
function findMostThreateningOpponent(
  observation: CpuObservation,
  cpuTeamId: string,
): { playerId: string; position: { x: number; y: number } } | undefined {
  const opponentTeamId = cpuTeamId === "team-a" ? "team-b" : "team-a";
  const ownGoalX = cpuTeamId === "team-b"
    ? observation.pitchLength / 2
    : -observation.pitchLength / 2;

  let best:
    { playerId: string; position: { x: number; y: number }; goalDist: number; ballDist: number }
    | undefined;

  for (const p of observation.players) {
    if (p.teamId !== opponentTeamId) continue;
    const goalDist = Math.abs(p.groundPosition.x - ownGoalX);
    const bdx = observation.ball.position.x - p.groundPosition.x;
    const bdy = observation.ball.position.y - p.groundPosition.y;
    const ballDist = Math.sqrt(bdx * bdx + bdy * bdy);

    if (
      !best ||
      goalDist < best.goalDist ||
      (goalDist === best.goalDist && ballDist < best.ballDist)
    ) {
      best = {
        playerId: p.playerId,
        position: { x: p.groundPosition.x, y: p.groundPosition.y },
        goalDist,
        ballDist,
      };
    }
  }

  return best
    ? { playerId: best.playerId, position: best.position }
    : undefined;
}

/**
 * Compute the offset position for a marking defender.
 *
 * Returns a position along the line from the mark target toward own
 * goal, offset by `markingDistance` metres.  When the mark target is
 * closer to own goal than `markingDistance`, the defender sits at the
 * mark target's position (no overshoot).
 *
 * Deterministic: same inputs → same result.
 */
function computeMarkOffsetPosition(
  targetPos: { x: number; y: number },
  ownGoalX: number,
  markingDistance: number,
): { x: number; y: number } {
  const toGoalX = ownGoalX - targetPos.x;
  const toGoalLen = Math.abs(toGoalX);

  if (toGoalLen < 0.001) {
    // Target is on the goal line — hold at target position.
    return { x: targetPos.x, y: targetPos.y };
  }

  // Offset fraction: clamp so we never overshoot the own goal.
  const fraction = Math.min(markingDistance / toGoalLen, 1);
  return {
    x: targetPos.x + toGoalX * fraction,
    y: targetPos.y,
  };
}

/** What the keeper path needs about its own body, resolved by the caller. */
interface KeeperSelf {
  playerId: string;
  x: number;
  y: number;
  bodyHeading: number;
  distToBall: number;
  ballHSpeed: number;
}

/**
 * The designated keeper's frame (GK-5V5-ADAPTER-BEHAVIOR, spec §§5-8).
 *
 * Positioning (§5): the commanded target is always a point on the keeper's own
 * goal arc — the goal-line centre offset longitudinally by the versioned
 * `goal_arc_center_x_offset`, drifted laterally toward the ball but never past
 * `goal_arc_lateral_max`. Because that point is inside the arc by construction,
 * the keeper has no path into a field chase, and it is never the team's
 * designated presser (`designatePresser` drops it from the eligible set).
 *
 * Save/claim (§7): an opponent's canonical `shot` event that is on target at
 * this goal arms the reaction on the first tick it is observable — inside the
 * versioned `keeper_reaction_window_ticks` — and the claim itself is the same
 * `FIRST_TOUCH` input a human or the accepted CPU press uses, so the contact is
 * resolved by the contact system on the independent ball and recorded as an
 * event. The keeper never parents, carries or teleports the ball, and only ever
 * reaches within the versioned `save_claim_reach_radius` of its own position.
 *
 * Distribution (§8): a keeper in possession releases with the accepted `PASS`
 * action to a teammate selected from observed positions only, and only along a
 * lane already inside its own facing tolerance — it never leaves the arc to aim.
 *
 * Speed (§5): inside the arc the keeper repositions at the versioned
 * `keeper_reposition_speed`; a scenario's kickoff home is not its goal line, so
 * while outside the arc it closes on its own station at the same accepted
 * locomotion cap every other body uses. No new speed value is introduced.
 *
 * Deterministic: same (tick, observation, instance state) → same frame.
 */
function computeKeeperFrame(
  tick: number,
  observation: CpuObservation,
  state: CpuInternalState,
  teamId: string,
  self: KeeperSelf,
): InputFrame {
  const ball = observation.ball;
  const pitchLength = observation.pitchLength;
  const goalLineX = ownGoalLineX(teamId, pitchLength);
  const arcCenter = goalArcCenter(teamId, pitchLength);
  const ballPos = { x: ball.position.x, y: ball.position.y };
  const ballVel = { x: ball.linearVelocity.x, y: ball.linearVelocity.y };

  // ------------------------------------------------------------------
  // Save/claim reaction (spec §7)
  // ------------------------------------------------------------------
  // One shared production rule arms and disarms the reaction, keyed to the shot's
  // own event id — the ball reference that shot wrote — so the reaction ends the
  // tick any body, this keeper's own claim included, plays the ball.
  const reaction = advanceKeeperReaction(state.keeperReaction, {
    tick,
    teamId,
    pitchLength,
    recentShotEvents: observation.recentShotEvents,
    ballPosition: ballPos,
    ballVelocity: ballVel,
    lastTouchRef: ball.lastTouchRef,
  });
  if (reaction.armedNow) noteKeeperSaveArm();
  state.keeperReaction = reaction.state;
  const saveArmed = reaction.state.shotTick !== null;

  // ------------------------------------------------------------------
  // Goal-arc positioning with bounded lateral drift (spec §5)
  // ------------------------------------------------------------------
  // While a shot is live the keeper drifts to where that ball crosses its goal
  // line (a linear projection of the state it can observe, the same information
  // class the accepted interception awareness already uses); otherwise it holds
  // the arc in front of the ball's lateral position. Either way the point is
  // clamped inside `goal_arc_lateral_max`, so it is never a field chase.
  const station = keeperStationTarget(
    teamId,
    pitchLength,
    ballPos,
    ballVel,
    saveArmed,
  );

  let moveX = 0;
  let moveY = 0;
  const stationDx = station.x - self.x;
  const stationDy = station.y - self.y;
  const stationDist = Math.sqrt(stationDx * stationDx + stationDy * stationDy);
  if (stationDist > KICKOFF_FREEZE_HOME_TOLERANCE) {
    const speedScale = isInsideGoalArc({ x: self.x, y: self.y }, arcCenter)
      ? GK_SMALL_SIDED_V1.keeper_reposition_speed.value / FOUNDATION_LOCOMOTION_V1.maxSpeed.value
      : 1;
    const magnitude = Math.min(stationDist, 1) * speedScale;
    moveX = (stationDx / stationDist) * magnitude;
    moveY = (stationDy / stationDist) * magnitude;
  }

  // ------------------------------------------------------------------
  // Claim and release
  // ------------------------------------------------------------------
  // Two states, in priority order. A ball the keeper has already secured (slow,
  // at its feet) is distributed (§8); anything else that comes inside the
  // versioned reach is claimed — the inbound shot on target (§7), a loose ball
  // in the arc, or an untouched restart the core served there. Both are the same
  // canonical actions a human reaches through the keyboard bindings: the contact
  // system resolves them against the independent ball and records the event, so
  // the ball is never parented to the keeper nor teleported.
  let heldButtons = 0;
  let pressedButtons = 0;
  const inReach = self.distToBall <= GK_SMALL_SIDED_V1.save_claim_reach_radius.value;
  const secured = self.distToBall < POSSESSION_RANGE &&
    self.ballHSpeed < POSSESSION_SPEED_THRESHOLD;
  // A release is a distribution pass toward a forward teammate the keeper
  // legitimately observes (no hidden future state). The pass only *connects*
  // when the ball happens to be inside the versioned reach at release time, but
  // the release decision itself is about the keepers' observed target, so it is
  // driven by `secured` (the ball under control within the keeper's reach orbit).
  const releaseTarget = secured && observation.teammates !== undefined
    ? getBestTeammateTarget(
      observation.teammates,
      { x: self.x, y: self.y },
      teamId,
      getOpponentPositions(observation, teamId),
    )
    : undefined;
  const aimDx = releaseTarget !== undefined ? releaseTarget.x - self.x : 0;
  const aimDy = releaseTarget !== undefined ? releaseTarget.y - self.y : 0;
  const aimedAtTeammate = releaseTarget !== undefined &&
    Math.abs(normalizeAngle(self.bodyHeading - Math.atan2(aimDy, aimDx))) <=
      FACING_TOLERANCE_WIDE;

  if (aimedAtTeammate) {
    // Distribution (§8): the target comes from observed teammate and opponent
    // positions only — never a modelled future — and the release fires only down
    // a lane this body is already facing. Command the movement along the release
    // lane so the pass direction (derived from moveX/moveY) actually carries the
    // ball to that teammate, capped at the in-arc repositioning scale so a keeper
    // never leaves its goal arc to aim.
    if (releaseTarget !== undefined) {
      const aimMag = Math.sqrt(aimDx * aimDx + aimDy * aimDy);
      if (aimMag > 1e-9) {
        const releaseScale = isInsideGoalArc({ x: self.x, y: self.y }, arcCenter)
          ? GK_SMALL_SIDED_V1.keeper_reposition_speed.value / FOUNDATION_LOCOMOTION_V1.maxSpeed.value
          : 1;
        moveX = (aimDx / aimMag) * releaseScale;
        moveY = (aimDy / aimMag) * releaseScale;
      }
    }
    heldButtons |= PASS_BIT;
    if (!state.passWasPressed) {
      pressedButtons |= PASS_BIT;
      noteKeeperReleasePress();
      // Record the release for the protected distribution oracle: the target is
      // the keeper's OWN observed teammate at this tick, so the oracle can
      // re-verify no hidden future state was read.
      if (releaseTarget !== undefined && observation.teammates !== undefined) {
        const targetPlayer = observation.teammates.find(
          (tm) =>
            Math.abs(tm.groundPosition.x - releaseTarget.x) < 1e-6 &&
            Math.abs(tm.groundPosition.y - releaseTarget.y) < 1e-6,
        );
        if (targetPlayer !== undefined) {
          noteKeeperRelease({
            tick,
            teamId,
            keeperPlayerId: self.playerId,
            releaseTargetPlayerId: targetPlayer.playerId,
            releaseTargetPosition: { x: releaseTarget.x, y: releaseTarget.y },
            keeperPosition: { x: self.x, y: self.y },
          });
        }
      }
    }
    state.passWasPressed = true;
  } else {
    if (inReach && (saveArmed || secured || ball.lastTouchRef === null)) {
      heldButtons |= FIRST_TOUCH_BIT;
      if (!state.ballWasInSaveReach) {
        pressedButtons |= FIRST_TOUCH_BIT;
        noteKeeperSavePress();
      }
    }
    state.passWasPressed = false;
  }
  state.ballWasInSaveReach = inReach;
  // Field-mode possession bookkeeping is not meaningful for a body that never
  // plays as a field player; clear it the way the restart freeze does, so a
  // keeper released back to the accepted path (an untouched restart it must
  // take) starts from a clean state.
  state.ballWasInRange = false;
  state.hasPossession = false;

  noteKeeperHoldTick();

  return {
    tick,
    sourceId: "cpu",
    controlSlot: "slot-cpu",
    moveX,
    moveY,
    sprint: 1,
    heldButtons,
    pressedButtons,
    releasedButtons: 0,
  };
}

/**
 * Create a new CPU adapter with goal-aware strategy.
 *
 * Two modes:
 *  - OFFENSE (possession): steer toward opponent's goal,
 *    shoot when in range (distance-based thresholds).
 *  - DEFENSE (no possession): chase the ball, press FIRST_TOUCH when near.
 *
 * Distance-based shooting (provisional PES 2017 values):
 *  - ≤ 5 m: always shoot if in range.
 *  - 5–20 m: shoot if facing within ±60° of goal (scaled by urgency).
 *  - > 20 m: dribble only.
 *
 * Post-shot cooldown: after shooting, the CPU waits
 * `SHOT_COOLDOWN_TICKS` before pressing FIRST_TOUCH again.
 *
 * Score-state awareness: if scoreDifferential is provided,
 * CPU ahead ≥ 2 goals reduces urgency; behind ≥ 2 increases it.
 *
 * Possession is gained when the ball enters FIRST_TOUCH range on one tick,
 * then confirmed on the next tick (ballWasInRange → hasPossession).
 * Possession is lost when the ball moves beyond POSSESSION_RANGE
 * or after shooting.
 *
 * @returns A CpuAdapter instance.
 */

// ---------------------------------------------------------------------------
// Fatigue accumulator constants (CPU-TACTICAL-AWARENESS, provisional)
// ---------------------------------------------------------------------------

/**
 * Maximum tick count for the fatigue accumulator per half.
 * At 60 Hz, 3600 ticks ≈ 60 simulated minutes — roughly one half of
 * a 90-minute match.  When fatigueTicks reaches this value, fatigue
 * saturates at 1.0 (fully fatigued).
 *
 * The accumulator increments by 1 each tick while matchPhase === "playing"
 * and resets to 0 when currentHalf changes (half-time break).
 *
 * Provisional — not a measured PES 2017 value.
 */
const FATIGUE_MAX_TICKS = 3600;

/**
 * Apply fatigue accumulation and half-transition reset.
 * Called only when observation.matchPhase is present (real runtime).
 * Deterministic: same inputs → same state mutation.
 */
function applyFatigueAndPhase(
  state: CpuInternalState,
  observation: CpuObservation,
  _tick: number,
): void {
  const currentHalf = observation.currentHalf ?? 1;
  if (currentHalf !== state.lastCurrentHalf) {
    state.fatigueTicks = 0;
    state.lastCurrentHalf = currentHalf;
  }
  if (observation.matchPhase === "playing") {
    state.fatigueTicks = Math.min(state.fatigueTicks + 1, FATIGUE_MAX_TICKS);
  }
}

export function createCpuAdapter(): CpuAdapter {
  const state: CpuInternalState = {
    ballWasInRange: false,
    hasPossession: false,
    passWasPressed: false,
    shotCooldownRemaining: 0,
    isLoftedPass: false,
    formationDisplacementTicks: 0,
    kickoffHome: null,
    restartTouchBaseline: null,
    restartAnchor: null,
    untouchedWindowOrdinal: 0,
    firstWindowWasKickoff: false,
    restartHoldTicks: 0,
    lastSeenTouchRef: undefined,
    possessionDuration: 0,
    activePassTick: -1,
    activePasserPosition: { x: 0, y: 0 },
    activePassBallVelocity: { x: 0, y: 0 },
    activePasserId: "",
    isOverlapping: false,
    fatigueTicks: 0,
    lastCurrentHalf: 1,
    tackleHoldTicks: 0,
    tackleReleaseTick: -1,
    keeperPlayerId: undefined,
    keeperReaction: { ...KEEPER_REACTION_IDLE },
    ballWasInSaveReach: false,
  };

  return {
    sample(tick: number, observation: CpuObservation): InputFrame {
      // Find the controlled player by controlledPlayerId, falling back
      // to the first player for backward compatibility.
      const { controlledPlayerId, players } = observation;
      let cpuPlayer: typeof players[0] | undefined;
      if (controlledPlayerId && controlledPlayerId.length > 0) {
        cpuPlayer = players.find((p) => p.playerId === controlledPlayerId);
      }
      if (!cpuPlayer) {
        // Either controlledPlayerId was not set (fallback) or wasn't found.
        // If controlledPlayerId was truthy but not found → neutral.
        // If it was not set → use players[0].
        if (controlledPlayerId && controlledPlayerId.length > 0) {
          return {
            tick,
            sourceId: "cpu",
            controlSlot: "slot-cpu",
            moveX: 0,
            moveY: 0,
            sprint: 0,
            heldButtons: 0,
            pressedButtons: 0,
            releasedButtons: 0,
          };
        }
        cpuPlayer = players[0];
      }

      if (!cpuPlayer) {
        // No player available — return neutral frame.
        return {
          tick,
          sourceId: "cpu",
          controlSlot: "slot-cpu",
          moveX: 0,
          moveY: 0,
          sprint: 0,
          heldButtons: 0,
          pressedButtons: 0,
          releasedButtons: 0,
        };
      }

      const ball = observation.ball;
      const playerX = cpuPlayer.groundPosition.x;
      const playerY = cpuPlayer.groundPosition.y;

      // Resolve difficulty config (defaults to medium when absent).
      const diffConfig = resolveDifficultyConfig(observation.difficulty);

      // --- Fatigue accumulator + phase hold (CPU-TACTICAL-AWARENESS) ---
      // Guarded: only runs when observation carries matchPhase (real runtime).
      // In the headless runner (buildTeamCpuObservation), matchPhase is absent
      // so this entire block is skipped with zero overhead.
      if (observation.matchPhase != null) {
        applyFatigueAndPhase(state, observation, tick);
        // Restart resume (RESTART-ANTI-HUDDLE-COHERENCE): when play moves from
        // a core restart hold back to a live phase, the ball may still carry
        // the pre-restart touch reference — the post-goal and halftime resets
        // reposition everything without clearing it. Record that value as the
        // window baseline so "untouched since restart" stays an observable
        // condition (the reference changes only when a body actually plays
        // it). A real core window holds for dozens of ticks; the headless
        // lifecycle wiring's single-tick phase stamps (which immediately
        // return to "playing" without any reset happening) fall under the
        // minimum and never arm a window.
        const phaseNow = observation.matchPhase;
        // The reference observed on the previous sample. A core reset leaves
        // the pre-restart reference carried through the whole hold (nobody
        // can touch a held ball), while a set-piece serve's reference is
        // freshly written the tick the ball is placed — equal to the previous
        // sample only for a real reset.
        const previousTouchRef = state.lastSeenTouchRef;
        state.lastSeenTouchRef = observation.ball.lastTouchRef ?? null;
        if (phaseNow !== "playing" && phaseNow !== "kickoff") {
          state.restartHoldTicks++;
        } else {
          if (
            state.restartHoldTicks >= RESTART_HOLD_MIN_TICKS &&
            observation.ball.lastTouchRef &&
            observation.ball.lastTouchRef === previousTouchRef
          ) {
            state.restartTouchBaseline = observation.ball.lastTouchRef;
          }
          state.restartHoldTicks = 0;
        }
        if (phaseNow !== "playing" && phaseNow !== "kickoff") {
          return {
            tick,
            sourceId: "cpu",
            controlSlot: "slot-cpu",
            moveX: 0,
            moveY: 0,
            sprint: 0,
            heldButtons: 0,
            pressedButtons: 0,
            releasedButtons: 0,
          };
        }
      }

      // Compute vector from CPU player to ball.
      const dx = ball.position.x - playerX;
      const dy = ball.position.y - playerY;
      const distToBall = Math.sqrt(dx * dx + dy * dy);

      // Ball horizontal speed.
      const ballHSpeed = Math.sqrt(
        ball.linearVelocity.x ** 2 + ball.linearVelocity.y ** 2,
      );

      // Is ball in FIRST_TOUCH range this tick?
      // Difficulty scales the reaction range: higher factor = reacts from farther.
      const effectiveFirstTouchRange = FIRST_TOUCH_RANGE * diffConfig.firstTouchRangeFactor;
      // Under the anti-huddle the CPU reacts no wider than the radius the
      // contact system itself declares eligible: a press issued between that
      // radius and the adapter's reaction band can never land, and the body is
      // then left chasing a ball it believes it owns. Legacy (non-runtime)
      // observations keep the accepted range unchanged.
      const antiHuddleActive = isAntiHuddleActive(observation);
      const touchPressRange = antiHuddleActive
        ? Math.min(effectiveFirstTouchRange, FOUNDATION_CONTACT_V1.contactRadius.value)
        : effectiveFirstTouchRange;
      const ballInRange =
        distToBall < touchPressRange && ballHSpeed < FIRST_TOUCH_SPEED_THRESHOLD;

      // ------------------------------------------------------------------
      // Anti-huddle preamble (5V5-KICKOFF-ANTI-HUDDLE)
      // ------------------------------------------------------------------
      // The kickoff home is this body's fixed scenario start position, captured
      // on the first sample of the match. Only the team's designated chaser —
      // the shared press designation the accepted press and tackle machinery act
      // on — may converge on the ball; every other field body holds that home.
      // Until the ball carries a touch reference the hold is absolute for
      // everyone but the kick taker (kickoff freeze), so the match cannot open
      // with ten bodies on one ball; afterwards the same home is the anchor the
      // press/cover/support mechanisms perturb around.
      const cpuTeamId = observation.cpuTeamId;
      const myPlayerId = observation.controlledPlayerId ?? cpuPlayer.playerId;
      const firstSample = state.kickoffHome === null;
      if (state.kickoffHome === null) {
        state.kickoffHome = { x: playerX, y: playerY };
      }
      const kickoffHome = state.kickoffHome;

      // Untouched restart ball (RESTART-ANTI-HUDDLE-COHERENCE): the accepted
      // signal is a null touch reference (kickoff and every set-piece serve);
      // a core reset that repositions play WITHOUT clearing the reference
      // (post-goal, halftime) leaves the stale value — still equal to the
      // resume-time baseline captured above — as the observable untouched mark.
      const touchRefNow = observation.ball.lastTouchRef;
      const ballUntouched = touchRefNow === null ||
        (state.restartTouchBaseline !== null && touchRefNow === state.restartTouchBaseline);
      // Any different reference means the restart ball has been played: release
      // the baseline, which closes the window for every body at once.
      if (state.restartTouchBaseline !== null && touchRefNow !== state.restartTouchBaseline) {
        state.restartTouchBaseline = null;
      }

      const chaseRoles = antiHuddleActive && cpuTeamId !== undefined
        ? assignChaseRoles(observation, cpuTeamId, ballUntouched)
        : undefined;
      const isDesignatedChaser = chaseRoles !== undefined &&
        chaseRoles.chaserPlayerId !== undefined &&
        chaseRoles.chaserPlayerId === myPlayerId;
      // A body already inside touch range of the ball is exempt: it is at the
      // ball, so playing it adds no converging player and a restart can still be
      // taken without a scripted serve.
      const atBallRange = antiHuddleActive && distToBall <= touchPressRange;

      // Window anchor: each untouched window freezes this body where it stood
      // when the window opened. At kickoff (and after a post-goal/halftime
      // reset, which repositions every body to its scenario start) that point
      // IS the kickoff home, so the accepted 5V5-KICKOFF-ANTI-HUDDLE frames are
      // unchanged; a set-piece window anchors the body at the core's restart
      // placement instead of dragging it back across the pitch.
      if (ballUntouched) {
        if (state.restartAnchor === null) {
          state.restartAnchor = { x: playerX, y: playerY };
          state.untouchedWindowOrdinal++;
          if (firstSample) state.firstWindowWasKickoff = true;
        }
      } else {
        state.restartAnchor = null;
      }
      const freezeAnchor = state.restartAnchor ?? kickoffHome;
      const homeDx = freezeAnchor.x - playerX;
      const homeDy = freezeAnchor.y - playerY;
      const homeDist = Math.sqrt(homeDx * homeDx + homeDy * homeDy);

      // Restart freeze (the kickoff freeze, extended to every restart): while
      // the ball is an untouched restart ball only the kick taker — the single
      // closest body in the match to it — may close the distance. Two opposing
      // bodies meeting an untouched ball lock each other outside contact range
      // and the match never opens, so the freeze holds every other body at its
      // anchor until that first touch lands.
      const isKickoffTaker = ballUntouched && chaseRoles !== undefined &&
        chaseRoles.kickoffTakerId === myPlayerId;
      if (antiHuddleActive && !isKickoffTaker && !atBallRange && ballUntouched) {
        // Hold the anchor until the ball is first touched.
        state.ballWasInRange = false;
        state.hasPossession = false;
        _kickoffFreezeActivations++;
        // A window that is not this instance's opening kickoff window is a
        // match restart (RESTART-ANTI-HUDDLE-COHERENCE reachability guard).
        if (!state.firstWindowWasKickoff || state.untouchedWindowOrdinal > 1) {
          _restartFreezeActivations++;
        }
        const frozen = homeDist > KICKOFF_FREEZE_HOME_TOLERANCE;
        return {
          tick,
          sourceId: "cpu",
          controlSlot: "slot-cpu",
          moveX: frozen ? (homeDx / homeDist) * Math.min(homeDist, 1) : 0,
          moveY: frozen ? (homeDy / homeDist) * Math.min(homeDist, 1) : 0,
          sprint: 1,
          heldButtons: 0,
          pressedButtons: 0,
          releasedButtons: 0,
        };
      }

      // ------------------------------------------------------------------
      // Designated keeper (GK-5V5-ADAPTER-BEHAVIOR, spec §§4-8)
      // ------------------------------------------------------------------
      // The role is assigned by the wiring from the match's starting layout and
      // frozen here, so it is a stable actor id rather than a ball fact. A
      // keeper-designated body never runs the field branches below: its
      // commanded target is always a point inside its own goal arc, and its only
      // ball actions are the recorded save/claim contact and the distribution
      // release, both issued through the sanctioned tick-indexed input path.
      // While a restart ball is still untouched the accepted freeze owns this
      // body too: a keeper is never the match's designated restart taker, and a
      // serve that lands inside its own arc is claimed from there.
      if (isKeeperBehaviorActive(observation) && state.keeperPlayerId === undefined &&
        cpuTeamId !== undefined) {
        state.keeperPlayerId = resolveKeeperPlayerId(observation, cpuTeamId);
      }
      const isDesignatedKeeper = state.keeperPlayerId !== undefined &&
        cpuTeamId !== undefined &&
        state.keeperPlayerId === myPlayerId;

      if (isDesignatedKeeper) {
        return computeKeeperFrame(tick, observation, state, cpuTeamId as string, {
          playerId: myPlayerId,
          x: playerX,
          y: playerY,
          bodyHeading: cpuPlayer.bodyHeading,
          distToBall,
          ballHSpeed,
        });
      }

      // Baseline for every non-chasing body once the freeze is over: hold the
      // formation home instead of converging on the ball. The kick taker keeps
      // its exemption only while the ball is still untouched — once it is played
      // the team's own designated presser takes the chase over.
      const holdsFormationHome = antiHuddleActive &&
        !isDesignatedChaser && !atBallRange && !isKickoffTaker;

      // Update possession state:
      //   Gain: ball was in range on previous tick (confirming control).
      //   Lose: ball beyond POSSESSION_RANGE (or COOLDOWN threshold during cooldown).
      if (state.ballWasInRange) {
        state.hasPossession = true;
        state.formationDisplacementTicks = 0;
      }
      const effectivePossessionRange = state.shotCooldownRemaining > 0
        ? POSSESSION_RANGE_COOLDOWN
        : POSSESSION_RANGE;
      if (distToBall > effectivePossessionRange) {
        state.hasPossession = false;
      }

      let moveX = 0;
      let moveY = 0;
      let heldButtons = 0;
      let pressedButtons = 0;

      // ------------------------------------------------------------------
      // Post-shot cooldown: decrement
      // ------------------------------------------------------------------
      if (state.shotCooldownRemaining > 0) {
        state.shotCooldownRemaining--;
      }
      // Reset per-tick lofted-pass flag.
      state.isLoftedPass = false;

      const scoreDiff = observation.scoreDifferential;
      const urgency = getScoreUrgency(scoreDiff);

      if (state.hasPossession && cpuTeamId) {
        // ----------------------------------------------------------------
        // OFFENSE MODE — steer toward opponent's goal
        // ----------------------------------------------------------------
        const goalX = getOpponentGoalX(cpuTeamId);
        const gdx = goalX - playerX;
        const gdy = 0 - playerY; // goal is on the centre line (y=0)
        const distToGoal = Math.sqrt(gdx * gdx + gdy * gdy);

        // Normalized direction toward the goal aim point.
        // Aim at a deterministic lateral offset within goal width.
        // Difficulty scales the aim accuracy: higher shotAimFactor = wider offset = less accurate.
        if (distToGoal > 0.001) {
          const aimY = getShotAimOffsetY(tick) * diffConfig.shotAimFactor;
          const goalAimX = goalX;
          const goalAimY = aimY;
          const aimDx = goalAimX - playerX;
          const aimDy = goalAimY - playerY;
          const distAim = Math.sqrt(aimDx * aimDx + aimDy * aimDy);
          const distUnit = Math.min(distAim, 1);
          moveX = (aimDx / distAim) * distUnit;
          moveY = (aimDy / distAim) * distUnit;
        }

        // ============================================================
        // ATTACKING ORGANIZATION: overlap, spacing, delayed runs,
        // cross/through-ball decision.
        // ============================================================
        {
          const attackingX = cpuTeamId === "team-b" ? -1 : 1;
          const carrierWide = isWideZone(playerY, observation.pitchWidth);

          // --- Overlapping run: nearby teammate curves around carrier ---
          if (carrierWide && observation.teammates &&
              observation.teammates.length > 0) {
            const closestTm = findClosestTeammate(
              observation.teammates,
              { x: playerX, y: playerY },
              observation.controlledPlayerId ?? "",
            );
            if (closestTm) {
              const dxTm = closestTm.groundPosition.x - playerX;
              const dyTm = closestTm.groundPosition.y - playerY;
              const distTm = Math.sqrt(dxTm * dxTm + dyTm * dyTm);
              if (distTm < OVERLAP_LATERAL_OFFSET * 2 && distTm > 1) {
                // Curving run: move forward (attack direction) and laterally
                // around the carrier's outside.  The lateral direction is
                // away from the carrier (opposite of dyTm sign).
                const lateralDir = -Math.sign(dyTm);
                const overlapMoveX = attackingX;
                const overlapMoveY = lateralDir;
                const olLen = Math.sqrt(
                  overlapMoveX * overlapMoveX + overlapMoveY * overlapMoveY,
                );
                moveX = (overlapMoveX / olLen);
                moveY = (overlapMoveY / olLen);
                state.isOverlapping = true;
              } else {
                state.isOverlapping = false;
              }
            } else {
              state.isOverlapping = false;
            }
          } else {
            state.isOverlapping = false;
          }

          // --- Spacing enforcement: avoid clustering ---
          if (!state.isOverlapping && observation.teammates &&
              observation.teammates.length > 0) {
            for (const tm of observation.teammates) {
              const dxTm = tm.groundPosition.x - playerX;
              const dyTm = tm.groundPosition.y - playerY;
              const distTm = Math.sqrt(dxTm * dxTm + dyTm * dyTm);

              if (distTm < ATTACKING_SPACING_MIN && distTm > 0.1) {
                // Too close — push laterally away from the teammate.
                const awayX = -dxTm / distTm;
                const awayY = -dyTm / distTm;
                moveX += awayX * 0.3;
                moveY += awayY * 0.3;
                // Clamp to [-1, 1].
                moveX = Math.max(-1, Math.min(1, moveX));
                moveY = Math.max(-1, Math.min(1, moveY));
                break;
              }
            }
          }

          // --- Delayed runs: forwards stay behind last defender ---
          if (observation.teammates && observation.teammates.length > 0) {
            const role = cpuPlayer.formationRole;
            if (role === "attacker" &&
                state.possessionDuration < DELAYED_RUN_TICKS) {
              // During the delay phase, reduce forward push.
              // Blend toward zero movement (holding position).
              const progress = state.possessionDuration / DELAYED_RUN_TICKS;
              moveX *= progress;
              moveY *= progress;
            }
          }

          // --- Cross / through-ball decision ---
          if (observation.teammates && observation.teammates.length > 0) {
            if (carrierWide) {
              // Wide zone → prefer cross: target forward teammate ahead of ball.
              const forwardTm = findFurthestForwardTeammateByRole(
                observation.players, cpuTeamId,
                observation.controlledPlayerId ?? "",
                attackingX, "attacker",
              );
              if (forwardTm) {
                const fwdDx =
                  forwardTm.groundPosition.x - playerX;
                const fwdDy =
                  forwardTm.groundPosition.y - playerY;
                const fwdDist =
                  Math.sqrt(fwdDx * fwdDx + fwdDy * fwdDy);
                if (fwdDist > 1) {
                  moveX = (fwdDx / fwdDist);
                  moveY = (fwdDy / fwdDist);
                }
              }
            } else {
              // Central zone → prefer through-ball: target a forward
              // making a run behind the defensive line.
              const throughTarget = findClosestTeammateByRole(
                observation.players, cpuTeamId,
                { x: playerX + attackingX * 15, y: playerY },
                observation.controlledPlayerId ?? "",
                "attacker",
              );
              if (throughTarget) {
                const tbDx =
                  throughTarget.groundPosition.x - playerX;
                const tbDy =
                  throughTarget.groundPosition.y - playerY;
                const tbDist =
                  Math.sqrt(tbDx * tbDx + tbDy * tbDy);
                if (tbDist > 1) {
                  moveX = (tbDx / tbDist);
                  moveY = (tbDy / tbDist);
                }
              }
            }
          }
        }

        // Distance-based shooting decision.
        // Compute facing check once (applies at any distance).
        // Urgency widens tolerance when CPU is behind.
        // Difficulty scales the tolerance and range: higher factor = easier shooting.
        const adjustedTolerance = FACING_TOLERANCE_CLOSE * urgency * diffConfig.facingToleranceFactor;
        const cappedTolerance = Math.min(adjustedTolerance, Math.PI);
        const goalAngle = Math.atan2(gdy, gdx);
        const headingDiff = normalizeAngle(cpuPlayer.bodyHeading - goalAngle);
        const isFacingGoal = Math.abs(headingDiff) <= cappedTolerance;

        // Close range: always shoot if within close range.
        // Apply urgency multiplier to lower the distance threshold for backup.
        // Difficulty scales the effective ranges.
        const effectiveShotRangeClose = SHOT_RANGE_CLOSE * diffConfig.shotRangeFactor;
        const effectiveShotRangeWide = SHOT_RANGE_WIDE * diffConfig.shotRangeFactor;
        const adjustedCloseRange = effectiveShotRangeClose / urgency;
        if (distToGoal <= effectiveShotRangeClose) {
          if (distToGoal <= adjustedCloseRange) {
            heldButtons |= SHOT_BIT;
            pressedButtons |= SHOT_BIT;
          }
        } else if (distToGoal <= effectiveShotRangeWide && isFacingGoal) {
          // Medium range: shoot if facing within tolerance.
          heldButtons |= SHOT_BIT;
          pressedButtons |= SHOT_BIT;
        } else if (urgency > 1 && isFacingGoal) {
          // Urgency extends shot range beyond wide threshold.
          // When behind (urgency > 1), the CPU shoots from farther away.
          heldButtons |= SHOT_BIT;
          pressedButtons |= SHOT_BIT;
        }

        // Pass decision: if not shooting, press PASS_BIT or SHOT_BIT
        // (lofted) when beyond shot range or not facing well enough.
        const shotNotPressed = (pressedButtons & SHOT_BIT) === 0;
        if (shotNotPressed) {
          const shouldPressPass =
            distToGoal > effectiveShotRangeWide || !isFacingGoal;

          // Aim the pass toward the best forward teammate when available.
          if (shouldPressPass && observation.teammates &&
              observation.teammates.length > 0 && cpuTeamId) {
            const opponents = getOpponentPositions(observation, cpuTeamId);
            const target = getBestTeammateTarget(
              observation.teammates,
              { x: playerX, y: playerY },
              cpuTeamId,
              opponents,
            );
            if (target) {
              const aimDx = target.x - playerX;
              const aimDy = target.y - playerY;
              const normalized = normalizeVec2(aimDx, aimDy);
              moveX = normalized.dx;
              moveY = normalized.dy;

              // Choose ground vs lofted based on distance and urgency.
              const distToTarget = Math.sqrt(aimDx * aimDx + aimDy * aimDy);
              const passType = choosePassType(distToTarget, urgency);

              if (passType === "lofted") {
                // Lofted pass: SHOT_BIT aimed at teammate (higher exit
                // speed + vertical component).  No shot cooldown.
                if (shouldPressPass && !state.passWasPressed) {
                  pressedButtons |= SHOT_BIT;
                }
                if (shouldPressPass) {
                  heldButtons |= SHOT_BIT;
                }
                state.isLoftedPass = true;
              } else {
                // Ground pass: PASS_BIT (standard low trajectory).
                if (shouldPressPass && !state.passWasPressed) {
                  pressedButtons |= PASS_BIT;
                }
                if (shouldPressPass) {
                  heldButtons |= PASS_BIT;
                }
              }
            } else {
              // No forward teammate: fallback to PASS_BIT toward goal.
              if (shouldPressPass && !state.passWasPressed) {
                pressedButtons |= PASS_BIT;
              }
              if (shouldPressPass) {
                heldButtons |= PASS_BIT;
              }
            }
          } else {
            // No teammates: existing PASS_BIT toward goal direction.
            if (shouldPressPass && !state.passWasPressed) {
              pressedButtons |= PASS_BIT;
            }
            if (shouldPressPass) {
              heldButtons |= PASS_BIT;
            }
          }
        }

        // Track pass state for edge detection on next tick.
        state.passWasPressed = shotNotPressed &&
          (distToGoal > effectiveShotRangeWide || !isFacingGoal);
      } else {
        // ----------------------------------------------------------------
        // DEFENSE MODE — chase ball / mark opponents / press carrier
        // ----------------------------------------------------------------

        const teamStrategy = observation.teamDecision?.strategy;
        const defensiveSubMode = observation.teamDecision?.defensiveSubMode;
        const cpuTeamId = observation.cpuTeamId;
        const isNearestToBall = observation.teamDecision?.nearestToBallPlayerId
          === observation.controlledPlayerId;

        // Determine if defensive coordination is active: team is
        // defending, pressing, or marking.
        const isDefensiveMode = teamStrategy === "DEFEND" ||
          defensiveSubMode === "MARKING" || defensiveSubMode === "PRESSING";

        // --- Zonal marking: defenders track attackers in their zone ---
        // When defensive coordination is active and this player is a
        // defender who is NOT the nearest to the ball, track the
        // nearest opponent in their zone instead of chasing the ball.
        // Zone boundaries divide the pitch into thirds (defensive,
        // middle, attacking) from the defending team's own goal.
        let chaseTargetX = ball.position.x;
        let chaseTargetY = ball.position.y;
        let effectiveDistToTarget = distToBall;

        // --- Nearest-only chase (5V5-KICKOFF-ANTI-HUDDLE) ---
        // Only the designated chaser's default target is the ball. Every other
        // field body defaults to its fixed formation home, so defense spreads
        // instead of collapsing; the marking, cover, support and pressing
        // mechanisms below still get to redirect that baseline.
        if (holdsFormationHome) {
          _nearestOnlyChaseActivations++;
          if (homeDist > CHASE_NEAREST_HOME_TOLERANCE) {
            chaseTargetX = kickoffHome.x;
            chaseTargetY = kickoffHome.y;
            effectiveDistToTarget = homeDist;
          } else {
            // Already at home — hold still rather than jitter around it.
            chaseTargetX = playerX;
            chaseTargetY = playerY;
            effectiveDistToTarget = 0;
          }
        }

        // Determine which zone the ball is in (used by press triggers).
        const ballZone = cpuTeamId
          ? determineZone(ball.position.x, observation.pitchLength, cpuTeamId)
          : "middle";

        if (isDefensiveMode && cpuTeamId &&
            cpuPlayer.formationRole === "defender" && !isNearestToBall) {
          const opponentTeamId = cpuTeamId === "team-a" ? "team-b" : "team-a";
          const defenderZone = determineZone(
            playerX, observation.pitchLength, cpuTeamId,
          );
          // Find the nearest opponent in the same zone as this defender.
          let zoneTarget:
            { playerId: string; position: { x: number; y: number }; dist: number } | undefined;
          for (const p of observation.players) {
            if (p.teamId !== opponentTeamId) continue;
            const pZone = determineZone(
              p.groundPosition.x, observation.pitchLength, cpuTeamId,
            );
            if (pZone !== defenderZone) continue;
            const dx = p.groundPosition.x - playerX;
            const dy = p.groundPosition.y - playerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (!zoneTarget || dist < zoneTarget.dist) {
              zoneTarget = {
                playerId: p.playerId,
                position: { x: p.groundPosition.x, y: p.groundPosition.y },
                dist,
              };
            }
          }
          // Fallback to most threatening opponent if no one is in the zone.
          if (!zoneTarget) {
            const markTarget = findMostThreateningOpponent(observation, cpuTeamId);
            if (markTarget) {
              const ownGoalX = cpuTeamId === "team-b"
                ? observation.pitchLength / 2
                : -observation.pitchLength / 2;
              const offsetPos = computeMarkOffsetPosition(
                markTarget.position, ownGoalX, MARKING_DISTANCE,
              );
              chaseTargetX = offsetPos.x;
              chaseTargetY = offsetPos.y;
              const mdx = offsetPos.x - playerX;
              const mdy = offsetPos.y - playerY;
              effectiveDistToTarget = Math.sqrt(mdx * mdx + mdy * mdy);
            }
          } else {
            chaseTargetX = zoneTarget.position.x;
            chaseTargetY = zoneTarget.position.y;
            effectiveDistToTarget = zoneTarget.dist;
          }
        }

        // --- Interception awareness: position toward pass trajectory ---
        // When an opponent pass is active, the nearest CPU defender to
        // the pass trajectory should move toward an interception point
        // on the pass line, rather than chasing the ball carrier.
        // This overrides the chase target but NOT the ball-carrier
        // press (which happens later for the nearest-to-ball player).
        if (cpuTeamId && cpuPlayer.formationRole === "defender" &&
            !isNearestToBall) {
          const passActive = detectActiveOpponentPass(
            observation, cpuTeamId, tick, state,
          );
          if (passActive) {
            const intPoint = computeInterceptionPoint(
              playerX, playerY,
              state.activePasserPosition.x,
              state.activePasserPosition.y,
              state.activePassBallVelocity.x,
              state.activePassBallVelocity.y,
            );
            const intDx = intPoint.x - playerX;
            const intDy = intPoint.y - playerY;
            const intDist = Math.sqrt(intDx * intDx + intDy * intDy);

            // Only intercept if the defender is within range.
            if (intDist < INTERCEPTION_RANGE) {
              chaseTargetX = intPoint.x;
              chaseTargetY = intPoint.y;
              effectiveDistToTarget = intDist;
            }
          }
        }

        // --- Cover player: second-closest non-presser positions behind presser ---
        // When defensive coordination is active, the second-closest team
        // player (defender or midfielder) to the ball positions behind
        // the presser (nearest-to-ball) to create a press-cover pair
        // with role separation.  This prevents all players from
        // converging on the ball simultaneously.
        if (isDefensiveMode && cpuTeamId &&
            (cpuPlayer.formationRole === "defender" || cpuPlayer.formationRole === "midfielder") &&
            !isNearestToBall) {
          const pair = findPressCoverPair(observation, cpuTeamId);
          // Under the anti-huddle only the second-closest non-attacker screens,
          // so exactly one cover body forms behind the presser. Stashed, the
          // accepted condition stands: any non-presser while the pair is in
          // range.
          const isCoverBody = antiHuddleActive
            ? observation.controlledPlayerId === pair.coverId
            : observation.controlledPlayerId !== pair.presserId;
          // This player is the cover if they are the second-closest
          // non-attacker teammate and within COVER_ACTIVATION_RANGE.
          if (isCoverBody &&
              pair.coverDistance < COVER_ACTIVATION_RANGE &&
              pair.presserId !== undefined) {
            // Find the presser's position.
            const presserPlayer = observation.players.find(
              (p) => p.playerId === pair.presserId,
            );
            if (presserPlayer) {
              const presserX = presserPlayer.groundPosition.x;
              const presserY = presserPlayer.groundPosition.y;
              // Direction from ball to presser.
              const bpDx = presserX - ball.position.x;
              const bpDy = presserY - ball.position.y;
              const bpLen = Math.sqrt(bpDx * bpDx + bpDy * bpDy);
              if (bpLen > 0.001) {
                const bpNx = bpDx / bpLen;
                const bpNy = bpDy / bpLen;
                // Cover position: behind the presser (toward own goal) with lateral offset.
                // The lateral offset is perpendicular to the ball→presser line,
                // toward the most threatening opponent.
                const threatening = findMostThreateningOpponent(observation, cpuTeamId);
                let lateralSign = 1;
                if (threatening) {
                  const perpX = -bpNy;
                  const perpY = bpNx;
                  const toThreatX = threatening.position.x - presserX;
                  const toThreatY = threatening.position.y - presserY;
                  lateralSign = (toThreatX * perpX + toThreatY * perpY) >= 0 ? 1 : -1;
                }
                // Cover target: behind the presser (opposite ball→presser direction)
                // + lateral offset.
                const coverX = presserX + (-bpNx) * COVER_DISTANCE_BEHIND_PRESSER +
                  (-bpNy) * COVER_LATERAL_OFFSET * lateralSign;
                const coverY = presserY + (-bpNy) * COVER_DISTANCE_BEHIND_PRESSER +
                  (bpNx) * COVER_LATERAL_OFFSET * lateralSign;
                // Blend cover position with current chase direction.
                const coverDx = coverX - playerX;
                const coverDy = coverY - playerY;
                const coverDist = Math.sqrt(coverDx * coverDx + coverDy * coverDy);
                if (coverDist > 0.001) {
                  const coverUnit = Math.min(coverDist, 1);
                  const coverMoveX = (coverDx / coverDist) * coverUnit;
                  const coverMoveY = (coverDy / coverDist) * coverUnit;
                  // Override chase target with cover position (blended).
                  chaseTargetX = coverX;
                  chaseTargetY = coverY;
                  effectiveDistToTarget = coverDist;
                  moveX = moveX * (1 - COVER_BLEND_WEIGHT) + coverMoveX * COVER_BLEND_WEIGHT;
                  moveY = moveY * (1 - COVER_BLEND_WEIGHT) + coverMoveY * COVER_BLEND_WEIGHT;
                  // Track mechanism activation for honesty guard.
                  _coverMechanismActivations++;
                }
              }
            }
          }
        }

        // --- Default chase direction toward target ---
        if (effectiveDistToTarget > 0.001) {
          const distUnit = Math.min(effectiveDistToTarget, 1);
          moveX = ((chaseTargetX - playerX) / effectiveDistToTarget) * distUnit;
          moveY = ((chaseTargetY - playerY) / effectiveDistToTarget) * distUnit;
        }

        // --- Pressing: nearest-to-ball defender presses carrier ---
        // When defensive mode is active and this player is the nearest
        // to the ball, press the ball carrier more aggressively when
        // within PRESS_RADIUS.
        // Press trigger: when the ball enters the nearest defender's zone,
        // increase sprint to signal more aggressive pressing behavior.
        // Fatigue modulates: press strength and radius shrink when tired.
        // Difficulty modulates: harder = wider radius + stronger press.
        if (isDefensiveMode && isNearestToBall && cpuTeamId) {
          const playerFatigue = state.fatigueTicks > 0
            ? Math.min(state.fatigueTicks / FATIGUE_MAX_TICKS, 1)
            : 0;
          const fatigueRadiusReduction = playerFatigue > 0 ? (1 - playerFatigue * 0.4) : 1;
          const fatigueStrengthReduction = playerFatigue > 0 ? (1 - playerFatigue * 0.3) : 1;
          const effectivePressRadius = PRESS_RADIUS * fatigueRadiusReduction * diffConfig.pressRadiusFactor;
          const effectivePressStrength = PRESS_STRENGTH * fatigueStrengthReduction * diffConfig.pressStrengthFactor;
          const ballCarrier = findBallCarrierPlayer(observation, cpuTeamId);
          if (ballCarrier) {
            const bcdx = ballCarrier.position.x - playerX;
            const bcdy = ballCarrier.position.y - playerY;
            const bcDist = Math.sqrt(bcdx * bcdx + bcdy * bcdy);
            if (bcDist < effectivePressRadius && bcDist > 0.001) {
              const distUnit = Math.min(bcDist, 1);
              let pressX = (bcdx / bcDist) * distUnit * effectivePressStrength;
              let pressY = (bcdy / bcDist) * distUnit * effectivePressStrength;
              // Clamp to valid input range.
              pressX = Math.max(-1, Math.min(1, pressX));
              pressY = Math.max(-1, Math.min(1, pressY));
              moveX = pressX;
              moveY = pressY;
            }
          }
        }

        // --- Cover shadow positioning ---
        // The nearest-to-ball defender positions between the ball and
        // the most threatening opponent (closest to own goal), blocking
        // the passing lane.  This is a supplement to the press, not
        // a replacement — the defender still moves toward the ball but
        // with a lateral bias toward the cover-shadow position.
        if (isDefensiveMode && isNearestToBall && cpuTeamId) {
          const threatening = findMostThreateningOpponent(observation, cpuTeamId);
          if (threatening) {
            const shadowPos = computeCoverShadow(
              ball.position.x, ball.position.y,
              threatening.position.x, threatening.position.y,
              0.3,
            );
            const shadowDx = shadowPos.x - playerX;
            const shadowDy = shadowPos.y - playerY;
            const shadowDist = Math.sqrt(shadowDx * shadowDx + shadowDy * shadowDy);
            if (shadowDist > 0.001) {
              const shadowUnit = Math.min(shadowDist, 1);
              const shadowMoveX = (shadowDx / shadowDist) * shadowUnit;
              const shadowMoveY = (shadowDy / shadowDist) * shadowUnit;
              moveX = moveX * (1 - COVER_SHADOW_STRENGTH) + shadowMoveX * COVER_SHADOW_STRENGTH;
              moveY = moveY * (1 - COVER_SHADOW_STRENGTH) + shadowMoveY * COVER_SHADOW_STRENGTH;
            }
          }
        }

        // --- Defensive line coordination ---
        // When one defender presses, other defenders shift laterally
        // to maintain the defensive line (similar y-coordinate).
        // This prevents the defensive line from being stretched by
        // a pressing defender's movement.
        if (isDefensiveMode && cpuTeamId &&
            cpuPlayer.formationRole === "defender" && !isNearestToBall) {
          const avgPressingY = computePressingDefendersAvgY(
            observation.players, cpuTeamId,
            observation.controlledPlayerId ?? "",
          );
          if (avgPressingY !== undefined) {
            const lineShiftY = avgPressingY - playerY;
            const clampedShift = Math.max(
              -LINE_COORDINATION_MAX_SHIFT,
              Math.min(LINE_COORDINATION_MAX_SHIFT, lineShiftY),
            );
            // Normalize and blend with the current movement.
            const lineDist = Math.abs(clampedShift);
            if (lineDist > 0.001) {
              const lineMoveY = (clampedShift / lineDist) * Math.min(lineDist, 1);
              moveX = moveX * (1 - LINE_WEIGHT);
              moveY = moveY * (1 - LINE_WEIGHT) + lineMoveY * LINE_WEIGHT;
            }
          }
        }

        // Track possession duration for off-ball cycling.
        if (state.hasPossession) {
          state.possessionDuration = 0;
        } else if (cpuTeamId && teamHasPossession(observation, cpuTeamId)) {
          state.possessionDuration++;
        } else {
          state.possessionDuration = 0;
        }

        // --- Off-ball forward run: teammates with possession ---
        // When the team has possession but this CPU player does NOT
        // have the ball, non-defenders push forward to create passing
        // options.  Role-aware targets place attackers deep, midfielders
        // in the middle, and defenders hold position.
        if (cpuTeamId && teamHasPossession(observation, cpuTeamId) && !state.hasPossession && !isNearestToBall && distToBall > FIRST_TOUCH_RANGE) {
          const opponentGoalX = getOpponentGoalX(cpuTeamId);
          const ballX = observation.ball.position.x;

          // Attack direction: +1 for team-a, -1 for team-b.
          const attackingX = cpuTeamId === "team-b" ? -1 : 1;

          const role = cpuPlayer.formationRole;

          // Base target distance from opponent goal by role.
          let targetDistFromGoal = OFFBALL_FORWARD_PUSH_BASE;
          let forwardMultiplier = 1;

          if (role === "attacker") {
            targetDistFromGoal = OFFBALL_FORWARD_PUSH_ATTACKER;
            forwardMultiplier = ATTACK_PHASE_FORWARD_MULTIPLIER_ATTACKER;
          } else if (role === "midfielder") {
            targetDistFromGoal = OFFBALL_FORWARD_PUSH_MIDFIELDER;
            forwardMultiplier = ATTACK_PHASE_FORWARD_MULTIPLIER_MIDFIELDER;
          }
          // Defenders: no forward push — fall through to chase-ball below.

          if (role !== "defender" && teamStrategy === "ATTACK") {
            targetDistFromGoal /= forwardMultiplier;
          }

          if (role !== "defender" && targetDistFromGoal > 0) {
            // Position the target ahead of the ball toward opponent goal,
            // at most targetDistFromGoal metres from the opponent goal,
            // but never closer to the goal than the ball itself.
            const ballDistToGoal = (opponentGoalX - ballX) * attackingX;
            const cappedDist = Math.min(targetDistFromGoal, Math.max(ballDistToGoal, 0));
            const targetX = opponentGoalX + cappedDist * (-attackingX);

            // Midfield cycling: alternate pushing forward / dropping back
            // during sustained possession (> 60 ticks without the ball).
            let adjustedTargetX = targetX;
            if (role === "midfielder" && state.possessionDuration > 60) {
              const cycleTick = state.possessionDuration - 60;
              const cycleSign = ((Math.floor(cycleTick / CYCLING_HALF_PERIOD) % 2) === 0)
                ? 1 : -1;
              adjustedTargetX += cycleSign * CYCLING_AMPLITUDE * attackingX;
            }

            const runDx = adjustedTargetX - playerX;
            const runDist = Math.abs(runDx);

            if (runDist > 0.5) {
              const distUnit = Math.min(runDist, 1);
              moveX = (runDx / runDist) * distUnit;
              moveY = 0;
            }
          }
        }

        // --- Support structure: maintain distances from ball carrier ---
        // Off-ball attacking players (attackers/midfielders) adjust their
        // position to stay within SUPPORT_MIN..MAX distance of the ball
        // carrier and position in passing-lane-adjacent positions rather
        // than collapsing onto the ball.  This creates observable support
        // geometry without breaking the team shape.
        if (cpuTeamId && teamHasPossession(observation, cpuTeamId) &&
            !state.hasPossession && !isNearestToBall && distToBall > FIRST_TOUCH_RANGE) {
          const role = cpuPlayer.formationRole;
          if (role === "attacker" || role === "midfielder") {
            // Find the ball carrier (nearest teammate to the ball).
            let carrierX = ball.position.x;
            let carrierY = ball.position.y;
            let carrierDist = Infinity;
            for (const p of observation.players) {
              if (p.teamId !== cpuTeamId) continue;
              const pdx = ball.position.x - p.groundPosition.x;
              const pdy = ball.position.y - p.groundPosition.y;
              const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
              if (pdist < carrierDist) {
                carrierDist = pdist;
                carrierX = p.groundPosition.x;
                carrierY = p.groundPosition.y;
              }
            }

            const toCarrierDx = carrierX - playerX;
            const toCarrierDy = carrierY - playerY;
            const toCarrierDist = Math.sqrt(
              toCarrierDx * toCarrierDx + toCarrierDy * toCarrierDy,
            );

            if (toCarrierDist > 0.001) {
              // Direction from this player toward the carrier.
              const toCarrierNx = toCarrierDx / toCarrierDist;
              const toCarrierNy = toCarrierDy / toCarrierDist;

              // Perpendicular to carrier direction (passing-lane offset).
              const perpX = -toCarrierNy;
              const perpY = toCarrierNx;

              let supportMoveX = 0;
              let supportMoveY = 0;

              if (toCarrierDist < SUPPORT_MIN_DISTANCE) {
                // Too close — push laterally away from carrier.
                // Choose lateral direction based on player's position
                // relative to ball-to-goal line.
                const attackingX = cpuTeamId === "team-b" ? -1 : 1;
                const lateralDot = perpX * attackingX;
                const lateralSign = lateralDot >= 0 ? 1 : -1;
                supportMoveX = -toCarrierNx * 0.5 + perpX * lateralSign * 0.8;
                supportMoveY = -toCarrierNy * 0.5 + perpY * lateralSign * 0.8;
              } else if (toCarrierDist > SUPPORT_MAX_DISTANCE) {
                // Too far — drift toward carrier to maintain passing viability.
                supportMoveX = toCarrierNx * 0.4;
                supportMoveY = toCarrierNy * 0.4;
              }
              // else: in the sweet spot — no support adjustment needed.

              // Blend support adjustment with existing movement.
              const sLen = Math.sqrt(
                supportMoveX * supportMoveX + supportMoveY * supportMoveY,
              );
              if (sLen > 0.001) {
                const sUnit = Math.min(sLen, 1);
                supportMoveX = (supportMoveX / sLen) * sUnit;
                supportMoveY = (supportMoveY / sLen) * sUnit;
                moveX = moveX * (1 - SUPPORT_BLEND_WEIGHT) + supportMoveX * SUPPORT_BLEND_WEIGHT;
                moveY = moveY * (1 - SUPPORT_BLEND_WEIGHT) + supportMoveY * SUPPORT_BLEND_WEIGHT;
                // Track mechanism activation for honesty guard.
                _supportMechanismActivations++;
              }
            }
          }
        }

        // --- Optional formation blend (only when formationPosition is set) ---
        // A body holding its formation home is anchored to that fixed point; the
        // dynamic recovery anchor is only meaningful when this body is free to
        // chase.
        const formPos = holdsFormationHome ? kickoffHome : observation.formationPosition;
        if (formPos) {
          const fdx = formPos.x - playerX;
          const fdy = formPos.y - playerY;
          const fDist = Math.sqrt(fdx * fdx + fdy * fdy);

          // Only blend when the ball is BEHIND the player (toward own goal).
          // When the ball is ahead, the CPU chases fully regardless.
          const isBehind = cpuTeamId === "team-b"
            ? ball.position.x > playerX  // team-b own goal at +x; ball > player = behind
            : ball.position.x < playerX; // team-a own goal at -x; ball < player = behind

          if (isBehind) {
            // --- Formation recovery: track displacement ---
            if (fDist < 0.5) {
              state.formationDisplacementTicks = 0;
            } else {
              state.formationDisplacementTicks++;
            }

            if (fDist > 0.001) {
              // Blend: 0 = chase, 1 = hold formation.
              const blendRange = CHASE_FORMATION_THRESHOLD;
              let formationWeight = Math.min(
                Math.max((distToBall - CHASE_FORMATION_THRESHOLD) / blendRange, 0),
                1,
              );

              let recoveryWeight = computeFormationRecoveryWeight(
                state.formationDisplacementTicks,
                fDist,
              );

              // Apply team-decision modulation:
              //  ATTACK mode: reduce formation pull (players push forward).
              //  DEFEND mode: increase formation pull (players hold shape).
              //  Marking mode: reduce formation pull for marking defenders
              //    (they track opponents, not formation position).
              if (teamStrategy === "ATTACK" && !isNearestToBall) {
                formationWeight *= 0.3;
                recoveryWeight *= 0.3;
              } else if (teamStrategy === "DEFEND") {
                formationWeight = Math.min(formationWeight * 1.5, 1);
                recoveryWeight = Math.min(recoveryWeight * 1.5, 0.95);
              }

              // Marking defenders blend less with formation (they track
              // opponents); the mark target already accounts for position.
              if (isDefensiveMode && cpuPlayer.formationRole === "defender" && !isNearestToBall) {
                formationWeight *= 0.5;
                recoveryWeight *= 0.5;
              }

              // Blend chase with formation direction.
              const combinedX = moveX * (1 - formationWeight) + (fdx / fDist) * formationWeight;
              const combinedY = moveY * (1 - formationWeight) + (fdy / fDist) * formationWeight;
              moveX = combinedX * (1 - recoveryWeight) + (fdx / fDist) * recoveryWeight;
              moveY = combinedY * (1 - recoveryWeight) + (fdy / fDist) * recoveryWeight;
            }
          } else {
            // Ball ahead: reset displacement tracking since
            // the player is actively chasing, not displaced.
            state.formationDisplacementTicks = 0;
          }
        } else {
          // No formation position — reset displacement tracking.
          state.formationDisplacementTicks = 0;
        }

        // FIRST_TOUCH: press when entering range, hold while in range.
        // During shot cooldown, suppress FIRST_TOUCH to simulate recovery.
        const inCooldown = state.shotCooldownRemaining > 0;
        pressedButtons |= (!ballInRange || state.ballWasInRange || inCooldown)
          ? 0
          : FIRST_TOUCH_BIT;
        heldButtons |= (!ballInRange || inCooldown)
          ? 0
          : FIRST_TOUCH_BIT;

        // Restart re-arm (5V5-KICKOFF-ANTI-HUDDLE, window-aware since
        // RESTART-ANTI-HUDDLE-COHERENCE): while the ball is an untouched
        // restart ball it is still the serve nobody has played, so a body that
        // is inside the radius the contact system honours keeps issuing the
        // edge instead of spending its one entering press on a tick the core
        // could not execute. Past the first touch this path never runs.
        if (antiHuddleActive && ballUntouched &&
            distToBall <= touchPressRange && !inCooldown) {
          pressedButtons |= FIRST_TOUCH_BIT;
        }

        // ----------------------------------------------------------------
        // Defensive tackle commitment (CPU-DEFENSIVE-TACKLE)
        // ----------------------------------------------------------------
        // The authorisation is the shared per-team signal computed from the
        // observation; this slot acts on it only when its own controller
        // exposes the defensive buttons (the same bits a human reaches through
        // the keyboard bindings). Nothing outside the observation is read, and
        // the press is the adapter's only effect — the action system owns the
        // resulting commitment, contact window and recovery cost.
        const tackleCommit = observation.cpuDefensiveTackle
          ? observation.teamDecision?.tackleCommit ?? null
          : null;
        const authorised =
          tackleCommit !== null &&
          observation.controlledPlayerId !== undefined &&
          tackleCommit.playerId === observation.controlledPlayerId;
        state.tackleHoldTicks = authorised ? state.tackleHoldTicks + 1 : 0;

        // Gathering a loose ball beats lunging at it: the tick this body wins a
        // first touch, the tackle press is dropped instead of trading the touch
        // for a self-denial.
        const takingTouch = (pressedButtons & FIRST_TOUCH_BIT) !== 0;
        // Self-knowledge of the attempt's own declared windows: the action
        // system releases on startTick + prepare + active + recover, and a
        // press before then is only ever a lock-out rejection. The recommit is
        // held to strictly after the release tick, so the CPU never re-presses
        // on the tick the body comes off the ground.
        const ownAttemptReleased = tick > state.tackleReleaseTick;
        if (
          authorised &&
          ownAttemptReleased &&
          !takingTouch &&
          state.tackleHoldTicks >= FOUNDATION_CPU_TACKLE_V1.reactionTicks.value
        ) {
          const standing = tackleCommit!.kind === "standing";
          const bits = standing ? STANDING_TACKLE_BIT : SLIDE_TACKLE_BIT;
          pressedButtons |= bits;
          heldButtons |= bits;
          const commitmentTicks = standing
            ? FOUNDATION_TACKLE_V1.standingPrepareTicks.value +
              FOUNDATION_TACKLE_V1.standingActiveTicks.value +
              FOUNDATION_TACKLE_V1.standingRecoverTicks.value
            : FOUNDATION_TACKLE_V1.slidePrepareTicks.value +
              FOUNDATION_TACKLE_V1.slideActiveTicks.value +
              FOUNDATION_TACKLE_V1.slideRecoverTicks.value;
          state.tackleReleaseTick = tick + commitmentTicks;
          state.tackleHoldTicks = 0;
          _cpuTackleCommits++;
        }
      }

      // Track shot firing for cooldown state update.
      // We detect a shot by checking if SHOT_BIT is in pressedButtons
      // (not heldButtons) — this is a new press.
      const shotJustPressed = (pressedButtons & SHOT_BIT) !== 0;
      const anyButtonPressed = pressedButtons !== 0;

      // Update ballWasInRange for next tick.
      // After a shot, clear it to prevent immediate re-possession.
      // Lofted passes (isLoftedPass) still lose possession but skip cooldown.
      if (shotJustPressed) {
        state.hasPossession = false;
        state.ballWasInRange = false;
        if (!state.isLoftedPass) {
          state.shotCooldownRemaining = SHOT_COOLDOWN_TICKS;
        }
      } else if (anyButtonPressed && state.hasPossession) {
        // Some other action was pressed while in possession (not a shot).
        // We still maintain possession.
        state.ballWasInRange = ballInRange;
      } else {
        state.ballWasInRange = ballInRange;
      }

      return {
        tick,
        sourceId: "cpu",
        controlSlot: "slot-cpu",
        moveX,
        moveY,
        sprint: 1,
        heldButtons,
        pressedButtons,
        releasedButtons: 0,
      };
    },

    reset(): void {
      state.ballWasInRange = false;
      state.hasPossession = false;
      state.passWasPressed = false;
      state.shotCooldownRemaining = 0;
      state.isLoftedPass = false;
      state.formationDisplacementTicks = 0;
      state.kickoffHome = null;
      state.restartTouchBaseline = null;
      state.restartAnchor = null;
      state.untouchedWindowOrdinal = 0;
      state.firstWindowWasKickoff = false;
      state.restartHoldTicks = 0;
      state.lastSeenTouchRef = undefined;
      state.possessionDuration = 0;
      state.activePassTick = -1;
      state.activePasserPosition = { x: 0, y: 0 };
      state.activePassBallVelocity = { x: 0, y: 0 };
      state.activePasserId = "";
      state.isOverlapping = false;
      state.fatigueTicks = 0;
      state.lastCurrentHalf = 1;
      state.tackleHoldTicks = 0;
      state.tackleReleaseTick = -1;
      state.keeperPlayerId = undefined;
      state.keeperReaction = { ...KEEPER_REACTION_IDLE };
      state.ballWasInSaveReach = false;
    },
  };
}