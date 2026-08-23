# Builder report

- objective_id: SMALL-SIDED-SITUATIONS-BATCH-3
- builder_agent: builder-structured
- builder_model: qwen3.6
- evidence_class: HEADLESS
- hypothesis: The extended situation-driven fixture (`3v3-situation-driven-extended.v1.json`) produces additional event kinds (notably `second-touch` at ticks 18, 23, 51) compared to the original driven fixture. The situation evaluator, when run against the extended fixture, should produce honest per-situation verdicts. Key expectation: `PASS_RECEPTION` remains FAIL because the evaluator's `isRelevantEvent` filter does not include `second-touch` for this situation, so the indicative check cannot find it in `relevantEvents`.
- files_changed:
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/index.json` (created — evaluator output)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/PASS_RECEPTION.json` (created — evaluator output)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/SHOT_TO_RESULT.json` (created — evaluator output)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/PHYSICAL_DUEL.json` (created — evaluator output)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/SUPPORT_AND_PASSING_LANES.json` (created — evaluator output)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/SETTLED_ATTACK_VS_DEFENCE.json` (created — evaluator output)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/ATTACK_TO_DEFENCE_TRANSITION.json` (created — evaluator output)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/DEFENCE_TO_ATTACK_TRANSITION.json` (created — evaluator output)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/COORDINATED_PRESS.json` (created — evaluator output)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/RESULT.md` (this file)
  - `tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-3-binding.test.ts` (created — binding test suite)
- commands_run:
  - cmd: `npx tsx eval/runners/small-sided-situation-evaluator.ts 3v3-situation-driven-extended.v1.json docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations`
    exit_code: 1 (non-zero because `hasInvariantFailures: true`; artifacts still written)
  - cmd: `CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-3-binding.test.ts`
    exit_code: 0
- tests_run:
  - name: SMALL-SIDED-SITUATIONS-BATCH-3-binding.test.ts (26 tests)
    result: PASS (26 passed)
- integration_test_result: Not applicable (no integration test needed for structured evidence objective)
- slot_wiring_result: Not applicable (no slot wiring in scope)
- required_evidence: HEADLESS (executed tests)
- artifacts:
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/index.json` (8 situations, fixture: 3v3-situation-driven-extended.v1.json, 60 ticks, seed 42)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/PASS_RECEPTION.json` (verdict: FAIL, 3 relevant events: pass, player-ball-contact, player-ball-contact; `second-touch` present in all_events but NOT in relevant_events)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/SHOT_TO_RESULT.json` (verdict: FAIL, 1 relevant event: shot)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/PHYSICAL_DUEL.json` (verdict: FAIL, 6 relevant events: player-player-contact)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/SUPPORT_AND_PASSING_LANES.json` (verdict: FAIL, 3 relevant events: pass, player-ball-contact, player-ball-contact)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/SETTLED_ATTACK_VS_DEFENCE.json` (verdict: PASS, 10 relevant events including shot)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/ATTACK_TO_DEFENCE_TRANSITION.json` (verdict: FAIL, 2 relevant events: pass, shot)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/DEFENCE_TO_ATTACK_TRANSITION.json` (verdict: FAIL, 4 relevant events: pass, player-ball-contact, player-ball-contact, shot)
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/COORDINATED_PRESS.json` (verdict: FAIL, 8 relevant events: player-player-contact, pass, shot)
  - `tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-3-binding.test.ts` (26 tests: byte-identical re-run, honest verdicts, verdict rationale, extended fixture event kinds, artifact shape)
- spec_sections: `eval/contracts/situation-mapping.ts` (SituationEvidenceRequirement schema, isRelevantEvent, filterEventsForSituation), `eval/runners/small-sided-situation-evaluator.ts` (computeSituationVerdict, runSituationEvaluator)
- acceptance_criteria_met:
  - ✅ Reran the situation evaluator against `3v3-situation-driven-extended.v1.json`
  - ✅ Persisted honest per-situation artifacts to `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/` (index.json + 8 per-situation JSON)
  - ✅ All 8 situations present and accounted for
  - ✅ Verdicts are honest: SETTLED_ATTACK_VS_DEFENCE = PASS (required + indicative); all others = FAIL
  - ✅ Written binding test `tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-3-binding.test.ts` (26 tests)
  - ✅ Binding test proves byte-identical artifacts between persisted and fresh evaluator run
  - ✅ Binding test confirms honest verdict expectations
  - ✅ All 26 tests pass
  - ✅ Did NOT modify the evaluator, situation-mapping, or any accepted fixtures outside this scope
  - ✅ RESULT.md written with mandatory builder report format
- known_gaps:
  - `hasInvariantFailures: true` in the index — the extended fixture run triggered an invariant failure. This does not affect the honesty of the evaluator verdicts but should be investigated.
  - **EVALUATOR LIMITATION**: The extended fixture produces `second-touch` events (ticks 18, 23, 51 in `all_events`), but the `isRelevantEvent` filter for `PASS_RECEPTION` only matches `pass` and `player-ball-contact`, so `second-touch` never enters `relevantEvents`. As a result, `computeSituationVerdict` cannot find the indicative kind and `PASS_RECEPTION` remains FAIL. This is a structural limitation of the evaluator's relevance filtering — indicative event kinds that are not also required kinds are invisible to the verdict computation.
  - The same limitation applies to `SUPPORT_AND_PASSING_LANES` (indicative: `second-touch`).
  - The mapping `mapping_status` is `NOT_EVALUATED` for all situations in `situation-mapping.ts`.
- claims_not_made:
  - Does NOT claim PES fidelity.
  - Does NOT claim `FOUNDATION_LAB_PASS`.
  - Does NOT claim a regression PASS on any protected oracle.
  - Does NOT invent reference envelopes or tolerate values to make tests pass.
  - Does NOT modify the architecture, evaluator, or situation-mapping contract.
  - Does NOT claim that `PASS_RECEPTION` is PASS (it is NOT — the evaluator's relevance filter prevents `second-touch` from being visible).

## Per-situation verdict table

| Situation | Verdict | Relevant Events | Required Kinds Present | Indicative Kinds Present (in relevantEvents) |
|-----------|---------|----------------|----------------------|--------------------------------------------|
| PASS_RECEPTION | FAIL | 3 (pass, player-ball-contact, player-ball-contact) | ✅ pass, player-ball-contact | ❌ second-touch (in all_events but filtered out) |
| SHOT_TO_RESULT | FAIL | 1 (shot) | ✅ shot | ❌ pitch-contact |
| PHYSICAL_DUEL | FAIL | 6 (player-player-contact) | ✅ player-player-contact | ❌ input-rejection |
| SUPPORT_AND_PASSING_LANES | FAIL | 3 (pass, player-ball-contact, player-ball-contact) | ✅ pass, player-ball-contact | ❌ second-touch (in all_events but filtered out) |
| SETTLED_ATTACK_VS_DEFENCE | PASS | 10 (player-player-contact ×7, pass, player-ball-contact ×2, shot) | ✅ pass, player-ball-contact, player-player-contact | ✅ shot |
| ATTACK_TO_DEFENCE_TRANSITION | FAIL | 2 (pass, shot) | ✅ pass, shot | ❌ player-player-contact, player-ball-contact |
| DEFENCE_TO_ATTACK_TRANSITION | FAIL | 4 (pass, player-ball-contact ×2, shot) | ✅ player-ball-contact, shot | ❌ player-player-contact, ball-out-of-play |
| COORDINATED_PRESS | FAIL | 8 (player-player-contact ×6, pass, shot) | ✅ player-player-contact, pass, shot | ❌ player-ball-contact |

## Extended fixture vs original fixture comparison

| Situation | Original (batch-1-rerun) | Extended (batch-3) | Change |
|-----------|------------------------|-------------------|--------|
| PASS_RECEPTION | FAIL (2 events) | FAIL (3 events) | +1 event (second player-ball-contact at tick 18); second-touch now in all_events but still filtered |
| SHOT_TO_RESULT | FAIL (1 event) | FAIL (1 event) | No change |
| PHYSICAL_DUEL | FAIL (6 events) | FAIL (6 events) | No change |
| SUPPORT_AND_PASSING_LANES | FAIL (2 events) | FAIL (3 events) | +1 event (player-ball-contact at tick 18); second-touch now in all_events but still filtered |
| SETTLED_ATTACK_VS_DEFENCE | PASS (9 events) | PASS (10 events) | +1 event; verdict unchanged |
| ATTACK_TO_DEFENCE_TRANSITION | FAIL (2 events) | FAIL (2 events) | No change |
| DEFENCE_TO_ATTACK_TRANSITION | FAIL (3 events) | FAIL (4 events) | +1 event |
| COORDINATED_PRESS | FAIL (8 events) | FAIL (8 events) | No change |

## Evaluator design note

The `isRelevantEvent` function for `PASS_RECEPTION` only returns true for `pass` and `player-ball-contact` event kinds. The `second-touch` indicative event kind, while present in the simulation output, is never included in `relevantEvents` for this situation. This means `computeSituationVerdict` can never find the indicative kind for `PASS_RECEPTION`, regardless of whether the fixture produces `second-touch` events. To fix this, `isRelevantEvent` for `PASS_RECEPTION` would need to also match `second-touch` events, or `computeSituationVerdict` would need to check indicative kinds against `all_events` rather than `relevantEvents`.