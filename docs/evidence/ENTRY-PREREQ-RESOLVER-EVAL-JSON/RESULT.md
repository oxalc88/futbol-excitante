# ENTRY-PREREQ-RESOLVER-EVAL-JSON — Builder Report

- **objective_id**: ENTRY-PREREQ-RESOLVER-EVAL-JSON
- **builder_agent**: builder-structured
- **builder_model**: qwen3.6
- **evidence_class**: HEADLESS
- **hypothesis**: `resolveEntryPrereqOutcomes` in `eval/runners/playable-1v1-profile-runner.ts` treated `docs/evidence/<prereq>/manifest.json` (`accepted === true`) plus `audit.json` (`verdict === "PASS"`) as PLAYABLE_1V1 entry-prerequisite PASS, conflating Gauntlet objective audit PASS with FOUNDATION_LAB_PASS / CAPABILITY_DESIGN_PROFILE milestone PASS. The fix replaces the manifest+audit resolver with an eval.json resolver that reads `milestoneVerdict` (preferred) or `overall` from `docs/evidence/<prereq>/eval.json`, passing only valid executable verdicts through. Gauntlet audit/manifest artifacts must never produce a milestone PASS.

## files_changed

1. `eval/runners/playable-1v1-profile-runner.ts` — Rewrote `resolveEntryPrereqOutcomes`:
   - Now reads `docs/evidence/<prereq>/eval.json` (not manifest.json + audit.json).
   - Extracts verdict from `milestoneVerdict` (preferred) or `overall` (fallback).
   - Validates verdict against the set: PASS, FAIL, NEEDS_PERCEPTUAL_REVIEW, NOT_EVALUATED, INVALID_RUN, BLOCKED_MISSING_REFERENCE.
   - Unknown/unusable verdicts → omit key (caller defaults to BLOCKED_MISSING_REFERENCE).
   - Exported the function with an optional `evidenceBase` parameter for testability.
2. `tests/unit/eval/resolve-entry-prereq-outcomes.test.ts` — New test file (23 tests) covering all required scenarios.

## commands_run

| # | Command | Exit Code |
|---|---------|-----------|
| 1 | `mise run test -- tests/unit/eval/playable-1v1-entry-prereq-wiring.test.ts` | **0** (12 tests passed) |
| 2 | `mise run test -- tests/unit/eval/playable-evaluator.test.ts` | **0** (42 tests passed) |
| 3 | `mise run test -- tests/unit/eval/playable-1v1-profile-evaluation.test.ts` | **0** (47 tests passed) |
| 4 | `mise run test -- tests/unit/eval/resolve-entry-prereq-outcomes.test.ts` | **0** (23 tests passed) |
| 5 | `mise run test -- tests/unit/eval/playable-1v1-re-evaluation.test.ts` | **0** (29 tests passed) |
| 6 | `mise run test -- tests/unit/eval/` (full suite) | **0** (700 tests passed) |

## tests_run

### Existing tests (unchanged, all pass)

| Test file | Tests | Result |
|-----------|-------|--------|
| `playable-1v1-entry-prereq-wiring.test.ts` | 12 | PASS |
| `playable-evaluator.test.ts` | 42 | PASS |
| `playable-1v1-profile-evaluation.test.ts` | 47 | PASS |
| `playable-1v1-re-evaluation.test.ts` | 29 | PASS |

### New tests (resolve-entry-prereq-outcomes.test.ts) — 23 tests

| Test | Scenario | Result |
|------|----------|--------|
| Missing evidence dir → key omitted | Dir does not exist | PASS |
| eval.json missing in existing dir | Dir exists, no eval.json | PASS |
| eval.json invalid JSON | Unreadable file | PASS |
| eval.json lacks milestoneVerdict and overall | Empty object | PASS |
| PASS via milestoneVerdict | `{ milestoneVerdict: "PASS" }` | PASS |
| PASS via overall (fallback) | `{ overall: "PASS" }` | PASS |
| milestoneVerdict takes precedence over overall | Both present, different values | PASS |
| FAIL passes through | `{ milestoneVerdict: "FAIL" }` | PASS |
| NEEDS_PERCEPTUAL_REVIEW passes through | `{ milestoneVerdict: "NEEDS_PERCEPTUAL_REVIEW" }` | PASS |
| NOT_EVALUATED passes through | `{ milestoneVerdict: "NOT_EVALUATED" }` | PASS |
| INVALID_RUN passes through | `{ milestoneVerdict: "INVALID_RUN" }` | PASS |
| BLOCKED_MISSING_REFERENCE passes through | `{ milestoneVerdict: "BLOCKED_MISSING_REFERENCE" }` | PASS |
| manifest.accepted=true + audit.verdict=PASS without eval.json → key omitted | Old evidence format only | PASS |
| Gauntlet audit PASS + eval.json PASS for other prereq → mixed result | Both prereqs present | PASS |
| Gauntlet audit PASS + eval.json FAIL → FAIL, not PASS | Both files present, conflicting | PASS |
| Unknown verdict string is omitted | `{ milestoneVerdict: "SUPER_PASS" }` | PASS |
| null milestoneVerdict is omitted | `{ milestoneVerdict: null }` | PASS |
| Numeric milestoneVerdict is omitted | `{ milestoneVerdict: 42 }` | PASS |
| Numeric overall is also omitted | `{ overall: 0 }` | PASS |
| Resolves both prereqs when both have eval.json | Multiple prereqs | PASS |
| Returns partial map when only some have eval.json | Mixed presence | PASS |
| Default evidenceBase defaults to docs/evidence | No explicit argument | PASS |
| Omitted key in resolver map means caller uses BLOCKED_MISSING_REFERENCE | Invariant check | PASS |

## artifacts

- `eval/runners/playable-1v1-profile-runner.ts` — Rewritten `resolveEntryPrereqOutcomes` (exported, injectable `evidenceBase`).
- `tests/unit/eval/resolve-entry-prereq-outcomes.test.ts` — 23 comprehensive unit tests.
- `docs/evidence/ENTRY-PREREQ-RESOLVER-EVAL-JSON/RESULT.md` — This file.

## spec_sections

- `specs/TECHNICAL_SPEC.md` §20 (playable-evaluator architecture boundary).
- `specs/GAMEPLAY_EVALUATION_SPEC.md` (entry/exit prerequisite semantics).

## acceptance_criteria_met

- [x] Resolver reads `docs/evidence/<prereq>/eval.json` only (not manifest.json or audit.json).
- [x] Missing eval.json → key omitted → caller defaults to BLOCKED_MISSING_REFERENCE.
- [x] `milestoneVerdict` (preferred) / `overall` (fallback) used for verdict extraction.
- [x] All six valid verdicts pass through: PASS, FAIL, NEEDS_PERCEPTUAL_REVIEW, NOT_EVALUATED, INVALID_RUN, BLOCKED_MISSING_REFERENCE.
- [x] Unknown/unusable verdict → omitted → BLOCKED_MISSING_REFERENCE.
- [x] Gauntlet audit PASS + accepted manifest without eval.json does NOT yield PASS.
- [x] Function is exported and accepts optional `evidenceBase` for testability.
- [x] All 23 new tests pass.
- [x] All 700 existing eval tests pass (12 + 42 + 47 + 29 + 570 from other files).
- [x] No modifications to `src/simulation/**`, `src/contracts/**`, gauntlet state, specs, or legacy evidence artifacts.

## known_gaps

- No `docs/evidence/FOUNDATION_LAB_PASS/eval.json` or `docs/evidence/CAPABILITY_DESIGN_PROFILE/eval.json` exist yet (next objectives will create these). The current default path (no arg) correctly returns an empty map because those directories do not exist.
- The `main()` function's call site (`resolveEntryPrereqOutcomes(entryPrereqNames)`) continues to use the default `docs/evidence` base, which is correct for production use.

## claims_not_made

- Did NOT claim FOUNDATION_LAB_PASS is PASS.
- Did NOT claim CAPABILITY_DESIGN_PROFILE is PASS.
- Did NOT claim PLAYABLE_1V1_PASS.
- Did NOT claim PES fidelity.
- Did NOT create any evidence directories or files in `docs/evidence/` other than this RESULT.md.
- Did NOT write manifest.json.
- Did NOT edit `gauntlet/state/`, specs, research, role contracts, routing, AGENTS.md, mise.toml (those pre-existing uncommitted changes are unrelated to this objective).