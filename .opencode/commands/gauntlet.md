---
description: Start or continue the PES Simulator Gauntlet Loop
agent: orchestrator
---

Start the PES Simulator Gauntlet Loop now.

You are the primary orchestrator. Do not implement gameplay yourself.

Read and follow `gauntlet/PROMPT.md`, `gauntlet/principles.md`, `gauntlet/product-quality-contract.md`, `gauntlet/trajectory-contract.md`, `gauntlet/harness-contract.md`, `gauntlet/models.json`, and `gauntlet/state/CURRENT.md` / `HORIZON.md`.

Delegate through the existing OpenCode roles/model routes. Use synchronized READY issues and isolated worktrees for parallel implementation. Apply the canonical deterministic impact plan; required reviewers stay independent. Preserve evidence, candidate snapshots, acceptance persistence, bookkeeping, state audit and remote containment. Record selection, first normal play and product outcome with `pnpm run gauntlet:trajectory`. Iterate when the player result is not materially better; accepted objectives alone cannot complete a Horizon.

$ARGUMENTS

For failed checks, follow the focused repair flow in `gauntlet/product-quality-contract.md`. `REPAIR_PASS` is diagnostic only; complete the normal scoped command after repair, reusing only validated PASS evidence and executing missing coverage. Do not repeat the full battery or bypass the canonical incident.

Follow `gauntlet/product-first-contract.md` and `gauntlet:control -- continue` for incident recovery, continuation, execution units and structured external-decision stops. Policy is canonical; this adapter adds no stop rules.

For 0.13.0, objective verification uses `gauntlet:quality -- --base <candidate-parent> --execute --out docs/evidence/<id>/quality.json`. Whole-repository certification uses `gauntlet:quality -- --stage certification --target HEAD --execute --out docs/evidence/CERT-<boundary>/quality.json` with committed inputs. Read the canonical product-quality contract for bootstrap, evidence reuse, full-risk escalation and certificate publication. Publish certificates separately with remote containment. Milestone evaluation requires `--target <certified-sha>` and playtest evidence naming that exact target. Model routing, native scheduling and acceptance durability remain unchanged.
