import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Replay } from '../src/contracts/types';
import { Simulation } from '../src/simulation/engine';
import { createConfig, engineVersion } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';
import { parseReplay, Recorder, runReplay } from '../src/adapters/replay';

const reference=JSON.parse(readFileSync(new URL(`./fixtures/reference-${engineVersion}.json`,import.meta.url),'utf8')) as Replay;
function replay(){return structuredClone(reference);}

test('stored reference verifies without changing its engine version or final hash',()=>{
  const r=parseReplay(replay());
  const result=runReplay(r);
  assert.equal(result.verified,true);
  assert.equal(result.sim.stateHash(),r.finalHash);
});
test('the stored engine-v4 reference is rejected: the current engine is the only one that verifies',()=>{
  const old=JSON.parse(readFileSync(new URL('./fixtures/reference-engine-v4.json',import.meta.url),'utf8')) as Replay;
  assert.equal(old.engine,'engine-v4');
  assert.notEqual(old.engine,engineVersion,'engine-v4 is an old version now');
  assert.throws(()=>parseReplay(old),new RegExp(`Versión de motor incompatible: engine-v4; se requiere ${engineVersion}`));
});
test('valid save/load round-trip is pure and records the engine version',()=>{
  const sim=new Simulation(createConfig({teamSize:2,human:[false,false]}),[makeTeam(0,2),makeTeam(1,2)]);
  const recorder=new Recorder(sim);
  for(let i=0;i<120;i++){
    if(i===0||i===70){const frames=[{tick:i,slot:0 as const,move:{x:1,y:0},aim:{x:1,y:0},sprint:false,shield:false,action:'pass' as const}];sim.applyInputs(frames);recorder.record(frames);}
    sim.step();
  }
  const saved=recorder.finish(sim),before=structuredClone(saved);
  assert.equal(saved.engine,engineVersion);
  assert.deepEqual(parseReplay(saved),before);
  assert.deepEqual(saved,before);
  assert.equal(runReplay(parseReplay(JSON.parse(JSON.stringify(saved)))).verified,true);
});
test('checkpoints recorded during CPU play remain valid',()=>{
  const sim=new Simulation(createConfig({teamSize:2,halfSeconds:2,human:[false,false]}),[makeTeam(0,2),makeTeam(1,2)]);
  for(let i=0;i<2000&&sim.phase!=='fulltime';i++){
    sim.step();if(i%20===0)assert.doesNotThrow(()=>parseReplay(new Recorder(sim).finish(sim)));
  }
});

test('checkpoints throughout a full eleven-a-side CPU match validate without mutation',()=>{
  const sim=new Simulation(createConfig({human:[false,false]}),[makeTeam(0),makeTeam(1)]);
  let checkpoints=0;
  for(let tick=0;tick<100000&&sim.phase!=='fulltime';tick++){
    sim.step();
    if(tick%1800===0){
      const saved=new Recorder(sim).finish(sim),before=structuredClone(saved);
      assert.doesNotThrow(()=>parseReplay(saved),`checkpoint at tick ${tick}`);
      assert.deepEqual(saved,before);checkpoints++;
    }
  }
  assert.equal(sim.phase,'fulltime');
  assert(checkpoints>=12);
  assert.doesNotThrow(()=>parseReplay(new Recorder(sim).finish(sim)));
});

test('goal celebration and immediate human kickoff checkpoints are valid',()=>{
  const sim=new Simulation(createConfig({teamSize:2,human:[true,true]}),[makeTeam(0,2),makeTeam(1,2)]);
  sim.applyInputs([{tick:0,slot:0,move:{x:0,y:0},aim:{x:1,y:0},action:'pass',sprint:false,shield:false}]);sim.step();
  assert(sim.snapshot().players.some(p=>p.action?.start===-7));
  assert.doesNotThrow(()=>parseReplay(new Recorder(sim).finish(sim)));
  const w=sim.snapshot();Object.assign(w.ball,{x:52,y:0,z:.3,vx:90,vy:0,vz:0});sim.restore(w);sim.step();
  assert.equal(sim.phase,'goal');
  assert.doesNotThrow(()=>parseReplay(new Recorder(sim).finish(sim)));
});
test('checkpoints in every supported browser size resume identically',()=>{
  for(const teamSize of [2,5,11]){
    const sim=new Simulation(createConfig({teamSize,human:[false,false]}),[makeTeam(0,teamSize),makeTeam(1,teamSize)]);
    for(let i=0;i<700;i++)sim.step();
    const recorder=new Recorder(sim);for(let i=0;i<60;i++)sim.step();
    assert.equal(runReplay(parseReplay(recorder.finish(sim))).verified,true);
  }
});

test('checkpoint with queued future input resumes identically',()=>{
  const sim=new Simulation(createConfig({teamSize:2,human:[true,true]}),[makeTeam(0,2),makeTeam(1,2)]);
  sim.applyInputs([{tick:20,slot:0,move:{x:0,y:0},aim:{x:1,y:0},action:'pass',sprint:false,shield:false}]);
  const recorder=new Recorder(sim);for(let i=0;i<90;i++)sim.step();
  assert.equal(runReplay(parseReplay(recorder.finish(sim))).verified,true);
});

const rejections:[string,(r:Replay)=>void,RegExp][]=[
  ['missing initial',r=>{delete (r as Partial<Replay>).initial;},/initial/],
  ['missing players',r=>{delete (r.initial as Partial<Replay['initial']>).players;},/cantidad de jugadores/],
  ['wrong player count',r=>{r.initial.players.pop();},/cantidad de jugadores/],
  ['wrong roster count',r=>{r.initial.teams[0].players.pop();},/cantidad de jugadores/],
  ['missing keeper',r=>{r.initial.teams[0].players[0].keeper=false;},/arquero/],
  ['extra keeper',r=>{r.initial.teams[0].players[1].keeper=true;},/arquero/],
  ['wrong state keeper',r=>{r.initial.players[0].keeper=false;},/arquero/],
  ['wrong player team',r=>{r.initial.players[0].team=1;},/jugador/],
  ['duplicate player',r=>{r.initial.players[1]=structuredClone(r.initial.players[0]);},/duplicado/],
  ['missing player coordinate',r=>{delete (r.initial.players[0] as Partial<Replay['initial']['players'][0]>).x;},/jugador.*x/],
  ['NaN player velocity',r=>{r.initial.players[0].vx=NaN;},/jugador.*vx/],
  ['infinite player heading',r=>{r.initial.players[0].heading=Infinity;},/jugador.*heading/],
  ['player position out of range',r=>{r.initial.players[0].x=10000;},/jugador.*x/],
  ['player energy out of range',r=>{r.initial.players[0].energy=1.01;},/energy/],
  ['player stability out of range',r=>{r.initial.players[0].stability=-1;},/stability/],
  ['missing capabilities',r=>{delete (r.initial.players[0] as Partial<Replay['initial']['players'][0]>).capabilities;},/Capacidad/],
  ['missing ball',r=>{delete (r.initial as Partial<Replay['initial']>).ball;},/balón/],
  ['missing ball coordinate',r=>{delete (r.initial.ball as Partial<Replay['initial']['ball']>).z;},/balón.z/],
  ['infinite ball velocity',r=>{r.initial.ball.vz=Infinity;},/balón.vz/],
  ['NaN ball spin',r=>{r.initial.ball.spin.x=NaN;},/balón.spin.x/],
  ['negative ball height',r=>{r.initial.ball.z=-1;},/balón.z/],
  ['missing score',r=>{delete (r.initial as Partial<Replay['initial']>).score;},/marcador/],
  ['short score',r=>{r.initial.score.pop();},/marcador/],
  ['negative score',r=>{r.initial.score[0]=-1;},/marcador/],
  ['fractional score',r=>{r.initial.score[0]=.5;},/marcador/],
  ['infinite score',r=>{r.initial.score[0]=Infinity;},/marcador/],
  ['missing tick',r=>{delete (r.initial as Partial<Replay['initial']>).tick;},/tick/],
  ['negative tick',r=>{r.initial.tick=-1;},/tick/],
  ['fractional tick',r=>{r.initial.tick=.5;},/tick/],
  ['non-finite tick',r=>{r.initial.tick=NaN;},/tick/],
  ['excessive tick',r=>{r.initial.tick=250001;},/tick/],
  ['missing phase',r=>{delete (r.initial as Partial<Replay['initial']>).phase;},/fase/],
  ['unknown phase',r=>{Object.assign(r.initial,{phase:'unknown'});},/fase/],
  ['missing configuration',r=>{delete (r.initial as Partial<Replay['initial']>).config;},/configuración/],
  ['invalid size',r=>{r.initial.config.teamSize=1;},/cantidad de jugadores/],
  ['missing nested configuration',r=>{delete (r.initial.config as Partial<Replay['initial']['config']>).physics;},/configuración.physics/],
  ['invalid half',r=>{Object.assign(r.initial,{half:3});},/mitad/],
  ['missing tactical value',r=>{delete (r.initial.teams[0].tactics as Partial<Replay['initial']['teams'][0]['tactics']>).tempo;},/táctica.*tempo/],
  ['missing intent',r=>{delete (r.initial.players[0] as Partial<Replay['initial']['players'][0]>).intent;},/intent/],
  ['invalid schema',r=>{Object.assign(r,{version:'replay-v1'});},/Esquema.*replay-v2/],
  ['different engine',r=>{r.engine='engine-future';},/motor incompatible.*engine-future/],
  ['legacy without engine',r=>{delete (r as Partial<Replay>).engine;},/anterior al versionado del motor/],
  ['invalid input',r=>{r.inputs=[{tick:0,slot:0,move:{x:NaN,y:0},aim:{x:0,y:0},sprint:false,shield:false}];},/entrada.move.x/],
  ['null input',r=>{Object.assign(r,{inputs:[null]});},/entrada/],
  ['unordered inputs',r=>{const f={slot:0 as const,move:{x:0,y:0},aim:{x:0,y:0},sprint:false,shield:false};r.inputs=[{...f,tick:2},{...f,tick:1}];},/fuera de orden/],
  ['invalid final hash',r=>{r.finalHash='zzzzzzzz';},/hash final/],
];
for(const [name,mutate,message]of rejections)test(`rejects ${name} with a specific Spanish error`,()=>{const r=replay();mutate(r);assert.throws(()=>parseReplay(r),message);});

for(const key of ['vx','vy']as const)for(const sign of [-1,1])
  test(`rejects finite out-of-range player ${key} (${sign})`,()=>{
    const r=replay();r.initial.players[0][key]=sign*10000;
    assert.throws(()=>parseReplay(r),new RegExp(`jugador.*${key}`));
  });
for(const key of ['x','y','z','vx','vy','vz']as const)for(const sign of [-1,1])
  test(`rejects finite out-of-range ball ${key} (${sign})`,()=>{
    const r=replay();r.initial.ball[key]=sign*10000;
    assert.throws(()=>parseReplay(r),new RegExp(`balón.${key}`));
  });
for(const key of ['x','y','z']as const)for(const sign of [-1,1])
  test(`rejects finite out-of-range ball spin ${key} (${sign})`,()=>{
    const r=replay();r.initial.ball.spin[key]=sign*10000;
    assert.throws(()=>parseReplay(r),new RegExp(`balón.spin.${key}`));
  });

test('accepts an accumulated finite heading beyond 2π',()=>{const r=replay();r.initial.players[0].heading=40*Math.PI;assert.doesNotThrow(()=>parseReplay(r));});
