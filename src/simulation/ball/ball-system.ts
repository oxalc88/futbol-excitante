/**
 * @module @pes/simulation/ball/ball-system
 *
 * Provisional independent ball integration.
 *
 * Applies gravity, air drag, swept pitch-plane impact within a tick,
 * bounce/restitution, ground resistance that cannot reverse velocity,
 * spin decay, and a Magnus-style curve force from ball spin.
 * Every ground impact emits an ordered pitch-contact
 * event with incoming and outgoing state references.
 *
 * No possession attachment, player contact, complex rolling law,
 * or final collision policy. Goal-post and crossbar collisions are
 * geometric (provisional). Curve coefficients are provisional and
 * versioned (FOUNDATION_BALL_V1.curveCoefficient).
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import type { BallState } from "../../contracts/state.js";
import type { SimulationEvent } from "../../contracts/scenario.js";
import type { GoalConfig } from "../config/foundation.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Snapshot of ball state just before a pitch contact.
 * Used as incoming/outgoing references in pitch-contact events.
 */
export interface BallStateSnapshot {
  position: { x: number; y: number; z: number };
  linearVelocity: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number };
  regime: BallState["regime"];
}

// ---------------------------------------------------------------------------
// Config defaults
// ---------------------------------------------------------------------------

/** Fallback config when none is provided (matches FOUNDATION_BALL_V1 shape). */
const DEFAULT_CONFIG = {
  gravity: { value: 9.81 },
  restitution: { value: 0.55 },
  groundResistance: { value: 0.02 },
  spinDecay: { value: 0.95 },
  ballRadius: { value: 0.11 },
  airDrag: { value: 0.001 },
  curveCoefficient: { value: 0.0005 },
  goal: {
    id: "foundation-goal-v1",
    label: "provisional",
    postRadius: { value: 0.05, unit: "m", note: "provisional goal post radius" },
    crossbarRadius: { value: 0.05, unit: "m", note: "provisional crossbar radius" },
    goalWidth: { value: 7.32, unit: "m", note: "standard goal width between posts" },
    goalHeight: { value: 2.44, unit: "m", note: "standard goal height from ground to crossbar" },
  },
} as const;

type BallConfig = {
  gravity: { value: number };
  restitution: { value: number };
  groundResistance: { value: number };
  spinDecay: { value: number };
  ballRadius: { value: number };
  airDrag: { value: number };
  curveCoefficient: { value: number };
  goal?: GoalConfig;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Threshold below which horizontal speed is considered zero (ground roll). */
const GROUND_SETTLE_SPEED = 0.01;

/** Threshold below which vertical bounce velocity is absorbed. */
const BOUNCE_THRESHOLD = 0.05;

/**
 * Post-bounce regime threshold: if |vz| after bounce is below this,
 * absorb into ground-roll instead of staying airborne. This prevents
 * the ground↔airborne oscillation where a weak post-bounce velocity
 * (e.g., vz = 0.55 from restitution) causes the ball to re-enter
 * the airborne branch every tick, flooding pitch-contact events.
 * Genuine shot lift-offs have vz ≫ this threshold.
 */
const POST_BOUNCE_ABSORB_THRESHOLD = 1.0;

/** Maximum swept-test iterations per tick (safety limit). */
const MAX_SWEPT_ITERATIONS = 4;

/**
 * Minimum vertical velocity required to lift a grounded ball into
 * airborne regime. Prevents micro-jitter oscillation where floating-point
 * noise (vz ~ 1e-10) on a grounded ball repeatedly triggers the
 * ground→airborne transition, flooding pitch-contact events.
 * Real shots produce vz ≥ 5 m/s; this threshold is well below that.
 */
const MIN_LIFT_OFF_VELOCITY = 0.5;

// -- Goal geometry (hard-coded pitch constants) -------------------------------

/** Pitch half-length: goal line at x = ±52.5 m (105 m pitch, origin at centre). */
const GOAL_LINE_X = 52.5;
/** Goal half-width: posts at y = ±3.66 m (7.32 m standard goal width). */
const GOAL_HALF_WIDTH = 3.66;

/** Pitch half-width: touchline at y = ±34 m (provisional 68 m pitch). */
const PITCH_HALF_WIDTH = 34;

/**
 * Compute horizontal speed from 3D linear velocity.
 */
function horizontalSpeed(vx: number, vy: number): number {
  return Math.sqrt(vx * vx + vy * vy);
}

/**
 * Apply ground resistance to horizontal velocity (cannot reverse).
 * Mutates vx, vy in place.
 */
function applyGroundResistance(
  vx: number,
  vy: number,
  resistanceFactor: number,
): { x: number; y: number } {
  const hSpd = horizontalSpeed(vx, vy);
  if (hSpd <= 1e-12) return { x: vx, y: vy };

  let newVx = vx * resistanceFactor;
  let newVy = vy * resistanceFactor;

  // Ensure resistance did not reverse velocity.
  if (horizontalSpeed(newVx, newVy) > hSpd) {
    return { x: 0, y: 0 };
  }
  return { x: newVx, y: newVy };
}

/**
 * Apply Magnus-style curve force to horizontal velocity.
 *
 * When the ball has nonzero vertical spin (angularVelocity.z) and
 * nonzero horizontal velocity, a lateral acceleration perpendicular
 * to the velocity is applied:
 *   a_curve = curveCoefficient × |v_h| × ω_z
 *
 * Zero spin or zero horizontal velocity → zero curve force.
 * Mutates vx, vy in place.
 */
function applyMagnusCurve(
  vx: number,
  vy: number,
  spinZ: number,
  curveCoeff: number,
): { x: number; y: number } {
  const hSpd = horizontalSpeed(vx, vy);
  if (hSpd <= 1e-12) return { x: vx, y: vy };
  if (Math.abs(spinZ) <= 1e-12) return { x: vx, y: vy };

  // Perpendicular direction to velocity in the horizontal plane.
  // Cross product of spin vector (0,0,ω_z) and velocity (vx,vy,0)
  // gives (ω_z * vy, -ω_z * vx) in the horizontal plane.
  // Normalized and scaled by curveCoefficient × |v_h| × |ω_z|.
  const forceMag = curveCoeff * hSpd * spinZ;
  const nx = vy / hSpd; // perpendicular x component
  const ny = -vx / hSpd; // perpendicular y component

  return {
    x: vx + forceMag * nx,
    y: vy + forceMag * ny,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Integrate the ball for one tick.
 *
 * The ball state is mutated in place. Events are returned separately
 * so the simulation loop can assign authoritative tick/sequence values.
 *
 * After physics integration, the ball trajectory is tested against
 * goal posts, crossbar, and the goal line using a swept line-segment
 * test from the pre-integration position to the post-integration position.
 *
 * @param ball - Mutable ball state (mutated in place).
 * @param dt - Fixed tick duration in seconds.
 * @param config - Provisional ball coefficients (default: FOUNDATION_BALL_V1 shape).
 * @param eventCounter - Starting event sequence counter (incremented in place).
 * @param tick - Current simulation tick for event attribution.
 * @returns Events generated during this tick (pitch-contact, goal-post-contact, crossbar-contact, goal).
 */
export function stepBall(
  ball: BallState,
  dt: number,
  config: BallConfig = DEFAULT_CONFIG,
  eventCounter: { value: number },
  tick: number,
): SimulationEvent[] {
  const gravity = config.gravity.value;
  const restitution = config.restitution.value;
  const groundResistance = config.groundResistance.value;
  const spinDecay = config.spinDecay.value;
  const radius = config.ballRadius.value;
  const airDrag = config.airDrag.value;
  const resistanceFactor = 1 - groundResistance;

  const events: SimulationEvent[] = [];
  let remaining = dt;
  let iterCount = 0;

  // Capture pre-integration state for goal-post / crossbar swept test.
  const posA = { x: ball.position.x, y: ball.position.y, z: ball.position.z };

  // Loop to handle multiple bounces within a single tick.
  while (remaining > 1e-12 && iterCount < MAX_SWEPT_ITERATIONS) {
    iterCount++;

    // Determine regime from current state.
    const isGrounded = ball.position.z <= radius + 1e-9;
    if (ball.regime !== "airborne" && !isGrounded) {
      ball.regime = "airborne";
    }
    // Allow ground-roll or settled → airborne transition when vertical velocity
    // is positive and exceeds the minimum lift-off threshold (e.g., after a shot
    // or bounce lifts the ball from the ground). The threshold prevents
    // micro-jitter oscillation where floating-point noise fires repeatedly.
    if (
      (ball.regime === "ground-roll" || ball.regime === "settled") &&
      ball.linearVelocity.z > MIN_LIFT_OFF_VELOCITY
    ) {
      ball.regime = "airborne";
    }

    if (ball.regime === "airborne" || ball.regime === "bouncing") {
      // -- Free-flight phase -----------------------------------------------
      // Record position before integration (needed for swept test).
      const x0 = ball.position.x;
      const y0 = ball.position.y;
      const z0 = ball.position.z;

      // Apply gravity: vz -= gravity × remaining (z is up, gravity pulls down)
      ball.linearVelocity.z -= gravity * remaining;

      // Apply air drag: v *= 1 - airDrag × remaining (speed-proportional)
      const dragFactor = 1 - airDrag * remaining;
      ball.linearVelocity.x *= dragFactor;
      ball.linearVelocity.y *= dragFactor;
      ball.linearVelocity.z *= dragFactor;

      // Apply Magnus curve force (spin → lateral acceleration in flight).
      const curveResisted = applyMagnusCurve(
        ball.linearVelocity.x,
        ball.linearVelocity.y,
        ball.angularVelocity.z,
        config.curveCoefficient.value,
      );
      ball.linearVelocity.x = curveResisted.x;
      ball.linearVelocity.y = curveResisted.y;

      // Integrate position from velocity (full remaining interval).
      const vz = ball.linearVelocity.z;
      const vx = ball.linearVelocity.x;
      const vy = ball.linearVelocity.y;
      const x1 = x0 + vx * remaining;
      const y1 = y0 + vy * remaining;
      const z1 = z0 + vz * remaining;

      // -- Swept pitch-plane impact test -----------------------------------
      if (z1 <= radius) {
        // Ball crossed the ground plane. Find exact impact time.
        // z0 + vz * tImpact = radius → tImpact = (radius - z0) / vz
        let tImpact: number;
        if (vz < -1e-12) {
          tImpact = (radius - z0) / vz;
          tImpact = Math.max(0, Math.min(tImpact, remaining));
        } else {
          // Numerical drift: at or above radius but computed below.
          tImpact = 0;
        }

        // Snapshot incoming state (after free-flight acceleration, before bounce).
        const incomingState: BallStateSnapshot = {
          position: { x: ball.position.x, y: ball.position.y, z: ball.position.z },
          linearVelocity: { x: ball.linearVelocity.x, y: ball.linearVelocity.y, z: ball.linearVelocity.z },
          angularVelocity: { x: ball.angularVelocity.x, y: ball.angularVelocity.y, z: ball.angularVelocity.z },
          regime: ball.regime,
        };

        // Reset position to the exact impact point.
        ball.position.x = x0 + vx * tImpact;
        ball.position.y = y0 + vy * tImpact;
        ball.position.z = radius;

        // -- Bounce: reverse and dampen vertical velocity ------------------
        ball.linearVelocity.z = -ball.linearVelocity.z * restitution;

        // Apply ground resistance to horizontal velocity (cannot reverse).
        const resisted = applyGroundResistance(
          ball.linearVelocity.x,
          ball.linearVelocity.y,
          resistanceFactor,
        );
        ball.linearVelocity.x = resisted.x;
        ball.linearVelocity.y = resisted.y;

        // Integrate remaining time from impact point.
        const afterBounce = remaining - tImpact;
        ball.position.x += ball.linearVelocity.x * afterBounce;
        ball.position.y += ball.linearVelocity.y * afterBounce;
        ball.position.z += ball.linearVelocity.z * afterBounce;

        // Clamp to ground radius (no penetration).
        if (ball.position.z < radius) {
          ball.position.z = radius;
        }

        // Determine regime after impact.
        // Use POST_BOUNCE_ABSORB_THRESHOLD to prevent weak post-bounce
        // velocities from re-entering the airborne branch (oscillation fix).
        if (Math.abs(ball.linearVelocity.z) > POST_BOUNCE_ABSORB_THRESHOLD) {
          ball.regime = "airborne";
        } else {
          // Absorbed: settle vertical velocity.
          ball.linearVelocity.z = 0;
          ball.position.z = radius;
          ball.regime = "ground-roll";
        }

        // Angular velocity: spin decay applied per contact.
        ball.angularVelocity.x *= spinDecay;
        ball.angularVelocity.y *= spinDecay;
        ball.angularVelocity.z *= spinDecay;

        // Snapshot outgoing state (after bounce and integration).
        const outgoingState: BallStateSnapshot = {
          position: { x: ball.position.x, y: ball.position.y, z: ball.position.z },
          linearVelocity: { x: ball.linearVelocity.x, y: ball.linearVelocity.y, z: ball.linearVelocity.z },
          angularVelocity: { x: ball.angularVelocity.x, y: ball.angularVelocity.y, z: ball.angularVelocity.z },
          regime: ball.regime,
        };

        // Emit pitch-contact event.
        eventCounter.value++;
        events.push({
          id: `ball-pitch-contact-${tick}-${eventCounter.value}`,
          tick,
          sequence: eventCounter.value,
          kind: "pitch-contact",
          label: "Ball pitch contact",
          payload: {
            incoming: incomingState,
            outgoing: outgoingState,
            contactType: "ground-impact",
          },
        });

        remaining = afterBounce;
      } else {
        // No ground contact — position is fully integrated.
        ball.position.x = x1;
        ball.position.y = y1;
        ball.position.z = z1;
        remaining = 0;
      }
    } else if (ball.regime === "ground-roll") {
      // -- Ground-roll phase -----------------------------------------------
      // Apply ground resistance: speed-proportional horizontal damping.
      // Cannot reverse velocity.
      const resisted = applyGroundResistance(
        ball.linearVelocity.x,
        ball.linearVelocity.y,
        resistanceFactor,
      );
      ball.linearVelocity.x = resisted.x;
      ball.linearVelocity.y = resisted.y;

      // Apply Magnus curve force on ground roll (much smaller effect).
      const curveGroundResisted = applyMagnusCurve(
        ball.linearVelocity.x,
        ball.linearVelocity.y,
        ball.angularVelocity.z,
        config.curveCoefficient.value,
      );
      ball.linearVelocity.x = curveGroundResisted.x;
      ball.linearVelocity.y = curveGroundResisted.y;

      // Integrate horizontal position.
      ball.position.x += ball.linearVelocity.x * remaining;
      ball.position.y += ball.linearVelocity.y * remaining;
      // Z stays at radius (on ground).
      ball.position.z = radius;

      // Spin decay.
      ball.angularVelocity.x *= spinDecay;
      ball.angularVelocity.y *= spinDecay;
      ball.angularVelocity.z *= spinDecay;

      // Check settle: if horizontal speed is negligible, settle.
      const finalSpeed = horizontalSpeed(
        ball.linearVelocity.x,
        ball.linearVelocity.y,
      );
      if (finalSpeed < GROUND_SETTLE_SPEED) {
        ball.linearVelocity.x = 0;
        ball.linearVelocity.y = 0;
        ball.linearVelocity.z = 0;
        ball.angularVelocity.x = 0;
        ball.angularVelocity.y = 0;
        ball.angularVelocity.z = 0;
        ball.regime = "settled";
      } else {
        // Clamp any residual vertical velocity to zero on ground roll.
        // Without this, post-bounce micro-jitter (vz tiny-positive while
        // z ≈ radius) can re-enter the airborne branch and emit a
        // pitch-contact every tick, flooding the event stream.
        ball.linearVelocity.z = 0;
      }

      remaining = 0;
    } else {
      // "settled" — no physics.
      remaining = 0;
    }
  }

  // -- Goal-post and crossbar collision (swept line-segment test) -----------
  // Check whether the ball's path during this tick intersected a goal post
  // or the crossbar. Uses the pre-integration position (posA) and the
  // current (post-integration) position as the swept line segment.
  const posB = { x: ball.position.x, y: ball.position.y, z: ball.position.z };
  const ballRadius = config.ballRadius.value;
  const postRadius = config.goal?.postRadius?.value ?? 0.05;
  const crossbarRadius = config.goal?.crossbarRadius?.value ?? 0.05;
  const goalHeight = config.goal?.goalHeight?.value ?? 2.44;
  const goalHalfWidth = (config.goal?.goalWidth?.value ?? 7.32) / 2;

  let goalPostHit = false;

  for (let gi = 0; gi < 2 && !goalPostHit; gi++) {
    const goalX = gi === 0 ? GOAL_LINE_X : -GOAL_LINE_X;
    const postYPositions = [-goalHalfWidth, goalHalfWidth];
    const postPartNames: Array<"post-left" | "post-right"> = ["post-left", "post-right"];

    // Check left and right posts (vertical cylinders at goalX, ±goalHalfWidth).
    for (let pi = 0; pi < 2 && !goalPostHit; pi++) {
      const postY = postYPositions[pi];
      const combinedR = postRadius + ballRadius;

      // Closest point on the swept line segment (posA → posB) to the post axis (goalX, postY).
      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const lenSq = dx * dx + dy * dy;

      let tClosest: number;
      if (lenSq < 1e-18) {
        tClosest = 0;
      } else {
        tClosest = ((goalX - posA.x) * dx + (postY - posA.y) * dy) / lenSq;
        tClosest = Math.max(0, Math.min(1, tClosest));
      }

      const cx = posA.x + tClosest * dx;
      const cy = posA.y + tClosest * dy;
      const distSq = (cx - goalX) * (cx - goalX) + (cy - postY) * (cy - postY);

      if (distSq < combinedR * combinedR) {
        goalPostHit = true;

        // Collision normal: from post centre toward ball contact point.
        const dist = Math.sqrt(distSq);
        const nx = dist > 1e-12 ? (cx - goalX) / dist : (gi === 0 ? -1 : 1);
        const ny = dist > 1e-12 ? (cy - postY) / dist : 0;

        // Reflect velocity along the collision normal.
        const vDotN = ball.linearVelocity.x * nx + ball.linearVelocity.y * ny;
        if (vDotN < 0) {
          const postRestitution = 0.7;
          ball.linearVelocity.x -= (1 + postRestitution) * vDotN * nx;
          ball.linearVelocity.y -= (1 + postRestitution) * vDotN * ny;
        }

        // Push ball out of post.
        const penetration = combinedR - dist;
        if (penetration > 0) {
          ball.position.x += nx * penetration;
          ball.position.y += ny * penetration;
        }

        const partName = postPartNames[pi];
        eventCounter.value++;
        events.push({
          id: `ball-goal-post-contact-${tick}-${eventCounter.value}`,
          tick,
          sequence: eventCounter.value,
          kind: "goal-post-contact",
          label: `Ball ${partName} contact`,
          payload: {
            goalIndex: gi as 0 | 1,
            part: partName,
            ballState: {
              position: { x: posA.x, y: posA.y, z: posA.z },
              linearVelocity: { x: ball.linearVelocity.x, y: ball.linearVelocity.y, z: ball.linearVelocity.z },
              angularVelocity: { x: ball.angularVelocity.x, y: ball.angularVelocity.y, z: ball.angularVelocity.z },
              regime: ball.regime,
            } as BallStateSnapshot,
          },
        });
      }
    }

    // Check crossbar (horizontal cylinder at goalX, z = goalHeight, along Y).
    if (!goalPostHit) {
      const combinedRcb = crossbarRadius + ballRadius;
      const dx = posB.x - posA.x;
      const dz = posB.z - posA.z;
      const lenSqXZ = dx * dx + dz * dz;

      let tClosestCb: number;
      if (lenSqXZ < 1e-18) {
        tClosestCb = 0;
      } else {
        tClosestCb = ((goalX - posA.x) * dx + (goalHeight - posA.z) * dz) / lenSqXZ;
        tClosestCb = Math.max(0, Math.min(1, tClosestCb));
      }

      const cbx = posA.x + tClosestCb * dx;
      const cbz = posA.z + tClosestCb * dz;
      const distSqCb = (cbx - goalX) * (cbx - goalX) + (cbz - goalHeight) * (cbz - goalHeight);

      if (distSqCb < combinedRcb * combinedRcb) {
        goalPostHit = true;

        const distCb = Math.sqrt(distSqCb);
        const nxCb = distCb > 1e-12 ? (cbx - goalX) / distCb : (gi === 0 ? -1 : 1);
        const nzCb = distCb > 1e-12 ? (cbz - goalHeight) / distCb : -1;

        const vDotNCb = ball.linearVelocity.x * nxCb + ball.linearVelocity.z * nzCb;
        if (vDotNCb < 0) {
          const cbRestitution = 0.65;
          ball.linearVelocity.x -= (1 + cbRestitution) * vDotNCb * nxCb;
          ball.linearVelocity.z -= (1 + cbRestitution) * vDotNCb * nzCb;
        }

        const penetrationCb = combinedRcb - distCb;
        if (penetrationCb > 0) {
          ball.position.x += nxCb * penetrationCb;
          ball.position.z += nzCb * penetrationCb;
        }

        eventCounter.value++;
        events.push({
          id: `ball-crossbar-contact-${tick}-${eventCounter.value}`,
          tick,
          sequence: eventCounter.value,
          kind: "crossbar-contact",
          label: "Ball crossbar contact",
          payload: {
            goalIndex: gi as 0 | 1,
            part: "crossbar" as const,
            ballState: {
              position: { x: posA.x, y: posA.y, z: posA.z },
              linearVelocity: { x: ball.linearVelocity.x, y: ball.linearVelocity.y, z: ball.linearVelocity.z },
              angularVelocity: { x: ball.angularVelocity.x, y: ball.angularVelocity.y, z: ball.angularVelocity.z },
              regime: ball.regime,
            } as BallStateSnapshot,
          },
        });
      }
    }

    // -- Goal-line detection (ball crosses goal line between posts, under crossbar) --
    if (!goalPostHit) {
      const crossedRight = (posA.x < goalX && posB.x >= goalX) || (posA.x > goalX && posB.x <= goalX);
      if (crossedRight) {
        const dxSeg = posB.x - posA.x;
        if (Math.abs(dxSeg) > 1e-12) {
          const tGoal = (goalX - posA.x) / dxSeg;
          if (tGoal >= 0 && tGoal <= 1) {
            const goalY = posA.y + tGoal * (posB.y - posA.y);
            const goalZ = posA.z + tGoal * (posB.z - posA.z);

            if (Math.abs(goalY) < goalHalfWidth && goalZ > 0 && goalZ < goalHeight) {
              eventCounter.value++;
              events.push({
                id: `ball-goal-${tick}-${eventCounter.value}`,
                tick,
                sequence: eventCounter.value,
                kind: "goal",
                label: "Goal",
                payload: {
                  goalIndex: gi as 0 | 1,
                  ballState: {
                    position: { x: posA.x, y: posA.y, z: posA.z },
                    linearVelocity: { x: ball.linearVelocity.x, y: ball.linearVelocity.y, z: ball.linearVelocity.z },
                    angularVelocity: { x: ball.angularVelocity.x, y: ball.angularVelocity.y, z: ball.angularVelocity.z },
                    regime: ball.regime,
                  } as BallStateSnapshot,
                },
              });
            } else if (goalZ > 0) {
              // Ball crossed the goal line outside the posts (or above crossbar) — out of play.
              // This triggers corner kick or goal kick depending on last touch team.
              eventCounter.value++;
              events.push({
                id: `ball-out-of-play-${tick}-${eventCounter.value}`,
                tick,
                sequence: eventCounter.value,
                kind: "ball-out-of-play",
                label: "Ball out of play over goal line",
                payload: {
                  goalIndex: gi as 0 | 1,
                  ballPosition: { x: goalX, y: goalY, z: goalZ },
                  lastTouchRef: ball.lastTouchRef,
                  ballState: {
                    position: { x: posA.x, y: posA.y, z: posA.z },
                    linearVelocity: { x: ball.linearVelocity.x, y: ball.linearVelocity.y, z: ball.linearVelocity.z },
                    angularVelocity: { x: ball.angularVelocity.x, y: ball.angularVelocity.y, z: ball.angularVelocity.z },
                    regime: ball.regime,
                  } as BallStateSnapshot,
                },
              });
            }
          }
        }
      }
    }
  }

  // -- Touchline (sideline) detection -----------------------------------------
  // Detect the ball crossing a touchline (|y| > PITCH_HALF_WIDTH) while
  // within the goal-line span (|x| < GOAL_LINE_X).  Uses the same swept
  // line-segment test as goal-line detection.
  if (!goalPostHit) {
    for (let ti = 0; ti < 2; ti++) {
      const touchlineY = ti === 0 ? PITCH_HALF_WIDTH : -PITCH_HALF_WIDTH;
      const crossedTop = (posA.y < touchlineY && posB.y >= touchlineY) || (posA.y > touchlineY && posB.y <= touchlineY);
      if (crossedTop) {
        const dySeg = posB.y - posA.y;
        if (Math.abs(dySeg) > 1e-12) {
          const tTouch = (touchlineY - posA.y) / dySeg;
          if (tTouch >= 0 && tTouch <= 1) {
            const touchX = posA.x + tTouch * (posB.x - posA.x);
            const touchZ = posA.z + tTouch * (posB.z - posA.z);

            // Only trigger if within the goal-line span and above ground.
            if (Math.abs(touchX) < GOAL_LINE_X && touchZ > 0) {
              eventCounter.value++;
              events.push({
                id: `ball-touchline-out-${tick}-${eventCounter.value}`,
                tick,
                sequence: eventCounter.value,
                kind: "ball-touchline-out-of-play",
                label: "Ball out of play over touchline",
                payload: {
                  touchlineIndex: ti as 0 | 1,
                  ballPosition: { x: touchX, y: touchlineY, z: touchZ },
                  lastTouchRef: ball.lastTouchRef,
                  ballState: {
                    position: { x: posA.x, y: posA.y, z: posA.z },
                    linearVelocity: { x: ball.linearVelocity.x, y: ball.linearVelocity.y, z: ball.linearVelocity.z },
                    angularVelocity: { x: ball.angularVelocity.x, y: ball.angularVelocity.y, z: ball.angularVelocity.z },
                    regime: ball.regime,
                  } as BallStateSnapshot,
                },
              });
            }
          }
        }
      }
    }
  }

  return events;
}
