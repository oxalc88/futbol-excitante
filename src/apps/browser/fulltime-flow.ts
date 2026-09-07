/**
 * @module apps/browser/fulltime-flow
 *
 * FULLTIME-FLOW-CLOSURE — the end-of-match flow affordance, presentation-layer
 * only.  It owns the DOM fulltime panel (a clickable REMATCH / BACK TO MENU
 * affordance shown only at the fulltime terminal state) and the M/R keyboard
 * dispatcher, and exposes a pure `isFulltime` guard.  The composition root
 * (`main.ts`) wires the handlers to the existing match-start / setup-menu path;
 * this module never touches the simulation core or a football outcome.
 *
 * The affordance lives ONLY at fulltime: `handleKeydown` is inert until
 * `markFulltime` has made the flow active, so the in-play human controls
 * (WASD / Tab / pass / shot / tackles) are untouched.
 */

/** Element ids the fulltime flow uses in the real markup. */
export const FULLTIME_FLOW_IDS = {
  panel: "fulltime-panel",
  result: "fulltime-result",
  rematch: "fulltime-rematch",
  backToMenu: "fulltime-back-to-menu",
} as const;

/** Actions the flow invokes; wired by the composition root. */
export interface FulltimeFlowHandlers {
  /** Restart the same scenario through the composition-root match-start path. */
  onRematch(): void;
  /** Return to the match-setup menu and leave the app in a clean state. */
  onBackToMenu(): void;
}

export interface FulltimeFlow {
  /** The panel element (null if not created for this document). */
  readonly element: HTMLElement | null;
  /** True once the fulltime terminal state has been marked (flow active). */
  isFulltime(): boolean;
  /** Enter the fulltime terminal state: show the panel + set the result. */
  markFulltime(homeTeam: string, awayTeam: string, scoreA: number, scoreB: number): void;
  /** Leave the fulltime state: hide the panel (new match / menu). */
  hide(): void;
  /** The clickable REMATCH button (null if absent). */
  getRematchButton(): HTMLButtonElement | null;
  /** The clickable BACK TO MENU button (null if absent). */
  getBackToMenuButton(): HTMLButtonElement | null;
  /**
   * Dispatch a keyboard key while the flow is active.  `r` triggers the rematch,
   * `m` the menu return.  Returns true when the key was handled, false when
   * inert (not fulltime, or an unrelated key) — so in-play controls are never
   * intercepted.
   */
  handleKeydown(key: string): boolean;
}

/** Pure predicate — is this core-owned phase the fulltime terminal state? */
export function isFulltime(matchPhase: string): boolean {
  return matchPhase === "fulltime";
}

/**
 * Create the fulltime flow for a document.  The panel is created hidden and
 * appended to the document body; it is only shown by `markFulltime`.
 */
export function createFulltimeFlow(
  doc: Document,
  handlers: FulltimeFlowHandlers,
): FulltimeFlow {
  let active = false;

  const panel = doc.createElement("div");
  panel.id = FULLTIME_FLOW_IDS.panel;
  // Visibility is controlled by the inline display (there is no `#fulltime-panel`
  // rule in styles.css, so the `.hidden` class would be a no-op).  The panel is
  // hidden until markFulltime shows it at the fulltime terminal state.
  Object.assign(panel.style, {
    position: "fixed",
    inset: "0",
    zIndex: "1200",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.65)",
    pointerEvents: "auto",
  });

  const card = doc.createElement("div");
  Object.assign(card.style, {
    background: "rgba(12, 18, 30, 0.96)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: "14px",
    padding: "32px 44px",
    color: "#ffffff",
    fontFamily: "system-ui, -apple-system, sans-serif",
    textAlign: "center",
    boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6)",
  });

  const title = doc.createElement("div");
  title.textContent = "FULL TIME";
  Object.assign(title.style, {
    fontSize: "40px",
    fontWeight: "800",
    letterSpacing: "6px",
    color: "#ff5252",
    marginBottom: "6px",
  });
  card.appendChild(title);

  const result = doc.createElement("div");
  result.id = FULLTIME_FLOW_IDS.result;
  Object.assign(result.style, {
    fontSize: "22px",
    fontWeight: "700",
    letterSpacing: "2px",
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: "24px",
  });
  card.appendChild(result);

  const rematch = doc.createElement("button");
  rematch.id = FULLTIME_FLOW_IDS.rematch;
  rematch.type = "button";
  rematch.textContent = "REMATCH (R)";
  Object.assign(rematch.style, {
    display: "block",
    width: "100%",
    padding: "12px 18px",
    marginBottom: "10px",
    background: "#2e7d32",
    border: "none",
    borderRadius: "8px",
    color: "#ffffff",
    fontWeight: "700",
    fontSize: "16px",
    cursor: "pointer",
    letterSpacing: "1px",
  });
  card.appendChild(rematch);

  const backToMenu = doc.createElement("button");
  backToMenu.id = FULLTIME_FLOW_IDS.backToMenu;
  backToMenu.type = "button";
  backToMenu.textContent = "BACK TO MENU (M)";
  Object.assign(backToMenu.style, {
    display: "block",
    width: "100%",
    padding: "12px 18px",
    background: "#37474f",
    border: "none",
    borderRadius: "8px",
    color: "#ffffff",
    fontWeight: "700",
    fontSize: "16px",
    cursor: "pointer",
    letterSpacing: "1px",
  });
  card.appendChild(backToMenu);

  panel.appendChild(card);
  doc.body.appendChild(panel);

  rematch.addEventListener("click", () => handlers.onRematch());
  backToMenu.addEventListener("click", () => handlers.onBackToMenu());

  const flow: FulltimeFlow = {
    get element() {
      return panel;
    },
    isFulltime() {
      return active;
    },
    markFulltime(homeTeam, awayTeam, scoreA, scoreB) {
      active = true;
      result.textContent = `${homeTeam} ${scoreA} – ${scoreB} ${awayTeam}`;
      panel.style.display = "flex";
    },
    hide() {
      active = false;
      panel.style.display = "none";
    },
    getRematchButton() {
      return rematch;
    },
    getBackToMenuButton() {
      return backToMenu;
    },
    handleKeydown(key) {
      if (!active) return false;
      const k = key.toLowerCase();
      if (k === "r") {
        handlers.onRematch();
        return true;
      }
      if (k === "m") {
        handlers.onBackToMenu();
        return true;
      }
      return false;
    },
  };

  return flow;
}
