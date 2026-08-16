# Rolling Gauntlet horizon

```yaml
horizon_version: 2
status: ACTIVE
horizon_id: "playable-browser-v2"
created_from_commit: 11099d3
created_at: 2026-08-15
reason: "Horizon playable-v1 exhausted. All match infrastructure (scoring, lifecycle, oracles, replay) complete. PLAYABLE-1V1 milestone remains gated by ARCHETYPE_BLINDED_COMPARISON_PASS (perceptual, deferred). New horizon focuses on observable browser progress: match-phase/goal visuals, CPU ball pursuit, and browser-as-standalone-match-viewer."
current_index: 2
objectives:
  - id: BROWSER-MATCH-PHASE-DISPLAY
    status: accepted
    reason: "Show half-time and full-time visual overlays in the browser. Use tick-based match phase detection and existing match-phase duration config. Centered text overlay auto-fades on transition."
    builder: builder-mimo
    prerequisite: null
  - id: BROWSER-GOAL-EFFECT
    status: accepted
    reason: "Brief visual feedback on goal: overlay text 'GOAL! {team}' auto-fading after ~2s. Optional scoreboard highlight animation."
    builder: builder-mimo
    prerequisite: BROWSER-MATCH-PHASE-DISPLAY
  - id: CPU-BALL-PURSUIT
    reason: "CPU adapter actively moves toward ball when out of possession instead of idling. Uses existing kinematic locomotion. Ball proximity detection determines when to pursue vs attack."
    builder: builder-qwen
    prerequisite: null
  - id: BROWSER-MATCH-START-URL
    reason: "Support launching a running CPU-vs-CPU match from browser URL (?mode=ai-match). Shows full scoreboard, clock, and match phases. Makes browser a standalone match viewer."
    builder: builder-mimo
    prerequisite: BROWSER-MATCH-PHASE-DISPLAY
  - id: CPU-PASSING-EVALUATION
    reason: "Add evaluator tests verifying CPU produces pass inputs under range/direction conditions. Tests at minimum that the CPU adapter generates pass action bits in appropriate game states."
    builder: builder-qwen
    prerequisite: CPU-BALL-PURSUIT
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker
observable_progress_target: "Browser shows half-time/full-time overlays and goal celebrations during a running CPU-vs-CPU match started from URL parameter"
infrastructure_only_justification: null
last_invalidation_reason: null
```