# Rolling Gauntlet horizon

```yaml
horizon_version: 6
status: ACTIVE
horizon_id: "playable-1v1-enabler"
created_from_commit: b155671
created_at: 2026-08-20
reason: "Horizon transition-completion exhausted (5/5 accepted). TEAM-EVALUATOR-SUITE materialized MUTANT_TEAM_PASS and TEAM_SHAPE_SUITE_PASS, satisfying SMALL_SIDED_SHAPE exit prerequisites. However, SMALL_SIDED_SHAPE entry_prerequisite PLAYABLE_1V1_PASS is still blocked by ARCHETYPE_BLINDED_COMPARISON_PASS. New horizon builds the perceptual archetype comparison framework (rubric + browser artifacts) and fills remaining capability gaps toward PLAYABLE_1V1_PASS."
current_index: 2
objectives:
  - id: ARCHETYPE-BLINDED-COMPARISON
    status: accepted
    reason: "Implement the perceptual archetype comparison framework: versioned rubric, deterministic browser artifacts (rendered frames, perceptual hash comparison), and comparison logic. Required exit prerequisite for PLAYABLE_1V1 profile."
    builder: builder-structured
    prerequisite: null
  - id: PLAYABLE-SECOND-TOUCH
    status: accepted
    reason: "Extend first-touch capability with second-touch/turn mechanics for realistic ball control under pressure. Gameplay-coupled physics behavior."
    builder: builder-gameplay
    prerequisite: PLAYABLE-FIRST-TOUCH
  - id: PLAYABLE-CONTROL-SLOT-ROUTING
    status: pending
    reason: "Improve local control slot routing for multi-player 1v1 scenarios: stable player switching, controlled player selection, and slot ownership."
    builder: builder-gameplay
    prerequisite: PLAYABLE-BROWSER-1V1
  - id: PLAYABLE-1V1-PROFILE-EVALUATION
    status: pending
    reason: "Run the PLAYABLE_1V1 profile evaluation against current codebase once ARCHETYPE_BLINDED_COMPARISON_PASS is materialized. Determines if PLAYABLE_1V1_PASS is achievable."
    builder: builder-structured
    prerequisite: ARCHETYPE-BLINDED-COMPARISON
observable_progress_target: "PLAYABLE_1V1 profile evaluation passes with ARCHETYPE_BLINDED_COMPARISON_PASS, enabling SMALL_SIDED_SHAPE milestone evaluation."
infrastructure_only_justification: null
last_invalidation_reason: null
```