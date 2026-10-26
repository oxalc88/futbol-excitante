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
| test | `node --test tests/*.test.ts` (engine, local-stage, evaluation, replay, discipline, input, kickoff-receiver). |
| evaluate | Headless evaluation (`scripts/evaluate.ts`); regenerates `artifacts/evaluation.json`, the committed copy is restored. |
| build | Public Vite build into `dist/`: only `index.html`, with relative paths and no lab. |
| dist-check | `scripts/check-dist.mjs`: allowlist: only .html, .js, .css; rejects lab output, forbidden directories, absolute asset paths and oversized output (2 MiB/file, 5 MiB total); prints sizes. |
| build-lab | `npm run build:lab` includes `lab.html` for the following smoke. Rebuild public output before publication. |
| smoke | `scripts/smoke-browser.mjs`: starts a match, takes the human kickoff (presses J until the phase leaves "Saque inicial"), fails on page errors, missing canvas, or a clock stuck at `00:00`. Then the script tests quick play. It uses a new browser profile. The tips show only on the first match. The match does not run while the tips are open. The Enter key starts the match from the focused button. The match starts against the CPU. The clock advances. Then the page loads again. The tips do not show a second time. At the end, the script runs a match with two CPU teams and records a video. |
| pad-smoke | `scripts/smoke-gamepad.mjs`: fake standard pads; Start edges, charged shot (scenarios 2 and 5 start from the smoke hook `window.__feSmoke.ballAtFeet`, which exists only under `navigator.webdriver`; in scenario 5 it stops a rolling shot so no goal freezes the movement check), disconnect, held reconnect, and stable local slots. Runs after smoke with a separate preview server. |

## Evidence

`artifacts/local/smoke/` (git-ignored; CI uploads it as `browser-smoke`):
`pad.json` (scenario snapshots and errors), `game.png`, `match.json` (clock start/end, kickoffMs, score, phase, canvases, quick-play flow `quick`, Enter flow `enter`, errors), `quick-play.png`, `cpu-vs-cpu.png`, `video/*.webm`, `lab.png`.
Attach these paths, or the CI artifact, to the PR.

## Capability map

| Capability | How it is tested | Evidence |
|---|---|---|
| Match flow (kickoff, halftime, fulltime) | engine.test.ts "halftime changes direction and a complete CPU match reaches fulltime"; kickoff-receiver.test.ts "kickoff backward pass reaches a team-0 receiver before any team-1 touch" and "kickoff receiver run is deterministic" (the kickoff receiver check lives here now) | test output (smoke covers only kickoff and clock in browser) |
| Determinism and checkpoints | engine.test.ts "same seed and input stream…", "checkpoints and presentation are detached…" | test output |
| Input validation | engine.test.ts "rejects non-finite, duplicate, stale input…" | test output |
| Goals, posts, restarts | engine.test.ts "fast swept crossing scores once…", "post collision…", "throw-in, corner and goal kick…" | test output |
| Fouls, cards, penalties, advantage (C4 #29) | local-stage.test.ts (penalty, second caution, advantage recall, indirect free kick); discipline.test.ts (direct red, DOGSO, sent-off exclusion, advantage expiry/goal, offside reset, CPU kickoff matrix + determinism); card-alert.test.ts (direct red, second yellow, yellow, unknown player); smoke loads an engine-generated direct-red replay and checks HUD identity and 100-tick expiry | test output; `red-card.png`, `red-card.json` |
| Offside | engine.test.ts "offside is only called…"; local-stage.test.ts "offside position can interfere…" | test output |
| Goalkeepers | engine.test.ts "keepers hold bounded goal arcs…"; local-stage.test.ts keeper hands, parry | test output |
| Human keeper control (C10 #53) | human-keeper.test.ts (scripted tick-by-tick: switch in, move, rush, dive save, hold then pass/kick, switch out, both teams, pause, CPU hashes equal the engine-v4 fixture every tick (regenerated in C7 part 3), kickoff tick 60, 11-a-side bounds, checkpoint replay); input.test.ts (keyboard, gamepad R3; a unit test pins the touch pad to no dedicated keeper switch button); the touch keeper switch itself is the keeper-switch stage of touch-e2e (`scripts/smoke-touch.mjs`) | test output and touch-e2e evidence; real controllers and touch feel pending (#44) |
| Replays (C3 #41) | engine.test.ts "replay reconstructs the exact match…"; replay.test.ts (validation, engine version, reference fixture `tests/fixtures/reference-engine-v4.json`) | test output; browser load round-trip is a gap |
| Presentation boundary (C6 #46) | presentation-boundary.test.ts "presentation attached matches headless authority every tick and at fulltime" (frozen snapshots, three camera modes, HUD states, real renderer/radar with fake GPU/DOM, CPU kickoff at tick 60); "presentation imports cannot reach simulation mutators or orchestration"; typecheck rejects nested snapshot writes; local-stage.test.ts "camera changes and repeated draws cannot change authoritative state" | test output; per-tick hashes and final full-world comparison |
| Match sound | audio.test.ts (pure cue mapping, synthesized cues and ambient loop, mute and volume persistence, no context before gesture, missing storage and audio) | test output; browser listening review pending |
| Browser match + CPU vs CPU (C1 #45) | smoke (kickoff taken, clock advances, no page errors) | `match.json`, `cpu-vs-cpu.png`, `video/` |
| Start menu: quick play and first-time tips (C1 #45) | start-menu.test.ts (quick play defaults, `fe.tipsSeen` flag with throwing/missing storage, session flag with a successful read and a failing write, menu reducer); smoke quick-play flow (tips on first match only, sim tick frozen while the tips are open, Enter on the focused button, solo CPU mode, clock advances, no tips after reload); manual: pad A/Cross starts quick play and closes the tips; pad A is ignored while a match runs or a dialog covers the setup | test output; `match.json` → `quick`, `enter`, `quick-play.png` |
| CPU difficulty menu: Fácil / Normal / Difícil | difficulty.test.ts (level → parameters: decision delay, kick error, pressing; Normal equals the current config hash and CPU behaviour; CPU kickoff 60 ticks on every level; `fe.cpuDifficulty` load/save with missing, invalid, blocked and failing storage; online play always Normal; seeded CPU matches repeat for Normal and diverge for Fácil and Difícil); manual: pick a level, reload, the level stays; an unknown stored value falls back to Normal | test output; `npm run evaluate` matches `eval/baseline.json` with `localFailures: 0` |
| Pause and dialogs / fulltime (C2 #42) | pause.test.ts: manual pause, dialog close/cancel decision, terminal state, detached rematch kickoff; smoke: P → Help → close → clock frozen 2s → P → clock advances | test output; `match.json` → `pauseCase`; fulltime buttons require manual browser review |
| Controls / devices (C5 #44) | local-stage.test.ts "two controller identities keep their slots…", "controller charge fires once…" (`controller.ts`); input.test.ts (keyboard, touch, charge, switch, pause, blur, two players, pad dead zone) | test output; `scripts/smoke-gamepad.mjs` scenarios 1–5 and 7 (scenario 2 starts from the smoke hook `window.__feSmoke.ballAtFeet`, webdriver only; the kickoff receiver is checked in `tests/kickoff-receiver.test.ts`), `artifacts/local/smoke/pad.json`; real devices: `docs/manual-device-test.md` (pending) |
| PES 2017 PS4 pad preset (default) | pad-presets.test.ts (literal button and glyph tables, 17 phase-1 rows, no R2 shield, ✕ hold vs ✕ ×2, aerial header, touchpad camera, keyboard map); input.test.ts (pad and keyboard per row, keeper dive priority, tap reset); smoke-gamepad shot on □ | test output; real PS4 pad feel pending (#44) |
| Visual style: silhouettes and palette (C11 #63) | palette.test.ts (team value bands separate for any kit pair, ball brightest, keeper distinct); presentation-boundary.test.ts unchanged | before/after screenshots for the 3 cameras in `docs/evidence/c11/` |
| Player figures and animation (C11 #63) | player-figure.test.ts (pose is pure and does not change frozen snapshots; run, idle and kick poses differ; swing grows with speed; kick uses the preferred foot; turn lean sign; human proportions; only `simulation/math` import); presentation-boundary.test.ts unchanged | before/after screenshots (close, close zoom, broadcast, tactical) in `docs/evidence/c12/` |
| Game feel vs PES (C7 #48) | pes-timing.test.ts / npm run timing:compare: five seeded game timings, approximate public-video PTS validation, exact known-gap and missing-reference register; c7-movement.test.ts / npm run timing:c7: sprint ramp and 180-degree turn vs resumen_final.md ranges | eval/reference/pes-observed.json (32 tiempos: 12 viajes de pase, 11 controles, 6 giros, 3 arranques; 20 nuevos de B, 1 pase elevado descartado; acuerdo numérico 10/12, c03/c05 discrepan y giros A con fases distintas; giro180 0.333 s WITHIN y velocidad máxima 0.383 s BELOW (C7 part 3, the resumen_final.md range supersedes the slice-2 range); brechas: pase/control BELOW; coverage_shortfall: 3/15 arranques, 2/15 giros180), pes-known-gaps.json (C7 part 3: time_to_top_speed_s BELOW); C7 part 3: ramp 383.3 ms inside 300-434 ms and turn180 500 ms inside 434-534 ms, both WITHIN, physical pivot = first zero crossing of the centered-5 mean velocity on the old direction; evaluate still uses design targets and DIRECT_CAPTURE only; replay fixture tests/fixtures/reference-engine-v4.json |
| Keeper controls (PES 2017 PS4) | keeper-controls.test.ts: rush-out, sprint rush-out, hand throw, throw to space, volley, R2+○ high punt, put down/pick up, run with ball, pass feint, dive L1+L2+L3+R3 without R2, PS glyphs and keyboard map; pad-smoke keeper scenario; keeper-e2e (scripts/smoke-keeper.mjs, virtual pad, 10 steps assert rush flag and speed, release kind/height/speed, hold and drop state; screenshots in /workspace/keeper-e2e) | engine-v5; baseline unchanged |
| PS-style touch pad | touch-pad.test.ts; touch-e2e (scripts/smoke-touch.mjs, hasTouch 844x390: 7 controls >=56 px inside safe areas, hidden without touch at 1280x720 and 480x360, labels for attack/defence/keeper hold, multitouch stick+R1+✕ sprint and pass (the slot-0 pass counter of `window.__fe.passes` must grow and the ball's lastTouch must be the slot-0 selected player, or a team-0 pass event must fire), R1+△ rush faster than △, shot 800 ms faster than 200 ms with the ball speed sampled from before the release, release outside the button executes, L1+R2 held together switches the slot-0 cursor to the keeper in defence, a pointercancel during a charged □ fires no shot); keeper-e2e-touch (KEEPER_PATH=touch, 10 keeper steps) | screenshots in artifacts/local/touch-e2e and keeper-e2e-touch, copy in /workspace/touch-e2e; baseline unchanged |
| Set pieces (PES 2017 PS4) | set-pieces.test.ts: second taker beside/behind, L2 second kick, corner attack and defence strategy, wall jump, wall charge, keeper move (free kick and penalty), □/○/✕ power and height, stick curl, L1+✕ short roll, ○+✕ feint, L1+□ panenka; input-set-pieces.test.ts and set-piece-review.test.ts (keyboard and pad flags, release frame, R2 aim lock, guest flags, △ restart pass); input.test.ts touch set-piece regressions (virtual touch through BrowserInput: □/✕ charge and release, R2 aim lock, panenka, short roll, feint, wall jump and wall charge); HUD hint on #set-hint | engine unchanged; baseline unchanged (276 + 3 match fingerprints equal) |
| Static distribution | build + dist-check; build-lab preserves lab smoke | console sizes and violations; lab.png |
| Teams data, online (C8 #49, C9 #50) | none | gap |

Rule: every capability PR updates this table when a capability gains or loses a test or evidence.
