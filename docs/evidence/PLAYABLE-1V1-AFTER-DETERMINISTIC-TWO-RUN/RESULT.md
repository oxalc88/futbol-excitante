## Builder report
- objective_id: PLAYABLE-1V1-AFTER-DETERMINISTIC-TWO-RUN
- builder_agent: builder-structured
- builder_model: qwen3.6
- evidence_class: HEADLESS
- hypothesis: Re-running the existing `playable-1v1-profile-runner.ts` after COMMON-DETERMINISTIC two-run wiring (PLAYABLE-1V1-DETERMINISTIC-TWO-RUN accepted) will produce the same honest evaluation result: PLAYABLE_1V1 overall verdict NOT_EVALUATED because entry prerequisites (FOUNDATION_LAB_PASS, CAPABILITY_DESIGN_PROFILE) remain unverified. COMMON-DETERMINISTIC criterion passes via the two-run comparison path.
- files_changed:
  - No source code changes. Reused existing `eval/runners/playable-1v1-profile-runner.ts` and `eval/runners/playable-evaluator.ts` (which already contain COMMON-DETERMINISTIC two-run wiring from the prior accepted objective).
  - Evidence written to `docs/evidence/PLAYABLE-1V1-AFTER-DETERMINISTIC-TWO-RUN/` (new directory, no overwrite of prior evidence).
- commands_run:
  - cmd: `tsx eval/runners/playable-1v1-profile-runner.ts`
    exit_code: 1 (milestoneVerdict NOT_EVALUATED, not PASS — expected)
  - cmd: `pnpm run gauntlet:audit -- --objective PLAYABLE-1V1-AFTER-DETERMINISTIC-TWO-RUN --class HEADLESS --tests-pass true`
    exit_code: 0 (audit status PASS)
- tests_run:
  - name: PLAYABLE_1V1 profile evaluation — HARD_INVARIANT_SUITES all PASS
    result: PASS
  - name: COMMON_DETERMINISTIC two-run comparison
    result: PASS (identical seed, inputs, config → matching per-tick hashes)
  - name: ENGINE_DESIGN_TARGET evaluation
    result: PASS (all 5 axes IMPLEMENTED and PASS)
  - name: Browser case validation (4 cases)
    result: PASS (BROWSER-CORE-RESET-001, BROWSER-CORE-STEP-001, BROWSER-1V1-CONTROL-001, ARCH-DIFF-001)
  - name: EXIT_PREREQ MUTANT_1V1_PASS
    result: PASS (9 implementable mutants detected, 3 deferred catalogued)
  - name: EXIT_PREREQ ARCHETYPE_BLINDED_COMPARISON_PASS
    result: PASS (all 4 archetype pairs perceptually distinguishable, min confidence 1)
  - name: ENTRY_PREREQ verifications
    result: NOT_EVALUATED (FOUNDATION_LAB_PASS and CAPABILITY_DESIGN_PROFILE — unverified by caller layer)
  - name: Overall verdict computation
    result: NOT_EVALUATED (presence of NOT_EVALUATED in sub-components)
  - name: Gauntlet audit
    result: PASS
- integration_test_result: PASS (gauntlet audit passed all 20 checks)
- slot_wiring_result: PASSED via two-player scenario injection. The runner's `twoPlayerScenario` parameter (two-player-duel.v1.json with slot-1 and slot-2 control assignments) was loaded and used for BROWSER-1V1-CONTROL-001 headless hash cross-check. Both players in the two-player scenario (player-a/burst-v1, player-b/steady-v1) have CONTROL injection on separate slots.
- required_evidence: executed profile evaluation, audit.json persisted
- artifacts:
  - `docs/evidence/PLAYABLE-1V1-AFTER-DETERMINISTIC-TWO-RUN/eval.json` — full profile evaluation result
  - `docs/evidence/PLAYABLE-1V1-AFTER-DETERMINISTIC-TWO-RUN/run.log` — stderr log
  - `docs/evidence/PLAYABLE-1V1-AFTER-DETERMINISTIC-TWO-RUN/audit.json` — gauntlet audit result
- spec_sections: GAMEPLAY_EVALUATION_SPEC.md §2.3 (PLAYABLE_1V1 profile), §4.1 (COMMON-DETERMINISTIC criterion), §5 (entry/exit prerequisites)
- acceptance_criteria_met:
  - COMMON-DETERMINISTIC criterion evaluates via two-run comparison → PASS ✓
  - All HARD_INVARIANT suites PASS ✓
  - All browser cases PASS ✓
  - Both exit prerequisites PASS ✓
  - Entry prerequisites NOT_EVALUATED (unverified at caller layer) → prevents overall PASS
- known_gaps:
  - PLAYABLE_1V1 overall verdict is NOT_EVALUATED due to unverified entry prerequisites (FOUNDATION_LAB_PASS, CAPABILITY_DESIGN_PROFILE).
  - COMMON_DETERMINISTIC PASS does not by itself make PLAYABLE_1V1_PASS — the full profile still needs all entry prerequisites satisfied and exit prerequisites passing.
  - SMALL_SIDED_SHAPE evaluation still pending (requires PLAYABLE_1V1_PASS first).
  - No browser-visible evidence (screenshots/trajectory) — this is a HEADLESS-class evaluation only.
- claims_not_made:
  - No PLAYABLE_1V1_PASS claim — the profile verdict is NOT_EVALUATED due to unverified entry prerequisites.
  - No PES fidelity claims.
  - No invented reference envelopes or reference hashes.
  - No COMMON-DETERMINISTIC_PASS claim for the milestone; only the criterion itself passes.