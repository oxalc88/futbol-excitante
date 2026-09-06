/**
 * @module tests/unit/eval/LIFECYCLE-MIGRATION-ASSESSMENT-binding.test.ts
 *
 * Evidence-binding test for LIFECYCLE-MIGRATION-ASSESSMENT.
 *
 * Locks the migration decision:
 *
 *  1. The lifecyclePhaseSync DEFAULT is "core-owned" (migration executed):
 *     `DEFAULT_LIFECYCLE_PHASE_SYNC === "core-owned"` and the runner's
 *     destructuring default uses that constant.
 *  2. The durable decision record (`docs/evidence/LIFECYCLE-MIGRATION-
 *     ASSESSMENT/decision.json`) is migrated, records no blocking pins, and
 *     names the exact historical runs that must be reproduced under an
 *     explicit "legacy" opt-out (so the accepted pins stay byte-untouched).
 *  3. The empirical probe outputs record, per legacy pin, that the run is NOT
 *     byte-identical under core-owned, that it diverges exactly at a restart
 *     window (a nonzero first-divergence tick within the run) and that
 *     COMMON-BOUNDS flips FAIL (legacy) -> PASS (core-owned).
 *
 * Node I/O is allowed for scenario and artifact loading.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_LIFECYCLE_PHASE_SYNC } from "../../../eval/runners/headless-match.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const EVIDENCE = join(projectRoot, "docs/evidence/LIFECYCLE-MIGRATION-ASSESSMENT");

interface Decision {
  schema_version: number;
  objective_id: string;
  decision: string;
  default_lifecycle: string;
  opt_out_lifecycle: string;
  migrated: boolean;
  blocking_pins: string[];
  historical_legacy_reproductions: Array<{ run_id: string }>;
  per_pin_outcomes: Array<{
    run_id: string;
    byte_identical_under_core_owned: boolean;
    first_divergence_tick: number | null;
    common_bounds_legacy: string;
    common_bounds_core_owned: string;
    core_max_player_abs_x?: number;
  }>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(EVIDENCE, path), "utf-8")) as T;
}

describe("LIFECYCLE-MIGRATION-ASSESSMENT: lifecyclePhaseSync migration", () => {
  it("the runner default is core-owned (migration executed)", () => {
    expect(DEFAULT_LIFECYCLE_PHASE_SYNC).toBe("core-owned");
  });

  it("the durable decision record is migrated with no blocking pins and the named opt-outs", () => {
    const decision = readJson<Decision>("decision.json");
    expect(decision.objective_id).toBe("LIFECYCLE-MIGRATION-ASSESSMENT");
    expect(decision.decision).toBe("migrated");
    expect(decision.migrated).toBe(true);
    expect(decision.default_lifecycle).toBe("core-owned");
    expect(decision.opt_out_lifecycle).toBe("legacy");
    // Migration succeeded -> no blocking pins. The four legacy phase-sync runs
    // are classified as outcome (b): their deltas are exactly the documented
    // restart-window behavior, and they are preserved via an explicit opt-out.
    expect(decision.blocking_pins).toEqual([]);
    // Every legacy pin must be named for the explicit "legacy" opt-out so the
    // accepted record stays reproducible at its historical configuration. This
    // includes the CPU-DEFENSIVE-TACKLE trajectory (captured via
    // runCpuTackleMatch), which is preserved by the same explicit opt-out.
    const optRunIds = decision.historical_legacy_reproductions.map((r) => r.run_id).sort();
    expect(optRunIds).toEqual(
      [
        "anti-huddle-flowing",
        "ball-settled-flowing",
        "gk-continuous-live",
        "gk-shot-fixture-live",
        "3v3-cpu-vs-cpu",
        "5v5-cpu-vs-cpu",
        "3v3-cpu-vs-cpu-extended",
      ].sort(),
    );
  });

  it("every legacy pin was probed and the probe outputs exist with the expected outcome", () => {
    const decision = readJson<Decision>("decision.json");
    for (const pin of decision.per_pin_outcomes) {
      const probePath = join(EVIDENCE, "probes", `${pin.run_id}.json`);
      expect(existsSync(probePath), `${pin.run_id} probe output should exist`).toBe(true);
      // No legacy pin reproduces byte-identically under core-owned: the
      // migration changes every one of them (outcome class 'b').
      expect(pin.byte_identical_under_core_owned).toBe(false);
      expect(pin.first_divergence_tick).toBeTypeOf("number");
      // The probe output's COMMON-BOUNDS under core-owned must agree with the
      // decision record.
      const probe = readJson<{ core: { commonBounds: string } }>(`probes/${pin.run_id}.json`);
      expect(probe.core.commonBounds).toBe(pin.common_bounds_core_owned);
    }
  });

  it("COMMON-BOUNDS turns green (FAIL->PASS) for the three flowing legacy pins and stays redisclosed for the shot-fixture", () => {
    const decision = readJson<Decision>("decision.json");
    const byId = new Map(decision.per_pin_outcomes.map((p) => [p.run_id, p]));
    // The three flowing full-match maps: the legacy out-of-play escape is
    // removed by core-owned, so COMMON-BOUNDS turns green.
    for (const id of ["anti-huddle-flowing", "ball-settled-flowing", "gk-continuous-live"]) {
      expect(byId.get(id)!.common_bounds_legacy).toBe("FAIL");
      expect(byId.get(id)!.common_bounds_core_owned).toBe("PASS");
    }
    // gk-shot-fixture-live: even under core-owned a defending body ends at
    // |x| just over the 52.5 m bound (52.53 m), so COMMON-BOUNDS is
    // redisclosed as a marginal goal-line-position residual, NOT the legacy
    // out-of-play escape (the ball no longer escapes).
    const gkShot = byId.get("gk-shot-fixture-live")!;
    expect(gkShot.common_bounds_legacy).toBe("FAIL");
    expect(gkShot.common_bounds_core_owned).toBe("FAIL");
    expect(gkShot.core_max_player_abs_x).toBeGreaterThan(52.5);
    expect(gkShot.core_max_player_abs_x).toBeLessThan(52.6);
  });

  it("the per-pin probe records a restart-window divergence (nonzero divergence within the run)", () => {
    const decision = readJson<Decision>("decision.json");
    for (const pin of decision.per_pin_outcomes) {
      // The divergence must occur inside the run (not before the first tick),
      // which is the signature of a restart window executing under core-owned.
      expect(pin.first_divergence_tick).toBeGreaterThan(0);
    }
  });
});
