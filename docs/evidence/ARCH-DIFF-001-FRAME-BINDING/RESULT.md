# ARCH-DIFF-001-FRAME-BINDING — Builder Result

## Objective
- **ID**: ARCH-DIFF-001-FRAME-BINDING
- **evidence_class**: HEADLESS
- **builder_model**: qwen3.6

## Hypothesis
`validateBrowserCasesFor1v1` always returned `NEEDS_PERCEPTUAL_REVIEW` for ARCH-DIFF-001 because the ARCH-DIFF-001 branch was hardcoded. By wiring the evaluator to `runArchDiff001({useDiskArtifacts: true})` and adding `ARCHETYPE-FULL-PAIR-RECAPTURE` to the artifact search path, the evaluation should produce an honest verdict based on committed recapture artifacts.

## Files Changed
1. `eval/runners/arch-diff-001-evaluator.ts` — Added `ARCHETYPE-FULL-PAIR-RECAPTURE` to `loadArtifactHashes` search dirs
2. `eval/runners/playable-evaluator.ts` — Wired ARCH-DIFF-001 to `runArchDiff001`; added import
3. `tests/unit/archetype-browser-eval.node.test.ts` — Updated test expectation for `runArchDiff001({useDiskArtifacts:true})` from "not PASS" to "PASS"
4. `tests/unit/eval/arch-diff-001-frame-binding.node.test.ts` — New test file (10 tests)

## Commands Run
| # | Command | Exit Code |
|---|---------|-----------|
| 1 | `mise run test -- tests/unit/eval/arch-diff-001-rubric.test.ts tests/unit/archetype-browser-eval.node.test.ts` | 0 |
| 2 | `mise run test -- tests/unit/eval/arch-diff-001-frame-binding.node.test.ts` | 0 |
| 3 | `mise run test -- tests/unit/eval/arch-diff-001-rubric.test.ts tests/unit/archetype-browser-eval.node.test.ts tests/unit/eval/arch-diff-001-frame-binding.node.test.ts` | 0 |
| 4 | `pnpm run gauntlet:audit -- --objective ARCH-DIFF-001-FRAME-BINDING --class HEADLESS --tests-pass true` | 0 |

## Tests Run
| Test Suite | Tests | Result |
|------------|-------|--------|
| `tests/unit/eval/arch-diff-001-rubric.test.ts` | 61 | PASS |
| `tests/unit/archetype-browser-eval.node.test.ts` | 5 | PASS |
| `tests/unit/eval/arch-diff-001-frame-binding.node.test.ts` | 10 | PASS |
| **Total** | **76** | **PASS** |

## ARCH-DIFF-001 Evaluation Outcome
- **Hypothesis verdict**: **PASS**
- The recaptured artifacts in `docs/evidence/ARCHETYPE-FULL-PAIR-RECAPTURE/` produce distinct perceptual hashes for burst (v1) vs steady (v1) archetypes.
- Hash diff ratio: **0.9375** (threshold: 0.1) → PASS
- State diff ratio: **0.5556** (threshold: 0.05) → PASS
- Confidence: well above 0.5 threshold → PASS
- Structural integrity: valid frames, matching dimensions → PASS
- All 4 HARD dimensions pass → overall verdict: **PASS**

## Evidence Presence
- `docs/evidence/ARCH-DIFF-001-FRAME-BINDING/RESULT.md` — this file
- `docs/evidence/ARCH-DIFF-001-FRAME-BINDING/audit.json` — gauntlet audit, status PASS
- `docs/evidence/ARCHETYPE-FULL-PAIR-RECAPTURE/archetype-burst-frame-005.meta.json` — burst perceptual hash
- `docs/evidence/ARCHETYPE-FULL-PAIR-RECAPTURE/archetype-steady-frame-005.meta.json` — steady perceptual hash
- `docs/evidence/ARCHETYPE-FULL-PAIR-RECAPTURE/archetype-burst-frame-005.png` — burst visual artifact
- `docs/evidence/ARCHETYPE-FULL-PAIR-RECAPTURE/archetype-steady-frame-005.png` — steady visual artifact

## Known Gaps
- PLAYABLE_1V1 overall verdict is still not PASS because other browser cases (BROWSER-CORE-RESET-001, BROWSER-CORE-STEP-001, BROWSER-1V1-CONTROL-001) require browser evidence that is not yet provided to `evaluatePlayable1v1`.
- The ARCH-DIFF-001 `BrowserCaseResult` is still not populated from browser runs (the browser capture test populates `docs/evidence/BROWSER-1V1-CONTROL-EVIDENCE/browser-cases.json` but not an ARCH-DIFF-001 browser case result). This is an evaluation architecture gap, not a bug in the rubric.

## Claims Not Made
- No PES fidelity claims.
- No invented reference envelopes.
- No theatrical PASS — the verdict derives from actual artifact hash comparison.