# Building a Measurable PES 2017 Reference Dataset from Gameplay Footage

## Research conclusion

The existing `PES2017_GAMEPLAY_REFERENCE.md` already defines the behavioral questions and the Reference Test Catalog. This report treats those test IDs as fixed research inputs and **does not revisit or re-argue the gameplay behavior itself**. fileciteturn0file0

The core methodological conclusion is that public PES 2017 footage can support a surprisingly useful quantitative reference dataset, but only if the project distinguishes three things that are easy to conflate:

1. **What is directly observable from the delivered video:** presentation timestamps, image positions, pitch-relative trajectories, visible contacts, body pose, camera motion, possession transitions.
2. **What can be reconstructed with a measurement model:** world-space positions, velocities, accelerations, curvature, ground-ball speed decay, some bounce quantities, and—with considerably larger uncertainty—airborne ball trajectories.
3. **What cannot be identified without controller/gameplay instrumentation:** exact input onset, stick magnitude and angle, sprint-button state, pass/shot power-bar value, assistance mode, exact first-touch intent, tactical slider state, and causal sensitivity to a particular player attribute.

That distinction should govern the entire dataset. A public-video observation such as “the player entered this turn at 6.1 m/s, changed movement heading by approximately 86°, reached a minimum of 4.7 m/s, and completed the deflection in 0.43 s” is potentially useful. It is **not** evidence that “the user issued a 90° full-stick command at frame N.” The latter requires controlled input capture.

The recommended measurement architecture is therefore:

```text
source video
    ↓
timing / frame-integrity audit
    ↓
camera segment + pitch calibration
    ↓
manual / assisted 2D tracks and event labels
    ↓
pitch-space / camera-space reconstruction
    ↓
kinematic and trajectory estimators
    ↓
uncertainty propagation
    ↓
event-level measurements
    ↓
PES reference distributions / envelopes
```

The most important practical consequence is that **the raw video and raw annotations remain primary evidence**. Smoothed trajectories, velocity estimates, fitted decay models, and test summaries are derived products that must always be reproducible from those inputs.

For the five requested initial calibration targets, public footage is strongest for **ground-ball physics and gross locomotion**, useful but substantially noisier for **turning, first touch and passing**, and insufficient for any exact **input-to-output transfer function**. That should not stop the project: it means the first dataset should characterize *observable output envelopes*, while the catalog's class-C tests remain explicitly open for later controlled PES capture.

## Timing integrity and frame-accurate analysis

### “Frame accurate” needs a strict definition

For this project, frame accuracy should mean:

> **Every observation is indexed by the decoded frame's presentation timestamp and can be traced back to a particular decoded image.**

It should *not* mean that the footage reveals PES's internal simulation timestep or controller polling instant. Public video normally cannot establish either.

FFmpeg explicitly distinguishes timestamps from nominal frame rate. Its documentation states that an output `-r` operation may duplicate or drop frames to obtain a requested constant frame rate, while using `-r` as an input option can ignore stored timestamps and generate new ones under a constant-frame-rate assumption. FFmpeg also defines presentation time as PTS multiplied by the relevant time base. citeturn12search0turn12search1 PyAV exposes the same model: decoded frames carry `pts` and `time_base`, with presentation time equal to their product. citeturn19search0turn19search3

Therefore **never use `frame_index / advertised_fps` as the authoritative clock until constant cadence has actually been verified**.

For every source, run a stream-and-frame audit such as:

```bash
ffprobe \
  -v error \
  -select_streams v:0 \
  -show_streams \
  -show_frames \
  -of json \
  source.mp4 > source.ffprobe.json
```

Store at minimum:

```text
r_frame_rate
avg_frame_rate
stream time_base
decoded frame count
frame PTS
frame duration, when available
width / height
field order / interlace status
codec
```

`ffprobe` is specifically designed to expose stream information in machine-readable form. citeturn12search3

### Verify content cadence separately from container FPS

A file labeled 60 fps can contain:

- approximately 60 distinct source images per second;
- 30 distinct images, each represented twice;
- irregular duplicates inserted during a constant-frame-rate conversion;
- variable-frame-rate source material placed into another cadence;
- interpolated frames;
- blended/deinterlaced material;
- dropped source frames.

FFmpeg's own processing model demonstrates why the distinction matters: constant-frame-rate conversion can intentionally duplicate or drop images. citeturn12search0turn12search1

The dataset should therefore store **both**:

```text
container_timing
content_cadence
```

Recommended audit:

**First, exact duplicate detection.** Decode frames into a normalized pixel representation and hash the decoded pixels, not the compressed packet bytes. Adjacent equal hashes identify exact repeated images.

**Second, near-duplicate detection.** Recompression can make two visually repeated frames non-identical at the pixel level. Run an adjacent-frame image-difference measure—mean absolute difference, SSIM, block differences, or FFmpeg's `mpdecimate` logic—as a *candidate detector*, followed by visual review around suspicious cadence patterns. FFmpeg describes `mpdecimate` as removing near-duplicate frames. citeturn20search11

**Third, inspect the cadence pattern.** A repeated sequence such as:

```text
A A B B C C D D ...
```

is much stronger evidence of 30-content-fps material packaged at approximately 60 presentation frames/s than a handful of duplicates during menus or stationary play.

**Fourth, inspect motion.** Near-duplicate algorithms can misclassify genuine low-motion frames. Ball movement, player limbs, grass texture and camera movement make good local checks.

**Fifth, reject synthetic temporal material for high-precision kinematics.** If evidence suggests frame interpolation or extensive blended frames, the source can remain useful for perceptual or tactical tests but should not become a locomotion/ball-physics reference.

A useful source-level result is:

```json
{
  "reported_fps": "60000/1001",
  "pts_mode": "cfr",
  "content_cadence_estimate_hz": 59.94,
  "duplicate_fraction": 0.003,
  "duplicate_pattern": "sporadic",
  "interpolated_frames_suspected": false,
  "timing_grade": "verified"
}
```

Do **not** silently remove duplicates and then create a new artificial clock. Preserve the original PTS sequence. If a delivered frame repeats the preceding image, the physical interpretation is that no new visual sample was received at that presentation time.

### Source FPS may ultimately be unknowable

A downloaded/re-encoded public video can establish the cadence of the **delivered content**, but not necessarily the cadence at which the original console/PC was rendered or captured. Lossy encoding and frame-rate conversion can alter that provenance. FFmpeg itself documents lossy encoding as the normal case and supports timestamp/frame-rate transformations. citeturn12search0turn12search1

Accordingly, use three states rather than a Boolean:

```text
capture_fps_status =
    verified_original
    verified_delivered_cadence_only
    unknown
```

For most public uploads, `verified_delivered_cadence_only` is the honest maximum.

### Event times should sometimes be intervals

A blurred first touch may visibly occur between two unique frames rather than at an unambiguous frame. Do not force:

```text
contact_frame = 18342
```

when the evidence really says:

```text
contact_time_interval = [305.683 s, 305.700 s]
```

This becomes especially important for acceleration, goalkeeper-reaction and first-touch timing. The timing uncertainty then propagates into subsequent measurements instead of disappearing through annotation convenience.

## Pitch geometry, tracking and camera compensation

### Detect the pitch before measuring the players

The geometric backbone should be a known pitch template registered to every relevant camera segment.

SoccerNet's camera-calibration work uses semantic soccer markings as a calibration target. Its published tooling annotates pitch-line extremities and circle points, estimates homographies from field correspondences, and can further derive pinhole-camera parameters including distortion. Its benchmark evaluates camera solutions through image-space reprojection error. citeturn13search0

A robust PES pipeline should follow the same conceptual order:

```text
pitch-line detection
→ semantic line identification
→ pitch correspondence
→ homography / camera fitting
→ reprojection QC
→ world-space object projection
```

Automated line segmentation is useful as a proposal generator. SoccerNet's baseline itself uses semantic line segmentation before calibration and notes that line/ellipse correspondences can refine the result. citeturn13search0

For a small reference dataset, however, **human-verified calibration correspondences are worth the labor**. A slightly wrong homography contaminates every player and ball measurement simultaneously.

### Do not assume a universal 105 × 68 m pitch

The Laws of the Game allow ranges of pitch length and width; international matches also have ranges rather than one mandatory global size. Certain internal markings are fixed: the goal-area depth is 5.5 m, the penalty-area depth is 16.5 m, the penalty mark is 11 m from the goal line and circular markings use a 9.15 m radius. citeturn14search4

Therefore the PES dataset should not silently set:

```text
pitch_length = 105
pitch_width = 68
```

unless this has been independently established for the PES stadium/model under analysis.

Instead, use fixed markings as metric constraints wherever possible and attach a `pitch_template_id` to every camera solution. If full field length/width remains uncertain, local measurements near fixed markings can still be metric.

### Homography is the pixels-to-meters conversion

For a point on the playing surface, a planar projective transform gives:


\mathbf p_\text{pitch} \sim H^{-1}\mathbf p_\text{image}


depending on the stored direction of H.

OpenCV provides `findHomography` for estimating this transform and `perspectiveTransform` for mapping points. citeturn13search2 SoccerNet explicitly uses the planar nature of the pitch to motivate homography-based calibration. citeturn13search0

This means there should be **no global “meters per pixel” constant**. Perspective causes the metric scale represented by a pixel to depend strongly on image position.

A correctly calibrated transformation directly produces positions in the pitch template's units:

```text
pixel point → projective mapping → (x_m, y_m)
```

### Camera movement compensation falls out of per-frame calibration

PES broadcast cameras pan, tilt and zoom. Measuring screen velocity therefore mixes subject movement and camera movement.

The preferred compensation is not to subtract an estimated “camera pixel velocity”; it is to estimate a camera mapping H_t or full camera model for time t and express all ground-plane observations in the same pitch reference frame:


(x_t,y_t)=H_t^{-1}(u_t,v_t)


Then a stationary field point remains at the same world coordinate despite pan or zoom.

Camera solutions do not necessarily need to be independently solved from zero on every frame. A practical sequence is:

```text
manually verified calibration keyframe
→ automatic temporal propagation/refinement
→ periodic re-fit from visible markings
→ manual intervention after cuts or large zoom changes
```

Modern soccer-analysis pipelines explicitly treat camera motion, occlusion and real-world field localization as central challenges; SoccerNet's Game State Reconstruction benchmark, for example, asks systems to take raw broadcast footage and output player locations in field coordinates. citeturn19search6 BoT-SORT also incorporates camera-motion compensation into multi-object tracking, showing the importance of separating object motion from camera motion even before field registration is available. citeturn15academia49

Feature-based OpenCV/ECC/ORB registration can assist between well-calibrated frames, but for final PES measurements, **pitch markings should outrank crowd, advertising-board or grass-feature motion**, because the pitch is the coordinate system being measured.

### Player position means ground contact, not box center

A detector's bounding-box center is a poor world-space player location because much of the box represents body height above the pitch.

Use an explicitly annotated or inferred ground point:

```text
both feet visible     → midpoint of support/contact feet
one foot visible      → visible support foot, with flag
occluded feet         → lower-body model estimate + increased uncertainty
bounding-box bottom   → fallback only
```

The precise rule must be stored in `projection_method`.

### Player tracking should be semi-automatic

General MOT tools are valuable for producing candidate trajectories. ByteTrack's central idea is to retain and associate lower-confidence detections that would otherwise fragment tracks under occlusion. citeturn15search1turn15academia50 BoT-SORT combines appearance, motion and camera-motion compensation. citeturn15academia49 Soccer-specific research likewise identifies pan/tilt/zoom and player occlusion as core single-camera tracking problems. citeturn16search7

But automated ID continuity is not reference truth. PES creates particularly difficult cases:

- several teammates have almost identical kits;
- players cross and occlude one another;
- the camera may zoom out until players occupy few pixels;
- the ball is much smaller than the players;
- rapid cuts destroy track continuity.

For calibration clips, automatically track first, then manually validate **the actors involved in every selected event**.

### Ball tracking needs stricter manual review

The ball is the least forgiving object in the pipeline. A small localization error becomes a substantial velocity error after differentiation, especially at long camera distance.

For the initial dataset:

```text
automatic ball detector/tracker
        ↓
candidate trajectory
        ↓
manual inspection every frame near:
    kick/contact
    interception
    first touch
    bounce
    high acceleration
    occlusion
```

Do not linearly interpolate the ball across an unseen touch or bounce.

CVAT is well suited to this workflow because its video format supports persistent tracks, explicit keyframes and an `occluded` attribute. It also provides automated/AI trackers including SAM2-assisted video tracking. citeturn18search1turn18search0turn18search4 CVAT's standard interpolation mode linearly interpolates between manually annotated keyframes. citeturn18search8turn18search10 For this project, that is suitable for quiet motion but **should not bridge sharp turns, ball contacts, tackles or bounces**, where the motion itself is the measurement target.

## Kinematic, orientation and ball measurements

### Player velocity and acceleration

First reconstruct player ground positions in meters:


\mathbf x_i=(x_i,y_i),\qquad t_i=PTS_i \times timebase


Then estimate derivatives **in world coordinates and against the real timestamps**.

Do not use raw finite differences such as:


v_i=\frac{x_{i+1}-x_i}{1/60}


unless both the cadence and localization precision justify them. Differentiation amplifies position noise, and acceleration compounds that problem.

A better approach is a local polynomial fit in time. Savitzky and Golay's original method was expressly developed for smoothing and differentiation via local least-squares procedures. citeturn17search1turn17search7 In a PES pipeline, use an equivalent local polynomial/spline estimator and retain the fitting configuration in the dataset.

For irregular PTS spacing, fit directly as a function of the actual t_i, rather than pretending observations are equally spaced.

From the fitted curve:


v_x=\dot x,\quad v_y=\dot y



v=\sqrt{\dot x^2+\dot y^2}



a_x=\ddot x,\quad a_y=\ddot y


The dataset should distinguish:

- total acceleration magnitude;
- tangential acceleration, which changes speed;
- normal/lateral acceleration, which changes direction.

Avoid smoothing a trajectory straight through an event that legitimately introduces a discontinuity. Split the fit at ball contacts, collisions and other state boundaries.

### Turning, curvature and radius

For a world-space player path:


\kappa(t)=
\frac{|\dot x\ddot y-\dot y\ddot x|}
     {(\dot x^2+\dot y^2)^{3/2}}


and, where defined,


R(t)=\frac{1}{\kappa(t)}


Curvature becomes numerically unstable as speed approaches zero. Therefore a 180° reversal should **not** be reduced to a single minimum radius.

For every turn event retain:

```text
observed movement-heading change
entry speed
minimum speed
speed retention ratio
turn duration
path arc length
peak / median valid curvature
minimum valid radius
time to recover a specified fraction of post-turn speed
```

The “45°/90°/180°” public-video categories should initially mean **observed trajectory deflection bins**, not inferred controller-stick angles.

### Body orientation

Movement heading and body heading must be separate signals.

A player can travel diagonally while the torso remains open toward another direction. For body heading, pose estimation provides an automated starting point. OpenPose established multi-person 2D body-keypoint estimation from images. citeturn15search0turn15search2 Soccer-specific work has used shoulders and hips from monocular video to infer field-relative orientation; one published method reported a median error of 27° against wearable orientation data. citeturn16academia30 A later football orientation-classification approach reported median error below 12° on its evaluation data. citeturn16search3

Those results should **not** be transferred as assumed PES error bars. They demonstrate that monocular football-body orientation is estimable but nontrivial.

For PES footage, the sensible hierarchy is:

```text
high-resolution close player
    → pose-based continuous heading + manual verification

medium-resolution player
    → manual 8/16-bin orientation

small / occluded player
    → heading = unknown
```

Do not manufacture a continuous 137.4° value from a five-pixel-wide torso.

Store:

```text
body_heading_deg
body_heading_resolution_deg
orientation_method
orientation_confidence
```

### Ground-ball velocity decay

Ground passes are one of the strongest quantitative opportunities in public footage.

For a clearly rolling ball:

1. Annotate the ball position over the uninterrupted segment.
2. Transform to pitch coordinates.
3. Calculate cumulative path distance s(t).
4. Smooth s(t) or (x(t),y(t)) with an estimator whose parameters are recorded.
5. Derive v(t).
6. Exclude frames containing another touch.
7. Fit several descriptive candidate models rather than selecting a PES law in advance.

For example, compare:


v(t)=v_0-at


against:


v(t)=v_0 e^{-kt}


and against a non-parametric smooth curve.

The purpose is **model discrimination of the observed trajectory**, not a claim that PES internally uses friction model A or B. Store residuals and out-of-sample fit quality. If neither simple form fits, that is a useful result.

BALL-GND-001 is therefore a particularly high-value early test because the hidden controller input affects v_0, but does not prevent measurement of the subsequent v(t) once the ball is free.

### Airborne trajectory reconstruction

This is fundamentally harder.

A pitch homography only describes the ground plane. An airborne ball has a third coordinate z, so image position alone no longer has a unique inverse on that plane. Soccer camera-calibration work accordingly distinguishes planar homography from full pinhole camera parameters. citeturn13search0

Historic soccer-video work has reconstructed 3D ball positions using calibrated monocular broadcast cameras. citeturn17search6 More recent work explicitly frames monocular 3D ball trajectory reconstruction as an ambiguous 3D-from-2D problem and uses learned trajectory priors plus reprojection consistency to resolve it. citeturn17search0turn17search3 Recent SoccerNet 3D work similarly combines camera calibration with multi-view triangulation and investigates monocular ball localization using additional priors such as apparent ball size. citeturn17search11turn17search12

For PES reference work, use this hierarchy:


| Evidence                                              | Recommended result                              |
| ----------------------------------------------------- | ----------------------------------------------- |
| Homography only, airborne ball                        | Preserve 2D image trajectory; do not invent `z` |
| Full camera calibration + launch/landing visible      | Constrained 3D reconstruction, class B          |
| Full calibration + obvious bounce/contact constraints | 3D fit with uncertainty                         |
| Multiple synchronized views                           | Triangulated 3D, potentially much stronger      |
| Uncalibrated single public camera                     | Do not report precise metric apex height        |


Do **not** force real-world g=9.81m/s^2 and then call the resulting height a PES measurement. That would use a real-world physical assumption to manufacture the quantity the project is supposed to discover.

A flight model can be used as a *reconstruction prior*, but the resulting `z(t)` must be labeled model-dependent and the model assumption must be retained in provenance.

### Bounce measurements

For a visible first bounce, separate robust from fragile quantities.

Relatively robust with pitch calibration:

```text
bounce time interval
bounce ground position
horizontal speed before bounce
horizontal speed after bounce
horizontal speed ratio
incoming/outgoing horizontal direction
```

Much less robust from one public camera:

```text
pre-bounce vertical velocity
post-bounce vertical velocity
apex height before/after
3D incidence angle
spin
```

Do not call h_2/h_1 a coefficient of restitution. It is an observed height ratio conditioned on the reconstructed trajectory and potentially on spin.

### Passing and first touch

Passing and first-touch observations should be treated as **linked event chains** rather than separate unrelated clips:

```text
passer preparation
→ foot/ball contact
→ free ball trajectory
→ receiver approach
→ receiver/ball contact
→ post-touch ball trajectory
→ next controlled action
```

One well-annotated ground-pass event can therefore provide:

- pass release location;
- passer body orientation;
- ball initial world velocity;
- ground-ball decay;
- arrival velocity;
- pass travel time;
- receiver body orientation;
- first-touch displacement;
- post-touch ball speed/direction;
- latency to the receiver's next identifiable action.

That reuse is central to keeping the initial campaign small.

The dataset must nevertheless distinguish **pass endpoint** from **intended target**. With no input log, the actual destination is known; the intended target or lead point may not be.

## Uncertainty, hidden inputs and measurement validity

### Two different uncertainties must never be merged

Every result needs at least two independent quality concepts:

**Measurement uncertainty:** How uncertain are the quantities extracted from the video?

**Identifiability/causal status:** Even if the output is measured accurately, do we know what input or gameplay condition caused it?

These are not the same.

For example:

> Observed turn duration: tightly measured.

can coexist with:

> Exact controller turn angle: unknown.

Similarly:

> Ball release velocity: tightly measured.

does not imply:

> Pass power bar: known.

This separation is the main defense against accidentally “inventing PES parameters.”

### Measurement-error budget

For an event e, the principal uncertainty sources are:


| Source                           | Typical affected outputs                  |
| -------------------------------- | ----------------------------------------- |
| Frame PTS / cadence              | all timings and derivatives               |
| Duplicate or missing frames      | velocity, acceleration, event latency     |
| 2D player localization           | position, velocity, curvature             |
| Ball localization / blur         | ball speed, decay, bounce                 |
| Pitch correspondences            | every pitch-space quantity                |
| Lens distortion / camera model   | world coordinates, especially image edges |
| Player ground-point choice       | position and speed                        |
| Occlusion / identity switch      | trajectories                              |
| Body-pose ambiguity              | orientation                               |
| Smoothing / derivative estimator | velocity, acceleration, curvature         |
| 3D reconstruction prior          | airborne height and vertical velocity     |
| Event-boundary ambiguity         | reaction/touch/turn durations             |


Formal measurement practice distinguishes input quantities, a measurement model and propagation of uncertainty to derived outputs. The JCGM/BIPM Monte Carlo supplement specifically describes propagating distributions through a measurement model, and its multivariate extension covers joint output distributions. citeturn13search1turn13search6

For PES measurements, Monte Carlo propagation is preferable to a single hand-written “± pixel” formula because the pipeline is nonlinear:

```text
pixel annotations
    ↓
homography estimation
    ↓
perspective transform
    ↓
smoothing
    ↓
differentiation
    ↓
curvature / fitted ball parameters
```

A practical uncertainty run can:

1. perturb manually clicked field points according to annotation repeatability;
2. perturb player/ball clicks;
3. resample ambiguous event times inside their annotated intervals;
4. refit the camera;
5. reproject trajectories;
6. refit smoothing/trajectory models;
7. recompute the measurement.

Then store the empirical output distribution or covariance.

For example:

```json
{
  "metric": "entry_speed",
  "unit": "m/s",
  "estimate": 6.14,
  "uncertainty": {
    "method": "monte_carlo",
    "samples": 2000,
    "p025": 5.98,
    "p975": 6.31
  }
}
```

Those numbers are illustrative schema values, **not PES measurements**.

### Separate uncertainty from gameplay variability

Suppose ten observed passes have release speeds ranging from 11 to 17 m/s.

There are two distinct spreads:

```text
within-event uncertainty
= uncertainty about each measured pass

between-event variability
= PES actually producing different observed outcomes
```

Do not collapse both into one standard deviation.

Calibration should ultimately compare the independent engine against the **distribution of observed PES outcomes**, while separately accounting for how well each PES observation was measured.

### Missing controller inputs

Public footage without visible/logged controls must use:

```text
input_known = false
```

and leave exact input fields null.

Never populate:

```json
{
  "stick_angle_deg": 90,
  "stick_magnitude": 1.0,
  "pass_power": 0.62
}
```

because the observed player turned about 90° or the pass looked medium-powered.

Instead condition reference measurements on things actually observable:

```text
observed pre-turn speed
observed trajectory heading change
body heading before event
measured incoming ball speed
measured ball height class
measured passer orientation
moving/stationary receiver
pressure/occlusion state
```

That changes the statistical question from:

> “What does PES do after 90° stick input?”

to:

> “Among PES events exhibiting an approximately 90° world-trajectory direction change, what path, speed loss and turn duration are observed?”

The latter is valid for public footage. The former is class C.

### Controlled data should not replace public data

Controlled capture and public-match footage answer complementary questions.

Controlled input footage is best for causal transfer functions:

```text
input → response
attribute difference → output difference
slider/instruction → team behavior
```

Public-match footage is best for external validity:

```text
Does the calibrated behavior occur naturally
inside ordinary 11v11 sequences?
```

The eventual dataset should support both through an `input_evidence` field:

```text
none
visible_overlay
manually_logged
direct_input_log
scripted_test
```

## Tooling and automation policy

### Recommended technical stack


| Layer               | Recommended tools                              | Role                                                                  |
| ------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| Video audit         | FFmpeg, ffprobe                                | stream metadata, PTS, decoding, frame diagnostics                     |
| Programmatic decode | PyAV                                           | frame-by-frame decoded images with PTS/time base                      |
| General geometry    | OpenCV                                         | homography, perspective transforms, calibration, feature registration |
| Soccer calibration  | SoccerNet calibration tooling / related models | semantic pitch lines and camera fitting                               |
| Player tracking     | ByteTrack, BoT-SORT or equivalent              | candidate player trajectories                                         |
| Pose/orientation    | OpenPose or a modern pose estimator            | shoulders/hips/feet proposals                                         |
| Annotation          | CVAT                                           | tracks, keyframes, occlusion, review, assisted tracking               |
| Numerical fitting   | NumPy/SciPy or equivalent                      | local fits, derivatives, optimization                                 |
| Tabular storage     | Arrow/Parquet-compatible stack                 | typed event/track/measurement tables                                  |
| QC                  | Python plotting / notebooks                    | reprojection, trajectory and residual review                          |


FFmpeg and PyAV provide the timestamp-aware decoding foundation. citeturn12search3turn19search0 OpenCV directly implements homography estimation and perspective mapping. citeturn13search2 SoccerNet supplies a soccer-specific reference architecture for line localization, homography/camera estimation and reprojection evaluation. citeturn13search0 ByteTrack and BoT-SORT are strong candidate MOT foundations rather than PES-specific ground truth. citeturn15search1turn15academia49 CVAT provides persistent video tracks, keyframes, occlusion state and automated tracking aids. citeturn18search1turn18search3

### What should be automated

Automate the repetitive operations whose output can be reviewed objectively:


| Automate                           | Human QC requirement                 |
| ---------------------------------- | ------------------------------------ |
| ffprobe/PyAV timing extraction     | inspect anomalies                    |
| exact duplicate hashing            | none beyond audit                    |
| near-duplicate candidate detection | verify suspicious runs               |
| scene/camera-cut detection         | verify cut boundaries                |
| pitch-line proposals               | verify semantic identities           |
| camera/homography optimization     | verify reprojection overlay          |
| player detection/tracking          | verify event actors and ID switches  |
| ball candidate detection           | verify every calibration event       |
| world-coordinate projection        | automatic after accepted calibration |
| smoothing/derivatives              | inspect residuals                    |
| candidate ball-trajectory fitting  | inspect model adequacy               |
| Monte Carlo propagation            | inspect input uncertainty model      |
| dataset QC reports                 | review failures/exclusions           |


### What should remain manual for the first dataset

Reference-quality events justify manual labor at the points where a one-frame mistake changes the result:

- inclusion/exclusion of candidate calibration events;
- pitch correspondences on camera-calibration keyframes;
- player ground point around starts, stops and turns;
- ball centroid/contact location near passes, receptions and bounces;
- exact or interval-valued kick/contact/bounce timing;
- player identity across an important occlusion;
- body orientation around turns, passes and first touches;
- whether a ball is actually airborne;
- whether another unseen touch invalidated a ground-decay segment;
- metadata such as assistance mode or tactic settings—**only when genuinely evidenced**.

For the initial PES reference set, a correct semiautomatic dataset of dozens of events is more valuable than thousands of unreviewed model tracks.

### Reference-quality acceptance gates

An event should not become a calibration target merely because a number could be calculated.

Recommended hard gates:

```text
source timing audited
AND no unexplained duplicate/interpolation issue
AND camera solution accepted
AND relevant actor identity verified
AND event boundary reviewed
AND world trajectory has uncertainty estimate
AND no hidden contact inside measurement window
AND test's A/B/C/D status is respected
```

For world-space tests, additionally store reprojection QC. SoccerNet's calibration protocol explicitly evaluates camera models using reprojection distance between annotated pitch markings and the projected field model, making reprojection error a natural diagnostic here as well. citeturn13search0

## Reference Test Catalog measurability classification

The classifications below concern **whether the stated test can support its intended inference**, not whether some pixels can be extracted from a matching clip.

**A — measurable reliably from public video:** the principal output can be reconstructed with a sound video/geometry pipeline and hidden controls are not essential to the interpretation.

**B — measurable with significant uncertainty:** useful quantitative observations are possible, but pose, 3D ambiguity, occlusion, unknown triggering conditions or similar factors materially limit precision/causal interpretation.

**C — requires controlled gameplay/input capture:** the test depends on exact command timing, command magnitude, controlled matching, player-attribute isolation, assistance mode, or tactical settings that cannot normally be inferred from uncontrolled footage.

**D — primarily perceptual:** the catalog item is fundamentally about perceived feel rather than a uniquely defined physical observable.

These classifications are methodological judgments applied to the supplied Reference Test Catalog, rather than new claims about PES behavior. fileciteturn0file0 The distinction follows directly from the measurement limits above: homography makes ground coordinates measurable, monocular airborne reconstruction is ambiguous, body orientation is uncertain, and output footage alone does not expose controller input. citeturn13search0turn17search3turn16academia30


| Test ID            | Class | Measurement interpretation                                                                                                                                                             |
| ------------------ | -----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LOC-ACC-001**    | **B** | `x(t), v(t)` and an acceleration envelope are measurable from movement onset, but the exact sprint-command frame is unknown.                                                           |
| **LOC-ACC-002**    | **C** | Separating Speed from Explosive Power is a causal attribute-isolation experiment; uncontrolled players differ in many dimensions.                                                      |
| **LOC-MAX-001**    | **A** | A sufficiently long calibrated straight run can yield the observed velocity plateau; call it *observed maximum/plateau*, not an internal PES parameter.                                |
| **LOC-DEC-001**    | **B** | Stopping distance and visible braking are measurable; exact stick/sprint release is hidden.                                                                                            |
| **LOC-REV-001**    | **B** | An observed path reversal can be quantified well, but exact 180° command timing/magnitude cannot.                                                                                      |
| **LOC-T45-001**    | **B** | Entry speed, trajectory deflection, curvature and speed loss are measurable; controller angle is not.                                                                                  |
| **LOC-T90-001**    | **B** | Same limitation as T45; classify by observed world-space heading change.                                                                                                               |
| **LOC-ORI-001**    | **B** | Movement heading is strong; body heading depends on pose/image resolution and is substantially less certain.                                                                           |
| **LOC-BALL-001**   | **C** | A matched with-ball/without-ball penalty requires the same player/context and known sprint condition.                                                                                  |
| **PHY-SHLD-001**   | **B** | Relative positions, displacement and speed loss can be extracted; exact contact input/state remains hidden.                                                                            |
| **PHY-STR-001**    | **C** | “Strong vs agile” requires controlled player/context comparisons to attribute the difference.                                                                                          |
| **PHY-BC-001**     | **C** | Attribute-specific Body Control sensitivity needs controlled perturbations.                                                                                                            |
| **PHY-PC-001**     | **C** | Physical Contact sensitivity is intrinsically an intervention/comparison test.                                                                                                         |
| **BALL-IND-001**   | **A** | Free-ball intervals, contact sequence and independent trajectory can be quantified directly.                                                                                           |
| **BALL-GND-001**   | **A** | Uninterrupted ground-ball `x(t), v(t)` and decay are among the strongest public-video measurements.                                                                                    |
| **BALL-GND-002**   | **B** | Decay-vs-speed can be pooled from multiple passes, but initial spin/contact conditions are hidden and may confound the comparison.                                                     |
| **BALL-BNC-001**   | **B** | Bounce time/XY and horizontal speed changes are useful; vertical reconstruction is significantly less certain.                                                                         |
| **BALL-SPN-001**   | **B** | Curved airborne/rolling path is visible, but separating 3D geometry, spin and camera effects is difficult.                                                                             |
| **BALL-SPN-002**   | **C** | “Curve vs power” specifically requires known/repeated power input; measured initial velocity could support a different public-video test.                                              |
| **TOUCH-SLOW-001** | **B** | Incoming speed and post-touch trajectory are measurable; receiver intent/control input is unknown.                                                                                     |
| **TOUCH-FAST-001** | **B** | Same; incoming speed can be measured objectively, but action intent remains hidden.                                                                                                    |
| **TOUCH-BACK-001** | **B** | Body orientation, incoming ball and exit can be measured with orientation uncertainty.                                                                                                 |
| **TOUCH-90-001**   | **B** | Useful event geometry is measurable, though exact orientation and input intent are uncertain.                                                                                          |
| **TOUCH-WF-001**   | **C** | Weak-foot isolation requires repeatable forced-side receptions and known player/context.                                                                                               |
| **PASS-LOW-001**   | **B** | Actual release speed, trajectory, travel time and arrival can be measured; power bar, aim and assistance are unknown.                                                                  |
| **PASS-ANG-001**   | **C** | Quantifying the causal penalty from deliberately bad passer orientation requires matched, controlled attempts.                                                                         |
| **PASS-RUN-001**   | **B** | Receiver trajectory, lead distance and meeting point are measurable; intended target/assistance remains uncertain.                                                                     |
| **PASS-THR-001**   | **B** | Actual short-through-pass output is measurable, but command/assistance context is hidden.                                                                                              |
| **PASS-LOFT-001**  | **B** | 2D path/time is direct; metric 3D apex and launch components require model-dependent reconstruction.                                                                                   |
| **CROSS-HI-001**   | **B** | Same monocular 3D limitation as other aerial passes.                                                                                                                                   |
| **SHOT-PWR-001**   | **C** | A power-bar ladder cannot be reconstructed from video output alone.                                                                                                                    |
| **SHOT-IND-001**   | **C** | Player Kicking Power comparison needs matched aim/power/context conditions.                                                                                                            |
| **SHOT-SWV-001**   | **C** | Individual Swerve sensitivity requires controlled strike input and comparable geometry.                                                                                                |
| **HEAD-FREE-001**  | **B** | Contact timing/location and outgoing image/world-ground components are measurable; 3D heights and input timing remain uncertain.                                                       |
| **HEAD-DUEL-001**  | **B** | Contact winner, visible displacement and timing are observable, but 3D/contact-selection details add uncertainty.                                                                      |
| **TACK-ST-001**    | **B** | Visible lunge onset/contact/recovery can be measured; exact tackle-command time and internal active window cannot.                                                                     |
| **TACK-SL-001**    | **B** | Slide distance, visible contact and recovery are measurable; controller and collision internals are not.                                                                               |
| **TACK-ANG-001**   | **C** | A success curve versus controlled approach angle needs repeatable geometry/input.                                                                                                      |
| **INT-PASS-001**   | **B** | Defender movement, lane distance, ball speed and contact can be measured; decision trigger remains hidden.                                                                             |
| **INT-FAST-001**   | **C** | A causal interception-vs-pass-speed relationship needs matched geometry with controlled pass speeds.                                                                                   |
| **GK-REA-001**     | **B** | Shot contact to first visible keeper motion is measurable, but it is an *apparent response latency*, not necessarily neural/AI reaction time because anticipation may precede contact. |
| **GK-WF-001**      | **C** | Wrong-foot sensitivity requires deliberately repeated keeper-motion/shot-direction states.                                                                                             |
| **GK-LEG-001**     | **B** | Contact surface, timing and rebound path can often be annotated; 3D rebound reconstruction is uncertain.                                                                               |
| **GK-PARRY-001**   | **B** | Incoming/outgoing visible trajectories and contact region are useful, with substantial 3D/occlusion uncertainty.                                                                       |
| **GK-REC-001**     | **B** | Save → ground → second-action timing is directly observable, though initial state differs between natural events.                                                                      |
| **GK-HIGH-001**    | **B** | Takeoff/contact/catch sequences are measurable; aerial geometry and decision threshold are uncertain.                                                                                  |
| **OFF-RUN-001**    | **B** | World-space run onset/path is measurable, but autonomous vs user-triggered movement may be unknown.                                                                                    |
| **OFF-SUP-001**    | **B** | Support displacement and relative geometry can be measured; tactical context and intent are incomplete.                                                                                |
| **DEF-SHAPE-001**  | **B** | Visible defensive shape is quantifiable, but broadcast cropping and unknown tactics limit complete-team reconstruction.                                                                |
| **DEF-SHIFT-001**  | **B** | Centroid/line shifts can be measured over sufficiently visible sequences; cropping/tactics remain confounders.                                                                         |
| **PRESS-001**      | **B** | Natural pressing episodes can be quantified, but this does not identify a particular tactical-slider mapping.                                                                          |
| **PRESS-GG-001**   | **C** | To identify *Gegenpress instruction* behavior rather than generic post-loss pressure, the instruction state must be known.                                                             |
| **PRESS-REC-001**  | **C** | The abandonment/recovery rule for Gegenpress likewise needs a known active instruction and repeatable losses.                                                                          |
| **TACT-COMP-001**  | **C** | Compactness sensitivity requires known slider values or controlled settings.                                                                                                           |
| **TACT-DLINE-001** | **C** | Defensive Line mapping requires known/repeated tactical settings.                                                                                                                      |
| **TACT-SUP-001**   | **C** | Support Range mapping requires known/repeated tactical settings.                                                                                                                       |
| **TACT-TIKI-001**  | **C** | Tiki-taka instruction effect requires instruction on/off comparison.                                                                                                                   |
| **TACT-MARK-001**  | **C** | Tight Marking requires known assignment/instruction state.                                                                                                                             |
| **AI-ADAPT-001**   | **C** | Adaptation thresholds require intentionally repeated behavior over controlled sequences.                                                                                               |
| **AI-ADAPT-002**   | **C** | Same for repeated flank attacks and defensive adaptation.                                                                                                                              |
| **TRANS-AD-001**   | **B** | Ordinary attack→defense transitions can be quantified from possession changes, but tactical cause remains uncertain.                                                                   |
| **TRANS-DA-001**   | **B** | Ordinary defense→attack transition geometry/timing is measurable with context uncertainty.                                                                                             |
| **CTRL-LAT-001**   | **C** | True movement input latency requires an input timestamp; visible motion alone cannot recover it.                                                                                       |
| **CTRL-ACT-001**   | **C** | Pass/shoot command-to-action latency likewise requires input capture.                                                                                                                  |
| **CAM-FLW-001**    | **A** | Camera image motion, center shift, zoom change and pitch-relative camera solution can be measured directly.                                                                            |
| **CAM-PER-001**    | **D** | Pixel/world-speed differences are measurable, but the catalog's target is explicitly *perceived* speed; that requires perceptual evaluation rather than a unique physical metric.      |
| **TEMPO-001**      | **A** | Full-footage possession/event rates and duration distributions are directly measurable once event definitions are fixed.                                                               |
| **TEMPO-002**      | **A** | Transition durations can be measured repeatedly from complete footage under explicit event definitions.                                                                                |
| **TEMPO-003**      | **D** | “Fast but with weight” is an aggregate perceptual judgment; its component metrics should be measured separately rather than collapsed into a fictitious scalar.                        |


The resulting count is deliberately weighted toward **B and C**. That is desirable: it prevents the reference dataset from making stronger claims than the footage can support.

A useful rule is:

> **A/B measurements may become public-footage calibration targets. C tests may collect opportunistic observations, but cannot be marked causally calibrated until controlled evidence exists. D tests belong in perceptual validation, supported by their constituent quantitative measurements.**

## Canonical dataset and smallest initial campaign

### Canonical data model

The dataset should be relational/columnar internally rather than one giant JSON object. Store immutable source and annotation records, then derive measurement tables. JSON/YAML is appropriate for manifests; Arrow/Parquet-style typed tables are better for large per-frame records.

The minimum logical schema is:


| Table              | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `sources`          | immutable media provenance and gameplay metadata    |
| `frames`           | decoded PTS/cadence/duplicate audit                 |
| `camera_solutions` | homography/full-camera solutions and errors         |
| `tracks_2d`        | original player/ball annotations                    |
| `poses`            | body/foot/orientation annotations                   |
| `tracks_world`     | reconstructed metric coordinates                    |
| `events`           | semantic pass/turn/touch/bounce/etc. intervals      |
| `measurements`     | scalar/vector quantities derived from events        |
| `uncertainty`      | covariance/interval/Monte Carlo information         |
| `test_membership`  | mapping to Reference Test Catalog and A/B/C/D class |
| `provenance`       | software/model/annotator/derivation versions        |


#### Source records

```json
{
  "source_id": "PES17-SRC-0007",
  "media_sha256": "...",
  "title": "...",
  "platform": "PS4",
  "build": null,
  "build_confidence": "unknown",
  "camera_preset": null,
  "game_speed": null,
  "assistance_mode": null,
  "controller_visible": false,
  "input_evidence": "none",
  "width_px": 1920,
  "height_px": 1080,
  "codec": "h264",
  "reported_fps": "60000/1001",
  "capture_fps_status": "verified_delivered_cadence_only",
  "timing_grade": "verified"
}
```

Unknown metadata stays `null`; it should never be filled from expectation.

#### Frame records

```json
{
  "source_id": "PES17-SRC-0007",
  "decode_index": 18342,
  "pts": 305988,
  "time_base_num": 1,
  "time_base_den": 60000,
  "time_ns": 5099800000,
  "duration_ns": 16683333,
  "decoded_hash": "...",
  "duplicate_group_id": null,
  "unique_content": true,
  "near_duplicate_score": 0.03,
  "camera_cut": false,
  "decode_corrupt": false
}
```

Store integer/rational timing where possible; avoid making binary floating-point seconds the only authoritative timestamp. PyAV and FFmpeg explicitly represent media time through integer PTS values and rational time bases. citeturn19search0turn12search1

#### Camera solution records

```json
{
  "camera_solution_id": "CAM-00419",
  "source_id": "PES17-SRC-0007",
  "frame_start": 18310,
  "frame_end": 18370,
  "model": "homography",
  "pitch_template_id": "PITCH-TEMPLATE-03",
  "H_image_to_pitch": [9 values],
  "distortion_model": null,
  "field_correspondence_ids": ["FC-...", "FC-..."],
  "reprojection_error_px_median": null,
  "reprojection_error_px_p95": null,
  "method": "auto_fit_manual_verified",
  "valid": true
}
```

A full camera record can additionally carry K,R,t and distortion coefficients, following the same broad pinhole/distortion representation used in SoccerNet calibration. citeturn13search0

#### Raw 2D track records

```json
{
  "source_id": "PES17-SRC-0007",
  "frame_index": 18342,
  "entity_id": "PLAYER-HOME-10",
  "entity_type": "player",
  "bbox_xyxy": [842.1, 411.8, 878.0, 501.4],
  "ground_point_px": [860.6, 499.8],
  "ball_center_px": null,
  "occluded": false,
  "blur_grade": "low",
  "annotation_source": "manual_corrected",
  "annotation_confidence": 0.95
}
```

For balls, keep **center**, visible lower edge/contact point if available, and occlusion separately.

#### World track records

```json
{
  "source_id": "PES17-SRC-0007",
  "frame_index": 18342,
  "entity_id": "PLAYER-HOME-10",
  "coordinate_space": "pitch_xy",
  "x_m": 43.17,
  "y_m": 28.84,
  "z_m": null,
  "projection_method": "support_foot_homography",
  "covariance_xy_m2": [
    [0.004, 0.001],
    [0.001, 0.006]
  ],
  "derivation_version": "world-projector-0.3.1"
}
```

The values above are schema illustrations only.

#### Event records

Events should contain **time intervals and observable pre-state**, not only names:

```json
{
  "event_id": "EVT-002381",
  "source_id": "PES17-SRC-0007",
  "event_type": "first_touch",
  "test_ids": ["TOUCH-FAST-001", "PASS-LOW-001"],
  "start_time_ns": 5090000000,
  "end_time_ns": 5240000000,
  "primary_contact": {
    "t_min_ns": 5149000000,
    "t_max_ns": 5166000000
  },
  "actor_ids": ["PLAYER-HOME-10"],
  "ball_id": "BALL-1",
  "input_known": false,
  "input_evidence": "none",
  "pre_state": {
    "receiver_speed_mps": null,
    "receiver_body_heading_deg": null,
    "incoming_ball_speed_mps": null
  },
  "observability_class": "B"
}
```

#### Measurements

Use long-form measurements rather than adding a new table column for every experiment:

```json
{
  "measurement_id": "M-008821",
  "event_id": "EVT-002381",
  "test_id": "TOUCH-FAST-001",
  "metric": "post_touch_max_separation",
  "value": null,
  "unit": "m",
  "estimator": "touch-metrics-0.2.0",
  "measurement_space": "pitch_xy",
  "sample_window": {
    "start_offset_ms": 0,
    "end_offset_ms": 500
  },
  "uncertainty_id": "U-002217",
  "valid_for_calibration": true,
  "exclusion_reason": null
}
```

### Preserve raw, corrected and derived layers

Never replace the clicked point with the smoothed point.

The chain should remain:

```text
raw detection
    ↓
manual correction
    ↓
accepted annotation
    ↓
world projection
    ↓
smoothed trajectory
    ↓
derived velocity / acceleration
    ↓
event measurement
```

Every stage receives an ID and version.

This makes a later camera-calibration improvement extremely valuable: all world-space measurements can be regenerated without re-annotating the video.

### Minimum initial campaign

The smallest useful campaign should **not** try to cover the entire catalog. Its job is to establish the measurement pipeline and produce first calibration envelopes for exactly the five requested domains:

- locomotion;
- ground-ball physics;
- turning;
- first touch;
- passing.

The main economy is to reuse the same pass/reception events for three of those five targets.

#### Source selection

Use at least three independent source roles:


| Source role                                        | Purpose                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| Straight-running/training footage                  | clean acceleration, plateau, deceleration                        |
| High-quality match footage with stable main camera | turns + ground passes + first touches                            |
| Independent second match/source                    | held-out validation and detection of source/camera-specific bias |


Prioritize the highest actual unique-content cadence available, stable compression, visible pitch markings and long uninterrupted sequences. Do not admit a source to the kinematic reference set until its timestamp/content-cadence audit passes.

A single video should **not** supply both all fitting data and all validation data, because one homography/camera/compression error could otherwise masquerade as consistent PES behavior.

#### Locomotion block

Start with approximately **15 clean straight-motion segments**:


| Event family                  | Initial target | Primary outputs                               |
| ----------------------------- | --------------: | --------------------------------------------- |
| start → high-speed/plateau    | 5              | `v(t)`, early distance, acceleration envelope |
| sustained straight high speed | 5              | observed plateau speed                        |
| high speed → visible stop     | 5              | deceleration envelope, stopping distance/time |


These support LOC-ACC-001, LOC-MAX-001 and LOC-DEC-001.

Five repetitions are not a claim of statistical sufficiency; they are a **minimum debugging/coverage target**. The purpose is to expose measurement-pipeline failures and obtain a first distribution rather than pretend one showcase sprint is canonical.

Avoid attribute conclusions at this stage. LOC-ACC-002 remains class C.

#### Turning block

Collect approximately **15 clean observed turns**:


| Observed trajectory deflection    | Initial target |
| --------------------------------- | --------------: |
| approximately 30–60°              | 5              |
| approximately 70–110°             | 5              |
| approximately 150–180° / reversal | 5              |


For every turn:

```text
entry speed
observed heading deflection
minimum speed
speed retention
turn duration
arc length
curvature profile
minimum valid radius
body-heading trajectory when observable
```

The categories should be assigned **after measuring the path**, not from guessing the stick input.

This produces first envelopes for LOC-T45-001, LOC-T90-001 and LOC-REV-001. Exact input-angle response remains unavailable until controlled capture.

#### Combined ball/pass/first-touch block

The highest-yield part of the campaign is approximately **24 clean ground-pass → reception chains**.

Stratify primarily by measured variables:


| Incoming ball speed | Receiver orientation | Initial count |
| ------------------- | -------------------- | -------------: |
| lower-speed band    | open/front-ish       | 6             |
| lower-speed band    | side/back-ish        | 6             |
| higher-speed band   | open/front-ish       | 6             |
| higher-speed band   | side/back-ish        | 6             |


The speed bands should be defined from the measured sample distribution after the first annotation pass rather than by inventing PES-specific thresholds.

Within those 24, seek at least several clearly moving receivers so PASS-RUN-001 is represented.

Each event simultaneously yields:

**Passing**

```text
pass contact time
pass origin
passer body heading
release direction
initial ball speed
travel time
actual terminal/meeting point
receiver trajectory
lead distance
```

**Ground-ball physics**

```text
free-flight/roll interval
s(t)
v(t)
deceleration curve
candidate-model residuals
arrival speed
```

**First touch**

```text
incoming velocity
receiver movement heading
receiver body heading
contact-time interval
post-contact ball velocity
maximum short-window separation
outgoing angle
time to next identifiable controlled action
```

Thus only **24 ball events** can seed three major calibration families rather than collecting three separate datasets.

### Smallest viable total

The initial measurement campaign is therefore roughly:

```text
15 straight locomotion segments
15 turn segments
24 pass → roll → first-touch chains
-----------------------------------
54 calibrated event segments
```

Because a pass chain contributes to several tests, this is substantially richer than “54 measurements”; each event generates many time-series and scalar observations.

This campaign is sufficient to start calibrating **observable envelopes**, but explicitly not:

- Speed-rating or Explosive-Power curves;
- exact stick-angle turning response;
- first-touch input/intention mappings;
- pass power-bar mapping;
- passing-assistance behavior;
- player-attribute sensitivity.

Those are class C.

### Controlled-capture extension required for causal calibration

Once the public-video pipeline is stable, the smallest high-value controlled extension is not “more normal matches.” It is input-instrumented repetition of exactly the ambiguities left by the first campaign:


| Domain                | Controlled quantity that public video cannot identify              |
| --------------------- | ------------------------------------------------------------------ |
| Locomotion            | exact sprint/start, stick-release and stop timestamps              |
| Turning               | exact stick direction/magnitude and command frame                  |
| First touch           | receiver input direction/action at contact                         |
| Passing               | pass command, assistance setting and power-bar/input duration      |
| Attribute comparisons | identical trial geometry with only selected player/context changed |


This is the point at which LOC-ACC-002, LOC-BALL-001, PASS-ANG-001 and related class-C tests can become causal calibration references.

Until then, the public dataset should deliberately say:

```text
PES observed output distribution
conditioned on observable state
```

rather than:

```text
PES response function
conditioned on inferred controller input
```

### Calibration deliverable

The first completed dataset should expose, for every supported Reference Test:

```text
raw event clips / source references
PTS-verified frame map
pitch calibration
raw 2D annotations
world-space tracks
measurement uncertainty
event-level derived metrics
source-level metadata
A/B/C/D observability class
valid/excluded status
aggregate distribution
held-out validation events
```

The calibration target should then be a distribution or envelope, not a falsely exact “PES constant.”

For example, a locomotion reference would conceptually be:

```text
LOC-T90-001
    conditions:
        observed entry-speed interval
        observed movement-heading deflection interval
        optional body-heading bin

    reference outputs:
        speed-retention distribution
        turn-duration distribution
        curvature distribution
        recovery-time distribution

    measurement uncertainty:
        retained separately per event
```

A ground-ball reference would similarly store the actual v(t) curves and model residuals rather than prematurely declaring a friction coefficient.

That structure gives the independent football engine exactly what a reference dataset should provide: **traceable, world-space observations with known uncertainty and known limits of causal interpretation—without reverse-engineering claims, invented PES parameters, or conflation of camera pixels with gameplay physics.**  

## Sources

Reconstructed from the document's citations (the `citeturnNsearchM` / `citeturnNacademiaM` markers that appear inline in the body are unresolved export artifacts; this list recovers the real titles and URLs they pointed to, but does not reassign a citation number to each individual inline marker). For academic references whose exact title could not be confirmed reliably, a functional description based on the document's own context is used instead of inventing a title or authorship.

1. FFmpeg — "ffmpeg Documentation" — https://www.ffmpeg.org/ffmpeg.html
2. PyAV — "Time and Timestamps" (API docs) — https://pyav.org/docs/stable/api/time.html
3. FFmpeg — "ffprobe Documentation" — https://ffmpeg.org/ffprobe.html
4. FFmpeg — `mpdecimate` video filter (Doxygen source docs) — https://ffmpeg.org/doxygen/3.2/vf__mpdecimate_8c.html
5. SoccerNet — `sn-calibration` (camera-calibration toolkit/benchmark, GitHub) — https://github.com/SoccerNet/sn-calibration
6. IFAB — "Laws of the Game, Law 1: The Field of Play" (ES) — https://www.theifab.com/es/laws/latest/the-field-of-play/
7. OpenCV — "Features2D + Homography to Find a Known Object" (tutorial) — https://docs.opencv.org/4.3.0/d7/dff/tutorial_feature_homography.html
8. SoccerNet — "Game State Reconstruction" (task page) — https://www.soccer-net.org/tasks/game-state-reconstruction
9. Aharon, Orfaig & Bobrovsky — "BoT-SORT: Robust Associations Multi-Pedestrian Tracking" (arXiv) — https://arxiv.org/abs/2206.14651
10. Zhang et al. — "ByteTrack: Multi-Object Tracking by Associating Every Detection Box" (ECCV 2022) — https://www.ecva.net/papers/eccv_2022/papers_ECCV/html/315_ECCV_2022_paper.php
11. IEICE Transactions on Information and Systems (J-STAGE) — paper on single-camera soccer player tracking under pan/tilt/zoom and occlusion — https://www.jstage.jst.go.jp/article/transinf/E98.D/8/E98.D_2014EDP7313/_article/-char/ja/
12. CVAT — "CVAT Annotation Format" (docs) — https://docs.cvat.ai/docs/manual/advanced/formats/format-cvat/
13. CVAT — "Track Mode (Advanced)" (docs) — https://docs.cvat.ai/docs/annotation/tools/track-mode-advanced/
14. Savitzky, A. & Golay, M. J. E. — "Smoothing and Differentiation of Data by Simplified Least Squares Procedures" (Analytical Chemistry, 1964) — https://pubs.acs.org/doi/10.1021/ac60214a047
15. Cao, Z. et al. — "Realtime Multi-Person 2D Pose Estimation using Part Affinity Fields" (OpenPose, CVPR 2017) — https://doi.org/10.1109/CVPR.2017.143
16. arXiv preprint — player pose/tracking-related work referenced alongside the ByteTrack/BoT-SORT discussion — https://arxiv.org/abs/2003.00943
17. "Learning Football Body-Orientation as a Weak Supervisory Signal" (paper page, CatalyzeX) — median orientation-error study cited in the body — https://www.catalyzex.com/paper/learning-football-body-orientation-as-a
18. Image and Vision Computing (ScienceDirect) — early monocular broadcast-camera 3D ball-position reconstruction work — https://www.sciencedirect.com/science/article/pii/S0262885606001247
19. CVPR 2025 — monocular 3D ball-trajectory reconstruction using learned trajectory priors and reprojection consistency — https://cvpr.thecvf.com/virtual/2025/35509
20. SoccerNet 3D — monocular ball localization combining camera calibration, multi-view triangulation and apparent-size priors (via EmergentMind summary) — https://www.emergentmind.com/papers/2504.10106
21. JCGM 101:2008 — "Evaluation of Measurement Data — Supplement 1 to the GUM — Propagation of Distributions Using a Monte Carlo Method" (BIPM) — https://www.bipm.org/en/doi/10.59161/jcgm101-2008
