# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage

next_objective_id: SCENARIO-3V3-FIXTURE

best_known:
  commit: 63904f1
  note: "CPU-TEAM-DECISION-PROFILE accepted. Next: scenario fixture for 3v3 (6 players, 3 per team)."

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

blocked: []

selection_note: "Horizon small-sided-match: 6 objectives toward 3v3 play. CPU-TEAM-DECISION-PROFILE accepted. Next: SCENARIO-3V3-FIXTURE."
```

## Last accepted objective

CPU-TEAM-DECISION-PROFILE — Team-level decision profile that coordinates CPU players per team with ATTACK/DEFEND/BALANCED strategy signal. Pure state machine in adapter layer, shared via CpuObservation.teamDecision. Formation modulation: ATTACK reduces pull, DEFEND strengthens it. 176/176 CPU adapter tests, 27/27 arch tests, 195/195 integration tests. 601-hash trajectory. Deterministic audit PASS.

- builder: builder-gameplay / mimo-v2.5
- critic: critic-flash / deepseek-v4-flash — ACCEPT (first pass)
- integration: integration-reviewer-flash / deepseek-v4-flash — ACCEPT (first pass)
- Evidence: 176/176 unit, 27/27 arch, 195/195 integration, MULTI_TICK trajectory, slot-wiring verified
- Commit: 63904f1