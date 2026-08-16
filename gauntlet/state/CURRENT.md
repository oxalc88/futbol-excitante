# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage

next_objective_id: MATCH-SET-PIECE

best_known:
  commit: ff5708a
  note: "CPU-3V3-TEAMPLAY accepted. Next: MATCH-SET-PIECE — basic match restart after goals."

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

blocked: []

selection_note: "Horizon small-sided-match: 6 objectives toward 3v3 play. CPU-3V3-TEAMPLAY accepted. Next: MATCH-SET-PIECE."
```

## Last accepted objective

CPU-3V3-TEAMPLAY — Verified CPU adapters work correctly in 3v3 context. No source code changes needed — existing adapter handles passing, shooting, formation recovery, and team decision with 3 teammates. 23 unit tests (passing, shooting, formation recovery, team decision, determinism). 14 integration tests (100-tick simulation, deterministic hashing). 222/222 cpu-adapter, 218/218 integration, 1252/1252 unit all pass. 120-tick trajectory. Deterministic audit PASS.

- builder: builder-structured / qwen3.6
- critic: critic-flash / deepseek-v4-flash — ACCEPT (first pass)
- integration: integration-reviewer-flash / deepseek-v4-flash — ACCEPT (first pass)
- Evidence: 23/23 unit, 14/14 integration, 1252/1252 unit suite, 120-tick trajectory
- Commit: ff5708a