# Gauntlet history

Append one record per finished iteration. Do not rewrite earlier records.

<!--
## Iteration N — YYYY-MM-DD

- objective_id:
- builder:
- critic:
- verdict:
- integration:
- result: accepted | reverted | escalated
- notes:
-->

## Iteration 1 — 2026-08-13

- objective_id: BOOTSTRAP-01
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 1)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: 2d22a2995ae074108219c103fe318cf6cb566eac
- notes: Pinned mise Node 24.18.0 and pnpm 11.10.0, private ESM package, core/node/browser tsconfigs, Vite/Vitest skeleton, honest isolation/version/build/smoke tests, artifacts/.gitkeep. First critic RETRY for theatrical tests; rewrite plus clean-env `mise install --locked` evidence accepted. No PES fidelity or FOUNDATION_LAB_PASS claimed.

## Iteration 2 — 2026-08-13

- objective_id: BOOTSTRAP-02
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: 6d40bc2caaa8172215fdec25cf73f04827b45dd5
- notes: Portable contracts (Vec2/Vec3, InputFrame, control assignment, PlayerState, independent BallState, WorldState, ScenarioDefinition, SimulationEvent, PresentationSnapshot, telemetry, ReplayV1), immutable versioned FOUNDATION_CONFIG with provisional locomotion/ball coefficients, and table-driven validation. 90 node tests. No PES fidelity or FOUNDATION_LAB_PASS claimed.

## Iteration 3 — 2026-08-13

- objective_id: BOOTSTRAP-03
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 1)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: 2b402c361be74b5360b403220a0bbe1d53bd32b3
- notes: Determinism substrate — mulberry32-v1, canonical-json-v1, fnv1a64-v1, UTF-8 encoder, finite checks, core-boundary scan. First critic RETRY for non-canonical Mulberry32, FNV offset rounding, and UTF-8 surrogate bug. Retry aligned algorithms to cited references. 143 node tests. No PES fidelity claimed.

## Iteration 4 — 2026-08-13

- objective_id: BOOTSTRAP-04
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: 900aa50596654df57d10880ed606014842926248
- notes: Deterministic createWorld from declarative scenario + config + seed. Fixture foundation-move-and-roll.v1. Same-start hash identity. Advisory: createWorld currently discards input-uniqueness errors; must be closed when the loop consumes inputProgram.

## Iteration 5 — 2026-08-13

- objective_id: BOOTSTRAP-05
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: 7853fc26bf258432c71e49007608078f2f6bea65
- notes: Synchronous Simulation API (tick, applyInputs, step, snapshot, presentation, restore, stateHash). System-free locomotion/ball stages. createWorld uniqueness fail-closed. 194 node tests. Non-blocking: cross-call applyInputs duplicates and scheduledEvents wiring for BOOTSTRAP-06.


