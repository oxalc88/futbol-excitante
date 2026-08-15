# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage
next_objective_id: HEADLESS-CPU-MATCH
best_known:
  commit: 5b84446
  note: "CPU-GOAL-AWARENESS accepted. CPU steers toward goal, shoots within 15m. 1v1 human-vs-CPU fully playable. Next: headless CPU-vs-CPU match scenario for automated evaluation."
active_candidate:
  objective_id: HEADLESS-CPU-MATCH
  builder: builder-qwen
  critic: critic
  started_from_commit: 5b84446
  last_verdict: null
builder_in_use: builder-qwen
critic_in_use: critic
retry_count: 0
max_retries_per_objective: 3
nan_builder_failures: 0
accepted:
  - BOOTSTRAP-01 through BOOTSTRAP-12
  - FOUNDATION-REGISTRIES through FOUNDATION-PROMOTION
  - CAPABILITY-DESIGN-PROFILE
  - PLAYABLE-FIRST-TOUCH through PLAYABLE-MUTANT-1V1
  - CAPABILITY-PHYSICAL-CONTACT through CAPABILITY-BODY-CONTROL
  - LOCOMOTION-LATERAL-DRIFT
  - CAPABILITY-SWERVE
  - CPU-OPPONENT-1V1
  - BALL-GOAL-COLLISION
  - CPU-GOAL-AWARENESS
blocked: []
selection_note: "CPU-GOAL-AWARENESS accepted. Next: headless CPU-vs-CPU match scenario — a programmatic scenario that runs two CPU adapters in a headless simulation, collects goal events, and enables automated evaluation of the full 1v1 pipeline without browser interaction. PLAYABLE_1V1 remains blocked on perceptual gates (must not invent)."
```

## Last accepted objective

CPU-GOAL-AWARENESS — goal-aware CPU with steering and shooting.

- builder: builder-mimo / mimo-v2.5
- critic: critic / deepseek-v4-flash-0731 — ACCEPT (first pass)
- integration-reviewer: deepseek-v4-flash-0731 — ACCEPT
- commits: 5b84446

## Next action

Delegate HEADLESS-CPU-MATCH to builder-qwen. The objective: create a headless CPU-vs-CPU match program. Instead of running CPU adapters through the browser main.ts loop, create a headless scenario runner that creates two CpuAdapter instances, feeds them observations from the simulation, and collects their input frames. Run for N ticks (e.g., 600 ticks = 10 seconds at 60Hz), record goal events. Add a test that runs this headless match and asserts goal events can fire.