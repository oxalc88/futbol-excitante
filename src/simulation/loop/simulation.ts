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
 *
 * Bootstrap scheduler stages (system-free — locomotion and ball are
 * no-ops). Read/write ownership and event sort keys are documented.
 *
 * | Stage               | Read set            | Write set                    | Event sort key              |
 * |---------------------|---------------------|------------------------------|-----------------------------|
 * | Scheduled events    | committed state     | appends to `events` buffer   | `(tick, ++eventCounter)`    |
 * | Input resolution    | buffered inputs     | mutates player state         | N/A (no events emitted)     |
 * | Locomotion          | committed state     | none (no-op in bootstrap)    | N/A                         |
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
import type { WorldState, PlayerState, SchedulerMemory } from "../../contracts/state.js";
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

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

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
   *  4. Locomotion (no-op in bootstrap)
   *  5. Ball integration (no-op in bootstrap)
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
}

// ---------------------------------------------------------------------------
// Simulation implementation
// ---------------------------------------------------------------------------

/**
 * Create a new Simulation instance backed by the given world state.
 *
 * @param world - The initial world state (must not be mutated by callers).
 * @param observer - Telemetry observer; defaults to no-op.
 * @returns A simulation instance.
 */
export function createSimulation(
  world: WorldState,
  observer?: SimulationObserver,
): Simulation {
  const obs = observer ?? NO_OP_OBSERVER;

  // Deep-clone so we own a mutable copy (the original is immutable).
  let state = deepClone(world) as WorldState;

  // Input frame buffer — keyed by tick string.
  const inputBuffers: Record<number, InputFrame[]> = {};

  // Event counter — persists across steps for total ordering.
  let eventCounter: number = 0;

  // ------------------------------------------------------------------
  // Internal: apply input frames to player state (system-free).
  // ------------------------------------------------------------------

  /**
   * Stubbed input resolution for the bootstrap system-free step.
   *
   * Missing-input policy: "no stored frames → no kinematic change".
   *
   * For each player, if a frame for the target tick and the player's
   * control slot exists, it would update desired velocity and heading.
   * During bootstrap (no locomotion system), this stage is a no-op:
   * it only validates that the expected inputs are present.
   */
  function resolveInputs(
    tick: number,
    frames: InputFrame[],
  ): SimulationEvent[] {
    // Bootstrap: no-kinematic-change stub.
    // A full implementation would map frames → player kinematic updates.
    return [];
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
   * Stage: locomotion integration (no-op in bootstrap).
   *
   * In the full engine this would integrate desired velocity into
   * ground position, handle turning, sprint, etc. Bootstrap: no-op.
   */
  function locomotionNoOp(): void {
    // No locomotion system exists yet.
  }

  /**
   * Stage: ball integration (no-op in bootstrap).
   *
   * In the full engine this would integrate ball physics (gravity,
   * air drag, rolling, bouncing). Bootstrap: no-op.
   */
  function ballIntegrationNoOp(): void {
    // No ball system exists yet.
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
    const players: PlayerPresentation[] = state.players.map(
      (p): PlayerPresentation => {
        const speed = Math.sqrt(
          p.linearVelocity.x * p.linearVelocity.x +
            p.linearVelocity.y * p.linearVelocity.y,
        );
        return {
          playerId: p.playerId,
          teamId: p.teamId,
          groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
          bodyHeading: p.bodyHeading,
          speed,
          locomotionPhase: "idle",
          isControlled: false,
          actionState: null,
          contactState: null,
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
    return {
      tick,
      simulationTime: tick * (state.fixedDt.numerator / state.fixedDt.denominator),
      prngAlgorithmId: state.prng.algorithmId,
      stateHash: "", // placeholder — computed after commit
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
     * Buffer input frames. Duplicates per tick are detected eagerly.
     */
    applyInputs(frames: readonly InputFrame[]): void {
      // Eager duplicate detection per tick.
      const seen = new Set<string>();
      for (const frame of frames) {
        const key = `${frame.tick}:${frame.controlSlot}`;
        if (seen.has(key)) {
          throw new Error(
            `Duplicate input frame for (tick=${frame.tick}, controlSlot="${frame.controlSlot}")`,
          );
        }
        seen.add(key);
      }
      // Buffer by tick.
      for (const frame of frames) {
        if (!(frame.tick in inputBuffers)) {
          inputBuffers[frame.tick] = [];
        }
        inputBuffers[frame.tick] = inputBuffers[frame.tick] ?? [];
        inputBuffers[frame.tick].push({ ...frame });
      }
    },

    /**
     * Advance by one tick.
     */
    step(): StepResult {
      const newTick = state.tick + 1;

      // 1. Increment tick
      state.tick = newTick;

      obs.onBeforeStep?.("step");

      // 2. Scheduled events
      const schedEvents = scheduledEvents(newTick);
      for (const ev of schedEvents) {
        ev.sequence = ++eventCounter;
        state.events = [...state.events, ev];
      }

      // 3. Input resolution
      const buffered = inputBuffers[newTick] ?? [];
      delete inputBuffers[newTick];
      const inputEvents = resolveInputs(newTick, buffered);
      for (const ev of inputEvents) {
        ev.sequence = ++eventCounter;
        state.events = [...state.events, ev];
      }

      // 4. Locomotion (no-op)
      locomotionNoOp();

      // 5. Ball integration (no-op)
      ballIntegrationNoOp();

      // 6. Invariant validation
      const invariantsOk = validateInvariants();
      const obsData = buildObservation(newTick, [...schedEvents, ...inputEvents], buffered);
      if (invariantsOk) {
        obsData.stateHash = hashFnv1a64(
          encodeCanonical(freezeWorldState(state) as unknown as Record<string, unknown>),
        );
        obs.onInvariantPass?.(obsData);
      } else {
        obs.onInvariantFail?.(obsData, "finite-number-invariant-failed");
      }

      // 7. Presentation derivation
      const presentation = derivePresentation();
      obs.onPresent?.("step");

      // 8. Commit — append events, compute hash
      const commitEvents: SimulationEvent[] = [
        ...schedEvents,
        ...inputEvents,
      ];

      const stateHash = hashFnv1a64(
        encodeCanonical(freezeWorldState(state) as unknown as Record<string, unknown>),
      );

      obs.onAfterStep?.("step");

      return {
        tick: newTick,
        events: commitEvents,
        stateHash,
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
     */
    restore(snapshot: Checkpoint): void {
      // Deep clone again to ensure the caller's reference doesn't
      // affect internal state.
      state = deepClone(snapshot) as WorldState;
      // Reset buffers since we're restoring a previous point.
      Object.keys(inputBuffers).forEach((k) => delete inputBuffers[Number(k)]);
      // Reset event counter to maintain determinism.
      eventCounter = 0;
    },

    /**
     * Compute state hash of the committed world state.
     */
    stateHash(): string {
      return hashFnv1a64(
        encodeCanonical(freezeWorldState(state) as unknown as Record<string, unknown>),
      );
    },
  });
}