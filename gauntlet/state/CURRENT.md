# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage
next_objective_id: null
best_known:
  commit: (pending acceptance)
  note: "BROWSER-HUMAN-VS-CPU accepted. ?mode=human-vs-ai URL routing, slot-1 keyboard + 3 AI_FALLBACK CPU adapters. 1283/1283 suite pass. Horizon cpu-team-play exhausted (5/5 objectives accepted)."
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
  - BROWSER-MATCH-START-URL
  - CPU-PASSING-EVALUATION
  - CPU-TEAMMATE-PASS
  - CPU-MULTI-PLAYER
blocked: []
selection_note: "Horizon playable-browser-v2: browser match-phase overlays, goal effects, CPU ball pursuit (done), match-start URL (done), CPU passing evaluation (done). Horizon exhausted."
```

## Last accepted objective

BROWSER-HUMAN-VS-CPU — ?mode=human-vs-ai URL routing. 4-player fixture: slot-1 HUMAN, slots 2-4 AI_FALLBACK. Browser keyboard adapter for HUMAN slot + per-slot CPU adapters for AI_FALLBACK. 16 selector tests, 1283/1283 full suite pass.

- builder: builder-mimo / mimo-v2.5 (crashed mid-run, work complete)
- critic: critic-flash / deepseek-v4-flash — RETRY (screenshot quality)
- integration: integration-reviewer-flash / deepseek-v4-flash — ACCEPT
- Evidence: 16/16 selector tests, 1283/1283 full suite, screenshot artifact (known pipeline limitation)