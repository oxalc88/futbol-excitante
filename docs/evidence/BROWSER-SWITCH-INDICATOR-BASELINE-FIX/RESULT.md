# BROWSER-SWITCH-INDICATOR-BASELINE-FIX — Result

## Summary

Scoped bugfix for the pre-existing baseline failures surfaced in v21:
player-indicator INDICATOR-002; player-switch SWITCH-004/005/006.

## Root Cause Confirmed

The simulation core natively resolves `SWITCH_PLAYER_BIT` inside `sim.step()`
(lines 1019-1049 of `simulation.ts`), emitting a `slot-switch` event and
mutating `controlAssignments[slot].controlledPlayerId`. However:

1. **main.ts real-time loop** (lines 570-577): detected `SWITCH_PLAYER_BIT`
   in the keyboard frame and called `sim.setControlledPlayer()` manually,
   causing a second switch.
2. **Legacy browser test helpers** (`runWithCpu` in both
   `player-switch.browser.test.ts` and `player-indicator.browser.test.ts`):
   mirrored the same manual switch detection, causing a double switch in tests.

With a 2-player team, the double switch wraps around (player-1 → player-2 →
player-1), causing SWITCH-001/002/004 to see no net change. With a 3-player
team, it skips one (player-1 → player-2 → player-3), causing SWITCH-003 to
see an extra hop.

## Changes

| File | Change |
|------|--------|
| `src/apps/browser/main.ts` | Removed legacy manual switch detection block (setControlledPlayer + nextEligiblePlayer + SWITCH_PLAYER_BIT import + computeExplicitSwitchTarget import). Core-native path is now the sole switch mechanism. |
| `tests/browser/player-switch.browser.test.ts` | Removed manual switch detection from `runWithCpu()` helper; added SWITCH-GUARD discriminating tests. |
| `tests/browser/player-indicator.browser.test.ts` | Removed manual switch detection from `runWithCpu()` helper; added INDICATOR-GUARD discriminating tests. |
| `tests/browser/capture-switch-indicator-evidence.browser.test.ts` | New capture test for pre/post switch screenshots. |

## Core Unchanged

`git diff --stat src/simulation/` returns empty. The deterministic simulation
core is byte-identical to HEAD (815f52a).

## Previously-Failing Tests Now Passing

| Test | Before | After |
|------|--------|-------|
| SWITCH-001 | FAIL (expected player-2, got player-1 — double-switch wrapped around) | PASS |
| SWITCH-002 | FAIL (same wrap-around) | PASS |
| SWITCH-003 | FAIL (expected player-2, got player-3 — double-switch skipped) | PASS |
| SWITCH-004 | FAIL (human slot appeared unchanged after double-switch) | PASS |
| INDICATOR-002 | FAIL (expected player-2, got player-1 — same as SWITCH-001) | PASS |

## Discriminating Guards

### SWITCH-GUARD: core-native switch fires
- **Positive**: injects SWITCH_PLAYER_BIT frame via `injectInputs` only (no
  manual `setControlledPlayer`), calls `step()`, asserts exactly one switch
  and a `slot-switch` event emitted by the core.
- **Negative control**: injects frame WITHOUT SWITCH_PLAYER_BIT (simulates
  stashed core path), calls `step()`, asserts no switch and no event.
  This test would FAIL if the core's SWITCH_PLAYER_BIT processing were removed.

### INDICATOR-GUARD: marker follows core switch
- **Positive**: injects SWITCH_PLAYER_BIT, steps, renders, asserts marker is
  above the new player and `presentation.isControlled` reflects the switch.
- **Negative control**: injects frame without SWITCH_PLAYER_BIT, steps,
  asserts marker stays on original player.

## Neighbor Suite Results

| Suite | Tests | Result |
|-------|-------|--------|
| 5v5-human-vs-cpu | 20 | PASS |
| 1v1-control | 8 | PASS |
| core-smoke | 16 | PASS |
| 2v2-ai-match | 7 | PASS |
| 3v3-match | 9 | PASS |
| 5v5-ai-match | 8 | PASS |
| difficulty-setting | 9 | PASS |
| capture-player-indicator | 1 | PASS |
| capture-player-switch | 1 | PASS |

## Core Unit Tests

| Suite | Tests | Result |
|-------|-------|--------|
| input-system | 40 | PASS |
| simulation | 22 | PASS |
| control-slot-routing | 45 | PASS |

## Screenshot Evidence

| File | SHA-256 | Description |
|------|---------|-------------|
| `frame-pre-switch.png` | `5bec78f50723f0edc215acda3ef79f1886750dd7e9a71c8901995d67a15b7fb8` | Player-1 controlled, marker above player-1 |
| `frame-post-switch.png` | `21b2e07854b82170f11c9aef1d7c11a713bd96fee893fd83931742b7ec938f21` | Player-2 controlled after core-native Tab switch, marker follows |

Both are 800×600 RGBA PNGs, byte-distinct.

## Determinism

SWITCH-006 confirms: identical SWITCH_PLAYER_BIT inputs produce identical state
hashes across two independent runs.

## claims_not_made

- No PROMOTION-tier claim
- No PES fidelity claim
- No FOUNDATION_LAB_PASS claim
- No invented perceptual rubric or reference envelope
- No regulation/GK/full-match/11v11 work
- This is a baseline adapter-layer fix: the pre-existing browser test and
  main.ts failures were caused by double-switching in the adapter/test layer.
