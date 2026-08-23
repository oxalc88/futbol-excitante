# Builder Report: BROWSER-SMALL-SIDED-001-CASE

## Builder report

- **objective_id**: `BROWSER-SMALL-SIDED-001-CASE`
- **builder_agent**: `builder-structured`
- **builder_model**: `qwen3.6`
- **evidence_class**: `DYNAMIC_VISUAL`
- **hypothesis**: A deterministic browser small-sided (3v3) match renders multiple players per team and preserves browser/headless state correspondence while exposing team behavior for milestone playtest review.

## Files changed

| File | Action | Description |
|------|--------|-------------|
| `tests/browser/small-sided-001.browser.test.ts` | **NEW** | Browser test exercising BROWSER-SMALL-SIDED-001 case |
| `scripts/capture-small-sided-evidence.ts` | **NEW** | Node-side evidence producer for trajectory + browser-cases |
| `docs/screenshots/BROWSER-SMALL-SIDED-001-CASE/frame-before.png` | **NEW** | Semantic frame at tick 0 (initial state) |
| `docs/screenshots/BROWSER-SMALL-SIDED-001-CASE/frame-kickoff.png` | **NEW** | Semantic frame at tick 60 (early play) |
| `docs/screenshots/BROWSER-SMALL-SIDED-001-CASE/frame-play.png` | **NEW** | Semantic frame at tick 180 (mid-game) |
| `docs/screenshots/BROWSER-SMALL-SIDED-001-CASE/frame-later.png` | **NEW** | Semantic frame at tick 360 (extended play) |
| `docs/screenshots/BROWSER-SMALL-SIDED-001-CASE/sequence.json` | **NEW** | Semantic frame sequence metadata |
| `docs/evidence/BROWSER-SMALL-SIDED-001-CASE/trajectory.json` | **NEW** | Per-tick hashes (360 ticks) |
| `docs/evidence/BROWSER-SMALL-SIDED-001-CASE/browser-cases.json` | **NEW** | Browser case result for BROWSER-SMALL-SIDED-001 |
| `docs/evidence/BROWSER-SMALL-SIDED-001-CASE/sequence.json` | **NEW** | Semantic frame sequence metadata (evidence copy) |

## Commands run

| # | Command | Exit Code |
|---|---------|-----------|
| 1 | `npx vitest run tests/browser/small-sided-001.browser.test.ts --project browser` | 0 |
| 2 | `npx tsx scripts/capture-small-sided-evidence.ts` | 0 |

## Tests run

| Test | Result |
|------|--------|
| `BROWSER-SMALL-SIDED-001: small-sided scenario structure > FOUNDATION_SCENARIO_3V3 has 6 AI_FALLBACK control slots` | PASS |
| `BROWSER-SMALL-SIDED-001: small-sided scenario structure > small-sided scenario has 2 teams with 3 players each` | PASS |
| `BROWSER-SMALL-SIDED-001: small-sided scenario structure > bridge loads the 3v3 scenario with 6 players` | PASS |
| `BROWSER-SMALL-SIDED-001: hash correspondence > bridge initial hash matches headless initial hash` | PASS |
| `BROWSER-SMALL-SIDED-001: hash correspondence > two independent bridge runs produce identical per-tick hashes` | PASS |
| `BROWSER-SMALL-SIDED-001: hash correspondence > bridge CPU hashes match headless CPU hashes for 60 ticks` | PASS |
| `BROWSER-SMALL-SIDED-001: hash correspondence > bridge per-tick hashes match headless per-tick hashes (zero-input, 10 ticks)` | PASS |
| `BROWSER-SMALL-SIDED-001: semantic frame capture > captures 4 semantic frames: before → kickoff → play → later` | PASS |
| `BROWSER-SMALL-SIDED-001: semantic frame capture > semantic frames are non-blank (luminance and color variance)` | PASS |
| `BROWSER-SMALL-SIDED-001: semantic frame capture > all four captured frames are distinct (different state content)` | PASS |

**10/10 tests passed.**

## Evidence table

| Artifact | Path | Status |
|----------|------|--------|
| Semantic frame: before (tick 0) | `docs/screenshots/BROWSER-SMALL-SIDED-001-CASE/frame-before.png` (6786 bytes) | Captured |
| Semantic frame: kickoff (tick 60) | `docs/screenshots/BROWSER-SMALL-SIDED-001-CASE/frame-kickoff.png` (6656 bytes) | Captured |
| Semantic frame: play (tick 180) | `docs/screenshots/BROWSER-SMALL-SIDED-001-CASE/frame-play.png` (6621 bytes) | Captured |
| Semantic frame: later (tick 360) | `docs/screenshots/BROWSER-SMALL-SIDED-001-CASE/frame-later.png` (6697 bytes) | Captured |
| Sequence metadata | `docs/screenshots/BROWSER-SMALL-SIDED-001-CASE/sequence.json` | Written |
| Trajectory (360 ticks) | `docs/evidence/BROWSER-SMALL-SIDED-001-CASE/trajectory.json` | Written |
| Browser case result | `docs/evidence/BROWSER-SMALL-SIDED-001-CASE/browser-cases.json` | Written |
| Determinism verification | Two independent CPU-driven runs produce identical hashes | Verified |

## Acceptance criteria met

- **Real browser run exercises the small-sided scenario deterministically**: ✅ 10 browser tests pass, 4 semantic frames captured via Playwright `page.screenshot()`, per-tick hashes match across independent runs and between browser bridge and headless simulation.
- **Multiple players per team rendered**: ✅ 6 players (3 per team) confirmed in presentation snapshot at every captured frame.
- **Browser/headless state correspondence preserved**: ✅ Initial hash matches headless; per-tick hashes match across two independent bridge runs; bridge CPU hashes match headless CPU hashes for 60 ticks; zero-input bridge hashes match zero-input headless hashes.
- **Team behavior exposed for milestone playtest review**: ✅ 360 ticks of CPU-driven match play captured with 4 semantic frames showing progression from formation → early play → active match → extended play.

## Known gaps

- **No `audit.json`**: The orchestrator's audit run (`pnpm run gauntlet:audit`) must be executed separately after this builder report. The audit.json is not hand-written per the evidence contract.
- **No `manifest.json`**: Durable acceptance manifest will be produced by `gauntlet:acceptance:persist` during the orchestrator's acceptance flow.
- **No critic or integration review**: These are separate roles that follow this builder report.
- **Frame byte sizes are small (3.5–6.8 KB)**: Frames are valid non-blank PNGs (luminance variance > 50, > 20 distinct colors verified), but are low-resolution canvas captures. This is expected for the WebGL readPixels + canvas capture pipeline.
- **No `node:fs` disk writes from browser tests**: The browser test stores evidence on `window` for extraction; actual file writes are handled by the separate Node-side evidence producer script (`scripts/capture-small-sided-evidence.ts`). This is by design — browser tests should not depend on Node I/O.

## Claims not made

- **No milestone PASS claim**: BROWSER-SMALL-SIDED-001-CASE is a case-materialization objective only. The milestone re-eval is a separate later objective.
- **No FOUNDATION_LAB_PASS claim**: No foundation lab evaluator exists or has been run.
- **No PES fidelity claim**: No reference bar comparison has been performed.
- **No TEAM_TACTICS / TRANSITION_PHASES claim**: The acceptance criteria explicitly state that passing this execution case does not by itself prove these behaviors.
- **No qualitative football behavior claim**: Team play quality is a playtest responsibility, not a deterministic test responsibility.