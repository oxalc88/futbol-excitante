# PLAYABLE_1V1 Profile Evaluation — Re-Evaluation

**Objective**: PLAYABLE-1V1-RE-EVALUATION
**Builder**: builder-structured (qwen3.6)
**Evidence Class**: HEADLESS
**Scenario**: `eval/scenarios/foundation-move-and-roll.v1.json`
**Registry**: `fnv1a64-v1:d1a691b2c1211c76`
**Profile Version**: `milestone-1v1-v1`
**Timestamp**: 2026-08-22

## Verdict: INVALID_RUN

The PLAYABLE_1V1 milestone is **not achieved**. The overall verdict is `INVALID_RUN` because required browser case `BROWSER-1V1-CONTROL-001` has no evidence (INVALID_RUN takes highest precedence per spec).

## Sub-Component Results

| Component | Outcome |
|-----------|---------|
| HARD_INVARIANT_SUITES | PASS |
| ENGINE_DESIGN_TARGET | PASS |
| BROWSER_CASE:BROWSER-CORE-RESET-001 | PASS |
| BROWSER_CASE:BROWSER-CORE-STEP-001 | PASS |
| BROWSER_CASE:BROWSER-1V1-CONTROL-001 | INVALID_RUN |
| BROWSER_CASE:ARCH-DIFF-001 | NEEDS_PERCEPTUAL_REVIEW |
| ENTRY_PREREQ:FOUNDATION_LAB_PASS | NOT_EVALUATED |
| ENTRY_PREREQ:CAPABILITY_DESIGN_PROFILE | NOT_EVALUATED |
| EXIT_PREREQ:MUTANT_1V1_PASS | PASS |
| EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS | FAIL |

## Prerequisite Analysis

### Entry Prerequisites (both NOT_EVALUATED — unverified)

- **FOUNDATION_LAB_PASS**: NOT_EVALUATED — entry prerequisite is unverified; must be confirmed by the calling layer (Gauntlet orchestrator).
- **CAPABILITY_DESIGN_PROFILE**: NOT_EVALUATED — same; unverified by caller.

### Exit Prerequisites (one PASS, one FAIL)

- **MUTANT_1V1_PASS**: **PASS** — all 9 implementable mutants detected in 1v1 context; 3 deferred mutants catalogued. This exit prerequisite is satisfied.
- **ARCHETYPE_BLINDED_COMPARISON_PASS**: **FAIL** — all 4 archetype pairs have diff=0.0000 and are not perceptually distinguishable. This exit prerequisite is **not satisfied**.

## Browser Case Results

| Case | Verdict |
|------|---------|
| BROWSER-CORE-RESET-001 | PASS — evidence loaded from BROWSER-CORE-EVIDENCE/browser-cases.json, hash matches headless |
| BROWSER-CORE-STEP-001 | PASS — evidence loaded from BROWSER-CORE-EVIDENCE/browser-cases.json, per-tick hashes match headless |
| BROWSER-1V1-CONTROL-001 | INVALID_RUN — no browser evidence available (no case in browser-cases.json) |
| ARCH-DIFF-001 | NEEDS_PERCEPTUAL_REVIEW — PERCEPTUAL_TARGET case requiring versioned rubric and human subject data |

## Capability Design Evaluation

All 5 IMPLEMENTED axes passed:

| Axis | Status | Outcome |
|------|--------|---------|
| transient-acceleration | IMPLEMENTED | PASS |
| physical-contact | IMPLEMENTED | PASS |
| body-control | IMPLEMENTED | PASS |
| shooting-power | IMPLEMENTED | PASS |
| swerve | IMPLEMENTED | PASS |

## Exit Prerequisite: ARCHETYPE_BLINDED_COMPARISON

The ARCHETYPE_BLINDED_COMPARISON evaluation with disk artifacts returned FAIL:

| Pair | Diff Ratio | Detectable |
|------|-----------|------------|
| archetype-burst-v1 vs archetype-steady-v1 | 0.0000 | false |
| archetype-technical-v1 vs archetype-power-v1 | 0.0000 | false |
| archetype-agility-v1 vs archetype-steady-v1 | 0.0000 | false |
| archetype-burst-v1 vs archetype-technical-v1 | 0.0000 | false |

All pairs show zero hash difference, meaning the renderer does not produce perceptually distinguishable output for these archetype variations. This is consistent with the renderer ignoring archetypeId.

## Blockers

The following blockers prevent PLAYABLE_1V1_PASS:

1. **BROWSER-1V1-CONTROL-001 INVALID_RUN**: No browser evidence for the 1v1 control slot-routing case. This is the primary driver of the INVALID_RUN verdict.
2. **ARCH-DIFF-001 NEEDS_PERCEPTUAL_REVIEW**: PERCEPTUAL_TARGET case requiring a versioned rubric and human subject data.
3. **ARCHETYPE_BLINDED_COMPARISON_PASS FAIL**: All archetype pairs produce indistinguishable output (diff=0.0000). The renderer ignores archetypeId.
4. **Entry prerequisites unverified**: FOUNDATION_LAB_PASS and CAPABILITY_DESIGN_PROFILE are unverified by the calling layer.

## What's Working

- **HARD_INVARIANT suites**: All evaluated suites (fast, locomotion, ball) produce PASS outcomes for all HARD_INVARIANT criteria that have registered oracles.
- **ENGINE_DESIGN_TARGET**: All implemented capability axes pass the low-vs-high profile comparison.
- **MUTANT_1V1_PASS**: All 9 implementable mutants are correctly detected by oracles in the 1v1 context.
- **BROWSER-CORE-RESET-001**: PASS — headless hash cross-check passes with BROWSER-CORE-EVIDENCE.
- **BROWSER-CORE-STEP-001**: PASS — per-tick hash cross-check passes with BROWSER-CORE-EVIDENCE.
- **Determinism**: Two identical runs produce identical verdicts.

## Gaps to Address

1. **BROWSER-1V1-CONTROL-001**: Run the 1v1 control browser test (two HUMAN slots with independent inputs) and feed results to the evaluator.
2. **ARCH-DIFF-001 perceptual rubric**: Develop the versioned rubric for the ARCH-DIFF-001 perceptual target case.
3. **ARCHETYPE_BLINDED_COMPARISON**: The renderer must produce perceptually distinguishable output for different archetype variants. Currently all pairs show zero diff.
4. **Entry prerequisite verification**: The Gauntlet orchestrator must verify FOUNDATION_LAB_PASS before promoting to PLAYABLE_1V1.

## Evidence

- Full structured evaluation: `docs/evidence/PLAYABLE-1V1-RE-EVALUATION/eval.json`
- Run log: `docs/evidence/PLAYABLE-1V1-RE-EVALUATION/run.log`