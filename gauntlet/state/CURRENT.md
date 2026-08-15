# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
next_objective_id: PLAYABLE-BROWSER-1V1
best_known:
  commit: 2bd5fcc
  note: "PLAYABLE-FICTIONAL-ARCHETYPES accepted. Burst vs steady per player. Not PES."
active_candidate:
  objective_id: PLAYABLE-BROWSER-1V1
  builder: builder-qwen
  critic: critic
  started_from_commit: 2bd5fcc
  last_verdict: null
builder_in_use: builder-qwen
critic_in_use: critic
retry_count: 0
max_retries_per_objective: 3
nan_builder_failures: 0
accepted:
  - BOOTSTRAP-01
  - BOOTSTRAP-02
  - BOOTSTRAP-03
  - BOOTSTRAP-04
  - BOOTSTRAP-05
  - BOOTSTRAP-06
  - BOOTSTRAP-07
  - BOOTSTRAP-08
  - BOOTSTRAP-09
  - BOOTSTRAP-10
  - BOOTSTRAP-11
  - BOOTSTRAP-12
  - FOUNDATION-REGISTRIES
  - FOUNDATION-ORACLES
  - FOUNDATION-HARD
  - FOUNDATION-BROWSER
  - FOUNDATION-DETERMINISTIC
  - FOUNDATION-MUTANT-REDUCTION
  - FOUNDATION-PROMOTION
  - CAPABILITY-DESIGN-PROFILE
  - PLAYABLE-FIRST-TOUCH
  - PLAYABLE-BASIC-PASS
  - PLAYABLE-BASIC-SHOT
  - PLAYABLE-SECOND-SLOT
  - PLAYABLE-CLOSE-CONTROL
  - PLAYABLE-PLAYER-DUEL
  - PLAYABLE-ENGINE-DESIGN-RUNNER
  - PLAYABLE-FICTIONAL-ARCHETYPES
blocked: []
selection_note: "Archetypes exist in the core but the two-player browser path still uses identical default players. Next PLAYABLE-1V1 gap is BROWSER-1V1-CONTROL-001 / ARCH-DIFF-001. Do not invent PES envelopes. Do not start 11v11."
```

## Last accepted objective

PLAYABLE-FICTIONAL-ARCHETYPES — burst vs steady per player.

- commits: `4e24bcb` (contracts), `f387d94` (registry), `c4d3c80` (createWorld), `13a7250` (locomotion), `2bd5fcc` (tests)
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731 — ACCEPT
- integration-reviewer: deepseek-v4-flash-0731 — ACCEPT

## Next action

Delegate PLAYABLE-BROWSER-1V1 to builder-qwen. After ACCEPT + integration, atomic-commit and push.
