/**
 * @module apps/browser/controls-legend-ui
 *
 * Controls legend presentation for the browser adapter: renders the shared
 * CONTROLS_LEGEND contract into the setup-menu legend table and the in-match
 * overlay, and wires the overlay toggle/close controls.
 *
 * Content lives in exactly one place (src/contracts/controls-legend.ts);
 * this module only projects it into DOM. Presentation affordance only —
 * it never touches simulation state.
 *
 * Browser adapter layer: DOM is allowed here, never in the simulation core.
 */

import { CONTROLS_LEGEND } from "../../contracts/controls-legend.js";
import type { ControlLegendEntry } from "../../contracts/controls-legend.js";

/** Ids of the legend DOM nodes this module owns in index.html. */
export const CONTROLS_LEGEND_IDS = {
  hintText: "controls-hint-text",
  overlay: "controls-overlay",
  overlayBody: "controls-overlay-body",
  overlayClose: "controls-overlay-close",
  setupBody: "controls-legend-body",
  toggle: "controls-toggle",
} as const;

/**
 * Set the per-match controls hint without touching its sibling toggle button.
 *
 * The hint lives next to `#controls-toggle` inside `#controls-hint`; writing
 * `textContent` on that wrapper would delete the toggle, so the mode-specific
 * text is written into its own node instead.
 */
export function setControlsHintText(doc: Document, text: string): void {
  const hintEl = doc.getElementById(CONTROLS_LEGEND_IDS.hintText);
  if (hintEl) hintEl.textContent = text;
}

/**
 * Render legend rows into a `<tbody>`.
 *
 * Defaults to the shared contract; the `legend` parameter exists so tests can
 * prove the row-vs-contract comparison is discriminating, never so the app can
 * carry a second copy of the content.
 */
export function populateControlsLegendBody(
  tbody: HTMLElement | null,
  legend: readonly ControlLegendEntry[] = CONTROLS_LEGEND,
): void {
  if (!tbody) return;
  const doc = tbody.ownerDocument;
  tbody.innerHTML = "";
  for (const entry of legend) {
    const tr = doc.createElement("tr");
    const tdLabel = doc.createElement("td");
    tdLabel.textContent = entry.label;
    const tdKey = doc.createElement("td");
    tdKey.textContent = entry.keyDisplay;
    tr.appendChild(tdLabel);
    tr.appendChild(tdKey);
    tbody.appendChild(tr);
  }
}

function getOverlay(doc: Document): HTMLElement | null {
  return doc.getElementById(CONTROLS_LEGEND_IDS.overlay);
}

export function closeControlsOverlay(doc: Document): void {
  getOverlay(doc)?.classList.add("hidden");
}

export function toggleControlsOverlay(doc: Document): void {
  getOverlay(doc)?.classList.toggle("hidden");
}

/**
 * Populate both legend surfaces from the contract and wire the overlay
 * toggle/close buttons. Missing nodes are skipped, so a document without the
 * legend markup never throws.
 */
export function initControlsLegendUi(doc: Document): void {
  populateControlsLegendBody(doc.getElementById(CONTROLS_LEGEND_IDS.setupBody));
  populateControlsLegendBody(doc.getElementById(CONTROLS_LEGEND_IDS.overlayBody));

  const toggleBtn = doc.getElementById(CONTROLS_LEGEND_IDS.toggle);
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      toggleControlsOverlay(doc);
    });
  }

  const closeBtn = doc.getElementById(CONTROLS_LEGEND_IDS.overlayClose);
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      closeControlsOverlay(doc);
    });
  }
}
