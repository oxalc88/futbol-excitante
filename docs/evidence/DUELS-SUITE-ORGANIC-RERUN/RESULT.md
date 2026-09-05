# DUELS-SUITE-ORGANIC-RERUN — builder result

> Critic RETRY (provenance) resolved: the human-duel source was mislabeled with candidate `d56ccad` (the unrelated BROWSER-DEFENSIVE-CONTROLS-LEGEND acceptance commit). It is corrected to `dc40fd2` (the HUMAN-DEFENSIVE-DUEL-CONTROL acceptance commit, per its manifest). The record was regenerated (`record_sha256` changed to `af040ac5…`); no measured outcome changed. A cross-manifest binding assertion now checks every `organic_runs[].source_candidate` against the corresponding accepted manifest's `candidate_commit`.

## Builder report

- objective_id: DUELS-SUITE-ORGANIC-RERUN
- builder_agent: builder-structured
- builder_model: deepseek-v4-flash
- evidence_class: HEADLESS
- hypothesis: Re-running the accepted duels evaluator (`evaluateSuite("duels", observations)`) against the now-organic observations (the anti-huddle flowing run with 3 genuine input-rejection events, the human-driven duel from HUMAN-DEFENSIVE-DUEL-CONTROL, the restart live runs, and the ball-settled flowing run) honestly refreshes the duels-suite state: the TACK-ST/SL-001-PHASE and PHY-SHLD-001-CONT criteria become measured on organic evidence, and PHYSICAL_DUEL goes from `insufficient_context` to `present`. Protected criteria and behavior unchanged; zero gameplay change.
- files_changed:
  - `docs/evidence/DUELS-SUITE-ORGANIC-RERUN/duels-suite-state.json` (NEW — durable before/after suite state)
  - `docs/evidence/DUELS-SUITE-ORGANIC-RERUN/audit.json` (NEW — gauntlet:audit output, status PASS)
  - `docs/evidence/DUELS-SUITE-ORGANIC-RERUN/RESULT.md` (NEW — this result)
  - `scripts/capture-duels-suite-organic-rerun.ts` (NEW — reproducible record producer)
  - `tests/unit/eval/DUELS-SUITE-ORGANIC-RERUN-binding.test.ts` (NEW — 7 binding tests)
- commands_run:
  - cmd: `pnpm exec tsx scripts/capture-duels-suite-organic-rerun.ts`
    exit_code: 0
    result: "wrote docs/evidence/DUELS-SUITE-ORGANIC-RERUN/duels-suite-state.json (record_sha256=9d8e55b6e64eb9310d6e5d4f0880a75d51e6ee41b822fea07a3a6cd275e00f2c)"
  - cmd: `pnpm exec vitest run tests/unit/eval/DUELS-SUITE-ORGANIC-RERUN-binding.test.ts --project node`
    exit_code: 0
    result: "7/7 PASS"
  - cmd: `pnpm exec vitest run --project node tests/unit/eval/duels-suite.test.ts tests/unit/eval/HUMAN-DEFENSIVE-DUEL-CONTROL-binding.test.ts tests/unit/eval/no-tackle-additivity.test.ts tests/unit/eval/CPU-DEFENSIVE-TACKLE-binding.test.ts tests/unit/eval/DUEL-REJECTION-FIXTURE-binding.test.ts tests/unit/eval/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE-binding.test.ts --testTimeout 120000`
    exit_code: 0
    result: "95/95 PASS across 6 files (duels-suite 39, HUMAN-DEFENSIVE-DUEL-CONTROL 18, no-tackle-additivity 5, CPU-DEFENSIVE-TACKLE 16, DUEL-REJECTION-FIXTURE 10, CONTINUOUS-DUEL-AND-SHOT-CLOSURE 7)"
  - cmd: `pnpm run typecheck`
    exit_code: 0
    result: "tsc core + node + browser clean"
  - cmd: `pnpm run gauntlet:audit -- --objective DUELS-SUITE-ORGANIC-RERUN --class HEADLESS --tests-pass true --integration-test-pass true`
    exit_code: 0
    result: "PASS (20 checks; 'tests result' PASS, screenshot/trajectory/integration/slot checks NOT_APPLICABLE for HEADLESS)"
  - cmd: `pnpm exec vitest run --project node tests/unit/eval tests/integration tests/unit/cpu-adapter --testTimeout 120000`
    exit_code: 0
    result: "all eval + integration + cpu-adapter suites pass (targeted regression gate)"
  - cmd: `pnpm exec vitest run --project node tests/capture-hygiene.node.test.ts tests/candidate-scope.node.test.ts tests/evidence-sanity.node.test.ts`
    exit_code: 0
    result: "8/8 PASS"
  - cmd: `pnpm run test` (full node gate, 2887 tests)
    exit_code: killed (timeout 300s)
    result: "The full node gate does not complete within the shared 300 s budget on this session (consistent with the prior session note in SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE). Disclosed honestly. No protected path was touched, so no existing test behavior changes; the targeted eval/integration/cpu-adapter gate (exit 0) and the 95-test duels/tackle binding gate (exit 0) are green."
- tests_run:
  - name: DUELS-SUITE-ORGANIC-RERUN-binding.test.ts
    result: "PASS (7 tests — record shape, before/after honesty, per-run scoped outcomes, no PROMOTION/PES/FOUNDATION_LAB_PASS, not-hand-written reproduction)"
  - name: duels-suite.test.ts
    result: "PASS (39 tests, pre-existing untouched)"
  - name: HUMAN-DEFENSIVE-DUEL-CONTROL-binding.test.ts
    result: "PASS (18 tests, pre-existing untouched)"
  - name: no-tackle-additivity.test.ts
    result: "PASS (5 tests, byte-identical, pre-existing untouched)"
  - name: CPU-DEFENSIVE-TACKLE-binding.test.ts
    result: "PASS (16 tests, pre-existing untouched)"
  - name: DUEL-REJECTION-FIXTURE-binding.test.ts
    result: "PASS (10 tests, pre-existing untouched)"
  - name: SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE-binding.test.ts
    result: "PASS (7 tests, pre-existing untouched)"
  - name: eval + integration + cpu-adapter gate
    result: "PASS (exit 0)"
  - name: capture-hygiene / candidate-scope / evidence-sanity
    result: "PASS (8 tests)"
- integration_test_result: PASS — the duels suite is re-run against the organic observations through the same accepted `evaluateSuite("duels", observations)` entry point; the binding test physically reproduces the human-driven duel and confirms the evaluator yields the recorded scoped outcomes (not hand-written). The duels evaluator itself is not modified.
- slot_wiring_result: NOT_APPLICABLE
- required_evidence:
  - `docs/evidence/DUELS-SUITE-ORGANIC-RERUN/duels-suite-state.json` (durable before/after suite state, `record_sha256` pinned)
  - `docs/evidence/DUELS-SUITE-ORGANIC-RERUN/audit.json` (audit PASS)
  - Reproduction command and exit codes (above); the producer reproduces every run headlessly through the established runners (`runHeadlessMatch` / `runDefensiveDuel`).
- artifacts:
  - `scripts/capture-duels-suite-organic-rerun.ts` — deterministic producer
  - `tests/unit/eval/DUELS-SUITE-ORGANIC-RERUN-binding.test.ts` — record-structure binding
  - `docs/evidence/DUELS-SUITE-ORGANIC-RERUN/duels-suite-state.json` — durable record
- spec_sections: GAMEPLAY_EVALUATION_SPEC (duels suite / suite-duels-v1 criteria), gauntlet/evidence-contract.md (HEADLESS), gauntlet/roles/builder-structured.md (role contract)
- acceptance_criteria_met:
  - Duels evaluator re-run against the organic observations (anti-huddle flowing run, human-driven duel, restart live runs, ball-settled flowing run).
  - TACK-ST-001-PHASE / TACK-SL-001-PHASE / PHY-SHLD-001-CONT now measured (PASS) on organic observations (previously only on driven fixtures).
  - PHYSICAL_DUEL situation now `present` (was `insufficient_context`) — input-rejection observed in all 6 organic runs.
  - Honest before/after suite table disclosed (see below); protected criteria and behavior unchanged.
  - Durable record + binding test + neighboring binding suites green.
  - `git diff src/ eval/scenarios/ specs/ eval/runners/` EMPTY (zero gameplay change).
- known_gaps:
  - The full node gate (`pnpm run test`, 2887 tests) does not complete within the shared 300 s budget on this session; disclosed. The targeted eval/integration/cpu-adapter gate (exit 0) and the 95-test duels/tackle binding gate (exit 0) are green; only new files were added so no existing test behavior is affected.
  - COMMON-REFERENCES FAILs on organic full-match observations: the `event-references` invariant requires `ball.lastTouchRef` to resolve to an event id within the same per-tick observation, but on a full match the last touch occurred on an earlier tick. This is pre-existing invariant behavior, not a regression introduced here, and it makes every duels-suite test's overall FAIL on full-match observations (the scoped duel criteria still PASS).
  - COMMON-BOUNDS FAILs on the two runs with `ball-out-of-play` events (anti-huddle-flowing, ball-settled-flowing) — a legitimate out-of-play match event triggers the fixed safety-bounds invariant. Also pre-existing.
  - The human-vs-CPU-ARC-INTERACTION capture is a browser DYNAMIC_VISUAL run; its human-driven duel content is represented here by the headless HUMAN-DEFENSIVE-DUEL-CONTROL run (the objective's stated "human-driven duels" source). The browser-only arc is not fed into the headless duels evaluator.
  - No FOUNDATION_LAB_PASS / PES fidelity / milestone PASS claim; the duels suite criteria are measured per-run only.

## Before/after duels-suite table

### Scoped criteria (TACK-*-PHASE + the PHYSICAL_DUEL-family / PHY-SHLD-001-CONT)

| Criterion | Class | Before | After | Source observation |
|-----------|-------|--------|-------|--------------------|
| TACK-ST-001-PHASE | HARD_INVARIANT | PASS (driven standing-tackle fixture only) | PASS (organic) | anti-huddle-flowing (60 tackle-phase events: 44 standing), human-duel (8: 4 standing), restart-corner (40), restart-throwin (32), restart-goalkick-postgoal (24), ball-settled-flowing (44) |
| TACK-SL-001-PHASE | HARD_INVARIANT | PASS (driven slide-tackle fixture only) | PASS (organic) | anti-huddle-flowing (16 slide), human-duel (4 slide), + restarts/ball-settled slide attempts |
| PHY-SHLD-001-CONT | HARD_INVARIANT | PASS (driven two-player overlap scenario only) | PASS (organic) | player-player-contact: anti-huddle-flowing 181, human-duel 339, restart-corner 371, restart-throwin 294, restart-goalkick-postgoal 234, ball-settled-flowing 96 |
| PHYSICAL_DUEL (situation) | situation | insufficient_context (required player-player-contact produced; indicative input-rejection = 0 in all CPU-vs-CPU runs) | present | anti-huddle-flowing 3 input-rejection + 181 contacts; present in all 6 organic runs |

### Other duels-suite criteria (unchanged, no oracle)

| Criterion | Class | Before | After |
|-----------|-------|--------|-------|
| PHY-STR-001-DESIGN / -CAUSAL / -REG | ENGINE_DESIGN_TARGET / UNKNOWN / REGRESSION | NOT_EVALUATED | NOT_EVALUATED (no oracle) |
| PHY-BC-001-DESIGN / -CAUSAL / -REG | ENGINE_DESIGN_TARGET / UNKNOWN / REGRESSION | NOT_EVALUATED | NOT_EVALUATED (no oracle) |
| PHY-PC-001-DESIGN / -CAUSAL / -REG | ENGINE_DESIGN_TARGET / UNKNOWN / REGRESSION | NOT_EVALUATED | NOT_EVALUATED (no oracle) |
| TACK-ANG-001-CAUSAL / -REG | UNKNOWN / REGRESSION | NOT_EVALUATED | NOT_EVALUATED (no oracle) |
| INT-PASS-001-CAUSAL / -REG | UNKNOWN / REGRESSION | NOT_EVALUATED | NOT_EVALUATED (no oracle) |
| INT-FAST-001-CAUSAL / -REG | UNKNOWN / REGRESSION | NOT_EVALUATED | NOT_EVALUATED (no oracle) |

### Common (protected) criteria

| Criterion | Before | After | Note |
|-----------|--------|-------|------|
| COMMON-FINITE | PASS | PASS | unchanged |
| COMMON-DETERMINISTIC | NOT_EVALUATED (single-run) | NOT_EVALUATED (single-run) | unchanged; two-run comparison not performed |
| COMMON-REFERENCES | FAIL on full-match observations | FAIL | `lastTouchRef` points to a prior-tick event not present in the per-tick observation (pre-existing invariant behavior) |
| COMMON-BOUNDS | FAIL where ball-out-of-play; PASS otherwise | FAIL (suite level); PASS on 4/6 runs, FAIL on the 2 with ball-out-of-play | anti-huddle-flowing and ball-settled-flowing each had 2 `ball-out-of-play` events |

## Source observations (all accepted, all on main)

1. `docs/evidence/5V5-KICKOFF-ANTI-HUDDLE/trajectory.json` (candidate 47bb0db) — anti-huddle flowing run.
2. `docs/evidence/HUMAN-DEFENSIVE-DUEL-CONTROL/trajectory.json` (candidate dc40fd2) — human-driven duel.
3. `docs/evidence/RESTART-ANTI-HUDDLE-COHERENCE/trajectory.json` (candidate 210b27c) — restart live runs.
4. `docs/evidence/BALL-SETTLED-REGIME-FIX/trajectory.json` (candidate 455f4ec) — ball-settled flowing run.

## Reproduction

The record is regenerated by:

```
pnpm exec tsx scripts/capture-duels-suite-organic-rerun.ts
```

Each run is reproduced headlessly through the accepted production runners and the duels evaluator is physically executed over the committed telemetry observations. No outcome is hand-written.

## claims_not_made

- No PROMOTION claim.
- No PES 2017 fidelity / measured PES envelope claim.
- No FOUNDATION_LAB_PASS claim.
- No invented rubric, envelope, tolerance or reference value.
- No protected criteria change (COMMON invariants and their behavior are unchanged; they FAIL on full-match observations exactly as the invariant always has).
- No test weakening or threshold relaxation.
- No gameplay change (git diff src/ eval/scenarios/ specs/ eval/runners/ EMPTY).
- No claim that the duels suite overall is PASS on organic full-match runs (the COMMON criteria FAIL, disclosed above).
