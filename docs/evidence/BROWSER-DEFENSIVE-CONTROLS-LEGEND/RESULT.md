# BROWSER-DEFENSIVE-CONTROLS-LEGEND — Evidence Result

## Objective
Surface an in-browser controls legend (setup menu and in-match overlay) documenting the full human control set including the new defensive actions (standing/slide tackle keys beside pass/shot/through-ball/sprint/switch), with a binding/parity guard asserting every documented control has a live binding, and BROWSER_VISIBLE screenshots of the legend and an in-match state. Presentation affordance only — no gameplay change, no invented rubric.

## Evidence Class
BROWSER_VISIBLE

## Result
PASS (candidate) — all acceptance criteria met by executed tests and real-app screenshots. Pre-existing unrelated node-suite failures are disclosed under Known gaps; none touch this objective's files.

## What was built

- **Single source of truth** — `src/contracts/controls-legend.ts` (kept from the interrupted session): 10 `ControlLegendEntry` rows (Move `W A S D`, Sprint `Shift`, First Touch `K`, Pass `J`, Shot `L`, Switch Player `Tab`, Lofted Pass `E + J`, Through Ball `Q + J`, Standing Tackle `U`, Slide Tackle `I`), each carrying its expected action bitmask / binding key for the parity guard.
- **Real-app legend UI module** — `src/apps/browser/controls-legend-ui.ts` (new): `initControlsLegendUi(doc)`, `populateControlsLegendBody(tbody, legend?)`, `closeControlsOverlay(doc)` / `toggleControlsOverlay(doc)`, `setControlsHintText(doc, text)`, and the `CONTROLS_LEGEND_IDS` map. Extracting this from `main.ts` makes the shipped code path importable and testable; `main.ts` now only calls it.
- **Setup-menu legend section** (`#controls-legend-section` → `#controls-legend` → `#controls-legend-body`) and **in-match overlay** (`#controls-overlay` / `#controls-overlay-card` / `#controls-overlay-body` / `#controls-overlay-close`) with a `?` toggle (`#controls-toggle`) in the hint strip; both tables are filled from the contract, so legend content exists in exactly one place.
- **Two real defects found and fixed while making the code path testable**
  1. `startMatch()` assigned `controlsHintEl.textContent`, which destroyed the `#controls-toggle` child as soon as a match started — the overlay was unreachable in the shipped app. The mode-specific hint now lives in its own `#controls-hint-text` node written through `setControlsHintText()`.
  2. `#controls-hint` is `pointer-events: none` (so it never blocks the pitch), which also made the nested toggle unclickable. `#controls-hint #controls-toggle { pointer-events: auto; }` restores it.
  Both are covered by guards in the browser test.
- **Binding/parity guard** — `tests/unit/input/controls-parity-guard.test.ts` (kept as-is, 26 tests): every legend entry must have a live `DEFAULT_KEYBOARD_CONFIG` binding, with negative controls in both directions (drop a binding → FAIL, drop a legend entry → FAIL, wrong bitmask → FAIL) plus single-source-of-truth invariants.
- **Real-app DOM/behaviour guard** — `tests/browser/controls-legend-ui.browser.test.ts` (new, 14 tests, Vitest `--project browser`, real Chromium): markup guard over `index.html?raw`, composition-root wiring guard over `main.ts?raw`, CSS interactivity guard over `styles.css?raw`, then the REAL `initControlsLegendUi()` run against the parsed real markup — exactly 10 rows in contract order in both the setup legend and the overlay, toggle opens / close hides the overlay, hint update keeps the toggle alive. Discriminating negatives: a mutated legend (entry removed, or a wrong key display) is detected by the row-vs-contract comparison; deleting the legend section or the overlay markup fails the markup guard; skipping `initControlsLegendUi()` leaves the legend empty and the toggle dead.
- **Durable capture command** — `scripts/capture-controls-legend-screenshots.mjs` (new, modelled on the accepted `scripts/capture-ladder-with-server.mjs`), wired as `pnpm run capture-controls-legend`. It starts the Vite dev server, loads `CONTROLS_LEGEND` through `server.ssrLoadModule` (no duplicated row data in the script), drives the real app, asserts the live DOM row-for-row before each shot, and validates PNG signature, 800×600 dimensions, >1 KB size and SHA-256 uniqueness.
- **Removed fabricated evidence** — deleted `tests/controls-legend-evidence.node.test.ts` (rendered hand-written mock HTML and duplicated the legend rows as a second source of truth) and the two mock PNGs it produced; the screenshots in `docs/screenshots/BROWSER-DEFENSIVE-CONTROLS-LEGEND/` are now recaptured from the running app. The synthetic canvas-drawing browser test `tests/browser/controls-legend-screenshots.browser.test.ts` was replaced by the real-app test above.

## Files changed

| File | Change |
|---|---|
| src/contracts/controls-legend.ts | new — shared legend contract (10 entries) |
| src/apps/browser/controls-legend-ui.ts | new — real-app legend population + overlay wiring |
| src/apps/browser/main.ts | modified — calls `initControlsLegendUi(document)`, `closeControlsOverlay(document)` on menu return, hint text via `setControlsHintText` |
| src/apps/browser/index.html | modified — legend section, overlay, `?` toggle, `#controls-hint-text`, tackle keys in the hint |
| src/apps/browser/styles.css | modified — legend/overlay styling, toggle `pointer-events: auto` |
| package.json | modified — `capture-controls-legend` script |
| scripts/capture-controls-legend-screenshots.mjs | new — durable real-app screenshot capture |
| tests/browser/controls-legend-ui.browser.test.ts | new — 14 real-app DOM/behaviour/markup guards |
| tests/unit/input/controls-parity-guard.test.ts | kept from in-flight work — 26 binding/parity guards |
| tests/controls-legend-evidence.node.test.ts | deleted — fabricated mock-page evidence |
| tests/browser/controls-legend-screenshots.browser.test.ts | deleted — synthetic canvas stand-in |
| docs/screenshots/BROWSER-DEFENSIVE-CONTROLS-LEGEND/*.png | recaptured from the real app |
| docs/evidence/BROWSER-DEFENSIVE-CONTROLS-LEGEND/RESULT.md, browser-cases.json | new — this evidence bundle |

`git diff --stat src/simulation/ eval/` is EMPTY — the deterministic simulation core, scenarios and runners are byte-identical.

## Commands run

| Command | Exit |
|---|---|
| `pnpm run typecheck` | 0 |
| `pnpm vitest run --project node tests/unit/input/controls-parity-guard.test.ts` | 0 (26 passed) |
| `pnpm vitest run --project node tests/unit/{input,browser,determinism,loop,world,ball,replay,locomotion,player-contact,contacts,cpu,cpu-adapter,scenario} tests/architecture` (59 files) | 0 (1302 passed) |
| `pnpm vitest run --project node tests/unit/[a-z]*.test.ts` (10 files) | 0 (147 passed) |
| `pnpm vitest run --project node tests/unit/2v2-scoring*` (4 files) | 0 (34 passed) |
| `pnpm vitest run --project node tests/unit/eval/[a-e]*` (13 files) | 0 (360 passed) |
| `pnpm vitest run --project node tests/unit/eval/[f-z]*` (19 files) | 1 (456/457 — 1 pre-existing failure, see Known gaps) |
| `pnpm vitest run --project node tests/unit/eval/[A-Z]*` (two chunks, 412 tests) | 1 (411/412 — 1 pre-existing failure, see Known gaps) |
| `pnpm vitest run --project node tests/integration tests/architecture tests/*.test.ts` (35 files) | 1 (306/313 — 7 pre-existing failures, see Known gaps) |
| `pnpm vitest run tests/browser/controls-legend-ui.browser.test.ts --project browser` | 0 (14 passed) |
| `pnpm vitest run tests/browser/ladder-menu-parity.browser.test.ts tests/browser/small-sided-001.browser.test.ts tests/browser/difficulty-setting.browser.test.ts tests/browser/5v5-human-vs-cpu.browser.test.ts tests/browser/controls-legend-ui.browser.test.ts --project browser` | 0 (5 files, 62 passed) |
| `pnpm run build` | 0 (`dist/` built, 44 modules) |
| `pnpm run capture-controls-legend` | 0 (2 PNGs, unique SHA-256) |
| feature-stash discrimination: same browser test with `index.html` reverted to HEAD | 1 (11 of 14 tests fail — the guards are live; markup restored afterwards, byte-identical) |

The node project was executed in per-directory chunks because the full run exceeds the 300 s per-command cap on this 2-core host; every node test file ran.

## Screenshots

| File | Depicts | SHA-256 |
|---|---|---|
| legend-setup-menu.png | Real setup menu, Controls legend with all 10 rows (Move … Slide Tackle) | a728b84b236db67a1d2cc9fe8f586db93e6ed4320148a1fd4519869831bd0b4a |
| legend-in-match-overlay.png | Live 5v5 human-vs-CPU match (tick 194, hash `fnv1a64-v1:5b2184deb…`) with the in-match Controls overlay opened via `#controls-toggle` | cece77262c73940b7c3b9f5832209deb158c027734753abf2c379cd5b132df60 |

Both are 800×600 8-bit RGB PNGs (146 855 B / 58 430 B), captured by Playwright Chromium against the Vite dev server, byte-distinct, with the live DOM asserted row-for-row against `CONTROLS_LEGEND` before each capture. The in-match frame is not byte-stable across runs — it shows the live tick/hash HUD — so these hashes identify this capture, and `pnpm run capture-controls-legend` regenerates both files and reprints their hashes.

## Browser case evidence

Mirrors how `SMALL-SIDED-LADDER-MENU-COMPLETION` recorded its case (case metadata in the test file plus `browser-cases.json` in this evidence directory). No entry was added to `eval/contracts/browser-cases.ts`, because that registry is consumed by milestone profiles and this objective claims no milestone verdict.

- `BROWSER-DEFENSIVE-CONTROLS-LEGEND` / `browser-case-controls-legend-ui-v1` → `tests/browser/controls-legend-ui.browser.test.ts` — 14/14 passed, exit 0.
- `BROWSER-DEFENSIVE-CONTROLS-PARITY` / `browser-case-controls-parity-guard-v1` → `tests/unit/input/controls-parity-guard.test.ts` — 26/26 passed, exit 0.

## Acceptance criteria mapping

- Legend surfaces the full human control set including both defensive actions → 10-row contract rendered in the setup menu and the in-match overlay; `U`/`I` also named in the per-match hint and in every human-vs-CPU mode hint (`src/apps/browser/main.ts`).
- Binding/parity guard: every documented control has a live binding; removing a binding or a legend entry fails the guard → `tests/unit/input/controls-parity-guard.test.ts` (26 tests, both drift directions plus wrong-bitmask negatives).
- Legend content cannot drift from what the app renders → single source `src/contracts/controls-legend.ts`; the real-app test compares rendered rows against the imported contract (no duplicated row data anywhere), and the capture script loads the same module through Vite.
- BROWSER_VISIBLE screenshots of the legend and an in-match state → `legend-setup-menu.png` and `legend-in-match-overlay.png` from the running app.
- Presentation affordance only, no gameplay change → `git diff --stat src/simulation/ eval/` empty; changes confined to the browser adapter, tests, scripts and evidence.
- No invented rubric → no scoring, threshold, envelope or perceptual claim anywhere in the bundle.

## Known gaps

- **Pre-existing node-suite failures at HEAD (`de62b06`), reproduced in a clean `git worktree` of HEAD**:
  - `tests/unit/eval/playable-1v1-re-evaluation.test.ts` → `registrySetId matches the loaded registry` (`fnv1a64-v1:d1a691b2c1211c76` vs `fnv1a64-v1:24b5341e2bc3fbd3`).
  - `tests/unit/eval/SMALL-SIDED-COHERENT-EVIDENCE-RERUN-binding.test.ts` → expects 18 source objectives, the committed milestone manifest now has 19.
  - `tests/integration/compare-foundation.test.ts` (2), `tests/integration/nondeterminism-canary.test.ts` (2), `tests/integration/match-set-piece.test.ts` (1), `tests/integration/match-lifecycle.test.ts` (1), `tests/difficulty-capture.node.test.ts` (1).
  None of these import or exercise the browser legend; the orchestrator's full gate will still see them.
- **Capture hygiene is only partly true repo-wide.** This objective's suites write nothing under `docs/screenshots/**`; durable capture goes through `pnpm run capture-controls-legend`. However the accepted neighbour suites (`tests/browser/small-sided-001.browser.test.ts`, `tests/browser/5v5-human-vs-cpu.browser.test.ts`, `tests/difficulty-capture.node.test.ts`, `tests/browser/ladder-menu-screenshots.browser.test.ts`) still write into other objectives' `docs/screenshots/**` during ordinary runs. Running the neighbours for this verification dirtied `docs/screenshots/BROWSER-SMALL-SIDED-001-CASE/frame-{later,play}.png`; both were restored with `git checkout` and are clean now. Fixing that is a separate hygiene objective, not this one.
- The overlay is a static reference card: it does not show per-slot (slot-2) bindings, does not rebind keys, and does not pause the match clock while open. None of that was in scope.
- `pnpm run gauntlet:audit` was not executed: it writes `docs/evidence/<objective>/audit.json`, which belongs to the orchestrator's pre-critic gate.

## Claims not made

- No PROMOTION, milestone or `PLAYABLE_*`/`SMALL_SIDED_SHAPE` verdict claim.
- No PES 2017 fidelity, calibration or measured-envelope claim; no reference values invented.
- No `FOUNDATION_LAB_PASS` claim — the executable evaluator registries/policies are untouched by this objective.
- No regression `PASS` claim for the repository gate; the pre-existing failures above are disclosed, not absorbed.
- No invented rubric, scoring or perceptual evaluation.
- No gameplay change: the deterministic simulation core, scenarios and runners are byte-identical (`git diff --stat src/simulation/ eval/` empty). This is a presentation affordance only.
- No claim that the legend is a rebinding UI or that it documents CPU-side behaviour.
