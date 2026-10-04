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
- `gauntlet/runtime-efficiency-contract.md`
- `gauntlet/memory-context-contract.md`
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

After a builder finishes, run the deterministic impact plan, baseline/affected checks, audit, required critic/integration reviews, evidence, acceptance, bookkeeping, and remote-durability pipeline.

If this objective has a synchronized parallel issue, only after canonical acceptance is remotely durable, run:

```bash
pnpm run gauntlet:parallel:complete -- --objective OBJECTIVE_ID
```

Canonical state transitions and final publication remain serialized.

Before objective planning/delegation, bind `/gauntlet-objective OBJECTIVE_ID`. Include `[gauntlet-objective:OBJECTIVE_ID]` in every builder, critic, integration, aux and committer assignment. Keep other objective markers out of shared batch context. Telemetry is active in baseline mode; all optimizations start disabled. After the existing remotely durable acceptance step, run `mise run gauntlet-telemetry -- accepted OBJECTIVE_ID FULL_ACCEPTANCE_COMMIT`. Do not enable optimizations until a complete baseline is measured and reviewed. Enabled `gauntlet_runtime` actions prepare bounded context, safe checkpoints, fresh task seeds and verification batches. Fresh parallel tasks still use the READY issue gate. No additional TPM governor, backoff or wait controller may compete with OMP.

Apply `gauntlet/product-quality-contract.md` for deterministic review/assurance applicability. Follow `gauntlet/trajectory-contract.md` at Horizon selection, first normal play and completion. Horizon ACCEPT requires a materially better normal shipped-play result; otherwise iterate. These canonical rules apply to this harness without changing its model routes or scheduling.
