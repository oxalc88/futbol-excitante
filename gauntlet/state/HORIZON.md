# Rolling Gauntlet horizon

## Active horizon

```yaml
horizon_version: 19
status: ACTIVE
horizon_id: "small-sided-milestone-completion"
created_from_commit: 1c664e661e4e4e0a466bb76e17a496053a990c1b
created_at: 2026-08-24
reason: "Horizon v18 accepted all 3 objectives and returned an honest milestone FAIL (6/8 PASS). The remaining two FAILs are fixture-engineering gaps, not evaluator or engine defects: (1) SHOT_TO_RESULT — a shot fired at tick 51 has vz≈1.8 m/s (exitSpeed 12 x verticalComponent 0.15) and returns to the pitch after ≈22 ticks, past the 60-tick window, so no pitch-contact event is emitted though the engine supports it; (2) PHYSICAL_DUEL — the driven input program never produces a duplicate/conflicting input at a contact tick, so input-rejection never fires though input-system.ts emits it. This horizon closes those gaps honestly via fixture extension + batch re-run, then re-runs the SMALL_SIDED_SHAPE milestone with the goal of an honest 8/8 PASS and milestone bundle."
current_index: 3
objectives:
  - id: SHOT-RESULT-RESOLUTION-FIXTURE
    status: accepted
    reason: "Extend/extend the driven situation fixture so a shot's outgoing ball returns to the pitch (pitch-contact emitted) inside the run window — e.g. shot earlier in the run or longer duration. Add binding test asserting shot + pitch-contact both appear and SHOT_TO_RESULT verdict flips FAIL→PASS honestly. Do not invent events or alter engine physics; use the existing engine pitch-contact emission path."
    builder: builder-structured
    prerequisite: null
  - id: DUEL-REJECTION-FIXTURE
    status: accepted
    reason: "Produce an honest input-rejection event inside the PHYSICAL_DUEL window by scheduling a duplicate/conflicting input frame at a tick where player-player contact occurs (engine input-system.ts emits input-rejection on unique-per-tick-slot policy violation). Binding test asserts player-player-contact + input-rejection both appear and PHYSICAL_DUEL flips PASS to PASS honestly."
    builder: builder-structured
    prerequisite: null
  - id: SMALL-SIDED-SITUATIONS-BATCH-5
    status: accepted
    reason: "Materialize batch-5 situation evidence on the resolved fixtures (after SHOT and DUEL fixture objectives). Expect 8/8 situations PASS on driven fixtures. Byte-identity binding; honest verdicts only."
    builder: builder-structured
    prerequisite: [SHOT-RESULT-RESOLUTION-FIXTURE, DUEL-REJECTION-FIXTURE]
  - id: SMALL-SIDED-MILESTONE-RERUN-3
    status: pending
    reason: "Re-run SMALL_SIDED_SHAPE milestone:evaluate with batch-5 evidence (8/8 PASS) and generate the milestone bundle. Milestone PASS is possible only if every required situation PASS and the deterministic reducer + critic accept; honest FAIL otherwise. Milestone is completion truth, not acceptance authority."
    builder: builder-structured
    prerequisite: SMALL-SIDED-SITUATIONS-BATCH-5
observable_progress_target: "SMALL_SIDED_SHAPE reaches honest 8/8 situation PASS with its browser/visual bundle, closing the fixture-driven FAILs."
last_invalidation_reason: "Horizon v18 completed 3/3; the milestone FAIL's remaining causes were fixture-gaps (shot never settles; no input-rejection in duel), now targeted by horizon v19 fixture extensions."
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

Horizon v19 (small-sided-milestone-completion) — ACTIVE.
Horizon v18 (event-diversity-through-evaluator-fix) — EXHAUSTED: 3/3 accepted. isRelevantEvent indicative fix applied; BATCH-4 6 PASS/2 FAIL; milestone FAIL honest (6/8); bundle generated.
Horizon v17 (driven-fixture-event-extension) — EXHAUSTED: 3/3 accepted. Milestone FAILED (7/8 FAIL).
Horizon v16 (driven-situations-and-small-sided-milestone) — EXHAUSTED: 5/5 accepted.