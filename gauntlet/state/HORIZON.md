# Rolling Gauntlet horizon

```yaml
horizon_version: 7
status: ACTIVE
horizon_id: "playable-1v1-browser-evidence"
created_from_commit: e997a538f375f3259297e93606d801bc3c679bc6
created_at: 2026-08-20
reason: "Horizon playable-1v1-enabler exhausted (6/6 accepted including sentinel). PLAYABLE_1V1 profile evaluation returned INVALID_RUN due to missing browser evidence and ARCHETYPE_BLINDED_COMPARISON_PASS NOT_EVALUATED (no disk artifacts). New horizon focuses on browser evidence capture and perceptual rubric implementation to enable PLAYABLE_1V1_PASS evaluation."
current_index: 0
objectives:
  - id: BROWSER-CORE-EVIDENCE
    status: pending
    reason: "Capture required browser evidence (BROWSER-CORE-RESET-001, BROWSER-CORE-STEP-001) for the PLAYABLE_1V1 profile evaluation. Enables PLAYABLE_1V1 profile to move from INVALID_RUN toward evaluation."
    builder: builder-gameplay
    prerequisite: null
  - id: ARCH-DIFF-001-RUBRIC
    status: pending
    reason: "Implement versioned perceptual rubric for ARCH-DIFF-001 (archetype visual difference detection). Required for ARCHETYPE_BLINDED_COMPARISON_PASS from NOT_EVALUATED to PASS or FAIL."
    builder: builder-structured
    prerequisite: null
  - id: ARCHETYPE-BROWSER-CAPTURE
    status: pending
    reason: "Capture archetype comparison browser artifacts (PNG frames via Playwright/2D canvas) for PLAYABLE_1V1 profile evaluation. Enables ARCHETYPE_BLINDED_COMPARISON_PASS from NOT_EVALUATED to PASS/FAIL."
    builder: builder-gameplay
    prerequisite: BROWSER-CORE-EVIDENCE
  - id: PLAYABLE-1V1-RE-EVALUATION
    status: pending
    reason: "Re-run PLAYABLE_1V1 profile evaluation after browser evidence and archetype artifacts are captured. Expected: INVALID_RUN → FAIL or NEEDS_PERCEPTUAL_REVIEW → PASS."
    builder: builder-structured
    prerequisite: ARCHETYPE-BROWSER-CAPTURE
  - id: SMALL-SIDED-MILESTONE-EVALUATION
    status: pending
    reason: "Attempt SMALL_SIDED_SHAPE milestone evaluation if PLAYABLE_1V1_PASS is achieved. Otherwise reports NOT_EVALUATED with clear blockers documented."
    builder: builder-structured
    prerequisite: PLAYABLE-1V1-RE-EVALUATION
observable_progress_target: "PLAYABLE_1V1 profile evaluation returns FAIL/NEEDS_PERCEPTUAL_REVIEW (no longer INVALID_RUN), enabling downstream SMALL_SIDED_SHAPE evaluation."
infrastructure_only_justification: "All objectives contribute to observable browser evidence and evaluation results."
last_invalidation_reason: null
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker