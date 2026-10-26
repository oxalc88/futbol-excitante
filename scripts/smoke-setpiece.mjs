// Test the set pieces: free kick variants, the second taker, the feint, the short
// pass, the penalty and Panenka, the corner strategies, the wall, the keeper moves,
// the throw-in and the goal kick.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(process.env.PLAYWRIGHT_CORE_DIR ? `${process.env.PLAYWRIGHT_CORE_DIR}/` : import.meta.url);
const { chromium } = require('playwright-core');
const port = Number(process.env.SETPIECE_SMOKE_PORT ?? 4319);
const base = `http://127.0.0.1:${port}`;
const out = 'artifacts/local/smoke';
// CI has no /workspace: keep the screenshots in the local artifacts there.
const shots = process.env.SETPIECE_SHOTS ?? (existsSync('/workspace') ? '/workspace/setpiece-e2e' : 'artifacts/local/setpiece-e2e');
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
  const message=`setpiece-e2e: port ${port} is already in use; stop the old server first`;
  writeFileSync(`${out}/setpiece.json`, `${JSON.stringify({results:[],errors:[message]},null,2)}\n`);
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
const timeoutMs = Number(process.env.SETPIECE_SMOKE_TIMEOUT_MS ?? 300000);
const deadline = setTimeout(() => { errors.push(`Total timeout (${timeoutMs} ms)`); stop(); writeEvidence(); process.exit(1); }, timeoutMs);
function writeEvidence() { writeFileSync(`${out}/setpiece.json`, `${JSON.stringify({results, errors}, null, 2)}\n`); }
function check(value, message) { if (!value) throw new Error(message); }
try {
  await waitForServer();
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: {width:1280,height:720}, deviceScaleFactor:1 });
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
  const st = () => page.evaluate(() => window.__feSmoke.setPieceState());
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
  const evidence = async (step, details={}) => { check(errors.length===0, errors.join('; '));
    await page.screenshot({path:`${shots}/${step}.png`}); results.push({step,...details});
    console.log(`setpiece-e2e: ${step} passed`); };
  // Buttons (standard mapping): X=0, O=1, SQ=2, T=3, L1=4, R1=5, L2=6, R2=7,
  // UP=12, DOWN=13, LEFT=14, RIGHT=15. Pad 0 = slot 0 = attacking team 0,
  // pad 1 = slot 1 = defending team 1. Axes: [lx,ly,rx,ry].
  const ready = async () => {
    await wait(() => ['kickoff','playing'].includes(window.__fe.phase));
    if ((await snapshot()).phase==='kickoff') {
      await button(0,0,true); await button(1,0,true);
      await wait(() => window.__fe.phase==='playing');
      await button(0,0,false); await button(1,0,false);
    }
  };
  // Every pad idle: no button held, both sticks centred.
  const release = async () => {
    for (const slot of [0,1]) for (const b of [0,1,2,3,4,5,6,7,12,13,14,15]) await button(slot,b,false);
    await axes(0,[0,0,0,0]);
    await axes(1,[0,0,0,0]);
    await ticks(4);
  };
  // Attacking direction of team 0, read once from the first free kick point.
  let dir = 0;
  const start = async (kind, team=0) => {
    await release();
    let before = await st();
    if (before.phase==='goal') {
      await wait(() => ['kickoff','playing'].includes(window.__fe.phase));
      before = await st();
    }
    if (before.phase==='kickoff') await ready();
    check(await page.evaluate(([k,t]) => window.__feSmoke.setPiece(k,t), [kind,team]),
      `${stage}: setPiece hook failed (${kind} team ${team}, phase ${before.phase})`);
    await ticks(2);
    const s = await st();
    check(s.phase===kind && s.restart?.kind===kind,
      `${stage}: restart not waiting (phase=${s.phase}, restart kind=${s.restart?.kind}, expected ${kind})`);
    if (!dir) dir = Math.sign(s.restart?.point?.x ?? 0) || 1;
    return s;
  };
  // Press a button for holdTicks, release it and wait until the ball is in play.
  const kick = async (btn, holdTicks, opts={}) => {
    const slot = opts.slot ?? 0;
    await button(slot,btn,true);
    await ticks(holdTicks);
    await button(slot,btn,false);
    await wait(() => window.__fe.phase==='playing');
    await ticks(1);
    const s = await snapshot();
    return { s, speed: Math.hypot(s.ball.vx,s.ball.vy) };
  };
  await page.goto(base, {waitUntil:'networkidle'});
  await page.clock.pauseAt(new Date());
  await page.locator('#mode').selectOption('local');
  await page.locator('.tactics summary').click();
  await page.locator('#quality').selectOption('low');
  await page.locator('#start-btn').click();
  await connectPad(0,true); await connectPad(1,true); await ticks();
  stage='01-fk-square';
  // 1: SQ free kick: driven shot with a little lift.
  let s1 = await start('free-kick');
  const taker1 = s1.restart.taker;
  await axes(0,[dir,0,0,0]); await ticks(2);
  const r1 = await kick(2,30);
  const sqVz = r1.s.ball.vz;
  const sqSpeed = r1.speed;
  check(r1.s.ball.lastTouch?.playerId===taker1,
    `${stage}: last touch ${r1.s.ball.lastTouch?.playerId} is not the taker ${taker1}`);
  check(sqSpeed>=18, `${stage}: speed ${sqSpeed} below 18`);
  check(r1.s.ball.vz>0 && r1.s.ball.vz<=4.2, `${stage}: vz ${r1.s.ball.vz} outside (0,4.2]`);
  await evidence(stage,{speed:sqSpeed,vz:sqVz,taker:taker1});
  await release();
  stage='02-fk-circle';
  // 2: Circle free kick: lofted shot, higher than the driven one.
  const s2 = await start('free-kick');
  await axes(0,[dir,0,0,0]); await ticks(2);
  const r2 = await kick(1,30);
  check(r2.s.ball.lastTouch?.playerId===s2.restart.taker,
    `${stage}: last touch ${r2.s.ball.lastTouch?.playerId} is not the taker ${s2.restart.taker}`);
  check(r2.s.ball.vz>=4, `${stage}: vz ${r2.s.ball.vz} below 4`);
  check(r2.s.ball.vz>sqVz, `${stage}: vz ${r2.s.ball.vz} not above the square vz ${sqVz}`);
  await evidence(stage,{speed:r2.speed,vz:r2.s.ball.vz,sqVz});
  await release();
  stage='03-fk-cross';
  // 3: Cross (X) free kick: low, weaker than the driven shot.
  const s3 = await start('free-kick');
  await axes(0,[dir,0,0,0]); await ticks(2);
  const r3 = await kick(0,30);
  check(r3.s.ball.lastTouch?.playerId===s3.restart.taker,
    `${stage}: last touch ${r3.s.ball.lastTouch?.playerId} is not the taker ${s3.restart.taker}`);
  check(r3.s.ball.vz<1.6, `${stage}: vz ${r3.s.ball.vz} not below 1.6`);
  check(r3.speed<sqSpeed, `${stage}: speed ${r3.speed} not below the square speed ${sqSpeed}`);
  await evidence(stage,{speed:r3.speed,vz:r3.s.ball.vz,sqSpeed});
  await release();
  stage='04-fk-curl';
  // 4: Curl shot: the stick bends the ball, spin and lateral velocity appear.
  const s4 = await start('free-kick');
  await axes(0,[dir*.7,.7,0,0]); await ticks(2);
  const r4 = await kick(2,30);
  check(r4.s.ball.lastTouch?.playerId===s4.restart.taker,
    `${stage}: last touch ${r4.s.ball.lastTouch?.playerId} is not the taker ${s4.restart.taker}`);
  check(Math.abs(r4.s.ball.spin.z)>.1, `${stage}: spin.z ${r4.s.ball.spin.z} not above 0.1 in absolute value`);
  check(Math.sign(r4.s.ball.vy)===1, `${stage}: vy ${r4.s.ball.vy} does not curl to +y`);
  await evidence(stage,{spinZ:r4.s.ball.spin.z,vy:r4.s.ball.vy,speed:r4.speed});
  await release();
  stage='05-fk-r2-fix';
  // 5: R2 locks the direction: the aimed stick change does not bend the shot.
  await start('free-kick');
  await axes(0,[dir,0,0,0]); await ticks(2);
  await button(0,7,true); await ticks(2);
  await axes(0,[dir*.3,.95,0,0]); await ticks(2);
  const r5 = await kick(2,30);
  const ratio5 = Math.abs(r5.s.ball.vy)/r5.speed;
  check(ratio5<.1, `${stage}: |vy|/speed ${ratio5} not below 0.1 (vy ${r5.s.ball.vy}, speed ${r5.speed})`);
  await button(0,7,false);
  await evidence(stage,{vy:r5.s.ball.vy,speed:r5.speed,ratio:ratio5});
  await release();
  stage='06-second-taker';
  // 6: L1 + D-pad places the second taker, L2 passes to him.
  const s6 = await start('free-kick');
  await button(0,4,true); await ticks(1);
  await button(0,12,true); await ticks(2); await button(0,12,false); await ticks(2);
  let side = await st();
  check(side.restart?.second?.placement==='side',
    `${stage}: placement ${side.restart?.second?.placement} is not side`);
  await button(0,13,true); await ticks(2); await button(0,13,false); await ticks(2);
  const behind = await st();
  check(behind.restart?.second?.placement==='behind',
    `${stage}: placement ${behind.restart?.second?.placement} is not behind`);
  const second = behind.restart.second.id;
  await button(0,4,false); await ticks(2);
  await button(0,6,true); await ticks(1);
  const r6 = await kick(0,15);
  check(r6.s.ball.lastTouch?.playerId===second,
    `${stage}: last touch ${r6.s.ball.lastTouch?.playerId} is not the second taker ${second}`);
  check(r6.s.selected[0]===second,
    `${stage}: selected ${r6.s.selected[0]} is not the second taker ${second}`);
  await evidence(stage,{second,placement:behind.restart.second.placement,speed:r6.speed});
  await release();
  stage='07-feint';
  // 7: O then X feints the shot: the taker keeps the waiting restart.
  await start('free-kick');
  await axes(0,[dir,0,0,0]);
  await button(0,1,true); await ticks(10);
  await button(0,0,true); await ticks(2);
  await button(0,0,false); await button(0,1,false); await ticks(6);
  const a7 = await st();
  await ticks(12);
  const b7 = await st();
  const feintBall = await snapshot();
  const feintSpeed = Math.hypot(feintBall.ball.vx,feintBall.ball.vy);
  check(a7.phase==='free-kick', `${stage}: phase after the feint ${a7.phase} is not free-kick`);
  check(b7.phase==='free-kick', `${stage}: phase 12 ticks later ${b7.phase} is not free-kick`);
  check(feintBall.ball.lastTouch===null, `${stage}: last touch ${feintBall.ball.lastTouch?.playerId} is not null`);
  check(feintSpeed<.01, `${stage}: ball speed ${feintSpeed} not below 0.01`);
  check(b7.restart.remaining<a7.restart.remaining,
    `${stage}: remaining ${b7.restart.remaining} not below ${a7.restart.remaining}`);
  check(b7.restart.remaining>0, `${stage}: remaining ${b7.restart.remaining} not above 0`);
  await evidence(stage,{remainingA:a7.restart.remaining,remainingB:b7.restart.remaining,speed:feintSpeed});
  await release();
  stage='08-short-pass';
  // 8: L1 + X is a grounded short pass back to the taker feet.
  const s8 = await start('free-kick');
  await button(0,4,true); await ticks(1);
  const r8 = await kick(0,10);
  check(r8.s.ball.lastTouch?.playerId===s8.restart.taker,
    `${stage}: last touch ${r8.s.ball.lastTouch?.playerId} is not the taker ${s8.restart.taker}`);
  check(Math.abs(r8.s.ball.vz)<.05, `${stage}: vz ${r8.s.ball.vz} not below 0.05 in absolute value`);
  check(r8.speed>=6 && r8.speed<=10.5, `${stage}: speed ${r8.speed} outside [6,10.5]`);
  await button(0,4,false);
  await evidence(stage,{speed:r8.speed,vz:r8.s.ball.vz});
  await release();
  stage='09-penalty';
  // 9: Penalty with the stick aimed: hard shot.
  const s9 = await start('penalty');
  await axes(0,[dir,.2,0,0]); await ticks(2);
  const r9 = await kick(2,20);
  check(r9.s.ball.lastTouch?.playerId===s9.restart.taker,
    `${stage}: last touch ${r9.s.ball.lastTouch?.playerId} is not the taker ${s9.restart.taker}`);
  // □ held ~20 ticks: setPiecePower gives 16+10p, about 19.6 m/s after a tick of drag.
  check(r9.speed>=18, `${stage}: speed ${r9.speed} below 18`);
  await evidence(stage,{speed:r9.speed,vz:r9.s.ball.vz});
  await release();
  stage='10-panenka';
  // 10: L1 turns the penalty into the Panenka chip.
  const s10 = await start('penalty');
  await axes(0,[dir,.2,0,0]);
  await button(0,4,true); await ticks(1);
  const r10 = await kick(2,10);
  // Panenka leaves at speed 16, vz 4.5; the snapshot comes a few ticks later (drag, gravity).
  check(r10.speed>13&&r10.speed<=16.5, `${stage}: speed ${r10.speed} not in (13,16.5]`);
  check(r10.s.ball.vz>2&&r10.s.ball.vz<=4.6, `${stage}: vz ${r10.s.ball.vz} not in (2,4.6]`);
  check(Math.abs(r10.s.ball.vy)<.1, `${stage}: vy ${r10.s.ball.vy} not below 0.1 in absolute value`);
  await evidence(stage,{speed:r10.speed,vz:r10.s.ball.vz,vy:r10.s.ball.vy});
  await release();
  // 11: Corner attack strategies on pad 0.
  for (const [btn,want,name] of [[12,'fast','11a-corner-att-up'],[13,'near','11b-corner-att-down'],
    [14,'line','11c-corner-att-left'],[15,'far','11d-corner-att-right']]) {
    stage=name;
    await start('corner');
    await button(0,btn,true); await ticks(2); await button(0,btn,false); await ticks(2);
    const sc = await st();
    check(sc.phase==='corner', `${name}: phase ${sc.phase} left the corner`);
    check(sc.restart?.strategy?.attack===want,
      `${name}: attack strategy ${sc.restart?.strategy?.attack} is not ${want}`);
    await evidence(name,{tick:sc.tick,button:btn});
    await release();
  }
  // 12: Corner defence strategies on pad 1.
  for (const [btn,want,name] of [[12,'mixed','12a-corner-def-up'],[14,'man','12b-corner-def-left'],
    [15,'zonal','12c-corner-def-right']]) {
    stage=name;
    await start('corner');
    await button(1,btn,true); await ticks(2); await button(1,btn,false); await ticks(2);
    const sd = await st();
    check(sd.phase==='corner', `${name}: phase ${sd.phase} left the corner`);
    check(sd.restart?.strategy?.defence===want,
      `${name}: defence strategy ${sd.restart?.strategy?.defence} is not ${want}`);
    await evidence(name,{tick:sd.tick,button:btn});
    await release();
  }
  stage='13-wall-jump';
  // 13: SQ on pad 1 makes the whole wall jump.
  await start('free-kick');
  await button(1,2,true); await ticks(2); await button(1,2,false); await ticks(1);
  const w13 = await st();
  check(w13.wallJump.length===4, `${stage}: wallJump ${w13.wallJump.length} players, expected 4`);
  await evidence(stage,{wallJump:w13.wallJump.length});
  await release();
  stage='14-wall-hold';
  // 14: X held keeps the wall on the ground while SQ is pressed.
  await start('free-kick');
  await button(1,0,true); await ticks(2);
  await button(1,2,true); await ticks(2); await button(1,2,false); await ticks(1);
  const w14 = await st();
  check(w14.wallJump.length===0, `${stage}: wallJump ${w14.wallJump.length} players, expected 0`);
  await button(1,0,false);
  await evidence(stage,{wallJump:w14.wallJump.length});
  await release();
  stage='15-wall-charge';
  // 15: O on pad 1 charges the wall towards the ball.
  const s15 = await start('free-kick');
  const point15 = s15.restart.point;
  const wallBefore = (await snapshot()).players.filter(p=>!p.keeper && Math.abs(p.x-(point15.x+dir*9.15))<.3);
  check(wallBefore.length===4, `${stage}: wall of ${wallBefore.length} players at x ${point15.x+dir*9.15}, expected 4`);
  await button(1,1,true); await ticks(20);
  const charge = await snapshot();
  const wallSpeeds = [];
  for (const id of wallBefore.map(p=>p.id)) {
    const p = charge.players.find(q=>q.id===id);
    const speed = Math.hypot(p.vx,p.vy);
    wallSpeeds.push(speed);
    check(speed>2 && (p.vx*-dir)>0,
      `${stage}: wall player ${id} speed ${speed} (vx ${p.vx}) not charging towards the ball (dir ${dir})`);
  }
  await button(1,1,false);
  await evidence(stage,{wall:wallBefore.length,speeds:wallSpeeds});
  await release();
  stage='16-keeper-move';
  // 16: TRI + left stick down on pad 1 moves the defending keeper sideways.
  await start('free-kick');
  const k0 = (await st()).keepers.find(k=>k.team===1);
  await button(1,3,true);
  await axes(1,[0,.9,0,0]); await ticks(20);
  const k1 = (await st()).keepers.find(k=>k.team===1);
  check(Math.abs(k1.y-k0.y)>.3, `${stage}: keeper dy ${k1.y-k0.y} not above 0.3 in absolute value`);
  await evidence(stage,{y0:k0.y,y1:k1.y,dy:k1.y-k0.y});
  await release();
  stage='17-penalty-keeper';
  // 17: On the penalty the keeper only moves along the line with the stick.
  await start('penalty');
  const p0 = (await st()).keepers.find(k=>k.team===1);
  await axes(1,[0,.9,0,0]); await ticks(20);
  const p1 = (await st()).keepers.find(k=>k.team===1);
  check(Math.abs(p1.y-p0.y)>.3, `${stage}: keeper dy ${p1.y-p0.y} not above 0.3 in absolute value`);
  check(Math.abs(p1.x-p0.x)<.01, `${stage}: keeper dx ${p1.x-p0.x} not below 0.01 in absolute value`);
  await evidence(stage,{y0:p0.y,y1:p1.y,dy:p1.y-p0.y,dx:p1.x-p0.x});
  await release();
  stage='18-throw-in';
  // 18: The throw-in is kicked with the hand.
  const s18 = await start('throw-in');
  await axes(0,[dir,0,0,0]); await ticks(2);
  const r18 = await kick(0,15);
  check(r18.s.ball.lastTouch?.surface==='hand',
    `${stage}: surface ${r18.s.ball.lastTouch?.surface} is not hand`);
  check(r18.s.ball.lastTouch?.playerId===s18.restart.taker,
    `${stage}: last touch ${r18.s.ball.lastTouch?.playerId} is not the taker ${s18.restart.taker}`);
  await evidence(stage,{speed:r18.speed,vz:r18.s.ball.vz});
  await release();
  stage='19-goal-kick';
  // 19: The goal kick leaves the box towards the attacking half.
  const s19 = await start('goal-kick');
  await axes(0,[dir,0,0,0]); await ticks(2);
  const r19 = await kick(1,20);
  check(r19.s.ball.lastTouch?.surface==='foot',
    `${stage}: surface ${r19.s.ball.lastTouch?.surface} is not foot`);
  check(r19.s.ball.vx*dir>0, `${stage}: vx ${r19.s.ball.vx} does not leave towards dir ${dir}`);
  check(r19.s.ball.lastTouch?.playerId===s19.restart.taker,
    `${stage}: last touch ${r19.s.ball.lastTouch?.playerId} is not the taker ${s19.restart.taker}`);
  await evidence(stage,{speed:r19.speed,vx:r19.s.ball.vx});
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
console.log(`setpiece-e2e: steps=${results.length} errors=${errors.length} shots=${shots}`);
process.exit(errors.length ? 1 : 0);
