import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { inflateSync } from "node:zlib";

export interface ScreenshotSanityResult {
  pass: boolean;
  format: string;
  width?: number;
  height?: number;
  luminance_mean?: number;
  luminance_stddev?: number;
  luminance_range?: number;
  distinct_color_buckets?: number;
  detail?: string;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(bytes: Uint8Array): { width: number; height: number; pixels: Uint8Array; channels: number } {
  const buf = Buffer.from(bytes);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buf.length < 33 || !buf.subarray(0, 8).equals(signature)) throw new Error("invalid PNG signature");

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  const idat: Buffer[] = [];

  while (offset + 12 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buf.length) throw new Error("truncated PNG chunk");
    const data = buf.subarray(dataStart, dataEnd);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? -1;
      interlace = data[12] ?? -1;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    offset = dataEnd + 4;
  }

  if (width < 1 || height < 1) throw new Error("invalid PNG dimensions");
  if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${bitDepth}`);
  if (interlace !== 0) throw new Error("interlaced PNG is not supported by deterministic sanity gate");
  const channelsByType: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };
  const channels = channelsByType[colorType];
  if (!channels) throw new Error(`unsupported PNG color type ${colorType}`);
  if (idat.length === 0) throw new Error("PNG has no IDAT data");

  const inflated = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const expected = height * (stride + 1);
  if (inflated.length < expected) throw new Error("truncated PNG scanlines");

  const pixels = new Uint8Array(width * height * channels);
  let src = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src++] ?? 255;
    const rowStart = y * stride;
    const prevStart = (y - 1) * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[src++] ?? 0;
      const left = x >= channels ? pixels[rowStart + x - channels] ?? 0 : 0;
      const up = y > 0 ? pixels[prevStart + x] ?? 0 : 0;
      const upLeft = y > 0 && x >= channels ? pixels[prevStart + x - channels] ?? 0 : 0;
      let value: number;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) value = raw + paeth(left, up, upLeft);
      else throw new Error(`unsupported PNG filter ${filter}`);
      pixels[rowStart + x] = value & 0xff;
    }
  }

  return { width, height, pixels, channels };
}

export function inspectPngSanity(bytes: Uint8Array): ScreenshotSanityResult {
  try {
    const { width, height, pixels, channels } = decodePng(bytes);
    if (width < 16 || height < 16) return { pass: false, format: "png", width, height, detail: "dimensions too small for examinable evidence" };

    let count = 0;
    let sum = 0;
    let sumSq = 0;
    let min = 255;
    let max = 0;
    const buckets = new Set<number>();

    for (let i = 0; i < pixels.length; i += channels) {
      let r: number;
      let g: number;
      let b: number;
      let alpha = 255;
      if (channels === 1) r = g = b = pixels[i] ?? 0;
      else if (channels === 2) {
        r = g = b = pixels[i] ?? 0;
        alpha = pixels[i + 1] ?? 255;
      } else {
        r = pixels[i] ?? 0;
        g = pixels[i + 1] ?? 0;
        b = pixels[i + 2] ?? 0;
        if (channels === 4) alpha = pixels[i + 3] ?? 255;
      }
      if (alpha < 8) continue;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      count += 1;
      sum += luminance;
      sumSq += luminance * luminance;
      min = Math.min(min, luminance);
      max = Math.max(max, luminance);
      buckets.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
    }

    if (count === 0) return { pass: false, format: "png", width, height, detail: "frame is fully transparent" };
    const mean = sum / count;
    const variance = Math.max(0, sumSq / count - mean * mean);
    const stddev = Math.sqrt(variance);
    const range = max - min;
    const distinct = buckets.size;
    const pass = stddev >= 3 && range >= 8 && distinct >= 4;
    return {
      pass,
      format: "png",
      width,
      height,
      luminance_mean: Number(mean.toFixed(3)),
      luminance_stddev: Number(stddev.toFixed(3)),
      luminance_range: Number(range.toFixed(3)),
      distinct_color_buckets: distinct,
      detail: pass ? undefined : "near-uniform frame is not examinable evidence",
    };
  } catch (error) {
    return { pass: false, format: "png", detail: error instanceof Error ? error.message : String(error) };
  }
}

export async function inspectScreenshotSanity(filePath: string): Promise<ScreenshotSanityResult> {
  const bytes = await readFile(filePath);
  const extension = extname(filePath).toLowerCase();
  if (extension === ".png") return inspectPngSanity(bytes);
  return {
    pass: bytes.length >= 1000,
    format: extension.replace(/^\./, "") || "unknown",
    detail: bytes.length >= 1000 ? "non-PNG evidence receives structural size check only" : "screenshot file is too small to be examinable",
  };
}

export async function assertScreenshotSanity(filePath: string): Promise<void> {
  const result = await inspectScreenshotSanity(filePath);
  if (!result.pass) throw new Error(`BLANK-SCREENSHOT-REJECTED ${filePath}: ${result.detail ?? "visual sanity failed"}`);
}
