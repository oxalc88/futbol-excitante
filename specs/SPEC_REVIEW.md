# Cross-Specification Architecture Review

**Review date:** 2026-08-12

**Reviewed sources:** `VISION.md`, `research/RESEARCH_AUDIT.md`, `specs/TECHNICAL_SPEC.md`, `specs/GAMEPLAY_EVALUATION_SPEC.md`, and `specs/VISUAL_SPEC.md`

**Review posture:** Independent architecture and specification review. This document does not amend any reviewed specification.

## Executive assessment

The three specifications preserve the most important project boundary: the football simulation is authoritative, renderer-independent, fixed-step, headless-capable, seeded, and observable through adapters. They also correctly avoid presenting absent PES measurements as calibrated constants. The Technical and Visual Specs resolve most conflicts already identified by the research audit without prematurely selecting workers, ECS, Rapier, WebGPU, production art budgets, or multiplayer topology.

The specification set is not yet an executable promotion contract, despite the Gameplay Evaluation Spec's status and opening claim. Its catalog is a strong test inventory, but most scenarios, metrics, invariant algorithms, observation bindings, applicability rules, and thresholds do not yet exist. In addition, the browser path has no deterministic owner for stateful presentation behavior, and the Gauntlet has no defined independent trust boundary for claims such as feasible contact, no teleport, or valid possession evidence.

The most urgent corrections are therefore contractual rather than gameplay tuning: define milestone-scoped promotion profiles, materialize executable evaluator registries, bind every required observation, introduce deterministic presentation-session control, and separate independent evaluator evidence from candidate-authored semantic claims.

| Severity | Count |
|---|---:|
| `BLOCKER` | 5 |
| `IMPORTANT` | 13 |
| `MINOR` | 4 |
| **Total** | **22** |

`BLOCKER` means the affected implementation, milestone acceptance, or Gauntlet promotion cannot be validly completed. It does not necessarily block the deterministic locomotion/ball foundation. `IMPORTANT` means the correction should be made before the affected subsystem or test family is implemented. `MINOR` means the ambiguity is containable but should be removed before automated tooling depends on it.

## BLOCKER findings

### B-01 — The Gameplay Evaluation Spec is a catalog, not yet an executable contract

**Resolution:** `RESOLVED` — Gameplay Evaluation §§1, 3, and 6 now classify the document honestly and define versioned executable scenario, observation, metric, invariant, binding, schema, suite, and tier registries with fail-closed resolution.

**Conflict:** Gameplay Evaluation §1 says scenarios and metric extraction are executable now, and §3 calls the catalog normative structured YAML. In reality, `initial_scenario`, `controlled_inputs`, `state_to_record`, `metrics`, and each criterion `rule` are natural-language strings. The proposed `TestImplementationBinding` has no instances, and the specs contain no executable scenario registry, metric formulas, estimator definitions, units per metric, observation-window algorithms, or invariant implementations. The spec itself says a missing binding returns `NOT_EVALUATED`.

**Impact:** Two conforming implementations can calculate materially different `t90`, turn radius, reach margin, compactness, contact time, or action latency. The Gauntlet cannot reproducibly run or compare the catalog, and the claim that metric extraction is executable is false.

**Recommended correction:** Reclassify the current document as a normative evaluation catalog/interface until a versioned evaluator package exists. Define machine-readable `ScenarioDefinition`, `MetricDefinition`, `InvariantDefinition`, and `TestImplementationBinding` registries. Every metric definition must name inputs, units, estimator, filters, window/boundary rules, invalid-data behavior, output schema, and version. Permit `PASS` or `FAIL` only when registry resolution and schema validation succeed.

### B-02 — Promotion has no milestone-scoped applicability model and can deadlock

**Resolution:** `RESOLVED` — Gameplay Evaluation §2.3 now defines versioned milestone/capability profiles, required-only verdict reduction, exact missing-capability behavior, and concrete foundation, 1v1, and small-sided profiles.

**Conflict:** Research Audit F-05 resolves the project into a locomotion/ball laboratory, playable 1v1 slice, and small-sided/team-shape prototype, but none of the three specs defines those milestone profiles. Gameplay Evaluation §2 makes missing references, unavailable regression policy, and perceptual review stronger than `PASS`; §8 then describes `PROMOTION` as full headless regression plus browser, visual, and match-ecology work “where implemented.” There is no normative definition of “where implemented,” “critical,” required versus optional tests, or which non-pass outcomes are permissible for a given milestone.

**Impact:** A locomotion change can never receive an overall `PASS` if the evaluator includes absent PES targets, unvalidated visual rubrics, deferred goalkeeper/rules tests, or unavailable regression tolerances. Conversely, an implementation could omit an inconvenient family and call it unimplemented. Promotion is neither achievable nor safe.

**Recommended correction:** Add a versioned `MilestoneProfile`/`CapabilityManifest` that lists required, optional-diagnostic, deferred, and prohibited test families; required execution paths; accepted outcome set; browser smoke set; and entry/exit prerequisites. Reduce outcomes only over criteria required by that profile, while reporting all other outcomes separately. Missing implementation of a required capability must be `INVALID_RUN` or `FAIL`; an explicitly deferred capability must not participate in the milestone verdict.

### B-03 — Gauntlet observations and hard-invariant oracles have no enforceable trust boundary

**Resolution:** `RESOLVED` — Gameplay Evaluation §3 and Technical §17.2 now bind versioned diagnostic channels, separate raw/candidate/evaluator evidence, and require protected evaluator-owned oracles to recompute hard facts from raw state and immutable policy data.

**Conflict:** Gameplay tests require data absent from Technical §17.2's guaranteed telemetry, including contact candidates and corrections, solver/substep state, contact volumes and surface geometry, AI perception, utility scores, reach graphs, AI memory, support-foot/pose markers, screen projections, and visible-response timestamps. `TestImplementationBinding` maps scenarios, metrics, and invariants but not observation channels. More seriously, hard criteria such as “feasible contact,” “valid possession evidence,” and “continuous rebound” can pass by trusting the same candidate-authored semantic event whose correctness is being tested. Technical §20 protects dependency direction but does not define which raw evidence is captured outside candidate-controlled reporting or which invariant logic is evaluator-owned.

**Impact:** Many catalog tests cannot be implemented from the promised core outputs. Others can be gamed by emitting self-consistent but false contact, possession, reach, or phase events. The mutant suite cannot prove that the evaluator detects the named defects.

**Recommended correction:** Define versioned diagnostic observation schemas per subsystem and add required `observation_ids` plus schema versions to each binding. Distinguish raw canonical state/configuration, candidate semantic events, and evaluator-derived facts. Implement protected invariant oracles that recompute continuity, ordering, reach/contact feasibility, and possession preconditions from raw before/after state and immutable geometry/policy data rather than accepting candidate labels. The evaluator must fail closed on a missing channel, schema field, or oracle version.

### B-04 — Exact-tick browser evaluation lacks deterministic presentation-session state

**Resolution:** `RESOLVED` — Technical §§13.5 and 15.3 plus Visual §§19 and 21 now define reset/seed/readiness, controlled presentation-time advancement, checkpoint/reconstruction, interpolation-phase capture, and non-gameplay presentation hashes.

**Conflict:** Technical §15.3 and Visual §§19–21 require resettable exact-tick captures over identical replays. Technical §13 makes animation, camera, LOD, and visual correction renderer-owned but specifies only immutable simulation snapshots and render interpolation. No contract owns or resets animation mixer time, blend history, camera lag, LOD hysteresis, particle/effect seeds, temporal post-processing, or asset-load readiness. A screenshot at simulation tick `t` can therefore depend on wall-clock history and prior test execution.

**Impact:** Frame strips, camera metrics, action/contact alignment, LOD transition tests, and visual regression artifacts are not reproducible. `COMMON-DETERMINISTIC` covers canonical state hashes only and cannot detect presentation drift.

**Recommended correction:** Add a non-authoritative but deterministic `PresentationSession` contract with `reset(config, assets, seed)`, explicit simulation-time/tick advancement, renderer-ready barriers, camera/animation/LOD state snapshot or deterministic reconstruction, and capture at a declared interpolation phase. For test mode, all temporal presentation systems must derive from the controlled presentation clock, never wall clock. Record a presentation-state/config hash beside each capture; keep it explicitly outside the canonical gameplay hash.

### B-05 — The vision's prototype success criterion cannot produce an acceptance result

**Resolution:** `RESOLVED` — Gameplay Evaluation §§2.1 and 5.6 add an engine-only design-target class, capability monotonicity/orthogonality contracts, and blinded same-model archetype acceptance without making PES claims.

**Conflict:** Vision §28 says gameplay works when deliberately different player profiles feel clearly different with the same visual model. Technical §9.3 correctly separates internal capabilities from unsupported PES/provider ratings, but Gameplay tests such as `LOC-ACC-002`, `PHY-STR-001`, `PHY-BC-001`, `PHY-PC-001`, `SHOT-IND-001`, and `SHOT-SWV-001` classify capability effects only as `UNKNOWN` plus threshold-free regression. That is correct for PES causal fidelity, but it leaves no engine-internal conformance or perceptual criterion for the declared fictional archetypes.

**Impact:** The first playable prototype has no way to establish its central product criterion. It can preserve whatever baseline happens to exist, including one where capabilities are imperceptible, entangled, or reversed.

**Recommended correction:** Add a separate `ENGINE_DESIGN_TARGET` or versioned internal-conformance class that makes no PES claim. Define the intended semantics and monotonic/orthogonality properties of each fictional capability profile, plus blinded same-model perceptual comparisons for whole-archetype differentiation. Keep external rating mapping and PES magnitude calibration `UNKNOWN` until controlled evidence exists.

## IMPORTANT findings

### I-01 — Canonical player cardinality conflicts with laboratory scenarios

**Resolution:** `RESOLVED` — Technical §8.1 now defines a stable-ID variable active set and explicit laboratory, small-sided, and regulation cardinality invariants, including inactive-roster exclusion.

**Conflict:** Technical §8.1 depicts `players[22]` and says exactly 22 active footballers is the regulation target, while Vision §27 and many Gameplay scenarios require one or two players. It is unclear whether the array is fixed capacity, exact active cardinality, or shorthand.

**Impact:** Scenario initialization, invariants, iteration order, team geometry, serialization, and performance baselines can make incompatible assumptions.

**Recommended correction:** Specify either a variable active set bounded by 22 for regulation profiles, or 22 stable slots with explicit inactive state excluded from gameplay systems and metrics. Define separate cardinality invariants for laboratory, small-sided, and regulation match profiles.

### I-02 — Team tactical state is duplicated without a single owner

**Resolution:** `RESOLVED` — Technical §§9.1 and 11.2 now make team records the sole owners of phase and assignment maps while limiting player state to individual intention and decision memory.

**Conflict:** Technical §9.1 places team phase, formation anchor, role assignment, tactical target, and utility/hysteresis state inside each player, while §11 describes team phase, shape deformation, roles, pressing assignments, and tactics as team-level decisions. World state lists both teams and players, but no normalization or consistency invariant identifies the authoritative owner.

**Impact:** Replay restoration or partial subsystem updates can leave a team in one phase while players record another, or allow role/press assignments to disagree with per-player copies. Hashes can be deterministic while the domain state is internally contradictory.

**Recommended correction:** Make team tactical state the sole owner of phase and assignment maps keyed by stable player ID. Keep player-local intention/action state on the player. Any per-player anchor/role/phase view should be explicitly derived, or a serialized cache with a mandatory equality invariant and one documented write phase.

### I-03 — Human control ownership is split ambiguously between core and adapters

**Resolution:** `RESOLVED` — Technical §§13.1 and 16 now separate unstable device/session ownership from canonical stable-slot assignments, define switch/claim/disconnect and duplicate/missing-frame arbitration, make `sourceId` provenance-only, and expose assignments for local presentation indicators.

**Conflict:** Technical §9.1 makes `controlAssignment` canonical player state, §16 places device ownership in adapters, and `InputFrame` contains both `sourceId` and `controlSlot`. The spec does not say whether device identity can affect gameplay, how two local controllers claim teams/players, how control switching is ordered, or what happens on disconnect. The Visual Spec requires controlled-player indicators, but the presentation snapshot example does not expose control slots or locally relevant controlled actors.

**Impact:** Local two-player support from Vision §3.2/§12, deterministic replay, player switching, AI takeover, and controlled-player rendering can acquire hidden adapter-to-simulation coupling.

**Recommended correction:** Separate device/session ownership from canonical match control. Adapters map unstable devices to stable `controlSlot`s; only tick-indexed control-assignment/switch commands and stable slots enter simulation. Define arbitration, disconnect/AI fallback, duplicate-frame behavior, and whether `sourceId` is provenance-only and excluded from gameplay decisions. Expose stable control-slot assignments through the presentation contract, with local indicator selection owned by the browser composition layer.

### I-04 — Simulation reach geometry and visual embodiment have no compatibility contract

**Resolution:** `RESOLVED` — Technical §§4.3 and 12.2 plus Visual §§5.2 and 17.1 now define versioned semantic-surface embodiment mappings, pose/scale/correction bounds, import fixtures, rejection behavior, and fail-closed runtime contact presentation.

**Conflict:** Technical §§4.3 and 12.2 allow simulation-owned vertical reach/contact data, while the Visual Spec makes rig sockets and anchors presentation-only and forbids mesh bounds from changing gameplay. Header, tackle, kick, and goalkeeper tests nevertheless require the rendered head/foot/leg/hand to agree with a canonical contact and allow only bounded visual correction. Neither spec defines how a canonical surface/contact point maps to a rig, archetype, limb length, or pose envelope, nor what happens when the mesh cannot reach it.

**Impact:** A valid headless contact may be visually impossible, and the only available fixes are unbounded IK, visual interpenetration, or illicitly changing gameplay geometry to match the asset.

**Recommended correction:** Define a versioned embodiment mapping contract: semantic contact surfaces, canonical body/reach dimensions, rig anchor IDs, pose-envelope compatibility, scale policy, and maximum visual correction. Validate assets against every supported simulation body/reach profile at import. Reject incompatible pairings; never silently resize simulation or visual reach.

### I-05 — Visual match data has no explicit route through the architecture

**Resolution:** `RESOLVED` — Technical §13.1.1 and Visual §7.1 now route a browser-owned `PresentationMatchConfig` from neutral presentation adapters to the renderer, validate shared IDs/assets, record capture provenance, and exclude it from gameplay state/hash.

**Conflict:** Visual §7 requires `TeamVisualProfile`, goalkeeper/official kits, accessibility variants, and matchup selection. Technical §3 shows only external team data becoming neutral team/capability data, and §20's data adapter describes provider data to neutral profiles. The renderer consumes `PresentationSnapshot`, which does not contain visual profiles, kit selection, asset IDs, accessibility settings, or the controlled-player presentation mapping.

**Impact:** Implementers may put art/kit data into canonical simulation state, let the renderer fetch provider data, or smuggle presentation selection through mutable global state. Each choice violates another stated boundary or weakens replay provenance.

**Recommended correction:** Add an explicit `PresentationMatchConfig` input owned by browser composition and consumed by the renderer, separate from `SimulationMatchConfig`. It should bind stable simulation team/player IDs to versioned visual profiles, selected kits/assets, accessibility mode, and local indicators. Validate shared IDs at composition time, include the presentation config in capture provenance, and exclude it from gameplay state/hash.

### I-06 — Candidate identity is incorrectly mixed with comparison conditions

**Resolution:** `RESOLVED` — Gameplay Evaluation §§4, 5.5, and 12 now separate artifact provenance from a shared comparison-condition hash and define the exact allowed differences for candidate-versus-baseline pairs.

**Conflict:** Gameplay §4 requires `candidate_commit`, `parent_best_commit`, and `dirty_tree_status` in every run contract, while §5.5 requires candidate and best to run “under the same run contract.” Different commits necessarily make those contracts—and presumably `run_contract_hash`—different. The same ambiguity affects comparisons across simulation versions.

**Impact:** A strict comparator will reject every candidate-versus-best pair as non-equivalent; a loose comparator may ignore genuine condition changes.

**Recommended correction:** Split the manifest into (1) immutable artifact provenance, including candidate/baseline commit and build identity, and (2) a `comparison_condition_hash` covering scenario, inputs, seeds, runtime class, gameplay config, capability/tactic profiles, metric contract, and applicable presentation conditions. Define an allowed-difference policy that expects build identity to differ while all experimental conditions remain equivalent.

### I-07 — Reference target status has two sources of truth

**Resolution:** `RESOLVED` — Gameplay Evaluation §§3, 5, and 7 remove catalog target-presence flags and make the versioned registry the sole authority, with a fail-closed `(test_id, criterion_id)` join and class check.

**Conflict:** Every catalog record embeds `reference_evidence.target_status: ABSENT`, while a separate `ReferenceTarget` registry is intended to become populated. Publishing a target would require either modifying the supposedly stable catalog record or allowing it to contradict the registry. The same record duplicates the reference class that the Technical Spec says must be inherited from the canonical registry.

**Impact:** A valid target can be ignored, or an outdated catalog flag/class can incorrectly activate or block a gate.

**Recommended correction:** Keep immutable catalog metadata limited to the expected evidence class and evidence limitation. Make target presence, eligibility, current reference class, strata, and versions registry-owned. At evaluation time join by `(test_id, criterion_id)` and reject a class mismatch; do not store mutable target presence in the catalog.

### I-08 — Detailed tick phase ordering is premature and underspecifies simultaneity

**Resolution:** `RESOLVED` — Technical §6.2 now makes the eleven-stage sequence a replaceable prototype scheduler, freezes only coherent-read/staged-write/order/commit invariants, defines versioned held cadences, and requires explicit same-tick arbitration before affected promotion.

**Conflict:** Technical §6.2 freezes an eleven-stage order in which tactics and individual AI are computed each tick, player/player contacts precede player/ball action contacts, and rules precede derived control/possession. Yet §11.3 leaves AI decision cadence TBD, and §12.7 defers complex rule/event ordering. Research supports stable documented ordering, not this particular untested football ordering.

**Impact:** Simultaneous tackle/shot, ball/post/player, foul/advantage, boundary/contact, and possession-transition cases may become accidentally dependent on an early pipeline choice. Computing all tactical decisions every physics tick may also silently settle a deferred cadence decision.

**Recommended correction:** Make the current sequence a provisional scheduler profile, not a frozen gameplay truth. Specify only immediate architectural invariants now: coherent read snapshots, staged writes, total event/contact ordering, and explicit commit. Let AI/tactics stages run on versioned cadences while holding prior decisions. Require the rules/contact specs to define same-tick arbitration before their families become milestone requirements.

### I-09 — Full-match tempo tests depend on rules the architecture explicitly cannot yet supply

**Resolution:** `RESOLVED` — Gameplay Evaluation §§2.3 and 8 now defer full-match promotion, enumerate required goalkeeper/rules specifications and suites, and make keeper/tempo evaluation fail closed when prerequisites are absent.

**Conflict:** Technical §12.7 defers goals, boundaries, offside, fouls/advantage, restarts, timing edge cases, and deep goalkeeper logic to future specs. Gameplay still includes goalkeeper hard invariants and `TEMPO-001/002` full-match ecology, but it has no rules test family for goal validity, out-of-play, restart placement, offside snapshots, foul/advantage order, or clock/ball-in-play accounting.

**Impact:** A match can produce plausible event rates while implementing incorrect or missing football rules. Tempo targets cannot be conditioned on valid ball-in-play time, and match-ecology promotion can activate without proving its prerequisites.

**Recommended correction:** Add explicit capability prerequisites to keeper and tempo tests. Before full-match promotion, publish dedicated goalkeeper and deterministic rules specs plus executable rule suites covering goals, boundaries, restarts, offside, fouls/advantage, phase/clock transitions, and same-tick event order. `TEMPO-001/002` must refuse evaluation unless that rules capability profile passes.

### I-10 — Regression “dependencies” are cyclic and their semantics are undefined

**Resolution:** `RESOLVED` — Catalog links and suite policy now use `regression_impact_ids`; §8 defines deterministic visited-set fixed-point reachability, canonical output, and expansion-manifest validation rather than prerequisite ordering.

**Conflict:** Gameplay §8 says dependency closure is computed, but the graph is highly cyclic: examples include `LOC-ACC-001 <-> LOC-DEC-001`, `BALL-GND-001 <-> BALL-GND-002`, `CAM-FLW-001 <-> CAM-PER-001`, and multi-node cycles across pass, interception, touch, keeper, and team tests. The term “dependency” suggests a prerequisite order, while the data behaves like symmetric regression-impact associations. No closure or cycle behavior is specified.

**Impact:** A topological executor will fail; a recursive executor without a visited set can loop; and a small targeted change can unexpectedly expand to most of the catalog.

**Recommended correction:** Rename these links to `regression_impact_ids` unless true prerequisite semantics are intended. Define closure as set reachability with a visited set, publish the expected expanded suite for validation, and add separate acyclic `prerequisite_capabilities` for actual execution order/availability.

### I-11 — Suite and tier schemas are not machine-defined

**Resolution:** `RESOLVED` — Gameplay Evaluation §§3 and 8 now define uniform machine-readable suite/tier schemas and concrete registries for test selection, closure, prerequisites, matrices, held-out work, browser cases, resources, and outcome reduction.

**Conflict:** Gameplay §3 says §8 is a separate registry document, but supplies no `SuiteDefinition` type. `fast` is an object with `includes`, while every other suite is a bare array. The four evaluation tiers are prose and are not linked to suite IDs, required outcomes, seeds, held-out policy, or browser tests.

**Impact:** Materializers must invent special cases and different Gauntlet implementations will select different work for `FAST`, `TARGETED`, `DEEP`, and `PROMOTION`.

**Recommended correction:** Define one uniform machine schema for suites and tiers, including direct tests, impact-closure policy, capability prerequisites, seed/config matrices, held-out selection, required browser cases, timeout/resource policy, and outcome-reduction profile. Validate suite expansion as part of the evaluator contract.

### I-12 — The visual experiment register contains circular prerequisites

**Conflict:** Visual shader decisions require a representative asset and target-device cost; production asset budgets require a provisional camera and accepted material/LOD profiles; LOD decisions require representative asset memory/performance; camera selection relies on readable representative actors and ball behavior. The document lists all experiments but no staged dependency or provisional-fixture policy.

**Impact:** Teams can either freeze an input prematurely or wait indefinitely for another experiment to finish. Results from an early placeholder may later be treated as production evidence without revalidation.

**Recommended correction:** Define a two-pass experiment sequence. First use a deliberately provisional representative fixture to select a camera/material baseline and target matrix; then build and benchmark the production-candidate asset/LOD pipeline; finally rerun camera/readability checks before freezing budgets. Every decision record should list provisional dependencies that force revalidation when they change materially.

### I-13 — Instrumentation can invalidate the performance measurements it records

**Conflict:** Gameplay §4 requires full player, ball, and team state every tick for every test, while Technical §17 allows full checkpoints to be periodic and Visual `VIS-PERF-001` measures p95 frame cost, memory, and load behavior. No spec separates scientific full-trace runs from low-overhead performance runs or budgets observer overhead.

**Impact:** Serialization, allocation, screenshots, and trace collection can dominate the runtime being measured. Conversely, disabling instrumentation can remove evidence needed to reproduce a failure.

**Recommended correction:** Define observation profiles such as `FULL_FORENSIC`, `METRIC_ONLINE`, and `PERFORMANCE_MINIMAL`. Measure observer/capture overhead independently, prohibit screenshots/full serialization inside timed performance windows, and retain hashes plus event-triggered preallocated ring buffers for diagnosis. Performance manifests must state the observation profile and whether reported times exclude evaluator/capture work.

## MINOR findings

### M-01 — `target_types` duplicates criterion classes

**Issue:** Every gameplay test declares `target_types` and repeats the same information in `acceptance_logic[].class`. They are currently consistent but can drift.

**Recommended correction:** Derive target types from acceptance criteria during materialization, or require the validator to reject any mismatch. Prefer removing the redundant field in the next catalog version.

### M-02 — Scenario interventions need explicit exclusion semantics

**Issue:** Technical §19.1 permits tick-indexed direct state setup/teleport as a declared scenario event. It says this cannot masquerade as gameplay, but does not require observation windows, continuity invariants, or metrics to exclude setup/discontinuity ticks.

**Recommended correction:** Mark interventions with a typed `SETUP_DISCONTINUITY` event and require each metric/invariant to declare whether it excludes, resets at, or deliberately observes that event. Default continuity metrics to fail closed if an intervention occurs in their window.

### M-03 — Configurable visual ball scale lacks a truthfulness bound

**Issue:** Visual §18 includes a configurable ball visual-scale policy while §§3 and 11 require truthful size/contact presentation and prohibit effects that make the ball materially larger. No admissible relationship to canonical radius or camera scale is defined.

**Recommended correction:** Default rendered geometry to canonical diameter and record any accessibility enlargement as an explicit experimental effect. Define a validated maximum screen-space/physical scale deviation and require contact diagnostics to render the canonical collision silhouette alongside the visual ball.

### M-04 — Kit support is universal in wording but unbounded in scope

**Issue:** Visual §§7 and 11 require testing every supported kit matchup, pitch, lighting preset, and quality tier, while the project intends replaceable external team data. “Supported” is not defined, and arbitrary imported palettes create an unbounded combination space before the clash algorithm and fallback are validated.

**Recommended correction:** Version a finite visual-support matrix per release. Validate individual profiles at ingest, use a declared adversarial combinatorial suite for pairings, and reject or place unqualified external profiles into a documented accessibility fallback rather than implying exhaustive universal support.

## Recommended correction order

1. Define the three milestone/capability profiles and their promotion applicability rules (`B-02`, `B-05`, `I-09`).
2. Materialize the scenario, metric, invariant, observation, suite, and binding registries (`B-01`, `B-03`, `I-10`, `I-11`).
3. Establish independent evaluator oracles and validate them with the mutant suite before any automated promotion (`B-03`).
4. Add the deterministic presentation-session contract before relying on browser frame, camera, animation, or LOD evidence (`B-04`).
5. Resolve state/data ownership and embodiment boundaries before implementing control switching, team AI, headers, tackles, keepers, or production visual profiles (`I-01`–`I-05`).
6. Separate comparison conditions from artifact provenance and make the reference registry the sole target authority (`I-06`, `I-07`).
7. Stage the rule, performance, and visual experiments behind explicit prerequisites (`I-08`, `I-09`, `I-12`, `I-13`).

After these corrections, the existing specifications can serve as a coherent foundation: the research limitations remain honest, gameplay mechanisms remain replaceable, and the Gauntlet gains a path from descriptive test inventory to reproducible execution and defensible promotion.
