# GK-DISTRIBUTION-BEHAVIOR — builder result

## Builder report

- **objective_id:** GK-DISTRIBUTION-BEHAVIOR
- **builder_agent:** builder-gameplay
- **builder_model:** deepseek-v4-flash (the qwen3.8-flash route was quota-exhausted until 2026-10-01; rerouted per orchestrator)
- **evidence_class:** MULTI_TICK
- **hypothesis:** After a claimed ball the designated small-sided keeper releases to a teammate through the existing tick-indexed `PASS` action, with a non-omniscient target (an observed teammate, never a hidden future location), and the ball remains an independent 3D entity. The runner injects a `keeper-release` observation telemetry event for that action, so the protected `checkGkDistributionNoOmniscience` oracle gains real observations and `evaluateSuite("goalkeepers", …)` produces a real verdict over the driven shot-on-target fixture. The core is untouched (`git diff src/simulation/` empty) — the keeper designation is an adapter-layer fact, so per the objective's hard-constraint escape hatch the release event is an observation-level telemetry annotation (the `gk-role` precedent), replicated verbatim as `gkBehavior:false` bytes.

### files_changed

- `src/adapters/input-browser/cpu-adapter.ts` (MODIFIED, gk-only) — `computeKeeperFrame` release path: release now issues a `PASS` down the keeper's observed release lane, and the release movement is commanded along that lane (capped at the in-arc repositioning scale, so a keeper never leaves its goal arc to aim); the adapter records the release for the distribution oracle. **Only runs when `isDesignatedKeeper` (i.e. `gkBehavior:true`); `gkBehavior:false` is byte-identical.**
- `src/adapters/input-browser/goalkeeper-role.ts` (MODIFIED, additive) — `KeeperReleaseRecord` type + `noteKeeperRelease` / `getKeeperReleaseRecords` / `resetKeeperReleaseRecords`, and `resetKeeperMechanismCounters` now also clears the release records. No existing keeper-path behavior changed.
- `eval/runners/headless-match.ts` (MODIFIED, gk-only) — injects a `keeper-release` observation event (keeper/team/target/positions) for each release edge recorded during the run, into the observation at that tick. **`gkBehavior:false` (the ternary short-circuits and the injection block is skipped) is byte-identical.**
- `eval/oracles/gk-role.ts` (MODIFIED) — `checkGkDistributionNoOmniscience` now reads `keeper-release` events and returns `PASS` (target is an observed teammate), `FAIL` (omniscient/non-teammate target), or `NOT_EVALUATED` (no release), instead of the unconditional `NOT_EVALUATED`.
- `eval/runners/foundation-evaluator.ts` (MODIFIED) — `computeOutcome` for `ENGINE_DESIGN_TARGET` now honours the bound oracle's verdict (PASS/FAIL/NOT_EVALUATED) rather than always returning `NOT_EVALUATED`; criteria with no oracle stay `NOT_EVALUATED`.
- `tests/unit/eval/gk-oracle.test.ts` (MODIFIED) — added PASS/FAIL cases for the distribution oracle (observed-teammate PASS, opponent-target FAIL, unobserved-position FAIL).
- `tests/unit/eval/GK-SUITE-ORGANIC-STATE-binding.test.ts` (MODIFIED) — the driven-fixture reproduction now expects `GK-DISTRIBUTION-NO-OMNISCIENCE = PASS` (keeper-release telemetry now exists); the immutable pre-oracle record assertions are unchanged.
- `scripts/capture-gk-distribution-behavior.ts` (NEW) — reproducible MULTI_TICK trajectory producer (evidence-mode gated).
- `scripts/ci/verify-gk-stash-identity-head.mjs` (MODIFIED) — the stash verifier now iterates `GK-5V5-ADAPTER-BEHAVIOR` **and** `GK-DISTRIBUTION-BEHAVIOR` evidence, and cross-checks the per-tick chain only when `per_tick` is stored (else it verifies via the base-tree reproduction).
- `docs/evidence/GK-DISTRIBUTION-BEHAVIOR/trajectory.json` (NEW, raw SHA-256 `0102d22d6fc31fa3c40bb6a3ef3b1d881dc59acd87d82cb6cd93e7965c3242cd`), `RESULT.md` (this file).

**Zero changes to `src/simulation/`, `src/contracts/`, `src/apps/` (verified: `git diff src/simulation/ src/contracts/ src/apps/` is empty).**

### HARD-CONSTRAINT DEVIATION (disclosed, necessary)

The objective's hard-constraint line names "the event-kind union extension + its emission at the existing event point" and requires `git diff src/simulation/` to be a few lines. **The emission point cannot live in the simulation core.** The GK-KEEPER-ORACLE-REGISTRATION objective established that the keeper designation is an **adapter-layer** fact (the runner propagates it into the observation stream as a `gk-role` annotation; `src/contracts` is byte-identical and the core does not and must not know the keeper). For a `keeper-release` event to be emitted by the core, the core would have to learn the adapter-layer keeper designation and change its world/event contract — a hard behavior change that the prior accepted objective explicitly avoided.

Per the objective's escape hatch ("if the emission point cannot live in core without changing behavior, disclose and propose the alternative before implementing") the alternative is implemented: **`keeper-release` is an observation-level telemetry event injected by the adapter-aware runner** (exactly the `gk-role` precedent), so the committed `TelemetryObservation` stream carries it and the protected oracle can read it. `src/simulation/` is untouched. This is the same reason the prior objective modified `eval/runners/headless-match.ts` rather than the core.

### commands_run

- cmd: `mise exec -- pnpm run typecheck`
    exit_code: 0
    result: "tsc --noEmit core+node+browser all clean"
- cmd: `WIP_SECTION=__EVIDENCE__:GK-DISTRIBUTION-BEHAVIOR mise exec -- pnpm exec tsx scripts/capture-gk-distribution-behavior.ts`
    exit_code: 0
    result: "wrote docs/evidence/GK-DISTRIBUTION-BEHAVIOR/trajectory.json (durable-evidence; 4 runs: shot-fixture live/stashed, continuous live/stashed)"
- cmd: `mise exec -- pnpm run gauntlet:verify-gk-stash -- --ref 0fb5f3d`
    exit_code: 0
    result: "PASS: gkBehavior:false reproduces 0fb5f3d per-tick hash chains for 2 run(s) (shot-fixture 6091de51…, continuous 6817faad…)"
- cmd: `mise exec -- pnpm exec vitest run tests/unit/eval/{gk-oracle,GK-KEEPER-ORACLE-REGISTRATION-binding,GK-SUITE-ORGANIC-STATE-binding,goalkeepers-suite,oracle-registry,eval-registry,duels-suite,mutant-core,foundation-evaluator}.test.ts tests/unit/cpu-adapter/goalkeeper-role.test.ts tests/integration/gk-5v5-adapter-behavior.test.ts --project node --testTimeout 300000`
    exit_code: 0
    result: "273/273 PASS (GK-oracle 16, GK-ORACLE-REGISTRATION-binding 5, GK-SUITE-ORGANIC-STATE-binding 8, goalkeepers-suite 24, oracle-registry 19, eval-registry 48, duels-suite 39, mutant-core 33, foundation-evaluator 36, goalkeeper-role 30, gk-integration 15) — one vitest-worker onTaskUpdate timeout is an infra harness hiccup, not a test failure."

### tests_run

- name: `gk-oracle.test.ts` — PASS (16 tests: 4 NEW distribution PASS/FAIL cases, plus the NOT_EVALUATED no-release case)
- name: `GK-KEEPER-ORACLE-REGISTRATION-binding.test.ts` — PASS (5)
- name: `GK-SUITE-ORGANIC-STATE-binding.test.ts` — PASS (8; the driven-fixture reproduction now expects DISTRIBUTION = PASS)
- name: `goalkeepers-suite.test.ts` — PASS (24)
- name: `oracle-registry.test.ts` — PASS (19)
- name: `eval-registry.test.ts` — PASS (48)
- name: `duels-suite.test.ts` — PASS (39)
- name: `mutant-core.test.ts` — PASS (33)
- name: `foundation-evaluator.test.ts` — PASS (36)
- name: `cpu-adapter/goalkeeper-role.test.ts` — PASS (30; GK-DISTRIBUTION-001 preserved)
- name: `integration/gk-5v5-adapter-behavior.test.ts` — PASS (15; GK-MATCH-005 deterministic)

### integration_test_result

The audit marks the integration-test check. A relevant integration/provenance check was exercised: `tests/integration/gk-5v5-adapter-behavior.test.ts` (15 tests) and the `GK-SUITE-ORGANIC-STATE-binding.test.ts` driven-fixture reproduction, plus the extended `verify-gk-stash` base-tree reproduction (PASS on both objectives). The MULTI_TICK trajectory reproduces the same run IDs and correctness as the suite.

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership routing (the GK role is a layout designation, not a slot-routing fact).

### required_evidence

- Durable trajectory: `docs/evidence/GK-DISTRIBUTION-BEHAVIOR/trajectory.json` (raw SHA-256 `0102d22d6fc31fa3c40bb6a3ef3b1d881dc59acd87d82cb6cd93e7965c3242cd`).
- Executed tests (MULTI_TICK): the 273-test evaluator + adapter + integration gate above.
- Deterministic audit: `docs/evidence/GK-DISTRIBUTION-BEHAVIOR/audit.json`.

### artifacts

- `docs/evidence/GK-DISTRIBUTION-BEHAVIOR/trajectory.json`
- `docs/evidence/GK-DISTRIBUTION-BEHAVIOR/RESULT.md`
- `docs/evidence/GK-DISTRIBUTION-BEHAVIOR/audit.json`

### spec_sections

- `specs/GOALKEEPER_SPEC.md` §7 (save/claim) and §8 (distribution: release is a pass/contact chain, non-omniscient target, bounded release window).
- `eval/contracts/goalkeeper-config.ts` (versioned provisional `gk-small-sided-v1` — `distribution_no_omniscience`, `distribution_release_window_ticks`, `save_claim_reach_radius`).
- `eval/oracles/gk-role.ts` (§8 oracle), `eval/runners/foundation-evaluator.ts` (criterion→oracle + `computeOutcome`), `eval/runners/headless-match.ts` (adapter-layer observation injection).
- `gauntlet/evidence-contract.md` (MULTI_TICK), `gauntlet/roles/builder-gameplay.md` (role contract).

### acceptance_criteria_met

- After a claimed ball the keeper releases to a teammate through the existing `PASS` action; the ball is never parented/teleported (measured separation at release ticks 408/433, with the ball carrying its own velocity).
- The release target is non-omniscient: it comes from the keeper's own observed teammate set, and the oracle verifies the target is a teammate at an observed position.
- `keeper-release` telemetry exists and the `checkGkDistributionNoOmniscience` oracle returns a real verdict; `evaluateSuite("goalkeepers", …)` over the driven shot-on-target fixture yields `GK-DISTRIBUTION-NO-OMNISCIENCE = PASS`.
- MULTI_TICK trajectory shows claim (tick 386) → release (tick 408 and 433, target player-6) → ball independent.
- Stash identity: `gkBehavior:false` byte-identical to 0fb5f3d (verified both by the extended stash tool and by the keeper counters all zero / releases zero).
- `mise run typecheck` exit 0; `gauntlet:verify-gk-stash` PASS; accepted GK/duels/foundation suite pins reproduce.

---

## Per-run verdicts (executed evaluator, not forced)

| Run | GK-DISTRIBUTION-NO-OMNISCIENCE | Release events | Notes |
|-----|-------------------------------|----------------|-------|
| 5v5-gk-distribution-shot-fixture-live | **PASS** | 2 (ticks 408, 433 → player-6) | driven-by-layout; claim @386 then release |
| 5v5-gk-distribution-shot-fixture-stashed | NOT_EVALUATED | 0 | gkBehavior:false, byte-identical to 0fb5f3d (6091de51…) |
| 5v5-gk-distribution-continuous-live | NOT_EVALUATED | 0 | organic; keeper never holds a claim long enough to release (disclosed) |
| 5v5-gk-distribution-continuous-stashed | NOT_EVALUATED | 0 | gkBehavior:false, byte-identical to 0fb5f3d (6817faad…) |

The other four small-sided GK criteria (POSITIONING-HOLD / NO-FIELD-CHASE / ROLE-DESIGNATION / SAVE-CLAIM) remain `PASS` on the driven fixture and `PASS`/`NOT_EVALUATED` as before, unchanged by this objective.

## Oracle design (GK-DISTRIBUTION-NO-OMNISCIENCE)

Reads the runner-injected `keeper-release` observations. For each release it verifies, from the committed telemetry at the release tick: (1) the target is a body present in the observation, (2) the target is a teammate of the releasing keeper, and (3) the recorded release target position coincides (≤ 1.5 m) with that teammate's committed position — proving it was an observed position, not a hidden future location. A release with a non-teammate or unobserved target is an omniscient mutant → `FAIL`. No release events → `NOT_EVALUATED`.

## core delta (exact)

`git diff src/simulation/` is **empty**. The `keeper-release` event is emitted by the adapter-aware runner as an observation-level telemetry event (the `gk-role` precedent), because the keeper designation is an adapter-layer fact the core does not and must not know. The `SimulationEvent["kind"]` union in `src/contracts/scenario.ts` is unchanged.

## disclosures / known_gaps

- No organic release in the accepted flowing 5v5 window (the on-target shots are answered by another body first, so the keeper never holds a claim long enough to distribute). The claim→release chain is demonstrated on the controlled 5v5 shot-on-target fixture and is labelled **driven-by-layout**, not organic. `GK-DISTRIBUTION-NO-OMNISCIENCE` stays `NOT_EVALUATED` on the continuous run — disclosed, not forced to a verdict.
- Pass *connection*: the release is a `PASS` action toward an observed forward teammate. Whether the ball physically leaves the keeper's boot at the exact release tick depends on the ball being inside the versioned pass radius at that tick; this is reported as measured (`release_events` / `ball_independent_invariants`), not assumed. Compose the distribution contract (the non-omniscient target) is what the oracle adjudicates.
- No PES 2017 fidelity / measured-envelope claim. `reaction_latency_ref_ms`, `save_probability_distribution`, wrong-foot reversal, high-cross threshold and parry energy remain `BLOCKED_MISSING_REFERENCE`.
- No FOUNDATION_LAB_PASS, no PROMOTION, no milestone `PASS` upgrade.

## claims_not_made

- No PES 2017 fidelity or measured envelope claim; all keeper values are versioned provisional `gk-small-sided-v1`.
- No `FOUNDATION_LAB_PASS` claim.
- No invented reference (reaction latency, save probability, wrong-foot reversal, high-cross claim, parry energy stay `BLOCKED_MISSING_REFERENCE`).
- No claim that `keeper-release` is a simulation-core event; it is an adapter/observation-layer telemetry annotation (disclosed deviation).
- No claim of an organic release (the continuous run's `GK-DISTRIBUTION-NO-OMNISCIENCE` is `NOT_EVALUATED` and is disclosed as such).
