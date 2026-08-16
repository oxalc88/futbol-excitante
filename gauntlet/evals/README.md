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

Live persisted-state audit used before an acceptance commit:

```bash
pnpm run gauntlet:eval:state
```

Optional model-backed smoke eval:

```bash
pnpm run gauntlet:eval:model
```

`gauntlet:eval` makes no model/API calls and does not depend on mutable live state. `gauntlet:eval:state` reads `CURRENT.md` and `TIMING.md` and verifies that the latest accepted objective has matching tracking markers, a per-step usage row, a builder-evaluation row, and a reviewer/orchestrator evaluation row. The model-backed command consumes the configured model's allowance/tokens and should be used after prompt/model-routing changes, not on every ordinary gameplay commit.

Useful model-eval overrides:

```bash
GAUNTLET_EVAL_SCENARIOS=ORCH-REG-004 pnpm run gauntlet:eval:model
GAUNTLET_EVAL_AGENT=orchestrator GAUNTLET_EVAL_MODEL=grok-4.6 pnpm run gauntlet:eval:model
```

By default model eval uses `orchestrator-deepseek` with `deepseek-v4-flash`. The model under test is the real configured model; the judge is deterministic and compares the returned structured decision against the scenario `expect`.

## Layers

1. **Contract evals** — deterministic checks of evidence, browser screenshot requirements, horizon invariants, reviewer routing, continuation, and tracking completeness.
2. **Prompt gate** — static checks that critical evidence/continuation/tracking rules remain present on the active orchestration surfaces.
3. **Live state audit** — verifies the last accepted objective is actually represented in `TIMING.md` according to `gauntlet/timing-contract.md`. This is an acceptance-time gate rather than a normal CI dependency because persisted Gauntlet state is mutable.
4. **Runtime/model evals** — optional headless runs of the real orchestrator/model against synthetic scenarios. The runner tells the model not to call tools or touch live project state.
5. **Incident artifacts** — failed deterministic, prompt-gate or model evals write compact JSON under `gauntlet/evals/artifacts/incidents/` (gitignored).

A project hook is intentionally not part of v1. Grok Build publicly documents lifecycle hooks and `PreToolUse`, but this implementation does not assume an unverified session-end blocking event contract.

## Current regressions

- `ORCH-REG-001`: gameplay/presentation acceptance with missing screenshot.
- `ORCH-REG-002`: duplicate horizon objective IDs.
- `ORCH-REG-003`: explicit 0731 reviewer fallback routing.
- `ORCH-REG-004`: stale accepted `active_candidate` must repair and continue.
- `ORCH-REG-005`: browser-visible/browser-interactive acceptance with missing screenshot.
- `ORCH-REG-006`: acceptance tracking is incomplete when TIMING usage/model evaluation is stale.

## Tracking contract

`gauntlet/timing-contract.md` defines the persisted model-usage and model-quality requirements. Metrics must come from real session/review data. Missing fields are `n/a` with a reason; they are never fabricated. Token volume is usage evidence, not a quality score. Builder quality, reviewer catches/misses, integration reversals, fallback frequency, orchestration incidents, latency, and usage are tracked separately.

## Regression policy

A real orchestration bug should become a compact `ORCH-REG-*` scenario before or together with its fix. Incident artifacts keep only bounded metadata; do not persist complete prompts, model transcripts, chain-of-thought, credentials or arbitrary tool results.

Incidents are evidence, not self-modifying instructions. A failed run may suggest `scenario_candidate: true`, but prompts/rules are changed only through normal review.

## Correlation fields

Runtime traces/incidents should prefer stable fields such as `run_id`, `horizon_id`, `objective_id`, `attempt_id`, `agent`, `model`, `event`, `verdict`, `failure_class`, duration and token counts. These can later map to OpenTelemetry GenAI semantic conventions without changing the scenario contract.


## v0.7 deterministic audit

`pnpm run gauntlet:audit -- --objective <id> --class <class> ...` is the pre-critic filesystem/state gate. It emits `PASS`, `FAIL`, or `REVIEW_REQUIRED` with an owner per check. `REVIEW_REQUIRED` is the only path to bounded cheap semantic review.

`GAUNTLET_ACCEPTANCE_JSON='<json>' pnpm run gauntlet:acceptance:persist` writes a candidate acceptance record only after deterministic PASS, semantic VALID when invoked, critic ACCEPT, integration ACCEPT, and builder/critic model independence. `pnpm run gauntlet:eval:state` then checks post-bookkeeping state before final acceptance.
