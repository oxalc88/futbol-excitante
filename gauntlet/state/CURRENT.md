# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage

next_objective_id: BROWSER-CONTROLLED-PLAYER-INDICATOR

best_known:
  commit: b1cc042
  note: "BROWSER-PLAYER-SWITCH accepted. Horizon human-vs-cpu 1/5. Next: BROWSER-CONTROLLED-PLAYER-INDICATOR."

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
  - BROWSER-5V5-MATCH
  - BROWSER-PLAYER-SWITCH

blocked: []

selection_note: "Horizon human-vs-cpu: 5 objectives toward playable human-vs-CPU with player switching, visual indicator, 5v3 mode, improved CPU attack, and directional passing. 1/5 accepted. Next: BROWSER-CONTROLLED-PLAYER-INDICATOR."
```

## Last accepted objective

BROWSER-PLAYER-SWITCH — Tab-key player switching for human-controlled slot in human-vs-CPU browser modes. SWITCH_PLAYER_BIT (1<<3) added to InputFrame contract. Keyboard Tab mapped to switch. setControlledPlayer on Simulation API cycles controlledPlayerId through eligible teammates. Fix: nextEligiblePlayer reads from live simulation snapshot, not static scenario data. 71/71 browser tests, 1654/1654 node tests. BROWSER_VISIBLE audit PASS (semantic audit VALID for SHA collision).

- builder: builder-gameplay / mimo-v2.5
- critic: critic-flash / deepseek-v4-flash — ACCEPT (retry 1: fixed live-state read)
- integration: integration-reviewer-flash / deepseek-v4-flash — ACCEPT (evidence independently verified)
- Evidence: 71 browser tests, 1654 node tests, screenshot, semantic audit VALID
- Commit: b1cc042