# SMALL-SIDED-EXIT-PREREQ-IDENTITY — Builder Report

## Problem

The durable PASS record `SMALL_SIDED_SHAPE/playtests/2026-08-24T23-18-30-040Z.json` (and its RERUN-3 input.json) recorded exit prerequisites as `["MUTANT_1V1_PASS", "ARCHETYPE_BLINDED_COMPARISON"]` — the **1v1 exit identities** — instead of the `SMALL_SIDED_SHAPE_PROFILE`'s declared exit prerequisites `["MUTANT_TEAM_PASS", "TEAM_SHAPE_SUITE_PASS"]`.

The profile is defined in `eval/contracts/profiles.ts` line ~153:
```
exit_prerequisites: ["MUTANT_TEAM_PASS", "TEAM_SHAPE_SUITE_PASS"]
```

The reducer `gauntlet/evals/src/evaluate-state.ts` `evaluateMilestonePlaytest` only checks the boolean `exit_prerequisites_pass: true` and does not validate the names in `exit_prerequisite_accepted`, so this bookkeeping defect passed silently.

## Correction

Replaced `exit_prerequisite_accepted` in the corrected input with the profile's declared values:
- Before: `["MUTANT_1V1_PASS", "ARCHETYPE_BLINDED_COMPARISON"]` (wrong — 1v1 identity)
- After: `["MUTANT_TEAM_PASS", "TEAM_SHAPE_SUITE_PASS"]` (correct — SMALL_SIDED_SHAPE profile identity)

Updated `accumulated_horizon` from `v19` to `v20`.

## Evidence for corrected prereqs

1. **MUTANT_TEAM_PASS** — evidence objective `MUTANT-TEAM-PASS-EVIDENCE`, manifest at `docs/evidence/MUTANT-TEAM-PASS-EVIDENCE/manifest.json`, runner `eval/runners/mutant-team.ts`.
2. **TEAM_SHAPE_SUITE_PASS** — evidence objective `TEAM-SHAPE-SUITE-PASS-EVIDENCE`, manifest at `docs/evidence/TEAM-SHAPE-SUITE-PASS-EVIDENCE/manifest.json`, runner `eval/runners/team-shape-evaluator.ts`.

Both are accepted as evidence objectives, satisfying the SMALL_SIDED_SHAPE exit prerequisites.

## Verdict

**PASS** preserved — this is a bookkeeping/honesty correction only; the milestone verdict does not change.

## Commands run

1. `pnpm run gauntlet:milestone:evaluate -- --milestone SMALL_SIDED_SHAPE --input docs/evidence/SMALL-SIDED-EXIT-PREREQ-IDENTITY/input.json`
2. `pnpm run gauntlet:milestone:bundle -- --milestone SMALL_SIDED_SHAPE --objectives ...`
3. `CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-EXIT-PREREQ-IDENTITY-binding.test.ts`
4. Regression suite: `CI=1 pnpm vitest run --project node tests/unit/gauntlet-0.9-contracts.test.ts tests/unit/eval/small-sided-situation-evaluator.test.ts tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-5-binding.test.ts`
5. `pnpm run gauntlet:audit -- --objective SMALL-SIDED-EXIT-PREREQ-IDENTITY --class HEADLESS --tests-pass true`