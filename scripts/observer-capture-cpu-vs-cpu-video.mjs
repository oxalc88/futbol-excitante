import { chromium } from 'playwright';
import { mkdir, writeFile, rename, stat } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.OBSERVER_BASE_URL ?? 'http://127.0.0.1:5173';
const durationMs = Number(process.env.OBSERVER_DURATION_MS ?? 60000);
const outDir = path.resolve(process.env.OBSERVER_OUT_DIR ?? 'artifacts/observer-cpu-vs-cpu-video');
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const video = page.video();
const url = `${baseUrl}/src/apps/browser/index.html?mode=ai-match-5v5`;

const consoleLines = [];
page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => consoleLines.push(`[pageerror] ${err.message}`));

await page.goto(url, { waitUntil: 'networkidle' });

const modeSelect = page.locator('#mode-select');
if (await modeSelect.count() && await modeSelect.isVisible()) {
  await modeSelect.selectOption('ai-match-5v5');
}
const startButton = page.locator('#start-button');
if (await startButton.count() && await startButton.isVisible()) {
  await startButton.click();
}

await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(outDir, 'cpu-vs-cpu-start.png'), fullPage: true });
await page.waitForTimeout(Math.floor(durationMs / 2));
await page.screenshot({ path: path.join(outDir, 'cpu-vs-cpu-mid.png'), fullPage: true });
await page.waitForTimeout(Math.ceil(durationMs / 2));
await page.screenshot({ path: path.join(outDir, 'cpu-vs-cpu-end.png'), fullPage: true });

const summary = await page.evaluate(() => ({
  tick: document.querySelector('#tick-display')?.textContent ?? null,
  scoreA: document.querySelector('#scoreboard-score-a')?.textContent ?? null,
  scoreB: document.querySelector('#scoreboard-score-b')?.textContent ?? null,
  clock: document.querySelector('#scoreboard-clock')?.textContent ?? null,
  mode: document.querySelector('#mode-select')?.value ?? null,
  setupMenuDisplay: getComputedStyle(document.querySelector('#setup-menu')).display,
  title: document.title,
}));

await writeFile(path.join(outDir, 'summary.json'), JSON.stringify({
  url,
  durationMs,
  capturedAtUtc: new Date().toISOString(),
  summary,
}, null, 2));
await writeFile(path.join(outDir, 'browser-console.log'), consoleLines.join('\n'));

await context.close();
await browser.close();

if (video) {
  const original = await video.path();
  const target = path.join(outDir, 'cpu-vs-cpu-5v5.webm');
  try { await rename(original, target); } catch {}
  try {
    const s = await stat(target);
    console.log(`video=${target} bytes=${s.size}`);
  } catch {
    console.log(`video-original=${original}`);
  }
}
console.log(`evidence=${outDir}`);
