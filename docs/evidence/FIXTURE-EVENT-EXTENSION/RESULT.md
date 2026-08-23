# FIXTURE-EVENT-EXTENSION — Builder Report

**Builder:** builder-structured (Qwen)
**Fixture:** `eval/scenarios/3v3-situation-driven-extended.v1.json`
**Date:** 2026-08-23

## Objective

Extend the existing 3v3 situation-driven fixture to produce additional event kinds that were missing from the existing fixture, specifically: `second-touch`, `pitch-contact`, and `ball-out-of-play`.

## Fixture Design

The new fixture mirrors the structure of the existing `3v3-situation-driven.v1.json` with these modifications:

- **Ball**: Same initial position `(-1, 0, 0.11)`, `ground-roll` regime
- **Players**: 6 players (3v3) matching the existing fixture layout
- **Control assignments**: Same slot-to-player mapping

### Input program timeline

| Tick  | Control slot | Action | Purpose |
|-------|-------------|--------|---------|
| 1     | slot-1      | Drive with FIRST_TOUCH+PASS | Player-1 initiates a pass to player-2 |
| 10    | slot-2      | Drive with FIRST_TOUCH held | Player-2 catches up to the ball |
| 11    | slot-2      | Move left (turn input) | Player-2 contacts ball — first-touch → enters dribble |
| 17    | slot-2      | Move left again | Second-touch turn (17-11=6 >= 4 turn cooldown) |
| 22    | slot-2      | Move left again | Second-touch turn (22-17=5 >= 4 cooldown, 22-11=11 >= 2 delay) |
| 50    | slot-2      | Press SHOT_BIT | Shot event generated |

## Results

### Event kinds produced by the extended fixture

```
player-player-contact, pass, scheduler, player-ball-contact, second-touch, shot
```

### Comparison with existing fixture (`3v3-situation-driven.v1.json`)

| Event kind | Existing fixture | Extended fixture |
|-----------|-----------------|-----------------|
| `pass` | tick 2 | tick 2 |
| `player-ball-contact` (first-touch) | tick 11 | tick 11 |
| `second-touch` | **not produced** | tick 18, 23 |
| `shot` | tick 16 | tick 51 |
| `player-player-contact` | ticks 1-6 | ticks 1-6 |
| `scheduler` | yes | yes |

### Missing event kinds (ball physics limitation)

| Event kind | Produced? | Reason |
|-----------|----------|--------|
| `pitch-contact` | No | The ball stays in `"settled"` regime after the first contact. In this regime, ball integration does not move the ball position and never transitions to `"airborne"`. Without the ball becoming airborne, the pitch-plane impact test in `ball-system.ts` never fires. |
| `ball-out-of-play` | No | Same root cause: the ball never crosses any pitch boundary because its position is fixed after the initial contact. |
| `goal` | No | Requires ball-out-of-play with goal-frame intersection. |

**Root cause:** After the contact system applies an impulse to the ball, the ball enters the `"settled"` regime in ball integration (because z ≤ 0.15 after contact dampens z-velocity). The `"settled"` regime is a no-op — it does not update position or velocity. The ball never transitions to `"airborne"` because:

1. The contact system does not change `ball.regime` — it only modifies `ball.linearVelocity`
2. The ball position stays at z=0.11 (ball radius), which is ≤ radius+1e-9, so `isGrounded` remains true
3. Without airborne transition, gravity and integration never run

This is a **fundamental simulation behavior**, not a fixture issue. No existing fixture (including `3v3-transition-driven.v1.json` which produces a `shot` event with vz=1.8) produces `pitch-contact`, `ball-out-of-play`, or `goal` events.

## Assertions

Five assertions validated against the extended fixture (all passed):

| # | Assertion | Result |
|---|----------|--------|
| 1 | `pass` event kind present | PASS |
| 2 | `player-ball-contact` event kind present | PASS |
| 3 | `second-touch` event kind present | PASS |
| 4 | `shot` event kind present | PASS |
| 5 | ≥ 5 unique event kinds present (got 6) | PASS |

## Files Created

- `eval/scenarios/3v3-situation-driven-extended.v1.json` — New fixture (does not modify existing fixtures)
- `eval/test-extended-fixture.ts` — Quick assertion test (5/5 pass)

## Notes

- The existing accepted fixtures remain **unmodified**.
- No changes to `src/`, `contracts/`, `evaluators/`, or `specs/`.
- The ball physics limitation preventing `pitch-contact` / `ball-out-of-play` / `goal` events is a pre-existing behavior of the simulation core (ball regime transitions from `"settled"` after contact). This is outside the scope of a fixture-only change.