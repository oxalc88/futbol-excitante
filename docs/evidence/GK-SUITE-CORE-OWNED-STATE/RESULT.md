# GK-SUITE-CORE-OWNED-STATE — builder result

## Builder report

- **objective_id:** GK-SUITE-CORE-OWNED-STATE
- **builder_agent:** builder-structured
- **builder_model:** deepseek-v4-flash
- **evidence_class:** BOOKKEEPING
- **hypothesis:** Re-publishing the goalkeepers suite verdict state under the CORE-OWNED lifecycle after the GK-CORE-OWNED-ARC-FIX re-home (e687fa9). The accepted v27 table (GK-SUITE-VERDICTS-STATE) was produced under the LEGACY lifecycle opt-out. Re-running the registered `goalkeepers` evaluator (`evaluateSuite("goalkeepers", observations)`) over both keeper runs under core-owned WITH the re-home active (the fresh-run default) yields the honest current verdict table: GK-POSITIONING-HOLD / GK-NO-FIELD-CHASE / GK-ROLE-DESIGNATION PASS (organic, core-owned + re-home); GK-SAVE-CLAIM PASS (driven fixture only); GK-DISTRIBUTION-NO-OMNISCIENCE PASS (organic continuous now, NOT the fixture); COMMON-FINITE / COMMON-REFERENCES / COMMON-BOUNDS PASS; COMMON-DETERMINISTIC NOT_EVALUATED; catalog unchanged. The one TRUE verdict change vs the v27 table is COMMON-BOUNDS FAIL→PASS (the legacy phase-sync out-of-play escape is gone under core-owned, and the GK-GOALLINE-BOUNDS-RESIDUAL goal-mouth bound resolves the keeper-in-goal-mouth case). BOOKKEEPING; zero gameplay change.
10→
### files_changed

- `scripts/capture-gk-suite-core-owned-state.ts` (NEW — byte-reproducible record producer; WIP_SECTION-gated durable write; reads `candidate_commit` verbatim from git HEAD).
- `docs/evidence/GK-SUITE-CORE-OWNED-STATE/gk-suite-core-owned-state.json` (NEW — durable core-owned verdict record, `record_sha256` pinned).
- `docs/evidence/GK-SUITE-CORE-OWNED-STATE/audit.json` (NEW — `gauntlet:audit` output, status `PASS`).
- `docs/evidence/GK-SUITE-CORE-OWNED-STATE/RESULT.md` (NEW — this result).
- `tests/unit/eval/GK-SUITE-CORE-OWNED-STATE-binding.test.ts` (NEW — 11 binding tests).

**Zero changes** to `src/`, `src/simulation/`, `src/contracts/`, `src/adapters/`, `eval/runners/`, `eval/oracles/`, `eval/invariants/`, `eval/scenarios/`, or `specs/` (verified: `git diff -- src/ src/simulation/ src/contracts/ src/adapters/ eval/runners/ eval/oracles/ eval/invariants/ eval/scenarios/ specs/` is empty). No evaluator, oracle, catalog, invariant, observation, scenario, or spec was touched. The accepted v27 records (`GK-SUITE-VERDICTS-STATE`, `GK-SUITE-ORGANIC-STATE`) are byte-untouched.
20→
### commands_run (actual exit codes)

| Command | Exit |
|---|---|
| `WIP_SECTION=__EVIDENCE__:GK-SUITE-CORE-OWNED-STATE mise exec -- pnpm exec tsx scripts/capture-gk-suite-core-owned-state.ts` | 0 (record_sha256 5cd1c80879d400c2dabfc0ba6d9b195447fc9476f7b6ebb5329877dd2a69204a) |
| `mise exec -- pnpm exec tsx scripts/capture-gk-suite-core-owned-state.ts` (ordinary mode ×2) | 0 — byte-identical output; leaves `docs/` byte-identical, writes `test-results/gauntlet-capture/` |
| `mise exec -- pnpm run typecheck` | 0 (core + node + browser clean) |
| `mise exec -- pnpm exec vitest run --project node tests/unit/eval/GK-SUITE-CORE-OWNED-STATE-binding.test.ts --testTimeout 300000` | 0 (11 tests; the non-fatal vitest `onTaskUpdate` RPC timeout is the documented pre-existing worker-RPC artifact, exit 0) |
| `mise exec -- pnpm exec vitest run --project node tests/unit/eval/{goalkeepers-suite,gk-oracle,GK-KEEPER-ORACLE-REGISTRATION-binding,GK-SUITE-ORGANIC-STATE-binding,GK-SUITE-VERDICTS-STATE-binding,GK-GOALLINE-BOUNDS-RESIDUAL-guard,GK-CORE-OWNED-ARC-FIX-guard,CPU-DEFENSIVE-TACKLE-binding,LIFECYCLE-MIGRATION-ASSESSMENT-binding,rules-suite,RULES-SUITE-REGISTRATION-binding,RULES-SUITE-STATE-binding,rules-facts-depth-binding,match-rules-spec-binding}.test.ts` | 0 (186 tests) |
| `mise exec -- pnpm exec vitest run --project node tests/unit/eval/{eval-registry,oracle-registry,foundation-evaluator,duels-suite,COMMON-FULL-MATCH-INVARIANT-TRIAGE-guard}.test.ts tests/candidate-scope.node.test.ts tests/capture-hygiene.node.test.ts tests/evidence-sanity.node.test.ts` | 0 (153 tests) |
| `mise exec -- pnpm run gauntlet:verify-gk-stash -- --ref=91ff0be` | 0 (PASS, 4/4 stashed runs) |
| `mise exec -- pnpm run gauntlet:audit -- --objective GK-SUITE-CORE-OWNED-STATE --class BOOKKEEPING --tests-pass true --integration-test-pass true` | 0 (status PASS, 20 checks, 0 FAIL) |

### tests_run

- **GK-SUITE-CORE-OWNED-STATE-binding.test.ts** — 11 tests, PASS (record shape; lifecycle core-owned + re-home; accepted v27 baseline pinned byte-untouched; five GK behavior criteria PASS; observations bookkeeping incl. the distribution source flip; COMMON-BOUNDS FAIL→PASS discriminating; catalog unchanged; verdict_deltas pin the change; per-run distribution/save-claim verdicts; PROMOTION/PES/FOUNDATION_LAB_PASS/suite-level-PASS negative control; not-hand-written reproduction).
- **GK families + stateHash pins + rules gate** — 186 tests, PASS across 14 files (goalkeepers-suite, gk-oracle, GK-KEEPER-ORACLE-REGISTRATION, GK-SUITE-ORGANIC-STATE, GK-SUITE-VERDICTS-STATE, GK-GOALLINE-BOUNDS-RESIDUAL-guard 7/7, GK-CORE-OWNED-ARC-FIX-guard, CPU-DEFENSIVE-TACKLE-binding state-hash pins, LIFECYCLE-MIGRATION-ASSESSMENT-binding, rules-suite, RULES-SUITE-REGISTRATION, RULES-SUITE-STATE, rules-facts-depth-binding, match-rules-spec-binding).
- **Evaluator/hygiene gate** — 153 tests, PASS across 8 files (eval-registry, oracle-registry, foundation-evaluator, duels-suite, COMMON-FULL-MATCH-INVARIANT-TRIAGE-guard, candidate-scope, capture-hygiene, evidence-sanity).
- **Stash identity** — `gauntlet:verify-gk-stash -- --ref=91ff0be` PASS (4/4 stashed runs; `gkBehavior:false` reproduces 91ff0be per-tick hash chains).
- **Typecheck** — exit 0 (core + node + browser clean).

### integration_test_result

For `BOOKKEEPING`, the audit marks the integration-test check `NOT_APPLICABLE` (integration evidence is required only for `MULTI_TICK`/`DYNAMIC_VISUAL`). A relevant integration/provenance gate was still exercised: the `GK-SUITE-CORE-OWNED-STATE-binding.test.ts` "not hand-written" test physically reproduces both keeper runs through the production runner and the accepted `evaluateSuite("goalkeepers", ...)` entry point under core-owned and confirms the evaluator yields the recorded per-run outcomes (not hand-written).
40→

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing.

### required_evidence

- Deterministic audit: `docs/evidence/GK-SUITE-CORE-OWNED-STATE/audit.json` (status `PASS`).
- Executed tests (BOOKKEEPING): the 11-test binding gate, the 186-test GK/stateHash/rules gate, the 153-test evaluator/hygiene gate, and the stash-identity gate.
- Durable core-owned verdict record: `docs/evidence/GK-SUITE-CORE-OWNED-STATE/gk-suite-core-owned-state.json` (`record_sha256` 5cd1c808…).

### artifacts

- `docs/evidence/GK-SUITE-CORE-OWNED-STATE/gk-suite-core-owned-state.json`
- `docs/evidence/GK-SUITE-CORE-OWNED-STATE/audit.json`
- `docs/evidence/GK-SUITE-CORE-OWNED-STATE/RESULT.md`

### spec_sections

- `specs/GOALKEEPER_SPEC.md` §4–§8 (designation, goal-arc hold, no-field-chase, save/claim, distribution) and §11 (evaluator suite contract).
- `eval/contracts/goalkeeper-config.ts` (versioned provisional `gk-small-sided-v1`; thresholds read only from here), `eval/contracts/suites.ts` (suite-goalkeepers-v1).
- `eval/oracles/gk-role.ts` (registered protected oracles), `eval/runners/foundation-evaluator.ts` (criterion→oracle resolution), `eval/runners/headless-match.ts` (`rehomeKeeperToArc` + `DEFAULT_LIFECYCLE_PHASE_SYNC`), `eval/invariants/bounds.ts` + `eval/oracles/wire.ts` (goal-mouth bound).
- `gauntlet/evidence-contract.md` (BOOKKEEPING), `gauntlet/roles/builder-structured.md` (role contract).

### acceptance_criteria_met

- Re-ran `evaluateSuite("goalkeepers", observations)` over both keeper runs (continuous-live 1800 ticks + shot-fixture-live 600 ticks) under core-owned (`lifecyclePhaseSync: "core-owned"`) WITH the GK-CORE-OWNED-ARC-FIX re-home active (the fresh-run default, `gkBehavior: true`, `browserParityObservations: true`).
- Honest per-criterion outcomes: GK-POSITIONING-HOLD / GK-NO-FIELD-CHASE / GK-ROLE-DESIGNATION PASS (organic, core-owned + re-home); GK-SAVE-CLAIM PASS (driven shot fixture only; organic run NOT_EVALUATED); GK-DISTRIBUTION-NO-OMNISCIENCE PASS (organic continuous run, 8 releases to observed team-b teammate player-9; shot fixture NOT_EVALUATED, 0 releases).
- COMMON-FINITE / COMMON-REFERENCES PASS; COMMON-BOUNDS **PASS** (the one TRUE verdict change vs the v27 FAIL); COMMON-DETERMINISTIC NOT_EVALUATED (single-run, duels precedent).
- Catalog unchanged: GK-*-REF BLOCKED_MISSING_REFERENCE; GK-*-VIS NEEDS_PERCEPTUAL_REVIEW; GK-*-REG / GK-*-CAUSAL NOT_EVALUATED.
- Verdict deltas vs the v27 legacy table published explicitly (COMMON-BOUNDS FAIL→PASS; distribution source flip driven→organic; POSITIONING/NO-FIELD-CHASE verdict unchanged but now core-owned + re-home).
- The accepted v27 records are byte-untouched; cross-manifest provenance read verbatim (`accepted_v27.record_sha256` = 222b5f61…).
- Durable record + binding test + neighboring GK/stateHash/rules gate + stash identity + typecheck all green; `git diff src/ src/simulation/ src/contracts/ src/adapters/ eval/runners/ eval/oracles/ eval/invariants/ eval/scenarios/ specs/` EMPTY.

---

## Current honest verdict table (core-owned, re-home on)

### Small-sided GK behavior criteria (GOALKEEPER_SPEC §4–§8)

| Criterion | Class | v27 (legacy) verdict | Core-owned verdict | Run source | Why |
|-----------|-------|----------------------|--------------------|------------|-----|
| GK-POSITIONING-HOLD | HARD_INVARIANT | PASS | **PASS** | organic (core-owned, re-home on) | With the re-home the team-a keeper's kickoff home IS its arc (onArcRatio 1.00, maxDist 2.50 m); without the re-home it would be stranded ~24.6 m off-arc and FAIL |
| GK-NO-FIELD-CHASE | HARD_INVARIANT | PASS | **PASS** | organic (core-owned, re-home on) | Keeper never the team's chaser/presser (chase ticks = 0); re-home keeps it on its arc so the core reset never strands it into the field |
| GK-SAVE-CLAIM | HARD_INVARIANT | PASS | **PASS** | driven (fixture) only | Controlled shot fixture: team-b keeper contact within reach (ticks 362/368/374/380/386). Organic continuous run NOT_EVALUATED (no shot answered within the reaction window) |
| GK-ROLE-DESIGNATION | HARD_INVARIANT | PASS | **PASS** | organic (core-owned, re-home on) | Exactly one designated keeper per team (team-a→player-4, team-b→player-10) |
| GK-DISTRIBUTION-NO-OMNISCIENCE | ENGINE_DESIGN_TARGET | PASS | **PASS** | organic (core-owned, re-home on) | **Source flipped vs v27**: the organic continuous run carries the release evidence (8 releases to observed team-b teammate player-9); the shot fixture records 0 releases under core-owned (NOT_EVALUATED). A lifecycle consequence of run dynamics, not a criterion redefinition |

### §7.4 catalog criteria (unchanged, no reference / no review)

| Criterion family | v27 | Core-owned |
|------------------|-----|------------|
| GK-*-REF (MEASURED_TARGET) | BLOCKED_MISSING_REFERENCE | BLOCKED_MISSING_REFERENCE |
| GK-*-VIS (PERCEPTUAL_TARGET) | NEEDS_PERCEPTUAL_REVIEW | NEEDS_PERCEPTUAL_REVIEW |
| GK-*-REG (REGRESSION) | NOT_EVALUATED | NOT_EVALUATED |
| GK-WF-001-CAUSAL (UNKNOWN) | NOT_EVALUATED | NOT_EVALUATED |

### Common (protected) criteria

| Criterion | v27 | Core-owned | Note |
|-----------|-----|------------|------|
| COMMON-FINITE | PASS | PASS | unchanged |
| COMMON-DETERMINISTIC | NOT_EVALUATED | NOT_EVALUATED | single-run; two-run comparison not performed (duels precedent) |
| COMMON-REFERENCES | PASS | PASS | COMMON-FULL-MATCH-INVARIANT-TRIAGE event-references fix live |
| COMMON-BOUNDS | **FAIL** | **PASS** | **TRUE verdict change**. v27 legacy phase-sync froze restarts → ball escaped the pitch without a restart (body |x| up to ~61 m), a real illegal position. Under core-owned the restart machinery runs (no legacy escape) and the GK-GOALLINE-BOUNDS-RESIDUAL goal-mouth bound (52.5+0+4.0=56.5 m) resolves the team-b keeper pushed into its goal mouth |

---

## Verdict deltas vs the accepted v27 legacy table

| Criterion | v27 | Core-owned | Changed | Why |
|-----------|-----|------------|---------|-----|
| GK-POSITIONING-HOLD | PASS | PASS | no (source changed) | Same verdict; now core-owned + re-home. Without the re-home it FAILs under core-owned |
| GK-NO-FIELD-CHASE | PASS | PASS | no (source changed) | Same verdict; now core-owned + re-home |
| GK-SAVE-CLAIM | PASS | PASS | no | Driven fixture only; organic continuous NOT_EVALUATED |
| GK-ROLE-DESIGNATION | PASS | PASS | no | Organic; re-home does not change designation |
| GK-DISTRIBUTION-NO-OMNISCIENCE | PASS | PASS | no (source flipped) | v27: driven fixture (2 releases). Now: organic continuous (8 releases); fixture NOT_EVALUATED |
| COMMON-FINITE | PASS | PASS | no | |
| COMMON-DETERMINISTIC | NOT_EVALUATED | NOT_EVALUATED | no | Single-run |
| COMMON-REFERENCES | PASS | PASS | no | Event-references fix live |
| COMMON-BOUNDS | **FAIL** | **PASS** | **YES** | Legacy phase-sync out-of-play escape gone under core-owned + goal-mouth bound |
| GK-*-REF | BLOCKED | BLOCKED | no | Blocked references stay blocked |
| GK-*-VIS | NEEDS_PERCEPTUAL_REVIEW | NEEDS_PERCEPTUAL_REVIEW | no | No versioned perceptual rubric |
| GK-*-REG / GK-*-CAUSAL | NOT_EVALUATED | NOT_EVALUATED | no | No regression policy / unknown |

### Remains NOT_EVALUATED

- **COMMON-DETERMINISTIC** — single-run evaluation (two-run comparison not performed, duels precedent).
- **GK-SAVE-CLAIM on the organic continuous run** — no shot answered by a keeper contact within the reaction window (0 save chains), so the driven-only criterion is honestly NOT_EVALUATED per run.
- **GK-DISTRIBUTION-NO-OMNISCIENCE on the shot fixture run** — 0 keeper-release events under core-owned (the keeper claims but does not release), so the criterion is honestly NOT_EVALUATED on that run.

## Provenance

- `candidate_commit` = `ea467be8b476f7e16b2fd380ef9a1e12fed44bbf` (git HEAD, read verbatim).
- `record_sha256` = `5cd1c80879d400c2dabfc0ba6d9b195447fc9476f7b6ebb5329877dd2a69204a` (computed over the record minus the `record_sha256` field; no wall-clock field in the hashed content; two consecutive ordinary-mode runs byte-identical; ordinary mode leaves `docs/` byte-identical).
- Accepted v27 baseline: `docs/evidence/GK-SUITE-VERDICTS-STATE/gk-suite-verdicts-state.json` (`record_sha256` 222b5f61983d30d693af71c0be23f60de6fc3751fce6d75e34732011e3f5c6de), read verbatim; byte-untouched.

## Reproduction

The record is regenerated by:

```
WIP_SECTION=__EVIDENCE__:GK-SUITE-CORE-OWNED-STATE \
  mise exec -- pnpm exec tsx scripts/capture-gk-suite-core-owned-state.ts
```

Each headless core-owned run is reproduced through the same exported production runner the accepted GK evidence used (`runHeadlessMatch` with `gkBehavior: true`, `browserParityObservations: true`, `lifecyclePhaseSync: 'core-owned'`, re-home default on) and the `goalkeepers` suite is physically executed over the committed telemetry observations. No outcome is hand-written.

## claims_not_made

- No PROMOTION claim.
- No FOUNDATION_LAB_PASS claim.
- No PES 2017 fidelity / measured PES envelope claim.
- No invented reference envelope or tolerance: reaction latency, save probability distribution, wrong-foot reversal, high-cross claim threshold, and parry energy ratio all stay `BLOCKED_MISSING_REFERENCE`.
- No suite-level PASS claim for the goalkeepers suite.
- No criterion is upgraded beyond what the executed evaluator returns; the goalkeepers suite criteria are only re-run under core-owned, not redefined.
- No oracle / catalog / invariant / observation / scenario / spec change; zero gameplay change (`git diff src/ src/simulation/ src/contracts/ src/adapters/ eval/runners/ eval/oracles/ eval/invariants/ eval/scenarios/ specs/` empty).
- No accepted record mutation: the v27 records (`GK-SUITE-VERDICTS-STATE`, `GK-SUITE-ORGANIC-STATE`) stay byte-untouched.
- GK-*-REF criteria stay BLOCKED_MISSING_REFERENCE; GK-*-VIS criteria stay NEEDS_PERCEPTUAL_REVIEW.

## Critical disclosure (forwarded from the GK-CORE-OWNED-ARC-FIX reviewers)

Two fresh-run producers now re-run WITH the re-home at HEAD: `scripts/capture-goalline-bounds-residual.ts` (its live guard still passes 7/7) and the LIFECYCLE-MIGRATION probe's core-owned gk arms. Their accepted bytes regenerate only via the documented `rehomeKeeper:false` opt-out. At HEAD the default `rehomeKeeper ?? (gkBehavior && lifecyclePhaseSync === 'core-owned')` is true, so any fresh core-owned `gkBehavior` run without an explicit `rehomeKeeper:false` now re-homes the keeper and would produce new bytes; the accepted historical records for those producers were authored before the re-home gate and are only reproducible with the opt-out. This is a disclosure, not a defect to repair in this BOOKKEEPING objective.
