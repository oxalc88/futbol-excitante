/**
 * @module 2v2-scoring-long-a-tests
 *
 * Long-running 2v2 scoring test: multiple goals in a 1000-tick match (~25-30s).
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

describe("GOAL-2V2-006: multiple goals (long)", () => {
  // long 1000-tick free-play fixture; updated budget: controlledPlayerId passthrough
  // enables per-player CPU decisions (mirrors browser bridge), increasing per-tick
  // decision work. Measured ~30s for 1000 ticks post-fix (was ~15s baseline).
  it("multiple goals accumulate in score", () => {
    const scenario = buildForcedGoal2v2Scenario(0, 1000);
    const result = runHeadlessMatch({ scenario });

    const teamAGoals = result.score["team-a"] ?? 0;
    const teamBGoals = result.score["team-b"] ?? 0;

    // At least some goals should be scored by team-a in this setup.
    // (Ball starts near +x and is shot toward +52.5)
    expect(teamAGoals + teamBGoals).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
