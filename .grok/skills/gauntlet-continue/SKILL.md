---
name: gauntlet-continue
description: Resume the PES Simulator Gauntlet from persisted CURRENT/HANDOFF/HORIZON state on the DeepSeek overflow orchestrator.
user-invocable: true
disable-model-invocation: true
model: deepseek-v4-flash
argument-hint: optional focus, e.g. finish PLAYABLE-DUELS-SUITE only
---

Resume from persisted `HANDOFF.md`/`CURRENT.md`/`HORIZON.md`; do not start over. Read `gauntlet/PROMPT.md`, `gauntlet/principles.md`, and `gauntlet/VERSION.json` before delegation.

Repair stale accepted `active_candidate` and horizon bookkeeping locally. Continue the current horizon unless a documented strategic-boundary condition requires replanning.

For every candidate, preserve v0.7: builder → tests/artifacts → `pnpm run gauntlet:audit` → optional bounded semantic audit on `REVIEW_REQUIRED` → mandatory critic → integration → final gate → `GAUNTLET_ACCEPTANCE_JSON=... pnpm run gauntlet:acceptance:persist` → bookkeeping → `pnpm run gauntlet:eval:state` → accept. The critic remains mandatory after deterministic/cheap audit success.

Continue after acceptance/commit or horizon exhaustion; stop only for the explicit blockers in `gauntlet/PROMPT.md`.
