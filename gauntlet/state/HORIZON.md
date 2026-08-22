# Rolling Gauntlet horizon

```yaml
horizon_version: 12
status: ACTIVE
horizon_id: "playable-1v1-entry-prereq-caller"
created_from_commit: 340329da8bd1e66f77a0b4a540f2bda0a4e728e6
created_at: 2026-08-22
reason: "Horizon playable-1v1-deterministic-two-run exhausted (3/3). PLAYABLE_1V1 is honest NOT_EVALUATED solely because entry prereqs FOUNDATION_LAB_PASS and CAPABILITY_DESIGN_PROFILE are unverified by the caller even though CORE/CONTROL/ARCH-DIFF/archetype/COMMON-DETERMINISTIC/MUTANT_1V1 pass. SMALL_SIDED_SHAPE remains NOT_EVALUATED. New horizon lets the caller pass only executable, already-accepted prerequisite evidence into evaluatePlayable1v1 — no fake FOUNDATION_LAB_PASS — then re-runs 1v1 and SMALL_SIDED honestly."
current_index: 2
objectives:
  - id: PLAYABLE-1V1-ENTRY-PREREQ-CALLER
    status: accepted
    reason: "Let the PLAYABLE_1V1 runner pass caller-verified entry prereqs from accepted executable evidence. Do not invent FOUNDATION_LAB_PASS. Honest PASS/FAIL/NOT_EVALUATED/BLOCKED_MISSING_REFERENCE."
    builder: builder-structured
    prerequisite: null
  - id: PLAYABLE-1V1-AFTER-ENTRY-PREREQS
    status: accepted
    reason: "Re-run PLAYABLE_1V1 after caller wiring. Expect remaining honest NOT_EVALUATED/FAIL, not a forced PASS."
    builder: builder-structured
    prerequisite: PLAYABLE-1V1-ENTRY-PREREQ-CALLER
  - id: SMALL-SIDED-AFTER-ENTRY-PREREQS
    status: pending
    reason: "Re-attempt SMALL_SIDED_SHAPE. Remains NOT_EVALUATED unless PLAYABLE_1V1_PASS is actually achieved."
    builder: builder-structured
    prerequisite: PLAYABLE-1V1-AFTER-ENTRY-PREREQS
observable_progress_target: "PLAYABLE_1V1 entry prereqs stop being blank NOT_EVALUATED when accepted executable evidence already exists."
infrastructure_only_justification: "Caller wiring is required so PLAYABLE_1V1 can leave unverified-prereq NOT_EVALUATED; the horizon still ends in a playable-milestone re-evaluation."
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
