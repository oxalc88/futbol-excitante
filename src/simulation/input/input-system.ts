/**
 * @module @pes/simulation/input/input-system
 *
 * Normalized tick-indexed input resolution.
 *
 * Responsibilities:
 *  - Validate InputFrames (range checks, tick/slot types).
 *  - Enforce one-frame-per-(tick, controlSlot) uniqueness across all calls.
 *  - Emit diagnostic events for duplicates and missing-input fallback.
 *  - Apply REPEAT_HELD_WITH_ZERO_EDGES policy from schedulerMemory.
 *  - Derive resolved input state (kinematic intent) without mutating it.
 *
 * sourceId is pure provenance — it never affects world hash or intent.
 *
 * No Math.random, Date, DOM, or Node I/O.
 */

import type { InputFrame } from "../../contracts/input.js";
import type { SimulationEvent } from "../../contracts/scenario.js";
import type { SchedulerMemory, PlayerState } from "../../contracts/state.js";
import { MISSING_INPUT_POLICY_REPEAT_HELD_WITH_ZERO_EDGES } from "../../contracts/input.js";
import { freezeWorldState } from "../world/clone.js";
import { checkFinite } from "../determinism/finite.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Resolved intent for one player on one tick — derived from input
 * or the missing-input policy.
 */
export interface ResolvedIntent {
  /** Player ID this intent belongs to. */
  playerId: string;
  /** Desired velocity vector (m/s). */
  desiredVelocity: { x: number; y: number };
  /** Desired heading in radians. */
  desiredHeading: number;
  /** Sprint multiplier (applied to maxSpeed). */
  sprint: number;
  /** Action bitmasks — only held/pressed/released edges matter. */
  heldButtons: number;
  pressedButtons: number;
  releasedButtons: number;
  /** Whether this is from a real frame or fallback. */
  source: "frame" | "repeat-held" | "neutral";
  /** The original frame (null for fallback/neutral). */
  frame: InputFrame | null;
}

/**
 * Diagnostic event created by input resolution.
 *
 * `kind` is "input-rejection" or "input-fallback".
 */
export interface InputDiagnosticEvent {
  id: string;
  tick: number;
  sequence: number;
  kind: "input-rejection" | "input-fallback";
  label: string;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate every field of an InputFrame.
 *
 * @returns true if valid.
 */
export function validateInputFrame(frame: InputFrame): boolean {
  if (!Number.isInteger(frame.tick) || frame.tick < 0) return false;
  if (typeof frame.sourceId !== "string" || frame.sourceId.length === 0) return false;
  if (typeof frame.controlSlot !== "string" || frame.controlSlot.length === 0) return false;
  if (
    !Number.isFinite(frame.moveX) ||
    frame.moveX < -1 ||
    frame.moveX > 1
  )
    return false;
  if (
    !Number.isFinite(frame.moveY) ||
    frame.moveY < -1 ||
    frame.moveY > 1
  )
    return false;
  if (
    !Number.isFinite(frame.sprint) ||
    frame.sprint < 0 ||
    frame.sprint > 1
  )
    return false;
  if (
    !Number.isInteger(frame.heldButtons) ||
    frame.heldButtons < 0
  )
    return false;
  if (
    !Number.isInteger(frame.pressedButtons) ||
    frame.pressedButtons < 0
  )
    return false;
  if (
    !Number.isInteger(frame.releasedButtons) ||
    frame.releasedButtons < 0
  )
    return false;
  return true;
}

// ---------------------------------------------------------------------------
// Uniqueness detection across buffers
// ---------------------------------------------------------------------------

/**
 * Check a new batch of frames against existing frames for duplicates.
 *
 * Returns (rejectFrames, okFrames) — rejectFrames carry a diagnostic.
 */
export function filterDuplicateFrames(
  newFrames: readonly InputFrame[],
  existingFrames: readonly InputFrame[],
): { rejectFrames: InputFrame[]; okFrames: InputFrame[] } {
  const seen = new Set<string>();
  for (const f of existingFrames) {
    seen.add(`${f.tick}:${f.controlSlot}`);
  }
  const reject: InputFrame[] = [];
  const ok: InputFrame[] = [];
  for (const f of newFrames) {
    const key = `${f.tick}:${f.controlSlot}`;
    if (seen.has(key)) {
      reject.push(f);
    } else {
      seen.add(key);
      ok.push(f);
    }
  }
  return { rejectFrames: reject, okFrames: ok };
}

// ---------------------------------------------------------------------------
// Missing-input policy: REPEAT_HELD_WITH_ZERO_EDGES
// ---------------------------------------------------------------------------

/**
 * Derive resolved intent for one player given its schedulerMemory.
 *
 * Policy:
 *  1. If a real frame exists → use it.
 *  2. If missing but schedulerMemory has a held frame and count < max → repeat
 *     with zero edges (REPEAT_HELD_WITH_ZERO_EDGES).
 *  3. If exceeded or no held frame → neutral input.
 *
 * @param slot - The control slot this player belongs to.
 */
export function resolveInputForPlayer(
  player: PlayerState,
  frameForSlot: InputFrame | undefined,
  schedulerMemory: SchedulerMemory,
  slot: string,
): { resolved: ResolvedIntent; events: SimulationEvent[] } {
  const events: SimulationEvent[] = [];

  if (frameForSlot) {
    // Real frame — record it for repeat-held fallback and reset counter.
    // Store only the non-sourceId fields so sourceId stays pure provenance.
    if (schedulerMemory.lastHeldFrames) {
      const f = frameForSlot;
      schedulerMemory.lastHeldFrames = {
        ...(schedulerMemory.lastHeldFrames ?? {}),
        [slot]: {
          moveX: f.moveX,
          moveY: f.moveY,
          sprint: f.sprint,
          heldButtons: f.heldButtons,
          pressedButtons: f.pressedButtons,
          releasedButtons: f.releasedButtons,
        },
      };
    }
    if (schedulerMemory.missingInputCounters) {
      const counters = { ...(schedulerMemory.missingInputCounters ?? {}) };
      delete counters[slot];
      schedulerMemory.missingInputCounters = counters;
    }
    return {
      resolved: {
        playerId: player.playerId,
        desiredVelocity: {
          x: frameForSlot.moveX,
          y: frameForSlot.moveY,
        },
        desiredHeading: 0,
        sprint: frameForSlot.sprint,
        heldButtons: frameForSlot.heldButtons,
        pressedButtons: frameForSlot.pressedButtons,
        releasedButtons: frameForSlot.releasedButtons,
        source: "frame",
        frame: frameForSlot,
      },
      events,
    };
  }

  // No frame — check fallback.
  const policyId = schedulerMemory.missingInputPolicyId;
  const maxMissing = schedulerMemory.maxConsecutiveMissing ?? 3;
  const counters = schedulerMemory.missingInputCounters ?? {};
  const count = counters[slot] ?? 0;
  const heldRaw = (schedulerMemory.lastHeldFrames ?? {})[slot] ?? null;
  const held: { moveX: number; moveY: number; sprint: number; heldButtons: number; pressedButtons: number; releasedButtons: number } | null = heldRaw;

  if (
    policyId === MISSING_INPUT_POLICY_REPEAT_HELD_WITH_ZERO_EDGES &&
    count < maxMissing &&
    held
  ) {
    // Repeat held with zero edges.
    const newCount = count + 1;
    schedulerMemory.missingInputCounters = { ...counters, [slot]: newCount };
    events.push({
      id: `input-fallback-${slot}-${schedulerMemory.missingInputPolicyId ?? "none"}`,
      tick: 0, // will be set by caller
      sequence: 0, // will be set by caller
      kind: "scheduler" as const,
      label: `Slot ${slot}: REPEAT_HELD_WITH_ZERO_EDGES (count ${newCount}/${maxMissing})`,
      payload: {
        slot,
        policyId: MISSING_INPUT_POLICY_REPEAT_HELD_WITH_ZERO_EDGES,
        count: newCount,
        maxMissing,
        pressedButtons: 0,
        releasedButtons: 0,
      },
    });
    // If the new count has reached/exceeded maxMissing, also emit neutral
    // for this tick.
    if (newCount >= maxMissing && held) {
      events.push({
        id: `input-neutral-fallback-${slot}`,
        tick: 0,
        sequence: 0,
        kind: "scheduler" as const,
        label: `Slot ${slot}: exceeded max consecutive missing → neutral`,
        payload: { slot, policyId, count: newCount, maxMissing },
      });
    }
    return {
      resolved: {
        playerId: player.playerId,
        desiredVelocity: { x: held.moveX, y: held.moveY },
        desiredHeading: 0,
        sprint: held.sprint,
        heldButtons: held.heldButtons,
        pressedButtons: 0,
        releasedButtons: 0,
        source: "repeat-held",
        frame: null,
      },
      events,
    };
  }

  // Exceeded or no held — neutral.
  if (count >= maxMissing && held) {
    // Log the transition to neutral.
    events.push({
      id: `input-neutral-fallback-${slot}`,
      tick: 0,
      sequence: 0,
      kind: "scheduler" as const,
      label: `Slot ${slot}: exceeded max consecutive missing → neutral`,
      payload: { slot, policyId, count, maxMissing },
    });
  }
  // Reset counter and held for next time.
  schedulerMemory.missingInputCounters = { ...counters, [slot]: 0 };
  if (schedulerMemory.lastHeldFrames) {
    schedulerMemory.lastHeldFrames = { ...(schedulerMemory.lastHeldFrames ?? {}), [slot]: null };
  }
  return {
    resolved: {
      playerId: player.playerId,
      desiredVelocity: { x: 0, y: 0 },
      desiredHeading: 0,
      sprint: 0,
      heldButtons: 0,
      pressedButtons: 0,
      releasedButtons: 0,
      source: "neutral",
      frame: null,
    },
    events,
  };
}

// ---------------------------------------------------------------------------
// Diagnostic event creation for duplicate rejection
// ---------------------------------------------------------------------------

/**
 * Create a diagnostic event for a rejected duplicate frame.
 */
export function createRejectionEvent(
  tick: number,
  frame: InputFrame,
  sequence: number,
): SimulationEvent {
  return {
    id: `input-dup-reject-${frame.controlSlot}-${tick}`,
    tick,
    sequence,
    kind: "input-rejection",
    label: `Duplicate input frame for (tick=${tick}, controlSlot="${frame.controlSlot}") — rejected`,
    payload: {
      rejectedTick: frame.tick,
      rejectedControlSlot: frame.controlSlot,
      rejectedSourceId: frame.sourceId,
      policy: "unique-per-tick-slot",
    },
  };
}

// ---------------------------------------------------------------------------
// Neutral input frame (for telemetry / fallback diagnostics)
// ---------------------------------------------------------------------------

/**
 * A canonical neutral input frame (all zeros).
 */
export const NEUTRAL_INPUT: InputFrame = Object.freeze({
  tick: 0,
  sourceId: "neutral",
  controlSlot: "neutral",
  moveX: 0,
  moveY: 0,
  sprint: 0,
  heldButtons: 0,
  pressedButtons: 0,
  releasedButtons: 0,
});