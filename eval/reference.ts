import { TEST_IDS } from './scenarios';

export interface ReferenceTarget {
  version:'reference-target-v1';id:string;testId:string;measurementClass:'A'|'B'|'C';
  source:{game:'PES 2017';platform:string;build:string;mode:string;difficulty:string;gameSpeed:string;controller:string;camera:string};
  capture:{uri:string;sha256:string;provenance:'DIRECT_CAPTURE';timebase:'PTS';pts:number[];controlledInputs:boolean;inputLogSha256?:string;operator:string};
  strata:Record<string,string>;
  measurements:{metric:string;units:string;estimate:number;uncertainty:number;sampleSize:number;observable:boolean;method:string;startPTS:number;endPTS:number}[];
}
export const METRIC_UNITS:Record<string,string>={durationSeconds:'s',earlyDistance:'m',distance:'m',plateau:'m/s',t25:'s',t50:'s',t90:'s',maxSpeed:'m/s',minimumTurnSpeed:'m/s',speedRetention:'ratio',peakAcceleration:'m/s^2',ballRange:'m',apex:'m',lateralDeviation:'m',contacts:'count',freeTicks:'tick',initialStrikeSpeed:'m/s',initialStrikeSpin:'rad/s',firstTouchOutgoing:'m/s',minimumStability:'ratio',maximumRecovery:'tick',lateralDisplacement:'m',bodyContacts:'count',keeperContacts:'count',phaseTransitions:'count',maximumPressers:'count',finalTeamWidth:'m',memoryEntries:'count',cameraHeight:'m'};
const nonempty=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
export function validateReference(value:unknown):ReferenceTarget {
  const r=value as ReferenceTarget;
  if(!r||r.version!=='reference-target-v1'||!/^[a-z0-9-]{1,80}$/.test(r.id)||!TEST_IDS.includes(r.testId)||!['A','B','C'].includes(r.measurementClass))throw new Error('Invalid reference identity');
  if(!r.source||r.source.game!=='PES 2017'||!['platform','build','mode','difficulty','gameSpeed','controller','camera'].every(k=>nonempty(r.source[k as keyof typeof r.source])))throw new Error('Missing reference build or match configuration');
  const c=r.capture;
  if(!c||c.provenance!=='DIRECT_CAPTURE'||c.timebase!=='PTS'||!nonempty(c.uri)||!nonempty(c.operator)||!/^[a-f0-9]{64}$/i.test(c.sha256)||!Array.isArray(c.pts)||c.pts.length<2||c.pts.some((p,i)=>!Number.isFinite(p)||p<0||(i>0&&p<=c.pts[i-1])))throw new Error('Invalid capture provenance or presentation timestamps');
  if(r.measurementClass==='C'&&(!c.controlledInputs||!/^[a-f0-9]{64}$/i.test(c.inputLogSha256??'')))throw new Error('Class C requires controlled input capture with content hash');
  if(!r.strata||!Object.keys(r.strata).length||Object.values(r.strata).some(v=>!nonempty(v)))throw new Error('Reference strata are required');
  if(!Array.isArray(r.measurements)||!r.measurements.length)throw new Error('No measured targets');
  const seen=new Set<string>();
  for(const m of r.measurements){if(seen.has(m.metric)||METRIC_UNITS[m.metric]!==m.units||!Number.isFinite(m.estimate)||!Number.isFinite(m.uncertainty)||m.uncertainty<0||!Number.isInteger(m.sampleSize)||m.sampleSize<2||m.observable!==true||!nonempty(m.method)||!Number.isFinite(m.startPTS)||!Number.isFinite(m.endPTS)||m.startPTS<c.pts[0]||m.endPTS>c.pts.at(-1)!||m.endPTS<=m.startPTS)throw new Error(`Ineligible measured target: ${m.metric}`);seen.add(m.metric);}
  return structuredClone(r);
}
export function compareReference(reference:ReferenceTarget,metrics:Record<string,number>){
  return reference.measurements.map(m=>{const value=metrics[m.metric];if(!Number.isFinite(value))throw new Error(`Metric ${m.metric} was not observed`);return{metric:m.metric,value,target:m.estimate,uncertainty:m.uncertainty,units:m.units,withinInterval:Math.abs(value-m.estimate)<=m.uncertainty};});
}

// Public-video observations are diagnostics only. Never accepted by validateReference/evaluate.
export const OBSERVED_METRICS=['turn90_s','turn180_s','pass_to_first_touch_s','control_to_next_pass_s','time_to_top_speed_s'] as const;
export type ObservedMetric=typeof OBSERVED_METRICS[number];
export interface ObservedEvent {
  id:string; metric:ObservedMetric; value_s:number; margin_s:number; source_url:string; video_id:string;
  fps:number; start_s:number; end_s:number; start_pts:number; end_pts:number; start_frame:number; end_frame:number;
  annotator:'A'|'B'; second_pass?:(Pick<ObservedEvent,'value_s'|'margin_s'|'start_s'|'end_s'|'start_pts'|'end_pts'|'start_frame'|'end_frame'|'ambiguity_s'>&{agree:boolean});
  ambiguity_s:number; note:string; confidence:'low'|'medium'|'high';
}
export interface ObservedSummary {
  n:number;median:number|null;p25:number|null;p75:number|null;min:number|null;max:number|null;
  median_margin_s:number|null;range_s:[number,number]|null;
}
export interface ObservedReference {
  version:'pes-observed-v1'; approximate:true; provenance:'public video, unknown settings, approximate';
  sources:{video_id:string;source_url:string;role:'work-set'|'training';fps:number;time_base:string;frame_timing:'verified-delivered-cfr';frame_zero_pts:number;frame_pts_step:number;reviewed_s:[number,number]}[];
  method:{clock:string;review:string;definitions:Record<ObservedMetric,string>;margin:string;summary_rule:string;limitations:string[]};
  events:ObservedEvent[];summary:Record<ObservedMetric,ObservedSummary>;agreement:{status:'second-pass-done';windows:number;agree:number;rate:number;rule:'|A-B| <= max(marginA, marginB)';disagreements:{id:string;note:string}[]};
}
const quantile=(a:number[],p:number)=>{const x=(a.length-1)*p,i=Math.floor(x);return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(x-i);};
export function summarizeObservedEvents(events:ObservedEvent[]):Record<ObservedMetric,ObservedSummary> {
  return Object.fromEntries(OBSERVED_METRICS.map(metric=>{
    const es=events.filter(e=>e.metric===metric),v=es.map(e=>e.value_s).sort((a,b)=>a-b);
    if(!v.length)return [metric,{n:0,median:null,p25:null,p75:null,min:null,max:null,median_margin_s:null,range_s:null}];
    const margin=quantile(es.map(e=>e.margin_s).sort((a,b)=>a-b),.5),p25=quantile(v,.25),p75=quantile(v,.75);
    return [metric,{n:v.length,median:quantile(v,.5),p25,p75,min:v[0],max:v.at(-1)!,median_margin_s:margin,range_s:[Math.max(0,p25-margin),p75+margin]}];
  })) as Record<ObservedMetric,ObservedSummary>;
}
export function validateObservedReference(value:unknown):ObservedReference {
  const r=value as ObservedReference;
  const fail=():never=>{throw new Error('Invalid approximate public-video reference');};
  const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
  if(!r||r.version!=='pes-observed-v1'||r.approximate!==true||r.provenance!=='public video, unknown settings, approximate'||r.agreement?.status!=='second-pass-done')fail();
  if(!Array.isArray(r.sources)||!r.sources.length||!Array.isArray(r.events)||!r.events.length)fail();
  const sources=new Map<string,ObservedReference['sources'][number]>();
  for(const s of r.sources){
    if(!s||!nonempty(s.video_id)||sources.has(s.video_id)||s.source_url!==`https://www.youtube.com/watch?v=${s.video_id}`||!['work-set','training'].includes(s.role)||!finite(s.fps)||s.fps<=0||!/^1\/[1-9]\d*$/.test(s.time_base)||!Array.isArray(s.reviewed_s)||s.reviewed_s.length!==2||s.reviewed_s.some(n=>!finite(n)||n<0)||s.reviewed_s[1]<=s.reviewed_s[0])fail();
    if(s.frame_timing!=='verified-delivered-cfr'||s.frame_zero_pts!==0||!Number.isSafeInteger(s.frame_pts_step)||s.frame_pts_step<=0||Math.abs(Number(s.time_base.split('/')[1])/s.frame_pts_step-s.fps)>1e-6)fail();
    sources.set(s.video_id,s);
  }
  if(!r.method||!['clock','review','margin','summary_rule'].every(k=>nonempty(r.method[k as 'clock']))||!OBSERVED_METRICS.every(m=>nonempty(r.method.definitions?.[m]))||!Array.isArray(r.method.limitations)||!r.method.limitations.length||r.method.limitations.some(v=>!nonempty(v)))fail();
  const seen=new Set<string>();
  for(const e of r.events){
    const source=sources.get(e?.video_id);
    if(!e||!nonempty(e.id)||seen.has(e.id)||!OBSERVED_METRICS.includes(e.metric)||!source||source.source_url!==e.source_url||e.fps!==source.fps||!nonempty(e.note)||!['A','B'].includes(e.annotator)||!['low','medium','high'].includes(e.confidence))fail();
    const validateTiming=(e:Pick<ObservedEvent,'value_s'|'margin_s'|'start_s'|'end_s'|'start_pts'|'end_pts'|'start_frame'|'end_frame'|'ambiguity_s'>)=>{
      if(!e)fail();
      if(![e.value_s,e.margin_s,e.start_s,e.end_s,e.ambiguity_s].every(finite)||e.value_s<=0||e.start_s<source!.reviewed_s[0]||e.end_s>source!.reviewed_s[1]||e.end_s<=e.start_s||e.ambiguity_s<0||Math.abs(e.value_s-(e.end_s-e.start_s))>1e-6||Math.abs(e.margin_s-(2/source!.fps+e.ambiguity_s))>1e-6)fail();
      const denominator=Number(source!.time_base.split('/')[1]);
      if(![e.start_pts,e.end_pts,e.start_frame,e.end_frame].every(n=>Number.isSafeInteger(n)&&n>=0)||e.end_frame<=e.start_frame||e.end_pts<=e.start_pts||e.start_pts!==e.start_frame*source!.frame_pts_step||e.end_pts!==e.end_frame*source!.frame_pts_step||Math.abs(e.start_pts/denominator-e.start_s)>1e-6||Math.abs(e.end_pts/denominator-e.end_s)>1e-6)fail();
    };
    validateTiming(e);
    if(e.second_pass!==undefined){
      const b=e.second_pass;
      validateTiming(b);
      if(e.annotator!=='A'||typeof b.agree!=='boolean'||b.agree!==(Math.abs((e.end_s-e.start_s)-(b.end_s-b.start_s))<=Math.max(2/e.fps+e.ambiguity_s,2/e.fps+b.ambiguity_s))||(!b.agree&&e.confidence!=='low'))fail();
    }
    seen.add(e.id);
  }
  const a=r.agreement,windows=r.events.filter(e=>e.second_pass),disagreed=windows.filter(e=>!e.second_pass!.agree);
  if(a.rule!=='|A-B| <= max(marginA, marginB)'||!Number.isSafeInteger(a.windows)||a.windows<=0||a.windows!==windows.length||a.agree!==windows.length-disagreed.length||!finite(a.rate)||Math.abs(a.rate-a.agree/a.windows)>1e-12||!Array.isArray(a.disagreements)||a.disagreements.length!==disagreed.length)fail();
  const ids=new Set<string>();
  for(const d of a.disagreements){if(!d||ids.has(d.id)||!disagreed.some(e=>e.id===d.id)||!nonempty(d.note))fail();ids.add(d.id);}
  if(ids.size!==disagreed.length||disagreed.some(e=>!ids.has(e.id)))fail();
  const expected=summarizeObservedEvents(r.events);
  if(!r.summary||Object.keys(r.summary).length!==OBSERVED_METRICS.length)fail();
  for(const metric of OBSERVED_METRICS){
    const actual=r.summary[metric],want=expected[metric];if(!actual)fail();
    for(const key of ['n','median','p25','p75','min','max','median_margin_s'] as const){const a=actual[key],b=want[key];if(b===null?a!==null:!finite(a)||Math.abs(a-b)>1e-6)fail();}
    if(want.range_s===null){if(actual.range_s!==null)fail();}
    else if(!Array.isArray(actual.range_s)||actual.range_s.length!==2||actual.range_s.some((n,i)=>!finite(n)||Math.abs(n-want.range_s![i])>1e-6))fail();
  }
  return structuredClone(r);
}
