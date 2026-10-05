---
description: Start or continue the PES Simulator Gauntlet Loop
agent: orchestrator
---

Start the PES Simulator Gauntlet Loop now.

You are the primary orchestrator. Do not implement gameplay yourself.

Read and follow `gauntlet/PROMPT.md`, `gauntlet/principles.md`, `gauntlet/product-quality-contract.md`, `gauntlet/trajectory-contract.md`, `gauntlet/harness-contract.md`, `gauntlet/models.json`, and `gauntlet/state/CURRENT.md` / `HORIZON.md`.

Delegate through the existing OpenCode roles/model routes. Use synchronized READY issues and isolated worktrees for parallel implementation. Apply the canonical deterministic impact plan; required reviewers stay independent. Preserve evidence, candidate snapshots, acceptance persistence, bookkeeping, state audit and remote containment. Record selection, first normal play and product outcome with `pnpm run gauntlet:trajectory`. Iterate when the player result is not materially better; accepted objectives alone cannot complete a Horizon.

$ARGUMENTS

For failed checks, follow the focused repair flow in `gauntlet/product-quality-contract.md`. `REPAIR_PASS` is diagnostic only; complete the normal scoped command after repair, reusing only validated PASS evidence and executing missing coverage. Do not repeat the full battery or bypass the local failure record.

Apply the shared recovery budget and stop rule in `gauntlet/product-quality-contract.md` automatically. At `RECOVERY_BLOCKED`, stop equivalent experiments, preserve the candidate/logs, and report the blocked verification scope and next decision. Certification failure preserves accepted objectives; only supported unrelated harness failure permits already-selected same-Horizon work with its own required checks, bounded to four uncertified objectives. Product/unknown failures block scoped acceptance. Certify before a fifth objective or milestone/release; never treat harness FAIL as PASS. Do not reset the recovery record or bypass the canonical runner. Establish the cause with smaller reproductions before repair verification.

For 0.12.0, objective verification uses `gauntlet:quality -- --base <candidate-parent> --execute --out docs/evidence/<id>/quality.json`. Whole-repository certification uses `gauntlet:quality -- --stage certification --target HEAD --execute --out docs/evidence/CERT-<boundary>/quality.json` with committed inputs. Read the canonical product-quality contract for bootstrap, evidence reuse, full-risk escalation and certificate publication. Publish certificates separately with remote containment. Milestone evaluation requires `--target <certified-sha>` and playtest evidence naming that exact target. Model routing, native scheduling and acceptance durability remain unchanged.
