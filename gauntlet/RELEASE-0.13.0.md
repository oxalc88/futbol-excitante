# Gauntlet 0.13.0 — Product-First Autonomous Execution

Base inspected: main 0203403 (0.12.0). This release changes Gauntlet only. No application/gameplay source, protected oracle, normative gameplay requirement, timeout, retry setting or normal recovery budget changes.

## Observations verified before implementation

| Observation | Result | Actual evidence / limit |
|---|---|---|
| A: 0.11.2/0.11.3 bounded recovery | Confirmed | quality-execution.ts; 0.11.2/0.11.3 real-command tests; runtime-policy.json |
| B: 0.12 objective/certification separation | Confirmed | scopedPlan, certificationHealth, verifyObjectiveAdmission and candidate-quality |
| C: mapped gameplay uses affected checks | Confirmed | ball/contacts/locomotion/card/foul/advantage/input-browser mappings, both-tree transitive test calculation |
| D: simulation fall-through becomes full_required | Confirmed | generic simulation/contracts determinism/architecture rule; input/input-system.ts and loop helpers before this release |
| E: expired legacy incident inheritance | Confirmed | scoped-quality-command imports oldPaths into full-required/certification using earliest start/max attempts |
| F: RECOVERY_BLOCKED before check launch | Confirmed | recoveryTimeRemaining called before spawnQualityCheck; executable 0.12 migration test |
| G: objective/CERT/session/model rename cannot reset | Partially confirmed | certification repository record prevents CERT/model/session reset; legacy full-required objective lookup was objective-specific, so objective renaming could miss its old local record |
| H: future recovery authority local | Confirmed | .delivery-local/quality/**/recovery.json drives preflight, budget, repair eligibility |
| I: unavailable in other checkout/machine/observer | Confirmed | .gitignore excludes .delivery-local; no canonical incident publication |
| J: blocked workers despite safe product work | Partially confirmed | scoped admission permits limited same-Horizon work, but recovery prose directs reporting/stopping; no unified runtime continuation decision. No live worker session inspected |
| K: user must inspect sessions to find stop | Partially confirmed | blocked.json and stderr/report exist locally, no canonical structured stop or proactive notification adapter; actual user/session behavior not measured |
| L: repeated Gauntlet machinery work | Partially confirmed | two normal repair attempts bounded by elapsed budget, but no per-incident diagnosis/machinery-work bound or product-first engineering escalation contract. Actual session spend not measured |
| M: independent-objective parallelism | Confirmed | parallel-policy and OMP hook require distinct synchronized READY issues/objectives and no acceptance dependency; no one-parent execution-unit DAG |

## Correction and simplification

One harness-neutral continuation policy replaces duplicated stop instructions. Canonical append-only incidents replace production local recovery authority. One product issue owns dependency/ownership units and one integrated acceptance; old independent-objective tooling remains compatible. The existing TypeScript dependency mapper and check-proof engine are reused, not replaced. The simulation mapper adds a closed AST helper-body boundary; stepping/public declarations, clocks, RNG, replay, world construction/serialization, shared configuration and unknown impact still require full verification. The goalkeeper domain inventory now includes actual gk tests as well as goalkeeper tests.

Certification debt, the four-objective limit and exact-target milestone/release barrier remain. Supported unrelated HARNESS_ENVIRONMENT certification failure can permit only independently verified current-Horizon work; PRODUCT_FAILURE, UNKNOWN, invalid evidence and intervening unaccepted changes retain their barriers. Accepted objectives remain accepted while certification is blocked.

See product-first-contract.md for commands, lifecycle, material repair, execution-DAG contracts, escalation and observed notification capability. The 0.11/0.12 runner compatibility branches remain for executable historical fixtures/receipt behavior; 0.13 execution uses canonical incidents exclusively. Frozen historical records and baselines are unchanged.

## Validation

Validation on the inspected pinned toolchain:

- TypeScript checks, production build and deterministic Gauntlet evals pass (49 scenarios + 60 prompt checks).
- Architecture, runtime and 0.11/0.12 regressions pass (100 tests); the added scope/core/OMP tests cover 11 cases, including real command execution, proof production, settlement and candidate validation.
- Existing parallel-policy/OMP gate checks pass. Underlying headless smoke passes using `node --import tsx` with the same pinned Node and scenario; this does not certify the unchanged canonical `tsx` app command.
- Full `test-all` was attempted and failed: 224 files/3799 tests passed, 7 files/5 tests failed, 2 tests skipped, one worker error. The CLI exit and RELEASE-0.9.8 specification binding failures reproduce on untouched main 0203403. The architecture probe collision passes in isolated verification; its test-owned transient file was removed.
- Real browser verification is blocked by absent Chromium. Native Playwright installation failed with its lock-staleness error; timeouts/budgets were not increased. Full repository certification is **not proven**, and no certificate/PASS is published.
- Critic and integration agent advisory code reviews accepted the corrected implementation. These are advisory reviews, not formal Gauntlet acceptance/provenance records.

 New evals exercise actual CLI migration/repair/reservation, cross-checkout visibility, scope boundaries, DAG dependency/conflict readiness, real local unit proof production/settlement, one integrated candidate acceptance gate, incomplete integration rejection and external-decision stops. No speedup or token-saving claim is made without measured trajectories.
