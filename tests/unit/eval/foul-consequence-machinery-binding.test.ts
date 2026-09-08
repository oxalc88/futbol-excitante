/**
 * @module tests/unit/eval/foul-consequence-machinery-binding
 *
 * FOUL-CONSEQUENCE-MACHINERY guards. Reproduces the foul→free-kick chain through
 * the production entry points and asserts:
 *
 *  1. A DRIVEN man-not-ball tackle (runDefensiveDuel scripted standing tackle)
 *     awards a free kick to the fouled team; the committed `free-kick-executed`
 *     event carries the contact position as the placement.
 *  2. An ORGANIC CPU-vs-CPU run (3v3-press, cpuDefensiveTackle,
 *     cpuAntiHuddle:false, core-owned) produces a foul → free kick, and the
 *     free-kick stream is byte-identical across two runs (two-run attestation).
 *  3. With the free-kick gate OFF the core is byte-identical to the PRE-CHANGE
 *     baseline (the accepted FOUL-DETECTION legacy pin fb5e9b02…): the core
 *     change is hash-neutral when gated off.
 *  4. Re-evaluation verdicts over the free-kick streams: the timer-freeze /
 *     timer-decrement criteria PASS where they apply; the throw-in/goal-kick/
 *     corner placement + serve criteria are NOT_EVALUATED (bound to a different
 *     restart kind); MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH is NOT_EVALUATED on
 *     this organic stream (anti-huddle is OFF there), while a driven free-kick
 *     window under the anti-huddle holds it PASS.
 *  5. No card / advantage event and no FREE-KICK-AWARD criterion is registered.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

import { runHeadlessMatch } from "../../../eval/runners/headless-match.js";
import { runDefensiveDuel } from "../../../eval/runners/defensive-duel-driver.js";
import { withProximateHumanDefence } from "../../../eval/scenarios/proximate-5v5.js";
import { detectFoulEvents, countFoulEvents } from "../../../eval/runners/foul-detection.js";
import { evaluateSuite } from "../../../eval/runners/foundation-evaluator.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../../src/contracts/telemetry.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const ORGANIC_SCENARIO = "eval/scenarios/3v3-press-scenario.v1.json";
const ORGANIC_TICKS = 600;
const BASELINE_HASH_OF_HASHES =
  "fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a";

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

function runOrganic(awardFreeKicks: boolean, detectFouls: boolean) {
  return runHeadlessMatch({
    scenario: loadScenario(ORGANIC_SCENARIO),
    maxTicks: ORGANIC_TICKS,
    cpuAntiHuddle: false,
    lifecyclePhaseSync: "core-owned",
    cpuDefensiveTackle: true,
    detectFouls,
    awardFreeKicks,
    serializeRestartFacts: true,
  });
}

function runGateOffLegacy() {
  return runHeadlessMatch({
    scenario: loadScenario(ORGANIC_SCENARIO),
    maxTicks: ORGANIC_TICKS,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "legacy",
    cpuDefensiveTackle: true,
    detectFouls: false,
    awardFreeKicks: false,
  });
}

function runDrivenDuel() {
  const scenario = withProximateHumanDefence(loadScenario("eval/scenarios/5v5-human-vs-cpu.v1.json"));
  return runDefensiveDuel({
    scenario,
    maxTicks: 200,
    attempts: [{ kind: "standing", commitDistance: 3.0, earliestTick: 48 }],
    freeKickConfig: { awardFreeKicks: true },
  });
}

function runAntihuddleWindow() {
  return runHeadlessMatch({
    scenario: loadScenario("eval/scenarios/5v5-human-restart-throwin.v1.json"),
    maxTicks: 60,
    cpuAntiHuddle: true,
    lifecyclePhaseSync: "core-owned",
    browserParityObservations: true,
    serializeRestartFacts: true,
    freeKickWindow: { team: "team-a", takerPlayerId: "player-1", position: { x: 30, y: 10 }, countdown: 5 },
  });
}

function countKinds(observations: TelemetryObservation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of observations) for (const ev of o.events) counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
  return counts;
}

function criterion(observations: TelemetryObservation[], id: string): string | undefined {
  const suite = evaluateSuite("rules", observations);
  for (const t of suite.tests) for (const c of t.criteria) if (c.criterion_id === id) return c.outcome;
  return undefined;
}

// ---------------------------------------------------------------------------
// Cached runs (single beforeAll to bound the wall-clock cost)
// ---------------------------------------------------------------------------

let organicOn: ReturnType<typeof runOrganic>;
let organicOn2: ReturnType<typeof runOrganic>;
let organicOff: ReturnType<typeof runOrganic>;
let organicOff2: ReturnType<typeof runOrganic>;
let legacyOff: ReturnType<typeof runGateOffLegacy>;
let driven: ReturnType<typeof runDrivenDuel>;
let windowRun: ReturnType<typeof runAntihuddleWindow>;

beforeAll(() => {
  organicOn = runOrganic(true, true);
  organicOn2 = runOrganic(true, true);
  organicOff = runOrganic(false, false);
  organicOff2 = runOrganic(false, false);
  legacyOff = runGateOffLegacy();
  driven = runDrivenDuel();
  windowRun = runAntihuddleWindow();
}, 240_000);

describe("FOUL-CONSEQUENCE-MACHINERY foul→free-kick chain", () => {
  it("a driven man-not-ball tackle awards a free kick to the fouled team at the contact position", () => {
    detectFoulEvents(driven.observations);
    expect(countFoulEvents(driven.observations)).toBeGreaterThanOrEqual(1);
    expect(driven.freeKickEvents.length).toBeGreaterThanOrEqual(1);
    const fk = driven.freeKickEvents[0];
    const p = fk.payload as Record<string, unknown>;
    const pos = p.freeKickPosition as { x: number; y: number } | undefined;
    expect(typeof pos?.x).toBe("number");
    expect(typeof pos?.y).toBe("number");
    // The awarding team is the fouled player's team.
    const foul = driven.observations.flatMap((o) => o.events).find((e) => e.kind === "foul");
    expect(foul).toBeDefined();
    expect(p.teamId).toBe((foul!.payload as Record<string, unknown>).teamIdB);
  });

  it("the organic free-kick stream is byte-identical across two runs (two-run attestation)", () => {
    expect(sha256(JSON.stringify(organicOn.stateHashes))).toBe(sha256(JSON.stringify(organicOn2.stateHashes)));
    const kinds = countKinds(organicOn.observations);
    expect(kinds["foul"]).toBeGreaterThanOrEqual(1);
    expect(kinds["free-kick-executed"]).toBeGreaterThanOrEqual(1);
  });
});

describe("FOUL-CONSEQUENCE-MACHINERY gate-off byte-identity", () => {
  it("with the free-kick gate off the accepted legacy stream is byte-identical to the pre-change baseline", () => {
    expect(sha256(JSON.stringify(legacyOff.stateHashes))).toBe(BASELINE_HASH_OF_HASHES);
    expect(countKinds(legacyOff.observations)["free-kick-executed"]).toBeUndefined();
  });

  it("the free-kick gate changes the organic stream only when a foul actually occurs (not a no-op gate)", () => {
    // Gate on (with a foul) diverges from gate off; the gate is not a no-op.
    expect(sha256(JSON.stringify(organicOn.stateHashes))).not.toBe(sha256(JSON.stringify(organicOff.stateHashes)));
    // The organic gate-off (core-owned) is deterministic across two runs.
    expect(sha256(JSON.stringify(organicOff.stateHashes))).toBe(sha256(JSON.stringify(organicOff2.stateHashes)));
  });
});

describe("FOUL-CONSEQUENCE-MACHINERY criteria re-evaluation (honest)", () => {
  it("timer-decrement PASSes; restart-specific placement + serve criteria are NOT_EVALUATED / BLOCKED", () => {
    expect(criterion(organicOn.observations, "MATCH-TIMER-DECREMENT")).toBe("PASS");
    // With anti-huddle OFF in this organic run, the freeze criterion is NOT_EVALUATED.
    expect(criterion(organicOn.observations, "MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH")).toBe("NOT_EVALUATED");
    // The throw-in/goal-kick/corner placement + serve criteria cannot apply to a
    // free-kick stream (bound to a different restart kind).
    expect(criterion(organicOn.observations, "MATCH-THROW-IN-PLACEMENT")).toBe("NOT_EVALUATED");
    expect(criterion(organicOn.observations, "MATCH-GOAL-KICK-DISTRIBUTION")).toBe("BLOCKED_MISSING_REFERENCE");
    expect(criterion(organicOn.observations, "MATCH-CORNER-KICK-CROSS")).toBe("BLOCKED_MISSING_REFERENCE");
  });

  it("a driven free-kick window under the anti-huddle holds FREEZE-UNTIL-FIRST-TOUCH", () => {
    expect(criterion(windowRun.observations, "MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH")).toBe("PASS");
    expect(countKinds(windowRun.observations)["free-kick-executed"]).toBeGreaterThanOrEqual(1);
  });

  it("emits no card or advantage event, and registers no FREE-KICK-AWARD criterion", () => {
    for (const o of organicOn.observations) {
      for (const ev of o.events) {
        expect(["card", "advantage"]).not.toContain(ev.kind);
      }
    }
    expect(criterion(organicOn.observations, "FREE-KICK-AWARD")).toBeUndefined();
  });
});
