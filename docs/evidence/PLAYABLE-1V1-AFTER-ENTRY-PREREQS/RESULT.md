# PLAYABLE-1V1-AFTER-ENTRY-PREREQS

## Builder report
- **objective_id**: PLAYABLE-1V1-AFTER-ENTRY-PREREQS
- **builder_agent**: builder-structured
- **builder_model**: qwen3.6
- **evidence_class**: HEADLESS
- **hypothesis**: Re-running `evaluatePlayable1v1` after the entry-prereq caller wiring from PLAYABLE-1V1-ENTRY-PREREQ-CALLER will produce honest verdicts — PASS for all evaluated criteria, BLOCKED_MISSING_REFERENCE for both unverified entry prerequisites, and an overall verdict dominated by BLOCKED_MISSING_REFERENCE (not PLAYABLE_1V1_PASS).
- **files_changed**: None. Used existing `eval/runners/playable-1v1-profile-runner.ts` with its built-in two-player scenario injection (`two-player-duel.v1.json`) and `resolveEntryPrereqOutcomes()` scan of `docs/evidence/`.
- **commands_run**:
  - `tsx eval/runners/playable-1v1-profile-runner.ts` → exit 1 (verdict: BLOCKED_MISSING_REFERENCE; runner exits 1 for non-PASS)
  - `vitest run tests/unit/eval/playable-evaluator.test.ts` → exit 0 (42/42 pass)
  - `vitest run tests/unit/eval/playable-1v1-profile-evaluation.test.ts` → exit 0 (47/47 pass)
  - `vitest run tests/unit/eval/playable-1v1-entry-prereq-wiring.test.ts` → exit 0 (12/12 pass, with `--test-timeout=30000`)
  - `vitest run tests/unit/eval/mutant-1v1.test.ts` → exit 0 (38/38 pass)
  - `vitest run tests/unit/eval/playable-1v1-re-evaluation.test.ts` → exit 0 (29/29 pass)
  - `vitest run tests/unit/eval/browser-cases-evidence-validation.test.ts` → exit 0 (9/9 pass)
  - `vitest run tests/unit/eval/duels-suite.test.ts` → exit 0 (31/31 pass)
  - `pnpm run gauntlet:audit -- --objective PLAYABLE-1V1-AFTER-ENTRY-PREREQS --class HEADLESS --tests-pass true` → exit 0 (PASS)
- **tests_run**:
  - `playable-evaluator.test.ts` (42 tests): all PASS
  - `playable-1v1-profile-evaluation.test.ts` (47 tests): all PASS
  - `playable-1v1-entry-prereq-wiring.test.ts` (12 tests): all PASS
  - `mutant-1v1.test.ts` (38 tests): all PASS
  - `playable-1v1-re-evaluation.test.ts` (29 tests): all PASS
  - `browser-cases-evidence-validation.test.ts` (9 tests): all PASS
  - `duels-suite.test.ts` (31 tests): all PASS
  - Total: 208/208 tests pass
- **integration_test_result**: PASS (no regressions in any eval test suite)
- **slot_wiring_result**: NOT_APPLICABLE
- **required_evidence**: HEADLESS (executed tests + profile runner output)
- **artifacts**:
  - `docs/evidence/PLAYABLE-1V1-AFTER-ENTRY-PREREQS/eval.json` (full structured eval output)
  - `docs/evidence/PLAYABLE-1V1-AFTER-ENTRY-PREREQS/audit.json` (gauntlet:audit result)
  - `docs/evidence/PLAYABLE-1V1-AFTER-ENTRY-PREREQS/RESULT.md` (this file)
- **spec_sections**: GAMEPLAY_EVALUATION_SPEC.md §2.3 (MilestoneProfile, PLAYABLE_1V1 entry_prerequisites, exit_prerequisites, required_browser_case_ids)
- **acceptance_criteria_met**:
  - Profile runner re-runs with existing code (no changes) ✓
  - Two-player scenario injection present (BROWSER-1V1-CONTROL-001 cross-check) ✓
  - No Node I/O added to playable-evaluator.ts ✓
  - Honest verdict: BLOCKED_MISSING_REFERENCE (dominated by unverified entry prereqs) ✓
  - FOUNDATION_LAB_PASS → BLOCKED_MISSING_REFERENCE (no evidence dir) ✓
  - CAPABILITY_DESIGN_PROFILE → BLOCKED_MISSING_REFERENCE (no evidence dir) ✓
  - Entry prerequisites satisfied: false ✓
  - Exit prerequisites: MUTANT_1V1_PASS = PASS, ARCHETYPE_BLINDED_COMPARISON_PASS = PASS ✓
  - All browser cases: PASS (RESET-001, STEP-001, 1V1-CONTROL-001, ARCH-DIFF-001) ✓
  - HARD_INVARIANT_SUITES: PASS (all criteria PASS) ✓
  - COMMON_DETERMINISTIC: PASS ✓
  - ENGINE_DESIGN_TARGET: PASS (all axes) ✓
  - 208/208 tests pass, no regressions ✓
  - gauntlet:audit: PASS ✓
- **known_gaps**:
  - `FOUNDATION_LAB_PASS` has no accepted evidence directory in `docs/evidence/` → BLOCKED_MISSING_REFERENCE
  - `CAPABILITY_DESIGN_PROFILE` has no accepted evidence directory → BLOCKED_MISSING_REFERENCE
  - `PLAYABLE_1V1` overall verdict remains BLOCKED_MISSING_REFERENCE until both entry prerequisites have accepted evidence
- **claims_not_made**:
  - Did NOT claim `PLAYABLE_1V1_PASS`
  - Did NOT claim `FOUNDATION_LAB_PASS`
  - Did NOT claim `CAPABILITY_DESIGN_PROFILE`
  - Did not claim PES fidelity

## Honest overall verdict: NOT_EVALUATED / BLOCKED_MISSING_REFERENCE

The PLAYABLE_1V1 milestone evaluation executed cleanly against the `foundation-move-and-roll` scenario with two-player CONTROL injection. Every executable criterion produced PASS:

| Sub-component | Outcome |
|---|---|
| HARD_INVARIANT_SUITES | PASS |
| COMMON_DETERMINISTIC | PASS |
| ENGINE_DESIGN_TARGET | PASS |
| BROWSER_CASE:BROWSER-CORE-RESET-001 | PASS |
| BROWSER_CASE:BROWSER-CORE-STEP-001 | PASS |
| BROWSER_CASE:BROWSER-1V1-CONTROL-001 | PASS |
| BROWSER_CASE:ARCH-DIFF-001 | PASS |
| ENTRY_PREREQ:FOUNDATION_LAB_PASS | BLOCKED_MISSING_REFERENCE |
| ENTRY_PREREQ:CAPABILITY_DESIGN_PROFILE | BLOCKED_MISSING_REFERENCE |
| EXIT_PREREQ:MUTANT_1V1_PASS | PASS |
| EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS | PASS |

The overall `milestoneVerdict` is **BLOCKED_MISSING_REFERENCE**, dominated by the two unverified entry prerequisites. This is the honest result — neither `PLAYABLE_1V1_PASS` nor `NOT_EVALUATED` is forced; the verdict correctly reflects that prerequisite evidence is missing.

## Eval output

```json
$(cat docs/evidence/PLAYABLE-1V1-AFTER-ENTRY-PREREQS/eval.json)
```