---
name: verify-futbol-excitante
description: Verify a change to Fútbol Excitante (Astra). Run before calling any branch ready or opening a pull request; lists what each check proves and where the evidence is.
---

# Verify Fútbol Excitante

## Run

```bash
scripts/verify.sh            # set CHROME_PATH to use a specific Chrome/Chromium
```

Every step must print PASS. The script exits non-zero if one fails. CI (`.github/workflows/ci.yml`) runs the same script.

| Step | What it proves |
|---|---|
| no-legacy | No workflow references `gauntlet/`, `.omp/`, `.opencode/` or `.grok/` (`scripts/check-no-legacy.sh`). |
| install | `npm ci` from the lockfile. |
| typecheck | `tsc --noEmit`. |
| test | `node --test tests/*.test.ts` (engine, local-stage, evaluation). |
| evaluate | Headless evaluation (`scripts/evaluate.ts`); regenerates `artifacts/evaluation.json`, the committed copy is restored. |
| build | Vite build into `dist/`. |
| smoke | `scripts/smoke-browser.mjs`: starts a match, fails on page errors, missing canvas, or a clock stuck at `00:00`; then a CPU-vs-CPU match with video. |

## Evidence

`artifacts/local/smoke/` (git-ignored; CI uploads it as `browser-smoke`):
`game.png`, `match.json` (clock start/end, score, phase, canvases, errors), `cpu-vs-cpu.png`, `video/*.webm`, `lab.png`.
Attach these paths, or the CI artifact, to the PR.

## Capability map

| Capability | How it is tested | Evidence |
|---|---|---|
| Match flow (kickoff, halftime, fulltime) | engine.test.ts "halftime changes direction and a complete CPU match reaches fulltime" | test output (smoke covers only kickoff and clock in browser) |
| Determinism and checkpoints | engine.test.ts "same seed and input stream…", "checkpoints and presentation are detached…" | test output |
| Input validation | engine.test.ts "rejects non-finite, duplicate, stale input…" | test output |
| Goals, posts, restarts | engine.test.ts "fast swept crossing scores once…", "post collision…", "throw-in, corner and goal kick…" | test output |
| Fouls, cards, penalties, advantage (C4 #29) | local-stage.test.ts (penalty, second caution, advantage recall, indirect free kick); card-alert.test.ts (direct red, second yellow, yellow, unknown player); smoke loads an engine-generated direct-red replay and checks HUD identity and 100-tick expiry | test output; artifacts/local/smoke/red-card.png and red-card.json (requires browser smoke to pass) |
| Offside | engine.test.ts "offside is only called…"; local-stage.test.ts "offside position can interfere…" | test output |
| Goalkeepers | engine.test.ts "keepers hold bounded goal arcs…"; local-stage.test.ts keeper hands, parry | test output; human keeper control is missing (C10 #53) |
| Replays (C3 #41) | engine.test.ts "replay reconstructs the exact match…" | test output; invalid-checkpoint rejection is a gap |
| Presentation boundary (C6 #46) | local-stage.test.ts "camera changes and repeated draws cannot change authoritative state" | test output |
| Browser match + CPU vs CPU (C1 #45) | smoke | `match.json`, `cpu-vs-cpu.png`, `video/` |
| Pause and dialogs (C2 #42) | none yet | gap |
| Controls / devices (C5 #44) | local-stage.test.ts "two controller identities keep their slots…", "controller charge fires once…" (`controller.ts`); keyboard/touch `input.ts` untested | test output; physical devices are manual (gap) |
| Game feel vs PES (C7 #48) | evaluate (design targets only) | manual review |
| Teams data, online (C8 #49, C9 #50) | none | gap |

Update this table when a capability gains or loses a test.
