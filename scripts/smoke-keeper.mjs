// Test the keeper: rush, sprint rush, throws, punts, drop, pick up and run with the ball.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(process.env.PLAYWRIGHT_CORE_DIR ? `${process.env.PLAYWRIGHT_CORE_DIR}/` : import.meta.url);
const { chromium } = require('playwright-core');
const port = Number(process.env.KEEPER_SMOKE_PORT ?? 4318);
const base = `http://127.0.0.1:${port}`;
const out = 'artifacts/local/smoke';
// CI has no /workspace: keep the screenshots in the local artifacts there.
const shots = process.env.KEEPER_SHOTS ?? (process.env.CI ? 'artifacts/local/keeper-e2e' : '/workspace/keeper-e2e');
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
  const message=`keeper-e2e: port ${port} is already in use; stop the old server first`;
  writeFileSync(`${out}/keeper.json`, `${JSON.stringify({results:[],errors:[message]},null,2)}\n`);
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
const timeoutMs = Number(process.env.KEEPER_SMOKE_TIMEOUT_MS ?? 180000);
const deadline = setTimeout(() => { errors.push(`Total timeout (${timeoutMs} ms)`); stop(); writeEvidence(); process.exit(1); }, timeoutMs);
function writeEvidence() { writeFileSync(`${out}/keeper.json`, `${JSON.stringify({results, errors}, null, 2)}\n`); }
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
  const evidence = async (step, details={}) => { check(errors.length===0, errors.join('; '));
    await page.screenshot({path:`${shots}/${step}.png`}); results.push({step,...details});
    console.log(`keeper-e2e: ${step} passed`); };
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const keeper = (s) => s.players.find(p=>p.id===s.selected[0]);
  // Buttons (standard mapping): X=0, O=1, T=3, R1=5, R2=7.
  const ready = async () => {
    await wait(() => ['kickoff','playing'].includes(window.__fe.phase));
    if ((await snapshot()).phase==='kickoff') {
      await button(0,0,true); await button(1,0,true);
      await wait(() => window.__fe.phase==='playing');
      await button(0,0,false); await button(1,0,false);
    }
  };
  const hold = async () => {
    await ready();
    check(await page.evaluate(() => window.__feSmoke.keeperHold(0)),'Keeper smoke hook failed');
    await ticks(2);
    const s=await snapshot();
    check(s.keeperHold?.playerId===s.selected[0],'Keeper hold is not the selected player');
    check(keeper(s)?.keeper,'Slot 0 keeper not selected');
  };
  const release = async () => {
    for (const slot of [0,1]) for (const b of [0,1,3,5,7]) await button(slot,b,false);
    await axes(0,[0,0,0,0]);
    await ticks(4);
  };
  await page.goto(base, {waitUntil:'networkidle'});
  await page.clock.pauseAt(new Date());
  await page.locator('#mode').selectOption('local');
  await page.locator('.tactics summary').click();
  await page.locator('#quality').selectOption('low');
  await page.locator('#start-btn').click();
  await connectPad(0,true); await connectPad(1,true); await ticks();
  stage='rush';
  // 1: The keeper rushes to the ball that a nearby opponent threatens.
  await ready();
  check(await page.evaluate(() => window.__feSmoke.oneOnOne(0)),'Smoke hook failed');
  const s0=await snapshot();
  const k0=keeper(s0);
  check(!!k0,'Selected player of slot 0 missing');
  const d0=dist(k0,s0.ball);
  await button(0,3,true);
  await ticks(30);
  const s1=await snapshot();
  const k1=keeper(s1);
  check(k1.keeperRushing===true,'Keeper did not rush');
  const d1=dist(k1,s1.ball);
  check(d1<d0-1,'Keeper did not close on the ball');
  const speedA=Math.hypot(k1.vx,k1.vy);
  await evidence('1-rush',{d0,d1,speed:speedA});
  await release();
  stage='sprint-rush';
  // 2: R1 held while rushing must be faster than the plain rush.
  await ready();
  check(await page.evaluate(() => window.__feSmoke.oneOnOne(0)),'Smoke hook failed');
  await button(0,5,true); await ticks(1);
  await button(0,3,true);
  await ticks(30);
  const sprint=await snapshot();
  const sprintKeeper=keeper(sprint);
  check(sprintKeeper.keeperRushing===true,'Keeper did not rush while sprinting');
  const speedB=Math.hypot(sprintKeeper.vx,sprintKeeper.vy);
  check(speedB>speedA*1.1,'Sprint rush is not faster than the plain rush');
  await evidence('2-sprint-rush',{speedA,speedB});
  await release();
  stage='throws';
  // 3: Each keeper release from the hold: hand throw, throw, volley and high punt.
  let volleyVz;
  for (const step of [
    {name:'3a-hand-throw',press:[0]},
    {name:'3b-throw-space',press:[3]},
    {name:'3c-volley',press:[1],hold:20},
    {name:'3d-high-punt',pre:[7],press:[1],hold:20},
  ]) {
    stage=step.name;
    await hold();
    const before=(await snapshot()).keeper;
    for (const btn of step.pre??[]) await button(0,btn,true);
    if (step.pre?.length) await ticks(1);
    for (const btn of step.press) await button(0,btn,true);
    await ticks(step.hold??2);
    for (const btn of step.press) await button(0,btn,false);
    await wait(() => window.__fe.keeperHold===null);
    await ticks(1);
    const s=await snapshot();
    const k=keeper(s);
    check(s.ball.lastTouch?.playerId===k.id,'Last touch is not the keeper');
    const b={vz:s.ball.vz,z:s.ball.z,speed:Math.hypot(s.ball.vx,s.ball.vy),kind:s.ball.lastTouch.surface};
    if (step.name==='3a-hand-throw') {
      check(s.keeper.throws[0]===before.throws[0]+1,'Hand throw did not count');
      check(s.keeper.punts[0]===before.punts[0],'Hand throw counted as a punt');
      check(b.kind==='hand','Hand throw kind wrong');
      check(b.vz<2,'Hand throw vz too high');
    } else if (step.name==='3b-throw-space') {
      check(s.keeper.throws[0]===before.throws[0]+1,'Throw did not count');
      check(b.kind==='hand','Throw kind wrong');
      check(b.speed>=15,'Throw too slow');
    } else if (step.name==='3c-volley') {
      check(s.keeper.punts[0]===before.punts[0]+1,'Volley did not count');
      check(s.keeper.highPunts[0]===before.highPunts[0],'Volley counted as a high punt');
      check(b.kind==='foot','Volley kind wrong');
      check(b.vz>4,'Volley vz too low');
      volleyVz=b.vz;
    } else {
      check(s.keeper.highPunts[0]===before.highPunts[0]+1,'High punt did not count');
      check(b.kind==='foot','High punt kind wrong');
      check(b.vz>volleyVz,'High punt vz not above the volley');
    }
    await ticks(18);
    const again=await snapshot();
    check(again.keeper.throws[0]===s.keeper.throws[0]&&again.keeper.punts[0]===s.keeper.punts[0]&&again.keeper.highPunts[0]===s.keeper.highPunts[0],'Keeper counter increased again');
    await evidence(step.name,{...b});
    await release();
  }
  stage='drop-pick';
  // 4: R1 puts the ball down; R1 again picks it back up.
  await hold();
  await axes(0,[0,0,0,0]);
  await button(0,5,true); await ticks(2); await button(0,5,false);
  await wait(() => window.__fe.keeperHold===null);
  await ticks(2);
  const dropped=await snapshot();
  const dropKeeper=keeper(dropped);
  check(dropKeeper.keeperDropped===true,'Keeper did not put the ball down');
  const dropDist=dist(dropKeeper,dropped.ball);
  check(dropDist<2.5,'Ball is not near the keeper after the drop');
  check(dropped.ball.z<1.1,'Ball is not on the ground after the drop');
  await evidence('4a-put-down',{dist:dropDist,z:dropped.ball.z});
  await button(0,5,true); await ticks(2); await button(0,5,false);
  await wait((id) => window.__fe.keeperHold?.playerId===id, dropKeeper.id);
  await evidence('4b-pick-up',{playerId:dropKeeper.id});
  await release();
  stage='run-with-ball';
  // 5: The keeper runs with the ball in the hands: left stick, then R1 sprint.
  // The stick is pushed first, so R1 never puts the ball down.
  await hold();
  const runStart=await snapshot();
  const runKeeper=keeper(runStart);
  const dir=Math.sign(0-runKeeper.x)||1;
  await axes(0,[dir*.9,0,0,0]); await ticks(2);
  await button(0,5,true);
  await ticks(20);
  const runEnd=await snapshot();
  const endKeeper=keeper(runEnd);
  const moved=(endKeeper.x-runKeeper.x)*dir;
  const runSpeed=Math.hypot(endKeeper.vx,endKeeper.vy);
  check(moved>1.5,`Keeper did not run with the ball: ${moved}`);
  check(runSpeed>5.2,`Keeper run with the ball is not a sprint: ${runSpeed}`);
  check(runEnd.keeperHold?.playerId===endKeeper.id,'Keeper lost the ball while running');
  check(dist(endKeeper,runEnd.ball)<1,'Ball is not in the hands of the running keeper');
  check(runEnd.phase==='playing',`Phase left playing: ${runEnd.phase}`);
  await evidence('5-run-with-ball',{moved,speed:runSpeed});
  await release();
  stage='feint';
  // 6: T then X feints the throw: the keeper keeps the ball, no counter fires.
  await hold();
  const feintBefore=(await snapshot()).keeper;
  await button(0,3,true);
  // The △ throw winds up for 7 ticks: feint inside the wind-up.
  await ticks(3);
  await button(0,0,true);
  await ticks(2);
  await button(0,0,false);
  await button(0,3,false);
  await ticks(30);
  const feint=await snapshot();
  const feintKeeper=keeper(feint);
  check(feint.keeperHold?.playerId===feintKeeper.id,'Feint released the ball');
  check(feint.keeper.throws[0]===feintBefore.throws[0]&&feint.keeper.punts[0]===feintBefore.punts[0],'Feint fired a throw or punt');
  await evidence('6-feint');
  await release();
} catch (e) { errors.push(`fatal (${stage}): ${e.message}`);
  try { results.push({failureState:await activePage?.evaluate(() => window.__fe)}); } catch {}
}
finally {
  clearTimeout(deadline);
  try { await browser?.close(); } catch(e) { errors.push(`cleanup: ${e.message}`); }
  stop(); writeEvidence();
}
for (const e of errors) console.error(e);
console.log(`keeper-e2e: steps=${results.length} errors=${errors.length} shots=${shots}`);
process.exit(errors.length ? 1 : 0);
