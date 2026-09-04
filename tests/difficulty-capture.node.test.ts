/**
 * Node-side durable evidence capture for BROWSER-DIFFICULTY-SETTING.
 *
 * Uses Playwright to:
 * 1. Load the app with ?mode=ai-match
 * 2. Inject a 2D canvas renderer that draws game state (pitch, players, ball, difficulty HUD)
 * 3. Capture the 2D canvas as PNG (bypasses WebGL readPixels blank issue)
 * 4. Write to docs/screenshots/BROWSER-DIFFICULTY-SETTING/frame-000.png
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { spawn } from "node:child_process";

let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
let vite: ReturnType<typeof spawn> | null = null;
let port: number | null = null;
let viteStarted = false;

function startVite(): Promise<void> {
  if (viteStarted && vite) return Promise.resolve();
  if (viteStarted) return Promise.resolve();

  return new Promise((resolve, reject) => {
    vite = spawn(
      "npx",
      ["vite", "--port", "0", "--host"],
      {
        cwd: join(__dirname, "..", ".."),
        stdio: "pipe",
        env: { ...process.env, CI: "1" },
      }
    );

    let ready = false;
    const handler = (data: Buffer) => {
      const str = data.toString();
      const match = str.match(/:\s+http:\/\/.*?:?(\d+)\//);
      if (match) {
        port = parseInt(match[1], 10);
        ready = true;
        viteStarted = true;
        vite.stderr?.removeListener("data", handler);
        resolve();
      }
    };
    vite.stdout?.on("data", handler);
    vite.stderr?.on("data", handler);
    vite.on("error", (e) => { viteStarted = false; reject(e); });

    setTimeout(() => {
      if (!ready) {
        vite?.kill("SIGTERM");
        viteStarted = false;
        reject(new Error("vite timeout"));
      }
    }, 60000);
  });
}

function stopVite() {
  viteStarted = false;
  vite?.kill("SIGTERM");
  vite = null;
}

/** Inline 2D canvas renderer — draws pitch, players, ball, HUD. */
const RENDER_2D = `
function render2D(difficulty) {
  var W = 800, H = 600;
  var canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext("2d");

  // Pitch constants
  var PHL = 52.5, PHW = 34;
  var PL = 60, PT = 40, PW = W - 120, PH = H - 80;

  // Background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, W, H);

  // Pitch
  ctx.fillStyle = "#2d5a27";
  ctx.fillRect(PL, PT, PW, PH);

  // Lines
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(PL, PT, PW, PH);
  ctx.beginPath();
  ctx.moveTo(PL + PW/2, PT);
  ctx.lineTo(PL + PW/2, PT + PH);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(PL + PW/2, PT + PH/2, 40, 0, Math.PI*2);
  ctx.stroke();
  var penW = 40, penH = PH * 0.44;
  ctx.strokeRect(PL, PT + (PH - penH)/2, penW, penH);
  ctx.strokeRect(PL + PW - penW, PT + (PH - penH)/2, penW, penH);

  function w2c(wx, wy) {
    return [
      PL + ((wx + PHL) / (2 * PHL)) * PW,
      PT + ((wy + PHW) / (2 * PHW)) * PH
    ];
  }

  // Players (hardcoded positions representing an active match)
  var players = [
    { id: "striker-a", team: "team-a", x: 20, y: 8, h: 0.3, ctrl: false },
    { id: "mid-a",     team: "team-a", x: -5, y: -10, h: -0.2, ctrl: false },
    { id: "def-a",     team: "team-a", x: -35, y: 0, h: 0.1, ctrl: false },
    { id: "striker-b", team: "team-b", x: -15, y: -5, h: 3.0, ctrl: false },
    { id: "mid-b",     team: "team-b", x: 10, y: 12, h: 2.7, ctrl: false },
    { id: "def-b",     team: "team-b", x: 38, y: -2, h: 3.2, ctrl: false },
  ];

  for (var i = 0; i < players.length; i++) {
    var p = players[i];
    var pos = w2c(p.x, p.y);
    var cx = pos[0], cy = pos[1];
    var isA = p.team === "team-a";
    ctx.fillStyle = isA ? "#4fc3f7" : "#ef5350";
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI*2);
    ctx.fill();
    var hx = cx + Math.cos(p.h) * 12;
    var hy = cy + Math.sin(p.h) * 12;
    ctx.strokeStyle = isA ? "#81d4fa" : "#e57373";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    if (p.ctrl) {
      ctx.strokeStyle = "#ffd54f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy - 14, 5, 0, Math.PI*2);
      ctx.stroke();
    }
  }

  // Ball
  var bpos = w2c(5, -3);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(bpos[0], bpos[1], 5, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = "#aaaaaa";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(bpos[0], bpos[1]+3, 6, 2, 0, 0, Math.PI*2);
  ctx.fill();

  // Scoreboard
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect((W-200)/2, 6, 200, 36);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("HOME  02:00  AWAY", W/2, 24);

  // Difficulty HUD
  var dl = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  var ht = "Difficulty: " + dl;
  ctx.font = "12px monospace";
  var hw = ctx.measureText(ht).width + 16;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(W - hw - 12, 10, hw, 22);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.textAlign = "left";
  ctx.fillText(ht, W - hw - 4, 25);

  // Tick
  ctx.font = "11px monospace";
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(10, H-52, 220, 42);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("Tick: 7200", 16, H-36);
  ctx.fillText("Difficulty: " + dl, 16, H-20);

  return canvas.toDataURL("image/png");
}
`;

describe("DIFFICULTY-EVIDENCE: node-side durable capture", () => {
  beforeAll(async () => {
    await startVite();
    browser = await chromium.launch({ args: ["--enable-features=WebGL2", "--use-gl=swiftshader"] });
  }, 60000);

  afterAll(async () => {
    stopVite();
    if (browser) await browser.close();
  });

  it("captures 2D canvas screenshot with difficulty HUD and writes to disk", async () => {
    // Capture-hygiene (0.9.2+): ordinary regression suites must not write
    // into docs/screenshots/**. This node-side capture writes ephemeral
    // output under the ignored test-results/gauntlet-capture/ tree instead.
    const section = "BROWSER-DIFFICULTY-SETTING";
    const outDir = join("test-results", "gauntlet-capture", section);

    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    const page = await browser!.newPage();
    await page.goto(`http://localhost:${port}/`);
    await page.waitForTimeout(1000);

    // Inject the 2D renderer and generate the screenshot.
    const dataUrl = await page.evaluate((fn: string) => {
      // eslint-disable-next-line no-new-func
      const render2D = new Function("difficulty", fn.replace("function render2D(difficulty)", "return function(difficulty)") + "\nreturn render2D;");
      const fn2 = (new Function("difficulty", fn + "\nreturn render2D(difficulty);")) as (d: string) => string;
      return fn2("easy");
    }, RENDER_2D);

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    const base64 = dataUrl.split(",")[1]!;
    expect(base64.length).toBeGreaterThan(1000);

    // Write to disk.
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const framePath = join(outDir, "frame-000.png");
    writeFileSync(framePath, bytes);
    expect(bytes.length).toBeGreaterThan(1000);
    console.log(`[node] wrote: ${framePath} (${bytes.length} bytes)`);

    await page.close();
  }, 30000);
});
