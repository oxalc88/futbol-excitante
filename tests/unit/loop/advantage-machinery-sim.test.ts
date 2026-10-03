/**
 * @module tests/unit/loop/advantage-machinery-sim
 *
 * ADVANTAGE-MACHINERY direct core tests (FOULS_CARDS_SPEC §6.2–§6.4):
 *   - the pure close decision (src/simulation/advantage-policy.ts) pins the
 *     versioned provisional budgets, the opening-tick non-close, cancellation
 *     precedence (§6.3) and expiry at exactly `advantage_window_ticks`;
 *   - with the advantage gate OFF (default/undefined or explicitly false) the
 *     driven stream is byte-identical and emits no advantage event;
 *   - with the gate ON a driven man-not-ball foul opens the window on the
 *     contact tick and the close calls the pending foul at the CLOSE tick: the
 *     free-kick restart window opens at the close (its CPU auto-serve lands
 *     exactly the accepted countdown later), never at the foul tick;
 *   - the §7 card consequence is likewise deferred to the close tick and card
 *     accumulation coexists with deferral across successive windows;
 *   - discriminating mutants: applying the pending consequence at the foul tick
 *     instead of the close tick would move the free-kick serve tick (asserted
 *     here); a changed window length would move the expiry close tick (asserted
 *     in the organic integration companion).
 *
 * No judged-retained path is asserted anywhere: `advantage_retention_ref` is
 * BLOCKED_MISSING_REFERENCE (spec §11) and no advantage is ever played.
 *
 * Input enters ONLY through the accepted defensive-duel driver (tick-indexed
 * InputFrames); no Math.random, Date, DOM, or Node I/O in the sim path.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { runDefensiveDuel } from "../../../eval/runners/defensive-duel-driver.js";
import { withProximateHumanDefence } from "../../../eval/scenarios/proximate-5v5.js";
import { detectFoulEvents } from "../../../eval/runners/foul-detection.js";
import {
  ADVANTAGE_WINDOW_TICKS,
  FOUL_CAUTION_PENDING_TICKS,
  resolveAdvantageClose,
} from "../../../src/simulation/advantage-policy.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";
import type { DefensiveDuelResult } from "../../../eval/runners/defensive-duel-driver.js";

/** The accepted in-core free-kick countdown (`defaultFreeKickCountdown`). */
const FREE_KICK_COUNTDOWN = 60;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadScenario(path: string): ScenarioDefinition {
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as ScenarioDefinition;
}

/** The driven advantage stream: scripted standing tackles every 16 ticks. */
function runDuel(opts: {
  maxTicks: number;
  attemptsThrough: number;
  freeKick: boolean;
  cards: boolean;
  /** `undefined` = the advantage gate is absent (the pre-change path). */
  advantage: boolean | undefined;
  /** Optional first-half length; a value that ends the half inside an open
   * window exercises the §6.3 "new stoppage" cancellation. */
  matchDurationTicks?: number;
}): DefensiveDuelResult {
  const base = withProximateHumanDefence(
    loadScenario("eval/scenarios/5v5-human-vs-cpu.v1.json"),
  );
  const scenario =
    opts.matchDurationTicks === undefined ? base : { ...base, matchDurationTicks: opts.matchDurationTicks };
  const attempts: Array<{ kind: "standing"; commitDistance: number; earliestTick: number }> = [];
  for (let t = 44; t <= opts.attemptsThrough; t += 16) {
    attempts.push({ kind: "standing", commitDistance: 3.0, earliestTick: t });
  }
  return runDefensiveDuel({
    scenario,
    maxTicks: opts.maxTicks,
    attempts,
    freeKickConfig: opts.freeKick ? { awardFreeKicks: true } : undefined,
    cardConfig: opts.cards ? { issueCards: true } : undefined,
    advantageConfig: opts.advantage === undefined ? undefined : { playAdvantage: opts.advantage },
  });
}

// ---------------------------------------------------------------------------
// Cached runs (bounded wall-clock cost)
// ---------------------------------------------------------------------------

let cards1: DefensiveDuelResult;
let cards2: DefensiveDuelResult;
let full: DefensiveDuelResult;
let gateAbsent: DefensiveDuelResult;
let gateExplicitlyOff: DefensiveDuelResult;
let stoppageDuel: DefensiveDuelResult;

describe("ADVANTAGE-MACHINERY window policy (pure, FOULS_CARDS_SPEC §6.2–§6.3)", () => {
  it("pins the versioned provisional engine-tick budgets (§9.1)", () => {
    expect(ADVANTAGE_WINDOW_TICKS).toBe(24);
    expect(FOUL_CAUTION_PENDING_TICKS).toBe(12);
  });

  it("never closes on its opening tick and expires at exactly advantage_window_ticks", () => {
    const base = {
      openTick: 100,
      phase: "playing" as const,
      lastTouchTeam: "team-b",
      fouledTeam: "team-b",
    };
    expect(resolveAdvantageClose({ ...base, currentTick: 99 })).toBeNull();
    expect(resolveAdvantageClose({ ...base, currentTick: 100 })).toBeNull();
    // Continued fouled-team possession does NOT cancel: the window runs out.
    for (let t = 101; t <= 123; t++) {
      expect(resolveAdvantageClose({ ...base, currentTick: t })).toBeNull();
    }
    expect(resolveAdvantageClose({ ...base, currentTick: 124 })).toBe("expired");
  });

  it("cancels when lastTouchRef no longer resolves to the fouled team (null included)", () => {
    const base = { openTick: 100, currentTick: 101, phase: "playing" as const, fouledTeam: "team-b" };
    expect(resolveAdvantageClose({ ...base, lastTouchTeam: "team-b" })).toBeNull();
    expect(resolveAdvantageClose({ ...base, lastTouchTeam: "team-a" })).toBe("cancelled-last-touch-loss");
    expect(resolveAdvantageClose({ ...base, lastTouchTeam: null })).toBe("cancelled-last-touch-loss");
  });

  it("cancels on a stoppage and lets the stoppage outrank expiry on a tie", () => {
    const base = { openTick: 100, currentTick: 101, lastTouchTeam: "team-b", fouledTeam: "team-b" };
    expect(resolveAdvantageClose({ ...base, phase: "free-kick" })).toBe("cancelled-stoppage");
    expect(resolveAdvantageClose({ ...base, phase: "goal" })).toBe("cancelled-stoppage");
    // Expiry tick + stoppage + lost control: the cancellation is reported first.
    expect(
      resolveAdvantageClose({
        openTick: 100,
        currentTick: 124,
        phase: "corner-kick",
        lastTouchTeam: null,
        fouledTeam: "team-b",
      }),
    ).toBe("cancelled-stoppage");
  });

  it("never reports a judged-retained close (the path is unimplemented and unreferenced)", () => {
    // Whatever the inputs, the only possible outcomes are cancellation / expiry
    // (or the window staying open) — never a retained-advantage decision.
    const outcomes: Array<string | null> = [];
    for (const currentTick of [99, 100, 101, 124, 200]) {
      for (const phase of ["playing", "goal", "free-kick"] as const) {
        for (const lastTouchTeam of [null, "team-a", "team-b"]) {
          const outcome = resolveAdvantageClose({
            openTick: 100,
            currentTick,
            phase,
            lastTouchTeam,
            fouledTeam: "team-b",
          });
          if (!outcomes.includes(outcome)) outcomes.push(outcome);
        }
      }
    }
    expect(outcomes.sort()).toEqual(
      [null, "cancelled-last-touch-loss", "cancelled-stoppage", "expired"].sort(),
    );
  });
});

describe("ADVANTAGE-MACHINERY gate-off default (core)", () => {
  beforeAll(() => {
    gateAbsent = runDuel({ maxTicks: 200, attemptsThrough: 160, freeKick: false, cards: true, advantage: undefined });
    gateExplicitlyOff = runDuel({ maxTicks: 200, attemptsThrough: 160, freeKick: false, cards: true, advantage: false });
  }, 300_000);

  it("the gate off (undefined or explicitly false) emits no advantage event and is byte-identical", () => {
    expect(gateAbsent.advantageEvents).toHaveLength(0);
    expect(gateExplicitlyOff.advantageEvents).toHaveLength(0);
    expect(sha256(JSON.stringify(gateExplicitlyOff.stateHashes))).toBe(
      sha256(JSON.stringify(gateAbsent.stateHashes)),
    );
    // The pre-change card path is untouched by the new optional parameter.
    expect(gateAbsent.cardEvents.map((e) => e.tick)).toEqual(
      gateExplicitlyOff.cardEvents.map((e) => e.tick),
    );
  });
});

describe("ADVANTAGE-MACHINERY in-core window (driven, FOULS_CARDS_SPEC §6.2–§6.4)", () => {
  beforeAll(() => {
    cards1 = runDuel({ maxTicks: 200, attemptsThrough: 160, freeKick: false, cards: true, advantage: true });
    cards2 = runDuel({ maxTicks: 200, attemptsThrough: 160, freeKick: false, cards: true, advantage: true });
    full = runDuel({ maxTicks: 380, attemptsThrough: 340, freeKick: true, cards: true, advantage: true });
    detectFoulEvents(cards1.observations);
    detectFoulEvents(full.observations);
  }, 300_000);

  it("opens on the committed foul-contact tick and defers the call to the close tick", () => {
    const adv = cards1.advantageEvents;
    const opened = adv.filter((e) => e.kind === "advantage-opened");
    const cancelled = adv.filter((e) => e.kind === "advantage-cancelled");
    expect(adv.filter((e) => e.kind === "advantage-expired")).toHaveLength(0);
    expect(opened.length).toBeGreaterThanOrEqual(1);
    expect(opened.map((e) => e.tick)).toEqual(
      cancelled.map((e) => ((e.payload ?? {}) as Record<string, unknown>).openTick),
    );

    const firstOpen = (opened[0].payload ?? {}) as Record<string, unknown>;
    expect(opened[0].tick).toBe(66);
    expect(firstOpen.openTick).toBe(66);
    expect(firstOpen.windowTicks).toBe(ADVANTAGE_WINDOW_TICKS);
    expect(firstOpen.pendingFoulCount).toBe(1);
    expect(firstOpen.foulTick).toBe(66);
    expect(firstOpen.foulSourceEventId).toBeTruthy();
    expect(firstOpen.fouledTeam).toBe("team-b");
    expect(firstOpen.offenderId).toBe(cards1.humanPlayerId);
    expect(firstOpen.fouledPlayerId).toBeTruthy();

    // The first close is a §6.3 loss of control on the next tick; the foul is
    // NOT called on the foul tick.
    const firstClose = (cancelled[0].payload ?? {}) as Record<string, unknown>;
    expect(cancelled[0].tick).toBe(67);
    expect(firstClose.reason).toBe("cancelled-last-touch-loss");
    expect(firstClose.openTick).toBe(66);
    expect(firstClose.closeTick).toBe(67);
    expect(firstClose.foulTick).toBe(66);
    expect(firstClose.cautionPendingBudgetTicks).toBe(FOUL_CAUTION_PENDING_TICKS);
    expect(firstClose.cautionPendingTicksUsed).toBe(0);
  });

  it("deferred calls still accumulate the §7 card thresholds (coexistence)", () => {
    expect(cards1.cardEvents).toHaveLength(1);
    const card = cards1.cardEvents[0];
    const p = (card.payload ?? {}) as Record<string, unknown>;
    expect(p.cardType).toBe("caution");
    expect(p.accumulatedFouls).toBe(2);
    expect(p.playerId).toBe(cards1.humanPlayerId);
    // The card applies at the CLOSE tick of the 2nd window (135), never at its
    // foul tick (116).
    expect(card.tick).toBe(135);
    expect(p.foulTick).toBe(116);
    expect(cards1.bookingState).toBeDefined();
    const booking = cards1.bookingState![cards1.humanPlayerId];
    expect(booking.fouls).toBe(3);
    expect(booking.cautions).toBe(1);
    expect(booking.expulsions).toBe(0);
  });

  it("the close-tick deferral is real: the free-kick window opens at the close, not the foul tick", () => {
    const opened = full.advantageEvents.filter((e) => e.kind === "advantage-opened");
    const cancelled = full.advantageEvents.filter((e) => e.kind === "advantage-cancelled");
    expect(opened[0].tick).toBe(66);
    expect(cancelled[0].tick).toBe(67);
    const freeKickTicks = full.freeKickEvents.map((e) => e.tick);
    expect(freeKickTicks[0]).toBe(67 + FREE_KICK_COUNTDOWN);
    // A mutant applying the consequence at the foul tick would serve at 126.
    expect(freeKickTicks).not.toContain(66 + FREE_KICK_COUNTDOWN);

    // The 2nd deferred foul accumulates the caution at its own close tick (308).
    expect(opened[1].tick).toBe(289);
    expect(cancelled[1].tick).toBe(308);
    expect(freeKickTicks[1]).toBe(308 + FREE_KICK_COUNTDOWN);
    expect(full.cardEvents.map((e) => e.tick)).toEqual([308]);
    const cardPayload = (full.cardEvents[0].payload ?? {}) as Record<string, unknown>;
    expect(cardPayload.cardType).toBe("caution");
    expect(cardPayload.accumulatedFouls).toBe(2);
  });

  it("the advantage streams are byte-identical across two runs (two-run attestation)", () => {
    expect(sha256(JSON.stringify(cards1.stateHashes))).toBe(sha256(JSON.stringify(cards2.stateHashes)));
    expect(JSON.stringify(cards1.advantageEvents)).toBe(JSON.stringify(cards2.advantageEvents));
    expect(JSON.stringify(cards1.cardEvents)).toBe(JSON.stringify(cards2.cardEvents));
  });
});

describe("ADVANTAGE-MACHINERY stoppage cancellation (driven, §6.3 new stoppage)", () => {
  beforeAll(() => {
    // A first half that ends (matchDurationTicks 120) inside the window opened
    // at tick 116: the phase leaves `playing` before the 24-tick budget, so the
    // stoppage — not expiry — cancels the window.
    stoppageDuel = runDuel({
      maxTicks: 200,
      attemptsThrough: 160,
      freeKick: false,
      cards: true,
      advantage: true,
      matchDurationTicks: 120,
    });
  }, 300_000);

  it("a half ending inside the window cancels it early and the pending caution still applies at the close tick", () => {
    const opened = stoppageDuel.advantageEvents.filter((e) => e.kind === "advantage-opened");
    const cancelled = stoppageDuel.advantageEvents.filter((e) => e.kind === "advantage-cancelled");
    expect(opened.map((e) => e.tick)).toEqual([66, 116]);
    expect(cancelled.map((e) => e.tick)).toEqual([67, 121]);

    const close = (cancelled[1].payload ?? {}) as Record<string, unknown>;
    expect(close.reason).toBe("cancelled-stoppage");
    expect(close.openTick).toBe(116);
    expect(close.closeTick).toBe(121);
    // Early close, well inside the 24-tick budget (not an expiry).
    expect((close.closeTick as number) - (close.openTick as number)).toBe(5);
    expect(close.cautionPendingBudgetTicks).toBe(FOUL_CAUTION_PENDING_TICKS);

    // §6.4: the deferred §7 consequence is still called at the close tick.
    expect(stoppageDuel.cardEvents.map((e) => e.tick)).toEqual([121]);
    const cardPayload = (stoppageDuel.cardEvents[0].payload ?? {}) as Record<string, unknown>;
    expect(cardPayload.cardType).toBe("caution");
    expect(cardPayload.accumulatedFouls).toBe(2);
    expect(cardPayload.foulTick).toBe(116);
    const booking = stoppageDuel.bookingState![stoppageDuel.humanPlayerId];
    expect(booking.fouls).toBe(2);
    expect(booking.cautions).toBe(1);
  });
});
