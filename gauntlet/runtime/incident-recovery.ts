import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { activeIncident, appendIncident, openIncident, exhaustIncident, importLegacyIncidents, incidentBoundary, evidence, requirePublishedIncident, validateRepairCommit, requireRelevantRepair, incidentEvents, type IncidentEvent, type MaterialRepair } from './incidents.js';
import { snapshot, hash, digest } from './scoped-quality.js';
import { rememberFailure, repairCheck, RecoveryBlockedError, type QualityRecovery } from './quality-execution.js';
import { validateCheckProof, type Profile, type ProvenResult } from './check-proof.js';
import type { QualityCheck } from './product-quality.js';

export function legacyRecoveryPaths(root:string):string[] {
  const walk=(p:string):string[]=>existsSync(join(root,p))?readdirSync(join(root,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${p}/${e.name}`):e.name==='recovery.json'?[`${p}/${e.name}`]:[]):[];
  return walk('.delivery-local/quality').sort((a,b)=>{
    const started=(p:string)=>JSON.parse(readFileSync(join(root,p),'utf8')).budget?.started_at_ms??Number.MAX_SAFE_INTEGER;
    return started(a)-started(b);
  });
}
export class IncidentRecovery {
  incident:IncidentEvent|null;
  resumed=false;
  repairInput: {diagnosis:string;component:string;repair_commit:string}|null=null;
  constructor(readonly root:string,readonly boundary:string){
    mkdirSync(`${root}/gauntlet/incidents`,{recursive:true});
    importLegacyIncidents(root,legacyRecoveryPaths(root));
    this.incident=activeIncident(root,boundary);
    this.settleInterruptedRepair();
    if(this.incident)this.incident=exhaustIncident(root,this.incident);
  }
  settleInterruptedRepair():void {
    const e=this.incident;
    if(e&&['ACTIVE','EXHAUSTED'].includes(e.state)&&incidentEvents(this.root).filter(r=>r.incident_id===e.incident_id).at(-1)?.kind==='DIAGNOSE'){
      const bytes=Buffer.from(JSON.stringify({incident_id:e.incident_id,status:'INTERRUPTED',reason:'bounded diagnostic did not produce a validated repair result'})+'\n');
      const ref={path:`gauntlet/incidents/interrupted-${e.incident_id}.json`,sha256:hash(bytes)};
      writeFileSync(`${this.root}/${ref.path}`,bytes,{flag:'wx'});
      this.incident=appendIncident(this.root,{...e,kind:'REPAIR_FAILED',state:'BLOCKED',evidence:[...e.evidence,ref]});
    }
  }
  beforeRun():void {
    const e=this.incident;if(!e)return;
    if(e.state!=='RESUME_ONCE')throw new RecoveryBlockedError(`RECOVERY_BLOCKED: incident ${e.incident_id} ${e.state}; diagnose/repair or continue independently verifiable product work`);
    requirePublishedIncident(this.root,e);
    const noncePath=`${this.root}/.delivery-local/locks/resume-${e.incident_id}.json`;
    if(!existsSync(noncePath))throw new RecoveryBlockedError('RECOVERY_BLOCKED: reserved execution belongs to its original harness/workspace; no fresh grant');
    const nonce=JSON.parse(readFileSync(noncePath,'utf8')).nonce;
    if(hash(nonce)!==e.execution_id)throw new Error('invalid execution reservation credential');
    this.incident=appendIncident(this.root,{...e,kind:'BLOCK',state:'BLOCKED'});
    rmSync(noncePath); // A stale credential cannot override canonical consumed state.
    this.resumed=true;
  }
  beginRepair(path:string):QualityCheck {
    const e=this.incident;if(!e||!['ACTIVE','EXHAUSTED'].includes(e.state))throw new RecoveryBlockedError('one diagnosis and machinery repair per incident; no recursive infrastructure work');
    requirePublishedIncident(this.root,e);
    const input=JSON.parse(readFileSync(path,'utf8'));
    if(!input.diagnosis?.trim()||!input.component?.trim()||!/^[a-f0-9]{40}$/.test(input.repair_commit))throw new Error('diagnosis, repaired component and durable repair commit required');
    validateRepairCommit(this.root,input.repair_commit);requireRelevantRepair(this.root,e,input.component,input.repair_commit);
    const bytes=Buffer.from(JSON.stringify({diagnosis:input.diagnosis,component:input.component,repair_commit:input.repair_commit})+'\n');
    const ref={path:`gauntlet/incidents/diagnosis-${e.incident_id}.json`,sha256:hash(bytes)};
    writeFileSync(`${this.root}/${ref.path}`,bytes,{flag:'wx'});
    this.incident=appendIncident(this.root,{...e,kind:'DIAGNOSE',state:e.state,evidence:[...e.evidence,ref]});
    this.repairInput=input;return repairCheck(e.recovery).check;
  }
  confirmRepair(check:QualityCheck,row:ProvenResult,profile:Profile,receiptPath:string):void {
    const e=this.incident!,source=snapshot(this.root),expected=check.command.filter(p=>p.startsWith('tests/')).sort();
    const proofBytes=evidence(source,row.proof!),proof=JSON.parse(proofBytes.toString());
    // Runner inventories the actual derived command; exact whole-check inventories
    // are in the proof when no focused paths are present.
    validateCheckProof(check,row,source,profile,receiptPath,proof.expected_tests);
    if(expected.length&&JSON.stringify(expected)!==JSON.stringify(proof.expected_tests))throw new Error('focused reproducer coverage differs');
    const repaired_identity=digest({profile,repair_commit:this.repairInput!.repair_commit});
    const data={receipt_path:receiptPath,execution_mode:'repair',status:'REPAIR_PASS',incident_id:e.incident_id,original_failure:e.recovery.failure.signature,command:check.command,repaired_identity,exit_code:row.exit_code,proof:row.proof};
    const bytes=Buffer.from(JSON.stringify(data,null,2)+'\n'),ref={path:`gauntlet/incidents/reproducer-${e.incident_id}.json`,sha256:hash(bytes)};
    writeFileSync(`${this.root}/${ref.path}`,bytes,{flag:'wx'});
    const repair:MaterialRepair={original_failure:e.recovery.failure.signature,component:this.repairInput!.component,repair_commit:this.repairInput!.repair_commit,previous_identity:digest(e.recovery.failure),repaired_identity,reproducer:check.command,result:ref,diagnosis:e.evidence.at(-1)!};
    this.incident=appendIncident(this.root,{...e,kind:'REPAIR',state:'REPAIR_CONFIRMED',repair,evidence:[...e.evidence,ref]});
  }
  failed(check:QualityCheck,row:ProvenResult):void {
    const prior=this.incident,recovery=rememberFailure(prior?.recovery??null,check,row),refs=[row.proof!];
    if(!prior)this.incident=openIncident(this.root,this.boundary,recovery,row.failure_class??'UNKNOWN',refs);
    else if(this.resumed){this.incident=appendIncident(this.root,{...prior,kind:'BLOCK',state:'BLOCKED',recovery,evidence:[...prior.evidence,...refs],failure_class:row.failure_class??'UNKNOWN'});}
    // Diagnostic failure consumes the only repair and remains blocked. The
    // original failure and deadline survive, even with a new failure signature.
    else this.incident=appendIncident(this.root,{...prior,kind:'REPAIR_FAILED' as IncidentEvent['kind'],state:'BLOCKED',recovery,evidence:[...prior.evidence,...refs],failure_class:row.failure_class??'UNKNOWN'});
  }
  passed(ref:{path:string;sha256:string}):void {
    const receipt=JSON.parse(evidence(snapshot(this.root),ref).toString());
    // Objective sources become durable in the candidate commit; close through
    // control close-incident after that commit rather than attesting HEAD's old tree.
    if(receipt.proof_scope==='objective')return;
    if(this.resumed&&this.incident)this.incident=appendIncident(this.root,{...this.incident,kind:'CLOSE',state:'CLOSED',evidence:[...this.incident.evidence,ref]});
  }
}
export function reserveResume(root:string,id:string):IncidentEvent {
  // Resolve by ID, never by CERT/objective labels.
  const all=snapshot(root).files.filter(p=>p.startsWith(`gauntlet/incidents/${id}/`)&&p.endsWith('.json')).sort();
  if(!all.length)throw new Error('incident missing');
  const e=JSON.parse(readFileSync(`${root}/${all.at(-1)}`,'utf8')) as IncidentEvent;
  if(e.state!=='REPAIR_CONFIRMED')throw new Error('material repair must be confirmed before one execution');
  requirePublishedIncident(root,e);
  const nonce=randomBytes(32).toString('hex');
  const reserved=appendIncident(root,{...e,kind:'RESERVE',state:'RESUME_ONCE',execution_id:hash(nonce)});
  mkdirSync(`${root}/.delivery-local/locks`,{recursive:true});writeFileSync(`${root}/.delivery-local/locks/resume-${id}.json`,JSON.stringify({nonce}),{flag:'wx'});
  return reserved;
}

export function closeObjectiveIncident(root:string,id:string,candidate:string,objective:string):IncidentEvent {
  const history=incidentEvents(root).filter(e=>e.incident_id===id),e=history.at(-1);
  if(!e||e.state!=='BLOCKED'||!history.some(r=>r.kind==='RESERVE'))throw new Error('only the consumed audited execution can close');
  const source=snapshot(root,candidate),path=`docs/evidence/${objective}/quality.json`,receipt=JSON.parse(source.read(path)!.toString());
  if(receipt.incident_id!==id||receipt.proof_scope!=='objective'||receipt.status!=='PASS'||e.boundary==='repository/full'&&!receipt.plan.full_required||e.boundary.startsWith('objective/')&&e.boundary!==`objective/${objective}`)throw new Error('complete original-boundary objective execution required');
  execFileSync('git',['-C',root,'merge-base','--is-ancestor',candidate,'HEAD']);
  const bytes=Buffer.from(JSON.stringify({...receipt,completed_commit:candidate},null,2)+'\n'),ref={path:`gauntlet/incidents/completed-${id}.json`,sha256:hash(bytes)};
  writeFileSync(`${root}/${ref.path}`,bytes,{flag:'wx'});
  return appendIncident(root,{...e,kind:'CLOSE',state:'CLOSED',evidence:[...e.evidence,ref]});
}
