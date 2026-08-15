# Current Gauntlet state

```yaml
gauntlet_version: gauntlet-loop-v1
phase: PLAYABLE
next_objective_id: PLAYABLE-1V1-PROFILE
best_known:
  commit: bb7a247
  note: "PLAYABLE-BROWSER-1V1 accepted. BROWSER-1V1-CONTROL-001. ARCH-DIFF NEEDS_PERCEPTUAL_REVIEW. Not PES."
active_candidate:
  objective_id: PLAYABLE-1V1-PROFILE
  builder: builder-qwen
  critic: critic
  started_from_commit: bb7a247
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
  - PLAYABLE-BROWSER-1V1
blocked: []
selection_note: "1v1 playable pieces exist. Next gap is a versioned PLAYABLE-1V1 milestone profile that evaluates what can run and keeps ARCH-DIFF as NEEDS_PERCEPTUAL_REVIEW. Do not claim PLAYABLE_1V1_PASS. Do not invent PES envelopes. Do not start 11v11."
```

## Last accepted objective

PLAYABLE-BROWSER-1V1 — two-slot browser control case.

- commits: `c4fa809` (scenario), `3313612` (registry), `2777c7d` (bridge), `bb7a247` (tests)
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731 — ACCEPT
- integration-reviewer: deepseek-v4-flash-0731 — ACCEPT

## Next action

Delegate PLAYABLE-1V1-PROFILE to builder-qwen. After ACCEPT + integration, atomic-commit and push.
