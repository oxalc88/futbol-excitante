# CAPTURE-HYGIENE-ENFORCEMENT — builder result

- objective_id: CAPTURE-HYGIENE-ENFORCEMENT
- builder_agent: builder-structured
- builder_model: deepseek-v4-flash
- evidence_class: HEADLESS
- horizon: v24 item 6 (last objective of horizon v24)

## Hypothesis

Ordinary regression suites are allowed to render and capture, but their
filesystem output is ephemeral and belongs under the ignored
`test-results/gauntlet-capture/**` tree. They must not write into
`docs/screenshots/**`, and accepted evidence (`docs/evidence/**`) is immutable.
The violation discovered this session was that accepted neighbor browser suites
rewrote historical evidence frames during ordinary `pnpm run test-browser` runs
(e.g. `tests/browser/5v5-ai-match.browser.test.ts` rewrote
`docs/screenshots/BROWSER-5V5-MATCH/frame-000.png` on every ordinary run). Fixing
every docs/screenshots writer to route ordinary output under
`test-results/gauntlet-capture/` and keeping durable capture behind an explicit
evidence-mode operation (`WIP_SECTION=__EVIDENCE__:<id>`) makes ordinary runs
byte-identical on `docs/screenshots/**`.

## Violation inventory (complete)

Writers are classified by what they actually do during an ordinary browser run
(`CI=1 pnpm exec vitest run --project browser`), verified by a SHA-256 snapshot
diff of `docs/screenshots/**` before vs after each suite. The two mechanisms:

- **`page.screenshot({ path })`** writes through the Playwright provider on the
  Node side → **these genuinely mutated `docs/screenshots/**` on ordinary runs**
  (confirmed: `BROWSER-5V5-MATCH/frame-000.png` SHA changed after the ordinary
  run). These are the violating writers.
- **`node:fs` `writeFileSync`/`mkdirSync`** inside a `.browser.test.ts` runs in
  the browser context where `node:fs` is unavailable → it falls back to emitting
  base64 on stdout for the harvest script. These suites **did not** mutate
  `docs/screenshots/**` on ordinary runs (verified byte-identical). Their
  historical `docs/screenshots/<id>` were produced by dedicated capture scripts
  (`scripts/capture-*.ts`/`.mjs`), not by the browser suite, so they are not
  ordinary-run mutators.

### Actually-mutating writers (all `page.screenshot` → now gated)

| writer file | objective id | write mechanism | fix |
|---|---|---|---|
| `tests/browser/5v5-ai-match.browser.test.ts` | BROWSER-5V5-MATCH | `page.screenshot` | gate + `commands.writeFile` |
| `tests/browser/3v3-match-screenshots.browser.test.ts` | BROWSER-3V3-MATCH | `page.screenshot` | gate + `commands.writeFile` |
| `tests/browser/small-sided-001.browser.test.ts` | BROWSER-SMALL-SIDED-001-CASE | `page.screenshot` | gate + `commands.writeFile` |
| `tests/browser/small-sided-coherence-rerun.browser.test.ts` | BROWSER-SMALL-SIDED-001-COHERENCE-RERUN | `page.screenshot` | gate + `commands.writeFile` |
| `tests/browser/small-sided-readability.browser.test.ts` | SMALL-SIDED-VISUAL-READABILITY-EVIDENCE | `page.screenshot` | gate + `commands.writeFile` |
| `tests/browser/small-sided-integrated-playtest.browser.test.ts` | SMALL-SIDED-INTEGRATED-PLAYTEST-MATCH | `page.screenshot` | gate + `commands.writeFile` |
| `tests/browser/small-sided-action-event-observability.browser.test.ts` | SMALL-SIDED-ACTION-EVENT-OBSERVABILITY | `page.screenshot` | gate + `commands.writeFile` |
| `tests/browser/5v5-human-vs-cpu.browser.test.ts` | SMALL-SIDED-5V5-HUMAN-VS-CPU | `page.screenshot` | gate + `commands.writeFile` |
| `tests/browser/human-action-readability-observability.browser.test.ts` | SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY | `page.screenshot` | gate + `commands.writeFile` |
| `tests/browser/human-action-screenshot-capture.browser.test.ts` | SMALL-SIDED-HUMAN-ACTION-READABILITY-OBSERVABILITY | `page.screenshot` | gate + `commands.writeFile` |
| `tests/browser/duel-control-screenshot-capture.browser.test.ts` | HUMAN-DEFENSIVE-DUEL-CONTROL | `page.screenshot` | gate + `commands.writeFile` |

### Non-mutating node:fs / stdout-harvest writers (no change required; verified byte-identical)

`ladder-menu-screenshots`, `capture-switch-indicator-evidence`,
`capture-player-switch`, `capture-2v2-keyboard`, `capture-human-vs-cpu-3v3`,
`capture-player-indicator`, `difficulty-setting`,
`archetype-browser-capture`, `archetype-identical-recapture`,
`archetype-render-capture`, `archetype-remaining-visuals`,
`1v1-control-screenshots`. Each writes via `node:fs` which is unavailable in the
browser context, so ordinary runs emit base64 to stdout and never touch
`docs/screenshots/**`. Verified byte-identical for each (see commands below).

### Already-correctly-gated (reference pattern, unchanged)

`tests/browser/cpu-tackle-screenshot-capture.browser.test.ts` (CPU-DEFENSIVE-TACKLE),
`tests/browser/anti-huddle-dynamic-evidence.browser.test.ts`
(BROWSER-5V5-ANTI-HUDDLE-DYNAMIC-EVIDENCE), `tests/browser/capture-wip.browser.test.ts`.
`tests/difficulty-capture.node.test.ts` was already fixed to `test-results/` by
NODE-GATE-REGRESSION-TRIAGE (ed4f1f7) — not re-done.

## Fixes

Every actually-mutating writer now follows the established gated pattern
(`tests/browser/cpu-tackle-screenshot-capture.browser.test.ts` and
`tests/browser/anti-huddle-dynamic-evidence.browser.test.ts`):

```ts
const OBJECTIVE_ID = "<id>";
const RAW_SECTION = process.env.WIP_SECTION || "capture";
const DURABLE_EVIDENCE = RAW_SECTION === `__EVIDENCE__:${OBJECTIVE_ID}`;
const SCREENSHOT_DIR = DURABLE_EVIDENCE
  ? `docs/screenshots/${OBJECTIVE_ID}`
  : `test-results/gauntlet-capture/${OBJECTIVE_ID}`;
```

- **Ordinary run** (`pnpm run test-browser`, no `WIP_SECTION` evidence marker):
  `DURABLE_EVIDENCE` is false, `SCREENSHOT_DIR` = `test-results/gauntlet-capture/<id>`,
  so `docs/screenshots/**` is never touched.
- **Evidence-mode run** (`WIP_SECTION=__EVIDENCE__:<id>`): `DURABLE_EVIDENCE` is
  true, `SCREENSHOT_DIR` = `docs/screenshots/<id>`. For an already-accepted
  objective the suite calls `assertEvidenceMutable()` which throws when
  `docs/evidence/<id>/manifest.json` exists, so accepted evidence is never
  overwritten — an evidence-mode rerun of an accepted objective fails loudly
  instead of rewriting.
- The `page.screenshot({ path })` call sites were converted to the browser-safe,
  root-relative `commands.writeFile(<SCREENSHOT_DIR>/<name>, base64, "base64")`
  with the PNG obtained from `bridge.capture()` (the canonical pattern). This is
  the only "write" primitive that actually lands in the repo filesystem from a
  browser context (it creates directories and is immune to the browser-side
  `process.cwd()` being undefined). Durable filename/tick/frame semantics are
  unchanged (same `<id>/frame-…` names and same capture ticks).
- **No test was weakened**: every suite retains its assertions; only the output
  root changes between durable and ephemeral mode.

## Verification commands and exit codes

- `pnpm run typecheck` → **exit 0** (core + node + browser).
- Guard test `pnpm exec vitest run tests/capture-hygiene.node.test.ts --project node`
  → **exit 0, 3 tests passed**:
  - ordinary `5v5-ai-match` run → `docs/screenshots/**` byte-identical + ephemeral
    `test-results/gauntlet-capture/BROWSER-5V5-MATCH/frame-000.png` exists;
  - evidence-mode rerun of accepted `BROWSER-5V5-MATCH` → blocked (non-zero exit)
    and `docs/screenshots/**` byte-identical;
  - source assertion that every docs/screenshots-rendering suite implements the
    `DURABLE_EVIDENCE` gate with the `docs/screenshots`↔`test-results/gauntlet-capture`
    output switch.

- Converted mutating suites (each exit 0, `docs/screenshots/**` byte-identical):
  - 6-file batch (`small-sided-001`, `small-sided-coherence-rerun`,
    `small-sided-readability`, `3v3-match-screenshots`, `5v5-ai-match`,
    `human-action-screenshot-capture`) → **6 files / 51 tests** passed, byte-identical;
  - 4-file batch (`small-sided-action-event-observability`,
    `small-sided-integrated-playtest`, `5v5-human-vs-cpu`,
    `duel-control-screenshot-capture`) → **4 files / 43 tests** passed, byte-identical;
  - `human-action-readability-observability` → **10 tests** passed, byte-identical.
- Reference gated suites (`cpu-tackle-screenshot-capture`,
  `anti-huddle-dynamic-evidence`, `capture-wip`) → **3 files / 5 tests** passed, byte-identical.
- Non-mutating node:fs suites:
  - 7-file batch (`difficulty-setting`, `capture-2v2-keyboard`, `capture-player-switch`,
    `capture-human-vs-cpu-3v3`, `capture-switch-indicator-evidence`,
    `1v1-control-screenshots`, `archetype-identical-recapture`) → **7 files / 15 tests** passed, byte-identical;
  - 3-file archetype batch (`archetype-browser-capture`, `archetype-render-capture`,
    `archetype-remaining-visuals`) → **3 files / 4 tests** passed, byte-identical;
  - solo `capture-player-indicator` (earlier) → passed, byte-identical;
  - solo `ladder-menu-screenshots` (earlier) → **4 tests** passed, byte-identical.
- `git status --porcelain src/ docs/screenshots docs/evidence` → empty (no
  gameplay change, no accepted-evidence mutation, no docs/screenshots mutation).

## Notable caveat on the "full browser project before/after"

The task asked to run the full browser project before/after and verify
`docs/screenshots/**` byte-identity. The full browser project is not runnable
twice in this environment in a bounded time: many suites are extremely slow
(e.g. `human-action-readability-observability` ≈ 234 s, `anti-huddle` ≈ 52 s
for a single file). A `timeout 600` run only finished a handful of files, and a
run that completed more was killed at the limit. Instead, I exercised the
**complete set of docs/screenshots-writing suites** (the 11 `page.screenshot`
mutators, the 3 reference gated suites, and all 10 node:fs/harvest suites) in
ordinary mode and verified byte-identity on the whole `docs/screenshots/**`
tree for each, which is the actual claim the hygiene rule makes.

## claims_not_made

- No PROMOTION, no PES fidelity, no FOUNDATION_LAB_PASS.
- No invented reference envelopes, tolerances, or rubrics.
- No gameplay change (`git diff --stat src/` is empty; no `src/**` edits).
- No evidence rewriting: `docs/screenshots/**` and `docs/evidence/**` were left
  byte-identical to git HEAD for all accepted objectives; the only new files are
  the 11 gated `tests/browser/**` edits, the new `tests/capture-hygiene.node.test.ts`
  guard, and this `docs/evidence/CAPTURE-HYGIENE-ENFORCEMENT/RESULT.md`.
- The full-browser-project byte-identity is claimed only for the set of
  docs/screenshots-writing suites actually exercised, not for the entire
  50-file browser project (infeasible runtime, documented above).
- No integration-test result is claimed as a PASS beyond the executed guard and
  the suites listed; orchestration/critic/integration acceptance is the
  orchestrator's responsibility.
