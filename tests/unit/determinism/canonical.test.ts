/**
 * Canonical JSON encoding tests (`canonical-json-v1`).
 *
 * Covers: golden serialization, reordered keys, stable player order,
 * -0 handling, escaped Unicode, NaN/Infinity fail-closed, and object
 * type validation.
 */
import { describe, it, expect } from "vitest";
import {
  encodeCanonical,
  encodeCanonicalSafe,
} from "../../../src/simulation/determinism/canonical.js";

// ---------------------------------------------------------------------------
// Golden test: basic object with schemaVersion
// ---------------------------------------------------------------------------

describe("CANONICAL-GOLDEN-001: basic object encodes correctly", () => {
  it("encodes a simple schema + fields", () => {
    const obj = {
      schemaVersion: "1",
      name: "test",
      count: 42,
    };
    const result = encodeCanonical(obj);
    // Keys must be sorted: count, name, schemaVersion
    expect(result).toBe('{"count":42,"name":"test","schemaVersion":"1"}');
  });
});

// ---------------------------------------------------------------------------
// Sorted keys test
// ---------------------------------------------------------------------------

describe("CANONICAL-SORTED-KEYS-001: object keys are sorted lexicographically", () => {
  it("deeply nested keys are sorted at each level", () => {
    const obj = {
      schemaVersion: "v1",
      zebra: { nested: "deep" },
      alpha: { nested: "deep" },
      numbers: { a: 1, z: 2, m: 3 },
    };
    const result = encodeCanonical(obj);
    // Top-level: alpha, numbers, schemaVersion, zebra
    // nested level: nested
    // numbers level: a, m, z
    expect(result).toBe(
      '{"alpha":{"nested":"deep"},"numbers":{"a":1,"m":3,"z":2},"schemaVersion":"v1","zebra":{"nested":"deep"}}',
    );
  });
});

// ---------------------------------------------------------------------------
// Reordered keys: semantically identical objects encode identically
// ---------------------------------------------------------------------------

describe("CANONICAL-REORDER-001: insertion order does not affect output", () => {
  function testReorder(a: Record<string, unknown>, b: Record<string, unknown>) {
    expect(encodeCanonical({ schemaVersion: "v1", ...a })).toBe(
      encodeCanonical({ schemaVersion: "v1", ...b }),
    );
  }

  it("two insertions orders of same keys", () => {
    testReorder(
      { z: 1, a: 2, m: 3 },
      { a: 2, m: 3, z: 1 },
    );
  });

  it("nested objects with same keys different insertion order", () => {
    testReorder(
      { outer: { z: 1, a: 2 } },
      { outer: { a: 2, z: 1 } },
    );
  });
});

// ---------------------------------------------------------------------------
// Stable player order (arrays preserved, not sorted)
// ---------------------------------------------------------------------------

describe("CANONICAL-ARRAY-ORDER-001: array order is preserved", () => {
  it("players in different order produce different canonical output", () => {
    const a = {
      schemaVersion: "v1",
      players: [
        { playerId: "p-1" },
        { playerId: "p-2" },
      ],
    };
    const b = {
      schemaVersion: "v1",
      players: [
        { playerId: "p-2" },
        { playerId: "p-1" },
      ],
    };
    expect(encodeCanonical(a)).not.toBe(encodeCanonical(b));
  });

  it("same array order produces same output", () => {
    const arr = { playerId: "p-1" };
    const a = { schemaVersion: "v1", players: [arr, arr] };
    const b = { schemaVersion: "v1", players: [arr, arr] };
    expect(encodeCanonical(a)).toBe(encodeCanonical(b));
  });
});

// ---------------------------------------------------------------------------
// -0 handling
// ---------------------------------------------------------------------------

describe("CANONICAL-MINUS-ZERO-001: -0 is preserved as -0", () => {
  it("does not silently convert -0 to +0", () => {
    const obj = { schemaVersion: "v1", value: -0 as unknown as number };
    const result = encodeCanonical(obj);
    // JSON.stringify preserves -0 as -0 in string form
    expect(result).toContain("-0");
  });
});

// ---------------------------------------------------------------------------
// Escaped Unicode
// ---------------------------------------------------------------------------

describe("CANONICAL-ESCAPE-UNICODE-001: Unicode is properly escaped", () => {
  it("non-ASCII characters are escaped to \\uXXXX", () => {
    const obj = { schemaVersion: "v1", name: "café" };
    const result = encodeCanonical(obj);
    expect(result).toContain("\\u00e9");
  });

  it("emoji is encoded via surrogate pairs", () => {
    const obj = { schemaVersion: "v1", emoji: "😀" };
    const result = encodeCanonical(obj);
    // 😀 = U+1F600 → surrogate pair: D83D DE00
    expect(result).toContain("\\ud83d");
    expect(result).toContain("\\ude00");
  });

  it("control characters are escaped", () => {
    const obj = { schemaVersion: "v1", text: "line1\nline2" };
    const result = encodeCanonical(obj);
    expect(result).toContain("\\n");
  });
});

// ---------------------------------------------------------------------------
// NaN / Infinity fail-closed
// ---------------------------------------------------------------------------

describe("CANONICAL-FAIL-CLOSED-001: NaN and Infinity throw", () => {
  it("NaN throws TypeError", () => {
    const obj = { schemaVersion: "v1", value: NaN };
    expect(() => encodeCanonical(obj)).toThrow(TypeError);
  });

  it("+Infinity throws TypeError", () => {
    const obj = { schemaVersion: "v1", value: Infinity };
    expect(() => encodeCanonical(obj)).toThrow(TypeError);
  });

  it("-Infinity throws TypeError", () => {
    const obj = { schemaVersion: "v1", value: -Infinity };
    expect(() => encodeCanonical(obj)).toThrow(TypeError);
  });

  it("NaN inside nested object throws", () => {
    const obj = { schemaVersion: "v1", nested: { value: NaN } };
    expect(() => encodeCanonical(obj)).toThrow(TypeError);
  });

  it("NaN inside array throws", () => {
    const obj = { schemaVersion: "v1", values: [1, NaN, 3] };
    expect(() => encodeCanonical(obj)).toThrow(TypeError);
  });

  it("encodeCanonicalSafe returns structured error for NaN", () => {
    const obj = { schemaVersion: "v1", value: NaN };
    const result = encodeCanonicalSafe(obj);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("non-finite-number");
    }
  });

  it("encodeCanonicalSafe returns structured error for missing schemaVersion", () => {
    const result = encodeCanonicalSafe({ name: "test" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("object-without-schema-version");
    }
  });
});

// ---------------------------------------------------------------------------
// Empty collections
// ---------------------------------------------------------------------------

describe("CANONICAL-EMPTY-001: empty collections encode correctly", () => {
  it("empty object", () => {
    expect(encodeCanonical({ schemaVersion: "v1", data: {} })).toBe(
      '{"data":{},"schemaVersion":"v1"}',
    );
  });

  it("empty array", () => {
    expect(encodeCanonical({ schemaVersion: "v1", data: [] })).toBe(
      '{"data":[],"schemaVersion":"v1"}',
    );
  });
});

// ---------------------------------------------------------------------------
// Non-object rejection
// ---------------------------------------------------------------------------

describe("CANONICAL-NON-OBJECT-001: non-objects are rejected", () => {
  it("string throws", () => {
    expect(() => encodeCanonical("hello")).toThrow();
  });

  it("number throws", () => {
    expect(() => encodeCanonical(42)).toThrow();
  });

  it("array throws", () => {
    expect(() => encodeCanonical([1, 2, 3])).toThrow();
  });
});