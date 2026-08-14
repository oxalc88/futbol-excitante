/**
 * @module @pes/simulation/determinism/canonical
 *
 * Canonical JSON encoding (bootstrap variant: `canonical-json-v1`).
 *
 * Guarantees:
 * - Field / key order: sorted lexicographically by key name (recursively).
 * - Array order: preserved as-is (arrays are ordered collections; keys
 *   within objects are sorted, but arrays are not sorted).
 * - String encoding: JSON-escaped per RFC 8259. ASCII strings are
 *   emitted verbatim (except for control characters, `"`, and `\`).
 *   Non-BMP Unicode is encoded via surrogate pairs (`\uXXXX`).
 * - Numeric encoding: finite numbers use their JS `Number` representation;
 *   `-0` is kept as `-0` (no sign-flip); NaN and ±Infinity are rejected.
 * - Special numbers: NaN, +Infinity, -Infinity cause the encode call
 *   to throw `TypeError` (fail-closed policy).
 * - Schema version: the top-level value must be a plain object with a
 *   `schemaVersion` string field.
 *
 * Bootstrap decision: `canonical-json-v1` (see BOOTSTRAP_PLAN §3).
 */

import { ensureFinite, isFiniteNumber } from "./finite.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Result of a canonical encode attempt that encounters a non-finite or
 * non-serializable value.  The error is structured so callers can inspect
 * the path and the offending value.
 */
export interface CanonicalEncodeError {
  path: string;
  value: unknown;
  reason: string;
}

/**
 * Possible error types for canonical encoding.
 */
export type CanonicalEncodeFailReason =
  | "non-finite-number"
  | "object-without-schema-version"
  | "unsupported-type";

/**
 * A structured error for canonical encoding failures.
 */
export interface CanonicalEncodeErrorResult {
  ok: false;
  reason: CanonicalEncodeFailReason;
  path: string;
  value: unknown;
  details: string;
}

/**
 * Successful canonical encoding result.
 */
export interface CanonicalEncodeSuccess {
  ok: true;
  value: string; // canonical JSON string
}

export type CanonicalEncodeResult =
  | CanonicalEncodeSuccess
  | CanonicalEncodeErrorResult;

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/**
 * Encode a value to canonical JSON form.
 *
 * Throws `TypeError` with a descriptive message on any failure.
 *
 * @param value - The value to encode.  Must be a plain object with a
 *   `schemaVersion` property.
 * @returns Canonical JSON string.
 * @throws TypeError when the value is non-finite, contains NaN/Infinity,
 *   is non-object, or is otherwise non-serializable.
 */
export function encodeCanonical(value: unknown): string {
  // Top-level must be a plain object with schemaVersion
  if (
    value === null ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    typeof (value as Record<string, unknown>)["schemaVersion"] !== "string"
  ) {
    throw new TypeError(
      `Top-level value must be a plain object with a string schemaVersion field, got ${typeof value}`,
    );
  }

  const errors: string[] = [];
  ensureFinite(value, "$root", errors);
  if (errors.length > 0) {
    throw new TypeError(
      `Non-finite value in canonical encoding:\n${errors.join("\n")}`,
    );
  }
  return internalEncode(value, "$root");
}

/**
 * Encode with structured error reporting (does not throw).
 *
 * @param value - The value to encode.
 * @returns Success result with the canonical string, or a structured
 *   failure explaining why encoding was impossible.
 */
export function encodeCanonicalSafe(value: unknown): CanonicalEncodeResult {
  // Check schemaVersion first
  if (
    value === null ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    typeof (value as Record<string, unknown>)["schemaVersion"] !== "string"
  ) {
    return {
      ok: false,
      reason: "object-without-schema-version",
      path: "$root",
      value,
      details:
        "Top-level value must be a plain object with a string schemaVersion field",
    };
  }

  const errors: string[] = [];
  ensureFinite(value, "$root", errors);
  if (errors.length > 0) {
    const err = errors[0];
    const pathMatch = err.match(/^(\$\S*?):/);
    const path = pathMatch ? pathMatch[1] : "$root";
    return {
      ok: false,
      reason: "non-finite-number",
      path,
      value: extractValueAtPath(value, path),
      details: err,
    };
  }
  return { ok: true, value: internalEncode(value, "$root") };
}

/**
 * Internal recursive encoder.  Only used after pre-validation.
 */
function internalEncode(value: unknown, path: string): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path}: non-finite number ${String(value)}`);
    }
    // Preserve -0: JS String(-0) returns "0", so we check explicitly.
    if (Object.is(value, -0)) return "-0";
    return String(value);
  }
  if (typeof value === "string") {
    return jsonStringify(value);
  }
  if (typeof value === "bigint") {
    throw new TypeError(`${path}: bigint not supported in canonical encoding`);
  }
  if (Array.isArray(value)) {
    return encodeArray(value, path);
  }
  if (typeof value === "object") {
    return encodeObject(value as Record<string, unknown>, path);
  }
  throw new TypeError(`${path}: unsupported type ${typeof value}`);
}

/**
 * Encode an array: preserve order, recursively encode elements.
 */
function encodeArray(arr: unknown[], path: string): string {
  if (arr.length === 0) return "[]";
  const parts: string[] = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    parts[i] = internalEncode(arr[i], `${path}[${i}]`);
  }
  return "[" + parts.join(",") + "]";
}

/**
 * Encode a plain object: keys are sorted lexicographically, then
 * key-value pairs are emitted in that sorted order.  Values are
 * recursively encoded.
 */
function encodeObject(obj: Record<string, unknown>, path: string): string {
  const keys = Object.keys(obj).sort();
  if (keys.length === 0) return "{}";
  const parts: string[] = new Array(keys.length);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = obj[key];
    const encodedValue = internalEncode(value, `${path}.${key}`);
    parts[i] = jsonStringify(key) + ":" + encodedValue;
  }
  return "{" + parts.join(",") + "}";
}

/**
 * Encode a string to a JSON-safe string literal (with escaping).
 *
 * Control characters (< 0x20) and `"` / `\` are JSON-escaped.
 * Non-ASCII BMP characters are escaped as `\uXXXX`.
 * Supplementary-plane characters use surrogate pairs.
 * ASCII printable characters (0x20–0x7F) are emitted verbatim.
 */
function jsonStringify(s: string): string {
  let result = '"';
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    // Check for surrogate pair
    let cp: number;
    if (ch >= 0xd800 && ch <= 0xdbff && i + 1 < s.length) {
      const second = s.charCodeAt(i + 1);
      if (second >= 0xdc00 && second <= 0xdfff) {
        cp = ((ch - 0xd800) << 10) + (second - 0xdc00) + 0x10000;
        i++;
      } else {
        cp = ch;
      }
    } else {
      cp = ch;
    }

    // Control characters must be escaped
    if (cp < 0x20) {
      switch (cp) {
        case 0x08:
          result += "\\b";
          break;
        case 0x09:
          result += "\\t";
          break;
        case 0x0a:
          result += "\\n";
          break;
        case 0x0c:
          result += "\\f";
          break;
        case 0x0d:
          result += "\\r";
          break;
        default:
          result += "\\u" + pad4(cp);
          break;
      }
    } else if (cp === 0x22 || cp === 0x5c) {
      // " and \
      result += "\\" + String.fromCharCode(cp);
    } else if (cp >= 0x10000) {
      // Supplementary planes — surrogate pairs (RFC 8259)
      cp -= 0x10000;
      const hi = 0xd800 + ((cp >> 10) & 0x3ff);
      const lo = 0xdc00 + (cp & 0x3ff);
      result += "\\u" + hi.toString(16).padStart(4, "0");
      result += "\\u" + lo.toString(16).padStart(4, "0");
    } else if (cp >= 0x80) {
      // Non-ASCII BMP: escape to \uXXXX for ASCII-only output
      result += "\\u" + cp.toString(16).padStart(4, "0");
    } else {
      // ASCII printable (0x20-0x7F, excluding '"' and '\' already handled)
      result += String.fromCharCode(cp);
    }
  }
  result += '"';
  return result;
}

function pad4(n: number): string {
  return n.toString(16).padStart(4, "0");
}

/**
 * Extract a value at a dot-notation path for error reporting.
 * Minimal — only for error context, not a full implementation.
 */
function extractValueAtPath(obj: unknown, path: string): unknown {
  if (path === "$root") return obj;
  const segments = path
    .replace(/^\$/, "")
    .split(".")
    .map((seg) => seg.replace(/^(\[\d+\])$/, "$1"));
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || typeof current !== "object") return undefined;
    if (seg.startsWith("[") && seg.endsWith("]")) {
      const idx = parseInt(seg.slice(1, -1), 10);
      current = (current as unknown[])[idx];
    } else {
      current = (current as Record<string, unknown>)[seg];
    }
  }
  return current;
}