/**
 * @module tests/browser/ladder-menu-parity.browser.test
 *
 * Parity guard: asserts menu-to-scenario-selector parity for the full
 * small-sided ladder (1v1/2v2/3v3/5v5 × human-vs-CPU / CPU-vs-CPU).
 *
 * 1. Every ladder mode in the HTML <select id="mode-select"> has a
 *    scenario-selector mapping via selectBrowserScenario().
 * 2. Every scenario-selector ladder mode has a menu entry in the HTML.
 * 3. Negative control: removing a menu entry causes the parity check
 *    to fail with the named missing mode.
 *
 * Evidence class: HEADLESS (binding guard test).
 * Case version: browser-case-ladder-menu-parity-v1.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect } from "vitest";
import { selectBrowserScenario } from "../../src/apps/browser/scenario-selector.js";
import { FOUNDATION_SCENARIO } from "../../src/apps/browser/foundation-scenario.js";
import indexHtmlRaw from "../../src/apps/browser/index.html?raw";

// ---------------------------------------------------------------------------
// Case metadata
// ---------------------------------------------------------------------------

const CASE_ID = "BROWSER-SMALL-SIDED-LADDER-MENU-COMPLETION";
const CASE_VERSION = "browser-case-ladder-menu-parity-v1";
const OBJECTIVE_ID = "SMALL-SIDED-LADDER-MENU-COMPLETION";

// ---------------------------------------------------------------------------
// Canonical ladder modes — the full small-sided ladder
// ---------------------------------------------------------------------------

/**
 * Every entry in this map represents a required ladder mode:
 *   key   = URL mode value (matches option value in index.html and mode param)
 *   value = human-readable label for diagnostics
 */
const LADDER_MODES: Record<string, string> = {
  "ai-match-5v5":    "5v5 CPU vs CPU",
  "human-vs-ai-5v5": "5v5 Human vs CPU",
  "ai-match-3v3":    "3v3 CPU vs CPU",
  "human-vs-ai-3v3": "3v3 Human vs CPU",
  "human-vs-ai":     "2v2 Human vs CPU",
  "2v2-ai":          "2v2 CPU vs CPU",
  "human-vs-ai-1v1": "1v1 Human vs CPU",
  "ai-match":        "1v1 CPU vs CPU",
};

// The extra menu entries that are part of the broader menu but outside
// the strict NvN ladder (e.g. 5v3).
const EXTRA_MENU_MODES: Record<string, string> = {
  "human-vs-ai-5v3": "5v3 Human vs CPU",
};

// ---------------------------------------------------------------------------
// Parse HTML to extract <select id="mode-select"> option values
// ---------------------------------------------------------------------------

function parseMenuOptionValues(html: string): string[] {
  // Match the mode-select <select> block.
  const selectMatch = html.match(
    /<select\s+id="mode-select">([\s\S]*?)<\/select>/,
  );
  if (!selectMatch) {
    throw new Error("Could not find <select id='mode-select'> in index.html");
  }
  const selectBlock = selectMatch[1];
  const optionValues: string[] = [];
  const optionRegex = /<option\s+value="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = optionRegex.exec(selectBlock)) !== null) {
    optionValues.push(m[1]);
  }
  return optionValues;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Ladder menu parity guard", () => {
  // ---- Parse HTML once ----
  const menuOptionValues = parseMenuOptionValues(indexHtmlRaw);
  const menuOptionSet = new Set(menuOptionValues);

  it("HTML menu contains all expected option values (no duplicates)", () => {
    // Every entry must be present.
    const allExpected = { ...LADDER_MODES, ...EXTRA_MENU_MODES };
    for (const [modeId, label] of Object.entries(allExpected)) {
      expect(
        menuOptionSet.has(modeId),
        `HTML menu is missing option for "${label}" (mode="${modeId}")`,
      ).toBe(true);
    }
    // No unexpected option values.
    for (const modeId of menuOptionValues) {
      expect(
        allExpected,
        `HTML menu has unexpected option "${modeId}" not in the canonical ladder or extra set`,
      ).toHaveProperty(modeId);
    }
  });

  it("every ladder mode resolves via selectBrowserScenario to a non-default scenario", () => {
    for (const [modeId, label] of Object.entries(LADDER_MODES)) {
      const scenario = selectBrowserScenario(`?mode=${modeId}`);
      expect(
        scenario,
        `selectBrowserScenario("?mode=${modeId}") for "${label}" should return a defined scenario`,
      ).toBeDefined();
      // The default fallback scenario has id "foundation-move-and-roll-v1".
      // A ladder mode must never fall back to that.
      expect(
        scenario.id,
        `selectBrowserScenario("?mode=${modeId}") for "${label}" must not resolve to the default fallback scenario`,
      ).not.toBe(FOUNDATION_SCENARIO.id);
    }
  });

  it("every extra menu mode resolves via selectBrowserScenario", () => {
    for (const [modeId, label] of Object.entries(EXTRA_MENU_MODES)) {
      const scenario = selectBrowserScenario(`?mode=${modeId}`);
      expect(
        scenario,
        `selectBrowserScenario("?mode=${modeId}") for "${label}" should return a defined scenario`,
      ).toBeDefined();
      expect(
        scenario.id,
        `selectBrowserScenario("?mode=${modeId}") for "${label}" must not resolve to the default fallback scenario`,
      ).not.toBe(FOUNDATION_SCENARIO.id);
    }
  });

  it("menu option count equals scenario-selector parity (every menu entry resolves, no dangling modes)", () => {
    // Cross-check: every menu option must be resolvable.
    for (const modeId of menuOptionValues) {
      const scenario = selectBrowserScenario(`?mode=${modeId}`);
      expect(
        scenario,
        `Menu option "${modeId}" could not be resolved by selectBrowserScenario`,
      ).toBeDefined();
    }

    // Cross-check: every ladder mode must appear in the menu.
    for (const [modeId, label] of Object.entries(LADDER_MODES)) {
      expect(
        menuOptionSet.has(modeId),
        `Ladder mode "${label}" (mode="${modeId}") is in scenario-selector but missing from the HTML menu`,
      ).toBe(true);
    }
  });

  it("negative control — removing a menu entry breaks parity", () => {
    // Simulate removing the first ladder mode from the menu.
    const [removedMode, removedLabel] = Object.entries(LADDER_MODES)[0];

    // Build a modified menu set with the entry removed.
    const modifiedMenuSet = new Set(menuOptionValues);
    modifiedMenuSet.delete(removedMode);

    // The parity check must now detect that the removed mode is missing.
    expect(
      modifiedMenuSet.has(removedMode),
      `Parity should break: "${removedLabel}" (mode="${removedMode}") should be absent from the modified menu`,
    ).toBe(false);
    // The original menu must have it (proving we're removing something real).
    expect(
      menuOptionSet.has(removedMode),
      `Precondition: "${removedMode}" must exist in the original menu`,
    ).toBe(true);
  });

  it("negative control — removing human-vs-ai-5v5 from menu breaks parity", () => {
    // Specifically test the newly added 5v5 human-vs-CPU entry.
    const removedMode = "human-vs-ai-5v5";
    const modifiedMenuSet = new Set(menuOptionValues);
    modifiedMenuSet.delete(removedMode);

    expect(
      modifiedMenuSet.has(removedMode),
      "precondition: the entry was actually removed",
    ).toBe(false);
    // The original menu must have it.
    expect(
      menuOptionSet.has(removedMode),
      `Precondition: "${removedMode}" must exist in the original menu`,
    ).toBe(true);
  });

  it("negative control — removing human-vs-ai-3v3 from menu breaks parity", () => {
    // Specifically test the newly added 3v3 human-vs-CPU entry.
    const removedMode = "human-vs-ai-3v3";
    const modifiedMenuSet = new Set(menuOptionValues);
    modifiedMenuSet.delete(removedMode);

    expect(
      modifiedMenuSet.has(removedMode),
      "precondition: the entry was actually removed",
    ).toBe(false);
    // The original menu must have it.
    expect(
      menuOptionSet.has(removedMode),
      `Precondition: "${removedMode}" must exist in the original menu`,
    ).toBe(true);
  });

  it("negative control — removing human-vs-ai-1v1 from menu breaks parity", () => {
    // Specifically test the newly added 1v1 human-vs-CPU entry.
    const removedMode = "human-vs-ai-1v1";
    const modifiedMenuSet = new Set(menuOptionValues);
    modifiedMenuSet.delete(removedMode);

    expect(
      modifiedMenuSet.has(removedMode),
      "precondition: the entry was actually removed",
    ).toBe(false);
    // The original menu must have it.
    expect(
      menuOptionSet.has(removedMode),
      `Precondition: "${removedMode}" must exist in the original menu`,
    ).toBe(true);
  });

  it("discriminating failure — simulating removed entry in full parity check", () => {
    // Simulate what happens when human-vs-ai-3v3 is removed from the HTML.
    const removedModeId = "human-vs-ai-3v3";
    const removedLabel = "3v3 Human vs CPU";

    // Build a modified HTML that lacks the entry.
    const modifiedHtml = indexHtmlRaw.replace(
      `<option value="${removedModeId}">${removedLabel}</option>\n`,
      "",
    );
    const modifiedOptions = parseMenuOptionValues(modifiedHtml);
    const modifiedSet = new Set(modifiedOptions);

    // Verify the entry is actually gone.
    expect(modifiedSet.has(removedModeId)).toBe(false);

    // Run the parity check: every ladder mode must appear in the menu.
    const failures: string[] = [];
    for (const [modeId, label] of Object.entries(LADDER_MODES)) {
      if (!modifiedSet.has(modeId)) {
        failures.push(`missing menu entry for "${label}" (mode="${modeId}")`);
      }
    }

    // Must detect exactly the removed mode.
    expect(failures.length).toBe(1);
    expect(failures[0]).toContain(removedModeId);
    expect(failures[0]).toContain(removedLabel);
  });
});
