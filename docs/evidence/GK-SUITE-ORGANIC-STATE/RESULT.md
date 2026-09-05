# GK-SUITE-ORGANIC-STATE — builder result

## Builder report

- **objective_id:** GK-SUITE-ORGANIC-STATE
- **builder_agent:** builder-structured
- **builder_model:** deepseek-v4-flash
- **evidence_class:** HEADLESS
- **hypothesis:** Re-running the accepted `goalkeepers` evaluator suite (`evaluateSuite("goalkeepers", observations)`) over the organic observations that now include designated small-sided keepers (the accepted GK arc runs with the keeper role live) honestly refreshes the goalkeepers-suite state. Because the `goalkeepers` criteria are **protected** (no oracle/catalog/invariant/observation change), the five small-sided GK behavior criteria stay genuinely `NOT_EVALUATED` by the executable suite even though organic arc-hold / no-field-chase / designation observations now exist; the honest change is in the bookkeeping (which criteria now carry organic vs. driven observations) and in the COMMON criteria, which FAIL over the organic full-match runs exactly as the pre-existing invariant always has. No GK criterion is upgraded to gameplay `PASS`. Zero gameplay change.

### files_changed

- `scripts/capture-gk-suite-organic-state.ts` (NEW — reproducible record producer; WIP_SECTION-gated durable write)
- `docs/evidence/GK-SUITE-ORGANIC-STATE/gk-suite-state.json` (NEW — durable before/after suite state, `record_sha256` pinned)
- `docs/evidence/GK-SUITE-ORGANIC-STATE/audit.json` (NEW — `gauntlet:audit` output, status `PASS`)
- `docs/evidence/GK-SUITE-ORGANIC-STATE/RESULT.md` (NEW — this result)
- `tests/unit/eval/GK-SUITE-ORGANIC-STATE-binding.test.ts` (NEW — 8 binding tests)

**Zero changes** to `src/`, `src/simulation/`, `src/contracts/`, `eval/runners/`, `eval/scenarios/`, or `specs/` (verified: `git diff -- src/ src/simulation/ src/contracts/ eval/runners/ eval/scenarios/ specs/` is empty). No evaluator, catalog, invariant, oracle, or scenario was touched.

### commands_run

- cmd: `WIP_SECTION=__EVIDENCE__:GK-SUITE-ORGANIC-STATE pnpm exec tsx scripts/capture-gk-suite-organic-state.ts`
    exit_code: 0
    result: "wrote docs/evidence/GK-SUITE-ORGANIC-STATE/gk-suite-state.json (record_sha256=28e584a4f7a24541bf030319cff84988a01c728de8db0873c636ee5b462461aa; 2 organic GK runs reproduced headlessly and evaluated)"
- cmd: `pnpm exec vitest run tests/unit/eval/GK-SUITE-ORGANIC-STATE-binding.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "8/8 PASS"
- cmd: `pnpm exec vitest run tests/unit/eval/goalkeepers-suite.test.ts tests/unit/eval/eval-registry.test.ts tests/unit/eval/duels-suite.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "111/111 PASS across 3 files (goalkeepers-suite 24, eval-registry 48, duels-suite 39)"
- cmd: `mise run typecheck`
    exit_code: 0
    result: "tsc core + node + browser clean"
- cmd: `pnpm run gauntlet:audit -- --objective GK-SUITE-ORGANIC-STATE --class HEADLESS --tests-pass true --integration-test-pass true`
    exit_code: 0
    result: "status PASS (tests result PASS; screenshot/trajectory/integration/slot checks NOT_APPLICABLE for HEADLESS; all gauntlet-state checks PASS)"
- cmd: `pnpm exec vitest run tests/candidate-scope.node.test.ts tests/capture-hygiene.node.test.ts tests/evidence-sanity.node.test.ts --project node --testTimeout 300000`
    exit_code: 0
    result: "8/8 PASS (candidate-scope 2, capture-hygiene 3, evidence-sanity 3)"

### tests_run

- name: `GK-SUITE-ORGANIC-STATE-binding.test.ts`
    result: "PASS (8 tests — record shape, before-state honesty, after-state no-upgrade + observations bookkeeping, COMMON FAIL disclosure, cross-manifest source_candidate binding, PROMOTION/PES/FOUNDATION_LAB_PASS negative control, not-hand-written reproduction)"
- name: `goalkeepers-suite.test.ts`
    result: "PASS (24 tests, pre-existing untouched)"
- name: `eval-registry.test.ts`
    result: "PASS (48 tests, pre-existing untouched)"
- name: `duels-suite.test.ts`
    result: "PASS (39 tests, pre-existing untouched)"
- name: `candidate-scope.node.test.ts`
    result: "PASS (2 tests)"
- name: `capture-hygiene.node.test.ts`
    result: "PASS (3 tests — ordinary runs leave docs/ byte-identical; durable capture gated)"
- name: `evidence-sanity.node.test.ts`
    result: "PASS (3 tests)"

### integration_test_result

For `HEADLESS`, the audit marks the integration-test check `NOT_APPLICABLE` (integration evidence is required only for `MULTI_TICK`/`DYNAMIC_VISUAL`). A relevant integration/provenance check was still exercised: the `GK-SUITE-ORGANIC-STATE-binding.test.ts` "not hand-written" test physically reproduces the driven keeper fixture run through the production runner and the accepted `evaluateSuite("goalkeepers", ...)` entry point and confirms the evaluator yields the recorded per-run outcomes (not hand-written).

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing.

### required_evidence

- Deterministic audit: `docs/evidence/GK-SUITE-ORGANIC-STATE/audit.json` (status `PASS`).
- Executed tests (HEADLESS): the binding test (8) and the 111-test neighboring evaluator gate.
- Durable before/after suite state: `docs/evidence/GK-SUITE-ORGANIC-STATE/gk-suite-state.json` (`record_sha256` 28e584a4…).

### artifacts

- `docs/evidence/GK-SUITE-ORGANIC-STATE/gk-suite-state.json`
- `docs/evidence/GK-SUITE-ORGANIC-STATE/audit.json`
- `docs/evidence/GK-SUITE-ORGANIC-STATE/RESULT.md`

### spec_sections

- `specs/GOALKEEPER_SPEC.md` §4–§8 and §11 (designation, goal-arc hold, no-field-chase, save/claim, distribution, evaluator suite contract); §10 (BLOCKED_MISSING_REFERENCE values).
- `eval/contracts/goalkeeper-config.ts` (versioned provisional `gk-small-sided-v1`; 5 BLOCKED_MISSING_REFERENCE values).
- `eval/contracts/common-criteria.ts` (§7.4 catalog + small-sided GK behavior criteria), `eval/contracts/suites.ts` (suite-goalkeepers-v1), `eval/contracts/bindings.ts` (GK bindings).
- `gauntlet/evidence-contract.md` (HEADLESS), `gauntlet/roles/builder-structured.md` (role contract).

### acceptance_criteria_met

- `goalkeepers` evaluator re-run over the organic observations that now include keepers (headless continuous-live + driven shot-fixture-live, both with `gkBehavior: true`).
- Honest per-criterion outcomes: the five small-sided GK behavior criteria stay `NOT_EVALUATED` (no protected oracle for them), with observations-presence bookkeeping distinguishing organic arc-hold evidence (GK-POSITIONING-HOLD / GK-NO-FIELD-CHASE / GK-ROLE-DESIGNATION) from driven-fixture-only evidence (GK-SAVE-CLAIM) and no-observation (GK-DISTRIBUTION-NO-OMNISCIENCE).
- COMMON-REFERENCES / COMMON-BOUNDS now FAIL over the organic full-match runs (pre-existing invariant behavior, disclosed, not a keeper regression); COMMON-FINITE stays PASS.
- Missing references stay `BLOCKED_MISSING_REFERENCE`; no invented envelope/tolerance.
- Cross-manifest `source_candidate` provenance pins (read from accepted manifests, never guessed).
- Durable record + binding test + neighboring evaluator suites green; `git diff src/ src/simulation/ src/contracts/ eval/runners/ eval/scenarios/ specs/` EMPTY.

---

## Before/after goalkeepers-suite table

### Small-sided GK behavior criteria (GOALKEEPER_SPEC §4–§8)

| Criterion | Class | Before | After (verdict) | Observations present | Why still not PASS |
|-----------|-------|--------|-----------------|----------------------|--------------------|
| GK-POSITIONING-HOLD | HARD_INVARIANT | NOT_EVALUATED | NOT_EVALUATED | **organic** (both GK runs: keeper commanded onto + holds its goal arc, bounded lateral drift) | No protected oracle is registered for this criterion |
| GK-NO-FIELD-CHASE | HARD_INVARIANT | NOT_EVALUATED | NOT_EVALUATED | **organic** (keeper never chaser/presser/cover/restart-taker in both GK runs; inherits anti-huddle) | No protected oracle is registered for this criterion |
| GK-SAVE-CLAIM | HARD_INVARIANT | NOT_EVALUATED | NOT_EVALUATED | **driven (fixture) only** (controlled 5v5-keeper-shot-fixture run; the organic flowing match's on-target shots were answered by another body first, 0 save chains) | Evidence is fixture-driven (disclosed) and no oracle is registered |
| GK-ROLE-DESIGNATION | HARD_INVARIANT | NOT_EVALUATED | NOT_EVALUATED | **organic** (exactly one keeper per team, team-a→player-4, team-b→player-10, frozen, drift 0) | No protected oracle is registered for this criterion |
| GK-DISTRIBUTION-NO-OMNISCIENCE | ENGINE_DESIGN_TARGET | NOT_EVALUATED | NOT_EVALUATED | **none** (no keeper-release event kind in core telemetry; adapter-level counters only) | No CapabilityDesignProfile + no oracle |

### §7.4 catalog criteria (unchanged, no oracle / no reference)

| Criterion family | Before | After |
|------------------|--------|-------|
| GK-*-REF (MEASURED_TARGET) | BLOCKED_MISSING_REFERENCE | BLOCKED_MISSING_REFERENCE |
| GK-*-VIS (PERCEPTUAL_TARGET) | NEEDS_PERCEPTUAL_REVIEW | NEEDS_PERCEPTUAL_REVIEW |
| GK-*-REG (REGRESSION) | NOT_EVALUATED | NOT_EVALUATED |
| GK-WF-001-CAUSAL (UNKNOWN) | NOT_EVALUATED | NOT_EVALUATED |

### Common (protected) criteria

| Criterion | Before (foundation-move-and-roll) | After (organic GK full-match runs) | Note |
|-----------|-------------------------------------|------------------------------------|------|
| COMMON-FINITE | PASS | PASS | unchanged |
| COMMON-DETERMINISTIC | NOT_EVALUATED (single-run) | NOT_EVALUATED (single-run) | two-run comparison not performed |
| COMMON-REFERENCES | PASS | FAIL | `lastTouchRef` points to a prior-tick event not present in the per-tick observation (pre-existing invariant behavior on full-match runs) |
| COMMON-BOUNDS | PASS | FAIL | ball-out-of-play events trip the fixed safety-bounds invariant (pre-existing invariant behavior on full-match runs) |

---

## Source observations (all accepted, all on main)

Pins read verbatim from each accepted `docs/evidence/<id>/manifest.json` `candidate_commit` (never guessed).

1. `docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/trajectory.json` (candidate `40aa0dae902a1e7c1375c2444304296d10116bf9`) — headless MULTI_TICK keeper runs, reproduced headlessly and evaluated here:
   - `gk-continuous-live` (5v5-continuous-play, 1800 ticks, gk=true) — organic arc-hold / no-field-chase / designation.
   - `gk-shot-fixture-live` (5v5-keeper-shot-fixture, 600 ticks, gk=true) — driven save-claim fixture.
2. `docs/evidence/GK-BROWSER-DYNAMIC-EVIDENCE/trajectory.json` (candidate `fd6de8d99553d490f50f1462efa83e3a96703a8f`) — browser DYNAMIC_VISUAL fixture run (arc-hold + save-contact@370). Its Chromium-runtime observations are **not** fed into the Node headless evaluator (known pinned-runtime gap); its keeper content is reflected by the headless `gk-shot-fixture-live` run and disclosed in `sources_consulted`.

## Reproduction

The record is regenerated by:

```
WIP_SECTION=__EVIDENCE__:GK-SUITE-ORGANIC-STATE \
  pnpm exec tsx scripts/capture-gk-suite-organic-state.ts
```

Each headless organic run is reproduced through the same exported production runner the accepted GK evidence used (`runHeadlessMatch` with `gkBehavior: true`, `browserParityObservations: true`, `lifecyclePhaseSync: 'legacy'`) and the `goalkeepers` suite is physically executed over the committed telemetry observations. No outcome is hand-written.

## claims_not_made

- No PROMOTION claim.
- No GK criterion is upgraded to gameplay `PASS` beyond what the executed evaluator actually returns (all five small-sided GK behavior criteria stay `NOT_EVALUATED`; the protected `goalkeepers` criteria are re-run, not redefined).
- No PES 2017 fidelity / measured PES envelope claim.
- No FOUNDATION_LAB_PASS claim.
- No invented reference envelope or tolerance: reaction latency, save probability distribution, wrong-foot reversal, high-cross claim threshold, and parry energy ratio all stay `BLOCKED_MISSING_REFERENCE`.
- No protected criteria change: no oracle / catalog / invariant / observation change; the `goalkeepers` suite criteria are only re-run over the organic observations.
- No gameplay change: `git diff src/ src/simulation/ src/contracts/ eval/runners/ eval/scenarios/ specs/` EMPTY.
- No claim that the `goalkeepers` suite overall is PASS: the COMMON-REFERENCES and COMMON-BOUNDS criteria FAIL on the organic full-match runs (pre-existing invariant behavior, disclosed).
