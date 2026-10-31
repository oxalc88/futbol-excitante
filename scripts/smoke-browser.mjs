// Browser smoke test: serve dist/ with vite preview, open the game and the lab,
// prove the match clock runs, record CPU play, and fail on browser errors.
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const require = createRequire(process.env.PLAYWRIGHT_CORE_DIR ? `${process.env.PLAYWRIGHT_CORE_DIR}/` : import.meta.url);
const { chromium } = require('playwright-core');
const port = Number(process.env.SMOKE_PORT ?? 4317);
const base = `http://127.0.0.1:${port}`;
const out = 'artifacts/local/smoke';
mkdirSync(out, { recursive: true });

// Fail fast if an old server holds the port: it would serve an old build.
const portBusy = await new Promise((resolve) => {
  const sock = connect({ host: '127.0.0.1', port, timeout: 1000 });
  sock.once('connect', () => { sock.destroy(); resolve(true); });
  sock.once('timeout', () => { sock.destroy(); resolve(true); });
  sock.once('error', () => resolve(false));
});
if (portBusy) { console.error(`smoke: port ${port} is already in use; stop the old server first`); process.exit(1); }

// detached: the server gets its own process group, so stop() also kills vite's children.
const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
let stopped = false;
let serverExit = null;
server.once('exit', (code) => { serverExit = code; });
const stop = () => {
  if (stopped) return;
  stopped = true;
  try { process.kill(-server.pid, 'SIGTERM'); } catch { try { server.kill('SIGTERM'); } catch {} }
};
process.on('exit', stop);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stop(); process.exit(130); });

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    if (serverExit !== null) throw new Error(`preview server exited with code ${serverExit}`);
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
  // In human-vs-CPU mode a kickoff taken by the human team waits up to
  // rules.humanRestartTicks (360 sim ticks, about 6 s) for the human to play. On a slow
  // headless runner (SwiftShader, low fps, sim capped at 6 steps/frame) that idle wait alone
  // takes longer than the clock window. So act like a player: press pass (J) until the phase
  // leaves "Saque inicial", then require the clock to advance as before.
  const kickoffStart = Date.now();
  match.kickoffMs = null;
  while (Date.now() - kickoffStart < clockSeconds * 1000) {
    if ((await page.locator('#phase').innerText()).trim() !== 'Saque inicial') { match.kickoffMs = Date.now() - kickoffStart; break; }
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(250);
  }
  if (match.kickoffMs === null) errors.push(`game: kickoff did not happen within ${clockSeconds}s of pressing pass`);
  try {
    // The clock must change from the value read at start (and not be 00:00).
    await page.waitForFunction((start) => {
      const clock = document.querySelector('#clock')?.textContent?.trim();
      return /^\d+:\d{2}$/.test(clock ?? '') && clock !== '00:00' && clock !== start;
    }, match.clockStart, { timeout: clockSeconds * 1000 });
  } catch {
    errors.push(`game: clock did not advance within ${clockSeconds}s`);
  }
  match.clockEnd = (await page.locator('#clock').innerText()).trim();
  match.phase = (await page.locator('#phase').innerText()).trim();
  match.pauseCase = { pausedClock: null, afterHelp: null, resumedClock: null, passed: false };
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(200); // Let the HUD display the last pre-pause tick.
  match.pauseCase.pausedClock = (await page.locator('#clock').innerText()).trim();
  await page.locator('#help-btn').click();
  await page.locator('[data-close="help-dialog"]').first().click();
  await page.waitForTimeout(2000);
  match.pauseCase.afterHelp = (await page.locator('#clock').innerText()).trim();
  if (match.pauseCase.afterHelp !== match.pauseCase.pausedClock) errors.push('game: manually paused clock advanced after closing Help');
  await page.keyboard.press('KeyP');
  try {
    await page.waitForFunction((paused) => document.querySelector('#clock')?.textContent?.trim() !== paused,
      match.pauseCase.afterHelp, { timeout: clockSeconds * 1000 });
  } catch {
    errors.push('game: clock did not advance after resuming manual pause');
  }
  match.pauseCase.resumedClock = (await page.locator('#clock').innerText()).trim();
  match.pauseCase.passed = match.pauseCase.pausedClock === match.pauseCase.afterHelp
    && match.pauseCase.resumedClock !== match.pauseCase.afterHelp;

  const canvases = match.canvases = await page.locator('canvas').count();
  await page.screenshot({ path: `${out}/game.png` });
  if (canvases < 1) errors.push('game: no canvas after match start');

  // Quick play from a clean profile: there is no tips dialog and the match runs
  // at once, not paused.
  const quick = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  observe(quick, 'quick');
  match.quick = { tipsCount: null, mode: null, phase: null, paused: null, clockStart: null, clockEnd: null, tipsAgain: null };
  await quick.goto(`${base}/`, { waitUntil: 'networkidle' });
  await quick.locator('#quick-play-btn').waitFor({ state: 'visible', timeout: 15000 });
  match.quick.tipsCount = await quick.locator('#tips-dialog').count();
  if (match.quick.tipsCount !== 0) errors.push('quick: #tips-dialog exists before the first match');
  await quick.locator('#quick-play-btn').click();
  match.quick.mode = (await quick.locator('#match-mode').innerText()).trim();
  if (match.quick.mode !== 'TÚ CONTRA LA CPU') errors.push(`quick: unexpected match mode "${match.quick.mode}"`);
  // No tips block the kickoff: the match must not pause after quick play.
  try {
    await quick.waitForFunction(() => !!window.__fe && ['kickoff','playing'].includes(window.__fe.phase)
      && window.__fe.paused === false, null, { timeout: 15000 });
  } catch {
    errors.push('quick: match was paused after quick play');
  }
  match.quick.phase = await quick.evaluate(() => window.__fe?.phase ?? null);
  match.quick.paused = await quick.evaluate(() => window.__fe?.paused ?? null);
  if (match.quick.paused !== false) errors.push(`quick: paused is ${match.quick.paused} after quick play`);
  match.quick.tipsCount = await quick.locator('#tips-dialog').count();
  if (match.quick.tipsCount !== 0) errors.push('quick: #tips-dialog exists after quick play');
  match.quick.clockStart = (await quick.locator('#clock').innerText()).trim();
  // Same kickoff assist as the main flow: pass until the phase leaves the initial whistle.
  const quickKickoff = Date.now();
  while (Date.now() - quickKickoff < clockSeconds * 1000) {
    if ((await quick.locator('#phase').innerText()).trim() !== 'Saque inicial') break;
    await quick.keyboard.press('KeyJ');
    await quick.waitForTimeout(250);
  }
  try {
    await quick.waitForFunction((start) => {
      const clock = document.querySelector('#clock')?.textContent?.trim();
      return /^\d+:\d{2}$/.test(clock ?? '') && clock !== '00:00' && clock !== start;
    }, match.quick.clockStart, { timeout: clockSeconds * 1000 });
  } catch {
    errors.push('quick: clock did not advance after quick play');
  }
  match.quick.clockEnd = (await quick.locator('#clock').innerText()).trim();
  // After a reload the quick play also starts with no tips dialog.
  await quick.reload({ waitUntil: 'networkidle' });
  await quick.locator('#quick-play-btn').waitFor({ state: 'visible', timeout: 15000 });
  await quick.locator('#quick-play-btn').click();
  await quick.waitForTimeout(1500);
  match.quick.tipsAgain = await quick.locator('#tips-dialog').count();
  if (match.quick.tipsAgain !== 0) errors.push('quick: #tips-dialog exists after the reloaded quick play');
  if (await quick.evaluate(() => window.__fe?.paused ?? null) !== false) errors.push('quick: match paused after the reloaded quick play');
  if ((await quick.locator('#match-mode').innerText()).trim() !== 'TÚ CONTRA LA CPU') errors.push('quick: quick play after reload did not start the solo CPU match');
  await quick.screenshot({ path: `${out}/quick-play.png` });
  await quick.close();

  // Enter on the focused quick-play button starts the match too, with no dialog.
  const enter = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  observe(enter, 'enter');
  match.enter = { focused: null, mode: null, tips: null, paused: null };
  await enter.goto(`${base}/`, { waitUntil: 'networkidle' });
  await enter.locator('#quick-play-btn').waitFor({ state: 'visible', timeout: 15000 });
  match.enter.focused = await enter.evaluate(() => document.activeElement?.id ?? '');
  if (match.enter.focused !== 'quick-play-btn') errors.push(`enter: focus was on "${match.enter.focused}", not #quick-play-btn`);
  await enter.keyboard.press('Enter');
  await enter.waitForTimeout(1500);
  match.enter.mode = (await enter.locator('#match-mode').innerText()).trim();
  if (match.enter.mode !== 'TÚ CONTRA LA CPU') errors.push(`enter: Enter on the focused #quick-play-btn did not start the match (mode "${match.enter.mode}")`);
  match.enter.tips = await enter.locator('#tips-dialog').count();
  if (match.enter.tips !== 0) errors.push('enter: #tips-dialog exists after quick play');
  match.enter.paused = await enter.evaluate(() => window.__fe?.paused ?? null);
  if (match.enter.paused !== false) errors.push(`enter: paused is ${match.enter.paused} after quick play`);
  await enter.close();

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

  // Load a real engine replay through the same public UI used by players.
  const redStart = Date.now();
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/red-card-replay.ts', `${out}/red-card-replay.json`, `${out}/red-card-expected.json`]);
  const expected = JSON.parse(readFileSync(`${out}/red-card-expected.json`, 'utf8'));
  const red = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  observe(red, 'red-card');
  await red.goto(`${base}/`, { waitUntil: 'networkidle' });
  await red.locator('#replay-file').setInputFiles(`${out}/red-card-replay.json`);
  await red.waitForFunction(text => document.querySelector('#announcement')?.textContent === text, expected.text, { timeout: 20000 });
  const evidence = await red.locator('#announcement').evaluate(el => ({text:el.textContent,tick:Number(el.dataset.tick)}));
  await red.screenshot({ path: `${out}/red-card.png` });
  await red.waitForFunction(() => document.querySelector('#announcement')?.textContent === '', null, { timeout: 20000 });
  const expiredTick = Number(await red.locator('#announcement').getAttribute('data-tick'));
  if (expiredTick < expected.tick + 100 || expiredTick > expected.tick + 112) throw new Error(`red-card: unexpected expiry tick ${expiredTick}`);
  const elapsedMs = Date.now() - redStart; // informational only; correctness is checked in sim ticks above
  writeFileSync(`${out}/red-card.json`, `${JSON.stringify({...evidence,eventTick:expected.tick,event:expected.event,expiredTick,elapsedMs},null,2)}\n`);
  await red.close();

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
