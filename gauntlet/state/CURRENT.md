# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage

next_objective_id: CPU-3V3-FORMATION

best_known:
  commit: 55feb7b
  note: "SCENARIO-3V3-FIXTURE accepted. Next: CPU-3V3-FORMATION — extend formation system for 3v3 player counts."

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

blocked: []

selection_note: "Horizon small-sided-match: 6 objectives toward 3v3 play. SCENARIO-3V3-FIXTURE accepted. Next: CPU-3V3-FORMATION — extend formation system for 3v3 player counts."
```

## Last accepted objective

SCENARIO-3V3-FIXTURE — 3v3 scenario fixture with 6 CPU-controlled players (3 per team) in a 1-2 formation. Versioned JSON fixture, scenario selector route, 6 AI_FALLBACK slots. 32 unit tests, 9 integration tests. 1438/1438 node tests, 40/40 browser tests, 204/204 integration tests. 61-hash trajectory. Deterministic audit PASS.

- builder: builder-structured / qwen3.6
- critic: critic-flash / deepseek-v4-flash — ACCEPT (first pass)
- integration: integration-reviewer-flash / deepseek-v4-flash — ACCEPT (first pass)
- Evidence: 32/32 unit, 9/9 integration, 204/204 integration suite, 61-hash trajectory, slot-wiring verified
- Commit: 55feb7b