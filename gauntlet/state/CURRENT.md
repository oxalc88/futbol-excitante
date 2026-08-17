# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage

next_objective_id: SCENARIO-5V5-FIXTURE

best_known:
  commit: 490d773
  note: "BROWSER-3V3-HUMAN-VS-CPU accepted. Horizon five-vs-five 4/6. Next: SCENARIO-5V5-FIXTURE."

active_candidate: null
builder_in_use: null
critic_in_use: null
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
  - BROWSER-2V2-PLAYABLE
  - CPU-TEAM-DECISION-PROFILE
  - SCENARIO-3V3-FIXTURE
  - CPU-3V3-FORMATION
  - CPU-3V3-TEAMPLAY
  - MATCH-SET-PIECE
  - BROWSER-3V3-MATCH
  - MATCH-TIMER-ENFORCEMENT
  - CPU-DEFENSIVE-IMPROVEMENT
  - CPU-PASS-VARIETY
  - BROWSER-3V3-HUMAN-VS-CPU

blocked: []

selection_note: "Horizon five-vs-five: 6 objectives toward 5v5 browser play, defensive AI, pass variety, auto phase transitions. 4/6 accepted. Next: SCENARIO-5V5-FIXTURE."
```

## Last accepted objective

BROWSER-3V3-HUMAN-VS-CPU — 3v3 human-vs-CPU browser mode. `?mode=human-vs-ai-3v3` loads 6 players (3 per team), 1 HUMAN keyboard slot + 2 CPU teammates vs 3 CPU opponents. 1-2 formation with defender/midfielder/attacker roles. 6 CPU slots verified independent. All constants provisional. 90/90 node files, 12/12 browser files. BROWSER_VISIBLE audit PASS.

- builder: builder-gameplay / mimo-v2.5
- critic: critic-flash / deepseek-v4-flash — ACCEPT (first pass)
- integration: integration-reviewer-flash / deepseek-v4-flash — ACCEPT (first pass)
- Evidence: 1612 node tests, 56 browser tests, deterministic audit PASS, screenshot frame-000.png
- Commit: 490d773