#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createServer } from "node:http";

const ROOT = resolve("dist");
const OUT_DIR = resolve("docs/screenshots/BROWSER-MATCH-PHASE-DISPLAY");
const PORT = 5310;

const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png" };

const server = createServer((req, res) => {
  const path = req.url.split("?")[0] || "/";
  let fp = resolve(ROOT, "." + path);
  if (!fp.startsWith(ROOT + "/") && fp !== ROOT) { res.writeHead(403); res.end(); return; }
  if (!existsSync(fp)) { res.writeHead(404); res.end("Not found"); return; }
  const ext = extname(fp);
  res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
  res.end(readFileSync(fp));
});
await new Promise((r) => server.listen(PORT, r));

try {
  const browser = await chromium.launch({
    headless: true,
    args: ["--enable-webgl", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox", "--ignore-gpu-blocklist"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log(`[err] ${e.message}`));

  await page.goto(`http://localhost:${PORT}/src/apps/browser/index.html?scenario=two-player`, { waitUntil: "networkidle", timeout: 20000 });

  // Wait until tick >= 60, then immediately capture with overlay frozen
  console.log("[capture] Polling for tick >= 60...");
  while (true) {
    const tickVal = await page.evaluate(() => {
      const el = document.getElementById("tick-display");
      if (!el) return -1;
      const m = el.textContent?.match(/Tick:\s*(\d+)/);
      return m ? parseInt(m[1]) : -1;
    });
    if (tickVal >= 60) {
      console.log(`[capture] Tick reached ${tickVal}! Capturing overlay...`);
      // Force overlay visible immediately
      await page.evaluate(() => {
        const el = document.getElementById("match-phase-overlay");
        if (el) {
          el.style.transition = "none !important";
          el.style.opacity = "1 !important";
        }
      });
      await sleep(50);
      mkdirSync(OUT_DIR, { recursive: true });
      await page.screenshot({ path: resolve(OUT_DIR, "frame-000.png") });
      const oe = await page.$("#match-phase-overlay");
      if (oe) {
        const t = await page.evaluate(() => {
          const el = document.getElementById("match-phase-overlay");
          return el?.textContent || "(none)";
        });
        console.log(`[capture] Overlay text: "${t}"`);
        await oe.screenshot({ path: resolve(OUT_DIR, "overlay.png") });
      }
      console.log("[capture] Done.");
      break;
    }
    await sleep(5);
  }
} finally { server.close(); }
