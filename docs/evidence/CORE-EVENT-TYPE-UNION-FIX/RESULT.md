## Builder report

- objective_id: CORE-EVENT-TYPE-UNION-FIX
- builder_agent: builder-structured
- builder_model: deepseek-v4-flash
- evidence_class: HEADLESS
- hypothesis: The repo carried 12 masked type errors at HEAD: (a) the `SimulationEvent.kind` union in `src/contracts/scenario.ts` omitted `"slot-switch"` and `"slot-wiring-violation"`, which the typed emit sites in `src/simulation/loop/simulation.ts` produce (2 TS2322 at baseline); (b) 10 pre-existing type-drift errors in `eval/runners/*` that were masked behind the core-project failure in the `pnpm run typecheck` &&-chain. Expanding the objective to cover both families, with minimal type-level repairs that preserve exact runtime behavior, makes `pnpm run typecheck` exit 0 across all three projects (core/node/browser).
- files_changed:
  - `src/contracts/scenario.ts` — union fix (kept as delivered in v1 of this objective): added `"slot-switch"` and `"slot-wiring-violation"` to `SimulationEvent.kind`. Purely additive; deterministic core byte-equivalent.
  - `eval/runners/capability-design-eval-runner.ts` — type-correction: the profile-override variable parsed from `profileOverride` is a `CapabilityDesignProfile`, not a `CapabilityDesignEvaluationResult` (type-line change aligned to `EvaluateCapabilityDesignOptions.profile`; `JSON.parse` unaffected, runtime identical).
  - `eval/runners/playable-evaluator.ts` — type-correction: removed the stray `| undefined` from the `perCaseHeadless` record value type so it matches `validateBrowserCasesFor1v1`'s parameter (runtime identical; the key is only ever assigned a defined value).
  - `eval/runners/small-sided-match-situation-scanner.ts` — type-correction + latent-name alignment: the destructure read `clusterGap` while the options contract declares `clusterGapTicks`. Renamed the local binding to `clusterGapTicks`. No caller passes a cluster-gap override (verified via repo-wide grep), so runtime output is identical; the diff is a binding rename plus the same constant default.
  - `eval/runners/small-sided-profile-reducer.ts` — import-path correction: `MilestoneProfile` lives in `../contracts/types.js` (re-exported usage in profiles.js is gone); type-only import now from the module that declares it.
  - `eval/runners/small-sided-situation-evaluator.ts` — type-correction: `extractTeamGeometry`'s return annotation was `TrajectoryEntry["team_geometry"]` (a member that never existed on `TrajectoryEntry`); the runtime genuinely emits `team_geometry` on `SituationEvidenceArtifact`, so the annotation was aligned to that current contract.
  - `eval/runners/small-sided-situation-verdict.ts` — type-correction: `eventKinds` annotated as `Set<string>`. `eventKinds.has(k)` was called with `k: string` from requirement arrays; a `Set<string>` is the precise container type (a Set runtime is unchanged).
  - `eval/runners/team-shape-evaluator.ts` — (1) import-path correction: `CriterionClass` / `EvaluationOutcome` / `EvaluationCriterion` all live in `../contracts/types.js`, not `../../src/contracts/types.js`; (2) type-member removal: `TeamShapeTestResult.criteria` entries drop the `evidence` member — the runtime does not emit it (accepted `docs/evidence/TEAM_SHAPE_SUITE_PASS/eval.json` has criteria keys `criterion_id, class, outcome`) and adding it would re-derive accepted evidence; the type now matches runtime and the accepted artifact.
  - `eval/runners/team-shape-eval-runner.ts` — same type-member removal mirrored on the persisted `TeamShapeEvalResult.testResults[].criteria` shape (aligns the declared schema to the byte-verified artifact).
  - `tests/unit/eval/CORE-EVENT-TYPE-UNION-FIX-binding.test.ts` — unchanged binding test (7 tests) from v1: kind-union compile-guard + narrowing + runtime slot-switch and slot-wiring-violation emission verification + determinism.
  - `docs/evidence/CORE-EVENT-TYPE-UNION-FIX/RESULT.md` — this report.
  - Choice disclosure per fix: every fix above is a type-level-only correction or addition aligned to the current contract. No runtime logic, payload, or output changed; no type member was added where the runtime does not emit it (`team-shape` criteria `evidence` was removed from the type because the runtime genuinely does not emit it and accepted evidence proves that).
- commands_run:
  - cmd: `pnpm run typecheck` (baseline, before any change)
    exit_code: 2 — exactly 2 TS2322 at `src/simulation/loop/simulation.ts(1036,13)` and (1062,9) (union family).
  - cmd: `pnpm exec tsc --noEmit -p tsconfig.node.json` (baseline eval/runners state, with only the union fix)
    exit_code: 2 — the 10 pre-existing eval/runners errors listed verbatim in v1 RESULT.md; verified identical at HEAD with all candidate changes stashed.
  - cmd: `pnpm exec tsc --noEmit -p tsconfig.core.json`
    exit_code: 0 (after union fix)
  - cmd: `pnpm exec tsc --noEmit -p tsconfig.browser.json`
    exit_code: 0 (after union fix)
  - cmd: `pnpm exec tsc --noEmit -p tsconfig.node.json`
    exit_code: 0 (after the 10 eval/runners repairs)
  - cmd: `pnpm run typecheck` (final, all three projects in sequence)
    exit_code: 0 — fully green across core/node/browser.
  - cmd: compile-guard discriminating probe (standalone tsc against a guard mirroring the binding test)
    exit_code: 0 with the union fix; exit_code: 2 (TS2322 at both guard literals) with the union fix stashed — discriminating failure proven both directions (recorded in v1).
  - cmd: `pnpm exec vitest run tests/unit/eval/CORE-EVENT-TYPE-UNION-FIX-binding.test.ts tests/unit/loop/control-slot-routing.test.ts tests/unit/input/input-system.test.ts tests/unit/loop/simulation.test.ts --project node`
    exit_code: 0 — 114/114 (7+45+40+22).
  - cmd: `pnpm exec vitest run tests/browser/player-switch.browser.test.ts tests/browser/player-indicator.browser.test.ts --project browser`
    exit_code: 0 — 15/15 (player-switch 8, player-indicator 7).
  - cmd: regression battery rounds (exact commands per round below; all `--project node` except round C)
    exit_code: 0 across all rounds. Total: 941 node tests + 21 browser tests passed; the six known pre-existing failures reproduce identically (see tests_run).
  - cmd: byte-compare live runner outputs against accepted evidence (team-shape + capability-design, output to /tmp, never docs/)
    exit_code: 0 — team-shape eval.json byte-identical (sha256 dd65abcd...); capability-design eval.json output byte-identical before and after the eval/runners repairs (sha256 2860bbb5... both), so the objective's repairs cause zero harness-output change. The accepted `docs/evidence/CAPABILITY_DESIGN_PROFILE/eval.json` (b86a8b13...) differs from current evaluator output — this is pre-existing artifact drift predating this objective, untouched here, disclosed below.
  - cmd: `pnpm vitest run --project node tests/difficulty-capture.node.test.ts tests/integration/match-set-piece.test.ts tests/integration/compare-foundation.test.ts tests/integration/nondeterminism-canary.test.ts`
    exit_code: 1 — the same 6 pre-existing failures reproduce identically with the harness repairs in place (verified pre-existing at HEAD in v1).
- tests_run:
  - name: CORE-EVENT-TYPE-UNION-FIX-binding.test.ts (7 tests)
    result: PASS
  - name: control-slot-routing / input-system / loop-simulation suites (marginal 107 tests)
    result: PASS
  - name: round A1 — scanner suites SMALL-SIDED-MATCH-SITUATION-SCANNER-1..4 (31 tests), SMALL-SIDED-PROFILE-REDUCER-EXTENSION-verification (24 tests), team-shape (19 tests), team-shape-evidence-binding (21 tests), capability-design-evidence-binding (14 tests), capability-design-runner (12 tests)
    result: PASS (9 files, 121 tests)
  - name: round A2 — small-sided-situation-evaluator (27 tests), SMALL-SIDED-SITUATIONS-BATCH-1-binding (11 tests; fresh-run byte-identity gate vs accepted evidence)
    result: PASS (38 tests)
  - name: round A3 — SMALL-SIDED-SITUATIONS-BATCH-1-RERUN (26), BATCH-2-RERUN (26), BATCH-3 (26), BATCH-4 (26), BATCH-5 (19), DUEL-REJECTION-FIXTURE-binding (10), SHOT-RESULT-RESOLUTION-FIXTURE-binding (10)
    result: PASS (143 tests; all fresh-run vs accepted evidence byte gates green)
  - name: round B1 — playable-evaluator (42), playable-1v1-entry-prereq-wiring (12), playable-1v1-profile-evaluation (47), playable-1v1-re-evaluation (29)
    result: PASS (130 tests)
  - name: round B2 — arch-diff-001-frame-binding (10), browser-cases-evidence-validation (9), duels-suite (31), eval-body-control (19), eval-physical-contact (20), eval-shooting-power (25), eval-swerve (17), mutant-1v1 (38), resolve-entry-prereq-outcomes (23), 3v3-situation-driven.node (24)
    result: PASS (216 tests)
  - name: round B3 — SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE-binding (7), SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-1 (10), DEPTH-2 (1)
    result: PASS (18 tests)
  - name: round C (browser) — small-sided-action-event-observability (12), small-sided-integrated-playtest (9)
    result: PASS (21 tests) — CAVEAT below re: these suites writing to docs/screenshots; restored.
  - name: round D — SMALL-SIDED-EXIT-PREREQ-IDENTITY-binding, SMALL-SIDED-COHERENT-EVIDENCE-RERUN-binding, BROWSER-SMALL-SIDED-001-COHERENCE-RERUN-binding
    result: PASS (44 tests)
  - name: re-run of the six known pre-existing failures (difficulty-capture, match-set-piece-003, compare-foundation x2, nondeterminism-canary x2)
    result: unchanged — same 6 failures, same test names/reasons, in files untouched by this objective.
- integration_test_result: PASS (HEADLESS evidence class; no browser integration required. The eval-harness battery across all touched-runners suites is green; browser suites that consume the scanner passed 21/21; the six pre-existing test-all failures remain unchanged pre-existing at HEAD.)
- slot_wiring_result: NOT_APPLICABLE (no ownership/routing implementation touched — only contracts/scenario.ts union + eval/runners type repairs. The CORE binding test still runtime-verifies the slot-wiring-violation emission path via the public setControlledPlayer handle, disclosed here but not a slot-wiring objective audit.)
- required_evidence: HEADLESS — (1) `pnpm run typecheck` exit 0 across core/node/browser (commands with exit codes above); (2) byte-identity gates: situation-evaluator fresh runs vs accepted BATCH evidence (A2/A3 rounds), team-shape live vs accepted eval.json sha256-equal; (3) capability-design live output byte-identical before/after the repairs; (4) binding test compile-guard + runtime emission assertions (unchanged from v1); (5) regression battery green; (6) the six pre-existing failures verified unchanged pre-existing.
- artifacts:
  - `docs/evidence/CORE-EVENT-TYPE-UNION-FIX/RESULT.md` — this report.
- spec_sections: TECHNICAL_SPEC.md §5 (SimulationEvent / StepResult); GAMEPLAY_EVALUATION_SPEC.md §4.1 / §5.6 (common criteria + capability design contracts) — alignment only, no spec text edited.
- acceptance_criteria_met:
  - `pnpm run typecheck` exits 0 across all three projects (core, node, browser).
  - Zero runtime behavior change: type-only repairs; byte-identity re-verified against accepted evidence for team-shape and situation-evaluator outputs; capability-design output shown byte-identical before/after the repairs.
  - The union family (v1) remains green with its binding test intact.
- known_gaps:
  - The accepted `docs/evidence/CAPABILITY_DESIGN_PROFILE/eval.json` (2026-08-22) differs from current evaluator output — pre-existing artifact drift (verified: the drift exists with the repairs reverted; the repairs do not change the output). is not re-derived by this objective and the accepted artifact is untouched. Disclosed for the record; it predates this objective and is not in scope.
  - The two browser capture suites (round C) write screenshots into `docs/screenshots/**` as part of their normal run; re-running them byte-mutated the committed screenshots, which were immediately restored with `git checkout --` (verified restored; working tree clean w.r.t. them). Those suites are capture-bearing and not evidence-immutable-safe; disclosure only, no action taken on the immutable evidence.
  - `tests/unit/eval/team-shape*` and related suites were re-run against the aligned criteria type without `evidence`; accepted evidence binding tests assert only the emitted keys (`criterion_id`, `class`, `outcome`) and remain green, confirming the type change matches the byte-verified artifact.
  - No commit made; all unrelated working-tree changes untouched.
- claims_not_made:
  - No milestone `PASS`, no `FOUNDATION_LAB_PASS`, no PES fidelity, no regression PASS beyond the evidence above.
  - No invented reference envelopes, hashes, or PES constants; no gameplay value or runtime behavior changed.
  - Pre-existing-vs-candidate disclosure (updated for expanded scope): ALL 12 baseline errors are pre-existing at HEAD — the 2 union TS2322 at the emit sites and the 10 eval/runners type-drift errors. Zero candidate-introduced errors. The six test-all runtime failures (difficulty-capture, match-set-piece-003, compare-foundation x2, nondeterminism-canary x2) remain pre-existing and unchanged; they live in files outside the candidate scope.
  - The CAPABILITY_DESIGN_PROFILE eval.json byte-drift from current evaluator output is pre-existing and NOT a consequence of this objective (proven by revert-and-compare); no claim that this objective changed it, and no claim of its legitimacy — merely disclosed.