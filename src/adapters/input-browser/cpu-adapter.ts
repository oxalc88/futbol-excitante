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
 *  - Chase-ball: default defense behavior when not in possession.
 *  - FIRST_TOUCH: press when within ~1.5 m of a slow ball (defense).
 *  - Always sprint (sprint = 1).
 *  - sourceId is "cpu" — pure provenance, never affects gameplay.
 *  - Formation recovery: displaced players return toward formation
 *    position over time, blended with chase direction.
 *  - Off-ball attacking: non-possessing players push forward during
 *    team possession (role-aware forward runs, cycling pattern).
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
 */

import type { InputFrame } from "../../contracts/input.js";
import { FIRST_TOUCH_BIT, PASS_BIT, SHOT_BIT } from "../../contracts/input.js";
import type { WorldState } from "../../contracts/state.js";
import { teamHasPossession } from "./team-decision-profile.js";
import type { TeamDecision } from "./team-decision-profile.js";
export type { TeamDecision, DefensiveSubMode } from "./team-decision-profile.js";
export { computeTeamDecision, getBallZone, teamHasPossession } from "./team-decision-profile.js";

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
 * Compute score-state urgency multiplier.
 *
 * - scoreDiff >= 2: CPU is ahead → caution mode (reduced urgency).
 * - scoreDiff <= -2: CPU is behind → aggressive mode.
 * - otherwise: neutral.
 *
 * Returns a factor in [0.5, 2] that scales shooting/wide-angle thresholds.
 */
function getScoreUrgency(scoreDiff?: number): number {
  if (typeof scoreDiff === "number" && scoreDiff >= 2) return 0.5;
  if (typeof scoreDiff === "number" && scoreDiff <= -2) return 2;
  return 1;
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
export function createCpuAdapter(): CpuAdapter {
  const state: CpuInternalState = {
    ballWasInRange: false,
    hasPossession: false,
    passWasPressed: false,
    shotCooldownRemaining: 0,
    isLoftedPass: false,
    formationDisplacementTicks: 0,
    possessionDuration: 0,
    activePassTick: -1,
    activePasserPosition: { x: 0, y: 0 },
    activePassBallVelocity: { x: 0, y: 0 },
    activePasserId: "",
    isOverlapping: false,
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

      // Compute vector from CPU player to ball.
      const dx = ball.position.x - playerX;
      const dy = ball.position.y - playerY;
      const distToBall = Math.sqrt(dx * dx + dy * dy);

      // Ball horizontal speed.
      const ballHSpeed = Math.sqrt(
        ball.linearVelocity.x ** 2 + ball.linearVelocity.y ** 2,
      );

      // Is ball in FIRST_TOUCH range this tick?
      const ballInRange =
        distToBall < FIRST_TOUCH_RANGE && ballHSpeed < FIRST_TOUCH_SPEED_THRESHOLD;

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

      const cpuTeamId = observation.cpuTeamId;
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
        if (distToGoal > 0.001) {
          const aimY = getShotAimOffsetY(tick);
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
        const adjustedTolerance = FACING_TOLERANCE_CLOSE * urgency;
        const cappedTolerance = Math.min(adjustedTolerance, Math.PI);
        const goalAngle = Math.atan2(gdy, gdx);
        const headingDiff = normalizeAngle(cpuPlayer.bodyHeading - goalAngle);
        const isFacingGoal = Math.abs(headingDiff) <= cappedTolerance;

        // Close range: always shoot if within close range.
        // Apply urgency multiplier to lower the distance threshold for backup.
        const adjustedCloseRange = SHOT_RANGE_CLOSE / urgency;
        if (distToGoal <= SHOT_RANGE_CLOSE) {
          if (distToGoal <= adjustedCloseRange) {
            heldButtons |= SHOT_BIT;
            pressedButtons |= SHOT_BIT;
          }
        } else if (distToGoal <= SHOT_RANGE_WIDE && isFacingGoal) {
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
            distToGoal > SHOT_RANGE_WIDE || !isFacingGoal;

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
          (distToGoal > SHOT_RANGE_WIDE || !isFacingGoal);
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
        if (isDefensiveMode && isNearestToBall && cpuTeamId) {
          const ballCarrier = findBallCarrierPlayer(observation, cpuTeamId);
          if (ballCarrier) {
            const bcdx = ballCarrier.position.x - playerX;
            const bcdy = ballCarrier.position.y - playerY;
            const bcDist = Math.sqrt(bcdx * bcdx + bcdy * bcdy);
            if (bcDist < PRESS_RADIUS && bcDist > 0.001) {
              const distUnit = Math.min(bcDist, 1);
              let pressX = (bcdx / bcDist) * distUnit * PRESS_STRENGTH;
              let pressY = (bcdy / bcDist) * distUnit * PRESS_STRENGTH;
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

        // --- Optional formation blend (only when formationPosition is set) ---
        const formPos = observation.formationPosition;
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
      state.possessionDuration = 0;
      state.activePassTick = -1;
      state.activePasserPosition = { x: 0, y: 0 };
      state.activePassBallVelocity = { x: 0, y: 0 };
      state.activePasserId = "";
      state.isOverlapping = false;
    },
  };
}