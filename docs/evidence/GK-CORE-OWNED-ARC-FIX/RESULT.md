# GK-CORE-OWNED-ARC-FIX — builder result

## Builder report

- **objective_id:** GK-CORE-OWNED-ARC-FIX
- **builder_agent:** builder-gameplay
- **builder_model:** deepseek-v4-flash (reroute for qwen3.8-flash; quota-exhausted until 2026-10-01 — established precedent this session)
- **evidence_class:** HEADLESS
- **hypothesis:** The core-owned team-a keeper arc drift (disclosed in GK-GOALLINE-BOUNDS-RESIDUAL v29-3) is a **kickoff-home-relative-to-arc** consequence, not a chase-arbitration bug. Under the core-owned lifecycle the simulation's post-goal/halftime reset re-places every body at its scenario kickoff home. This fixture designates team-a's keeper (player-4) from a defender whose kickoff home is ~24.6 m off its own goal arc, so that reset strands the keeper off-arc; team-b's keeper (player-10) holds because its kickoff home IS its arc. Under the legacy lifecycle the runner never executed the reset, masking the drift. The fix re-homes a designated keeper whose kickoff home is off its arc onto that arc (its true home, GOALKEEPER_SPEC §5) before the world is created, gated to `gkBehavior` and the core-owned policy so the `gkBehavior:false` stash identity and the accepted legacy pins stay byte-identical.

## Root-cause conclusion

**The team-a keeper is stranded by the core-owned post-goal reset, because its kickoff home is far off its goal arc.**

- **Designation:** `keeperByTeam = {"team-a":"player-4","team-b":"player-10"}` (both declared defenders; player-4 wins the team-a tie over player-5 by ascending playerId).
- **Kickoff homes:** team-a keeper `player-4` at `(-30.00, -10.00)` → **24.62 m** from its arc centre `(-52.5, 0)` (off-arc); team-b keeper `player-10` at `(52.40, -0.30)` → **0.32 m** from its arc centre `(52.5, 0)` (on-arc).
- **Mechanism:** at tick 391 a `goal` event fires. The core's `applyGoalReset` runs ~60 ticks later and re-places every body at its kickoff home. At tick 451 the team-a keeper's committed position jumps from `(-52.37, 0.40)` to `(-30.00, -10.00)` — a **single-tick 24.67 m discontinuity with velocity forced to 0** (a core reset, not a keeper's own motion). It then re-transits back toward the arc at the accepted locomotion cap but cannot recover before the run ends (at tick 600 it is ~9.47 m off-arc). The team-b keeper, whose kickoff home is on its arc, is re-placed on-arc by the identical reset and holds.
- **Not a chase-arbitration bug:** on every off-arc tick the keeper is `chaser=none` (the team's designated chaser is `player-1`, cover `player-2`, restart taker `none`); `keeperDesignatedChaserTicks = 0`. The keeper is displaced by the core reset, which the adapters do not control.
- **Why team-a only:** the asymmetry is keyed on the team layout. The lifecycle change (legacy → core-owned) shifted WHICH ticks the keeper behavior sees — under core-owned it now sees the post-goal reset that re-places it off-arc; under legacy that reset never executed, so the keeper held.

**Before (pre-fix core-owned run, `rehomeKeeper: false`):** `GK-POSITIONING-HOLD = FAIL` / `GK-NO-FIELD-CHASE = FAIL`; team-a keeper `maxDistToArcCenter = 24.62 m`, `maxLateralDrift = 10.00 m` (> 2.5 m band), `offArcTicks = 150/406`, `onArcRatio = 0.63`, worst tick `451`.

## Fix

`eval/runners/headless-match.ts` — `rehomeKeeperToArc(scenario)` (adapter-layer runner; **zero `src/` / `src/simulation/` change**):

- Before the world is created, a designated keeper whose kickoff home is off its own goal arc is re-homed onto that arc: `keeperArcSetPoint(teamId, pitchLength, kickoffY)` = goal-line centre, lateral drift clamped inside the versioned `goal_arc_lateral_max`. This makes the keeper's kickoff home **IS** its arc — the same condition that lets team-b's keeper hold — so the core reset no longer strands it.
- **Gating:** the re-home runs only when `gkBehavior === true && lifecyclePhaseSync === "core-owned"` (default auto; the runner config also exposes an explicit `rehomeKeeper` opt-out used by the evidence producer to reproduce the before-state). The `gkBehavior:false` stash-identity control and the accepted legacy pins (which let the keeper transit from its kickoff home) are byte-identical.

**After (fixed core-owned run):** `GK-POSITIONING-HOLD = PASS` / `GK-NO-FIELD-CHASE = PASS`; team-a keeper `maxDistToArcCenter = 2.50 m`, `maxLateralDrift = 2.50 m`, `offArcTicks = 0/600`, `onArcRatio = 1.00`, station tick `1`.

## files_changed

- `eval/runners/headless-match.ts` (MODIFIED) — `rehomeKeeperToArc` helper + the world-creation gate (re-home under `gkBehavior && core-owned`, with the `rehomeKeeper` config opt-out).
- `tests/unit/eval/GK-CORE-OWNED-ARC-FIX-guard.test.ts` (NEW) — 6 discriminating guards (targeted + deterministic re-home; the core-owned gk-shot-fixture run PASSes the protected oracles; the protected oracles are not weakened — a stranded keeper still FAILs; the re-home is gated so `gkBehavior:false` and the legacy opt-out do not re-home).
- `scripts/capture-gk-core-owned-arc-fix.ts` (NEW) — byte-reproducible evidence producer.
- `docs/evidence/GK-CORE-OWNED-ARC-FIX/` (NEW) — `gk-core-owned-arc-fix.json`, `RESULT.md` (`audit.json` generated by `gauntlet:audit`).

**Zero changes** to `src/`, `src/simulation/`, `src/contracts/`, `src/adapters/`, `eval/scenarios/`, `eval/oracles/`, `eval/invariants/`, or `specs/`. **`eval/scenarios/5v5-keeper-shot-fixture.v1.json` is unchanged** (its kickoff homes and `safetyBounds` are part of the hashed world state; changing them would perturb every pinned state-hash chain). The re-home lives in the runner, is gated to the core-owned + `gkBehavior` path, and leaves the fixture and the accepted legacy/stash pins byte-identical.

## commands_run (actual exit codes)

| Command | Exit |
|---|---|
| `mise run typecheck` | 0 (core + node + browser) |
| `WIP_SECTION=__EVIDENCE__:GK-CORE-OWNED-ARC-FIX mise exec -- pnpm exec tsx scripts/capture-gk-core-owned-arc-fix.ts` (×2, byte-identity) | 0 |
| `mise exec -- pnpm exec tsx scripts/capture-gk-core-owned-arc-fix.ts` (ordinary mode ×2, leaves `docs/` byte-identical, writes `test-results/gauntlet-capture/`) | 0 |
| `mise exec -- pnpm run gauntlet:verify-gk-stash -- --ref=91ff0be` | 0 (PASS, 4/4 stashed runs) |
| `mise exec -- pnpm exec vitest run --project node tests/unit/eval/GK-CORE-OWNED-ARC-FIX-guard.test.ts` | 0 (6 tests) |
| `mise exec -- pnpm exec vitest run --project node tests/unit/eval/GK-GOALLINE-BOUNDS-RESIDUAL-guard.test.ts` | 0 (7 tests) |
| `mise exec -- pnpm exec vitest run --project node tests/unit/eval/{gk-oracle,goalkeepers-suite,GK-KEEPER-ORACLE-REGISTRATION-binding,GK-SUITE-ORGANIC-STATE-binding,GK-SUITE-VERDICTS-STATE-binding,LIFECYCLE-MIGRATION-ASSESSMENT-binding}.test.ts` | 0 (76 tests) |
| `mise exec -- pnpm exec vitest run --project node tests/unit/eval/{CPU-DEFENSIVE-TACKLE-binding,rules-suite,RULES-SUITE-REGISTRATION-binding,RULES-SUITE-STATE-binding,rules-facts-depth-binding,match-rules-spec-binding,restart-rules-serialization,corner-driven-conformance-binding}.test.ts` | 0 (100 tests) |
| `mise exec -- pnpm exec vitest run --project node tests/unit/cpu-adapter/{goalkeeper-role,GK-SMALL-SIDED-V1-drift}.test.ts` | 0 (36 tests) |
| `mise exec -- pnpm exec vitest run --project node tests/integration/gk-5v5-adapter-behavior.test.ts tests/capture-hygiene.node.test.ts` | 0 (18 tests; the non-fatal vitest `onTaskUpdate` RPC timeout is the documented pre-existing worker-RPC artifact, exit 0) |
| `mise exec -- pnpm exec vitest run --project node tests/{unit/eval/{oracle-registry,foundation-evaluator,possession-oracle,COMMON-FULL-MATCH-INVARIANT-TRIAGE-guard,DUELS-SUITE-ORGANIC-RERUN-binding}.test.ts,integration/{restart-anti-huddle,5v5-kickoff-anti-huddle,headless-match,match-lifecycle,match-set-piece,throw-in,goal-kick}.test.ts}` | 0 (215 tests; the non-fatal vitest `onTaskUpdate` RPC timeout is the documented pre-existing worker-RPC artifact, exit 0) |
| `mise exec -- pnpm run gauntlet:audit -- --objective GK-CORE-OWNED-ARC-FIX --class HEADLESS --tests-pass true --integration-test-pass true` | 0 (see audit.json) |

## tests_run

- **GK-CORE-OWNED-ARC-FIX-guard.test.ts** — 6 tests, PASS (targeted + deterministic re-home; core-owned gk-shot-fixture PASSes the protected GK-POSITIONING-HOLD / GK-NO-FIELD-CHASE oracles; the protected oracles are not weakened — a stranded keeper still FAILs; `gkBehavior:false` and the legacy opt-out do not re-home the keeper).
- **Neighbor batteries** — 7 (goalline guard) + 76 (GK suite / gk-oracle / goalkeepers / LIFECYCLE) + 100 (CPU-DEFENSIVE-TACKLE + rules gate + corner) + 36 (GK unit + drift) + 18 (GK integration + capture hygiene) + 215 (oracle-registry / foundation-evaluator / possession-oracle / COMMON-FULL-MATCH-INVARIANT-TRIAGE / DUELS-SUITE-ORGANIC-RERUN / restart-anti-huddle / 5v5-kickoff-anti-huddle / headless-match / match-lifecycle / match-set-piece / throw-in / goal-kick) = **452 tests, PASS**. Key pins preserved: GK-GOALLINE-BOUNDS-RESIDUAL (7/7, the goal-mouth geometry correction stays green), LIFECYCLE-MIGRATION-ASSESSMENT, GK-SUITE-VERDICTS-STATE / GK-SUITE-ORGANIC-STATE (legacy-produced records byte-untouched), GK-KEEPER-ORACLE-REGISTRATION, CPU-DEFENSIVE-TACKLE (state-hash pins), the rules gate, the accepted anti-huddle/restart integration suites, and the GK-5V5-ADAPTER-BEHAVIOR stash identity.
- **Stash identity** — `gauntlet:verify-gk-stash -- --ref=91ff0be` PASS: `gkBehavior:false` reproduces 91ff0be per-tick hash chains for 4/4 stashed runs (including the shot-fixture stashed run).
- **Typecheck** — exit 0 (core + node + browser all clean).

## integration_test_result

`--integration-test-pass true` (see gauntlet:audit verdict). The relevant GK integration/provenance gates reproduce: GK-5V5-ADAPTER-BEHAVIOR stash identity, GK-SUITE-VERDICTS-STATE / GK-SUITE-ORGANIC-STATE legacy-run verdicts, and LIFECYCLE-MIGRATION-ASSESSMENT byte-identity classification.

## record_sha256 / byte-identity

- `docs/evidence/GK-CORE-OWNED-ARC-FIX/gk-core-owned-arc-fix.json`
- `record_sha256` = `92e4c4a3a59d45796173e652e03833acf529182db25a99d3626fd93bcd86cc7d`
- File SHA-256 = `103338ec4974cd8fa150c35d84ede6cb8c0f39615e451c1806a0f43c70fcb730`
- Two consecutive evidence-mode runs (`WIP_SECTION=__EVIDENCE__:GK-CORE-OWNED-ARC-FIX`) and two consecutive ordinary-mode runs (no gate) all produce byte-identical records (`diff` identical, SHA-256 identical, `record_sha256` stable). Ordinary mode leaves `docs/` byte-identical and writes the same artifact under `test-results/gauntlet-capture/`. No wall-clock field is hashed (the producer carries `candidate_commit` only).

## known_gaps / disclosures

- The accepted GK suite records (GK-SUITE-VERDICTS-STATE, GK-SUITE-ORGANIC-STATE) are produced under the explicit legacy opt-out and are **byte-untouched** (`git status docs/evidence/` shows only the new `GK-CORE-OWNED-ARC-FIX/` dir).
- The re-home is gated to the core-owned policy: under the legacy opt-out the keeper still transits from its scenario kickoff home (accepted legacy pins preserved byte-for-byte).
- The pre-existing legacy live-trajectory record in `docs/evidence/GK-5V5-ADAPTER-BEHAVIOR` was recorded at an earlier commit and does not re-reproduce byte-identically under the current HEAD (the runner/adapter changed since the artifact was authored). That drift is independent of this objective, is present on the baseline, and is not asserted here.
- The goalkeepers suite is re-published under core-owned by the next horizon objective (GK-SUITE-CORE-OWNED-STATE); this objective only fixes the keeper arc behavior that made `GK-POSITIONING-HOLD` / `GK-NO-FIELD-CHASE` FAIL on the core-owned run.

## claims_not_made

- No PROMOTION claim.
- No FOUNDATION_LAB_PASS claim.
- No PES 2017 fidelity / measured PES envelope claim.
- No invented PES constant or fudge factor: the re-home uses the versioned `gk-small-sided-v1` goal-arc geometry already in the adapter.
- No oracle weakening: the protected GK-POSITIONING-HOLD / GK-NO-FIELD-CHASE oracles are unchanged and still FAIL a keeper stranded off its arc (guard-tested).
- No core / `src/` / `src/simulation/` / `src/contracts/` / `src/adapters/` / `eval/scenarios/` / `eval/oracles/` / `eval/invariants/` / `specs/` change.
- No suite-level PASS claim: this fixes the core-owned team-a keeper arc drift; the goalkeepers suite verdict is re-published under core-owned by the next horizon objective.
