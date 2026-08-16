# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage
next_objective_id: CPU-MULTI-PLAYER
best_known:
  commit: (pending acceptance)
  note: "CPU-TEAMMATE-PASS accepted. CPU adapter now passes toward nearest forward teammate. Advancing to CPU-MULTI-PLAYER: multiple CPU-controlled players per team."
active_candidate: CPU-MULTI-PLAYER
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
blocked: []
selection_note: "Horizon playable-browser-v2: browser match-phase overlays, goal effects, CPU ball pursuit (done), match-start URL (done), CPU passing evaluation (done). Horizon exhausted."
```

## Last accepted objective

CPU-TEAMMATE-PASS — CPU adapter passes toward the nearest forward teammate instead of blindly along body heading. Added CpuTeammate interface, extended CpuObservation with teammates array and controlledPlayerId, getBestTeammateTarget helper, and fallback to goal-directed movement. 13 new tests (CPU-TEAMMATE-001 through 005), 80/80 CPU adapter tests, 1212/1212 full suite.

- builder: builder-qwen / qwen3.6
- critic: critic-flash / deepseek-v4-flash — ACCEPT (first pass, 0 retries)
- integration: integration-reviewer-flash / deepseek-v4-flash — ACCEPT
- Evidence: 13/13 teammate-pass tests, 80/80 CPU adapter tests, 1212/1212 full suite