import { appendFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const SCHEMA = 'gauntlet-telemetry-v1';
export function appendTelemetry(root, identity, type, data = {}, now = Date.now()) {
  const directory = path.join(root, '.delivery-local', 'telemetry');
  mkdirSync(directory, { recursive: true });
  const event = { schema: SCHEMA, id: randomUUID(), at: now, ...identity, type, data };
  // One append per event; each session owns its file, including isolated OMP children.
  appendFileSync(path.join(directory, `${encodeURIComponent(identity.sessionId)}.jsonl`), `${JSON.stringify(event)}\n`);
  return event;
}
export function readTelemetry(root) {
  const directory = path.join(root, '.delivery-local', 'telemetry');
  let names;
  try { names = readdirSync(directory); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return names.filter(name => name.endsWith('.jsonl')).flatMap(name =>
    readFileSync(path.join(directory, name), 'utf8').split('\n').filter(Boolean).map(line => {
      const event = JSON.parse(line); // Corrupt/partial telemetry fails visibly; never silently undercounts.
      if (event.schema !== SCHEMA) throw new Error(`Unsupported telemetry: ${name}`);
      return event;
    }));
}
const token = value => Number.isSafeInteger(value) && value >= 0;
export function normalizeUsage(usage) {
  if (!usage || !['input', 'output', 'cacheRead', 'cacheWrite'].every(key => token(usage[key]))) return null;
  const processedInputTokens = usage.input + usage.cacheRead + usage.cacheWrite;
  if (processedInputTokens === 0 && usage.output === 0) return null; // OMP initializes absent usage with zeros.
  return { processedInputTokens, outputTokens: usage.output,
    peakContext: token(usage.contextTokens) ? usage.contextTokens : processedInputTokens,
    contextPrecision: token(usage.contextTokens) ? 'provider' : 'input-buckets',
    cacheRead: usage.cacheRead, cacheWrite: usage.cacheWrite };
}
export function isWaitOnly(message) {
  const calls = (message.content ?? []).filter(item => item.type === 'toolCall');
  if (!calls.length) return null; // Text-only turns have no reliable wait-only classification.
  return calls.every(call => ['wait', 'await', 'await_task'].includes(call.name) ||
    (call.name === 'bash' && /^\s*sleep\s+\d+(?:\.\d+)?\s*$/.test(call.arguments?.command ?? '')));
}
export function summarizeTelemetry(events) {
  const unique = [...new Map(events.map(event => [event.id, event])).values()].sort((a,b) => a.at-b.at);
  const groups = new Map();
  const accepted = new Map();
  const started = new Map();
  for (const event of unique) {
    const { objectiveId, profile = 'baseline', role, model, type, data } = event;
    const objectiveKey = JSON.stringify([profile, objectiveId]);
    if (objectiveId && type === 'objective_start' && !started.has(objectiveKey)) started.set(objectiveKey, event.at);
    if (objectiveId && type === 'acceptance_remote_verified' && !accepted.has(objectiveKey)) accepted.set(objectiveKey, event);
    const key = JSON.stringify([profile, objectiveId, role, model]);
    if (!groups.has(key)) groups.set(key, { profile, objectiveId, role, model, processedInputTokens: 0, outputTokens: 0,
      calls: 0, generations: 0, peakContext: 0, retries: 0, rateLimits: 0, waitOnlyModelCalls: 0,
      unknownWaitClassification: 0, missingUsageGenerations: 0, contextPackets: [], memoryTopicsRetrieved: 0,
      builderRotations: 0, checkpoints: [], coverageGaps: 0 });
    const group = groups.get(key);
    if (type === 'provider_request') group.calls++;
    if (type === 'generation') {
      group.generations++;
      if (data.usage) {
        group.processedInputTokens += data.usage.processedInputTokens;
        group.outputTokens += data.usage.outputTokens;
        group.peakContext = Math.max(group.peakContext, data.usage.peakContext);
      } else group.missingUsageGenerations++;
      if (data.waitOnly === true) group.waitOnlyModelCalls++;
      if (data.waitOnly === null) group.unknownWaitClassification++;
    }
    if (type === 'retry') group.retries++;
    if (type === 'rate_limit') group.rateLimits++;
    if (type === 'coverage_gap') group.coverageGaps++;
    if (type === 'context_packet') group.contextPackets.push({ bytes: data.bytes, estimatedTokens: data.estimatedTokens });
    if (type === 'memory_retrieved') group.memoryTopicsRetrieved += data.topics.length;
    if (type === 'builder_rotation') group.builderRotations++;
    if (type === 'checkpoint') group.checkpoints.push({ bytes: data.bytes, estimatedTokens: data.estimatedTokens });
  }
  const profiles = [...new Set(unique.map(e => e.profile ?? 'baseline'))].map(profile => {
    const rows = [...groups.values()].filter(g => g.profile === profile);
    const objectives = [...accepted.entries()].filter(([,event]) => event.profile === profile).map(([key,event]) => {
      const related = rows.filter(g => g.objectiveId === event.objectiveId);
      const start = started.get(key);
      return { objectiveId: event.objectiveId, acceptanceCommit: event.data.acceptanceCommit,
        processedInputTokens: related.reduce((n,g) => n+g.processedInputTokens,0),
        timeToAcceptanceMs: start === undefined ? null : event.at-start };
    });
    const processedInputTokens = rows.reduce((n,g) => n+g.processedInputTokens,0);
    const providerCalls = rows.reduce((n,g) => n+g.calls,0);
    const generations = rows.reduce((n,g) => n+g.generations,0);
    const complete = providerCalls === generations && !rows.some(g => g.coverageGaps || g.missingUsageGenerations ||
      (g.objectiveId === null && (g.calls || g.generations)));
    return { profile, processedInputTokens, acceptedObjectives: objectives,
      processedInputTokensPerAcceptedObjective: objectives.length && complete ? processedInputTokens/objectives.length : null,
      coverageComplete: complete, providerCalls, generations };
  });
  return { schema: SCHEMA, precision: 'processed-input-not-billed', retryPrecision: 'omp-auto-retry-events', rateLimitPrecision: 'surfaced-http-429', transportAttempts: null, groups: [...groups.values()], profiles };
}
