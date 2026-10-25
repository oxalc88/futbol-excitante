import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OBSERVED_METRICS, validateObservedReference, validateReference, summarizeObservedEvents } from '../eval/reference';
import { referenceImportPlan } from '../scripts/reference-import-plan';
import { checkKnownGaps, compareTiming, measureGameTiming, printTiming, type KnownTimingGaps } from '../scripts/measure-game-timing';

const raw=JSON.parse(readFileSync(new URL('../eval/reference/pes-observed.json',import.meta.url),'utf8'));

test('reference importer dispatches public-video observations to diagnostic storage',()=>{
  const plan=referenceImportPlan(raw);
  assert.equal(plan.directory,'eval/reference');
  assert.equal(plan.filename,'pes-observed.json');
  assert.deepEqual(plan.target,raw);
  assert.match(plan.message,/approximate.*diagnostic only, not used by evaluate/);
  assert.throws(()=>referenceImportPlan({...raw,approximate:false}));
  assert.throws(()=>referenceImportPlan({...raw,version:'unknown'}));
});
const known:KnownTimingGaps=JSON.parse(readFileSync(new URL('../eval/reference/pes-known-gaps.json',import.meta.url),'utf8'));

test('PES timing: deterministic game observations, delta table and exact known-gap register',()=>{
  const reference=validateObservedReference(raw),game=measureGameTiming();
  assert.deepEqual(measureGameTiming(),game);
  for(const sample of Object.values(game)){
    assert.ok(Number.isFinite(sample.value_s)&&sample.value_s>0);
    assert.ok(sample.end_tick>sample.start_tick);
    assert.ok(Math.abs(sample.value_s-(sample.end_tick-sample.start_tick)/60)<1e-12);
  }
  for(const invalid of [NaN,Infinity,-1,0]){const bad=structuredClone(game);bad.turn90_s.value_s=invalid;assert.throws(()=>compareTiming(reference,bad),/Invalid game timing/);}
  const rows=compareTiming(reference,game);checkKnownGaps(rows,known);printTiming(rows);
  assert.deepEqual(Object.fromEntries(rows.map(r=>[r.metric,r.status])),{
    turn90_s:'WITHIN',turn180_s:'WITHIN',pass_to_first_touch_s:'BELOW',
    control_to_next_pass_s:'BELOW',time_to_top_speed_s:'WITHIN',
  });
  // Lock the C7 slice 2 tuning in ticks at 60 Hz: 180-degree turn 20 ticks, top speed 37 ticks.
  assert.equal(game.turn180_s.end_tick-game.turn180_s.start_tick,20);
  assert.equal(game.time_to_top_speed_s.end_tick-game.time_to_top_speed_s.start_tick,37);
  console.log('KNOWN GAPS: both pass metrics BELOW; turn180_s and time_to_top_speed_s WITHIN after C7 slice 2 tuning. Approximate; second pass done.');
  const introduced=structuredClone(rows);introduced.find(r=>r.metric==='turn90_s')!.status='ABOVE';
  assert.throws(()=>checkKnownGaps(introduced,known),/gaps changed/);
  const fixed=structuredClone(rows);fixed.find(r=>r.metric==='control_to_next_pass_s')!.status='WITHIN';
  assert.throws(()=>checkKnownGaps(fixed,known),/gaps changed/);
  assert.throws(()=>checkKnownGaps(rows,{...known,missing_reference:['control_to_next_pass_s']}),/Invalid known-gap register/);
});

test('timing classification uses range_s with inclusive bounds rather than the median',()=>{
  const reference=validateObservedReference(raw),game=measureGameTiming();
  for(const metric of OBSERVED_METRICS)reference.summary[metric]={...reference.summary[metric],median:10,range_s:[1,2]};
  for(const [value,status] of [[.5,'BELOW'],[1,'WITHIN'],[1.5,'WITHIN'],[2,'WITHIN'],[2.5,'ABOVE']] as const){
    for(const metric of OBSERVED_METRICS)game[metric].value_s=value;
    const rows=compareTiming(reference,game);
    assert.deepEqual(rows.map(r=>r.status),OBSERVED_METRICS.map(()=>status),`value ${value}`);
    assert.deepEqual(rows.map(r=>r.game_s),OBSERVED_METRICS.map(()=>value));
  }
});

test('known-gap register rejects malformed entries even when rows match them',()=>{
  const rows=compareTiming(validateObservedReference(raw),measureGameTiming());
  for(const entry of [null,{...known.gaps[0],metric:'unknown'},{...known.gaps[0],direction:'WITHIN'},
    ...['','   ',42,null,{}].map(reason=>({...known.gaps[0],reason}))]){
    const bad=structuredClone(known);bad.gaps[0]=entry as KnownTimingGaps['gaps'][number];
    assert.throws(()=>checkKnownGaps(rows,bad),/Invalid known-gap register/);
  }
  const duplicate=structuredClone(known);duplicate.gaps.push(duplicate.gaps[0]);
  const duplicateRows=structuredClone(rows);duplicateRows.push(duplicateRows.find(r=>r.metric===duplicate.gaps[0].metric)!);
  assert.throws(()=>checkKnownGaps(duplicateRows,duplicate),/Invalid known-gap register/);
  const unknown=structuredClone(known);unknown.gaps[0].metric='unknown' as KnownTimingGaps['gaps'][number]['metric'];
  const unknownRows=structuredClone(rows);unknownRows.find(r=>r.metric===known.gaps[0].metric)!.metric=unknown.gaps[0].metric;
  assert.throws(()=>checkKnownGaps(unknownRows,unknown),/Invalid known-gap register/);
  for(const missing of [['unknown'],['turn90_s','turn90_s']]){
    assert.throws(()=>checkKnownGaps(rows,{...known,missing_reference:missing as KnownTimingGaps['missing_reference']}),/Invalid known-gap register/);
  }
});

test('approximate observations validate PTS, margins, identity and derived summaries without weakening DIRECT_CAPTURE',()=>{
  assert.throws(()=>validateReference(raw));
  for(const mutate of [
    (r:typeof raw)=>{r.approximate=false;},
    (r:typeof raw)=>{delete r.events[0].annotator;},
    (r:typeof raw)=>{r.events[0].second_pass.agree=false;},
    (r:typeof raw)=>{r.events[0].second_pass.value_s=NaN;},
    (r:typeof raw)=>{r.events[0].second_pass.margin_s=0;},
    (r:typeof raw)=>{r.events[0].annotator='B';},
    (r:typeof raw)=>{r.events.find((e:typeof raw.events[number])=>e.id==='c03').confidence='high';},
    (r:typeof raw)=>{r.agreement.status='pending-second-pass';},
    (r:typeof raw)=>{r.agreement.windows=11;},
    (r:typeof raw)=>{r.agreement.agree=12;},
    (r:typeof raw)=>{r.agreement.rate=1;},
    (r:typeof raw)=>{r.agreement.rule='other';},
    (r:typeof raw)=>{r.agreement.disagreements[0].id='p01';},
    (r:typeof raw)=>{r.agreement.disagreements[1]=r.agreement.disagreements[0];},
    (r:typeof raw)=>{r.agreement.disagreements.pop();},
    (r:typeof raw)=>{r.agreement.disagreements=[];},
    (r:typeof raw)=>{r.agreement.disagreements[0].note='';},
    (r:typeof raw)=>{r.events[0].value_s+=.1;},
    (r:typeof raw)=>{r.events[0].start_pts++;},
    (r:typeof raw)=>{r.events[0].start_frame=0;r.events[0].end_frame=1;},
    (r:typeof raw)=>{r.sources[0].frame_pts_step=1;},
    (r:typeof raw)=>{r.events[0].margin_s=0;},
    (r:typeof raw)=>{r.events[0].video_id='LFvEnk0mcLI';},
    (r:typeof raw)=>{r.events[0].fps=30;},
    (r:typeof raw)=>{r.events[1].id=r.events[0].id;},
    (r:typeof raw)=>{r.summary.turn90_s.median=9;},
    (r:typeof raw)=>{r.summary.time_to_top_speed_s.range_s=[0,10];},
  ]){const bad=structuredClone(raw);mutate(bad);assert.throws(()=>validateObservedReference(bad));}
  const validated=validateObservedReference(raw);
  assert.deepEqual(summarizeObservedEvents(validated.events),validated.summary);
  assert.equal(validated.summary.time_to_top_speed_s.n,3);
  assert.equal(validated.events.length,32);
  assert.equal(validated.agreement.rate,10/12);
  assert.deepEqual(validated.agreement.disagreements.map(d=>d.id),['c03','c05']);
  assert.equal(validated.events.filter(e=>e.annotator==='B').length,20);
  validated.events[0].note='detached';assert.notEqual(raw.events[0].note,'detached');
});

test('second-pass endpoints reject mutations to duration, margin, PTS, frames and agreement',()=>{
  const mutations:((b:typeof raw.events[number]['second_pass'])=>void)[]=[
    b=>{delete b.start_s;},
    b=>{b.end_s+=.1;},
    b=>{b.value_s+=.1;},
    b=>{b.margin_s+=.1;},
    b=>{b.ambiguity_s=-1;},
    b=>{b.start_pts++;},
    b=>{b.end_pts++;},
    b=>{b.start_frame++;},
    b=>{b.end_frame++;},
    b=>{b.agree=!b.agree;},
    b=>{b.start_s=0;b.end_s=b.value_s;},
  ];
  for(const mutate of mutations){
    const bad=structuredClone(raw);mutate(bad.events[0].second_pass);
    assert.throws(()=>validateObservedReference(bad),/Invalid approximate public-video reference/);
  }
  const first=validateObservedReference(raw).events[0].second_pass!;
  assert.equal(first.start_frame,4347);
  assert.equal(first.end_frame,4406);
  assert.equal(first.start_pts,4347*256);
  assert.equal(first.end_pts,4406*256);
});
