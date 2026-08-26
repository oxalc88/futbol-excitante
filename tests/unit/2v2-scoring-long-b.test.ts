/**
 * @module 2v2-scoring-long-b-tests
 *
 * Long-running 2v2 scoring test: full-time detection in a 1000-tick match (~25-30s).
 *
 * Split from 2v2-scoring-long.test.ts into per-test files so vitest assigns
 * each long test its own worker at file granularity. With 3 tests in one file,
 * one worker blocks ~76s cumulative, exceeding the 60s birpc RPC window and
 * causing onTaskUpdate timeout (exit 1). One test per file keeps each worker
 * at ~28-30s, safely inside the budget.
 *
 * All assertions byte-identical to the original; only the file boundary changed.
 *
 * No Math.random, Date, DOM, or Node I/O in the simulation core.
 */

import { describe, it, expect } from "vitest";
import { runHeadlessMatch } from "../../eval/runners/headless-match.js";
import { buildForcedGoal2v2Scenario } from "./2v2-scoring-helpers.js";

describe("GOAL-2V2-007: full-time detection (long)", () => {
  // long 1000-tick free-play fixture; updated budget for controlledPlayerId overhead
  it("long match reaches fulltime", () => {
    const scenario = buildForcedGoal2v2Scenario(0, 1000);
    const result = runHeadlessMatch({ scenario, maxTicks: 1000 });

    expect(result.matchPhase).toBe("fulltime");
    expect(result.elapsedTicks).toBe(1000);
  }, 60_000);
});
