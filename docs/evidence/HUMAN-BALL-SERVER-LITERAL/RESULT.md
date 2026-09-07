# HUMAN-BALL-SERVER-LITERAL — builder result

## Builder report

- objective_id: HUMAN-BALL-SERVER-LITERAL
- evidence_class: MULTI_TICK
- core_change: the pass-gated serving path in src/simulation/loop/simulation.ts (countdown-zero corner-kick / throw-in / goal-kick branches + the human-serve execution functions + the versioned provisional wait window).

## Guard state

- two_run_attestation: true
- cpu_two_run_attestation: true
- human_changed_behavior_versus_cpu: true
- human_serve_fired_on_pass: true
- cpu_serve_fired_at_countdown: true
- cpu_gate_off: true
- cpu_head_bytes_identity: {"reproduction":"test-results/scratch-hbsl-head.ts (createSimulation-driven CPU-taker throw-in, countdown 5, 30 ticks) run on HEAD (2d72e8c) and on this branch; both state-hash-of-hashes = eb308194b83d13c9a47d582d0167ec7478c20e69c608c90b732cb950fb439ec1","state_hash_of_hashes":"eb308194b83d13c9a47d582d0167ec7478c20e69c608c90b732cb950fb439ec1","identity":"identical"}

## Conformance verdicts (rules suite, re-evaluated on the human-served stream)

| criterion | outcome |
|---|---|
| MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH | PASS |
| MATCH-RESTART-NEAREST-ONLY | NOT_EVALUATED |
| MATCH-CORNER-KICK-AWARD | NOT_EVALUATED |
| MATCH-CORNER-KICK-PLACEMENT | NOT_EVALUATED |
| MATCH-CORNER-KICK-CROSS | BLOCKED_MISSING_REFERENCE |
| MATCH-CORNER-KICK-TIMER-FREEZE | NOT_EVALUATED |
| MATCH-GOAL-KICK-AWARD | NOT_EVALUATED |
| MATCH-GOAL-KICK-PLACEMENT | NOT_EVALUATED |
| MATCH-GOAL-KICK-DISTRIBUTION | BLOCKED_MISSING_REFERENCE |
| MATCH-GOAL-KICK-TIMER-FREEZE | NOT_EVALUATED |
| MATCH-KICKOFF-FREEZE | PASS |
| MATCH-KICKOFF-FIRST-TOUCH | NOT_EVALUATED |
| MATCH-RESTART-REARM | NOT_EVALUATED |
| MATCH-OUT-OF-PLAY-DETECT | NOT_EVALUATED |
| MATCH-OUT-OF-PLAY-NO-LAST-TOUCH | NOT_EVALUATED |
| MATCH-SCORING-GOAL-DEVENT | NOT_EVALUATED |
| MATCH-SCORING-GOAL-PHASE | NOT_EVALUATED |
| MATCH-THROW-IN-AWARD | NOT_EVALUATED |
| MATCH-THROW-IN-PLACEMENT | NOT_EVALUATED |
| MATCH-THROW-IN-SERVE | PASS |
| MATCH-THROW-IN-TIMER-FREEZE | PASS |
| MATCH-TIMER-DECREMENT | PASS |
| MATCH-TIMER-HALFTIME | NOT_EVALUATED |
| MATCH-TIMER-FULLTIME | NOT_EVALUATED |
| MATCH-TIMER-FREEZE | PASS |

## New human-serve oracle verdicts

| oracle | outcome |
|---|---|
| human-serve-direction-oracle-v1 | PASS |
| human-serve-wait-timer-freeze-oracle-v1 | PASS |
| human-serve-window-close-oracle-v1 | PASS |

## (non-)claims

- No PES 2017 fidelity / measured PES envelope claim; the wait window (90 ticks) is a versioned provisional design value.
- No invented reference envelope or tolerance; MATCH-GOAL-KICK-DISTRIBUTION / MATCH-CORNER-KICK-CROSS stay BLOCKED_MISSING_REFERENCE.
- No PROMOTION claim. No FOUNDATION_LAB_PASS claim.
- No suite-level PASS claim: the rules-suite per-test verdicts are a per-criterion collection, not a suite PASS.
- No claim that human modes' non-restart behavior changed: in-play human control, switch, tackle, keeper control and receiver steering are untouched (the gate only fires at a restart countdown zero with a human-controlled designated taker).
- No DYNAMIC_VISUAL claim (no real browser frames captured; evidence class is MULTI_TICK).
- No claim that the contact system was modified or that the human's pass is a contact-system serve — it is a dedicated serve-execution path consuming the pass direction.

## claims_not_made

- No PES 2017 fidelity / measured PES envelope claim; the wait window (90 ticks) is a versioned provisional design value.
- No invented reference envelope or tolerance; MATCH-GOAL-KICK-DISTRIBUTION / MATCH-CORNER-KICK-CROSS stay BLOCKED_MISSING_REFERENCE.
- No PROMOTION claim. No FOUNDATION_LAB_PASS claim.
- No suite-level PASS claim: the rules-suite per-test verdicts are a per-criterion collection, not a suite PASS.
- No claim that human modes' non-restart behavior changed: in-play human control, switch, tackle, keeper control and receiver steering are untouched (the gate only fires at a restart countdown zero with a human-controlled designated taker).
- No DYNAMIC_VISUAL claim (no real browser frames captured; evidence class is MULTI_TICK).
- No claim that the contact system was modified or that the human's pass is a contact-system serve — it is a dedicated serve-execution path consuming the pass direction.
