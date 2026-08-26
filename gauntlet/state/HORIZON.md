# Rolling Gauntlet horizon

## Active horizon

```yaml
horizon_version: 22
status: ACTIVE
horizon_id: "continuous-match-closure-and-small-sided-hardening"
created_from_commit: da8803b
created_at: 2026-08-25
reason: "Horizon v21 (EXHAUSTED 6/6) delivered a coherent human-playable small-sided ladder (2v2/3v3/5v5, human-vs-CPU and CPU-vs-CPU) plus an executable continuous-match situation scanner. Reassessment at exhaustion surfaces three disclosed open gaps rather than new breadth: (a) coherent-match situation closure is partial — only 6/8 situations localize organically from continuous play (SHOT_TO_RESULT and PHYSICAL_DUEL stay insufficient_context, so the milestone remains largely fixture-sourced); (b) the action_recognition readability dimension stays honestly NEEDS_PERCEPTUAL_REVIEW with no human-driven discrete-action observability; (c) the flagship 5v5 human-vs-CPU mode is reachable only by URL and absent from the browser setup menu, and the flashy indicator/player-switch baseline failures (INDICATOR-002, SWITCH-004/005/006) stem from the legacy switch path double-switching now that the core natively resolves SWITCH_PLAYER_BIT. v22 closes these gaps within small-sided bounds: deepen coherent continuous play so duels/shot-results localize organically, add safe human-driven action observability (no invented perceptual rubric), reconcile the switch/indicator path to the core-native single-switch contract, complete the in-browser ladder menu, and fold the deepened evidence into the milestone bundle. GK/regulation/full-match/perceptual-rubric/networked/PES-fidelity remain deferred."
current_index: 1
objectives:
  - id: SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE
    status: accepted
    reason: "Deepen coherent continuous small-sided play so SHOT_TO_RESULT and PHYSICAL_DUEL localize organically from a single match instead of only purpose-built fixtures: genuine 1v1 pressing duels (a defender contests the ball carrier with real player-player contact and the ball at feet) and real shot attempts that reach a goal/ball-out-of-play during coherent 3v3/5v5 CPU-vs-CPU or human-vs-CPU matches. Target scanning 8/8 situations present from continuous play, honestly disclosed if any remain insufficient_context. Behaviour is evidenced by per-tick trajectory geometry (duel/contact/shot/goal windows) and browser event-centered frames. MULTI_TICK."
    builder: builder-gameplay
    prerequisite: SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH
  - id: SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY
    status: pending
    reason: "Close the disclosed action_recognition readability-observability gap safely with human-driven discrete actions in the 5v5 human-vs-CPU browser match: when the human presses PASS/SHOT (J/L), capture event-centered before/event/after frames bound to the exact input tick and the input frame that caused the event — observability evidence for reviewer/perceptual judgment only. This is NOT a readability PASS and NO rubric is invented; because the CPU adapter emits no discrete input-tagged kick/pass/shot, human-driven input makes the action-to-visual binding observable for the first time. DYNAMIC_VISUAL."
    builder: builder-gameplay
    prerequisite: SMALL-SIDED-5V5-HUMAN-VS-CPU
  - id: BROWSER-SWITCH-INDICATOR-BASELINE-FIX
    status: pending
    reason: "Scoped bugfix for the pre-existing baseline failures surfaced in v21 (player-indicator INDICATOR-002; player-switch SWITCH-004/005/006): the simulation core now natively resolves SWITCH_PLAYER_BIT inside sim.step() (emitting slot-switch events), but the legacy browser test helpers and main.ts's real-time loop still call setControlledPlayer manually, so a single Tab keypress switches twice. Reconcile the legacy tests and the browser UI path to the core-native single-switch contract and confirm the controlled-player marker follows the switch (the renderer already repositions it per frame). Discriminating guard: the switch/indicator assertions must fail when the core's SWITCH_PLAYER_BIT processing is stashed, must not mask other baseline behaviour (SWITCH-001/002/003 and INDICATOR-001/003/004/005 keep their semantics; neighbor browser suites stay green), and the deterministic simulation core must remain unchanged. BROWSER_VISIBLE."
    builder: builder-gameplay
    prerequisite: BROWSER-PLAYER-SWITCH
  - id: SMALL-SIDED-LADDER-MENU-COMPLETION
    status: pending
    reason: "Complete the in-browser setup-menu ladder: the accepted full 5v5 human-vs-CPU mode (and the 3v3 human-vs-CPU mode) are reachable only by URL (?mode=human-vs-ai-5v5 / human-vs-ai-3v3) and absent from the MATCH_MODES registry in main.ts and the hardcoded mode-select options in index.html. Add the missing entries/options so the full small-sided ladder (1v1/2v2/3v3/5v5, human-vs-CPU and CPU-vs-CPU) is selectable from the browser setup menu. Guard: a binding/browser test that fails when a menu entry is removed and asserts menu-to-scenario-selector parity for every ladder mode, plus a DYNAMIC_VISUAL screenshot of the completed menu and a launched match. BROWSER_VISIBLE."
    builder: builder-gameplay
    prerequisite: SMALL-SIDED-5V5-HUMAN-VS-CPU
  - id: SMALL-SIDED-COHERENT-EVIDENCE-RERUN
    status: pending
    reason: "Re-run the situation scanner and SMALL_SIDED_SHAPE milestone reducer on the deepened coherent matches, updating the coherent_match_sources block to reflect the deepened organic localization — SHOT_TO_RESULT and PHYSICAL_DUEL present where genuinely observed, and human-driven action observability added where applicable — honestly disclosed if still partial. Evidence-bundle only, no gameplay change; the durable bundle advances toward 15 runs with improved final_match_required closure. BOOKKEEPING."
    builder: builder-structured
    prerequisite: SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE
observable_progress_target: "A coherent, browser-playable small-sided match (3v3/5v5, human-vs-CPU and CPU-vs-CPU) that visibly plays out genuine attacking build-up, 1v1 duels, and shots reaching goal so the situation scanner localizes SHOT_TO_RESULT and PHYSICAL_DUEL organically from one continuous match (target 8/8 localizable, honestly disclosed if partial); human-driven discrete pass/shot actions are observable as event-centered frames bound to their input tick; Tab player-switching works once per keypress with the controlled-player marker following correctly in the live browser; and the full small-sided ladder (1v1/2v2/3v3/5v5, human-vs-CPU and CPU-vs-CPU) is selectable from the browser setup menu. NO GK/regulation/full-match/perceptual-rubric/networked/PES-fidelity/PROMOTION work."
last_invalidation_reason: "Horizon v21 EXHAUSTED 6/6: coherent small-sided playable ladder + continuous-match situation scanner delivered. Reassessment found three disclosed open gaps — coherent-match situation closure partial (SHOT_TO_RESULT/PHYSICAL_DUEL insufficient_context, 6/8 localizable), action_recognition readability needing human-driven observability, and pre-existing baseline browser failures plus the flagship 5v5 human-vs-CPU mode missing from the setup menu. GK/regulation/full-match/perceptual-rubric still deferred."
replan_if:
  - objective_blocked
  - architectural_invalidation
  - dependency_changed
  - planned_objective_no_longer_applicable
  - unsafe_due_to_new_defect
  - materially_higher_value_evidence
  - human_needed_spec_or_legal_blocker
```

## Completed horizons

Horizon v21 (small-sided-playable-coherence-and-team-depth) — EXHAUSTED 6/6: SMALL-SIDED-MATCH-SITUATION-SCANNER accepted (executable continuous-match situation scanner; honestly not_observed/insufficient_context). SMALL-SIDED-INTEGRATED-PLAYTEST-MATCH accepted (coherent CPU-vs-CPU 3v3 playable match via scanner; honest 0 present / 3 not_observed / 5 insufficient_context). SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH accepted (coordinated press/cover + support depth in coherent 3v3 play; scanner localizes 6/8; headless team-decision injection fixed). SMALL-SIDED-ACTION-EVENT-OBSERVABILITY accepted (event-centered pass/shot/goal DYNAMIC_VISUAL frames). SMALL-SIDED-5V5-HUMAN-VS-CPU accepted (full 5v5 human-vs-CPU match mode; 361-tick trajectory, 633 events; critic + integration ACCEPT first pass). SMALL-SIDED-PLAYTEST-RE-RUN accepted (milestone reducer re-run with coherent-match evidence as supplementary source beside the driven fixtures; honest PASS preserved; bundle 14 runs / 13 source objectives).
Horizon v20 (small-sided-milestone-honesty-and-visibility) — EXHAUSTED 4/4: SMALL-SIDED-EXIT-PREREQ-IDENTITY accepted (milestone record exit-prereq identity corrected to MUTANT_TEAM_PASS/TEAM_SHAPE_SUITE_PASS; PASS preserved). SMALL-SIDED-VISUAL-READABILITY-EVIDENCE accepted (24 event-centered DYNAMIC_VISUAL frames for the 8 readability dimensions; critic + integration ACCEPT; SHA-reuse resolved VALID). BROWSER-SMALL-SIDED-001-COHERENCE-RERUN accepted (browser/headless hash correspondence re-attested across the three resolved driven fixtures; critic + integration ACCEPT; audit PASS). SMALL-SIDED-PROFILE-REDUCER-EXTENSION accepted (executable team-exit prereq reducer wiring MUTANT_TEAM_PASS/TEAM_SHAPE_SUITE_PASS; critic + integration ACCEPT; audit PASS).
Horizon v19 (small-sided-milestone-completion) — EXHAUSTED: 4/4 accepted. SHOT/DUEL fixture objectives closed the two FAIL gaps; BATCH-5 consolidated 8/8 situation PASS; MILESTONE-RERUN-3 achieved SMALL_SIDED_SHAPE honest PASS (critic ACCEPT) with milestone bundle superseded (history: 8 NOT_EVALUATED → 3 FAIL → NEEDS_PERCEPTUAL_REVIEW → PASS).
Horizon v18 (event-diversity-through-evaluator-fix) — EXHAUSTED: 3/3 accepted. isRelevantEvent indicative fix applied; BATCH-4 6 PASS/2 FAIL; milestone FAIL honest (6/8); bundle generated.
Horizon v17 (driven-fixture-event-extension) — EXHAUSTED: 3/3 accepted. Milestone FAILED (7/8 FAIL).
Horizon v16 (driven-situations-and-small-sided-milestone) — EXHAUSTED: 5/5 accepted.
