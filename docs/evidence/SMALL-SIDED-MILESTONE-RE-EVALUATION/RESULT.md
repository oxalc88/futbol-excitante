# SMALL-SIDED-MILESTONE-RE-EVALUATION — Builder Report

## Objective

| Field | Value |
|---|---|
| **id** | `SMALL-SIDED-MILESTONE-RE-EVALUATION` |
| **builder_agent** | builder-structured |
| **builder_model** | qwen3.6 |
| **evidence_class** | HEADLESS |
| **hypothesis** | The `evaluate-milestone-playtest` CLI evaluates the SMALL_SIDED_SHAPE milestone against all accumulated batch evidence (BATCH-1, BATCH-1-RERUN, BATCH-2-RERUN, BROWSER-SMALL-SIDED-001-CASE) and produces a milestone verdict. This objective feeds the aggregated per-situation verdicts into the evaluator and reports its honest output. |

## Commands run

| # | Command | Exit Code |
|---|---------|-----------|
| 1 | `pnpm run gauntlet:milestone:evaluate -- --milestone SMALL_SIDED_SHAPE --input docs/evidence/SMALL-SIDED-MILESTONE-RE-EVALUATION/playtest-input/input.json` | 1 (non-zero because milestone_verdict is FAIL) |

## Milestone evaluation input

- **entry_prerequisites_pass**: `true`
  - PLAYABLE_1V1_PASS was accepted (PLAYABLE_1V1-RE-EVALUATION eval.json persisted)
  - TEAM_DECISION_PROFILE was accepted (TEAM_DECISION_PROFILE eval.json persisted)
- **exit_prerequisites_pass**: `true`
  - MUTANT_1V1_PASS was accepted
  - ARCHETYPE_BLINDED_COMPARISON was accepted
- **critic_verdict**: `ACCEPT` (all batch critics accepted)
- **situation_outcomes** (best verdict per required situation across all batches):

| Required Situation | Batch-1 | Batch-1-RERUN | Batch-2-RERUN | Best Verdict |
|---|---|---|---|---|
| PASS_RECEPTION | NOT_EVALUATED (0 events) | NOT_EVALUATED (0 events) | NOT_EVALUATED (0 events) | NOT_EVALUATED |
| SHOT_TO_RESULT | NOT_EVALUATED (0 events) | NOT_EVALUATED (0 events) | FAIL (shot present, required/indicative absent) | FAIL |
| PHYSICAL_DUEL | NOT_EVALUATED (0 events) | NOT_EVALUATED (0 events) | NOT_EVALUATED (0 events) | NOT_EVALUATED |
| SUPPORT_AND_PASSING_LANES | NOT_EVALUATED (0 events) | NOT_EVALUATED (0 events) | NOT_EVALUATED (0 events) | NOT_EVALUATED |
| SETTLED_ATTACK_VS_DEFENCE | NOT_EVALUATED (0 events) | NOT_EVALUATED (0 events) | NOT_EVALUATED (shot only, required absent) | NOT_EVALUATED |
| ATTACK_TO_DEFENCE_TRANSITION | NOT_EVALUATED (0 events) | NOT_EVALUATED (0 events) | FAIL (shot present, required/indicative absent) | FAIL |
| DEFENCE_TO_ATTACK_TRANSITION | NOT_EVALUATED (0 events) | NOT_EVALUATED (0 events) | FAIL (shot present, required/indicative absent) | FAIL |
| COORDINATED_PRESS | NOT_EVALUATED (0 events) | NOT_EVALUATED (0 events) | FAIL (shot present, required absent) | FAIL |

- **evidence**:
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1/situations/` — 8 per-situation artifacts, 600 ticks, 3v3-situation-fixture.v1.json
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1-RERUN/situations/` — byte-identical re-run of BATCH-1
  - `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/` — 8 per-situation artifacts, 60 ticks, 3v3-transition-driven.v1.json, hasInvariantFailures: true
  - `docs/evidence/BROWSER-SMALL-SIDED-001-CASE/` — 4 semantic frames, 360 ticks trajectory, hash correspondence verified

## Evaluator output

- **Output file**: `docs/evidence/milestones/SMALL_SIDED_SHAPE/playtests/2026-08-23T09-30-35-228Z.json`
- **decision**: `milestone_failed`
- **milestone_verdict**: `FAIL`
- **failure_class**: `milestone_playtest_failed`
- **exit code**: 1 (the CLI exits with code 1 when milestone_verdict is not PASS)

## Verdict summary

The evaluator computed **FAIL** for the SMALL_SIDED_SHAPE milestone.

Four of the eight required situations have FAIL verdicts from BATCH-2-RERUN evidence:

| Situation | Verdict | Reason |
|---|---|---|
| PASS_RECEPTION | NOT_EVALUATED | 0 relevant events in both batches |
| SHOT_TO_RESULT | **FAIL** | Shot present (tick 2), but required 'goal'/'shot-off-target' absent |
| PHYSICAL_DUEL | NOT_EVALUATED | 0 relevant events in both batches |
| SUPPORT_AND_PASSING_LANES | NOT_EVALUATED | 0 relevant events in both batches |
| SETTLED_ATTACK_VS_DEFENCE | NOT_EVALUATED | Shot indicative only, required kinds absent |
| ATTACK_TO_DEFENCE_TRANSITION | **FAIL** | Shot present, required/indicative absent |
| DEFENCE_TO_ATTACK_TRANSITION | **FAIL** | Shot present, required/indicative absent |
| COORDINATED_PRESS | **FAIL** | Shot present, required 'player-ball-contact' absent |

The evaluator's `evaluateMilestonePlaytest` function checks: (1) prerequisites present, (2) all required situations mapped, (3) if any situation is "FAIL" → returns FAIL. Since 4 situations are FAIL, the milestone verdict is FAIL. The 4 NOT_EVALUATED situations do not independently cause FAIL — they would cause NOT_EVALUATED if no situation were FAIL, but the evaluator's logic prioritizes FAIL over NOT_EVALUATED.

## Root cause analysis

The FAIL verdicts stem from the BATCH-2-RERUN fixture (`3v3-transition-driven.v1.json`) producing only a single shot event at tick 2 with zero other events. This means:

- Transition situations (ATTACK_TO_DEFENCE_TRANSITION, DEFENCE_TO_ATTACK_TRANSITION, COORDINATED_PRESS) require shot + other event kinds (player-player-contact, ball-out-of-play, player-ball-contact) — none present except shot.
- SHOT_TO_RESULT requires shot + goal/shot-off-target — only shot present.
- The BATCH-1 fixture (`3v3-situation-fixture.v1.json`) has zero events entirely (inputProgram: {}), yielding NOT_EVALUATED for all situations.

The small-sided shape milestone cannot pass because the current fixtures do not exercise sufficient event diversity to satisfy the required event kinds for any situation beyond NOT_EVALUATED or FAIL.

## Acceptance criteria met

- [x] Read SMALL_SIDED_SHAPE plan (`gauntlet/playtests/SMALL_SIDED_SHAPE.json`) — confirmed 8 required situations
- [x] Constructed input JSON with correct entry_prerequisites_pass, exit_prerequisites_pass, situation_outcomes, critic_verdict, and evidence references
- [x] Wrote input to `docs/evidence/SMALL-SIDED-MILESTONE-RE-EVALUATION/playtest-input/input.json`
- [x] Ran the milestone evaluator (exit code 1, non-zero because verdict is FAIL)
- [x] Read the evaluator's output JSON at `docs/evidence/milestones/SMALL_SIDED_SHAPE/playtests/2026-08-23T09-30-35-228Z.json`
- [x] Reported the evaluator's verdict honestly (FAIL — as computed, not fabricated)
- [x] Wrote this RESULT.md with mandatory builder report format

## Input format correction

The first evaluator run (exit 0, verdict PASS) used `situation_outcomes` as objects with `{verdict, reason}` fields. This caused a silent bug: the evaluator's `outcomes.includes("FAIL")` check compares string "FAIL" against objects (e.g., `{verdict: "FAIL", reason: "..."}`), which always returns false. With all comparisons failing, the evaluator fell through to the final `return { milestone_verdict: "PASS" }` when critic_verdict was "ACCEPT". The correct format is plain string values (`"FAIL"`, `"NOT_EVALUATED"`) as used by all previous successful runs (e.g., `2026-08-23T05-37-07-685Z.json`, `2026-08-22T17-15-00-772Z.json`). This report's second run used the correct string format and produced the honest FAIL verdict.

## Claims not made

- The milestone verdict was NOT forced; it is exactly what the evaluator computed from the input evidence.
- No PES fidelity claim.
- No `FOUNDATION_LAB_PASS` claim.
- No regression PASS claims on protected tests.
- No invented reference envelopes or tolerance numbers.
- Did NOT modify src/, contracts, evaluators, situation-mapping, fixtures, gauntlet/state/**, specs, or any accumulated batch evidence dirs.
- Did NOT commit or push.
- Did NOT run the gauntlet audit.

## Evidence paths

| Evidence dir | Purpose |
|---|---|
| `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1/situations/` | BATCH-1 situation evaluation (600 ticks, all NOT_EVALUATED) |
| `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1-RERUN/situations/` | BATCH-1 byte-identical re-run verification |
| `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-2-RERUN/situations/` | BATCH-2 transition fixture evaluation (60 ticks, mix of FAIL/NOT_EVALUATED) |
| `docs/evidence/BROWSER-SMALL-SIDED-001-CASE/` | Browser case materialization (4 frames, 360 ticks, hash correspondence) |
| `docs/evidence/SMALL-SIDED-MILESTONE-RE-EVALUATION/playtest-input/input.json` | This objective's evaluator input (corrected string format) |
| `docs/evidence/milestones/SMALL_SIDED_SHAPE/playtests/2026-08-23T09-30-35-228Z.json` | Evaluator output — milestone_verdict: FAIL (corrected run) |