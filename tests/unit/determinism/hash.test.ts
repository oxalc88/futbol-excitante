/**
 * FNV-1a 64-bit hash tests (`fnv1a64-v1`).
 *
 * Validates known-vector determinism, mutation sensitivity,
 * semantic identity across insertion order, and correct prefix.
 */
import { describe, it, expect } from "vitest";
import { hashFnv1a64 } from "../../../src/simulation/determinism/hash.js";
import { encodeCanonical } from "../../../src/simulation/determinism/canonical.js";

// ---------------------------------------------------------------------------
// Known-vector and determinism
// ---------------------------------------------------------------------------

describe("HASH-KNOWN-VECTOR-001: hash is deterministic", () => {
  it("identical input produces identical hash", () => {
    const input = JSON.stringify({ schemaVersion: "1", a: 1, b: 2 });
    const h1 = hashFnv1a64(input);
    const h2 = hashFnv1a64(input);
    expect(h1).toBe(h2);
  });

  it('empty string produces correct FNV-1a 64-bit digest', () => {
    expect(hashFnv1a64("")).toBe("fnv1a64-v1:cbf29ce484222325");
  });

  it('input "a" produces correct FNV-1a 64-bit digest', () => {
    expect(hashFnv1a64("a")).toBe("fnv1a64-v1:af63dc4c8601ec8c");
  });
});

// ---------------------------------------------------------------------------
// Correct prefix
// ---------------------------------------------------------------------------

describe("HASH-PREFIX-001: output includes algorithm ID", () => {
  it("hash starts with fnv1a64-v1:", () => {
    const h = hashFnv1a64("test");
    expect(h).toMatch(/^fnv1a64-v1:/);
  });
});

// ---------------------------------------------------------------------------
// Mutation sensitivity
// ---------------------------------------------------------------------------

describe("HASH-MUTATION-001: changing input changes hash", () => {
  it("changing a value changes the hash", () => {
    const a = hashFnv1a64(JSON.stringify({ schemaVersion: "1", value: 42 }));
    const b = hashFnv1a64(JSON.stringify({ schemaVersion: "1", value: 43 }));
    expect(a).not.toBe(b);
  });

  it("changing a key changes the hash", () => {
    const a = hashFnv1a64(JSON.stringify({ schemaVersion: "1", name: "test" }));
    const b = hashFnv1a64(JSON.stringify({ schemaVersion: "1", name: "other" }));
    expect(a).not.toBe(b);
  });

  it("adding a field changes the hash", () => {
    const a = hashFnv1a64(JSON.stringify({ schemaVersion: "1", a: 1 }));
    const b = hashFnv1a64(JSON.stringify({ schemaVersion: "1", a: 1, b: 2 }));
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Semantic identity across insertion order
// ---------------------------------------------------------------------------

describe("HASH-SEMANTIC-IDENTITY-001: semantically identical values hash identically", () => {
  it("same object, different insertion order produces same hash", () => {
    const inputA = encodeCanonical({ schemaVersion: "1", zebra: 3, alpha: 1, beta: 2 });
    const inputB = encodeCanonical({ schemaVersion: "1", alpha: 1, zebra: 3, beta: 2 });
    expect(hashFnv1a64(inputA)).toBe(hashFnv1a64(inputB));
  });

  it("same nested object, different insertion order produces same hash", () => {
    const inputA = encodeCanonical({
      schemaVersion: "1",
      data: { z: 1, a: 2 },
    });
    const inputB = encodeCanonical({
      schemaVersion: "1",
      data: { a: 2, z: 1 },
    });
    expect(hashFnv1a64(inputA)).toBe(hashFnv1a64(inputB));
  });
});