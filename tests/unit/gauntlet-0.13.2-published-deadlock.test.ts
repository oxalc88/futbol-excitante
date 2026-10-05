import { it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fixture } from '../helpers/gauntlet-quality.js';
import { executionAncestor } from '../../gauntlet/runtime/execution-provenance.js';
import { snapshot } from '../../gauntlet/runtime/scoped-quality.js';

it('requires exact trees and original commit bytes; committed proof works without orphan objects',()=>{
  const f=fixture();try{
    expect(()=>executionAncestor(f.root,'f'.repeat(40))).toThrow('EXECUTION_PROVENANCE_MISSING');
    const base=f.git('rev-parse','HEAD'),tree=f.git('rev-parse','HEAD^{tree}');
    const object=`tree ${tree}\nparent ${base}\nauthor Replay <replay@local> 1 +0000\ncommitter Replay <replay@local> 1 +0000\n\nOriginal orphan execution\n`;
    const original=execFileSync('git',['-C',f.root,'hash-object','-t','commit','-w','--stdin'],{input:object,encoding:'utf8'}).trim();
    expect(()=>executionAncestor(f.root,original)).toThrow('EXECUTION_PROVENANCE_REPAIRABLE');
    expect(executionAncestor(f.root,original,true)).toBe(base);
    expect(()=>executionAncestor(f.root,original,false,snapshot(f.root,'HEAD'))).toThrow('EXECUTION_PROVENANCE_REPAIRABLE');
    f.git('add','gauntlet/execution/provenance');f.git('commit','-m','publish original-object equivalence proof');
    rmSync(join(f.root,'.git/objects',original.slice(0,2),original.slice(2)));
    expect(executionAncestor(f.root,original,false,snapshot(f.root,'HEAD'))).toBe(base);
    const path=join(f.root,`gauntlet/execution/provenance/${original}.json`),row=JSON.parse(readFileSync(path,'utf8'));
    row.original_commit_object+='forged';writeFileSync(path,JSON.stringify(row));expect(()=>executionAncestor(f.root,original)).toThrow('object differs');
  }finally{rmSync(f.dir,{recursive:true,force:true});}
});

it('consumes current observation before execution; interruption cannot retry or regain recovery',async()=>{
  const { IncidentRecovery }=await import('../../gauntlet/runtime/incident-recovery.js');
  const { incidentEvents }=await import('../../gauntlet/runtime/incidents.js');
  const f=fixture(true);try{
    f.write('.delivery-local/quality/OLD/recovery.json',readFileSync(join(process.cwd(),'gauntlet/incidents/legacy-f960b92b26aa53f48ebce68fe6c70896270d1e5f75d051fc9b5fd2a31f4756fc.json'),'utf8'));
    new IncidentRecovery(f.root,'repository/full');f.git('add','gauntlet/incidents');f.git('commit','-m','publish imported historical uncertainty');
    f.write('docs/player-controls.md','Intervening player-facing progress.');f.git('add','docs/player-controls.md');f.git('commit','-m','preserve changed product inputs');
    const before=new IncidentRecovery(f.root,'repository/full'),budget=before.incident!.recovery.budget;
    before.beforeRun(true);expect(before.observing).toBe(true);
    const interrupted=new IncidentRecovery(f.root,'repository/full');expect(()=>interrupted.beforeRun(true)).toThrow('RECOVERY_BLOCKED');
    expect(incidentEvents(f.root).filter(e=>e.kind==='OBSERVE')).toHaveLength(1);expect(interrupted.incident!.recovery.budget).toEqual(budget);expect(budget!.repair_attempts).toBe(2);
  }finally{rmSync(f.dir,{recursive:true,force:true});}
});

it('executes the rejected runner refactor: cooperative yields preserve sync result bytes',async()=>{
  const { runHeadlessMatch, runHeadlessMatchGen, runHeadlessMatchAsync }=await import('../../eval/runners/headless-match.js');
  const scenario=JSON.parse(readFileSync(join(process.cwd(),'eval/scenarios/foundation-move-and-roll.v1.json'),'utf8'));
  const config={scenario,maxTicks:501,gkBehavior:false};
  const sync=JSON.stringify(runHeadlessMatch(config)),generator=runHeadlessMatchGen(config);
  let step=generator.next(),yields=0;while(!step.done){yields++;step=generator.next();}
  expect(yields).toBe(2);expect(JSON.stringify(step.value)).toBe(sync);
  expect(JSON.stringify(await runHeadlessMatchAsync(config))).toBe(sync);
});
