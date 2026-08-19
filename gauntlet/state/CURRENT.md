# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage

next_objective_id: BROWSER-DIFFICULTY-SETTING

best_known:
  commit: 52557aa
  note: "CPU-TACTICAL-AWARENESS accepted (HEADLESS). Candidate commit 52557aa; acceptance bookkeeping and publication follow in this session."

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

blocked: []

selection_note: "Horizon transition-completion 3/5: MATCH-THROW-IN, MATCH-GOAL-KICK, CPU-TACTICAL-AWARENESS accepted 2026-08-19. Next: BROWSER-DIFFICULTY-SETTING."
```
## Last accepted objective

CPU-TACTICAL-AWARENESS — CPU tactical awareness (CPU adapter only): continuous score-gradient adaptation replacing the hard ±2 threshold (`bias = clamp(-scoreDiff/3, -1, 1)`: more attacking when losing, more defensive when winning), fatigue awareness via a deterministic per-adapter tick accumulator (increments while matchPhase === "playing", resets on half change; press radius/strength shrink when fatigued; sprint stays 1 preserving the accepted invariant), and match-phase behavior (non-playing phases → hold, kickoff → calm, only when matchPhase is present). Observation immutability preserved (adapter never mutates CpuObservation). 36 unit + 10 integration tests; full node suite 1914/1914; browser 86/86. HEADLESS audit PASS. All coefficients provisional (FATIGUE_MAX_TICKS 3600, gradient divisor 3); no PES claims. Three 1000-tick free-play fixtures in 2v2-scoring received explicit per-test timeouts because the intended score-gradient changes post-goal thresholds (more simulation events); assertions unchanged.

- builder: builder-gameplay / mimo-v2.5
- critic: critic-flash / deepseek-v4-flash — ACCEPT (after orchestrator-verified regressions fixed: observation mutation + sprint invariant; two builder fix rounds)
- integration: integration-reviewer-flash / deepseek-v4-flash — ACCEPT
- Evidence: durable acceptance manifest + record (2026-08-19T20:52:07Z)
- Candidate: 52557aa