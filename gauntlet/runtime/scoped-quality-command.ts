import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { snapshot, scopedPlan, hash, digest, verificationArtifact, bookkeeping, inputKey } from './scoped-quality.js';
import { executionProfile, testReport, coveragePass, classifyFailure, writeCheckProof, validateCheckProof, type ProvenResult, type FailureClass } from './check-proof.js';
import { qualityPlan } from './product-quality.js';
import { verifyObjectiveAdmission } from './certification.js';
import { qualityPreflight, qualityTimeout, spawnQualityCheck, rememberFailure, repairCheck, requireRepairProof, initializeRecoveryBudget, recoveryTimeRemaining, reserveRepairAttempt, RecoveryBlockedError, failureDetails, type QualityRecovery } from './quality-execution.js';

export async function executeScopedQuality(args:string[]):Promise<void> {
  const root=process.cwd(),option=(k:string)=>args[args.indexOf(k)+1];
  const git=(...argv:string[])=>execFileSync('git',argv,{cwd:root,encoding:'utf8',stdio:'pipe'}).trim();
  const certification=option('--stage')==='certification'&&args.includes('--stage');
  if(args.includes('--stage')&&!['objective','certification'].includes(option('--stage')!))throw new Error('invalid quality proof scope');
  const head=args.includes('--head')?git('rev-parse',`${option('--head')}^{commit}`):undefined;
  const target=certification?git('rev-parse',`${args.includes('--target')?option('--target'):'HEAD'}^{commit}`):null;
  const base=git('rev-parse',`${args.includes('--base')?option('--base'):target??'HEAD'}^{commit}`);
  if(!certification&&!args.includes('--base'))throw new Error('--base required for objective quality');
  if(args.includes('--expected-paths')&&args.includes('--execute'))throw new Error('expected paths are advisory only');
  if(args.includes('--repair')&&!args.includes('--execute'))throw new Error('--repair requires --execute');
  const out=args.includes('--out')?option('--out'):undefined;
  const objective=out?.match(/^docs\/evidence\/([A-Za-z0-9._-]+)\/quality\.json$/)?.[1];
  if(args.includes('--execute')&&(!objective||objective==='.'||objective==='..'||head||certification&&!objective.startsWith('CERT-')))throw new Error('execution requires docs/evidence/OBJECTIVE/quality.json (CERT- prefix for certification); --head is read-only');
  if(certification&&target!==git('rev-parse','HEAD'))throw new Error('Certification must freeze current HEAD');
  let paths=args.includes('--expected-paths')?JSON.parse(readFileSync(option('--expected-paths')!,'utf8')):git('diff','--name-only',base,...(head?[head]:[])).split('\n').filter(Boolean);
  if(!head&&!args.includes('--expected-paths'))paths.push(...git('ls-files','--others','--exclude-standard').split('\n').filter(Boolean));
  const before=snapshot(root,base),after=snapshot(root,head);
  const scope=[...new Set<string>(paths)].filter(p=>p!==out&&!bookkeeping(p)&&!verificationArtifact(p)).sort();
  if(certification&&scope.length)throw new Error('Commit all certification inputs before freezing HEAD');
  for(const p of paths as string[])if(verificationArtifact(p)&&before.files.includes(p))throw new Error('accepted verification evidence is immutable');
  const elevated=args.includes('--elevated-risk')||scope.some(p=>/^docs\/(evidence|screenshots)\//.test(p)&&before.files.includes(p));
  const plan=scopedPlan(scope,before,after,elevated,args.includes('--architecture-changed'),certification);
  const hashes=Object.fromEntries(scope.map(p=>[p,hash(after.read(p)??'<deleted>')]));
  const report={schema_version:2,horizon:(after.read('gauntlet/state/HORIZON.md')?.toString().match(/^horizon_version:\s*(\d+)/m)?.[1]??null),output_path:out,proof_scope:plan.proof_scope,base_commit:base,target_commit:target,elevated_risk:elevated,architecture_changed:args.includes('--architecture-changed'),plan,source_hashes:hashes,execution_mode:args.includes('--repair')?'repair':'full',status:'NOT_RUN',failure_class:null as FailureClass|null,checks:plan.checks.map(c=>({id:c.id,status:'NOT_RUN',exit_code:null,log:null,duration_ms:null} as ProvenResult)),recovery_budget:null as QualityRecovery['budget']|null,blocked_reason:null as string|null,metrics:{executed_checks:0,reused_checks:0,verification_ms:0,full_suite_executions:0,wall_ms:0},started_at:new Date().toISOString(),executed_commands:[] as Array<{id:string;command:string[];input_key:string;duration_ms:number|null;exit_code:number|null}>};
  if(args.includes('--execute')&&existsSync(`docs/evidence/${objective}/manifest.json`))throw new Error('accepted objective evidence is immutable');
  if(!args.includes('--execute')){console.log(JSON.stringify({...report,advisory:args.includes('--expected-paths')},null,2));return;}
  const local=certification?'.delivery-local/quality/repository/certification':`.delivery-local/quality/${objective}/${plan.proof_scope}`;mkdirSync(local,{recursive:true});
  // A worktree has one quality publisher. Parallel builders retain isolated
  // worktrees; this is not a scheduling/concurrency governor.
  const lock='.delivery-local/quality/runner.lock';
  try{writeFileSync(lock,JSON.stringify({pid:process.pid,objective,scope:plan.proof_scope})+'\n',{flag:'wx'});}catch{throw new Error('QUALITY_BUSY: another quality run or interrupted publication owns this worktree; inspect the lock owner before recovery');}
  try {
  const recoveryPath=`${local}/recovery.json`,cachePath=`${local}/checks.json`;
  const save=(path:string,value:unknown)=>{mkdirSync(dirname(path),{recursive:true});writeFileSync(path+'.tmp',JSON.stringify(value,null,2)+'\n');renameSync(path+'.tmp',path);};
  const saveReport=()=>save(out!,report);
  let recovery:QualityRecovery|null=null,cache:ProvenResult[]=existsSync(cachePath)?JSON.parse(readFileSync(cachePath,'utf8')):[];
  if(!Array.isArray(cache))throw new Error('invalid local proof index');
  saveReport();
  try {
    if(!certification)verifyObjectiveAdmission(root,base,plan,objective!);
    const tools=qualityPreflight(root),profile=executionProfile(root,tools);
    if(existsSync(recoveryPath)){
      recovery=JSON.parse(readFileSync(recoveryPath,'utf8'));
      const allowed=plan.checks.find(c=>c.id===recovery?.failure.check.id);
      if(!recovery||recovery.schema_version!==1||!allowed||JSON.stringify(allowed.command)!==JSON.stringify(recovery.failure.check.command)||!/^[a-f0-9]{64}$/.test(recovery.failure.signature))throw new Error('invalid quality recovery record');
      initializeRecoveryBudget(recovery);save(recoveryPath,recovery);recoveryTimeRemaining(recovery);
    }
    // Old broad recovery is preserved byte-for-byte as diagnostics. It never
    // grants new-scope PASS and is not deleted/reset. A new required full plan
    // still honors the old budget; bounded objectives do not inherit unrelated certification incidents.
    const oldPath=`.delivery-local/quality/${objective}/recovery.json`;
    if(!recovery&&plan.full_required&&existsSync(oldPath)){
      const old=JSON.parse(readFileSync(oldPath,'utf8')) as QualityRecovery;
      const allowed=qualityPlan(['gauntlet/runtime/quality-execution.ts']).checks.find(c=>c.id===old.failure?.check?.id);
      if(!allowed||JSON.stringify(allowed.command)!==JSON.stringify(old.failure.check.command))throw new Error('invalid quality recovery record');
      initializeRecoveryBudget(old);recoveryTimeRemaining(old);
      recovery={...old,failure:{...old.failure,check:plan.checks.find(c=>c.id===old.failure.check.id)??old.failure.check}};save(recoveryPath,recovery);
    }
    const context=digest({base,plan,hashes,profile});
    const repair=args.includes('--repair');let checks=plan.checks,whole=false,diagnosis='';
    if(repair){
      if(!recovery)throw new Error('No prior scoped failure to repair');
      diagnosis=JSON.parse(readFileSync(option('--repair')!,'utf8')).diagnosis;
      if(typeof diagnosis!=='string'||!diagnosis.trim())throw new Error('written diagnosis required');
      const focused=repairCheck(recovery);reserveRepairAttempt(recovery);save(recoveryPath,recovery);checks=[focused.check];whole=focused.whole_check;
    }else requireRepairProof(recovery,context);
    const run=`${Date.now()}-${process.pid}`;const logDir=`artifacts/gauntlet/quality/${objective}/${run}`;mkdirSync(logDir,{recursive:true});
    report.status='RUNNING';saveReport();let failed=false;
    for(const check of checks){
      if(failed)break;
      const expected=plan.expected_tests[check.id]??[],canonical=plan.checks.find(c=>c.id===check.id)!;
      const same=JSON.stringify(check.command)===JSON.stringify(canonical.command);
      const current=snapshot(root);
      const cached=cache.find(r=>r.id===check.id);
      if(!repair&&cached&&check.id!=='state-audit'){try{const proof=validateCheckProof(check,cached,current,profile,out!,expected);const row={...proof.result,proof:{...cached.proof!,reused:true}};report.checks=report.checks.map(r=>r.id===row.id?row:r);report.metrics.reused_checks++;saveReport();continue;}catch{/* Execute uncovered/invalid input instead. */}}
      const inventoryFile=`${logDir}/${check.id.replace(':','-')}.vitest.json`;
      const test=check.id==='regression-tests'||check.id==='browser-tests'||check.id.startsWith('domain:');
      const execution=test?{...check,command:[...check.command,'--reporter=default','--reporter=json',`--outputFile.json=${resolve(inventoryFile)}`]}:check;
      const log=`${logDir}/${check.id.replace(':','-')}.log`;
      const initialKey=inputKey(canonical,current,profile,out!,expected);
      const result=await spawnQualityCheck(root,execution,resolve(log),qualityTimeout(check,recovery));result.log=log;
      const output=readFileSync(log,'utf8');const reportBytes=existsSync(inventoryFile)?readFileSync(inventoryFile):null;const parsed=testReport(reportBytes,root);
      const focusedExpected=same?expected:check.command.filter(p=>p.startsWith('tests/')).sort();
      if(!coveragePass(check,result,focusedExpected,parsed,output)||inputKey(canonical,snapshot(root),profile,out!,expected)!==initialKey){result.status='FAIL';result.exit_code=result.exit_code===0?null:result.exit_code;Object.assign(result,failureDetails(check,result.exit_code,output+'\nError: incomplete coverage, unhandled runner errors or changed inputs'));}
      report.metrics.executed_checks++;report.metrics.verification_ms+=result.duration_ms??0;if(check.command.join(' ')==='pnpm run test')report.metrics.full_suite_executions++;report.executed_commands.push({id:check.id,command:check.command,input_key:inputKey(check,current,profile,out!,focusedExpected),duration_ms:result.duration_ms,exit_code:result.exit_code});
      if(recovery)recoveryTimeRemaining(recovery);
      const row:ProvenResult={...result};
      if(result.status==='PASS'&&same){row.proof=writeCheckProof(root,objective!,run,canonical,result,snapshot(root),profile,out!,expected,parsed.files,reportBytes);cache=cache.filter(r=>r.id!==check.id).concat(row);save(cachePath,cache);}
      if(!repair)report.checks=report.checks.map(r=>r.id===row.id?row:r);
      process.stderr.write(`${check.id}: ${row.status}\n`);saveReport();
      if(row.status==='FAIL'){
        row.failure_class=classifyFailure(output,{product:parsed.product,complete:parsed.assertions_complete&&JSON.stringify(parsed.files)===JSON.stringify(expected)},row.exit_code);
        row.proof=writeCheckProof(root,objective!,run,canonical,row,snapshot(root),profile,out!,expected,parsed.files,reportBytes);report.failure_class=row.failure_class;
        recovery=rememberFailure(recovery,canonical,row);save(recoveryPath,recovery);report.status='FAIL';failed=true;process.exitCode=1;
        if(recovery.budget!.repair_attempts>=2)throw new RecoveryBlockedError('RECOVERY_BLOCKED: repair attempts exhausted');
      }
    }
    if(!failed&&repair){recovery!.repair={context_hash:context,signature:recovery!.failure.signature,diagnosis,whole_check:whole};save(recoveryPath,recovery);report.status='REPAIR_PASS';}
    else if(!failed){report.status='PASS';rmSync(recoveryPath,{force:true});}
    report.recovery_budget=recovery?.budget??null;saveReport();
  }catch(error){report.status=error instanceof RecoveryBlockedError?'RECOVERY_BLOCKED':'BLOCKED';report.blocked_reason=String(error);report.recovery_budget=recovery?.budget??null;saveReport();save(`${local}/blocked.json`,{status:report.status,reason:report.blocked_reason,scope:plan.proof_scope,recovery,receipt:out});process.stderr.write(String(error)+'\n');process.exitCode=1;}
  // One append-only stream; certificate publication remains a separate
  // serialized bookkeeping commit. No canonical state is accepted by this CLI.
  report.metrics.wall_ms=Date.now()-Date.parse(report.started_at);saveReport();
  const archive=`docs/evidence/${objective}/verification/${Date.now()}-${process.pid}-receipt.json`;mkdirSync(dirname(archive),{recursive:true});writeFileSync(archive,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  if(certification&&!args.includes('--repair')){
    const horizon=after.read('gauntlet/state/HORIZON.md')?.toString().match(/^horizon_version:\s*(\d+)/m)?.[1];
    const record={schema_version:1,target_commit:target,recorded_at:new Date().toISOString(),status:report.status,failure_class:report.failure_class,receipt:{path:archive,sha256:hash(readFileSync(archive))},horizon:horizon?`v${horizon}`:null};
    const file=`gauntlet/certification/${Date.now()}-${process.pid}.json`;mkdirSync(dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  }
  console.log(JSON.stringify(report,null,2));
  } finally {rmSync(lock,{force:true});}
}
