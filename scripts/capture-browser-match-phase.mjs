#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve("dist");
const OUT_DIR = resolve("docs/screenshots/BROWSER-MATCH-PHASE-DISPLAY");
const PORT = 5210;
const ENTRY = "/src/apps/browser/index.html";

const MIME_TYPES = {
  ".html": "text/html", ".js": "application/javascript",
  ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml",
};

const server = createServer((req, res) => {
  const pathname = req.url.split("?")[0];
  const p = pathname === "/" ? ENTRY : pathname;
  const fp = resolve(ROOT, "." + p);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end("Forbidden"); return; }
  if (existsSync(fp) && !fp.endsWith("/")) {
    const ext = extname(fp);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
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
    args: ["--enable-webgl", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox", "--ignore-gpu-blocklist"],
  });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on("console", (msg) => console.log(`[browser] ${msg.type()}: ${msg.text()}`));
  page.on("pageerror", (err) => console.log(`[browser:error] ${err.message}`));

  const url = `http://localhost:${PORT}${ENTRY}?scenario=two-player`;
  console.log(`[capture] Navigating to ${url}...`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 20000 }).catch((e) => console.log(`[capture] Nav: ${e.message}`));
  await sleep(2000);

  const bt = await page.evaluate(() => document.body?.innerText?.slice(0,200) || "no body");
  console.log(`[capture] Body: "${bt}"`);
  console.log(`[capture] Overlay exists: ${await page.evaluate(() => !!document.getElementById("match-phase-overlay"))}`);
  console.log(`[capture] Container: ${await page.evaluate(() => !!document.getElementById("game-container"))}`);

  console.log("[capture] Waiting 35s for half-time overlay...");
  try {
    const t = await page.waitForFunction(() => {
      const e = document.getElementById("match-phase-overlay");
      return e?.textContent?.length > 0 ? e.textContent : null;
    }, { timeout: 35000 }).then(h => h.jsonValue());
    console.log(`[capture] Overlay: "${t}"`);
    await sleep(500);
  } catch { console.log("[capture] Overlay not shown."); }

  mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: resolve(OUT_DIR, "frame-000.png") });
  const oe = await page.$("#match-phase-overlay");
  if (oe) await oe.screenshot({ path: resolve(OUT_DIR, "overlay.png") });
  const tick = await page.evaluate(() => document.getElementById("tick-display")?.textContent || "unknown");
  console.log(`[capture] Tick: ${tick}`);
  await browser.close();
  console.log("[capture] Done.");
} finally { server.close(); await sleep(500); }
