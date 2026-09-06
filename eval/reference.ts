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
