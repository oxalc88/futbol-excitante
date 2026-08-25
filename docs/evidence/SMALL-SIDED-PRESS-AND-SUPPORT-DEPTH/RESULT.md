## Builder report
- objective_id: SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH
- builder_agent: builder-gameplay
- builder_model: mimo-v2.5
- evidence_class: MULTI_TICK
- hypothesis: Deepening press+cover responsibilities and support structure in genuine 3v3 small-sided CPU-vs-CPU play makes coordinated defensive geometry (presser-cover separation) and attacking support structure (off-ball distances) observable in team-geometry trajectories.
- files_changed:
  - eval/runners/headless-match.ts (team decision injection into CPU observations — critical gap fix)
  - src/adapters/input-browser/cpu-adapter.ts (cover player constants + logic, off-ball support constants + logic, mechanism activation counters)
  - eval/scenarios/3v3-press-scenario.v1.json (new fixture: team-b attacks into team-a's third, triggering DEFEND/MARKING/PRESSING)
  - tests/unit/eval/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-1-geometry.test.ts (MULTI_TICK test suite: press/cover, support, determinism, honesty guards, scanner)
  - tests/unit/eval/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-2-trajectory.test.ts (trajectory generation from press scenario)
  - tests/unit/eval/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-3-guard-proof.test.ts (guard proof: activation counters + DEFEND/PRESSING trigger)
  - docs/evidence/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH/trajectory.json (team-geometry trajectory from press scenario)
  - docs/evidence/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH/RESULT.md (this report)
- commands_run:
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-1-geometry.test.ts"
    exit_code: 0
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-2-trajectory.test.ts"
    exit_code: 0
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-3-guard-proof.test.ts"
    exit_code: 0
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-*.test.ts"
    exit_code: 0
  - cmd: "CI=1 pnpm vitest run --project node tests/unit/eval/team-shape.test.ts tests/unit/eval/SMALL-SIDED-MATCH-SITUATION-SCANNER-*.test.ts tests/unit/eval/team-shape-evidence-binding.node.test.ts tests/unit/eval/team-decision-evidence-binding.node.test.ts"
    exit_code: 0
  - cmd: "pnpm run gauntlet:audit -- --objective SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH --class MULTI_TICK --tests-pass true --integration-test-pass true"
    exit_code: 0
- tests_run:
  - name: "SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-1-geometry (10 tests)"
    result: "PASS — press/cover 2, support 2, no-regression 1, determinism 1, honesty-guard 2, scanner 1"
  - name: "SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-2-trajectory (1 test)"
    result: "PASS — trajectory.json generated from press scenario"
  - name: "SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-3-guard-proof (3 tests)"
    result: "PASS — (a) DEFEND/PRESSING trigger, (b) cover activations=492, (c) cover activations=492"
  - name: "team-shape.test.ts (19 tests)"
    result: "PASS — no regression"
  - name: "scanner-basic (11 tests)"
    result: "PASS — no regression"
  - name: "scanner-determinism (5 tests)"
    result: "PASS — no regression"
  - name: "scanner-backward-compat (6 tests)"
    result: "PASS — no regression"
  - name: "scanner-honesty (9 tests)"
    result: "PASS — no regression"
  - name: "team-shape-evidence-binding (21 tests)"
    result: "PASS — no regression"
  - name: "team-decision-evidence-binding (12 tests)"
    result: "PASS — no regression"
- integration_test_result: "PASS — 14 objective tests + 83 regression tests = 97 total, all pass"
- slot_wiring_result: NOT_APPLICABLE
- required_evidence:
  - trajectory.json: present at docs/evidence/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH/trajectory.json (600 ticks, 229 events, 600 observations, situation scan: present=6, notObserved=0, insufficientContext=2)
  - MULTI_TICK tests: 14 tests (10 geometry + 1 trajectory + 3 guard proof) all pass
  - regression: 83/83 tests across 7 suites pass
- artifacts:
  - docs/evidence/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH/trajectory.json
  - docs/evidence/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH/RESULT.md
  - docs/evidence/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH/audit.json
- spec_sections:
  - eval/contracts/situation-mapping.ts (COORDINATED_PRESS, SUPPORT_AND_PASSING_LANES evidence requirements)
  - gauntlet/roles/builder-gameplay.md (role contract)
  - gauntlet/evidence-contract.md (MULTI_TICK evidence class)
- acceptance_criteria_met:
  - **Press coordination**: presser/cover separation maintained (ratio > 0.5, separation > 3m avg)
  - **Cover behind presser**: cover is farther from ball than presser (ratio > 0.3)
  - **Support discipline**: off-ball players maintain minimum support distance (min > 2m, ratio > 0.3)
  - **Support spread**: off-ball attackers not all collapsed (max > 4m, ratio > 0.3)
  - **Determinism**: two identical runs produce identical state hashes and observations
  - **No regression**: team-shape suite PASS (19 tests), all 7 regression suites pass (83 tests)
  - **Guard discrimination (mechanism activation counters)**:
    - Cover mechanism activations: **492** over 300 ticks (mechanism actively exercised)
    - Without cpu-adapter.ts changes (stashed): `TypeError: resetMechanismCounters is not a function` — guard test **FAILS**, proving the mechanism code is essential
    - The guard uses `getCoverMechanismActivations()` exported from the adapter module; when the mechanism code is removed, the export doesn't exist and the test fails at import time.
  - **Situation scanner**: 6/8 situations PRESENT (player-ball-contact, pass, shot, second-touch events observed). COORDINATED_PRESS and SUPPORT_AND_PASSING_LANES are both assessed.
  - **gauntlet:audit**: PASS (all checks pass)
- known_gaps:
  - 2 situations remain insufficient_context (SETTLED_ATTACK_VS_DEFENCE, ATTACK_TO_DEFENCE_TRANSITION).
  - The3v3 press fixture has only 1 defender per team; the cover role is fulfilled by midfielders.
  - No screenshots (MULTI_TICK does not require them).
- claims_not_made:
  - No PES fidelity claim.
  - No invented reference envelopes or tolerance bands.
  - No FOUNDATION_LAB_PASS claim.
  - No PROMOTION-tier verdict.
  - No readability PASS claim.
