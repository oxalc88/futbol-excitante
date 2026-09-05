/**
 * GK-SMALL-SIDED-V1-DRIFT: the adapter-layer keeper configuration must be the
 * spec's versioned provisional record, not a parallel set of numbers.
 *
 * `specs/GOALKEEPER_SPEC.md` §9 declares the values and
 * `eval/contracts/goalkeeper-config.ts` is their machine-readable record. The
 * behavior in `src/adapters/input-browser/goalkeeper-role.ts` cannot import from
 * `eval/` (the dependency rules in TECHNICAL_SPEC §20.3 make evaluation the
 * outermost layer), so it carries the same record and this test is what stops the
 * two from drifting. A silent divergence would mean the implementation invented
 * its own keeper constants, which the hard boundaries forbid.
 *
 * The blocked-reference list is checked too: a value the spec declares
 * BLOCKED_MISSING_REFERENCE must not appear as a number the behavior uses.
 */

import { describe, it, expect } from "vitest";

import {
  GK_SMALL_SIDED_V1,
  GK_GOAL_HALF_WIDTH_METRES,
} from "../../../src/adapters/input-browser/goalkeeper-role.js";
import {
  GK_MODEL_ID,
  GK_MODEL_VERSION,
  GK_PROVISIONAL_VALUES,
  GK_BLOCKED_REFERENCES,
} from "../../../eval/contracts/goalkeeper-config.js";
import { FOUNDATION_GOAL_V1 } from "../../../src/simulation/config/foundation.js";

/** spec key → the adapter config member that carries it. */
const BINDINGS: Array<[string, { value: number | string; unit: string }]> = [
  ["goal_arc_center_x_offset", GK_SMALL_SIDED_V1.goal_arc_center_x_offset],
  ["goal_arc_radius", GK_SMALL_SIDED_V1.goal_arc_radius],
  ["goal_arc_lateral_max", GK_SMALL_SIDED_V1.goal_arc_lateral_max],
  ["keeper_reposition_speed", GK_SMALL_SIDED_V1.keeper_reposition_speed],
  ["keeper_reaction_window_ticks", GK_SMALL_SIDED_V1.keeper_reaction_window_ticks],
  ["save_claim_reach_radius", GK_SMALL_SIDED_V1.save_claim_reach_radius],
  ["distribution_release_window_ticks", GK_SMALL_SIDED_V1.distribution_release_window_ticks],
  ["distribution_no_omniscience", GK_SMALL_SIDED_V1.distribution_no_omniscience],
];

function declared(key: string): { value: number | string; units: string } {
  const entry = GK_PROVISIONAL_VALUES.find((value) => value.key === key);
  if (!entry) throw new Error(`${key} is not declared in ${GK_MODEL_ID}`);
  return { value: entry.value, units: entry.units };
}

describe("GK-DRIFT-001: every implemented keeper value is the spec's declared value", () => {
  it("binds all eight versioned provisional values by key, value and unit", () => {
    expect(BINDINGS.length).toBe(GK_PROVISIONAL_VALUES.length);
    for (const [key, implemented] of BINDINGS) {
      const spec = declared(key);
      expect(implemented.value, `${key} value`).toBe(spec.value);
      expect(implemented.unit, `${key} unit`).toBe(spec.units);
    }
  });

  it("carries the owning model id and version unchanged", () => {
    expect(GK_SMALL_SIDED_V1.id).toBe(GK_MODEL_ID);
    expect(GK_SMALL_SIDED_V1.id).toBe(GK_MODEL_VERSION);
    expect(GK_SMALL_SIDED_V1.label).toBe("provisional");
  });

  it("declares nothing the spec does not", () => {
    const declaredKeys = new Set(GK_PROVISIONAL_VALUES.map((value) => value.key));
    for (const [key] of BINDINGS) {
      expect(declaredKeys.has(key), `${key} declared`).toBe(true);
    }
  });
});

describe("GK-DRIFT-002: blocked references stay blocked", () => {
  it("implements no numeric value for any BLOCKED_MISSING_REFERENCE key", () => {
    const blockedKeys = GK_BLOCKED_REFERENCES.map((entry) => entry.key);
    expect(blockedKeys.length).toBeGreaterThan(0);
    const implementedKeys = Object.keys(GK_SMALL_SIDED_V1);
    for (const key of blockedKeys) {
      expect(implementedKeys, `${key} must not be implemented`).not.toContain(key);
      // The spec's blocked latency/energy/probability quantities must not have
      // smuggled themselves in under a different name either.
      const lookalikes = implementedKeys.filter((name) =>
        /latency|probability|energy|threshold|curve/i.test(name));
      expect(lookalikes).toEqual([]);
    }
  });

  it("every blocked entry is disclosed as BLOCKED_MISSING_REFERENCE", () => {
    for (const entry of GK_BLOCKED_REFERENCES) {
      expect(entry.source).toBe("BLOCKED_MISSING_REFERENCE");
      expect(entry.reason.length).toBeGreaterThan(10);
    }
  });
});

describe("GK-DRIFT-003: the goal the keeper defends is the core's own goal", () => {
  it("derives the half-width from FOUNDATION_GOAL_V1 rather than restating it", () => {
    expect(GK_GOAL_HALF_WIDTH_METRES).toBe(FOUNDATION_GOAL_V1.goalWidth.value / 2);
  });
});
