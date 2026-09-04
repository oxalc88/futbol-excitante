/**
 * @module @pes/contracts/controls-legend
 *
 * Shared single source of truth for the browser controls legend.
 * Both the in-app legend UI and the parity guard test import from here,
 * ensuring legend content and live bindings cannot drift apart.
 *
 * Each entry maps a human-readable label + display key to an action-bit
 * bitmask (or -1 for non-action controls like axes). The parity guard
 * compares these bitmasks against the live DEFAULT_KEYBOARD_CONFIG.
 */

/**
 * A single entry in the controls legend.
 */
export interface ControlLegendEntry {
  /** Human-readable action label shown in the legend. */
  label: string;
  /** Keyboard key display string (e.g. "W", "Shift", "Tab", "E+J"). */
  keyDisplay: string;
  /**
   * Expected action-bit bitmask for this control.
   * -1 indicates a non-action-bit control (movement axes, sprint).
   * For non-action-bit controls, the parity guard uses `bindingKey`
   * instead for matching.
   */
  expectedBitmask: number;
  /**
   * Keyboard key code(s) to match against DEFAULT_KEYBOARD_CONFIG.
   * For axis controls, this is the positive key code.
   * For modifier combos, this is the full display (e.g. "E+J").
   */
  bindingKey: string;
  /** Whether this entry is edge-triggered (press, not hold). */
  edgeTriggered: boolean;
}

/**
 * Full controls legend for slot-1 (default keyboard config).
 *
 * Order: movement axes, sprint, then action buttons (bit order).
 */
export const CONTROLS_LEGEND: ControlLegendEntry[] = [
  { label: "Move",          keyDisplay: "W A S D",  expectedBitmask: -1, bindingKey: "KeyW",            edgeTriggered: false },
  { label: "Sprint",        keyDisplay: "Shift",     expectedBitmask: -1, bindingKey: "ShiftLeft",       edgeTriggered: false },
  { label: "First Touch",   keyDisplay: "K",          expectedBitmask: 1 << 0, bindingKey: "KeyK",       edgeTriggered: false },
  { label: "Pass",          keyDisplay: "J",          expectedBitmask: 1 << 1, bindingKey: "KeyJ",       edgeTriggered: false },
  { label: "Shot",          keyDisplay: "L",          expectedBitmask: 1 << 2, bindingKey: "KeyL",       edgeTriggered: false },
  { label: "Switch Player", keyDisplay: "Tab",        expectedBitmask: 1 << 3, bindingKey: "Tab",        edgeTriggered: true },
  { label: "Lofted Pass",   keyDisplay: "E + J",      expectedBitmask: 1 << 4, bindingKey: "E+J",        edgeTriggered: false },
  { label: "Through Ball",  keyDisplay: "Q + J",      expectedBitmask: 1 << 5, bindingKey: "Q+J",        edgeTriggered: false },
  { label: "Standing Tackle", keyDisplay: "U",        expectedBitmask: 1 << 6, bindingKey: "KeyU",       edgeTriggered: true },
  { label: "Slide Tackle",  keyDisplay: "I",          expectedBitmask: 1 << 7, bindingKey: "KeyI",        edgeTriggered: true },
];
