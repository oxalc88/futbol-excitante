// Test standard gamepads and one touch shot in the browser.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(process.env.PLAYWRIGHT_CORE_DIR ? `${process.env.PLAYWRIGHT_CORE_DIR}/` : import.meta.url);
const { chromium } = require('playwright-core');
const port = Number(process.env.SMOKE_PORT ?? 4317);
const base = `http://127.0.0.1:${port}`;
const out = 'artifacts/local/smoke';
mkdirSync(out, { recursive: true });

// Stop if another server uses the port.
const portBusy = await new Promise((resolve) => {
  const sock = connect({ host: '127.0.0.1', port, timeout: 1000 });
  sock.once('connect', () => { sock.destroy(); resolve(true); });
  sock.once('timeout', () => { sock.destroy(); resolve(true); });
  sock.once('error', () => resolve(false));
});
if (portBusy) {
  const message=`pad-smoke: port ${port} is already in use; stop the old server first`;
  writeFileSync(`${out}/pad.json`, `${JSON.stringify({results:[],errors:[message]},null,2)}\n`);
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
let stage='startup';
let shotSetup;
const timeoutMs = Number(process.env.PAD_SMOKE_TIMEOUT_MS ?? 120000);
const deadline = setTimeout(() => { errors.push(`Total timeout (${timeoutMs} ms)`); stop(); writeEvidence(); process.exit(1); }, timeoutMs);
function writeEvidence() { writeFileSync(`${out}/pad.json`, `${JSON.stringify({results, errors}, null, 2)}\n`); }
function check(value, message) { if (!value) throw new Error(message); }
try {
  await waitForServer();
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: {width:960,height:720}, deviceScaleFactor:.5, hasTouch:true });
  const page = activePage = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.clock.install();
  page.on('requestfailed', r => { if (!r.url().endsWith('/favicon.ico')) errors.push(`Request failed: ${r.url()}`); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.addInitScript(() => {
    window.__fakePads = Array.from({length:4}, (_, index) => ({id:`Fake standard ${index}`,index,connected:false,mapping:'standard',axes:[0,0,0,0],
      buttons:Array.from({length:17}, () => ({pressed:false,value:0,touched:false})),timestamp:0}));
    Object.defineProperty(navigator, 'getGamepads', {value:() => window.__fakePads.map(p => p.connected ? p : null)});
    window.__pad = {
      connect(slot, connected) { const p=window.__fakePads[slot]; p.connected=connected; p.timestamp=performance.now();
        const event=new Event(connected?'gamepadconnected':'gamepaddisconnected'); Object.defineProperty(event,'gamepad',{value:p}); window.dispatchEvent(event); },
      button(slot, button, pressed) { const p=window.__fakePads[slot]; p.buttons[button]={pressed,value:Number(pressed),touched:pressed}; p.timestamp=performance.now(); },
      axes(slot, axes) { const p=window.__fakePads[slot]; p.axes=[...axes]; p.timestamp=performance.now(); }
    };
  });
  const snapshot = () => page.evaluate(() => window.__fe);
  const wait = async (fn, arg, stepMs=100, maxMs=20000, soft=false) => {
    // Advance browser frames directly. Use a small step for a check that also steers a player.
    for (let i=0;i<Math.ceil(maxMs/stepMs);i++) {
      const ready=await page.evaluate(({source,arg}) => (0,eval)(`(${source})`)(arg), {source:String(fn),arg});
      if (ready) return page.waitForFunction(fn,arg,{polling:10,timeout:1000});
      await page.clock.fastForward(stepMs);
    }
    if (soft) return false;
    throw new Error(`State did not arrive: ${String(fn)}`);
  };
  const button = (slot, n, pressed) => page.evaluate(([s,n,p]) => window.__pad.button(s,n,p), [slot,n,pressed]);
  const connectPad = (slot, connected) => page.evaluate(([s,c]) => window.__pad.connect(s,c), [slot,connected]);
  const axes = (slot, values) => page.evaluate(([s,v]) => window.__pad.axes(s,v), [slot,values]);
  const ticks = async (count=12) => { const s=await snapshot(); await wait(n => window.__fe.tick>=n, s.tick+count); };
  const frames = async (count=12) => { const s=await snapshot(); await wait(n => window.__fe.browserFrames>=n, s.browserFrames+count); };
  const evidence = async (scenario, details={}) => { check(errors.length===0, errors.join('; ')); results.push({scenario,...details,state:await snapshot()}); console.log(`pad-smoke: scenario ${scenario} passed`); };
  await page.goto(base, {waitUntil:'networkidle'});
  await page.clock.pauseAt(new Date());
  await page.locator('#mode').selectOption('local');
  await page.locator('.tactics summary').click();
  await page.locator('#quality').selectOption('low');
  await page.locator('#start-btn').click();
  await connectPad(0,true); await connectPad(1,true); await ticks();
  stage='pause';
  // 1: Hold Start while the simulation is paused.
  await button(0,9,true); await wait(() => window.__fe.paused);
  const paused = await snapshot(); const clock = await page.locator('#clock').innerText();
  await frames(); check((await snapshot()).tick===paused.tick,'Start hold resumed simulation');
  check(await page.locator('#pause-overlay').isVisible(),'Pause overlay missing');
  check(await page.locator('#clock').innerText()===clock,'Paused clock changed');
  await button(0,9,false); await frames(); check((await snapshot()).paused,'Start release toggled pause');
  await button(0,9,true); await wait(() => !window.__fe.paused); await ticks();
  await button(0,9,false); await ticks();
  await evidence(1,{clock});
  // 2: Pass backward from kickoff. Wait for the receiver to control the ball.
  stage='kickoff receiver';
  const taker=(await snapshot()).selected[0];
  await axes(0,[0,0,-1,0]); await button(0,0,true);
  await wait(() => window.__fe.phase==='playing');
  await button(0,0,false); await axes(0,[0,0,0,0]);
  // The receiver steers in the page at frame rate (17 ms steps).
  const control = id => {
    const s=window.__fe,p=s.players.find(p=>p.id===s.selected[0]);
    if (!p || s.selected[0]===id) return false;
    const dx=s.ball.x-p.x,dy=s.ball.y-p.y,d=Math.hypot(dx,dy);
    // Move the pad 2 player away from the ball, so it does not take the ball from the receiver.
    const q=s.players.find(q=>q.id===s.selected[1]);
    if (q) { const ex=q.x-s.ball.x,ey=q.y-s.ball.y,e=Math.hypot(ex,ey)||1; window.__pad.axes(1,e<8?[ex/e,ey/e,0,0]:[0,0,0,0]); }
    // Run at full speed to a far ball. The backward pass rolls at about 4.5 m/s, and a 0.6 stick (about 2 m/s) cannot catch it.
    const k=d>2?1:.6;
    window.__pad.axes(0,d>1?[dx/d*k,dy/d*k,1,0]:[0,0,1,0]);
    // Start the shot only with no opponent near the ball.
    const side=p.id.split('-')[0],free=s.players.every(q=>q.id.split('-')[0]===side||Math.hypot(q.x-s.ball.x,q.y-s.ball.y)>2.5);
    return free && s.phase==='playing' && !p.action && p.recovery===0 && d<1 && Math.hypot(p.vx,p.vy)<.2 && Math.hypot(s.ball.vx,s.ball.vy)<.5 && s.ball.z<.3;
  };
  // Keep the receiver at the ball while the shot charges and fires.
  const keepBall = n => { const s=window.__fe,p=s.players.find(p=>p.id===s.selected[0]);
    if (p) { const dx=s.ball.x-p.x,dy=s.ball.y-p.y,d=Math.hypot(dx,dy); window.__pad.axes(0,d>1.1?[dx/d*.6,dy/d*.6,1,0]:[0,0,1,0]); }
    return n; };
  // With engine-v4 acceleration a CPU presser can take the ball before the contact tick. Then the
  // attempt has a shot input but no shot event. Try again from the next ball control (max. 5 attempts).
  // Each attempt still checks: no shot while held, one input on release, and one shot event.
  let before;
  for (let attempt=0;;attempt++) {
    stage='kickoff receiver';
    await wait(control, attempt===0?taker:null, 17, 45000);
    await axes(0,[0,0,1,0]); await axes(1,[0,0,0,0]);
    stage='charged shot';
    before = await snapshot();
    await button(0,2,true);
    await wait(([src,n]) => (0,eval)(src)(true) && window.__fe.tick>=n, [String(keepBall),before.tick+12], 17);
    shotSetup={attempt,before,release:await snapshot()};
    check((await snapshot()).shots.actions[0]===before.shots.actions[0],'Shot fired while held');
    await button(0,2,false);
    await wait(([src,n]) => (0,eval)(src)(true) && window.__fe.shots.actions[0]===n+1, [String(keepBall),before.shots.actions[0]], 17);
    const shot=await wait(([src,n]) => (0,eval)(src)(true) && window.__fe.shots.events[0]===n+1, [String(keepBall),before.shots.events[0]], 17, 1500, true);
    await axes(0,[0,0,1,0]);
    if (shot) break;
    check(attempt<4,'No shot event after 5 attempts');
    check((await snapshot()).shots.events[0]===before.shots.events[0],'Late shot event');
  }
  await ticks(18);
  const fired=await snapshot();
  check(fired.shots.actions[0]===before.shots.actions[0]+1 && fired.shots.events[0]===before.shots.events[0]+1,'Duplicate shot');
  check(fired.shots.power[0]>.2,'Shot did not charge');
  // Check the clock and HUD after the shot. A wait before the shot lets the ball roll out of reach.
  await wait(() => document.querySelector('#clock')?.textContent!=='00:00');
  check((await page.locator('#pad-status').innerText()).includes('2 MANDOS'),'Two-pad HUD missing');
  await evidence(2);
  stage='disconnect and reconnect';
  // 3 and 4: Repeat for each gamepad. Keep the other gamepad in its slot.
  for (const slot of [0,1]) {
    const other=1-slot;
    await button(slot,2,true); await ticks(20);
    const start=await snapshot();
    await connectPad(slot,false); await ticks();
    await axes(other,[0,.8,0,0]);
    await wait(s => window.__fe.frames.find(f=>f.slot===s)?.move.y>.7,other);
    check((await snapshot()).frames.find(f=>f.slot===slot)?.move.y===0,'Disconnected slot took other pad');
    await axes(other,[0,0,0,0]);
    const disconnected=await snapshot();
    check(disconnected.shots.actions[slot]===start.shots.actions[slot] && disconnected.shots.events[slot]===start.shots.events[slot],'Disconnect fired a shot');
    await evidence(3,{slot});
    await connectPad(slot,true); await ticks(15); await button(slot,2,false); await ticks(15);
    check((await snapshot()).shots.actions[slot]===start.shots.actions[slot],'Reconnect release caused phantom shot');
    await button(slot,2,true); await ticks(2); await button(slot,2,false);
    await wait(([s,n]) => window.__fe.shots.actions[s]===n+1,[slot,start.shots.actions[slot]]);
    await ticks(12);
    const fresh=await snapshot();
    check(fresh.shots.actions[slot]===start.shots.actions[slot]+1,'Fresh shot repeated');
    check(fresh.shots.power[slot]<=.35,'Old charge survived disconnect');
    await evidence(4,{slot});
  }
  stage='two-player movement';
  // 5: Take the next kickoff if necessary. Then check movement.
  // A shot can end in a goal (kickoff) or in an automatic restart (goal kick,
  // corner, throw-in) that goes back to 'playing' with no kickoff.
  // Wait for either phase. Press ✕ only at a kickoff.
  await wait(() => ['kickoff','playing'].includes(window.__fe.phase));
  if ((await snapshot()).phase==='kickoff') {
    await button(0,0,true); await button(1,0,true);
    await wait(() => window.__fe.phase==='playing');
    await button(0,0,false); await button(1,0,false);
  }
  // Check each axis and selected player in local two-player mode.
  await axes(0,[.8,0,0,0]); await axes(1,[-.8,0,0,0]);
  await wait(() => window.__fe.frames[0]?.move.x>.7 && window.__fe.frames[1]?.move.x<-.7);
  const moving=await snapshot(); await ticks(60); const moved=await snapshot();
  for (const slot of [0,1]) {
    const a=moving.players.find(p=>p.id===moving.selected[slot]);
    const b=moved.players.find(p=>p.id===a.id);
    check(slot===0?b.x>a.x:b.x<a.x,`Player ${slot} did not move on its own axis`);
  }
  await axes(0,[0,0,0,0]); await axes(1,[0,0,0,0]); await ticks();
  await evidence(5);
  stage='touch';
  // 6: Send touch events to the visible control.
  const touch=await snapshot();
  await page.locator('#touch-shoot').tap();
  await wait(n => window.__fe.shots.actions[0]===n+1,touch.shots.actions[0]);
  await ticks(12); check((await snapshot()).shots.actions[0]===touch.shots.actions[0]+1,'Touch shot repeated');
  await evidence(6,{coverage:'Emulated touch shot tap only; real iPhone testing is pending.'});
} catch (e) { errors.push(`fatal (${stage}): ${e.message}`);
  try { results.push({shotSetup,failureState:await activePage?.evaluate(() => window.__fe)}); } catch {}
}
finally {
  clearTimeout(deadline);
  try { await browser?.close(); } catch(e) { errors.push(`cleanup: ${e.message}`); }
  stop(); writeEvidence();
}
for (const e of errors) console.error(e);
console.log(`pad-smoke: scenarios=${results.length} errors=${errors.length} evidence=${out}/pad.json`);
process.exit(errors.length ? 1 : 0);
