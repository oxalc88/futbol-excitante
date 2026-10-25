import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation/engine';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';
import type { InputFrame, TeamIndex } from '../src/contracts/types';
import { shouldPause } from '../src/browser/pause-state';
import { parseReplay, Recorder, runReplay } from '../src/adapters/replay';
function match(human:[boolean,boolean]=[true,true]){
 const s=new Simulation(createConfig({teamSize:2,human,seed:41}),[makeTeam(0,2),makeTeam(1,2)]);
 const w=s.snapshot();w.phase='playing';w.restart=null;s.restore(w);return s;
}
function frame(s:Simulation,slot:TeamIndex,extra:Partial<InputFrame>={}):InputFrame{
 return {tick:s.tick,slot,move:{x:0,y:0},aim:{x:slot===0?1:-1,y:0},sprint:false,shield:false,...extra};
}
for(const slot of [0,1] as const){
 test(`keeper switch, move, rush, dive and return: team ${slot}`,()=>{
  const s=match(),copy=match(),rec=new Recorder(s);
  const keeper=s.snapshot().players.find(p=>p.team===slot&&p.keeper)!;
  for(let i=0;i<180;i++){
   const f=frame(s,slot,{switchKeeper:i===0||i===170,move:{x:slot===0?1:-1,y:1},sprint:i>=30&&i<60,action:i===70?'tackle':undefined});
   s.applyInputs([f]);copy.applyInputs([f]);rec.record([f]);s.step();copy.step();
   assert.equal(s.stateHash(),copy.stateHash());
   const w=s.snapshot(),p=w.players.find(p=>p.id===keeper.id)!;
   if(i<170){assert.equal(w.selected[slot],p.id);assert(Math.hypot(p.x+(slot===0?1:-1)*w.config.pitch.length/2,p.y)<=w.config.goalkeeper.radius+1e-9);assert(Math.abs(p.y)<=w.config.goalkeeper.lateral);}
   if(i===70)assert.equal(p.keeperMode,'dive');
   if(i===170)assert.equal(w.selected[slot],w.players.find(p=>p.team===slot&&!p.keeper)!.id);
  }
  assert(runReplay(rec.finish(s)).verified);
 });
 for(const action of ['pass','shoot'] as const)test(`held keeper ${action}, team ${slot}`,()=>{
  const s=match();s.applyInputs([frame(s,slot,{switchKeeper:true})]);s.step();
  const w=s.snapshot(),p=w.players.find(p=>p.keeper&&p.team===slot)!;
  w.keeperHold={playerId:p.id,since:w.tick};p.keeperMode='hold';p.action=null;
  Object.assign(w.ball,{x:p.x,y:p.y,z:.8,vx:0,vy:0,vz:0});s.restore(w);
  for(let i=0;i<60;i++){
   s.applyInputs([frame(s,slot,{action:i===10?action:undefined})]);s.step();
   if(i<10)assert(s.snapshot().keeperHold);
  }
  assert.equal(s.snapshot().keeperHold,null);
  assert(s.snapshot().stats[slot][action==='shoot'?'shots':'passes']>0);
 });
 test(`existing switch returns from keeper for team ${slot}`,()=>{
  const s=match();s.applyInputs([frame(s,slot,{switchKeeper:true})]);s.step();
  s.applyInputs([frame(s,slot,{switchPlayer:true})]);s.step();
  assert(!s.snapshot().players.find(p=>p.id===s.snapshot().selected[slot])!.keeper);
 });
}
test('both keepers stay selected; pause does not advance authority',()=>{
 const s=match();s.applyInputs([frame(s,0,{switchKeeper:true}),frame(s,1,{switchKeeper:true})]);s.step();
 const hash=s.stateHash();
 for(let i=0;i<30;i++)if(!shouldPause(true,false,false))s.step();
 assert.equal(s.stateHash(),hash);
 for(let i=0;i<10;i++){s.applyInputs([frame(s,0),frame(s,1)]);s.step();}
 for(const slot of [0,1] as const)assert(s.snapshot().players.find(p=>p.id===s.snapshot().selected[slot])!.keeper);
});

test('CPU state hashes match the engine before C10 on every tick, kickoff stays at 60',async()=>{
 const {readFileSync}=await import('node:fs');
 const hashes=JSON.parse(readFileSync(new URL('./fixtures/c10-cpu-hashes.json',import.meta.url),'utf8')) as string[];
 const s=new Simulation(createConfig({teamSize:2,human:[false,false],seed:41,halfSeconds:5}),[makeTeam(0,2),makeTeam(1,2)]);
 for(let i=0;i<hashes.length;i++){
  s.step();assert.equal(s.stateHash(),hashes[i],`tick ${i+1}`);
  if(i===58)assert.equal(s.phase,'kickoff');
  if(i===59)assert.equal(s.phase,'playing');
 }
});

for(const slot of [0,1] as const)test(`human dive catches a live incoming ball and distributes: team ${slot}`,()=>{
 const s=match();s.applyInputs([frame(s,slot,{switchKeeper:true})]);s.step();
 const w=s.snapshot(),p=w.players.find(p=>p.keeper&&p.team===slot)!,dir=w.teams[slot].direction;
 p.keeperMode='ready';p.keeperReaction=w.tick;p.vx=p.vy=0;
 w.ball.lastTouch={id:'shot',tick:w.tick,playerId:w.players.find(q=>q.team!==slot&&!q.keeper)!.id,team:slot===0?1:0,surface:'foot',point:{x:p.x+dir*.5,y:0,z:.9}};
 Object.assign(w.ball,{x:p.x+dir*.5,y:p.y,z:.9,vx:-dir*8,vy:0,vz:0,flight:'shot'});
 s.restore(w);
 s.applyInputs([frame(s,slot,{action:'tackle',aim:{x:0,y:1}})]);s.step();
 assert.equal(s.snapshot().keeperHold?.playerId,p.id);
 assert.equal(s.snapshot().stats[slot].saves,1);
 assert(s.snapshot().events.some(e=>e.type==='keeper-ball-contact'));
 for(let i=0;i<20;i++){s.applyInputs([frame(s,slot,{action:i===0?'pass':undefined})]);s.step();}
 assert.equal(s.snapshot().keeperHold,null);
});

test('switch out uses distance then stable id, and CPU releases a held ball',()=>{
 const s=new Simulation(createConfig({teamSize:5,human:[true,false]}),[makeTeam(0,5),makeTeam(1,5)]);
 let w=s.snapshot();w.phase='playing';w.restart=null;s.restore(w);
 s.applyInputs([frame(s,0,{switchKeeper:true})]);s.step();
 w=s.snapshot();const keeper=w.players.find(p=>p.team===0&&p.keeper)!;
 w.keeperHold={playerId:keeper.id,since:w.tick};keeper.keeperMode='hold';keeper.action=null;
 Object.assign(w.ball,{x:keeper.x,y:keeper.y,z:.8,vx:0,vy:0,vz:0});
 const field=w.players.filter(p=>p.team===0&&!p.keeper).sort((a,b)=>a.id.localeCompare(b.id));
 field.forEach((p,i)=>{p.x=keeper.x+5+i;p.y=5;});
 field[1].x=field[0].x;field[1].y=field[0].y;
 s.restore(w);s.applyInputs([frame(s,0,{switchPlayer:true})]);s.step();
 assert.equal(s.snapshot().selected[0],field[0].id);
 for(let i=0;i<60;i++){s.applyInputs([frame(s,0)]);s.step();}
 assert.equal(s.snapshot().keeperHold,null);
});

test('eleven-a-side manual keeper stays inside configured movement limits',()=>{
 const s=new Simulation(createConfig({human:[true,false]}),[makeTeam(0),makeTeam(1)]);
 const w=s.snapshot();w.phase='playing';w.restart=null;s.restore(w);
 for(let i=0;i<240;i++){
  s.applyInputs([frame(s,0,{switchKeeper:i===0,move:{x:1,y:1},sprint:true})]);s.step();
  const p=s.snapshot().players.find(p=>p.keeper&&p.team===0)!;
  assert(Math.hypot(p.x+52.5,p.y)<=16+1e-9);assert(Math.abs(p.y)<=15);
 }
});

test('checkpoint with an active manual keeper validates and replays',()=>{
 const s=match();s.applyInputs([frame(s,0,{switchKeeper:true})]);s.step();
 const recorder=new Recorder(s);
 for(let i=0;i<40;i++){const f=frame(s,0,{move:{x:0,y:1},action:i===5?'tackle':undefined});s.applyInputs([f]);recorder.record([f]);s.step();}
 assert(runReplay(parseReplay(recorder.finish(s))).verified);
});
