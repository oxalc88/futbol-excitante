/**
 * Node unit test for the REFEREE-SHIPPED-WIRING app-layer wiring helper
 * (src/apps/browser/referee-config.ts).
 *
 * The shipped composition root derives its accepted referee gate configs from
 * this one helper, so a node test can pin the wiring without the browser:
 *
 *   - OFF (the default) resolves the gates to `undefined` and the card HUD to
 *     `false` — the sim and render paths are byte-identical to pre-referee.
 *   - ON resolves the SAME accepted createSimulation config surface
 *     (`awardFreeKicks:true`, `issueCards:true`, `playAdvantage:true` — the
 *     ADVANTAGE-BROWSER-EVIDENCE window gate on the same wiring) and opts the
 *     card HUD in.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect } from "vitest";
import { resolveRefereeWiring } from "../../../src/apps/browser/referee-config.js";

describe("REFEREE-SHIPPED-WIRING app-layer wiring", () => {
  it("opt-in OFF (default) resolves to undefined gates and cardHud false (byte-neutral)", () => {
    const wiring = resolveRefereeWiring(false);
    expect(wiring.freeKickConfig).toBeUndefined();
    expect(wiring.cardConfig).toBeUndefined();
    expect(wiring.advantageConfig).toBeUndefined();
    expect(wiring.cardHud).toBe(false);
  });

  it("opt-in ON resolves the accepted createSimulation gate config surface", () => {
    const wiring = resolveRefereeWiring(true);
    // The gates flow through the SAME accepted createSimulation config surface.
    expect(wiring.freeKickConfig).toEqual({ awardFreeKicks: true });
    expect(wiring.cardConfig).toEqual({ issueCards: true });
    expect(wiring.advantageConfig).toEqual({ playAdvantage: true });
    expect(wiring.cardHud).toBe(true);
  });

  it("the gates are default-off semantics (no config object carries a false gate)", () => {
    // Always either undefined (off) or { awardFreeKicks:true } / { issueCards:true }
    // / { playAdvantage:true }.
    for (const optIn of [false, true]) {
      const wiring = resolveRefereeWiring(optIn);
      if (wiring.freeKickConfig !== undefined) {
        expect(wiring.freeKickConfig.awardFreeKicks).toBe(true);
      }
      if (wiring.cardConfig !== undefined) {
        expect(wiring.cardConfig.issueCards).toBe(true);
      }
      if (wiring.advantageConfig !== undefined) {
        expect(wiring.advantageConfig.playAdvantage).toBe(true);
      }
    }
  });
});
