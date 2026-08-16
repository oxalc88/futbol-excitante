# Gauntlet evals

This suite evaluates the **orchestration system**, not football gameplay. Product/gameplay evaluation remains under `eval/`.

The design adapts patterns from `oxalc88/aws-observability-instrumentation`: closed contracts, bounded failure classes, stable correlation fields, one lifecycle owner per terminal event, static enforcement, executable tests, and minimal content capture.

## Why JSON scenarios

V1 uses JSON so the runner has no parser dependency. The scenario contract is independent from serialization; YAML can be added later without changing evaluator semantics.

## Commands

```bash
pnpm run gauntlet:eval
```

The default command is deterministic and makes no model/API calls.

## Layers

1. **Contract evals** — deterministic checks of evidence, horizon invariants, routing and continuation.
2. **Prompt gate** — static checks that critical rules remain present on the active orchestration surfaces.
3. **Runtime/model evals** — optional later layer that runs the real orchestrator against synthetic state and evaluates the observed trajectory.

## Regression policy

A real orchestration bug should become a compact `ORCH-REG-*` scenario before or together with its fix. The incident record keeps only bounded metadata; do not persist complete prompts, model transcripts, chain-of-thought, credentials or arbitrary tool results.

## Correlation fields

Runtime traces should prefer stable fields such as `run_id`, `horizon_id`, `objective_id`, `attempt_id`, `agent`, `model`, `event`, `verdict`, `failure_class`, duration and token counts. These can later map to OpenTelemetry GenAI semantic conventions without changing the scenario contract.
