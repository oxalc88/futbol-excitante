import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfig, cpuTunings, cpuReactionTicks, cpuErrorScale, cpuPressingScale } from '../src/simulation/config';
import { Simulation } from '../src/simulation/engine';
import { makeTeam } from '../src/adapters/data';
import { hash } from '../src/simulation/math';
import { loadCpuDifficulty, saveCpuDifficulty, parseCpuDifficulty, matchCpuDifficulty } from '../src/browser/start-menu';
import type { Config, CpuDifficulty } from '../src/contracts/types';

const levels:CpuDifficulty[]=['easy','normal','hard'];
const memory=()=>{const values=new Map<string,string>();return{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};};

/** Gameplay state of a match: the whole world without `config`. A level may never win by config alone. */
function gameplayState(sim:Simulation){const state:Record<string,unknown> = {...sim.snapshot()};delete state.config;return state;}
function gameplayHash(sim:Simulation){return hash(gameplayState(sim));}

/** New match config for one level: CPU team 1, human team 0. */
function levelConfig(level?:CpuDifficulty){return createConfig({difficulty:level,seed:2017,human:[true,false],halfSeconds:60});}
function run(config:Config,ticks:number){const sim=new Simulation(config,[makeTeam(0),makeTeam(1)]);for(let i=0;i<ticks;i++)sim.step();return sim;}
function match(level:CpuDifficulty|undefined,ticks:number){
  const sim=run(levelConfig(level),ticks);
  return {gameplay:gameplayHash(sim),state:sim.stateHash(),score:sim.snapshot().score};
}

test('each level maps to its CPU parameters',()=>{
  assert.deepEqual(cpuTunings,{
    easy:{reaction:2,accuracy:1.5,pressing:.6},
    normal:{reaction:1,accuracy:1,pressing:1},
    hard:{reaction:.5,accuracy:.6,pressing:1.4},
  });
  // Default config: decision delay 6 ticks, kick error .075, pressing .6.
  const ticks:Record<CpuDifficulty,number>={easy:12,normal:6,hard:3};
  for(const level of levels){
    const config=levelConfig(level);
    assert.equal(cpuReactionTicks(config),ticks[level],`${level} decision delay`);
    assert.equal(cpuErrorScale(config,1),cpuTunings[level].accuracy,`${level} CPU kick error`);
    assert.equal(cpuPressingScale(config,1),cpuTunings[level].pressing,`${level} CPU pressing`);
    // Human teams never change with difficulty.
    assert.equal(cpuErrorScale(config,0),1);
    assert.equal(cpuPressingScale(config,0),1);
  }
  // Two teams without a human slot both take the CPU values.
  const watch=createConfig({difficulty:'easy',human:[false,false]});
  assert.equal(cpuErrorScale(watch,0),cpuTunings.easy.accuracy);
  assert.equal(cpuPressingScale(watch,0),cpuTunings.easy.pressing);
});

test('Normal is exactly the current config and the current CPU behaviour',()=>{
  // Config hash taken before difficulty existed: a Normal config must not change.
  assert.equal(hash(createConfig()),'061f999d');
  assert.equal('difficulty' in createConfig(),false);
  assert.deepEqual(createConfig({difficulty:'normal'}),createConfig());
  // An unknown level falls back to Normal.
  const unknownLevel:string='medium';
  assert.deepEqual(createConfig({difficulty:unknownLevel as CpuDifficulty}),createConfig());
  assert.equal(parseCpuDifficulty(unknownLevel),'normal');
  assert.equal(parseCpuDifficulty(undefined),'normal');
  assert.equal(cpuReactionTicks(createConfig()),createConfig().ai.cadence);
  assert.equal(cpuErrorScale(createConfig(),1),1);
  assert.equal(cpuPressingScale(createConfig(),1),1);
  // A seeded CPU match runs identical with and without an explicit Normal level.
  const plain=match(undefined,1800),normal=match('normal',1800);
  assert.equal(normal.gameplay,plain.gameplay);
  assert.equal(normal.state,plain.state);
  assert.deepEqual(normal.score,plain.score);
});

test('a Normal CPU-vs-CPU match keeps the frozen pre-change gameplay hash',()=>{
  // Frozen on engine-v4 (C7 part 3 acceleration and turn retune). Difficulty Normal must not move at all.
  const sim=run(createConfig({seed:2017,human:[false,false],halfSeconds:60}),3600);
  assert.equal(gameplayHash(sim),'d32a612e','Normal gameplay must stay bit-identical to engine-v4 (C7 part 3 retune)');
  assert.equal(sim.stateHash(),'eb159334');
  assert.equal(hash(sim.snapshot().config),'61e3105f');
  assert.deepEqual(sim.snapshot().score,[0,0]);
  assert.equal(sim.phase,'playing');
});

test('every level keeps the CPU kickoff at 60 ticks',()=>{
  for(const level of levels){
    const config=createConfig({difficulty:level,seed:2017,human:[false,false],halfSeconds:60});
    assert.equal(config.rules.restartTicks,60);
    const sim=new Simulation(config,[makeTeam(0),makeTeam(1)]);
    assert.equal(sim.snapshot().restart?.remaining,60);
    for(let i=0;i<59;i++)sim.step();
    assert.equal(sim.phase,'kickoff');
    sim.step();
    assert.equal(sim.phase,'playing');
  }
});

test('the saved level is read back; missing or invalid values give Normal',()=>{
  const storage=memory();
  assert.equal(loadCpuDifficulty(storage),'normal');
  for(const level of levels)assert.equal(saveCpuDifficulty(storage,level),level);
  assert.equal(storage.getItem('fe.cpuDifficulty'),'hard');
  assert.equal(loadCpuDifficulty(storage),'hard');
  assert.equal(saveCpuDifficulty(storage,'normal'),'normal');
  assert.equal(loadCpuDifficulty(storage),'normal');
  for(const value of ['','2','HARD','easy-ish','__proto__','constructor',null,undefined]){
    const stored=memory();
    if(value!==undefined)stored.setItem('fe.cpuDifficulty',value as string);
    assert.equal(loadCpuDifficulty(stored),'normal',String(value));
  }
  // Blocked storage never breaks the menu and gives Normal.
  const blocked={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  assert.equal(loadCpuDifficulty(blocked),'normal');
  assert.doesNotThrow(()=>saveCpuDifficulty(blocked,'hard'));
  assert.equal(loadCpuDifficulty(), 'normal');
  assert.equal(loadCpuDifficulty(memory()),'normal');
  // A failed write stores nothing, so the next load gives Normal.
  const quota=memory();
  const failing={getItem:quota.getItem,setItem(){throw new Error('quota');}};
  assert.equal(saveCpuDifficulty(failing,'hard'),'hard');
  assert.equal(loadCpuDifficulty(quota),'normal');
});

test('online play ignores the menu level and always runs Normal',()=>{
  assert.equal(matchCpuDifficulty(true,'hard'),'normal');
  assert.equal(matchCpuDifficulty(true,'easy'),'normal');
  assert.equal(matchCpuDifficulty(true,'junk'),'normal');
  assert.equal(matchCpuDifficulty(false,'hard'),'hard');
  assert.equal(matchCpuDifficulty(false,'junk'),'normal');
});

test('seeded CPU matches run Fácil and Difícil differently from Normal',()=>{
  // Every level repeats with the same seed, and only gameplay (never config) is compared.
  const results=new Map<CpuDifficulty,ReturnType<typeof match>>();
  for(const level of levels){
    const first=match(level,3600),again=match(level,3600);
    results.set(level,first);
    assert.equal(again.gameplay,first.gameplay,`${level} must repeat with the same seed`);
    assert.deepEqual(again.score,first.score);
  }
  const normal=results.get('normal')!.gameplay,easy=results.get('easy')!.gameplay,hard=results.get('hard')!.gameplay;
  assert.notEqual(easy,normal);
  assert.notEqual(hard,normal);
  assert.notEqual(easy,hard);
});

test('human-vs-human matches play the same at every level; only the config differs',()=>{
  const config=(level?:CpuDifficulty)=>createConfig({difficulty:level,seed:2017,human:[true,true],halfSeconds:60});
  const normal=run(config('normal'),3600),normalGameplay=gameplayHash(normal);
  for(const level of ['easy','hard'] as const){
    const sim=run(config(level),3600);
    assert.equal(gameplayHash(sim),normalGameplay,`${level} must give the same gameplay as Normal with two human teams`);
    assert.deepEqual(sim.snapshot().score,normal.snapshot().score);
    assert.notEqual(sim.stateHash(),normal.stateHash(),`${level} differs from Normal only by config.difficulty`);
  }
});
