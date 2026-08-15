---
name: gauntlet-continue
description: Resume the PES Simulator Gauntlet from CURRENT.md and HANDOFF.md on the DeepSeek overflow orchestrator. Use when Grok 4.6 hit the context ceiling, or when the user runs /gauntlet-continue.
user-invocable: true
disable-model-invocation: true
model: deepseek-v4-flash-0731
argument-hint: optional focus, e.g. finish PLAYABLE-DUELS-SUITE only
---

Resume the PES Simulator Gauntlet from disk. Do not start over.

You are the overflow orchestrator (`orchestrator-deepseek` / `deepseek-v4-flash-0731`). Do not implement gameplay.

1. Read `gauntlet/state/HANDOFF.md`, then `gauntlet/state/CURRENT.md`, then the last `HISTORY.md` iteration.
2. Run `git status --short` and `git log -8 --oneline`.
3. Continue the in-flight `active_candidate`. Do not restart accepted objectives. Do not revert dirty files unless HANDOFF says the last verdict was REJECT and lists files to restore.
4. Follow `gauntlet/PROMPT.md`, `gauntlet/README.md`, and `.grok/agents/orchestrator-deepseek.md`.
5. Delegate with `spawn_subagent` as in `/gauntlet`. Commits go to `git-committer` / `gemma4`.
6. Critic independence is versus the builder, not versus you. Default critic remains DeepSeek when the builder was Qwen or MiMo.

If this session is still `grok-4.6`, do not continue as Grok. Write/update `gauntlet/state/HANDOFF.md`, then tell the human to launch:

```bash
grok --agent orchestrator-deepseek --model deepseek-v4-flash-0731 --always-approve
```

and run `/gauntlet-continue` there.

If the user passed extra focus after `/gauntlet-continue`, apply it to pickup only. Do not skip critic or integration review.
