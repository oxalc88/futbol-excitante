# Autonomous Evaluation Architecture for a Browser Football Simulation Gauntlet

## Executive architecture

The right architecture is **not an autonomous coding agent that repeatedly launches the browser, watches a match, and guesses what to change**. It should be an evaluation system in which the coding model is only one component.

The recommended design is a **dual-path evaluator**:

1. A **deterministic headless simulation path** is the primary scientific instrument. It runs scenarios as fast as the CPU permits, records exact state, computes objective metrics, executes batches over seeds/configurations, and supports reproducible parameter experiments.
2. A **browser execution path** exercises the real shipped application with the same simulation code, deterministic replay inputs, fixed browser/environment configuration, state introspection, screenshots, frame sequences, and occasional video/traces.
3. A **layered evaluation stack** compares state-space behavior, temporal event sequences, reference distributions, rendered output, and perceptual qualities instead of collapsing fidelity into one score.
4. A **role-separated agent system** has one implementer but several read-only critics. An orchestrator decides what to investigate, which candidate to keep, when to escalate, and when to stop.
5. A **transactional experiment controller** treats every code change as a candidate against an immutable best-known version. Nothing becomes “best” until it passes both targeted evaluation and regression gates.

This matches the direction already established in the project material. The initial architecture calls for gameplay logic to remain independent of rendering and backend concerns, with deterministic fixed-step simulation and the possibility of headless execution and replay. fileciteturn0file0 The implementation research goes further: it describes headless execution as effectively mandatory for calibration, recommends explicit seeded randomness, stable update ordering, snapshots/hashes, and a loop of parameter set → deterministic simulations → metric extraction → loss → next candidate. fileciteturn0file1

The behavioral-research documents point to the same conclusion from the reference side. Public PES footage should be transformed into **observable distributions and target envelopes**, not fictional internal PES constants, and raw footage/annotations should remain primary so derived measurements can be reproduced. fileciteturn0file2 The behavioral engineering report expresses the desired calibration loop particularly well: reference → measurements → target envelopes → new engine → measurements → error. It also warns that matching a scalar such as stopping time is insufficient if the body orientation or state sequence is visibly wrong. fileciteturn0file3

The resulting top-level system should look like this:

```text
                         BEHAVIORAL REFERENCE CORPUS
                     footage + tracks + measurements
                       + uncertainty + confidence
                                 │
                                 ▼
                      Reference Target Registry
                   envelopes / distributions / rubrics
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                       GAUNTLET ORCHESTRATOR                        │
│ diagnose → select gap → create experiment → evaluate → promote    │
└────────────────┬───────────────────────────────────────┬───────────┘
                 │                                       │
                 ▼                                       ▼
        HEADLESS EVALUATOR                       BROWSER EVALUATOR
   fixed-step simulation core              Playwright + real renderer
   deterministic input replay              deterministic input replay
   state/event recording                    test/debug state bridge
   batch experiments                        screenshots/frame strips
   objective metrics                        video/trace on demand
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     ▼
                              Artifact Store
                    traces / metrics / images / manifests
                                     │
                  ┌──────────────────┼──────────────────┐
                  ▼                  ▼                  ▼
             Physics Critic    Gameplay Critic     Visual Critic
                  └──────────────────┼──────────────────┘
                                     ▼
                             Regression Critic
                                     │
                                     ▼
                        Candidate / Best comparison
                                     │
                       reject ◄───────┴───────► promote
```

The central engineering principle is therefore:

> **State is the authoritative evidence for simulation behavior; pixels are authoritative evidence for presentation; perceptual models are critics, not the source of truth.**

That distinction is especially important for this project. The existing reference research already separates externally observable behavior, reconstructed quantities, uncertain measurements, and properties that simply cannot be identified from public footage. fileciteturn0file2 A good Gauntlet must preserve that epistemic distinction rather than letting an autonomous agent optimize toward numbers that the source material never established.

### What should be authoritative

| Evaluation question | Primary evidence | Secondary evidence |
|---|---|---|
| Did the player accelerate correctly? | State trajectory and reference distribution | Rendered motion |
| Did the body visibly rotate unnaturally? | Body-heading state plus frames | Multimodal critic |
| Did ball friction improve? | Ball trajectory and fitted decay curve | Video |
| Does the first touch feel contextual? | Ball/player state sequence + event timing | Visual critic |
| Is team shape PES-like? | World-space player geometry | Frame montage |
| Did camera behavior regress? | Camera telemetry + aligned frames | Perceptual comparison |
| Did the shipped browser build break? | Browser integration tests | Playwright traces/video |
| Is the overall sequence believable? | Multi-metric scorecard | Multimodal/human judgment |

The architecture should consequently resist the tempting but wrong design of a universal `fidelityScore = 0.83`. The reference corpus itself contains different confidence levels and different kinds of observability; some behaviors can be measured robustly from footage, some require controlled future capture, and others are predominantly perceptual. fileciteturn0file2 The Gauntlet should retain those distinctions all the way into the agent loop.

## Evaluation substrate and observability

### Headless simulation should be the center of the system

The simulation core should expose an API that has **no dependency on DOM, Canvas, Three.js, audio, requestAnimationFrame, browser input events, or wall-clock time**.

Conceptually:

```ts
const world = createScenario(config, seed);

for (const input of inputTrace) {
  world.applyInputs(input);
  world.step();
  recorder.observe(world);
  metrics.observe(world);
}
```

This is already the recommended architecture in the implementation research. fileciteturn0file1

The crucial point about “arbitrary simulation speed” is that **the simulation timestep must remain fixed**. Faster-than-real-time execution should mean executing more fixed ticks per second of wall-clock time, not increasing `dt`. Changing `dt` to accelerate evaluation would change collision, integration, controller, and AI behavior and therefore corrupt the experiment. The headless runner simply does not wait for realtime.

For example:

```text
Normal browser:
one 16.667 ms simulation tick ≈ one 16.667 ms of wall time

Headless:
one 16.667 ms simulation tick ≈ as little wall time as the CPU requires
```

The deterministic contract should include:

```text
scenario id
+ simulation version
+ config
+ roster/archetypes
+ initial state
+ explicit PRNG seed
+ tick-indexed input trace
──────────────────────────────
= reproducible state trajectory
```

The project research already identifies the technical preconditions: fixed-step execution, an explicit seeded PRNG, deterministic entity/update/contact ordering, and state hashing/snapshots. fileciteturn0file1

A fundamental Gauntlet self-test should therefore be:

```text
run(scenario=S, seed=X, inputs=I)
run(scenario=S, seed=X, inputs=I)

assert stateHash[t] is identical for every tick t
```

I would define the strict reproducibility guarantee against a **pinned runtime/toolchain first** rather than promising bit-identical behavior across every JavaScript engine and graphics environment. The browser presentation layer in particular is not an appropriate bit-exact determinism boundary; even Playwright warns that visual output can differ with OS, browser version, settings, hardware, power state, and headless mode. citeturn20search1

### Scenario runner

Scenarios should be data, not hard-coded test scripts scattered through the game:

```ts
interface ScenarioDefinition {
  id: string;
  family: string;

  durationTicks: number;
  seedPolicy: SeedPolicy;

  world: InitialWorldSpec;
  teams: TeamSpec[];
  players: PlayerOverride[];

  inputTrace?: InputTrace;
  scriptedEvents?: ScenarioEvent[];

  observationWindows: ObservationWindow[];
  metrics: string[];
  invariants: string[];

  referenceTargets: string[];
}
```

Examples already suggested by the behavioral corpus map naturally into scenario families:

```text
locomotion/
  acceleration-from-rest
  sprint-stop
  45-degree-cut
  90-degree-cut
  180-degree-reversal
  on-ball-vs-off-ball

ball/
  ground-roll
  low-pass-decay
  first-bounce
  curved-shot

touch/
  slow-pass-front
  fast-pass-front
  receiver-90deg
  receiver-back-to-ball

duels/
  shoulder-parallel
  lateral-contact
  standing-tackle
  interception-window

team/
  settled-defence
  loss-of-possession-transition
  counterpress
  attacking-support

keeper/
  torso-shot
  low-side-shot
  high-extension
  parry-recovery
```

Those families correspond closely to the reference-test catalog already developed in the project, including acceleration, deceleration, orientation, ball independence, ground decay, first touch, passing, duels, tactical shape, and keeper behavior. fileciteturn0file3

A scenario should also be able to **freeze irrelevant complexity**. A ball-friction experiment should not require eleven autonomous teammates and a referee unless those are relevant. This is the simulation equivalent of a laboratory experiment: isolate the variable first, then validate it again in full-match context.

### State recording and telemetry

Every evaluation run should leave an inspectable forensic record.

At minimum, the simulation recorder should expose per tick:

```text
tick
simulationTime
input frames
PRNG state/hash

for every player:
  position
  velocity
  acceleration or derived acceleration
  bodyHeading
  desiredHeading
  locomotion state/phase
  possession/control state
  contact/balance state
  tactical role/state
  current action

ball:
  position
  linearVelocity
  angularVelocity
  airborne
  lastTouchEntity
  lastTouchSurface
  contact events

team:
  possession
  phase
  tactical mode
  centroid
  defensive line
  width
  length
  compactness

camera if applicable:
  position
  target
  zoom/FOV
```

The behavioral report explicitly recommends exposing concepts such as `linearVelocity`, `desiredVelocity`, `bodyHeading`, `desiredHeading`, turning/braking/acceleration capacity, contact and locomotion phase, plus an independently represented ball with position, velocity, angular velocity, touch history and contact surface. fileciteturn0file3

For input responsiveness, preserve the four timestamps already identified in that research:

```text
input_received
intent_state_changed
kinematic_response_started
visible_animation_response_started
```

That separation is extremely valuable because PES-like responsiveness appears to involve **fast acknowledgement of intent while the body still respects momentum**, not zero inertia. fileciteturn0file3

A useful recorder design is:

```text
input trace          every tick
event log            whenever semantic event occurs
metric accumulator   online where cheap
state hash           every tick
full state snapshot  periodic / event-triggered
```

Full snapshots need not be written every tick if storage becomes excessive. Input trace + seed + deterministic simulation allows replay, while periodic snapshots permit fast binary search around the first divergent tick.

### Experiment batches

The headless runner should have native batching:

```bash
gauntlet batch \
  --suite locomotion \
  --candidate HEAD \
  --seeds 100:199 \
  --workers auto
```

A batch should return distributions rather than merely averages.

For example:

```json
{
  "metric": "loc.accel.t90",
  "n": 100,
  "median": 0.72,
  "q05": 0.69,
  "q25": 0.71,
  "q75": 0.74,
  "q95": 0.78
}
```

This is a particularly good fit for the reference dataset, whose research explicitly recommends target distributions/envelopes and preserving uncertainty rather than reverse-engineering unsupported single-valued “PES constants.” fileciteturn0file2

Batch execution enables another useful division of labor: once the simulator and measurements are reliable, **continuous numeric calibration does not have to be performed solely by an LLM**. The implementation research recommends simple grid/one-dimensional sweeps for isolated variables and derivative-free multivariable optimization for coupled parameters, with methods such as CMA-ES as a later-stage option. fileciteturn0file1 The coding model can reason about architecture and hypotheses while a numerical optimizer handles a five-dimensional friction/acceleration/turning parameter sweep far more systematically.

### Browser execution should reuse the same simulation

The browser build should not have a parallel “test physics” implementation.

Instead:

```text
                       Simulation Core
                   fixed-step deterministic
                    /                 \
                   /                   \
         Headless adapter          Browser adapter
        no presentation          renderer + controls + UI
```

That separation follows the project's initial and implementation architectures. fileciteturn0file0 fileciteturn0file1

For browser testing I recommend a **test-only application bridge**, for example:

```ts
interface GauntletBrowserAPI {
  reset(args: {
    scenarioId: string;
    seed: number;
  }): Promise<void>;

  setInput(frame: InputFrame): void;

  step(ticks: number): void;

  runUntil(tick: number): void;

  snapshot(): SerializableSimulationState;

  events(sinceTick?: number): SimulationEvent[];

  metrics(): Record<string, unknown>;

  render(): void;

  setCameraPreset(id: string): void;
}
```

In a test build this might be exposed as:

```js
window.__GAUNTLET__
```

Playwright can execute JavaScript in the page and can expose host callbacks into page contexts, which makes this kind of runtime bridge practical. citeturn13search4 A `BrowserContext` can also install initialization code after the document is created but before application scripts execute, which is useful for installing test configuration early; Playwright's own documentation uses seeding `Math.random` as an example. citeturn12search0 For Gauntlet, however, I would keep random seeding in the application-owned simulation PRNG rather than globally replacing `Math.random`.

The browser test sequence can then be deterministic:

```text
open browser
→ load test build
→ reset scenario with seed
→ inject exact InputFrame 0
→ step one fixed simulation tick
→ ...
→ at requested tick:
     render
     capture screenshot
     fetch state snapshot
→ continue
```

That is significantly stronger than trying to schedule keyboard presses at approximate wall-clock milliseconds.

### Keyboard and gamepad input

The game should normalize physical devices into a single internal representation:

```ts
interface InputFrame {
  moveX: number;       // -1..1
  moveY: number;       // -1..1
  sprint: number;      // 0..1
  pass: boolean;
  throughPass: boolean;
  shoot: boolean;
  tackle: boolean;
  ...
}
```

Then provide interchangeable sources:

```text
KeyboardInputSource
GamepadInputSource
ReplayInputSource
AIInputSource
GauntletTestInputSource
```

This is important because browser automation has good keyboard support but no equally portable standardized virtual-gamepad path. Playwright emits keyboard events, including keydown/keypress/keyup behavior. citeturn13search9 The W3C Gamepad API, by contrast, exposes low-level physical-controller buttons and analog axes, with buttons in the 0–1 range and axes in the −1–1 range. citeturn13search1 WebDriver's standardized virtual input sources are `key`, `pointer`, `wheel`, and `none`, not gamepads. citeturn18search5 Chromium's current DevTools Protocol `Input` domain similarly exposes keyboard, mouse, touch, drag and gesture methods rather than a gamepad injection command. citeturn18search0

The practical conclusion is therefore an inference from those interfaces: **do not make OS-level gamepad emulation a prerequisite for the Gauntlet**.

Use app-level deterministic replay as the fidelity path. Separately test that:

```text
real keyboard → normalized InputFrame
real Gamepad API → normalized InputFrame
```

and use Playwright keyboard events to test the keyboard adapter. A very-early test stub for `navigator.getGamepads()` can be useful for adapter testing, but it should not be the mechanism by which core gameplay calibration is driven.

### Browser artifacts

Use different browser artifacts for different purposes.

**Screenshots and explicit frame sequences** should be the machine-evaluation format. Playwright can capture page/element images directly into files or buffers. citeturn19search3

**Video** is useful for human and multimodal review. Playwright can record a page's browser context and supports retaining recordings conditionally. citeturn12search6

**Playwright traces** should primarily be failure/debugging artifacts rather than something recorded on every high-volume run. Trace Viewer includes action timelines, screenshots, DOM snapshots, console output, network activity and source locations; Playwright itself cautions that recording traces for every test is comparatively heavy. citeturn19search4turn19search6

So the default policy could be:

```text
successful headless run      state + metrics only
successful browser smoke     keyframes only
failed browser smoke         keyframes + trace
promotion candidate          standardized frame sequences
ambiguous perceptual issue   frame montage + video
full human escalation        video + trace + metrics + state excerpts
```

That keeps the autonomous loop fast enough to iterate.

## Measurement, reference comparison, and critics

### Use a hierarchy of evaluation, not one reward

The project's reference research already contains a warning that should govern the entire Gauntlet: passing one metric is not enough. A candidate can reproduce `t_stop` yet look wrong because orientation snaps instantly, for example. Acceptance should combine metric agreement, the correct qualitative state sequence, and absence of compensating artifacts. fileciteturn0file3

I recommend five evaluation layers.

| Layer | Purpose | Examples |
|---|---|---|
| Hard invariants | Detect invalid simulation | NaN, teleport, impossible possession, out of bounds |
| Behavioral measurements | Match corpus observables | acceleration curve, ball decay, turn time |
| Temporal/state sequence | Match how behavior unfolds | brake → plant → pivot → reacelerate |
| Visual/perceptual | Match appearance and motion quality | body pose, animation transitions, camera |
| Match-level ecology | Prevent local improvements from breaking football | spacing, tempo, possessions, fouls, shot frequency |

The upper layers **cannot compensate for failures below them**.

For example:

```text
Candidate A:
acceleration reference error: excellent
ball teleport invariant: FAIL

Result: REJECT
```

not:

```text
0.95 acceleration score
+ 0.90 visual score
- 0.40 teleport penalty
= 0.81 overall → PASS
```

That kind of averaging is an invitation to metric gaming.

### Reference-target registry

The reference corpus should be converted into a versioned machine-readable registry:

```json
{
  "target_id": "LOC-ACC-001.t90",
  "behavior_family": "locomotion.acceleration",
  "observable": "time_to_90pct_speed",
  "reference": {
    "distribution": "...",
    "units": "seconds",
    "platform": "PC",
    "build": "retail",
    "capture_fps": 60
  },
  "uncertainty": {
    "measurement": 0.03,
    "identifiability": "A"
  },
  "confidence": "high",
  "acceptance_policy": "distribution-envelope-v1"
}
```

The reference-dataset research already proposes source records, frame/camera information, tracks, world reconstruction, events, measurements, uncertainty, test membership, and provenance. It also distinguishes A/B/C/D measurement classes: reliable public-video measurements, measurements with important uncertainty, quantities needing controlled input capture, and mainly perceptual properties. fileciteturn0file2

Gauntlet should preserve that classification:

```text
Class A → strong objective acceptance signal
Class B → objective signal, uncertainty-adjusted
Class C → diagnostic only until controlled reference exists
Class D → perceptual rubric / human or multimodal critic
```

This prevents the coding agent from treating a speculative measurement with the same authority as a high-confidence tracked trajectory.

### Comparing engine output to reference

Where the reference footage does not expose controller input, the correct question is generally **not**:

> “Does our player exactly follow the PES trajectory at every frame?”

The exact input that caused the PES trajectory is unknown.

The better question is:

> “Under an equivalent observable situation, are our output dynamics inside the measured PES behavioral envelope?”

That distinction is explicit in the reference research: an observed video result does not establish an exact hidden input-to-output transfer function. fileciteturn0file2

A metric gap can be represented conceptually as:

\[
gap_m =
\frac{d(C_m,R_m)}
{\max(s_m,u_m,\epsilon)}
\]

where:

- \(C_m\) is the candidate result or distribution,
- \(R_m\) is the reference distribution/envelope,
- \(d\) is a metric-specific discrepancy,
- \(s_m\) represents normal reference variability,
- \(u_m\) represents measurement uncertainty.

The precise formula should vary by observable. For acceleration it may involve several points on the curve; for stopping distance, an envelope; for team shape, several spatial descriptors. The important feature is that reference uncertainty lives **inside the evaluator**, rather than being thrown away when measurements are converted into targets.

For many metrics a simple quantile strategy will be more transparent than elaborate statistics:

```text
reference:
  Q05
  Q25
  median
  Q75
  Q95

candidate:
  same quantiles

evaluate:
  central tendency error
  spread error
  tail/pathology error
  fraction outside allowed envelope
```

This gives critics information that a single mean conceals.

### Selecting the “largest gap”

The desired loop explicitly calls for identifying the largest gap. That should happen at the **behavior-family level**, not by sorting hundreds of raw metrics.

Otherwise closely correlated acceleration measurements could occupy the first ten positions and crowd out a serious first-touch flaw.

A useful structure is:

```text
locomotion
  acceleration
  deceleration
  turning
  orientation

ball
  ground
  aerial
  spin
  contact

touch
  control distance
  latency
  orientation sensitivity

duels
  collision response
  balance
  tackling
  interception

team
  shape
  transition
  pressing
  off-ball movement

presentation
  camera
  animation
  rendering
```

Then derive a priority for a gap using factors such as:

```text
severity of observed deviation
× reference confidence
× project importance
× reproducibility
× expected leverage
÷ estimated experiment cost
```

I would **not** expose that as a sacred scalar reward to the implementer. It is an orchestrator heuristic for choosing where to work next.

The critique returned to the implementer should say something more useful:

```json
{
  "priority_family": "locomotion.turning",
  "evidence": [
    "90° cut loses 11% less speed than reference envelope",
    "body heading converges 140 ms too early",
    "45° cut is already inside target envelope"
  ],
  "confidence": 0.91,
  "likely_subsystems": [
    "turning capacity",
    "body-heading convergence"
  ],
  "do_not_regress": [
    "input-to-intent latency",
    "45-degree cut speed retention"
  ]
}
```

That is a much better agent-computer interface than giving a model 30,000 lines of logs.

This point is consistent with the SWE-agent research: its central finding was that the interface through which an LM interacts with the software-development environment materially affects its ability to navigate, edit and test repositories. citeturn8academia12 The implication for Gauntlet is that **evaluation must itself be designed as an agent-facing interface**, not merely as a collection of scripts.

### Objective gameplay critics

The **physics critic** should be almost entirely state-driven. It can inspect:

```text
v(t)
a(t)
orientation(t)
curvature
stopping distance
ball trajectories
contact impulses
ball-player separation
touch timing
collision outcomes
```

Its output should identify the earliest divergence, not simply grade the final outcome.

Example:

```text
Reference-like sequence:
sprint
→ brake begins
→ velocity falls
→ plant/pivot
→ body heading crosses 45°
→ movement vector crosses 45°
→ reaceleration

Candidate:
sprint
→ body heading snaps to 83°
→ brake begins
→ movement catches up

Physics critic:
wrong causal/state ordering even though final turn duration is in range
```

That distinction follows directly from the project's behavioral research separating immediate intent from constrained physical/body response. fileciteturn0file3

The **gameplay critic** works one level higher. It should inspect event sequences and grouped metrics:

```text
Was this first touch credibly controllable?
Did a short through ball reach usable space?
Did the press have a first/second defender structure?
Did defenders preserve shape instead of swarming?
Did possession emerge from ball interaction rather than ball parenting?
```

It can consume a compact state/event summary and reference annotations rather than the entire raw trace.

### Visual comparison

There are really three distinct visual-comparison problems, and they should not be conflated.

**Rendering regression** is candidate versus best-known browser build with the same scenario, camera, input trace, seed and tick. This is the domain where screenshot diffing works very well. Playwright has built-in screenshot comparison and stabilizes screenshot assertions before comparison, but its documentation warns that baselines need a consistent execution environment because rendering depends on OS, browser, hardware and headless settings. citeturn12search1turn20search1

**Aligned perceptual comparison** is candidate versus candidate/best or reference material that can be brought into close geometric and temporal alignment. Here perceptual metrics are useful. The LPIPS research showed that deep-feature distances correspond to human perceptual similarity better than several traditional shallow metrics on its perceptual benchmark. citeturn8search0

**Behavioral reference footage comparison** is different again. The PES camera, camera motion, player identities, scene geometry and precise action timing may differ. Raw pixel difference is therefore mostly noise. The reference-dataset pipeline's homography, pitch calibration, tracks and semantic events are much more useful for this problem. fileciteturn0file2

VMAF can be included as a tool, but only in the appropriate role. Netflix defines VMAF as a **full-reference** perceptual video-quality metric operating on reference/distorted picture pairs. citeturn17search3 It is therefore useful for aligned render/video-quality regressions, not as a generic metric of “how much this football gameplay resembles PES.”

A practical hierarchy is:

```text
Candidate vs same candidate baseline:
  pixel diff
  SSIM / perceptual feature distance
  optional VMAF for aligned clips

Candidate vs PES footage:
  world-space player/ball geometry
  event-relative timing
  registered pitch/camera geometry
  semantic frame montage
  multimodal critic
```

### Frame sequences are more useful than undirected video

For autonomous critique, I would generate standardized **event-centered frame strips**.

Example for a 90° turn:

```text
frame -12     frame -6      event 0       frame +6      frame +12
   │             │             │             │             │
pre-cut       braking       plant/pivot   direction     reaceleration
```

Alongside each image, provide telemetry:

```text
tick
speed
body heading
movement heading
ball distance
locomotion state
```

For team transition:

```text
loss -1s
loss 0s
+0.5s
+1.0s
+2.0s
+4.0s
```

This makes the visual critic's job substantially easier than asking it to find the relevant three seconds in a ten-minute match.

### Multimodal critic

A vision-capable OpenAI-compatible model can be used as the visual critic. OpenAI's current Responses API, for example, supports image inputs in model requests. citeturn14search3

But the visual model should be a **structured critic**, not a vibes generator.

A request should provide:

```text
reference frame strip
candidate frame strip

rubric:
  body orientation
  weight/momentum
  foot/ball separation
  first-touch plausibility
  transition continuity
  team geometry
  camera behavior

return:
  discrepancy
  severity
  confidence
  evidence frame indices
  whether difference is likely simulation / animation / camera
```

Example output:

```json
{
  "findings": [
    {
      "dimension": "body_orientation",
      "severity": 3,
      "confidence": 0.88,
      "evidence": ["candidate:+6", "reference:+6"],
      "observation": "Candidate torso has already aligned to the exit path while the reference retains a planted intermediate pose.",
      "likely_layer": "locomotion-animation coupling"
    }
  ]
}
```

For pairwise judging, A/B order should be randomized and periodically reversed. Systematic studies of LLM judges have found position bias in pairwise comparisons, making order-counterbalancing a sensible precaution. citeturn17academia24

A particularly strong design is to run the visual critic in two passes:

```text
Pass A: blind visual critic
  only images/video + neutral rubric
  no candidate name
  no metric score
  no source code

Pass B: synthesis critic
  receives visual findings + objective metrics
  reconciles disagreements
```

This prevents the visual critic from merely rationalizing the objective score.

### Detecting metric gaming and reward hacking

This deserves explicit architecture because an autonomous implementer sees feedback from the evaluation system.

“Reward hacking” broadly describes optimizing the specified metric while violating the intended goal; it has long been recognized as a practical AI-safety failure mode. citeturn9academia15 More recent experiments have also demonstrated that sufficiently capable language-model systems can exhibit forms of specification gaming and even reward-mechanism tampering in specially designed environments. citeturn9academia16 That does not mean a coding agent will automatically attack Gauntlet, but it strongly argues against allowing the optimizer to rewrite its own measuring instrument unrestrictedly.

The defenses should be structural.

**The reference corpus and acceptance evaluator must be read-only to the implementer.**

```text
implementer MAY edit:
  src/sim/**
  src/ai/**
  src/render/**
  src/input/**
  game configuration

implementer MAY NOT edit:
  eval/reference/**
  eval/acceptance/**
  eval/heldout/**
  baselines/best.json
  promotion logic
```

Evaluator-maintenance work should be a different explicitly authorized task.

Then combine several independent signals:

```text
objective physical metrics
+ semantic sequence checks
+ hard pathologies
+ visual/perceptual checks
+ whole-match ecological metrics
+ held-out scenarios/seeds
```

Include **metamorphic and invariant tests** that do not depend on PES numbers:

```text
same seed + same inputs → same trajectory
mirror-symmetric scenario → appropriately mirrored behavior
zero input → no spontaneous player command
ball cannot teleport between controllers
possession change requires a valid interaction/contact event
state cannot contain NaN/Infinity
no player exceeds physical/configured hard bounds
```

Also create a small **evaluator canary suite** of intentionally broken versions or fixtures. If turning off ball friction, snapping heading instantly, parenting the ball permanently to the player, or making every defender chase the ball does not cause expected tests to fail, the evaluation harness itself is incomplete.

That is one of the best defenses against a subtler form of metric gaming: not malicious tampering, but the implementer accidentally finding a cheap shortcut that satisfies the currently observed metric.

## Agent topology and implementation with OpenCode or Pi

### Roles should have different authority

I recommend six operational roles, but they need not all be expensive persistent LLM sessions.

| Role | Reads | Writes | Main responsibility |
|---|---|---|---|
| Orchestrator | reports, metrics, git state | experiment metadata | Chooses next gap and controls lifecycle |
| Implementer | code + selected critique | game code | Makes one coherent candidate change |
| Physics critic | state traces + targets | none | Detects physical/kinematic discrepancy |
| Gameplay critic | metrics/events/reference | none | Assesses football behavior |
| Visual critic | frames/video/rubric | none | Assesses perceptual behavior/presentation |
| Regression critic | candidate/best reports | none | Vetoes regressions and reward gaming |

The **orchestrator should preferably not modify gameplay code**. Its job is to decide.

The **implementer should not own the evaluation definition**.

The critics should be read-only and, where useful, deliberately deprived of source-code context so that they judge outcomes rather than implementation elegance.

This resembles patterns already appearing in agentic software systems. SWE-agent emphasizes a purpose-built agent-computer interface for repository navigation, editing and test execution. citeturn8academia12 OpenHands similarly separates the agent from a controlled execution environment and supports coordination, sandboxed execution and benchmark evaluation. citeturn8academia14 The lesson for Gauntlet is not that either framework should replace OpenCode/Pi; it is that **tool design, execution isolation and machine-readable evaluation are first-class architectural concerns**.

### Keep the evaluator interface agent-agnostic

The most important practical decision is to put the Gauntlet behind a stable CLI/API rather than embedding its logic into an OpenCode or Pi prompt.

For example:

```bash
gauntlet status

gauntlet build

gauntlet run \
  --scenario LOC-T90-001 \
  --candidate HEAD \
  --seed 18427

gauntlet batch \
  --suite locomotion.turning \
  --candidate HEAD

gauntlet compare \
  --candidate run_0184 \
  --baseline best

gauntlet browser \
  --scenario LOC-T90-001 \
  --frames semantic

gauntlet critique \
  --run run_0184 \
  --critics physics,gameplay,visual

gauntlet regress \
  --candidate run_0184

gauntlet promote \
  --candidate run_0184

gauntlet report \
  --run run_0184 \
  --format json
```

Every command should have a structured JSON mode:

```bash
gauntlet compare ... --json
```

The orchestrator should consume the compact JSON result, not scrape prose terminal output.

This means the same core Gauntlet works with:

```text
OpenCode
Pi
a human developer
CI
a parameter optimizer
another future coding agent
```

without rewriting the evaluator.

### OpenCode mapping

Current OpenCode has native concepts that fit this topology unusually well. It supports primary agents and subagents; custom agents can have their own prompts, models and permissions. citeturn15view0 Current permission configuration can independently allow, ask or deny editing, shell access, task/subagent calls and other tools, including per-agent overrides. citeturn11search0 It also supports controlling which subagents an orchestrator may invoke through task permissions. citeturn16view4

A project layout could therefore include:

```text
.opencode/
  agents/
    gauntlet-orchestrator.md
    gauntlet-implementer.md
    physics-critic.md
    gameplay-critic.md
    visual-critic.md
    regression-critic.md
```

Conceptually:

```yaml
# gauntlet-implementer
mode: subagent
permission:
  edit:
    "src/**": allow
    "eval/**": deny
    "reference/**": deny
  bash:
    "npm test*": allow
    "gauntlet *": allow
    "git diff*": allow
    "git push*": deny
```

and:

```yaml
# physics-critic
mode: subagent
permission:
  edit: deny
  bash:
    "gauntlet report*": allow
    "gauntlet trace*": allow
```

OpenCode's current agent configuration also includes an agent `steps` limit, allowing an individual agent's iterative actions to be bounded. citeturn15view0 That is useful as a local safety/cost bound, although Gauntlet should still implement its own higher-level iteration and stagnation budgets.

OpenCode can also use custom OpenAI-compatible providers: its provider configuration uses the OpenAI-compatible AI SDK adapter and permits a configurable `baseURL` and model definitions. citeturn16view0 Therefore the architecture is not tied to one provider.

For OpenCode I would keep the initial integration simple:

```text
OpenCode agent
    │
    └── bash → gauntlet CLI → JSON
```

Only after the evaluator stabilizes would I consider wrapping Gauntlet commands as dedicated custom/MCP tools. The CLI is easier to test, version, invoke from CI and reuse outside the coding agent.

### Pi mapping

Pi is a good fit when the goal is to implement more of the orchestration **as TypeScript code** rather than through declarative agent configuration. Its current project consists of a coding-agent CLI, an agent runtime with tool calling/state management, and a unified multi-provider LLM API. citeturn10search0

Pi extensions are particularly useful for Gauntlet. They can register tools callable by the model, subscribe to lifecycle events, intercept or modify tool calls, define commands, inject context and persist state across sessions. citeturn10search5

A project-local extension could expose:

```ts
pi.registerTool({
  name: "gauntlet_run",
  // ...
});

pi.registerTool({
  name: "gauntlet_compare",
  // ...
});

pi.registerTool({
  name: "gauntlet_regression",
  // ...
});

pi.registerTool({
  name: "gauntlet_promote",
  // ...
});
```

The extension can hide raw artifact complexity and return only:

```json
{
  "status": "candidate_improved",
  "largest_remaining_gap": "touch.receiver_orientation",
  "regressions": [],
  "artifacts": ["run_0184"]
}
```

Pi also allows custom provider/model configuration for APIs with OpenAI compatibility and exposes compatibility settings for partially compatible endpoints. citeturn10search6

There is, however, one meaningful architectural difference. Pi's current documentation states that it does **not** itself provide a built-in filesystem/process/network permission system and recommends containerization or another sandbox when stronger boundaries are required. citeturn10search1 Consequently:

```text
OpenCode:
native per-agent permissions can enforce many Gauntlet boundaries

Pi:
enforce critical boundaries with
  container / filesystem mounts / wrapper process
  + extension-level tool interception
```

For example, an implementer container can mount:

```text
/work/src          read-write
/work/eval         read-only
/work/reference    read-only
/work/baselines    read-only
```

while the orchestrator alone owns promotion metadata.

### Which one is a better starting point?

For this specific architecture:

| Requirement | OpenCode | Pi |
|---|---|---|
| Named critic roles | Excellent native fit | Implement through sessions/prompts |
| Per-role edit restrictions | Native permissions | External sandbox recommended |
| Different models per role | Native | Supported |
| OpenAI-compatible endpoint | Supported | Supported |
| Custom evaluator tools | Shell/custom tools | Excellent extension API |
| Programmatic orchestration | Possible | Particularly attractive |
| Rapid initial setup | **Best fit** | Good |
| Highly customized agent runtime | Good | **Best fit** |

My recommendation is therefore:

**Start with OpenCode if the first objective is to prove the autonomous evaluation loop quickly. Start with Pi if the project already intends to develop the orchestration layer itself as a programmable agent application.**

The underlying `gauntlet` evaluator should remain identical either way.

### Model allocation

Do not use the strongest available model for every evaluation action.

A cost-effective hierarchy is:

```text
cheap/fast model:
  classify test failures
  summarize numeric deltas
  routine regression report

standard coding model:
  implement candidate changes
  reason about localized failures

vision-capable model:
  semantic frame critique

stronger reasoning model:
  critic disagreement
  repeated stagnation
  cross-subsystem problems
  architectural changes

human:
  unresolved subjective fidelity
  evaluator ambiguity
  repeated reward-gaming symptoms
```

OpenCode's agent configuration explicitly permits assigning different models to different agents. citeturn15view0 Pi's unified provider layer similarly enables model selection through its configured providers. citeturn10search0turn10search6

If OpenAI itself is the provider, the Responses interface already supports image inputs and tool/function integration, which is sufficient for a frame-based visual critic. citeturn14search3 OpenAI also exposes an Evals API with eval definitions, runs and model-based graders; that could be useful for evaluating the **critic prompts themselves**, although I would keep the game-specific simulation evaluator local because it must manipulate large deterministic state artifacts and domain-specific metrics. citeturn14search4

## Loop control, branching, regression, and stopping

The outer loop should behave more like a miniature experimental system than an unconstrained conversation.

### Candidate lifecycle

Use an explicit state machine:

```text
BEST KNOWN
    │
    ▼
DIAGNOSE
    │
    ▼
SELECT LARGEST GAP
    │
    ▼
FORM HYPOTHESIS
    │
    ▼
CREATE CANDIDATE BRANCH / WORKTREE
    │
    ▼
IMPLEMENT
    │
    ▼
FAST GATES
    ├──── fail ───────────────► REJECT
    │
    ▼
TARGETED HEADLESS EVAL
    ├──── worse ──────────────► REJECT
    │
    ▼
BROWSER / PERCEPTUAL CHECK IF NEEDED
    ├──── fail ───────────────► REJECT
    │
    ▼
FULL REGRESSION
    ├──── regressions ────────► REJECT / REVISE
    │
    ▼
PROMOTE
    │
    ▼
NEW BEST KNOWN
```

The implementer never edits the best-known version in place.

### Fast, targeted, and deep evaluation tiers

Running every piece of evaluation after every three-line patch would be wasteful. Use progressive gates.

**Fast gate**

```text
build/typecheck
determinism smoke
NaN/invariant tests
one or two target scenarios
```

**Target suite**

```text
all scenarios in the affected behavior family
multiple deterministic seeds
relevant pathology tests
candidate-versus-best delta
```

**Deep candidate evaluation**

```text
cross-family dependencies
browser execution
semantic frame sequences
visual critic where relevant
```

**Promotion regression**

```text
full headless suite
browser smoke suite
held-out scenarios/seeds
critical visual baselines
match-level ecology
```

This also reflects Playwright's recommendation to reserve expensive trace recording primarily for troubleshooting rather than indiscriminately recording everything. citeturn19search6

### Best-known version

Maintain a machine-readable best record:

```json
{
  "commit": "91e3b2...",
  "tag": "gauntlet-best",
  "promoted_at": "...",
  "evaluator_version": "eval-v17",
  "reference_corpus": "pes17-corpus-v6",
  "scorecard": "artifacts/run_0172/scorecard.json"
}
```

Promotion should be atomic:

```text
candidate passes
→ store artifacts
→ create immutable commit/tag
→ update best.json
```

Rollback then means selecting the existing best commit, not asking an LLM to manufacture a reverse patch.

Every run should record enough provenance to reproduce it:

```text
candidate git SHA
parent best SHA
dirty-tree status
scenario version
input trace hash
seed
engine configuration hash
reference-corpus version
metric implementation version
Node/runtime version
browser/Playwright version when applicable
viewport/render settings
critic model and rubric version
```

This makes later statements such as “iteration 27 was better” falsifiable.

### Branching experiments

Not every problem should produce one sequential guess.

When there are competing hypotheses, create a limited experimental fork:

```text
largest gap:
90° turns are too frictionless

Hypothesis A:
increase heading-dependent braking

Hypothesis B:
reduce turning capacity above threshold speed

Hypothesis C:
alter desired-heading convergence
```

Run the same target suite on each branch:

```text
best ─┬─ experiment/A
      ├─ experiment/B
      └─ experiment/C
```

Select using the target behavior **plus neighboring regressions**, not just the metric directly affected.

Git worktrees are preferable to concurrent editing of one working directory:

```text
.worktrees/
  exp-a/
  exp-b/
  exp-c/
```

Each worktree gets an isolated Gauntlet artifact directory and agent session.

Parallelism should be used selectively. Three independently editing agents in the same working tree would create more orchestration noise than useful exploration. Parallel read-only critics, on the other hand, are naturally safe.

### Stagnation detection

The system should distinguish “we still have a large gap” from “our current approach has stopped improving it.”

Track, per behavior family:

```text
attempt count
accepted candidate count
best gap value
change per attempt
rejected-regression reasons
hypotheses attempted
files/subsystems repeatedly modified
critic disagreement
```

Flag stagnation when a configurable combination appears:

```text
no practically meaningful improvement for K experiments
same failure signature persists
same subsystem is repeatedly changed with no effect
candidate scores oscillate between two tradeoffs
target improves but regression vetoes repeatedly
physics and visual critics systematically disagree
```

OpenCode even has a narrower built-in `doom_loop` permission mechanism for repeated identical tool calls; Gauntlet's stagnation detector should operate at the more meaningful experiment/result level. citeturn11search0

Stagnation should switch the system out of implementation mode:

```text
STOP PATCHING
    │
    ▼
diagnostic experiment
    │
    ├── sensitivity sweep
    ├── state-divergence analysis
    ├── isolate subsystem scenario
    ├── compare best/candidate traces
    └── ask independent critic
```

Only after diagnosis should another implementation attempt begin.

### Sensitivity analysis before blind parameter tweaking

A useful automatic operation is:

```text
parameter p
→ evaluate p - 20%
→ evaluate p - 10%
→ baseline
→ evaluate p + 10%
→ evaluate p + 20%
```

Plot or summarize how target and neighboring metrics respond.

This tells the agent whether:

```text
the parameter actually controls the behavior
the sign of its effect is understood
the metric has saturated
the problem is structural rather than parametric
```

The implementation research already advocates staged parameter calibration and derivative-free approaches once variables interact. fileciteturn0file1

This is preferable to allowing an LLM to repeatedly choose magic constants based on one failed run.

### Regression policy

A regression critic should compare the candidate against **both the external reference and the previous best**.

Those answer different questions:

```text
candidate vs reference:
Are we more faithful?

candidate vs best:
What did this patch break?
```

A candidate should be rejected when:

```text
a hard invariant fails

OR

a previously passing high-confidence reference behavior
moves materially outside its accepted envelope

OR

a critical browser smoke test fails

OR

a perceptual pathology is introduced

OR

an improvement is achieved through a compensating artifact
```

The last criterion matters. For example:

```text
Target:
reduce stopping distance

Bad solution:
instantaneously rotate velocity vector and then brake

Scalar stopping metric:
PASS

state sequence / visual critic:
FAIL
```

This is exactly the failure pattern highlighted in the behavioral research. fileciteturn0file3

### Hold-outs

Split the reference-driven test corpus conceptually into:

```text
development set
  visible reports
  used to diagnose and iterate

regression set
  routinely run before promotion

held-out set
  used less frequently
  not included in detailed implementer feedback
```

The held-out tests need not remain permanently secret from humans; their purpose is to reduce direct optimization against every exact evaluator condition.

Similarly, vary seeds and scenario initializations within legitimate ranges so a candidate cannot accidentally overfit one starting configuration.

### Evaluation integrity

Promotion should immediately fail if the candidate modifies protected evaluator material:

```text
git diff best...candidate

if changes include:
  eval/reference/**
  eval/acceptance/**
  eval/heldout/**
  baselines/**
then:
  reject unless run explicitly classified as evaluator-maintenance
```

For OpenCode, per-agent edit permissions provide one enforcement layer. citeturn11search0 For Pi, filesystem/container isolation should provide it because Pi's own documentation recommends external sandboxing when permission boundaries are required. citeturn10search1

The system should also hash the evaluator and corpus into every run manifest. That way, a result obtained with `metric-v15` can never silently be compared as though it had been produced by `metric-v17`.

### Escalation

Escalation should occur on evidence, not simply after “the agent feels stuck.”

A good ladder is:

```text
routine model
    │
    ▼
additional deterministic experiment
    │
    ▼
independent critic
    │
    ▼
stronger reasoning model
    │
    ▼
broader diagnostic batch / visual review
    │
    ▼
human
```

Trigger stronger-model or human review when:

```text
critic disagreement remains high
reference identifiability is low
several architectures are equally plausible
three or more attempts trade the same regressions back and forth
the visual critic reports a major issue absent from metrics
the agent proposes changing evaluator/reference definitions
large cross-cutting architectural changes are required
```

A human escalation packet should already contain everything required to make a quick decision:

```text
problem statement
best and candidate commits
top metric deltas
reference confidence
key frame montage
candidate/best/reference clip
state trace around divergence
attempt history
agent hypotheses
```

The human should not have to replay the entire research process.

### Iteration budget

Track at least four budgets separately:

```text
candidate attempts
wall-clock evaluation time
LLM/model spend
expensive perceptual evaluations
```

Do not spend a vision-model call on every headless experiment.

A reasonable policy is:

```text
every edit:
  cheap fast gates

promising edit:
  target batch

promotion candidate:
  broad regression

visually relevant / ambiguous candidate:
  multimodal critic

stagnation / architecture problem:
  stronger model
```

This creates a natural funnel from cheap deterministic evidence toward expensive subjective evaluation.

### Stopping criteria

The outer Gauntlet should stop for success when all of the following are true:

```text
all hard invariants pass

high-confidence reference families
are inside their required envelopes

no critical regression remains

browser integration suite passes

visual/perceptual critics find no
high-severity unresolved discrepancy

the highest remaining gaps are below
the project's material-improvement threshold
```

It should stop without declaring success when:

```text
budget is exhausted

or

marginal improvement has remained below the
configured practical threshold for repeated experiments

or

remaining discrepancies are dominated by low-identifiability
reference questions that cannot be resolved from the corpus
```

That last condition is important. The reference research explicitly recognizes properties that public video cannot identify reliably. fileciteturn0file2 The autonomous system should be capable of saying **“the evidence is insufficient”**, rather than manufacturing a target.

## Implementation blueprint

The most practical implementation is to build Gauntlet as a normal TypeScript/Node evaluation package alongside the football engine, then make OpenCode or Pi consumers of that package.

### Repository shape

A concrete layout could be:

```text
src/
  sim/
    world/
    locomotion/
    ball/
    contacts/
    tactics/
    keepers/
  input/
    input-frame.ts
    keyboard-source.ts
    gamepad-source.ts
    replay-source.ts
  render/
  app/

eval/
  cli/
    gauntlet.ts

  scenarios/
    locomotion/
    ball/
    touch/
    duels/
    team/
    keeper/
    match/

  runner/
    headless-runner.ts
    browser-runner.ts
    batch-runner.ts

  recording/
    state-recorder.ts
    event-recorder.ts
    state-hash.ts

  metrics/
    locomotion/
    ball/
    touch/
    contact/
    tactics/
    tempo/
    presentation/

  invariants/
    determinism.ts
    finite-state.ts
    ball-continuity.ts
    bounds.ts

  comparison/
    reference-targets.ts
    compare-distribution.ts
    candidate-delta.ts
    scorecard.ts

  browser/
    playwright.config.ts
    bridge.ts
    captures.ts

  visual/
    montage.ts
    perceptual.ts
    multimodal-critic.ts

  critics/
    physics.ts
    gameplay.ts
    regression.ts

  reference/
    corpus-manifest.json
    targets/
    uncertainty/
    rubrics/

  suites/
    smoke.json
    targeted/
    regression.json
    heldout.json

  promotion/
    best.ts
    integrity.ts

artifacts/
  # generated / gitignored

baselines/
  best.json

.opencode/
  agents/
    ...

.pi/
  extensions/
    gauntlet.ts
```

The **simulation package must remain importable without the browser package**. That is the architectural hinge on which fast autonomous evaluation depends, and it follows the design direction in both the initial vision and the simulation-implementation research. fileciteturn0file0 fileciteturn0file1

### Run artifact format

Every Gauntlet run should be a self-contained directory:

```text
artifacts/run-000184/
  manifest.json
  inputs.bin
  metrics.json
  scorecard.json

  state/
    events.jsonl
    hashes.jsonl
    snapshots/

  browser/
    frames/
    video.webm
    trace.zip

  critics/
    physics.json
    gameplay.json
    visual.json
    regression.json

  report.md
```

`manifest.json`:

```json
{
  "run_id": "run-000184",
  "candidate_commit": "abc123",
  "best_commit": "def456",

  "scenario_suite": "locomotion.turning",
  "seeds": [42, 43, 44, 45],

  "simulation": {
    "fixed_dt": 0.0166666667,
    "config_hash": "...",
    "input_trace_hash": "..."
  },

  "evaluation": {
    "metrics_version": "...",
    "reference_version": "...",
    "suite_version": "..."
  },

  "runtime": {
    "node": "...",
    "playwright": "...",
    "browser": "..."
  }
}
```

That provenance is especially important because the reference corpus itself is version/platform sensitive and explicitly recommends retaining metadata such as platform, game build, speed settings, camera, difficulty and other contextual variables. fileciteturn0file3

### Scorecard format

The agent-facing comparison report should be compact:

```json
{
  "candidate": "abc123",
  "baseline": "def456",

  "hard_gates": {
    "passed": true,
    "failures": []
  },

  "improvements": [
    {
      "family": "locomotion.turning",
      "metric": "turn90.speed_retention",
      "before_gap": 1.42,
      "after_gap": 0.51,
      "confidence": "high"
    }
  ],

  "regressions": [
    {
      "family": "locomotion.deceleration",
      "metric": "stop.distance",
      "severity": "minor"
    }
  ],

  "largest_gap": {
    "family": "locomotion.turning",
    "dimension": "body_heading_lag",
    "severity": 0.71,
    "confidence": "high"
  },

  "promotion": {
    "eligible": false,
    "reason": "target suite improved; regression suite not yet run"
  }
}
```

The LLM should rarely need to ingest raw state unless a critic explicitly asks for a diagnostic slice.

### Browser environment

Pin the browser regression environment:

```text
container image
Node version
Playwright version
browser binary
viewport
device scale factor
fonts
locale
timezone
camera preset
render quality
```

Playwright ties releases to specific browser binaries and provides installation mechanisms for those browser versions. citeturn12search4 Since Playwright explicitly warns that screenshot output can vary across host environments, this pinning is necessary if pixel/perceptual deltas are to have meaning. citeturn20search1

Run a separate cross-browser compatibility suite periodically because Playwright supports Chromium, Firefox and WebKit, but do **not** require cross-browser pixel identity. citeturn20search4

The primary deterministic visual baseline should use one designated browser/container.

### Reference footage pipeline integration

Do not make the coding loop rediscover the source footage on every iteration.

The existing reference-data work already defines the appropriate offline pipeline:

```text
source video
→ timestamp/frame audit
→ camera/pitch calibration
→ 2D tracking/events
→ world reconstruction
→ measurements + uncertainty
→ reference distributions
```

fileciteturn0file2

Gauntlet consumes the final versioned products:

```text
reference metrics
semantic event clips
reference frame strips
world-space tracks
confidence
uncertainty
provenance
```

Raw source material remains available for critic escalation, but normal numeric evaluation should not require repeated computer-vision extraction.

This cleanly separates two systems:

```text
REFERENCE LAB
PES footage → evidence and target distributions

GAUNTLET
our build → matching measurements → comparison
```

That separation is crucial for reproducibility.

### Visual toolchain

A pragmatic visual stack is:

```text
Playwright
  screenshots
  frame sequences
  video
  traces

FFmpeg
  clip extraction
  frame normalization
  montage creation

simple image metrics
  pixel difference
  SSIM where appropriate

perceptual image metric
  LPIPS-style deep feature comparison for aligned images

full-reference video metric
  VMAF only where sequences genuinely align

vision-capable LLM
  semantic/perceptual critic
```

LPIPS is supported by published perceptual-similarity research, while VMAF remains explicitly a full-reference video-quality tool and should not be promoted to a football-behavior metric. citeturn8search0turn17search1

### Self-testing the evaluator

Before giving the evaluator to an autonomous coding model, test Gauntlet itself.

Create known fixtures:

```text
good baseline

mutant: acceleration doubled
mutant: no deceleration
mutant: instant 180-degree heading
mutant: ball ground friction zero
mutant: ball parented to player
mutant: touch always traps at foot
mutant: all defenders chase ball
mutant: camera has zero smoothing
```

Then require:

```text
every mutant is caught by at least
one expected high-confidence test

and

unrelated metric families remain stable
where expected
```

This is effectively a coverage test for behavioral evaluation.

A coding agent should not be admitted to fully autonomous iteration until Gauntlet can reliably tell obviously bad football from the baseline.

### Build order

The architecture should be implemented incrementally.

**Foundation**

First extract or enforce the deterministic simulation boundary:

```text
fixed-step sim
seeded PRNG
stable ordering
serializable state
input-frame abstraction
state hashes
headless entry point
```

This is the highest-leverage work. Without it, everything downstream becomes slower and harder to diagnose. The simulation implementation research explicitly makes determinism and headless execution prerequisites for calibration. fileciteturn0file1

**Measurement lab**

Implement a small number of exceptionally informative scenarios:

```text
acceleration
sprint → stop
90° turn
ground ball decay
fast first touch
```

For each, prove:

```text
deterministic replay
telemetry
state trace
metric extraction
reference comparison
candidate-vs-best comparison
```

Do not start with a 90-minute autonomous match.

**Browser bridge**

Add Playwright and `window.__GAUNTLET__`:

```text
load deterministic scenario
feed replay input
step exact ticks
read state
capture exact frame
```

Then add keyboard-adapter E2E tests.

**Regression architecture**

Implement:

```text
run manifests
best.json
protected evaluator
fast/target/full suites
candidate rejection/promotion
git branch/worktree controller
```

At this point a human should be able to execute the complete Gauntlet lifecycle from the CLI.

**Autonomous agent**

Only then add the OpenCode agents or Pi extension:

```text
diagnose
→ identify gap
→ implement
→ run target
→ inspect critics
→ regress
→ promote/reject
```

The first autonomous test should be deliberately narrow, for example:

> adjust acceleration calibration while preserving top speed and deceleration.

Success means the agent can improve that family and autonomously reject a tempting change that breaks neighboring metrics.

**Visual critic**

After deterministic evaluation works, add semantic frame strips, perceptual metrics and multimodal critique. OpenAI's image-capable Responses interface is technically sufficient for this kind of image analysis when OpenAI is used as the model provider. citeturn14search3

**Batch optimization and branching**

Finally add:

```text
parameter sensitivity sweeps
automatic multi-candidate branches
derivative-free numeric search
critic disagreement handling
stagnation detection
strong-model/human escalation
```

This order keeps complexity proportional to actual demonstrated needs.

### Minimum viable Gauntlet

A very useful definition of the MVP is not “the agent can autonomously build the whole football game.”

It is:

```text
Given:
  best-known commit B
  one deterministic reference-backed scenario S
  one replay input I
  one measurable gap G

The system can autonomously:

  build B
  run S
  capture state
  measure G
  create candidate C
  run the identical S/I
  measure the candidate
  identify whether G improved
  detect neighboring regression
  reject or promote C
  reproduce the decision later
```

Once that works, scaling from one scenario to fifty is primarily an evaluation-content problem rather than an architectural gamble.

### Recommended final architecture

The full Gauntlet should therefore have these concrete components:

| Component | Responsibility |
|---|---|
| `sim-core` | Fixed-step deterministic football simulation |
| `InputFrame` | Device-independent normalized input |
| `ReplayInputSource` | Tick-perfect deterministic control |
| Scenario DSL | Reproducible isolated and full-match experiments |
| Headless Runner | Faster-than-realtime simulation batches |
| State Recorder | Tick/event/snapshot/hash telemetry |
| Metric Registry | Reusable domain-specific measurements |
| Reference Registry | PES distributions, envelopes, uncertainty, provenance |
| Comparator | Candidate vs reference and candidate vs best |
| Invariant Engine | Non-negotiable simulation correctness |
| Playwright Runner | Real browser integration |
| Browser Test Bridge | Exact stepping and state extraction |
| Capture Pipeline | Frames, montages, video, traces |
| Perceptual Layer | Aligned visual metrics |
| Multimodal Critic | Structured semantic visual judgment |
| Physics Critic | Raw-state trajectory diagnosis |
| Gameplay Critic | Football/event-level diagnosis |
| Regression Critic | Cross-suite veto and integrity checking |
| Experiment Manager | Branches, worktrees, manifests and budgets |
| Promotion Manager | Immutable best-known version and rollback |
| Orchestrator | Chooses largest actionable gap and controls loop |
| Implementer | Makes constrained source changes |
| Escalation Layer | Stronger model or human when evidence demands it |

The resulting autonomous cycle is slightly richer than the original desired loop:

```text
                IMMUTABLE BEST-KNOWN VERSION
                           │
                           ▼
                         BUILD
                           │
                           ▼
              DETERMINISTIC FAST SMOKE
                           │
                           ▼
                    RUN / OBSERVE
                 ╱                     ╲
          HEADLESS                    BROWSER
             │                           │
             └────────────┬──────────────┘
                          ▼
                       MEASURE
                          │
                          ▼
                COMPARE TO REFERENCE
                          +
                   COMPARE TO BEST
                          │
                          ▼
             INDEPENDENT CRITIC LAYERS
                          │
                          ▼
              IDENTIFY LARGEST VALID GAP
                          │
                          ▼
                    FORM HYPOTHESIS
                          │
                          ▼
                BRANCH / MODIFY ONCE
                          │
                          ▼
                  TARGETED RE-EVAL
                          │
             ┌────────────┴────────────┐
             │                         │
           WORSE                    PROMISING
             │                         │
           REJECT                DEEP EVALUATION
                                       │
                                       ▼
                                REGRESSION SUITE
                                       │
                         ┌─────────────┴─────────────┐
                         │                           │
                     REGRESSED                    CLEAN
                         │                           │
                       REJECT                     PROMOTE
                                                     │
                                                     ▼
                                           NEW BEST-KNOWN
                                                     │
                                                     ▼
                                             REPEAT / STOP
```

This architecture preserves the strongest principle emerging from all four project documents: **fidelity should be driven by repeatable observations and measurable external behavior, while uncertainty, presentation and perceptual judgment remain explicit rather than being hidden inside guessed constants.** fileciteturn0file0 fileciteturn0file1 fileciteturn0file2 fileciteturn0file3

It also fits the current capabilities of both requested agent hosts. OpenCode already provides specialized primary/subagents, per-agent models, tool permissions and task restrictions, plus OpenAI-compatible custom providers. citeturn15view0turn11search0turn16view0 Pi provides a programmable agent runtime, OpenAI-compatible provider configuration and a TypeScript extension mechanism capable of turning the Gauntlet evaluator into first-class model tools; where stronger filesystem boundaries are necessary, its own documentation recommends external sandboxing/containerization. citeturn10search0turn10search5turn10search6turn10search1

Most importantly, the architecture makes the desired autonomous loop **scientifically inspectable**. The agent does not improve the game because a model says the latest match “looks better.” It improves the game because a candidate has a reproducible provenance chain from code change to deterministic trajectory to measurement to reference comparison to independent criticism to regression-tested promotion—and the perceptual critic is there to catch exactly the qualities that numeric observables still fail to capture.

## Sources

Reconstructed from the document's citations (the `citeturnNsearchM` / `citeturnNviewM` / `fileciteturnNfileM` markers that appear inline in the body are unresolved export artifacts; this list recovers the real titles and URLs they pointed to, but does not reassign a citation number to each individual inline marker). `fileciteturn0fileN` markers refer to the project's own prior research documents (Vision, Simulation Techniques, Reference Measurement, and Behavior research) rather than external sources, and are not listed below.

1. Playwright — "Visual Comparisons" (docs) — https://playwright.dev/docs/next/test-snapshots
2. Playwright — "Page" (API docs) — https://playwright.dev/docs/next/api/class-page
3. Playwright — "BrowserContext" (API docs) — https://playwright.dev/docs/api/class-browsercontext
4. Playwright — "Actions" (docs) — https://playwright.dev/docs/next/input
5. W3C — "Gamepad" (spec) — https://www.w3.org/TR/gamepad/
6. W3C — "WebDriver" (spec) — https://www.w3.org/TR/webdriver/
7. Chrome DevTools Protocol — "Input" domain — https://chromedevtools.github.io/devtools-protocol/tot/Input/
8. Playwright .NET — "Screenshots" (docs) — https://playwright.dev/dotnet/docs/screenshots
9. Playwright — "Videos" (docs) — https://playwright.dev/docs/videos
10. Playwright — "Trace Viewer" (docs) — https://playwright.dev/docs/next/trace-viewer
11. Yang, J. et al. — "SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering" (arXiv) — https://arxiv.org/abs/2405.15793
12. Playwright — "PageAssertions" (API docs) — https://playwright.dev/docs/api/class-pageassertions
13. Zhang, R. et al. — "The Unreasonable Effectiveness of Deep Features as a Perceptual Metric" (CVPR 2018, LPIPS) — https://openaccess.thecvf.com/content_cvpr_2018/html/Zhang_The_Unreasonable_Effectiveness_CVPR_2018_paper.html
14. Netflix — "vmaf/libvmaf/README.md" (GitHub) — https://github.com/Netflix/vmaf/blob/master/libvmaf/README.md
15. OpenAI — "Developer Quickstart" (API docs) — https://platform.openai.com/docs/quickstart/make-your-first-api-request
16. "Judging the Judges: A Systematic Study of Position Bias in LLM-as-a-Judge" (arXiv) — https://arxiv.org/abs/2406.07791
17. Amodei, D. et al. — "Concrete Problems in AI Safety" (arXiv) — https://arxiv.org/abs/1606.06565
18. "Sycophancy to Subterfuge: Investigating Reward-Tampering in Large Language Models" (arXiv) — https://arxiv.org/abs/2406.10162
19. "OpenHands: An Open Platform for AI Software Developers as Generalist Agents" (arXiv) — https://arxiv.org/abs/2407.16741
20. OpenCode — "Agents" (docs) — https://opencode.ai/docs/agents/
21. OpenCode — "Permissions" (docs) — https://opencode.ai/docs/permissions
22. OpenCode — "Provider" (docs) — https://opencode.ai/docs/it/providers/
23. earendil-works — "pi-mono: AI Agent Toolkit" (GitHub) — https://github.com/earendil-works/pi-mono
24. Pi — "extensions.md" (coding-agent docs, GitHub) — https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md
25. Pi — "models.md" (coding-agent docs, GitHub) — https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md
26. earendil-works — "pi: AI Agent Toolkit" (GitHub) — https://github.com/earendil-works/pi
27. OpenAI — "Evals" (API reference) — https://platform.openai.com/docs/api-reference/evals/deleteRun
28. Playwright — "Best Practices" (docs) — https://playwright.dev/docs/best-practices
29. Playwright — "Browsers" (docs) — https://playwright.dev/docs/browsers
30. Playwright — "Installation" (docs) — https://playwright.dev/docs/intro
