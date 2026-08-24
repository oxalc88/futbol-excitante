# Rolling Gauntlet horizon

## Active horizon

```yaml
horizon_version: 18
status: ACTIVE
horizon_id: "event-diversity-through-evaluator-fix"
created_from_commit: 8393a8199a3107f26573e9a0d134687595d9b587
created_at: 2026-08-23
reason: "Horizon v17 milestone FAILED (7/8 FAIL) because second-touch events from extended fixtures are not recognized as indicative for PASS_RECEPTION / SUPPORT_AND_PASSING_LANES — the evaluator's isRelevantEvent() function does not include second-touch in the indicative_event_kinds. New horizon first fixes the evaluator mapping to include second-touch, then re-runs batch evidence and milestone."
current_index: 1
objectives:
  - id: EVALUATOR-ISRELEVANT-FIX
    status: accepted
    reason: "Fix eval/runners/small-sided-situation-evaluator.ts isRelevantEvent() to include second-touch, ball-out-of-play, and pitch-contact as indicative kinds where the situation-mapping defines them. Also fix SUPPORT_AND_PASSING_LANES indicative kinds if second-touch is missing there. This is a minimal evaluator change required for honest verdicts from extended fixtures."
    builder: builder-structured
    prerequisite: null
  - id: SMALL-SIDED-SITUATIONS-BATCH-4
    status: pending
    reason: "Re-run situation evaluator on extended fixtures after evaluator fix. Verify PASS_RECEPTION and SUPPORT_AND_PASSING_LANES now PASS where second-touch was emitted."
    builder: builder-structured
    prerequisite: EVALUATOR-ISRELEVANT-FIX
  - id: SMALL-SIDED-MILESTONE-RERUN-2
    status: pending
    reason: "Re-run SMALL_SIDED_SHAPE milestone:evaluate with corrected batch evidence."
    builder: builder-structured
    prerequisite: SMALL-SIDED-SITUATIONS-BATCH-4
observable_progress_target: "SMALL_SIDED_SHAPE obtains honest per-situation verdicts with second-touch correctly recognized as indicative."
last_invalidation_reason: "Horizon v17 evaluator did not fix isRelevantEvent() to recognize second-touch as indicative, causing honest FAIL where second-touch was present."
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker
```

## Completed horizons

Horizon v17 (driven-fixture-event-extension) — EXHAUSTED: 3/3 accepted. Milestone FAILED (7/8 FAIL).
Horizon v16 (driven-situations-and-small-sided-milestone) — EXHAUSTED: 5/5 accepted.
