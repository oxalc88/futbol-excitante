// Browser smoke test: serve dist/ with vite preview, open the game and the lab,
// prove the match clock runs, record CPU play, and fail on browser errors.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(process.env.PLAYWRIGHT_CORE_DIR ? `${process.env.PLAYWRIGHT_CORE_DIR}/` : import.meta.url);
const { chromium } = require('playwright-core');
const port = Number(process.env.SMOKE_PORT ?? 4317);
const base = `http://127.0.0.1:${port}`;
const out = 'artifacts/local/smoke';
mkdirSync(out, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
const stop = () => { try { server.kill('SIGTERM'); } catch {} };
process.on('exit', stop);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(base)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('preview server did not start');
}

const errors = [];
let browser;
let videoContext;
const match = { clockStart: null, clockEnd: null, score: null, phase: null, canvases: 0, errors };
function observe(page, label) {
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`${label} console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${label} http ${r.status()}: ${r.url()}`); });
}
try {
  await waitForServer();
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  observe(page, 'game');

  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.locator('#start-btn').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#start-btn').click();
  match.clockStart = (await page.locator('#clock').innerText()).trim();
  match.score = (await page.locator('#score').innerText()).trim();
  const clockSeconds = Number(process.env.SMOKE_CLOCK_SECONDS ?? 8);
  if (!Number.isFinite(clockSeconds) || clockSeconds <= 0) throw new Error('SMOKE_CLOCK_SECONDS must be positive');
  try {
    await page.waitForFunction(() => {
      const clock = document.querySelector('#clock')?.textContent?.trim();
      return /^\d+:\d{2}$/.test(clock ?? '') && clock !== '00:00';
    }, null, { timeout: clockSeconds * 1000 });
  } catch {
    errors.push(`game: clock did not advance within ${clockSeconds}s`);
  }
  match.clockEnd = (await page.locator('#clock').innerText()).trim();
  match.phase = (await page.locator('#phase').innerText()).trim();
  const canvases = match.canvases = await page.locator('canvas').count();
  await page.screenshot({ path: `${out}/game.png` });
  if (canvases < 1) errors.push('game: no canvas after match start');

  videoContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: `${out}/video`, size: { width: 1280, height: 720 } },
  });
  const watch = await videoContext.newPage();
  observe(watch, 'watch');
  await watch.goto(`${base}/`, { waitUntil: 'networkidle' });
  await watch.locator('#start-btn').waitFor({ state: 'visible', timeout: 15000 });
  await watch.locator('#mode').selectOption('watch');
  await watch.locator('#start-btn').click();
  await watch.waitForTimeout(6000);
  if ((await watch.locator('#match-mode').innerText()).trim() !== 'CPU CONTRA CPU') errors.push('watch: CPU mode did not start');
  if (await watch.locator('canvas').count() < 1) errors.push('watch: no canvas after match start');
  await watch.screenshot({ path: `${out}/cpu-vs-cpu.png` });
  await videoContext.close(); // Closing flushes the recorded video to disk.
  videoContext = undefined;

  const lab = await browser.newPage();
  observe(lab, 'lab');
  await lab.goto(`${base}/lab.html`, { waitUntil: 'networkidle' });
  await lab.waitForTimeout(2000);
  await lab.screenshot({ path: `${out}/lab.png` });

  console.log(`smoke: canvases=${canvases} errors=${errors.length} screenshots=${out}`);
} catch (e) {
  errors.push(`fatal: ${e.message}`);
} finally {
  try {
    await videoContext?.close();
    await browser?.close();
  } catch (e) {
    errors.push(`cleanup: ${e.message}`);
  } finally {
    stop();
    writeFileSync(`${out}/match.json`, `${JSON.stringify(match, null, 2)}\n`);
  }
}
for (const e of errors) console.error(e);
process.exit(errors.length ? 1 : 0);
