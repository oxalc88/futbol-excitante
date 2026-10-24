// Run with: node --import tsx scripts/make-reference-replay.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { Simulation } from '../src/simulation/engine';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';
import { Recorder } from '../src/adapters/replay';

const sim=new Simulation(createConfig({teamSize:2,halfSeconds:5,human:[false,false],seed:41}),[makeTeam(0,2),makeTeam(1,2)]);
const recorder=new Recorder(sim);
for(let i=0;i<600;i++)sim.step();
const replay=recorder.finish(sim);
mkdirSync(new URL('../tests/fixtures/',import.meta.url),{recursive:true});
// Keep older engine fixtures when bumping the version: they remain hash evidence.
writeFileSync(new URL(`../tests/fixtures/reference-${replay.engine}.json`,import.meta.url),JSON.stringify(replay,null,2)+'\n',{flag:'wx'});
console.log(`${replay.engine}: ${replay.finalHash}`);
