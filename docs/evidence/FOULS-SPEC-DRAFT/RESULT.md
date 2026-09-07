# FOULS-SPEC-DRAFT — Builder report

## Builder report

- objective_id: FOULS-SPEC-DRAFT
- builder_agent: builder-structured
- builder_model: deepseek-v4-flash
- evidence_class: HEADLESS
- hypothesis: A dedicated fouls/cards spec draft (spec-only) that mirrors the accepted RULES-SPEC-DRAFT pattern — an engine-grounded definition of what a foul IS (grounded in the accepted duel/tackle machinery: the man-not-ball tackle contact), versioned provisional `fouls-v1` parameters, adjudicating criteria NAMED but NOT registered, deferred items named (offside/penalties stay regulation-only, no existence claim; the free-kick consequence references the accepted restart machinery rather than inventing a new one), and honest `BLOCKED_MISSING_REFERENCE` disclosures — with a binding test that pins the spec's quoted constants to the machine-readable sources and asserts the named criteria are NOT in the evaluator registry, and a byte-reproducible record, all WITHOUT touching `src/`, `eval/`, `gauntlet/`, or any existing spec.

- files_changed:
  - `specs/FOULS_CARDS_SPEC.md` (new — the dedicated fouls/cards spec draft)
  - `tests/unit/eval/fouls-spec-binding.test.ts` (new — binding test, 42 tests)
  - `scripts/capture-fouls-spec-record.ts` (new — byte-reproducible record producer)
  - `docs/evidence/FOULS-SPEC-DRAFT/record.json` (new — deterministic record, record_sha256 pinned)
  - `docs/evidence/FOULS-SPEC-DRAFT/audit.json` (new — deterministic audit, status PASS)
  - `docs/evidence/FOULS-SPEC-DRAFT/RESULT.md` (new — this report)

  `git diff src/ eval/ gauntlet/` is EMPTY (verified — no implementation, evaluator, or Gauntlet change leaked).

- commands_run:
  - cmd: `mise exec -- pnpm vitest run tests/unit/eval/fouls-spec-binding.test.ts --project node`
    exit_code: 0
    result: "42/42 PASS"
  - cmd: `mise exec -- pnpm exec tsx scripts/capture-fouls-spec-record.ts` (ordinary-mode run 1 — no `WIP_SECTION` gate)
    exit_code: 0
    result: "wrote scratch to test-results/FOULS-SPEC-DRAFT/record.json; record_sha256=e98a1efe08f1c8ec68c5b957a801e9035c70a132e3f5d354e3dd30b8767b0716; constant_drift=[]; model_drift=[]; registered_criteria=[]; docs/evidence/ left byte-identical (empty)"
  - cmd: `mise exec -- pnpm exec tsx scripts/capture-fouls-spec-record.ts` (ordinary-mode run 2 — byte-identity demonstration)
    exit_code: 0
    result: "record_sha256 identical; scratch file sha256 2550ca4457037f96fedded1bc5794c938a9effdc6c2ae4fbbe9178442c7f26b2 === run 1 (cmp identical, diff empty); docs/evidence/ unchanged"
  - cmd: `WIP_SECTION=__EVIDENCE__:FOULS-SPEC-DRAFT mise exec -- pnpm exec tsx scripts/capture-fouls-spec-record.ts` (evidence-mode — writes the durable record)
    exit_code: 0
    result: "wrote docs/evidence/FOULS-SPEC-DRAFT/record.json; record_sha256=e98a1efe08f1c8ec68c5b957a801e9035c70a132e3f5d354e3dd30b8767b0716 (stable); evidence_gate=__EVIDENCE__:FOULS-SPEC-DRAFT"
  - cmd: `mise exec -- pnpm run typecheck`
    exit_code: 0
    result: "tsc --noEmit core + node + browser all clean"
  - cmd: `mise exec -- pnpm vitest run tests/unit/eval/{match-rules-spec-binding,eval-registry,rules-suite,goalkeepers-suite,duels-suite,oracle-registry,mutant-core,gk-oracle,GK-KEEPER-ORACLE-REGISTRATION-binding,GK-SUITE-ORGANIC-STATE-binding}.test.ts --project node --testTimeout 120000`
    exit_code: 0
    result: "237/237 PASS across 10 files"
  - cmd: `mise exec -- pnpm vitest run tests/unit/eval/{rules-oracle,RULES-SUITE-REGISTRATION-binding,foundation-evaluator}.test.ts tests/candidate-scope.node.test.ts tests/evidence-sanity.node.test.ts tests/capture-hygiene.node.test.ts --project node --testTimeout 300000`
    exit_code: 0
    result: "147/147 PASS across 6 files"
  - cmd: `mise exec -- pnpm vitest run tests/architecture --project node --testTimeout 120000`
    exit_code: 0
    result: "27/27 PASS across 6 files"
  - cmd: `mise exec -- pnpm run gauntlet:audit -- --objective FOULS-SPEC-DRAFT --class HEADLESS --tests-pass true --integration-test-pass true`
    exit_code: 0
    result: "status PASS"

- tests_run:
  - name: tests/unit/eval/fouls-spec-binding.test.ts
    result: "PASS (42/42)"
  - name: eval registry / neighbor batteries (eval-registry, rules-suite, rules-oracle, goalkeepers-suite, duels-suite, oracle-registry, mutant-core, gk-oracle, GK-*-binding, match-rules-spec-binding, foundation-evaluator, RULES-SUITE-REGISTRATION-binding)
    result: "PASS (all green; the match-rules-spec-binding 28/28 still holds)"
  - name: tests/architecture
    result: "PASS (27/27 — core-ts-isolation, core-boundary, toolchain, contracts-no-forbidden-imports)"
  - name: tests/candidate-scope.node.test.ts, tests/evidence-sanity.node.test.ts, tests/capture-hygiene.node.test.ts
    result: "PASS (8/8)"

- integration_test_result: NOT_APPLICABLE (HEADLESS class; no multi-tick trajectory/integration gate required). The `--integration-test-pass true` flag was supplied per the objective and is ignored for HEADLESS.

- slot_wiring_result: NOT_APPLICABLE (no slot/player ownership criterion; no `--requires-slot-wiring`).

- required_evidence:
  - record.json — record_sha256=e98a1efe08f1c8ec68c5b957a801e9035c70a132e3f5d354e3dd30b8767b0716; byte-reproducible across two consecutive ordinary-mode runs (no wall-clock field in hashed content).
  - audit.json — status PASS (all checks PASS or NOT_APPLICABLE), class HEADLESS.
  - RESULT.md — this report.

- artifacts:
  - specs/FOULS_CARDS_SPEC.md
  - tests/unit/eval/fouls-spec-binding.test.ts
  - scripts/capture-fouls-spec-record.ts
  - docs/evidence/FOULS-SPEC-DRAFT/record.json
  - docs/evidence/FOULS-SPEC-DRAFT/audit.json
  - docs/evidence/FOULS-SPEC-DRAFT/RESULT.md

- spec_sections (specs/FOULS_CARDS_SPEC.md):
  1. Purpose and authority
  2. Scope and explicit exclusions (2.1 in scope / 2.2 out of scope)
  3. Normative vocabulary and configuration model
  4. The duel/tackle machinery the foul grounds on (accepted, immutable)
  5. What a foul IS in this engine (5.1 foul definition / 5.2 NOT a foul / 5.3 carrier identity)
  6. Advantage semantics (named, NOT implemented)
  7. Card / disciplinary semantics (named, NOT implemented)
  8. Set-piece consequence of a foul (free kick, deferred, references accepted machinery)
  9. Versioned provisional configuration (`fouls-v1`)
  10. Adjudicating telemetry / suite criteria (named, NOT registered)
  11. BLOCKED_MISSING_REFERENCE values
  12. Keeper interaction
  13. Declaration of limitations
  14. Relation to GAMEPLAY_EVALUATION_SPEC
  15. Deferred rule behaviors (future-with-prerequisites)

- engine-grounded foul definition:
  - A foul candidate is a defensive-tackle active-window `player-player-contact` with `contactType` ∈ {`standing-tackle`, `slide-tackle`}, `tacklePhase === "active"`, and `duelWon === false` (equivalently `ballReachable === false`) — a man-not-ball contact produced by the EXISTING tackle system, with no new collider, event, action, or contact rule.
  - NOT a foul: a tackle that reaches the ball (`ballReachable === true` — clean tackle / won duel) and a symmetric shoulder-to-shoulder `player-player-contact` (`contactType === "player-player"`, `PHY-SHLD-001-CONT`).
  - Carrier identity uses `foundation-cpu-tackle-v1.carrierContestDistance` (2.5 m) as a NAMED criterion input, not implemented.

- model ids / parameters declared:
  - Owning model: `fouls-v1`.
  - Referenced accepted models: `foundation-tackle-v1`, `foundation-cpu-tackle-v1`, `foundation-player-contact-v1`, `foundation-contact-v1`, `foundation-config-v1`, `foundation-fixed-dt-v1`, `match-rules-v1`, `anti-huddle-v1`, `gk-small-sided-v1`.
  - `fouls-v1` provisional keys: `foul_detect_contact_severity_threshold` (0.75), `fouls_yellow_accumulation_count` (2), `fouls_red_accumulation_count` (5), `foul_card_direct_red_severity_threshold` (0.85), `advantage_window_ticks` (24), `foul_caution_pending_ticks` (12), `foul_ball_carrier_contest_distance` (2.5, referenced from `foundation-cpu-tackle-v1`).
  - Quoted accepted values the binding test pins: standingReach 1.6, slideReach 2.8, contactConeMinCos 0, carrierImpulseSpeed 1.4, slideLungeSpeed 5.0, ballDeflectionSpeed 7.5, carrierContestDistance 2.5, playerRadius 0.25, separationStiffness 0.5, velocityDampingNormal 0.3, contactRadius 1.2, 1/60 tick, RESTART_HOLD_MIN_TICKS 2, KICKOFF_FREEZE_HOME_TOLERANCE 0.75, CHASE_NEAREST_HOME_TOLERANCE 0.75.

- adjudicating criteria NAMED but NOT registered:
  - `FOUL-DETECT`, `FOUL-CLEAN-TACKLE`, `CARD-ISSUED`, `ADVANTAGE-PLAYED`, `FREE-KICK-AWARD`.
  - The binding test asserts all five are NOT registered (not in `COMMON_CRITERIA`, not in any test binding `criterion_bindings`, not in any suite criteria list, and no `fouls` suite exists). Result: `registered_criteria=[]` in the record.

- blocked references (all BLOCKED_MISSING_REFERENCE, never invented):
  - `foul_card_threshold_ref`, `foul_severity_distribution_ref`, `foul_ball_carrier_identity_ref`, `advantage_window_ref_ms`, `free_kick_trajectory_ref`, `disciplinary_scale_ref`, `card_display_visual_ref`.

- acceptance_criteria_met:
  - Dedicated fouls/cards spec drafted (`specs/FOULS_CARDS_SPEC.md`), spec-only.
  - Foul semantics grounded in the accepted duel/tackle machinery (man-not-ball tackle contact) with the clean complement; no new behavior invented.
  - Versioned provisional `fouls-v1` parameter block (thresholds / card accumulation / advantage window) explicitly VERSIONED_PROVISIONAL, not PES magnitudes.
  - Adjudicating criteria NAMED but NOT registered (RULES-SPEC-DRAFT §15 pattern); the binding test asserts they are absent from the registry.
  - Deferred items named: offside and penalty kicks stay regulation-only with no existence claim; the free-kick set piece references the accepted restart machinery rather than inventing a new one.
  - BLOCKED_MISSING_REFERENCE disclosures present (7).
  - Cross-references to MATCH_RULES_SPEC §16 / §12.1 and GOALKEEPER (gk-small-sided-v1) and GAMEPLAY_EVALUATION_SPEC §7.2 / §7.4.
  - Binding test pins quoted constants to machine sources (constant drift fails) + asserts named criteria NOT registered (42/42).
  - Evidence written via `gauntlet:audit` (HEADLESS, PASS).
  - `git diff src/ eval/ gauntlet/` EMPTY; the critic can verify no implementation leaked.

- known_gaps:
  - `fouls-v1` is a prose-declared model id; no `eval/contracts/fouls-config.ts` exists because the hard dependency direction keeps `eval/contracts/` untouched at this milestone. The binding test binds only to existing machine-readable sources (`foundation-*`, `anti-huddle-v1`, `gk-small-sided-v1`), not to a non-existent fouls config module.
  - The adjudicating criteria in §10 are named for intent only and are NOT registered in any suite (no evaluator/oracle/scenario change, per the objective).
  - `KICKOFF_FREEZE_HOME_TOLERANCE` / `CHASE_NEAREST_HOME_TOLERANCE` (0.75 m) are not exported from `cpu-adapter.ts`, so the binding test asserts them as prose strings (spec contains the key names + values) rather than binding them to an import — same as the accepted RULES-SPEC-DRAFT precedent.
  - A single full `pnpm run test` invocation exceeds the 5-minute tool window and was not run to completion; because `git diff src/ eval/ gauntlet/` is EMPTY (no engine/eval/gauntlet change), no regression is possible from this objective, and the neighbor eval/architecture/hygiene batteries (411 tests) all pass.
  - The no-implementation claim is supported by the empty `src/`/`eval/`/`gauntlet/` diff, but the definitive no-implementation-leak verification belongs to the independent critic per the objective.

- claims_not_made:
  - No implementation claim: no foul, card, advantage, or free-kick machinery exists in `src/`; the spec names future semantics only.
  - No adjudicating criterion (FOUL-DETECT / FOUL-CLEAN-TACKLE / CARD-ISSUED / ADVANTAGE-PLAYED / FREE-KICK-AWARD) is registered.
  - No fouls behavior exists in the engine.
  - No PES 2017 fidelity or invented constant: `fouls-v1` parameters are VERSIONED_PROVISIONAL, not PES magnitudes; all referenced accepted values come from machine sources.
  - Offside and penalty kicks stay regulation-only with no existence claim.
  - No PROMOTION claim; no FOUNDATION_LAB_PASS claim.
  - Blocked references stay BLOCKED_MISSING_REFERENCE (never converted into invented envelopes or tolerances).
