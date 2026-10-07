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
 * PES 2017 constants.
 *
 * The §7 contact-severity direct-red path IS implemented here (see
 * `resolveDirectRedForFoul`): a recognized foul whose COMMITTED contact
 * severity crosses the exported `FOUL_CARD_DIRECT_RED_SEVERITY_THRESHOLD`
 * (0.85, fouls-v1 §9.1 VERSIONED_PROVISIONAL) is a direct expulsion, in
 * addition to the accumulation ladder. The severity normalization is a
 * `fouls-v1` VERSIONED_PROVISIONAL DESIGN CHOICE, NOT a measured PES magnitude:
 * it averages two facets read from the already-committed tackle-contact fields
 * (`contactType`, `reach`, `planarDistance`) —
 *   - the challenge's committed span: the sliding lunge's committed reach is
 *     the versioned maximum (`foundation-tackle-v1` slideReach 2.8 m), the
 *     standing challenge's is 1.6 m — the "hard challenge" facet; and
 *   - the contact penetration within the committed reach
 *     `(reach − planarDistance) / reach` — a solid contact deep inside the
 *     reach vs a grazing contact at the reach edge.
 * No other committed fact distinguishes a hard/late challenge: the tackle event
 * serializes no contact speed and no ball-play timing relative to the contact,
 * so no lateness-vs-ball-play envelope is encoded (that would be an invented
 * envelope). §11's `foul_severity_distribution_ref` and `disciplinary_scale_ref`
 * stay BLOCKED_MISSING_REFERENCE.
 *
 * Second-card (a second yellow → red) semantics are NOT specified by the spec:
 * §7 defines two INDEPENDENT accumulation thresholds, not a
 * yellow-accumulation-to-expulsion relationship. This module issues a caution
 * when the accumulated count reaches the yellow accumulation count and an
 * expulsion when it reaches the red accumulation count; it does NOT implement a
 * second-yellow-to-red rule. A direct red is likewise NOT an accumulation card:
 * it is the severity consequence and does not depend on the accumulated count.
 */

import { isFoulCandidatePayload } from "./foul-predicate.js";
import { FOUNDATION_TACKLE_V1 } from "./config/foundation.js";

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

/** A recognized foul whose committed contact severity reaches this normalized
 * value is a DIRECT expulsion (FOULS_CARDS_SPEC §7 / §9.1, `fouls-v1`,
 * VERSIONED_PROVISIONAL — NOT a measured PES 2017 constant). */
export const FOUL_CARD_DIRECT_RED_SEVERITY_THRESHOLD = 0.85;

/**
 * The widest committed challenge reach the accepted tackle machinery produces
 * (`foundation-tackle-v1` slideReach 2.8 m): the normalization scale for the
 * "hard challenge" severity facet. Read from the versioned provisional config,
 * never hard-coded.
 */
const MAX_COMMITTED_TACKLE_REACH = FOUNDATION_TACKLE_V1.slideReach.value;

/**
 * The committed-span fraction of each tackle kind — the "hard challenge" facet
 * of the severity normalization. The sliding lunge commits the full versioned
 * slide reach (2.8 m); the standing challenge commits the versioned standing
 * reach (1.6 m). Both are read from `foundation-tackle-v1`; the fractions are
 * VERSIONED_PROVISIONAL design values, NOT PES magnitudes.
 */
const CHALLENGE_SPAN_FRACTION: Readonly<Record<string, number>> = {
  "slide-tackle": FOUNDATION_TACKLE_V1.slideReach.value / MAX_COMMITTED_TACKLE_REACH,
  "standing-tackle": FOUNDATION_TACKLE_V1.standingReach.value / MAX_COMMITTED_TACKLE_REACH,
};

/** Clamp a value into [0, 1]. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * The normalized COMMITTED contact severity of a recognized man-not-ball tackle
 * contact, in [0, 1] (FOULS_CARDS_SPEC §7, `fouls-v1` VERSIONED_PROVISIONAL
 * design — NOT a PES magnitude). Reads only committed tackle-contact fields:
 *
 *   hard  = CHALLENGE_SPAN_FRACTION[contactType]  (the committed challenge span)
 *   solid = clamp01((reach − planarDistance) / reach)  (the contact penetration)
 *   severity = clamp01((hard + solid) / 2)
 *
 * Returns 0 when the payload is not a recognized §5.1 man-not-ball tackle
 * contact or its committed geometry is missing/non-finite, so a clean tackle, a
 * symmetric shoulder contact, or a malformed payload can never score severity.
 * The two facets are weighted equally; no other committed fact (contact speed,
 * ball-play timing) is serialized by the accepted tackle event, so no such
 * envelope is invented.
 */
export function foulContactSeverity(contact: Record<string, unknown>): number {
  if (!isFoulCandidatePayload(contact)) return 0;
  const hard = CHALLENGE_SPAN_FRACTION[contact.contactType as string] ?? 0;
  const reach = typeof contact.reach === "number" ? contact.reach : NaN;
  const planarDistance =
    typeof contact.planarDistance === "number" ? contact.planarDistance : NaN;
  if (!Number.isFinite(reach) || reach <= 0) return 0;
  if (!Number.isFinite(planarDistance) || planarDistance < 0) return 0;
  const solid = clamp01((reach - planarDistance) / reach);
  return clamp01((hard + solid) / 2);
}

/**
 * The direct-red disposition of a recognized foul, or `null` when the committed
 * contact severity does not reach `FOUL_CARD_DIRECT_RED_SEVERITY_THRESHOLD`.
 * The severity is the shared `foulContactSeverity` normalization; the threshold
 * is the exported `fouls-v1` §9.1 value. A non-foul payload (clean tackle,
 * shoulder contact, malformed) yields `null`: severity is guarded by the shared
 * §5.1 predicate.
 */
export function resolveDirectRedForFoul(
  contact: Record<string, unknown>,
): "expulsion" | null {
  return foulContactSeverity(contact) >= FOUL_CARD_DIRECT_RED_SEVERITY_THRESHOLD
    ? "expulsion"
    : null;
}
