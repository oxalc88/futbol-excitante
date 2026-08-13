# Bootstrap Plan — Executable Gameplay Laboratory

**Status:** implementation plan

**Scope:** development/evaluation platform only

**Target gate:** `BOOTSTRAP_READY` (not `FOUNDATION_LAB_PASS`)

## 1. Outcome

The bootstrap delivers the smallest useful vertical slice of the architecture in the finalized specifications:

```text
versioned scenario + seed + tick-indexed inputs
                       |
                       v
             synchronous fixed-step core
               |        |         |
               v        v         v
          headless   replay    presentation snapshots
             |                     |
             v                     v
      telemetry + metrics     primitive Three.js view
             |                     |
             +----------+----------+
                        v
             repeat / compare / inspect
```

At the end, an autonomous gameplay iteration can change a provisional locomotion or ball parameter, run a deterministic scenario, inspect invariant and metric output, compare two runs, replay the exact input stream, and view the same scenario in a browser.

This bootstrap does **not** claim PES fidelity or formal `FOUNDATION_LAB` promotion. The Gameplay Evaluation Specification explicitly says that the catalog is not executable until its scenario, observation, metric, invariant, binding, suite, schema, and protected-oracle registries are materialized. Bootstrap results therefore use internal `BOOTSTRAP-*` IDs and only pass or fail executable hard invariants. They never turn absent reference targets or regression tolerances into a pass.

## 2. Scope boundaries

Included:

- one private pnpm-managed TypeScript/ESM package with logical source boundaries;
- a synchronous, DOM-free simulation core;
- a versioned provisional fixed timestep;
- explicit, seedable PRNG state;
- one basic kinematic player and one independent 3D ball;
- normalized, tick-indexed input for one stable control slot;
- progressive player movement and primitive free-ball integration;
- declarative deterministic scenario startup;
- exact-tick headless execution;
- canonical state serialization, hashing, checkpoints, input recording, and replay verification;
- structured telemetry, a few protected bootstrap invariants, and deterministic summary metrics;
- a primitive Three.js renderer and keyboard adapter;
- Node and real-browser smoke tests through Vitest, Vite, and one automated entry point.

Excluded:

- 11v11, player/player or player/ball contacts, possession, dribbling, passing, shooting, tackling, goalkeepers, rules, match clock, AI, tactics, stamina, animation rigs, networking, external roster data, polished physics, final visual style, production art, LOD, effects, and autonomous promotion;
- reference-target comparison, perceptual scoring, invented gameplay thresholds, and candidate-versus-best pass/fail decisions;
- workers, ECS, Rapier, WebAssembly, WebGPU, databases, and separately published packages.

## 3. Bootstrap decisions

These choices make the platform executable without pretending to settle deferred gameplay questions:

| Concern | Bootstrap choice | Constraint |
|---|---|---|
| Physical layout | One private pnpm package; folders enforce logical boundaries | Split packages only when an independent consumer requires it |
| Tool management | mise with committed `mise.toml` and `mise.lock` | mise pins tool versions/checksums; no `.nvmrc`, Volta, or ad hoc global versions |
| Runtime/package manager | Node `24.18.0` and pnpm `11.10.0`, pinned by mise; `packageManager` also names pnpm exactly | Same pinned build/runtime is the determinism guarantee |
| Core | TypeScript, ESM, synchronous API, JavaScript `Number` | No DOM, Node I/O, renderer, device, or wall-clock access |
| Fixed step | `foundation-fixed-dt-v1`, provisionally `1/60 s` as a rational value | This is a laboratory choice, not a calibrated football constant |
| PRNG | Mulberry32 under the explicit ID `mulberry32-v1` | No `Math.random()` in authoritative code; algorithm changes require a new ID |
| State encoding | `canonical-json-v1`: finite numbers, sorted object keys, stable entity arrays, explicit schema/version fields | Special numbers are rejected before serialization |
| State hash | FNV-1a 64-bit under `fnv1a64-v1`, over bytes from a local versioned UTF-8 encoder | Collision resistance is not claimed; the algorithm/version is replay provenance |
| Player | Planar ground position/velocity with separate desired velocity and body/desired heading | All coefficients live in `foundation-locomotion-v1` and are provisional |
| Ball | Independent 3D state with gravity, pitch-plane impact, bounce, ground resistance, and spin decay | No ownership, homing, player contact, curve force, or final solver claim |
| Rendering | Three.js, fixed top-down/oblique camera, primitive pitch/player/ball, ball shadow, controlled-player marker | Renderer reads immutable presentation snapshots only |
| Tests | Vitest projects for Node and browser tests; browser project uses Vite and the Playwright provider | No separate Playwright Test suite or second assertion/test lifecycle |
| Evaluation | Bootstrap hard invariants and descriptive metric deltas | No PES target, perceptual, or regression-policy verdict |

Coordinate and unit conventions follow the Technical Specification: SI units; pitch centre at the origin; `+x` along pitch length, `+y` across its width, `+z` upward; planar players and a 3D ball. The bootstrap scenario may use a 105 m × 68 m fixture, but pitch dimensions remain scenario configuration rather than a universal engine constant.

## 4. Minimum domain and invariants

`WorldState` is the consistency root for a run. It owns tick, scheduler/input policy state, PRNG state, active players, and the ball. `PlayerState` and `BallState` have stable identities. `InputFrame`, vectors, fixed-duration values, configuration references, and scenario definitions are versioned values rather than hidden globals.

The first executable invariant set is deliberately small:

- `BOOTSTRAP-FINITE`: every canonical number is finite;
- `BOOTSTRAP-DETERMINISTIC`: two identical pinned run contracts produce the same hash at every tick;
- `BOOTSTRAP-REFERENCES`: IDs are unique, control assignments resolve, and ordered event references resolve;
- `BOOTSTRAP-BOUNDS`: scenario hard safety bounds are never exceeded;
- `BOOTSTRAP-BALL-CONTINUITY`: every discontinuous ball-velocity change is explained by an ordered scenario or pitch-contact event;
- `BOOTSTRAP-BALL-INDEPENDENT`: control/input/player state never parents or directly rewrites the ball.

Pitch touchlines are not rules in this phase. `BOOTSTRAP-BOUNDS` uses generous scenario safety bounds to catch corrupt state, not to implement out-of-play behavior.

## 5. Proposed repository shape

```text
package.json
pnpm-lock.yaml
mise.toml
mise.lock
.gitignore
tsconfig.json
tsconfig.core.json
tsconfig.node.json
tsconfig.browser.json
vite.config.ts
vitest.config.ts

src/
  contracts/
    math.ts
    input.ts
    state.ts
    scenario.ts
    telemetry.ts
    replay.ts
    presentation.ts
  simulation/
    config/foundation.ts
    determinism/{rng,canonical,utf8,hash,finite}.ts
    world/{create,validate,clone}.ts
    loop/simulation.ts
    input/input-system.ts
    locomotion/locomotion-system.ts
    ball/ball-system.ts
    telemetry/observer.ts
  adapters/
    replay/replay-codec.ts
    input-browser/keyboard.ts
    renderer-three/renderer.ts
  apps/
    headless/{cli,run,artifacts}.ts
    browser/{index.html,main,styles,test-bridge}.ts

eval/
  contracts/bootstrap-registry.ts
  scenarios/foundation-move-and-roll.v1.json
  runners/{evaluate,compare}.ts
  recording/recorder.ts
  metrics/{player-motion,ball-motion}.ts
  invariants/{finite,references,bounds,ball-continuity}.ts

tests/
  architecture/
  unit/
  integration/
  browser/

artifacts/                  generated and git-ignored except `.gitkeep`
```

Barrel files should be added only where they define a real public boundary. Internal modules should use direct imports so dependency direction stays obvious.

## 6. Implementation steps

Every step is independently reviewable. A step is complete only after its required tests pass; later steps depend on the accepted behavior, not merely on files being present.

### Step 1 — Pin the toolchain and create the executable skeleton

**Objective**

Create one installable, buildable TypeScript/ESM project managed by pnpm and a mise-pinned toolchain, with separate type-check environments for the portable core, Node composition, and browser composition.

**Dependencies**

None.

**Files/packages affected**

- Root: `package.json`, `pnpm-lock.yaml`, `mise.toml`, `mise.lock`, `.gitignore`, `tsconfig*.json`, `vite.config.ts`, and `vitest.config.ts`.
- Initial folders under `src/`, `eval/`, `tests/`, and `artifacts/.gitkeep`.
- Runtime dependency: `three` only.
- Development dependencies: TypeScript, Vite, Vitest, `@vitest/browser-playwright`, its compatible Playwright dependency, `tsx`, Node types, and only the type support required by the selected Three.js version.

**Acceptance criteria**

- `mise.toml` pins the tools directly and enables lockfile use:

  ```toml
  [tools]
  node = "24.18.0"
  pnpm = "11.10.0"

  [settings]
  lockfile = true
  ```

- `mise.lock` is generated with `mise lock`, committed, and contains the supported development/CI platform resolutions and checksums available from each backend.
- `mise install --locked` resolves the committed Node and pnpm tools from `mise.lock`; no `.nvmrc` is present.
- `pnpm install --frozen-lockfile` installs without modifying `pnpm-lock.yaml`.
- `pnpm run typecheck` checks core, Node, and browser configurations.
- `pnpm run build` creates the browser bundle from an empty/minimal composition root through Vite.
- The package is private and ESM; `packageManager` is exactly `pnpm@11.10.0`, and mise is the authority for installed Node/pnpm versions.
- `vitest.config.ts` defines named Node and browser projects while reusing the Vite configuration; it does not fork aliases, transforms, or browser build behavior.
- No npm lockfile, `.nvmrc`, Playwright Test configuration, workspace, or separately published package is introduced.

**Tests required**

- A Vitest toolchain smoke test imports one module through ESM.
- A build smoke test proves the Vite entry resolves.
- A core TypeScript configuration check fails if DOM or Node globals are used in `src/contracts/**` or `src/simulation/**`.
- A toolchain check asserts the active Node/pnpm versions match `mise.toml` and that the pnpm lockfile is frozen.

### Step 2 — Define portable contracts and versioned configuration

**Objective**

Define the minimum data vocabulary shared by the simulation, runner, replay, evaluator, and renderer before implementing behavior.

**Dependencies**

Step 1.

**Files/packages affected**

- `src/contracts/{math,input,state,scenario,telemetry,replay,presentation}.ts`.
- `src/simulation/config/foundation.ts`.
- `src/simulation/world/validate.ts`.

**Acceptance criteria**

- Contracts cover `Vec2`, `Vec3`, `InputFrame`, stable control assignment, `PlayerState`, independent `BallState`, `WorldState`, `ScenarioDefinition`, `SimulationEvent`, `PresentationSnapshot`, telemetry records, and `ReplayV1`.
- `WorldState` includes schema/simulation/config versions, committed tick, rational fixed step, PRNG state, input-policy memory, stable players, ball, and ordered events/scheduler state that can affect continuation.
- The laboratory profile validates 1–22 declared active players and exactly one ball; the bootstrap fixture declares exactly one player.
- IDs, collection order, axes, units, button bits, missing-input policy, and event ordering keys are documented in types.
- All provisional locomotion and ball values live in one immutable versioned config; no behavior constant is buried in a system.
- Validation rejects non-finite values, duplicate IDs, unresolved assignments, invalid vector/input ranges, invalid fixed durations, and incompatible schema/config versions.

**Tests required**

- Contract fixtures validate a legal one-player/one-ball state.
- Table-driven negative tests reject every invalid condition above.
- A type-only test proves contracts compile without Three.js, DOM, Node, or filesystem types.

### Step 3 — Implement deterministic primitives

**Objective**

Provide the reproducibility substrate before any gameplay system consumes it.

**Dependencies**

Steps 1–2.

**Files/packages affected**

- `src/simulation/determinism/{rng,canonical,utf8,hash,finite}.ts`.
- `tests/unit/determinism/*.test.ts`.
- `tests/architecture/core-boundary.test.ts`.

**Acceptance criteria**

- The PRNG exposes algorithm/version, `nextUint32`, `nextFloat01`, snapshot, and restore from an explicit uint32 seed.
- Known seeds produce documented vectors; restoring a PRNG state continues the same sequence.
- Canonical encoding fixes schema version, field/key order, array order, string encoding, numeric encoding, and treatment of `-0`; NaN and infinities fail closed.
- The state hash always includes the hash algorithm ID and is identical for semantically identical canonical values regardless of object insertion order.
- Authoritative source contains no `Math.random`, `Date`, `performance`, timers, browser API, Node API, network API, or filesystem API.

**Tests required**

- PRNG known-vector, repeatability, snapshot/restore, and different-seed tests.
- Canonical serialization golden tests, including reordered keys, stable player order, `-0`, and escaped Unicode.
- Hash known-vector and mutation-sensitivity tests.
- A TypeScript-AST architecture test rejects forbidden imports and global calls in the core.

### Step 4 — Create deterministic world and scenario startup

**Objective**

Turn a declarative scenario plus immutable config and seed into a complete reproducible initial world.

**Dependencies**

Steps 2–3.

**Files/packages affected**

- `src/simulation/world/{create,validate,clone}.ts`.
- `eval/scenarios/foundation-move-and-roll.v1.json`.
- `eval/contracts/bootstrap-registry.ts`.
- `tests/unit/world/*.test.ts`.

**Acceptance criteria**

- The fixture declares scenario ID/version/family, duration ticks, exact seed, fixed-step/config IDs, pitch/safety geometry, one stable player, one independent ball, stable control assignment, tick-indexed input program, observation window, requested metrics, and no undeclared defaults.
- Scenario loading validates before world creation and does not mutate the loaded definition.
- Active players are sorted by `playerId`; array position never creates identity.
- Two startups with the same scenario/config/seed have byte-identical canonical state and the same initial hash.
- Changing the seed or any authoritative initial value changes canonical state/provenance.
- Direct setup occurs only in initial state; later teleports are not available in the bootstrap event vocabulary.

**Tests required**

- Initial-state golden serialization/hash test.
- Same-start repeatability and changed-seed/config sensitivity tests.
- Invalid scenario/schema/reference tests.
- Mutation test proving the source scenario object remains unchanged after world creation.

### Step 5 — Implement the synchronous fixed-step simulation API

**Objective**

Create the one authoritative stepping path used later by both Node and browser adapters.

**Dependencies**

Steps 2–4.

**Files/packages affected**

- `src/simulation/loop/simulation.ts`.
- `src/simulation/telemetry/observer.ts` for the no-op observer contract only.
- `tests/unit/loop/simulation.test.ts`.

**Acceptance criteria**

- The API provides `tick`, `applyInputs`, `step`, `snapshot`, `presentation`, `restore`, and `stateHash` synchronously.
- An `InputFrame` for tick `t` is applied only while committed world tick is `t`; one `step()` commits world tick `t + 1` and returns the committed tick, ordered events, and state hash.
- The bootstrap scheduler stages only scheduled scenario events, input resolution, locomotion, ball integration, invariant validation, presentation derivation, and commit. Read/write ownership and event sort keys are documented.
- `fixedDt` is derived from the versioned rational configuration and never from elapsed wall time.
- Snapshot and presentation calls cannot expose mutable authoritative storage.
- The core takes an observer interface but works identically with a no-op observer.

**Tests required**

- Exact tick progression and input-tick attribution tests.
- Explicit-N-step test proving the core uses no timer or real-time pacing.
- Snapshot isolation test that attempts caller mutation.
- Checkpoint/restore continuation test over a system-free world.
- Same initial state plus same empty inputs yields identical per-tick hashes.

### Step 6 — Add normalized input and one stable control slot

**Objective**

Make player control source-neutral and replayable before adding movement.

**Dependencies**

Steps 2 and 5.

**Files/packages affected**

- `src/simulation/input/input-system.ts`.
- `src/contracts/input.ts`.
- `eval/scenarios/foundation-move-and-roll.v1.json` input program.
- `tests/unit/input/*.test.ts`.

**Acceptance criteria**

- The scenario/test/replay paths submit the same normalized `InputFrame` shape: tick, provenance-only `sourceId`, stable `controlSlot`, move axes, sprint, and held/pressed/released action bits.
- At most one frame exists for `(tick, controlSlot)`; duplicates are rejected with an ordered diagnostic event and never resolved by arrival order.
- Missing input uses versioned `REPEAT_HELD_WITH_ZERO_EDGES` for a configured maximum count, then neutral input. The held value and missing count are canonical continuation state.
- `sourceId` is available to telemetry/replay provenance but cannot affect intent, world state, state hash, or arbitration.
- The bootstrap has exactly one stable slot assigned to its one player; no player-switching UI or multi-controller policy is implemented.

**Tests required**

- Valid frame, out-of-range frame, wrong tick/slot, duplicate, and stable-order tests.
- Missing-frame edge clearing, bounded repeat, and neutral fallback tests.
- Two equivalent traces with different `sourceId` values produce identical hashes and gameplay telemetry.
- Pressed/released edges occur once and do not repeat during held-input fallback.

### Step 7 — Implement one-player kinematic locomotion

**Objective**

Make the controlled player move observably through a minimal football-specific kinematic controller.

**Dependencies**

Steps 5–6.

**Files/packages affected**

- `src/simulation/locomotion/locomotion-system.ts`.
- `src/simulation/config/foundation.ts`.
- `src/contracts/state.ts` player and locomotion fields.
- `tests/unit/locomotion/*.test.ts`.

**Acceptance criteria**

- Input changes desired velocity/heading immediately; actual velocity and body heading converge under provisional acceleration, braking, maximum speed, and angular-rate limits.
- Position is integrated from velocity. Input never directly assigns position, and actual velocity is never replaced by `input × maxSpeed`.
- Movement direction, body heading, and desired heading remain distinct fields.
- Neutral input produces progressive braking and residual displacement instead of an instantaneous stop.
- The implementation has no ball, contact, stamina, action, capability-rating, or animation coupling.
- Every coefficient and phase threshold is versioned configuration and labeled provisional.

**Tests required**

- Acceleration-from-rest curve is finite, progressive, monotonic until the configured plateau, and deterministic.
- Top speed does not exceed the configured limit within numeric tolerance.
- Input release yields nonzero residual displacement and then settles without sign oscillation.
- A 90-degree desired-direction change respects acceleration/turn limits and does not snap velocity or body heading.
- Mirrored input produces mirrored position/velocity/heading within the pinned numeric policy.

These are engine conformance tests only; they do not claim the catalog's `LOC-*` reference criteria pass.

### Step 8 — Implement primitive independent-ball movement

**Objective**

Make the ball a separately integrated, observable 3D entity with enough behavior to support free-roll and bounce experiments.

**Dependencies**

Steps 4–5.

**Files/packages affected**

- `src/simulation/ball/ball-system.ts`.
- `src/simulation/config/foundation.ts`.
- `src/contracts/state.ts` ball/contact fields.
- `tests/unit/ball/*.test.ts`.

**Acceptance criteria**

- Ball position, linear velocity, angular velocity, motion regime, last-touch reference, contact history, and continuation solver state are canonical and serialized.
- The ball integrates independently of the player and control assignment.
- The provisional solver supports gravity, swept pitch-plane impact within a tick, bounce/restitution, ground resistance that cannot reverse velocity, and spin decay.
- Every pitch impact emits one ordered event with incoming/outgoing state references. No free-flight or rolling discontinuity occurs without a scenario/contact event.
- The bootstrap implements no homing, possession attachment, player contact, posts, curve/Magnus effect, complex rolling law, or final collision policy.

**Tests required**

- Ground roll loses speed continuously, never reverses due to resistance, and eventually settles.
- Airborne descent produces one pitch-contact event, remains above the pitch by at least the configured radius, and rebounds without unexplained energy creation.
- High-but-supported downward motion exercises the swept ground test rather than tunneling.
- Player movement and control-source changes do not change ball state in a no-contact scenario.
- Mirrored planar ball state produces a mirrored path; all canonical values remain finite.

These are primitive solver tests, not a claim that the full `ball` suite or PES ball envelopes pass.

### Step 9 — Add canonical checkpoints, input recording, and replay verification

**Objective**

Make every bootstrap run reproducible and diagnosable from an explicit initial state, seed, inputs, hashes, and optional checkpoints.

**Dependencies**

Steps 3–8.

**Files/packages affected**

- `src/contracts/replay.ts`.
- `src/adapters/replay/replay-codec.ts`.
- `eval/recording/recorder.ts`.
- `tests/unit/replay/*.test.ts` and `tests/integration/replay.test.ts`.

**Acceptance criteria**

- `ReplayV1` contains schema/replay/simulation/runtime/config/scenario/hash/PRNG provenance, canonical initial state, tick-indexed normalized inputs, periodic hashes, and optional checkpoints.
- Codec parsing is strict and versioned; unknown/incompatible simulation or schema versions fail rather than being silently interpreted.
- Snapshot/restore includes PRNG state and input-policy memory as well as visible kinematics.
- Replay verification reruns from the recorded initial state and reports the earliest hash divergence with expected/actual tick and a compact state slice.
- Input recording preserves `sourceId` as provenance while gameplay reconstruction remains source-neutral.
- Replay and checkpoint code contains no alternative physics or movement logic.

**Tests required**

- Replay encode/decode round trip and malformed/incompatible replay rejection.
- Uninterrupted run versus checkpoint/restore continuation has identical subsequent hashes.
- Recorded input replay reproduces every hash and final canonical state.
- Deliberately changed input/config/checkpoint reports the earliest divergence.

### Step 10 — Add telemetry, bootstrap invariants, metrics, and the headless runner

**Objective**

Produce the machine-readable evidence required to begin autonomous gameplay iteration.

**Dependencies**

Steps 4–9.

**Files/packages affected**

- `src/contracts/telemetry.ts` and `src/simulation/telemetry/observer.ts`.
- `src/apps/headless/{cli,run,artifacts}.ts`.
- `eval/contracts/bootstrap-registry.ts`.
- `eval/runners/{evaluate,compare}.ts`.
- `eval/recording/recorder.ts`.
- `eval/metrics/{player-motion,ball-motion}.ts`.
- `eval/invariants/{finite,references,bounds,ball-continuity}.ts`.
- `tests/integration/{headless,telemetry,evaluator}.test.ts`.

**Acceptance criteria**

- The core emits immutable structured observations through an injected sink and never logs, writes files, or performs I/O itself.
- Each observation is tick-attributed and includes resolved input/intent, PRNG state or hash, player desired/actual kinematics and headings, ball 3D state/regime, ordered events, and committed state hash.
- The headless runner validates a scenario, advances exactly its declared tick count in a synchronous loop, and exits nonzero on invalid input, invariant failure, replay divergence, or artifact failure.
- A successful run writes an explicit output directory containing `manifest.json`, `inputs.jsonl`, `hashes.jsonl`, `telemetry.jsonl`, `events.jsonl`, `metrics.json`, `invariants.json`, `final-state.json`, and `replay.json`. Generated artifacts remain git-ignored.
- The manifest separates build/runtime provenance from deterministic comparison conditions and records all relevant schema, scenario, config, PRNG, serializer, hash, and observation-profile versions.
- Initial metrics include deterministic player speed/displacement/heading series and ball speed/distance/height/contact series. They are observations, not calibrated acceptance thresholds.
- `compare` requires equal comparison-condition hashes and reports metric deltas and earliest state-hash difference. Without a versioned regression policy, it reports `DELTA_ONLY`, never `PASS`.
- Enabling, disabling, or attempting to mutate observer payloads cannot change authoritative state, RNG consumption, event order, or hashes.

**Tests required**

- Run the foundation scenario twice and compare every state hash, metric, event, and final canonical state.
- Observer-off, observer-on, and mutation-attempt runs have identical authoritative hashes.
- Protected bootstrap canaries prove that the evaluator catches non-finite state, ball teleport/discontinuity, broken ID reference, and nondeterministic hash output.
- Artifact schemas/required files validate, and a replay reconstructed from the artifact passes.
- The runner is instrumented in a test to prove it invokes no `setInterval`, `setTimeout`, or `requestAnimationFrame` for authority.
- Comparison rejects differing scenario/seed/config conditions and reports deltas for equivalent conditions.

### Step 11 — Add the primitive browser composition and renderer

**Objective**

Prove that the same scenario and core are browser-playable and visually inspectable without moving authority into presentation.

**Dependencies**

Steps 2 and 4–10.

**Files/packages affected**

- `src/adapters/input-browser/keyboard.ts`.
- `src/adapters/renderer-three/renderer.ts`.
- `src/apps/browser/{index.html,main,styles,test-bridge}.ts`.
- `vite.config.ts` and `vitest.config.ts` browser project.
- `tests/unit/input/keyboard.test.ts`.
- `tests/browser/core-smoke.browser.test.ts`.

**Acceptance criteria**

- The browser imports the same simulation and same versioned scenario data as the headless runner.
- The real-time adapter uses a wall-clock accumulator only to request zero or more fixed core steps; it never enlarges `fixedDt` or passes elapsed time into gameplay.
- Keyboard state is sampled into normalized tick-indexed frames for the stable bootstrap control slot. Test/replay injection bypasses physical input and uses the same `InputFrame` contract.
- Three.js renders an immutable `PresentationSnapshot`: restrained pitch/markings, one clearly oriented primitive player, independent sphere ball at truthful position/radius, grounded ball shadow/contact cue, and a kit-independent controlled-player marker.
- Camera, scene graph, interpolation, keyboard state, and renderer objects cannot mutate the world or alter state hashes.
- A minimal deterministic test presentation session resets scene/camera/interpolation state, loads only local primitives, returns a ready receipt, advances from exact snapshots, and exposes a test-only bridge for `reset`, `step`, `injectInputs`, `snapshot`, `stateHash`, and `capture`.
- No animation mixer, LOD, particles, temporal postprocessing, asset pipeline, dynamic camera, or perceptual gate is added.

**Tests required**

- Keyboard adapter unit tests cover opposing keys, held state, edge derivation, blur/reset, and tick assignment.
- Vitest Browser Mode `BROWSER-CORE-RESET-001`: two resets of the same scenario yield the headless initial hash and identical primitive entity counts/transforms.
- Vitest Browser Mode `BROWSER-CORE-STEP-001`: exact injected frames and tick count yield the same per-tick/final hashes as headless.
- Rendering additional animation frames without core steps leaves the canonical hash unchanged.
- A screenshot smoke artifact captured through Vitest's Playwright browser provider confirms pitch, player, ball, shadow, and controlled marker are visible; it is diagnostic, not a perceptual pass.

### Step 12 — Publish one automated gate and the iteration workflow

**Objective**

Make setup, verification, and repeated evaluation discoverable and callable by a human or autonomous agent with no hidden manual step.

**Dependencies**

Steps 1–11.

**Files/packages affected**

- Root `package.json` scripts.
- Root `mise.toml` task definitions.
- `README.md` with architecture boundaries, commands, artifact schemas, and troubleshooting.
- Optional `.github/workflows/ci.yml` if this repository uses GitHub CI.
- All test suites and the foundation scenario.

**Acceptance criteria**

- `mise.toml` exposes stable tasks that invoke pnpm scripts under the pinned environment:

  - `mise run dev` — start the primitive browser laboratory through Vite;
  - `mise run sim-smoke` — run the versioned foundation scenario headlessly;
  - `mise run replay-verify -- <replay>` — verify deterministic reconstruction;
  - `mise run eval-compare -- <run-a> <run-b>` — emit condition validation and metric deltas;
  - `mise run test` — run fast unit and Node integration tests through the Node Vitest project;
  - `mise run test-browser` — run the browser Vitest project through Vite with the Playwright provider;
  - `mise run test-all` — run frozen-install verification, type and architecture checks, all Vitest projects, deterministic headless smoke, and the Vite production build.

- Equivalent `pnpm run ...` scripts remain available for editor and CI integration, but documentation uses `mise run ...` as the canonical entry so tool pinning cannot be bypassed accidentally.
- `mise run test-all` is non-interactive, fails fast with actionable output, and returns zero only when every required bootstrap check passes.
- The README shows the exact loop: edit one mechanism/config, run fast tests, create candidate artifact, compare with a chosen immutable artifact, inspect telemetry/replay, optionally inspect browser capture, and retain or reject the change.
- No command names a result `FOUNDATION_LAB_PASS`, PES match, or regression pass.

**Tests required**

- From a fresh checkout, execute `mise install --locked`, `pnpm install --frozen-lockfile`, and `mise run test-all`.
- Verify the smoke run's replay from its generated artifact.
- Run the comparison command on two identical-condition artifacts and on a deliberately mismatched-condition pair.
- If CI is added, verify it installs tools through the committed mise lock, uses pnpm's frozen lockfile, and uploads diagnostic artifacts only on failure or by explicit policy.

## 7. `BOOTSTRAP_READY` exit criteria

The bootstrap is complete only when all of the following are true:

- a fresh install can type-check, test, build, and launch the project with documented commands;
- one versioned scenario deterministically creates one player and one independent ball;
- normalized inputs move the player through constrained locomotion while the ball evolves independently;
- Node can run the scenario for exact ticks without timers and produce complete structured artifacts;
- rerun, checkpoint continuation, and replay reproduce every recorded state hash;
- telemetry cannot mutate simulation outcomes;
- finite/reference/bounds/ball-continuity invariants run from raw canonical evidence and detect their bootstrap canaries;
- a browser reset/step using the same scenario and inputs matches headless hashes;
- the primitive renderer makes player motion, ball motion, pitch location, ball groundedness, and controlled-player identity visible;
- one command runs the complete automated bootstrap gate;
- generated output and provisional constants are clearly separated from source, formal reference targets, and promotion claims.

## 8. Capability coverage

| Requested capability | Delivered in |
|---|---|
| Repository/package structure | Steps 1–2 |
| Simulation core | Steps 4–5 |
| Fixed timestep | Step 5 |
| Seeded RNG | Step 3 |
| Reproducible simulation state | Steps 3–5, 9 |
| Basic player entity | Steps 2, 4 |
| Independent ball entity | Steps 2, 4, 8 |
| Input abstraction | Step 6 |
| One-player movement | Step 7 |
| Primitive ball movement | Step 8 |
| Headless scenario runner | Step 10 |
| Telemetry | Step 10 |
| State serialization | Steps 3, 9 |
| Replay/input recording foundation | Steps 6, 9–10 |
| Primitive browser renderer | Step 11 |
| Deterministic scenario startup | Step 4 |
| Automated test entry point | Step 12 |

## 9. First work after bootstrap

The immediate next phase is to materialize the evaluator contracts required for actual `FOUNDATION_LAB` promotion: executable catalog bindings and scenario/observation/metric/invariant/schema/suite registries for the required `fast`, `locomotion`, and `ball` suites; the full protected core mutant set; resource/seed/config/reduction policies; and the two required browser cases. Reference gates remain blocked until eligible measured targets exist.

Only after that platform work should the project expand into player-ball contacts, first touch/actions, 1v1 duels, fictional archetype design targets, team tactics, or production visual experiments.
