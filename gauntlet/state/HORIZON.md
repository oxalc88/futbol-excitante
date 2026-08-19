# Rolling Gauntlet horizon

```yaml
horizon_version: 5
status: ACTIVE
horizon_id: "transition-completion"
created_from_commit: a7620fe
created_at: 2026-08-18
reason: "Horizon small-sided-shape exhausted (5/5 accepted). Next horizon completes remaining transition set pieces (throw-ins, goal kicks), deepens CPU tactical awareness for game-state adaptation, adds browser match-difficulty setup, and materializes the team evaluator suite to enable SMALL_SIDED_SHAPE milestone evaluation. Goalkeepers, regulation rules, and full-match ecology remain deferred until their dedicated specs and suites exist."
current_index: 3
objectives:
  - id: MATCH-THROW-IN
    status: accepted
    reason: "Throw-in set piece: ball out-of-play detection for sideline exits, throw-in positioning, receiver/taker logic, and defensive setup. Extends MATCH-SET-PIECE transition infrastructure. No simulation core changes."
    builder: builder-gameplay
    prerequisite: MATCH-SET-PIECE
  - id: MATCH-GOAL-KICK
    status: accepted
    reason: "Goal kick set piece: ball placement at goal area, kick taker selection, team positioning, and defensive setup. Extends MATCH-SET-PIECE transition infrastructure. No simulation core changes."
    builder: builder-gameplay
    prerequisite: MATCH-SET-PIECE
  - id: CPU-TACTICAL-AWARENESS
    status: accepted
    reason: "CPU tactical awareness: game-state adaptation (more attacking when losing, more defensive when winning), fatigue awareness, and match-phase-specific behavior. Extends CPU-TEAM-DECISION-PROFILE. CPU adapter changes only."
    builder: builder-gameplay
    prerequisite: CPU-TEAM-DECISION-PROFILE
  - id: BROWSER-DIFFICULTY-SETTING
    status: pending
    reason: "Difficulty setting in browser match setup and HUD: configurable CPU strength level (Easy/Medium/Hard) affecting CPU decision quality and reaction speed. Browser and CPU adapter changes."
    builder: builder-gameplay
    prerequisite: BROWSER-MATCH-SETUP-MENU
  - id: TEAM-EVALUATOR-SUITE
    status: pending
    reason: "Materialize the team evaluator suite with MUTANT_TEAM_PASS and TEAM_SHAPE_SUITE_PASS reducers. Enables SMALL_SIDED_SHAPE milestone evaluation. Structured evaluator work."
    builder: builder-structured
    prerequisite: CPU-TEAM-DECISION-PROFILE
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker
observable_progress_target: "Browser shows throw-in and goal-kick transitions, difficulty setting in match setup, CPU responds to game score in tactical approach, and SMALL_SIDED_SHAPE milestone evaluator suite exists."
infrastructure_only_justification: "TEAM-EVALUATOR-SUITE is the only non-observable objective. It is required to formally enable SMALL_SIDED_SHAPE milestone evaluation, which the horizon's observable targets (throw-ins, goal kicks, difficulty settings, tactical awareness) feed into."
last_invalidation_reason: null
```