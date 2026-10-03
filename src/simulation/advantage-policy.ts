/**
 * @module @pes/simulation/advantage-policy
 *
 * Single source of truth for the FOULS_CARDS_SPEC §6.2–§6.4 advantage-window
 * machinery read by the in-core advantage branch in
 * src/simulation/loop/simulation.ts (ADVANTAGE-MACHINERY).
 *
 * The policy is a pure function of committed facts — the window open tick, the
 * current tick, the match phase and the team the ball's accepted `lastTouchRef`
 * resolves to. It never reads the wall clock, DOM, devices, network, filesystem
 * or renderer, and it never invents a possession model: it reads the accepted
 * `lastTouchRef` fact exactly as §6.3 specifies.
 *
 * The two budgets below are `fouls-v1` VERSIONED_PROVISIONAL design choices
 * declared in FOULS_CARDS_SPEC §9.1. They are engine-tick budgets at
 * `foundation-fixed-dt-v1` — NOT measured PES 2017 constants and NOT wall-clock
 * latencies (`advantage_window_ref_ms` stays `BLOCKED_MISSING_REFERENCE`).
 *
 * The judged-retained path (§6.2a) is deliberately NOT implemented:
 * `advantage_retention_ref` is `BLOCKED_MISSING_REFERENCE` (§11), so no
 * retention envelope is invented. The window therefore always closes by
 * cancellation (§6.3) or expiry (§6.2c), and the otherwise-pending foul is
 * called at the close tick (§6.4).
 */

import type { MatchPhase } from "../contracts/state.js";

/**
 * The bounded advantage-window length in engine ticks (FOULS_CARDS_SPEC §6.2
 * `advantage_window_ticks`, §9.1: `24`, VERSIONED_PROVISIONAL). The window opens
 * on the committed foul-contact tick and expires when the window has reached
 * this many ticks without a prior cancellation.
 */
export const ADVANTAGE_WINDOW_TICKS = 24;

/**
 * The upper bound, in engine ticks after the window closes, on how long the
 * pending caution may be withheld before the §7 card consequence applies
 * (FOULS_CARDS_SPEC §6.4 `foul_caution_pending_ticks`, §9.1: `12`,
 * VERSIONED_PROVISIONAL). This implementation resolves the pending consequence
 * at the close tick itself (0 of the budget withheld), which the bound permits.
 */
export const FOUL_CAUTION_PENDING_TICKS = 12;

/**
 * Why an open advantage window closed. §6.2 case (a) (judged retained) is NOT
 * representable: the retained judgment is unimplemented and unreferenced.
 */
export type AdvantageCloseReason =
  | "cancelled-last-touch-loss"
  | "cancelled-stoppage"
  | "expired";

/** The committed facts the close decision reads (FOULS_CARDS_SPEC §6.2–§6.3). */
export interface AdvantageCloseInput {
  /** Tick the window opened on (the committed foul-contact tick). */
  openTick: number;
  /** The tick being evaluated. */
  currentTick: number;
  /** The match phase at the evaluated tick. */
  phase: MatchPhase;
  /** The team the ball's `lastTouchRef` resolves to, or null when it resolves to
   * no team (an untracked/null reference is "not the fouled team"). */
  lastTouchTeam: string | null;
  /** The fouled team (teamIdB of the recognized §5.1 foul contact). */
  fouledTeam: string;
}

/**
 * Resolve whether (and why) an open advantage window closes on `currentTick`,
 * or `null` when the window stays open. The decision is a pure function of the
 * committed facts above; it introduces no collider, event, action or possession
 * model.
 *
 * - The window never closes on its own opening tick (§6.2: it opens on the
 *   committed foul-contact tick); the earliest close is the following tick.
 * - A match phase that has left `playing` cancels the window (§6.3
 *   "New stoppage"); a stoppage outranks expiry on a tie, matching the accepted
 *   same-tick priority where a restart that claimed the phase wins.
 * - A `lastTouchRef` that no longer resolves to the fouled team cancels the
 *   window (§6.3 "Loss of control"). A null/untracked reference is a loss.
 * - Otherwise the window expires once it has reached `ADVANTAGE_WINDOW_TICKS`
 *   ticks (§6.2c). Expiry is a standing call, never a silent no-decision.
 * - Continued fouled-team possession does not cancel: the reference still
 *   resolving to the fouled team is exactly the §6.3 condition under which the
 *   window may run to expiry.
 */
export function resolveAdvantageClose(input: AdvantageCloseInput): AdvantageCloseReason | null {
  if (input.currentTick <= input.openTick) return null;
  if (input.phase !== "playing") return "cancelled-stoppage";
  if (input.lastTouchTeam !== input.fouledTeam) return "cancelled-last-touch-loss";
  if (input.currentTick - input.openTick >= ADVANTAGE_WINDOW_TICKS) return "expired";
  return null;
}
