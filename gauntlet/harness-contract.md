# Harness contract

Gauntlet core defines work. A harness adapter defines how that work runs.

## Canonical core

The following are harness-neutral:

- `gauntlet/PROMPT.md`;
- `gauntlet/principles.md`;
- `gauntlet/product-flow-contract.md`;
- `gauntlet/parallel-issue-contract.md`;
- `gauntlet/roles/**`;
- `gauntlet/models.json`;
- evidence, acceptance, and state contracts.

Canonical role contracts must not require Grok, OMP, OpenCode, or another harness command.

## Harness route

`gauntlet/models.json.harness_routes` maps each supported harness to concrete provider/model routes.

A harness may use a different orchestrator model when the preferred model is not available in that harness. The logical role does not change.

Current orchestrator routes:

- Grok -> `grok-4.6`;
- OMP -> `glm5.3-flash` with high reasoning;
- OpenCode -> `grok-4.6`.

## Adapter responsibility

An adapter can define:

- agent file syntax;
- model-role syntax;
- tool permissions;
- launch commands;
- worktree or subagent mechanics;
- provider configuration references.

An adapter must not redefine:

- product priority;
- acceptance criteria;
- evidence semantics;
- critic independence;
- canonical project state.

## Model independence

The reviewer used for a candidate must use a model different from the builder model when the role contract requires independence.

If a route is unavailable, select the next compatible fallback from the same harness route. Do not change the logical objective.

## Parallel execution

The core decides whether objectives are independent. The harness decides how to spawn them.

Before a harness starts more than one implementation objective at the same time, it must satisfy `gauntlet/parallel-issue-contract.md`.

Parallel objectives require:

- synchronized GitHub issues;
- explicit issue dependencies;
- `READY` state for every worker that starts;
- no acceptance dependency between them;
- non-overlapping expected file ownership;
- isolated workspaces/worktrees when they edit files;
- separate tests, evidence, review, and acceptance records.

If the harness cannot create or update GitHub issues, it must use sequential execution.

OMP additionally enforces this rule with a project `tool_call` hook. The hook blocks parallel builder batches that do not have synchronized `READY` issues.

Canonical state transitions are serialized.

## Adapter consistency

CI must verify that committed harness adapters resolve to the model intent in `gauntlet/models.json`.

Historical records keep the exact model and harness that produced them. Do not rewrite old provenance after a routing change.

## Runtime efficiency adapter (0.10.0)

OMP observes native provider/session events through `.omp/extensions/gauntlet-telemetry.js`. Opt-in execution lives in `.omp/extensions/gauntlet-efficiency.ts`; canonical data/validation live in `gauntlet/runtime/`. Baseline measurement precedes optimization. Other harnesses must provide actual event/usage integration before claiming comparable telemetry; they do not inherit OMP telemetry just by loading role prose. Native scheduling, concurrency and retries remain harness-owned. See `runtime-efficiency-contract.md`.

## Product loop (0.11.0)

All three adapters use the same `gauntlet:quality` and `gauntlet:trajectory` commands. Review applicability comes from actual candidate impact, not harness APIs. OMP event extensions, model routes, native concurrency/retry controls, and Grok/OpenCode adapter availability are preserved. A missing non-OMP usage adapter stays UNAVAILABLE rather than inheriting OMP token semantics.

## 0.12.0 verification boundary

All OMP, Grok and OpenCode launch/continue adapters automatically consume the same scoped objective command, certification command, durable proofs, bounded continuation and recovery rules in `product-quality-contract.md`. No core code depends on OMP APIs. Routing, concurrency/retries, telemetry and role independence remain unchanged. A running older session must reload the updated canonical instructions/version before resuming; no bespoke worker prompt can override the deterministic gates.
