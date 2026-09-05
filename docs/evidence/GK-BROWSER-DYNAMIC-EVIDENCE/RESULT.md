## Builder report
- objective_id: GK-BROWSER-DYNAMIC-EVIDENCE
- builder_agent: builder-gameplay
- builder_model: deepseek-v4-flash
- builder_model_note: >-
    The primary builder-gameplay route (`qwen3.8-flash`) is quota-exhausted until
    2026-10-01, so this objective was implemented by the `deepseek-v4-flash`
    reroute. This reroute must be recorded (it is in this report and in the
    Gauntlet timing state) so equivalent Gauntlet work stays comparable across
    orchestrator models.
- evidence_class: DYNAMIC_VISUAL
- hypothesis: >-
    The SMALL-SIDED goalkeeper role (already accepted in the adapter layer by
    GK-5V5-ADAPTER-BEHAVIOR) can be made browser-visible by (1) wiring the 5v5
    CPU-vs-CPU browser composition root to run `gkBehavior` (opt-in, exactly as
    the adapter machinery established), and (2) capturing a real Chromium run
    of the driven save fixture, with event-centered frames proving the
    designated keeper holds its goal arc and answers an on-target shot with a
    recorded contact inside `save_claim_reach_radius` — the ball never parented,
    carried or teleported. Both the arc-hold and the save are the exact
    production functions the accepted headless GK evidence pinned; a
    `gkBehavior: false` run must reproduce HEAD (no keeper).
- files_changed:
  - src/apps/browser/main.ts (MODIFIED) — `gkBehavior` wired ON for the 5v5 CPU-vs-CPU match (`ai-match-5v5`) in the per-slot CPU composition root, gated so every other mode (including every human-vs-CPU path) keeps exactly the frames it emitted before any keeper existed; the shared team decision and the slot frames are decided under one switch so the press designation also drops the keeper.
  - tests/browser/gk-browser-dynamic-evidence.browser.test.ts (NEW) — 2-test DYNAMIC_VISUAL browser capture suite (4 event-centered frames, two-pass replay, stashed kill-switch, sequence.json + browser trajectory.json).
  - package.json (MODIFIED) — `capture-gk-browser-dynamic-evidence` script (WIP_SECTION-gated durable capture).
  - docs/screenshots/GK-BROWSER-DYNAMIC-EVIDENCE/ (NEW) — 4 PNG frames + sequence.json.
  - docs/evidence/GK-BROWSER-DYNAMIC-EVIDENCE/ (NEW) — trajectory.json, audit.json, RESULT.md.
- commands_run:
  - cmd: "mise run typecheck"
    exit_code: 0
    result: "tsc --noEmit core+node+browser all clean"
  - cmd: "CI=1 mise exec -- pnpm exec vitest run tests/browser/gk-browser-dynamic-evidence.browser.test.ts --project browser"
    exit_code: 0
    result: "2/2 PASS (ephemeral capture; frames 195/355/366/370)"
  - cmd: "CI=1 mise exec -- pnpm run capture-gk-browser-dynamic-evidence"
    exit_code: 0
    result: "2/2 PASS (durable-evidence mode; wrote docs/screenshots/GK-BROWSER-DYNAMIC-EVIDENCE + docs/evidence/GK-BROWSER-DYNAMIC-EVIDENCE/trajectory.json)"
  - cmd: "CI=1 mise exec -- pnpm exec vitest run <gk+anti-huddle+kickoff+restart+capture-hygiene node suites> --project node"
    exit_code: 0
    result: "118/118 PASS across tests/unit/cpu-adapter/goalkeeper-role.test.ts (30), tests/unit/cpu-adapter/GK-SMALL-SIDED-V1-drift.test.ts (6), tests/integration/gk-5v5-adapter-behavior.test.ts (15), tests/unit/cpu-adapter/kickoff-anti-huddle.test.ts (21), tests/integration/5v5-kickoff-anti-huddle.test.ts (17), tests/integration/restart-anti-huddle.test.ts (26), tests/capture-hygiene.node.test.ts (3); Vitest reported 2 non-fatal worker-RPC onTaskUpdate timeouts (the same pre-existing artifact already disclosed in the accepted GK-5V5-ADAPTER-BEHAVIOR RESULT), tests + exit code clean"
  - cmd: "CI=1 mise exec -- pnpm exec vitest run tests/browser/5v5-ai-match.browser.test.ts tests/browser/5v5-human-vs-cpu.browser.test.ts --project browser"
    exit_code: 0
    result: "28/28 PASS (browser 5v5 AI-match + human-vs-CPU regression unchanged)"
  - cmd: "CI=1 mise exec -- pnpm exec vitest run tests/browser/anti-huddle-dynamic-evidence.browser.test.ts tests/browser/human-arc-interaction.browser.test.ts --project browser"
    exit_code: 0
    result: "4/4 PASS (accepted browser DYNAMIC_VISUAL trajectories unchanged)"
  - cmd: "CI=1 mise exec -- pnpm run gauntlet:audit -- --objective GK-BROWSER-DYNAMIC-EVIDENCE --class DYNAMIC_VISUAL --tests-pass true --integration-test-pass true"
    exit_code: 0
    result: "status PASS (persisted docs/evidence/GK-BROWSER-DYNAMIC-EVIDENCE/audit.json)"
- tests_run:
  - name: "tests/browser/gk-browser-dynamic-evidence.browser.test.ts (2 tests)"
    result: "PASS — GK-BROWSER-DYNAMIC-EVIDENCE capture (4 event-centered frames, two-pass replay_identical, stashed kill-switch) and sequence.json byte-coherence"
  - name: "tests/integration/gk-5v5-adapter-behavior.test.ts (15 tests)"
    result: "PASS — GK-MATCH-001/002/003/004/005 (accepted headless keeper evidence unchanged)"
  - name: "tests/unit/cpu-adapter/goalkeeper-role.test.ts (30 tests) + GK-SMALL-SIDED-V1-drift.test.ts (6 tests)"
    result: "PASS — keeper role unit guards + config-drift guards"
  - name: "tests/unit/cpu-adapter/kickoff-anti-huddle.test.ts (21) + tests/integration/5v5-kickoff-anti-huddle.test.ts (17) + tests/integration/restart-anti-huddle.test.ts (26)"
    result: "PASS — no accepted anti-huddle/kickoff/restart pin changed"
  - name: "tests/capture-hygiene.node.test.ts (3 tests)"
    result: "PASS — durable writes stay gated; ordinary runs leave docs/ byte-identical"
- integration_test_result: "PASS — tests/integration/gk-5v5-adapter-behavior.test.ts 15/15 pass; the new browser suite (2/2) is the DYNAMIC_VISUAL integration surface for the objective."
- slot_wiring_result: NOT_APPLICABLE (no slot ownership/routing acceptance dependency; the keeper designation is a team-level adapter fact, not a slot-routing fact)
- required_evidence:
  - trajectory.json: present at docs/evidence/GK-BROWSER-DYNAMIC-EVIDENCE/trajectory.json (SHA-256 9acef93e675ef018091967b60786943b602b7297accffe42c20354143e552b6c)
  - 4 semantic frames + sequence.json: docs/screenshots/GK-BROWSER-DYNAMIC-EVIDENCE/{keeper-arc-hold,press-and-cover,shot-on-target,save-contact}.png + sequence.json
  - audit.json: present, status PASS
- artifacts:
  - docs/screenshots/GK-BROWSER-DYNAMIC-EVIDENCE/keeper-arc-hold.png (b8295f109fcb89b50822ee0b530e7acb31f73a81e995339f2a09735217c9c614)
  - docs/screenshots/GK-BROWSER-DYNAMIC-EVIDENCE/press-and-cover.png (11bfabd1fab2ed4c9bb3c6b78d7a0cd847d963cae23553c37504bbc7c4fff7bb)
  - docs/screenshots/GK-BROWSER-DYNAMIC-EVIDENCE/shot-on-target.png (dc972d3cb91c8017f09c83285519cad8d5a8b61e2113dd02945f478918ae9043)
  - docs/screenshots/GK-BROWSER-DYNAMIC-EVIDENCE/save-contact.png (e85b2d27526279bc606a90f994c7addfca8e2c2b90b2d10ffaa7ab8c2f149579)
  - docs/screenshots/GK-BROWSER-DYNAMIC-EVIDENCE/sequence.json
  - docs/evidence/GK-BROWSER-DYNAMIC-EVIDENCE/trajectory.json
  - docs/evidence/GK-BROWSER-DYNAMIC-EVIDENCE/audit.json
- spec_sections:
  - specs/GOALKEEPER_SPEC.md §4 (designation), §5 (goal-arc hold + bounded lateral drift), §6 (no-field-chase / anti-huddle exclusion), §7 (save/claim on shots on target), §8 (distribution — release presses counted, no omniscience)
  - specs/TECHNICAL_SPEC.md §20 (dependency direction; adapter + browser composition-root wiring only, core untouched)
  - gauntlet/evidence-contract.md + gauntlet/evidence-classes.md (DYNAMIC_VISUAL: tests + integration + trajectory + 3–5 semantic frames + sequence.json)
  - gauntlet/roles/builder-gameplay.md (role contract)
  - eval/contracts/goalkeeper-config.ts (versioned provisional gk-small-sided-v1 record)
- acceptance_criteria_met:
  - **Wired in the real browser composition root (main.ts), 5v5 CPU-vs-CPU ON**: `ai-match-5v5` now runs `gkBehavior` in the per-slot CpuAdapter path (team decision + slot frames under one switch); human-control paths (every `human-vs-*` mode) untouched; `git diff src/simulation/ src/contracts/` EMPTY. ✓
  - **Keeper visibly holds its goal arc while the anti-huddle arc runs**: keeper-arc-hold@195 and press-and-cover@355 frames; at both ticks every team's designated keeper is inside `goal_arc_radius` + within `goal_arc_lateral_max` and is never the team's presser/chaser/cover (keeperIsChaser=false), so the keeper is excluded from the field chase (spec §6). ✓
  - **At least one save/claim event, DYNAMIC_VISUAL**: shot-on-target@366 (player-1, on target at team-b's goal, projected cross y=-0.343 inside the posts) answered by save-contact@370 by the designated keeper player-10 with a recorded `player-ball-contact` at 0.7139 m (<= `save_claim_reach_radius` 1.2 m), 4 ticks after the shot (<= `keeper_reaction_window_ticks` 12). The ball stays independent (no parenting/teleport; the contact is the core's own event). ✓
  - **Event-centered, two-pass, byte-bound to ticks**: pass 1 locates the event ticks from the run's own event log; pass 2 replays the same wiring from scratch, renders the frames at those ticks, and requires the per-tick hash chain and the located arc to be identical (replay_identical=true). ✓
  - **Browser trajectory.json**: per-tick committed hashes + gk designation fields (`keeperPlayerId`, `keeperDistToArcCenter`, `keeperLateralDrift`, `keeperOnArc`, `keeperIsChaser`) + player flag legend (`k` = designatedKeeper) + replay_identical + event log. ✓
  - **Discriminating negative**: `gkBehavior: false` reproduces HEAD — no keeper designation, no arc hold, `locateGkArc` null, keeper-hold/arm/save counters all 0 while the match still runs. ✓
  - **Parity with headless adapter behavior**: keeper designation team-a→player-4, team-b→player-10 matches the pinned headless read (GK-5V5-ADAPTER-BEHAVIOR), and the shot→keeper-contact within-reach chain structure reproduces it. ✓
  - **Durability gate**: `WIP_SECTION=__EVIDENCE__:GK-BROWSER-DYNAMIC-EVIDENCE`; ordinary runs write only ignored test-results/gauntlet-capture/** and leave docs/ byte-identical (capture-hygiene suite pass). ✓
  - **Regression / no accepted pin changed**: node GK + anti-huddle + kickoff + restart + capture-hygiene suites 118/118 pass; browser 5v5 AI-match + human-vs-CPU 28/28 pass; accepted anti-huddle + human-arc browser DYNAMIC_VISUAL suites 4/4 pass. ✓
  - **typecheck** exit 0. **gauntlet:audit** PASS. ✓
- known_gaps:
  - The achieved save/claim event is **fixture-driven**: it comes from the controlled `eval/scenarios/5v5-keeper-shot-fixture.v1.json` run (loaded in the browser test harness via `commands.readFile` + `createTestBridge`, the same accepted pattern the anti-huddle and human-arc evidence use), not from the organic flowing 5v5 kickoff match. The organic `ai-match-5v5` browser match now runs the keeper arc-hold (main.ts `gkBehavior`) but, exactly as the accepted headless GK evidence disclosed, its own on-target shots get answered by another body first (0 save chains) — so the save evidence is disclosed as fixture-driven, never fabricated.
  - The production browser scenario selector (`scenario-selector.ts`) statically imports the foundation scenarios only; it does not load `eval/scenarios/*.json` at runtime. The save fixture is therefore exercised through the test bridge rather than a new URL-driven app mode. No existing scenario file was modified.
  - The keeper body that defends toward the fixture's shots (team-b player-10) starts essentially on its arc; the team-a keeper (player-4) transits onto its arc (stationTick=195). The transit uses the accepted locomotion cap; the versioned `keeper_reposition_speed` governs in-arc repositioning.
  - No core event kind was added (`keeper-arc-position` / `keeper-ball-contact` / `keeper-release` do not exist in the core event union and were not invented). The `goalkeepers` evaluator suite's GK_* situation mappings remain NOT_EVALUATED — re-adjudicating them is a separate objective, not this one.
  - `reaction_latency_ref_ms` stays BLOCKED_MISSING_REFERENCE; the model initiates the attempt at the earliest tick the committed world makes the shot observable. The recorded shot→contact gap (4 ticks) is reported as a measurement, never compared to an invented envelope.
- claims_not_made:
  - No PES 2017 fidelity claim (all keeper values are versioned provisional `gk-small-sided-v1`; no measured constant invented).
  - No FOUNDATION_LAB_PASS claim.
  - No GK-POSITIONING-HOLD / GK-NO-FIELD-CHASE / GK-SAVE-CLAIM / GK-ROLE-DESIGNATION / GK-DISTRIBUTION-NO-OMNISCIENCE verdict claim for the `goalkeepers` evaluator suite (those situation mappings stay NOT_EVALUATED).
  - No invented reference envelope/tolerance for reaction latency, save probability, wrong-foot reversal, high-cross claim threshold or parry energy ratio (all BLOCKED_MISSING_REFERENCE).
  - No perceptual/rubric PASS for keeper visual plausibility; the frames are semantic evidence of the accepted behavior at the captured ticks, not a readability PASS.

## Evidence facts
- Frame ticks + semantics (all within one deterministic Chromium run of the driven fixture):
  - keeper-arc-hold @ 195 (before) — both designated keepers hold their goal arcs while the anti-huddle one-presser+cover shape runs (keeper never the chaser)
  - press-and-cover @ 355 (transition) — one field presser + cover per team, the keeper on its arc and excluded from the chase
  - shot-on-target @ 366 (event) — player-1's on-target shot at team-b's goal (projected cross y=-0.343)
  - save-contact @ 370 (result) — the keeper player-10's recorded ball contact 0.7139 m off the ball (inside `save_claim_reach_radius` = 1.2 m), 4 ticks after the shot
- Keeper designations: team-a → player-4, team-b → player-10 (designationDrift none; resolved before kickoff from the starting layout; matches the pinned headless read).
- trajectory SHA-256: 9acef93e675ef018091967b60786943b602b7297accffe42c20354143e552b6c
- frames: 4 PNGs (distinct SHA-256), sequence.json present, semantic_order "keeper goal-arc hold -> anti-huddle spread/press (keeper excluded) -> shot on target -> recorded save contact".
- determinism: pass1/pass2 per-tick hash chains equal (replay_identical=true); state_hash_of_hashes bd1ee7ee306c91e508c81b388757c1d02d02482a57b3acfe92fb30a9e3755a2a; final_state_hash fnv1a64-v1:0cb226e47f8ba77c.
- keeper-path counters (live, 600-tick fixture run): hold=1074, arms=21, save-presses=1, press-exclusions=7800; stashed (gkBehavior:false) all 0.
- stashed_control: arc_located=false; keeper_hold/arm/save_activations 0.
- cross_runtime: designation_matches_engine=true; note states per-tick hashes are the Chromium run's own (known pinned-runtime gap).
- save provenance: fixture-driven (controlled 5v5-keeper-shot-fixture.v1.json), the shot is the shooting body's own canonical CPU SHOT press (nothing scripted). Disclosed, not fabricated.
