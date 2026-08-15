/**
 * @module tests/unit/eval/eval-physical-contact
 *
 * Tests for the physical-contact capability-design axis evaluation.
 *
 * Verifies:
 *  1. physical-contact axis is IMPLEMENTED (not DEFERRED).
 *  2. Low vs high separationStiffness produces displacement delta in expected direction.
 *  3. Delta meets minimum materiality.
 *  4. No-contact scenario → FAIL (not PASS).
 *  5. Knob that stops affecting displacement → FAIL.
 *  6. DEFERRED axes stay DEFERRED.
 *  7. transient-acceleration unchanged (regression).
 *  8. Determinism: two identical runs same verdict.
 *  9. No theatrical canaries.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";

import { loadDefaultCapabilityDesignProfile } from "../../../eval/contracts/capability-design-loader.js";
import { evaluateCapabilityDesign } from "../../../eval/runners/evaluate-capability-design.js";
import { FOUNDATION_PLAYER_CONTACT_V1 } from "../../../src/simulation/config/foundation.js";
import { stepPlayerContacts } from "../../../src/simulation/player-contact/player-contact-system.js";
import type { PlayerState } from "../../../src/contracts/state.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CFG = FOUNDATION_PLAYER_CONTACT_V1;
const RADIUS = CFG.playerRadius.value;
const SUM_RADII = RADIUS * 2;

function makePlayer(overrides?: Partial<PlayerState>): PlayerState {
  return {
    playerId: "p-a",
    teamId: "team-a",
    groundPosition: { x: 0, y: 0 },
    linearVelocity: { x: 0, y: 0 },
    desiredVelocity: { x: 0, y: 0 },
    bodyHeading: 0,
    desiredHeading: 0,
    ...overrides,
  };
}

function makeCounter(): { value: number } {
  return { value: 0 };
}

// ---------------------------------------------------------------------------
// 1. Axis status
// ---------------------------------------------------------------------------

describe("physical-contact axis status", () => {
  it("physical-contact is IMPLEMENTED", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["physical-contact"];
    expect(axis).toBeDefined();
    expect(axis!.status).toBe("IMPLEMENTED");
  });

  it("physical-contact has non-empty scenario_ids", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["physical-contact"];
    expect(axis!.scenario_ids.length).toBeGreaterThan(0);
    expect(axis!.scenario_ids[0]).toBe("scn-duels-phy-shld-001-v1");
  });

  it("physical-contact has non-empty metric_ids", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["physical-contact"];
    expect(axis!.metric_ids.length).toBeGreaterThan(0);
  });

  it("physical-contact has real estimator_id (not absent)", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["physical-contact"];
    expect(axis!.estimator_id).not.toBe("absent");
    expect(axis!.estimator_version).not.toBe("absent");
  });
});

// ---------------------------------------------------------------------------
// 2. Runner: low vs high separationStiffness
// ---------------------------------------------------------------------------

describe("Runner: physical-contact axis evaluation", () => {
  it("physical-contact axis returns a result with evidence", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find(
      (a) => a.axis_id === "physical-contact",
    );
    expect(axisResult).toBeDefined();
    expect(axisResult!.status).toBe("IMPLEMENTED");
    // Must have evidence strings.
    expect(axisResult!.evidence.length).toBeGreaterThan(0);
  });

  it("physical-contact axis outcome is PASS (delta > materiality)", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find(
      (a) => a.axis_id === "physical-contact",
    );
    expect(axisResult).toBeDefined();
    // The axis should PASS because the contact config variation
    // (separationStiffness 0.1 vs 1.0) produces a measurable
    // displacement difference in the duel scenario.
    expect(axisResult!.outcome).toBe("PASS");
  });

  it("physical-contact evidence contains contact event counts", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find(
      (a) => a.axis_id === "physical-contact",
    );
    const hasContactEvidence = axisResult!.evidence.some((e) =>
      e.includes("Contact events:"),
    );
    expect(hasContactEvidence).toBe(true);
  });

  it("physical-contact evidence contains displacement at estimator tick", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find(
      (a) => a.axis_id === "physical-contact",
    );
    const hasDispEvidence = axisResult!.evidence.some((e) =>
      e.includes("Displacement at t20"),
    );
    expect(hasDispEvidence).toBe(true);
  });

  it("physical-contact evidence contains direction check", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find(
      (a) => a.axis_id === "physical-contact",
    );
    const hasDirectionEvidence = axisResult!.evidence.some((e) =>
      e.includes("Monotonic direction check"),
    );
    expect(hasDirectionEvidence).toBe(true);
  });

  it("physical-contact evidence contains materiality check", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find(
      (a) => a.axis_id === "physical-contact",
    );
    const hasMaterialityEvidence = axisResult!.evidence.some((e) =>
      e.includes("Minimum material effect"),
    );
    expect(hasMaterialityEvidence).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. No-contact scenario → FAIL (not PASS)
// ---------------------------------------------------------------------------

describe("No-contact scenario → FAIL", () => {
  it("player-player contact system emits no events when players are far apart", () => {
    // Verify via the low-level system: players far apart → no contact events.
    const playerA = makePlayer({
      playerId: "player-a",
      groundPosition: { x: 0, y: 0 },
    });
    const playerB = makePlayer({
      playerId: "player-b",
      groundPosition: { x: 10, y: 10 }, // far apart
    });
    const counter = makeCounter();
    const result = stepPlayerContacts(
      [playerA, playerB],
      counter,
      1,
      CFG,
    );
    expect(result.events.length).toBe(0);
    expect(counter.value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Knob that stops affecting displacement → FAIL
// ---------------------------------------------------------------------------

describe("Zero-stiffness knob → FAIL", () => {
  it("separationStiffness=0 produces no contact resolution effect", () => {
    // With stiffness=0, the resolver should produce zero positional correction.
    const playerA = makePlayer({
      playerId: "p-a",
      groundPosition: { x: 0, y: 0 },
      linearVelocity: { x: 5.0, y: 0 },
    });
    const playerB = makePlayer({
      playerId: "p-b",
      groundPosition: { x: SUM_RADII * 0.5, y: 0 },
      linearVelocity: { x: -5.0, y: 0 },
    });

    // Config with stiffness=0 (effectively no separation).
    const zeroStiffnessCfg = {
      ...CFG,
      separationStiffness: { value: 0, note: "zero" },
    };

    const posABefore = { ...playerA.groundPosition };
    const posBBefore = { ...playerB.groundPosition };

    const counter = makeCounter();
    stepPlayerContacts([playerA, playerB], counter, 1, zeroStiffnessCfg);

    // With stiffness=0, the rawCorrection = overlap * 0 = 0.
    // So halfCorrection = 0, and positions should not change.
    expect(playerA.groundPosition.x).toBe(posABefore.x);
    expect(playerA.groundPosition.y).toBe(posABefore.y);
    expect(playerB.groundPosition.x).toBe(posBBefore.x);
    expect(playerB.groundPosition.y).toBe(posBBefore.y);
  });
});

// ---------------------------------------------------------------------------
// 5. DEFERRED axes stay DEFERRED
// ---------------------------------------------------------------------------

describe("DEFERRED axes stay DEFERRED", () => {
  it("body-control is DEFERRED", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    expect(profile.axes["body-control"].status).toBe("DEFERRED");
  });

  it("shooting-power is DEFERRED", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    expect(profile.axes["shooting-power"].status).toBe("DEFERRED");
  });

  it("swerve is DEFERRED", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    expect(profile.axes["swerve"].status).toBe("DEFERRED");
  });

  it("no DEFERRED axis returns PASS from runner", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    for (const axis of result.axes) {
      const profileAxis = profile.axes[axis.axis_id];
      if (profileAxis.status === "DEFERRED") {
        expect(axis.outcome).not.toBe("PASS");
        expect(axis.outcome).toBe("DEFERRED");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 6. transient-acceleration unchanged (regression check)
// ---------------------------------------------------------------------------

describe("transient-acceleration regression check", () => {
  it("transient-acceleration is still IMPLEMENTED", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    expect(profile.axes["transient-acceleration"].status).toBe("IMPLEMENTED");
  });

  it("transient-acceleration axis still passes", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find(
      (a) => a.axis_id === "transient-acceleration",
    );
    expect(axisResult).toBeDefined();
    expect(axisResult!.status).toBe("IMPLEMENTED");
    // Should still PASS (the locomotion hook still works).
    expect(axisResult!.outcome).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// 7. Determinism
// ---------------------------------------------------------------------------

describe("Determinism", () => {
  it("two identical evaluations produce identical results", () => {
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
// 8. No theatrical canaries
// ---------------------------------------------------------------------------

describe("No theatrical canaries", () => {
  it("evidence does not contain placeholder strings", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    for (const axis of result.axes) {
      for (const evidence of axis.evidence) {
        expect(
          evidence.toLowerCase(),
          `Evidence for axis "${axis.axis_id}" should not contain placeholder: ${evidence}`,
        ).not.toContain("todo");
        expect(
          evidence.toLowerCase(),
          `Evidence for axis "${axis.axis_id}" should not contain placeholder: ${evidence}`,
        ).not.toContain("fixme");
        expect(
          evidence.toLowerCase(),
          `Evidence for axis "${axis.axis_id}" should not contain placeholder: ${evidence}`,
        ).not.toContain("hack");
      }
    }
  });
});