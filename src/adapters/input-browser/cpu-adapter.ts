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
 */

import type { InputFrame } from "../../contracts/input.js";
import { FIRST_TOUCH_BIT, PASS_BIT, SHOT_BIT } from "../../contracts/input.js";
import type { WorldState } from "../../contracts/state.js";

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

export interface CpuObservation {
  /** All players on the pitch. */
  players: Array<{
    playerId: string;
    teamId: string;
    groundPosition: { x: number; y: number };
    linearVelocity: { x: number; y: number };
    bodyHeading: number;
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

  // Populate teammates from world state: same teamId, different playerId.
  // controlledPlayerId: use the explicit parameter if set, otherwise the first player.
  const controlledPlayerId_ = controlledPlayerId ?? (cpuTeamId && world.players.length > 0
    ? world.players[0].playerId
    : undefined);
  const teammates: CpuTeammate[] = [];
  if (cpuTeamId) {
    for (const p of world.players) {
      if (p.teamId === cpuTeamId && p.playerId !== controlledPlayerId_) {
        teammates.push({
          playerId: p.playerId,
          groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
        });
      }
    }
  }

  return {
    players: world.players.map((p) => ({
      playerId: p.playerId,
      teamId: p.teamId,
      groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
      linearVelocity: { x: p.linearVelocity.x, y: p.linearVelocity.y },
      bodyHeading: p.bodyHeading,
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
    controlledPlayerId: controlledPlayerId_,
  };
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
}

/**
 * Find the best teammate to pass to.
 *
 * Filters to teammates in a forward direction (toward opponent goal)
 * and returns the nearest one.  Falls back to undefined when no
 * forward teammate exists.
 *
 * Direction is forward when the dot product of
 * (teammatePos - playerPos) with the attack direction is positive.
 * Attack direction: +x for team-a, -x for team-b.
 */
function getBestTeammateTarget(
  teammates: CpuTeammate[],
  playerPos: { x: number; y: number },
  cpuTeamId: string,
): { x: number; y: number } | undefined {
  const attackingX = cpuTeamId === "team-b" ? -1 : 1;
  let best: { x: number; y: number; dist: number } | undefined;

  for (const tm of teammates) {
    const dx = tm.groundPosition.x - playerPos.x;
    const dy = tm.groundPosition.y - playerPos.y;

    // Forward check: dot product with attack direction > 0.
    if (dx * attackingX <= 0) {
      continue;
    }

    const distSq = dx * dx + dy * dy;
    if (!best || distSq < best.dist) {
      best = { x: tm.groundPosition.x, y: tm.groundPosition.y, dist: distSq };
    }
  }

  return best ? { x: best.x, y: best.y } : undefined;
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

/**
 * Minimum possession range when in shot cooldown.
 * Extends the effective POSSESSION_RANGE during cooldown
 * so the CPU doesn't lose possession the moment the ball
 * stops moving right next to it.
 * Provisional: unmeasured PES 2017 value.
 */
const POSSESSION_RANGE_COOLDOWN = 3;

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
 * Normalize an angle to the range [-PI, PI].
 */
function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
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

        // Pass decision: if not shooting, press PASS_BIT when
        // beyond shot range or not facing well enough (edge detected).
        const shotNotPressed = (pressedButtons & SHOT_BIT) === 0;
        if (shotNotPressed) {
          const shouldPressPass =
            distToGoal > SHOT_RANGE_WIDE || !isFacingGoal;
          // Edge detection: press only when entering the pass state.
          if (shouldPressPass && !state.passWasPressed) {
            pressedButtons |= PASS_BIT;
          }
          // Hold while condition persists.
          if (shouldPressPass) {
            heldButtons |= PASS_BIT;
          }

          // Aim the pass toward the nearest forward teammate when available.
          if (shouldPressPass && observation.teammates &&
              observation.teammates.length > 0 && cpuTeamId) {
            const target = getBestTeammateTarget(
              observation.teammates,
              { x: playerX, y: playerY },
              cpuTeamId,
            );
            if (target) {
              const aimDx = target.x - playerX;
              const aimDy = target.y - playerY;
              const normalized = normalizeVec2(aimDx, aimDy);
              moveX = normalized.dx;
              moveY = normalized.dy;
            }
          }
        }

        // Track pass state for edge detection on next tick.
        state.passWasPressed = shotNotPressed &&
          (distToGoal > SHOT_RANGE_WIDE || !isFacingGoal);
      } else {
        // ----------------------------------------------------------------
        // DEFENSE MODE — chase ball
        // ----------------------------------------------------------------
        if (distToBall > 0.001) {
          const distUnit = Math.min(distToBall, 1);
          moveX = (dx / distToBall) * distUnit;
          moveY = (dy / distToBall) * distUnit;
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
      if (shotJustPressed) {
        state.hasPossession = false;
        state.ballWasInRange = false;
        state.shotCooldownRemaining = SHOT_COOLDOWN_TICKS;
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
    },
  };
}