/**
 * @module tests/integration/match-timer
 *
 * Integration tests for auto-enforcing match timer (MATCH-TIMER-ENFORCEMENT).
 *
 * Uses the 3v3-fixture scenario with a short match duration to verify
 * the full match lifecycle in a realistic headless simulation.
 *
 * Tests:
 *  - 200+ tick simulation with phase transitions.
 *  - First half → halftime → second half → fulltime.
 *  - Determinism: same scenario → same trajectory.
 *  - Timer values in presentation match world state.
 *  - No invariant failures during phase transitions.
 *
 * No Math.random, Date, DOM, or Node I/O in simulation-facing code.
 * Node I/O is allowed here in tests (for file reading).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { deepClone } from "../../src/simulation/world/clone.js";
import { NO_OP_OBSERVER } from "../../src/simulation/telemetry/observer.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { MatchPhase } from "../../src/contracts/state.js";

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

function loadFixture(name: string): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(__dirname, `../../eval/scenarios/${name}`);
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

/**
 * Create a short-match variant of the 3v3 fixture.
 * Each half is 50 ticks, with 20-tick halftime delay.
 * Total match: first half (50) + halftime (20) + second half (50) = 120 ticks.
 */
function makeShortMatch3v3(): ScenarioDefinition {
  const scenario = loadFixture("3v3-fixture.v1.json");
  // Override with short duration for integration test.
  const updated = {
    ...scenario,
    id: "3v3-match-timer-integration",
    durationTicks: 200,
    matchDurationTicks: 50,
    observationWindows: [{ startTick: 0, endTick: 200 }],
  };
  return updated as ScenarioDefinition;
}

// ---------------------------------------------------------------------------
// 1. Full match lifecycle (playing → halftime → playing → fulltime)
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-INTEGRATION-001: full match lifecycle", () => {
  it("runs 200+ ticks with correct phase transitions", () => {
    const scenario = makeShortMatch3v3();
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    const phases: { tick: number; phase: MatchPhase; timer: number; half: number }[] = [];

    // Run the simulation.
    for (let i = 0; i < 200; i++) {
      sim.applyInputs([]);
      sim.step();

      const snap = sim.snapshot() as {
        matchPhase: MatchPhase;
        matchTimer: number;
        currentHalf: number;
      };

      // Verify consistency between snapshot and presentation.
      expect(snap.matchPhase).toBe(sim.presentation().matchPhase);
      expect(snap.matchTimer).toBe(sim.presentation().matchTimer);

      phases.push({
        tick: sim.tick,
        phase: snap.matchPhase,
        timer: snap.matchTimer,
        half: snap.currentHalf,
      });
    }

    // Verify phase transitions occurred in order.
    const tickZeroPhase = phases[0].phase;
    expect(tickZeroPhase).toBe("playing");

    // At tick ~50, should transition to halftime.
    const halftimeTick = phases.findIndex((p) => p.phase === "halftime");
    expect(halftimeTick).toBeGreaterThan(0);
    expect(halftimeTick).toBeLessThanOrEqual(50);

    // During halftime, currentHalf should be 1.
    const halftimePhases = phases.filter((p) => p.phase === "halftime");
    for (const p of halftimePhases) {
      expect(p.half).toBe(1);
    }

    // After halftime countdown, should transition to playing (second half).
    const secondHalfStart = phases.findIndex(
      (p, i) => p.phase === "playing" && i > halftimeTick,
    );
    expect(secondHalfStart).toBeGreaterThan(halftimeTick);

    // Second half start should have currentHalf=2 and timer reset.
    expect(phases[secondHalfStart].half).toBe(2);
    expect(phases[secondHalfStart].timer).toBe(50);

    // At the end, should be fulltime.
    const lastPhase = phases[phases.length - 1].phase;
    expect(lastPhase).toBe("fulltime");
  });

  it("no invariant failures during phase transitions", () => {
    const scenario = makeShortMatch3v3();
    let invariantFailures = 0;
    let observations = 0;

    const collectingObserver = {
      ...NO_OP_OBSERVER,
      onInvariantFail: () => {
        invariantFailures++;
      },
      onObservation: () => {
        observations++;
      },
    };

    const sim = createSimulation(createWorld({ scenario }), collectingObserver);

    for (let i = 0; i < 200; i++) {
      sim.applyInputs([]);
      sim.step();
    }

    expect(invariantFailures).toBe(0);
    expect(observations).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 2. Determinism with match timer
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-INTEGRATION-002: determinism with match timer", () => {
  it("same scenario produces identical timer and phase trajectories", () => {
    const scenarioA = makeShortMatch3v3();
    const scenarioB = makeShortMatch3v3();

    const simA = createSimulation(createWorld({ scenario: scenarioA }), NO_OP_OBSERVER);
    const simB = createSimulation(createWorld({ scenario: scenarioB }), NO_OP_OBSERVER);

    for (let i = 0; i < 200; i++) {
      simA.applyInputs([]);
      simB.applyInputs([]);

      simA.step();
      simB.step();

      const snapA = simA.snapshot() as {
        matchTimer: number;
        currentHalf: number;
        matchPhase: MatchPhase;
      };
      const snapB = simB.snapshot() as {
        matchTimer: number;
        currentHalf: number;
        matchPhase: MatchPhase;
      };

      expect(snapA.matchTimer).toBe(snapB.matchTimer);
      expect(snapA.currentHalf).toBe(snapB.currentHalf);
      expect(snapA.matchPhase).toBe(snapB.matchPhase);
      expect(simA.stateHash()).toBe(simB.stateHash());
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Timer in presentation matches world state
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-INTEGRATION-003: presentation consistency", () => {
  it("presentation matchTimer always matches world state", () => {
    const scenario = makeShortMatch3v3();
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    for (let i = 0; i < 200; i++) {
      sim.applyInputs([]);
      sim.step();

      const pres = sim.presentation();
      const snap = sim.snapshot() as { matchTimer: number };

      expect(pres.matchTimer).toBe(snap.matchTimer);
      expect(pres.matchPhase).toBe(snap.matchPhase);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Timer zero at fulltime
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-INTEGRATION-004: timer zero at fulltime", () => {
  it("matchTimer is zero when fulltime is reached", () => {
    const scenario = makeShortMatch3v3();
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    for (let i = 0; i < 200; i++) {
      sim.applyInputs([]);
      sim.step();
    }

    const pres = sim.presentation();
    const snap = sim.snapshot() as { matchPhase: MatchPhase; matchTimer: number };

    expect(pres.matchPhase).toBe("fulltime");
    expect(snap.matchPhase).toBe("fulltime");
    expect(pres.matchTimer).toBe(0);
    expect(snap.matchTimer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. 5400-tick default: no phase transitions within reasonable scope
// ---------------------------------------------------------------------------

describe("MATCH-TIMER-INTEGRATION-005: default 5400 ticks", () => {
  it("5400-tick scenario does not transition during first 100 ticks", () => {
    const scenario = loadFixture("3v3-fixture.v1.json");
    const sim = createSimulation(createWorld({ scenario }), NO_OP_OBSERVER);

    for (let i = 0; i < 100; i++) {
      sim.applyInputs([]);
      sim.step();
    }

    const snap = sim.snapshot() as {
      matchPhase: MatchPhase;
      matchTimer: number;
      currentHalf: number;
    };

    expect(snap.matchPhase).toBe("playing");
    expect(snap.matchTimer).toBe(5300);
    expect(snap.currentHalf).toBe(1);
  });
});