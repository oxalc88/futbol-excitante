## Builder report
- objective_id: HUMAN-DEFENSIVE-DUEL-CONTROL
- builder_agent: builder-gameplay
- builder_model: MiMo
- evidence_class: DYNAMIC_VISUAL + MULTI_TICK
- hypothesis: Human standing + sliding tackle actions added to the playable control stack with ordered prepare→active→recover phases, finite-reach active-window-only contact, recovery lock-out preventing instant re-tackle, velocity-only effects (no teleport), and full additivity when bits 6/7 are not pressed.
- files_changed:
  - src/contracts/input.ts (STANDING_TACKLE_BIT, SLIDE_TACKLE_BIT)
  - src/contracts/scenario.ts (tackle-phase event kind)
  - src/simulation/contacts/tackle-system.ts (NEW — tackle phase machine)
  - src/simulation/config/foundation.ts (FOUNDATION_TACKLE_V1)
  - src/simulation/contacts/contact-system.ts (suppressedActionPlayerIds, ballAlreadyTouched params)
  - src/simulation/loop/simulation.ts (tackleStage wiring)
  - src/simulation/index.ts (tackle-system barrel exports)
  - src/adapters/input-browser/keyboard.ts (U/I key bindings)
  - src/apps/browser/main.ts (hint text)
  - eval/contracts/common-criteria.ts (TACK-*-PHASE criteria)
  - eval/contracts/bindings.ts (TACK-*-PHASE bindings)
  - eval/contracts/invariant-definitions.ts (tackle-phase invariant defs)
  - eval/oracles/tackle-phase.ts (NEW — protected oracle)
  - eval/oracles/wire.ts (oracle registration)
  - eval/runners/foundation-evaluator.ts (CRITERION_TO_ORACLE)
  - eval/runners/defensive-duel-driver.ts (NEW — scripted 5v5 driver)
  - eval/runners/no-tackle-additivity.ts (NEW — additivity runner)
  - eval/scenarios/no-tackle-additivity-baseline.v1.json (baseline hashes)
  - eval/scenarios/frame-tick-offsets.ts (TACK offsets)
  - eval/scenarios/proximate-5v5.ts (NEW — shared proximate 5v5 transform, single source of truth for the duel configuration)
  - tests/unit/eval/duels-suite.test.ts (TACK-*-PHASE assertions)
  - tests/unit/eval/HUMAN-DEFENSIVE-DUEL-CONTROL-binding.test.ts (NEW)
  - tests/unit/eval/no-tackle-additivity.test.ts (rewritten as discriminating gate)
  - tests/unit/input/keyboard.test.ts (button count 4→6)
  - tests/browser/duel-control-screenshot-capture.browser.test.ts (NEW — browser capture; drives the proximate 5v5 duel program and regenerates the PNGs + sequence.json)
  - docs/evidence/HUMAN-DEFENSIVE-DUEL-CONTROL/trajectory.json (121 hashes, verified)
  - docs/screenshots/HUMAN-DEFENSIVE-DUEL-CONTROL/sequence.json (5 real SHA-256)
  - docs/screenshots/HUMAN-DEFENSIVE-DUEL-CONTROL/tack-{before,input,active,contact,recovery}.png (page.screenshot captures)
- commands_run:
  - `pnpm run typecheck`: exit_code 0 (core + node + browser)
  - `npx vitest run tests/unit/eval/duels-suite.test.ts`: exit_code 0 (39 passed)
  - `npx vitest run tests/unit/eval/HUMAN-DEFENSIVE-DUEL-CONTROL-binding.test.ts`: exit_code 0 (18 passed)
  - `npx vitest run tests/unit/eval/no-tackle-additivity.test.ts`: exit_code 0 (5 passed, all byte-identical)
  - `npx vitest run tests/unit/input/keyboard.test.ts`: exit_code 0 (53 passed)
  - `npx vitest run tests/unit/eval/DUEL-REJECTION-FIXTURE-binding.test.ts`: exit_code 0 (10 passed)
  - `npx vitest run tests/unit/eval/SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE-binding.test.ts`: exit_code 0 (5 passed)
  - `npx vitest run tests/unit/eval/SMALL-SIDED-SITUATIONS-BATCH-{1,3,4,5}-binding.test.ts`: exit_code 0 (82 passed)
  - `npx vitest run tests/browser/duel-control-screenshot-capture.browser.test.ts --project browser`: exit_code 0 (2 passed)
  - `npx vitest run tests/unit/eval/duels-suite.test.ts tests/unit/eval/HUMAN-DEFENSIVE-DUEL-CONTROL-binding.test.ts tests/unit/eval/no-tackle-additivity.test.ts tests/unit/input/keyboard.test.ts`: exit_code 0 (115 passed across the 4 files)
  - `pnpm run gauntlet:audit -- --objective HUMAN-DEFENSIVE-DUEL-CONTROL --class DYNAMIC_VISUAL --tests-pass true --integration-test-pass true`: exit_code 0 (all checks PASS)
- tests_run:
  - duels-suite.test.ts: 39 passed
  - HUMAN-DEFENSIVE-DUEL-CONTROL-binding.test.ts: 18 passed
  - no-tackle-additivity.test.ts: 5 passed
  - keyboard.test.ts: 53 passed
  - DUEL-REJECTION-FIXTURE-binding.test.ts: 10 passed
  - SMALL-SIDED-CONTINUOUS-DUEL-AND-SHOT-CLOSURE-binding.test.ts: 5 passed
  - SMALL-SIDED-SITUATIONS-BATCH-1-binding.test.ts: 11 passed
  - SMALL-SIDED-SITUATIONS-BATCH-3-binding.test.ts: 26 passed
  - SMALL-SIDED-SITUATIONS-BATCH-4-binding.test.ts: 26 passed
  - SMALL-SIDED-SITUATIONS-BATCH-5-binding.test.ts: 19 passed
  - duel-control-screenshot-capture.browser.test.ts: 2 passed
- integration_test_result: PASS (binding test proves tick-bound tackle events, phase ordering, recovery lock-out, no teleport, determinism, negative control, and input-rejection for carrier)
- slot_wiring_result: NOT_APPLICABLE
- required_evidence:
  - docs/evidence/HUMAN-DEFENSIVE-DUEL-CONTROL/trajectory.json (121 state hashes, 8 tackle-phase events, 1 input-rejection, 352 player-contacts)
  - docs/screenshots/HUMAN-DEFENSIVE-DUEL-CONTROL/sequence.json (5 labeled semantic frames with pairwise-unique SHA-256)
  - docs/screenshots/HUMAN-DEFENSIVE-DUEL-CONTROL/tack-before.png, tack-input.png, tack-active.png, tack-contact.png, tack-recovery.png (real browser-rendered 205×460 PNGs via page.screenshot())
  - docs/evidence/HUMAN-DEFENSIVE-DUEL-CONTROL/audit.json (audit PASS)
- reproduction:
  - `docs/evidence/HUMAN-DEFENSIVE-DUEL-CONTROL/trajectory.json` is produced by
    `runDefensiveDuel()` in `eval/runners/defensive-duel-driver.ts` (no dedicated
    CLI wrapper is committed; the driver is the entry point) under exactly this
    configuration:
    - scenario: `eval/scenarios/5v5-human-vs-cpu.v1.json` (`5v5-human-vs-cpu-v1`)
      taken through `withProximateHumanDefence()` in
      `eval/scenarios/proximate-5v5.ts` — every player on the HUMAN slot's team
      has its `groundPosition` set to
      `{ x: ball.position.x - 6, y: 0 }` and `linearVelocity` /
      `desiredVelocity` zeroed, so the human can reach the challenge inside the
      tick budget. The binding test's `loadProximate5v5()` and the browser
      capture test both go through that one function. CPU slots run through
      `createCpuAdapter()` + `computeTeamDecision()` as in the browser
      composition root; the HUMAN slot is `slot-1` / `player-1`.
    - human input program: unit-length steer at the challenge point, `sprint: 1`,
      `releasedButtons: 0`, `heldButtons` mirroring the press edge, defensive
      bits otherwise zero (`sourceId: "keyboard"`).
    - tackle attempt pattern (`attempts`, with the driver defaults
      `sprint: 1`):
      1. `{ kind: "standing", commitDistance: 3.0, earliestTick: 30, lockoutFollowUpTicks: 3 }`
         → commits at input tick 43; the `+3` follow-up press at tick 46 lands in
         the standing lock-out and is the rejected press recorded at tick 47.
      2. `{ kind: "slide", commitDistance: 4.0, earliestTick: 80 }`
         → commits at input tick 80.
    - tick count: `maxTicks: 120`.
    - document shape: `state_hashes` is `[sim.stateHash(), ...result.stateHashes]`
      (the pre-step hash at index 0 followed by one hash per stepped tick, so
      121 entries for `total_ticks: 120`); `tackle_attempts` maps
      `result.humanPresses` to `{ tick, bits, kind, lockout }`;
      `tackle_phase_events` / `input_rejections` / `player_contacts` project
      `result.events` of kind `tackle-phase`, `input-rejection`, and
      `player-player-contact` / `player-ball-contact` respectively.
    - verified: this configuration reproduces all 121 committed hashes, the 3
      presses, the 8 tackle-phase events, the single `tackle-lockout` rejection,
      and all 352 contact events byte-for-byte.
  - The 5 PNGs and `sequence.json` come from the single command
    `npx vitest run tests/browser/duel-control-screenshot-capture.browser.test.ts --project browser`.
    That test is the whole capture:
    1. it reads the committed standing-tackle attempt tick out of
       `docs/evidence/HUMAN-DEFENSIVE-DUEL-CONTROL/trajectory.json` (43), so the
       frame centre is derived from the durable trajectory instead of a literal;
    2. it runs `runDefensiveDuel()` over `withProximateHumanDefence()`
       (`eval/scenarios/proximate-5v5.ts`, the same transform
       `tests/unit/eval/HUMAN-DEFENSIVE-DUEL-CONTROL-binding.test.ts` uses) with
       the attempt program above, and requires its press list to equal
       `trajectory.json:tackle_attempts` and the discovered standing-tackle
       input tick to equal the committed one;
    3. it replays that driver program's tick-indexed `InputFrame`s into the
       browser composition root (CPU slots driven live through
       `createCpuAdapter()` + `computeTeamDecision()`), asserting per-tick
       `stateHash` equality with the driver run and that the browser run emits
       the trajectory's standing `prepare/active/recover/release` ticks, its
       `tackle-lockout` rejection tick, and a `standing-tackle`
       player-player contact;
    4. it captures the five PNGs with `page.screenshot()` at
       `inputTick + TACK_*_OFFSET` and then re-reads those bytes through Vitest's
       browser `commands` API, hashes them with WebCrypto, and writes
       `sequence.json` from those hashes.
    Re-running it therefore regenerates the PNGs and `sequence.json` in place
    with metadata/image coherence guaranteed in-test (the test hashes the actual
    screenshot bytes and writes `sequence.json` from them, so the two cannot
    disagree; PNG bytes themselves are not byte-stable across processes, only
    mutually consistent); `node:fs`/`node:crypto`
    are stubbed in browser mode, so the earlier silent fallback that left
    `sequence.json` behind the images is gone — a failed read or write fails the
    test.
- artifacts:
  - eval/runners/defensive-duel-driver.ts — scripted 5v5 human-vs-CPU driver
  - eval/runners/no-tackle-additivity.ts — strictly-additive control shape runner
  - eval/oracles/tackle-phase.ts — protected ordered-phase oracle
  - eval/scenarios/no-tackle-additivity-baseline.v1.json — baseline hashes (5 scenarios, all byte-identical)
  - tests/unit/eval/HUMAN-DEFENSIVE-DUEL-CONTROL-binding.test.ts — binding evidence tests
  - tests/browser/duel-control-screenshot-capture.browser.test.ts — browser capture test
- spec_sections:
  - src/contracts/input.ts (STANDING_TACKLE_BIT / SLIDE_TACKLE_BIT)
  - src/simulation/contacts/tackle-system.ts (phase machine)
  - src/simulation/config/foundation.ts (FOUNDATION_TACKLE_V1)
  - eval/contracts/common-criteria.ts (TACK-ST-001-PHASE, TACK-SL-001-PHASE)
  - eval/oracles/tackle-phase.ts (protected oracle)
- acceptance_criteria_met:
  - Human standing + sliding tackle actions in the playable control stack
  - Ordered prepare→active→recover phases with finite reach
  - Contact eligible ONLY inside explicit active window (no permanent/omnidirectional collider)
  - Recovery prevents instant re-tackle (lock-out)
  - No teleport (velocity-only effects, ball position unchanged)
  - TACK-ST-001-PHASE and TACK-SL-001-PHASE registered as HARD_INVARIANT
  - Oracle FAILs when tackle system is stashed (≥2 players, no tackle evidence)
  - Oracle PASSes on the tackle input programs (TACK-*-PHASE positive path asserted in duels-suite)
  - Browser key bindings (U=standing, I=slide)
  - 5v5 human-vs-CPU coherence: human defender tackles CPU carrier, CPU presser contests human carrier
  - Additivity proven: 5 scenarios × full tick ranges all byte-identical to pre-tackle baseline
  - All accepted binding gate suites pass: DUEL-REJECTION-FIXTURE (10), CONTINUOUS-DUEL-AND-SHOT-CLOSURE (5), BATCH-1 (11), BATCH-3 (26), BATCH-4 (26), BATCH-5 (19)
  - Typecheck green (core + node + browser)
  - Deterministic audit PASS
  - DYNAMIC_VISUAL evidence: 5 real browser-rendered PNGs (page.screenshot()), pairwise-unique SHA-256, event-centered on standing-tackle input tick 43 (before 35, input 43, active 46, contact 47, recovery 57)
- known_gaps:
  - The capture test sizes its container to 800×600, but `page.screenshot()` captures the browser viewport, not that container. The five durable PNGs are therefore 205×460 each (verified from their PNG IHDR headers), not 800×600.
  - Cross-runtime state hashes: the browser capture reproduces the committed trajectory's *event* structure (standing-tackle input tick 43, phases 44/46/50/62, `tackle-lockout` rejection at 47, `standing-tackle` contact at 47) and matches the driver run it replays tick-for-tick inside Chromium, but Chromium's per-tick `stateHash` values diverge from the Node-pinned `trajectory.json` hashes from tick 15 onward. Pinned-runtime determinism is still an open core concern; the PNGs are the Chromium render of the same duel program, not a re-derivation of Node's float states.
  - PES fidelity is NOT claimed. All FOUNDATION_TACKLE_V1 constants are provisional.
- claims_not_made:
  - No PES 2017 fidelity claim
  - No invented reference envelopes or PES thresholds
  - No FOUNDATION_LAB_PASS claim
  - No protected regression PASS (no regression policy exists for tackle)
  - No milestone PASS (objective-level evidence only)
