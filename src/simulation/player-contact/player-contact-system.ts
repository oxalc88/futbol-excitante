/**
 * @module @pes/simulation/player-contact/player-contact-system
 *
 * Player-player planar contact detection and resolution.
 *
 * §12.4 of TECHNICAL_SPEC:
 *  - Normal players use simple planar collision geometry.
 *  - Deterministic custom resolver prevents invalid interpenetration
 *    while preserving deliberate congestion, shielding, and shoulder
 *    contact.
 *  - Applies continuous positional, velocity, heading, and stability
 *    effects before higher-level outcomes are derived.
 *  - A duel MUST NOT be reduced to "higher physical stat wins."
 *  - Pair/contact candidates are sorted by stable IDs.
 *
 * This system runs AFTER locomotion (players at tick-advanced positions)
 * and BEFORE player-ball contacts and ball integration. It does NOT
 * modify ball state. Both players receive symmetric correction — there
 * is no hidden strength stat.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import type { PlayerState } from "../../contracts/state.js";
import type { SimulationEvent } from "../../contracts/scenario.js";
import { FOUNDATION_PLAYER_CONTACT_V1 } from "../config/foundation.js";

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

/**
 * Player-contact config shape (matches FOUNDATION_PLAYER_CONTACT_V1).
 */
interface PlayerContactConfig {
  playerRadius: { value: number };
  maxCorrectionPerTick: { value: number };
  separationStiffness: { value: number };
  velocityDampingNormal: { value: number };
  velocityDampingTangent: { value: number };
  minSeparationEpsilon: { value: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Planar distance between two points.
 */
function planarDistance(
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Result of one player-contact system step.
 */
export interface PlayerContactStepResult {
  /** Ordered player-player-contact events generated this tick. */
  events: SimulationEvent[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect and resolve player-player planar contacts for one tick.
 *
 * Runs AFTER locomotion (players at tick-advanced positions).
 * Detects planar overlaps between player collision discs and applies
 * symmetric separation. Ball is never modified.
 *
 * Pair ordering is deterministic: sort by (min(idA, idB), max(idA, idB)).
 * For each overlapping pair, separation is applied along the contact
 * normal (or a stable fallback axis if centres are coincident).
 *
 * Both players receive equal positional and velocity corrections. There
 * is no stat-based asymmetry.
 *
 * @param players - Mutable player array (players are mutated in place).
 * @param eventCounter - Global event counter (mutated in place).
 * @param tick - Current simulation tick.
 * @param config - Player-contact coefficient set.
 * @returns Player-player-contact events generated this tick.
 */
export function stepPlayerContacts(
  players: readonly PlayerState[],
  eventCounter: { value: number },
  tick: number,
  config: PlayerContactConfig = FOUNDATION_PLAYER_CONTACT_V1,
): PlayerContactStepResult {
  const events: SimulationEvent[] = [];
  const radius = config.playerRadius.value;
  const maxCorrection = config.maxCorrectionPerTick.value;
  const stiffness = config.separationStiffness.value;
  const dampNormal = config.velocityDampingNormal.value;
  const dampTangent = config.velocityDampingTangent.value;
  const epsilon = config.minSeparationEpsilon.value;
  const sumRadii = radius * 2;

  // ------------------------------------------------------------------
  // 1. Build pair candidates then sort by stable ID key so processing
  //    order depends only on (minId, maxId) and not on array position.
  // ------------------------------------------------------------------
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      if (a.playerId <= b.playerId) {
        pairs.push([i, j]);
      } else {
        pairs.push([j, i]);
      }
    }
  }
  // Sort by stable key (min(idA,idB), max(idA,idB)).
  pairs.sort((pa, pb) => {
    const aKey = players[pa[0]].playerId;
    const bKey = players[pb[0]].playerId;
    if (aKey !== bKey) return aKey < bKey ? -1 : 1;
    const aKey2 = players[pa[1]].playerId;
    const bKey2 = players[pb[1]].playerId;
    if (aKey2 !== bKey2) return aKey2 < bKey2 ? -1 : 1;
    return 0;
  });

  // ------------------------------------------------------------------
  // 2. For each overlapping pair, compute and apply symmetric separation.
  // ------------------------------------------------------------------
  for (const [idxA, idxB] of pairs) {
    const playerA = players[idxA] as PlayerState;
    const playerB = players[idxB] as PlayerState;

    // Compute overlap.
    const dx = playerA.groundPosition.x - playerB.groundPosition.x;
    const dy = playerA.groundPosition.y - playerB.groundPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= sumRadii) {
      // No overlap — players are far enough apart.
      continue;
    }

    // Contact normal: direction from B to A (or fallback axis).
    let nx: number;
    let ny: number;
    if (dist > epsilon) {
      nx = dx / dist;
      ny = dy / dist;
    } else {
      // Coincent centres — use a stable fallback axis (+X).
      nx = 1;
      ny = 0;
    }

    // Overlap depth (how much the circles penetrate).
    const overlap = sumRadii - dist;

    // Positional correction: each player moves half the corrected amount
    // along the normal, clamped to maxCorrectionPerTick.
    const rawCorrection = overlap * stiffness;
    const correction = Math.min(rawCorrection, maxCorrection);
    const halfCorrection = correction / 2;

    // Apply positional correction (symmetric).
    playerA.groundPosition.x += nx * halfCorrection;
    playerA.groundPosition.y += ny * halfCorrection;
    playerB.groundPosition.x -= nx * halfCorrection;
    playerB.groundPosition.y -= ny * halfCorrection;

    // Velocity correction: damp velocity component along contact normal.
    // Decompose each player's velocity into normal and tangent components.
    // Apply damping to the normal component. Tangent component is preserved
    // (configurable via velocityDampingTangent).

    // --- Player A velocity correction ---
    const vDotNA = playerA.linearVelocity.x * nx + playerA.linearVelocity.y * ny;
    const vDotTA = -playerA.linearVelocity.x * ny + playerA.linearVelocity.y * nx;

    // Apply damping.
    const vNA = vDotNA * (1 - dampNormal);
    const vTA = vDotTA * (1 - dampTangent);

    // Reconstruct velocity from damped normal + tangent components.
    // Inverse rotation: normal = (nx, ny), tangent = (-ny, nx).
    playerA.linearVelocity.x = vNA * nx + vTA * (-ny);
    playerA.linearVelocity.y = vNA * ny + vTA * nx;

    // --- Player B velocity correction ---
    const vDotNB = playerB.linearVelocity.x * nx + playerB.linearVelocity.y * ny;
    const vDotTB = -playerB.linearVelocity.x * ny + playerB.linearVelocity.y * nx;

    const vNB = vDotNB * (1 - dampNormal);
    const vTB = vDotTB * (1 - dampTangent);

    playerB.linearVelocity.x = vNB * nx + vTB * (-ny);
    playerB.linearVelocity.y = vNB * ny + vTB * nx;

    // ------------------------------------------------------------------
    // 3. Emit player-player-contact event.
    // ------------------------------------------------------------------
    eventCounter.value++;
    const eventId = `player-player-contact-${tick}-${eventCounter.value}`;

    const finalDist = planarDistance(
      playerA.groundPosition.x,
      playerA.groundPosition.y,
      playerB.groundPosition.x,
      playerB.groundPosition.y,
    );

    const event: SimulationEvent = {
      id: eventId,
      tick,
      sequence: eventCounter.value,
      kind: "player-player-contact",
      label: `Player-player contact between ${playerA.playerId} and ${playerB.playerId}`,
      payload: {
        playerIdA: playerA.playerId,
        playerIdB: playerB.playerId,
        teamIdA: playerA.teamId,
        teamIdB: playerB.teamId,
        contactType: "player-player",
        normal: { x: nx, y: ny },
        overlap,
        correction,
        planarDistance: finalDist,
        sumRadii,
      },
    };

    events.push(event);
  }

  return { events };
}
