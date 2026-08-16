# Gauntlet evals

This suite evaluates the **orchestration system**, not football gameplay. Product/gameplay evaluation remains under `eval/`.

The design adapts patterns from `oxalc88/aws-observability-instrumentation`: closed contracts, bounded failure classes, stable correlation fields, one lifecycle owner per terminal event, static enforcement, executable tests, and minimal content capture.

## Why JSON scenarios

V1 uses JSON so the runner has no parser dependency. The scenario contract is independent from serialization; YAML can be added later without changing evaluator semantics.

## Commands

Deterministic regression suite:

```bash
pnpm run gauntlet:eval
```

Optional model-backed smoke eval:

```bash
pnpm run gauntlet:eval:model
```

The default command makes no model/API calls. The model-backed command consumes the configured model's allowance/tokens and should be used after prompt/model-routing changes, not on every ordinary gameplay commit.

Useful overrides:

```bash
GAUNTLET_EVAL_SCENARIOS=ORCH-REG-004 pnpm run gauntlet:eval:model
GAUNTLET_EVAL_AGENT=orchestrator GAUNTLET_EVAL_MODEL=grok-4.6 pnpm run gauntlet:eval:model
```

By default model eval uses `orchestrator-deepseek` with `deepseek-v4-flash`. The model under test is the real configured model; the judge is deterministic and compares the returned structured decision against the scenario `expect`.

## Layers

1. **Contract evals** — deterministic checks of evidence, horizon invariants, routing and continuation.
2. **Prompt gate** — static checks that critical rules remain present on the active orchestration surfaces.
3. **Runtime/model evals** — optional headless runs of the real orchestrator/model against synthetic scenarios. The runner tells the model not to call tools or touch live project state.
4. **Incident artifacts** — failed deterministic, prompt-gate or model evals write compact JSON under `gauntlet/evals/artifacts/incidents/` (gitignored).

A project hook is intentionally not part of v1. Grok Build publicly documents lifecycle hooks and `PreToolUse`, but this implementation does not assume an unverified session-end blocking event contract.

## Regression policy

A real orchestration bug should become a compact `ORCH-REG-*` scenario before or together with its fix. Incident artifacts keep only bounded metadata; do not persist complete prompts, model transcripts, chain-of-thought, credentials or arbitrary tool results.

Incidents are evidence, not self-modifying instructions. A failed run may suggest `scenario_candidate: true`, but prompts/rules are changed only through normal review.

## Correlation fields

Runtime traces/incidents should prefer stable fields such as `run_id`, `horizon_id`, `objective_id`, `attempt_id`, `agent`, `model`, `event`, `verdict`, `failure_class`, duration and token counts. These can later map to OpenTelemetry GenAI semantic conventions without changing the scenario contract.
