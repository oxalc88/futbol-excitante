# TEAM-SHAPE-SUITE-PASS-EVIDENCE

## Objective

`TEAM_SHAPE_SUITE_PASS` evaluation result for the SMALL_SIDED_SHAPE exit
prerequisite.

## Hypothesis

`docs/evidence/TEAM_SHAPE_SUITE_PASS/eval.json` did not exist.
`eval/runners/team-shape-evaluator.ts` already implements the suite reduction
(`TeamShapeResult` with verdict). Persist an honest live evaluation result
with an eval-layer runner.

## What was done

1. Created `eval/runners/team-shape-eval-runner.ts` — a Node runner that calls
   `runTeamShapeEvaluator()`, wraps the result with `overall` and
   `milestoneVerdict` at the top level, and persists to
   `docs/evidence/TEAM_SHAPE_SUITE_PASS/eval.json`.

2. Executed the evaluator against the 3v3 short fixture
   (`eval/scenarios/3v3-fixture-short.v1.json`). All 16 direct tests pass the
   common criteria (FINITE, REFERENCES, BOUNDS).

3. Created `tests/unit/eval/team-shape-evidence-binding.node.test.ts` with 21
   tests covering existence, structure, live re-run consistency, test coverage,
   common criteria presence, and no-forbidden-claims checks.

## Commands and exit codes

- `tsx eval/runners/team-shape-eval-runner.ts` → exit **0**
  - `overall: PASS`, `milestoneVerdict: PASS`
  - Written to `docs/evidence/TEAM_SHAPE_SUITE_PASS/eval.json`

- `vitest run tests/unit/eval/team-shape.test.ts` → exit **0** (19/19 pass)

- `vitest run tests/unit/eval/team-shape-evidence-binding.node.test.ts` → exit **0** (21/21 pass)

- `vitest run tests/unit/eval/team-decision-evidence-binding.node.test.ts` → exit **0** (12/12 pass)

- `vitest run tests/unit/eval/mutant-team-evidence-binding.node.test.ts` → exit **0** (22/22 pass)

## Verdict

**overall: PASS** — all 16 tests in TEAM_SUITE.direct_test_ids pass their
common criteria (FINITE, REFERENCES, BOUNDS).

## Files changed

| File | Action |
|------|--------|
| `eval/runners/team-shape-eval-runner.ts` | Created |
| `docs/evidence/TEAM_SHAPE_SUITE_PASS/eval.json` | Created (live eval output) |
| `tests/unit/eval/team-shape-evidence-binding.node.test.ts` | Created |

## Known gaps

- The eval-runner wrapper does not persist `evidence` on the criterion entries
  within `testResults[].criteria` (only `commonCriteriaCheck[].evidence` is
  present). This is a known limitation of the current wrapper and does not
  affect the verdict.

- Team-specific criteria (beyond common criteria) are not yet bound. Evaluation
  is structural (finite, references, bounds) only.

## Claims not made

- PES fidelity claims.
- Reference envelope inventions.
- `FOUNDATION_LAB_PASS` claims.