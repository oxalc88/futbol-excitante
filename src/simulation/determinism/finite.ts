/**
 * @module @pes/simulation/determinism/finite
 *
 * Finite-number validation for values that will be serialized or hashed.
 *
 * Rejects NaN, +Infinity, and -Infinity.  These values cannot be
 * round-tripped through canonical JSON or hashed reliably.
 */

// ---------------------------------------------------------------------------
// Numeric check
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the value is a finite number (not NaN, +∞, -∞).
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Throws `TypeError` when *any* value in the recursive structure is
 * non-finite.  Used by canonical encoding before serialization.
 */
export function ensureFinite(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (value === null || value === undefined) return;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      errors.push(`${path}: non-finite number ${String(value)}`);
    }
    return;
  }

  if (typeof value === "bigint") {
    // BigInts are always finite when coerced to number for hashing,
    // but we reject them to keep the schema strict.
    errors.push(`${path}: bigint not allowed in canonical serialization`);
    return;
  }

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        ensureFinite(value[i], `${path}[${i}]`, errors);
      }
    } else {
      for (const key of Object.keys(value as Record<string, unknown>)) {
        ensureFinite(
          (value as Record<string, unknown>)[key],
          `${path}.${key}`,
          errors,
        );
      }
    }
  }
  // strings, booleans — always finite
}

/**
 * Validates that a scalar value is a finite number, returning `true`
 * when valid.  For use in single-value guards.
 */
export function checkFinite(value: unknown): boolean {
  if (typeof value !== "number") return true;
  return Number.isFinite(value);
}