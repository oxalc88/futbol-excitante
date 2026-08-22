# ARCHETYPE-REMAINING-VISUALS — Builder Report (RETRY)

## Objective
- **id**: ARCHETYPE-REMAINING-VISUALS
- **evidence_class**: PRESENTATION
- **builder_model**: mimo-v2.5
- **hypothesis**: After reverting simulation archetype additions (TECHNICAL_V1, POWER_V1, AGILITY_V1) from ARCHETYPE_REGISTRY, the three remaining archetypes still produce distinct renderer output via the ARCHETYPE_VISUAL_REGISTRY, while the simulation treats them identically (transientAcceleration defaults to 0 for unknown IDs).

## Required Fixes Applied
1. Reverted ALL simulation archetype additions in `src/simulation/config/foundation.ts` — removed ARCHETYPE_TECHNICAL_V1 / POWER_V1 / AGILITY_V1 constants and their ARCHETYPE_REGISTRY entries. Burst and steady remain unchanged.
2. Renderer-only `ARCHETYPE_VISUAL_REGISTRY` mappings in `src/adapters/renderer-three/renderer.ts` kept intact for technical/power/agility.
3. Recaptured PRESENTATION frames via real Three.js WebGL buffer (800x600).

## Files Changed
- `src/simulation/config/foundation.ts` — Removed 3 ArchetypeDefinition constants (TECHNICAL_V1, POWER_V1, AGILITY_V1) and their ARCHETYPE_REGISTRY entries; ARCHETYPE_REGISTRY now contains only burst and steady.
- `src/adapters/renderer-three/renderer.ts` — No changes (ARCHETYPE_VISUAL_REGISTRY retained all 5 visual mappings).
- `tests/browser/archetype-remaining-visuals.browser.test.ts` — No changes (captures all 3 remaining archetypes under identical conditions).

## Commands Run
- `CI=1 npx vitest run --project node tests/unit/locomotion/archetypes.test.ts` — 14 tests, all PASS
- `CI=1 npx vitest run --project node tests/unit/eval/mutant-1v1.test.ts` — 38 tests, all PASS
- `CI=1 npx vitest run --project node tests/unit/eval/archetype-comparison.test.ts` — 51 tests, all PASS
- `CI=1 npx vitest run --project node tests/unit/eval/playable-1v1-re-evaluation.test.ts` — 29 tests, all PASS
- `CI=1 npx vitest run --project node tests/unit/eval/playable-1v1-profile-evaluation.test.ts` — 47 tests, all PASS
- `CI=1 npx vitest run --project node tests/unit/ball/ball-system.test.ts` — 31 tests, all PASS
- `CI=1 npx vitest run --project node tests/unit/two-player.test.ts` — 21 tests, all PASS
- `CI=1 pnpm vitest run --project browser tests/browser/archetype-remaining-visuals.browser.test.ts` — 1 test, PASS
- `pnpm run gauntlet:audit -- --objective ARCHETYPE-REMAINING-VISUALS --class PRESENTATION --tests-pass true` — PASS

## Simulation State After Revert

| Archetype | In ARCHETYPE_REGISTRY? | transientAcceleration | Note |
|---|---|---|---|
| archetype-burst-v1 | Yes | 1.0 | Unchanged |
| archetype-steady-v1 | Yes | 0 | Unchanged |
| archetype-technical-v1 | **No (removed)** | 0 (default) | Unknown ID → 0 |
| archetype-power-v1 | **No (removed)** | 0 (default) | Unknown ID → 0 |
| archetype-agility-v1 | **No (removed)** | 0 (default) | Unknown ID → 0 |

All three remaining archetypes resolve to transientAcceleration 0 via the unknown-ID default in `resolveArchetypeTransientAccel()`.

## Visual Mapping Summary (renderer-only, unchanged)

| Archetype | bodyScale | emissiveTint (RGB) | emissiveIntensity | Distinct from burst/steady? |
|---|---|---|---|---|
| archetype-technical-v1 | 0.94 | [0.0, 0.3, 0.5] (cyan) | 0.15 | Yes |
| archetype-power-v1 | 1.12 | [0.5, 0.15, 0.0] (warm red) | 0.22 | Yes |
| archetype-agility-v1 | 0.90 | [0.15, 0.4, 0.1] (green) | 0.12 | Yes |

All values are explicitly provisional and versioned. No PES calibration.

## Screenshot Evidence

Captured under identical camera/task/tick conditions (800×600 WebGL buffer). Only archetypeId differs between captures.

| Archetype | File | SHA-256 | stateHash |
|---|---|---|---|
| archetype-technical-v1 | `archetype-technical-frame-005.png` | `3840188e2cd51272f90cae0b1fbda563f65e4d0f7d89f56587a9cc11b48e2728` | `fnv1a64-v1:dc0af5f793a588ef` |
| archetype-power-v1 | `archetype-power-frame-005.png` | `bdeb04b76b6f166b71cafa5556fcd04af1cb7ed3ddfdb83ffad5331605c5fda3` | `fnv1a64-v1:45976fef99f2fa25` |
| archetype-agility-v1 | `archetype-agility-frame-005.png` | `9b1a1df24da2fa070cca30f79c6637bf2abaf29a5492443f9f901f51990fd35c` | `fnv1a64-v1:142c12ca01bbe357` |

All 3 SHA-256 hashes are **unique** — each archetype produces distinct renderer output via the ARCHETYPE_VISUAL_REGISTRY.

stateHashes differ because `archetypeId` is part of the canonical state encoding (`encodeCanonical(freezeWorldState(state))`). Each capture uses a different archetypeId string, which changes the canonical serialization. Simulation *behavior* (transient acceleration, positions, velocities) is identical — all three resolve to transientAcceleration 0.

Screenshots location: `docs/screenshots/ARCHETYPE-REMAINING-VISUALS/`

## Known Gaps
- stateHashes differ across the three captures because archetypeId strings differ in the canonical encoding. This is expected and correct — the scenario sets different archetypeId strings which are serialized into the world state.
- This objective only ensures the remaining 3 archetypes (technical, power, agility) have distinct visual mappings. It does not claim ARCHETYPE_BLINDED_COMPARISON_PASS.
- PES fidelity is not claimed. All visual coefficients are provisional and versioned.

## Claims Not Made
- No PLAYABLE_1V1_PASS claim
- No PES fidelity claim
- No ARCHETYPE_BLINDED_COMPARISON_PASS claim (requires the full blinded comparison rubric evaluation)
- No invented reference envelopes
- No mutation of accepted historical evidence
