# PLAYABLE_1V1 Profile Evaluation — Result

**Objective**: PLAYABLE-1V1-PROFILE-EVALUATION
**Builder**: builder-structured (qwen3.6)
**Evidence Class**: HEADLESS
**Scenario**: `eval/scenarios/foundation-move-and-roll.v1.json`
**Registry**: `fnv1a64-v1:d1a691b2c1211c76`
**Profile Version**: `milestone-1v1-v1`
**Timestamp**: 2026-08-20

## Verdict: INVALID_RUN

The PLAYABLE_1V1 milestone is **not achieved**. The overall verdict is `INVALID_RUN` because required browser cases have no evidence (INVALID_RUN takes highest precedence).

## Sub-Component Results

| Component | Outcome |
|-----------|---------|
| HARD_INVARIANT_SUITES | PASS |
| ENGINE_DESIGN_TARGET | PASS |
| BROWSER_CASE:BROWSER-CORE-RESET-001 | INVALID_RUN |
| BROWSER_CASE:BROWSER-CORE-STEP-001 | INVALID_RUN |
| BROWSER_CASE:BROWSER-1V1-CONTROL-001 | INVALID_RUN |
| BROWSER_CASE:ARCH-DIFF-001 | NEEDS_PERCEPTUAL_REVIEW |
| ENTRY_PREREQ:FOUNDATION_LAB_PASS | NOT_EVALUATED |
| ENTRY_PREREQ:CAPABILITY_DESIGN_PROFILE | NOT_EVALUATED |
| EXIT_PREREQ:MUTANT_1V1_PASS | PASS |
| EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS | NOT_EVALUATED |

## Prerequisite Analysis

### Entry Prerequisites (both NOT_EVALUATED — unverified)

- **FOUNDATION_LAB_PASS**: NOT_EVALUATED — entry prerequisite is unverified; must be confirmed by the calling layer (Gauntlet orchestrator).
- **CAPABILITY_DESIGN_PROFILE**: NOT_EVALUATED — same; unverified by caller.

### Exit Prerequisites (one PASS, one NOT_EVALUATED)

- **MUTANT_1V1_PASS**: **PASS** — all 9 implementable mutants detected in 1v1 context; 3 deferred mutants catalogued. This exit prerequisite is satisfied.
- **ARCHETYPE_BLINDED_COMPARISON_PASS**: **NOT_EVALUATED** — no real artifact hashes available. The perceptual rubric evaluation is deferred until browser capture produces frames. This exit prerequisite is **not satisfied**.

## Browser Case Results

| Case | Verdict |
|------|---------|
| BROWSER-CORE-RESET-001 | INVALID_RUN — no browser evidence |
| BROWSER-CORE-STEP-001 | INVALID_RUN — no browser evidence |
| BROWSER-1V1-CONTROL-001 | INVALID_RUN — no browser evidence |
| ARCH-DIFF-001 | NEEDS_PERCEPTUAL_REVIEW — perceptual rubric required |

## Capability Design Evaluation

All 4 IMPLEMENTED axes passed:

| Axis | Status | Outcome |
|------|--------|---------|
| transient-acceleration | IMPLEMENTED | PASS |
| physical-contact | IMPLEMENTED | PASS |
| body-control | IMPLEMENTED | PASS |
| shooting-power | IMPLEMENTED | PASS |
| swerve | IMPLEMENTED | PASS |

## Blockers

The following blockers prevent PLAYABLE_1V1_PASS:

1. **Browser evidence missing**: All three BROWSER-CORE/BROWSER-1V1 cases are INVALID_RUN because no browser evaluation evidence was provided to the evaluator.
2. **ARCH-DIFF-001 needs perceptual review**: This PERCEPTUAL_TARGET case requires a versioned rubric and browser artifacts.
3. **ARCHETYPE_BLINDED_COMPARISON_PASS is NOT_EVALUATED**: No disk artifacts exist for the perceptual hash comparison.
4. **Entry prerequisites unverified**: FOUNDATION_LAB_PASS and CAPABILITY_DESIGN_PROFILE are unverified by the calling layer.

## What's Working

- **HARD_INVARIANT suites**: All evaluated suites (fast, locomotion, ball) produce PASS outcomes for all HARD_INVARIANT criteria that have registered oracles.
- **ENGINE_DESIGN_TARGET**: All implemented capability axes pass the low-vs-high profile comparison.
- **MUTANT_1V1_PASS**: All 9 implementable mutants are correctly detected by oracles in the 1v1 context.
- **Determinism**: Two identical runs produce identical verdicts.

## Gaps to Address

1. **Browser evidence**: Run browser evaluation cases (BROWSER-CORE-RESET-001, BROWSER-CORE-STEP-001, BROWSER-1V1-CONTROL-001) and feed results to the evaluator.
2. **ARCH-DIFF-001 perceptual rubric**: Develop the versioned rubric for the ARCH-DIFF-001 perceptual target case.
3. **Archetype artifacts**: Capture browser-rendered frames for archetype pairs to enable ARCHETYPE_BLINDED_COMPARISON_PASS evaluation.
4. **Entry prerequisite verification**: The Gauntlet orchestrator must verify FOUNDATION_LAB_PASS before promoting to PLAYABLE_1V1.

## Evidence

- Full structured evaluation: `docs/evidence/playable-1v1-profile-evaluation/eval.json`
- Run log: `docs/evidence/playable-1v1-profile-evaluation/run.log`