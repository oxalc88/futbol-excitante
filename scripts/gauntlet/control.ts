import { execFileSync } from 'node:child_process';
import { hash, snapshot } from '../../gauntlet/runtime/scoped-quality.js';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { appendIncident, incidentEvents } from '../../gauntlet/runtime/incidents.js';
import { reserveResume, closeObjectiveIncident, IncidentRecovery } from '../../gauntlet/runtime/incident-recovery.js';
import { sameHorizonWork, continuationDecision, stopRecord, escalationPacket, preservedProgress, type ContinuationFacts } from '../../gauntlet/runtime/continuation.js';
import { certificationHealth } from '../../gauntlet/runtime/certification.js';
import { executionState } from '../../gauntlet/runtime/integrated-execution.js';
const root=process.cwd(),[command,...args]=process.argv.slice(2),option=(k:string)=>args[args.indexOf(k)+1];
if(command==='close-incident')console.log(JSON.stringify(closeObjectiveIncident(root,option('--incident')!,option('--candidate')!,option('--objective')!),null,2));
else if(command==='reserve-resume')console.log(JSON.stringify(reserveResume(root,option('--incident')!),null,2));
else if(command==='settle-unit'){
  const objective=option('--objective')!,unit=option('--unit')!,output=option('--output')!,base=option('--base')!,handoff=option('--handoff')!;
  const source=snapshot(root,output),receipt_path=`docs/evidence/${objective}/units/${unit}/local-quality.json`,report=JSON.parse(source.read(receipt_path)!.toString());
  if(report.status!=='PASS'||report.acceptance!==false||report.objective_id!==objective||report.unit_id!==unit)throw new Error('validated local unit handoff required');
  const result={unit_id:unit,base_commit:base,output_commit:output,handoff:{path:handoff,sha256:hash(source.read(handoff)!)},checks:report.checks,receipt_path};
  const path=`gauntlet/execution/${objective}/${unit}.json`;mkdirSync(`gauntlet/execution/${objective}`,{recursive:true});writeFileSync(path,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  try{executionState(root,objective,snapshot(root));}catch(error){rmSync(path);throw error;}console.log(path);
}
else if(command==='execution')console.log(JSON.stringify(executionState(root,option('--objective')!),null,2));
else if(command==='escalate'){
  const id=option('--incident'),event=incidentEvents(root).filter(e=>e.incident_id===id).at(-1);if(!event)throw new Error('incident not found');
  if(event.state==='CLOSED')throw new Error('incident already closed');
  const canonical=incidentEvents(root).some(e=>e.incident_id===id&&e.kind==='ESCALATE')?event:appendIncident(root,{...event,kind:'ESCALATE',state:event.state});
  const packet=escalationPacket(root,canonical,preservedProgress(root),certificationHealth(root).accepted_since),path=`.delivery-local/escalation/${id}.json`;
  mkdirSync('.delivery-local/escalation',{recursive:true});writeFileSync(path,JSON.stringify(packet,null,2)+'\n');console.log(path);
}else if(command==='continue'||command==='stop'){
  new IncidentRecovery(root,'repository/full'); // Import/settle canonical recovery before selection.
  const input=args.includes('--facts')?JSON.parse(readFileSync(option('--facts')!,'utf8')):{};
  const f:ContinuationFacts={blocked_boundary:null,failure_class:null,incident_id:null,preserved_progress:[],certification_debt:certificationHealth(root).accepted_since,safe_work_considered:sameHorizonWork(root),routine_action:null,autonomous_actions_attempted:[],repair_available:false,engineering_escalation_available:false,engineering_escalation_attempted:false,evidence:[],external_decision:null,...input};
  f.safe_work_considered=sameHorizonWork(root); // Local packets cannot assert admission.
  if(f.incident_id){const e=incidentEvents(root).filter(e=>e.incident_id===f.incident_id).at(-1);if(!e)throw new Error('incident not found');f.blocked_boundary=e.boundary;f.failure_class=e.failure_class;f.evidence=e.evidence;f.engineering_escalation_attempted=incidentEvents(root).some(r=>r.incident_id===e.incident_id&&r.kind==='ESCALATE');f.repair_available=['ACTIVE','EXHAUSTED'].includes(e.state)&&!incidentEvents(root).some(r=>r.incident_id===e.incident_id&&r.kind==='DIAGNOSE');}
  const decision=continuationDecision(f);
  console.log(JSON.stringify(command==='stop'?{...decision,record:stopRecord(root,f)}:{...decision,facts:f},null,2));
}else throw new Error('usage: control continue|stop|execution|escalate|reserve-resume');
