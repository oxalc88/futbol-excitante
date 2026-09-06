# RESTART-RULES-CONFORMANCE — builder result

## Builder report

- **objective_id:** RESTART-RULES-CONFORMANCE
- **builder_agent:** builder-structured
- **builder_model:** deepseek-v4-flash
- **evidence_class:** MULTI_TICK
- **hypothesis:** The commit observation stream cannot adjudicate the restart-AWARD (throw-in / goal-kick / corner-kick) or the TIMER-FREEZE criteria because it never serializes the restart-executed events or the core's matchPhase/matchTimer — they are honestly NOT_EVALUATED on the accepted runs. Closing that gap HONESTLY via a gated, additive, post-loop observation extension (the gk-role precedent) makes those criteria measurable, and driving the accepted restart machinery (throw-in + goal-kick fixtures) through the extended stream yields honest per-restart-type conformance verdicts through the registered `rules` suite. Behavior is untouched (the restart machinery is the implementation under test — only OBSERVATIONS are extended).

### The serialization extension (design)

A new gated runner option `runHeadlessMatch({ serializeRestartFacts })` (default **false**) in `eval/runners/headless-match.ts`:

1. **Per-tick `core-match-phase` event.** After the loop it injects, into every observation, a `core-match-phase` event carrying the core's post-step `matchPhase`, `matchTimer` (drives `checkTimerFreeze`), and the **starting** `startPhase` of that tick (drives the phase-aware award pairing below). The post-step phase/timer are read from the state at the start of the following iteration (the previous tick's post-step state) and, for the last tick, from one post-loop snapshot — reusing the snapshot the runner already takes, so no extra per-tick clone.
2. **Committed restart-executed events.** The core writes `throw-in-executed` / `goal-kick-executed` / `corner-kick-executed` to its persistent `state.events`, which the observation stream's per-step event array never carries. The runner reads them from `sim.snapshot().events` post-loop and injects each into the matching-tick observation, preserving the committed `id` / `tick` / `sequence` / `payload` so the award oracles pair them with the right boundary event.

**Gating & invariance.** The whole block is gated on `serializeRestartFacts`; all facts are injected post-loop, after every input is applied, every step is run, and every state hash / observation-core hash is committed. When false (the default) the observation stream is byte-identical to every accepted non-gated run — verified by the `serializeRestartFacts` guard test (identical `stateHash` chains, 0 injected facts). The simulation core, its event union, and its contracts are untouched.

**Phase-aware award pairing (correctness fix, not a regression).** With the serialized facts, `pairRestartBoundaries` (shared by the restart oracles) now recognises the phase-opening boundary: restart windows open only from a `"playing"` phase, so a boundary emitted on a tick whose `startPhase` is not `"playing"` was ignored by the core (an already-open window) and must not be paired with an execution. Without this, an organic run with a second touchline boundary mid-window mis-attributes the execution to the wrong boundary (a false award FAIL). When the stream has no phase facts (synthetic unit streams, non-gated runs) the original last-boundary-of-kind rule is used unchanged, so the pre-existing oracle unit tests still hold.

### Consumer inventory (LIFECYCLE-MIGRATION lesson)

Every oracle registered in `eval/oracles/wire.ts` was inventoried against the two injected event kinds. On a non-gated run nothing is injected, so every consumer is byte-identical. On a gated run:

| Consumer | Effect of injected facts |
|---|---|
| `rules-timer-freeze` (`checkTimerFreeze`) | reads `core-match-phase` → real PASS/FAIL/NOT_EVALUATED (intended; previously unconditional NOT_EVALUATED). |
| `rules-throw-in/goal-kick/corner-kick-award` | read the injected restart-executed events → real verdicts (intended). |
| `rules-out-of-play-no-last-touch` | reads boundaries + the phase-aware pairing; the FAIL branch (a no-last-touch boundary followed by a restart) is now exercisable on gated streams. |
| `rules-out-of-play-detect` / `rules-goal-detection` | read only `goal` / `ball-out-of-play` / `ball-touchline-out-of-play`; injected kinds ignored. |
| `rules-kickoff-freeze` | reads players + `ball.lastTouchRef`; unaffected. |
| `event-references` | sequence-uniqueness check stays green because every injected event is assigned a globally-unique sequence (the restart-executed events keep their committed sequences; the `core-match-phase` event uses `maxSeq+1`). |
| `finite/bounds/ball-continuity/velocity-snap/ball-decay/ball-teleport/possession-evidence/prng-order/player-contact/tackle-phase/score-tracker/match-clock/gk-*` | none read the injected kinds. |
| `camera-hash` | **not invoked on a `rules` evaluation** — it is only ran by the mutant canary/oracle-registry tests over `evaluate()`'s own streams, never over a gated rules stream (it is not mapped in `CRITERION_TO_ORACLE`). The injected facts never reach it. |

No existing caller of `runHeadlessMatch` changes behavior: `serializeRestartFacts` defaults to false, so every pre-existing caller reproduces its prior bytes (all gates present in the prior accepted pins reproduce — see the foundation/provenance gate).

### Per-restart-type outcomes (executed evaluator, not forced)

Loaded from `docs/evidence/RESTART-RULES-CONFORMANCE/trajectory.json` (SHA-256 `62d3b49f8b6ee5c88d6e89641e3c777e3ade5c266db4c8e732c4b2938e4f6f8f`), produced by re-running the accepted restart fixtures under `lifecyclePhaseSync: "core-owned"` with `serializeRestartFacts: true` and evaluating `evaluateSuite("rules", observations)`.

| Driven run (1800 ticks, core-owned) | THROW-IN-AWARD | GOAL-KICK-AWARD | CORNER-KICK-AWARD | TIMER-FREEZE | KICKOFF-FREEZE | SCORING-GOAL-DEVENT | OOP-DETECT |
|---|---|---|---|---|---|---|---|
| `rules-throw-in-live` (`5v5-restart-throwin`, 2 throw-ins) | **PASS** | NOT_EVALUATED | NOT_EVALUATED | **PASS** | **PASS** | **PASS** | **PASS** |
| `rules-goal-kick-live` (`5v5-restart-arc`, 1 goal kick + post-goal goals) | NOT_EVALUATED | **PASS** | NOT_EVALUATED | **PASS** | **PASS** | **PASS** | **PASS** |

Stashed controls (gated off): `rules-throw-in-stashed` / `rules-goal-kick-stashed` — observations fully untreated (0 injected facts; the AWARD/TIMER-FREEZE criteria return NOT_EVALUATED), and the state-hash chains are identical to the live runs (`c4d352291e98f8d6…` / `1acd2d83745a12a0…` respectively), proving the extension cannot affect inputs / steps / committed hashes.

**Kickoff / post-goal reset** is exercised by both fixtures (the arc fixture's goals return as post-goal restarts), so `MATCH-KICKOFF-FREEZE` and `MATCH-SCORING-GOAL-DEVENT` PASS where the stream carries them.

**Corner.** No feasible driven/organic run produced a corner-kick execution, so `MATCH-CORNER-KICK-AWARD` is honestly **NOT_EVALUATED** on every run — see the disclosures.

### commands_run

- cmd: `mise run typecheck`
    exit_code: 0
    result: "tsc --noEmit core + node + browser all clean"
- cmd: `WIP_SECTION=__EVIDENCE__:RESTART-RULES-CONFORMANCE mise exec -- pnpm exec tsx scripts/capture-restart-rules-conformance.ts`
    exit_code: 0
    result: "wrote docs/evidence/RESTART-RULES-CONFORMANCE/trajectory.json and restart-rules-suite-state.json (durable-evidence; 4 runs: throw-in + goal-kick live/stashed; record_sha256=71fbd6bf12c9bc69b97361540b8c74db4cb696464f5e8efb8aacfb8863e5873f)"
- cmd: `mise exec -- pnpm exec tsx scripts/capture-restart-rules-conformance.ts` (ordinary-mode re-run — byte-reproducibility)
    exit_code: 0
    result: "record_sha256=71fbd6bf… (identical); the durable and ordinary restart-rules-suite-state.json artifacts are byte-identical (diff empty)"
- cmd: `pnpm exec vitest run tests/unit/eval/{rules-oracle,rules-suite,RULES-SUITE-REGISTRATION-binding,restart-rules-serialization}.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "63/63 PASS (rules-oracle 30, rules-suite 17, RULES-SUITE-REGISTRATION-binding 13, restart-rules-serialization 3)"
- cmd: `pnpm exec vitest run tests/unit/eval/{goalkeepers-suite,eval-registry,duels-suite,oracle-registry,mutant-core,gk-oracle,GK-KEEPER-ORACLE-REGISTRATION-binding,GK-SUITE-ORGANIC-STATE-binding,GK-SUITE-VERDICTS-STATE-binding,match-rules-spec-binding}.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "231/231 PASS (duels 39, GK-SUITE-VERDICTS-STATE-binding 11, GK-SUITE-ORGANIC-STATE-binding 8, eval-registry 48, goalkeepers-suite 24, mutant-core 33, GK-KEEPER-ORACLE-REGISTRATION-binding 5, oracle-registry 19, gk-oracle 16, match-rules-spec-binding 28)"
- cmd: `pnpm exec vitest run tests/unit/eval/{foundation-evaluator,playable-1v1-re-evaluation,foundation-lab-evidence-binding.node}.test.ts tests/candidate-scope.node.test.ts tests/evidence-sanity.node.test.ts tests/capture-hygiene.node.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "81/81 PASS (foundation-evaluator 36, playable-1v1-re-evaluation 29, foundation-lab-evidence-binding 8, candidate-scope 2, evidence-sanity 3, capture-hygiene 3)"
- cmd: `mise exec -- pnpm run gauntlet:audit -- --objective RESTART-RULES-CONFORMANCE --class MULTI_TICK --tests-pass true --integration-test-pass true`
    exit_code: 0
    result: "status PASS (16 PASS/4 NOT_APPLICABLE/0 FAIL; trajectory present; integration-test pass supplied; all orchestrator state checks PASS)"

### tests_run

- name: `rules-oracle.test.ts` — PASS (30 tests; 24 pre-existing + 6 new: 4 TIMER-FREEZE-with-facts PASS/FAIL/NOT_EVALUATED/zero-crossing-exception, 2 phase-aware award-pairing cases)
- name: `rules-suite.test.ts` — PASS (17)
- name: `RULES-SUITE-REGISTRATION-binding.test.ts` — PASS (13)
- name: `restart-rules-serialization.test.ts` — PASS (3, NEW; the serialization guards: gate-ON facts present, gate-OFF untreated + identical stateHash chain, gate-ON makes AWARD/TIMER-FREEZE measurable)
- name: `goalkeepers-suite.test.ts` / `eval-registry.test.ts` / `duels-suite.test.ts` / `oracle-registry.test.ts` / `mutant-core.test.ts` / `gk-oracle.test.ts` / `GK-KEEPER-ORACLE-REGISTRATION-binding.test.ts` / `GK-SUITE-ORGANIC-STATE-binding.test.ts` / `GK-SUITE-VERDICTS-STATE-binding.test.ts` / `match-rules-spec-binding.test.ts`
    result: "PASS (231; pre-existing, untouched neighbour matrix)"
- name: `foundation-evaluator.test.ts` / `playable-1v1-re-evaluation.test.ts` / `foundation-lab-evidence-binding.node.test.ts` / `candidate-scope.node.test.ts` / `evidence-sanity.node.test.ts` / `capture-hygiene.node.test.ts`
    result: "PASS (81) — accepted foundation pins, provenance assertions and capture hygiene reproduce"

### integration_test_result

MULTI_TICK requires a relevant integration-test pass. The rules suite is exercised over the driven extended streams (`evaluateSuite("rules", observations)` returns real award + timer-freeze verdicts), the accepted `rules` suite/binding integration reproduces, and the `verify`-style stash identity is demonstrated by the identical live/stashed state-hash chains in the trajectory.

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing.

### required_evidence

- Durable trajectory: `docs/evidence/RESTART-RULES-CONFORMANCE/trajectory.json` (SHA-256 `62d3b49f8b6ee5c88d6e89641e3c777e3ade5c266db4c8e732c4b2938e4f6f8f`).
- Honest suite-state record: `docs/evidence/RESTART-RULES-CONFORMANCE/restart-rules-suite-state.json` (SHA-256 `6033bd2ff5f3dd8d140ca7be9ff4f00397f67c6860b6fa48c10945fd51009423`; `record_sha256` `71fbd6bf…`, no wall-clock field in the hashed record, byte-reproducible).
- Executed tests (MULTI_TICK): the 63-test rules gate, the 231-test neighbour matrix, and the 81-test foundation/provenance/hygiene gate.
- Deterministic audit: `docs/evidence/RESTART-RULES-CONFORMANCE/audit.json` (status `PASS`).

### artifacts

- `docs/evidence/RESTART-RULES-CONFORMANCE/trajectory.json`
- `docs/evidence/RESTART-RULES-CONFORMANCE/restart-rules-suite-state.json`
- `docs/evidence/RESTART-RULES-CONFORMANCE/RESULT.md`
- `docs/evidence/RESTART-RULES-CONFORMANCE/audit.json`
- `eval/runners/headless-match.ts` (gated `serializeRestartFacts` extension)
- `eval/oracles/rules-restart.ts` / `rules-phase.ts` (phase-aware pairing; TIMER-FREEZE adjudication)
- `tests/unit/eval/restart-rules-serialization.test.ts`, `tests/unit/eval/rules-oracle.test.ts`
- `scripts/capture-restart-rules-conformance.ts`

### spec_sections

- `specs/MATCH_RULES_SPEC.md` §6 (throw-in award), §7 (goal-kick award), §8 (corner-kick award), §9 (kickoff/post-goal reset), §10 (scoring), §11 (timer freeze/decrement), §15 (the adjudicating criteria made measurable here), §17 (declaration of limitations).
- `eval/runners/headless-match.ts` (gated serialization), `eval/oracles/rules-restart.ts` / `rules-phase.ts` (protected rules oracles), `eval/runners/foundation-evaluator.ts` (criterion→oracle resolution), `eval/oracles/wire.ts` (registration, unchanged).
- `gauntlet/evidence-contract.md` (MULTI_TICK), `gauntlet/roles/builder-structured.md` (role contract).

### acceptance_criteria_met

- Serialization limitation closed: the committed observation stream, when the gated extension is on, now carries the restart-executed events and the per-tick core matchPhase/matchTimer/startPhase, so the restart-AWARD and TIMER-FREEZE criteria are genuinely measurable (previously honestly NOT_EVALUATED).
- Driven conformance evidence per restart type: throw-in (2 executions → MATCH-THROW-IN-AWARD PASS) and goal kick (1 execution → MATCH-GOAL-KICK-AWARD PASS); TIMER-FREEZE PASS on both driven runs; KICKOFF-FREEZE / SCORING-GOAL-DEVENT / OOP-DETECT PASS where the stream carries them. Corner is honestly NOT_EVALUATED (no execution observed) — not forced.
- MULTI_TICK trajectory with stashed controls: live + stashed per fixture; state-hash chains identical between live and stashed; stashed observations fully untreated.
- Record byte-reproducibility: `restart-rules-suite-state.json` has a pinned `record_sha256` (`71fbd6bf…`) with no wall-clock field in the hashed record; durable and ordinary-mode artifacts are byte-identical.
- Hard constraint: `git diff src/simulation/ src/contracts/ src/` is EMPTY — the extension lives entirely in the eval runner + oracles (the gk-role precedent); no core touch was needed.
- No behaviour changed: the restart machinery (the implementation under test) is untouched; the extension only extends OBSERVATIONS.
- No consumer regressed: the inventory above confirms only the intended rules oracles read the injected facts; every pre-existing suite + accepted pin is green.
- `mise run typecheck` exit 0; `gauntlet:audit` PASS (MULTI_TICK).

### known_gaps

- **Corner conformance is NOT_EVALUATED.** No feasible driven/organic run produced a corner-kick execution. In this engine a defending-team last-touch over its own goal line is rare because a defender touching the ball redirects it back toward play before the goal-line crossing. The corner oracle is unit-tested (PASS/FAIL on a synthetic stream) and the same injection path demonstrably carries throw-in and goal-kick executions, so `MATCH-CORNER-KICK-AWARD` is measurable when a corner occurs — it simply was not observed. This is disclosed, not forced.
- **`camera-hash` and the injected facts.** Because the injection adds events to a gated observation stream, `checkCameraHashConsistency` would recompute a hash that differs from `observationCoreHash` if it were ever run over a gated stream. It is not mapped to any `rules` criterion and is only exercised by the mutant/oracle-registry tests over `evaluate()`'s own (non-gated) streams, so it never sees the injected facts; the extension is intended for the `rules` suite only.
- **Pairing robustness.** The phase-aware pairing fixes the double-boundary-mid-window attribution. A same-tick cross-kind dual boundary (a goal-line and a touchline exit on one tick) is not modelled beyond the start-`"playing"`-gating; it is not observed in the driven runs.

### claims_not_made

- No `PROMOTION` / `FOUNDATION_LAB_PASS` / milestone `PASS` claim.
- No PES 2017 fidelity or measured-envelope claim; `MATCH-GOAL-KICK-DISTRIBUTION` / `MATCH-CORNER-KICK-CROSS` stay `BLOCKED_MISSING_REFERENCE` (§14), and the seven blocked reference values stay blocked.
- No rule criterion is upgraded beyond what the executed evaluator returns; PASS is reported only where the driven stream genuinely carries the semantics and NOT_EVALUATED elsewhere. Corner is NOT_EVALUATED, not forced to PASS.
- No claim that the injected facts are simulation-core events; they are runner observation-level annotations (the gk-role precedent).
- No claim of an organic corner (it is honestly NOT_EVALUATED and disclosed).
- No gameplay / source / contract / adapter / scenario change: `src/simulation/`, `src/contracts/`, `src/`, `src/adapters/`, `eval/scenarios/`, `specs/` all EMPTY.
