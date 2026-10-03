# Gauntlet 0.9.8 — product consolidation

**Naming note.** This is the PRODUCT consolidation record. The 0.9.8 *system* release notes are a separate document, `gauntlet/RELEASE-0.9.8.md` (product-first orchestration), which already owned the `0.9.8` name when this horizon objective was written. To avoid overwriting released system notes, the product consolidation record is filed as `RELEASE-0.9.8-PRODUCT.md`, with its evidence under `docs/evidence/RELEASE-0.9.8-PRODUCT/`. The horizon text's "VERSION.json 0.9.7 → 0.9.8 … needle advance" reads as product-release-record naming; the live `gauntlet/VERSION.json` is the *system* version (`0.9.9`) and is deliberately NOT modified by this BOOKKEEPING objective.

Consolidation release over 0.9.7. Horizon v34-v37 delivered the referee loop end-to-end in the shipped app (fouls → free kicks → cards), the card/advantage spec state, and the aggregate-honesty republication, with the goalkeepers regression policy registered. This release consolidates those gains into the release record. BOOKKEEPING; zero gameplay/source change; every claim cites its accepted record.

## Playable

- The referee loop is playable in the shipped app: a menu-visible **Referee** toggle (plus the `referee=1` URL param) gates fouls, free kicks, and cards through the SAME `createSimulation` config surface the shipped composition root uses (REFEREE-SHIPPED-WIRING, record b2f53927…).
- Five event-centered real-Chromium frames — foul-contact@65, freekick-award@67, freekick-served@128, foul-2-contact@289, caution@290 — show the man-not-ball foul → free-kick award (phase FREE KICK) → served free kick → second foul → caution (yellow) in one match; a real player who opts into the Referee toggle sees a free kick AND a card (REFEREE-SHIPPED-WIRING).
- Browser↔headless correspondence is exact: foul ticks [66, 290], free-kick tick 126 offset 0, caution tick 290 offset 0, offender player-1 accumulated 2 (REFEREE-SHIPPED-WIRING) — the verified correspondence is the event structure, never per-tick floats.
- Earlier accepted browser evidence remains the fouls / free-kick / card frames: the foul → free-kick arc (FOUL-FREEKICK-BROWSER-EVIDENCE, record e65c3618…) and the caution(2)/expulsion(5) arc (CARD-BROWSER-EVIDENCE, record bc9daf1f…), both with exact 0/0 tick correspondence.
- Gate-off byte-identity guard: the referee toggle off (an explicit-undefined call === `createSimulation(world)` hash chain) is byte-identical to the pre-change stream (REFEREE-SHIPPED-WIRING).

## Executable / attested

- **Fouls suite (`suite-fouls-v1`): 4 of the 5 `FOULS_CARDS_SPEC` §10 criteria registered, each executed by the evaluator over the accepted streams.** FOUL-DETECT and FOUL-CLEAN-TACKLE (FOULS-SUITE-REGISTRATION, record 5e538e5d…), FREE-KICK-AWARD (FREE-KICK-SUITE-REGISTRATION, record 86a34acb…) and CARD-ISSUED (CARD-ISSUED-SUITE-REGISTRATION, record 3dac8a48…) are registered protected oracles. Executed verdicts over the accepted streams: FOUL-DETECT PASS, FOUL-CLEAN-TACKLE PASS, FREE-KICK-AWARD PASS, CARD-ISSUED honestly NOT_EVALUATED (the accepted streams carry no observable card-issued event; the oracle's PASS/FAIL power is carried by its canary tests, not a re-shaped stream). ADVANTAGE-PLAYED stays NAMED-NOT-REGISTERED. FREE-KICK-AWARD's PASS is carried by the organic stream; the two power-guard streams (a free kick awarded with NO detected foul) deliberately FAIL and are excluded-and-reported (FOULS-AGGREGATE-HONESTY-RERUN, record c8b3b63e…).
- **gk-regression canary:** the registered `gk-regression-canary-v1` (invariant `gk-regression-evidence`, six GK-*-REG criteria) FAILs a GK behavior pin that diverges without a model-version bump, PASSes when the pins hold, and returns honest NOT_EVALUATED when a stream never triggers a pin. `reg` converts NOT_EVALUATED → PASS (GK-REGRESSION-POLICY-REGISTRATION, record fc7d1b97…).
- **Goalkeepers suite (`suite-goalkeepers-v1`): 10 PASS / 0 FAIL / 1 NOT_EVALUATED / 1 BLOCKED_MISSING_REFERENCE / 1 NEEDS_PERCEPTUAL_REVIEW** — exactly one criterion changed versus the 9/0/2/1/1 baseline (`reg` NOT_EVALUATED → PASS); GK-*-REF stays BLOCKED, GK-*-VIS stays NEEDS_PERCEPTUAL_REVIEW and GK-*-CAUSAL stays NOT_EVALUATED (FOULS-AGGREGATE-HONESTY-RERUN, record c8b3b63e…).
- **Aggregate-honesty republication:** the goalkeepers and fouls aggregate verdict state re-published with every stream asserted character-identical to its accepted state-hash pin; the fouls aggregate (3 registered at republication) is reported with the power-guard FAILs excluded AND reported; the cosmetic threads folded verdict-neutral (FOULS-AGGREGATE-HONESTY-RERUN).
- **Designation-facts serialization:** the gated `serializeRestartFacts` (default false, strictly post-loop, hash-neutral) surfaces the committed restart-designation and consequence events (`restart-designation`, `free-kick-executed`, `card-issued`) so the fouls-suite oracles can observe the consequences on organic streams; the mechanism was accepted in RESTART-DESIGNATION-FACTS-CONFORMANCE (record 271b1526…) and reused by the v35-v36 consequence streams (FOUL-CONSEQUENCE-MACHINERY, record 39da80ad…; CARD-MACHINERY, record 01d731ad…).
- **Driven GK closure + human ball-server:** the driven save/release fixtures close the previously NOT_EVALUATED GK observations (GK-DRIVEN-CLOSURE, record 21a59627…); the human-controlled restart taker serves through a pass-gated window (HUMAN-BALL-SERVER-LITERAL, record 85fc082d…).

## Spec'd

- **FOULS_CARDS_SPEC (`specs/FOULS_CARDS_SPEC.md`, model `fouls-v1`) card/advantage state:** §6 advantage semantics is a normative **design contract** — §6.1 playing advantage, §6.2 the bounded advantage window, §6.3 cancellation, §6.4 deferred consequence, §6.5 deferral/registration criteria — promoted from a named stub by ADVANTAGE-WINDOW-SPEC (BOOKKEEPING, candidate `0acbd65`; manifest `docs/evidence/ADVANTAGE-WINDOW-SPEC/manifest.json`, audit artifact sha256 1608f247…). `advantage_window_ticks` (24) and `foul_caution_pending_ticks` (12) are pre-existing `fouls-v1` VERSIONED_PROVISIONAL engine-tick budgets (§9.1), re-characterized as `foundation-fixed-dt-v1` tick budgets — not measured wall-clock latencies. `advantage_retention_ref` stays BLOCKED_MISSING_REFERENCE (no invented retention envelope). ADVANTAGE-PLAYED remains NAMED-NOT-REGISTERED — no criterion, oracle, invariant, binding, or verdict.

## Deferred

- ADVANTAGE-PLAYED machinery: the advantage-window design is spec'd, not implemented; the engine calls every recognized foul (ADVANTAGE-WINDOW-SPEC; FOULS_CARDS_SPEC §6).
- The card contact-severity path (direct red): `foul_card_direct_red_severity_threshold` (0.85) is undefined in spec — BLOCKED_MISSING_REFERENCE; cards issue by equal-fouls accumulation only (CARD-MACHINERY, record 01d731ad…).
- Second-yellow → red: not implemented; the accumulation path issues a caution at 2 accumulated fouls and an expulsion at 5 (CARD-MACHINERY).
- All blocked references stay BLOCKED_MISSING_REFERENCE, never invented: `advantage_retention_ref` + `advantage_window_ref_ms` (FOULS_CARDS_SPEC §11), `foul_card_threshold_ref`, `foul_severity_distribution_ref`, `foul_ball_carrier_identity_ref`, `free_kick_trajectory_ref`, `disciplinary_scale_ref`, `card_display_visual_ref`, plus the GK-*-REF and the rules-suite MATCH-CORNER-KICK-CROSS / MATCH-GOAL-KICK-DISTRIBUTION.
- Regulation rules (offside, penalty kicks) — regulation-only, no existence claim.
- Full-match ecology.
- PES fidelity: no measured PES envelope; all unmeasured values stay VERSIONED_PROVISIONAL.

## Honest limitations

- The referee loop is GATED and opt-in: it is not claimed to be always-on, and PES referee frequency/fidelity is not claimed (REFEREE-SHIPPED-WIRING).
- Driven-fixture evidence: the referee, foul/free-kick and card browser arcs are driven duels (scripted standing tackles, short windows), disclosed, not organic 90-minute matches (REFEREE-SHIPPED-WIRING; FOUL-FREEKICK-BROWSER-EVIDENCE; CARD-BROWSER-EVIDENCE).
- CARD-ISSUED is NOT_EVALUATED on every accepted stream: the driven shape is commit-only and the organic shape is below the caution threshold; the oracle's guards are proven by canary tests, not by an accepted PASS stream (CARD-ISSUED-SUITE-REGISTRATION).
- Browser↔headless correspondence is event-structural only, never per-tick floats (the known pinned-runtime gap) (REFEREE-SHIPPED-WIRING).
- The fouls suite is partial: 4 of 5 §10 criteria registered; FREE-KICK-AWARD's PASS rests on one organic stream with two deliberate power-guard FAILs excluded and reported (FOULS-AGGREGATE-HONESTY-RERUN).
- The gk-regression canary returns honest NOT_EVALUATED for a pin a stream never triggers (never PASS by silence) and is wired only to the six GK-*-REG criteria (GK-REGRESSION-POLICY-REGISTRATION).
- No suite-level PASS, no PROMOTION, no FOUNDATION_LAB_PASS, no milestone PASS; no criterion is upgraded beyond what the executed evaluator returns.

No gameplay behavior changes. No manual edits to `gauntlet/state/**`.
