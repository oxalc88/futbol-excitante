# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
orchestrator_in_use: orchestrator-deepseek
overflow_orchestrator: orchestrator-deepseek
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage
next_objective_id: ""
best_known:
  commit: 514847f
  note: "BROWSER-2V2-PLAYABLE accepted — full playable 2v2 AI match with ?mode=2v2-ai URL mode. 4 CPU-controlled players, hash parity verified, 21KB canvas screenshot. Horizon 2v2-playable fully accepted. Next horizon requires strategic reassessment."
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
blocked: []
selection_note: "Horizon 2v2-playable exhausted (all 5 objectives accepted). Next horizon requires strategic reassessment."
```

## Last accepted objective

BROWSER-2V2-PLAYABLE — Full playable 2v2 match in browser. `?mode=2v2-ai` URL creates autonomous AI-vs-AI 2v2 match with 4 CPU players (2 per team). HUD, scoreboard, match timer, phase transitions all work. 7 browser tests, 6 scenario selector tests. 1382 node tests, 40 browser tests. 600-tick CPU-driven trajectory. 21KB canvas screenshot.

- builder: builder-gameplay / mimo-v2.5
- critic: critic-flash / deepseek-v4-flash — ACCEPT (3rd attempt, 2 retries)
- integration: integration-reviewer-flash / deepseek-v4-flash — ACCEPT (first pass)
- Evidence: 7/7 browser tests, 40/40 browser suite, 1382/1382 node suite, trajectory with ball velocity contact, canvas screenshot
- Commit: 514847f