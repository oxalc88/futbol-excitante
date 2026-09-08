# CARD-MACHINERY — builder result

## Builder report

- objective_id: CARD-MACHINERY
- evidence_class: MULTI_TICK
- core_change: the in-core card consequence (default-off issueCards gate, WorldState.bookings, card-issued event) in src/simulation/loop/simulation.ts + the card-issued event kind + the WorldState bookings field + the shared foul predicate.

## Guard state

- driven_two_run_attestation: true
- gate_off_byte_identity_to_pre_change: true
- baseline_hash_of_hashes: "fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a"
- driven_caution_at_accumulated_two: true
- driven_expulsion_at_accumulated_five: true
- driven_booking_accumulates: true
- combined_card_and_free_kick_coexist: true
- organic_card_count: 0

## Run card-driven-duel
- ticks: 420
- foul_count: 5
- card_count: 2
- free_kick_count: 0
- card_events: [{"tick":116,"cardType":"caution","playerId":"player-1","fouledPlayerId":"player-10","accumulatedFouls":2,"foulSourceEventId":"tackle-player-contact-116-440","foulTick":116},{"tick":371,"cardType":"expulsion","playerId":"player-1","fouledPlayerId":"player-9","accumulatedFouls":5,"foulSourceEventId":"tackle-player-contact-371-1409","foulTick":371}]
- booking_state: {"player-1":{"fouls":5,"cautions":1,"expulsions":1}}
- state_hash_of_hashes: a53e18277fec9da4469284420c333743061648791c7a0d2cecd5bc182886138b
- determinism_run2_hash_of_hashes: a53e18277fec9da4469284420c333743061648791c7a0d2cecd5bc182886138b
- event_kind_counts: {"player-player-contact":1470,"player-ball-contact":9,"pass":3,"tackle-phase":59,"input-rejection":4,"foul":5,"second-touch":15}

| criterion | outcome |
|---|---|
| FOUL-CLEAN-TACKLE | PASS |
| FOUL-DETECT | PASS |
| FREE-KICK-AWARD | NOT_EVALUATED |

## Run card-combined
- ticks: 420
- foul_count: 2
- card_count: 1
- free_kick_count: 2
- card_events: [{"tick":290,"cardType":"caution","playerId":"player-1","fouledPlayerId":"player-10","accumulatedFouls":2,"foulSourceEventId":"tackle-player-contact-290-383","foulTick":290}]
- booking_state: {"player-1":{"fouls":2,"cautions":1,"expulsions":0}}
- state_hash_of_hashes: df5a1b00e383c3100bf77d4a562bbee273fa07ead163e6240d412632173d8b94
- determinism_run2_hash_of_hashes: null
- event_kind_counts: {"player-player-contact":359,"player-ball-contact":7,"pass":3,"tackle-phase":16,"input-rejection":1,"foul":2,"second-touch":13,"pitch-contact":2}

| criterion | outcome |
|---|---|
| FOUL-CLEAN-TACKLE | PASS |
| FOUL-DETECT | PASS |
| FREE-KICK-AWARD | NOT_EVALUATED |

## Run card-organic
- ticks: 600
- foul_count: 1
- card_count: 0
- free_kick_count: 0
- card_events: []
- booking_state: null
- state_hash_of_hashes: 88a08d2786a29c4dead92e4201d63fa5719f43f464938f1595c1f5cac83c243f
- determinism_run2_hash_of_hashes: null
- event_kind_counts: {"player-ball-contact":20,"core-match-phase":600,"restart-designation":600,"pass":3,"tackle-phase":12,"shot":22,"second-touch":22,"player-player-contact":72,"foul":1,"goal":1}

| criterion | outcome |
|---|---|
| FOUL-CLEAN-TACKLE | PASS |
| FOUL-DETECT | PASS |
| FREE-KICK-AWARD | NOT_EVALUATED |

## Run card-gate-off
- ticks: 600
- foul_count: 0
- card_count: 0
- free_kick_count: 0
- card_events: []
- booking_state: null
- state_hash_of_hashes: fb5e9b02efc539e3f2935c320fb58e9750ea4ee10a1b5fec93836794f90eda5a
- determinism_run2_hash_of_hashes: null
- event_kind_counts: {"player-ball-contact":19,"pass":2,"tackle-phase":16,"shot":16,"second-touch":14,"player-player-contact":73,"goal":1,"input-rejection":1,"ball-out-of-play":1}

| criterion | outcome |
|---|---|
| FOUL-CLEAN-TACKLE | NOT_EVALUATED |
| FOUL-DETECT | NOT_EVALUATED |
| FREE-KICK-AWARD | NOT_EVALUATED |

## (non-)claims

- No card registration: CARD-ISSUED remains named-but-unregistered (FOULS_CARDS_SPEC §10); it belongs to objective 3/4.
- No direct-red-by-contact-severity implementation or claim: the severity discriminator is undefined and BLOCKED_MISSING_REFERENCE (§7 / §11) — no envelope or severity computation was invented.
- No second-yellow → red semantics: the spec defines two independent accumulation thresholds, not a yellow-accumulation-to-expulsion relationship.
- No advantage implementation: ADVANTAGE-PLAYED stays spec-only (spec §6), deferred.
- No suite-level PASS claim: the per-criterion verdicts are a per-criterion collection on the streams, not a suite PASS; CARD-ISSUED is not evaluated.
- No PES 2017 fidelity or measured PES envelope: the accumulation thresholds (2 / 5) are fouls-v1 VERSIONED_PROVISIONAL design choices.
- No ungated behavior change: the card consequence is behind a default-off gate (issueCards); gate off (or no qualifying foul) is byte-identical to pre-change.
- No DYNAMIC_VISUAL claim (no real browser frames captured; evidence class is MULTI_TICK).
- No claim that the organic 3v3-press run produces a card: its organic man-not-ball count may be below the yellow accumulation threshold (an honest below-threshold no-card result).
