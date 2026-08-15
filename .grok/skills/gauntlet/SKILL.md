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

Inspect `git status --short`, recent commits, `CURRENT.md`, and `HORIZON.md` before the first delegation.

If `HORIZON.md` is uninitialized, exhausted, or materially invalidated, perform the strategic reassessment defined in `gauntlet/PROMPT.md` and persist a concise 4–8 objective horizon. Otherwise continue the next applicable horizon objective without globally reprioritizing the whole project.

Delegate with `spawn_subagent`:

- `subagent_type` is the agent name (`builder-qwen`, `builder-mimo`, `critic`, `critic-qwen`, `critic-mimo`, `integration-reviewer`, `aux`, `git-committer`)
- builders: `capability_mode: all`
- critics, integration-reviewer, aux, git-committer: `capability_mode: execute`
- pass `model` from `gauntlet/models.json`; do not let a child inherit `grok-4.6`
- commits and pushes go to `git-committer` / `gemma4`

Preserve the adversarial loop: builder → critic → retry/fix as needed → critic → integration-reviewer → accept. Critic ACCEPT alone is never final.

After both critic and integration review accept, update `CURRENT.md` and `HISTORY.md`, refresh `TIMING.md` when appropriate, advance `HORIZON.md`, and delegate commits to `git-committer`. If the horizon is still valid, continue directly to its next objective. Replan globally only at a strategic boundary.

If SuperGrok weekly usage (`/usage`) is ≥89%, write `HANDOFF.md`, preserve the horizon, and tell the human to run `/gauntlet-continue` on `orchestrator-deepseek` instead of starting another builder here.

If the user passed extra focus after `/gauntlet`, apply it to strategic objective selection only. Do not skip critic or integration review.
