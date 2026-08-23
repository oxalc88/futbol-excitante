# SMALL-SIDED-SITUATIONS-BATCH-1 — Builder Report

## Objective

| Field | Value |
|---|---|
| **id** | `SMALL-SIDED-SITUATIONS-BATCH-1` |
| **builder_agent** | builder-structured |
| **builder_model** | qwen3.6 |
| **evidence_class** | HEADLESS |
| **hypothesis** | The accepted evaluator `eval/runners/small-sided-situation-evaluator.ts` runs the deterministic 3v3 situation fixture, collects per-tick observations + events, and writes honest verdicts. This objective executes the evaluator and persists evidence for the four target situations: PASS_RECEPTION, SHOT_TO_RESULT, PHYSICAL_DUEL, SUPPORT_AND_PASSING_LANES. |

## Commands run

| # | Command | Exit code |
|---|---|---|
| 1 | `pnpm run test -- --run tests/unit/eval/small-sided-situation-evaluator.test.ts` | 0 |
| 2 | `tsx eval/runners/small-sided-situation-evaluator.ts 3v3-situation-fixture.v1.json docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1/situations` | 0 |
| 3 | `npx vitest run --project node tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-1-binding.test.ts` | 0 |
| 4 | `pnpm run test -- --run tests/unit/eval/small-sided-situation-evaluator.test.ts` | 0 |

## Files changed

| File | Action |
|---|---|
| `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1/situations/index.json` | Created — summary index with per-situation verdicts |
| `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1/situations/PASS_RECEPTION.json` | Created — per-situation artifact |
| `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1/situations/SHOT_TO_RESULT.json` | Created — per-situation artifact |
| `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1/situations/PHYSICAL_DUEL.json` | Created — per-situation artifact |
| `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1/situations/SUPPORT_AND_PASSING_LANES.json` | Created — per-situation artifact |
| `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1/situations/SETTLED_ATTACK_VS_DEFENCE.json` | Created — per-situation artifact (extra, from fixture coverage) |
| `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1/situations/ATTACK_TO_DEFENCE_TRANSITION.json` | Created — per-situation artifact (extra, evaluated but not in fixture's situation_ids) |
| `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1/situations/DEFENCE_TO_ATTACK_TRANSITION.json` | Created — per-situation artifact (extra) |
| `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1/situations/COORDINATED_PRESS.json` | Created — per-situation artifact (extra) |
| `tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-1-binding.test.ts` | Created — evidence-binding test (11 tests) |

## Tests run

### Original evaluator tests (`small-sided-situation-evaluator.test.ts`)
- **27 tests** — all PASS (determinism, robustness, artifact creation, mapping association, injectability, trajectory, geometry, filter consistency)
- **Exit code: 0**

### New evidence-binding tests (`SMALL-SIDED-SITUATIONS-BATCH-1-binding.test.ts`)
- **11 tests** — all PASS
  - `BATCH-1 binding: persisted artifacts exist` (4 tests) — index exists, all 4 target artifacts exist, verdicts match index, mapping references correct
  - `BATCH-1 binding: honest verdicts` (3 tests) — all NOT_EVALUATED, fresh run produces byte-identical artifacts, re-run produces identical index
  - `BATCH-1 binding: verdict computation` (2 tests) — empty-event verdict is NOT_EVALUATED, verdict_reason is descriptive
  - `BATCH-1 binding: full fixture consistency` (2 tests) — all 8 mapped situations are NOT_EVALUATED, fixture metadata matches
- **Exit code: 0**

## Per-situation verdicts

| Situation | Verdict | Relevant Events | Reason |
|---|---|---|---|
| **PASS_RECEPTION** | NOT_EVALUATED | 0 | No relevant events for PASS_RECEPTION; cannot evaluate |
| **SHOT_TO_RESULT** | NOT_EVALUATED | 0 | No relevant events for SHOT_TO_RESULT; cannot evaluate |
| **PHYSICAL_DUEL** | NOT_EVALUATED | 0 | No relevant events for PHYSICAL_DUEL; cannot evaluate |
| **SUPPORT_AND_PASSING_LANES** | NOT_EVALUATED | 0 | No relevant events for SUPPORT_AND_PASSING_LANES; cannot evaluate |

**Why all NOT_EVALUATED:** The `3v3-situation-fixture.v1.json` fixture (seed 42) has `inputProgram: {}` and no scheduled events. Players start at rest with zero velocity. The simulation runs 600 ticks producing only telemetry observations — zero simulation events (no pass, shot, contact, ball-out-of-play, goal, or player-ball-contact). Without required event kinds, every situation is NOT_EVALUATED. This is an honest, deterministic result.

## Evidence artifacts

Each artifact under `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1/situations/` contains:
- `situation_id` and full `evidence_requirement` record
- `verdict` and `verdict_reason`
- `relevant_events` (empty for all four targets)
- `relevant_observations` (empty for all four targets)
- `team_geometry` (600 entries, one per tick, with per-player positions)
- `all_events` (empty — no events in the fixture)
- `all_observations` (600 entries, one per tick)
- `trajectory` (600 entries with fnv1a64-v1 state hashes and ball+player positions)
- `has_invariant_failures: false`
- `total_ticks: 600`
- `scenario_id: 3v3-situation-fixture-v1`

## Integration test result

N/A for this objective (no integration with external subsystems).

## Slot wiring result

N/A — the fixture has 6 control slots wired correctly in its definition, but the evaluator tests already verified injection determinism and artifact mapping without slot-specific assertions. The situation fixture uses all 6 slots with AI_FALLBACK mode.

## Spec sections

- `eval/contracts/situation-mapping.ts` — evidence requirement definitions for all 8 situations
- `eval/runners/small-sided-situation-evaluator.ts` — evaluator runner, verdict computation, artifact writing
- `eval/runners/evaluate.ts` — core evaluation engine (run simulation, collect observations/events)
- `eval/scenarios/3v3-situation-fixture.v1.json` — fixture used for batch-1

## Acceptance criteria met

- [x] Evaluator ran against the situation fixture and produced honest verdicts
- [x] Per-situation artifacts persisted under `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1/situations/` (trajectory + events + verdict per situation)
- [x] Summary index (`index.json`) written with per-situation outcomes
- [x] Verdicts are exactly what the evaluator computes — all four targets are NOT_EVALUATED
- [x] Evaluator determinism tests pass (27 tests, exit 0)
- [x] New evidence-binding tests pass (11 tests, exit 0), proving fresh runs match persisted artifacts byte-for-byte
- [x] RESULT.md written with per-situation verdicts and commands

## Known gaps

- All four target situations are NOT_EVALUATED because the fixture does not generate simulation events. The fixture needs an input program or scheduled events that produce pass, shot, player-player-contact, and player-ball-contact events to enable PASS verdicts. This is the honest result; the fixture improvement is a follow-up concern for a later objective.
- The transition fixture (`3v3-transition-fixture.v1.json`) was not run for this batch (its three situations are not in scope). Running it separately would yield the same NOT_EVALUATED verdict pattern because it also has `inputProgram: {}`.

## Claims not made

- No PES fidelity claim.
- No `FOUNDATION_LAB_PASS` claim.
- No regression PASS claims on protected tests.
- No invented reference envelopes or tolerance numbers.
- Did not edit the evaluator, mapping, specs, or gauntlet state.
- Did not commit or push.
- Did not start BATCH-2.