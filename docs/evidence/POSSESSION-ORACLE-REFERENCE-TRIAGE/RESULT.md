# POSSESSION-ORACLE-REFERENCE-TRIAGE — Builder Report

## Builder report

- **objective_id**: POSSESSION-ORACLE-REFERENCE-TRIAGE
- **builder_agent**: builder-structured
- **builder_model**: deepseek-v4-flash
- **evidence_class**: HEADLESS
- **hypothesis**: The `possession-evidence` oracle (oracle-possession-v1) contains a latent per-tick `lastTouchRef` reference-resolution check that is the SAME defect class as the references.ts COMMON-REFERENCES bug fixed in COMMON-FULL-MATCH-INVARIANT-TRIAGE. On a full-match observation map it resolves `ball.lastTouchRef` (a persistent/cumulative reference) only against the current observation's own per-tick events, so it false-FAILs the large majority of ticks where a touch event was emitted on an *earlier* tick. This is a real invariant-scope defect, not a per-tick-by-design semantic.

## Can it false-fail? — yes, and it does (with numbers)

The telemetry contract (`src/contracts/telemetry.ts`) defines `ball.lastTouchRef` as *"Reference to the most recent touch event"* — a **persistent/cumulative** reference. After a touch it stays pointing at that touch's event on every later tick until the next touch. `observation.events` is *"Ordered events emitted at this tick"*.

`eval/oracles/possession.ts` runs **two** checks side-by-side:

1. **Possession-change check** (`possession-no-evidence-tick-*`): if `lastTouchRef` changed from the previous tick, the current tick must carry a touch-kind event. This is a **per-tick change** semantic — it is the actual `BALL-IND-001-POSS` rule ("Ball lastTouchRef changes must correspond to a touch event in the current tick") and is correct by design.
2. **Reference-resolution check** (`possession-orphan-ref-tick-*`, lines ~62-70): if `lastTouchRef` is non-null, it must resolve to an event id **in the current tick's events**. This is the defect: it mis-scopes the persistent reference to a single tick, exactly like the pre-fix `references.ts`.

Empirical proof on the reproduced full-match maps (the same organic driver runs the accepted COMMON-FULL-MATCH-INVARIANT-TRIAGE used), via `scripts/capture-possession-oracle-triage.ts`:

| Run | phase-sync | obs | non-null lastTouchRef | BEFORE per-tick fails (orphan-ref) | BEFORE no-evidence fails | AFTER window-union fails | genuinely-invalid refs |
|---|---|---|---|---|---|---|---|
| anti-huddle-flowing | legacy | 1800 | 1800 | **1719** | 0 | **0** | 0 |
| ball-settled-flowing | legacy | 1200 | 1200 | **1149** | 0 | **0** | 0 |
| restart-corner | core-owned | 1800 | 1799 | **1749** | 0 | **0** | 0 |
| gk-continuous-live | legacy | 1800 | 1800 | **1685** | 0 | **0** | 0 |

Key observations:

- On every full-match map the **vast majority** of ticks carry a non-null `lastTouchRef` (1800/1800, 1200/1200, 1799/1800, 1800/1800).
- The per-tick reference-resolution check false-FAILs between **1149/1200 and 1749/1800** ticks per run. The anti-huddle number (1719/1800) is exactly the same false-fail count as the COMMON-REFERENCES defect, confirming it is the same class.
- **0/1800 (and 0 for the others) observations** have a `lastTouchRef` absent from the union of every event across the window → the referenced event is genuinely valid on the real maps. Nothing is actually broken.
- The possession-change check (the genuine discriminating check) reports **0** fails on every real run — it is not the source of the false fails.

**Conclusion: the oracle's semantics are NOT per-tick for reference resolution.** The possession-change requirement is per-tick by design, but the reference-resolution half must resolve the persistent `lastTouchRef` against the observation-window event universe. The defect CAN false-fail (it did, 1685-1749 times per run), so a fix is warranted. This is not the honest no-change outcome.

## The fix (no oracle weakening)

- `eval/oracles/possession.ts` — `checkPossessionEvidence(observations, knownEventIds?)` now resolves `lastTouchRef` against `knownEventIds` (the window event union) when supplied, and falls back to the observation's own per-tick events otherwise (preserving the single-observation caller contract the existing tests use). The possession-change check is untouched — it remains per-tick by design.
- `eval/oracles/wire.ts` — the `possession-evidence@oracle-possession-v1` oracle now precomputes the union of every event emitted across the observation window and passes it to `checkPossessionEvidence` for each observation (the same wiring the `event-references` oracle uses).

A reference to an event id that exists **nowhere** in the run is still FAIL (proven by the guard: `lastTouchRef: "ghost-nowhere"` with a window union that never contains it produces an orphan-ref FAIL), so the oracle is **not weakened**. A prior-tick touch reference (valid by the telemetry contract and by the core validator) now correctly resolves.

## Before/after oracle outcomes on the accepted runs

The accepted duels/GK suite state records and all `docs/evidence/*/eval.json` verdict pins are **immutability-locked** and were **not rewritten** — `git diff` on `docs/evidence/` shows no modification to any accepted evidence. A fresh capture was produced under `docs/evidence/POSSESSION-ORACLE-REFERENCE-TRIAGE/` (per-run partials under `runs/`, aggregate in `possession-triage.json`) by the reproducible producer `scripts/capture-possession-oracle-triage.ts`.

The possession verdict on the accepted criteria is unchanged because the change is a **false-FAIL removal**, never a PASS→FAIL flip:

- `BALL-IND-001-POSS=PASS` and `TOUCH-SLOW-001-CONTACT=PASS` pins (in `FOUNDATION_LAB_PASS`, `PLAYABLE-1V1-*`) reproduce byte-identically — the clean short runs they pin never had the persistent-reference false-fail, and the fix only ever removes false-fails.
- The mutant guards (`MUTANT_TEAM_PASS` `possession-no-evidence` clean=pass / poisoned=fail) reproduce identically — the poison still FAILs (`makeObservationsWithPossessionNoEvidence` sets a reference present nowhere plus no touch event, so both the no-evidence and reference checks fire).

A genuinely-invalid reference must still FAIL: verified by the guard and by running the wired oracle over a synthetic `[obs0, obs1]` pair where `lastTouchRef = "never-anywhere-in-run"` (window union never contains it) → the oracle returns both a `possession-no-evidence` and a `possession-orphan-ref` FAIL (2 fails). No oracle weakening.

## Discriminating guards (additive; no skip/todo/only)

`tests/unit/eval/possession-oracle.test.ts` (3 new tests added; total 13):

1. **A persistent prior-tick lastTouchRef false-fails per-tick and passes with the window union** — the false-fail signature: the per-tick fallback produces >0 orphan-ref FAILs, the window-union call produces 0 fails. This is the test that FAILs with the old code and PASSES with the fix.
2. **A reference present nowhere in the window still FAILs** (no oracle weakening).
3. **A genuine change-without-evidence still FAILs under window-union resolution** (the per-tick change semantic is preserved, not weakened).

## Tests run

| Test | Result |
|---|---|
| `tests/unit/eval/possession-oracle.test.ts` | PASS (13; +3 guards) |
| `tests/unit/eval/mutant-core.test.ts` | PASS (33) |
| `tests/unit/eval/mutant-team.test.ts` | PASS (34) |
| `tests/unit/eval/mutant-1v1.test.ts` | PASS (38) |
| `tests/unit/eval/oracle-registry.test.ts` | PASS (19) |
| `tests/unit/eval/duels-suite.test.ts` | PASS (39) |
| `tests/unit/eval/goalkeepers-suite.test.ts` | PASS (24) |
| `tests/unit/eval/eval-registry.test.ts` | PASS (48) |
| `tests/unit/eval/foundation-evaluator.test.ts` | PASS (36) |
| `tests/unit/contacts/close-control.test.ts` | PASS (26) |
| `tests/integration/oracles-mutant-canary.test.ts` | PASS (23) |
| `tests/integration/telemetry.test.ts` | PASS (11) |
| `tests/integration/evaluator.test.ts` | PASS (18) |
| `tests/integration/compare-foundation.test.ts` | PASS (8) |
| `tests/integration/headless.test.ts` | PASS (13) |

## Accepted-pin status

All existing suite pins are green. No accepted evidence artifact was modified: `git diff -- docs/evidence/` is empty for all accepted objective directories. The only assertion-level change is the **additive** new tests; existing assertions are untouched.

## Command / evidence

- `mise run typecheck` (tsc core + node + browser): **exit 0**.
- Fresh capture producer: `scripts/capture-possession-oracle-triage.ts`, run per run-id; wrote `docs/evidence/POSSESSION-ORACLE-REFERENCE-TRIAGE/runs/*.json` (4 runs) and the aggregate `possession-triage.json`.
- `mise exec -- pnpm run gauntlet:audit -- --objective POSSESSION-ORACLE-REFERENCE-TRIAGE --class HEADLESS --tests-pass true --integration-test-pass true` — see `docs/evidence/POSSESSION-ORACLE-REFERENCE-TRIAGE/audit.json`.

## files_changed

- `eval/oracles/possession.ts` — `checkPossessionEvidence` accepts an optional window event-union; resolves `lastTouchRef` against it (fall back to per-tick events). The per-tick possession-change check is unchanged.
- `eval/oracles/wire.ts` — `possession-evidence` oracle passes the window event union.
- `tests/unit/eval/possession-oracle.test.ts` — 3 additive discriminating guards.
- `scripts/capture-possession-oracle-triage.ts` — NEW fresh-capture producer.
- `docs/evidence/POSSESSION-ORACLE-REFERENCE-TRIAGE/` — NEW evidence (RESULT.md, audit.json, possession-triage.json, runs/*.json).

No gameplay change: `git diff src/simulation/ src/contracts/ src/adapters/ eval/scenarios/ specs/` is EMPTY.

## spec_sections

- `src/contracts/telemetry.ts` — `lastTouchRef` is a persistent "Reference to the most recent touch event"; per-tick `events` are "Ordered events emitted at this tick".
- `src/simulation/world/validate.ts` — core resolves `lastTouchRef` against cumulative `state.events` (confirming the reference is valid).
- `eval/contracts/common-criteria.ts` — `BALL-IND-001-POSS` ("Ball lastTouchRef changes must correspond to a touch event in the current tick").
- `eval/oracles/wire.ts` / `eval/oracles/oracle-registry.ts` — protected oracle registry.
- `eval/oracles/mutant-registry.ts` — `possession-no-evidence` mutant ↔ `possession-evidence` oracle.

## claims_not_made

- No PROMOTION claim.
- No PES 2017 fidelity / measured PES envelope claim.
- No FOUNDATION_LAB_PASS claim.
- No invented reference envelope or tolerance.
- No test weakening: no skipped / deleted / `only` / `todo` coverage; guards are additive.
- No gameplay change: `git diff src/simulation/ src/contracts/ src/adapters/ eval/scenarios/ specs/` EMPTY.
- No claim that the possession-change semantic was altered — it remains per-tick by design (it is the actual `BALL-IND-001-POSS` rule); only the reference-resolution half was aligned to the window union.
- The accepted evidence verdicts (BALL-IND-001-POSS=PASS, TOUCH-SLOW-001-CONTACT=PASS, MUTANT_TEAM_PASS) are claimed unchanged and reproduce byte-identically because the fix only ever removes false-FAILs.
