# Gauntlet timing and model tracking contract

`gauntlet/state/TIMING.md` is acceptance persistence, not optional commentary. Refresh it after every accepted objective and before delegating the acceptance commit.

## Sources and honesty

Use real session/runtime data when available, such as Grok session metadata, subagent `meta.json`, child `updates.jsonl`, builder/reviewer reports, and `HISTORY.md` verdicts. Never invent duration, token, cache, cost, or model-quality numbers.

If a metric is unavailable, write `n/a` and state why. Estimated values must be labeled as estimates. Processed prompt tokens are not provider-billed tokens unless the provider exposes that exact billing field.

Gauntlet 0.9.7 runtime adapters persist available raw operational summaries under ignored `.delivery-local/` paths. On the next accepted-objective refresh, aggregate them by exact role, model and session without copying conversations or tool logs into `TIMING.md`.

Where exposed, record input, output, cached input, generations, context peak, cumulative processed input, duration, retries, rate limits, compactions, phase boundaries and fresh-session rotations. GLM records rolling-60 input maximum, admission waits and backoff events. Builders record rotation context, old cumulative input, fresh starting context and checkpoint size. Mapping/memory records mapper input/output, topics retrieved, canonical files selected, packet size, initial builder context and measurable continuation re-reads. Missing provider fields remain `n/a`.

## Machine-readable refresh markers

The YAML metadata block near the top of `TIMING.md` must include:

```yaml
tracking_contract_version: 2
last_tracked_objective: <objective-id>
usage_aggregates_through: <objective-id>
model_evaluation_through: <objective-id>
clock_aggregates_through: <objective-id>
```

All four objective markers must equal the latest accepted objective before the acceptance commit is delegated. Advancing the first three markers while leaving the global Clock/aggregate section anchored to older totals is invalid bookkeeping.

## Required update after each accepted objective

1. Add or refresh the objective row under `## Per-step time and tokens`, including the actual builder/critic/integration/commit timing and prompt/completion usage when available.
2. Refresh the relevant `## By model (tokens and wall)` aggregates from the actual session data. Keep role/model identities separate; do not merge orchestration and bookkeeping simply because they used the same model family.
3. Refresh the global `## Clock` / session aggregate values whenever their source rows changed. If exact reconstruction is unavailable, keep unknown values as `n/a` or explicitly estimated rather than retaining known-stale totals. Set `clock_aggregates_through` only after this refresh is complete.
4. Add or refresh the objective under `### Per-objective grade` using the existing difficulty/retry grading policy for builder performance.
5. Add or refresh the objective under `### Reviewer route and catches` with this shape:

```markdown
| Step | Orchestrator | Builder | Critic | Critic path | Integrator | Final gate | Fallbacks / incidents |
|---|---|---|---|---|---|---|---|
```

Record model IDs, critic retry/reject path, integration verdict, final orchestrator gate, reviewer fallbacks, and any relevant `ORCH-REG-*`/incident IDs. This table evaluates reviewer/orchestrator behavior without pretending that token count alone measures quality.

6. Refresh derived builder/model scoreboards when their source rows changed. Reviewer quality should be interpreted from catches/misses, fallback frequency, latency/usage, and later-gate reversals rather than from raw token count alone.
7. Set the four machine-readable objective markers only after the per-step usage, model aggregates, global clock aggregates, and model-evaluation entries are actually refreshed.

## Acceptance gate

Before `git-committer` receives an acceptance commit, run:

```bash
pnpm run gauntlet:eval:state
```

The audit must pass. A tracking failure is bookkeeping/persistence work for the orchestrator; it does not send an already accepted implementation back to the builder and does not justify inventing metrics.
