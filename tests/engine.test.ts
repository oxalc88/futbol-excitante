import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation/engine';
import { createConfig } from '../src/simulation/config';
import { makeTeam, validateTeam } from '../src/adapters/data';
import { Recorder, runReplay } from '../src/adapters/replay';
import type { InputFrame, PlayerState, World } from '../src/contracts/types';
import { distance } from '../src/simulation/math';

function make(options:Parameters<typeof createConfig>[0]={}){const c=createConfig({halfSeconds:60,human:[false,false],...options});return new Simulation(c,[makeTeam(0,c.teamSize),makeTeam(1,c.teamSize)]);}
function frame(tick:number,changes:Partial<InputFrame>={}):InputFrame{return{tick,slot:0,move:{x:0,y:0},aim:{x:1,y:0},sprint:false,shield:false,...changes};}
function live(sim:Simulation){const w=sim.snapshot();w.phase='playing';w.restart=null;w.offside=null;w.ball.lastTouch=null;w.tick=1;for(const p of w.players){p.x=p.team===0?-35:35;p.y=p.number*2-14;p.touchCooldown=10000;p.intent={move:{x:0,y:0},aim:{x:1,y:0},sprint:false,shield:false,power:.5};}return w;}
function lastTouch(w:World,team:0|1){const p=w.players.find(p=>p.team===team)!;w.ball.lastTouch={id:'setup:contact',tick:0,playerId:p.id,team,surface:'foot',point:{x:w.ball.x,y:w.ball.y,z:w.ball.z}};}

test('same seed and input stream produce identical hashes; restoration includes RNG, AI and queued inputs',()=>{
  const a=make(),b=make();for(let t=0;t<1800;t++){a.step();b.step();}assert.equal(a.stateHash(),b.stateHash());
  const checkpoint=a.snapshot();for(let t=0;t<600;t++)a.step();b.restore(checkpoint);for(let t=0;t<600;t++)b.step();assert.equal(a.stateHash(),b.stateHash());
  const c=make({seed:37});for(let t=0;t<2400;t++)c.step();assert.notEqual(a.stateHash(),c.stateHash());
});
test('checkpoints and presentation are detached from authoritative storage',()=>{
  const sim=make(),h=sim.stateHash(),s=sim.snapshot(),p=sim.presentation();s.ball.x=999;p.players[0].x=999;assert.equal(sim.stateHash(),h);
});
test('rejects non-finite, duplicate, stale input and invalid tactical commands atomically',()=>{
  const s=make();assert.throws(()=>s.applyInputs([frame(0,{move:{x:NaN,y:0}})]));
  assert.throws(()=>s.applyInputs([frame(0),frame(0)]));assert.equal(s.snapshot().inputs.length,0);
  s.applyInputs([frame(0)]);assert.throws(()=>s.applyInputs([frame(0)]));s.step();assert.throws(()=>s.applyInputs([frame(0)]));
  assert.throws(()=>s.applyInputs([frame(1,{tactics:{pressing:10}})]));
});
test('player accelerates and brakes with inertia; archetypes differ under identical commands',()=>{
  const sim=make({human:[true,true]});const w=live(sim);const p=w.players.find(p=>p.team===0&&!p.keeper)!;p.x=-20;p.y=0;p.touchCooldown=10000;w.selected[0]=p.id;w.ball.x=30;w.ball.y=25;sim.restore(w);
  sim.applyInputs([frame(sim.tick,{move:{x:1,y:0},sprint:true})]);sim.step();let moving=sim.snapshot().players.find(q=>q.id===p.id)!;assert(moving.vx>0&&moving.vx<p.capabilities.speed*.1);
  for(let i=0;i<90;i++){sim.applyInputs([frame(sim.tick,{move:{x:1,y:0},sprint:true})]);sim.step();}
  const before=sim.snapshot().players.find(q=>q.id===p.id)!;sim.applyInputs([frame(sim.tick)]);sim.step();moving=sim.snapshot().players.find(q=>q.id===p.id)!;assert(moving.x>before.x);assert(moving.vx>0&&moving.vx<before.vx);
  assert.notEqual(makeTeam(0).players[1].capabilities.acceleration,makeTeam(0).players[3].capabilities.acceleration);
});
test('ball rolls, slows and falls without player ownership or target attraction',()=>{
  const s=make();const w=live(s);Object.assign(w.ball,{x:0,y:0,z:.11,vx:10,vy:0,vz:0});s.restore(w);
  for(let t=0;t<60;t++)s.step();let b=s.snapshot().ball;assert(b.x>8&&b.x<10);assert(b.vx<10&&b.vx>8);assert.equal(b.lastTouch,null);
  const air=live(s);Object.assign(air.ball,{x:0,y:0,z:5,vx:0,vy:0,vz:0});s.restore(air);for(let t=0;t<20;t++)s.step();b=s.snapshot().ball;assert(b.z<5&&b.z>0);assert(b.vz<0);
});
test('fast swept crossing scores once and triggers a frozen restart for conceding team',()=>{
  const s=make();const w=live(s);Object.assign(w.ball,{x:52,y:0,z:.3,vx:90,vy:0,vz:0});lastTouch(w,0);s.restore(w);s.step();let result=s.snapshot();assert.deepEqual(result.score,[1,0]);assert.equal(result.phase,'goal');assert.equal(result.restart?.team,1);
  const played=result.played;for(let t=0;t<30;t++)s.step();result=s.snapshot();assert.deepEqual(result.score,[1,0]);assert.equal(result.played,played);
});
test('post collision deflects shot instead of awarding a goal',()=>{
  const s=make();const w=live(s);Object.assign(w.ball,{x:52.1,y:3.66,z:1,vx:45,vy:0,vz:0});lastTouch(w,0);s.restore(w);const events=s.step().events;assert(events.some(e=>e.type==='post-contact'));assert.equal(s.snapshot().score[0],0);assert(s.snapshot().ball.vx<0);
});
test('throw-in, corner and goal kick use last touch and current attacking direction',()=>{
  for(const [axis,team,expected]of [['y',0,'throw-in'],['x',1,'corner'],['x',0,'goal-kick']]as const){
    const s=make();const w=live(s);Object.assign(w.ball,axis==='y'?{x:0,y:34,z:1,vx:0,vy:30,vz:0}:{x:52.4,y:15,z:1,vx:30,vy:0,vz:0});lastTouch(w,team);s.restore(w);s.step();const r=s.snapshot();assert.equal(r.phase,expected);assert.equal(r.restart?.team,axis==='y'?1:expected==='corner'?0:1);
    const anchors=r.players.map(p=>[p.x,p.y]),played=r.played;for(let i=0;i<30;i++)s.step();assert.deepEqual(s.snapshot().players.map(p=>[p.x,p.y]),anchors);assert.equal(s.snapshot().played,played);
  }
  const s=make();const w=live(s);w.teams[0].direction=-1;w.teams[1].direction=1;Object.assign(w.ball,{x:52.4,y:14,z:1,vx:30,vy:0,vz:0});lastTouch(w,0);s.restore(w);s.step();assert.equal(s.snapshot().restart?.team,1);assert.equal(s.snapshot().phase,'corner');
});
test('halftime changes direction and a complete CPU match reaches fulltime with finite state',()=>{
  const s=make({halfSeconds:12});let switched=false;
  for(let i=0;i<10000&&s.phase!=='fulltime';i++){s.step();if(i%60===0)s.assertInvariants();if(s.snapshot().half===2)switched=true;}
  const w=s.snapshot();assert(switched);assert.equal(w.phase,'fulltime');assert.equal(w.teams[0].direction,-1);assert.equal(w.played,12);assert(w.stats[0].passes+w.stats[1].passes>0);
});
test('keepers hold bounded goal arcs and are excluded from the outfield chase and restarts',()=>{
  const s=make({teamSize:5});for(let t=0;t<1800;t++){s.step();if(t%30!==0)continue;const w=s.snapshot();for(const p of w.players.filter(p=>p.keeper)){assert(distance(p,{x:-w.teams[p.team].direction*w.config.pitch.length/2,y:0})<=w.config.goalkeeper.radius+.00001);assert.notEqual(w.teams[p.team].chaser,p.id);assert.notEqual(w.restart?.taker,p.id);}}
});
test('first touch and pass have recorded physical contacts; no pass homing after release',()=>{
  const s=make({human:[true,true]});const w=live(s);const p=w.players.find(p=>p.team===0&&!p.keeper)!;p.x=0;p.y=0;p.heading=0;p.touchCooldown=0;w.selected[0]=p.id;Object.assign(w.ball,{x:.5,y:0,z:.11,vx:0,vy:0,vz:0});lastTouch(w,0);s.restore(w);
  s.applyInputs([frame(s.tick,{action:'pass'})]);let found=false;
  for(let i=0;i<12;i++){const events=s.step().events;if(events.some(e=>e.type==='pass'))found=true;}
  assert(found);const b=s.snapshot().ball;assert(b.vx!==0||b.vy!==0);assert(b.lastTouch?.playerId===p.id);
});
test('offside is only called when a flagged player contacts the ball',()=>{
  const s=make();const w=live(s),p=w.players.find(p=>p.team===0&&!p.keeper)!;p.x=10;p.y=0;p.touchCooldown=0;w.offside={team:0,candidates:[p.id]};Object.assign(w.ball,{x:10.5,y:0,z:.11,vx:-2,vy:0,vz:0});lastTouch(w,0);s.restore(w);s.step();assert.equal(s.snapshot().phase,'offside');assert.equal(s.snapshot().restart?.team,1);
});
test('replay reconstructs the exact match including action inputs and tactical changes',()=>{
  const s=make({human:[true,false]}),rec=new Recorder(s);for(let i=0;i<500;i++){
    const f=frame(s.tick,{move:{x:i%120<60?1:-1,y:.2},sprint:true,action:i%90===0?'shoot':undefined,tactics:i===120?{formation:'3-5-2',width:.9}:undefined});s.applyInputs([f]);rec.record([f]);s.step();
  }const replay=rec.finish(s),r=runReplay(replay);assert(r.verified);assert.equal(r.sim.stateHash(),s.stateHash());
});
test('neutral data adapter rejects illegal capability ranges and duplicate identities',()=>{
  assert.doesNotThrow(()=>validateTeam(makeTeam(0)));const t=makeTeam(0);t.players[1].capabilities.speed=1000;assert.throws(()=>validateTeam(t));const u=makeTeam(1);u.players[1].id=u.players[0].id;assert.throws(()=>validateTeam(u));
});

test('two human slots move their own selected players without stealing the other control slot',()=>{
  const s=make({human:[true,true]}),w=live(s);
  const a=w.players.find(p=>p.team===0&&!p.keeper)!,b=w.players.find(p=>p.team===1&&!p.keeper)!;
  a.x=-10;a.y=-10;b.x=10;b.y=10;w.selected=[a.id,b.id];w.ball.x=40;w.ball.y=25;s.restore(w);
  for(let i=0;i<30;i++){s.applyInputs([frame(s.tick,{move:{x:1,y:0}}),frame(s.tick,{slot:1,move:{x:-1,y:0},aim:{x:-1,y:0}})]);s.step();}
  const result=s.snapshot();assert(result.players.find(p=>p.id===a.id)!.x>a.x);assert(result.players.find(p=>p.id===b.id)!.x<b.x);assert.deepEqual(result.selected,[a.id,b.id]);
});

test('a keeper claim on a pass does not increment shot-save statistics',()=>{
  const s=make(),w=live(s),keeper=w.players.find(p=>p.team===1&&p.keeper)!;
  keeper.x=50;keeper.y=0;keeper.touchCooldown=0;keeper.keeperReaction=-1000;
  Object.assign(w.ball,{x:49.3,y:0,z:.5,vx:10,vy:0,vz:0,flight:'pass'});lastTouch(w,0);s.restore(w);
  const events=s.step().events;assert(events.some(e=>e.type==='keeper-ball-contact'));assert.equal(s.snapshot().stats[1].saves,0);
});

test('render cadence does not change an explicitly scheduled number of fixed steps',()=>{
  function drive(hz:number){const s=make();let accumulator=0;for(let i=0;i<hz*3;i++){accumulator+=1/hz;while(accumulator+1e-10>=1/60){s.step();accumulator-=1/60;}}return s;}
  const a=drive(60),b=drive(144);assert.equal(a.tick,180);assert.equal(b.tick,180);assert.equal(a.stateHash(),b.stateHash());
});
