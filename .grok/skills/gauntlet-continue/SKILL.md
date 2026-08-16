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
3. Inspect `active_candidate`. If it points to an objective already accepted in `CURRENT.md`/`HISTORY.md`, it is stale bookkeeping: clear it locally and do not resume or restart it. Otherwise continue the genuinely in-flight candidate.
4. Validate horizon uniqueness, accepted/pending state, prerequisites, zero-based `current_index`, and next-objective correspondence. If no genuine candidate is in flight and the rolling horizon is valid, continue its indexed next applicable objective without a global project reassessment. Repair ordinary bookkeeping locally without rewriting history.
5. Reassess globally only when the horizon is missing, exhausted, or materially invalidated under `gauntlet/PROMPT.md`. Horizon exhaustion is a planning boundary, not a stop condition: build the next horizon and continue.
6. Follow `gauntlet/PROMPT.md`, `gauntlet/README.md`, `.grok/agents/orchestrator-deepseek.md`, and `gauntlet/timing-contract.md`.
7. Preserve builder → required evidence → critic → retry/fix → critic → integration-reviewer → orchestrator evidence gate → accept. Critic ACCEPT alone is insufficient. Required gameplay/presentation and browser-visible/browser-interactive screenshots must exist; tests are not substitutes.
8. After both reviews accept, independently verify mandatory evidence. Only then perform one acceptance transition: clear the accepted objective from `active_candidate`, mark the existing horizon entry accepted in place, recompute and validate `current_index`, persist normal CURRENT/HISTORY updates, and refresh TIMING under the timing contract from real session/review data. TIMING must include current per-step usage, by-model aggregates, builder grade, reviewer/orchestrator route/catches, and matching tracking markers. Never invent unavailable metrics. Run `pnpm run gauntlet:eval:state` and repair tracking locally until it passes before committing through `git-committer` / `gemma4`. Never append a duplicate horizon entry.
9. A successful acceptance commit is not a stopping point. If another applicable objective exists, start it immediately in this session. Tracking repair is also not a stop condition. Stop only for the explicit stop conditions in `gauntlet/PROMPT.md`.

This skill is the DeepSeek overflow entry point. Do not discard a valid persisted horizon merely because the orchestrator session changed.

If the user passed extra focus after `/gauntlet-continue`, apply it to pickup/strategic selection only. Do not skip critic or integration review.
