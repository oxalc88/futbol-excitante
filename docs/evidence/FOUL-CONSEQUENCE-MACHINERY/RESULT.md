# FOUL-CONSEQUENCE-MACHINERY — builder result

## Builder report

- objective_id: FOUL-CONSEQUENCE-MACHINERY
- evidence_class: MULTI_TICK
- core_change: the in-core free-kick consequence (default-off awardFreeKicks gate) in src/simulation/loop/simulation.ts + the shared foul predicate (src/simulation/foul-predicate.ts).

## Guard state

- driven_two_run_attestation: true
- organic_two_run_attestation: true
- gate_off_byte_identity_to_pre_change: true
- baseline_hash_of_hashes: "fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a"
- organic_foul_to_free_kick_chain: true
- driven_foul_to_free_kick_chain: true

## Run freekick-driven-duel
- ticks: 200
- foul_count: 1
- free_kick_count: 0
- committed_free_kick_events: [{"tick":111,"teamId":"team-b","position":{"x":-1.81289661272071,"y":0.007171422293912808}}]
- committed_free_kick_count: 1
- state_hash_of_hashes: 5f3bc337c1e928eb084f2beb5cea6bdde39668aea71f58b809ee831c1443454d
- determinism_run2_hash_of_hashes: 5f3bc337c1e928eb084f2beb5cea6bdde39668aea71f58b809ee831c1443454d
- event_kind_counts: {"player-player-contact":218,"player-ball-contact":2,"pass":2,"tackle-phase":4,"foul":1,"second-touch":2,"pitch-contact":1}

| criterion | outcome |
|---|---|
| MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH | NOT_EVALUATED |
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
| MATCH-KICKOFF-FIRST-TOUCH | PASS |
| MATCH-RESTART-REARM | NOT_EVALUATED |
| MATCH-OUT-OF-PLAY-DETECT | NOT_EVALUATED |
| MATCH-OUT-OF-PLAY-NO-LAST-TOUCH | NOT_EVALUATED |
| MATCH-SCORING-GOAL-DEVENT | NOT_EVALUATED |
| MATCH-SCORING-GOAL-PHASE | NOT_EVALUATED |
| MATCH-THROW-IN-AWARD | NOT_EVALUATED |
| MATCH-THROW-IN-PLACEMENT | NOT_EVALUATED |
| MATCH-THROW-IN-SERVE | NOT_EVALUATED |
| MATCH-THROW-IN-TIMER-FREEZE | NOT_EVALUATED |
| MATCH-TIMER-DECREMENT | NOT_EVALUATED |
| MATCH-TIMER-HALFTIME | NOT_EVALUATED |
| MATCH-TIMER-FULLTIME | NOT_EVALUATED |
| MATCH-TIMER-FREEZE | NOT_EVALUATED |

## Run freekick-organic
- ticks: 600
- foul_count: 1
- free_kick_count: 1
- state_hash_of_hashes: 47674adfb1cd411bc5bdc0d03c4744861df7953cd2f0cc4a63a8b13cd172a036
- determinism_run2_hash_of_hashes: 47674adfb1cd411bc5bdc0d03c4744861df7953cd2f0cc4a63a8b13cd172a036
- event_kind_counts: {"player-ball-contact":15,"core-match-phase":600,"restart-designation":600,"pass":4,"tackle-phase":24,"shot":18,"second-touch":21,"player-player-contact":657,"foul":1,"free-kick-executed":1,"pitch-contact":1}

| criterion | outcome |
|---|---|
| MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH | NOT_EVALUATED |
| MATCH-RESTART-NEAREST-ONLY | FAIL |
| MATCH-CORNER-KICK-AWARD | NOT_EVALUATED |
| MATCH-CORNER-KICK-PLACEMENT | NOT_EVALUATED |
| MATCH-CORNER-KICK-CROSS | BLOCKED_MISSING_REFERENCE |
| MATCH-CORNER-KICK-TIMER-FREEZE | NOT_EVALUATED |
| MATCH-GOAL-KICK-AWARD | NOT_EVALUATED |
| MATCH-GOAL-KICK-PLACEMENT | NOT_EVALUATED |
| MATCH-GOAL-KICK-DISTRIBUTION | BLOCKED_MISSING_REFERENCE |
| MATCH-GOAL-KICK-TIMER-FREEZE | NOT_EVALUATED |
| MATCH-KICKOFF-FREEZE | NOT_EVALUATED |
| MATCH-KICKOFF-FIRST-TOUCH | NOT_EVALUATED |
| MATCH-RESTART-REARM | NOT_EVALUATED |
| MATCH-OUT-OF-PLAY-DETECT | NOT_EVALUATED |
| MATCH-OUT-OF-PLAY-NO-LAST-TOUCH | NOT_EVALUATED |
| MATCH-SCORING-GOAL-DEVENT | NOT_EVALUATED |
| MATCH-SCORING-GOAL-PHASE | NOT_EVALUATED |
| MATCH-THROW-IN-AWARD | NOT_EVALUATED |
| MATCH-THROW-IN-PLACEMENT | NOT_EVALUATED |
| MATCH-THROW-IN-SERVE | NOT_EVALUATED |
| MATCH-THROW-IN-TIMER-FREEZE | NOT_EVALUATED |
| MATCH-TIMER-DECREMENT | PASS |
| MATCH-TIMER-HALFTIME | NOT_EVALUATED |
| MATCH-TIMER-FULLTIME | NOT_EVALUATED |
| MATCH-TIMER-FREEZE | PASS |

## Run freekick-antihuddle-window
- ticks: 60
- foul_count: 0
- free_kick_count: 1
- state_hash_of_hashes: 63063b342f658c862bdbed296a86cd7c1ed4190f73d639be7d21a4878f0ec8c0
- determinism_run2_hash_of_hashes: null
- event_kind_counts: {"core-match-phase":60,"restart-designation":60,"free-kick-executed":1,"pitch-contact":2}

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
| MATCH-THROW-IN-SERVE | NOT_EVALUATED |
| MATCH-THROW-IN-TIMER-FREEZE | NOT_EVALUATED |
| MATCH-TIMER-DECREMENT | PASS |
| MATCH-TIMER-HALFTIME | NOT_EVALUATED |
| MATCH-TIMER-FULLTIME | NOT_EVALUATED |
| MATCH-TIMER-FREEZE | PASS |

## Run freekick-human-serve
- ticks: 40
- foul_count: 0
- free_kick_count: 1
- state_hash_of_hashes: 428a4df583fcaeafb6525fd2c161971f5183ed049ecd850e9fbfabd91ac0b86d
- determinism_run2_hash_of_hashes: null
- event_kind_counts: {"core-match-phase":40,"restart-designation":40,"restart-serve-wait":1,"pass":1,"free-kick-executed":1,"pitch-contact":1}

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
| MATCH-THROW-IN-SERVE | NOT_EVALUATED |
| MATCH-THROW-IN-TIMER-FREEZE | NOT_EVALUATED |
| MATCH-TIMER-DECREMENT | PASS |
| MATCH-TIMER-HALFTIME | NOT_EVALUATED |
| MATCH-TIMER-FULLTIME | NOT_EVALUATED |
| MATCH-TIMER-FREEZE | PASS |

## Run freekick-gate-off
- ticks: 600
- foul_count: 0
- free_kick_count: 0
- state_hash_of_hashes: fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a
- determinism_run2_hash_of_hashes: null
- event_kind_counts: {"player-ball-contact":19,"pass":2,"tackle-phase":16,"shot":16,"second-touch":14,"player-player-contact":73,"goal":1,"input-rejection":1,"ball-out-of-play":1}

| criterion | outcome |
|---|---|
| MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH | NOT_EVALUATED |
| MATCH-RESTART-NEAREST-ONLY | NOT_EVALUATED |
| MATCH-CORNER-KICK-AWARD | NOT_EVALUATED |
| MATCH-CORNER-KICK-PLACEMENT | NOT_EVALUATED |
| MATCH-CORNER-KICK-CROSS | BLOCKED_MISSING_REFERENCE |
| MATCH-CORNER-KICK-TIMER-FREEZE | NOT_EVALUATED |
| MATCH-GOAL-KICK-AWARD | NOT_EVALUATED |
| MATCH-GOAL-KICK-PLACEMENT | NOT_EVALUATED |
| MATCH-GOAL-KICK-DISTRIBUTION | BLOCKED_MISSING_REFERENCE |
| MATCH-GOAL-KICK-TIMER-FREEZE | NOT_EVALUATED |
| MATCH-KICKOFF-FREEZE | NOT_EVALUATED |
| MATCH-KICKOFF-FIRST-TOUCH | NOT_EVALUATED |
| MATCH-RESTART-REARM | NOT_EVALUATED |
| MATCH-OUT-OF-PLAY-DETECT | PASS |
| MATCH-OUT-OF-PLAY-NO-LAST-TOUCH | NOT_EVALUATED |
| MATCH-SCORING-GOAL-DEVENT | PASS |
| MATCH-SCORING-GOAL-PHASE | NOT_EVALUATED |
| MATCH-THROW-IN-AWARD | NOT_EVALUATED |
| MATCH-THROW-IN-PLACEMENT | NOT_EVALUATED |
| MATCH-THROW-IN-SERVE | NOT_EVALUATED |
| MATCH-THROW-IN-TIMER-FREEZE | NOT_EVALUATED |
| MATCH-TIMER-DECREMENT | NOT_EVALUATED |
| MATCH-TIMER-HALFTIME | NOT_EVALUATED |
| MATCH-TIMER-FULLTIME | NOT_EVALUATED |
| MATCH-TIMER-FREEZE | NOT_EVALUATED |

## (non-)claims

- No card or advantage implementation: cards and advantage stay spec-only (FOULS_CARDS_SPEC §7 / §6).
- No FREE-KICK-AWARD criterion registration: it is named-but-unregistered (spec §10) and belongs to objective 2/4.
- No suite-level PASS claim: the rules-suite per-criterion verdicts are a per-criterion collection, not a suite PASS.
- No PROMOTION claim. No FOUNDATION_LAB_PASS claim.
- No PES 2017 fidelity or measured PES envelope claim: the free-kick countdown (60), serve speed (14 m/s) and serve loft (0.18) are VERSIONED_PROVISIONAL match-rules-v1-kind design choices.
- No ungated behavior change: the free-kick consequence is behind a default-off gate (awardFreeKicks); gate off (or no foul) is byte-identical to pre-change.
- No DYNAMIC_VISUAL claim (no real browser frames captured; evidence class is MULTI_TICK).
- No claim that the CPU-vs-CPU 3v3-press organic run produces man-not-ball fouls under the anti-huddle (cpuAntiHuddle:true) shape — it does not; the organic chain uses the accepted no-anti-huddle (cpuAntiHuddle:false) runner shape, and the anti-huddle interaction is attested on the driven free-kick window.
