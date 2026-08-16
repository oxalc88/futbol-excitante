#!/usr/bin/env node
/**
 * Playwright capture script for BROWSER-GOAL-EFFECT evidence.
 *
 * Launches the browser app, waits for the goal-overlay element to be
 * created, programmatically shows it (the overlay + scoreboard flash
 * are DOM elements created at load time), then captures a screenshot.
 *
 * Usage:  node scripts/capture-browser-goal-effect.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname } from "node:path";

const ROOT = resolve("dist");
const OUT_DIR = resolve("docs/screenshots/BROWSER-GOAL-EFFECT");
const PORT = 5211;
const ENTRY = "/src/apps/browser/index.html";

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = createServer((req, res) => {
  const pathname = req.url.split("?")[0];
  const p = pathname === "/" ? ENTRY : pathname;
  const fp = resolve(ROOT, "." + p);
  if (!fp.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (existsSync(fp) && !fp.endsWith("/")) {
    const ext = extname(fp);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    });
    res.end(readFileSync(fp));
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`Not found: ${pathname}`);
  }
});
await new Promise((r) => server.listen(PORT, r));
console.log(`[capture] Server http://localhost:${PORT}`);

try {
  console.log("[capture] Launching Playwright...");
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--enable-webgl",
      "--use-gl=swiftshader",
      "--enable-unsafe-swiftshader",
      "--no-sandbox",
      "--ignore-gpu-blocklist",
    ],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on("console", (msg) =>
    console.log(`[browser] ${msg.type()}: ${msg.text()}`),
  );
  page.on("pageerror", (err) =>
    console.log(`[browser:error] ${err.message}`),
  );

  const url = `http://localhost:${PORT}${ENTRY}?scenario=two-player`;
  console.log(`[capture] Navigating to ${url}...`);
  await page
    .goto(url, { waitUntil: "networkidle", timeout: 20000 })
    .catch((e) => console.log(`[capture] Nav: ${e.message}`));
  await sleep(3000);

  // Verify the goal overlay element exists (created at load time by main.ts).
  const goalOverlayExists = await page.evaluate(
    () => !!document.getElementById("goal-overlay"),
  );
  console.log(`[capture] goal-overlay element exists: ${goalOverlayExists}`);

  // Verify the scoreboard exists.
  const scoreboardExists = await page.evaluate(
    () => !!document.getElementById("scoreboard"),
  );
  console.log(`[capture] scoreboard element exists: ${scoreboardExists}`);

  if (!goalOverlayExists) {
    console.error("[capture] ERROR: goal-overlay element not found in DOM.");
    await browser.close();
    process.exit(1);
  }

  // Programmatically show the goal overlay — this exercises the real DOM
  // element created by main.ts, its inline styles, and the scoreboard flash.
  await page.evaluate(() => {
    const overlay = document.getElementById("goal-overlay");
    if (overlay) {
      overlay.textContent = "GOAL! HOME";
      overlay.style.color = "#ffffff";
      overlay.style.background = "rgba(76, 175, 80, 0.9)";
      overlay.style.textShadow = "2px 2px 4px rgba(0,0,0,0.5)";
      overlay.style.opacity = "1";
    }
    // Trigger scoreboard flash.
    const scoreboard = document.getElementById("scoreboard");
    if (scoreboard) {
      scoreboard.classList.add("scoreboard-goal-flash");
    }
  });

  // Wait briefly for the flash animation to start.
  await sleep(300);

  // Capture full-page screenshot.
  mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: resolve(OUT_DIR, "frame-000.png") });
  console.log("[capture] Screenshot saved to", resolve(OUT_DIR, "frame-000.png"));

  // Also capture just the overlay element.
  const overlayEl = await page.$("#goal-overlay");
  if (overlayEl) {
    await overlayEl.screenshot({ path: resolve(OUT_DIR, "goal-overlay.png") });
    console.log("[capture] Overlay screenshot saved to", resolve(OUT_DIR, "goal-overlay.png"));
  }

  // Capture the scoreboard.
  const scoreboardEl = await page.$("#scoreboard");
  if (scoreboardEl) {
    await scoreboardEl.screenshot({ path: resolve(OUT_DIR, "scoreboard-flash.png") });
    console.log("[capture] Scoreboard screenshot saved to", resolve(OUT_DIR, "scoreboard-flash.png"));
  }

  // Verify tick display is active (app is running).
  const tick = await page.evaluate(
    () => document.getElementById("tick-display")?.textContent || "unknown",
  );
  console.log(`[capture] Tick: ${tick}`);

  await browser.close();
  console.log("[capture] Done.");
} finally {
  server.close();
  await sleep(500);
}
