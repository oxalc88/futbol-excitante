---
name: gauntlet
description: Start or continue the PES Simulator Gauntlet Loop as the orchestrator. Use when the user runs /gauntlet.
user-invocable: true
disable-model-invocation: true
model: grok-4.6
argument-hint: optional focus, e.g. continue from BOOTSTRAP-07 only
---

Start the PES Simulator Gauntlet Loop now.

You are the primary orchestrator. Do not implement gameplay yourself.

Follow `gauntlet/PROMPT.md` and `gauntlet/README.md`. Live execution state is `gauntlet/state/CURRENT.md`; strategic rolling-plan state is `gauntlet/state/HORIZON.md`.

Inspect `git status --short`, recent commits, `CURRENT.md`, and `HORIZON.md` before the first delegation. If `active_candidate` points to an objective already accepted in `CURRENT.md`/`HISTORY.md`, it is stale bookkeeping: clear it locally and continue from the indexed next applicable horizon objective. Never resume an accepted candidate.

If `HORIZON.md` is uninitialized, exhausted, or materially invalidated, perform the strategic reassessment defined in `gauntlet/PROMPT.md`, validate the generated candidate, and persist a concise 4–8 objective horizon. Otherwise validate and continue the indexed next applicable horizon objective without globally reprioritizing the whole project. Horizon IDs must be unique; accepted objectives cannot be pending; prerequisites, zero-based `current_index`, and the selected next objective must agree.

Delegate with `spawn_subagent`:

- `subagent_type` is the agent name (`builder-qwen`, `builder-mimo`, `critic`, `critic-flash`, `critic-qwen`, `critic-mimo`, `integration-reviewer`, `integration-reviewer-flash`, `aux`, `git-committer`)
- builders: `capability_mode: all`
- critics, integration-reviewer, aux, git-committer: `capability_mode: execute`
- pass model/role routing from `gauntlet/models.json`; do not let a child inherit `grok-4.6`
- commits and pushes go to `git-committer` / `gemma4`

Preserve the adversarial loop: builder → required evidence → critic → retry/fix as needed → critic → integration-reviewer → orchestrator evidence gate → accept. Critic ACCEPT alone is never final. Determine required evidence from `gauntlet/evidence-contract.md`; gameplay/presentation screenshots are mandatory and tests cannot substitute for them.

After both reviews accept, independently verify their mandatory-evidence fields and every required artifact. Only then perform one acceptance transition: clear the accepted objective from `active_candidate`, update `CURRENT.md` and `HISTORY.md`, refresh `TIMING.md` when appropriate, mark the existing horizon entry accepted in place, recompute `current_index`, validate candidate state, and persist. Never append a duplicate entry. Repair bookkeeping locally; replan globally only at a strategic boundary.

A successful acceptance commit is not a stopping point. If another applicable horizon objective exists, start it immediately in the same session. If the horizon is exhausted, perform strategic reassessment and start the first applicable objective of the new horizon. Stop only for the explicit stop conditions in `gauntlet/PROMPT.md`.

If SuperGrok weekly usage (`/usage`) is ≥89%, write `HANDOFF.md`, preserve the horizon, and tell the human to run `/gauntlet-continue` on `orchestrator-deepseek` instead of starting another builder here.

If the user passed extra focus after `/gauntlet`, apply it to strategic objective selection only. Do not skip critic or integration review.
