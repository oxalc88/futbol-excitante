---
name: gauntlet
description: Start or continue the PES Simulator Gauntlet Loop as the orchestrator. Use when the user runs /gauntlet.
user-invocable: true
disable-model-invocation: true
model: grok-4.6
argument-hint: optional focus, e.g. continue from BOOTSTRAP-07 only
---

Start or resume the PES Simulator Gauntlet Loop now. Do not implement gameplay yourself.

Read `gauntlet/PROMPT.md`, `gauntlet/principles.md`, `gauntlet/VERSION.json`, `gauntlet/observability-contract.md`, `gauntlet/regression-inbox-contract.md`, `gauntlet/state/HANDOFF.md`, `gauntlet/state/CURRENT.md`, and `gauntlet/state/HORIZON.md`. Follow the validated rolling horizon and existing model routing.

Before any other status prose, print one compact startup line using the version read from `gauntlet/VERSION.json`:

`Gauntlet <version> · orchestrator · grok-4.6`

Before ordinary objective selection, fetch `origin/gauntlet-regressions` and inspect OPEN regression records as required by `gauntlet/regression-inbox-contract.md`. CI is the detector/classifier; reproduce the named deterministic check before prioritizing a repair. Never edit or resolve the inbox yourself.

For each candidate follow the full pipeline in `gauntlet/PROMPT.md`: builder → tests/artifacts → `pnpm run gauntlet:audit` → optional bounded semantic audit only on `REVIEW_REQUIRED` → mandatory critic → integration reviewer → final evidence gate → candidate snapshot commit → `GAUNTLET_ACCEPTANCE_JSON=... pnpm run gauntlet:acceptance:persist` → bookkeeping → `pnpm run gauntlet:eval:state` → final acceptance commit → acceptance publication + remote containment verification → continue.

Critic ACCEPT alone is never final, and deterministic/cheap-auditor success never bypasses the critic. Never claim an objective is fully accepted/committed until durable acceptance record, objective manifest, accepted state, candidate commit, final acceptance commit, and required remote publication all exist.

After every acceptance publication and before strategic replan, inspect the regression inbox again. An OPEN regression that still reproduces may reprioritize repair, but it does not bypass the normal builder/critic/integration/acceptance pipeline. Inbox resolution is owned by the next successful deterministic `main` CI run.

Preserve historical evidence; never rewrite old screenshots to make a later story cleaner. Dynamic visual behavior follows the strict evidence-class and event-centered rules in `gauntlet/evidence-contract.md`.

Normative milestone progress follows `gauntlet/milestone-playtest-contract.md` and `gauntlet/gameplay-situations.json`. Horizon completion or a larger player count is not a milestone PASS. When a normative milestone is ready for evaluation, run its required gameplay situations, invoke the existing critic for qualitative judgment, persist the structured milestone playtest result, and build the derived milestone bundle.

A successful acceptance commit, tracking repair, or horizon exhaustion is not a stop condition. Horizon exhaustion triggers strategic reassessment and continuation only after remote durability is verified. Preserve the existing SuperGrok ≥89% handoff rule.

Before returning control to the human, resolve an explicit `allowed_stop_reason` to one of: `human_needed_spec`, `human_needed_legal`, `builders_exhausted`, `explicitly_deferred`, or `quota_handoff`. Tests passing, pipeline phase completion, audit completion, candidate commit, acceptance completion, horizon exhaustion, and replan completion are never allowed stop reasons. If no allowed stop reason exists and a required next action remains, execute that action instead of stopping.

If the user supplies extra focus, apply it only to objective selection; never skip audit, critic, integration review, provenance persistence, state audit, remote publication, regression-inbox pickup, or an applicable milestone gate.
