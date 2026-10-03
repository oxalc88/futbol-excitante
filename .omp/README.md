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

The builder and reviewer roles come from `gauntlet/models.json`.

## Parallel work

Ask the main OMP session to use the named Gauntlet agents in parallel only for objectives that the Gauntlet horizon marks independent.

OMP Agent Hub can supervise the workers. Editing workers must use isolated worktrees when their tasks can run concurrently.

The canonical acceptance transition remains serialized.
