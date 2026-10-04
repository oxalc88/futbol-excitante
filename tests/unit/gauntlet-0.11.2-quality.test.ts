import { describe, it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { failureDetails, rememberFailure, repairCheck, requireRepairProof, runQualityChecks, spawnQualityCheck, qualityPreflight, type QualityResult } from '../../gauntlet/runtime/quality-execution.js';
import { qualityPlan, validateQualityReceipt } from '../../gauntlet/runtime/product-quality.js';

const check = {id:'regression-tests', command:['pnpm','run','test']};
const output = '\x1b[31m FAIL \x1b[0m |node| tests/capture-wip.node.test.ts\nError: readiness timeout 180000 ms\n FAIL |node| tests/difficulty-capture.node.test.ts\nError: readiness timeout 180000 ms\n Test Files 2 failed | 10 passed';
const fail = (): QualityResult => ({id:check.id,status:'FAIL',exit_code:1,log:'failure.log',duration_ms:1,...failureDetails(check,1,output)});

describe('0.11.2 bounded quality execution',()=>{
  it('stops at the first failure and explicitly leaves later checks unrun',async()=>{
    const calls:string[]=[];
    const rows=await runQualityChecks([check,{id:'browser-tests',command:['browser']}],async c=>{calls.push(c.id);return fail();});
    expect(calls).toEqual(['regression-tests']);expect(rows[1]).toMatchObject({status:'NOT_RUN',exit_code:null,log:null});
  });
  it.each(['crash','invalid','cancelled'])('cannot pass %s or continue expensive checks',async mode=>{
    let calls=0;
    const rows=await runQualityChecks([check,{id:'build',command:['build']}],async()=>{calls++;if(mode==='crash')throw Error('failed launch');return {...fail(),status:'PASS',exit_code:mode==='cancelled'?null:1};});
    expect(calls).toBe(1);expect(rows[0]!.status).toBe('FAIL');expect(rows[1]!.status).toBe('NOT_RUN');
  });
  it('handles ANSI failures without making duration changes look like progress',()=>{
    const a=failureDetails(check,1,output),b=failureDetails(check,1,output.replaceAll('180000','60000'));
    expect(a.failed_test_files).toEqual(['tests/capture-wip.node.test.ts','tests/difficulty-capture.node.test.ts']);expect(a.failure_signature).toBe(b.failure_signature);
  });
  it('requires matched repair proof and expands repeated failures to the whole failed check',()=>{
    const first=rememberFailure(null,check,fail());expect(()=>requireRepairProof(first,'source')).toThrow('REPAIR_REQUIRED');
    const focused=repairCheck(first);expect(focused.check.command).toContain('tests/capture-wip.node.test.ts');expect(focused.whole_check).toBe(false);
    first.repair={context_hash:'source',signature:first.failure.signature,diagnosis:'Fixed server startup',whole_check:false};
    expect(()=>requireRepairProof(first,'source')).not.toThrow();expect(()=>requireRepairProof(first,'changed')).toThrow();
    const second=rememberFailure(first,check,fail());expect(second.identical_failures).toBe(2);expect(second.repair).toBeUndefined();expect(repairCheck(second)).toEqual({check,whole_check:true});
    second.repair={...first.repair};expect(()=>requireRepairProof(second,'source')).toThrow();
  });
  it('uses the whole failed check if the reporter does not identify every failing file',()=>{
    const result={...fail(),...failureDetails(check,1,output.replace('2 failed','3 failed'))};expect(repairCheck(rememberFailure(null,check,result)).whole_check).toBe(true);
  });
  it('rejects diagnostic receipts even when every declared exit code is zero',()=>{
    const plan=qualityPlan(['src/apps/browser/styles.css']);const checks=plan.checks.map(c=>({id:c.id,exit_code:0}));
    expect(()=>validateQualityReceipt(plan,{checks,execution_mode:'repair',status:'REPAIR_PASS'})).toThrow('complete full');
    expect(()=>validateQualityReceipt(plan,{checks,status:'RUNNING'})).toThrow();expect(()=>validateQualityReceipt(plan,{checks})).not.toThrow();
  });
  it('bounds real commands and records launch errors without hanging',async()=>{
    const dir=mkdtempSync(join(tmpdir(),'quality-process-'));
    try {
      const timed=await spawnQualityCheck(dir,{id:'timeout',command:[process.execPath,'-e','setInterval(()=>{},1000)']},join(dir,'timeout.log'),100);
      expect(timed.status).toBe('FAIL');expect(timed.exit_code).toBeNull();expect(readFileSync(join(dir,'timeout.log'),'utf8')).toContain('timeout');
      const missing=await spawnQualityCheck(dir,{id:'missing',command:['/missing/quality-command']},join(dir,'missing.log'),1000);expect(missing.status).toBe('FAIL');
      const badLog=await spawnQualityCheck(dir,{id:'bad-log',command:[process.execPath,'-e','setInterval(()=>{},1000)']},join(dir,'missing','log'),1000);expect(badLog.status).toBe('FAIL');
    } finally {rmSync(dir,{recursive:true,force:true});}
  });
  it('cleans a test server that retains output pipes after its launcher exits',async()=>{
    const dir=mkdtempSync(join(tmpdir(),'quality-descendant-'));
    try {
      const result=await spawnQualityCheck(dir,{id:'server',command:[process.execPath,'-e',"require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});process.exit(0)"]},join(dir,'server.log'),1000);
      expect(result.status).toBe('PASS');expect(result.exit_code).toBe(0);
    } finally {rmSync(dir,{recursive:true,force:true});}
  });
});

describe('0.11.2 canonical quality command across sessions',()=>{
  it('persists failure, narrows repair, refuses stale proof and reruns all required checks after repair',()=>{
    const dir=mkdtempSync(join(tmpdir(),'gauntlet-quality-')),root=join(dir,'repo'),bin=join(dir,'bin');
    mkdirSync(root);mkdirSync(bin);
    const write=(p:string,text:string)=>{mkdirSync(join(root,p,'..'),{recursive:true});writeFileSync(join(root,p),text);};
    const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:'pipe'}).trim();
    const repo=process.cwd();
    const cli=(...args:string[])=>spawnSync(process.execPath,['--import',join(repo,'node_modules/tsx/dist/loader.mjs'),join(repo,'scripts/gauntlet/product-quality.ts'),...args],{cwd:root,encoding:'utf8',env:{...process.env,PATH:`${bin}:${process.env.PATH}`}});
    try {
      git('init','-b','main');git('config','user.name','test');git('config','user.email','test@example.com');
      write('.gitignore','node_modules/\n.delivery-local/\nartifacts/\n');write('mise.toml',`[tools]\nnode = "${process.versions.node}"\npnpm = "11.10.0"\n`);write('package.json','{"packageManager":"pnpm@11.10.0"}');
      write('pnpm-lock.yaml','importers:\n\n  .:\n    devDependencies:\n      vite:\n        specifier: ^6.3.5\n        version: 6.4.3\n\npackages:\n');write('node_modules/vite/package.json','{"version":"6.4.3"}');
      write('src/apps/browser/styles.css','before');git('add','.');git('commit','-m','base');const base=git('rev-parse','HEAD');write('src/apps/browser/styles.css','after');
      writeFileSync(join(bin,'pnpm'),`#!/usr/bin/env node\nconst fs=require('fs'); const a=process.argv.slice(2); if(a[0]==='--version'){console.log('11.10.0');process.exit(0);}fs.appendFileSync('.delivery-local/calls.jsonl',JSON.stringify(a)+'\\n');const mode=fs.readFileSync('.delivery-local/mode','utf8');if(mode==='fail' && (a.join(' ')==='run test' || a.includes('vitest'))){console.error(${JSON.stringify(output)});process.exit(1);}console.log('PASS');\n`,{mode:0o755});
      write('.delivery-local/mode','fail');const out='docs/evidence/CSS/quality.json';const args=['--base',base,'--execute','--out',out];
      expect(cli(...args).status).toBe(1);const receipt=JSON.parse(readFileSync(join(root,out),'utf8'));expect(receipt.status).toBe('FAIL');expect(receipt.checks.find((c:any)=>c.id==='browser-tests').status).toBe('NOT_RUN');
      const calls=()=>readFileSync(join(root,'.delivery-local/calls.jsonl'),'utf8').trim().split('\n').map(s=>JSON.parse(s));
      const count=calls().length;const blocked=cli(...args);expect(blocked.stderr).toContain('REPAIR_REQUIRED');expect(calls().length).toBe(count);
      write('.delivery-local/repair.json','{"diagnosis":"Use pinned local Vite from root and reliable readiness"}');write('.delivery-local/mode','pass');
      expect(cli(...args,'--repair','.delivery-local/repair.json').status).toBe(0);expect(calls().at(-1)).toContain('tests/difficulty-capture.node.test.ts');
      expect(JSON.parse(readFileSync(join(root,out),'utf8')).status).toBe('REPAIR_PASS');
      write('src/apps/browser/styles.css','changed after repair');expect(cli(...args).stderr).toContain('REPAIR_REQUIRED');
      // Restore the verified source, then consume its proof in a full retry.
      // 0.11.3 limits recovery to two repairs, including successful attempts.
      write('src/apps/browser/styles.css','after');
      write('.delivery-local/mode','fail');expect(cli(...args).status).toBe(1);
      expect(JSON.parse(readFileSync(join(root,'.delivery-local/quality/CSS/recovery.json'),'utf8')).identical_failures).toBe(2);
      write('.delivery-local/mode','pass');
      expect(cli(...args,'--repair','.delivery-local/repair.json').status).toBe(0);
      expect(calls().at(-1)).toEqual(['run','test']);
      const beforeFull=calls().length;expect(cli(...args).status).toBe(0);expect(calls().slice(beforeFull)).toContainEqual(['run','test-browser']);expect(calls().slice(beforeFull)).toContainEqual(['run','test']);
      const pass=JSON.parse(readFileSync(join(root,out),'utf8'));expect(pass.status).toBe('PASS');expect(()=>validateQualityReceipt(pass.plan,pass)).not.toThrow();
      // A toolchain mismatch invalidates a previous PASS before any test runs.
      write('node_modules/vite/package.json','{"version":"8.3.2"}');const beforeTools=calls().length;expect(cli(...args).stderr).toContain('Local Vite differs');expect(calls().length).toBe(beforeTools);expect(JSON.parse(readFileSync(join(root,out),'utf8')).status).toBe('NOT_RUN');
      write('node_modules/vite/package.json','{"version":"6.4.3"}');
      write('.delivery-local/quality/CSS/recovery.json',JSON.stringify({schema_version:1,identical_failures:1,failure:{check:{id:'regression-tests',command:['echo','PASS']},signature:'a'.repeat(64),failed_test_files:[]}}));
      expect(cli(...args,'--repair','.delivery-local/repair.json').stderr).toContain('invalid quality recovery record');expect(calls().length).toBe(beforeTools);
      expect(()=>qualityPreflight(join(root,'src'))).toThrow('repository root');
    } finally {rmSync(dir,{recursive:true,force:true});}
  },10000);
});
