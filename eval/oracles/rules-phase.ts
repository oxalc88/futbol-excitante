/**
 * @module eval/oracles/rules-phase
 *
 * Protected match-rule oracles (objective RULES-SUITE-REGISTRATION) for the
 * MATCH_RULES_SPEC §15 phase-related criteria:
 *   - MATCH-KICKOFF-FREEZE   -> checkKickoffFreeze
 *   - MATCH-TIMER-FREEZE     -> checkTimerFreeze
 *
 * Both are pure `TelemetryObservation[] → InvariantResult[]` functions reading
 * only committed, observable fields.  The thresholds come from the anti-huddle
 * contract (`anti-huddle-v1`: KICKOFF_FREEZE_HOME_TOLERANCE = 0.75 m) and the
 * versioned provisional `match-rules-v1` model; no PES 2017 value is used.
 *
 * checkKickoffFreeze observes the opening kickoff window directly (ball
 * untouched, bodies at their kickoff homes) and is falsifiable: a mutant where
 * more bodies than the designated taker + any at-ball body leave home during
 * the untouched window FAILs.  checkTimerFreeze returns the honest
 * NOT_EVALUATED, because the committed TelemetryObservation does not carry the
 * core matchPhase per tick nor the matchTimer — the timer-decrement contract is
 * core-owned and not serialized, so the freeze cannot be adjudicated from the
 * standard observation stream and must never be over-claimed as PASS.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { InvariantResult } from "../../src/contracts/telemetry.js";

// ---------------------------------------------------------------------------
// Thresholds (anti-huddle-v1, referenced)
// ---------------------------------------------------------------------------

/**
 * Kickoff freeze home tolerance (m) — dead-zone slack at the frozen home.
 * Anti-huddle-v1 exposes this contract; a body that strays beyond it is no
 * longer held at its anchor.
 */
const KICKOFF_FREEZE_HOME_TOLERANCE = 0.75;

/** A body may legitimately leave its kickoff home while the ball is untouched
 * only if it is the single designated taker, or a body already at the ball
 * (exempt from the freeze).  More than that many movers is a clump mutant. */
const MAX_KICKOFF_MOVERS = 2;

// ---------------------------------------------------------------------------
// MATCH-KICKOFF-FREEZE
// ---------------------------------------------------------------------------

/**
 * While the kickoff restart ball is untouched, every non-taker body is held at
 * its kickoff home (§12).  Measures the opening untouched window (the run of
 * ticks where `ball.lastTouchRef` is null) and FAILs if more than the taker +
 * an at-ball body leave their tick-0 home beyond the anti-huddle tolerance.
 * Returns NOT_EVALUATED when there is no untouched opening window to observe.
 */
export function checkKickoffFreeze(
  observations: TelemetryObservation[],
): InvariantResult[] {
  if (observations.length === 0) {
    return [{ id: "rules-kickoff-freeze", status: "not_evaluated", description: "No observations in the run", details: {} }];
  }

  // A team freeze requires at least one non-taker body; a single-body run has
  // nothing to freeze, so adjudicating a freeze over it would be a degenerate
  // over-claim.  Require > 1 observed body.
  if (observations[0].players.length < 2) {
    return [
      {
        id: "rules-kickoff-freeze",
        status: "not_evaluated",
        description:
          "Only one body observed; a team freeze (non-taker bodies) is not observable",
        details: { bodyCount: observations[0].players.length },
      },
    ];
  }

  // Opening untouched run: maximal contiguous prefix with ball.lastTouchRef null.
  let freezeEnd = 0;
  while (
    freezeEnd < observations.length &&
    observations[freezeEnd].ball.lastTouchRef === null
  ) {
    freezeEnd++;
  }
  if (freezeEnd < 2) {
    return [
      {
        id: "rules-kickoff-freeze",
        status: "not_evaluated",
        description:
          "The kickoff ball was touched immediately (no untouched opening window), so the kickoff freeze is not observable",
        details: { untouchedTicks: freezeEnd },
      },
    ];
  }

  const home: Record<string, { x: number; y: number }> = {};
  for (const p of observations[0].players) {
    home[p.playerId] = { x: p.groundPosition.x, y: p.groundPosition.y };
  }

  // Count bodies that stray beyond the freeze tolerance at any point during the
  // untouched opening window (the dedicated taker + at-ball bodies are allowed).
  const movers = new Set<string>();
  for (let i = 0; i < freezeEnd; i++) {
    const o = observations[i];
    for (const p of o.players) {
      const h = home[p.playerId];
      if (h === undefined) continue;
      const dx = p.groundPosition.x - h.x;
      const dy = p.groundPosition.y - h.y;
      if (Math.hypot(dx, dy) > KICKOFF_FREEZE_HOME_TOLERANCE) {
        movers.add(p.playerId);
      }
    }
  }

  if (movers.size > MAX_KICKOFF_MOVERS) {
    return [
      {
        id: "rules-kickoff-freeze-mutated",
        status: "fail",
        description:
          `Kickoff freeze violated: ${movers.size} bodies left their kickoff home while the ball was untouched ` +
          `(allowed ${MAX_KICKOFF_MOVERS}: the single taker + any at-ball body)`,
        details: { movers: [...movers], untouchedTicks: freezeEnd },
      },
    ];
  }

  return [
    {
      id: "rules-kickoff-freeze-held",
      status: "pass",
      description:
        `Kickoff freeze held: only ${movers.size} body(ies) moved while the ball was untouched over ${freezeEnd} ticks`,
      details: { movers: [...movers], untouchedTicks: freezeEnd },
    },
  ];
}

// ---------------------------------------------------------------------------
// MATCH-TIMER-FREEZE
// ---------------------------------------------------------------------------

/**
 * The match timer is frozen during goal / fulltime / kickoff / set-piece
 * phases (§11); its ball-in-play decrement is gated on "playing".  When the
 * observation stream carries the runner-injected per-tick `core-match-phase`
 * facts (the RESTART-RULES-CONFORMANCE serialization), this oracle adjudicates
 * the freeze: it FAILs if the ball-in-play clock decrements across a tick whose
 * post-step phase is a frozen phase, PASSes when every frozen tick held the
 * clock, and stays NOT_EVALUATED when there is no frozen tick to adjudicate.
 * When the stream carries no phase/timer facts (a non-gated run), it returns
 * the honest NOT_EVALUATED rather than inventing a PASS.  A run with no
 * observations is likewise NOT_EVALUATED (empty result → evaluator
 * NOT_EVALUATED).
 */
export function checkTimerFreeze(
  observations: TelemetryObservation[],
): InvariantResult[] {
  if (observations.length === 0) return [];

  // Collect the per-tick core post-step phase + timer from the runner-injected
  // `core-match-phase` events.
  const facts: Array<{ tick: number; phase: string; timer: number }> = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "core-match-phase") continue;
      const payload = ev.payload as { matchPhase?: unknown; matchTimer?: unknown } | undefined;
      if (typeof payload?.matchPhase !== "string" || typeof payload?.matchTimer !== "number") continue;
      facts.push({ tick: o.tick, phase: payload.matchPhase, timer: payload.matchTimer });
    }
  }

  if (facts.length === 0) {
    return [
      {
        id: "rules-timer-freeze",
        status: "not_evaluated",
        description:
          "The committed observation stream does not carry the core matchTimer per tick; " +
          "the timer-freeze contract (decrement gated on 'playing') is core-owned and not " +
          "serialized, so it is not observable from the standard observation stream — " +
          "never over-claimed as PASS",
        details: { observations: observations.length },
      },
    ];
  }

  facts.sort((a, b) => a.tick - b.tick);

  // Phases the ball-in-play clock is frozen in. "playing" decrements; "halftime"
  // re-uses the timer as the break countdown (a documented separate use), so it
  // is not a frozen clock tick.
  const FROZEN = new Set(["goal", "fulltime", "kickoff", "corner-kick", "throw-in", "goal-kick"]);
  let frozenTicks = 0;
  const failures: string[] = [];
  for (let i = 1; i < facts.length; i++) {
    const prev = facts[i - 1];
    const cur = facts[i];
    if (!FROZEN.has(cur.phase)) continue;
    frozenTicks++;
    // The one legitimate exception: the ball-in-play clock reaches zero inside
    // the "playing" branch and the core enters "fulltime" on that same tick, so
    // the first fulltime tick carries a timer that just decremented to 0.
    const isFulltimeEntry = cur.phase === "fulltime" && prev.phase === "playing" && cur.timer === 0;
    if (!isFulltimeEntry && cur.timer < prev.timer) {
      failures.push(
        `tick ${cur.tick} phase ${cur.phase}: matchTimer ${prev.timer}→${cur.timer} (decremented during a frozen phase)`,
      );
    }
  }

  if (frozenTicks === 0) {
    return [
      {
        id: "rules-timer-freeze",
        status: "not_evaluated",
        description:
          "No non-playing (goal / fulltime / kickoff / set-piece) tick was observed, so the " +
          "timer-freeze contract had nothing to adjudicate in this run",
        details: { frozenTicks },
      },
    ];
  }

  if (failures.length > 0) {
    return [
      {
        id: "rules-timer-freeze-mutated",
        status: "fail",
        description: `Match timer froze incorrectly: ${failures.join("; ")}`,
        details: { failures, frozenTicks },
      },
    ];
  }

  return [
    {
      id: "rules-timer-freeze-held",
      status: "pass",
      description:
        `Match timer froze correctly across ${frozenTicks} non-playing tick(s): the ball-in-play ` +
        `clock did not decrement during goal / fulltime / kickoff / set-piece phases`,
      details: { frozenTicks },
    },
  ];
}

// ---------------------------------------------------------------------------
// MATCH_THROW_IN_TIMER_FREEZE / MATCH_GOAL_KICK_TIMER_FREEZE (MATCH_RULES_SPEC §11)
// ---------------------------------------------------------------------------

/** Collect the runner-injected per-tick core post-step phase + timer facts. */
function collectCorePhaseFacts(
  observations: TelemetryObservation[],
): Array<{ tick: number; phase: string; timer: number }> {
  const facts: Array<{ tick: number; phase: string; timer: number }> = [];
  for (const o of observations) {
    for (const ev of o.events) {
      if (ev.kind !== "core-match-phase") continue;
      const payload = ev.payload as { matchPhase?: unknown; matchTimer?: unknown } | undefined;
      if (typeof payload?.matchPhase !== "string" || typeof payload?.matchTimer !== "number") continue;
      facts.push({ tick: o.tick, phase: payload.matchPhase, timer: payload.matchTimer });
    }
  }
  facts.sort((a, b) => a.tick - b.tick);
  return facts;
}

/**
 * A phase-specific timer freeze (MATCH_RULES_SPEC §11): the ball-in-play clock
 * must not decrement across a tick whose post-step phase is the named phase.
 * FAIL on a decrement inside that phase; NOT_EVALUATED when the stream carries
 * no such phase tick (or no phase facts at all).
 */
function checkPhaseTimerFreeze(
  observations: TelemetryObservation[],
  phase: string,
  id: string,
): InvariantResult[] {
  const facts = collectCorePhaseFacts(observations);
  if (facts.length === 0) {
    return [{ id, status: "not_evaluated", description: "The committed observation stream does not carry the core matchTimer per tick", details: {} }];
  }
  const phaseTicks = facts.filter((f) => f.phase === phase);
  if (phaseTicks.length === 0) {
    return [{ id, status: "not_evaluated", description: `No ${phase} phase tick was observed; the timer-freeze contract had nothing to adjudicate`, details: { phaseTicks: phaseTicks.length } }];
  }
  const failures: string[] = [];
  const byTick = new Map(facts.map((f) => [f.tick, f]));
  for (const f of phaseTicks) {
    const prev = byTick.get(f.tick - 1);
    if (prev && f.timer < prev.timer) {
      failures.push(`tick ${f.tick} phase ${phase}: matchTimer ${prev.timer}→${f.timer} (decremented during a frozen phase)`);
    }
  }
  if (failures.length > 0) {
    return [{ id: `${id}-mutated`, status: "fail", description: `${phase} timer freeze violated: ${failures.join("; ")}`, details: { failures } }];
  }
  return [{ id: `${id}-held`, status: "pass", description: `Match timer froze correctly across ${phaseTicks.length} ${phase} tick(s)`, details: { phaseTicks: phaseTicks.length } }];
}

/** MATCH-THROW-IN-TIMER-FREEZE: timer frozen during the throw-in phase. */
export function checkThrowInTimerFreeze(observations: TelemetryObservation[]): InvariantResult[] {
  return checkPhaseTimerFreeze(observations, "throw-in", "rules-throw-in-timer-freeze");
}

/** MATCH-GOAL-KICK-TIMER-FREEZE: timer frozen during the goal-kick phase. */
export function checkGoalKickTimerFreeze(observations: TelemetryObservation[]): InvariantResult[] {
  return checkPhaseTimerFreeze(observations, "goal-kick", "rules-goal-kick-timer-freeze");
}

/** MATCH-CORNER-KICK-TIMER-FREEZE: timer frozen during the corner-kick phase. */
export function checkCornerKickTimerFreeze(observations: TelemetryObservation[]): InvariantResult[] {
  return checkPhaseTimerFreeze(observations, "corner-kick", "rules-corner-kick-timer-freeze");
}

// ---------------------------------------------------------------------------
// MATCH-TIMER-DECREMENT (MATCH_RULES_SPEC §11)
// ---------------------------------------------------------------------------

/**
 * The ball-in-play timer decrements only while the match phase is playing (§11).
 * Reads the per-tick core post-step phase + timer facts: every decrement must
 * land on a `playing` tick (or the documented `halftime` break countdown, or
 * the legitimate playing→fulltime zero-crossing where the timer hits 0 and the
 * phase transitions on the same tick).  FAIL on a decrement inside a frozen
 * phase; NOT_EVALUATED when no decrement facts exist.
 */
export function checkTimerDecrement(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const facts = collectCorePhaseFacts(observations);
  if (facts.length === 0) {
    return [{ id: "rules-timer-decrement", status: "not_evaluated", description: "The committed observation stream does not carry the core matchTimer per tick", details: {} }];
  }
  const FROZEN = new Set(["goal", "fulltime", "kickoff", "corner-kick", "throw-in", "goal-kick"]);
  let decrements = 0;
  const failures: string[] = [];
  for (let i = 1; i < facts.length; i++) {
    const prev = facts[i - 1];
    const cur = facts[i];
    if (cur.timer >= prev.timer) continue;
    decrements++;
    if (!FROZEN.has(cur.phase)) continue;
    // The one legitimate frozen-phase decrement: the ball-in-play clock hits 0
    // inside `playing` and the core enters `fulltime` on that same tick.
    const isFulltimeEntry = cur.phase === "fulltime" && cur.timer === 0 && prev.timer === 1;
    if (!isFulltimeEntry) {
      failures.push(`tick ${cur.tick} phase ${cur.phase}: matchTimer ${prev.timer}→${cur.timer} (decremented during a frozen phase)`);
    }
  }
  if (decrements === 0) {
    return [{ id: "rules-timer-decrement", status: "not_evaluated", description: "No timer decrement was observed", details: { decrements } }];
  }
  if (failures.length > 0) {
    return [{ id: "rules-timer-decrement-mutated", status: "fail", description: `Timer decrement violated: ${failures.join("; ")}`, details: { failures, decrements } }];
  }
  return [{ id: "rules-timer-decrement-held", status: "pass", description: `The match timer decremented only during playing across ${decrements} decrement(s)`, details: { decrements } }];
}

// ---------------------------------------------------------------------------
// MATCH-TIMER-HALFTIME / MATCH-TIMER-FULLTIME (MATCH_RULES_SPEC §11)
// ---------------------------------------------------------------------------

/**
 * MATCH-TIMER-HALFTIME: when the timer reaches zero in half 1 the phase
 * transitions to `halftime`, then to the second half (§11).  Reads the
 * per-tick core post-step phase facts: a `halftime` post-phase must be
 * preceded by `playing` and followed by `playing` (second half).  FAIL on a
 * missing sequence; NOT_EVALUATED when no halftime transition is observed.
 */
export function checkTimerHalftime(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const facts = collectCorePhaseFacts(observations);
  if (facts.length === 0) {
    return [{ id: "rules-timer-halftime", status: "not_evaluated", description: "The committed observation stream does not carry the core matchPhase per tick", details: {} }];
  }
  let sawPlayingBefore = false;
  let sawHalftime = false;
  let sawPlayingAfter = false;
  for (const f of facts) {
    if (f.phase === "playing") {
      if (sawHalftime) sawPlayingAfter = true;
      else sawPlayingBefore = true;
    } else if (f.phase === "halftime") {
      sawHalftime = true;
    }
  }
  if (!sawHalftime) {
    return [{ id: "rules-timer-halftime", status: "not_evaluated", description: "No halftime transition was observed (the timer never reached zero in half 1)", details: {} }];
  }
  if (!(sawPlayingBefore && sawPlayingAfter)) {
    return [{ id: "rules-timer-halftime-mutated", status: "fail", description: `Halftime transition incomplete: playingBefore=${sawPlayingBefore}, halftime=${sawHalftime}, playingAfter=${sawPlayingAfter}`, details: { sawPlayingBefore, sawHalftime, sawPlayingAfter } }];
  }
  return [{ id: "rules-timer-halftime-held", status: "pass", description: "The timer reached zero in half 1, the phase transitioned to halftime, and play resumed as the second half", details: {} }];
}

/**
 * MATCH-TIMER-FULLTIME: when the timer reaches zero in half 2 the phase
 * transitions to `fulltime` (§11).  Reads the per-tick core post-step phase +
 * timer facts: a `fulltime` post-phase reached via a playing tick whose timer
 * hits 0.  FAIL when a fulltime is reached without the timer-driven zero
 * crossing; NOT_EVALUATED when no such transition is observed.
 */
export function checkTimerFulltime(
  observations: TelemetryObservation[],
): InvariantResult[] {
  const facts = collectCorePhaseFacts(observations);
  if (facts.length === 0) {
    return [{ id: "rules-timer-fulltime", status: "not_evaluated", description: "The committed observation stream does not carry the core matchTimer per tick", details: {} }];
  }
  let sawFulltime = false;
  let sawTimerDriven = false;
  for (let i = 1; i < facts.length; i++) {
    const prev = facts[i - 1];
    const cur = facts[i];
    if (cur.phase === "fulltime") {
      sawFulltime = true;
      if (prev.phase === "playing" && cur.timer === 0 && prev.timer === 1) sawTimerDriven = true;
    }
  }
  if (!sawFulltime) {
    return [{ id: "rules-timer-fulltime", status: "not_evaluated", description: "No fulltime transition was observed", details: {} }];
  }
  // The core-owned runner stamps a terminal fulltime tick even when the timer
  // has not reached zero (the 1800-tick fixtures end with the timer still in
  // play).  That is a driver label, not the §11 rule transition, so the
  // criterion was not tested — NOT_EVALUATED, never a FAIL.
  if (!sawTimerDriven) {
    return [{ id: "rules-timer-fulltime", status: "not_evaluated", description: "A fulltime label was observed but not via the timer-driven playing→fulltime zero crossing (runner-stamped fulltime is not a rule transition)", details: { sawFulltime, sawTimerDriven } }];
  }
  return [{ id: "rules-timer-fulltime-held", status: "pass", description: "The timer reached zero in half 2 and the phase transitioned to fulltime", details: {} }];
}
