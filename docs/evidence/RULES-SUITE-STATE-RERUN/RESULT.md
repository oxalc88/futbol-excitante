# RULES-SUITE-STATE-RERUN — builder result

## Builder report

- **objective_id:** RULES-SUITE-STATE-RERUN
- **builder_agent:** builder-structured
- **builder_model:** deepseek-v4-flash
- **evidence_class:** BOOKKEEPING
- **hypothesis:** After RESTART-DESIGNATION-FACTS-CONFORMANCE (the 3 anti-huddle restart-behavior criteria now evaluate through the `rules` suite on the designation streams), re-publish the complete rules-suite verdict state by re-running the registered `rules` evaluator (`evaluateSuite("rules", observations)`) over all evidence streams now available — the core-owned baseline fixtures without serialization and the gated driven streams from each accepted generation (throw-in / goal-kick / full-match-timing / corner / designation) — and compose the honest per-criterion picture with exact delta disclosure vs the RULES-FACTS-DEPTH-CONFORMANCE baseline. Corner criteria now PASS from the corner stream; the 3 anti-huddle criteria PASS from the designation streams; corner-cross and goal-kick-distribution stay BLOCKED_MISSING_REFERENCE; no suite-level PASS claim. BOOKKEEPING; zero gameplay change.

### files_changed

- `scripts/capture-rules-suite-state-rerun.ts` (NEW — byte-reproducible record producer; WIP_SECTION-gated durable write; composes the aggregate over all re-run streams).
- `docs/evidence/RULES-SUITE-STATE-RERUN/rules-suite-state-rerun.json` (NEW — durable verdict table, `record_sha256` pinned).
- `docs/evidence/RULES-SUITE-STATE-RERUN/RESULT.md` (this report).
- `docs/evidence/RULES-SUITE-STATE-RERUN/audit.json` (NEW — `gauntlet:audit` output, status `PASS`).
- `tests/unit/eval/rules-suite-state-rerun-binding.test.ts` (NEW — binding tests).

**Zero changes** to `src/`, `src/adapters/`, `eval/runners/`, `eval/oracles/`, `eval/invariants/`, `eval/contracts/`, `eval/scenarios/`, or `specs/` (verified: `git diff src/ src/adapters/ eval/runners/ eval/oracles/ eval/invariants/ eval/contracts/ eval/scenarios/ specs/` is empty). No evaluator, oracle, invariant, observation, scenario, or spec was touched. The accepted records (`RULES-SUITE-STATE`, `RULES-FACTS-DEPTH-CONFORMANCE`, `CORNER-DRIVEN-CONFORMANCE`, `RESTART-DESIGNATION-FACTS-CONFORMANCE`) are byte-untouched.

### commands_run (actual exit codes)

| Command | Exit |
|---|---|
| `mise exec -- pnpm exec tsx scripts/capture-rules-suite-state-rerun.ts` (ordinary mode ×2) | 0 — record_sha256 `36fc77e5…` identical both runs; leaves `docs/` byte-identical; writes `test-results/gauntlet-capture/` |
| `WIP_SECTION=__EVIDENCE__:RULES-SUITE-STATE-RERUN mise exec -- pnpm exec tsx scripts/capture-rules-suite-state-rerun.ts` | 0 (wrote `docs/evidence/RULES-SUITE-STATE-RERUN/rules-suite-state-rerun.json`; record_sha256 `36fc77e5…`) |
| `mise exec -- pnpm run typecheck` | 0 (core + node + browser clean) |
| `mise exec -- pnpm exec vitest run tests/unit/eval/rules-suite-state-rerun-binding.test.ts --project node --testTimeout 300000` | 0 (binding tests; see tests_run) |
| `mise exec -- pnpm exec vitest run tests/unit/eval/{rules-oracle,rules-suite,RULES-SUITE-REGISTRATION-binding,restart-rules-serialization,RULES-SUITE-STATE-binding,rules-facts-depth-binding,corner-driven-conformance-binding,restart-designation-binding,rules-suite-state-rerun-binding}.test.ts --project node --testTimeout 300000` | 0 (rules gate) |
| `mise exec -- pnpm exec vitest run tests/unit/eval/{goalkeepers-suite,eval-registry,duels-suite,oracle-registry,mutant-core,gk-oracle,GK-KEEPER-ORACLE-REGISTRATION-binding,GK-SUITE-ORGANIC-STATE-binding,GK-SUITE-VERDICTS-STATE-binding,GK-SUITE-CORE-OWNED-STATE-binding,match-rules-spec-binding}.test.ts --project node --testTimeout 300000` | 0 (neighbour matrix) |
| `mise exec -- pnpm exec vitest run tests/unit/eval/{foundation-evaluator,playable-1v1-re-evaluation,foundation-lab-evidence-binding.node}.test.ts tests/candidate-scope.node.test.ts tests/evidence-sanity.node.test.ts tests/capture-hygiene.node.test.ts --project node --testTimeout 300000` | 0 (foundation / provenance / hygiene gate) |
| `mise exec -- pnpm run gauntlet:audit -- --objective RULES-SUITE-STATE-RERUN --class BOOKKEEPING --tests-pass true --integration-test-pass true` | 0 (status PASS; see `docs/evidence/RULES-SUITE-STATE-RERUN/audit.json`) |

### tests_run

- **rules-suite-state-rerun-binding.test.ts** — 9 tests, PASS (record shape; byte-reproducible `record_sha256` recompute; 23 PASS / 2 BLOCKED aggregate; 6 NOT_EVALUATED→PASS deltas with source-stream attribution; anti-huddle eligibility; corner cluster PASS from the corner stream; 2 blocked references stay BLOCKED; 8 invariants PASS; PROMOTION / PES fidelity / FOUNDATION_LAB_PASS / suite-level-PASS negative control; not-hand-written reproduction of the corner + designation-fullmatch runs).
- **Rules gate** — rules-oracle (75) / rules-suite (17) / RULES-SUITE-REGISTRATION-binding (28) / restart-rules-serialization (4) / RULES-SUITE-STATE-binding (10) / rules-facts-depth-binding (8) / corner-driven-conformance-binding (7) / restart-designation-binding (8) / rules-suite-state-rerun-binding (9), **166/166 PASS** (the pre-existing rules pins reproduce, the new binding gate green).
- **Neighbour matrix** — goalkeepers-suite / eval-registry / duels-suite / oracle-registry / mutant-core / gk-oracle / GK-KEEPER-ORACLE-REGISTRATION-binding / GK-SUITE-ORGANIC-STATE-binding / GK-SUITE-VERDICTS-STATE-binding / GK-SUITE-CORE-OWNED-STATE-binding / match-rules-spec-binding, **242/242 PASS** across 11 files. One non-fatal vitest worker-RPC infra timeout (`[vitest-worker]: Timeout calling "onTaskUpdate"`) on the ~95s GK-SUITE-CORE-OWNED-STATE-binding reproduction test — a reporting artifact, not an assertion failure (all 11 tests in that file passed; documented in the accepted GK-SUITE-CORE-OWNED-STATE and RESTART-DESIGNATION records).
- **Foundation / provenance / hygiene gate** — foundation-evaluator / playable-1v1-re-evaluation / foundation-lab-evidence-binding / candidate-scope / evidence-sanity / capture-hygiene, **81/81 PASS** (accepted pins, provenance assertions and capture hygiene reproduce).
- **Typecheck** — exit 0 (core + node + browser clean).

### integration_test_result

For `BOOKKEEPING`, the audit marks the integration-test check `NOT_APPLICABLE` (integration evidence is required only for `MULTI_TICK`/`DYNAMIC_VISUAL`). A relevant integration/provenance gate was still exercised: the `rules-suite-state-rerun-binding.test.ts` "not hand-written" test physically reproduces the driven corner run and the designation full-match run through the production runner (`runHeadlessMatch` with `serializeRestartFacts: true` + `browserParityObservations: true` on the designation run) and the accepted `evaluateSuite("rules", …)` entry point, confirming the evaluator yields the recorded corner PASS and anti-huddle PASS verdicts.

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing.

### required_evidence

- Deterministic audit: `docs/evidence/RULES-SUITE-STATE-RERUN/audit.json` (status `PASS`).
- Durable verdict table: `docs/evidence/RULES-SUITE-STATE-RERUN/rules-suite-state-rerun.json` (`record_sha256` 36fc77e5…; byte-reproducible; no wall-clock field in hashed content).
- Executed tests (BOOKKEEPING): the rules-suite-state-rerun binding gate, the rules gate, the neighbour matrix, and the foundation/provenance/hygiene gate.

### artifacts

- `docs/evidence/RULES-SUITE-STATE-RERUN/rules-suite-state-rerun.json`
- `docs/evidence/RULES-SUITE-STATE-RERUN/audit.json`
- `docs/evidence/RULES-SUITE-STATE-RERUN/RESULT.md`
- `scripts/capture-rules-suite-state-rerun.ts`
- `tests/unit/eval/rules-suite-state-rerun-binding.test.ts`

### spec_sections

- `specs/MATCH_RULES_SPEC.md` §6 (throw-in), §7 (goal kick), §8 (corner), §9 (kickoff first-touch / re-arm), §10 (goal phase), §11 (timer decrement / halftime / fulltime / freeze), §12 (anti-huddle restart freeze / nearest-only), §14 (BLOCKED_MISSING_REFERENCE), §15 (the adjudicating criteria).
- `eval/contracts/common-criteria.ts` (the 25 MATCH-* criteria), `suites.ts` (suite-rules-v1), `invariant-definitions.ts`, `bindings.ts`.
- `eval/oracles/rules-restart.ts` / `rules-phase.ts` (protected rules oracles), `eval/runners/foundation-evaluator.ts` (criterion→oracle resolution), `eval/oracles/wire.ts` (registration), `eval/runners/headless-match.ts` (gated `serializeRestartFacts` + `browserParityObservations`).
- `docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/rules-facts-depth-state.json` (the delta baseline, read verbatim), `docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/restart-designation-facts-state.json` (the quoted "20/2/3" aggregate), `docs/evidence/CORNER-DRIVEN-CONFORMANCE/corner-driven-state.json` (the corner stream), `docs/evidence/RULES-SUITE-STATE/rules-suite-verdicts-state.json` (the continuous-play baseline).
- `gauntlet/evidence-contract.md` (BOOKKEEPING), `gauntlet/roles/builder-structured.md` (role contract).

### acceptance_criteria_met

- Re-ran `evaluateSuite("rules", observations)` over 10 evidence streams: the 2 core-owned non-serialized baselines (throw-in, arc), the gated driven throw-in / goal-kick / full-match-timing streams (RULES-FACTS-DEPTH), the driven corner stream + goal-kick neighbour (CORNER-DRIVEN), and the 3 browserParity designation streams (RESTART-DESIGNATION).
- Honest aggregate verdict table for all 25 MATCH-* criteria + 8 invariants: **23 PASS / 2 BLOCKED_MISSING_REFERENCE / 0 NOT_EVALUATED / 0 FAIL**.
- The corner cluster (MATCH-CORNER-KICK-AWARD / -PLACEMENT / -TIMER-FREEZE) now shows PASS from the corner stream; the 3 anti-huddle criteria (FREEZE-UNTIL-FIRST-TOUCH / NEAREST-ONLY / REARM) PASS from the designation streams; MATCH-CORNER-KICK-CROSS and MATCH-GOAL-KICK-DISTRIBUTION stay BLOCKED_MISSING_REFERENCE.
- Delta disclosure vs the RULES-FACTS-DEPTH-CONFORMANCE baseline (record `ebf90831…`, 17 PASS / 2 BLOCKED / 6 NOT_EVALUATED / 0 FAIL): exactly 6 criteria move NOT_EVALUATED → PASS (3 anti-huddle + 3 corner), with source-stream attribution per change; 17 PASS unchanged; 2 BLOCKED unchanged; 0 FAIL introduced.
- Record byte-reproducibility: `rules-suite-state-rerun.json` has a pinned `record_sha256` (36fc77e5…) with NO wall-clock field in the hashed content; two consecutive ordinary-mode runs are byte-identical; an ordinary-mode re-run leaves `docs/` byte-identical.
- Zero gameplay/source change: `git diff src/ src/adapters/ eval/runners/ eval/oracles/ eval/invariants/ eval/contracts/ eval/scenarios/ specs/` is EMPTY.
- Neighbour batteries green (rules gate, neighbour matrix, foundation/provenance/hygiene); `mise run typecheck` exit 0; `gauntlet:audit` status PASS.

---

## Current rules-suite verdict table (executed evaluator, not forced)

Loaded from `docs/evidence/RULES-SUITE-STATE-RERUN/rules-suite-state-rerun.json` (record_sha256 `36fc77e5…`). **No suite-level PASS claim** — the rules suite is a per-test verdict collection and does not reduce to a suite PASS; the 2 BLOCKED_MISSING_REFERENCE criteria keep it from being a clean PASS.

### Per-criterion outcomes (25 MATCH-* criteria)

| Criterion (§15) | Outcome | Source stream(s) | Why (one line) |
|---|---|---|---|
| MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH | **PASS** | designation-throwin/arc/fullmatch-live | in every restart window the whole team except the single designated taker is frozen at its window anchor while the restart ball is untouched (§12 rule 1) |
| MATCH-RESTART-NEAREST-ONLY | **PASS** | designation-throwin/arc/fullmatch-live | after the first touch only one designated chaser per team converges on the ball (no team clump) (§12 rule 2) |
| MATCH-RESTART-REARM | **PASS** | designation-arc-live, designation-fullmatch-live | a post-goal / halftime reset re-arms the restart window keyed to the carried-through touch reference (§9.5); NOT_EVALUATED on the no-reset throw-in stream |
| MATCH-CORNER-KICK-AWARD | **PASS** | rules-corner-live | the corner was awarded to the attacking team because the last touch of the goal-line out-of-play was the defending team (§8.1) |
| MATCH-CORNER-KICK-PLACEMENT | **PASS** | rules-corner-live | the executed corner kick's cornerPosition equals the nearest corner flag chosen by the sign of the ball's exit y (§8.2) |
| MATCH-CORNER-KICK-CROSS | **BLOCKED_MISSING_REFERENCE** | all runs | §14 `corner_cross_trajectory_ref` does not exist and is never invented |
| MATCH-CORNER-KICK-TIMER-FREEZE | **PASS** | rules-corner-live | the ball-in-play timer is frozen during every corner-kick phase tick (§11) |
| MATCH-GOAL-KICK-AWARD | **PASS** | rules-goal-kick-live, rules-corner-goalkick-neighbour, designation-arc-live | the goal kick was awarded to the defending team of the exited goal line |
| MATCH-GOAL-KICK-PLACEMENT | **PASS** | rules-goal-kick-live, rules-corner-goalkick-neighbour, designation-arc-live | the goal kick is placed inside the goal area on the exit side (§7.3) |
| MATCH-GOAL-KICK-DISTRIBUTION | **BLOCKED_MISSING_REFERENCE** | all runs | §14 `goal_kick_distribution_ref` does not exist and is never invented |
| MATCH-GOAL-KICK-TIMER-FREEZE | **PASS** | rules-goal-kick-live, rules-corner-goalkick-neighbour, designation-arc-live | the ball-in-play timer is frozen during every goal-kick post-phase tick (§11) |
| MATCH-KICKOFF-FREEZE | **PASS** | every run | only the taker + at-ball body left home in the untouched opening window |
| MATCH-KICKOFF-FIRST-TOUCH | **PASS** | every run | the opening untouched window closed on the first touch by the designated taker (keeper excluded per §12.1) (§9.2) |
| MATCH-OUT-OF-PLAY-DETECT | **PASS** | every run | boundary events carry well-formed payloads; goal / goal-line out-of-play are mutually exclusive |
| MATCH-OUT-OF-PLAY-NO-LAST-TOUCH | **PASS** | throw-in + full-match + designation runs | every no-last-touch boundary opened no restart |
| MATCH-SCORING-GOAL-DEVENT | **PASS** | goal-carrying runs | every goal event carries a valid goalIndex, mutually exclusive with out-of-play |
| MATCH-SCORING-GOAL-PHASE | **PASS** | rules-throw-in/goal-kick-live, corner-neighbour, designation-arc-live | a goal opened the goal phase and play returned to playing via the post-goal reset (§10.2/§9.3) |
| MATCH-THROW-IN-AWARD | **PASS** | rules-throw-in/full-match-live, designation-throwin/fullmatch-live | each served throw-in went to the team opposite the last-touch team |
| MATCH-THROW-IN-PLACEMENT | **PASS** | rules-throw-in/full-match-live, designation-throwin/fullmatch-live | each throwPosition equals the paired touchline-exit ballPosition (§6.3) |
| MATCH-THROW-IN-SERVE | **PASS** | rules-throw-in/full-match-live, designation-throwin/fullmatch-live | each throw-in is served at chest height (ball z≈1.5 m) into play toward a receiver (§6.4) |
| MATCH-THROW-IN-TIMER-FREEZE | **PASS** | rules-throw-in/full-match-live, designation-throwin/fullmatch-live | the ball-in-play timer is frozen during every throw-in post-phase tick (§11) |
| MATCH-TIMER-DECREMENT | **PASS** | every driven run | the ball-in-play timer decrements only during playing (halftime break countdown + playing→fulltime zero-crossing are the documented exceptions) (§11) |
| MATCH-TIMER-HALFTIME | **PASS** | rules-full-match-live, designation-fullmatch-live | the timer reached zero in half 1, the phase transitioned to halftime, and play resumed as the second half (§11) |
| MATCH-TIMER-FULLTIME | **PASS** | rules-full-match-live, designation-fullmatch-live | the timer reached zero in half 2 and the phase transitioned to fulltime (§11) |
| MATCH-TIMER-FREEZE | **PASS** | every driven run | the ball-in-play timer is frozen during non-playing phases (§11) |

**Counts: 23 PASS, 2 BLOCKED_MISSING_REFERENCE, 0 NOT_EVALUATED, 0 FAIL.**

### The 8 protected rules invariants

All 8 invariants aggregate to **PASS**: `rules-out-of-play-detect-evidence`, `rules-out-of-play-no-last-touch-evidence`, `rules-throw-in-award-evidence`, `rules-goal-kick-award-evidence`, `rules-corner-kick-award-evidence`, `rules-goal-detection-evidence`, `rules-kickoff-freeze-evidence`, `rules-timer-freeze-evidence`.

---

## Verdict delta vs the RULES-FACTS-DEPTH-CONFORMANCE baseline

The baseline is the RULES-FACTS-DEPTH-CONFORMANCE record (record_sha256 `ebf90831…`), which declared **17 PASS / 2 BLOCKED_MISSING_REFERENCE / 6 NOT_EVALUATED / 0 FAIL** over its own (non-browserParity) streams.

**Upgraded NOT_EVALUATED → PASS (6):**

| Criterion | From → To | Source stream(s) |
|---|---|---|
| MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH | NOT_EVALUATED → PASS | designation-throwin-live, designation-arc-live, designation-fullmatch-live |
| MATCH-RESTART-NEAREST-ONLY | NOT_EVALUATED → PASS | designation-throwin-live, designation-arc-live, designation-fullmatch-live |
| MATCH-RESTART-REARM | NOT_EVALUATED → PASS | designation-arc-live (post-goal re-arm), designation-fullmatch-live (halftime re-arm) |
| MATCH-CORNER-KICK-AWARD | NOT_EVALUATED → PASS | rules-corner-live |
| MATCH-CORNER-KICK-PLACEMENT | NOT_EVALUATED → PASS | rules-corner-live |
| MATCH-CORNER-KICK-TIMER-FREEZE | NOT_EVALUATED → PASS | rules-corner-live |

**Unchanged (19):** the 17 PASS criteria and the 2 BLOCKED_MISSING_REFERENCE criteria stay as-is. No FAIL is introduced.

**Net counts:** 23 PASS / 2 BLOCKED_MISSING_REFERENCE / 0 NOT_EVALUATED / 0 FAIL.

### Note on the quoted "20 PASS / 2 BLOCKED / 3 NOT_EVALUATED" baseline

The horizon/task parenthetical "20 PASS / 2 BLOCKED / 3 NOT_EVALUATED / 0 FAIL at that point" does NOT match the RULES-FACTS-DEPTH-CONFORMANCE record (which declared 17/2/6). It matches the RESTART-DESIGNATION-FACTS-CONFORMANCE aggregate (record_sha256 `271b1526…`), which is the state after the corner cluster had already been evaluated but was still marked OUT of scope there (so its 3 NOT_EVALUATED are the 3 corner criteria). Composing the corner stream too (this re-run) yields the complete picture of 23 PASS / 2 BLOCKED / 0 NOT_EVALUATED / 0 FAIL. Both baselines converge on the same current table.

---

## Provenance / reproduction

The record is regenerated by:

```
WIP_SECTION=__EVIDENCE__:RULES-SUITE-STATE-RERUN \
  mise exec -- pnpm exec tsx scripts/capture-rules-suite-state-rerun.ts
```

Each headless conformance stream is reproduced through the same exported production runner (`runHeadlessMatch` with `lifecyclePhaseSync: "core-owned"`, `serializeRestartFacts` true on the gated runs, and `browserParityObservations: true` on the designation runs), and the `rules` suite is physically executed over the committed telemetry observations via `evaluateSuite("rules", …)`. No outcome is hand-written. The record carries no wall-clock field, so consecutive ordinary-mode runs are byte-identical and leave `docs/` byte-identical.

## known_gaps

- **The continuous-play baseline fixture (RULES-SUITE-STATE "corner baseline", 5v5-continuous-play) is NOT re-run here.** It is a redundant control: its only PASS verdicts (MATCH-OUT-OF-PLAY-DETECT, MATCH-SCORING-GOAL-DEVENT) are also PASS on the re-run throw-in / goal-kick streams, and its corner-cluster NOT_EVALUATED is superseded by the driven corner PASS. Its published per-run verdicts remain in the accepted RULES-SUITE-STATE record (record_sha256 `bae56e5a…`). This was a deliberate runtime decision (a single 1800-tick continuous-play run costs ~149s and pushed the capture over the 300s execution budget) and does not change any aggregate verdict.
- **The anti-huddle restart-behavior criteria are evaluated only on the browserParity designation streams.** On the non-browserParity gated streams the `serializeRestartFacts` injection still emits `restart-designation` facts, but those streams use the runner's minimal team-filtered observation shape (no formation anchor / teammate list) and do not reproduce the browser-composition-root anti-huddle behavior, so the anti-huddle oracles report a FAIL that is an artifact of the shape, not a gameplay verdict. Those runs are excluded from the anti-huddle criteria (see `criterion_eligibility`).
- **No gameplay inference about the CORE's correctness is drawn from the PASS verdicts.** A PASS on a §15 semantic is a statement that a driven conformance stream satisfies that rule, not a PES fidelity or full-regulation claim.

## claims_not_made

- No suite-level PASS claim: the rules suite is a per-test verdict collection and does not reduce to a suite PASS; the 2 BLOCKED_MISSING_REFERENCE criteria (MATCH-CORNER-KICK-CROSS, MATCH-GOAL-KICK-DISTRIBUTION) keep it from being a clean PASS.
- No PROMOTION claim.
- No criterion is upgraded beyond what the executed evaluator returns: PASS is reported only where a driven stream genuinely carries the semantics, and the 2 blocked references stay BLOCKED_MISSING_REFERENCE.
- No PES 2017 fidelity / measured PES envelope claim; MATCH-GOAL-KICK-DISTRIBUTION and MATCH-CORNER-KICK-CROSS stay BLOCKED_MISSING_REFERENCE (§14).
- No FOUNDATION_LAB_PASS claim.
- No invented reference envelope or tolerance; the 2 BLOCKED_MISSING_REFERENCE values stay blocked.
- No gameplay / source / contract / adapter / spec change: `git diff src/ src/adapters/ eval/runners/ eval/oracles/ eval/invariants/ eval/contracts/ eval/scenarios/ specs/` is EMPTY; only evidence + a binding test + this producer are added.
