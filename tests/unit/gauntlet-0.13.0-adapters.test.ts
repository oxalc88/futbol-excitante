import { describe, it, expect } from 'vitest';
import { rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fixture } from '../helpers/gauntlet-quality.js';
import { stopRecord, auditStopRecords, sameHorizonWork, type ContinuationFacts } from '../../gauntlet/runtime/continuation.js';
import ompGate from '../../.omp/hooks/pre/gauntlet-parallel-issue-gate.js';
import { bindEfficiency } from '../../.omp/extensions/gauntlet-efficiency.js';
const facts=(extra:Partial<ContinuationFacts>={}):ContinuationFacts=>({blocked_boundary:null,incident_id:null,failure_class:null,preserved_progress:[],certification_debt:0,safe_work_considered:[],routine_action:null,autonomous_actions_attempted:[],repair_available:false,engineering_escalation_available:false,engineering_escalation_attempted:false,evidence:[],external_decision:null,...extra});
const unit=(id:string,paths:string[],dependencies:string[]=[])=>({id,purpose:id,dependencies,expected_file_ownership:paths,builder_role:'builder-structured',local_checks:[{id:'unit',command:['pnpm','run','test']}],handoff_contract:'validated output',interfaces_known:true});

describe('0.13 thin harness adapters',()=>{
  it('validates even one OMP unit and displays the canonical stop through existing UI notification',async()=>{
    const f=fixture();try{
      symlinkSync(join(process.cwd(),'node_modules/tsx'),join(f.root,'node_modules/tsx'),'dir');
      f.write('scripts/gauntlet/control.ts',`await import(${JSON.stringify(join(process.cwd(),'scripts/gauntlet/control.ts'))});`);
      f.write('gauntlet/execution/PLAYER-A.json',JSON.stringify({schema_version:1,objective_id:'PLAYER-A',issue_number:1,base_commit:f.git('rev-parse','HEAD'),units:[unit('A',['src/main.ts']),unit('B',['src/apps/browser/styles.css'],['A'])]}));f.git('add','.');f.git('commit','-m','publish native task plan');
      let gate:Function=()=>{};ompGate({on:(_name:string,handler:Function)=>{gate=handler;}});
      const task=(id:string,isolated=true)=>({agent:'builder-structured',task:`[gauntlet-objective:PLAYER-A] [gauntlet-unit:${id}]`,isolated});
      expect((await gate({toolName:'task',input:{tasks:[task('B')]}},{cwd:f.root})).block).toBe(true);
      expect((await gate({toolName:'task',input:{tasks:[task('A',false)]}},{cwd:f.root})).block).toBe(true);
      expect(await gate({toolName:'task',input:{tasks:[task('A')]}},{cwd:f.root})).toBeUndefined();
      const unresolved=fixture();try{
        unresolved.write('gauntlet/execution/PLAYER-A.json',JSON.stringify({schema_version:1,objective_id:'PLAYER-A',issue_number:1,base_commit:unresolved.git('rev-parse','HEAD'),units:[{...unit('A',['src/main.ts']),interfaces_known:false}]}));unresolved.git('add','.');unresolved.git('commit','-m','unresolved interface');expect(sameHorizonWork(unresolved.root).find(w=>w.id==='PLAYER-A')!.executable).toBe(false);
        const record=stopRecord(unresolved.root,facts({external_decision:{kind:'specification',exact_decision_required:'Specify the missing player interaction contract'}}));
        const handlers=new Map<string,Function>(),messages:string[]=[];const schema:any={object:()=>schema,enum:()=>schema,string:()=>schema};bindEfficiency({zod:schema,on:(name:string,fn:Function)=>{const previous=handlers.get(name);handlers.set(name,async(...args:any[])=>{if(previous)await previous(...args);return fn(...args);});},registerTool:()=>{},registerCommand:()=>{},events:{on:()=>{}}},{root:unresolved.root});
        const ctx={sessionManager:{getSessionId:()=> 'stop-display-session'},ui:{notify:(message:string)=>messages.push(message)}};await handlers.get('session_start')!({},ctx);await handlers.get('tool_result')!({},ctx);expect(messages).toHaveLength(1);expect(messages[0]).toContain(unresolved.json(record).exact_decision_required);expect(auditStopRecords(unresolved.root)).toBe(1);
      }finally{rmSync(unresolved.dir,{recursive:true,force:true});}
    }finally{rmSync(f.dir,{recursive:true,force:true});}
  },15000);
});
