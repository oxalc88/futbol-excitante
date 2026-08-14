/**
 * @module @pes/simulation/contacts/contact-system
 *
 * Player-ball contact / first-touch resolution.
 *
 * Detects proximity between a player and the ball, checks for an
 * explicit first-touch input bit, and — if contact is resolved —
 * applies an impulse to the ball's velocity and emits an ordered
 * player-ball-contact event. The ball's `lastTouchRef` is updated
 * to reference the new event.
 *
 * The ball is NEVER teleported. Position is continuous across the
 * contact tick. Possession is NOT physical attachment — the ball
 * remains an independent 3D entity.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import type { BallState, PlayerState } from "../../contracts/state.js";
import type { InputFrame } from "../../contracts/input.js";
import type { SimulationEvent } from "../../contracts/scenario.js";
import { FIRST_TOUCH_BIT } from "../../contracts/input.js";
import { FOUNDATION_CONTACT_V1 } from "../config/foundation.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Contact config shape (matches FOUNDATION_CONTACT_V1).
 */
interface ContactConfig {
  contactRadius: { value: number };
  maxApproachSpeed: { value: number };
  impulseFraction: { value: number };
  verticalDamping: { value: number };
  defaultExitSpeed: { value: number };
}

/**
 * Snapshots of ball state before and after a player-ball contact.
 */
export interface BallContactStateSnapshot {
  position: { x: number; y: number; z: number };
  linearVelocity: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number };
  regime: BallState["regime"];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Planar (XY) distance between a player's ground position and the ball. */
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

/**
 * Compute a plausible outgoing velocity for the ball after a first-touch
 * contact. The model:
 *  1. Incoming speed = magnitude of ball's horizontal velocity.
 *  2. Outgoing horizontal speed = `impulseFraction × incomingSpeed`,
 *     clamped to `[0, maxApproachSpeed]`.
 *  3. If the ball is nearly stopped, use `defaultExitSpeed` instead.
 *  4. Outgoing horizontal direction = player's body heading direction.
 *  5. Vertical: z velocity is damped by `verticalDamping` for ground
 *     contacts; if the ball is airborne, some vertical energy is
 *     retained per the damping factor.
 *
 * No position teleport — only velocity changes.
 */
function computeOutgoingVelocity(
  player: PlayerState,
  ball: BallState,
  config: ContactConfig,
): { vx: number; vy: number; vz: number } {
  const incomingHSpeed = Math.sqrt(
    ball.linearVelocity.x * ball.linearVelocity.x +
      ball.linearVelocity.y * ball.linearVelocity.y,
  );

  let outgoingHSpeed: number;
  if (incomingHSpeed < 0.1) {
    // Ball is nearly stopped — apply a default exit speed in the
    // player's body heading direction.
    outgoingHSpeed = config.defaultExitSpeed.value;
  } else {
    outgoingHSpeed = incomingHSpeed * config.impulseFraction.value;
    // Clamp to reasonable range.
    if (outgoingHSpeed > config.maxApproachSpeed.value) {
      outgoingHSpeed = config.maxApproachSpeed.value;
    }
  }

  // Outgoing horizontal direction: player's body heading.
  const dirX = Math.cos(player.bodyHeading);
  const dirY = Math.sin(player.bodyHeading);

  const vx = dirX * outgoingHSpeed;
  const vy = dirY * outgoingHSpeed;

  // Vertical: damped z velocity.
  const isGrounded = ball.position.z <= 0.15;
  const vz = isGrounded
    ? ball.linearVelocity.z * config.verticalDamping.value
    : ball.linearVelocity.z * config.verticalDamping.value;

  return { vx, vy, vz };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Result of one contact-system step.
 */
export interface ContactStepResult {
  /** Ordered player-ball-contact events generated this tick. */
  events: SimulationEvent[];
  /** Whether the ball state was modified. */
  touched: boolean;
}

/**
 * Detect and resolve player-ball contacts for one tick.
 *
 * The contact system runs AFTER locomotion (players are at their
 * tick-advanced positions) and BEFORE ball integration (the ball
 * still has its pre-step velocity).
 *
 * Contact eligibility:
 *  1. Planar distance between player ground position and ball position
 *     is ≤ contactRadius.
 *  2. The player's FIRST_TOUCH bit is set in pressedButtons for this tick.
 *  3. Ball approach speed ≤ maxApproachSpeed (out of range = miss).
 *
 * At most one player can touch the ball per tick. If multiple players
 * are eligible, the one closest to the ball wins (stable by playerId
 * for deterministic ordering).
 *
 * @param players - All active players (read; locomotion has already run).
 * @param ball - Mutable ball state (velocity may be modified; position is NOT).
 * @param framesForTick - Input frames for the current tick (used to detect FIRST_TOUCH).
 * @param controlAssignments - Map of slot → player assignment (to resolve which player owns which frame).
 * @param config - Contact coefficient set (default: FOUNDATION_CONTACT_V1).
 * @param eventCounter - Global event counter (mutated in place).
 * @param tick - Current simulation tick.
 * @returns Contact events and whether a touch occurred.
 */
export function stepContacts(
  players: readonly PlayerState[],
  ball: BallState,
  framesForTick: readonly InputFrame[],
  controlAssignments: Record<string, { teamId: string; controlledPlayerId: string; mode: string }>,
  config: ContactConfig = FOUNDATION_CONTACT_V1,
  eventCounter: { value: number },
  tick: number,
): ContactStepResult {
  const events: SimulationEvent[] = [];
  const radius = config.contactRadius.value;
  const maxApproach = config.maxApproachSpeed.value;

  // Build a lookup: controlSlot → InputFrame for this tick.
  const frameBySlot = new Map<string, InputFrame>();
  for (const f of framesForTick) {
    frameBySlot.set(f.controlSlot, f);
  }

  // Build a lookup: playerId → InputFrame (via control assignments).
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

  // Find eligible players — within radius + FIRST_TOUCH bit set.
  const candidates: PlayerState[] = [];

  for (const player of players) {
    const frame = frameByPlayerId.get(player.playerId);
    if (!frame) continue;

    // Check the FIRST_TOUCH bit in pressedButtons.
    if ((frame.pressedButtons & FIRST_TOUCH_BIT) === 0) continue;

    const dist = planarDistance(
      player.groundPosition.x,
      player.groundPosition.y,
      ball.position.x,
      ball.position.y,
    );

    if (dist <= radius) {
      // Check approach speed.
      const hSpeed = Math.sqrt(
        ball.linearVelocity.x * ball.linearVelocity.x +
          ball.linearVelocity.y * ball.linearVelocity.y,
      );
      if (hSpeed > maxApproach) continue;

      candidates.push(player);
    }
  }

  if (candidates.length === 0) {
    return { events, touched: false };
  }

  // Deterministic selection: closest player wins; tie-break by playerId.
  candidates.sort((a, b) => {
    const distA = planarDistance(
      a.groundPosition.x,
      a.groundPosition.y,
      ball.position.x,
      ball.position.y,
    );
    const distB = planarDistance(
      b.groundPosition.x,
      b.groundPosition.y,
      ball.position.x,
      ball.position.y,
    );
    if (distA !== distB) return distA - distB;
    return a.playerId.localeCompare(b.playerId);
  });

  const contactPlayer = candidates[0];

  // Snapshot incoming ball state.
  const incoming: BallContactStateSnapshot = {
    position: {
      x: ball.position.x,
      y: ball.position.y,
      z: ball.position.z,
    },
    linearVelocity: {
      x: ball.linearVelocity.x,
      y: ball.linearVelocity.y,
      z: ball.linearVelocity.z,
    },
    angularVelocity: {
      x: ball.angularVelocity.x,
      y: ball.angularVelocity.y,
      z: ball.angularVelocity.z,
    },
    regime: ball.regime,
  };

  // Compute and apply outgoing velocity.
  const out = computeOutgoingVelocity(contactPlayer, ball, config);
  ball.linearVelocity.x = out.vx;
  ball.linearVelocity.y = out.vy;
  ball.linearVelocity.z = out.vz;

  // Dampen angular velocity on contact.
  ball.angularVelocity.x *= 0.5;
  ball.angularVelocity.y *= 0.5;
  ball.angularVelocity.z *= 0.5;

  // If the ball is very close to the ground, keep it on the ground plane.
  if (ball.position.z <= 0.15 && ball.linearVelocity.z < 0) {
    ball.linearVelocity.z = 0;
  }

  // Snapshot outgoing ball state.
  const outgoing: BallContactStateSnapshot = {
    position: {
      x: ball.position.x,
      y: ball.position.y,
      z: ball.position.z,
    },
    linearVelocity: {
      x: ball.linearVelocity.x,
      y: ball.linearVelocity.y,
      z: ball.linearVelocity.z,
    },
    angularVelocity: {
      x: ball.angularVelocity.x,
      y: ball.angularVelocity.y,
      z: ball.angularVelocity.z,
    },
    regime: ball.regime,
  };

  // Emit ordered event.
  eventCounter.value++;
  const eventId = `player-ball-contact-${tick}-${eventCounter.value}`;

  const event: SimulationEvent = {
    id: eventId,
    tick,
    sequence: eventCounter.value,
    kind: "player-ball-contact",
    label: `Player ${contactPlayer.playerId} first-touch contact`,
    payload: {
      playerId: contactPlayer.playerId,
      teamId: contactPlayer.teamId,
      incoming,
      outgoing,
      contactType: "first-touch",
      planarDistance: planarDistance(
        contactPlayer.groundPosition.x,
        contactPlayer.groundPosition.y,
        ball.position.x,
        ball.position.y,
      ),
    },
  };

  events.push(event);

  // Update lastTouchRef — this is the authoritative touch reference.
  ball.lastTouchRef = eventId;

  return { events, touched: true };
}
