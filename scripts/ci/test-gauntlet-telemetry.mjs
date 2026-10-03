import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bindTelemetry } from '../../.omp/extensions/gauntlet-telemetry.js';
import { appendTelemetry, readTelemetry, summarizeTelemetry } from '../../gauntlet/runtime/telemetry.mjs';

const root = mkdtempSync(path.join(tmpdir(),'gauntlet-telemetry-'));
function runtime(sessionId, role, model) {
  const handlers = new Map();
  const commands = new Map();
  const pi = { on: (name,fn) => handlers.set(name,fn), registerCommand: (name,command) => commands.set(name,command) };
  bindTelemetry(pi,{root});
  const ctx = { sessionManager:{getSessionId:()=>sessionId}, agent:{kind:role === 'orchestrator' ? 'main':'sub',name:role}, model:{provider:'nan',id:model} };
  return { emit: (name,event={}) => handlers.get(name)?.(event,ctx), commands, ctx };
}
try {
  const parent = runtime('parent','orchestrator','glm5.3-flash');
  const childA = runtime('child-a','builder-gameplay','qwen3.8-flash');
  const childB = runtime('child-b','builder-structured','deepseek-v4-flash');
  for (const [session,objective] of [[parent,'A'],[childA,'A'],[childB,'B']]) {
    session.emit('session_start');
    session.emit('before_agent_start',{prompt:`[gauntlet-objective:${objective}] implement`});
    session.emit('before_provider_request',{payload:{messages:[{content:'secret not persisted'}]}});
    session.emit('message_end',{message:{role:'assistant',provider:'nan',model:session.ctx.model.id,timestamp:100,
      usage:{input:100,cacheRead:50,cacheWrite:10,output:20},stopReason:'toolUse',
      content:[{type:'toolCall',name:'bash',arguments:{command:'sleep 1'}}]}});
  }
  childA.emit('after_provider_response',{status:429,headers:{Authorization:'must never persist'}});
  childA.emit('auto_retry_start',{attempt:1,delayMs:2000,errorMessage:'secret'});
  childA.emit('before_provider_request',{payload:{}});
  const fallback = {role:'assistant',provider:'nan',model:'fallback-exact',timestamp:200,usage:{input:200,cacheRead:100,cacheWrite:0,output:30},content:[{type:'toolCall',name:'read',arguments:{path:'x'}}]};
  childA.emit('message_end',{message:fallback});
  childA.emit('message_end',{message:fallback}); // detached duplicate is idempotent
  parent.emit('before_agent_start',{prompt:'continue'}); // continuation preserves binding
  const identity = {sessionId:'acceptance',role:'runtime',model:'none',objectiveId:'A',profile:'baseline'};
  appendTelemetry(root,identity,'acceptance_remote_verified',{acceptanceCommit:'a'.repeat(40)});
  let events = readTelemetry(root);
  assert.ok(!JSON.stringify(events).includes('secret'));
  assert.ok(!JSON.stringify(events).includes('Authorization'));
  let report = summarizeTelemetry(events);
  assert.equal(report.profiles[0].processedInputTokens,780);
  assert.equal(report.profiles[0].processedInputTokensPerAcceptedObjective,780); // Includes unaccepted B costs
  assert.equal(report.profiles[0].acceptedObjectives[0].timeToAcceptanceMs >= 0,true);
  const gameplay = report.groups.find(g => g.role === 'builder-gameplay' && g.model === 'nan/qwen3.8-flash' && g.objectiveId === 'A');
  assert.equal(gameplay.calls,2);
  assert.equal(gameplay.waitOnlyModelCalls,1);
  assert.equal(gameplay.retries,1);
  assert.equal(gameplay.rateLimits,1);
  assert.equal(report.groups.find(g => g.model === 'nan/fallback-exact').generations,1);
  assert.equal(report.groups.find(g => g.role === 'builder-structured' && g.generations).objectiveId,'B');
  childB.emit('message_end',{message:{role:'assistant',timestamp:300,content:[]}});
  report = summarizeTelemetry(readTelemetry(root));
  assert.equal(report.profiles[0].coverageComplete,false);
  assert.equal(report.profiles[0].processedInputTokensPerAcceptedObjective,null);
  parent.emit('before_agent_start',{prompt:'[gauntlet-objective:A] [gauntlet-objective:B]'});
  parent.emit('before_provider_request',{payload:{}});
  assert.equal(readTelemetry(root).at(-1).objectiveId,null);
  // Even a real ACCEPT verdict is not an acceptance event; denominator requires remote verification.
  const empty = summarizeTelemetry(events.filter(e => e.type !== 'acceptance_remote_verified'));
  assert.equal(empty.profiles[0].processedInputTokensPerAcceptedObjective,null);
  console.log('PASS OMP main/isolated-child lifecycle telemetry, coverage and acceptance denominator');
} finally { rmSync(root,{recursive:true,force:true}); }
