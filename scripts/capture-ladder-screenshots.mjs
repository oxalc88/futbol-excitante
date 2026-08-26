/**
 * Capture screenshots for SMALL-SIDED-LADDER-MENU-COMPLETION evidence.
 *
 * 1. Menu screenshot: opens the app, captures the setup menu with all 9 options.
 * 2. 5v5 match screenshot: navigates to ?mode=human-vs-ai-5v5, waits for match to start.
 * 3. 3v3 match screenshot: navigates to ?mode=human-vs-ai-3v3, waits for match to start.
 *
 * Requires: Playwright (devDependency), Vite dev server running on :5173.
 */

import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const SCREENSHOT_DIR = "docs/screenshots/SMALL-SIDED-LADDER-MENU-COMPLETION";
const BASE_URL = "http://localhost:5173";

mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function captureScreenshots() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await context.newPage();

  const hashes = {};

  // 1. Menu screenshot
  console.log("Capturing menu screenshot...");
  await page.goto(BASE_URL);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SCREENSHOT_DIR, "menu-full-ladder.png") });
  hashes["menu-full-ladder.png"] = computeHash(join(SCREENSHOT_DIR, "menu-full-ladder.png"));
  console.log(`  -> menu-full-ladder.png (hash: ${hashes["menu-full-ladder.png"]})`);

  // 2. 5v5 Human vs CPU match
  console.log("Capturing 5v5 human-vs-CPU match...");
  await page.goto(`${BASE_URL}?mode=human-vs-ai-5v5`);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: join(SCREENSHOT_DIR, "match-5v5-human-vs-cpu.png") });
  hashes["match-5v5-human-vs-cpu.png"] = computeHash(join(SCREENSHOT_DIR, "match-5v5-human-vs-cpu.png"));
  console.log(`  -> match-5v5-human-vs-cpu.png (hash: ${hashes["match-5v5-human-vs-cpu.png"]})`);

  // 3. 3v3 Human vs CPU match
  console.log("Capturing 3v3 human-vs-CPU match...");
  await page.goto(`${BASE_URL}?mode=human-vs-ai-3v3`);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: join(SCREENSHOT_DIR, "match-3v3-human-vs-cpu.png") });
  hashes["match-3v3-human-vs-cpu.png"] = computeHash(join(SCREENSHOT_DIR, "match-3v3-human-vs-cpu.png"));
  console.log(`  -> match-3v3-human-vs-cpu.png (hash: ${hashes["match-3v3-human-vs-cpu.png"]})`);

  // Verify uniqueness
  const hashValues = Object.values(hashes);
  const uniqueHashes = new Set(hashValues);
  if (uniqueHashes.size !== hashValues.length) {
    console.error("ERROR: Duplicate screenshot hashes detected!");
    process.exit(1);
  }
  console.log("\nAll screenshots have unique SHA-256 hashes.");
  console.log(JSON.stringify(hashes, null, 2));

  await browser.close();
}

function computeHash(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

captureScreenshots().catch((err) => {
  console.error(err);
  process.exit(1);
});
