# Gauntlet acceptance and repository certification

Status: **design for review; not executable policy**. This PR adds only this document. Gauntlet remains **0.11.3**. A later implementation may become 0.12.0 after its evals pass; this document does not authorize agents to use the proposed acceptance rules now.

## 1. Decision and evidence scope

Separate durable objective acceptance from certification of an integrated repository revision. An objective must pass its mechanically selected baseline, affected regressions and protected-property assurance before its required reviews and durable acceptance. Full repository verification protects milestone/release claims and defined escalation boundaries. A certification runner failure must not erase valid objective evidence or automatically cause every objective check to run again.

This changes where verification is required, not whether required verification can fail. A required objective check that crashes still blocks that objective. A demonstrated product regression blocks promotion of the affected integrated state. A milestone is certified only when all required repository checks and its existing gameplay/perceptual gates pass for the same revision.

Inspected `main`: [`f3c83d6ebadc1b8103dffffee5c2b0c184269d83`](https://github.com/oxalc88/futbol-excitante/commit/f3c83d6ebadc1b8103dffffee5c2b0c184269d83), merge of PR #31, committed 2026-10-04 17:12:49 UTC. `gauntlet/VERSION.json` declares 0.11.3. File references below describe that revision, not a mutable future `main`.

Evidence classes used here:

| Evidence | Status | Limit |
| --- | --- | --- |
| Source paths, function behavior, commands and configured limits at the inspected commit | RECONSTRUCTED_EXACT | Direct source inspection; configuration is not measured runtime. |
| Three calls to the actual `qualityPlan()` for CSS, card policy and Gauntlet runtime paths | MEASURED | Read-only plan probes in this workspace, Node 24.19.0; not gameplay/determinism acceptance runs under the repository's pinned Node 24.18.0. |
| Worker reports of roughly 30-minute Node runs, successful focused repairs, worker RPC errors and host contention | RECONSTRUCTED_ESTIMATE | User-supplied screenshots/reports, not independently reproduced server logs. Reported test counts are claims, not a new certified result. |
| Complete raw logs, source hashes, exit statuses and Grok/OMP sessions for that running server candidate | UNAVAILABLE | This checkout does not expose that live server/session. Do not certify the feature or attribute the exact runner defect from the screenshots alone. |

The source inspection covered the requested contracts, all six state files, the runtime/CLI and adapter entry points, deterministic scenarios and prompt gates, acceptance/manifest/durability writers, milestone evaluator, trajectory validators, CI selector/classifier/monitor, and the executable registries/runners/oracles under `eval/`. It does not claim to have executed every evaluator, replayed every historic session, or reproduced the full Node/browser battery.

Repository history supports the failure pattern independently of the screenshots. [`docs/evidence/NODE-GATE-REGRESSION-TRIAGE/RESULT.md`](../../docs/evidence/NODE-GATE-REGRESSION-TRIAGE/RESULT.md) records an earlier whole-suite command-cap problem and complete execution as shards across 168 Node files. [`RELEASE-0.11.0.md`](../RELEASE-0.11.0.md) explicitly reports pre-existing capture-test timeouts, a release-binding expectation and accepted-evidence mismatches on both compared revisions. Therefore, current CI classification must not be described as proof that every raw suite is green. The screenshot's pending `FOUL-CARD-SEVERITY` work is not a committed acceptance in inspected `main`; committed `HORIZON.md` describes completed v38 advantage work. Preserve that distinction.

## 2. Diagnosis and exact coupling point

| Component at the inspected commit | Actual behavior | Consequence |
| --- | --- | --- |
| [`runtime/product-quality.ts`](../runtime/product-quality.ts), `qualityPlan`, lines 58–67 | Unconditionally adds typecheck, build, **whole** Node tests, Gauntlet eval, state audit and **whole** browser tests. Impact rules add simulation/domain checks. | A trivial CSS leaf still gets the whole Node and browser batteries. Impact narrows additional assurance, not the expensive baseline. Domain filters also overlap tests already run by the whole Node command. |
| [`PROMPT.md`](../PROMPT.md), pipeline steps 5–8 | Runs `gauntlet:quality` before reviews/snapshot; changed final artifacts require refreshing the receipt. | Certification cost enters every objective and can repeat after evidence changes. |
| [`scripts/gauntlet/product-quality.ts`](../../scripts/gauntlet/product-quality.ts) | Starts a new NOT_RUN receipt; stops at first failure; focused repair writes diagnostic REPAIR_PASS; a matching proof permits one fresh full plan. No earlier PASS is reused. | A repaired failed check does not retain earlier valid checks and a whole-check repair can be followed by another execution of that same whole check. |
| [`runtime/quality-execution.ts`](../runtime/quality-execution.ts) | Nonzero exit/crash/timeout becomes FAIL; failure signature and complete failing-file summaries determine repair scope. Missing files or repeated identical failure expands to the whole failed command. | A worker failure with no failed-test-file list can lead to another complete Node run. There is no product-versus-harness failure classification. |
| [`runtime/candidate-quality.ts`](../runtime/candidate-quality.ts), `verifyCandidateQuality`, lines 9–23 | Loads candidate receipt; recomputes parent/diff/plan; validates changed-file hashes, required rows and reviews. | A focused diagnostic receipt cannot pass acceptance. |
| [`runtime/product-quality.ts`](../runtime/product-quality.ts), `validateQualityReceipt`, lines 79–84 | Requires full execution/PASS when fields are present and one zero-exit row for every required check. Legacy optional fields remain compatible. | **Mechanical acceptance boundary: the universally broad plan is required for every new candidate.** |
| [`evals/src/persist-acceptance.ts`](../evals/src/persist-acceptance.ts), line 31, before manifest/result writes | Calls `verifyCandidateQuality`; writes schema-3 candidate acceptance and immutable manifest only after success. | The universal gate prevents durable acceptance and advancement of dependent work. Critic/integration ACCEPT cannot override it. |
| [`runtime/quality-execution.ts`](../runtime/quality-execution.ts), budget helpers; quality CLI | Two repairs and 90 minutes of wall time from first failure, including idle/diagnosis/subsequent full validation. Exhaustion invalidates the current receipt and refuses further execution. | 0.11.3 bounds cost but creates a terminal objective blocker; source changes, session restart and valid focused checks do not remove that boundary. |
| [`evals/src/evaluate-milestone-playtest.ts`](../evals/src/evaluate-milestone-playtest.ts) and `evaluateMilestonePlaytest` in [`evaluate-state.ts`](../evals/src/evaluate-state.ts) | Reduces supplied prerequisites, required situation outcomes and critic verdict into a milestone result. It does not launch a full repository gate. | Existing milestone evaluation can be retained, but it is not already a separate repository certification service. Its input booleans need provenance binding in the redesign. |
| [`scripts/gauntlet/trajectory.ts`](../../scripts/gauntlet/trajectory.ts), acceptance checks | Revalidates candidate quality, manifest links and remote durability before a product ACCEPT. | Changing only the prompt or persistence writer would leave the old coupling in trajectory validation. |

Read-only `qualityPlan()` probes returned:

| Changed path | Reviews | Commands | Whole Node / whole browser |
| --- | --- | --- | --- |
| `src/apps/browser/styles.css` | May record NOT_REQUIRED | 6 | Both required |
| `src/simulation/card-policy.ts` | Both mandatory | 10, including fast/rules/fouls and sim smoke | Both required |
| `gauntlet/runtime/quality-execution.ts` | Both mandatory | 16, including all registered domains and team status | Both required |

The problem is not that verification is mere bookkeeping. Missing coverage is a real uncertainty. The problem is assigning whole-repository proof to every objective and discarding useful proof when a separate command fails. Passing focused tests also does not, by itself, prove that the selection covered every affected property.

Current flow:

```text
player problem -> playable slice -> builder -> tests/artifacts/audit
                                             |
                                             v
                 every objective: typecheck + build
                 + WHOLE Node + WHOLE browser + Gauntlet/state
                 + impact-selected simulation/domain checks
                                             |
                   +-------------------------+---------------------+
                   | all PASS                                      | failure
                   v                                               v
         required critic/integration                     diagnose + focused repair
                   |                                               |
                   v                                  REPAIR_PASS -> fresh FULL plan
       candidate -> persist acceptance                             |
                   |                                   limit exhausted -> objective BLOCKED
                   v                                               |
       state audit -> commit -> remote proof             dependent product work stops
                   |
                   v
             next objective -> normal-play comparison
                                      |
                                      v
                      milestone situation/critic evaluation
```

## 3. Proposed responsibilities and flow

Use one neutral verification engine with two explicit **proof scopes**, objective and repository certification. These describe evidence boundaries, not task classes or a new orchestration framework. The validator derives escalation from the actual diff and accumulated changes; choosing an objective scope on the command line cannot override a mandatory certification barrier.

| Responsibility | Objective acceptance | Integrated repository / milestone certification |
| --- | --- | --- |
| Baseline | Pinned toolchain preflight, typecheck, build, architecture/contract regression baseline, Gauntlet deterministic/prompt checks, applicable deterministic invariants, state/evidence checks, no known accepted regression | All baseline requirements for the target revision; final canonical state/durability validation |
| Regressions | Changed tests plus deterministic affected-test/dependency closure and applicable protected domains; applicable browser integration checks | Complete Node and browser inventories, all applicable existing domain assurance and sim smoke; never convert missing/deferred prerequisites to PASS |
| Protected qualitative quality | Existing independent critic and integration reviewer when impact policy requires them | Existing milestone critic and required perceptual/visual review; cross-objective integration review when composition evidence requires it |
| Evidence | Exact candidate/parent, plan, coverage, executed/reused check proofs, strict evidence class, screenshots/trajectories where required | Exact integrated revision, accepted objective chain, complete inventory/check proofs and bound milestone evidence |
| Durability | Candidate snapshot, acceptance record/manifest, serialized state audit and remote publication before continuation | Append-only certification result and remote containment; no milestone/release promotion until certified |
| Product result | A normal shipped-play slice and Horizon comparison remain first-class; objective acceptance alone is insufficient | Full checks do not substitute for normal play or normative milestone judgment |

Proposed flow:

```text
player problem -> smallest playable slice -> build / observe
                                              |
                                              v
                  baseline + affected tests + protected domain checks
                                              |
                                              v
                    required independent critic + integration review
                                              |
                                              v
                candidate + manifest + state audit + remote durability
                                              |
                                      OBJECTIVE ACCEPTED
                                              |
                    +-------------------------+-----------------------+
                    | next safe objective                             | boundary / escalation
                    v                                                 v
             play / improve slice                         integrated target revision
                    |                                                 |
             normal-play comparison                     full repository certification
                                                                      |
                                      +-------------------------------+------------------+
                                      | PASS + milestone playtest                        | non-PASS
                                      v                                                 v
                               CERTIFIED MILESTONE                         preserve accepted objectives
                                                                              certification BLOCKED
                                                                                       |
                                                        product defect -> repair before promotion
                                                        harness defect -> bounded diagnosis;
                                                                          safe work under section 6
```

A Horizon product improvement, an accepted objective, a repository certificate and a normative milestone PASS are distinct claims. Keep them visibly distinct in status output and trajectory reports. Release certification refers to the code revision being released, not merely to a Gauntlet harness version number.

## 4. Small state machine and durable records

Keep existing objective pending/active/accepted semantics. Do not add four new objective lifecycle states. Acceptance means the objective's required scope passed and the acceptance is remotely durable. It never means every unrelated repository test passed. A local candidate/checkpoint is preserved work but is not yet accepted or a satisfied prerequisite.

Add one append-only certification record stream and a derived latest-status pointer. Proposed storage: `gauntlet/certification/<boundary-id>/attempt-N.json`; the final pathname/schema is an implementation decision. Each attempt binds target commit/tree, parent checkpoint, policy version, included objective acceptances, complete plan/inventory, check proof references, milestone playtest references when applicable, failure class and causal links. Attempt numbers must survive restart and be allocated under serialized publication. Results and prior accepted manifests are immutable. A subsequent repair/supersession appends a new record; it does not overwrite a prior failure or retroactively relabel an acceptance.

The minimal certification states are `PENDING`, `CERTIFIED`, and `BLOCKED`, with a mandatory reason on BLOCKED: product, harness/environment, unknown, or invalid evidence/publication. Running is an execution event, not another durable lifecycle state. A certificate applies to one exact revision. After accepted changes, the latest historical CERTIFIED revision remains recorded while the current revision becomes PENDING.

| Current state / event | Next state | Required action / allowed claim |
| --- | --- | --- |
| Objective active; all required checks/reviews/evidence pass | Accepted after state audit and remote durability | Record objective-scope acceptance, not repository certification. |
| Objective active; any required check fails or is incomplete | Remains unaccepted | Preserve work; repair or surface the blocked check. Harness attribution does not waive a required check. |
| Certification PENDING; all repository requirements pass for the target | CERTIFIED | Persist exact-revision certificate; milestone also needs bound playtest/critic PASS. |
| Certification PENDING; any check crashes, fails or lacks evidence | BLOCKED with reason | Persist non-PASS, affected scope and restrictions. Never infer PASS from assertion counts. |
| BLOCKED; a diagnosed repair/environment decision is ready | PENDING for a new attempt on a named target | Preserve previous attempt and proof; use bounded recovery, not a budget reset or repeated whole-suite experiments. |
| CERTIFIED target; integrated source/config changes | PENDING for the new target | Recompute coverage/impact. Historical certificate remains true only of its recorded target. |
| An accepted objective is later implicated in a regression | Its acceptance remains historical; current health becomes BLOCKED/product | Append defect and corrective acceptance/revert links; do not advertise the current state as healthy or rewrite history. |

Persist this example honestly:

```text
Objective A: accepted, candidate + remote acceptance references
Objective B: accepted, candidate + remote acceptance references
Objective C: accepted, candidate + remote acceptance references
Current integrated revision: <sha>
Last certified revision: <sha or UNAVAILABLE>
Certification of current revision: BLOCKED / HARNESS_ENVIRONMENT
Milestone promotion: prohibited
Next permitted action: <deterministically admitted safe task or repair>
```

Freeze the certification target before running checks. Publish the certificate in a subsequent bookkeeping commit that references that immutable target; do not hash the certificate into its own input or claim that this later commit was the tested target. A validator must verify remote containment of both and prove that intervening publication edits contain only explicitly allowed certification/state metadata, with a fresh state audit. Any source, test, policy, configuration or consumed-evidence change requires a new target/plan. Status and release consumers display the certified target SHA separately from the publication SHA; they cannot infer certification of arbitrary descendants.

Acceptance and certification have the same serialized state-publication discipline. A failed remote push remains a durability blocker; a verification classification cannot bypass it. If state audit or publication itself fails, preserve a local checkpoint and stop canonical acceptance rather than manufacture durable progress.

## 5. Deterministic verification and escalation

Extend the current map and executable registries; do not replace them with an LLM classifier. Objective checks are the union of the always-on baseline, changed tests, affected dependent tests, selected protected suites, relevant browser/application entry checks and any pending interaction obligation for the candidate's ancestors.

The existing `DOMAIN_TESTS` filters are a starting point, not sufficient proof of a complete dependency graph. Many suites declare `impact_closure: NONE`; that field does not authorize skipping consequences. Bind the physical ball/contact/rules consequences already listed by `qualityPlan`, replay/state dependencies, oracle/scenario/policy bindings and browser composition roots. A source import graph alone misses filesystem-loaded fixtures, dynamic imports, CLI-spawned servers and normal-play entry points. Explicit dependencies must cover those uses. Resolve changes against both parent and candidate inventories, including renamed/deleted tests and removed imports. Unknown dependencies, unsupported loaders, unexplained test deletion or missing inventory force broader coverage.

| Actual change / evidence | Required objective assurance | Escalation |
| --- | --- | --- |
| Existing closed CSS/controls-legend/document leaf, no added behavior or elevated evidence | Baseline, directly affected regression/browser checks, screenshot/normal-play observation where applicable | Existing deterministic NOT_REQUIRED review waiver may remain. Arbitrary renderer/composition-root changes do not inherit it. |
| Ball / locomotion / contacts | Current explicit consequence closure, fast/common deterministic invariants, affected node/integration/browser coverage | Both reviews mandatory. If closure reaches shared core without a complete map, certify before accepting. |
| Local card/foul/advantage policy | Rules + fouls, relevant loop/restart/card consequences, common invariants, gate-on/gate-off regressions and browser evidence for a shipped claim | Both reviews mandatory. Protected assertions/oracles remain unchanged; local gameplay changes need not automatically become whole-repository changes. |
| Goalkeeper or input role routing | Goalkeeper + mapped team/rules/action consequences, ownership/wiring checks and affected browser cases | Both reviews; broader integration when shared input/role composition changes. |
| Replay, serialization, persistence, shared simulation loop/world/PRNG/tick contracts | Replay/determinism/persistence plus all reachable gameplay assurance | Full repository proof **before objective acceptance**, not deferred certification. |
| Architecture boundaries, evaluator/oracle policy, suite inventory/selection logic, shared runner config/toolchain/dependencies | Architecture/evaluator integrity, inventory/selector tests and all potentially affected commands | Full proof before acceptance of these cross-cutting changes. Oracle weakening is a rejection, not an impact waiver. |
| Isolated test-launcher repair | Exact changed launchers, affected harness/integration contracts and actual pinned-tool readiness; ordinary baseline remains required | Independent review; if the repair changes global Vitest config/dependencies, apply the shared-runner rule above. Test-only scope is not automatically safe. |
| Unknown path, ambiguous dynamic/data dependency, elevated regression evidence or changed accepted artifacts | Conservative union of potentially affected domains and tests | Full proof before acceptance when coverage cannot be demonstrated. Accepted artifacts are immutable; investigate mutations rather than silently recertify them. |
| Several accepted changes overlap a protected property or composition root | Reverify their union on the current integrated parent before the next acceptance | Broader integration coverage; unknown combined closure forces full verification. Independent isolated PASS results do not prove their composition. |
| Known product regression or a credible unresolved product-failure signal | Repair/revert plus reproduction and affected assurance | Block promotion and ordinary acceptance on the affected integrated state. Do not classify away an inconvenient assertion failure. |

Always-on means a requirement remains satisfied by fresh execution or eligible validated proof; it does not mean a command must always be repeated. State audits bind the current transition and run again after bookkeeping; qualitative reviews bind the reviewed candidate/evidence and cannot be reused across material changes merely because code tests were cached.

Full certification is mandatory for normative milestone completion, release candidates, an explicit human full-verification request, and the pre-acceptance escalation rows above. Horizon normal-play success still needs a materially better product result. Horizon closure should run the union of accumulated integration checks; it does not by itself certify a normative milestone.

To prevent indefinite hidden regression debt, use a finite integration interval as part of the reviewed pilot: **at most four newly accepted objectives since the last complete repository verification, then require full certification before a fifth**. Four is a proposed conservative experiment setting inspired by the existing 1–4 objective Horizon size, not a measured optimum or an existing rule. Trigger sooner at a meaningful milestone/release or any full-verification escalation. Uncertified time and regression detection latency must be measured; do not silently expand this interval to escape a blocked certificate.

## 6. What may continue while certification is blocked

Continue only if every required objective check is complete and valid for the candidate, required reviews/evidence/durability pass, no known product regression exists in the integrated chain, impact/interaction coverage is complete, and the unresolved certification failure is supported as a harness/environment failure rather than unknown application behavior. A crash in a required affected browser or Node check still blocks that objective; unrelated successful tests cannot substitute for it.

For harness-only blocked certification, finish only already-selected safe objectives within the current 1–4 objective Horizon and the four-objective integration interval. Do not open successive Horizons to evade certification. Recompute actual impact before each publication, recheck the regression inbox at the existing pickup points, and do not modify the failing harness/shared configuration inside an otherwise admitted product candidate. Dependent objectives may consume accepted **objective** prerequisites; dependencies requiring a certified milestone remain blocked. Existing READY issue/worktree/ownership rules still apply.

At the interval cap, a high-risk escalation, an unknown failure, or a product-failure signal, additional work may still be useful in isolated local checkpoints: inspect/play the candidate, gather missing evidence, design the next slice or diagnose the harness. It cannot advance canonical acceptance or a certified milestone until the blocker is resolved. A repair/revert path must remain executable even when ordinary product acceptance is stopped: verify the fix against the frozen defective revision, required affected checks and applicable full barrier, then publish its corrective acceptance and replacement certification together. This avoids making a new PASS certificate a prerequisite for attempting its own repair.

A demonstrated product defect takes priority over new accepted product work on the broken integrated chain. Preserve A/B/C's acceptance history, append the defect and corrective/revert references, and restore the affected property. Independent work can remain isolated; it cannot silently publish on top of a known accepted regression. An unknown crash cannot be treated as proven unrelated merely because many assertions passed.

## 7. Verification evidence reuse

Use content-addressed **check proofs**, not a generic result cache that can mark a task green. Each proof records actual canonical command and arguments, complete selected test IDs/files, coverage/inventory hashes, exit status, completion, start/end and duration, logs/report hashes, failure diagnostics, immutable producing candidate/tree and a validator-computed input key. A reusable PASS requires complete execution, exit zero, zero unhandled runner errors and mandatory tests present. REPAIR_PASS, NOT_RUN, partial output, cancelled runs, unknown outcomes and legacy receipts lacking these bindings are ineligible by default.

Proposed key:

```text
SHA256(
  proof schema + verifier/impact-policy version
  + canonical command + suite/registry/oracle/scenario/seed/config versions
  + selected-test inventory + complete relevant dependency contents
  + toolchain/lockfile + runner/build configuration
  + explicit semantic environment + runtime/browser/OS profile
)
```

Record full producing tree identity for provenance. Start with a whole-tree key where dependency completeness is uncertain; reuse across different trees only when a validated relevant-input closure proves equality. A changed tree is not automatically equivalent, and an unchanged changed-file list is not sufficient. Relevant input inventories must include added/deleted/renamed files, data reads, generated input provenance and CLI/browser app composition. Exclude only defined verifier outputs from their own keys to avoid a receipt hashing itself; generated artifacts consumed by a test are inputs and cannot be globally excluded.

| Input/event | Required validity rule |
| --- | --- |
| Source, test, fixture, oracle, suite/policy, scenario/seed or config change within a check's closure | Invalidate that proof; recompute selection and execute missing coverage. |
| Shared compiler/runtime/runner config, lockfile, installed-version drift, browser binary or architecture/OS/runtime change | Invalidate all affected proofs; unknown effect invalidates all. Use frozen installs; never patch installed dependencies to preserve a key. |
| Semantic env flags (evidence mode, WIP inputs, feature flags, browser mode, runner worker settings) | Include explicit values in the key; unenumerated relevant environment prevents reuse. Secret values must not be logged; unavoidable secret-dependent runs are non-cacheable unless a safe identity model is established. |
| Resource-sensitive/intermittent test or unexplained harness/worker incident | Mark implicated proofs non-reusable pending diagnosis. Prior passing counts do not establish stability. Record contention evidence; unknown environment profile prevents reuse. |
| Log/proof missing, tampered, not remotely durable, unsupported schema or untrusted origin | Reject reuse; do not accept a supplied hash without the referenced bytes and producer provenance. |
| Another objective/session/harness offers the same proof | Recompute its key, command/coverage and trusted origin. Harness name alone neither grants nor invalidates equivalence; actual runtime/env identity controls it. |
| Canonical state or acceptance bookkeeping changes | Rerun the current state transition audit; do not reuse a state audit from the previous transition. Preserve independent source-check proof where inputs truly remain equal. |

The ignored local index is a lookup optimization only. Acceptance embeds references to immutable, committed check proofs in its manifest, verifies their byte hashes and eligible origin, and recomputes keys from the candidate snapshot. Producing logs/reports must be committed compact evidence or immutable externally stored artifacts with hashes and a durable availability contract; a path in ignored local artifacts is not remotely durable proof. If an external artifact expires or disappears before required validation, reject reuse and run again. Trust remains the repository's authorized evidence producer/reviewer model; hashes detect staleness/tampering, not whether an authorized writer fabricated a test run.

Reuse requires exact command/coverage equivalence initially. Later, a full-suite proof may satisfy a subset only if complete membership and outcomes prove a conservative superset under identical inputs. A focused repair cannot satisfy a whole-suite obligation. Full certification still requires complete inventory coverage of the target revision, even when some eligible proofs supply unchanged subsets. No duplicate membership, omitted file or `passWithNoTests` success may fill a coverage gap.

After a failure, resume the **missing or invalid required checks**. Retain unaffected valid PASS proofs. If focused repair executes exactly the required check successfully, its validated check proof can satisfy that requirement; the label REPAIR_PASS alone cannot. If it only tests failing files, keep that diagnostic and execute the remaining affected coverage before acceptance. Never repeat a valid whole failed-check repair merely to obtain a second identical wrapper receipt.

## 8. Product versus harness/environment failure

Separate execution outcome from cause. Non-PASS remains non-PASS; the cause controls scope of repair and permitted continuation. Failure attribution can be upgraded by new evidence, never by an agent's unsupported label.

| Observation | Classification and evidence needed | Objective consequence | Certification consequence |
| --- | --- | --- | --- |
| Assertion/oracle/invariant or normal-play regression | PRODUCT_FAILURE signal; identify test/criterion, changed behavior and reproduction. A pre-existing assertion still indicates an unresolved property. | Blocks the affected objective/ordinary promotion until repaired or a reviewed invalid-test diagnosis is proven. | BLOCKED/product; locate culprit and repair/revert. |
| Worker transport/RPC crash, spawn failure, provider interruption or test server readiness defect | HARNESS_ENVIRONMENT only with attributable runner/adapter/process evidence and no competing product-failure signal; otherwise UNKNOWN. | If required for the objective, it remains blocked. Unrelated certification failure may permit section 6 continuation. | BLOCKED/harness; bounded diagnosis/reproduction and a named repair/environment decision. |
| Timeout without attributable cause, mixed errors, runaway worker or incomplete summary | UNKNOWN; timeout may come from changed application behavior as well as infrastructure. | No waiver of affected checks; do not accept into an unresolved affected boundary. | BLOCKED/unknown; isolate cause before canonical continuation. |
| All assertions reported passing, but worker errors/nonzero exit | No PASS. Classify cause from the errors, not the passing count. | Required check incomplete/invalid. | BLOCKED, with complete log and inventory evidence. |
| Host backup contention | Measured process/resource evidence supports an environment hypothesis, not automatic proof of causation. Never stop services without authorization. | Preserve valid independent checks; required incomplete runs need a valid completion. | Arrange an authorized execution environment; do not chase settings through repeated full suites. |
| Missing provenance, stale state, malformed evidence, failed remote publication | INVALID_EVIDENCE or durability blocker; not necessarily a product failure. | Acceptance remains unproven; repair the owning bookkeeping/provenance path. | No certificate promotion; preserve already-valid code evidence. |

Implement classification from structured runner reports/process outcomes and explicit evidence predicates. Retain raw errors. Regex signatures help cluster incidents but must not decide that every timeout is infrastructure. Assertion/invariant failures take precedence over a concurrent worker crash; uncertain or contradictory causes are UNKNOWN. Attribution to the candidate is separate from failure class: base/head equality can show a pre-existing failure but cannot convert it to healthy product evidence.

The existing `PREEXISTING_REGRESSION` PR classifier answers whether the PR introduced a detected difference. It is not a certificate, a failure-cause classifier, or permission to ignore accepted defects. Regression-inbox records remain CI-owned; extend the consumer interpretation only through the reviewed canonical policy. Do not let agents mark them resolved.

## 9. Retain quality and simplify machinery

| Existing guarantee / capability | Keep or adapt |
| --- | --- |
| Deterministic scenarios and prompt/contract checks | Always protect the core acceptance/continuation invariants; add explicit scope/certification cases. |
| Fast, locomotion, ball, touch/actions, duels, goalkeeper, rules and fouls suites | Keep registry versions, oracles, seed/config matrices and applicable assurance. Change scheduling/coverage proof, not expected outcomes. |
| Team declaration/status tests | Preserve the honest deferred/unregistered status; full certification cannot manufacture executable team PASS. |
| Node, browser, typecheck, build and sim smoke | Keep complete repository obligations at certification; objective selection must justify affected coverage deterministically. |
| Milestone situation/perceptual evidence | Keep prerequisites, critic judgment and all existing non-PASS meanings. Add target/certificate provenance; no blanket PASS from submitted booleans. |
| Strict evidence classes, semantic audits, screenshot sanity, candidate scope and manifests | Preserve; browser-visible/temporal claims still need real applicable evidence. |
| State audit, immutable accepted evidence, durability and serialized publication | Preserve at each objective and certification transition. State repair never discards newer canonical progress. |
| Model routing, critic independence, integration capability, builder rotation | Preserve; neither a cached test nor a certificate replaces required independent review. |
| Memory, context packets, checkpoints, verification batching, telemetry and parallel issue gate | Preserve the neutral core and adapter ownership. Checkpoint validity is not acceptance; batching submits the canonical command. |
| Normal shipped-play comparison and trajectory baseline | Preserve product-outcome gate and frozen history. Add certification scope/status to new observations without relabeling old outcomes. |

Remove the compulsory objective-level whole Node/browser pair for mapped bounded changes. Replace “diagnostic repair -> discard all PASS -> fresh whole plan” with validation of durable check proofs and execution of uncovered checks. Avoid running the same domain filters again after an eligible full Node proof already covers their exact tests/inputs. Derive certification debt/status from accepted references plus one append-only stream rather than duplicating objective status into another backlog. Keep one verification command/engine, one impact policy and existing roles; no Pi, extra scheduler, AI classifier or PROTOTYPE/FEATURE/CORE/BUGFIX taxonomy.

Remove the assumption that refreshing screenshot/audit metadata always invalidates every unrelated code check; define check inputs accurately instead. Do not remove a genuine evidence dependency or skip the final evidence gate. Do not add a broad environment “fixer” that continually experiments with runner configuration during product work.

## 10. Placement of 0.11.3 recovery controls

Do not increase the existing limits to make this design work. Keep current values initially and evaluate their usefulness after separating scopes.

| Current control | Proposed placement / meaning |
| --- | --- |
| Fail-fast execution | Keep for both scopes. Persist completed proofs before stopping; remaining work stays NOT_RUN/incomplete. |
| Focused repair verification | Keep for failed affected checks and certification checks. Unknown interactions still require the whole failed scope; “focused” cannot mean fewer than required properties. |
| Two canonical repair attempts | Keep as an automatic troubleshooting bound, scoped to the recorded verification incident/obligation. Do not consume all future product work's permission merely because repository certification is blocked. Do not split signatures/objective IDs to refresh it. |
| 90-minute elapsed recovery deadline | Keep as a stop for the current automatic recovery episode, including its existing wall/idle semantics in the first migration. Its expiry blocks that recovery/certification scope, not unrelated already-proven objective evidence. Do not enlarge it or reset it automatically. |
| RECOVERY_BLOCKED | Keep as an honest non-accepting execution result. Attach the proof scope and cause; an objective-required failure blocks objective acceptance, a certification incident blocks certification. |
| Whole Node 40-minute timeout; other checks 20 minutes | Keep existing process lifetime limits. They protect bounded execution, not completeness or runner correctness. Certification may require an appropriate host or reviewed complete partitioning under the same coverage contract. |
| Proof permits one fresh full gate | Replace with proof eligibility/coverage validation and resumption of missing checks. Preserve one-attempt discipline for an unchanged failing input, not repetition of every successful command. |
| Outer verification-batch allowance | Keep sufficient for the inner canonical plan; update to understand both scopes. It must never kill a valid canonical invocation at the generic 20-minute wrapper limit. |

An exhausted incident remains exhausted. A later diagnosed repair or reviewed environment change creates a linked resumption decision with concrete inputs, affected commands and allowed execution. The core can apply a preapproved deterministic resumption policy automatically when its evidence conditions hold; a materially changed execution policy or service action still needs review/authorization. This is not an unlimited retry reset. Until resumption, safe product continuation comes from separation of acceptance scopes, not from allowing another expensive certification run.

## 11. Migration from 0.11.3

1. Keep this PR design-only. Review the acceptance meaning, full-verification barriers, finite integration interval and failure-attribution requirements before code changes. Do not bump VERSION, publish a release or update running-worker instructions to use an unimplemented flow.
2. Freeze the exact 0.11.3 execution/measurement baseline with hashes, before altering behavior. Keep the existing frozen 0.10 trajectory report; it does not replace a 0.11.3 comparison. Import server logs only when actually accessible; otherwise values remain UNAVAILABLE or explicitly estimated.
3. Add new scope/proof/certification schemas and validators beside legacy readers. New objective records explicitly state objective-scope acceptance and certification target/status. Old records retain their original broad acceptance semantics and bytes. Version/schema dispatch must prevent a new candidate downgrading its receipt to bypass required checks.
4. Run the new selection in shadow mode on representative actual diffs and union-of-objective histories. It cannot waive checks or change acceptance during shadow measurement. Prove completeness with seeded missed dependencies and existing protected mutants before switching behavior.
5. Bootstrap the new certification ledger at a named `main` revision. Use a remotely durable, fully bound existing full PASS only if one actually exists. Otherwise record last certified revision UNAVAILABLE and attempt certification. A verified harness-only bootstrap failure may admit one bounded Horizon under section 6; a product or unknown failure does not authorize ordinary acceptance. Never synthesize a clean historical certificate.
6. Archive/link existing local recovery files as old-schema diagnostics; preserve attempts, failures, wall deadlines and unknown history. Do not silently reset them, reuse unbound 0.11.3 PASS rows, or reinterpret a diagnostic repair as acceptance. The new scope can preserve fresh proofs prospectively without erasing the old blocked incident.
7. Enable objective-scope acceptance only after candidate persistence, trajectory validation, state audit/durability and all three adapter entry points agree. The source of shared instructions is the canonical contract; users should not need a custom unblock prompt each run. Restart/resume workers so they load the implemented version. An already-running worker's memory does not update because `main` changed.
8. After implementation/evals and a controlled pilot, publish the version/release documentation. Rollback stops new-scope acceptance and restores broad scheduling prospectively; it does not rewrite accepted history or delete certification defects. Existing new-scope records remain interpretable by a versioned reader even when the feature is disabled.

For the reported worker, this design does **not** instruct it today to accept a candidate from screenshots or a raw 204/204 result. Before migration, collect the real candidate, repaired files, exact focused commands/exit/error reports, recovery record and logs. A global Vitest configuration/dependency repair falls under the cross-cutting pre-acceptance full barrier. An isolated launcher fix may qualify for mapped assurance, but only after deterministic coverage and evidence validation. Continued useful local work and eventual accepted work are different permissions.

## 12. OMP, Grok and OpenCode compatibility

The core remains under `gauntlet/runtime/`, contracts and canonical commands. Model routes in `models.json` and `.grok`, `.omp`, `.opencode` scheduling/provider retry mechanisms do not change. Keep logical roles, fallbacks, high reasoning where configured, critic model independence and the OMP parallel admission hook.

Update the shared PROMPT/product-quality/runtime-efficiency/acceptance/evidence/trajectory contracts in the implementation, then make each adapter consume the same version and proof scopes. OMP's telemetry/runtime extensions may observe new verification/certification events; they do not make acceptance OMP-specific. Grok/OpenCode use the same artifacts/CLI and expose missing telemetry honestly. Exact token buckets and model/harness identity remain preserved; Grok cache-as-subset and OMP normalized additive usage cannot be compared without matching definitions.

Adapter forward cases must cover start, resume, blocked objective verification, blocked certification with safe next work, cross-cutting escalation, stale proof and remote publication failure. Startup status must show installed version, current objective acceptance scope and current certification target/status without claiming that a pending integrated revision is certified.

## 13. Eval and test plan for the later implementation

This document adds no test oracle or runtime behavior. The implementation must pass the existing Gauntlet maintenance checks plus the following executable cases before versioning:

| Case | Required observed behavior |
| --- | --- |
| Reported scenario: A/B/C required affected checks pass, unrelated full battery worker-crashes | Objective evidence/acceptances remain durable; certification stays BLOCKED/harness; safe admitted work can continue within limits; no milestone PASS. |
| Same scenario but crash is in a required affected check | Objective cannot be accepted. Passing assertions/focused subsets cannot hide missing coverage or unhandled errors. |
| Seed a changed-property assertion, invariant or normal-play regression | Reject ordinary promotion, record defect, prioritize corrective/revert work and invalidate implicated proofs. |
| Mixed worker and assertion failures; unexplained timeout | Product signal wins, otherwise UNKNOWN. No automatic harness waiver. |
| Local CSS, local rules, ball consequences and Gauntlet-only changes | Exact deterministic plans, required reviewers and coverage. No unrelated suite by default for mapped bounded changes; missing/unknown dependencies escalate. |
| Rename/delete test; dynamic/data dependency; browser composition; parent-only import | Missing coverage caught, complete inventories bound; fallback to broad/full when closure cannot be demonstrated. |
| Shared core, replay/persistence, oracle/architecture or runner config change | Full verification before acceptance; caller-supplied objective scope cannot bypass it. |
| Two independently green objectives interact after merge/rebase | Union integration checks bind the serialized current parent; injected interaction regression rejects acceptance. |
| Same command/input/config/runtime proof across session restart | Reuse only durable eligible evidence; log exact reused origin and avoid another invocation. |
| Source/seed/oracle/lock/config/env/browser/runtime/OS/inventory drift | Relevant proof invalidates. Corrupt/missing/expired/untrusted evidence, changed logs or partial results cannot PASS. |
| Whole required-check repair PASS vs only failing-file repair PASS | The former may satisfy exact unchanged coverage; the latter remains diagnostic until missing required coverage executes. |
| Certification checkpoint followed by new accepted changes | Certificate stays bound to its old target; current revision is PENDING; complete new revision requires valid full coverage. |
| Four uncertified acceptances; certification blocked; attempt a fifth/new Horizon | Refuse canonical ordinary progress; admit only justified isolated work or the corrective/certification path. |
| Exhausted two-attempt/90-minute incident | No silent reset, renamed objective or equivalent full experiments; scoped blocker preserves other valid proof and resumption history. |
| Missing initial certificate; bootstrap product/unknown/harness failure | Explicit UNAVAILABLE baseline; admit only the designed bounded harness case, never invent past PASS. |
| State/durability failure or parallel issue not READY | Preserve newer bookkeeping, block canonical acceptance/publication/fan-out and use existing repair path. |
| Milestone/release request without current full certificate or required playtest | No certification or promotion; missing/deferred/perceptual outcomes retain current non-PASS meanings. |
| Historical manifests, accepted state and frozen 0.10 baseline | Byte-identical historical artifacts; old schema semantics preserved and new-schema downgrade refused. |

Run deterministic Gauntlet scenarios, prompt/contract checks and state audit; product/runtime/recovery tests; candidate-scope/durability/evidence/parallel/telemetry/adapter tests; architecture tests; typecheck/build; then the affected evaluator Node suites and required browser tests. Full implementation certification runs the complete Node/browser suites, fast/locomotion/ball/touch/duels/goalkeeper/rules/fouls coverage, team-status tests, sim smoke, milestone evaluator and evidence hygiene on a named integrated target. Chromium is needed for browser evidence/implementation certification when required, not merely because this design file changed.

Use existing protected mutants/canaries, including determinism/replay/rules/keeper boundaries, to prove the selector does not miss defects. Do not edit their oracles to make selective execution look successful. Static document/prompt checks alone cannot establish selection safety or speed.

## 14. Measurement plan

Keep the 0.10 baseline sealed. Add a separate pre-redesign 0.11.3 experiment baseline and prospective observations. Use existing trajectory/events/acceptance manifests and check proofs as sources, not another analytics framework. Every value carries MEASURED, RECONSTRUCTED_EXACT, RECONSTRUCTED_ESTIMATE or UNAVAILABLE, immutable provenance and coverage notes. Missing data is null, never zero. There is no post-change execution in this design PR and no claim of speed improvement.

| Metric | Definition and provenance |
| --- | --- |
| Wall time per accepted objective | Selection/start to remote durability; include rejected attempts and waits. Report distributions and separate pending/right-censored objectives so blocking cannot disappear from the average. |
| Processed input tokens per accepted objective | All attributed orchestrator/builder/reviewer/repair work through remote acceptance; exact normalized profile and model/harness recorded. Missing or incompatible usage stays unavailable. |
| Verification minutes per accepted objective | Sum actual command durations plus explicit attribution of shared integration/certification cost. Report elapsed critical path separately from summed parallel execution. |
| Full-suite executions per milestone | Count launched complete-scope attempts, completed attempts and aborted attempts separately; include failures and bootstrap runs. Shards count as one coverage attempt with their individual execution costs. |
| Duplicated unchanged checks | Same validated input/command key executed again with no changed prerequisite; record mandated fresh/non-cacheable runs separately. |
| Harness-blocked time | Intervals where a required objective/certification obligation is blocked for supported harness/environment reasons. Split objective versus certificate and waiting versus active diagnosis; unresolved cause remains UNKNOWN. |
| Product-failure detection latency | Time/accepted-objective count from defect-introducing revision to first reliable detection; retrospective estimate only when culprit is reconstructed. Report worst observed latency as well as median. |
| Escaped regressions | Defects found after objective acceptance, and separately after certification/release, with culprit/criterion and repair links. Unknown discovery coverage is not a zero-defect claim. |
| Human interventions | Recorded decisions/actions needed to unblock proof, environment, publication or policy; distinguish genuinely required approval from avoidable prompt interruption. |
| Milestone certification time | Boundary request to remotely durable full certificate **and** required milestone playtest PASS; include retries/waits and unresolved/censored boundaries. |

Continue primary product measures: time-to-playable, player-visible changes per active hour, process-only work, tokens per player-visible change, playtest issues and gameplay regressions. Objective throughput alone can reward artificial decomposition; count actual normal-play improvements independently. Keep existing quality-suite outcomes and critic/integration catches in the comparison.

Pilot method: freeze before-state; shadow-select representative CSS, local gameplay, replay/core, test-launcher and harness diffs; use a supported controlled host/profile for matched comparisons; then observe at least three consecutive normal product Horizons and their real certification boundaries. This is a pilot signal, not enough to prove long-term escaped-regression rates. Stratify by impact, suite inventory and host/runner profile; repository growth and noisy backups must not be attributed to the redesign. Include certification costs after acceptance rather than shifting them outside the measurement window. Preserve all failed runs and workload/token coverage qualifications.

Go/no-go requires selector/mutant correctness, complete milestone coverage, no reduced oracle or concealed product regression, and no deterioration in observed quality/detection latency beyond the explicit bounded interval. Evaluate velocity improvement only with measured post-change data. If certification debt accumulates or defects escape the affected selection, tighten the mapping/escalation or return to broad scheduling; do not widen debt/retry budgets to improve headline throughput.

## 15. Smallest coherent implementation sequence

These are technical dependencies inside one reviewed redesign, not new process objective classes. Each step must be reviewable; do not activate acceptance halfway through or create an intermediate measurement PR unless separately requested.

1. **Evidence and scope contract.** Freeze 0.11.3 measurements; introduce versioned objective/certification proof shapes and neutral validators in shadow mode. Add failure-signal and coverage fixtures. Legacy acceptance continues unchanged.
2. **Deterministic selection and check proofs.** Extend the repository impact/dependency inventory; add complete-input fingerprints and durable producer proofs. Test invalidation/mutants. Keep broad execution authoritative until selection completeness is proven.
3. **Resume valid coverage.** Persist per-check proof at completion and run only missing/invalid obligations; retain fail-fast, existing limits and focused diagnosis. Reject stale/partial evidence and poison commands; remove redundant full-plan reruns without enabling unsafe acceptance.
4. **Move the acceptance boundary atomically.** Switch quality planning, `verifyCandidateQuality`, persistence, manifests, state/remote durability and trajectory validation together to objective-scope proof; enforce high-risk full barriers, interaction checks and the finite interval. Add the certification stream/target linkage and mandatory milestone/release certificate validation. Activate only when the entire transition is internally consistent.
5. **Shared adapters and experiment.** Update canonical contracts plus OMP/Grok/OpenCode entry points and prompt gates together; retain all model/scheduling capabilities. Forward-test blocked/safe/unsafe cases, run existing and new evals, perform real normal-play comparisons, then update VERSION/RELEASE after implementation validation. Compare observed trajectories rather than claiming the design is already faster.

Production changes stay confined to Gauntlet/harness/verification responsibilities. Fixing actual application behavior, application capture tests, global Vitest config or dependency versions is separate work with its own impact-required assurance; this document neither implements nor pre-accepts those fixes.

## 16. Explicit answer

**With this design, if the feature is proven correct by its required affected checks but a 30-minute unrelated/full certification battery crashes because of the execution environment, can Gauntlet continue useful product work safely?**

**Yes, conditionally.** The objective can be durably accepted when its full required objective scope, reviews, evidence, candidate provenance, state audit and remote durability pass. The unrelated battery remains non-PASS and certification remains BLOCKED. Already-admitted independent or objective-dependent product work may continue within the current Horizon and the finite integration interval because it does not require a certified milestone and is rechecked against the actual integrated parent. No claim is made that the whole repository or milestone passed.

**No ordinary canonical advancement** is allowed if the crashing check is required for the objective, the cause is unknown or indicates a product defect, impact requires immediate full certification, a certified prerequisite is missing, or the bounded uncertified interval has been reached. Then preserve accepted evidence and continue only isolated useful work or the corrective/certification path. The design removes universal coupling without turning infrastructure failure into PASS or permitting unlimited unverified product accumulation.
