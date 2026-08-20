# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage

next_objective_id: PLAYABLE-1V1-PROFILE-EVALUATION

best_known:
  commit: 505e056
  note: "PLAYABLE-CONTROL-SLOT-ROUTING accepted. Candidate 505e056; acceptance bookkeeping in progress."

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

blocked: []

selection_note: "Horizon playable-1v1-enabler 3/4: PLAYABLE-CONTROL-SLOT-ROUTING accepted 2026-08-20. Next: PLAYABLE-1V1-PROFILE-EVALUATION."
```
## Last accepted objective

PLAYABLE-CONTROL-SLOT-ROUTING — Slot ownership and player switching: stable slot→player mapping (findSlotForPlayer, getSlotTeamId, isSlotActive), Tab-key cycling via computeExplicitSwitchTarget (NEXT/PREVIOUS, deterministic sorted, edge-triggered), slot-keyed maps prevent cross-slot interference, slot wiring invariant checked every tick. fromPlayer payload corrected (captures pre-switch ID). 45 tests (12 groups); 1969 total tests, 0 failures. HEADLESS audit PASS. No PES claims. Horizon playable-1v1-enabler 3/4.

- builder: builder-gameplay / mimo-v2.5
- critic: critic-qwen / qwen3.6 — ACCEPT (retry, 0 required fixes, 28s, independence OK)
- integration: integration-reviewer-qwen / qwen3.6 — ACCEPT (159 loop/input tests, 0 regressions)
- Evidence: durable acceptance manifest + record (2026-08-20T08:39:45Z)
- Candidate: 505e056