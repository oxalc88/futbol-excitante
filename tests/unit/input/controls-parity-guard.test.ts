/**
 * Binding/parity guard — BROWSER-DEFENSIVE-CONTROLS-LEGEND
 *
 * Asserts that every control in the shared controls legend has a live
 * binding in the browser keyboard adapter config (DEFAULT_KEYBOARD_CONFIG).
 *
 * Discriminating negative controls:
 *  - Removing a binding from the config → guard FAILS (missing binding).
 *  - Removing a legend entry → guard FAILS (legend/binding mismatch).
 *
 * Both directions of drift are detected.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect } from "vitest";
import { CONTROLS_LEGEND } from "../../../src/contracts/controls-legend.js";
import type { ControlLegendEntry } from "../../../src/contracts/controls-legend.js";
import { DEFAULT_KEYBOARD_CONFIG } from "../../../src/adapters/input-browser/keyboard.js";
import type { KeyboardAdapterConfig } from "../../../src/adapters/input-browser/keyboard.js";

// ---------------------------------------------------------------------------
// Parity check: does a legend entry have a matching live binding?
// ---------------------------------------------------------------------------

/**
 * Map display key names to KeyboardEvent.code values for config matching.
 */
const KEY_DISPLAY_TO_CODE: Record<string, string> = {
  "W": "KeyW", "A": "KeyA", "S": "KeyS", "D": "KeyD",
  "K": "KeyK", "J": "KeyJ", "L": "KeyL", "U": "KeyU", "I": "KeyI",
  "E": "KeyE", "Q": "KeyQ",
  "Tab": "Tab", "Shift": "ShiftLeft",
};

/**
 * Check whether a single legend entry is satisfied by the keyboard config.
 */
function entryHasLiveBinding(
  entry: ControlLegendEntry,
  config: KeyboardAdapterConfig,
): { ok: boolean; reason: string } {
  // Modifier combos (e.g. "E+J", "Q+J") — bindingKey contains "+"
  if (entry.bindingKey.includes("+")) {
    const parts = entry.bindingKey.split("+");
    const modifierCode = KEY_DISPLAY_TO_CODE[parts[0]] ?? parts[0];
    const buttonCode = KEY_DISPLAY_TO_CODE[parts[1]] ?? parts[1];

    const modifier = config.buttonModifiers?.find(
      (m) => m.modifierKey === modifierCode,
    );
    if (!modifier) {
      return { ok: false, reason: `modifier key ${modifierCode} not found in buttonModifiers` };
    }

    const button = config.buttons.find((b) => b.key === buttonCode);
    if (!button) {
      return { ok: false, reason: `button key ${buttonCode} not found in buttons` };
    }

    if (modifier.targetActionBit !== button.actionBit) {
      return {
        ok: false,
        reason: `modifier targetActionBit (${modifier.targetActionBit}) !== button actionBit (${button.actionBit})`,
      };
    }

    const expectedBitPosition = Math.log2(entry.expectedBitmask);
    if (modifier.modifiedActionBit !== expectedBitPosition) {
      return {
        ok: false,
        reason: `modifier modifiedActionBit (${modifier.modifiedActionBit}) !== expected bit position (${expectedBitPosition})`,
      };
    }

    return { ok: true, reason: "" };
  }

  // Non-action-bit controls (axis/sprint, expectedBitmask === -1)
  if (entry.expectedBitmask === -1) {
    const code = KEY_DISPLAY_TO_CODE[entry.bindingKey] ?? entry.bindingKey;
    const inAxis =
      config.horizontalAxis.negative === code ||
      config.horizontalAxis.positive === code ||
      config.verticalAxis.negative === code ||
      config.verticalAxis.positive === code;
    const inSprint = config.sprintButton.key === code;

    if (inAxis || inSprint) {
      return { ok: true, reason: "" };
    }
    return { ok: false, reason: `key ${code} not found in axes or sprint button` };
  }

  // Action-bit controls: find the button with matching key and verify bit.
  const code = KEY_DISPLAY_TO_CODE[entry.bindingKey] ?? entry.bindingKey;
  const button = config.buttons.find((b) => b.key === code);
  if (!button) {
    return { ok: false, reason: `key ${code} not found in buttons[]` };
  }

  const expectedBitPosition = Math.log2(entry.expectedBitmask);
  if (button.actionBit !== expectedBitPosition) {
    return {
      ok: false,
      reason: `button actionBit (${button.actionBit}) !== expected bit position (${expectedBitPosition})`,
    };
  }

  return { ok: true, reason: "" };
}

// ---------------------------------------------------------------------------
// Positive guard: every legend entry has a live binding
// ---------------------------------------------------------------------------

describe("CONTROLS-PARITY-001: every legend entry has a live binding", () => {
  for (const entry of CONTROLS_LEGEND) {
    it(`legend entry "${entry.label}" (${entry.keyDisplay}) matches live binding`, () => {
      const result = entryHasLiveBinding(entry, DEFAULT_KEYBOARD_CONFIG);
      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(`Parity failure for "${entry.label}": ${result.reason}`);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Count parity: legend count matches button count + axis/sprint + modifiers
// ---------------------------------------------------------------------------

describe("CONTROLS-PARITY-002: legend entry count matches config capacity", () => {
  it("legend has entries for all action buttons in config", () => {
    const actionLegendEntries = CONTROLS_LEGEND.filter((e) => e.expectedBitmask !== -1);
    const modifierEntries = CONTROLS_LEGEND.filter((e) => e.bindingKey.includes("+"));
    const directButtonEntries = actionLegendEntries.filter((e) => !e.bindingKey.includes("+"));

    // Direct button entries should cover all buttons.
    expect(directButtonEntries.length).toBe(DEFAULT_KEYBOARD_CONFIG.buttons.length);

    // Modifier entries should cover all buttonModifiers.
    if (DEFAULT_KEYBOARD_CONFIG.buttonModifiers) {
      expect(modifierEntries.length).toBe(DEFAULT_KEYBOARD_CONFIG.buttonModifiers.length);
    } else {
      expect(modifierEntries.length).toBe(0);
    }
  });

  it("legend has entries for axis and sprint controls", () => {
    const axisSprintEntries = CONTROLS_LEGEND.filter((e) => e.expectedBitmask === -1);
    // Move + Sprint = 2 entries.
    expect(axisSprintEntries.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Negative control A: removing a binding → guard FAILS
// ---------------------------------------------------------------------------

describe("CONTROLS-PARITY-NEG-A: removing a binding from config → guard FAILS", () => {
  it("removing KeyU (standing tackle) button → guard detects missing binding", () => {
    const mutatedConfig: KeyboardAdapterConfig = {
      ...DEFAULT_KEYBOARD_CONFIG,
      buttons: DEFAULT_KEYBOARD_CONFIG.buttons.filter((b) => b.key !== "KeyU"),
    };

    const standingTackleEntry = CONTROLS_LEGEND.find(
      (e) => e.label === "Standing Tackle",
    )!;
    const result = entryHasLiveBinding(standingTackleEntry, mutatedConfig);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("not found");
  });

  it("removing KeyI (slide tackle) button → guard detects missing binding", () => {
    const mutatedConfig: KeyboardAdapterConfig = {
      ...DEFAULT_KEYBOARD_CONFIG,
      buttons: DEFAULT_KEYBOARD_CONFIG.buttons.filter((b) => b.key !== "KeyI"),
    };

    const slideTackleEntry = CONTROLS_LEGEND.find(
      (e) => e.label === "Slide Tackle",
    )!;
    const result = entryHasLiveBinding(slideTackleEntry, mutatedConfig);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("not found");
  });

  it("removing KeyJ (pass) button → guard detects missing binding", () => {
    const mutatedConfig: KeyboardAdapterConfig = {
      ...DEFAULT_KEYBOARD_CONFIG,
      buttons: DEFAULT_KEYBOARD_CONFIG.buttons.filter((b) => b.key !== "KeyJ"),
    };

    const passEntry = CONTROLS_LEGEND.find((e) => e.label === "Pass")!;
    const result = entryHasLiveBinding(passEntry, mutatedConfig);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("not found");
  });

  it("removing ShiftLeft (sprint) → guard detects missing binding", () => {
    const mutatedConfig: KeyboardAdapterConfig = {
      ...DEFAULT_KEYBOARD_CONFIG,
      sprintButton: { key: "Unbound", actionBit: -1 },
    };

    const sprintEntry = CONTROLS_LEGEND.find((e) => e.label === "Sprint")!;
    const result = entryHasLiveBinding(sprintEntry, mutatedConfig);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("not found");
  });

  it("removing Tab (switch) button → guard detects missing binding", () => {
    const mutatedConfig: KeyboardAdapterConfig = {
      ...DEFAULT_KEYBOARD_CONFIG,
      buttons: DEFAULT_KEYBOARD_CONFIG.buttons.filter((b) => b.key !== "Tab"),
    };

    const switchEntry = CONTROLS_LEGEND.find(
      (e) => e.label === "Switch Player",
    )!;
    const result = entryHasLiveBinding(switchEntry, mutatedConfig);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("not found");
  });
});

// ---------------------------------------------------------------------------
// Negative control B: removing a legend entry → guard detects mismatch
// ---------------------------------------------------------------------------

describe("CONTROLS-PARITY-NEG-B: removing a legend entry → guard detects mismatch", () => {
  it("full scan with Standing Tackle removed from legend → count mismatch", () => {
    const mutatedLegend = CONTROLS_LEGEND.filter(
      (e) => e.label !== "Standing Tackle",
    );

    // The standing tackle button still exists in config but legend is short.
    const actionEntries = mutatedLegend.filter((e) => e.expectedBitmask !== -1);
    const modifierEntries = mutatedLegend.filter((e) => e.bindingKey.includes("+"));
    const directButtonEntries = actionEntries.filter((e) => !e.bindingKey.includes("+"));

    expect(directButtonEntries.length).toBe(
      DEFAULT_KEYBOARD_CONFIG.buttons.length - 1,
    );
    // This proves the guard would detect the drift.
  });

  it("full scan with Slide Tackle removed from legend → count mismatch", () => {
    const mutatedLegend = CONTROLS_LEGEND.filter(
      (e) => e.label !== "Slide Tackle",
    );

    const actionEntries = mutatedLegend.filter((e) => e.expectedBitmask !== -1);
    const modifierEntries = mutatedLegend.filter((e) => e.bindingKey.includes("+"));
    const directButtonEntries = actionEntries.filter((e) => !e.bindingKey.includes("+"));

    expect(directButtonEntries.length).toBe(
      DEFAULT_KEYBOARD_CONFIG.buttons.length - 1,
    );
  });

  it("full scan with Pass removed from legend → count mismatch", () => {
    const mutatedLegend = CONTROLS_LEGEND.filter((e) => e.label !== "Pass");

    const actionEntries = mutatedLegend.filter((e) => e.expectedBitmask !== -1);
    const modifierEntries = mutatedLegend.filter((e) => e.bindingKey.includes("+"));
    const directButtonEntries = actionEntries.filter((e) => !e.bindingKey.includes("+"));

    expect(directButtonEntries.length).toBe(
      DEFAULT_KEYBOARD_CONFIG.buttons.length - 1,
    );
  });
});

// ---------------------------------------------------------------------------
// Negative control C: wrong bitmask → guard detects mismatch
// ---------------------------------------------------------------------------

describe("CONTROLS-PARITY-NEG-C: wrong bitmask → guard detects mismatch", () => {
  it("legend claims Standing Tackle is bit 2 instead of bit 6 → guard FAILS", () => {
    const mutatedEntry: ControlLegendEntry = {
      label: "Standing Tackle",
      keyDisplay: "U",
      expectedBitmask: 1 << 2, // wrong: should be 1 << 6
      bindingKey: "KeyU",
      edgeTriggered: true,
    };

    const result = entryHasLiveBinding(mutatedEntry, DEFAULT_KEYBOARD_CONFIG);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("bit position");
  });

  it("legend claims Slide Tackle is bit 1 instead of bit 7 → guard FAILS", () => {
    const mutatedEntry: ControlLegendEntry = {
      label: "Slide Tackle",
      keyDisplay: "I",
      expectedBitmask: 1 << 1, // wrong: should be 1 << 7
      bindingKey: "KeyI",
      edgeTriggered: true,
    };

    const result = entryHasLiveBinding(mutatedEntry, DEFAULT_KEYBOARD_CONFIG);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("bit position");
  });
});

// ---------------------------------------------------------------------------
// Source of truth invariant: CONTROLS_LEGEND is the canonical definition
// ---------------------------------------------------------------------------

describe("CONTROLS-SOT-001: shared source of truth invariant", () => {
  it("CONTROLS_LEGEND is non-empty", () => {
    expect(CONTROLS_LEGEND.length).toBeGreaterThan(0);
  });

  it("all legend entries have unique labels", () => {
    const labels = CONTROLS_LEGEND.map((e) => e.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("all legend entries have unique binding keys", () => {
    const keys = CONTROLS_LEGEND.map((e) => e.bindingKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every legend entry covers a distinct bit (non-axis entries)", () => {
    const bits = CONTROLS_LEGEND.filter((e) => e.expectedBitmask > 0).map(
      (e) => e.expectedBitmask,
    );
    expect(new Set(bits).size).toBe(bits.length);
  });
});
