# PLAYABLE_1V1 Profile Evaluation — Rerun (evaluator fix, Node I/O moved)

**Objective**: PLAYABLE-1V1-PROFILE-RERUN
**Builder**: builder-structured (qwen3.6)
**Evidence Class**: HEADLESS
**Scenario**: `eval/scenarios/foundation-move-and-roll.v1.json`
**Registry**: `fnv1a64-v1:d1a691b2c1211c76`
**Profile Version**: `milestone-1v1-v1`
**Timestamp**: 2026-08-22T09:17Z

## Verdict: FAIL

The PLAYABLE_1V1 milestone is **not achieved**. The overall verdict is `FAIL` (improved from the previous `INVALID_RUN` verdicts in PLAYABLE-1V1-PROFILE-EVALUATION and PLAYABLE-1V1-RE-EVALUATION) because `BROWSER-1V1-CONTROL-001` now has valid evidence that passes headless cross-check against the **two-player** scenario reference.

## Root Cause of Prior INVALID_RUN

The profile evaluator's `validateBrowserCasesFor1v1()` always generated headless reference hashes from the **profile scenario** (`foundation-move-and-roll.v1.json`, 1-player). But `BROWSER-1V1-CONTROL-001` evidence was captured from the **two-player scenario** (`two-player-duel.v1.json`, 2-player). The headless initialHash from the 1-player scenario (`fnv1a64-v1:34e2d4d971acfac7`) never matched the accepted 2-player evidence initialHash (`fnv1a64-v1:a9a45c4fcaf96798`), producing INVALID_RUN regardless of evidence content.

## Fix Applied

1. **`eval/runners/playable-evaluator.ts`**: Added `twoPlayerScenario` option to `evaluatePlayable1v1()`. When provided, the evaluator generates per-case headless hashes from the two-player scenario for `BROWSER-1V1-CONTROL-001` cross-check. No Node I/O — the scenario is passed in by the caller.
2. **`eval/runners/playable-1v1-profile-runner.ts`**: Reads `two-player-duel.v1.json` from disk (Node I/O allowed in the eval layer) and passes it to `evaluatePlayable1v1()`.

This ensures the evaluator respects its "no Node I/O" contract while still supporting the two-player scenario cross-check.

## Sub-Component Results

| Component | Outcome |
|-----------|---------|
| HARD_INVARIANT_SUITES | PASS |
| ENGINE_DESIGN_TARGET | PASS |
| BROWSER_CASE:BROWSER-CORE-RESET-001 | PASS |
| BROWSER_CASE:BROWSER-CORE-STEP-001 | PASS |
| BROWSER_CASE:BROWSER-1V1-CONTROL-001 | PASS |
| BROWSER_CASE:ARCH-DIFF-001 | NEEDS_PERCEPTUAL_REVIEW |
| ENTRY_PREREQ:FOUNDATION_LAB_PASS | NOT_EVALUATED |
| ENTRY_PREREQ:CAPABILITY_DESIGN_PROFILE | NOT_EVALUATED |
| EXIT_PREREQ:MUTANT_1V1_PASS | PASS |
| EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS | FAIL |

## Comparison with Previous Runs

| Component | PROFILE-EVAL | RE-EVALUATION | PROFILE-RERUN (this run) |
|-----------|-------------|--------------|--------------------------|
| BROWSER-1V1-CONTROL-001 | INVALID_RUN | INVALID_RUN | PASS |
| ARCHETYPE_BLINDED_COMPARISON_PASS | FAIL | FAIL | FAIL |
| Overall Verdict | INVALID_RUN | INVALID_RUN | FAIL |

## Evidence Integrity

- `docs/evidence/BROWSER-1V1-CONTROL-EVIDENCE/browser-cases.json` — **untouched** (git diff empty). Accepted evidence preserved.
- No fabricated evidence written under `PLAYABLE-1V1-PROFILE-RERUN/`.
- The evaluator loads the two-player scenario via option injection from the runner.

## Files Changed

- `eval/runners/playable-evaluator.ts` (+27 lines): Added `twoPlayerScenario` option to `evaluatePlayable1v1()`, per-case headless reference map support in `validateBrowserCasesFor1v1()`
- `eval/runners/playable-1v1-profile-runner.ts` (+20 lines): Reads two-player scenario from disk, passes it to evaluator
- `docs/evidence/PLAYABLE-1V1-PROFILE-RERUN/eval.json` (new)
- `docs/evidence/PLAYABLE-1V1-PROFILE-RERUN/run.log` (new)
- `docs/evidence/PLAYABLE-1V1-PROFILE-RERUN/audit.json` (new)
- `docs/evidence/PLAYABLE-1V1-PROFILE-RERUN/RESULT.md` (new)

## Blockers

1. **ARCHETYPE_BLINDED_COMPARISON_PASS FAIL**: All archetype pairs produce indistinguishable output (diff=0.0000). The renderer ignores archetypeId.
2. **ARCH-DIFF-001 NEEDS_PERCEPTUAL_REVIEW**: PERCEPTUAL_TARGET case requiring a versioned rubric and human subject data.
3. **Not all HARD_INVARIANT criteria passed**: COMMON-DETERMINISTIC = NOT_EVALUATED across all suites.
4. **Entry prerequisites unverified**: FOUNDATION_LAB_PASS and CAPABILITY_DESIGN_PROFILE are unverified by the calling layer.

## Evidence

- Full structured evaluation: `docs/evidence/PLAYABLE-1V1-PROFILE-RERUN/eval.json`
- Run log: `docs/evidence/PLAYABLE-1V1-PROFILE-RERUN/run.log`
- Deterministic audit: `docs/evidence/PLAYABLE-1V1-PROFILE-RERUN/audit.json`