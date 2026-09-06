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
 * The match timer is frozen during goal / halftime / fulltime / set-piece
 * phases (§11).  The committed TelemetryObservation does NOT carry the core
 * matchPhase per tick, nor the matchTimer — that contract is core-owned and not
 * serialized into the observation stream.  There is therefore no executable
 * observation of the freeze, so this protected oracle returns the honest
 * NOT_EVALUATED rather than inventing a PASS.  A run with no observations is
 * likewise NOT_EVALUATED (empty result → evaluator NOT_EVALUATED).
 */
export function checkTimerFreeze(
  observations: TelemetryObservation[],
): InvariantResult[] {
  if (observations.length === 0) return [];
  return [
    {
      id: "rules-timer-freeze",
      status: "not_evaluated",
      description:
        "The committed observation stream does not carry the core matchPhase per tick nor the matchTimer; " +
        "the timer-freeze contract (decrement gated on 'playing') is core-owned and not serialized, so it is " +
        "not observable from the standard observation stream — never over-claimed as PASS",
      details: { observations: observations.length },
    },
  ];
}
