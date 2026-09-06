# LIFECYCLE-MIGRATION-ASSESSMENT — Builder Report

## Builder report

- **objective_id**: LIFECYCLE-MIGRATION-ASSESSMENT
- **builder_agent**: builder-structured
- **builder_model**: deepseek-v4-flash
- **evidence_class**: HEADLESS
- **hypothesis**: The runner's `lifecyclePhaseSync` policy default (legacy) suppresses the core's restart windows headless, which is the documented driver defect behind the COMMON-BOUNDS legacy residual. The migration question is whether the accepted legacy-phase-sync pinned trajectories reproduce byte-identically under the corrected `core-owned` policy. If they do, or if their only delta is exactly the documented restart-window behavior (and no test asserts the suppressed behavior), the default can be flipped to `core-owned`; otherwise the migration is blocked.

## Decision

**MIGRATED.** The `lifecyclePhaseSync` default is now `core-owned` (browser parity). Every accepted legacy-phase-sync pin diverges deterministically, and the divergence begins *exactly* at the first restart window — the core's set-piece / post-goal / halftime reset machinery that the legacy runner froze. No pin errors and no pin is nondeterministic, so there are no blocking pins (every pin is classification (b)). `runHeadlessMatch` keeps `"legacy"` as an explicit opt-out, and the producers of the accepted historical pins are pinned to it so those records stay byte-reproducible at their historical configuration.

**Answer to the decisive engineering question** (`under core-owned, do the accepted pinned trajectories still reproduce byte-identically?`): **No.** All four legacy phase-sync pins reproduce *differently* under core-owned (per-tick state hash chains diverge at a restart window). They do not break; they change only where the previously-frozen restart machinery now runs. The migration is therefore a behavioral correction, not a byte-identity-preserving change, and it is executed with per-pin deltas + opt-outs rather than with byte-identity proofs.

## Commands run (actual exit codes)

| Command | Exit |
|---|---|
| `mise run typecheck` | 0 |
| `PNPM exec tsx scripts/capture-lifecycle-migration-assessment.ts --run <run_id>` (each) | 0 |
| `CI=1 pnpm exec vitest run --project node tests/integration/{match-scoring,match-set-piece,headless-match,match-lifecycle}.test.ts` | 0 (98 tests) |
| `CI=1 pnpm exec vitest run --project node tests/unit/eval/COMMON-FULL-MATCH-INVARIANT-TRIAGE-guard.test.ts tests/unit/2v2-scoring.test.ts tests/unit/2v2-scoring-long-{a,b,c}.test.ts` | 0 (37 tests) |
| `CI=1 pnpm exec vitest run --project node tests/integration/{replay-match,5v5-kickoff-anti-huddle,ball-settled-regime-match}.test.ts` | 0 (31 tests) |
| `CI=1 pnpm exec vitest run --project node tests/unit/eval/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-{1-geometry,2-trajectory,3-guard-proof}.test.ts tests/unit/eval/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE-binding.test.ts` | 0 (22 tests) |
| `CI=1 pnpm exec vitest run --project node tests/unit/eval/LIFECYCLE-MIGRATION-ASSESSMENT-binding.test.ts` | 0 (5 tests) |
| `CI=1 pnpm exec vitest run --project node tests/unit/eval/CPU-DEFENSIVE-TACKLE-binding.test.ts` | 0 (16 tests) |
| `pnpm run gauntlet:audit -- --objective LIFECYCLE-MIGRATION-ASSESSMENT --class HEADLESS --tests-pass true --integration-test-pass true` | 0 (status PASS, see audit.json) |

## Pin inventory (every accepted artifact/trajectory/test that depends on the runner lifecycle)

Classification key: **legacy-dependent** = captured/consumes the `core-owned`→`legacy` split; **core-owned** = already captured under the corrected policy; **default-adopting** = captures rely on the runner `lifecyclePhaseSync` default (pre-restart-era pins, produced before the policy existed, effectively legacy).

### Group A — COMMON-FULL-MATCH-INVARIANT-TRIAGE runs (`docs/evidence/COMMON-FULL-MATCH-INVARIANT-TRIAGE/runs/*.json`)

| run_id | scenario | maxTicks | accepted lifecycle | COMMON-BOUNDS (legacy) | COMMON-BOUNDS (core-owned) | byte-identical under core-owned | first divergence tick | outcome |
|---|---|---|---|---|---|---|---|---|
| anti-huddle-flowing | 5v5-continuous-play | 1800 | legacy (default) | FAIL | **PASS** | false | 404 | (b) |
| ball-settled-flowing | 5v5-continuous-play | 1200 | legacy (default) | FAIL | **PASS** | false | 404 | (b) |
| gk-continuous-live | 5v5-continuous-play | 1800 | legacy (explicit) | FAIL | **PASS** | false | 176 | (b) |
| gk-shot-fixture-live | 5v5-keeper-shot-fixture | 600 | legacy (explicit) | FAIL | FAIL | false | 300 | (b) |
| human-duel | 5v5-human-vs-cpu | 120 | legacy (explicit) | PASS | PASS | expected (no restart window; ball stays in bounds, maxBallAbsX≈3.19) | n/a | (a)/(b) n/a |
| restart-corner | 5v5-continuous-play | 1800 | core-owned | PASS | PASS | — | — | core-owned |
| restart-goalkick-postgoal | 5v5-restart-arc | 1800 | core-owned | PASS | PASS | — | — | core-owned |
| restart-throwin | 5v5-restart-throwin | 1800 | core-owned | PASS | PASS | — | — | core-owned |

The four legacy runs (anti-huddle-flowing, ball-settled-flowing, gk-continuous-live, gk-shot-fixture-live) are the **legacy-dependent set** that carry the COMMON-BOUNDS residual.

### Group B — POSSESSION-ORACLE-REFERENCE-TRIAGE runs (`docs/evidence/POSSESSION-ORACLE-REFERENCE-TRIAGE/runs/*.json`)

anti-huddle-flowing, ball-settled-flowing, gk-continuous-live use the **same scenarios/opts** as Group A (legacy-dependent, identical divergence). restart-corner is core-owned. Same classification as Group A.

### Group C — GK-suite records (`GK-SUITE-ORGANIC-STATE`, `GK-SUITE-VERDICTS-STATE`, `GK-KEEPER-ORACLE-REGISTRATION`)

These records reproduce the `gk-continuous-live` (1800) and `gk-shot-fixture-live` (600) runs under `lifecyclePhaseSync: "legacy"` (explicit). They are legacy-dependent via the same two runs as Group A; their accepted records are byte-untouched and remain reproducible under the explicit opt-out.

### Group D — legacy-captured producers (pre-restart-era / historical-policy-captured)

| producer | driver | lifecycle source | impact under migration |
|---|---|---|---|
| 5V5-KICKOFF-ANTI-HUDDLE | `runAntiHuddleMatch` → `runHeadlessMatch` | default | captured under legacy default; accepted trajectory byte-untouched; reproduces differently under the new default (a restart window may open). |
| BALL-SETTLED-REGIME-FIX | `runHeadlessMatch` (+ ball-system) | default | legacy default; accepted trajectory byte-untouched; reproduces differently under new default. |
| CPU-DEFENSIVE-TACKLE | `runCpuTackleMatch` → `runHeadlessMatch` | driver own explicit `"legacy"` default | preserved by the driver's own legacy opt-out, independent of the headless default flip. The accepted `CPU-DEFENSIVE-TACKLE/trajectory.json` (`3v3-cpu-vs-cpu`, `5v5-cpu-vs-cpu`, `3v3-cpu-vs-cpu-extended`) stays byte-reproducible. |
| GK-5V5-ADAPTER-BEHAVIOR | `runGkMatch` | gk-match own default (`"legacy"`) | unaffected by the headless default flip. |
| RESTART-ANTI-HUDDLE-COHERENCE | `restart-anti-huddle-match` | explicit `"core-owned"` | already core-owned. |
| DUELS-SUITE-ORGANIC-RERUN | `runHeadlessMatch` | explicit `"core-owned"` | already core-owned. |
| GK-DISTRIBUTION-BEHAVIOR | `runHeadlessMatch` | `core-owned` | already core-owned. |

## Empirical byte-identity probe (`scripts/capture-lifecycle-migration-assessment.ts`)

For each legacy-dependent run the probe re-runs the capture/evaluator path under **both** policies and compares the per-tick state hash chain (byte-for-byte), the core match-phase sequence, and the protected COMMON criteria.

| pin | legacy state-hash-chain | core-owned state-hash-chain | byte-identical | legacy restart-phase ticks | core-owned restart-phase ticks | COMMON-BOUNDS legacy→core |
|---|---|---|---|---|---|---|
| anti-huddle-flowing | `d9f5…` (see probe JSON) | differs | **false** | 2 | 61 | FAIL → PASS |
| ball-settled-flowing | (see probe JSON) | differs | **false** | 2 | 61 | FAIL → PASS |
| gk-continuous-live | (see probe JSON) | differs | **false** | 4 | 121 | FAIL → PASS |
| gk-shot-fixture-live | (see probe JSON) | differs | **false** | 3 | 61 | FAIL → FAIL (core maxPlayerAbsX=52.53 m, marginally over 52.5 m) |

Exact per-tick numbers are in `docs/evidence/LIFECYCLE-MIGRATION-ASSESSMENT/probes/<run_id>.json`.

**Root-cause confirmation of the delta:** under legacy the runner rewrites the core's matchPhase to its own derived label on every tick, so a restart window opened by the core (ball-out-of-play → corridor/goal-kick/throw-in, or a post-goal `/` halftime reset) is immediately overwritten to `"playing"` on the next tick and its countdown never completes. Under core-owned the runner only seeds the opening kickoff and stamps the terminal fulltime, so the core's restart machinery runs exactly as in the browser. The state-hash chain therefore diverges at the first such window, and the ball is (or is not) reset from there. `COMMON-REFERENCES` and `COMMON-FINITE` stay PASS on both policies (the delta is not a references/finite change).

## Tests run (names + counts)

- `tests/unit/eval/LIFECYCLE-MIGRATION-ASSESSMENT-binding.test.ts` — **5 tests, PASS** (locks the migration).
- `tests/integration/match-scoring.test.ts` (28), `match-set-piece.test.ts` (11), `headless-match.test.ts` (28), `match-lifecycle.test.ts` (31) — **98 tests, PASS**.
- `tests/unit/eval/COMMON-FULL-MATCH-INVARIANT-TRIAGE-guard.test.ts` (3), `tests/unit/2v2-scoring.test.ts` (31), `2v2-scoring-long-{a,b,c}.test.ts` (3) — **37 tests, PASS**.
- `tests/integration/replay-match.test.ts` (3), `5v5-kickoff-anti-huddle.test.ts` (…), `ball-settled-regime-match.test.ts` (…) — **31 tests, PASS**.
- `tests/unit/eval/SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-{1-geometry,2-trajectory,3-guard-proof}.test.ts` + `SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE-binding.test.ts` — **22 tests, PASS**.
- `tests/unit/eval/GK-SUITE-ORGANIC-STATE-binding.test.ts` + `GK-SUITE-VERDICTS-STATE-binding.test.ts` — **19 tests, PASS** (explicit `"legacy"` opt-out still yields the pinned COMMON-BOUNDS FAIL).
- `tests/evidence-sanity.node.test.ts`, `tests/capture-hygiene.node.test.ts`, `tests/candidate-scope.node.test.ts`, `tests/eval-result-lifecycle.node.test.ts` — **10 tests, PASS**.
- `tests/architecture/*` — **27 tests, PASS**.
- `tests/unit/eval/CPU-DEFENSIVE-TACKLE-binding.test.ts` — **16 tests, PASS** (extended to lock that `runCpuTackleMatch` passes the explicit legacy policy; a `core-owned` re-run of the pinned 3v3 configuration diverges from the accepted pin).

**Total verified green: 265 tests** (the 249-runner-consumer/hygiene/architecture matrix + the 16 CPU-DEFENSIVE-TACKLE binding tests) under the migrated default. The `CPU-DEFENSIVE-TACKLE/trajectory.json` accepted pin is preserved byte-reproducible by the `runCpuTackleMatch` explicit `"legacy"` default.

## Integration test result

`--integration-test-pass true` (see gauntlet:audit verdict below). The affected integration suites all pass under the migrated default.

## Files changed

- `eval/runners/headless-match.ts` — `lifecyclePhaseSync` default `legacy` → `core-owned`; exported `DEFAULT_LIFECYCLE_PHASE_SYNC = "core-owned"` and used as the destructuring default; doc-comment updated. `src/simulation/` and `src/contracts/` are byte-identical (git diff EMPTY).
- `eval/runners/cpu-tackle-match.ts` — thread `lifecyclePhaseSync` into `runHeadlessMatch` with a driver-own `"legacy"` default (mirroring gk-match), so the accepted `CPU-DEFENSIVE-TACKLE` pin is preserved independent of the headless default flip.
- `scripts/capture-common-full-match-triage.ts` — pin the two historical default-consuming runs (`anti-huddle-flowing`, `ball-settled-flowing`) to an explicit `lifecyclePhaseSync: "legacy"` so the accepted records stay byte-reproducible under the new default.
- `scripts/capture-lifecycle-migration-assessment.ts` — NEW reproducible probe.
- `docs/evidence/LIFECYCLE-MIGRATION-ASSESSMENT/` — NEW evidence (RESULT.md, audit.json, decision.json, probes/*.json); RESULT.md and decision.json name the CPU-DEFENSIVE-TACKLE opt-out too.
- `tests/unit/eval/LIFECYCLE-MIGRATION-ASSESSMENT-binding.test.ts` — NEW binding test (extended to require the CPU-DEFENSIVE-TACKLE opt-out runs in the durable decision record).
- `tests/unit/eval/CPU-DEFENSIVE-TACKLE-binding.test.ts` — extend the hash-pin test to lock that `runCpuTackleMatch` passes the explicit legacy policy (a `core-owned` re-run of the pinned 3v3 config diverges from the accepted pin).
- `specs/MATCH_RULES_SPEC.md` — correct the §4 lifecycle-prose sentence stating the legacy policy "is preserved as the default" to state the runner default IS `core-owned` as of LIFECYCLE-MIGRATION-ASSESSMENT, with `"legacy"` retained as the explicit opt-out for historical pin reproductions (one-line provenance note). This is a factual staleness correction caused by the migration, not the objective's deliverable.

## Determinism

Two-run determinism holds for the migrated (core-owned) default: `HEADLESS-MATCH-003` ("two runs with same scenario produce identical state hashes/events/observations") passes under the core-owned default. The probe's phase-sync selection is deterministic (no randomness).

## COMMON-BOUNDS outcome on the formerly-legacy runs

- **Turns green (FAIL → PASS)** under core-owned for anti-huddle-flowing, ball-settled-flowing, gk-continuous-live (the legacy ball-out-of-play escape is removed; the ball no longer runs past the goal line, `maxBallAbsX` drops to the pitch area).
- **Stays FAIL (redisclosed)** under core-owned for gk-shot-fixture-live: a defending body ends at `|x| = 52.53 m`, marginally over the declared `maxX = 52.5 m` safety bound (the ball does **not** escape; `maxBallAbsX` drops 59.90 → 52.63 m). This is a marginal goal-line-position artifact, **not** the legacy out-of-play escape, and is disclosed rather than widened.
- The accepted COMMON-FULL-MATCH-INVARIANT-TRIAGE records are byte-untouched and still document the legacy FAIL; they are reproduced under the explicit `"legacy"` opt-out.

## Disclosures / claims not made

- No claim that the migration is byte-identity-preserving: the four legacy pins are **not** byte-identical under core-owned (proven per-pin). They are classification (b) (deltas = exactly the documented restart-window behavior).
- **Full node suite not run to completion within the ~300 s host cap** (the node suite alone exceeds 300 s). The runner-consumer suites (those that exercise `runHeadlessMatch` or a driver built on it) plus the evidence-sanity/hygiene/architecture suites are verified green under the migrated default: **230 tests** (Integration 129 + eval/unit runner-consumers 59 + binding 5 + meta 10 + architecture 27), plus **19 GK-suite binding tests** that exercise the explicit `"legacy"` opt-out = **249 total**, and the **CPU-DEFENSIVE-TACKLE binding suite (16 tests)** is additionally verified green under the same migrated default.
- **Corrected consumer inventory.** The prior claim that the un-run remainder "does not consume the `runHeadlessMatch` default (it tests adapters/scenarios/contracts directly)" was **false** (the critic's verified finding). `CPU-DEFENSIVE-TACKLE-binding.test.ts` consumes the lifecycle policy via `runCpuTackleMatch`, which at review time inherited the migrated default and broke the accepted pin (15/16). The honest inventory, with every consumer named:
  - **CPU-DEFENSIVE-TACKLE** — `runCpuTackleMatch` own explicit `"legacy"` default (mirroring gk-match), independent of the headless default flip. Accepted `CPU-DEFENSIVE-TACKLE/trajectory.json` stays byte-reproducible.
  - **GK-5V5-ADAPTER-BEHAVIOR** — uses `runGkMatch`'s own legacy default; unaffected by the headless default flip.
  - **RESTART-ANTI-HUDDLE-COHERENCE**, **DUELS-SUITE-ORGANIC-RERUN**, **GK-DISTRIBUTION-BEHAVIOR** — explicit `"core-owned"`.
  - **5V5-KICKOFF-ANTI-HUDDLE**, **BALL-SETTLED-REGIME-FIX** — rely on the runner default (now `core-owned`); their accepted records are reproduced via the `scripts/capture-common-full-match-triage.ts` explicit legacy opt-out.
  - The remaining un-run files (`tests/unit/{cpu-adapter,scenario,contracts}` and the remainder of the eval suite) were verified clean: they test adapters/scenarios/contracts directly and do not invoke `runHeadlessMatch` or a driver built on it.
- No PROMOTION claim, no PES 2017 fidelity / measured-envelope claim, no FOUNDATION_LAB_PASS claim.
- No test weakening: all new tests are additive, no skip/todo/only.
- `git diff src/simulation/ src/contracts/` is EMPTY — no gameplay change.
- **Spec touch (disclosed):** `specs/MATCH_RULES_SPEC.md` §4 lifecycle-prose sentence was corrected to state the runner default IS `core-owned` as of LIFECYCLE-MIGRATION-ASSESSMENT, with `"legacy"` retained as the explicit opt-out for historical pin reproductions (one-line provenance note). This is a factual staleness correction caused by the migration (the §4 sentence previously claimed `legacy` "is preserved as the default"), not the objective's deliverable; no other spec text was touched.
- The `gk-shot-fixture-live` COMMON-BOUNDS residual under core-owned is redisclosed, not hidden or widened.
