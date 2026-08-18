import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { inspectPngSanity } from "../gauntlet/evals/src/screenshot-sanity.js";

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  // CRC bytes are intentionally zero; the deterministic decoder does not use CRC.
  return out;
}

function rgbaPng(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset++] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = pixel(x, y);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("BLANK-SCREENSHOT-REJECTED", () => {
  it("rejects an all-white PNG", () => {
    const result = inspectPngSanity(rgbaPng(32, 32, () => [255, 255, 255, 255]));
    expect(result.pass).toBe(false);
  });

  it("rejects an all-black PNG", () => {
    const result = inspectPngSanity(rgbaPng(32, 32, () => [0, 0, 0, 255]));
    expect(result.pass).toBe(false);
  });

  it("accepts a varied rendered-like scene", () => {
    const result = inspectPngSanity(rgbaPng(32, 32, (x, y) => {
      if (y < 8) return [80 + x * 3, 140, 220 - x * 2, 255];
      if ((x + y) % 5 === 0) return [245, 245, 245, 255];
      if (x < 16) return [25, 120 + (y % 8) * 8, 45, 255];
      return [150 + (x % 8) * 10, 45 + (y % 8) * 10, 35, 255];
    }));
    expect(result.pass).toBe(true);
    expect(result.distinct_color_buckets).toBeGreaterThanOrEqual(4);
  });
});
