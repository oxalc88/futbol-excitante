// Browser smoke test: serve dist/ with vite preview, open the game and the lab,
// start a CPU match, and fail on page errors or a missing canvas.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

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
try {
  await waitForServer();
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`console: ${m.text()}`); });
  // Missing resources are errors, except the browser's implicit favicon request.
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`http ${r.status()}: ${r.url()}`); });

  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.locator('#start-btn').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#start-btn').click();
  await page.waitForTimeout(4000);
  const canvases = await page.locator('canvas').count();
  await page.screenshot({ path: `${out}/game.png` });
  if (canvases < 1) errors.push('game: no canvas after match start');

  const lab = await browser.newPage();
  lab.on('pageerror', (e) => errors.push(`lab pageerror: ${e.message}`));
  await lab.goto(`${base}/lab.html`, { waitUntil: 'networkidle' });
  await lab.waitForTimeout(2000);
  await lab.screenshot({ path: `${out}/lab.png` });

  console.log(`smoke: canvases=${canvases} errors=${errors.length} screenshots=${out}`);
} catch (e) {
  errors.push(`fatal: ${e.message}`);
} finally {
  await browser?.close();
  stop();
}
for (const e of errors) console.error(e);
process.exit(errors.length ? 1 : 0);
