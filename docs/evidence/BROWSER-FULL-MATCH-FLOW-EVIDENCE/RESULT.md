# BROWSER-FULL-MATCH-FLOW-EVIDENCE — builder result

## Builder report

- **objective_id:** BROWSER-FULL-MATCH-FLOW-EVIDENCE
- **builder_agent:** builder-gameplay
- **builder_model:** deepseek-v4-flash (qwen3.8-flash quota-exhausted reroute, established session precedent)
- **evidence_class:** DYNAMIC_VISUAL
- **hypothesis:** The accepted core timer/lifecycle machinery (already executed-under-test on the driven `5v5-full-match-timing-v1` fixture) can be made the browser-visible observable capability: drive a real-Chromium match through kickoff → first half → the halftime break countdown → second half → the fulltime terminal state, and capture event-centered DYNAMIC_VISUAL frames whose HUD label reads the core-owned `matchPhase` + `matchTimer` from the immutable `PresentationSnapshot`. The previously-existing HUD (a tick-derived elapsed clock + "1ST"/"2ND" indicator and a transient HALF TIME / FULL TIME overlay) did NOT distinguish the halftime-break countdown or the fulltime terminal state, so a minimal opt-in renderer HUD label was added. **Zero `src/simulation/` change; no football-outcome change; human control behavior untouched.**

### What the HUD showed before / after

- **Before (existing HUD):** The DOM scoreboard showed an elapsed `MM:SS` clock derived from `sim.tick * FIXED_DT` and a "1ST"/"2ND" half indicator derived from `sim.tick < HALF_DURATION_TICKS`. Both are tick-derived, not core-owned. During the halftime break the indicator already read "2ND" and the clock kept counting upward; at fulltime the indicator still read "2ND" and the clock kept counting upward past the match duration. The transient HALF TIME / FULL TIME overlay faded after ~1s and was never a persistent, core-owned surface. So the halftime-break countdown and the fulltime terminal state were **not distinguishable** in the UI.
- **After:** A minimal, opt-in renderer screen-space label (`RendererConfig.showMatchPhaseHud`, default `false`) renders the immutable snapshot's `matchPhase` + `matchTimer` in the top-left. Enabled in the real app (`src/apps/browser/main.ts`). The frames now read: `PLAYING / TIME 240` (kickoff), `PLAYING / TIME 1` (first-half late), `HALF TIME / TIME 30` (halftime break countdown visibly ticking), `PLAYING / TIME 220` (second half resumed), `FULL TIME / TIME 0` (terminal). Because `showMatchPhaseHud` default is `false`, every render that does not opt in is byte-identical to the pre-HUD baseline (the keeper-visual-marker `PRE_CHANGE_BASELINE_SHA` is reproduced exactly).

### files_changed

- `src/adapters/renderer-three/renderer.ts` (presentation layer only — ADDITIVE: `showMatchPhaseHud` opt-in config + a screen-space `matchPhase`/`matchTimer` HUD sprite reading the immutable snapshot; default `false`).
- `src/apps/browser/main.ts` (presentation/composition layer only — enables `showMatchPhaseHud: true` in the real app; draw-only, no control change).
- `scripts/capture-browser-full-match-flow-evidence.ts` (NEW — byte-reproducible record + MULTI_TICK trajectory producer; WIP_SECTION-gated; no wall-clock in hashed content).
- `tests/browser/browser-full-match-flow-evidence.browser.test.ts` (NEW — 3 tests: 5 event-centered frames + HUD label; browser↔headless lifecycle correspondence; non-blank variance. Writes sequence.json with path bindings in evidence mode).
- `docs/screenshots/BROWSER-FULL-MATCH-FLOW-EVIDENCE/` (NEW — 5 event-centered PNGs + sequence.json every frame carrying a `path`).
- `docs/evidence/BROWSER-FULL-MATCH-FLOW-EVIDENCE/` (NEW — `browser-full-match-flow-state.json` record + `trajectory.json` + `audit.json` + this RESULT.md).

**Zero change to `src/simulation/`, `src/contracts/`, `src/adapters/input-browser/`, `specs/`, `eval/`, or any accepted evidence directory** (verified by `git diff --stat -- src/simulation/` = EMPTY, `src/contracts/` = EMPTY).

### commands_run

- cmd: `mise exec -- pnpm run typecheck`
    exit_code: 0
    result: "tsc core + node + browser all clean (0 errors)"
- cmd: `pnpm exec vitest run tests/browser/browser-full-match-flow-evidence.browser.test.ts --project browser` (ordinary mode, runs 1-2)
    exit_code: 0
    result: "3/3 PASS (5 event-centered frames + HUD label; browser↔headless lifecycle correspondence; non-blank variance); frames kickoff=0 firstHalfLate=299 halftimeBreak=330 secondHalfKickoff=360/380 fulltime=660"
- cmd: `mise exec -- pnpm exec tsx scripts/capture-browser-full-match-flow-evidence.ts` (ordinary mode runs 1 and 2)
    exit_code: 0
    result: "record_sha256=d02a8fa6de7b2daaa5d9360b27cbb8b36e8c0c5920a25cf14b4a00192cf403ba on BOTH runs (byte-reproducible); docs/evidence/BROWSER-FULL-MATCH-FLOW-EVIDENCE untouched by ordinary mode (docs byte-identical)"
- cmd: `WIP_SECTION=__EVIDENCE__:BROWSER-FULL-MATCH-FLOW-EVIDENCE pnpm exec vitest run tests/browser/browser-full-match-flow-evidence.browser.test.ts --project browser`
    exit_code: 0
    result: "3/3 PASS; 5 event-centered PNGs + sequence.json written to docs/screenshots/BROWSER-FULL-MATCH-FLOW-EVIDENCE/"
- cmd: `WIP_SECTION=__EVIDENCE__:BROWSER-FULL-MATCH-FLOW-EVIDENCE mise exec -- pnpm exec tsx scripts/capture-browser-full-match-flow-evidence.ts`
    exit_code: 0
    result: "wrote docs/evidence/BROWSER-FULL-MATCH-FLOW-EVIDENCE/browser-full-match-flow-state.json + trajectory.json (record_sha256=d02a8fa6…; phase_sequence_matches=true)"
- cmd: `mise exec -- pnpm run gauntlet:audit -- --objective BROWSER-FULL-MATCH-FLOW-EVIDENCE --class DYNAMIC_VISUAL --tests-pass true --integration-test-pass true`
    exit_code: 0
    result: "status PASS (see docs/evidence/BROWSER-FULL-MATCH-FLOW-EVIDENCE/audit.json; evidence_class DYNAMIC_VISUAL; semantic visual sequence PASS; required trajectory PASS; screenshot SHA uniqueness PASS)"
- cmd: `pnpm exec vitest run tests/browser/keeper-visual-marker.browser.test.ts --project browser`
    exit_code: 0
    result: "4/4 PASS; parity guard unenriched SHA 05e40d01… == PRE_CHANGE_BASELINE_SHA (renderer change is byte-neutral when showMatchPhaseHud is false)"
- cmd: `pnpm exec vitest run tests/browser/{archetype-render-difference,small-sided-001,small-sided-action-event-observability}.browser.test.ts --project browser`
    exit_code: 0
    result: "24/24 PASS (render-sensitive neighbor battery green)"
- cmd: `pnpm exec vitest run tests/{candidate-scope,capture-hygiene,evidence-sanity}.node.test.ts --project node`
    exit_code: 0
    result: "8/8 PASS (capture-hygiene gate, candidate-scope isolation, blank-screenshot determinism all reproduce)"

### tests_run

- name: `browser-full-match-flow-evidence.browser.test.ts`
    result: "PASS (3 tests — 5 event-centered frames + HUD label with distinct state hashes; browser↔headless lifecycle correspondence (phase_sequence_matches=true); non-blank luminance/colour variance check)"
- name: `keeper-visual-marker.browser.test.ts`
    result: "PASS (4 tests — the keeperRole-absent render is byte-identical to the pre-change baseline 05e40d01…; the renderer HUD change is byte-neutral when not opted in)"
- name: `archetype-render-difference / small-sided-001 / small-sided-action-event-observability`
    result: "PASS (24 tests — render-sensitive neighbor battery)"
- name: `candidate-scope / capture-hygiene / evidence-sanity`
    result: "PASS (8 tests — capture-hygiene gate, candidate-scope isolation, blank-screenshot determinism)"

### integration_test_result

DYNAMIC_VISUAL requires a relevant integration-test pass. The browser test's correspondence test runs the accepted headless timing stream (`runHeadlessMatch` with `lifecyclePhaseSync:"core-owned"`, `browserParityObservations:true`, `serializeRestartFacts:true`) and asserts the browser composition root traverses the same lifecycle phase sequence (`playing → … → halftime → … → fulltime`, `phase_sequence_matches=true`). The frames are captured through the real-Chromium composition root (real-app, Playwright/Chromium), so the browser-visible + temporal full-match lifecycle claim is evidenced at DYNAMIC_VISUAL.

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing; no `--requires-slot-wiring` was passed.

### required_evidence

- Durable trajectory: `docs/evidence/BROWSER-FULL-MATCH-FLOW-EVIDENCE/trajectory.json` (MULTI_TICK prerequisite of DYNAMIC_VISUAL; frame anchors + headless timing-stream transitions).
- Durable record: `docs/evidence/BROWSER-FULL-MATCH-FLOW-EVIDENCE/browser-full-match-flow-state.json` (`record_sha256` d02a8fa6…; byte-reproducible; no wall-clock field in hashed content).
- Deterministic audit: `docs/evidence/BROWSER-FULL-MATCH-FLOW-EVIDENCE/audit.json` (status `PASS`, evidence_class DYNAMIC_VISUAL).
- DYNAMIC_VISUAL semantic frames: `docs/screenshots/BROWSER-FULL-MATCH-FLOW-EVIDENCE/{kickoff,first-half-late,halftime-break,second-half-kickoff,fulltime}.png` + `sequence.json` (5 frames; every frame carries a `path`).
- Executed tests (DYNAMIC_VISUAL): the 3-test browser capture, the keeper-visual-marker parity guard, the render-sensitive neighbor battery (24), the capture-hygiene / candidate-scope / evidence-sanity gate (8), and `typecheck` 0.

### artifacts

- `docs/evidence/BROWSER-FULL-MATCH-FLOW-EVIDENCE/browser-full-match-flow-state.json` / `trajectory.json` / `RESULT.md` / `audit.json`
- `docs/screenshots/BROWSER-FULL-MATCH-FLOW-EVIDENCE/*.png` + `sequence.json`
- `scripts/capture-browser-full-match-flow-evidence.ts`
- `tests/browser/browser-full-match-flow-evidence.browser.test.ts`
- `src/adapters/renderer-three/renderer.ts` (opt-in HUD label), `src/apps/browser/main.ts` (enables the HUD label)

### spec_sections

- `specs/MATCH_RULES_SPEC.md` §9 (lifecycle model: kickoff/first-half/halftime/second-half/fulltime), §9.4 (the halftime break countdown), §11 (timer freeze/decrement; the in-play timer drives the halftime/fulltime zero-crossings).
- `src/contracts/presentation.ts` (`PresentationSnapshot.matchPhase` + `matchTimer` — the immutable snapshot the HUD label reads).
- `src/contracts/state.ts` (`MatchPhase` union; `matchPhase` / `matchTimer` semantics).
- `docs/evidence/RULES-FACTS-DEPTH-CONFORMANCE/` (the accepted timer-driven halftime/fulltime headless precedent this objective makes browser-visible).
- `gauntlet/evidence-contract.md` (MULTI_TICK / DYNAMIC_VISUAL), `gauntlet/roles/builder-gameplay.md` (role contract).

### acceptance_criteria_met

- **Lifecycle made VISIBLE in the real app.** The HUD now renders the core-owned `matchPhase` + `matchTimer` (opt-in renderer label enabled in `main.ts`). Before, the HUD could not distinguish the halftime-break countdown or the fulltime terminal state (it was a tick-derived elapsed clock + "1ST"/"2ND" + a transient overlay). After, frames read `PLAYING/TIME 240 → PLAYING/TIME 1 → HALF TIME/TIME 30 → PLAYING/TIME 220 → FULL TIME/TIME 0`.
- **Full lifecycle driven in real Chromium.** The driven `5v5-full-match-timing-v1` fixture (240-tick halves) was driven through the real composition root in a browser test: kickoff → first-half-late (timer near 0) → halftime break (countdown visible) → second-half resumption → fulltime terminal. The countdown and fulltime are visible in the HUD.
- **5 event-centered DYNAMIC_VISUAL frames** captured with `sequence.json` where every frame carries its `path` binding (the CORNER-DRIVEN lesson — no hand-patching; the capture source writes the sequence).
- **Browser↔headless correspondence verified honestly.** `phase_sequence_matches=true` (same lifecycle phase order); the headless-runner's opening `kickoff` seed at tick 0 produces a disclosed 1-tick offset (browser halftime tick 300 / fulltime tick 660 vs headless 301 / 661). **No per-tick hash-identity claim** (the composition root and headless differ in CPU-observation shape + kickoff seed); the known pinned-runtime gap is disclosed.
- **Byte-reproducible record:** `record_sha256=d02a8fa6…`; no wall-clock in hashed content; two consecutive ordinary-mode runs byte-identical; ordinary runs leave `docs/` byte-identical (confirms the WIP_SECTION gate).
- **Zero `src/simulation/` change; presentation layer only** (renderer HUD opt-in + main.ts enable); no football-outcome change (draw-only, reads immutable snapshot); human control behavior untouched (`showMatchPhaseHud` default false keeps every non-opted-in render byte-identical, verified by the keeper-visual-marker parity guard).
- **Audit PASS at the strictest named class.** `gauntlet:audit --class DYNAMIC_VISUAL --tests-pass true --integration-test-pass true` → status `PASS`; the semantic visual sequence check PASSes; every frame entry carries a `path`.

## Provenance / reproduction

```
# 1. Ordinary-mode capture (writes only to ignored test-results/gauntlet-capture/**):
pnpm exec vitest run tests/browser/browser-full-match-flow-evidence.browser.test.ts --project browser
# 2. Ordinary-mode record producer (byte-reproducible; docs/ untouched):
mise exec -- pnpm exec tsx scripts/capture-browser-full-match-flow-evidence.ts
# 3. Durable evidence:
WIP_SECTION=__EVIDENCE__:BROWSER-FULL-MATCH-FLOW-EVIDENCE \
  pnpm exec vitest run tests/browser/browser-full-match-flow-evidence.browser.test.ts --project browser
WIP_SECTION=__EVIDENCE__:BROWSER-FULL-MATCH-FLOW-EVIDENCE \
  mise exec -- pnpm exec tsx scripts/capture-browser-full-match-flow-evidence.ts
```

The fixture is the accepted short-duration timing scenario. The core owns every phase; the browser wiring never syncs phases. The record carries no wall-clock field, so consecutive ordinary-mode runs are byte-identical and leave `docs/` byte-identical.

## known_gaps

- **The full-match flow is fixture-driven, not organic.** The 240-tick-half scenario is a DRIVEN fixture chosen so the lifecycle completes inside the browser test budget. This is disclosed, not masked; no organic 90-minute-flow claim is made.
- **Restart windows freeze the in-play timer.** A throw-in (tick 43-102 and tick 386-445 in this run) freezes the timer, so the nominal 240-tick half runs longer in wall ticks. The transition ticks are located from the run's own phase stream, never hand-transcribed.
- **The second-half resumption frame visually resembles the opening kickoff** (both show kickoff homes) because the timer-driven halftime reset re-places every body at its kickoff home — an engine fact. The frame is captured a few ticks in so the resumed half is visibly underway, and the record/frame note discloses this.
- **No per-tick browser/headless hash identity.** The composition root and the headless runner differ (CPU observation shape + the runner's opening kickoff seed), so committed per-tick hashes are not byte-identical across runtimes. The verified correspondence is the lifecycle phase sequence + the timer-driven zero-crossings, with the 1-tick offset disclosed.
- **The headless reproduction uses `browserParityObservations: true`** to match the browser composition root's CPU observation shape (the correspondence the frames verify). The ACCEPTED RULES-FACTS-DEPTH-CONFORMANCE timing stream used the runner's default observation shape, whose first-half throw-in window differs (tick 70-130 vs 43-103 here); both runs land the SAME timer-driven zero-crossing ticks — halftime at 301, fulltime at 661. This is disclosed in the record's `headless_timing_stream.disclosure`.

## claims_not_made

- No PES 2017 fidelity / measured PES envelope claim.
- No FOUNDATION_LAB_PASS claim.
- No suite-level PASS claim.
- No claim that this is an organic 90-minute match (it is a DRIVEN short-duration fixture; disclosed).
- No per-tick browser/headless state-hash identity claim (the known pinned-runtime gap is disclosed instead).
- No invented reference envelope or tolerance.
- No football-outcome change claim beyond the presentation surface: `git diff --stat -- src/simulation/` is EMPTY; only the opt-in renderer HUD label was added.
