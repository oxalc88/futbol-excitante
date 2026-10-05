# Product verification and repository certification (0.12.0)

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

Both critic and integration review are mandatory for protected gameplay, deterministic/core simulation, rules, replay, persistence, architecture boundaries or elevated regression evidence. Ambiguous impact runs both. Only the existing closed presentation/document leaf allowlist can record `NOT_REQUIRED`; invoked reviewers still require independent models and ACCEPT. Evidence-only objectives retain both reviews. Fresh screenshot/audit artifacts accompany the actual scope; accepted evidence edits elevate risk.

Acceptance recomputes the candidate's actual parent, paths, exact plan, source hashes, every required zero exit, immutable proof artifacts and review applicability. New candidates cannot downgrade to schema 1. Verification files can be added, never mutated. `quality.json` is hashed into the existing manifest and transitively hashes its per-check logs and test reports. Candidate snapshots, semantic/evidence audits, issue-gated parallelism, serialized publication and remote durability keep their existing guarantees.

## Failure semantics and useful continuation

`PRODUCT_FAILURE` means a demonstrated assertion failure/regression. `HARNESS_ENVIRONMENT` is narrowly evidenced: a complete passing assertion inventory plus the recognized Vitest worker transport error, or an observed missing spawned executable. Generic timeouts/crashes, partial output, contention reports without attribution and provider hypotheses stay `UNKNOWN`. Mixed assertion and transport errors are product failures. A harness failure remains FAIL, never PASS or a certificate.

A scoped objective requires a recorded certification attempt before acceptance. A supported unrelated harness failure may leave certification blocked while already-selected objectives in that same Horizon continue through all their own required checks/reviews/durability. Known product failure, unknown/invalid certification evidence, or intervening unaccepted source changes block scoped acceptance. High-risk candidates must pass complete current-candidate checks. No known product regression may silently continue.

At most four objectives can remain uncertified; certify before accepting a fifth, including high-risk work. A milestone or release cannot pass without a full PASS for the exact played target. A blocked certificate does not revoke valid objective acceptances or erase their evidence. Preserve unresolved certification debt visibly in trajectory and state audit. Do not select another Horizon to escape a blocked certificate.

## Valid evidence reuse

PASS evidence binds content and file inventory, exact command/suite selection, verifier protocol/runtime, configuration, pinned Node/pnpm/Vite, installed tool versions and a hashed environment. Full logs and original Vitest JSON are immutable compressed artifacts. Validation recomputes input identity and exact executed test inventory; local cache indexes are hints, never authority. Unknown file/data dependencies use a whole-tree key. Build/typecheck/browser keys narrow only through explicit compilation roots or statically resolvable dependency closure. Source, toolchain, environment or suite changes invalidate affected proof.

The state audit always executes fresh. Equivalent complete PASS checks may be reused; failed, partial, interrupted or merely focused repair evidence cannot cover broader required checks. A whole-check repair PASS can cover that identical check in the next complete invocation. No receipt crosses candidate parents without recomputed input/provenance validation. Certification is target-bound even when some valid check proofs are reused.

## Bounded repair, not repeated full experiments

The canonical runner stops after the first failed check. Remaining checks are `NOT_RUN` with null exits. Read the durable failed log/report, establish cause with smaller reproductions, repair without weakening assertions, and write `{ "diagnosis": "Observed cause, repaired files and supporting reproduction" }`. Use the original scope/base; add `--stage certification --target HEAD` for a certification incident:

```sh
mise exec -- pnpm run gauntlet:quality -- --base <candidate-parent> --execute --repair .delivery-local/diagnosis.json --out docs/evidence/<objective>/quality.json
```

The runner derives repair commands from the failure, not an arbitrary LLM command. Complete failure summaries select all failed files. Unknown/partial failures rerun the whole failed check. After two identical failures it uses the whole failed check to detect interactions. `REPAIR_PASS` is diagnostic only; invoke the normal scoped command to complete missing coverage. Only the complete required-plan PASS permits candidate persistence. Do not repeat the full battery merely to regenerate already-valid proof.

The shared instruction applies automatically to OMP, Grok and OpenCode. Keep 0.11.3 limits unchanged: whole Node 40 minutes, other/focused checks 20 minutes, two canonical repair attempts and 90 minutes elapsed recovery. The incident deadline includes diagnosis/idle/repair/completion; attempts are reserved before execution. A new signature, source, model or session does not reset it. Certification uses one repository/worktree incident record so another CERT name cannot reset its budget. Objective incidents stay separate. Old broad recovery files remain byte-for-byte diagnostics; mapped bounded objectives do not inherit an unrelated certification incident. New required full scopes honor an old exhausted incident. Certification imports unresolved legacy whole-gate incidents using the earliest deadline and greatest recorded attempt count, with source hashes, instead of granting a fresh budget under a CERT label. Earlier unrecorded attempts remain `UNAVAILABLE`.

At `RECOVERY_BLOCKED`, preserve the candidate/evidence/incident, stop equivalent experiments and report cause/unknowns and the next execution-policy or environment decision. Do not delete/reset records, rename incidents, raise limits to evade a stop, run equivalent commands outside the canonical runner, patch installed dependencies, ignore worker errors or relax tests. A worktree publisher lock prevents overlapping runs; inspect a stale lock's process before removing that lock, never the recovery incident. Isolated parallel builders retain native harness scheduling. A blocked certification can still permit the bounded same-Horizon continuation above; blocked objective verification cannot accept that objective.

Every invocation appends an immutable receipt with actual executed/reused checks and verification milliseconds, including failures and repairs. Future trajectory records aggregate committed receipts with path/hash/revision provenance, plus certificate status and objective debt. These are committed-run measurements, not complete session/provider accounting. Missing cost data stays null, never zero. Existing telemetry supplies token/human-intervention/timing observations where coverage exists; no measured speedup is claimed.
