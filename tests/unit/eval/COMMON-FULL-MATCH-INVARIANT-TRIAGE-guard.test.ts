/**
 * @module tests/unit/eval/COMMON-FULL-MATCH-INVARIANT-TRIAGE-guard.test.ts
 *
 * Discriminating guards for the COMMON-REFERENCES full-match invariant fix
 * (COMMON-FULL-MATCH-INVARIANT-TRIAGE, Horizon v27 3/4).
 *
 * Root cause: `eval/invariants/references.ts#checkEventReferences` resolved
 * `ball.lastTouchRef` only against the CURRENT observation's per-tick `events`.
 * But `lastTouchRef` is a persistent reference to the most recent touch event,
 * which is legitimately emitted on an EARLIER tick. On a full-match observation
 * map nearly every tick carries a `lastTouchRef` pointing at a prior-tick touch
 * event, so the per-tick-only check produced a FAIL on the large majority of
 * observations (a false "broken reference"). The core world-state validator
 * (`src/simulation/world/validate.ts`) already resolves `lastTouchRef` against
 * the cumulative `state.events`, confirming the reference is valid.
 *
 * The fix resolves `lastTouchRef` against the union of every event emitted
 * across the observation window.
 *
 * Guard properties (verified against a real 200-tick full-match map):
 *   - OLD per-tick-only check -> FAIL signature (many fails).
 *   - NEW window-union check  -> 0 fails (fix eliminates the false alarm).
 *   - The `event-references` oracle wiring -> 0 fails.
 *   - A genuinely broken reference -> STILL fail (no oracle weakening).
 *
 * No Math.random, Date, performance, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runHeadlessMatch } from "../../../eval/runners/headless-match.js";
import { checkEventReferences } from "../../../eval/invariants/references.js";
import { executeOracle } from "../../../eval/oracles/oracle-registry.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

// Side-effect import registers the built-in oracles, including event-references.
import "../../../eval/oracles/wire.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function loadScenario(relativePath: string): ScenarioDefinition {
  return JSON.parse(
    readFileSync(join(projectRoot, relativePath), "utf-8"),
  ) as ScenarioDefinition;
}

function runFullMatchWindow(): TelemetryObservation[] {
  const scenario = loadScenario("eval/scenarios/5v5-continuous-play.v1.json");
  const match = runHeadlessMatch({
    scenario,
    maxTicks: 200,
    cpuAntiHuddle: true,
    cpuDefensiveTackle: true,
    browserParityObservations: true,
  });
  return match.observations;
}

describe("COMMON-FULL-MATCH-INVARIANT-TRIAGE: COMMON-REFERENCES prior-tick lastTouchRef", () => {
  it(
    "a full-match map carries persistent lastTouchRef that the window-union fix resolves",
    () => {
      const obs = runFullMatchWindow();

      // The map is a genuine full-match observation mapping: a persistent
      // lastTouchRef (set by a touch on an earlier tick) is carried forward.
      const withRef = obs.filter((o) => o.ball.lastTouchRef !== null);
      expect(withRef.length).toBeGreaterThan(0);

      const allEventIds = new Set(
        obs.flatMap((o) => o.events.map((e) => e.id)),
      );

      // OLD behavior: resolve against the observation's own per-tick events.
      // This produced the FAIL signature on the large majority of the map.
      const oldFails = obs.filter((o) => checkEventReferences(o).status === "fail").length;
      expect(oldFails).toBeGreaterThan(0);

      // NEW behavior: resolve against the window event union. The fix must
      // eliminate every false alarm (the persistent refs all resolve).
      const newFails = obs.filter(
        (o) => checkEventReferences(o, allEventIds).status === "fail",
      ).length;
      expect(newFails).toBe(0);

      // The protected oracle wiring must agree (zero fails over the map).
      const oracleResults = executeOracle(
        "event-references",
        "oracle-references-v1",
        obs,
      );
      const oracleFails = oracleResults.filter((r) => r.status === "fail").length;
      expect(oracleFails).toBe(0);
    },
    60000,
  );

  it(
    "the fix does not weaken the oracle: a genuinely broken reference is still caught",
    () => {
      const obs = runFullMatchWindow();
      const allEventIds = new Set(
        obs.flatMap((o) => o.events.map((e) => e.id)),
      );

      // Clone the map immutably enough to inject a bogus ref on one observation.
      const copy: TelemetryObservation[] = obs.map((o) => ({
        ...o,
        ball: { ...o.ball },
        events: o.events.map((e) => ({ ...e })),
      }));
      const victim = copy.find((o) => o.ball.lastTouchRef !== null);
      expect(victim).toBeDefined();
      victim!.ball.lastTouchRef = "bogus-ref-present-nowhere";

      // Even with the window union, a reference to an event id that exists
      // nowhere in the run is FAIL — the oracle is not weakened.
      const result = checkEventReferences(victim!, allEventIds);
      expect(result.status).toBe("fail");
    },
    60000,
  );

  it(
    "persistent lastTouchRef from a prior tick is a valid reference, not a broken one",
    () => {
      const obs = runFullMatchWindow();
      // Assert there EXISTS an observation whose lastTouchRef references an
      // event id that is only present on an earlier tick. This is the exact
      // mechanism that the per-tick-only check mis-flagged.
      const byId = new Map<string, number>();
      for (const o of obs) {
        for (const e of o.events) {
          if (!byId.has(e.id)) {
            byId.set(e.id, o.tick);
          }
        }
      }
      let found = false;
      for (const o of obs) {
        if (o.ball.lastTouchRef === null) continue;
        const ref = o.ball.lastTouchRef;
        const refTick = byId.get(ref);
        if (refTick !== undefined && refTick < o.tick) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    },
    60000,
  );
});
