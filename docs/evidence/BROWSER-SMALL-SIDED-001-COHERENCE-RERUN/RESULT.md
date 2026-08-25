# Builder Report: BROWSER-SMALL-SIDED-001-COHERENCE-RERUN

## Builder report

- **objective_id**: `BROWSER-SMALL-SIDED-001-COHERENCE-RERUN`
- **builder_agent**: `builder-gameplay`
- **builder_model**: `mimo-v2.5`
- **evidence_class**: `DYNAMIC_VISUAL`
- **hypothesis**: Re-attesting the BROWSER-SMALL-SIDED-001 browser case on the RESOLVED driven fixture scenarios (extended, shot-resolution, duel-rejection) proves the BROWSER execution path is coherent with the fixture/engine changes underlying the 8/8 SMALL_SIDED_SHAPE situation PASS. Two independent bridge runs produce identical per-tick hashes (determinism) and bridge runs match equivalent headless runs (browser/headless correspondence) for all three driven fixtures.

## Files changed

| File | Action | Description |
|------|--------|-------------|
| `tests/browser/small-sided-coherence-rerun.browser.test.ts` | **NEW** | Browser test exercising BROWSER-SMALL-SIDED-001-COHERENCE-RERUN case across 3 driven fixtures |
| `scripts/capture-coherence-rerun-evidence.ts` | **NEW** | Node-side evidence producer for trajectory + browser-cases |
| `tests/unit/eval/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN-binding.test.ts` | **NEW** | Binding test verifying evidence artifacts and original evidence preservation |
| `docs/evidence/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN/trajectory.json` | **NEW** | Per-tick hashes for 3 scenarios (60 ticks each) |
| `docs/evidence/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN/browser-cases.json` | **NEW** | Browser case result with scenario evidence |
| `docs/screenshots/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN/sequence.json` | **NEW** | Semantic frame sequence metadata (4 frames) |
| `docs/screenshots/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN/frame-before.png` | **NEW** | Semantic frame at tick 0 (initial driven-fixture state) |
| `docs/screenshots/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN/frame-first-input.png` | **NEW** | Semantic frame at tick 15 (after early inputProgram entries) |
| `docs/screenshots/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN/frame-mid-play.png` | **NEW** | Semantic frame at tick 40 (after movement inputs) |
| `docs/screenshots/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN/frame-final.png` | **NEW** | Semantic frame at tick 60 (end of driven fixture) |
| `docs/evidence/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN/RESULT.md` | **NEW** | Builder report |

## Commands run

| # | Command | Exit Code |
|---|---------|-----------|
| 1 | `CI=1 npx tsx scripts/capture-coherence-rerun-evidence.ts` | 0 |
| 2 | `CI=1 pnpm vitest run --project browser tests/browser/small-sided-coherence-rerun.browser.test.ts` | 0 |
| 3 | `CI=1 pnpm vitest run --project node tests/unit/eval/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN-binding.test.ts` | 0 |

## Tests run

| Test | Result |
|------|--------|
| scenario structure > extended: has 6 AI_FALLBACK control slots | PASS |
| scenario structure > extended: has 2 teams with 3 players each | PASS |
| scenario structure > extended: bridge loads scenario with 6 players | PASS |
| scenario structure > extended: durationTicks is positive and seed is set | PASS |
| scenario structure > shot-resolution: has 6 AI_FALLBACK control slots | PASS |
| scenario structure > shot-resolution: has 2 teams with 3 players each | PASS |
| scenario structure > shot-resolution: bridge loads scenario with 6 players | PASS |
| scenario structure > shot-resolution: durationTicks is positive and seed is set | PASS |
| scenario structure > duel-rejection: has 6 AI_FALLBACK control slots | PASS |
| scenario structure > duel-rejection: has 2 teams with 3 players each | PASS |
| scenario structure > duel-rejection: bridge loads scenario with 6 players | PASS |
| scenario structure > duel-rejection: durationTicks is positive and seed is set | PASS |
| [extended]: hash correspondence > bridge initial hash matches headless initial hash | PASS |
| [extended]: hash correspondence > two independent bridge runs produce identical per-tick hashes | PASS |
| [extended]: hash correspondence > bridge per-tick hashes match headless per-tick hashes (full driven run) | PASS |
| [extended]: hash correspondence > headless determinism: two independent headless runs produce identical hashes | PASS |
| [shot-resolution]: hash correspondence > bridge initial hash matches headless initial hash | PASS |
| [shot-resolution]: hash correspondence > two independent bridge runs produce identical per-tick hashes | PASS |
| [shot-resolution]: hash correspondence > bridge per-tick hashes match headless per-tick hashes (full driven run) | PASS |
| [shot-resolution]: hash correspondence > headless determinism: two independent headless runs produce identical hashes | PASS |
| [duel-rejection]: hash correspondence > bridge initial hash matches headless initial hash | PASS |
| [duel-rejection]: hash correspondence > two independent bridge runs produce identical per-tick hashes | PASS |
| [duel-rejection]: hash correspondence > bridge per-tick hashes match headless per-tick hashes (full driven run) | PASS |
| [duel-rejection]: hash correspondence > headless determinism: two independent headless runs produce identical hashes | PASS |
| semantic frame capture > captures 4 semantic frames: before → first-input → mid-play → final | PASS |
| semantic frame capture > semantic frames are non-blank (luminance and color variance) | PASS |
| semantic frame capture > all four captured frames are distinct (different state content) | PASS |

**27/27 browser tests passed.**

## Binding test results

| Test | Result |
|------|--------|
| evidence directory exists | PASS |
| screenshot directory exists | PASS |
| RESULT.md exists and contains objective_id | PASS |
| trajectory.json exists and is valid JSON | PASS |
| trajectory.json records per-tick hashes for all 3 scenarios | PASS |
| trajectory.json per-tick hashes are non-empty strings | PASS |
| trajectory.json initial hashes match first per-tick hash for each scenario | PASS |
| browser-cases.json exists and is valid JSON with correct case_id | PASS |
| browser-cases.json records scenario evidence with per-tick hashes | PASS |
| sequence.json exists with schema_version 1 and correct objective_id | PASS |
| sequence.json has 3-5 labeled frames with valid structure | PASS |
| screenshot PNGs exist, are non-empty, and have distinct bytes | PASS |
| RESULT.md contains required builder report fields | PASS |
| RESULT.md does NOT claim PES fidelity or FOUNDATION_LAB_PASS | PASS |
| existing BROWSER-SMALL-SIDED-001-CASE evidence was NOT overwritten | PASS |
| original BROWSER-SMALL-SIDED-001-CASE trajectory has 360 ticks (unchanged) | PASS |

**16/16 binding tests passed.**

## Evidence table

| Artifact | Path | Status |
|----------|------|--------|
| Trajectory (3 scenarios, 60 ticks each) | `docs/evidence/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN/trajectory.json` | Written |
| Browser cases | `docs/evidence/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN/browser-cases.json` | Written |
| Sequence metadata | `docs/screenshots/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN/sequence.json` | Written |
| Semantic frame: before (tick 0) | `docs/screenshots/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN/frame-before.png` | Captured |
| Semantic frame: first-input (tick 15) | `docs/screenshots/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN/frame-first-input.png` | Captured |
| Semantic frame: mid-play (tick 40) | `docs/screenshots/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN/frame-mid-play.png` | Captured |
| Semantic frame: final (tick 60) | `docs/screenshots/BROWSER-SMALL-SIDED-001-COHERENCE-RERUN/frame-final.png` | Captured |
| Original BROWSER-SMALL-SIDED-001-CASE evidence | `docs/evidence/BROWSER-SMALL-SIDED-001-CASE/` | Preserved (verified) |

## Scenario hash correspondence summary

| Scenario | Initial Hash | Duration | Ticks Verified |
|----------|-------------|----------|----------------|
| 3v3-situation-driven-extended-v1 | `fnv1a64-v1:f031c3d9aef495b1` | 60 | 60/60 |
| 3v3-situation-driven-shot-resolution-v1 | `fnv1a64-v1:1d4ec8a95a01915e` | 60 | 60/60 |
| 3v3-situation-driven-duel-rejection-v1 | `fnv1a64-v1:dc90891044a7c59b` | 60 | 60/60 |

All three scenarios show:
- Bridge initial hash matches headless initial hash
- Two independent bridge runs produce identical per-tick hashes (determinism)
- Bridge per-tick hashes match headless per-tick hashes (browser/headless correspondence)
- Two independent headless runs produce identical hashes (headless determinism)

## Acceptance criteria met

- **Browser/headless hash correspondence on resolved driven fixtures**: ✅ All 3 scenarios (extended, shot-resolution, duel-rejection) show exact per-tick hash correspondence between browser bridge and headless simulation.
- **Determinism**: ✅ Two independent bridge runs and two independent headless runs produce identical per-tick hashes for each scenario.
- **DYNAMIC_VISUAL evidence**: ✅ 4 semantic frames captured showing before → first-input → mid-play → final progression across the driven fixture run. Frames are non-blank (luminance variance > 50, ≥ 20 distinct colors) and distinct (4 unique state hashes).
- **Original evidence preserved**: ✅ BROWSER-SMALL-SIDED-001-CASE trajectory (360 ticks), screenshots, and RESULT.md remain intact and unchanged.
- **Same driven policy for browser and headless**: ✅ Both paths use inputProgram entries from the scenario JSON, applied via sim.applyInputs / bridge.injectInputs before each sim.step, matching the evaluate.ts pattern.

## Known gaps

- **No `audit.json` yet**: The orchestrator's audit run (`pnpm run gauntlet:audit`) must be executed separately after this builder report. The audit.json is not hand-written per the evidence contract.
- **No `manifest.json`**: Durable acceptance manifest will be produced by `gauntlet:acceptance:persist` during the orchestrator's acceptance flow.
- **No critic or integration review**: These are separate roles that follow this builder report.
- **Frame byte sizes may be small**: Frames are valid non-blank PNGs (luminance variance > 50, ≥ 20 distinct colors verified), but are canvas captures. This is expected for the WebGL readPixels + canvas capture pipeline.
- **No scheduledEvents exercised**: All three driven fixtures have empty scheduledEvents. The inputProgram-driven policy is the sole deterministic driver. This is sufficient for hash correspondence but means no scheduled-event timing was validated.

## Claims not made

- **No milestone PASS claim**: This objective re-attests browser/headless coherence on resolved fixtures. The SMALL_SIDED_SHAPE milestone re-eval is a separate later objective.
- **No FOUNDATION_LAB_PASS claim**: No foundation lab evaluator exists or has been run.
- **No PES fidelity claim**: No reference bar comparison has been performed.
- **No SMALL_SIDED_SHAPE situation PASS claim via this objective**: The 8/8 situation PASS is an existing result from the situation evaluator; this objective proves the BROWSER path is coherent with the fixtures that produced that PASS.
- **No TEAM_TACTICS / TRANSITION_PHASES claim**: The acceptance criteria explicitly state that passing this coherence case does not by itself prove these behaviors.
- **No qualitative football behavior claim**: Hash correspondence is structural determinism evidence, not gameplay quality assessment.
- **No readability PASS claim**: This is browser/headless coherence evidence, not a readability scoring objective.
