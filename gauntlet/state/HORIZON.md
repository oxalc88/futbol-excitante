# Rolling Gauntlet horizon

## Active horizon

```yaml
horizon_version: 20
status: ACTIVE
horizon_id: "small-sided-milestone-honesty-and-visibility"
created_from_commit: 567c1a2320d6dae7a331e56bf2ea686571870f09
created_at: 2026-08-24
reason: "Horizon v19 achieved the first honest SMALL_SIDED_SHAPE milestone PASS (8/8 situations, critic ACCEPT). Reassessment finds three honesty/visibility gaps that the PASS record left open and one executability gap: (1) the durable milestone PASS record lists exit_prerequisite_accepted as the PLAYABLE_1V1 identities (MUTANT_1V1_PASS, ARCHETYPE_BLINDED_COMPARISON) instead of the SMALL_SIDED_SHAPE profile's declared exit prereqs (MUTANT_TEAM_PASS, TEAM_SHAPE_SUITE_PASS) — the profile reducer only checks the boolean so this identity mismatch passed silently, a coherence defect worth correcting honestly; (2) the milestone's 8 visual_readability_dimensions (ball_readability_under_congestion, team_classification, facing_orientation, action_recognition, contact_comprehension, team_shape_readability, camera_readability, silhouette_stability) have zero executable evidence mapping — the natural observable browser-facing completion of the milestone bundle; (3) the required BROWSER-SMALL-SIDED-001 browser execution path predates the fixture/engine changes (shot-resolution, duel-rejection) that produced the 8/8 PASS, so its browser/headless coherence against the resolved fixtures is unvalidated; (4) no executable small-sided profile reducer wires the team exit prereqs (mutant-team.ts, team-shape-evaluator.ts) into a machine path (playable-evaluator.ts hardcodes only 1v1 exits). Boundary: goalkeepers, regulation rules, and full-match ecology remain deferred; no PROMOTION-tier verdict is claimed because §8/§11 policies are not executable."
current_index: 2
objectives:
  - id: SMALL-SIDED-EXIT-PREREQ-IDENTITY
    status: accepted
    reason: "Correct the durable SMALL_SIDED_SHAPE milestone PASS record's exit_prerequisite_accepted identity from the PLAYABLE_1V1 names (MUTANT_1V1_PASS, ARCHETYPE_BLINDED_COMPARISON) to the profile's declared exit prerequisites (MUTANT_TEAM_PASS, TEAM_SHAPE_SUITE_PASS, from eval/contracts/profiles.ts SMALL_SIDED_SHAPE_PROFILE). Re-run milestone:evaluate with the corrected input, regenerate the milestone record + bundle, and add a binding assertion locking the exit-prereq identity to the profile. Both team prereqs already exist and pass as evidence objectives (MUTANT_TEAM_PASS-EVIDENCE, TEAM-SHAPE-SUITE-PASS-EVIDENCE). Honesty/coherence; no new gameplay."
    builder: builder-structured
    prerequisite: null
  - id: SMALL-SIDED-VISUAL-READABILITY-EVIDENCE
    status: accepted
    reason: "Materialize event-centered DYNAMIC_VISUAL semantic frame sequences demonstrating the milestone's 8 visual_readability_dimensions are observable in small-sided play, mapped to the required situations. Honest evidence materialization for reviewer/perceptual readability judgment — NOT a numeric readability PASS (VISUAL_SPEC defers thresholds). Browser-facing completion of the milestone bundle; non-blank, distinct, situation-tied frames."
    builder: builder-gameplay
    prerequisite: [BROWSER-SMALL-SIDED-001-CASE, SMALL-SIDED-SITUATIONS-BATCH-5]
  - id: BROWSER-SMALL-SIDED-001-COHERENCE-RERUN
    status: pending
    reason: "Re-attest the BROWSER-SMALL-SIDED-001 browser case (browser+headless hash correspondence) on the resolved fixtures (shot-resolution + duel-rejection + extended) that produced the 8/8 situation PASS, so the milestone's required BROWSER execution path is proven coherent with the fixture/engine changes underlying the PASS. Evidence class BROWSER_VISUAL/DYNAMIC_VISUAL."
    builder: builder-gameplay
    prerequisite: [SHOT-RESULT-RESOLUTION-FIXTURE, DUEL-REJECTION-FIXTURE]
  - id: SMALL-SIDED-PROFILE-REDUCER-EXTENSION
    status: pending
    reason: "Add an executable small-sided milestone profile reducer (or extend the exit-prereq handler) wiring the SMALL_SIDED exit prerequisites MUTANT_TEAM_PASS (mutant-team.ts) and TEAM_SHAPE_SUITE_PASS (team-shape-evaluator.ts) into a machine path, replacing playable-evaluator.ts's hardcoded 1v1-only handling. Framed strictly as exit-prereq executability, NOT a §2.3/§8 PROMOTION-tier verdict (those policies/reference campaign are not executable). Audit-only honesty objective."
    builder: builder-structured
    prerequisite: SMALL-SIDED-EXIT-PREREQ-IDENTITY
observable_progress_target: "SMALL_SIDED_SHAPE milestone record is honest (correct exit-prereq identity) and its browser/visual dimension is evidenced (8 visual_readability_dimensions with event-centered DYNAMIC_VISUAL sequences, browser path re-attested on resolved fixtures). NO regulation/goalkeeper/full-match work; NO PROMOTION-overclaim."
last_invalidation_reason: "Horizon v19 EXHAUSTED 4/4 with first honest SMALL_SIDED_SHAPE PASS; reassessment at exhaustion surfaced exit-prereq-identity coherence gap, unevidenced visual-readability dimensions, stale browser-path coherence, and no executable team-exit reducer. Boundary: GK/regulation/full-match deferred."
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker
```

## Completed horizons

Horizon v20 (small-sided-milestone-honesty-and-visibility) — ACTIVE 2/4: SMALL-SIDED-EXIT-PREREQ-IDENTITY accepted (milestone record exit-prereq identity corrected; PASS preserved). SMALL-SIDED-VISUAL-READABILITY-EVIDENCE accepted (24 event-centered DYNAMIC_VISUAL frames for the 8 readability dimensions; critic + integration ACCEPT; SHA-reuse resolved VALID).
Horizon v19 (small-sided-milestone-completion) — EXHAUSTED: 4/4 accepted. SHOT/DUEL fixture objectives closed the two FAIL gaps; BATCH-5 consolidated 8/8 situation PASS; MILESTONE-RERUN-3 achieved SMALL_SIDED_SHAPE honest PASS (critic ACCEPT) with milestone bundle superseded (history: 8 NOT_EVALUATED → 3 FAIL → NEEDS_PERCEPTUAL_REVIEW → PASS).
Horizon v18 (event-diversity-through-evaluator-fix) — EXHAUSTED: 3/3 accepted. isRelevantEvent indicative fix applied; BATCH-4 6 PASS/2 FAIL; milestone FAIL honest (6/8); bundle generated.
Horizon v17 (driven-fixture-event-extension) — EXHAUSTED: 3/3 accepted. Milestone FAILED (7/8 FAIL).
Horizon v16 (driven-situations-and-small-sided-milestone) — EXHAUSTED: 5/5 accepted.