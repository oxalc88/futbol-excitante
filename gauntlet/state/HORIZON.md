# Rolling Gauntlet horizon

```yaml
horizon_version: 3
status: ACTIVE
horizon_id: "cpu-team-play"
created_from_commit: 3d6b32d
created_at: 2026-08-16
reason: "Horizon playable-browser-v2 exhausted. All CPU adapter primitives (pursuit, shoot, pass) exist. Browser runs AI-vs-AI 1v1 matches with scoreboard, phases, and goal overlays. PLAYABLE_1V1 milestone remains gated by ARCHETYPE_BLINDED_COMPARISON_PASS (perceptual, deferred). New horizon focuses on multi-player team play: teammate-aware passing, multiple CPU players per team, and observable browser-facing small-sided matches."
current_index: 0
objectives:
  - id: CPU-TEAMMATE-PASS
    status: pending
    reason: "CPU adapter passes toward the nearest teammate in a forward direction when in possession beyond shooting range, instead of passing blindly along body heading. Requires adding teammate positions to CpuObservation and finding the best forward-pass target."
    builder: builder-qwen
    prerequisite: null
  - id: CPU-MULTI-PLAYER
    status: pending
    reason: "Support multiple CPU-controlled players per team. Each player gets its own CPU adapter instance. The observation includes the controlled player's index/ID so each adapter knows which player to control. Per-slot adapters already exist in AI-match mode (browser/main.ts); this extends to all CPU-vs-CPU and human-vs-CPU scenarios."
    builder: builder-qwen
    prerequisite: CPU-TEAMMATE-PASS
  - id: SCENARIO-2V2-FIXTURE
    status: pending
    reason: "Create a 2v2 AI-vs-AI scenario with 2 players per team. Browser playable via ?mode=ai-match&scenario=2v2. Tests verify both CPU adapters per team produce non-conflicting inputs and players move independently."
    builder: builder-qwen
    prerequisite: CPU-MULTI-PLAYER
  - id: CPU-BASIC-FORMATION
    status: pending
    reason: "CPU players maintain basic formation shape when out of possession: defenders stay back, attackers stay forward. Simple spatial distribution relative to own goal. Does not replace tactical specs — provisional placeholder behavior only."
    builder: builder-qwen
    prerequisite: CPU-MULTI-PLAYER
  - id: BROWSER-HUMAN-VS-CPU
    status: pending
    reason: "Add ?mode=human-vs-ai URL parameter that gives slot-1 to keyboard and remaining slots to CPU adapters. Makes browser a standalone human-vs-CPU match viewer. Observable playable milestone."
    builder: builder-mimo
    prerequisite: SCENARIO-2V2-FIXTURE
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker
observable_progress_target: "Browser shows 2v2 AI-vs-AI match and human-vs-CPU 1v1 match with CPU players passing to teammates and maintaining basic formation"
infrastructure_only_justification: null
last_invalidation_reason: null
```