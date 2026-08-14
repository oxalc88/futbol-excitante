/**
 * @module eval/oracles/prng-order
 *
 * Detects PRNG-order mutation: two otherwise identical simulations
 * diverge because one has its PRNG state mutated mid-run (snapshot
 * / restore with corruption).
 *
 * This oracle runs both the clean and mutant simulations (same
 * scenario, same inputs), mutates the PRNG state at a designated
 * tick, and verifies that the mutant trajectory diverges from the
 * clean one at a tick >= corruptionPoint.
 *
 * A PASS indicates the mutation was detected (genuine divergence).
 * A FAIL indicates the mutation did NOT cause divergence (oracle not working).
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Public API — runs clean vs mutant pair and verifies divergence
// ---------------------------------------------------------------------------

/**
 * Run a clean and a PRNG-order-mutated version of the same scenario
 * over the same input schedule, then verify the mutant diverges.
 *
 * @param scenario     — the scenario definition.
 * @param inputProgram — tick-indexed input program (shared by both runs).
 * @param durationTicks — number of ticks to advance.
 * @param corruptionTick — tick at which the PRNG state is mutated in the mutant run.
 * @returns InvariantResult with pass (divergence detected) or fail (no divergence).
 */
export function checkPrngOrderMutation(
  scenario: ScenarioDefinition,
  inputProgram: Record<number, InputFrame[]>,
  durationTicks: number,
  corruptionTick: number,
): InvariantResult {
  // --- Clean run ---
  const cleanWorld = createWorld({ scenario });
  const cleanSim = createSimulation(cleanWorld);

  const cleanHashes: Map<number, string> = new Map();
  for (let i = 0; i < durationTicks; i++) {
    const inputs = inputProgram[cleanSim.tick] ?? [];
    if (inputs.length > 0) cleanSim.applyInputs(inputs);
    const result = cleanSim.step();
    cleanHashes.set(result.tick, result.stateHash);
  }

  // --- Mutant run: run up to corruption tick, then mutate PRNG ---
  const mutantWorld = createWorld({ scenario });
  const mutantSim = createSimulation(mutantWorld);

  // Run identical ticks before mutation point.
  for (let i = 0; i < corruptionTick && i < durationTicks; i++) {
    const inputs = inputProgram[mutantSim.tick] ?? [];
    if (inputs.length > 0) mutantSim.applyInputs(inputs);
    const result = mutantSim.step();
    // Pre-corruption ticks must match clean.
    if (i < corruptionTick) {
      if (result.stateHash !== cleanHashes.get(result.tick)) {
        return {
          id: "prng-order-mutation-no-match",
          status: "fail",
          description: `Mutant pre-corruption hash at tick ${result.tick} does not match clean run — unexpected divergence before corruption point`,
        };
      }
    }
  }

  // Corrupt PRNG state: deep-clone current state, mutate prng.state, restore.
  const stateBefore = mutantSim.snapshot();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clone = structuredClone
    ? structuredClone(stateBefore)
    : // eslint-disable-next-line no-restricted-globals
      JSON.parse(JSON.stringify(stateBefore));

  const prngState = (clone as any).prng?.state;
  if (typeof prngState === "number") {
    // Mutate by XOR-ing with 1.
    (clone as any).prng.state = prngState ^ 1;
  } else {
    return {
      id: "prng-order-mutation-no-prng",
      status: "fail",
      description:
        "Cannot mutate PRNG: prng.state is not a number — mutant cannot diverge",
    };
  }

  mutantSim.restore(clone);

  // Continue mutant run from corruption tick to end.
  for (let i = corruptionTick; i < durationTicks; i++) {
    const inputs = inputProgram[mutantSim.tick] ?? [];
    if (inputs.length > 0) mutantSim.applyInputs(inputs);
    const result = mutantSim.step();
    // Check for divergence at or after corruption tick.
    if (result.tick >= corruptionTick) {
      if (result.stateHash !== cleanHashes.get(result.tick)) {
        return {
          id: "prng-order-mutation-detected",
          status: "pass",
          description: `PRNG-order mutation detected: mutant diverges from clean run at tick ${result.tick} (corruption at tick ${corruptionTick})`,
        };
      }
    }
  }

  return {
    id: "prng-order-mutation-not-detected",
    status: "fail",
    description: `PRNG-order mutation did not cause divergence over ${durationTicks} ticks — oracle may not be detecting mutation`,
  };
}

// ---------------------------------------------------------------------------
// Wrapper for use with executeOracle (requires observations; ignored)
// ---------------------------------------------------------------------------

/**
 * PRNG-order mutation check as an oracle function.
 *
 * Observations are NOT used; instead this oracle runs the simulation
 * with a corrupted PRNG internally.  The observations parameter is
 * required by the OracleFn signature but ignored.
 *
 * @param _observations — ignored (prng-order oracle runs simulations internally).
 * @returns InvariantResult.
 */
export function checkPrngOrderOracle(
  _observations: import("../../src/contracts/telemetry.js").TelemetryObservation[],
): InvariantResult {
  return {
    id: "prng-order-oracle-not-applicable",
    status: "not_evaluated",
    description:
      "prng-order oracle requires explicit scenario + input program (use checkPrngOrderMutation directly)",
  };
}