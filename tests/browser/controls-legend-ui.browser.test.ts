/**
 * @module tests/browser/controls-legend-ui.browser.test
 *
 * Real-app controls legend guard — BROWSER-DEFENSIVE-CONTROLS-LEGEND.
 *
 * Exercises the actual browser code path, not a re-implementation:
 *  1. Markup guard: the real index.html carries the legend section, the
 *     in-match overlay, the toggle button and the tackle keys in the hint.
 *  2. Wiring guard: the composition root (main.ts) initialises the legend UI.
 *  3. Behaviour: the REAL initControlsLegendUi() run against the parsed real
 *     markup renders exactly CONTROLS_LEGEND.length rows, in contract order,
 *     with matching labels and key displays, in both the setup-menu legend and
 *     the in-match overlay.
 *  4. Toggle: clicking #controls-toggle reveals #controls-overlay; clicking
 *     #controls-overlay-close hides it again.
 *  5. Discriminating negative controls: dropping a legend entry, dropping the
 *     legend markup, or skipping the init call are all detected.
 *
 * No durable evidence is written here — screenshots come from
 * scripts/capture-controls-legend-screenshots.mjs (capture hygiene).
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect } from "vitest";
import indexHtmlRaw from "../../src/apps/browser/index.html?raw";
import mainTsRaw from "../../src/apps/browser/main.ts?raw";
import stylesCssRaw from "../../src/apps/browser/styles.css?raw";
import { CONTROLS_LEGEND } from "../../src/contracts/controls-legend.js";
import type { ControlLegendEntry } from "../../src/contracts/controls-legend.js";
import {
  CONTROLS_LEGEND_IDS,
  initControlsLegendUi,
  populateControlsLegendBody,
  setControlsHintText,
} from "../../src/apps/browser/controls-legend-ui.js";

// ---------------------------------------------------------------------------
// Case metadata
// ---------------------------------------------------------------------------

const CASE_ID = "BROWSER-DEFENSIVE-CONTROLS-LEGEND";
const CASE_VERSION = "browser-case-controls-legend-ui-v1";

// ---------------------------------------------------------------------------
// Real markup helpers
// ---------------------------------------------------------------------------

/** Ids the legend feature requires in the shipped HTML. */
const REQUIRED_LEGEND_IDS: string[] = [
  "controls-legend-section",
  CONTROLS_LEGEND_IDS.setupBody,
  CONTROLS_LEGEND_IDS.hintText,
  CONTROLS_LEGEND_IDS.overlay,
  CONTROLS_LEGEND_IDS.overlayBody,
  CONTROLS_LEGEND_IDS.overlayClose,
  CONTROLS_LEGEND_IDS.toggle,
];

/**
 * Report legend affordances missing from a markup string.
 * Empty array means the markup can host the legend.
 */
function missingLegendMarkup(html: string): string[] {
  const missing: string[] = [];
  for (const id of REQUIRED_LEGEND_IDS) {
    if (!html.includes(`id="${id}"`)) {
      missing.push(`missing id="${id}"`);
    }
  }
  // The in-match hint must name the defensive actions alongside the others.
  const hintMatch = html.match(/<div id="controls-hint">([\s\S]*?)<\/div>/);
  if (!hintMatch) {
    missing.push('missing <div id="controls-hint">');
  } else {
    if (!/U: Standing Tackle/.test(hintMatch[1])) {
      missing.push("controls hint does not document the standing tackle (U)");
    }
    if (!/I: Slide Tackle/.test(hintMatch[1])) {
      missing.push("controls hint does not document the slide tackle (I)");
    }
  }
  return missing;
}

/** Parse the shipped HTML into an inert document (scripts do not run). */
function parseAppMarkup(html: string): Document {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc.body.querySelector("#setup-menu")) {
    throw new Error("Parsed markup has no #setup-menu — markup unusable");
  }
  return doc;
}

function serialize(doc: Document): string {
  return new XMLSerializer().serializeToString(doc);
}

// ---------------------------------------------------------------------------
// Row ↔ contract comparison (no duplicated row data anywhere)
// ---------------------------------------------------------------------------

interface LegendRow {
  label: string;
  keyDisplay: string;
}

function readLegendRows(tbody: HTMLElement | null): LegendRow[] {
  if (!tbody) return [];
  return Array.from(tbody.querySelectorAll("tr")).map((tr) => {
    const cells = Array.from(tr.querySelectorAll("td"));
    return {
      label: (cells[0]?.textContent ?? "").trim(),
      keyDisplay: (cells[1]?.textContent ?? "").trim(),
    };
  });
}

/**
 * Compare rendered rows against the shared contract.
 * Returns one diagnostic string per drift; empty means parity.
 */
function compareRowsToContract(
  rows: LegendRow[],
  contract: readonly ControlLegendEntry[],
): string[] {
  const drift: string[] = [];
  if (rows.length !== contract.length) {
    drift.push(`row count ${rows.length} != contract length ${contract.length}`);
  }
  contract.forEach((entry, index) => {
    const row = rows[index];
    if (!row) {
      drift.push(`contract entry "${entry.label}" (${entry.keyDisplay}) has no rendered row`);
      return;
    }
    if (row.label !== entry.label) {
      drift.push(`row ${index} label "${row.label}" != contract "${entry.label}"`);
    }
    if (row.keyDisplay !== entry.keyDisplay) {
      drift.push(
        `row ${index} key "${row.keyDisplay}" != contract "${entry.keyDisplay}" (${entry.label})`,
      );
    }
  });
  for (let i = contract.length; i < rows.length; i += 1) {
    drift.push(`row ${i} "${rows[i].label}" is rendered but absent from the contract`);
  }
  return drift;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe(`${CASE_ID} (${CASE_VERSION}): real-app controls legend`, () => {
  it("ships the legend affordances in the real index.html markup", () => {
    expect(missingLegendMarkup(indexHtmlRaw)).toEqual([]);
  });

  it("composition root initialises the legend UI and updates the hint safely", () => {
    expect(mainTsRaw).toMatch(/initControlsLegendUi\(\s*document\s*\)/);
    // The per-match hint must be written through the legend UI helper: assigning
    // textContent on the #controls-hint wrapper would delete the toggle button.
    expect(mainTsRaw).toContain("setControlsHintText(document, controlsHint)");
    expect(mainTsRaw).not.toMatch(/controlsHintEl\)?\.textContent\s*=/);
  });

  it("setting the per-match hint keeps the legend toggle alive and working", () => {
    const doc = parseAppMarkup(indexHtmlRaw);
    initControlsLegendUi(doc);

    setControlsHintText(
      doc,
      "5v5 Human vs CPU — WASD + Shift to sprint, Tab to switch player, U standing tackle, I slide tackle",
    );

    expect(doc.getElementById(CONTROLS_LEGEND_IDS.hintText)?.textContent).toContain(
      "U standing tackle",
    );
    const toggle = doc.getElementById(CONTROLS_LEGEND_IDS.toggle);
    expect(toggle, "hint update must not remove #controls-toggle").not.toBeNull();

    const overlay = doc.getElementById(CONTROLS_LEGEND_IDS.overlay);
    toggle!.click();
    expect(overlay!.classList.contains("hidden")).toBe(false);
  });

  it("setup-menu legend renders exactly the contract rows, in order", () => {
    const doc = parseAppMarkup(indexHtmlRaw);
    initControlsLegendUi(doc);

    const rows = readLegendRows(doc.getElementById(CONTROLS_LEGEND_IDS.setupBody));
    expect(rows.length).toBe(CONTROLS_LEGEND.length);
    expect(compareRowsToContract(rows, CONTROLS_LEGEND)).toEqual([]);
  });

  it("in-match overlay legend renders the same contract rows", () => {
    const doc = parseAppMarkup(indexHtmlRaw);
    initControlsLegendUi(doc);

    const rows = readLegendRows(doc.getElementById(CONTROLS_LEGEND_IDS.overlayBody));
    expect(rows.length).toBe(CONTROLS_LEGEND.length);
    expect(compareRowsToContract(rows, CONTROLS_LEGEND)).toEqual([]);
  });

  it("documents the full human control set, including both tackles", () => {
    const doc = parseAppMarkup(indexHtmlRaw);
    initControlsLegendUi(doc);

    const rows = readLegendRows(doc.getElementById(CONTROLS_LEGEND_IDS.setupBody));
    const labels = rows.map((row) => row.label);
    for (const required of [
      "Move",
      "Sprint",
      "First Touch",
      "Pass",
      "Shot",
      "Switch Player",
      "Lofted Pass",
      "Through Ball",
      "Standing Tackle",
      "Slide Tackle",
    ]) {
      expect(labels, `legend is missing "${required}"`).toContain(required);
    }
  });

  it("#controls-toggle opens the overlay and #controls-overlay-close hides it", () => {
    const doc = parseAppMarkup(indexHtmlRaw);
    initControlsLegendUi(doc);

    const overlay = doc.getElementById(CONTROLS_LEGEND_IDS.overlay);
    const toggle = doc.getElementById(CONTROLS_LEGEND_IDS.toggle);
    const closeBtn = doc.getElementById(CONTROLS_LEGEND_IDS.overlayClose);
    expect(overlay).not.toBeNull();
    expect(toggle).not.toBeNull();
    expect(closeBtn).not.toBeNull();

    // Ships hidden so the match view is unobstructed.
    expect(overlay!.classList.contains("hidden")).toBe(true);

    toggle!.click();
    expect(overlay!.classList.contains("hidden")).toBe(false);

    closeBtn!.click();
    expect(overlay!.classList.contains("hidden")).toBe(true);

    // Toggle is a toggle: opening twice then closing returns to hidden.
    toggle!.click();
    toggle!.click();
    expect(overlay!.classList.contains("hidden")).toBe(true);
  });

  it("the click-through hint strip keeps the legend toggle interactive", () => {
    // #controls-hint is pointer-events:none so it never blocks the pitch; the
    // toggle inside it must opt back in or the legend is undiscoverable in-match.
    const hintRule = stylesCssRaw.match(/#controls-hint\s*\{[^}]*\}/);
    expect(hintRule, "#controls-hint rule missing from styles.css").not.toBeNull();
    expect(hintRule![0]).toMatch(/pointer-events:\s*none/);

    const toggleRule = stylesCssRaw.match(/#controls-hint\s+#controls-toggle\s*\{[^}]*\}/);
    expect(toggleRule, "#controls-hint #controls-toggle rule missing").not.toBeNull();
    expect(toggleRule![0]).toMatch(/pointer-events:\s*auto/);
  });

  // -------------------------------------------------------------------------
  // Discriminating negative controls
  // -------------------------------------------------------------------------

  it("negative control — a legend entry removed from the contract is detected", () => {
    const doc = parseAppMarkup(indexHtmlRaw);
    // Simulate the UI drifting from the contract: render without Slide Tackle.
    const mutated = CONTROLS_LEGEND.filter((entry) => entry.label !== "Slide Tackle");
    populateControlsLegendBody(
      doc.getElementById(CONTROLS_LEGEND_IDS.setupBody),
      mutated,
    );

    const rows = readLegendRows(doc.getElementById(CONTROLS_LEGEND_IDS.setupBody));
    const drift = compareRowsToContract(rows, CONTROLS_LEGEND);
    expect(drift.length).toBeGreaterThan(0);
    expect(drift.join("\n")).toContain("Slide Tackle");
    // Precondition: the untouched contract really does carry that entry.
    expect(compareRowsToContract(rows, mutated)).toEqual([]);
  });

  it("negative control — an undocumented binding key in a rendered row is detected", () => {
    const doc = parseAppMarkup(indexHtmlRaw);
    const mutated = CONTROLS_LEGEND.map((entry) =>
      entry.label === "Standing Tackle" ? { ...entry, keyDisplay: "Y" } : entry,
    );
    populateControlsLegendBody(
      doc.getElementById(CONTROLS_LEGEND_IDS.setupBody),
      mutated,
    );

    const rows = readLegendRows(doc.getElementById(CONTROLS_LEGEND_IDS.setupBody));
    const drift = compareRowsToContract(rows, CONTROLS_LEGEND);
    expect(drift.length).toBe(1);
    expect(drift[0]).toContain("Standing Tackle");
  });

  it("negative control — deleting the setup-menu legend markup fails the markup guard", () => {
    const doc = parseAppMarkup(indexHtmlRaw);
    const section = doc.getElementById("controls-legend-section");
    expect(section, "precondition: the shipped markup carries the legend section").not.toBeNull();
    section!.remove();

    const missing = missingLegendMarkup(serialize(doc));
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.join("\n")).toContain(CONTROLS_LEGEND_IDS.setupBody);
    // The shipped markup really does pass the same guard (removal is the cause).
    expect(missingLegendMarkup(indexHtmlRaw)).toEqual([]);
  });

  it("negative control — deleting the in-match overlay markup fails the markup guard", () => {
    const doc = parseAppMarkup(indexHtmlRaw);
    const overlay = doc.getElementById(CONTROLS_LEGEND_IDS.overlay);
    expect(overlay, "precondition: the shipped markup carries the overlay").not.toBeNull();
    overlay!.remove();

    const missing = missingLegendMarkup(serialize(doc));
    expect(missing.join("\n")).toContain(CONTROLS_LEGEND_IDS.overlayBody);
    expect(missing.join("\n")).toContain(CONTROLS_LEGEND_IDS.overlayClose);
    expect(missingLegendMarkup(indexHtmlRaw)).toEqual([]);
  });

  it("negative control — skipping the init call leaves the legend empty", () => {
    const doc = parseAppMarkup(indexHtmlRaw);
    const rows = readLegendRows(doc.getElementById(CONTROLS_LEGEND_IDS.setupBody));
    expect(rows).toEqual([]);
    expect(compareRowsToContract(rows, CONTROLS_LEGEND).length).toBeGreaterThan(0);
  });

  it("negative control — an uninitialised toggle button never opens the overlay", () => {
    const doc = parseAppMarkup(indexHtmlRaw);
    const overlay = doc.getElementById(CONTROLS_LEGEND_IDS.overlay);
    const toggle = doc.getElementById(CONTROLS_LEGEND_IDS.toggle);
    expect(overlay!.classList.contains("hidden")).toBe(true);

    toggle!.click(); // no initControlsLegendUi() ran
    expect(overlay!.classList.contains("hidden")).toBe(true);
  });
});
