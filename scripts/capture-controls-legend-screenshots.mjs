/**
 * Durable BROWSER_VISIBLE evidence capture for
 * BROWSER-DEFENSIVE-CONTROLS-LEGEND.
 *
 * Starts the real Vite dev server, drives the real browser app, asserts the
 * live legend DOM against the shared CONTROLS_LEGEND contract (loaded through
 * Vite SSR so this script carries no second copy of the row data), then writes
 * two byte-distinct screenshots:
 *
 *  1. legend-setup-menu.png       — setup menu showing the Controls legend.
 *  2. legend-in-match-overlay.png — live 5v5 human-vs-CPU match with the
 *                                   in-match Controls overlay opened.
 *
 * Based on scripts/capture-ladder-with-server.mjs (accepted prior art).
 */
import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const OBJECTIVE_ID = "BROWSER-DEFENSIVE-CONTROLS-LEGEND";
const SCREENSHOT_DIR = join("docs", "screenshots", OBJECTIVE_ID);
const VIEWPORT = { width: 800, height: 600 };

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function computeHash(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function assertValidPng(filePath, label) {
  let bytes;
  try {
    bytes = readFileSync(filePath);
  } catch {
    fail(`${label} was not written: ${filePath}`);
  }
  if (bytes.length <= 1024) {
    fail(`${label} is suspiciously small (${bytes.length} bytes <= 1KB)`);
  }
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) {
      fail(`${label} is not a valid PNG (${filePath})`);
    }
  }
  // IHDR width/height are big-endian uint32 at fixed offsets.
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== VIEWPORT.width || height !== VIEWPORT.height) {
    fail(`${label} has unexpected dimensions ${width}x${height}`);
  }
  return bytes.length;
}

/** Read a live legend <tbody> and validate it row-for-row against the contract. */
async function assertLegendRows(page, tbodyId, expectedRows, label) {
  const rows = await page.$$eval(
    `#${tbodyId} tr`,
    (trs) =>
      trs.map((tr) => {
        const cells = Array.from(tr.querySelectorAll("td"));
        return {
          label: (cells[0]?.textContent ?? "").trim(),
          key: (cells[1]?.textContent ?? "").trim(),
        };
      }),
  );

  if (rows.length !== expectedRows.length) {
    fail(`${label}: #${tbodyId} has ${rows.length} rows, expected ${expectedRows.length}`);
  }
  for (let i = 0; i < expectedRows.length; i += 1) {
    if (rows[i].label !== expectedRows[i].label) {
      fail(
        `${label}: row ${i} label is "${rows[i].label}", contract says "${expectedRows[i].label}"`,
      );
    }
    if (rows[i].key !== expectedRows[i].keyDisplay) {
      fail(
        `${label}: row ${i} key is "${rows[i].key}", contract says "${expectedRows[i].keyDisplay}"`,
      );
    }
  }
  console.log(
    `  -> ${label}: ${rows.length} rows match the contract (${rows[0].label} .. ${rows[rows.length - 1].label})`,
  );
  return rows;
}

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const server = await createServer({ server: { port: 5173 } });
  await server.listen();
  const baseUrl =
    server.resolvedUrls?.local[0]?.replace(/\/$/, "") ?? "http://localhost:5173";
  console.log(`Vite dev server running at ${baseUrl}`);

  // Contract parity comes from the same module the app renders from.
  const contract = (await server.ssrLoadModule("/src/contracts/controls-legend.ts"))
    .CONTROLS_LEGEND;
  if (!Array.isArray(contract) || contract.length !== 10) {
    fail(`CONTROLS_LEGEND must have 10 entries, got ${contract?.length}`);
  }
  const expectedRows = contract.map((entry) => ({
    label: entry.label,
    keyDisplay: entry.keyDisplay,
  }));

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const hashes = {};

  try {
    // 1. Setup menu with the Controls legend.
    console.log("Capturing setup-menu controls legend...");
    await page.goto(`${baseUrl}/src/apps/browser/index.html`, { waitUntil: "networkidle" });
    await page.waitForSelector("#controls-legend-body tr", { timeout: 15000 });
    await page.waitForTimeout(1500);

    const legendVisible = await page.$eval("#controls-legend", (el) => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    if (!legendVisible) fail("setup-menu #controls-legend is not visible");

    await assertLegendRows(page, "controls-legend-body", expectedRows, "setup menu legend");

    const setupPath = join(SCREENSHOT_DIR, "legend-setup-menu.png");
    await page.screenshot({ path: setupPath });
    const setupBytes = assertValidPng(setupPath, "legend-setup-menu.png");
    hashes["legend-setup-menu.png"] = computeHash(setupPath);
    console.log(`  -> legend-setup-menu.png (${setupBytes} bytes) hash=${hashes["legend-setup-menu.png"]}`);

    // 2. Live 5v5 human-vs-CPU match with the in-match overlay opened.
    console.log("Capturing in-match controls overlay (5v5 human vs CPU)...");
    await page.goto(`${baseUrl}/src/apps/browser/index.html?mode=human-vs-ai-5v5`, {
      waitUntil: "networkidle",
    });
    await page.waitForFunction(
      () => {
        const menuHidden =
          document.getElementById("setup-menu")?.classList.contains("hidden") ?? false;
        const hud = document.getElementById("tick-display");
        return menuHidden && hud && !/^Tick:\s*0$/.test(hud.textContent ?? "");
      },
      { timeout: 20000 },
    );
    await page.waitForTimeout(1000);

    await page.click("#controls-toggle");
    await page.waitForFunction(
      () =>
        document.getElementById("controls-overlay")?.classList.contains("hidden") === false,
      { timeout: 5000 },
    );

    const overlayVisible = await page.$eval("#controls-overlay", (el) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return (
        box.width > 0 &&
        box.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    });
    if (!overlayVisible) fail("in-match #controls-overlay is not visible after opening");

    await assertLegendRows(page, "controls-overlay-body", expectedRows, "in-match overlay");

    const overlayPath = join(SCREENSHOT_DIR, "legend-in-match-overlay.png");
    await page.screenshot({ path: overlayPath });
    const overlayBytes = assertValidPng(overlayPath, "legend-in-match-overlay.png");
    hashes["legend-in-match-overlay.png"] = computeHash(overlayPath);
    console.log(
      `  -> legend-in-match-overlay.png (${overlayBytes} bytes) hash=${hashes["legend-in-match-overlay.png"]}`,
    );
  } finally {
    await browser.close();
    await server.close();
  }

  const hashValues = Object.values(hashes);
  if (new Set(hashValues).size !== hashValues.length) {
    fail("Duplicate screenshot hashes detected — frames are not byte-distinct");
  }
  console.log(`\n${hashValues.length} screenshots captured, all valid PNGs with unique SHA-256:`);
  console.log(JSON.stringify(hashes, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
