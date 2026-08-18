# Rolling Gauntlet horizon

```yaml
horizon_version: 1
status: ACTIVE
horizon_id: "small-sided-shape"
created_from_commit: a3869eb
created_at: 2026-08-18
reason: "Horizon match-play-depth exhausted (5/5 accepted). Next horizon targets the SMALL_SIDED_SHAPE milestone: deepening CPU team tactics with structured attacking patterns, defensive organization, and press triggers; completing transition-phase set pieces (corner kicks, throw-ins); and polishing the browser presentation baseline with player animations and UI refinement. Goalkeepers, regulation rules, and full-match ecology remain deferred until their dedicated specs and suites exist."
current_index: 1
objectives:
  - id: CPU-ATTACKING-ORGANIZATION
    status: accepted
    reason: "Structured CPU attacking patterns: overlapping runs, spacing maintenance, delayed forward runs to stay onside, and cross/through-ball decision logic. Extends CPU-ATTACKING-IMPROVEMENT off-ball runs with tactical awareness. CPU adapter changes only."
    builder: builder-gameplay
    prerequisite: CPU-ATTACKING-IMPROVEMENT
  - id: CPU-DEFENSIVE-ORGANIZATION
    status: pending
    reason: "Structured CPU defensive organization: zonal marking, press triggers (when ball enters a zone), cover-shadow positioning, and defensive line coordination. Extends CPU-DEFENSIVE-IMPROVEMENT and CPU-INTERCEPTION-AWARENESS. CPU adapter changes only."
    builder: builder-gameplay
    prerequisite: CPU-INTERCEPTION-AWARENESS
  - id: MATCH-CORNER-KICK
    status: pending
    reason: "Corner kick set piece: ball placement at corner flag, attacker/receiver positioning, kick taker selection, and defensive setup. Extends MATCH-SET-PIECE transition infrastructure. No simulation core changes."
    builder: builder-gameplay
    prerequisite: MATCH-SET-PIECE
  - id: BROWSER-PLAYER-ANIMATION
    status: pending
    reason: "Player animation system in the browser renderer: idle stance, running cycle, kicking animation, and direction-based body orientation. Three.js renderer layer only. No simulation core changes."
    builder: builder-gameplay
    prerequisite: BROWSER-5V5-MATCH
  - id: BROWSER-UI-POLISH
    status: pending
    reason: "Browser UI polish: match clock display, goal animation refinement, scoreboard styling, and responsive layout for different screen sizes. Browser UI layer only. No simulation core changes."
    builder: builder-gameplay
    prerequisite: BROWSER-MATCH-STATS
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker
observable_progress_target: "Browser shows a polished small-sided match with structured CPU team tactics, all transition set pieces, player animations, and refined UI. Milestone: SMALL_SIDED_SHAPE."
infrastructure_only_justification: null
last_invalidation_reason: null
```