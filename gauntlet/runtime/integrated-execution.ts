import { executionAncestor, executionCommit } from './execution-provenance.js';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validateExecutionPlan, executableUnits, type ExecutionPlan } from './execution-dag.mjs';
import { snapshot, hash, nodeTest, browserTest, type Snapshot } from './scoped-quality.js';
import { validateCheckProof, type ProvenResult } from './check-proof.js';
import { auditAppendOnly, evidence, type EvidenceRef } from './incidents.js';
export interface UnitResult { unit_id:string; base_commit:string; output_commit:string; handoff:EvidenceRef; checks:ProvenResult[]; receipt_path:string }
export function executionState(root:string,objective:string,source=snapshot(root,'HEAD')) {
  const path=`gauntlet/execution/${objective}.json`,bytes=source.read(path);if(!bytes)return null;
  const originalPlan=JSON.parse(bytes.toString()) as ExecutionPlan;
  const plan={...originalPlan,base_commit:executionAncestor(root,originalPlan.base_commit!,false,source)};if(plan.objective_id!==objective)throw new Error('execution parent mismatch');
  const order=validateExecutionPlan(plan);if(!/^[a-f0-9]{40}$/.test(plan.base_commit??''))throw new Error('canonical execution plan requires source base commit');execFileSync('git',['-C',root,'merge-base','--is-ancestor',plan.base_commit!,'HEAD']);auditAppendOnly(root,'gauntlet/execution/');
  const results=source.files.filter(p=>p.startsWith(`gauntlet/execution/${objective}/`)&&p.endsWith('.json')).map(p=>{const original=JSON.parse(source.read(p)!.toString()) as UnitResult;const row={...original,base_commit:executionCommit(root,original.base_commit,source),output_commit:executionCommit(root,original.output_commit,source)};if(!order.includes(row.unit_id)||p!==`gauntlet/execution/${objective}/${row.unit_id}.json`)throw new Error('unknown or misnamed unit settlement');return row;});
  const done:string[]=[];
  for(const id of order){
    const rows=results.filter(r=>r.unit_id===id);if(rows.length>1)throw new Error('duplicate unit settlement');if(!rows.length)continue;
    const unit=plan.units.find(u=>u.id===id)!,row=rows[0]!;
    if(unit.dependencies.some(d=>!done.includes(d))||!/^[a-f0-9]{40}$/.test(row.output_commit))throw new Error('unsettled unit dependency/provenance');
    if(!/^[a-f0-9]{40}$/.test(row.base_commit)||!/^[a-f0-9]{40}$/.test(plan.base_commit??''))throw new Error('unit needs canonical plan base and full output range');
    execFileSync('git',['-C',root,'merge-base','--is-ancestor',row.base_commit,row.output_commit]);
    let integrated=plan.base_commit!;
    for(const dependency of unit.dependencies){const result=results.find(r=>r.unit_id===dependency)!;execFileSync('git',['-C',root,'merge-base','--is-ancestor',result.output_commit,row.base_commit]);
      const merge=execFileSync('git',['-C',root,'merge-tree','--write-tree',integrated,result.output_commit],{encoding:'utf8'}).trim().split('\n')[0]!;
      // Persist a deterministic temporary merge object in Git's object store only.
      integrated=execFileSync('git',['-C',root,'-c','user.name=Gauntlet','-c','user.email=gauntlet@local','commit-tree',merge,'-p',integrated,'-p',result.output_commit],{input:'deterministic dependency integration\n',encoding:'utf8'}).trim();
    }
    const expectedTree=execFileSync('git',['-C',root,'rev-parse',`${integrated}^{tree}`],{encoding:'utf8'}).trim(),actualTree=execFileSync('git',['-C',root,'rev-parse',`${row.base_commit}^{tree}`],{encoding:'utf8'}).trim();
    if(expectedTree!==actualTree){const difference=execFileSync('git',['-C',root,'diff','--name-only',integrated,row.base_commit],{encoding:'utf8'}).trim().split('\n').filter(Boolean);if(difference.some(p=>p!==path&&!p.startsWith(`gauntlet/execution/${objective}/`)))throw new Error('unit base must be exact deterministic dependency integration with canonical plan bookkeeping only');}
    const target=snapshot(root,row.output_commit),overlay:Snapshot={files:target.files,read:p=>target.read(p)??source.read(p)};
    const changed=execFileSync('git',['-C',root,'log','--format=','--name-only',`${row.base_commit}..${row.output_commit}`],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
    const owns=(p:string)=>unit.expected_file_ownership.some(pattern=>pattern.endsWith('/**')?p.startsWith(pattern.slice(0,-2)):p===pattern);
    if(!changed.length||changed.some(p=>!owns(p)&&!p.startsWith(`docs/evidence/${objective}/units/${id}/`)&&!p.startsWith(`docs/evidence/${objective}/verification/`)))throw new Error('unit output violates declared ownership');
    evidence(overlay,row.handoff);
    for(const check of unit.local_checks){const proof=row.checks.filter(r=>r.id===check.id);if(proof.length!==1)throw new Error('unit local check missing');const proofBytes=overlay.read(proof[0]!.proof?.path??'');if(!proofBytes)throw new Error('unit proof missing');const expected=expectedUnitTests(check,target);validateCheckProof(check,proof[0]!,overlay,undefined,row.receipt_path,expected);}
    done.push(id);
  }
  return {plan,reference:{path,sha256:hash(bytes)},results,completed:done,...executableUnits(plan,done)};
}
export function validateIntegratedExecution(root:string,objective:string,ref='HEAD'):EvidenceRef|null {
  const pending=ref==='WORKTREE',source=snapshot(root,pending?undefined:ref),state=executionState(root,objective,source);if(!state)return null;
  if(!state.all_complete)throw new Error('execution units must integrate before product acceptance');
  const mergePath=execFileSync('git',['-C',root,'rev-parse','--git-path','MERGE_HEAD'],{encoding:'utf8'}).trim(),absoluteMerge=mergePath.startsWith('/')?mergePath:`${root}/${mergePath}`;
  const heads=[pending?'HEAD':ref,...(pending&&existsSync(absoluteMerge)?readFileSync(absoluteMerge,'utf8').trim().split('\n'):[])];
  const contains=(output:string,commit:string)=>{try{execFileSync('git',['-C',root,'merge-base','--is-ancestor',output,commit],{stdio:'pipe'});return true;}catch{return false;}};
  for(const result of state.results){if(!heads.some(head=>contains(result.output_commit,head)))throw new Error('unit output absent from integrated candidate ancestry');if(hash(source.read(result.handoff.path)??'')!==result.handoff.sha256)throw new Error('integrated handoff differs from settled unit');}
  const history=execFileSync('git',['-C',root,'rev-list','--reverse','--first-parent',`${state.plan.base_commit}..${pending?'HEAD':ref}`],{encoding:'utf8'}).trim().split('\n');let previous=-1;
  for(const id of state.integration_order){const output=state.results.find(r=>r.unit_id===id)!.output_commit;let index=history.findIndex(commit=>contains(output,commit));if(index<0&&pending&&heads.slice(1).some(head=>contains(output,head)))index=history.length;if(index<previous||index<0)throw new Error('units must integrate in deterministic plan order');previous=index;}
  return state.reference;
}

export function expectedUnitTests(check:{id:string;command:string[]},source:Snapshot):string[] {
  const command=check.command.join(' ');
  if(command==='pnpm run test')return source.files.filter(nodeTest);
  if(command==='pnpm run test-browser')return source.files.filter(browserTest);
  if(check.command.includes('vitest')){
    if(!check.command.includes('run')||!check.command.includes('--project')||check.command.some(a=>/skip|passWithNoTests=true|testNamePattern|exclude/.test(a)))throw new Error('unit verification must execute exact required inventory');
    const project=check.command[check.command.indexOf('--project')+1];if(!['node','browser'].includes(project!))throw new Error('unknown unit test project');
    const filters=check.command.filter(a=>a.startsWith('tests/'));const inventory=source.files.filter(project==='node'?nodeTest:browserTest).filter(p=>!filters.length||filters.some(f=>p.includes(f)));
    if(!inventory.length)throw new Error('unit test inventory empty');return inventory;
  }
  return [];
}
