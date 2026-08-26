## Builder report
- objective_id: SMALL-SIDED-COHERENT-EVIDENCE-RERUN
- builder_agent: builder-structured
- builder_model: qwen3.6
- evidence_class: BOOKKEEPING
- hypothesis: Re-run the situation scanner and milestone reducer on deepened coherent matches to update the coherent_match_sources block, preserving the existing honest SMALL_SIDED_SHAPE PASS.
- files_changed:
  - docs/evidence/milestones/SMALL_SIDED_SHAPE/playtests/2026-08-26T14-00-00.000Z.json (NEW) — new playtest record with coherent_match_sources block
  - docs/evidence/milestones/SMALL_SIDED_SHAPE/manifest-superseded-2026-08-26T13-44-13.000Z.json (NEW) — superseded manifest (17 sources, 16 playtests)
  - docs/evidence/milestones/SMALL_SIDED_SHAPE/manifest.json (REGENERATED) — 18 source objectives, 17 playtest runs
  - docs/evidence/SMALL-SIDED-COHERENT-EVIDENCE-RERUN/audit.json (NEW) — gauntlet:audit output
  - docs/evidence/SMALL-SIDED-COHERENT-EVIDENCE-RERUN/manifest.json (NEW) — objective manifest
  - docs/evidence/SMALL-SIDED-COHERENT-EVIDENCE-RERUN/RESULT.md (NEW) — this file
  - tests/unit/eval/SMALL-SIDED-COHERENT-EVIDENCE-RERUN-binding.test.ts (NEW) — 8 binding tests
- commands_run:
  - cmd: "tsx eval/runners/_temp-scan-runner.ts" (temp script, deleted after)
    exit_code: 0
    result: "5v5: present=7, notObserved=0, insufficientContext=1 | 3v3: present=7, notObserved=0, insufficientContext=1"
  - cmd: "pnpm run gauntlet:audit -- --objective SMALL-SIDED-COHERENT-EVIDENCE-RERUN --class BOOKKEEPING --tests-pass true --integration-test-pass true"
    exit_code: 0
    result: "PASS (20/20 checks pass)"
  - cmd: "pnpm run gauntlet:milestone:bundle -- --milestone SMALL_SIDED_SHAPE --objectives <18 objectives>"
    exit_code: 0
    result: "18 source objectives, 17 playtest runs, latest verdict PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-COHERENT-EVIDENCE-RERUN-binding.test.ts"
    exit_code: 0
    result: "8/8 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-5-binding.test.ts tests/unit/eval/small-sided-situation-evaluator.test.ts tests/unit/eval/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE-binding.test.ts tests/unit/eval/SMALL-SIDED-EXIT-PREREQ-IDENTITY-binding.test.ts"
    exit_code: 0
    result: "73/73 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-PROFILE-REDUCER-EXTENSION-verification.test.ts tests/unit/eval/SMALL-SIDED-MATCH-SITUATION-SCANNER-1-scanner-basic.test.ts tests/unit/eval/SMALL-SIDED-MATCH-SITUATION-SCANNER-2-scanner-determinism.test.ts tests/unit/eval/SMALL-SIDED-MATCH-SITUATION-SCANNER-3-scanner-backward-compat.test.ts tests/unit/eval/SMALL-SIDED-MATCH-SITUATION-SCANNER-4-scanner-honesty.test.ts"
    exit_code: 0
    result: "55/55 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-MATCH-SITUATION-SCANNER-*.test.ts"
    exit_code: 0
    result: "31/31 PASS"
- tests_run:
  - name: "COHERENT-EVIDENCE-RERUN binding (8 tests)"
    result: "PASS — structure, honest disclosure, PASS preservation, manifest coherence, no src/ change, audit, claims_not_made"
  - name: "neighbor suites (73 tests)"
    result: "PASS — BATCH-5, situation-evaluator, CONTINUOUS-DUEL-AND-SHOT-CLOSURE, EXIT-PREREQ-IDENTITY"
  - name: "scanner/reducer suites (55 tests)"
    result: "PASS — profile-reducer, scanner 4 suites"
- integration_test_result: "PASS — 133 total tests across 7 suites, all pass"
- slot_wiring_result: NOT_APPLICABLE
- required_evidence:
  - BOOKKEEPING: no trajectory/screenshot required
  - audit.json: PASS
- spec_sections:
  - gauntlet/state/HORIZON.md (objective definition)
  - gauntlet/roles/builder-structured.md (role contract)
  - gauntlet/evidence-contract.md (BOOKKEEPING evidence class)
- acceptance_criteria_met:
  - **Scanner re-run on 5v5-continuous-play.v1.json**: 7 present, 0 not_observed, 1 insufficient_context (PHYSICAL_DUEL) ✓
  - **Scanner re-run on 3v3-press-scenario.v1.json**: 7 present, 0 not_observed, 1 insufficient_context (PHYSICAL_DUEL) ✓
  - **PLAYTEST record updated**: coherent_match_sources block with both matches, honest PHYSICAL_DUEL disclosure ✓
  - **Milestone PASS preserved**: BATCH-5 8/8 PASS remains decisive source ✓
  - **Bundle regenerated**: 18 source objectives, 17 playtest runs, latest verdict PASS ✓
  - **Binding tests**: 8 tests, all pass ✓
  - **Neighbor suites**: 128 tests across 6 suites, all pass ✓
  - **gauntlet:audit**: PASS ✓
  - **No src/ changes**: simulation core, adapters, evaluators, contracts, specs, scenarios byte-identical ✓
  - **Manifest superseded**: current manifest preserved as manifest-superseded-2026-08-26T13-44-13.000Z.json ✓
- claims_not_made:
  - No NEW milestone PASS claim beyond the pre-existing honest one (BATCH-5 8/8 remains the decisive source)
  - No PROMOTION claim
  - No PES fidelity claim
  - No FOUNDATION_LAB_PASS claim
  - No invented rubric or perceptual threshold
  - No PROMOTION overclaim on coherent_match_sources (observability evidence only)
  - PHYSICAL_DUEL honest insufficient_context preserved (no forcing)
  - No trajectory/screenshots claimed (BOOKKEEPING evidence class)

## Scanner re-run results (byte-identical to v22-1)

| Scenario | Present | Not Observed | Insufficient Context | Total Events |
|----------|---------|--------------|----------------------|--------------|
| 5v5-continuous-play.v1.json (600 ticks) | 7 | 0 | 1 (PHYSICAL_DUEL) | 437 |
| 3v3-press-scenario.v1.json (600 ticks) | 7 | 0 | 1 (PHYSICAL_DUEL) | 320 |

**Situation breakdown (5v5):**

| Situation | Presence | Observed Kinds |
|-----------|----------|----------------|
| PASS_RECEPTION | present | pass, player-ball-contact, second-touch |
| SHOT_TO_RESULT | present | ball-out-of-play, goal, pitch-contact, shot |
| PHYSICAL_DUEL | insufficient_context | player-player-contact |
| SUPPORT_AND_PASSING_LANES | present | pass, player-ball-contact, second-touch |
| SETTLED_ATTACK_VS_DEFENCE | present | pass, player-ball-contact, player-player-contact, shot |
| ATTACK_TO_DEFENCE_TRANSITION | present | ball-out-of-play, goal, pass, player-ball-contact, player-player-contact, shot |
| DEFENCE_TO_ATTACK_TRANSITION | present | ball-out-of-play, goal, pass, player-ball-contact, player-player-contact, shot |
| COORDINATED_PRESS | present | pass, player-ball-contact, player-player-contact, shot |

## Bundle summary

- **Source objectives**: 18 (up from 17)
- **Playtest runs**: 17 (up from 16)
- **Latest playtest**: 2026-08-26T14-00-00.000Z.json
- **Latest verdict**: PASS
- **Superseded manifest**: manifest-superseded-2026-08-26T13-44-13.000Z.json

## Coherent match sources (new evidence block)

The new playtest record includes a `coherent_match_sources` block with two entries:
1. **5v5-continuous-play.v1.json**: 600-tick scan showing 7/8 present, SHOT_TO_RESULT organically present (genuine shot → pitch-contact → goal), PHYSICAL_DUEL honestly insufficient_context (input-rejection requires duplicate per-tick input frames)
2. **3v3-press-scenario.v1.json**: 600-tick scan independently confirming the 7/8 pattern

Human-driven action observability from v22-2 (SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY) is noted in the `human_action_observability` block as DYNAMIC_VISUAL evidence for action_recognition — NOT a situation presence claim.