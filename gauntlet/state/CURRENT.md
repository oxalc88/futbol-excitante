# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage
next_objective_id: CPU-BASIC-FORMATION
best_known:
  commit: (pending acceptance)
  note: "SCENARIO-2V2-FIXTURE accepted. Selector handles ?mode=ai-match&scenario=2v2, 14 CPU adapter independence tests, 11 selector tests, screenshot artifact. Advancing to CPU-BASIC-FORMATION: CPU players maintain basic formation shape."
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

SCENARIO-2V2-FIXTURE — ?mode=ai-match&scenario=2v2 selector routing (scenario-selector.ts checks scenario param inside ai-match branch). 14 CPU adapter independence tests (per-slot routing, non-zero frames, independent movement, determinism). 11 selector tests (BROWSER-SCENARIO-SELECTOR-005). 1282/1282 full suite pass.

- builder: builder-qwen / qwen3.6
- critic: critic-flash / deepseek-v4-flash — ACCEPT (first pass, 0 retries)
- integration: integration-reviewer-flash / deepseek-v4-flash — ACCEPT (scope violation removed)
- Evidence: 14/14 CPU independence tests, 11/11 selector tests, 10/10 fixture structure tests