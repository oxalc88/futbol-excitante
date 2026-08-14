/** @module @pes/contracts/input - Normalized tick-indexed input contracts. */

/** 8-bit action bitmask. Each bit represents one action. */
export type ActionBits = number;

/**
 * Action-bit constants. Each constant represents a single bit position
 * in the heldButtons / pressedButtons / releasedButtons masks.
 *
 * Bit 0: FIRST_TOUCH — the player intends to receive/control the ball
 * on the current tick. Pressed while within contact radius of the ball.
 * The contact system resolves the actual touch; pressing this bit does
 * not guarantee a touch occurs (range, timing, and priority govern).
 */
export const FIRST_TOUCH_BIT = 1 << 0;

/**
 * A tick-indexed input frame from any source (keyboard, gamepad, replay, AI, test).
 *
 * sourceId is provenance only — it must never affect gameplay outcomes,
 * canonical world state, or state hashes.
 */
export interface InputFrame {
  /** Simulation tick this frame targets (0-based). */
  tick: number;
  /** Provenance identifier of the producing device/adapter. Opaque. */
  sourceId: string;
  /** Stable slot that owns this frame's controls. */
  controlSlot: string;
  /** Horizontal movement axis, clamped to [-1, 1]. */
  moveX: number;
  /** Vertical movement axis, clamped to [-1, 1]. */
  moveY: number;
  /** Sprint analog value, clamped to [0, 1]. */
  sprint: number;
  /** Actions currently held (bitmask). */
  heldButtons: ActionBits;
  /** Actions newly pressed this tick (bitmask). */
  pressedButtons: ActionBits;
  /** Actions newly released this tick (bitmask). */
  releasedButtons: ActionBits;
}

/**
 * Missing-input policy that repeats the last held action value while
 * zeroing pressed/released edges. Bounded by a configured max count
 * before falling through to neutral input.
 *
 * Constant name only — the policy memory lives on WorldState.
 */
export const MISSING_INPUT_POLICY_REPEAT_HELD_WITH_ZERO_EDGES =
  "REPEAT_HELD_WITH_ZERO_EDGES" as const;

/** A missing-input policy identifier. */
export type MissingInputPolicyId = typeof MISSING_INPUT_POLICY_REPEAT_HELD_WITH_ZERO_EDGES;

/**
 * Control assignment for a stable slot. This is match-level state,
 * not a player field.
 */
export interface ControlSlotAssignment {
  /** Team ID controlled by this slot. */
  teamId: string;
  /** Player ID currently controlled, or null for empty slot. */
  controlledPlayerId: string | null;
  /** Control mode. */
  mode: "HUMAN" | "AI_FALLBACK";
}

/**
 * Global control-assignment state, keyed by stable slot.
 */
export interface ControlAssignmentState {
  bySlot: Record<string, ControlSlotAssignment>;
}

/**
 * A tick-indexed command to change control assignments.
 */
export interface ControlAssignmentCommand {
  /** Tick at which this command takes effect. */
  tick: number;
  /** Stable slot this command targets. */
  controlSlot: string;
  /** Contiguous sequence within the slot (starts at 0). */
  commandSequence: number;
  kind: "CLAIM_TEAM" | "REQUEST_PLAYER_SWITCH" | "SET_AI_FALLBACK";
  teamId?: string;
  requestedPlayerId?: string;
  switchDirection?: "NEXT" | "PREVIOUS" | "AUTO_POLICY";
}