/**
 * @module @pes/simulation/determinism
 *
 * Reproducibility substrate: PRNG, canonical encoding, hashing, and
 * finite-number validation.
 *
 * All modules in this package are pure TypeScript with no dependencies
 * on DOM, Node.js, or any host runtime.
 */

export { createMulberry32, type Mulberry32State } from "./rng.js";
export {
  encodeCanonical,
  encodeCanonicalSafe,
  type CanonicalEncodeSuccess,
  type CanonicalEncodeErrorResult,
  type CanonicalEncodeResult,
} from "./canonical.js";
export { encodeUtf8 } from "./utf8.js";
export { hashFnv1a64 } from "./hash.js";
export {
  isFiniteNumber,
  ensureFinite,
  checkFinite,
} from "./finite.js";