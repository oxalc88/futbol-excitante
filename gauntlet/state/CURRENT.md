# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage
next_objective_id: CPU-BALL-PURSUIT
best_known:
  commit: (pending acceptance)
  note: "CPU-BALL-PURSUIT accepted. Advancing to next horizon objective: CPU-BALL-PURSUIT was test-verification (pursuit mode already existed). Next: CPU-BALL-PURSUIT is done, next pending index 3 = CPU-BALL-PURSUIT... wait. current_index is 2 which is CPU-BALL-PURSUIT. After acceptance, advance to 3 = BROWSER-MATCH-START-URL."
active_candidate: null
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
blocked: []
selection_note: "Horizon playable-browser-v2: browser match-phase overlays, goal effects, CPU ball pursuit (done), match-start URL, CPU passing evaluation."
```

## Last accepted objective

CPU-BALL-PURSUIT — pursuit mode test-verification (CPU already pursued ball). 33 new tests protect existing behavior. Bug fixes: telemetry, ball-system import, mutant event shapes.

- builder: builder-qwen / qwen3.6
- critic: critic-flash / deepseek-v4-flash — ACCEPT (first pass, 0 retries)
- integration: integration-reviewer / deepseek-v4-flash (flash) — ACCEPT
- Evidence: 33 pursuit tests in tests/unit/cpu-adapter/pursuit.test.ts (33/33 PASS, no regressions)

## Next action

Advance to next horizon objective: BROWSER-MATCH-START-URL — Support launching a running CPU-vs-CPU match from browser URL (?mode=ai-match).