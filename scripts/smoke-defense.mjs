// Defense e2e with the on-screen (touch) PS pad. No fake pads: mode 'local' with
// the pad driven by synthetic PointerEvents (pointerType 'touch'), landscape
// 844x390. Holds ✕ (pressure), □ (teammate pressure) and R2 (jockey) on the pad.
// No right stick exists on the touch pad, so the manual cursor switch
// (switchTarget, PES "right stick") is not tested here: it needs a physical pad.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const require = createRequire(process.env.PLAYWRIGHT_CORE_DIR ? `${process.env.PLAYWRIGHT_CORE_DIR}/` : import.meta.url);
const { chromium } = require('playwright-core');
const port = Number(process.env.DEFENSE_SMOKE_PORT ?? 4321);
const base = `http://127.0.0.1:${port}`;
const out = 'artifacts/local/smoke';
const shots = 'artifacts/local/defense-e2e';
// CI has no /workspace: keep the copies in the local artifacts there.
const mirror = '/workspace/defense-e2e';
mkdirSync(out, { recursive: true });
mkdirSync(shots, { recursive: true });

// Stop if another server uses the port.
const portBusy = await new Promise((resolve) => {
  const sock = connect({ host: '127.0.0.1', port, timeout: 1000 });
  sock.once('connect', () => { sock.destroy(); resolve(true); });
  sock.once('timeout', () => { sock.destroy(); resolve(true); });
  sock.once('error', () => resolve(false));
});
if (portBusy) {
  const message=`defense-e2e: port ${port} is already in use; stop the old server first`;
  writeFileSync(`${out}/defense.json`, `${JSON.stringify({results:[],errors:[message]},null,2)}\n`);
  console.error(message); process.exit(1);
}

// Run the server in a separate process group.
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
const results = [];
let checks = 0;
let browser;
let activePage;
let stage='startup';
const timeoutMs = Number(process.env.DEFENSE_SMOKE_TIMEOUT_MS ?? 180000);
const deadline = setTimeout(() => { errors.push(`Total timeout (${timeoutMs} ms)`); stop(); writeEvidence(); process.exit(1); }, timeoutMs);
function writeEvidence() { writeFileSync(`${out}/defense.json`, `${JSON.stringify({results, errors}, null, 2)}\n`); }
function check(value, message) { checks++; if (!value) throw new Error(message); }

try {
  await waitForServer();
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  const newPage = async () => {
    const context = await browser.newContext({ viewport: {width:844, height:390}, hasTouch: true });
    const page = activePage = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`HTTP ${r.status()} ${r.url()}`); });
    await page.addInitScript(() => { try { localStorage.setItem('fe.tipsSeen','1'); } catch {} });
    return { context, page };
  };

  // Synthetic touch pointer: press on an element of the pad, lift anywhere.
  const touchDown = (page, sel, id) => page.evaluate(([sel, id]) => {
    const el = sel ? document.querySelector(sel) : document.body;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true,
      pointerType: 'touch', pointerId: id, isPrimary: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
    return true;
  }, [sel, id]);
  const touchUp = (page, id, x = 0, y = 0) => page.evaluate(([id, x, y]) => {
    document.body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, composed: true,
      pointerType: 'touch', pointerId: id, isPrimary: true, clientX: x, clientY: y }));
  }, [id, x, y]);
  // Touch press at a point: the pad routes it by the element under the point.
  const touchDownAt = (page, x, y, id) => page.evaluate(([x, y, id]) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return false;
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true,
      pointerType: 'touch', pointerId: id, isPrimary: true, clientX: x, clientY: y }));
    return true;
  }, [x, y, id]);
  const touchMove = (page, id, x, y) => page.evaluate(([id, x, y]) => {
    document.body.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, composed: true,
      pointerType: 'touch', pointerId: id, isPrimary: true, clientX: x, clientY: y }));
  }, [id, x, y]);

  const startLocal = async (page) => {
    await page.goto(base, {waitUntil:'networkidle'});
    await page.locator('#mode').selectOption('local');
    await page.locator('.tactics summary').click();
    await page.locator('#quality').selectOption('low');
    await page.locator('#start-btn').click();
    await page.waitForFunction(() => window.__fe && ['kickoff','playing'].includes(window.__fe.phase), null, {timeout:30000, polling:200});
  };
  // A touch press on the ✕ pad button takes the kickoff.
  const takeKickoff = async (page) => {
    for (let i = 0; i < 5; i++) {
      if ((await page.evaluate(() => window.__fe?.phase)) === 'playing') return;
      check(await touchDown(page, '.tp-cross', 12), 'Pad ✕ button not found');
      await page.waitForTimeout(300);
      await touchUp(page, 12);
      await page.waitForFunction(() => window.__fe.phase === 'playing', null, {timeout:6000, polling:100}).catch(() => {});
    }
  };
  // Activates the pad and takes the kickoff: the common start of every stage.
  const beginPlay = async (page) => {
    await startLocal(page);
    await touchDown(page, null, 10);
    await page.waitForFunction(() => !document.querySelector('#touch-pad').hidden
      && document.body.classList.contains('touch-on'), null, {timeout:5000, polling:100});
    await takeKickoff(page);
    check(await page.evaluate(() => window.__fe.phase) === 'playing', 'Match did not reach playing');
  };
  // Smoke hooks live only under navigator.webdriver; retry while the state settles.
  const runHook = async (page, name, slot) => {
    for (let i = 0; i < 24; i++) {
      if (await page.evaluate(([n, s]) => window.__feSmoke?.[n]?.(s) === true, [name, slot])) return;
      await page.waitForTimeout(250);
    }
    throw new Error(`Smoke hook ${name}(${slot}) failed`);
  };
  const defenseState = (page, slot = 0) => page.evaluate(s => window.__feSmoke.defenseState(s), slot);
  // Stick press at the pad zone with a full -x drag: the selected player runs
  // away from the opponent half, so the carrier starts at a usable distance.
  const stickDown = async (page, id, dx) => {
    const zone = await page.evaluate(() => {
      const r = document.querySelector('.tp-zone[data-zone=stick]')?.getBoundingClientRect();
      return r ? { x: r.x + r.width * .3, y: r.y + r.height / 2 } : null;
    });
    check(!!zone, 'Stick zone not found');
    check(await touchDownAt(page, zone.x, zone.y, id), 'Stick zone press did not land');
    await touchMove(page, id, zone.x + dx, zone.y);
    return zone;
  };
  // Longest speed of the selected player inside a window: the press and the
  // jockey contain differ in speed limit, not in direction.
  const maxSpeed = (page, ms) => page.evaluate((ms) => new Promise(res => {
    let max = 0;
    const iv = setInterval(() => { max = Math.max(max, window.__feSmoke.defenseState(0).speed ?? 0); }, 20);
    setTimeout(() => { clearInterval(iv); res(max); }, ms);
  }), ms);
  // Defense setup: the selected player walks away from the opponent half, then
  // the smoke hook gives the ball to the nearest opponent of that slot.
  const setupDefense = async (page) => {
    await beginPlay(page);
    check(await stickDown(page, 41, -60), 'Stick press failed');
    await page.waitForTimeout(1400);
    await touchUp(page, 41);
    await page.waitForTimeout(150);
    await runHook(page, 'cpuBall', 0);
    await page.waitForFunction(() => {
      const s = window.__feSmoke.defenseState(0);
      return s.carrierTeam === 1 && s.selected !== null && !s.keeper;
    }, null, {timeout:8000, polling:50});
  };
  // A check that also saves the evidence frame. Only a clean page qualifies.
  const evidence = async (page, step, details={}) => {
    check(errors.length === 0, errors.join('; '));
    await page.screenshot({path:`${shots}/${step}.png`});
    results.push({step, ...details});
    console.log(`defense-e2e: ${step} passed`);
  };
  // A case with no screenshot of its own.
  const pass = (step, details={}) => { check(errors.length === 0, errors.join('; '));
    results.push({step, ...details}); console.log(`defense-e2e: ${step} passed`); };

  // 1: The opponent carries the ball. Holding ✕ on the pad sets the pressure
  // flag of the selected player, and he closes on the carrier.
  stage='press';
  {
    const { context, page } = await newPage();
    await setupDefense(page);
    const before = await defenseState(page);
    check(before.distance !== null, 'No distance to the carrier before the press');
    check(before.distance > 4, `Carrier starts too close to see the chase (${before.distance?.toFixed(2)} m)`);
    check(before.pressing === false, 'Pressing is already set before the ✕ hold');
    check(await touchDown(page, '.tp-cross', 11), 'Pad ✕ button not found');
    await page.waitForFunction(() => window.__feSmoke.defenseState(0).pressing === true, null, {timeout:5000, polling:50});
    await page.waitForTimeout(250);
    const mid = await defenseState(page);
    check(mid.pressing === true, 'Pressing flag is missing during the ✕ hold');
    await page.waitForTimeout(700);
    const end = await defenseState(page);
    check(end.pressing === true, 'Pressing flag is missing at the end of the ✕ hold');
    check(end.distance !== null, 'No distance to the carrier at the end of the ✕ hold');
    check(end.distance < before.distance - .5,
      `Distance did not shrink: ${before.distance.toFixed(2)} m → ${end.distance.toFixed(2)} m`);
    await evidence(page, '01-press', { start: before.distance, mid: mid.distance, end: end.distance,
      pressing: end.pressing, selected: end.selected, carrier: end.carrier });
    await touchUp(page, 11);
    await context.close();
  }

  // 2: Holding □ sends exactly one teammate at the carrier.
  stage='team-press';
  {
    const { context, page } = await newPage();
    await setupDefense(page);
    const before = await defenseState(page);
    check(before.teamPressCount === 0, `Teammates already pressing before □ (${before.teamPressCount})`);
    check(await touchDown(page, '.tp-square', 21), 'Pad □ button not found');
    await page.waitForFunction(() => window.__feSmoke.defenseState(0).teamPressCount === 1, null, {timeout:5000, polling:25});
    await page.waitForTimeout(250);
    const one = await defenseState(page);
    check(one.teamPressCount === 1, `Expected 1 teammate teamPressing, found ${one.teamPressCount}`);
    check(one.teamPressing.length === 1, `One teammate must carry the flag (${JSON.stringify(one.teamPressing)})`);
    check(!one.teamPressing.includes(one.selected), 'The flag is on the selected player, not on a teammate');
    await evidence(page, '02-team-press', { count: one.teamPressCount, pressing: one.teamPressing, selected: one.selected });
    await touchUp(page, 21);
    await context.close();
  }

  // 3: Two □ edges inside the pad window and held send two teammates.
  stage='multi-press';
  {
    const { context, page } = await newPage();
    await setupDefense(page);
    // One attempt: tap □, release, press again inside the 15-tick window and hold.
    const attempt = async (n) => {
      const tap = 30 + n * 2, hold = tap + 1;
      check(await touchDown(page, '.tp-square', tap), 'Pad □ button not found');
      await page.waitForTimeout(110);
      await touchUp(page, tap);
      await page.waitForTimeout(60);
      check(await touchDown(page, '.tp-square', hold), 'Pad □ button not found');
      const ok = await page.waitForFunction(() => window.__feSmoke.defenseState(0).teamPressCount === 2,
        null, {timeout:2000, polling:25}).then(() => true).catch(() => false);
      if (!ok) { await touchUp(page, hold); await page.waitForTimeout(450); }
      return ok ? hold : null;
    };
    let held = null, two = null;
    for (let n = 0; n < 3 && held === null; n++) {
      if (n > 0) { await runHook(page, 'cpuBall', 0); await page.waitForTimeout(120); }
      held = await attempt(n);
    }
    check(held !== null, 'Double tap + hold □ never gave two teammates teamPressing');
    await page.waitForTimeout(150);
    two = await defenseState(page);
    check(two.teamPressCount === 2, `Expected 2 teammates teamPressing, found ${two.teamPressCount}`);
    check(two.teamPressing.length === 2, `Two teammates must carry the flag (${JSON.stringify(two.teamPressing)})`);
    await evidence(page, '03-multi-press', { count: two.teamPressCount, pressing: two.teamPressing, selected: two.selected });
    await touchUp(page, held);
    await context.close();
  }

  // 4: R2 holds the contain: the flag is set and the selected player moves
  // slower than with the ✕ chase. 5: lifting every touch leaves no flag.
  stage='jockey';
  {
    const { context, page } = await newPage();
    await setupDefense(page);
    const before = await defenseState(page);
    check(before.jockeying === false, 'Jockeying is already set before the R2 hold');
    await stickDown(page, 51, -60);
    check(await touchDown(page, '.tp-r2', 52), 'Pad R2 button not found');
    const jockeySpeed = await maxSpeed(page, 500);
    const jockey = await defenseState(page);
    check(jockey.jockeying === true, 'Jockey flag is missing during the R2 hold');
    check(jockey.pressing === false, 'The ✕ pressure flag is set during the R2 hold');
    await evidence(page, '04-jockey', { jockeying: jockey.jockeying, speed: jockeySpeed, distance: jockey.distance });
    // Same stick, no R2: the ✕ chase gives the full speed of the same player.
    await touchUp(page, 52);
    const pressSampler = maxSpeed(page, 500);
    check(await touchDown(page, '.tp-cross', 53), 'Pad ✕ button not found');
    const pressSpeed = await pressSampler;
    const press = await defenseState(page);
    check(press.pressing === true, 'Pressure flag is missing during the ✕ hold');
    check(press.jockeying === false, 'The jockey flag survives the R2 release');
    check(pressSpeed > jockeySpeed * 1.2,
      `Press speed ${pressSpeed.toFixed(2)} is not clearly above jockey speed ${jockeySpeed.toFixed(2)}`);
    // Every finger up: no defense flag may stay set.
    for (const id of [51, 52, 53]) await touchUp(page, id);
    await page.waitForTimeout(500);
    const after = await defenseState(page);
    check(after.pressing === false, 'The ✕ pressure flag survived the release');
    check(after.jockeying === false, 'The R2 jockey flag survived the release');
    check(after.teamPressCount === 0, `A teamPress flag survived the release (${after.teamPressCount})`);
    pass('05-release', { jockeySpeed, pressSpeed, pressing: after.pressing, jockeying: after.jockeying,
      teamPressCount: after.teamPressCount, distance: after.distance });
    await context.close();
  }
} catch (e) { errors.push(`fatal (${stage}): ${e.message}`);
  try { results.push({failureState: await activePage?.evaluate(() => ({
    phase: window.__fe?.phase, defense: window.__feSmoke?.defenseState?.(0) ?? null }))}); } catch {}
}
finally {
  clearTimeout(deadline);
  try { await browser?.close(); } catch (e) { errors.push(`cleanup: ${e.message}`); }
  stop(); writeEvidence();
  if (existsSync(dirname(mirror))) { try { cpSync(shots, mirror, { recursive: true }); } catch (e) { errors.push(`mirror: ${e.message}`); } }
}
for (const e of errors) console.error(e);
console.log(`defense-e2e: checks=${checks} errors=${errors.length} shots=${shots}`);
process.exit(errors.length ? 1 : 0);
