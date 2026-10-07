import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fixture } from '../../tests/helpers/gauntlet-quality.js';
import { repairExecutionProvenance } from '../../gauntlet/runtime/execution-provenance.js';
import { executionState, validateIntegratedExecution } from '../../gauntlet/runtime/integrated-execution.js';
import { activeIncident, incidentEvents, currentEvidenceAvailable, validateRepairCommit } from '../../gauntlet/runtime/incidents.js';
import { routineContinuation, stopRecord, auditStopRecords } from '../../gauntlet/runtime/continuation.js';
import { certificationHealth, verifyObjectiveAdmission } from '../../gauntlet/runtime/certification.js';

const repo=process.cwd(),published='a0f61618161600f9a887b7287d417686a86e60ef';
const id='33cba31914e91e5b070e2e5f0aee7130af86c47c9005474b136fa4bc3adbb895';
const stop='gauntlet/incidents/stop-c8245ea19a56dfdb320d3c56399f846cf8270abe2162b1f01ca42cd0dc758048.json';
// Slow, complete-history reproduction runs directly under the canonical check
// limits, outside Vitest's synchronous worker/RPC channel. No timeout is raised.
// The deterministic command transport tests policy and coverage binding only;
// it is explicitly not a real product certificate.
for(const mode of process.argv.includes('--portable-only')?[]:['pass','unknown']){
  const f=fixture(),root=join(f.dir,'published');
  try{
    execFileSync('git',['clone','--shared','--no-checkout',repo,root],{stdio:'pipe'});
    const git=(...args:string[])=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:'pipe'}).trim();
    git('checkout','-b','replay',published);git('config','user.name','replay');git('config','user.email','replay@local');git('branch','--set-upstream-to=origin/main');
    const json=(p:string)=>JSON.parse(readFileSync(join(root,p),'utf8'));
    const cli=(...args:string[])=>spawnSync(process.execPath,['--import',join(repo,'node_modules/tsx/dist/loader.mjs'),join(repo,'scripts/gauntlet/product-quality.ts'),...args],{cwd:root,encoding:'utf8',env:{...process.env,PATH:`${join(f.dir,'bin')}:${process.env.PATH}`}});
    const old=readFileSync(join(root,stop)),event=activeIncident(root,'repository/full')!,budget=event.recovery.budget;
    assert.equal(event.incident_id,id);assert.equal(event.kind,'REPAIR_FAILED');assert.equal(event.state,'BLOCKED');assert.equal(budget!.repair_attempts,2);
    assert.equal(incidentEvents(root).filter(e=>e.kind==='DIAGNOSE').length,1);
    assert.equal(certificationHealth(root).latest,null);assert.equal(certificationHealth(root).latest_attempt!.status,'RECOVERY_BLOCKED');
    assert.throws(()=>git('merge-base','--is-ancestor','f796a548d61f7c45112d292112fdaea488b32e69','HEAD'));
    assert.throws(()=>executionState(root,'PLAYER-CONTROLS-REFERENCE'),/EXECUTION_PROVENANCE_REPAIRABLE/);
    assert.throws(()=>validateRepairCommit(root,'babf42c4a50d726f0966f8a9a254f67a512e583f'),/only verification machinery/);
    assert.equal(auditStopRecords(root),1);
    assert.equal(routineContinuation(root),'PUBLISH_BOOKKEEPING');assert.deepEqual(repairExecutionProvenance(root),[]);
    git('add','gauntlet/execution/provenance');git('commit','-m','publish exact-tree provenance recovery');
    assert.equal(executionState(root,'PLAYER-CONTROLS-REFERENCE')!.all_complete,true);validateIntegratedExecution(root,'PLAYER-CONTROLS-REFERENCE');
    assert.equal(currentEvidenceAvailable(root,event),true);assert.equal(routineContinuation(root),'CERTIFY_CURRENT');assert.throws(()=>stopRecord(root,json(stop)),/continue automatically/);
    const out='docs/evidence/CERT-current-replay/quality.json';
    mkdirSync(join(root,'node_modules/vite'),{recursive:true});writeFileSync(join(root,'node_modules/vite/package.json'),'{"version":"6.4.3"}');
    mkdirSync(join(root,'.delivery-local'),{recursive:true});writeFileSync(join(root,'.delivery-local/mode'),mode);
    const result=cli('--stage','certification','--execute','--out',out);assert.equal(result.status,mode==='pass'?0:1,result.stderr);
    const receipt=json(out);assert.ok(receipt.metrics.executed_checks>0);assert.equal(receipt.plan.full_required,true);assert.equal(receipt.incident_id,id);
    assert.equal(receipt.checks.find((c:any)=>c.id==='regression-tests').status,mode==='pass'?'PASS':'FAIL');
    git('add','gauntlet/incidents','gauntlet/certification','docs/evidence/CERT-current-replay');git('commit','-m','publish current evidence');
    const history=incidentEvents(root).filter(e=>e.incident_id===id);
    assert.equal(history.filter(e=>e.kind==='OBSERVE').length,1);assert.equal(history.at(-1)!.state,'BLOCKED');assert.equal(history.at(-1)!.failure_class,'UNKNOWN');
    for(const e of history)assert.deepEqual(e.recovery.budget,budget);
    assert.deepEqual(readFileSync(join(root,stop)),old);assert.equal(currentEvidenceAvailable(root,history.at(-1)!),false);
    if(mode==='pass'){
      assert.equal(activeIncident(root,'repository/full'),null);assert.equal(certificationHealth(root).latest!.status,'PASS');
      verifyObjectiveAdmission(root,git('rev-parse','HEAD'),{full_required:false},'PLAYER-CONTROLS-REFERENCE');
      // Incomplete/widened receipt plans cannot use the historical v1 binding.
      const { validateCurrentCertificate }=await import('../../gauntlet/runtime/incidents.js');
      const { snapshot }=await import('../../gauntlet/runtime/scoped-quality.js');
      const forged=structuredClone(receipt);forged.plan.checks=forged.plan.checks.filter((c:any)=>c.id!=='browser-tests');
      assert.throws(()=>validateCurrentCertificate(root,forged,snapshot(root)),/coverage differs/);
    }else{
      assert.equal(activeIncident(root,'repository/full')!.state,'BLOCKED');
      const blocked=cli('--stage','certification','--execute','--out','docs/evidence/CERT-no-retry/quality.json');assert.equal(blocked.status,1);
      assert.equal(json('docs/evidence/CERT-no-retry/quality.json').metrics.executed_checks,0);
    }
    console.log(JSON.stringify({published,transport:'deterministic policy fixture, not product certification',case:mode,checks:receipt.checks.map((c:any)=>({id:c.id,status:c.status})),executed:receipt.metrics.executed_checks,legacy_state:history.at(-1)!.state,legacy_failure_class:history.at(-1)!.failure_class,budget,provenance:'whole-tree verified',stop:'preserved; new stop refused while current evidence available',result:'REPRODUCED'}));
  }finally{rmSync(f.dir,{recursive:true,force:true});}
}

// Recovered orphan identities must also work from an ordinary network-style
// clone; shared local object stores cannot stand in for published provenance.
{
  const f=fixture(),root=join(f.dir,'portable');
  try{
    execFileSync('git',['clone','--no-local','--no-checkout',repo,root],{stdio:'pipe'});
    execFileSync('git',['-C',root,'checkout','--detach',published],{stdio:'pipe'});
    const original='f796a548d61f7c45112d292112fdaea488b32e69';
    assert.throws(()=>execFileSync('git',['-C',root,'cat-file','-e',original],{stdio:'pipe'}));
    const path=`gauntlet/execution/provenance/${original}.json`;
    mkdirSync(join(root,'gauntlet/execution/provenance'),{recursive:true});writeFileSync(join(root,path),readFileSync(join(repo,path)));
    const { executionAncestor }=await import('../../gauntlet/runtime/execution-provenance.js');
    assert.equal(executionAncestor(root,original),JSON.parse(readFileSync(join(root,path),'utf8')).ancestor_commit);
    console.log(JSON.stringify({case:'fresh-clone-without-orphans',published,original,result:'REPRODUCED'}));
  }finally{rmSync(f.dir,{recursive:true,force:true});}
}
