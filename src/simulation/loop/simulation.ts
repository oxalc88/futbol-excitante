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
import {
  validateInputFrame,
  filterDuplicateFrames,
  resolveInputForPlayer,
  createRejectionEvent,
  NEUTRAL_INPUT,
} from "../input/input-system.js";
import { stepLocomotion } from "../locomotion/locomotion-system.js";
import { stepBall } from "../ball/ball-system.js";
import { stepContacts } from "../contacts/contact-system.js";
import { stepPlayerContacts } from "../player-contact/player-contact-system.js";
import {
  FOUNDATION_LOCOMOTION_V1,
  FOUNDATION_BALL_V1,
  FOUNDATION_CLOSE_CONTROL_V1,
  FOUNDATION_PLAYER_CONTACT_V1,
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
 * @returns A simulation instance.
 */
export function createSimulation(
  world: WorldState,
  observer?: SimulationObserver,
  locomotionConfigOverride?: typeof FOUNDATION_LOCOMOTION_V1,
  contactConfigOverride?: typeof FOUNDATION_PLAYER_CONTACT_V1,
  shotConfigOverride?: ShotConfigOverride,
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

  // Shot config override (used by capability evaluation for low vs high exitSpeed).
  // Lives in the closure; does not affect world state or hashing.
  const effectiveShotConfig = shotConfigOverride ?? undefined;

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

    // --- Cross-call duplicate detection --------------------------------
    const allBuffered = flattenInputBuffers();
    // Remove frames belonging to targetTick from allBuffered (they are in framesForTick).
    const priorBuffered = allBuffered.filter(
      (f) => f.tick !== targetTick,
    );

    // Filter duplicates: new frames that conflict with prior buffers.
    const { rejectFrames, okFrames } = filterDuplicateFrames(
      framesForTick,
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

    // For each player, check if there is a frame for its control slot.
    // In the bootstrap we use the first control slot from the scenario.
    for (const player of state.players) {
      // Find the slot that controls this player from controlAssignments.
      const slot = findControlSlotForPlayer(player.playerId);
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

  /**
   * Find the controlSlot that controls the given playerId.
   *
   * Uses the authoritative controlAssignments stored on WorldState.
   */
  function findControlSlotForPlayer(playerId: string): string | null {
    const assignments = state.controlAssignments;
    if (!assignments) return null;
    for (const slot of Object.keys(assignments)) {
      if ((assignments[slot] as { controlledPlayerId?: string })?.controlledPlayerId === playerId) {
        return slot;
      }
    }
    return null;
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
    const events = stepBall(state.ball, dt, FOUNDATION_BALL_V1, counter, state.tick);
    eventCounter = counter.value;
    return events;
  }

  /**
   * Stage: player-ball contact detection and resolution.
   *
   * Runs AFTER locomotion (players at tick-advanced positions) and
   * BEFORE ball integration (ball still has pre-step velocity).
   * Detects proximity + FIRST_TOUCH/PASS/SHOT input, applies impulse
   * to ball, emits ordered player-ball-contact/pass/shot events,
   * and updates lastTouchRef.
   */
  function contactDetectionStage(framesForTick: InputFrame[]): SimulationEvent[] {
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
        return {
          playerId: p.playerId,
          teamId: p.teamId,
          groundPosition: { x: p.groundPosition.x, y: p.groundPosition.y },
          bodyHeading: p.bodyHeading,
          speed,
          locomotionPhase: "idle",
          isControlled: controlledPlayerIds.has(p.playerId),
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
     * Buffer input frames. Duplicates across all buffered ticks are detected eagerly.
     *
     * Duplicates for the same (tick, controlSlot) are rejected with a thrown
     * error listing all conflicting frames. The error is not resolved by
     * arrival order — both frames are reported so the caller can decide.
     *
     * @param frames - Input frames; validation is strict.
     * @throws {Error} on invalid frame or duplicate (tick, controlSlot).
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

      // Eager duplicate detection per batch.
      const intraSeen = new Set<string>();
      for (const frame of frames) {
        const key = `${frame.tick}:${frame.controlSlot}`;
        if (intraSeen.has(key)) {
          throw new Error(
            `Duplicate input frame for (tick=${frame.tick}, controlSlot="${frame.controlSlot}") within batch`,
          );
        }
        intraSeen.add(key);
      }

      // Cross-call duplicate detection against all buffered frames.
      const allBuffered = flattenInputBuffers();
      const { rejectFrames } = filterDuplicateFrames(frames, allBuffered);
      if (rejectFrames.length > 0) {
        const details = rejectFrames.map(
          (r) => `(tick=${r.tick}, controlSlot="${r.controlSlot}")`,
        );
        throw new Error(
          `Duplicate input frame across calls: ${details.join(", ")}`,
        );
      }

      // Buffer by tick.
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

      // 4.5. Player-ball contact detection (after locomotion, before ball integration)
      const contactEvents = contactDetectionStage(currentFrames);
      for (const ev of contactEvents) {
        state.events = [...state.events, ev];
      }

      // 5. Ball integration
      const ballEvents = ballIntegrationStage();
      for (const ev of ballEvents) {
        state.events = [...state.events, ev];
      }

      // 6. Invariant validation
      const invariantsOk = validateInvariants();
      const allStepEvents = [...oldTickEvents, ...schedEvents, ...playerContactEvents, ...contactEvents, ...ballEvents];
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
  });
}