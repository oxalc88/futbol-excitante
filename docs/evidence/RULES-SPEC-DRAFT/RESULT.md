# RULES-SPEC-DRAFT — Builder report

## Builder report

- objective_id: RULES-SPEC-DRAFT
- builder_agent: builder-structured
- builder_model: deepseek-v4-flash
- evidence_class: HEADLESS
- hypothesis: A dedicated match-rules spec (spec-only) that mirrors the accepted GOALKEEPER_SPEC.md structure — normative semantics grounded in the accepted restart machinery (RESTART-ANTI-HUDDLE-COHERENCE) and the existing MATCH-* suites, with every unmeasured value as versioned provisional configuration under `match-rules-v1` (referencing accepted config where it overlaps), honest `BLOCKED_MISSING_REFERENCE` disclosures, deferred-until-suites-exist regulation behaviors, and a binding test proving the spec's declared model ids / referenced accepted-config values match the machine-readable sources — without touching `src/`, `eval/`, `gauntlet/`, or any existing spec.

- files_changed:
  - `specs/MATCH_RULES_SPEC.md` (new — the dedicated rules spec)
  - `tests/unit/eval/match-rules-spec-binding.test.ts` (new — binding test, 28 tests)
  - `docs/evidence/RULES-SPEC-DRAFT/audit.json` (new — deterministic audit, PASS 20/20)
  - `docs/evidence/RULES-SPEC-DRAFT/RESULT.md` (new — this report)

- commands_run:
  - cmd: `mise exec -- pnpm vitest run tests/unit/eval/match-rules-spec-binding.test.ts --project node`
    exit_code: 0
  - cmd: `mise exec -- pnpm run typecheck`
    exit_code: 0
  - cmd: `mise exec -- pnpm run gauntlet:audit -- --objective RULES-SPEC-DRAFT --class HEADLESS --tests-pass true --integration-test-pass true`
    exit_code: 0

- tests_run:
  - name: tests/unit/eval/match-rules-spec-binding.test.ts
    result: PASS (28/28)

- integration_test_result: NOT_APPLICABLE (HEADLESS class; no multi-tick trajectory/integration gate required). The `--integration-test-pass true` flag was supplied per the objective and is ignored for HEADLESS.

- slot_wiring_result: NOT_APPLICABLE (no slot/player ownership criterion; no `--requires-slot-wiring`).

- required_evidence:
  - audit.json — status PASS, 20/20 checks (0 FAIL, 0 REVIEW_REQUIRED), class HEADLESS.

- artifacts:
  - specs/MATCH_RULES_SPEC.md
  - tests/unit/eval/match-rules-spec-binding.test.ts
  - docs/evidence/RULES-SPEC-DRAFT/audit.json
  - docs/evidence/RULES-SPEC-DRAFT/RESULT.md

- spec_sections:
  1. Purpose and authority
  2. Scope and explicit exclusions (2.1 in scope / 2.2 out of scope)
  3. Normative vocabulary and configuration model
  4. Lifecycle model: which lifecycle the rules describe (core-owned vs legacy)
  5. Out-of-play detection (5.1 goal line / 5.2 touchline / 5.3 last-touch requirement)
  6. Throw-in (MATCH-THROW-IN)
  7. Goal kick (MATCH-GOAL-KICK)
  8. Corner kick (MATCH-CORNER-KICK)
  9. Kickoff and post-goal / halftime reset
  10. Scoring
  11. Timing / match clock
  12. Freeze / unfreeze interaction with the accepted anti-huddle contract (12.1 keeper interaction)
  13. Versioned provisional configuration (`match-rules-v1`)
  14. BLOCKED_MISSING_REFERENCE values
  15. Adjudicating telemetry / suite criteria (named, NOT registered)
  16. Deferred rule behaviors (future-with-prerequisites): fouls/cards/free kicks, offside, penalty kicks
  17. Declaration of limitations

- model ids / parameters declared:
  - Owning model: `match-rules-v1`.
  - Referenced accepted models: `foundation-goal-v1` (goalWidth 7.32 m, goalHeight 2.44 m, postRadius 0.05 m, crossbarRadius 0.05 m), `foundation-ball-v1` (ballRadius 0.11 m, gravity 9.81 m/s², restitution 0.55, groundResistance 0.02), `foundation-fixed-dt-v1` (1/60 s), `foundation-config-v1` (immutable versioned foundation config), `anti-huddle-v1` (RESTART_HOLD_MIN_TICKS=2, KICKOFF_FREEZE_HOME_TOLERANCE=0.75 m, CHASE_NEAREST_HOME_TOLERANCE=0.75 m), `gk-small-sided-v1` (keeper reaction window / save reach / distribution window).
  - `match-rules-v1` provisional keys: `default_throw_in_countdown` (60), `default_goal_kick_countdown` (60), `default_corner_kick_countdown` (60), `default_goal_reset_ticks` (60), `default_halftime_countdown` (60), `goal_area_half_width` (9.16 m), `goal_area_depth` (5.5 m), `throw_in_ball_z` (1.5 m), `throw_in_speed` (12 m/s), `throw_in_vertical_component` (0.15), `goal_kick_speed` (16 m/s), `goal_kick_vertical_component` (0.25), `corner_cross_speed` (14 m/s), `corner_cross_vertical_component` (0.35), `corner_cross_target_offset_x` (8 m), `post_rebound_restitution` (0.7).

- blocked references (all BLOCKED_MISSING_REFERENCE, never invented):
  - `throw_in_trajectory_ref`
  - `goal_kick_distribution_ref`
  - `corner_cross_trajectory_ref`
  - `restart_serve_latency_ref_ms`
  - `post_goal_reset_ref_ticks`
  - `half_time_break_ref_seconds`
  - `ball_in_play_accounting_ref`

- acceptance_criteria_met:
  - Dedicated rules spec drafted (`specs/MATCH_RULES_SPEC.md`), spec-only.
  - Normative semantics for throw-in, goal kick, corner, kickoff, scoring, out-of-play, timing grounded in the accepted restart machinery.
  - Deferred-until-suites-exist regulation behaviors listed (fouls/cards/free kicks, offside, penalty kicks) — out of scope / future-with-prerequisites.
  - Every unmeasured parameter as versioned provisional configuration under `match-rules-v1`, referencing accepted config where it overlaps.
  - Reference-needing values declared `BLOCKED_MISSING_REFERENCE`.
  - Scope-exclusions section present.
  - Binding test asserts the spec's declared model ids and referenced accepted-config values match the machine-readable sources (28/28).
  - Evidence written via `gauntlet:audit` (HEADLESS, PASS 20/20).

- known_gaps:
  - `match-rules-v1` is a prose-declared model id; no `eval/contracts/match-rules-config.ts` exists because the hard dependency direction keeps `eval/contracts/` untouched at this milestone. The binding test therefore binds only to existing machine-readable sources (`foundation-*`, `gk-small-sided-v1`, `anti-huddle-v1`), not to a non-existent match-rules config module.
  - The adjudicating criteria in §15 are named for intent only and are NOT registered in any suite (no evaluator/oracle/scenario change, per the objective).
  - The `KICKOFF_FREEZE_HOME_TOLERANCE` / `CHASE_NEAREST_HOME_TOLERANCE` values (0.75 m) are not exported from `cpu-adapter.ts`, so the binding test asserts their presence as prose strings rather than binding them to an import.

- claims_not_made:
  - No PES 2017 fidelity claim. The spec explicitly states it is "not a measurement of PES 2017" and that values "MUST NOT be described as PES magnitudes".
  - No `FOUNDATION_LAB_PASS`, milestone `PASS`, or regression `PASS` claim.
  - No invented reference envelope or tolerance; blocked references stay `BLOCKED_MISSING_REFERENCE`.
  - No implementation, evaluator, oracle, catalog, scenario, or adapter change.
  - No claim that fouls / offside / penalty kicks / full-match ecology exist; they are explicitly deferred.
