import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createContextPacket, validateContextPacket } from '../../gauntlet/runtime/context-packet.js';
import { digestRepositoryFiles } from '../../gauntlet/runtime/digest.js';
import { searchMemory, validateMemory } from '../../gauntlet/runtime/memory.js';
import { mapObjectiveContext } from '../../gauntlet/runtime/context-mapper.js';
import { createBuilderCheckpoint, validateBuilderCheckpoint } from '../../gauntlet/runtime/builder-checkpoint.js';
import { runVerificationBatch } from '../../gauntlet/runtime/verification-batch.js';
import { GauntletRuntime } from '../../gauntlet/runtime/service.js';
import { appendTelemetry, readTelemetry } from '../../gauntlet/runtime/telemetry.mjs';
import { readRuntimeConfiguration } from '../../gauntlet/runtime/configuration.mjs';
import { bindEfficiency } from '../../.omp/extensions/gauntlet-efficiency.js';

async function fixture(run: (root: string) => Promise<void>) {
  const root=await mkdtemp(path.join(tmpdir(),'gauntlet-010-'));
  try {
    await mkdir(path.join(root,'memory','architecture'),{recursive:true});
    await writeFile(path.join(root,'source.ts'),'export const behavior = 1;');
    await writeFile(path.join(root,'test.ts'),'evidence');
    await run(root);
  } finally { await rm(root,{recursive:true,force:true}); }
}
const packetInput = {objectiveId:'A',executiveSummary:'Player can play',files:[{path:'source.ts',purpose:'behavior'}],decisions:[],tests:['test.ts'],dependencies:[],risks:[],conflicts:[],skillsToLoad:[]};
const mapping = {...packetInput,obviousFiles:packetInput.files,selectedMemoryTopics:[],searches:[]};
const identity = {sessionId:'builder',role:'builder-gameplay',model:'nan/qwen3.8-flash',objectiveId:'A',profile:'optimized'};
const checkpointInput = {objectiveId:'A',builderSessionId:'builder',phase:'implementation',changedFiles:['source.ts'],implementedBehavior:['Player behavior'],testsRun:[],remainingFailures:[],evidence:['test.ts'],nextAction:'Run neighbor checks',relevantFiles:[]};
async function enable(root: string, flags=['memory','context','checkpoints','rotation','verification']) {
  await mkdir(path.join(root,'.delivery-local'),{recursive:true});
  await writeFile(path.join(root,'.delivery-local','baseline.json'),JSON.stringify({schema:'gauntlet-telemetry-v1',profiles:[{profile:'baseline',coverageComplete:true,acceptedObjectives:[{objectiveId:'BASE'}],processedInputTokensPerAcceptedObjective:1234}]}));
  await writeFile(path.join(root,'.delivery-local','efficiency.json'),JSON.stringify({profile:'optimized',enabled:flags,baseline_report:'.delivery-local/baseline.json'}));
}
async function topic(root: string, name: string, status='active', digest?: string) {
  const actual = digest ?? await digestRepositoryFiles(root,['source.ts']);
  await writeFile(path.join(root,'memory','architecture',`${name}.md`),`---\nschema_version: 1\ntopic_key: ${name}\ntype: architecture\nstatus: ${status}\nsummary: Player behavior knowledge ${name}\ncanonical_refs: ["source.ts"]\nevidence: ["test.ts"]\nsupersedes: []\nsuperseded_by: ""\nsource_digest: ${actual}\nupdated_at: 2026-10-03\n---\nPlayer behavior comes from current source.\n`);
}

describe('Gauntlet 0.10.0 memory and context',()=>{
  it('excludes stale, proposed, invalid and duplicate memory while bounding retrieval',async()=>fixture(async root=>{
    await topic(root,'active'); await topic(root,'proposal','proposed'); await topic(root,'stale','active','sha256:'+'0'.repeat(64));
    const found = await searchMemory(root,'Player behavior');
    expect(found.map(t=>t.topicKey)).toEqual(['active']);
    expect((await validateMemory(root)).needsReview).toContain('stale');
    expect(await searchMemory(root,'Player behavior',0)).toEqual([]);
    await writeFile(path.join(root,'source.ts'),'changed canonical source');
    expect(await searchMemory(root,'Player behavior')).toEqual([]);
  }));
  it('rejects escaping paths, symlinks, oversize packets and stale sources',async()=>fixture(async root=>{
    const packet = await createContextPacket(root,packetInput);
    expect((await validateContextPacket(root,packet)).valid).toBe(true);
    expect((await validateContextPacket(root,{...packet,executiveSummary:'x'.repeat(10000)})).valid).toBe(false);
    await writeFile(path.join(root,'source.ts'),'changed');
    expect((await validateContextPacket(root,packet)).stale).toBe(true);
    await symlink('/etc/passwd',path.join(root,'escape'));
    await expect(digestRepositoryFiles(root,['escape'])).rejects.toThrow('symlink');
    await expect(digestRepositoryFiles(root,['../source.ts'])).rejects.toThrow('relative');
  }));
  it('bypasses mapper searches for obvious tasks and limits reads in bytes',async()=>fixture(async root=>{
    let searches=0;
    const view={search:async()=>{searches++;return ['source.ts'];},read:async()=> 'é'.repeat(100)};
    const result=await mapObjectiveContext(root,view,mapping);
    expect(result.metrics.bypassed).toBe(true); expect(searches).toBe(0);
    expect(result.metrics.mapperInputTokens).toBe(50);
    await expect(mapObjectiveContext(root,{...view,read:async()=> 'x'.repeat(64001)},mapping)).rejects.toThrow('budget');
    await expect(mapObjectiveContext(root,view,{...mapping,searches:['1','2','3','4','5']})).rejects.toThrow('search limit');
  }));
});
describe('Gauntlet 0.10.0 live efficiency service',()=>{
  it('keeps capabilities disabled until a measured baseline is supplied',async()=>fixture(async root=>{
    expect(readRuntimeConfiguration(root).profile).toBe('baseline');
    await expect(new GauntletRuntime(root,root,identity).execute('checkpoint','A',checkpointInput)).rejects.toThrow('disabled');
    await mkdir(path.join(root,'.delivery-local'),{recursive:true});
    await writeFile(path.join(root,'.delivery-local','efficiency.json'),JSON.stringify({profile:'optimized',enabled:['memory'],baseline_report:'../baseline.json'}));
    expect(()=>readRuntimeConfiguration(root)).toThrow('repository-relative');
    await enable(root); const config=JSON.parse(await readFile(path.join(root,'.delivery-local','baseline.json'),'utf8')); config.profiles[0].coverageComplete=false;
    await writeFile(path.join(root,'.delivery-local','baseline.json'),JSON.stringify(config));
    expect(()=>readRuntimeConfiguration(root)).toThrow('complete measured baseline');
  }));
  it('hashes changed implementation and evidence in checkpoints',async()=>fixture(async root=>{
    const checkpoint=await createBuilderCheckpoint(root,checkpointInput);
    expect((await validateBuilderCheckpoint(root,checkpoint)).valid).toBe(true);
    await writeFile(path.join(root,'test.ts'),'changed evidence');
    expect((await validateBuilderCheckpoint(root,checkpoint)).stale).toBe(true);
  }));
  it('records actual packet, memory, checkpoint and verification tool actions',async()=>fixture(async root=>{
    await enable(root); await topic(root,'behavior');
    const orchestrator=new GauntletRuntime(root,root,{...identity,sessionId:'parent',role:'orchestrator'});
    await orchestrator.execute('map_context','A',{...mapping,selectedMemoryTopics:[{topicKey:'behavior',canonicalRefs:['source.ts']}]});
    const builder=new GauntletRuntime(root,root,identity);
    await builder.execute('checkpoint','A',checkpointInput);
    const result:any=await builder.execute('verify_batch','A',{commands:[{id:'pass',command:[process.execPath,'-e','console.log("pass")']},{id:'fail',command:[process.execPath,'-e','console.error("error: failed check");process.exit(2)']}]});
    expect(result.status).toBe('FAIL'); expect(result.commands[1].exitCode).toBe(2);
    expect(result.resultDeliveryCount).toBe(1);
    expect(await readFile(path.join(root,result.commands[1].artifactPath),'utf8')).toContain('error: failed check');
    const events=readTelemetry(root); expect(events.map(e=>e.type).sort()).toEqual(['context_packet','memory_retrieved','checkpoint','verification_batch'].sort());
    expect(events.find(e=>e.type==='memory_retrieved')!.data.topics).toEqual(['behavior']);
    await expect(builder.execute('map_context','A',mapping)).rejects.toThrow('orchestrator');
    await expect(builder.execute('checkpoint','B',{...checkpointInput,objectiveId:'B'})).rejects.toThrow('binding');
    await expect(builder.execute('checkpoint','A',{...checkpointInput,builderSessionId:'forged'})).rejects.toThrow('this builder');
  }));
  it('prepares a fresh native task only with measured budget and validated checkpoint',async()=>fixture(async root=>{
    await enable(root);
    const orchestrator=new GauntletRuntime(root,root,{...identity,sessionId:'parent',role:'orchestrator'});
    const builder=new GauntletRuntime(root,root,identity);
    await orchestrator.execute('map_context','A',mapping);
    await builder.execute('checkpoint','A',checkpointInput);
    const below:any=await orchestrator.execute('fresh_builder_seed','A',{safeBoundary:true,materiallyDifferent:true,nextPhase:'verification'});
    expect(below.decision.rotate).toBe(false);
    appendTelemetry(root,identity,'generation',{usage:{processedInputTokens:12000000,peakContext:180000,outputTokens:1}});
    const unsafe:any=await orchestrator.execute('fresh_builder_seed','A',{safeBoundary:false,materiallyDifferent:true,nextPhase:'verification'});
    expect(unsafe.decision.reason).toBe('unsafe_boundary');
    const seed:any=await orchestrator.execute('fresh_builder_seed','A',{safeBoundary:true,materiallyDifferent:true,nextPhase:'verification'});
    expect(seed.decision.rotate).toBe(true); expect(seed.agent).toBe('builder-gameplay'); expect(seed.isolated).toBe(true);
    expect(seed.task).toContain('previousTranscriptIncluded":false'); expect(seed.task).toContain('[gauntlet-objective:A]');
    expect(readTelemetry(root).filter(e=>e.type==='builder_rotation')).toHaveLength(0); // A prepared grant is not a rotation.
    const handlers=new Map<string,Function>();
    const schema:any={object:()=>schema,enum:()=>schema,string:()=>schema};
    const pi={zod:schema,on:(name:string,handler:Function)=>handlers.set(name,handler),registerTool:()=>{},registerCommand:()=>{},events:{on:()=>{}}};
    bindEfficiency(pi,{root});
    const ctx={cwd:root,sessionManager:{getSessionId:()=> 'fresh'},agent:{kind:'sub',name:'builder-gameplay'},model:{provider:'nan',id:'qwen3.8-flash'}};
    const event={toolName:'task',input:{tasks:[{agent:seed.agent,task:seed.task,isolated:true}]}};
    expect(await handlers.get('tool_call')!(event,ctx)).toBeUndefined();
    await handlers.get('before_agent_start')!({prompt:seed.task},ctx);
    expect(readTelemetry(root).filter(e=>e.type==='builder_rotation')).toHaveLength(1);
    expect((await handlers.get('tool_call')!(event,ctx)).block).toBe(true); // Consumed grants cannot launch again.
    await writeFile(path.join(root,'source.ts'),'changed after checkpoint');
    await expect(orchestrator.execute('fresh_builder_seed','A',{safeBoundary:true})).rejects.toThrow('stale');
  }));
});
describe('verification batch guarantees',()=>{
  it('never passes an empty batch, crash, invalid status, or duplicate IDs; bounds output',async()=>{
    const runner={run:async()=>({exitCode:0,stdout:'',stderr:''})};
    await expect(runVerificationBatch([],runner)).rejects.toThrow('bounds');
    await expect(runVerificationBatch([{id:'x',command:['a']},{id:'x',command:['b']}],runner)).rejects.toThrow('duplicate');
    const results=await runVerificationBatch([{id:'x',command:['missing']}],{run:async()=>{throw new Error('failed launch');}});
    expect(results.status).toBe('FAIL'); expect(results.commands[0].failureExcerpt).toContain('failed launch');
    const huge=await runVerificationBatch([{id:'x',command:['a']}],{run:async()=>({exitCode:1,stdout:('error '+ 'x'.repeat(10000)+'\n').repeat(100),stderr:''})});
    expect(huge.commands[0].failureExcerpt.length).toBeLessThanOrEqual(20);
    expect(huge.commands[0].failureExcerpt[0].length).toBeLessThanOrEqual(300);
  });
});
