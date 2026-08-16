---
name: gauntlet-eval
description: Run deterministic Gauntlet orchestration regression scenarios and the static prompt contract gate. Use before merging prompt, routing, horizon, evidence, continuation, handoff, or stop-condition changes.
user-invocable: true
disable-model-invocation: true
model: gemma4
---

Run the repository-local orchestration evaluation suite:

```bash
pnpm run gauntlet:eval
```

Report every failing `ORCH-REG-*` scenario and prompt-gate check. Do not edit generated Gauntlet state to make a scenario pass. Fix the orchestration rule, contract or implementation that caused the regression.

This default eval is deterministic and should not make model/API calls. Runtime/model evals are a separate layer.
