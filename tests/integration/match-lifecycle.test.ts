/**
 * @module match-lifecycle-integration-tests
 *
 * Tests for match phase tracking in the headless CPU-vs-CPU match runner
 * (MATCH-LIFECYCLE).
 *
 * Tests:
 *  - Phase progression: kickoff → first-half → halftime → second-half → fulltime.
 *  - Custom halfDurationTicks.
 *  - matchPhase and phaseHistory are present in HeadlessMatchResult.
 *  - Determinism: same seed → same phase sequence.
 *  - Goal event triggers post-goal kickoff phase.
 *  - Phase history records transitions.
 *
 * No Math.random, Date, DOM, or Node I/O in the match runner.
 * Node I/O is allowed here in tests (for assertions).
 */

import { describe, it, expect } from "vitest";
import {
  runHeadlessMatch,
  makeAiMatchScenario,
  type HeadlessMatchConfig,
  type MatchPhase,
  type PhaseHistoryRecord,
} from "../../eval/runners/headless-match.js";

/**
 * Find the match phase active at a given tick by looking at phase history.
 * Phase history records transitions only, so we find the latest entry
 * whose tick is at or before the target tick.
 */
function phaseAtTick(
  phaseHistory: PhaseHistoryRecord[],
  tick: number,
): MatchPhase | undefined {
  for (let i = phaseHistory.length - 1; i >= 0; i--) {
    if (phaseHistory[i].tick <= tick) {
      return phaseHistory[i].phase;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// 1. Phase presence in HeadlessMatchResult
// ---------------------------------------------------------------------------

describe("MATCH-LIFECYCLE-001: matchPhase and phaseHistory in result", () => {
  it("result contains matchPhase field", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    expect(result.matchPhase).toBeDefined();
    expect(typeof result.matchPhase).toBe("string");
  });

  it("result contains phaseHistory array", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    expect(Array.isArray(result.phaseHistory)).toBe(true);
    expect(result.phaseHistory.length).toBeGreaterThan(0);
  });

  it("phaseHistory entries have tick and phase fields", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    for (const entry of result.phaseHistory) {
      expect(entry.tick).toBeTypeOf("number");
      expect(entry.phase).toBeDefined();
      expect(["kickoff", "first-half", "halftime", "second-half", "fulltime"]).toContain(
        entry.phase,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Default phase progression (600 ticks, halfDuration = 300)
// ---------------------------------------------------------------------------

describe("MATCH-LIFECYCLE-002: default phase progression", () => {
  const scenario = makeAiMatchScenario();

  it("tick 0 is kickoff", () => {
    const result = runHeadlessMatch({ scenario, maxTicks: 1 });
    expect(result.matchPhase).toBe("kickoff");
  });

  it("phaseHistory starts at tick 0 with kickoff", () => {
    const result = runHeadlessMatch({ scenario });
    expect(result.phaseHistory[0]).toEqual({ tick: 0, phase: "kickoff" });
  });

  it("tick 1 is first-half", () => {
    const result = runHeadlessMatch({ scenario, maxTicks: 100, halfDurationTicks: 300 });
    expect(phaseAtTick(result.phaseHistory, 1)).toBe("first-half");
  });

  it("early ticks (e.g. tick 150) are first-half", () => {
    const result = runHeadlessMatch({ scenario, maxTicks: 151, halfDurationTicks: 300 });
    expect(phaseAtTick(result.phaseHistory, 150)).toBe("first-half");
  });

  it("first-half ticks before halfDuration have first-half phase", () => {
    const result = runHeadlessMatch({ scenario, maxTicks: 299, halfDurationTicks: 300 });
    expect(phaseAtTick(result.phaseHistory, 298)).toBe("first-half");
  });

  it("tick halfDurationTicks (300) is halftime", () => {
    const result = runHeadlessMatch({ scenario, maxTicks: 301, halfDurationTicks: 300 });
    expect(phaseAtTick(result.phaseHistory, 300)).toBe("halftime");
  });

  it("first tick after halftime is second-half", () => {
    const result = runHeadlessMatch({ scenario, maxTicks: 302, halfDurationTicks: 300 });
    expect(phaseAtTick(result.phaseHistory, 301)).toBe("second-half");
  });

  it("mid second-half is second-half", () => {
    const result = runHeadlessMatch({ scenario, maxTicks: 450, halfDurationTicks: 300 });
    expect(phaseAtTick(result.phaseHistory, 400)).toBe("second-half");
  });

  it("tick 2*halfDurationTicks (600) is fulltime", () => {
    const result = runHeadlessMatch({ scenario, maxTicks: 600 });
    expect(phaseAtTick(result.phaseHistory, 600)).toBe("fulltime");
  });

  it("default 600-tick match ends at fulltime", () => {
    const result = runHeadlessMatch({ scenario });
    expect(result.matchPhase).toBe("fulltime");
  });

  it("phaseHistory contains all transitions in default match", () => {
    const result = runHeadlessMatch({ scenario });
    const phases = result.phaseHistory.map((p) => p.phase);

    expect(phases).toContain("kickoff");
    expect(phases).toContain("first-half");
    expect(phases).toContain("halftime");
    expect(phases).toContain("second-half");
    expect(phases).toContain("fulltime");
  });

  it("default match has 5 phase transitions in history", () => {
    const result = runHeadlessMatch({ scenario });

    expect(result.phaseHistory.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 3. Custom halfDurationTicks
// ---------------------------------------------------------------------------

describe("MATCH-LIFECYCLE-003: custom halfDurationTicks", () => {
  it("halfDurationTicks = 50: phase transitions at correct ticks", () => {
    const scenario = makeAiMatchScenario();
    scenario.durationTicks = 200;

    // Run enough ticks to reach fulltime (2 * 50 = 100) and beyond
    const result = runHeadlessMatch({ scenario, maxTicks: 200, halfDurationTicks: 50 });

    // Phase at tick 0: kickoff
    expect(phaseAtTick(result.phaseHistory, 0)).toBe("kickoff");

    // Tick 1: first-half
    expect(phaseAtTick(result.phaseHistory, 1)).toBe("first-half");

    // Tick 49: first-half (last tick before halftime)
    expect(phaseAtTick(result.phaseHistory, 49)).toBe("first-half");

    // Tick 50: halftime
    expect(phaseAtTick(result.phaseHistory, 50)).toBe("halftime");

    // Tick 51: second-half
    expect(phaseAtTick(result.phaseHistory, 51)).toBe("second-half");

    // Tick 99: second-half (last tick before fulltime at tick 100)
    expect(phaseAtTick(result.phaseHistory, 99)).toBe("second-half");

    // Tick 100: fulltime (2 * 50 = 100)
    expect(phaseAtTick(result.phaseHistory, 100)).toBe("fulltime");

    // Match ends at fulltime (last tick 199)
    expect(result.matchPhase).toBe("fulltime");
  });

  it("halfDurationTicks = 20: short match", () => {
    const scenario = makeAiMatchScenario();
    scenario.durationTicks = 50;

    const result = runHeadlessMatch({ scenario, maxTicks: 50, halfDurationTicks: 20 });

    expect(result.matchPhase).toBe("fulltime");
    expect(result.phaseHistory.length).toBe(5);
    expect(result.phaseHistory[0]).toEqual({ tick: 0, phase: "kickoff" });
    expect(result.phaseHistory[1]).toEqual({ tick: 1, phase: "first-half" });
    expect(result.phaseHistory[2]).toEqual({ tick: 20, phase: "halftime" });
    expect(result.phaseHistory[3]).toEqual({ tick: 21, phase: "second-half" });
    expect(result.phaseHistory[4]).toEqual({ tick: 40, phase: "fulltime" });
  });

  it("halfDurationTicks = 1: minimal half", () => {
    const scenario = makeAiMatchScenario();
    scenario.durationTicks = 3;

    const result = runHeadlessMatch({ scenario, maxTicks: 3, halfDurationTicks: 1 });

    // tick 0: kickoff
    // tick 1: halftime (i === halfDurationTicks === 1)
    // tick 2: fulltime (i >= 2 * 1 = 2)
    expect(result.matchPhase).toBe("fulltime");
    const phases = result.phaseHistory.map((p) => p.phase);
    expect(phases).toEqual(["kickoff", "halftime", "fulltime"]);
  });

  it("halfDurationTicks overrides default computation", () => {
    const scenario = makeAiMatchScenario();
    // Default halfDurationTicks would be 600/2 = 300. With halfDurationTicks: 100,
    // running 201 ticks reaches fulltime at tick 200 (2 * 100).
    const result = runHeadlessMatch({ scenario, maxTicks: 201, halfDurationTicks: 100 });

    // At tick 200 (the last tick), 2 * 100 = 200, so we're at fulltime
    expect(result.matchPhase).toBe("fulltime");
  });
});

// ---------------------------------------------------------------------------
// 4. Determinism
// ---------------------------------------------------------------------------

describe("MATCH-LIFECYCLE-004: determinism", () => {
  it("same seed → identical phase sequence", () => {
    const scenario = makeAiMatchScenario();
    const r1 = runHeadlessMatch({ scenario, maxTicks: 300 });
    const r2 = runHeadlessMatch({ scenario, maxTicks: 300 });

    expect(r1.phaseHistory).toEqual(r2.phaseHistory);
    expect(r1.matchPhase).toBe(r2.matchPhase);
  });

  it("same seed → identical phaseHistory across runs", () => {
    const scenario = makeAiMatchScenario();
    const r1 = runHeadlessMatch({ scenario });
    const r2 = runHeadlessMatch({ scenario });

    expect(r1.phaseHistory.length).toBe(r2.phaseHistory.length);
    for (let i = 0; i < r1.phaseHistory.length; i++) {
      expect(r1.phaseHistory[i].tick).toBe(r2.phaseHistory[i].tick);
      expect(r1.phaseHistory[i].phase).toBe(r2.phaseHistory[i].phase);
    }
  });

  it("phaseHistory is stable across different tick counts", () => {
    const scenario = makeAiMatchScenario();
    // Up to tick 100, the phase should be the same regardless of total ticks
    const r1 = runHeadlessMatch({ scenario, maxTicks: 200 });
    const r2 = runHeadlessMatch({ scenario, maxTicks: 600 });

    // First 100 ticks should have same phases
    for (let i = 0; i < 100; i++) {
      const p1 = r1.phaseHistory.find((p) => p.tick === i);
      const p2 = r2.phaseHistory.find((p) => p.tick === i);
      if (p1 && p2) {
        expect(p1.phase).toBe(p2.phase);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Goal-triggered kickoff phase
// ---------------------------------------------------------------------------

describe("MATCH-LIFECYCLE-005: goal-triggered kickoff", () => {
  it("goal at any tick → next tick is kickoff phase", () => {
    const scenario: HeadlessMatchConfig["scenario"] = {
      id: "lifecycle-goal-test-v1",
      version: "1.0.0",
      family: "match-lifecycle",
      durationTicks: 300,
      seed: 42,
      prngAlgorithmId: "mulberry32-v1",
      schemaVersion: "state-v1",
      simulationVersion: "sim-v1",
      configVersion: "foundation-config-v1",
      profile: "LABORATORY",
      pitchLength: 105,
      pitchWidth: 68,
      safetyBounds: {
        maxX: 52.5,
        maxY: 34,
        minZ: -0.5,
        maxZ: 20,
      },
      players: [
        {
          playerId: "cpu-a",
          teamId: "team-a",
          groundPosition: { x: 50, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
          archetypeId: "archetype-burst-v1",
        },
        {
          playerId: "cpu-b",
          teamId: "team-b",
          groundPosition: { x: -40, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 0, y: 0 },
          bodyHeading: Math.PI,
          desiredHeading: Math.PI,
          archetypeId: "archetype-steady-v1",
        },
      ],
      ball: {
        position: { x: 50, y: 0, z: 0.11 },
        linearVelocity: { x: 30, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll",
      },
      controlAssignments: {
        "slot-a": {
          controlSlot: "slot-a",
          teamId: "team-a",
          controlledPlayerId: "cpu-a",
          mode: "AI_FALLBACK",
        },
        "slot-b": {
          controlSlot: "slot-b",
          teamId: "team-b",
          controlledPlayerId: "cpu-b",
          mode: "AI_FALLBACK",
        },
      },
      missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
      maxConsecutiveMissing: 3,
      inputProgram: {},
      scheduledEvents: {},
      observationWindows: [{ startTick: 0, endTick: 300 }],
      requestedMetrics: [],
    };

    const result = runHeadlessMatch({ scenario, maxTicks: 300 });

    // Find the tick of the first goal.
    const goalEvent = result.events.find((e) => e.kind === "goal");
    // The goal may or may not occur; if it does, the same tick after
    // the goal should be "kickoff" (post-goal kickoff phase).
    if (goalEvent) {
      // At the goal tick, the phase should be "kickoff" (the post-goal kickoff).
      // Phase history records the transition: at tick 6, phase becomes "kickoff".
      const goalTickPhase = phaseAtTick(result.phaseHistory, goalEvent.tick);
      expect(goalTickPhase).toBe("kickoff");

      // The next tick should have resumed normal progression.
      const nextPhase = phaseAtTick(result.phaseHistory, goalEvent.tick + 1);
      if (nextPhase !== undefined) {
        // It should NOT be "kickoff" anymore — we're back in normal play.
        expect(nextPhase).not.toBe("kickoff");
      }
    }
  });

  it("post-goal kickoff does not affect other matches (no-goal scenario)", () => {
    const scenario = makeAiMatchScenario();
    // Use a full 600-tick match with default halfDurationTicks = 300
    const result = runHeadlessMatch({ scenario });

    // No goals → no post-goal kickoff
    const phases = result.phaseHistory.map((p) => p.phase);
    expect(phases).toEqual(["kickoff", "first-half", "halftime", "second-half", "fulltime"]);
  });
});

// ---------------------------------------------------------------------------
// 6. Phase history completeness
// ---------------------------------------------------------------------------

describe("MATCH-LIFECYCLE-006: phase history completeness", () => {
  it("phase history has correct number of entries for a full match", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    // With no goals: 5 entries (kickoff, first-half, halftime, second-half, fulltime)
    expect(result.phaseHistory.length).toBe(5);
  });

  it("phase history entries are in increasing tick order", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    for (let i = 1; i < result.phaseHistory.length; i++) {
      expect(result.phaseHistory[i].tick).toBeGreaterThan(result.phaseHistory[i - 1].tick);
    }
  });

  it("final matchPhase matches the last phaseHistory entry", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    const lastEntry = result.phaseHistory[result.phaseHistory.length - 1];
    expect(result.matchPhase).toBe(lastEntry.phase);
  });

  it("zero-tick run has only kickoff in phaseHistory", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario, maxTicks: 0 });

    expect(result.phaseHistory).toEqual([{ tick: 0, phase: "kickoff" }]);
    expect(result.matchPhase).toBe("kickoff");
  });
});

// ---------------------------------------------------------------------------
// 7. Half duration config default
// ---------------------------------------------------------------------------

describe("MATCH-LIFECYCLE-007: halfDurationTicks default behavior", () => {
  it("defaults to matchDurationTicks / 2", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    // Default: matchDurationTicks = 600, halfDurationTicks = 300
    // So halftime should be at tick 300
    const halftimeEntry = result.phaseHistory.find((p) => p.phase === "halftime");
    expect(halftimeEntry).toBeDefined();
    expect(halftimeEntry!.tick).toBe(300);
  });

  it("matchDurationTicks + custom halfDurationTicks", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({
      scenario,
      maxTicks: 200,
      matchDurationTicks: 200,
      halfDurationTicks: 50,
    });

    expect(result.matchDurationTicks).toBe(200);
    expect(result.matchPhase).toBe("fulltime");
  });
});

// ---------------------------------------------------------------------------
// 8. MatchPhase type is exhaustive
// ---------------------------------------------------------------------------

describe("MATCH-LIFECYCLE-008: valid MatchPhase values", () => {
  it("all five phases are observed in a long match", () => {
    const scenario = makeAiMatchScenario();
    const result = runHeadlessMatch({ scenario });

    const phases = new Set(result.phaseHistory.map((p) => p.phase));
    expect(phases.has("kickoff")).toBe(true);
    expect(phases.has("first-half")).toBe(true);
    expect(phases.has("halftime")).toBe(true);
    expect(phases.has("second-half")).toBe(true);
    expect(phases.has("fulltime")).toBe(true);
  });
});