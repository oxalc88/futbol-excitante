# Rolling Gauntlet horizon

```yaml
horizon_version: 15
status: ACTIVE
horizon_id: "small-sided-situations-and-browser-case"
created_from_commit: 6afc73b190302d6d8af58ad06b9b1a71f382166a
created_at: 2026-08-23
reason: "Horizon team-decision-profile-and-small-sided exhausted (4/4). SMALL_SIDED_SHAPE entry and exit prerequisite gates now PASS from live eval.json (PLAYABLE_1V1, TEAM_DECISION_PROFILE, MUTANT_TEAM_PASS, TEAM_SHAPE_SUITE_PASS), but the eight required gameplay situations are all NOT_EVALUATED and BROWSER-SMALL-SIDED-001 is not materialized. New horizon materializes executable 3v3 situation fixtures and evaluation, produces honest per-situation evidence, materializes the required browser case, then re-evaluates the milestone."
current_index: 3
objectives:
  - id: SMALL-SIDED-SITUATION-FIXTURES
    status: accepted
    reason: "Materialize executable 3v3 scenario fixtures plus event/observation mapping for the eight SMALL_SIDED situations. Register in eval contracts. Unit tests only."
    builder: builder-structured
    prerequisite: null
  - id: SMALL-SIDED-SITUATION-EVALUATOR
    status: accepted
    reason: "Add an eval-layer runner producing per-situation trajectory and event evidence (eval.json per situation) with honest verdicts. No situation PASS invented."
    builder: builder-structured
    prerequisite: SMALL-SIDED-SITUATION-FIXTURES
  - id: SMALL-SIDED-SITUATIONS-BATCH-1
    status: accepted
    reason: "Execute honest evaluation evidence for PASS_RECEPTION, SHOT_TO_RESULT, PHYSICAL_DUEL, SUPPORT_AND_PASSING_LANES against 3v3 fixtures. Accept even if a situation FAILs."
    builder: builder-structured
    prerequisite: SMALL-SIDED-SITUATION-EVALUATOR
  - id: SMALL-SIDED-SITUATIONS-BATCH-2
    status: pending
    reason: "Execute honest evaluation evidence for SETTLED_ATTACK_VS_DEFENCE, ATTACK_TO_DEFENCE_TRANSITION, DEFENCE_TO_ATTACK_TRANSITION, COORDINATED_PRESS against 3v3 fixtures."
    builder: builder-structured
    prerequisite: SMALL-SIDED-SITUATIONS-BATCH-1
  - id: BROWSER-SMALL-SIDED-001-CASE
    status: pending
    reason: "Materialize required browser case BROWSER-SMALL-SIDED-001 with hash cross-check and semantic frame sequence (DYNAMIC_VISUAL).",
    builder: builder-structured
    prerequisite: SMALL-SIDED-SITUATIONS-BATCH-2
  - id: SMALL-SIDED-MILESTONE-RE-EVALUATION
    status: pending
    reason: "Re-run SMALL_SIDED_SHAPE milestone:evaluate with all situation evidence and the browser case; critic judges; derive milestone bundle. Honest PASS only if every required item passes.",
    builder: builder-structured
    prerequisite: BROWSER-SMALL-SIDED-001-CASE
observable_progress_target: "SMALL_SIDED_SHAPE moves from eight-situation NOT_EVALUATED to real per-situation verdicts, a materialized BROWSER-SMALL-SIDED-001 case, and an honest milestone re-evaluation."
infrastructure_only_justification: "Situation fixtures/evaluator are required before any per-situation evidence can exist; the horizon ends in the observable milestone re-evaluation and required browser case."
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