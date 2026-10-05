import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { snapshot, scopedPlan, inputKey, hash, type Snapshot } from '../../gauntlet/runtime/scoped-quality.js';
import { classifyFailure, testReport, validateScopedProofs } from '../../gauntlet/runtime/check-proof.js';
import { certificationHealth, verifyObjectiveAdmission, requireMilestoneCertificate, verificationMeasurements } from '../../gauntlet/runtime/certification.js';
import { rememberFailure } from '../../gauntlet/runtime/quality-execution.js';
import { qualityPlan } from '../../gauntlet/runtime/product-quality.js';
import { verifyCandidateQuality } from '../../gauntlet/runtime/candidate-quality.js';
const memory=(files:Record<string,string>):Snapshot=>({files:Object.keys(files).sort(),read:p=>p in files?Buffer.from(files[p]!):null});
const files={ 'tests/architecture/core.test.ts':'', 'tests/unit/gauntlet-fixture.test.ts':'', 'tests/unit/ball/physics.test.ts':"import '../../../src/simulation/ball/physics.js';", 'tests/unit/loop/rules.test.ts':"import '../../../src/simulation/card-policy.js';", 'tests/browser/game.browser.test.ts':'', 'src/simulation/ball/physics.ts':'', 'src/simulation/card-policy.ts':'' };

describe('0.12 deterministic scope and failure semantics',()=>{
  it('selects a baseline and real affected imports, keeps full barriers and complete certification',()=>{
    const before=memory(files),after=memory({...files,'src/simulation/card-policy.ts':'after'});
    const css=scopedPlan(['src/apps/browser/styles.css'],before,after);
    expect(css.full_required).toBe(false);expect(css.expected_tests['regression-tests']).not.toContain('tests/unit/ball/physics.test.ts');expect(css.checks.some(c=>c.id==='browser-tests')).toBe(true);
    const local=scopedPlan(['src/simulation/card-policy.ts','tests/unit/loop/rules.test.ts'],before,after);
    expect(local.full_required).toBe(false);expect(local.expected_tests['regression-tests']).toContain('tests/unit/loop/rules.test.ts');expect(local.suite_ids).toEqual(['fast','fouls','rules']);expect(local.reviews_required).toBe(true);
    for(const p of ['src/simulation/loop/simulation.ts','src/adapters/replay/read.ts','vitest.config.ts','unknown.ts'])expect(scopedPlan([p],before,after).full_required).toBe(true);
    const full=scopedPlan([],before,after,false,false,true);expect(full.expected_tests['regression-tests']).toContain('tests/unit/ball/physics.test.ts');expect(full.checks.map(c=>c.id)).toContain('browser-tests');expect(full.proof_scope).toBe('certification');
  });
  it('uses both snapshots and escalates unknown dynamic or removed dependencies',()=>{
    const before=memory({...files,'tests/unit/removed.test.ts':"import '../../src/old.js';",'src/old.ts':''});
    const after=memory({...files,'tests/unit/removed.test.ts':"import '../../src/new.js';",'src/new.ts':''});
    expect(scopedPlan(['src/old.ts'],before,after).full_required).toBe(true);
    const dynamic=memory({...files,'tests/unit/dynamic.test.ts':'const moduleName="x"; import(moduleName);'});
    expect(scopedPlan(['src/simulation/card-policy.ts'],dynamic,dynamic).full_required).toBe(true);
  });
  it('keeps build/type/browser proof independent of an unrelated Node launcher repair where closure is known',()=>{
    const data={...files,'package.json':'{"scripts":{"build":"vite build"}}','index.html':'<script src="/src/main.ts"></script>','src/main.ts':'','vite.config.ts':'','tests/capture.node.test.ts':'before'};
    const a=memory(data),b=memory({...data,'tests/capture.node.test.ts':'after'});
    for(const id of ['build','typecheck','browser-tests'])expect(inputKey({id,command:['run',id]},a,{},'quality.json',[])).toBe(inputKey({id,command:['run',id]},b,{},'quality.json',[]));
    expect(inputKey({id:'regression-tests',command:['run','tests']},a,{},'quality.json',[])).not.toBe(inputKey({id:'regression-tests',command:['run','tests']},b,{},'quality.json',[]));
    expect(inputKey({id:'build',command:['run','build']},a,{runtime:'one'},'quality.json',[])).not.toBe(inputKey({id:'build',command:['run','build']},a,{runtime:'two'},'quality.json',[]));
  });
  it('never turns a timeout, mixed assertion error or worker error into PASS',()=>{
    expect(classifyFailure('Error: quality check timeout',{product:false,complete:false},null)).toBe('UNKNOWN');
    expect(classifyFailure('[vitest-worker] Timeout calling "onTaskUpdate"',{product:false,complete:true},1)).toBe('HARNESS_ENVIRONMENT');
    expect(classifyFailure('AssertionError [vitest-worker] Timeout calling "onTaskUpdate"',{product:false,complete:true},1)).toBe('PRODUCT_FAILURE');
    const parsed=testReport(Buffer.from(JSON.stringify({success:false,numFailedTests:0,numRuntimeErrorTestSuites:1,testResults:[{name:'/repo/tests/x.test.ts',status:'passed',assertionResults:[{status:'passed'}]}]})),'/repo');
    expect(parsed.complete).toBe(false);expect(parsed.assertions_complete).toBe(true);
  });
});

function fixture(){
  const dir=mkdtempSync(join(tmpdir(),'gauntlet012-')),root=join(dir,'repo'),bin=join(dir,'bin'),repo=process.cwd();mkdirSync(root);mkdirSync(bin);
  const write=(p:string,text:string)=>{mkdirSync(join(root,p,'..'),{recursive:true});writeFileSync(join(root,p),text);};
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:'pipe'}).trim();
  git('init','-b','main');git('config','user.name','test');git('config','user.email','test@example.com');
  write('.gitignore','node_modules/\n.delivery-local/\nartifacts/\n');
  write('gauntlet/VERSION.json','{"version":"0.12.0"}');write('mise.toml',`[tools]\nnode = "${process.versions.node}"\npnpm = "11.10.0"\n`);write('package.json','{"packageManager":"pnpm@11.10.0","scripts":{"build":"vite build"}}');
  write('pnpm-lock.yaml','importers:\n\n  .:\n    devDependencies:\n      vite:\n        specifier: ^6.3.5\n        version: 6.4.3\n\npackages:\n');write('node_modules/vite/package.json','{"version":"6.4.3"}');
  write('src/apps/browser/styles.css','before');write('src/main.ts','');write('index.html','<script src="/src/main.ts"></script>');write('vite.config.ts','');
  write('tests/unit/gauntlet-fixture.test.ts','');write('tests/browser/game.browser.test.ts','');
  write('scripts/ci/test-gauntlet-telemetry.mjs','console.log("PASS");');
  write('gauntlet/state/HORIZON.md','horizon_version: 39\nobjectives:\n  - id: PLAYER-A\n    status: pending\n  - id: PLAYER-B\n    status: pending\n');
  writeFileSync(join(bin,'pnpm'),`#!/usr/bin/env node
const fs=require('fs'),path=require('path'),a=process.argv.slice(2);if(a[0]==='--version'){console.log('11.10.0');process.exit(0);}
fs.mkdirSync('.delivery-local',{recursive:true});fs.appendFileSync('.delivery-local/calls',a.join(' ')+'\\n');
const test=a.includes('vitest')||a.join(' ').startsWith('run test'),mode=fs.existsSync('.delivery-local/mode')?fs.readFileSync('.delivery-local/mode','utf8'):'pass';
if(test){const browser=a.includes('browser')||a.includes('test-browser');const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);let files=walk('tests').filter(p=>p.endsWith('.test.ts')&&(browser?p.startsWith('tests/browser/'):!p.startsWith('tests/browser/')));const filters=a.filter(p=>p.startsWith('tests/'));if(filters.length)files=files.filter(p=>filters.some(f=>p.includes(f)));const fail=mode==='product'&&!browser,worker=['worker','unknown'].includes(mode)&&a.includes('test');const report={success:!fail&&!worker,numFailedTests:fail?1:0,numRuntimeErrorTestSuites:worker?1:0,testResults:files.map(p=>({name:path.resolve(p),status:fail?'failed':'passed',assertionResults:[{status:fail?'failed':'passed'}]}))};const out=a.find(p=>p.startsWith('--outputFile.json='));if(out)fs.writeFileSync(out.split('=').slice(1).join('='),JSON.stringify(report));if(fail){console.error('AssertionError: regression');process.exit(1);}if(worker){console.error(mode==='unknown'?'Error: process timeout; no attribution':'[vitest-worker] Timeout calling "onTaskUpdate"');process.exit(1);}}
console.log('PASS');
`,{mode:0o755});
  git('add','.');git('commit','-m','base');
  const cli=(...args:string[])=>spawnSync(process.execPath,['--import',join(repo,'node_modules/tsx/dist/loader.mjs'),join(repo,'scripts/gauntlet/product-quality.ts'),...args],{cwd:root,encoding:'utf8',env:{...process.env,PATH:`${bin}:${process.env.PATH}`}});
  const json=(p:string)=>JSON.parse(readFileSync(join(root,p),'utf8'));
  return {dir,root,write,git,cli,json,calls:()=>readFileSync(join(root,'.delivery-local/calls'),'utf8').trim().split('\n')};
}

describe('0.12 real command, durable progress and proof validation',()=>{
  it('keeps accepted product work possible after a proven unrelated worker certification failure',()=>{
    const f=fixture();try{
      f.write('.delivery-local/mode','worker');const certOut='docs/evidence/CERT-bootstrap/quality.json';
      const cert=f.cli('--stage','certification','--execute','--out',certOut);expect(cert.status,cert.stderr).toBe(1);expect(f.json(certOut).failure_class).toBe('HARNESS_ENVIRONMENT');
      f.git('add','.');f.git('commit','-m','record blocked certificate');
      const health=certificationHealth(f.root);expect(health.latest!.status).toBe('FAIL');expect(health.last_certified).toBeNull();
      expect(()=>requireMilestoneCertificate(f.root,f.git('rev-parse','HEAD'))).toThrow('MILESTONE_UNCERTIFIED');
      const base=f.git('rev-parse','HEAD');f.write('src/apps/browser/styles.css','after');f.write('.delivery-local/mode','pass');
      const out='docs/evidence/PLAYER-A/quality.json',args=['--base',base,'--execute','--out',out];
      const passed=f.cli(...args);expect(passed.status,passed.stderr).toBe(0);expect(f.json(out).proof_scope).toBe('objective');
      const before=f.calls().length;const reused=f.cli(...args);expect(reused.status,reused.stderr).toBe(0);expect(f.calls().slice(before)).toEqual(['run gauntlet:eval:state']);expect(f.json(out).metrics.reused_checks).toBe(f.json(out).plan.checks.length-1);
      f.git('add','.');f.git('commit','-m','candidate');const candidate=f.git('rev-parse','HEAD');
      const result=verifyCandidateQuality(f.root,candidate,'PLAYER-A','builder',{verdict:'NOT_REQUIRED'},{verdict:'NOT_REQUIRED'});expect(result.plan.schema_version).toBe(2);
      // A known supported harness cause does not certify the milestone or waive
      // required affected checks. New source invalidates old PASS evidence.
      f.write('src/apps/browser/styles.css','new source');const report=f.json(out);expect(()=>validateScopedProofs(report.plan,report,snapshot(f.root),out)).toThrow('stale');
      expect(()=>verifyObjectiveAdmission(f.root,base,{full_required:false},'NOT-PLANNED')).toThrow('already-selected');
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },15000);
  it('resumes missing coverage and reuses an exact whole-check repair without running it twice',()=>{
    const f=fixture();try{
      const base=f.git('rev-parse','HEAD');f.write('vitest.config.ts','shared config');f.write('.delivery-local/mode','worker');const out='docs/evidence/RUNNER/quality.json',args=['--base',base,'--execute','--out',out];
      expect(f.cli(...args).status).toBe(1);const first=f.calls().length;
      f.write('.delivery-local/mode','pass');f.write('.delivery-local/diagnosis.json','{"diagnosis":"Transport reproduction fixed; verify exact failed check"}');
      const repair=f.cli(...args,'--repair','.delivery-local/diagnosis.json');expect(repair.status,repair.stderr).toBe(0);expect(f.json(out).status).toBe('REPAIR_PASS');
      const afterRepair=f.calls().length;const final=f.cli(...args);expect(final.status,final.stderr).toBe(0);
      expect(f.calls().slice(afterRepair).some(c=>c.startsWith('run test '))).toBe(false);expect(f.json(out).checks.find((r:any)=>r.id==='regression-tests').proof.reused).toBe(true);
      expect(f.calls().slice(first).filter(c=>c.startsWith('run typecheck')).length).toBe(0);
      // Report tampering does not become a reusable PASS.
      const row=f.json(out).checks.find((r:any)=>r.id==='regression-tests');f.write(row.proof.path,'{}');expect(()=>validateScopedProofs(f.json(out).plan,f.json(out),snapshot(f.root),out)).toThrow('hash mismatch');
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },15000);
  it('blocks product/unknown failures, limits debt and validates a full exact-target certificate',()=>{
    const f=fixture();try{
      f.write('.delivery-local/mode','product');const out='docs/evidence/CERT-product/quality.json';expect(f.cli('--stage','certification','--execute','--out',out).status).toBe(1);f.git('add','.');f.git('commit','-m','record product failure');
      const base=f.git('rev-parse','HEAD');expect(()=>verifyObjectiveAdmission(f.root,base,{full_required:false},'PLAYER-A')).toThrow('product, unknown');
      // A distinct target/attempt is allowed after a reviewed repair, but old
      // evidence and records remain. Tests use another CERT identity, not a
      // reset of the existing recovery incident.
      f.write('.delivery-local/mode','pass');const passedOut='docs/evidence/CERT-fixed/quality.json';const target=f.git('rev-parse','HEAD');f.write('.delivery-local/repair.json','{"diagnosis":"Repair the demonstrated assertion defect and verify the failed whole check"}');
      const repaired=f.cli('--stage','certification','--execute','--out',passedOut,'--repair','.delivery-local/repair.json');expect(repaired.status,repaired.stderr).toBe(0);
      const pass=f.cli('--stage','certification','--execute','--out',passedOut);expect(pass.status,pass.stderr).toBe(0);f.git('add','.');f.git('commit','-m','publish full certificate');
      expect(()=>requireMilestoneCertificate(f.root,target)).not.toThrow();expect(()=>requireMilestoneCertificate(f.root,f.git('rev-parse','HEAD'))).toThrow('MILESTONE_UNCERTIFIED');
      for(let i=0;i<4;i++)f.write(`gauntlet/evals/results/2026-10-04/${i}-acceptance.json`,JSON.stringify({proof_scope:'objective',objective_id:'P'+i,candidate_commit:f.git('rev-parse','HEAD')}));
      f.git('add','.');f.git('commit','-m','four objective references');expect(()=>verifyObjectiveAdmission(f.root,f.git('rev-parse','HEAD'),{full_required:false},'PLAYER-A')).toThrow('four uncertified');
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },15000);
  it('refuses unknown certification, budget renaming, overlapping publishers and schema downgrade',()=>{
    const f=fixture();try{
      expect(()=>verifyObjectiveAdmission(f.root,f.git('rev-parse','HEAD'),{full_required:false},'PLAYER-A')).toThrow('bootstrap');
      f.write('.delivery-local/mode','unknown');const out='docs/evidence/CERT-unknown/quality.json';
      expect(f.cli('--stage','certification','--execute','--out',out).status).toBe(1);expect(f.json(out).failure_class).toBe('UNKNOWN');
      f.git('add','.');f.git('commit','-m','unknown certificate');const base=f.git('rev-parse','HEAD');
      expect(()=>verifyObjectiveAdmission(f.root,base,{full_required:false},'PLAYER-A')).toThrow('product, unknown');
      const incident='.delivery-local/quality/repository/certification/recovery.json',budget=f.json(incident);budget.budget.started_at_ms-=91*60*1000;f.write(incident,JSON.stringify(budget));const before=f.calls().length;
      const renamed='docs/evidence/CERT-renamed/quality.json';expect(f.cli('--stage','certification','--execute','--out',renamed).status).toBe(1);expect(f.json(renamed).status).toBe('RECOVERY_BLOCKED');expect(f.calls().length).toBe(before);expect(f.json(incident).budget.repair_attempts).toBe(budget.budget.repair_attempts);
      f.write('.delivery-local/quality/runner.lock','{"pid":123}');expect(f.cli('--base',base,'--execute','--out','docs/evidence/PLAYER-A/quality.json').stderr).toContain('QUALITY_BUSY');expect(f.calls().length).toBe(before);rmSync(join(f.root,'.delivery-local/quality/runner.lock'));
      f.git('add','.');f.git('commit','-m','publish recovery blocker');const candidateBase=f.git('rev-parse','HEAD');f.write('src/apps/browser/styles.css','after');f.write('docs/evidence/PLAYER-A/quality.json',JSON.stringify({base_commit:candidateBase,schema_version:1}));f.git('add','.');f.git('commit','-m','invalid old receipt');
      expect(()=>verifyCandidateQuality(f.root,f.git('rev-parse','HEAD'),'PLAYER-A','builder',{verdict:'NOT_REQUIRED'},{verdict:'NOT_REQUIRED'})).toThrow('cannot downgrade');
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },15000);
  it('preserves certified provenance, rejects unaccepted source and measures committed runs',()=>{
    const f=fixture();try{
      const target=f.git('rev-parse','HEAD'),out='docs/evidence/CERT-main/quality.json';expect(f.cli('--stage','certification','--execute','--out',out).status).toBe(0);f.git('add','.');f.git('commit','-m','publish certificate');
      const metrics=verificationMeasurements(f.root,[],'HEAD','v39');expect(metrics.status).toBe('MEASURED');expect(metrics.full_suite_executions).toBe(1);expect(metrics.sources.length).toBe(1);expect(verificationMeasurements(f.root,['MISSING']).verification_ms).toBeNull();
      expect(()=>verifyObjectiveAdmission(f.root,f.git('rev-parse','HEAD'),{full_required:false},'PLAYER-A')).not.toThrow();
      f.write('src/main.ts','unaccepted behavior');f.git('add','.');f.git('commit','-m','unaccepted source');expect(()=>verifyObjectiveAdmission(f.root,f.git('rev-parse','HEAD'),{full_required:false},'PLAYER-A')).toThrow('intervening unaccepted');
      const record=f.git('ls-files','gauntlet/certification').split('\n')[0]!;const value=f.json(record);value.horizon='v100';f.write(record,JSON.stringify(value));f.git('add','.');f.git('commit','-m','tampered certificate history');expect(()=>certificationHealth(f.root)).toThrow('append-only');
      expect(()=>requireMilestoneCertificate(f.root,target)).toThrow();
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },15000);
  it('carries exhausted old full-gate recovery into certification without rewriting old records',()=>{
    const f=fixture();try{
      const check=qualityPlan(['gauntlet/runtime/quality-execution.ts']).checks.find(c=>c.id==='regression-tests')!;
      const old=rememberFailure(null,check,{id:check.id,status:'FAIL',exit_code:1,log:'old.log',duration_ms:1,failure_signature:'a'.repeat(64),failed_test_files:[]});old.budget!.started_at_ms-=91*60*1000;old.budget!.repair_attempts=2;
      const path='.delivery-local/quality/OLD-PRODUCT/recovery.json',bytes=JSON.stringify(old);f.write(path,bytes);
      const out='docs/evidence/CERT-migration/quality.json',result=f.cli('--stage','certification','--execute','--out',out);
      expect(result.status).toBe(1);expect(f.json(out).status).toBe('RECOVERY_BLOCKED');expect(f.json(out).recovery_budget.repair_attempts).toBe(2);expect(f.json(out).metrics.executed_checks).toBe(0);expect(readFileSync(join(f.root,path),'utf8')).toBe(bytes);
      const migrated=f.json('.delivery-local/quality/repository/certification/recovery.json');expect(migrated.budget.started_at_ms).toBe(old.budget!.started_at_ms);expect(migrated.legacy_sources[0].sha256).toBe(hash(bytes));
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },15000);
  it('freezes baseline provenance without fabricating missing historical measurements',()=>{
    const path='gauntlet/trajectory/baseline-0.11.3/baseline.json',bytes=readFileSync(path);expect(readFileSync(path.replace('baseline.json','baseline.sha256'),'utf8').split(' ')[0]).toBe(hash(bytes));const baseline=JSON.parse(bytes.toString());for(const metric of Object.values(baseline.metrics) as any[])expect(metric).toMatchObject({value:null,status:'UNAVAILABLE'});for(const ref of baseline.sources)expect(hash(execFileSync('git',['show',`${ref.commit}:${ref.path}`]))).toBe(ref.sha256);
  });
});
