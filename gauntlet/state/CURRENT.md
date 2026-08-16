# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage
next_objective_id: CPU-2V2-SCORING
best_known:
  commit: (pending acceptance)
  note: "CPU-2V2-PASSING accepted — existing passing logic verified for 2v2 topology, 31 unit tests. Advancing to CPU-2V2-SCORING: goal detection, scoring, match reset for 2v2."
active_candidate: CPU-2V2-SCORING
builder_in_use: builder-qwen
critic_in_use: critic-flash
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
  - HEADLESS-CPU-MATCH
  - MATCH-SCORING
  - BROWSER-SCOREBOARD
  - MATCH-LIFECYCLE
  - AI-GOAL-IMPROVEMENT
  - MATCH-ORACLE
  - MATCH-REPLAY-EXTENSION
  - BROWSER-MATCH-PHASE-DISPLAY
  - BROWSER-GOAL-EFFECT
  - CPU-BALL-PURSUIT
  - BROWSER-MATCH-START-URL
  - CPU-PASSING-EVALUATION
  - CPU-TEAMMATE-PASS
  - CPU-MULTI-PLAYER
blocked: []
selection_note: "Horizon playable-browser-v2: browser match-phase overlays, goal effects, CPU ball pursuit (done), match-start URL (done), CPU passing evaluation (done). Horizon exhausted."
```

## Last accepted objective

CPU-2V2-PASSING — Existing CPU adapter passing logic verified for 2v2 topology. No source code changes — 31 new tests cover beyond-shot-range PASS_BIT, pass target direction, multi-tick continuity, shot priority, determinism. 145/145 CPU adapter suite pass.

- builder: builder-qwen / qwen3.6
- critic: critic-flash / deepseek-v4-flash — ACCEPT (first pass, 0 retries)
- integration: integration-reviewer-flash / deepseek-v4-flash — ACCEPT
- Evidence: 31/31 passing tests, 145/145 CPU adapter suite, screenshot artifact (known pipeline limitation)