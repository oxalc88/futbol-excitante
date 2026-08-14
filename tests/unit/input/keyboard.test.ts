/**
 * @module keyboard-adapter-tests
 *
 * Tests for the browser keyboard adapter (BOOTSTRAP-11).
 *
 * Covers:
 *  - Opposing keys: both held = neutral, single held = ±1
 *  - Held state: held buttons persist between samples
 *  - Edge derivation: pressedButtons/releasedButtons are one-shot per tick
 *  - Blur/reset: blur clears all state, reset clears all state
 *  - Tick assignment: sample() produces frames with correct tick
 *  - Digital-to-analog mapping correctness
 *  - Action button bit derivation
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 * These tests exercise the adapter module which MAY use DOM-like APIs.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createKeyboardAdapter,
  DEFAULT_KEYBOARD_CONFIG,
} from "../../../src/adapters/input-browser/keyboard.js";
import type { KeyboardAdapter } from "../../../src/adapters/input-browser/keyboard.js";

// ---------------------------------------------------------------------------
// Helper: simulate keyboard events on an EventTarget
// ---------------------------------------------------------------------------

/**
 * Create a minimal EventTarget that dispatches keyboard-like events.
 *
 * Uses plain Event objects with a `code` property (not the real
 * KeyboardEvent constructor, which requires a DOM environment).
 * The keyboard adapter reads `e as KeyboardEvent` to access `.code`
 * and `.repeat`, so the mock must carry those properties.
 */
function createMockEventTarget(): EventTarget & {
  press(code: string): void;
  release(code: string): void;
  blur(): void;
} {
  const listeners = new Map<string, Set<EventListener>>();
  const held = new Set<string>();

  function makeEvent(type: string, props?: Record<string, unknown>): Event {
    const event = new Event(type);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        Object.defineProperty(event, k, { value: v, enumerable: true });
      }
    }
    return event;
  }

  const target = {
    addEventListener(
      type: string,
      listener: EventListener,
    ): void {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type)!.add(listener);
    },
    removeEventListener(
      type: string,
      listener: EventListener,
    ): void {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event: Event): boolean {
      const type = event.type;
      const set = listeners.get(type);
      if (set) {
        for (const fn of set) {
          fn(event);
        }
      }
      return true;
    },
    press(code: string): void {
      if (held.has(code)) return; // already held — simulate repeat
      held.add(code);
      target.dispatchEvent(makeEvent("keydown", { code, repeat: false }));
    },
    release(code: string): void {
      held.delete(code);
      target.dispatchEvent(makeEvent("keyup", { code }));
    },
    blur(): void {
      held.clear();
      target.dispatchEvent(makeEvent("blur"));
    },
  };

  return target as EventTarget & {
    press(code: string): void;
    release(code: string): void;
    blur(): void;
  };
}

// ===========================================================================
// 1. Opposing keys: both held = neutral, single held = ±1
// ===========================================================================

describe("KEYBOARD-OPPOSING-001: opposing axis keys", () => {
  let adapter: KeyboardAdapter;
  let target: ReturnType<typeof createMockEventTarget>;

  beforeEach(() => {
    adapter = createKeyboardAdapter();
    target = createMockEventTarget();
    adapter.connect(target);
  });

  it("no keys held → neutral (0, 0)", () => {
    const frame = adapter.sample(0);
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
  });

  it("only KeyD held → moveX = +1", () => {
    target.press("KeyD");
    const frame = adapter.sample(0);
    expect(frame.moveX).toBe(1);
    expect(frame.moveY).toBe(0);
  });

  it("only KeyA held → moveX = -1", () => {
    target.press("KeyA");
    const frame = adapter.sample(0);
    expect(frame.moveX).toBe(-1);
    expect(frame.moveY).toBe(0);
  });

  it("both KeyA and KeyD held → moveX = 0 (neutral)", () => {
    target.press("KeyA");
    target.press("KeyD");
    const frame = adapter.sample(0);
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
  });

  it("only KeyW held → moveY = +1", () => {
    target.press("KeyW");
    const frame = adapter.sample(0);
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(1);
  });

  it("only KeyS held → moveY = -1", () => {
    target.press("KeyS");
    const frame = adapter.sample(0);
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(-1);
  });

  it("both KeyW and KeyS held → moveY = 0 (neutral)", () => {
    target.press("KeyW");
    target.press("KeyS");
    const frame = adapter.sample(0);
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
  });

  it("KeyD + KeyW held → moveX = +1, moveY = +1", () => {
    target.press("KeyD");
    target.press("KeyW");
    const frame = adapter.sample(0);
    expect(frame.moveX).toBe(1);
    expect(frame.moveY).toBe(1);
  });

  it("KeyA + KeyS held → moveX = -1, moveY = -1", () => {
    target.press("KeyA");
    target.press("KeyS");
    const frame = adapter.sample(0);
    expect(frame.moveX).toBe(-1);
    expect(frame.moveY).toBe(-1);
  });
});

// ===========================================================================
// 2. Held state: held buttons persist between samples
// ===========================================================================

describe("KEYBOARD-HELD-001: held buttons persist between samples", () => {
  let adapter: KeyboardAdapter;
  let target: ReturnType<typeof createMockEventTarget>;

  beforeEach(() => {
    adapter = createKeyboardAdapter();
    target = createMockEventTarget();
    adapter.connect(target);
  });

  it("held key persists across multiple samples", () => {
    target.press("KeyD");
    const frame1 = adapter.sample(0);
    expect(frame1.moveX).toBe(1);

    // Sample again without releasing — still held.
    const frame2 = adapter.sample(1);
    expect(frame2.moveX).toBe(1);

    // Sample again — still held.
    const frame3 = adapter.sample(2);
    expect(frame3.moveX).toBe(1);
  });

  it("shift (sprint) persists across samples", () => {
    target.press("ShiftLeft");
    const frame1 = adapter.sample(0);
    expect(frame1.sprint).toBe(1);

    const frame2 = adapter.sample(1);
    expect(frame2.sprint).toBe(1);

    target.release("ShiftLeft");
    const frame3 = adapter.sample(2);
    expect(frame3.sprint).toBe(0);
  });

  it("action button held persists across samples", () => {
    target.press("KeyK"); // first-touch (bit 0)
    const frame1 = adapter.sample(0);
    expect(frame1.heldButtons & (1 << 0)).not.toBe(0);

    const frame2 = adapter.sample(1);
    expect(frame2.heldButtons & (1 << 0)).not.toBe(0);

    target.release("KeyK");
    const frame3 = adapter.sample(2);
    expect(frame3.heldButtons & (1 << 0)).toBe(0);
  });
});

// ===========================================================================
// 3. Edge derivation: pressedButtons/releasedButtons are one-shot
// ===========================================================================

describe("KEYBOARD-EDGES-001: pressed/released edges are one-shot per tick", () => {
  let adapter: KeyboardAdapter;
  let target: ReturnType<typeof createMockEventTarget>;

  beforeEach(() => {
    adapter = createKeyboardAdapter();
    target = createMockEventTarget();
    adapter.connect(target);
  });

  it("press event produces pressedButtons on first sample only", () => {
    target.press("KeyK"); // first-touch (bit 0)
    const frame1 = adapter.sample(0);
    expect(frame1.pressedButtons & (1 << 0)).not.toBe(0);
    expect(frame1.heldButtons & (1 << 0)).not.toBe(0);

    // Sample again — pressed should be cleared (one-shot).
    const frame2 = adapter.sample(1);
    expect(frame2.pressedButtons & (1 << 0)).toBe(0);
    expect(frame2.heldButtons & (1 << 0)).not.toBe(0);
  });

  it("release event produces releasedButtons on first sample only", () => {
    target.press("KeyK");
    adapter.sample(0); // consume the press

    target.release("KeyK");
    const frame1 = adapter.sample(1);
    expect(frame1.releasedButtons & (1 << 0)).not.toBe(0);
    expect(frame1.heldButtons & (1 << 0)).toBe(0);

    // Sample again — released should be cleared (one-shot).
    const frame2 = adapter.sample(2);
    expect(frame2.releasedButtons & (1 << 0)).toBe(0);
    expect(frame2.heldButtons & (1 << 0)).toBe(0);
  });

  it("press and release in same tick window: pressed clears released", () => {
    // Press and release before sampling.
    target.press("KeyK");
    target.release("KeyK");
    const frame = adapter.sample(0);
    // Released should be present, pressed should be cleared.
    expect(frame.releasedButtons & (1 << 0)).not.toBe(0);
    expect(frame.pressedButtons & (1 << 0)).toBe(0);
    expect(frame.heldButtons & (1 << 0)).toBe(0);
  });

  it("multiple buttons have independent edges", () => {
    target.press("KeyK"); // bit 0 (first-touch)
    target.press("KeyJ"); // bit 1 (pass)
    const frame1 = adapter.sample(0);
    expect(frame1.pressedButtons & (1 << 0)).not.toBe(0);
    expect(frame1.pressedButtons & (1 << 1)).not.toBe(0);

    target.release("KeyK");
    const frame2 = adapter.sample(1);
    expect(frame2.releasedButtons & (1 << 0)).not.toBe(0);
    expect(frame2.pressedButtons & (1 << 1)).toBe(0);
    expect(frame2.heldButtons & (1 << 1)).not.toBe(0);
  });
});

// ===========================================================================
// 4. Blur/reset: clears all state
// ===========================================================================

describe("KEYBOARD-BLUR-001: blur clears all keyboard state", () => {
  let adapter: KeyboardAdapter;
  let target: ReturnType<typeof createMockEventTarget>;

  beforeEach(() => {
    adapter = createKeyboardAdapter();
    target = createMockEventTarget();
    adapter.connect(target);
  });

  it("blur produces neutral frame", () => {
    target.press("KeyD");
    target.press("KeyW");
    target.press("ShiftLeft");
    target.press("KeyK");

    // Blur — all keys released.
    target.blur();

    const frame = adapter.sample(0);
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
    expect(frame.sprint).toBe(0);
    expect(frame.heldButtons).toBe(0);
    expect(frame.pressedButtons).toBe(0);
    expect(frame.releasedButtons).toBe(0);
  });

  it("blur flag is cleared after sample", () => {
    target.press("KeyD");
    target.blur();

    // First sample after blur — neutral.
    const frame1 = adapter.sample(0);
    expect(frame1.moveX).toBe(0);

    // Press again — should work.
    target.press("KeyD");
    const frame2 = adapter.sample(1);
    expect(frame2.moveX).toBe(1);
  });
});

describe("KEYBOARD-RESET-001: reset clears all keyboard state", () => {
  let adapter: KeyboardAdapter;
  let target: ReturnType<typeof createMockEventTarget>;

  beforeEach(() => {
    adapter = createKeyboardAdapter();
    target = createMockEventTarget();
    adapter.connect(target);
  });

  it("reset produces neutral frame", () => {
    target.press("KeyD");
    target.press("ShiftLeft");
    target.press("KeyK");

    adapter.reset();

    const frame = adapter.sample(0);
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
    expect(frame.sprint).toBe(0);
    expect(frame.heldButtons).toBe(0);
  });

  it("reset clears held keys set", () => {
    target.press("KeyD");
    target.press("KeyW");
    expect(adapter.getHeldKeys().size).toBe(2);

    adapter.reset();
    expect(adapter.getHeldKeys().size).toBe(0);
  });
});

// ===========================================================================
// 5. Tick assignment: sample() produces frames with correct tick
// ===========================================================================

describe("KEYBOARD-TICK-001: sample() assigns tick correctly", () => {
  let adapter: KeyboardAdapter;
  let target: ReturnType<typeof createMockEventTarget>;

  beforeEach(() => {
    adapter = createKeyboardAdapter();
    target = createMockEventTarget();
    adapter.connect(target);
  });

  it("tick 0", () => {
    const frame = adapter.sample(0);
    expect(frame.tick).toBe(0);
  });

  it("tick 42", () => {
    const frame = adapter.sample(42);
    expect(frame.tick).toBe(42);
  });

  it("tick 999999", () => {
    const frame = adapter.sample(999999);
    expect(frame.tick).toBe(999999);
  });

  it("multiple samples with different ticks", () => {
    const frame0 = adapter.sample(0);
    const frame1 = adapter.sample(1);
    const frame2 = adapter.sample(2);
    expect(frame0.tick).toBe(0);
    expect(frame1.tick).toBe(1);
    expect(frame2.tick).toBe(2);
  });
});

// ===========================================================================
// 6. SourceId and controlSlot
// ===========================================================================

describe("KEYBOARD-META-001: sourceId and controlSlot", () => {
  let adapter: KeyboardAdapter;

  beforeEach(() => {
    adapter = createKeyboardAdapter();
  });

  it("sourceId is always 'keyboard'", () => {
    const frame = adapter.sample(0);
    expect(frame.sourceId).toBe("keyboard");
  });

  it("controlSlot matches config", () => {
    const frame = adapter.sample(0);
    expect(frame.controlSlot).toBe("slot-1");
  });

  it("custom controlSlot", () => {
    const custom = createKeyboardAdapter({
      ...DEFAULT_KEYBOARD_CONFIG,
      controlSlot: "player-2",
    });
    const frame = custom.sample(0);
    expect(frame.controlSlot).toBe("player-2");
  });
});

// ===========================================================================
// 7. Sprint button mapping
// ===========================================================================

describe("KEYBOARD-SPRINT-001: sprint button mapping", () => {
  let adapter: KeyboardAdapter;
  let target: ReturnType<typeof createMockEventTarget>;

  beforeEach(() => {
    adapter = createKeyboardAdapter();
    target = createMockEventTarget();
    adapter.connect(target);
  });

  it("ShiftLeft held → sprint = 1", () => {
    target.press("ShiftLeft");
    const frame = adapter.sample(0);
    expect(frame.sprint).toBe(1);
  });

  it("ShiftLeft released → sprint = 0", () => {
    target.press("ShiftLeft");
    adapter.sample(0);
    target.release("ShiftLeft");
    const frame = adapter.sample(1);
    expect(frame.sprint).toBe(0);
  });
});

// ===========================================================================
// 8. Current held buttons query
// ===========================================================================

describe("KEYBOARD-QUERY-001: currentHeldButtons()", () => {
  let adapter: KeyboardAdapter;
  let target: ReturnType<typeof createMockEventTarget>;

  beforeEach(() => {
    adapter = createKeyboardAdapter();
    target = createMockEventTarget();
    adapter.connect(target);
  });

  it("no keys held → 0", () => {
    expect(adapter.currentHeldButtons()).toBe(0);
  });

  it("KeyK held → bit 0 set", () => {
    target.press("KeyK");
    expect(adapter.currentHeldButtons() & (1 << 0)).not.toBe(0);
  });

  it("KeyK + KeyJ held → bits 0 and 1 set", () => {
    target.press("KeyK");
    target.press("KeyJ");
    const held = adapter.currentHeldButtons();
    expect(held & (1 << 0)).not.toBe(0);
    expect(held & (1 << 1)).not.toBe(0);
  });
});

// ===========================================================================
// 9. Connect/disconnect lifecycle
// ===========================================================================

describe("KEYBOARD-CONNECT-001: connect/disconnect lifecycle", () => {
  it("connect returns a cleanup function", () => {
    const adapter = createKeyboardAdapter();
    const target = createMockEventTarget();
    const cleanup = adapter.connect(target);
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("connected property reflects state", () => {
    const adapter = createKeyboardAdapter();
    const target = createMockEventTarget();
    expect(adapter.connected).toBe(false);
    const cleanup = adapter.connect(target);
    expect(adapter.connected).toBe(true);
    cleanup();
    expect(adapter.connected).toBe(false);
  });

  it("double connect throws", () => {
    const adapter = createKeyboardAdapter();
    const target = createMockEventTarget();
    adapter.connect(target);
    expect(() => adapter.connect(target)).toThrow(/already connected/);
    // Cleanup to avoid leak.
    adapter.connect; // just to reference it
  });
});

// ===========================================================================
// 10. Default configuration
// ===========================================================================

describe("KEYBOARD-CONFIG-001: default configuration", () => {
  it("DEFAULT_KEYBOARD_CONFIG has expected controlSlot", () => {
    expect(DEFAULT_KEYBOARD_CONFIG.controlSlot).toBe("slot-1");
  });

  it("DEFAULT_KEYBOARD_CONFIG has horizontal and vertical axes", () => {
    expect(DEFAULT_KEYBOARD_CONFIG.horizontalAxis.negative).toBe("KeyA");
    expect(DEFAULT_KEYBOARD_CONFIG.horizontalAxis.positive).toBe("KeyD");
    expect(DEFAULT_KEYBOARD_CONFIG.verticalAxis.negative).toBe("KeyS");
    expect(DEFAULT_KEYBOARD_CONFIG.verticalAxis.positive).toBe("KeyW");
  });

  it("DEFAULT_KEYBOARD_CONFIG has sprint button", () => {
    expect(DEFAULT_KEYBOARD_CONFIG.sprintButton.key).toBe("ShiftLeft");
  });

  it("DEFAULT_KEYBOARD_CONFIG has action buttons", () => {
    expect(DEFAULT_KEYBOARD_CONFIG.buttons.length).toBe(4);
  });

  it("KeyJ maps to PASS_BIT (actionBit 1)", () => {
    const passBtn = DEFAULT_KEYBOARD_CONFIG.buttons.find((b) => b.key === "KeyJ");
    expect(passBtn).toBeDefined();
    expect(passBtn!.actionBit).toBe(1);
  });

  it("KeyK maps to FIRST_TOUCH (actionBit 0)", () => {
    const ftBtn = DEFAULT_KEYBOARD_CONFIG.buttons.find((b) => b.key === "KeyK");
    expect(ftBtn).toBeDefined();
    expect(ftBtn!.actionBit).toBe(0);
  });
});
