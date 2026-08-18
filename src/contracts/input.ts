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
 *
 * Bit 1: PASS — the player intends to pass the ball along body heading
 * on the current tick. Pressed while within contact radius of the ball.
 * The contact system resolves the actual pass; pressing this bit does
 * not guarantee a pass occurs (range, timing, and priority govern).
 *
 * Bit 2: SHOT — the player intends to shoot the ball with a stronger
 * lofted impulse along body heading. Pressed while within contact
 * radius of the ball. The contact system resolves the actual shot;
 * pressing this bit does not guarantee a shot occurs (range, timing,
 * and priority govern).
 *
 * Bit 3: SWITCH_PLAYER — request switching controlled player to the
 * next eligible teammate. Edge-triggered.
 *
 * Bit 4: LOFTED_PASS — directed lofted/chip pass. Higher vertical
 * component for lofted trajectory. Provisional.
 */
export const FIRST_TOUCH_BIT = 1 << 0;

/**
 * PASS_BIT: directed pass action. The controlled player applies an
 * impulse along body heading to the ball, emitting an ordered pass
 * event. The ball remains an independent 3D entity.
 */
export const PASS_BIT = 1 << 1;

/**
 * SHOT_BIT: directed shot action. The controlled player applies a
 * stronger lofted impulse along body heading to the ball, emitting
 * an ordered shot event. The ball remains an independent 3D entity.
 */
export const SHOT_BIT = 1 << 2;

/**
 * SWITCH_PLAYER_BIT: request switching controlled player to the next
 * eligible teammate. Edge-triggered — each press advances to the next
 * teammate on the same team (excluding goalkeeper, if any).
 * Processed at the adapter layer; does not affect simulation internals.
 */
export const SWITCH_PLAYER_BIT = 1 << 3;

/**
 * LOFTED_PASS_BIT: directed lofted/chip pass action. The controlled
 * player applies a pass impulse with a higher vertical component,
 * producing a lofted trajectory. Pressed while within contact radius
 * of the ball. The contact system resolves the actual lofted pass;
 * pressing this bit does not guarantee a pass occurs.
 *
 * Provisional — not a PES 2017 calibration claim.
 */
export const LOFTED_PASS_BIT = 1 << 4;

/**
 * THROUGH_BALL_BIT: through-ball action. The controlled player plays
 * the ball into open space ahead of the best forward teammate rather
 * than directly to their feet, allowing the teammate to run onto it.
 * Pressed while within contact radius of the ball. The contact system
 * resolves the actual through-ball; pressing this bit does not guarantee
 * a through-ball occurs (range, timing, and priority govern).
 *
 * Provisional — not a PES 2017 calibration claim.
 */
export const THROUGH_BALL_BIT = 1 << 5;

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