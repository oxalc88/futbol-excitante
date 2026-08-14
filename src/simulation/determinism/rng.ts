/**
 * @module @pes/simulation/determinism/rng
 *
 * Mulberry32 — a fast, seedable, deterministic PRNG.
 *
 * Algorithm: "Mulberry32" by Paul Hsieh (public domain).  Produces a
 * stream of uint32 values via 32-bit arithmetic only.  The algorithm
 * is deterministic given the same initial 32-bit seed.
 *
 * Bootstrap decision: `mulberry32-v1` (see BOOTSTRAP_PLAN §3).
 *
 * No `Math.random()` is used.  The PRNG is fully self-contained.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Serializable snapshot of the Mulberry32 PRNG state.
 *
 * The 32-bit `state` field is the internal seed / state word.  On
 * restore, the state must match the original construction arguments
 * for the PRNG to continue the same sequence.
 */
export interface Mulberry32State {
  algorithmId: "mulberry32-v1";
  seed: number; // original seed passed to create()
  state: number; // internal 32-bit state word
}

/**
 * A Mulberry32 PRNG instance.
 */
export interface Mulberry32 {
  algorithmId: "mulberry32-v1";
  nextUint32(): number;
  nextFloat01(): number;
  snapshot(): Mulberry32State;
  restore(state: Mulberry32State): Mulberry32;
}

// ---------------------------------------------------------------------------
// Mulberry32 implementation
// ---------------------------------------------------------------------------

/**
 * Create a new Mulberry32 PRNG instance with the given 32-bit seed.
 *
 * @param seed - A 32-bit unsigned integer seed (any number; will be
 *   coerced to uint32 via `>>> 0`).
 * @returns A PRNG instance implementing `nextUint32`, `nextFloat01`,
 *   `snapshot()`, and `restore()`.
 */
export function createMulberry32(seed: number): Mulberry32 {
  let s: number = (seed >>> 0) | 0;

  /**
   * Advance state and produce one 32-bit output.
   *
   * The algorithm mutates the internal state word, adds a constant,
   * then applies three multiply-XOR stages.
   *
   * Implementation notes:
   * - `| 0` coerces to signed 32-bit for bitwise ops.
   * - `>>> 0` converts back to unsigned for the return value.
   * - `Math.imul` handles 32×32 → 64-bit multiply correctly.
   */
  function nextUint32(): number {
    s |= 0; // signed 32-bit for bitwise arithmetic
    // Add constant to state first (canonical Mulberry32 order per Paul Hsieh)
    s += 0x6d2b79f5;
    s |= 0;
    let t = s;
    // Stage 1
    t = Math.imul(t ^ (t >>> 15), t | 1);
    // Stage 2
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    // Return as unsigned 32-bit
    return (t ^ (t >>> 14)) >>> 0;
  }

  /**
   * Returns the next pseudo-random value in the range [0, 1).
   *
   * Computed as `nextUint32() / 2^32`.  This maps the full uint32 range
   * to the half-open interval [0, 1) in a one-to-one fashion (up to
   * floating-point precision).
   */
  function nextFloat01(): number {
    return nextUint32() / 4294967296; // 2^32
  }

  /**
   * Returns a serializable snapshot of the current PRNG state.
   * Restoring from this snapshot continues the sequence deterministically.
   */
  function snapshot(): Mulberry32State {
    return {
      algorithmId: "mulberry32-v1",
      seed: (seed >>> 0) | 0,
      state: s >>> 0,
    };
  }

  /**
   * Restore PRNG from a previously captured snapshot.
   *
   * @param state - A `Mulberry32State` produced by `snapshot()`.
   * @returns `this` for chaining.
   *
   * After restore, the next call to `nextUint32()` / `nextFloat01()`
   * continues the exact same sequence as if `snapshot()` had been called
   * at that point.
   */
  function restore(state: Mulberry32State): Mulberry32 {
    if (state.algorithmId !== "mulberry32-v1") {
      throw new TypeError(
        `Cannot restore: expected algorithm "mulberry32-v1", got "${state.algorithmId}"`,
      );
    }
    s = state.state >>> 0;
    return {
      algorithmId: "mulberry32-v1",
      nextUint32,
      nextFloat01,
      snapshot,
      restore,
    };
  }

  return {
    algorithmId: "mulberry32-v1",
    nextUint32,
    nextFloat01,
    snapshot,
    restore,
  };
}