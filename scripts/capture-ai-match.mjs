/**
 * Combined capture: starts Vite, opens browser, captures AI-vs-AI screenshot.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";

const OUT_DIR = "docs/screenshots/BROWSER-MATCH-START-URL";

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  // Start Vite dev server.
  const server = spawn("pnpm", ["vite", "dev", "--host", "127.0.0.1"], {
    stdio: "pipe",
    env: { ...process.env, CI: "1" },
    cwd: "/home/ubuntu/projects/oxDeveloop/pes-simulator",
  });

  let port = 5173;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server timeout")), 30000);
    const onData = (data) => {
      const text = data.toString();
      const m = text.match(/127\.0\.0\.1:(\d+)/);
      if (m) port = parseInt(m[1], 10);
      if (text.includes("ready") || text.includes("Local:")) {
        clearTimeout(timer);
        server.stdout?.off("data", onData);
        server.stderr?.off("data", onData);
        resolve();
      }
    };
    server.stdout?.on("data", onData);
    server.stderr?.on("data", onData);
    server.on("error", reject);
  });

  console.log(`Vite running on port ${port}`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-frame-rate-limit"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("CONSOLE_ERR:", msg.text());
  });
  page.on("pageerror", (err) => console.log("PAGE_ERR:", err.message));

  // Navigate to the browser app with AI-vs-AI mode.
  const url = `http://127.0.0.1:${port}/src/apps/browser/index.html?mode=ai-match`;
  console.log(`Navigating to ${url}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });

  // Wait for Three.js scene to render.
  await page.waitForTimeout(5000);

  const info = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.id);
    const clock = document.getElementById("scoreboard-clock");
    return {
      ids,
      clockText: clock?.textContent ?? "N/A",
      bodyLen: document.body.innerHTML.length,
      gameContainer: !!document.getElementById("game-container"),
    };
  });
  console.log("Page info:", JSON.stringify(info, null, 2));

  // Take screenshot.
  const path = `${OUT_DIR}/frame-000.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`Screenshot saved to ${path}`);

  const { statSync } = await import("node:fs");
  const stats = statSync(path);
  console.log(`File size: ${stats.size} bytes`);

  await browser.close();
  server.kill("SIGTERM");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
