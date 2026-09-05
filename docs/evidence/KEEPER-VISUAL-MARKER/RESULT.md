## Builder report
- objective_id: KEEPER-VISUAL-MARKER
- builder_agent: builder-gameplay
- builder_model: deepseek-v4-flash
- builder_model_note: >-
    The primary builder-gameplay route (`qwen3.8-flash`) is quota-exhausted until
    2026-10-01, so this objective was implemented by the `deepseek-v4-flash`
    reroute. This reroute must be recorded (it is in this report and must be
    recorded in the Gauntlet timing state) so equivalent Gauntlet work stays
    comparable across orchestrator models.
- evidence_class: DYNAMIC_VISUAL
- hypothesis: >-
    The browser-evidence critic observed that the designated SMALL-SIDED keeper
    (already accepted in the adapter layer by GK-5V5-ADAPTER-BEHAVIOR and made
    browser-visible by GK-BROWSER-DYNAMIC-EVIDENCE) had NO distinct visual kit
    marker — role legibility was positional only. This objective adds a
    presentation-only keeper kit marker (a magenta triangle above the head) via
    an ADDITIVE `PlayerPresentation.keeperRole?: boolean` field, threaded from
    the accepted adapter designation through the browser composition root's
    snapshot path, so the renderer draws the marker ONLY when that field is
    present and renders byte-identically to HEAD when it is absent (every mode
    with `gkBehavior` off).
- files_changed:
  - src/contracts/presentation.ts (MODIFIED, ADDITIVE ONLY) — new optional `keeperRole?: boolean` on `PlayerPresentation`; no existing field or semantics altered.
  - src/adapters/renderer-three/renderer.ts (MODIFIED) — `keeperMarkerColor` config (0xff33ff), `createKeeperMarker` (magenta 3-sided cone = triangle above the head), a per-player keeper-marker map driven in `updateFromSnapshot` (drawn only when `keeperRole` is present), stale-marker cleanup, `reset()` clears the map; and a new exported `enrichPresentationWithKeeperRoles(snapshot, keeperPlayerIds)` presentation-only post-process.
  - src/apps/browser/main.ts (MODIFIED) — for `ai-match-5v5` only, the composition root resolves the per-team keeper designation from the starting layout and enriches the presentation snapshot with `keeperRole` before `session.advance`; every other mode leaves the field absent (gkBehavior off).
  - src/apps/browser/test-bridge.ts (MODIFIED) — `capture(presentation?)` accepts an optional presentation-only snapshot override (backward compatible; used by the evidence harness to render the enriched snapshot). The simulation is never touched.
  - tests/browser/keeper-visual-marker.browser.test.ts (NEW) — 4-test DYNAMIC_VISUAL + parity-guard browser suite (3 event-centered frames, two-pass replay, stashed kill-switch, sequence.json + trajectory.json, keeperRole-only-on-keepers assertion, byte-identical-absence + marker-renders parity guard).
  - tests/unit/keeper-visual-parity.node.test.ts (NEW) — 3-test node suite asserting the snapshot change is additive, the enrichment is non-mutating/shallow, and `keeperRole` lands only on designated keepers.
  - package.json (MODIFIED) — `capture-keeper-visual-marker` script (WIP_SECTION-gated durable capture).
  - docs/screenshots/KEEPER-VISUAL-MARKER/ (NEW) — 3 PNG frames + sequence.json.
  - docs/evidence/KEEPER-VISUAL-MARKER/ (NEW) — trajectory.json, audit.json, RESULT.md.
- commands_run:
  - cmd: "mise run typecheck"
    exit_code: 0
    result: "tsc --noEmit core+node+browser all clean"
  - cmd: "CI=1 mise exec -- pnpm exec vitest run tests/unit/keeper-visual-parity.node.test.ts --project node"
    exit_code: 0
    result: "3/3 PASS"
  - cmd: "CI=1 mise exec -- pnpm exec vitest run tests/browser/keeper-visual-marker.browser.test.ts --project browser"
    exit_code: 0
    result: "4/4 PASS (ephemeral capture; frames 195/366/370; parity unenriched=05e40d... enriched=44916d...)"
  - cmd: "CI=1 mise exec -- pnpm run capture-keeper-visual-marker"
    exit_code: 0
    result: "4/4 PASS (durable-evidence mode; wrote docs/screenshots/KEEPER-VISUAL-MARKER + docs/evidence/KEEPER-VISUAL-MARKER/trajectory.json)"
  - cmd: "CI=1 mise exec -- pnpm exec vitest run tests/unit/cpu-adapter/goalkeeper-role.test.ts tests/unit/cpu-adapter/GK-SMALL-SIDED-V1-drift.test.ts tests/unit/cpu-adapter/kickoff-anti-huddle.test.ts --project node"
    exit_code: 0
    result: "57/57 PASS (GK oracle unit guards + config-drift + anti-huddle unit)"
  - cmd: "CI=1 mise exec -- pnpm exec vitest run tests/integration/gk-5v5-adapter-behavior.test.ts tests/integration/5v5-kickoff-anti-huddle.test.ts tests/integration/restart-anti-huddle.test.ts tests/capture-hygiene.node.test.ts --project node"
    exit_code: 0
    result: "61/61 PASS (tests; the run reported the known pre-existing non-fatal [vitest-worker] onTaskUpdate timeout — the same artifact already disclosed in the accepted GK-5V5-ADAPTER-BEHAVIOR / GK-BROWSER-DYNAMIC-EVIDENCE RESULT files, not a test failure)"
  - cmd: "CI=1 mise exec -- pnpm exec vitest run tests/browser/5v5-ai-match.browser.test.ts tests/browser/5v5-human-vs-cpu.browser.test.ts --project browser"
    exit_code: 0
    result: "28/28 PASS (browser 5v5 AI-match + human-vs-CPU regression unchanged)"
  - cmd: "CI=1 mise exec -- pnpm exec vitest run tests/browser/anti-huddle-dynamic-evidence.browser.test.ts tests/browser/human-arc-interaction.browser.test.ts --project browser"
    exit_code: 0
    result: "4/4 PASS (accepted browser DYNAMIC_VISUAL trajectories unchanged)"
  - cmd: "CI=1 mise exec -- pnpm exec vitest run tests/browser/gk-browser-dynamic-evidence.browser.test.ts --project browser"
    exit_code: 0
    result: "2/2 PASS (keeper-absent frame renders unchanged; the marker branch is never entered)"
  - cmd: "CI=1 mise exec -- pnpm exec vitest run tests/unit/eval/DUEL-REJECTION-FIXTURE-binding.test.ts tests/unit/player-contact/player-contact-system.test.ts --project node"
    exit_code: 0
    result: "35/35 PASS (duels + player-contact/ball-independence pins)"
  - cmd: "CI=1 mise exec -- pnpm run gauntlet:verify-gk-stash -- --ref 3f31eef"
    exit_code: 0
    result: "PASS — gkBehavior:false reproduces 3f31eef per-tick hash chains for 4 run(s)"
  - cmd: "CI=1 mise exec -- pnpm run gauntlet:audit -- --objective KEEPER-VISUAL-MARKER --class DYNAMIC_VISUAL --tests-pass true --integration-test-pass true"
    exit_code: 0
    result: "status PASS (persisted docs/evidence/KEEPER-VISUAL-MARKER/audit.json)"
- tests_run:
  - name: "tests/browser/keeper-visual-marker.browser.test.ts (4 tests)"
    result: "PASS — DYNAMIC_VISUAL capture (3 event-centered frames, two-pass replay_identical, stashed kill-switch, keeperRole-only-on-keepers, byte-identical-absence parity guard, marker-renders parity guard) + sequence.json byte-coherence"
  - name: "tests/unit/keeper-visual-parity.node.test.ts (3 tests)"
    result: "PASS — contract additivity, non-mutating shallow enrichment, keeperRole only on designated keepers"
  - name: "GK oracle + anti-huddle + restart + capture-hygiene suites"
    result: "PASS — goalkeeper-role (30), GK-SMALL-SIDED-V1-drift (6), kickoff-anti-huddle (21), gk-5v5-adapter-behavior (15), 5v5-kickoff-anti-huddle (17), restart-anti-huddle (26), capture-hygiene (3)"
  - name: "accepted browser suites"
    result: "PASS — 5v5-ai-match + 5v5-human-vs-cpu (28), anti-huddle-dynamic + human-arc (4), gk-browser-dynamic-evidence (2)"
  - name: "duels / player-contact pins"
    result: "PASS — DUEL-REJECTION-FIXTURE-binding (10), player-contact-system (25)"
- integration_test_result: "PASS — the new browser suite (4/4) is the DYNAMIC_VISUAL integration surface for the objective; the accepted gk-browser-dynamic-evidence suite (2/2) still passes, confirming the marker is draw-only and never changes keeper-absent rendering."
- slot_wiring_result: NOT_APPLICABLE (no slot ownership/routing acceptance dependency; the keeper designation is a team-level adapter fact).
- required_evidence:
  - trajectory.json: present at docs/evidence/KEEPER-VISUAL-MARKER/trajectory.json (SHA-256 2349b3cc9dd86e34b7920c8edbf059a0d3207574063b9d4238ac3fc7dfd0bf8d)
  - 3 semantic frames + sequence.json: docs/screenshots/KEEPER-VISUAL-MARKER/{keeper-arc-marker,shot-on-target,save-contact}.png + sequence.json
  - audit.json: present, status PASS
- artifacts:
  - docs/screenshots/KEEPER-VISUAL-MARKER/keeper-arc-marker.png (ff36453a9087cfa9dd008e2d7fa2570f6f31befd889aefb8e0792f15327a8ab3)
  - docs/screenshots/KEEPER-VISUAL-MARKER/shot-on-target.png (7ba5224935e26ca4ed81945582c17953b03e9ff23d8f1bf377f7cb17af01237c)
  - docs/screenshots/KEEPER-VISUAL-MARKER/save-contact.png (dec864e8744e36d1b878e8b98c4c90dfacdebc4bd4225fc4ae79b9d83e78f641)
  - docs/screenshots/KEEPER-VISUAL-MARKER/sequence.json (33f03644ce82901297e33ca70a0b23192f1f1c26de39b093416475e340ece9d5)
  - docs/evidence/KEEPER-VISUAL-MARKER/trajectory.json (2349b3cc9dd86e34b7920c8edbf059a0d3207574063b9d4238ac3fc7dfd0bf8d)
  - docs/evidence/KEEPER-VISUAL-MARKER/audit.json (status PASS)
- spec_sections:
  - specs/TECHNICAL_SPEC.md §13 (simulation-to-presentation boundary; renderer consumes immutable PresentationSnapshot only)
  - specs/VISUAL_SPEC.md §3 priority order (distinguish goalkeepers), §7 (kit/team readability), §18 (configurable visual parameters; marker color is a RendererConfig field), §22 minimal gates (presentation cannot change simulation; controlled-player cue independent of kit hue — the keeper marker is a magenta shape, kit-independent)
  - specs/GOALKEEPER_SPEC.md §4 (adapter-layer designation; presentation-only, never a simulation input)
  - gauntlet/evidence-contract.md + gauntlet/evidence-classes.md (DYNAMIC_VISUAL)
  - gauntlet/roles/builder-gameplay.md (role contract)
- acceptance_criteria_met:
  - **ADDITIVE PresentationSnapshot change**: `PlayerPresentation.keeperRole?: boolean` added; `git diff src/contracts/presentation.ts` is a single added optional field; `git diff src/simulation/` EMPTY; all existing snapshot consumers (contract fixture, eval archetype-capture, difficulty-setting, renderer) compile unchanged (typecheck 0). ✓
  - **Renderer kit marker**: a distinct magenta triangle (3-sided cone) above the head, kit-independent colour 0xff33ff, drawn ONLY when `keeperRole` is present; absence renders byte-identically to HEAD (parity guard reproduces the pre-change baseline SHA). ✓
  - **Marker visible in a real 5v5 browser run (DYNAMIC_VISUAL)**: 3 event-centered frames keep/arc/shot/save. ✓
  - **Threaded from the accepted designation through the snapshot path**: `main.ts` resolves the per-team keeper via `designateKeeperFromLayout` (ai-match-5v5 only) and enriches the snapshot before `session.advance`; the field is absent for every mode with `gkBehavior` off. ✓
  - **Parity guards**: (a) with the field present the marker renders (enriched vs un-enriched bytes differ); (b) with the field absent the render is byte-identical to the pre-change path (baseline SHA reproduced); (c) the snapshot change is additive (node suite asserts no `keeperRole` on un-enriched snapshots, non-mutating shallow enrichment). ✓
  - **Durability gate**: `WIP_SECTION=__EVIDENCE__:KEEPER-VISUAL-MARKER` via `capture-keeper-visual-marker`; ordinary runs write only ignored test-results and leave docs/ byte-identical (capture-hygiene suite pass). ✓
  - **No accepted pin changed**: GK oracle + anti-huddle + restart + capture-hygiene node (61), duels/player-contact (35), browser 5v5 (28), anti-huddle+human-arc (4), gk-browser-dynamic-evidence (2). **typecheck** exit 0. **gauntlet:audit** PASS. **verify-gk-stash** PASS (4 stashed runs byte-identical to base). ✓
- known_gaps:
  - The save/claim event is a **fixture-driven** controlled run (`eval/scenarios/5v5-keeper-shot-fixture.v1.json`), not the organic flowing `ai-match-5v5` kickoff match — the same disclosure the accepted GK browser evidence makes. The organic browser match runs the keeper arc/marker but its own on-target shots are answered by another body first.
  - The production browser scenario selector statically imports foundation scenarios only; it does not load `eval/scenarios/*.json` at runtime, so the save fixture is exercised through the test bridge. No existing scenario file was modified.
  - The keeper marker is a provisional stylized shape (magenta 3-sided cone); its size/colour are RendererConfig values, not a measured or VISUAL_SPEC-threshold read. The `goalkeepers` evaluator GK situation mappings remain NOT_EVALUATED (re-adjudicating them is a separate objective).
- claims_not_made:
  - No PES 2017 fidelity claim (all keeper values are versioned provisional `gk-small-sided-v1`; no measured constant invented).
  - No FOUNDATION_LAB_PASS claim.
  - No rubric-gated visual readability PASS: the frames are legibility evidence (a distinct marker on the keeper), not a VISUAL_SPEC threshold/readability score.
  - No perceptual task-based claim (no participant study, no acquisition/classification metric), and no numeric contrast/envelope invented for the marker.
  - No `goalkeepers` evaluator GK-POSITIONING-HOLD / GK-SAVE-CLAIM / etc. verdict claim (those stay NOT_EVALUATED).

## Evidence facts
- Frame ticks + semantics (one deterministic Chromium run of the driven fixture):
  - keeper-arc-marker @ 195 (before) — the designated keeper (player-10) holds its goal arc with the magenta marker above the head; the anti-huddle one-presser+cover shape runs and the keeper is never the chaser
  - shot-on-target @ 366 (event) — player-1's on-target shot at the keeper's goal (projected cross y=-0.343)
  - save-contact @ 370 (result) — keeper player-10's recorded ball contact 0.7139 m off the ball (inside `save_claim_reach_radius` = 1.2 m), 4 ticks after the shot
- Keeper designations: team-a → player-4, team-b → player-10 (matches the pinned headless read).
- Marker design: magenta triangle (3-sided cone, 0xff33ff) above the head; drawn only when `PlayerPresentation.keeperRole` is true; absent → byte-identical to the pre-change baseline.
- Snapshot contract delta: `PlayerPresentation` gains one OPTIONAL field `keeperRole?: boolean`; nothing else changed.
- Snapshot thread: `main.ts` (ai-match-5v5) → `enrichPresentationWithKeeperRoles(base, keeperByTeam)` → `session.advance`; the renderer consumes the enriched immutable snapshot.
- Pre-change baseline SHA-256 (captured at HEAD for the 5v5 base fixture): 05e40d01171667d6b7758c280cd22988c6fdddf93ecd13633aa5b933aef8bc68
- Parity: un-enriched render reproduces the baseline SHA; enriched render (marker) differs (44916d47... in the durable run).
- trajectory SHA-256: 2349b3cc9dd86e34b7920c8edbf059a0d3207574063b9d4238ac3fc7dfd0bf8d
- sequence.json SHA-256: 33f03644ce82901297e33ca70a0b23192f1f1c26de39b093416475e340ece9d5
- frame SHAs: keeper-arc-marker ff36453a…, shot-on-target 7ba52249…, save-contact dec864e8… (all distinct).
- determinism: pass1/pass2 per-tick hash chains equal (replay_identical=true, asserted in-test).
- stashed_control: gkBehavior:false → no keeper designation, no marker, arc_located=false, keeper-path counters 0.
- save provenance: fixture-driven (controlled 5v5-keeper-shot-fixture.v1.json); the shot is the shooting body's own canonical CPU SHOT press (nothing scripted). Disclosed, not fabricated.
