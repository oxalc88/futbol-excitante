/**
 * Durable `menu-return` frame for FULLTIME-FLOW-CLOSURE.
 *
 * The event-centered DYNAMIC_VISUAL sequence's `menu-return` frame must show
 * the REAL shipped `#setup-menu` surface (the Difficulty row + the full mode
 * ladder), not a rebuilt lookalike.  This script captures that from the actual
 * served app via the established dev-server Playwright pattern (see
 * `scripts/capture-ladder-with-server.mjs` / `capture-controls-legend-screenshots.mjs`):
 *
 *   1. start the Vite dev server and load `src/apps/browser/index.html`;
 *   2. click `#start-button` to begin a real match;
 *   3. click the shipped `#back-to-menu` button — which drives the SAME
 *      `stopMatch() + showSetupMenu()` the fulltime `M` handler uses — so the
 *      shot exercises the real menu-return path;
 *   4. element-capture the shipped `#setup-menu-card` (the full surface: title,
 *      mode ladder, home/away, Difficulty row, controls legend, START MATCH)
 *      and write it as `menu-return.png`.
 *
 * The resulting PNG is the shipped DOM: the Difficulty selector and all 9
 * ladder mode options are present (compare the accepted
 * `SMALL-SIDED-LADDER-MENU-COMPLETION/menu-full-ladder.png`).
 *
 * Capture hygiene (0.9.2+): durable writes happen only in evidence mode
 * (`WIP_SECTION=__EVIDENCE__:FULLTIME-FLOW-CLOSURE`); an ordinary run writes
 * under the ignored `test-results/gauntlet-capture/**` tree and leaves `docs/`
 * byte-identical.  The PNG bytes are intentionally NOT embedded in the record
 * (the record stays byte-reproducible); only its SHA-256 is recorded in the
 * sequence.json the test wrote.
 *
 * Usage (after the browser test has written the 3 canvas frames + sequence.json
 * with the canvas frames):
 *   WIP_SECTION=__EVIDENCE__:FULLTIME-FLOW-CLOSURE \
 *     mise exec -- pnpm exec tsx scripts/capture-fulltime-flow-closure-menu.mts
 */
import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

const OBJECTIVE_ID = "FULLTIME-FLOW-CLOSURE";
const EVIDENCE_MODE =
  process.env.WIP_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}` ||
  process.env.GAUNTLET_EVIDENCE_CAPTURE === "1";
const SCREENSHOT_DIR = EVIDENCE_MODE
  ? join("docs", "screenshots", OBJECTIVE_ID)
  : join("test-results", "gauntlet-capture", OBJECTIVE_ID);
const SEQUENCE_PATH = join(SCREENSHOT_DIR, "sequence.json");
const VIEWPORT = { width: 800, height: 600 };

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function assertValidPng(bytes: Buffer): { width: number; height: number } {
  if (bytes.length <= 1024) fail("menu-return.png is suspiciously small");
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) fail("menu-return.png is not a valid PNG");
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

async function main(): Promise<void> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const server = await createServer({ server: { port: 5177 } });
  await server.listen();
  const baseUrl =
    server.resolvedUrls?.local[0]?.replace(/\/$/, "") ?? "http://localhost:5177";
  console.log(`[fulltime-flow-closure-menu] Vite dev server at ${baseUrl} (durable=${EVIDENCE_MODE})`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/src/apps/browser/index.html`, { waitUntil: "networkidle" });
    await page.waitForSelector("#setup-menu:not(.hidden)", { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Start a match so we can then exercise the real menu-return path, and
    // confirm the menu surface is hidden during play.
    await page.click("#start-button");
    await page.waitForFunction(
      () => {
        const menu = document.getElementById("setup-menu");
        const hud = document.getElementById("tick-display");
        return menu?.classList.contains("hidden") && !!hud && !/^Tick:\s*0$/.test(hud.textContent ?? "");
      },
      { timeout: 20000 },
    );

    // Exercise the shipped menu-return path: `#back-to-menu` drives the SAME
    // `stopMatch() + showSetupMenu()` the fulltime `M` affordance uses.
    await page.click("#back-to-menu");
    await page.waitForFunction(
      () => !document.getElementById("setup-menu")?.classList.contains("hidden"),
      { timeout: 15000 },
    );
    await page.waitForTimeout(500);

    // The menu must be the real shipped surface: the Difficulty row + the full
    // 9-option mode ladder are present.
    const modeCount = await page.$$eval("#mode-select option", (opts) => opts.length);
    const hasDifficulty = await page.$eval("#difficulty-select", (el) => !!el && ["Easy", "Medium", "Hard"].every((v) => Array.from(el.querySelectorAll("option")).some((o) => o.textContent === v)));
    if (modeCount !== 9) fail(`#mode-select has ${modeCount} options, expected 9 (the shipped ladder)`);
    if (!hasDifficulty) fail("#difficulty-select is missing the Easy/Medium/Hard options");

    const menuPath = join(SCREENSHOT_DIR, "menu-return.png");
    const menuEl = page.locator("#setup-menu-card");
    await menuEl.screenshot({ path: menuPath });
    const bytes = readFileSync(menuPath);
    const dims = assertValidPng(bytes);
    const pngSha256 = sha256File(menuPath);
    console.log(
      `[fulltime-flow-closure-menu] menu-return.png (${bytes.length} bytes, ${dims.width}x${dims.height}) ` +
        `sha256=${pngSha256} modes=${modeCount} difficulty=${hasDifficulty}`,
    );

    // Append the menu-return frame to the sequence.json the browser test wrote.
    if (!existsSync(SEQUENCE_PATH)) {
      fail(`sequence.json not found at ${SEQUENCE_PATH} — run the browser capture first`);
    }
    const sequence = JSON.parse(readFileSync(SEQUENCE_PATH, "utf8")) as {
      objective_id?: string;
      frames?: Array<{ label: string; path: string; tick: number; semantic: string; note?: string; pngSha256?: string }>;
    };
    if (!sequence.frames) sequence.frames = [];
    // Replace/append the menu-return frame (idempotent on re-run).
    const withoutMenu = sequence.frames.filter((f) => f.path !== "menu-return.png");
    sequence.frames = [
      ...withoutMenu,
      {
        label: "menu-return",
        path: "menu-return.png",
        tick: 660,
        semantic: "transition",
        note:
          "The match-setup menu after the menu-return affordance, captured from the REAL shipped #setup-menu " +
          "surface (the #setup-menu-card element: the PES SIMULATOR title, the full 9-option mode ladder, the " +
          "Home/Away team inputs, the Difficulty row, the controls legend, and START MATCH) via the shipped " +
          "#back-to-menu path.  The app lands in the clean setup menu, so the loop is closable to the menu.",
        pngSha256,
      },
    ];
    // Preserve the semantic order the evidence sequence describes.
    const order = ["fulltime-terminal", "fulltime-affordance", "menu-return", "new-match-start"];
    sequence.frames.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
    writeFileSync(SEQUENCE_PATH, `${JSON.stringify(sequence, null, 2)}\n`, "utf-8");
    console.log(`[fulltime-flow-closure-menu] menu-return frame added to sequence.json (${sequence.frames.length} frames)`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
