import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import type { Snapshot } from './scoped-quality.js';
import { dirname } from 'node:path';

/** Recover rebased execution anchors by exact whole-tree identity, never a label
 * or patch similarity. The original commits and receipts remain authoritative. */
export function executionAncestor(root:string, original:string, persist=false,source?:Snapshot):string {
  const git=(...args:string[])=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:'pipe'}).trim();
  if(!/^[a-f0-9]{40}$/.test(original))throw new Error('full execution commit required');
  try{git('merge-base','--is-ancestor',original,'HEAD');return original;}catch{/* Recover only from existing Git objects. */}
  const path=`gauntlet/execution/provenance/${original}.json`;
  let ancestor:string,tree:string;
  const record=source?source.read(path):(existsSync(`${root}/${path}`)?readFileSync(`${root}/${path}`):null);
  if(record){
    const row=JSON.parse(record.toString());
    const object=row.original_commit_object;
    if(typeof object!=='string'||execFileSync('git',['-C',root,'hash-object','-t','commit','--stdin'],{input:object,encoding:'utf8'}).trim()!==original)throw new Error('original commit object differs');
    tree=object.match(/^tree ([a-f0-9]{40})\n/)?.[1]??'';
    if(row.schema_version!==1||row.original_commit!==original||row.tree!==tree||!/^[a-f0-9]{40}$/.test(row.ancestor_commit))throw new Error('invalid execution provenance recovery');
    ancestor=row.ancestor_commit;
  }else{
    let object:string;
    try{tree=git('rev-parse',`${original}^{tree}`);object=execFileSync('git',['-C',root,'cat-file','commit',original],{encoding:'utf8',stdio:'pipe'});}
    catch{throw new Error(`EXECUTION_PROVENANCE_MISSING: original object ${original} unavailable; regenerate unit evidence`);}
    // Closest reachable identical tree is a deterministic choice; no guessed SHA.
    const rows=git('log','--format=%H %T','HEAD').split('\n');
    ancestor=rows.find(row=>row.split(' ')[1]===tree)?.split(' ')[0]??'';
    if(!ancestor)throw new Error(`EXECUTION_PROVENANCE_MISSING: no reachable identical tree for ${original}; regenerate unit evidence`);
    if(persist){mkdirSync(dirname(`${root}/${path}`),{recursive:true});writeFileSync(`${root}/${path}`,JSON.stringify({schema_version:1,original_commit:original,ancestor_commit:ancestor,tree,original_commit_object:object},null,2)+'\n',{flag:'wx'});}
    else throw new Error(`EXECUTION_PROVENANCE_REPAIRABLE: recover identical tree for ${original}`);
  }
  git('merge-base','--is-ancestor',ancestor,'HEAD');
  if(git('rev-parse',`${ancestor}^{tree}`)!==tree)throw new Error('execution recovery tree differs');
  return ancestor;
}
export function executionCommit(root:string,original:string,source?:Snapshot):string {
  // Unintegrated native unit branches legitimately have outputs outside HEAD.
  // Their ancestry is checked at integration, not local settlement.
  const path=`gauntlet/execution/provenance/${original}.json`;
  if(source?source.read(path):existsSync(`${root}/${path}`))return executionAncestor(root,original,false,source);
  try{execFileSync('git',['-C',root,'rev-parse',`${original}^{commit}`],{stdio:'pipe'});return original;}
  catch{throw new Error(`EXECUTION_PROVENANCE_MISSING: unit object ${original} unavailable; regenerate unit evidence`);}
}
export function repairExecutionProvenance(root:string):string[] {
  const git=(...args:string[])=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:'pipe'}).trim();
  const paths=git('ls-files','gauntlet/execution').split('\n').filter(p=>p.endsWith('.json')&&!p.startsWith('gauntlet/execution/provenance/'));
  const repaired:string[]=[];
  for(const path of paths){const row=JSON.parse(readFileSync(`${root}/${path}`,'utf8'));for(const commit of [row.base_commit,row.output_commit].filter(Boolean)){
    const recovery=`gauntlet/execution/provenance/${commit}.json`,existed=existsSync(`${root}/${recovery}`);
    try{executionAncestor(root,commit,true);}catch(error){
      // Native unit outputs can legitimately await integration on another branch.
      if(row.unit_id&&String(error).includes('EXECUTION_PROVENANCE_MISSING'))executionCommit(root,commit);else throw error;
    }
    if(!existed&&existsSync(`${root}/${recovery}`))repaired.push(recovery);
  }}
  return repaired;
}
