/**
 * @module tests/unit/loop/card-machinery-sim
 *
 * CARD-MACHINERY direct core tests (FOULS_CARDS_SPEC §7 / §9.1):
 *   - the pure card-policy resolver pins the accumulation thresholds exactly
 *     (2 → caution, 5 → expulsion, every other count → no card; NO second-yellow
 *     → red was invented — the spec defines two independent thresholds);
 *   - with the card gate OFF (default) the WorldState never carries the optional
 *     `bookings` field and no `card-issued` event is emitted;
 *   - with the card gate ON, the accepted defensive-duel driven stream (repeated
 *     scripted standing tackles) accumulates a caution for the offending player
 *     at the 2nd man-not-ball foul, and the card-issued event / booking state
 *     carry the correct offender / card type / accumulated count.
 *
 * Input enters ONLY through sim.applyInputs (tick-indexed InputFrame) / the
 * accepted duel driver; no direct state writes. No Math.random, Date, DOM, or
 * Node I/O in the sim path (Node I/O only for the test's fs read of the fixture).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createWorld } from "../../../src/simulation/world/create.js";
import { createSimulation } from "../../../src/simulation/loop/simulation.js";
import { NO_OP_OBSERVER } from "../../../src/simulation/telemetry/observer.js";
import { runDefensiveDuel } from "../../../eval/runners/defensive-duel-driver.js";
import { withProximateHumanDefence } from "../../../eval/scenarios/proximate-5v5.js";
import { detectFoulEvents } from "../../../eval/runners/foul-detection.js";
import {
  FOULS_YELLOW_ACCUMULATION_COUNT,
  FOULS_RED_ACCUMULATION_COUNT,
  resolveCardForAccumulatedFouls,
} from "../../../src/simulation/card-policy.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";

function loadScenario(path: string = "eval/scenarios/5v5-human-serve-throwin.v1.json"): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

function stepNeutral(sim: ReturnType<typeof createSimulation>, tick: number): void {
  sim.applyInputs([{
    tick,
    sourceId: "cpu",
    controlSlot: "slot-1",
    moveX: 0, moveY: 0, sprint: 0, heldButtons: 0, pressedButtons: 0, releasedButtons: 0,
  }]);
}

function findCardEvents(events: readonly { kind: string; payload?: Record<string, unknown> }[], kind: string) {
  return events.filter((e) => e.kind === kind);
}

describe("CARD-MACHINERY card-policy resolver (thresholds)", () => {
  it("pins the accumulation thresholds exactly: 2 → caution, 5 → expulsion, every other count → no card", () => {
    expect(FOULS_YELLOW_ACCUMULATION_COUNT).toBe(2);
    expect(FOULS_RED_ACCUMULATION_COUNT).toBe(5);
    expect(resolveCardForAccumulatedFouls(1)).toBeNull(); // below the caution threshold
    expect(resolveCardForAccumulatedFouls(2)).toBe("caution");
    expect(resolveCardForAccumulatedFouls(3)).toBeNull(); // 3 is not a threshold identity
    expect(resolveCardForAccumulatedFouls(4)).toBeNull();
    expect(resolveCardForAccumulatedFouls(5)).toBe("expulsion");
    // Beyond the red threshold the spec defines no further card, so no second
    // caution / expulsions are invented.
    expect(resolveCardForAccumulatedFouls(6)).toBeNull();
    expect(resolveCardForAccumulatedFouls(7)).toBeNull();
  });
});

describe("CARD-MACHINERY gate-off default (core)", () => {
  it("leaves the WorldState free of the bookings field and emits no card event", () => {
    const sim = createSimulation(createWorld({ scenario: loadScenario() }), NO_OP_OBSERVER);
    const initial = sim.snapshot();
    expect("bookings" in initial).toBe(false);
    for (let t = 0; t < 5; t++) { stepNeutral(sim, t); sim.step(); }
    expect(findCardEvents(sim.snapshot().events, "card-issued")).toHaveLength(0);
    expect(sim.snapshot().matchPhase).toBe("playing");
  });
});

describe("CARD-MACHINERY in-core consequence (driven)", () => {
  it("accumulates a caution for the offending player at the 2nd man-not-ball foul; below-threshold fouls emit no card", () => {
    const scenario = withProximateHumanDefence(
      loadScenario("eval/scenarios/5v5-human-vs-cpu.v1.json"),
    );
    const attempts: Array<{ kind: "standing"; commitDistance: number; earliestTick: number }> = [];
    for (let t = 44; t <= 100; t += 16) {
      attempts.push({ kind: "standing", commitDistance: 3.0, earliestTick: t });
    }
    const r = runDefensiveDuel({
      scenario,
      maxTicks: 120,
      attempts,
      cardConfig: { issueCards: true },
    });
    detectFoulEvents(r.observations);

    // Two man-not-ball fouls by the same (HUMAN slot) offender.
    expect(r.observations.length).toBeGreaterThan(0);
    // The card is committed to the core's persistent state (the driven shape
    // does not serialize restart facts into observations).
    expect(r.cardEvents).toHaveLength(1);
    const card = r.cardEvents[0];
    const p = (card.payload ?? {}) as Record<string, unknown>;
    expect(p.cardType).toBe("caution");
    expect(p.accumulatedFouls).toBe(2);
    expect(p.playerId).toBe(r.humanPlayerId);
    expect(p.fouledPlayerId).toBeTruthy();
    expect(p.foulSourceEventId).toBeTruthy();

    // Booking state accumulates: 2 fouls → 1 caution, 0 expulsions.
    expect(r.bookingState).toBeDefined();
    const booking = r.bookingState![r.humanPlayerId];
    expect(booking).toBeDefined();
    expect(booking.fouls).toBe(2);
    expect(booking.cautions).toBe(1);
    expect(booking.expulsions).toBe(0);
  });

  it("the card gate off on the same driven shape emits no card and leaves no booking field", () => {
    const scenario = withProximateHumanDefence(
      loadScenario("eval/scenarios/5v5-human-vs-cpu.v1.json"),
    );
    const attempts: Array<{ kind: "standing"; commitDistance: number; earliestTick: number }> = [];
    for (let t = 44; t <= 100; t += 16) {
      attempts.push({ kind: "standing", commitDistance: 3.0, earliestTick: t });
    }
    const r = runDefensiveDuel({ scenario, maxTicks: 120, attempts });
    expect(r.cardEvents).toHaveLength(0);
    expect(r.bookingState).toBeUndefined();
  });
});
