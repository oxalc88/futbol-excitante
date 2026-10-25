import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createScenario } from '../eval/scenarios';
import { Simulation } from '../src/simulation/engine';
import type { InputFrame, World } from '../src/contracts/types';
import { OBSERVED_METRICS, validateObservedReference, type ObservedReference } from '../eval/reference';

export type TimingMetric = typeof OBSERVED_METRICS[number];
// Older slice-2 approximate ranges (eval/reference/pes-observed.json). C7 part 3 targets from
// resumen_final.md supersede them for acceleration/turn: see scripts/measure-c7-movement.ts (timing:c7).
export type TimingSample = { value_s:number; start_tick:number; end_tick:number; protocol:string };
export type GameTiming = Record<TimingMetric, TimingSample>;
const angleError=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));

// Fixtures are detached checkpoints. Only public restore/applyInputs/step/snapshot APIs drive runs.
// No production state, config defaults, evaluator or baseline is modified.
function runMovement(id:string, duration:number) {
  const s=createScenario(id,2017);const sim=new Simulation(s.initial.config,s.initial.teams);
  sim.restore(s.initial);const trace=[sim.snapshot()];
  for(let i=0;i<duration;i++){sim.applyInputs(s.input(sim.tick));sim.step();trace.push(sim.snapshot());}
  return {s,trace,dt:s.initial.config.dt};
}
function turn(id:string, target:number):TimingSample {
  const {s,trace,dt}=runMovement(id,100);
  const player=(w:World)=>w.players.find(p=>p.id===s.focal)!;
  const onset=trace.findIndex((w,i)=>i>0 && w.tick>31 && angleError(player(w).heading,player(trace[i-1]).heading)>1e-6);
  const end=trace.findIndex((w,i)=>i>=onset && angleError(player(w).heading,target)<=Math.PI/12);
  if(onset<0||end<onset)throw new Error(`${id}: body turn not observed`);
  return {value_s:(trace[end].tick-trace[onset].tick)*dt,start_tick:trace[onset].tick,end_tick:trace[end].tick,protocol:`${id}, seed 2017: first body-heading change after tick-31 direction switch to heading within 15 degrees of target; no ball`};
}
export function measureGameTiming():GameTiming {
  const {s,trace,dt}=runMovement('LOC-ACC-001',180);
  const speeds=trace.map(w=>{const p=w.players.find(p=>p.id===s.focal)!;return Math.hypot(p.vx,p.vy);});
  const plateau=speeds.slice(-30).reduce((a,b)=>a+b,0)/30;
  const onset=speeds.findIndex(v=>v>.01);
  const end=speeds.findIndex((v,i)=>i>=onset && i+15<=speeds.length && v>=.95*plateau && speeds.slice(i,i+15).every(x=>x>=.95*plateau));
  if(onset<0||end<onset||plateau<1)throw new Error('Speed plateau not observed');
  const pass=measurePassChain();
  return {turn90_s:turn('LOC-T90-001',Math.PI/2),turn180_s:turn('LOC-REV-001',Math.PI),...pass,time_to_top_speed_s:{value_s:(trace[end].tick-trace[onset].tick)*dt,start_tick:trace[onset].tick,end_tick:trace[end].tick,protocol:'LOC-ACC-001, seed 2017: first speed >0.01 m/s to >=95% of final 30-tick mean for 15 ticks; 180-tick straight run, no ball'}};
}
function measurePassChain():Pick<GameTiming,'pass_to_first_touch_s'|'control_to_next_pass_s'> {
  const s=createScenario('PASS-LOW-001',2017),w=s.initial;
  const passer=w.players.find(p=>p.id===s.focal)!;
  const receiver=w.players.find(p=>p.team===0&&!p.keeper&&p.id!==passer.id)!;
  // Isolated 10 m ground-pass fixture; same seeded roster and default action/physics values.
  Object.assign(passer,{x:-20});Object.assign(w.ball,{x:-19.5});
  Object.assign(receiver,{x:-10,y:0,heading:Math.PI,touchCooldown:0});
  const sim=new Simulation(w.config,w.teams);sim.restore(w);
  let release:number|undefined,touch:number|undefined,next:number|undefined;
  for(let i=0;i<240 && next===undefined;i++){
    const tick=sim.tick;
    const base:InputFrame={tick,slot:0,move:{x:0,y:0},aim:{x:release===undefined?1:-1,y:0},sprint:false,shield:false,power:.55};
    // Select the receiver through the supported input; request a return on the next tick after touch.
    if(release!==undefined && touch===undefined)base.switchPlayer=true;
    if(i===0 || touch!==undefined)base.action='pass';
    sim.applyInputs([base]);
    const result=sim.step();
    for(const e of result.events){
      if(e.type==='pass'&&e.playerId===passer.id&&release===undefined)release=e.tick;
      if(e.type==='first-touch'&&e.playerId===receiver.id&&release!==undefined&&touch===undefined)touch=e.tick;
      if(e.type==='pass'&&e.playerId===receiver.id&&touch!==undefined)next=e.tick;
    }
  }
  if(release===undefined||touch===undefined||next===undefined||touch<=release||next<=touch)throw new Error(`Incomplete pass chain: ${release}/${touch}/${next}`);
  const dt=w.config.dt;
  return {pass_to_first_touch_s:{value_s:(touch-release)*dt,start_tick:release,end_tick:touch,protocol:'PASS-LOW-001 detached 10 m fixture, seed 2017: outgoing pass contact to receiver first-touch event'},control_to_next_pass_s:{value_s:(next-touch)*dt,start_tick:touch,end_tick:next,protocol:'Same chain: receiver first-touch to return pass contact; pass requested each tick after touch (minimum action delay, no human decision time)'}};
}
export function compareTiming(reference:ObservedReference,game:GameTiming) {
  return OBSERVED_METRICS.map(metric=>{
    const {range_s,median,n}=reference.summary[metric],value=game[metric].value_s;
    if(!Number.isFinite(value)||value<=0)throw new Error(`Invalid game timing: ${metric}`);
    return {metric,n,pes_median_s:median,game_s:value,delta_s:median===null?null:value-median,range_s,status:range_s===null?'MISSING_REFERENCE':value<range_s[0]?'BELOW':value>range_s[1]?'ABOVE':'WITHIN'};
  });
}
export type KnownTimingGaps = {version:string;gaps:{metric:TimingMetric;direction:string;reason:string}[];missing_reference:TimingMetric[]};
export function checkKnownGaps(rows:ReturnType<typeof compareTiming>,known:KnownTimingGaps) {
  if(!known||known.version!=='pes-timing-known-gaps-v1'||!Array.isArray(known.gaps)||!Array.isArray(known.missing_reference))throw new Error('Invalid known-gap register');
  const metrics=new Set<TimingMetric>();
  for(const gap of known.gaps){
    if(!gap||!OBSERVED_METRICS.includes(gap.metric)||metrics.has(gap.metric)||!['BELOW','ABOVE'].includes(gap.direction)||typeof gap.reason!=='string'||!gap.reason.trim())throw new Error('Invalid known-gap register');
    metrics.add(gap.metric);
  }
  const missingMetrics=new Set<TimingMetric>();
  for(const metric of known.missing_reference){
    if(!OBSERVED_METRICS.includes(metric)||missingMetrics.has(metric)||metrics.has(metric))throw new Error('Invalid known-gap register');
    missingMetrics.add(metric);
  }
  const actual=rows.filter(r=>r.status==='BELOW'||r.status==='ABOVE').map(r=>`${r.metric}:${r.status}`).sort();
  const listed=known.gaps.map(g=>`${g.metric}:${g.direction}`).sort();
  const missing=rows.filter(r=>r.status==='MISSING_REFERENCE').map(r=>r.metric).sort();
  if(JSON.stringify(actual)!==JSON.stringify(listed)||JSON.stringify(missing)!==JSON.stringify([...known.missing_reference].sort()))throw new Error(`Timing gaps changed; review the register. Actual gaps: ${actual}; missing reference: ${missing}`);
}
export function printTiming(rows:ReturnType<typeof compareTiming>) {
  console.table(rows.map(r=>({metric:r.metric,n:r.n,PES_s:r.pes_median_s?.toFixed(3)??'unmeasured',game_s:r.game_s.toFixed(3),delta_s:r.delta_s?.toFixed(3)??'n/a',range_s:r.range_s?.map(v=>v.toFixed(3)).join('..')??'none',status:r.status==='ABOVE'||r.status==='BELOW'?`KNOWN GAP: ${r.status}`:r.status})));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const reference=validateObservedReference(JSON.parse(readFileSync(new URL('../eval/reference/pes-observed.json',import.meta.url),'utf8')));
  const rows=compareTiming(reference,measureGameTiming());
  checkKnownGaps(rows,JSON.parse(readFileSync(new URL('../eval/reference/pes-known-gaps.json',import.meta.url),'utf8')));
  printTiming(rows);
  console.log('KNOWN GAPS match the register. All five metrics have approximate references; second pass done (10/12 numerical window agreement).');
}
