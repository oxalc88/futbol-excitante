# CORNER-DRIVEN-CONFORMANCE — builder result

## Builder report

- **objective_id:** CORNER-DRIVEN-CONFORMANCE
- **builder_agent:** builder-structured
- **builder_model:** deepseek-v4-flash
- **evidence_class:** DYNAMIC_VISUAL
- **hypothesis:** A genuinely DRIVEN corner-kick execution stream can be produced by the accepted restart machinery — a defending-team last touch over its own goal line (the condition that has been "rare" in this engine) — without any core change, so the corner restart type conforms through the registered `rules` suite. The driven fixture places the ball just inside the +x goal-line span and a team-b defender chasing back toward its own goal, so the AI's own play creates the defending-team last touch and the core awards + executes a corner. MATCH-CORNER-KICK-AWARD / -PLACEMENT / -TIMER-FREEZE become honestly measurable (PASS); MATCH-CORNER-KICK-CROSS stays BLOCKED_MISSING_REFERENCE. Zero core change; nothing forced or synthesized.

### The driven corner (how it is genuinely achieved)

`eval/scenarios/5v5-corner-driven.v1.json` (a driven fixture, not a core change) is the `5v5-restart-arc` layout with two changes: the ball is placed at `(51.5, 12, 0.11)` (stationary, just inside the +x goal-line span, outside the posts) and the team-b defender `player-9` is placed at `(47, 12)` — between the ball and the field centre, so its chase-heading points back toward its own goal. Over the first ~70 ticks of CPU-vs-CPU play, the adapter drives `player-9` to the ball; its touch sends the ball over the +x goal line outside the posts. Because the **defending** team (team-b, which defends the +x goal line) is the last touch, the core awards a corner to team-a (§8.1) and opens the `corner-kick` phase, then executes the corner at countdown zero (ball placed at the nearest corner flag `(52.5, 34)` and crossed toward the penalty area). The produced facts:

- Boundary (live run): `ball-out-of-play` at tick 71, `goalIndex 0`, `ballPosition (52.5, 12.11, 0.11)`, `lastTouchRef "pass-48-2"` → resolves to **team-b** (the defending team).
- Execution (live run): `corner-kick-executed` at tick 131, `teamId "team-a"` (attacking), `cornerPosition (52.5, 34)`, `targetPosition (44.5, 0)`, `crossDirection (-0.229, -0.973)`.
- The fixture is robust across seeds (42/7/123/999 all produce the corner) and across defender x ∈ {46,47,48}.

This is a **real** corner produced by the core's own award + execution machinery; it is not synthesized, teleported, or state-injected. The fixture is an adapter/driver initial state (the driven-throw-in / goal-kick precedent).

### files_changed

- `eval/scenarios/5v5-corner-driven.v1.json` (NEW — driven corner fixture; derived from the accepted arc layout).
- `eval/oracles/rules-restart.ts` (ADDITIVE: `checkCornerKickPlacement`; `CORNER_FLAG_Y` constant).
- `eval/oracles/rules-phase.ts` (ADDITIVE: `checkCornerKickTimerFreeze`).
- `eval/oracles/wire.ts` (registered `rules-corner-kick-placement-oracle-v1` + `rules-corner-kick-timer-freeze-oracle-v1`; additive).
- `eval/contracts/invariant-definitions.ts` (added `INV_RULES_CORNER_KICK_PLACEMENT` + `INV_RULES_CORNER_KICK_TIMER_FREEZE`; additive).
- `eval/contracts/bindings.ts` (RULES-CORNERKICK-001 now binds PLACEMENT + TIMER-FREEZE to their oracles; additive).
- `eval/runners/foundation-evaluator.ts` (mapped `MATCH-CORNER-KICK-PLACEMENT` + `MATCH-CORNER-KICK-TIMER-FREEZE`; additive).
- `scripts/capture-corner-driven-conformance.ts` (NEW — deterministic record + trajectory producer; WIP_SECTION-gated durable write; no wall-clock field in the record).
- `tests/unit/eval/rules-oracle.test.ts` (7 new corner unit guards: placement PASS/FAIL/FAIL/NOT_EVALUATED + timer-freeze PASS/FAIL/NOT_EVALUATED).
- `tests/unit/eval/RULES-SUITE-REGISTRATION-binding.test.ts` (added the 2 corner criteria to the oracle-chain map).
- `tests/unit/eval/corner-driven-conformance-binding.test.ts` (NEW — 7 binding tests: shape, byte-reproducible record_sha256, corner verdicts, stash-identity, discriminating goal-kick neighbour, not-hand-written reproduction, no-claim negative control).
- `tests/browser/corner-driven-dynamic-evidence.browser.test.ts` (NEW — DYNAMIC_VISUAL corner frames via the established browser pattern; real-app capture, sequence.json + event-centered PNGs).
- `docs/evidence/CORNER-DRIVEN-CONFORMANCE/corner-driven-state.json` (NEW — durable verdict table, `record_sha256` pinned).
- `docs/evidence/CORNER-DRIVEN-CONFORMANCE/trajectory.json` (NEW — MULTI_TICK trajectory with live + stashed controls + goal-kick neighbour).
- `docs/evidence/CORNER-DRIVEN-CONFORMANCE/RESULT.md` (this report).
- `docs/screenshots/CORNER-DRIVEN-CONFORMANCE/` (NEW — 4 event-centered PNGs + sequence.json).

**Zero changes** to `src/`, `src/simulation/`, `src/contracts/`, `src/adapters/`, `specs/`, or any accepted evidence directory (verified: `git diff --stat -- src/` is EMPTY; the accepted `docs/evidence/RULES-SUITE-STATE/`, `RESTART-RULES-CONFORMANCE/`, `RULES-FACTS-DEPTH-CONFORMANCE/` records are byte-untouched). The new scenario is a driven fixture, not a source/contract change.

### commands_run

- cmd: `mise run typecheck`
    exit_code: 0
    result: "tsc core + node + browser all clean"
- cmd: `mise exec -- pnpm exec tsx scripts/capture-corner-driven-conformance.ts` (ordinary-mode run 1)
    exit_code: 0
    result: "wrote test-results/gauntlet-capture/CORNER-DRIVEN-CONFORMANCE/corner-driven-state.json + trajectory.json (record_sha256=21e3aa08be951f1416bb5258aef666218c1533716cfea3eea40a71a782b279b1; 3 runs: corner live + stashed + goal-kick neighbour; live/stashed hash-of-hashes identical)"
- cmd: `WIP_SECTION=__EVIDENCE__:CORNER-DRIVEN-CONFORMANCE mise exec -- pnpm exec tsx scripts/capture-corner-driven-conformance.ts`
    exit_code: 0
    result: "wrote docs/evidence/CORNER-DRIVEN-CONFORMANCE/corner-driven-state.json + trajectory.json (durable-evidence; record_sha256=21e3aa08…; 3 runs)"
- cmd: `mise exec -- pnpm exec tsx scripts/capture-corner-driven-conformance.ts` (ordinary-mode run 2 — byte-reproducibility)
    exit_code: 0
    result: "record_sha256=21e3aa08… (identical); docs/evidence/CORNER-DRIVEN-CONFORMANCE/corner-driven-state.json sha256 unchanged (b9450bd6… before === b9450bd6… after); DOCS_BYTE_IDENTICAL"
- cmd: `WIP_SECTION=__EVIDENCE__:CORNER-DRIVEN-CONFORMANCE pnpm exec vitest run tests/browser/corner-driven-dynamic-evidence.browser.test.ts --project browser`
    exit_code: 0
    result: "2/2 PASS (4 event-centered corner frames + sequence.json written to docs/screenshots/CORNER-DRIVEN-CONFORMANCE/; frames non-blank with luminance + colour variance)"
- cmd: `pnpm exec vitest run tests/unit/eval/{rules-oracle,rules-suite,RULES-SUITE-REGISTRATION-binding,restart-rules-serialization,RULES-SUITE-STATE-binding,rules-facts-depth-binding,corner-driven-conformance-binding}.test.ts --project node --testTimeout 180000`
    exit_code: 0
    result: "137/137 PASS (rules-oracle 66, rules-suite 17, RULES-SUITE-REGISTRATION-binding 25, restart-rules-serialization 4, RULES-SUITE-STATE-binding 10, rules-facts-depth-binding 8, corner-driven-conformance-binding 7)"
- cmd: `pnpm exec vitest run tests/unit/eval/{goalkeepers-suite,eval-registry,duels-suite,oracle-registry,mutant-core,gk-oracle,GK-KEEPER-ORACLE-REGISTRATION-binding,GK-SUITE-ORGANIC-STATE-binding,GK-SUITE-VERDICTS-STATE-binding,match-rules-spec-binding}.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "231/231 PASS (pre-existing neighbour matrix)"
- cmd: `pnpm exec vitest run tests/unit/eval/{foundation-evaluator,playable-1v1-re-evaluation,foundation-lab-evidence-binding.node}.test.ts tests/candidate-scope.node.test.ts tests/evidence-sanity.node.test.ts tests/capture-hygiene.node.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "81/81 PASS (foundation pins, provenance assertions and capture hygiene reproduce)"
- cmd: `mise exec -- pnpm run gauntlet:audit -- --objective CORNER-DRIVEN-CONFORMANCE --class DYNAMIC_VISUAL --tests-pass true --integration-test-pass true`
    exit_code: 0
    result: "status PASS (see docs/evidence/CORNER-DRIVEN-CONFORMANCE/audit.json; evidence_class DYNAMIC_VISUAL; semantic visual sequence check PASS)"

### tests_run

- name: `rules-oracle.test.ts`
    result: "PASS (66 tests — 59 pre-existing + 7 new corner placement/timer-freeze guards, both directions)"
- name: `rules-suite.test.ts`
    result: "PASS (17 tests, pre-existing untouched)"
- name: `RULES-SUITE-REGISTRATION-binding.test.ts`
    result: "PASS (25 tests; 2 new corner criteria added to the criterion→invariant→oracle chain)"
- name: `restart-rules-serialization.test.ts`
    result: "PASS (4 tests, pre-existing untouched)"
- name: `RULES-SUITE-STATE-binding.test.ts`
    result: "PASS (10 tests, pre-existing — the accepted record is byte-untouched)"
- name: `rules-facts-depth-binding.test.ts`
    result: "PASS (8 tests, pre-existing — the corner cluster was OUT of scope there)"
- name: `corner-driven-conformance-binding.test.ts`
    result: "PASS (7 tests — record shape, byte-reproducible record_sha256, corner upgrade PASS, stash-identity, discriminating goal-kick neighbour, not-hand-written reproduction, no-claim negative control)"
- name: `corner-driven-dynamic-evidence.browser.test.ts`
    result: "PASS (2 tests — 4 event-centered corner frames + non-blank variance check)"
- name: neighbour matrix (goalkeepers-suite / eval-registry / duels-suite / oracle-registry / mutant-core / gk-oracle / GK-KEEPER-ORACLE-REGISTRATION-binding / GK-SUITE-ORGANIC-STATE-binding / GK-SUITE-VERDICTS-STATE-binding / match-rules-spec-binding)
    result: "PASS (231; pre-existing, untouched)"
- name: foundation / provenance / hygiene gate
    result: "PASS (81; accepted foundation pins, provenance assertions and capture hygiene reproduce)"

### integration_test_result

DYNAMIC_VISUAL requires a relevant integration-test pass. The rules suite is exercised over the driven extended stream (`evaluateSuite("rules", observations)` returns real corner award / placement / timer-freeze verdicts), the accepted `rules` suite/binding integration reproduces, and the stash-identity (live vs stashed state-hash chains identical for the corner fixture) is demonstrated in the trajectory and the binding test. The corner frames are captured through the real browser composition root (real-app, Playwright/Chromium), so the browser-visible + temporal corner claim is evidenced at DYNAMIC_VISUAL.

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing.

### required_evidence

- Durable trajectory: `docs/evidence/CORNER-DRIVEN-CONFORMANCE/trajectory.json` (3 runs, live + stashed + goal-kick neighbour; the MULTI_TICK prerequisite of DYNAMIC_VISUAL).
- Durable verdict table: `docs/evidence/CORNER-DRIVEN-CONFORMANCE/corner-driven-state.json` (`record_sha256` 21e3aa08…; byte-reproducible; no wall-clock field in hashed content).
- Deterministic audit: `docs/evidence/CORNER-DRIVEN-CONFORMANCE/audit.json` (status `PASS`, evidence_class DYNAMIC_VISUAL).
- DYNAMIC_VISUAL semantic frames: `docs/screenshots/CORNER-DRIVEN-CONFORMANCE/{corner-before,corner-award,corner-set-piece,corner-execution}.png` + `sequence.json` (each frame carries a `path`).
- Executed tests (DYNAMIC_VISUAL): the 137-test rules gate, the 231-test neighbour matrix, the 81-test foundation/provenance/hygiene gate, and the 2-test browser corner capture.

### artifacts

- `docs/evidence/CORNER-DRIVEN-CONFORMANCE/corner-driven-state.json` / `trajectory.json` / `RESULT.md` / `audit.json`
- `docs/screenshots/CORNER-DRIVEN-CONFORMANCE/*.png` + `sequence.json`
- `eval/scenarios/5v5-corner-driven.v1.json`
- `eval/oracles/rules-restart.ts`, `eval/oracles/rules-phase.ts`, `eval/oracles/wire.ts`, `eval/contracts/invariant-definitions.ts`, `eval/contracts/bindings.ts`, `eval/runners/foundation-evaluator.ts` (all additive)
- `scripts/capture-corner-driven-conformance.ts`
- `tests/unit/eval/corner-driven-conformance-binding.test.ts`, `tests/unit/eval/rules-oracle.test.ts`, `tests/browser/corner-driven-dynamic-evidence.browser.test.ts`

### spec_sections

- `specs/MATCH_RULES_SPEC.md` §7 (goal-line award discrimination, §7.2 — the corner-awarded-when-goal-kick-required direction), §8 (corner kick: award §8.1, placement §8.2, execution §8.3), §11 (timer freeze), §13 (corner provisional config), §14 (BLOCKED_MISSING_REFERENCE `corner_cross_trajectory_ref`), §15 (the adjudicating criteria made measurable here), §17 (declaration of limitations).
- `eval/contracts/common-criteria.ts` (the 25 MATCH-* criteria), `suites.ts` (suite-rules-v1), `invariant-definitions.ts`, `bindings.ts` (corner binding).
- `eval/oracles/rules-restart.ts` / `rules-phase.ts` (protected rules oracles), `eval/runners/foundation-evaluator.ts` (criterion→oracle resolution), `eval/oracles/wire.ts` (registration).
- `docs/evidence/RULES-SUITE-STATE/rules-suite-verdicts-state.json` (the prior corner NOT_EVALUATED baseline).
- `gauntlet/evidence-contract.md` (MULTI_TICK / DYNAMIC_VISUAL), `gauntlet/roles/builder-structured.md` (role contract).

### acceptance_criteria_met

- **A genuine driven corner was produced.** The core awarded + executed a corner kick because a defending-team (team-b) player was the last touch when the ball crossed the +x goal line outside the posts. The fixture is robust across seeds and defender positions, and is a real award (verified in the observation stream + the evaluator), not synthesized/forced.
- **MATCH-CORNER-KICK-AWARD — PASS** (was NOT_EVALUATED): the corner was awarded to the attacking team because the last touch of the +x goal-line out-of-play was the defending team (§8.1).
- **MATCH-CORNER-KICK-PLACEMENT — PASS** (was NOT_EVALUATED): the executed corner kick's `cornerPosition` equals the nearest corner flag `(goalX, ±34)` chosen by the sign of the ball's exit y (§8.2). New protected oracle added additively.
- **MATCH-CORNER-KICK-TIMER-FREEZE — PASS** (was NOT_EVALUATED): the ball-in-play timer is frozen during every corner-kick phase tick (§11). New protected oracle added additively.
- **MATCH-CORNER-KICK-CROSS — BLOCKED_MISSING_REFERENCE** (unchanged): §14 `corner_cross_trajectory_ref` does not exist and is never invented.
- **Discriminator proven:** the goal-kick neighbour control (`5v5-restart-arc`) returns the corner criteria NOT_EVALUATED (it produces a goal kick, never a corner) while the corner run returns them PASS; the award oracle's mutant direction (last touch NOT the defending team → a goal kick was required) is unit-tested in both directions. The corner PASS is not a blanket PASS.
- **Stash-identity:** live + stashed state-hash chains are identical (`0306d528ed…`), and the stashed run carries 0 injected facts — the serialization injection is hash-neutral.
- **Record byte-reproducibility:** `corner-driven-state.json` has a pinned `record_sha256` (21e3aa08…) with no wall-clock field in the hashed content; an ordinary-mode re-run leaves `docs/` byte-identical.
- **Zero gameplay/source change:** `git diff --stat -- src/` EMPTY; the fixture + oracles are additive.
- **Neighbour batteries green** (rules 137, neighbour 231, foundation/provenance/hygiene 81); `mise run typecheck` exit 0; `gauntlet:audit` status PASS.

---

## Current corner-driven verdict table (executed evaluator, not forced)

Loaded from `docs/evidence/CORNER-DRIVEN-CONFORMANCE/corner-driven-state.json` (record_sha256 `21e3aa08…`). **No suite-level PASS claim** — the per-test overall for the rules suite stays NOT_EVALUATED / BLOCKED_MISSING_REFERENCE.

### Per-criterion outcomes (corner cluster + carried criteria)

| Criterion (§15) | Outcome | Source stream | Why (one line) |
|---|---|---|---|
| MATCH-CORNER-KICK-AWARD | **PASS** | rules-corner-live | the corner was awarded to team-a because the last touch of the +x goal-line out-of-play was team-b (the defending team) (§8.1); NOT_EVALUATED on the goal-kick neighbour (no corner execution) |
| MATCH-CORNER-KICK-PLACEMENT | **PASS** | rules-corner-live | the executed corner kick's cornerPosition equals the nearest corner flag (§8.2); NOT_EVALUATED on the goal-kick neighbour |
| MATCH-CORNER-KICK-CROSS | **BLOCKED_MISSING_REFERENCE** | all runs | §14 `corner_cross_trajectory_ref` blocked — never invented |
| MATCH-CORNER-KICK-TIMER-FREEZE | **PASS** | rules-corner-live | the ball-in-play timer is frozen during every corner-kick phase tick (§11); NOT_EVALUATED on the goal-kick neighbour |
| MATCH-KICKOFF-FREEZE | **PASS** | rules-corner-live | only the taker + at-ball body left home while the opening ball was untouched |
| MATCH-KICKOFF-FIRST-TOUCH | **PASS** | rules-corner-live | the opening untouched window closed on the first touch by the designated taker |
| MATCH-OUT-OF-PLAY-DETECT | **PASS** | rules-corner-live | the boundary event carries a well-formed payload; goal / goal-line out-of-play mutually exclusive |
| MATCH-TIMER-FREEZE | **PASS** | rules-corner-live | the ball-in-play timer is frozen across the non-playing phase ticks |
| MATCH-TIMER-DECREMENT | **PASS** | rules-corner-live | the ball-in-play timer decremented only during playing |

(The remaining rules criteria — throw-in / goal-kick / restart-behavior / timer-halftime / timer-fulltime / scoring on the corner stream — are NOT_EVALUATED or BLOCKED as before: the corner fixture genuinely carries no throw-in, no goal-kick beyond the neighbour control's own, and the timer never reaches zero.)

### Verdict delta vs RULES-FACTS-DEPTH-CONFORMANCE (record_sha256 ebf90831…)

**Upgraded NOT_EVALUATED → PASS (3):** MATCH-CORNER-KICK-AWARD, MATCH-CORNER-KICK-PLACEMENT, MATCH-CORNER-KICK-TIMER-FREEZE. Each became measurable through the driven corner stream + a newly-registered protected rules oracle. No verdict was hand-written.

**Unchanged:** MATCH-CORNER-KICK-CROSS stays BLOCKED_MISSING_REFERENCE; all other criteria keep their prior honest outcome (NOT_EVALUATED / BLOCKED) on the corner fixture.

## Provenance / reproduction

The record is regenerated by:

```
WIP_SECTION=__EVIDENCE__:CORNER-DRIVEN-CONFORMANCE \
  mise exec -- pnpm exec tsx scripts/capture-corner-driven-conformance.ts
```

The corner stream is reproduced through the same exported production runner (`runHeadlessMatch` with `lifecyclePhaseSync: "core-owned"`, `serializeRestartFacts` true on the live runs), and the `rules` suite is physically executed over the committed telemetry observations via `evaluateSuite("rules", …)`. No outcome is hand-written. The record carries no wall-clock field, so consecutive ordinary-mode runs are byte-identical and leave `docs/` byte-identical. The live and stashed state-hash chains are identical, proving the injection cannot affect inputs / steps / committed hashes. The corner dynamic frames are captured by a browser test that runs the same fixture through the real composition root; the frames are event-centered on the corner award + execution.

## known_gaps

- **MATCH-CORNER-KICK-CROSS stays BLOCKED_MISSING_REFERENCE.** The lofted-cross trajectory reference (`corner_cross_trajectory_ref`, §14) does not exist; it is never invented. No PASS or measured envelope is claimed for the cross.
- **The corner is a temporal + browser-visible claim, so the strictest class is DYNAMIC_VISUAL.** The evidence class is DYNAMIC_VISUAL (the audit runs with `--class DYNAMIC_VISUAL` and the "semantic visual sequence" check PASSes). The cross is not visible as a dramatic arc in the rendered frames (the ball is small at the render scale); the frames show the corner award (ball over the goal line) and the set-piece (taker + box).
- **The neighbour goal-kick run is context, not a claim.** The goal-kick criteria PASS on the neighbour control; it is included only to prove the corner PASS is discriminating, not to claim the corner fixture produces a goal kick.
- **No gameplay inference about the CORE's correctness beyond the rule semantics.** A PASS on a §15 semantic is a statement that the driven corner stream satisfies that rule, not a PES fidelity or full-regulation claim.

## claims_not_made

- No suite-level PASS claim: the per-test overall for the rules suite stays NOT_EVALUATED / BLOCKED_MISSING_REFERENCE.
- No PROMOTION claim.
- No PES 2017 fidelity / measured PES envelope claim; MATCH-CORNER-KICK-CROSS stays BLOCKED_MISSING_REFERENCE (§14).
- No FOUNDATION_LAB_PASS claim.
- No invented reference envelope or tolerance; the 7 BLOCKED_MISSING_REFERENCE values stay blocked.
- No claim that the corner was organic (it is a DRIVEN fixture — deliberately engineered to produce the corner; that is disclosed, not masked).
- No gameplay / source / contract / adapter / spec change: `git diff --stat -- src/` is EMPTY; `specs/` EMPTY; only the driven fixture, additive eval oracles/invariant bindings, evidence + tests are added.
