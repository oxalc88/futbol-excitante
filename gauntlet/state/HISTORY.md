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

## Iteration 6 — 2026-08-13

- objective_id: BOOTSTRAP-06
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 2)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: 1b80cc23528a525e06ae13863c5f3bf236d15979
- notes: Normalized InputFrame, one stable slot, REPEAT_HELD_WITH_ZERO_EDGES, sourceId provenance-only. First two critic RETRYs: dead slot wiring, then double tick resolution and false unassigned. 233 node tests. No locomotion yet.

## Iteration 7 — 2026-08-13

- objective_id: BOOTSTRAP-07
- builder: builder-mimo / mimo-v2.5
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: 9fb016fbffe8f6a9b97f56e44ba317b35ddfb60e
- notes: One-player kinematic locomotion. Desired velocity/heading immediate; actual converges under provisional accel/brake/turn/maxSpeed. Position from velocity. Sprint multiplier unused (known gap). 247 node tests. No PES/LOC claim.

## Iteration 8 — 2026-08-13

- objective_id: BOOTSTRAP-08
- builder: builder-mimo / mimo-v2.5
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: bb1556d82395252daf2f2df4cd90f0b7a06419e4
- notes: Independent 3D ball with gravity, swept pitch impact, bounce, non-reversing ground resistance, spin decay. Pitch-contact events with incoming/outgoing snapshots. 264 node tests. No PES ball claim.

## Iteration 9 — 2026-08-13

- objective_id: BOOTSTRAP-09
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 1)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: c96de25d8a4f44136b1efae8b7aa16d98239b93c
- notes: ReplayV1 codec, recorder, reusable verifyReplay with earliest divergence + state slice, restore-capable checkpoints. First critic RETRY for missing verifier/full checkpoints. 318 node tests. No alternative physics.






