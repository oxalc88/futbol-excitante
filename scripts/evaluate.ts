import { writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
import catalog from '../eval/catalog.json';
import { createScenario, runScenario, traceDigest } from '../eval/scenarios';
import { continuity, designOracle, hardOracle, mutationProof } from '../eval/oracles';
import { implementationBindings, impactClosure, observationDefinitions, reduceOutcomes, REGISTRY_VERSION, type Outcome } from '../eval/registry';
import { validateReference, compareReference, type ReferenceTarget, METRIC_UNITS } from '../eval/reference';
import { Simulation } from '../src/simulation/engine';
import { createConfig } from '../src/simulation/config';
import { makeTeam } from '../src/adapters/data';

const freeze=process.argv.includes('--freeze-baseline'),saveTraces=process.argv.includes('--traces');
const requested=process.argv.find(a=>a.startsWith('--test='))?.slice(7);
if(freeze&&requested)throw new Error('A baseline must cover the full catalog');
const ids=requested?impactClosure([requested]):catalog.tests.map(t=>t.test_id),seeds=[2017,37];
const oracleHash=createHash('sha256').update(readFileSync('eval/oracles.ts')).digest('hex');
type Baseline={version:string;oracleHash:string;configVersion:string;provisionalEngineBaseline:boolean;hashes:Record<string,string>};
const baseline:Baseline|null=existsSync('eval/baseline.json')?JSON.parse(readFileSync('eval/baseline.json','utf8')):null;
if(freeze&&baseline)throw new Error('Baseline already exists; never silently replace it. Review an explicit baseline change.');
if(baseline&&baseline.oracleHash!==oracleHash)throw new Error('Protected oracle changed; baseline review required');
const newBaseline:Baseline={version:'frozen-baseline-v1',oracleHash,configVersion:'vision-rebuild-config-v2',provisionalEngineBaseline:true,hashes:{}};
const references:ReferenceTarget[]=existsSync('eval/references')?readdirSync('eval/references').filter(n=>n.endsWith('.json')).map(n=>validateReference(JSON.parse(readFileSync(`eval/references/${n}`,'utf8')))):[];
const results=[],began=performance.now();let localFailures=0;
mkdirSync('artifacts',{recursive:true});if(saveTraces)mkdirSync('artifacts/traces',{recursive:true});
for(const id of ids){
  const spec=catalog.tests.find(t=>t.test_id===id)!,runs=[],checks=new Map<string,{outcome:Outcome;reason:string}[]>();
  for(const seed of seeds){
    const a=runScenario(createScenario(id,seed,0)),b=runScenario(createScenario(id,seed,1));
    for(const r of [a,b]){
      const key=`${id}/${seed}/${r.scenario.variant}`;newBaseline.hashes[key]=r.finalHash;
      const safety=continuity(r.trace);if(!safety.passed&&safety.observed)localFailures++;
      runs.push({seed,variant:r.scenario.variant,initialHash:createHash('sha256').update(JSON.stringify(r.scenario.initial)).digest('hex'),finalHash:r.finalHash,traceHash:traceDigest(r),ticks:r.scenario.duration,metrics:r.metrics,events:r.events,continuity:safety});
      if(saveTraces)writeFileSync(`artifacts/traces/${id}-${seed}-${r.scenario.variant}.json.gz`,gzipSync(JSON.stringify({version:'canonical-trace-v2',initial:r.scenario.initial,inputs:r.inputs,trace:r.trace,camera:r.camera})));
    }
    for(const c of spec.acceptance_logic){
      let outcome:Outcome='NOT_EVALUATED',reason='';
      if(c.class==='HARD_INVARIANT'||c.class==='ENGINE_DESIGN_TARGET'){
        const v=c.class==='HARD_INVARIANT'?hardOracle(c.criterion_id,a,b):designOracle(c.criterion_id,a,b);
        outcome=v.observed?(v.passed?'PASS':'FAIL'):'NOT_EVALUATED';reason=v.reason;if(outcome==='FAIL')localFailures++;
      }else if(c.class==='REGRESSION'){
        const matches=[0,1].every(v=>baseline?.hashes[`${id}/${seed}/${v}`]===newBaseline.hashes[`${id}/${seed}/${v}`]);
        outcome=baseline?(matches?'PASS':'FAIL'):'NOT_EVALUATED';reason=baseline?'Compared with frozen provisional engine baseline':'Initial baseline not frozen yet';if(outcome==='FAIL')localFailures++;
      }else if(c.class==='MEASURED_TARGET'){
        const ref=references.find(r=>r.testId===id&&r.strata.scenario_id===`${id}:0`);
        if(!ref){outcome='BLOCKED_MISSING_REFERENCE';reason='No eligible measured PES capture matching this scenario';}
        else{const compared=compareReference(ref,a.metrics);outcome=compared.every(m=>m.withinInterval)?'PASS':'FAIL';reason=`Reference ${ref.id}: ${JSON.stringify(compared)}`;}
      }else if(c.class==='PERCEPTUAL_TARGET'){outcome='NEEDS_PERCEPTUAL_REVIEW';reason='Requires actual rendered frames and human rubric; cloud preview was blocked by URL policy';}
      else{outcome='NOT_EVALUATED';reason='Controlled PES causal evidence absent; paired engine sensitivity is diagnostic only';}
      if(!checks.has(c.criterion_id))checks.set(c.criterion_id,[]);checks.get(c.criterion_id)!.push({outcome,reason});
    }
  }
  const criteria=spec.acceptance_logic.map(c=>({...c,outcome:reduceOutcomes(checks.get(c.criterion_id)!.map(c=>c.outcome)),evidence:checks.get(c.criterion_id)}));
  results.push({test_id:id,execution:'HEADLESS',outcome:reduceOutcomes(criteria.map(c=>c.outcome)),criteria,runs});
  console.log(`${id}: ${results.at(-1)!.outcome}`);
}
const mutants=mutationProof(runScenario(createScenario('BALL-GND-001')).trace);
if(!mutants.observed||!mutants.teleportDetected||!mutants.impulseDetected)localFailures++;
const matches=[];
if(!requested)for(const seed of [2017,37,88]){
  const c=createConfig({seed,human:[false,false],halfSeconds:180}),sim=new Simulation(c,[makeTeam(0),makeTeam(1)]),start=performance.now();let ticks=0;const events:Record<string,number>={};
  while(sim.phase!=='fulltime'&&ticks<150000){for(const e of sim.step().events)events[e.type]=(events[e.type]??0)+1;if(ticks%60===0)sim.assertInvariants();ticks++;}
  const w=sim.snapshot();matches.push({seed,ticks,phase:w.phase,score:w.score,stats:w.stats,events,finalHash:sim.stateHash(),wallMilliseconds:Math.round(performance.now()-start)});if(w.phase!=='fulltime')localFailures++;
}
const criterionCounts:Record<string,number>={};for(const r of results)for(const c of r.criteria)criterionCounts[c.outcome]=(criterionCounts[c.outcome]??0)+1;
const report={version:'local-evaluation-report-v2',runtime:process.version,registryVersion:REGISTRY_VERSION,configVersion:'vision-rebuild-config-v2',oracleHash,seeds,scenarioCount:results.reduce((n,r)=>n+r.runs.length,0),criterionCounts,localFailures,traceMutants:mutants,gameplayCatalog:results,matches,observations:observationDefinitions,metrics:Object.entries(METRIC_UNITS).map(([metric_id,units])=>({metric_id,metric_version:'1',units,estimator_id:'local-scenario-metrics-v1',input_observation_ids:['canonical-world','canonical-events'],invalid_data_behavior:'INVALID_RUN'})),bindings:implementationBindings().filter(b=>ids.includes(b.test_id)),reference:{outcome:references.length?'PARTIAL_REFERENCE':'BLOCKED_MISSING_REFERENCE',eligibleCaptures:references.length},visual:{outcome:'NEEDS_PERCEPTUAL_REVIEW',reason:'Cloud browser URL policy blocked the preview. Physical devices and blinded playtest not available.'},milestone:{outcome:'NOT_EVALUATED',reason:'No original-spec milestone promotion without required browser/reference/perceptual evidence.'},wallMilliseconds:Math.round(performance.now()-began)};
writeFileSync(requested?'artifacts/targeted-evaluation.json':'artifacts/evaluation.json',JSON.stringify(report,null,2)+'\n');
if(freeze){if(localFailures)throw new Error(`Cannot freeze baseline: ${localFailures} local failures`);writeFileSync('eval/baseline.json',JSON.stringify(newBaseline,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({scenarioCount:report.scenarioCount,criterionCounts,localFailures,traceMutants:mutants,matches:matches.map(m=>({seed:m.seed,phase:m.phase,score:m.score,shots:m.stats.map(s=>s.shots)})),wallMilliseconds:report.wallMilliseconds},null,2));
if(localFailures)process.exitCode=1;
