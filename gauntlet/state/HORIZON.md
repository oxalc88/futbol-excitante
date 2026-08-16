# Rolling Gauntlet horizon

```yaml
horizon_version: 4
status: ACTIVE
horizon_id: "2v2-playable"
created_from_commit: c5c66b0
created_at: 2026-08-16
reason: "Horizon cpu-team-play exhausted (5/5 accepted). PLAYABLE_1V1 milestone gated by ARCHETYPE_BLINDED_COMPARISON_PASS (perceptual, human-needed spec). Next horizon targets a playable 2v2 AI-vs-AI match with CPU teammates passing to each other, team formations, and a full 2v2 browser match experience. These build toward the SMALL_SIDED_SHAPE milestone."
current_index: 5
objectives:
  - id: CPU-2V2-PASSING
    status: accepted
    reason: "Ensure CPU teammate-aware passing works reliably in 2v2 context (2 players per team, always in passing range). When a CPU player has possession in 2v2, they should pass to their teammate when beyond shooting range or not facing well enough. Builds on CPU-TEAMMATE-PASS (already implemented). The 2v2 topology means teammates are always in forward range — the pass AI should trigger more naturally."
    builder: builder-qwen
    prerequisite: CPU-BASIC-FORMATION
  - id: CPU-2V2-SCORING
    status: accepted
    reason: "Implement goal detection, scoring, and match reset for 2v2 matches. When the ball enters a goal zone, emit a goal event, update the scoreboard, and reset player positions. Reuses existing goal-collision detection from BALL-GOAL-COLLISION; extends to 2v2 match lifecycle (full-time detection, goal celebration, restart)."
    builder: builder-qwen
    prerequisite: CPU-2V2-PASSING
  - id: CPU-TEAM-FORMATION
    status: accepted
    reason: "Extend CPU-BASIC-FORMATION to include team-specific formation layout. Each team has a defined formation (e.g., 1-1 for 2v2: one defender, one attacker). When players are displaced from their formation positions, they return to formation over time. Adds a simple formation recovery mechanism to complement the existing 20% pull toward own goal."
    builder: builder-qwen
    prerequisite: CPU-BASIC-FORMATION
  - id: BROWSER-2V2-MATCH-KEYBOARD
    status: accepted
    reason: "Add ?mode=2v2 URL parameter that creates a 2v2 browser match: 4 CPU-controlled players (all AI_FALLBACK) with keyboard override for slot-1. Shows 2v2-specific scoreboard (HOME vs AWAY), match clock, and 2v2 controls hint. Builds on BROWSER-HUMAN-VS-CPU infrastructure."
    builder: builder-mimo
    prerequisite: CPU-2V2-SCORING
  - id: BROWSER-2V2-PLAYABLE
    status: accepted
    reason: "Full playable 2v2 match in browser: both teams of CPU players with passing AI, basic formation, and goal scoring. Browser shows the full 2v2 match with HUD, scoreboard, match timer, phase transitions (halftime/fulltime). Observable playable 2v2 milestone. Browser test verifies hash parity and deterministic multi-tick 2v2 play."
    builder: builder-mimo
    prerequisite: CPU-TEAM-FORMATION
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker
observable_progress_target: "Browser shows complete 2v2 AI-vs-AI match with passing CPU players, formation, goal scoring, scoreboard, and match timer"
infrastructure_only_justification: null
last_invalidation_reason: null
```