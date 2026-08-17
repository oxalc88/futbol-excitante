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
  commit: 15317d2
  note: "BROWSER-5V5-MATCH accepted. Horizon five-vs-five complete (6/6). Next: strategic reassessment needed."

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

blocked: []

selection_note: "Horizon five-vs-five: 6 objectives toward 5v5 browser play, defensive AI, pass variety, auto phase transitions. 6/6 accepted. Horizon complete."
```

## Last accepted objective

BROWSER-5V5-MATCH — Playable 5v5 browser AI match. `?mode=ai-match-5v5` loads 10 CPU players (5 per team) with autonomous CpuAdapter behavior. Hash parity verified against headless: 60-tick and 120-tick deterministic play. HUD, scoreboard, match timer, phase transitions inherited. Screenshot evidence at frame-000.png (7.1KB). 64/64 browser tests, 1654/1654 node tests. BROWSER_VISIBLE audit PASS.

- builder: builder-gameplay / mimo-v2.5
- critic: critic-flash / deepseek-v4-flash — ACCEPT (first pass)
- integration: integration-reviewer-flash / deepseek-v4-flash — ACCEPT (first pass)
- Evidence: 1654 node tests, 64 browser tests, 10-player autonomous CPU, hash parity, screenshot frame-000.png
- Commit: 15317d2

---
## Horizon five-vs-five complete (6/6 accepted)

All 6 objectives of the five-vs-five horizon are accepted. Strategic reassessment needed for next horizon.