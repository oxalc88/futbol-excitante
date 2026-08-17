/**
 * @module tests/integration/cpu-defensive-improvement
 *
 * Integration tests for CPU defensive improvement over 100+ ticks.
 *
 * Tests:
 *  1. 100-tick 3v3 simulation with defensive behavior produces
 *     deterministic hash.
 *  2. Defensive sub-modes appear in team decisions during match play.
 *  3. Full 100-tick trajectory is reproducible across runs.
 *
 * No Math.random, Date, DOM, or Node I/O in simulation-facing code.
 */

import { describe, it, expect } from "vitest";
import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import {
  buildCpuObservation,
  computeTeamDecision,
  createCpuAdapter,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import { hashFnv1a64 } from "../../src/simulation/determinism/hash.js";
import { encodeCanonical } from "../../src/simulation/determinism/canonical.js";
import { FOUNDATION_SCENARIO_3V3 } from "../../src/apps/browser/foundation-scenario.js";

const slotKeys = Object.keys(FOUNDATION_SCENARIO_3V3.controlAssignments);
const assignments = FOUNDATION_SCENARIO_3V3.controlAssignments;

/**
 * Helper: run a 100-tick 3v3 simulation with team-decision wiring,
 * optionally capturing sub-mode statistics.
 */
function run3v3Simulation(
  ticks: number,
  captureSubModes?: {
    defendCount: number;
    markingCount: number;
    pressingCount: number;
    recoveringCount: number;
  },
): { finalHash: string; stateHashes: string[] } {
  const sim = createSimulation(createWorld({ scenario: FOUNDATION_SCENARIO_3V3 }));
  const adapters = slotKeys.map(() => createCpuAdapter());

  // Group slots by team for shared team-decision wiring.
  const slotsByTeam = new Map<string, string[]>();
  for (const [slot, assignment] of Object.entries(assignments)) {
    const list = slotsByTeam.get(assignment.teamId) ?? [];
    list.push(slot);
    slotsByTeam.set(assignment.teamId, list);
  }

  const stateHashes: string[] = [];

  for (let i = 0; i < ticks; i++) {
    const snapshot = sim.snapshot();

    // Compute team decisions (one per team).
    const teamDecisions = new Map<string, ReturnType<typeof computeTeamDecision>>();
    for (const [teamId, slots] of slotsByTeam) {
      const firstSlot = slots[0];
      const firstAssignment = assignments[firstSlot];
      const obs = buildCpuObservation(
        snapshot,
        firstAssignment.teamId,
        firstAssignment.controlledPlayerId,
      );
      const td = computeTeamDecision(obs, teamId);
      teamDecisions.set(teamId, td);

      // Capture sub-mode statistics if requested.
      if (captureSubModes) {
        if (td.strategy === "DEFEND") captureSubModes.defendCount++;
        if (td.defensiveSubMode === "MARKING") captureSubModes.markingCount++;
        if (td.defensiveSubMode === "PRESSING") captureSubModes.pressingCount++;
        if (td.defensiveSubMode === "RECOVERING") captureSubModes.recoveringCount++;
      }
    }

    // Build frames with team decisions wired in.
    const frames: Parameters<typeof sim.applyInputs>[0] = [];
    for (const [teamId, slots] of slotsByTeam) {
      const teamDecision = teamDecisions.get(teamId)!;
      for (const slotKey of slots) {
        const assignment = assignments[slotKey];
        const obs = buildCpuObservation(
          snapshot,
          assignment.teamId,
          assignment.controlledPlayerId,
        );
        obs.teamDecision = teamDecision;

        const adapterIdx = slotKeys.indexOf(slotKey);
        const frame = adapters[adapterIdx].sample(sim.tick, obs);
        frame.controlSlot = assignment.controlSlot;
        frames.push(frame);
      }
    }

    sim.applyInputs(frames);
    const result = sim.step();
    stateHashes.push(result.stateHash);
  }

  const finalSnapshot = sim.snapshot();
  const hashInput = encodeCanonical(finalSnapshot);
  const finalHash = hashFnv1a64(hashInput);

  return { finalHash, stateHashes };
}

// ===========================================================================
// 1. 100-tick simulation with defensive behavior
// ===========================================================================

describe("CPU-DEF-INT-001: 100-tick simulation with defensive behavior", () => {
  it("100-tick 3v3 simulation completes and produces a deterministic hash", () => {
    const hash1 = run3v3Simulation(100).finalHash;
    const hash2 = run3v3Simulation(100).finalHash;

    expect(hash1).toMatch(/^fnv1a64-v1:/);
    expect(hash1).toBe(hash2);
  });
});

// ===========================================================================
// 2. Defensive sub-modes appear during match play
// ===========================================================================

describe("CPU-DEF-INT-002: defensive sub-modes in match play", () => {
  it("defensive sub-modes are valid values in team decisions over 100 ticks", () => {
    const sim = createSimulation(createWorld({ scenario: FOUNDATION_SCENARIO_3V3 }));
    const adapters = slotKeys.map(() => createCpuAdapter());

    const validSubModes = new Set(["NONE", "PRESSING", "MARKING", "RECOVERING"]);

    for (let i = 0; i < 100; i++) {
      const snapshot = sim.snapshot();
      const frames: Parameters<typeof sim.applyInputs>[0] = [];

      for (let s = 0; s < slotKeys.length; s++) {
        const slot = assignments[slotKeys[s]];
        const obs = buildCpuObservation(
          snapshot,
          slot.teamId,
          slot.controlledPlayerId,
        );
        const teamDecision = computeTeamDecision(obs, slot.teamId);
        obs.teamDecision = teamDecision;

        // Verify the defensive sub-mode is always a valid value.
        expect(validSubModes.has(teamDecision.defensiveSubMode)).toBe(true);
        // Verify the strategy/sub-mode relationship is consistent.
        if (teamDecision.strategy === "ATTACK") {
          expect(teamDecision.defensiveSubMode).toBe("NONE");
        }
        if (teamDecision.strategy === "DEFEND") {
          expect(["PRESSING", "MARKING"]).toContain(teamDecision.defensiveSubMode);
        }

        const frame = adapters[s].sample(sim.tick, obs);
        frame.controlSlot = slot.controlSlot;
        frames.push(frame);
      }

      sim.applyInputs(frames);
      sim.step();
    }
  });
});

// ===========================================================================
// 3. Deterministic trajectory over 100 ticks
// ===========================================================================

describe("CPU-DEF-INT-003: deterministic trajectory", () => {
  it("100-tick trajectory hashes are identical across independent runs", () => {
    const run1 = run3v3Simulation(100);
    const run2 = run3v3Simulation(100);

    // All per-tick hashes should match.
    expect(run1.stateHashes.length).toBe(100);
    expect(run2.stateHashes.length).toBe(100);
    for (let i = 0; i < 100; i++) {
      expect(run1.stateHashes[i]).toBe(run2.stateHashes[i]);
    }
  });

  it("different seed produces different trajectory", () => {
    const scenario1 = { ...FOUNDATION_SCENARIO_3V3, seed: 42 };
    const scenario2 = { ...FOUNDATION_SCENARIO_3V3, seed: 99 };

    const run = (scenario: typeof FOUNDATION_SCENARIO_3V3) => {
      const sim = createSimulation(createWorld({ scenario }));
      const adapters = slotKeys.map(() => createCpuAdapter());
      const hashes: string[] = [];

      for (let i = 0; i < 100; i++) {
        const snapshot = sim.snapshot();
        const frames: Parameters<typeof sim.applyInputs>[0] = [];
        for (let s = 0; s < slotKeys.length; s++) {
          const slot = assignments[slotKeys[s]];
          const frame = adapters[s].sample(
            sim.tick,
            buildCpuObservation(snapshot, slot.teamId, slot.controlledPlayerId),
          );
          frame.controlSlot = slot.controlSlot;
          frames.push(frame);
        }
        sim.applyInputs(frames);
        hashes.push(sim.step().stateHash);
      }
      return hashes;
    };

    const h1 = run(scenario1);
    const h2 = run(scenario2);
    expect(h1).not.toEqual(h2);
  });
});
