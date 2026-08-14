/**
 * @module @pes/simulation/determinism/utf8
 *
 * Pure-TypeScript UTF-8 encoder — no `TextEncoder`, no `Buffer`.
 *
 * This keeps the simulation core (and its determinism layer) free of
 * Node.js or browser global dependencies, satisfying the requirement
 * that `src/simulation/**` be DOM/Node free.
 *
 * Algorithm: RFC 3629 / Unicode Standard 15.0 encoding rules.
 */

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

/**
 * Encode a JavaScript string to its UTF-8 byte representation.
 *
 * Uses only the ECMAScript `String.prototype.charCodeAt` and native
 * bitwise operations — no external APIs.
 *
 * @param str - The string to encode.
 * @returns A `Uint8Array` of UTF-8 encoded bytes.
 */
export function encodeUtf8(str: string): Uint8Array {
  // Pre-calculate byte length so we allocate exactly once.
  let byteLength = 0;
  for (let i = 0; i < str.length; i++) {
    const cp = codePointAt(str, i);
    byteLength += encodedLength(cp);
    // High surrogate: codePointAt already included the following low surrogate.
    if (str.charCodeAt(i) >= 0xd800 && str.charCodeAt(i) <= 0xdbff) {
      i++;
    }
  }

  const out = new Uint8Array(byteLength);
  let idx = 0;
  for (let i = 0; i < str.length; i++) {
    const cp = codePointAt(str, i);
    idx += writeCodePoint(out, idx, cp);
    // High surrogate: codePointAt already included the following low surrogate.
    if (str.charCodeAt(i) >= 0xd800 && str.charCodeAt(i) <= 0xdbff) {
      i++;
    }
  }
  return out;
}

/**
 * Extract the full Unicode code point starting at position `i` in
 * `str`, advancing `i` across surrogate pairs when present.
 * Returns `{ codePoint, nextIndex }`.
 */
function codePointAt(str: string, i: number): number {
  const first = str.charCodeAt(i);
  if (first >= 0xd800 && first <= 0xdbff && i + 1 < str.length) {
    const second = str.charCodeAt(i + 1);
    if (second >= 0xdc00 && second <= 0xdfff) {
      return ((first - 0xd800) << 10) + (second - 0xdc00) + 0x10000;
    }
  }
  return first;
}

/**
 * How many UTF-8 bytes does `codePoint` require?
 */
function encodedLength(cp: number): number {
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

/**
 * Write one UTF-8 encoded code point into `buf` starting at `offset`.
 * Returns the number of bytes written.
 */
function writeCodePoint(buf: Uint8Array, offset: number, cp: number): number {
  if (cp < 0x80) {
    buf[offset] = cp;
    return 1;
  }
  if (cp < 0x800) {
    buf[offset] = 0xc0 | (cp >> 6);
    buf[offset + 1] = 0x80 | (cp & 0x3f);
    return 2;
  }
  if (cp < 0x10000) {
    buf[offset] = 0xe0 | (cp >> 12);
    buf[offset + 1] = 0x80 | ((cp >> 6) & 0x3f);
    buf[offset + 2] = 0x80 | (cp & 0x3f);
    return 3;
  }
  // cp < 0x110000 (valid Unicode range)
  buf[offset] = 0xf0 | (cp >> 18);
  buf[offset + 1] = 0x80 | ((cp >> 12) & 0x3f);
  buf[offset + 2] = 0x80 | ((cp >> 6) & 0x3f);
  buf[offset + 3] = 0x80 | (cp & 0x3f);
  return 4;
}