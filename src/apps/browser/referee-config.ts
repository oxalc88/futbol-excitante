/**
 * @module apps/browser/referee-config
 *
 * App-layer wiring for the shipped referee loop (REFEREE-SHIPPED-WIRING).
 *
 * The accepted referee machinery (FOUL-CONSEQUENCE-MACHINERY and
 * CARD-MACHINERY) ships with the consequence gates OFF by default.  The shipped
 * composition root exposes a menu-visible "Referee" toggle; when a player opts
 * in, this helper resolves the SAME accepted `createSimulation` config surface
 * (the `freeKickConfig` / `cardConfig` parameters) and the opt-in renderer
 * affordance (`showCardHud`) so the browser can see a foul, a free kick, and a
 * booking in normal play.
 *
 * When the toggle is OFF (the default) this resolves to `undefined` for both
 * gate configs and `showCardHud: false`, so a non-referee mode is byte-identical
 * on both the simulation path and the render path.  No `src/simulation/**` or
 * `src/contracts/**` change: the gates enter through the same config surface.
 *
 * This module is browser-app-layer (DOM-free, no I/O), so a node test can pin
 * the wiring without the browser.
 */

import type { CardConfig, FreeKickConfig } from "../../simulation/loop/simulation.js";

/** The app-layer referee wiring resolved from the menu opt-in. */
export interface RefereeWiring {
  /** The accepted free-kick gate, or `undefined` when the referee is off. */
  freeKickConfig: FreeKickConfig | undefined;
  /** The accepted card gate, or `undefined` when the referee is off. */
  cardConfig: CardConfig | undefined;
  /**
   * Whether the opt-in card HUD affordance should be drawn.  True exactly when
   * the referee is on; otherwise leafs the renderer at its default (off).
   */
  cardHud: boolean;
}

/**
 * Resolve the shipped referee wiring from the menu opt-in.
 *
 * @param refereeOptIn - Whether a player opted into the referee loop in the
 *   real setup menu (the "Referee" toggle).
 * @returns The accepted `createSimulation` gate configs and the opt-in card
 *   HUD affordance.  Off resolves to `undefined` / `false` so the default path
 *   stays byte-identical to pre-referee on both the sim and render surfaces.
 */
export function resolveRefereeWiring(refereeOptIn: boolean): RefereeWiring {
  if (!refereeOptIn) {
    return { freeKickConfig: undefined, cardConfig: undefined, cardHud: false };
  }
  return {
    freeKickConfig: { awardFreeKicks: true },
    cardConfig: { issueCards: true },
    cardHud: true,
  };
}
