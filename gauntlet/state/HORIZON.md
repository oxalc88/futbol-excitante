# Rolling Gauntlet horizon

## Active horizon

```yaml
horizon_version: 17
status: ACTIVE
horizon_id: "driven-fixture-event-extension"
created_from_commit: ec1e054e250a09024532100a3f5c4d4a68102a25
created_at: 2026-08-23
reason: "Horizon v16 milestone FAILED (4 FAIL, 4 NOT_EVALUATED). Root cause: driven fixtures emit limited event diversity. New horizon extends input programs to produce missing indicative kinds so FAIL situations can be re-evaluated honestly."
current_index: 2
objectives:
  - id: FIXTURE-EVENT-EXTENSION
    status: accepted
    reason: "Extend input programs in the accepted situation and transition driven fixtures so all missing indicative event kinds are emitted. No physics invention — only input-driven behaviors."
    builder: builder-structured
    prerequisite: null
  - id: SMALL-SIDED-SITUATIONS-BATCH-3
    status: accepted
    reason: "Re-run situation evaluator on extended fixtures; persist honest verdicts."
    builder: builder-structured
    prerequisite: FIXTURE-EVENT-EXTENSION
  - id: SMALL-SIDED-MILESTONE-RERUN
    status: pending
    reason: "Re-run SMALL_SIDED_SHAPE milestone:evaluate with extended batch evidence and browser case. Honest verdict only."
    builder: builder-structured
    prerequisite: SMALL-SIDED-SITUATIONS-BATCH-3
observable_progress_target: "SMALL_SIDED_SHAPE obtains honest per-situation verdicts from fully-driven fixtures."
last_invalidation_reason: "Horizon v16 milestone FAILED (4 FAIL, 4 NOT_EVALUATED) due to limited event diversity in driven fixtures."
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

Horizon v16 (driven-situations-and-small-sided-milestone) — EXHAUSTED: 5/5 accepted.
Horizon v15 (small-sided-situations-and-browser-case) — EXHAUSTED: 6/6 accepted.
