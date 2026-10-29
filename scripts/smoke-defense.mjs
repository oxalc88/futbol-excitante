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

// A carrier change during a hold is a valid game outcome. The stage retries.
class PossessionLost extends Error {}

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
  const runHook = async (page, name, slot, ...args) => {
    for (let i = 0; i < 24; i++) {
      if (await page.evaluate(([n, s, a]) => window.__feSmoke?.[n]?.(s, ...a) === true, [name, slot, args])) return;
      await page.waitForTimeout(250);
    }
    throw new Error(`Smoke hook ${name}(${slot}) failed`);
  };
  const defenseState = (page, slot = 0) => page.evaluate(s => window.__feSmoke.defenseState(s), slot);
  // A snapshot during a hold. The engine drops the defense flags when team 1 no
  // longer carries the ball. Such a snapshot is a retry, not a defect.
  const holdSnapshot = async (page) => {
    const state = await defenseState(page);
    if (state.carrierTeam !== 1) throw new PossessionLost('carrier changed');
    return state;
  };
  // Wait for a mid-hold flag. A carrier change during the wait is a retry.
  // On a timeout the last carrier team decides between retry and failure.
  const waitHoldFlag = async (page, predicate, polling) => {
    const failed = await page.waitForFunction(predicate, null, {timeout:5000, polling})
      .then(() => null).catch((e) => e);
    if (!failed) return;
    const last = await defenseState(page).catch(() => ({}));
    if (last.carrierTeam !== 1) throw new PossessionLost('carrier changed');
    throw failed;
  };
  // Run one stage on a new page. A carrier change gives team 1 the ball back,
  // closes the page and retries, up to ten attempts. Any other error stops the
  // run at once.
  const withRetry = async (name, body) => {
    for (let attempt = 1; attempt <= 10; attempt++) {
      const { context, page } = await newPage();
      try {
        await body(page);
        await context.close();
        return;
      } catch (e) {
        if (!(e instanceof PossessionLost)) {
          await context.close().catch(() => {});
          throw e;
        }
        // Before the retry attempt, give team 1 a fresh possession.
        await ensureCpuBall(page).catch(() => {});
        await context.close().catch(() => {});
      }
    }
    throw new Error(`The CPU lost the ball in 10 attempts (${name})`);
  };
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
  // Speed of the selected player per simulation tick. The page polls the
  // defense state each frame, so a loaded CPU cannot skew the result by a wall
  // clock. A sample is valid only while team 1 carries the ball and the held
  // flag is true. The first valid tick sets t0. The first sample at or after
  // t0 + settleTicks opens the window, so the defender reaches the steady
  // speed of the hold (the contain cap or the chase). The window covers the
  // next `windowTicks` simulation ticks from that first sample and records
  // (tick, x, y, baseSpeed). The speed is the
  // path length of the position deltas divided by the tick delta. The ✕ hold
  // after the walk-away can select another player than the R2 hold, so raw
  // meters per tick of two players do not compare. Each window also averages
  // the baseSpeed of its samples (the engine speed limit before the jog,
  // sprint and contain factors), and returns the unitless share of that base
  // speed: {norm, raw, ticks}. The comparison uses norm; raw stays for the
  // evidence.
  // A carrier change is a retry. During a dribble the ball leaves the reach
  // of the carrier for some ticks. The engine then has no carrier, so it
  // drops the flag. One frame can hide those ticks. heldSince shows the
  // regain. So a flag drop is a defect only when the same possession holds:
  // same carrier and same heldSince. A change of carrier or heldSince is a
  // retry. A wall clock timeout of 15 s is a defect and reports the state.
  const tickSpeed = async (page, flag, { settleTicks = 24, windowTicks = 30 } = {}) => {
    const result = await page.evaluate(([flag, settleTicks, windowTicks]) => new Promise((res) => {
      let t0 = null, carrier0 = null, since0 = null, lt0 = null, first = null, last = null, distance = 0, baseSum = 0, baseSamples = 0, samples = 0, state = null, raf = 0;
      const finish = (value) => { cancelAnimationFrame(raf); clearTimeout(timer); res(value); };
      const timer = setTimeout(() => finish({ timeout: true, t0, samples, distance, state }), 15000);
      // The last sample of the window gives the speed.
      const windowDone = () => {
        const ticks = first && last ? last.tick - first.tick : 0;
        const speed = ticks > 0 ? distance / ticks : null;
        const avgBase = baseSamples > 0 ? baseSum / baseSamples : null;
        finish({ sample: { ticks, samples, distance, speed, avgBaseSpeed: avgBase,
          norm: speed !== null && avgBase !== null && avgBase > 0 ? speed / avgBase : null }, state });
      };
      const frame = () => {
        const s = window.__feSmoke?.defenseState?.(0) ?? null;
        state = s;
        // The carrier change ends the stage. The stage retries with a new ball.
        if (!s || s.carrierTeam !== 1) { finish({ lost: 'carrier', state: s }); return; }
        // The first valid tick sets t0. An invalid tick is ignored.
        if (t0 === null) {
          if (s[flag] !== true || typeof s.x !== 'number') { raf = requestAnimationFrame(frame); return; }
          t0 = s.tick;
          carrier0 = s.carrier;
          since0 = s.carrierSince;
          lt0 = s.lastTouchTick;
        } else if (s.lastTouchTeam !== 1) {
          // The press stays on only while the last touch is not a
          // teammate touch. A team-0 poke is a contested possession, not a
          // defect, so end the stage and retry with a new ball. This runs
          // before the flag-drop check.
          finish({ lost: 'touch', lt0, state: s }); return;
        }
        // During a dribble the ball leaves the reach of the carrier for some
        // ticks. The engine then has no carrier, so it drops the flag. One
        // frame can hide those ticks. heldSince shows the regain. So the flag
        // drop stays a defect only when the same possession holds: same carrier
        // and same heldSince. A change of carrier or heldSince is a retry. The
        // stage retries with a new ball.
        if (s.carrier !== carrier0 || s.carrierSince !== since0) { finish({ lost: 'carrier', state: s }); return; }
        // A flag drop while the same carrier still holds the ball is a
        // defect, not a retry.
        if (s[flag] !== true) { finish({ flagDrop: true, state: s }); return; }
        // The settle ticks pass before the window records its first sample.
        if (first === null) {
          if (s.tick < t0 + settleTicks || typeof s.x !== 'number') { raf = requestAnimationFrame(frame); return; }
          first = { tick: s.tick };
          last = { tick: s.tick, x: s.x, y: s.y };
          samples = 1;
          if (typeof s.baseSpeed === 'number') { baseSum += s.baseSpeed; baseSamples += 1; }
          raf = requestAnimationFrame(frame);
          return;
        }
        if (typeof s.x !== 'number') { raf = requestAnimationFrame(frame); return; }
        distance += Math.hypot(s.x - last.x, s.y - last.y);
        samples += 1;
        last = { tick: s.tick, x: s.x, y: s.y };
        if (typeof s.baseSpeed === 'number') { baseSum += s.baseSpeed; baseSamples += 1; }
        // The window keeps this sample when it reaches the end.
        if (s.tick - first.tick >= windowTicks) { windowDone(); return; }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }), [flag, settleTicks, windowTicks]);
    // The page cannot send an error class. The Node side maps the outcome.
    if (result.lost) { console.log('DBG lost', result.lost, JSON.stringify(result.state)); throw new PossessionLost('carrier changed'); }
    if (result.flagDrop) throw new Error(`${flag} flag dropped while team 1 still carries: ${JSON.stringify(result.state)}`);
    if (result.timeout) throw new Error(`Speed window timed out after 15 s: ${JSON.stringify({ flag,
      t0: result.t0 ?? null, samples: result.samples, distance: result.distance, state: result.state })}`);
    const sample = result.sample;
    if (!sample || !(sample.ticks > 0) || !Number.isFinite(sample.speed) || !Number.isFinite(sample.norm)) {
      throw new Error(`Speed window is too short or has no base speed: ${JSON.stringify({ flag, sample, state: result.state })}`);
    }
    if (sample.ticks < windowTicks) throw new Error(`Speed window is short: ${sample.ticks} ticks < ${windowTicks}: ${JSON.stringify({ flag, sample, state: result.state })}`);
    return { norm: sample.norm, raw: sample.speed, ticks: sample.ticks };
  };
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
  // The carrier can pass or lose the ball on a slow runner. Give the ball back
  // to team 1, then wait until team 1 carries it with a field player selected.
  // On a timeout the last state decides: no carrier or a selected keeper is a
  // retry, any other timeout is a failure.
  const ensureCpuBall = async (page) => {
    if ((await defenseState(page)).carrierTeam !== 1) await runHook(page, 'cpuBall', 0);
    const failed = await page.waitForFunction(() => {
      const s = window.__feSmoke.defenseState(0);
      return s.carrierTeam === 1 && s.selected !== null && !s.keeper;
    }, null, {timeout:8000, polling:50}).then(() => null).catch((e) => e);
    if (!failed) return;
    const last = await defenseState(page).catch(() => null);
    if (!last || last.carrierTeam !== 1 || last.keeper) throw new PossessionLost('no field possession');
    throw failed;
  };
  // The engine drops a defense flag when no opponent carries the ball. One
  // snapshot is not enough on a slow runner, so poll the flag while team 1
  // carries. On a timeout the last carrier team decides between retry and
  // failure. A failure reports the last defense state.
  const waitDefenseFlag = async (page, flag, message) => {
    const ok = await page.waitForFunction((flag) => {
      const s = window.__feSmoke.defenseState(0);
      return s.carrierTeam === 1 && s[flag] === true;
    }, flag, {timeout:5000, polling:25}).then(() => true).catch(() => false);
    if (ok) return;
    const last = await defenseState(page).catch(() => ({}));
    if (last.carrierTeam !== 1) throw new PossessionLost('carrier changed');
    throw new Error(`${message}: ${JSON.stringify({ carrierTeam: last.carrierTeam ?? null,
      selected: last.selected ?? null, pressing: last.pressing ?? null, jockeying: last.jockeying ?? null })}`);
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
  await withRetry('press', async (page) => {
    await setupDefense(page);
    const before = await defenseState(page);
    check(before.distance !== null, 'No distance to the carrier before the press');
    check(before.distance > 4, `Carrier starts too close to see the chase (${before.distance?.toFixed(2)} m)`);
    check(before.pressing === false, 'Pressing is already set before the ✕ hold');
    check(await touchDown(page, '.tp-cross', 11), 'Pad ✕ button not found');
    await waitHoldFlag(page, () => window.__feSmoke.defenseState(0).pressing === true, 50);
    await page.waitForTimeout(250);
    const mid = await holdSnapshot(page);
    check(mid.pressing === true, 'Pressing flag is missing during the ✕ hold');
    await page.waitForTimeout(700);
    const end = await holdSnapshot(page);
    check(end.pressing === true, 'Pressing flag is missing at the end of the ✕ hold');
    check(end.distance !== null, 'No distance to the carrier at the end of the ✕ hold');
    check(end.distance < before.distance - .5,
      `Distance did not shrink: ${before.distance.toFixed(2)} m → ${end.distance.toFixed(2)} m`);
    await evidence(page, '01-press', { start: before.distance, mid: mid.distance, end: end.distance,
      pressing: end.pressing, selected: end.selected, carrier: end.carrier });
    await touchUp(page, 11);
  });

  // 2: Holding □ sends exactly one teammate at the carrier.
  stage='team-press';
  await withRetry('team-press', async (page) => {
    await setupDefense(page);
    const before = await defenseState(page);
    check(before.teamPressCount === 0, `Teammates already pressing before □ (${before.teamPressCount})`);
    check(await touchDown(page, '.tp-square', 21), 'Pad □ button not found');
    await waitHoldFlag(page, () => window.__feSmoke.defenseState(0).teamPressCount === 1, 25);
    await page.waitForTimeout(250);
    const one = await holdSnapshot(page);
    check(one.teamPressCount === 1, `Expected 1 teammate teamPressing, found ${one.teamPressCount}`);
    check(one.teamPressing.length === 1, `One teammate must carry the flag (${JSON.stringify(one.teamPressing)})`);
    check(!one.teamPressing.includes(one.selected), 'The flag is on the selected player, not on a teammate');
    await evidence(page, '02-team-press', { count: one.teamPressCount, pressing: one.teamPressing, selected: one.selected });
    await touchUp(page, 21);
  });

  // 3: Two □ edges inside the pad window and held send two teammates.
  stage='multi-press';
  await withRetry('multi-press', async (page) => {
    await setupDefense(page);
    // The gesture runs in one page call. Round trips under CPU load can exceed
    // the 15-tick double-tap window, so the page keeps the time itself.
    // One attempt: tap □, release, press again inside the 15-tick window and hold.
    // The promise gives 'missing' when the element is absent and 'timeout' when the
    // first press gets no count in 1500 ms. It gives 'ok' on success. If the count
    // reaches 2, the predicate gives the defense state of that same tick. The test
    // keeps this state, so a slow runner cannot lose the ball before the checks.
    const attempt = async (n) => {
      const tap = 30 + n * 2, hold = tap + 1;
      const pressed = await page.evaluate(([tap, hold]) => new Promise(res => {
        const fire = (target, type, id, x, y) => target.dispatchEvent(new PointerEvent(type, {
          bubbles: true, cancelable: true, composed: true,
          pointerType: 'touch', pointerId: id, isPrimary: true, clientX: x, clientY: y }));
        const press = () => {
          const el = document.querySelector('.tp-square');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { el, x: r.x + r.width / 2, y: r.y + r.height / 2 };
        };
        const first = press();
        if (!first) { res('missing'); return; }
        fire(first.el, 'pointerdown', tap, first.x, first.y);
        // One frame can last longer than a fixed wait when the CPU is loaded.
        // So poll each frame until the game counts the first press.
        // Stop after 1500 ms, lift the first touch and give 'timeout'.
        const start = performance.now();
        const waitCount = () => {
          const s = window.__feSmoke?.defenseState?.(0);
          if (s && s.teamPressCount >= 1) {
            // The lift lands on the body, as touchUp does.
            fire(document.body, 'pointerup', tap, 0, 0);
            // Poll each frame until the game sees the release. Press again in
            // that same frame, inside the double-tap window.
            const waitRelease = () => {
              const now = window.__feSmoke?.defenseState?.(0);
              if (now && now.teamPressCount === 0) {
                const second = press();
                if (!second) { res('missing'); return; }
                fire(second.el, 'pointerdown', hold, second.x, second.y);
                res('ok');
                return;
              }
              if (performance.now() - start > 1500) { res('timeout'); return; }
              requestAnimationFrame(waitRelease);
            };
            requestAnimationFrame(waitRelease);
            return;
          }
          if (performance.now() - start > 1500) {
            fire(document.body, 'pointerup', tap, 0, 0);
            res('timeout');
            return;
          }
          requestAnimationFrame(waitCount);
        };
        requestAnimationFrame(waitCount);
      }), [tap, hold]);
      check(pressed !== 'missing', 'Pad □ button not found');
      // The first press got no count. The touch is up now, so a new attempt can
      // start clean after the next cpuBall.
      if (pressed === 'timeout') { await page.waitForTimeout(450); return null; }
      const two = await page.waitForFunction(() => {
        const s = window.__feSmoke.defenseState(0);
        return s.teamPressCount === 2 ? s : false;
      }, null, {timeout:2000, polling:25}).then(h => h.jsonValue()).catch(() => null);
      if (!two) {
        // No count 2. A carrier change is a retry: lift the touch and throw
        // at once. withRetry starts a fresh page. Team 1 still carrying is a
        // defect.
        const last = await defenseState(page).catch(() => null);
        await touchUp(page, hold).catch(() => {});
        if (!last || last.carrierTeam !== 1) throw new PossessionLost('carrier changed before two teammates');
        throw new Error('Double tap + hold □ gave no two teammates while team 1 carries');
      }
      return { hold, two };
    };
    let held = null, two = null;
    await ensureCpuBall(page);
    for (let n = 0; n < 3 && two === null; n++) {
      if (n > 0) { await runHook(page, 'cpuBall', 0); await page.waitForTimeout(120); }
      const got = await attempt(n);
      if (got) { held = got.hold; two = got.two; }
    }
    if (two === null) {
      const last = await defenseState(page);
      if (last.carrierTeam !== 1) throw new PossessionLost('carrier changed before two teammates');
    }
    check(two !== null, 'Double tap + hold □ never gave two teammates teamPressing');
    check(two.teamPressCount === 2, `Expected 2 teammates teamPressing, found ${two.teamPressCount}`);
    check(two.teamPressing.length === 2, `Two teammates must carry the flag (${JSON.stringify(two.teamPressing)})`);
    // The count can drop after the first snapshot when the carrier changes.
    // Wait 150 ms and check the count again.
    await page.waitForTimeout(150);
    const later = await holdSnapshot(page);
    check(later.teamPressCount === 2, `Expected 2 teammates teamPressing after 150 ms, found ${later.teamPressCount}`);
    await evidence(page, '03-multi-press', { count: two.teamPressCount, pressing: two.teamPressing, selected: two.selected });
    await touchUp(page, held);
  });

  // 4: R2 holds the contain: the flag is set and the selected player moves
  // slower than with the ✕ chase. 4b: the ✕ chase runs faster than the
  // contain. 5: lifting every touch leaves no flag. One stage runs on its own
  // fresh page, so a long chain in one stage cannot fail the other stages.
  let jockeySpeed = null, jockeyId = null, pressSpeed = null;
  stage='jockey';
  await withRetry('jockey', async (page) => {
    await setupDefense(page);
    const before = await defenseState(page);
    check(before.jockeying === false, 'Jockeying is already set before the R2 hold');
    await ensureCpuBall(page);
    await stickDown(page, 51, -60);
    check(await touchDown(page, '.tp-r2', 52), 'Pad R2 button not found');
    // The flag comes first. The settle ticks of the speed window let the
    // defender fall to the contain cap before the window records positions.
    await waitDefenseFlag(page, 'jockeying', 'Jockey flag is missing during the R2 hold');
    jockeySpeed = await tickSpeed(page, 'jockeying', { settleTicks: 24, windowTicks: 30 });
    // The chase can win the ball at the end of the window. Give the ball back first.
    await ensureCpuBall(page);
    await waitDefenseFlag(page, 'jockeying', 'Jockey flag is missing during the R2 hold');
    const jockey = await holdSnapshot(page);
    check(jockey.pressing === false, 'The ✕ pressure flag is set during the R2 hold');
    jockeyId = jockey.selected;
    await evidence(page, '04-jockey', { jockeyId,
      jockeySpeedNorm: jockeySpeed.norm, jockeySpeedRaw: jockeySpeed.raw,
      speedUnit: 'share of own base speed per tick (norm) · m/tick (raw)', distance: jockey.distance });
  });

  // 4b: no R2: the ✕ chase gives the full speed. After the contain the
  // defender is near the carrier, and the chase wins the ball inside the
  // window. So this stage starts on a fresh page.

  stage='press-speed';
  await withRetry('press-speed', async (page) => {
    await setupDefense(page);
    // The hook gives the ball to an opponent at least 14 m away, so the ✕
    // chase cannot reach him before the window ends.
    await runHook(page, 'cpuBall', 0, 14);
    await ensureCpuBall(page);
    const s = await defenseState(page);
    const pressId = s.selected;
    check(await touchDown(page, '.tp-cross', 53), 'Pad ✕ button not found');
    // Same order as the R2 hold: wait for the flag, then sample the speed.
    await waitDefenseFlag(page, 'pressing', 'Pressure flag is missing during the ✕ hold');
    pressSpeed = await tickSpeed(page, 'pressing', { settleTicks: 24, windowTicks: 30 });
    // The chase can win the ball at the end of the window. Give the ball back first.
    await ensureCpuBall(page);
    await waitDefenseFlag(page, 'pressing', 'Pressure flag is missing during the ✕ hold');
    const press = await holdSnapshot(page);
    check(press.jockeying === false, 'The jockey flag survives the R2 release');
    check(pressSpeed.norm > jockeySpeed.norm * 1.2,
      `Press speed ${pressSpeed.norm.toFixed(3)} (${pressSpeed.raw.toFixed(3)} m/tick, player ${pressId}) is not clearly above jockey speed ${jockeySpeed.norm.toFixed(3)} (${jockeySpeed.raw.toFixed(3)} m/tick, player ${jockeyId})`);
    await evidence(page, '04b-press', { jockeyId, pressId,
      jockeySpeedNorm: jockeySpeed.norm, jockeySpeedRaw: jockeySpeed.raw,
      pressSpeedNorm: pressSpeed.norm, pressSpeedRaw: pressSpeed.raw,
      speedUnit: 'share of own base speed per tick (norm) · m/tick (raw)' });
  });

  // 5: Every finger up: no defense flag may stay set. Hold ✕, □ and R2 before
  // the release, so the release drops each flag. R2 and ✕ are already held in
  // this stage, so only □ needs a new touch.
  stage='release';
  await withRetry('release', async (page) => {
    await setupDefense(page);
    await ensureCpuBall(page);
    await stickDown(page, 51, -60);
    check(await touchDown(page, '.tp-r2', 52), 'Pad R2 button not found');
    check(await touchDown(page, '.tp-cross', 53), 'Pad ✕ button not found');
    await waitDefenseFlag(page, 'pressing', 'Pressure flag is missing during the ✕ hold');
    check(await touchDown(page, '.tp-square', 54), 'Pad □ button not found');
    // A timeout after a carrier change is a retry, not a defect.
    const oneTeammate = await page.waitForFunction(() => window.__feSmoke.defenseState(0).teamPressCount === 1,
      null, {timeout:5000, polling:25}).then(() => true).catch(() => false);
    if (!oneTeammate) {
      const last = await defenseState(page).catch(() => ({}));
      if (last.carrierTeam !== 1) throw new PossessionLost('carrier changed');
      throw new Error(`No teammate teamPressing during the □ hold: ${JSON.stringify({ carrierTeam: last.carrierTeam ?? null,
        selected: last.selected ?? null, pressing: last.pressing ?? null, jockeying: last.jockeying ?? null })}`);
    }
    // R2 is already held. Keep id 55 in the lift list below. Lifting an
    // unused pointer id is harmless.
    await waitDefenseFlag(page, 'jockeying', 'Jockey flag is missing before the release');
    // Before the release: team 1 carries the ball and the held touches keep
    // their flags. A carrier change here is a retry, not a defect.
    await waitDefenseFlag(page, 'pressing', 'Pressure flag is missing before the release');
    // The release runs in one page call. Round trips under load let the
    // defenders win the ball before the after snapshot. The page lifts the
    // touches and keeps the held and the after state of the same call. After
    // the first clear frame, the page holds that state for 30 simulation
    // ticks. A flag that comes back in the hold window is a defect.
    const release = await page.evaluate(() => new Promise((res) => {
      const lift = (id) => document.body.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, cancelable: true, composed: true,
        pointerType: 'touch', pointerId: id, isPrimary: true, clientX: 0, clientY: 0 }));
      const s0 = window.__feSmoke?.defenseState?.(0);
      if (!s0 || s0.carrierTeam !== 1) { res({lost: true}); return; }
      for (const id of [51, 52, 53, 54, 55]) lift(id);
      // Phase 1: poll each frame until no flag stays set. One frame can last
      // longer than a fixed wait when the load is high. Stop after 1500 ms.
      const start = performance.now();
      // Phase 2: keep the clear state for 30 simulation ticks. Stop after
      // 5000 ms.
      let tc = null, holdStart = null;
      const hold = () => {
        const s = window.__feSmoke?.defenseState?.(0);
        if (!s || s.carrierTeam !== 1) { res({lost: true}); return; }
        if (tc === null) { tc = s.tick; holdStart = performance.now(); }
        if (s.pressing || s.jockeying || s.teamPressCount > 0) { res({held: s0, after: s, reappeared: true}); return; }
        if (s.tick - tc >= 30) { res({held: s0, after: s, clearTicks: s.tick - tc}); return; }
        if (performance.now() - holdStart > 5000) { res({held: s0, after: s, timeout: true}); return; }
        requestAnimationFrame(hold);
      };
      const waitClear = () => {
        const s = window.__feSmoke?.defenseState?.(0);
        if (!s || s.carrierTeam !== 1) { res({lost: true}); return; }
        if (!s.pressing && !s.jockeying && s.teamPressCount === 0) { hold(); return; }
        if (performance.now() - start > 1500) { res({held: s0, after: s, timeout: true}); return; }
        requestAnimationFrame(waitClear);
      };
      requestAnimationFrame(waitClear);
    }));
    if (release.lost) throw new PossessionLost('carrier changed');
    const { held, after } = release;
    // Before the release: the held touches keep their flags.
    check(held.pressing === true, 'Pressure flag is missing before the release');
    check(held.jockeying === true, 'Jockey flag is missing before the release');
    check(held.teamPressCount === 1, `The teammate flag is missing before the release (${held.teamPressCount})`);
    // After the release: team 1 still carries the ball and no flag stays set.
    check(after.pressing === false, 'The ✕ pressure flag survived the release');
    check(after.jockeying === false, 'The R2 jockey flag survived the release');
    check(after.teamPressCount === 0, `A teamPress flag survived the release (${after.teamPressCount})`);
    // The clear state holds for 30 more simulation ticks.
    check(!release.reappeared, `A defense flag came back after the release: ${JSON.stringify(release.after)}`);
    check(!release.timeout, `The clear state did not hold in time: ${JSON.stringify({ after: release.after,
      clearTicks: release.clearTicks ?? null })}`);
    check(release.clearTicks >= 30, `The flags stayed clear for only ${release.clearTicks} ticks < 30`);
    pass('05-release', { jockeySpeedNorm: jockeySpeed.norm, pressSpeedNorm: pressSpeed.norm,
      speedUnit: 'share of own base speed per tick',
      pressing: after.pressing, jockeying: after.jockeying,
      teamPressCount: after.teamPressCount, distance: after.distance });
  });
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
