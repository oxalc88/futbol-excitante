# EVALUATOR-ISRELEVANT-FIX — Builder Report

## Objective

Fix `isRelevantEvent()` in `eval/contracts/situation-mapping.ts` to include `indicative_event_kinds` from the `SITUATION_EVIDENCE_REQUIREMENTS` mapping, so that the situation evaluator's `computeSituationVerdict` can see indicative events (e.g. `second-touch`) when computing verdicts.

## Root Cause

The `isRelevantEvent()` function used hardcoded event kind checks for each situation. It never consulted `SITUATION_EVIDENCE_REQUIREMENTS[situationId].indicative_event_kinds`, so events like `second-touch` (defined as indicative for `PASS_RECEPTION` and `SUPPORT_AND_PASSING_LANES`) were filtered out by `filterEventsForSituation()` and never reached `computeSituationVerdict`.

The verdict logic in `computeSituationVerdict` correctly checks for indicative kinds, but the filter was never passing those events through.

## Files Changed

### 1. `eval/contracts/situation-mapping.ts` (lines 32–92)

**Before:** Each `case` in the `switch(situationId)` statement used hardcoded event kind checks:

```typescript
case "PASS_RECEPTION":
  return event.kind === "pass" || event.kind === "player-ball-contact";
```

**After:** Each `case` now also checks `SITUATION_EVIDENCE_REQUIREMENTS[situationId].indicative_event_kinds`:

```typescript
case "PASS_RECEPTION": {
  const req = SITUATION_EVIDENCE_REQUIREMENTS[situationId];
  return event.kind === "pass" || event.kind === "player-ball-contact" || req.indicative_event_kinds.includes(event.kind);
}
```

This was applied to all 8 situations. The change is additive — it only adds more events to the relevant set; it never removes events.

### 2. `eval/contracts/situation-mapping.ts` (no change needed)

The `indicative_event_kinds` for `PASS_RECEPTION` and `SUPPORT_AND_PASSING_LANES` already include `["second-touch"]` in the accepted situation-mapping contract. No changes needed here.

### 3. Test expectations updated

- `tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-3-binding.test.ts` — updated `EXPECTED_VERDICTS` map and "extended fixture event kinds" test assertions to match correct behavior.
- `tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-1-RERUN-binding.test.ts` — no changes needed (4 target verdicts unchanged for driven fixture).

### 4. Persisted batch artifacts regenerated

- `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-3/situations/*.json` — regenerated from fixed evaluator against `3v3-situation-driven-extended.v1.json`.
- `docs/evidence/SMALL-SIDED-SITUATIONS-BATCH-1-RERUN/situations/*.json` — regenerated from fixed evaluator against `3v3-situation-driven.v1.json`.

## Test Results

```
Test Files  5 passed (5)
Tests       116 passed (116)
Duration    ~34s
```

All 5 test files pass:
- `small-sided-situation-evaluator.test.ts` — 27 tests
- `SMALL-SIDED-SITUATIONS-BATCH-1-binding.test.ts` — 11 tests
- `SMALL-SIDED-SITUATIONS-BATCH-1-RERUN-binding.test.ts` — 26 tests
- `SMALL-SIDED-SITUATIONS-BATCH-2-RERUN-binding.test.ts` — 26 tests
- `SMALL-SIDED-SITUATIONS-BATCH-3-binding.test.ts` — 26 tests

## Per-Situation Verdict Changes

### Extended Fixture (`3v3-situation-driven-extended.v1.json`)

| Situation | Before | After | Reason |
|---|---|---|---|
| PASS_RECEPTION | FAIL | **PASS** | `second-touch` now visible as indicative |
| SHOT_TO_RESULT | FAIL | FAIL | `pitch-contact` not present in fixture |
| PHYSICAL_DUEL | FAIL | FAIL | `input-rejection` not present in fixture |
| SUPPORT_AND_PASSING_LANES | FAIL | **PASS** | `second-touch` now visible as indicative |
| SETTLED_ATTACK_VS_DEFENCE | PASS | PASS | Required + indicative `shot` already present |
| ATTACK_TO_DEFENCE_TRANSITION | FAIL | **PASS** | Indicative kinds (`player-player-contact`, `player-ball-contact`) now visible |
| DEFENCE_TO_ATTACK_TRANSITION | FAIL | **PASS** | Indicative kinds (`player-player-contact`, `ball-out-of-play`) now visible |
| COORDINATED_PRESS | FAIL | **PASS** | Indicative kind (`player-ball-contact`) now visible |

### Driven Fixture (`3v3-situation-driven.v1.json`) — BATCH-1-RERUN targets

| Situation | Before | After | Reason |
|---|---|---|---|
| PASS_RECEPTION | FAIL | FAIL | No `second-touch` events in driven fixture |
| SHOT_TO_RESULT | FAIL | FAIL | `pitch-contact` not present |
| PHYSICAL_DUEL | FAIL | FAIL | `input-rejection` not present |
| SUPPORT_AND_PASSING_LANES | FAIL | FAIL | No `second-touch` events in driven fixture |

## Verification

The fix was verified against the extended fixture where `second-touch` events are present in the simulation output:

- **PASS_RECEPTION**: Relevant events now include `second-touch` (3 occurrences at ticks 18, 23, 51). Verdict changed from FAIL to PASS.
- **SUPPORT_AND_PASSING_LANES**: Same — `second-touch` now visible. Verdict changed from FAIL to PASS.
- All other changed verdicts (ATTACK_TO_DEFENCE_TRANSITION, DEFENCE_TO_ATTACK_TRANSITION, COORDINATED_PRESS) changed because their indicative kinds are now included in the relevant events set.

## Impact

- **No verdict regression**: The fix only adds events to the relevant set. A situation that was PASS before remains PASS (required + indicative still present). A situation that was NOT_EVALUATED may become PASS/FAIL (more events now visible).
- **Binding test byte-identity**: Batch-3 and Batch-1-RERUN persisted artifacts were regenerated to match the corrected output. Fresh evaluator runs produce byte-identical results to the regenerated artifacts.