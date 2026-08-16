# Rolling Gauntlet horizon

```yaml
horizon_version: 5
status: ACTIVE
horizon_id: "small-sided-match"
created_from_commit: 514847f
created_at: 2026-08-16
reason: "Horizon 2v2-playable exhausted (5/5 accepted). All 2v2 browser match infrastructure exists: CPU passing, scoring, formation, keyboard control, and autonomous AI match. Next horizon targets small-sided match evolution: 3v3 scenarios, team decision coordination, improved formation/positioning, match restarts (kickoff/goal kick), and a playable 3v3 browser match. These build toward the SMALL-SIDED milestone."
current_index: 2
objectives:
  - id: CPU-TEAM-DECISION-PROFILE
    status: accepted
    reason: "Create a team-level decision profile that coordinates CPU players per team (offensive push, defensive balance, formation shape). Currently each CPU adapter acts independently. A team decision profile adds a shared strategy signal (attack/defend/balanced) that all teammates read each tick, enabling coordinated pressing or retreating."
    builder: builder-gameplay / mimo-v2.5
    prerequisite: CPU-TEAM-FORMATION
    commit: 63904f1
  - id: SCENARIO-3V3-FIXTURE
    status: accepted
    reason: "Add a 3v3 fixture scenario (6 players, 3 per team) with appropriate formation positions. Each team gets a player layout (e.g., 1-2 or 2-1 for 3v3). The scenario defines 6 control slots with team/player assignments. Reuses the 2v2 scenario structure pattern."
    builder: builder-structured / qwen3.6
    prerequisite: CPU-TEAM-FORMATION
    commit: 55feb7b
  - id: CPU-3V3-FORMATION
    status: pending
    reason: "Extend CPU formation system to handle 3v3 player counts. Each team has 3 players with formation positions (defender/midfielder/attacker or similar). The existing 20% pull toward own goal and blend-with-chase logic must work for 3v3 team sizes. Players need awareness of their formation role relative to 2 teammates."
    builder: builder-qwen
    prerequisite: SCENARIO-3V3-FIXTURE
  - id: CPU-3V3-TEAMPLAY
    status: pending
    reason: "Ensure CPU adapters work correctly in 3v3 context: passing to the correct teammate, shooting decisions, and formation recovery with 3 players per team. Extends existing CPU-TEAMMATE-PASS and CPU-2V2-PASSING logic to handle 3 teammates. All 6 CPU slots generate deterministic InputFrames."
    builder: builder-qwen
    prerequisite: CPU-3V3-FORMATION
  - id: MATCH-SET-PIECE
    status: pending
    reason: "Implement basic match restart: after a goal, reset players to their formation positions and the ball to center. After full-time or halftime, show the appropriate overlay. The restart logic reuses the existing goal-event detection and match-phase overlay system. Does NOT implement throw-ins, corners, or free kicks."
    builder: builder-qwen
    prerequisite: CPU-3V3-TEAMPLAY
  - id: BROWSER-3V3-MATCH
    status: pending
    reason: "Add ?mode=ai-match-3v3 URL mode for a playable 3v3 browser match with 6 CPU players (3 per team). Browser shows HUD, scoreboard, match timer, phase transitions. Browser test verifies hash parity and deterministic multi-tick 3v3 play. Screenshot evidence."
    builder: builder-mimo
    prerequisite: CPU-3V3-TEAMPLAY
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker
observable_progress_target: "Browser shows a playable 3v3 AI match with coordinated team CPU players, formation, and set-piece restarts"
infrastructure_only_justification: null
last_invalidation_reason: null
```