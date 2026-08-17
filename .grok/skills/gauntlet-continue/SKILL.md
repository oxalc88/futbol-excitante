---
name: gauntlet-continue
description: Resume the PES Simulator Gauntlet from persisted CURRENT/HANDOFF/HORIZON state on the DeepSeek overflow orchestrator.
user-invocable: true
disable-model-invocation: true
model: deepseek-v4-flash
argument-hint: optional focus, e.g. finish PLAYABLE-DUELS-SUITE only
---

Resume from persisted `HANDOFF.md`/`CURRENT.md`/`HORIZON.md`; do not start over. Read `gauntlet/PROMPT.md`, `gauntlet/principles.md`, `gauntlet/VERSION.json`, `gauntlet/observability-contract.md`, and `gauntlet/regression-inbox-contract.md` before delegation.

Before any other status prose, print one compact startup line using the version read from `gauntlet/VERSION.json`:

`Gauntlet <version> · orchestrator-deepseek · deepseek-v4-flash`

Fetch `origin/gauntlet-regressions` and inspect OPEN regression records before ordinary objective selection. CI is the deterministic detector/classifier; reproduce the named check against current `main` before prioritizing repair. Never edit or resolve inbox records yourself.

Repair stale accepted `active_candidate` and horizon bookkeeping locally. Continue the current horizon unless a documented strategic-boundary condition requires replanning or a still-reproducing OPEN regression makes the current order unsafe.

For every candidate preserve the full pipeline from `gauntlet/PROMPT.md`: builder → tests/artifacts → `pnpm run gauntlet:audit` → optional bounded semantic audit on `REVIEW_REQUIRED` → mandatory critic → integration → final gate → candidate snapshot commit → `GAUNTLET_ACCEPTANCE_JSON=... pnpm run gauntlet:acceptance:persist` with objective `manifest.json` → bookkeeping → `pnpm run gauntlet:eval:state` → final acceptance commit → acceptance publication push + remote containment verification → continue. The critic remains mandatory after deterministic/cheap audit success.

Never describe an objective as fully accepted/committed before the durable acceptance record, manifest, state transition, candidate commit, and final acceptance commit exist. Preserve old evidence rather than replacing it. Dynamic visual objectives follow the strict evidence-class and event-centered rules in `gauntlet/evidence-contract.md`.

Do not delegate the next objective while the latest final acceptance commit exists only locally. Publish the accepted chain and verify the exact acceptance commit is contained by the configured remote branch first. The same remote-durability guard applies before replanning an exhausted horizon.

After each acceptance publication and before strategic replan, inspect `origin/gauntlet-regressions` again. A reproducing OPEN regression may become the next repair objective, but it follows the normal builder/critic/integration/acceptance pipeline. The next successful deterministic `main` CI run owns inbox resolution.

Milestone progress follows `gauntlet/milestone-playtest-contract.md` and `gauntlet/gameplay-situations.json`. Horizon completion is not a milestone verdict. When a normative milestone is ready to evaluate, use its playtest plan, required situations, existing critic, `gauntlet:milestone:evaluate`, and derived milestone bundle; missing situations/prerequisites remain non-PASS.

Continue after acceptance publication or horizon exhaustion; horizon exhaustion triggers strategic reassessment. After a valid replanned horizon is persisted, immediately delegate its executable next objective without asking the human for confirmation. Stop only for explicit blockers in `gauntlet/PROMPT.md`.
