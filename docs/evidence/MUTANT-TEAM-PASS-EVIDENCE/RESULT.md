# MUTANT-TEAM-PASS-EVIDENCE

**Objective**: Persist live evaluation evidence for `MUTANT_TEAM_PASS` — the SMALL_SIDED_SHAPE exit prerequisite.

**Hypothesis**: SMALL_SIDED_SHAPE exit prereq MUTANT_TEAM_PASS has no `docs/evidence/MUTANT_TEAM_PASS/eval.json`. `eval/runners/mutant-team.ts` already exports `runMutantTeam`. Persist an honest live evaluation result.

**Evidence class**: HEADLESS

---

## Builder report

- **objective_id**: MUTANT-TEAM-PASS-EVIDENCE
- **builder_agent**: builder-structured
- **builder_model**: qwen3.6
- **evidence_class**: HEADLESS
- **hypothesis**: SMALL_SIDED_SHAPE exit prereq MUTANT_TEAM_PASS has no `docs/evidence/MUTANT_TEAM_PASS/eval.json`. `eval/runners/mutant-team.ts` already exports `runMutantTeam`. Persist an honest live evaluation result.
- **files_changed**:
  - `eval/runners/mutant-team-eval-runner.ts` (new — eval-layer runner mirroring foundation-lab-eval-runner / team-decision-eval-runner)
  - `docs/evidence/MUTANT_TEAM_PASS/eval.json` (new — persisted live eval result)
  - `tests/unit/eval/mutant-team-evidence-binding.node.test.ts` (new — evidence-binding tests)
- **commands_run**:
  - `mise run test -- tests/unit/eval/mutant-team.test.ts` → exit code **0** (34 tests passed)
  - `npx tsx eval/runners/mutant-team-eval-runner.ts` → exit code **0** (verdict: PASS, eval.json written)
  - `mise run test -- tests/unit/eval/mutant-team-evidence-binding.node.test.ts` → exit code **0** (22 tests passed)
  - `mise run test -- tests/unit/eval/mutant-core.test.ts tests/unit/eval/mutant-1v1.test.ts tests/unit/eval/oracle-registry.test.ts tests/unit/eval/eval-registry.test.ts` → exit code **0** (138 tests passed)
  - `npx tsx gauntlet/evals/src/gauntlet-audit.ts --objective MUTANT-TEAM-PASS-EVIDENCE --class HEADLESS --tests-pass true` → exit code **0** (status: PASS)
- **tests_run**:
  - `tests/unit/eval/mutant-team.test.ts` → 34 passed, 0 failed
  - `tests/unit/eval/mutant-team-evidence-binding.node.test.ts` → 22 passed, 0 failed
  - `tests/unit/eval/mutant-core.test.ts` → 33 passed, 0 failed
  - `tests/unit/eval/mutant-1v1.test.ts` → 38 passed, 0 failed
  - `tests/unit/eval/oracle-registry.test.ts` → 19 passed, 0 failed
  - `tests/unit/eval/eval-registry.test.ts` → 48 passed, 0 failed
- **integration_test_result**: NOT_APPLICABLE (HEADLESS evidence class does not require integration tests)
- **slot_wiring_result**: NOT_APPLICABLE (no slot/player ownership criterion)
- **required_evidence**: executed tests (HEADLESS)
- **artifacts**:
  - `docs/evidence/MUTANT_TEAM_PASS/eval.json` — live eval result with `overall: "PASS"`, `milestoneVerdict: "PASS"`
  - `docs/evidence/MUTANT-TEAM-PASS-EVIDENCE/audit.json` — gauntlet audit PASS
  - `eval/runners/mutant-team-eval-runner.ts` — eval-layer runner
  - `tests/unit/eval/mutant-team-evidence-binding.node.test.ts` — evidence-binding tests
- **spec_sections**: TECHNICAL_SPEC §20 (logical layout), GAUNTLET evidence contract
- **acceptance_criteria_met**:
  - ✅ `runMutantTeam` executed against 3v3 team context → verdict PASS
  - ✅ `docs/evidence/MUTANT_TEAM_PASS/eval.json` persisted with `overall: "PASS"`, `milestoneVerdict: "PASS"`, and all 9 implementable mutant outcomes
  - ✅ Eval-layer runner created (mirrors foundation-lab-eval-runner / team-decision-eval-runner)
  - ✅ Evidence-binding tests pass (22/22)
  - ✅ Original mutant-team.test.ts still passes (34/34)
  - ✅ Neighboring eval tests still pass (138/138)
  - ✅ Gauntlet audit: PASS
- **known_gaps**: None.
- **claims_not_made**:
  - No PES fidelity claim.
  - No invented reference envelope.
  - No `FOUNDATION_LAB_PASS` claim.
  - No `PLAYABLE_1V1_PASS` claim.

---

## Live verdict

```
overall: PASS
milestoneVerdict: PASS
allImplementedDetected: true
anyInvalidRun: false
deferredSummary: NOT_EVALUATED (3 deferred mutants catalogued)
```

**Per-mutant outcomes (all 9 implementable):**

| Mutation ID | Outcome | Executed | Clean | Poisoned |
|---|---|---|---|---|
| non-finite | PASS | true | pass | fail (detected) |
| prng-order | PASS | true | pass | fail (divergence detected) |
| velocity-snap | PASS | true | pass | fail (detected) |
| ball-no-decay | PASS | true | pass | fail (detected) |
| ball-teleport | PASS | true | pass | fail (detected) |
| possession-no-evidence | PASS | true | pass | fail (detected) |
| camera-hash | PASS | true | pass | fail (detected) |
| score-tracker | PASS | true | pass | fail (detected) |
| match-clock | PASS | true | pass | fail (detected) |
| deferred-summary | NOT_EVALUATED | true | pass | n/a |

---

## Evidence binding test results

22 evidence-binding tests validate:
1. `eval.json` exists at `docs/evidence/MUTANT_TEAM_PASS/eval.json`
2. Required top-level keys present (registryVersion, overall, milestoneVerdict, outcomes, perMutant)
3. `overall === milestoneVerdict`
4. Re-running `runMutantTeamEval()` produces identical verdict
5. Per-mutant outcomes match between persisted and live
6. All implementable mutants have `executed: true`
7. No forbidden claims (PES fidelity, reference envelopes)

---

## Gauntlet audit

- **status**: PASS
- **tests result**: PASS
- **orchestrator state checks**: all PASS (18/18)