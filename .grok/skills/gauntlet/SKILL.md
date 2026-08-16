---
name: gauntlet
description: Start or continue the PES Simulator Gauntlet Loop as the orchestrator. Use when the user runs /gauntlet.
user-invocable: true
disable-model-invocation: true
model: grok-4.6
argument-hint: optional focus, e.g. continue from BOOTSTRAP-07 only
---

Start the PES Simulator Gauntlet Loop now. Do not implement gameplay yourself.

Read `gauntlet/PROMPT.md`, `gauntlet/principles.md`, `gauntlet/VERSION.json`, `CURRENT.md`, and `HORIZON.md`. Follow the validated rolling horizon and existing model routing.

Before any other status prose, print one compact startup line using the version read from `gauntlet/VERSION.json`:

`Gauntlet <version> · orchestrator · grok-4.6`

For each candidate follow the full pipeline in `gauntlet/PROMPT.md`: builder → tests/artifacts → `pnpm run gauntlet:audit` → optional bounded semantic audit only on `REVIEW_REQUIRED` → mandatory critic → integration reviewer → final evidence gate → candidate snapshot commit → `GAUNTLET_ACCEPTANCE_JSON=... pnpm run gauntlet:acceptance:persist` (creates objective `manifest.json`) → bookkeeping → `pnpm run gauntlet:eval:state` → final acceptance commit → continue.

Critic ACCEPT alone is never final, and deterministic/cheap-auditor success never bypasses the critic. Never claim an objective is fully accepted/committed until durable acceptance record, objective manifest, accepted state, candidate commit, and final acceptance commit all exist.

Preserve historical evidence; never rewrite old screenshots to make a later story cleaner. Dynamic visual behavior follows the 3–5 semantic-frame requirement in `gauntlet/evidence-contract.md`.

A successful acceptance commit, tracking repair, or horizon exhaustion is not a stop condition. Horizon exhaustion triggers strategic reassessment and continuation. Preserve the existing SuperGrok ≥89% handoff rule.

If the user supplies extra focus, apply it only to objective selection; never skip audit, critic, integration review, provenance persistence, or state audit.
