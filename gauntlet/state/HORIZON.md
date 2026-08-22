# Rolling Gauntlet horizon

```yaml
horizon_version: 13
status: ACTIVE
horizon_id: "entry-prereq-executable-evidence"
created_from_commit: 2d466a167e57511381928357f33b1f1337c7ad07
created_at: 2026-08-22
reason: "Horizon playable-1v1-entry-prereq-caller exhausted (3/3). PLAYABLE_1V1 is honest BLOCKED_MISSING_REFERENCE because docs/evidence/FOUNDATION_LAB_PASS and CAPABILITY_DESIGN_PROFILE do not exist. FOUNDATION-PROMOTION and CAPABILITY-DESIGN-PROFILE are accepted Gauntlet objectives, not those milestone evidence dirs. The current resolver treats Gauntlet audit PASS as prereq PASS, which would invent FOUNDATION_LAB_PASS if those dirs were created without executable eval.json. New horizon first binds the resolver to executable milestone verdicts, then persists honest evaluateFoundationLab / evaluateCapabilityDesign evidence, then re-runs 1v1 and SMALL_SIDED."
current_index: 3
objectives:
  - id: ENTRY-PREREQ-RESOLVER-EVAL-JSON
    status: accepted
    reason: "resolveEntryPrereqOutcomes must consume eval.json milestone/overall verdict. Missing eval.json stays BLOCKED_MISSING_REFERENCE. Gauntlet audit PASS must not become FOUNDATION_LAB_PASS."
    builder: builder-structured
    prerequisite: null
  - id: FOUNDATION-LAB-PASS-EVIDENCE
    status: accepted
    reason: "Execute evaluateFoundationLab with durable BROWSER-CORE-EVIDENCE. Persist honest eval.json under docs/evidence/FOUNDATION_LAB_PASS. Do not invent PASS."
    builder: builder-structured
    prerequisite: ENTRY-PREREQ-RESOLVER-EVAL-JSON
  - id: CAPABILITY-DESIGN-PROFILE-EVIDENCE
    status: accepted
    reason: "Execute evaluateCapabilityDesign. Persist honest eval.json under docs/evidence/CAPABILITY_DESIGN_PROFILE. Do not invent PASS."
    builder: builder-structured
    prerequisite: FOUNDATION-LAB-PASS-EVIDENCE
  - id: PLAYABLE-1V1-AFTER-PREREQ-EVIDENCE
    status: pending
    reason: "Re-run PLAYABLE_1V1 after executable prereq evidence. Expect remaining honest FAIL/NPR/NOT_EVALUATED/BLOCKED_MISSING_REFERENCE unless both prereqs actually PASS."
    builder: builder-structured
    prerequisite: CAPABILITY-DESIGN-PROFILE-EVIDENCE
  - id: SMALL-SIDED-AFTER-PREREQ-EVIDENCE
    status: pending
    reason: "Re-attempt SMALL_SIDED_SHAPE. Remains NOT_EVALUATED unless PLAYABLE_1V1_PASS is actually achieved."
    builder: builder-structured
    prerequisite: PLAYABLE-1V1-AFTER-PREREQ-EVIDENCE
observable_progress_target: "PLAYABLE_1V1 entry prereqs reflect executable FOUNDATION_LAB / capability-design verdicts instead of missing dirs or Gauntlet audit PASS."
infrastructure_only_justification: "Resolver + evidence binding must precede the 1v1 rerun so audit PASS cannot be mistaken for FOUNDATION_LAB_PASS; the horizon still ends in playable-milestone re-evaluation."
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
