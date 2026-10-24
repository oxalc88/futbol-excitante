import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation/engine';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';
import { decideTeams } from '../src/simulation/tactics';
import type { World } from '../src/contracts/types';

// Isolated live checkpoints follow local-stage.test.ts: no AI cadence or incidental touches.
function fixture(){
  const c=createConfig({human:[true,true],halfSeconds:60});c.ai.cadence=100000;
  const sim=new Simulation(c,[makeTeam(0),makeTeam(1)]),w=sim.snapshot();
  w.tick=1;w.phase='playing';w.restart=null;w.restartRestriction=null;
  for(const p of w.players){p.x=p.team===0?-40:40;p.y=20+p.number*.8;p.touchCooldown=9999;p.intent.move={x:0,y:0};}
  const a=w.players.find(p=>p.team===0&&!p.keeper)!,b=w.players.find(p=>p.team===1&&!p.keeper)!;
  w.selected=[a.id,b.id];return{sim,w,a,b};
}
function touch(w:World,id:string,team:0|1){w.ball.lastTouch={id:'fixture:contact',playerId:id,team,tick:w.tick-1,surface:'foot',point:{x:w.ball.x,y:w.ball.y,z:w.ball.z}};}
function foul(x=0,slide=false,speed=0){
  const f=fixture();Object.assign(f.a,{x,y:0,vx:speed});Object.assign(f.b,{x:x+.95,y:0,heading:0});
  Object.assign(f.w.ball,{x:x+2,y:0,z:.11});touch(f.w,f.b.id,1);
  f.a.action={kind:slide?'slide':'tackle',start:0,contact:1,end:50,aim:{x:1,y:0},power:.6,resolved:false};return f;
}

test('fast sliding contact from behind gives a direct red and excludes the offender from play',()=>{
  const f=foul(0,true,10);f.sim.restore(f.w);const events=f.sim.step().events,w=f.sim.snapshot();
  const replay=foul(0,true,10);replay.sim.restore(replay.w);
  assert.deepEqual(replay.sim.step().events,events);assert.equal(replay.sim.stateHash(),f.sim.stateHash());
  assert(events.some(e=>e.type==='foul'&&e.data?.card==='red'));
  assert(events.some(e=>e.type==='red-card'&&e.data?.secondYellow===false));
  const p=w.players.find(p=>p.id===f.a.id)!;assert(p.sentOff);assert.equal(p.yellows,0);assert.equal(w.stats[0].reds,1);
  assert.notEqual(w.selected[0],p.id);decideTeams(w);assert(!w.teams[0].assignments[p.id]);assert.notEqual(w.teams[0].chaser,p.id);
  // Put the dismissed player next to the ball in open play: no movement, action or contact.
  w.phase='playing';w.restart=null;w.restartRestriction=null;Object.assign(w.ball,{x:p.x+.2,y:p.y});p.touchCooldown=0;p.intent.move={x:1,y:0};
  f.sim.restore(w);const next=f.sim.step(),after=f.sim.snapshot();
  assert(!next.events.some(e=>e.playerId===p.id&&['ball-contact','action-start'].includes(e.type)));
  assert.notEqual(after.carrier,p.id);assert.equal(after.players.find(q=>q.id===p.id)!.x,p.x);
});

test('DOGSO outside the area gives a direct red; an ordinary standing foul does not',()=>{
  for(const dogso of [false,true]){
    const f=foul(dogso?-30:0);if(dogso)for(const p of f.w.players.filter(p=>p.team===0&&p.id!==f.a.id&&!p.keeper))p.x=0;
    f.sim.restore(f.w);const events=f.sim.step().events,w=f.sim.snapshot();
    assert.equal(w.phase,'free-kick');assert.equal(w.restart?.team,1);assert.equal(w.stats[0].fouls,1);
    assert.equal(events.some(e=>e.type==='red-card'&&e.data?.secondYellow===false),dogso);
    assert.equal(w.players.find(p=>p.id===f.a.id)!.sentOff,dogso);assert.equal(w.stats[0].yellows,0);
  }
});

function advantage(){const f=fixture();Object.assign(f.a,{x:10,y:0});Object.assign(f.b,{x:0,y:0});Object.assign(f.w.ball,{x:.5,y:0,z:.11});touch(f.w,f.b.id,1);f.w.advantage={team:1,point:{x:0,y:0},until:3,offender:f.a.id,card:'yellow'};return f;}

test('advantage expires without progress, recalls the original spot, issues the card and restarts',()=>{
  const f=advantage();f.sim.restore(f.w);
  for(let i=0;i<2;i++){assert(!f.sim.step().events.some(e=>e.type==='advantage-recalled'));assert(f.sim.snapshot().advantage);}
  const events=f.sim.step().events,w=f.sim.snapshot();assert(events.some(e=>e.type==='advantage-recalled'));
  assert.equal(w.phase,'free-kick');assert.equal(w.restart?.team,1);assert.deepEqual(w.restart?.point,{x:0,y:0});assert.equal(w.advantage,null);assert.equal(w.stats[0].yellows,1);
  const limit=w.config.rules.humanRestartTicks;for(let i=0;i<limit;i++)f.sim.step();
  assert.equal(f.sim.phase,'playing');assert.equal(f.sim.snapshot().ball.lastTouch?.team,1);
});

test('advantage is realized: possession and forward progress consume the window, deferring the card',()=>{
  const f=advantage();f.w.tick=3;f.b.x=-4;f.w.ball.x=-3.5;f.sim.restore(f.w);
  const events=f.sim.step().events,w=f.sim.snapshot();assert(events.some(e=>e.type==='advantage-realized'));assert(!events.some(e=>e.type==='advantage-recalled'));
  assert.equal(w.phase,'playing');assert.equal(w.advantage,null);assert.equal(w.stats[0].yellows,0);assert.deepEqual(w.pendingCards,[{playerId:f.a.id,card:'yellow'}]);
});

test('a goal during advantage stands and the deferred foul card is issued once',()=>{
  const f=advantage();f.w.advantage!.until=100;Object.assign(f.w.ball,{x:-52,y:0,z:.3,vx:-90,vy:0,vz:0,flight:'pass'});touch(f.w,f.b.id,1);f.sim.restore(f.w);
  const events=f.sim.step().events,w=f.sim.snapshot();assert(events.some(e=>e.type==='goal'&&e.team===1));assert(!events.some(e=>e.type==='advantage-recalled'));
  assert.deepEqual(w.score,[0,1]);assert.equal(w.phase,'goal');assert.equal(w.restart?.team,0);assert.equal(w.advantage,null);assert.deepEqual(w.pendingCards,[]);assert.equal(w.stats[0].yellows,1);
  for(let i=0;i<w.config.rules.celebrationTicks;i++)f.sim.step();assert.equal(f.sim.snapshot().stats[0].yellows,1);
});

test('deliberate defender play resets offside before the flagged attacker receives',()=>{
  const f=fixture();Object.assign(f.a,{x:10,y:0});Object.assign(f.b,{x:0,y:0,touchCooldown:0});Object.assign(f.w.ball,{x:.5,y:0,z:.11});touch(f.w,f.a.id,0);f.w.offside={team:0,candidates:[f.a.id]};f.sim.restore(f.w);
  assert(f.sim.step().events.some(e=>e.type==='ball-contact'&&e.playerId===f.b.id));const w=f.sim.snapshot();assert.equal(w.offside,null);
  Object.assign(w.ball,{x:10.5,y:0,z:.11,vx:0,vy:0,vz:0});w.players.find(p=>p.id===f.a.id)!.touchCooldown=0;f.sim.restore(w);
  const events=f.sim.step().events;assert(events.some(e=>e.type==='ball-contact'&&e.playerId===f.a.id));assert(!events.some(e=>e.type==='offside'));assert.equal(f.sim.phase,'playing');assert.equal(f.sim.snapshot().stats[0].offsides,0);
});

for(const teamSize of [11,5,2])for(const seed of [2017,37,88])test(`CPU kickoff releases and touches the ball: ${teamSize}v${teamSize}, seed ${seed}`,()=>{
  function run(){
    const c=createConfig({teamSize,seed,human:[false,false]}),sim=new Simulation(c,[makeTeam(0,teamSize),makeTeam(1,teamSize)]);
    // Current design: a CPU kickoff executes when the configured restart countdown
    // (rules.restartTicks) ends. The test proves there is no deadlock: execution and
    // first contact happen within the countdown plus one second of play.
    // Executing CPU kickoffs earlier is a gameplay decision (it changes eval/baseline.json).
    const countdown=c.rules.restartTicks,bound=countdown+60,limit=bound;
    let firstContactTick:number|undefined,executionTick:number|undefined;
    const sequence:ReturnType<Simulation['step']>['events']=[];
    for(let i=0;i<limit;i++){
      const events=sim.step().events;sequence.push(...events);
      firstContactTick ??= events.find(e=>e.type==='ball-contact')?.tick;
      executionTick ??= events.find(e=>e.type==='kickoff-executed')?.tick;
    }
    const w=sim.snapshot();assert.equal(w.phase,'playing');assert.equal(w.restart,null);
    assert(firstContactTick!==undefined&&firstContactTick<=bound,`first contact must occur by tick ${bound}, got ${firstContactTick}`);
    assert(executionTick!==undefined&&executionTick<=countdown+1,`kickoff must execute by tick ${countdown+1}, got ${executionTick}`);
    assert(w.ball.lastTouch);assert(Math.hypot(w.ball.vx,w.ball.vy)>0);
    return{stateHash:sim.stateHash(),sequence};
  }
  const first=run(),second=run();assert.equal(second.stateHash,first.stateHash);assert.deepEqual(second.sequence,first.sequence);
});
