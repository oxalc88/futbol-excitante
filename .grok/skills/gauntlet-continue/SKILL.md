---
name: gauntlet-continue
description: Resume the PES Simulator Gauntlet from persisted CURRENT/HANDOFF/HORIZON state on the DeepSeek overflow orchestrator.
user-invocable: true
disable-model-invocation: true
model: deepseek-v4-flash
argument-hint: optional focus, e.g. finish PLAYABLE-DUELS-SUITE only
---

Resume the PES Simulator Gauntlet from disk. Do not start over.

You are the overflow orchestrator (`orchestrator-deepseek`). Do not implement gameplay.

1. Read `gauntlet/state/HANDOFF.md` if present, then `CURRENT.md`, then `HORIZON.md`, then the last `HISTORY.md` iteration.
2. Run `git status --short` and `git log -8 --oneline`.
3. Continue any in-flight `active_candidate`. Do not restart accepted objectives.
4. Validate horizon uniqueness, accepted/pending state, prerequisites, zero-based `current_index`, and next-objective correspondence. If no candidate is in flight and the rolling horizon is valid, continue its indexed next applicable objective without a global project reassessment. Repair ordinary bookkeeping locally without rewriting history.
5. Reassess globally only when the horizon is missing, exhausted, or materially invalidated under `gauntlet/PROMPT.md`.
6. Follow `gauntlet/PROMPT.md`, `gauntlet/README.md`, and `.grok/agents/orchestrator-deepseek.md`.
7. Preserve builder → required evidence → critic → retry/fix → critic → integration-reviewer → orchestrator evidence gate → accept. Critic ACCEPT alone is insufficient. Required gameplay/presentation screenshots must exist; tests are not substitutes.
8. After both reviews accept, independently verify mandatory evidence. Only then mark the existing horizon entry accepted in place, recompute and validate `current_index`, persist normal CURRENT/HISTORY/TIMING updates, and commit through `git-committer` / `gemma4`. Never append a duplicate horizon entry.

This skill is the DeepSeek overflow entry point. Do not discard a valid persisted horizon merely because the orchestrator session changed.

If the user passed extra focus after `/gauntlet-continue`, apply it to pickup/strategic selection only. Do not skip critic or integration review.
