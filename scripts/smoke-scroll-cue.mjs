// Test the dialog scroll cue: a fade and a CSS chevron that shows hidden content
// below the cut of a dialog. It holds no text and never takes a pointer event.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(process.env.PLAYWRIGHT_CORE_DIR ? `${process.env.PLAYWRIGHT_CORE_DIR}/` : import.meta.url);
const { chromium } = require('playwright-core');
const tag = 'scroll-cue-e2e';
const port = Number(process.env.SCROLL_CUE_PORT ?? 4322);
const base = `http://127.0.0.1:${port}`;
const out = 'artifacts/local/smoke';
const evidenceFile = 'scroll-cue.json';
// CI has no /workspace: keep the screenshots in the local artifacts there.
const shots = process.env.SCROLL_CUE_SHOTS ?? (process.env.CI ? 'artifacts/local/scroll-cue-e2e' : '/workspace/scroll-cue-e2e');
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
  const message = `${tag}: port ${port} is already in use; stop the old server first`;
  writeFileSync(`${out}/${evidenceFile}`, `${JSON.stringify({results: [], errors: [message]}, null, 2)}\n`);
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
let browser;
let activePage;
let stage = 'startup';
const timeoutMs = Number(process.env.SCROLL_CUE_SMOKE_TIMEOUT_MS ?? 180000);
const deadline = setTimeout(() => { errors.push(`Total timeout (${timeoutMs} ms)`); stop(); writeEvidence(); process.exit(1); }, timeoutMs);
function writeEvidence() { writeFileSync(`${out}/${evidenceFile}`, `${JSON.stringify({results, errors}, null, 2)}\n`); }
function check(value, message) { if (!value) throw new Error(message); }

// Page helper: reads the dialog, the cue, the fade, the chevron and the scroll range.
function installProbe() {
  // Effective chevron opacity: its own opacity times every ancestor up to the cue.
  window.__cueArrowOpacity = (id) => {
    const cue = document.querySelector(`#${id} > .scroll-cue`);
    const arrow = cue?.querySelector('.scroll-cue-arrow');
    if (!arrow) return null;
    let value = 1;
    for (let node = arrow; node; node = node.parentElement) {
      value *= Number(getComputedStyle(node).opacity);
      if (node === cue) break;
    }
    return value;
  };
  window.__cueProbe = (id) => {
    const d = document.getElementById(id);
    if (!d) return null;
    const cue = d.querySelector(':scope > .scroll-cue');
    if (!cue) return { open: d.open, more: d.dataset.more ?? null, cue: false };
    const describe = (el) => ({ tag: el.tagName, id: el.id, cls: String(el.className) });
    const focusables = (root) => [...root.querySelectorAll('button,input,select,textarea,summary,a[href],[tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.disabled && el.getClientRects().length > 0);
    const fade = cue.querySelector('.scroll-cue-fade');
    const arrow = cue.querySelector('.scroll-cue-arrow');
    const rect = d.getBoundingClientRect();
    const fr = fade.getBoundingClientRect();
    const ar = arrow.getBoundingClientRect();
    const style = getComputedStyle(d);
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const pseudo = [];
    for (const el of [cue, fade, arrow]) for (const p of ['::before', '::after']) pseudo.push(getComputedStyle(el, p).content);
    const list = focusables(d);
    const activeRect = document.activeElement?.getBoundingClientRect?.();
    return {
      open: d.open,
      more: d.dataset.more ?? null,
      scrollTop: d.scrollTop,
      scrollHeight: d.scrollHeight,
      clientHeight: d.clientHeight,
      paddingBottom,
      paddingTop,
      overflow: d.scrollHeight > d.clientHeight,
      dialog: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      fade: { left: fr.left, top: fr.top, right: fr.right, bottom: fr.bottom, opacity: Number(getComputedStyle(fade).opacity), visibility: getComputedStyle(fade).visibility },
      arrow: { x: (ar.left + ar.right) / 2, y: (ar.top + ar.bottom) / 2, top: ar.top, bottom: ar.bottom, width: ar.width, height: ar.height },
      cueAnim: getComputedStyle(arrow).animationName,
      arrowOpacity: window.__cueArrowOpacity(id),
      cuePointer: getComputedStyle(cue).pointerEvents,
      cueAriaHidden: cue.getAttribute('aria-hidden'),
      cueLabel: [cue, fade, arrow].map(el => el.getAttribute('aria-label') ?? el.getAttribute('title')).filter(Boolean),
      cueText: (cue.textContent ?? '').trim(),
      pseudo,
      lastFocusable: list.length ? describe(list[list.length - 1]) : null,
      focusableCount: list.length,
      focusIndex: list.indexOf(document.activeElement),
      focus: list.includes(document.activeElement) ? describe(document.activeElement) : null,
      focusRect: activeRect && activeRect.width && activeRect.height
        ? { left: activeRect.left, top: activeRect.top, right: activeRect.right, bottom: activeRect.bottom } : null,
      controls: [...d.querySelectorAll('button,select,input,summary')]
        .filter(el => !el.disabled && el.getClientRects().length > 0)
        .map(el => {
          const r = el.getBoundingClientRect();
          return { tag: el.tagName, id: el.id, cls: String(el.className), rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } };
        }),
      hit: (x, y) => {
        const el = document.elementFromPoint(x, y);
        return el ? { tag: el.tagName, id: el.id, cls: String(el.className), insideCue: !!el.closest('.scroll-cue') } : null;
      },
    };
  };
}

async function frames(page, count = 2) {
  await page.evaluate((n) => new Promise((resolve) => {
    const step = (left) => left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1));
    step(n);
  }), count);
}
const probe = (page, id) => page.evaluate((id) => window.__cueProbe(id), id);
const settle = async (page) => { await frames(page, 2); await page.waitForTimeout(60); };

// Rectangle helpers: an edge touch is no overlap.
const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const fullyInside = (rect, box) => rect.left >= box.left && rect.right <= box.right && rect.top >= box.top && rect.bottom <= box.bottom;
const fadeBox = (s) => ({ left: s.fade.left, top: s.fade.top, right: s.fade.right, bottom: s.fade.bottom });
const labelOf = (c) => `${c.tag}${c.id ? `#${c.id}` : ''}${c.cls ? `.${c.cls}` : ''}`;

// The fade lives in the dialog bottom padding band and never covers a control
// that the player sees whole.
// A control is fully visible when its rect is inside the dialog content box.
// The content box starts at the top padding edge and ends at the bottom padding
// edge. The dialog border box sets the left and right edges.
function contentBox(s) {
  return { left: s.dialog.left, right: s.dialog.right, top: s.dialog.top + s.paddingTop, bottom: s.dialog.bottom - s.paddingBottom };
}

function expectBand(s, label) {
  check(s.fade.top >= s.dialog.bottom - s.paddingBottom - 1,
    `${label}: fade top ${s.fade.top} is above the content box bottom ${s.dialog.bottom - s.paddingBottom - 1}`);
  const content = contentBox(s);
  // Ignore overlaps of 1px or less, because a subpixel edge is not a real cut.
  const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1
    && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  const covered = s.controls.filter(c => fullyInside(c.rect, content) && overlap(c.rect, fadeBox(s)));
  check(covered.length === 0, `${label}: the fade covers a fully visible ${covered.map(labelOf).join(', ')}`);
}

// The fade ramps from transparent to solid dialog color over its top 30%. The
// chevron sits still in the solid part below the ramp and inside the dialog
// bottom edge, so a cut-off row never shows through behind it.
function expectCueOnSolidFade(s, label) {
  const solidTop = s.fade.top + (s.fade.bottom - s.fade.top) * 0.3;
  check(s.arrow.top >= solidTop - 1,
    `${label}: chevron top ${s.arrow.top} is above the solid fade start ${solidTop} (fade ${s.fade.top}-${s.fade.bottom})`);
  check(s.arrow.bottom <= s.fade.bottom + 0.5,
    `${label}: chevron bottom ${s.arrow.bottom} is below the band bottom ${s.fade.bottom}`);
  check(s.arrow.bottom <= s.dialog.bottom + 0.5,
    `${label}: chevron bottom ${s.arrow.bottom} is below the dialog bottom ${s.dialog.bottom}`);
}

async function expectFadeVisible(page, id) {
  await page.waitForFunction(([id]) => {
    const fade = document.querySelector(`#${id} > .scroll-cue .scroll-cue-fade`);
    return fade && Number(getComputedStyle(fade).opacity) > 0.95;
  }, [id], { timeout: 2500, polling: 16 });
}

// The chevron hides with the fade: opacity 0 while data-more is false and
// visible while the dialog still hides content.
async function expectArrow(page, id, more, label) {
  const shown = more === 'true';
  try {
    await page.waitForFunction(([id, shown]) => {
      const value = window.__cueArrowOpacity(id);
      return value !== null && (shown ? value > 0.5 : value === 0);
    }, [id, shown], { timeout: 2500, polling: 16 });
  } catch {
    const s = await probe(page, id);
    throw new Error(`${label}: the chevron opacity is ${s.arrowOpacity} with data-more "${s.more}"`);
  }
}

// A mid-scroll cut-off state: the same band rules must hold while content hides.
async function expectCutOff(page, id, label) {
  const s = await probe(page, id);
  check(s.more === 'true', `${label}: data-more is "${s.more}" at the cut-off`);
  await expectFadeVisible(page, id);
  await expectArrow(page, id, 'true', label);
  expectBand(s, label);
  expectCueOnSolidFade(s, label);
  return s;
}

// Real keyboard navigation: Tab to the last control, checking the cue at every
// press, then require data-more to turn false.
async function tabToLast(page, id, label) {
  const start = await probe(page, id);
  check(start.focusableCount > 0, `${label}: no focusable control in #${id}`);
  let presses = 0;
  let reached = start.focusIndex === start.focusableCount - 1;
  while (!reached && presses < 60) {
    await page.keyboard.press('Tab');
    presses++;
    await settle(page);
    const s = await probe(page, id);
    check(s.focusIndex >= 0, `${label}: Tab ${presses} left the dialog (focus ${s.focusIndex})`);
    if (s.more === 'true') {
      check(!(s.focusRect && intersects(s.focusRect, fadeBox(s))),
        `${label}: Tab ${presses} focuses ${s.focus ? labelOf(s.focus) : 'a control'} under the fade`);
    }
    reached = s.focusIndex === s.focusableCount - 1;
  }
  check(reached, `${label}: Tab did not reach the last control in 60 presses`);
  await expectMore(page, id, 'false', `${label} after Tab to the last control`);
  await expectArrow(page, id, 'false', `${label} after Tab to the last control`);
  const end = await probe(page, id);
  return { presses, focused: end.focus, more: end.more };
}

// One wheel notch keeps the dialog partway down for a real cut-off state.
async function wheelPart(page, id, delta) {
  const start = await probe(page, id);
  await page.mouse.move((start.dialog.left + start.dialog.right) / 2, (start.dialog.top + start.dialog.bottom) / 2);
  await page.mouse.wheel(0, delta);
  await settle(page);
  return probe(page, id);
}

async function expectMore(page, id, expected, label) {
  try {
    await page.waitForFunction(([id, expected]) => document.getElementById(id)?.dataset.more === expected, [id, expected], { timeout: 2500, polling: 16 });
  } catch {
    const s = await probe(page, id);
    throw new Error(`${label}: data-more stayed "${s.more}" (scrollTop ${s.scrollTop}, range ${s.scrollHeight - s.clientHeight}, padding ${s.paddingBottom})`);
  }
}

// Scroll a dialog with the mouse wheel until the range ends.
async function wheelToEnd(page, id) {
  const start = await probe(page, id);
  await page.mouse.move((start.dialog.left + start.dialog.right) / 2, (start.dialog.top + start.dialog.bottom) / 2);
  let last = start.scrollTop;
  for (let i = 0; i < 80; i++) {
    if ((await probe(page, id)).more === 'false') break;
    await page.mouse.wheel(0, 700);
    await settle(page);
    const s = await probe(page, id);
    if (s.more === 'false') break;
    if (s.scrollTop === last) break;
    last = s.scrollTop;
  }
  return probe(page, id);
}

// Scroll a dialog with a synthetic finger swipe (CDP touch events).
async function swipeUp(page, cdp, id, distance = 240) {
  const s = await probe(page, id);
  const x = Math.round((s.dialog.left + s.dialog.right) / 2);
  const y0 = Math.round(s.dialog.top + s.dialog.height * 0.8);
  const y1 = y0 - distance;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y0 + (y1 - y0) * i / 10) }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(240);
  return probe(page, id);
}

// The cue draws only when the dialog hides content: fade pinned, no text, no hit.
async function checkCueChrome(page, id, label) {
  const s = await probe(page, id);
  check(s.more === 'true', `${label}: data-more is "${s.more}" with hidden content`);
  check(s.cuePointer === 'none', `${label}: cue pointer-events is "${s.cuePointer}"`);
  check(s.cueAriaHidden === 'true', `${label}: cue is not aria-hidden`);
  check(s.cueText === '', `${label}: cue holds text "${s.cueText}"`);
  check(s.cueAnim === 'none', `${label}: the chevron runs the animation "${s.cueAnim}"`);
  check(s.cueLabel.length === 0, `${label}: cue holds an aria label or title`);
  const emptyContent = (value) => ['none', 'normal', '""', "''", ''].includes(value);
  const badContent = s.pseudo.filter(value => !emptyContent(value));
  check(badContent.length === 0, `${label}: pseudo content "${badContent.join(' ')}"`);
  check(Math.abs(s.fade.bottom - s.dialog.bottom) <= 2, `${label}: fade bottom ${s.fade.bottom} is not pinned to the dialog bottom ${s.dialog.bottom}`);
  check(s.fade.top >= s.dialog.top - 2 && s.fade.top < s.fade.bottom, `${label}: fade sits outside the dialog`);
  check(s.fade.visibility === 'visible', `${label}: fade is not visible`);
  await expectFadeVisible(page, id);
  await expectArrow(page, id, 'true', label);
  expectBand(s, label);
  const points = [
    { x: (s.fade.left + s.fade.right) / 2, y: (s.fade.top + s.fade.bottom) / 2 },
    { x: s.arrow.x, y: s.arrow.y },
  ];
  for (const point of points) {
    const hit = await page.evaluate(({ x, y, id }) => window.__cueProbe(id).hit(x, y), { x: point.x, y: point.y, id });
    check(!!hit, `${label}: nothing at the cue point (${point.x}, ${point.y})`);
    check(!hit.insideCue, `${label}: the cue intercepts the click at (${point.x}, ${point.y}) with ${hit.tag}.${hit.cls}`);
  }
  return s;
}

// The setup dialog hides content at 1280x720 and 844x390. Open the options block
// if the content fits, so the scroll stages always run on real overflow.
async function ensureOverflow(page, id) {
  let s = await probe(page, id);
  if (s.overflow) return s;
  const closedDetails = await page.evaluate((id) => !!document.querySelector(`#${id} details:not([open]) summary`), id);
  if (closedDetails) {
    await page.locator(`#${id} details:not([open]) summary`).first().click();
    await settle(page);
  }
  return probe(page, id);
}

const pageErrors = (page, list) => {
  page.on('requestfailed', r => { if (!r.url().endsWith('/favicon.ico')) list.push(`Request failed: ${r.url()}`); });
  page.on('pageerror', e => list.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) list.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) list.push(`HTTP ${r.status()} ${r.url()}`); });
};

try {
  await waitForServer();
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  const openPage = async (name, options) => {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    activePage = page;
    page.setDefaultTimeout(8000);
    pageErrors(page, errors);
    await page.addInitScript(installProbe);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.getElementById('setup-dialog')?.open === true);
    await settle(page);
    results.push({ step: `${name}-open`, browser: name });
    return { context, page };
  };
  const evidence = async (page, name) => {
    check(errors.length === 0, errors.join('; '));
    await page.screenshot({ path: `${shots}/${name}.png` });
    console.log(`${tag}: ${name} passed`);
  };
  const record = (step, details) => { results.push({ step, ...details }); };

  // 1-4: Desktop 1280x720 without touch.
  {
    const { context, page } = await openPage('desktop', { viewport: { width: 1280, height: 720 } });
    stage = 'desktop-setup';
    const setup = await ensureOverflow(page, 'setup-dialog');
    check(setup.overflow, 'desktop: the setup dialog fits after the options block opens');
    check(setup.more === 'true', `desktop setup: data-more is "${setup.more}" with hidden content`);
    const top = await checkCueChrome(page, 'setup-dialog', 'desktop setup top');
    record('desktop-setup-top', { scrollHeight: top.scrollHeight, clientHeight: top.clientHeight, paddingBottom: top.paddingBottom });
    await evidence(page, '1-desktop-setup-top');

    stage = 'desktop-setup-cut-off';
    const cut = await wheelPart(page, 'setup-dialog', 12);
    check(cut.scrollTop > top.scrollTop, `desktop setup cut-off: the wheel did not scroll (${top.scrollTop} -> ${cut.scrollTop})`);
    await expectCutOff(page, 'setup-dialog', 'desktop setup cut-off');
    record('desktop-setup-cut-off', { scrollTop: cut.scrollTop });

    stage = 'desktop-setup-end';
    const end = await wheelToEnd(page, 'setup-dialog');
    check(end.more === 'false', `desktop setup end: data-more is "${end.more}" at the end`);
    check(end.scrollTop > top.scrollTop, 'desktop setup end: the wheel did not scroll the dialog');
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('#setup-dialog > .scroll-cue .scroll-cue-fade')).opacity) < 0.05, undefined, { timeout: 2500, polling: 16 });
    await expectArrow(page, 'setup-dialog', 'false', 'desktop setup end');
    record('desktop-setup-end', { scrollTop: end.scrollTop, range: end.scrollHeight - end.clientHeight });
    await evidence(page, '2-desktop-setup-end');

    stage = 'desktop-setup-focus';
    await page.evaluate(() => { document.getElementById('setup-dialog').scrollTop = 0; });
    await settle(page);
    await expectMore(page, 'setup-dialog', 'true', 'desktop setup back to top');
    const focusedSetup = await tabToLast(page, 'setup-dialog', 'desktop setup');
    record('desktop-setup-focus-last', focusedSetup);
    await evidence(page, '3-desktop-setup-focus-last');

    stage = 'desktop-help';
    await page.locator('#menu-help-btn').click();
    await page.waitForFunction(() => document.getElementById('help-dialog')?.open === true);
    await settle(page);
    const help = await probe(page, 'help-dialog');
    check(help.overflow, 'desktop help: the help dialog fits at 1280x720');
    check(help.more === 'true', `desktop help: data-more is "${help.more}" with hidden content`);
    await checkCueChrome(page, 'help-dialog', 'desktop help top');
    record('desktop-help-top', { scrollHeight: help.scrollHeight, clientHeight: help.clientHeight });
    await evidence(page, '4-desktop-help-top');

    stage = 'desktop-help-cut-off';
    const helpCut = await wheelPart(page, 'help-dialog', 500);
    check(helpCut.scrollTop > help.scrollTop, `desktop help cut-off: the wheel did not scroll (${help.scrollTop} -> ${helpCut.scrollTop})`);
    await expectCutOff(page, 'help-dialog', 'desktop help cut-off');
    record('desktop-help-cut-off', { scrollTop: helpCut.scrollTop });

    stage = 'desktop-help-end';
    const helpEnd = await wheelToEnd(page, 'help-dialog');
    check(helpEnd.more === 'false', `desktop help end: data-more is "${helpEnd.more}" at the end`);
    await expectArrow(page, 'help-dialog', 'false', 'desktop help end');
    record('desktop-help-end', { scrollTop: helpEnd.scrollTop, range: helpEnd.scrollHeight - helpEnd.clientHeight });
    await evidence(page, '5-desktop-help-end');

    stage = 'desktop-help-focus';
    await page.evaluate(() => { document.getElementById('help-dialog').scrollTop = 0; });
    await settle(page);
    await expectMore(page, 'help-dialog', 'true', 'desktop help back to top');
    const focusedHelp = await tabToLast(page, 'help-dialog', 'desktop help');
    record('desktop-help-focus-last', focusedHelp);
    await evidence(page, '6-desktop-help-focus-last');
    await context.close();
  }

  // 5-8: Touch 844x390 with touch scrolling.
  {
    const { context, page } = await openPage('touch', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const cdp = await context.newCDPSession(page);
    stage = 'touch-setup';
    const setup = await ensureOverflow(page, 'setup-dialog');
    check(setup.overflow, 'touch: the setup dialog fits after the options block opens');
    await checkCueChrome(page, 'setup-dialog', 'touch setup top');
    await evidence(page, '7-touch-setup-top');
    const cutSetup = await swipeUp(page, cdp, 'setup-dialog', 100);
    check(cutSetup.scrollTop > setup.scrollTop, `touch setup cut-off: the swipe did not scroll the dialog (${setup.scrollTop} -> ${cutSetup.scrollTop})`);
    await expectCutOff(page, 'setup-dialog', 'touch setup cut-off');
    record('touch-setup-cut-off', { scrollTop: cutSetup.scrollTop });
    let swipeEnd = cutSetup;
    for (let i = 0; i < 20 && swipeEnd.more !== 'false'; i++) swipeEnd = await swipeUp(page, cdp, 'setup-dialog');
    check(swipeEnd.more === 'false', `touch setup: data-more is "${swipeEnd.more}" after swipes to the end`);
    await expectArrow(page, 'setup-dialog', 'false', 'touch setup end');
    check(swipeEnd.scrollTop > setup.scrollTop, 'touch setup: the swipe did not change the scroll position');
    record('touch-setup-swipe', { from: setup.scrollTop, to: swipeEnd.scrollTop, range: swipeEnd.scrollHeight - swipeEnd.clientHeight });
    await evidence(page, '8-touch-setup-swipe');

    stage = 'touch-setup-focus';
    await page.evaluate(() => { document.getElementById('setup-dialog').scrollTop = 0; });
    await settle(page);
    await expectMore(page, 'setup-dialog', 'true', 'touch setup back to top');
    const focusedSetup = await tabToLast(page, 'setup-dialog', 'touch setup');
    record('touch-setup-focus-last', focusedSetup);
    await evidence(page, '9-touch-setup-focus-last');

    stage = 'touch-help';
    await page.locator('#menu-help-btn').click();
    await page.waitForFunction(() => document.getElementById('help-dialog')?.open === true);
    await settle(page);
    const help = await probe(page, 'help-dialog');
    check(help.overflow, 'touch help: the help dialog fits at 844x390');
    await checkCueChrome(page, 'help-dialog', 'touch help top');
    await evidence(page, '10-touch-help-top');
    let helpSwipe = await swipeUp(page, cdp, 'help-dialog', 500);
    check(helpSwipe.scrollTop > help.scrollTop, 'touch help cut-off: the swipe did not scroll the dialog');
    await expectCutOff(page, 'help-dialog', 'touch help cut-off');
    record('touch-help-cut-off', { scrollTop: helpSwipe.scrollTop });
    for (let i = 0; i < 20 && helpSwipe.more !== 'false'; i++) helpSwipe = await swipeUp(page, cdp, 'help-dialog');
    check(helpSwipe.more === 'false', `touch help: data-more is "${helpSwipe.more}" after swipes to the end`);
    await expectArrow(page, 'help-dialog', 'false', 'touch help end');
    await page.evaluate(() => { document.getElementById('help-dialog').scrollTop = 0; });
    await settle(page);
    await expectMore(page, 'help-dialog', 'true', 'touch help back to top');
    const focusedHelp = await tabToLast(page, 'help-dialog', 'touch help');
    record('touch-help-focus-last', { ...focusedHelp, scrollTop: helpSwipe.scrollTop });
    await evidence(page, '11-touch-help-end');
    await context.close();
  }

  // 9: A tall viewport: the setup dialog fits, so the cue stays hidden.
  {
    const { context, page } = await openPage('tall', { viewport: { width: 1280, height: 1400 } });
    stage = 'tall-setup';
    const setup = await probe(page, 'setup-dialog');
    check(!setup.overflow, `tall: the setup dialog hides content (${setup.scrollHeight} > ${setup.clientHeight})`);
    await settle(page);
    await expectMore(page, 'setup-dialog', 'false', 'tall setup');
    await expectArrow(page, 'setup-dialog', 'false', 'tall setup');
    const fits = await probe(page, 'setup-dialog');
    check(fits.fade.opacity < 0.05, `tall setup: the cue shows with no hidden content (opacity ${fits.fade.opacity})`);
    check(fits.arrowOpacity === 0, `tall setup: the chevron shows with no hidden content (opacity ${fits.arrowOpacity})`);
    check(fits.cueText === '' && fits.cueLabel.length === 0, 'tall setup: the cue holds text');
    // The chevron holds no endless animation, so it never repaints the dialog.
    check(fits.cueAnim === 'none', `tall setup: the chevron runs the animation "${fits.cueAnim}"`);
    // Reduced motion: the chevron stays hidden and still.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await probe(page, 'setup-dialog');
    check(reduced.cueAnim === 'none', `tall setup: reduced motion keeps the chevron animation "${reduced.cueAnim}"`);
    check(reduced.arrowOpacity === 0, `tall setup: reduced motion shows the chevron (opacity ${reduced.arrowOpacity})`);
    record('tall-setup-fits', { scrollHeight: setup.scrollHeight, clientHeight: setup.clientHeight, reducedMotionAnim: reduced.cueAnim });
    await evidence(page, '12-tall-setup-fits');
    await context.close();
  }

  // 10: Portrait phone 390x844 with touch. The 20 px cue band is the tightest
  // one, so the chevron must stay still in its solid part.
  {
    const { context, page } = await openPage('portrait', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    stage = 'portrait-setup';
    const setup = await ensureOverflow(page, 'setup-dialog');
    check(setup.overflow, 'portrait: the setup dialog fits after the options block opens');
    check(setup.more === 'true', `portrait setup: data-more is "${setup.more}" with hidden content`);
    await checkCueChrome(page, 'setup-dialog', 'portrait setup top');
    const still = await probe(page, 'setup-dialog');
    expectCueOnSolidFade(still, 'portrait setup');
    const solidTop = still.fade.top + (still.fade.bottom - still.fade.top) * 0.3;
    record('portrait-setup-chevron', { solidTop, solidHeight: still.fade.bottom - solidTop, top: still.arrow.top, bottom: still.arrow.bottom });
    await evidence(page, '13-portrait-setup-chevron');
    await context.close();
  }
} catch (e) {
  errors.push(`fatal (${stage}): ${e.message}`);
  try { results.push({ failureState: await activePage?.evaluate(() => ({ setup: window.__cueProbe?.('setup-dialog'), help: window.__cueProbe?.('help-dialog') })) }); } catch {}
}
finally {
  clearTimeout(deadline);
  try { await browser?.close(); } catch (e) { errors.push(`cleanup: ${e.message}`); }
  stop(); writeEvidence();
}
for (const e of errors) console.error(e);
console.log(`${tag}: steps=${results.length} errors=${errors.length} shots=${shots}`);
process.exit(errors.length ? 1 : 0);
