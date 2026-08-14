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
import { FIRST_TOUCH_BIT, PASS_BIT, SHOT_BIT } from "../../contracts/input.js";
import { FOUNDATION_CONTACT_V1, FOUNDATION_PASS_V1, FOUNDATION_SHOT_V1, FOUNDATION_CLOSE_CONTROL_V1 } from "../config/foundation.js";

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
 * Pass config shape (matches FOUNDATION_PASS_V1).
 */
interface PassConfig {
  passRadius: { value: number };
  exitSpeed: { value: number };
  verticalComponent: { value: number };
}

/**
 * Shot config shape (matches FOUNDATION_SHOT_V1).
 */
interface ShotConfig {
  shotRadius: { value: number };
  exitSpeed: { value: number };
  verticalComponent: { value: number };
}

/**
 * Close-control config shape (matches FOUNDATION_CLOSE_CONTROL_V1).
 */
interface CloseControlConfig {
  dribbleRadius: { value: number };
  pushAheadFraction: { value: number };
  cooldownTicks: { value: number };
  minPlayerSpeed: { value: number };
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

/**
 * Compute outgoing velocity for a directed pass along body heading.
 *
 * The pass applies the configured exit speed in the player's body
 * heading direction with a small vertical component for loft.
 * Ball position is never modified — only velocity.
 */
function computePassVelocity(
  player: PlayerState,
  config: PassConfig,
): { vx: number; vy: number; vz: number } {
  const dirX = Math.cos(player.bodyHeading);
  const dirY = Math.sin(player.bodyHeading);
  const speed = config.exitSpeed.value;

  return {
    vx: dirX * speed,
    vy: dirY * speed,
    vz: speed * config.verticalComponent.value,
  };
}

/**
 * Compute outgoing velocity for a directed shot along body heading.
 *
 * The shot applies a stronger exit speed in the player's body
 * heading direction with a larger vertical component for loft.
 * Ball position is never modified — only velocity.
 */
function computeShotVelocity(
  player: PlayerState,
  config: ShotConfig,
): { vx: number; vy: number; vz: number } {
  const dirX = Math.cos(player.bodyHeading);
  const dirY = Math.sin(player.bodyHeading);
  const speed = config.exitSpeed.value;

  return {
    vx: dirX * speed,
    vy: dirY * speed,
    vz: speed * config.verticalComponent.value,
  };
}

/**
 * Compute outgoing velocity for a dribble-touch close-control contact.
 *
 * The dribble touch nudges the ball forward in the player's movement
 * direction (desiredVelocity) when moving at sufficient speed, or
 * falls back to body heading when nearly stationary.  Ball position
 * is never modified — only velocity.
 */
function computeCloseControlVelocity(
  player: PlayerState,
  config: CloseControlConfig,
): { vx: number; vy: number; vz: number } {
  // Determine movement direction from desiredVelocity if moving fast enough.
  const playerSpeed = Math.sqrt(
    player.desiredVelocity.x * player.desiredVelocity.x +
      player.desiredVelocity.y * player.desiredVelocity.y,
  );

  let dirX: number;
  let dirY: number;

  if (playerSpeed >= config.minPlayerSpeed.value) {
    // Use desired velocity direction.
    dirX = player.desiredVelocity.x / playerSpeed;
    dirY = player.desiredVelocity.y / playerSpeed;
  } else {
    // Nearly stationary — use body heading.
    dirX = Math.cos(player.bodyHeading);
    dirY = Math.sin(player.bodyHeading);
  }

  // Outgoing speed: fraction of player speed, clamped to a small range
  // that stays below pass/shot exit speeds.
  const outgoingHSpeed = playerSpeed * config.pushAheadFraction.value;

  return {
    vx: dirX * outgoingHSpeed,
    vy: dirY * outgoingHSpeed,
    vz: 0,
  };
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
 *     is ≤ contactRadius (or passRadius for pass).
 *  2. The player's PASS_BIT or FIRST_TOUCH_BIT is set in pressedButtons.
 *  3. Ball approach speed ≤ maxApproachSpeed (out of range = miss).
 *
 * PASS_BIT takes priority: if pressed and in range, a directed pass is
 * executed along body heading. Otherwise, FIRST_TOUCH_BIT triggers the
 * existing first-touch impulse model.
 *
 * Priority if multiple bits: shot > pass > first-touch.
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
 * @param passConfig - Pass coefficient set (default: FOUNDATION_PASS_V1).
 * @param shotConfig - Shot coefficient set (default: FOUNDATION_SHOT_V1).
 * @param closeControlConfig - Close-control coefficient set (default: FOUNDATION_CLOSE_CONTROL_V1).
 * @param dribbleCooldowns - Mutable per-player cooldown map (keyed by playerId, value is last dribble-touch tick).
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
  passConfig: PassConfig = FOUNDATION_PASS_V1,
  shotConfig: ShotConfig = FOUNDATION_SHOT_V1,
  closeControlConfig: CloseControlConfig = FOUNDATION_CLOSE_CONTROL_V1,
  dribbleCooldowns: Map<string, number> = new Map(),
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

  // Find eligible players — within radius + SHOT_BIT, PASS_BIT, or FIRST_TOUCH_BIT set.
  // Priority: shot > pass > first-touch (on pressedButtons) > dribble-touch (on heldButtons).
  // Dribble-touch fires on heldButtons & FIRST_TOUCH_BIT but NOT pressedButtons & FIRST_TOUCH_BIT
  // to avoid double-firing with the one-shot first-touch edge on the same tick.
  const candidates: Array<{ player: PlayerState; action: "shot" | "pass" | "first-touch" | "dribble-touch" }> = [];

  for (const player of players) {
    const frame = frameByPlayerId.get(player.playerId);
    if (!frame) continue;

    // Check SHOT_BIT first (highest priority).
    const hasShotBit = (frame.pressedButtons & SHOT_BIT) !== 0;
    // Check PASS_BIT next.
    const hasPassBit = (frame.pressedButtons & PASS_BIT) !== 0;
    // Check FIRST_TOUCH_BIT for one-shot edge.
    const hasFirstTouchBit = (frame.pressedButtons & FIRST_TOUCH_BIT) !== 0;
    // Check FIRST_TOUCH_BIT held (for dribble-touch) — only if not also pressed this tick.
    const hasFirstTouchHeld = (frame.heldButtons & FIRST_TOUCH_BIT) !== 0 &&
      (frame.pressedButtons & FIRST_TOUCH_BIT) === 0;

    if (!hasShotBit && !hasPassBit && !hasFirstTouchBit && !hasFirstTouchHeld) continue;

    const dist = planarDistance(
      player.groundPosition.x,
      player.groundPosition.y,
      ball.position.x,
      ball.position.y,
    );

    // Use shotRadius for shot, passRadius for pass, contactRadius for first-touch,
    // dribbleRadius for dribble-touch.
    let effectiveRadius: number;
    let action: "shot" | "pass" | "first-touch" | "dribble-touch";
    if (hasShotBit) {
      effectiveRadius = shotConfig.shotRadius.value;
      action = "shot";
    } else if (hasPassBit) {
      effectiveRadius = passConfig.passRadius.value;
      action = "pass";
    } else if (hasFirstTouchBit) {
      effectiveRadius = radius;
      action = "first-touch";
    } else {
      // hasFirstTouchHeld — dribble-touch (held, not pressed this tick).
      effectiveRadius = closeControlConfig.dribbleRadius.value;
      action = "dribble-touch";
    }

    if (dist <= effectiveRadius) {
      // Check approach speed.
      const hSpeed = Math.sqrt(
        ball.linearVelocity.x * ball.linearVelocity.x +
          ball.linearVelocity.y * ball.linearVelocity.y,
      );
      if (hSpeed > maxApproach) continue;

      // Cooldown check for dribble-touch: skip if too soon since last touch.
      if (action === "dribble-touch") {
        const lastTick = dribbleCooldowns.get(player.playerId);
        if (lastTick !== undefined && tick - lastTick < closeControlConfig.cooldownTicks.value) {
          continue;
        }
      }

      candidates.push({ player, action });
    }
  }

  if (candidates.length === 0) {
    return { events, touched: false };
  }

  // Deterministic selection: closest player wins; tie-break by playerId.
  candidates.sort((a, b) => {
    const distA = planarDistance(
      a.player.groundPosition.x,
      a.player.groundPosition.y,
      ball.position.x,
      ball.position.y,
    );
    const distB = planarDistance(
      b.player.groundPosition.x,
      b.player.groundPosition.y,
      ball.position.x,
      ball.position.y,
    );
    if (distA !== distB) return distA - distB;
    return a.player.playerId.localeCompare(b.player.playerId);
  });

  const winner = candidates[0];
  const contactPlayer = winner.player;
  const action = winner.action;

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

  // Compute and apply outgoing velocity based on action type.
  let out: { vx: number; vy: number; vz: number };
  let eventKind: "shot" | "pass" | "player-ball-contact";
  let contactType: string;
  let eventLabel: string;

  if (action === "shot") {
    out = computeShotVelocity(contactPlayer, shotConfig);
    eventKind = "shot";
    contactType = "shot";
    eventLabel = `Player ${contactPlayer.playerId} directed shot`;
  } else if (action === "pass") {
    out = computePassVelocity(contactPlayer, passConfig);
    eventKind = "pass";
    contactType = "pass";
    eventLabel = `Player ${contactPlayer.playerId} directed pass`;
  } else if (action === "dribble-touch") {
    out = computeCloseControlVelocity(contactPlayer, closeControlConfig);
    eventKind = "player-ball-contact";
    contactType = "dribble-touch";
    eventLabel = `Player ${contactPlayer.playerId} dribble-touch close-control`;
  } else {
    out = computeOutgoingVelocity(contactPlayer, ball, config);
    eventKind = "player-ball-contact";
    contactType = "first-touch";
    eventLabel = `Player ${contactPlayer.playerId} first-touch contact`;
  }

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
  const eventId = `${eventKind === "pass" ? "pass" : eventKind === "shot" ? "shot" : "player-ball-contact"}-${tick}-${eventCounter.value}`;

  const event: SimulationEvent = {
    id: eventId,
    tick,
    sequence: eventCounter.value,
    kind: eventKind,
    label: eventLabel,
    payload: {
      playerId: contactPlayer.playerId,
      teamId: contactPlayer.teamId,
      incoming,
      outgoing,
      contactType,
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

  // Record dribble-touch cooldown for this player.
  if (action === "dribble-touch") {
    dribbleCooldowns.set(contactPlayer.playerId, tick);
  }

  return { events, touched: true };
}
