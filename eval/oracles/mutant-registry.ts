/**
 * @module eval/oracles/mutant-registry
 *
 * Registry of mutant scenarios for the MUTANT_CORE evaluation.
 *
 * Implementable mutants (executable with existing oracles):
 *   - non-finite:       inject NaN/Infinity → finite-number oracle
 *   - prng-order:        snapshot/mutate PRNG state mid-run → PRNG-order oracle
 *   - velocity-snap:     inject huge velocity/heading delta → velocity-snap oracle
 *   - ball-no-decay:     freeze ball velocity on ground-roll → ball-decay oracle
 *   - ball-teleport:     jump ball position macroscopically → ball-teleport oracle
 *   - possession-no-evidence: change lastTouchRef without touch event → possession-evidence oracle
 *   - camera-hash:       corrupt observationCoreHash → camera-hash oracle
 *   - score-tracker:     goal event missing or incorrectly attributed → score-tracker oracle
 *   - match-clock:       tick sequence non-sequential → match-clock oracle
 *
 * Deferred mutants (NOT_EVALUATED until their spec exists):
 *   - impossible-contact: contact spec does not exist
 *   - every-defender-chasing: team AI / tactics spec does not exist
 *   - transition-skipped:  phase machine spec does not exist
 *
 * No Math.random, Date, performance, DOM, or Node I/O.
 */

/**
 * A mutation definition for the MUTANT_CORE reduction.
 *
 * @property oracleId    — the registered oracle that detects this mutation.
 * @property oracleVersion — version of that oracle.
 * @property deferred  — if true, the mutant cannot be evaluated yet.
 */
export interface MutationDefinition {
  id: string;
  description: string;
  oracleId: string;
  oracleVersion: string;
  deferred: boolean;
}

/**
 * All implementable mutations (deferred: false).
 *
 * These are listed in the order required by the evaluation spec:
 * non-finite → PRNG-order → velocity/heading snap → ball decay →
 * ball teleport → possession without evidence → camera-hash.
 */
export const IMPLEMENTABLE_MUTANTS: ReadonlyArray<MutationDefinition> =
  Object.freeze([
    {
      id: "non-finite",
      description: "Non-finite state value injected into a player or ball field",
      oracleId: "finite-number",
      oracleVersion: "oracle-finite-v1",
      deferred: false,
    },
    {
      id: "prng-order",
      description: "PRNG state mutated mid-run producing divergent trajectory",
      oracleId: "prng-order",
      oracleVersion: "oracle-prng-order-v1",
      deferred: false,
    },
    {
      id: "velocity-snap",
      description:
        "Instantaneous velocity or body-heading snap between consecutive ticks",
      oracleId: "velocity-snap",
      oracleVersion: "oracle-velocity-snap-v1",
      deferred: false,
    },
    {
      id: "ball-no-decay",
      description:
        "Ball ground-roll with constant non-zero velocity (decay disabled)",
      oracleId: "ball-decay",
      oracleVersion: "oracle-ball-decay-v1",
      deferred: false,
    },
    {
      id: "ball-teleport",
      description: "Ball position changes by a macroscopic amount (parenting / teleport)",
      oracleId: "ball-teleport",
      oracleVersion: "oracle-ball-teleport-v1",
      deferred: false,
    },
    {
      id: "possession-no-evidence",
      description:
        "lastTouchRef changes without a corresponding touch event",
      oracleId: "possession-evidence",
      oracleVersion: "oracle-possession-v1",
      deferred: false,
    },
    {
      id: "camera-hash",
      description:
        "observationCoreHash mismatch — presentation/camera mutation affecting core hash",
      oracleId: "camera-hash",
      oracleVersion: "oracle-camera-v1",
      deferred: false,
    },
    {
      id: "score-tracker",
      description: "Goal event missing or incorrectly attributed",
      oracleId: "score-tracker",
      oracleVersion: "oracle-score-tracker-v1",
      deferred: false,
    },
    {
      id: "match-clock",
      description: "Tick sequence non-sequential",
      oracleId: "match-clock",
      oracleVersion: "oracle-match-clock-v1",
      deferred: false,
    },
  ] as const);