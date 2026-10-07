import { describe, it, expect } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fixture } from '../helpers/gauntlet-quality.js';
import { qualityPlan } from '../../gauntlet/runtime/product-quality.js';
import { rememberFailure } from '../../gauntlet/runtime/quality-execution.js';
import { incidentEvents, activeIncident, validateRepairCommit, requireRelevantRepair } from '../../gauntlet/runtime/incidents.js';
import { reserveResume, IncidentRecovery, closeObjectiveIncident } from '../../gauntlet/runtime/incident-recovery.js';
import { continuationDecision, stopRecord, auditStopRecords, sameHorizonWork, type ContinuationFacts } from '../../gauntlet/runtime/continuation.js';
import { executableUnits, validateUnitBatch, validateExecutionPlan } from '../../gauntlet/runtime/execution-dag.mjs';
import { validateIntegratedExecution, executionState } from '../../gauntlet/runtime/integrated-execution.js';
import { verifyCandidateQuality } from '../../gauntlet/runtime/candidate-quality.js';
const facts=(extra:Partial<ContinuationFacts>={}):ContinuationFacts=>({blocked_boundary:null,incident_id:null,failure_class:null,preserved_progress:[],certification_debt:0,safe_work_considered:[],routine_action:null,autonomous_actions_attempted:[],repair_available:false,engineering_escalation_available:false,engineering_escalation_attempted:false,evidence:[],external_decision:null,...extra});
const unit=(id:string,paths:string[],dependencies:string[]=[])=>({id,purpose:id,dependencies,expected_file_ownership:paths,builder_role:'builder-structured',local_checks:[{id:'unit',command:['pnpm','run','test']}],handoff_contract:'validated output',interfaces_known:true});

describe('0.13 product-first deterministic policy',()=>{
  it('continues routine work, safe product work, repair and engineering escalation without a human',()=>{
    expect(continuationDecision(facts()).action).toBe('REPLAN');
    expect(continuationDecision(facts({routine_action:'PUBLISH_ACCEPTANCE'})).stop).toBe(false);
    for(const label of ['certificate failed','incident exhausted','unit failed','Horizon complete'])expect(continuationDecision(facts({blocked_boundary:label,safe_work_considered:[{id:'PRODUCT',executable:true,reason:'verified scope'}]})).action).toBe('EXECUTE_PRODUCT');
    expect(continuationDecision(facts({repair_available:true})).action).toBe('BOUNDED_REPAIR');
    expect(continuationDecision(facts({engineering_escalation_available:true})).action).toBe('ENGINEERING_ESCALATION');
    expect(continuationDecision(facts({external_decision:{kind:'legal',exact_decision_required:'Choose licensed asset source'}})).stop).toBe(true);
    expect(()=>continuationDecision(facts({external_decision:{kind:'environment_execution_policy',exact_decision_required:'Change environment'}}))).toThrow('audited');
  });
  it('keeps one product acceptance with deterministic dependencies and conflict serialization',()=>{
    const plan={schema_version:1 as const,objective_id:'PRODUCT',issue_number:1,units:[unit('A',['src/a.ts']),unit('B',['src/b.ts']),unit('C',['src/a.ts'],['A'])]};
    expect(executableUnits(plan).ready).toEqual(['A','B']);
    expect(executableUnits(plan,['A']).ready).toEqual(['B','C']);
    expect(()=>validateUnitBatch(plan,[{unit_id:'C',objective_id:'PRODUCT',agent:'builder-structured',isolated:true}])).toThrow('ready');
    expect(()=>validateUnitBatch(plan,[{unit_id:'A',objective_id:'PRODUCT',agent:'builder-structured',isolated:false}])).toThrow('isolated');
    const conflict={...plan,units:[unit('A',['src/a.ts']),unit('B',['src/a.ts'])]};expect(executableUnits(conflict).ready).toEqual(['A']);expect(executableUnits(conflict,['A']).ready).toEqual(['B']);
    expect(()=>validateExecutionPlan({...plan,units:[unit('A',['src/a.ts'],['B']),unit('B',['src/b.ts'],['A'])]})).toThrow('cycle');
  });

});

describe('0.13 actual command and canonical recovery',()=>{
  it('imports exhausted legacy state once, then survives local deletion, a CERT rename and another checkout',()=>{
    const f=fixture(true);try{
      const check=qualityPlan(['gauntlet/runtime/quality-execution.ts']).checks.find(c=>c.id==='regression-tests')!;
      const old=rememberFailure(null,check,{id:check.id,status:'FAIL',exit_code:1,log:'old.log',duration_ms:1,failure_signature:'a'.repeat(64)});old.budget!.started_at_ms-=91*60*1000;old.budget!.repair_attempts=2;
      const bytes=JSON.stringify(old),path='.delivery-local/quality/OLD/recovery.json';f.write(path,bytes);
      const out='docs/evidence/CERT-migrate/quality.json';expect(f.cli('--stage','certification','--execute','--out',out).status).toBe(1);expect(f.json(out).metrics.executed_checks).toBe(0);
      const e=activeIncident(f.root,'repository/full')!;expect(e.state).toBe('EXHAUSTED');expect(e.recovery.budget).toEqual(old.budget);expect(readFileSync(join(f.root,path),'utf8')).toBe(bytes);
      f.git('add','.');f.git('commit','-m','publish canonical migrated incident');rmSync(join(f.root,'.delivery-local/quality'),{recursive:true,force:true});
      const next='docs/evidence/CERT-renamed/quality.json';expect(f.cli('--stage','certification','--execute','--out',next).status).toBe(1);expect(f.json(next).metrics.executed_checks).toBe(0);expect(activeIncident(f.root,'repository/full')!.incident_id).toBe(e.incident_id);
      const clone=join(f.dir,'clone');f.git('clone',f.root,clone);expect(activeIncident(clone,'repository/full')!.incident_id).toBe(e.incident_id);
      f.write(`gauntlet/incidents/${e.incident_id}/000000.json`,'{}');expect(()=>incidentEvents(f.root)).toThrow('append-only');
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },15000);
  it('proves a material machinery repair and grants exactly one full execution without resetting history',()=>{
    const f=fixture();try{
      f.write('.delivery-local/mode','worker');const out='docs/evidence/CERT-original/quality.json';expect(f.cli('--stage','certification','--execute','--out',out).status).toBe(1);
      const original=activeIncident(f.root,'repository/full')!,budget=original.recovery.budget;
      f.git('add','.');f.git('commit','-m','publish original incident');
      f.git('checkout','-b','invalid-unrelated-repair');f.write('scripts/ci/unrelated.mjs','export const unrelated = true;');f.git('add','scripts/ci/unrelated.mjs');f.git('commit','-m','unrelated executable edit');expect(()=>requireRelevantRepair(f.root,original,'scripts/ci/unrelated.mjs',f.git('rev-parse','HEAD'))).toThrow('original-check dependency');f.git('checkout','main');
      f.write('scripts/ci/transport.mjs','process.exit(0);\n');f.git('add','scripts/ci/transport.mjs');f.git('commit','-m','repair machinery');const commit=f.git('rev-parse','HEAD');
      f.write('.delivery-local/repair.json',JSON.stringify({diagnosis:'Observed transport defect; repaired machinery and exact reproducer',component:'scripts/ci/transport.mjs',repair_commit:commit}));
      const repair=f.cli('--stage','certification','--execute','--out','docs/evidence/CERT-repair/quality.json','--repair','.delivery-local/repair.json');expect(repair.status,repair.stderr).toBe(0);
      const confirmed=activeIncident(f.root,'repository/full')!;expect(confirmed.state).toBe('REPAIR_CONFIRMED');expect(confirmed.recovery.budget).toEqual(budget);
      expect(()=>reserveResume(f.root,original.incident_id)).toThrow();f.git('add','.');f.git('commit','-m','publish material repair evidence');
      reserveResume(f.root,original.incident_id);expect(()=>reserveResume(f.root,original.incident_id)).toThrow('confirmed');
      f.write('gauntlet/execution/PLAYER-A.json',JSON.stringify({schema_version:1,objective_id:'PLAYER-A',issue_number:1,base_commit:f.git('rev-parse','HEAD'),units:[unit('A',['src/main.ts'])]}));
      f.git('add','.');f.git('commit','-m','publish single execution reservation');
      expect(sameHorizonWork(f.root).find(w=>w.id==='PLAYER-A')!.executable).toBe(true);
      const clone=join(f.dir,'reserved-clone');f.git('clone',f.root,clone);expect(()=>new IncidentRecovery(clone,'repository/full').beforeRun()).toThrow('original harness/workspace');
      expect(sameHorizonWork(clone).find(w=>w.id==='PLAYER-A')).toMatchObject({executable:false,reason:expect.stringContaining('original harness/workspace')});
      const resumed=f.cli('--stage','certification','--execute','--out','docs/evidence/CERT-resumed/quality.json');expect(resumed.status,resumed.stderr).toBe(0);expect(activeIncident(f.root,'repository/full')).toBeNull();
      const history=incidentEvents(f.root).filter(e=>e.incident_id===original.incident_id);expect(history.filter(e=>e.kind==='RESERVE')).toHaveLength(1);expect(history.at(-1)!.state).toBe('CLOSED');for(const e of history)expect(e.recovery.budget).toEqual(budget);
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },20000);
  it('rejects product-code repair and incomplete integrated units before acceptance',()=>{
    const f=fixture();try{
      f.write('.delivery-local/mode','worker');expect(f.cli('--stage','certification','--execute','--out','docs/evidence/CERT-fail/quality.json').status).toBe(1);f.git('add','.');f.git('commit','-m','publish incident');
      f.write('src/main.ts','product change');f.git('add','src/main.ts');f.git('commit','-m','invalid repair scope');f.write('.delivery-local/repair.json',JSON.stringify({diagnosis:'Claimed repair',component:'app',repair_commit:f.git('rev-parse','HEAD')}));const calls=f.calls().length;
      const result=f.cli('--stage','certification','--execute','--out','docs/evidence/CERT-invalid/quality.json','--repair','.delivery-local/repair.json');expect(result.status).toBe(1);expect(result.stderr).toContain('only verification machinery');expect(f.calls().length).toBe(calls);
      f.write('gauntlet/execution/PLAYER-A.json',JSON.stringify({schema_version:1,objective_id:'PLAYER-A',issue_number:1,base_commit:f.git('rev-parse','HEAD'),units:[unit('A',['src/main.ts'])]}));f.git('add','.');f.git('commit','-m','canonical execution plan');expect(()=>validateIntegratedExecution(f.root,'PLAYER-A')).toThrow('integrate');
      expect(()=>stopRecord(f.root,facts())).toThrow('continue automatically');
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },15000);
  it('runs published-plan units, settles immutable proofs and accepts one integrated candidate',()=>{
    const f=fixture();try{
      expect(f.cli('--stage','certification','--execute','--out','docs/evidence/CERT-unit-baseline/quality.json').status).toBe(0);f.git('add','.');f.git('commit','-m','publish unit candidate baseline');
      const base=f.git('rev-parse','HEAD'),objective='PLAYER-A';
      const plan={schema_version:1,objective_id:objective,issue_number:1,base_commit:base,units:[unit('A',['src/apps/browser/styles.css']),unit('B',['src/apps/browser/controls-legend-ui.ts'])]};
      f.write(`gauntlet/execution/${objective}.json`,JSON.stringify(plan));f.git('add','.');f.git('commit','-m','publish product execution plan');const published=f.git('rev-parse','HEAD');
      const outputs:string[]=[];
      for(const [id,path] of [['A','src/apps/browser/styles.css'],['B','src/apps/browser/controls-legend-ui.ts']]){
        f.git('checkout','-b',`unit-${id}`,published);f.write(path!,`// product output ${id}`);
        const handoff=`docs/evidence/${objective}/units/${id}/handoff.md`;f.write(handoff,`Completed declared ${id} output`);
        const checked=f.cli('--objective',objective,'--unit',id!,'--execute');expect(checked.status,checked.stderr).toBe(0);expect(f.json(`docs/evidence/${objective}/units/${id}/local-quality.json`).acceptance).toBe(false);
        f.git('add','.');f.git('commit','-m',`unit ${id} checked handoff`);const output=f.git('rev-parse','HEAD');outputs.push(output);
        f.git('checkout','main');const settled=f.control('settle-unit','--objective',objective,'--unit',id!,'--base',published,'--output',output,'--handoff',handoff);expect(settled.status,settled.stderr).toBe(0);f.git('add','.');f.git('commit','-m',`settle ${id}`);
      }
      expect(executionState(f.root,objective)!.all_complete).toBe(true);
      expect(()=>validateIntegratedExecution(f.root,objective)).toThrow('ancestry');
      const candidateBase=f.git('rev-parse','HEAD');f.git('merge','--no-commit','--no-ff',...outputs);
      const quality=f.cli('--stage','objective','--base',candidateBase,'--execute','--out',`docs/evidence/${objective}/quality.json`);expect(quality.status,quality.stderr).toBe(0);expect(f.json(`docs/evidence/${objective}/quality.json`).plan.full_required).toBe(false);expect(f.json(`docs/evidence/${objective}/quality.json`).plan.reviews_required).toBe(true);
      f.git('add','.');f.git('commit','-m','one integrated candidate with objective verification');const candidate=f.git('rev-parse','HEAD');
      expect(validateIntegratedExecution(f.root,objective)).not.toBeNull();
      expect(verifyCandidateQuality(f.root,candidate,objective,'builder',{verdict:'ACCEPT',model:'independent'},{verdict:'ACCEPT',model:'independent'}).plan.proof_scope).toBe('objective');
      expect(f.git('ls-tree','-r','--name-only','HEAD')).not.toContain('-acceptance.json');
      f.write(`gauntlet/execution/${objective}/A.json`,JSON.stringify({...f.json(`gauntlet/execution/${objective}/A.json`),base_commit:outputs[1]}));expect(()=>executionState(f.root,objective)).toThrow('append-only');
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },20000);
  it('fails closed on corrupt migration, changed repair policy and an interrupted diagnostic',()=>{
    const f=fixture(true);try{
      f.write('gauntlet/incidents/legacy-import.json','not valid json');expect(()=>new IncidentRecovery(f.root,'repository/full')).toThrow();rmSync(join(f.root,'gauntlet/incidents/legacy-import.json'));
      f.write('gauntlet/runtime/quality-execution.ts',readFileSync(join(process.cwd(),'gauntlet/runtime/quality-execution.ts'),'utf8'));f.git('add','.');f.git('commit','-m','executor fixture');
      const original=readFileSync(join(f.root,'gauntlet/runtime/quality-execution.ts'),'utf8');f.write('gauntlet/runtime/quality-execution.ts',original.replace('return new Promise(resolve => {','timeout *= 2; return new Promise(resolve => {'));f.git('add','.');f.git('commit','-m','invalid timeout mutation');expect(()=>validateRepairCommit(f.root,f.git('rev-parse','HEAD'))).toThrow('execution policy');
      f.write('.delivery-local/mode','worker');expect(f.cli('--stage','certification','--execute','--out','docs/evidence/CERT-interrupted/quality.json').status).toBe(1);f.git('add','.');f.git('commit','-m','publish failed verification');
      f.write('scripts/ci/transport.mjs','process.exit(0);');f.git('add','.');f.git('commit','-m','bounded machinery repair');f.write('.delivery-local/repair.json',JSON.stringify({diagnosis:'transport cause',component:'scripts/ci/transport.mjs',repair_commit:f.git('rev-parse','HEAD')}));
      const recovery=new IncidentRecovery(f.root,'repository/full');recovery.beginRepair(join(f.root,'.delivery-local/repair.json'));const restarted=new IncidentRecovery(f.root,'repository/full');expect(restarted.incident!.state).toBe('BLOCKED');expect(()=>restarted.beginRepair(join(f.root,'.delivery-local/repair.json'))).toThrow('one diagnosis');
      f.git('add','.');f.git('commit','-m','publish interrupted bounded diagnosis');
      // 0.14 supersedes the old terminal environment stop when verification inputs changed:
      // current truth must be re-certified before asking a human to alter policy.
      expect(()=>stopRecord(f.root,facts({incident_id:restarted.incident!.incident_id,external_decision:{kind:'environment_execution_policy',exact_decision_required:'Provide an environment in which the protected worker check can execute'}}))).toThrow('continue automatically');
      expect(auditStopRecords(f.root)).toBe(0);
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },20000);

  it('continues mapped same-Horizon work behind supported certification debt, but blocks unknown debt',()=>{
    const f=fixture();try{
      f.write('.delivery-local/mode','worker');expect(f.cli('--stage','certification','--execute','--out','docs/evidence/CERT-debt/quality.json').status).toBe(1);const base=f.git('rev-parse','HEAD');
      f.write('gauntlet/execution/PLAYER-B.json',JSON.stringify({schema_version:1,objective_id:'PLAYER-B',issue_number:2,base_commit:base,units:[unit('style',['src/apps/browser/styles.css'])]}));f.git('add','.');f.git('commit','-m','preserve certification debt and selected product scope');
      expect(sameHorizonWork(f.root).find(w=>w.id==='PLAYER-B')!.executable).toBe(true);expect(()=>stopRecord(f.root,facts({external_decision:{kind:'legal',exact_decision_required:'Select a license'}}))).toThrow('continue automatically');
      f.write('.delivery-local/mode','pass');f.write('src/apps/browser/styles.css','after');expect(f.cli('--stage','objective','--base',f.git('rev-parse','HEAD'),'--execute','--out','docs/evidence/PLAYER-B/quality.json').status).toBe(1); // A declared unit still has to settle/integrate before product acceptance.
      expect(activeIncident(f.root,'repository/full')!.state).toBe('ACTIVE');
      const scopedBase=f.git('rev-parse','HEAD');f.write('.delivery-local/mode','scoped-worker');expect(f.cli('--stage','objective','--base',scopedBase,'--execute','--out','docs/evidence/PLAYER-A/quality.json').status).toBe(1);const mapped=activeIncident(f.root,'objective/PLAYER-A')!;expect(mapped).not.toBeNull();f.write('scripts/ci/transport.mjs','process.exit(0);');const calls=f.calls().length;const bypass=f.cli('--stage','objective','--base',scopedBase,'--incident',mapped.incident_id,'--execute','--out','docs/evidence/PLAYER-A/quality.json');expect(bypass.status).toBe(1);expect(bypass.stderr).toContain('cannot bypass repository/full');expect(f.calls().length).toBe(calls);
    }finally{rmSync(f.dir,{recursive:true,force:true});}
    const unknown=fixture();try{
      unknown.write('.delivery-local/mode','unknown');expect(unknown.cli('--stage','certification','--execute','--out','docs/evidence/CERT-unknown/quality.json').status).toBe(1);
      unknown.write('gauntlet/execution/PLAYER-B.json',JSON.stringify({schema_version:1,objective_id:'PLAYER-B',issue_number:2,base_commit:unknown.git('rev-parse','HEAD'),units:[unit('style',['src/apps/browser/styles.css'])]}));unknown.git('add','.');unknown.git('commit','-m','preserve unknown blocker');expect(sameHorizonWork(unknown.root).find(w=>w.id==='PLAYER-B')!.executable).toBe(false);
    }finally{rmSync(unknown.dir,{recursive:true,force:true});}
  },20000);

  it('closes an originally mapped incident after material repair, changed scope and durable objective PASS',()=>{
    const f=fixture();try{
      expect(f.cli('--stage','certification','--execute','--out','docs/evidence/CERT-bootstrap/quality.json').status).toBe(0);f.git('add','.');f.git('commit','-m','publish bootstrap certificate');const base=f.git('rev-parse','HEAD');
      f.write('src/apps/browser/styles.css','improved');f.write('.delivery-local/mode','scoped-worker');const out='docs/evidence/PLAYER-A/quality.json';expect(f.cli('--stage','objective','--base',base,'--execute','--out',out).status).toBe(1);const incident=activeIncident(f.root,'objective/PLAYER-A')!;expect(incident).not.toBeNull();expect(f.json(out).plan.full_required).toBe(false);f.git('add','.');f.git('commit','-m','preserve failed scoped candidate and evidence');
      f.write('scripts/ci/transport.mjs','process.exit(0);');f.git('add','scripts/ci/transport.mjs');f.git('commit','-m','repair executed check dependency');f.write('.delivery-local/repair.json',JSON.stringify({diagnosis:'worker transport script exits unsuccessfully',component:'scripts/ci/transport.mjs',repair_commit:f.git('rev-parse','HEAD')}));
      const repaired=f.cli('--stage','objective','--base',base,'--incident',incident.incident_id,'--execute','--out',out,'--repair','.delivery-local/repair.json');expect(repaired.status,repaired.stderr).toBe(0);expect(activeIncident(f.root,'objective/PLAYER-A')!.state).toBe('REPAIR_CONFIRMED');f.git('add','.');f.git('commit','-m','publish proven scoped-boundary repair');
      reserveResume(f.root,incident.incident_id);f.git('add','.');f.git('commit','-m','publish original scoped incident reservation');const candidateBase=f.git('rev-parse','HEAD');
      const resumed=f.cli('--stage','objective','--base',candidateBase,'--incident',incident.incident_id,'--execute','--out',out);expect(resumed.status,resumed.stderr).toBe(0);expect(activeIncident(f.root,'objective/PLAYER-A')!.state).toBe('BLOCKED');
      f.git('add','gauntlet/incidents');f.git('commit','-m','publish consumed execution');f.git('add','docs/evidence');f.git('commit','-m','publish verified objective candidate');const candidate=f.git('rev-parse','HEAD');
      expect(closeObjectiveIncident(f.root,incident.incident_id,candidate,'PLAYER-A').state).toBe('CLOSED');f.git('add','.');f.git('commit','-m','close original scoped incident');f.write('src/main.ts','later work');f.git('add','.');f.git('commit','-m','independent later product work');expect(activeIncident(f.root,'objective/PLAYER-A')).toBeNull();
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },20000);



});
