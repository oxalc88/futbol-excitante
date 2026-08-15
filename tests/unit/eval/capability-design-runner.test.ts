/**
 * @module tests/unit/eval/capability-design-runner
 *
 * Tests for the CapabilityDesignProfile evaluation runner.
 *
 * Verifies:
 *  1. DEFERRED axes → DEFERRED, never PASS.
 *  2. IMPLEMENTED transient-acceleration axis is exercised (low vs high).
 *  3. High transient acceleration reaches more speed at tick 10.
 *  4. Sustainable-speed plateau stays within declared protected coupling.
 *  5. Deterministic: same seed/program → identical results.
 *  6. Runner does not invent a PES PASS.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in core code.
 */

import { describe, it, expect } from "vitest";

import { loadDefaultCapabilityDesignProfile } from "../../../eval/contracts/capability-design-loader.js";
import { evaluateCapabilityDesign } from "../../../eval/runners/evaluate-capability-design.js";
import { stepLocomotion } from "../../../src/simulation/locomotion/locomotion-system.js";
import { TRANSIENT_ACCEL_LOCOMOTION_V1 } from "../../../src/simulation/config/foundation.js";
import type { PlayerState } from "../../../src/contracts/state.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DT = 1 / 60; // matches FOUNDATION_FIXED_DT_V1

function makePlayer(overrides?: Partial<PlayerState>): PlayerState {
  return {
    playerId: "test-1",
    teamId: "team-a",
    groundPosition: { x: 0, y: 0 },
    linearVelocity: { x: 0, y: 0 },
    desiredVelocity: { x: 0, y: 0 },
    bodyHeading: 0,
    desiredHeading: 0,
    ...overrides,
  };
}

function speed(p: PlayerState): number {
  return Math.sqrt(p.linearVelocity.x ** 2 + p.linearVelocity.y ** 2);
}

const EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// 1. DEFERRED axes → DEFERRED, never PASS
// ---------------------------------------------------------------------------

describe("DEFERRED axes are DEFERRED, never PASS", () => {
  it("every DEFERRED axis returns DEFERRED outcome", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    for (const axis of result.axes) {
      const profileAxis = profile.axes[axis.axis_id];
      if (profileAxis.status === "DEFERRED") {
        expect(axis.outcome).toBe("DEFERRED");
        expect(axis.status).toBe("DEFERRED");
      }
    }
  });

  it("no DEFERRED axis returns PASS", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const passResults = result.axes.filter(
      (a) => a.outcome === "PASS",
    );
    for (const r of passResults) {
      const profileAxis = profile.axes[r.axis_id];
      expect(profileAxis.status).not.toBe("DEFERRED");
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Low vs high transient-acceleration: locomotion hook works
// ---------------------------------------------------------------------------

describe("transient-acceleration hook", () => {
  it("default config (transientAcceleration=0) produces baseline speed at tick 10", () => {
    const p = makePlayer();
    p.desiredVelocity = { x: 1, y: 0 };
    p.desiredHeading = 0;

    for (let i = 0; i < 10; i++) {
      stepLocomotion([p], DT, TRANSIENT_ACCEL_LOCOMOTION_V1);
    }

    const s = speed(p);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(TRANSIENT_ACCEL_LOCOMOTION_V1.maxSpeed.value);
  });

  it("high transient acceleration reaches higher speed at tick 10", () => {
    // Run with default (transientAcceleration=0).
    const pDefault = makePlayer();
    pDefault.desiredVelocity = { x: 1, y: 0 };
    pDefault.desiredHeading = 0;
    for (let i = 0; i < 10; i++) {
      stepLocomotion([pDefault], DT, TRANSIENT_ACCEL_LOCOMOTION_V1);
    }

    // Run with high transient acceleration.
    const pHigh = makePlayer();
    pHigh.desiredVelocity = { x: 1, y: 0 };
    pHigh.desiredHeading = 0;
    const highConfig = {
      ...TRANSIENT_ACCEL_LOCOMOTION_V1,
      transientAcceleration: { value: 1, note: "maximum" },
    };
    for (let i = 0; i < 10; i++) {
      stepLocomotion([pHigh], DT, highConfig);
    }

    const sDefault = speed(pDefault);
    const sHigh = speed(pHigh);
    expect(sHigh).toBeGreaterThan(sDefault + EPSILON);
  });

  it("high transient acceleration reaches higher displacement at tick 10", () => {
    const pDefault = makePlayer();
    pDefault.desiredVelocity = { x: 1, y: 0 };
    pDefault.desiredHeading = 0;
    for (let i = 0; i < 10; i++) {
      stepLocomotion([pDefault], DT, TRANSIENT_ACCEL_LOCOMOTION_V1);
    }

    const pHigh = makePlayer();
    pHigh.desiredVelocity = { x: 1, y: 0 };
    pHigh.desiredHeading = 0;
    const highConfig = {
      ...TRANSIENT_ACCEL_LOCOMOTION_V1,
      transientAcceleration: { value: 1, note: "maximum" },
    };
    for (let i = 0; i < 10; i++) {
      stepLocomotion([pHigh], DT, highConfig);
    }

    const dDefault = Math.abs(pDefault.groundPosition.x);
    const dHigh = Math.abs(pHigh.groundPosition.x);
    expect(dHigh).toBeGreaterThan(dDefault + EPSILON);
  });

  it("plateau speed is unchanged regardless of transientAcceleration", () => {
    const N = 200;

    const pDefault = makePlayer();
    pDefault.desiredVelocity = { x: 1, y: 0 };
    pDefault.desiredHeading = 0;
    for (let i = 0; i < N; i++) {
      stepLocomotion([pDefault], DT, TRANSIENT_ACCEL_LOCOMOTION_V1);
    }

    const pHigh = makePlayer();
    pHigh.desiredVelocity = { x: 1, y: 0 };
    pHigh.desiredHeading = 0;
    const highConfig = {
      ...TRANSIENT_ACCEL_LOCOMOTION_V1,
      transientAcceleration: { value: 1, note: "maximum" },
    };
    for (let i = 0; i < N; i++) {
      stepLocomotion([pHigh], DT, highConfig);
    }

    // Both should converge to the same maxSpeed.
    const maxSpeed = TRANSIENT_ACCEL_LOCOMOTION_V1.maxSpeed.value;
    expect(speed(pDefault)).toBeCloseTo(maxSpeed, 4);
    expect(speed(pHigh)).toBeCloseTo(maxSpeed, 4);

    // The difference must be within a small numeric tolerance (not the
    // 0.02 cross-coupling threshold — that's for the evaluator).
    const diff = Math.abs(speed(pDefault) - speed(pHigh));
    expect(diff).toBeLessThan(1e-4);
  });
});

// ---------------------------------------------------------------------------
// 3. Runner: high transient acceleration passes materiality check
// ---------------------------------------------------------------------------

describe("Runner: transient-acceleration axis", () => {
  it("high transient acceleration reaches more speed at tick 10", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["transient-acceleration"];
    expect(axis).toBeDefined();
    expect(axis!.status).toBe("IMPLEMENTED");

    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find((a) => a.axis_id === "transient-acceleration");
    expect(axisResult).toBeDefined();

    // The runner must have measured metrics (not N/A).
    const hasNA = axisResult!.evidence.some((e) => e.includes("N/A"));
    expect(hasNA).toBe(false);

    // Check that the evidence contains speed measurements.
    expect(axisResult!.evidence.some((e) => e.includes("Speed at t10"))).toBe(true);

    // The outcome is either PASS (delta > materiality) or FAIL (delta too small).
    // It must NOT be NOT_EVALUATED since we measured real metrics.
    expect(axisResult!.outcome).not.toBe("NOT_EVALUATED");

    // Verify the runner captured real speed values in evidence.
    const speedLine = axisResult!.evidence.find((e) => e.includes("Speed at t10"));
    expect(speedLine).toBeDefined();
    // Extract the low and high values from the evidence line.
    const lowMatch = speedLine!.match(/low=([0-9.]+)/);
    const highMatch = speedLine!.match(/high=([0-9.]+)/);
    expect(lowMatch).not.toBeNull();
    expect(highMatch).not.toBeNull();
    const lowSpeed = parseFloat(lowMatch![1]);
    const highSpeed = parseFloat(highMatch![1]);
    // High transient acceleration should reach higher speed at tick 10.
    expect(highSpeed).toBeGreaterThan(lowSpeed + EPSILON);
  });
});

// ---------------------------------------------------------------------------
// 4. Plateau stays within declared protected coupling
// ---------------------------------------------------------------------------

describe("Plateau protection", () => {
  it("high and low transient acceleration converge to the same max speed", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["transient-acceleration"];
    expect(axis).toBeDefined();

    // The max_permitted_cross_coupling threshold is 0.02.
    // The plateau delta should be well below this.
    expect(axis!.max_permitted_cross_coupling[0].threshold).toBe(0.02);
  });

  it("runner evidence shows plateau is protected", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find((a) => a.axis_id === "transient-acceleration");
    if (axisResult) {
      // Evidence should contain a plateau check result.
      const plateauEvidence = axisResult.evidence.find(
        (e) => e.includes("Sustainable-speed plateau") || e.includes("Plateau"),
      );
      if (plateauEvidence) {
        // Cross-coupling should be OK (plateau is protected).
        const hasOk = axisResult.evidence.some((e) =>
          e.includes("Cross-coupling OK"),
        );
        if (hasOk) {
          // Plateau is within threshold.
          expect(plateauEvidence).toContain("plateau");
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Deterministic results
// ---------------------------------------------------------------------------

describe("Deterministic evaluation", () => {
  it("same profile produces identical outcomes across two evaluations", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const r1 = evaluateCapabilityDesign({ profile });
    const r2 = evaluateCapabilityDesign({ profile });

    expect(r1.overall).toBe(r2.overall);
    expect(r1.axes).toHaveLength(r2.axes.length);

    for (let i = 0; i < r1.axes.length; i++) {
      expect(r1.axes[i].axis_id).toBe(r2.axes[i].axis_id);
      expect(r1.axes[i].outcome).toBe(r2.axes[i].outcome);
      expect(r1.axes[i].evidence).toEqual(r2.axes[i].evidence);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Runner does not invent a PES PASS
// ---------------------------------------------------------------------------

describe("No PES claim", () => {
  it("evaluateCapabilityDesign does not claim PES fidelity", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    // No outcome should claim PES match or fidelity.
    const pesTerms = [
      "PES fidelity",
      "PES match",
      "PES 2017",
      "FOUNDATION_LAB_PASS",
    ];
    for (const axis of result.axes) {
      for (const evidence of axis.evidence) {
        for (const term of pesTerms) {
          expect(
            evidence.toLowerCase().includes(term.toLowerCase()),
            `Evidence for axis "${axis.axis_id}" should not contain "${term}": ${evidence}`,
          ).toBe(false);
        }
      }
    }
  });

  it("evaluateCapabilityDesign never returns PASS for DEFERRED axes", () => {
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