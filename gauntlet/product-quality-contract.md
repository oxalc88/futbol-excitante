# Product verification and repository certification (0.13.0)

Objective acceptance and milestone certification are separate boundaries. A durable objective acceptance proves the current candidate's required baseline, affected checks, evidence and independent reviews. It does not claim a repository-certified milestone. A Horizon still needs a materially better normal shipped-play comparison; internal acceptance alone is not product success.

## Canonical commands

Preview actual changes with `mise exec -- pnpm run gauntlet:quality -- --base <candidate-parent>`. `--expected-paths <paths.json>` is advisory only and cannot execute or grant a waiver. Execute objective verification before the candidate snapshot:

```sh
mise exec -- pnpm run gauntlet:quality -- --base <candidate-parent> --execute --out docs/evidence/<objective>/quality.json
```

For a bootstrap attempt, milestone boundary, release candidate, explicit human request, or the four-objective integration limit, commit all inputs and freeze HEAD. Run whole-repository certification:

```sh
mise exec -- pnpm run gauntlet:quality -- --stage certification --target HEAD --execute --out docs/evidence/CERT-<boundary>/quality.json
```

The runner appends `gauntlet/certification/*.json` and immutable receipt/log/report artifacts. Publish these in a separate serialized bookkeeping commit through git-committer, push and verify remote containment before using the certificate for continuation or milestone claims. Certification validates its frozen target, never the later metadata publication SHA. Never mix certificates/state/manifests with candidate implementation snapshots. Old acceptance records remain unchanged.

## Deterministic scope

`gauntlet/runtime/scoped-quality.ts` uses actual before/after trees, the existing `product-quality.ts` protected-property map and suite registry, and TypeScript import/re-export dependencies. It is an explicit dependency map, not an AI classifier or a workflow taxonomy.

Always-on baseline: typecheck, build, contract checks, a fresh state audit, architecture/candidate-scope/Gauntlet regression files and no known accepted regression. Product candidates also retain browser verification; protected properties retain simulation smoke. Protected domain changes run their existing domain assurance and transitive affected Node tests. Rules/fouls affect both domains; ball, contacts, locomotion and input preserve the existing overlapping protected properties. Team checks verify the declared/deferred status, never fabricate team PASS.

Closed presentation/document leaves retain browser checks and normal play without unrelated physics suites. Gauntlet-only changes run Gauntlet/architecture regressions plus parallel-policy and runtime-telemetry checks; they do not alter the game or launch its browser battery. Unknown scope, unresolved/dynamic dependencies, core determinism, replay/persistence, protected architecture, shared configuration or elevated risk requires complete repository checks immediately. Flags can only add assurance. A changed ordinary test participates in actual dependency selection and does not erase the affected source's protected properties; an isolated unmapped test change escalates.

Complete repository checks include the entire Node and browser inventories, simulation smoke, typecheck, build, Gauntlet contracts/state, parallel policy and runtime telemetry. A complete Node run covers the existing domain test inventories, avoiding duplicate execution of those same files. Missing files/results, skipped required assertions, absent inventory, crashes, cancellation and unhandled worker errors cannot become PASS. No application oracle or suite registry is relaxed.

Both critic and integration review are mandatory for protected gameplay, deterministic/core simulation, rules, replay, persistence, architecture boundaries or elevated regression evidence. Ambiguous impact runs both. Integrated execution-unit candidates always require both independent reviews. For other candidates only the existing closed presentation/document leaf allowlist can record `NOT_REQUIRED`; invoked reviewers still require independent models and ACCEPT. Evidence-only objectives retain both reviews. Fresh screenshot/audit artifacts accompany the actual scope; accepted evidence edits elevate risk.

Acceptance recomputes the candidate's actual parent, paths, exact plan, source hashes, every required zero exit, immutable proof artifacts and review applicability. New candidates cannot downgrade to schema 1. Verification files can be added, never mutated. `quality.json` is hashed into the existing manifest and transitively hashes its per-check logs and test reports. Candidate snapshots, semantic/evidence audits, issue-gated parallelism, serialized publication and remote durability keep their existing guarantees.

## Failure semantics and useful continuation

`PRODUCT_FAILURE` means a demonstrated assertion failure/regression. `HARNESS_ENVIRONMENT` is narrowly evidenced: a complete passing assertion inventory plus the recognized Vitest worker transport error, or an observed missing spawned executable. Generic timeouts/crashes, partial output, contention reports without attribution and provider hypotheses stay `UNKNOWN`. Mixed assertion and transport errors are product failures. A harness failure remains FAIL, never PASS or a certificate.

A scoped objective requires a recorded certification attempt before acceptance. A supported unrelated harness failure may leave certification blocked while already-selected objectives in that same Horizon continue through all their own required checks/reviews/durability. Known product failure, unknown/invalid certification evidence, or intervening unaccepted source changes block scoped acceptance. High-risk candidates must pass complete current-candidate checks. No known product regression may silently continue.

At most four objectives can remain uncertified; certify before accepting a fifth, including high-risk work. A milestone or release cannot pass without a full PASS for the exact played target. A blocked certificate does not revoke valid objective acceptances or erase their evidence. Preserve unresolved certification debt visibly in trajectory and state audit. Do not select another Horizon to escape a blocked certificate.

## Valid evidence reuse

PASS evidence binds content and file inventory, exact command/suite selection, verifier protocol/runtime, configuration, pinned Node/pnpm/Vite, installed tool versions and a hashed environment. Full logs and original Vitest JSON are immutable compressed artifacts. Validation recomputes input identity and exact executed test inventory; local cache indexes are hints, never authority. Unknown file/data dependencies use a whole-tree key. Build/typecheck/browser keys narrow only through explicit compilation roots or statically resolvable dependency closure. Source, toolchain, environment or suite changes invalidate affected proof.

The state audit always executes fresh. Equivalent complete PASS checks may be reused; failed, partial, interrupted or merely focused repair evidence cannot cover broader required checks. A whole-check repair PASS can cover that identical check in the next complete invocation. No receipt crosses candidate parents without recomputed input/provenance validation. Certification is target-bound even when some valid check proofs are reused.

## Bounded repair and canonical continuation

The runner stops after the first failed check; remaining checks are NOT_RUN. Only the complete required-plan PASS permits candidate persistence. Equivalent complete PASS checks may be reused; the state audit always executes fresh. REPAIR_PASS is diagnostic only. After two identical failures, the existing reproducer derivation retains the whole failed check.

The shared instruction applies automatically to all harnesses: follow `product-first-contract.md` and `runtime/continuation.ts`. RECOVERY_BLOCKED blocks the incident's claim, not all product work. Do not reset the record. The legacy normal budget remains two canonical repair attempts and 90 minutes, with earlier unrecorded history UNAVAILABLE; 0.13 permits at most one causal diagnosis, one machinery repair and one audited recovery execution. Whole Node remains 40 minutes; other/focused checks remain 20 minutes. These are unchanged check limits, not a new recovery budget.

0.13 recovery authority lives only in Git-backed `gauntlet/incidents/`. A passing derived material-repair reproducer, durable machinery identity and original failure proof are required before REPAIR_CONFIRMED. Publish that transition, reserve and publish RESUME_ONCE, then run the required plan exactly once. Sessions/models/CERT labels cannot reset history. Local packets/cache/locks are transport/runtime data only. UNKNOWN certification failures cannot authorize scoped continuation. No harness failure is PASS.

Simulation mappings use actual before/after trees. Existing ball/contacts/locomotion/rules mappings remain. In input/input-system.ts only allowlisted slot/player selection helper bodies use affected verification; input scheduler memory, duplicate/fallback policy, wiring assurance and public contracts remain full-required. In loop/simulation.ts only the closed helper-body allowlist in simulation-impact.ts can use affected verification when imports, public declarations, stepping/clock/update order and outer structure are unchanged. Protected domain suites, actual transitive tests, baseline, browser checks and sim smoke remain. Changed deterministic machinery or unknown helpers/impact requires full verification.

Every invocation appends immutable receipt/log/report proofs and executed/reused measurements, including failed and diagnostic runs. Certification publication, bounded debt, independent reviews, exact-target promotion and normal-play trajectory guarantees above remain mandatory.

0.13.2 distinguishes unattested historical imports from source-bound current failures. The single changed-input full certification observation in `product-first-contract.md` preserves UNKNOWN and the entire consumed recovery history; it is not REPAIR_PASS or RESUME_ONCE. Existing check limits, coverage proofs and certification/debt barriers still apply. Only a complete independently validated current certificate can authorize subsequent scoped claims. Execution ancestry bookkeeping uses cryptographically verified exact-tree records, never edited historical receipts.
