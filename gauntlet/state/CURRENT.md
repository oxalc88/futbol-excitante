# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage

next_objective_id: BROWSER-CORE-EVIDENCE

best_known:
  commit: e997a538f375f3259297e93606d801bc3c679bc6
  note: "PLAYABLE-1V1-PROFILE-EVALUATION accepted, horizon v6 exhausted. New horizon v7 'playable-1v1-browser-evidence' created."

active_candidate: null
builder_in_use: builder-gameplay
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

blocked: []

selection_note: "Horizon v6 'playable-1v1-enabler' exhausted (6/6 including sentinel). New horizon v7 'playable-1v1-browser-evidence' created. Next: BROWSER-CORE-EVIDENCE."
```
## Last accepted objective

PLAYABLE-1V1-PROFILE-EVALUATION — PLAYABLE_1V1 profile evaluation: runs playable-evaluator against current codebase. Result: INVALID_RUN (browser evidence absent — BROWSER-CORE/BROWSER-1V1 cases, ARCH-DIFF-001 NEEDS_PERCEPTUAL_REVIEW, ARCHETYPE_BLINDED_COMPARISON_PASS NOT_EVALUATED due to no disk artifacts). MUTANT_1V1_PASS = PASS (9 implementable mutants detected). Evaluation infrastructure verified: ARCHETYPE_BLINDED_COMPARISON_PASS evaluated via real code, not placeholder. 47 tests; 554 eval tests, 0 failures. HEADLESS audit PASS. No PES claims. Horizon playable-1v1-enabler 4/4, EXHAUSTED.

- builder: builder-structured / qwen3.6
- critic: critic-mimo / mimo-v2.5 — ACCEPT (first pass, 0 retries, 491s, independence OK)
- integration: integration-reviewer-mimo / mimo-v2.5 — ACCEPT (dependency PASS, evaluator integrity PASS, 0 regressions)
- Evidence: durable acceptance manifest + record (2026-08-20T09:24:09Z)
- Candidate: d6044c8