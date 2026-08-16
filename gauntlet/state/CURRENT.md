# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage
next_objective_id: BROWSER-2V2-PLAYABLE
best_known:
  commit: (working tree)
  note: "BROWSER-2V2-MATCH-KEYBOARD accepted — 2v2 browser match with keyboard controls. 4-player scenario (2 per team), slot-1 HUMAN keyboard, slots 2-4 AI_FALLBACK CPU. Routing via ?mode=2v2. 1382 node tests, 33 browser tests. Advancing to BROWSER-2V2-PLAYABLE: full playable 2v2 match in browser."
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
  - SCENARIO-2V2-FIXTURE
  - CPU-BASIC-FORMATION
  - BROWSER-HUMAN-VS-CPU
  - CPU-2V2-PASSING
  - CPU-2V2-SCORING
  - CPU-TEAM-FORMATION
  - BROWSER-2V2-MATCH-KEYBOARD
blocked: []
selection_note: "Horizon playable-browser-v2 exhausted (all objectives accepted). Continuing horizon 2v2-playable."
```

## Last accepted objective

BROWSER-2V2-MATCH-KEYBOARD — 2v2 browser match with keyboard controls. 4-player scenario (2 per team), slot-1 HUMAN keyboard, slots 2-4 AI_FALLBACK CPU. 12 fixture tests, 3 browser tests. 1382 node tests (73 files), 33 browser tests (7 files). Screenshot at docs/screenshots/BROWSER-2V2-MATCH-KEYBOARD/.

- builder: builder-mimo / mimo-v2.5
- critic: critic-flash / deepseek-v4-flash — ACCEPT (first pass, 0 retries)
- integration: integration-reviewer-flash / deepseek-v4-flash — ACCEPT (first pass)
- Evidence: 12/12 fixture tests, 33/33 browser tests, 1382/1382 full suite, screenshot artifact