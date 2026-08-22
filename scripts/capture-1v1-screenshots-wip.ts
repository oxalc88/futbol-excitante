/**
 * Persist DYNAMIC_VISUAL evidence screenshots for BROWSER-1V1-CONTROL-EVIDENCE.
 *
 * Runs the 1v1-control-screenshots browser test (which captures 5 semantic
 * frames via bridge.capture() at 800×600), parses the base64 output,
 * and writes real PNG files plus sequence.json to:
 *   docs/screenshots/BROWSER-1V1-CONTROL-EVIDENCE/
 *
 * Usage:
 *   tsx scripts/capture-1v1-screenshots-wip.ts
 */

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SECTION = "BROWSER-1V1-CONTROL-EVIDENCE";
const OUTPUT_ROOT = "docs/screenshots";

// ---------------------------------------------------------------------------
// Run the browser test
// ---------------------------------------------------------------------------

console.error(`[capture-1v1-wip] Running 1v1-control-screenshots browser test...`);

let stdout: string;
try {
  stdout = execSync(
    "npx vitest run tests/browser/1v1-control-screenshots.browser.test.ts --project browser",
    {
      cwd: process.cwd(),
      env: { ...process.env, CI: "1" },
      encoding: "utf-8",
      timeout: 120_000,
      maxBuffer: 50 * 1024 * 1024,
    },
  );
} catch (err: any) {
  stdout = err.stdout ?? "";
  if (!stdout.includes("[capture-wip:")) {
    console.error("[capture-1v1-wip] Test produced no base64 output");
    console.error("stderr:", (err.stderr ?? "").slice(-2000));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Parse base64 frames from stdout
// ---------------------------------------------------------------------------

const framePattern = /\[capture-wip:(frame-[^\s:]+\.png):base64\]([A-Za-z0-9+/=]+)/g;
const frames: Array<{ name: string; base64: string }> = [];
let match: RegExpExecArray | null;

while ((match = framePattern.exec(stdout)) !== null) {
  frames.push({ name: match[1], base64: match[2] });
}

console.error(`[capture-1v1-wip] Found ${frames.length} base64 frames in output`);

if (frames.length === 0) {
  // Check if files were written directly by the test.
  const dir = join(OUTPUT_ROOT, SECTION);
  if (existsSync(join(dir, "frame-before.png"))) {
    console.error(`[capture-1v1-wip] Files already exist in ${dir}/ — skipping`);
    process.exit(0);
  }
  console.error("[capture-1v1-wip] No frames found — aborting");
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
  console.error(`[capture-1v1-wip] Wrote ${filePath} (${buffer.length} bytes)`);
}

// ---------------------------------------------------------------------------
// Parse and write sequence.json
// ---------------------------------------------------------------------------

const seqPattern = /\[capture-wip:sequence\](\{[^]*\})\s*$/m;
const seqMatch = stdout.match(seqPattern);

if (seqMatch) {
  const seqJson = JSON.parse(seqMatch[1]);
  const seqPath = join(outDir, "sequence.json");
  writeFileSync(seqPath, JSON.stringify(seqJson, null, 2) + "\n", "utf-8");
  console.error(`[capture-1v1-wip] Wrote ${seqPath}`);
} else {
  console.error("[capture-1v1-wip] No sequence data found in output");
}

console.error(`[capture-1v1-wip] Done — ${frames.length} frames persisted to ${outDir}/`);
