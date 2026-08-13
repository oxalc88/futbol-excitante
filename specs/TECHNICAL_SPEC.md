# Football Simulation Engine — Technical Specification

**Status:** Architecture specification

**Date:** 2026-08-12

**Scope:** Browser-playable and headless football simulation engine

**Target scale:** profile-dependent active set, up to the regulation target of 22 footballers, plus one physically independent ball

## 1. Purpose and authority

This document defines the system architecture of the football simulation engine. It specifies authoritative state, execution boundaries, dependency direction, runtime contracts, and selected technologies. It does not define an implementation backlog, calibrated PES 2017 constants, or a complete match-rules design.

The project goal is an independent football engine whose externally observable behavior can eventually be calibrated against measured PES 2017 reference envelopes. PES 2017 is a behavioral reference, not an implementation specification. The repository currently contains a measurement method and test catalog, but no completed quantitative reference corpus. Consequently, all unmeasured gameplay values remain configurable and provisional. [VISION §1–4](../VISION.md) [R1 §Evidence, method and limits](../research/01-pes2027-behavior.md#evidencia-método-y-límites-de-inferencia) [R2 §Research conclusion](../research/02-reference-measurement.md#research-conclusion) [AUDIT F-01–F-04](../research/RESEARCH_AUDIT.md#findings)

Where the research documents conflict, the dispositions in `research/RESEARCH_AUDIT.md` govern this specification. In particular:

- fixed-step architecture is selected, but the tick rate is TBD;
- pinned-runtime determinism is required from the first scenario;
- a synchronous, DOM-free core is selected before any worker topology;
- explicit world state is selected instead of a generic ECS;
- custom, football-specific player locomotion is selected;
- a replaceable custom ball model is the initial laboratory implementation, while final custom-versus-Rapier adoption is deferred;
- Three.js is the provisional first renderer, not a simulation dependency.

These resolutions are supported by [R3 §Deterministic simulation and browser execution](../research/03-simulation-techniques.md#deterministic-simulation-and-browser-execution), [R4 §Evaluation substrate and observability](../research/04-autonomous-evaluation.md#evaluation-substrate-and-observability), and [AUDIT F-06–F-15](../research/RESEARCH_AUDIT.md#findings).

The terms **MUST**, **MUST NOT**, **SHOULD**, and **MAY** express normative architectural requirements.

## 2. Architectural principles

### 2.1 Simulation is authoritative

The simulation core owns all state that can affect a match outcome: player and ball motion, action timing, contacts, AI decisions, tactical phase, match rules, random state, and the match clock. Rendering, animation, audio, UI, device APIs, networking, persistence, and external data sources are adapters around the core and MUST NOT become hidden sources of gameplay state.

This implements the vision's “gameplay first, rendering second, data source replaceable” rule and enables the headless evaluation path required by the later research. [VISION §2 and §5](../VISION.md#2-principio-principal) [R3 §Decision frame](../research/03-simulation-techniques.md#decision-frame) [R4 §What should be authoritative](../research/04-autonomous-evaluation.md#what-should-be-authoritative) [AUDIT, “Decisions sufficiently supported”](../research/RESEARCH_AUDIT.md#decisions-sufficiently-supported-to-make-now)

### 2.2 One core, multiple adapters

The same simulation module MUST run in:

- a browser real-time adapter;
- a Node.js headless adapter;
- deterministic replay playback;
- scenario and evaluation runners;
- a future server or network authority, if selected later.

There MUST NOT be separate browser physics, test physics, or server physics implementations. [R3 §Headless execution](../research/03-simulation-techniques.md#headless-execution) [R4 §Browser execution should reuse the same simulation](../research/04-autonomous-evaluation.md#browser-execution-should-reuse-the-same-simulation)

### 2.3 Observable, replaceable mechanisms

Locomotion, ball physics, contact resolution, tactical policy, renderer integration, input sources, and storage formats MUST communicate through narrow, explicit contracts. Replaceability means that football semantics remain outside a third-party solver or framework; it does not require multiple implementations from the outset. [R3 §Techniques that should remain deliberately replaceable](../research/03-simulation-techniques.md#techniques-that-should-remain-deliberately-replaceable) [AUDIT F-08 and F-41](../research/RESEARCH_AUDIT.md#findings)

### 2.4 Configuration instead of false precision

Every unmeasured gameplay coefficient, curve, threshold, cadence, or assistance policy MUST be versioned configuration and marked provisional/TBD. A configuration MAY be called reference-calibrated only when it points to a versioned target registry with measurement provenance, uncertainty, and causal/observability status. [R2 §Calibration deliverable](../research/02-reference-measurement.md#calibration-deliverable) [R4 §Reference-target registry](../research/04-autonomous-evaluation.md#reference-target-registry) [AUDIT §Explicit TBD values](../research/RESEARCH_AUDIT.md#explicit-tbd-values)

## 3. System context and boundaries

```text
External team data ──> Data adapter ──> Neutral team/capability data
                                                │
External visual data ─> Presentation data adapter ─> PresentationMatchConfig
                                                        │
Physical devices ──> Input adapters ──> tick-indexed InputFrame
Replay/scenario/network ───────────────> tick-indexed InputFrame
                                                │
                                                v
                          +------------------------------------+
                          |      AUTHORITATIVE SIMULATION      |
                          | fixed-step world + RNG + rules     |
                          | locomotion + ball + contacts       |
                          | AI + tactics + actions             |
                          +----------------+-------------------+
                                           |
                     +---------------------+----------------------+
                     |                     |                      |
                     v                     v                      v
             PresentationSnapshot   Telemetry/events       Replay/hash data
                     |                     |                      |
                     +<-- PresentationMatchConfig
                     v                     v                      v
             Three.js renderer      Evaluation/diagnostics   Replay storage
                     |
                     v
               Browser display
```

### 3.1 Simulation core inputs

The core accepts only validated, engine-neutral data:

- immutable match configuration and its version/hash;
- configurable pitch geometry;
- neutral teams, roles, tactics, and internal capability profiles;
- a seed and explicit PRNG state;
- an initial state or scenario definition;
- zero or more tick-indexed normalized input frames;
- deterministic scheduled scenario or rule events.

The core MUST NOT fetch team data, read a device, poll a clock, access a DOM, open a network connection, load an asset, or persist a file.

### 3.2 Simulation core outputs

The core exposes:

- the committed authoritative world state;
- a presentation snapshot containing only renderer-facing facts;
- ordered semantic events;
- deterministic state hashes and serializable checkpoints;
- telemetry observations through an injected observer interface.

Outputs MUST be attributable to a simulation tick. No renderer callback or asynchronous result may mutate an already committed tick.

### 3.3 Excluded responsibilities

The core does not own:

- menus, HUD layout, camera implementation, audio, or asset selection;
- keyboard/gamepad discovery and brand mappings;
- network transport or multiplayer authority topology;
- external roster schemas, scraping, licensing, caching, or CDN behavior;
- filesystem/database formats for artifacts;
- browser scheduling or worker transport;
- autonomous agent orchestration.

These exclusions follow [VISION §2, §10, and §12](../VISION.md#2-principio-principal), [R4 §Headless simulation should be the center](../research/04-autonomous-evaluation.md#headless-simulation-should-be-the-center-of-the-system), and [AUDIT F-22, F-28, and F-31](../research/RESEARCH_AUDIT.md#findings).

## 4. Simulation conventions

The following conventions resolve the foundational ambiguity identified by [AUDIT F-20](../research/RESEARCH_AUDIT.md#f-20--coordinate-unit-pitch-and-state-conventions-are-not-specified) and align simulation coordinates with the measurement pipeline in [R2 §Pitch geometry](../research/02-reference-measurement.md#pitch-geometry-tracking-and-camera-compensation).

### 4.1 Units and axes

- Authoritative physical quantities use SI units: metres, seconds, metres per second, radians, and derived SI units.
- The origin is the pitch centre spot on the ground plane.
- `+x` runs along pitch length toward one goal; `+y` runs across pitch width; `+z` points upward.
- The coordinate system is right-handed.
- Heading zero points along `+x`; positive heading turns toward `+y` and is normalized to `[-π, π)` at serialization boundaries.
- Team attacking direction is explicit match state. It MUST NOT be inferred from team ID or renderer orientation.

### 4.2 Pitch and boundaries

Pitch length and width are configuration, not universal constants. Goal and marking geometry are derived from a versioned pitch/rules template. Boundary inclusion and restart placement rules belong to the rules specification and remain TBD where not researched.

This avoids the unsupported assumption of a universal 105 × 68 m field noted in [R2 §Do not assume a universal pitch](../research/02-reference-measurement.md#do-not-assume-a-universal-105--68-m-pitch).

### 4.3 Player and ball dimensionality

- Canonical normal player locomotion is planar: player ground position and translational velocity are 2D pitch-space values.
- Player body heading is independent of movement direction.
- Vertical pose, foot placement, limb pose, and visual root offsets are presentation data unless a gameplay action explicitly models a vertical reach/contact volume.
- The ball always has a full 3D position, linear velocity, and angular velocity.

Headers, jumps, goalkeeper reaches, and exceptional falls may add simulation-owned vertical reach/action state later without converting ordinary players into fully dynamic humanoids. [R3 §Player locomotion and physical contact](../research/03-simulation-techniques.md#player-locomotion-and-physical-contact) [R3 §Ball physics and player-ball interaction](../research/03-simulation-techniques.md#ball-physics-and-player-ball-interaction)

Simulation body/reach data and visual embodiment meet through a versioned compatibility contract. A `SimulationBodyProfile` defines canonical body dimensions, gameplay contact/reach volumes, and semantic surfaces such as `HEAD`, `TORSO`, `LEFT_FOOT`, `RIGHT_FOOT`, `LEFT_LEG`, `RIGHT_LEG`, `LEFT_HAND`, and `RIGHT_HAND`. It contains no rig, mesh, or animation reference.

An `EmbodimentMapping` binds one simulation body-profile version to one rig/asset-profile version and declares, per semantic surface and supported action:

- required rig anchor/socket IDs and handedness/mirroring rules;
- the compatible canonical dimension/reach range and authored visual scale policy;
- pose-envelope coverage at preparation, contact, and recovery extremes;
- maximum translational and angular visual correction, including per-LOD limits;
- validation fixture IDs and mapping version/hash.

Asset import validates every supported body-profile/rig/LOD pairing against the canonical contact samples and pose envelopes for the active milestone. Missing anchors, unreachable contacts, excessive correction, or incompatible scale rejects the pairing. Runtime MUST NOT silently resize simulation reach, mesh scale, or correction limits to force compatibility.

### 4.4 Identity and versions

Every simulation entity, scheduled event, contact, action, scenario, configuration, schema, and replay has a stable ID or version. IDs MUST be stable across serialization and MUST participate in deterministic ordering where relevant.

## 5. Authoritative core API

The conceptual API is synchronous:

```ts
interface Simulation {
  readonly tick: number;

  applyInputs(frames: readonly InputFrame[]): void;
  step(): StepResult;

  snapshot(): SerializableWorldState;
  presentation(): PresentationSnapshot;
  restore(snapshot: SerializableWorldState): void;
  stateHash(): StateHash;
}

interface StepResult {
  tick: number;
  events: readonly SimulationEvent[];
  stateHash: StateHash;
}
```

The types are illustrative contracts, not a prescribed mutation style. The normative properties are synchronous stepping, explicit inputs, tick attribution, serialization, and absence of browser dependencies. [R3 §Headless execution](../research/03-simulation-techniques.md#headless-execution) [R4 §Scenario runner](../research/04-autonomous-evaluation.md#scenario-runner)

Configuration is immutable for the duration of a run. A tactical instruction or match setting that changes during play is a tick-indexed command/event in world state, not an out-of-band mutation of configuration.

## 6. Fixed-step execution

### 6.1 Tick contract

The authoritative world advances only through identical fixed-duration ticks. The fixed duration is part of the versioned simulation configuration.

```text
S(t) + InputFrame(t) + scheduled events(t) + RNG(t)
                         |
                         v
                    fixed step
                         |
                         v
             S(t+1) + ordered events(t) + RNG(t+1)
```

The exact tick frequency and ball/contact substep policy are **TBD**. The 60 Hz values shown elsewhere in the corpus are examples or prototype candidates, not selected gameplay constants. A higher whole-world rate, targeted ball substeps, and swept/continuous collision tests remain alternatives behind the same tick contract. [R3 §Fixed-step simulation](../research/03-simulation-techniques.md#fixed-step-simulation) [AUDIT F-12](../research/RESEARCH_AUDIT.md#f-12--the-exact-simulation-rate-and-substep-policy-remain-tbd)

### 6.2 Normative tick phases

Each tick executes a versioned, deterministic phase order:

1. Apply scheduled scenario/rule events due at the tick.
2. Accept and validate the tick's normalized input frames.
3. Compute team tactical phase, formation deformation, and role assignments from the committed start-of-tick state.
4. Compute individual AI decisions as normalized control commands, then merge external and AI commands into player intents.
5. Arbitrate action requests and update action preparation/active/recovery state.
6. Compute desired velocities/headings, then integrate bounded player locomotion into tentative state.
7. Generate player/player and environment contact candidates; sort them canonically; resolve positional, velocity, and balance effects.
8. Resolve scheduled player/ball action contacts and advance ball physics, including any configured deterministic ball substeps or swept tests.
9. Apply match-rule decisions to ordered simulation events.
10. Derive control eligibility, possession/statistical facts, team phase inputs, and presentation facts.
11. Validate invariants, emit telemetry/events, compute the canonical state hash, and commit `S(t+1)`.

Subsystems MUST NOT observe partially updated entities in collection iteration order unless that ordering is explicitly part of the versioned algorithm. Intent and AI phases read a coherent committed snapshot or staged buffers. Candidate contacts are resolved by a documented total order, never by incidental container or broad-phase order. This is required by the stable-ordering rationale in [R3 §Reproducibility discipline](../research/03-simulation-techniques.md#reproducibility-discipline) and [R4 §Headless simulation](../research/04-autonomous-evaluation.md#headless-simulation-should-be-the-center-of-the-system).

### 6.3 Real-time browser loop

The browser adapter accumulates wall-clock time and requests zero or more fixed core steps. It renders independently using an interpolation factor between the two most recent committed presentation snapshots.

```text
wall-clock delta -> accumulator
while accumulator >= fixedDt:
    submit tick input
    simulation.step()
    accumulator -= fixedDt
alpha = accumulator / fixedDt
renderer.draw(previous, current, alpha)
```

Rendering refresh rate MUST NOT change simulation behavior. Catch-up limits and overload behavior are runtime policy and remain configurable/TBD; they MUST NOT enlarge `fixedDt` to make the game catch up.

### 6.4 Headless loop

Headless execution advances an explicit tick count in a synchronous or controlled batch loop as fast as the CPU permits. It MUST NOT use `setInterval`, `requestAnimationFrame`, or real-time pacing as its authoritative clock. [R4 §Headless simulation](../research/04-autonomous-evaluation.md#headless-simulation-should-be-the-center-of-the-system) [AUDIT F-13](../research/RESEARCH_AUDIT.md#f-13--headless-execution-is-inconsistently-described-as-timer-driven)

## 7. Determinism and reproducibility

### 7.1 Required guarantee

The initial guarantee is:

> Same pinned build/runtime + same versioned configuration + same initial state + same seed + same tick-indexed inputs = identical canonical state hashes.

This guarantee is mandatory from the first laboratory scenario. Cross-browser equivalence and bit-exact network lockstep are not currently guaranteed. [R3 §Browser floating point](../research/03-simulation-techniques.md#browser-floating-point) [AUDIT F-10–F-11](../research/RESEARCH_AUDIT.md#findings)

### 7.2 Deterministic disciplines

The core MUST provide:

- an explicit, seedable, versioned PRNG; `Math.random()` is forbidden in authoritative logic;
- stable entity IDs and stable iteration/update order;
- stable contact and event order;
- tick-based scheduling only; no wall-clock reads in gameplay logic;
- a versioned canonical serializer and state hash;
- snapshot/restore of every authoritative value, including PRNG and schedulers;
- deterministic handling of missing, duplicate, or invalid input frames;
- finite-state invariants rejecting NaN and Infinity.

JavaScript `Number`/IEEE-754 binary64 is the selected initial numeric representation. This does not imply universal bit identity across JavaScript engines. Authoritative transcendental operations SHOULD be centralized so their reproducibility can be tested or replaced if cross-runtime requirements emerge. Fixed-point arithmetic and a custom Wasm numeric core are deferred. [R3 §Browser floating point](../research/03-simulation-techniques.md#browser-floating-point)

### 7.3 RNG contract

The exact PRNG algorithm is TBD, but it MUST have a stable algorithm/version identifier and support:

```text
seed
nextUint32
nextFloat01
snapshotState
restoreState
```

Random draws are gameplay inputs with provenance. Adding a draw may change later outcomes; independent random streams or jump-ahead are allowed later if coupling becomes problematic. Until then, consumption order is part of the simulation version. [R3 §Deterministic RNG](../research/03-simulation-techniques.md#deterministic-rng)

### 7.4 Canonical serialization and hashing

Canonical state includes all values capable of changing future outcomes: hidden cooldowns, action/contact state, rule state, tactical phase, scheduler contents, and PRNG state as well as visible transforms. Derived caches MAY be omitted only if they are fully reconstructible and cannot influence the next tick before reconstruction.

Serialization MUST define field order, collection order, numeric encoding, schema version, and treatment of special numeric values. The hash algorithm and binary representation are TBD but become versioned once selected. State hashes are computed every tick in determinism tests and may be persisted at a configurable cadence in ordinary replays.

## 8. Canonical world state

### 8.1 World root

The authoritative world contains at least:

```text
WorldState
  schemaVersion
  simulationVersion
  tick
  fixedDtConfig
  pitch/rules template
  match clock and match phase
  immutable configuration hashes
  PRNG state
  scheduled events
  teams[2]
  playersById (active set in stable playerId order)
  ball
  ordered action/contact/rule state
```

The active player set is variable and bounded by the selected scenario/match profile. Stable player IDs determine serialization and iteration order; array position never defines identity. Roster members not activated by initial state are immutable match configuration, do not appear in `playersById`, and are excluded from gameplay systems, team geometry, metrics, and the canonical world hash until a future rules specification defines a deterministic activation/substitution event.

Cardinality validation is profile-specific:

| Profile | Active-player invariant |
|---|---|
| `LABORATORY` | Exact declared set of 1–22 players; asymmetric teams and isolated actors are allowed when declared. |
| `SMALL_SIDED` | Exact declared set of 2–20 players, at least one per team; any asymmetric experimental roster must be explicit. |
| `REGULATION` | Exactly 22 active players, exactly 11 assigned to each of two teams. |

One physically independent ball is required in every gameplay profile unless a scenario schema explicitly declares a no-ball subsystem fixture. Officials or stress-test entities require separate explicit state and budgets; the “22×2” phrase in the browser research is rejected as an error. [VISION §3.1](../VISION.md#31-gameplay) [AUDIT F-17](../research/RESEARCH_AUDIT.md#f-17--player-count-assumptions-contain-an-error)

### 8.2 Explicit state, not a generic ECS

The initial representation is explicit typed records/arrays with stable IDs and explicit systems. Data-oriented layouts MAY be used for hot homogeneous fields, but a generic ECS framework is not part of the architecture. Storage layout is private to the core and may change without changing domain contracts. [R3 §ECS versus simpler state organization](../research/03-simulation-techniques.md#ecs-versus-simpler-state-organization) [AUDIT F-09](../research/RESEARCH_AUDIT.md#f-09--ecs-adoption-directly-conflicts)

## 9. Player state and locomotion

### 9.1 Player state

Each player has stable identity and authoritative state in these categories:

```text
Identity
  playerId, teamId

Kinematics
  groundPosition
  linearVelocity
  desiredVelocity
  bodyHeading
  desiredHeading
  optional angular rate / locomotion phase

Action and contact
  actionState
  actionTarget/direction
  contactState
  balance/stability state
  disruption/recovery state
  stamina state

Individual decision
  current intention and steering target
  current utility decision and hysteresis state

Interaction facts
  ball-control eligibility/window
  last relevant contact
  shielding geometry/state
```

Fields that are derivable for display need not be duplicated in authoritative state. Fields that affect future decisions MUST be serialized even if visually hidden.

Team tactical state is normalized under the team record. Each team solely owns its current phase, base/deformed formation state, and assignment maps keyed by stable `playerId` for tactical role, formation anchor/region, tactical target/responsibility, marking, pressing, and cover. Player state owns only the selected individual intention/steering target and utility/hysteresis memory that affect that player's future decisions.

Player-facing role, anchor, target, or phase values are derived views. They MUST NOT be serialized as independently writable copies. If profiling later justifies a cache, the cache is rebuilt from team state before use, is excluded from authoritative serialization, and has a mandatory equality invariant against the owning assignment map. The versioned team-tactics phase is the only writer of team phase and assignment maps; individual AI reads one committed assignment snapshot and stages player-local decisions for the later commit phase.

### 9.2 Locomotion model

Normal locomotion uses a football-specific kinematic controller. Input or AI changes desired motion immediately; actual velocity and body orientation converge under configurable acceleration, braking, lateral-turning, and angular constraints. Position MUST NOT be assigned directly from input, and velocity MUST NOT be replaced with `input × maxSpeed`.

Movement direction, body forward, and desired action direction are distinct. High-speed direction changes may lose more speed or take more time than low-speed turns, but the exact response surface is configurable/TBD until measured. A small macro-state model may represent idle/locomotion, plant/pivot, action preparation, stumble, and recovery; a combinatorial locomotion state graph is not selected.

This preserves the researched target of immediate intention with a non-instantaneous body and maps state to measurable acceleration, stop, turn, and orientation outcomes. [R1 §Movement, acceleration, orientation, inertia and contact](../research/01-pes2027-behavior.md#movimiento-aceleración-orientación-inercia-y-contacto) [R3 §Player locomotion and physical contact](../research/03-simulation-techniques.md#player-locomotion-and-physical-contact)

### 9.3 Internal capabilities and external ratings

The core consumes an internal `CapabilityProfile`, not PES/provider ratings. It separates interpretable capability dimensions such as sustainable speed, transient acceleration, braking, turning, body control/recovery, physical contact, ball control, passing, shooting, defensive execution, and goalkeeper abilities.

The exact capability schema, units/ranges, and response mappings are versioned. No direct linear `rating -> m/s`, `rating -> force`, or “higher stat wins” mapping is implied. Early profiles use fictional, hand-authored archetypes. External providers require a separate adapter and later validated mapping. [R1 §Attributes](../research/01-pes2027-behavior.md#atributos-controles-cámara-tempo-y-especificación-de-calibración) [R2 §Controlled-capture extension](../research/02-reference-measurement.md#controlled-capture-extension-required-for-causal-calibration) [AUDIT F-21–F-22](../research/RESEARCH_AUDIT.md#findings)

## 10. Ball state and physics

### 10.1 Independent ball

The ball is always an independent simulation entity. Its minimum canonical state is:

```text
position: Vec3
linearVelocity: Vec3
angularVelocity: Vec3
motion/contact regime
contact history sufficient for rules and telemetry
last-touch event reference
solver state required for deterministic continuation
```

No possession, dribble, animation, or player-selection state may parent the ball to a player transform or teleport it between controllers. [R1 §Independent ball](../research/01-pes2027-behavior.md#balón-independiente-primer-toque-pases-tiros-y-juego-aéreo) [R3 §Ball physics](../research/03-simulation-techniques.md#ball-physics-and-player-ball-interaction) [AUDIT F-18](../research/RESEARCH_AUDIT.md#f-18--possession-is-both-an-explicit-state-and-an-emergent-relationship)

### 10.2 Ball solver boundary

The canonical interface supports:

- ground roll/rolling resistance;
- ground slip and tangential response;
- ground/air transition;
- gravity;
- bounce/restitution behavior;
- aerodynamic drag;
- angular velocity and spin decay;
- a configurable curve/Magnus-like effect;
- pitch, post, player, and active contact-surface collision;
- deterministic swept tests or selective substeps for fast contacts.

The exact formulas and all coefficients are configurable/TBD. Ground roll may be constant, speed-proportional, piecewise, or empirical; the architecture does not select among them without measured residuals. Aerial reconstruction evidence is weaker, so drag, bounce, spin decay, and curve remain independently toggleable/versioned. [R2 §Ground-ball velocity decay and airborne reconstruction](../research/02-reference-measurement.md#ground-ball-velocity-decay) [AUDIT F-23](../research/RESEARCH_AUDIT.md#f-23--ball-model-equations-and-parameters-remain-experimental)

The initial laboratory implementation is a small custom deterministic integrator because there is one ball and its parameters map directly to reference observables. The solver sits behind an adapter so Rapier can be compared later. Rapier is not currently authoritative or mandatory. [R3 §Physics engine choice](../research/03-simulation-techniques.md#physics-engine-choice) [AUDIT F-08](../research/RESEARCH_AUDIT.md#f-08--physics-engine-choice-directly-conflicts)

## 11. AI and tactics boundaries

### 11.1 Layering

AI follows this dependency hierarchy:

```text
match/rule state
  -> team tactical phase and tactic configuration
    -> formation anchors and dynamic shape deformation
      -> role assignments and local responsibilities
        -> individual utility choice
          -> reachability/space evaluation
            -> steering target / desired action
              -> the same locomotion and action systems used by human control
```

The architectural rule is: **tactics decides where and why; steering requests local motion; locomotion decides what is physically achievable.** AI MUST NOT write player position, body heading, ball velocity, possession, or contact outcomes directly. [R1 §Off-ball movement and tactics](../research/01-pes2027-behavior.md#movimiento-sin-balón-forma-defensiva-presión-y-táctica-colectiva) [R3 §AI and tactics](../research/03-simulation-techniques.md#ai-and-tactics)

### 11.2 Team tactics

Team tactics contain a base formation plus versioned parameters for shape and preferences, including defensive line, compactness, support distance, width, build-up tendency, pressing, mentality, and advanced instructions where supported. These are neutral engine concepts, not claimed PES slider formulas.

The team record is authoritative for tactical phase and all team-to-player assignment maps. Every active team member has exactly one applicable role/anchor responsibility record, and every map key resolves to an active player on that team. Removing or activating a player and recomputing assignments is one staged canonical transition; partial maps or player-local tactical copies are invariant failures.

Formation anchors are normalized pitch-relative preferred regions, not rigid positions. They deform by ball zone, team side, possession/control facts, match phase, role corridor, and tactical instruction. Two teams with the same nominal formation may differ through tactics and individual decision preferences.

### 11.3 Individual decisions

The selected initial decision mechanism is deterministic, inspectable utility scoring with hysteresis. Candidate intentions include holding shape, supporting, running into space, pressing, covering, marking, intercepting, and recovering. Weights, thresholds, decision cadence, and hysteresis values are configurable/TBD.

Behavior trees may later sequence complex multi-stage actions, but they are not the selected high-level tactical scorer. Learned/end-to-end tactical policies are deferred. [R3 §AI and tactics](../research/03-simulation-techniques.md#ai-and-tactics) [AUDIT F-25](../research/RESEARCH_AUDIT.md#f-25--ai-technique-direction-is-supported-but-target-behavior-is-not-measured)

### 11.4 Reachability and pressing

Pass safety and space control use the same calibrated locomotion constraints as actual players. Ball arrival time is compared with receiver/defender reach time; a coarse reach-time/control-margin field is the selected starting abstraction. Plain distance or position-only Voronoi geometry is insufficient as the authoritative reach model.

Pressing is a coordinated team assignment: ball pressure, lane/receiver cover, and block compression are separate responsibilities. The exact number of pressers and assignment thresholds are tactical configuration/TBD, not hard-coded football truths.

### 11.5 Tactical phases

Settled attack, attack-to-defence transition, settled defence, and defence-to-attack transition are explicit team phase states. Possession loss does not instantly produce settled defence. Entry ticks and exit conditions are recorded for telemetry. Additional restart and set-piece phases belong to the later rules specification.

## 12. Actions, contacts, control, and rules

### 12.1 Action pipeline

Passes, shots, first touches, dribble touches, tackles, headers, and goalkeeper contacts share a common architecture:

```text
command or AI intention
  -> action eligibility and contextual selection
    -> preparation / active-contact / recovery state
      -> canonical contact time and geometry
        -> desired outgoing ball state + seeded technical error
          -> physical impulse/state change applied to the independent ball
            -> ordered contact/rule events
```

Target selection, technical execution/error, contact selection, and ball integration are separate responsibilities. A poor pass changes the chosen initial contact outcome; it does not alter the ball's subsequent friction law. [R1 §Pass and first touch](../research/01-pes2027-behavior.md#balón-independiente-primer-toque-pases-tiros-y-juego-aéreo) [R3 §Ball physics and player-ball interaction](../research/03-simulation-techniques.md#ball-physics-and-player-ball-interaction)

### 12.2 Contact authority

The simulation schedules and resolves the canonical contact tick, contact actor/surface, incoming state, and outgoing ball/player effects. Animation is notified of this result; animation clip time, root motion, IK, or skinned-mesh collision MUST NOT create an unrecorded gameplay contact.

If authored animation data informs a contact window, that data must be imported as explicit versioned simulation data and remain headlessly testable. Presentation may add bounded visual offsets to align a foot with the already-resolved contact, but those offsets do not feed back. [R3 §Animation and simulation-state separation](../research/03-simulation-techniques.md#animation-and-simulation-state-separation) [AUDIT F-19](../research/RESEARCH_AUDIT.md#f-19--animationcontact-authority-is-not-consistently-resolved)

Canonical contacts identify the simulation body-profile version, semantic surface, world-space point/normal, and action/contact tick. The presentation adapter resolves that semantic surface only through the selected `EmbodimentMapping`; mesh proximity is not evidence of feasibility. Visual correction is clamped by the mapping's declared translation/angle limits and recorded. If the mapped pose cannot present the contact within those limits, the renderer emits an embodiment incompatibility artifact and the applicable browser test fails; it never alters contact time, reach, ball state, or simulation geometry.

### 12.3 First touch and dribbling

First touch is contextual contact selection, not a possession toggle. Its inputs may include incoming ball velocity/height/spin, player movement and body heading, desired exit, dominant-foot capability, pressure, and technical capability. Candidate families may include cushioning, trapping, redirecting, pushing into space, leaving, and aerial control. Exact availability, error, assistance, and output mappings are TBD.

Dribbling consists of repeated feasible micro-contacts with a free ball. The controller predicts a future player/ball meeting region; it does not continuously constrain the ball to a foot.

### 12.4 Player/player contact and balance

Normal players use simple planar collision geometry and a deterministic custom resolver. The resolver prevents invalid interpenetration while preserving deliberate congestion, shielding, and shoulder contact. It applies continuous positional, velocity, heading, and stability effects before higher-level outcomes are derived.

A duel MUST NOT be reduced to “higher physical stat wins.” Balance/recovery and physical-contact capabilities remain distinct. Pair/contact candidates are sorted by stable IDs and explicit contact priority. Exact collider sizes, correction policy, balance thresholds, tackle windows, and foul thresholds are configurable/TBD. [R1 §Physical contact and duels](../research/01-pes2027-behavior.md#tackles-intercepciones-porteros-y-resolución-de-duelos) [R3 §Player locomotion and physical contact](../research/03-simulation-techniques.md#player-locomotion-and-physical-contact)

### 12.5 Explicit assistance policy

Control assistance—foot reach, interception reach, contact scheduling tolerance, target lead, and correction limits—MUST be explicit inspectable policy. It MUST NOT be hidden by inflating colliders, teleporting the ball, or altering animation-only geometry. Assistance settings are included in configuration/replay provenance and remain TBD pending controlled sweeps and playtests. [AUDIT F-24](../research/RESEARCH_AUDIT.md#f-24--invisible-ball-assistance-and-control-capture-are-unresolved)

### 12.6 Possession facts

The engine represents distinct facts:

- last touch actor/team/tick/surface;
- players currently eligible to make a controlled touch;
- an active controlled-touch window, if any;
- tactical/statistical team possession;
- rules ownership for a restart.

None of these facts physically attaches the ball. Tactical/statistical possession is derived from contact/control evidence through a versioned policy.

### 12.7 Match rules

Rules are a deterministic core subsystem that consumes ordered state and contact/action events and produces rule events, clock/phase changes, score changes, and restart state. Renderer/UI code only presents those decisions.

The architecture reserves this boundary for goals, field boundaries, offside, fouls, advantage, restarts, and match timing. Exact adjudication, event ordering within complex rule cases, goalkeeper decision logic, and restart placement are explicitly deferred to dedicated rule and goalkeeper specifications before full-match implementation. [VISION §3.1](../VISION.md#31-gameplay) [AUDIT F-26](../research/RESEARCH_AUDIT.md#f-26--goalkeepers-rules-fouls-and-restarts-are-under-researched-relative-to-the-vision)

## 13. Simulation-to-presentation boundary

### 13.1 Presentation snapshot

The renderer receives an immutable `PresentationSnapshot` for a committed tick. It contains only presentation-relevant facts, for example:

```text
tick and simulation time
stable entity IDs
player ground transforms and body headings
player velocities/turn rates
semantic locomotion phase
semantic action/contact/balance state
desired contact geometry for visual alignment
ball transform, velocity, spin, and ground/air state
ordered presentation events
score, clock, and rule facts needed by UI
stable control-slot assignments and controlled player/team IDs
```

It does not expose mutable world storage or solver internals. The snapshot schema is versioned independently from the complete replay/checkpoint schema.

The snapshot exposes match-level stable slot assignments, but does not decide which slots are local or how their indicators look. Browser composition joins those assignments to local session ownership and the presentation match configuration; remote/replay provenance cannot become a gameplay-visible distinction inside simulation.

### 13.1.1 Presentation match configuration

Browser composition owns an immutable, versioned `PresentationMatchConfig`, separate from `SimulationMatchConfig` and canonical state:

```ts
interface PresentationMatchConfig {
  configId: string;
  configVersion: string;
  simulationMatchConfigHash: string;
  teamVisualProfilesByTeamId: Record<string, string>;
  playerVisualProfilesByPlayerId: Record<string, string>;
  embodimentMappingByPlayerId: Record<string, string>;
  selectedOutfieldKitByTeamId: Record<string, string>;
  selectedGoalkeeperKitByTeamId: Record<string, string>;
  officialVisualProfileId: string | null;
  assetManifestIds: string[];
  accessibilityModeId: string;
  indicatorProfileByLocalControlSlot: Record<string, string>;
  visualConfigId: string;
}
```

The presentation data adapter converts provider/art schemas into neutral versioned visual profiles; the renderer MUST NOT fetch or interpret provider data. Composition validates that every team/player/control-slot key resolves against the immutable simulation match config and presentation snapshot, that each asset/profile exists, and that every embodiment pairing passes §4.3 compatibility. A missing, extra, or mismatched shared ID rejects composition rather than creating mutable global fallback state.

The presentation config ID/version/hash and resolved asset hashes are capture and optional replay-presentation provenance. They are excluded from canonical gameplay state and its hash; changing kits, accessibility mode, indicators, or assets cannot change simulation results.

### 13.2 Interpolation and discrete events

The renderer interpolates continuous visual properties between the previous and current committed snapshots. It MUST NOT feed interpolated transforms into collision, AI, rules, input selection, or telemetry that claims to describe simulation state.

Discrete action/contact/rule events occur at their simulation tick. The presentation adapter may visually latch or blend them, but it cannot move their authoritative time. Extrapolation, if ever used for network presentation, is presentation-only.

### 13.3 Animation integration

The initial animation architecture is a small animation state machine plus parametric blend tree driven by simulation observables such as speed, movement relative to body, turn rate, acceleration, locomotion phase, action state, and contact state.

Simulation owns canonical translation and body heading. Root motion, motion matching, foot locking, pose correction, and IK may create visual offsets only. Motion matching and advanced procedural animation are deferred. [R3 §Animation and simulation-state separation](../research/03-simulation-techniques.md#animation-and-simulation-state-separation)

### 13.4 Camera and visual cues

Camera is a presentation subsystem and is calibrated separately from locomotion because camera motion changes perceived speed. One provisional fixed gameplay preset will eventually be selected through a camera experiment; FOV, height, pitch, lag, smoothing, zoom, and transitions are currently TBD. [R1 §Camera](../research/01-pes2027-behavior.md#atributos-controles-cámara-tempo-y-especificación-de-calibración) [AUDIT F-37](../research/RESEARCH_AUDIT.md#f-37--camera-behavior-is-a-major-unresolved-dependency)

Ball trails, glow, and airborne emphasis are not baseline architecture. The baseline uses high contrast and a grounded shadow; optional cues must derive solely from simulation state and be testable on/off because they can distort perceived ball physics. [R6 §Ball readability](../research/06-visual-direction.md#ball-readability-and-vfx) [AUDIT F-39](../research/RESEARCH_AUDIT.md#f-39--ball-visibility-effects-may-distort-the-behavior-being-evaluated)

## 14. Renderer integration

### 14.1 Selected renderer boundary

Three.js is the provisional first renderer adapter. It is selected for the first browser presentation because the vision already names it as the initial lightweight choice and the audit accepts it as a reversible default. Babylon.js remains a possible replacement if a concrete capability justifies a spike. [VISION §6](../VISION.md#6-tecnología-del-cliente) [AUDIT F-14 disposition](../research/RESEARCH_AUDIT.md#finding-dispositions)

The renderer adapter owns:

- Three.js scene graph and WebGL resources;
- models, materials, skinning, animation selection/blending, visual IK, and LOD;
- gameplay and replay cameras;
- pitch/stadium/crowd presentation;
- lighting, shadows, outlines, and post-processing;
- world-to-render coordinate conversion;
- HUD anchoring and visual debug overlays.

The renderer MUST depend only on presentation/input-neutral contracts, never on mutable simulation systems.

### 14.2 Visual baseline

The selected art principles are non-photorealistic presentation, limited palettes, readable silhouettes, restrained texture noise, strong team/ball contrast, and gameplay clarity at the actual camera scale. Exact cel/PBR bands, outlines, LODs, textures, rigs, shadows, crowd treatment, and asset budgets are TBD pending representative renderer and target-device experiments. [R6 §DECIDE NOW / DEFER](../research/06-visual-direction.md#decide-now--defer) [AUDIT F-15–F-16 and F-38](../research/RESEARCH_AUDIT.md#findings)

Kit readability is data-driven. Neutral team data supplies primary/alternate/goalkeeper palette metadata; a presentation policy selects a clash-safe matchup and preserves a controlled-player indicator independent of kit color. Fixed global team palettes are not selected. [AUDIT F-35](../research/RESEARCH_AUDIT.md#f-35--fixed-team-palettes-conflict-with-arbitrary-team-data)

## 15. Runtime architecture

### 15.1 Browser runtime

The initial browser topology is:

```text
Main browser thread
  UI and menus
  keyboard/gamepad adapters
  real-time accumulator
  synchronous simulation.step()
  Three.js presentation adapter
  audio
```

This is intentionally transport-neutral. It validates gameplay and the core boundary before adding concurrency. A simulation worker, renderer worker, OffscreenCanvas, SharedArrayBuffer, and cross-origin isolation are deferred until a representative 11v11 profile proves a bottleneck and deployment constraints are known. [R3 §Web Workers and WebAssembly](../research/03-simulation-techniques.md#web-workers-and-webassembly) [AUDIT F-06–F-07](../research/RESEARCH_AUDIT.md#findings)

If a worker is later adopted, it wraps the same synchronous core API. Input and presentation transports may use direct calls, structured messages, transferables, or shared memory without changing `InputFrame` or `PresentationSnapshot` semantics.

### 15.2 Headless runtime

The headless runtime is a pinned Node.js environment importing the same core. It supports:

- explicit scenario creation;
- exact tick-count execution without timers;
- faster-than-real-time batches;
- deterministic replay verification;
- state/event recording and metrics;
- optional controlled parallelism across independent runs.

Node worker threads are not required for correctness and MAY be used only for independent batch throughput. [R3 §Headless execution](../research/03-simulation-techniques.md#headless-execution) [R4 §Experiment batches](../research/04-autonomous-evaluation.md#experiment-batches)

### 15.3 Browser verification

Playwright is the selected browser integration and capture tool. A test-only bridge MAY reset a scenario, inject normalized inputs, step exact ticks, read snapshots/events/metrics, select a camera preset, and render a requested tick. The bridge is excluded from production authority and must use the same core. Browser screenshots, frame strips, video, and traces validate presentation/integration; they do not replace state-space physics evidence. [R4 §Browser execution and artifacts](../research/04-autonomous-evaluation.md#browser-execution-should-reuse-the-same-simulation)

## 16. Input abstraction

### 16.1 Normalized tick-indexed input

All command sources produce the same engine-neutral representation. Physical, replay, scenario, test, and future network adapters submit it to the core; the core's individual AI policy emits the same command shape internally before intent conversion:

```ts
interface InputFrame {
  tick: number;
  sourceId: string; // provenance only
  controlSlot: string;

  moveX: number; // normalized -1..1
  moveY: number; // normalized -1..1
  sprint: number; // normalized analog value

  heldButtons: ActionBits;
  pressedButtons: ActionBits;
  releasedButtons: ActionBits;
}
```

The exact action set is versioned and expands without changing device adapters into gameplay systems. Keyboard, Gamepad API, AI, replay, scenario/test, and future network sources all enter through this contract. [R4 §Keyboard and gamepad input](../research/04-autonomous-evaluation.md#keyboard-and-gamepad-input) [AUDIT F-27](../research/RESEARCH_AUDIT.md#f-27--input-abstraction-is-supported-but-sampling-semantics-and-device-policy-are-tbd)

`sourceId` identifies the producing device/adapter only for provenance and diagnostics. It MUST NOT participate in gameplay decisions, assignment arbitration, canonical world state, or the canonical state hash. Adapters map unstable device identities to stable match-scoped `controlSlot` IDs before submission.

Canonical control ownership is a match-level `ControlAssignmentState`, not a player field or adapter table:

```ts
interface ControlAssignmentState {
  bySlot: Record<string, {
    teamId: string;
    controlledPlayerId: string | null;
    mode: "HUMAN" | "AI_FALLBACK";
  }>;
}

interface ControlAssignmentCommand {
  tick: number;
  controlSlot: string;
  commandSequence: number;
  kind: "CLAIM_TEAM" | "REQUEST_PLAYER_SWITCH" | "SET_AI_FALLBACK";
  teamId?: string;
  requestedPlayerId?: string;
  switchDirection?: "NEXT" | "PREVIOUS" | "AUTO_POLICY";
}
```

Only these tick-indexed commands and stable slots cross into simulation. Commands are ordered by `(tick, controlSlot, commandSequence)`; a slot sequence must be contiguous. A slot can own at most one active player, and an active player can be owned by at most one human slot. For a same-tick conflict, lexically lower `controlSlot` wins and every loser retains its previous valid assignment or enters declared AI fallback if it had none. Automatic switch selection uses a versioned simulation policy over committed start-of-tick state; adapters never choose the player.

The normalized-frame policy is deterministic: at most one frame exists for `(tick, controlSlot)`. A duplicate is rejected as an invalid input event and the slot uses the configured missing-frame policy for that tick; arrival order is never a tie-breaker. The initial missing-frame policy is `REPEAT_HELD_WITH_ZERO_EDGES`, bounded by a configured maximum consecutive count, after which the slot receives neutral input without changing ownership. The policy/version and every rejection/fallback event are replay provenance.

### 16.2 Adapter responsibilities

Device adapters own:

- physical device discovery, hot-plug, disconnect, and session-to-stable-slot ownership;
- brand/browser mappings and `standard` mapping fallbacks;
- keyboard digital-to-analog policy;
- dead zones and response curves;
- button-edge derivation;
- sample buffering and assignment to a simulation tick.

These policies are versioned and included in replay/run provenance. Their exact values and sample-to-tick rule are TBD before gamepad fidelity testing.

A device disconnect does not directly mutate canonical control ownership. The browser composition layer emits a tick-indexed `SET_AI_FALLBACK` command at its declared effective tick; reconnect requires a new claim command. Local two-player setup maps two devices to distinct stable slots, normally assigned to opposing teams. Same-team cooperative control is outside the initial contract and requires a profile/version that defines its arbitration.

Replay/test injection is the authoritative deterministic path. Browser automation need not emulate an OS gamepad; it tests physical adapters separately and drives gameplay through normalized frames. [R4 §Keyboard and gamepad input](../research/04-autonomous-evaluation.md#keyboard-and-gamepad-input)

### 16.3 Input-to-intent observability

Telemetry distinguishes:

```text
physical/input sample received
InputFrame assigned to tick
intent state changed
kinematic response started
visible animation response started
```

This preserves the research distinction between low intent latency and non-instantaneous body response. [R1 §Control responsiveness](../research/01-pes2027-behavior.md#atributos-controles-cámara-tempo-y-especificación-de-calibración)

## 17. Telemetry and observability

### 17.1 Observer boundary

The core emits structured observations to injected sinks; it does not write console logs, files, sockets, or UI directly. Instrumentation MUST be read-only with respect to authoritative state and MUST NOT alter iteration or RNG consumption.

The default observation model is:

- input frame: every tick;
- state hash: every tick in determinism suites, configurable persistence otherwise;
- semantic event log: on event;
- online metric accumulation: where cheap and side-effect free;
- full checkpoint: periodic or event-triggered, configurable;
- presentation/camera telemetry: browser path only.

[R4 §State recording and telemetry](../research/04-autonomous-evaluation.md#state-recording-and-telemetry) supports this forensic split.

### 17.2 Required observable domains

Telemetry must make these domains inspectable:

- tick, simulation time, input, PRNG state/hash;
- player position, velocity, desired velocity, body/desired heading, locomotion/action/contact/balance/tactical state;
- ball position, velocity, angular velocity, regime, and contacts;
- contact/action events with before/after state references;
- last touch, control eligibility/window, and team possession facts;
- team phase, role assignments, centroid, width, length, line heights, and compactness where defined;
- rule events and match clock;
- runtime tick cost, render cost, dropped frames, and memory as non-authoritative performance data;
- camera transform/target/FOV/zoom for presentation studies.

Metric definitions SHOULD be reusable between engine traces and the PES reference dataset wherever the measured quantity is equivalent. Raw observations, derived metrics, uncertainty, validity, and provenance remain separate. [R2 §Preserve raw, corrected and derived layers](../research/02-reference-measurement.md#preserve-raw-corrected-and-derived-layers) [R4 §Measurement and reference comparison](../research/04-autonomous-evaluation.md#measurement-reference-comparison-and-critics)

Diagnostic observations are versioned subsystem schemas, not an open-ended log. The minimum schema families are:

| Schema family | Required evidence |
|---|---|
| canonical world/config | before/after tick state, immutable geometry/policy/config IDs, stable entity references, PRNG and scheduler state |
| locomotion/contact | desired and actual kinematics, contact candidates, canonical sort keys, correction/impulse components, balance state, solver/substep identifiers |
| action/ball/reach | action phase, candidate and selected semantic surface, contact/reach volumes, incoming/outgoing ball state, reach graph/margins, assistance-policy decisions |
| AI/tactics | perception snapshot, utility inputs/scores, hysteresis/memory, selected intention, team assignment maps and decision cadence |
| control/possession/rules | control-slot commands and arbitration, eligibility windows, last-touch evidence, derived possession inputs, ordered rule inputs/outputs |
| presentation | support-foot/pose/semantic anchors, projected contact points, camera/animation/LOD state, simulation-event and visible-response ticks |

Every schema has an ID/version, required fields, cadence, producer boundary, and missing-data behavior. Evaluation bindings name exact observation IDs and schema versions; a missing channel or required field invalidates a required run.

Observations have three trust classes:

1. `RAW_CANONICAL`: the runner captures canonical before/after state and immutable configuration directly through the serializer/observer boundary, rather than accepting a candidate-authored report file.
2. `CANDIDATE_SEMANTIC`: action, contact, possession, reach, phase, and rule labels emitted by the candidate. These are diagnostic claims and are never sufficient evidence for the corresponding hard invariant.
3. `EVALUATOR_DERIVED`: facts recomputed by protected evaluator code from raw state, ordered inputs, and immutable geometry/policy data.

Protected invariant oracles MUST recompute continuity and teleport detection, total ordering, contact/reach feasibility, rebound continuity, and possession/control preconditions. They compare candidate semantic events with independently derived facts and fail on missing, impossible, or contradictory evidence. Oracle source, schemas, fixtures, held-out material, and versions are read-only to ordinary gameplay candidates and are validated by the mutant suite. The trust boundary does not imply that canonical state is truthful by assertion; it makes that state the raw evidence against which evaluator-owned algorithms test the candidate's semantic claims.

### 17.3 Invariants

At minimum, evaluation can assert:

- no NaN/Infinity in canonical state;
- same run contract produces identical tick hashes in the pinned runtime;
- ball continuity/no teleport between contacts;
- possession/control changes require valid evidence;
- stable IDs and valid references;
- configured hard world bounds are respected;
- mirrored scenarios produce appropriately mirrored results where symmetry applies.

Exact gameplay acceptance envelopes remain unavailable until the reference campaign is completed. [R4 §Detecting metric gaming](../research/04-autonomous-evaluation.md#detecting-metric-gaming-and-reward-hacking) [AUDIT F-01 and F-30](../research/RESEARCH_AUDIT.md#findings)

## 18. Replay architecture

### 18.1 Replay contents

A replay contains:

```text
Replay header
  replay/schema version
  simulation build/version
  runtime/toolchain identity
  configuration, pitch/rules, roster/capability, and scenario hashes
  initial state or initial-state reference
  PRNG algorithm/version and seed/state

Timeline
  tick-indexed normalized InputFrames
  deterministic scheduled events
  periodic canonical state hashes
  optional checkpoints/snapshots

Optional derived data
  semantic event index
  presentation metadata
  telemetry/metrics references
```

Input, seed, and initial state are the reconstruction basis. Periodic hashes detect divergence; optional checkpoints support seeking, diagnosis, recovery, and version migration.

### 18.2 Replay guarantees

Input-only replay is not the sole durable format until deterministic reconstruction has been proved for the supported environment and a migration policy exists. Checkpoints MUST remain available as an optional compatibility/recovery layer. Illustrative replay sizes in the vision are not requirements. [VISION §18](../VISION.md#18-replays-baratos) [R4 §State recording](../research/04-autonomous-evaluation.md#state-recording-and-telemetry) [AUDIT F-29](../research/RESEARCH_AUDIT.md#f-29--replay-compactness-is-assumed-before-determinism-is-proven)

Playback validates hashes at recorded ticks and reports the earliest divergence with the relevant state/event slice. A replay created by another simulation version is rejected, migrated explicitly, or played from compatible checkpoints; it is never silently interpreted as identical.

## 19. Scenario execution

### 19.1 Scenario as versioned data

Laboratory and match scenarios are declarative, versioned data rather than hard-coded browser scripts. A scenario specifies:

```text
id, version, family
duration in ticks
seed policy
pitch/rules/config versions
initial teams, players, ball, and match state
capability/tactic overrides
input trace or deterministic input generator
scheduled scripted events
observation windows
requested metrics and invariants
optional reference target IDs
```

Scripted intervention is tick-indexed and recorded. Any direct state setup or teleport used to establish an experiment occurs in initial state or as an explicit scenario event; it cannot masquerade as normal gameplay.

### 19.2 Shared execution

The same scenario definition runs through headless and browser adapters. Headless execution is the primary scientific path; browser execution verifies the shipped integration and presentation at exact ticks. Scenarios may freeze irrelevant systems so locomotion, free-ball, touch, contact, and team-shape behavior can be isolated. [R3 §Prototype research path](../research/03-simulation-techniques.md#prototype-sequence-as-decision-experiments) [R4 §Scenario runner](../research/04-autonomous-evaluation.md#scenario-runner)

### 19.3 Reference eligibility

A scenario may run without a populated PES target. Reference target metadata inherits its observability/causal class from the canonical registry:

- class A: strong objective signal;
- class B: uncertainty-adjusted objective signal;
- class C: diagnostic only until controlled evidence exists;
- class D: perceptual validation, not an invented numeric gate;
- absent target: no PES-fidelity acceptance claim.

This corrects the class mismatch and absent-target assumption described by [R2 §Measurability classification](../research/02-reference-measurement.md#reference-test-catalog-measurability-classification) and [AUDIT F-30](../research/RESEARCH_AUDIT.md#f-30--gauntlet-assumes-populated-reference-targets-and-contains-a-class-mismatch).

## 20. Repository and logical package boundaries

### 20.1 Smallest enforceable layout

The repository starts with the smallest physical layout that enforces dependency direction. The following are logical package boundaries; they MAY initially be folders in one TypeScript workspace and become separately published/buildable packages only when independent consumers require it.

```text
src/
  contracts/              pure versioned data contracts
  simulation/             authoritative DOM-free core
    world/
    loop/
    locomotion/
    ball/
    actions/
    contacts/
    ai/
    tactics/
    rules/
    telemetry/
  adapters/
    input-browser/        keyboard/Gamepad -> InputFrame
    renderer-three/       PresentationSnapshot -> Three.js
    data-simulation/      external roster data -> neutral gameplay profiles
    data-presentation/    external visual/art data -> neutral visual profiles/config
    replay/               replay encoding/decoding and playback glue
  apps/
    browser/              real-time composition root
    headless/             Node composition root/CLI

eval/
  scenarios/
  runners/
  recording/
  metrics/
  invariants/
  reference/

research/                 source research and future corpus artifacts
specs/                    normative specifications
artifacts/                generated, non-source run output
```

Exact filenames, workspace tooling, and whether `contracts` is a distinct npm package are non-normative. The logical boundaries and dependency rules are normative. This resolves the competing illustrative layouts using [AUDIT F-41](../research/RESEARCH_AUDIT.md#f-41--repository-layouts-are-illustrative-but-mutually-inconsistent).

### 20.2 Logical responsibilities

| Boundary | Owns | Must not own |
|---|---|---|
| `contracts` | Input, neutral data, presentation, event, snapshot/replay schema types | Simulation algorithms, DOM, Three.js, Node I/O |
| `simulation` | Authoritative state and all gameplay transitions | DOM, renderer, devices, network, filesystem, provider schemas |
| `input-browser` | Keyboard/Gamepad discovery and normalization | Gameplay decisions or direct player mutation |
| `renderer-three` | Scene, animation, camera, visuals | Canonical contacts, rules, physics, AI |
| `data-simulation` | Provider-specific roster parsing into neutral gameplay profiles | Provider types leaking into core |
| `data-presentation` | Provider/art parsing into neutral visual profiles and `PresentationMatchConfig` inputs | Gameplay values, renderer fetches, mutable global selection |
| `replay` | Encoding, decoding, validation, playback composition | Alternative gameplay logic |
| `browser app` | Real-time scheduling and adapter composition | Duplicate simulation rules |
| `headless app` | Explicit tick batches and artifact sinks | Timed real-time simulation authority |
| `eval` | Scenario/observation/metric/invariant registries, protected oracles, suites, comparison | Production core dependency on evaluator policy or candidate mutation of protected material |

### 20.3 Dependency rules

```text
contracts
  ^       ^             ^              ^
  |       |             |              |
simulation  input-browser  renderer-three  data adapters
  ^             \             /             /
  |              \           /             /
  +--------------- browser composition ----+
  |
  +---- headless composition
  +---- replay playback
  +---- evaluation runners
```

Normative rules:

1. `contracts` has no dependency on another project layer.
2. `simulation` depends only on `contracts`, deterministic internal utilities, and explicitly approved solver dependencies behind an adapter.
3. No simulation module imports DOM, Canvas, Three.js/Babylon.js, Gamepad, Playwright, Node filesystem/process APIs, network APIs, or external provider models.
4. Render, input, data, replay-I/O, browser, headless, and evaluation code depend inward; the core never depends outward.
5. The renderer consumes presentation contracts, not mutable world storage.
6. External data is validated and normalized before simulation creation.
7. Evaluation/reference code is read-only from the simulation's perspective; production code cannot modify acceptance criteria.
8. Circular dependencies across logical boundaries are prohibited.
9. A new runtime/framework dependency requires a demonstrated capability or profiling need and must not become the owner of football semantics.

These rules implement [VISION §26](../VISION.md#26-estructura-propuesta-del-repositorio), [R4 §Repository shape](../research/04-autonomous-evaluation.md#repository-shape), and the audit's narrower logical-boundary resolution.

## 21. Selected technologies

| Area | Selection | Architectural status and rationale |
|---|---|---|
| Core language | TypeScript, ESM | Selected common language for core, browser adapters, and evaluation; browser/Node portability is central. [VISION §6](../VISION.md#6-tecnología-del-cliente) [AUDIT §Decisions supported now](../research/RESEARCH_AUDIT.md#decisions-sufficiently-supported-to-make-now) |
| Numeric baseline | JavaScript `Number` / IEEE-754 binary64 | Selected for the initial pinned-runtime core; cross-engine bit identity is not promised. [R3 §Browser floating point](../research/03-simulation-techniques.md#browser-floating-point) |
| Player simulation | Custom controlled kinematic locomotion and deterministic planar contact | Selected for direct calibration and football-specific body/velocity separation. [R3 §Player locomotion](../research/03-simulation-techniques.md#player-locomotion-and-physical-contact) |
| Ball simulation | Replaceable custom parameterized integrator first | Selected only as the laboratory baseline; final custom-versus-Rapier choice awaits comparison. [AUDIT F-08/F-23](../research/RESEARCH_AUDIT.md#findings) |
| State architecture | Explicit typed world state with stable IDs | Selected; no generic ECS dependency. [AUDIT F-09](../research/RESEARCH_AUDIT.md#f-09--ecs-adoption-directly-conflicts) |
| Browser renderer | Three.js, provisionally | First adapter, kept replaceable; Babylon.js remains deferred. [AUDIT F-14](../research/RESEARCH_AUDIT.md#f-14--renderer-choice-is-unresolved-despite-conflicting-decide-now-language) |
| Graphics baseline | WebGL2 through the renderer | Sufficient baseline; WebGPU requires a measured bottleneck and support decision. [R5 §Performance strategy](../research/05-browser-architecture.md#performance-strategy) [AUDIT §Deferred decisions](../research/RESEARCH_AUDIT.md#decisions-that-should-remain-deferred) |
| Browser input | Keyboard APIs and Gamepad API behind adapters | Selected device sources; normalized replay/test input remains authoritative. [VISION §3.2](../VISION.md#32-control-humano) [R4 §Keyboard and gamepad](../research/04-autonomous-evaluation.md#keyboard-and-gamepad-input) |
| Headless runtime | Pinned Node.js runtime | Selected first-class non-browser execution path with explicit tick loops. [R3 §Headless execution](../research/03-simulation-techniques.md#headless-execution) |
| Browser integration testing | Playwright | Selected for exact test bridge control, screenshots, frame sequences, video, and traces. [R4 §Browser artifacts](../research/04-autonomous-evaluation.md#browser-artifacts) |
| Browser bundling/dev server | Vite, provisional | Vision default; useful composition tooling but not part of simulation architecture. [VISION §6](../VISION.md#6-tecnología-del-cliente) |
| Randomness | Explicit seedable versioned PRNG | Architecture selected; exact algorithm remains TBD. [R3 §Deterministic RNG](../research/03-simulation-techniques.md#deterministic-rng) |

## 22. Explicitly deferred decisions

The following are outside the current architectural commitment. They remain configurable, experimental, or require a separate specification.

### 22.1 Simulation and gameplay values

- exact fixed tick rate and ball/contact substep or CCD policy;
- locomotion acceleration, braking, top-speed, turn, orientation, stamina, and on-ball response curves;
- player capability ranges and external rating mappings;
- all ball roll, bounce, drag, spin-decay, curve, mass/dimension, and surface parameters;
- first-touch, dribble, pass, shot, interception, and assistance mappings;
- contact geometry, balance, shielding, stumble, tackle, and foul thresholds;
- goalkeeper reaction, reach, catch/parry, recovery, and decision architecture;
- formation anchors, tactical mappings, AI utilities/weights, reach-grid resolution, pressing assignments, and decision cadence;
- full offside, foul/advantage, restart, referee, match-clock edge-case, and set-piece rules.

These values lack the completed reference and controlled-capture evidence identified by [AUDIT F-01–F-03, F-21, and F-23–F-26](../research/RESEARCH_AUDIT.md#findings).

### 22.2 Physics, execution, and data structures

- final custom ball solver versus Rapier adoption;
- Rapier for auxiliary scene queries, sensors, posts, or exceptional dynamic states;
- a generic ECS or bitECS conversion;
- Web Workers, renderer workers, OffscreenCanvas, SharedArrayBuffer, COOP/COEP, and their transport layouts;
- WebAssembly beyond a separately justified dependency;
- fixed-point or custom deterministic numeric implementation;
- universal cross-browser determinism and network lockstep.

### 22.3 Presentation and performance

- final Three.js versus Babylon.js selection if the provisional adapter proves inadequate;
- WebGPU;
- exact shader model, cel bands, outlines, post-processing, shadows, LOD, rig, texture, polygon, crowd, and face budgets;
- motion matching, foot locking, visual contact IK limits, ragdolls, and physics-driven animation;
- default camera parameters and replay/dynamic cameras;
- ball trails, glow, spotlights, and other motion cues;
- target hardware/browser matrix, quality tiers, frame/tick/memory/load budgets, and visual readability thresholds.

### 22.4 Product, network, data, and evaluation

- production multiplayer authority and transport: WebRTC host, peer lockstep, Colyseus, Durable Objects, or another server topology;
- network send/snapshot rates, prediction, reconciliation, rollback, TURN use, and operating cost;
- external real-player/team source, scraping, caching, licensing, branded assets, and redistribution;
- compact input-only replay as the sole long-term replay format;
- Arrow/Parquet or another reference-corpus storage choice outside the simulation contracts;
- evaluator acceptance/regression/stagnation thresholds;
- autonomous promotion, multi-agent critic topology, and OpenCode-versus-Pi integration;
- Kubernetes, microservices, a permanent match server, complex databases, and global infrastructure.

The deferral rationale is consolidated in [AUDIT §Decisions that should remain deferred](../research/RESEARCH_AUDIT.md#decisions-that-should-remain-deferred).

## 23. Architectural decision traceability

| Decision | Research rationale |
|---|---|
| Renderer-, DOM-, server-, and provider-independent core | Vision's primary principle; required for headless calibration and interchangeable presentation/data. [VISION §2](../VISION.md#2-principio-principal) [R4 §Executive architecture](../research/04-autonomous-evaluation.md#executive-architecture) |
| Synchronous core with browser/headless adapters | Exact stepping and faster-than-real-time evaluation require no wall-clock/browser dependency. [R3 §Headless execution](../research/03-simulation-techniques.md#headless-execution) [AUDIT F-06/F-13](../research/RESEARCH_AUDIT.md#findings) |
| Fixed-step architecture; frequency TBD | Fixed steps support stability/replay, while research has not selected 60 versus 120 Hz or substeps. [R3 §Fixed-step](../research/03-simulation-techniques.md#fixed-step-simulation) [AUDIT F-12](../research/RESEARCH_AUDIT.md#f-12--the-exact-simulation-rate-and-substep-policy-remain-tbd) |
| Pinned-runtime determinism now; cross-platform later | Calibration and replay require repeatability, but JS/solver claims do not prove universal lockstep. [R3 §Reproducibility](../research/03-simulation-techniques.md#reproducibility-discipline) [AUDIT F-10/F-11](../research/RESEARCH_AUDIT.md#findings) |
| Explicit typed state, stable IDs, no generic ECS | Only 22 players and one ball are core entities; inspectability, serialization, and order matter more than generic queries. [R3 §ECS](../research/03-simulation-techniques.md#ecs-versus-simpler-state-organization) [AUDIT F-09](../research/RESEARCH_AUDIT.md#f-09--ecs-adoption-directly-conflicts) |
| SI units, centre origin, configurable pitch, planar players/3D ball | Measurement, mirroring, rendering, and replay need one explicit convention; pitch size is not universally fixed. [R2 §Pitch geometry](../research/02-reference-measurement.md#pitch-geometry-tracking-and-camera-compensation) [AUDIT F-20 disposition](../research/RESEARCH_AUDIT.md#finding-dispositions) |
| Kinematic normal players | Best fit for calibrated football locomotion and lower complexity than dynamic humanoids. [R3 §Player locomotion](../research/03-simulation-techniques.md#player-locomotion-and-physical-contact) |
| Desired velocity/heading separate from actual velocity/body heading | Preserves immediate intent plus body weight and contextual orientation. [R1 §Movement](../research/01-pes2027-behavior.md#movimiento-aceleración-orientación-inercia-y-contacto) |
| Independent 3D ball | Loose balls, rebounds, first touch, and contested possession require continuous ball state. [R1 §Ball](../research/01-pes2027-behavior.md#balón-independiente-primer-toque-pases-tiros-y-juego-aéreo) |
| Replaceable custom ball model first; Rapier deferred | One ball and empirical roll curves favor direct control, but a solver benchmark is still required. [R3 §Physics engine](../research/03-simulation-techniques.md#physics-engine-choice) [AUDIT F-08/F-23](../research/RESEARCH_AUDIT.md#findings) |
| Simulation-authoritative action/contact events | Headless parity and calibration fail if animation/root motion changes canonical trajectories or contact time. [R3 §Animation separation](../research/03-simulation-techniques.md#animation-and-simulation-state-separation) [AUDIT F-19](../research/RESEARCH_AUDIT.md#f-19--animationcontact-authority-is-not-consistently-resolved) |
| Possession split into last touch, eligibility/window, tactical/statistical possession, and restart ownership | Resolves ambiguous possession without ball parenting. [R1 §Ball independence](../research/01-pes2027-behavior.md#balón-independiente-primer-toque-pases-tiros-y-juego-aéreo) [AUDIT F-18](../research/RESEARCH_AUDIT.md#f-18--possession-is-both-an-explicit-state-and-an-emergent-relationship) |
| Formation-first, role-first utility/reachability AI | Prevents swarm behavior and keeps decisions explainable/calibratable; locomotion constrains feasibility. [R3 §AI and tactics](../research/03-simulation-techniques.md#ai-and-tactics) [AUDIT F-25](../research/RESEARCH_AUDIT.md#f-25--ai-technique-direction-is-supported-but-target-behavior-is-not-measured) |
| Immutable presentation snapshots and one-way animation | Lets visuals change without changing football outcomes and supports independent headless evaluation. [R4 §What should be authoritative](../research/04-autonomous-evaluation.md#what-should-be-authoritative) |
| Three.js provisional renderer; stylized readability principles only | Both renderers are feasible; the vision supplies a reversible default while shader/art budgets lack evidence. [AUDIT F-14/F-15](../research/RESEARCH_AUDIT.md#findings) |
| Main-thread composition first; workers/SAB later | A worker boundary adds complexity before representative profiling, while a synchronous core remains portable. [R3 §Workers](../research/03-simulation-techniques.md#web-workers-and-webassembly) [AUDIT F-06/F-07](../research/RESEARCH_AUDIT.md#findings) |
| One tick-indexed normalized input contract | Devices, AI, replay, tests, and future network input need identical gameplay semantics. [R4 §Keyboard and gamepad](../research/04-autonomous-evaluation.md#keyboard-and-gamepad-input) [AUDIT F-27](../research/RESEARCH_AUDIT.md#f-27--input-abstraction-is-supported-but-sampling-semantics-and-device-policy-are-tbd) |
| Structured state/event/hash telemetry through observers | Reproducible diagnosis requires exact state evidence; pixels remain presentation evidence. [R4 §State recording](../research/04-autonomous-evaluation.md#state-recording-and-telemetry) |
| Replay includes provenance, inputs, hashes, and optional checkpoints | Input-only compactness is unsafe before deterministic reconstruction and migration are proven. [AUDIT F-29](../research/RESEARCH_AUDIT.md#f-29--replay-compactness-is-assumed-before-determinism-is-proven) |
| Versioned declarative scenarios shared by browser/headless | Isolated, reproducible experiments are the supported path to calibration and regression. [R4 §Scenario runner](../research/04-autonomous-evaluation.md#scenario-runner) |
| Logical inward dependencies; smallest physical layout | All source layouts agree on simulation separation, but not on package proliferation. [AUDIT F-41](../research/RESEARCH_AUDIT.md#f-41--repository-layouts-are-illustrative-but-mutually-inconsistent) |
| Fictional internal capability archetypes initially | PES/provider dimensions support separation of abilities but not numeric mappings or redistribution rights. [AUDIT F-21/F-22](../research/RESEARCH_AUDIT.md#findings) |

## 24. Resulting architecture

The system is a deterministic, fixed-step, TypeScript football simulation with controlled kinematic players, one independent 3D ball, explicit action/contact events, and formation-first explainable AI. Its canonical world is portable between a synchronous browser runtime and a faster-than-real-time Node.js runtime. Devices, renderer, replay storage, external data, telemetry sinks, and future networking remain adapters that depend inward on stable contracts.

The architecture is intentionally more definite about boundaries than about gameplay numbers. It defines where acceleration, turning, touch, ball, contact, tactics, and rules live and how they interact, while leaving their unsupported constants and formulas configurable/TBD until the reference and engine experiments produce evidence.
