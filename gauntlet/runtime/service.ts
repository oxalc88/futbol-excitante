import { mkdir, readFile, rename, writeFile, stat } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readRuntimeConfiguration } from './configuration.mjs';
import { appendTelemetry, readTelemetry, type TelemetryIdentity } from './telemetry.mjs';
import { searchMemory, validateMemory, loadMemoryTopics } from './memory.js';
import { mapObjectiveContext, type ContextMappingRequest } from './context-mapper.js';
import { validateContextPacket, type ObjectiveContextPacket } from './context-packet.js';
import { createBuilderCheckpoint, validateBuilderCheckpoint, seedFreshBuilder, type BuilderCheckpoint } from './builder-checkpoint.js';
import { decideBuilderRotation } from './builder-rotation.js';
import { runVerificationBatch, type VerificationCommand, type VerificationExecution } from './verification-batch.js';
import { approximateTokens, isSafeObjectiveId, resolveRepositoryFile } from './digest.js';
import { RUNTIME_POLICY } from './policy.js';

const execFileAsync = promisify(execFile);
export type RuntimeAction = 'memory_search' | 'map_context' | 'checkpoint' | 'fresh_builder_seed' | 'verify_batch';
export const ACTION_CAPABILITY: Record<RuntimeAction,string> = { memory_search:'memory', map_context:'context', checkpoint:'checkpoints', fresh_builder_seed:'rotation', verify_batch:'verification' };
export class GauntletRuntime {
  readonly configuration;
  constructor(readonly repoRoot: string, readonly collectorRoot: string, readonly identity: TelemetryIdentity) {
    this.configuration = readRuntimeConfiguration(collectorRoot);
  }
  private record(type: string, data: Record<string, unknown>): void { appendTelemetry(this.collectorRoot,this.identity,type,data); }
  private async save(kind: string, name: string, value: unknown): Promise<string> {
    const directory = path.join(this.collectorRoot,'.delivery-local',kind);
    await mkdir(directory,{recursive:true});
    const file = path.join(directory,`${name}.json`);
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary,`${JSON.stringify(value,null,2)}\n`);
    await rename(temporary,file);
    return path.relative(this.collectorRoot,file);
  }
  private async load<T>(kind: string, objectiveId: string): Promise<T> {
    return JSON.parse(await readFile(path.join(this.collectorRoot,'.delivery-local',kind,`${objectiveId}.json`),'utf8')) as T;
  }
  async execute(action: RuntimeAction, objectiveId: string, request: any, signal?: AbortSignal): Promise<unknown> {
    if (!isSafeObjectiveId(objectiveId)) throw new Error('Invalid objective ID');
    if (!this.configuration.enabled.includes(ACTION_CAPABILITY[action])) throw new Error(`${action} is disabled; measure a baseline first`);
    if (this.identity.objectiveId !== objectiveId) throw new Error('Runtime objective must match the session binding');
    if (['checkpoint','verify_batch'].includes(action) && !this.identity.role.startsWith('builder-')) throw new Error('Only builders may checkpoint or verify implementation');
    if (['map_context','fresh_builder_seed'].includes(action) && this.identity.role !== 'orchestrator') throw new Error('Only the orchestrator may prepare delegation');
    if (action === 'memory_search') {
      const previews = await searchMemory(this.repoRoot,String(request.query),RUNTIME_POLICY.memory.initial_topic_limit);
      // Search returns bounded previews only. Actual retrieval is tracked when selected for a packet.
      return {nonAuthoritative:true,previews};
    }
    if (action === 'map_context') {
      const mapping = request as ContextMappingRequest;
      if (mapping.objectiveId !== objectiveId) throw new Error('Mapping objective mismatch');
      const loaded = await loadMemoryTopics(this.repoRoot);
      const validity = await validateMemory(this.repoRoot);
      const invalidPaths = new Set(validity.issues.map(issue => issue.path));
      for (const decision of mapping.selectedMemoryTopics) {
        if (!this.configuration.enabled.includes('memory')) throw new Error('Memory retrieval is disabled');
        const topic = loaded.topics.find(topic => topic.topicKey === decision.topicKey);
        if (!topic || topic.status !== 'active' || invalidPaths.has(topic.path) || validity.needsReview.includes(topic.topicKey) ||
            JSON.stringify([...topic.canonicalRefs].sort()) !== JSON.stringify([...decision.canonicalRefs].sort())) throw new Error('Memory selection is stale or invalid');
        decision.summary = topic.summary;
      }
      const result = await mapObjectiveContext(this.repoRoot,{
        search: async (query,limit) => {
          const result = await execFileAsync('rg',['--files','-g',query],{cwd:this.repoRoot,maxBuffer:64000}).catch(error => {
            if (error.code === 1) return {stdout:''}; throw error;
          });
          return result.stdout.split(/\r?\n/).filter(Boolean).slice(0,limit);
        },
        read: async relativePath => {
          const file = await resolveRepositoryFile(this.repoRoot,relativePath);
          if ((await stat(file)).size > RUNTIME_POLICY.objective_context.mapper_read_maximum_bytes) throw new Error('Mapper source file exceeds read budget');
          return readFile(file,'utf8');
        },
      },mapping);
      const file = await this.save('context',objectiveId,result.packet);
      this.record('context_packet',{bytes:Buffer.byteLength(JSON.stringify(result.packet)),estimatedTokens:approximateTokens(result.packet),mapper:result.metrics});
      this.record('memory_retrieved',{topics:mapping.selectedMemoryTopics.map(topic => topic.topicKey)});
      return {file,packet:result.packet,metrics:result.metrics};
    }
    if (action === 'checkpoint') {
      if (request.objectiveId !== objectiveId || request.builderSessionId !== this.identity.sessionId) throw new Error('Checkpoint must belong to this builder');
      const checkpoint = await createBuilderCheckpoint(this.repoRoot,request);
      const validation = await validateBuilderCheckpoint(this.repoRoot,checkpoint);
      if (!validation.valid) throw new Error(validation.issues.join('; '));
      const file = await this.save('checkpoints',objectiveId,checkpoint);
      this.record('checkpoint',{bytes:Buffer.byteLength(JSON.stringify(checkpoint)),estimatedTokens:validation.estimatedTokens});
      return {file,checkpoint};
    }
    if (action === 'fresh_builder_seed') {
      const packet = await this.load<ObjectiveContextPacket>('context',objectiveId);
      const checkpoint = await this.load<BuilderCheckpoint>('checkpoints',objectiveId);
      const packetValidation = await validateContextPacket(this.repoRoot,packet);
      const checkpointValidation = await validateBuilderCheckpoint(this.repoRoot,checkpoint);
      if (!packetValidation.valid || !checkpointValidation.valid) throw new Error('Fresh builder seed has stale or invalid sources; remap context/checkpoint first');
      const events = readTelemetry(this.collectorRoot).filter(event => event.sessionId === checkpoint.builderSessionId && event.objectiveId === objectiveId);
      const generations = events.filter(event => event.type === 'generation');
      const usage = {sessionId:checkpoint.builderSessionId,model:events.find(event => event.type === 'generation')?.model ?? '',
        phase:checkpoint.phase,contextTokens:Math.max(0,...generations.map(event => event.data.usage?.peakContext ?? 0)),
        cumulativeSuccessfulInputTokens:generations.reduce((n,event) => n+(event.data.usage?.processedInputTokens ?? 0),0),
        generationCount:generations.length,peakContextTokens:0};
      const decision = decideBuilderRotation(usage,{safe:request.safeBoundary === true,workPersisted:true,checkpointValid:true,
        nextPhase:String(request.nextPhase),materiallyDifferent:request.materiallyDifferent === true},RUNTIME_POLICY.builder_budget);
      if (!decision.rotate) return {decision};
      const oldRole = events.find(event => event.role.startsWith('builder-'))?.role;
      if (!oldRole) throw new Error('Cannot rotate an uninstrumented builder');
      const seed = seedFreshBuilder({objectiveId,roleContract:`gauntlet/roles/${oldRole}.md`,contextPacket:packet,checkpoint,
        selectedMemoryTopicPaths:[],canonicalRefs:packet.files.map(file => file.path)});
      const rotationId = randomUUID();
      await this.save('rotations',rotationId,{objectiveId,oldSessionId:checkpoint.builderSessionId,role:oldRole,checkpoint,packet});
      return {decision,rotationId,task:`[gauntlet-objective:${objectiveId}] [gauntlet-rotation:${rotationId}]\nRead ${seed.roleContract}. Resume from this non-authoritative seed; inspect current sources and preserve all acceptance gates.\n${JSON.stringify(seed)}`,
        agent:oldRole,isolated:true};
    }
    if (action === 'verify_batch') {
      const commands = request.commands as VerificationCommand[];
      const batchId = randomUUID();
      const directory = path.join(this.collectorRoot,'.delivery-local','verification',batchId);
      await mkdir(directory,{recursive:true});
      const result = await runVerificationBatch(commands,{run: async command => {
        if (!/^[A-Za-z0-9._-]+$/.test(command.id)) throw new Error('Unsafe verification command ID');
        const started = Date.now();
        const logPath = path.join(directory,`${command.id}.log`);
        // Stream complete output to an artifact; only one bounded summary reaches the model.
        const { createWriteStream } = await import('node:fs');
        const log = createWriteStream(logPath);
        return new Promise<VerificationExecution>((resolve,reject) => {
          let tail = '';
          const child = spawn(command.command[0]!,command.command.slice(1),{cwd:this.repoRoot,shell:false,signal,timeout:RUNTIME_POLICY.verification.timeout_ms,env:{...process.env,CI:'1'}});
          const capture = (chunk: Buffer) => { tail = (tail+chunk.toString()).slice(-12000); };
          child.stdout.pipe(log,{end:false}); child.stderr.pipe(log,{end:false});
          child.stdout.on('data',capture); child.stderr.on('data',capture);
          log.on('error',error => { child.kill(); reject(error); });
          child.on('error',error => { log.end(); reject(error); });
          child.on('close',(code,termination) => { log.end(() => resolve({exitCode:code ?? 1,stdout:tail,stderr:termination ? `terminated: ${termination}`:'',
            artifactPath:path.relative(this.collectorRoot,logPath),durationMs:Date.now()-started})); });
        });
      }});
      const file = await this.save('verification',batchId,result);
      this.record('verification_batch',{commands:commands.length,status:result.status,summaryBytes:Buffer.byteLength(JSON.stringify(result))});
      return {file,...result};
    }
    throw new Error('Unknown Gauntlet runtime action');
  }
}
