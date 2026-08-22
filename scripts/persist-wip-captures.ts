/**
 * Persist durable WIP captures from capture-wip browser test stdout.
 *
 * In Vitest browser mode, node:fs is unavailable so capture-wip falls
 * back to logging base64 PNG data to stdout.  This script:
 *   1. Runs capture-wip via child_process
 *   2. Parses [capture-wip:frame-NNN.png:base64] lines
 *   3. Decodes base64 → PNG files under docs/screenshots/<section>/
 *   4. Parses [capture-wip:sequence] line → writes sequence.json
 *
 * Usage:
 *   tsx scripts/persist-wip-captures.ts \
 *     --section BROWSER-CORE-EVIDENCE \
 *     --frames 4 \
 *     --labels before,event,transition,result \
 *     --stride 1
 */

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
function flag(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : fallback;
}

const SECTION = flag("section", "capture");
const FRAMES = parseInt(flag("frames", "4"), 10);
const LABELS = flag("labels", "before,event,transition,result");
const STRIDE = flag("stride", "1");
const OUTPUT_ROOT = "docs/screenshots";

// ---------------------------------------------------------------------------
// Run capture-wip
// ---------------------------------------------------------------------------

const env = {
  ...process.env,
  GAUNTLET_EVIDENCE_CAPTURE: "1",
  WIP_SECTION: `__EVIDENCE__:${SECTION}`,
  WIP_FRAMES: String(FRAMES),
  WIP_FRAME_LABELS: LABELS,
  WIP_FRAME_STRIDE: STRIDE,
};

console.error(`[persist-wip] Running capture-wip for ${SECTION} (${FRAMES} frames, stride=${STRIDE})`);

let stdout: string;
try {
  stdout = execSync(
    "mise exec -- npx vitest run tests/browser/capture-wip.browser.test.ts --project browser",
    {
      cwd: process.cwd(),
      env,
      encoding: "utf-8",
      timeout: 120_000,
      maxBuffer: 50 * 1024 * 1024,
    },
  );
} catch (err: any) {
  // vitest exits non-zero when tests fail; still capture output.
  stdout = err.stdout ?? "";
  const stderr = err.stderr ?? "";
  if (!stdout.includes("[capture-wip:")) {
    console.error("[persist-wip] capture-wip produced no base64 output");
    console.error("stderr:", stderr.slice(-2000));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Parse base64 frames from stdout
// ---------------------------------------------------------------------------

const framePattern = /\[capture-wip:(frame-\d+\.png):base64\]([A-Za-z0-9+/=]+)/g;
const frames: Array<{ name: string; base64: string }> = [];
let match: RegExpExecArray | null;

while ((match = framePattern.exec(stdout)) !== null) {
  frames.push({ name: match[1], base64: match[2] });
}

console.error(`[persist-wip] Found ${frames.length} base64 frames in output`);

if (frames.length === 0) {
  console.error("[persist-wip] No frames found — capture-wip may have written files directly via node:fs");
  // Check if files already exist on disk.
  const { existsSync } = await import("node:fs");
  const dir = join(OUTPUT_ROOT, SECTION);
  if (existsSync(join(dir, "frame-000.png"))) {
    console.error(`[persist-wip] Files already exist in ${dir}/ — skipping`);
    process.exit(0);
  }
  console.error("[persist-wip] No frames available — aborting");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Write PNG files
// ---------------------------------------------------------------------------

const outDir = join(OUTPUT_ROOT, SECTION);
mkdirSync(outDir, { recursive: true });

for (const frame of frames) {
  const filePath = join(outDir, frame.name);
  const buffer = Buffer.from(frame.base64, "base64");
  writeFileSync(filePath, buffer);
  console.error(`[persist-wip] Wrote ${filePath} (${buffer.length} bytes)`);
}

// ---------------------------------------------------------------------------
// Parse and write sequence.json
// ---------------------------------------------------------------------------

const seqPattern = /\[capture-wip:sequence\](\{.*\})/s;
const seqMatch = stdout.match(seqPattern);

if (seqMatch) {
  const seqJson = JSON.parse(seqMatch[1]);
  const seqPath = join(outDir, "sequence.json");
  writeFileSync(seqPath, JSON.stringify(seqJson, null, 2) + "\n", "utf-8");
  console.error(`[persist-wip] Wrote ${seqPath}`);
} else {
  console.error("[persist-wip] No sequence data found in output");
}

console.error(`[persist-wip] Done — ${frames.length} frames persisted to ${outDir}/`);
