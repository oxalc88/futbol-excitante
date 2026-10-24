import type { ScenarioRun } from './scenarios';
import type { World } from '../src/contracts/types';
import { distance, hash } from '../src/simulation/math';
import { decideTeams } from '../src/simulation/tactics';

// Protected evaluator contract. Threshold changes require a separate review of
// eval/oracles.ts; production code does not import these constants or verdicts.
export type Verdict={passed:boolean;observed:boolean;reason:string};
const result=(passed:boolean,reason:string,observed=true):Verdict=>({passed,observed,reason});
const permitted=new Set(['ball-contact','keeper-ball-contact','bounce','post-contact','crossbar-contact','restart-awarded','goal','halftime','SETUP_DISCONTINUITY']);
export function continuity(trace:World[]):Verdict {
  let checked=0;
  for(let i=1;i<trace.length;i++){
    const before=trace[i-1],after=trace[i],dt=before.config.dt;
    if(before.phase!=='playing'||after.phase!=='playing'||after.events.some(e=>permitted.has(e.type)))continue;
    const a=before.ball,b=after.ball;
    const residual=Math.hypot(b.x-a.x-a.vx*dt,b.y-a.y-a.vy*dt,b.z-a.z-a.vz*dt);
    const impulse=Math.hypot(b.vx-a.vx,b.vy-a.vy,b.vz-a.vz);
    if(residual>.12||impulse>.8)return result(false,`Unattributed ball change at tick ${after.tick}: residual=${residual}, impulse=${impulse}`);
    checked++;
  }
  return result(checked>0,`${checked} free integration intervals checked`,checked>0);
}
export function reachContacts(trace:World[],surface?:string):Verdict {
  let count=0;
  for(const w of trace)for(const e of w.events){
    if(!['ball-contact','keeper-ball-contact'].includes(e.type)||surface&&e.data?.surface!==surface)continue;
    const p=w.players.find(p=>p.id===e.playerId),point=e.data?.point as {x:number;y:number;z:number}|undefined;
    if(!p||!point)return result(false,'Contact has no canonical actor or position');
    const kind=e.data?.surface,max=kind==='head'?.85:p.action?.kind==='slide'?2.15:p.action?.kind==='tackle'?1.7:kind==='hand'?1.4:1.4;
    if(distance(p,point)>max||point.z>(kind==='head'?2.5:kind==='hand'?3:1.85))return result(false,`Unreachable ${kind} contact at ${w.tick}`);
    count++;
  }
  return result(count>0,`${count} geometric ${surface??'player'} contacts checked`,count>0);
}
export function bodyContinuity(trace:World[]):Verdict {
  let count=0;
  for(let i=1;i<trace.length;i++){
    const w=trace[i],prev=trace[i-1];if(w.phase!=='playing'||prev.phase!=='playing')continue;
    for(const p of w.players){const q=prev.players.find(q=>q.id===p.id)!;if(distance(q,p)>.65)return result(false,`Body position jump at ${w.tick}`);}
    count+=w.events.filter(e=>e.type==='body-contact').length;
  }
  return result(count>0,`${count} ordered body contacts`,count>0);
}
export function teamAuthority(w:World):Verdict {
  const a=structuredClone(w),b=structuredClone(w);
  b.inputs=[{tick:w.tick+100,slot:0,move:{x:-1,y:1},aim:{x:1,y:1},sprint:true,shield:false,action:'shoot'}];
  const positions=(w:World)=>({ball:w.ball,players:w.players.map(p=>[p.id,p.x,p.y,p.vx,p.vy])});const initial=hash(positions(a));
  decideTeams(a);decideTeams(b);
  return result(initial===hash(positions(a))&&hash(a.teams)===hash(b.teams),'Team decisions preserve kinematics and ignore future queued inputs');
}
export function actionOrder(r:ScenarioRun):Verdict {
  const start=r.trace.flatMap(w=>w.events).find(e=>e.type==='action-start'&&e.playerId===r.scenario.focal);
  const contacts=r.trace.flatMap(w=>w.events).filter(e=>['ball-contact','keeper-ball-contact'].includes(e.type)&&e.playerId===r.scenario.focal);
  const contact=start?contacts.find(e=>e.tick>=Number(start.data?.contactTick)):undefined;
  const recovery=r.trace.flatMap(w=>w.events).find(e=>e.type==='action-recovered'&&e.playerId===r.scenario.focal);
  return result(!!start&&!!contact&&!!recovery&&start.tick<=contact.tick&&contact.tick<recovery.tick,'Preparation → contact → recovery must all be observed',!!start&&!!contact&&!!recovery);
}
export function hardOracle(id:string,a:ScenarioRun,b:ScenarioRun):Verdict {
  if(id.endsWith('-AUTH')||id.endsWith('-MEM')||id.endsWith('-COORD'))return teamAuthority(a.trace[30]);
  if(id.endsWith('-PHASE')&&!id.startsWith('TACK')){
    const phases=a.trace.map(w=>w.teams[0].phase);const transition=id.startsWith('TRANS-DA')?'to-attack':'to-defence';
    return result(phases.includes(transition),`Explicit ${transition} precedes settled phase`,phases.includes(transition));
  }
  if(id.startsWith('CTRL-'))return result(false,'Actual browser presentation timestamps are required',false);
  if(id==='CAM-PER-001-STATE')return result(a.finalHash===b.finalHash,'Camera variants preserve authoritative final hash');
  if(id==='BALL-SPN-001-SYM')return result(Math.abs(a.metrics.lateralDeviation+b.metrics.lateralDeviation)<.001,'Equal opposite spin must mirror the lateral trajectory');
  if(id==='BALL-BNC-001-EVENT')return result((a.events.bounce??0)>0,'A bounce event is required at floor impact',(a.events.bounce??0)>0);
  if(id.startsWith('PHY-'))return bodyContinuity(a.trace);
  if(id.startsWith('HEAD'))return reachContacts(a.trace,'head');
  if(id.startsWith('GK-LEG'))return reachContacts(a.trace,'foot');
  if(id.startsWith('GK-'))return reachContacts(a.trace);
  if(id.startsWith('TACK-'))return actionOrder(a);
  if(/^(TOUCH|INT|PASS|SHOT)/.test(id))return reachContacts(a.trace);
  if(id.startsWith('BALL-')||id==='LOC-BALL-001-FREE')return continuity(a.trace);
  return result(false,`No protected oracle resolved for ${id}`,false);
}
export function designOracle(id:string,a:ScenarioRun,b:ScenarioRun):Verdict {
  if(id==='LOC-ACC-002-DESIGN')return result(b.metrics.earlyDistance>a.metrics.earlyDistance*1.2&&Math.abs(b.metrics.plateau-a.metrics.plateau)<.12,'Higher acceleration improves early distance and preserves plateau');
  if(id==='SHOT-IND-001-DESIGN')return result(b.metrics.initialStrikeSpeed>a.metrics.initialStrikeSpeed*1.2,'Only strike power was changed; output speed must increase');
  if(id==='SHOT-SWV-001-DESIGN')return result(Math.abs(b.metrics.initialStrikeSpin)>Math.abs(a.metrics.initialStrikeSpin)+.5,'Swerve capability changes strike spin independently');
  if(['PHY-STR-001-DESIGN','PHY-PC-001-DESIGN'].includes(id))return result(Math.abs(b.metrics.lateralDisplacement)<Math.abs(a.metrics.lateralDisplacement),'Higher mass resists matched lateral contact');
  if(id==='PHY-BC-001-DESIGN')return result(b.metrics.minimumStability>a.metrics.minimumStability,'Body control reduces disturbance under the matched impact');
  return result(false,`No design target resolved for ${id}`,false);
}
export function mutationProof(trace:World[]){
  const teleport=structuredClone(trace);const i=teleport.findIndex((w,i)=>i>10&&w.phase==='playing'&&!w.events.some(e=>permitted.has(e.type)));if(i<0)return{observed:false,teleportDetected:false,impulseDetected:false};
  teleport[i].ball.x+=8;
  const impulse=structuredClone(trace);impulse[i].ball.vy+=12;
  return{observed:true,teleportDetected:!continuity(teleport).passed,impulseDetected:!continuity(impulse).passed};
}
