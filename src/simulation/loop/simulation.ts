/**
 * @module @pes/simulation/loop
 *
 * The one authoritative synchronous simulation stepping path.
 *
 * Architecture:
 * - The Simulation class owns a single WorldState (mutated in place
 *   during a step, frozen only at creation and after restore).
 * - Input frames are buffered by tick via `applyInputs()`, consumed
 *   during the input resolution stage of `step()`.
 * - `step()` commits exactly one tick per call. It returns the
 *   committed tick, ordered events for the committed tick, and a
 *   deterministic state hash.
 * - Events in the returned StepResult are defensive copies — mutating
 *   them does not affect internal state or subsequent hashes.
 *
 * Bootstrap scheduler stages (system-free — locomotion and ball are
 * no-ops). Read/write ownership and event sort keys are documented.
 *
 * | Stage               | Read set            | Write set                    | Event sort key              |
 * |---------------------|---------------------|------------------------------|-----------------------------|
 * | Scheduled events    | committed state     | appends to `events` buffer   | `(tick, ++eventCounter)`    |
 * | Input resolution    | buffered inputs     | mutates schedulerMemory    | `(tick, ++eventCounter)` for rejections/fallbacks |
 * | Locomotion          | committed state     | player velocity/heading/pos  | N/A                         |
 * | Ball integration    | committed state     | none (no-op in bootstrap)    | N/A                         |
 * | Invariant validation| committed state     | none (diagnostic only)       | N/A                         |
 * | Presentation        | committed state     | none (derive-only)           | N/A                         |
 * | Commit              | committed state     | appends events to `events`   | `(tick, ++eventCounter)`    |
 *
 * The bootstrap scheduler runs these stages in the order listed above.
 * Every write is staged under one documented owner and becomes visible
 * only at the explicit commit boundary.
 *
 * `fixedDt` comes from the versioned configuration, never from wall
 * clock. No Date, performance, or timer calls exist in this module.
 *
 * No Math.random, DOM, Node I/O, or wall-clock time.
 */

import type { InputFrame } from "../../contracts/input.js";
import type { WorldState, PlayerState, SchedulerMemory, MatchPhase } from "../../contracts/state.js";
import type { SimulationEvent } from "../../contracts/scenario.js";
import type { PresentationSnapshot, PlayerPresentation } from "../../contracts/presentation.js";
import type { TelemetryObservation } from "../../contracts/telemetry.js";
import type { SimulationObserver } from "../telemetry/observer.js";
import { freezeWorldState } from "../world/clone.js";
import { deepClone } from "../world/clone.js";
import { encodeCanonical } from "../determinism/canonical.js";
import { hashFnv1a64 } from "../determinism/hash.js";
import { checkFinite } from "../determinism/finite.js";
import { NO_OP_OBSERVER } from "../telemetry/observer.js";
import {
  validateInputFrame,
  filterDuplicateFrames,
  resolveInputForPlayer,
  createRejectionEvent,
  findSlotForPlayer,
  computeExplicitSwitchTarget,
  checkSlotWiringInvariant,
  isSlotActive,
  resolveSlotMap,
  NEUTRAL_INPUT,
} from "../input/input-system.js";
import { SWITCH_PLAYER_BIT } from "../../contracts/input.js";
import { stepLocomotion } from "../locomotion/locomotion-system.js";
import { stepBall } from "../ball/ball-system.js";
import { stepContacts } from "../contacts/contact-system.js";
import { stepPlayerContacts } from "../player-contact/player-contact-system.js";
import { stepDribble } from "../contacts/second-touch-system.js";
import type { DribbleState } from "../contacts/second-touch-system.js";
import { stepTackle, replayTackleEvent } from "../contacts/tackle-system.js";
import type { TackleState } from "../contacts/tackle-system.js";
import {
  FOUNDATION_LOCOMOTION_V1,
  FOUNDATION_BALL_V1,
  FOUNDATION_CLOSE_CONTROL_V1,
  FOUNDATION_PLAYER_CONTACT_V1,
  FOUNDATION_TACKLE_V1,
  FOUNDATION_CONFIG,
  TRANSIENT_ACCEL_LOCOMOTION_V1,
} from "../config/foundation.js";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * Minimal shot config shape used for capability evaluation overrides.
 * Matches the properties consumed by the shot velocity computation.
 */
interface ShotConfigOverride {
  shotRadius: { value: number };
  exitSpeed: { value: number };
  verticalComponent: { value: number };
}

/**
 * Minimal ball config shape used for capability evaluation overrides.
 * Only curveCoefficient is overridden; other fields come from FOUNDATION_BALL_V1.
 */
interface BallConfigOverride {
  curveCoefficient: { value: number };
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Goal reset configuration for the simulation.
 * Controls automatic restart behavior after a goal event.
 */
export interface GoalResetConfig {
  /**
   * Countdown ticks before auto-restart after a goal.
   * Default: 60 (≈1 second at 60 FPS).
   * Set to 0 to disable automatic restart (manual reset required).
   */
  goalResetTicks?: number;
}

/**
 * Result returned by a single `step()` call.
 *
 * `tick` is the world tick after the step (the committed tick).
 * `events` are the ordered events generated during this step.
 * `stateHash` is a deterministic hash of the committed state.
 */
export interface StepResult {
  tick: number;
  events: readonly SimulationEvent[];
  stateHash: string;
}

/**
 * Checkpoint snapshot — deep-cloned WorldState.
 *
 * Callers can restore from this via `restore(snapshot)`.
 * Mutating the returned object does not affect the simulation.
 */
export type Checkpoint = WorldState;

/**
 * One-step simulation API.
 *
 * All methods are synchronous and DOM-free.
 */
export interface Simulation {
  /** Committed simulation tick (0-based). */
  readonly tick: number;

  /**
   * Buffer input frames for resolution on the next step that covers
   * the target tick.
   *
   * At most one frame per (tick, controlSlot) is accepted. Duplicate
   * frames cause the next step() to throw with an error listing all
   * duplicates found for the tick being resolved.
   *
   * @param frames - Input frames whose tick must equal the committed
   *   world tick or be greater (they are queued until that tick arrives).
   * @throws {Error} when duplicate (tick, controlSlot) frames are detected.
   */
  applyInputs(frames: readonly InputFrame[]): void;

  /**
   * Advance the simulation by one tick.
   *
   * Runs the bootstrap scheduler stages in order:
   *  1. Increment world tick (t → t+1)
   *  2. Scheduled scenario events (read committed state, append events)
   *  3. Input resolution (consume buffered inputs for new tick)
   *  4. Locomotion (converge velocity/heading, integrate position)
   *  4.5. Contact detection (player-ball proximity + first-touch input)
   *  5. Ball integration (gravity, drag, bounce, ground resistance)
   *  6. Invariant validation (finite checks)
   *  7. Presentation derivation (derive read-only snapshot)
   *  8. Commit (append events, compute hash)
   *
   * @returns The committed tick, ordered events, and state hash.
   */
  step(): StepResult;

  /**
   * Return a deep-frozen clone of the current authoritative world state.
   *
   * Mutating the returned object does not change the simulation state
   * or subsequent hashes.
   */
  snapshot(): Checkpoint;

  /**
   * Derive a read-only presentation snapshot from committed state.
   *
   * Contains only presentation-facing facts (no solver internals,
   * no mutable storage). Mutating the returned object is safe and
   * does not affect the simulation.
   */
  presentation(): PresentationSnapshot;

  /**
   * Restore the simulation from a previously captured checkpoint.
   *
   * @param snapshot - A deep-cloned WorldState (typically from `snapshot()`).
   */
  restore(snapshot: Checkpoint): void;

  /**
   * Compute a deterministic hash of the committed world state.
   *
   * Uses canonical JSON encoding + FNV-1a 64-bit.
   */
  stateHash(): string;

  /**
   * Switch the controlled player for a given control slot.
   *
   * Updates the slot's `controlledPlayerId` in the authoritative
   * controlAssignments. This is a control-layer concern — the
   * simulation core does not decide which player is controlled;
   * adapters (browser, AI, replay) call this to reassign.
   *
   * @param controlSlot - the slot to reassign (e.g. "slot-1").
   * @param nextPlayerId - the new player to control.
   */
  setControlledPlayer(controlSlot: string, nextPlayerId: string): void;
}

// ---------------------------------------------------------------------------
// Simulation implementation
// ---------------------------------------------------------------------------

/**
 * Create a new Simulation instance backed by the given world state.
 *
 * @param world - The initial world state (must not be mutated by callers).
 * @param observer - Telemetry observer; defaults to no-op.
 * @param locomotionConfigOverride - Optional locomotion config override.
 *   If provided, used instead of the world state's config for locomotion.
 *   Useful for capability evaluation where low/high values need different configs.
 * @param contactConfigOverride - Optional player-contact config override.
 *   If provided, used instead of `FOUNDATION_PLAYER_CONTACT_V1` for player contact
 *   resolution. Useful for capability evaluation where low/high values need different
 *   contact knobs (e.g., separationStiffness).
 * @param shotConfigOverride - Optional shot config override.
 *   If provided, used instead of `FOUNDATION_SHOT_V1` for shot resolution.
 *   Useful for capability evaluation where low/high exitSpeed values need
 *   different shot power (e.g., exitSpeed 8.0 vs 16.0 m/s).
 * @param ballConfigOverride - Optional ball config override.
 *   If provided, used instead of `FOUNDATION_BALL_V1` for ball integration.
 *   Useful for capability evaluation where low/high curve coefficients
 *   need different ball physics (e.g., curveCoefficient 0.0005 vs 0.003).
 * @param goalResetConfig - Optional goal reset configuration.
 *   Controls automatic restart behavior after a goal event.
 * @returns A simulation instance.
 */
export function createSimulation(
  world: WorldState,
  observer?: SimulationObserver,
  locomotionConfigOverride?: typeof FOUNDATION_LOCOMOTION_V1,
  contactConfigOverride?: typeof FOUNDATION_PLAYER_CONTACT_V1,
  shotConfigOverride?: ShotConfigOverride,
  ballConfigOverride?: BallConfigOverride,
  goalResetConfig?: GoalResetConfig,
): Simulation {
  const obs = observer ?? NO_OP_OBSERVER;

  // Deep-clone so we own a mutable copy (the original is immutable).
  let state = deepClone(world) as WorldState;

  // Input frame buffer — keyed by tick string (string to avoid collision with numeric keys).
  const inputBuffers: Record<string, InputFrame[]> = {};

  // Event counter — persists across steps for total ordering.
  let eventCounter: number = 0;

  // Per-player dribble-touch cooldown — maps playerId → last tick a dribble-touch occurred.
  // Lives in the simulation closure; does not affect world state or hashing.
  const dribbleCooldowns: Map<string, number> = new Map();

  // Per-player dribble state for second-touch mechanics.
  // Lives in the simulation closure; does not affect world state or hashing.
  const dribbleStates: Map<string, DribbleState> = new Map();

  // Per-player tackle bookkeeping (ordered prepare/active/recover phases).
  // Lives in the simulation closure; only its world effects and ordered
  // events reach canonical state / hashes.
  const tackleStates: Map<string, TackleState> = new Map();

  // Sustainable max speed of the effective locomotion config, recorded by the
  // locomotion stage so the tackle commitment caps use the same authority.
  let activeMaxSpeed: number = FOUNDATION_LOCOMOTION_V1.maxSpeed.value;

  // Shot config override (used by capability evaluation for low vs high exitSpeed).
  // Lives in the closure; does not affect world state or hashing.
  const effectiveShotConfig = shotConfigOverride ?? undefined;

  // ------------------------------------------------------------------
  // Goal reset — initial positions captured at creation for post-goal reset.
  // ------------------------------------------------------------------

  /** Default countdown ticks before auto-restart after a goal (≈1 second at 60 FPS). */
  const defaultGoalResetTicks = 60;

  // Capture initial positions for reset (mirrors buildGoalResetPositions in headless runner).
  const initialPositions: Record<string, { x: number; y: number }> = {};
  for (const p of state.players) {
    initialPositions[p.playerId] = { x: p.groundPosition.x, y: p.groundPosition.y };
  }
  const initialBallPosition = { ...state.ball.position };
  const initialBallVelocity = { ...state.ball.linearVelocity };
  const initialBallAngularVelocity = { ...state.ball.angularVelocity };
  const initialBallRegime = state.ball.regime;

  // Capture the per-half duration for halftime → second-half restart.
  const initialHalfDurationTicks = state.matchTimer;

  /**
   * Reset all players and the ball to their initial positions.
   * Called when goalResetCountdown reaches zero.
   */
  function applyGoalReset(): void {
    state.ball.position = { ...initialBallPosition };
    state.ball.linearVelocity = { ...initialBallVelocity };
    state.ball.angularVelocity = { ...initialBallAngularVelocity };
    state.ball.regime = initialBallRegime;
    for (const player of state.players) {
      const pos = initialPositions[player.playerId];
      if (pos) {
        player.groundPosition = { x: pos.x, y: pos.y };
        player.linearVelocity = { x: 0, y: 0 };
        player.desiredVelocity = { x: 0, y: 0 };
      }
    }
  }

  /**
   * Set matchPhase to "goal" and start the countdown.
   * Called when a goal event is detected.
   */
  function onGoalEvent(): void {
    if (state.matchPhase !== "playing") return;
    state.matchPhase = "goal";
    state.goalResetCountdown = goalResetConfig?.goalResetTicks ?? defaultGoalResetTicks;
  }

  /** Default halftime delay ticks (≈1 second at 60 FPS). */
  const defaultHalftimeCountdown = 60;

  /**
   * Reset all players and the ball to their initial positions.
   * Called when halftime countdown reaches zero (start of second half).
   */
  function applyHalftimeReset(): void {
    state.ball.position = { ...initialBallPosition };
    state.ball.linearVelocity = { ...initialBallVelocity };
    state.ball.angularVelocity = { ...initialBallAngularVelocity };
    state.ball.regime = initialBallRegime;
    for (const player of state.players) {
      const pos = initialPositions[player.playerId];
      if (pos) {
        player.groundPosition = { x: pos.x, y: pos.y };
        player.linearVelocity = { x: 0, y: 0 };
        player.desiredVelocity = { x: 0, y: 0 };
      }
    }
  }

  // ------------------------------------------------------------------
  // Corner kick helpers (MATCH-CORNER-KICK)
  // ------------------------------------------------------------------

  /** Default corner kick countdown ticks (≈1 second at 60 FPS). */
  const defaultCornerKickCountdown = 60;

  /** Pitch half-width for corner flag positioning (provisional 68m pitch). */
  const PITCH_HALF_WIDTH = 34;

  /** Goal line x position (matches ball-system constant). */
  const GOAL_LINE_X = 52.5;

  /**
   * Resolve the team that last touched the ball from the lastTouchRef.
   *
   * Searches state.events for the matching event and extracts the teamId
   * from the payload. Returns null if the event is not found or has no
   * team information.
   */
  function resolveLastTouchTeam(lastTouchRef: string | null): string | null {
    if (!lastTouchRef) return null;
    for (const ev of state.events) {
      if (ev.id === lastTouchRef) {
        const payload = ev.payload as { teamId?: string } | undefined;
        return payload?.teamId ?? null;
      }
    }
    return null;
  }

  /**
   * Compute the nearest corner flag position given the goal line and
   * the ball's y-position when it went out.
   *
   * Corner flags are at (goalX, ±pitchHalfWidth).
   * The nearest flag is determined by the sign of ballY.
   */
  function computeCornerFlagPosition(
    goalIndex: 0 | 1,
    ballY: number,
  ): { x: number; y: number } {
    const goalX = goalIndex === 0 ? GOAL_LINE_X : -GOAL_LINE_X;
    const cornerY = ballY >= 0 ? PITCH_HALF_WIDTH : -PITCH_HALF_WIDTH;
    return { x: goalX, y: cornerY };
  }

  /**
   * Set matchPhase to "corner-kick" and start the countdown.
   * Called when a ball-out-of-play event is detected and the last touch
   * was by the defending team (corner kick condition).
   */
  function onCornerKickEvent(
    attackingTeam: string,
    cornerPos: { x: number; y: number },
    goalIndex: 0 | 1,
  ): void {
    if (state.matchPhase !== "playing") return;
    state.matchPhase = "corner-kick";
    state.cornerKickCountdown = defaultCornerKickCountdown;
    state.cornerKickPosition = { ...cornerPos };
    state.cornerKickAttackingTeam = attackingTeam;
    state.cornerKickGoalIndex = goalIndex;

    // Select kick taker: closest attacking player to the corner flag.
    let bestPlayer: string | null = null;
    let bestDist = Infinity;
    for (const p of state.players) {
      if (p.teamId !== attackingTeam) continue;
      const dx = p.groundPosition.x - cornerPos.x;
      const dy = p.groundPosition.y - cornerPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestPlayer = p.playerId;
      }
    }
    state.cornerKickTakerId = bestPlayer;

    // Position the kick taker near the corner flag.
    if (bestPlayer) {
      const player = state.players.find((p) => p.playerId === bestPlayer);
      if (player) {
        player.groundPosition = { x: cornerPos.x, y: cornerPos.y };
        player.linearVelocity = { x: 0, y: 0 };
        player.desiredVelocity = { x: 0, y: 0 };
        // Face toward the goal (direction from corner to goal center).
        const goalCenterX = goalIndex === 0 ? GOAL_LINE_X : -GOAL_LINE_X;
        const dirX = goalCenterX - cornerPos.x;
        const dirY = 0 - cornerPos.y;
        const dirMag = Math.sqrt(dirX * dirX + dirY * dirY);
        if (dirMag > 0.001) {
          player.bodyHeading = Math.atan2(dirY / dirMag, dirX / dirMag);
          player.desiredHeading = player.bodyHeading;
        }
      }
    }

    // Position attacking teammates in the penalty area.
    const attackAreaCenterX = goalIndex === 0 ? GOAL_LINE_X - 10 : -GOAL_LINE_X + 10;
    let attackIdx = 0;
    for (const p of state.players) {
      if (p.teamId !== attackingTeam) continue;
      if (p.playerId === bestPlayer) continue;
      // Spread attackers across the penalty area.
      const offsetX = (attackIdx % 3) * 5 - 5;
      const offsetY = Math.floor(attackIdx / 3) * 6 - 3;
      p.groundPosition = { x: attackAreaCenterX + offsetX, y: offsetY };
      p.linearVelocity = { x: 0, y: 0 };
      p.desiredVelocity = { x: 0, y: 0 };
      // Face toward the goal.
      const faceX = goalIndex === 0 ? 1 : -1;
      p.bodyHeading = Math.atan2(0, faceX);
      p.desiredHeading = p.bodyHeading;
      attackIdx++;
    }

    // Position defensive team: mark attackers and place goalkeeper.
    const defendingTeam = attackingTeam === "team-a" ? "team-b" : "team-a";
    const defendingPlayers = state.players.filter((p) => p.teamId === defendingTeam);

    // Find goalkeeper (or last defender) and position near far post.
    const goalkeeper = defendingPlayers[defendingPlayers.length - 1];
    if (goalkeeper) {
      const farPostY = cornerPos.y > 0 ? -3.66 : 3.66;
      goalkeeper.groundPosition = { x: goalIndex === 0 ? GOAL_LINE_X - 1 : -GOAL_LINE_X + 1, y: farPostY };
      goalkeeper.linearVelocity = { x: 0, y: 0 };
      goalkeeper.desiredVelocity = { x: 0, y: 0 };
      goalkeeper.bodyHeading = goalIndex === 0 ? Math.PI : 0;
      goalkeeper.desiredHeading = goalkeeper.bodyHeading;
    }

    // Position remaining defenders to mark attackers.
    const attackers = state.players.filter(
      (p) => p.teamId === attackingTeam && p.playerId !== bestPlayer,
    );
    const remainingDefenders = defendingPlayers.filter((p) => p !== goalkeeper);
    for (let i = 0; i < remainingDefenders.length; i++) {
      const def = remainingDefenders[i];
      const target = attackers[i % attackers.length];
      if (target) {
        // Position slightly between attacker and goal.
        const markX = (target.groundPosition.x + (goalIndex === 0 ? GOAL_LINE_X : -GOAL_LINE_X)) / 2;
        const markY = target.groundPosition.y;
        def.groundPosition = { x: markX, y: markY };
        def.linearVelocity = { x: 0, y: 0 };
        def.desiredVelocity = { x: 0, y: 0 };
        def.bodyHeading = goalIndex === 0 ? Math.PI : 0;
        def.desiredHeading = def.bodyHeading;
      }
    }
  }

  /**
   * Execute the corner kick: perform a lofted cross from the corner flag
   * toward the center of the penalty area.
   *
   * Called when cornerKickCountdown reaches zero.
   */
  function applyCornerKick(): void {
    if (!state.cornerKickPosition || !state.cornerKickAttackingTeam) return;

    const cornerPos = state.cornerKickPosition;
    const goalIndex = state.cornerKickGoalIndex ?? 0;
    const goalLineX = goalIndex === 0 ? GOAL_LINE_X : -GOAL_LINE_X;

    // Target: center of the penalty area (about 8-10m from goal line, center of pitch).
    const targetX = goalLineX + (goalIndex === 0 ? -8 : 8);
    const targetY = 0;

    // Compute cross direction from corner flag to target.
    const dx = targetX - cornerPos.x;
    const dy = targetY - cornerPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) return;

    const dirX = dx / dist;
    const dirY = dy / dist;

    // Place ball at corner flag.
    state.ball.position.x = cornerPos.x;
    state.ball.position.y = cornerPos.y;
    state.ball.position.z = 0.11; // ball radius
    state.ball.regime = "airborne";

    // Apply cross velocity (lofted pass).
    const crossSpeed = 14; // provisional: lofted cross speed (m/s)
    const verticalComponent = 0.35; // provisional: loft for cross trajectory
    state.ball.linearVelocity.x = dirX * crossSpeed;
    state.ball.linearVelocity.y = dirY * crossSpeed;
    state.ball.linearVelocity.z = crossSpeed * verticalComponent;
    state.ball.angularVelocity = { x: 0, y: 0, z: 0 };
    state.ball.lastTouchRef = null;

    // Emit corner-kick-executed event.
    eventCounter++;
    const kickEvent: SimulationEvent = {
      id: `corner-kick-executed-${state.tick}-${eventCounter}`,
      tick: state.tick,
      sequence: eventCounter,
      kind: "corner-kick-executed",
      label: `Corner kick executed by ${state.cornerKickTakerId}`,
      payload: {
        teamId: state.cornerKickAttackingTeam,
        kickTakerId: state.cornerKickTakerId,
        cornerPosition: { ...cornerPos },
        targetPosition: { x: targetX, y: targetY },
        crossDirection: { x: dirX, y: dirY },
      },
    };
    state.events = [...state.events, kickEvent];
  }

  // ------------------------------------------------------------------
  // Throw-in helpers (MATCH-THROW-IN)
  // ------------------------------------------------------------------

  /** Default throw-in countdown ticks (≈1 second at 60 FPS). */
  const defaultThrowInCountdown = 60;

  /**
   * Set matchPhase to "throw-in" and start the countdown.
   * Called when a ball-touchline-out-of-play event is detected and the
   * last touch was by the opposite team (throw-in condition).
   *
   * Throw-in awarding rule: awarded to the team OPPOSITE whoever last
   * touched the ball (standard football rule).
   */
  function onThrowInEvent(
    awardingTeam: string,
    throwInPos: { x: number; y: number },
    touchlineIndex: 0 | 1,
  ): void {
    if (state.matchPhase !== "playing") return;
    state.matchPhase = "throw-in";
    state.throwInCountdown = defaultThrowInCountdown;
    state.throwInPosition = { ...throwInPos };
    state.throwInAwardingTeam = awardingTeam;
    state.throwInTouchlineIndex = touchlineIndex;

    // Select throw-in taker: closest awarding-team player to the exit point.
    let bestPlayer: string | null = null;
    let bestDist = Infinity;
    for (const p of state.players) {
      if (p.teamId !== awardingTeam) continue;
      const dx = p.groundPosition.x - throwInPos.x;
      const dy = p.groundPosition.y - throwInPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestPlayer = p.playerId;
      }
    }
    state.throwInTakerId = bestPlayer;

    // Position the throw-in taker at the sideline exit point.
    if (bestPlayer) {
      const player = state.players.find((p) => p.playerId === bestPlayer);
      if (player) {
        player.groundPosition = { x: throwInPos.x, y: throwInPos.y };
        player.linearVelocity = { x: 0, y: 0 };
        player.desiredVelocity = { x: 0, y: 0 };
        // Face toward the field (perpendicular to touchline).
        const faceY = touchlineIndex === 0 ? -1 : 1;
        player.bodyHeading = Math.atan2(faceY, 0);
        player.desiredHeading = player.bodyHeading;
      }
    }

    // Position awarding-team receivers in play (spread along the sideline).
    const defendingTeam = awardingTeam === "team-a" ? "team-b" : "team-a";
    const sidelineDir = touchlineIndex === 0 ? -1 : 1; // direction into play
    let receiverIdx = 0;
    for (const p of state.players) {
      if (p.teamId !== awardingTeam) continue;
      if (p.playerId === bestPlayer) continue;
      // Position receivers slightly inside the field from the touchline.
      const offsetY = (receiverIdx % 3) * 8 - 8;
      const offsetX = sidelineDir * (5 + receiverIdx * 3);
      p.groundPosition = { x: throwInPos.x + offsetX, y: throwInPos.y + offsetY };
      // Clamp inside the pitch bounds.
      p.groundPosition.y = Math.max(-PITCH_HALF_WIDTH + 2, Math.min(PITCH_HALF_WIDTH - 2, p.groundPosition.y));
      p.groundPosition.x = Math.max(-GOAL_LINE_X + 2, Math.min(GOAL_LINE_X - 2, p.groundPosition.x));
      p.linearVelocity = { x: 0, y: 0 };
      p.desiredVelocity = { x: 0, y: 0 };
      // Face toward the touchline (ready to receive).
      p.bodyHeading = Math.atan2(-sidelineDir, 0);
      p.desiredHeading = p.bodyHeading;
      receiverIdx++;
    }

    // Position defensive team to mark receivers.
    const defenders = state.players.filter((p) => p.teamId === defendingTeam);
    const receivers = state.players.filter(
      (p) => p.teamId === awardingTeam && p.playerId !== bestPlayer,
    );
    for (let i = 0; i < defenders.length; i++) {
      const def = defenders[i];
      const target = receivers[i % receivers.length];
      if (target) {
        // Position between receiver and own goal.
        const goalX = defendingTeam === "team-a" ? -GOAL_LINE_X : GOAL_LINE_X;
        const markX = (target.groundPosition.x + goalX) / 2;
        const markY = target.groundPosition.y;
        def.groundPosition = { x: markX, y: markY };
        def.linearVelocity = { x: 0, y: 0 };
        def.desiredVelocity = { x: 0, y: 0 };
        def.bodyHeading = defendingTeam === "team-a" ? Math.PI : 0;
        def.desiredHeading = def.bodyHeading;
      }
    }
  }

  /**
   * Execute the throw-in: place the ball at the sideline position and
   * throw it back into play toward the nearest receiver.
   *
   * Called when throwInCountdown reaches zero.
   */
  function applyThrowIn(): void {
    if (!state.throwInPosition || !state.throwInAwardingTeam) return;

    const throwPos = state.throwInPosition;
    const touchlineIndex = state.throwInTouchlineIndex ?? 0;
    const sidelineDir = touchlineIndex === 0 ? -1 : 1; // direction into play

    // Find the nearest awarding-team receiver (not the taker) to throw to.
    let bestReceiver: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const p of state.players) {
      if (p.teamId !== state.throwInAwardingTeam) continue;
      if (p.playerId === state.throwInTakerId) continue;
      const dx = p.groundPosition.x - throwPos.x;
      const dy = p.groundPosition.y - throwPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist && dist > 0.5) {
        bestDist = dist;
        bestReceiver = { x: p.groundPosition.x, y: p.groundPosition.y };
      }
    }

    // Default target: into play from the exit point if no receiver found.
    const targetX = bestReceiver ? bestReceiver.x : throwPos.x + sidelineDir * 10;
    const targetY = bestReceiver ? bestReceiver.y : throwPos.y;

    // Compute throw direction from exit point to target.
    const dx = targetX - throwPos.x;
    const dy = targetY - throwPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) return;

    const dirX = dx / dist;
    const dirY = dy / dist;

    // Place ball at the sideline exit point at chest height (provisional).
    state.ball.position.x = throwPos.x;
    state.ball.position.y = throwPos.y;
    state.ball.position.z = 1.5; // provisional: chest height for throw-in (m)
    state.ball.regime = "airborne";

    // Apply throw velocity (provisional: moderate overarm throw speed).
    const throwSpeed = 12; // provisional: throw-in speed (m/s)
    const verticalComponent = 0.15; // provisional: slight upward arc
    state.ball.linearVelocity.x = dirX * throwSpeed;
    state.ball.linearVelocity.y = dirY * throwSpeed;
    state.ball.linearVelocity.z = throwSpeed * verticalComponent;
    state.ball.angularVelocity = { x: 0, y: 0, z: 0 };
    state.ball.lastTouchRef = null;

    // Emit throw-in-executed event.
    eventCounter++;
    const throwEvent: SimulationEvent = {
      id: `throw-in-executed-${state.tick}-${eventCounter}`,
      tick: state.tick,
      sequence: eventCounter,
      kind: "throw-in-executed",
      label: `Throw-in executed by ${state.throwInTakerId}`,
      payload: {
        teamId: state.throwInAwardingTeam,
        throwTakerId: state.throwInTakerId,
        throwPosition: { ...throwPos },
        targetPosition: { x: targetX, y: targetY },
        throwDirection: { x: dirX, y: dirY },
      },
    };
    state.events = [...state.events, throwEvent];
  }

  // ------------------------------------------------------------------
  // Goal kick helpers (MATCH-GOAL-KICK)
  // ------------------------------------------------------------------

  /** Default goal kick countdown ticks (≈1 second at 60 FPS). */
  const defaultGoalKickCountdown = 60;

  /** Provisional goal-area half-width from pitch center (9.16m, ±9.16m from center). */
  const GOAL_AREA_HALF_WIDTH = 9.16;

  /** Provisional goal-area depth from the goal line (5.5m). */
  const GOAL_AREA_DEPTH = 5.5;

  /**
   * Compute the goal-area ball placement position for a goal kick.
   *
   * Ball is placed inside the goal area on the side where the ball exited
   * (same y-sign as the exit point), clamped to the goal area bounds:
   *   |y| ≤ 9.16, |x| = GOAL_LINE_X − 5.5.
   */
  function computeGoalAreaPosition(
    goalIndex: 0 | 1,
    ballY: number,
  ): { x: number; y: number } {
    const goalLineX = goalIndex === 0 ? GOAL_LINE_X : -GOAL_LINE_X;
    const kickX = goalIndex === 0 ? GOAL_LINE_X - GOAL_AREA_DEPTH : -GOAL_LINE_X + GOAL_AREA_DEPTH;
    // Clamp y to goal area bounds, preserving the sign of ballY.
    const clampedY = Math.max(-GOAL_AREA_HALF_WIDTH, Math.min(GOAL_AREA_HALF_WIDTH, ballY));
    return { x: kickX, y: clampedY };
  }

  /**
   * Set matchPhase to "goal-kick" and start the countdown.
   * Called when a ball-out-of-play event is detected and the last touch
   * was by the attacking team (NOT the defending team of the goal line
   * the ball exited). Standard football rule: goal kick to the defending team.
   */
  function onGoalKickEvent(
    awardingTeam: string,
    goalKickPos: { x: number; y: number },
    goalIndex: 0 | 1,
  ): void {
    if (state.matchPhase !== "playing") return;
    state.matchPhase = "goal-kick";
    state.goalKickCountdown = defaultGoalKickCountdown;
    state.goalKickPosition = { ...goalKickPos };
    state.goalKickAwardingTeam = awardingTeam;
    state.goalKickGoalIndex = goalIndex;

    // Select kick taker: closest defending-team (awarding team) player to the goal-area spot.
    let bestPlayer: string | null = null;
    let bestDist = Infinity;
    for (const p of state.players) {
      if (p.teamId !== awardingTeam) continue;
      const dx = p.groundPosition.x - goalKickPos.x;
      const dy = p.groundPosition.y - goalKickPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestPlayer = p.playerId;
      }
    }
    state.goalKickTakerId = bestPlayer;

    // Position the kick taker at the goal-area spot.
    if (bestPlayer) {
      const player = state.players.find((p) => p.playerId === bestPlayer);
      if (player) {
        player.groundPosition = { x: goalKickPos.x, y: goalKickPos.y };
        player.linearVelocity = { x: 0, y: 0 };
        player.desiredVelocity = { x: 0, y: 0 };
        // Face upfield (away from own goal).
        const upfieldDir = goalIndex === 0 ? -1 : 1;
        player.bodyHeading = Math.atan2(0, upfieldDir);
        player.desiredHeading = player.bodyHeading;
      }
    }

    // Position defending teammates in their own half (provisional, deterministic).
    const defendingPlayers = state.players.filter(
      (p) => p.teamId === awardingTeam && p.playerId !== bestPlayer,
    );
    const ownHalfX = goalIndex === 0 ? -GOAL_LINE_X / 2 : GOAL_LINE_X / 2;
    let defIdx = 0;
    for (const p of defendingPlayers) {
      // Spread defenders across the defensive half, spread vertically.
      const offsetX = ownHalfX + (defIdx % 3) * 10 - 10;
      const offsetY = Math.floor(defIdx / 3) * 8 - 4;
      p.groundPosition = { x: offsetX, y: offsetY };
      p.linearVelocity = { x: 0, y: 0 };
      p.desiredVelocity = { x: 0, y: 0 };
      // Face upfield.
      const faceDir = goalIndex === 0 ? 1 : -1;
      p.bodyHeading = Math.atan2(0, faceDir);
      p.desiredHeading = p.bodyHeading;
      defIdx++;
    }

    // Position attacking players outside the goal area (provisional, deterministic).
    const attackingTeam = awardingTeam === "team-a" ? "team-b" : "team-a";
    const attackingPlayers = state.players.filter((p) => p.teamId === attackingTeam);
    let attIdx = 0;
    for (const p of attackingPlayers) {
      // Position outside the goal area, spread across the attacking half.
      const attHalfX = goalIndex === 0 ? GOAL_LINE_X / 2 : -GOAL_LINE_X / 2;
      const offsetX = attHalfX + (attIdx % 3) * 10 - 10;
      const offsetY = Math.floor(attIdx / 3) * 8 - 4;
      p.groundPosition = { x: offsetX, y: offsetY };
      p.linearVelocity = { x: 0, y: 0 };
      p.desiredVelocity = { x: 0, y: 0 };
      // Face toward the goal they're attacking.
      const faceDir = goalIndex === 0 ? 1 : -1;
      p.bodyHeading = Math.atan2(0, faceDir);
      p.desiredHeading = p.bodyHeading;
      attIdx++;
    }
  }

  /**
   * Execute the goal kick: place the ball at the goal-area spot and
   * kick it upfield toward the nearest defending-team receiver.
   *
   * Called when goalKickCountdown reaches zero.
   */
  function applyGoalKick(): void {
    if (!state.goalKickPosition || !state.goalKickAwardingTeam) return;

    const kickPos = state.goalKickPosition;
    const goalIndex = state.goalKickGoalIndex ?? 0;

    // Find the nearest awarding-team receiver (not the taker) to kick to.
    let bestReceiver: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const p of state.players) {
      if (p.teamId !== state.goalKickAwardingTeam) continue;
      if (p.playerId === state.goalKickTakerId) continue;
      const dx = p.groundPosition.x - kickPos.x;
      const dy = p.groundPosition.y - kickPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.5 && dist < bestDist) {
        bestDist = dist;
        bestReceiver = { x: p.groundPosition.x, y: p.groundPosition.y };
      }
    }

    // Default target: upfield from the goal area if no receiver found.
    const upfieldDir = goalIndex === 0 ? -1 : 1;
    const targetX = bestReceiver ? bestReceiver.x : kickPos.x + upfieldDir * 20;
    const targetY = bestReceiver ? bestReceiver.y : 0;

    // Compute kick direction from goal area to target.
    const dx = targetX - kickPos.x;
    const dy = targetY - kickPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) return;

    const dirX = dx / dist;
    const dirY = dy / dist;

    // Place ball at the goal-area spot (ground level).
    state.ball.position.x = kickPos.x;
    state.ball.position.y = kickPos.y;
    state.ball.position.z = 0.11; // ball radius
    state.ball.regime = "airborne";

    // Apply kick velocity (provisional: lofted distribution pass).
    const kickSpeed = 16; // provisional: goal kick distribution speed (m/s)
    const verticalComponent = 0.25; // provisional: moderate loft for distribution
    state.ball.linearVelocity.x = dirX * kickSpeed;
    state.ball.linearVelocity.y = dirY * kickSpeed;
    state.ball.linearVelocity.z = kickSpeed * verticalComponent;
    state.ball.angularVelocity = { x: 0, y: 0, z: 0 };
    state.ball.lastTouchRef = null;

    // Emit goal-kick-executed event.
    eventCounter++;
    const kickEvent: SimulationEvent = {
      id: `goal-kick-executed-${state.tick}-${eventCounter}`,
      tick: state.tick,
      sequence: eventCounter,
      kind: "goal-kick-executed",
      label: `Goal kick executed by ${state.goalKickTakerId}`,
      payload: {
        teamId: state.goalKickAwardingTeam,
        kickTakerId: state.goalKickTakerId,
        kickPosition: { ...kickPos },
        targetPosition: { x: targetX, y: targetY },
        kickDirection: { x: dirX, y: dirY },
      },
    };
    state.events = [...state.events, kickEvent];
  }

  // ------------------------------------------------------------------
  // Internal: drain all buffers into a single flat array (ordered by tick, then insertion).
  // ------------------------------------------------------------------

  /** Flatten all input buffers into a single ordered array. */
  function flattenInputBuffers(): InputFrame[] {
    const all: InputFrame[] = [];
    for (const key of Object.keys(inputBuffers).sort((a, b) => Number(a) - Number(b))) {
      for (const f of inputBuffers[key]) {
        all.push(f);
      }
    }
    return all;
  }

  // ------------------------------------------------------------------
  // Internal: resolve input frames for the target tick.
  // ------------------------------------------------------------------

  /**
   * Input resolution stage.
   *
   * Processes buffered frames for `targetTick`, detects duplicates across
   * all buffers (not just the current tick), applies the missing-input
   * policy from schedulerMemory, and produces resolved intents.
   *
   * Emits diagnostic events for rejections and fallbacks.
   */
  function resolveInputs(
    targetTick: number,
    framesForTick: InputFrame[],
  ): SimulationEvent[] {
    const events: SimulationEvent[] = [];

    // --- Within-batch duplicate detection (same tick, same controlSlot) ----
    // When the scenario validation allows duplicate frames (e.g. for
    // diagnostic testing), detect them here and emit input-rejection events.
    const batchSeenSlots = new Map<string, InputFrame>();
    const uniqueFrames: InputFrame[] = [];
    for (const f of framesForTick) {
      const key = `${f.tick}:${f.controlSlot}`;
      if (batchSeenSlots.has(key)) {
        const ev = createRejectionEvent(targetTick, f, ++eventCounter);
        events.push(ev);
        state.events = [...state.events, ev];
      } else {
        batchSeenSlots.set(key, f);
        uniqueFrames.push(f);
      }
    }

    // --- Cross-call duplicate detection --------------------------------
    const allBuffered = flattenInputBuffers();
    // Remove frames belonging to targetTick from allBuffered (they are in framesForTick).
    const priorBuffered = allBuffered.filter(
      (f) => f.tick !== targetTick,
    );

    // Filter duplicates: new frames that conflict with prior buffers.
    const { rejectFrames, okFrames } = filterDuplicateFrames(
      uniqueFrames,
      priorBuffered,
    );

    // Emit diagnostic events for rejected duplicates (in arrival order of framesForTick).
    for (const rej of rejectFrames) {
      const ev = createRejectionEvent(targetTick, rej, ++eventCounter);
      events.push(ev);
      state.events = [...state.events, ev];
    }

    // Process valid frames: resolve intent per player.
    // Determine which controlSlot each valid frame belongs to.
    const frameBySlot = new Map<string, InputFrame>();
    for (const f of okFrames) {
      frameBySlot.set(f.controlSlot, f);
    }

    // --- Player switching on SWITCH_PLAYER_BIT --------------------------
    // Process explicit switch requests BEFORE resolving input so the
    // newly selected player receives the frame's movement on this tick.
    for (const [slot, frame] of frameBySlot) {
      if ((frame.pressedButtons & SWITCH_PLAYER_BIT) !== 0) {
        const nextId = computeExplicitSwitchTarget(
          slot,
          state.controlAssignments,
          state.players,
          "NEXT",
        );
        if (nextId) {
          const fromId = state.controlAssignments[slot].controlledPlayerId;
          state.controlAssignments[slot].controlledPlayerId = nextId;

          // Emit a slot-switch event for observability.
          const switchEv: SimulationEvent = {
            id: `slot-switch-${slot}-${targetTick}-${++eventCounter}`,
            tick: targetTick,
            sequence: eventCounter,
            kind: "slot-switch",
            label: `Slot "${slot}" switched to player "${nextId}"`,
            payload: {
              controlSlot: slot,
              fromPlayer: fromId,
              toPlayer: nextId,
            },
          };
          const clonedSwitch = deepClone(switchEv) as SimulationEvent;
          state.events = [...state.events, clonedSwitch];
          events.push(clonedSwitch);
        }
      }
    }

    // --- Slot wiring invariant check ------------------------------------
    // Validate slot ownership on every input resolution tick.
    const wiringCheck = checkSlotWiringInvariant(
      state.controlAssignments,
      state.players,
    );
    if (!wiringCheck.ok) {
      const wiringEv: SimulationEvent = {
        id: `slot-wiring-violation-${targetTick}-${++eventCounter}`,
        tick: targetTick,
        sequence: eventCounter,
        kind: "slot-wiring-violation",
        label: `Slot wiring invariant violated: ${wiringCheck.violations.join("; ")}`,
        payload: {
          violations: wiringCheck.violations,
        },
      };
      const clonedWiring = deepClone(wiringEv) as SimulationEvent;
      state.events = [...state.events, clonedWiring];
      events.push(clonedWiring);
    }

    // For each player, check if there is a frame for its control slot.
    // In the bootstrap we use the first control slot from the scenario.
    for (const player of state.players) {
      // Find the slot that controls this player from controlAssignments.
      const slot = findSlotForPlayer(player.playerId, state.controlAssignments);
      if (!slot) continue;

      const frameForSlot = frameBySlot.get(slot);

      // Clone schedulerMemory for mutation safety.
      const sm = deepClone(state.schedulerMemory) as SchedulerMemory;

      const { resolved: intent, events: playerEvents } = resolveInputForPlayer(
        player,
        frameForSlot,
        sm,
        slot,
      );

      // Apply resolved intent to player state — input changes
      // desiredVelocity / desiredHeading immediately.
      player.desiredVelocity.x = intent.desiredVelocity.x;
      player.desiredVelocity.y = intent.desiredVelocity.y;
      const inputMag = Math.sqrt(
        intent.desiredVelocity.x ** 2 + intent.desiredVelocity.y ** 2,
      );
      if (inputMag > 0) {
        player.desiredHeading = Math.atan2(
          intent.desiredVelocity.y,
          intent.desiredVelocity.x,
        );
      }

      // Update schedulerMemory in-place (canonical continuation state).
      state.schedulerMemory = sm;

      // Emit fallback events with correct tick and sequence.
      for (const pe of playerEvents) {
        const cloned = deepClone(pe) as SimulationEvent;
        cloned.tick = targetTick;
        cloned.sequence = ++eventCounter;
        events.push(cloned);
        state.events = [...state.events, cloned];
      }
    }

    return events;
  }

  // ------------------------------------------------------------------
  // Internal: bootstrap scheduler stages
  // ------------------------------------------------------------------

  /**
   * Stage: scheduled scenario events.
   *
   * Reads committed state and appends scenario-start/stop events
   * declared in the scenario definition at their scheduled tick.
   */
  function scheduledEvents(tick: number): SimulationEvent[] {
    const events: SimulationEvent[] = [];
    // Scheduled events come from the scenario definition, stored in
    // meta or a dedicated field. Bootstrap has none at this time
    // beyond the initial scenario-start already in state.events.
    // The scheduler will wire this up when scenario events exist.
    return events;
  }

  /**
   * Stage: locomotion integration.
   *
   * Reads the locomotion config from world state and uses it to
   * converge actual velocity/heading/position under configurable
   * limits, including the versioned transient acceleration bonus.
   */
  function locomotionStep(): void {
    const dt = state.fixedDt.numerator / state.fixedDt.denominator;
    // Prefer the override (used by capability evaluation for low vs high configs),
    // otherwise read from world state configVersion.
    let locoConfig: typeof FOUNDATION_LOCOMOTION_V1;
    if (locomotionConfigOverride) {
      locoConfig = locomotionConfigOverride;
    } else {
      switch (state.configVersion) {
        case "foundation-config-v1":
          locoConfig = FOUNDATION_LOCOMOTION_V1;
          break;
        case "transient-accel-locomotion-v1":
          locoConfig = TRANSIENT_ACCEL_LOCOMOTION_V1;
          break;
        default:
          locoConfig = FOUNDATION_LOCOMOTION_V1;
      }
    }
    stepLocomotion(state.players, dt, locoConfig);
    activeMaxSpeed = locoConfig.maxSpeed.value;
  }

  /**
   * Stage: player-player contact resolution.
   *
   * Runs AFTER locomotion (players at tick-advanced positions) and
   * BEFORE player-ball contacts and ball integration. Detects planar
   * overlaps between player collision discs and applies symmetric
   * separation. Does NOT modify ball state.
   */
  function playerContactStage(): SimulationEvent[] {
    const counter = { value: eventCounter };
    const { events } = stepPlayerContacts(
      state.players,
      counter,
      state.tick,
      contactConfigOverride ?? FOUNDATION_PLAYER_CONTACT_V1,
    );
    eventCounter = counter.value;
    return events;
  }

  /**
   * Stage: ball integration.
   *
   * Applies gravity, air drag, swept pitch-plane impact, bounce/restitution,
   * ground resistance, and spin decay. Emits ordered pitch-contact events.
   */
  function ballIntegrationStage(): SimulationEvent[] {
    const dt = state.fixedDt.numerator / state.fixedDt.denominator;
    const counter = { value: eventCounter };
    // Merge ball config override on top of FOUNDATION_BALL_V1.
    let ballCfg: Parameters<typeof import("../ball/ball-system.js").stepBall>[2];
    if (ballConfigOverride) {
      ballCfg = {
        ...FOUNDATION_BALL_V1,
        curveCoefficient: {
          value: ballConfigOverride.curveCoefficient.value,
        },
      };
    } else {
      ballCfg = FOUNDATION_BALL_V1;
    }
    const events = stepBall(state.ball, dt, ballCfg, counter, state.tick);
    eventCounter = counter.value;
    return events;
  }

  /**
   * Stage: defensive tackle action system.
   *
   * Runs AFTER player-player contact resolution and BEFORE player-ball
   * contact resolution: standing / sliding tackles advance their ordered
   * prepare → active → recover phases, resolve contact only inside the
   * explicit active window, and report which players' ball actions are
   * denied this tick (their own commitment, or an opponent's duel contest).
   */
  function tackleStage(
    framesForTick: InputFrame[],
  ): { events: SimulationEvent[]; suppressedPlayerIds: Set<string>; ballTouched: boolean } {
    const counter = { value: eventCounter };
    const result = stepTackle(
      state.players,
      state.ball,
      tackleStates,
      framesForTick,
      state.controlAssignments,
      FOUNDATION_TACKLE_V1,
      counter,
      state.tick,
      dribbleStates,
      activeMaxSpeed,
    );
    eventCounter = counter.value;
    return result;
  }

  /**
   * Stage: player-ball contact detection and resolution.
   *
   * Runs AFTER locomotion (players at tick-advanced positions) and
   * BEFORE ball integration (ball still has pre-step velocity).
   * Detects proximity + FIRST_TOUCH/PASS/SHOT input, applies impulse
   * to ball, emits ordered player-ball-contact/pass/shot events,
   * and updates lastTouchRef.
   *
   * @param suppressedActionPlayerIds - Players whose ball action is denied by
   *   this tick's tackle activity (excluded from contact eligibility).
   * @param ballAlreadyTouched - True when a tackle already played the ball
   *   this tick; the contact stage keeps its one-touch-per-tick rule.
   */
  function contactDetectionStage(
    framesForTick: InputFrame[],
    suppressedActionPlayerIds: ReadonlySet<string> = new Set<string>(),
    ballAlreadyTouched = false,
  ): SimulationEvent[] {
    const counter = { value: eventCounter };
    const { events } = stepContacts(
      state.players,
      state.ball,
      framesForTick,
      state.controlAssignments,
      undefined,
      counter,
      state.tick,
      undefined,
      effectiveShotConfig,
      FOUNDATION_CLOSE_CONTROL_V1,
      dribbleCooldowns,
      dribbleStates,
      suppressedActionPlayerIds,
      ballAlreadyTouched,
    );
    eventCounter = counter.value;
    return events;
  }

  /**
   * Stage: invariant validation.
   *
   * Checks that all numeric state values are finite (not NaN or Infinity).
   *
   * @returns True if all invariants pass.
   */
  function validateInvariants(): boolean {
    // Check player finite state
    for (const player of state.players) {
      if (!checkFinite(player.groundPosition.x)) return false;
      if (!checkFinite(player.groundPosition.y)) return false;
      if (!checkFinite(player.linearVelocity.x)) return false;
      if (!checkFinite(player.linearVelocity.y)) return false;
      if (!checkFinite(player.desiredVelocity.x)) return false;
      if (!checkFinite(player.desiredVelocity.y)) return false;
      if (!checkFinite(player.bodyHeading)) return false;
      if (!checkFinite(player.desiredHeading)) return false;
    }
    // Check ball finite state
    const ball = state.ball;
    if (!checkFinite(ball.position.x)) return false;
    if (!checkFinite(ball.position.y)) return false;
    if (!checkFinite(ball.position.z)) return false;
    if (!checkFinite(ball.linearVelocity.x)) return false;
    if (!checkFinite(ball.linearVelocity.y)) return false;
    if (!checkFinite(ball.linearVelocity.z)) return false;
    if (!checkFinite(ball.angularVelocity.x)) return false;
    if (!checkFinite(ball.angularVelocity.y)) return false;
    if (!checkFinite(ball.angularVelocity.z)) return false;
    return true;
  }

  /**
   * Stage: derive a read-only presentation snapshot.
   */
  function derivePresentation(): PresentationSnapshot {
    // Determine which players are controlled by a human slot.
    const controlledPlayerIds = new Set<string>();
    if (state.controlAssignments) {
      for (const slot of Object.keys(state.controlAssignments)) {
        const assignment = state.controlAssignments[slot];
        if (assignment?.mode === "HUMAN" && assignment.controlledPlayerId) {
          controlledPlayerIds.add(assignment.controlledPlayerId);
        }
      }
    }

    const players: PlayerPresentation[] = state.players.map(
      (p): PlayerPresentation => {
        const speed = Math.sqrt(
          p.linearVelocity.x * p.linearVelocity.x +
            p.linearVelocity.y * p.linearVelocity.y,
        );
        // Presentation-visible tackle phase facts. The action system's tick
        // bookkeeping stays closure-held; only this derived label is exposed.
        const tackle = tackleStates.get(p.playerId);
        const actionState = tackle
          ? `tackle-${tackle.kind}-${tackle.phase}`
          : null;
        return {
          playerId: p.playerId,
          teamId: p.teamId,
          groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
          bodyHeading: p.bodyHeading,
          speed,
          locomotionPhase: "idle",
          isControlled: controlledPlayerIds.has(p.playerId),
          actionState,
          contactState: null,
          archetypeId: p.archetypeId,
        };
      },
    );

    const ballSpeed = Math.sqrt(
      state.ball.linearVelocity.x ** 2 +
        state.ball.linearVelocity.y ** 2 +
        state.ball.linearVelocity.z ** 2,
    );

    return {
      tick: state.tick,
      simulationTime:
        state.tick * (state.fixedDt.numerator / state.fixedDt.denominator),
      players,
      ball: {
        position: {
          x: state.ball.position.x,
          y: state.ball.position.y,
          z: state.ball.position.z,
        },
        speed: ballSpeed,
        regime: state.ball.regime,
        isGrounded: state.ball.position.z <= 0.001,
        angularVelocity: {
          x: state.ball.angularVelocity.x,
          y: state.ball.angularVelocity.y,
          z: state.ball.angularVelocity.z,
        },
      },
      events: [],
      controlAssignments: { bySlot: {} }, // stub: full resolution TBD
      matchPhase: state.matchPhase,
      matchTimer: state.matchTimer,
    };
  }

  /**
   * Build a telemetry observation for the observer hooks.
   */
  function buildObservation(
    tick: number,
    events: SimulationEvent[],
    inputs: InputFrame[],
  ): TelemetryObservation {
    // Compute PRNG state hash from the serializable snapshot.
    const prngSnapshot = {
      algorithmId: state.prng.algorithmId,
      seed: state.prng.seed,
      state: state.prng.state,
    };
    const prngStateHash = hashFnv1a64(JSON.stringify(prngSnapshot));

    // Build the exact core-fields snapshot that the camera-hash oracle
    // recomputes from.  This must match the structure in eval/oracles/
    // camera-hash.ts computeObservationHash field-for-field.
    const coreFieldsSnapshot = {
      schemaVersion: "observation-core-v1",
      tick,
      prngAlgorithmId: state.prng.algorithmId,
      prngStateHash,
      committedTick: tick,
      players: state.players.map((p) => ({
        playerId: p.playerId,
        teamId: p.teamId,
        groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
        linearVelocity: { x: p.linearVelocity.x, y: p.linearVelocity.y },
        bodyHeading: p.bodyHeading,
        desiredHeading: p.desiredHeading,
      })),
      ball: {
        position: {
          x: state.ball.position.x,
          y: state.ball.position.y,
          z: state.ball.position.z,
        },
        linearVelocity: {
          x: state.ball.linearVelocity.x,
          y: state.ball.linearVelocity.y,
          z: state.ball.linearVelocity.z,
        },
        regime: state.ball.regime,
        lastTouchRef: state.ball.lastTouchRef,
      },
      events: events.map((e) => ({ id: e.id, tick: e.tick, sequence: e.sequence, kind: e.kind })),
    };
    const observationCoreHash = hashFnv1a64(encodeCanonical(coreFieldsSnapshot));

    return {
      tick,
      simulationTime: tick * (state.fixedDt.numerator / state.fixedDt.denominator),
      prngAlgorithmId: state.prng.algorithmId,
      stateHash: "", // placeholder — computed after commit
      prngStateHash,
      observationCoreHash,
      committedTick: tick,
      inputs: inputs.map((f) => ({ ...f })),
      players: state.players.map((p) => ({
        playerId: p.playerId,
        teamId: p.teamId,
        groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
        linearVelocity: { x: p.linearVelocity.x, y: p.linearVelocity.y },
        desiredVelocity: { x: p.desiredVelocity.x, y: p.desiredVelocity.y },
        bodyHeading: p.bodyHeading,
        desiredHeading: p.desiredHeading,
      })),
      ball: {
        position: {
          x: state.ball.position.x,
          y: state.ball.position.y,
          z: state.ball.position.z,
        },
        linearVelocity: {
          x: state.ball.linearVelocity.x,
          y: state.ball.linearVelocity.y,
          z: state.ball.linearVelocity.z,
        },
        angularVelocity: {
          x: state.ball.angularVelocity.x,
          y: state.ball.angularVelocity.y,
          z: state.ball.angularVelocity.z,
        },
        regime: state.ball.regime,
        lastTouchRef: state.ball.lastTouchRef,
      },
      events: events.map((e) => ({ ...e })),
    };
  }

  // ------------------------------------------------------------------
  // Public API — Simulation interface
  // ------------------------------------------------------------------

  return Object.freeze({
    /** Committed simulation tick. */
    get tick(): number {
      return state.tick;
    },

    /**
     * Buffer input frames.
     *
     * Duplicate frames (same tick + controlSlot) are buffered as-is.
     * The resolution stage (`resolveInputs`) detects duplicates and emits
     * `input-rejection` diagnostic events.
     *
     * @param frames - Input frames; validation is strict.
     * @throws {Error} on invalid frame.
     */
    applyInputs(frames: readonly InputFrame[]): void {
      // Validate each frame.
      for (const frame of frames) {
        if (!validateInputFrame(frame)) {
          throw new Error(
            `Invalid input frame at tick ${frame.tick}, controlSlot "${frame.controlSlot}": range or type error`,
          );
        }
      }

      // Buffer all frames by tick (duplicates included).
      for (const frame of frames) {
        const key = String(frame.tick);
        if (!(key in inputBuffers)) {
          inputBuffers[key] = [];
        }
        inputBuffers[key] = inputBuffers[key] ?? [];
        inputBuffers[key].push({ ...frame });
      }
    },

    /**
     * Advance by one tick.
     *
     * Events in the returned StepResult are defensive copies.
     * Mutating them does not affect internal state or subsequent hashes.
     */
    step(): StepResult {
      // Collect the current tick's frames before any mutations.
      const currentTickKey = String(state.tick);
      const currentFrames = inputBuffers[currentTickKey] ?? [];
      delete inputBuffers[currentTickKey];

      // Advance to the new tick (committed tick).
      const newTick = state.tick + 1;
      state.tick = newTick;

      // Resolve the old tick's input using the new (committed) tick for
      // event attribution. Each tick is resolved exactly once.
      const oldTickEvents = resolveInputs(newTick, currentFrames);

      obs.onBeforeStep?.("step");

      // Scheduled events for the new tick.
      const schedEvents = scheduledEvents(newTick);
      for (const ev of schedEvents) {
        const clonedEv = deepClone(ev) as SimulationEvent;
        clonedEv.sequence = ++eventCounter;
        state.events = [...state.events, clonedEv];
      }

      // Diagnostic: detect frames whose controlSlot isn't assigned to any player.
      // Check against controlAssignments (source of truth), not lastHeldFrames.
      {
        const assignedSlots = new Set(Object.keys(state.controlAssignments));
        const unassigned = currentFrames.filter(
          (f) => !assignedSlots.has(f.controlSlot),
        );
        if (unassigned.length > 0) {
          const ev: SimulationEvent = {
            id: `input-unassigned-${newTick}`,
            tick: newTick,
            sequence: ++eventCounter,
            kind: "scheduler" as const,
            label: `Input frame(s) for tick ${newTick} have unassigned controlSlot`,
            payload: {
              tick: newTick,
              frameCount: unassigned.length,
              unassignedSlots: unassigned.map((f) => f.controlSlot),
            },
          };
          const clonedEv = deepClone(ev) as SimulationEvent;
          clonedEv.sequence = ++eventCounter;
          state.events = [...state.events, clonedEv];
          oldTickEvents.push(clonedEv);
        }
      }

      // 4. Locomotion
      locomotionStep();

      // 4.25. Player-player contact resolution (after locomotion, before player-ball contacts)
      const playerContactEvents = playerContactStage();
      for (const ev of playerContactEvents) {
        state.events = [...state.events, ev];
      }

      // 4.3. Defensive tackle actions (ordered prepare/active/recover phases;
      // contact eligible only inside the explicit active window). Runs before
      // ball contacts so a won tackle can deny the contested ball action.
      const tackleResult = tackleStage(currentFrames);
      const tackleEvents = tackleResult.events;
      for (const ev of tackleEvents) {
        state.events = [...state.events, ev];
      }

      // 4.5. Player-ball contact detection (after locomotion, before ball integration)
      const contactEvents = contactDetectionStage(
        currentFrames,
        tackleResult.suppressedPlayerIds,
        tackleResult.ballTouched,
      );
      for (const ev of contactEvents) {
        state.events = [...state.events, ev];
      }

      // 4.6. Second-touch / dribble state machine (after contacts, before ball integration)
      const dribbleCounter = { value: eventCounter };
      const dribbleEvents = stepDribble(
        state.players,
        state.ball,
        dribbleStates,
        currentFrames,
        state.controlAssignments,
        undefined,
        dribbleCounter,
        state.tick,
      );
      eventCounter = dribbleCounter.value;
      for (const ev of dribbleEvents) {
        state.events = [...state.events, ev];
      }

      // 5. Ball integration
      const ballEvents = ballIntegrationStage();
      for (const ev of ballEvents) {
        state.events = [...state.events, ev];
      }

      // 6. Invariant validation
      const invariantsOk = validateInvariants();
      const allStepEvents = [...oldTickEvents, ...schedEvents, ...playerContactEvents, ...tackleEvents, ...contactEvents, ...dribbleEvents, ...ballEvents];

      // ------------------------------------------------------------------
      // Match phase processing (MATCH-SET-PIECE)
      // ------------------------------------------------------------------

      // 6a. Process goal countdown: decrement and reset if done.
      if (state.matchPhase === "goal") {
        state.goalResetCountdown--;
        if (state.goalResetCountdown <= 0) {
          applyGoalReset();
          state.matchPhase = "playing";
          state.goalResetCountdown = 0;
        }
      }

      // 6b. If any goal event fired this step (new events), trigger goal phase.
      for (const ev of allStepEvents) {
        if (ev.kind === "goal" && state.matchPhase === "playing") {
          onGoalEvent();
          break; // Only start countdown on the first goal event of the tick.
        }
      }

      // 6b-2. Process corner kick countdown (MATCH-CORNER-KICK).
      if (state.matchPhase === "corner-kick") {
        state.cornerKickCountdown--;
        if (state.cornerKickCountdown <= 0) {
          // Execute the corner kick: place ball, position players, kick.
          applyCornerKick();
          state.matchPhase = "playing";
          state.cornerKickCountdown = 0;
          state.cornerKickPosition = null;
          state.cornerKickAttackingTeam = null;
          state.cornerKickTakerId = null;
          state.cornerKickGoalIndex = null;
        }
      }

      // 6b-2b. Process throw-in countdown (MATCH-THROW-IN).
      if (state.matchPhase === "throw-in") {
        state.throwInCountdown--;
        if (state.throwInCountdown <= 0) {
          // Execute the throw-in: place ball, throw into play.
          applyThrowIn();
          state.matchPhase = "playing";
          state.throwInCountdown = 0;
          state.throwInPosition = null;
          state.throwInAwardingTeam = null;
          state.throwInTakerId = null;
          state.throwInTouchlineIndex = null;
        }
      }

      // 6b-2c. Process goal kick countdown (MATCH-GOAL-KICK).
      if (state.matchPhase === "goal-kick") {
        state.goalKickCountdown--;
        if (state.goalKickCountdown <= 0) {
          // Execute the goal kick: place ball at goal area, kick upfield.
          applyGoalKick();
          state.matchPhase = "playing";
          state.goalKickCountdown = 0;
          state.goalKickPosition = null;
          state.goalKickAwardingTeam = null;
          state.goalKickTakerId = null;
          state.goalKickGoalIndex = null;
        }
      }

      // 6b-3. Detect ball-out-of-play events and trigger corner kick phase.
      if (state.matchPhase === "playing") {
        for (const ev of allStepEvents) {
          if (ev.kind === "ball-out-of-play") {
            const payload = ev.payload as {
              goalIndex?: number;
              ballPosition?: { x: number; y: number; z: number };
              lastTouchRef?: string | null;
            };
            if (payload.goalIndex === undefined || payload.ballPosition === undefined) continue;

            // Determine which team last touched the ball.
            const lastTouchTeam = resolveLastTouchTeam(payload.lastTouchRef ?? null);
            if (lastTouchTeam === null) continue;

            // Goal index: 0 = right goal line (team-b defends), 1 = left goal line (team-a defends).
            const goalIndex = payload.goalIndex as 0 | 1;
            const defendingTeam = goalIndex === 0 ? "team-b" : "team-a";

            // Corner kick: last touch by the defending team.
            if (lastTouchTeam === defendingTeam) {
              const attackingTeam = goalIndex === 0 ? "team-a" : "team-b";
              const cornerPos = computeCornerFlagPosition(goalIndex, payload.ballPosition.y);

              onCornerKickEvent(attackingTeam, cornerPos, goalIndex as 0 | 1);
              break;
            }

            // Goal kick: last touch by the attacking team (NOT the defending team).
            if (lastTouchTeam !== defendingTeam) {
              const goalKickPos = computeGoalAreaPosition(goalIndex, payload.ballPosition.y);

              onGoalKickEvent(defendingTeam, goalKickPos, goalIndex as 0 | 1);
              break;
            }
          }
        }

        // 6b-3b. Detect ball-touchline-out-of-play events and trigger throw-in phase.
        for (const ev of allStepEvents) {
          if (ev.kind === "ball-touchline-out-of-play") {
            const payload = ev.payload as {
              touchlineIndex?: number;
              ballPosition?: { x: number; y: number; z: number };
              lastTouchRef?: string | null;
            };
            if (payload.touchlineIndex === undefined || payload.ballPosition === undefined) continue;

            // Throw-in awarded to the team OPPOSITE whoever last touched the ball.
            const lastTouchTeam = resolveLastTouchTeam(payload.lastTouchRef ?? null);
            if (lastTouchTeam === null) continue;

            const touchlineIndex = payload.touchlineIndex as 0 | 1;
            const awardingTeam = lastTouchTeam === "team-a" ? "team-b" : "team-a";

            onThrowInEvent(awardingTeam, payload.ballPosition, touchlineIndex);
            break;
          }
        }
      }

      // 6c. Match timer auto-enforcement (MATCH-TIMER-ENFORCEMENT).
      //  Decrement the timer when in "playing" phase. On zero, transition
      //  to "halftime" (half 1) or "fulltime" (half 2). During "halftime"
      //  the timer counts down the delay before auto-restart.
      {
        if (state.matchPhase === "playing") {
          state.matchTimer--;
          if (state.matchTimer <= 0) {
            if (state.currentHalf === 1) {
              state.matchPhase = "halftime";
              state.matchTimer = defaultHalftimeCountdown;
            } else {
              state.matchPhase = "fulltime";
            }
          }
        } else if (state.matchPhase === "halftime") {
          state.matchTimer--;
          if (state.matchTimer <= 0) {
            applyHalftimeReset();
            state.matchPhase = "playing";
            state.currentHalf = 2;
            state.matchTimer = initialHalfDurationTicks;
          }
        }
        // fulltime: timer stays at zero, no further transitions.
        // goal: timer frozen (not playing or halftime).
      }

      const obsData = buildObservation(newTick, allStepEvents, currentFrames);

      // Compute hash once (freezeWorldState copies, does not mutate).
      const computedHash = hashFnv1a64(
        encodeCanonical(freezeWorldState(state) as unknown as Record<string, unknown>),
      );
      obsData.stateHash = computedHash;
      // observationCoreHash is already set from buildObservation (same value).

      // Call onObservation with the populated observation.
      obs.onObservation?.(obsData);

      if (invariantsOk) {
        obs.onInvariantPass?.(obsData);
      } else {
        obs.onInvariantFail?.(obsData, "finite-number-invariant-failed");
      }

      // 7. Presentation derivation
      const presentation = derivePresentation();
      obs.onPresent?.("step");

      // 8. Commit — use the already-computed hash
      obs.onAfterStep?.("step");

      // Return defensive copies of events so callers cannot mutate internal state.
      return {
        tick: newTick,
        events: allStepEvents.map((e) => deepClone(e) as SimulationEvent),
        stateHash: computedHash,
      };
    },

    /**
     * Return a deep-frozen clone of the current world state.
     */
    snapshot(): Checkpoint {
      return freezeWorldState(state) as Checkpoint;
    },

    /**
     * Derive a read-only presentation snapshot.
     */
    presentation(): PresentationSnapshot {
      return derivePresentation();
    },

    /**
     * Restore from a checkpoint (deep-cloned world state).
     *
     * Re-derives eventCounter from the maximum sequence in state.events
     * so that later events stay deterministically ordered after restore.
     */
    restore(snapshot: Checkpoint): void {
      // Deep clone again to ensure the caller's reference doesn't
      // affect internal state.
      state = deepClone(snapshot) as WorldState;
      // Reset buffers since we're restoring a previous point.
      for (const key of Object.keys(inputBuffers)) {
        delete inputBuffers[key];
      }
      // Reconstruct dribble-touch cooldowns from event history.
      // Clear then rebuild from all player-ball-contact events with
      // contactType "dribble-touch", keeping the latest tick per player.
      dribbleCooldowns.clear();
      for (const ev of state.events) {
        if (ev.kind === "player-ball-contact") {
          const payload = ev.payload as { contactType?: string; playerId?: string } | undefined;
          if (payload?.contactType === "dribble-touch" && payload.playerId) {
            const prev = dribbleCooldowns.get(payload.playerId);
            if (prev === undefined || ev.tick > prev) {
              dribbleCooldowns.set(payload.playerId, ev.tick);
            }
          }
        }
      }
      // Reconstruct second-touch dribble state from event history.
      // A first-touch contact starts dribble; second-touch events extend it;
      // ball-out-of-play or goal events end it.
      dribbleStates.clear();
      for (const ev of state.events) {
        if (ev.kind === "player-ball-contact") {
          const payload = ev.payload as { contactType?: string; playerId?: string } | undefined;
          if (payload?.contactType === "first-touch" && payload.playerId) {
            const ds: DribbleState = {
              active: true,
              startTick: ev.tick,
              lastTurnTick: ev.tick - 100,
              dribbleTicks: 0,
              ballDribbleHeading: 0,
              ballDribbleSpeed: 0,
            };
            dribbleStates.set(payload.playerId, ds);
          }
        } else if (ev.kind === "second-touch") {
          const payload = ev.payload as { playerId?: string } | undefined;
          if (payload?.playerId) {
            const ds = dribbleStates.get(payload.playerId);
            if (ds) {
              ds.lastTurnTick = ev.tick;
            }
          }
        } else if (ev.kind === "ball-out-of-play" || ev.kind === "goal") {
          // End all active dribbles on ball-out-of-play or goal.
          for (const ds of dribbleStates.values()) {
            ds.active = false;
          }
        }
      }
      // Rebuild tackle phase bookkeeping from the ordered tackle events so a
      // restored checkpoint continues exactly like a continuous run.
      tackleStates.clear();
      for (const ev of state.events) {
        replayTackleEvent(tackleStates, ev);
      }
      // Re-derive eventCounter from state.events max sequence.
      let maxSeq = 0;
      for (const ev of state.events) {
        if (Number.isInteger(ev.sequence) && ev.sequence > maxSeq) {
          maxSeq = ev.sequence;
        }
      }
      eventCounter = maxSeq;
    },

    /**
     * Compute state hash of the committed world state.
     */
    stateHash(): string {
      return hashFnv1a64(
        encodeCanonical(freezeWorldState(state) as unknown as Record<string, unknown>),
      );
    },

    /**
     * Switch the controlled player for a given control slot.
     *
     * Updates `controlAssignments[slot].controlledPlayerId` on the
     * authoritative world state. The mutation is immediate and affects
     * the next tick's input resolution.
     */
    setControlledPlayer(controlSlot: string, nextPlayerId: string): void {
      const assignment = state.controlAssignments[controlSlot];
      if (!assignment) return;
      assignment.controlledPlayerId = nextPlayerId;
    },
  });
}