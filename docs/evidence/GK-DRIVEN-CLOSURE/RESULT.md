# GK-DRIVEN-CLOSURE — builder result

## Builder report

- **objective_id:** GK-DRIVEN-CLOSURE
- **builder_agent:** builder-structured
- **builder_model:** deepseek-v4-flash
- **evidence_class:** BOOKKEEPING
- **hypothesis:** The two per-stream `NOT_EVALUATED` goalkeepers observations in the baseline (GK-SAVE-CLAIM organic 0 save chains; GK-DISTRIBUTION fixture 0 releases) can be closed by driving, through the established driven-fixture pattern (adapter initial state / scenario fixtures ONLY; zero gameplay change), two controlled streams whose core+adapter keeper machinery executes the relevant behavior: (a) the accepted 5v5-keeper-shot-fixture geometry for an on-target shot chain answered by a keeper save/claim, and (b) a NEW controlled keeper-release fixture in which the keeper secures a slow ball and releases to an observed forward teammate. Re-running the registered `goalkeepers` suite (`evaluateSuite("goalkeepers", ...)`) over both driven streams (each twice, a two-run deterministic attestation) yields the honest updated verdict table. Because GK-SAVE-CLAIM and GK-DISTRIBUTION were already PASS at the aggregate baseline, the aggregate verdict_counts stay **9/0/2/1/1** (the 2 aggregate NOT_EVALUATED rows are the catalog `reg`/`causal` keys and must not be converted); the closure is at the driven-evidence / per-stream level — each criterion now carries a real chain/release from a controlled driven MULTI_TICK stream. BLOCKED_MISSING_REFERENCE and NEEDS_PERCEPTUAL_REVIEW keys stay unchanged; no suite-level PASS claim.

### files_changed

- `eval/scenarios/5v5-keeper-release-fixture.v1.json` (NEW — controlled driven keeper-release fixture: adapter initial state only, the core's own keeper/distribution machinery executes).
- `scripts/capture-gk-driven-closure.ts` (NEW — byte-reproducible BOOKKEEPING producer; WIP_SECTION-gated durable write; reads `candidate_commit` verbatim from git HEAD).
- `tests/unit/eval/GK-DRIVEN-CLOSURE-binding.test.ts` (NEW — 9 binding tests, including a not-hand-written reproduction of both driven streams).
- `docs/evidence/GK-DRIVEN-CLOSURE/gk-driven-closure.json` (NEW — durable verdict record, `record_sha256` pinned).
- `docs/evidence/GK-DRIVEN-CLOSURE/audit.json` (NEW — `gauntlet:audit` output, status `PASS`).
- `docs/evidence/GK-DRIVEN-CLOSURE/RESULT.md` (NEW — this result).

**Zero changes** to `src/`, `src/simulation/`, `src/contracts/`, `src/adapters/`, `eval/runners/`, `eval/oracles/`, `eval/invariants/`, `eval/contracts/`, `specs/` (verified `git diff src/ src/contracts/` is EMPTY; no evaluator, oracle, catalog, invariant, observation, contract, adapter, runner or spec was touched). No change to `gauntlet/state/`, `VERSION.json`, `prompt-gate.ts`, or `specs/`.

### commands_run (actual exit codes)

| Command | Exit |
|---|---|
| `mise exec -- pnpm exec tsx scripts/capture-gk-driven-closure.ts` ×2 (ordinary mode) | 0 — byte-identical output; writes `test-results/gauntlet-capture/`, leaves `docs/` byte-identical |
| `WIP_SECTION=__EVIDENCE__:GK-DRIVEN-CLOSURE mise exec -- pnpm exec tsx scripts/capture-gk-driven-closure.ts` | 0 (record_sha256 `21a596277aac626f3612e225ced4145310e1a81631bd28552f9188d223b33d7a`) |
| `mise run typecheck` | 0 (core + node + browser clean) |
| `mise exec -- pnpm exec vitest run --project node tests/unit/eval/GK-DRIVEN-CLOSURE-binding.test.ts --testTimeout 300000` | 0 (9 tests) |
| `mise exec -- pnpm exec vitest run --project node tests/unit/eval/{goalkeepers-suite,gk-oracle,GK-KEEPER-ORACLE-REGISTRATION-binding,GK-SUITE-ORGANIC-STATE-binding,GK-SUITE-VERDICTS-STATE-binding,GK-GOALLINE-BOUNDS-RESIDUAL-guard,GK-CORE-OWNED-ARC-FIX-guard,CPU-DEFENSIVE-TACKLE-binding,LIFECYCLE-MIGRATION-ASSESSMENT-binding,rules-suite,RULES-SUITE-REGISTRATION-binding,RULES-SUITE-STATE-binding,rules-facts-depth-binding,match-rules-spec-binding,SUITE-DETERMINISTIC-TWO-RUN-binding}.test.ts` | 0 (196 tests) |
| `mise exec -- pnpm exec vitest run --project node tests/unit/eval/{eval-registry,oracle-registry,foundation-evaluator,duels-suite,COMMON-FULL-MATCH-INVARIANT-TRIAGE-guard}.test.ts tests/candidate-scope.node.test.ts tests/capture-hygiene.node.test.ts tests/evidence-sanity.node.test.ts` | 0 (153 tests) |
| `mise exec -- pnpm run gauntlet:audit -- --objective GK-DRIVEN-CLOSURE --class BOOKKEEPING --tests-pass true --integration-test-pass true` | 0 (status `PASS`) |

### tests_run

- **GK-DRIVEN-CLOSURE-binding.test.ts** — 9 tests, PASS (record shape; baseline 9/0/2/1/1 pinned; source_change.src_contracts_diff_empty; two driven-stream determinism; save stream GK-SAVE-CLAIM PASS from a ≥1 real save/claim chain; release stream GK-DISTRIBUTION PASS from ≥1 real release with observed teammate target; aggregate STATE: both criteria PASS + COMMON-DETERMINISTIC PASS + catalog BLOCKED/NEEDS/reg/causal unchanged; verdict_counts 9/0/2/1/1; claims_not_made negatives; not-hand-written reproduction of both streams).
- **GK/stateHash/rules gate** — 196 tests, PASS across 15 files (goalkeepers-suite, gk-oracle, GK-KEEPER-ORACLE-REGISTRATION, GK-SUITE-ORGANIC-STATE, GK-SUITE-VERDICTS-STATE, GK-GOALLINE-BOUNDS-RESIDUAL-guard 7/7, GK-CORE-OWNED-ARC-FIX-guard, CPU-DEFENSIVE-TACKLE-binding, LIFECYCLE-MIGRATION-ASSESSMENT-binding, rules-suite, RULES-SUITE-REGISTRATION, RULES-SUITE-STATE, rules-facts-depth-binding, match-rules-spec-binding, SUITE-DETERMINISTIC-TWO-RUN-binding).
- **Evaluator/hygiene gate** — 153 tests, PASS across 8 files (eval-registry, oracle-registry, foundation-evaluator, duels-suite, COMMON-FULL-MATCH-INVARIANT-TRIAGE-guard, candidate-scope, capture-hygiene, evidence-sanity).
- **Typecheck** — exit 0 (core + node + browser clean).

### integration_test_result

For `BOOKKEEPING`, the audit marks the integration-test check `NOT_APPLICABLE` (integration evidence is required only for `MULTI_TICK`/`DYNAMIC_VISUAL`). The driven streams are nonetheless MULTI_TICK by nature, so a relevant exercised-gate at the audit level plus a not-hand-written reproduction is recorded: the `GK-DRIVEN-CLOSURE-binding.test.ts` "record is not hand-written" test physically reproduces both driven streams through the production runner and the accepted `evaluateSuite("goalkeepers", ...)` entry point and confirms the evaluator yields the recorded per-stream outcomes. The audit `integration test result` check was `NOT_APPLICABLE`.

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing.

### required_evidence

- Deterministic audit: `docs/evidence/GK-DRIVEN-CLOSURE/audit.json` (status `PASS`).
- Executed tests (BOOKKEEPING): the 9-test binding gate, the 196-test GK/stateHash/rules gate, the 153-test evaluator/hygiene gate, and the typecheck gate.
- Durable verdict record: `docs/evidence/GK-DRIVEN-CLOSURE/gk-driven-closure.json` (`record_sha256` 21a59627…).

### artifacts

- `docs/evidence/GK-DRIVEN-CLOSURE/gk-driven-closure.json`
- `docs/evidence/GK-DRIVEN-CLOSURE/audit.json`
- `docs/evidence/GK-DRIVEN-CLOSURE/RESULT.md`

### spec_sections

- `specs/GOALKEEPER_SPEC.md` §4–§8 (designation, goal-arc hold, no-field-chase, save/claim, distribution) and §11 (evaluator suite contract); versioned provisional `gk-small-sided-v1` values read only from `eval/contracts/goalkeeper-config.ts` / `src/adapters/input-browser/goalkeeper-role.ts` (reach 1.2 m, reaction window 12 ticks, release window 10 ticks).
- `eval/contracts/suites.ts` (suite-goalkeepers-v1), `eval/runners/foundation-evaluator.ts` (criterion→oracle resolution), `eval/runners/headless-match.ts` (core-owned lifecycle, rehomeKeeperToArc, `browserParityObservations`, `gkBehavior`, the runner-injected `keeper-release` telemetry).
- `gauntlet/evidence-contract.md` (BOOKKEEPING), `gauntlet/evidence-classes.md`, `gauntlet/roles/builder-structured.md` (role contract).

### acceptance_criteria_met

- **Driven stream (a) — on-target shot chain:** reused the accepted 5v5-keeper-shot-fixture geometry (adapter initial state); the core's own shot contact is answered by a recorded team-b keeper (player-10) contact inside the versioned reach (contact ticks 362/374/380/386, recorded distances 1.081/0.737/0.551/0.473 m, shot→contact gap 1–4 ticks ≤ 12, all `withinReach`). `evaluateSuite("goalkeepers", …)` yields **GK-SAVE-CLAIM = PASS** on this stream (≥1 real save/claim chain).
- **Driven stream (b) — keeper-release situation:** NEW controlled fixture; the keeper secures a slow ball in its goal arc and the adapter's distribution path releases to observed forward teammate player-9 down a lane it already faces (12 `keeper-release` events at ticks 1/4/7/10/13/42/56/58/61/64/67/70, every target player-9). `evaluateSuite("goalkeepers", …)` yields **GK-DISTRIBUTION-NO-OMNISCIENCE = PASS** on this stream (≥1 real release).
- **Two-run determinism:** each driven stream re-run twice byte-identical (state-hash chain + observations identical run A vs run B), so COMMON-DETERMINISTIC resolves to PASS here rather than the single-run NOT_EVALUATED.
- **Honest updated verdict table + exact deltas vs baseline (9/0/2/1/1):** aggregate verdict_counts **unchanged 9/0/2/1/1**; `delta_vs_baseline_count_change.changed = false`. Per-criterion deltas: every aggregate verdict matches the baseline (GK-SAVE-CLAIM PASS, GK-DISTRIBUTION PASS, COMMON-* PASS, catalog ref BLOCKED / vis NEEDS / reg+causal NOT_EVALUATED). The changed facts are at the driven-evidence level: the 2 previously per-stream NOT_EVALUATED observations are each now answered by a controlled driven MULTI_TICK stream.
- **Blocked + perceptual keys unchanged:** GK-*-REF stays BLOCKED_MISSING_REFERENCE (no ReferenceTarget created); GK-*-VIS stays NEEDS_PERCEPTUAL_REVIEW (no versioned perceptual rubric). The 2 aggregate NOT_EVALUATED (GK-*-REG, GK-*-CAUSAL) are unchanged (no regression policy / unknown class).
- **Zero gameplay change:** `git diff src/ src/contracts/` EMPTY. No evaluator, oracle, catalog, invariant, observation, contract, adapter, runner or spec change; no `gauntlet/state/`, `VERSION.json`, `prompt-gate.ts`, or `specs/` change.
- **Capture hygiene 0.9.2+:** durable write only via `WIP_SECTION=__EVIDENCE__:GK-DRIVEN-CLOSURE`; two consecutive ordinary-mode runs are byte-identical (record_sha256 stable; no wall-clock field in the hashed content) and leave `docs/` byte-identical.

### known_gaps

- The aggregate verdict_counts do **not** change (9/0/2/1/1), because GK-SAVE-CLAIM and GK-DISTRIBUTION were already PASS at the aggregate baseline (driven save fixture and organic continuous run respectively). The closure is per-stream evidence — honest, and deliberately not an attempt to inflate a count that was already PASS.
- Per-stream asymmetry is disclosed, not masked: the save fixture is NOT_EVALUATED on GK-DISTRIBUTION (0 releases), and the release fixture is NOT_EVALUATED on GK-SAVE-CLAIM (no shot answered within the reaction window). The organic continuous run remains NOT_EVALUATED on GK-SAVE-CLAIM (0 save chains). No oracle was widened to force a PASS.
- The release-fixture release happens from a "secured slow ball at the keeper's feet" state that itself follows a prior claim/last-touch; the release decision is the adapter's distribution path (observed target within the forward band), consistent with the accepted GK-DISTRIBUTION-BEHAVIOR semantics.
- The horizon label "GK-SUITE-CORE-OWNED-STATE baseline (9/0/2/1/1)" conflates two records: GK-SUITE-CORE-OWNED-STATE's own record is 8/0/3/1/1 (single-run, COMMON-DETERMINISTIC NOT_EVALUATED); the 9/0/2/1/1 counts are the post-two-run goalkeepers table in SUITE-DETERMINISTIC-TWO-RUN. Both records are read verbatim and the conflation is disclosed in the record; the deltas are computed against the 9/0/2/1/1 table the horizon binds.
- Vitest may emit a non-fatal `onTaskUpdate` RPC timeout on the long-running headless hooks (documented pre-existing worker-RPC artifact); tests and exit code are clean.

### claims_not_made

- No suite-level PASS claim for the goalkeepers suite (2 aggregate NOT_EVALUATED catalog rows + 1 BLOCKED_MISSING_REFERENCE + 1 NEEDS_PERCEPTUAL_REVIEW remain).
- No PROMOTION claim; no FOUNDATION_LAB_PASS claim.
- No PES 2017 fidelity / measured PES envelope claim.
- No invented reference envelope or tolerance; BLOCKED_MISSING_REFERENCE stays BLOCKED_MISSING_REFERENCE.
- No reference target was created and no perceptual/rubric criterion was upgraded; GK-*-REF stays BLOCKED_MISSING_REFERENCE and GK-*-VIS stays NEEDS_PERCEPTUAL_REVIEW.
- No criterion is upgraded beyond what the executed evaluator returns; no oracle / catalog / invariant / observation / contract / adapter / runner / spec change.
- Zero gameplay change (`git diff src/ src/contracts/` EMPTY).
- No accepted record mutation: GK-SUITE-CORE-OWNED-STATE (5cd1c808…), SUITE-DETERMINISTIC-TWO-RUN (abaf6ccd…), and all prior GK records stay byte-untouched.

---

## Honest updated goalkeepers verdict table (driven closure over 2 driven MULTI_TICK streams)

### Small-sided GK behavior criteria

| Criterion | Baseline (9/0/2/1/1) | Driven-closure aggregate | Save-driven stream | Release-driven stream | Why |
|---|---|---|---|---|---|
| GK-POSITIONING-HOLD | PASS | PASS | PASS | PASS | Designated keeper holds its goal arc under core-owned; unchanged |
| GK-NO-FIELD-CHASE | PASS | PASS | PASS | PASS | Keeper never the designated chaser/presser; unchanged |
| GK-SAVE-CLAIM | PASS | PASS | **PASS** | NOT_EVALUATED | Save fixture answers an on-target shot with 4 contacts inside the reach; release fixture has no shot answered |
| GK-ROLE-DESIGNATION | PASS | PASS | PASS | PASS | Exactly one designated keeper per team (team-a→player-4, team-b→player-10); unchanged |
| GK-DISTRIBUTION-NO-OMNISCIENCE | PASS | PASS | NOT_EVALUATED | **PASS** | NEW release fixture: keeper releases 12× to observed teammate player-9; save fixture has 0 releases |

### Common (protected) criteria

| Criterion | Baseline | Driven-closure aggregate | Note |
|---|---|---|---|
| COMMON-FINITE | PASS | PASS | unchanged |
| COMMON-DETERMINISTIC | PASS | PASS | resolved here by two-run byte identity over both driven streams |
| COMMON-REFERENCES | PASS | PASS | unchanged |
| COMMON-BOUNDS | PASS | PASS | goal-mouth bound live; no out-of-play escape under core-owned |

### Catalog (unchanged — no reference / no review)

| Key | Baseline | Driven-closure |
|---|---|---|
| ref (GK-*-REF, MEASURED_TARGET) | BLOCKED_MISSING_REFERENCE | BLOCKED_MISSING_REFERENCE |
| vis (GK-*-VIS, PERCEPTUAL_TARGET) | NEEDS_PERCEPTUAL_REVIEW | NEEDS_PERCEPTUAL_REVIEW |
| reg (GK-*-REG, REGRESSION) | NOT_EVALUATED | NOT_EVALUATED |
| causal (GK-*-CAUSAL, UNKNOWN) | NOT_EVALUATED | NOT_EVALUATED |

### Deltas vs baseline (9/0/2/1/1)

- **Per-criterion aggregate verdict deltas:** none (`delta_vs_baseline_count_change.changed = false`). The 9/0/2/1/1 aggregate is preserved: 9 PASS / 0 FAIL / 2 NOT_EVALUATED / 1 BLOCKED_MISSING_REFERENCE / 1 NEEDS_PERCEPTUAL_REVIEW.
- **The real progress (per-stream evidence):** GK-SAVE-CLAIM now carries a real save/claim chain from a controlled driven MULTI_TICK stream (save fixture, 4 contacts), and GK-DISTRIBUTION-NO-OMNISCIENCE now carries ≥1 real release from a NEW controlled driven MULTI_TICK stream (release fixture, 12 releases) — closing the two previously per-stream NOT_EVALUATED observations without changing any aggregate verdict, and without touching the BLOCKED / PERCEPTUAL / reg+causal keys.

## Provenance

- `candidate_commit` = `1214ca71f1838f966041b447c2330430973d7c0a` (git HEAD, read verbatim).
- `record_sha256` = `21a596277aac626f3612e225ced4145310e1a81631bd28552f9188d223b33d7a` (computed over the record minus the `record_sha256` field; no wall-clock field in the hashed content; two consecutive ordinary-mode runs byte-identical; ordinary mode leaves `docs/` byte-identical).
- Baseline read verbatim: `docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/suite-deterministic-two-run.json` (`record_sha256` abaf6ccd…) — the 9/0/2/1/1 goalkeepers `verdict_counts`; and `docs/evidence/GK-SUITE-CORE-OWNED-STATE/gk-suite-core-owned-state.json` (`record_sha256` 5cd1c808…) — 8/0/3/1/1 (single-run), the record the horizon labels.

## Reproduction

```
WIP_SECTION=__EVIDENCE__:GK-DRIVEN-CLOSURE \
  mise exec -- pnpm exec tsx scripts/capture-gk-driven-closure.ts
```

Each driven stream is reproduced through the same exported production runner the accepted GK evidence uses (`runHeadlessMatch` with `gkBehavior: true`, `browserParityObservations: true`, `lifecyclePhaseSync: 'core-owned'`, re-home default on) and the `goalkeepers` suite is physically executed over the committed observations. No outcome is hand-written.

## Audit (for the orchestrator)

```
pnpm run gauntlet:audit -- --objective GK-DRIVEN-CLOSURE --class BOOKKEEPING --tests-pass true --integration-test-pass true
```

status PASS (`docs/evidence/GK-DRIVEN-CLOSURE/audit.json`). Class justification: BOOKKEEPING. The horizon explicitly classifies this as "BOOKKEEPING-class evidence over the driven streams (MULTI_TICK trajectories)". This is a re-run/publication over existing + new MULTI_TICK streams with zero source change — the underlying evidence is the MULTI_TICK stream facts (save-chain ticks/distances, release ticks, two-run determinism), but the objective itself is a deterministic suite-state publication. Therefore BOOKKEEPING is the accurate class; no stricter class (MULTI_TICK as an evidence gate) is claimed, since no integration test or trajectory.json-gated evidence is required for the re-run/publication object.
