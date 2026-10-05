import { execFileSync } from 'node:child_process';
import { snapshot, scopedPlan, hash, type Snapshot } from './scoped-quality.js';
import { validateScopedProofs, validateFailureCause, type FailureClass } from './check-proof.js';
import { incidentEvents } from './incidents.js';
export interface Certificate { schema_version:1; target_commit:string; recorded_at:string; status:string; failure_class:FailureClass|null; receipt:{path:string;sha256:string}; horizon:string|null }
const ancestor=(root:string,a:string,b:string)=>{try{execFileSync('git',['-C',root,'merge-base','--is-ancestor',a,b],{stdio:'pipe'});return true;}catch{return false;}};
export function certificationHealth(root:string,ref='HEAD'): { latest:Certificate|null; latest_attempt:Certificate|null; last_certified:string|null; accepted_since:number; horizon:string|null } {
  const source=snapshot(root,ref==='WORKTREE'?undefined:ref);
  const ancestryRef=ref==='WORKTREE'?'HEAD':ref;
  const history=execFileSync('git',['-C',root,'log','--format=','--name-status',ancestryRef,'--','gauntlet/certification/'],{encoding:'utf8'});
  const dirty=ref==='WORKTREE'?execFileSync('git',['-C',root,'diff','--name-status','HEAD','--','gauntlet/certification/'],{encoding:'utf8'}):'';
  if([...history.split('\n'),...dirty.split('\n')].some(row=>row.trim()&&!row.startsWith('A\t')))throw new Error('certification history is append-only');
  const records=source.files.filter(p=>/^gauntlet\/certification\/[A-Za-z0-9._-]+\.json$/.test(p)).map(p=>JSON.parse(source.read(p)!.toString()) as Certificate).sort((a,b)=>a.recorded_at.localeCompare(b.recorded_at));
  let latest:Certificate|null=null,latest_attempt:Certificate|null=null,last_certified:string|null=null;
  for(const record of records){
    if(record.schema_version!==1||!['PASS','FAIL','BLOCKED','RECOVERY_BLOCKED'].includes(record.status)||!/^[a-f0-9]{40}$/.test(record.target_commit)||!Number.isFinite(Date.parse(record.recorded_at))||!ancestor(root,record.target_commit,ancestryRef)||!/^docs\/evidence\/CERT-[A-Za-z0-9._-]+\/verification\/[A-Za-z0-9._-]+-receipt\.json$/.test(record.receipt?.path))throw new Error('invalid certification record');
    const bytes=source.read(record.receipt.path);if(!bytes||hash(bytes)!==record.receipt.sha256)throw new Error('certification receipt provenance mismatch');
    const receipt=JSON.parse(bytes.toString());if(receipt.target_commit!==record.target_commit||receipt.proof_scope!=='certification'||receipt.status!==record.status||receipt.failure_class!==record.failure_class)throw new Error('certification record differs from execution');
    if(record.status==='PASS'){
      const target=snapshot(root,record.target_commit);
      const plan=scopedPlan([],target,target,false,false,true);
      if(JSON.stringify(plan)!==JSON.stringify(receipt.plan))throw new Error('certification plan mismatch');
      const overlay:Snapshot={files:target.files,read:p=>target.read(p)??source.read(p)};
      if(!/^docs\/evidence\/CERT-[A-Za-z0-9._-]+\/quality\.json$/.test(receipt.output_path))throw new Error('invalid certification output path');
      validateScopedProofs(plan,receipt,overlay,receipt.output_path);last_certified=record.target_commit;
    }
    if(record.failure_class==='HARNESS_ENVIRONMENT'){
      const target=snapshot(root,record.target_commit), plan=scopedPlan([],target,target,false,false,true);
      const overlay:Snapshot={files:target.files,read:p=>target.read(p)??source.read(p)};
      const failed=receipt.checks.find((r:any)=>r.status==='FAIL');const check=plan.checks.find(c=>c.id===failed?.id);
      if(!check||validateFailureCause(check,failed,overlay,plan.expected_tests[check.id]??[])!=='HARNESS_ENVIRONMENT')throw new Error('unsupported certification failure classification');
    }
    latest_attempt=record;
    // A proved refusal to execute is debt, not a new product observation. It
    // cannot replace an evidenced PASS/FAIL or supply missing bootstrap proof.
    if(record.status==='RECOVERY_BLOCKED'&&receipt.metrics?.executed_checks===0&&receipt.checks?.every((r:any)=>r.status==='NOT_RUN')){
      const target=snapshot(root,record.target_commit),plan=scopedPlan([],target,target,false,false,true);
      const incident=incidentEvents(root,source).find(e=>e.incident_id===receipt.incident_id&&e.boundary==='repository/full');
      if(!incident||receipt.failure_class!==null||receipt.metrics.reused_checks!==0||receipt.executed_commands?.length!==0||JSON.stringify(plan)!==JSON.stringify(receipt.plan)||JSON.stringify(receipt.checks.map((r:any)=>r.id))!==JSON.stringify(plan.checks.map(c=>c.id)))throw new Error('invalid non-executed certification attempt');
    }else latest=record;
  }
  const objectives=new Set<string>();
  for(const p of source.files.filter(p=>p.startsWith('gauntlet/evals/results/')&&p.endsWith('-acceptance.json'))){
    const record=JSON.parse(source.read(p)!.toString());
    if(record.proof_scope!=='objective')continue;
    if(last_certified&&ancestor(root,record.candidate_commit,last_certified))continue;
    objectives.add(record.objective_id);
  }
  return {latest,latest_attempt,last_certified,accepted_since:objectives.size,horizon:latest?.horizon??null};
}
export function verifyObjectiveAdmission(root:string,base:string,plan:{full_required:boolean},objective:string):void {
  const health=certificationHealth(root,base);
  if(health.accepted_since>=4)throw new Error('CERTIFICATION_REQUIRED: four uncertified objectives; certify before a fifth');
  // A complete current-candidate gate is itself the immediate full barrier.
  // A failed gate cannot reach this function through candidate validation.
  if(plan.full_required)return;
  if(!health.latest)throw new Error('CERTIFICATION_REQUIRED: bootstrap a repository certification attempt before scoped acceptance');
  // A PASS for an old tree cannot hide later unaccepted changes. Only the
  // existing durable candidate chain and its bookkeeping may intervene.
  const source=snapshot(root,base),covered=new Set<string>();
  for(const path of source.files.filter(p=>p.startsWith('gauntlet/evals/results/')&&p.endsWith('-acceptance.json'))){
    const accepted=JSON.parse(source.read(path)!.toString());
    if(accepted.proof_scope!=='objective'||!ancestor(root,health.latest.target_commit,accepted.candidate_commit)||!ancestor(root,accepted.candidate_commit,base))continue;
    const changed=execFileSync('git',['-C',root,'diff','--name-only',`${accepted.candidate_commit}^`,accepted.candidate_commit],{encoding:'utf8'}).trim().split('\n');
    changed.forEach(p=>covered.add(p));
  }
  const intervening=execFileSync('git',['-C',root,'diff','--name-only',health.latest.target_commit,base],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  if(intervening.some(p=>!covered.has(p)&&!/^gauntlet\/(?:state|certification|incidents|execution|evals\/results|trajectory\/horizons)\//.test(p)&&!/^docs\/evidence\/(?:CERT-[^/]+\/|[^/]+\/(?:manifest\.json|verification\/))/.test(p)))throw new Error('CERTIFICATION_REQUIRED: intervening unaccepted source changes');
  if(health.latest.status!=='PASS'){
    if(health.latest.failure_class!=='HARNESS_ENVIRONMENT')throw new Error('CERTIFICATION_BLOCKED: product, unknown or invalid certification failure');
    const horizon=snapshot(root,base).read('gauntlet/state/HORIZON.md')?.toString()??'';
    const selected=snapshot(root,health.latest.target_commit).read('gauntlet/state/HORIZON.md')?.toString()??'';
    const id=horizon.match(/^horizon_version:\s*(\d+)/m)?.[1];
    if(health.horizon!==`v${id}`||!horizon.includes(`- id: ${objective}\n`)||!selected.includes(`- id: ${objective}\n`))throw new Error('CERTIFICATION_BLOCKED: only already-selected objectives in the blocked Horizon may continue');
  }
}
export function requireMilestoneCertificate(root:string,target:string,ref='HEAD'):void {
  const health=certificationHealth(root,ref);
  if(health.latest?.status!=='PASS'||health.latest.target_commit!==target)throw new Error('MILESTONE_UNCERTIFIED: complete current-target repository certificate required');
}

export function verificationMeasurements(root:string,objectives:string[],ref='HEAD',horizon?:string) {
  const source=snapshot(root,ref);
  const runs=source.files.filter(p=>p.endsWith('-receipt.json')&&(objectives.some(id=>p.startsWith(`docs/evidence/${id}/verification/`))||Boolean(horizon)&&p.startsWith('docs/evidence/CERT-')));
  const measurements=runs.map(path=>{const bytes=source.read(path)!,run=JSON.parse(bytes.toString());return {path,sha256:hash(bytes),commit:ref,scope:run.proof_scope,horizon:run.horizon,status:run.status,metrics:run.metrics,executed_commands:run.executed_commands??[]};}).filter(r=>r.scope!=='certification'||`v${r.horizon}`===horizon);
  const keys=measurements.flatMap(r=>r.executed_commands.map((c:{input_key:string})=>c.input_key));
  return {coverage:'committed run receipts only; session totals require complete telemetry',full_suite_executions:measurements.length?measurements.reduce((sum,r)=>sum+(r.metrics.full_suite_executions??0),0):null,duplicated_unchanged_checks:measurements.length?keys.length-new Set(keys).size:null,status:measurements.length?'MEASURED':'UNAVAILABLE',verification_ms:measurements.length?measurements.reduce((sum,r)=>sum+r.metrics.verification_ms,0):null,executed_checks:measurements.length?measurements.reduce((sum,r)=>sum+r.metrics.executed_checks,0):null,reused_checks:measurements.length?measurements.reduce((sum,r)=>sum+r.metrics.reused_checks,0):null,sources:measurements};
}
