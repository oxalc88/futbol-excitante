# BALL-SETTLED-REGIME-FIX — Evidence Result

## Objective

Horizon v24 item 2 (amendment for an unsafe newly discovered defect). Fix the
simulation-core defect the accepted 5V5-KICKOFF-ANTI-HUDDLE candidate disclosed:
`src/simulation/ball/ball-system.ts` applied **no physics at all** once
`ball.regime === "settled"` (`// "settled" — no physics. remaining = 0;`), so a
first touch or ground pass could write `ball.linearVelocity` while the ball's
position never moved. Kickoff and ground-pass windows therefore reported real
touch/pass events with zero ball travel, dead-balling the browser 5v5 kickoff
grind and blocking honest organic-pass visual evidence.

## Evidence class

MULTI_TICK — executed tests, a relevant integration-test pass, and
`docs/evidence/BALL-SETTLED-REGIME-FIX/trajectory.json`.

## Result

PASS (candidate). One minimal, deterministic core behaviour change; the accepted
ground↔airborne pitch-contact flood stays closed; every legitimately moved pin is
re-captured with provenance and listed below. No file under `docs/evidence/**` or
`docs/screenshots/**` that predates this objective was rewritten.

## What was built

Only `src/simulation/ball/ball-system.ts` changed in the core (+37/−1 lines;
`git diff` for the whole objective touches exactly one `src/` file):

- new module constant `SETTLED_IMPULSE_WAKE_SPEED = GROUND_SETTLE_SPEED` (0.01),
  documented as **provisional placeholder — not a measured PES value**, model id
  `ball-settled-regime-v2`;
- in the per-tick regime-determination block, a `settled` ball carrying an applied
  impulse at or above that speed (horizontal **or** vertical) enters
  `"ground-roll"`. Vertical speed above the accepted `MIN_LIFT_OFF_VELOCITY` is
  already promoted to `"airborne"` by the accepted lift-off check immediately
  above, so the accepted model decides which regime an impulse enters; no new
  regime is invented;
- the settled branch keeps applying no physics for a ball that was simply left at
  rest — the settle path leaves exactly zero velocity — so the wake cannot fire on
  its own;
- the module header and that branch's comment now state the model.

Why the transition happens exactly once per impulse: ground-roll zeroes vertical
velocity, integrates `position += velocity × dt`, and when planar speed falls
below the accepted `GROUND_SETTLE_SPEED` it re-enters `"settled"` with **all**
velocities zeroed, so the wake predicate is false from then on until a new
impulse arrives. No teleport: the ball is only ever moved by the accepted
integrator and stays an independent 3D entity.

## Commands run

| Command | Exit |
|---|---|
| `pnpm exec tsx scripts/capture-ball-settled-regime-fix.ts` (full artifact, run twice) | 0 |
| `pnpm exec tsx scripts/capture-ball-settled-regime-fix.ts --only=settled-impulse-integrator` / `--only=5v5-kickoff-cpu-vs-cpu` / `--only=5v5-flowing-cpu-vs-cpu` | 0 each |
| `pnpm run typecheck` (core + node + browser configs) | 0 |
| `pnpm run build` (vite production build, 44 modules) | 0 |
| `pnpm exec vitest run --project node tests/unit/ball tests/unit/contacts tests/unit/loop <8 SITUATIONS/CONTINUOUS-DUEL/SHOT-RESULT bindings>` (18 files) | 0 (436 passed) |
| `pnpm exec vitest run --project node <the 9 changed/new test files together>` (final acceptance set) | 0 (167 passed) |
| `pnpm exec vitest run --project node tests/unit/world … tests/unit/cpu-adapter <9 root unit files>` (58 files) | 0 (1186 passed) |
| `pnpm exec vitest run --project node tests/integration <10 files>` | 0 (131 passed) |
| `pnpm exec vitest run --project node tests/integration <15 files>` | 1 (149/151 — 2 pre-existing, see Known gaps) |
| `pnpm exec vitest run --project node tests/integration <11 files>` | 1 (150/153 — 3 pre-existing) |
| `pnpm exec vitest run --project node tests/integration/5v5-kickoff-anti-huddle.test.ts` | 0 (17 passed) |
| `pnpm exec vitest run --project node tests/unit/eval <PRESS-AND-SUPPORT + SITUATION-SCANNER + 3 more bindings, 10 files>` | 1 (91/92 — 1 pre-existing) |
| `pnpm exec vitest run --project node tests/unit/eval <playable / possession / oracle / SMALL-SIDED bindings, 12 files>` | 1 (285/286 — 1 pre-existing) |
| `pnpm exec vitest run --project node tests/unit/eval <playable + 5V5 + action-event + exit-prereq, 10 files>` | 1 (248/249 — 1 pre-existing) |
| `pnpm exec vitest run --project node tests/unit/eval <readability / visual / reducer / situation-evaluator / team-* / archetype / capability, 10 files>` | 0 (199 passed) |
| `pnpm exec vitest run --project node tests/unit/eval <CPU-DEFENSIVE-TACKLE, duels, eval-*, 9 files>` | 0 (201 passed) |
| `pnpm exec vitest run --project node tests/unit/eval <arch-diff, archetype, capability, foundation-*, mutant-*, 15 files>` | 0 (399 passed) |
| `pnpm exec vitest run --project node tests/unit/eval <HUMAN-DEFENSIVE-DUEL, mutant-*, no-tackle-additivity, foundation-*, 9 files>` | 0 (214 passed) |
| `pnpm exec vitest run --project node tests/architecture tests/*.node.test.ts tests/unit/2v2-scoring-long-{a,b,c}` (14 files) | 1 (38/39 — pre-existing `difficulty-capture`) |
| `pnpm exec vitest run --project browser tests/browser/5v5-ai-match.browser.test.ts tests/browser/cpu-tackle-screenshot-capture.browser.test.ts` | 0 (10 passed) |
| stash discrimination: `git stash push src/simulation/ball/ball-system.ts` + the two new guard files | 1 (10 of 23 guards fail) |

The node project was executed in shards because the full suite exceeds the
per-command cap on this host; **every one of the 170 node test files ran against
the final tree** (verified by cross-checking the shard logs against
`find tests -name '*.test.ts' ! -path 'tests/browser/*'`).


## Tests run

| Suite | Result |
|---|---|
| `tests/unit/ball/ball-settled-regime.test.ts` (new, 13 tests) | 13 passed; 7 fail with the fix stashed |
| `tests/integration/ball-settled-regime-match.test.ts` (new, 10 tests, 600-tick CPU-vs-CPU kickoff) | 10 passed; 3 fail with the fix stashed |
| `tests/integration/5v5-kickoff-anti-huddle.test.ts` (this builder's accepted objective, live re-run) | 17 passed — 1 numeric expectation re-pinned, 1 new travel assertion, both disclosed |
| `tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-{1,1-RERUN,2-RERUN,3,4,5}-binding.test.ts` | passed — 36 re-pinned live digests across the four affected bindings (BATCH-1 and BATCH-2-RERUN were verified byte-identical and untouched), every accepted verdict preserved |
| `tests/unit/eval/HUMAN-DEFENSIVE-DUEL-CONTROL-binding.test.ts` | 18 passed — two defect-assertions replaced by the no-teleport bound, one duel program retimed |
| `tests/unit/eval/no-tackle-additivity.test.ts` | 5 passed — one baseline run re-captured, four byte-identical |
| `tests/unit/eval/SMALL-SIDED-{PRESS-AND-SUPPORT-DEPTH-1/2/3,MATCH-SITUATION-SCANNER-1..4}` | 46 passed (read-only trajectory test stays read-only) |
| ball / contacts / loop / world / locomotion / determinism / input / player-contact / replay / scenario / browser / cpu / cpu-adapter / root unit files | 1622 passed across those two shards (18 + 58 files) |
| integration shards — all 26 integration files, executed in three overlapping chunks | every failing test was one of the 5 pre-existing ones under Known gaps; the rest passed (131, 149/151 and 150/153 per chunk) |
| architecture + evidence hygiene + the split 2v2 long-run perf guards | passed except pre-existing `difficulty-capture` |
| browser neighbours: `5v5-ai-match` (incl. browser↔headless hash parity over 120 ticks), `cpu-tackle-screenshot-capture` | 10 passed |

**Discrimination.** With only the settled branch reverted
(`git stash push src/simulation/ball/ball-system.ts`) and the two new guard files
re-run, 10 of 23 tests fail — every position/travel guard, the sub-lift regime
guard, the impulse-density flood guard, the independence guard and the
non-vacuity half of the solver hash chain (`test-results/ballfix-baseline/new-guards-stashed.log`).
The at-rest control, the "below `GROUND_SETTLE_SPEED` stays settled" symmetry
guard, the no-teleport bound and the two-run equality pass in **both** arms by
design: they are preservation guards, and the movement guards are the
discriminating ones.

## Required evidence

`docs/evidence/BALL-SETTLED-REGIME-FIX/trajectory.json` — SHA-256
`0614dc0d5043c68ea5b1dc101223ddf63797159c9bb417eb768a34eec6406451`, ≈701 KB,
byte-identical across two independent passes of the capture command.

**(a) Before state.** Read-only quotation of the accepted, immutable
`docs/evidence/5V5-KICKOFF-ANTI-HUDDLE/trajectory.json` (SHA-256
`29105045e176547bba188e871370cc2aff39ebff04ba0b92ceb366a5e66de5af`, run
`5v5-kickoff-cpu-vs-cpu`, 1200 ticks), embedded under `before_state`. Its kickoff
window: ball settled at (0, 0); first touch at tick 18 writes `vx = -3.466`; the
pass at tick 19 writes `vx = -7.022, vy = -0.043`; `ball.x`/`ball.y` stay exactly
0 through tick 25 and beyond; the run's own summary reports
`ballTravelMetres 0` and `ballDisplacementMetres 0` with 37 touch events present.
That artifact is also the code-level evidence: the reverted branch is quoted in
`before_state.code_branch_before_fix`.

**(b) After state.**

| run | ticks | settled-ball impulse tick | displacement after | regime transitions | pitch contacts / per 100 ticks |
|---|---|---|---|---|---|
| `5v5-kickoff-cpu-vs-cpu` (`eval/scenarios/5v5-fixture-v1.json`, browser-parity CPU wiring) | 600 (10 s) | `[18]` (first touch tick 18) | 2.023 m in the 30 ticks after the touch; 20.772 m travelled / 8.002 m displaced over the window | `[[18,"settled","ground-roll"]]`; per-regime ticks `settled 17 / ground-roll 583` | 0 / 0.0 |
| `5v5-flowing-cpu-vs-cpu` (`eval/scenarios/5v5-continuous-play.v1.json`) | 1200 (20 s) | none — this fixture's ball is never settled when it is played | 76.06 m travelled / 10.927 m displaced | `[[748,"ground-roll","airborne"],[769,"airborne","ground-roll"]]` | 1 / 0.0833 |
| `settled-impulse-integrator` (direct `stepBall`, 2000 ticks per case) | — | impulse applied before tick 0 | ground pass (8 m/s, vz 0.4 < `MIN_LIFT_OFF_VELOCITY`): 0.1307 m in one tick, 1.195 m in ten, 6.525 m over the window; first touch (3 m/s): 0.049 / 0.448 / 2.442 m; shot (9.6 m/s, vz 1.8): 11.186 m; lofted pass (7.5 m/s, vz 1.875): 8.630 m; control (no impulse): 0 m | ground pass `settled→ground-roll@0`, `→settled@330`; first touch `@0`, `@282`; shot `settled→airborne@0`, `→ground-roll@21`, `→settled@359`; lofted `@0/@21/@347`; control: none | ground/first-touch 0 contacts; shot and lofted pass 1 landing contact each; control 0 |

Flood-guard numbers on the long runs: max per-tick ball step 0.1147 m (kickoff)
and 0.3849 m (flowing) against the accepted 2 m no-teleport convention; at most 1
contact in any single tick; 0.0833 contacts per 100 ticks against the regression
bound of 5 per 100 ticks asserted in `tests/integration/ball-settled-regime-match.test.ts`
(the flood signature is a contact on nearly every tick, ≈60 per 100). The accepted
per-file-worker 2v2 long-run perf guards (`2v2-scoring-long-a/b/c`) also pass,
which is the same flood from the timing side, and the accepted
`SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE` / `SHOT_TO_RESULT` pitch-contact
binding arms stay green.

**(c) Two-run determinism.** In-process replays inside the capture script:
kickoff `replay_identical: true` at
`5429c0141d5653ad261d994e3831dacfa44aeafe54fd9e753f956e53bffd4f8c`, flowing
`replay_identical: true` at
`ae69bd411dd2d6a7507935afe0118a669ce77c2a95001dbdeebfa09a5b418aa1`, solver script
`replay_identical: true` at
`58fa7913041d38d1d7c8adfb9451f99bf2f6c44d7910f60d73f4082bb3557e1e`.
Cross-process: two full passes of the capture command produced byte-identical
artifacts (`0614dc0d…`). The new match test additionally asserts two identical
600-tick runs produce equal per-tick hash chains, and
`tests/unit/ball/ball-settled-regime.test.ts` asserts equal canonical
(`encodeCanonical` + `hashFnv1a64`) chains for the impulse script.

## Pin changes (old → new, with the reason)

Every entry below is a live byte-pin whose scenario plays a ball that was
**settled** at the moment of the impulse; the accepted durable artifact is
immutable, so each binding now pins two digests — `accepted` (the before-state,
asserted unchanged) and `live` (re-captured from the current tree). Reason in
every case: the settled ball now integrates the applied impulse, so its per-tick
trajectory — and every downstream committed state hash — diverges from the tick
the ball was played. **No accepted verdict, relevant event kind, relevant event
count or index verdict changed** in any of these scenarios; each re-pinned
binding asserts that reproduction explicitly.

| batch | pin table | key | accepted (before-state, still asserted) | live (re-captured) |
|---|---|---|---|---|
| BATCH-1-RERUN | SITUATION | PASS_RECEPTION | `088a7c9cec1fb0c4b2f3959d13bccc81c47bc70abc941cd50eb33ea7d0b64459` | `4c46b2b876c456f08500ea22f841906f46becd5028d45b3b0b0777102055c02f` |
| BATCH-1-RERUN | SITUATION | SHOT_TO_RESULT | `07e793c605ca7596499dc280e6a7e6cbe99e7d0b5376cd9574f3797217999b7c` | `e44ecfaaefc2d1c5e922c7e8e89675ecf2510d03d250e6789133692eeb31733a` |
| BATCH-1-RERUN | SITUATION | PHYSICAL_DUEL | `fda30beb842f93acefdb95d43bc03e836da838fddd2605c7739e47fc389a74e5` | `5b17359c34549514bbe03d18dc567d2326cd3e9c5749ee6c83772757fc6a4b16` |
| BATCH-1-RERUN | SITUATION | SUPPORT_AND_PASSING_LANES | `ca87c6b864a7ff0f1531870fd91e00251fc961461b32096754578c02646a1180` | `ca189034d545ffad7bbd49c30bdb45adf4936f50ef3f6e80038be2d19692abea` |
| BATCH-1-RERUN | SITUATION | SETTLED_ATTACK_VS_DEFENCE | `01698e2a1a4da435caed9d45329ea5c684a0660ceae9b4f13322a1cfe02ca697` | `0a377786be1e0ac53bd7f051b54babb807ee8292fc4b5e3b7f7604dc9e895b4c` |
| BATCH-1-RERUN | TRAJECTORY | (all 5 share one chain) | `d2805ac848ffeafd28c71b5983aa8b122fe88f64c60e7259f50c6245c90ecc06` | `ff0d09fb923b1057fc133be34e49dbe623eb16c6ad404d6120178b21c91efef9` |
| BATCH-1-RERUN | INDEX | index.json | `a1479da4bc7760ef74ea15ad4b50c29bc7ececb6c8038e6949ed1ba9585efdf3` | `e0bae47f8bbcca99d48bdeb16e6c635fd5fdaa23a8638effcef2424d3e7cd1b8` |
| BATCH-3 | SITUATION | PASS_RECEPTION | `1d1b7d3775880040ca42be40065a12255a718451d2d9812ce376c129acf75507` | `880007590ca8578db03712d9f4f33de0ce39e0ea9740d2a5d706de34e95186ca` |
| BATCH-3 | SITUATION | SHOT_TO_RESULT | `ba816b9ece333bc6b13486d65501d6363a71b2d52334d4519398d353404133db` | `8483cbf5a79a871da303102c6a1d72fe12831de27b1920b4c77a9288fff527bd` |
| BATCH-3 | SITUATION | PHYSICAL_DUEL | `3ded5062d1dce66c49e7fe97719d20737bc5bd04d7806397b6e664faf93b6543` | `c448b0e6b4d66ee2ae75a5c668bac3f1adc8286f1323f6490b42867805abc3c1` |
| BATCH-3 | SITUATION | SUPPORT_AND_PASSING_LANES | `dc270bbe976773c291711053061c68c30dec05860595c2b92e21f9c0026603cc` | `f5c1dc2af0785e30404d8f278117bd1917103bdb3eae96fd9b70e6676574e10c` |
| BATCH-3 | SITUATION | SETTLED_ATTACK_VS_DEFENCE | `4573ae6ea8604f43aa3e1c2df6ed4b5aaf33ec86e04903dda5568177795e07e7` | `0f73176c4c3d054d82f9f21afbb36bbe3d46fb6ccda250a66ab5c5f6e1df0014` |
| BATCH-3 | SITUATION | ATTACK_TO_DEFENCE_TRANSITION | `ee374ea9d4e192688a981d0afb91da1869889d807bfda41f5d304b1e6b399d36` | `14d37ffc265964cd77a9d9a990d621466192ed4f7707f42488a8da042f48ca20` |
| BATCH-3 | SITUATION | DEFENCE_TO_ATTACK_TRANSITION | `35d7bf8ff5bf7f2ebea8a474507b47d65b2fbc566ce08c4b690fbf0abdb2eb05` | `2dfdfb2868c845a9f05e9f04143d9aa6ee1da726dcb4764b89e71bbcb9bd111f` |
| BATCH-3 | SITUATION | COORDINATED_PRESS | `6dd2cdbbeaff059dec641b68f7d1c490823e640903f451ac9783244e754b5fb6` | `b3b595a0e589ea28ba037f86ae1d318f6aa226c45874275317da9340ec96dc57` |
| BATCH-3 | TRAJECTORY | (all 8 share one chain) | `33948b7eb9d426a90e1a6678f40f2ab6b2a0b395c0b07277acee40f1696ace38` | `cc2dd1b0314df64b655533859a70a46a1de01765adcf32d79652a48bf59876a4` |
| BATCH-3 | INDEX | index.json | `25e28d52c552113764505c9c974716865912e199b5fb135d983095bac03fa32e` | `1c2732bf5f8688d43c291bd7753207d59ff07c27a84141dad443b3cf7eb5be2e` |
| BATCH-4 | SITUATION + TRAJECTORY + INDEX | (same extended fixture as BATCH-3) | identical values to the BATCH-3 rows above | identical values to the BATCH-3 rows above |
| BATCH-5 | SITUATION | PASS_RECEPTION | `5a3607c4cb3f52d6412a1ebf9ab88659a670a57622ed56f829d54390b0cd5186` | `e84e82ecc5b0bce786d11c199de08f311ea1169a0ea005d7748d272c9ae7b85f` |
| BATCH-5 | SITUATION | SUPPORT_AND_PASSING_LANES | `082210cec3115dae1abac55f5f6fadac58354d0b7757cb7ccccf62e96287a2a4` | `e325a36e5f398264c0af22b116e1ab3ba77ce1eb53de141dbd588447b2fc59cd` |
| BATCH-5 | SITUATION | SETTLED_ATTACK_VS_DEFENCE | `7c34b2bfb0cdcbdbaa5aaa7b9e0d6d7c9079ee40bec4f0bb6abd36588e4138e9` | `0fc3d839440488b4832e6d8b07bc05eb9fd22603c9f2e9e7b3ec068ebf9908d1` |
| BATCH-5 | SITUATION | ATTACK_TO_DEFENCE_TRANSITION | `7311152cb115bf2df74a347c87b96e9d2853e240d1e4637d06b217aacc4443a2` | `93a9de3483e01cbb9538630c9a58551017226547a1058a06ca7634b59b09e0e6` |
| BATCH-5 | SITUATION | DEFENCE_TO_ATTACK_TRANSITION | `925173bfe2595fec1822d326822a84d2dc4eb14e353379cb0dcbee9eca52b267` | `0fd03b7f41977248baf47d8a926d09ec0c289461a0b141090d3c28ea5435e7e7` |
| BATCH-5 | SITUATION | COORDINATED_PRESS | `0dfc70f4f8640356eeeff61dff060ff51320fe6ae65d95379087f48bf7c63ed1` | `69cde80291c95effa48f1ca6c957f9934e445e7a773aa1dd712adb989d019db6` |
| BATCH-5 | SITUATION | PHYSICAL_DUEL (duel-rejection fixture) | `5ef9ba577cbbbe1923997952ef1732a8994a5d7f6e6764375a679d2a37e97c3d` | `2effaec8c3275f05dc509361c987a6857f6e5fd597a8473a80e5b937d87292d6` |
| BATCH-5 | TRAJECTORY | extended-fixture situations | `33948b7eb9d426a90e1a6678f40f2ab6b2a0b395c0b07277acee40f1696ace38` | `cc2dd1b0314df64b655533859a70a46a1de01765adcf32d79652a48bf59876a4` |
| BATCH-5 | TRAJECTORY | PHYSICAL_DUEL | `4c0b6970dcfe6c409f19c13f635f2ac9d5444b30b7bf20a47c7e472194f9fa66` | `cb473a45bf73e65667e252490e20549d1bc239e3e5d8512576aa89c104e567db` |
| BATCH-5 | SITUATION + TRAJECTORY | **SHOT_TO_RESULT** (shot-resolution fixture) | `e0afe1d2340c151d57daba3797517bfb85c870c47322c60b3be81a4abe5fa0df` / `da9cafd4dc4355a241c1dc53533c885eac60a5886094a1f2141923dd7e39d4be` | **unchanged** — that fixture never plays a settled ball; verified by re-running it, and the test asserts accepted == live for it |

Unaffected pins, verified rather than assumed: `BATCH-1` and `BATCH-2-RERUN`
bindings, `SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE-binding`,
`DUEL-REJECTION-FIXTURE-binding`, `CPU-DEFENSIVE-TACKLE-binding`,
`SMALL-SIDED-PRESS-AND-SUPPORT-DEPTH-{1,2,3}` (the read-only trajectory test stays
read-only and still reproduces its accepted geometry), the four situation-scanner
tests, and every durable artifact under `docs/evidence/**` (git reports zero
modifications there).

Three further accepted test expectations legitimately moved and were updated in
place rather than re-pinned:

- `tests/integration/5v5-kickoff-anti-huddle.test.ts`: the 240-tick kickoff
  window's *density* numbers were measured on a dead ball. Accepted
  `huddleTicks 0` / max 2 same-team bodies inside 5 m → live `huddleTicks 62` /
  max 3, because the ball is now played (7.77 m travelled in that window) and
  support bodies legitimately arrive near a moving ball. Still asserted and
  passing: kickoff freeze displacement `0.000` m with only the taker moving,
  exactly one designated chaser per team per tick, one presser + one cover behind
  it, organic passes firing, and the stashed-control discrimination (stashed: no
  touch at all, 0 m travel, 87 huddle ticks, clump 5 deep). The new density
  assertion requires strictly fewer huddle ticks and a strictly shallower clump
  than the stashed arm in the same window, and a new test asserts the ball now
  travels (which failed before this fix).
- `tests/unit/eval/HUMAN-DEFENSIVE-DUEL-CONTROL-binding.test.ts`: two assertions
  required the ball's position to be byte-unchanged across an entire duel run —
  that invariance **was** the defect (a deflected settled ball carried velocity
  and integrated nothing). They now assert the protected property instead: every
  per-tick ball step stays inside the accepted 2 m no-teleport bound, plus
  non-vacuity that the ball travels. The resolver's own invariance assertion
  ("a won ball contact records identical incoming and outgoing ball position")
  is untouched and still passes. One duel test moved its attempt `earliestTick`
  30 → 48 so the same contact kind (a standing duel with the ball outside reach)
  still occurs; every payload expectation in it is unchanged. The two-run
  determinism test keeps its assertions and gained the file's own
  `DRIVER_TIMEOUT`, because 5v5 CPU runs now exceed the 5 s default on a loaded
  worker (they are byte-identical in a clean process).
- `eval/scenarios/no-tackle-additivity-baseline.v1.json`: only the
  `duel-rejection-fixture` run moved — final hash
  `fnv1a64-v1:f75ef7cb99e0345b` → `fnv1a64-v1:7262ba8667f228b8`, first divergence
  at tick 2 where the scripted duel touch lands on a settled ball. Recorded with a
  `pin_provenance` field on that entry; the other four runs were re-captured and
  are byte-identical to the accepted baseline.

## Files changed

| File | Change |
|---|---|
| `src/simulation/ball/ball-system.ts` | the fix: `SETTLED_IMPULSE_WAKE_SPEED` + the settled→ground-roll wake transition (`ball-settled-regime-v2`) |
| `tests/unit/ball/ball-settled-regime.test.ts` | new — 13 primitive guards with an at-rest control |
| `tests/integration/ball-settled-regime-match.test.ts` | new — 10 match guards over a 600-tick CPU-vs-CPU kickoff |
| `scripts/capture-ball-settled-regime-fix.ts` | new — this objective's evidence producer (steppable via `--only=`) |
| `docs/evidence/BALL-SETTLED-REGIME-FIX/trajectory.json` | new — this objective's evidence |
| `docs/evidence/BALL-SETTLED-REGIME-FIX/RESULT.md` | new — this file |
| `tests/unit/eval/situation-run-pin-binding.ts` | new — shared digest helpers for the situation bindings |
| `tests/integration/5v5-kickoff-anti-huddle.test.ts` | re-pinned kickoff density numeric + new travel assertion, with provenance |
| `tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-{1-RERUN,3,4,5}-binding.test.ts` | two-arm pins (accepted before-state + re-captured live), verdict reproduction kept |
| `tests/unit/eval/HUMAN-DEFENSIVE-DUEL-CONTROL-binding.test.ts` | defect-assertions replaced by the no-teleport bound; duel program retimed; determinism test given the file's own timeout |
| `eval/scenarios/no-tackle-additivity-baseline.v1.json` | one run's hashes re-captured with `pin_provenance`; four runs untouched |

Nothing else under `src/`, `eval/`, `specs/`, `research/`, `gauntlet/` or
`docs/evidence/**` changed. No commit or push was made.

## Known gaps

- **Pre-existing node-suite failures, unchanged by this objective** (owned by the
  separate gate objective, and not used as acceptance evidence here):
  `tests/integration/compare-foundation.test.ts` (2),
  `tests/integration/nondeterminism-canary.test.ts` (2),
  `tests/integration/match-lifecycle.test.ts` → `MATCH-LIFECYCLE-004 determinism` (1),
  `tests/unit/eval/playable-1v1-re-evaluation.test.ts` (1),
  `tests/unit/eval/SMALL-SIDED-COHERENT-EVIDENCE-RERUN-binding.test.ts` (1),
  `tests/difficulty-capture.node.test.ts` (1). Each was re-verified to fail with
  this objective's fix stashed as well, so this objective neither caused nor fixed them.
- `tests/integration/match-set-piece.test.ts` (also on that pre-existing list)
  **passed** both with the fix and with it stashed in this session's shards. It was
  not reproduced, so it is not claimed as fixed.
- Vitest worker RPC timeouts (`Timeout calling "onTaskUpdate"`) appear when many
  long 5v5/CPU files share one worker; shards were split to stay inside that
  budget. One such unhandled worker error surfaced in a 17-file eval shard that
  reported every test passing — an infrastructure limit, not a gameplay failure.
- The wake threshold (0.01 m/s) is a provisional placeholder derived from the
  accepted settle threshold. No PES 2017 value was measured, invented or claimed,
  and the constant was deliberately not added to `FOUNDATION_BALL_V1` because it
  reuses an existing accepted threshold rather than introducing a new tunable.
- Live-ball same-team density inside 5 m of the ball in the kickoff window
  (max 3 bodies, 62 huddle ticks in a 240-tick window) has no accepted reference
  bar; it is reported as measured and only compared with the stashed shape.
- Longer CPU windows were not captured: 1800-tick kickoff windows are still
  quadratically expensive in wall time on this host, so the after-state match
  windows are 600 and 1200 ticks.
- **Capture hygiene, pre-existing.** `tests/browser/5v5-ai-match.browser.test.ts`
  writes into `docs/screenshots/BROWSER-5V5-MATCH/frame-000.png` during an ordinary
  browser run (it does so with this fix stashed too), which the 0.9.2 capture-hygiene
  rule forbids. That screenshot's pixels also legitimately change now that the match
  plays a live ball. The file was restored with `git checkout` after the neighbour run
  and is byte-clean in this candidate; repairing the suite's write path is a separate
  hygiene objective.
- `pnpm run gauntlet:audit` was not executed: writing
  `docs/evidence/<objective>/audit.json` belongs to the orchestrator's pre-critic gate.

## Claims not made

- No PROMOTION, no milestone verdict, no `FOUNDATION_LAB_PASS`.
- No PES 2017 fidelity, calibration or measured-constant claim; no reference
  envelope or tolerance invented to make any test pass.
- No regression `PASS` for the repository gate beyond the executed evidence above;
  the pre-existing failures are disclosed, not absorbed.
- No re-adjudication of the accepted SMALL-SIDED scanner / situation / milestone
  claims: that re-run belongs to SMALL-SIDED-ORGANIC-PASS-FLOW-CLOSURE. The
  re-pinned bindings preserve accepted verdicts; they do not re-decide them.
- No claim that the ball is attached to, held by, or teleported to a controller:
  it remains an independent 3D entity moved only by `stepBall`.
- No goalkeeper, regulation-rules or 11v11 behaviour is claimed or implied.
- No organic-pass-flow, visual-quality or gameplay-feel claim; the next objective
  owns the browser pass-flow evidence this fix unblocks.
