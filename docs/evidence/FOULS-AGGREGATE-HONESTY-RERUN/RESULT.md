# FOULS-AGGREGATE-HONESTY-RERUN — builder result

## Builder report

- **objective_id:** FOULS-AGGREGATE-HONESTY-RERUN
- **builder_agent:** builder-structured
- **builder_model:** deepseek-v4-flash
- **evidence_class:** BOOKKEEPING
- **hypothesis:** After the GK-*-REG conversion (GK-REGRESSION-POLICY-REGISTRATION, record `fc7d1b97…`, GOALKEEPER_SPEC §11.2) the goalkeepers aggregate verdict table still read 9/0/2/1/1. This objective re-publishes the honest aggregate state by re-running the registered `goalkeepers` suite **with the canary live** over the accepted GK streams and the registered `fouls` suite over the accepted fouls + free-kick consequence streams, and by folding the accumulated disclosed cosmetic threads (the `FREE_KICK_POSITION_TOLERANCE` prose disclosure, two stale test comments/titles, the `FOULS_CARDS_SPEC` §2.1/§2.2 staleness, the missing package.json capture-script registrations) with **zero verdict changes** proven directly. BOOKKEEPING — a deterministic re-publication over existing MULTI_TICK streams; zero source change. No suite-level PASS claim; blocked/perceptual/CAUSAL keys stay.

### files_changed / added

**Zero changes to `src/` or `src/contracts/`** (verified: `git diff src/ src/contracts/` is EMPTY). All changes are evidence, a new record producer, a new binding test, and the disclosed cosmetic folds. No evaluator / oracle / invariant / observation / scenario / registry / contract change.

| Path | Change |
|---|---|
| `scripts/capture-fouls-aggregate-honesty-rerun.ts` | NEW — byte-reproducible record producer; WIP_SECTION-gated durable write; composes both aggregates over the re-run accepted streams. |
| `docs/evidence/FOULS-AGGREGATE-HONESTY-RERUN/fouls-aggregate-honesty-rerun.json` | NEW — durable verdict record, `record_sha256` `c8b3b63e…`. |
| `docs/evidence/FOULS-AGGREGATE-HONESTY-RERUN/RESULT.md` | this report. |
| `docs/evidence/FOULS-AGGREGATE-HONESTY-RERUN/audit.json` | NEW — `gauntlet:audit` output, status `PASS` (20 checks). |
| `tests/unit/eval/fouls-aggregate-honesty-rerun-binding.test.ts` | NEW — binding tests. |
| `eval/oracles/fouls.ts` | cosmetic **prose only** — added the `FREE_KICK_POSITION_TOLERANCE` disclosure line to the FREE-KICK-AWARD criterion JSDoc. |
| `specs/FOULS_CARDS_SPEC.md` | cosmetic **text only** — §2.1 criteria bullet + §2.2 first bullet staleness. |
| `tests/unit/eval/fouls-suite-binding.test.ts` | cosmetic comment only (line 45). |
| `tests/unit/eval/foul-consequence-machinery-binding.test.ts` | cosmetic title only (line 187); assertion unchanged. |
| `package.json` | added two capture-script registrations (`capture-human-ball-server-literal`, `capture-foul-consequence-machinery`). |

The three pre-existing captured records I re-publish from (GK-SUITE-CORE-OWNED-STATE `5cd1c808…`, SUITE-DETERMINISTIC-TWO-RUN `abaf6ccd…`, GK-DRIVEN-CLOSURE `21a59627…`, GK-REGRESSION-POLICY-REGISTRATION `fc7d1b97…`, FOUL-SUITE-REGISTRATION `5e538e5d…`, FOUL-CONSEQUENCE-MACHINERY `39da80ad…`, FREE-KICK-SUITE-REGISTRATION `86a34acb…`) are byte-untouched.

### commands_run (actual exit codes)

| Command | Exit |
|---|---|
| `mise exec -- pnpm exec tsx scripts/capture-fouls-aggregate-honesty-rerun.ts` (ordinary mode ×2) | 0 — record_sha256 `c8b3b63e…` identical both runs; leaves `docs/` byte-identical (SHA `090451c5…` unchanged); writes `test-results/gauntlet-capture/`. |
| `WIP_SECTION=__EVIDENCE__:FOULS-AGGREGATE-HONESTY-RERUN mise exec -- pnpm exec tsx scripts/capture-fouls-aggregate-honesty-rerun.ts` | 0 (wrote `docs/evidence/FOULS-AGGREGATE-HONESTY-RERUN/fouls-aggregate-honesty-rerun.json`; record_sha256 `c8b3b63e…`) |
| `mise exec -- pnpm run typecheck` | 0 (core + node + browser clean) |
| `mise exec -- pnpm exec vitest run tests/unit/eval/fouls-aggregate-honesty-rerun-binding.test.ts --project node --testTimeout 300000` | 0 (9/9 see tests_run) |
| `mise exec -- pnpm exec vitest run tests/unit/eval/{fouls-suite-binding,fouls-spec-binding}.test.ts --project node --testTimeout 300000` | 0 (66/66) |
| `mise exec -- pnpm exec vitest run tests/unit/eval/foul-consequence-machinery-binding.test.ts --project node --testTimeout 300000` | 0 (7/7) |
| `mise exec -- pnpm exec vitest run tests/unit/eval/{foul-detection-machinery-binding,goalkeepers-suite,gk-oracle,GK-KEEPER-ORACLE-REGISTRATION-binding,GK-SUITE-ORGANIC-STATE-binding,GK-SUITE-VERDICTS-STATE-binding}.test.ts --project node --testTimeout 300000` | 0 (76/76) |
| `mise exec -- pnpm exec vitest run tests/unit/eval/{GK-REGRESSION-POLICY-REGISTRATION-binding,GK-DRIVEN-CLOSURE-binding}.test.ts --project node --testTimeout 300000` | 51/51 PASS; vitest exit 1 due to the documented non-fatal `[vitest-worker]: Timeout calling "onTaskUpdate"` — no assertion failure. |
| `mise exec -- pnpm exec vitest run tests/unit/eval/{GK-SUITE-CORE-OWNED-STATE-binding,GK-CORE-OWNED-ARC-FIX-guard,GK-GOALLINE-BOUNDS-RESIDUAL-guard}.test.ts --project node --testTimeout 300000` | 24/24 PASS; vitest exit 1 due to the same non-fatal worker-RPC artifact. |
| `mise exec -- pnpm exec vitest run tests/unit/eval/{eval-registry,duels-suite,oracle-registry,mutant-core}.test.ts --project node --testTimeout 300000` | 0 (139/139) |
| `mise exec -- pnpm exec vitest run tests/candidate-scope.node.test.ts tests/evidence-sanity.node.test.ts tests/capture-hygiene.node.test.ts --project node --testTimeout 300000` | 0 (8/8) |
| `mise exec -- pnpm run capture-human-ball-server-literal` | 0 (reproduces record_sha256 `85fc082d…`) |
| `mise exec -- pnpm run capture-foul-consequence-machinery` | 0 (reproduces record_sha256 `39da80ad…`) |
| `mise exec -- pnpm run gauntlet:audit -- --objective FOULS-AGGREGATE-HONESTY-RERUN --class BOOKKEEPING --tests-pass true` | 0 (status PASS; see `docs/evidence/FOULS-AGGREGATE-HONESTY-RERUN/audit.json`) |

### tests_run

- **fouls-aggregate-honesty-rerun-binding.test.ts** — 9 tests, PASS (record shape; `record_sha256` byte-reproducible recompute + no wall-clock field; GK aggregate 9/0/2/1/1 → 10/0/1/1/1 with a single `reg` NOT_EVALUATED→PASS delta and source-stream attribution; the other GK catalog keys stay REF=BLOCKED/VIS=NEEDS_PERCEPTUAL_REVIEW/CAUSAL=NOT_EVALUATED; every reproduced stream character-identical to its accepted state-hash pin; fouls 3-of-5 registered all PASS with FREE-KICK-AWARD sourced from `freekick-organic`; power-guard streams excluded + listed; card/advantage named-not-registered; negative controls on PROMOTION / PES / FOUNDATION_LAB_PASS / suite-level PASS; not hand-written reproduction of gk-release-fixture (GK-*-REG PASS) and freekick-organic (FREE-KICK-AWARD PASS) + the anti-huddle power-guard FAIL).
- **fouls-suite-binding + fouls-spec-binding** — 66/66 PASS (`fouls-suite-binding` 24; `fouls-spec-binding` 42). Both were ALSO run at the pre-edit HEAD state (via `git stash` of the edited files): **66/66 PASS before and after** — zero verdict changes from the comment + §2.1/§2.2 edits.
- **foul-consequence-machinery-binding** — 7/7 PASS after the title edit; 7/7 PASS at the pre-edit title (the non-zero exit on the before run is the documented non-fatal worker-RPC artifact, not an assertion failure). Verdict-neutral.
- **GK fast group** (foul-detection-machinery / goalkeepers-suite / gk-oracle / GK-KEEPER-ORACLE-REGISTRATION / GK-SUITE-ORGANIC-STATE / GK-SUITE-VERDICTS-STATE) — 76/76 PASS.
- **GK canary + driven-closure** — 51/51 PASS; **GK core-owned + guards** — 24/24 PASS (both long-running groups emit the non-fatal worker-RPC `onTaskUpdate` timeout; all tests passed).
- **eval-registry / duels-suite / oracle-registry / mutant-core** — 139/139 PASS.
- **candidate-scope / evidence-sanity / capture-hygiene** — 8/8 PASS.
- **Typecheck** — exit 0 (core + node + browser clean).
- **gauntlet:audit** — status PASS, 20 checks.

### integration_test_result

`NOT_APPLICABLE` for BOOKKEEPING (integration evidence is required only for MULTI_TICK/DYNAMIC_VISUAL). A relevant integration/provenance gate was still exercised: the `fouls-aggregate-honesty-rerun-binding.test.ts` "not hand-written" test physically reproduces the gk-release-fixture run (through `runHeadlessMatch` with `gkBehavior:true` + the canary) and the freekick-organic run (through the production runner + `evaluateSuite("fouls", …)`) and confirms the pinned GK-*-REG PASS and FREE-KICK-AWARD PASS verdicts; the anti-huddle power-guard run is also reproduced and confirmed to FAIL.

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing.

### required_evidence

- Deterministic audit: `docs/evidence/FOULS-AGGREGATE-HONESTY-RERUN/audit.json` (status `PASS`).
- Durable verdict record: `docs/evidence/FOULS-AGGREGATE-HONESTY-RERUN/fouls-aggregate-honesty-rerun.json` (`record_sha256` `c8b3b63e…`; byte-reproducible; no wall-clock field; ordinary runs leave `docs/` byte-identical).
- Executed tests (BOOKKEEPING): the aggregate binding gate, the fouls-suite/spec bindings, the foul-consequence binding, the GK/keeper neighbour matrix, the wider eval-registry battery, and the candidate-scope/evidence-sanity/capture-hygiene gate.

### artifacts

- `docs/evidence/FOULS-AGGREGATE-HONESTY-RERUN/fouls-aggregate-honesty-rerun.json`
- `docs/evidence/FOULS-AGGREGATE-HONESTY-RERUN/audit.json`
- `docs/evidence/FOULS-AGGREGATE-HONESTY-RERUN/RESULT.md`
- `scripts/capture-fouls-aggregate-honesty-rerun.ts`
- `tests/unit/eval/fouls-aggregate-honesty-rerun-binding.test.ts`

### spec_sections

- `specs/FOULS_CARDS_SPEC.md` §2.1 / §2.2 (the folded staleness), §5.1/§5.2, §8, §10.
- `specs/GOALKEEPER_SPEC.md` §11.2 (the GK regression policy the canary enforces).
- `eval/oracles/fouls.ts` (the FREE-KICK-AWARD criterion), `eval/oracles/rules-restart.ts` `PLACEMENT_TOLERANCE = 0.2 m` (the tolerance-presentation precedent), `eval/oracles/gk-regression.ts` (the canary).
- `docs/evidence/SUITE-DETERMINISTIC-TWO-RUN/suite-deterministic-two-run.json` (the 9/0/2/1/1 baseline, read verbatim), `docs/evidence/GK-REGRESSION-POLICY-REGISTRATION/gk-regression-policy-registration.json` (the canary per-run verdicts), `docs/evidence/{FOULS-SUITE-REGISTRATION,FREE-KICK-SUITE-REGISTRATION}/…` (the fouls per-criterion verdicts).
- `gauntlet/evidence-contract.md` (BOOKKEEPING), `gauntlet/roles/builder-structured.md` (role contract).

### acceptance_criteria_met

- Re-ran `evaluateSuite("goalkeepers", observations)` with the registered gk-regression canary LIVE over the 3 accepted GK streams (two-run byte-identity attestation + canary) and `evaluateSuite("fouls", observations)` over the accepted fouls + free-kick consequence streams.
- Published the honest **goalkeepers** aggregate: **10 PASS / 0 FAIL / 1 NOT_EVALUATED / 1 BLOCKED_MISSING_REFERENCE / 1 NEEDS_PERCEPTUAL_REVIEW**, delta vs the pinned 9/0/2/1/1 baseline: **exactly one criterion changed — the catalog `reg` key (GK-*-REG) NOT_EVALUATED → executed PASS** through the registered canary, sourced to all 3 GK streams. GK-*-REF stay BLOCKED_MISSING_REFERENCE, GK-*-VIS stay NEEDS_PERCEPTUAL_REVIEW, GK-*-CAUSAL stay NOT_EVALUATED (untouched). The 9 behavior/common keys all stay PASS (COMMON-DETERMINISTIC re-attested by the two-run byte-identity, not forced).
- Published the honest **fouls** verdict state: **3 of the 5 §10 criteria registered and all PASS** (FOUL-DETECT, FOUL-CLEAN-TACKLE from driven-foul-live/organic-foul-live/freekick-driven-duel/freekick-organic; FREE-KICK-AWARD from freekick-organic), with CARD-ISSUED and ADVANTAGE-PLAYED named-not-registered. The deliberate power-guard streams (freekick-antihuddle-window, freekick-human-serve — a free kick with no detected foul → FAIL) are reported separately and excluded from the genuine FREE-KICK-AWARD aggregate (the RULES-SUITE-STATE-RERUN anti-huddle eligibility pattern). **No suite-level PASS claim.**
- Folded all 5 cosmetic threads with zero verdict changes proven directly (see below).
- Record byte-reproducible: `record_sha256` `c8b3b63e…` with NO wall-clock field; two ordinary runs byte-identical; ordinary re-run leaves `docs/` byte-identical.
- Zero gameplay/source/contract change: `git diff src/ src/contracts/` is EMPTY.
- Neighbour batteries green; `mise run typecheck` exit 0; `gauntlet:audit` status PASS.

---

## Goalkeepers aggregate (executed evaluator, canary live)

Loaded from `docs/evidence/FOULS-AGGREGATE-HONESTY-RERUN/fouls-aggregate-honesty-rerun.json` (record_sha256 `c8b3b63e…`). **No suite-level PASS claim** — REF/VIS/CAUSAL keys keep the suite from being a clean PASS.

### Per-criterion outcomes (13 published keys)

| Key | Outcome | Source stream(s) | Why |
|---|---|---|---|
| GK-POSITIONING-HOLD | **PASS** | gk-continuous / gk-shot / gk-release | keeper holds its arc with bounded drift (re-home on) |
| GK-NO-FIELD-CHASE | **PASS** | gk-continuous / gk-shot / gk-release | keeper never joins the field chase |
| GK-SAVE-CLAIM | **PASS** | gk-shot-fixture | in-reach save/claim contact within the reaction window (driven) |
| GK-ROLE-DESIGNATION | **PASS** | gk-continuous / gk-shot / gk-release | exactly one designated keeper per team |
| GK-DISTRIBUTION-NO-OMNISCIENCE | **PASS** | gk-continuous / gk-release | release to an observed teammate, no omniscience |
| COMMON-FINITE | **PASS** | all runs | every numeric field finite |
| COMMON-DETERMINISTIC | **PASS** | all runs (two-run) | two-byte-identical runs per stream (re-attested here) |
| COMMON-REFERENCES | **PASS** | all runs | all stable IDs/event references resolve |
| COMMON-BOUNDS | **PASS** | all runs | hard world/scenario bounds respected |
| `ref` (GK-*-REF) | **BLOCKED_MISSING_REFERENCE** | all runs | no eligible ReferenceTarget; stays blocked |
| `vis` (GK-*-VIS) | **NEEDS_PERCEPTUAL_REVIEW** | all runs | no versioned perceptual rubric |
| `reg` (GK-*-REG) | **PASS** | gk-continuous / gk-shot / gk-release | **converted NOT_EVALUATED → executed PASS via the registered gk-regression canary** |
| `causal` (GK-*-CAUSAL) | **NOT_EVALUATED** | all runs | unknown class; stays NOT_EVALUATED |

**Counts: 10 PASS / 0 FAIL / 1 NOT_EVALUATED / 1 BLOCKED_MISSING_REFERENCE / 1 NEEDS_PERCEPTUAL_REVIEW.**

### Delta vs the SUITE-DETERMINISTIC-TWO-RUN baseline (`abaf6ccd…`, 9/0/2/1/1)

| Criterion | From → To | Source stream(s) |
|---|---|---|
| `reg` (GK-*-REG) | **NOT_EVALUATED → PASS** | gk-continuous-live, gk-shot-fixture-live, gk-release-fixture-live |

**Unchanged (12):** the 9 behavior/common keys (all stay PASS) plus `ref` (BLOCKED_MISSING_REFERENCE), `vis` (NEEDS_PERCEPTUAL_REVIEW) and `causal` (NOT_EVALUATED).

**Net count change:** 9→10 PASS, 2→1 NOT_EVALUATED (the `reg` row). No FAIL introduced.

---

## Fouls suite verdict state (executed evaluator)

The `fouls` suite (suite-fouls-v1) over the accepted fouls + free-kick consequence streams. **3 of the 5 FOULS_CARDS_SPEC §10 criteria registered.** No suite-level PASS claim.

### Per-criterion outcomes

| Criterion | Outcome | Source stream(s) | Note |
|---|---|---|---|
| FOUL-DETECT | **PASS** | driven-foul-live, organic-foul-live, freekick-driven-duel, freekick-organic | emitted foul(s) match §5.1 and are grounded in genuine man-not-ball contacts |
| FOUL-CLEAN-TACKLE | **PASS** | driven-foul-live, organic-foul-live, freekick-driven-duel, freekick-organic | §5.2 complement holds; no clean/shoulder contact emits a foul |
| FREE-KICK-AWARD | **PASS** | freekick-organic | a detected foul yields a free kick to the fouled team at the contact position (§10) |
| CARD-ISSUED | NAMED-NOT-REGISTERED | — | no criterion / oracle / invariant / binding; no verdict |
| ADVANTAGE-PLAYED | NAMED-NOT-REGISTERED | — | no criterion / oracle / invariant / binding; no verdict |

**Counts (registered criteria): 3 PASS / 0 FAIL / 0 NOT_EVALUATED / 0 BLOCKED_MISSING_REFERENCE / 0 NEEDS_PERCEPTUAL_REVIEW; 2 named-not-registered.**

**Power-guard streams (deliberate FAIL, excluded from the genuine FREE-KICK-AWARD aggregate):** `freekick-antihuddle-window`, `freekick-human-serve` — each awards a free kick with NO detected foul, which FREE-KICK-AWARD FAILs (a free kick is the consequence of a called foul, §10). Also per stream: the driven-duel and organic-foul-live carry a foul but NO observable free-kick-executed → FREE-KICK-AWARD NOT_EVALUATED (the driven shape commits the free kick in the core's persistent state; the runner serialization limit); the gate-off / stashed streams emit neither a foul nor a free kick → all NOT_EVALUATED (cited from the accepted records, not re-run).

---

## Cosmetic-fold verification (each thread closed, verdict-neutral)

1. **FREE_KICK_POSITION_TOLERANCE prose (eval/oracles/fouls.ts)** — added an explicit prose disclosure line to the FREE-KICK-AWARD **criterion** JSDoc stating the placement tolerance is 0.5 m and that it mirrors the accepted rules placement-oracle tolerance pattern (`rules-restart PLACEMENT_TOLERANCE = 0.2 m`). **Doc-only JSDoc addition** (recorded by the `src/`-empty diff); the constant and comparison logic are unchanged. Verified: `fouls-suite-binding` (24/24) + `foul-consequence-machinery-binding` (7/7) + typecheck green.
2. **Stale comment at `fouls-suite-binding.test.ts:45`** — "only the two registered" → "the three registered". Comment-only. Verified before (via stash) and after: 66/66 identical.
3. **Stale title at `foul-consequence-machinery-binding.test.ts:187`** — "registers no FREE-KICK-AWARD criterion" → "the RULES suite does not carry FREE-KICK-AWARD (a fouls-suite criterion)". **Assertion unchanged** (it checks the RULES suite, where FREE-KICK-AWARD is correctly undefined); only the title string changed. Verified before/after: 7/7 identical.
4. **FOULS_CARDS_SPEC §2.1/§2.2 staleness** — §2.1 criteria bullet now states FOUL-DETECT / FOUL-CLEAN-TACKLE / FREE-KICK-AWARD are registered as executable protected oracles in `suite-fouls-v1`, with CARD-ISSUED / ADVANTAGE-PLAYED specified-but-NOT-registered; §2.2 first bullet now states there is no card/advantage implementation (foul detection + free-kick consequence are the accepted, registered machinery). **The `fouls-spec-binding` phrase assertions stay green: 42/42 before and after.** I verified what it pins first: the only §2.1/§2.2-adjacent assertions are (i) `SPEC.toContain("NOT registered")` — still satisfied (the 2 unregistered criteria), (ii) `SPEC.toContain(name)` for all 5 criterion names — still satisfied (§2.1 names all 5), (iii) the deferred `free kick` / `accepted restart machinery` / `match-rules-v1` assertions — satisfied by the §2.1 set-piece bullet (not edited), and (iv) `SPEC.toContain("Offside"/"regulation-only"/"Penalty kicks")` — satisfied by §2.2's unchanged offside/penalty bullet and §16. **No `fouls-spec-binding` assertion required adjustment** — none of the §2.1/§2.2 edits broke a pinned phrase.
5. **Missing package.json capture-script registrations** — added `capture-human-ball-server-literal` and `capture-foul-consequence-machinery`. Both smoke-checked `exit 0` and reproduce their accepted record_sha256 (`85fc082d…`, `39da80ad…`). The third listed name `capture-foul-freekick-browser-evidence` is present in `package.json` as the DYNAMIC_VISUAL browser-frames vitest capture; its durable **tsx record producer** (`scripts/capture-foul-freekick-browser-evidence.ts`) is registered under `capture-foul-freekick-browser-record`. Adding a key with the same name is impossible without overwriting the browser-frames test, so the record producer remains registered under its existing `-record` name — disclosed.

**Verdict-neutrality:** the only executable-behaviour edits are the 4 cosmetic fold changes (comment/title/prose/spec-text) and 2 new package.json script entries. None alters an evaluator, oracle, invariant, contract, registry, or a source value. Confirmed by the before/after binding-suite runs (fouls-suite-binding + fouls-spec-binding 66/66 both; foul-consequence-machinery 7/7 both) and the empty `git diff src/ src/contracts/`.

---

## Provenance / reproduction

The record is regenerated by:

```
WIP_SECTION=__EVIDENCE__:FOULS-AGGREGATE-HONESTY-RERUN \
  mise exec -- pnpm exec tsx scripts/capture-fouls-aggregate-honesty-rerun.ts
```

Every headless stream is reproduced through the same exported production runner (`runHeadlessMatch` / `runDefensiveDuel`), the `detectFoulEvents` pass where the stream needs it, and the registered `evaluateSuite("goalkeepers"|"fouls", …)` entry point. No outcome is hand-written. Each GK stream is re-attested with a two-run byte-identity check (COMMON-DETERMINISTIC resolved honestly) and compared against its accepted state-hash pin; each fouls stream is character-identical to its accepted pin. The record carries no wall-clock field, so consecutive ordinary-mode runs are byte-identical (record_sha256 `c8b3b63e…`) and leave `docs/` byte-identical.

## known_gaps / disclosures

- **Residual `FOULS_CARDS_SPEC` preamble staleness:** the document's Status/Scope preamble still states "NO foul, card, advantage, or free-kick behavior is implemented" and "The engine has NO foul machinery yet". This is a FOULS-SPEC-DRAFT-era framing; the foul-detection/free-kick machinery is in fact accepted. It is **left in place** because (a) the `fouls-spec-binding.test.ts` pins the exact phrase "NO foul, card, advantage, or free-kick behavior is implemented" (`toContain`, line ~83) and (b) the objective scopes the spec fold to §2.1/§2.2, not the preamble. The §2.1/§2.2 edits now reflect the implemented state; the preamble is a disclosed known gap.
- **The `fouls-suite-binding.test.ts` header comment (lines ~3–19) still says FREE-KICK-AWARD stays named-but-unregistered** (a FOULS-SUITE-REGISTRATION-era artifact). It is outside the flagged line-45 comment scope and is disclosed here; the live table above reflects FREE-KICK-AWARD as registered.
- **The `foul-consequence-machinery-binding.test.ts` header comment (line ~24) still says "no FREE-KICK-AWARD criterion is registered."** It is outside the flagged title scope (the objective scoped the line-187 title only) and is disclosed here; FREE-KICK-AWARD is registered in the `fouls` suite, and the title (the in-scope fix) now says the RULES suite does not carry it.
- **organic-foul-stashed / freekick-gate-off** (both emit neither a foul nor a free kick → all-NOT_EVALUATED deterministic no-verdict controls) are cited from the accepted records rather than re-run, to bound runtime; they cannot change any aggregate verdict.
- **Runtime / chunking:** the capture producer runs ~207 s and the long GK/foul-consequence/mutant binding tests emit the pre-existing non-fatal `[vitest-worker]: Timeout calling "onTaskUpdate"` RPC artifact (all assertions pass; the non-zero vitest exits are this artifact, documented in prior accepted records).
- No gameplay inference about the CORE's correctness is drawn from any PASS; verdicts are statements that an accepted driven/organic stream satisfies the registered criterion, not a PES fidelity or full-regulation claim.

## claims_not_made

- No suite-level PASS claim for either suite: the goalkeepers suite keeps REF=BLOCKED_MISSING_REFERENCE / VIS=NEEDS_PERCEPTUAL_REVIEW / CAUSAL=NOT_EVALUATED; the fouls suite keeps CARD-ISSUED + ADVANTAGE-PLAYED named-not-registered and FREE-KICK-AWARD is carried only by the organic stream with the power-guard FAILs disclosed.
- No PROMOTION claim. No FOUNDATION_LAB_PASS claim. No milestone PASS claim.
- No PES 2017 fidelity claim. No invented reference envelope or tolerance claim; the GK-*-REF BLOCKED_MISSING_REFERENCE values stay blocked and no reference target is invented.
- No criterion is upgraded beyond what the executed evaluator returns: only the REGRESSION-class GK-*-REG criteria resolve through the registered gk-regression canary; GK-*-REF / GK-*-VIS / GK-*-CAUSAL stay as they are; FREE-KICK-AWARD's PASS is the executed organic-stream verdict with the deliberate power-guard FAILs disclosed.
- No gameplay / source / contract / adapter change: `git diff src/ src/contracts/` is EMPTY; only evidence + a binding test + the record producer are added.
