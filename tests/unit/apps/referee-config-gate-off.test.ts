/**
 * Byte-identity guard for REFEREE-SHIPPED-WIRING.
 *
 * The shipped composition root now calls `createSimulation` with the resolved
 * referee gate configs (which resolve to `undefined` when the Referee toggle is
 * OFF).  This guard proves that the explicit-undefined call the app emits
 * (`createSimulation(world, undefined, ..., undefined, undefined, undefined)` —
 * the ADVANTAGE-BROWSER-EVIDENCE wiring adds the third trailing undefined
 * advantage gate) is byte-identical on the committed state to the pre-change
 * call (`createSimulation(world)`).  So a non-referee mode is byte-neutral on
 * the simulation path.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect } from "vitest";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { FOUNDATION_SCENARIO_5V5 } from "../../../src/apps/browser/foundation-scenario.js";

describe("REFEREE-SHIPPED-WIRING gate-off byte-identity", () => {
  it("createSimulation(world) equals the explicit-undefined referee-off call across a driven stream", () => {
    // Pre-change call: no gate configs at all.
    const base = createSimulation(createWorld({ scenario: FOUNDATION_SCENARIO_5V5 }));
    // The app-layer off-path: the helper's `undefined` gates threaded through.
    const wired = createSimulation(
      createWorld({ scenario: FOUNDATION_SCENARIO_5V5 }),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    // Both start from the same scenario; step 5 ticks and compare the committed
    // state hash chain.  No inputs are applied, so the core's own schedule is
    // the only thing driving state — a hash mismatch would mean the extra
    // undefined arguments changed a byte.
    const baseHashes: string[] = [];
    const wiredHashes: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      baseHashes.push(base.step().stateHash);
      wiredHashes.push(wired.step().stateHash);
    }
    expect(baseHashes).toEqual(wiredHashes);
  });
});
