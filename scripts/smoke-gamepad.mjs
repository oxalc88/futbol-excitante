// Test standard gamepads in the browser.
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
    // This flow clicks #start-btn: skip the first-visit tips dialog.
    try { localStorage.setItem('fe.tipsSeen','1'); } catch {}
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
  const wait = async (fn, arg) => {
    // Advance browser frames directly in fixed 100 ms steps.
    for (let i=0;i<200;i++) {
      const ready=await page.evaluate(({source,arg}) => (0,eval)(`(${source})`)(arg), {source:String(fn),arg});
      if (ready) return page.waitForFunction(fn,arg,{polling:10,timeout:1000});
      await page.clock.fastForward(100);
    }
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
  // 2: Take the kickoff, put the ball at the feet of slot 0, then charge a shot.
  stage='kickoff';
  await button(0,0,true); // Stick stays at 0: only X is pressed.
  await wait(() => window.__fe.phase==='playing');
  await button(0,0,false);
  stage='charged shot';
  // The smoke hook (webdriver only) puts the ball at the feet and clears the restart rules.
  check(await page.evaluate(() => window.__feSmoke.ballAtFeet(0)),'Smoke hook failed');
  const before=await snapshot();
  const takerId=before.selected[0];
  const taker=before.players.find(p=>p.id===takerId);
  check(!!taker,'Selected player of slot 0 missing');
  check(Math.hypot(taker.x-before.ball.x,taker.y-before.ball.y)<=1,'Ball is not within 1 m of the player');
  // The shell reports no team field, so the side comes from the id prefix.
  const side=String(takerId).split('-')[0];
  const opponentNear=before.players.filter(p=>String(p.id).split('-')[0]!==side&&Math.hypot(p.x-before.ball.x,p.y-before.ball.y)<=10);
  check(opponentNear.length===0,'Opponent within 10 m of the ball');
  await button(0,2,true);
  await ticks(12);
  shotSetup={before,release:await snapshot()};
  check((await snapshot()).shots.actions[0]===before.shots.actions[0],'Shot fired while held');
  await button(0,2,false);
  await wait(n => window.__fe.shots.actions[0]===n+1, before.shots.actions[0]);
  await wait(n => window.__fe.shots.events[0]===n+1, before.shots.events[0]);
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
  // A shot from scenario 3 or 4 can still roll. It can score in the test.
  // Stop the ball at player 0's feet. This keeps the phase 'playing'.
  check(await page.evaluate(() => window.__feSmoke.ballAtFeet(0)),'Smoke hook failed');
  // Check each axis and selected player in local two-player mode.
  await axes(0,[.8,0,0,0]); await axes(1,[-.8,0,0,0]);
  await wait(() => window.__fe.frames[0]?.move.x>.7 && window.__fe.frames[1]?.move.x<-.7);
  const moving=await snapshot(); await ticks(60); const moved=await snapshot();
  check(moving.phase==='playing'&&moved.phase==='playing', `Phase left playing during movement: ${moving.phase} -> ${moved.phase}`);
  for (const slot of [0,1]) {
    const a=moving.players.find(p=>p.id===moving.selected[slot]);
    const b=moved.players.find(p=>p.id===a.id);
    check(slot===0?b.x>a.x:b.x<a.x,`Player ${slot} did not move on its own axis`);
  }
  await axes(0,[0,0,0,0]); await axes(1,[0,0,0,0]); await ticks();
  await evidence(5);
  stage='keeper punt';
  // 7: The keeper hook holds the ball. R2 + ○ is the high punt: one event,
  // counted once as a punt and never repeated.
  await wait(() => ['kickoff','playing'].includes(window.__fe.phase));
  if ((await snapshot()).phase==='kickoff') {
    await button(0,0,true); await button(1,0,true);
    await wait(() => window.__fe.phase==='playing');
    await button(0,0,false); await button(1,0,false);
  }
  check(await page.evaluate(() => window.__feSmoke.keeperHold(0)),'Keeper smoke hook failed');
  const keeperState=await snapshot();
  const keeperPlayer=keeperState.players.find(p=>p.id===keeperState.selected[0]);
  check(keeperPlayer&&keeperPlayer.keeper,'Slot 0 keeper not selected');
  const keeperBefore=keeperState.keeper;
  await button(0,7,true); await ticks();
  await button(0,1,true); await ticks(2); await button(0,1,false);
  await wait(n => window.__fe.keeper.highPunts[0]===n+1, keeperBefore.highPunts[0]);
  await ticks(18);
  const keeperAfter=await snapshot();
  check(keeperAfter.keeper.highPunts[0]===keeperBefore.highPunts[0]+1,'Duplicate high punt');
  check(keeperAfter.keeper.punts[0]===keeperBefore.punts[0]+1,'High punt must count once as a punt');
  check(keeperAfter.keeper.throws[0]===keeperBefore.throws[0],'Keeper throw fired without a pass');
  await button(0,7,false); await ticks();
  await evidence(7,{punts:keeperAfter.keeper.punts[0],highPunts:keeperAfter.keeper.highPunts[0],throws:keeperAfter.keeper.throws[0]});
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
