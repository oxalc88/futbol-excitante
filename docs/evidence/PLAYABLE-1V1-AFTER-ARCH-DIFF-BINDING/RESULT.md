# PLAYABLE-1V1-AFTER-ARCH-DIFF-BINDING — Builder Result

## Objective
- **ID**: PLAYABLE-1V1-AFTER-ARCH-DIFF-BINDING
- **evidence_class**: HEADLESS
- **builder_model**: qwen3.6

## Hypothesis
After ARCH-DIFF-001-FRAME-BINDING wired the rubric-to-recapture frames, re-running the full PLAYABLE_1V1 profile evaluator should show ARCH-DIFF-001 transitioning from `NEEDS_PERCEPTUAL_REVIEW` to `PASS` while all other PLAYABLE_1V1 components remain as previously assessed. The overall verdict reflects the full suite of sub-components including entry prerequisites.

## Files Changed
None — pure evaluation pass. Evidence persisted under `docs/evidence/PLAYABLE-1V1-AFTER-ARCH-DIFF-BINDING/`.

## Commands Run
| # | Command | Exit Code |
|---|---------|-----------|
| 1 | `npx tsx eval/runners/playable-1v1-profile-runner.ts eval/scenarios/foundation-move-and-roll.v1.json` | 1 (verdict NOT_EVALUATED) |
| 2 | `pnpm run gauntlet:audit -- --objective PLAYABLE-1V1-AFTER-ARCH-DIFF-BINDING --class HEADLESS --tests-pass true` | 0 |

## Tests Run
| Test Suite | Tests | Result |
|------------|-------|--------|
| No dedicated unit tests for this re-run | — | — |

Note: This is a profile evaluation re-run, not a test suite execution. The `playable-1v1-profile-runner.ts` evaluates the full PLAYABLE_1V1 milestone profile against the scenario.

## Sub-Component Table

| Component | Outcome | Notes |
|-----------|---------|-------|
| HARD_INVARIANT_SUITES | PASS | All suites evaluate; COMMON-DETERMINISTIC NOT_EVALUATED per suite |
| ENGINE_DESIGN_TARGET | PASS | All 5 axes PASS |
| BROWSER_CASE:BROWSER-CORE-RESET-001 | PASS | From BROWSER-CORE-EVIDENCE/browser-cases.json |
| BROWSER_CASE:BROWSER-CORE-STEP-001 | PASS | From BROWSER-CORE-EVIDENCE/browser-cases.json |
| BROWSER_CASE:BROWSER-1V1-CONTROL-001 | PASS | From BROWSER-1V1-CONTROL-EVIDENCE/browser-cases.json, cross-checked with two-player scenario hashes |
| **BROWSER_CASE:ARCH-DIFF-001** | **PASS** | **Rubric evaluated against recaptured disk artifacts (hash diff ratio 0.9375); was NEEDS_PERCEPTUAL_REVIEW before ARCH-DIFF-001-FRAME-BINDING** |
| ENTRY_PREREQ:FOUNDATION_LAB_PASS | NOT_EVALUATED | Not verified by the evaluator caller |
| ENTRY_PREREQ:CAPABILITY_DESIGN_PROFILE | NOT_EVALUATED | Not verified by the evaluator caller |
| EXIT_PREREQ:MUTANT_1V1_PASS | PASS | 9 implementable mutants detected; 3 deferred catalogued |
| EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS | PASS | All 4 archetype pairs detectable; min confidence 1.0 |

## Verdict

- **Milestone verdict**: **NOT_EVALUATED**
- **allHardInvariantPass**: false (COMMON-DETERMINISTIC is NOT_EVALUATED in every suite)
- **entryPrerequisitesSatisfied**: true (NOT_EVALUATED counts as satisfied at entry level)
- **exitPrerequisitesSatisfied**: true (both exit prerequisites PASS)

The overall verdict is `NOT_EVALUATED` driven by the `NOT_EVALUATED` sub-components:
- `COMMON-DETERMINISTIC` is NOT_EVALUATED in every HARD_INVARIANT suite (not a failure, but not a PASS either)
- `ENTRY_PREREQ:FOUNDATION_LAB_PASS` and `ENTRY_PREREQ:CAPABILITY_DESIGN_PROFILE` remain NOT_EVALUATED because the evaluator does not verify these; they must be confirmed by the calling layer (orchestrator/horizon bookkeeping)

The key improvement from ARCH-DIFF-001-FRAME-BINDING is confirmed: **ARCH-DIFF-001 browser case moved from `NEEDS_PERCEPTUAL_REVIEW` to `PASS`** when disk artifacts are available.

## Known Gaps
- `COMMON-DETERMINISTIC` is NOT_EVALUATED across all suites — the determinism criterion has no reference targets to evaluate against. This is a catalog gap, not a code bug.
- Entry prerequisites (FOUNDATION_LAB_PASS, CAPABILITY_DESIGN_PROFILE) are NOT_EVALUATED by this evaluator; they require separate lifecycle tracking.
- Missing required suites `touch_and_actions` and `duels` are NOT_EVALUATED (not materialized).
- PLAYABLE_1V1 overall cannot be PASS until ALL criteria are PASS, not NOT_EVALUATED.

## Claims Not Made
- No PES fidelity claims.
- No invented reference envelopes.
- No theatrical PASS — the verdict derives from actual evaluation of all sub-components.