/**
 * @module @pes/adapters/input-browser/keyboard
 *
 * Browser keyboard adapter — samples keyboard state into normalized
 * tick-indexed InputFrames for the bootstrap control slot.
 *
 * Responsibilities:
 *  - Physical keyboard discovery and keydown/keyup edge tracking.
 *  - Digital-to-analog mapping (WASD/arrows → moveX/moveY normalized [-1..1]).
 *  - Button edge derivation (pressedButtons/releasedButtons) per tick.
 *  - Held-state tracking between ticks (heldButtons).
 *  - Tick assignment: sample() produces an InputFrame stamped with the
 *    current tick index.
 *  - Blur/reset: keyboard blur zeros all held state and clears edges.
 *
 * Constraints:
 *  - sourceId is "keyboard" — pure provenance, never affects gameplay.
 *  - moveX/moveY are normalized analog values.
 *  - sprint is analog [0..1].
 *  - This module lives in the browser adapter layer — it MAY use DOM
 *    events.  The simulation core MUST NOT import this module.
 *
 * No Math.random, Date, or Node I/O.
 */

import type { InputFrame, ActionBits } from "../../contracts/input.js";

// ---------------------------------------------------------------------------
// Key mapping configuration
// ---------------------------------------------------------------------------

/**
 * Keyboard-to-axis mapping.
 *
 * Each axis has a negative and positive key.  When both are held,
 * the axis reads 0 (neutral).  When only one is held, the axis
 * reads -1 or +1.  This is the standard digital-to-analog policy.
 */
export interface KeyboardAxisMapping {
  negative: string;
  positive: string;
}

/**
 * Keyboard-to-button mapping.
 *
 * Maps a key code string to an action bit index.
 */
export interface KeyboardButtonMapping {
  key: string;
  actionBit: number;
}

/**
 * Configuration for the keyboard adapter.
 */
export interface KeyboardAdapterConfig {
  /** The control slot this keyboard drives. */
  controlSlot: string;
  /** Horizontal axis mapping. */
  horizontalAxis: KeyboardAxisMapping;
  /** Vertical axis mapping. */
  verticalAxis: KeyboardAxisMapping;
  /** Sprint button mapping. */
  sprintButton: KeyboardButtonMapping;
  /** Action button mappings. */
  buttons: KeyboardButtonMapping[];
}

/**
 * Default keyboard configuration for the bootstrap.
 *
 * Uses WASD for movement and Space for sprint.
 * Action bits: bit 0 = first-touch, bit 1 = pass, bit 2 = shot, bit 3 = switch.
 */
export const DEFAULT_KEYBOARD_CONFIG: KeyboardAdapterConfig = {
  controlSlot: "slot-1",
  horizontalAxis: { negative: "KeyA", positive: "KeyD" },
  verticalAxis: { negative: "KeyS", positive: "KeyW" },
  sprintButton: { key: "ShiftLeft", actionBit: -1 }, // -1 = sprint, not an action bit
  buttons: [
    { key: "KeyK", actionBit: 0 }, // first-touch
    { key: "KeyJ", actionBit: 1 }, // pass
    { key: "KeyL", actionBit: 2 }, // shot
    { key: "Space", actionBit: 3 }, // switch
  ],
};

// ---------------------------------------------------------------------------
// Keyboard state tracking
// ---------------------------------------------------------------------------

/**
 * Internal state for the keyboard adapter.
 */
interface KeyboardState {
  /** Currently held keys (by key code). */
  heldKeys: Set<string>;
  /** Keys that were pressed since last sample(). */
  pressedKeys: Set<string>;
  /** Keys that were released since last sample(). */
  releasedKeys: Set<string>;
  /** Whether the keyboard has been blurred (all keys released). */
  blurred: boolean;
}

/**
 * Create a fresh keyboard state.
 */
function createKeyboardState(): KeyboardState {
  return {
    heldKeys: new Set<string>(),
    pressedKeys: new Set<string>(),
    releasedKeys: new Set<string>(),
    blurred: false,
  };
}

// ---------------------------------------------------------------------------
// Keyboard Adapter
// ---------------------------------------------------------------------------

/**
 * The keyboard adapter interface — the public API exposed to consumers.
 */
export interface KeyboardAdapter {
  /**
   * Sample the current keyboard state into an InputFrame for the given tick.
   *
   * This clears the pressed/released edges after sampling (they are
   * one-shot per tick).  If the keyboard was blurred since the last
   * sample, the frame is neutral (all zeros).
   *
   * @param tick - The simulation tick to assign to the frame.
   * @returns An InputFrame with normalized axes and derived edges.
   */
  sample(tick: number): InputFrame;

  /**
   * Get the current held buttons bitmask without clearing edges.
   *
   * Useful for diagnostics or presentation queries.
   */
  currentHeldButtons(): ActionBits;

  /**
   * Reset all keyboard state — equivalent to a blur event.
   *
   * Clears held keys, pressed/released edges, and the blur flag.
   * After reset, the next sample() produces a neutral frame.
   */
  reset(): void;

  /**
   * Get the current held keys (for debugging/diagnostics).
   */
  getHeldKeys(): ReadonlySet<string>;

  /**
   * Connect keyboard event listeners to the given target.
   *
   * @param target - The EventTarget (typically `window` or `document`).
   * @returns A cleanup function that removes all listeners.
   */
  connect(target: EventTarget): () => void;

  /**
   * Whether the adapter is connected to an event target.
   */
  readonly connected: boolean;
}

/**
 * Create a keyboard adapter.
 *
 * The adapter tracks keyboard state via event listeners and produces
 * normalized InputFrames on demand.  It does not poll the keyboard —
 * it reacts to keydown/keyup/blur events.
 *
 * @param config - Keyboard mapping configuration.
 * @returns A KeyboardAdapter instance.
 */
export function createKeyboardAdapter(
  config: KeyboardAdapterConfig = DEFAULT_KEYBOARD_CONFIG,
): KeyboardAdapter {
  const state = createKeyboardState();
  let connected = false;
  let cleanupFn: (() => void) | null = null;

  // Bound event handlers (stored for cleanup).
  function handleKeyDown(e: Event): void {
    const ke = e as KeyboardEvent;
    // Ignore repeated keydown events (key is already held).
    if (ke.repeat) return;
    state.heldKeys.add(ke.code);
    state.pressedKeys.add(ke.code);
    // Clear from released if it was released and pressed again in the same tick.
    state.releasedKeys.delete(ke.code);
    state.blurred = false;
  }

  function handleKeyUp(e: Event): void {
    const ke = e as KeyboardEvent;
    state.heldKeys.delete(ke.code);
    state.releasedKeys.add(ke.code);
    // Clear from pressed if it was pressed and released in the same tick.
    state.pressedKeys.delete(ke.code);
  }

  function handleBlur(): void {
    // Blur: all keys are considered released.
    state.heldKeys.clear();
    state.pressedKeys.clear();
    state.releasedKeys.clear();
    state.blurred = true;
  }

  // ------------------------------------------------------------------
  // Digital-to-analog mapping
  // ------------------------------------------------------------------

  /**
   * Read an axis value from the current held/pressed state.
   *
   * Returns -1, 0, or +1.  Both keys held = 0 (neutral).
   */
  function readAxis(mapping: KeyboardAxisMapping): number {
    const neg = state.heldKeys.has(mapping.negative);
    const pos = state.heldKeys.has(mapping.positive);
    if (neg && pos) return 0;
    if (neg) return -1;
    if (pos) return 1;
    return 0;
  }

  /**
   * Read the sprint button value [0..1].
   */
  function readSprint(mapping: KeyboardButtonMapping): number {
    return state.heldKeys.has(mapping.key) ? 1 : 0;
  }

  /**
   * Derive action bitmask from current held keys and edges.
   *
   * heldButtons: keys currently held that map to action bits.
   * pressedButtons: keys pressed this tick that map to action bits.
   * releasedButtons: keys released this tick that map to action bits.
   */
  function deriveButtons(): {
    heldButtons: ActionBits;
    pressedButtons: ActionBits;
    releasedButtons: ActionBits;
  } {
    let held = 0;
    let pressed = 0;
    let released = 0;

    for (const btn of config.buttons) {
      const bit = 1 << btn.actionBit;
      if (state.heldKeys.has(btn.key)) held |= bit;
      if (state.pressedKeys.has(btn.key)) pressed |= bit;
      if (state.releasedKeys.has(btn.key)) released |= bit;
    }

    return {
      heldButtons: held,
      pressedButtons: pressed,
      releasedButtons: released,
    };
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  const adapter: KeyboardAdapter = {
    sample(tick: number): InputFrame {
      // If blurred, produce a neutral frame and clear edges.
      if (state.blurred) {
        state.pressedKeys.clear();
        state.releasedKeys.clear();
        state.blurred = false;
        return {
          tick,
          sourceId: "keyboard",
          controlSlot: config.controlSlot,
          moveX: 0,
          moveY: 0,
          sprint: 0,
          heldButtons: 0,
          pressedButtons: 0,
          releasedButtons: 0,
        };
      }

      const moveX = readAxis(config.horizontalAxis);
      const moveY = readAxis(config.verticalAxis);
      const sprint = readSprint(config.sprintButton);
      const { heldButtons, pressedButtons, releasedButtons } = deriveButtons();

      // Clear one-shot edges after sampling.
      state.pressedKeys.clear();
      state.releasedKeys.clear();

      return {
        tick,
        sourceId: "keyboard",
        controlSlot: config.controlSlot,
        moveX,
        moveY,
        sprint,
        heldButtons,
        pressedButtons,
        releasedButtons,
      };
    },

    currentHeldButtons(): ActionBits {
      let held = 0;
      for (const btn of config.buttons) {
        if (state.heldKeys.has(btn.key)) {
          held |= 1 << btn.actionBit;
        }
      }
      return held;
    },

    reset(): void {
      state.heldKeys.clear();
      state.pressedKeys.clear();
      state.releasedKeys.clear();
      state.blurred = false;
    },

    getHeldKeys(): ReadonlySet<string> {
      return state.heldKeys;
    },

    connect(target: EventTarget): () => void {
      if (connected) {
        throw new Error("Keyboard adapter already connected");
      }
      target.addEventListener("keydown", handleKeyDown);
      target.addEventListener("keyup", handleKeyUp);
      target.addEventListener("blur", handleBlur);
      connected = true;
      cleanupFn = () => {
        target.removeEventListener("keydown", handleKeyDown);
        target.removeEventListener("keyup", handleKeyUp);
        target.removeEventListener("blur", handleBlur);
        connected = false;
        cleanupFn = null;
      };
      return cleanupFn;
    },

    get connected(): boolean {
      return connected;
    },
  };

  return adapter;
}
