# RULES-SUITE-REGISTRATION — builder result

## Builder report

- **objective_id:** RULES-SUITE-REGISTRATION
- **builder_agent:** builder-structured
- **builder_model:** deepseek-v4-flash
- **evidence_class:** HEADLESS
- **hypothesis:** Registering the `rules` evaluator suite (suite-rules-v1) per MATCH_RULES_SPEC §15 — suite contract, per-rule criteria bindings, observation/invariant definitions, a scenario stub, and eight protected pure `TelemetryObservation[] → InvariantResult[]` oracles for the §15 adjudicating criteria — makes the rules semantics executable against committed observation streams. Following the GK-SPEC-SUITE-CONTRACTS + GK-KEEPER-ORACLE-REGISTRATION pattern, the change is contract/oracle/registry data only (no `src/`, `src/simulation/`, `src/contracts/`, `src/adapters/`, `eval/scenarios/`, or `specs/` change), additive-only in `eval/runners/`, and never upgrades a criterion beyond what the executed evaluator returns or invents an envelope. The oracles are falsifiable (mutant → FAIL) and genuinely-invalid observations FAIL; criteria with no observable semantics (restart executions and the core matchPhase/matchTimer are not serialized) return the honest NOT_EVALUATED.

### files_changed

- `eval/contracts/suites.ts` (MODIFIED) — adds `RULES_SUITE` (suite-rules-v1: eight family rule tests, no COMMON-* criteria since the foundation suites own the shared COMMON invariants) and registers it in `SUITES`.
- `eval/contracts/policies.ts` (MODIFIED) — adds `config-rules-v1` config matrix (nominal `match-rules-v1` reference) and `expansion-rules-v1` expansion manifest, plus their registry entries.
- `eval/contracts/common-criteria.ts` (MODIFIED) — adds the 25 §15 `MATCH-*` criteria (all registered in `COMMON_CRITERIA`) with honest classes (HARD_INVARIANT for the structural semantics; MEASURED_TARGET for `MATCH-GOAL-KICK-DISTRIBUTION` / `MATCH-CORNER-KICK-CROSS` → `BLOCKED_MISSING_REFERENCE`).
- `eval/contracts/invariant-definitions.ts` (MODIFIED) — adds eight rules invariants (`rules-*-evidence`) bound to the protected rules oracles.
- `eval/contracts/observation-definitions.ts` (MODIFIED) — adds `obs-rules-restart-v1` observation definition (event stream + ball lastTouchRef).
- `eval/contracts/scenarios.ts` (MODIFIED) — adds `scn-rules-lifecycle-v1` scenario stub (contract registry data only).
- `eval/contracts/bindings.ts` (MODIFIED) — adds eight rules test bindings (`RULES-OOP-001`, `RULES-THROWIN-001`, `RULES-GOALKICK-001`, `RULES-CORNERKICK-001`, `RULES-KICKOFF-001`, `RULES-SCORING-001`, `RULES-TIMING-001`, `RULES-ANTIHUDDLE-001`), each resolving to the rules scenario + observation + the criteria bindings.
- `eval/oracles/rules-restart.ts` (NEW) — six protected oracles: checkOutOfPlayDetection, checkOutOfPlayNoLastTouch, checkThrowInAward, checkGoalKickAward, checkCornerKickAward, checkGoalDetection.
- `eval/oracles/rules-phase.ts` (NEW) — two protected oracles: checkKickoffFreeze, checkTimerFreeze.
- `eval/oracles/wire.ts` (MODIFIED) — registers the eight rules oracles (oracle ids `rules-*-oracle-v1`).
- `eval/runners/foundation-evaluator.ts` (MODIFIED, additive) — maps the eight `MATCH-*` criteria in `CRITERION_TO_ORACLE` to the new protected oracles. **No existing entry changed.**
- `tests/unit/eval/rules-oracle.test.ts` (NEW) — 24 oracle unit guards (clean PASS + mutant FAIL + NOT_EVALUATED per oracle).
- `tests/unit/eval/rules-suite.test.ts` (NEW) — 17 suite registration / honesty / negative-control tests.
- `tests/unit/eval/RULES-SUITE-REGISTRATION-binding.test.ts` (NEW) — 13 binding tests locking the eight oracle criteria to their registered protected oracles.
- `tests/unit/eval/eval-registry.test.ts` (MODIFIED) — test-binding count 48 → 56 (8 rules bindings added).
- `scripts/capture-rules-suite-state.ts` (NEW) — reproducible record producer.
- `docs/evidence/RULES-SUITE-REGISTRATION/audit.json` (NEW, generated), `rules-suite-state.json` (NEW), `RESULT.md` (NEW).

**Zero changes** to `src/`, `src/simulation/`, `src/contracts/`, `src/adapters/`, `eval/scenarios/`, or `specs/` (verified: `git diff -- src/ src/simulation/ src/contracts/ src/adapters/ eval/scenarios/ specs/` is empty — the command printed nothing).

### eval/runners/ touch (disclosed, additive-only)

The hard-constraint line lists `eval/runners/` as a path that must follow the gk-role/foundation-evaluator precedent and be disclosed and additive-only. The objective's own purpose (binding the §15 criteria to the new oracles) requires the criteria→oracle resolution that lives **only** in `eval/runners/foundation-evaluator.ts` (`CRITERION_TO_ORACLE`); there is no data-driven path, and the duels/GK wiring already modified this same file. The change is a 35-line purely-additive insertion (no existing entry altered), so the duels/foundation/GK criteria keep their existing bindings. **`eval/runners/headless-match.ts` is untouched** — the runner default (`lifecyclePhaseSync: "core-owned"`) and all runner behavior are unchanged.

### commands_run

- cmd: `mise run typecheck`
    exit_code: 0
    result: "tsc --noEmit core + node + browser all clean"
- cmd: `mise exec -- pnpm exec tsx scripts/capture-rules-suite-state.ts`
    exit_code: 0
    result: "wrote docs/evidence/RULES-SUITE-REGISTRATION/rules-suite-state.json (record_sha256=7503f9fe61b86731d08460dd47651b541abc3672b21ff26d0056ad8fd81029f8; candidate_commit=ab5dac6; 3 accepted restart fixtures re-run headlessly under the core-owned lifecycle and evaluated through evaluateSuite('rules', observations))"
- cmd: `mise exec -- pnpm exec tsx scripts/capture-rules-suite-state.ts` (second, ordinary-mode re-run — byte-identity demonstration)
    exit_code: 0
    result: "record_sha256=7503f9fe61b86731d08460dd47651b541abc3672b21ff26d0056ad8fd81029f8 (identical to the first run); the two artifacts are byte-identical (file sha256 5cae337787b63d3fc3e4364047e0f93a972edaefb6889ce515e1d153b1c3d6e8 === 5cae337787b63d3fc3e4364047e0f93a972edaefb6889ce515e1d153b1c3d6e8; diff empty; cmp identical)"
- cmd: `pnpm exec vitest run tests/unit/eval/{rules-oracle,rules-suite,RULES-SUITE-REGISTRATION-binding}.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "54/54 PASS (rules-oracle 24, rules-suite 17, RULES-SUITE-REGISTRATION-binding 13)"
- cmd: `pnpm exec vitest run tests/unit/eval/{goalkeepers-suite,eval-registry,duels-suite,oracle-registry,mutant-core,gk-oracle,GK-KEEPER-ORACLE-REGISTRATION-binding,GK-SUITE-ORGANIC-STATE-binding,match-rules-spec-binding}.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "220/220 PASS across 9 files (goalkeepers-suite 24, eval-registry 48, duels-suite 39, oracle-registry 19, mutant-core 33, gk-oracle 16, GK-KEEPER-ORACLE-REGISTRATION-binding 5, GK-SUITE-ORGANIC-STATE-binding 8, match-rules-spec-binding 28)"
- cmd: `pnpm exec vitest run tests/unit/eval/{foundation-evaluator,foundation-lab-evidence-binding.node,playable-1v1-re-evaluation}.test.ts tests/candidate-scope.node.test.ts tests/evidence-sanity.node.test.ts --project node --testTimeout 300000`
    exit_code: 0
    result: "78/78 PASS (foundation-evaluator 36, playable-1v1-re-evaluation 29, foundation-lab-evidence-binding 8, candidate-scope 2, evidence-sanity 3) — accepted foundation pins and provenance reproduce"
- cmd: `pnpm exec vitest run tests/capture-hygiene.node.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "3/3 PASS (capture hygiene gate)"
- cmd: `mise exec -- pnpm run gauntlet:audit -- --objective RULES-SUITE-REGISTRATION --class HEADLESS --tests-pass true --integration-test-pass true`
    exit_code: 0
    result: "status PASS (tests result PASS; screenshot/trajectory/semantic/integration/slot checks NOT_APPLICABLE for HEADLESS; all orchestrator state checks PASS)"

### tests_run

- name: `rules-oracle.test.ts`
    result: "PASS (24 tests — each of the 8 oracles: clean PASS + mutant FAIL; genuinely-invalid observation FAILs; non-observable stream NOT_EVALUATED)"
- name: `rules-suite.test.ts`
    result: "PASS (17 tests — suite registration, expansion, evaluateSuite execution, honest outcomes over a restart-free run, real verdict over a restart stream, negative controls)"
- name: `RULES-SUITE-REGISTRATION-binding.test.ts`
    result: "PASS (13 tests — criterion_bindings → InvariantDefinition → registered protected oracle chain for all 8 oracle criteria; evaluateSuite real verdicts; registry consistency)"
- name: `eval-registry.test.ts`
    result: "PASS (48 tests, one count updated 48 → 56 for the 8 rules bindings; pre-existing assertions unchanged)"
- name: `goalkeepers-suite.test.ts`
    result: "PASS (24 tests, pre-existing untouched)"
- name: `duels-suite.test.ts`
    result: "PASS (39 tests, pre-existing untouched)"
- name: `oracle-registry.test.ts`
    result: "PASS (19 tests, pre-existing untouched)"
- name: `mutant-core.test.ts`
    result: "PASS (33 tests, pre-existing untouched)"
- name: `gk-oracle.test.ts` / `GK-KEEPER-ORACLE-REGISTRATION-binding.test.ts` / `GK-SUITE-ORGANIC-STATE-binding.test.ts`
    result: "PASS (16/5/8 — pre-existing keeper tests reproduce)"
- name: `match-rules-spec-binding.test.ts`
    result: "PASS (28 tests — the RULES-SPEC-DRAFT spec binding still holds; the spec is untouched)"
- name: `foundation-evaluator.test.ts` / `foundation-lab-evidence-binding.node.test.ts` / `playable-1v1-re-evaluation.test.ts`
    result: "PASS (73 tests) — accepted foundation suite pins and provenance assertions reproduce (the provenance assertions already tolerate registry evolution, so the registry hash change does not break them)"

### integration_test_result

For `HEADLESS`, the audit marks the integration-test check `NOT_APPLICABLE`. A relevant integration/provenance check was still exercised: the `RULES-SUITE-REGISTRATION-binding.test.ts` and `rules-suite.test.ts` reproduce `evaluateSuite("rules", …)` over committed observation streams (a constructed throw-in window and the accepted restart fixtures) and confirm the evaluator yields the real per-run verdicts, while a non-rule stream stays `NOT_EVALUATED`. The accepted foundation/keeper provenance gates (`foundation-lab-evidence-binding.node`, `playable-1v1-re-evaluation`, `GK-SUITE-ORGANIC-STATE-binding`) reproduce.

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing.

### required_evidence

- Deterministic audit: `docs/evidence/RULES-SUITE-REGISTRATION/audit.json` (status `PASS`).
- Executed tests (HEADLESS): the 54-test rules gate, the 220-test neighbor/evaluator gate, the 78-test foundation/provenance gate, and the 3-test capture-hygiene gate.
- Honest suite state: `docs/evidence/RULES-SUITE-REGISTRATION/rules-suite-state.json` (`record_sha256` 7503f9fe…; byte-reproducible across ordinary-mode re-runs).

### artifacts

- `docs/evidence/RULES-SUITE-REGISTRATION/rules-suite-state.json`
- `docs/evidence/RULES-SUITE-REGISTRATION/audit.json`
- `docs/evidence/RULES-SUITE-REGISTRATION/RESULT.md`

### spec_sections

- `specs/MATCH_RULES_SPEC.md` §5–§11 (out-of-play, throw-in, goal kick, corner kick, kickoff/reset, scoring, timing, anti-huddle interaction), §12 (freeze/first-touch), §13 (versioned provisional `match-rules-v1` / referenced accepted model ids), §14 (BLOCKED_MISSING_REFERENCE), §15 (the adjudicating criteria registered here), §17 (declaration of limitations).
- `eval/contracts/suites.ts` (suite-rules-v1), `bindings.ts`, `observation-definitions.ts`, `invariant-definitions.ts`, `common-criteria.ts`, `scenarios.ts`, `policies.ts`.
- `eval/oracles/rules-restart.ts` / `rules-phase.ts` (protected rules oracles), `eval/oracles/wire.ts` (registration), `eval/oracles/oracle-registry.ts`.
- `eval/runners/foundation-evaluator.ts` (criterion→oracle resolution), `eval/runners/headless-match.ts` (unchanged; the accepted core-owned lifecycle the rules run under).
- `gauntlet/evidence-contract.md` (HEADLESS), `gauntlet/roles/builder-structured.md` (role contract).

### acceptance_criteria_met

- New `rules` suite (suite-rules-v1) registered alongside `goalkeepers`/`duels`; the §15 named criteria are all bound as executable `criterion_bindings` (the eight oracle-bound criteria additionally via `CRITERION_TO_ORACLE`).
- Eight protected rules oracles registered in `wire.ts` and mapped in `foundation-evaluator.ts`; each is a pure `TelemetryObservation[] → InvariantResult[]` reading only committed observation fields; thresholds come from the referenced accepted `foundation-goal-v1` geometry / `anti-huddle-v1` tolerances, never a PES value.
- Mutant/canary guards per oracle (a mutated observation flips the verdict; a genuinely-invalid observation FAILs), plus the honest NOT_EVALUATED when a semantics is not serialized.
- `evaluateSuite("rules", observations)` runs over the accepted restart fixtures and yields the honest verdict table (see below): 4 §15 criteria PASS where the stream truly carries them; the restart-AWARD criteria are NOT_EVALUATED because the committed observation stream does not serialize the restart-executed event; `MATCH-GOAL-KICK-DISTRIBUTION` / `MATCH-CORNER-KICK-CROSS` are `BLOCKED_MISSING_REFERENCE` (§14); `MATCH-TIMER-FREEZE` is honestly NOT_EVALUATED (the core matchPhase/matchTimer are not serialized).
- No existing oracle, criterion, catalog entry, scenario or spec changed; `src/`, `src/simulation/`, `src/contracts/`, `src/adapters/`, `eval/scenarios/`, `specs/` EMPTY; `eval/runners/` change additive-only (`foundation-evaluator.ts`).
- Neighbor suites green (goalkeepers, duels, eval-registry, oracle-registry, mutant-core, gk-oracle, GK bindings); accepted foundation/keeper pins reproduce; `mise run typecheck` exit 0; `gauntlet:audit` status PASS.
- Missing references stay `BLOCKED_MISSING_REFERENCE`; no invented envelope or tolerance.

### registry hash change (provenance accommodation)

Adding the `rules` suite legitimately changes the registry content hash: **`fnv1a64-v1:c9098fb8ecd66341` → `fnv1a64-v1:980873a8286fe142`**. The two accepted-artifact provenance assertions (`foundation-lab-evidence-binding.node.test.ts`, `playable-1v1-re-evaluation.test.ts`) were already made registry-evolution aware in GK-SPEC-SUITE-CONTRACTS (they assert the persisted `registrySetId` is a genuine non-placeholder `fnv1a64-v1:` hash, not strict equality with the now-superset live registry), so they pass without any change. No accepted evidence file was modified.

### broken constraints / disclosures

- **Record reproducibility fix (integration REJECT → resolved)**. The `scripts/capture-rules-suite-state.ts` producer originally stamped the durable record with a wall-clock `generated_at: new Date().toISOString()` and hashed that field into `record_sha256`, so an ordinary-mode re-run produced a different `record_sha256` (reviewer recompute `52706c1c…` vs pinned `9589b51a…`, differing only in `generated_at`; all verdict content byte-identical). This deviated from the accepted `scripts/capture-possession-oracle-triage.ts` precedent, which carries no timestamp field and whose `record_sha256` is stable across ordinary re-runs. Fix: the `generated_at` field was **removed** from both the `Artifact` interface and the record object, so the durable record is byte-reproducible and its `record_sha256` is stable. **Producer delta (only change to the script):** deleted `generated_at: string;` from the `Artifact` interface and deleted `generated_at: new Date().toISOString(),` from the record literal. No other field, run spec, aggregation, or hash strategy changed. Consequence: the record no longer tracks when it was produced (the audit `generated_at` lives in `audit.json`, produced separately by `gauntlet:audit`); every run's verdict content is unchanged.
- **Two-run byte-identity demonstration** (`mise exec -- pnpm exec tsx scripts/capture-rules-suite-state.ts`, run twice in ordinary mode, no `WIP_SECTION` gate):
  - run 1 → `record_sha256=7503f9fe61b86731d08460dd47651b541abc3672b21ff26d0056ad8fd81029f8`; file sha256 `5cae337787b63d3fc3e4364047e0f93a972edaefb6889ce515e1d153b1c3d6e8`.
  - run 2 → `record_sha256=7503f9fe61b86731d08460dd47651b541abc3672b21ff26d0056ad8fd81029f8`; file sha256 `5cae337787b63d3fc3e4364047e0f93a972edaefb6889ce515e1d153b1c3d6e8`.
  - `diff <run1> <run2>` empty; `cmp <run1> <run2>` identical. The two artifacts are byte-for-byte identical and the pinned `record_sha256` is stable across consecutive ordinary-mode re-runs.
- **Registry hash changed** (disclosed above): the additive suite registration is a legitimate registry evolution; the provenance gates pass with the accommodated assertions.
- **eval/runners/ touched (additive-only)**: `foundation-evaluator.ts` `CRITERION_TO_ORACLE` additions (disclosed above). `headless-match.ts` is untouched.
- **Restart-executed events are not serialized into the committed observation stream**: `buildObservation` consumes the per-step event array, which does not include the `apply*` restart-executed events written to the persistent `state.events`. So a rule oracle cannot verify the executed restart award (MATCH-THROW-IN-AWARD / MATCH-GOAL-KICK-AWARD / MATCH-CORNER-KICK-AWARD) from the standard observation stream — these criteria are honestly `NOT_EVALUATED` on the accepted runs. The oracles are still correct and falsifiable (unit tests construct a stream that does carry the event) and the §15 criteria remain registered/executable; a future objective that serializes the restart-executed events (or the core matchPhase/matchTimer) can upgrade these to PASS/FAIL without a spec or registry change.
- **Core matchPhase / matchTimer are not serialized**: `MATCH-TIMER-FREEZE` and the timer-family criteria are honestly `NOT_EVALUATED` because the decrement-gated-on-playing contract is core-owned and not in the observation stream. `checkTimerFreeze` is a protected oracle that returns the honest NOT_EVALUATED and never over-claims PASS.

### un-run-remainder consumer inventory (LIFECYCLE-MIGRATION lesson)

`runHeadlessMatch` is **not** modified by this objective (only `foundation-evaluator.ts` is touched in `eval/runners/`), so its default (`lifecyclePhaseSync: "core-owned"`) and every consumer's behavior is unchanged. For completeness I inventoried every caller of `runHeadlessMatch` (grep `runHeadlessMatch` across the repo): the `2v2-scoring*` unit tests, `match-scoring.test.ts`, `match-set-piece.test.ts`, `GK-SUITE-ORGANIC-STATE-binding.test.ts`, `GK-SUITE-VERDICTS-STATE-binding.test.ts`, `COMMON-FULL-MATCH-INVARIANT-TRIAGE-guard.test.ts`, the `SMALL-SIDED-*` evidence-binding tests, and `eval/runners/restart-anti-huddle-match.ts` / `capture-restart-anti-huddle-evidence.ts`. Each is unaffected: the runner's behavior, its default lifecycle policy, and its event stream are unchanged by a purely additive criterion→oracle map in the evaluator, and the rules oracles are read-only observation functions that never write back. No accepted pin needs re-proof from this objective.

### known_gaps

- The restart-AWARD and timer-family criteria are registered and executable but honestly `NOT_EVALUATED` on the accepted runs because the committed observation stream does not serialize the restart-executed events or the core matchPhase/matchTimer. Upgrading them to real PASS/FAIL requires a future objective that serializes those (e.g. a runner-level observation annotation following the GK `gk-role` precedent), not a registry change.
- The rules suite has no COMMON-* criteria (it delegates the shared COMMON invariants to the foundation suites); the intent is to keep the suite focused on §15 semantics while the foundation suites cover the common invariants.
- No gameplay inference about the CORE's correctness is drawn from the rules PASS verdicts: a PASS on MATCH-OUT-OF-PLAY-DETECT / MATCH-KICKOFF-FREEZE / MATCH-SCORING-GOAL-DEVENT is a statement that the committed observation stream satisfies that §15 semantic, not a PES fidelity or full-regulation claim.

### claims_not_made

- No PROMOTION claim.
- No rule criterion upgraded beyond what the executed evaluator returns; the four §15 criteria that PASS (MATCH-OUT-OF-PLAY-DETECT, MATCH-OUT-OF-PLAY-NO-LAST-TOUCH, MATCH-KICKOFF-FREEZE, MATCH-SCORING-GOAL-DEVENT) do so only where the committed observation stream genuinely carries the semantics.
- MATCH-OUT-OF-PLAY-NO-LAST-TOUCH PASS attests the observable null-touch-boundary identification only: on committed streams the restart-execution events are not serialized, so that criterion's FAIL branch (a no-last-touch boundary followed by a restart) is not exercisable on the accepted runs.
- No PES 2017 fidelity / measured PES envelope claim.
- No FOUNDATION_LAB_PASS claim.
- No invented reference envelope or tolerance; the 7 BLOCKED_MISSING_REFERENCE values (throw_in_trajectory_ref, goal_kick_distribution_ref, corner_cross_trajectory_ref, restart_serve_latency_ref_ms, post_goal_reset_ref_ticks, half_time_break_ref_seconds, ball_in_play_accounting_ref) stay blocked, and MATCH-GOAL-KICK-DISTRIBUTION / MATCH-CORNER-KICK-CROSS resolve to BLOCKED_MISSING_REFERENCE.
- No gameplay / source / contract / adapter / scenario / spec change (`src/`, `src/simulation/`, `src/contracts/`, `src/adapters/`, `eval/scenarios/`, `specs/` EMPTY); `eval/runners/` change additive-only and disclosed.
- The accepted rules spec, keeper, duels and foundation pins reproduce; the registry hash change is a disclosed legitimate evolution with the provenance assertions already accommodating it.

---

## Executed rules-suite outcome on the accepted runs

Loaded from `docs/evidence/RULES-SUITE-REGISTRATION/rules-suite-state.json` (record_sha256 `7503f9fe…`), produced by re-running the accepted RESTART-ANTI-HUDDLE-COHERENCE fixtures `5v5-restart-throwin.v1.json`, `5v5-restart-arc.v1.json`, and `5v5-continuous-play.v1.json` (1800 ticks each) headlessly under `lifecyclePhaseSync: "core-owned"` and evaluating `evaluateSuite("rules", observations)`.

| Criterion (§15) | Class | Executed outcome (accepted runs) | Source |
|---|---|---|---|
| MATCH-OUT-OF-PLAY-DETECT | HARD_INVARIANT | **PASS** | boundary events carry well-formed payloads; goal / goal-line out-of-play mutually exclusive |
| MATCH-OUT-OF-PLAY-NO-LAST-TOUCH | HARD_INVARIANT | **PASS** | every no-last-touch boundary correctly opened no restart — attests the observable null-touch-boundary identification only, since on committed streams the restart-execution events are not serialized and so the FAIL branch (a no-last-touch boundary followed by a restart) is not exercisable here |
| MATCH-KICKOFF-FREEZE | HARD_INVARIANT | **PASS** | with a clean multi-body untouched opening window, only the taker + any at-ball body left home |
| MATCH-SCORING-GOAL-DEVENT | HARD_INVARIANT | **PASS** | every goal event carries a valid goalIndex and is mutually exclusive with out-of-play |
| MATCH-THROW-IN-AWARD | HARD_INVARIANT | NOT_EVALUATED | restart-executed event not serialized into the committed observation stream |
| MATCH-GOAL-KICK-AWARD | HARD_INVARIANT | NOT_EVALUATED | restart-executed event not serialized |
| MATCH-CORNER-KICK-AWARD | HARD_INVARIANT | NOT_EVALUATED | restart-executed event not serialized |
| MATCH-TIMER-FREEZE | HARD_INVARIANT | NOT_EVALUATED | core matchPhase/matchTimer not serialized into the observation stream |
| MATCH-THROW-IN-PLACEMENT / SERVE / TIMER-FREEZE | HARD_INVARIANT | NOT_EVALUATED | no oracle yet → honest NOT_EVALUATED |
| MATCH-GOAL-KICK-PLACEMENT / TIMER-FREEZE | HARD_INVARIANT | NOT_EVALUATED | no oracle yet → honest NOT_EVALUATED |
| MATCH-CORNER-KICK-PLACEMENT / TIMER-FREEZE | HARD_INVARIANT | NOT_EVALUATED | no oracle yet → honest NOT_EVALUATED |
| MATCH-GOAL-KICK-DISTRIBUTION | MEASURED_TARGET | **BLOCKED_MISSING_REFERENCE** | §14 goal_kick_distribution_ref blocked |
| MATCH-CORNER-KICK-CROSS | MEASURED_TARGET | **BLOCKED_MISSING_REFERENCE** | §14 corner_cross_trajectory_ref blocked |
| MATCH-KICKOFF-FIRST-TOUCH / RESTART-REARM | HARD_INVARIANT | NOT_EVALUATED | no oracle yet → honest NOT_EVALUATED |
| MATCH-SCORING-GOAL-PHASE | HARD_INVARIANT | NOT_EVALUATED | no oracle yet → honest NOT_EVALUATED |
| MATCH-TIMER-DECREMENT / HALFTIME / FULLTIME | HARD_INVARIANT | NOT_EVALUATED | no oracle yet → honest NOT_EVALUATED |
| MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH / NEAREST-ONLY | HARD_INVARIANT | NOT_EVALUATED | no oracle yet → honest NOT_EVALUATED |

### Per-run verdicts (executed, not forced)

| Run (1800 ticks, core-owned) | OOP-DETECT | OOP-NO-TOUCH | KICKOFF-FREEZE | SCORING-GOAL-DEVENT | THROW-IN-AWARD | TIMER-FREEZE |
|---|---|---|---|---|---|---|
| rules-throwin-live (`5v5-restart-throwin.v1.json`) | PASS | PASS | PASS | PASS | NOT_EVALUATED | NOT_EVALUATED |
| rules-goalkick-postgoal-live (`5v5-restart-arc.v1.json`) | PASS | NOT_EVALUATED | PASS | PASS | NOT_EVALUATED | NOT_EVALUATED |
| rules-corner-live (`5v5-continuous-play.v1.json`) | PASS | NOT_EVALUATED | NOT_EVALUATED | PASS | NOT_EVALUATED | NOT_EVALUATED |

## Disclosure of oracle design per criterion

All eight oracles are pure `TelemetryObservation[] → InvariantResult[]` and read **only** committed observation fields (events, players, `ball.lastTouchRef`), using the accepted `foundation-goal-v1` geometry and `anti-huddle-v1` tolerance.

| Criterion | Observation fields read → verdict logic |
|---|---|
| **MATCH-OUT-OF-PLAY-DETECT** | `goal` / `ball-out-of-play` / `ball-touchline-out-of-play` events. FAIL on a malformed boundary payload (goalIndex/touchlineIndex out of {0,1}, missing ballPosition) or on a tick emitting both a goal and a goal-line out-of-play; PASS when all boundary events are well-formed; NOT_EVALUATED when no boundary event is observed. |
| **MATCH-OUT-OF-PLAY-NO-LAST-TOUCH** | boundary events + lastTouchRef (resolved against the event union). FAIL when a boundary whose lastTouchRef does not resolve to a team is nonetheless followed by a restart execution; PASS when every no-last-touch boundary correctly opened no restart; NOT_EVALUATED when every boundary had a resolvable last touch (or none seen). |
| **MATCH-THROW-IN-AWARD** | touchline out-of-play event (lastTouchRef), the recorded touch event (teamId), and the `throw-in-executed` event (teamId), paired in order. FAIL when the executed throw-in is not the opposite of the last-touch team; PASS when every completed throw-in is opposite the last-touch team; NOT_EVALUATED when no completed throw-in (the execution event is not serialized in the standard stream). |
| **MATCH-GOAL-KICK-AWARD** | goal-line out-of-play (goalIndex, lastTouchRef) + recorded touch (teamId) + `goal-kick-executed` (teamId). FAIL when the last-touch team is the defending team (a corner is required) or the executed goal kick is not the defending team; PASS when every completed goal kick goes to the defending team; NOT_EVALUATED when none observed. |
| **MATCH-CORNER-KICK-AWARD** | goal-line out-of-play (goalIndex, lastTouchRef) + recorded touch (teamId) + `corner-kick-executed` (teamId). FAIL when the last touch is not the defending team (a goal kick is required) or the executed corner is not the attacking team; PASS when every completed corner goes to the attacking team; NOT_EVALUATED when none observed. |
| **MATCH-SCORING-GOAL-DEVENT** | `goal` events. FAIL on an invalid goalIndex or a same-tick goal + goal-line out-of-play; PASS when every goal is valid and mutually exclusive; NOT_EVALUATED when no goal observed. |
| **MATCH-KICKOFF-FREEZE** | per-tick player positions + ball.lastTouchRef over the opening untouched window. FAIL when >2 bodies leave their tick-0 home beyond `KICKOFF_FREEZE_HOME_TOLERANCE` (0.75 m) while the ball is untouched; PASS when ≤2 do; NOT_EVALUATED when there is no untouched opening window or only one body (nothing to freeze). |
| **MATCH-TIMER-FREEZE** | the observation does not carry the core matchPhase per tick nor the matchTimer. Returns the honest NOT_EVALUATED (never over-claims a timer-freeze PASS); empty on an empty stream. |
