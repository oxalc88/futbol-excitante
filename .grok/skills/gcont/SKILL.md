---
name: gcont
description: Resume the PES Simulator Gauntlet from persisted CURRENT/HANDOFF/HORIZON state on the GLM orchestrator.
user-invocable: true
disable-model-invocation: true
model: glm5.3-flash
argument-hint: optional focus, e.g. finish PLAYABLE-DUELS-SUITE only
---

Resume from persisted `HANDOFF.md`/`CURRENT.md`/`HORIZON.md`; do not start over. Read `gauntlet/PROMPT.md`, `gauntlet/principles.md`, `gauntlet/VERSION.json`, `gauntlet/observability-contract.md`, and `gauntlet/regression-inbox-contract.md` before delegation.

Before any other status prose, print one compact startup line using the version read from `gauntlet/VERSION.json`:

`Gauntlet <version> · orchestrator-glm · glm5.3-flash`

Fetch `origin/gauntlet-regressions` and inspect OPEN regression records before ordinary objective selection. CI is the deterministic detector/classifier; reproduce the named check against current `main` before prioritizing repair. Never edit or resolve inbox records yourself.

Repair stale accepted `active_candidate` and horizon bookkeeping locally. Continue the current horizon unless a documented strategic-boundary condition requires replanning or a still-reproducing OPEN regression makes the current order unsafe.

For every candidate preserve the full pipeline from `gauntlet/PROMPT.md`: builder → tests/artifacts → `pnpm run gauntlet:audit` → optional bounded semantic audit on `REVIEW_REQUIRED` → impact-required critic → impact-required integration → final gate → candidate snapshot commit → `GAUNTLET_ACCEPTANCE_JSON=... pnpm run gauntlet:acceptance:persist` with objective `manifest.json` → bookkeeping → `pnpm run gauntlet:eval:state` → final acceptance commit → acceptance publication push + remote containment verification → continue. The critic remains mandatory for protected properties or ambiguous impact after deterministic/cheap audit success.

Never describe an objective as fully accepted/committed before the durable acceptance record, manifest, state transition, candidate commit, and final acceptance commit exist. Preserve old evidence rather than replacing it. Dynamic visual objectives follow the strict evidence-class and event-centered rules in `gauntlet/evidence-contract.md`.

Do not delegate the next objective while the latest final acceptance commit exists only locally. Publish the accepted chain and verify the exact acceptance commit is contained by the configured remote branch first. The same remote-durability guard applies before replanning an exhausted horizon.

After each acceptance publication and before strategic replan, inspect `origin/gauntlet-regressions` again. A reproducing OPEN regression may become the next repair objective, but it follows the normal builder/critic/integration/acceptance pipeline. The next successful deterministic `main` CI run owns inbox resolution.

Milestone progress follows `gauntlet/milestone-playtest-contract.md` and `gauntlet/gameplay-situations.json`. Horizon completion is not a milestone verdict. When a normative milestone is ready to evaluate, use its playtest plan, required situations, existing critic, `gauntlet:milestone:evaluate`, and derived milestone bundle; missing situations/prerequisites remain non-PASS.

Continue after acceptance publication or horizon exhaustion; horizon exhaustion triggers strategic reassessment only after the normal-play comparison and trajectory are persisted; an ITERATE outcome continues the same product problem. After a valid replanned horizon is persisted, immediately delegate its executable next objective without asking the human for confirmation. Stop only for explicit blockers in `gauntlet/PROMPT.md`.

Before returning control, compute `allowed_stop_reason` with the canonical control policy. Tests passing are not a stop; execute that action instead of stopping when the policy permits continuation.

If the user supplies extra focus, apply it only to objective selection; never skip audit, required critic and integration reviews, provenance persistence, state audit, remote publication, regression-inbox pickup, or an applicable milestone gate.

Apply `gauntlet/product-quality-contract.md` for deterministic review/assurance applicability. Follow `gauntlet/trajectory-contract.md` at Horizon selection, first normal play and completion. Horizon ACCEPT requires a materially better normal shipped-play result; otherwise iterate. These canonical rules apply to this harness without changing its model routes or scheduling.

For failed checks, follow the focused repair flow in `gauntlet/product-quality-contract.md`. `REPAIR_PASS` is diagnostic only; complete the normal scoped command after repair, reusing only validated PASS evidence and executing missing coverage. Do not repeat the full battery or bypass the canonical incident.

Follow `gauntlet/product-first-contract.md` and `gauntlet:control -- continue` for incident recovery, continuation, execution units and structured external-decision stops. Policy is canonical; this adapter adds no stop rules.

For 0.13.0, objective verification uses `gauntlet:quality -- --base <candidate-parent> --execute --out docs/evidence/<id>/quality.json`. Whole-repository certification uses `gauntlet:quality -- --stage certification --target HEAD --execute --out docs/evidence/CERT-<boundary>/quality.json` with committed inputs. Read the canonical product-quality contract for bootstrap, evidence reuse, full-risk escalation and certificate publication. Publish certificates separately with remote containment. Milestone evaluation requires `--target <certified-sha>` and playtest evidence naming that exact target. Model routing, native scheduling and acceptance durability remain unchanged.

`verification_blocked` is allowed only when required verification/certification cannot proceed under the bounded incident policy, no same-Horizon objective is safely admissible, and a reviewed environment/execution-policy decision is required. Report preserved progress, exact failing scope, evidence and needed decision; never return control merely because one certificate failed while safe product work remains.
