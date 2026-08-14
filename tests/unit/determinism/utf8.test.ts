/**
 * UTF-8 encoding tests.
 *
 * Validates RFC 3629 compliance: ASCII, BMP, and surrogate-pair
 * code points all encode to their correct byte sequences.
 */
import { describe, it, expect } from "vitest";
import { encodeUtf8 } from "../../../src/simulation/determinism/utf8.js";

// ---------------------------------------------------------------------------
// ASCII
// ---------------------------------------------------------------------------

describe("UTF8-ASCII-001: ASCII bytes pass through", () => {
  it("encodes 'a' to a single byte", () => {
    expect([...encodeUtf8("a")]).toEqual([0x61]);
  });

  it('encodes "Hello" to 5 bytes', () => {
    expect([...encodeUtf8("Hello")]).toEqual([
      0x48, 0x65, 0x6c, 0x6c, 0x6f,
    ]);
  });
});

// ---------------------------------------------------------------------------
// BMP (3-byte)
// ---------------------------------------------------------------------------

describe("UTF8-BMP-001: BMP characters encode to 3 bytes", () => {
  it('encodes "é" (U+00E9) to c3 a9', () => {
    expect([...encodeUtf8("é")]).toEqual([0xc3, 0xa9]);
  });
});

// ---------------------------------------------------------------------------
// Supplementary planes — surrogate pairs (4-byte)
// ---------------------------------------------------------------------------

describe("UTF8-SURROGATE-001: surrogate pairs encode as single code point", () => {
  it('encodes "😀" (U+1F600) to f0 9f 98 80', () => {
    expect([...encodeUtf8("😀")]).toEqual([
      0xf0, 0x9f, 0x98, 0x80,
    ]);
  });

  it('encodes "😀a" as 4 bytes + 1 byte', () => {
    expect([...encodeUtf8("😀a")]).toEqual([
      0xf0, 0x9f, 0x98, 0x80, 0x61,
    ]);
  });
});