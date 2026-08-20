# Rolling Gauntlet horizon

```yaml
horizon_version: 6
status: ACTIVE
horizon_id: "playable-1v1-enabler"
created_from_commit: b155671
created_at: 2026-08-20
reason: "Horizon transition-completion exhausted (5/5 accepted). TEAM-EVALUATOR-SUITE materialized MUTANT_TEAM_PASS and TEAM_SHAPE_SUITE_PASS, satisfying SMALL_SIDED_SHAPE exit prerequisites. New horizon builds the perceptual archetype comparison framework (rubric + browser artifacts) and fills remaining capability gaps toward PLAYABLE_1V1_PASS."
current_index: 6
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
    status: accepted
    reason: "Improve local control slot routing for multi-player 1v1 scenarios: stable player switching, controlled player selection, and slot ownership."
    builder: builder-gameplay
    prerequisite: PLAYABLE-BROWSER-1V1
  - id: PLAYABLE-1V1-PROFILE-EVALUATION
    status: accepted
    reason: "Run the PLAYABLE_1V1 profile evaluation against current codebase. Result: INVALID_RUN (browser evidence absent, ARCHETYPE_BLINDED_COMPARISON_PASS NOT_EVALUATED due to no disk artifacts). Evaluation infrastructure verified correct."
    builder: builder-structured
    prerequisite: ARCHETYPE-BLINDED-COMPARISON
  - id: __HORIZON_END_SENTINEL
    status: accepted
    reason: "Internal sentinel marking horizon exhaustion. current_index=6 means past all 6 entries (all accepted)."
    builder: orchestrator
    prerequisite: null
  - id: PLAYABLE-1V1-PROFILE-EVALUATION
    status: accepted
observable_progress_target: "PLAYABLE_1V1 profile evaluation passes with ARCHETYPE_BLINDED_COMPARISON_PASS, enabling SMALL_SIDED_SHAPE milestone evaluation."
infrastructure_only_justification: null
last_invalidation_reason: null
```