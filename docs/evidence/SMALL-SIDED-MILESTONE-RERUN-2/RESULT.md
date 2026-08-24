# Builder Report: SMALL_SIDED_SHAPE Milestone Rerun — BATCH-4

## Builder report
- **objective_id:** SMALL-SIDED-MILESTONE-RERUN-2
- **builder_agent:** builder-structured
- **builder_model:** qwen3.6
- **evidence_class:** HEADLESS
- **hypothesis:** Re-running the SMALL_SIDED_SHAPE milestone evaluator against BATCH-4 evidence (extended driven fixture after EVALUATOR-ISRELEVANT-FIX), which improved situation outcomes from 1 PASS / 7 FAIL to 6 PASS / 2 FAIL. Expected verdict: FAIL — 2 required situations (SHOT_TO_RESULT, PHYSICAL_DUEL) still FAIL due to fixture event limitations (no pitch-contact / input-rejection).
- **files_changed:**
  - `docs/evidence/SMALL-SIDED-MILESTONE-RERUN-2/input.json` — evaluator input (created)
  - `docs/evidence/SMALL-SIDED-MILESTONE-RERUN-2/evaluate-output.json` — evaluator output (copied from runner)
  - `docs/evidence/SMALL-SIDED-MILESTONE-RERUN-2/RESULT.md` — this builder report
- **commands_run:**
  - `mkdir -p docs/evidence/SMALL-SIDED-MILESTONE-RERUN-2` — exit code 0
  - `pnpm run gauntlet:milestone:evaluate -- --milestone SMALL_SIDED_SHAPE --input docs/evidence/SMALL-SIDED-MILESTONE-RERUN-2/input.json` — exit code 1 (verdict: FAIL, `milestone_playtest_failed`)
  - `pnpm exec vitest run --project node tests/unit/eval/small-sided-situation-evaluator.test.ts` — exit code 0 (27 passed)
  - `pnpm exec vitest run --project node tests/unit/gauntlet-0.9-contracts.test.ts` — exit code 0 (9 passed)
  - `pnpm exec vitest run --project node tests/unit/scenario/situation-fixtures.node.test.ts` — exit code 0 (67 passed)
- **tests_run:**
  - `small-sided-situation-evaluator.test.ts` — 27 tests, all passed
  - `gauntlet-0.9-contracts.test.ts` (includes SMALL_SIDED_SHAPE profile, playtest, and audit gate tests) — 9 tests, all passed
  - `situation-fixtures.node.test.ts` (covers all 8 SMALL_SIDED_SHAPE situations) — 67 tests, all passed
- **integration_test_result:** NOT APPLICABLE (this is a milestone evaluation, not a feature integration)
- **slot_wiring_result:** NOT APPLICABLE
- **required_evidence:**
  - Entry prerequisites: PLAYABLE_1V1_PASS (accepted), TEAM_DECISION_PROFILE (accepted) → pass
  - Exit prerequisites: MUTANT_1V1_PASS (accepted), ARCHETYPE_BLINDED_COMPARISON (accepted) → pass
  - Browser case: BROWSER-SMALL-SIDED-001 materialized → present
  - Situation outcomes: 8 required, 8 provided (6 PASS, 2 FAIL)
- **artifacts:**
  - `docs/evidence/SMALL-SIDED-MILESTONE-RERUN-2/input.json` — BATCH-4 situation outcomes
  - `docs/evidence/SMALL-SIDED-MILESTONE-RERUN-2/evaluate-output.json` — evaluator output
  - `docs/evidence/milestones/SMALL_SIDED_SHAPE/playtests/2026-08-24T20-27-15-138Z.json` — evaluator output (original)
  - `gauntlet/playtests/SMALL_SIDED_SHAPE.json` — required situations reference (read-only)
- **spec_sections:** Gauntlet evidence contract (`gauntlet/evidence-contract.md`), milestone evaluator (`gauntlet/evals/src/evaluate-milestone-playtest.ts`), milestone playtest contract (`gauntlet/milestone-playtest-contract.md`), situation mapping (`eval/contracts/situation-mapping.ts`)
- **acceptance_criteria_met:** The evaluator ran to completion and produced a deterministic verdict. The milestone verdict is FAIL, which is a valid evaluation outcome — not an acceptance rejection.
- **known_gaps:**
  - 2 of 8 required situations produce FAIL outcomes (SHOT_TO_RESULT, PHYSICAL_DUEL)
  - These FAIL verdicts are honest: the extended fixture lacks pitch-contact events and input-rejection logic, which are required for those specific situations to materialize
  - No critic verdict was performed (critic_verdict: MISSING), but the evaluator already determined FAIL at the situation-outcome gate (before reaching the critic gate)
  - The milestone requires ALL situations to PASS to proceed; with 2 FAIL outcomes the milestone is failed
- **claims_not_made:**
  - Do NOT claim SMALL_SIDED_SHAPE PASS
  - Do NOT claim PES fidelity
  - Do NOT claim FOUNDATION_LAB_PASS

## Verdict

**FAIL** — `milestone_playtest_failed`

### Situation-level breakdown (BATCH-4 extended fixture)

| # | Situation | Verdict | Source |
|---|-----------|---------|--------|
| 1 | PASS_RECEPTION | PASS | BATCH-4 |
| 2 | SHOT_TO_RESULT | FAIL | BATCH-4 (fixture lacks pitch-contact events) |
| 3 | PHYSICAL_DUEL | FAIL | BATCH-4 (fixture lacks input-rejection events) |
| 4 | SUPPORT_AND_PASSING_LANES | PASS | BATCH-4 |
| 5 | SETTLED_ATTACK_VS_DEFENCE | PASS | BATCH-4 |
| 6 | ATTACK_TO_DEFENCE_TRANSITION | PASS | BATCH-4 |
| 7 | DEFENCE_TO_ATTACK_TRANSITION | PASS | BATCH-4 |
| 8 | COORDINATED_PRESS | PASS | BATCH-4 |

**Summary:** 6/8 PASS, 2/8 FAIL. Improved from prior rerun (1 PASS / 7 FAIL) by accepting 5 previously-FAIL situations through the EVALUATOR-ISRELEVANT-FIX. However, SHOT_TO_RESULT and PHYSICAL_DUEL remain FAIL due to fixture event limitations (no pitch-contact / input-rejection), which is an honest verdict.

### Evaluator output (verbatim)

```json
{
  "schema_version": 1,
  "record_type": "milestone_playtest_result",
  "milestone_id": "SMALL_SIDED_SHAPE",
  "playtest_plan_version": "small-sided-shape-playtest-v1",
  "generated_at": "2026-08-24T20:27:15.138Z",
  "decision": "milestone_failed",
  "milestone_verdict": "FAIL",
  "failure_class": "milestone_playtest_failed"
}
```

### Evaluator flow

1. Prerequisite gates: entry_prerequisites_pass=true, exit_prerequisites_pass=true → gate passes
2. Required situations evaluated: 8 outcomes loaded from input.json
3. FAIL gate triggered: SHOT_TO_RESULT=FAIL and PHYSICAL_DUEL=FAIL present → evaluator returns `milestone_verdict: "FAIL"` with `failure_class: "milestone_playtest_failed"` at line 161 of `evaluate-state.ts`
4. Critic gate not reached (deterministic FAIL gate fires first)

### Evidence paths

- Input: `docs/evidence/SMALL-SIDED-MILESTONE-RERUN-2/input.json`
- Output: `docs/evidence/SMALL-SIDED-MILESTONE-RERUN-2/evaluate-output.json` (copy of `docs/evidence/milestones/SMALL_SIDED_SHAPE/playtests/2026-08-24T20-27-15-138Z.json`)
- Plan reference: `gauntlet/playtests/SMALL_SIDED_SHAPE.json`
- Evaluator: `gauntlet/evals/src/evaluate-milestone-playtest.ts` (calls `evaluate-state.ts`)
- BATCH-4 evidence: `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-4/` (extended fixture situations)
- Accepted prerequisite evidence: `docs/evidence/PLAYABLE_1V1_PASS/`, `docs/evidence/TEAM_DECISION_PROFILE/`, `docs/evidence/MUTANT_1V1_PASS/`, `docs/evidence/ARCHETYPE_BLINDED_COMPARISON/`