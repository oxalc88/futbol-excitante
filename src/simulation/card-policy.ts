/**
 * @module @pes/simulation/card-policy
 *
 * Single source of truth for the engine-grounded card consequence
 * (CARD-MACHINERY, FOULS_CARDS_SPEC §7 / §9.1), read by the in-core card branch
 * in src/simulation/loop/simulation.ts. The card policy is a pure function: it
 * does not read the wall clock, DOM, devices, network, filesystem, or renderer.
 *
 * The card is grounded ONLY on the already-committed man-not-ball foul contacts
 * (the shared foul predicate, FOULS_CARDS_SPEC §5.1). The accumulation
 * thresholds are `fouls-v1` VERSIONED_PROVISIONAL design choices — NOT measured
 * PES 2017 constants. Direct-red-by-contact-severity is deliberately NOT
 * implemented: the spec §9.1 names the numeric threshold
 * `foul_card_direct_red_severity_threshold` (0.85) but §7 only NAMES an
 * "optional contact-severity discriminator" and never defines how the
 * normalized severity is computed from the accepted tackle contact; §11
 * declares `foul_severity_distribution_ref` and `disciplinary_scale_ref`
 * BLOCKED_MISSING_REFERENCE. No severity envelope is invented.
 *
 * Second-card (a second yellow → red) semantics are NOT specified by the spec:
 * §7 defines two INDEPENDENT accumulation thresholds, not a
 * yellow-accumulation-to-expulsion relationship. This module issues a caution
 * when the accumulated count reaches the yellow accumulation count and an
 * expulsion when it reaches the red accumulation count; it does NOT implement a
 * second-yellow-to-red rule.
 */

/** A caution (yellow) is issued when the offending player's accumulated foul
 * count reaches this value (FOULS_CARDS_SPEC §9.1, `fouls-v1`,
 * VERSIONED_PROVISIONAL — NOT a measured PES 2017 constant). */
export const FOULS_YELLOW_ACCUMULATION_COUNT = 2;

/** An expulsion (red) is issued when the offending player's accumulated foul
 * count reaches this value (FOULS_CARDS_SPEC §9.1, `fouls-v1`,
 * VERSIONED_PROVISIONAL — NOT a measured PES 2017 constant). */
export const FOULS_RED_ACCUMULATION_COUNT = 5;

/**
 * The card type warranted by an accumulated recognized-foul count, or `null`
 * when no card is warranted (below the caution threshold, or past the expulsion
 * threshold where the spec defines no further threshold). The identity is
 * EXACT against the accumulation thresholds: the count must equal the yellow or
 * red threshold for the respective card.
 */
export function resolveCardForAccumulatedFouls(
  accumulatedFouls: number,
): "caution" | "expulsion" | null {
  if (accumulatedFouls === FOULS_YELLOW_ACCUMULATION_COUNT) return "caution";
  if (accumulatedFouls === FOULS_RED_ACCUMULATION_COUNT) return "expulsion";
  return null;
}
