import path from 'node:path';
import { hash } from '../../gauntlet/runtime/scoped-quality.js';
import { fileURLToPath } from 'node:url';
import { readFile, rename, readdir } from 'node:fs/promises';
import { GauntletRuntime, type RuntimeAction } from '../../gauntlet/runtime/service.js';
import { readRuntimeConfiguration } from '../../gauntlet/runtime/configuration.mjs';
import { appendTelemetry, type TelemetryIdentity } from '../../gauntlet/runtime/telemetry.mjs';
import { validateBuilderCheckpoint } from '../../gauntlet/runtime/builder-checkpoint.js';
import { validateContextPacket } from '../../gauntlet/runtime/context-packet.js';

// OMP injects its schema builder. Keep the adapter free of an additional OMP dependency.
export default function gauntletEfficiency(pi: any) {
  return bindEfficiency(pi, {root:path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')});
}
export function bindEfficiency(pi: any, {root}: {root:string}) {
  const configuration = readRuntimeConfiguration(root);
  let displayedStop: string | null = null;
  const displayStop = async (_event: unknown, ctx: any) => {
    const directory = path.join(root,'gauntlet/incidents');
    const names = await readdir(directory).catch(() => [] as string[]);
    const records = (await Promise.all(names.filter(n => /^stop-[a-f0-9]{64}\.json$/.test(n)).map(async name => {try{const record=JSON.parse(await readFile(path.join(directory,name),'utf8'));return name===`stop-${hash(JSON.stringify(record))}.json`?{name,record}:null;}catch{return null;}}))).filter((row):row is {name:string;record:any}=>row!==null);
    const latest = records.sort((a,b)=>a.record.recorded_at.localeCompare(b.record.recorded_at)).at(-1);
    if(latest && latest.name !== displayedStop){
      displayedStop=latest.name;
      const s=latest.record;
      ctx.ui.notify(`Gauntlet stopped: ${s.stop_reason}. Boundary: ${s.blocked_boundary ?? 'product decision'}. Preserved: ${(s.preserved_progress ?? []).join(', ')}. Certification debt: ${s.certification_debt}. Required: ${s.exact_decision_required}`,'warning');
    }
  };
  pi.on('session_start',displayStop);
  pi.on('tool_result',displayStop); // Thin in-session display, no stop policy or polling.

  let objectiveId: string | null = null;
  const identity = (ctx: any): TelemetryIdentity => ({sessionId:ctx.sessionManager.getSessionId(),role:ctx.agent.kind === 'main' ? 'orchestrator':ctx.agent.name,
    model:`${ctx.model?.provider ?? 'unknown'}/${ctx.model?.id ?? 'unknown'}`,objectiveId,profile:configuration.profile});
  pi.registerCommand('gauntlet-efficiency-status',{description:'Show measurement profile and session binding.',handler:async (_args: string,ctx: any) => {
    ctx.ui.notify(JSON.stringify({ ...configuration,...identity(ctx) }),'info');
  }});
  pi.on('tool_call',async (event: any,ctx: any) => {
    if (event.toolName !== 'task') return;
    const tasks = Array.isArray(event.input?.tasks) ? event.input.tasks : [event.input];
    for (const task of tasks) {
      const rotationId = String(task.task ?? '').match(/\[gauntlet-rotation:([a-f0-9-]{36})\]/)?.[1];
      if (!rotationId) continue;
      try {
        if (!configuration.enabled.includes('rotation')) throw new Error('rotation disabled');
        const grant = JSON.parse(await readFile(path.join(root,'.delivery-local','rotations',`${rotationId}.json`),'utf8'));
        const marker=String(task.task).match(/\[gauntlet-objective:([^\]]+)\]/)?.[1];
        if (marker !== grant.objectiveId || task.agent !== grant.role || task.isolated !== true) throw new Error('rotation identity/isolation mismatch');
        const checkpoint=await validateBuilderCheckpoint(ctx.cwd,grant.checkpoint);
        const packet=await validateContextPacket(ctx.cwd,grant.packet);
        if (!checkpoint.valid || !packet.valid) throw new Error('rotation sources stale');
      } catch (error) { return {block:true,reason:`Invalid Gauntlet rotation: ${error instanceof Error ? error.message : String(error)}`}; }
    }
  });
  pi.on('before_agent_start',async (event: any,ctx: any) => {
    const ids = [...event.prompt.matchAll(/\[gauntlet-objective:([A-Za-z0-9][A-Za-z0-9._-]{0,127})\]/g)].map((match: RegExpMatchArray) => match[1]);
    if (ids.length) objectiveId = new Set(ids).size === 1 ? ids[0] : null;
    const rotationId = event.prompt.match(/\[gauntlet-rotation:([a-f0-9-]{36})\]/)?.[1];
    if (!rotationId) return;
    if (!configuration.enabled.includes('rotation')) throw new Error('Rotation is disabled');
    const file = path.join(root,'.delivery-local','rotations',`${rotationId}.json`);
    const grant = JSON.parse(await readFile(file,'utf8'));
    if (grant.objectiveId !== objectiveId || grant.role !== ctx.agent.name || grant.oldSessionId === ctx.sessionManager.getSessionId()) throw new Error('Invalid fresh builder rotation identity');
    const checkpoint = await validateBuilderCheckpoint(ctx.cwd,grant.checkpoint);
    const packet = await validateContextPacket(ctx.cwd,grant.packet);
    if (!checkpoint.valid || !packet.valid) throw new Error('Rotation sources changed before fresh builder spawn');
    await rename(file,`${file}.consumed`); // A grant may start exactly one new child.
    appendTelemetry(root,identity(ctx),'builder_rotation',{oldSessionId:grant.oldSessionId,newSessionId:ctx.sessionManager.getSessionId(),checkpointBytes:Buffer.byteLength(JSON.stringify(grant.checkpoint))});
  });
  let sessionId: string | null = null;
  pi.on('session_start',(_event: unknown,ctx: any) => { sessionId=ctx.sessionManager.getSessionId(); });
  pi.events.on('gauntlet:objective',(event: {sessionId:string;objectiveId:string}) => {
    if (event.sessionId === sessionId) objectiveId=event.objectiveId;
  });
  if (!configuration.enabled.length) return;
  const z = pi.zod;
  pi.registerTool({name:'gauntlet_runtime',label:'Gauntlet runtime',description:'Opt-in bounded context/memory, checkpoint, fresh seed and verification batch. Never accepts objectives. Request is a JSON object string.',
    parameters:z.object({action:z.enum(['memory_search','map_context','checkpoint','fresh_builder_seed','verify_batch']),objectiveId:z.string(),request:z.string()}),
    execute:async (_id: string,params: {action:RuntimeAction;objectiveId:string;request:string},signal: AbortSignal,_onUpdate: unknown,ctx: any) => {
      const runtime = new GauntletRuntime(ctx.cwd,root,identity(ctx));
      const result = await runtime.execute(params.action,params.objectiveId,JSON.parse(params.request),signal);
      return {content:[{type:'text',text:JSON.stringify(result)}],details:{gauntletRuntime:true,action:params.action}};
    },
  });
}
