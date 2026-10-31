// Touch pad e2e: geometry, safe areas, visibility rules, context labels,
// multitouch, keeper rush and shot charge. No fake pads: mode 'local' with the
// on-screen pad driven by synthetic PointerEvents (pointerType 'touch').
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { shot } from './e2e-lib.mjs';

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

// The pure pass-evidence helper of tests/touch-pass-evidence.test.ts, injected
// into every page: the same source with the export keywords stripped so it runs
// as a classic script and hangs the pure functions off window.
const helperSource = readFileSync(new URL('./touch-pass-evidence.mjs', import.meta.url), 'utf8');
const helperInit = `window.__touchPassEvidence=(()=>{\n${helperSource.replace(/^export\s+/gm, '')}\nreturn {beginPassEvidence,recordPassSample,passEvidenceVerdict};})();`;

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
// Context words of the four kick buttons, from src/adapters/touch-pad.ts.
// The pad shows glyphs only: each word lives in data-action.
const ROWS = {
  attack: { cross:'Pase', circle:'Centro', square:'Tiro', triangle:'Filtrado' },
  defence: { cross:'Entrada', circle:'Barrida', square:'Despeje', triangle:'' },
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
    await page.addInitScript({ content: helperInit });
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
  // System cancel of a pointer: the pad drops its buttons without a release.
  const touchCancel = (page, id, x = 0, y = 0) => page.evaluate(([id, x, y]) => {
    document.body.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, cancelable: true, composed: true,
      pointerType: 'touch', pointerId: id, isPrimary: true, clientX: x, clientY: y }));
  }, [id, x, y]);
  const touchMove = (page, id, x, y) => page.evaluate(([id, x, y]) => {
    document.body.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, composed: true,
      pointerType: 'touch', pointerId: id, isPrimary: true, clientX: x, clientY: y }));
  }, [id, x, y]);
  // Activates the pad and takes the kickoff, the common start of stages 4-5.
  const beginPlay = async (page) => {
    await startLocal(page);
    await touchDown(page, null, 10);
    await page.waitForFunction(() => !document.querySelector('#touch-pad').hidden
      && document.body.classList.contains('touch-on'), null, {timeout:5000, polling:100});
    await takeKickoff(page);
    check(await page.evaluate(() => window.__fe.phase) === 'playing', 'Match did not reach playing');
  };

  const startLocal = async (page) => {
    await page.goto(base, {waitUntil:'networkidle'});
    await page.locator('#mode').selectOption('local');
    await page.locator('.options summary').click();
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
      const g = s => document.querySelector(s)?.dataset.action ?? '';
      return g('.tp-cross')===row.cross && g('.tp-circle')===row.circle
        && g('.tp-square')===row.square && g('.tp-triangle')===row.triangle;
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
  // Waits until the match plays again: a pass press ends a waiting kickoff or a
  // human restart of team 0, and the countdown ends any other one.
  const waitPlaying = async (page, timeout = 30000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if ((await page.evaluate(() => window.__fe?.phase ?? '')) === 'playing') return;
      await page.keyboard.press('KeyJ');
      await page.waitForTimeout(250);
    }
    throw new Error('Match did not reach the playing phase');
  };
  // Forces a waiting free kick with the smoke hook and waits until the restart
  // state really is the free kick of `team` and the HUD has refreshed the pad
  // for it: L2 shows only for the own attacking free kick of slot 0. No
  // keyboard here: the hook alone changes the state.
  const forceFreeKick = async (page, team) => {
    for (let i = 0; i < 80; i++) {
      const s = await page.evaluate((t) => {
        window.__feSmoke?.setPiece?.('free-kick', t);
        const state = window.__feSmoke?.setPieceState?.();
        return { phase: window.__fe?.phase ?? '', kind: state?.restart?.kind ?? null,
          team: state?.restart?.team ?? null,
          l2Hidden: document.querySelector('.tp-l2')?.hidden ?? null };
      }, team);
      if (s.phase === 'free-kick' && s.kind === 'free-kick' && s.team === team
        && s.l2Hidden === (team !== 0)) return s;
      await page.waitForTimeout(250);
    }
    throw new Error(`Smoke hook setPiece(free-kick,${team}) never produced the waiting free kick`);
  };
  const forceSetPiece=async(page,kind,team)=>{for(let i=0;i<80;i++){const s=await page.evaluate(([k,t])=>{window.__feSmoke?.setPiece?.(k,t);const r=window.__feSmoke?.setPieceState?.().restart;return {phase:window.__fe?.phase,kind:r?.kind,team:r?.team};},[kind,team]);if(s.kind===kind&&s.team===team)return s;await page.waitForTimeout(250);}throw new Error(`Smoke hook setPiece(${kind},${team}) failed`);};
  // Visible own text throughout the page; only the match chrome is allowed.
  const visibleText = (page) => page.evaluate(() => {
    const allowed = '.scoreboard, #player-name, #announcement, .sr-only, .wordmark, #menu-btn, footer #help-btn';
    const own = (el) => [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
    const found=[];
    for(const el of document.querySelectorAll('body *')) {
      if(el.closest(allowed)) continue;
      const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
      if(el.hidden||r.width<=0||r.height<=0||cs.display==='none'||cs.visibility!=='visible') continue;
      const text=own(el); if(text)found.push({tag:el.tagName.toLowerCase(),id:el.id,text});
    }
    return {found,dialogOpen:!!document.querySelector('dialog[open]'),badAttrs:[...document.querySelectorAll('#app [title],#app [placeholder]')].map(e=>e.outerHTML)};
  });
  const assertNoHelpText=(name,data)=>{
    check(!data.dialogOpen,`${name}: dialog is open during text scan`);
    check(data.badAttrs.length===0,`${name}: title/placeholder attributes: ${JSON.stringify(data.badAttrs)}`);
    check(data.found.length===0,`${name}: visible text: ${JSON.stringify(data.found)}`);
  };
  // Boxes of the radar, #viewport and the window, for stage 8. The radar keeps
  // its own band over the match.
  const radarLayout = (page) => page.evaluate(() => {
    const el = document.querySelector('#radar');
    const box = (r) => ({ x: r.x, y: r.y, w: r.width, h: r.height });
    const v = document.querySelector('#viewport').getBoundingClientRect();
    const r = el?.getBoundingClientRect() ?? null;
    const cs = el ? getComputedStyle(el) : null;
    return { visible: !!el && !el.hidden && el.getClientRects().length > 0 && !!cs
        && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0,
      radar: r ? box(r) : null,
      boxes: { viewport: box(v),
        window: { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight } } };
  });
  // Visible #radar with a finite positive rect, fully inside the window and
  // inside #viewport, as the removed hint band check did for the radar.
  const assertRadarInside = (name, data) => {
    check(!!data.radar && data.visible, `${name}: #radar is not visible`);
    const r = data.radar;
    check([r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w > 0 && r.h > 0,
      `${name}: #radar rect is not finite and positive (${r.x},${r.y},${r.w},${r.h})`);
    for (const [where, frame] of Object.entries(data.boxes)) {
      check(r.x >= frame.x && r.y >= frame.y && r.x + r.w <= frame.x + frame.w
        && r.y + r.h <= frame.y + frame.h,
        `${name}: #radar leaves the ${where} (${JSON.stringify(r)} in ${JSON.stringify(frame)})`);
    }
  };

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

  // 4a: Multitouch: stick + R1 sprint, then a third finger passes. The pass
  // frame lives one tick, so the lasting ball effects back the assertion too.
  stage='multitouch';
  {
    const { context, page } = await newPage(844, 390, true);
    await beginPlay(page);
    await runHook(page, 'ballAtFeet', 0);
    const zone = await page.evaluate(() => {
      const r = document.querySelector('.tp-zone[data-zone=stick]')?.getBoundingClientRect();
      return r ? { x: r.x + r.width * .3, y: r.y + r.height / 2 } : null;
    });
    check(!!zone, 'Stick zone not found');
    check(await touchDownAt(page, zone.x, zone.y, 21), 'Stick zone press did not land');
    await touchMove(page, 21, zone.x + 50, zone.y);
    check(await touchDown(page, '.tp-r1', 22), 'Pad R1 button not found');
    await page.waitForTimeout(600);
    const sprintFrame = await page.evaluate(() =>
      window.__fe.frames.find(f => f.slot === 0 && f.sprint === true && f.move.x > 0.5) ?? null);
    check(!!sprintFrame, 'No slot-0 frame with sprint and move.x > 0.5');
    // Strict pass evidence: a NEW contact by the original passer after the
    // press, at the exact contact tick of his own resolved pass action, plus
    // proof that the ball left: a speed rise over the press sample, a growing
    // distance from the passer, or a later touch by another player. A stale
    // lastTouch, an action-start before the contact, a changed selected identity
    // or an opponent-only touch never count. The accumulator and the recorder
    // start BEFORE the press, so no contact frame can slip between the press and
    // the observation.
    const baseline = await page.evaluate(() => {
      window.__passAttempt = window.__touchPassEvidence.beginPassEvidence(window.__fe);
      window.__passVerdict = window.__touchPassEvidence.passEvidenceVerdict(window.__passAttempt);
      window.__passRecorder = requestAnimationFrame(function tick() {
        window.__passAttempt = window.__touchPassEvidence.recordPassSample(window.__passAttempt, window.__fe);
        window.__passVerdict = window.__touchPassEvidence.passEvidenceVerdict(window.__passAttempt);
        window.__passRecorder = requestAnimationFrame(tick);
      });
      return window.__passAttempt;
    });
    check(baseline.passerId !== null, 'No slot-0 player to pass with');
    let verdict = null, failure = null;
    try {
      check(await touchDown(page, '.tp-cross', 23), 'Pad ✕ button not found');
      await page.waitForTimeout(150);
      await touchUp(page, 23);
      await page.waitForFunction(() => window.__passVerdict.ok === true, null, {timeout:8000, polling:50});
      verdict = await page.evaluate(() => window.__passVerdict);
    } catch (e) {
      // The failing accumulator carries the ticks that explain the miss: keep it
      // and report it with the original error instead of hiding it.
      failure = e;
      verdict = await page.evaluate(() => window.__passVerdict).catch(() => null);
    } finally {
      await page.evaluate(() => {
        if (window.__passRecorder !== null && window.__passRecorder !== undefined) {
          cancelAnimationFrame(window.__passRecorder); window.__passRecorder = null;
        }
      }).catch(() => {});
    }
    check(!failure && verdict?.ok === true,
      failure ? `Strict pass evidence failed: ${failure.message} · ${JSON.stringify(verdict)}`
        : `Strict pass evidence missing: ${verdict?.reason ?? 'no verdict'} · ${JSON.stringify(verdict)}`);
    await evidence(page, '4a-multitouch', { sprint: sprintFrame, pass: verdict });
    for (const id of [21, 22, 23]) await touchUp(page, id);
    await context.close();
  }

  // 4b: Keeper rush by touch: △ alone, then R1 + △ must sprint faster.
  stage='keeper-rush';
  {
    const { context, page } = await newPage(844, 390, true);
    await beginPlay(page);
    const rushState = () => page.evaluate(() => {
      const k = window.__fe.players.find(p => p.id === window.__fe.selected[0]);
      return { rushing: k?.keeperRushing === true, speed: Math.hypot(k?.vx ?? 0, k?.vy ?? 0) };
    });
    const waitRush = () => page.waitForFunction(() => {
      const k = window.__fe.players.find(p => p.id === window.__fe.selected[0]);
      return k?.keeperRushing === true;
    }, null, {timeout:5000, polling:100});
    await runHook(page, 'oneOnOne', 0);
    check(await touchDown(page, '.tp-triangle', 30), 'Pad △ button not found');
    await waitRush();
    await page.waitForTimeout(500);
    const a = await rushState();
    check(a.rushing, 'Keeper did not rush on △');
    await evidence(page, '4b-rush', { speedA: a.speed });
    await touchUp(page, 30);
    await runHook(page, 'oneOnOne', 0);
    check(await touchDown(page, '.tp-r1', 31), 'Pad R1 button not found');
    check(await touchDown(page, '.tp-triangle', 32), 'Pad △ button not found');
    await waitRush();
    await page.waitForTimeout(500);
    const b = await rushState();
    check(b.rushing, 'Keeper did not rush while sprinting');
    check(b.speed > a.speed * 1.1, `Sprint rush ${b.speed.toFixed(2)} is not faster than ${a.speed.toFixed(2)}`);
    await evidence(page, '4b-sprint-rush', { speedA: a.speed, speedB: b.speed });
    await touchUp(page, 31);
    await touchUp(page, 32);
    await context.close();
  }

  // 5: Shot charge: a longer □ hold kicks harder. The lift may land anywhere:
  // a pointerup outside the pad still ends the press and executes the shot.
  stage='shot-power';
  {
    const { context, page } = await newPage(844, 390, true);
    await beginPlay(page);
    // Screen centre: outside the stick zone and every pad button.
    const centre = { x: 422, y: 195 };
    const shot = async (hold, id) => {
      await runHook(page, 'ballAtFeet', 0);
      const before = await page.evaluate(() => window.__fe.shots.actions[0]);
      check(await touchDown(page, '.tp-square', id), 'Pad □ button not found');
      await page.waitForTimeout(hold);
      // The sampler starts before the release: the shot leaves right at the
      // pointerup, so a sampler started after it misses the fastest sample.
      const sampler = page.evaluate(() => new Promise(res => {
        let max = 0;
        const iv = setInterval(() => { const b = window.__fe.ball;
          max = Math.max(max, Math.hypot(b.vx, b.vy)); }, 40);
        setTimeout(() => { clearInterval(iv); res(max); }, 1000);
      }));
      await touchUp(page, id, centre.x, centre.y);
      await page.waitForFunction(prev => window.__fe.shots.actions[0] > prev, before,
        {timeout:6000, polling:50});
      const maxSpeed = await sampler;
      const after = await page.evaluate(() => ({ actions: window.__fe.shots.actions[0],
        power: window.__fe.shots.power[0] }));
      check(after.actions > before, `Shot did not count after a ${hold} ms hold`);
      return { hold, maxSpeed, ...after };
    };
    const s200 = await shot(200, 40);
    await evidence(page, '5-shot-200', s200);
    const s800 = await shot(800, 41);
    await evidence(page, '5-shot-800', s800);
    check(s800.power > s200.power, `Power after 800 ms (${s800.power}) is not above 200 ms (${s200.power})`);
    check(s800.maxSpeed > s200.maxSpeed, `Ball speed after 800 ms (${s800.maxSpeed.toFixed(2)}) is not above 200 ms (${s200.maxSpeed.toFixed(2)})`);
    await context.close();
  }

  // 6: Keeper switch by touch: L1 + R2 held together switches the slot-0
  // cursor to the keeper while the team defends.
  stage='keeper-switch';
  {
    const { context, page } = await newPage(844, 390, true);
    await beginPlay(page);
    await runHook(page, 'ballAtFeet', 1);
    await waitRow(page, ROWS.defence);
    const before = await page.evaluate(() => {
      const p = window.__fe.players.find(p => p.id === window.__fe.selected[0]);
      return { selected: window.__fe.selected[0], keeper: p?.keeper === true };
    });
    check(!before.keeper, 'Slot-0 already controls the keeper before the switch');
    check(await touchDown(page, '.tp-l1', 41), 'Pad L1 button not found');
    check(await touchDown(page, '.tp-r2', 42), 'Pad R2 button not found');
    await page.waitForTimeout(150);
    await touchUp(page, 41);
    await touchUp(page, 42);
    await page.waitForFunction(() => {
      const p = window.__fe.players.find(p => p.id === window.__fe.selected[0]);
      return p?.keeper === true;
    }, null, {timeout:6000, polling:100});
    const after = await page.evaluate(() => window.__fe.selected[0]);
    check(after !== before.selected, `Keeper switch kept the same player ${after}`);
    await evidence(page, '6-keeper-switch', { before: before.selected, after });
    await context.close();
  }

  // 7: A system pointercancel during a charged □ press drops the touch
  // without firing the shot: no shot frame may be counted.
  stage='cancel';
  {
    const { context, page } = await newPage(844, 390, true);
    await beginPlay(page);
    await runHook(page, 'ballAtFeet', 0);
    const before = await page.evaluate(() => window.__fe.shots.actions[0]);
    check(await touchDown(page, '.tp-square', 50), 'Pad □ button not found');
    await page.waitForTimeout(500);
    await touchCancel(page, 50);
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({ actions: window.__fe.shots.actions[0],
      power: window.__fe.shots.power[0] }));
    check(after.actions === before, `pointercancel executed the charged shot (${before} → ${after.actions})`);
    await evidence(page, '7-cancel', { before, after: after.actions });
    await context.close();
  }

  // 8: No help text: the match HUD shows no written instruction, in open play
  // and in a waiting free kick, with and without touch. Only glyphs remain.
  stage='no-help-text';
  for (const spec of [
    { name: '8a-hint-desktop', width: 1280, height: 720, hasTouch: false, defending: false },
    { name: '8b-hint-touch', width: 844, height: 390, hasTouch: true, defending: true },
  ]) {
    const { context, page } = await newPage(spec.width, spec.height, spec.hasTouch);
    if (spec.hasTouch) await beginPlay(page);
    else { await startLocal(page); await waitPlaying(page); }
    const pad = await padState(page);
    if (spec.hasTouch) {
      check(pad.touchOn, `${spec.name}: body.touch-on is missing on the touch page`);
      check(!pad.padHidden, `${spec.name}: #touch-pad is hidden on the touch page`);
    } else {
      check(!pad.touchOn, `${spec.name}: body.touch-on is set without touch`);
      check(pad.padHidden, `${spec.name}: #touch-pad is visible without touch`);
    }
    // Fresh pad state right before every text sample and screenshot: the values
    // written to the evidence must describe the very saved frame.
    const freshPad = async () => {
      const p = await padState(page);
      if (spec.hasTouch) {
        check(p.touchOn, `${spec.name}: body.touch-on is missing on the touch page`);
        check(!p.padHidden, `${spec.name}: #touch-pad is hidden on the touch page`);
      } else {
        check(!p.touchOn, `${spec.name}: body.touch-on is set without touch`);
        check(p.padHidden, `${spec.name}: #touch-pad is visible without touch`);
      }
      return p;
    };
    // Open play: no help text.
    const open = await visibleText(page);
    assertNoHelpText(`${spec.name}-open`, open);
    const openRadar = await radarLayout(page);
    assertRadarInside(`${spec.name}-open`, openRadar);
    await evidence(page, `${spec.name}-open`, { width: spec.width, height: spec.height,
      hasTouch: spec.hasTouch, state: 'open', touchOn: pad.touchOn,
      padHidden: pad.padHidden, found: open.found, radar: openRadar.radar });
    // Attacking waiting free kick: setPiece(free-kick, 0).
    await forceFreeKick(page, 0);
    const padAttack = await freshPad();
    const attack = await visibleText(page);
    assertNoHelpText(`${spec.name}-attack`, attack);
    const attackRadar = await radarLayout(page);
    assertRadarInside(`${spec.name}-attack`, attackRadar);
    await evidence(page, `${spec.name}-attack`, { width: spec.width, height: spec.height,
      hasTouch: spec.hasTouch, state: 'attack', touchOn: padAttack.touchOn,
      padHidden: padAttack.padHidden, found: attack.found, radar: attackRadar.radar });
    // Defending waiting free kick: a free kick of team 1 on the touch layout.
    if (spec.defending) {
      await forceFreeKick(page, 1);
      const padDefend = await freshPad();
      const defend = await visibleText(page);
      assertNoHelpText(`${spec.name}-defend`, defend);
      const defendRadar = await radarLayout(page);
      assertRadarInside(`${spec.name}-defend`, defendRadar);
      await evidence(page, `${spec.name}-defend`, { width: spec.width, height: spec.height,
        hasTouch: spec.hasTouch, state: 'defend', touchOn: padDefend.touchOn,
        padHidden: padDefend.padHidden, found: defend.found, radar: defendRadar.radar });
    }
    for(const [kind,team,name] of [['corner',0,'corner-attack'],['corner',1,'corner-defend'],['penalty',0,'penalty-attack'],['penalty',1,'penalty-defend'],['throw-in',0,'throw-in'],['goal-kick',0,'goal-kick']]){
      await forceSetPiece(page,kind,team);const state=await visibleText(page);assertNoHelpText(`${spec.name}-${name}`,state);
      await evidence(page,`${spec.name}-${name}`,{width:spec.width,height:spec.height,state:name,found:state.found});
    }
    await context.close();
  }
  // 9: No pad control over the HUD: every visible pad button rect against every
  // visible HUD rect (top toolbar controls, scoreboard, radar), in attack,
  // defence and a set piece, at two landscape phone sizes; then pause is tapped
  // with the pad visible.
  stage='hud-overlap';
  const HUD_SEL = ['#pause-btn','#fullscreen-btn','.field-toolbar','.scoreboard','#radar'];
  for (const [W, H] of [[844, 390], [932, 430]]) {
    const { context, page } = await newPage(W, H, true);
    await beginPlay(page);
    const sample = async (state) => {
      const { pad, hud } = await page.evaluate((sels) => {
        const rect = el => { const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height }; };
        const visible = el => {
          if (!el || el.hidden || el.getClientRects().length === 0) return false;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        const pad = [...document.querySelectorAll('.tp-btn')].filter(visible)
          .map(el => ({ name: el.dataset.touch, ...rect(el) }));
        const hud = [];
        for (const sel of sels) for (const el of document.querySelectorAll(sel))
          if (visible(el)) hud.push({ name: sel, ...rect(el) });
        return { pad, hud };
      }, HUD_SEL);
      const want = state === 'set-piece' ? 8 : 7;
      check(pad.length === want, `${W}x${H} ${state}: expected ${want} visible pad buttons, found ${pad.length}`);
      // L2 shows only while the own waiting free kick of team 0 waits.
      const l2 = pad.filter(b => b.name === 'l2');
      check((state === 'set-piece') === (l2.length === 1),
        `${W}x${H} ${state}: L2 visible for ${l2.length} pad buttons`);
      // No two pad buttons cover each other.
      for (let i = 0; i < pad.length; i++) for (let j = i + 1; j < pad.length; j++) {
        const a = pad[i], b = pad[j];
        check(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y,
          `${W}x${H} ${state}: pad ${a.name} ${JSON.stringify(a)} overlaps pad ${b.name} ${JSON.stringify(b)}`);
      }
      for (const b of pad)
        check(b.w >= 56 && b.h >= 56, `${W}x${H} ${state}: pad ${b.name} is ${b.w}x${b.h}, below 56x56`);
      for (const sel of ['#pause-btn', '.scoreboard', '#radar'])
        check(hud.some(h => h.name === sel), `${W}x${H} ${state}: ${sel} is not in the HUD sample`);
      let minGap = Infinity, closest = null;
      for (const a of pad) for (const b of hud) {
        const gap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w),
          b.y - (a.y + a.h), a.y - (b.y + b.h));
        if (gap < minGap) { minGap = gap; closest = `${a.name} over ${b.name}`; }
        check(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y,
          `${W}x${H} ${state}: pad ${a.name} ${JSON.stringify(a)} overlaps HUD ${b.name} ${JSON.stringify(b)}`);
      }
      await evidence(page, `9-hud-${W}x${H}-${state}`,
        { width: W, height: H, state, minGap, closest, pad, hud });
    };
    await runHook(page, 'ballAtFeet', 0);
    await waitRow(page, ROWS.attack);
    await sample('attack');
    await runHook(page, 'ballAtFeet', 1);
    await waitRow(page, ROWS.defence);
    await sample('defence');
    await forceFreeKick(page, 0);
    await sample('set-piece');
    // Pause tapped with the pad on top of the screen: the HUD keeps the hit.
    const c = await page.evaluate(() => {
      const r = document.querySelector('#pause-btn').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const under = await page.evaluate(([x, y]) => {
      const target = document.querySelector('#pause-btn');
      const el = document.elementFromPoint(x, y);
      return { ok: !!el && (el === target || target.contains(el)),
        hit: el ? `${el.tagName.toLowerCase()}#${el.id || ''}.${el.className || ''}` : 'none' };
    }, [c.x, c.y]);
    check(under.ok, `${W}x${H}: #pause-btn centre (${c.x},${c.y}) is covered by ${under.hit}`);
    const ps = await padState(page);
    check(ps.touchOn && !ps.padHidden, `${W}x${H}: the touch pad is not visible before the pause tap`);
    await page.touchscreen.tap(c.x, c.y);
    await page.waitForFunction(() => window.__fe?.paused === true
      && !document.querySelector('#pause-overlay').hidden, null, {timeout:5000, polling:100});
    check(await page.locator('#touch-pad').evaluate(el=>el.hidden), `${W}x${H}: touch pad is visible while paused`);
    check(await page.evaluate(() => window.__fe?.paused === true
      && !document.querySelector('#pause-overlay').hidden), `${W}x${H}: pause did not stick`);
    await evidence(page, `9-hud-${W}x${H}-paused`, { paused: true, pauseCenter: { x: c.x, y: c.y } });
    await context.close();
  }

  // 10: L2 on the waiting free kick of team 0 gives the kick to the second
  // taker.
  stage='l2-second-taker';
  {
    const { context, page } = await newPage(844, 390, true);
    await beginPlay(page);
    await forceFreeKick(page, 0);
    await page.waitForFunction(() => { const el = document.querySelector('.tp-l2');
      return !!el && !el.hidden && el.getClientRects().length > 0; }, null, {timeout:5000, polling:100});
    check(await touchDown(page, '.tp-l2', 41), 'Pad L2 button not found');
    await page.waitForFunction(() => window.__feSmoke.setPieceState().restart?.second?.id != null,
      null, {timeout:5000, polling:100});
    const second = await page.evaluate(() => window.__feSmoke.setPieceState().restart?.second?.id ?? null);
    check(second !== null, 'No second taker beside the ball');
    check(await touchDown(page, '.tp-square', 42), 'Pad □ button not found');
    await page.waitForTimeout(500);
    await touchUp(page, 42);
    await page.waitForFunction(() => window.__feSmoke.setPieceState().restriction?.kind === 'free-kick',
      null, {timeout:8000, polling:20});
    const taker = (await page.evaluate(() => window.__feSmoke.setPieceState().restriction))?.taker;
    check(taker === second, `Free kick taker ${taker} is not the second taker ${second}`);
    const lastTouch = await page.evaluate(() => window.__fe.ball.lastTouch?.playerId ?? null);
    await evidence(page, '10-l2-second-taker', { second, taker, lastTouch });
    await touchUp(page, 41);
    await context.close();
  }
  // 11: Portrait touch blocks the match; landscape resumes without a manual pause.
  stage='portrait';
  {
    const {context,page}=await newPage(844,390,true);await beginPlay(page);await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('#rotate-notice').hidden===false&&window.__fe.paused===true,null,{timeout:5000,polling:50});
    check(await page.locator('#rotate-notice').isVisible(),'Rotation icon is not visible in portrait');
    check((await page.locator('#rotate-notice').textContent()).trim()==='','Rotation notice contains visible text');
    check(await page.locator('#rotate-notice svg').count()>0,'Rotation icon SVG is missing');
    check(await page.evaluate(()=>window.__fe.paused===true),'Portrait match is not paused');
    const tick=await page.evaluate(()=>window.__fe.tick);await page.waitForTimeout(1500);
    check(await page.evaluate(t=>window.__fe.tick===t,tick),'Clock advanced in portrait');
    check(await page.locator('#pause-overlay').evaluate(e=>e.hidden),'Pause menu showed during rotation block');
    await evidence(page,'11-portrait',{tick});await shot(page,'touch-e2e','390x844',11,'portrait');
    await page.setViewportSize({width:844,height:390});
    await page.waitForFunction(()=>document.querySelector('#rotate-notice').hidden&&window.__fe.paused===false,null,{timeout:3000,polling:50});
    await page.waitForFunction(t=>window.__fe.tick>t,tick,{timeout:2000,polling:50});
    await evidence(page,'11-landscape',{tick:await page.evaluate(()=>window.__fe.tick)});await shot(page,'touch-e2e','844x390',11,'landscape');
    await context.close();
  }
  // Touch activation itself must apply the portrait block; handing back to
  // keyboard while blocked must remove it and resume the match.
  {
    const {context,page}=await newPage(390,844,true);await beginPlay(page);
    await page.keyboard.press('KeyA');
    await page.waitForFunction(()=>!document.body.classList.contains('touch-on')&&!window.__fe.paused,null,{timeout:3000,polling:50});
    const r=await page.locator('#viewport').boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
    await page.waitForFunction(()=>document.body.classList.contains('touch-on')&&document.querySelector('#rotate-notice').hidden===false&&window.__fe.paused===true,null,{timeout:3000,polling:50});
    const tick=await page.evaluate(()=>window.__fe.tick);await page.waitForTimeout(500);
    check(await page.evaluate(t=>window.__fe.tick===t,tick),'Portrait touch activation did not freeze the clock');
    await page.keyboard.press('KeyA');
    await page.waitForFunction(()=>!document.body.classList.contains('touch-on')&&document.querySelector('#rotate-notice').hidden&&window.__fe.paused===false,null,{timeout:3000,polling:50});
    await page.waitForFunction(t=>window.__fe.tick>t,tick,{timeout:2000,polling:50});
    await evidence(page,'11-portrait-touch-handoff',{tick});await shot(page,'touch-e2e','390x844',12,'portrait-touch-handoff');await context.close();
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
    cross: document.querySelector('.tp-cross')?.dataset.action ?? '',
    circle: document.querySelector('.tp-circle')?.dataset.action ?? '',
    square: document.querySelector('.tp-square')?.dataset.action ?? '',
    triangle: document.querySelector('.tp-triangle')?.dataset.action ?? '',
  }));
}
