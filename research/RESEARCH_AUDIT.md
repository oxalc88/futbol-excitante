# Research Corpus Audit

**Audit date:** 2026-08-12

**Scope:** `VISION.md` and every pre-existing Markdown document under `research/`

**Implementation status:** No implementation performed. This document is an audit and decision record only.

## Executive conclusion

The corpus is sufficient to begin a narrow architecture-and-measurement foundation, but it is **not sufficient to implement or claim calibrated PES 2017-like gameplay**.

The strongest supported decisions are architectural: a renderer-independent, headless-capable simulation; fixed-step execution; explicit seeded randomness and stable ordering; kinematic players; an independent ball; simulation-authoritative contact/action events; normalized tick-indexed input; and staged, observable experiments.

The largest gap is that the corpus describes how to build a PES reference dataset but does not contain that dataset. There are no audited clips, accepted tracks, uncertainty results, measured target distributions, or populated behavioral envelopes. Many proposed mappings also require controlled PES capture with known inputs, assistance settings, tactics, and isolated player attributes. Until those exist, concrete acceleration curves, turning penalties, touch assistance, pass mappings, rating curves, tactical thresholds, and similar values would be design guesses rather than research-backed calibration.

The research also contains several conflicts caused by documents operating at different levels of maturity. In particular, `05-browser-architecture.md` prematurely commits to Rapier, workers, OffscreenCanvas, SharedArrayBuffer, and ECS, while `03-simulation-techniques.md` and `04-autonomous-evaluation.md` recommend keeping those choices replaceable or deferring them until profiling. The latter position is better supported and should govern implementation.

### Classification meaning

- `BLOCKER`: must be resolved before the affected implementation or fidelity claim can proceed. A blocker may be scoped to calibration rather than to all scaffolding.
- `IMPORTANT`: should be resolved during specification or an explicit prototype experiment; proceeding silently creates meaningful rework or invalid conclusions.
- `NON_BLOCKING`: can remain open without compromising the first vertical slice, provided the deferral is documented.

## Findings

### F-01 — The promised quantitative reference corpus does not exist yet

- **Relevant source documents:** `01-pes2027-behavior.md` (Reference Test Catalog); `02-reference-measurement.md` (minimum campaign and calibration deliverable); `03-simulation-techniques.md` (calibration targets); `04-autonomous-evaluation.md` (Reference Target Registry).
- **Issue:** `02-reference-measurement.md` is a measurement design, not a completed measurement campaign. The repository contains no source manifests, audited frame maps, pitch calibrations, tracks, event annotations, uncertainty estimates, measured distributions, or target-envelope registry. Later documents frequently speak as though those products already exist.
- **Implementation impact:** Architecture and uncalibrated prototypes can begin, but no gameplay parameter can honestly be described as matching a measured PES envelope. Gauntlet comparison and stopping criteria cannot operate as written.
- **Recommended resolution:** Treat the 54-event campaign in `02-reference-measurement.md` as required research work. Version and publish the first accepted dataset and machine-readable target registry before calibrating or making fidelity claims. Label all interim gameplay constants as provisional design values.
- **Classification:** `BLOCKER` for calibration and PES-fidelity claims; not a blocker for the headless foundation.

### F-02 — Controlled-capture evidence required for causal mappings is missing

- **Relevant source documents:** `01-pes2027-behavior.md`; `02-reference-measurement.md` (A/B/C/D classification and controlled-capture extension); `03-simulation-techniques.md`.
- **Issue:** Exact input onset, stick vector, sprint state, pass/shot power, assistance mode, first-touch intent, tactical settings, and isolated attribute effects cannot be recovered from public footage. The measurement report classifies many of the most implementation-sensitive tests as class C, yet no controlled capture plan has been executed.
- **Implementation impact:** Rating-to-physics mappings, input latency, turn-input transfer functions, on-ball penalties, pass assistance, touch intent, tactical-slider effects, and adaptive-AI thresholds remain unidentifiable.
- **Recommended resolution:** Acquire legal access to a pinned PES 2017 build and record input-instrumented trials with exact settings and repeatable geometry. Until then, keep these mappings configurable and exclude them from objective acceptance gates.
- **Classification:** `BLOCKER` (scoped to causal PES calibration; prototypes may proceed only with provisional mappings).

### F-03 — Reference platform, build, and source set are unresolved

- **Relevant source documents:** `01-pes2027-behavior.md` (version/platform warning); `02-reference-measurement.md` (source selection and metadata); `04-autonomous-evaluation.md` (provenance requirements).
- **Issue:** PES 2017 PC, PS4, demo, retail, version 1.00, patched builds, camera presets, game speeds, assistance modes, difficulty, and stamina conditions must not be mixed silently. The corpus has not selected an authoritative reference platform/build or an allowed stratification policy.
- **Implementation impact:** Measurements from different game conditions could be merged into misleadingly broad or contradictory envelopes. Held-out validation would not be meaningful.
- **Recommended resolution:** Choose one primary platform/build/settings profile for causal capture and define explicit strata for public footage. Reject or separately tag sources whose provenance is unknown.
- **Classification:** `BLOCKER` for constructing the reference dataset.

### F-04 — Claim-level source traceability is broken

- **Relevant source documents:** `01-pes2027-behavior.md`; `02-reference-measurement.md`; `03-simulation-techniques.md`; `04-autonomous-evaluation.md`; `05-browser-architecture.md`; `06-visual-direction.md`.
- **Issue:** Documents 01–04 contain unresolved `citeturn...` and `fileciteturn...` export markers. Their source lists explicitly state that URLs were recovered without remapping individual markers. Documents 05–06 provide only generic reference bullets, often without URLs. This prevents a reviewer from reliably linking many claims to the evidence that supposedly supports them.
- **Implementation impact:** Confidence labels and technology recommendations cannot be independently audited claim by claim. Time-sensitive claims about browser/framework capabilities are especially vulnerable.
- **Recommended resolution:** Replace every export marker with a stable footnote or direct URL and add access/version dates for mutable technical documentation. Distinguish primary evidence, secondary analysis, community claims, and project hypotheses in every document.
- **Classification:** `IMPORTANT`.

### F-05 — The MVP scope conflicts across documents

- **Relevant source documents:** `VISION.md` (one player + one ball + one controller + one goal, then 1v1); `03-simulation-techniques.md` (laboratory sequence); `04-autonomous-evaluation.md` (small isolated scenarios); `05-browser-architecture.md` (start at 4v4).
- **Issue:** The vision and the better-developed experimental research recommend a one-player laboratory first, while the browser architecture jumps to 4v4. “MVP” is also used variously for a gameplay slice, full architecture, and autonomous Gauntlet loop.
- **Implementation impact:** Teams could build incompatible scopes, prematurely introduce AI and coordination, or evaluate completion against different gates.
- **Recommended resolution:** Define three named milestones: (1) deterministic locomotion/ball laboratory, (2) playable 1v1 vertical slice, and (3) small-sided/team-shape prototype. Reserve “MVP” for one agreed milestone and list its explicit inclusions and exclusions.
- **Classification:** `IMPORTANT`.

### F-06 — Worker architecture is recommended both immediately and only after profiling

- **Relevant source documents:** `VISION.md` (plain browser architecture); `03-simulation-techniques.md` (Web Worker later after profiling); `04-autonomous-evaluation.md` (portable headless core first); `05-browser-architecture.md` (architect with workers/OffscreenCanvas now, while also saying single-thread initially).
- **Issue:** `05-browser-architecture.md` internally and externally conflicts on whether main-thread, one-worker, or two-worker execution is the starting point. It assumes worker rendering and low-latency shared-memory input before a measured bottleneck exists.
- **Implementation impact:** Premature workers add synchronization, serialization, build, debugging, browser-compatibility, and deployment-header costs. They may also obscure deterministic headless behavior.
- **Recommended resolution:** Implement the core as a synchronous, DOM-free `step()` API first. Use a main-thread presentation adapter for the earliest playable slice. Add a worker boundary only after profiling a representative 11v11 load; compare main thread, one simulation worker, and any renderer-worker option with the same scenario.
- **Classification:** `IMPORTANT`.

### F-07 — SharedArrayBuffer is treated as a design target without a deployment decision

- **Relevant source documents:** `05-browser-architecture.md`; `03-simulation-techniques.md`.
- **Issue:** The browser architecture recommends SharedArrayBuffer ring buffers, but acknowledges COOP/COEP cross-origin-isolation requirements and offers `postMessage` as fallback. No hosting, embed, third-party resource, or browser-support policy establishes that isolation is acceptable.
- **Implementation impact:** Committing state layout and input delivery to SAB can constrain deployment and complicate local development before its latency benefit is measured.
- **Recommended resolution:** Define a transport-neutral input/state boundary. Start with direct calls or transferable/structured messages as appropriate; benchmark SAB only after a worker is justified and deployment headers are proven viable.
- **Classification:** `IMPORTANT`.

### F-08 — Physics-engine choice directly conflicts

- **Relevant source documents:** `VISION.md` (custom players; Rapier or custom ball); `03-simulation-techniques.md` (custom ball favored, Rapier comparison if justified); `05-browser-architecture.md` (“Decide Now: Use Rapier”).
- **Issue:** The corpus does not contain the custom-versus-Rapier benchmark that `03-simulation-techniques.md` says should decide the question. Rapier is alternatively optional, replaceable, and mandatory.
- **Implementation impact:** Selecting Rapier now may couple gameplay semantics to a general solver and make empirical roll/spin/contact calibration harder; rejecting it without a benchmark could duplicate useful collision/CCD work.
- **Recommended resolution:** Decide now only that physics is behind an adapter and football semantics remain outside the solver. Run the Ball Laboratory with a minimal custom integrator first, then compare Rapier on determinism, ground-roll fitting, bounce/contact control, CCD, runtime, and Node/browser parity before adoption.
- **Classification:** `IMPORTANT`.

### F-09 — ECS adoption directly conflicts

- **Relevant source documents:** `03-simulation-techniques.md` (simple explicit/data-oriented state; avoid generic ECS until needed); `04-autonomous-evaluation.md` (serializable explicit state); `05-browser-architecture.md` (ECS/bitECS recommended and “Decide Now”).
- **Issue:** There is no demonstrated entity count, query complexity, profiling result, or multithreaded need that justifies a generic ECS library. Twenty-two players and one ball do not alone establish that requirement.
- **Implementation impact:** Early ECS adoption can hide invariants across systems, complicate serialization and deterministic ordering, and create migration cost if the chosen library does not suit replay or headless evaluation.
- **Recommended resolution:** Begin with explicit typed world state and stable entity IDs. Use data-oriented arrays only where their benefit is concrete. Revisit a generic ECS after representative rules/AI code exposes actual organizational or performance pressure.
- **Classification:** `IMPORTANT`.

### F-10 — Determinism is optional in the vision but an MVP requirement later

- **Relevant source documents:** `VISION.md` (perfect determinism not mandatory for first prototype); `03-simulation-techniques.md`; `04-autonomous-evaluation.md`; `05-browser-architecture.md`.
- **Issue:** Later research correctly depends on deterministic replay, state hashing, stable ordering, and headless comparison, effectively superseding the softer vision language. The corpus never explicitly records that supersession.
- **Implementation impact:** Treating determinism as polish would invalidate the proposed calibration and regression architecture and make it expensive to retrofit seeded randomness and stable ordering.
- **Recommended resolution:** Make deterministic behavior within one pinned runtime/toolchain an initial architecture requirement. Defer cross-engine/network bit identity. Require repeat-run state-hash tests from the first laboratory scenario.
- **Classification:** `IMPORTANT`.

### F-11 — Cross-platform determinism is overstated

- **Relevant source documents:** `05-browser-architecture.md` (Rapier/JS determinism claims and avoidance of `Math.sin`/`Math.cos`); `03-simulation-techniques.md` (browser floating point and Rapier); `04-autonomous-evaluation.md` (pin runtime/toolchain first).
- **Issue:** Fixed timestep and a deterministic solver are necessary but not sufficient for an unrestricted cross-browser guarantee. Transcendental functions, compiler/runtime versions, contact ordering, serialization, and application logic all affect reproducibility. `04-autonomous-evaluation.md` recommends the narrower, defensible boundary.
- **Implementation impact:** Replays or future lockstep could be designed around a guarantee the project has not proven.
- **Recommended resolution:** Define tiers: deterministic within a pinned runtime now; tested equivalence across supported browsers later; network lockstep only after a dedicated cross-platform determinism suite. Never infer the application guarantee solely from a library claim.
- **Classification:** `IMPORTANT`.

### F-12 — The exact simulation rate and substep policy remain TBD

- **Relevant source documents:** `VISION.md` (60 Hz example); `03-simulation-techniques.md` (exact fixed-step/substep policy unresolved); `05-browser-architecture.md` (60 Hz decision, elsewhere 60–120 Hz).
- **Issue:** Fixed stepping is well supported, but 60 Hz versus a higher rate and when to substep fast ball contacts have not been measured. The documents conflate choosing fixed-step architecture with choosing its numerical value.
- **Implementation impact:** Contact tunneling, input latency, ball flight, computational load, and calibration curves depend on the policy.
- **Recommended resolution:** Make the rate a versioned engine configuration during laboratories. Benchmark 60 Hz plus targeted ball/contact substeps against 120 Hz using CCD/contact accuracy, deterministic stability, and representative 11v11 cost. Freeze it before reference calibration.
- **Classification:** `IMPORTANT`.

### F-13 — Headless execution is inconsistently described as timer-driven

- **Relevant source documents:** `04-autonomous-evaluation.md` (tight faster-than-real-time fixed-tick loop); `05-browser-architecture.md` (`setInterval`/timer example).
- **Issue:** A scientific headless runner should advance an explicit tick count without wall-clock scheduling. Timer-driven Node execution introduces jitter and unnecessary real-time pacing.
- **Implementation impact:** Batch evaluation becomes slower and less reproducible; timer behavior could be mistaken for simulation behavior.
- **Recommended resolution:** Define headless execution as a synchronous or controlled batch loop over `world.step(fixedDt)`. Use timers only in real-time adapters, never as the authoritative evaluator clock.
- **Classification:** `IMPORTANT`.

### F-14 — Renderer choice is unresolved despite conflicting “decide now” language

- **Relevant source documents:** `VISION.md` (initial Three.js recommendation, Babylon alternative); `05-browser-architecture.md` (both feasible); `06-visual-direction.md` (rendering stack should be decided early).
- **Issue:** No comparative prototype or project-specific criterion selects Three.js or Babylon.js. Visual direction requires capabilities, not a particular library.
- **Implementation impact:** A premature choice may optimize for unused built-in features, while delaying any renderer boundary would block the first playable presentation.
- **Recommended resolution:** Decide the renderer interface and simulation separation now. Use a time-boxed spike with one skinned player, ball, broadcast camera, toon bands, optional outline, and representative LOD in both candidates only if the team lacks a strong prior. Otherwise accept the vision's Three.js default as provisional, not as an irreversible engine decision.
- **Classification:** `IMPORTANT`.

### F-15 — The visual document both locks and defers the shading model

- **Relevant source documents:** `06-visual-direction.md`; `05-browser-architecture.md`.
- **Issue:** `06-visual-direction.md` says the shading model must be locked early and recommends stylized PBR with simple outlines, but also says exact shaders and outline use require prototype tests and should be deferred. “Stylized PBR,” cel bands, hybrid NPR, and outline-on/off remain different pipelines.
- **Implementation impact:** Art authoring assumptions, normals/textures, LODs, outline geometry, and performance budgets can diverge.
- **Recommended resolution:** Lock only the art principles now: non-photorealistic, limited palette, readable silhouettes, restrained texture noise, and ball/team contrast. Run a representative shader/outline spike before locking material authoring rules. Defer the exact shader implementation until that evidence exists.
- **Classification:** `IMPORTANT`.

### F-16 — No target hardware, browser matrix, or performance budgets exist

- **Relevant source documents:** `05-browser-architecture.md` (workers, 22 rigs, WebGL2/WebGPU, profiling); `06-visual-direction.md` (LOD/shader performance open question); `VISION.md` (browser target).
- **Issue:** Claims such as “22 rigs at 60 fps is manageable,” multi-LOD being essential, or worker rendering being worthwhile lack a minimum device, browser/version, resolution, quality level, memory budget, frame-time budget, and thermal/power context.
- **Implementation impact:** Architecture and art decisions cannot be validated; optimizations may target the wrong bottleneck.
- **Recommended resolution:** Define a small support matrix and budgets for simulation tick p95, render frame p95, input-to-intent latency, memory, loading time, and quality tiers. Include at least one representative low/mid target device before performance-driven commitments.
- **Classification:** `IMPORTANT`.

### F-17 — Player-count assumptions contain an error

- **Relevant source documents:** `VISION.md` (22 players total); `05-browser-architecture.md` (“22×2 players”).
- **Issue:** The browser architecture's scale-up section implies 44 players, while regulation 11v11 and the rest of the corpus require 22 total.
- **Implementation impact:** It can distort performance estimates and acceptance scenarios.
- **Recommended resolution:** Correct all capacity language to 22 active players plus ball, officials, and any explicitly budgeted non-player entities. Test stress cases separately rather than embedding an accidental 44-player requirement.
- **Classification:** `NON_BLOCKING`.

### F-18 — Possession is both an explicit state and an emergent relationship

- **Relevant source documents:** `VISION.md` (possession in gameplay/state); `01-pes2027-behavior.md` (possession as emergent interaction capacity, no permanent parenting); `04-autonomous-evaluation.md` (possession/control telemetry and invariants).
- **Issue:** The documents do not distinguish rule/statistical possession, last-touch attribution, control eligibility, and physical attachment. This can be misread as either never tracking possession or owning/parenting the ball.
- **Implementation impact:** Passing, tackles, AI, rules, statistics, and replay events may couple to an ambiguous boolean.
- **Recommended resolution:** Keep the ball physically independent. Model separate derived facts/events such as `lastTouch`, `controlCandidate`, `controlledTouchWindow`, and team possession for tactics/statistics. Prohibit possession state from directly teleporting or parenting the ball.
- **Classification:** `IMPORTANT`.

### F-19 — Animation/contact authority is not consistently resolved

- **Relevant source documents:** `VISION.md` (animation/contact point contributes to touch); `01-pes2027-behavior.md`; `03-simulation-techniques.md` (simulation authoritative, animation follows); `06-visual-direction.md` (longer/more frames for kicks and stylized telegraphing).
- **Issue:** Contact timing and geometry could be interpreted as animation-driven, while the implementation research requires canonical simulation not to inherit root motion or opaque animation timing. Visual exaggeration could otherwise change gameplay.
- **Implementation impact:** The renderer may become a hidden gameplay dependency, breaking headless parity and deterministic replay.
- **Recommended resolution:** Simulation schedules and resolves canonical contact events and outgoing ball state. Animation receives those events and may use visual offsets/IK within bounded tolerances. Any animation-informed contact window must be represented as simulation data and tested headlessly.
- **Classification:** `IMPORTANT`.

### F-20 — Coordinate, unit, pitch, and state conventions are not specified

- **Relevant source documents:** `VISION.md`; `02-reference-measurement.md` (no universal 105×68 pitch); `03-simulation-techniques.md`; `04-autonomous-evaluation.md`.
- **Issue:** The corpus does not freeze axis orientation, origin, handedness, SI units, angle convention, player ground plane, ball vertical axis, boundary semantics, serialization precision, or configurable pitch dimensions.
- **Implementation impact:** Metrics, renderer conversion, camera calibration, rules, mirrored scenarios, and replay schemas can disagree at foundational boundaries.
- **Recommended resolution:** Create a pre-code simulation conventions ADR/spec: SI units; explicit axes/handedness; configurable pitch template; ball 3D/player locomotion primarily planar; angle normalization; stable IDs; state serialization and versioning.
- **Classification:** `IMPORTANT`.

### F-21 — Attribute mapping is unsupported and the neutral profile is incomplete as a contract

- **Relevant source documents:** `VISION.md` (illustrative `PlayerProfile` and external sources); `01-pes2027-behavior.md` (attributes observed, formulas unknown); `02-reference-measurement.md` (attribute comparisons class C); `03-simulation-techniques.md`.
- **Issue:** The existence of PES ratings supports separating concepts such as Speed, Explosive Power, Body Control, and Physical Contact, but it does not support any numerical mapping. The profile omits explicit scale/version/null semantics and several later-required dimensions.
- **Implementation impact:** Direct `rating -> m/s` or linear mappings would be invented, hard to replace, and potentially entangled with one data provider.
- **Recommended resolution:** Define an internal capability model separately from external ratings. Use adapters and versioned normalization curves. Populate early prototypes with named archetype parameters, not claims about PES rating formulas. Calibrate provider mappings only after controlled trials and legal data decisions.
- **Classification:** `BLOCKER` (scoped to real-player/PES-rating fidelity; the internal data contract should still be defined now).

### F-22 — Data-source legality and redistribution remain unresolved

- **Relevant source documents:** `VISION.md` (PES Master/PESDB/eFootball DB/PESHUB and legal pending item); `01-pes2027-behavior.md` (historical dataset caveats).
- **Issue:** Availability on a website does not establish permission to scrape, cache, transform, or redistribute player data, likenesses, clubs, logos, or tactical data. No provider terms or licensing analysis is present.
- **Implementation impact:** Building adapters is safe; ingesting or shipping a dataset may create legal and operational rework.
- **Recommended resolution:** Use fictional or hand-authored archetypes for prototypes. Defer automated ingestion and branded content until terms, licensing, attribution, update policy, and deletion obligations are documented.
- **Classification:** `IMPORTANT` (scoped to external data ingestion; fictional prototype data is unaffected).

### F-23 — Ball-model equations and parameters remain experimental

- **Relevant source documents:** `01-pes2027-behavior.md`; `02-reference-measurement.md`; `03-simulation-techniques.md`.
- **Issue:** Ground roll may be constant, velocity-proportional, piecewise, or empirical; bounce coefficients are unknown; airborne reconstruction is weak from monocular footage; Magnus-like force is a plausible design prior, not evidence of PES internals. No target values have been measured.
- **Implementation impact:** A detailed “realistic” ball implementation could be wrong for the desired feel and create false precision.
- **Recommended resolution:** Implement only a replaceable parameterized ball model in the Ball Laboratory. Fit ground roll first because it is most observable. Keep bounce, drag, spin decay, and curve independently toggleable and versioned. Do not freeze aerial parameters until controlled or sufficiently calibrated evidence exists.
- **Classification:** `BLOCKER` (scoped to calibrated ball behavior; a replaceable laboratory model may proceed).

### F-24 — Invisible ball assistance and control capture are unresolved

- **Relevant source documents:** `01-pes2027-behavior.md` (open question about attraction/interception help); `02-reference-measurement.md`; `03-simulation-techniques.md` (contact-event model).
- **Issue:** An independent ball does not decide how generous foot reach, touch scheduling, interception capture, or input assistance should be. Public video cannot reveal all hidden assistance.
- **Implementation impact:** Too little assistance makes controls brittle; too much recreates ball attachment and invalidates the central design principle.
- **Recommended resolution:** Expose assistance as explicit, inspectable reach/time/contact policies with hard no-teleport invariants. Run controlled sweeps and perceptual playtests; do not bury assistance inside collision radii or animation code.
- **Classification:** `IMPORTANT`.

### F-25 — AI technique direction is supported, but target behavior is not measured

- **Relevant source documents:** `VISION.md` (simple explainable AI); `01-pes2027-behavior.md` (team/tactical tests); `02-reference-measurement.md` (many tactic tests class C); `03-simulation-techniques.md` (formation/utility/reach-time recommendation); `04-autonomous-evaluation.md`.
- **Issue:** Formation anchors, utility scoring, soft steering, role assignment, reach-time passing, coordinated pressing, and explicit transition phases are defensible implementation techniques. However, no measured PES distributions exist for line height, compactness, support distance, press latency, recovery, or tactical slider effects.
- **Implementation impact:** AI architecture can start later in the sequence, but its weights and thresholds cannot be described as calibrated.
- **Recommended resolution:** Accept the formation-first/utility-based decomposition now. Delay parameter tuning until locomotion/ball reach times are stable and team-shape measurements exist. Use observable team geometry and transitions, not a single “AI quality” score.
- **Classification:** `IMPORTANT`.

### F-26 — Goalkeepers, rules, fouls, and restarts are under-researched relative to the vision

- **Relevant source documents:** `VISION.md` (minimum gameplay list); `01-pes2027-behavior.md` (keeper/tackle observations); `03-simulation-techniques.md`; `04-autonomous-evaluation.md` (scenario names).
- **Issue:** The corpus has behavioral observations and proposed keeper tests, but no comparable implementation analysis for keeper decision architecture, offside snapshots, advantage, foul adjudication, restart placement, referee state, match clock, or rule edge cases.
- **Implementation impact:** A “full match” implementation would require substantial unresearched design and could contaminate the first movement/ball slice.
- **Recommended resolution:** Explicitly exclude full rules and deep keepers from the first two milestones. Before full-match work, create rule and goalkeeper specifications with deterministic event ordering and test cases.
- **Classification:** `IMPORTANT` (scoped to full-match implementation; the laboratories are unaffected).

### F-27 — Input abstraction is supported, but sampling semantics and device policy are TBD

- **Relevant source documents:** `VISION.md`; `04-autonomous-evaluation.md` (normalized `InputFrame` and replay); `05-browser-architecture.md` (Gamepad/SAB input).
- **Issue:** The corpus supports one normalized input representation, but does not decide dead zones, response curves, button mapping, hot-plug/disconnect, simultaneous keyboard/gamepad ownership, sampling relative to ticks, buffering, edge-trigger rules, or browser `standard` mapping fallbacks.
- **Implementation impact:** Input latency and replay determinism can diverge between physical devices and test input.
- **Recommended resolution:** Decide now that all sources produce tick-indexed normalized `InputFrame`s and that replay/test injection is authoritative. Specify device normalization and sample-to-tick rules before gamepad gameplay; defer brand-specific UX mappings to adapter tests.
- **Classification:** `IMPORTANT`.

### F-28 — Multiplayer recommendations are not a resolved production design

- **Relevant source documents:** `VISION.md` (WebRTC host, server, Durable Objects phases and provisional rates); `05-browser-architecture.md` (defer full networking; lockstep-friendly simulation).
- **Issue:** Host-authoritative WebRTC, peer lockstep, authoritative server snapshots, Colyseus, and Durable Objects have different cheat, NAT/TURN, determinism, migration, reconciliation, and cost profiles. No network experiments or cost measurements have been run.
- **Implementation impact:** Choosing a production topology now would be speculative. Designing solely for lockstep could over-constrain the engine.
- **Recommended resolution:** Defer production multiplayer. Preserve normalized input, snapshots, state hashes, and deterministic replay because they help offline testing independently. Later run latency, loss, NAT/TURN, bandwidth, divergence, and operating-cost experiments before choosing authority.
- **Classification:** `BLOCKER` (scoped to online implementation; local development is unaffected).

### F-29 — Replay compactness is assumed before determinism is proven

- **Relevant source documents:** `VISION.md` (initial state + seed + inputs); `04-autonomous-evaluation.md`; `05-browser-architecture.md`.
- **Issue:** Input-only replay works only after deterministic reconstruction is demonstrated across the supported environment/version. The example byte sizes in the vision are illustrative, not measured.
- **Implementation impact:** A replay format could omit recovery information and become fragile across engine versions.
- **Recommended resolution:** Record input, seed, config/version hashes, and periodic state hashes from the start. Add optional snapshots/checkpoints until reconstruction and migration policy are proven. Treat bandwidth/storage numbers as TBD measurements.
- **Classification:** `IMPORTANT`.

### F-30 — Gauntlet assumes populated reference targets and contains a class mismatch

- **Relevant source documents:** `02-reference-measurement.md`; `04-autonomous-evaluation.md`.
- **Issue:** The example Reference Target Registry marks `LOC-ACC-001.t90` with identifiability `A`, while `02-reference-measurement.md` classifies `LOC-ACC-001` as `B` because exact input onset is unknown. More broadly, Gauntlet's promotion/stopping rules assume target distributions that have not been produced.
- **Implementation impact:** An evaluator could give an uncertain target excessive authority and reject or promote candidates on invalid evidence.
- **Recommended resolution:** Correct the example to class B and make observability class plus causal status mandatory fields inherited from the canonical dataset, not manually re-entered. Gauntlet must refuse objective acceptance for absent/class-C targets and route class D to perceptual review.
- **Classification:** `BLOCKER` for reference-driven Gauntlet promotion.

### F-31 — Full autonomous-agent infrastructure is premature relative to gameplay-first sequencing

- **Relevant source documents:** `VISION.md` (prove movement/ball first); `03-simulation-techniques.md`; `04-autonomous-evaluation.md` (extensive OpenCode/Pi topology, worktrees, promotion, multimodal critics, and later build order).
- **Issue:** `04-autonomous-evaluation.md` ultimately gives a sensible incremental build order, but much of the document can be read as a near-term commitment to six roles and a full autonomous promotion system. No engine, target registry, or minimal evaluator exists yet.
- **Implementation impact:** The project could spend substantial effort automating an evaluation process that has no evidence or behaviors to evaluate.
- **Recommended resolution:** Implement only the evaluator-enabling contracts now: headless stepping, scenarios, telemetry, metrics, deterministic replay, and immutable test data. Defer OpenCode/Pi choice, multi-agent roles, vision critics, branching, and autonomous promotion until one human-operated scenario lifecycle works end to end.
- **Classification:** `IMPORTANT`.

### F-32 — OpenCode versus Pi remains conditional, not decided

- **Relevant source documents:** `04-autonomous-evaluation.md`.
- **Issue:** The document recommends OpenCode for rapid setup and Pi for programmable orchestration. It does not establish the project's preferred operational model, security boundary, provider, model budget, or maintenance appetite. The claims are also time-sensitive and affected by the broken citation mapping.
- **Implementation impact:** Premature host-specific integration creates churn while the evaluator interface is still evolving.
- **Recommended resolution:** Keep a stable agent-agnostic CLI/JSON evaluator as the only current decision. Re-evaluate host/tooling against current official documentation after the minimum viable Gauntlet works manually.
- **Classification:** `NON_BLOCKING`.

### F-33 — Evaluation thresholds and practical-improvement criteria are all TBD

- **Relevant source documents:** `02-reference-measurement.md`; `04-autonomous-evaluation.md`; `06-visual-direction.md`.
- **Issue:** The corpus proposes uncertainty-aware gaps, hard gates, quantiles, visual rubrics, stagnation thresholds, and stop conditions, but supplies no numeric acceptance thresholds, family weights, material-regression tolerances, or human-review policy.
- **Implementation impact:** “Best,” “improved,” and “done” are not operational; an autonomous loop could optimize arbitrary defaults.
- **Recommended resolution:** Derive thresholds only after measurement repeatability and baseline variance are known. Version all policies, test them with deliberately broken mutants, and require human approval before autonomous promotion is enabled.
- **Classification:** `BLOCKER` (scoped to autonomous promotion; metric collection is unaffected).

### F-34 — Visual role silhouettes are an unsupported gameplay assumption

- **Relevant source documents:** `06-visual-direction.md`; `VISION.md` (individuality from attributes and replaceable data).
- **Issue:** Making defenders blocky, midfielders round, and forwards angular is a stylistic hypothesis, not a researched football-readability requirement. It may conflate tactical role with body type and could conflict with real/fictional player individuality or data replaceability.
- **Implementation impact:** Art archetypes may visually misstate player capabilities or pressure gameplay code to alter colliders/mass by position.
- **Recommended resolution:** Test whether team, controlled-player, action, and ball readability matter more than recognizing nominal position from silhouette. Keep visual body shape separate from physics unless the player profile explicitly supplies physical dimensions.
- **Classification:** `NON_BLOCKING`.

### F-35 — Fixed team palettes conflict with arbitrary team data

- **Relevant source documents:** `VISION.md` (replaceable external teams); `06-visual-direction.md` (settle team themes upfront; no shared hue/brightness; example fixed pairs).
- **Issue:** The engine must support arbitrary team identities and clashes, so one pair of settled colors cannot be a global solution. “No two teams share a hue or brightness” is not realistic for imported kits.
- **Implementation impact:** Readability may fail for actual matchups, color-vision deficiencies, goalkeeper/referee kits, or dynamically loaded teams.
- **Recommended resolution:** Decide a kit-clash and accessibility algorithm, alternate-kit metadata, and controlled-player indicators rather than fixed teams. Measure contrast in representative rendered scenes and color-vision simulations.
- **Classification:** `IMPORTANT` for the visual/data contract.

### F-36 — Visual evaluation proposals are not yet valid metrics

- **Relevant source documents:** `06-visual-direction.md`; `04-autonomous-evaluation.md`.
- **Issue:** Pixel overlap does not by itself measure silhouette recognition; a “visual clutter score” based on texture noise is undefined; no Delta-E threshold, viewing distance, resolution, display assumptions, color space, observer protocol, or success criterion is specified.
- **Implementation impact:** Art could be optimized to proxy metrics that do not reflect actual readability.
- **Recommended resolution:** Define task-based tests: ball acquisition time, team classification, controlled-player localization, and action recognition at fixed camera/resolution scales. Use image metrics as diagnostics and validate them against human results before making them gates.
- **Classification:** `IMPORTANT`.

### F-37 — Camera behavior is a major unresolved dependency

- **Relevant source documents:** `01-pes2027-behavior.md` (camera tests); `02-reference-measurement.md`; `04-autonomous-evaluation.md`; `06-visual-direction.md` (dynamic versus fixed open question).
- **Issue:** Camera preset, height, pitch, FOV, zoom, smoothing, target framing, transitions, and replay behavior alter perceived speed, spatial awareness, silhouette size, LOD, and visual comparisons. No default gameplay camera has been selected or measured.
- **Implementation impact:** Movement can be calibrated physically while still feeling wrong, and art/performance tests can use non-representative screen sizes.
- **Recommended resolution:** Create an early camera laboratory and select one provisional fixed gameplay preset for calibration/presentation tests. Measure PES camera behavior separately; defer dynamic/replay cameras until the base preset is stable.
- **Classification:** `IMPORTANT`.

### F-38 — Asset, LOD, rig, and shader budgets remain TBD

- **Relevant source documents:** `05-browser-architecture.md`; `06-visual-direction.md`.
- **Issue:** Multi-LOD, 512×512 textures, common rigs, GPU skinning, automated LOD, outline thickness, shadow strategy, and polygon levels are recommendations without representative assets or target-device measurements.
- **Implementation impact:** An asset pipeline could be locked around arbitrary numbers and later require re-authoring.
- **Recommended resolution:** Build one representative character/kit/animation/ball asset and measure it at the provisional camera across the target device matrix. Derive budgets from the scene, not generic web-game guidance.
- **Classification:** `IMPORTANT` (scoped to production art; primitive prototype visuals are unaffected).

### F-39 — Ball visibility effects may distort the behavior being evaluated

- **Relevant source documents:** `06-visual-direction.md` (glow, outline, motion trail, spotlight); `VISION.md` and `04-autonomous-evaluation.md` (renderer must only present state; perceptual evaluation).
- **Issue:** A trail, afterimage, glow, or airborne spotlight can improve tracking but also change perceived speed, curve, height, or contact timing. The visual document presents several effects before testing whether ordinary contrast is sufficient.
- **Implementation impact:** Players and visual critics may attribute presentation artifacts to physics, undermining calibration.
- **Recommended resolution:** Start with size-appropriate high-contrast ball shading and a grounded shadow. Test optional cues independently and ensure they derive solely from simulation state. Keep physics evaluation state-based and compare presentation with effects on/off.
- **Classification:** `NON_BLOCKING`.

### F-40 — Visual originality and trademark guidance is unsupported

- **Relevant source documents:** `06-visual-direction.md`.
- **Issue:** The document proposes “trademarking” a visual twist without legal analysis and cites inspiration from multiple commercial games through generic, unmapped references. Original assets are a sound goal, but trademarkability and freedom to operate are legal questions, not established art-pipeline facts.
- **Implementation impact:** This could create false confidence or distract from documenting original design decisions and licenses.
- **Recommended resolution:** Keep an originality/source log and use original assets. Defer trademark or other IP action to qualified legal review once a distinctive identity exists.
- **Classification:** `NON_BLOCKING`.

### F-41 — Repository layouts are illustrative but mutually inconsistent

- **Relevant source documents:** `VISION.md` (`packages/engine`, `renderer-three`, etc.); `04-autonomous-evaluation.md` (`src/sim`, `eval`, `artifacts`); `05-browser-architecture.md` (`game-core`, `game-app`, workers).
- **Issue:** Three different directory/package structures are proposed without a decision criterion. They agree on boundaries but not physical layout.
- **Implementation impact:** Treating any diagram as normative could trigger avoidable moves and package overhead.
- **Recommended resolution:** Decide logical dependency rules now—simulation cannot import browser/rendering; adapters depend inward; evaluator imports simulation. Choose the smallest physical layout that enforces those rules and defer monorepo/package splitting until multiple independently built consumers require it.
- **Classification:** `NON_BLOCKING`.

### F-42 — Several document defects weaken corpus clarity

- **Relevant source documents:** `01-pes2027-behavior.md`; `02-reference-measurement.md`; `03-simulation-techniques.md`.
- **Issue:** The filename `01-pes2027-behavior.md` says 2027 although the subject is PES 2017; `02-reference-measurement.md` refers to a non-existent `PES2017_GAMEPLAY_REFERENCE.md`; `03-simulation-techniques.md` contains malformed Markdown equation headings around its AI section.
- **Implementation impact:** References and automated documentation tooling may misidentify documents; readers can mistake formatting artifacts for missing sections.
- **Recommended resolution:** Correct filenames/references through an explicit documentation-only change, preserving redirect/history as needed, and repair Markdown structure.
- **Classification:** `NON_BLOCKING`.

## Finding dispositions

Disposition is independent of severity. In particular, a `BLOCKER` may block only a later calibration, online, or autonomous-promotion milestone; it does not automatically block the Technical Spec or bootstrap.

| Finding ID | Severity | Disposition | Reasoning | Decision, if resolved | Experiment, if required | Milestone for reconsideration, if deferred | Exact research question, if new research is required |
|---|---|---|---|---|---|---|---|
| F-01 | `BLOCKER` | `EXPERIMENT_REQUIRED` | The corpus already defines the evidence pipeline and minimum campaign; the missing item is execution and measurement, not another literature review. | — | Execute the 54-event campaign, including audited timing, camera calibration, tracks, uncertainty, held-out sources, and a versioned target registry. | — | — |
| F-02 | `BLOCKER` | `EXPERIMENT_REQUIRED` | Public footage cannot identify causal input and attribute mappings, while the existing research specifies exactly what controlled evidence is needed. | — | Capture repeatable PES trials with logged input timing/vectors, assistance settings, power input, tactics, and isolated player/context changes. | — | — |
| F-03 | `BLOCKER` | `DEFERRED` | A primary PES platform/build is required for the reference campaign, but it does not affect the engine Technical Spec or bootstrap while constants remain provisional. | — | — | Before admitting the first source to the quantitative reference dataset. | — |
| F-04 | `IMPORTANT` | `DEFERRED` | Broken claim-level citations reduce auditability but do not prevent the convergent architecture decisions needed for the bootstrap. No external claim should become a hard acceptance criterion until repaired. | — | — | Before publishing the corpus or promoting externally sourced claims into normative acceptance criteria. | — |
| F-05 | `IMPORTANT` | `RESOLVED_FROM_EXISTING_RESEARCH` | The vision, implementation research, measurement plan, and Gauntlet build order consistently favor isolated laboratories over 4v4. | Use three named milestones: deterministic locomotion/ball laboratory; playable 1v1 vertical slice; small-sided/team-shape prototype. Do not use “MVP” without naming which milestone it means. | — | — | — |
| F-06 | `IMPORTANT` | `RESOLVED_FROM_EXISTING_RESEARCH` | The later, more calibration-aware research explicitly says workers follow profiling, and a synchronous core is compatible with every later execution topology. | Bootstrap a synchronous DOM-free `step()` simulation with a simple presentation adapter. Do not introduce simulation/render workers until profiling justifies them. | — | — | — |
| F-07 | `IMPORTANT` | `DEFERRED` | Shared memory matters only after a worker boundary exists, and it has deployment consequences irrelevant to the current synchronous bootstrap. | — | — | After a worker benchmark demonstrates message transport is a material bottleneck and the hosting model can provide COOP/COEP. | — |
| F-08 | `IMPORTANT` | `EXPERIMENT_REQUIRED` | Existing research supports a custom MVP ball and replaceable solver boundary but intentionally leaves final custom-versus-Rapier adoption to comparison. | — | Run identical Ball Laboratory cases through the minimal custom integrator and Rapier; compare fitting control, CCD/contact behavior, determinism, Node/browser parity, and p95 cost. | — | — |
| F-09 | `IMPORTANT` | `RESOLVED_FROM_EXISTING_RESEARCH` | The strongest implementation and evaluation documents explicitly recommend simple inspectable state and say a generic ECS is unnecessary for the MVP. | Use explicit typed world state, stable entity IDs, and deterministic systems. Do not adopt bitECS or another generic ECS in the bootstrap. | — | — | — |
| F-10 | `IMPORTANT` | `RESOLVED_FROM_EXISTING_RESEARCH` | Headless calibration and replay make local determinism foundational rather than optional polish. | Require same-build, same-runtime, same-seed, same-input state-hash equality from the first laboratory scenario. | — | — | — |
| F-11 | `IMPORTANT` | `RESOLVED_FROM_EXISTING_RESEARCH` | `03-simulation-techniques.md` and `04-autonomous-evaluation.md` already define a defensible tiered guarantee. | Guarantee pinned-runtime reproducibility now; test bounded cross-browser equivalence later; require a separate proof before bit-exact network lockstep. | — | — | — |
| F-12 | `IMPORTANT` | `EXPERIMENT_REQUIRED` | Fixed stepping is decided, but tick rate and substeps affect contacts, latency, and cost and are explicitly left open by the implementation research. | — | Compare 60 Hz plus targeted ball/contact substeps with 120 Hz using CCD misses, trajectory/contact error, hash stability, latency, and representative 11v11 p95 tick cost. | — | — |
| F-13 | `IMPORTANT` | `RESOLVED_FROM_EXISTING_RESEARCH` | The Gauntlet research clearly distinguishes faster-than-real-time fixed-tick evaluation from real-time adapters. | Headless execution advances an explicit tick count in a synchronous/controlled loop. Timers are allowed only in real-time adapters. | — | — | — |
| F-14 | `IMPORTANT` | `RESOLVED_FROM_EXISTING_RESEARCH` | The vision provides a reasonable initial default, both candidates are feasible, and renderer replaceability prevents the choice from owning gameplay architecture. | Use Three.js provisionally for the first presentation adapter. Keep the simulation renderer-agnostic and revisit only if a concrete Babylon.js capability becomes necessary. | — | — | — |
| F-15 | `IMPORTANT` | `EXPERIMENT_REQUIRED` | The art principles are settled, but the corpus itself says shader bands and outlines need a representative prototype and performance evidence. | — | Render one representative skinned player/kit/ball scene with minimal PBR, cel bands, and outlines on/off at gameplay camera distances; compare readability, asset requirements, and target-device cost. | — | — |
| F-16 | `IMPORTANT` | `DEFERRED` | A production support matrix is absent, but no current decision requires workers, high-detail assets, or a fixed renderer budget. The bootstrap can remain conservative and instrumented. | — | — | Before the representative 11v11 performance milestone and before production art budgets are frozen. | — |
| F-17 | `NON_BLOCKING` | `RESOLVED_FROM_EXISTING_RESEARCH` | The vision and project goal unambiguously specify 11v11. The 44-player phrase is a document error. | Capacity target is 22 active footballers plus one ball; officials and stress-test entities receive separate explicit budgets. | — | — | — |
| F-18 | `IMPORTANT` | `RESOLVED_FROM_EXISTING_RESEARCH` | The behavior and evaluation research consistently support an independent ball plus explicit control/possession telemetry. | Keep ball physics independent. Represent `lastTouch`, control eligibility/window, and tactical/statistical team possession separately; none may parent or teleport the ball. | — | — | — |
| F-19 | `IMPORTANT` | `RESOLVED_FROM_EXISTING_RESEARCH` | The simulation-techniques research explicitly makes simulation authoritative and animation presentational. | Simulation schedules and resolves canonical contacts/actions. Animation consumes them and may add bounded visual correction without feeding hidden state back into gameplay. | — | — | — |
| F-20 | `IMPORTANT` | `RESOLVED_FROM_EXISTING_RESEARCH` | The measurement and implementation documents already require metric pitch-space state, configurable pitch geometry, planar player motion, 3D ball state, stable IDs, and serialization. | Use SI units; center-spot origin; `x` along pitch length, `y` across width, `z` up; configurable pitch dimensions; planar canonical player position; 3D ball position; normalized angles; stable IDs; versioned serial state. | — | — | — |
| F-21 | `BLOCKER` | `EXPERIMENT_REQUIRED` | Existing evidence supports separate capability dimensions but explicitly rejects an unmeasured numerical mapping from PES/provider ratings. | — | After the internal capability model exists, run controlled matched-player/attribute trials and fit versioned provider-to-capability curves with held-out validation. | — | — |
| F-22 | `IMPORTANT` | `DEFERRED` | External roster ingestion is unnecessary for the engine bootstrap because the corpus already supports fictional hand-authored archetypes. | — | — | Before any automated scraping, bulk storage, branded content, or redistribution of an external dataset. | — |
| F-23 | `BLOCKER` | `EXPERIMENT_REQUIRED` | The corpus defines candidate ball-model families and observables but intentionally supplies no measured coefficients. | — | Fit ground-roll families first, then test bounce, drag, spin decay, and Magnus-like curve independently against accepted reference events and laboratory invariants. | — | — |
| F-24 | `IMPORTANT` | `EXPERIMENT_REQUIRED` | Invisible assistance is a gameplay-policy question that public video cannot uniquely reveal; explicit controlled sweeps and playtests are more informative than more desk research. | — | Sweep reach radius/time, touch scheduling, interception eligibility, and correction limits in the Touch Laboratory; enforce no-teleport invariants and compare controllability plus perceptual results. | — | — |
| F-25 | `IMPORTANT` | `RESOLVED_FROM_EXISTING_RESEARCH` | Multiple documents converge on explainable formation-first, role-first, utility/reachability-based AI and defer only its calibration. | Adopt formation anchors/deformation, role utilities, soft steering, reach-time space evaluation, coordinated pressing assignments, and explicit transition phases after locomotion/ball stabilize. Keep weights provisional until measured. | — | — | — |
| F-26 | `IMPORTANT` | `DEFERRED` | Full rules and deep goalkeepers are outside the first two agreed milestones and therefore do not affect the current Technical Spec/bootstrap. | — | — | Before the full-match milestone, when separate goalkeeper and deterministic match-rules specifications must be completed. | — |
| F-27 | `IMPORTANT` | `RESOLVED_FROM_EXISTING_RESEARCH` | The Gauntlet and browser research agree that all physical, AI, replay, test, and future remote sources must share one internal command representation. | Define a tick-indexed normalized `InputFrame`; replay/test injection uses the same path as devices. Device adapters own dead zones, mappings, hot-plug, and sampling-to-tick normalization. | — | — | — |
| F-28 | `BLOCKER` | `DEFERRED` | Multiplayer is explicitly later in the vision and browser research; its unresolved authority model does not affect local laboratories or the current Technical Spec. | — | — | Before the online prototype milestone, after local deterministic replay/snapshots exist and network experiments can be run. | — |
| F-29 | `IMPORTANT` | `RESOLVED_FROM_EXISTING_RESEARCH` | The corpus contains enough evidence to avoid relying prematurely on input-only replay while preserving its future efficiency. | Record initial/config/version hashes, seed, tick-indexed inputs, periodic state hashes, and optional checkpoints. Remove checkpoints only when deterministic reconstruction and migration policy are proven. | — | — | — |
| F-30 | `BLOCKER` | `RESOLVED_FROM_EXISTING_RESEARCH` | The measurement document directly establishes the correct classification and the evaluator already defines how absent/C/D targets should be treated. | Classify `LOC-ACC-001` as B. Inherit observability and causal status from the canonical registry; absent and class-C targets cannot drive objective promotion, while class D uses perceptual review. | — | — | — |
| F-31 | `IMPORTANT` | `RESOLVED_FROM_EXISTING_RESEARCH` | The Gauntlet document's own build order says deterministic foundations and a human-operated scenario lifecycle precede agent topology. | Build only headless stepping, scenarios, telemetry, metrics, replay, immutable evaluator data, and a manual compare lifecycle now. Defer autonomous roles/promotion. | — | — | — |
| F-32 | `NON_BLOCKING` | `DEFERRED` | Agent host selection has no effect on the evaluator CLI or simulation bootstrap and is explicitly conditional in the existing research. | — | — | After one complete human-operated Gauntlet lifecycle works through a stable CLI/JSON contract. | — |
| F-33 | `BLOCKER` | `EXPERIMENT_REQUIRED` | Acceptance and stagnation thresholds depend on observed measurement repeatability, engine baseline variance, and evaluator sensitivity, none of which can be selected credibly by literature alone. | — | Run repeated baselines and deliberately broken mutants; estimate measurement/run variance, verify each mutant is caught, and derive versioned regression/material-improvement thresholds before autonomous promotion. | — | — |
| F-34 | `NON_BLOCKING` | `EXPERIMENT_REQUIRED` | Position-coded silhouettes are a testable visual hypothesis, and a recognition task can determine whether they help or mislead. | — | Compare role-coded body shapes with neutral physical archetypes in blinded team/player/action recognition tasks at gameplay distances; verify visual shape never changes physics implicitly. | — | — |
| F-35 | `IMPORTANT` | `RESOLVED_FROM_EXISTING_RESEARCH` | Replaceable team data and readability requirements rule out globally fixed team pairs; the necessary project decision is a dynamic kit-clash contract. | Store primary/alternate/goalkeeper/referee palette metadata, choose a matchup combination through contrast/color-vision checks, and retain a controlled-player indicator independent of kit color. | — | — | — |
| F-36 | `IMPORTANT` | `EXPERIMENT_REQUIRED` | The proposed image proxies have no validated relationship to actual recognition, while the corpus already suggests task-based perceptual tests. | — | Measure ball acquisition time, team classification, controlled-player localization, and action recognition at fixed camera/resolution/color-vision conditions; validate any image metric against those results before gating. | — | — |
| F-37 | `IMPORTANT` | `EXPERIMENT_REQUIRED` | Camera parameters materially affect feel and measurement and are explicitly open; a camera laboratory is the direct resolution method. | — | Compare fixed presets over identical replays, measuring screen/world speed relation, framing, target lag, zoom/FOV, visibility, and user preference; freeze one provisional gameplay preset. | — | — |
| F-38 | `IMPORTANT` | `EXPERIMENT_REQUIRED` | Production asset budgets depend on the selected camera, shader, renderer, and target devices; a representative asset benchmark is more informative than generic budgets. | — | Build one representative rigged character/kit/animation plus ball and measure LODs, textures, shadows, outlines, memory, load time, and p95 frame time in a 22-player scene. | — | — |
| F-39 | `NON_BLOCKING` | `DEFERRED` | Trails, glow, and spotlights are optional polish and ordinary contrast/shadow is adequate for bootstrap visibility. | — | — | During visual-polish/readability work, after the base ball material, camera, and physics are stable. | — |
| F-40 | `NON_BLOCKING` | `DEFERRED` | Trademark and freedom-to-operate questions do not affect the Technical Spec or original primitive prototype assets. | — | — | When a stable commercial visual identity and branding plan exist, before filing or making legal claims. | — |
| F-41 | `NON_BLOCKING` | `RESOLVED_FROM_EXISTING_RESEARCH` | All proposed layouts agree on dependency direction; package proliferation is not required to enforce it initially. | Start with the smallest layout that enforces `simulation <- adapters` and lets the evaluator import simulation without browser dependencies. Split packages only when independently built consumers require it. | — | — | — |
| F-42 | `NON_BLOCKING` | `DEFERRED` | These are documentation defects, not unresolved technical decisions, and the request forbids modifying the original documents in this pass. | — | — | Next documentation-maintenance pass, before publishing or generating automated cross-document references. | — |

## Disposition summary

| Disposition | Count |
|---|---:|
| `RESOLVED_FROM_EXISTING_RESEARCH` | 18 |
| `EXPERIMENT_REQUIRED` | 13 |
| `DEFERRED` | 11 |
| `NEW_RESEARCH_REQUIRED` | 0 |
| **Total** | **42** |

## Decisions sufficiently supported to make now

These decisions are supported consistently enough to enter the technical specification without waiting for further PES measurement:

| Decision | Supported boundary |
|---|---|
| Gameplay simulation is independent of rendering, DOM, server, and external data providers. | The core exposes explicit state and stepping APIs; adapters depend on it, never the reverse. |
| TypeScript is the common implementation language for the first core, browser adapter, and evaluation tooling. | Vite and the exact package/workspace layout may remain provisional. |
| Headless execution is a first-class path. | It runs a fixed number of ticks as fast as possible, without timers or rendering. |
| Use fixed-step simulation architecture. | The exact rate/substep policy remains experimental. |
| Use an explicit seeded PRNG, stable update/contact ordering, state serialization, and state hashing. | Promise pinned-runtime reproducibility first, not universal cross-platform bit identity. |
| Use controlled kinematic locomotion for normal players. | Do not use fully dynamic humanoids/ragdolls as the baseline controller. |
| Separate desired velocity, actual velocity, desired heading, and body heading. | Exact response curves remain uncalibrated. |
| Keep the ball physically independent. | Possession/control is derived from contacts and eligibility, never permanent parenting. |
| Make canonical actions and contacts simulation-authoritative. | Animation presents and refines them without owning game state. |
| Normalize keyboard, gamepad, AI, replay, test, and future network commands into tick-indexed `InputFrame`s. | Device mappings and network protocols remain adapter concerns. |
| Start with explicit, inspectable world state and stable IDs. | Generic ECS, typed-array conversion, workers, and WASM require evidence. |
| Keep ball solver, contact resolver, tactical policy, renderer, and storage replaceable behind narrow interfaces. | Replaceability does not require multiple implementations immediately. |
| Start with laboratory scenarios, not a full match. | First: locomotion; then free ball; then player-ball touch; then contact; then team shape. |
| Use formation-first, role-first, utility/reachability-based AI when team AI begins. | Weights and tactical mappings wait for stable locomotion/ball behavior and measured targets. |
| Preserve raw evidence, derived measurements, uncertainty, causal status, and provenance separately. | No derived “PES constant” may erase its evidence or uncertainty. |
| Adopt stylized, non-photorealistic readability principles. | Exact renderer, shader, outline, LOD, and VFX choices remain experimental. |
| Use fictional/hand-authored archetypes in early prototypes. | External roster ingestion waits for licensing and mapping work. |

## Required experiments and remaining TBD measurements

### Research/data experiments required before calibration

1. **Reference source qualification:** select platform/build/settings strata; audit PTS/content cadence; reject interpolation and unsuitable camera segments.
2. **Initial 54-event campaign:** approximately 15 straight locomotion segments, 15 turns, and 24 pass/roll/first-touch chains, with independent held-out footage.
3. **Pitch/camera reconstruction validation:** repeatable annotations, reprojection-error policy, uncertainty propagation, and raw/corrected/derived provenance.
4. **Controlled input capture:** exact start/stop/turn commands, pass power/assistance, reception intent, and isolated attributes.
5. **Target registry publication:** measured distributions/envelopes, observability class, uncertainty, provenance, acceptance eligibility, and version.

### Engine experiments required before freezing techniques

| Experiment | Measurements/decision still TBD | Gate affected |
|---|---|---|
| Locomotion Laboratory | `t25/t50/t90`, top-speed plateau, stopping distance/time, turn retention/radius/duration, body-heading lag; response function family | Freeze locomotion parameterization and fixed-step sensitivity |
| Ball Laboratory | ground decay model residuals, bounce ratios, CCD misses, spin/drag behavior, custom vs Rapier determinism and cost | Select ball solver and ball substep policy |
| Touch Laboratory | reach window, touch cadence, incoming/outgoing velocity relation, orientation cost, assistance, next-action latency | Freeze touch/contact policy |
| Contact Laboratory | overlap correction, displacement, speed loss, balance recovery, shielding, tackle windows, foul inputs | Freeze reduced contact/balance model |
| Shape Laboratory | anchors, width/depth/gaps, support distances, role reassignment, press latency, transition recovery, decision cadence | Freeze first team-AI feature set |
| Fixed-step benchmark | 60 vs 120 Hz and targeted substeps, p95 tick cost, contact stability | Freeze simulation timing |
| Execution benchmark | main thread vs simulation worker; message vs transfer/SAB where allowed | Decide whether workers/SAB are warranted |
| Renderer spike | Three.js vs Babylon.js only if needed; skinned player, ball, camera, toon bands, outline, LOD | Select provisional renderer/material pipeline |
| Camera Laboratory | FOV, height, pitch, smoothing, target lag, zoom and perceived-speed effect | Freeze one gameplay-camera preset |
| Target-device benchmark | p95 frame/tick time, dropped frames, memory, load time, input latency across quality tiers | Establish performance/art budgets |
| Visual readability study | ball acquisition, team/controlled-player recognition, action recognition, color-vision cases | Validate visual gates and kit-clash policy |
| Evaluator mutant suite | deliberately broken locomotion, ball, touch, defence, and camera fixtures | Validate metrics before autonomous promotion |
| Network prototypes (later) | latency, jitter/loss response, divergence, bandwidth, TURN rate/cost, authority/reconciliation | Select online topology |

### Explicit TBD values

The following must remain marked TBD rather than receiving “reasonable” constants during specification:

- PES target acceleration, braking, maximum-speed, and turn distributions;
- exact simulation rate and ball/contact substep policy;
- rating-to-capability curves and archetype ranges;
- dribbling/on-ball costs;
- first-touch assistance, reach, timing, and error distributions;
- pass/shot power, error, spin, and assistance mappings;
- ground-roll, bounce, drag, spin-decay, and curve parameters;
- contact, balance, stumble, shielding, tackle, and foul thresholds;
- goalkeeper reaction, reach, parry, recovery, and decision thresholds;
- formation anchors, tactical slider mappings, press assignments, and AI decision cadence;
- default camera parameters;
- supported hardware/browser matrix and frame/memory/load budgets;
- shader, outline, polygon, rig, texture, shadow, and crowd budgets;
- visual contrast/readability thresholds;
- input dead zones, curves, buffering, and brand mappings;
- network send/snapshot rates, authority, rollback/reconciliation, TURN assumptions, and cost;
- evaluator tolerances, regression severity thresholds, stagnation rules, and model/human budgets.

## Decisions that should remain deferred

The following deferrals are supported by the corpus and should be made explicit:

- Web Workers, renderer workers, OffscreenCanvas, SharedArrayBuffer, and cross-origin isolation until profiling and deployment tests justify them;
- WebAssembly beyond an adopted dependency such as a benchmarked Rapier build;
- WebGPU until GPU profiling demonstrates a WebGL2 bottleneck and the support matrix allows it;
- generic ECS/bitECS until state/query complexity or profiling justifies conversion;
- Rapier adoption for the canonical ball until the custom-versus-Rapier laboratory comparison;
- final Three.js versus Babylon.js selection if the team has no strong implementation prior;
- exact shader, outline, postprocessing, LOD, crowd, face, and high-detail asset pipeline;
- motion matching, procedural foot placement, root-motion techniques, ragdolls, and physics/RL character control;
- behavior trees, planners, end-to-end tactical ML/RL, and sophisticated avoidance;
- full rules, deep goalkeepers, and 11v11 match ecology until the smaller laboratories pass;
- external commercial/community player data ingestion and branded assets until legal review;
- production multiplayer topology and infrastructure;
- compact input-only replay as the sole recovery format until determinism/version migration is proven;
- OpenCode versus Pi, multi-agent critic topology, multimodal evaluation, and autonomous promotion until the evaluator works manually;
- Kubernetes, microservices, permanent match servers, complex databases, and global infrastructure.

## Recommended pre-implementation resolution order

1. **Approve milestone definitions and non-goals.** Use the locomotion/ball laboratory as the first implementation milestone; do not call it a full-game MVP.
2. **Write the small foundation specification.** Freeze coordinate/unit conventions, world/state schema, tick-indexed input, deterministic ordering, PRNG/state hashes, and simulation/presentation dependency rules.
3. **Define the evidence state honestly.** Create an empty/versioned target registry schema that refuses absent targets; do not populate it with invented constants.
4. **Plan and begin the reference campaign in parallel with laboratories.** Provisional values may support experimentation but cannot become PES acceptance targets.
5. **Run technique spikes only at decision points.** Fixed rate, custom/Rapier, workers/SAB, renderer/shader, and target hardware each need an explicit benchmark question and success criterion.
6. **Add team AI, rules, networking, production art, and autonomous orchestration only after their prerequisites are measured.**

With these resolutions, implementation can begin without pretending the research has answered questions it has only framed.

## `NEW_RESEARCH_REQUIRED` findings blocking the Technical Spec

None.
