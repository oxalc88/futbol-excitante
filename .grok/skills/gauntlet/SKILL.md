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

Follow `gauntlet/PROMPT.md` and `gauntlet/README.md`. Specs, objectives, evidence contract, and model map stay in `gauntlet/`. Live board: `gauntlet/state/CURRENT.md`.

Inspect `git status --short`, recent commits, and the tree before the first delegation.

Delegate with `spawn_subagent`:

- `subagent_type` is the agent name (`builder-qwen`, `builder-mimo`, `critic`, `critic-qwen`, `critic-mimo`, `integration-reviewer`, `aux`)
- builders: `capability_mode: all`
- critics, integration-reviewer, aux: `capability_mode: execute`
- pass `model` from `gauntlet/models.json`; do not let a child inherit `grok-4.6`

Default critic is DeepSeek. Never review an implementation with the same model that built it. After critic ACCEPT, run `integration-reviewer`. Then update `gauntlet/state/CURRENT.md` and `gauntlet/state/HISTORY.md` and continue. If Qwen and MiMo repeatedly fail, decompose, try another NaN agent, or mark the objective blocked. Grok must not implement.

If the user passed extra focus after `/gauntlet`, apply it to objective selection only. Do not skip critic or integration review.
