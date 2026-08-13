# Football Simulation Engine — Gameplay Evaluation Specification

**Status:** Executable evaluation contract; reference targets unpopulated

**Date:** 2026-08-12

**Scope:** Gameplay behavior, simulation regressions, and presentation-dependent gameplay feel

**Catalog version:** `gameplay-evaluation-v1`

## 1. Purpose and authority

This specification transforms the PES 2017 Reference Test Catalog and its measurement method into a contract that a scenario runner, metric library, reference registry, and promotion evaluator can implement. It does not claim that the engine currently matches PES 2017.

The repository contains a behavioral catalog and a method for producing reference measurements, but it does not contain the audited clips, tracks, uncertainty estimates, controlled captures, distributions, envelopes, perceptual rubrics, or regression tolerances needed to populate acceptance targets. Therefore:

- scenarios and metric extraction are executable now;
- hard invariants are enforceable now;
- reference comparisons return `BLOCKED_MISSING_REFERENCE` until an eligible target exists;
- controlled-capture criteria return `NOT_EVALUATED` and remain `UNKNOWN` until causal evidence exists;
- perceptual criteria return `NEEDS_PERCEPTUAL_REVIEW` until a versioned, validated rubric exists;
- regression criteria report deltas but do not invent a materiality threshold.

This document is governed by [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md), especially its simulation, telemetry, input, replay, and scenario contracts. Evidence limitations and unresolved values are governed by [RESEARCH_AUDIT.md](../research/RESEARCH_AUDIT.md), especially F-01–F-04, F-21, F-23–F-26, F-30, F-33, F-36, and F-37.

## 2. Normative vocabulary

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative. Stimulus values such as a 90-degree turn or several shot-power inputs define controlled experiment conditions; they are not acceptance thresholds.

### 2.1 Criterion classes

Every acceptance criterion has exactly one `class`:

| Class | Meaning | Current gate behavior |
|---|---|---|
| `HARD_INVARIANT` | An architectural or logical truth independent of PES measurement. | Exact pass/fail; any failure rejects the run. |
| `MEASURED_TARGET` | A comparison against an accepted PES reference distribution or envelope. | Gate only when a populated, eligible A/B target exists. |
| `PERCEPTUAL_TARGET` | A structured judgment about visible or perceived behavior. | Requires a versioned rubric and browser artifacts; no invented scalar proxy. |
| `REGRESSION` | Candidate-versus-best preservation criterion. | Report delta now; gate only under a versioned regression policy or an independently classified hard failure. |
| `UNKNOWN` | The corpus cannot currently support an acceptance claim. | Diagnostic only; never contributes to promotion. |

Criterion class is distinct from reference measurability:

| Reference class | Interpretation | Eligible criterion now? |
|---|---|---|
| `A` | Reliably measurable from qualified public video. | `MEASURED_TARGET` after target publication. |
| `B` | Quantitative with material uncertainty. | `MEASURED_TARGET` after target publication, uncertainty-adjusted. |
| `C` | Requires controlled gameplay/input/settings capture. | `UNKNOWN` until controlled evidence is published. |
| `D` | Primarily perceptual. | `PERCEPTUAL_TARGET`; never converted to a fictitious physical scalar. |

### 2.2 Evaluation outcomes

An evaluator MUST return one of:

```text
PASS
FAIL
NOT_EVALUATED
BLOCKED_MISSING_REFERENCE
NEEDS_PERCEPTUAL_REVIEW
INVALID_RUN
```

`PASS` means all applicable criteria passed. It MUST NOT mean that missing criteria were treated as successful. A test with only missing, unknown, or unevaluated criteria returns the corresponding non-pass outcome.

Overall outcome reduction uses this precedence, from strongest to weakest:

```text
INVALID_RUN > FAIL > NEEDS_PERCEPTUAL_REVIEW
            > BLOCKED_MISSING_REFERENCE > NOT_EVALUATED > PASS
```

An unavailable `REGRESSION` policy yields `NOT_EVALUATED`; it never hides a `FAIL` from an independently evaluated hard invariant.

## 3. Machine contract

The catalog in §7 is normative structured YAML. Each family block is a standalone document fragment with a `tests` array; a materializer concatenates those arrays in document order and rejects duplicate IDs. A future implementation MAY extract the fragments from this document, but SHOULD materialize the same records as versioned data under `eval/contracts/`. The `suites` block in §8 is a separate registry document. Field names and enum values MUST remain stable within a catalog version.

```ts
type CriterionClass =
  | "HARD_INVARIANT"
  | "MEASURED_TARGET"
  | "PERCEPTUAL_TARGET"
  | "REGRESSION"
  | "UNKNOWN";

type ExecutionPath = "HEADLESS" | "BROWSER";
type VisualRequirement = "NONE" | "CONDITIONAL" | "REQUIRED";
type ReferenceClass = "A" | "B" | "C" | "D";

interface GameplayEvaluationTest {
  test_id: string;
  gameplay_property: string;
  execution: {
    paths: ExecutionPath[];
    primary: ExecutionPath;
    visual_requirement: VisualRequirement;
  };
  initial_scenario: string[];
  controlled_inputs: string[];
  state_to_record: string[];
  metrics: string[];
  reference_evidence: {
    behavioral: string;
    measurement_class: ReferenceClass;
    evidence_limit: string;
    target_status: "ABSENT" | "POPULATED";
  };
  target_types: CriterionClass[];
  acceptance_logic: EvaluationCriterion[];
  known_uncertainty: string[];
  failure_modes: string[];
  regression_dependencies: string[];
}

interface EvaluationCriterion {
  criterion_id: string;
  class: CriterionClass;
  rule: string;
}

interface TestImplementationBinding {
  test_id: string;
  scenario_ids: string[];
  metric_ids: string[];
  invariant_ids: string[];
  implementation_version: string;
}

interface ReferenceTarget {
  target_id: string;
  test_id: string;
  criterion_id: string;
  reference_class: ReferenceClass;
  target_version: string;
  source_stratum: {
    platform: string | null;
    build: string | null;
    settings_hash: string | null;
  };
  observable_conditions: Record<string, unknown>;
  metric_ids: string[];
  distribution_or_envelope_uri: string;
  measurement_uncertainty_uri: string;
  between_event_variability_uri: string;
  provenance_uri: string;
  acceptance_policy_id: string;
  acceptance_parameters: Record<string, unknown>;
}
```

Unknown values MUST be `null` or explicitly absent. They MUST NOT be inferred from expected behavior. Units are SI and axes follow `TECHNICAL_SPEC.md` §4.

`test_id` is the stable catalog key, not necessarily a one-to-one scenario filename. The catalog's `metrics` are required logical observables. Before a test implementation can report `PASS` or `FAIL`, a versioned `TestImplementationBinding` MUST resolve them to executable scenario, metric, and invariant registry IDs. A missing binding yields `NOT_EVALUATED`; it does not weaken the catalog requirement. A `ReferenceTarget` is valid only after the evidence gates in §5.1 pass, and its `acceptance_parameters` remain empty until evidence supports actual tolerances.

## 4. Common execution contract

Every test inherits the following run requirements:

```yaml
common_run_contract:
  scenario:
    required: [id, version, family, duration_ticks, seed_policy, initial_state,
      config_hash, input_trace_or_generator, observation_windows, requested_metrics]
  provenance:
    required: [candidate_commit, parent_best_commit, dirty_tree_status,
      simulation_version, runtime_version, fixed_dt_config, scenario_version,
      roster_capability_hash, tactics_hash, assistance_policy_hash, seed,
      input_trace_hash, metric_version, contract_version, reference_version]
  per_tick_state:
    required: [tick, simulation_time, input_frames, prng_state_hash,
      state_hash, player_states, ball_state, team_states]
  events:
    required: [action_events, contact_events, control_events, possession_events,
      tactical_phase_events, rule_events]
  browser_only:
    required_when_run: [browser_version, viewport, device_scale_factor,
      camera_preset, camera_transform, camera_target, fov_or_zoom, render_settings]
```

The headless runner MUST advance an explicit fixed number of ticks without wall-clock pacing. Browser tests MUST step the same simulation through normalized `InputFrame`s and the test bridge; browser input timing is not a substitute for tick-indexed input.

### 4.1 Common criteria

These criteria apply to every catalog test unless the scenario declares a documented non-applicability reason. A family record's `regression_dependencies` adds suites; it does not replace these criteria.

```yaml
common_criteria:
  - criterion_id: COMMON-FINITE
    class: HARD_INVARIANT
    rule: "No canonical numeric field is NaN or Infinity at any observed tick."
  - criterion_id: COMMON-DETERMINISTIC
    class: HARD_INVARIANT
    rule: "Two runs with the same pinned run contract have identical state hashes at every tick."
  - criterion_id: COMMON-REFERENCES
    class: HARD_INVARIANT
    rule: "All stable IDs and event/state references resolve and ordered events remain canonically ordered."
  - criterion_id: COMMON-BOUNDS
    class: HARD_INVARIANT
    rule: "Configured hard world bounds and scenario-declared legal state bounds are respected."
  - criterion_id: COMMON-REGRESSION
    class: REGRESSION
    rule: "Compare all declared dependency metrics and pathologies with the immutable best run; gate only with a versioned materiality policy."
```

## 5. Reference target and acceptance policy

### 5.1 Target eligibility

A reference event MUST pass all of these gates before contributing to a target:

```text
source timing audited
AND no unexplained cadence/interpolation defect
AND camera solution accepted when world geometry is used
AND relevant actor identity verified
AND event boundary reviewed, using an interval when ambiguous
AND world trajectory has a measurement-uncertainty estimate
AND no hidden contact occurs inside the measurement window
AND raw, corrected, projected, smoothed, and derived layers remain traceable
AND the test's A/B/C/D restriction is respected
```

Reference metadata MUST include platform, build confidence, camera, game speed, assistance, difficulty, player/team, stamina when known, input evidence, source hash, derivation versions, within-event uncertainty, and between-event gameplay variability. Unknown metadata remains null. Sources from different platform/build/settings strata MUST NOT be pooled silently.

### 5.2 Measured-target policy

`MEASURED_TARGET` criteria use `reference_envelope_v1`:

1. Validate equivalent observable conditioning; never substitute inferred controller input.
2. Compare candidate and reference distributions using metric-appropriate curves, quantiles, event sequences, and uncertainty.
3. Keep within-event measurement uncertainty separate from between-event variability.
4. Require the declared qualitative/state sequence where applicable.
5. Reject compensating artifacts even when a terminal scalar matches.
6. Use a numeric acceptance tolerance only when that tolerance is stored in the versioned target registry with derivation provenance.

Until that registry is populated, the outcome is `BLOCKED_MISSING_REFERENCE`.

### 5.3 Controlled/unknown policy

Class-C catalog tests are currently `UNKNOWN`. They may run as engine sensitivity, monotonicity, or diagnostic experiments, but MUST NOT claim PES fidelity. They become `MEASURED_TARGET` only after repeatable controlled capture establishes inputs/settings and the registry is versioned again.

### 5.4 Perceptual policy

`PERCEPTUAL_TARGET` criteria require deterministic browser replays, event-centered frame strips, relevant telemetry beside each frame, randomized/counterbalanced comparisons, a versioned rubric, critic identity/version, confidence, evidence-frame indices, and human escalation for unresolved high-severity disagreement. Raw PES-versus-engine pixel difference is invalid unless geometry, camera, and timing are actually aligned.

### 5.5 Regression policy

Regression comparison is candidate versus immutable best under the same run contract. External-reference comparison answers fidelity; regression comparison answers what changed. The evaluator MUST preserve both results. Materiality thresholds remain TBD until repeated baselines and the evaluator mutant suite establish run variance and sensitivity.

## 6. Recording and metric rules

- Time derives from simulation ticks for engine runs and decoded PTS for reference footage.
- Player ground position is the support/contact point, not a sprite or bounding-box center.
- Velocity and acceleration are derived in world coordinates with a versioned estimator; state-provided values MAY also be recorded and cross-checked.
- Movement heading, body heading, desired heading, and desired action direction are separate.
- Curvature is invalid near zero speed; reversals retain speed, duration, path, and heading sequences instead of a fictitious single radius.
- A ground-ball decay window ends at every contact. Candidate model residuals are stored; no friction law is presumed.
- Homography alone does not yield airborne `z`. Model-dependent 3D reconstruction is labeled and uncertainty retained.
- A pass/reception is one linked event chain from preparation through the next controlled action.
- Actual pass endpoint and intended target are distinct. Intended target is null unless evidenced by controlled input.
- Action, contact, touch, bounce, reaction, and phase times MAY be intervals.

## 7. Gameplay test catalog

All `reference_evidence.target_status` values are `ABSENT` at this version. Behavioral evidence labels point to the matching row and surrounding analysis in [01-pes2027-behavior.md](../research/01-pes2027-behavior.md); measurement classes and limitations come from [02-reference-measurement.md](../research/02-reference-measurement.md). Claim-level external citation mapping remains unresolved under Audit F-04, so the evidence field does not pretend otherwise.

### 7.1 Locomotion

```yaml
tests:
  - test_id: LOC-ACC-001
    gameplay_property: "Acceleration from rest is progressive while intent changes immediately."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["One stationary player on a calibrated straight lane", "High stamina; no ball or opponents"]
    controlled_inputs: ["At a declared tick apply straight full-magnitude move plus sprint and hold"]
    state_to_record: ["input/intent/kinematic/visible-response timestamps", "position, velocity, acceleration", "body and desired heading", "locomotion phase"]
    metrics: ["x(t), v(t), a(t)", "t25, t50, t90 of observed plateau", "distance at reference-defined sample times", "intent-to-kinematic latency"]
    reference_evidence: {behavioral: "R1 LOC-ACC-001; gradual rapid progression observed", measurement_class: B, evidence_limit: "Exact PES command frame and player metadata are hidden", target_status: ABSENT}
    target_types: [MEASURED_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: LOC-ACC-001-REF, class: MEASURED_TARGET, rule: "reference_envelope_v1 over the full acceleration curve and state sequence; currently BLOCKED_MISSING_REFERENCE"}
      - {criterion_id: LOC-ACC-001-REG, class: REGRESSION, rule: "Preserve stop, turn, and input-intent behavior versus best"}
    known_uncertainty: ["PES onset is interval-valued", "Reference acceleration amplifies tracking noise", "Fixed-step policy is TBD"]
    failure_modes: ["velocity assigned directly from input", "instant plateau", "slow intent acknowledgement", "curve match produced by heading snap"]
    regression_dependencies: [LOC-DEC-001, LOC-T45-001, LOC-T90-001, CTRL-LAT-001]

  - test_id: LOC-ACC-002
    gameplay_property: "Transient acceleration capability is distinct from sustainable speed."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Matched archetypes with equal sustainable-speed capability and varied transient-acceleration capability", "Stationary straight-lane starts"]
    controlled_inputs: ["Identical tick-indexed sprint traces", "Run repeated seeds/configured capability levels"]
    state_to_record: ["capability profiles", "position, velocity, acceleration", "RNG and action state"]
    metrics: ["early acceleration curve", "t25/t50/t90", "early distance", "observed plateau speed"]
    reference_evidence: {behavioral: "R1 LOC-ACC-002; separate Speed and Explosive Power dimensions", measurement_class: C, evidence_limit: "Public players differ in many attributes; causal isolation absent", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: LOC-ACC-002-CAUSAL, class: UNKNOWN, rule: "Diagnostic sensitivity only until controlled matched PES capture exists"}
      - {criterion_id: LOC-ACC-002-REG, class: REGRESSION, rule: "Capability separation must not collapse relative to the declared engine baseline"}
    known_uncertainty: ["PES rating-to-capability mapping unknown", "Attribute interactions unknown"]
    failure_modes: ["acceleration capability changes only top speed", "ratings mapped linearly without evidence", "uncontrolled archetypes used as causal proof"]
    regression_dependencies: [LOC-ACC-001, LOC-MAX-001]

  - test_id: LOC-MAX-001
    gameplay_property: "A long straight run approaches an observed velocity plateau."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["One player on a lane long enough to observe a stable high-speed segment", "No ball; high stamina"]
    controlled_inputs: ["Hold constant straight sprint input for the full observation window"]
    state_to_record: ["position, velocity, acceleration", "stamina", "locomotion phase"]
    metrics: ["moving-window observed plateau speed", "time to plateau", "dv/dt near plateau"]
    reference_evidence: {behavioral: "R1 LOC-MAX-001; plateau expected in long sprint", measurement_class: A, evidence_limit: "Reference scale, stamina, and context must be qualified", target_status: ABSENT}
    target_types: [MEASURED_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: LOC-MAX-001-REF, class: MEASURED_TARGET, rule: "Candidate plateau distribution must satisfy populated reference_envelope_v1; currently BLOCKED_MISSING_REFERENCE"}
      - {criterion_id: LOC-MAX-001-REG, class: REGRESSION, rule: "Compare plateau and acceleration coupling with best"}
    known_uncertainty: ["Observed maximum is not an internal PES constant", "Reference stamina may be unknown"]
    failure_modes: ["no convergence", "unbounded speed", "single-frame maximum used as plateau", "stamina confounded"]
    regression_dependencies: [LOC-ACC-001, LOC-BALL-001]

  - test_id: LOC-DEC-001
    gameplay_property: "Sprint release produces braking and residual displacement rather than an instantaneous stop."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["One player at stable straight high speed", "No ball or contact"]
    controlled_inputs: ["At a declared tick release sprint and set movement neutral"]
    state_to_record: ["input/intent/kinematic timestamps", "position, velocity, longitudinal acceleration", "body heading", "brake/plant phase"]
    metrics: ["stopping distance", "t_stop", "peak deceleration", "residual speed curve", "state ordering"]
    reference_evidence: {behavioral: "R1 LOC-DEC-001; residual displacement and weight observed", measurement_class: B, evidence_limit: "Exact PES stick-release tick hidden", target_status: ABSENT}
    target_types: [MEASURED_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: LOC-DEC-001-REF, class: MEASURED_TARGET, rule: "Compare braking curve, stopping metrics, heading, and phase sequence to eligible reference envelope; currently blocked"}
      - {criterion_id: LOC-DEC-001-REG, class: REGRESSION, rule: "Do not improve stop distance through velocity or heading discontinuity"}
    known_uncertainty: ["Reference release onset interval", "Derivative estimator sensitivity"]
    failure_modes: ["instant stop", "position snap", "heading rotates before braking", "terminal metric matched by discontinuity"]
    regression_dependencies: [LOC-ACC-001, LOC-REV-001, CTRL-LAT-001]

  - test_id: LOC-REV-001
    gameplay_property: "A high-speed 180-degree reversal brakes, pivots, and reacelerates."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["One player in stable straight sprint", "Clear lane; no ball"]
    controlled_inputs: ["At a declared tick reverse move direction and hold"]
    state_to_record: ["velocity and movement heading", "body/desired heading", "position path", "plant/pivot/recovery states"]
    metrics: ["minimum speed", "turn duration", "orientation lag", "arc length", "recovery time", "state ordering"]
    reference_evidence: {behavioral: "R1 LOC-REV-001; brake-pivot-reaccelerate sequence observed", measurement_class: B, evidence_limit: "Exact PES command timing/magnitude hidden; radius unstable near zero speed", target_status: ABSENT}
    target_types: [MEASURED_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: LOC-REV-001-REF, class: MEASURED_TARGET, rule: "Compare observed reversal sequence and distributions, not a single radius; currently blocked"}
      - {criterion_id: LOC-REV-001-REG, class: REGRESSION, rule: "Preserve intent latency and lower-angle turn behavior"}
    known_uncertainty: ["Reference input hidden", "Body pose uncertainty"]
    failure_modes: ["instant velocity reversal", "rotation in place at full speed", "curvature reported at zero speed", "no pivot state"]
    regression_dependencies: [LOC-DEC-001, LOC-T45-001, LOC-T90-001, LOC-ORI-001]

  - test_id: LOC-T45-001
    gameplay_property: "An observed 30–60-degree path deflection retains comparatively more speed than sharper turns."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["One player at controlled entry speed on a straight path"]
    controlled_inputs: ["Apply and hold a declared 45-degree desired movement direction; classify references by observed path deflection"]
    state_to_record: ["position path", "velocity", "movement/body/desired headings", "locomotion phase"]
    metrics: ["entry/minimum speed", "speed-retention ratio", "turn duration", "curvature profile", "minimum valid radius", "recovery"]
    reference_evidence: {behavioral: "R1 LOC-T45-001; moderate speed loss", measurement_class: B, evidence_limit: "Reference stick angle unknown; observed deflection only", target_status: ABSENT}
    target_types: [MEASURED_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: LOC-T45-001-REF, class: MEASURED_TARGET, rule: "Condition on measured entry speed and observed deflection; apply reference_envelope_v1 when populated"}
      - {criterion_id: LOC-T45-001-REG, class: REGRESSION, rule: "Compare curve and heading sequence with best"}
    known_uncertainty: ["Reference body heading may be binned", "Smoothing affects curvature"]
    failure_modes: ["full-speed heading snap", "same response for every turn angle", "radius computed in invalid low-speed samples"]
    regression_dependencies: [LOC-T90-001, LOC-REV-001, LOC-ORI-001]

  - test_id: LOC-T90-001
    gameplay_property: "An observed 70–110-degree path deflection requires more reorientation/braking than a moderate cut."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["One player at controlled entry speed on a straight path"]
    controlled_inputs: ["Apply and hold a declared 90-degree desired movement direction; classify references by observed path deflection"]
    state_to_record: ["position path", "velocity", "movement/body/desired headings", "plant and recovery states"]
    metrics: ["entry/minimum speed", "speed retention", "turn duration", "curvature/radius", "heading lag", "recovery"]
    reference_evidence: {behavioral: "R1 LOC-T90-001; sharper reorientation than 45-degree turn", measurement_class: B, evidence_limit: "Reference stick angle hidden", target_status: ABSENT}
    target_types: [MEASURED_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: LOC-T90-001-REF, class: MEASURED_TARGET, rule: "Compare complete conditioned turn envelope and sequence when target exists"}
      - {criterion_id: LOC-T90-001-REG, class: REGRESSION, rule: "Do not improve this turn by regressing 45-degree or reversal response"}
    known_uncertainty: ["Reference input hidden", "Pose/camera uncertainty"]
    failure_modes: ["orientation snap", "no speed cost", "same curve as 45-degree cut", "overly sluggish intent"]
    regression_dependencies: [LOC-T45-001, LOC-REV-001, LOC-ORI-001, CTRL-LAT-001]

  - test_id: LOC-ORI-001
    gameplay_property: "Body heading can differ from movement and desired-action directions without visual contradiction."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: REQUIRED}
    initial_scenario: ["Player performs lateral and diagonal movement at several stable speeds"]
    controlled_inputs: ["Tick-indexed direction changes and action-facing targets", "Fixed browser replay and camera for visual pass"]
    state_to_record: ["movement/body/desired/action headings", "angular rate", "velocity", "locomotion phase", "presentation heading and pose markers"]
    metrics: ["heading error over time", "orientation convergence rate", "orientation-response latency", "state/presentation agreement"]
    reference_evidence: {behavioral: "R1 LOC-ORI-001; torso and velocity need not coincide", measurement_class: B, evidence_limit: "Monocular pose estimation is uncertain", target_status: ABSENT}
    target_types: [MEASURED_TARGET, PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: LOC-ORI-001-REF, class: MEASURED_TARGET, rule: "Compare state heading paths to uncertainty-aware reference when populated"}
      - {criterion_id: LOC-ORI-001-VIS, class: PERCEPTUAL_TARGET, rule: "Browser frame strip must show plausible pose continuity and agree with canonical body heading; rubric TBD"}
      - {criterion_id: LOC-ORI-001-REG, class: REGRESSION, rule: "No new heading snap or simulation/presentation divergence versus best"}
    known_uncertainty: ["Reference body heading may only support 8/16 bins", "Animation implementation is deferred"]
    failure_modes: ["body equals velocity unconditionally", "instant body snap", "visual root/pose contradicts state", "pose proxy overclaimed"]
    regression_dependencies: [LOC-T45-001, LOC-T90-001, LOC-REV-001, CTRL-LAT-001]

  - test_id: LOC-BALL-001
    gameplay_property: "On-ball locomotion and touch cadence may differ from matched off-ball locomotion."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Same archetype and lane in matched ball/no-ball trials", "Ball starts in a feasible dribble relation"]
    controlled_inputs: ["Identical sprint traces", "Matched seeds and capability/config state"]
    state_to_record: ["player kinematics", "ball kinematics and contact history", "touch/control windows", "stamina"]
    metrics: ["on/off observed plateau ratio", "touch interval distribution", "ball-player separation", "velocity loss around touches"]
    reference_evidence: {behavioral: "R1 LOC-BALL-001; periodic touches and possible speed cost", measurement_class: C, evidence_limit: "No matched public PES trial", target_status: ABSENT}
    target_types: [UNKNOWN, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: LOC-BALL-001-FREE, class: HARD_INVARIANT, rule: "Dribbling uses recorded feasible contacts; the ball is never parented or teleported"}
      - {criterion_id: LOC-BALL-001-CAUSAL, class: UNKNOWN, rule: "PES on-ball penalty and cadence are diagnostic until controlled matched capture"}
      - {criterion_id: LOC-BALL-001-REG, class: REGRESSION, rule: "Compare dribble controllability, free-ball continuity, and off-ball locomotion with best"}
    known_uncertainty: ["PES input and assistance unknown", "Touch animation/contact relation unknown"]
    failure_modes: ["ball attached to foot", "hidden speed multiplier claimed as PES value", "unmatched contexts compared", "unrecorded microcontacts"]
    regression_dependencies: [BALL-IND-001, LOC-MAX-001, TOUCH-SLOW-001]
```

### 7.2 Physical contact and ball physics

```yaml
tests:
  - test_id: PHY-SHLD-001
    gameplay_property: "Parallel shoulder contact produces continuous displacement and speed effects, not an instant winner."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Two matched players run parallel toward a free ball with controlled lateral overlap"]
    controlled_inputs: ["Matched forward sprint traces", "Controlled approach offset and contact timing"]
    state_to_record: ["both player kinematics/headings", "contact candidates/events and impulses/corrections", "balance state", "ball/control/possession facts"]
    metrics: ["lateral displacement", "velocity loss", "contact duration", "balance/recovery", "control duration"]
    reference_evidence: {behavioral: "R1 PHY-SHLD-001; continuous shoulder-to-shoulder outcome", measurement_class: B, evidence_limit: "Reference contact input/state hidden", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: PHY-SHLD-001-CONT, class: HARD_INVARIANT, rule: "Outcome follows ordered contact state; no possession or position teleport and no stat-only instant winner"}
      - {criterion_id: PHY-SHLD-001-REF, class: MEASURED_TARGET, rule: "Compare displacement/speed/recovery envelope when populated"}
      - {criterion_id: PHY-SHLD-001-REG, class: REGRESSION, rule: "Preserve congestion, ball independence, and locomotion behavior"}
    known_uncertainty: ["Reference collision geometry and inputs hidden", "Body pose uncertain"]
    failure_modes: ["higher stat always wins", "excess separation correction", "interpenetration", "possession assigned without ball evidence"]
    regression_dependencies: [PHY-STR-001, PHY-BC-001, BALL-IND-001]

  - test_id: PHY-STR-001
    gameplay_property: "Physical resistance and agile balance/recovery remain distinct capabilities."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Matched contact trials varying physical-contact and body-control capabilities independently"]
    controlled_inputs: ["Identical approach geometry, speed, input trace, and seed batches"]
    state_to_record: ["capability profiles", "contact events", "displacement/velocity", "balance and recovery states"]
    metrics: ["displacement", "speed retention", "stumble duration", "recovery time"]
    reference_evidence: {behavioral: "R1 PHY-STR-001; roster supports strength/agility distinction", measurement_class: C, evidence_limit: "No isolated matched PES pair", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: PHY-STR-001-CAUSAL, class: UNKNOWN, rule: "Engine sensitivity diagnostic only until controlled attribute isolation exists"}
      - {criterion_id: PHY-STR-001-REG, class: REGRESSION, rule: "Distinct capability dimensions must not collapse versus best"}
    known_uncertainty: ["Attribute mappings/interactions unknown"]
    failure_modes: ["single duel rating", "linear external-rating mapping", "uncontrolled comparison claimed causal"]
    regression_dependencies: [PHY-SHLD-001, PHY-BC-001]

  - test_id: PHY-BC-001
    gameplay_property: "Body-control capability affects disturbance and recovery under a matched lateral perturbation."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Receiver/dribbler turning under a repeatable scripted or actor-generated lateral contact"]
    controlled_inputs: ["Vary body-control capability only", "Matched geometry, speed, seed, and action trace"]
    state_to_record: ["heading disturbance", "velocity", "balance/stumble/recovery states", "contact event"]
    metrics: ["peak heading disturbance", "stumble duration", "velocity recovery", "path deviation"]
    reference_evidence: {behavioral: "R1 PHY-BC-001; some players maintain/recover posture better", measurement_class: C, evidence_limit: "Attribute-specific causal trial absent", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: PHY-BC-001-CAUSAL, class: UNKNOWN, rule: "No PES acceptance until controlled perturbation capture exists"}
      - {criterion_id: PHY-BC-001-REG, class: REGRESSION, rule: "Report sensitivity and coupling changes versus best"}
    known_uncertainty: ["Exact Body Control mapping unknown", "Perturbation/contact geometry TBD"]
    failure_modes: ["body control changes raw strength only", "recovery is instantaneous", "outcome is binary"]
    regression_dependencies: [PHY-SHLD-001, PHY-STR-001, LOC-ORI-001]

  - test_id: PHY-PC-001
    gameplay_property: "Physical-contact capability changes contact outcomes without silently changing unrelated behavior."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Batch of identical contact/duel situations over controlled capability levels"]
    controlled_inputs: ["Intervene on physical-contact capability only", "Matched traces and seeds"]
    state_to_record: ["capability profiles", "contacts, fouls, displacement", "actions and possession"]
    metrics: ["contacts per scenario", "displacement distribution", "speed loss", "foul/event rate", "control outcomes"]
    reference_evidence: {behavioral: "R1 PHY-PC-001; low-confidence community roster intervention", measurement_class: C, evidence_limit: "Community mod uncontrolled and indirect effects possible", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: PHY-PC-001-CAUSAL, class: UNKNOWN, rule: "Never use community claim as numeric or causal acceptance target"}
      - {criterion_id: PHY-PC-001-REG, class: REGRESSION, rule: "Sensitivity must not create unrelated speed, AI, or foul regressions"}
    known_uncertainty: ["Evidence confidence low", "Rules/foul thresholds under-researched"]
    failure_modes: ["community claim treated as fact", "stat modifies AI aggression unintentionally", "higher stat guarantees possession"]
    regression_dependencies: [PHY-SHLD-001, TACK-ANG-001, TEMPO-001]

  - test_id: BALL-IND-001
    gameplay_property: "The ball remains an independent continuous 3D entity between explicit contacts."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Congested loose-ball and rebound sequences", "Include controller changes and competing eligibility windows"]
    controlled_inputs: ["Script contacts, attempted controls, and player direction changes at declared ticks"]
    state_to_record: ["ball position/linear/angular velocity every tick", "contact history and surfaces", "control eligibility/windows", "last touch and possession facts"]
    metrics: ["free-ball duration", "contact sequence", "velocity discontinuities paired to events", "ball-player separation"]
    reference_evidence: {behavioral: "R1 BALL-IND-001; loose balls/rebounds behave independently", measurement_class: A, evidence_limit: "Invisible PES capture assistance remains possible", target_status: ABSENT}
    target_types: [HARD_INVARIANT, MEASURED_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: BALL-IND-001-CONT, class: HARD_INVARIANT, rule: "Every discontinuous ball-state change has an ordered contact/rule event; no parent transform or controller teleport exists"}
      - {criterion_id: BALL-IND-001-POSS, class: HARD_INVARIANT, rule: "Control/possession changes require recorded eligibility/contact evidence and never attach the ball"}
      - {criterion_id: BALL-IND-001-REF, class: MEASURED_TARGET, rule: "Compare free-ball/contact sequence distributions when reference target exists"}
      - {criterion_id: BALL-IND-001-REG, class: REGRESSION, rule: "Mutants that parent or teleport the ball must be detected"}
    known_uncertainty: ["Reference assistance is unidentifiable from public footage"]
    failure_modes: ["ball parenting", "unlogged velocity rewrite", "possession toggle moves ball", "interpolation mistaken for authoritative motion"]
    regression_dependencies: [LOC-BALL-001, TOUCH-SLOW-001, INT-PASS-001, GK-PARRY-001]

  - test_id: BALL-GND-001
    gameplay_property: "An uninterrupted ground ball loses speed according to a measurable trajectory, without presuming its law."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Ball released on a flat pitch with no possible contacts during the observation window"]
    controlled_inputs: ["Several declared initial planar velocities", "No later impulses"]
    state_to_record: ["ball position/velocity/spin/regime", "ground contacts", "solver/substep configuration"]
    metrics: ["s(t), v(t), dv/dt", "stopping curve", "constant/proportional/piecewise/nonparametric fit residuals"]
    reference_evidence: {behavioral: "R1 BALL-GND-001; roll-off visible", measurement_class: A, evidence_limit: "Initial input power unknown but free decay measurable", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: BALL-GND-001-CONTACT, class: HARD_INVARIANT, rule: "Measurement window contains no unrecorded contact or impulse"}
      - {criterion_id: BALL-GND-001-REF, class: MEASURED_TARGET, rule: "Compare v(t) curves and model residuals to populated envelope; do not assert a PES coefficient"}
      - {criterion_id: BALL-GND-001-REG, class: REGRESSION, rule: "Compare decay curve across declared initial conditions with best"}
    known_uncertainty: ["No accepted PES tracks yet", "Solver family and substeps TBD"]
    failure_modes: ["speed constant forever", "ball stops discontinuously", "one model assumed before residual comparison", "hidden touch inside window"]
    regression_dependencies: [BALL-GND-002, PASS-LOW-001, TOUCH-SLOW-001]

  - test_id: BALL-GND-002
    gameplay_property: "Ground-ball decay may depend on current or initial speed."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Matched ground-roll lanes with several controlled initial velocities"]
    controlled_inputs: ["Set initial ball states through explicit scenario events", "Hold surface/spin/config constant"]
    state_to_record: ["ball state and ground contacts", "surface and solver configuration"]
    metrics: ["deceleration versus speed", "normalized v(t)", "stopping curves", "candidate-model residual differences"]
    reference_evidence: {behavioral: "R1 BALL-GND-002; compare passes of different speeds", measurement_class: B, evidence_limit: "Reference initial spin/contact/surface may confound", target_status: ABSENT}
    target_types: [MEASURED_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: BALL-GND-002-REF, class: MEASURED_TARGET, rule: "Use stratified uncertainty-aware reference curves when available; currently blocked"}
      - {criterion_id: BALL-GND-002-REG, class: REGRESSION, rule: "Report response-surface changes versus best"}
    known_uncertainty: ["Reference samples not perfectly matched", "Spin difficult to observe"]
    failure_modes: ["single pass used to infer speed dependence", "initial-speed bands invented as gates", "surface conditions pooled silently"]
    regression_dependencies: [BALL-GND-001, PASS-LOW-001]

  - test_id: BALL-BNC-001
    gameplay_property: "A first pitch bounce changes horizontal and vertical ball motion continuously at a recorded contact."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Airborne ball descends onto clear pitch with controlled incoming state"]
    controlled_inputs: ["Several declared incoming horizontal/vertical velocities and spins", "No player contacts"]
    state_to_record: ["3D ball state", "pitch contact time/surface/normal", "solver state"]
    metrics: ["bounce time/position", "horizontal speed ratio/direction", "vertical velocity before/after", "apex/height ratio when valid"]
    reference_evidence: {behavioral: "R1 BALL-BNC-001; visible first bounce", measurement_class: B, evidence_limit: "Public monocular vertical/spin reconstruction is weak", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: BALL-BNC-001-EVENT, class: HARD_INVARIANT, rule: "Bounce discontinuity is paired with one ordered pitch-contact event"}
      - {criterion_id: BALL-BNC-001-REF, class: MEASURED_TARGET, rule: "Gate robust horizontal/time quantities and only model-dependent 3D quantities explicitly labeled as such"}
      - {criterion_id: BALL-BNC-001-REG, class: REGRESSION, rule: "No new tunneling, energy creation pathology, or contact duplication versus best"}
    known_uncertainty: ["Reference z/spin uncertain", "Restitution coefficient cannot be inferred directly from height ratio"]
    failure_modes: ["unlogged bounce", "ball tunnels through pitch", "height ratio mislabeled restitution", "real-world gravity forced into reference reconstruction"]
    regression_dependencies: [BALL-GND-001, BALL-SPN-001]

  - test_id: BALL-SPN-001
    gameplay_property: "Ball spin can produce progressive lateral curvature."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Clear rolling or airborne ball path long enough to observe lateral deviation"]
    controlled_inputs: ["Declare initial linear and angular velocity", "Run spin-off control and signed-spin mirror trials"]
    state_to_record: ["3D ball position/linear/angular velocity", "aero/curve configuration", "contacts"]
    metrics: ["lateral deviation", "curvature by flight/path segment", "flight time", "spin decay", "mirrored-path error"]
    reference_evidence: {behavioral: "R1 BALL-SPN-001; Swerve dimension and visible curve", measurement_class: B, evidence_limit: "3D, camera, and spin separation difficult", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: BALL-SPN-001-SYM, class: HARD_INVARIANT, rule: "With mirrored initial spin and scenario, lateral response mirrors within deterministic numeric policy"}
      - {criterion_id: BALL-SPN-001-REF, class: MEASURED_TARGET, rule: "Compare only reference-supported path observables with reconstruction uncertainty"}
      - {criterion_id: BALL-SPN-001-REG, class: REGRESSION, rule: "Preserve no-spin baseline, flight, and ground behavior"}
    known_uncertainty: ["PES spin input unknown", "Airborne z model-dependent"]
    failure_modes: ["constant lateral offset", "curve ignores spin sign", "curve force creates energy/path artifacts", "2D path treated as exact 3D"]
    regression_dependencies: [BALL-SPN-002, BALL-BNC-001, SHOT-SWV-001]

  - test_id: BALL-SPN-002
    gameplay_property: "Curvature response may change with strike power/initial speed."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Matched curved strikes from one geometry over declared power/input levels"]
    controlled_inputs: ["Hold aim, spin command, actor, and context constant; vary strike-power input"]
    state_to_record: ["action input/contact outcome", "ball linear/angular velocity and path"]
    metrics: ["initial speed", "maximum deviation", "curvature by segment", "flight time"]
    reference_evidence: {behavioral: "R1 BALL-SPN-002; proposed curve-versus-power comparison", measurement_class: C, evidence_limit: "Known repeated PES power inputs unavailable", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: BALL-SPN-002-CAUSAL, class: UNKNOWN, rule: "Engine response-surface diagnostic only until controlled PES strikes exist"}
      - {criterion_id: BALL-SPN-002-REG, class: REGRESSION, rule: "Report non-monotonic/pathological response changes versus best"}
    known_uncertainty: ["PES power and spin commands hidden", "Action-to-spin mapping unknown"]
    failure_modes: ["public initial speed mistaken for known power input", "linear relationship asserted without evidence", "spin changes unintentionally with unrelated state"]
    regression_dependencies: [BALL-SPN-001, SHOT-PWR-001]
```

### 7.3 First touch, passing, shooting, and heading

```yaml
tests:
  - test_id: TOUCH-SLOW-001
    gameplay_property: "A lower-speed pass can be controlled with a contextual short first touch."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Unpressured receiver in open/front-ish orientation", "Ground pass in the lower reference speed stratum"]
    controlled_inputs: ["Script pass and receiver exit intent through tick-indexed inputs", "Hold capability and assistance policy explicit"]
    state_to_record: ["linked pass/contact chain", "ball and receiver kinematics", "body/desired heading", "contact surface", "next-action eligibility"]
    metrics: ["incoming/post-contact velocity", "maximum post-touch separation", "outgoing angle", "next-action latency", "adjustment steps/touches"]
    reference_evidence: {behavioral: "R1 TOUCH-SLOW-001; short control and early availability", measurement_class: B, evidence_limit: "Receiver intent hidden in public footage", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: TOUCH-SLOW-001-CONTACT, class: HARD_INVARIANT, rule: "First touch is an explicit feasible contact on an independent ball, not a possession toggle"}
      - {criterion_id: TOUCH-SLOW-001-REF, class: MEASURED_TARGET, rule: "Condition on measured incoming state/orientation and compare the event chain when populated"}
      - {criterion_id: TOUCH-SLOW-001-REG, class: REGRESSION, rule: "Preserve fast-touch differentiation and ball continuity"}
    known_uncertainty: ["Reference intent/input unknown", "Speed strata must derive from measured sample distribution"]
    failure_modes: ["ball snaps to receiver", "slow-band threshold invented", "terminal separation matched with implausible contact", "next action enabled before contact"]
    regression_dependencies: [TOUCH-FAST-001, BALL-IND-001, PASS-LOW-001]

  - test_id: TOUCH-FAST-001
    gameplay_property: "A higher-speed pass changes first-touch separation, speed, or control sequence contextually."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Same receiver geometry as slow-touch scenario", "Ground pass in higher reference speed stratum"]
    controlled_inputs: ["Matched receiver intent/capability; vary measured incoming ball speed"]
    state_to_record: ["same linked chain and state as TOUCH-SLOW-001", "pressure and assistance state"]
    metrics: ["post-touch separation/speed", "control time", "outgoing angle", "next-action latency", "difference from slow condition"]
    reference_evidence: {behavioral: "R1 TOUCH-FAST-001; speed/height affect Real Touch", measurement_class: B, evidence_limit: "Matched public intent unavailable", target_status: ABSENT}
    target_types: [MEASURED_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: TOUCH-FAST-001-REF, class: MEASURED_TARGET, rule: "Compare conditioned event distribution; no assumed monotonic penalty magnitude"}
      - {criterion_id: TOUCH-FAST-001-REG, class: REGRESSION, rule: "Compare with slow-touch and ball-decay baselines"}
    known_uncertainty: ["Reference intent and assistance hidden", "Speed bands TBD until dataset exists"]
    failure_modes: ["all speeds produce identical touch", "fixed penalty invented", "pass physics altered to fake touch result"]
    regression_dependencies: [TOUCH-SLOW-001, BALL-GND-001, PASS-LOW-001]

  - test_id: TOUCH-BACK-001
    gameplay_property: "Receiving with the back toward the desired exit produces a contextual turn/control sequence."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: REQUIRED}
    initial_scenario: ["Receiver body heading approximately opposite desired exit", "Matched ground pass and no defender"]
    controlled_inputs: ["Hold desired exit from before contact", "Use matched pass states across orientation trials"]
    state_to_record: ["incoming ball state", "body/movement/desired headings", "contact surface and touch family", "action/locomotion phases"]
    metrics: ["time to advance toward exit", "touch count/separation", "orientation path", "retained speed", "next-action latency"]
    reference_evidence: {behavioral: "R1 TOUCH-BACK-001; orientation and manner of receiving matter", measurement_class: B, evidence_limit: "Exact input and pose are uncertain", target_status: ABSENT}
    target_types: [MEASURED_TARGET, PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: TOUCH-BACK-001-REF, class: MEASURED_TARGET, rule: "Compare orientation-conditioned state sequence when target exists"}
      - {criterion_id: TOUCH-BACK-001-VIS, class: PERCEPTUAL_TARGET, rule: "Frame strip must show contact/turn continuity and no contradictory body snap; rubric TBD"}
      - {criterion_id: TOUCH-BACK-001-REG, class: REGRESSION, rule: "Preserve open and side-on reception behavior"}
    known_uncertainty: ["Exact orientation cost unknown", "Reference foot/contact surface may be occluded"]
    failure_modes: ["same result as open reception", "instant 180-degree pose/velocity rotation", "animation contact differs from canonical contact"]
    regression_dependencies: [TOUCH-90-001, TOUCH-SLOW-001, LOC-ORI-001]

  - test_id: TOUCH-90-001
    gameplay_property: "A side-on reception selects a distinct feasible contact and exit path."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: REQUIRED}
    initial_scenario: ["Receiver body heading side-on to incoming pass", "Matched front/back reception controls"]
    controlled_inputs: ["Declared exit intent", "Matched pass state and capability"]
    state_to_record: ["ball/player kinematics", "heading paths", "contact location/surface/family", "next-action state"]
    metrics: ["contact point", "exit angle", "separation", "latency", "orientation path"]
    reference_evidence: {behavioral: "R1 TOUCH-90-001; side-on control differs", measurement_class: B, evidence_limit: "Reference pose and intent uncertain", target_status: ABSENT}
    target_types: [MEASURED_TARGET, PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: TOUCH-90-001-REF, class: MEASURED_TARGET, rule: "Use reference_envelope_v1 conditioned on observable geometry"}
      - {criterion_id: TOUCH-90-001-VIS, class: PERCEPTUAL_TARGET, rule: "Canonical contact and rendered foot/body presentation must agree; rubric TBD"}
      - {criterion_id: TOUCH-90-001-REG, class: REGRESSION, rule: "Compare front/back orientation variants"}
    known_uncertainty: ["Automatic capture assistance unknown", "Pose resolution may be categorical"]
    failure_modes: ["ball attraction", "foot selection impossible for pose", "state/render contact mismatch", "orientation ignored"]
    regression_dependencies: [TOUCH-BACK-001, TOUCH-SLOW-001, LOC-ORI-001]

  - test_id: TOUCH-WF-001
    gameplay_property: "Dominant-foot capability may affect first-touch selection or quality."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Symmetric passes force strong-side and weak-side reception under matched geometry"]
    controlled_inputs: ["Vary dominant-foot capability only", "Matched pass, intent, seed, and pressure"]
    state_to_record: ["foot/contact surface selected", "incoming/outgoing ball state", "control/action latency", "capability profile"]
    metrics: ["foot-selection rate", "ball error/separation", "control latency", "paired-side delta"]
    reference_evidence: {behavioral: "R1 TOUCH-WF-001; weak-foot fields exist but Real Touch link unconfirmed", measurement_class: C, evidence_limit: "Specific causal relation unknown", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: TOUCH-WF-001-CAUSAL, class: UNKNOWN, rule: "No PES weak-foot first-touch claim until controlled capture confirms it"}
      - {criterion_id: TOUCH-WF-001-REG, class: REGRESSION, rule: "Report symmetry and foot-selection changes versus best"}
    known_uncertainty: ["Weak Foot may not govern first touch", "Contact surface may be presentation-limited"]
    failure_modes: ["unsupported attribute relationship hard-coded", "side geometry not mirrored", "visual foot contradicts contact event"]
    regression_dependencies: [TOUCH-90-001, PASS-ANG-001]

  - test_id: PASS-LOW-001
    gameplay_property: "A low pass creates an initial physical ball state and then follows independent ball physics."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Stable, well-oriented passer and stationary receiver on clear ground lane"]
    controlled_inputs: ["Tick-indexed low-pass command with explicit aim/assistance/power policy", "Repeated seeds"]
    state_to_record: ["command/intent/preparation/contact timestamps", "passer heading/foot", "ball contact and trajectory", "receiver/target facts"]
    metrics: ["initial/arrival speed", "travel time", "lateral/longitudinal endpoint error", "execution time", "decay curve"]
    reference_evidence: {behavioral: "R1 PASS-LOW-001; attributes, orientation, timing, weight/speed matter", measurement_class: B, evidence_limit: "Reference aim, power bar, assistance unknown", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: PASS-LOW-001-IMPULSE, class: HARD_INVARIANT, rule: "Pass resolves one recorded contact/impulse; it never moves the ball toward a target after release"}
      - {criterion_id: PASS-LOW-001-REF, class: MEASURED_TARGET, rule: "Compare actual output conditioned on observable release state; do not infer hidden command"}
      - {criterion_id: PASS-LOW-001-REG, class: REGRESSION, rule: "Preserve ground decay, touch, and action latency"}
    known_uncertainty: ["Reference assistance/power/intent hidden", "No populated pass distribution"]
    failure_modes: ["homing pass", "accuracy and speed collapsed", "ball friction changes by target", "intended target inferred from endpoint"]
    regression_dependencies: [BALL-IND-001, BALL-GND-001, TOUCH-SLOW-001, CTRL-ACT-001]

  - test_id: PASS-ANG-001
    gameplay_property: "Pass execution depends on passer orientation relative to target."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Matched passes with passer body heading varied from open to badly oriented"]
    controlled_inputs: ["Same target/aim/power/assistance and seed batches", "Declared orientation conditions"]
    state_to_record: ["body/desired/action headings", "preparation/contact/recovery state", "foot selection", "outgoing ball state"]
    metrics: ["preparation duration", "execution/endpoint error", "foot selection", "ball speed", "paired orientation delta"]
    reference_evidence: {behavioral: "R1 PASS-ANG-001; official evidence says direction/angle matter", measurement_class: C, evidence_limit: "Causal penalty needs controlled matched attempts", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: PASS-ANG-001-CAUSAL, class: UNKNOWN, rule: "Orientation sensitivity is diagnostic until controlled PES target exists; no penalty curve is specified"}
      - {criterion_id: PASS-ANG-001-REG, class: REGRESSION, rule: "Report sensitivity and action-state changes versus best"}
    known_uncertainty: ["Penalty form/magnitude unknown", "Foot selection and assistance confound"]
    failure_modes: ["invented angular penalty", "orientation ignored", "ball redirected after contact", "animation masks impossible contact"]
    regression_dependencies: [PASS-LOW-001, LOC-ORI-001, CTRL-ACT-001]

  - test_id: PASS-RUN-001
    gameplay_property: "A pass to a moving receiver may lead the receiver's future trajectory."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Receiver runs a declared path into clear space; passer is stable"]
    controlled_inputs: ["Known intended receiver/aim under explicit assistance policy", "Vary receiver speed/path in scenario matrix"]
    state_to_record: ["receiver trajectory", "pass target/lead policy", "ball trajectory", "passer state", "meeting/contact event"]
    metrics: ["lead distance", "predicted/actual meeting point", "arrival timing", "receiver adjustment/wait time"]
    reference_evidence: {behavioral: "R1 PASS-RUN-001; teammate motion is considered", measurement_class: B, evidence_limit: "Public intended target and assistance unknown", target_status: ABSENT}
    target_types: [MEASURED_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: PASS-RUN-001-REF, class: MEASURED_TARGET, rule: "Compare actual lead geometry conditioned on observable receiver path; never claim hidden target reconstruction"}
      - {criterion_id: PASS-RUN-001-REG, class: REGRESSION, rule: "Preserve low-pass physics and interception opportunity"}
    known_uncertainty: ["Autonomous versus user-triggered run may be unknown", "Assistance mode unknown"]
    failure_modes: ["ball homes after release", "endpoint called intended target", "lead ignores reachability", "defenders excluded from full-context validation"]
    regression_dependencies: [PASS-LOW-001, INT-PASS-001, OFF-RUN-001]

  - test_id: PASS-THR-001
    gameplay_property: "Short through passes have measurable weight, receiver wait, and interception exposure."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Short midfield triangle with receiver moving into a gap and one realistic interception lane"]
    controlled_inputs: ["Tick-indexed through-pass command", "Explicit target/assistance/power policy"]
    state_to_record: ["pass action/contact", "ball and receiver trajectories", "defender reach/decision", "wait/meeting event"]
    metrics: ["initial/arrival speed", "receiver wait", "meeting-point usability", "interception margin/rate"]
    reference_evidence: {behavioral: "R1 PASS-THR-001; reviewer observed some underpowered short through passes", measurement_class: B, evidence_limit: "Subjective, unquantified sample and hidden command", target_status: ABSENT}
    target_types: [MEASURED_TARGET, PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: PASS-THR-001-REF, class: MEASURED_TARGET, rule: "Gate only against a populated output distribution, not the review adjective"}
      - {criterion_id: PASS-THR-001-USABLE, class: PERCEPTUAL_TARGET, rule: "Usability/flow review uses event frames and telemetry under a versioned rubric; currently review-only"}
      - {criterion_id: PASS-THR-001-REG, class: REGRESSION, rule: "Preserve low-pass decay, lead, and interception behavior"}
    known_uncertainty: ["Evidence sample unquantified", "Assistance and intent hidden"]
    failure_modes: ["hard-coded underpower to mimic review", "homing path", "interception disabled to make pass usable"]
    regression_dependencies: [PASS-LOW-001, PASS-RUN-001, INT-PASS-001]

  - test_id: PASS-LOFT-001
    gameplay_property: "A lofted pass creates a contextual independent 3D arc."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Free passer and distant receiver with clear aerial lane"]
    controlled_inputs: ["Declared lofted-pass aim/power/spin/assistance policy"]
    state_to_record: ["action/contact chain", "3D ball trajectory/spin", "receiver path", "landing/bounce events"]
    metrics: ["horizontal/vertical initial velocity", "apex/time-to-apex", "flight time/range", "landing velocity/angle", "first bounce"]
    reference_evidence: {behavioral: "R1 PASS-LOFT-001; contextual lofted variety", measurement_class: B, evidence_limit: "Public 3D reconstruction and power input uncertain", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: PASS-LOFT-001-IMPULSE, class: HARD_INVARIANT, rule: "One canonical action contact creates the ball state; no guided arc after release"}
      - {criterion_id: PASS-LOFT-001-REF, class: MEASURED_TARGET, rule: "Compare robust 2D/time outputs and only qualified model-dependent 3D outputs"}
      - {criterion_id: PASS-LOFT-001-REG, class: REGRESSION, rule: "Preserve ball flight, bounce, and ground-pass behavior"}
    known_uncertainty: ["Reference power bar hidden", "Monocular z ambiguous"]
    failure_modes: ["scripted/homing trajectory", "apex invented from homography", "real-world gravity used to manufacture reference"]
    regression_dependencies: [BALL-BNC-001, BALL-SPN-001, PASS-LOW-001]

  - test_id: CROSS-HI-001
    gameplay_property: "A high cross reaches an aerial target zone with measurable flight and descent behavior."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Wide player near flank and aerial attackers/defenders in box"]
    controlled_inputs: ["Declared cross variant, aim, power, spin, and assistance policy"]
    state_to_record: ["cross action/contact", "3D ball path", "target zone and actor reachability", "keeper/heading decisions"]
    metrics: ["apex", "time to box/flight time", "landing/contact zone", "descent angle", "reach margins"]
    reference_evidence: {behavioral: "R1 CROSS-HI-001; high curved variants documented", measurement_class: B, evidence_limit: "3D and assistance/input uncertain", target_status: ABSENT}
    target_types: [MEASURED_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: CROSS-HI-001-REF, class: MEASURED_TARGET, rule: "Compare qualified flight/zone observables when populated"}
      - {criterion_id: CROSS-HI-001-REG, class: REGRESSION, rule: "Preserve lofted pass, heading, and keeper reach behavior"}
    known_uncertainty: ["Reference cross variant unknown", "Airborne reconstruction uncertain"]
    failure_modes: ["fixed destination arc", "target selection alters in-flight ball", "3D precision overclaimed"]
    regression_dependencies: [PASS-LOFT-001, HEAD-FREE-001, GK-HIGH-001]

  - test_id: SHOT-PWR-001
    gameplay_property: "Shot input power changes the physical strike outcome."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Same shooter, position, body orientation, aim, and stable ball state"]
    controlled_inputs: ["Repeat declared shot-power input levels with matched context and seeds"]
    state_to_record: ["input/action/contact timestamps", "shooter heading/foot/capability", "outgoing 3D ball state/path"]
    metrics: ["initial speed", "apex/height", "flight time", "angular and endpoint error", "preparation time"]
    reference_evidence: {behavioral: "R1 SHOT-PWR-001; power bar and Kicking Power dimensions exist", measurement_class: C, evidence_limit: "Public footage cannot recover power-bar ladder", target_status: ABSENT}
    target_types: [UNKNOWN, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: SHOT-PWR-001-IMPULSE, class: HARD_INVARIANT, rule: "Shot is an explicit contact impulse plus spin/error, never a guided outcome"}
      - {criterion_id: SHOT-PWR-001-CAUSAL, class: UNKNOWN, rule: "Power response is an engine diagnostic until controlled PES input capture"}
      - {criterion_id: SHOT-PWR-001-REG, class: REGRESSION, rule: "Compare response surface, error, and action latency versus best"}
    known_uncertainty: ["PES power input and assistance unknown", "No formula supports power/error coupling"]
    failure_modes: ["invented power thresholds", "power automatically reduces accuracy", "shot homes toward goal"]
    regression_dependencies: [SHOT-IND-001, BALL-SPN-002, CTRL-ACT-001]

  - test_id: SHOT-IND-001
    gameplay_property: "Shooting-power capability can affect strike output independently of other capabilities."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Matched fictional shooters differing only in shooting-power capability"]
    controlled_inputs: ["Identical aim/power/action trace and geometry", "Seed batches"]
    state_to_record: ["capability profile", "action/contact state", "outgoing ball state"]
    metrics: ["initial-speed distribution", "preparation duration", "trajectory and error deltas"]
    reference_evidence: {behavioral: "R1 SHOT-IND-001; players with differing Kicking Power are observable", measurement_class: C, evidence_limit: "Public player comparison is confounded", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: SHOT-IND-001-CAUSAL, class: UNKNOWN, rule: "No PES capability curve until controlled matched capture"}
      - {criterion_id: SHOT-IND-001-REG, class: REGRESSION, rule: "Report isolation/coupling changes versus best"}
    known_uncertainty: ["External rating mapping unknown", "Other PES skills/animations confound"]
    failure_modes: ["direct linear rating-to-speed map", "capability changes unrelated accuracy without evidence", "real players used as isolated archetypes"]
    regression_dependencies: [SHOT-PWR-001, SHOT-SWV-001]

  - test_id: SHOT-SWV-001
    gameplay_property: "Swerve capability may affect controllable shot curvature."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Matched shooters differing only in curve/swerve capability"]
    controlled_inputs: ["Identical curved-shot input, geometry, power, and seeds"]
    state_to_record: ["capabilities", "contact linear/angular output", "3D ball path"]
    metrics: ["spin proxy/angular velocity", "lateral deviation", "curvature by segment", "paired capability delta"]
    reference_evidence: {behavioral: "R1 SHOT-SWV-001; Swerve is a separate roster dimension", measurement_class: C, evidence_limit: "Controlled comparable strikes absent", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: SHOT-SWV-001-CAUSAL, class: UNKNOWN, rule: "Engine sensitivity only; no PES mapping claim"}
      - {criterion_id: SHOT-SWV-001-REG, class: REGRESSION, rule: "Preserve base ball-spin symmetry and shot-power behavior"}
    known_uncertainty: ["PES input/spin unobserved", "Attribute mapping unknown"]
    failure_modes: ["swerve rating directly becomes constant curve", "power confounded", "spin-independent lateral force"]
    regression_dependencies: [BALL-SPN-001, BALL-SPN-002, SHOT-PWR-001]

  - test_id: HEAD-FREE-001
    gameplay_property: "An unopposed header depends on reachable ball geometry, jump/contact timing, and execution."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: REQUIRED}
    initial_scenario: ["One attacker under a repeatable cross with no opponent"]
    controlled_inputs: ["Declared heading/jump action timing and aim", "Matched cross state"]
    state_to_record: ["ball 3D state", "vertical reach/action state", "body heading", "head contact event", "outgoing ball state"]
    metrics: ["jump/action onset", "contact time/height", "reach margin", "outgoing speed/direction/error"]
    reference_evidence: {behavioral: "R1 HEAD-FREE-001; Header and Jump dimensions; positioning/timing matter", measurement_class: B, evidence_limit: "Input timing and public 3D height uncertain", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: HEAD-FREE-001-CONTACT, class: HARD_INVARIANT, rule: "Header requires a feasible recorded head/reach contact; no probability-only goal outcome"}
      - {criterion_id: HEAD-FREE-001-REF, class: MEASURED_TARGET, rule: "Compare robust timing/contact/path quantities with stated 3D uncertainty"}
      - {criterion_id: HEAD-FREE-001-VIS, class: PERCEPTUAL_TARGET, rule: "Rendered jump/head contact must agree with canonical event; rubric TBD"}
      - {criterion_id: HEAD-FREE-001-REG, class: REGRESSION, rule: "Preserve cross flight and ordinary ball contacts"}
    known_uncertainty: ["Vertical player model deferred", "Reference heights and input timing weak"]
    failure_modes: ["Header reduced to goal probability", "contact outside reach", "visual head misses ball", "Header and Jump collapsed"]
    regression_dependencies: [CROSS-HI-001, HEAD-DUEL-001, BALL-BNC-001]

  - test_id: HEAD-DUEL-001
    gameplay_property: "A contested header resolves from reach, position, timing, and contact rather than a prefixed winner."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: REQUIRED}
    initial_scenario: ["Attacker and defender share a controlled aerial landing/contact region"]
    controlled_inputs: ["Matched action timing matrix", "Vary relative position/reach capabilities explicitly"]
    state_to_record: ["both actors' ground/reach/action/contact/balance state", "ball 3D state", "contact order"]
    metrics: ["contact winner/surface/time", "reach margins", "body displacement", "outgoing ball state", "no-contact rate"]
    reference_evidence: {behavioral: "R1 HEAD-DUEL-001; jump, position, and physical interaction", measurement_class: B, evidence_limit: "3D and contact-selection ambiguity", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: HEAD-DUEL-001-CONT, class: HARD_INVARIANT, rule: "Winner follows ordered feasible contacts; no stat-only winner assignment"}
      - {criterion_id: HEAD-DUEL-001-REF, class: MEASURED_TARGET, rule: "Compare observable winner/timing/displacement distributions when populated"}
      - {criterion_id: HEAD-DUEL-001-VIS, class: PERCEPTUAL_TARGET, rule: "Frame strip verifies credible spatial contact and body interaction; rubric TBD"}
      - {criterion_id: HEAD-DUEL-001-REG, class: REGRESSION, rule: "Preserve free header and physical-contact behavior"}
    known_uncertainty: ["Reference contact selection hidden", "Occlusion and z reconstruction"]
    failure_modes: ["higher stat wins automatically", "both contact simultaneously without ordered event", "ball snaps to chosen actor", "visual overlap"]
    regression_dependencies: [HEAD-FREE-001, PHY-SHLD-001, CROSS-HI-001]
```

### 7.4 Tackles, interceptions, and goalkeepers

```yaml
tests:
  - test_id: TACK-ST-001
    gameplay_property: "A standing tackle is a committed prepare-active-recover action with finite reach."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: REQUIRED}
    initial_scenario: ["Defender frontal to a ball carrier at declared distance and relative speed"]
    controlled_inputs: ["Standing-tackle command at a declared tick", "Geometry matrix and seed batches"]
    state_to_record: ["command/action phases", "defender kinematics", "leg/body contact volumes/events", "ball/carrier state", "rule events"]
    metrics: ["command-to-active latency", "reach", "active-window duration", "contact order", "ball deflection", "recovery time"]
    reference_evidence: {behavioral: "R1 TACK-ST-001; lunge/contact/recovery action documented", measurement_class: B, evidence_limit: "PES command time and internal hitbox/window hidden", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: TACK-ST-001-PHASE, class: HARD_INVARIANT, rule: "Contact eligibility is confined to explicit action state and ordered geometry; recovery prevents permanent collider"}
      - {criterion_id: TACK-ST-001-REF, class: MEASURED_TARGET, rule: "Compare visible onset/contact/recovery and reach envelope when target exists"}
      - {criterion_id: TACK-ST-001-VIS, class: PERCEPTUAL_TARGET, rule: "Rendered tackle/contact aligns with canonical active event; rubric TBD"}
      - {criterion_id: TACK-ST-001-REG, class: REGRESSION, rule: "Preserve locomotion, contact, foul, and ball continuity"}
    known_uncertainty: ["Reference hitbox and command frame unknown", "Foul policy TBD"]
    failure_modes: ["omnidirectional always-active collider", "no recovery cost", "visual/canonical contact mismatch", "possession awarded without contact"]
    regression_dependencies: [PHY-SHLD-001, TACK-ANG-001, BALL-IND-001]

  - test_id: TACK-SL-001
    gameplay_property: "A sliding tackle covers space, has a finite active window, and commits the defender to recovery."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: REQUIRED}
    initial_scenario: ["Ball carrier crosses perpendicular to defender at controlled offset/speed"]
    controlled_inputs: ["Slide-tackle command at declared tick", "Approach/timing matrix"]
    state_to_record: ["slide phases and kinematics", "leg/body contact events", "ball state", "carrier contact", "rule/foul event"]
    metrics: ["slide distance/duration", "active window", "contact height/order", "ball deflection", "recovery time", "foul outcome"]
    reference_evidence: {behavioral: "R1 TACK-SL-001; timing/risk and commitment documented", measurement_class: B, evidence_limit: "Command and collision internals hidden", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: TACK-SL-001-PHASE, class: HARD_INVARIANT, rule: "Slide contact and movement arise from explicit ordered action phases; no teleport or permanent active collider"}
      - {criterion_id: TACK-SL-001-REF, class: MEASURED_TARGET, rule: "Compare observable distance/contact/recovery envelope when populated"}
      - {criterion_id: TACK-SL-001-VIS, class: PERCEPTUAL_TARGET, rule: "Rendered slide and contact surfaces agree with state; rubric TBD"}
      - {criterion_id: TACK-SL-001-REG, class: REGRESSION, rule: "Preserve standing tackle, contacts, and rules behavior"}
    known_uncertainty: ["Reference foul context and command unknown", "Vertical contact weakly observable"]
    failure_modes: ["slide teleports", "ball-only rule decision", "touching ball suppresses all later foul contact", "instant recovery"]
    regression_dependencies: [TACK-ST-001, TACK-ANG-001, PHY-SHLD-001]

  - test_id: TACK-ANG-001
    gameplay_property: "Tackle outcome varies with controlled approach angle and ball/body access."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Matched carrier/defender geometry over declared approach angles"]
    controlled_inputs: ["Identical tackle timing/action with angle as intervention", "Seed batches"]
    state_to_record: ["relative geometry", "contact order/surfaces", "ball and player response", "rule events"]
    metrics: ["ball-first/body-first/no-contact rates", "ball velocity change", "foul/event rate", "recovery"]
    reference_evidence: {behavioral: "R1 TACK-ANG-001; proposed 0/30/60/90-degree experiment", measurement_class: C, evidence_limit: "Controlled PES angle curve absent", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: TACK-ANG-001-CAUSAL, class: UNKNOWN, rule: "Angle response is an engine diagnostic; no PES success/foul threshold may be invented"}
      - {criterion_id: TACK-ANG-001-REG, class: REGRESSION, rule: "Report outcome-surface changes and neighboring tackle regressions"}
    known_uncertainty: ["Rules/foul thresholds under-researched", "Contact geometry TBD"]
    failure_modes: ["binary angle cutoff invented", "angle ignored", "success based only on possession outcome"]
    regression_dependencies: [TACK-ST-001, TACK-SL-001, PHY-SHLD-001]

  - test_id: INT-PASS-001
    gameplay_property: "A defender near a pass lane reacts and reaches only when the ball is geometrically/temporally reachable."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Defender laterally offset from a known ground-pass lane", "Stable role/tactical assignment"]
    controlled_inputs: ["Pass at declared tick", "Matrix of lane offset, defender orientation, and observed ball speed"]
    state_to_record: ["ball trajectory", "defender perception/decision/intention", "reach-time estimate", "kinematics/action/contact", "role state"]
    metrics: ["trajectory-crossing to movement latency", "lateral reach", "control margin", "contact/interception rate", "false commitment rate"]
    reference_evidence: {behavioral: "R1 INT-PASS-001; proactive but imperfect interception", measurement_class: B, evidence_limit: "Decision trigger and awareness hidden", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: INT-PASS-001-REACH, class: HARD_INVARIANT, rule: "Interception contact must be reachable under the same locomotion/contact model; AI cannot write ball/position directly"}
      - {criterion_id: INT-PASS-001-REF, class: MEASURED_TARGET, rule: "Compare observable reaction/reach/contact distribution with uncertainty; do not claim hidden awareness threshold"}
      - {criterion_id: INT-PASS-001-REG, class: REGRESSION, rule: "Preserve pass physics, shape, and non-omniscient behavior"}
    known_uncertainty: ["Reference trigger/role/input unknown", "Public failures show external validity but not rule"]
    failure_modes: ["omniscient destination read", "teleport/reach inflation", "every reachable-looking pass intercepted", "role ignored"]
    regression_dependencies: [PASS-LOW-001, INT-FAST-001, DEF-SHAPE-001]

  - test_id: INT-FAST-001
    gameplay_property: "Pass speed changes the temporal interception opportunity under matched geometry."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Same defender and lane geometry over controlled pass initial speeds"]
    controlled_inputs: ["Vary pass speed only through explicit contact states", "Matched seeds and tactical state"]
    state_to_record: ["ball arrival path/time", "defender decision/reach/action", "contact outcome"]
    metrics: ["control margin", "reaction/movement latency", "interception rate by measured speed", "closest approach"]
    reference_evidence: {behavioral: "R1 INT-FAST-001; fast passes reduce opportunity, with observed imperfections", measurement_class: C, evidence_limit: "Matched controlled PES speeds absent", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: INT-FAST-001-CAUSAL, class: UNKNOWN, rule: "Response curve is diagnostic only until controlled reference exists"}
      - {criterion_id: INT-FAST-001-REG, class: REGRESSION, rule: "Report reachability and pass-physics changes versus best"}
    known_uncertainty: ["Awareness/commitment interaction unknown", "Speed bins must not be invented as gates"]
    failure_modes: ["pass speed ignored", "hard speed cutoff", "AI uses future endpoint without travel time"]
    regression_dependencies: [INT-PASS-001, PASS-LOW-001, LOC-ACC-001]

  - test_id: GK-REA-001
    gameplay_property: "A set goalkeeper has an observable response sequence to a sudden shot."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: REQUIRED}
    initial_scenario: ["Goalkeeper in declared set pose; shooter/ball at fixed geometry"]
    controlled_inputs: ["Shot contact at declared tick with repeated directions/speeds", "Keeper perception state explicit"]
    state_to_record: ["shot contact", "keeper perception/decision/action/reach/kinematics", "body heading", "save contact"]
    metrics: ["shot-contact to first keeper motion", "decision/action onset", "takeoff/reach", "save/no-save outcome"]
    reference_evidence: {behavioral: "R1 GK-REA-001; immediate/reworked keeper reactions", measurement_class: B, evidence_limit: "Visible latency may include anticipation before shot contact", target_status: ABSENT}
    target_types: [MEASURED_TARGET, PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: GK-REA-001-REF, class: MEASURED_TARGET, rule: "Compare apparent response sequence; never label it pure AI reaction time without perception evidence"}
      - {criterion_id: GK-REA-001-VIS, class: PERCEPTUAL_TARGET, rule: "Keeper pose/action transition and contact plausibility require browser rubric"}
      - {criterion_id: GK-REA-001-REG, class: REGRESSION, rule: "Preserve wrong-foot, leg-save, and recovery behavior"}
    known_uncertainty: ["Reference anticipation unknown", "Keeper thresholds under-researched"]
    failure_modes: ["apparent latency mislabeled cognition", "keeper reads final outcome omnisciently", "animation starts before state decision without telemetry"]
    regression_dependencies: [GK-WF-001, GK-LEG-001, GK-REC-001]

  - test_id: GK-WF-001
    gameplay_property: "A goalkeeper moving one way can correct toward a shot in the opposite direction."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: REQUIRED}
    initial_scenario: ["Keeper has controlled lateral velocity/weight shift before shot"]
    controlled_inputs: ["Matched shots toward and against keeper motion", "Repeated speeds/positions and seeds"]
    state_to_record: ["keeper velocity/body/support/action state", "shot/contact state", "reversal and reach path"]
    metrics: ["reversal latency", "minimum/retained speed", "reach margin", "save probability distribution"]
    reference_evidence: {behavioral: "R1 GK-WF-001; wrong-foot reactions explicitly described", measurement_class: C, evidence_limit: "Repeatable known pre-motion/shot states require controlled capture", target_status: ABSENT}
    target_types: [UNKNOWN, PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: GK-WF-001-CAUSAL, class: UNKNOWN, rule: "No PES correction threshold/curve until controlled capture"}
      - {criterion_id: GK-WF-001-VIS, class: PERCEPTUAL_TARGET, rule: "Browser diagnostic checks weight-shift/reversal plausibility; no pass gate until rubric validation"}
      - {criterion_id: GK-WF-001-REG, class: REGRESSION, rule: "Preserve ordinary reaction and reach"}
    known_uncertainty: ["Controlled reference absent", "Support-foot pose presentation-dependent"]
    failure_modes: ["instant direction reversal", "same reach regardless of initial motion", "visual support contradicts canonical velocity"]
    regression_dependencies: [GK-REA-001, LOC-REV-001]

  - test_id: GK-LEG-001
    gameplay_property: "A close low shot may be saved by an explicit foot/leg contact with a contextual rebound."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: REQUIRED}
    initial_scenario: ["Keeper set; repeatable low close shot enters leg-reach region"]
    controlled_inputs: ["Declared shot state and placement matrix"]
    state_to_record: ["keeper action/reach/contact surface", "incoming/outgoing ball state", "recovery state"]
    metrics: ["contact point/time/surface", "parry angle/energy ratio", "recovery time", "second-ball location"]
    reference_evidence: {behavioral: "R1 GK-LEG-001; foot saves documented/observed", measurement_class: B, evidence_limit: "3D rebound and selected animation uncertain", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: GK-LEG-001-CONTACT, class: HARD_INVARIANT, rule: "Save outcome requires an ordered feasible leg/foot contact event and continuous rebound"}
      - {criterion_id: GK-LEG-001-REF, class: MEASURED_TARGET, rule: "Compare contact/rebound observables when target exists"}
      - {criterion_id: GK-LEG-001-VIS, class: PERCEPTUAL_TARGET, rule: "Rendered limb and ball contact agree with event; rubric TBD"}
      - {criterion_id: GK-LEG-001-REG, class: REGRESSION, rule: "Preserve reaction, parry, and recovery"}
    known_uncertainty: ["Reference 3D/occlusion", "Keeper architecture deferred"]
    failure_modes: ["save without contact", "generic catch used", "rebound direction detached from surface", "visual miss"]
    regression_dependencies: [GK-REA-001, GK-PARRY-001, GK-REC-001]

  - test_id: GK-PARRY-001
    gameplay_property: "Parry direction/outcome varies with incoming state and contacted body surface."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: REQUIRED}
    initial_scenario: ["Matched shots target hand/arm, leg, and torso contact regions"]
    controlled_inputs: ["Hold incoming speed/spin geometry as comparable as feasible", "Declare keeper action state"]
    state_to_record: ["incoming/outgoing ball state", "keeper surface geometry/velocity", "contact impulse/event", "recovery/control"]
    metrics: ["outgoing angle/speed", "energy ratio", "surface-conditioned distribution", "second-ball danger"]
    reference_evidence: {behavioral: "R1 GK-PARRY-001; official evidence says body part affects deflection", measurement_class: B, evidence_limit: "Public 3D, occlusion, and nonphysical correction uncertain", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: GK-PARRY-001-CONTACT, class: HARD_INVARIANT, rule: "Parry is an explicit surface contact; outgoing state and any skill correction are inspectable"}
      - {criterion_id: GK-PARRY-001-REF, class: MEASURED_TARGET, rule: "Compare surface-conditioned rebound observables with uncertainty when populated"}
      - {criterion_id: GK-PARRY-001-VIS, class: PERCEPTUAL_TARGET, rule: "Browser frame strip validates contacted surface and rebound continuity"}
      - {criterion_id: GK-PARRY-001-REG, class: REGRESSION, rule: "Preserve ball continuity and keeper recovery"}
    known_uncertainty: ["Nonphysical PES correction possible", "Reference contact surface can be occluded"]
    failure_modes: ["all surfaces share fixed rebound", "ball teleports", "hidden correction absent from telemetry", "visual surface mismatch"]
    regression_dependencies: [BALL-IND-001, GK-LEG-001, GK-REC-001]

  - test_id: GK-REC-001
    gameplay_property: "A goalkeeper can recover from a grounded save and attempt a second action."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: REQUIRED}
    initial_scenario: ["First save creates a repeatable reachable rebound while keeper is grounded"]
    controlled_inputs: ["Script initial shot/rebound geometry", "Second shot/touch occurs at declared delays"]
    state_to_record: ["landing/grounded/recovery/action phases", "keeper kinematics/reach", "both ball contacts"]
    metrics: ["landing-to-recovery", "recovery-to-second-action", "second reach margin", "save/contact outcome"]
    reference_evidence: {behavioral: "R1 GK-REC-001; chained action after falling explicitly described", measurement_class: B, evidence_limit: "Natural initial states vary", target_status: ABSENT}
    target_types: [MEASURED_TARGET, PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: GK-REC-001-REF, class: MEASURED_TARGET, rule: "Compare phase timing distributions under equivalent observable initial states"}
      - {criterion_id: GK-REC-001-VIS, class: PERCEPTUAL_TARGET, rule: "Rendered grounded/recovery transition and second contact require rubric review"}
      - {criterion_id: GK-REC-001-REG, class: REGRESSION, rule: "Preserve first-save contact/rebound behavior"}
    known_uncertainty: ["Reference starting pose/stamina differs", "Keeper recovery thresholds TBD"]
    failure_modes: ["instant stand", "second save while action state unreachable", "animation-only recovery changes gameplay timing"]
    regression_dependencies: [GK-REA-001, GK-LEG-001, GK-PARRY-001]

  - test_id: GK-HIGH-001
    gameplay_property: "A goalkeeper may take off and catch or parry a reachable high cross."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: REQUIRED}
    initial_scenario: ["Repeatable high cross enters keeper/attacker region in penalty area"]
    controlled_inputs: ["Cross trajectories and congestion matrix", "Keeper tactics/capabilities explicit"]
    state_to_record: ["keeper decision/takeoff/reach/contact/catch state", "ball 3D path", "nearby actors and pressure"]
    metrics: ["decision/takeoff timing", "reach margin/contact height", "catch/parry/no-action outcome", "recovery"]
    reference_evidence: {behavioral: "R1 GK-HIGH-001; stronger claims/catches observed", measurement_class: B, evidence_limit: "Aerial geometry and decision threshold uncertain", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: GK-HIGH-001-REACH, class: HARD_INVARIANT, rule: "Claim/parry requires a feasible recorded reach/contact; catch state never teleports the ball"}
      - {criterion_id: GK-HIGH-001-REF, class: MEASURED_TARGET, rule: "Compare timing/contact/outcome distribution with stated aerial uncertainty"}
      - {criterion_id: GK-HIGH-001-VIS, class: PERCEPTUAL_TARGET, rule: "Browser review validates aerial pose, contact, and congestion continuity"}
      - {criterion_id: GK-HIGH-001-REG, class: REGRESSION, rule: "Preserve crosses, headers, and keeper ground actions"}
    known_uncertainty: ["Decision policy and 3D reference unknown", "Goalkeeper subsystem deferred before full-match milestone"]
    failure_modes: ["keeper teleports to ball", "catch without contact", "automatic claim ignores congestion", "visual ball/hand mismatch"]
    regression_dependencies: [CROSS-HI-001, HEAD-DUEL-001, GK-PARRY-001]
```

### 7.5 Off-ball movement, tactics, AI, and transitions

```yaml
tests:
  - test_id: OFF-RUN-001
    gameplay_property: "An attacker initiates a legible run into space while respecting role and reachability."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Ball carrier in midfield faces a settled defensive line; attacker begins near role anchor"]
    controlled_inputs: ["Repeat ball-carrier orientation/position and defensive geometry", "Disable explicit user run trigger unless testing it"]
    state_to_record: ["attacker role/anchor/utility scores/decision", "carrier orientation", "defensive line", "run target/path", "gesture presentation if any"]
    metrics: ["run trigger time", "run angle", "distance to line", "depth/line crossing", "abort/continue timing", "passing-lane value"]
    reference_evidence: {behavioral: "R1 OFF-RUN-001; Player ID and observed legible forward runs", measurement_class: B, evidence_limit: "Autonomous versus user-triggered cause may be unknown", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: OFF-RUN-001-AUTH, class: HARD_INVARIANT, rule: "AI sets intention/target only; locomotion determines achievable path and AI never writes position"}
      - {criterion_id: OFF-RUN-001-REF, class: MEASURED_TARGET, rule: "Compare observable run geometry/timing when target exists without overclaiming trigger cause"}
      - {criterion_id: OFF-RUN-001-REG, class: REGRESSION, rule: "Preserve shape, support, offside/rule state where implemented, and pass reachability"}
    known_uncertainty: ["Reference trigger cause and tactic unknown", "Offside implementation deferred"]
    failure_modes: ["all attackers sprint simultaneously", "role anchor ignored", "position teleport", "run responds to hidden future pass"]
    regression_dependencies: [OFF-SUP-001, DEF-SHAPE-001, PASS-RUN-001]

  - test_id: OFF-SUP-001
    gameplay_property: "Teammates relocate to create support and passing lines without abandoning formation."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Settled midfield possession with declared formation and role anchors"]
    controlled_inputs: ["Script ball circulation across zones", "Keep tactic profile/version fixed"]
    state_to_record: ["anchors/roles/utility decisions", "team/player positions", "ball zone", "reach/passing graph"]
    metrics: ["support distance/angle", "relocation rate", "new lane count/value", "anchor deviation", "neighbor-distance distribution"]
    reference_evidence: {behavioral: "R1 OFF-SUP-001; Team ID/gameplay support movement", measurement_class: B, evidence_limit: "Tactical context and intent incomplete", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: OFF-SUP-001-AUTH, class: HARD_INVARIANT, rule: "Support policy emits inspectable targets through normal locomotion; no direct position write"}
      - {criterion_id: OFF-SUP-001-REF, class: MEASURED_TARGET, rule: "Compare spatial relocation distributions under qualified visible context"}
      - {criterion_id: OFF-SUP-001-REG, class: REGRESSION, rule: "Preserve formation, compactness, and transition behavior"}
    known_uncertainty: ["Reference playing style/tactics unknown", "Broadcast crop may omit players"]
    failure_modes: ["swarm around ball", "static formation", "passing line created by teleport", "individual style conflated with ability"]
    regression_dependencies: [OFF-RUN-001, DEF-SHAPE-001, TACT-SUP-001]

  - test_id: DEF-SHAPE-001
    gameplay_property: "Centre-backs preserve defensive structure instead of chasing arbitrarily."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Settled defence; attacker approaches central area while ball remains outside immediate tackle reach"]
    controlled_inputs: ["Script attacker/ball path across repeatable zones", "Fix formation/tactic profile"]
    state_to_record: ["defensive roles/anchors/assignments", "positions and line metrics", "press/cover decisions", "ball/carrier state"]
    metrics: ["defensive-line depth/variance", "CB spacing", "chase distance", "anchor deviation", "gap/compactness"]
    reference_evidence: {behavioral: "R1 DEF-SHAPE-001; centre-backs observed preserving position", measurement_class: B, evidence_limit: "Full team may be cropped and tactics unknown", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: DEF-SHAPE-001-AUTH, class: HARD_INVARIANT, rule: "Formation/role layer precedes individual pressing and all movement passes through locomotion"}
      - {criterion_id: DEF-SHAPE-001-REF, class: MEASURED_TARGET, rule: "Compare visible shape descriptors only within qualified camera/tactic strata"}
      - {criterion_id: DEF-SHAPE-001-REG, class: REGRESSION, rule: "Ball-chase mutant must fail; preserve interception and pressure"}
    known_uncertainty: ["Tactics/crop confound reference", "AI calibration absent"]
    failure_modes: ["all defenders chase ball", "CB steps without cover reassignment", "shape metric optimized while roles become implausible"]
    regression_dependencies: [DEF-SHIFT-001, PRESS-001, INT-PASS-001, OFF-SUP-001]

  - test_id: DEF-SHIFT-001
    gameplay_property: "The defensive block shifts and deforms laterally after the ball changes sides."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Settled defensive block with ball on one flank"]
    controlled_inputs: ["Move/pass ball to opposite flank on a repeatable timeline", "Fix tactics/formation"]
    state_to_record: ["all player positions/anchors/roles", "team centroid/width/length/compactness", "ball zone", "assignment changes"]
    metrics: ["centroid shift", "width/deformation", "lag to ball shift", "line/gap variance", "role-switch events"]
    reference_evidence: {behavioral: "R1 DEF-SHIFT-001; block recenters/deforms", measurement_class: B, evidence_limit: "Formation/tactics and full visibility uncertain", target_status: ABSENT}
    target_types: [MEASURED_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: DEF-SHIFT-001-REF, class: MEASURED_TARGET, rule: "Compare visible world-space team geometry under equivalent ball-zone transitions"}
      - {criterion_id: DEF-SHIFT-001-REG, class: REGRESSION, rule: "Preserve settled shape, compactness, and pressing assignments"}
    known_uncertainty: ["Reference players may be off-screen", "Tactic settings unknown"]
    failure_modes: ["rigid formation translation", "instant whole-block teleport", "width collapses into swarm", "roles cross incoherently"]
    regression_dependencies: [DEF-SHAPE-001, PRESS-001, TACT-COMP-001]

  - test_id: PRESS-001
    gameplay_property: "Frontline pressure assigns press and cover responsibilities rather than sending all players to the ball."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Opponent starts stable possession in defensive build-up"]
    controlled_inputs: ["Fixed pressure tactic profile", "Repeat ball-carrier routes and passing options"]
    state_to_record: ["press/cover/lane assignments", "utility decisions", "player/team geometry", "carrier state"]
    metrics: ["first-pressure latency", "presser count", "distance closed over time", "cover/lane occupancy", "block compression"]
    reference_evidence: {behavioral: "R1 PRESS-001; frontline pressure option exists", measurement_class: B, evidence_limit: "Natural episodes do not identify slider mapping", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: PRESS-001-COORD, class: HARD_INVARIANT, rule: "Press, cover, and block responsibilities are explicit; AI movement remains locomotion-constrained"}
      - {criterion_id: PRESS-001-REF, class: MEASURED_TARGET, rule: "Compare natural pressure geometry/timing without inferring tactic slider value"}
      - {criterion_id: PRESS-001-REG, class: REGRESSION, rule: "Preserve shape and avoid swarm behavior"}
    known_uncertainty: ["Reference tactic setting unknown", "Decision cadence TBD"]
    failure_modes: ["all players chase carrier", "pressers teleport or exceed locomotion", "no lane cover", "generic pressure called slider mapping"]
    regression_dependencies: [DEF-SHAPE-001, DEF-SHIFT-001, TRANS-AD-001]

  - test_id: PRESS-GG-001
    gameplay_property: "An enabled counterpress instruction may trigger coordinated immediate pressure after a loss."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Team loses controlled possession in opponent half with counterpress instruction on/off"]
    controlled_inputs: ["Matched loss tick/location and players", "Instruction is the isolated intervention"]
    state_to_record: ["possession/control evidence", "team phase", "press assignments", "positions/velocities", "tactic state"]
    metrics: ["loss-to-first-response", "presser count", "block compression", "ball-recovery/escape events"]
    reference_evidence: {behavioral: "R1 PRESS-GG-001; Gegenpress instruction exists", measurement_class: C, evidence_limit: "Known instruction state and repeated losses absent in public data", target_status: ABSENT}
    target_types: [UNKNOWN, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: PRESS-GG-001-PHASE, class: HARD_INVARIANT, rule: "Possession loss enters explicit transition phase before settled defence; instruction is recorded state"}
      - {criterion_id: PRESS-GG-001-CAUSAL, class: UNKNOWN, rule: "Instruction effect/threshold is diagnostic until controlled PES on/off capture"}
      - {criterion_id: PRESS-GG-001-REG, class: REGRESSION, rule: "Compare instruction on/off engine behavior and ordinary pressure"}
    known_uncertainty: ["PES duration/trigger rules unknown", "Possession policy provisional"]
    failure_modes: ["instant settled defence", "unrecorded tactic toggle", "all players swarm", "generic post-loss pressure mislabeled Gegenpress"]
    regression_dependencies: [PRESS-REC-001, PRESS-001, TRANS-AD-001]

  - test_id: PRESS-REC-001
    gameplay_property: "A counterpress can be abandoned and the team can recover structure after the first wave is beaten."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Counterpress active after loss; opponent escapes the declared pressure region"]
    controlled_inputs: ["Repeat escape route/timing with instruction on", "Tactic and phase state explicit"]
    state_to_record: ["phase transitions", "press/recover assignments", "anchors and player geometry", "velocities"]
    metrics: ["abandonment tick", "retreat speed", "shape-error trajectory", "time to settled structure"]
    reference_evidence: {behavioral: "R1 PRESS-REC-001; proposed recovery behavior", measurement_class: C, evidence_limit: "PES abandonment rule not documented and instruction state required", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: PRESS-REC-001-CAUSAL, class: UNKNOWN, rule: "No PES abandonment threshold/duration until controlled evidence"}
      - {criterion_id: PRESS-REC-001-REG, class: REGRESSION, rule: "Preserve counterpress onset, settled shape, and transition phase integrity"}
    known_uncertainty: ["Trigger and duration unknown", "Shape targets provisional"]
    failure_modes: ["press never ends", "instant formation reset", "recovery teleports", "phase oscillation"]
    regression_dependencies: [PRESS-GG-001, DEF-SHAPE-001, TRANS-AD-001]

  - test_id: TACT-COMP-001
    gameplay_property: "Compactness setting may alter collective distances and occupied area."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Matched settled team states over declared compactness configuration levels"]
    controlled_inputs: ["Change compactness setting only", "Repeat ball zones and phases"]
    state_to_record: ["tactic config", "anchors/positions", "centroid/width/length/gaps", "roles"]
    metrics: ["width", "line gaps", "convex-hull area", "nearest-neighbor distances", "zone-conditioned deltas"]
    reference_evidence: {behavioral: "R1 TACT-COMP-001; compactness slider exists", measurement_class: C, evidence_limit: "Known settings/repeated PES states required", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: TACT-COMP-001-CAUSAL, class: UNKNOWN, rule: "Engine sensitivity only; slider mapping/nonlinearity unknown"}
      - {criterion_id: TACT-COMP-001-REG, class: REGRESSION, rule: "Compare shape, support, and pressing behavior versus best"}
    known_uncertainty: ["PES slider semantics/interactions unknown"]
    failure_modes: ["linear mapping asserted", "compactness changes player speed", "area optimized by collapsing roles"]
    regression_dependencies: [DEF-SHAPE-001, DEF-SHIFT-001, TACT-SUP-001]

  - test_id: TACT-DLINE-001
    gameplay_property: "Defensive-line setting may alter the settled last-line height."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Matched settled defence over declared defensive-line settings"]
    controlled_inputs: ["Change defensive-line setting only", "Repeat ball zones, mentality, and phases"]
    state_to_record: ["tactic state", "last-line roles/positions/anchors", "ball zone", "mentality"]
    metrics: ["line distance from own goal", "line variance", "gap to midfield", "zone-conditioned delta"]
    reference_evidence: {behavioral: "R1 TACT-DLINE-001; Defensive Line setting exists", measurement_class: C, evidence_limit: "Known repeated settings required; mentality interaction", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: TACT-DLINE-001-CAUSAL, class: UNKNOWN, rule: "No PES mapping until controlled tactic capture"}
      - {criterion_id: TACT-DLINE-001-REG, class: REGRESSION, rule: "Preserve shape, off-ball runs, and transition behavior"}
    known_uncertainty: ["Interaction with mentality/ball zone unknown"]
    failure_modes: ["single absolute line value", "setting ignores context", "line movement teleports"]
    regression_dependencies: [DEF-SHAPE-001, OFF-RUN-001, TRANS-AD-001]

  - test_id: TACT-SUP-001
    gameplay_property: "Support-range setting may alter teammate distances and passing graph around the ball."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Matched settled possession over declared support-range levels"]
    controlled_inputs: ["Change support range only", "Repeat ball circulation and phase"]
    state_to_record: ["tactic state", "positions/anchors/roles", "ball zone", "passing/reach graph"]
    metrics: ["neighbor distances", "support angle/density", "passing-edge lengths/count", "anchor deviation"]
    reference_evidence: {behavioral: "R1 TACT-SUP-001; Support Range setting exists", measurement_class: C, evidence_limit: "Controlled known settings absent", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: TACT-SUP-001-CAUSAL, class: UNKNOWN, rule: "No PES slider curve until controlled capture"}
      - {criterion_id: TACT-SUP-001-REG, class: REGRESSION, rule: "Preserve formation, support movement, and compactness"}
    known_uncertainty: ["Mapping may be nonlinear/contextual"]
    failure_modes: ["support range becomes uniform radius", "roles ignored", "setting directly changes pass speed"]
    regression_dependencies: [OFF-SUP-001, TACT-COMP-001, PASS-RUN-001]

  - test_id: TACT-TIKI-001
    gameplay_property: "An enabled short-possession instruction may change support and circulation preferences."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Matched settled possession with instruction off/on"]
    controlled_inputs: ["Instruction is isolated intervention", "Repeat seeds, opponents, and ball zones"]
    state_to_record: ["instruction/tactic state", "AI utilities/decisions", "positions", "pass/action events"]
    metrics: ["pass-length distribution", "support density", "movement/relocation", "possession sequence structure"]
    reference_evidence: {behavioral: "R1 TACT-TIKI-001; Tiki-taka instruction exists", measurement_class: C, evidence_limit: "On/off PES comparison absent", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: TACT-TIKI-001-CAUSAL, class: UNKNOWN, rule: "Instruction behavior is diagnostic until controlled reference"}
      - {criterion_id: TACT-TIKI-001-REG, class: REGRESSION, rule: "Preserve ordinary support, tempo ecology, and formation"}
    known_uncertainty: ["Mechanism and interactions unknown"]
    failure_modes: ["instruction merely forces short passes", "ball physics changes", "support swarm", "match context ignored"]
    regression_dependencies: [OFF-SUP-001, TACT-SUP-001, TEMPO-001]

  - test_id: TACT-MARK-001
    gameplay_property: "A tight-marking assignment may reduce separation from a designated attacker while preserving team responsibilities."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Matched attacker/defender roles with assignment off/on across repeatable movement paths"]
    controlled_inputs: ["Explicit assignment as isolated intervention", "Repeat ball zones and phase changes"]
    state_to_record: ["assignment/role state", "actor positions/headings/decisions", "switch/hand-off events", "team shape"]
    metrics: ["separation distribution", "tracking lag", "assignment switch events", "shape/coverage cost"]
    reference_evidence: {behavioral: "R1 TACT-MARK-001; Tight Marking exists", measurement_class: C, evidence_limit: "Known assignment state and logic require controlled capture", target_status: ABSENT}
    target_types: [UNKNOWN, REGRESSION]
    acceptance_logic:
      - {criterion_id: TACT-MARK-001-CAUSAL, class: UNKNOWN, rule: "No PES proximity/switch threshold until controlled evidence"}
      - {criterion_id: TACT-MARK-001-REG, class: REGRESSION, rule: "Preserve shape, reachability, and non-assigned marking"}
    known_uncertainty: ["Assignment/hand-off logic unknown"]
    failure_modes: ["defender permanently glued to attacker", "formation abandoned", "position teleport", "assignment survives invalid phase"]
    regression_dependencies: [DEF-SHAPE-001, INT-PASS-001]

  - test_id: AI-ADAPT-001
    gameplay_property: "Opponent behavior may adapt after repeated use of a star/focal player."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Repeated possession episodes route play through one declared focal attacker"]
    controlled_inputs: ["Script repeated pattern and matched control pattern", "Record memory reset and seed"]
    state_to_record: ["AI memory/evidence state", "mark/cover assignments", "defender density", "possession sequence"]
    metrics: ["defenders near focal player over episodes", "assignment/density change point", "coverage tradeoffs"]
    reference_evidence: {behavioral: "R1 AI-ADAPT-001; Adaptive AI double-marking behavior announced", measurement_class: C, evidence_limit: "Repetition threshold/memory needs controlled sequences", target_status: ABSENT}
    target_types: [UNKNOWN, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: AI-ADAPT-001-MEM, class: HARD_INVARIANT, rule: "Any adaptation depends only on serialized, deterministic, inspectable memory; no hidden future knowledge"}
      - {criterion_id: AI-ADAPT-001-CAUSAL, class: UNKNOWN, rule: "No PES threshold or magnitude until controlled capture"}
      - {criterion_id: AI-ADAPT-001-REG, class: REGRESSION, rule: "Preserve reset behavior, team shape, and non-pattern control"}
    known_uncertainty: ["PES threshold, memory, and difficulty interactions unknown"]
    failure_modes: ["adaptation from one event claimed PES-like", "memory not serialized", "double marking always active", "future input leakage"]
    regression_dependencies: [TACT-MARK-001, DEF-SHAPE-001, AI-ADAPT-002]

  - test_id: AI-ADAPT-002
    gameplay_property: "Opponent behavior may adapt after repeated attacks through one flank."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Repeated possession episodes attack one flank; matched alternating-flank control"]
    controlled_inputs: ["Script zone sequence and memory reset", "Repeat seeds"]
    state_to_record: ["AI memory", "zone density/assignments", "line/centroid shifts", "episode events"]
    metrics: ["defensive density by zone", "shift/coverage change point", "opposite-side exposure", "episode-conditioned geometry"]
    reference_evidence: {behavioral: "R1 AI-ADAPT-002; flank adaptation announced", measurement_class: C, evidence_limit: "Controlled repetitions required", target_status: ABSENT}
    target_types: [UNKNOWN, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: AI-ADAPT-002-MEM, class: HARD_INVARIANT, rule: "Adaptation memory is deterministic, serialized, resettable, and based on past observed state only"}
      - {criterion_id: AI-ADAPT-002-CAUSAL, class: UNKNOWN, rule: "No PES threshold/mapping until controlled reference"}
      - {criterion_id: AI-ADAPT-002-REG, class: REGRESSION, rule: "Preserve ordinary lateral shift and alternating-flank control"}
    known_uncertainty: ["PES memory and algorithm unknown"]
    failure_modes: ["normal ball-following mislabeled adaptation", "hidden nonserialized memory", "permanent flank overload"]
    regression_dependencies: [DEF-SHIFT-001, AI-ADAPT-001]

  - test_id: TRANS-AD-001
    gameplay_property: "Possession loss enters an attack-to-defence transition before settled defence."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Team in settled attack loses control at a declared location"]
    controlled_inputs: ["Script valid loss contact/control evidence", "Repeat tactic profiles and zones"]
    state_to_record: ["possession facts", "team phase entry/exit", "role/target changes", "press/recover assignments", "team geometry"]
    metrics: ["loss-to-first response", "phase duration", "block rebuild time", "centroid/width/shape trajectory"]
    reference_evidence: {behavioral: "R1 TRANS-AD-001; total team control and post-loss transitions", measurement_class: B, evidence_limit: "Tactical cause/settings uncertain", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: TRANS-AD-001-PHASE, class: HARD_INVARIANT, rule: "Valid possession evidence causes explicit phase transition with recorded entry/exit; no instant settled-state rewrite"}
      - {criterion_id: TRANS-AD-001-REF, class: MEASURED_TARGET, rule: "Compare ordinary transition timing/geometry under visible context when populated"}
      - {criterion_id: TRANS-AD-001-REG, class: REGRESSION, rule: "Preserve pressure, recovery, and settled shape"}
    known_uncertainty: ["Reference tactics and possession policy unknown"]
    failure_modes: ["instant settled defence", "phase changes without control evidence", "all players choose same target", "teleport to anchors"]
    regression_dependencies: [PRESS-001, PRESS-GG-001, PRESS-REC-001, DEF-SHAPE-001]

  - test_id: TRANS-DA-001
    gameplay_property: "A valid recovery enters a defence-to-attack transition with differentiated forward/support roles."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Team in settled defence wins controlled ball in own half"]
    controlled_inputs: ["Script valid recovery contact/control evidence", "Repeat counter/possession tactic profiles"]
    state_to_record: ["possession and phase events", "role/utility/target changes", "team positions/centroid/width", "first forward/support runs"]
    metrics: ["recovery-to-first-forward-run", "centroid velocity", "width growth", "role differentiation", "phase duration"]
    reference_evidence: {behavioral: "R1 TRANS-DA-001; Team ID/gameplay transition behavior", measurement_class: B, evidence_limit: "Tactic settings/context uncertain", target_status: ABSENT}
    target_types: [MEASURED_TARGET, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: TRANS-DA-001-PHASE, class: HARD_INVARIANT, rule: "Recovery evidence causes explicit transition; roles request movement through locomotion"}
      - {criterion_id: TRANS-DA-001-REF, class: MEASURED_TARGET, rule: "Compare visible geometry/timing under qualified context"}
      - {criterion_id: TRANS-DA-001-REG, class: REGRESSION, rule: "Preserve settled shape, support, and run behavior"}
    known_uncertainty: ["Counter versus possession setting unknown in reference"]
    failure_modes: ["all players sprint forward", "instant settled attack", "role targets ignore reachability", "phase changes without recovery evidence"]
    regression_dependencies: [OFF-RUN-001, OFF-SUP-001, DEF-SHAPE-001]
```

### 7.6 Controls, camera, and match tempo

```yaml
tests:
  - test_id: CTRL-LAT-001
    gameplay_property: "Movement intent is acknowledged promptly while physical velocity/body response remains constrained."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: REQUIRED}
    initial_scenario: ["Player in stable locomotion receives an abrupt desired-direction change"]
    controlled_inputs: ["Normalized InputFrame edge at a declared tick", "Browser replay uses the same frame"]
    state_to_record: ["input received/assigned", "intent changed", "kinematic response started", "visible response started", "velocity/headings/phases"]
    metrics: ["input-to-intent ticks", "intent-to-kinematic ticks", "intent-to-visible ticks", "velocity/body response curves"]
    reference_evidence: {behavioral: "R1 CTRL-LAT-001; immediate intention coexists with weight", measurement_class: C, evidence_limit: "True PES input timestamp absent", target_status: ABSENT}
    target_types: [UNKNOWN, HARD_INVARIANT, PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: CTRL-LAT-001-TRACE, class: HARD_INVARIANT, rule: "All four response timestamps are emitted in causal order and attributable to ticks"}
      - {criterion_id: CTRL-LAT-001-CAUSAL, class: UNKNOWN, rule: "No PES input-latency threshold until direct input capture"}
      - {criterion_id: CTRL-LAT-001-VIS, class: PERCEPTUAL_TARGET, rule: "Browser review assesses immediate intent plus non-instantaneous body under rubric; no scalar feel score"}
      - {criterion_id: CTRL-LAT-001-REG, class: REGRESSION, rule: "Preserve acceleration, stop, turn, and state/presentation agreement"}
    known_uncertainty: ["PES controller poll/command timestamp unknown", "Input sampling policy TBD"]
    failure_modes: ["visible-only latency called simulation latency", "zero inertia used for responsiveness", "intent changes late", "timestamps missing/reordered"]
    regression_dependencies: [LOC-ACC-001, LOC-DEC-001, LOC-T90-001, LOC-ORI-001]

  - test_id: CTRL-ACT-001
    gameplay_property: "Pass/shoot command timing is observable through intent, preparation, contact, and visible response."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: REQUIRED}
    initial_scenario: ["Player has stable ball-control eligibility and action is valid"]
    controlled_inputs: ["Pass and shot pressed edges at declared ticks", "Repeat body orientations/action contexts"]
    state_to_record: ["input assigned", "intent/action preparation", "canonical contact", "visible action onset", "recovery"]
    metrics: ["input-to-intent", "intent-to-preparation", "input-to-contact", "input-to-visible", "action duration"]
    reference_evidence: {behavioral: "R1 CTRL-ACT-001; action responsiveness reported", measurement_class: C, evidence_limit: "PES command timestamp absent", target_status: ABSENT}
    target_types: [UNKNOWN, HARD_INVARIANT, PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: CTRL-ACT-001-ORDER, class: HARD_INVARIANT, rule: "Command, eligibility, preparation, contact, and recovery events are tick-attributed and causally ordered"}
      - {criterion_id: CTRL-ACT-001-CAUSAL, class: UNKNOWN, rule: "No PES command-to-action threshold until controlled capture"}
      - {criterion_id: CTRL-ACT-001-VIS, class: PERCEPTUAL_TARGET, rule: "Browser action onset/contact continuity uses versioned rubric; currently review-only"}
      - {criterion_id: CTRL-ACT-001-REG, class: REGRESSION, rule: "Preserve pass/shot outputs and locomotion action interactions"}
    known_uncertainty: ["Reference input frame unknown", "Animation/contact integration deferred"]
    failure_modes: ["contact before valid intent", "animation owns contact time", "command delay hidden", "one latency scalar merges distinct timestamps"]
    regression_dependencies: [PASS-LOW-001, SHOT-PWR-001, LOC-DEC-001]

  - test_id: CAM-FLW-001
    gameplay_property: "Gameplay camera follows changes of action with measurable lag, smoothing, and zoom behavior."
    execution: {paths: [BROWSER], primary: BROWSER, visual_requirement: REQUIRED}
    initial_scenario: ["Deterministic replay with rapid possession/side changes", "Pinned browser, viewport, renderer, and camera preset"]
    controlled_inputs: ["Exact shared replay", "Capture camera telemetry and frames at declared ticks"]
    state_to_record: ["simulation entities", "camera transform/target/FOV/zoom", "screen projections", "render frames"]
    metrics: ["camera-center lag", "screen velocity", "zoom/FOV change", "smoothing/overshoot", "framing error"]
    reference_evidence: {behavioral: "R1 CAM-FLW-001; raw gameplay camera motion", measurement_class: A, evidence_limit: "PES preset/build must be known or stratified", target_status: ABSENT}
    target_types: [MEASURED_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: CAM-FLW-001-REF, class: MEASURED_TARGET, rule: "Compare camera telemetry/image motion to a populated preset-specific envelope"}
      - {criterion_id: CAM-FLW-001-REG, class: REGRESSION, rule: "Pinned same-replay camera baseline must show no material unapproved delta under versioned policy"}
    known_uncertainty: ["Default camera parameters/preset unresolved", "Browser rendering environment sensitivity"]
    failure_modes: ["camera change mistaken for locomotion", "unpinned environment", "raw PES pixel diff", "camera telemetry absent"]
    regression_dependencies: [CAM-PER-001, LOC-MAX-001, TEMPO-003]

  - test_id: CAM-PER-001
    gameplay_property: "Camera choice changes perceived speed without changing world-space player speed."
    execution: {paths: [BROWSER], primary: BROWSER, visual_requirement: REQUIRED}
    initial_scenario: ["Same deterministic straight-run replay under declared camera presets"]
    controlled_inputs: ["Identical simulation state/input/seed", "Vary camera only; counterbalance presentation order"]
    state_to_record: ["world velocity", "camera telemetry", "screen projections", "frame strips", "critic/human judgments"]
    metrics: ["pixel velocity versus world velocity", "framing/zoom", "structured perceived-speed judgments"]
    reference_evidence: {behavioral: "R1 CAM-PER-001; camera affects perceived speed", measurement_class: D, evidence_limit: "Perception has no unique physical scalar; equivalent captures difficult", target_status: ABSENT}
    target_types: [PERCEPTUAL_TARGET, HARD_INVARIANT, REGRESSION]
    acceptance_logic:
      - {criterion_id: CAM-PER-001-STATE, class: HARD_INVARIANT, rule: "Changing camera does not mutate canonical simulation state or state hashes"}
      - {criterion_id: CAM-PER-001-PERC, class: PERCEPTUAL_TARGET, rule: "Use counterbalanced task/rubric evaluation; physical pixel/world ratio is supporting evidence, not the perceptual verdict"}
      - {criterion_id: CAM-PER-001-REG, class: REGRESSION, rule: "Preserve pinned-camera readability and follow behavior"}
    known_uncertainty: ["Perceptual rubric/threshold unvalidated", "Camera preset unresolved"]
    failure_modes: ["pixel speed used as feel score", "camera alters simulation", "uncounterbalanced critic", "comparison across unpinned browsers"]
    regression_dependencies: [CAM-FLW-001, LOC-MAX-001, TEMPO-003]

  - test_id: TEMPO-001
    gameplay_property: "Full-match possession/action sequences have measurable event-rate and duration ecology."
    execution: {paths: [HEADLESS, BROWSER], primary: HEADLESS, visual_requirement: CONDITIONAL}
    initial_scenario: ["Complete or fixed-duration representative match scenarios with explicit rules/tactics/rosters"]
    controlled_inputs: ["Versioned AI/input policies and seed batches", "Use complete footage for reference"]
    state_to_record: ["all pass/touch/possession/action/rule events", "match clock/phases", "team tactics", "ball-in-play state"]
    metrics: ["passes/touches/actions per game-time", "possession-length distribution", "stoppage/ball-in-play durations", "event transition matrix"]
    reference_evidence: {behavioral: "R1 TEMPO-001; complete match sequences", measurement_class: A, evidence_limit: "Event definitions and match settings must be fixed; current full-match rules incomplete", target_status: ABSENT}
    target_types: [MEASURED_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: TEMPO-001-REF, class: MEASURED_TARGET, rule: "Compare distributions only after event definitions, rules coverage, and reference strata are versioned"}
      - {criterion_id: TEMPO-001-REG, class: REGRESSION, rule: "Use as ecology guard against local metric gaming once representative match suite exists"}
    known_uncertainty: ["Full rules/GK ecology under-researched", "Difficulty/tactics/reference settings unknown"]
    failure_modes: ["partial clip used as full-match rate", "wall-clock rather than match time", "local calibration breaks ecology", "missing rules treated as valid tempo"]
    regression_dependencies: [TEMPO-002, TRANS-AD-001, TRANS-DA-001, PASS-LOW-001, TACK-ST-001]

  - test_id: TEMPO-002
    gameplay_property: "Attack/defence transitions have a measurable duration distribution across a match."
    execution: {paths: [HEADLESS], primary: HEADLESS, visual_requirement: NONE}
    initial_scenario: ["Representative match batch containing many valid possession changes"]
    controlled_inputs: ["Versioned policies/configuration and seed set", "Explicit event definitions"]
    state_to_record: ["possession evidence", "team phase entry/exit", "geometry and role changes", "match context"]
    metrics: ["transition duration distribution", "loss/recovery-to-first-action", "block rebuild/expansion time", "phase occupancy"]
    reference_evidence: {behavioral: "R1 TEMPO-002; transitions relatively quick while retaining inertia", measurement_class: A, evidence_limit: "Team tactics and event definitions condition results", target_status: ABSENT}
    target_types: [MEASURED_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: TEMPO-002-REF, class: MEASURED_TARGET, rule: "Compare explicit phase-duration distributions to populated reference strata"}
      - {criterion_id: TEMPO-002-REG, class: REGRESSION, rule: "Preserve transition laboratories and locomotion weight"}
    known_uncertainty: ["Reference tactic settings unknown", "Full-match implementation incomplete"]
    failure_modes: ["transition event inferred from arbitrary possession toggle", "single mean hides tails", "instant phase changes"]
    regression_dependencies: [TRANS-AD-001, TRANS-DA-001, TEMPO-001]

  - test_id: TEMPO-003
    gameplay_property: "Overall play feels responsive/fast while retaining bodily and ball weight."
    execution: {paths: [BROWSER], primary: BROWSER, visual_requirement: REQUIRED}
    initial_scenario: ["Standardized montage of turns, stops, touches, passes, duels, and transitions under pinned camera"]
    controlled_inputs: ["Deterministic event-centered replays", "Counterbalanced candidate/best/reference order"]
    state_to_record: ["component telemetry for every event", "frame strips/video", "camera state", "structured critic/human judgments"]
    metrics: ["component metrics from locomotion/touch/transition tests", "rubric findings with severity/confidence/evidence frames"]
    reference_evidence: {behavioral: "R1 TEMPO-003; 'fast but with weight' aggregate goal", measurement_class: D, evidence_limit: "No unique scalar and PES input timing unavailable", target_status: ABSENT}
    target_types: [PERCEPTUAL_TARGET, REGRESSION]
    acceptance_logic:
      - {criterion_id: TEMPO-003-PERC, class: PERCEPTUAL_TARGET, rule: "Evaluate structured dimensions separately; never compute an unevidenced universal feel score"}
      - {criterion_id: TEMPO-003-REG, class: REGRESSION, rule: "Reject new high-severity perceptual pathology only under versioned rubric/review policy; preserve component metrics"}
    known_uncertainty: ["Perceptual rubric and materiality threshold unvalidated", "Camera is a major dependency", "PES command latency unknown"]
    failure_modes: ["single vibe score", "camera effect blamed on physics", "fast achieved by removing inertia", "weight achieved by delaying intent", "objective scores shown to blind critic"]
    regression_dependencies: [CTRL-LAT-001, LOC-DEC-001, LOC-T90-001, TOUCH-FAST-001, TEMPO-002, CAM-FLW-001]
```

## 8. Suite topology

The evaluator SHOULD expose these suites. Dependency closure is computed from each record's `regression_dependencies` plus common criteria.

```yaml
suites:
  fast:
    includes: [COMMON-FINITE, COMMON-DETERMINISTIC, COMMON-REFERENCES,
      BALL-IND-001, LOC-ACC-001, BALL-GND-001]
  locomotion: [LOC-ACC-001, LOC-ACC-002, LOC-MAX-001, LOC-DEC-001,
    LOC-REV-001, LOC-T45-001, LOC-T90-001, LOC-ORI-001, LOC-BALL-001,
    CTRL-LAT-001]
  ball: [BALL-IND-001, BALL-GND-001, BALL-GND-002, BALL-BNC-001,
    BALL-SPN-001, BALL-SPN-002]
  touch_and_actions: [TOUCH-SLOW-001, TOUCH-FAST-001, TOUCH-BACK-001,
    TOUCH-90-001, TOUCH-WF-001, PASS-LOW-001, PASS-ANG-001, PASS-RUN-001,
    PASS-THR-001, PASS-LOFT-001, CROSS-HI-001, SHOT-PWR-001,
    SHOT-IND-001, SHOT-SWV-001, HEAD-FREE-001, HEAD-DUEL-001, CTRL-ACT-001]
  duels_and_keeper: [PHY-SHLD-001, PHY-STR-001, PHY-BC-001, PHY-PC-001,
    TACK-ST-001, TACK-SL-001, TACK-ANG-001, INT-PASS-001, INT-FAST-001,
    GK-REA-001, GK-WF-001, GK-LEG-001, GK-PARRY-001, GK-REC-001, GK-HIGH-001]
  team: [OFF-RUN-001, OFF-SUP-001, DEF-SHAPE-001, DEF-SHIFT-001,
    PRESS-001, PRESS-GG-001, PRESS-REC-001, TACT-COMP-001, TACT-DLINE-001,
    TACT-SUP-001, TACT-TIKI-001, TACT-MARK-001, AI-ADAPT-001,
    AI-ADAPT-002, TRANS-AD-001, TRANS-DA-001]
  browser_perceptual: [LOC-ORI-001, TOUCH-BACK-001, TOUCH-90-001,
    PASS-THR-001, HEAD-FREE-001, HEAD-DUEL-001, TACK-ST-001, TACK-SL-001,
    GK-REA-001, GK-WF-001, GK-LEG-001, GK-PARRY-001, GK-REC-001,
    GK-HIGH-001, CTRL-LAT-001, CTRL-ACT-001, CAM-FLW-001, CAM-PER-001,
    TEMPO-003]
  match_ecology: [TEMPO-001, TEMPO-002, TEMPO-003, TRANS-AD-001,
    TRANS-DA-001, DEF-SHAPE-001, PRESS-001]
```

Evaluation tiers are:

1. `FAST`: build/typecheck, common hard criteria, determinism smoke, one target scenario.
2. `TARGETED`: the changed family, seed/config batches, pathologies, candidate-versus-best.
3. `DEEP`: dependency closure, browser execution where declared, event-centered visual artifacts.
4. `PROMOTION`: full headless regression, held-out scenarios/seeds, browser smoke, critical visual rubrics, and match ecology where implemented.

## 9. Visual/headless classification summary

- Every simulation-behavior test except `CAM-FLW-001`, `CAM-PER-001`, and `TEMPO-003` has a headless primary path.
- `CAM-FLW-001` is browser-measured; `CAM-PER-001` and `TEMPO-003` are browser/perceptual by definition.
- `visual_requirement: REQUIRED` means headless state evidence is insufficient for every declared criterion; it does not make pixels authoritative for physics.
- `visual_requirement: CONDITIONAL` means headless acceptance can establish simulation behavior, but browser artifacts are required before promotion when a change touches animation, camera, contact presentation, or another named presentation dependency.
- `visual_requirement: NONE` means the catalog criterion can be evaluated from canonical state/events; ordinary browser integration smoke still applies at promotion.

## 10. Regression and anti-gaming requirements

The evaluator and reference material MUST be read-only to an ordinary gameplay candidate. Every run hashes the contract, metrics, scenarios, reference registry, held-out set, and baseline record.

At minimum, the evaluator mutant/canary suite MUST include intentionally broken fixtures for:

- non-finite state;
- nondeterministic RNG/order;
- instantaneous velocity or body-heading snap;
- disabled ball decay;
- ball parenting/teleport;
- possession change without interaction evidence;
- impossible touch/tackle/keeper contact;
- every defender chasing the ball;
- transition phase skipped;
- camera mutation changing simulation hashes.

A candidate MUST be rejected when a hard invariant fails, a critical browser integration test fails, or protected evaluator material changes without an evaluator-maintenance run. Measured, perceptual, and regression failures become promotion blockers only through their versioned policies; their absence never becomes an implicit pass.

## 11. Minimum reference work needed to activate gates

The first `MEASURED_TARGET` gates require the research campaign already specified in the corpus:

```text
15 straight locomotion segments
15 observed turns
24 ground-pass -> roll -> first-touch chains
independent held-out footage
```

This initially activates only qualified locomotion, turning, ground-ball, low-pass, and first-touch targets. It does not activate rating mappings, exact stick response, pass-power/assistance mappings, first-touch intent mappings, tactical-slider effects, or adaptive-AI thresholds.

Class-C criteria require input-instrumented controlled capture with a pinned PES platform/build/settings profile. Camera/perceptual gates require the camera laboratory, validated task/rubric studies, repeated baselines, and the evaluator mutant suite. All target and regression tolerances remain TBD until those artifacts exist.

## 12. Required evaluator artifacts

Every test run produces a manifest, criterion results, metrics, events, hashes, and enough replay material to reproduce the state trajectory. Browser-required tests also produce exact-tick frame strips and camera/render provenance. A compact result record is:

```json
{
  "test_id": "LOC-T90-001",
  "scenario_id": "locomotion.turn-90.v1",
  "run_contract_hash": "...",
  "criteria": [
    {
      "criterion_id": "LOC-T90-001-REF",
      "class": "MEASURED_TARGET",
      "outcome": "BLOCKED_MISSING_REFERENCE",
      "target_id": null,
      "evidence": ["metrics/LOC-T90-001.json"]
    },
    {
      "criterion_id": "COMMON-DETERMINISTIC",
      "class": "HARD_INVARIANT",
      "outcome": "PASS",
      "evidence": ["state/hashes-run-a.jsonl", "state/hashes-run-b.jsonl"]
    }
  ],
  "overall": "BLOCKED_MISSING_REFERENCE"
}
```

The example contains schema placeholders only. It is not evidence that the named test has run.

## 13. Traceability

| Contract concern | Source |
|---|---|
| Gameplay properties and original IDs | [PES 2017 behavioral research, Reference Test Catalog](../research/01-pes2027-behavior.md#reference-test-catalog) |
| PTS, geometry, tracking, metrics, uncertainty, A/B/C/D classes, and initial campaign | [Reference measurement research](../research/02-reference-measurement.md) |
| Headless/browser split, telemetry, target registry, layered critics, regression, and artifacts | [Autonomous evaluation research](../research/04-autonomous-evaluation.md) |
| Missing corpus, controlled capture, absent thresholds, and experiment requirements | [Research audit](../research/RESEARCH_AUDIT.md) |
| Authoritative state, fixed step, determinism, inputs, scenarios, and adapters | [Technical specification](./TECHNICAL_SPEC.md) |
| Product goal and gameplay-first boundary | [Vision](../VISION.md) |
