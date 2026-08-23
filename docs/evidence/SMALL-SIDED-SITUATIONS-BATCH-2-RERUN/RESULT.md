# Builder report

- objective_id: SMALL-SIDED-SITUATIONS-BATCH-2-RERUN
- builder_agent: builder-structured
- builder_model: qwen3.6
- evidence_class: HEADLESS
- hypothesis: The transition-driven fixture (`3v3-transition-driven.v1.json`) produces a minimal event set (single shot at tick 2) that the situation evaluator maps to the four BATCH-2 situations. Expected: SETTLED_ATTACK_VS_DEFENCE NOT_EVALUATED (only indicative 'shot' present, required kinds absent); the other 3 transition situations FAIL (required 'shot' present, indicative kinds absent).
- files_changed:
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/index.json` (created — evaluator output)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/SETTLED_ATTACK_VS_DEFENCE.json` (created — evaluator output)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/ATTACK_TO_DEFENCE_TRANSITION.json` (created — evaluator output)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/DEFENCE_TO_ATTACK_TRANSITION.json` (created — evaluator output)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/COORDINATED_PRESS.json` (created — evaluator output)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/PASS_RECEPTION.json` (created — evaluator output, not a BATCH-2 target but present in fixture)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/SHOT_TO_RESULT.json` (created — evaluator output, not a BATCH-2 target but present in fixture)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/PHYSICAL_DUEL.json` (created — evaluator output, not a BATCH-2 target but present in fixture)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/SUPPORT_AND_PASSING_LANES.json` (created — evaluator output, not a BATCH-2 target but present in fixture)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/RESULT.md` (this file)
  - `tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN-binding.test.ts` (created — binding test suite)
- commands_run:
  - cmd: `npx tsx eval/runners/small-sided-situation-evaluator.ts 3v3-transition-driven.v1.json docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations`
    exit_code: 1 (non-zero because `hasInvariantFailures: true`; artifacts still written)
  - cmd: `CI=1 pnpm vitest run --project node tests/unit/eval/small-sided-situation-evaluator.test.ts tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-1-binding.test.ts tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-1-RERUN-binding.test.ts tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN-binding.test.ts`
    exit_code: 0
- tests_run:
  - name: small-sided-situation-evaluator.test.ts (27 tests)
    result: PASS (27 passed)
  - name: SMALL-SIDED-SITUATIONS-BATCH-1-binding.test.ts (11 tests)
    result: PASS (11 passed)
  - name: SMALL-SIDED-SITUATIONS-BATCH-1-RERUN-binding.test.ts (26 tests)
    result: PASS (26 passed)
  - name: SMALL-SIDED-SITUATIONS-BATCH-2-RERUN-binding.test.ts (26 tests)
    result: PASS (26 passed)
- integration_test_result: Not applicable (no integration test needed for structured evidence objective)
- slot_wiring_result: Not applicable (no slot wiring in scope)
- required_evidence: HEADLESS (executed tests)
- artifacts:
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/index.json` (8 situations, fixture: 3v3-transition-driven.v1.json, 60 ticks, seed 42, hasInvariantFailures: true)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/SETTLED_ATTACK_VS_DEFENCE.json` (verdict: NOT_EVALUATED, 1 relevant event: shot — indicative only, required kinds absent)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/ATTACK_TO_DEFENCE_TRANSITION.json` (verdict: FAIL, 1 relevant event: shot — required present, indicative absent)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/DEFENCE_TO_ATTACK_TRANSITION.json` (verdict: FAIL, 1 relevant event: shot — required present, indicative absent)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/COORDINATED_PRESS.json` (verdict: FAIL, 1 relevant event: shot — required present, indicative absent)
  - `tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN-binding.test.ts` (26 tests: byte-identical re-run, honest verdicts, verdict rationale, NOT_EVALUATED guard, artifact shape)
- spec_sections: `eval/contracts/situation-mapping.ts` (SituationEvidenceRequirement schema, isRelevantEvent filter), `eval/runners/small-sided-situation-evaluator.ts` (computeSituationVerdict, runSituationEvaluator)
- acceptance_criteria_met:
  - ✅ Re-ran the situation evaluator against `3v3-transition-driven.v1.json`
  - ✅ Persisted honest per-situation artifacts to `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/` (index.json + 8 per-situation JSON)
  - ✅ All 4 BATCH-2 target situations present: SETTLED_ATTACK_VS_DEFENCE, ATTACK_TO_DEFENCE_TRANSITION, DEFENCE_TO_ATTACK_TRANSITION, COORDINATED_PRESS
  - ✅ Verdicts are honest: SETTLED_ATTACK_VS_DEFENCE = NOT_EVALUATED (required kinds absent); the other 3 targets = FAIL (required 'shot' present, indicative absent)
  - ✅ Written binding test `tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN-binding.test.ts` (26 tests)
  - ✅ Binding test proves byte-identical artifacts between persisted and fresh evaluator run
  - ✅ Binding test confirms honest verdict expectations
  - ✅ All 90 tests pass (27 existing + 11 batch-1 + 26 batch-1-rerun + 26 batch-2-rerun)
  - ✅ Did NOT modify the evaluator, situation-mapping, or any accepted fixtures outside this scope
  - ✅ RESULT.md written with mandatory builder report format
- known_gaps:
  - `hasInvariantFailures: true` in the index — the transition-driven fixture run triggered an invariant failure (same as BATCH-1). This does not affect the honesty of the evaluator verdicts but should be investigated.
  - The transition-driven fixture produces only a single shot event at tick 2, meaning the situation evaluator sees minimal event diversity. The BATCH-2 situations are evaluated on the basis of this single event — the verdicts reflect the mapping rules faithfully but the fixture's limited event set means the situations are not richly evidenced.
  - The evaluator mapping `mapping_status` is `NOT_EVALUATED` for all situations in `situation-mapping.ts`, meaning the evaluator can compute verdicts but the mapping has not been promoted to `READY` in the contract.
- claims_not_made:
  - Does NOT claim PES fidelity.
  - Does NOT claim `FOUNDATION_LAB_PASS`.
  - Does NOT claim a regression PASS on any protected oracle.
  - Does NOT invent reference envelopes or tolerate values to make tests pass.
  - Does NOT modify the architecture, evaluator, or situation-mapping contract.

## Per-situation verdict table

| Situation | Verdict | Relevant Events | Required Kinds Present | Indicative Kinds Present |
|-----------|---------|----------------|----------------------|------------------------|
| SETTLED_ATTACK_VS_DEFENCE | NOT_EVALUATED | 1 (shot) | ❌ pass, player-ball-contact, player-player-contact | ✅ shot (only indicative) |
| ATTACK_TO_DEFENCE_TRANSITION | FAIL | 1 (shot) | ✅ shot | ❌ player-player-contact, player-ball-contact |
| DEFENCE_TO_ATTACK_TRANSITION | FAIL | 1 (shot) | ✅ shot | ❌ player-player-contact, ball-out-of-play |
| COORDINATED_PRESS | FAIL | 1 (shot) | ✅ shot | ❌ player-ball-contact |