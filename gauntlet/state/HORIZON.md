# Rolling Gauntlet horizon

```yaml
horizon_version: 1
status: EXHAUSTED
horizon_id: "playable-v1"
created_from_commit: a57edf2
created_at: 2026-08-15
reason: "HEADLESS-CPU-MATCH accepted. Match scoring is the active candidate. Horizon covers the remaining playable match infrastructure: scoring, browser-wired scoreboard, match lifecycle, and AI improvement."
current_index: 6
objectives:
  - id: MATCH-SCORING
    reason: "Add tick-based match clock + score tracker."
    builder: builder-qwen
    status: accepted
  - id: BROWSER-SCOREBOARD
    reason: "Wire match clock and score into browser renderer."
    builder: builder-mimo
    prerequisite: MATCH-SCORING
    status: accepted
  - id: MATCH-LIFECYCLE
    reason: "Add match phases with half duration."
    builder: builder-qwen
    prerequisite: MATCH-SCORING
    status: accepted
  - id: AI-GOAL-IMPROVEMENT
    reason: "Improve CPU goal-awareness and shooting accuracy."
    builder: builder-qwen
    prerequisite: MATCH-SCORING
    status: accepted
  - id: MATCH-ORACLE
    reason: "Add match-scoring oracles to the evaluator suite (score-tracker mutant, match-clock mutant)."
    builder: builder-qwen
    prerequisite: MATCH-LIFECYCLE
    status: accepted
  - id: MATCH-REPLAY-EXTENSION
    reason: "Score-aware replay verification: replay must reproduce same score progression."
    builder: builder-qwen
    prerequisite: MATCH-ORACLE
    status: accepted
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker
observable_progress_target: "Browser shows running match clock and team scores that update on goal events"
infrastructure_only_justification: null
last_invalidation_reason: null
```

This file is concise execution-planning state, not a backlog and not an evidence log.

The orchestrator initializes it at a strategic boundary by selecting roughly 4–8 objectives from actual repository state, evidence, research, specs, and `gauntlet/objectives.md`.

After an accepted objective, advance `current_index` and continue to the next applicable objective without global replanning unless one of `replan_if` is true. Ordinary retries or the mere existence of another possible improvement do not invalidate a horizon.

Each horizon should, where technically reasonable, lead toward at least one observable playable/browser-facing capability or milestone. If a horizon contains only evaluator/laboratory/infrastructure objectives, populate `infrastructure_only_justification` with the reason that work must precede observable gameplay progress.

Do not copy specs, research, diffs, command logs, critic reports, or history into this file. `CURRENT.md`, `HISTORY.md`, and the evidence artifacts remain authoritative for execution state and acceptance.
