/**
 * @module @pes/adapters/input-browser/cpu-adapter
 *
 * CPU / AI adapter — produces normalized tick-indexed InputFrames
 * for AI_FALLBACK control slots.
 *
 * Responsibilities:
 *  - Read-only world observation (no mutation).
 *  - Chase-ball steering: compute direction from CPU player to ball.
 *  - FIRST_TOUCH: press when within ~1.5 m of a slow ball.
 *  - Always sprint (sprint = 1).
 *  - sourceId is "cpu" — pure provenance, never affects gameplay.
 *
 * Deterministic: same (tick, observation) → same InputFrame.
 * No Math.random, Date, DOM, or Node I/O.
 */

import type { InputFrame } from "../../contracts/input.js";
import { FIRST_TOUCH_BIT } from "../../contracts/input.js";
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
}

// ---------------------------------------------------------------------------
// buildCpuObservation — convert WorldState → CpuObservation
// ---------------------------------------------------------------------------

/**
 * Extract the minimal read-only fields the CPU adapter needs
 * from the authoritative world state.
 *
 * @param world — authoritative WorldState (not mutated).
 * @returns a CpuObservation containing the fields the CPU needs.
 */
export function buildCpuObservation(
  world: WorldState,
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

/** Simple internal state for the CPU adapter. */
interface CpuInternalState {
  /** Whether the ball was within range on the previous sample call. */
  ballWasInRange: boolean;
}

/**
 * Create a new CPU adapter with default chase-ball strategy.
 *
 * The CPU chases the ball:
 *  - Computes direction from CPU player to ball.
 *  - Moves toward the ball (normalized direction).
 *  - Sprints always.
 *  - Presses FIRST_TOUCH when within ~1.5 m of a slow ball (< 2 m/s horizontal).
 *
 * @returns A CpuAdapter instance.
 */
export function createCpuAdapter(): CpuAdapter {
  const state: CpuInternalState = { ballWasInRange: false };

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
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Normalized direction (clamped to max magnitude 1).
      let moveX = 0;
      let moveY = 0;
      if (distance > 0.001) {
        const distanceUnit = Math.min(distance, 1);
        moveX = (dx / distance) * distanceUnit;
        moveY = (dy / distance) * distanceUnit;
      }

      // FIRST_TOUCH logic: within 1.5 m and ball horizontal speed < 2 m/s.
      const ballHSpeed = Math.sqrt(
        ball.linearVelocity.x ** 2 + ball.linearVelocity.y ** 2,
      );
      const ballInRange = distance < 1.5 && ballHSpeed < 2;

      // pressedButtons: set on first entry into range.
      const pressed = ballInRange && !state.ballWasInRange
        ? FIRST_TOUCH_BIT
        : 0;

      // heldButtons: set while in range.
      const held = ballInRange ? FIRST_TOUCH_BIT : 0;

      state.ballWasInRange = ballInRange;

      return {
        tick,
        sourceId: "cpu",
        controlSlot: "slot-cpu",
        moveX,
        moveY,
        sprint: 1,
        heldButtons: held,
        pressedButtons: pressed,
        releasedButtons: 0,
      };
    },

    reset(): void {
      state.ballWasInRange = false;
    },
  };
}