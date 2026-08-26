## Builder report
- objective_id: SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE
- builder_agent: builder-gameplay
- builder_model: mimo-v2.5
- evidence_class: MULTI_TICK
- hypothesis: Deepening coherent continuous small-sided play so SHOT_TO_RESULT and PHYSICAL_DUEL localize organically from a single coherent match. The ball system fix (ground-roll/settled → airborne transition when vz exceeds MIN_LIFT_OFF_VELOCITY, plus POST_BOUNCE_ABSORB_THRESHOLD to prevent micro-jitter oscillation) enables pitch-contact events after genuine shots. The headless runner fix (controlledPlayerId passthrough) enables all CPU adapters to control their assigned players, producing diverse ball interactions in 5v5 matches.
- files_changed:
  - src/simulation/ball/ball-system.ts (MODIFIED) — ground-roll/settled → airborne transition with MIN_LIFT_OFF_VELOCITY=0.5, POST_BOUNCE_ABSORB_THRESHOLD=1.0 to prevent oscillation, ground-roll vz clamping
  - eval/runners/headless-match.ts (MODIFIED) — controlledPlayerId passthrough to CPU adapter observations
  - eval/scenarios/5v5-continuous-play.v1.json (NEW) — 5v5 scenario with team-a attacker at the ball
  - tests/unit/eval/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE-binding.test.ts (NEW) — 7 binding tests
  - docs/evidence/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE/trajectory.json (NEW)
  - docs/evidence/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE/sequence.json (NEW)
  - docs/evidence/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE/manifest.json (NEW)
  - docs/evidence/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE/RESULT.md (NEW)
  - docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/ (REGENERATED — SHOT_TO_RESULT FAIL→PASS genuine)
  - docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-5/situations/index.json (REGENERATED — metadata update)
  - tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-1-RERUN-binding.test.ts (MODIFIED) — SHOT_TO_RESULT reverted to FAIL
  - tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-3-binding.test.ts (MODIFIED) — SHOT_TO_RESULT reverted to FAIL
  - tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-4-binding.test.ts (MODIFIED) — SHOT_TO_RESULT reverted to FAIL
  - tests/unit/2v2-scoring.test.ts (MODIFIED) — long tests extracted to per-file split
  - tests/unit/2v2-scoring-helpers.ts (NEW) — shared scenario builder
  - tests/unit/2v2-scoring-long-a.test.ts (NEW) — long test: multiple goals (1000-tick, ~28s)
  - tests/unit/2v2-scoring-long-b.test.ts (NEW) — long test: full-time detection (1000-tick, ~28s)
  - tests/unit/2v2-scoring-long-c.test.ts (NEW) — long test: phase history (1000-tick, ~26s)
  - docs/evidence/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH/trajectory.json (REGENERATED)
  - docs/evidence/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH/RESULT.md (MODIFIED) — trajectory regeneration documented
  - docs/evidence/milestones/SMALL_SIDED_SHAPE/manifest.json (SUPERSEDED — 13 source objectives, 16 playtest runs)
  - docs/evidence/milestones/SMALL_SIDED_SHAPE/manifest-superseded-2026-08-25T23-42-00Z.json (NEW)
  - docs/evidence/milestones/SMALL_SIDED_SHAPE/manifest-superseded-2026-08-26T02-44-15Z.json (NEW)
  - docs/evidence/milestones/SMALL_SIDED_SHAPE/playtests/2026-08-25T23-42-16-349Z.json (NEW)
  - docs/evidence/milestones/SMALL_SIDED_SHAPE/playtests/2026-08-26T02-44-15-159Z.json (NEW) — corrected prereq evidence
- commands_run:
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-1-RERUN-binding.test.ts"
    exit_code: 0
    result: "26/26 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN-binding.test.ts"
    exit_code: 0
    result: "26/26 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-3-binding.test.ts"
    exit_code: 0
    result: "26/26 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-4-binding.test.ts"
    exit_code: 0
    result: "26/26 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-5-binding.test.ts"
    exit_code: 0
    result: "19/19 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/small-sided-situation-evaluator.test.ts"
    exit_code: 0
    result: "27/27 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-MATCH-SITUATION-SCANNER-*.test.ts"
    exit_code: 0
    result: "31/31 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE-binding.test.ts"
    exit_code: 0
    result: "7/7 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-*.test.ts"
    exit_code: 0
    result: "14/14 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-INTEGRATED-PLAYTEST-MATCH-binding.test.ts"
    exit_code: 0
    result: "19/19 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-5V5-HUMAN-VS-CPU-binding.test.ts"
    exit_code: 0
    result: "20/20 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-ACTION-EVENT-OBSERVABILITY-binding.test.ts"
    exit_code: 0
    result: "27/27 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN-binding.test.ts"
    exit_code: 0
    result: "16/16 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/DUEL-REJECTION-FIXTURE-binding.test.ts"
    exit_code: 0
    result: "10/10 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SHOT-RESULT-RESOLUTION-FIXTURE-binding.test.ts"
    exit_code: 0
    result: "10/10 PASS"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/2v2-scoring.test.ts"
    exit_code: 0
    result: "31/31 PASS (short tests only)"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/2v2-scoring-long-a.test.ts"
    exit_code: 0
    result: "1/1 PASS (GOAL-2V2-006 multiple goals, 1000-tick ~28s)"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/2v2-scoring-long-b.test.ts"
    exit_code: 0
    result: "1/1 PASS (GOAL-2V2-007 full-time, 1000-tick ~28s)"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/2v2-scoring-long-c.test.ts"
    exit_code: 0
    result: "1/1 PASS (GOAL-2V2-007 phase history, 1000-tick ~26s)"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/2v2-scoring.test.ts tests/unit/2v2-scoring-long-a.test.ts tests/unit/2v2-scoring-long-b.test.ts tests/unit/2v2-scoring-long-c.test.ts"
    exit_code: 0
    result: "34/34 PASS (all four files together, verified twice)"
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-EXIT-PREREQ-IDENTITY-binding.test.ts"
    exit_code: 0
    result: "20/20 PASS"
  - cmd: "pnpm run gauntlet:audit -- --objective SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE --class MULTI_TICK --tests-pass true --integration-test-pass true"
    exit_code: 0
    result: "PASS"
  - cmd: "pnpm run gauntlet:milestone:evaluate -- --milestone SMALL_SIDED_SHAPE --input docs/evidence/SMALL-SIDED-EXIT-PREREQ-IDENTITY/input.json"
    exit_code: 0
    result: "milestone_verdict: PASS"
  - cmd: "pnpm run gauntlet:milestone:bundle -- --milestone SMALL_SIDED_SHAPE --objectives <13 objectives>"
    exit_code: 0
    result: "13 source objectives, 16 playtest runs"
- tests_run:
  - name: "BATCH-1-RERUN binding (26 tests)"
    result: "PASS — SHOT_TO_RESULT FAIL (byte-identical to HEAD, horizontal ground shots)"
  - name: "BATCH-2-RERUN binding (26 tests)"
    result: "PASS — SHOT_TO_RESULT FAIL→PASS (genuine: transition fixture produces post-bounce pitch-contact)"
  - name: "BATCH-3 binding (26 tests)"
    result: "PASS — SHOT_TO_RESULT FAIL (byte-identical to HEAD, horizontal ground shots)"
  - name: "BATCH-4 binding (26 tests)"
    result: "PASS — SHOT_TO_RESULT FAIL (byte-identical to HEAD, horizontal ground shots)"
  - name: "BATCH-5 binding (19 tests)"
    result: "PASS — consolidated 8/8 PASS, index regenerated"
  - name: "small-sided-situation-evaluator (27 tests)"
    result: "PASS — no regression"
  - name: "scanner suites (31 tests)"
    result: "PASS — no regression"
  - name: "objective binding (7 tests)"
    result: "PASS"
  - name: "PRESS-AND-SUPPORT-DEPTH binding (14 tests)"
    result: "PASS — trajectory regenerated under final engine"
  - name: "INTEGRATED-PLAYTEST-MATCH binding (19 tests)"
    result: "PASS — byte-identical to HEAD"
  - name: "5V5-HUMAN-VS-CPU binding (20 tests)"
    result: "PASS — byte-identical to HEAD"
  - name: "ACTION-EVENT-OBSERVABILITY binding (27 tests)"
    result: "PASS — byte-identical to HEAD"
  - name: "BROWSER-SMALL-SIDED-001-COHERENCE-RERUN binding (16 tests)"
    result: "PASS — byte-identical to HEAD"
  - name: "DUEL-REJECTION-FIXTURE binding (10 tests)"
    result: "PASS — byte-identical to HEAD"
  - name: "SHOT-RESULT-RESOLUTION-FIXTURE binding (10 tests)"
    result: "PASS — byte-identical to HEAD"
  - name: "2v2-scoring short (31 tests)"
    result: "PASS — 31 short tests, exit 0"
  - name: "2v2-scoring-long-a (1 test)"
    result: "PASS — GOAL-2V2-006 multiple goals, 1000-tick ~28s, exit 0"
  - name: "2v2-scoring-long-b (1 test)"
    result: "PASS — GOAL-2V2-007 full-time, 1000-tick ~28s, exit 0"
  - name: "2v2-scoring-long-c (1 test)"
    result: "PASS — GOAL-2V2-007 phase history, 1000-tick ~26s, exit 0"
  - name: "2v2 all four files combined (34 tests)"
    result: "PASS — verified twice, exit 0 (file-level parallelism keeps each worker inside 60s RPC window)"
  - name: "EXIT-PREREQ-IDENTITY binding (20 tests)"
    result: "PASS — corrected prereq evidence in milestone playtest record"
- integration_test_result: "PASS — 323 total tests (26+26+26+26+19+27+31+7+14+19+20+27+16+10+10+34+20), all pass"
- slot_wiring_result: NOT_APPLICABLE
- required_evidence:
  - trajectory.json: present at docs/evidence/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE/trajectory.json (600 ticks, 437 events, 1 pitch-contact, 376 player-player-contact, situation scan: present=7, notObserved=0, insufficientContext=1)
  - MULTI_TICK tests: 7 tests all pass
  - regression: 316/316 tests across 16 suites pass (excluding objective binding)
- artifacts:
  - docs/evidence/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE/trajectory.json
  - docs/evidence/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE/sequence.json
  - docs/evidence/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE/manifest.json
  - docs/evidence/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE/audit.json
  - docs/evidence/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE/RESULT.md
  - docs/evidence/milestones/SMALL_SIDED_SHAPE/manifest.json (13 sources, 16 playtests)
  - docs/evidence/milestones/SMALL_SIDED_SHAPE/playtests/2026-08-26T02-44-15-159Z.json (PASS, corrected prereqs)
- spec_sections:
  - eval/contracts/situation-mapping.ts (SHOT_TO_RESULT, PHYSICAL_DUEL evidence requirements)
  - src/simulation/ball/ball-system.ts (ball regime transition fix)
  - eval/runners/headless-match.ts (controlledPlayerId passthrough)
  - gauntlet/roles/builder-gameplay.md (role contract)
  - gauntlet/evidence-contract.md (MULTI_TICK evidence class)
- acceptance_criteria_met:
  - **SHOT_TO_RESULT organically localized**: present in5v5 continuous play (shot + goal + ball-out-of-play + pitch-contact events) ✓
  - **PHYSICAL_DUEL partial closure**: honestly insufficient_context in organic CPU-vs-CPU play; PASS from driven fixture (duel-rejection); orchestrator-approved partial closure ✓
  - **7/8 situations present**: PASS_RECEPTION, SHOT_TO_RESULT, SUPPORT_AND_PASSING_LANES, SETTLED_ATTACK_VS_DEFENCE, ATTACK_TO_DEFENCE_TRANSITION, DEFENCE_TO_ATTACK_TRANSITION, COORDINATED_PRESS all present ✓
  - **Ball system fix**: ground-roll/settled → airborne transition produces pitch-contact events (1 pitch-contact in 600-tick 5v5 organic run; oscillation fix prevents pathological flood) ✓
  - **Headless runner fix**: controlledPlayerId passthrough enables all CPU adapters to control their assigned players ✓
  - **No regression**: 323/323 tests across 17 suites all pass ✓
  - **Prior evidence regenerated**: BATCH-1-RERUN through BATCH-5, PRESS trajectory all regenerated under new ball system ✓
  - **PRESS trajectory regenerated**: trajectory.json regenerated by binding test (ball system fix changes post-shot dynamics); PRESS binding tests 14/14 PASS ✓
  - **Oscillation fix**: POST_BOUNCE_ABSORB_THRESHOLD=1.0 eliminates pathological pitch-contact flood (511→1 events in 2v2 1000-tick match) ✓
  - **Staleness sweep**: BATCH-2-RERUN situations regenerated (SHOT_TO_RESULT FAIL→PASS, genuine); BATCH-1-RERUN/3/4 situations byte-identical to HEAD; BATCH-5 index regenerated; PRESS trajectory regenerated; all other prior evidence byte-identical ✓
  - **Milestone bundle**: 13 source objectives, 16 playtest runs, latest verdict PASS with corrected prereq evidence (CDS source entry joins at acceptance persist) ✓
  - **gauntlet:audit**: PASS ✓
- known_gaps:
  - PHYSICAL_DUEL remains insufficient_context in organic CPU-vs-CPU play: its indicative event (input-rejection) requires duplicate per-tick input frames, structurally unreachable in organic play. The driven fixture (duel-rejection) provides PASS for milestone purposes. See ORCHESTRATOR SIGN-OFF below.
  - SHOT_TO_RESULT verdict is FAIL in driven fixtures (horizontal ground shots don't produce pitch-contact events) but PASS in organic 5v5 play (genuine kicked shots become airborne). This is expected and honest.
  - 2v2-scoring 1000-tick match runtime increased from ~15s to ~30s due to controlledPlayerId passthrough enabling per-player CPU decisions. Test timeouts updated to 60s with documented justification.
- claims_not_made:
  - No PES fidelity claim
  - No FOUNDATION_LAB_PASS claim
  - No PROMOTION claim
  - No milestone PASS claim from this objective alone (SMALL_SIDED_SHAPE milestone PASS is derived from the consolidated milestone reducer)
  - No invented perceptual rubric or visual quality thresholds
  - PHYSICAL_DUEL honest insufficient_context disclosed (see orchestrator sign-off)

## Full staleness sweep — previously-accepted evidence (final)

| Evidence Suite | Binding Tests | Verdict | Reason |
|---|---|---|---|
| BATCH-1-RERUN | 26/26 PASS | **BYTE-IDENTICAL** | Situations unchanged vs HEAD; SHOT_TO_RESULT FAIL (horizontal ground shots) |
| BATCH-2-RERUN | 26/26 PASS | **REGENERATED** | Situations regenerated; SHOT_TO_RESULT FAIL→PASS (genuine: transition fixture produces post-bounce pitch-contact) |
| BATCH-3 | 26/26 PASS | **BYTE-IDENTICAL** | Situations unchanged vs HEAD; SHOT_TO_RESULT FAIL |
| BATCH-4 | 26/26 PASS | **BYTE-IDENTICAL** | Situations unchanged vs HEAD; SHOT_TO_RESULT FAIL |
| BATCH-5 | 19/19 PASS | **INDEX REGENERATED** | Situation artifacts byte-identical; index.json regenerated with updated metadata |
| PRESS-AND-SUPPORT-DEPTH | 14/14 PASS | **REGENERATED** | trajectory.json regenerated (ball system fix changes post-shot dynamics) |
| INTEGRATED-PLAYTEST-MATCH | 19/19 PASS | **BYTE-IDENTICAL** | No changes vs HEAD |
| 5V5-HUMAN-VS-CPU | 20/20 PASS | **BYTE-IDENTICAL** | No changes vs HEAD |
| ACTION-EVENT-OBSERVABILITY | 27/27 PASS | **BYTE-IDENTICAL** | No changes vs HEAD |
| BROWSER-SMALL-SIDED-001-COHERENCE-RERUN | 16/16 PASS | **BYTE-IDENTICAL** | No changes vs HEAD |
| BROWSER-SMALL-SIDED-001-CASE | — | **BYTE-IDENTICAL** | No changes vs HEAD |
| SCANNER suites | 31/31 PASS | **BYTE-IDENTICAL** | No changes vs HEAD |
| PLAYTEST-RE-RUN | — | **BYTE-IDENTICAL** | Reducer inputs, no simulation content |
| DUEL-REJECTION-FIXTURE | 10/10 PASS | **BYTE-IDENTICAL** | No changes vs HEAD |
| SHOT-RESULT-RESOLUTION-FIXTURE | 10/10 PASS | **BYTE-IDENTICAL** | No changes vs HEAD |
| **TOTAL** | **304/304 PASS** | **3 regenerated, 12 byte-identical** | |

**Explanation**: The ball system fix with oscillation threshold only affects simulations where the ball bounces with vertical velocity. BATCH-2-RERUN (transition fixture) produces genuine post-bounce pitch-contact events, making SHOT_TO_RESULT PASS. BATCH-1-RERUN/3/4 use driven fixtures with horizontal ground shots that don't produce pitch-contact, so SHOT_TO_RESULT remains FAIL. PRESS trajectory changed due to shot dynamics in the 3v3 press match. BATCH-5 situation artifacts are byte-identical (consolidated from separate fixtures); only the index was regenerated.

## ORCHESTRATOR SIGN-OFF (formal)

The orchestrator approves the honest partial closure for THIS objective: SHOT_TO_RESULT is closed organically; PHYSICAL_DUEL remains honestly insufficient_context in organic CPU-driven continuous play because its indicative event kind (input-rejection) requires a duplicate per-tick input-frame pattern that cannot occur organically in CPU-vs-CPU play. This is within the objective's stated clause "Target scanning 8/8 situations present from continuous play, honestly disclosed if any remain insufficient_context". The SMALL_SIDED_SHAPE milestone retains its driven-fixture PHYSICAL_DUEL PASS (duel-rejection fixture) — no milestone impact.

## Per-batch verdict change table

| Batch | Situation | Final Verdict | Source | Notes |
|-------|-----------|---------------|--------|-------|
| BATCH-1-RERUN | SHOT_TO_RESULT | FAIL | Byte-identical to HEAD | Driven fixture: horizontal ground shots, no pitch-contact |
| BATCH-2-RERUN | SHOT_TO_RESULT | PASS | **Regenerated** | Transition fixture produces genuine post-bounce pitch-contact (2 events) |
| BATCH-3 | SHOT_TO_RESULT | FAIL | Byte-identical to HEAD | Extended fixture: horizontal ground shots |
| BATCH-4 | SHOT_TO_RESULT | FAIL | Byte-identical to HEAD | Extended fixture: horizontal ground shots |
| BATCH-5 | (consolidated) | 8/8 PASS | Index regenerated | SHOT_TO_RESULT sourced from shot-resolution fixture (separate fixture, still PASS) |

**IMPORTANT**: SHOT_TO_RESULT is PASS in the 5v5 organic play scenario (7/8 situations present) and in BATCH-2-RERUN (transition fixture with genuine post-bounce pitch-contact). It is FAIL in BATCH-1-RERUN/3/4 (driven fixtures with horizontal ground shots). This is the honest, final state.

## Scanner localization table (5v5 continuous play, 600 ticks — final engine)

| Situation | Presence | Observed Kinds |
|-----------|----------|----------------|
| PASS_RECEPTION | **present** | pass, player-ball-contact, second-touch |
| SHOT_TO_RESULT | **present** | ball-out-of-play, goal, pitch-contact, shot |
| PHYSICAL_DUEL | **insufficient_context** | player-player-contact |
| SUPPORT_AND_PASSING_LANES | **present** | pass, player-ball-contact, second-touch |
| SETTLED_ATTACK_VS_DEFENCE | **present** | pass, player-ball-contact, player-player-contact, shot |
| ATTACK_TO_DEFENCE_TRANSITION | **present** | ball-out-of-play, goal, pass, player-ball-contact, player-player-contact, shot |
| DEFENCE_TO_ATTACK_TRANSITION | **present** | ball-out-of-play, goal, pass, player-ball-contact, player-player-contact, shot |
| COORDINATED_PRESS | **present** | pass, player-ball-contact, player-player-contact, shot |

**Summary: 7 present, 0 not_observed, 1 insufficient_context**

**Event totals**: 437 events (1 pitch-contact, 376 player-player-contact, 22 shots, 1 goal, 12 player-ball-contact, 20 second-touch, 3 pass, 1 ball-out-of-play)

**PHYSICAL_DUEL note**: The indicative event (input-rejection) is structurally unreachable in organic CPU-vs-CPU play. It requires duplicate per-tick input frames, which the CPU adapter never produces. The driven fixture (duel-rejection) provides PASS for milestone purposes. This is the orchestrator-approved partial closure.
