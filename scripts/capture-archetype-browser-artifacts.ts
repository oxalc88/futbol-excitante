/**
 * Harvest archetype browser capture artifacts from the browser test
 * stdout output and persist them to docs/evidence/ and docs/screenshots/.
 *
 * Same pattern as persist-wip-captures.ts: runs the browser test,
 * parses structured stdout lines, and writes files to disk.
 *
 * Usage:
 *   tsx scripts/capture-archetype-browser-artifacts.ts
 */

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const EVIDENCE_DIR = "docs/evidence/ARCHETYPE-BROWSER-CAPTURE";
const SCREENSHOT_DIR = "docs/screenshots/ARCHETYPE-BROWSER-CAPTURE";

console.error("[harvest] Running browser capture test...");

let stdout: string;
try {
  stdout = execSync(
    "npx vitest run tests/browser/archetype-browser-capture.browser.test.ts --project browser",
    {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 120_000,
      maxBuffer: 100 * 1024 * 1024,
    },
  );
} catch (err: any) {
  stdout = err.stdout ?? "";
  if (!stdout.includes("[archetype-capture:")) {
    console.error("[harvest] No archetype-capture output found");
    console.error("stderr:", (err.stderr ?? "").slice(-2000));
    process.exit(1);
  }
}

// Parse base64 PNG frames
const pngPattern = /\[archetype-capture:([^:]+-frame-\d+\.png):base64\]([A-Za-z0-9+/=]+)/g;
const pngFrames: Array<{ name: string; base64: string }> = [];
let match: RegExpExecArray | null;
while ((match = pngPattern.exec(stdout)) !== null) {
  pngFrames.push({ name: match[1], base64: match[2] });
}
console.error(`[harvest] Found ${pngFrames.length} PNG frames`);

// Parse meta.json lines
const metaPattern = /\[archetype-capture:([^:]+)-meta:(\d+)\](\{.*\})/g;
const metaEntries: Array<{ baseName: string; tick: string; json: string }> = [];
while ((match = metaPattern.exec(stdout)) !== null) {
  metaEntries.push({ baseName: match[1], tick: match[2], json: match[3] });
}
console.error(`[harvest] Found ${metaEntries.length} meta entries`);

// Parse sequence.json
const seqMatch = stdout.match(/\[archetype-capture:sequence\](\{.*\})/);
const trajectoryMatch = stdout.match(/\[archetype-capture:trajectory\](\{.*\})/);

// Write PNG frames to evidence dir
mkdirSync(EVIDENCE_DIR, { recursive: true });
for (const frame of pngFrames) {
  const filePath = join(EVIDENCE_DIR, frame.name);
  writeFileSync(filePath, Buffer.from(frame.base64, "base64"));
  console.error(`[harvest] Wrote ${filePath}`);
}

// Write meta.json files
for (const meta of metaEntries) {
  const filePath = join(EVIDENCE_DIR, `${meta.baseName}-frame-${meta.tick}.meta.json`);
  writeFileSync(filePath, meta.json + "\n");
  console.error(`[harvest] Wrote ${filePath}`);
}

// Write PNG frames to screenshot dir too
mkdirSync(SCREENSHOT_DIR, { recursive: true });
for (const frame of pngFrames) {
  const filePath = join(SCREENSHOT_DIR, frame.name);
  writeFileSync(filePath, Buffer.from(frame.base64, "base64"));
}

// Write sequence.json
if (seqMatch) {
  const seqJson = JSON.parse(seqMatch[1]);
  const seqPath = join(SCREENSHOT_DIR, "sequence.json");
  writeFileSync(seqPath, JSON.stringify(seqJson, null, 2) + "\n");
  console.error(`[harvest] Wrote ${seqPath}`);
}

// Write trajectory.json
if (trajectoryMatch) {
  const trajJson = JSON.parse(trajectoryMatch[1]);
  const trajPath = join(EVIDENCE_DIR, "trajectory.json");
  writeFileSync(trajPath, JSON.stringify(trajJson, null, 2) + "\n");
  console.error(`[harvest] Wrote ${trajPath}`);
}

console.error(`[harvest] Done — ${pngFrames.length} frames persisted to ${EVIDENCE_DIR}/ and ${SCREENSHOT_DIR}/`);
