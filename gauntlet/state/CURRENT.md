# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage

next_objective_id: TEAM-EVALUATOR-SUITE

best_known:
  commit: 710c07c
  note: "BROWSER-DIFFICULTY-SETTING accepted. Candidate 710c07c; acceptance bookkeeping in progress."

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

blocked: []

selection_note: "Horizon transition-completion 4/5: BROWSER-DIFFICULTY-SETTING accepted 2026-08-19. Next: TEAM-EVALUATOR-SUITE."
```
## Last accepted objective

BROWSER-DIFFICULTY-SETTING — Browser match difficulty HUD + CPU adapter scaling (browser UI + CPU adapter only): configurable difficulty level (Easy/Medium/Hard) via URL parameter (?difficulty=) and browser select element. Difficulty config modulates 6 base provisional constants deterministically: pressRadiusFactor, pressStrengthFactor, shotAimFactor, shotRangeFactor, facingToleranceFactor, firstTouchRangeFactor. Medium = 1.0 (no change). Easy weakens CPU; Hard strengthens. Observation immutability preserved (difficulty is optional, missing → medium). 20 unit tests on difficulty config + 15 browser tests + 1 capture test; full node suite 1935/1935. Browser 86/86. HEADLESS audit PASS. All coefficients provisional; no PES claims.

- builder: builder-gameplay / mimo-v2.5
- critic: critic-qwen / qwen3.6 — ACCEPT (no required fixes, 86s, 0 retries)
- integration: integration-reviewer-qwen / qwen3.6 — ACCEPT (no regressions, 491s, dependency PASS, evaluator integrity PASS)
- Evidence: durable acceptance manifest + record (2026-08-20T05:06:46Z)
- Candidate: 710c07c