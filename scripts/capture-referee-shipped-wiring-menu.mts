/**
 * Real-dev-server capture for REFEREE-SHIPPED-WIRING: the honest, menu-visible
 * "Referee" toggle in the REAL shipped `#setup-menu` surface.
 *
 * The wiring decision is a menu-visible toggle (a real, selectable checkbox in
 * the real menu), not hidden config.  This script proves that the SHIPPED app
 * exposes it:
 *
 *   1. start the Vite dev server and load `src/apps/browser/index.html`;
 *   2. assert the shipped `#mode-select` ladder is complete (9 options) and the
 *      `#referee-toggle` checkbox is present (a real, selectable control);
 *   3. element-capture the shipped `#setup-menu-card` (the full surface: title,
 *      mode ladder, home/away, Difficulty row, Referee toggle, controls legend,
 *      START MATCH) and write it as `menu-referee-toggle.png`.
 *
 * The Referee toggle is informed by the same establish small-sided-ladder/menu
 * pattern the mode + Difficulty rows use; it is OFF by default so a mode that
 * does not opt in stays byte-neutral on the sim and render paths.
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode
 * (`WIP_SECTION=__EVIDENCE__:REFEREE-SHIPPED-WIRING`); an ordinary run writes
 * under the ignored `test-results/gauntlet-capture/**` tree and leaves `docs/`
 * byte-identical.  The PNG bytes are intentionally NOT embedded in the record
 * (the record stays byte-reproducible); only its SHA-256 is recorded.
 *
 * Usage:
 *   WIP_SECTION=__EVIDENCE__:REFEREE-SHIPPED-WIRING \
 *     mise exec -- pnpm exec tsx scripts/capture-referee-shipped-wiring-menu.mts
 */
import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const OBJECTIVE_ID = "REFEREE-SHIPPED-WIRING";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const SCREENSHOT_DIR = EVIDENCE_MODE
  ? join("docs", "screenshots", OBJECTIVE_ID)
  : join("test-results", "gauntlet-capture", OBJECTIVE_ID);
const VIEWPORT = { width: 800, height: 600 };

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function assertValidPng(bytes: Buffer): { width: number; height: number } {
  if (bytes.length <= 1024) fail("menu-referee-toggle.png is suspiciously small");
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) fail("menu-referee-toggle.png is not a valid PNG");
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

async function main(): Promise<void> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const server = await createServer({ server: { port: 5179 } });
  await server.listen();
  const baseUrl =
    server.resolvedUrls?.local[0]?.replace(/\/$/, "") ?? "http://localhost:5179";
  console.log(`[referee-wiring-menu] Vite dev server at ${baseUrl} (durable=${EVIDENCE_MODE})`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/src/apps/browser/index.html`, { waitUntil: "networkidle" });
    await page.waitForSelector("#setup-menu:not(.hidden)", { timeout: 15000 });
    await page.waitForTimeout(1000);

    // The shipped menu must still expose the full 9-option mode ladder.
    const modeCount = await page.$$eval("#mode-select option", (opts) => opts.length);
    if (modeCount !== 9) fail(`#mode-select has ${modeCount} options, expected 9 (the shipped ladder)`);

    // The Honest Referee toggle must be a real, selectable checkbox control.
    const refereeToggle = page.locator("#referee-toggle");
    await refereeToggle.waitFor({ state: "attached", timeout: 5000 });
    const toggleType = await refereeToggle.getAttribute("type");
    if (toggleType !== "checkbox") fail(`#referee-toggle has type="${toggleType}", expected "checkbox"`);

    // The toggle is ON by default? No — it defaults OFF so non-opted modes stay
    // byte-neutral.  Check it to prove it is a real, selectable control.
    const initialChecked = await refereeToggle.isChecked();
    await refereeToggle.check();
    const afterChecked = await refereeToggle.isChecked();
    if (initialChecked !== false) fail(`#referee-toggle unexpectedly starts checked (${initialChecked})`);
    if (afterChecked !== true) fail("#referee-toggle did not resolve to checked after the interaction");

    // Capture the REAL shipped setup-menu-card (with the Referee toggle row).
    const menuPath = join(SCREENSHOT_DIR, "menu-referee-toggle.png");
    const menuEl = page.locator("#setup-menu-card");
    await menuEl.screenshot({ path: menuPath });
    const bytes = readFileSync(menuPath);
    const dims = assertValidPng(bytes);
    const pngSha256 = sha256File(menuPath);
    console.log(
      `[referee-wiring-menu] menu-referee-toggle.png (${bytes.length} bytes, ${dims.width}x${dims.height}) ` +
        `sha256=${pngSha256} modes=${modeCount} referee-checked=${afterChecked}`,
    );
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
