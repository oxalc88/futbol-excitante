# Rolling Gauntlet horizon

```yaml
horizon_version: 1
status: UNINITIALIZED
horizon_id: null
created_from_commit: null
created_at: null
reason: null
current_index: 0
objectives: []
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker
observable_progress_target: null
infrastructure_only_justification: null
last_invalidation_reason: null
```

This file is concise execution-planning state, not a backlog and not an evidence log.

The orchestrator initializes it at a strategic boundary by selecting roughly 4–8 objectives from actual repository state, evidence, research, specs, and `gauntlet/objectives.md`.

After an accepted objective, advance `current_index` and continue to the next applicable objective without global replanning unless one of `replan_if` is true. Ordinary retries or the mere existence of another possible improvement do not invalidate a horizon.

Each horizon should, where technically reasonable, lead toward at least one observable playable/browser-facing capability or milestone. If a horizon contains only evaluator/laboratory/infrastructure objectives, populate `infrastructure_only_justification` with the reason that work must precede observable gameplay progress.

Do not copy specs, research, diffs, command logs, critic reports, or history into this file. `CURRENT.md`, `HISTORY.md`, and the evidence artifacts remain authoritative for execution state and acceptance.
