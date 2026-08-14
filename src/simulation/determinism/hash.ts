/**
 * @module @pes/simulation/determinism/hash
 *
 * FNV-1a 64-bit hash over UTF-8 encoded canonical data.
 *
 * Bootstrap decision: `fnv1a64-v1` (see BOOTSTRAP_PLAN §3).
 *
 * FNV-1a properties:
 * - Non-cryptographic (collision resistance is NOT claimed).
 * - Deterministic given identical byte input.
 * - Each byte is XOR'd with the hash, then the hash is multiplied
 *   by the FNV prime.
 *
 * The hash algorithm identifier and seed (if any) are embedded in
 * the output string so that consumers can verify provenance.
 */

import { encodeUtf8 } from "./utf8.js";

// FNV-1a 64-bit constants (uint64):
// offset_basis = 0xcbf29ce484222325 (exact, no float conversion)
// prime        = 1099511628211
const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 1099511628211;

// We represent 64-bit values as unsigned decimal strings to avoid JS
// 53-bit integer precision loss.  All arithmetic is done via BigInt
// and the final hash is returned as a hex string.

/**
 * Compute the FNV-1a 64-bit hash of a string.
 *
 * The output includes the algorithm identifier as a prefix so that
 * consumers can verify provenance: `fnv1a64-v1:<64-hex-digits>`.
 *
 * @param input - The string to hash (assumed to be canonical JSON).
 * @returns A hash string in the format `fnv1a64-v1:<hex>`.
 *
 * Known vector:
 * - `fnv1a64-v1:<empty-string-hash>` for input ""
 * - The algorithm is deterministic: same input always produces the same output.
 */
export function hashFnv1a64(input: string): string {
  const bytes = encodeUtf8(input);
  // Use BigInt for 64-bit arithmetic
  let hash: bigint = BigInt(FNV_OFFSET_BASIS);
  const MASK = (1n << 64n) - 1n; // 0xFFFFFFFFFFFFFFFF
  const prime = BigInt(FNV_PRIME);

  for (let i = 0; i < bytes.length; i++) {
    // XOR step
    hash ^= BigInt(bytes[i]);
    // Multiply step (mod 2^64)
    hash = (hash * prime) & MASK;
  }

  // Convert to 16-character lowercase hex
  const hex = hash.toString(16).padStart(16, "0");
  return "fnv1a64-v1:" + hex;
}