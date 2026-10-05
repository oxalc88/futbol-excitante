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

For each candidate follow the full pipeline in `gauntlet/PROMPT.md`: builder → tests/artifacts → `pnpm run gauntlet:audit` → optional bounded semantic audit only on `REVIEW_REQUIRED` → impact-required critic → impact-required integration reviewer → final evidence gate → candidate snapshot commit → `GAUNTLET_ACCEPTANCE_JSON=... pnpm run gauntlet:acceptance:persist` → bookkeeping → `pnpm run gauntlet:eval:state` → final acceptance commit → acceptance publication + remote containment verification → continue.

Critic ACCEPT alone is never final, and deterministic/cheap-auditor success never bypasses an impact-required critic. Never claim an objective is fully accepted/committed until durable acceptance record, objective manifest, accepted state, candidate commit, final acceptance commit, and required remote publication all exist.

After every acceptance publication and before strategic replan, inspect the regression inbox again. An OPEN regression that still reproduces may reprioritize repair, but it does not bypass the normal builder/critic/integration/acceptance pipeline. Inbox resolution is owned by the next successful deterministic `main` CI run.

Preserve historical evidence; never rewrite old screenshots to make a later story cleaner. Dynamic visual behavior follows the strict evidence-class and event-centered rules in `gauntlet/evidence-contract.md`.

Normative milestone progress follows `gauntlet/milestone-playtest-contract.md` and `gauntlet/gameplay-situations.json`. Horizon completion or a larger player count is not a milestone PASS. When a normative milestone is ready for evaluation, run its required gameplay situations, invoke the existing critic for qualitative judgment, persist the structured milestone playtest result, and build the derived milestone bundle.

A successful acceptance commit, tracking repair, or horizon exhaustion is not a stop condition. Horizon exhaustion triggers strategic reassessment and continuation only after remote durability and the normal-play comparison/trajectory are persisted; ITERATE continues the same product problem. Preserve the existing SuperGrok ≥89% handoff rule.

Before returning control, compute `allowed_stop_reason` with the canonical control policy. Tests passing are not a stop; execute that action instead of stopping when the policy permits continuation.

If the user supplies extra focus, apply it only to objective selection; never skip audit, required critic and integration reviews, provenance persistence, state audit, remote publication, regression-inbox pickup, or an applicable milestone gate.

Apply `gauntlet/product-quality-contract.md` for deterministic review/assurance applicability. Follow `gauntlet/trajectory-contract.md` at Horizon selection, first normal play and completion. Horizon ACCEPT requires a materially better normal shipped-play result; otherwise iterate. These canonical rules apply to this harness without changing its model routes or scheduling.

For failed checks, follow the focused repair flow in `gauntlet/product-quality-contract.md`. `REPAIR_PASS` is diagnostic only; complete the normal scoped command after repair, reusing only validated PASS evidence and executing missing coverage. Do not repeat the full battery or bypass the canonical incident.

Follow `gauntlet/product-first-contract.md` and `gauntlet:control -- continue` for incident recovery, continuation, execution units and structured external-decision stops. Policy is canonical; this adapter adds no stop rules.

For 0.13.0, objective verification uses `gauntlet:quality -- --base <candidate-parent> --execute --out docs/evidence/<id>/quality.json`. Whole-repository certification uses `gauntlet:quality -- --stage certification --target HEAD --execute --out docs/evidence/CERT-<boundary>/quality.json` with committed inputs. Read the canonical product-quality contract for bootstrap, evidence reuse, full-risk escalation and certificate publication. Publish certificates separately with remote containment. Milestone evaluation requires `--target <certified-sha>` and playtest evidence naming that exact target. Model routing, native scheduling and acceptance durability remain unchanged.

`verification_blocked` is allowed only when required verification/certification cannot proceed under the bounded incident policy, no same-Horizon objective is safely admissible, and a reviewed environment/execution-policy decision is required. Report preserved progress, exact failing scope, evidence and needed decision; never return control merely because one certificate failed while safe product work remains.
