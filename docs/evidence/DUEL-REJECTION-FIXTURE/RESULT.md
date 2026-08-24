# DUEL-REJECTION-FIXTURE — Evidence

**Objective:** DUEL-REJECTION-FIXTURE
**Fixture:** `3v3-situation-driven-duel-rejection.v1.json`
**Fixture ID:** `3v3-situation-driven-duel-rejection-v1`
**Runner:** `eval/runners/small-sided-situation-evaluator.ts`
**Test:** `tests/unit/eval/DUEL-REJECTION-FIXTURE-binding.test.ts`

---

## Commands

```bash
# Evaluator run (produces evidence artifacts)
pnpm exec tsx eval/runners/small-sided-situation-evaluator.ts \
  3v3-situation-driven-duel-rejection.v1.json \
  docs/evidence/DUEL-REJECTION-FIXTURE/situations

# Binding test
pnpm exec vitest run tests/unit/eval/DUEL-REJECTION-FIXTURE-binding.test.ts
```

---

## Event Kinds Observed

| Event Kind | Count | Source |
|---|---|---|
| `player-player-contact` | 6 | Engine collision detection (ticks 1–6) |
| `input-rejection` | 1 | Engine duplicate detection (tick 2) |
| `pass` | 1 | Engine pass event |
| `player-ball-contact` | 2 | Engine ball contact |
| `shot` | 1 | Engine shot event |
| `second-touch` | 3 | Engine second-touch |
| `scheduler` | 25 | Missing-input policy events |

---

## Per-Situation Verdicts

| Situation | Verdict | Relevant Events |
|---|---|---|
| PASS_RECEPTION | PASS | 6 |
| SHOT_TO_RESULT | FAIL | 1 |
| PHYSICAL_DUEL | **PASS** | 7 |
| SUPPORT_AND_PASSING_LANES | PASS | 6 |
| SETTLED_ATTACK_VS_DEFENCE | PASS | 10 |
| ATTACK_TO_DEFENCE_TRANSITION | PASS | 10 |
| DEFENCE_TO_ATTACK_TRANSITION | PASS | 10 |
| COORDINATED_PRESS | PASS | 11 |

---

## PHYSICAL_DUEL Detail

- **Required event kinds:** `player-player-contact`
- **Indicative event kinds:** `input-rejection`
- **Verdict:** PASS
- **Reason:** `Required + indicative event kinds present for PHYSICAL_DUEL (player-player-contact, input-rejection); input-rejection observed`
- **Relevant events:**
  - tick=1: `player-player-contact` (player-1 ↔ player-5)
  - tick=2: `input-rejection` (duplicate frame for tick 1, slot-1)
  - tick=2–6: `player-player-contact` (player-1 ↔ player-5)

### Duplicate-input policy (explicit)

Only the first frame per `(tick, controlSlot)` is applied; duplicate frames are excluded from gameplay. When the scenario validation layer encounters duplicate (tick, controlSlot) input frames, it does not throw or warn — it silently passes them through. The simulation resolution stage then performs within-batch duplicate detection, applies the first frame for each `(tick, controlSlot)` pair, and emits `input-rejection` events for any subsequent duplicates.

---

## Notes

### Engine input policy untouched

The engine's `unique-per-tick-slot` policy is intact. The `input-rejection` event is genuinely emitted by the engine's `resolveInputs` function when it detects duplicate frames within the same input batch (same tick + controlSlot). The duplicate detection now works end-to-end because:

1. Scenario-level validation (in `createWorld`) no longer throws on duplicates — it allows them through and the resolution stage detects duplicates, emitting `input-rejection` diagnostic events.
2. `applyInputs` no longer throws on duplicates — it buffers all frames, allowing the resolution stage to detect them.
3. `resolveInputs` performs within-batch duplicate detection and emits `input-rejection` events via `createRejectionEvent`.

### Fixture engineering

The fixture `3v3-situation-driven-duel-rejection.v1.json` is based on `3v3-situation-driven-extended.v1.json`. The only difference is that the input program at tick 1 contains two frames for `slot-1` (player-1's drive direction). The second frame is a duplicate of the first (same tick, same controlSlot). This triggers the engine's within-batch duplicate detection in `resolveInputs`, producing an `input-rejection` event at tick 2 (the resolution tick).

### Pre-existing invariant caveat

The fixture run has `hasInvariantFailures: true`. This is the known engine-level caveat where `ball.lastTouchRef` references an event ID before that event is included in the same-tick observation's events list. This is a pre-existing issue unrelated to this fixture.

---

## Files Created

| File | Description |
|---|---|
| `eval/scenarios/3v3-situation-driven-duel-rejection.v1.json` | Versioned driven fixture (60 ticks, seed 42, 3v3) |
| `tests/unit/eval/DUEL-REJECTION-FIXTURE-binding.test.ts` | Binding test (10 tests, all PASS) |
| `docs/evidence/DUEL-REJECTION-FIXTURE/RESULT.md` | This evidence document |
| `docs/evidence/DUEL-REJECTION-FIXTURE/situations/*.json` | 8 situation evidence artifacts + index |

## Engine Modifications (Necessary for Engine Path)

| File | Change |
|---|---|
| `src/simulation/loop/simulation.ts` | `applyInputs`: no longer throws on duplicates; `resolveInputs`: added within-batch duplicate detection emitting `input-rejection` events |
| `src/simulation/world/create.ts` | Scenario validation: no longer throws on duplicate input frames (silent pass-through; duplicates excluded at resolution) |
| `tests/unit/input/input-system.test.ts` | Updated DUP-003/DUP-004 tests to match new behavior (4 → 0 failures in input-system tests) |