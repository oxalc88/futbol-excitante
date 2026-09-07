# Gauntlet 0.9.7

Consolidation release over 0.9.6. Horizon v29-v33 delivered the executable rules layer (the `rules` evaluator suite + designation facts + aggregate state), the goalkeepers suite under the core-owned lifecycle, human-directed restarts, the visible full-match lifecycle, and the complete playable small-sided loop. This release consolidates those gains into the release record. BOOKKEEPING; zero gameplay/source change.

## Playable

The complete small-sided loop is playable in the browser (1v1-5v5, human-vs-CPU + CPU-vs-CPU):

- Setup menu → match selection: the full 1v1/2v2/3v3/5v5 × human-vs-CPU + CPU-vs-CPU ladder is menu-selectable (SMALL-SIDED-LADDER-MENU-COMPLETION; BROWSER-MATCH-SETUP-MENU).
- Human controls, including the designated keeper in human-vs-CPU 5v5 (HUMAN-KEEPER-CONTROL); the CPU fallback is unchanged when the human does not switch.
- Human-directed restart destination via receiver-steering during the restart window (HUMAN-RESTART-CONTROL); the human-taken restart conforms through the rules suite (HUMAN-RESTART-RULES-CONFORMANCE).
- Duels: human standing/sliding tackle actions (HUMAN-DEFENSIVE-DUEL-CONTROL) and CPU tackle commitment on the same action system (CPU-DEFENSIVE-TACKLE).
- Goalkeeper behavior: designated-keeper arc hold/save/claim/release at the adapter layer (GK-5V5-ADAPTER-BEHAVIOR; GK-BROWSER-DYNAMIC-EVIDENCE) with the core-owned keeper off-arc drift fixed (GK-CORE-OWNED-ARC-FIX).
- Visible full-match lifecycle: the match-phase HUD and event-centered browser frames through the halftime break and fulltime (BROWSER-FULL-MATCH-FLOW-EVIDENCE); genuine timer-driven halftime/fulltime (RULES-FACTS-DEPTH-CONFORMANCE).
- Fulltime dead end closed: the loop freezes at fulltime and offers the rematch/menu flow (FULLTIME-FLOW-CLOSURE).

## Executable / attested

- Rules suite (`suite-rules-v1`): 25 MATCH-* criteria → 23 PASS / 2 BLOCKED_MISSING_REFERENCE / 0 NOT_EVALUATED / 0 FAIL, plus all 8 protected invariants aggregate PASS (RULES-SUITE-STATE-RERUN, record 36fc77e5…). With the COMMON-DETERMINISTIC determinism row the suite table is 24 PASS / 2 BLOCKED / 0 / 0 (SUITE-DETERMINISTIC-TWO-RUN, record abaf6ccd…).
- Goalkeepers suite (`suite-goalkeepers-v1`): 9 PASS / 0 FAIL / 2 NOT_EVALUATED / 1 BLOCKED_MISSING_REFERENCE / 1 NEEDS_PERCEPTUAL_REVIEW (SUITE-DETERMINISTIC-TWO-RUN, record abaf6ccd…); its core-owned baseline was 8 PASS / 3 NOT_EVALUATED / 1 BLOCKED / 1 NEEDS_PERCEPTUAL_REVIEW / 0 FAIL (GK-SUITE-CORE-OWNED-STATE, record 5cd1c808…).
- COMMON-DETERMINISTIC is attested PASS for BOTH suites from two-run byte-identity: every attested stream has identical run-1/run-2 per-tick state hashes (SUITE-DETERMINISTIC-TWO-RUN).
- Protected-oracle discipline: 8 protected oracles registered per MATCH_RULES_SPEC §15 (6 in `rules-restart.ts` + 2 in `rules-phase.ts`), mutant/canary-guarded — a wrong-team award, a goal-kick to the non-defending team, a corner awarded when a goal-kick is required, an invalid goalIndex / malformed payload, a goal+out-of-play same-tick, and a null-touch-boundary-then-execution all FAIL; a nonexistent reference is honestly NOT_EVALUATED (RULES-SUITE-REGISTRATION, record 7503f9fe…).
- Designation-facts serialization: the gated `serializeRestartFacts` (default false, strictly post-loop, hash-neutral) plus the restart-designation events computed from the production `assignChaseRoles` close the 3 anti-huddle restart-behavior criteria (RESTART-DESIGNATION-FACTS-CONFORMANCE, record 271b1526…).

## Spec'd

- FOULS_CARDS_SPEC (`specs/FOULS_CARDS_SPEC.md`, model `fouls-v1`): a dedicated fouls/cards spec grounded in the accepted duel/tackle machinery, with versioned provisional parameters, adjudicating criteria NAMED but NOT registered, and BLOCKED_MISSING_REFERENCE disclosed. SPEC ONLY — zero implementation (FOULS-SPEC-DRAFT, record e98a1efe…).

## Deferred

- The literal pass-button ball-server: DEFER decision recorded (HUMAN-BALL-SERVER-DECISION, record 5b6e391a…), with the `HUMAN-BALL-SERVER-LITERAL` future objective outline (its own conformance path) so it is not an open thread.
- Blocked references: MATCH-CORNER-KICK-CROSS + MATCH-GOAL-KICK-DISTRIBUTION (rules suite); GK-*-REF blocked; the fouls blocked references — all stay BLOCKED_MISSING_REFERENCE, never invented.
- Goalkeeper behavior beyond the small-sided scope (no regulation rules, no full-match ecology).
- Regulation rules (offside, penalty kicks) — regulation-only, no existence claim.
- Full-match ecology.

## Honest limitations

- Fixture-driven evidence where applicable: GK-SAVE-CLAIM is PASS only from the driven shot fixture (the organic run is NOT_EVALUATED); GK-DISTRIBUTION-NO-OMNISCIENCE's observation source flipped between the legacy and core-owned runs (disclosed in GK-SUITE-CORE-OWNED-STATE).
- The anti-huddle restart-behavior criteria are evaluated only on the browserParity designation streams; the non-browserParity gated streams carry an observation-shape artifact FAIL and are excluded (disclosed in RULES-SUITE-STATE-RERUN).
- The continuous-play baseline fixture is not re-run in RULES-SUITE-STATE-RERUN (redundant control; its verdicts are subsumed by the re-run streams).
- No PES 2017 fidelity / measured PES envelope; all unmeasured values are VERSIONED_PROVISIONAL configuration. No suite-level PASS claim, no PROMOTION, no FOUNDATION_LAB_PASS.
- No criterion is upgraded beyond what the executed evaluator returns; blocked references stay blocked.

No gameplay behavior changes. No manual edits to `gauntlet/state/**`.
