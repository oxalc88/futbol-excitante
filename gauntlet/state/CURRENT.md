# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage

next_objective_id: ARCH-DIFF-001-RUBRIC

best_known:
  commit: e38daff264dfbb4587d700234604518ae32b5a45
  note: "BROWSER-CORE-EVIDENCE accepted. RESET-001 and STEP-001 browser-cases.json loadable; DYNAMIC_VISUAL frames recaptured after critic RETRY."

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
  - BROWSER-CONTROLLED-PLAYER-INDICATOR
  - BROWSER-5V3-HUMAN-VS-CPU
  - CPU-ATTACKING-IMPROVEMENT
  - HUMAN-PASS-DIRECTION-CONTROL
  - HUMAN-SHOT-DIRECTION-CONTROL
  - HUMAN-THROUGH-BALL
  - CPU-INTERCEPTION-AWARENESS
  - BROWSER-MATCH-SETUP-MENU
  - BROWSER-MATCH-STATS
  - CPU-ATTACKING-ORGANIZATION
  - CPU-DEFENSIVE-ORGANIZATION
  - MATCH-CORNER-KICK
  - BROWSER-PLAYER-ANIMATION
  - BROWSER-UI-POLISH
  - MATCH-THROW-IN
  - MATCH-GOAL-KICK
  - CPU-TACTICAL-AWARENESS
  - BROWSER-DIFFICULTY-SETTING
  - TEAM-EVALUATOR-SUITE
  - ARCHETYPE-BLINDED-COMPARISON
  - PLAYABLE-SECOND-TOUCH
  - PLAYABLE-CONTROL-SLOT-ROUTING
  - PLAYABLE-1V1-PROFILE-EVALUATION
  - BROWSER-CORE-EVIDENCE

blocked: []

selection_note: "Horizon v7 'playable-1v1-browser-evidence' 1/5. BROWSER-CORE-EVIDENCE accepted. Next: ARCH-DIFF-001-RUBRIC."
```
## Last accepted objective

BROWSER-CORE-EVIDENCE — Durable BROWSER-CORE-RESET-001 and BROWSER-CORE-STEP-001 evidence: browser-cases.json + trajectory + four 800x600 semantic frames (after critic RETRY on identical 205x460 crops). Profile runner loads the JSON; those two cases PASS when present, remain INVALID_RUN when absent. No PLAYABLE_1V1_PASS claim. DYNAMIC_VISUAL audit PASS.

- builder: builder-gameplay / mimo-v2.5
- critic: critic / deepseek-v4-flash — ACCEPT (retry 1: recapture distinct frames, independence OK)
- integration: integration-reviewer / deepseek-v4-flash — ACCEPT (dependency PASS, evaluator integrity PASS, neighboring tests PASS)
- Evidence: durable acceptance manifest + record (2026-08-22T04:30:14Z)
- Candidate: e38daff