// Touch pad e2e: geometry, safe areas, visibility rules and context labels.
// Criteria 1-3 (buttons 4-5 come later). No fake pads: mode 'local' with the
// on-screen pad driven by synthetic PointerEvents (pointerType 'touch').
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const require = createRequire(process.env.PLAYWRIGHT_CORE_DIR ? `${process.env.PLAYWRIGHT_CORE_DIR}/` : import.meta.url);
const { chromium } = require('playwright-core');
const port = Number(process.env.TOUCH_SMOKE_PORT ?? 4319);
const base = `http://127.0.0.1:${port}`;
const out = 'artifacts/local/smoke';
const shots = 'artifacts/local/touch-e2e';
// CI has no /workspace: keep the copies in the local artifacts there.
const mirror = '/workspace/touch-e2e';
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
  const message=`touch-e2e: port ${port} is already in use; stop the old server first`;
  writeFileSync(`${out}/touch.json`, `${JSON.stringify({results:[],errors:[message]},null,2)}\n`);
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
const timeoutMs = Number(process.env.TOUCH_SMOKE_TIMEOUT_MS ?? 150000);
const deadline = setTimeout(() => { errors.push(`Total timeout (${timeoutMs} ms)`); stop(); writeEvidence(); process.exit(1); }, timeoutMs);
function writeEvidence() { writeFileSync(`${out}/touch.json`, `${JSON.stringify({results, errors}, null, 2)}\n`); }
function check(value, message) { checks++; if (!value) throw new Error(message); }
// Label rows of the four kick buttons, from src/adapters/touch-pad.ts.
const ROWS = {
  attack: { cross:'Pase', circle:'Centro', square:'Tiro', triangle:'Filtrado' },
  defence: { cross:'Entrada', circle:'Barrida', square:'Despeje', triangle:'Presión' },
  hold: { cross:'Mano', circle:'Volea', square:'Patear', triangle:'Al espacio' },
};
// Words of the old text panel and of every pad label row: no plain rectangular
// button outside the pad may show a touch action again.
const ACTION_WORDS = new Set(['pase','centro','tiro','filtrado','entrada','barrida','despeje','presion','cabeza','lanzarse','salir','mano','volea','al espacio','patear','elevado','proteger','correr','cambiar','arquero']);
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();

try {
  await waitForServer();
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  const newPage = async (width, height, hasTouch) => {
    const context = await browser.newContext({ viewport: {width, height}, hasTouch });
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
  const touchUp = (page, id) => page.evaluate(id => {
    document.body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, composed: true,
      pointerType: 'touch', pointerId: id, isPrimary: true }));
  }, id);

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
  // Smoke hooks live only under navigator.webdriver; retry while the state settles.
  const runHook = async (page, name, slot) => {
    for (let i = 0; i < 24; i++) {
      if (await page.evaluate(([n, s]) => window.__feSmoke?.[n]?.(s) === true, [name, slot])) return;
      await page.waitForTimeout(250);
    }
    throw new Error(`Smoke hook ${name}(${slot}) failed`);
  };
  const waitRow = async (page, row) => {
    await page.waitForFunction(row => {
      const g = s => document.querySelector(s)?.textContent ?? '';
      return g('.tp-cross .tp-label')===row.cross && g('.tp-circle .tp-label')===row.circle
        && g('.tp-square .tp-label')===row.square && g('.tp-triangle .tp-label')===row.triangle;
    }, row, {timeout:15000, polling:100});
  };
  const padState = (page) => page.evaluate(() => {
    const pad = document.querySelector('#touch-pad');
    const visible = el => !!el && el.getClientRects().length > 0;
    const outside = [];
    for (const b of document.querySelectorAll('button')) {
      if (pad?.contains(b) || !visible(b)) continue;
      outside.push({ id: b.id, action: b.dataset.action ?? null, panel: !!b.closest('.touch-controls'),
        text: (b.textContent ?? '').replace(/\s+/g,' ').trim() });
    }
    return {
      padHidden: pad?.hidden ?? true, touchOn: document.body.classList.contains('touch-on'),
      buttons: [...pad?.querySelectorAll('.tp-btn') ?? []].filter(visible).map(el => {
        const r = el.getBoundingClientRect();
        return { name: el.dataset.touch, x: r.x, y: r.y, w: r.width, h: r.height };
      }),
      outside,
    };
  });
  const assertNoRectTextButtons = (pad) => {
    const bad = pad.outside.filter(b => b.action || b.panel || ACTION_WORDS.has(norm(b.text)));
    check(bad.length === 0, `Rectangular text buttons outside the pad: ${JSON.stringify(bad)}`);
  };
  const evidence = async (page, step, details={}) => { check(errors.length===0, errors.join('; '));
    await page.screenshot({path:`${shots}/${step}.png`}); results.push({step,...details});
    console.log(`touch-e2e: ${step} passed`); };

  // 1: Landscape phone with touch: 7 round buttons, all inside the safe areas,
  // and no rectangular text action button left outside the pad during play.
  stage='landscape';
  {
    const { context, page } = await newPage(844, 390, true);
    await startLocal(page);
    await touchDown(page, null, 10);
    await page.waitForFunction(() => !document.querySelector('#touch-pad').hidden
      && document.body.classList.contains('touch-on'), null, {timeout:5000, polling:100});
    await takeKickoff(page);
    check(await page.evaluate(() => window.__fe.phase)==='playing', 'Match did not reach playing');
    await page.evaluate(() => { const s = document.documentElement.style;
      s.setProperty('--sa-top','20px'); s.setProperty('--sa-right','20px');
      s.setProperty('--sa-bottom','20px'); s.setProperty('--sa-left','20px'); });
    const pad = await padState(page);
    check(pad.touchOn, 'Touch pad did not activate');
    check(!pad.padHidden, 'Touch pad is hidden during play');
    check(pad.buttons.length===7, `Expected 7 visible pad buttons, found ${pad.buttons.length}`);
    const W = 844, H = 390, sa = 20;
    for (const b of pad.buttons) {
      check(b.w>=56 && b.h>=56, `Pad button ${b.name} is ${b.w}x${b.h}, below 56x56`);
      check(b.x>=sa && b.y>=sa && b.x+b.w<=W-sa && b.y+b.h<=H-sa,
        `Pad button ${b.name} at (${b.x},${b.y}) ${b.w}x${b.h} leaves the 20 px safe area`);
    }
    assertNoRectTextButtons(pad);
    await evidence(page, '1-landscape-pad', { buttons: pad.buttons });
    await touchUp(page, 10);
    await context.close();
  }

  // 2: Without touch the pad stays hidden, whatever the window size.
  stage='no-touch';
  for (const [name, width, height] of [['2a-desktop', 1280, 720], ['2b-small', 480, 360]]) {
    const { context, page } = await newPage(width, height, false);
    await page.goto(base, {waitUntil:'networkidle'});
    const pad = await padState(page);
    check(pad.padHidden, `#touch-pad is visible at ${width}x${height} without touch`);
    check(!pad.touchOn, `body.touch-on is set at ${width}x${height} without touch`);
    check(pad.buttons.length===0, `Pad buttons are visible at ${width}x${height} without touch`);
    await evidence(page, name, {width, height});
    await context.close();
  }

  // 3: The kick-button labels follow the game context of slot 0.
  stage='labels';
  {
    const { context, page } = await newPage(844, 390, true);
    await startLocal(page);
    await touchDown(page, null, 10);
    await page.waitForFunction(() => !document.querySelector('#touch-pad').hidden, null, {timeout:5000, polling:100});
    await takeKickoff(page);
    await runHook(page, 'ballAtFeet', 0);
    await waitRow(page, ROWS.attack);
    check(JSON.stringify(await labelRow(page))===JSON.stringify(ROWS.attack), 'Attack labels are wrong');
    await evidence(page, '3a-attack', { row: ROWS.attack });
    await runHook(page, 'ballAtFeet', 1);
    await waitRow(page, ROWS.defence);
    check(JSON.stringify(await labelRow(page))===JSON.stringify(ROWS.defence), 'Defence labels are wrong');
    await evidence(page, '3b-defence', { row: ROWS.defence });
    await runHook(page, 'keeperHold', 0);
    await waitRow(page, ROWS.hold);
    check(JSON.stringify(await labelRow(page))===JSON.stringify(ROWS.hold), 'Keeper hold labels are wrong');
    await evidence(page, '3c-keeper-hold', { row: ROWS.hold });
    await touchUp(page, 10);
    await context.close();
  }
} catch (e) { errors.push(`fatal (${stage}): ${e.message}`);
  try { results.push({failureState:await activePage?.evaluate(() => ({
    phase: window.__fe?.phase, padHidden: document.querySelector('#touch-pad')?.hidden ?? null }))}); } catch {}
}
finally {
  clearTimeout(deadline);
  try { await browser?.close(); } catch(e) { errors.push(`cleanup: ${e.message}`); }
  stop(); writeEvidence();
  if (existsSync(dirname(mirror))) { try { cpSync(shots, mirror, {recursive:true}); } catch(e) { errors.push(`mirror: ${e.message}`); } }
}
for (const e of errors) console.error(e);
console.log(`touch-e2e: checks=${checks} errors=${errors.length} shots=${shots}`);
process.exit(errors.length ? 1 : 0);

function labelRow(page) {
  return page.evaluate(() => ({
    cross: document.querySelector('.tp-cross .tp-label')?.textContent ?? '',
    circle: document.querySelector('.tp-circle .tp-label')?.textContent ?? '',
    square: document.querySelector('.tp-square .tp-label')?.textContent ?? '',
    triangle: document.querySelector('.tp-triangle .tp-label')?.textContent ?? '',
  }));
}
