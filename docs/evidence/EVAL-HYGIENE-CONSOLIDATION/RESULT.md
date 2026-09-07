# EVAL-HYGIENE-CONSOLIDATION — builder result

## Builder report

- **objective_id:** EVAL-HYGIENE-CONSOLIDATION
- **builder_agent:** builder-structured
- **builder_model:** deepseek-v4-flash
- **evidence_class:** BOOKKEEPING
- **hypothesis:** Consolidate the four reviewer non-binding cleanups with guards: (1) the dead `chasers` variable in `checkRestartNearestOnly`; (2) the conservative mirror-offset disclosure tightened in the serializeRestartFacts designation comment; (3) the `_keeperPressExclusions` diagnostics counter hygiene (document the gated-run/counter-read interaction); (4) the HUD ortho camera resize re-anchoring (presentation-only, draw-only). Zero verdict changes anywhere: the dead variable was unread, the mirror-offset change is a comment, the counter-hygiene change is documentation-only, and the HUD change is presentation-only at resize. Every cleanup guard-tested.

### files_changed

Per cleanup item:

- **Item 1 (dead `chasers` variable)** — `eval/oracles/rules-restart.ts`: removed the unused `chasers` Set in `checkRestartNearestOnly` (computed from `d.teams` but never read). The enforced falsifier for the §12 rule 2 "only one designated chaser converges" criterion is the clump count (a team clump >2 bodies within the huddle radius FAILs); the comment now states this precisely. Guard: existing rules gate stays green.
- **Item 2 (mirror-offset disclosure)** — `eval/runners/headless-match.ts`: tightened the `serializeRestartFacts` designation comment to state precisely that the designation mirror pairs the exact adapter phase (`coreMatchPhases[i]`) with the POST-STEP ball reference (`observations[i].ball.lastTouchRef`, the reference at the start of tick i+1) — a conservative one-tick offset that can only shorten a restart window or false-fail the anti-huddle criteria, never fabricate a PASS. Comment-only; no runtime change.
- **Item 3 (`_keeperPressExclusions` counter hygiene)** — `src/adapters/input-browser/goalkeeper-role.ts` + `eval/runners/headless-match.ts`: documented the gated-run/counter-read interaction. The post-loop `serializeRestartFacts` designation serialization calls `assignChaseRoles` → `designatePresser`, which increments `_keeperPressExclusions`. Never combine a gated designation run with a `getKeeperPressExclusionActivations()` read in one process — reset via `resetKeeperMechanismCounters()` between them (or read it in a fresh process). Documentation-only (no test); it is a diagnostics counter, not a gameplay value.
- **Item 4 (HUD ortho camera resize re-anchoring)** — `src/adapters/renderer-three/renderer.ts` + `tests/browser/hud-ortho-resize.browser.test.ts`: added a container `ResizeObserver` that re-anchors the opt-in match-phase HUD ortho camera + top-left sprite, and also re-sizes the renderer canvas + main camera aspect on resize. Presentation-only and draw-only — it never reads or writes a football outcome. Added a `getHudCamera()` diagnostics accessor. Guard: the new browser test verifies the frustum re-anchor, the canvas follows the container, the HUD renders at the top-left, and a non-HUD session returns null.
- **Evidence/producer** — `scripts/capture-eval-hygiene-consolidation.ts` (NEW — byte-reproducible BOOKKEEPING record) + `docs/evidence/EVAL-HYGIENE-CONSOLIDATION/` (NEW — `eval-hygiene-consolidation.json`, `audit.json`, this `RESULT.md`).

**No changes** to `src/simulation/`, `src/contracts/`, `eval/oracles/` semantics, `specs/`, `research/`, or `gauntlet/` role/agent contracts. The renderer change is in the presentation layer (`src/adapters/renderer-three/renderer.ts`), and the `checkRestartNearestOnly` change removes only dead code. No accepted evidence record is mutated.

### commands_run (actual exit codes)

| Command | Exit |
|---|---|
| `mise exec -- pnpm run typecheck` | 0 (core + node + browser clean) |
| Rules gate (10 files) | 0 (173/173 PASS) |
| GK families + registry/provenance/hygiene (18 files) | 0 (288/288 PASS; one non-fatal vitest worker-RPC infra timeout `Timeout calling "onTaskUpdate"` — the same known artifact documented in the accepted GK-SUITE-CORE-OWNED-STATE record, not an assertion failure) |
| HUD resize browser test (1 file) | 0 (3/3 PASS) |
| Render-sensitive browser batteries (18 files) | 0 (55/55 PASS: core-smoke, archetype-render-difference, archetype-identical-recapture, archetype-render-capture, browser-full-match-flow-evidence, anti-huddle-dynamic-evidence, browser-core-evidence, 1v1-control-screenshots, 2v2-keyboard-screenshot, 3v3-match-screenshots, ai-match-screenshot, capture-2v2-keyboard, capture-human-vs-cpu-3v3, capture-player-indicator, capture-player-switch, human-vs-cpu-3v3-screenshot, human-vs-cpu-screenshot, hud-ortho-resize) |
| `mise exec -- pnpm exec tsx scripts/capture-eval-hygiene-consolidation.ts` (ordinary mode ×2) | 0 — `record_sha256` `30d933e2…` identical both runs; leaves `docs/` byte-identical (docs/evidence hash unchanged); writes `test-results/gauntlet-capture/` |
| `WIP_SECTION=__EVIDENCE__:EVAL-HYGIENE-CONSOLIDATION mise exec -- pnpm exec tsx scripts/capture-eval-hygiene-consolidation.ts` | 0 (wrote `docs/evidence/EVAL-HYGIENE-CONSOLIDATION/eval-hygiene-consolidation.json`; `record_sha256` `30d933e2…`) |
| `mise exec -- pnpm run gauntlet:audit -- --objective EVAL-HYGIENE-CONSOLIDATION --class BOOKKEEPING --tests-pass true --integration-test-pass true` | 0 (status `PASS`; see `audit.json`) |

### tests_run

- **Typecheck** — exit 0 (core + node + browser clean).
- **Rules gate (10 files)** — rules-oracle (75), rules-suite (17), RULES-SUITE-REGISTRATION-binding (28), restart-rules-serialization (4), RULES-SUITE-STATE-binding (10), rules-facts-depth-binding (8), corner-driven-conformance-binding (7), restart-designation-binding (8), rules-suite-state-rerun-binding (9), SUITE-DETERMINISTIC-TWO-RUN-binding (7): **173/173 PASS**. This proves the dead-variable removal and the comment changes are verdict-inert (the enforced falsifier semantics are unchanged).
- **GK families + registry/provenance/hygiene (18 files)** — goalkeepers-suite (24), gk-oracle (16), GK-KEEPER-ORACLE-REGISTRATION-binding (5), GK-SUITE-ORGANIC-STATE-binding (8), GK-SUITE-VERDICTS-STATE-binding (11), GK-SUITE-CORE-OWNED-STATE-binding (11), GK-CORE-OWNED-ARC-FIX-guard (6), GK-GOALLINE-BOUNDS-RESIDUAL-guard (7), eval-registry (48), oracle-registry (19), mutant-core (33), foundation-evaluator (36), match-rules-spec-binding (28), candidate-scope (2), evidence-sanity (3), capture-hygiene (3), foundation-lab-evidence-binding (8), foundation-promotion (20): **288/288 PASS** (one non-fatal vitest worker-RPC infra timeout on the ~95s GK-SUITE-CORE-OWNED-STATE reproduction — all 11 tests in that file passed).
- **HUD resize browser test (1 file)** — hud-ortho-resize.browser.test.ts: **3/3 PASS** (frustum re-anchor 800×600 → 1200×800; canvas follows container + HUD rendered at top-left; null HUD camera when HUD disabled).
- **Render-sensitive browser batteries (18 files)** — **55/55 PASS** (see commands table). Confirms the presentation-layer change is draw-only and does not regress any render/capture test.

### integration_test_result

For `BOOKKEEPING`, the audit marks the integration-test check `NOT_APPLICABLE` (integration evidence is required only for `MULTI_TICK`/`DYNAMIC_VISUAL`). A relevant determinism/stateHash gate was still exercised: the rules gate and the GK/stateHash pin batteries re-ran green, confirming the oracle semantics are byte-identical post-cleanup; the render-sensitive browser batteries re-ran green, confirming the presentation change is draw-only.

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing.

### required_evidence

- Deterministic audit: `docs/evidence/EVAL-HYGIENE-CONSOLIDATION/audit.json` (status `PASS`).
- Durable record: `docs/evidence/EVAL-HYGIENE-CONSOLIDATION/eval-hygiene-consolidation.json` (`record_sha256` `30d933e2…`; byte-reproducible; no wall-clock field in hashed content).
- Executed tests (BOOKKEEPING): the rules gate, the GK/stateHash pins, the registry/provenance/hygiene battery, the render-sensitive browser batteries, the HUD resize guard, and typecheck 0.

### artifacts

- `docs/evidence/EVAL-HYGIENE-CONSOLIDATION/eval-hygiene-consolidation.json`
- `docs/evidence/EVAL-HYGIENE-CONSOLIDATION/audit.json`
- `docs/evidence/EVAL-HYGIENE-CONSOLIDATION/RESULT.md`
- `scripts/capture-eval-hygiene-consolidation.ts`
- `tests/browser/hud-ortho-resize.browser.test.ts`

### spec_sections

- `specs/MATCH_RULES_SPEC.md` §12 rule 2 (nearest-only chase; the clump-count enforced falsifier in `checkRestartNearestOnly`).
- `eval/runners/headless-match.ts` (`serializeRestartFacts` designation serialization; the conservative mirror-offset pairing).
- `src/adapters/input-browser/goalkeeper-role.ts` (the `_keeperPressExclusions` diagnostics counter) and `src/adapters/input-browser/team-decision-profile.ts` (`designatePresser` → `noteKeeperPressExclusion`).
- `src/adapters/renderer-three/renderer.ts` (opt-in match-phase HUD ortho camera + sprite; `PresentationSession`).
- `gauntlet/evidence-contract.md` (BOOKKEEPING), `gauntlet/roles/builder-structured.md` (role contract).

### acceptance_criteria_met

- **Dead variable removed:** `checkRestartNearestOnly` no longer computes an unused `chasers` Set; the enforced falsifier (clump count) is unchanged and documented.
- **Mirror-offset disclosure:** the designation comment now states the exact adapter-phase vs post-step-ball-reference pairing and its conservative (can-only-shorten/false-fail, never-fabricate-PASS) nature.
- **Counter hygiene documented:** the gated-run/counter-read interaction is documented in `goalkeeper-role.ts` (and cross-referenced at the `assignChaseRoles` call in `headless-match.ts`); documented as diagnostics-counter-only, never a gameplay value.
- **HUD resize re-anchoring:** the opt-in HUD ortho camera + sprite re-anchor on container resize (plus the renderer canvas + main camera aspect). Presentation-only and draw-only; a browser-test guard verifies the re-anchor, the canvas follows the container, the HUD renders at the top-left, and a non-HUD session returns null.
- **Zero verdict changes:** the rules gate (173/173) and GK/stateHash pins re-ran green; the dead variable was unread, the mirror-offset change is a comment, and the counter-hygiene change is documentation-only. The HUD change is presentation-only at resize.
- **Record byte-reproducibility:** `record_sha256` `30d933e2…` with NO wall-clock field in the hashed content; two consecutive ordinary-mode runs byte-identical; an ordinary-mode run leaves `docs/` byte-identical (docs/evidence hash unchanged).
- **Durable evidence:** written via the `WIP_SECTION=__EVIDENCE__:EVAL-HYGIENE-CONSOLIDATION` gate; scratch output under the ignored `test-results/`.
- Batteries green (rules gate, GK/stateHash pins, registry/provenance/hygiene, render-sensitive browser batteries, HUD resize guard); `mise run typecheck` exit 0; `gauntlet:audit` status PASS.

---

## Per-cleanup consolidation

| # | Cleanup | File(s) | Guard | Verdict change |
|---|---|---|---|---|
| 1 | Dead `chasers` variable dropped | `eval/oracles/rules-restart.ts` | Rules gate stays green (173/173) | none |
| 2 | Mirror-offset disclosure tightened | `eval/runners/headless-match.ts` | Comment-only; rules gate stays green | none |
| 3 | `_keeperPressExclusions` counter hygiene documented | `src/adapters/input-browser/goalkeeper-role.ts`, `eval/runners/headless-match.ts` | Documentation-only (no test) | none |
| 4 | HUD ortho camera resize re-anchoring | `src/adapters/renderer-three/renderer.ts`, `tests/browser/hud-ortho-resize.browser.test.ts` | Browser-test guard (3 tests) | none (presentation-only, draw-only) |

The `_keeperPressExclusions` hygiene is **documentation-only**, chosen over isolation because: (a) it is a diagnostics counter, not a gameplay value; (b) isolating it would require either restoring the counter (clobbering the legitimate per-tick adapter increments via the all-counters `resetKeeperMechanismCounters()`) or duplicating the `designatePresser` logic (risking divergence from the shared production source); (c) the note explicitly allows a documentation-only path and it is the lowest-risk, zero-behavior-change choice.

## Provenance / reproduction

The record is regenerated by:

```
WIP_SECTION=__EVIDENCE__:EVAL-HYGIENE-CONSOLIDATION \
  mise exec -- pnpm exec tsx scripts/capture-eval-hygiene-consolidation.ts
```

The producer performs deterministic source-level presence checks for each cleanup (dead variable absent, mirror-offset + counter-hygiene comments present, ResizeObserver + handleResize present) and pins the SHA-256 of every touched source file. It carries no wall-clock field, so consecutive ordinary-mode runs are byte-identical and leave `docs/` byte-identical.

## known_gaps

- The full browser project was not run end-to-end; the render-sensitive/capture batteries (18 files, 55 tests) were run as the representative render guard. The presentation change is confined to a container-resize handler that is idempotent at the initial size, so it cannot alter an existing fixed-size capture.
- The `GK-SUITE-CORE-OWNED-STATE-binding` reproduction surfaced the known non-fatal vitest worker-RPC infra timeout (`Timeout calling "onTaskUpdate"`), the same reporting artifact documented in the accepted GK-SUITE-CORE-OWNED-STATE / RESTART-DESIGNATION records; every test file passed.
- The counter-hygiene item is documentation-only; no new test guards it (per the note's allowance). The risk it addresses (a gated designation run inflating `_keeperPressExclusions`) is disclosed in the code so a future consumer resets the counters between runs.

## claims_not_made

- Zero verdict changes: every oracle check's semantics are byte-identical post-cleanup (the dead variable was unread; the mirror-offset change is a comment; the counter-hygiene change is documentation-only). The HUD re-anchoring changes only presentation at resize.
- No suite-level PASS claim.
- No PROMOTION claim.
- No FOUNDATION_LAB_PASS claim.
- No PES 2017 fidelity / measured PES envelope claim.
- No invented reference envelope or tolerance; blocked references stay BLOCKED_MISSING_REFERENCE.
- No accepted evidence record mutation: all prior `docs/evidence/<id>/` records stay byte-untouched (verified — the ordinary-mode runs leave `docs/` byte-identical).
- No core/simulation/contracts change: `src/simulation/`, `src/contracts/` are untouched; the renderer change is presentation-layer.
