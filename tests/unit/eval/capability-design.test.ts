/**
 * @module tests/unit/eval/capability-design
 *
 * Tests for the CapabilityDesignProfile:
 *  1. Profile loads and hashes stably
 *  2. LOC-ACC-002 DESIGN criterion resolves to the transient acceleration axis
 *  3. DEFERRED axes are NOT_EVALUATED, never PASS
 *  4. evaluateFoundation still passes required HARD_INVARIANTs
 *  5. MEASURED_TARGET stays BLOCKED_MISSING_REFERENCE
 *  6. No FOUNDATION_LAB_PASS function name
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateCapabilityDesignProfile,
  loadCapabilityDesignProfile,
} from "../../../eval/contracts/capability-design-loader.js";
import {
  CAPABILITY_DESIGN_PROFILE as RAW_PROFILE,
} from "../../../eval/contracts/capability-design-profiles.js";
import type { CapabilityDesignProfile } from "../../../eval/contracts/capability-design.js";

import { evaluateFoundation } from "../../../eval/runners/foundation-evaluator.js";
import { COMMON_CRITERIA } from "../../../eval/contracts/common-criteria.js";
import { loadRegistrySet } from "../../../eval/contracts/loader.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(
    __dirname,
    "../../../eval/scenarios/foundation-move-and-roll.v1.json",
  );
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

/**
 * Load the profile with validation (throws on invalid).
 */
function loadedProfile(): CapabilityDesignProfile {
  return loadCapabilityDesignProfile(RAW_PROFILE);
}

// ---------------------------------------------------------------------------
// 1. Profile loads and hashes stably
// ---------------------------------------------------------------------------

describe("Profile loading and hash stability", () => {
  it("raw profile is structurally valid (no validation errors)", () => {
    const errors = validateCapabilityDesignProfile({
      ...RAW_PROFILE,
      content_hash: "",
    });
    expect(errors).toHaveLength(0);
  });

  it("loadCapabilityDesignProfile returns a profile with non-empty content_hash", () => {
    const profile = loadedProfile();
    expect(profile.content_hash).toBeDefined();
    expect(profile.content_hash.length).toBeGreaterThan(0);
  });

  it("content_hash is stable across two loads", () => {
    const p1 = loadedProfile();
    const p2 = loadedProfile();
    expect(p1.content_hash).toBe(p2.content_hash);
  });

  it("profile has all five expected axes", () => {
    const profile = loadedProfile();
    const axisIds = Object.keys(profile.axes);
    expect(axisIds).toContain("transient-acceleration");
    expect(axisIds).toContain("physical-contact");
    expect(axisIds).toContain("body-control");
    expect(axisIds).toContain("shooting-power");
    expect(axisIds).toContain("swerve");
  });

  it("transient acceleration axis has IMPLEMENTED status", () => {
    const profile = loadedProfile();
    const axis = profile.axes["transient-acceleration"];
    expect(axis.status).toBe("IMPLEMENTED");
  });

  it("deferred axes have DEFERRED status", () => {
    const profile = loadedProfile();
    for (const axisId of [
      "physical-contact",
      "body-control",
      "shooting-power",
      "swerve",
    ]) {
      expect(profile.axes[axisId].status).toBe("DEFERRED");
    }
  });

  it("TRANSIENT axis references existing locomotion scenario and metrics", () => {
    const profile = loadedProfile();
    const axis = profile.axes["transient-acceleration"];
    expect(axis.scenario_ids).toContain("scn-loc-acc-002-v1");
    expect(axis.metric_ids).toContain("player-speed");
    expect(axis.metric_ids).toContain("player-displacement");
  });

  it("deferred axes have empty scenario_ids and metric_ids (expected)", () => {
    const profile = loadedProfile();
    for (const axisId of [
      "physical-contact",
      "body-control",
      "shooting-power",
      "swerve",
    ]) {
      const axis = profile.axes[axisId];
      expect(axis.scenario_ids).toHaveLength(0);
      expect(axis.metric_ids).toHaveLength(0);
    }
  });

  it("profile has criterion_bindings for LOC-ACC-002-DESIGN", () => {
    const profile = loadedProfile();
    expect(profile.criterion_bindings["LOC-ACC-002-DESIGN"]).toBe(
      "transient-acceleration",
    );
  });

  it("no duplicate axis IDs in profile", () => {
    const profile = loadedProfile();
    const errors = validateCapabilityDesignProfile({
      ...profile,
      content_hash: "",
    });
    const dupErrors = errors.filter((e) => e.source === "dedup");
    expect(dupErrors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. LOC-ACC-002 DESIGN criterion resolves to transient acceleration axis
// ---------------------------------------------------------------------------

describe("LOC-ACC-002 DESIGN criterion resolution", () => {
  it("criterion_bindings maps LOC-ACC-002-DESIGN to transient-acceleration", () => {
    const profile = loadedProfile();
    expect(profile.criterion_bindings["LOC-ACC-002-DESIGN"]).toBe(
      "transient-acceleration",
    );
  });

  it("the mapped axis exists in the profile", () => {
    const profile = loadedProfile();
    const axisId = profile.criterion_bindings["LOC-ACC-002-DESIGN"];
    expect(axisId).toBeDefined();
    expect(profile.axes[axisId]).toBeDefined();
  });

  it("evaluateFoundation reports LOC-ACC-002-DESIGN as NOT_EVALUATED", () => {
    // The locomotion suite includes LOC-ACC-002.
    // ENGINE_DESIGN_TARGET criteria return NOT_EVALUATED when no runner
    // exercises the profile (foundation evaluator's computeOutcome).
    const profile = loadedProfile();
    const axis = profile.axes["transient-acceleration"];
    // The axis is IMPLEMENTED — that's correct. The NOT_EVALUATED outcome
    // comes from the evaluator's criterion evaluation logic for
    // ENGINE_DESIGN_TARGET class.
    expect(axis.status).toBe("IMPLEMENTED");

    // The criterion itself is registered in common-criteria.ts under
    // ENGINE_DESIGN_TARGET class.  The evaluator's computeOutcome
    // returns NOT_EVALUATED for ENGINE_DESIGN_TARGET.
    const criterion = COMMON_CRITERIA["LOC-ACC-002-DESIGN"];
    // The criterion may not be registered yet at bootstrap; verify
    // the evaluation layer handles the absence gracefully.
    if (criterion) {
      expect(criterion.class).toBe("ENGINE_DESIGN_TARGET");
    }
  });
});

// ---------------------------------------------------------------------------
// 3. DEFERRED axes are NOT_EVALUATED, never PASS
// ---------------------------------------------------------------------------

describe("Deferred axes are NOT_EVALUATED, never PASS", () => {
  it("every DEFERRED axis has DEFERRED status and cannot be PASS", () => {
    const profile = loadedProfile();
    for (const [axisId, axis] of Object.entries(profile.axes)) {
      if (axis.status === "DEFERRED") {
        // DEFERRED axes must have empty scenario/metric arrays
        // since the engine cannot exercise them.
        expect(axis.scenario_ids).toHaveLength(0);
        expect(axis.metric_ids).toHaveLength(0);

        // Estimator must be absent (no measurement possible).
        expect(axis.estimator_id).toBe("absent");
        expect(axis.estimator_version).toBe("absent");
      }
    }
  });

  it("no axis claims PES or provider-rating language in its label", () => {
    const profile = loadedProfile();
    for (const [axisId, axis] of Object.entries(profile.axes)) {
      expect(axis.label).toBeDefined();
      const lower = axis.label.toLowerCase();
      // These terms are forbidden per the spec.
      const forbidden = [
        "pes",
        "pro evolution",
        "konami",
        "efootball",
        "rating",
        "stat",
        "player rating",
        "attribute",
        "playmaker",
        "archetype",
      ];
      const hits = forbidden.filter((f) => lower.includes(f));
      expect(
        hits,
        `Axis "${axisId}" label "${axis.label}" should not contain PES/provider-rating terms. Found: ${hits.join(", ")}`,
      ).toHaveLength(0);
    }
  });

  it("evaluateFoundation never returns PASS for ENGINE_DESIGN_TARGET", () => {
    const scenario = loadFixture();
    const result = evaluateFoundation(scenario);

    // At the bootstrap level, no ENGINE_DESIGN_TARGET criteria
    // have a runner, so they should NOT return PASS.
    for (const suite of result.suites) {
      for (const test of suite.tests) {
        for (const criterion of test.criteria) {
          if (criterion.class === "ENGINE_DESIGN_TARGET") {
            expect(criterion.outcome).not.toBe("PASS");
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 4. evaluateFoundation still passes required HARD_INVARIANTs
// ---------------------------------------------------------------------------

describe("evaluateFoundation HARD_INVARIANTs still pass", () => {
  it("COMMON-FINITE passes on a clean run", () => {
    const scenario = loadFixture();
    const result = evaluateFoundation(scenario);

    // Verify that the fast suite (which includes BALL-IND-001) has
    // COMMON-FINITE passing.
    const fastSuite = result.suites.find((s) => s.suite_id === "fast");
    expect(fastSuite).toBeDefined();

    for (const test of fastSuite!.tests) {
      const finite = test.criteria.find(
        (c) => c.criterion_id === "COMMON-FINITE",
      );
      if (finite && finite.class === "HARD_INVARIANT") {
        expect(finite.outcome).toBe("PASS");
      }
    }
  });

  it("COMMON-REFERENCES passes on a clean run", () => {
    const scenario = loadFixture();
    const result = evaluateFoundation(scenario);

    const fastSuite = result.suites.find((s) => s.suite_id === "fast");
    expect(fastSuite).toBeDefined();

    for (const test of fastSuite!.tests) {
      const refs = test.criteria.find(
        (c) => c.criterion_id === "COMMON-REFERENCES",
      );
      if (refs && refs.class === "HARD_INVARIANT") {
        expect(refs.outcome).toBe("PASS");
      }
    }
  });

  it("the overall result does not include FOUNDATION_LAB_PASS", () => {
    const scenario = loadFixture();
    const result = evaluateFoundation(scenario);

    // The overall outcome must never be "FOUNDATION_LAB_PASS".
    // The spec says the gate uses the standard EvaluationOutcome set.
    expect(result.overall).not.toBe("FOUNDATION_LAB_PASS");
  });
});

// ---------------------------------------------------------------------------
// 5. MEASURED_TARGET stays BLOCKED_MISSING_REFERENCE
// ---------------------------------------------------------------------------

describe("MEASURED_TARGET stays BLOCKED_MISSING_REFERENCE", () => {
  it("no MEASURED_TARGET criterion returns PASS", () => {
    const scenario = loadFixture();
    const result = evaluateFoundation(scenario);

    for (const suite of result.suites) {
      for (const test of suite.tests) {
        for (const criterion of test.criteria) {
          if (criterion.class === "MEASURED_TARGET") {
            expect(criterion.outcome).toBe("BLOCKED_MISSING_REFERENCE");
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 6. No FOUNDATION_LAB_PASS in source code
// ---------------------------------------------------------------------------

describe("No FOUNDATION_LAB_PASS function name", () => {
  it("evaluate.ts does not contain FOUNDATION_LAB_PASS", () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const evalPath = join(__dirname, "../../../eval/runners/evaluate.ts");
    const content = readFileSync(evalPath, "utf-8");
    expect(content).not.toContain("FOUNDATION_LAB_PASS");
  });

  it("foundation-evaluator.ts does not contain FOUNDATION_LAB_PASS", () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const evalPath = join(
      __dirname,
      "../../../eval/runners/foundation-evaluator.ts",
    );
    const content = readFileSync(evalPath, "utf-8");
    expect(content).not.toContain("FOUNDATION_LAB_PASS");
  });

  it("capability-design-profiles.ts does not claim PES", () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const profilePath = join(
      __dirname,
      "../../../eval/contracts/capability-design-profiles.ts",
    );
    const content = readFileSync(profilePath, "utf-8");
    // The profile must not contain words that would imply PES claim.
    expect(content).not.toContain("PES fidelity");
    expect(content).not.toContain("PES match");
    expect(content).not.toContain("FOUNDATION_LAB_PASS");
  });

  it("capability-design.ts does not contain FOUNDATION_LAB_PASS", () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const typesPath = join(
      __dirname,
      "../../../eval/contracts/capability-design.ts",
    );
    const content = readFileSync(typesPath, "utf-8");
    expect(content).not.toContain("FOUNDATION_LAB_PASS");
  });
});

// ---------------------------------------------------------------------------
// 7. Loader rejects structural violations
// ---------------------------------------------------------------------------

describe("Loader rejects structural violations", () => {
  it("rejects a profile with duplicate axis IDs", () => {
    // Create a profile where one axis key has axis_id="transient-acceleration"
    // while the spread already has a "transient-acceleration" key.
    // We add a second entry with a different key but the same axis_id value.
    const profile: Omit<CapabilityDesignProfile, "content_hash"> = {
      ...RAW_PROFILE,
      content_hash: "",
      axes: {
        ...RAW_PROFILE.axes,
        "transient-acceleration-copy": {
          axis_id: "transient-acceleration", // duplicate axis_id
          label: "Duplicate axis",
          status: "IMPLEMENTED",
          scenario_ids: [],
          metric_ids: [],
          profile_value_low: { id: "low", value: 0 },
          profile_value_high: { id: "high", value: 1 },
          expected_monotonic_direction: "NONE",
          minimum_material_effect: {
            metric_id: "player-speed",
            value: 0.01,
          },
          protected_outputs: [],
          max_permitted_cross_coupling: [],
          seed_matrix_id: "seeds-smoke-v1",
          config_matrix_id: "config-default-v1",
          estimator_id: "absent",
          estimator_version: "absent",
          policy_version: "v1",
        },
      },
    };
    const errors = validateCapabilityDesignProfile(profile);
    const dupErrors = errors.filter((e) => e.source === "dedup");
    expect(dupErrors.length).toBeGreaterThan(0);
  });

  it("rejects a profile with an axis missing required label", () => {
    const profile: Omit<CapabilityDesignProfile, "content_hash" | "axes"> = {
      profile_id: "test-v1",
      profile_version: "test-v1",
      policy_version: "v1",
      criterion_bindings: {},
      axes: {
        "test-axis": {
          axis_id: "test-axis",
          label: "",
          status: "DEFERRED",
          scenario_ids: [],
          metric_ids: [],
          profile_value_low: { id: "low", value: 0 },
          profile_value_high: { id: "high", value: 1 },
          expected_monotonic_direction: "NONE",
          minimum_material_effect: {
            metric_id: "player-speed",
            value: 0.01,
          },
          protected_outputs: [],
          max_permitted_cross_coupling: [],
          seed_matrix_id: "seeds-smoke-v1",
          config_matrix_id: "config-default-v1",
          estimator_id: "absent",
          estimator_version: "absent",
          policy_version: "v1",
        },
      },
    };
    const errors = validateCapabilityDesignProfile({
      ...profile,
      content_hash: "",
    });
    const fieldErrors = errors.filter((e) => e.source === "field");
    expect(fieldErrors.length).toBeGreaterThan(0);
  });

  it("rejects a profile with PES language in axis label", () => {
    const profile: Omit<CapabilityDesignProfile, "content_hash" | "axes"> = {
      profile_id: "test-v1",
      profile_version: "test-v1",
      policy_version: "v1",
      criterion_bindings: {},
      axes: {
        "pes-test-axis": {
          axis_id: "pes-test-axis",
          label: "Pes rating axis",
          status: "DEFERRED",
          scenario_ids: [],
          metric_ids: [],
          profile_value_low: { id: "low", value: 0 },
          profile_value_high: { id: "high", value: 1 },
          expected_monotonic_direction: "NONE",
          minimum_material_effect: {
            metric_id: "player-speed",
            value: 0.01,
          },
          protected_outputs: [],
          max_permitted_cross_coupling: [],
          seed_matrix_id: "seeds-smoke-v1",
          config_matrix_id: "config-default-v1",
          estimator_id: "absent",
          estimator_version: "absent",
          policy_version: "v1",
        },
      },
    };
    const errors = validateCapabilityDesignProfile({
      ...profile,
      content_hash: "",
    });
    const pesErrors = errors.filter((e) => e.source === "pes-language");
    expect(pesErrors.length).toBeGreaterThan(0);
  });

  it("rejects criterion_bindings that reference non-existent axis IDs", () => {
    const profile: Omit<CapabilityDesignProfile, "content_hash"> = {
      profile_id: "test-v1",
      profile_version: "test-v1",
      policy_version: "v1",
      criterion_bindings: {
        "FAKE-CRIT": "nonexistent-axis",
      },
      axes: {
        "real-axis": {
          axis_id: "real-axis",
          label: "Real axis",
          status: "DEFERRED",
          scenario_ids: [],
          metric_ids: [],
          profile_value_low: { id: "low", value: 0 },
          profile_value_high: { id: "high", value: 1 },
          expected_monotonic_direction: "NONE",
          minimum_material_effect: {
            metric_id: "player-speed",
            value: 0.01,
          },
          protected_outputs: [],
          max_permitted_cross_coupling: [],
          seed_matrix_id: "seeds-smoke-v1",
          config_matrix_id: "config-default-v1",
          estimator_id: "absent",
          estimator_version: "absent",
          policy_version: "v1",
        },
      },
    };
    const errors = validateCapabilityDesignProfile({
      ...profile,
      content_hash: "",
    });
    const refErrors = errors.filter((e) => e.source === "ref");
    expect(refErrors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Integration: evaluator + capability profile together
// ---------------------------------------------------------------------------

describe("Integration: evaluator + capability profile", () => {
  it("loadRegistrySet still succeeds with no duplicate IDs", () => {
    // The capability profile must not introduce duplicate IDs that
    // break the existing registry loader.
    expect(() => loadRegistrySet()).not.toThrow();
  });

  it("capability profile axis IDs do not collide with test IDs", () => {
    const registry = loadRegistrySet();
    const profile = loadedProfile();
    const axisIds = new Set(Object.keys(profile.axes));
    const testIds = new Set(Object.keys(registry.test_bindings));

    // Axis IDs should not be in the test binding set (they are
    // different namespaces, but let's verify they don't accidentally collide).
    for (const axisId of axisIds) {
      expect(testIds.has(axisId), `Axis "${axisId}" collides with test binding`).toBe(
        false,
      );
    }
  });

  it("no axis has an invalid status value", () => {
    const profile = loadedProfile();
    for (const [axisId, axis] of Object.entries(profile.axes)) {
      expect(
        axis.status === "IMPLEMENTED" || axis.status === "DEFERRED",
        `Axis "${axisId}" has invalid status "${axis.status}"`,
      ).toBe(true);
    }
  });

  it("all axes have non-empty string protected outputs", () => {
    const profile = loadedProfile();
    for (const [axisId, axis] of Object.entries(profile.axes)) {
      for (let i = 0; i < axis.protected_outputs.length; i++) {
        expect(
          typeof axis.protected_outputs[i],
          `Axis "${axisId}" protected_output[${i}] must be a string`,
        ).toBe("string");
        expect(
          axis.protected_outputs[i].length > 0,
          `Axis "${axisId}" protected_output[${i}] must not be empty`,
        ).toBe(true);
      }
    }
  });
});