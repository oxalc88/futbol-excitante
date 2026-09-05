# VIDEO-CAPTURE-RESTORE-30S-CLIP — result

Restore the repository video path. `package.json` referenced
`scripts/capture-ai-match-video.mjs` (`capture-ai-video`) but the file was missing
(disclosed twice in prior sessions; it blocked the optional 30 s organic clip in
`BROWSER-5V5-ANTI-HUDDLE-DYNAMIC-EVIDENCE`, which was accepted with video honestly
`NOT_PRODUCED`).

The video path is now **restored** and the optional 30 s organic anti-huddle 5v5
clip **was genuinely produced**.

## What was built

- `scripts/capture-ai-match-video.mjs` — the restored capture tool. It starts the
  real Vite dev server, drives the browser composition root's `ai-match-5v5` mode
  (5v5 CPU-vs-CPU with `cpuAntiHuddle: true`, scenario
  `eval/scenarios/5v5-fixture-v1.json`), and records the page with Playwright
  Chromium's **native** `recordVideo` (WebM via a bundled codec) — no system
  ffmpeg required.
- `tests/capture-ai-video.node.test.ts` — binding test: the tool exists, the
  package.json hook resolves to it, bad inputs fail cleanly, and a short real
  Chromium run produces a non-trivial `.webm` whose metadata matches the file.
- `docs/evidence/VIDEO-CAPTURE-RESTORE-30S-CLIP/video-meta.json` — durable capture
  metadata (committed).
- `docs/evidence/VIDEO-CAPTURE-RESTORE-30S-CLIP/audit.json` — deterministic audit
  result (committed).

### Tool semantics

- **ffmpeg honesty**: the tool probes `ffmpeg -version`. Here it is **absent**, so it
  records native WebM and does **not** attempt an mp4 conversion. If `--mp4` is
  passed and system ffmpeg is absent, it warns and keeps the WebM. mp4 is only ever
  produced by an actually-available converter.
- **Deterministic naming**: the artifact is `<mode>-<duration>s.webm` (no random
  Playwright `page@…` names).
- **Exit codes**: `0` success; `2` bad inputs (unknown mode, non-positive duration,
  bad viewport/port); `1` any real failure (server/browser/page/rendering, no WebM
  produced, suspiciously small artifact).
- **Evidence gate (capture hygiene 0.9.2+)**: an **ordinary** run (no `WIP_SECTION`)
  writes the `.webm` and `video-meta.json` only under the ignored
  `test-results/gauntlet-capture/VIDEO-CAPTURE-RESTORE-30S-CLIP/**` and leaves
  `docs/` byte-identical. Durable metadata is written to
  `docs/evidence/VIDEO-CAPTURE-RESTORE-30S-CLIP/` **only** with
  `WIP_SECTION=__EVIDENCE__:VIDEO-CAPTURE-RESTORE-30S-CLIP`. If the objective
  already has a `manifest.json`, the durable gate refuses (immutable evidence).
- The binary `.webm` is optional/ephemeral and is **not** committed (per
  `gauntlet/evidence-manifest-contract.md`: "Binary video does not need to be
  committed"). The committed record is `video-meta.json` + a `video-reference.json`
  to be produced after the candidate commit exists (see below).

## The clip

| Fact | Value |
|------|-------|
| Artifact file (ephemeral) | `test-results/gauntlet-capture/VIDEO-CAPTURE-RESTORE-30S-CLIP/ai-match-5v5-30s.webm` |
| Provider | `playwright-chromium native recordVideo (bundled WebM codec; no system ffmpeg)` |
| Format | `webm` (mp4 would require system ffmpeg, which is absent) |
| Resolution | 800 × 600 |
| Container duration | **36.2 s** (parsed back through Chromium's media stack; system ffmpeg/ffprobe absent) |
| Capture wall window | **33.191 s** |
| Bytes | **1,125,058** |
| SHA-256 | `575ff1140de82f97128ed0029a4ec5a304d74f9f99950e389c62fe922f0c4fd3` |
| Final simulation tick | **900** (sim reached ~15 s of sim time; headless Chromium throttles the rAF loop so the sim advances slower than wall-clock) |
| Final HUD state hash | `fnv1a64-v1:435ed7a48…` (HUD-truncated 20-char display; authoritative per-tick hash chain lives in the accepted trajectories) |
| `anti_huddle` | `true` |
| Scenario | `eval/scenarios/5v5-fixture-v1.json` (the accepted anti-huddle 5v5 browser fixture; same scenario as the `BROWSER-5V5-ANTI-HUDDLE-DYNAMIC-EVIDENCE` frames) |

The clip shows the anti-huddle arc the accepted trajectory/frame evidence pins
(kickoff freeze → first touch by `player-10` on tick 18 → spread to homes → one
presser + cover → organic pass). It is diagnostic only; the authoritative
per-tick evidence remains the accepted trajectories and semantic frames, which
this video never replaces.

## Reproduction

```
# Ordinary (ephemeral, writes to test-results/gauntlet-capture, docs/ untouched):
mise exec -- pnpm run capture-ai-video
# exit code: 0

# Durable metadata (writes docs/evidence/VIDEO-CAPTURE-RESTORE-30S-CLIP/video-meta.json):
WIP_SECTION=__EVIDENCE__:VIDEO-CAPTURE-RESTORE-30S-CLIP mise exec -- pnpm run capture-ai-video
# exit code: 0

# Custom window / mode:
mise exec -- pnpm run capture-ai-video -- --duration 30 --mode ai-match-5v5

# Binding test:
mise exec -- pnpm exec vitest run tests/capture-ai-video.node.test.ts --project node
# exit code: 0 (5/5 tests)

# Deterministic audit:
mise exec -- pnpm run gauntlet:audit -- --objective VIDEO-CAPTURE-RESTORE-30S-CLIP \
  --class HEADLESS --tests-pass true --integration-test-pass true
# exit code: 0, status PASS
```

Observed exit codes: capture 0; binding test 0; audit 0.

## Deterministic audit

`gauntlet:audit --class HEADLESS --tests-pass true --integration-test-pass true`
→ **PASS** (all checks PASS, no `FAIL`/`REVIEW_REQUIRED`). Persisted at
`docs/evidence/VIDEO-CAPTURE-RESTORE-30S-CLIP/audit.json`.

## Typecheck

`mise run typecheck` → **exit 0** (all three tsconfig projects: core, node,
browser). The tool and its test introduce no type errors.

## video-reference.json (deferred to orchestrator — requires the candidate commit)

`docs/evidence/VIDEO-CAPTURE-RESTORE-30S-CLIP/video-reference.json` was **not**
generated because `gauntlet:video:reference` (`gauntlet/evals/src/write-video-reference.ts`)
requires a **resolvable git commit SHA**, and this builder does not commit
(the orchestrator commits via `git-committer`). Confirmed: the writer rejects an
unresolved SHA (`git cat-file -e <sha>^{commit}` → "Not a valid object name").

After the candidate commit exists, the orchestrator must run:

```
mise exec -- pnpm run gauntlet:video:reference -- \
  --objective VIDEO-CAPTURE-RESTORE-30S-CLIP \
  --artifact-id anti-huddle-ai-match-5v5-30s \
  --artifact-name ai-match-5v5-30s.webm \
  --provider "playwright-chromium native recordVideo (bundled WebM codec; no system ffmpeg)" \
  --created-at 2026-09-05T06:41:54.010Z \
  --candidate-commit <the committed candidate SHA>
```

The `created_at` above is taken from `video-meta.json`. All other video facts
(provider, artifact id/name, objective) are preserved verbatim in
`video-meta.json`.

## claims_not_made

- No PES fidelity, `FOUNDATION_LAB_PASS`, or any gameplay `PASS` claim is made.
- No invented reference envelope or tolerance is introduced. The frame/trajectory
  thresholds that exist belong to the accepted anti-huddle artifacts, not to this
  video.
- The video is **optional diagnostic evidence** and does **not** prove a football
  outcome, does **not** replace a trajectory or semantic frame sequence, and is
  **not** committed gameplay evidence.
- No `NOT_PRODUCED` block is included: a genuine 36.2 s WebM was produced. If the
  tool is run on a host where Playwright cannot launch Chromium or the match never
  starts, it exits non-zero and produces no artifact (honest failure, no fake
  metadata).
- No claim that per-tick state hashes were read from the video; the recorded
  `final_hud_state_hash` is the HUD-truncated display value.
- Cross-runtime pinned SHAs quoted elsewhere (e.g. the accepted
  `5V5-KICKOFF-ANTI-HUDDLE` pin `47bb0db` and `BROWSER-5V5-ANTI-HUDDLE-DYNAMIC-EVIDENCE`
  pin `16cffb3`) are provenance references only — this objective does not
  re-adjudicate them.
