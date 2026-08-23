# Rolling Gauntlet horizon

```yaml
horizon_version: 14
status: EXHAUSTED
horizon_id: "team-decision-profile-and-small-sided"
created_from_commit: c9ff1613d4c28857dc8db9fb7ef9e475e7fb6fdf
created_at: 2026-08-22
reason: "Horizon entry-prereq-executable-evidence exhausted (5/5). PLAYABLE_1V1 live profile-runner PASS. SMALL_SIDED_SHAPE remains NOT_EVALUATED because TEAM_DECISION_PROFILE has no executable eval.json (CPU-TEAM-DECISION-PROFILE is a different identity), MUTANT_TEAM_PASS and TEAM_SHAPE_SUITE_PASS lack eval.json, and eight situations are unevaluated. New horizon binds honest TEAM_DECISION_PROFILE / mutant-team / team-shape evidence then re-runs SMALL_SIDED."
current_index: 4
objectives:
  - id: TEAM-DECISION-PROFILE-EVIDENCE
    status: accepted
    reason: "Persist honest TEAM_DECISION_PROFILE eval.json. Do not treat CPU-TEAM-DECISION-PROFILE Gauntlet evidence as TEAM_DECISION_PROFILE. Do not invent PASS."
    builder: builder-structured
    prerequisite: null
  - id: MUTANT-TEAM-PASS-EVIDENCE
    status: accepted
    reason: "Execute evaluateMutantTeam. Persist honest eval.json under docs/evidence/MUTANT_TEAM_PASS. Do not invent PASS."
    builder: builder-structured
    prerequisite: TEAM-DECISION-PROFILE-EVIDENCE
  - id: TEAM-SHAPE-SUITE-PASS-EVIDENCE
    status: accepted
    reason: "Execute team-shape-evaluator. Persist honest eval.json under docs/evidence/TEAM_SHAPE_SUITE_PASS. Do not invent PASS."
    builder: builder-structured
    prerequisite: MUTANT-TEAM-PASS-EVIDENCE
  - id: SMALL-SIDED-AFTER-TEAM-PREREQS
    status: accepted
    reason: "Re-attempt SMALL_SIDED_SHAPE after executable team prereqs. Remains NOT_EVALUATED unless required situations and prereqs actually PASS."
    builder: builder-structured
    prerequisite: TEAM-SHAPE-SUITE-PASS-EVIDENCE
observable_progress_target: "SMALL_SIDED_SHAPE can leave TEAM_DECISION_PROFILE / mutant-team / team-shape as missing-dir NOT_EVALUATED and report honest executable verdicts instead."
infrastructure_only_justification: "Executable team-prereq evidence must precede another SMALL_SIDED rerun so CPU-TEAM-DECISION-PROFILE audit PASS cannot be mistaken for TEAM_DECISION_PROFILE; the horizon still ends in a playable-milestone re-evaluation."
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
