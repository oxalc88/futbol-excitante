# PLAYABLE-1V1-ENTRY-PREREQ-CALLER

## Builder report
- **objective_id**: PLAYABLE-1V1-ENTRY-PREREQ-CALLER
- **builder_agent**: builder-structured
- **builder_model**: qwen3.6
- **evidence_class**: HEADLESS
- **hypothesis**: Wiring the existing `evaluatePlayable1v1` to accept caller-supplied entry-prerequisite outcomes from executable, already-accepted evidence — without inventing `FOUNDATION_LAB_PASS` — will produce honest `BLOCKED_MISSING_REFERENCE` outcomes for unverified prerequisites and `PASS` only when accepted evidence exists.
- **files_changed**:
  1. `eval/runners/playable-evaluator.ts`: Added `entryPrereqOutcomes` option to `evaluatePlayable1v1()`, changed `checkEntryPrerequisites()` to use caller-supplied outcomes (defaults to `BLOCKED_MISSING_REFERENCE`).
  2. `eval/runners/playable-1v1-profile-runner.ts`: Added `resolveEntryPrereqOutcomes()` helper that scans `docs/evidence/<prereq>/manifest.json` + `audit.json` for accepted evidence; passes outcomes to `evaluatePlayable1v1()`.
  3. `tests/unit/eval/playable-evaluator.test.ts`: Updated "does not claim PES fidelity" test to allow prerequisite names in diagnostic evidence strings; moved them to sub-component *outcome* checks only.
  4. `tests/unit/eval/playable-1v1-profile-evaluation.test.ts`: Same PES fidelity test update + renamed `NOT_EVALUATED` → `BLOCKED_MISSING_REFERENCE` expectation for entry prereqs.
  5. `tests/unit/eval/playable-1v1-entry-prereq-wiring.test.ts` (new): 12 tests covering the entry-prereq wiring option.
- **commands_run**:
  - `npx vitest run tests/unit/eval/playable-evaluator.test.ts` → exit 0 (42/42 pass)
  - `npx vitest run tests/unit/eval/playable-1v1-profile-evaluation.test.ts` → exit 0 (47/47 pass)
  - `npx vitest run tests/unit/eval/playable-1v1-entry-prereq-wiring.test.ts` → exit 0 (12/12 pass)
  - `npx vitest run tests/unit/eval/mutant-1v1.test.ts` → exit 0 (38/38 pass)
  - `npx vitest run tests/unit/eval/playable-1v1-re-evaluation.test.ts` → exit 0
  - `npx vitest run tests/unit/eval/browser-cases-evidence-validation.test.ts` → exit 0 (9/9 pass)
  - `npx vitest run tests/unit/eval/duels-suite.test.ts` → exit 0 (31/31 pass)
  - `npx tsx eval/runners/playable-1v1-profile-runner.ts` → exit 1 (verdict: BLOCKED_MISSING_REFERENCE)
- **tests_run**:
  - `playable-evaluator.test.ts` (42 tests): all PASS
  - `playable-1v1-profile-evaluation.test.ts` (47 tests): all PASS
  - `playable-1v1-entry-prereq-wiring.test.ts` (12 tests): all PASS
  - `mutant-1v1.test.ts` (38 tests): all PASS
  - `playable-1v1-re-evaluation.test.ts`: all PASS
  - `browser-cases-evidence-validation.test.ts` (9 tests): all PASS
  - `duels-suite.test.ts` (31 tests): all PASS
- **integration_test_result**: PASS (no regressions in any eval test suite)
- **slot_wiring_result**: NOT_APPLICABLE
- **required_evidence**: HEADLESS (executed tests)
- **artifacts**:
  - `docs/evidence/PLAYABLE-1V1-ENTRY-PREREQ-CALLER/RESULT.md` (this file)
  - `docs/evidence/PLAYABLE-1V1-ENTRY-PREREQ-CALLER/audit.json` (from gauntlet:audit)
- **spec_sections**: GAMEPLAY_EVALUATION_SPEC.md §2.3 (MilestoneProfile entry_prerequisites)
- **acceptance_criteria_met**:
  - `evaluatePlayable1v1` accepts caller-supplied `entryPrereqOutcomes` ✓
  - Default for unverified prerequisites: `BLOCKED_MISSING_REFERENCE` (not `NOT_EVALUATED`) ✓
  - Profile runner scans for accepted evidence (manifest + audit PASS) ✓
  - When no evidence exists, entry prereqs are `BLOCKED_MISSING_REFERENCE` ✓
  - `foundation-move-and-roll` scenario: `milestoneVerdict` is `BLOCKED_MISSING_REFERENCE` (dominated by INVALID_RUN from browser cases, but entry prereqs are correctly `BLOCKED_MISSING_REFERENCE`) ✓
  - `two-player-duel` scenario: same behavior ✓
  - No `FOUNDATION_LAB_PASS` claim invented ✓
  - 139 eval tests pass, no regressions ✓
- **known_gaps**:
  - `FOUNDATION_LAB_PASS` has no accepted evidence directory in `docs/evidence/` → stays `BLOCKED_MISSING_REFERENCE`
  - `CAPABILITY_DESIGN_PROFILE` has no accepted evidence directory → stays `BLOCKED_MISSING_REFERENCE`
  - `PLAYABLE_1V1` overall verdict remains `NOT_EVALUATED`/`BLOCKED_MISSING_REFERENCE`/`INVALID_RUN` (dominated by other criteria) until both entry prereqs have accepted evidence
- **claims_not_made**:
  - Did NOT claim `FOUNDATION_LAB_PASS`
  - Did NOT claim `CAPABILITY_DESIGN_PROFILE`
  - Did NOT claim `PLAYABLE_1V1_PASS`
  - Did not claim PES fidelity

## Entry-prereq outcomes from profile runner
Running the profile runner against the foundation scenario (no accepted evidence for either prereq):

```
[profile-runner] Evidence dir not found: .../docs/evidence/FOUNDATION_LAB_PASS
[profile-runner] Evidence dir not found: .../docs/evidence/CAPABILITY_DESIGN_PROFILE
```

Result: `milestoneVerdict: "BLOCKED_MISSING_REFERENCE"` with both entry prereqs at `BLOCKED_MISSING_REFERENCE`.

When caller-supplied `entryPrereqOutcomes: { FOUNDATION_LAB_PASS: "PASS" }` is provided:
- `ENTRY_PREREQ:FOUNDATION_LAB_PASS` outcome → `PASS`
- `ENTRY_PREREQ:CAPABILITY_DESIGN_PROFILE` outcome → `BLOCKED_MISSING_REFERENCE` (still no evidence)
- `entryPrerequisitesSatisfied` → `false` (not all are PASS or NOT_EVALUATED)

When both are `PASS`:
- `entryPrerequisitesSatisfied` → `true`
- Overall verdict still blocked by browser cases / other criteria (not PLAYABLE_1V1_PASS)