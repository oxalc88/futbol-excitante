# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage

next_objective_id: ARCHETYPE-BLINDED-COMPARISON

best_known:
  commit: b155671
  note: "TEAM-EVALUATOR-SUITE accepted, horizon transition-completion EXHAUSTED (5/5). New horizon 'playable-1v1-enabler' created."

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

blocked: []

selection_note: "Horizon transition-completion EXHAUSTED (5/5). New horizon 'playable-1v1-enabler' v6 created. Next: ARCHETYPE-BLINDED-COMPARISON."
```
## Last accepted objective

TEAM-EVALUATOR-SUITE — Team evaluator suite: MUTANT_TEAM_PASS reducer (9 implementable mutants against 3v3 context, detect+clean → PASS, deferred → NOT_EVALUATED, missing → INVALID_RUN) and TEAM_SHAPE_SUITE_PASS reducer (16 TEAM_SUITE tests against 3v3 scenario, checks COMMON-FINITE/REFERENCES/BOUNDS, reduces to PASS/FAIL/NOT_EVALUATED/INVALID_RUN). Enables SMALL_SIDED_SHAPE milestone evaluation. Structured TypeScript work in eval/ layer. 53 new tests (34 mutant-team + 19 team-shape); full node suite 1675/1675. HEADLESS audit PASS. No PES claims. Horizon transition-completion EXHAUSTED (5/5). New horizon 'playable-1v1-enabler' v6 created.

- builder: builder-structured / qwen3.6
- critic: critic-mimo / mimo-v2.5 — ACCEPT (first pass, 0 retries, 426s, independence OK)
- integration: integration-reviewer-mimo / mimo-v2.5 — ACCEPT (dependency PASS, evaluator integrity PASS, 0 regressions)
- Evidence: durable acceptance manifest + record (2026-08-20T05:59:49Z)
- Candidate: 0c5e328