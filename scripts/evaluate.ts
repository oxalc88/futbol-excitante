import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { Simulation } from '../src/simulation/engine';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';

const runs=[];
for(const seed of [2017,37,88]){
  const c=createConfig({seed,human:[false,false],halfSeconds:180}),sim=new Simulation(c,[makeTeam(0),makeTeam(1)]);
  const started=performance.now(),events:Record<string,number>={};let ticks=0;
  while(sim.phase!=='fulltime'&&ticks<150000){for(const e of sim.step().events)events[e.type]=(events[e.type]??0)+1;if(ticks%60===0)sim.assertInvariants();ticks++;}
  const w=sim.snapshot(),duration=performance.now()-started;
  runs.push({seed,ticks,phase:w.phase,score:w.score,stats:w.stats,events,stateHash:sim.stateHash(),wallMilliseconds:Math.round(duration),ticksPerSecond:Math.round(ticks/(duration/1000)),provisional:true});
}
// Catalog coverage is fail-closed: internal tests do not impersonate unresolved PES criteria.
const catalog=readFileSync('specs/GAMEPLAY_EVALUATION_SPEC.md','utf8');
const ids=[...new Set([...catalog.matchAll(/^\s+(?:-\s+)?test_id:\s*["']?([A-Z][A-Z0-9-]+)/gm)].map(m=>m[1]))];
if(ids.length===0)throw new Error('No evaluation catalog IDs were resolved.');
const report={version:'rebuild-evaluation-v1',runtime:process.version,configVersion:'vision-rebuild-config-v1',runs,
  gameplayCatalog:ids.map(test_id=>({test_id,outcome:'NOT_EVALUATED',reason:'Original catalog registry/binding and independent oracle are not materialized in this rebuild.'})),
  reference:{outcome:'BLOCKED_MISSING_REFERENCE',reason:'Preserved research contains no measured PES target corpus.'},
  visual:{outcome:'NEEDS_PERCEPTUAL_REVIEW',reason:'No completed device playtest or blinded perceptual rubric.'},
  milestone:{outcome:'NOT_EVALUATED',reason:'Headless prototype diagnostics do not grant an original-spec milestone PASS.'}};
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/evaluation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({runs,catalogTests:ids.length,reference:report.reference.outcome,visual:report.visual.outcome},null,2));
if(runs.some(r=>r.phase!=='fulltime'))process.exitCode=1;
