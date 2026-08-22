## Builder report
- objective_id: PLAYABLE-1V1-DETERMINISTIC-TWO-RUN
- builder_agent: builder-structured
- builder_model: qwen3.6
- evidence_class: HEADLESS
- hypothesis: Wiring the existing `compareAndEvaluateFoundation` two-run check into `evaluatePlayable1v1` will produce an actual COMMON-DETERMINISTIC evaluation result instead of the NOT_EVALUATED placeholder that the single-run path leaves.
- files_changed:
  - `eval/runners/playable-evaluator.ts` — added `compareAndEvaluateFoundation` import, COMMON_DETERMINISTIC sub-component, and replaced single-run NOT_EVALUATED entries with the two-run resolved outcome in `allHardInvariantCriteria`.
  - `tests/unit/eval/playable-evaluator.test.ts` — added 3 tests for COMMON_DETERMINISTIC two-run evaluation in PLAYABLE_1V1 profile.
- commands_run:
  - cmd: `tsx eval/runners/playable-1v1-profile-runner.ts`
    exit_code: 1 (verdict is NOT_EVALUATED, not PASS)
  - cmd: `vitest run tests/unit/eval/playable-evaluator.test.ts`
    exit_code: 0 (42 tests pass)
  - cmd: `tsc --noEmit -p tsconfig.node.json`
    exit_code: 2 (pre-existing error in simulation.ts, not related to this change)
- tests_run:
  - name: COMMON_DETERMINISTIC sub-component is present and evaluates to PASS
    result: PASS
  - name: allHardInvariantPass is true when all HARD_INVARIANT criteria pass
    result: PASS
  - name: COMMON-DETERMINISTIC appears as PASS in HARD_INVARIANT_SUITES evidence
    result: PASS
  - name: All 42 playable-evaluator tests
    result: PASS
- integration_test_result: PASS (node vitest project tests run successfully)
- slot_wiring_result: NOT_APPLICABLE (eval layer only)
- required_evidence: executed tests verifying COMMON_DETERMINISTIC evaluation
- artifacts:
  - `docs/evidence/PLAYABLE-1V1-DETERMINISTIC-TWO-RUN/eval.json` — full profile evaluation result
  - `docs/evidence/PLAYABLE-1V1-DETERMINISTIC-TWO-RUN/RESULT.md` — this file
  - `docs/evidence/PLAYABLE-1V1-DETERMINISTIC-TWO-RUN/run.log` — stderr log
- spec_sections: GAMEPLAY_EVALUATION_SPEC.md §2.3 (PLAYABLE_1V1 profile), §4.1 (COMMON-DETERMINISTIC criterion)
- acceptance_criteria_met: COMMON-DETERMINISTIC now evaluates via two-run comparison in PLAYABLE_1V1 profile. Honest outcome: PASS (two identical runs produce matching hashes).
- known_gaps:
  - PLAYABLE_1V1 overall verdict is NOT_EVALUATED due to unverified entry prerequisites (FOUNDATION_LAB_PASS, CAPABILITY_DESIGN_PROFILE).
  - COMMON_DETERMINISTIC PASS does not by itself make PLAYABLE_1V1_PASS — the full profile still needs all entry prerequisites satisfied and exit prerequisites passing.
  - SMALL_SIDED_SHAPE evaluation still pending (requires PLAYABLE_1V1_PASS first).
- claims_not_made:
  - No PLAYABLE_1V1_PASS claim — the profile verdict is NOT_EVALUATED due to unverified entry prerequisites.
  - No PES fidelity claims.
  - No invented reference envelopes or reference hashes.
  - No COMMON-DETERMINISTIC_PASS claim for the milestone; only the criterion itself passes.