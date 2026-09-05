## Builder report
- objective_id: GK-5V5-ADAPTER-BEHAVIOR
- builder_agent: builder-gameplay
- builder_model: deepseek-v4-flash
- evidence_class: MULTI_TICK
- hypothesis: The SMALL-SIDED goalkeeper role can be implemented entirely in the adapter layer (no simulation core or contract change) by assigning one existing scenario body per team as its designated keeper from the match's starting layout, and by giving that body a goal-arc hold (bounded lateral drift), a no-field-chase exclusion inherited from the accepted anti-huddle contract, and a save/claim + distribution path that acts only through tick-indexed InputFrames (so the ball stays an independent 3D entity). Because the role is opt-in through a `gkBehavior` kill switch, stashing it must reproduce HEAD's per-tick hash chains byte-for-byte, proving the change is strictly additive.
- files_changed:
  - src/adapters/input-browser/goalkeeper-role.ts (NEW) — pure keeper role module: versioned `GK_SMALL_SIDED_V1` config mirror, geometry helpers (arc centre, lateral band, station target, on-target shot projection), layout-based designation, shared save/claim reaction rule, reachability counters
  - src/adapters/input-browser/team-decision-profile.ts (MODIFIED) — `isKeeperBehaviorActive`, `resolveKeeperPlayerId`, and `designatePresser` drops the designated keeper from the press/eligible set (spec §6)
  - src/adapters/input-browser/cpu-adapter.ts (MODIFIED) — `CpuObservation.gkBehavior`/`keeperPlayerIds`/`recentShotEvents`, keeper shot-event extraction, `SHOT_EVENT_WINDOW_TICKS`, `assignChaseRoles`/`findPressCoverPair`/`findKickoffTaker` keeper exclusions, `computeKeeperFrame`, reset bookkeeping
  - eval/runners/headless-match.ts (MODIFIED) — `gkBehavior` wiring option, layout-based keeper designation resolved once per match and injected into observations (runner evidence infrastructure; core untouched)
  - eval/runners/gk-match.ts (NEW) — coherent 5v5 CPU-vs-CPU evidence driver reading the production keeper functions over committed ticks
  - eval/scenarios/5v5-keeper-shot-fixture.v1.json (NEW) — controlled 5v5 shot-on-target fixture (same ten bodies, nothing scripted)
  - scripts/capture-gk-5v5-adapter-behavior-evidence.ts (NEW) — durable/ephemeral trajectory producer (WIP_SECTION-gated)
  - scripts/ci/verify-gk-stash-identity-head.mjs (NEW) — stash-identity verifier against a real HEAD checkout
  - tests/unit/cpu-adapter/goalkeeper-role.test.ts (NEW) — 30 discriminating unit guards
  - tests/unit/cpu-adapter/GK-SMALL-SIDED-V1-drift.test.ts (NEW) — 6 config-drift guards binding the adapter values to the spec record
  - tests/integration/gk-5v5-adapter-behavior.test.ts (NEW) — 15 integration guards
  - package.json (MODIFIED) — `capture-gk-5v5-adapter-behavior` and `gauntlet:verify-gk-stash` scripts
  - docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/trajectory.json (NEW/REGENERATED)
  - docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/audit.json (NEW)
  - docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/RESULT.md (NEW)
- commands_run:
  - cmd: "mise exec -- pnpm exec vitest run tests/unit/cpu-adapter/goalkeeper-role.test.ts tests/unit/cpu-adapter/GK-SMALL-SIDED-V1-drift.test.ts --project node"
    exit_code: 0
    result: "36/36 PASS (30 + 6)"
  - cmd: "mise exec -- pnpm exec vitest run tests/integration/gk-5v5-adapter-behavior.test.ts --project node"
    exit_code: 0
    result: "15/15 PASS (1 non-fatal vitest onTaskUpdate RPC timeout on the long beforeAll hook; tests and exit code clean)"
  - cmd: "mise exec -- pnpm exec vitest run tests/unit/cpu-adapter/kickoff-anti-huddle.test.ts tests/integration/5v5-kickoff-anti-huddle.test.ts tests/integration/restart-anti-huddle.test.ts --project node"
    exit_code: 0
    result: "64/64 PASS (regression: no accepted anti-huddle/kickoff/restart pin changed)"
  - cmd: "mise exec -- pnpm exec vitest run tests/capture-hygiene.node.test.ts --project node"
    exit_code: 0
    result: "3/3 PASS (capture hygiene; durable writes stay gated)"
  - cmd: "WIP_SECTION=__EVIDENCE__:GK-5V5-ADAPTER-BEHAVIOR mise exec -- pnpm run capture-gk-5v5-adapter-behavior"
    exit_code: 0
    result: "wrote docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/trajectory.json (durable-evidence mode; 4 runs)"
  - cmd: "mise exec -- pnpm run gauntlet:verify-gk-stash -- --ref=91ff0be"
    exit_code: 0
    result: "PASS — gkBehavior:false reproduces 91ff0be per-tick hash chains for 2 stashed run(s)"
  - cmd: "mise run typecheck"
    exit_code: 0
    result: "tsc --noEmit core+node+browser all clean"
  - cmd: "mise exec -- pnpm run gauntlet:audit -- --objective GK-5V5-ADAPTER-BEHAVIOR --class MULTI_TICK --tests-pass true --integration-test-pass true"
    exit_code: 0
    result: "status PASS (audit.json persisted)"
- tests_run:
  - name: "tests/unit/cpu-adapter/goalkeeper-role.test.ts (30 tests)"
    result: "PASS — GK-DESIGNATION-001, GK-ARC-001/002, GK-CHASE-001, GK-SAVE-001/002, GK-DISTRIBUTION-001, GK-GUARD-001 all pass"
  - name: "tests/unit/cpu-adapter/GK-SMALL-SIDED-V1-drift.test.ts (6 tests)"
    result: "PASS — every implemented keeper value binds to the spec's gk-small-sided-v1 record; blocked references stay blocked"
  - name: "tests/integration/gk-5v5-adapter-behavior.test.ts (15 tests)"
    result: "PASS — GK-MATCH-001/002/003/004/005 all pass"
  - name: "tests/unit/cpu-adapter/kickoff-anti-huddle.test.ts (21 tests)"
    result: "PASS — no regression to the accepted kickoff anti-huddle contract"
  - name: "tests/integration/5v5-kickoff-anti-huddle.test.ts (17 tests)"
    result: "PASS — accepted flowing chain reproduced when the keeper role is stashed"
  - name: "tests/integration/restart-anti-huddle.test.ts (26 tests)"
    result: "PASS — no regression to the accepted restart anti-huddle contract"
  - name: "tests/capture-hygiene.node.test.ts (3 tests)"
    result: "PASS — ordinary runs leave docs/ byte-identical; durable writes require WIP_SECTION=__EVIDENCE__"
- integration_test_result: "PASS — tests/integration/gk-5v5-adapter-behavior.test.ts 15/15 pass; gk-5v5-adapter-behavior is the objective's integration suite."
- slot_wiring_result: NOT_APPLICABLE
- required_evidence:
  - trajectory.json: present at docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/trajectory.json (SHA-256 ca9443a0859733c1b52acd775002737f4f75bd277e508e4cf06eed7029bf207c; 4 runs; MULTI_TICK)
  - MULTI_TICK tests: 51 (30 unit + 6 drift + 15 integration) objective tests pass
  - regression: 64/64 anti-huddle/kickoff/restart tests + 3/3 capture-hygiene tests pass
- artifacts:
  - docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/trajectory.json
  - docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/audit.json
  - docs/evidence/GK-5V5-ADAPTER-BEHAVIOR/RESULT.md
- spec_sections:
  - specs/GOALKEEPER_SPEC.md §§4-8 (designation, goal-arc, no-field-chase, save/claim, distribution)
  - specs/TECHNICAL_SPEC.md §20 (dependency direction; adapter/runner wiring only, core untouched)
  - specs/GAMEPLAY_EVALUATION_SPEC.md (ball-independence / anti-huddle inheritance)
  - gauntlet/roles/builder-gameplay.md (role contract)
  - gauntlet/evidence-contract.md (MULTI_TICK evidence class)
  - eval/contracts/goalkeeper-config.ts (versioned provisional record)
- acceptance_criteria_met:
  - **Designated keeper per team (spec §4)**: one existing body per team, resolved before kickoff from the starting layout, frozen for the whole run (designationDriftTicks = 0). ✓
  - **Goal-arc hold with bounded lateral drift (spec §5)**: commanded station inside `goal_arc_radius` and within `goal_arc_lateral_max` on every tick; committed position inside the arc after station. ✓
  - **No field chase (spec §6)**: keeper is never designated chaser/presser, cover, or restart taker (keeperDesignatedChaserTicks/CoverTicks/TakerTicks = 0; keeperChaseTeamTicks = 0); exactly one field chaser per team remains. ✓
  - **Save/claim on shots on target (spec §7)**: the controlled fixture's on-target shot is answered by an explicit recorded `player-ball-contact` (first-touch) inside `save_claim_reach_radius`, initiated inside `keeper_reaction_window_ticks`; ball stays independent (no parenting/teleport; no event kind added to the core). ✓
  - **Distribution without omniscience (spec §8)**: release is a canonical PASS down an observed, already-facing lane; release counter lights only when the keeper has secured the ball and a forward teammate is observable. ✓
  - **Versioned provisional configuration**: every value reads from the `gk-small-sided-v1` record; the drift test binds adapter values to `eval/contracts/goalkeeper-config.ts`. ✓
  - **Stash identity (kill switch)**: `gkBehavior:false` reproduces HEAD's per-tick hash chains byte-for-byte on both the continuous match and the shot fixture, and leaves every keeper counter at 0. ✓
  - **No regression**: accepted anti-huddle/kickoff/restart suites still pass; typecheck exit 0. ✓
  - **gauntlet:audit**: PASS. ✓
- known_gaps:
  - The organic flowing 5v5 match (5v5-gk-continuous-live) armed 21 keeper reactions on the match's own on-target shots but recorded 0 save chains on shots on target — every chain is `interrupted_by` (another body played the shot ball first). The save/claim evidence therefore comes from the controlled 5v5-keeper-shot-fixture.v1.json run (labelled driven-by-layout in the artifact; the shot is the shooting body's own canonical SHOT press, nothing scripted).
  - The keeper body starts at its scenario kickoff home (not on its goal line), so it transits onto its arc before it can hold it; `station_taken_tick` is reported per run and the arc bounds are measured from that tick. Transit uses the accepted locomotion cap; the versioned `keeper_reposition_speed` governs repositioning inside the arc.
  - A keeper body can be displaced off its arc by player-player contact, which the adapters do not control; off-arc ticks after station are split into attributable (with body contact) and unattributed.
  - No core event kind was added: `keeper-arc-position` / `keeper-ball-contact` / `keeper-release` do not exist in the core event union and were not invented. The `goalkeepers` suite's GK_* situation mappings remain NOT_EVALUATED (re-adjudicating them is GK-SUITE-ORGANIC-STATE, not this objective).
  - The browser composition root (src/apps/browser/main.ts) does not set `gkBehavior` yet, so the browser 5v5 match is unchanged; making the keeper visible in the running app is the next horizon objective (GK-BROWSER-DYNAMIC-EVIDENCE).
  - `reaction_latency_ref_ms` stays BLOCKED_MISSING_REFERENCE; the model initiates the attempt at the earliest tick the committed world makes the shot observable. Recorded shot→contact gaps are reported as measurements, never compared to an invented envelope.
  - Vitest reported a non-fatal `onTaskUpdate` RPC timeout on the long-running integration `beforeAll` (also present in the pre-existing restart-anti-huddle suite). Tests and exit code are clean; this is a Vitest worker-RPC artifact, not a test failure.
- claims_not_made:
  - No PES 2017 fidelity claim (all keeper values are versioned provisional `gk-small-sided-v1`).
  - No FOUNDATION_LAB_PASS claim.
  - No GK-POSITIONING-HOLD / GK-NO-FIELD-CHASE / GK-SAVE-CLAIM / GK-ROLE-DESIGNATION / GK-DISTRIBUTION-NO-OMNISCIENCE verdict claim for the `goalkeepers` evaluator suite — those situation mappings stay NOT_EVALUATED and are re-adjudicated by GK-SUITE-ORGANIC-STATE.
  - No invented reference envelope or tolerance for reaction latency, save probability, wrong-foot reversal, high-cross claim threshold, or parry energy ratio (all BLOCKED_MISSING_REFERENCE).
  - No perceptual/rubric claim for keeper visual plausibility.
  - No `GK-REA-001-REF` / `GK-PARRY-001-REF` measured-target comparison.

## Evidence facts
- trajectory SHA-256: ca9443a0859733c1b52acd775002737f4f75bd277e508e4cf06eed7029bf207c
- runs (4): 5v5-gk-continuous-live (1800 ticks, gk=true), 5v5-gk-continuous-stashed (1800, gk=false), 5v5-gk-shot-fixture-live (600, gk=true), 5v5-gk-shot-fixture-stashed (600, gk=false)
- keeper designations: team-a → player-4, team-b → player-10 (both declared defenders); designation drift 0
- station ticks: continuous-live team-a=401, team-b=108; shot-fixture-live team-a=195, team-b=1
- keeper chase ticks (all runs): team-a=0, team-b=0
- save chains (5v5-gk-shot-fixture-live): team-b keeper player-10 — shot 361→contact 362 (first-touch, 1.0818 m), shot 370→contact 374 (dribble-touch, 0.7372 m), shot 376→contact 380 (0.5511 m), shot 382→contact 386 (0.466 m); all `within_reach: true`; shot→contact gaps ≤ 4 ticks (inside keeper_reaction_window_ticks=12)
- mechanism counters: continuous-live hold=3594, arms=21, save-presses=1, releases=0, exclusions=28780; shot-fixture-live hold=1194, arms=57, save-presses=1, releases=2, exclusions=9580; both stashed runs all counters 0
- determinism: continuous-live replay_identical=true, shot-fixture-live replay_identical=true
- stash-identity: PASS — `gkBehavior:false` reproduces 91ff0be per-tick hash chains for both stashed runs (verified against a real 91ff0be checkout; also matches the accepted 5V5-KICKOFF-ANTI-HUDDLE flowing chain and the base-tree chain for the fixture)
- capture: regenerated from the current tree in durable-evidence mode (WIP_SECTION=__EVIDENCE__:GK-5V5-ADAPTER-BEHAVIOR), not reused from the interrupted run
