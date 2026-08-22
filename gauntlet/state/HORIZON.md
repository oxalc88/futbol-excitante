# Rolling Gauntlet horizon

```yaml
horizon_version: 11
status: ACTIVE
horizon_id: "playable-1v1-deterministic-two-run"
created_from_commit: d52990c29b34f68c14f0e6b01d43608326a13aeb
created_at: 2026-08-22
reason: "Horizon arch-diff-frame-binding-and-1v1-rerun exhausted (3/3). PLAYABLE_1V1 is honest NOT_EVALUATED: CORE/CONTROL/ARCH-DIFF/archetype PASS, but COMMON-DETERMINISTIC stays NOT_EVALUATED on the single-run path. A two-run compare path already exists in foundation promotion. SMALL_SIDED_SHAPE remains NOT_EVALUATED. New horizon binds that two-run check into PLAYABLE_1V1 without inventing envelopes, re-runs the profile, and re-attempts SMALL_SIDED_SHAPE only if 1v1 actually passes."
current_index: 2
objectives:
  - id: PLAYABLE-1V1-DETERMINISTIC-TWO-RUN
    status: accepted
    reason: "Wire existing two-run COMMON-DETERMINISTIC comparison into PLAYABLE_1V1 evaluation. Honest PASS/FAIL/BLOCKED_MISSING_REFERENCE. Do not invent envelopes."
    builder: builder-structured
    prerequisite: null
  - id: PLAYABLE-1V1-AFTER-DETERMINISTIC-TWO-RUN
    status: accepted
    reason: "Re-run PLAYABLE_1V1 after the two-run bind. Expect remaining honest NOT_EVALUATED/FAIL, not a forced PASS."
    builder: builder-structured
    prerequisite: PLAYABLE-1V1-DETERMINISTIC-TWO-RUN
  - id: SMALL-SIDED-AFTER-DETERMINISTIC
    status: pending
    reason: "Re-attempt SMALL_SIDED_SHAPE. Remains NOT_EVALUATED unless PLAYABLE_1V1_PASS is actually achieved."
    builder: builder-structured
    prerequisite: PLAYABLE-1V1-AFTER-DETERMINISTIC-TWO-RUN
observable_progress_target: "PLAYABLE_1V1 no longer leaves COMMON-DETERMINISTIC as an unexecuted single-run NOT_EVALUATED when a two-run compare path exists."
infrastructure_only_justification: "Evaluator binding is required so PLAYABLE_1V1 can leave catalog NOT_EVALUATED; the horizon still ends in a playable-milestone re-evaluation."
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
