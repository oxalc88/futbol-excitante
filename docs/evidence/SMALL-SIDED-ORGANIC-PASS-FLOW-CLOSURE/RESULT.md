# SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE — builder result (rev 2, critic RETRY resolved)

## Builder report
- objective_id: SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE
- builder_agent: builder-structured
- builder_model: deepseek-v4-flash
- evidence_class: BOOKKEEPING
- hypothesis: Re-run the accepted situation scanner and SMALL_SIDED_SHAPE milestone reducer over the new coherent anti-huddle / post-ball-fix 5v5 matches (plus the existing deepened matches), update the coherent_match_sources block honestly, preserve the honest milestone PASS (BATCH-5 8/8 decisive), and supersede the milestone bundle with the new playtest run. Evidence-bundle only — zero gameplay change.
- files_changed:
  - docs/evidence/milestones/SMALL_SIDED_SHAPE/playtests/2026-09-04T18-16-07-471Z.json (NEW) — corrected playtest record with the honest coherent_match_sources block
  - docs/evidence/milestones/SMALL_SIDED_SHAPE/manifest.json (REGENERATED) — 19 source objectives / 19 playtest runs, latest verdict PASS
  - docs/evidence/milestones/SMALL_SIDED_SHAPE/manifest-superseded-2026-09-04T17-21-41.000Z.json (NEW) — prior bundle preserved byte-identically
  - docs/evidence/milestones/SMALL_SIDED_SHAPE/SMALL-SIDED-ORGANIC-DUEL-CLOSURE-audit.json (NEW) — benign derived-copy refreshed by the bundle build (byte-identical to its source)
  - docs/evidence/SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE/audit.json (NEW) — gauntlet:audit output, status PASS
  - docs/evidence/SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE/RESULT.md (NEW) — this result
  - tests/unit/eval/SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE-binding.test.ts (NEW) — 9 binding tests locking the corrected record structure
- commands_run:
  - cmd: "pnpm exec tsx eval/runners/_temp-verify.ts" (temp, deleted) — 2×2 verification
    exit_code: 0
    result: "confirmed browserParityObservations is the cause of the cpuTackle event-count delta, not the ball fix (bp=true → 463/506; bp=false → 1062/262 at post-fix HEAD)"
  - cmd: "pnpm exec tsx eval/runners/_temp-build-input.ts" (temp, deleted)
    exit_code: 0
    result: "wrote /tmp/playtest-input.json (6 coherent_match_sources, cpuTackle sources re-scanned with browserParityObservations=false)"
  - cmd: "pnpm run gauntlet:milestone:evaluate -- --milestone SMALL_SIDED_SHAPE --input /tmp/playtest-input.json"
    exit_code: 0
    result: "docs/evidence/milestones/SMALL_SIDED_SHAPE/playtests/2026-09-04T18-16-07-471Z.json (milestone_verdict PASS)"
  - cmd: "pnpm run gauntlet:milestone:bundle -- --milestone SMALL_SIDED_SHAPE --objectives <19 objectives>"
    exit_code: 0
    result: "19 source objectives, 19 playtest runs, latest verdict PASS; prior bundle preserved as manifest-superseded-2026-09-04T17-21-41.000Z.json"
  - cmd: "pnpm run typecheck"
    exit_code: 0
    result: "tsc core+node+browser clean"
  - cmd: "pnpm run build"
    exit_code: 0
    result: "vite build clean (pre-existing chunk-size warning)"
  - cmd: "pnpm run gauntlet:audit -- --objective SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE --class BOOKKEEPING --tests-pass true --integration-test-pass true"
    exit_code: 0
    result: "PASS (20/20 checks)"
  - cmd: "pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE-binding.test.ts"
    exit_code: 0
    result: "9/9 PASS"
  - cmd: "pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-5-binding.test.ts tests/unit/eval/small-sided-situation-evaluator.test.ts tests/unit/eval/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE-binding.test.ts tests/unit/eval/SMALL-SIDED-EXIT-PREREQ-IDENTITY-binding.test.ts"
    exit_code: 0
    result: "74/74 PASS"
  - cmd: "pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-PROFILE-REDUCER-EXTENSION-verification.test.ts tests/unit/eval/SMALL-SIDED-MATCH-SITUATION-SCANNER-{1,2,3,4}-*.test.ts"
    exit_code: 0
    result: "55/55 PASS"
  - cmd: "pnpm vitest run --project node tests/integration/5v5-kickoff-anti-huddle.test.ts tests/integration/ball-settled-regime-match.test.ts tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-1-RERUN-binding.test.ts tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-3-binding.test.ts tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-4-binding.test.ts"
    exit_code: 0
    result: "111/111 PASS"
- tests_run:
  - name: "SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE binding (9 tests)"
    result: "PASS — record structure, new anti-huddle sources, honest presence maps (incl. corrected cpuTackle sources), no false ball-fix narrative, browser NOT scanner-acceptable, PASS preservation, bundle coherence, no src/ change, claims_not_made"
  - name: "BATCH-5 / situation-evaluator / CONTINUOUS-DUEL / EXIT-PREREQ (74 tests)"
    result: "PASS"
  - name: "profile-reducer / scanner (55 tests)"
    result: "PASS"
  - name: "anti-huddle / ball-settled / BATCH-1-RERUN / BATCH-3 / BATCH-4 (111 tests)"
    result: "PASS"
- integration_test_result: "PASS — 249 tests across 12 suites (9 + 74 + 55 + 111) all green; typecheck 0; build 0"
- slot_wiring_result: NOT_APPLICABLE
- required_evidence:
  - BOOKKEEPING: no trajectory/screenshot required
  - audit.json: PASS (20/20)
- spec_sections:
  - GAMEPLAY_EVALUATION_SPEC (SMALL_SIDED_SHAPE profile) — situation presence maps and milestone verdict
  - gauntlet/state/HORIZON.md (objective definition)
  - gauntlet/roles/builder-structured.md (role contract)
  - gauntlet/evidence-contract.md (BOOKKEEPING evidence class)
- acceptance_criteria_met:
  - Scanner re-run over the new anti-huddle 1800-tick flowing run: 8 present / 0 not_observed / 0 insufficient_context ✓
  - Scanner re-run over the post-fix 600-tick kickoff run: 5 present / 1 not_observed / 2 insufficient_context ✓
  - Browser 620-tick run disclosed as NOT scanner-acceptable (compact event-log format lacks full SimulationEvent + TelemetryObservation stream) ✓
  - Existing deepened matches re-scanned honestly at the post-fix HEAD under their historical observation shape; the cpuTackle sources are unchanged by the ball fix (5v5 1062 events/7 present, 3v3 262 events/6 present) ✓
  - coherent_match_sources block updated honestly with 6 sources (no forced presence) ✓
  - Milestone PASS preserved: BATCH-5 8/8 driven fixtures remain the decisive source; reducer overallVerdict PASS from real evaluators (no overrides); MUTANT_TEAM_PASS + TEAM_SHAPE_SUITE_PASS exit prereqs pass ✓
  - Bundle superseded to 19 runs / 19 sources; prior bundle preserved as manifest-superseded-2026-09-04T17-21-41.000Z.json byte-identically ✓
  - Binding test 9/9; neighbor/evaluator tests 249/249; typecheck 0; build 0 ✓
  - No src/ / eval/scenarios/ / specs/ / eval/runners/ change — `git diff --stat` EMPTY ✓
- known_gaps:
  - **Critic RETRY (verified 2×2 isolation) resolved.** The first build attributed the re-scanned cpuTackle event-count deltas (5v5 1062→463, 3v3 262→506) and the 3v3 presence changes to the BALL-SETTLED-REGIME-FIX. The critic proved the cause is the `browserParityObservations` observation-shape switch: bp=true yields 463/506 at BOTH the pre-fix commit and the post-fix HEAD; bp=false yields 1062/262 at BOTH; the scans never enter the settled ball regime, so the ball fix does not engage. Corrected by re-scanning the two cpuTackle sources with `browserParityObservations=false` (option (a)), which reproduces the prior accepted sources' 1062/262 byte-identically at the post-fix HEAD — honestly "unchanged by the ball fix." The false causal claims were removed from the record notes and this RESULT.md.
  - The browser 620-tick DYNAMIC_VISUAL capture is not scanner-acceptable in its durable form (compact event-log / per-tick tuple format). Its headless engine equivalent (5v5-fixture-v1) is scanned as the post-fix kickoff source.
  - PHYSICAL_DUEL is present ONLY in the anti-huddle flowing run (3 input-rejection indicative events + 181 player-player-contacts). This is genuine and measured, not forced. The two cpuTackle sources revert to PHYSICAL_DUEL insufficient_context under the historical observation shape.
  - The pre-existing SMALL-SIDED-COHERENT-EVIDENCE-RERUN-binding node-gate failure (asserts 18 source objectives / 17 playtest runs; live bundle is 19/19) is untouched and remains owned by NODE-GATE-REGRESSION-TRIAGE.
  - `pnpm test` (full node project) does not complete within the 280s shared budget on this session; the targeted eval/integration/binding suites (249 tests) all pass.
- claims_not_made:
  - No NEW milestone PASS beyond the pre-existing honest one (BATCH-5 8/8 remains the decisive source)
  - No PROMOTION claim
  - No PES fidelity claim
  - No FOUNDATION_LAB_PASS claim
  - No invented rubric or perceptual threshold
  - No forced presence (presence maps recorded exactly as measured; PHYSICAL_DUEL present only where input-rejection actually fired)
  - No false causal attribution to the ball fix (the cpuTackle deltas are the browser-parity observation-shape, or do not exist under the historical configuration)
  - No gameplay change (git diff src/ eval/scenarios/ specs/ eval/runners/ EMPTY)

## Scanner re-run summary (current HEAD, post-BALL-SETTLED-REGIME-FIX)

| Match | Ticks | Present | Not Observed | Insufficient | Total Events | Observation shape | Notes |
|-------|-------|---------|--------------|--------------|--------------|-------------------|-------|
| 5v5-continuous-play.v1.json (cpuDefensiveTackle=false) | 600 | 7 | 0 | 1 | 437 | bp=false | Reproduces v22-1/v22-5 byte-identically |
| 3v3-press-scenario.v1.json (cpuDefensiveTackle=false) | 600 | 7 | 0 | 1 | 320 | bp=false | Reproduces v22-1/v22-5 byte-identically |
| 5v5-continuous-play-v1 (cpuDefensiveTackle=true) | 600 | 7 | 0 | 1 | 1062 | bp=false | Historical runCpuTackleMatch shape; unchanged by the ball fix |
| 3v3-press-scenario-v1 (cpuDefensiveTackle=true) | 600 | 6 | 0 | 2 | 262 | bp=false | Historical runCpuTackleMatch shape; unchanged by the ball fix |
| 5v5-continuous-play-v1 (anti-huddle flowing, 30 s) | 1800 | 8 | 0 | 0 | 400 | bp=true | The accepted anti-huddle flowing run: 11 pass-family events, 120.012 m travel |
| 5v5-fixture-v1 (post-fix kickoff) | 600 | 5 | 1 | 2 | 259 | bp=true | The accepted ball-fix kickoff run: first touch tick 18, 20.772 m travel |

**Honest presence disclosures:**
- **cpuTackle sources** were re-scanned under the historical `runCpuTackleMatch` observation shape (`browserParityObservations=false`). They reproduce the prior accepted sources' numbers byte-identically at the post-fix HEAD: 5v5 = 1062 events / 7 present / PHYSICAL_DUEL insufficient_context; 3v3 = 262 events / 6 present / 0 not_observed / 2 insufficient_context (PHYSICAL_DUEL insufficient_context, SHOT_TO_RESULT insufficient_context). The ball fix does not alter them — these scans never enter the settled ball regime. A re-scan with `browserParityObservations=true` yields a different count (463/506) purely because of the observation-shape switch, not the ball fix.
- **PHYSICAL_DUEL** — `present` only in the anti-huddle flowing run, where 3 `input-rejection` indicative events actually fired alongside 181 player-player-contacts (genuine, measured). It remains `insufficient_context` everywhere else.
- **SHOT_TO_RESULT** — `not_observed` in the post-fix kickoff run (no shot/goal in 600 ticks); `insufficient_context` in the 3v3 cpuTackle source (shot + goal observed, no pitch-contact); `present` in the anti-huddle flowing run and both non-cpuTackle sources.

## coherent_match_sources diff summary

The prior block had 4 sources (2 original deepened matches + 2 cpuDefensiveTackle matches). The new block has 6 sources:
1. `5v5-continuous-play.v1.json` — unchanged (7/0/1, PHYSICAL_DUEL insufficient_context).
2. `3v3-press-scenario.v1.json` — unchanged (7/0/1, PHYSICAL_DUEL insufficient_context).
3. `5v5-continuous-play-v1` (cpuDefensiveTackle=true, bp=false) — unchanged (7/0/1, 1062 events, PHYSICAL_DUEL insufficient_context). Re-verified unchanged under the historical configuration; NOT a ball-fix effect.
4. `3v3-press-scenario-v1` (cpuDefensiveTackle=true, bp=false) — unchanged (6/0/2, 262 events, PHYSICAL_DUEL insufficient_context, SHOT_TO_RESULT insufficient_context). Re-verified unchanged under the historical configuration; NOT a ball-fix effect.
5. `5v5-continuous-play-v1` (anti-huddle flowing, 1800 ticks) — NEW; 8/0/0; all situations present; PHYSICAL_DUEL present (3 input-rejection).
6. `5v5-fixture-v1` (post-fix kickoff, 600 ticks) — NEW; 5/1/2; SHOT_TO_RESULT not_observed; PHYSICAL_DUEL insufficient_context.

A separate `browser_anti_huddle_capture` block discloses the BROWSER-5V5-ANTI-HUDDLE-DYNAMIC-EVIDENCE 620-tick capture as `scanner_acceptable: false` with the reason.

## Milestone verdict

- `evaluateMilestonePlaytest`: milestone_verdict **PASS**, decision `milestone_verdict_ready` (8/8 situation outcomes PASS, entry/exit prereqs pass, critic ACCEPT).
- `evaluateSmallSidedProfile` (reducer): overallVerdict **PASS**, MUTANT_TEAM_PASS PASS, TEAM_SHAPE_SUITE_PASS PASS.
- The milestone PASS is preserved by the BATCH-5 8/8 driven fixtures (decisive source). Coherent matches are supplementary; no situation outcome is derived from coherent-match evidence alone.

## Bundle supersession

- Prior bundle (19 sources / 18 runs) preserved byte-identically as `manifest-superseded-2026-09-04T17-21-41.000Z.json`.
- New bundle: 19 source objectives / 19 playtest runs; `latest_playtest_result` = `2026-09-04T18-16-07-471Z.json` (PASS).
