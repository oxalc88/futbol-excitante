# SUITE-DETERMINISTIC-TWO-RUN — builder result

## Builder report

- **objective_id:** SUITE-DETERMINISTIC-TWO-RUN
- **builder_agent:** builder-structured
- **builder_model:** deepseek-v4-flash
- **evidence_class:** BOOKKEEPING
- **hypothesis:** Extend the duels-suite precedent (DUELS-SUITE-ORGANIC-RERUN, where COMMON-DETERMINISTIC stayed NOT_EVALUATED because the records were single-run) to actually **evaluate** COMMON-DETERMINISTIC for the registered `goalkeepers` and `rules` suites. Run each suite's evidence stream **twice** with the same pinned run contract, verify state-hash chain identity (run 1 vs run 2), and publish the honest updated verdict tables: COMMON-DETERMINISTIC resolves to PASS on byte-identical runs (never forced), all other verdicts unchanged and re-attributed, with exact delta disclosure vs the two accepted baselines (GK-SUITE-CORE-OWNED-STATE `5cd1c808…`, RULES-SUITE-STATE-RERUN `36fc77e5…`). BOOKKEEPING; zero gameplay change.

### files_changed

- `scripts/capture-suite-deterministic-two-run.ts` (NEW — byte-reproducible two-run attestation producer; WIP_SECTION-gated durable write).
- `tests/unit/eval/SUITE-DETERMINISTIC-TWO-RUN-binding.test.ts` (NEW — 7 binding tests, incl. the discriminating determinism check).
- `docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/suite-deterministic-two-run.json` (NEW — durable record, `record_sha256` pinned).
- `docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/audit.json` (NEW — `gauntlet:audit` output, status `PASS`).
- `docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/RESULT.md` (this report).

**Zero changes** to `src/`, `src/adapters/`, `eval/runners/`, `eval/oracles/`, `eval/invariants/`, `eval/contracts/`, `eval/scenarios/`, or `specs/` (verified: `git diff src/ src/adapters/ eval/runners/ eval/oracles/ eval/invariants/ eval/contracts/ eval/scenarios/ specs/` is empty). No evaluator, oracle, invariant, observation, scenario, or spec was touched. The accepted records (`GK-SUITE-CORE-OWNED-STATE`, `RULES-SUITE-STATE-RERUN`, and all earlier GK/rules records) are byte-untouched.

### commands_run (actual exit codes)

| Command | Exit |
|---|---|
| `mise exec -- pnpm exec tsx scripts/capture-suite-deterministic-two-run.ts` (ordinary mode ×2) | 0 — `record_sha256` `abaf6cc…` identical both runs, output file byte-identical (`sha256 7e995f97…`), leaves `docs/` byte-identical, writes `test-results/gauntlet-capture/` |
| `WIP_SECTION=__EVIDENCE__:SUITE-DETERMINISTIC-TWO-RUN mise exec -- pnpm exec tsx scripts/capture-suite-deterministic-two-run.ts` | 0 (wrote `docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/suite-deterministic-two-run.json`; `record_sha256` `abaf6cc…`; byte-identical to the ordinary-mode output) |
| `mise exec -- pnpm run typecheck` | 0 (core + node + browser clean) |
| `mise exec -- pnpm exec vitest run tests/unit/eval/SUITE-DETERMINISTIC-TWO-RUN-binding.test.ts --project node --testTimeout 120000` | 0 (7/7 PASS) |
| Rules gate (10 files) | 0 (173/173 PASS) |
| GK families (non-reproduction, 5 files) | 0 (64/64 PASS) |
| `GK-SUITE-CORE-OWNED-STATE-binding.test.ts` | 0 (11/11 PASS; one non-fatal vitest worker RPC infra timeout — same known artifact documented in the accepted GK-SUITE-CORE-OWNED-STATE record) |
| GK guard tests (2 files) | 0 (13/13 PASS) |
| registry / provenance / hygiene battery (8 files) | 0 (172/172 PASS) |
| foundation evidence binding + promotion (2 files) | 0 (28/28 PASS) |
| determinism / stateHash pins (4 files) | 0 (59/59 PASS) |
| restart/match determinism pins (11 files) | 0 (162/162 PASS; one non-fatal vitest worker RPC infra timeout, not an assertion failure) |
| `mise exec -- pnpm run gauntlet:audit -- --objective SUITE-DETERMINISTIC-TWO-RUN --class BOOKKEEPING --tests-pass true --integration-test-pass true` | 0 (status `PASS`; see `audit.json`) |

### tests_run

- **SUITE-DETERMINISTIC-TWO-RUN-binding.test.ts** — 7 tests, PASS (record shape; byte-reproducible `record_sha256` recompute; GK COMMON-DETERMINISTIC NOT_EVALUATED→PASS with only-that-change delta; GK counts 9/0/2/1/1 and blocked reference stayed blocked; rules COMMON-DETERMINISTIC added as a determinism row PASS with 23/2/0/0 MATCH counts unchanged and no §15 regression on any attested stream; every attested stream byte-identical run-1 vs run-2; PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level-PASS negative control; **discriminating** same-config byte-identity vs different-config divergence).
- **Rules gate** — rules-oracle (75) / rules-suite (17) / RULES-SUITE-REGISTRATION-binding (28) / restart-rules-serialization (4) / RULES-SUITE-STATE-binding (10) / rules-facts-depth-binding (8) / corner-driven-conformance-binding (7) / restart-designation-binding (8) / rules-suite-state-rerun-binding (9) / SUITE-DETERMINISTIC-TWO-RUN-binding (7), **173/173 PASS**.
- **GK families** — goalkeepers-suite (24) / gk-oracle (16) / GK-KEEPER-ORACLE-REGISTRATION-binding (5) / GK-SUITE-ORGANIC-STATE-binding (8) / GK-SUITE-VERDICTS-STATE-binding (11), **64/64 PASS**; **GK-SUITE-CORE-OWNED-STATE-binding 11/11 PASS**; **GK-CORE-OWNED-ARC-FIX-guard (6) / GK-GOALLINE-BOUNDS-RESIDUAL-guard (7), 13/13 PASS**.
- **registry / provenance / hygiene** — eval-registry (48) / oracle-registry (19) / mutant-core (33) / foundation-evaluator (36) / match-rules-spec-binding (28) / candidate-scope (2) / evidence-sanity (3) / capture-hygiene (3), **172/172 PASS**; **foundation-lab-evidence-binding (8) / foundation-promotion (20), 28/28 PASS**.
- **stateHash / determinism pins** — compare-foundation (8, incl. COMMON-DETERMINISTIC two-run PASS) / headless-match (16) / ball-settled-regime-match (10) / headless (13), **59/59 PASS**; throw-in / goal-kick / corner-kick / match-timer / match-lifecycle / match-set-piece / 5v5-kickoff-anti-huddle / telemetry / replay-match / match-scoring / restart-anti-huddle determinism suites, **162/162 PASS**.
- **Typecheck** — exit 0 (core + node + browser clean).

### integration_test_result

For `BOOKKEEPING`, the audit marks the integration-test check `NOT_APPLICABLE` (integration evidence is required only for `MULTI_TICK`/`DYNAMIC_VISUAL`). A relevant determinism gate was still exercised: `compare-foundation.test.ts` (COMMON-DETERMINISTIC two identical clean runs → PASS) and the integration determinism pins re-ran green, confirming the engine produces byte-identical state-hash chains for identical pinned run contracts.

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing.

### required_evidence

- Deterministic audit: `docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/audit.json` (status `PASS`).
- Durable two-run assertion record: `docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/suite-deterministic-two-run.json` (`record_sha256` `abaf6cc…`; byte-reproducible; no wall-clock field in hashed content).
- Executed tests (BOOKKEEPING): the new binding gate, the rules gate, the GK families, the registry/provenance/hygiene battery, and the determinism/stateHash pins.

### artifacts

- `docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/suite-deterministic-two-run.json`
- `docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/audit.json`
- `docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/RESULT.md`
- `scripts/capture-suite-deterministic-two-run.ts`
- `tests/unit/eval/SUITE-DETERMINISTIC-TWO-RUN-binding.test.ts`

### spec_sections

- `eval/contracts/invariant-definitions.ts` (INV_DETERMINISTIC → `deterministic` invariant), `eval/contracts/common-criteria.ts` (COMMON-DETERMINISTIC HARD_INVARIANT), `eval/contracts/suites.ts` (suite-goalkeepers-v1 has COMMON-DETERMINISTIC; suite-rules-v1 has none).
- `eval/runners/foundation-evaluator.ts` (COMMON-DETERMINISTIC excluded from single-run overall reduction; `criterionToOracle` returns no oracle → NOT_EVALUATED single-run), `eval/runners/compare-foundation.ts` (the two-run comparison path), `eval/runners/headless-match.ts` (`stateHashes` per-tick chain; gated `serializeRestartFacts` and `browserParityObservations`).
- `specs/GAMEPLAY_EVALUATION_SPEC.md` §HARD_INVARIANT ("Two runs with the same pinned run contract have identical state hashes at every tick") and the goalkeepers/rules suite declarations.
- `docs/evidence/GK-SUITE-CORE-OWNED-STATE/gk-suite-core-owned-state.json` (baseline `5cd1c808…`, read verbatim) and `docs/evidence/RULES-SUITE-STATE-RERUN/rules-suite-state-rerun.json` (baseline `36fc77e5…`, read verbatim).
- `gauntlet/evidence-contract.md` (BOOKKEEPING), `gauntlet/roles/builder-structured.md` (role contract).

### acceptance_criteria_met

- Two-run deterministic attestation for both registered suites: every attested stream was run twice with the same pinned run contract and produced byte-identical state-hash chains (and byte-identical observations) — run-1 vs run-2 `state_hash_chain_identical = true` on all attested streams.
- COMMON-DETERMINISTIC now **evaluates** (was NOT_EVALUATED for the single-run GK record, and not present for the rules record): **PASS** for both suites, derived strictly from byte-identity (it would be reported FAIL honestly on divergence — never forced).
- Goalkeepers suite updated verdict table: **9 PASS / 0 FAIL / 2 NOT_EVALUATED / 1 BLOCKED_MISSING_REFERENCE / 1 NEEDS_PERCEPTUAL_REVIEW** (COMMON-DETERMINISTIC is the single verdict change: NOT_EVALUATED → PASS vs baseline `5cd1c808…`).
- Rules suite updated verdict table: the 25 §15 MATCH-* criteria remain **23 PASS / 2 BLOCKED_MISSING_REFERENCE / 0 NOT_EVALUATED / 0 FAIL**; COMMON-DETERMINISTIC is added as a determinism attestation row and evaluates to **PASS** (→ 26-row table **24 PASS / 2 BLOCKED / 0 NOT_EVALUATED / 0 FAIL**).
- Exact delta disclosure vs both accepted baselines (see tables below); no §15 or GK behavior/catalog verdict changed; blocked references stay blocked.
- Record byte-reproducibility: `record_sha256` `abaf6cc…` with NO wall-clock field in the hashed content; two consecutive ordinary-mode runs byte-identical; an ordinary-mode run leaves `docs/` byte-identical.
- Zero gameplay/source change: `git diff src/ src/adapters/ eval/runners/ eval/oracles/ eval/invariants/ eval/contracts/ eval/scenarios/ specs/` is EMPTY.
- Batteries green (rules gate, GK families, registry/provenance/hygiene, determinism/stateHash pins); `mise run typecheck` exit 0; `gauntlet:audit` status PASS.

---

## How COMMON-DETERMINISTIC evaluates

COMMON-DETERMINISTIC is a `HARD_INVARIANT` whose rule (GAMEPLAY_EVALUATION_SPEC): *two runs with the same pinned run contract have identical state hashes at every tick.* It is **not** a single-run oracle: `criterionToOracle` returns no oracle for it, so `evaluateSuite`/`evaluateFoundation` yield **NOT_EVALUATED** on a single run (and exclude it from single-run overall reduction). It is resolved by a **two-run comparison** (`compareAndEvaluateFoundation` in the foundation path). This objective performs that two-run comparison over each suite's evidence streams directly: run the stream twice with the identical config, compare the per-tick `stateHashes` chain (and the full observation stream for byte-identity). Byte-identical ⇒ PASS; divergence ⇒ FAIL.

## Two-run byte-identity evidence (run 1 vs run 2)

Every attested stream is byte-identical run-1 vs run-2 (`state_hash_chain_identical = true`, `observations_byte_identical = true`, `earliest_divergence_tick = null`).

**Goalkeepers suite (suite-goalkeepers-v1):**

| Run | Scenario | Ticks | run-A chain SHA | run-B chain SHA | Identical |
|---|---|---|---|---|---|
| gk-continuous-live | 5v5-continuous-play-v1 | 1800 | `6dbb4341…` | `6dbb4341…` | true |
| gk-shot-fixture-live | 5v5-keeper-shot-fixture-v1 | 600 | `4a1aa34d…` | `4a1aa34d…` | true |

**Rules suite (suite-rules-v1) — attested representative streams:**

| Stream | Scenario | Ticks | run-A chain SHA | run-B chain SHA | Identical |
|---|---|---|---|---|---|
| rules-corner-live | 5v5-corner-driven-v1 | 400 | `0306d528…` | `0306d528…` | true |
| rules-full-match-live | 5v5-full-match-timing-v1 | 800 | `2d909500…` | `2d909500…` | true |
| designation-fullmatch-live | 5v5-full-match-timing-v1 | 800 | `4aa1cee9…` | `4aa1cee9…` | true |
| designation-throwin-live | 5v5-restart-throwin-v1 | 1800 | `6e78e38e…` | `6e78e38e…` | true |

### Disclosed attestation exclusions (rules suite)

The following rules streams were **not** separately attested (capture budget / redundant control), as allowed by the objective:

- `designation-arc-live` (1800-tick browserParity, ~56 s/run) — the goal-kick / post-goal re-arm semantics are carried by the received arc-family evidence; engine determinism is attested on the designation throw-in / full-match streams.
- `rules-throwin-baseline`, `rules-goalkick-postgoal-baseline` (non-gated, 1800) — superseded controls; same scenario as attested streams.
- `rules-throw-in-live`, `rules-goal-kick-live` (gated, non-browserParity, 1800) — same scenarios as the designation streams with only the observation shape differing (browserParity toggles the CPU observation layout, not the core determinism); budget decision.
- `rules-corner-goalkick-neighbour` (400) — redundant discriminating control whose corner criteria are NOT_EVALUATED and whose goal-kick criteria are subsumed.

COMMON-DETERMINISTIC for the rules suite is therefore reported over the **attested representative set**, and the excluded streams are disclosed (they do not change the engine-determinism conclusion).

## Goalkeepers suite — updated verdict table

Loaded from `docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/suite-deterministic-two-run.json` (record_sha256 `abaf6cc…`). **No suite-level PASS claim** — the suite has a BLOCKED_MISSING_REFERENCE (GK-*-REF) and a NEEDS_PERCEPTUAL_REVIEW (GK-*-VIS) catalog family.

| Family | Criterion | Outcome |
|---|---|---|
| GK behavior | GK-POSITIONING-HOLD | PASS |
| GK behavior | GK-NO-FIELD-CHASE | PASS |
| GK behavior | GK-SAVE-CLAIM | PASS (driven shot fixture) |
| GK behavior | GK-ROLE-DESIGNATION | PASS |
| GK behavior | GK-DISTRIBUTION-NO-OMNISCIENCE | PASS (organic continuous) |
| common | COMMON-FINITE | PASS |
| common | **COMMON-DETERMINISTIC** | **PASS** (two-run byte-identity; was NOT_EVALUATED single-run) |
| common | COMMON-REFERENCES | PASS |
| common | COMMON-BOUNDS | PASS |
| catalog | GK-*-REF | BLOCKED_MISSING_REFERENCE |
| catalog | GK-*-VIS | NEEDS_PERCEPTUAL_REVIEW |
| catalog | GK-*-REG | NOT_EVALUATED |
| catalog | GK-*-CAUSAL | NOT_EVALUATED |

**Counts: 9 PASS, 0 FAIL, 2 NOT_EVALUATED, 1 BLOCKED_MISSING_REFERENCE, 1 NEEDS_PERCEPTUAL_REVIEW.**

## Rules suite — updated verdict table

The 25 §15 MATCH-* criteria are unchanged (23 PASS / 2 BLOCKED / 0 NOT_EVALUATED / 0 FAIL); COMMON-DETERMINISTIC is added as a determinism attestation row (not a §15 rule) and evaluates to PASS.

**Counts (25 MATCH-* criteria): 23 PASS, 2 BLOCKED_MISSING_REFERENCE, 0 NOT_EVALUATED, 0 FAIL.**
**Counts (with the COMMON-DETERMINISTIC attestation row): 24 PASS, 2 BLOCKED_MISSING_REFERENCE, 0 NOT_EVALUATED, 0 FAIL.**

The 2 blocked references (MATCH-CORNER-KICK-CROSS, MATCH-GOAL-KICK-DISTRIBUTION) stay BLOCKED_MISSING_REFERENCE. No §15 criterion changed; every attested stream reproduced its per-criterion outcomes identically (`attested_per_criterion_regressions` is empty).

## Verdict deltas vs the two accepted baselines

### vs GK-SUITE-CORE-OWNED-STATE (baseline record_sha256 `5cd1c808…`)

Baseline counts: 8 PASS / 3 NOT_EVALUATED / 1 BLOCKED / 1 NEEDS_PERCEPTUAL_REVIEW / 0 FAIL.

| Criterion | Baseline | Current | Changed |
|---|---|---|---|
| **COMMON-DETERMINISTIC** | NOT_EVALUATED | PASS | **yes (only change)** |
| GK-POSITIONING-HOLD / GK-NO-FIELD-CHASE / GK-SAVE-CLAIM / GK-ROLE-DESIGNATION / GK-DISTRIBUTION-NO-OMNISCIENCE | PASS | PASS | no |
| COMMON-FINITE / COMMON-REFERENCES / COMMON-BOUNDS | PASS | PASS | no |
| GK-*-REF | BLOCKED_MISSING_REFERENCE | BLOCKED_MISSING_REFERENCE | no |
| GK-*-VIS | NEEDS_PERCEPTUAL_REVIEW | NEEDS_PERCEPTUAL_REVIEW | no |
| GK-*-REG / GK-*-CAUSAL | NOT_EVALUATED | NOT_EVALUATED | no |

**Net:** 1 verdict change (COMMON-DETERMINISTIC NOT_EVALUATED → PASS). Everything else re-attributed but unchanged.

### vs RULES-SUITE-STATE-RERUN (baseline record_sha256 `36fc77e5…`)

Baseline counts: 23 PASS / 2 BLOCKED_MISSING_REFERENCE / 0 NOT_EVALUATED / 0 FAIL.

The 25 §15 MATCH-* verdicts are **unchanged** (23 PASS / 2 BLOCKED / 0 NOT_EVALUATED / 0 FAIL); blocked references stay blocked. The only new element is the **COMMON-DETERMINISTIC** determinism attestation row, which evaluates to **PASS** (over the attested representative streams). No §15 criterion changed; `attested_per_criterion_regressions` is empty.

---

## Provenance / reproduction

The record is regenerated by:

```
WIP_SECTION=__EVIDENCE__:SUITE-DETERMINISTIC-TWO-RUN \
  mise exec -- pnpm exec tsx scripts/capture-suite-deterministic-two-run.ts
```

Each attested stream is reproduced twice through the same exported production runner (`runHeadlessMatch` with `lifecyclePhaseSync: "core-owned"` plus the gated `serializeRestartFacts` / `browserParityObservations` options), the per-tick `stateHashes` chain and the full observation stream are compared run-1 vs run-2, and the suite is physically evaluated over the run-1 observations via `evaluateSuite`. No outcome is hand-written. The record carries no wall-clock field, so consecutive ordinary-mode runs are byte-identical and leave `docs/` byte-identical.

## known_gaps

- The rules determinism attestation covers a **representative subset** of the verdict-carrying streams; the non-parity gated throw-in / goal-kick streams and the non-gated baselines are disclosed as excluded (budget + redundant control). This is a scoping disclosure, not a forced outcome.
- The GK `COMMON-DETERMINISTIC` is resolved from the two-run attestation and overlaid at the suite level; each attested run's *single-run* COMMON-DETERMINISTIC remains NOT_EVALUATED (the single-run evaluator cannot resolve it), which is how the resolved verdict is honestly distinguished from a single-run claim.
- The `GK-SUITE-CORE-OWNED-STATE-binding` reproduction and one restart/match determinism run each surfaced the known non-fatal vitest worker-RPC infra timeout (`Timeout calling "onTaskUpdate"`); it is a reporting/timing artifact (same as documented in the accepted GK-SUITE-CORE-OWNED-STATE / RESTART-DESIGNATION records), not an assertion failure — every test file passed.

## claims_not_made

- No suite-level PASS claim: the goalkeepers suite has 1 BLOCKED_MISSING_REFERENCE + 1 NEEDS_PERCEPTUAL_REVIEW + 2 NOT_EVALUATED catalog criteria; the rules suite has 2 BLOCKED_MISSING_REFERENCE criteria. Neither reduces to a suite PASS.
- No PROMOTION claim.
- No PES 2017 fidelity / measured PES envelope claim.
- No FOUNDATION_LAB_PASS claim.
- No invented reference envelope or tolerance; BLOCKED_MISSING_REFERENCE stays BLOCKED_MISSING_REFERENCE.
- No criterion is upgraded beyond what the two-run attestation / executed evaluator returns: COMMON-DETERMINISTIC is PASS only where run 1 and run 2 are byte-identical; it would be FAIL honestly if they diverged (never forced).
- No gameplay / source / contract / adapter / spec change: `git diff src/ src/adapters/ eval/runners/ eval/oracles/ eval/invariants/ eval/contracts/ eval/scenarios/ specs/` is EMPTY; only evidence + a binding test + this producer are added.
- No accepted record mutation: GK-SUITE-CORE-OWNED-STATE (`5cd1c808…`) and RULES-SUITE-STATE-RERUN (`36fc77e5…`) stay byte-untouched.
