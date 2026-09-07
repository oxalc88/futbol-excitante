# HUMAN-RESTART-RULES-CONFORMANCE — builder result

## Builder report

- objective_id: HUMAN-RESTART-RULES-CONFORMANCE
- builder_agent: builder-structured
- builder_model: deepseek-v4-flash
- evidence_class: MULTI_TICK
- hypothesis: The human-taken restart (the accepted HUMAN-RESTART-CONTROL receiver-steering realization) conforms to the SAME rules the CPU restart does. The extended gated serializeRestartFacts injection carries the human-taker designation so the rules oracles can distinguish human-taken from CPU-fallback streams, and the applicable restart criteria are evaluated through the registered rules suite over human-taken streams.
- files_changed:
  - eval/runners/headless-match.ts (gated serializeRestartFacts human-taker designation + humanRestartControl driver)
  - eval/oracles/rules-restart.ts (anti-huddle freeze human-controlled-body exemption)
  - scripts/capture-human-restart-rules-conformance.ts (evidence producer)
  - tests/unit/eval/human-restart-rules-conformance-binding.test.ts (serialization guards)
  - docs/evidence/HUMAN-RESTART-RULES-CONFORMANCE/ (trajectory.json, human-restart-rules-conformance.json, RESULT.md, audit.json)
- commands_run: (see evidence record; typecheck + capture in evidence + ordinary re-runs + audit all exit 0)
- tests_run: human-restart binding 10; rules gate + bindings 156 (rules-suite 17, rules-oracle 75, match-rules-spec-binding 28, restart-rules-serialization 4, rules-facts-depth 8, restart-designation 8, rules-suite-state-rerun 9, corner-driven 7); stateHash pins 69 (CPU-DEFENSIVE-TACKLE 16, LIFECYCLE-MIGRATION-ASSESSMENT 5, GK ARC 6 + GOALLINE 7 + KEEPER-ORACLE 5 + SUITE-CORE-OWNED 11 + SUITE-VERDICTS 11 + SUITE-ORGANIC 8); foundation/provenance 71; SUITE-DETERMINISTIC-TWO-RUN-binding 7; architecture 27; restart battery + human-restart-control integration 58; other neighbour suites 82 (gk-5v5-adapter-behavior 15, match-timer 6, ball-settled-regime-match 10, goalkeeper-role 30, cpu-defensive-tackle 21)
- integration_test_result: MULTI_TICK requires a relevant integration-test pass — the human-restart-control integration suite (10) reproduces, and the rules binding tests physically reproduce the human-taken / CPU-fallback streams through the production runHeadlessMatch + evaluateSuite entry points
- slot_wiring_result: NOT_APPLICABLE (the objective does not depend on slot/player ownership or routing)
- required_evidence:
  - trajectory: docs/evidence/HUMAN-RESTART-RULES-CONFORMANCE/trajectory.json
  - record: docs/evidence/HUMAN-RESTART-RULES-CONFORMANCE/human-restart-rules-conformance.json
  - audit: docs/evidence/HUMAN-RESTART-RULES-CONFORMANCE/audit.json (status PASS)
- artifacts: eval/runners/headless-match.ts, eval/oracles/rules-restart.ts, scripts/capture-human-restart-rules-conformance.ts, tests/unit/eval/human-restart-rules-conformance-binding.test.ts
- spec_sections: specs/MATCH_RULES_SPEC.md §6 (throw-in), §9.2/§9.5 (kickoff/re-arm), §11 (timer freeze), §12 (freeze-until-first-touch + nearest-only), §15 (adjudicating criteria)
- acceptance_criteria_met: (see verdict table + stash identity below)
- known_gaps: the driven window carries no boundary (AWARD/PLACEMENT NOT_EVALUATED there; measured on the natural stream); MATCH-RESTART-REARM NOT_EVALUATED (no post-goal/halftime reset in these fixtures); corner cluster OUT of scope
- claims_not_made: (below)

## Realization (explicit)

- is: receiver-steering destination control (movement-direction channel)
- not_a: a pass-button ball-server — the human is not the literal server; the core's countdown-zero auto-serve would override a single human pass

## Discriminating guards

- human_input_changes_serve_target_driven: true
- human_input_changes_serve_target_natural: true
- human_marker_present_on_human_taken: true
- human_marker_absent_on_cpu_fallback: true
- marker_presence_detail: {"driven_human_window_ticks":24,"driven_human_controlled_ticks":24,"natural_human_window_ticks":0,"natural_human_controlled_ticks":0}
- driven_freeze_gate: {"human_window_ticks":24,"human_controlled_ticks":24,"human_directed_ticks":19,"cpu_human_window_ticks":0,"cpu_human_controlled_ticks":0,"cpu_human_directed_ticks":0}

## Per-run verdicts (executed evaluator, not forced)

| run | gated | humanWindow | humanDirected | humanControlled | serveTarget | key verdicts |
|---|---|---|---|---|---|---|
| human-throwin-driven | true | 24 | 19 | 24 | {"x":20.494974746830586,"y":29.505025253169414} | THROW-IN-PLACEMENT=NOT_EVALUATED; THROW-IN-SERVE=PASS; THROW-IN-TIMER-FREEZE=PASS; THROW-IN-AWARD=NOT_EVALUATED; RESTART-FREEZE-UNTIL-FIRST-TOUCH=PASS; RESTART-NEAREST-ONLY=NOT_EVALUATED; RESTART-REARM=NOT_EVALUATED; TIMER-FREEZE=PASS |
| human-throwin-driven-stashed | false | 0 | 0 | 0 | null | THROW-IN-PLACEMENT=NOT_EVALUATED; THROW-IN-SERVE=NOT_EVALUATED; THROW-IN-TIMER-FREEZE=NOT_EVALUATED; THROW-IN-AWARD=NOT_EVALUATED; RESTART-FREEZE-UNTIL-FIRST-TOUCH=NOT_EVALUATED; RESTART-NEAREST-ONLY=NOT_EVALUATED; RESTART-REARM=NOT_EVALUATED; TIMER-FREEZE=NOT_EVALUATED |
| human-throwin-driven-cpu | true | 0 | 0 | 0 | {"x":20,"y":30} | THROW-IN-PLACEMENT=NOT_EVALUATED; THROW-IN-SERVE=PASS; THROW-IN-TIMER-FREEZE=PASS; THROW-IN-AWARD=NOT_EVALUATED; RESTART-FREEZE-UNTIL-FIRST-TOUCH=PASS; RESTART-NEAREST-ONLY=NOT_EVALUATED; RESTART-REARM=NOT_EVALUATED; TIMER-FREEZE=PASS |
| human-throwin-driven-cpu-stashed | false | 0 | 0 | 0 | null | THROW-IN-PLACEMENT=NOT_EVALUATED; THROW-IN-SERVE=NOT_EVALUATED; THROW-IN-TIMER-FREEZE=NOT_EVALUATED; THROW-IN-AWARD=NOT_EVALUATED; RESTART-FREEZE-UNTIL-FIRST-TOUCH=NOT_EVALUATED; RESTART-NEAREST-ONLY=NOT_EVALUATED; RESTART-REARM=NOT_EVALUATED; TIMER-FREEZE=NOT_EVALUATED |
| human-throwin-natural | true | 0 | 0 | 0 | {"x":26.223749692840773,"y":27.8825744815507} | THROW-IN-PLACEMENT=PASS; THROW-IN-SERVE=PASS; THROW-IN-TIMER-FREEZE=PASS; THROW-IN-AWARD=PASS; RESTART-FREEZE-UNTIL-FIRST-TOUCH=PASS; RESTART-NEAREST-ONLY=PASS; RESTART-REARM=NOT_EVALUATED; TIMER-FREEZE=PASS |
| human-throwin-natural-stashed | false | 0 | 0 | 0 | null | THROW-IN-PLACEMENT=NOT_EVALUATED; THROW-IN-SERVE=NOT_EVALUATED; THROW-IN-TIMER-FREEZE=NOT_EVALUATED; THROW-IN-AWARD=NOT_EVALUATED; RESTART-FREEZE-UNTIL-FIRST-TOUCH=NOT_EVALUATED; RESTART-NEAREST-ONLY=NOT_EVALUATED; RESTART-REARM=NOT_EVALUATED; TIMER-FREEZE=NOT_EVALUATED |
| human-throwin-natural-cpu | true | 0 | 0 | 0 | {"x":22.106324174391474,"y":32} | THROW-IN-PLACEMENT=PASS; THROW-IN-SERVE=PASS; THROW-IN-TIMER-FREEZE=PASS; THROW-IN-AWARD=PASS; RESTART-FREEZE-UNTIL-FIRST-TOUCH=PASS; RESTART-NEAREST-ONLY=PASS; RESTART-REARM=NOT_EVALUATED; TIMER-FREEZE=PASS |
| human-throwin-natural-cpu-stashed | false | 0 | 0 | 0 | null | THROW-IN-PLACEMENT=NOT_EVALUATED; THROW-IN-SERVE=NOT_EVALUATED; THROW-IN-TIMER-FREEZE=NOT_EVALUATED; THROW-IN-AWARD=NOT_EVALUATED; RESTART-FREEZE-UNTIL-FIRST-TOUCH=NOT_EVALUATED; RESTART-NEAREST-ONLY=NOT_EVALUATED; RESTART-REARM=NOT_EVALUATED; TIMER-FREEZE=NOT_EVALUATED |

## Stash identity and hash neutrality

- human-throwin-driven-stashed: injectedFacts=0 stateHashChainIdentical=true
- human-throwin-driven-cpu-stashed: injectedFacts=0 stateHashChainIdentical=true
- human-throwin-natural-stashed: injectedFacts=0 stateHashChainIdentical=true
- human-throwin-natural-cpu-stashed: injectedFacts=0 stateHashChainIdentical=true

## criteria_map (every registered MATCH-* criterion)

- MATCH-RESTART-FREEZE-UNTIL-FIRST-TOUCH: human-throwin-driven=PASS, human-throwin-driven-cpu=PASS, human-throwin-natural=PASS, human-throwin-natural-cpu=PASS
- MATCH-RESTART-NEAREST-ONLY: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=PASS, human-throwin-natural-cpu=PASS
- MATCH-CORNER-KICK-AWARD: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=NOT_EVALUATED, human-throwin-natural-cpu=NOT_EVALUATED
- MATCH-CORNER-KICK-PLACEMENT: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=NOT_EVALUATED, human-throwin-natural-cpu=NOT_EVALUATED
- MATCH-CORNER-KICK-CROSS: human-throwin-driven=BLOCKED_MISSING_REFERENCE, human-throwin-driven-cpu=BLOCKED_MISSING_REFERENCE, human-throwin-natural=BLOCKED_MISSING_REFERENCE, human-throwin-natural-cpu=BLOCKED_MISSING_REFERENCE
- MATCH-CORNER-KICK-TIMER-FREEZE: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=NOT_EVALUATED, human-throwin-natural-cpu=NOT_EVALUATED
- MATCH-GOAL-KICK-AWARD: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=NOT_EVALUATED, human-throwin-natural-cpu=NOT_EVALUATED
- MATCH-GOAL-KICK-PLACEMENT: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=NOT_EVALUATED, human-throwin-natural-cpu=NOT_EVALUATED
- MATCH-GOAL-KICK-DISTRIBUTION: human-throwin-driven=BLOCKED_MISSING_REFERENCE, human-throwin-driven-cpu=BLOCKED_MISSING_REFERENCE, human-throwin-natural=BLOCKED_MISSING_REFERENCE, human-throwin-natural-cpu=BLOCKED_MISSING_REFERENCE
- MATCH-GOAL-KICK-TIMER-FREEZE: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=NOT_EVALUATED, human-throwin-natural-cpu=NOT_EVALUATED
- MATCH-KICKOFF-FREEZE: human-throwin-driven=PASS, human-throwin-driven-cpu=PASS, human-throwin-natural=PASS, human-throwin-natural-cpu=PASS
- MATCH-KICKOFF-FIRST-TOUCH: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=PASS, human-throwin-natural-cpu=PASS
- MATCH-RESTART-REARM: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=NOT_EVALUATED, human-throwin-natural-cpu=NOT_EVALUATED
- MATCH-OUT-OF-PLAY-DETECT: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=PASS, human-throwin-natural-cpu=PASS
- MATCH-OUT-OF-PLAY-NO-LAST-TOUCH: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=PASS, human-throwin-natural-cpu=PASS
- MATCH-SCORING-GOAL-DEVENT: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=NOT_EVALUATED, human-throwin-natural-cpu=NOT_EVALUATED
- MATCH-SCORING-GOAL-PHASE: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=NOT_EVALUATED, human-throwin-natural-cpu=NOT_EVALUATED
- MATCH-THROW-IN-AWARD: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=PASS, human-throwin-natural-cpu=PASS
- MATCH-THROW-IN-PLACEMENT: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=PASS, human-throwin-natural-cpu=PASS
- MATCH-THROW-IN-SERVE: human-throwin-driven=PASS, human-throwin-driven-cpu=PASS, human-throwin-natural=PASS, human-throwin-natural-cpu=PASS
- MATCH-THROW-IN-TIMER-FREEZE: human-throwin-driven=PASS, human-throwin-driven-cpu=PASS, human-throwin-natural=PASS, human-throwin-natural-cpu=PASS
- MATCH-TIMER-DECREMENT: human-throwin-driven=PASS, human-throwin-driven-cpu=PASS, human-throwin-natural=PASS, human-throwin-natural-cpu=PASS
- MATCH-TIMER-HALFTIME: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=NOT_EVALUATED, human-throwin-natural-cpu=NOT_EVALUATED
- MATCH-TIMER-FULLTIME: human-throwin-driven=NOT_EVALUATED, human-throwin-driven-cpu=NOT_EVALUATED, human-throwin-natural=NOT_EVALUATED, human-throwin-natural-cpu=NOT_EVALUATED
- MATCH-TIMER-FREEZE: human-throwin-driven=PASS, human-throwin-driven-cpu=PASS, human-throwin-natural=PASS, human-throwin-natural-cpu=PASS

## claims_not_made

- No suite-level PASS claim: the per-test overall for the rules suite is a per-test verdict collection, not a suite PASS.
- No PROMOTION claim.
- No PES 2017 fidelity / measured PES envelope claim; MATCH-GOAL-KICK-DISTRIBUTION and MATCH-CORNER-KICK-CROSS stay BLOCKED_MISSING_REFERENCE (§14).
- No FOUNDATION_LAB_PASS claim.
- No invented reference envelope or tolerance.
- No claim that the human becomes the literal ball-server for every restart type: the realization is receiver-steering destination control (the accepted HUMAN-RESTART-CONTROL).
- No gameplay / source / contract / adapter-flow / spec change: src/simulation/, src/contracts/ and specs/ are EMPTY; the changes are the gated runner option + the protected rules oracle human-body exemption (both observation-level / additive).

## Criterion caveats (honest disclosure)

- MATCH-THROW-IN-SERVE for a human-directed destination attests the serve is still a LEGAL throw-in serve (chest height z=1.5 m, upward vertical velocity, distinct into-play receiver target, unit direction). It does NOT attest which receiver is chosen — the human-directed destination control changes only the served target, not the serve's legality/quality.
- The driven window (human-throwin-driven) carries no boundary event, so MATCH-THROW-IN-AWARD and MATCH-THROW-IN-PLACEMENT are NOT_EVALUATED there; they are measured on the natural stream (human-throwin-natural).
- The anti-huddle freeze rule (§12 rule 1) exempts the human-controlled body ONLY on a genuinely human-taken window (the window-scoped humanWindowTaken marker AND the body-id match); every other non-taker body must hold its anchor. This is the accurate model of a human-controlled body, not a weakening.
- Driven-window FREEZE rationale: the post-window coast (ticks where the human-directed gate drops to false but the receiver still drifts up to ~0.87 m vs the 0.75 m home tolerance) is exempt through the window-scoped humanWindowTaken marker (the whole untouched window is marked taken because the human directed on at least one tick of it), NOT through a per-tick humanDirected leak. The CPU-fallback stream carries no humanWindowTaken/humanControlledPlayerId field, so no exemption can fire there (byte-identical by gate, not fixture luck).
- MATCH-RESTART-REARM is NOT_EVALUATED on every run: none of these fixtures observes a post-goal / halftime reset re-arm.
- Blocked references (MATCH-GOAL-KICK-DISTRIBUTION, MATCH-CORNER-KICK-CROSS) stay BLOCKED_MISSING_REFERENCE (§14).
