/**
 * @module eval/oracles/deferred-mutants
 *
 * Registry of mutant scenarios that cannot be evaluated until their
 * dedicated specs and oracles are defined.  These mutants are
 * intentionally excluded from evaluation and always return NOT_EVALUATED
 * rather than PASS or FAIL.
 *
 * This registry is versioned so that future additions are tracked.
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

import type { InvariantResult } from "../../src/contracts/telemetry.js";

/**
 * A deferred-mutant entry.  Each entry describes a mutant scenario
 * that cannot be evaluated because its underlying spec does not yet
 * exist.
 */
export interface DeferredMutant {
  id: string;
  description: string;
  reason: string;
}

/**
 * Versioned registry of deferred mutants.
 *
 * Schema: deferred-mutants-v1 — an immutable array of deferred-mutant entries.
 *
 * Tests MUST assert that the oracle returns NOT_EVALUATED for every
 * entry in this registry and that the registry itself is non-empty.
 */
export const DEFERRED_MUTANTS_V1: ReadonlyArray<DeferredMutant> = Object.freeze([
  {
    id: "impossible-contact",
    description: "A tackle that passes through two players to a goalkeeper without contact",
    reason:
      "Contact mechanics spec does not yet exist; no oracle can evaluate impossible contact detection.",
  },
  {
    id: "every-defender-chasing",
    description: "All opposing defenders converge on the ball simultaneously (team AI behavior)",
    reason:
      "Team tactics / AI behavior spec does not yet exist; no oracle can evaluate team behavior.",
  },
  {
    id: "transition-skipped",
    description: "A team skips from defense directly to attack without a transition phase",
    reason:
      "Phase machine spec does not yet exist; no oracle can evaluate tactical transitions.",
  },
]);

/**
 * Execute the deferred-mutants oracle: return NOT_EVALUATED for every
 * registered mutant.  The oracle always returns not_evaluated, ensuring
 * the test asserts that no mutant is treated as a pass or fail.
 *
 * This oracle never returns PASS or FAIL.  It proves that deferred mutants
 * are explicitly catalogued and excluded from evaluation.
 *
 * @returns InvariantResult (status: not_evaluated, listing all deferred mutant IDs).
 */
export function checkDeferredMutants(): InvariantResult {
  const ids = DEFERRED_MUTANTS_V1.map((m) => m.id);
  return {
    id: "deferred-mutants-not-evaluated",
    status: "not_evaluated",
    description: `${DEFERRED_MUTANTS_V1.length} deferred mutant(s) cannot be evaluated: ${ids.join(", ")}`,
    details: {
      registryVersion: "deferred-mutants-v1",
      mutantCount: DEFERRED_MUTANTS_V1.length,
      mutantIds: ids,
      allEvaluated: false,
    },
  };
}