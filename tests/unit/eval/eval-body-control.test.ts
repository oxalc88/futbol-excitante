/**
 * @module tests/unit/eval/eval-body-control
 *
 * Tests for the body-control capability-design axis evaluation.
 *
 * Verifies:
 *  1. Low vs high combined knobs (turnRate + lateralResistance)
 *     produce heading-change delta in DECREASE direction.
 *  2. Honesty check runs (heading changes produced).
 *  3. Zero-effect (low==high config) → FAIL.
 *  4. Cross-coupling violation (threshold exceeded) → FAIL.
 *  5. Swerve stays DEFERRED.
 *  6. Other 3 axes keep PASSing (regression).
 *  7. Determinism.
 *  8. Estimator declaration matches runner's actual tick/quantity.
 *  9. No theatrical canaries.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";

import { loadDefaultCapabilityDesignProfile } from "../../../eval/contracts/capability-design-loader.js";
import {
  evaluateCapabilityDesign,
  evaluateBodyControlAxisDirect,
} from "../../../eval/runners/evaluate-capability-design.js";
import { SCENARIO_REGISTRY } from "../../../eval/contracts/scenarios.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// 1. Low vs high combined knobs → heading-change delta in DECREASE direction
// ---------------------------------------------------------------------------

describe("body-control: low vs high heading-change delta", () => {
  it("heading-change delta is in the declared DECREASE direction", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["body-control"];
    expect(axis).toBeDefined();
    expect(axis!.status).toBe("IMPLEMENTED");
    expect(axis!.expected_monotonic_direction).toBe("DECREASE");

    const result = evaluateCapabilityDesign({ profile });
    const axisResult = result.axes.find((a) => a.axis_id === "body-control");
    expect(axisResult).toBeDefined();

    // The runner must measure real values (not N/A).
    const hasNA = axisResult!.evidence.some((e) => e.includes("N/A"));
    expect(hasNA).toBe(false);

    // Check the delta is in DECREASE direction: high turn rate + higher
    // lateralResistance → heading converges faster → smaller heading-change
    // at the estimator tick (t20).  So low > high, delta = high - low < 0.
    const headingLine = axisResult!.evidence.find((e) =>
      e.includes("Heading change at t"),
    );
    expect(headingLine).toBeDefined();
    // Extract low and high values from the evidence.
    const lowMatch = headingLine!.match(/low=([-\d.]+)/);
    const highMatch = headingLine!.match(/high=([-\d.]+)/);
    expect(lowMatch).not.toBeNull();
    expect(highMatch).not.toBeNull();
    const lowVal = parseFloat(lowMatch![1]);
    const highVal = parseFloat(highMatch![1]);

    // DECREASE: high → heading converges faster → smaller heading-change
    // at t20.  So low > high, delta = high - low < 0.
    expect(highVal).toBeLessThan(lowVal - EPSILON);
  });

  it("delta meets minimum material effect", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["body-control"];
    expect(axis!.minimum_material_effect.value).toBe(0.01);

    const result = evaluateCapabilityDesign({ profile });
    const axisResult = result.axes.find((a) => a.axis_id === "body-control");
    expect(axisResult).toBeDefined();

    // Check evidence for materiality.
    const matLine = axisResult!.evidence.find((e) =>
      e.includes("Minimum material effect"),
    );
    expect(matLine).toBeDefined();
    expect(matLine!.includes("true")).toBe(true);
  });

  it("outcome is PASS", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });
    const axisResult = result.axes.find((a) => a.axis_id === "body-control");
    expect(axisResult!.outcome).toBe("PASS");
  });

  it("delta is non-zero", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });
    const axisResult = result.axes.find((a) => a.axis_id === "body-control");

    const deltaLine = axisResult!.evidence.find((e) =>
      e.includes("Delta heading change"),
    );
    expect(deltaLine).toBeDefined();
    const deltaMatch = deltaLine!.match(/Delta heading change: ([-\d.]+)/);
    expect(deltaMatch).not.toBeNull();
    const delta = parseFloat(deltaMatch![1]);
    expect(Math.abs(delta)).toBeGreaterThan(EPSILON);
  });

  it("displacement cross-coupling check is OK in PASS case", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });
    const axisResult = result.axes.find((a) => a.axis_id === "body-control");

    const ccOk = axisResult!.evidence.some((e) => e.includes("Cross-coupling OK"));
    expect(ccOk).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Honesty check: heading changes produced
// ---------------------------------------------------------------------------

describe("body-control: honesty (heading changes produced)", () => {
  it("runner evidence shows heading changes produced", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["body-control"];
    expect(axis).toBeDefined();
    const result = evaluateCapabilityDesign({ profile });
    const axisResult = result.axes.find((a) => a.axis_id === "body-control");

    // Verify the honesty check ran and both runs show heading change.
    const honestyEvidence = axisResult!.evidence.find((e) =>
      e.includes("Heading changes produced"),
    );
    expect(honestyEvidence).toBeDefined();
    // Both runs must show heading change was produced.
    expect(honestyEvidence!.includes("true")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Zero-effect scenario (low==high config) → FAIL
// ---------------------------------------------------------------------------

describe("body-control: zero-effect (low==high) → FAIL", () => {
  it("forces zero-effect and runner returns FAIL", () => {
    // Deep-clone the default profile and set both profile values to the
    // same turnRate + lateralResistance, making delta == 0.
    // CRITICAL: load a fresh profile here so other tests that reuse
    // `profile` don't inherit our mutation.
    const profile = loadDefaultCapabilityDesignProfile();
    profile.axes["body-control"] = {
      ...profile.axes["body-control"],
      profile_value_low: { id: "body-control-zero", value: 5.0 },
      profile_value_high: { id: "body-control-zero", value: 5.0 },
      lateral_resistance_low: { value: 0.58, note: "forced equal" },
      lateral_resistance_high: { value: 0.58, note: "forced equal" },
    };

    const result = evaluateCapabilityDesign({ profile });
    const axisResult = result.axes.find((a) => a.axis_id === "body-control");

    // The runner must detect zero effect and return FAIL.
    expect(axisResult!.outcome).toBe("FAIL");
    expect(axisResult!.evidence.some((e) =>
      e.includes("No measurable effect from turn rate variation"),
    )).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Cross-coupling violation → FAIL
// ---------------------------------------------------------------------------

describe("body-control: cross-coupling violation → FAIL", () => {
  it("forces cross-coupling violation and runner returns FAIL", () => {
    // The actual displacement delta between low/high knobs is ~7e-6.
    // Use a sub-microscopic threshold to force the violation branch.
    const testAxis: Parameters<typeof evaluateBodyControlAxisDirect>[0] = {
      axis_id: "body-control",
      profile_value_low: { id: "body-control-low", value: 4.0 },
      profile_value_high: { id: "body-control-high", value: 7.0 },
      expected_monotonic_direction: "DECREASE",
      minimum_material_effect: { metric_id: "player-heading-change", value: 0.01 },
      max_permitted_cross_coupling: [
        // Threshold below actual displacement delta (~7e-6),
        // forcing a cross-coupling violation.
        { metric_id: "player-displacement", threshold: 1e-8 },
      ],
      estimator_id: "delta-heading-change-at-t20",
      estimator_version: "estimator-delta-heading-change-v1",
      lateral_resistance_low: { value: 0.5, note: "provisional low" },
      lateral_resistance_high: { value: 0.65, note: "provisional high" },
    };
    const result = evaluateBodyControlAxisDirect(testAxis);

    // The runner must detect cross-coupling violation and return FAIL.
    expect(result.outcome).toBe("FAIL");
    expect(result.evidence.some((e) => e.includes("Cross-coupling FAIL"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Swerve is IMPLEMENTED
// ---------------------------------------------------------------------------

describe("swerve is IMPLEMENTED", () => {
  it("swerve axis has IMPLEMENTED status", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["swerve"];
    expect(axis.status).toBe("IMPLEMENTED");
  });

  it("swerve returns PASS outcome, not DEFERRED", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });
    const axisResult = result.axes.find((a) => a.axis_id === "swerve");
    expect(axisResult!.outcome).toBe("PASS");
    expect(axisResult!.outcome).not.toBe("DEFERRED");
  });
});

// ---------------------------------------------------------------------------
// 6. Regression: other 3 axes keep PASSing
// ---------------------------------------------------------------------------

describe("regression: other axes still PASS", () => {
  it("transient-acceleration axis still PASSes", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });
    const axisResult = result.axes.find((a) => a.axis_id === "transient-acceleration");
    expect(axisResult!.outcome).toBe("PASS");
  });

  it("physical-contact axis still PASSes", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });
    const axisResult = result.axes.find((a) => a.axis_id === "physical-contact");
    expect(axisResult!.outcome).toBe("PASS");
  });

  it("shooting-power axis still PASSes", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });
    const axisResult = result.axes.find((a) => a.axis_id === "shooting-power");
    expect(axisResult!.outcome).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// 7. Determinism
// ---------------------------------------------------------------------------

describe("body-control: deterministic evaluation", () => {
  it("same profile produces identical body-control results", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const r1 = evaluateCapabilityDesign({ profile });
    const r2 = evaluateCapabilityDesign({ profile });

    const b1 = r1.axes.find((a) => a.axis_id === "body-control");
    const b2 = r2.axes.find((a) => a.axis_id === "body-control");

    expect(b1!.outcome).toBe(b2!.outcome);
    expect(b1!.evidence).toEqual(b2!.evidence);
  });
});

// ---------------------------------------------------------------------------
// 8. Estimator declaration matches runner's actual tick/quantity
// ---------------------------------------------------------------------------

describe("body-control: estimator declaration", () => {
  it("profile estimator_id matches runner's actual measurement", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["body-control"];
    // The estimator name now matches what the runner actually measures:
    // per-tick heading-change at the declared tick.
    expect(axis.estimator_id).toBe("delta-heading-change-at-t20");
    expect(axis.estimator_version).toBe("estimator-delta-heading-change-v1");

    const result = evaluateCapabilityDesign({ profile });
    const axisResult = result.axes.find((a) => a.axis_id === "body-control");

    // Evidence must mention the estimator tick (t20) AND the delta value.
    const tickEvidence = axisResult!.evidence.find((e) =>
      e.includes("Heading change at t20"),
    );
    expect(tickEvidence).toBeDefined();
    const deltaEvidence = axisResult!.evidence.find((e) =>
      e.includes("Delta heading change"),
    );
    expect(deltaEvidence).toBeDefined();
  });

  it("profile estimator_id is not 'absent'", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["body-control"];
    expect(axis.estimator_id).not.toBe("absent");
    expect(axis.estimator_version).not.toBe("absent");
  });
});

// ---------------------------------------------------------------------------
// 9. No theatrical canaries
// ---------------------------------------------------------------------------

describe("no theatrical canaries", () => {
  it("evaluateCapabilityDesign does not claim PES fidelity", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    for (const axis of result.axes) {
      for (const evidence of axis.evidence) {
        expect(evidence).not.toContain("PES fidelity");
        expect(evidence).not.toContain("PES match");
        expect(evidence).not.toContain("FOUNDATION_LAB_PASS");
      }
    }
  });

  it("body-control axis does not return PASS for DEFERRED axes", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    for (const axis of result.axes) {
      const profileAxis = profile.axes[axis.axis_id];
      if (profileAxis.status === "DEFERRED") {
        expect(axis.outcome).not.toBe("PASS");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 10. Scenario registry check
// ---------------------------------------------------------------------------

describe("body-control scenario registry", () => {
  it("body-control scenario exists in SCENARIO_REGISTRY", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["body-control"];
    expect(axis.scenario_ids).toContain("scn-body-ctrl-001-v1");
    expect(SCENARIO_REGISTRY["scn-body-ctrl-001-v1"]).toBeDefined();
  });
});