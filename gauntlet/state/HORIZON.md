# Rolling Gauntlet horizon

```yaml
horizon_version: 8
status: EXHAUSTED
horizon_id: "playable-1v1-control-and-archetype-render"
created_from_commit: d1a8bf50ced29c4d2ea1a4e53ee7959228cd6bb3
created_at: 2026-08-22
reason: "Horizon playable-1v1-browser-evidence exhausted (5/5). PLAYABLE_1V1 remains INVALID_RUN because BROWSER-1V1-CONTROL-001 has no evidence. ARCHETYPE_BLINDED_COMPARISON_PASS is honest FAIL because the renderer ignores archetypeId. New horizon captures 1v1 control browser evidence and adds honest archetype-visible presentation under identical conditions."
current_index: 5
objectives:
  - id: BROWSER-1V1-CONTROL-EVIDENCE
    status: accepted
    reason: "Capture BROWSER-1V1-CONTROL-001 browser-case evidence so PLAYABLE_1V1 is no longer INVALID_RUN solely from a missing 1v1 control case."
    builder: builder-gameplay
    prerequisite: null
  - id: ARCHETYPE-RENDER-DIFFERENCE
    status: accepted
    reason: "Make presentation/renderer show distinguishable burst vs steady (etc.) under identical camera/task without inventing PES meshes. Versioned provisional visuals only. Fixes honest FAIL of identical frames."
    builder: builder-gameplay
    prerequisite: null
  - id: ARCHETYPE-IDENTICAL-RECAPTURE
    status: accepted
    reason: "Recapture identical-condition archetype frames after renderer difference exists; disk comparison may then FAIL or PASS honestly."
    builder: builder-gameplay
    prerequisite: ARCHETYPE-RENDER-DIFFERENCE
  - id: PLAYABLE-1V1-PROFILE-RERUN
    status: accepted
    reason: "Re-run PLAYABLE_1V1 after 1v1-control evidence and (if ready) archetype recapture. Expect remaining honest blockers, not a forced PASS."
    builder: builder-structured
    prerequisite: BROWSER-1V1-CONTROL-EVIDENCE
  - id: SMALL-SIDED-SHAPE-RERUN
    status: accepted
    reason: "Re-attempt SMALL_SIDED_SHAPE. Remains NOT_EVALUATED unless PLAYABLE_1V1_PASS is actually achieved."
    builder: builder-structured
    prerequisite: PLAYABLE-1V1-PROFILE-RERUN
observable_progress_target: "BROWSER-1V1-CONTROL-001 leaves INVALID_RUN; archetype comparison uses real renderer difference rather than spawn-offset theatrical PASS."
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
