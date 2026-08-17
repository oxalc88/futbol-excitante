# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage

next_objective_id: BROWSER-5V5-MATCH

best_known:
  commit: e29b116
  note: "SCENARIO-5V5-FIXTURE accepted. Horizon five-vs-five 5/6. Next: BROWSER-5V5-MATCH."

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
  - SCENARIO-5V5-FIXTURE

blocked: []

selection_note: "Horizon five-vs-five: 6 objectives toward 5v5 browser play, defensive AI, pass variety, auto phase transitions. 5/6 accepted. Next: BROWSER-5V5-MATCH."
```

## Last accepted objective

SCENARIO-5V5-FIXTURE — 10-player 5v5 fixture scenario (5 per team) with 2-2-1 formation (2 defenders + 2 midfielders + 1 attacker). 10 control slots, all AI_FALLBACK. Versioned JSON with seed 42, mulberry32-v1, 5400 ticks. Follows existing 2v2/3v3 fixture patterns. Route: `?mode=ai-match-5v5` or `?mode=ai-match&scenario=5v5-fixture`. 42 new tests, 1654/1654 total. HEADLESS audit PASS.

- builder: builder-structured / qwen3.6
- critic: critic-flash / deepseek-v4-flash — ACCEPT (first pass)
- integration: integration-reviewer-flash / deepseek-v4-flash — ACCEPT (first pass)
- Evidence: 42 new tests, 1654/1654 total, deterministic audit PASS
- Commit: e29b116