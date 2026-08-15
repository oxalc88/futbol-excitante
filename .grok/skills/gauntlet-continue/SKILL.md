---
name: gauntlet-continue
description: Resume the PES Simulator Gauntlet from CURRENT.md and HANDOFF.md on the DeepSeek overflow orchestrator. Use when SuperGrok weekly usage hits 89%, or when the user runs /gauntlet-continue.
user-invocable: true
disable-model-invocation: true
model: deepseek-v4-flash
argument-hint: optional focus, e.g. finish PLAYABLE-DUELS-SUITE only
---

Resume the PES Simulator Gauntlet from disk. Do not start over.

You are the model-neutral overflow orchestrator (`orchestrator-deepseek`). New
sessions default to `deepseek-v4-flash` with high reasoning; the fixed
`deepseek-v4-flash-0731` snapshot is an explicit fallback. Use whichever of
those two models the current session selected. Do not implement gameplay.

1. Read `gauntlet/state/HANDOFF.md`, then `gauntlet/state/CURRENT.md`, then the last `HISTORY.md` iteration.
2. Run `git status --short` and `git log -8 --oneline`.
3. Continue the in-flight `active_candidate`. Do not restart accepted objectives. Do not revert dirty files unless HANDOFF says the last verdict was REJECT and lists files to restore.
4. Follow `gauntlet/PROMPT.md`, `gauntlet/README.md`, and `.grok/agents/orchestrator-deepseek.md`.
5. Delegate with `spawn_subagent` as in `/gauntlet`. Commits go to `git-committer` / `gemma4`.
6. Critic independence is versus the builder, not versus you. Default critic remains DeepSeek when the builder was Qwen or MiMo.

This skill is the DeepSeek overflow entry point. The Grok CLI and its generic
system prompt may call the runtime "Grok" when either DeepSeek model is selected;
that product label is not the model identity. Do not hand off again or stop
because of it. Continue from `HANDOFF.md` as `orchestrator-deepseek`.

If the user passed extra focus after `/gauntlet-continue`, apply it to pickup only. Do not skip critic or integration review.
