/**
 * @module tests/unit/eval/eval-shooting-power
 *
 * Tests for the shooting-power capability-design axis evaluation.
 *
 * Verifies:
 *  1. shooting-power axis is IMPLEMENTED (not DEFERRED).
 *  2. Low vs high shot exitSpeed produces ball-speed delta in expected direction.
 *  3. Delta meets minimum materiality.
 *  4. No-shot-event scenario → FAIL (not PASS).
 *  5. Low==high / zero-effect → FAIL.
 *  6. DEFERRED axes stay DEFERRED.
 *  7. transient-acceleration + physical-contact unchanged (regression).
 *  8. Determinism: two identical runs same verdict.
 *  9. No theatrical canaries.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { describe, it, expect } from "vitest";

import { loadDefaultCapabilityDesignProfile } from "../../../eval/contracts/capability-design-loader.js";
import { evaluateCapabilityDesign } from "../../../eval/runners/evaluate-capability-design.js";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { stepContacts } from "../../../src/simulation/contacts/contact-system.js";
import { SHOT_BIT } from "../../../src/contracts/input.js";
import type { InputFrame } from "../../../src/contracts/input.js";
import type { SimulationEvent } from "../../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";
import type { SimulationObserver } from "../../../src/simulation/telemetry/observer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeShotInputProgram(
  durationTicks: number,
  shotStartTick: number,
  shotEndTick: number,
): Record<number, { tick: number; sourceId: string; controlSlot: string; moveX: number; moveY: number; sprint: number; heldButtons: number; pressedButtons: number; releasedButtons: number }[]> {
  const program: Record<number, { tick: number; sourceId: string; controlSlot: string; moveX: number; moveY: number; sprint: number; heldButtons: number; pressedButtons: number; releasedButtons: number }[]> = {};
  for (let t = 0; t < durationTicks; t++) {
    const isShotWindow = t >= shotStartTick && t < shotEndTick;
    program[t] = [
      {
        tick: t,
        sourceId: "capability-test",
        controlSlot: "slot-1",
        moveX: 0,
        moveY: 0,
        sprint: isShotWindow ? 1 : 0,
        heldButtons: isShotWindow ? SHOT_BIT : 0,
        pressedButtons: isShotWindow && t === shotStartTick ? SHOT_BIT : 0,
        releasedButtons: isShotWindow && t === shotEndTick ? SHOT_BIT : 0,
      },
    ];
  }
  return program;
}

function makeShotScenario(
  id: string,
  durationTicks: number,
  shotStartTick: number,
  shotEndTick: number,
): Parameters<typeof createWorld>[0]["scenario"] {
  const inputProgram = makeShotInputProgram(durationTicks, shotStartTick, shotEndTick);
  return {
    id,
    version: "capability-test-v1",
    family: "capability-design",
    durationTicks,
    seed: 42,
    prngAlgorithmId: "mulberry32-v1",
    schemaVersion: "state-v1",
    simulationVersion: "sim-v1",
    configVersion: "foundation-config-v1",
    profile: "LABORATORY",
    pitchLength: 105,
    pitchWidth: 68,
    safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
    players: [
      {
        playerId: "player-cap-1",
        teamId: "team-a",
        groundPosition: { x: 0, y: 0 },
        linearVelocity: { x: 0, y: 0 },
        desiredVelocity: { x: 0, y: 0 },
        bodyHeading: 0,
        desiredHeading: 0,
      },
    ],
    ball: {
      position: { x: 0.2, y: 0, z: 0.11 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      regime: "ground-roll",
    },
    controlAssignments: {
      "slot-1": {
        controlSlot: "slot-1",
        teamId: "team-a",
        controlledPlayerId: "player-cap-1",
        mode: "HUMAN",
      },
    },
    missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
    maxConsecutiveMissing: 3,
    inputProgram,
    observationWindows: [{ startTick: 0, endTick: durationTicks }],
    scheduledEvents: {},
    requestedMetrics: ["ball-speed"],
  };
}

function runShotSimulation(
  scenario: Parameters<typeof createWorld>[0]["scenario"],
  shotConfigOverride?: {
    shotRadius: { value: number };
    exitSpeed: { value: number };
    verticalComponent: { value: number };
  },
): { observations: TelemetryObservation[]; events: SimulationEvent[] } {
  const observations: TelemetryObservation[] = [];
  const allEvents: SimulationEvent[] = [];

  const observer: SimulationObserver = {
    onObservation(obs: TelemetryObservation) {
      observations.push(obs);
    },
  };

  const world = createWorld({ scenario });
  const sim = createSimulation(world, observer, undefined, undefined, shotConfigOverride);
  const durationTicks = scenario.durationTicks;

  for (let i = 0; i < durationTicks; i++) {
    const tickInputs = scenario.inputProgram[sim.tick] ?? [];
    if (tickInputs.length > 0) sim.applyInputs(tickInputs);
    const result = sim.step();
    allEvents.push(...result.events);
  }

  return { observations, events: allEvents };
}

// ---------------------------------------------------------------------------
// 1. Axis status
// ---------------------------------------------------------------------------

describe("shooting-power axis status", () => {
  it("shooting-power is IMPLEMENTED", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["shooting-power"];
    expect(axis).toBeDefined();
    expect(axis!.status).toBe("IMPLEMENTED");
  });

  it("shooting-power has non-empty scenario_ids", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["shooting-power"];
    expect(axis!.scenario_ids.length).toBeGreaterThan(0);
    expect(axis!.scenario_ids[0]).toBe("scn-shot-pwr-001-v1");
  });

  it("shooting-power has non-empty metric_ids", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["shooting-power"];
    expect(axis!.metric_ids.length).toBeGreaterThan(0);
    expect(axis!.metric_ids).toContain("ball-speed");
  });

  it("shooting-power has real estimator_id (not absent)", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["shooting-power"];
    expect(axis!.estimator_id).not.toBe("absent");
    expect(axis!.estimator_version).not.toBe("absent");
    // estimator_id must match the tick the runner measures (t10).
    expect(axis!.estimator_id).toBe("delta-ball-speed-at-t10");
  });
});

// ---------------------------------------------------------------------------
// 2. Runner: low vs high exitSpeed
// ---------------------------------------------------------------------------

describe("Runner: shooting-power axis evaluation", () => {
  it("shooting-power axis returns a result with evidence", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find((a) => a.axis_id === "shooting-power");
    expect(axisResult).toBeDefined();
    expect(axisResult!.status).toBe("IMPLEMENTED");
    expect(axisResult!.evidence.length).toBeGreaterThan(0);
  });

  it("shooting-power axis outcome is PASS (delta > materiality)", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find((a) => a.axis_id === "shooting-power");
    expect(axisResult).toBeDefined();
    expect(axisResult!.outcome).toBe("PASS");
  });

  it("shooting-power evidence contains shot event counts", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find((a) => a.axis_id === "shooting-power");
    const hasShotEvidence = axisResult!.evidence.some((e) => e.includes("Shot events:"));
    expect(hasShotEvidence).toBe(true);
  });

  it("shooting-power evidence contains ball-speed at estimator tick", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find((a) => a.axis_id === "shooting-power");
    const hasSpeedEvidence = axisResult!.evidence.some((e) => e.includes("Ball speed at t10"));
    expect(hasSpeedEvidence).toBe(true);
  });

  it("shooting-power evidence contains direction check", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find((a) => a.axis_id === "shooting-power");
    const hasDirectionEvidence = axisResult!.evidence.some((e) =>
      e.includes("Monotonic direction check"),
    );
    expect(hasDirectionEvidence).toBe(true);
  });

  it("shooting-power evidence contains materiality check", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find((a) => a.axis_id === "shooting-power");
    const hasMaterialityEvidence = axisResult!.evidence.some((e) =>
      e.includes("Minimum material effect"),
    );
    expect(hasMaterialityEvidence).toBe(true);
  });

  it("high exitSpeed produces higher ball speed than low", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find((a) => a.axis_id === "shooting-power");
    expect(axisResult).toBeDefined();

    // Extract ball speed values from evidence.
    const speedLine = axisResult!.evidence.find((e) => e.includes("Ball speed at t10"));
    expect(speedLine).toBeDefined();

    const lowMatch = speedLine!.match(/low=([0-9.]+)/);
    const highMatch = speedLine!.match(/high=([0-9.]+)/);
    expect(lowMatch).not.toBeNull();
    expect(highMatch).not.toBeNull();

    const lowSpeed = parseFloat(lowMatch![1]);
    const highSpeed = parseFloat(highMatch![1]);
    expect(highSpeed).toBeGreaterThan(lowSpeed);
  });
});

// ---------------------------------------------------------------------------
// 3. No-shot-event scenario → FAIL (not PASS)
// ---------------------------------------------------------------------------

describe("No-shot-event scenario → FAIL", () => {
  it("scenario without SHOT_BIT produces no shot events", () => {
    // Player moves toward ball but never presses SHOT_BIT.
    const scenario = makeShotScenario("no-shot-test", 60, 0, 0); // shotStart=0, shotEnd=0 → no shot window

    const result = runShotSimulation(scenario);

    const shotEvents = result.events.filter((e) => e.kind === "shot");
    expect(shotEvents.length).toBe(0);
  });

  it("player too far from ball produces no shot event", () => {
    const inputProgram: Record<
      number,
      { tick: number; sourceId: string; controlSlot: string; moveX: number; moveY: number; sprint: number; heldButtons: number; pressedButtons: number; releasedButtons: number }[]
    > = {};
    for (let t = 0; t < 60; t++) {
      inputProgram[t] = [
        {
          tick: t,
          sourceId: "capability-test",
          controlSlot: "slot-1",
          moveX: 0,
          moveY: 0,
          sprint: 0,
          heldButtons: SHOT_BIT,
          pressedButtons: t === 0 ? SHOT_BIT : 0,
          releasedButtons: 0,
        },
      ];
    }

    const scenario: Parameters<typeof createWorld>[0]["scenario"] = {
      id: "far-shot-test",
      version: "capability-test-v1",
      family: "capability-design",
      durationTicks: 60,
      seed: 42,
      prngAlgorithmId: "mulberry32-v1",
      schemaVersion: "state-v1",
      simulationVersion: "sim-v1",
      configVersion: "foundation-config-v1",
      profile: "LABORATORY",
      pitchLength: 105,
      pitchWidth: 68,
      safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
      players: [
        {
          playerId: "player-cap-1",
          teamId: "team-a",
          groundPosition: { x: 0, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
        },
      ],
      ball: {
        position: { x: 100, y: 0, z: 0.11 }, // far away
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
      controlAssignments: {
        "slot-1": {
          controlSlot: "slot-1",
          teamId: "team-a",
          controlledPlayerId: "player-cap-1",
          mode: "HUMAN",
        },
      },
      missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
      maxConsecutiveMissing: 3,
      inputProgram,
      observationWindows: [{ startTick: 0, endTick: 60 }],
      scheduledEvents: {},
      requestedMetrics: ["ball-speed"],
    };

    const result = runShotSimulation(scenario);
    const shotEvents = result.events.filter((e) => e.kind === "shot");
    expect(shotEvents.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Low==high / zero-effect → FAIL
// ---------------------------------------------------------------------------

describe("Zero-effect scenario → FAIL", () => {
  it("same exitSpeed for low and high produces zero delta → FAIL", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const axis = profile.axes["shooting-power"];
    expect(axis).toBeDefined();

    // Override the profile to use same low==high values.
    const modifiedProfile = {
      ...profile,
      axes: {
        ...profile.axes,
        "shooting-power": {
          ...axis,
          profile_value_low: { id: "shooting-power-low", value: 12.0 },
          profile_value_high: { id: "shooting-power-high", value: 12.0 },
        },
      },
    };

    const result = evaluateCapabilityDesign({ profile: modifiedProfile });

    const axisResult = result.axes.find((a) => a.axis_id === "shooting-power");
    expect(axisResult).toBeDefined();
    // Same exitSpeed → no delta → FAIL.
    expect(axisResult!.outcome).toBe("FAIL");
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
// 6. Regression: transient-acceleration + physical-contact unchanged
// ---------------------------------------------------------------------------

describe("Regression: other axes unchanged", () => {
  it("transient-acceleration is still IMPLEMENTED", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    expect(profile.axes["transient-acceleration"].status).toBe("IMPLEMENTED");
  });

  it("transient-acceleration axis still passes", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find((a) => a.axis_id === "transient-acceleration");
    expect(axisResult).toBeDefined();
    expect(axisResult!.status).toBe("IMPLEMENTED");
    expect(axisResult!.outcome).toBe("PASS");
  });

  it("physical-contact is still IMPLEMENTED", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    expect(profile.axes["physical-contact"].status).toBe("IMPLEMENTED");
  });

  it("physical-contact axis still passes", () => {
    const profile = loadDefaultCapabilityDesignProfile();
    const result = evaluateCapabilityDesign({ profile });

    const axisResult = result.axes.find((a) => a.axis_id === "physical-contact");
    expect(axisResult).toBeDefined();
    expect(axisResult!.status).toBe("IMPLEMENTED");
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
        expect(evidence.toLowerCase()).not.toContain("todo");
        expect(evidence.toLowerCase()).not.toContain("fixme");
        expect(evidence.toLowerCase()).not.toContain("hack");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 9. shotConfigOverride is wired through createSimulation
// ---------------------------------------------------------------------------

describe("shotConfigOverride wiring", () => {
  it("different exitSpeed produces different ball velocity after shot", () => {
    const scenario = makeShotScenario("wiring-test", 60, 10, 20);

    // Low exitSpeed.
    const lowConfig = {
      shotRadius: { value: 1.2 },
      exitSpeed: { value: 8.0 },
      verticalComponent: { value: 0.15 },
    };
    const lowResult = runShotSimulation(scenario, lowConfig);
    const lowShotEvents = lowResult.events.filter((e) => e.kind === "shot");
    expect(lowShotEvents.length).toBeGreaterThan(0);

    // High exitSpeed.
    const highConfig = {
      shotRadius: { value: 1.2 },
      exitSpeed: { value: 16.0 },
      verticalComponent: { value: 0.15 },
    };
    const highResult = runShotSimulation(scenario, highConfig);
    const highShotEvents = highResult.events.filter((e) => e.kind === "shot");
    expect(highShotEvents.length).toBeGreaterThan(0);

    // Extract ball velocity from the shot event payload.
    const lowOutgoing = lowShotEvents[0].payload as { outgoing?: { linearVelocity?: { x: number; y: number; z: number } } };
    const highOutgoing = highShotEvents[0].payload as { outgoing?: { linearVelocity?: { x: number; y: number; z: number } } };

    const lowSpeed = Math.sqrt(
      (lowOutgoing.outgoing?.linearVelocity?.x ?? 0) ** 2 +
        (lowOutgoing.outgoing?.linearVelocity?.y ?? 0) ** 2 +
        (lowOutgoing.outgoing?.linearVelocity?.z ?? 0) ** 2,
    );
    const highSpeed = Math.sqrt(
      (highOutgoing.outgoing?.linearVelocity?.x ?? 0) ** 2 +
        (highOutgoing.outgoing?.linearVelocity?.y ?? 0) ** 2 +
        (highOutgoing.outgoing?.linearVelocity?.z ?? 0) ** 2,
    );

    // High exitSpeed should produce higher ball speed.
    expect(highSpeed).toBeGreaterThan(lowSpeed);
  });

  it("default path (no override) unchanged when no shotConfigOverride is passed", () => {
    const scenario = makeShotScenario("default-test", 60, 10, 20);

    // No shotConfigOverride — should use default FOUNDATION_SHOT_V1.
    const result = runShotSimulation(scenario);
    const shotEvents = result.events.filter((e) => e.kind === "shot");

    // Just verify the simulation ran without errors and produced a shot.
    expect(shotEvents.length).toBeGreaterThan(0);

    // The shot event should have an outgoing velocity.
    const payload = shotEvents[0].payload as { outgoing?: { linearVelocity?: { x: number; y: number; z: number } } };
    expect(payload.outgoing?.linearVelocity).toBeDefined();
  });
});