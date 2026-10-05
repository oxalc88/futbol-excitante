import { execFileSync } from 'node:child_process';
import { snapshot, scopedPlan, hash } from './scoped-quality.js';
import { verifyObjectiveAdmission, certificationHealth } from './certification.js';
import { auditAppendOnly, currentEvidenceAvailable, activeIncident, incidentBoundary, incidentEvents, evidence, requirePublishedIncident, type EvidenceRef, type IncidentEvent } from './incidents.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { executionState } from './integrated-execution.js';
import { repairExecutionProvenance } from './execution-provenance.js';
import type { FailureClass } from './check-proof.js';

export type ExternalDecision = 'specification' | 'legal' | 'perceptual_route' | 'credentials_resources' | 'environment_execution_policy' | 'explicit_external_decision';
export interface ContinuationFacts {
  blocked_boundary: string | null; failure_class: FailureClass | null; incident_id: string | null;
  preserved_progress: string[]; certification_debt: number;
  safe_work_considered: Array<{ id: string; executable: boolean; reason: string }>;
  routine_action: string | null; autonomous_actions_attempted: string[];
  repair_available: boolean; engineering_escalation_available: boolean; engineering_escalation_attempted: boolean;
  evidence: EvidenceRef[]; external_decision: { kind: ExternalDecision; exact_decision_required: string } | null;
}
export function continuationDecision(f: ContinuationFacts) {
  const safe = f.safe_work_considered.find(w=>w.executable);
  if(f.routine_action)return {action:f.routine_action,stop:false};
  if(safe)return {action:'EXECUTE_PRODUCT',objective_id:safe.id,stop:false};
  if(f.engineering_escalation_available&&!f.engineering_escalation_attempted)return {action:'ENGINEERING_ESCALATION',stop:false};
  if(f.repair_available)return {action:'BOUNDED_REPAIR',stop:false};
  if(!f.external_decision?.exact_decision_required.trim())return {action:f.blocked_boundary?'DIAGNOSE_OR_REPLAN':'REPLAN',stop:false};
  if(!['specification','legal','perceptual_route','credentials_resources','environment_execution_policy','explicit_external_decision'].includes(f.external_decision.kind))throw new Error('unknown external decision');
  if(f.external_decision.kind==='environment_execution_policy' && (!f.blocked_boundary || !f.incident_id || !f.autonomous_actions_attempted.length || !f.evidence.length))throw new Error('environment stop requires audited bounded repair/escalation');
  return {action:'STOP',stop:true,stop_reason:f.external_decision.kind,exact_decision_required:f.external_decision.exact_decision_required};
}
/** A proposed scope is frozen in Git with Horizon selection. Unknown scope stays full. */
export function sameHorizonWork(root:string,ref='HEAD'):ContinuationFacts['safe_work_considered'] {
  const source=snapshot(root,ref),horizon=source.read('gauntlet/state/HORIZON.md')?.toString()??'';
  const entries=[...horizon.matchAll(/^\s+- id:\s*([A-Za-z0-9._-]+)\n([\s\S]*?)(?=^\s+- id:|^```|(?![\s\S]))/gm)];
  const accepted=new Set(entries.filter(m=>/status:\s*accepted/.test(m[2]!)).map(m=>m[1]!));
  for(const p of source.files.filter(p=>/^docs\/evidence\/[^/]+\/manifest\.json$/.test(p))){const manifest=JSON.parse(source.read(p)!.toString());if(manifest.objective_id&&manifest.acceptance_record&&source.read(manifest.acceptance_record))accepted.add(manifest.objective_id);}
  return entries.filter(m=>!accepted.has(m[1]!)).map(m=>{
    const id=m[1]!,scopePath=`gauntlet/execution/${id}.json`;
    try {
      if(/status:\s*(?:blocked|deferred)/.test(m[2]!))throw new Error('objective blocked/deferred');
      const deps=m[2]!.match(/prerequisites:\s*\[([^\]]*)\]/)?.[1]?.split(',').map(x=>x.trim().replace(/["']/g,'')).filter(Boolean)??[];
      const single=m[2]!.match(/prerequisite:\s*([^\n]+)/)?.[1]?.trim().replace(/["']/g,'');if(single)deps.push(single);
      if(deps.some(d=>!accepted.has(d)))throw new Error('prerequisite not accepted');
      const planBytes=source.read(scopePath);if(!planBytes)throw new Error('no canonical mapped scope: compute impact before admission');
      const state=executionState(root,id,source);if(!state||!state.all_complete&&!state.ready.length)throw new Error('no ready execution unit: unresolved dependency/interface');
      const execution=state.plan;
      const paths=execution.units.flatMap((u:any)=>u.expected_file_ownership.flatMap((p:string)=>p.endsWith('/**')?source.files.filter(f=>f.startsWith(p.slice(0,-2))):[p]));
      if(paths.some((p:string)=>/[?*\[]/.test(p)))throw new Error('unresolved ownership: full verification');
      const plan=scopedPlan(paths,source,source);verifyObjectiveAdmission(root,ref,plan,id);
      const incident=activeIncident(root,incidentBoundary(false,plan.full_required,id));
      if(incident && incident.state!=='RESUME_ONCE')throw new Error(`verification incident ${incident.incident_id}: ${incident.state}`);
      if(incident?.state==='RESUME_ONCE'){
        const credential=`${root}/.delivery-local/locks/resume-${incident.incident_id}.json`;
        if(!existsSync(credential)||hash(JSON.parse(readFileSync(credential,'utf8')).nonce)!==incident.execution_id)throw new Error('reserved execution belongs to its original harness/workspace');
      }
      return {id,executable:true,reason:'same Horizon; deterministic scope and admission valid'};
    }catch(error){return {id,executable:false,reason:String(error)};}
  });
}
export function preservedProgress(root:string,ref='HEAD'):string[] {
  const source=snapshot(root,ref);
  return [`source_commit:${execFileSync('git',['-C',root,'rev-parse',ref],{encoding:'utf8'}).trim()}`,...source.files.filter(p=>/^gauntlet\/evals\/results\/.*-acceptance\.json$/.test(p)||/^gauntlet\/execution\/[^/]+\/[^/]+\.json$/.test(p))];
}
export function routineContinuation(root:string):string|null {
  auditAppendOnly(root,'gauntlet/execution/provenance/');
  try{repairExecutionProvenance(root);}catch(error){
    if(String(error).includes('EXECUTION_PROVENANCE_MISSING'))return 'REGENERATE_EXECUTION_EVIDENCE';
    throw error;
  }
  const dirty=execFileSync('git',['-C',root,'status','--porcelain','--','gauntlet/execution/provenance/'],{encoding:'utf8'}).trim();
  if(dirty)return 'PUBLISH_BOOKKEEPING';
  const incident=activeIncident(root,'repository/full');
  if(incident&&currentEvidenceAvailable(root,incident))return 'CERTIFY_CURRENT';
  return null;
}
export function stopRecord(root:string,f:ContinuationFacts):string {
  const routine=routineContinuation(root);
  const considered=sameHorizonWork(root),history=f.incident_id?incidentEvents(root).filter(e=>e.incident_id===f.incident_id):[];
  const latest=history.at(-1);
  const facts={...f,routine_action:routine??f.routine_action,safe_work_considered:considered,preserved_progress:preservedProgress(root),certification_debt:certificationHealth(root).accepted_since};
  if(f.incident_id){
    if(!latest)throw new Error('stop incident missing');
    facts.blocked_boundary=latest.boundary;facts.failure_class=latest.failure_class;facts.evidence=latest.evidence;
    facts.autonomous_actions_attempted=history.filter(e=>!['OPEN','FAILURE','EXHAUST'].includes(e.kind)).map(e=>`${e.kind}:${e.sequence}`);
    facts.repair_available=['ACTIVE','EXHAUSTED'].includes(latest.state)&&!history.some(e=>e.kind==='DIAGNOSE');
    facts.engineering_escalation_attempted=history.some(e=>e.kind==='DISPATCH');
  }
  const decision=continuationDecision(facts);if(!decision.stop)throw new Error('no external decision: continue automatically');
  if(f.external_decision?.kind==='environment_execution_policy'){
    if(!latest||latest.state!=='BLOCKED'||!history.some(e=>e.kind==='DIAGNOSE')||!history.some(e=>e.kind==='REPAIR_FAILED'||e.kind==='RESERVE'))throw new Error('environment stop requires consumed bounded diagnosis, repair and recovery');
    requirePublishedIncident(root,latest);
  }
  facts.evidence.forEach(r=>evidence(snapshot(root,'HEAD'),r));
  const record={schema_version:1,...facts,...decision,recorded_at:new Date().toISOString(),source_commit:execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim()};
  const path=`gauntlet/incidents/stop-${hash(JSON.stringify(record))}.json`;mkdirSync(`${root}/gauntlet/incidents`,{recursive:true});writeFileSync(`${root}/${path}`,JSON.stringify(record,null,2)+'\n',{flag:'wx'});return path;
}
export function auditStopRecords(root:string):number {
  const source=snapshot(root),paths=source.files.filter(p=>/^gauntlet\/incidents\/stop-[a-f0-9]{64}\.json$/.test(p));
  for(const path of paths){
    const record=JSON.parse(source.read(path)!.toString());
    if(path!==`gauntlet/incidents/stop-${hash(JSON.stringify(record))}.json`||record.schema_version!==1||!record.stop||record.action!=='STOP'||record.exact_decision_required!==record.external_decision?.exact_decision_required||!record.exact_decision_required?.trim()||!/^[a-f0-9]{40}$/.test(record.source_commit)||!Array.isArray(record.safe_work_considered)||record.safe_work_considered.some((w:any)=>w.executable))throw new Error('invalid canonical stop record');
    const historical=snapshot(root,record.source_commit);record.evidence.forEach((r:EvidenceRef)=>evidence(historical,r));
    if(JSON.stringify(record.preserved_progress)!==JSON.stringify(preservedProgress(root,record.source_commit))||record.certification_debt!==certificationHealth(root,record.source_commit).accepted_since)throw new Error('stop progress/debt differs from canonical source');
    if(!continuationDecision(record).stop)throw new Error('stop has routine continuation');
    if(record.stop_reason==='environment_execution_policy'){
      const history=incidentEvents(root,historical).filter(e=>e.incident_id===record.incident_id),latest=history.at(-1);
      if(latest?.state!=='BLOCKED'||record.blocked_boundary!==latest.boundary||record.failure_class!==latest.failure_class||!history.some(e=>e.kind==='DIAGNOSE')||!history.some(e=>e.kind==='REPAIR_FAILED'||e.kind==='RESERVE'))throw new Error('unaudited environment stop');
    }
  }
  return paths.length;
}
export function escalationPacket(root:string,e:IncidentEvent,preserved_progress:string[],certification_debt:number) {
  const history=incidentEvents(root).filter(r=>r.incident_id===e.incident_id);
  const proofs=e.evidence.map(r=>{try{return JSON.parse(evidence(snapshot(root),r).toString());}catch{return null;}}).filter(p=>p?.profile);
  const diagnosis=history.find(r=>r.kind==='DIAGNOSE')?.evidence.at(-1),attemptedRepair=diagnosis?JSON.parse(evidence(snapshot(root),diagnosis).toString()):null;
  return {schema_version:1,incident_id:e.incident_id,canonical_event:`gauntlet/incidents/${e.incident_id}/${String(e.sequence).padStart(6,'0')}.json`,blocked_verification_boundary:e.boundary,failure_class:e.failure_class,exact_failing_check:e.recovery.failure.check,evidence_references:e.evidence,previous_bounded_diagnosis:history.find(r=>r.kind==='DIAGNOSE')?.evidence??[],previous_bounded_repair:history.find(r=>r.kind==='REPAIR')?.repair??attemptedRepair,preserved_product_progress:preserved_progress,certification_debt,log_proof_references:proofs.map(p=>({log:p.log,proof_profile:p.profile})),environment_toolchain_identity:proofs[0]?.profile??{status:'UNAVAILABLE',reason:'legacy incident has no durable execution profile'},permitted_repair_scope:['Gauntlet','harness integration','verification tooling','one focused reproducer'],prohibited_actions:['waive tests','FAIL to PASS','reset incident','increase budgets/timeouts/retries','weaken assertions','change requirements','change product code','self certify'],required_recovery_evidence:['original failure','material repair identity','repair commit or durable environment identity','derived focused reproducer PASS with log/report proof'],authority:'transport only; validate against canonical event before use'};
}
