# Rolling Gauntlet horizon

```yaml
horizon_version: 16
status: ACTIVE
horizon_id: "driven-situations-and-small-sided-milestone"
created_from_commit: 0e50a45f2f059bed1b38367fe316529c437dae1c
created_at: 2026-08-23
reason: "Horizon small-sided-situations-and-browser-case invalidated by evidence: SMALL-SIDED-SITUATIONS-BATCH-1 ran the accepted 3v3 situation fixture and produced zero simulation events in 600 ticks (inputProgram empty, no scheduled events), so all eight situations are honestly NOT_EVALUATED and BATCH-2 plus the milestone re-eval could only repeat NOT_EVALUATED. New horizon first drives the situation fixtures with deterministic inputs/CPU behavior so pass/shot/contact/transition events actually occur, then re-runs batch evidence, materializes BROWSER-SMALL-SIDED-001, and re-evaluates the milestone."
current_index: 1
objectives:
  - id: SITUATION-FIXTURE-DRIVING
    status: accepted
    reason: "Add deterministic input/CPU drives to the accepted situation and transition fixtures so pass, shot, contact, possession-loss and press events actually emit. Unit tests assert required events occur. No physics invention."
    builder: builder-structured
    prerequisite: null
  - id: SMALL-SIDED-SITUATIONS-BATCH-1-RERUN
    status: pending
    reason: "Re-execute the situation evaluator on driven fixtures; persist honest verdicts for PASS_RECEPTION, SHOT_TO_RESULT, PHYSICAL_DUEL, SUPPORT_AND_PASSING_LANES. Accept FAIL/NOT_EVALUATED if events still absent."
    builder: builder-structured
    prerequisite: SITUATION-FIXTURE-DRIVING
  - id: SMALL-SIDED-SITUATIONS-BATCH-2-RERUN
    status: pending
    reason: "Same for SETTLED_ATTACK_VS_DEFENCE, ATTACK_TO_DEFENCE_TRANSITION, DEFENCE_TO_ATTACK_TRANSITION, COORDINATED_PRESS (transition fixture driven)."
    builder: builder-structured
    prerequisite: SMALL-SIDED-SITUATIONS-BATCH-1-RERUN
  - id: BROWSER-SMALL-SIDED-001-CASE
    status: pending
    reason: "Materialize required browser case BROWSER-SMALL-SIDED-001 with hash cross-check and semantic frames (DYNAMIC_VISUAL)."
    builder: builder-structured
    prerequisite: SMALL-SIDED-SITUATIONS-BATCH-2-RERUN
  - id: SMALL-SIDED-MILESTONE-RE-EVALUATION
    status: pending
    reason: "Re-run SMALL_SIDED_SHAPE milestone:evaluate with driven situation evidence and the browser case; critic judges; derive bundle. Honest verdict only."
    builder: builder-structured
    prerequisite: BROWSER-SMALL-SIDED-001-CASE
observable_progress_target: "SMALL_SIDED_SHAPE obtains real per-situation verdicts from driven 3v3 fixtures, a materialized BROWSER-SMALL-SIDED-001 case, and an honest milestone re-evaluation."
infrastructure_only_justification: "Driving the fixtures is required before any per-situation evidence can exist; the horizon still ends in the observable milestone re-evaluation and required browser case."
last_invalidation_reason: "BATCH-1 evidence: situation fixtures emit zero events (empty input program), so BATCH-2/milestone could not progress beyond NOT_EVALUATED."
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker
```