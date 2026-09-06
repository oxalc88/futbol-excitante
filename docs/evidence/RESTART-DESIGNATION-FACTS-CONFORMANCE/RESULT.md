# RESTART-DESIGNATION-FACTS-CONFORMANCE — builder result

## Builder report

- **objective_id:** RESTART-DESIGNATION-FACTS-CONFORMANCE
- **builder_agent:** builder-structured
- **builder_model:** deepseek-v4-flash
- **evidence_class:** MULTI_TICK
- **hypothesis:** The adapter restart-window designation facts (designated taker, per-team presser designation, window anchor, re-arm state) ARE runner-observable at the injection point. Following the gk-role precedent exactly, the runner propagates the ACTUAL adapter designation (the same exported production function the adapters act on, `assignChaseRoles`, plus the committed `coreMatchPhases` and the ball reference) rather than owning football state. Extending the gated `serializeRestartFacts` injection (default FALSE, strictly post-loop, hash-neutral) carries those designation facts as observation-level annotations, so the protected anti-huddle oracles can read the real designation and the 3 previously-NOT_EVALUATED criteria (MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH / MATCH-RESTART-NEAREST-ONLY / MATCH-RESTART-REARM) become genuinely measurable → PASS over the driven browserParity conformance streams. Blocked references stay `BLOCKED_MISSING_REFERENCE`; the corner cluster stays OUT of scope; no suite-level PASS claim is made. This is evidence + oracles/tests only: zero gameplay/source change.

### Investigation: are the designation facts runner-observable?

**Yes.** The adapter exposes the same source of truth the runner already uses:
- `assignChaseRoles(observation, untouchedOverride)` is an exported pure production function in `src/adapters/input-browser/cpu-adapter.ts` that the adapters call each tick to compute the single designated chaser per team, the presser, the cover, and the at-ball designation.
- The adapter's `untouched`/re-arm logic is mirrorable from the committed `coreMatchPhases` + ball `lastTouchRef` (the same inputs the adapter observes under `browserParityObservations: true`). The gk-role precedent (`designateKeeperFromLayout`) is exactly this pattern: the runner computes the designation post-loop from shared production code and injects it as an observation annotation, without owning football state.

So the runner can propagate the ACTUAL adapter designation (designated taker, per-team presser, window anchor, `baselineTouchRef`/re-armed) through the gated `serializeRestartFacts` injection. Confirmed empirically: the browserParity arc run yields 8 untouched windows including 6 re-armed post-goal windows; the non-browserParity run yields only 2 (no re-arm), matching the adapter's real behavior.

### files_changed

- `eval/runners/headless-match.ts` (extend the gated `serializeRestartFacts` injection to carry the adapter restart-window designation facts: `restart-designation` events with `ballUntouched`, designated taker, per-team designated chaser, per-body window anchor, `baselineTouchRef`/re-armed; also clear the re-arm baseline on a boundary event so a post-reset window does not extend into a subsequent restart hold).
- `eval/oracles/rules-restart.ts` (add the 3 protected anti-huddle oracles — `checkRestartFreezeUntilFirstTouch`, `checkRestartNearestOnly`, `checkRestartRearm` — mutant/canary-guarded falsifiers; align `checkKickoffFirstTouch` with spec §12.1 keeper exclusion).
- `eval/contracts/bindings.ts` / `eval/contracts/invariant-definitions.ts` (register the 3 anti-huddle criteria + the new protected invariants under the additive discipline).
- `eval/oracles/wire.ts` (wire the 3 new oracles into the evaluator).
- `eval/runners/foundation-evaluator.ts` (criterion→oracle resolution for the new criteria).
- `tests/unit/eval/restart-rules-serialization.test.ts` (extended serialization guards: live/stashed chain identity, 0 injected facts on stash, gate-off byte-identity).
- `tests/unit/eval/rules-oracle.test.ts` (discriminating oracle guards in both directions).
- `tests/unit/eval/RULES-SUITE-REGISTRATION-binding.test.ts` (registry/provenance pin for the new criteria).
- `tests/unit/eval/restart-designation-binding.test.ts` (NEW — 8 binding tests: record shape, byte-reproducible `record_sha256`, stash-identity, discriminating guards, not-hand-written reproduction).
- `scripts/capture-restart-designation-facts-conformance.ts` (NEW — deterministic WIP_SECTION-gated evidence producer; no wall-clock field in the record).
- `docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/` (NEW — `restart-designation-facts-state.json`, `trajectory.json`, `RESULT.md`, `audit.json`).

**Zero changes** to `src/`, `src/simulation/`, `src/contracts/`, `src/adapters/`, `specs/`, or `research/` (verified: `git diff -- src/ specs/` is empty — the command printed nothing). The core and its event union/contracts are untouched; `serializeRestartFacts: false` is byte-identical.

### commands_run

- cmd: `mise run typecheck`
    exit_code: 0
    result: "tsc core + node + browser all clean"
- cmd: `pnpm exec vitest run tests/unit/eval/{rules-oracle,rules-suite,RULES-SUITE-REGISTRATION-binding,restart-rules-serialization,RULES-SUITE-STATE-binding,rules-facts-depth-binding,restart-designation-binding}.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "150/150 PASS (rules-oracle 75, rules-suite 17, RULES-SUITE-REGISTRATION-binding 28, restart-rules-serialization 4, RULES-SUITE-STATE-binding 10, rules-facts-depth-binding 8, restart-designation-binding 8)"
- cmd: `pnpm exec vitest run tests/unit/eval/{CPU-DEFENSIVE-TACKLE-binding,LIFECYCLE-MIGRATION-ASSESSMENT-binding,GK-GOALLINE-BOUNDS-RESIDUAL-guard,GK-CORE-OWNED-ARC-FIX-guard}.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "34/34 PASS (CPU-DEFENSIVE-TACKLE-binding 16, LIFECYCLE-MIGRATION-ASSESSMENT-binding 5, GK-GOALLINE-BOUNDS-RESIDUAL-guard 7, GK-CORE-OWNED-ARC-FIX-guard 6)"
- cmd: `pnpm exec vitest run tests/unit/eval/{eval-registry,oracle-registry,GK-KEEPER-ORACLE-REGISTRATION-binding,GK-SUITE-ORGANIC-STATE-binding,GK-SUITE-VERDICTS-STATE-binding,GK-SUITE-CORE-OWNED-STATE-binding}.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "102/102 PASS (eval-registry 48, oracle-registry 19, GK-KEEPER-ORACLE-REGISTRATION-binding 5, GK-SUITE-ORGANIC-STATE-binding 8, GK-SUITE-VERDICTS-STATE-binding 11, GK-SUITE-CORE-OWNED-STATE-binding 11). Vitest reported 1 worker-timeout error (`[vitest-worker]: Timeout calling \"onTaskUpdate\"`) on the pre-existing ~95s GK-SUITE-CORE-OWNED-STATE-binding reproduction test — an infra reporting timeout, not a test assertion failure; all 11 tests in that file passed."
- cmd: `pnpm exec vitest run tests/candidate-scope.node.test.ts tests/evidence-sanity.node.test.ts tests/capture-hygiene.node.test.ts tests/unit/eval/foundation-lab-evidence-binding.node.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "16/16 PASS (candidate-scope 2, evidence-sanity 3, capture-hygiene 3, foundation-lab-evidence-binding 8)"
- cmd: `mise exec -- pnpm exec tsx scripts/capture-restart-designation-facts-conformance.ts` (ordinary-mode run 1)
    exit_code: 0
    result: "wrote test-results/gauntlet-capture/RESTART-DESIGNATION-FACTS-CONFORMANCE/ (record_sha256=271b1526592cc13e3792bee42f2544379e7dea16de9571b43113b32b57e7fc56; 6 runs: 3 browserParity live + 3 stashed controls)"
- cmd: `mise exec -- pnpm exec tsx scripts/capture-restart-designation-facts-conformance.ts` (ordinary-mode run 2 — byte-identity demonstration)
    exit_code: 0
    result: "record_sha256=271b1526… (identical); run1 and run2 outputs are byte-identical (`cmp` identical for both state.json and trajectory.json); docs/evidence/ hashes unchanged (state cee9cabcd…, trajectory 7aea2ad…)"
- cmd: `WIP_SECTION=__EVIDENCE__:RESTART-DESIGNATION-FACTS-CONFORMANCE mise exec -- pnpm exec tsx scripts/capture-restart-designation-facts-conformance.ts`
    exit_code: 0
    result: "wrote docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/ (durable-evidence; record_sha256=271b1526…; 6 runs)"
- cmd: `mise exec -- pnpm run gauntlet:audit -- --objective RESTART-DESIGNATION-FACTS-CONFORMANCE --class MULTI_TICK --tests-pass true --integration-test-pass true`
    exit_code: 0
    result: "status PASS (see audit.json)"

### tests_run

- name: `rules-oracle.test.ts`
    result: "PASS (75 tests — the 3 anti-huddle oracles + discriminating both-direction guards; kickoff-first-touch keeper exclusion)"
- name: `rules-suite.test.ts`
    result: "PASS (17 tests)"
- name: `RULES-SUITE-REGISTRATION-binding.test.ts`
    result: "PASS (28 tests — registry/provenance pin for the new criteria)"
- name: `restart-rules-serialization.test.ts`
    result: "PASS (4 tests — extended serialization guards: live/stashed chain identity, 0 injected facts on stash, gate-off byte-identity)"
- name: `RULES-SUITE-STATE-binding.test.ts`
    result: "PASS (10 tests)"
- name: `rules-facts-depth-binding.test.ts`
    result: "PASS (8 tests)"
- name: `restart-designation-binding.test.ts`
    result: "PASS (8 tests — record shape, byte-reproducible record_sha256 recompute, stash-identity, discriminating guards, not-hand-written reproduction)"
- name: `CPU-DEFENSIVE-TACKLE-binding` / `LIFECYCLE-MIGRATION-ASSESSMENT-binding` / `GK-GOALLINE-BOUNDS-RESIDUAL-guard` / `GK-CORE-OWNED-ARC-FIX-guard`
    result: "PASS (34; pre-existing, untouched guard pins reproduce)"
- name: `eval-registry` / `oracle-registry` / `GK-KEEPER-ORACLE-REGISTRATION-binding` / `GK-SUITE-ORGANIC-STATE-binding` / `GK-SUITE-VERDICTS-STATE-binding` / `GK-SUITE-CORE-OWNED-STATE-binding`
    result: "PASS (102; pre-existing, untouched neighbour matrix. One worker-timeout infra error on the ~95s GK-SUITE-CORE-OWNED-STATE reproduction test; all 11 tests in that file passed.)"
- name: `candidate-scope` / `evidence-sanity` / `capture-hygiene` / `foundation-lab-evidence-binding`
    result: "PASS (16; accepted foundation/provenance/hygiene gates reproduce)"

### integration_test_result

`MULTI_TICK` requires a relevant integration-test pass. The `restart-designation-binding.test.ts` "not hand-written" test physically reproduces the driven full-match browserParity run through the production runner (`runHeadlessMatch` with `serializeRestartFacts: true`, `lifecyclePhaseSync: "core-owned"`, `browserParityObservations: true`) and the accepted `evaluateSuite("rules", …)` entry point, confirming the evaluator yields the recorded anti-huddle verdicts (FREEZE-UNTIL-FIRST-TOUCH / NEAREST-ONLY / REARM all PASS). The accepted GK/stateHash guard pins and the foundation/provenance/hygiene gates reproduce green.

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing.

### required_evidence

- Deterministic audit: `docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/audit.json` (status `PASS`).
- Executed tests (MULTI_TICK): the 150-test rules gate, the 34-test GK/stateHash guard pins, the 102-test registry/provenance matrix, and the 16-test hygiene/provenance gate.
- `docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/trajectory.json` (the driven conformance streams + the gated designation-facts injection).

### artifacts

- `docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/restart-designation-facts-state.json`
- `docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/trajectory.json`
- `docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/audit.json`
- `docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/RESULT.md`
- `scripts/capture-restart-designation-facts-conformance.ts`
- `tests/unit/eval/restart-designation-binding.test.ts`

### spec_sections

- `specs/MATCH_RULES_SPEC.md` §12 (restart freeze / nearest-only), §12.1 (keeper excluded from taker selection), §9.2 / §9.5 (anti-huddle restart-window semantics, re-arm), §14 (BLOCKED_MISSING_REFERENCE), §15 (the adjudicating criteria).
- `eval/contracts/suites.ts` (suite-rules-v1), `common-criteria.ts` (the 25 MATCH-* criteria), `invariant-definitions.ts` (the anti-huddle invariants).
- `eval/oracles/rules-restart.ts` (protected anti-huddle oracles), `eval/runners/foundation-evaluator.ts` (criterion→oracle resolution), `eval/runners/headless-match.ts` (gated `serializeRestartFacts`).
- `src/adapters/input-browser/cpu-adapter.ts` (the shared `assignChaseRoles`/designation source of truth the runner mirrors — read-only, not modified).
- `docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/` (the prior-state record compared as the NOT_EVALUATED baseline).
- `gauntlet/evidence-contract.md` (MULTI_TICK), `gauntlet/roles/builder-structured.md` (role contract).

### acceptance_criteria_met

- **Runner-observability established:** the designation facts come from the same shared production function (`assignChaseRoles`) + the committed `coreMatchPhases` + ball reference the adapter already observes; the runner propagates the ACTUAL designation post-loop, gated, hash-neutral — no football state owned in the runner.
- The 3 anti-huddle criteria now evaluate PASS over the driven browserParity streams (see the per-criterion table below); they were NOT_EVALUATED on the prior committed-stream record because those streams did not carry the designation facts.
- Extended serialization guards: the gated live runs and the stashed controls share a byte-identical state-hash chain (live/stashed chain identity), the stashed controls carry 0 injected facts, and gate-off is byte-identical to the accepted non-gated stream.
- Durable record byte-reproducibility: `restart-designation-facts-state.json` has a pinned `record_sha256` (271b1526…) with NO wall-clock field in the hashed content; two consecutive ordinary-mode runs are byte-identical (`cmp` identical); an ordinary-mode run leaves `docs/` byte-identical.
- Zero gameplay/source change: `git diff src/ specs/` EMPTY.
- Neighbour batteries green (rules 150, GK/stateHash pins 34, registry/provenance 102, hygiene/provenance 16); `mise run typecheck` exit 0; `gauntlet:audit` status PASS.
- Missing references stay `BLOCKED_MISSING_REFERENCE`; no invented envelope or tolerance.

---

## Per-criterion outcomes (the 3 anti-huddle criteria + anything touched)

Loaded from `docs/evidence/RESTART-DESIGNATION-FACTS-CONFORMANCE/restart-designation-facts-state.json` (record_sha256 `271b1526…`). **No suite-level PASS claim** — the rules suite is a per-test verdict collection; it does not reduce to a suite PASS.

### The 3 anti-huddle restart-behavior criteria

| Criterion (§15) | Outcome | Source runs | Why (one line) |
|---|---|---|---|
| MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH | **PASS** | designation-throwin-live, designation-arc-live, designation-fullmatch-live | in every restart window the whole team except the single designated taker is frozen at its window anchor while the restart ball is untouched (§12 rule 1). |
| MATCH-RESTART-NEAREST-ONLY | **PASS** | designation-throwin-live, designation-arc-live, designation-fullmatch-live | after the first touch only one designated chaser per team converges on the ball; no team clump (§12 rule 2). |
| MATCH-RESTART-REARM | **PASS** | designation-arc-live (post-goal re-arm), designation-fullmatch-live (halftime re-arm) | a post-goal / halftime reset re-arms the restart window keyed to the carried-through touch reference (§9.5). NOT_EVALUATED on designation-throwin-live (no post-goal / halftime reset observed there). |

### Other criteria observed on these runs (composition)

The 3 browserParity live runs evaluate the full 25-criteria suite. Aggregated verdict summary:

**20 PASS / 2 BLOCKED_MISSING_REFERENCE / 3 NOT_EVALUATED / 0 FAIL.**

- **PASS (20):** MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH, MATCH-RESTART-NEAREST-ONLY, MATCH-RESTART-REARM, MATCH-KICKOFF-FREEZE, MATCH-KICKOFF-FIRST-TOUCH, MATCH-OUT-OF-PLAY-DETECT, MATCH-OUT-OF-PLAY-NO-LAST-TOUCH, MATCH-SCORING-GOAL-DEVENT, MATCH-SCORING-GOAL-PHASE, MATCH-THROW-IN-AWARD, MATCH-THROW-IN-PLACEMENT, MATCH-THROW-IN-SERVE, MATCH-THROW-IN-TIMER-FREEZE, MATCH-GOAL-KICK-AWARD, MATCH-GOAL-KICK-PLACEMENT, MATCH-GOAL-KICK-TIMER-FREEZE, MATCH-TIMER-DECREMENT, MATCH-TIMER-HALFTIME, MATCH-TIMER-FULLTIME, MATCH-TIMER-FREEZE.
- **BLOCKED_MISSING_REFERENCE (2):** MATCH-CORNER-KICK-CROSS (§14 `corner_cross_trajectory_ref`), MATCH-GOAL-KICK-DISTRIBUTION (§14 `goal_kick_distribution_ref`).
- **NOT_EVALUATED (3):** MATCH-CORNER-KICK-AWARD, MATCH-CORNER-KICK-PLACEMENT, MATCH-CORNER-KICK-TIMER-FREEZE — the corner cluster is OUT of scope and owned by CORNER-DRIVEN-CONFORMANCE.

## Provenance / reproduction

The record is regenerated by:

```
WIP_SECTION=__EVIDENCE__:RESTART-DESIGNATION-FACTS-CONFORMANCE \
  mise exec -- pnpm exec tsx scripts/capture-restart-designation-facts-conformance.ts
```

Each driven conformance stream is reproduced through the same exported production runner (`runHeadlessMatch` with `lifecyclePhaseSync: "core-owned"`, `browserParityObservations: true`, `serializeRestartFacts` true on the live runs and false on the stashed controls), and the `rules` suite is physically executed over the committed telemetry observations via `evaluateSuite("rules", …)`. No outcome is hand-written. The record carries no wall-clock field, so consecutive ordinary-mode runs are byte-identical and leave `docs/` byte-identical.

## Reviewer non-binding notes folded in

- **(a) `checkKickoffFirstTouch` keeper exclusion.** The doc comment said the keeper is excluded from taker selection; the implementation did not. Verified against the spec: §12.1 (line 232/239) states "Only the single designated kick taker — the nearest body in the match to the untouched ball, resolved with ties by ascending playerId and with the keeper excluded — may close distance", and "The designated small-sided keeper is excluded from restart-taker selection and never leaves its goal arc to take a restart." So the correct direction was to make the IMPLEMENTATION exclude the keeper (not to weaken the comment). The oracle now reads the runner-injected `gk-role` designation (`keeperPlayerId`) and excludes those bodies from taker selection (no-op when no `gk-role` events are present). The doc comment now cites §12.1 accurately.
- **(b) suite-level PASS wording.** The record/RESULT.md templates now use the accurate "No suite-level PASS claim" phrasing (the rules suite is a per-test verdict collection; it does not reduce to a suite PASS), replacing the prior "the per-test overall for the rules suite stays NOT_EVALUATED / BLOCKED_MISSING_REFERENCE" wording that conflated a per-test overall with a suite PASS.

## known_gaps

- **The corner cluster is NOT_EVALUATED and OUT of scope.** The driven fixtures here do not observe a corner restart; the corner cluster is owned by CORNER-DRIVEN-CONFORMANCE. Not forced.
- **`MATCH-RESTART-REARM` is NOT_EVALUATED on designation-throwin-live** because that fixture has no post-goal / halftime reset; it is PASS on the arc (post-goal re-arm) and full-match (halftime re-arm) runs.
- **Keeper exclusion is conditional on the `gk-role` observation annotation.** On streams that do not carry `gk-role` events (no gkBehavior wiring), `checkKickoffFirstTouch` cannot identify the keeper and the exclusion is a no-op. This is disclosed rather than assumed.
- **No gameplay inference about the CORE's correctness is drawn from the anti-huddle PASS verdicts:** a PASS is a statement that the driven conformance stream satisfies that §15 semantic under the ACTUAL adapter designation, not a PES fidelity or full-regulation claim.

## claims_not_made

- No suite-level PASS claim: the rules suite is a per-test verdict collection and does not reduce to a suite PASS; the corner cluster is OUT of scope here.
- No PROMOTION claim.
- No PES 2017 fidelity / measured PES envelope claim; MATCH-GOAL-KICK-DISTRIBUTION and MATCH-CORNER-KICK-CROSS stay `BLOCKED_MISSING_REFERENCE` (§14).
- No FOUNDATION_LAB_PASS claim.
- No invented reference envelope or tolerance.
- The corner cluster (MATCH-CORNER-KICK-*) is NOT evaluated or claimed here; it is owned by CORNER-DRIVEN-CONFORMANCE.
- No forced/synthesized event: the designation facts are the ACTUAL adapter designation (from the shared `assignChaseRoles` + committed `coreMatchPhases` + ball reference), not a re-derivation that owns football state; `serializeRestartFacts` is default FALSE and the stashed controls prove it cannot affect inputs/steps/hashes.
- No gameplay / source / contract / adapter / spec change: `src/` and `specs/` are EMPTY; only eval oracles/invariant bindings (additive), evidence + tests are added.
