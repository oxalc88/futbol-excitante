/**
 * @module @pes/adapters/input-browser/cpu-adapter
 *
 * CPU / AI adapter — produces normalized tick-indexed InputFrames
 * for AI_FALLBACK control slots.
 *
 * Responsibilities:
 *  - Read-only world observation (no mutation).
 *  - Goal-aware steering: toward opponent's goal when in possession.
 *  - Shooting: press SHOT_BIT when within range and facing the goal.
 *  - Chase-ball: default defense behavior when not in possession.
 *  - FIRST_TOUCH: press when within ~1.5 m of a slow ball (defense).
 *  - Always sprint (sprint = 1).
 *  - sourceId is "cpu" — pure provenance, never affects gameplay.
 *
 * Deterministic: same (tick, observation) → same InputFrame.
 * No Math.random, Date, DOM, or Node I/O.
 */

import type { InputFrame } from "../../contracts/input.js";
import { FIRST_TOUCH_BIT, SHOT_BIT } from "../../contracts/input.js";
import type { WorldState } from "../../contracts/state.js";

// ---------------------------------------------------------------------------
// CpuObservation — minimal read-only subset of world state
// ---------------------------------------------------------------------------

/** Minimal observation the CPU adapter needs from world state. */
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
 * @returns a CpuObservation containing the fields the CPU needs.
 */
export function buildCpuObservation(
  world: WorldState,
  cpuTeamId?: string,
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
}

// ---------------------------------------------------------------------------
// Constants for goal-awareness
// ---------------------------------------------------------------------------

/** Goal centre x-coordinate (half of 105 m pitch). */
const GOAL_CENTRE_X = 52.5;

/** Possession range — ball within this distance = in possession (metres). */
const POSSESSION_RANGE = 2;

/** Shot range — shoot when within this distance of the goal (metres). */
const SHOT_RANGE = 15;

/** First-touch range — press FIRST_TOUCH within this distance (metres). */
const FIRST_TOUCH_RANGE = 1.5;

/** Ball horizontal speed threshold for FIRST_TOUCH (m/s). */
const FIRST_TOUCH_SPEED_THRESHOLD = 2;

/** Ball horizontal speed threshold for possession (m/s). */
const POSSESSION_SPEED_THRESHOLD = 3;

/** Heading tolerance for shooting (radians, ±45°). */
const FACING_TOLERANCE = Math.PI / 4;

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
 *  - OFFENSE (possession): steer toward opponent's goal, shoot when in range.
 *  - DEFENSE (no possession): chase the ball, press FIRST_TOUCH when near.
 *
 * Possession is gained when the ball enters FIRST_TOUCH range on one tick,
 * then confirmed on the next tick (ballWasInRange → hasPossession).
 * Possession is lost when the ball moves beyond POSSESSION_RANGE or after shooting.
 *
 * @returns A CpuAdapter instance.
 */
export function createCpuAdapter(): CpuAdapter {
  const state: CpuInternalState = { ballWasInRange: false, hasPossession: false };

  return {
    sample(tick: number, observation: CpuObservation): InputFrame {
      // Find the first player (CPU controlled).
      const cpuPlayer = observation.players[0];
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
      //   Lose: ball beyond POSSESSION_RANGE.
      if (state.ballWasInRange) {
        state.hasPossession = true;
      }
      if (distToBall > POSSESSION_RANGE) {
        state.hasPossession = false;
      }

      let moveX = 0;
      let moveY = 0;
      let heldButtons = 0;
      let pressedButtons = 0;
      let shotFired = false;

      const cpuTeamId = observation.cpuTeamId;

      if (state.hasPossession && cpuTeamId) {
        // ----------------------------------------------------------------
        // OFFENSE MODE — steer toward opponent's goal
        // ----------------------------------------------------------------
        const goalX = getOpponentGoalX(cpuTeamId);
        const gdx = goalX - playerX;
        const gdy = 0 - playerY; // goal is on the centre line (y=0)
        const distToGoal = Math.sqrt(gdx * gdx + gdy * gdy);

        // Normalized direction toward the goal.
        if (distToGoal > 0.001) {
          const distUnit = Math.min(distToGoal, 1);
          moveX = (gdx / distToGoal) * distUnit;
          moveY = (gdy / distToGoal) * distUnit;
        }

        // Shoot: within range and facing the goal.
        if (distToGoal < SHOT_RANGE) {
          const goalAngle = Math.atan2(gdy, gdx);
          const headingDiff = normalizeAngle(cpuPlayer.bodyHeading - goalAngle);
          if (Math.abs(headingDiff) <= FACING_TOLERANCE) {
            heldButtons |= SHOT_BIT;
            pressedButtons |= SHOT_BIT;
            shotFired = true;
          }
        }
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
        pressedButtons |= ballInRange && !state.ballWasInRange
          ? FIRST_TOUCH_BIT
          : 0;
        heldButtons |= ballInRange ? FIRST_TOUCH_BIT : 0;
      }

      // Update ballWasInRange for next tick.
      // After a shot, clear it to prevent immediate re-possession.
      if (shotFired) {
        state.hasPossession = false;
        state.ballWasInRange = false;
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
    },
  };
}