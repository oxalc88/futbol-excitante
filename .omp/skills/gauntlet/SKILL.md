---
name: gauntlet
description: Continue the product-first Gauntlet loop with native OMP execution.
---

Read these files first:

- `AGENTS.md`
- `gauntlet/PROMPT.md`
- `gauntlet/VERSION.json`
- `gauntlet/product-flow-contract.md`
- `gauntlet/parallel-issue-contract.md`
- `gauntlet/harness-contract.md`
- `gauntlet/runtime-efficiency-contract.md`
- `gauntlet/memory-context-contract.md`
- `gauntlet/models.json`
- `gauntlet/state/CURRENT.md`
- `gauntlet/state/HORIZON.md`

Before any other status prose or delegation, print one compact startup line using the version read from `gauntlet/VERSION.json` and the active session role and model:

`Gauntlet <version> · <agent-or-role> · <model>`

Use the active session model, not a guessed configured default. If the role or model cannot be determined from the session, report `unknown` for that field. Repeat this announcement when the skill starts or resumes work; do not require a custom user prompt.

Follow the canonical Gauntlet pipeline.

For failed checks, use the focused repair flow in `gauntlet/product-quality-contract.md`. `REPAIR_PASS` is diagnostic only; complete the normal scoped command after repair, reusing only validated PASS evidence and executing missing coverage. Do not repeat the full battery or bypass the canonical incident.

Follow `gauntlet/product-first-contract.md` and `gauntlet:control -- continue` for incident recovery, continuation, execution units and structured external-decision stops. Policy is canonical; this adapter adds no stop rules.

For one sequential implementation objective, GitHub issue creation is optional.

For two or more temporary units under one product issue, run `gauntlet:control -- execution --objective <parent>` and use the returned canonical ready units in an isolated native task batch. Include `[gauntlet-objective:<parent>] [gauntlet-unit:<unit>]`. Units integrate before one product acceptance.

For genuinely independent parallel implementation objectives:

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

Before objective planning/delegation, bind `/gauntlet-objective OBJECTIVE_ID`. Include `[gauntlet-objective:OBJECTIVE_ID]` in every builder, critic, integration, aux and committer assignment. Keep other objective markers out of shared batch context. Telemetry is active in baseline mode; all optimizations start disabled. After the existing remotely durable acceptance step, run `mise run gauntlet-telemetry -- accepted OBJECTIVE_ID FULL_ACCEPTANCE_COMMIT`. Do not enable optimizations until a complete baseline is measured and reviewed. Enabled `gauntlet_runtime` actions prepare bounded context, safe checkpoints, fresh task seeds and verification batches. Fresh tasks use canonical DAG readiness under one product issue, or READY issue admission for independent objectives. No additional TPM governor, backoff or wait controller may compete with OMP.

Apply `gauntlet/product-quality-contract.md` for deterministic review/assurance applicability. Follow `gauntlet/trajectory-contract.md` at Horizon selection, first normal play and completion. Horizon ACCEPT requires a materially better normal shipped-play result; otherwise iterate. These canonical rules apply to this harness without changing its model routes or scheduling.

For 0.13.0, objective verification uses `gauntlet:quality -- --base <candidate-parent> --execute --out docs/evidence/<id>/quality.json`. Whole-repository certification uses `gauntlet:quality -- --stage certification --target HEAD --execute --out docs/evidence/CERT-<boundary>/quality.json` with committed inputs. Read the canonical product-quality contract for bootstrap, evidence reuse, full-risk escalation and certificate publication. Publish certificates separately with remote containment. Milestone evaluation requires `--target <certified-sha>` and playtest evidence naming that exact target. Model routing, native scheduling and acceptance durability remain unchanged.
