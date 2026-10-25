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
| test | `node --test tests/*.test.ts` (engine, local-stage, evaluation, replay, discipline, input). |
| evaluate | Headless evaluation (`scripts/evaluate.ts`); regenerates `artifacts/evaluation.json`, the committed copy is restored. |
| build | Vite build into `dist/`. |
| smoke | `scripts/smoke-browser.mjs`: starts a match, takes the human kickoff (presses J until the phase leaves "Saque inicial"), fails on page errors, missing canvas, or a clock stuck at `00:00`; then a CPU-vs-CPU match with video. |
| pad-smoke | `scripts/smoke-gamepad.mjs`: fake standard pads; Start edges, charged shot, disconnect, held reconnect, stable local slots, and emulated touch shot. Runs after smoke with a separate preview server. |

## Evidence

`artifacts/local/smoke/` (git-ignored; CI uploads it as `browser-smoke`):
`pad.json` (scenario snapshots and errors), `game.png`, `match.json` (clock start/end, kickoffMs, score, phase, canvases, errors), `cpu-vs-cpu.png`, `video/*.webm`, `lab.png`.
Attach these paths, or the CI artifact, to the PR.

## Capability map

| Capability | How it is tested | Evidence |
|---|---|---|
| Match flow (kickoff, halftime, fulltime) | engine.test.ts "halftime changes direction and a complete CPU match reaches fulltime" | test output (smoke covers only kickoff and clock in browser) |
| Determinism and checkpoints | engine.test.ts "same seed and input stream…", "checkpoints and presentation are detached…" | test output |
| Input validation | engine.test.ts "rejects non-finite, duplicate, stale input…" | test output |
| Goals, posts, restarts | engine.test.ts "fast swept crossing scores once…", "post collision…", "throw-in, corner and goal kick…" | test output |
| Fouls, cards, penalties, advantage (C4 #29) | local-stage.test.ts (penalty, second caution, advantage recall, indirect free kick); discipline.test.ts (direct red, DOGSO, sent-off exclusion, advantage expiry/goal, offside reset, CPU kickoff matrix + determinism); card-alert.test.ts (direct red, second yellow, yellow, unknown player); smoke loads an engine-generated direct-red replay and checks HUD identity and 100-tick expiry | test output; `red-card.png`, `red-card.json` |
| Offside | engine.test.ts "offside is only called…"; local-stage.test.ts "offside position can interfere…" | test output |
| Goalkeepers | engine.test.ts "keepers hold bounded goal arcs…"; local-stage.test.ts keeper hands, parry | test output |
| Human keeper control (C10 #53) | human-keeper.test.ts (scripted tick-by-tick: switch in, move, rush, dive save, hold then pass/kick, switch out, both teams, pause, CPU hashes equal pre-C10 engine every tick, kickoff tick 60, 11-a-side bounds, checkpoint replay); input.test.ts (keyboard, gamepad R3, touch keeper switch) | test output; real controllers and touch feel pending (#44) |
| Replays (C3 #41) | engine.test.ts "replay reconstructs the exact match…"; replay.test.ts (validation, engine version, reference fixture `tests/fixtures/reference-engine-v2.json`) | test output; browser load round-trip is a gap |
| Presentation boundary (C6 #46) | presentation-boundary.test.ts "presentation attached matches headless authority every tick and at fulltime" (frozen snapshots, three camera modes, HUD states, real renderer/radar with fake GPU/DOM, CPU kickoff at tick 60); "presentation imports cannot reach simulation mutators or orchestration"; typecheck rejects nested snapshot writes; local-stage.test.ts "camera changes and repeated draws cannot change authoritative state" | test output; per-tick hashes and final full-world comparison |
| Browser match + CPU vs CPU (C1 #45) | smoke (kickoff taken, clock advances, no page errors) | `match.json`, `cpu-vs-cpu.png`, `video/` |
| Pause and dialogs / fulltime (C2 #42) | pause.test.ts: manual pause, dialog close/cancel decision, terminal state, detached rematch kickoff; smoke: P → Help → close → clock frozen 2s → P → clock advances | test output; `match.json` → `pauseCase`; fulltime buttons require manual browser review |
| Controls / devices (C5 #44) | local-stage.test.ts "two controller identities keep their slots…", "controller charge fires once…" (`controller.ts`); input.test.ts (keyboard, touch, charge, switch, pause, blur, two players, pad dead zone) | test output; `scripts/smoke-gamepad.mjs` scenarios 1–6, `artifacts/local/smoke/pad.json`; real devices: `docs/manual-device-test.md` (pending) |
| Visual style: silhouettes and palette (C11 #63) | palette.test.ts (team value bands separate for any kit pair, ball brightest, keeper distinct); presentation-boundary.test.ts unchanged | before/after screenshots for the 3 cameras in `docs/evidence/c11/` |
| Player figures and animation (C11 #63) | player-figure.test.ts (pose is pure and does not change frozen snapshots; run, idle and kick poses differ; swing grows with speed; kick uses the preferred foot; turn lean sign; human proportions; only `simulation/math` import); presentation-boundary.test.ts unchanged | before/after screenshots (close, close zoom, broadcast, tactical) in `docs/evidence/c12/` |
| Game feel vs PES (C7 #48) | pes-timing.test.ts / npm run timing:compare: five seeded game timings, approximate public-video PTS validation, exact known-gap and missing-reference register | eval/reference/pes-observed.json (32 tiempos: 12 viajes de pase, 11 controles, 6 giros, 3 arranques; 20 nuevos de B, 1 pase elevado descartado; acuerdo numérico 10/12, c03/c05 discrepan y giros A con fases distintas; slice 2 tuning: giro180 0.333 s y velocidad máxima 0.617 s WITHIN; brechas: pase/control BELOW; coverage_shortfall: 3/15 arranques, 2/15 giros180), pes-known-gaps.json; evaluate still uses design targets and DIRECT_CAPTURE only; replay fixture tests/fixtures/reference-engine-v2.json |
| Teams data, online (C8 #49, C9 #50) | none | gap |

Rule: every capability PR updates this table when a capability gains or loses a test or evidence.
