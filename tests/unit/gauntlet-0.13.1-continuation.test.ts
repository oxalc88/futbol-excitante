import { describe, it, expect } from 'vitest';
import { rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fixture } from '../helpers/gauntlet-quality.js';
import { appendIncident, activeIncident, incidentEvents, validateRepairCommit, validateRepairExecution, requireRelevantRepair } from '../../gauntlet/runtime/incidents.js';
import { certificationHealth, verifyObjectiveAdmission } from '../../gauntlet/runtime/certification.js';
import { rememberFailure } from '../../gauntlet/runtime/quality-execution.js';
import { qualityPlan } from '../../gauntlet/runtime/product-quality.js';
import { reserveResume } from '../../gauntlet/runtime/incident-recovery.js';
import { bindEfficiency } from '../../.omp/extensions/gauntlet-efficiency.js';

describe('0.13.1 actual refusal and bounded native handoff',()=>{
  it('preserves product documentation but rejects assurance mutations introduced on the coordinator branch',()=>{
    const f=fixture();try{
      f.write('scripts/ci/transport.mjs','process.exit(0);\n');f.git('add','.');f.git('commit','-m','one machinery commit');const repair=f.git('rev-parse','HEAD');
      f.write('docs/product-progress.md','Preserved product progress.\n');f.git('add','.');f.git('commit','-m','preserve product progress');expect(()=>validateRepairExecution(f.root,repair,f.git('rev-parse','HEAD'))).not.toThrow();
      f.write('tests/unit/gauntlet-fixture.test.ts',"it.skip('protected assertion',()=>{});\n");f.git('add','.');f.git('commit','-m','forbidden coordinator-side assertion waiver');expect(()=>validateRepairExecution(f.root,repair,f.git('rev-parse','HEAD'))).toThrow('protected tests');
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  });
  it('does not summon an engineer on a healthy repository merely because the binary exists',()=>{
    const f=fixture();try{
      f.write('gauntlet/engineering-routes.json',JSON.stringify({schema_version:1,routes:[{id:'installed',command:[process.execPath]}]}));f.git('add','.');f.git('commit','-m','installed optional engineering route');
      const result=JSON.parse(f.control('continue').stdout);expect(result.action).not.toBe('ENGINEERING_ESCALATION');expect(result.facts.engineering_escalation_available).toBe(false);
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  });
  it.each(['worker','unknown','product'])('does not replace evidenced %s certification with a refusal',mode=>{
    const f=fixture();try{
      f.write('.delivery-local/mode',mode);expect(f.cli('--stage','certification','--execute','--out','docs/evidence/CERT-original/quality.json').status).toBe(1);
      const original=activeIncident(f.root,'repository/full')!;
      appendIncident(f.root,{...original,kind:'FAILURE',state:'ACTIVE',recovery:{...original.recovery,budget:{...original.recovery.budget!,repair_attempts:2}}});f.git('add','.');f.git('commit','-m','preserve exhausted incident');
      expect(f.cli('--stage','certification','--execute','--out','docs/evidence/CERT-refused/quality.json').status).toBe(1);expect(f.json('docs/evidence/CERT-refused/quality.json').metrics.executed_checks).toBe(0);f.git('add','.');f.git('commit','-m','preserve refusal separately');
      const health=certificationHealth(f.root);expect(health.latest!.status).toBe('FAIL');expect(health.latest_attempt!.status).toBe('RECOVERY_BLOCKED');
      const base=f.git('rev-parse','HEAD');
      if(mode==='worker')expect(()=>verifyObjectiveAdmission(f.root,base,{full_required:false},'PLAYER-A')).not.toThrow();
      else expect(()=>verifyObjectiveAdmission(f.root,base,{full_required:false},'PLAYER-A')).toThrow('product, unknown');
      expect(activeIncident(f.root,'repository/full')!.recovery.budget).toEqual({...original.recovery.budget!,repair_attempts:2});
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },15000);

  it('permits actual test transport/configuration repair but freezes assertions, timers and coverage',()=>{
    const f=fixture();try{
      f.write('tests/capture.node.test.ts',`import { spawn } from 'node:child_process'; import { it, expect } from 'vitest'; const child=spawn('vite',[],{cwd:'wrong'}); it('protected',()=>expect(1).toBe(1));`);f.git('add','.');f.git('commit','-m','capture transport fixture');
      f.write('vitest.config.ts',"import './scripts/ci/transport.mjs'; export default {test:{}};");f.git('add','vitest.config.ts');f.git('commit','-m','known configuration surface');
      f.write('.delivery-local/mode','worker');expect(f.cli('--stage','certification','--execute','--out','docs/evidence/CERT-original/quality.json').status).toBe(1);const incident=activeIncident(f.root,'repository/full')!;f.git('add','.');f.git('commit','-m','publish original failure');
      const baseline=f.git('rev-parse','HEAD');
      f.write('tests/capture.node.test.ts',readFileSync(join(f.root,'tests/capture.node.test.ts'),'utf8').replace("cwd:'wrong'","cwd:process.cwd()"));f.git('add','tests/capture.node.test.ts');f.git('commit','-m','repair capture cwd transport');
      expect(()=>validateRepairCommit(f.root,f.git('rev-parse','HEAD'))).not.toThrow();expect(()=>requireRelevantRepair(f.root,incident,'tests/capture.node.test.ts',f.git('rev-parse','HEAD'))).not.toThrow();
      for(const [name,options] of [['spawn-timeout','cwd:process.cwd(),timeout:120000'],['spawn-shell','cwd:process.cwd(),shell:true'],['spawn-environment',"cwd:process.cwd(),env:{NODE_OPTIONS:'--require bypass.cjs'}"],['spawn-side-effect','cwd:(()=>{expect(1).toBe(2);return process.cwd()})()']]){
        f.git('checkout','-b',`forbidden-${name}`,baseline);f.write('tests/capture.node.test.ts',readFileSync(join(f.root,'tests/capture.node.test.ts'),'utf8').replace("cwd:'wrong'",options!));f.git('add','tests/capture.node.test.ts');f.git('commit','-m',`invalid ${name}`);expect(()=>validateRepairCommit(f.root,f.git('rev-parse','HEAD'))).toThrow('assertions');
      }
      f.git('checkout','-b','config-repair',baseline);f.write('vitest.config.ts',"import './scripts/ci/transport.mjs'; export default {test:{pool:'forks',fileParallelism:false}};");
      f.git('add','vitest.config.ts');f.git('commit','-m','native pool repair');expect(()=>validateRepairCommit(f.root,f.git('rev-parse','HEAD'))).not.toThrow();expect(()=>requireRelevantRepair(f.root,incident,'vitest.config.ts',f.git('rev-parse','HEAD'))).not.toThrow();
      for(const [name,field] of [['coverage',"include:['tests/unit/']"],['timeout','testTimeout:120000'],['retry','retry:2']]){
        f.git('checkout','-b',`forbidden-${name}`,baseline);f.write('vitest.config.ts',`import './scripts/ci/transport.mjs'; export default {test:{${field}}};`);f.git('add','vitest.config.ts');f.git('commit','-m',`invalid ${name} mutation`);expect(()=>validateRepairCommit(f.root,f.git('rev-parse','HEAD'))).toThrow('coverage');
      }
      f.git('checkout','-b','assertion-repair',baseline);f.write('tests/capture.node.test.ts',readFileSync(join(f.root,'tests/capture.node.test.ts'),'utf8').replace('toBe(1)','toBe(2)'));f.git('add','tests/capture.node.test.ts');f.git('commit','-m','forbidden assertion edit');expect(()=>validateRepairCommit(f.root,f.git('rev-parse','HEAD'))).toThrow('assertions');
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },15000);

  it('OMP invokes one native engineer for expired UNKNOWN legacy state, then only Gauntlet confirms recovery',async()=>{
    const f=fixture(true);try{
      f.write('gauntlet/engineering-routes.json',JSON.stringify({schema_version:1,routes:[{id:'fixture-native',command:[process.execPath,'scripts/ci/engineer.mjs']}]}));
      f.write('scripts/ci/engineer.mjs',`import fs from 'node:fs'; let input=''; for await (const chunk of process.stdin) input+=chunk; if(!input.includes('original failure')||!input.includes('Do not change product code'))process.exit(2); fs.writeFileSync('scripts/ci/transport.mjs','process.exit(0);\\n'); console.log('Causal transport repair proposal; not a certificate');`);
      f.git('add','.');f.git('commit','-m','configure existing native engineer');
      const check=qualityPlan(['gauntlet/runtime/quality-execution.ts']).checks.find(c=>c.id==='regression-tests')!;
      const old=rememberFailure(null,check,{id:check.id,status:'FAIL',exit_code:1,log:'old.log',duration_ms:1,failure_signature:'a'.repeat(64)});old.budget!.started_at_ms-=91*60*1000;old.budget!.repair_attempts=2;f.write('.delivery-local/quality/OLD/recovery.json',JSON.stringify(old));
      expect(f.cli('--stage','certification','--execute','--out','docs/evidence/CERT-bootstrap/quality.json').status).toBe(1);f.git('add','.');f.git('commit','-m','publish imported UNKNOWN incident');
      const incident=activeIncident(f.root,'repository/full')!,budget=incident.recovery.budget;
      const repairBase=f.git('rev-parse','HEAD');
      f.write('docs/preserved-product-progress.md','Useful product instructions, not accepted or certified.\n');f.git('add','.');f.git('commit','-m','preserve unaccepted product progress');
      expect(certificationHealth(f.root).latest).toBeNull();expect(()=>verifyObjectiveAdmission(f.root,f.git('rev-parse','HEAD'),{full_required:false},'PLAYER-A')).toThrow('bootstrap');
      expect(JSON.parse(f.control('continue').stdout).action).toBe('ENGINEERING_ESCALATION');
      expect(f.control('escalate','--incident',incident.incident_id).status).toBe(0);f.git('add','.');f.git('commit','-m','publish neutral engineering packet event');
      expect(JSON.parse(f.control('continue').stdout).action).toBe('ENGINEERING_ESCALATION'); // A packet is not a dispatched engineer.
      const stale=join(f.dir,'stale-engineer');f.git('worktree','add','-b','stale-engineer',stale,`${repairBase}^`);
      const workspace=join(f.dir,'engineer');f.git('worktree','add','-b','native-engineer',workspace,repairBase);
      const schema:any={object:()=>schema,enum:()=>schema,string:()=>schema},tools=new Map<string,any>();
      bindEfficiency({zod:schema,on:()=>{},registerTool:(tool:any)=>tools.set(tool.name,tool),registerCommand:()=>{},events:{on:()=>{}}},{root:f.root});
      const tool=tools.get('gauntlet_engineering_repair'),params={incidentId:incident.incident_id,routeId:'fixture-native',coordinatorRoot:f.root,workspace};
      await expect(tool.execute('bad',{...params,workspace:f.root},new AbortController().signal,null,{cwd:f.root})).rejects.toThrow('isolated');
      await expect(tool.execute('stale',{...params,workspace:stale},new AbortController().signal,null,{cwd:f.root})).rejects.toThrow('exact published');expect(incidentEvents(f.root).filter(e=>e.kind==='DISPATCH')).toHaveLength(0);
      const result=await tool.execute('native',params,new AbortController().signal,null,{cwd:f.root});expect(JSON.parse(result.content[0].text).exit_code).toBe(0);
      expect(readFileSync(join(f.root,'scripts/ci/transport.mjs'),'utf8')).toBe('process.exit(1);\n');
      expect(incidentEvents(f.root).filter(e=>e.kind==='DISPATCH')).toHaveLength(1);expect(activeIncident(f.root,'repository/full')!.state).toBe('EXHAUSTED');
      await expect(tool.execute('again',params,new AbortController().signal,null,{cwd:workspace})).rejects.toThrow('consumed');
      execFileSync('git',['add','scripts/ci/transport.mjs'],{cwd:workspace});execFileSync('git',['commit','-m','one native machinery repair'],{cwd:workspace,stdio:'pipe'});const repairCommit=f.git('rev-parse','native-engineer');f.git('merge','--no-ff','-m','integrate repair without discarding product progress','native-engineer');expect(readFileSync(join(f.root,'docs/preserved-product-progress.md'),'utf8')).toContain('Useful product');f.git('add','gauntlet/incidents');f.git('commit','-m','publish one native dispatch');
      f.write('.delivery-local/mode','worker');f.write('.delivery-local/repair.json',JSON.stringify({diagnosis:'original executed transport exits 1; repair changes that component to exit 0',component:'scripts/ci/transport.mjs',repair_commit:repairCommit}));
      const repaired=f.cli('--stage','certification','--execute','--repair','.delivery-local/repair.json','--out','docs/evidence/CERT-repair/quality.json');expect(repaired.status,repaired.stderr).toBe(0);f.git('add','.');f.git('commit','-m','publish independently validated repair');
      reserveResume(f.root,incident.incident_id);f.git('add','.');f.git('commit','-m','publish one audited execution');
      const resumed=f.cli('--stage','certification','--execute','--out','docs/evidence/CERT-resumed/quality.json');expect(resumed.status,resumed.stderr).toBe(0);f.git('add','.');f.git('commit','-m','publish exact full verification');
      expect(certificationHealth(f.root).latest!.status).toBe('PASS');expect(activeIncident(f.root,'repository/full')).toBeNull();for(const e of incidentEvents(f.root))expect(e.recovery.budget).toEqual(budget);
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },20000);
});
