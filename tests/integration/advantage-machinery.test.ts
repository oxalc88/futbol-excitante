/**
 * @module tests/integration/advantage-machinery
 *
 * ADVANTAGE-MACHINERY integration test: through the production
 * `runHeadlessMatch` entry point (core-owned lifecycle, cpuDefensiveTackle,
 * detectFouls, awardFreeKicks, issueCards, playAdvantage, serializeRestartFacts)
 * a real committed man-not-ball foul opens the §6.2 advantage window; the fouled
 * team keeps the ball, so the window runs to expiry at exactly
 * `advantage_window_ticks` and the foul is called at the CLOSE tick, where the
 * accepted free-kick restart opens (its CPU auto-serve lands one accepted
 * countdown later). A second driven shape ends the first half inside an open
 * window, so the §6.3 "new stoppage" cancellation is exercised in-core. No
 * direct core mocks.
 *
 * This is the relevant integration-test pass for the MULTI_TICK evidence class.
 * The gate-off legacy shape reproduces the pre-change baseline hash-of-hashes
 * byte-for-byte (the accepted FOUL-DETECTION-MACHINERY pin).
 *
 * The judged-retained path (§6.2a) is NOT exercised: `advantage_retention_ref`
 * is BLOCKED_MISSING_REFERENCE (spec §11) and no advantage is ever played.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

import { runHeadlessMatch } from "../../eval/runners/headless-match.js";
import type { HeadlessMatchResult } from "../../eval/runners/headless-match.js";
import type { ScenarioDefinition, SimulationEvent } from "../../src/contracts/scenario.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";

const ORGANIC_SCENARIO = "eval/scenarios/3v3-press-scenario.v1.json";
const ORGANIC_TICKS = 600;
const BASELINE_HASH_OF_HASHES =
  "fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a";
/** The accepted in-core free-kick countdown (`defaultFreeKickCountdown`). */
const FREE_KICK_COUNTDOWN = 60;
/**
 * A first-half length that ends INSIDE the organic window opened at tick 233
 * (the organic foul tick is independent of the match length): the half ends at
 * 240, the phase leaves `playing` and the §6.3 "new stoppage" cancels the
 * window on the following tick.
 */
const SHORT_HALF_MATCH_DURATION_TICKS = 240;
const SHORT_HALF_TICKS = 260;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

function runOrganic(playAdvantage: boolean, maxTicks: number = ORGANIC_TICKS, matchDurationTicks?: number) {
  const scenario = loadScenario(ORGANIC_SCENARIO);
  return runHeadlessMatch({
    scenario: matchDurationTicks === undefined ? scenario : { ...scenario, matchDurationTicks },
    maxTicks,
    cpuAntiHuddle: false,
    lifecyclePhaseSync: "core-owned",
    cpuDefensiveTackle: true,
    detectFouls: true,
    awardFreeKicks: true,
    issueCards: true,
    playAdvantage,
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

function advantageEvents(observations: TelemetryObservation[], kind: string): SimulationEvent[] {
  const out: SimulationEvent[] = [];
  for (const o of observations) for (const ev of o.events) if (ev.kind === kind) out.push(ev);
  return out;
}

function kinds(observations: TelemetryObservation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of observations) for (const ev of o.events) counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
  return counts;
}

// ---------------------------------------------------------------------------
// Cached runs — one bounded hook per group so no single synchronous block
// starves the vitest worker RPC.
// ---------------------------------------------------------------------------

let on1: HeadlessMatchResult;
let on2: HeadlessMatchResult;
let off: HeadlessMatchResult;
let off2: HeadlessMatchResult;
let legacyOff: HeadlessMatchResult;
let stoppage: HeadlessMatchResult;

describe("ADVANTAGE-MACHINERY organic window (foul → open → expiry → close-tick call)", () => {
  beforeAll(() => {
    on1 = runOrganic(true);
    on2 = runOrganic(true);
  }, 300_000);

  it("opens on the committed foul tick and expires exactly advantage_window_ticks later", () => {
    const opened = advantageEvents(on1.observations, "advantage-opened");
    const expired = advantageEvents(on1.observations, "advantage-expired");
    expect(opened).toHaveLength(1);
    expect(expired).toHaveLength(1);

    const openPayload = (opened[0].payload ?? {}) as Record<string, unknown>;
    const closePayload = (expired[0].payload ?? {}) as Record<string, unknown>;
    expect(opened[0].tick).toBe(233);
    expect(expired[0].tick).toBe(257);
    expect(openPayload.openTick).toBe(233);
    expect(closePayload.openTick).toBe(233);
    expect(closePayload.closeTick).toBe(257);
    // Expiry is exactly the 24-tick budget (a changed window length moves this).
    expect((closePayload.closeTick as number) - (closePayload.openTick as number)).toBe(24);
    expect(closePayload.windowTicks).toBe(24);
    expect(closePayload.reason).toBe("expired");
    // Continued fouled-team possession does NOT cancel: the window ran out.
    expect(closePayload.pendingFoulCount).toBe(1);

    // The recognized foul that opened it is the same committed §5.1 contact.
    const fouls = advantageEvents(on1.observations, "foul");
    expect(fouls).toHaveLength(1);
    expect(fouls[0].tick).toBe(233);
    expect(openPayload.foulSourceEventId).toBeTruthy();
  });

  it("calls the foul at the CLOSE tick: the free kick is served one countdown later, not one countdown after the foul tick", () => {
    const freeKickTicks = advantageEvents(on1.observations, "free-kick-executed").map((e) => e.tick);
    expect(freeKickTicks).toHaveLength(1);
    expect(freeKickTicks[0]).toBe(257 + FREE_KICK_COUNTDOWN);
    // A mutant that applied the consequence at the foul tick would serve at 293.
    expect(freeKickTicks).not.toContain(233 + FREE_KICK_COUNTDOWN);
    // The restart's awarding team is the fouled team of the opened window.
    const opened = advantageEvents(on1.observations, "advantage-opened");
    const openPayload = (opened[0].payload ?? {}) as Record<string, unknown>;
    const fkPayload = (advantageEvents(on1.observations, "free-kick-executed")[0].payload ?? {}) as Record<string, unknown>;
    expect(fkPayload.teamId).toBe(openPayload.fouledTeam);
  });

  it("emits no judged-retained decision and no invented retention envelope", () => {
    for (const kind of ["advantage-opened", "advantage-cancelled", "advantage-expired"]) {
      for (const ev of advantageEvents(on1.observations, kind)) {
        const p = (ev.payload ?? {}) as Record<string, unknown>;
        expect(JSON.stringify(p)).not.toContain("retain");
        const reason = p.reason;
        expect(
          reason === undefined ||
            reason === "expired" ||
            reason === "cancelled-last-touch-loss" ||
            reason === "cancelled-stoppage",
        ).toBe(true);
      }
    }
  });

  it("the organic advantage stream is byte-identical across two runs (two-run attestation)", () => {
    expect(sha256(JSON.stringify(on1.stateHashes))).toBe(sha256(JSON.stringify(on2.stateHashes)));
    expect(kinds(on1.observations)["advantage-opened"]).toBe(kinds(on2.observations)["advantage-opened"]);
    expect(kinds(on1.observations)["advantage-expired"]).toBe(kinds(on2.observations)["advantage-expired"]);
  });
});

describe("ADVANTAGE-MACHINERY gate-off control (not a no-op)", () => {
  beforeAll(() => {
    off = runOrganic(false);
    off2 = runOrganic(false);
  }, 300_000);

  it("the gate is not a no-op and the gate-off organic stream emits no advantage event", () => {
    expect(sha256(JSON.stringify(on1.stateHashes))).not.toBe(sha256(JSON.stringify(off.stateHashes)));
    expect(kinds(off.observations)["advantage-opened"]).toBeUndefined();
    expect(kinds(off.observations)["advantage-cancelled"]).toBeUndefined();
    expect(kinds(off.observations)["advantage-expired"]).toBeUndefined();
    // Two-run determinism of the gate-off advantage shape.
    expect(sha256(JSON.stringify(off.stateHashes))).toBe(sha256(JSON.stringify(off2.stateHashes)));
  });
});

describe("ADVANTAGE-MACHINERY gate-off byte-identity to the pre-change pin", () => {
  beforeAll(() => {
    legacyOff = runGateOffLegacy();
  }, 300_000);

  it("with the advantage gate off the accepted legacy stream reproduces the pre-change baseline byte-for-byte", () => {
    expect(sha256(JSON.stringify(legacyOff.stateHashes))).toBe(BASELINE_HASH_OF_HASHES);
    expect(kinds(legacyOff.observations)["advantage-opened"]).toBeUndefined();
  });
});

describe("ADVANTAGE-MACHINERY stoppage cancellation (§6.3 new stoppage)", () => {
  beforeAll(() => {
    stoppage = runOrganic(true, SHORT_HALF_TICKS, SHORT_HALF_MATCH_DURATION_TICKS);
  }, 300_000);

  it("the half ending inside the open window cancels it before expiry and the pending advantage does not survive the stoppage", () => {
    const opened = advantageEvents(stoppage.observations, "advantage-opened");
    const cancelled = advantageEvents(stoppage.observations, "advantage-cancelled");
    expect(opened).toHaveLength(1);
    expect(cancelled).toHaveLength(1);
    expect(opened[0].tick).toBe(233);

    const close = (cancelled[0].payload ?? {}) as Record<string, unknown>;
    expect(close.reason).toBe("cancelled-stoppage");
    expect(close.openTick).toBe(233);
    expect(close.closeTick).toBe(242);
    // Not an expiry: the window closed early, well inside the 24-tick budget.
    expect((close.closeTick as number) - (close.openTick as number)).toBe(9);
    expect(close.pendingFoulCount).toBe(1);

    // The phase left `playing` (the first half ended) before the window closed.
    const halftime = advantageEvents(stoppage.observations, "core-match-phase").find(
      (e) => ((e.payload ?? {}) as Record<string, unknown>).matchPhase === "halftime",
    );
    expect(halftime).toBeDefined();
    expect(halftime!.tick).toBeLessThan(242);

    // §6.3: the pending advantage does not survive into the restart window, so
    // the cancelled window's free-kick consequence cannot open a restart — and
    // with a single recognized foul the §7 accumulation is below the caution
    // threshold, so no card is issued either (the consequence *deferral* itself
    // is asserted on the driven streams).
    expect(advantageEvents(stoppage.observations, "free-kick-executed")).toHaveLength(0);
    expect(advantageEvents(stoppage.observations, "card-issued")).toHaveLength(0);
    expect(advantageEvents(stoppage.observations, "foul").map((e) => e.tick)).toEqual([233]);
  });
});
