# Rolling Gauntlet horizon

```yaml
horizon_version: 10
status: ACTIVE
horizon_id: "arch-diff-frame-binding-and-1v1-rerun"
created_from_commit: e0de8b80299d1df67b59d417ea2ddd050056b865
created_at: 2026-08-22
reason: "Horizon remaining-archetype-visuals-and-1v1-rerun exhausted (4/4). PLAYABLE_1V1 is honest NEEDS_PERCEPTUAL_REVIEW: CORE/CONTROL PASS, archetype comparison PASS, ARCH-DIFF-001 still hardcoded NPR in the playable evaluator even though a versioned rubric and recapture frames exist. SMALL_SIDED_SHAPE remains NOT_EVALUATED. New horizon binds ARCH-DIFF-001 to the rubric/frames without inventing human-subject data, re-runs PLAYABLE_1V1 honestly, and re-attempts SMALL_SIDED_SHAPE only if 1v1 actually passes."
current_index: 2
objectives:
  - id: ARCH-DIFF-001-FRAME-BINDING
    status: accepted
    reason: "Stop always-NPR for ARCH-DIFF-001 when rubric and recapture frames exist. Wire playable-evaluator to the versioned rubric/disk evaluator. Honest PASS/FAIL/NPR. No invented human-subject data or PES envelopes."
    builder: builder-structured
    prerequisite: null
  - id: PLAYABLE-1V1-AFTER-ARCH-DIFF-BINDING
    status: accepted
    reason: "Re-run PLAYABLE_1V1 after ARCH-DIFF binding. Expect remaining honest NPR or FAIL, not a forced PASS."
    builder: builder-structured
    prerequisite: ARCH-DIFF-001-FRAME-BINDING
  - id: SMALL-SIDED-AFTER-ARCH-DIFF
    status: pending
    reason: "Re-attempt SMALL_SIDED_SHAPE. Remains NOT_EVALUATED unless PLAYABLE_1V1_PASS is actually achieved."
    builder: builder-structured
    prerequisite: PLAYABLE-1V1-AFTER-ARCH-DIFF-BINDING
observable_progress_target: "ARCH-DIFF-001 uses the versioned rubric and recapture frames instead of a hardcoded NPR; PLAYABLE_1V1 re-evaluation reports the honest remaining blocker."
infrastructure_only_justification: "Evaluator binding is required so PLAYABLE_1V1 can leave hardcoded NPR; the horizon still ends in a playable-milestone re-evaluation."
last_invalidation_reason: null
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker
```
