---
name: gauntlet-eval-model
description: Run optional model-backed Gauntlet regression scenarios against the real configured orchestrator model. Use after prompt/model-routing changes when deterministic gauntlet:eval already passes.
user-invocable: true
disable-model-invocation: true
model: gemma4
argument-hint: optional scenario IDs, e.g. ORCH-REG-004
---

First run the zero-cost deterministic suite:

```bash
pnpm run gauntlet:eval
```

If it passes, run the model-backed smoke eval. By default it tests `orchestrator-deepseek` on current `deepseek-v4-flash`:

```bash
pnpm run gauntlet:eval:model
```

To select scenarios:

```bash
GAUNTLET_EVAL_SCENARIOS=ORCH-REG-004 pnpm run gauntlet:eval:model
```

To test another configured agent/model:

```bash
GAUNTLET_EVAL_AGENT=orchestrator GAUNTLET_EVAL_MODEL=grok-4.6 pnpm run gauntlet:eval:model
```

The runner passes synthetic state in the prompt and tells the model not to call tools, spawn agents, or touch live project state. The judge is deterministic: the returned structured decision must match the scenario `expect`. This command consumes model allowance/tokens; do not put it in the default `pnpm test` path.

On failure, report the scenario and the generated gitignored incident artifact under `gauntlet/evals/artifacts/incidents/`. Do not edit generated Gauntlet state to make the eval pass.
