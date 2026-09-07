# HUMAN-RESTART-CONTROL — evidence record

- objective_id: HUMAN-RESTART-CONTROL
- evidence_class: DYNAMIC_VISUAL
- record_sha256: 42bb7ef0d5f916b0cc456e2f01a46fd8ec2c3c88b67eab7a2ff7b0b23e4f6bb5

## Hypothesis

When the human's team wins a restart and the restart window is active, the human's directional input (tick-indexed InputFrame) during the window directs the restart: the core's nearest-receiver serve re-targets toward the human-steered position. When the human does not act within the window, the CPU fallback serves toward the default nearest receiver exactly as today.

## Discriminating guards

- human_input_changes_serve_target: true
  (cpu fallback target {"x":20,"y":30} vs human target {"x":20.494974746830586,"y":29.505025253169414})
- human_input_changes_serve_direction: true
- cpu_fallback_unchanged: true
- gate_live_on_human_run: true (19 ticks)

## Mechanism and fixture-driven disclosure

The restart window is opened from committed state so the core's own applyThrowIn machinery runs unchanged; the human's directional input enters only through the tick-indexed InputFrame. The human's controlled player is a receiving body on the awarding team, and the core's nearest-receiver serve target depends on that body's position, so steering it during the window re-targets the serve. This is the engine-supported realization of 'the human takes the restart'; the corner cross target is a fixed penalty-area point and a single human pass during a throw-in window is overridden by the countdown-zero auto-serve, neither of which the human can change without a core change.

## Realization (explicit)

- is: receiver-steering destination control (movement-direction channel)
- how: the human's directional movement of a receiving body on the awarding team re-targets the core's nearest-receiver serve destination, so the human directs WHERE the restart is served (the served target/direction change) while the SAME core applyThrowIn machinery executes the same restart.
- not_a: a pass-button ball-server — a single human pass during a throw-in window is overridden by the core's countdown-zero auto-serve, so the human is not the literal server.
- deferred: the pass-button ball-server realization is deferred behind the disclosed core change (making the countdown-zero auto-serve yield to a human pass), which the objective's no-core-change constraint forbids in this objective.

## Restart battery (reproducible)

The restart unit + integration suites this objective must not regress (exact files so the count is reproducible; the RETRY critic could only reconstruct a partial subset). Historical label "restart battery 121/121" reflected an earlier suite snapshot — the current reproducible count for these exact files is 142/142.

- tests/unit/scenario/throw-in.test.ts (19)
- tests/unit/scenario/goal-kick.test.ts (19)
- tests/unit/scenario/corner-kick.test.ts (19)
- tests/unit/scenario/match-set-piece.test.ts (21)
- tests/unit/scenario/match-timer.test.ts (19)
- tests/integration/throw-in.test.ts (9)
- tests/integration/goal-kick.test.ts (14)
- tests/integration/corner-kick.test.ts (5)
- tests/integration/match-set-piece.test.ts (11)
- tests/integration/match-timer.test.ts (6)
- TOTAL 142/142

## claims_not_made

- No PES 2017 fidelity / measured PES envelope claim.
- No FOUNDATION_LAB_PASS claim.
- No invented reference envelope or tolerance.
- No suite-level PASS claim for the match-rules suite.
- No claim that the human becomes the literal ball-server for every restart type: for the corner the cross target is a fixed penalty-area point, and a single human pass during a throw-in window is overridden by the core's countdown-zero auto-serve (the human's directional movement of a receiving body is what re-targets the serve and sticks).
