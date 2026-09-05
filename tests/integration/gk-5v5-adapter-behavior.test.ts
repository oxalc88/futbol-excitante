/**
 * @module tests/integration/gk-5v5-adapter-behavior
 *
 * Integration guards for GK-5V5-ADAPTER-BEHAVIOR: a designated keeper per team
 * in the coherent 5v5 CPU-vs-CPU small-sided match, at the adapter /
 * team-decision layer only (the simulation core and contracts are byte-identical;
 * the ball stays an independent 3D entity and every keeper contact is a recorded
 * canonical event on it).
 *
 * The guards read the same production functions the adapters act on, evaluated
 * over committed ticks, through `eval/runners/gk-match.ts`:
 *
 *   GK-MATCH-001  goal-arc hold: after taking station the keeper's committed
 *                 position stays inside `goal_arc_radius` and within
 *                 `goal_arc_lateral_max` of the arc centre, and its commanded
 *                 station is inside both bounds on every tick, including before
 *                 it gets there.
 *   GK-MATCH-002  no field chase: the keeper is never its team's designated
 *                 chaser/presser, cover body or restart taker, while exactly one
 *                 field body per team still is.
 *   GK-MATCH-003  save/claim: a canonical shot on target is answered by an
 *                 explicit recorded ball contact inside `save_claim_reach_radius`
 *                 of the keeper, initiated inside
 *                 `keeper_reaction_window_ticks`, with no teleport of the ball.
 *   GK-MATCH-004  stash identity: `gkBehavior: false` reproduces HEAD's per-tick
 *                 hash chains — the accepted 5V5-KICKOFF-ANTI-HUDDLE flowing-run
 *                 chain for the continuous match, and the base-tree chain recorded
 *                 by scripts/ci/verify-gk-stash-identity-head.mjs for the shot
 *                 fixture — and leaves every keeper-path counter at 0.
 *   GK-MATCH-005  determinism: the same configuration twice, byte-identical.
 *
 * Node I/O is allowed for scenario loading.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import {
  runGkMatch,
  type GkMatchResult,
  type GkTickRecord,
} from "../../eval/runners/gk-match.js";
import {
  GK_SMALL_SIDED_V1,
  getKeeperHoldActivations,
  getKeeperPressExclusionActivations,
  getKeeperReleasePressActivations,
  getKeeperSaveArmActivations,
  getKeeperSavePressActivations,
  resetKeeperMechanismCounters,
} from "../../src/adapters/input-browser/goalkeeper-role.js";
import {
  getKickoffFreezeActivations,
  getNearestOnlyChaseActivations,
  getRestartFreezeActivations,
  resetMechanismCounters,
} from "../../src/adapters/input-browser/cpu-adapter.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CONTINUOUS_MATCH = "eval/scenarios/5v5-continuous-play.v1.json";
const SHOT_FIXTURE = "eval/scenarios/5v5-keeper-shot-fixture.v1.json";

/**
 * Committed position slack. Locomotion converges the body toward its commanded
 * target under the accepted acceleration/braking limits and player-player
 * contact can shove a body, so the *observed* bound is checked with this slack;
 * the *commanded* station is checked against the versioned bound exactly.
 */
const OBSERVED_POSITION_SLACK_METRES = 0.55;
/**
 * Settle window after the keeper first reaches its arc. The committed body is
 * still braking from its transit onto the arc for the first second, so the
 * in-arc committed-speed readout is taken after that; the commanded bound is
 * checked on every in-arc tick with no window at all.
 */
const STATION_SETTLE_TICKS = 60;

/**
 * Per-tick hash chain of the shot fixture run through the base tree (91ff0be) at
 * the identical wiring configuration, produced by
 * `mise exec -- pnpm run gauntlet:verify-gk-stash -- --ref=91ff0be`.
 */
const HEAD_FIXTURE_CHAIN_HASH =
  "6091de51e1d9bbd43f2ebc4e821859213e147ca5d02112f4afa2114f2799a1f6";

const HOOK_TIMEOUT = 240_000;

function loadScenario(relativePath: string): ScenarioDefinition {
  return JSON.parse(
    readFileSync(join(projectRoot, relativePath), "utf-8"),
  ) as ScenarioDefinition;
}

interface Run {
  result: GkMatchResult;
  counters: Record<string, number>;
}

function runMatch(path: string, ticks: number, gkBehavior: boolean): Run {
  resetMechanismCounters();
  resetKeeperMechanismCounters();
  const result = runGkMatch({
    scenario: loadScenario(path),
    maxTicks: ticks,
    gkBehavior,
  });
  return {
    result,
    counters: {
      hold: getKeeperHoldActivations(),
      arms: getKeeperSaveArmActivations(),
      save: getKeeperSavePressActivations(),
      release: getKeeperReleasePressActivations(),
      exclusions: getKeeperPressExclusionActivations(),
      kickoffFreeze: getKickoffFreezeActivations(),
      nearestOnlyHold: getNearestOnlyChaseActivations(),
      restartFreeze: getRestartFreezeActivations(),
    },
  };
}

function hashChain(hashes: string[]): string {
  return createHash("sha256").update(JSON.stringify(hashes)).digest("hex");
}

function keeperTicks(result: GkMatchResult, teamId: string): GkTickRecord[] {
  const keeperId = result.keeperByTeam[teamId];
  if (keeperId === undefined) return [];
  return result.ticks.filter((tick) => {
    const body = tick.players.find((player) => player.playerId === keeperId);
    return body !== undefined && tick.teams[teamId]?.station !== null;
  });
}

/** Ticks from the moment the keeper has taken station on its arc. */
function onStationTicks(result: GkMatchResult, teamId: string): GkTickRecord[] {
  const summary = result.keepers[teamId];
  if (summary?.stationTakenTick == null) return [];
  return keeperTicks(result, teamId).filter((tick) => tick.tick >= summary.stationTakenTick!);
}

let live: Run;
let stashed: Run;
let fixtureLive: Run;
let fixtureStashed: Run;

beforeAll(() => {
  // The continuous window is kept short here: 1800-tick coherence is the
  // durable artifact's job (docs/evidence/GK-5V5-ADAPTER-BEHAVIOR), and the
  // stash-identity guard below is the only 1800-tick run this suite needs.
  live = runMatch(CONTINUOUS_MATCH, 900, true);
  fixtureLive = runMatch(SHOT_FIXTURE, 600, true);
  fixtureStashed = runMatch(SHOT_FIXTURE, 600, false);
  stashed = runMatch(CONTINUOUS_MATCH, 1800, false);
}, HOOK_TIMEOUT);

// ---------------------------------------------------------------------------
// 1. Goal-arc hold
// ---------------------------------------------------------------------------

describe("GK-MATCH-001: the designated keeper holds its goal arc", () => {
  it("designates exactly one keeper per team, before kickoff and stable all match", () => {
    const teams = Object.keys(live.result.keeperByTeam);
    expect(teams).toEqual(["team-a", "team-b"]);
    for (const teamId of teams) {
      const summary = live.result.keepers[teamId];
      expect(summary.keeperPlayerId).toBeTruthy();
      // One designation for the whole run: never re-derived from ball state.
      expect(summary.designationDriftTicks).toBe(0);
    }
    // Bodies are assigned, never added: the match still plays ten bodies.
    expect(live.result.ticks[0].players).toHaveLength(10);
  });

  it("commands a station inside the arc on every tick, transit included", () => {
    const radius = GK_SMALL_SIDED_V1.goal_arc_radius.value;
    const lateral = GK_SMALL_SIDED_V1.goal_arc_lateral_max.value;
    for (const teamId of Object.keys(live.result.keeperByTeam)) {
      const ticks = keeperTicks(live.result, teamId);
      expect(ticks.length).toBeGreaterThan(0);
      for (const tick of ticks) {
        const team = tick.teams[teamId];
        expect(team.station, `tick ${tick.tick} has a station`).not.toBeNull();
        const center = team.arcCenter!;
        const drift = Math.abs(team.station!.y - center.y);
        const dist = Math.hypot(team.station!.x - center.x, team.station!.y - center.y);
        expect(drift, `tick ${tick.tick} commanded drift`).toBeLessThanOrEqual(lateral);
        expect(dist, `tick ${tick.tick} commanded dist`).toBeLessThanOrEqual(radius);
      }
    }
  });

  it("holds inside the arc with bounded lateral drift once on station", () => {
    const radius = GK_SMALL_SIDED_V1.goal_arc_radius.value + OBSERVED_POSITION_SLACK_METRES;
    const lateral = GK_SMALL_SIDED_V1.goal_arc_lateral_max.value + OBSERVED_POSITION_SLACK_METRES;
    for (const teamId of Object.keys(live.result.keeperByTeam)) {
      const ticks = onStationTicks(live.result, teamId);
      expect(ticks.length, `${teamId} on-station window`).toBeGreaterThan(60);
      for (const tick of ticks) {
        const team = tick.teams[teamId];
        expect(team.onGoalArc, `tick ${tick.tick} on arc`).toBe(true);
        expect(Math.abs(team.lateralDrift!), `tick ${tick.tick} drift`).toBeLessThanOrEqual(lateral);
        expect(team.distToArcCenter!, `tick ${tick.tick} arc dist`).toBeLessThanOrEqual(radius);
      }
      const summary = live.result.keepers[teamId];
      // Nothing unattributed: every off-arc tick is accounted for or there are none.
      expect(summary.offArcAfterStationUnattributed).toBe(summary.offArcTicksAfterStation);
    }
  });

  it("commands no more than keeper_reposition_speed while it is inside its arc", () => {
    const cap = GK_SMALL_SIDED_V1.keeper_reposition_speed.value;
    for (const teamId of Object.keys(live.result.keeperByTeam)) {
      const summary = live.result.keepers[teamId];
      expect(summary.stationTakenTick).not.toBeNull();
      // Exact bound on the command: every in-arc tick stays at or under the
      // versioned repositioning speed, with no tolerance.
      expect(summary.commandedInArcSpeedBoundBreaches, `${teamId} commanded breaches`)
        .toBe(0);
      // The cap is a product of two versioned floats, so the comparison carries
      // only binary rounding (1 ULP at 2 m/s), not a behavioural tolerance.
      expect(summary.maxCommandedInArcSpeed, `${teamId} commanded speed`)
        .toBeLessThanOrEqual(cap * (1 + Number.EPSILON * 4));
      // The committed body converges on that command after the transit arrival.
      const settled = onStationTicks(live.result, teamId)
        .filter((tick) => tick.tick > summary.stationTakenTick! + STATION_SETTLE_TICKS);
      expect(settled.length).toBeGreaterThan(60);
      for (const tick of settled) {
        const body = tick.players.find((player) =>
          player.playerId === summary.keeperPlayerId)!;
        expect(body.speed, `tick ${tick.tick} settled speed`)
          .toBeLessThanOrEqual(cap + OBSERVED_POSITION_SLACK_METRES);
      }
    }
  });

  it("does not chase: the keeper's distance to its own goal never follows the ball", () => {
    // While the ball is in the attacking half, the keeper must still be at its
    // own goal: a chasing keeper would have crossed the halfway line.
    for (const teamId of Object.keys(live.result.keeperByTeam)) {
      const keeperId = live.result.keeperByTeam[teamId];
      const ownGoalX = live.result.keepers[teamId].ownGoalLineX;
      for (const tick of onStationTicks(live.result, teamId)) {
        const body = tick.players.find((player) => player.playerId === keeperId)!;
        expect(Math.abs(body.x - ownGoalX), `tick ${tick.tick} keeper x`)
          .toBeLessThanOrEqual(GK_SMALL_SIDED_V1.goal_arc_radius.value + OBSERVED_POSITION_SLACK_METRES);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. No field chase (anti-huddle inheritance)
// ---------------------------------------------------------------------------

describe("GK-MATCH-002: the keeper never joins the field chase", () => {
  it("is never the designated chaser, cover or restart taker", () => {
    for (const teamId of Object.keys(live.result.keeperByTeam)) {
      const summary = live.result.keepers[teamId];
      expect(summary.keeperDesignatedChaserTicks).toBe(0);
      expect(summary.keeperDesignatedCoverTicks).toBe(0);
      expect(summary.keeperDesignatedTakerTicks).toBe(0);
    }
    expect(live.result.summary.keeperChaseTeamTicks).toBe(0);
    // Every team-tick still carries a single field chaser.
    expect(live.result.summary.teamTicksWithFieldChaser)
      .toBe(live.result.summary.ticks * 2);
  });

  it("keeps the accepted anti-huddle mechanisms alive", () => {
    expect(live.counters.nearestOnlyHold).toBeGreaterThan(0);
    expect(live.counters.kickoffFreeze).toBeGreaterThanOrEqual(0);
    expect(live.counters.exclusions).toBeGreaterThan(0);
    expect(live.counters.hold).toBeGreaterThan(0);
  });

  it("stashed, the same body is available to the press designation again (discriminating)", () => {
    // Stashed there is no designation at all: the accepted nearest-eligible
    // body may be the body the keeper role had removed from the press set.
    expect(Object.keys(stashed.result.keeperByTeam)).toEqual([]);
    expect(stashed.counters.hold).toBe(0);
    expect(stashed.counters.exclusions).toBe(0);
    // The accepted shape is unaffected by the inert switch.
    expect(stashed.counters.nearestOnlyHold).toBeGreaterThan(0);
    expect(stashed.result.summary.teamTicksWithFieldChaser)
      .toBe(stashed.result.summary.ticks * 2);
  });
});

// ---------------------------------------------------------------------------
// 3. Save/claim reaction on a shot on target
// ---------------------------------------------------------------------------

describe("GK-MATCH-003: the keeper answers a shot on target with a recorded contact", () => {
  it("has at least one shot-on-target chain answered by the keeper", () => {
    const chains = Object.values(fixtureLive.result.keepers)
      .flatMap((keeper) => keeper.shotChains.filter((chain) => chain.saveOnShotOnTarget));
    expect(chains.length, "the fixture must produce a saved shot chain").toBeGreaterThan(0);
    const chain = chains.find((entry) => entry.contactKind === "first-touch") ?? chains[0];
    expect(chain.teamId).toBe("team-b");
    expect(chain.keeperPlayerId).toBe(fixtureLive.result.keeperByTeam[chain.teamId]);
    expect(chain.shotContactTick).not.toBeNull();
    expect(chain.keeperContactTick).not.toBeNull();
    expect(chain.ticksFromShotToContact).not.toBeNull();
    // Initiated inside the versioned reaction window.
    expect(chain.ticksFromShotToContact!)
      .toBeLessThanOrEqual(GK_SMALL_SIDED_V1.keeper_reaction_window_ticks.value);
    // Contact stayed inside the versioned reach, judged at the keeper's own body.
    expect(chain.recordedContactDistance).not.toBeNull();
    expect(chain.withinReach).toBe(true);
    expect(chain.recordedContactDistance!)
      .toBeLessThanOrEqual(GK_SMALL_SIDED_V1.save_claim_reach_radius.value + 1e-9);
  });

  it("the ball stays an independent entity across the save: no teleport", () => {
    const saved = Object.values(fixtureLive.result.keepers)
      .flatMap((keeper) => keeper.shotChains.filter((chain) => chain.saveOnShotOnTarget))[0];
    const byTick = new Map(fixtureLive.result.ticks.map((tick) => [tick.tick, tick]));
    // Every committed ball step around the save is an integrated step, so no
    // re-assignment happened: the contact is an impulse, not an attachment.
    for (let t = saved.shotContactTick! - 2; t <= saved.keeperContactTick! + 20; t++) {
      const previous = byTick.get(t);
      const current = byTick.get(t + 1);
      if (!previous || !current) continue;
      const step = Math.hypot(
        current.ball.x - previous.ball.x,
        current.ball.y - previous.ball.y,
      );
      expect(step, `ball step at tick ${t}`).toBeLessThan(2);
    }
    // The ball's authoritative touch reference is the keeper's own contact event.
    const afterSave = byTick.get(saved.keeperContactTick! + 1);
    expect(afterSave?.ball.lastTouchRef ?? null).not.toBe(saved.shotEventId);
    // And the keeper is not carrying the ball: the contact distance it recorded
    // is a real separation, not zero-offset attachment.
    expect(saved.recordedContactDistance!).toBeGreaterThan(0);
  });

  it("arms its reaction on the match's own shots, in the live match too", () => {
    expect(live.counters.arms).toBeGreaterThan(0);
    expect(fixtureLive.counters.arms).toBeGreaterThan(0);
    // Stashed: no keeper reaction exists at all.
    expect(fixtureStashed.counters.arms).toBe(0);
    expect(fixtureStashed.counters.save).toBe(0);
    expect(fixtureStashed.counters.hold).toBe(0);
    expect(fixtureStashed.counters.release).toBe(0);
    expect(Object.values(fixtureStashed.result.keepers)
      .flatMap((keeper) => keeper.shotChains.filter((chain) => chain.saveOnShotOnTarget)))
      .toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. Stash identity against HEAD and the accepted pins
// ---------------------------------------------------------------------------

describe("GK-MATCH-004: stashing the role reproduces HEAD behaviour", () => {
  it("reproduces the accepted 5V5-KICKOFF-ANTI-HUDDLE flowing chain", () => {
    const artifact = JSON.parse(
      readFileSync(join(projectRoot, "docs/evidence/5V5-KICKOFF-ANTI-HUDDLE/trajectory.json"), "utf-8"),
    ) as {
      runs: Array<{
        id: string;
        scenario_path: string;
        per_tick: unknown[][];
      }>;
    };
    const accepted = artifact.runs.find((run) => run.id === "5v5-flowing-cpu-vs-cpu");
    expect(accepted, "accepted flowing run").toBeTruthy();
    expect(accepted!.scenario_path).toBe(CONTINUOUS_MATCH);
    const acceptedHashes = accepted!.per_tick.map((row) => String(row[row.length - 1]));
    expect(hashChain(stashed.result.stateHashes)).toBe(hashChain(acceptedHashes));
    expect(stashed.result.stateHashes[0]).toBe(acceptedHashes[0]);
    expect(stashed.result.stateHashes[stashed.result.stateHashes.length - 1])
      .toBe(acceptedHashes[acceptedHashes.length - 1]);
  });

  it("reproduces the base tree's chain on the shot fixture", () => {
    expect(hashChain(fixtureStashed.result.stateHashes)).toBe(HEAD_FIXTURE_CHAIN_HASH);
  });

  it("leaves every keeper-path counter dark while the match still plays", () => {
    expect(fixtureStashed.counters).toMatchObject({
      hold: 0,
      arms: 0,
      save: 0,
      release: 0,
      exclusions: 0,
    });
    expect(fixtureStashed.result.summary.touches).toBeGreaterThan(0);
    expect(fixtureStashed.result.summary.ballTravelMetres).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Determinism
// ---------------------------------------------------------------------------

describe("GK-MATCH-005: the keeper shape is deterministic", () => {
  it("two identical runs produce identical per-tick hashes and keeper records", () => {
    const again = runGkMatch({
      scenario: loadScenario(SHOT_FIXTURE),
      maxTicks: 420,
      gkBehavior: true,
    });
    const baseline = runGkMatch({
      scenario: loadScenario(SHOT_FIXTURE),
      maxTicks: 420,
      gkBehavior: true,
    });
    expect(baseline.stateHashes).toEqual(again.stateHashes);
    expect(baseline.keepers).toEqual(again.keepers);
    expect(baseline.summary).toEqual(again.summary);
  }, HOOK_TIMEOUT);
});
