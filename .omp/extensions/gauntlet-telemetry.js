import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readRuntimeConfiguration } from '../../gauntlet/runtime/configuration.mjs';
import { appendTelemetry, normalizeUsage, isWaitOnly } from '../../gauntlet/runtime/telemetry.mjs';

export const OBJECTIVE_MARKER = /\[gauntlet-objective:([A-Za-z0-9][A-Za-z0-9._-]{0,127})\]/;
// Prepared factories are rebound by OMP to every child: no process-global active objective.
export default function gauntletTelemetry(pi) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  return bindTelemetry(pi, { root, profile: readRuntimeConfiguration(root).profile });
}
export function bindTelemetry(pi, { root, profile: selectedProfile = 'baseline' }) {
  let objectiveId = null;
  const profile = selectedProfile;
  let attemptRateLimited = false;
  const seen = new Set();
  const identity = ctx => ({ sessionId: ctx.sessionManager.getSessionId(),
    role: ctx.agent?.kind === 'main' ? 'orchestrator' : ctx.agent?.name ?? 'unknown',
    model: ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : 'unknown', objectiveId, profile });
  const record = (ctx, type, data) => appendTelemetry(root, identity(ctx), type, data);
  pi.events?.on('gauntlet:objective', event => {
    // Session-scoped binding: sibling children and the parent cannot overwrite each other.
    if (event.sessionId === activeSessionId) objectiveId = event.objectiveId;
  });
  let activeSessionId = null;
  pi.on('before_agent_start', (event,ctx) => {
    const markers = [...event.prompt.matchAll(/\[gauntlet-objective:([^\]]+)\]/g)].map(m => m[1]);
    const ids = [...new Set(markers)];
    const next = ids.length === 1 ? event.prompt.match(OBJECTIVE_MARKER)?.[1] ?? null : null;
    // Unmarked continuation keeps its binding; an ambiguous multi-objective prompt unbinds.
    if (ids.length && next !== objectiveId) { objectiveId = next; if (next) record(ctx,'objective_start',{}); }
    if (ids.length > 1) record(ctx,'coverage_gap',{ reason: 'ambiguous-objective-prompt' });
  });
  pi.registerCommand('gauntlet-objective', {
    description: 'Bind runtime telemetry to one objective before planning/delegation.',
    handler: async (args,ctx) => {
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(args.trim())) throw new Error('A single objective ID is required');
      objectiveId = args.trim(); record(ctx,'objective_start',{});
      pi.events?.emit('gauntlet:objective',{sessionId:ctx.sessionManager.getSessionId(),objectiveId});
    },
  });
  pi.on('before_provider_request', (_event,ctx) => {
    attemptRateLimited = false;
    record(ctx,'provider_request',{});
  });
  pi.on('after_provider_response', (event,ctx) => {
    if (event.status === 429) { attemptRateLimited = true; record(ctx,'rate_limit',{source:'http-response'}); }
  });
  pi.on('message_end', (event,ctx) => {
    const message = event.message;
    if (message.role !== 'assistant') return;
    // Hash only in memory; raw prompts, reasoning, headers and outputs never reach telemetry.
    const fingerprint = createHash('sha256').update(JSON.stringify(message)).digest('hex');
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);
    if (seen.size > 4096) seen.delete(seen.values().next().value);
    const id = { ...identity(ctx), model: `${message.provider ?? ctx.model?.provider ?? 'unknown'}/${message.model ?? ctx.model?.id ?? 'unknown'}` };
    appendTelemetry(root,id,'generation',{usage: normalizeUsage(message.usage),waitOnly: isWaitOnly(message),stopReason:message.stopReason});
    if (message.errorStatus === 429 && !attemptRateLimited) record(ctx,'rate_limit',{source:'assistant-error'});
  });
  pi.on('auto_retry_start', (event,ctx) => record(ctx,'retry',{attempt:event.attempt,delayMs:event.delayMs}));
  pi.on('retry_fallback_applied', (event,ctx) => record(ctx,'model_fallback',{from:event.from,to:event.to}));
  pi.on('session_start', (_event,ctx) => {
    activeSessionId = ctx.sessionManager?.getSessionId();
    if (!ctx.agent || !ctx.sessionManager?.getSessionId) throw new Error('Gauntlet telemetry requires OMP agent identity and session IDs');
    if (ctx.model?.api === 'devin-agent') record(ctx,'coverage_gap',{reason:'provider-hooks-unavailable'});
    record(ctx,'session_start',{});
  });
}
