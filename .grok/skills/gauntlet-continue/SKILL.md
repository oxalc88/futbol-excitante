---
name: gauntlet-continue
description: Resume the PES Simulator Gauntlet from persisted CURRENT/HANDOFF/HORIZON state on the DeepSeek overflow orchestrator.
user-invocable: true
disable-model-invocation: true
model: deepseek-v4-flash
argument-hint: optional focus, e.g. finish PLAYABLE-DUELS-SUITE only
---

Resume from persisted `HANDOFF.md`/`CURRENT.md`/`HORIZON.md`; do not start over. Read `gauntlet/PROMPT.md`, `gauntlet/principles.md`, and `gauntlet/VERSION.json` before delegation.

Before any other status prose, print one compact startup line using the version read from `gauntlet/VERSION.json`:

`Gauntlet <version> · orchestrator-deepseek · deepseek-v4-flash`

Repair stale accepted `active_candidate` and horizon bookkeeping locally. Continue the current horizon unless a documented strategic-boundary condition requires replanning.

For every candidate preserve the full pipeline from `gauntlet/PROMPT.md`: builder → tests/artifacts → `pnpm run gauntlet:audit` → optional bounded semantic audit on `REVIEW_REQUIRED` → mandatory critic → integration → final gate → candidate snapshot commit → `GAUNTLET_ACCEPTANCE_JSON=... pnpm run gauntlet:acceptance:persist` with objective `manifest.json` → bookkeeping → `pnpm run gauntlet:eval:state` → final acceptance commit → acceptance publication push + remote containment verification → continue. The critic remains mandatory after deterministic/cheap audit success.

Never describe an objective as fully accepted/committed before the durable acceptance record, manifest, state transition, candidate commit, and final acceptance commit exist. Preserve old evidence rather than replacing it. Dynamic visual objectives require 3–5 semantic frames.

Do not delegate the next objective while the latest final acceptance commit exists only locally. Publish the accepted chain and verify the exact acceptance commit is contained by the configured remote branch first. The same remote-durability guard applies before replanning an exhausted horizon.

Continue after acceptance publication or horizon exhaustion; horizon exhaustion triggers strategic reassessment. After a valid replanned horizon is persisted, immediately delegate its executable next objective without asking the human for confirmation. Stop only for explicit blockers in `gauntlet/PROMPT.md`.
