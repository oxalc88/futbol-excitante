# HUMAN-BALL-SERVER-DECISION — builder result

## Builder report

- **objective_id:** HUMAN-BALL-SERVER-DECISION
- **builder_agent:** builder-structured
- **builder_model:** deepseek-v4-flash
- **evidence_class:** BOOKKEEPING
- **hypothesis:** Record the DECISION on the deferred literal pass-button ball-server (the human presses pass at the restart window and the human's pass executes the serve). Analyze the core machinery change the literal server needs (the countdown-zero auto-serve override; a pass-reception serving path), the determinism/pin implications, the conformance implications, and the alternatives — then record a clear verdict. Zero gameplay/source change; the decision is RECORDED, not executed.

## Decision (verdict)

**DEFER.** The literal pass-button ball-server is deferred, with a concrete future objective outline (`HUMAN-BALL-SERVER-LITERAL`) recorded so it is not an open thread. The verdict is a clear recorded decision, not a hedge. Reasons are captured in the record and summarized below.

### files_changed

- `scripts/capture-human-ball-server-decision.ts` (NEW — byte-reproducible BOOKKEEPING producer).
- `tests/unit/eval/human-ball-server-decision-binding.test.ts` (NEW — binding test pinning the record structure + verdict; discriminating).
- `docs/evidence/HUMAN-BALL-SERVER-DECISION/human-ball-server-decision.json` (NEW — decision record, `record_sha256` `5b6e391a…`).
- `docs/evidence/HUMAN-BALL-SERVER-DECISION/RESULT.md` (this builder report).
- `docs/evidence/HUMAN-BALL-SERVER-DECISION/audit.json` (written by the audit command).

**No changes** to `src/`, `src/adapters/`, `eval/`, `gauntlet/`, or `specs/`. The producer asserts source-level facts (the countdown-zero branches, `passRadius` = 1.2 m, the pass-requires-contact constraint) by reading the existing sources; it does not modify them.

### commands_run (actual exit codes)

| Command | Exit |
|---|---|
| `mise exec -- pnpm exec tsx scripts/capture-human-ball-server-decision.ts` (ordinary mode ×2) | 0 — `record_sha256` `5b6e391a…` identical both runs; leaves `docs/` byte-identical; writes `test-results/gauntlet-capture/` |
| `WIP_SECTION=__EVIDENCE__:HUMAN-BALL-SERVER-DECISION mise exec -- pnpm exec tsx scripts/capture-human-ball-server-decision.ts` | 0 (wrote `docs/evidence/HUMAN-BALL-SERVER-DECISION/human-ball-server-decision.json`; `record_sha256` `5b6e391a…`) |
| `mise exec -- pnpm run typecheck` | 0 (core + node + browser clean) |
| Rules gate + new binding (11 files) | 0 (180/180 PASS) |
| Restart battery + human-restart neighbors (13 files) | 0 (188/188 PASS; one non-fatal vitest worker-RPC infra timeout `Timeout calling "onTaskUpdate"` — the same known artifact documented in the accepted GK-SUITE-CORE-OWNED-STATE / EVAL-HYGIENE-CONSOLIDATION records, not an assertion failure) |
| Architecture boundary suite (6 files) | 0 (27/27 PASS) |
| `mise exec -- pnpm run gauntlet:audit -- --objective HUMAN-BALL-SERVER-DECISION --class BOOKKEEPING --tests-pass true --integration-test-pass true` | 0 (status `PASS`; see `audit.json`) |

### tests_run

- **Typecheck** — exit 0 (core + node + browser clean).
- **Rules gate + new binding (11 files)** — rules-oracle (75), rules-suite (17), RULES-SUITE-REGISTRATION-binding (28), restart-rules-serialization (4), RULES-SUITE-STATE-binding (10), rules-facts-depth-binding (8), corner-driven-conformance-binding (7), restart-designation-binding (8), rules-suite-state-rerun-binding (9), SUITE-DETERMINISTIC-TWO-RUN-binding (7), human-ball-server-decision-binding (7): **180/180 PASS**.
- **Restart battery + human-restart neighbors (13 files)** — human-restart-rules-conformance-binding, restart-anti-huddle, human-restart-control (integration), throw-in/goal-kick/corner-kick/match-set-piece/match-timer (unit scenario + integration): **188/188 PASS**.
- **Architecture boundary suite (6 files)** — core-boundary, core-ts-isolation, contracts-no-forbidden-imports, build-vite-resolve, toolchain-version-check, toolchain-smoke-test: **27/27 PASS**.

### integration_test_result

For `BOOKKEEPING`, the audit marks the integration-test check `NOT_APPLICABLE`. The restart battery + human-restart integration suites re-ran green (188/188), confirming the decision record introduces no regression into the restart machinery the analysis describes.

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing.

### required_evidence

- Deterministic audit: `docs/evidence/HUMAN-BALL-SERVER-DECISION/audit.json` (status `PASS`).
- Durable record: `docs/evidence/HUMAN-BALL-SERVER-DECISION/human-ball-server-decision.json` (`record_sha256` `5b6e391a…`; byte-reproducible; no wall-clock field in hashed content).
- Executed tests (BOOKKEEPING): the rules gate, the restart battery + human-restart neighbors, the architecture boundary suite, and typecheck 0.

### artifacts

- `docs/evidence/HUMAN-BALL-SERVER-DECISION/human-ball-server-decision.json`
- `docs/evidence/HUMAN-BALL-SERVER-DECISION/audit.json`
- `docs/evidence/HUMAN-BALL-SERVER-DECISION/RESULT.md`
- `scripts/capture-human-ball-server-decision.ts`
- `tests/unit/eval/human-ball-server-decision-binding.test.ts`

### spec_sections

- `specs/MATCH_RULES_SPEC.md` §15 (the restart criteria that would need re-evaluation on a human-served stream).
- `src/simulation/loop/simulation.ts` (the countdown-zero auto-serve branches: `applyThrowIn` / `applyGoalKick` / `applyCornerKick`).
- `src/simulation/contacts/contact-system.ts` (the pass action requires player-ball proximity within `passRadius`).
- `src/simulation/config/foundation.ts` (`passRadius` = 1.2 m).
- `gauntlet/evidence-contract.md` (BOOKKEEPING), `gauntlet/roles/builder-structured.md` (role contract).

### acceptance_criteria_met

- **Analysis of the core machinery change:** recorded — the countdown-zero auto-serve branches (throw-in / goal-kick / corner-kick), the pass-requires-contact constraint (`passRadius` 1.2 m; the ball out of play during the window), and the pass-gated serving path shape (taker-human-control check, bounded wait, human-pass direction, CPU fallback).
- **Determinism / pin implications:** recorded — the auto-serve is countdown-fixed today; a human-gated serve introduces a variable wait tick; the two-run DETERMINISTIC attestation covers CPU streams only; the restart-window machinery (`humanWindowTaken` marker, freeze exemption, re-arm, first-touch window close) is affected.
- **Conformance implications:** recorded — SERVE / TIMER-FREEZE / FIRST-TOUCH / MATCH-TIMER-FREEZE criteria need re-evaluation on a human-served stream; no human-served stream is currently attested.
- **Alternatives analyzed honestly:** the delivered receiver-steering destination control (what it covers and does not), the minimal human-gated serve wait, the fuller pass-reception serving path, and doing nothing.
- **Decision recorded (clear verdict):** DEFER, with concrete reasons; `not_a_hedge` recorded; the implement-now plan is recorded as the `HUMAN-BALL-SERVER-LITERAL` future objective outline (its own conformance path).
- **Record byte-reproducibility:** `record_sha256` `5b6e391a…` with NO wall-clock field in the hashed content; two consecutive ordinary-mode runs byte-identical; an ordinary-mode run leaves `docs/` byte-identical.
- **Durable evidence:** written via the `WIP_SECTION=__EVIDENCE__:HUMAN-BALL-SERVER-DECISION` gate; scratch output under the ignored `test-results/`.
- **Zero source/gameplay change:** `git diff src/ src/adapters/ eval/ gauntlet/ specs/` EMPTY.
- **Binding test:** the new test pins the record structure + the `DEFER` verdict; verified discriminating (a mutated `IMPLEMENT_NOW` verdict fails it).
- Batteries green (rules gate 180/180, restart neighbors 188/188, architecture 27/27); `mise run typecheck` exit 0; `gauntlet:audit` status PASS.

---

## Analysis summary (recorded in the record JSON)

### Core machinery change

The countdown-zero auto-serve branches in `src/simulation/loop/simulation.ts` (lines ~1675–1712) unconditionally call `applyThrowIn()` / `applyGoalKick()` / `applyCornerKick()` when the countdown reaches zero, set `matchPhase` to `"playing"`, and clear the restart fields. No input path is consulted; the serve is deterministic (nearest-receiver direction; a fixed penalty-area point for the corner). A literal pass-button ball-server needs a **pass-gated serving path**: at countdown zero, if the designated taker is human-controlled, keep the restart phase open and wait for a human `PASS_BIT` InputFrame within a bounded window; on the pass, derive the serve direction from the input and execute, else the CPU auto-serve fires. This cannot reuse the contact-system pass path — a pass requires the player within `passRadius` (1.2 m) of a contactable ball, which does not hold during the out-of-play window.

### Determinism / pin implications

Today the auto-serve is countdown-fixed; the accepted pins (manifest SHAs, per-run `state_hash_of_hashes`) are computed over runs where the countdown completes at a fixed tick. A human-gated serve introduces a **variable wait tick** (serve tick depends on the human pass's arrival tick). It stays deterministic under a fixed input program (tick-indexed inputs), but the serve tick becomes input-timing-dependent. The two-run DETERMINISTIC attestation (SUITE-DETERMINISTIC-TWO-RUN) runs CPU streams, so it is unaffected as long as the CPU fallback stays byte-identical; a NEW human-served stream needs its own two-run attestation. The restart-window machinery (window-scoped `humanWindowTaken` marker, freeze exemption, re-arm, first-touch window close) is affected because the window closes on the pass rather than at countdown zero.

### Conformance implications

`MATCH-THROW-IN-SERVE` (and the analogous goal-kick / corner serve criteria), `MATCH-THROW-IN-TIMER-FREEZE` / `MATCH-GOAL-KICK-TIMER-FREEZE` / `MATCH-CORNER-KICK-TIMER-FREEZE` (the wait phase must be frozen), `MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH` / `MATCH-KICKOFF-FIRST-TOUCH` (window-close semantics), and `MATCH-TIMER-FREEZE` (the wait phase must not decrement the clock) would need re-evaluation on a human-served stream. No human-served stream is currently attested.

### Alternatives (honest)

1. **Receiver-steering destination control (DELIVERED, HUMAN-RESTART-CONTROL):** the human directs WHERE the restart is served by steering a receiving body; covers destination/direction for throw-in and goal-kick. Does NOT cover the literal pass-button serve, serve timing, serve power, or the corner cross target. No core change; accepted pins unchanged.
2. **Human-gated serve wait (minimal core change):** bounded wait for a human pass at countdown zero. Still a core change (wait state, new frozen phase, changed serve tick) with determinism/pin and conformance costs.
3. **Pass-reception serving path (fuller core change):** genuine pass-reception serve; largest change and most conformance surface.
4. **Do nothing (defer indefinitely):** lowest cost; leaves the pass-button realization permanently open.

## Decision reasons (summary)

1. The delivered receiver-steering realization covers the meaningful human influence on restart destination/direction for the primary restart types; serve timing/power and the literal pass-button are lower-value.
2. The literal server requires a core change with real determinism/pin costs (variable serve wait tick, new frozen phase, re-attestation of any human-served stream; the CPU fallback must stay byte-identical).
3. There is no registered conformance path for a human-served stream; SERVE / TIMER-FREEZE / FIRST-TOUCH would need new oracles/bindings.
4. The next horizon item (RELEASE-0.9.7-CONSOLIDATION) has higher value; adding a core-owned serving path now expands the conformance surface without matching near-term gameplay value.
5. The pass-button realization is not left as an open thread: this record documents the exact core change, the determinism/pin cost, the alternatives, and the `HUMAN-BALL-SERVER-LITERAL` future objective outline (its own conformance path), so it can be scheduled when it has higher relative value.

## Provenance / reproduction

The record is regenerated by:

```
WIP_SECTION=__EVIDENCE__:HUMAN-BALL-SERVER-DECISION \
  mise exec -- pnpm exec tsx scripts/capture-human-ball-server-decision.ts
```

The producer performs deterministic source-level presence checks (countdown-zero branches present; `passRadius` value; pass-requires-contact) and pins the SHA-256 of every touched source file. It carries no wall-clock field, so consecutive ordinary-mode runs are byte-identical and leave `docs/` byte-identical.

## known_gaps

- No implementation is performed (the objective is a decision record, not execution). The `HUMAN-BALL-SERVER-LITERAL` future objective is outlined but NOT scheduled or implemented.
- The record's conformance analysis is descriptive: it names the criteria that would need re-evaluation and states that no human-served stream is currently attested; it does not fabricate a conformance result for a nonexistent human-served stream.
- The restart neighbors run surfaced the known non-fatal vitest worker-RPC infra timeout (`Timeout calling "onTaskUpdate"`), the same reporting artifact documented in the accepted GK-SUITE-CORE-OWNED-STATE / EVAL-HYGIENE-CONSOLIDATION records; every test file passed.

## claims_not_made

- No implementation: the decision is RECORDED, not executed. Zero gameplay/source change in `src/`, `src/adapters/`, `eval/`, `gauntlet/`, `specs/`.
- No suite-level PASS claim.
- No PROMOTION claim.
- No FOUNDATION_LAB_PASS claim.
- No PES 2017 fidelity / measured PES envelope claim.
- No invented reference envelope or tolerance; blocked references stay BLOCKED_MISSING_REFERENCE.
- No claim that a human ball-server exists or that the human becomes the literal server — the verdict is DEFER, with the literal server recorded as a future objective.
