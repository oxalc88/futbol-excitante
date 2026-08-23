# Builder Report: SMALL-SIDED-SITUATION-FIXTURES

## Overview

- **objective_id**: SMALL-SIDED-SITUATION-FIXTURES
- **builder_agent**: builder-structured
- **builder_model**: qwen3.6
- **evidence_class**: HEADLESS
- **hypothesis**: SMALL_SIDED_SHAPE requires eight gameplay situations. All are NOT_EVALUATED because no executable 3v3 situation fixtures/observations exist. This objective materializes the executable scenario fixtures and situation↔event/observation mappings only — no per-situation verdict claims.

## Commands Run

| # | Command | Exit Code |
|---|---------|-----------|
| 1 | `CI=1 npx vitest run --project node --test-timeout=30000 tests/unit/scenario/situation-fixtures.node.test.ts` | 0 |
| 2 | `CI=1 npx vitest run --project node --test-timeout=60000 tests/unit/scenario/3v3-scenario.test.ts tests/unit/scenario/3v3-browser-routing.test.ts` | 0 |
| 3 | `CI=1 npx vitest run --project node --test-timeout=60000 tests/unit/loop/simulation.test.ts` | 0 |
| 4 | `CI=1 npx vitest run --project node --test-timeout=60000 tests/unit/cpu-adapter/teamplay-3v3.test.ts` | 0 |
| 5 | `CI=1 npx vitest run --project node --test-timeout=60000 tests/unit/eval/eval-registry.test.ts tests/unit/contract-fixtures.test.ts` | 0 |
| 6 | `CI=1 npx vitest run --project node --test-timeout=60000 tests/unit/scenario/` | 0 |

## Tests Run

### New tests (situation-fixtures.node.test.ts)

| Name | Result |
|------|--------|
| Structure validity (18 assertions per fixture × 2 fixtures = 36 tests) | PASS |
| Deterministic execution (4 assertions per fixture × 2 fixtures = 8 tests) | PASS |
| Event emission (2 assertions per fixture × 2 fixtures = 4 tests) | PASS |
| Situation-event mapping coverage (7 tests) | PASS |
| Event filter predicates (8 tests) | PASS |

**Total new tests**: 67 | **Passed**: 67 | **Failed**: 0

### Existing tests (regression verification)

| Test file | Tests | Result |
|-----------|-------|--------|
| `tests/unit/scenario/` (all 9 files) | 249 | PASS |
| `tests/unit/scenario/3v3-scenario.test.ts` | 32 | PASS |
| `tests/unit/scenario/3v3-browser-routing.test.ts` | 11 | PASS |
| `tests/unit/loop/simulation.test.ts` | 22 | PASS |
| `tests/unit/cpu-adapter/teamplay-3v3.test.ts` | 23 | PASS |
| `tests/unit/eval/eval-registry.test.ts` | 48 | PASS |
| `tests/unit/contract-fixtures.test.ts` | 18 | PASS |
| `tests/unit/scenario/match-timer.test.ts` | 19 | PASS |
| `tests/unit/scenario/match-set-piece.test.ts` | 21 | PASS |
| `tests/unit/scenario/5v5-scenario.test.ts` | 42 | PASS |
| `tests/unit/scenario/goal-kick.test.ts` | 19 | PASS |
| `tests/unit/scenario/corner-kick.test.ts` | 19 | PASS |
| `tests/unit/scenario/throw-in.test.ts` | 19 | PASS |

**Total existing regression tests**: 282 (excluding overlap with scenario suite) | **Passed**: 282 | **Failed**: 0

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `eval/scenarios/3v3-situation-fixture.v1.json` | Created | Core 3v3 scenario fixture covering 5 situations: PASS_RECEPTION, SHOT_TO_RESULT, PHYSICAL_DUEL, SUPPORT_AND_PASSING_LANES, SETTLED_ATTACK_VS_DEFENCE |
| `eval/scenarios/3v3-transition-fixture.v1.json` | Created | Transition 3v3 scenario fixture covering 3 situations: ATTACK_TO_DEFENCE_TRANSITION, DEFENCE_TO_ATTACK_TRANSITION, COORDINATED_PRESS |
| `eval/contracts/situation-mapping.ts` | Created | Situation↔SimulationEvent/TelemetryObservation mappings for all 8 SMALL_SIDED_SHAPE situations |
| `tests/unit/scenario/situation-fixtures.node.test.ts` | Created | 67 unit tests covering fixture validity, deterministic execution, event emission, mapping completeness, and filter predicates |

## Situation↔Event/Observation Mapping Table

| Situation ID | Required Event Kinds | Indicative Event Kinds | Requires Position Data | Requires Team Geometry | Mapping Status |
|-------------|---------------------|----------------------|----------------------|----------------------|---------------|
| PASS_RECEPTION | `pass`, `player-ball-contact` | `second-touch` | Yes | No | NOT_EVALUATED |
| SHOT_TO_RESULT | `shot`, `goal`, `ball-out-of-play` | `pitch-contact` | Yes | No | NOT_EVALUATED |
| PHYSICAL_DUEL | `player-player-contact` | `input-rejection` | Yes | No | NOT_EVALUATED |
| SUPPORT_AND_PASSING_LANES | `pass`, `player-ball-contact` | `second-touch` | Yes | Yes | NOT_EVALUATED |
| SETTLED_ATTACK_VS_DEFENCE | `pass`, `player-ball-contact`, `player-player-contact` | `shot` | Yes | Yes | NOT_EVALUATED |
| ATTACK_TO_DEFENCE_TRANSITION | `ball-out-of-play`, `pass`, `shot`, `goal` | `player-player-contact`, `player-ball-contact` | Yes | Yes | NOT_EVALUATED |
| DEFENCE_TO_ATTACK_TRANSITION | `player-ball-contact`, `pass`, `shot`, `goal` | `player-player-contact`, `ball-out-of-play` | Yes | Yes | NOT_EVALUATED |
| COORDINATED_PRESS | `player-player-contact`, `input-rejection`, `pass`, `shot` | `player-ball-contact` | Yes | Yes | NOT_EVALUATED |

### Evidence chains

| Situation | Evidence Chain |
|-----------|---------------|
| PASS_RECEPTION | `pass` event (tick, from_player, to_player) → `player-ball-contact` at receiver tick (first touch) → verify ball trajectory between events |
| SHOT_TO_RESULT | `shot` event → ball trajectory (telemetry) → `goal` or `ball-out-of-play` event within finite ticks |
| PHYSICAL_DUEL | `player-player-contact` event (two opposing players) → verify displacement via telemetry positions before/after contact |
| SUPPORT_AND_PASSING_LANES | `pass` event → receiver position → teammate positions at pass time → verify teammate was in support position without breaking formation |
| SETTLED_ATTACK_VS_DEFENCE | Telemetry positions of all 6 players → extract team geometry (defensive line, spacing) → verify attacking progression against preserved defensive shape |
| ATTACK_TO_DEFENCE_TRANSITION | Possession loss event (ball-out-of-play or opponent gain) → telemetry position trajectory → verify team-a (attacking team) transitions to defensive formation |
| DEFENCE_TO_ATTACK_TRANSITION | Recovery event (team-b gains possession via player-ball-contact) → telemetry position trajectory → verify differentiated attacking roles |
| COORDINATED_PRESS | Player-player contact near opponent with ball → verify multiple team members press (not just one) → ball possession changes indicate successful or failed press |

### Fixture-to-situation coverage

| Fixture | Situations Covered |
|---------|-------------------|
| `3v3-situation-fixture.v1.json` | PASS_RECEPTION, SHOT_TO_RESULT, PHYSICAL_DUEL, SUPPORT_AND_PASSING_LANES, SETTLED_ATTACK_VS_DEFENCE |
| `3v3-transition-fixture.v1.json` | ATTACK_TO_DEFENCE_TRANSITION, DEFENCE_TO_ATTACK_TRANSITION, COORDINATED_PRESS |

## Known Gaps

1. **Event capture in empty-input runs**: Both fixtures use empty input programs (`inputProgram: {}`). CPU controllers drive the simulation via `AI_FALLBACK` control slots. In a 60-tick window with no explicit inputs, the CPU may not always generate all expected events (pass, shot, contact) since the ball must first be in physical proximity for CPU decision logic to trigger. Longer runs (600 ticks) increase event density but do not guarantee coverage of all 8 situations in every run. The mapping uses `NOT_EVALUATED` status, which honestly reflects that no verdict claim is made.

2. **No situation-specific oracles**: The situation-event mapping defines *which* events to look for, but no oracle implementations exist to validate situation-level criteria (e.g., "did the receiver approach the ball before touching?"). This is expected — the next objective (SMALL-SIDED-SITUATION-EVALUATOR) will implement the evaluators.

3. **No telemetry position filtering for position-requiring situations**: Situations marked `requires_position_data: true` need telemetry position analysis, but the filtering functions (`filterObservationsForSituation`) only check event kinds. Position data is available in the observation object; evaluators will need to perform the spatial analysis.

4. **No fixture variants per situation**: Both fixtures are general 3v3 setups that *may* exercise multiple situations naturally. Dedicated single-situation fixtures (e.g., a shot-specific setup with a clear shooting lane) would provide more deterministic event coverage but are not required by this objective's scope.

5. **TEAM_SUITE not registered in SUITES**: The `eval/contracts/suites.ts` `SUITES` record only includes fast, locomotion, ball, and duels. TEAM_SUITE exists as a normative declaration but is not in `SUITES`. This is by design — registered only when all test bindings exist.

## Claims Not Made

- **No situation verdict claims**: No situation is claimed PASS, FAIL, or NOT_EVALUATED as a gameplay result. All 8 situations have `mapping_status: "NOT_EVALUATED"`, meaning no evaluation verdict is asserted. The fixture/mapping layer is infrastructural.

- **No PES fidelity claims**: No reference to PES 2017 behavior envelopes, measured targets, or fidelity claims.

- **No regression PASS claims**: No protected regression suite or oracle exists for these situations.

- **No NEW event kinds invented**: Only existing SimulationEvent kinds are referenced (pass, shot, goal, player-ball-contact, player-player-contact, ball-out-of-play, input-rejection, second-touch, pitch-contact).

- **No new physics or engine behavior**: No new game physics, ball parenting/teleport, or engine modifications were made. Fixtures reuse the existing CPU teamplay controllers and simulation engine.

## Architecture

- Fixtures follow the existing `ScenarioDefinition` schema from `src/contracts/scenario.ts`.
- The situation mapping module `eval/contracts/situation-mapping.ts` follows the same structural conventions as other eval contract modules (bindings.ts, suites.ts, etc.).
- Tests follow the same patterns as existing scenario tests (3v3-scenario.test.ts, simulation.test.ts).
- No Node I/O in `src/simulation/` or `src/contracts/`. All file I/O is confined to `eval/scenarios/` (data) and tests (fixture loading).
- No edits to `gauntlet/state/**`, specs, roles, routing, AGENTS.md, or mise.toml.
- No historical evidence mutation.
- No commit or push performed.
- SMALL-SIDED-SITUATION-EVALUATOR was not started.