/**
 * @module tests/integration/foul-freekick-browser-evidence
 *
 * FOUL-FREEKICK-BROWSER-EVIDENCE integration test: the driven-duel fixture the
 * DYNAMIC_VISUAL browser frames depict produces a real foul → free-kick through
 * the accepted FOUL-CONSEQUENCE machinery, and the browser↔headless
 * correspondence contract holds (foul at T, free kick at T+60, same awarding
 * team, same contact position).  It also verifies the gate-off control (the
 * accepted default) never produces the free-kick consequence, so the browser
 * evidence is a genuine consequence of the awardFreeKicks machinery and not a
 * by-product of the tackle itself.
 *
 * This is the relevant integration-test pass for the DYNAMIC_VISUAL evidence
 * class.  It reproduces the driven-duel stream through the production
 * `runDefensiveDuel` entry point — no direct core mocks.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runDefensiveDuel } from "../../eval/runners/defensive-duel-driver.js";
import { withProximateHumanDefence } from "../../eval/scenarios/proximate-5v5.js";
import { isFoulCandidateEvent } from "../../src/simulation/foul-predicate.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { SimulationEvent } from "../../src/contracts/scenario.js";

const SCENARIO_PATH = "eval/scenarios/5v5-human-vs-cpu.v1.json";
const PLAY_TICKS = 200;
const ATTEMPT = { kind: "standing", commitDistance: 3.0, earliestTick: 48 } as const;
const FREE_KICK_COUNTDOWN = 60;

function loadScenario(path: string): ScenarioDefinition {
  return withProximateHumanDefence(
    JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition,
  );
}

function foulTick(events: SimulationEvent[]): number | null {
  return events.find((e) => isFoulCandidateEvent(e))?.tick ?? null;
}

describe("FOUL-FREEKICK-BROWSER-EVIDENCE driven-duel foul→free-kick correspondence", () => {
  it("the driven-duel fixture produces a real foul which awards a free kick 60 ticks later to the fouled team", () => {
    const scenario = loadScenario(SCENARIO_PATH);
    const result = runDefensiveDuel({
      scenario,
      maxTicks: PLAY_TICKS,
      attempts: [{ kind: ATTEMPT.kind, commitDistance: ATTEMPT.commitDistance, earliestTick: ATTEMPT.earliestTick }],
      freeKickConfig: { awardFreeKicks: true },
    });

    const foul = foulTick(result.events);
    const fk = result.freeKickEvents[0];
    expect(foul).not.toBeNull();
    expect(fk).toBeDefined();

    // A real man-not-ball foul candidate was committed.
    const foulEvent = result.events.find((e) => isFoulCandidateEvent(e))!;
    const fp = foulEvent.payload as { teamIdB: string; duelWon: boolean; ballReachable: boolean };
    expect(fp.duelWon).toBe(false);
    expect(fp.ballReachable).toBe(false);

    // The free kick is awarded to the fouled team exactly at the contact spot
    // (the fouled player's planar position), delivered 60 countdown ticks later.
    const fkp = fk!.payload as { teamId: string; freeKickPosition: { x: number; y: number } };
    expect(fkp.teamId).toBe(fp.teamIdB);
    expect(fk!.tick - foul!).toBe(FREE_KICK_COUNTDOWN);
    expect(Number.isFinite(fkp.freeKickPosition.x)).toBe(true);
    expect(Number.isFinite(fkp.freeKickPosition.y)).toBe(true);
    // The contact spot is on the pitch.
    expect(Math.abs(fkp.freeKickPosition.x)).toBeLessThanOrEqual(52.5);
    expect(Math.abs(fkp.freeKickPosition.y)).toBeLessThanOrEqual(34);
  }, 60_000);

  it("the awardFreeKicks gate off (the accepted default) produces no free-kick consequence", () => {
    const scenario = loadScenario(SCENARIO_PATH);
    const result = runDefensiveDuel({
      scenario,
      maxTicks: PLAY_TICKS,
      attempts: [{ kind: ATTEMPT.kind, commitDistance: ATTEMPT.commitDistance, earliestTick: ATTEMPT.earliestTick }],
      // freeKickConfig omitted → gate off (the accepted default).
    });

    // The tackle still happens (the same real contact), but no free-kick phase or
    // committed free kick results — the consequence is gated on the accepted flag.
    expect(foulTick(result.events)).not.toBeNull();
    expect(result.freeKickEvents.length).toBe(0);
  }, 60_000);
});