/**
 * Combined script: starts Vite dev server, captures screenshots, then stops it.
 */
import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const SCREENSHOT_DIR = "docs/screenshots/SMALL-SIDED-LADDER-MENU-COMPLETION";
mkdirSync(SCREENSHOT_DIR, { recursive: true });

function computeHash(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

async function main() {
  // Start Vite dev server
  const server = await createServer({ server: { port: 5173 } });
  await server.listen();
  const baseUrl = "http://localhost:5173";
  console.log(`Vite dev server running at ${baseUrl}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await context.newPage();

  const hashes = {};

  // 1. Menu screenshot
  console.log("Capturing menu screenshot...");
  await page.goto(`${baseUrl}/src/apps/browser/index.html`);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: join(SCREENSHOT_DIR, "menu-full-ladder.png") });
  hashes["menu-full-ladder.png"] = computeHash(join(SCREENSHOT_DIR, "menu-full-ladder.png"));
  console.log(`  -> menu-full-ladder.png hash=${hashes["menu-full-ladder.png"]}`);

  // 2. 5v5 Human vs CPU match
  console.log("Capturing 5v5 human-vs-CPU match...");
  await page.goto(`${baseUrl}/src/apps/browser/index.html?mode=human-vs-ai-5v5`);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: join(SCREENSHOT_DIR, "match-5v5-human-vs-cpu.png") });
  hashes["match-5v5-human-vs-cpu.png"] = computeHash(join(SCREENSHOT_DIR, "match-5v5-human-vs-cpu.png"));
  console.log(`  -> match-5v5-human-vs-cpu.png hash=${hashes["match-5v5-human-vs-cpu.png"]}`);

  // 3. 3v3 Human vs CPU match
  console.log("Capturing 3v3 human-vs-CPU match...");
  await page.goto(`${baseUrl}/src/apps/browser/index.html?mode=human-vs-ai-3v3`);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: join(SCREENSHOT_DIR, "match-3v3-human-vs-cpu.png") });
  hashes["match-3v3-human-vs-cpu.png"] = computeHash(join(SCREENSHOT_DIR, "match-3v3-human-vs-cpu.png"));
  console.log(`  -> match-3v3-human-vs-cpu.png hash=${hashes["match-3v3-human-vs-cpu.png"]}`);

  // Verify uniqueness
  const hashValues = Object.values(hashes);
  const uniqueHashes = new Set(hashValues);
  if (uniqueHashes.size !== hashValues.length) {
    console.error("ERROR: Duplicate screenshot hashes detected!");
    process.exit(1);
  }
  console.log("\nAll screenshots have unique SHA-256 hashes:");
  console.log(JSON.stringify(hashes, null, 2));

  await browser.close();
  await server.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
