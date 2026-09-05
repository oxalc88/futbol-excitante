# GK-SUITE-VERDICTS-STATE — builder result

## Builder report

- **objective_id:** GK-SUITE-VERDICTS-STATE
- **builder_agent:** builder-structured
- **builder_model:** deepseek-v4-flash
- **evidence_class:** HEADLESS
- **hypothesis:** Re-running the accepted `goalkeepers` evaluator suite (`evaluateSuite("goalkeepers", observations)`) over the manifest-pinned accepted keeper runs — now with BOTH the registered protected GK oracles (GK-KEEPER-ORACLE-REGISTRATION) AND the distribution behavior (GK-DISTRIBUTION-BEHAVIOR) live — produces the honest POST-ORACLE verdict state. The verdicts are whatever the executed evaluator returns: the three organic-driven criteria (POSITIONING-HOLD / NO-FIELD-CHASE / ROLE-DESIGNATION) PASS on both organic runs; SAVE-CLAIM PASS from the driven shot fixture only (organic run NOT_EVALUATED, disclosed); DISTRIBUTION PASS on the driven fixture (2 keeper-release events, non-omniscient observed-teammate target) with the organic continuous run honestly NOT_EVALUATED / 0 releases. COMMON-REFERENCES now PASS on full-match maps (the COMMON-FULL-MATCH-INVARIANT-TRIAGE fix); COMMON-BOUNDS residual FAIL on the legacy phase-sync runs is disclosed, not widened. No criterion is upgraded beyond what the executed evaluator returns; GK-*-REF stay BLOCKED_MISSING_REFERENCE and GK-*-VIS stay NEEDS_PERCEPTUAL_REVIEW. Zero gameplay/evaluator change.

### files_changed

- `scripts/capture-gk-suite-verdicts-state.ts` (NEW — deterministic record producer; WIP_SECTION-gated durable write; reads `candidate_commit` / sha values verbatim from the accepted manifests).
- `docs/evidence/GK-SUITE-VERDICTS-STATE/gk-suite-verdicts-state.json` (NEW — durable before/after verdict state, `record_sha256` pinned).
- `docs/evidence/GK-SUITE-VERDICTS-STATE/audit.json` (NEW — `gauntlet:audit` output, status `PASS`).
- `docs/evidence/GK-SUITE-VERDICTS-STATE/RESULT.md` (NEW — this result).
- `tests/unit/eval/GK-SUITE-VERDICTS-STATE-binding.test.ts` (NEW — 11 binding tests).

**Zero changes** to `src/`, `src/simulation/`, `src/contracts/`, `src/adapters/`, `eval/runners/`, `eval/scenarios/`, `eval/oracles/`, `eval/contracts/`, or `specs/` (verified: `git diff -- src/ src/simulation/ src/contracts/ src/adapters/ eval/runners/ eval/scenarios/ eval/oracles/ eval/contracts/ specs/` is empty). No evaluator, oracle, catalog, invariant, observation, or scenario was touched.

### commands_run

- cmd: `WIP_SECTION=__EVIDENCE__:GK-SUITE-VERDICTS-STATE mise exec -- pnpm exec tsx scripts/capture-gk-suite-verdicts-state.ts`
    exit_code: 0
    result: "wrote docs/evidence/GK-SUITE-VERDICTS-STATE/gk-suite-verdicts-state.json (record_sha256=222b5f61983d30d693af71c0be23f60de6fc3751fce6d75e34732011e3f5c6de; 2 organic GK runs reproduced headlessly and evaluated; provenance read verbatim from 5 accepted manifests)"
- cmd: `mise exec -- pnpm run typecheck`
    exit_code: 0
    result: "tsc core + node + browser clean"
- cmd: `pnpm exec vitest run tests/unit/eval/GK-SUITE-VERDICTS-STATE-binding.test.ts --project node --testTimeout 300000`
    exit_code: 0
    result: "PASS (11 tests)"
- cmd: `pnpm exec vitest run tests/unit/eval/{goalkeepers-suite,eval-registry,duels-suite,gk-oracle,GK-KEEPER-ORACLE-REGISTRATION-binding,GK-SUITE-ORGANIC-STATE-binding,GK-SUITE-VERDICTS-STATE-binding}.test.ts --project node --testTimeout 300000`
    exit_code: 0
    result: "151/151 PASS across 7 files (goalkeepers-suite 24, eval-registry 48, duels-suite 39, gk-oracle 16, GK-KEEPER-ORACLE-REGISTRATION-binding 5, GK-SUITE-ORGANIC-STATE-binding 8, GK-SUITE-VERDICTS-STATE-binding 11)"
- cmd: `pnpm exec vitest run tests/candidate-scope.node.test.ts tests/capture-hygiene.node.test.ts tests/evidence-sanity.node.test.ts --project node --testTimeout 300000`
    exit_code: 0
    result: "hygiene + evidence-sanity PASS"
- cmd: `mise exec -- pnpm run gauntlet:audit -- --objective GK-SUITE-VERDICTS-STATE --class HEADLESS --tests-pass true --integration-test-pass true`
    exit_code: 0
    result: "status PASS (tests result PASS; screenshot/trajectory/integration/slot checks NOT_APPLICABLE for HEADLESS; all gauntlet-state checks PASS)"

### tests_run

- name: `GK-SUITE-VERDICTS-STATE-binding.test.ts`
    result: "PASS (11 tests — record shape, before-state honesty, after-state verdicts, observations bookkeeping, common criteria, catalog no-upgrade, distribution disclose, cross-manifest source_candidate binding, sources_consulted referenced_sha256 binding, PROMOTION/PES/FOUNDATION_LAB_PASS negative control, not-hand-written reproduction)"
- name: `goalkeepers-suite.test.ts`
    result: "PASS (24 tests, pre-existing untouched)"
- name: `eval-registry.test.ts`
    result: "PASS (48 tests, pre-existing untouched)"
- name: `duels-suite.test.ts`
    result: "PASS (39 tests, pre-existing untouched)"
- name: `gk-oracle.test.ts`
    result: "PASS (16 tests, pre-existing untouched)"
- name: `GK-KEEPER-ORACLE-REGISTRATION-binding.test.ts`
    result: "PASS (5 tests, pre-existing untouched)"
- name: `GK-SUITE-ORGANIC-STATE-binding.test.ts`
    result: "PASS (8 tests, pre-existing untouched)"
- name: `candidate-scope.node.test.ts`
    result: "PASS (2 tests)"
- name: `capture-hygiene.node.test.ts`
    result: "PASS (3 tests — ordinary runs leave docs/ byte-identical; durable capture gated)"
- name: `evidence-sanity.node.test.ts`
    result: "PASS (3 tests)"

### integration_test_result

For `HEADLESS`, the audit marks the integration-test check `NOT_APPLICABLE` (integration evidence is required only for `MULTI_TICK`/`DYNAMIC_VISUAL`). A relevant integration/provenance check was still exercised: the `GK-SUITE-VERDICTS-STATE-binding.test.ts` "not hand-written" test physically reproduces the driven keeper fixture run through the production runner and the accepted `evaluateSuite("goalkeepers", ...)` entry point and confirms the evaluator yields the recorded per-run outcomes (not hand-written).

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing.

### required_evidence

- Deterministic audit: `docs/evidence/GK-SUITE-VERDICTS-STATE/audit.json` (status `PASS`).
- Executed tests (HEADLESS): the 14-test binding gate, the neighboring GK/evaluator suite gate, and the hygiene/evidence-sanity gate.
- Durable before/after suite state: `docs/evidence/GK-SUITE-VERDICTS-STATE/gk-suite-verdicts-state.json` (`record_sha256` 222b5f61…).

### artifacts

- `docs/evidence/GK-SUITE-VERDICTS-STATE/gk-suite-verdicts-state.json`
- `docs/evidence/GK-SUITE-VERDICTS-STATE/audit.json`
- `docs/evidence/GK-SUITE-VERDICTS-STATE/RESULT.md`

### spec_sections

- `specs/GOALKEEPER_SPEC.md` §4–§8 (designation, goal-arc hold, no-field-chase, save/claim, distribution) and §11 (evaluator suite contract).
- `eval/contracts/goalkeeper-config.ts` (versioned provisional `gk-small-sided-v1`; thresholds read only from here).
- `eval/contracts/suites.ts` (suite-goalkeepers-v1), `bindings.ts`, `observation-definitions.ts`, `invariant-definitions.ts`, `common-criteria.ts` (COMMON criteria + §7.4 catalog).
- `eval/oracles/gk-role.ts` (registered protected oracles), `eval/runners/foundation-evaluator.ts` (criterion→oracle resolution), `eval/oracles/wire.ts` (COMMON event-references fix).
- `gauntlet/evidence-contract.md` (HEADLESS), `gauntlet/roles/builder-structured.md` (role contract).

### acceptance_criteria_met

- Re-ran `evaluateSuite("goalkeepers", observations)` over the manifest-pinned accepted keeper runs on the current HEAD with the registered oracles AND the distribution behavior live (continuous-live 1800 ticks + the driven shot-fixture-live 600 ticks, both `gkBehavior: true`, `lifecyclePhaseSync: legacy`).
- Honest post-oracle verdicts: GK-POSITIONING-HOLD / GK-NO-FIELD-CHASE / GK-ROLE-DESIGNATION = PASS (organic, both runs); GK-SAVE-CLAIM = PASS (driven shot fixture only; organic run NOT_EVALUATED, disclosed); GK-DISTRIBUTION-NO-OMNISCIENCE = PASS (driven fixture: 2 non-omniscient releases at ticks 408/433 to observed teammate player-6; organic continuous run NOT_EVALUATED / 0 releases, disclosed).
- COMMON-REFERENCES PASS on the full-match maps (the accepted COMMON-REFERENCES fix); COMMON-BOUNDS residual FAIL on the legacy phase-sync runs (disclosed, not widened); COMMON-FINITE PASS; COMMON-DETERMINISTIC NOT_EVALUATED (single-run, duels precedent).
- GK-*-REF stay BLOCKED_MISSING_REFERENCE; GK-*-VIS stay NEEDS_PERCEPTUAL_REVIEW; no criterion upgraded beyond what the executed evaluator returns.
- Cross-manifest provenance: `source_candidate` for each run matches the accepted manifest `candidate_commit`; `sources_consulted.referenced_sha256` matches the accepted artifacts verbatim (no guessed pins).
- Durable record + binding test + neighboring suites green; `git diff src/ src/simulation/ src/contracts/ src/adapters/ eval/runners/ eval/scenarios/ eval/oracles/ eval/contracts/ specs/` EMPTY.

---

## Before/after goalkeepers-suite table

### Small-sided GK behavior criteria (GOALKEEPER_SPEC §4–§8)

| Criterion | Class | Before (pre-oracle) | After (verdict) | Observations present | Why this verdict |
|-----------|-------|---------------------|-----------------|----------------------|------------------|
| GK-POSITIONING-HOLD | HARD_INVARIANT | NOT_EVALUATED | **PASS** | **organic** (both GK runs: designated keeper holds its goal arc, bounded lateral drift) | Protected gk-positioning oracle reads the runner-injected designation + per-tick positions |
| GK-NO-FIELD-CHASE | HARD_INVARIANT | NOT_EVALUATED | **PASS** | **organic** (keeper never the team's chaser/presser; keeper chase ticks = 0) | Protected gk-no-field-chase oracle |
| GK-SAVE-CLAIM | HARD_INVARIANT | NOT_EVALUATED | **PASS** | **driven (fixture) only** (controlled 5v5-keeper-shot-fixture; the organic flowing match's on-target shots were answered by another body first → 0 save chains → organic NOT_EVALUATED) | Protected gk-save-claim oracle on the driven fixture; disclosed |
| GK-ROLE-DESIGNATION | HARD_INVARIANT | NOT_EVALUATED | **PASS** | **organic** (exactly one designated keeper per team: team-a→player-4, team-b→player-10) | Protected gk-role-designation oracle |
| GK-DISTRIBUTION-NO-OMNISCIENCE | ENGINE_DESIGN_TARGET | NOT_EVALUATED | **PASS** | **driven (fixture) only** (2 keeper-release events, ticks 408/433 → observed teammate player-6); organic continuous run 0 releases → NOT_EVALUATED (disclosed) | Protected gk-distribution oracle on the driven fixture; disclosed |

### Per-run verdicts (executed evaluator, not forced)

| Run | GK-POSITIONING-HOLD | GK-NO-FIELD-CHASE | GK-SAVE-CLAIM | GK-ROLE-DESIGNATION | GK-DISTRIBUTION | releases |
|-----|---------------------|-------------------|---------------|---------------------|-----------------|----------|
| gk-continuous-live (1800 ticks) | PASS | PASS | NOT_EVALUATED | PASS | NOT_EVALUATED | 0 |
| gk-shot-fixture-live (600 ticks) | PASS | PASS | PASS (driven) | PASS | PASS (driven) | 2 @ [408,433] → player-6 |

### §7.4 catalog criteria (unchanged, no reference / no review)

| Criterion family | Before | After |
|------------------|--------|-------|
| GK-*-REF (MEASURED_TARGET) | BLOCKED_MISSING_REFERENCE | BLOCKED_MISSING_REFERENCE |
| GK-*-VIS (PERCEPTUAL_TARGET) | NEEDS_PERCEPTUAL_REVIEW | NEEDS_PERCEPTUAL_REVIEW |
| GK-*-REG (REGRESSION) | NOT_EVALUATED | NOT_EVALUATED |
| GK-WF-001-CAUSAL (UNKNOWN) | NOT_EVALUATED | NOT_EVALUATED |

### Common (protected) criteria

| Criterion | Note |
|-----------|------|
| COMMON-FINITE | PASS (unchanged) |
| COMMON-DETERMINISTIC | NOT_EVALUATED (single-run; two-run comparison not performed, duels precedent) |
| COMMON-REFERENCES | **PASS** (the COMMON-FULL-MATCH-INVARIANT-TRIAGE fix resolves the persistent `ball.lastTouchRef` against the observation-window event union; 0 per-tick fails) |
| COMMON-BOUNDS | **FAIL (residual, disclosed)** — the legacy phase-sync runs leave the ball out of play without a restart and players chase it out of bounds (`maxPlayerAbsX` up to ~61 m), a real illegal position correctly flagged by the un-widened safety-bounds invariant; the core-owned full-match runs PASS |

---

## Provenance

Pins read verbatim from each accepted `docs/evidence/<id>/manifest.json` `candidate_commit` (never guessed) and referenced SHA-256 values read from the accepted records/manifests:

| Source manifest | candidate_commit | referenced_sha256 | Reference |
|---|---|---|---|
| `docs/evidence/GK-KEEPER-ORACLE-REGISTRATION/manifest.json` | `cc4a63b4f7de1f38084a799125c56e3485e44b8c` | `404b62a68be54260fc4bc15687f3d23d2a63909e7fbbe7abd584c6c97b1bef7a` (record_sha256 of `gk-suite-state.json`) | Accepted keeper oracle registration (first real GK verdicts) |
| `docs/evidence/GK-DISTRIBUTION-BEHAVIOR/manifest.json` | `a8547502a4ec89c05446a993d3b0a43b7b69e8f1` | `0102d22d6fc31fa3c40bb6a3ef3b1d881dc59acd87d82cb6cd93e7965c3242cd` (trajectory.json sha256) | Accepted distribution behavior (keeper-release telemetry) |
| `docs/evidence/GK-SUITE-ORGANIC-STATE/manifest.json` | `29786b413fecf1585613a4fd3ab09effc3b721d5` | `28e584a4f7a24541bf030319cff84988a01c728de8db0873c636ee5b462461aa` (record_sha256 of `gk-suite-state.json`) | Accepted pre-oracle organic state (all NOT_EVALUATED) |
| `docs/evidence/COMMON-FULL-MATCH-INVARIANT-TRIAGE/manifest.json` | `ae75c82d36c35ff130709e392b119a0cff2391fd` | `0def8f73e7fc14ee3b5350d8d6a9696e9422993b33e74b92ea7b9c9ac7aa3545` (audit.json sha256) | Accepted COMMON-REFERENCES fix |
| `docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/manifest.json` | `40aa0dae902a1e7c1375c2444304296d10116bf9` | `ca9443a0859733c1b52acd775002737f4f75bd277e508e4cf06eed7029bf207c` (trajectory.json sha256) | Headless MULTI_TICK keeper runs (continuous + shot fixture) |

Each run's `source_candidate` (both `gk-continuous-live` and `gk-shot-fixture-live`) reads `40aa0dae902a1e7c1375c2444304296d10116bf9` verbatim from `docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/manifest.json`.

## Reproduction

The record is regenerated by:

```
WIP_SECTION=__EVIDENCE__:GK-SUITE-VERDICTS-STATE \
  mise exec -- pnpm exec tsx scripts/capture-gk-suite-verdicts-state.ts
```

Each headless organic run is reproduced through the same exported production runner the accepted GK evidence used (`runHeadlessMatch` with `gkBehavior: true`, `browserParityObservations: true`, `lifecyclePhaseSync: 'legacy'`) and the `goalkeepers` suite is physically executed over the committed telemetry observations. No outcome is hand-written.

## claims_not_made

- No PROMOTION claim.
- No GK criterion is upgraded to gameplay `PASS` beyond what the executed evaluator returns (POSITIONING-HOLD / NO-FIELD-CHASE / ROLE-DESIGNATION are PASS on organic evidence; SAVE-CLAIM and DISTRIBUTION are PASS only from the driven fixture, disclosed; the organic continuous DISTRIBUTION run is NOT_EVALUATED / 0 releases, disclosed).
- No PES 2017 fidelity / measured PES envelope claim.
- No FOUNDATION_LAB_PASS claim.
- No invented reference envelope or tolerance: reaction latency, save probability distribution, wrong-foot reversal, high-cross claim threshold, and parry energy ratio all stay `BLOCKED_MISSING_REFERENCE`.
- No protected criteria change: no oracle / catalog / invariant / observation / scenario change; the `goalkeepers` suite criteria are only re-run over the accepted runs.
- No claim that the `goalkeepers` suite overall is PASS: COMMON-BOUNDS FAILs on the legacy phase-sync run (a real illegal position from the documented restart-suspension driver behavior), a disclosed residual, not a keeper regression; the safety-bounds invariant is deliberately NOT widened.
- No gameplay change: no `src/simulation/`, `src/contracts/`, `src/adapters/`, `eval/runners/`, `eval/scenarios/`, `eval/oracles/`, `eval/contracts/`, `specs/` diff.
