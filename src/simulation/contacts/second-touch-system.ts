/**
 * @module @pes/simulation/contacts/second-touch-system
 *
 * Second-touch / dribble state machine.
 *
 * After a first-touch contact, the player enters a "dribble" state
 * where:
 *   - The ball stays within dribbleRange of the player
 *   - Ball velocity is dampened to match player movement
 *   - The player can turn (rotate body heading) while maintaining ball control
 *   - Turn actions emit "second-touch" events
 *
 * The ball remains an independent 3D entity. Position is never
 * teleported. Dribble state is external to PlayerState (tracked
 * in a Map keyed by playerId).
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import type { BallState, PlayerState } from "../../contracts/state.js";
import type { InputFrame } from "../../contracts/input.js";
import type { SimulationEvent } from "../../contracts/scenario.js";
import { FOUNDATION_SECOND_TOUCH_V1 } from "../config/foundation.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Dribble state for a single player.
 * External to PlayerState — tracked in a Map keyed by playerId.
 */
export interface DribbleState {
  /** Whether this player is currently in an active dribble. */
  active: boolean;
  /** Tick at which dribble started (first-touch tick). */
  startTick: number;
  /** Tick at which the last turn action was performed. */
  lastTurnTick: number;
  /** Accumulated number of ticks in active dribble state. */
  dribbleTicks: number;
  /** Heading the ball is currently travelling in (for dampening toward player). */
  ballDribbleHeading: number;
  /** Speed the ball is currently travelling at (for dampening). */
  ballDribbleSpeed: number;
}

/**
 * Config shape (matches FOUNDATION_SECOND_TOUCH_V1).
 */
interface SecondTouchConfig {
  dribbleRange: { value: number };
  ballSpeedFactor: { value: number };
  turnCooldownTicks: { value: number };
  maxDribbleTicks: { value: number };
  secondTouchDelay: { value: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAU = 2 * Math.PI;

/** Normalize an angle to [-π, π). */
function normalizeAngle(angle: number): number {
  let a = angle;
  if (a >= Math.PI) {
    a -= TAU * Math.floor((a + Math.PI) / TAU);
  } else if (a < -Math.PI) {
    a += TAU * Math.floor((Math.PI - a) / TAU);
  }
  return a;
}

/** Euclidean magnitude of a 2D vector. */
function mag2d(v: { x: number; y: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/** Planar distance between player and ball. */
function planarDistance(
  px: number,
  py: number,
  bx: number,
  by: number,
): number {
  const dx = px - bx;
  const dy = py - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enter dribble state for a player after a first-touch contact.
 *
 * Called by the contact system when a first-touch event is resolved.
 * Does nothing if the player is already in active dribble.
 *
 * @param dribbleStates - Mutable dribble state map.
 * @param playerId - Player entering dribble.
 * @param tick - Current simulation tick.
 */
export function enterDribble(
  dribbleStates: Map<string, DribbleState>,
  playerId: string,
  tick: number,
): void {
  const existing = dribbleStates.get(playerId);
  if (existing?.active) return;

  dribbleStates.set(playerId, {
    active: true,
    startTick: tick,
    lastTurnTick: tick - TAU, // ensure no turn on first tick
    dribbleTicks: 0,
    ballDribbleHeading: 0,
    ballDribbleSpeed: 0,
  });
}

/**
 * Check whether a player is in active dribble state.
 */
export function isDribbling(
  dribbleStates: Map<string, DribbleState>,
  playerId: string,
): boolean {
  return dribbleStates.get(playerId)?.active ?? false;
}

/**
 * Force-end dribble for a player.
 *
 * Called when the ball leaves dribble range or dribble time expires.
 */
export function endDribble(
  dribbleStates: Map<string, DribbleState>,
  playerId: string,
): void {
  const state = dribbleStates.get(playerId);
  if (state) {
    state.active = false;
  }
}

/**
 * Step the second-touch / dribble state machine for one tick.
 *
 * For each player in active dribble state:
 *  1. Check if ball is within dribbleRange — if not, end dribble.
 *  2. Check if dribble duration exceeds maxDribbleTicks — if so, end dribble.
 *  3. Dampen ball velocity toward player's movement direction/speed.
 *  4. If a turn action is detected (heading change) and turn cooldown
 *     has elapsed, emit a second-touch event.
 *
 * @param players - All players (read).
 * @param ball - Mutable ball state (velocity may be modified).
 * @param dribbleStates - Mutable per-player dribble state map.
 * @param framesForTick - Input frames for this tick.
 * @param controlAssignments - Slot → player assignment map.
 * @param config - Second-touch coefficients.
 * @param eventCounter - Global event counter (mutated in place).
 * @param tick - Current simulation tick.
 * @returns Events generated this tick (second-touch turn events).
 */
export function stepDribble(
  players: readonly PlayerState[],
  ball: BallState,
  dribbleStates: Map<string, DribbleState>,
  framesForTick: readonly InputFrame[],
  controlAssignments: Record<string, { teamId: string; controlledPlayerId: string; mode: string }>,
  config: SecondTouchConfig = FOUNDATION_SECOND_TOUCH_V1,
  eventCounter: { value: number },
  tick: number,
): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  const dribbleRange = config.dribbleRange.value;
  const ballSpeedFactor = config.ballSpeedFactor.value;
  const turnCooldown = config.turnCooldownTicks.value;
  const maxDribble = config.maxDribbleTicks.value;
  const secondTouchDelay = config.secondTouchDelay.value;

  // Build lookup: playerId → InputFrame
  const frameBySlot = new Map<string, InputFrame>();
  for (const f of framesForTick) {
    frameBySlot.set(f.controlSlot, f);
  }
  const frameByPlayerId = new Map<string, InputFrame>();
  for (const slot of Object.keys(controlAssignments)) {
    const assignment = controlAssignments[slot];
    if (assignment?.controlledPlayerId) {
      const frame = frameBySlot.get(slot);
      if (frame) {
        frameByPlayerId.set(assignment.controlledPlayerId, frame);
      }
    }
  }

  // Find the dribbling player who is closest to the ball (deterministic).
  // Only one player can be in active dribble with the ball at a time.
  let closestDribbler: { playerId: string; dist: number } | null = null;
  for (const [playerId, ds] of dribbleStates) {
    if (!ds.active) continue;
    const player = players.find((p) => p.playerId === playerId);
    if (!player) continue;
    const dist = planarDistance(
      player.groundPosition.x,
      player.groundPosition.y,
      ball.position.x,
      ball.position.y,
    );
    if (closestDribbler === null || dist < closestDribbler.dist) {
      closestDribbler = { playerId, dist };
    }
  }

  if (!closestDribbler) return events;

  const ds = dribbleStates.get(closestDribbler.playerId)!;
  const player = players.find((p) => p.playerId === closestDribbler!.playerId)!;
  const playerSpeed = mag2d(player.linearVelocity);
  const distToBall = closestDribbler.dist;

  // --- 1. Check dribble range -----------------------------------------------
  if (distToBall > dribbleRange) {
    // Ball left dribble range — end dribble.
    endDribble(dribbleStates, closestDribbler.playerId);
    return events;
  }

  // --- 2. Check dribble duration --------------------------------------------
  ds.dribbleTicks++;
  if (ds.dribbleTicks > maxDribble) {
    endDribble(dribbleStates, closestDribbler.playerId);
    return events;
  }

  // --- 3. Dampen ball velocity toward player movement -----------------------
  // Target: ball moves at playerSpeed × ballSpeedFactor in the player's
  // movement direction (desiredVelocity), or bodyHeading if nearly stationary.
  let targetDirX: number;
  let targetDirY: number;

  if (playerSpeed >= 0.3) {
    // Use movement direction.
    targetDirX = player.linearVelocity.x / playerSpeed;
    targetDirY = player.linearVelocity.y / playerSpeed;
  } else {
    // Nearly stationary — use body heading.
    targetDirX = Math.cos(player.bodyHeading);
    targetDirY = Math.sin(player.bodyHeading);
  }

  const targetSpeed = playerSpeed * ballSpeedFactor;
  const targetVx = targetDirX * targetSpeed;
  const targetVy = targetDirY * targetSpeed;

  // Blend ball velocity toward target. Use a dampening factor that
  // converges over a few ticks (provisional: 0.3 = moderate dampening).
  const blendFactor = 0.3;
  ball.linearVelocity.x = ball.linearVelocity.x * (1 - blendFactor) + targetVx * blendFactor;
  ball.linearVelocity.y = ball.linearVelocity.y * (1 - blendFactor) + targetVy * blendFactor;
  ball.linearVelocity.z = 0; // keep ball on ground during dribble

  // Update dribble tracking state.
  const targetHeading = Math.atan2(targetDirY, targetDirX);
  ds.ballDribbleHeading = targetHeading;
  ds.ballDribbleSpeed = targetSpeed;

  // --- 4. Detect turn action -----------------------------------------------
  // A turn is detected when:
  //  a) The player is past the second-touch delay from startTick.
  //  b) The desiredHeading differs from bodyHeading by more than a threshold.
  //  c) The turn cooldown has elapsed since last turn.
  const ticksSinceStart = tick - ds.startTick;
  const ticksSinceLastTurn = tick - ds.lastTurnTick;

  if (
    ticksSinceStart >= secondTouchDelay &&
    ticksSinceLastTurn >= turnCooldown
  ) {
    const frame = frameByPlayerId.get(closestDribbler.playerId);
    if (frame && (frame.moveX !== 0 || frame.moveY !== 0)) {
      // Compute desired heading from movement input.
      const desiredHeading = Math.atan2(frame.moveY, frame.moveX);
      const headingDiff = Math.abs(normalizeAngle(desiredHeading - player.bodyHeading));

      // Threshold: heading must change by at least 15° (provisional).
      const TURN_THRESHOLD = 0.262; // ≈15 degrees in radians

      if (headingDiff >= TURN_THRESHOLD) {
        // Turn action detected.
        ds.lastTurnTick = tick;

        eventCounter.value++;
        const eventId = `second-touch-${tick}-${eventCounter.value}`;
        const event: SimulationEvent = {
          id: eventId,
          tick,
          sequence: eventCounter.value,
          kind: "second-touch",
          label: `Player ${closestDribbler.playerId} second-touch turn`,
          payload: {
            playerId: closestDribbler.playerId,
            teamId: player.teamId,
            contactType: "turn",
            previousHeading: player.bodyHeading,
            targetHeading: desiredHeading,
            headingDiff,
            dribbleTicks: ds.dribbleTicks,
            ballPosition: {
              x: ball.position.x,
              y: ball.position.y,
              z: ball.position.z,
            },
          },
        };
        events.push(event);
      }
    }
  }

  return events;
}
