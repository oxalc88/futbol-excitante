# FULLTIME-FLOW-CLOSURE — builder result

## Builder report

- **objective_id:** FULLTIME-FLOW-CLOSURE
- **builder_agent:** builder-gameplay
- **builder_model:** deepseek-v4-flash (qwen3.8-flash quota-exhausted reroute, established session precedent)
- **evidence_class:** DYNAMIC_VISUAL
- **hypothesis:** The full-match lifecycle is already VISIBLE in the real browser (BROWSER-FULL-MATCH-FLOW-EVIDENCE, the opt-in match-phase HUD), but what happens AFTER fulltime is a dead end: the real-time game loop keeps stepping the simulation past fulltime (no freeze), and there is no rematch or fulltime-gated menu affordance (only an always-on generic BACK TO MENU button). This objective closes the playable loop with a minimal presentation-layer flow: at the core-owned `fulltime` terminal state the loop freezes and a presentation-layer affordance offers REMATCH (through the composition-root match-start path) and BACK TO MENU. **Zero `src/simulation/` and zero `src/contracts/` change; draw-only; no football-outcome change; the in-play human controls are untouched.**

### What the investigation found (what exists at fulltime today)

- **Core:** `src/simulation/loop/simulation.ts` transitions to the terminal `matchPhase = "fulltime"` on the half-2 literal 1→0 timer zero-crossing (§11). The timer stays at 0 and there are no further transitions. This is accepted machinery (`match-rules-v1`).
- **Composition root (`src/apps/browser/main.ts`):** the real-time `gameLoop` kept running after fulltime — `sim.step()` was still called every animation frame, so the players/ball kept moving in a post-fulltime non-gaming state. The DOM scoreboard clock kept counting upward (tick-derived) and the transient "FULL TIME" overlay faded after ~1s. The core-owned `matchPhase` + `matchTimer` were only rendered by the opt-in renderer HUD (`showMatchPhaseHud`), which is on.
- **Affordance:** the shipped app had an always-on `#back-to-menu` DOM button (visible throughout the match) that returned to the setup menu via `stopMatch()` + `showSetupMenu()`. There was **no rematch** affordance; there was **no fulltime-gated** menu affordance; and the terminal state was a **dead end** (the loop kept simulating past fulltime).

### What was added

- **`src/adapters/renderer-three/renderer.ts`** (presentation layer only, ADDITIVE): a new opt-in `RendererConfig.showFulltimeFlowHud` (default `false`). When enabled AND `snapshot.matchPhase === "fulltime"`, the match-phase HUD canvas additionally draws `[R] REMATCH  [M] MENU`. Default `false` keeps every non-opted-in render byte-identical (verified by the keeper-visual-marker parity guard, unenriched SHA `05e40d01…` unchanged).
- **`src/apps/browser/fulltime-flow.ts`** (NEW, presentation layer): a testable module that owns the fulltime DOM panel (a clickable REMATCH / BACK TO MENU card), the `M`/`R` keyboard dispatcher, and the `isFulltime()` guard. The affordance is only live after `markFulltime`, so the in-play controls (WASD / Tab / pass / shot / tackles) are never intercepted.
- **`src/apps/browser/main.ts`** (composition root): stores `lastMatchConfig`; wires `onRematch` → `startMatch(scenario, urlMode, teamALabel, teamBLabel, controlsHint, difficulty)` (the existing composition-root match-start path over a fresh simulation) and `onBackToMenu` → `stopMatch()` + `showSetupMenu()`; freezes the loop at fulltime (`fulltimeFlow.markFulltime(...)` then `matchRunning = false`, no further frame scheduled); enables `showFulltimeFlowHud: true`; dispatches `M`/`R` only via the active flow. The panel is hidden on new-match / menu-return.

### files_changed

- `src/adapters/renderer-three/renderer.ts` (presentation layer only — ADDITIVE `showFulltimeFlowHud`; HUD canvas is `showFulltimeFlowHud ? 192 : 128`, so the default HUD is byte-identical to the baseline).
- `src/apps/browser/main.ts` (composition root — flow wiring + loop freeze + keyboard; no control change during play).
- `src/apps/browser/fulltime-flow.ts` (NEW — testable end-of-match flow module).
- `tests/browser/fulltime-flow-closure.browser.test.ts` (NEW — 7 tests: affordance module; DOM panel dispatch; DYNAMIC_VISUAL canvas capture; non-blank; menu-return clean state; composition-root wiring guard; browser↔headless fulltime correspondence).
- `scripts/capture-fulltime-flow-closure.ts` (NEW — byte-reproducible record + MULTI_TICK trajectory producer; WIP_SECTION-gated; no wall-clock in the hashed content).
- `scripts/capture-fulltime-flow-closure-menu.mts` (NEW — dev-server Playwright script that element-captures the REAL shipped `#setup-menu-card` surface (Difficulty row + full 9-option mode ladder) after exercising the shipped `#back-to-menu` menu-return path; taken by the user-visible/temporal-criterion evidence steps, so `menu-return` is NOT a rebuilt lookalike).
- `tests/capture-hygiene.node.test.ts` (added `fulltime-flow-closure.browser.test.ts` to the durable-screenshot writer gate list).
- `docs/screenshots/FULLTIME-FLOW-CLOSURE/` (NEW — 3 WebGL canvas PNGs + the real shipped `menu-return` DOM capture + `sequence.json` carrying `pngSha256` per frame).
- `docs/evidence/FULLTIME-FLOW-CLOSURE/` (NEW — `fulltime-flow-closure-state.json` record + `trajectory.json` + `audit.json` + this `RESULT.md`).

**Zero change to `src/simulation/`, `src/contracts/`, `src/adapters/input-browser/`, `specs/`, `eval/`, or any accepted evidence directory** (verified by `git diff --stat -- src/simulation/` = EMPTY, `src/contracts/` = EMPTY).

### commands_run

- cmd: `mise exec -- pnpm run typecheck`
    exit_code: 0
    result: "tsc core + node + browser all clean (0 errors)"
- cmd: `pnpm exec vitest run tests/browser/fulltime-flow-closure.browser.test.ts --project browser` (ordinary mode, runs 1-2)
    exit_code: 0
    result: "7/7 PASS (affordance module; DOM panel dispatch; DYNAMIC_VISUAL capture; non-blank variance; menu-return clean state; composition-root wiring guard; browser↔headless fulltime correspondence)"
- cmd: `mise exec -- pnpm exec tsx scripts/capture-fulltime-flow-closure-menu.mts` (ordinary mode runs 1 and 2) then `mise exec -- pnpm exec tsx scripts/capture-fulltime-flow-closure.ts` (ordinary mode runs 1 and 2)
    exit_code: 0
    result: "menu script element-captured the real shipped #setup-menu-card (modes=9, difficulty=true, sha256=ba9d44731e4dc0cee05ec71da94363b3b53a509fc1dd1e32a8de98e2c1c2f2ce) and appended the menu-return frame to the ephemeral sequence.json; record_sha256=8f58216742d1cb6806e729f339730a1668191256d9c46e6f2fba131fdf459cb2 on BOTH runs (byte-reproducible); docs/evidence/FULLTIME-FLOW-CLOSURE untouched by ordinary mode (docs byte-identical)"
- cmd: `WIP_SECTION=__EVIDENCE__:FULLTIME-FLOW-CLOSURE pnpm exec vitest run tests/browser/fulltime-flow-closure.browser.test.ts --project browser`
    exit_code: 0
    result: "7/7 PASS; 3 WebGL canvas PNGs + sequence.json (canvas-frame subset) written to docs/screenshots/FULLTIME-FLOW-CLOSURE/"
- cmd: `WIP_SECTION=__EVIDENCE__:FULLTIME-FLOW-CLOSURE mise exec -- pnpm exec tsx scripts/capture-fulltime-flow-closure-menu.mts` then `WIP_SECTION=__EVIDENCE__:FULLTIME-FLOW-CLOSURE mise exec -- pnpm exec tsx scripts/capture-fulltime-flow-closure.ts`
    exit_code: 0
    result: "the menu script appended the real shipped menu-return frame (4 unique pngSha256 total); wrote docs/evidence/FULLTIME-FLOW-CLOSURE/fulltime-flow-closure-state.json + trajectory.json (record_sha256=8f58216742d1cb6806e729f339730a1668191256d9c46e6f2fba131fdf459cb2 (ordinary==durable); phase_sequence_matches=true; fulltime_tick=660, fulltime_frame_tick=660; new-match-start matchTimer=240)"
- cmd: `pnpm exec vitest run tests/browser/{ladder-menu-parity,hud-ortho-resize,keeper-visual-marker,browser-full-match-flow-evidence}.browser.test.ts --project browser`
    exit_code: 0
    result: "19/19 PASS (ladder-menu-parity 9/9 — NO menu DOM change; hud-ortho-resize 3/3; keeper-visual-marker 4/4 — unenriched SHA 05e40d01… == pre-change baseline, so the renderer change is byte-neutral when showMatchPhaseHud is false; browser-full-match-flow-evidence 3/3 — the full-match HUD frames are unchanged)"
- cmd: `pnpm exec vitest run tests/browser/{archetype-render-difference,small-sided-001,small-sided-action-event-observability}.browser.test.ts --project browser`
    exit_code: 0
    result: "24/24 PASS (render-sensitive neighbor battery green)"
- cmd: `pnpm exec vitest run tests/{capture-hygiene,candidate-scope,evidence-sanity}.node.test.ts --project node`
    exit_code: 0
    result: "8/8 PASS (capture-hygiene gate, candidate-scope isolation, blank-screenshot determinism all reproduce)"
- cmd: `mise exec -- pnpm run gauntlet:audit -- --objective FULLTIME-FLOW-CLOSURE --class DYNAMIC_VISUAL --tests-pass true --integration-test-pass true`
    exit_code: 0
    result: "status PASS (see docs/evidence/FULLTIME-FLOW-CLOSURE/audit.json; evidence_class DYNAMIC_VISUAL; semantic visual sequence PASS; required trajectory PASS; screenshot SHA uniqueness PASS)"

### tests_run

- name: `fulltime-flow-closure.browser.test.ts`
    result: "PASS (7 tests — min. 3 required: affordance module gate; DOM panel dispatch; DYNAMIC_VISUAL capture of 3 WebGL canvas frames + sequence.json (the real menu-return frame is added by the dev-server menu script); non-blank variance; menu-return clean state; composition-root wiring guard; browser↔headless fulltime correspondence)"
- name: `ladder-menu-parity.browser.test.ts`
    result: "PASS (9 tests — the setup-menu DOM is unchanged; the fulltime panel is a runtime-created overlay, not menu markup)"
- name: `hud-ortho-resize.browser.test.ts`
    result: "PASS (3 tests)"
- name: `keeper-visual-marker.browser.test.ts`
    result: "PASS (4 tests — the keeperRole-absent render is byte-identical to the pre-change baseline 05e40d01…, so the renderer HUD change is byte-neutral when not opted in)"
- name: `browser-full-match-flow-evidence.browser.test.ts`
    result: "PASS (3 tests — the accepted full-match HUD frames are unchanged by the additive fulltime line)"
- name: `archetype-render-difference / small-sided-001 / small-sided-action-event-observability`
    result: "PASS (24 tests — render-sensitive neighbor battery)"
- name: `capture-hygiene / candidate-scope / evidence-sanity`
    result: "PASS (8 tests — capture-hygiene gate, candidate-scope isolation, blank-screenshot determinism)"

### integration_test_result

DYNAMIC_VISUAL requires a relevant integration-test pass. The browser test's correspondence test runs the accepted headless timing stream (`runHeadlessMatch` with `lifecyclePhaseSync:"core-owned"`, `browserParityObservations:true`, `serializeRestartFacts:true`) and asserts the browser composition root traverses the same lifecycle phase order (`playing → … → halftime → … → fulltime`, `phase_sequence_matches=true`) and that the browser's fulltime is a genuine timer-driven zero-crossing in half 2 (the fulltime tick exceeds the half duration in wall ticks because restart windows freeze the in-play timer). The frames are captured through the real-Chromium composition root, so the browser-visible + temporal fulltime-flow closure claim is evidenced at DYNAMIC_VISUAL.

### slot_wiring_result

NOT_APPLICABLE — the objective does not depend on slot/player ownership or routing; no `--requires-slot-wiring` was passed.

### required_evidence

- Durable record: `docs/evidence/FULLTIME-FLOW-CLOSURE/fulltime-flow-closure-state.json` (`record_sha256` 8f582167…; byte-reproducible; no wall-clock field in the hashed content).
- Durable trajectory: `docs/evidence/FULLTIME-FLOW-CLOSURE/trajectory.json` (MULTI_TICK prerequisite of DYNAMIC_VISUAL; frame anchors + headless timing-stream transitions).
- Deterministic audit: `docs/evidence/FULLTIME-FLOW-CLOSURE/audit.json` (status `PASS`, evidence_class DYNAMIC_VISUAL).
- DYNAMIC_VISUAL semantic frames: `docs/screenshots/FULLTIME-FLOW-CLOSURE/{fulltime-terminal,fulltime-affordance,menu-return,new-match-start}.png` + `sequence.json` (4 frames, every frame carries `path` + `pngSha256`).
- Executed tests (DYNAMIC_VISUAL): the 7-test browser capture, the menu-parity + HUD + keeper-marker + full-match-flow suites (19), the render-sensitive neighbor battery (24), the capture-hygiene / candidate-scope / evidence-sanity gate (8), and `typecheck` 0.

### artifacts

- `docs/evidence/FULLTIME-FLOW-CLOSURE/fulltime-flow-closure-state.json` / `trajectory.json` / `RESULT.md` / `audit.json`
- `docs/screenshots/FULLTIME-FLOW-CLOSURE/*.png` + `sequence.json`
- `scripts/capture-fulltime-flow-closure.ts`
- `scripts/capture-fulltime-flow-closure-menu.mts` (real shipped `#setup-menu` menu-return capture)
- `tests/browser/fulltime-flow-closure.browser.test.ts`
- `src/apps/browser/fulltime-flow.ts`, `src/apps/browser/main.ts` (composition-root flow), `src/adapters/renderer-three/renderer.ts` (opt-in HUD affordance)

### spec_sections

- `specs/MATCH_RULES_SPEC.md` §9 (lifecycle model), §11 (the timer-driven halftime/fulltime zero-crossings; the fulltime terminal state).
- `src/contracts/presentation.ts` (`PresentationSnapshot.matchPhase` + `matchTimer` — the immutable snapshot the HUD reads).
- `src/contracts/state.ts` (`MatchPhase` union; `matchPhase` / `matchTimer` semantics; the terminal `fulltime`).
- `gauntlet/evidence-contract.md` (MULTI_TICK / DYNAMIC_VISUAL), `gauntlet/roles/builder-gameplay.md` (role contract).

### acceptance_criteria_met

- **Investigated and disclosed the post-fulltime state.** The real app froze nothing and had no rematch / fulltime-gated menu affordance (only an always-on BACK TO MENU); documented above.
- **Added the minimal presentation-layer flow.** At the core-owned `fulltime` terminal state the loop freezes (no further `sim.step()`), and a REMATCH (via the composition-root `startMatch` path) / BACK TO MENU affordance is offered.
- **DYNAMIC_VISUAL 4-frame event-centered sequence.** `fulltime-terminal` (before — the pre-flow terminal HUD, no affordance) → `fulltime-affordance` (event — `[R] REMATCH  [M] MENU` drawn on the HUD) → `menu-return` (transition — the REAL shipped `#setup-menu` surface: the Difficulty row + the full 9-option mode ladder) → `new-match-start` (result — a fresh match through the composition-root start path). 4 unique PNG-byte SHA-256s (CORNER-DRIVEN lesson: distinctness on captured bytes, not state hashes).
- **Menu return leaves a clean state + a new match starts.** The menu-return path dismisses the fulltime affordance and lands on the setup menu; a fresh match is then startable (verified by test + the `new-match-start` frame).
- **No core / contracts change; presentation layer only.** `git diff --stat -- src/simulation/` = EMPTY, `src/contracts/` = EMPTY. No football-outcome change (draw-only, reads the immutable snapshot).
- **Human in-play controls untouched.** The M/R keys are dispatched only by the active fulltime flow (`handleKeydown` returns false otherwise), so WASD / Tab / pass / shot / tackles are never intercepted. The renderer affordance is a no-op unless `showFulltimeFlowHud` is on.
- **Byte-reproducible record.** `record_sha256` 8f582167…; no wall-clock field and no PNG bytes in the hashed content; record_sha256 is identical in ordinary and durable mode, and two consecutive ordinary-mode runs are byte-identical (the WIP_SECTION gate keeps `docs/` byte-identical on ordinary runs).
- **Audit PASS at the strictest named class.** `gauntlet:audit --class DYNAMIC_VISUAL --tests-pass true --integration-test-pass true` → status `PASS`; the semantic visual sequence check PASSes; every frame entry carries a `path`.

## Provenance / reproduction

```
# 1. Ordinary-mode capture (writes only to ignored test-results/gauntlet-capture/**):
pnpm exec vitest run tests/browser/fulltime-flow-closure.browser.test.ts --project browser
mise exec -- pnpm exec tsx scripts/capture-fulltime-flow-closure-menu.mts
# 2. Ordinary-mode record producer (byte-reproducible; docs/ untouched):
mise exec -- pnpm exec tsx scripts/capture-fulltime-flow-closure.ts
# 3. Durable evidence:
WIP_SECTION=__EVIDENCE__:FULLTIME-FLOW-CLOSURE \
  pnpm exec vitest run tests/browser/fulltime-flow-closure.browser.test.ts --project browser
WIP_SECTION=__EVIDENCE__:FULLTIME-FLOW-CLOSURE \
  mise exec -- pnpm exec tsx scripts/capture-fulltime-flow-closure-menu.mts
WIP_SECTION=__EVIDENCE__:FULLTIME-FLOW-CLOSURE \
  mise exec -- pnpm exec tsx scripts/capture-fulltime-flow-closure.ts
```

## known_gaps

- **Fixture-driven, not organic.** The 240-tick-half scenario is a DRIVEN fixture chosen so the full lifecycle completes inside the browser test budget; no organic 90-minute-flow claim is made.
- **The `menu-return` frame is a DOM capture of the REAL shipped `#setup-menu` surface.** It is captured by the dev-server Playwright script (`scripts/capture-fulltime-flow-closure-menu.mts`, which element-captures the shipped `#setup-menu-card` after exercising the shipped `#back-to-menu` menu-return path: the Difficulty row + the full 9-option mode ladder are present) rather than a WebGL canvas capture — it is a real shipped surface, NOT a rebuilt lookalike.  Its PNG bytes are intentionally NOT embedded in the record (so the record stays byte-reproducible) and live only in `sequence.json`.
- **The browser↔headless 1-tick offset (browser EARLIER).** The browser reaches the terminal `fulltime` ONE TICK EARLIER than the headless runner (browser 660 vs headless 661), not later: the headless timing stream seeds an extra `kickoff` tick at tick 0 that does not decrement the in-play timer.  The browser test records the frame at its own committed tick (`fulltime_frame_tick` = 660) and the node sim's browser-equivalent wiring reaches the same fulltime state at the same committed tick (`fulltime_tick` = 660), so the frame tick and the recorded state facts are consistent.  The offset is wholly between the browser composition root (660) and the headless runner (661); no per-tick browser/headless hash-identity claim.
- **The element-scoped menu PNG is not byte-reproducible across runs** (DOM font/harness rendering), but the RECORD does not embed it, so `record_sha256` stays byte-reproducible.

## claims_not_made

- No PES 2017 fidelity / measured PES envelope claim.
- No FOUNDATION_LAB_PASS claim.
- No suite-level PASS claim.
- No claim that this is an organic 90-minute match (it is a DRIVEN short-duration fixture; disclosed).
- No per-tick browser/headless state-hash identity claim (the known pinned-runtime gap and the 1-tick offset are disclosed instead).
- No claim that the rematch is a literal core change: it re-enters the composition-root `startMatch` path over a fresh simulation; the core's `fulltime` phase is accepted machinery.
- No invented reference envelope or tolerance.
- No football-outcome change claim beyond the presentation surface: `git diff --stat -- src/simulation/` is EMPTY and `src/contracts/` is EMPTY; only the opt-in renderer HUD cue + the composition-root flow were added.
