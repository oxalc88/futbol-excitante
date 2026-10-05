import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { QUALITY_PROTOCOL, hash, digest, inputKey, type Snapshot, type ScopedPlan } from './scoped-quality.js';
import type { QualityCheck } from './product-quality.js';
import type { QualityResult } from './quality-execution.js';
export type FailureClass = 'PRODUCT_FAILURE' | 'HARNESS_ENVIRONMENT' | 'UNKNOWN';
export interface Profile { node:string; pnpm:string; vite:string; platform:string; arch:string; environment_sha256:string; installed_sha256:string }
export interface ProofReference { path:string; sha256:string; reused:boolean }
export interface ProvenResult extends QualityResult { proof?:ProofReference; failure_class?:FailureClass }
export interface CheckProof { protocol:typeof QUALITY_PROTOCOL; check:QualityCheck; key:string; profile:Profile; expected_tests:string[]; observed_tests:string[]; result:QualityResult; started_from:string; completed_at:string; log:{path:string;sha256:string}; test_report:{path:string;sha256:string}|null; producing_root:string }
export function executionProfile(root:string, tools:{node:string;pnpm:string;vite:string}):Profile {
  const versions=['vite','vitest','@vitest/browser','playwright','typescript'].map(p=>{try{return [p,JSON.parse(readFileSync(resolve(root,'node_modules',p,'package.json'),'utf8')).version];}catch{return [p,null];}});
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!['PWD','OLDPWD','SHLVL','_','GAUNTLET_ACCEPTANCE_JSON'].includes(key)&&!key.startsWith('npm_')).sort(([a],[b])=>a.localeCompare(b)));
  return {...tools,platform:process.platform,arch:process.arch,environment_sha256:digest(env),installed_sha256:digest(versions)};
}
export function testReport(bytes:Buffer|null,root:string):{files:string[];product:boolean;complete:boolean;assertions_complete:boolean} {
  if(!bytes)return {files:[],product:false,complete:false,assertions_complete:false};
  try {
    const report=JSON.parse(bytes.toString());
    const results=report.testResults;
    if(!Array.isArray(results))return {files:[],product:false,complete:false,assertions_complete:false};
    const files=results.map((r:any)=>String(r.name).replaceAll('\\','/').replace(root.replaceAll('\\','/')+'/','')).sort();
    const product=results.some((r:any)=>r.assertionResults?.some((a:any)=>a.status==='failed'));
    const assertions_complete=report.numFailedTests===0&&results.length>0&&results.every((r:any)=>r.status==='passed'&&Array.isArray(r.assertionResults)&&r.assertionResults.length>0&&r.assertionResults.every((a:any)=>a.status==='passed'));
    const complete=assertions_complete&&report.success===true&&report.numFailedTests===0&&(report.numRuntimeErrorTestSuites??0)===0&&!(report.unhandledErrors?.length)&&results.every((r:any)=>r.status==='passed'&&Array.isArray(r.assertionResults)&&r.assertionResults.length>0);
    return {files,product,complete,assertions_complete};
  }catch{return {files:[],product:false,complete:false,assertions_complete:false};}
}
export function classifyFailure(output:string,report:{product:boolean;complete:boolean},exit:number|null):FailureClass {
  if(report.product||/AssertionError|\bFAIL\s+(?:\|[^|]+\|\s+)?tests\//.test(output))return 'PRODUCT_FAILURE';
  // Transport attribution requires a complete assertion report. A timeout or
  // generic crash alone can be application-driven and remains UNKNOWN.
  if((report.complete&&/\[vitest-worker\].*Timeout calling ["']onTaskUpdate["']/.test(output))||/spawn\s+[^\n]+\s+ENOENT/.test(output))return 'HARNESS_ENVIRONMENT';
  void exit; return 'UNKNOWN';
}
export function coveragePass(check:QualityCheck,result:QualityResult,expected:string[],report:{files:string[];complete:boolean},output:string):boolean {
  if(result.status!=='PASS'||result.exit_code!==0||/Unhandled Errors?|\[vitest-worker\].*(?:Error|Timeout)|worker exited unexpectedly/i.test(output))return false;
  if(!expected.length)return !check.command.includes('vitest')&&!['regression-tests','browser-tests'].includes(check.id);
  return report.complete&&JSON.stringify(report.files)===JSON.stringify([...expected].sort());
}
export function writeCheckProof(root:string,objective:string,run:string,check:QualityCheck,result:QualityResult,source:Snapshot,profile:Profile,receipt:string,expected:string[],observed:string[],reportBytes:Buffer|null=null):ProofReference {
  if(!result.log)throw new Error('execution log required');
  const stem=`docs/evidence/${objective}/verification/${run}-${check.id.replaceAll(':','-')}`;
  const logPath=stem+'.log.gz'; const bytes=gzipSync(readFileSync(resolve(root,result.log)));
  const reportPath=stem+'.report.json.gz'; const reportGzip=reportBytes?gzipSync(reportBytes):null;
  const proof:CheckProof={protocol:QUALITY_PROTOCOL,check,key:inputKey(check,source,profile,receipt,expected),profile,expected_tests:expected,observed_tests:observed,result,started_from:execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),completed_at:new Date().toISOString(),log:{path:logPath,sha256:hash(bytes)},test_report:reportGzip?{path:reportPath,sha256:hash(reportGzip)}:null,producing_root:root};
  mkdirSync(dirname(resolve(root,stem)),{recursive:true});writeFileSync(resolve(root,logPath),bytes,{flag:'wx'});if(reportGzip)writeFileSync(resolve(root,reportPath),reportGzip,{flag:'wx'});
  const text=JSON.stringify(proof,null,2)+'\n';writeFileSync(resolve(root,stem+'.json'),text,{flag:'wx'});
  return {path:stem+'.json',sha256:hash(text),reused:false};
}
export function validateCheckProof(check:QualityCheck,row:ProvenResult,source:Snapshot,profile:Profile|undefined,receipt:string,expected:string[]):CheckProof {
  const ref=row.proof;
  if(!ref||!/^docs\/evidence\/[A-Za-z0-9._-]+\/verification\/[A-Za-z0-9._-]+\.json$/.test(ref.path))throw new Error('check proof missing or unsafe');
  const bytes=source.read(ref.path); if(!bytes||hash(bytes)!==ref.sha256)throw new Error('check proof hash mismatch');
  const proof=JSON.parse(bytes.toString()) as CheckProof;
  if(proof.protocol!==QUALITY_PROTOCOL||proof.result.id!==check.id||proof.result.status!=='PASS'||proof.result.exit_code!==0||row.status!=='PASS'||row.exit_code!==0||!Number.isFinite(proof.result.duration_ms)||proof.result.duration_ms!<0||!Number.isFinite(Date.parse(proof.completed_at))||!/^[a-f0-9]{40}$/.test(proof.started_from)||JSON.stringify(proof.check)!==JSON.stringify(check))throw new Error('ineligible check proof');
  if(profile&&JSON.stringify(profile)!==JSON.stringify(proof.profile))throw new Error('check environment changed');
  const tools=source.read('mise.toml')?.toString()??'',pkg=JSON.parse(source.read('package.json')?.toString()??'{}'),lock=source.read('pnpm-lock.yaml')?.toString()??'';
  if(!tools.includes(`node = "${proof.profile.node}"`)||!tools.includes(`pnpm = "${proof.profile.pnpm}"`)||pkg.packageManager!==`pnpm@${proof.profile.pnpm}`||!lock.includes(`version: ${proof.profile.vite}`)||!proof.profile.platform||!proof.profile.arch||!/^\w{64}$/.test(proof.profile.environment_sha256)||!/^\w{64}$/.test(proof.profile.installed_sha256))throw new Error('check profile differs from pinned candidate');
  if(proof.key!==inputKey(check,source,proof.profile,receipt,expected)||JSON.stringify(proof.expected_tests)!==JSON.stringify(expected)||JSON.stringify(proof.observed_tests)!==JSON.stringify(expected))throw new Error('stale check inputs or coverage');
  if(proof.log.path!==ref.path.replace(/\.json$/,'.log.gz'))throw new Error('check log path mismatch');
  const log=source.read(proof.log.path);if(!log||hash(log)!==proof.log.sha256)throw new Error('check log missing or changed');
  if(expected.length){const parsed=readProofReport(proof,source);if(!parsed.complete||JSON.stringify(parsed.files)!==JSON.stringify(expected))throw new Error('test execution report does not prove coverage');}
  const output=gunzipSync(log).toString();if(/Unhandled Errors?|\[vitest-worker\].*(?:Error|Timeout)|worker exited unexpectedly/i.test(output))throw new Error('runner errors invalidate proof');
  return proof;
}
export function validateScopedProofs(plan:ScopedPlan,receipt:{checks:ProvenResult[]},source:Snapshot,path:string):void {
  for(const check of plan.checks){const rows=receipt.checks.filter(r=>r.id===check.id);if(rows.length!==1)throw new Error('missing or duplicate check');validateCheckProof(check,rows[0]!,source,undefined,path,plan.expected_tests[check.id]??[]);}
}

export function readProofReport(proof:CheckProof,source:Snapshot):ReturnType<typeof testReport> {
  const ref=proof.test_report;
  if(!ref||ref.path!==proof.log.path.replace(/\.log\.gz$/,'.report.json.gz'))return testReport(null,proof.producing_root);
  const bytes=source.read(ref.path);if(!bytes||hash(bytes)!==ref.sha256)throw new Error('test report missing or changed');
  return testReport(gunzipSync(bytes),proof.producing_root);
}
export function validateFailureCause(check:QualityCheck,row:ProvenResult,source:Snapshot,expected:string[]):FailureClass {
  if(row.status!=='FAIL'||!row.proof)throw new Error('failure execution evidence missing');
  const bytes=source.read(row.proof.path);if(!bytes||hash(bytes)!==row.proof.sha256)throw new Error('failure proof hash mismatch');
  const proof=JSON.parse(bytes.toString()) as CheckProof;
  if(proof.protocol!==QUALITY_PROTOCOL||JSON.stringify(proof.check)!==JSON.stringify(check)||proof.result.status!=='FAIL'||proof.result.exit_code===0)throw new Error('invalid failure proof');
  if(proof.key!==inputKey(check,source,proof.profile,'',expected)||JSON.stringify(proof.expected_tests)!==JSON.stringify(expected))throw new Error('stale failure proof inputs');
  const log=source.read(proof.log.path);if(!log||hash(log)!==proof.log.sha256)throw new Error('failure log missing or changed');
  const parsed=readProofReport(proof,source);
  const complete=parsed.assertions_complete&&JSON.stringify(parsed.files)===JSON.stringify(expected);
  return classifyFailure(gunzipSync(log).toString(),{product:parsed.product,complete},proof.result.exit_code);
}
