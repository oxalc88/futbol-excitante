---
name: gauntlet-eval
description: Run deterministic Gauntlet orchestration regression scenarios and the static prompt contract gate. Use before merging prompt, routing, horizon, evidence, continuation, tracking, handoff, or stop-condition changes.
user-invocable: true
disable-model-invocation: true
model: gemma4
---

Run the repository-local deterministic orchestration evaluation suite:

```bash
pnpm run gauntlet:eval
```

Report every failing `ORCH-REG-*` scenario and prompt-gate check.

When validating persisted acceptance state, also run:

```bash
pnpm run gauntlet:eval:state
```

The live state audit checks that the latest accepted objective in `CURRENT.md` is tracked in `TIMING.md` according to `gauntlet/timing-contract.md`, including usage and model-evaluation rows/markers. Do not edit generated Gauntlet state merely to silence the audit; the orchestrator must refresh it from real session/review data. Never invent missing metrics.

The default `gauntlet:eval` is deterministic and should not make model/API calls. The state audit reads local persisted state. Runtime/model evals are a separate optional layer.
