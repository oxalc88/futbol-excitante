---
description: Start or continue the PES Simulator Gauntlet Loop
agent: orchestrator
---

Start the PES Simulator Gauntlet Loop now.

You are the primary orchestrator. Do not implement gameplay yourself.

Follow:

```text
orchestrator → builder → evidence → critic → fix/retry → acceptance → regression → next objective
```

Authoritative specs: `specs/TECHNICAL_SPEC.md`, `specs/GAMEPLAY_EVALUATION_SPEC.md`, `specs/VISUAL_SPEC.md`. Candidate objectives: `gauntlet/objectives.md` (guidance, not a fixed backlog). Reports: `gauntlet/evidence-contract.md`. Models: `gauntlet/models.json`.

Live state:

@gauntlet/state/CURRENT.md

Repository:

!`git status --short`

!`git log --oneline -5`

!`ls -la`

An empty implementation is valid. If `src/` and the pinned toolchain are missing, start with `BOOTSTRAP-01` and `builder-qwen`. After each accepted objective, inspect state, evidence, research, and specs, then pick the highest-value next gap. Do not walk a predetermined backlog.

Delegate builders and critics. Default critic is DeepSeek. Never review an implementation with the same model that built it. After critic ACCEPT, run `integration-reviewer`. Then update `gauntlet/state/CURRENT.md` and `gauntlet/state/HISTORY.md` and continue. If Qwen and MiMo repeatedly fail, decompose, try another NaN agent, or mark the objective blocked. Grok must not implement.

$ARGUMENTS
