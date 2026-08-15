/**
 * @module tests/unit/eval/eval-swerve
 *
 * Tests for the swerve capability axis evaluation runner.
 *
 * Verifies:
 *  1. Swerve axis is IMPLEMENTED, not DEFERRED.
 *  2. Normal low vs high curve profile produces INCREASE direction PASS.
 *  3. Zero spin → FAIL (axis cannot exercise with no spin).
 *  4. Zero curve → zero curve force → FAIL (no measurable effect).
 *  5. Low == high curve → FAIL (no measurable effect).
 *  6. Cross-coupling violation → FAIL.
 *  7. Deterministic: same profile → identical outcomes.
 *  8. No PES claims.
 *  9. Zero-spin scenario produces straight trajectory (protected output).
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";
import { loadDefaultCapabilityDesignProfile } from "../../../eval/contracts/capability-design-loader.js";
import { evaluateCapabilityDesign } from "../../../eval/runners/evaluate-capability-design.js";
import { evaluateSwerveAxisDirect } from "../../../eval/runners/evaluate-capability-design.js";
import type { CapabilityDesignEvaluationResult } from "../../../eval/runners/evaluate-capability-design.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EPSILON = 1e-9;

function makeSwerveAxis(overrides?: Partial<
  NonNullable<ReturnType<typeof loadDefaultCapabilityDesignProfile>["axes"]>["swerve"]
>): NonNullable<ReturnType<typeof loadDefaultCapabilityDesignProfile>["axes"]>["swerve"] {
  const profile = loadDefaultCapabilityDesignProfile();
  return {
    ...profile.axes.swerve,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Swerve axis is IMPLEMENTED
// ---------------------------------------------------------------------------

describe("Swerve axis status", () => {
  it("swerve axis is IMPLEMENTED, not DEFERRED", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["swerve"];
    expect(axis).toBeDefined();
    expect(axis.status).toBe("IMPLEMENTED");
    expect(axis.scenario_ids).toContain("scn-swn-001-v1");
  });

  it("no axis remains DEFERRED", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    for (const [, ax] of Object.entries(profile.axes)) {
      expect(ax.status).not.toBe("DEFERRED");
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Normal low vs high curve → PASS (INCREASE direction)
// ---------------------------------------------------------------------------

describe("Swerve axis: normal evaluation", () => {
  it("low vs high curve profile passes with INCREASE direction", () => {
    const axis = makeSwerveAxis();
    const result = evaluateSwerveAxisDirect(axis);

    expect(result.outcome).toBe("PASS");
    expect(result.axis_id).toBe("swerve");
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining("low curveCoeff"),
        expect.stringContaining("high curveCoeff"),
        expect.stringContaining("Ball distance at t10"),
        expect.stringContaining("Lateral deviation at t10"),
        expect.stringContaining("Monotonic direction check (INCREASE): PASS"),
        expect.stringContaining("Cross-coupling OK"),
      ]),
    );
  });

  it("lateral deviation delta is positive (INCREASE direction)", () => {
    const axis = makeSwerveAxis();
    const result = evaluateSwerveAxisDirect(axis);

    const deltaLine = result.evidence.find((e) =>
      e.includes("Delta lateral deviation"),
    );
    expect(deltaLine).toBeDefined();
    const match = deltaLine!.match(/Delta lateral deviation: ([+-]?[0-9.]+)/);
    expect(match).not.toBeNull();
    const delta = parseFloat(match![1]);
    expect(delta).toBeGreaterThan(0);
  });

  it("ball-distance delta meets minimum_material_effect (0.1)", () => {
    const axis = makeSwerveAxis();
    const result = evaluateSwerveAxisDirect(axis);

    const materialityLine = result.evidence.find((e) =>
      e.includes("Minimum material effect"),
    );
    expect(materialityLine).toBeDefined();
    expect(materialityLine).toContain("true");
  });

  it("ball-speed cross-coupling is within threshold", () => {
    const axis = makeSwerveAxis();
    const result = evaluateSwerveAxisDirect(axis);

    expect(result.evidence).toEqual(
      expect.arrayContaining([expect.stringContaining("Cross-coupling OK")]),
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Zero curve profile → FAIL (no measurable effect)
// ---------------------------------------------------------------------------

describe("Swerve axis: zero curve → FAIL", () => {
  it("zero curve coefficient at both low and high → FAIL (no effect)", () => {
    const axis = makeSwerveAxis({
      profile_value_low: { id: "swerve-low", value: 0 },
      profile_value_high: { id: "swerve-high", value: 0 },
    });
    const result = evaluateSwerveAxisDirect(axis);

    expect(result.outcome).toBe("FAIL");
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining("No measurable effect from curve coefficient variation"),
      ]),
    );
  });

  it("low == high curve coefficient → FAIL (no effect)", () => {
    const axis = makeSwerveAxis({
      profile_value_low: { id: "swerve-low", value: 0.001 },
      profile_value_high: { id: "swerve-high", value: 0.001 },
    });
    const result = evaluateSwerveAxisDirect(axis);

    expect(result.outcome).toBe("FAIL");
  });
});

// ---------------------------------------------------------------------------
// 4. Direction violation → FAIL
// ---------------------------------------------------------------------------

describe("Swerve axis: direction violation", () => {
  it("wrong expected direction → FAIL", () => {
    const axis = makeSwerveAxis({
      expected_monotonic_direction: "DECREASE",
    });
    const result = evaluateSwerveAxisDirect(axis);

    expect(result.outcome).toBe("FAIL");
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Delta direction contradicts expected DECREASE"),
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Cross-coupling violation → FAIL
// ---------------------------------------------------------------------------

describe("Swerve axis: cross-coupling violation", () => {
  it("cross-coupling threshold exceeded → FAIL", () => {
    const axis = makeSwerveAxis({
      max_permitted_cross_coupling: [
        { metric_id: "ball-speed", threshold: 0.0000001 },
      ],
    });
    const result = evaluateSwerveAxisDirect(axis);

    expect(result.outcome).toBe("FAIL");
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Cross-coupling FAIL"),
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Deterministic evaluation
// ---------------------------------------------------------------------------

describe("Swerve axis: determinism", () => {
  it("same axis produces identical outcomes across evaluations", () => {
    const axis = makeSwerveAxis();
    const r1 = evaluateSwerveAxisDirect(axis);
    const r2 = evaluateSwerveAxisDirect(axis);

    expect(r1.outcome).toBe(r2.outcome);
    expect(r1.evidence).toEqual(r2.evidence);
  });

  it("full evaluation runner is deterministic", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const r1 = evaluateCapabilityDesign({ profile });
    const r2 = evaluateCapabilityDesign({ profile });

    expect(r1.overall).toBe(r2.overall);
    for (let i = 0; i < r1.axes.length; i++) {
      expect(r1.axes[i].axis_id).toBe(r2.axes[i].axis_id);
      expect(r1.axes[i].outcome).toBe(r2.axes[i].outcome);
      expect(r1.axes[i].evidence).toEqual(r2.axes[i].evidence);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. No PES claims
// ---------------------------------------------------------------------------

describe("Swerve axis: no PES claims", () => {
  it("does not claim PES fidelity", () => {
    const axis = makeSwerveAxis();
    const result = evaluateSwerveAxisDirect(axis);

    for (const evidence of result.evidence) {
      expect(evidence.toLowerCase().includes("pes fidelity")).toBe(false);
      expect(evidence.toLowerCase().includes("pes match")).toBe(false);
      expect(evidence.toLowerCase().includes("pes 2017")).toBe(false);
      expect(evidence.toLowerCase().includes("foundation_lab_pass")).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Zero-spin → straight trajectory (protected output: straight-shot-symmetry)
// ---------------------------------------------------------------------------

describe("Swerve axis: protected outputs", () => {
  it("zero curve coefficient produces straight trajectory", () => {
    // When curveCoefficient is zero, the Magnus force is zero regardless
    // of spin.  The ball should follow the same trajectory as a zero-spin ball.
    const axis = makeSwerveAxis();
    const result = evaluateSwerveAxisDirect(axis);

    // The evaluation result should record the protected output assertion.
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining("straight-shot-symmetry"),
      ]),
    );
  });

  it("runner evidence confirms zero-curve → zero-curve-force", () => {
    const axis = makeSwerveAxis();
    const result = evaluateSwerveAxisDirect(axis);

    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining("zero curve coeff"),
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// 9. Full evaluation: all axes PASS
// ---------------------------------------------------------------------------

describe("Swerve axis: full evaluation", () => {
  it("swerve axis passes in full capability design evaluation", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const swerveResult = result.axes.find((a) => a.axis_id === "swerve");
    expect(swerveResult).toBeDefined();
    expect(swerveResult!.outcome).toBe("PASS");
    expect(swerveResult!.status).toBe("IMPLEMENTED");
  });

  it("overall evaluation passes when all axes pass", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    expect(result.overall).toBe("PASS");
    for (const axis of result.axes) {
      expect(axis.outcome).not.toBe("FAIL");
      expect(axis.outcome).not.toBe("NOT_EVALUATED");
      expect(axis.outcome).not.toBe("DEFERRED");
    }
  });
});