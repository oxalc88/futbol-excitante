# Rolling Gauntlet horizon

```yaml
horizon_version: 9
status: ACTIVE
horizon_id: "remaining-archetype-visuals-and-1v1-rerun"
created_from_commit: c46791a3211ccd999bb55fd918cf93f4bd06a749
created_at: 2026-08-22
reason: "Horizon playable-1v1-control-and-archetype-render exhausted (5/5). PLAYABLE_1V1 is honest FAIL: CONTROL/CORE PASS, ARCH-DIFF-001 NPR, ARCHETYPE_BLINDED_COMPARISON_PASS FAIL because technical/power/agility still share baseline pixels (burst vs steady already distinguishable). SMALL_SIDED_SHAPE remains NOT_EVALUATED. New horizon adds provisional remaining-archetype visuals, recaptures identical-condition pairs, re-runs PLAYABLE_1V1 without forcing PASS, and re-attempts SMALL_SIDED_SHAPE only if 1v1 actually passes."
current_index: 1
objectives:
  - id: ARCHETYPE-REMAINING-VISUALS
    status: accepted
    reason: "Give technical/power/agility versioned provisional renderer mappings so remaining comparison pairs are not byte-identical. No PES meshes or invented envelopes. Snapshot-only presentation."
    builder: builder-gameplay
    prerequisite: null
  - id: ARCHETYPE-FULL-PAIR-RECAPTURE
    status: pending
    reason: "Recapture identical-condition frames for all comparison pairs after remaining visuals exist. Honest hash diffs; do not theatrical-PASS via spawn offset."
    builder: builder-gameplay
    prerequisite: ARCHETYPE-REMAINING-VISUALS
  - id: PLAYABLE-1V1-AFTER-REMAINING-ARCHETYPES
    status: pending
    reason: "Re-run PLAYABLE_1V1 after remaining-archetype recapture. Expect remaining honest blockers (ARCH-DIFF NPR and/or comparison FAIL). Do not force PLAYABLE_1V1_PASS."
    builder: builder-structured
    prerequisite: ARCHETYPE-FULL-PAIR-RECAPTURE
  - id: SMALL-SIDED-SHAPE-AFTER-1V1
    status: pending
    reason: "Re-attempt SMALL_SIDED_SHAPE. Remains NOT_EVALUATED unless PLAYABLE_1V1_PASS is actually achieved."
    builder: builder-structured
    prerequisite: PLAYABLE-1V1-AFTER-REMAINING-ARCHETYPES
observable_progress_target: "Remaining archetype IDs become visually distinguishable under identical camera/task; PLAYABLE_1V1 re-evaluation uses those frames rather than baseline-identical FAIL."
infrastructure_only_justification: "All objectives produce browser-visible or evaluation-visible 1v1 progress."
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
