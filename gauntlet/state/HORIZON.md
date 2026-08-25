# Rolling Gauntlet horizon

## Active horizon

```yaml
horizon_version: 21
status: ACTIVE
horizon_id: "small-sided-playable-coherence-and-team-depth"
created_from_commit: b7d8e67
created_at: 2026-08-25
reason: "Horizon v20 (EXHAUSTED 4/4) delivered SMALL_SIDED_SHAPE honesty, visibility, and executability: 8/8 situations PASS on resolved driven fixtures, 8 visual-readability dimensions evidenced (DYNAMIC_VISUAL), BROWSER path re-attested, and team exit prereqs (MUTANT_TEAM_PASS/TEAM_SHAPE_SUITE_PASS) made executable. Reassessment at exhaustion finds the milestone is honest but fixture-sourced: the situations are proven on purpose-built driven fixtures, not localized from a coherent continuous playable match (all are final_match_required), and the action_recognition readability dimension is honestly NEEDS_PERCEPTUAL_REVIEW because the CPU-only fixture emits no discrete kick/pass/shot. v21 ties the milestone situations and team behaviours to a coherent human-playable small-sided browser match, closes the disclosed action-observability evidence gap, and adds remaining small-sided team/playable depth (incl. full 5v5 human-vs-CPU). Boundary: goalkeepers, regulation rules, and full-match ecology remain deferred until their dedicated specs; NO invented perceptual rubric or PES envelopes; NO PROMOTION-tier verdict (policies not executable)."
current_index: 0
objectives:
  - id: SMALL-SIDED-MATCH-SITUATION-SCANNER
    status: pending
    reason: "Extend the small-sided situation evaluator/mapping (eval/contracts/situation-mapping.ts + eval/runners/small-sided-situation-evaluator.ts) to locate the 8 milestone situations organically inside a single continuous small-sided match (ai 3v3/5v5) from its event+telemetry stream, instead of purpose-built driven fixtures — the deterministic machine backbone that grounds the milestone in a coherent playable match. HEADLESS."
    builder: builder-structured
    prerequisite: SMALL-SIDED-SITUATION-EVALUATOR
  - id: SMALL-SIDED-INTEGRATED-PLAYTEST-MATCH
    status: pending
    reason: "Materialize the integrated playable small-sided match playtest running the resolved situations through the scanner on coherent CPU-vs-CPU and human-vs-CPU 3v3/5v5 matches, producing per-situation event-centered DYNAMIC_VISUAL evidence that ties SMALL_SIDED_SHAPE to the actual browseable experience (final_match_required) rather than isolated lab fixtures. DYNAMIC_VISUAL."
    builder: builder-gameplay
    prerequisite: SMALL-SIDED-MATCH-SITUATION-SCANNER
  - id: SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH
    status: pending
    reason: "Deepen COORDINATED_PRESS (press+cover responsibilities) and SUPPORT_AND_PASSING_LANES (support without abandoning structure) in genuine small-sided play beyond the lab fixtures — remaining team/tactics depth within small-sided, not crossing GK/regulation; evidenced by team-geometry trajectories. MULTI_TICK."
    builder: builder-gameplay
    prerequisite: CPU-DEFENSIVE-ORGANIZATION
  - id: SMALL-SIDED-ACTION-EVENT-OBSERVABILITY
    status: pending
    reason: "Close the disclosed action_recognition gap in the milestone bundle by capturing event-centered frames at discrete pass/shot/contact events in a mixed human/CPU small-sided match so the action_recognition readability dimension is observable — honest observability evidence, NOT an invented perceptual rubric. DYNAMIC_VISUAL."
    builder: builder-gameplay
    prerequisite: SMALL-SIDED-INTEGRATED-PLAYTEST-MATCH
  - id: SMALL-SIDED-5V5-HUMAN-VS-CPU
    status: pending
    reason: "Complete the playable small-sided ladder with a full 5v5 human-vs-CPU match mode (currently only 5v3 human-vs-CPU and 5v5 AI exist) — an observable browser capability deepening small-sided playability without crossing GK/regulation. DYNAMIC_VISUAL."
    builder: builder-gameplay
    prerequisite: BROWSER-5V5-MATCH
  - id: SMALL-SIDED-PLAYTEST-RE-RUN
    status: pending
    reason: "Re-run the SMALL_SIDED_SHAPE milestone reducer adding the coherent-match situation evidence as a supplementary source beside the driven fixtures, preserving the honest PASS while strengthening the final_match_required/integrated_playtest closure; evidence-bundle only, no gameplay change. BOOKKEEPING."
    builder: builder-structured
    prerequisite: SMALL-SIDED-INTEGRATED-PLAYTEST-MATCH
observable_progress_target: "A coherent human-playable small-sided match (3v3 & 5v5, human-vs-CPU and CPU-vs-CPU) in the browser where the 8 SMALL_SIDED_SHAPE situations and team behaviours (press/support/transitions) are demonstrable from one continuous match with event-centered evidence, and full 5v5 human-vs-CPU is playable. NO GK/regulation/full-match/perceptual-rubric/networked/PES-fidelity work; NO PROMOTION overclaim."
last_invalidation_reason: "Horizon v20 EXHAUSTED 4/4: SMALL_SIDED_SHAPE honesty, visibility, and executability delivered. Reassessment surfaced that the milestone PASS is fixture-sourced (not localized from a coherent continuous playable match; all situations final_match_required) and action_recognition remains honestly NEEDS_PERCEPTUAL_REVIEW. Boundary: GK/regulation/full-match deferred."
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

Horizon v20 (small-sided-milestone-honesty-and-visibility) — EXHAUSTED 4/4: SMALL-SIDED-EXIT-PREREQ-IDENTITY accepted (milestone record exit-prereq identity corrected to MUTANT_TEAM_PASS/TEAM_SHAPE_SUITE_PASS; PASS preserved). SMALL-SIDED-VISUAL-READABILITY-EVIDENCE accepted (24 event-centered DYNAMIC_VISUAL frames for the 8 readability dimensions; critic + integration ACCEPT; SHA-reuse resolved VALID). BROWSER-SMALL-SIDED-001-COHERENCE-RERUN accepted (browser/headless hash correspondence re-attested across the three resolved driven fixtures; critic + integration ACCEPT; audit PASS). SMALL-SIDED-PROFILE-REDUCER-EXTENSION accepted (executable team-exit prereq reducer wiring MUTANT_TEAM_PASS/TEAM_SHAPE_SUITE_PASS; critic + integration ACCEPT; audit PASS).
Horizon v19 (small-sided-milestone-completion) — EXHAUSTED: 4/4 accepted. SHOT/DUEL fixture objectives closed the two FAIL gaps; BATCH-5 consolidated 8/8 situation PASS; MILESTONE-RERUN-3 achieved SMALL_SIDED_SHAPE honest PASS (critic ACCEPT) with milestone bundle superseded (history: 8 NOT_EVALUATED → 3 FAIL → NEEDS_PERCEPTUAL_REVIEW → PASS).
Horizon v18 (event-diversity-through-evaluator-fix) — EXHAUSTED: 3/3 accepted. isRelevantEvent indicative fix applied; BATCH-4 6 PASS/2 FAIL; milestone FAIL honest (6/8); bundle generated.
Horizon v17 (driven-fixture-event-extension) — EXHAUSTED: 3/3 accepted. Milestone FAILED (7/8 FAIL).
Horizon v16 (driven-situations-and-small-sided-milestone) — EXHAUSTED: 5/5 accepted.
