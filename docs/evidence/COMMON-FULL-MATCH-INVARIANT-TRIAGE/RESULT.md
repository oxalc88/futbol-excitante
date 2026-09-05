# COMMON-FULL-MATCH-INVARIANT-TRIAGE — Builder Report

## Builder report

- **objective_id**: COMMON-FULL-MATCH-INVARIANT-TRIAGE
- **builder_agent**: builder-structured
- **builder_model**: deepseek-v4-flash
- **evidence_class**: HEADLESS
- **hypothesis**: The COMMON-REFERENCES / COMMON-BOUNDS FAILs on full-match observations are two distinct, independently root-causable things. COMMON-REFERENCES is a real invariant-scope defect (the `event-references` oracle resolved the persistent `ball.lastTouchRef` only against the current observation's per-tick events). COMMON-BOUNDS is NOT a defect and does NOT need an envelope relaxation: the `bounds` oracle flags player positions outside the declared pitch-rect safety bounds, and the FAILs are confined to the legacy-phase-sync runs where the documented restart-freeze leaves the ball out of play and players chase it out of bounds — a real illegal position, correctly caught. So the objective's resolution is: fix COMMON-REFERENCES (with discriminating guards, no oracle weakening), and honestly residual-disclose COMMON-BOUNDS.

## Root cause(s) — exact mechanism, not symptom-level

### COMMON-REFERENCES — prior-tick lastTouchRef resolution (a real invariant defect)

The telemetry contract (`src/contracts/telemetry.ts`) defines `ball.lastTouchRef` as *"Reference to the most recent touch event"*, and `observation.events` as *"Ordered events emitted at this tick"*. `lastTouchRef` is therefore a **persistent/cumulative** reference: after a touch it stays pointing at that touch's event on every later tick until the next touch.

`eval/invariants/references.ts#checkEventReferences` (bound to COMMON-REFERENCES through the `event-references@oracle-references-v1` oracle) resolved `ball.lastTouchRef` only against the **current observation's own per-tick events**. On a full-match observation map most ticks carry a `lastTouchRef` pointing at an event emitted on an *earlier* tick, so the per-tick-only check produced a FAIL on the large majority of observations.

Empirical proof on the real anti-huddle-flowing map (5v5-continuous-play, 1800 ticks):
- 1800 / 1800 observations carry a non-null `lastTouchRef`.
- 1719 / 1800 observations have `lastTouchRef` **not present in the current tick's events** (the old per-tick-only check → FAIL).
- **0 / 1800** observations have `lastTouchRef` **not present in the union of every event across the window** (the reference is genuinely valid).

The core's own world-state validator (`src/simulation/world/validate.ts`) already resolves `lastTouchRef` against the cumulative `state.events` — confirming the reference is valid and the *observation-layer* per-tick scope was the only thing wrong. This was also explicitly documented by the accepted SHOT-RESULT-RESOLUTION-FIXTURE and DUEL-REJECTION-FIXTURE binding tests ("This causes event-references invariant failures per observation tick").

**Conclusion: the invariant's expectation was wrong, not the simulation. `lastTouchRef` legitimately references prior-tick events; the invariant must resolve it against the observation-window event universe.**

### COMMON-BOUNDS — ball-out-of-play safety-bounds behavior (correct invariant behavior + real illegal positions)

`eval/invariants/bounds.ts#checkBounds` (bound to COMMON-BOUNDS through the `bounds@oracle-bounds-v1` oracle) checks **player** `|x| ≤ maxX` and `|y| ≤ maxY` (and ball `z ∈ [minZ, maxZ]` — it does **not** check ball x/y). The oracle uses the scenario's declared `safetyBounds` (pitch rect: `maxX=52.5`, `maxY=34`, `minZ=-0.5`, `maxZ=20`).

On the two *legacy phase-sync* full-match runs (anti-huddle-flowing, ball-settled-flowing — both reproduced with `lifecyclePhaseSync` default "legacy") the runner freezes the core's restart countdowns (the documented RESTART-ANTI-HUDDLE-COHERENCE driver behavior that was frozen in place to preserve accepted byte-identical pins). With the restart machinery suspended, a ball that goes out of play **is never reset**, so it keeps rolling beyond the goal line (to `maxBallAbsX≈61.2 m`) and players chase it out of bounds (`maxPlayerAbsX≈61.2 m`). The `bounds` oracle correctly flags these player positions as outside the declared bounds.

Empirical proof (fresh capture, see `common-criteria.json` + `runs/*.json`):

| Run | phase-sync | maxPlayerAbsX | maxBallAbsX | COMMON-REFERENCES | COMMON-BOUNDS |
|---|---|---|---|---|---|
| anti-huddle-flowing | legacy | 61.18 | 61.24 | PASS | FAIL |
| ball-settled-flowing | legacy | 61.18 | 61.24 | PASS | FAIL |
| gk-continuous-live | legacy | 56.04 | 56.61 | PASS | FAIL |
| gk-shot-fixture-live | legacy | 59.47 | 59.90 | PASS | FAIL |
| human-duel | legacy | 29.99 | 3.19 | PASS | PASS |
| restart-corner | core-owned | 52.50 | 54.37 | PASS | PASS |
| restart-goalkick-postgoal | core-owned | 52.45 | 54.99 | PASS | PASS |
| restart-throwin | core-owned | 42.64 | 31.21 | PASS | PASS |

The pattern is exact: **COMMON-BOUNDS FAILs only on the legacy-phase-sync runs** (ball/players escape the pitch because the restart never executes) and **PASSes on every core-owned run** (restarts work; players stay within the pitch rect, `maxPlayerAbsX ≤ 52.50`). The nominal *goal* excursion (ball at `x≈54.99` in the core-owned goalkick run) is not checked by the oracle (it only checks player x/y and ball z), and players never leave the rect there.

**Conclusion: the ball does NOT legitimately leave the bounds in normal full-match play; the FAILs are caused by real illegal positions (a ball out of play that is never reset + players chasing it out) that occur only under the legacy phase-sync driver behavior. COMMON-BOUNDS is correct invariant behavior and must NOT be widened to mask that real escape (that would weaken the oracle).**

## The fix

### COMMON-REFERENCES (real defect — fixed, no oracle weakening)

- `eval/invariants/references.ts` — `checkEventReferences(observation, knownEventIds?)` now resolves `lastTouchRef` against `knownEventIds` (the window event union) when supplied, and falls back to the observation's own per-tick events otherwise (preserving the single-observation caller contract the existing tests use).
- `eval/oracles/wire.ts` — the `event-references@oracle-references-v1` oracle now precomputes the union of every event emitted across the observation window and passes it to `checkEventReferences` for each observation. This is the path the duels / goalkeepers `evaluateSuite` COMMON criteria use.

A reference to an event id that exists **nowhere** in the run is still FAIL (proven by the guard), so the oracle is not weakened. A prior-tick touch reference (valid by the telemetry contract and by the core validator) now correctly resolves.

### COMMON-BOUNDS (correct behavior — residual disclosed, no fix)

No code change. The invariant and its bounds are left exactly as-is: the core-owned full-match runs already PASS, and widening the bound to swallow the legacy-phase-sync escape would hide a real illegal position (a no-oracle-weakening constraint). The legacy driver behavior is the documented RESTART-ANTI-HUDDLE-COHERENCE phase-sync defect, not a full-match-bounds defect.

## Before/after invariant outcomes on the full-match runs (duels + GK suite re-runs)

The duels-suite-state and gk-suite-state records are **immutability-locked** (`manifest.json` exists for both), so they were **not rewritten**. A fresh capture was produced under `docs/evidence/COMMON-FULL-MATCH-INVARIANT-TRIAGE/` (per-run partials under `runs/`, aggregate in `common-criteria.json`) by the new reproducible producer `scripts/capture-common-full-match-triage.ts`.

| Criterion | Before (accepted records) | After (fresh capture, all 8 full-match maps) |
|---|---|---|
| COMMON-REFERENCES | FAIL on full-match observations (prior-tick lastTouchRef not in per-tick events) | **PASS on every run (0 per-tick fails)** |
| COMMON-BOUNDS | FAIL where ball-out-of-play (legacy runs) | **PASS on all core-owned runs + human-duel; FAIL (residual disclosed) on the 4 legacy phase-sync runs** |
| COMMON-FINITE | PASS | PASS (unchanged) |

The COMMON-REFERENCES fix is verified on a real full-match observation map independently of the slow full-suite re-run: a 200-tick `5v5-continuous-play` map produced **186/200 per-tick-only FAILs** (old behavior) and **0/200 window-union FAILs** (fixed), and the `event-references` oracle returns 0 fails over that same map.

## Discriminating guards (additive; no skip/todo/only)

- `tests/unit/eval/COMMON-FULL-MATCH-INVARIANT-TRIAGE-guard.test.ts` (3 tests):
  1. A real full-match map carries persistent `lastTouchRef`; the OLD per-tick-only check produces the FAIL signature (>0 fails) and the NEW window-union check produces 0 fails; the oracle wiring produces 0 fails.
  2. A genuinely broken reference (present nowhere) is **still caught** by the window-union check (no oracle weakening).
  3. A persistent `lastTouchRef` referencing a prior-tick event exists and is a valid reference, not a broken one.

## Tests run

| Test | Result |
|---|---|
| `tests/unit/eval/COMMON-FULL-MATCH-INVARIANT-TRIAGE-guard.test.ts` | PASS (3 tests) |
| `tests/integration/telemetry.test.ts` | PASS (11) |
| `tests/integration/evaluator.test.ts` | PASS (18) |
| `tests/integration/headless.test.ts` | PASS (13) |
| `tests/integration/compare-foundation.test.ts` | PASS |
| `tests/unit/eval/SHOT-RESULT-RESOLUTION-FIXTURE-binding.test.ts` | PASS (10) |
| `tests/unit/eval/DUEL-REJECTION-FIXTURE-binding.test.ts` | PASS (10) |
| `tests/unit/eval/duels-suite.test.ts` | PASS (39) |
| `tests/unit/eval/goalkeepers-suite.test.ts` | PASS (24) |
| `tests/unit/eval/eval-registry.test.ts` | PASS (48) |
| `tests/unit/eval/oracle-registry.test.ts` | PASS (19) |
| `tests/unit/eval/foundation-evaluator.test.ts` | PASS (36) |
| `tests/unit/eval/foundation-promotion.test.ts` | PASS |
| `tests/unit/eval/DUELS-SUITE-ORGANIC-RERUN-binding.test.ts` | PASS (8) |
| `tests/unit/eval/GK-SUITE-ORGANIC-STATE-binding.test.ts` | PASS (8, one assertion updated with provenance: live COMMON-REFERENCES FAIL→PASS) |
| `tests/unit/eval/team-shape.test.ts` | PASS (19) |
| `tests/unit/eval/team-shape-evidence-binding.node.test.ts` | PASS (21) |
| `tests/unit/eval/small-sided-situation-evaluator.test.ts` | PASS |
| `tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-1-binding.test.ts` | PASS (11) |
| `tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-3-binding.test.ts` | PASS |
| `tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-4-binding.test.ts` | PASS |
| `tests/unit/eval/capability-design.test.ts` + `capability-design-runner` + `eval-body-control` + `eval-physical-contact` + `eval-shooting-power` + `eval-swerve` | PASS (128 across 6 files) |
| `tests/unit/eval/playable-evaluator.test.ts` | PASS |

## Accepted-pin status

All existing suite pins are green. The only assertion that changed is in `GK-SUITE-ORGANIC-STATE-binding.test.ts` where the *current reproduction* COMMON-REFERENCES is now `PASS` (corrected by the invariant fix) — updated with an explicit provenance comment. The **immutable** read-back assertions (`record.after.common["COMMON-REFERENCES"] === "FAIL"` and the per-run record `common["COMMON-REFERENCES"] === "FAIL"`) still hold because the accepted record was **not** rewritten. No accepted evidence artifact was modified.

## Command / evidence

- `mise run typecheck` (tsc core + node + browser): exit 0.
- Fresh capture producer: `scripts/capture-common-full-match-triage.ts`, run per run-id; wrote `docs/evidence/COMMON-FULL-MATCH-INVARIANT-TRIAGE/runs/*.json` (8 runs) and the aggregate `common-criteria.json`.
- `pnpm run gauntlet:audit -- --objective COMMON-FULL-MATCH-INVARIANT-TRIAGE --class HEADLESS --tests-pass true --integration-test-pass true` — see `docs/evidence/COMMON-FULL-MATCH-INVARIANT-TRIAGE/audit.json`.

## files_changed

- `eval/invariants/references.ts` — `checkEventReferences` accepts an optional window event-union; resolves `lastTouchRef` against it (fall back to per-tick events).
- `eval/oracles/wire.ts` — `event-references` oracle passes the window event union.
- `tests/unit/eval/COMMON-FULL-MATCH-INVARIANT-TRIAGE-guard.test.ts` — NEW discriminating guards.
- `tests/unit/eval/GK-SUITE-ORGANIC-STATE-binding.test.ts` — one stale assertion updated with provenance (live COMMON-REFERENCES FAIL→PASS); immutable read-back unchanged.
- `scripts/capture-common-full-match-triage.ts` — NEW fresh-capture producer.
- `docs/evidence/COMMON-FULL-MATCH-INVARIANT-TRIAGE/` — NEW evidence (RESULT.md, audit.json, common-criteria.json, runs/*.json).

### Tooling note (not a code change)

`pnpm-workspace.yaml` (untracked, `allowBuilds: { esbuild: true }`) was added to allow the pnpm 11 esbuild build scripts. pnpm 11 blocks postinstall build scripts by default; without this approval pnpm's automatic pre-run deps-status check triggers a `pnpm install` that exits 1 on the ignored esbuild builds, which makes `mise run typecheck`, `pnpm exec`, and `pnpm run gauntlet:audit` fail. With the approval in place, `mise run typecheck` exits 0 and `mise exec -- pnpm run gauntlet:audit ...` exits 0. This is a build/tooling config for the environment's pnpm 11, not a change to the objective's logic; `git diff src/simulation/ src/contracts/` remains EMPTY.

## spec_sections

- `src/contracts/telemetry.ts` — `lastTouchRef` is a persistent "Reference to the most recent touch event"; per-tick `events` are "Ordered events emitted at this tick".
- `src/simulation/world/validate.ts` — core resolves `lastTouchRef` against cumulative `state.events` (confirming the reference is valid).
- `src/contracts/scenario.ts` — `safetyBounds` (hard world bounds) declared per scenario; current value is the pitch rect.
- `eval/contracts/common-criteria.ts` — COMMON-REFERENCES / COMMON-BOUNDS rules.
- `eval/oracles/wire.ts` / `eval/oracles/oracle-registry.ts` — protected oracle registry.

## claims_not_made

- No PROMOTION claim.
- No PES 2017 fidelity / measured PES envelope claim.
- No FOUNDATION_LAB_PASS claim.
- No invented reference envelope or tolerance. No COMMON-BOUNDS widening was applied (the bound did not need widening for legitimate geometry — core-owned runs pass, and widening to swallow the legacy-phase-sync escape would mask a real illegal position).
- No test weakening: no skipped / deleted / `only` / `todo` coverage; guards are additive.
- No gameplay change: `git diff src/simulation/ src/contracts/` EMPTY.
- No claim that COMMON-BOUNDS turns green on the legacy phase-sync runs — that is a **disclosed residual** (root-caused to the documented RESTART-ANTI-HUDDLE-COHERENCE legacy phase-sync driver behavior, not a full-match-bounds defect). The invariant is correct there.
- COMMON-REFERENCES is claimed as fixed on full-match observations (proven by the oracle returning 0 fails over every reproduced full-match map and by the discriminating guard).
