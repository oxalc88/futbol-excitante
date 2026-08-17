# Rolling Gauntlet horizon

```yaml
horizon_version: 6
status: ACTIVE
horizon_id: "five-vs-five"
created_from_commit: eaefdf1
created_at: 2026-08-16
reason: "Horizon small-sided-match exhausted (6/6 accepted). SMALL-SIDED milestone complete with 3v3 browser play, team decision, role-aware formation, and match restart. Next horizon targets 5v5 progression: auto match timer, defensive AI improvements, pass variety (ground/lofted/power), human-vs-CPU 3v3, and the 5v5 fixture and browser play. These build toward the next cardinality milestone after SMALL-SIDED."
current_index: 4
objectives:
  - id: MATCH-TIMER-ENFORCEMENT
    status: accepted
    reason: "Add tick-based match timer that auto-transitions phases: playing → halftime → playing → fulltime. The timer display exists in the HUD but doesn't drive phase changes yet. Integrates with the existing matchPhase state machine and PresentationSnapshot. Reuses MATCH-SET-PIECE reset logic for halftime."
    builder: builder-structured
    prerequisite: MATCH-SET-PIECE
    commit: d1795b0
  - id: CPU-DEFENSIVE-IMPROVEMENT
    status: accepted
    reason: "Improve CPU defender behavior: tracking opposing attackers, marking space, pressing the ball carrier more intelligently. Extends the team decision profile with defensive sub-modes and the role-aware formation with marking distances. First step toward coordinated team defense."
    builder: builder-gameplay
    prerequisite: CPU-3V3-TEAMPLAY
    commit: b499017
  - id: CPU-PASS-VARIETY
    status: accepted
    reason: "Add ground pass vs lofted pass choice to CPU adapter. Pass power influenced by distance to target and urgency (score state, time remaining). Better target selection under pressure (consider defender proximity). Extends the existing getBestTeammateTarget logic."
    builder: builder-gameplay
    prerequisite: CPU-3V3-TEAMPLAY
    commit: 127720b
  - id: BROWSER-3V3-HUMAN-VS-CPU
    status: accepted
    reason: "Add ?mode=human-vs-ai-3v3 URL mode where a human controls one player via keyboard and has 2 CPU teammates against 3 CPU opponents. Follows the existing BROWSER-HUMAN-VS-CPU pattern but scaled to 3v3."
    builder: builder-gameplay
    prerequisite: BROWSER-3V3-MATCH
    commit: 490d773
  - id: SCENARIO-5V5-FIXTURE
    status: pending
    reason: "Add a 5v5 fixture scenario (10 players, 5 per team) with appropriate formation positions (e.g., 2-2-1 or 2-1-2). Follows the existing 2v2 and 3v3 scenario patterns. 10 control slots, all AI_FALLBACK, with team/player assignments."
    builder: builder-structured
    prerequisite: SCENARIO-3V3-FIXTURE
  - id: BROWSER-5V5-MATCH
    status: pending
    reason: "Add ?mode=ai-match-5v5 URL mode for a playable 5v5 browser match with 10 CPU players (5 per team). Browser shows HUD, scoreboard, match timer, phase transitions. Browser test verifies hash parity and deterministic multi-tick 5v5 play. Screenshot evidence."
    builder: builder-gameplay
    prerequisite: BROWSER-3V3-MATCH
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker
observable_progress_target: "Browser shows a playable 5v5 AI match with team defense, pass variety, and auto phase transitions"
infrastructure_only_justification: null
last_invalidation_reason: null
```