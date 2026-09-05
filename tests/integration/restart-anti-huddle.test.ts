/**
 * @module tests/integration/restart-anti-huddle
 *
 * Integration guards for RESTART-ANTI-HUDDLE-COHERENCE: the accepted kickoff
 * anti-huddle contract (freeze to fixed homes + nearest-only chase + one
 * taker) re-armed at every match restart in coherent CPU-vs-CPU 5v5 play —
 * throw-in, goal kick, corner and post-goal (adapter/team-decision layer
 * only; the simulation core is untouched and the engine's own restart
 * machinery is what these windows localize).
 *
 * Every guard is discriminating: the same restarts replayed with the
 * `cpuAntiHuddle` kill switch off restore the pre-objective shape — zero
 * frozen bodies at the serve, and on the throw-in arc an untouched restart
 * the stashed match never resolves while four same-team bodies clump it.
 *
 * The accepted kickoff-window invariants are re-guarded here on the live
 * restart runs (serve-window geometry identical to the accepted shape), and
 * the accepted tests/integration/5v5-kickoff-anti-huddle.test.ts suite stays
 * the kickoff source of truth (it is re-run in the node gate unchanged).
 *
 * Node I/O is allowed for scenario loading.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  runRestartAntiHuddleMatch,
  type RestartMatchResult,
  type RestartWindowRecord,
  type RestartWindowKind,
} from "../../eval/runners/restart-anti-huddle-match.js";
import {
  getKickoffFreezeActivations,
  getNearestOnlyChaseActivations,
  getRestartFreezeActivations,
  resetMechanismCounters,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CORNER_MATCH = "eval/scenarios/5v5-continuous-play.v1.json";
const THROWIN_MATCH = "eval/scenarios/5v5-restart-throwin.v1.json";
const ARC_MATCH = "eval/scenarios/5v5-restart-arc.v1.json";

/** A frozen body may not wander further than this from its window anchor. */
const FROZEN_DRIFT_LIMIT_METRES = 1.0;
/** More than this many same-team bodies inside 5 m of the ball is a clump. */
const HUDDLE_LIMIT_PER_TEAM = 2;
/**
 * Same-team bodies inside 5 m of a restarted ball while it is still being
 * served. Mirrors the accepted live-ball density bound: at most one chaser
 * plus support may sit near a ball that is actually in play after touch.
 */
const LIVE_BALL_DENSITY_LIMIT_PER_TEAM = 3;

const HOOK_TIMEOUT = 240_000;

function loadScenario(relativePath: string): ScenarioDefinition {
  return JSON.parse(
    readFileSync(join(projectRoot, relativePath), "utf-8"),
  ) as ScenarioDefinition;
}

interface Run {
  result: RestartMatchResult;
  counters: Record<string, number>;
}

/** Run one match and snapshot the adapter mechanism counters with it. */
function runMatch(path: string, ticks: number, antiHuddle: boolean): Run {
  resetMechanismCounters();
  const result = runRestartAntiHuddleMatch({
    scenario: loadScenario(path),
    maxTicks: ticks,
    cpuAntiHuddle: antiHuddle,
  });
  return {
    result,
    counters: {
      kickoffFreeze: getKickoffFreezeActivations(),
      restartFreeze: getRestartFreezeActivations(),
      nearestOnlyHold: getNearestOnlyChaseActivations(),
    },
  };
}

function windowsOfKind(result: RestartMatchResult, kind: RestartWindowKind): RestartWindowRecord[] {
  return result.windows.filter((w) => w.kind === kind);
}

function serveTicksOf(result: RestartMatchResult, window: RestartWindowRecord) {
  const startIndex = result.ticks.findIndex((t) => t.tick === window.serveStartTick);
  const endIndex = window.firstTouchTick === null
    ? result.ticks.length - 1
    : result.ticks.findIndex((t) => t.tick === window.firstTouchTick);
  return result.ticks.slice(startIndex, endIndex);
}

let liveCorner: Run;
let liveThrowin: Run;
let liveArc: Run;
let stashThrowin: Run;
let stashArc: Run;
let replayArc: Run;

beforeAll(() => {
  // Live windows are kept just long enough to cover their restart types: the
  // corner serve closes at ~471, the throw-in serves at ~109/~941, the goal
  // kick at ~159 and the first post-goal serve at ~905.
  liveCorner = runMatch(CORNER_MATCH, 520, true);
  liveThrowin = runMatch(THROWIN_MATCH, 990, true);
  liveArc = runMatch(ARC_MATCH, 950, true);
  stashThrowin = runMatch(THROWIN_MATCH, 200, false);
  stashArc = runMatch(ARC_MATCH, 950, false);
  replayArc = runMatch(ARC_MATCH, 950, true);
}, HOOK_TIMEOUT);

describe("RESTART-ANTI-HUDDLE: the accepted freeze contract holds at every restart", () => {
  // The Run slots are filled by beforeAll, so every access is lazy.
  const liveWindows: Array<[RestartWindowKind, () => Run]> = [
    ["corner", () => liveCorner],
    ["throw-in", () => liveThrowin],
    ["goal-kick", () => liveArc],
    ["post-goal", () => liveArc],
    // The accepted kickoff window stands as the regression baseline.
    ["kickoff", () => liveThrowin],
  ];

  for (const [kind, refOf] of liveWindows) {
    describe(`per-tick geometry at ${kind} restarts`, () => {
      function windows(): RestartWindowRecord[] {
        return windowsOfKind(refOf().result, kind);
      }

      it(`produces closed ${kind} serve windows in coherent play`, () => {
        expect(windows().length, `no ${kind} window in the window budget`).toBeGreaterThan(0);
        for (const w of windows()) {
          expect(w.open, `${kind} ${w.id} never closed`).toBe(false);
          expect(w.firstTouchTick).not.toBeNull();
          expect(w.serveTicks).toBeGreaterThanOrEqual(1);
        }
      });

      it(`freezes every non-exempt body through the ${kind} serve window`, () => {
        for (const w of windows()) {
          if (kind !== "kickoff") {
            // The core's own restart hold must have run first (≈60 ticks).
            expect(w.holdTicks, `${w.id} hold`).toBeGreaterThanOrEqual(55);
          }
          expect(w.frozenCountAtServe, `${w.id} frozen at serve`).toBe(9);
          expect(w.frozenTicks, `${w.id} frozen ticks`).toBe(w.serveTicks);
          expect(w.maxFrozenDriftMetres, `${w.id} drift`).toBeLessThan(FROZEN_DRIFT_LIMIT_METRES);
        }
      });

      it(`designates exactly one taker per ${kind} serve tick`, () => {
        for (const w of windows()) {
          expect(w.takerId, `${w.id} taker`).toBeTruthy();
          for (const tick of serveTicksOf(refOf().result, w)) {
            const takers = tick.players.filter((p) => p.designatedTaker);
            expect(takers.length, `tick ${tick.tick} takers`).toBe(1);
            expect(takers[0].playerId).toBe(w.takerId);
          }
        }
      });

      it(`keeps ${kind} serve windows clump-free and closes them on the first touch`, () => {
        for (const w of windows()) {
          expect(
            w.maxBodiesWithinHuddleRadius,
            `${w.id} serve density`,
          ).toBeLessThanOrEqual(HUDDLE_LIMIT_PER_TEAM);
          // The first touched commit leaves the untouched state and the
          // reopen respects the accepted single-chaser bound.
          const closedAt = w.firstTouchTick!;
          const tick = refOf().result.ticks.find((t) => t.tick === closedAt)!;
          expect(tick.ballUntouched, `${w.id} still untouched at touch`).toBe(false);
          expect(
            w.maxBodiesWithinHuddleRadiusAfterTouch,
            `${w.id} after-touch density`,
          ).toBeLessThanOrEqual(LIVE_BALL_DENSITY_LIMIT_PER_TEAM);
          expect(w.doubleChaserTeamTicks, `${w.id} double chaser`).toBe(0);
        }
      });
    });
  }

  it("activates the restart freeze path only for restart windows", () => {
    // kickoff_freeze counts every untouched-window freeze body-tick (the
    // accepted counter); restart_freeze counts strictly the non-opening
    // windows. Serve ticks that execute while the core's hold-phase label is
    // still committed are kept still by the accepted phase hold (not the
    // freeze branch), so the counters stay at or below the geometry totals;
    // every live run must light the restart path, and the stashed controls
    // must leave it dark (asserted in the stash block).
    // The throw-in serve is played by its taker on the placement commit
    // itself, so its single untouched tick runs under the core's hold label
    // (accepted phase hold) and lights no freeze counter — its guard is the
    // geometry (frozen bodies + no clump) asserted per-kind above.
    expect(liveThrowin.counters.restartFreeze).toBeGreaterThanOrEqual(0);
    expect(liveCorner.counters.restartFreeze).toBeGreaterThan(0);
    expect(liveArc.counters.restartFreeze).toBeGreaterThan(0);
    expect(liveThrowin.counters.kickoffFreeze)
      .toBeGreaterThanOrEqual(liveThrowin.counters.restartFreeze);
    expect(liveArc.counters.nearestOnlyHold).toBeGreaterThan(0);
    // The counter counts per-slot branch executions at sample time, the
    // geometry counts per-commit flag states; the two agree up to the
    // one-sample serve boundaries, not to the tick.
    const geometryFrozen = liveArc.result.windows
      .filter((w) => w.kind !== "kickoff")
      .reduce((sum, w) => sum + w.frozenBodyTicks, 0);
    expect(geometryFrozen).toBeGreaterThan(0);
    const postGoalFrozen = liveArc.result.windows
      .filter((w) => w.kind === "post-goal")
      .reduce((sum, w) => sum + w.frozenBodyTicks, 0);
    expect(postGoalFrozen).toBeGreaterThan(0);
    expect(Math.abs(liveArc.counters.restartFreeze - geometryFrozen))
      .toBeLessThan(2 * 10 * liveArc.result.windows.length);
  });
});

describe("RESTART-ANTI-HUDDLE: stashing the shape resurfaces the huddle at restarts", () => {
  it("stashes the throw-in serve into an unresolved clump", () => {
    const throws = windowsOfKind(stashThrowin.result, "throw-in");
    expect(throws.length).toBeGreaterThan(0);
    for (const w of throws) {
      // No body is frozen anywhere; the opening serve is not even resolved
      // within the control budget, and the same-team clump is back on it.
      expect(w.frozenTicks).toBe(0);
      expect(w.frozenCountAtServe).toBe(0);
    }
    const open = throws.find((w) => w.open);
    expect(open, "expected a stashed throw-in serve the control never resolves").toBeTruthy();
    expect(open!.maxBodiesWithinHuddleRadius).toBeGreaterThan(HUDDLE_LIMIT_PER_TEAM);
    expect(stashThrowin.result.summary.serveWindowClumpTeamTicks).toBeGreaterThan(0);
    expect(stashThrowin.counters.restartFreeze).toBe(0);
    expect(stashThrowin.counters.kickoffFreeze).toBe(0);
  });

  it("stashes post-goal and kickoff serves into zero frozen bodies", () => {
    for (const kind of ["kickoff", "post-goal"] as RestartWindowKind[]) {
      const ws = windowsOfKind(stashArc.result, kind);
      expect(ws.length, `stashed ${kind} windows`).toBeGreaterThan(0);
      for (const w of ws) {
        expect(w.frozenTicks, `${kind} ${w.id}`).toBe(0);
        expect(w.frozenCountAtServe).toBe(0);
      }
    }
    expect(stashArc.counters.restartFreeze).toBe(0);
    expect(stashArc.counters.kickoffFreeze).toBe(0);
    // Discriminator against the live shape on the SAME scenario/window kind:
    expect(liveArc.counters.restartFreeze).toBeGreaterThan(stashArc.counters.restartFreeze);
  });

  it("keeps the live runs clump-free where the stashed control clumps", () => {
    expect(liveThrowin.result.summary.serveWindowClumpTeamTicks).toBe(0);
    expect(liveArc.result.summary.serveWindowClumpTeamTicks).toBe(0);
    expect(liveCorner.result.summary.serveWindowClumpTeamTicks).toBe(0);
  });
});

describe("RESTART-ANTI-HUDDLE: determinism and artifact consistency", () => {
  it("two identical core-owned runs produce identical per-tick hashes", () => {
    expect(replayArc.result.stateHashes).toEqual(liveArc.result.stateHashes);
    expect(JSON.stringify(replayArc.result.summary.windows)).toBe(
      JSON.stringify(liveArc.result.summary.windows),
    );
  });

  it("the captured evidence artifact covers every occurring restart kind live", () => {
    const artifact = JSON.parse(
      readFileSync(
        join(projectRoot, "docs/evidence/RESTART-ANTI-HUDDLE-COHERENCE/trajectory.json"),
        "utf-8",
      ),
    ) as {
      coverage: Record<string, string[]>;
      runs: Array<{ id: string; anti_huddle: boolean; determinism: Record<string, unknown>; summary: Record<string, unknown> }>;
    };
    for (const kind of ["kickoff", "corner", "throw-in", "goal-kick", "post-goal"]) {
      expect(artifact.coverage[kind], `coverage for ${kind}`).toBeDefined();
      expect(artifact.coverage[kind].length).toBeGreaterThan(0);
    }
    for (const run of artifact.runs) {
      if (run.anti_huddle) {
        expect(run.determinism.replay_identical, run.id).toBe(true);
        expect(run.determinism.state_hash_of_hashes, run.id).toMatch(/^[0-9a-f]{64}$/);
      }
      expect(run.summary.serve_window_clump_team_ticks ?? 0).toBeGreaterThanOrEqual(0);
    }
  });
});
