# NODE-GATE-REGRESSION-TRIAGE — Builder Report

## Builder report

- **objective_id**: NODE-GATE-REGRESSION-TRIAGE
- **builder_agent**: builder-structured
- **builder_model**: deepseek-v4-flash
- **evidence_class**: HEADLESS
- **hypothesis**: The 8 pre-existing node-project failures were a mixed set: one real determinism/input-scheduling defect shared by two canary suites, one test-timeout (not a determinism mismatch), one capture-hygiene violation, and three stale durable-artifact/stale-assertion cases. Honest repairs (fix code/fixture with executed evidence, supersede stale artifacts preserving provenance, update stale assertions with provenance) restore `pnpm test` (node project) to exit 0 with typecheck still 0.

## Per-item triage table

| # | Test file | Failures | Root cause (diagnosed) | Classification | Fix | Verification |
|---|---|---|---|---|---|---|
| 1 | `tests/integration/compare-foundation.test.ts` | 2 | `evaluate()` (`eval/runners/evaluate.ts`) applied input frames at `scenario.inputProgram[sim.tick + 1]`, while the canonical headless runner (`src/apps/headless/run.ts:189`), the manual `createWorld`+`createSimulation` path in the mutant tests, and every other eval runner use `inputProgram[sim.tick]`. This off-by-one dropped the tick-0 frame and desynchronised `evaluate()` from the manual sim baseline, so the pre-mutation hash assertions failed (`329b2f66…` vs `73d70dac…`). | Real defect (evaluate() input-schedule inconsistency) | Changed `evaluate()` to read `scenario.inputProgram[sim.tick]` and corrected the stale comment. Confirmed `evaluate()` now produces identical per-tick hashes to `runHeadless()` for the same input-driven scenario. | `compare-foundation` 8/8 pass; diagnostic `evaluate==runHeadless hashes? true`. |
| 2 | `tests/integration/nondeterminism-canary.test.ts` | 2 | Same off-by-one as #1: the PRNG-mutant and identity-clone tests compare a manual sim (which uses `inputProgram[sim.tick]`) against an `evaluate()` clean run (which used `inputProgram[sim.tick + 1]`), so baselines diverged even with no PRNG mutation. | Real defect (same root cause) | Same `evaluate()` fix, plus a new regression guard pinning `evaluate()` and `runHeadless()` to the same per-tick hash stream for an input-driven scenario. | `nondeterminism-canary` 8/8 pass (7 original + 1 new guard). |
| 3 | `tests/integration/match-lifecycle.test.ts` | 1 | `MATCH-LIFECYCLE-004 > same seed → identical phaseHistory across runs` runs two full 600-tick CPU-vs-CPU matches sequentially (~6.4 s total), exceeding vitest's default 5000 ms testTimeout. The comparison was a timeout, not a determinism mismatch: phaseHistory was already deterministic (`same phaseHistory? true`, lengths 5/5). | Test timeout (insufficient per-test timeout), NOT a determinism defect | Added `{ timeout: 15000 }` to that determinism test. | `match-lifecycle` 31/31 pass; determinism test now ~5.3 s and green. |
| 4 | `tests/unit/eval/playable-1v1-re-evaluation.test.ts` | 1 | The durable `docs/evidence/PLAYABLE-1V1-RE-EVALUATION/eval.json` pinned `registrySetId` to `fnv1a64-v1:d1a691b2c1211c76`, but the live registry set id is now `fnv1a64-v1:24b5341e2bc3fbd3` (the registry content hash changed as accepted objectives evolved the registry). The `registrySetId matches the loaded registry` assertion compares a stale durable artifact to the live registry. | Stale durable artifact vs legitimately evolved live registry | Regenerated the eval.json in place using the established supersession pattern (mirrors the accepted FOUNDATION_LAB_PASS supersession in HUMAN-DEFENSIVE-DUEL-CONTROL): `registrySetId` `d1a691b2…` → `24b5341e…`, with `milestoneVerdict` (INVALID_RUN) and every sub-component outcome preserved. Old artifact backed up as `eval.json.superseded-2026-09-04.json` for provenance. Verified a live `evaluatePlayable1v1(loadFixture())` returns the identical milestoneVerdict and sub-component outcomes, differing only in `registrySetId`. | `playable-1v1-re-evaluation` 29/29 pass. |
| 5 | `tests/unit/eval/SMALL-SIDED-COHERENT-EVIDENCE-RERUN-binding.test.ts` | 1 | The binding test asserted the SMALL_SIDED_SHAPE bundle manifest had 18 source objectives / 17 playtest runs and latest playtest `2026-08-26T14-00-00.000Z`. The live bundle was superseded by the accepted SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE (b253e42): now 19 sources / 19 runs, latest `2026-09-04T18-16-07-471Z`. | Stale assertion (bundle legitimately evolved) | Updated the binding to 19/19 and the new latest-playtest path, with a provenance comment. | `SMALL-SIDED-COHERENT-EVIDENCE-RERUN-binding` 8/8 pass. |
| 6 | `tests/difficulty-capture.node.test.ts` | 1 | The node test threw `Accepted evidence is immutable: BROWSER-DIFFICULTY-SETTING already has a manifest` because `docs/evidence/BROWSER-DIFFICULTY-SETTING/manifest.json` exists, and it tried to write a durable screenshot into `docs/screenshots/BROWSER-DIFFICULTY-SETTING/` during an ordinary node run — a capture-hygiene violation (0.9.2+). | Capture-hygiene violation (ordinary suite must not write to `docs/screenshots/**`) | Redirected output to the ignored ephemeral path `test-results/gauntlet-capture/BROWSER-DIFFICULTY-SETTING/` and removed the now-incorrect immutable-evidence guard (output is ephemeral, not durable). The test still captures and validates the 2D-canvas screenshot. | `difficulty-capture` 1/1 pass; writes a 27916-byte PNG under `test-results/gauntlet-capture/`. |
| 7 | `tests/integration/match-set-piece.test.ts` | 0 | Not reproducing in the current run (matches the recent sweep). | Not a defect — no change required | None (verified only). | `match-set-piece` 11/11 pass in the integration shard; report as no-longer-reproducing, not "fixed". |

## Full-node-suite exit proof

The host could not complete the whole node project in a single sub-session window (a single `pnpm test` run exceeded the 300 s command cap), so the suite was executed as shards covering every one of the 168 node test files with zero failures. The shard coverage was cross-checked against `find tests` (the exact vitest project filter).

File inventory used for the proof:

```text
find tests -name '*.test.ts' | grep -vE '/browser/|\.browser\.test\.ts'   # = 168 files
```

Shard runs (all zero failures):

| Shard | Files | Result | Exit |
|---|---|---|---|
| non-eval non-integration | 81 | 1473 tests passed | 0 |
| integration | 26 | 304 tests passed | 0 |
| eval (completed before the 300 s cap) | 7 | all passed | n/a |
| eval chunk 00 | 9 | 215 tests passed | 0 |
| eval chunk 01 | 9 | 222 tests passed | 0 |
| eval chunk 02 | 9 | 212 tests passed | 0 |
| eval chunk 03 | 9 | 149 tests passed | 0 |
| eval chunk 04 | 9 | 94 tests passed | 0 |
| eval chunk 05 | 9 | 189 tests passed | 0 |

Coverage cross-check (union of `|node| tests/...` file lines across every shard log vs `find tests`):

```text
union size: 168
files in find-tests but not run (gaps): <none>
files run but not in find-tests (duplicates): <none>
```

Aggregate: **168 / 168 node test files pass, zero failures**. A `grep -cE '×|failed|FAIL'` across all shard logs produces only matches inside test names / expected stdout (e.g. "PRNG-order mutant → FAIL", scenario verdict lines, the deliberate `Run failed: Replay divergence detected` fixture output), not actual failing assertions — every shard reports `X passed` with exit 0.

## Commands run

| Command | Exit |
|---|---|
| `npx vitest run --project node tests/integration/compare-foundation.test.ts tests/integration/nondeterminism-canary.test.ts` | 0 |
| `npx vitest run --project node tests/integration/oracles-mutant-canary.test.ts tests/integration/failure-exits.test.ts tests/unit/scenario/3v3-situation-driven.node.test.ts` | 0 |
| `npx vitest run --project node tests/integration/match-lifecycle.test.ts` | 0 |
| `npx vitest run --project node tests/unit/eval/SMALL-SIDED-COHERENT-EVIDENCE-RERUN-binding.test.ts` | 0 |
| `npx vitest run --project node tests/difficulty-capture.node.test.ts` | 0 |
| `npx vitest run --project node tests/unit/eval/playable-1v1-re-evaluation.test.ts` | 0 |
| `npx vitest run --project node tests/integration/match-set-piece.test.ts tests/unit/eval/foundation-lab-evidence-binding.node.test.ts` | 0 |
| `npx vitest run --project node <shard files>` (each shard) | 0 |
| `pnpm run typecheck` | 0 |

## Files changed

- `eval/runners/evaluate.ts` — input-schedule fix (`scenario.inputProgram[sim.tick]`); the one simulation-adjacent code change.
- `tests/integration/nondeterminism-canary.test.ts` — added input-schedule consistency regression guard.
- `tests/integration/match-lifecycle.test.ts` — increased per-test timeout for the determinism test.
- `tests/unit/eval/SMALL-SIDED-COHERENT-EVIDENCE-RERUN-binding.test.ts` — updated stale bundle counts/path with provenance.
- `tests/difficulty-capture.node.test.ts` — redirect capture output to `test-results/gauntlet-capture/`.
- `docs/evidence/PLAYABLE-1V1-RE-EVALUATION/eval.json` — registrySetId superseded in place (verdict preserved).
- `docs/evidence/PLAYABLE-1V1-RE-EVALUATION/eval.json.superseded-2026-09-04.json` — old artifact backed up for provenance.

## spec_sections

- TECHNICAL_SPEC — determinism/input-tick contract (`InputFrame` tick-indexing, `step()` reads `inputBuffers[world.tick]` before incrementing); fixed `evaluate()` to honour the canonical per-tick input schedule.
- GAMEPLAY_EVALUATION_SPEC — evaluator registry set-id is a content hash that legitimately evolves; a durable eval artifact must be superseded/regenerated rather than treated as an immutable pin.

## claims_not_made

- No PROMOTION claim.
- No PES fidelity claim.
- No FOUNDATION_LAB_PASS claim (not re-run/not asserted at this objective).
- No invented reference envelopes / no invented tolerances.
- No test weakening: no skipped, deleted, or de-asserted coverage. The match-lifecycle change only raises a per-test timeout; the SMALL-SIDED binding change updates stale counts to current reality with provenance; the difficulty-capture change redirects output to the mandated ephemeral path (still asserts the capture is a valid PNG); the playable-1v1 change shifts only `registrySetId` to the live value, preserving the INVALID_RUN verdict and every sub-component outcome.
- No forced PASS, and no conviction of `match-set-piece` as "fixed" (it is reported as no-longer-reproducing since it passed with no change).
