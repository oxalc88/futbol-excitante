# Parallel issue contract

Gauntlet 0.13.0 uses one GitHub issue per substantial product outcome. Execution units under that issue follow `product-first-contract.md` and the canonical DAG; one issue receives one integrated acceptance. The independent-objective compatibility path below remains available when outcomes are truly independent.

Issues do not replace `gauntlet/state/**`, acceptance manifests, or evidence.

## Sequential execution

When one implementation objective runs at a time:

- GitHub issue creation is optional.
- The normal Gauntlet pipeline can start from the validated horizon.

## Parallel execution

Before two or more implementation objectives run at the same time:

1. build a parallel plan;
2. synchronize one GitHub issue for each candidate objective;
3. resolve dependencies;
4. check expected file ownership;
5. classify each objective as `READY` or `BLOCKED`;
6. start only synchronized `READY` objectives.

No synchronized `READY` issue means no parallel implementation worker.

If GitHub write capability is unavailable, run sequentially.

## Required plan fields

Each objective must define:

- `objective_id`
- `title`
- `goal`
- `player_visible_outcome`
- `dependencies`
- `expected_file_ownership`
- `acceptance_criteria`
- `test_plan`
- `evidence_required`
- `gauntlet_role`

Use `gauntlet/parallel-plan.example.json` as the shape.

## READY

An objective is `READY` only when:

- all dependencies are already accepted;
- expected file ownership does not overlap another candidate objective;
- it does not claim `gauntlet/state/**`;
- its builder role is known;
- its issue was synchronized successfully.

Otherwise it is `BLOCKED`.

## Issue states

The coordination states are:

```text
BLOCKED -> READY -> IN_PROGRESS -> REVIEW -> ACCEPTED
```

The corresponding GitHub labels are:

```text
gauntlet:blocked
gauntlet:ready
gauntlet:in-progress
gauntlet:review
gauntlet:accepted
```

Issue state does not accept an objective.

Only the canonical Gauntlet pipeline can accept an objective.

## OMP admission

OMP uses a project `tool_call` hook.

For a parallel builder batch, the hook requires:

- two to five implementation workers;
- a valid `artifacts/gauntlet/parallel-admission.json`;
- a synchronized `READY` issue for every objective;
- `isolated: true` for every builder;
- `[gauntlet-objective:OBJECTIVE_ID]` in every builder task;
- the builder agent to match the objective's Gauntlet role.

The hook blocks the `task` call when these conditions fail.

## NaN limits

For the NaN base plan:

- the provider allows 7 simultaneous requests across all models;
- Gauntlet allows at most five implementation workers;
- OMP allows at most six NaN requests in flight.

This leaves one provider request of headroom.

The project also sets `task.maxRecursionDepth: 1` so implementation workers cannot create another uncontrolled worker tier.

## Completion

After canonical acceptance is persisted and the final acceptance commit is remotely durable:

```bash
pnpm run gauntlet:parallel:complete -- --objective OBJECTIVE_ID
```

The command:

- marks the issue `ACCEPTED`;
- closes it;
- records the objective as accepted in the coordination plan;
- recomputes dependent objectives;
- promotes newly unblocked issues to `READY`.

Do not close an issue because a builder finished or tests passed.
