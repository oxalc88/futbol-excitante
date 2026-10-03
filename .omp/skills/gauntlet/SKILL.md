---
name: gauntlet
description: Continue the Gauntlet loop with issue-gated OMP parallelism.
---

Read these files first:

- `AGENTS.md`
- `gauntlet/PROMPT.md`
- `gauntlet/product-flow-contract.md`
- `gauntlet/parallel-issue-contract.md`
- `gauntlet/harness-contract.md`
- `gauntlet/models.json`
- `gauntlet/state/CURRENT.md`
- `gauntlet/state/HORIZON.md`

Follow the canonical Gauntlet pipeline.

For one sequential implementation objective, GitHub issue creation is optional.

For two or more parallel implementation objectives:

1. Build `artifacts/gauntlet/parallel-plan.json` from `gauntlet/parallel-plan.example.json`.
2. Run `pnpm run gauntlet:parallel:sync -- --plan artifacts/gauntlet/parallel-plan.json`.
3. Read `artifacts/gauntlet/parallel-admission.json`.
4. Start only synchronized `READY` objectives.
5. Use one OMP `task` batch.
6. Use no more than five implementation workers.
7. Set `isolated: true` on every builder task.
8. Put `[gauntlet-objective:OBJECTIVE_ID]` in every builder prompt.
9. Use the Gauntlet role recorded for that objective.
10. Do not start a `BLOCKED` objective.

OMP is configured for six NaN requests in flight and five implementation workers. Do not increase these limits during execution.

The project `tool_call` hook blocks a non-compliant parallel builder batch.

After a builder finishes, run the normal deterministic audit, critic, integration review, evidence, acceptance, bookkeeping, and remote-durability pipeline.

Only after canonical acceptance is remotely durable, run:

```bash
pnpm run gauntlet:parallel:complete -- --objective OBJECTIVE_ID
```

Canonical state transitions and final publication remain serialized.
