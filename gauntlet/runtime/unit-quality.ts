import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { snapshot, inputKey, hash } from './scoped-quality.js';
import { qualityPreflight, spawnQualityCheck, failureDetails } from './quality-execution.js';
import { executionProfile, coveragePass, testReport, writeCheckProof, type ProvenResult } from './check-proof.js';
import { executionState, expectedUnitTests } from './integrated-execution.js';

/** Local handoff checks only. This never accepts a unit/product or certifies a repository. */
export async function executeUnitQuality(args:string[]):Promise<void> {
  const root=process.cwd(),option=(k:string)=>args[args.indexOf(k)+1],objective=option('--objective')!,id=option('--unit')!;
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(objective)||!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id))throw new Error('parent objective and unit required');
  const state=executionState(root,objective);if(!state||!state.ready.includes(id))throw new Error('unit not canonically executable');
  const unit=state.plan.units.find(u=>u.id===id)!,out=`docs/evidence/${objective}/units/${id}/local-quality.json`;
  if(!args.includes('--execute')){console.log(JSON.stringify({unit,output_path:out,acceptance:false},null,2));return;}
  const lock='.delivery-local/locks/quality.lock';mkdirSync(dirname(lock),{recursive:true});writeFileSync(lock,JSON.stringify({pid:process.pid,objective,unit:id}),{flag:'wx'});
  try {
    const profile=executionProfile(root,qualityPreflight(root)),run=`${Date.now()}-${process.pid}`,logDir=`artifacts/gauntlet/units/${objective}/${id}/${run}`;mkdirSync(logDir,{recursive:true});mkdirSync(dirname(out),{recursive:true});
    const report={schema_version:1,acceptance:false,unit_id:id,objective_id:objective,receipt_path:out,status:'RUNNING',checks:[] as ProvenResult[]};
    const save=()=>writeFileSync(out,JSON.stringify(report,null,2)+'\n');save();
    for(const check of unit.local_checks){
      if(report.status==='FAIL')break;
      const source=snapshot(root),expected=expectedUnitTests(check,source),key=inputKey(check,source,profile,out,expected),test=expected.length>0;
      const log=`${logDir}/${check.id}.log`,inventory=`${logDir}/${check.id}.report.json`;
      const execution=test?{...check,command:[...check.command,'--reporter=default','--reporter=json',`--outputFile.json=${resolve(inventory)}`]}:check;
      const row:ProvenResult=await spawnQualityCheck(root,execution,resolve(log));row.log=log;
      const bytes=existsSync(inventory)?readFileSync(inventory):null,parsed=testReport(bytes,root),output=readFileSync(log,'utf8');
      if(!coveragePass(check,row,expected,parsed,output)||key!==inputKey(check,snapshot(root),profile,out,expected)){row.status='FAIL';row.exit_code=row.exit_code===0?null:row.exit_code;Object.assign(row,failureDetails(check,row.exit_code,output));}
      row.proof=writeCheckProof(root,objective,run,check,row,snapshot(root),profile,out,expected,parsed.files,bytes);report.checks.push(row);if(row.status==='FAIL'){report.status='FAIL';process.exitCode=1;}save();
    }
    if(report.status!=='FAIL')report.status='PASS';save();console.log(JSON.stringify(report,null,2));
  }finally{rmSync(lock,{force:true});}
}
