# Gauntlet 0.10.0 — measured runtime efficiency

The primary metric is **processed input tokens per accepted objective**. Count every reported conversation input bucket (`input + cacheRead + cacheWrite`), including failed/rejected/unaccepted work in the same measurement profile. Divide by unique objectives whose final acceptance snapshot and remote containment have been verified. This is processed context, not billing. Provider-side orchestration buckets and unavailable failed-request token counts are not inferred.

## Baseline before optimization

The default is `baseline`: runtime telemetry runs and all five optimization capabilities are disabled. There are no invented baseline numbers in this release. A live OMP run with the user's configured provider is required to collect them. Tests exercise the real extension handlers with OMP-shaped events without paid inference.

Start OMP from this repository. Native discovery loads `.omp/extensions/*.js|ts` and rebinds their factories into children. The adapter was checked against OMP 18.5.1 source `can1357/oh-my-pi@d4d49e71bef3ac1420d45febf215b951decf5ae9`: `docs/extensions.md`, `docs/extension-loading.md`, `extensibility/extensions/types.ts`, and `extensibility/shared-events.ts`. An older runtime without child `ctx.agent` identity is unsupported. Check `/gauntlet-efficiency-status` and telemetry files before a measurement run; extension load errors must be fixed before claiming coverage.

1. Bind the parent with `/gauntlet-objective OBJECTIVE_ID` before objective planning/delegation. All child assignments, including critic, integration, auxiliary and committer, carry `[gauntlet-objective:OBJECTIVE_ID]`. Shared batch context must not contain markers for other objectives. Unmarked continuation retains a binding; ambiguous markers unbind and flag incomplete coverage.
2. Run the normal product-first and issue-gated pipeline. Do not change routes or OMP native controls for the baseline.
3. After the final acceptance/bookkeeping commit is published, run `mise run gauntlet-telemetry -- accepted OBJECTIVE_ID FULL_ACCEPTANCE_COMMIT`. The command checks canonical acceptance at that exact snapshot, fetches origin/main, and verifies ancestry. A critic verdict, issue closure, prepared checkpoint, or local candidate commit never increments the denominator.
4. Export `mise run gauntlet-telemetry -- report` to `.delivery-local/baseline-report.json`. The report has separate exact role/model/objective groups and baseline/optimized profiles. Unknown usage/attribution or known hook coverage gaps make the primary metric `null`. No accepted objective also yields `null`. Output from mise/pnpm command wrappers should not be redirected into the JSON: use `mise exec -- node scripts/gauntlet/telemetry.mjs report > .delivery-local/baseline-report.json`.
5. Review the baseline, then explicitly opt in using the local configuration below and restart OMP. Do not switch profiles halfway through an objective. Compare similar product objectives and retain rejected/unaccepted costs; do not compare historical audits as if they were today's limits or a current baseline.

```json
{
  "profile": "optimized",
  "baseline_report": ".delivery-local/baseline-report.json",
  "enabled": ["memory", "context", "checkpoints", "rotation", "verification"]
}
```

Save to `.delivery-local/efficiency.json` only after review. Validation rejects missing/incomplete baselines. Enable one capability at a time for attribution. Remove the file and restart to return to baseline. Rotation requires context and checkpoints.

## Real event connection and precision

`gauntlet-telemetry.js` subscribes to `before_provider_request` (provider submissions), `message_end` (final assistant generations and actual normalized usage), `after_provider_response` (HTTP 429), `auto_retry_start` (OMP automatic retries), and `retry_fallback_applied`. Every child gets its own session/objective binding; the assistant message's provider/model wins over the current model for generation attribution. Duplicate detached final messages are deduplicated. Provider hooks see raw payloads/headers but persist none of them.

Reported metrics include processed input and output tokens, calls/generations, peak context, retries/rate limits, observed wait-only calls, packet bytes/estimated tokens, selected memory topics, checkpoint bytes/estimated tokens, confirmed fresh-child rotations and wall-clock time from the first bound objective event through remote-verified acceptance. Model fallback events are retained. Peak context uses provider `contextTokens` when available and conversation input buckets otherwise. Packet/checkpoint token sizes are explicitly byte/4 estimates, never provider usage.

Wait-only means every dispatched tool call in a generation is an explicit wait/await or a bare `sleep`; text-only turns are unknown, never guessed from narrative. The observer records OMP auto-retry events and surfaced HTTP 429 signals. OpenAI-compatible transports may retry HTTP calls inside a single submission without firing these hooks; therefore retry/rate-limit counters are explicitly scoped to surfaced events and `transportAttempts` is `null`. No second retry loop is installed. Devin-agent does not expose the provider hooks and produces a coverage gap. Side turns/compaction on runtimes that do not emit final assistant usage are an additional coverage limitation: exclude these runs until the missing usage is ingested. The report requires reconciled provider-submission/generation counts; unreported side turns, compaction or exposed extra transport submissions make coverage incomplete and the primary metric null. No timing or token field is fabricated as zero when usage is absent.

Events append synchronously to separate session JSONL files under `.delivery-local/telemetry/`, shared by prepared factories rebound into isolated children. Packet/checkpoint/action metrics come from actual `gauntlet_runtime` execution, and rotation metrics come from the new child's lifecycle, not from a rotation decision. Corrupt event files fail reporting visibly. Local runtime logs are diagnostic sidecars; they do not replace canonical acceptance/evidence/state or observer truth. If aggregate telemetry is needed remotely, include a compact snapshot in the normal bookkeeping commit, never rewrite a candidate's immutable evidence.

## Optimized OMP execution

When enabled, the adapter registers `gauntlet_runtime` with `action`, `objectiveId`, and a JSON object string in `request`. The action must match the session binding. Builders can checkpoint and batch verification; only the orchestrator prepares context and fresh seeds. Critics and integration reviewers retain their existing read-only contract.

- `memory_search`: query the validated memory previews. Only active, bounded, current-digest topics may be selected; proposed, superseded, stale, invalid and duplicate topics are excluded. Memory summarizes knowledge and links current canonical files. It never grants acceptance or owns orchestration state.
- `map_context`: pass `ContextMappingRequest` from `runtime/context-mapper.ts`. Small obvious tasks bypass search. The deterministic read-only mapper caps searches, file count and bytes; it creates a digest-bound packet with summary, files, memory decisions, tests, dependencies, risks, conflicts and skills. The builder still inspects canonical sources. Memory summaries are included only after source validation.
- `checkpoint`: pass `BuilderCheckpoint` fields from `runtime/builder-checkpoint.ts`, omitting generated schema/digest fields. `builderSessionId` must equal the executing child. Changes, relevant files and evidence are hashed. Save at a completed implementation boundary with behavior, actual test results, remaining failures and next action; never include reasoning, full logs, credentials or verdict authority. Deleted-file checkpoints are currently unsupported: keep that builder without rotation until a representable safe boundary exists.
- `fresh_builder_seed`: parent passes `{ "safeBoundary": true, "materiallyDifferent": true, "nextPhase": "neighbor-verification" }` after the old child finishes and OMP applies its patch. Remap a packet whose sources changed during implementation. Actual prior telemetry must exceed a configurable soft context/input/generation budget. The returned native task has the same objective and builder role, `isolated: true`, a bounded packet/checkpoint and a one-use rotation marker. It carries no previous conversation. Launch it through the normal OMP task tool and existing READY issue gate. Source revalidation blocks stale grants before task dispatch; a new child consumes the grant and emits the rotation event. Safe boundaries are workflow declarations backed by persisted files, not automatic interruption mid-edit.
- `verify_batch`: pass `{ "commands": [{ "id": "typecheck", "command": ["mise", "run", "typecheck"] }] }` containing every required check for the phase. Commands run sequentially without a shell, under the native tool's cancellation signal. Complete logs stay in local artifacts. One bounded summary contains every exit status and failure excerpt. Empty/duplicate batches, crashes and invalid exits cannot report PASS. This batches result delivery; it does not decide which acceptance/evidence checks may be skipped or claim a measured model wake count.

Budgets in `runtime-policy.json` are local tunables. They are not provider facts. Default builder budgets are deliberately model-independent and must be evaluated against baseline telemetry.

## Scheduling evaluation

| Historical component | 0.10.0 decision | Reason |
| --- | --- | --- |
| TPM governor | Omit | Its historical provider/model bucket limits are stale. A second admission queue would compete with OMP provider concurrency. Reconsider only with observed current quotas and a native adapter gap. |
| Shared backoff | Omit | OMP owns automatic retry/fallback and transport delays; observe these events rather than sleeping twice. |
| Wait coordinator/controller | Omit | OMP already owns synchronous task batches, child settlement and background jobs. Verification returns once per batch without another wake controller. |

The current OMP concurrency configuration, role routing, issue admission, isolation and serialized acceptance remain canonical. No historical governor, scheduler or retry controller is installed. Existing harness-neutral provider-failure limits remain policy, but OMP must implement retries once at the native layer, not add a second Gauntlet retry loop.

## Preserved guarantees and provenance

Product-first horizons, READY GitHub issue admission for parallel implementation, file ownership, isolated workspaces, independent critic, integration review, executable evidence gates, candidate provenance, separate acceptance/bookkeeping commit, state audit and remote containment are unchanged. Packets, memory, checkpoints and telemetry can neither accept nor advance canonical state.

The selected modules are individually ported and hardened from `66be461a562f11d567972f5d4597be8942587d46`, not cherry-picked. No historical VERSION/RELEASE, state/horizon, routing or Grok wrappers are imported. `1a4553968adc2d00cc32094e4d3f046aa2a0743e` and its `gauntlet-token-audit.md`/`qwen-token-audit.md` are historical design evidence: growing repeated input and inherited builder context motivate checkpoints and batched verification. Historical rate limits and model assumptions are not current facts.
