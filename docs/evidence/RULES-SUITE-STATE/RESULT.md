# RULES-SUITE-STATE — builder result

## Builder report

- **objective_id:** RULES-SUITE-STATE
- **builder_agent:** builder-structured
- **builder_model:** deepseek-v4-flash
- **evidence_class:** BOOKKEEPING
- **hypothesis:** Re-running the registered `rules` evaluator suite (`evaluateSuite("rules", observations)`) over the conformance evidence streams — the accepted restart fixtures under the core-owned lifecycle without serialization, plus the RESTART-RULES-CONFORMANCE driven streams with the gated `serializeRestartFacts` observation extension — produces the CURRENT honest per-rule verdict table. The serialization gate makes MATCH-THROW-IN-AWARD / MATCH-GOAL-KICK-AWARD / MATCH-TIMER-FREEZE genuinely measurable (NOT_EVALUATED → PASS on the driven streams); blocked references stay `BLOCKED_MISSING_REFERENCE`; MATCH-CORNER-KICK-AWARD stays NOT_EVALUATED (no corner execution is observed); no suite-level PASS claim is made. This is evidence + bookkeeping only: zero gameplay/source change.

### files_changed

- `scripts/capture-rules-suite-verdicts-state.ts` (NEW — deterministic record producer; WIP_SECTION-gated durable write; no wall-clock field in the record; reads the RULES-SUITE-REGISTRATION `verdict_summary` verbatim for the delta disclosure).
- `docs/evidence/RULES-SUITE-STATE/rules-suite-verdicts-state.json` (NEW — durable current verdict table, `record_sha256` pinned).
- `docs/evidence/RULES-SUITE-STATE/audit.json` (NEW — `gauntlet:audit` output, status `PASS`).
- `docs/evidence/RULES-SUITE-STATE/RESULT.md` (NEW — this result).
- `tests/unit/eval/RULES-SUITE-STATE-binding.test.ts` (NEW — 10 binding tests).

**Zero changes** to `src/`, `src/simulation/`, `src/contracts/`, `src/adapters/`, `eval/runners/`, `eval/oracles/`, `eval/invariants/`, `eval/scenarios/`, `eval/contracts/`, or `specs/` (verified: `git diff -- src/ eval/runners/ eval/oracles/ eval/invariants/ eval/scenarios/ specs/` is empty — the command printed nothing). No evaluator, oracle, invariant, observation, scenario, binding, or spec was touched.

### commands_run

- cmd: `mise run typecheck`
    exit_code: 0
    result: "tsc core + node + browser all clean"
- cmd: `mise exec -- pnpm exec tsx scripts/capture-rules-suite-verdicts-state.ts` (ordinary-mode run 1)
    exit_code: 0
    result: "wrote test-results/gauntlet-capture/RULES-SUITE-STATE/rules-suite-verdicts-state.json (record_sha256=bae56e5a63463bcf79b01e6d32d17b063501d468ee63b8605f16d467abb8f930; 5 runs: 3 baseline + 2 driven)"
- cmd: `mise exec -- pnpm exec tsx scripts/capture-rules-suite-verdicts-state.ts` (ordinary-mode run 2 — byte-identity demonstration)
    exit_code: 0
    result: "record_sha256=bae56e5a… (identical); the two ordinary artifacts are byte-identical (sha256 3dfece1f47caed57cc86488345782f3aad4c50b37df3f04244a830629fb8e9f6 === 3dfece1f47caed57cc86488345782f3aad4c50b37df3f04244a830629fb8e9f6; diff empty; cmp identical)"
- cmd: `WIP_SECTION=__EVIDENCE__:RULES-SUITE-STATE mise exec -- pnpm exec tsx scripts/capture-rules-suite-verdicts-state.ts`
    exit_code: 0
    result: "wrote docs/evidence/RULES-SUITE-STATE/rules-suite-verdicts-state.json (durable-evidence; record_sha256=bae56e5a63463bcf79b01e6d32d17b063501d468ee63b8605f16d467abb8f930; 5 runs)"
- cmd: `mise exec -- pnpm exec tsx scripts/capture-rules-suite-verdicts-state.ts` (ordinary-mode run 3 — docs byte-identity check)
    exit_code: 0
    result: "docs/evidence/RULES-SUITE-STATE/rules-suite-verdicts-state.json sha256 unchanged (3dfece1f… before === 3dfece1f… after); DOCS_BYTE_IDENTICAL; ephemeral output under test-results/gauntlet-capture/RULES-SUITE-STATE/"
- cmd: `pnpm exec vitest run tests/unit/eval/RULES-SUITE-STATE-binding.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "10/10 PASS (record shape, byte-reproducible record_sha256, key AWARD/TIMER-FREEZE PASS, blocked references, corner NOT_EVALUATED, 8 invariants, verdict deltas, discriminating reverted-AWARD guard, no-claim negative control, not-hand-written reproduction)"
- cmd: `pnpm exec vitest run tests/unit/eval/{rules-oracle,rules-suite,RULES-SUITE-REGISTRATION-binding,restart-rules-serialization,RULES-SUITE-STATE-binding}.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "73/73 PASS (rules-oracle 30, rules-suite 17, RULES-SUITE-REGISTRATION-binding 13, restart-rules-serialization 3, RULES-SUITE-STATE-binding 10)"
- cmd: `pnpm exec vitest run tests/unit/eval/{goalkeepers-suite,eval-registry,duels-suite,oracle-registry,mutant-core,gk-oracle,GK-KEEPER-ORACLE-REGISTRATION-binding,GK-SUITE-ORGANIC-STATE-binding,GK-SUITE-VERDICTS-STATE-binding,match-rules-spec-binding}.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "231/231 PASS (duels 39, GK-SUITE-VERDICTS-STATE-binding 11, GK-SUITE-ORGANIC-STATE-binding 8, eval-registry 48, goalkeepers-suite 24, mutant-core 33, GK-KEEPER-ORACLE-REGISTRATION-binding 5, oracle-registry 19, gk-oracle 16, match-rules-spec-binding 28)"
- cmd: `pnpm exec vitest run tests/unit/eval/{foundation-evaluator,playable-1v1-re-evaluation,foundation-lab-evidence-binding.node}.test.ts tests/candidate-scope.node.test.ts tests/evidence-sanity.node.test.ts tests/capture-hygiene.node.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "81/81 PASS (foundation-evaluator 36, playable-1v1-re-evaluation 29, foundation-lab-evidence-binding 8, candidate-scope 2, evidence-sanity 3, capture-hygiene 3)"
- cmd: `mise exec -- pnpm run gauntlet:audit -- --objective RULES-SUITE-STATE --class BOOKKEEPING --tests-pass true --integration-test-pass true`
    exit_code: 0
    result: "status PASS (13 PASS / 7 NOT_APPLICABLE / 0 FAIL — the BOOKKEEPING shape caps the check set at 13 because the tests-result check is NOT_APPLICABLE; tests/screenshot/trajectory/integration/slot checks NOT_APPLICABLE for BOOKKEEPING; all orchestrator state checks PASS)"

### tests_run

- name: `RULES-SUITE-STATE-binding.test.ts`
    result: "PASS (10 tests — record shape, byte-reproducible record_sha256 recompute, key AWARD/TIMER-FREEZE PASS, blocked references stay BLOCKED, corner NOT_EVALUATED, 8 protected invariants, verdict-delta exactness, discriminating reverted-AWARD guard, no-claim negative control, not-hand-written reproduction)"
- name: `rules-oracle.test.ts`
    result: "PASS (30 tests, pre-existing untouched)"
- name: `rules-suite.test.ts`
    result: "PASS (17 tests, pre-existing untouched)"
- name: `RULES-SUITE-REGISTRATION-binding.test.ts`
    result: "PASS (13 tests, pre-existing untouched)"
- name: `restart-rules-serialization.test.ts`
    result: "PASS (3 tests, pre-existing untouched)"
- name: `goalkeepers-suite.test.ts` / `eval-registry.test.ts` / `duels-suite.test.ts` / `oracle-registry.test.ts` / `mutant-core.test.ts` / `gk-oracle.test.ts` / `GK-KEEPER-ORACLE-REGISTRATION-binding.test.ts` / `GK-SUITE-ORGANIC-STATE-binding.test.ts` / `GK-SUITE-VERDICTS-STATE-binding.test.ts` / `match-rules-spec-binding.test.ts`
    result: "PASS (231; pre-existing, untouched neighbour matrix)"
- name: `foundation-evaluator.test.ts` / `playable-1v1-re-evaluation.test.ts` / `foundation-lab-evidence-binding.node.test.ts` / `candidate-scope.node.test.ts` / `evidence-sanity.node.test.ts` / `capture-hygiene.node.test.ts`
    result: "PASS (81) — accepted foundation pins, provenance assertions and capture hygiene reproduce"

### integration_test_result

For `BOOKKEEPING`, the audit marks the integration-test check `NOT_APPLICABLE`. A relevant integration/provenance check was still exercised: the `RULES-SUITE-STATE-binding.test.ts` "not hand-written" test physically reproduces the driven throw-in run through the production runner (`runHeadlessMatch` with `serializeRestartFacts: true`, `lifecyclePhaseSync: "core-owned"`) and the accepted `evaluateSuite("rules", …)` entry point, confirming the evaluator yields the recorded per-criterion outcomes (MATCH-THROW-IN-AWARD PASS, MATCH-TIMER-FREEZE PASS). The accepted foundation/keeper/GK provenance gates reproduce.

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing.

### required_evidence

- Deterministic audit: `docs/evidence/RULES-SUITE-STATE/audit.json` (status `PASS`).
- Executed tests (BOOKKEEPING): the 10-test binding gate, the 73-test rules gate, the 231-test neighbour matrix, and the 81-test foundation/provenance/hygiene gate.
- Durable current verdict table: `docs/evidence/RULES-SUITE-STATE/rules-suite-verdicts-state.json` (`record_sha256` bae56e5a…; byte-reproducible across ordinary-mode re-runs; no wall-clock field).

### artifacts

- `docs/evidence/RULES-SUITE-STATE/rules-suite-verdicts-state.json`
- `docs/evidence/RULES-SUITE-STATE/audit.json`
- `docs/evidence/RULES-SUITE-STATE/RESULT.md`
- `scripts/capture-rules-suite-verdicts-state.ts`
- `tests/unit/eval/RULES-SUITE-STATE-binding.test.ts`

### spec_sections

- `specs/MATCH_RULES_SPEC.md` §5–§11 (out-of-play, throw-in, goal kick, corner kick, kickoff/reset, scoring, timing), §14 (BLOCKED_MISSING_REFERENCE), §15 (the adjudicating criteria re-run here), §17 (declaration of limitations).
- `eval/contracts/suites.ts` (suite-rules-v1), `common-criteria.ts` (the 25 MATCH-* criteria), `invariant-definitions.ts` (the 8 rules invariants).
- `eval/oracles/rules-restart.ts` / `rules-phase.ts` (protected rules oracles), `eval/runners/foundation-evaluator.ts` (criterion→oracle resolution, unchanged), `eval/runners/headless-match.ts` (gated `serializeRestartFacts`, unchanged).
- `docs/evidence/RULES-SUITE-REGISTRATION/rules-suite-state.json` (the prior-state record compared in `verdict_deltas`).
- `gauntlet/evidence-contract.md` (BOOKKEEPING), `gauntlet/roles/builder-structured.md` (role contract).

### acceptance_criteria_met

- Re-ran `evaluateSuite("rules", observations)` over the conformance evidence streams: the 3 accepted restart fixtures under core-owned (no serialization) + the 2 RESTART-RULES-CONFORMANCE driven streams with `serializeRestartFacts: true`.
- Current honest verdict table (all 25 MATCH-* criteria, per-criterion outcome + source run + one-line reason): see below.
- The 8 protected rules invariants captured directly by executing each protected oracle over the streams (7 PASS, corner-kick-award NOT_EVALUATED).
- Verdict-comparison disclosure: exactly 3 criteria changed (MATCH-THROW-IN-AWARD, MATCH-GOAL-KICK-AWARD, MATCH-TIMER-FREEZE: NOT_EVALUATED → PASS), each solely due to the gated `serializeRestartFacts` observation extension; 22 criteria unchanged (blocked references stay BLOCKED; MATCH-CORNER-KICK-AWARD stays NOT_EVALUATED).
- Durable record byte-reproducibility: `rules-suite-verdicts-state.json` has a pinned `record_sha256` (bae56e5a…) with NO wall-clock field in the hashed content; two consecutive ordinary-mode runs are byte-identical (sha256 3dfece1f…); an ordinary-mode run leaves `docs/` byte-identical.
- Zero gameplay/source change: `git diff src/ eval/runners/ eval/oracles/ eval/invariants/ eval/scenarios/ specs/` EMPTY.
- Binding test pins the published verdict-table structure + key verdicts, and is discriminating (a reverted AWARD verdict fails it).
- Neighbour batteries green (rules 73, neighbour 231, foundation/provenance/hygiene 81); `mise run typecheck` exit 0; `gauntlet:audit` status PASS.
- Missing references stay `BLOCKED_MISSING_REFERENCE`; no invented envelope or tolerance.

---

## Current rules-suite verdict table (executed evaluator, not forced)

Loaded from `docs/evidence/RULES-SUITE-STATE/rules-suite-verdicts-state.json` (record_sha256 `bae56e5a…`). **No suite-level PASS claim** — the per-test overall for the rules suite stays `NOT_EVALUATED` / `BLOCKED_MISSING_REFERENCE` (it never reduces to a suite PASS).

### Per-criterion outcomes (25 MATCH-* criteria)

| Criterion (§15) | Outcome | Source run | Why (one line) |
|---|---|---|---|
| MATCH-OUT-OF-PLAY-DETECT | **PASS** | every boundary-carrying run | boundary events carry well-formed payloads; goal / goal-line out-of-play are mutually exclusive |
| MATCH-OUT-OF-PLAY-NO-LAST-TOUCH | **PASS** | rules-throwin-baseline, rules-throw-in-live | every no-last-touch boundary opened no restart; NOT_EVALUATED where every boundary had a resolvable last touch |
| MATCH-KICKOFF-FREEZE | **PASS** | throw-in + arc runs | with a clean multi-body untouched opening window, only the taker + any at-ball body left home |
| MATCH-SCORING-GOAL-DEVENT | **PASS** | every goal-carrying run | every goal event carries a valid goalIndex and is mutually exclusive with goal-line out-of-play |
| MATCH-THROW-IN-AWARD | **PASS** | rules-throw-in-live (driven, 2 executed) | each served throw-in went to the team opposite the last-touch team; NOT_EVALUATED on the non-serialized baseline |
| MATCH-GOAL-KICK-AWARD | **PASS** | rules-goal-kick-live (driven, 1 executed) | the goal kick was awarded to the defending team of the exited goal line; NOT_EVALUATED on the baseline |
| MATCH-TIMER-FREEZE | **PASS** | rules-throw-in-live, rules-goal-kick-live (driven) | the core matchTimer is frozen during the non-playing restart / goal phases; NOT_EVALUATED on the baseline |
| MATCH-CORNER-KICK-AWARD | NOT_EVALUATED | all runs | no driven or organic run produced a corner-kick execution (rare in this engine); not forced to PASS |
| MATCH-CORNER-KICK-CROSS | **BLOCKED_MISSING_REFERENCE** | all runs | §14 `corner_cross_trajectory_ref` blocked |
| MATCH-GOAL-KICK-DISTRIBUTION | **BLOCKED_MISSING_REFERENCE** | all runs | §14 `goal_kick_distribution_ref` blocked |
| MATCH-THROW-IN-PLACEMENT / SERVE / TIMER-FREEZE | NOT_EVALUATED | all runs | no oracle yet for placement / serve / restart-specific timer-freeze semantics |
| MATCH-GOAL-KICK-PLACEMENT / TIMER-FREEZE | NOT_EVALUATED | all runs | no oracle yet for goal-kick placement / restart-specific timer-freeze |
| MATCH-CORNER-KICK-PLACEMENT / TIMER-FREEZE | NOT_EVALUATED | all runs | no oracle yet for corner placement / restart-specific timer-freeze |
| MATCH-KICKOFF-FIRST-TOUCH / MATCH-RESTART-REARM | NOT_EVALUATED | all runs | no oracle yet for first-touch / restart-rearm |
| MATCH-SCORING-GOAL-PHASE | NOT_EVALUATED | all runs | no oracle yet for the playing → goal → playing transition |
| MATCH-TIMER-DECREMENT / HALFTIME / FULLTIME | NOT_EVALUATED | all runs | no oracle yet for decrement / halftime / fulltime |
| MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH / NEAREST-ONLY | NOT_EVALUATED | all runs | no oracle yet for anti-huddle freeze / nearest-only |

**Counts: 7 PASS, 2 BLOCKED_MISSING_REFERENCE, 16 NOT_EVALUATED, 0 FAIL** across the 25 MATCH-* criteria.

### The 8 protected rules invariants

| Invariant | Outcome |
|---|---|
| rules-out-of-play-detect-evidence | PASS |
| rules-out-of-play-no-last-touch-evidence | PASS |
| rules-throw-in-award-evidence | PASS |
| rules-goal-kick-award-evidence | PASS |
| rules-corner-kick-award-evidence | NOT_EVALUATED |
| rules-goal-detection-evidence | PASS |
| rules-kickoff-freeze-evidence | PASS |
| rules-timer-freeze-evidence | PASS |

## Verdict comparison vs RULES-SUITE-REGISTRATION (record_sha256 7503f9fe…)

**Changed (3):** MATCH-THROW-IN-AWARD, MATCH-GOAL-KICK-AWARD, MATCH-TIMER-FREEZE all move `NOT_EVALUATED` → `PASS`. The reason for each delta is the same: the gated `serializeRestartFacts` runner option (post-loop injection of the committed restart-executed events + the core matchPhase/matchTimer) is enabled on the driven RESTART-RULES-CONFORMANCE streams, making the executed award / timer-freeze semantics measurable — previously NOT_EVALUATED because the standard observation stream does not serialize them.

**Unchanged (22):** MATCH-CORNER-KICK-CROSS and MATCH-GOAL-KICK-DISTRIBUTION stay `BLOCKED_MISSING_REFERENCE`; MATCH-CORNER-KICK-AWARD stays `NOT_EVALUATED` (no corner execution); the 4 baseline PASS criteria (OOP-DETECT / OOP-NO-TOUCH / KICKOFF-FREEZE / SCORING-GOAL-DEVENT) stay PASS (7 is the new total including the 3 gated upgrades); every other NOT_EVALUATED stays NOT_EVALUATED.

## Provenance / reproduction

The record is regenerated by:

```
WIP_SECTION=__EVIDENCE__:RULES-SUITE-STATE \
  mise exec -- pnpm exec tsx scripts/capture-rules-suite-verdicts-state.ts
```

Each headless conformance stream is reproduced through the same exported production runner (`runHeadlessMatch` with `lifecyclePhaseSync: "core-owned"`, and `serializeRestartFacts` true on the driven streams), and the `rules` suite is physically executed over the committed telemetry observations via `evaluateSuite("rules", …)`. No outcome is hand-written. The record carries no wall-clock field, so consecutive ordinary-mode runs are byte-identical and leave `docs/` byte-identical.

## known_gaps

- **MATCH-CORNER-KICK-AWARD is NOT_EVALUATED.** No feasible driven or organic run produced a corner-kick execution (a defender last-touch over its own goal line is rare in this engine — the touch redirects the ball back toward play before the crossing). The corner oracle is unit-tested (PASS/FAIL on a synthetic stream) and the same injection path demonstrably carries throw-in and goal-kick executions, so the criterion is measurable when a corner occurs — it was simply not observed. Disclosed, not forced.
- **The placement / serve / phase / anti-huddle criteria have no registered oracle yet**, so they honestly stay NOT_EVALUATED. Upgrading them requires a future objective that registers the corresponding protected oracles, not a bookkeeping change here.
- **No gameplay inference about the CORE's correctness is drawn from the rules PASS verdicts**: a PASS on MATCH-OUT-OF-PLAY-DETECT / MATCH-KICKOFF-FREEZE / MATCH-SCORING-GOAL-DEVENT / MATCH-THROW-IN-AWARD / MATCH-GOAL-KICK-AWARD / MATCH-TIMER-FREEZE is a statement that the driven conformance stream satisfies that §15 semantic, not a PES fidelity or full-regulation claim.

## claims_not_made

- No suite-level PASS claim: the per-test overall for the rules suite stays `NOT_EVALUATED` / `BLOCKED_MISSING_REFERENCE` (it never reduces to a suite PASS).
- No PROMOTION claim.
- No criterion is upgraded beyond what the executed evaluator returns; PASS is reported only where the driven stream genuinely carries the semantics, and NOT_EVALUATED elsewhere.
- No PES 2017 fidelity / measured PES envelope claim; MATCH-GOAL-KICK-DISTRIBUTION and MATCH-CORNER-KICK-CROSS stay `BLOCKED_MISSING_REFERENCE` (§14).
- No FOUNDATION_LAB_PASS claim.
- No invented reference envelope or tolerance; the 7 BLOCKED_MISSING_REFERENCE values (throw_in_trajectory_ref, goal_kick_distribution_ref, corner_cross_trajectory_ref, restart_serve_latency_ref_ms, post_goal_reset_ref_ticks, half_time_break_ref_seconds, ball_in_play_accounting_ref) stay blocked.
- MATCH-CORNER-KICK-AWARD stays NOT_EVALUATED (no genuine driven/organic corner-kick execution exists); it is not forced to PASS.
- No gameplay / source / contract / adapter / scenario / spec change: `src/`, `eval/runners/`, `eval/oracles/`, `eval/invariants/`, `eval/scenarios/`, `specs/` EMPTY; only evidence + a binding test + this producer are added.
