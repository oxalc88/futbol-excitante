# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage

next_objective_id: CPU-PASS-VARIETY

best_known:
  commit: b499017
  note: "CPU-DEFENSIVE-IMPROVEMENT accepted. Horizon five-vs-five 2/6. Next: CPU-PASS-VARIETY."

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

blocked: []

selection_note: "Horizon five-vs-five: 6 objectives toward 5v5 browser play, defensive AI, pass variety, auto phase transitions. 2/6 accepted. Next: CPU-PASS-VARIETY."
```

## Last accepted objective

CPU-DEFENSIVE-IMPROVEMENT — CPU defender behavior with tracking, pressing, marking distance, and defensive sub-modes. Added DefensiveSubMode (NONE/PRESSING/MARKING/RECOVERING), findMostThreateningOpponent, findBallCarrierPlayer, computeMarkOffsetPosition. Configurable PRESS_RADIUS=12m, MARKING_DISTANCE=5m, PRESS_STRENGTH=1.3×. Formation pull reduced for marking defenders. All constants provisional. 238/238 cpu-adapter unit tests, 239/239 integration tests. 100-tick trajectory. MULTI_TICK audit PASS.

- builder: builder-gameplay / mimo-v2.5
- critic: critic-flash / deepseek-v4-flash — ACCEPT (first pass)
- integration: integration-reviewer-flash / deepseek-v4-flash — ACCEPT (first pass)
- Evidence: 238/238 unit, 239/239 integration, 100-tick trajectory, deterministic audit PASS
- Commit: b499017