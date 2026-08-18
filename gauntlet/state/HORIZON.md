# Rolling Gauntlet horizon

```yaml
horizon_version: 9
status: ACTIVE
horizon_id: "match-play-depth"
created_from_commit: 6153949
created_at: 2026-08-18
reason: "Horizon match-play-depth: HUMAN-SHOT-DIRECTION-CONTROL accepted. 1/5 done. Browser now shows human-vs-CPU 5v3 where the human can aim passes and shots. Next: HUMAN-THROUGH-BALL."
current_index: 1
objectives:
  - id: HUMAN-SHOT-DIRECTION-CONTROL
    status: accepted
    reason: "Extend directional input control from passes to shots: when the human presses SHOT_BIT with non-zero moveX/moveY, the shot direction uses the movement direction instead of only bodyHeading (with bodyHeading fallback when not moving). Follows the accepted HUMAN-PASS-DIRECTION-CONTROL pattern. This is a contact/wiring change in the shot impulse path."
    builder: builder-gameplay
    prerequisite: HUMAN-PASS-DIRECTION-CONTROL
  - id: HUMAN-THROUGH-BALL
    status: pending
    reason: "Add a through-ball action for the human: a modifier key combination (e.g., Q+PASS or E+PASS) that plays the ball into space ahead of the best forward teammate rather than directly to their feet, so the teammate can run onto it. Builds on CPU-ATTACKING-IMPROVEMENT off-ball runs. Contact + input contract change."
    builder: builder-gameplay
    prerequisite: HUMAN-PASS-DIRECTION-CONTROL
  - id: CPU-INTERCEPTION-AWARENESS
    status: pending
    reason: "When the opposing team is passing, the nearest CPU defender positions toward the pass trajectory to intercept (shift toward the ball's projected path between passer and receiver) rather than only chasing the ball carrier. Extends the CpuAdapter defense block with pass-trajectory awareness. Improves CPU defensive realism in small-sided matches."
    builder: builder-gameplay
    prerequisite: CPU-DEFENSIVE-IMPROVEMENT
  - id: BROWSER-MATCH-SETUP-MENU
    status: pending
    reason: "Add an in-browser match setup menu: select match mode (AI-vs-AI, Human-vs-CPU 5v3, etc.), select team/formation, and start/restart the match from the UI instead of URL parameters only. Browser UI layer change (index.html + main.ts + styles). Makes the browser match experience observable and self-contained."
    builder: builder-gameplay
    prerequisite: BROWSER-5V3-HUMAN-VS-CPU
  - id: BROWSER-MATCH-STATS
    status: pending
    reason: "Show live match stats in the browser HUD: possession percentage, shots, and passes completed for each team, derived from authoritative simulation events (goal/pass/possession telemetry). Pure derivation from the event stream — no simulation core changes. Browser UI layer."
    builder: builder-gameplay
    prerequisite: BROWSER-SCOREBOARD
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker
observable_progress_target: "Browser shows a human-vs-CPU 5v3 match where the human can aim shots and play through balls, CPU defenders read passing lanes, and the browser offers match setup and live possession/shot/pass stats"
infrastructure_only_justification: null
last_invalidation_reason: null
```
