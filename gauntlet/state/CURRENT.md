# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: BOOTSTRAP
next_objective_id: BOOTSTRAP-01
best_known:
  commit: null
  note: "Repository starts without an implementation. There is no best-known engine commit yet."
active_candidate: null
builder_in_use: null
critic_in_use: null
retry_count: 0
max_retries_per_objective: 3
nan_builder_failures: 0
accepted: []
blocked: []
selection_note: "BOOTSTRAP-01 is the initial objective only because the repo has no toolchain or src/. After acceptance, reassess from evidence rather than walking the catalog in order."
```

## Repo snapshot

Empty implementation is expected. Present sources:

- `VISION.md`
- `BOOTSTRAP_PLAN.md`
- `research/`
- `specs/`
- `gauntlet/`
- OpenCode agents under `.opencode/`

## Next action

Inspect the tree. If the toolchain and `src/` are still absent, delegate `BOOTSTRAP-01` to `builder-qwen`. After that, pick the next gap from current state, evidence, research, and specs.
