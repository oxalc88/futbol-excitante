# Rolling Gauntlet horizon

```yaml
horizon_version: 7
status: ACTIVE
horizon_id: "human-vs-cpu"
created_from_commit: fbb68f8
created_at: 2026-08-17
reason: "Horizon five-vs-five exhausted (6/6 accepted). 5v5 AI match and browser play established. Next horizon focuses on human-vs-CPU quality: player switching, 5v5 human-vs-CPU with mixed control, improved CPU teammate behavior, and basic visual indicators so the human can identify their controlled player."
current_index: 4
objectives:
  - id: BROWSER-PLAYER-SWITCH
    status: accepted
    reason: "Add player switching for the human-controlled slot in human-vs-CPU modes. When the human presses a key (e.g., Tab or Q), the controlled player switches to the nearest teammate (or the next in a fixed order). This is purely a control-layer change: slot-1 remains HUMAN, but its controlledPlayerId cycles through eligible teammates. Integrates with the existing keyboard adapter and test-bridge. Makes the human-vs-CPU experience significantly more playable."
    builder: builder-gameplay
    prerequisite: BROWSER-3V3-HUMAN-VS-CPU
    commit: b1cc042
  - id: BROWSER-CONTROLLED-PLAYER-INDICATOR
    status: accepted
    reason: "Add a visual indicator (e.g., arrow, ring, or highlight) above the human-controlled player in browser modes. The Three.js renderer already renders player models; this adds a simple colored indicator (a small cone/ring above the controlled player's head) so the human can see which player they control. Updates PresentationSnapshot or renderer-only state."
    builder: builder-gameplay
    prerequisite: BROWSER-PLAYER-SWITCH
    commit: ebefccb
  - id: BROWSER-5V3-HUMAN-VS-CPU
    status: accepted
    reason: "Add ?mode=human-vs-ai-5v3 URL mode where a human controls 1 player via keyboard with 4 CPU teammates against 5 CPU opponents. Uses the 5v5 fixture with slot-1 set to HUMAN. Combined with player switching, the human can control any of the 5 players on their team. Follows the existing human-vs-CPU pattern."
    builder: builder-gameplay
    prerequisite: BROWSER-PLAYER-SWITCH
    commit: ff527e2
  - id: CPU-ATTACKING-IMPROVEMENT
    status: accepted
    reason: "Improve CPU attacking patterns: smarter forward runs when teammates have possession, better off-ball positioning toward opponent goal, and periodic forward movement from midfielders/attackers during balanced/attack phases. Extends the CpuAdapter with role-aware off-ball movement."
    builder: builder-gameplay
    prerequisite: CPU-TEAM-DECISION-PROFILE
    commit: 7f26779
  - id: HUMAN-PASS-DIRECTION-CONTROL
    status: pending
    reason: "Allow the human to influence pass direction beyond body heading. When pressing PASS_BIT, the pass direction could be influenced by the current movement direction (moveX/moveY) rather than only bodyHeading. This makes human passing feel more responsive. Add a modifier: SHIFT+PASS for a lofted pass. This is a contact/wiring change."
    builder: builder-gameplay
    prerequisite: BROWSER-PLAYER-SWITCH
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker
observable_progress_target: "Browser shows a human-vs-CPU 5v5 match where the human can switch controlled players, see which player they control, and pass with directional control"
infrastructure_only_justification: null
last_invalidation_reason: null
```