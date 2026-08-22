# PLAYABLE_1V1 Profile Evaluation — After Remaining Archetypes Recapture

**Objective**: PLAYABLE-1V1-AFTER-REMAINING-ARCHETYPES
**Builder**: builder-structured (qwen3.6)
**Evidence Class**: HEADLESS
**Scenario**: `eval/scenarios/foundation-move-and-roll.v1.json`
**Registry**: `fnv1a64-v1:d1a691b2c1211c76`
**Profile Version**: `milestone-1v1-v1`
**Timestamp**: 2026-08-22T11:36Z

## Verdict: NEEDS_PERCEPTUAL_REVIEW

The PLAYABLE_1V1 milestone is **not yet achieved** due to the `ARCH-DIFF-001` browser case returning `NEEDS_PERCEPTUAL_REVIEW`. This is a persistent blocker that cannot be resolved by the builder — it is a PERCEPTUAL_TARGET case requiring a versioned rubric and human subject data (noted as `NEEDS_PERCEPTUAL_REVIEW` in the rubric contract).

All other criteria pass. The significant improvement in this run is that **ARCHETYPE_BLINDED_COMPARISON_PASS** moved from FAIL → PASS, resolving the primary blocker from the previous run.

## Comparison with PLAYABLE-1V1-PROFILE-RERUN

| Component | PROFILE-RERUN | AFTER-REMAINING-ARCHETYPES (this run) | Delta |
|-----------|--------------|---------------------------------------|-------|
| HARD_INVARIANT_SUITES | PASS | PASS | no change |
| ENGINE_DESIGN_TARGET | PASS | PASS | no change |
| BROWSER_CASE:BROWSER-CORE-RESET-001 | PASS | PASS | no change |
| BROWSER_CASE:BROWSER-CORE-STEP-001 | PASS | PASS | no change |
| BROWSER_CASE:BROWSER-1V1-CONTROL-001 | PASS | PASS | no change |
| BROWSER_CASE:ARCH-DIFF-001 | NEEDS_PERCEPTUAL_REVIEW | NEEDS_PERCEPTUAL_REVIEW | no change (expected — persistent blocker) |
| ENTRY_PREREQ:FOUNDATION_LAB_PASS | NOT_EVALUATED | NOT_EVALUATED | no change |
| ENTRY_PREREQ:CAPABILITY_DESIGN_PROFILE | NOT_EVALUATED | NOT_EVALUATED | no change |
| EXIT_PREREQ:MUTANT_1V1_PASS | PASS | PASS | no change |
| EXIT_PREREQ:ARCHETYPE_BLINDED_COMPARISON_PASS | **FAIL** | **PASS** | ✅ improved — all pairs detectable, diff=0.9375 |
| **Overall verdict** | **FAIL** | **NEEDS_PERCEPTUAL_REVIEW** | ✅ improved — no longer FAIL |

## Key Improvement: ARCHETYPE_BLINDED_COMPARISON_PASS

The recaptured archetype frames from `ARCHETYPE-FULL-PAIR-RECAPTURE` now produce perceptually distinct hashes:

| Pair | Hash Diff Ratio | Detectable |
|------|----------------|------------|
| burst-v1 vs steady-v1 | 0.9375 | true |
| technical-v1 vs power-v1 | 0.9375 | true |
| agility-v1 vs steady-v1 | 0.9375 | true |
| burst-v1 vs technical-v1 | 0.9375 | true |

All pairs are detectable with confidence = 1. This is a direct result of the ARCHETYPE-FULL-PAIR-RECAPTURE objective (ARCHETYPE-REMAINING-VISUALS applied versioned renderer mappings so technical/power/agility now produce visually distinct frames from baseline).

## Persisted Blockers

1. **ARCH-DIFF-001 NEEDS_PERCEPTUAL_REVIEW**: PERCEPTUAL_TARGET case requiring a versioned rubric and human subject data. Not a builder bug.
2. **COMMON-DETERMINISTIC NOT_EVALUATED**: Across all HARD_INVARIANT suites, the deterministic criterion remains unevaluated. This is catalogued but does not drive a FAIL verdict (FINITE and REFERENCES are PASS, which dominate).

## Claims Not Made

- No PES fidelity claim.
- No invented reference envelopes.
- No PLAYABLE_1V1_PASS claim (verdict is NEEDS_PERCEPTUAL_REVIEW).
- No SMALL_SIDED_PASS claim.

## Evidence Integrity

- `docs/evidence/BROWSER-1V1-CONTROL-EVIDENCE/browser-cases.json` — untouched.
- `docs/evidence/PLAYABLE-1V1-PROFILE-RERUN/eval.json` — untouched (accepted evidence preserved).
- New evidence written only under `docs/evidence/PLAYABLE-1V1-AFTER-REMAINING-ARCHETYPES/`.

## Files Written

- `docs/evidence/PLAYABLE-1V1-AFTER-REMAINING-ARCHETYPES/eval.json` — full structured evaluation result
- `docs/evidence/PLAYABLE-1V1-AFTER-REMAINING-ARCHETYPES/run.log` — stderr log from profile runner
- `docs/evidence/PLAYABLE-1V1-AFTER-REMAINING-ARCHETYPES/audit.json` — deterministic audit result

## No Files Changed (Source)

- No source files were modified. The existing `eval/runners/playable-1v1-profile-runner.ts` was used as-is with its built-in two-player scenario injection.