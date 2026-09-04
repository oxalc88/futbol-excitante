/**
 * @module tests/integration/ball-settled-regime-match
 *
 * Match-level guards for BALL-SETTLED-REGIME-FIX (`ball-settled-regime-v2`)
 * over a coherent 5v5 CPU-vs-CPU kickoff match — the run whose kickoff window
 * disclosed the defect: touches and passes fired while the ball's centre-spot
 * position never changed.
 *
 * Pinned here, on the production driver (`runAntiHuddleMatch`, the browser
 * composition root's observation shape):
 *   1. a settled ball that receives a real touch impulse then travels,
 *   2. the kickoff window opens instead of dead-balling,
 *   3. the accepted pitch-contact flood stays closed on a long run (bounded per
 *      100 ticks, never more than one contact in a single tick, and never
 *      contacts on consecutive ticks),
 *   4. the ball is never teleported: every per-tick step stays inside the
 *      integration bound, and velocity without displacement no longer persists,
 *   5. same seed → byte-identical per-tick hash chain across two runs.
 *
 * Guards 1, 2 and the non-vacuity half of 5 go red when the settled branch is
 * reverted to no-physics; 3 and 4 are the preservation half of the objective
 * (the accepted oscillation fix must keep working, so they hold either way).
 *
 * Node I/O is allowed for scenario loading.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runAntiHuddleMatch } from "../../eval/runners/anti-huddle-match.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const KICKOFF_MATCH = "eval/scenarios/5v5-fixture-v1.json";

/** Long enough to cover the kickoff window and the play that follows it. */
const TICKS = 600;

/** Event kinds that mean "a body played the ball". */
const TOUCH_KINDS = new Set([
  "player-ball-contact",
  "pass",
  "lofted-pass",
  "through-ball",
  "shot",
]);

/**
 * Regression bound, not a reference envelope. The accepted flood signature is a
 * pitch-contact on nearly every tick (60 per 100 ticks); with the flood closed
 * a settled-ball touch rolls without contacting the pitch at all.
 */
const PITCH_CONTACTS_PER_100_TICKS_LIMIT = 5;

/**
 * The fastest declared ball action integrated over one 1/60 s tick, with
 * headroom. Anything above this is a position assignment, not an integration —
 * the same bound the accepted anti-huddle no-teleport invariant uses.
 */
const MAX_BALL_TICK_STEP_METRES = 2;

const RUN_TIMEOUT = 120_000;

function loadScenario(relativePath: string): ScenarioDefinition {
  return JSON.parse(
    readFileSync(join(projectRoot, relativePath), "utf-8"),
  ) as ScenarioDefinition;
}

type KickoffRun = ReturnType<typeof runAntiHuddleMatch>;

function kickoffRun(): KickoffRun {
  return runAntiHuddleMatch({
    scenario: loadScenario(KICKOFF_MATCH),
    maxTicks: TICKS,
    cpuAntiHuddle: true,
  });
}

let result: KickoffRun;
let replay: KickoffRun;

beforeAll(() => {
  result = kickoffRun();
  replay = kickoffRun();
}, RUN_TIMEOUT * 3);

// ---------------------------------------------------------------------------
// 1. A settled ball that is played actually travels
// ---------------------------------------------------------------------------

/** Ticks where a body played the ball while it was at rest on the pitch. */
function settledImpulseTicks(run: KickoffRun): number[] {
  const hits: number[] = [];
  for (let i = 1; i < run.ticks.length; i++) {
    const previous = run.ticks[i - 1];
    const current = run.ticks[i];
    if (previous.ball.regime !== "settled") continue;
    if (!current.eventKinds.some((kind) => TOUCH_KINDS.has(kind))) continue;
    hits.push(current.tick);
  }
  return hits;
}

describe("BALL-SETTLED-MATCH-001: a touch on a settled ball moves the ball", () => {
  it("the kickoff window really does strike a settled ball", () => {
    const ticks = settledImpulseTicks(result);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks[0]).toBe(result.summary.firstTouchTick);
  });

  it("the ball travels after a settled-ball impulse", () => {
    const impulseTick = settledImpulseTicks(result)[0];
    expect(impulseTick).toBeDefined();
    const at = result.ticks.find((tick) => tick.tick === impulseTick - 1);
    expect(at).toBeDefined();
    const window = result.ticks.filter(
      (tick) => tick.tick > impulseTick && tick.tick <= impulseTick + 30,
    );
    expect(window.length).toBeGreaterThan(0);

    let furthest = 0;
    for (const tick of window) {
      furthest = Math.max(
        furthest,
        Math.hypot(tick.ball.x - at!.ball.x, tick.ball.y - at!.ball.y),
      );
    }
    // Discriminating: with the settled branch reverted to no-physics this is 0.
    expect(furthest).toBeGreaterThan(0.1);
  });

  it("the kickoff match opens instead of dead-balling on the centre spot", () => {
    expect(result.summary.firstTouchTick).not.toBeNull();
    expect(result.summary.touchEvents.length).toBeGreaterThan(0);
    expect(result.summary.passEvents.length).toBeGreaterThan(0);
    // The defect signature was travel-free touches: both measures must be live.
    expect(result.summary.ballTravelMetres).toBeGreaterThan(1);
    expect(result.summary.ballDisplacementMetres).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// 2. The accepted pitch-contact flood stays closed
// ---------------------------------------------------------------------------

describe("BALL-SETTLED-MATCH-002: the pitch-contact flood stays closed", () => {
  const contacts = () => result.events.filter((event) => event.kind === "pitch-contact");

  it("the run stays inside the pitch-contact per-100-ticks bound", () => {
    const per100 = (contacts().length / result.totalTicks) * 100;
    expect(per100).toBeLessThanOrEqual(PITCH_CONTACTS_PER_100_TICKS_LIMIT);
  });

  it("no single tick carries more than one pitch contact", () => {
    const perTick = new Map<number, number>();
    for (const event of contacts()) {
      perTick.set(event.tick, (perTick.get(event.tick) ?? 0) + 1);
    }
    for (const [tick, count] of perTick) {
      expect(count, `tick ${tick}`).toBeLessThanOrEqual(1);
    }
  });

  it("consecutive contacts are separated by more than one tick", () => {
    const ticks = [...new Set(contacts().map((event) => event.tick))].sort(
      (a, b) => a - b,
    );
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBeGreaterThan(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. The ball is never teleported, and never frozen while it carries speed
// ---------------------------------------------------------------------------

describe("BALL-SETTLED-MATCH-003: integration only, no teleport", () => {
  it("every per-tick ball step stays inside the integration bound", () => {
    for (let i = 1; i < result.ticks.length; i++) {
      const a = result.ticks[i - 1].ball;
      const b = result.ticks[i].ball;
      const step = Math.hypot(b.x - a.x, b.y - a.y);
      expect(step, `tick ${result.ticks[i].tick}`).toBeLessThan(MAX_BALL_TICK_STEP_METRES);
    }
  });

  it("the ball does not keep a real speed without moving", () => {
    let frozenWithSpeed = 0;
    for (const tick of result.ticks) {
      const speed = Math.hypot(tick.ball.vx, tick.ball.vy);
      if (speed > 0.05 && (tick.ballTravelledMetres ?? 0) === 0) frozenWithSpeed++;
    }
    // The accepted defect signature was velocity with zero displacement; one
    // tick of slack covers the tick the impulse is applied on.
    expect(frozenWithSpeed).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Determinism
// ---------------------------------------------------------------------------

describe("BALL-SETTLED-MATCH-004: same seed, byte-identical hash chain", () => {
  it("two identical runs produce identical per-tick hashes", () => {
    expect(replay.stateHashes.length).toBe(result.stateHashes.length);
    expect(replay.stateHashes).toEqual(result.stateHashes);
    expect(replay.summary).toEqual(result.summary);
  }, RUN_TIMEOUT);

  it("the chain is non-vacuous: the moving ball produces distinct hashes", () => {
    const unique = new Set(result.stateHashes);
    expect(unique.size).toBeGreaterThan(result.stateHashes.length * 0.9);
  });
});
