import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation/engine';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';
import { canUseHands, inPenaltyArea, offsideInterferer } from '../src/simulation/rules';
import { ControllerMapper, type PadReading } from '../src/adapters/controller';
import { CameraRig, solveLimb } from '../src/adapters/presentation-model';
import { decideTeams } from '../src/simulation/tactics';
import type { InputFrame, World } from '../src/contracts/types';

function fixture(){const c=createConfig({human:[true,true],halfSeconds:60});c.ai.cadence=100000;const sim=new Simulation(c,[makeTeam(0),makeTeam(1)]),w=sim.snapshot();w.tick=1;w.phase='playing';w.restart=null;w.restartRestriction=null;for(const p of w.players){p.x=p.team===0?-40:40;p.y=20+p.number*.8;p.touchCooldown=9999;p.intent.move={x:0,y:0};}const a=w.players.find(p=>p.team===0&&!p.keeper)!,b=w.players.find(p=>p.team===1&&!p.keeper)!;Object.assign(a,{x:0,y:0,touchCooldown:0});Object.assign(b,{x:10,y:0,touchCooldown:0});w.selected=[a.id,b.id];return{sim,w,a,b};}
const input=(tick:number,slot:0|1=0,changes:Partial<InputFrame>={}):InputFrame=>({tick,slot,move:{x:0,y:0},aim:{x:1,y:0},power:.6,sprint:false,shield:false,...changes});
function touch(w:World,id:string,team:0|1){w.ball.lastTouch={id:`fixture:${w.tick}`,playerId:id,team,tick:w.tick-1,surface:'foot',point:{x:w.ball.x,y:w.ball.y,z:w.ball.z}};}
function foulFixture(x=0,slide=false){const f=fixture();Object.assign(f.a,{x,y:0});Object.assign(f.b,{x:x+.8,y:0,touchCooldown:9999});Object.assign(f.w.ball,{x:x+1.9,y:0,z:.11});touch(f.w,f.b.id,1);f.a.action={kind:slide?'slide':'tackle',start:0,contact:1,end:50,aim:{x:1,y:0},power:.6,resolved:false};return f;}

test('a body-first foul in the defender area awards a penalty at the correct end after either half',()=>{
  for(const dir of [1,-1]as const){const f=foulFixture(-42*dir);f.w.teams[0].direction=dir;f.w.teams[1].direction=dir===1?-1:1;f.sim.restore(f.w);f.sim.step();const w=f.sim.snapshot();assert.equal(w.phase,'penalty');assert.equal(w.restart?.team,1);assert.equal(w.ball.x,-41.5*dir);assert.equal(w.stats[1].penalties,1);}
});
test('second caution sends the player off and excludes them from possession, control and assignments',()=>{
  const f=foulFixture(0,true);f.a.yellows=1;f.sim.restore(f.w);const events=f.sim.step().events;assert(events.some(e=>e.type==='red-card'));const w=f.sim.snapshot(),p=w.players.find(p=>p.id===f.a.id)!;assert(p.sentOff);assert.notEqual(w.selected[0],p.id);decideTeams(w);assert(!w.teams[0].assignments[p.id]);
});
test('advantage is recalled at the original foul location when possession is lost',()=>{
  const f=fixture();f.w.advantage={team:1,point:{x:8,y:3},until:100,offender:f.a.id,card:'yellow'};Object.assign(f.w.ball,{x:.5,y:0,z:.11});touch(f.w,f.a.id,0);f.sim.restore(f.w);const events=f.sim.step().events,w=f.sim.snapshot();assert(events.some(e=>e.type==='advantage-recalled'));assert.equal(w.phase,'free-kick');assert.deepEqual(w.restart?.point,{x:8,y:3});assert.equal(w.stats[0].yellows,1);
});
test('human penalty executes from an input, stays forward and keeps all other players outside the area',()=>{
  const f=foulFixture(-42);f.sim.restore(f.w);f.sim.step();const before=f.sim.snapshot();assert(before.players.filter(p=>!p.keeper&&p.id!==before.restart!.taker&&!p.sentOff).every(p=>!inPenaltyArea(before,0,p)));
  f.sim.applyInputs([input(f.sim.tick,1,{action:'shoot',aim:{x:-1,y:.1}})]);const events=f.sim.step().events;assert(events.some(e=>e.type==='penalty-executed'));assert(f.sim.snapshot().ball.vx<0);assert.equal(f.sim.phase,'playing');
});
test('second contact by a restart taker gives an indirect free kick',()=>{
  const f=fixture();Object.assign(f.w.ball,{x:.5,y:0,z:.11});touch(f.w,f.a.id,0);f.w.restartRestriction={taker:f.a.id,team:0,indirect:false,kind:'free-kick'};f.sim.restore(f.w);f.sim.step();assert.equal(f.sim.phase,'indirect');assert.equal(f.sim.snapshot().restart?.team,1);
});
test('direct throw or indirect free kick cannot score without a second player contact',()=>{
  for(const kind of ['throw-in','indirect']as const){const f=fixture();Object.assign(f.w.ball,{x:52.5,y:0,z:1,vx:30,vy:0,vz:0});touch(f.w,f.a.id,0);f.w.restartRestriction={taker:f.a.id,team:0,indirect:true,kind};f.sim.restore(f.w);f.sim.step();assert.deepEqual(f.sim.snapshot().score,[0,0]);assert.equal(f.sim.phase,'goal-kick');}
});
test('a player in offside position can interfere with an opponent before touching the ball',()=>{
  const f=fixture();f.a.x=10;f.b.x=10.9;Object.assign(f.w.ball,{x:10.5,y:.4});f.w.offside={team:0,candidates:[f.a.id]};assert.equal(offsideInterferer(f.w)?.id,f.a.id);f.sim.restore(f.w);f.sim.step();assert.equal(f.sim.phase,'offside');
});
test('keeper hands are disallowed outside the area and on a deliberate teammate back-pass',()=>{
  const f=fixture(),g=f.w.players.find(p=>p.team===1&&p.keeper)!;Object.assign(g,{x:50,y:0});Object.assign(f.w.ball,{x:49.5,y:0});touch(f.w,f.a.id,0);assert(canUseHands(f.w,g));touch(f.w,f.b.id,1);assert(!canUseHands(f.w,g));f.w.ball.x=30;assert(!canUseHands(f.w,g));
});
test('hard low shot uses foot parry and finite recovery; deliberate save preserves offside flags',()=>{
  const f=fixture(),g=f.w.players.find(p=>p.team===1&&p.keeper)!;Object.assign(g,{x:50,y:0,touchCooldown:0,keeperReaction:-100});Object.assign(f.w.ball,{x:49.1,y:0,z:.2,vx:30,vy:0,vz:0,flight:'shot'});touch(f.w,f.a.id,0);f.w.offside={team:0,candidates:[f.a.id]};f.a.x=20;f.sim.restore(f.w);const events=f.sim.step().events,w=f.sim.snapshot();assert(events.some(e=>e.type==='keeper-parry'&&e.data?.surface==='foot'));assert.equal(w.players.find(p=>p.id===g.id)?.keeperMode,'recover');assert.deepEqual(w.offside?.candidates,[f.a.id]);assert.equal(w.stats[1].saves,1);
});
test('a reachable high cross is caught at its contact point and released with a hand event',()=>{
  const f=fixture(),g=f.w.players.find(p=>p.team===1&&p.keeper)!;Object.assign(g,{x:50,y:0,touchCooldown:0,keeperMode:'dive',keeperReaction:-100});Object.assign(f.w.ball,{x:49.5,y:0,z:2.4,vx:8,vy:0,vz:-1,flight:'pass'});touch(f.w,f.a.id,0);f.sim.restore(f.w);f.sim.step();const held=f.sim.snapshot();assert.equal(held.keeperHold?.playerId,g.id);const point={...held.ball};for(let i=0;i<10;i++)f.sim.step();assert.equal(f.sim.snapshot().ball.z,point.z);let released=false;for(let i=0;i<60;i++){if(f.sim.step().events.some(e=>e.type==='pass'&&e.playerId===g.id))released=true;}assert(released);assert.equal(f.sim.snapshot().keeperHold,null);
});
test('eight-second keeper hold gives an opponent corner',()=>{
  const f=fixture(),g=f.w.players.find(p=>p.team===1&&p.keeper)!;Object.assign(g,{x:50,y:0,touchCooldown:9999,keeperMode:'hold'});Object.assign(f.w.ball,{x:50,y:0,z:1.4});f.w.keeperHold={playerId:g.id,since:-500};f.sim.restore(f.w);f.sim.step();assert.equal(f.sim.phase,'corner');assert.equal(f.sim.snapshot().restart?.team,0);
});

function pad(index:number,buttons:number[]=[],axes=[0,0,0,0]):PadReading{return{index,id:`pad${index}`,connected:true,mapping:'standard',axes,buttons:Array.from({length:17},(_,i)=>({pressed:buttons.includes(i)}))};}
test('two controller identities keep their slots after one disconnects, with no phantom release on reconnect',()=>{
  const m=new ControllerMapper();m.sample([pad(0),pad(1)],0,0);m.sample([pad(0),pad(1)],0,1);m.sample([pad(1)],1,0);assert(m.assignments()[1]?.startsWith('1:'));assert.equal(m.sample([pad(1,[0])],1,1).action,'pass');m.sample([pad(0,[1]),pad(1)],2,0);assert.equal(m.sample([pad(0),pad(1)],3,0).action,undefined);
});
test('controller charge fires once; dead zone, independent aim and pause edges are stable',()=>{
  const m=new ControllerMapper();m.sample([pad(0)],0,0);for(let t=1;t<30;t++)m.sample([pad(0,[1])],t,0);const shot=m.sample([pad(0,[],[.1,0,0,1])],30,0);assert.equal(shot.action,'shoot');assert(shot.power>.5);assert.equal(shot.move.x,0);assert.deepEqual(shot.aim,{x:0,y:1});assert.equal(m.sample([pad(0)],31,0).action,undefined);assert(!m.pauseRequested([pad(0)]));assert(m.pauseRequested([pad(0,[9])]));assert(!m.pauseRequested([pad(0,[9])]));m.reset();assert.equal(m.sample([pad(0,[0])],32,0).action,undefined);
});
test('camera changes and repeated draws cannot change authoritative state or camera integration',()=>{
  const f=fixture(),a=new CameraRig(),b=new CameraRig();f.sim.restore(f.w);for(let i=0;i<120;i++){f.sim.step();const s=f.sim.presentation();a.advance(s);b.advance(s);for(let j=0;j<3;j++){b.advance(s);b.pose(.6,j/3);}}const hash=f.sim.stateHash();assert.deepEqual(a.pose(),b.pose());a.mode='close';a.pose();assert.equal(f.sim.stateHash(),hash);
});
test('two-bone contact mapping preserves limb lengths and exact feasible contact endpoints',()=>{
  const root={x:0,y:0,z:.76},end={x:.95,y:.1,z:.11},limb=solveLimb(root,end,[.78,.78])!;assert(limb);assert(Math.abs(Math.hypot(limb.knee.x,limb.knee.y,limb.knee.z-.76)-.78)<1e-9);assert.deepEqual(limb.end,end);assert.equal(solveLimb(root,{x:4,y:0,z:0},[.78,.78]),null);
});
