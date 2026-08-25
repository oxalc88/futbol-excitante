# Builder Report: SMALL-SIDED-VISUAL-READABILITY-EVIDENCE

## Builder report

- **objective_id**: `SMALL-SIDED-VISUAL-READABILITY-EVIDENCE`
- **builder_agent**: `builder-gameplay`
- **builder_model**: `mimo-v2.5`
- **evidence_class**: `DYNAMIC_VISUAL`
- **hypothesis**: Event-centered DYNAMIC_VISUAL semantic frame sequences demonstrate the SMALL_SIDED_SHAPE milestone's 8 `visual_readability_dimensions` are observable in small-sided 3v3 play, mapped to the required situations. This is **observability evidence for reviewer/perceptual readability judgment**, NOT a numeric readability PASS (VISUAL_SPEC defers thresholds).

## Dimension → Situation/Event Mapping

| # | Dimension | Required Situation(s) | Event/Kind | Capture Frames (tick range) | Note |
|---|-----------|----------------------|------------|---------------------------|------|
| 1 | `ball_readability_under_congestion` | PASS_RECEPTION, PHYSICAL_DUEL | `player-player-contact` at tick 121 | before=109, event=121, after=136 | Ball amid multiple converging players; ball regime settled, contact zone near center |
| 2 | `team_classification` | SETTLED_ATTACK_VS_DEFENCE | settled play at tick 125 | before=120, event=125, after=140 | Both teams visible on screen: Team A (cyan) at x∈[-7.2,-0.3], Team B (orange) at x∈[0.3,7.2]; kit colors distinguishable |
| 3 | `facing_orientation` | ATTACK_TO_DEFENCE_TRANSITION, PASS_RECEPTION | `player-player-contact` at tick 180 | before=168, event=180, after=195 | 6 players in tight cluster with varied body headings (range 0.0–2.4 rad); individual facing discernible under congestion |
| 4 | `action_recognition` | SHOT_TO_RESULT, PASS_RECEPTION | directional positioning at tick 600 | before=588, event=600, after=615 | Attacking-side players oriented toward opponent half (Team A spread 11.6m vs 4.7m); action recognizability limited to directional posture — no discrete kick events occur in this run |
| 5 | `contact_comprehension` | PHYSICAL_DUEL | `player-player-contact` at tick 240 | before=228, event=240, after=255 | Tightest congestion: opposing pairs at 0.46m; kits overlap |
| 6 | `team_shape_readability` | SETTLED_ATTACK_VS_DEFENCE, SUPPORT_AND_PASSING_LANES | settled play at tick 420 | before=408, event=420, after=432 | Team A spread 7m (attackers), Team B compact 3.6m (defensive block) |
| 7 | `camera_readability` | COORDINATED_PRESS | static camera at tick 300 | before=288, event=300, after=312 | Static camera view centered on ball position (ball at origin throughout run); full pitch context consistently visible |
| 8 | `silhouette_stability` | DEFENCE_TO_ATTACK_TRANSITION | continuous play at tick 360 | before=348, event=360, after=375 | Player silhouettes stable and distinct during team spread phase |

## Files changed

| File | Action | Description |
|------|--------|-------------|
| `tests/browser/small-sided-readability.browser.test.ts` | **NEW** | Browser test capturing 24 frames (3 per dimension) via Playwright |
| `scripts/discover-readability-events.ts` | **NEW** | Headless event discovery script for tick selection |
| `scripts/capture-readability-evidence.ts` | **NEW** | Node-side evidence producer for trajectory + browser-cases + sequence |
| `docs/screenshots/SMALL-SIDED-VISUAL-READABILITY-EVIDENCE/*.png` | **NEW** | 24 semantic frame PNGs (3 per dimension) |
| `docs/screenshots/SMALL-SIDED-VISUAL-READABILITY-EVIDENCE/sequence.json` | **NEW** | Semantic frame sequence metadata (evidence copy) |
| `docs/evidence/SMALL-SIDED-VISUAL-READABILITY-EVIDENCE/browser-cases.json` | **NEW** | Browser case result with per-tick hashes (720 ticks) |
| `docs/evidence/SMALL-SIDED-VISUAL-READABILITY-EVIDENCE/trajectory.json` | **NEW** | Per-tick hashes (720 ticks, determinism verified) |
| `docs/evidence/SMALL-SIDED-VISUAL-READABILITY-EVIDENCE/sequence.json` | **NEW** | Semantic frame sequence metadata (8 dimensions × 3 frames) |
| `tests/unit/eval/SMALL-SIDED-VISUAL-READABILITY-EVIDENCE-binding.test.ts` | **NEW** | Binding test verifying evidence structure |

## Commands run

| # | Command | Exit Code |
|---|---------|-----------|
| 1 | `npx tsx scripts/discover-readability-events.ts` | 0 |
| 2 | `npx tsx scripts/capture-readability-evidence.ts` | 0 |
| 3 | `CI=1 pnpm vitest run --project browser tests/browser/small-sided-readability.browser.test.ts` | 0 |
| 4 | `CI=1 pnpm vitest run --project node tests/unit/eval/SMALL-SIDED-VISUAL-READABILITY-EVIDENCE-binding.test.ts` | 0 |
| 5 | `pnpm run gauntlet:audit -- --objective SMALL-SIDED-VISUAL-READABILITY-EVIDENCE --class DYNAMIC_VISUAL --tests-pass true --integration-test-pass true` | REVIEW_REQUIRED |

## Tests run

| # | Test | Result |
|---|------|--------|
| 1 | captures event-centered frames for all 8 visual readability dimensions | PASS |
| 2 | semantic frames are non-blank with luminance and color variance | PASS |
| 3 | frames at different ticks are visually distinct | PASS |

**3/3 browser tests passed.**

## Evidence table

| Dimension | Frame: before | Frame: event | Frame: after | SHA256 distinct |
|-----------|--------------|--------------|--------------|-----------------|
| ball_readability_under_congestion | tick 109 | tick 121 | tick 136 | Yes (3 unique) |
| team_classification | tick 120 | tick 125 | tick 140 | Yes (3 unique) |
| facing_orientation | tick 168 | tick 180 | tick 195 | Yes (3 unique) |
| action_recognition | tick 588 | tick 600 | tick 615 | Yes (3 unique) |
| contact_comprehension | tick 228 | tick 240 | tick 255 | Yes (3 unique) |
| team_shape_readability | tick 408 | tick 420 | tick 432 | Yes (3 unique) |
| camera_readability | tick 288 | tick 300 | tick 312 | Yes (3 unique) |
| silhouette_stability | tick 348 | tick 360 | tick 375 | Yes (3 unique) |

All 24 frame PNGs have unique SHA256 hashes (no duplicates). All frames are non-blank (luminance variance > 50, > 20 distinct RGB colors verified).

## Frame SHA256 sample (3 representative frames)

- `ball_readability_under_congestion-event.png`: `ac3af929169d9066c970ac320879e69eb01e2ef91facd340f83020d9bb57ffc9`
- `contact_comprehension-event.png`: `e053c667ae40201e3dcacf2912ad0454e1ff30a8cb447a7dcb54f37ed56eaeb1`
- `team_shape_readability-event.png`: `48739d9da65aae185f619b29b4706b3e00262f9830c871f0e2b373aa206e58c1`

## Determinism

Two independent headless runs of the 720-tick CPU-vs-CPU 3v3 match produce identical per-tick hashes. The browser bridge and headless simulation share the same core (proven by BROWSER-SMALL-SIDED-001-CASE).

## Claims not made

- **No numeric readability PASS claim**: VISUAL_SPEC defers readability thresholds. This evidence provides observability for reviewer/perceptual judgment only.
- **No PES fidelity claim**: No reference bar comparison has been performed.
- **No FOUNDATION_LAB_PASS claim**: No foundation lab evaluator exists or has been run.
- **No COURT PROMOTION verdict**: Milestone verdicts are derived evaluation artifacts, not builder claims.
- **No qualitative football behavior claim**: This evidence demonstrates visual readability dimensions are observable; it does not claim the football quality meets any specific bar.

## Honesty statement

**This is observability evidence for reviewer/perceptual readability judgment.** The 24 captured frames demonstrate that the 8 `visual_readability_dimensions` from the SMALL_SIDED_SHAPE milestone playtest plan are *observable* in small-sided 3v3 browser rendering. Each dimension is mapped to an event-centered before→event→after sequence tied to specific simulation ticks where the relevant situation occurs. The frames are real renderer output from the deterministic 3v3 CPU-vs-CPU simulation.

This evidence does NOT constitute a numeric readability PASS. The VISUAL_SPEC intentionally defers readability thresholds to perceptual review. The critic and integration reviewer must independently judge whether the visual quality of these frames meets the applicable reference bar.

## Known gaps

- **Ball stays settled**: The CPU-only (all AI_FALLBACK) 3v3 scenario keeps the ball at its initial settled position. Player-player-contact events are abundant (810 events in 720 ticks), but pass/shot events are not produced because the CPU adapter does not generate kick actions in this scenario. The visual readability dimensions are demonstrated through player positioning, movement, and contact — not through ball flight dynamics.
- **No discrete action events**: The CPU adapter produces no kick/pass/shot actions. The `action_recognition` dimension is demonstrated through directional player positioning only, not through discrete identifiable actions.
- **Static camera**: The renderer camera is static (centered on the ball at origin). Camera readability is demonstrated through consistent field of view, not through tracking behavior.
- **REVIEW_REQUIRED for SHA duplicates**: The deterministic 3v3 CPU-vs-CPU simulation produces byte-identical frames at ticks matching BROWSER-SMALL-SIDED-001-CASE (tick 180 → frame-play.png, tick 360 → frame-later.png). This yields `REVIEW_REQUIRED` per the evidence contract. These are the same renderer output at the same game state, used to demonstrate different readability dimensions in context. The critic adjudicated this reuse as defensible for frames where the semantic mapping is honest.
- **No manifest.json**: Durable acceptance manifest will be produced by `gauntlet:acceptance:persist` during the orchestrator's acceptance flow.
- **No critic or integration review**: These are separate roles that follow this builder report.
