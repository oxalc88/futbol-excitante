# RULES-FACTS-DEPTH-CONFORMANCE — builder result

## Builder report

- **objective_id:** RULES-FACTS-DEPTH-CONFORMANCE
- **builder_agent:** builder-structured
- **builder_model:** deepseek-v4-flash
- **evidence_class:** MULTI_TICK
- **hypothesis:** The 16 NOT_EVALUATED rules criteria from RULES-SUITE-STATE (record bae56e5a…) — minus the corner cluster (owned by CORNER-DRIVEN-CONFORMANCE) — can be evaluated honestly from facts that already exist in the gated `serializeRestartFacts` observation streams, plus one new driven full-match timing stream for the timer-driven halftime/fulltime transitions. The throw-in placement/serve, goal-kick placement, per-restart timer-freeze, timer decrement, goal phase, and kickoff first-touch criteria are genuinely measurable from the committed restart-executed payloads + the core-match-phase facts; the anti-huddle restart-behavior criteria (FREEZE-UNTIL-FIRST-TOUCH / NEAREST-ONLY / REARM) are NOT observable from committed facts and stay NOT_EVALUATED; blocked references stay blocked; no suite-level PASS claim.

### files_changed

- `eval/oracles/rules-restart.ts` (ADDITIVE: carried boundary `ballPosition` in the restart pairing; added `checkThrowInPlacement`, `checkThrowInServe`, `checkGoalKickPlacement`, `checkGoalPhase`, `checkKickoffFirstTouch`).
- `eval/oracles/rules-phase.ts` (ADDITIVE: added `checkThrowInTimerFreeze`, `checkGoalKickTimerFreeze`, `checkTimerDecrement`, `checkTimerHalftime`, `checkTimerFulltime`; shared `collectCorePhaseFacts` helper).
- `eval/oracles/wire.ts` (registered the 10 new protected rules oracles; no existing entry changed).
- `eval/runners/foundation-evaluator.ts` (added 10 criterion→oracle entries; no existing entry changed).
- `eval/contracts/invariant-definitions.ts` (added 10 rules-depth invariant definitions; additive).
- `eval/contracts/bindings.ts` (the depth criteria now bind to their invariant ids; additive).
- `scripts/capture-rules-facts-depth-conformance.ts` (NEW — deterministic record + trajectory producer; WIP_SECTION-gated durable write; no wall-clock field in the record).
- `eval/scenarios/5v5-full-match-timing.v1.json` (NEW — driven full-match timing fixture: `matchDurationTicks` 240, `durationTicks` 800 so the core timer reaches zero in half 1 and half 2).
- `docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/rules-facts-depth-state.json` (NEW — durable verdict table, `record_sha256` pinned).
- `docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/trajectory.json` (NEW — MULTI_TICK trajectory with live + stashed controls).
- `docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/audit.json` (NEW — `gauntlet:audit` output).
- `docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/RESULT.md` (NEW — this result).
- `tests/unit/eval/rules-oracle.test.ts` (29 new oracle unit guards).
- `tests/unit/eval/restart-rules-serialization.test.ts` (full-match serialization guard).
- `tests/unit/eval/rules-facts-depth-binding.test.ts` (NEW — 8 binding tests).
- `tests/unit/eval/RULES-SUITE-REGISTRATION-binding.test.ts` (added the 10 depth criteria to the oracle-chain map).

**Zero changes** to `src/`, `src/simulation/`, `src/contracts/`, `src/adapters/`, `specs/`, or any accepted evidence directory (verified: `git diff --stat -- src/` is EMPTY; the accepted `docs/evidence/RULES-SUITE-STATE/` and `docs/evidence/RESTART-RULES-CONFORMANCE/` records are byte-untouched). The new scenario is a driven fixture, not a source/contract change.

### commands_run

- cmd: `mise run typecheck`
    exit_code: 0
    result: "tsc core + node + browser all clean"
- cmd: `mise exec -- pnpm exec tsx scripts/capture-rules-facts-depth-conformance.ts` (ordinary-mode run 1)
    exit_code: 0
    result: "wrote test-results/gauntlet-capture/RULES-FACTS-DEPTH-CONFORMANCE/rules-facts-depth-state.json + trajectory.json (record_sha256=ebf9083136b051d50fcf3f4efbcc55eeb8f53fda9d43cd36b8e08d0874852e61; 6 runs: 3 live + 3 stashed; live/stashed hash-of-hashes identical for all three fixtures)"
- cmd: `WIP_SECTION=__EVIDENCE__:RULES-FACTS-DEPTH-CONFORMANCE mise exec -- pnpm exec tsx scripts/capture-rules-facts-depth-conformance.ts`
    exit_code: 0
    result: "wrote docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/rules-facts-depth-state.json + trajectory.json (durable-evidence; record_sha256=ebf90831…; 6 runs)"
- cmd: `mise exec -- pnpm exec tsx scripts/capture-rules-facts-depth-conformance.ts` (ordinary-mode run 2 — byte-reproducibility)
    exit_code: 0
    result: "record_sha256=ebf90831… (identical); docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/rules-facts-depth-state.json sha256 unchanged (d164deda… before === d164deda… after); DOCS_BYTE_IDENTICAL"
- cmd: `pnpm exec vitest run tests/unit/eval/{rules-oracle,rules-suite,RULES-SUITE-REGISTRATION-binding,restart-rules-serialization,RULES-SUITE-STATE-binding,rules-facts-depth-binding}.test.ts --project node --testTimeout 180000`
    exit_code: 0
    result: "121/121 PASS (rules-oracle 59, rules-suite 17, RULES-SUITE-REGISTRATION-binding 23, restart-rules-serialization 4, RULES-SUITE-STATE-binding 10, rules-facts-depth-binding 8)"
- cmd: `pnpm exec vitest run tests/unit/eval/{goalkeepers-suite,eval-registry,duels-suite,oracle-registry,mutant-core,gk-oracle,GK-KEEPER-ORACLE-REGISTRATION-binding,GK-SUITE-ORGANIC-STATE-binding,GK-SUITE-VERDICTS-STATE-binding,match-rules-spec-binding}.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "231/231 PASS (pre-existing neighbour matrix)"
- cmd: `pnpm exec vitest run tests/unit/eval/{foundation-evaluator,playable-1v1-re-evaluation,foundation-lab-evidence-binding.node}.test.ts tests/candidate-scope.node.test.ts tests/evidence-sanity.node.test.ts tests/capture-hygiene.node.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "81/81 PASS (foundation pins, provenance assertions and capture hygiene reproduce)"
- cmd: `mise exec -- pnpm run gauntlet:audit -- --objective RULES-FACTS-DEPTH-CONFORMANCE --class MULTI_TICK --tests-pass true --integration-test-pass true`
    exit_code: 0
    result: "status PASS (see audit.json)"

### tests_run

- name: `rules-oracle.test.ts`
    result: "PASS (59 tests — 30 pre-existing + 29 new: placement/serve/goal-kick-placement/goal-phase/kickoff-first-touch/timer-freeze-variants/decrement/halftime/fulltime PASS/FAIL/NOT_EVALUATED in both directions)"
- name: `rules-suite.test.ts`
    result: "PASS (17 tests, pre-existing untouched)"
- name: `RULES-SUITE-REGISTRATION-binding.test.ts`
    result: "PASS (23 tests; 10 new depth criteria added to the criterion→invariant→oracle chain)"
- name: `restart-rules-serialization.test.ts`
    result: "PASS (4 tests; NEW full-match guard: gate-ON carries halftime/fulltime phase facts, live/stashed state-hash chains identical)"
- name: `RULES-SUITE-STATE-binding.test.ts`
    result: "PASS (10 tests, pre-existing — the accepted record is byte-untouched)"
- name: `rules-facts-depth-binding.test.ts`
    result: "PASS (8 tests — record shape, byte-reproducible record_sha256, 10 depth upgrades, anti-huddle stays NOT_EVALUATED, corner cluster OUT, stash-identity, discriminating reverted-verdict guard, no-claim negative control, not-hand-written reproduction)"
- name: neighbour matrix (goalkeepers-suite / eval-registry / duels-suite / oracle-registry / mutant-core / gk-oracle / GK-KEEPER-ORACLE-REGISTRATION-binding / GK-SUITE-ORGANIC-STATE-binding / GK-SUITE-VERDICTS-STATE-binding / match-rules-spec-binding)
    result: "PASS (231; pre-existing, untouched)"
- name: foundation / provenance / hygiene gate
    result: "PASS (81; accepted foundation pins, provenance assertions and capture hygiene reproduce)"

### integration_test_result

MULTI_TICK requires a relevant integration-test pass. The rules suite is exercised over the driven extended streams (`evaluateSuite("rules", observations)` returns real placement / serve / timer-freeze / decrement / halftime / fulltime / goal-phase / kickoff-first-touch verdicts), and the `rules-facts-depth-binding.test.ts` "not hand-written" test physically reproduces the driven throw-in and full-match runs through the production runner + evaluator and confirms the pinned verdicts. The stash-identity (live vs stashed state-hash chains identical) is demonstrated in the trajectory and the serialization guard.

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing.

### required_evidence

- Durable trajectory: `docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/trajectory.json` (MULTI_TICK; 6 runs, live + stashed controls).
- Durable verdict table: `docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/rules-facts-depth-state.json` (`record_sha256` ebf90831…; byte-reproducible; no wall-clock field).
- Deterministic audit: `docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/audit.json` (status `PASS`).
- Executed tests (MULTI_TICK): the 121-test rules gate, the 231-test neighbour matrix, and the 81-test foundation/provenance/hygiene gate.

### artifacts

- `docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/rules-facts-depth-state.json`
- `docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/trajectory.json`
- `docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/audit.json`
- `docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/RESULT.md`
- `scripts/capture-rules-facts-depth-conformance.ts`
- `eval/scenarios/5v5-full-match-timing.v1.json`
- `tests/unit/eval/rules-facts-depth-binding.test.ts`

### spec_sections

- `specs/MATCH_RULES_SPEC.md` §6 (throw-in placement/serve), §7 (goal-kick placement), §9 (kickoff first-touch, restart-window re-arm), §10 (goal phase), §11 (timer decrement / halftime / fulltime / freeze), §12 (anti-huddle restart freeze / nearest-only), §14 (BLOCKED_MISSING_REFERENCE), §15 (the adjudicating criteria evaluated here), §17 (declaration of limitations).
- `eval/contracts/common-criteria.ts` (the 25 MATCH-* criteria), `suites.ts` (suite-rules-v1), `invariant-definitions.ts` (rules-depth invariants), `bindings.ts` (criterion bindings).
- `eval/oracles/rules-restart.ts` / `rules-phase.ts` (protected rules oracles), `eval/runners/foundation-evaluator.ts` (criterion→oracle resolution), `eval/oracles/wire.ts` (registration).
- `docs/evidence/RULES-SUITE-STATE/rules-suite-verdicts-state.json` (the prior 16 NOT_EVALUATED baseline compared below).
- `gauntlet/evidence-contract.md` (MULTI_TICK), `gauntlet/roles/builder-structured.md` (role contract).

### acceptance_criteria_met

- Evaluated the remaining NOT_EVALUATED rules criteria answerable from existing serialized facts, extending the gated injection NOT AT ALL (no new fact was needed — the committed restart-executed payloads and the core-match-phase facts already carry the placement/serve/timer-freeze/decrement/phase semantics).
- Added one driven full-match timing stream (short `matchDurationTicks`) so the timer-driven halftime and fulltime transitions are genuinely observed (they are runner-observable committed core state; no injection change).
- Added 10 protected rules oracles additively (mutant/canary-guarded in both directions), registered + mapped + bound; no existing oracle/criterion check weakened.
- Honest verdict table (all 25 MATCH-* criteria, per-criterion outcome + source stream + reason): 17 PASS / 2 BLOCKED_MISSING_REFERENCE / 6 NOT_EVALUATED / 0 FAIL.
- The 3 anti-huddle restart-behavior criteria (FREEZE-UNTIL-FIRST-TOUCH / NEAREST-ONLY / REARM) stay NOT_EVALUATED with the reason that the committed observation stream does not carry the adapter-layer restart-window designation; they are NOT forced.
- The corner cluster (MATCH-CORNER-KICK-*) is OUT of scope (owned by CORNER-DRIVEN-CONFORMANCE) and not claimed.
- Record byte-reproducibility: `rules-facts-depth-state.json` has a pinned `record_sha256` (ebf90831…) with no wall-clock field in the hashed content; an ordinary-mode re-run leaves `docs/` byte-identical.
- Zero gameplay/source change: `git diff --stat -- src/` EMPTY.
- Neighbour batteries green (rules 121, neighbour 231, foundation/provenance/hygiene 81); `mise run typecheck` exit 0; `gauntlet:audit` status PASS.

---

## Current rules-facts-depth verdict table (executed evaluator, not forced)

Loaded from `docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/rules-facts-depth-state.json` (record_sha256 `ebf90831…`). **No suite-level PASS claim** — the per-test overall for the rules suite stays `NOT_EVALUATED` / `BLOCKED_MISSING_REFERENCE`.

### Per-criterion outcomes (25 MATCH-* criteria)

| Criterion (§15) | Outcome | Source stream(s) | Why (one line) |
|---|---|---|---|
| MATCH-OUT-OF-PLAY-DETECT | **PASS** | every boundary-carrying stream | boundary events carry well-formed payloads; goal / goal-line out-of-play mutually exclusive |
| MATCH-OUT-OF-PLAY-NO-LAST-TOUCH | **PASS** | throw-in + goal-kick streams | every no-last-touch boundary opened no restart |
| MATCH-KICKOFF-FREEZE | **PASS** | throw-in + goal-kick streams | only the taker + at-ball body left home in the untouched opening window |
| MATCH-SCORING-GOAL-DEVENT | **PASS** | goal-carrying streams | every goal event carries a valid goalIndex, mutually exclusive with out-of-play |
| MATCH-THROW-IN-AWARD | **PASS** | rules-throw-in-live | each served throw-in went to the team opposite the last-touch team |
| MATCH-GOAL-KICK-AWARD | **PASS** | rules-goal-kick-live | the goal kick was awarded to the defending team of the exited goal line |
| MATCH-TIMER-FREEZE | **PASS** | throw-in + goal-kick streams | the core matchTimer is frozen during non-playing phases |
| MATCH-THROW-IN-PLACEMENT | **PASS** | rules-throw-in-live (2 executions) | each throwPosition equals the paired touchline-exit ballPosition (§6.3) |
| MATCH-THROW-IN-SERVE | **PASS** | rules-throw-in-live (2 executions) | each throw-in is served at chest height (ball z≈1.5 m) into play toward a receiver (§6.4) |
| MATCH-THROW-IN-TIMER-FREEZE | **PASS** | rules-throw-in-live | the ball-in-play timer is frozen during every throw-in post-phase tick (§11) |
| MATCH-GOAL-KICK-PLACEMENT | **PASS** | rules-goal-kick-live (1 execution) | the goal kick is placed inside the goal area on the exit side (§7.3) |
| MATCH-GOAL-KICK-TIMER-FREEZE | **PASS** | rules-goal-kick-live | the ball-in-play timer is frozen during every goal-kick post-phase tick (§11) |
| MATCH-TIMER-DECREMENT | **PASS** | every driven stream | the ball-in-play timer decrements only during playing (halftime break countdown + playing→fulltime zero-crossing are the documented exceptions) (§11) |
| MATCH-TIMER-HALFTIME | **PASS** | rules-full-match-live | the timer reached zero in half 1, phase → halftime, then the second half (§11); NOT_EVALUATED on the 1800-tick fixtures (timer never reached zero) |
| MATCH-TIMER-FULLTIME | **PASS** | rules-full-match-live | the timer reached zero in half 2, phase → fulltime (§11); NOT_EVALUATED on the 1800-tick fixtures (terminal fulltime is a runner stamp, not timer-driven) |
| MATCH-SCORING-GOAL-PHASE | **PASS** | throw-in + goal-kick streams | a goal opened the goal phase and play returned to playing via the post-goal reset (§10.2/§9.3) |
| MATCH-KICKOFF-FIRST-TOUCH | **PASS** | every driven stream | the opening untouched window closed on the first touch by the designated taker (§9.2) |
| MATCH-CORNER-KICK-AWARD | NOT_EVALUATED | all runs | no corner-kick execution observed (owned by CORNER-DRIVEN-CONFORMANCE); not forced |
| MATCH-CORNER-KICK-PLACEMENT | NOT_EVALUATED | all runs | corner cluster OUT of scope |
| MATCH-CORNER-KICK-CROSS | **BLOCKED_MISSING_REFERENCE** | all runs | §14 `corner_cross_trajectory_ref` blocked |
| MATCH-CORNER-KICK-TIMER-FREEZE | NOT_EVALUATED | all runs | corner cluster OUT of scope |
| MATCH-GOAL-KICK-DISTRIBUTION | **BLOCKED_MISSING_REFERENCE** | all runs | §14 `goal_kick_distribution_ref` blocked |
| MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH | NOT_EVALUATED | all runs | the observation stream does not carry the adapter-layer restart-window designation (designated taker / window anchor / untouched override); the set-piece ball is not held frozen (it rolls / is touched during the window), so the anti-huddle restart freeze is not observable from committed facts (§12) |
| MATCH-RESTART-NEAREST-ONLY | NOT_EVALUATED | all runs | the observation stream does not carry the per-team designated chaser/presser, so the nearest-only chase rule is not observable from committed facts (§12) |
| MATCH-RESTART-REARM | NOT_EVALUATED | all runs | the observation stream does not carry the adapter-layer carried-through-touch "untouched" override that keys the post-goal / halftime window re-arm, so the re-arm is not observable from committed facts (§9.5) |

**Counts: 17 PASS, 2 BLOCKED_MISSING_REFERENCE, 6 NOT_EVALUATED, 0 FAIL.**

### Verdict delta vs RULES-SUITE-STATE (record_sha256 bae56e5a…)

**Upgraded NOT_EVALUATED → PASS (10):** MATCH-THROW-IN-PLACEMENT, MATCH-THROW-IN-SERVE, MATCH-THROW-IN-TIMER-FREEZE, MATCH-GOAL-KICK-PLACEMENT, MATCH-GOAL-KICK-TIMER-FREEZE, MATCH-KICKOFF-FIRST-TOUCH, MATCH-SCORING-GOAL-PHASE, MATCH-TIMER-DECREMENT, MATCH-TIMER-HALFTIME, MATCH-TIMER-FULLTIME. Each became measurable through a newly-registered protected rules oracle over the driven streams (the committed restart-executed payloads + the core-match-phase facts), and MATCH-TIMER-HALFTIME / MATCH-TIMER-FULLTIME additionally required the driven full-match timing stream so the timer genuinely reaches zero. No verdict was hand-written.

**Unchanged (15):** the 7 prior PASS + the 2 BLOCKED_MISSING_REFERENCE stay as-is; MATCH-CORNER-KICK-* (4) and the anti-huddle restart-behavior criteria (3) stay NOT_EVALUATED / BLOCKED.

## Provenance / reproduction

The record is regenerated by:

```
WIP_SECTION=__EVIDENCE__:RULES-FACTS-DEPTH-CONFORMANCE \
  mise exec -- pnpm exec tsx scripts/capture-rules-facts-depth-conformance.ts
```

Each headless conformance stream is reproduced through the same exported production runner (`runHeadlessMatch` with `lifecyclePhaseSync: "core-owned"`, `serializeRestartFacts` true on the live runs), and the `rules` suite is physically executed over the committed telemetry observations via `evaluateSuite("rules", …)`. No outcome is hand-written. The record carries no wall-clock field, so consecutive ordinary-mode runs are byte-identical and leave `docs/` byte-identical. The live and stashed state-hash chains are identical for all three fixtures, proving the injection cannot affect inputs / steps / committed hashes.

## known_gaps

- **MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH / MATCH-RESTART-NEAREST-ONLY / MATCH-RESTART-REARM stay NOT_EVALUATED.** These are the adapter-layer anti-huddle restart-window semantics. The committed observation stream carries positions + `ball.lastTouchRef` but NOT the adapter's designation (designated taker, per-team presser, window anchor, and the carried-through-touch "untouched" override that keys the post-goal / halftime re-arm). The set-piece ball is not held frozen in the stream (it rolls / is touched during the window), so freezing the non-takers at their anchors is not observable from committed facts. Honest NOT_EVALUATED — not forced.
- **MATCH-CORNER-KICK-* is OUT of scope.** The corner cluster is owned by CORNER-DRIVEN-CONFORMANCE; no corner claim is made here.
- **MATCH-TIMER-HALFTIME / MATCH-TIMER-FULLTIME on the 1800-tick fixtures are NOT_EVALUATED.** The timer never reaches zero there (the core-owned runner only stamps a terminal fulltime label at the last tick while the timer is still in play). Only the driven full-match fixture (short duration) reaches a genuine timer-driven halftime / fulltime.
- **No gameplay inference about the CORE's correctness is drawn from the PASS verdicts.** A PASS on a §15 semantic is a statement that the driven conformance stream satisfies that rule, not a PES fidelity or full-regulation claim.

## claims_not_made

- No suite-level PASS claim: the per-test overall for the rules suite stays `NOT_EVALUATED` / `BLOCKED_MISSING_REFERENCE`.
- No PROMOTION claim.
- No criterion is upgraded beyond what the executed evaluator returns; PASS is reported only where the driven stream genuinely carries the semantics, and NOT_EVALUATED elsewhere.
- No PES 2017 fidelity / measured PES envelope claim; MATCH-GOAL-KICK-DISTRIBUTION and MATCH-CORNER-KICK-CROSS stay `BLOCKED_MISSING_REFERENCE` (§14).
- No FOUNDATION_LAB_PASS claim.
- No invented reference envelope or tolerance; the 7 BLOCKED_MISSING_REFERENCE values stay blocked.
- The corner cluster (MATCH-CORNER-KICK-*) is NOT evaluated or claimed here; it is owned by CORNER-DRIVEN-CONFORMANCE.
- No gameplay / source / contract / adapter / spec change: `git diff --stat -- src/` is EMPTY; `specs/` EMPTY; only the eval oracles/invariant bindings (additive), a driven timing scenario, evidence + tests are added.
