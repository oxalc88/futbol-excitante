# OMP Gauntlet adapter

This directory adapts the canonical Gauntlet contracts to OMP.

OMP reads project settings from `.omp/config.yml` in the directory where OMP starts. The project config selects model roles. Project agents live in `.omp/agents/*.md`.

## NaN provider

Do not commit a NaN API key.

OMP custom provider definitions normally live in `~/.omp/agent/models.yml`. Use `models.nan.example.yml` as the repository reference and copy/merge its `nan` provider into your user file.

Set:

```bash
export NAN_API_KEY=...
```

Then verify:

```bash
omp models nan
omp config get modelRoles
```

## Orchestrator

OMP does not require Grok. The OMP adapter uses:

```text
orchestrator -> nan/glm5.3-flash:high
```

The builder and reviewer roles come from `gauntlet/models.json`. OMP uses MiMo 2.6 Flash as the primary critic and GLM 5.3 Flash as the critic fallback. This keeps critic models independent from both current builder routes.

## Parallel work

OMP uses the Gauntlet issue gate before parallel implementation.

The project config sets:

- `task.batch: true`;
- `task.maxConcurrency: 5`;
- `providers.maxInFlightRequests.nan: 6`;
- `task.maxRecursionDepth: 1`;
- `task.isolation.mode: auto`;
- `async.enabled: false`.

The NaN base plan allows seven simultaneous requests across all models. The project keeps one request of headroom.

Before parallel builders:

1. verify `gh auth status`;
2. create `artifacts/gauntlet/parallel-plan.json` from `gauntlet/parallel-plan.example.json`;
3. run `pnpm run gauntlet:parallel:sync -- --plan artifacts/gauntlet/parallel-plan.json`;
4. inspect the `READY` and `BLOCKED` objectives;
5. start only `READY` builders in one isolated OMP `task` batch;
6. include `[gauntlet-objective:OBJECTIVE_ID]` in each builder task.

The project hook blocks a non-compliant parallel builder batch.

For one sequential builder, GitHub issue creation is optional.

After canonical acceptance is persisted and remotely durable, run:

```bash
pnpm run gauntlet:parallel:complete -- --objective OBJECTIVE_ID
```

This closes the accepted issue and recomputes dependent issue readiness.

Use the project skill to start or continue the workflow:

```text
/skill:gauntlet Continue the Gauntlet work.
```

At each skill start or resume, OMP first announces `Gauntlet <version> · <agent-or-role> · <model>`. The version comes from `gauntlet/VERSION.json`; role/model come from the active session, with `unknown` for unavailable fields. No custom startup prompt is needed.

The canonical acceptance transition remains serialized.

## Runtime telemetry and efficiency (0.10.0)

Native `.omp/extensions/` modules observe real parent and child events. Start from the repository root, bind each objective with `/gauntlet-objective ID`, and put its marker in every child assignment. `/gauntlet-efficiency-status` shows the current profile/session binding. Telemetry runs in baseline mode; optimization tools are registered only after a complete measured baseline and explicit local opt-in. See `gauntlet/runtime-efficiency-contract.md` for measurement, compatibility and enablement. OMP keeps its current scheduling/concurrency/retry controls.
