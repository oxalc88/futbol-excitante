# Implementation Techniques for an Independent Browser Football Simulation Engine

## Decision frame

The three existing documents point toward a very specific engineering problem. The goal is not to reproduce a hidden PES 2017 implementation; it is to build an independent simulator whose measurable outputs fall inside the behavioral envelopes extracted from the reference material. The vision document also makes simulation primary, rendering secondary, and external player-data sources replaceable. fileciteturn0file0 The measurement work goes further: public footage is strongest for gross locomotion and ball motion, somewhat noisier for turns, first touch and passing, and insufficient for reconstructing exact hidden input-transfer functions. It therefore recommends calibrating distributions and envelopes rather than inventing “PES constants.” fileciteturn0file1 The behavioral study identifies the most important perceptual combination as **fast intention response with non-instantaneous body response**, together with an independent ball, contextual touches, continuous physical duels, and coordinated team shape. fileciteturn0file2

That combination has an important implementation consequence:

> **The strongest MVP candidate is not a general rigid-body football simulation and not an animation-driven football game. It is a deliberately controlled kinematic simulation for players, coupled to an independently simulated ball, explicit contact events, formation/utility-based AI, and a presentation layer that follows rather than owns simulation state.**

This is an engineering inference from the reference requirements, not a claim about PES 2017 internals. It is also consistent with established interactive-character work: steering research explicitly separates high-level action selection, steering, and locomotion, while interactive animation research shows that parameterized motion can be synthesized around continuous control variables rather than forcing game logic to inherit animation trajectories. citeturn10search0turn14search0

For the evaluations below:


| Symbol       | Meaning                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------- |
| **C**        | Implementation complexity: Low / Medium / High                                                      |
| **Perf**     | Runtime cost in a browser: Low / Medium / High                                                      |
| **Det risk** | Risk of losing reproducibility: Low / Medium / High                                                 |
| **Cal**      | Suitability for automatic calibration against the existing measurement catalog: Low / Medium / High |


“Automatic calibration” here means that a technique exposes parameters that can be optimized against observables such as `t90`, stopping distance, heading lag, turn speed retention, pass arrival speed, first-touch displacement, team width, pressing latency, and transition duration. That is exactly the measurement chain already proposed in the reference-dataset work. fileciteturn0file1

A second overarching conclusion is that **replaceability matters more than choosing sophisticated techniques now**. The vision explicitly wants replaceable data and renderer layers. fileciteturn0file0 The same principle should apply internally to ball integration, player-contact resolution, tactical decision policy, and animation selection. That does not require settling the final architecture yet; it only means prototypes should avoid coupling the observable football rules to a particular physics solver, AI formalism, or animation database.

## Player locomotion and physical contact

The reference behavior requires several things simultaneously: input should become intention quickly; velocity should not instantly snap to that intention; movement direction and body orientation can differ; high-speed cuts should cost more than low-speed turns; ball-carrying should alter locomotion without welding the ball to the player; and contact should perturb balance without turning every duel into a binary stat comparison. fileciteturn0file2 The measurement document already exposes the right observables for such a controller: position, velocity, acceleration, body heading, movement heading, turn radius, speed retention, stopping distance and recovery. fileciteturn0file1

The most useful conceptual model is:


\text{input/AI target}
\rightarrow
\text{desired velocity/heading}
\rightarrow
\text{bounded kinematic response}
\rightarrow
\text{contacts}
\rightarrow
\text{actual velocity/heading}


rather than:


\text{input direction}\rightarrow \text{position directly}.


Craig Reynolds' steering framework is particularly relevant because it treats steering as an intermediate layer between goal selection and actual locomotion, so an agent can request a trajectory without the locomotion system being required to realize it instantaneously. citeturn10search0


| Technique                                | Decision                                  | Suitability and problem solved                                                                                                                                                                                                                                                                                                                                                                     | Engineering profile                                       | Recommended prototype and replaceable alternative                                                                                                                                                                                                                           |
| ---------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Acceleration/deceleration controller** | **RECOMMENDED FOR MVP**                   | Creates weight while preserving fast intent response. Separate acceleration and braking capacities can reproduce different `v(t)` and stopping curves without changing top speed. This maps directly to the reference tests for acceleration, stop and reversal. fileciteturn0file1turn0file2                                                                                                  | C: Low–Med; Perf: Low; Det risk: Low; Cal: **High**       | Maintain current velocity and desired velocity. Move current velocity toward target under speed-dependent acceleration/braking limits. Keep the actual response curve pluggable: piecewise curve, spline or first-order response can later replace the initial clamp model. |
| **Velocity/orientation separation**      | **RECOMMENDED FOR MVP**                   | Essential for “responsive but weighted” movement and for receptions/passes where body angle matters. The existing behavioral study explicitly recommends separate `linearVelocity`, `desiredVelocity`, `bodyHeading` and `desiredHeading`. fileciteturn0file2                                                                                                                                   | C: Low; Perf: Low; Det risk: Low; Cal: **High**           | Simulate translation and body-heading convergence independently. Do not derive body forward directly from velocity except as one possible heading target.                                                                                                                   |
| **Steering under inertia**               | **RECOMMENDED FOR MVP**                   | Allows AI/user intention to change immediately while actual movement curves toward it. Reynolds' steering decomposition supports precisely this separation of requested movement from locomotion realization. citeturn10search0                                                                                                                                                                 | C: Med; Perf: Low; Det risk: Low; Cal: High               | Calculate a desired velocity from input/AI and then constrain longitudinal and lateral acceleration. Avoid overwriting velocity with steering output.                                                                                                                       |
| **Turning constraints**                  | **RECOMMENDED FOR MVP**                   | Prevents instant full-speed pivots and gives 45°, 90° and 180° turns meaningfully different costs, matching the measurement catalog. fileciteturn0file1                                                                                                                                                                                                                                         | C: Med; Perf: Low; Det risk: Low; Cal: **High**           | Use entry-speed-dependent lateral acceleration/curvature limits plus a calibrated speed-loss surface. Keep the relationship `entry speed × requested angle → turn time/speed retention` data-driven rather than assuming one universal physical coefficient.                |
| **Locomotion state machine**             | **RECOMMENDED FOR MVP, but small**        | Useful for genuine discontinuities: idle, ordinary locomotion, plant/pivot, action preparation, stumble and recovery. It should not discretize every speed/direction combination.                                                                                                                                                                                                                  | C: Med; Perf: Low; Det risk: Low; Cal: Med                | Small macro-state machine plus continuous kinematic variables. **Avoid** a giant state graph containing walk-left-with-ball, sprint-right-without-ball, etc.                                                                                                                |
| **Trajectory controller**                | **RECOMMENDED FOR MVP in simple form**    | AI needs to request where a player should be shortly in the future without bypassing inertia.                                                                                                                                                                                                                                                                                                      | C: Med; Perf: Low; Det risk: Low; Cal: High               | Short-horizon target position/velocity converted to desired velocity; locomotion remains authoritative. Optimization-based trajectory/MPC controllers remain a later substitute.                                                                                            |
| **Movement with/without ball**           | **RECOMMENDED FOR MVP**                   | The reference behavior calls for periodic player-ball contacts and potentially different sustainable movement, but not a permanently attached ball. fileciteturn0file2                                                                                                                                                                                                                          | C: Med; Perf: Low; Det risk: Low; Cal: **High**           | Keep one locomotion controller. Ball carrying modifies feasible acceleration, turn aggressiveness and future touch requirements. Do **not** begin with `speed *= constantWhenDribbling`.                                                                                    |
| **Body orientation**                     | **RECOMMENDED FOR MVP**                   | Needed for reception cost, pass preparation, shielding, tackling and visual credibility. fileciteturn0file2                                                                                                                                                                                                                                                                                     | C: Med; Perf: Low; Det risk: Low; Cal: High               | Heading controller with angular-speed/angular-acceleration limits and action-dependent targets. Keep torso/animation yaw as a presentation offset later.                                                                                                                    |
| **Collision recovery**                   | **RECOMMENDED FOR MVP**                   | Contact should cause temporary loss of speed/orientation and then recovery rather than either no effect or a full ragdoll.                                                                                                                                                                                                                                                                         | C: Med; Perf: Low; Det risk: Low; Cal: **High**           | Introduce perturbation magnitude plus `stable → disrupted → recovering` states. Calibrate heading disturbance, velocity loss and recovery duration from contact tests.                                                                                                      |
| **Kinematic player controller**          | **RECOMMENDED FOR MVP**                   | Gives exact control of football-specific locomotion while still allowing contacts to modify trajectory. Generic physics character controllers are intended to correct requested movement against geometry; Rapier itself notes that character control is highly game-specific, and its built-in controller supports translation but not rotational movement. citeturn16view2                    | C: Med; Perf: Low; Det risk: Low; Cal: **High**           | Football-specific planar kinematic controller with simple body collider. Treat a physics-engine character controller as replaceable infrastructure, not the football locomotion model.                                                                                      |
| **Fully dynamic rigid-body players**     | **AVOID UNTIL NEEDED**                    | A dynamic body naturally reacts to impulses, but locomotion, stance, balance and animation then require forces/controllers capable of keeping a humanoid under control. Physics-based imitation systems such as DeepMimic demonstrate that rich, perturbation-resistant dynamic characters are possible, but they require a substantially larger control/training problem. citeturn11academia38 | C: **Very High**; Perf: Med–High; Det risk: Med; Cal: Low | Keep as a future research alternative for exceptional contact/ragdoll states, not normal 11v11 locomotion.                                                                                                                                                                  |
| **Player collision resolution**          | **RECOMMENDED FOR MVP**                   | Prevents interpenetration while preserving football contact instead of avoiding every collision.                                                                                                                                                                                                                                                                                                   | C: Med; Perf: Low; Det risk: Low if ordered; Cal: High    | 2D circles/capsules, deterministic overlap correction, and limited relative-velocity perturbation. Resolve pairs in stable entity-ID order. A general impulse solver should remain replaceable.                                                                             |
| **Balance/stumble state**                | **RECOMMENDED FOR MVP in reduced form**   | Separates strength from balance and allows identical contacts to yield different perturbation/recovery behavior. This follows the existing reference distinction between physical contact and body control. fileciteturn0file2                                                                                                                                                                  | C: Med; Perf: Low; Det risk: Low; Cal: High               | Maintain a continuous stability/balance quantity plus discrete thresholds for stumble/recovery. Avoid ragdolls initially.                                                                                                                                                   |
| **Shielding**                            | **RECOMMENDED FOR MVP in geometric form** | Requires ball side, defender side and body orientation to matter, rather than just comparing strength ratings.                                                                                                                                                                                                                                                                                     | C: Med; Perf: Low; Det risk: Low; Cal: Med–High           | Determine whether the attacker's body lies between opponent and ball, then modify feasible reach/contact impulses and balance response. Later animation can add explicit shoulder/arm poses.                                                                                |
| **Physical duels**                       | **RECOMMENDED FOR MVP**                   | The behavioral reference specifically argues for continuous resolution before deciding possession, fall or rebound. fileciteturn0file2                                                                                                                                                                                                                                                          | C: Med–High; Perf: Low; Det risk: Low–Med; Cal: High      | Compute geometry, relative speed, headings and stability; apply displacement/velocity/balance effects; let the resulting ball contact determine possession. Avoid “higher Physical Contact stat wins.”                                                                      |


A good initial locomotion kernel therefore needs surprisingly little mathematics. Let v_d be desired velocity and v current velocity. Instead of setting v=v_d, calculate the requested change and constrain its longitudinal and lateral components:


\Delta v = v_d-v,



a_{\parallel} \in [-a_{\text{brake}}(s),a_{\text{accel}}(s)],



|a_{\perp}| \le a_{\text{lat}}(s),


where the capacities may vary with speed s, locomotion context and archetype. The resulting velocity is integrated at the fixed simulation step. At speed, lateral acceleration also bounds curvature because


a_\perp = v^2\kappa .


That relationship is useful as a **controller constraint**, not as an alleged PES formula. The actual functions should be fitted to the `LOC-ACC`, `LOC-DEC`, `LOC-T45`, `LOC-T90` and reversal distributions already planned in the measurement research. fileciteturn0file1

The major advantage of this family is calibration. Acceleration parameters affect `t25/t50/t90`; braking affects stopping distance; lateral capacity affects turn radius and speed retention; heading limits affect body/velocity lag. Those metrics are separately observable. That is far preferable to tuning a single opaque “agility” number.

**Trajectory optimization and MPC are plausible later techniques, not MVP necessities.** Task-based locomotion research demonstrates that task-specific step plans can be optimized interactively and can contain pivots, side steps and other contextual locomotion vocabulary. citeturn14search5 That makes optimization-based footstep control an attractive future option for high-quality close-control animation. But applying such optimization to all 22 footballers before the coarse kinematic envelopes are known would make calibration harder rather than easier.

For crowd-like collision avoidance, reciprocal-velocity methods are also technically capable: ORCA-family methods construct collision-avoiding velocity constraints for multiple moving agents. citeturn13search3turn13search7 **They should not be the default football movement solver.** Football requires deliberate shoulder-to-shoulder contact, blocking, shielding and contested spaces. A solver whose central objective is collision-free navigation can erase precisely the interactions this project is trying to reproduce. Soft separation steering is useful; guaranteed avoidance should remain **AVOID UNTIL NEEDED**, perhaps reserved later for non-contact path cleanup far from the ball.

## Ball physics and player-ball interaction

The reference material is unusually decisive here: the ball should exist independently, carrying its own position, linear velocity, angular velocity and contact history, and players should modify it through contacts rather than permanent possession parenting. fileciteturn0file2 The measurement methodology also gives ball physics particularly high priority because long ground passes and free-ball trajectories can be measured relatively reliably from public footage. fileciteturn0file1

That strongly favors a **small explicit ball model whose equations are under project control**.

A general rigid-body package remains a valid alternative. Rapier supports JavaScript/WebAssembly in browsers, rigid-body contacts, scene queries, SIMD options and cross-platform deterministic simulation. citeturn16view0turn16view1 But its ordinary contacts use a Coulomb friction model and restitution coefficients. citeturn17view0turn17view2 Those are useful collision primitives, not necessarily the easiest parameterization for matching a measured football roll-off curve. Because the project has exactly one match ball, a custom integrator is not an unreasonable amount of code.


| Technique                        | Decision                                     | Suitability and problem solved                                                                                                                                                                                                                                    | Engineering profile                                       | Recommended prototype and replaceable alternative                                                                                                                                             |
| -------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Independent rigid ball state** | **RECOMMENDED FOR MVP**                      | Fundamental to loose balls, rebounds, tackles, first touch and contested possession. fileciteturn0file2                                                                                                                                                        | C: Low; Perf: Very Low; Det risk: Low; Cal: **High**      | `position`, `velocity`, `angularVelocity`, contact state/history. Custom integrator first; keep a rigid-body backend such as Rapier replaceable.                                              |
| **Rolling resistance**           | **RECOMMENDED FOR MVP**                      | Determines ground-pass pacing and stopping distance, one of the best measurable targets. The measurement research explicitly says to fit competing roll models rather than assume one. fileciteturn0file1                                                      | C: Low; Perf: Very Low; Det risk: Low; Cal: **Very High** | Empirical a_{\rm roll}(                                                                                                                                                                       |
| **Ground friction / slip**       | **RECOMMENDED FOR MVP in simplified form**   | Needed when the ball bounces or arrives with tangential velocity/spin; determines how it settles into rolling.                                                                                                                                                    | C: Med; Perf: Very Low; Det risk: Low; Cal: High          | Separate a short sliding/contact response from the ordinary roll-decay model. Keep true rigid contact/friction as a later alternative.                                                        |
| **Bounce / restitution**         | **RECOMMENDED FOR MVP**                      | Needed for aerial balls, rebounds and chaotic loose-ball sequences.                                                                                                                                                                                               | C: Low; Perf: Very Low; Det risk: Low; Cal: **High**      | Normal restitution plus tangential impulse/friction. Allow coefficient to become speed-dependent later if measured data requires it.                                                          |
| **Spin state**                   | **RECOMMENDED FOR MVP**                      | Required for curved shots/passes and plausible bounce behavior. fileciteturn0file2                                                                                                                                                                             | C: Low; Perf: Very Low; Det risk: Low; Cal: Med–High      | Maintain world-space angular velocity even before every spin-ground coupling effect is implemented.                                                                                           |
| **Magnus-like force**            | **RECOMMENDED FOR MVP, deliberately simple** | Needed to produce progressive curve rather than scripted lateral offsets. Free-flight measurements show that soccer-ball side force changes with speed and spin conditions rather than acting as constant curvature. citeturn15search1                         | C: Med; Perf: Very Low; Det risk: Low; Cal: High          | Use a tunable force proportional to a calibrated function of speed/spin times \omega\times v. Avoid a constant “degrees of curve per second.”                                                 |
| **Aerodynamic drag**             | **RECOMMENDED FOR MVP**                      | Required for aerial flight timing and interacts with Magnus. Wind-tunnel soccer-ball research finds meaningful speed-dependent drag/lift behavior, but also ball-design/orientation effects far beyond what this project needs to reproduce. citeturn15search0 | C: Low; Perf: Very Low; Det risk: Low; Cal: High          | Start with quadratic drag. Keep coefficient curves replaceable if reference trajectories demand something else.                                                                               |
| **Ground/air transition**        | **RECOMMENDED FOR MVP**                      | Prevents separate “pass trajectory” and “free ball” systems and allows genuine bounce→roll sequences.                                                                                                                                                             | C: Med; Perf: Very Low; Det risk: Low; Cal: High          | Derive from ground contact, vertical velocity and a small hysteresis/rest threshold. Never derive it from possession state.                                                                   |
| **Player-ball contact impulses** | **RECOMMENDED FOR MVP**                      | Gives one common physical mechanism for touch, pass, shot, tackle and header.                                                                                                                                                                                     | C: Med; Perf: Very Low; Det risk: Low; Cal: **Very High** | At the selected contact tick, calculate the desired outgoing linear/angular state and apply an impulse/change in momentum. Keep contact-selection logic separate from impulse generation.     |
| **First touch**                  | **RECOMMENDED FOR MVP**                      | One of the signature reference behaviors. A touch must react to incoming velocity, height, body orientation, desired exit and player capability. fileciteturn0file2                                                                                            | C: Med–High; Perf: Low; Det risk: Low; Cal: **High**      | Contextual contact families—cushion, trap, redirect, push ahead, leave/run onto—producing different desired outgoing velocities. Avoid an attractor that simply snaps the ball toward a foot. |
| **Dribbling contact model**      | **RECOMMENDED FOR MVP**                      | Preserves ball independence while creating controlled possession.                                                                                                                                                                                                 | C: Med–High; Perf: Low; Det risk: Low; Cal: **High**      | Repeated micro-contacts at feasible touch opportunities. The controller predicts where player and ball should meet at the next touch; each touch emits an impulse.                            |
| **Passes as impulses**           | **RECOMMENDED FOR MVP**                      | Cleanly separates target selection, technical execution/error and ball physics, as the behavioral reference recommends. fileciteturn0file2                                                                                                                     | C: Med; Perf: Very Low; Det risk: Low; Cal: **Very High** | Choose target/lead point first; then derive initial ball velocity/spin; then apply contextual deterministic error.                                                                            |
| **Shots as impulses**            | **RECOMMENDED FOR MVP**                      | Same mechanism as passing while allowing different launch/spin/power envelopes.                                                                                                                                                                                   | C: Med; Perf: Very Low; Det risk: Low; Cal: High          | Separate power, direction error, launch angle and spin. Avoid a unique scripted shot-trajectory system.                                                                                       |
| **Standing tackle contact**      | **RECOMMENDED FOR MVP**                      | Provides spatial/timing commitment and ball deflection rather than an omnidirectional possession-steal check. fileciteturn0file2                                                                                                                               | C: Med; Perf: Low; Det risk: Low; Cal: High               | Preparation → active contact window → recovery; test a foot/reach primitive against the ball and body.                                                                                        |
| **Sliding tackle**               | **LATER**                                    | Requires longer active geometry, foul/contact ordering and strong animation coupling.                                                                                                                                                                             | C: Med–High; Perf: Low; Det risk: Low; Cal: Med           | Reuse the same contact-event mechanism once standing-tackle timing is correct.                                                                                                                |
| **Headers**                      | **LATER after basic aerial ball**            | Requires vertical player reach, jump phase, body/head contact selection and contested aerial positioning. fileciteturn0file2                                                                                                                                   | C: High; Perf: Low; Det risk: Low; Cal: Med               | Implement as another contact surface plus reachable-volume/timing model; do not make `Header` a direct scoring probability.                                                                   |


The ground model deserves special attention. Experimental rolling-friction research on balls and compliant surfaces shows that rolling resistance can itself vary with velocity rather than being a universal constant. citeturn15search8 That does **not** mean the engine should simulate real grass or use that paper's coefficients. It means the existing measurement methodology is correct to fit a generic function:


\frac{dv}{dt}=-f_{\rm roll}(|v|)\hat v


and compare constant, proportional and piecewise models against the reference trajectories. fileciteturn0file1

For the air model, a useful MVP form is:


\dot v =
g
-k_d |v|v
+k_m(|v|,|\omega|)(\omega\times v).


The important decision is not the exact formula for k_m; it is making the function **calibratable and replaceable**. Real spinning-soccer-ball measurements show side force reducing as ball speed falls, while wind-tunnel research also shows substantial aerodynamic variation between ball designs and orientations. citeturn15search1turn15search0 Reconstructing seam-level aerodynamics would therefore be physical sophistication with almost no evidence that it improves the PES-like target. **AVOID UNTIL NEEDED.**

At ground impact, an MVP can decompose incoming velocity into surface-normal and tangential components:


v=v_n+v_t,


then approximately resolve


v'_n=-ev_n


and apply a capped tangential impulse that also changes angular velocity. Rapier exposes essentially these general concepts through restitution and Coulomb-style contact friction. citeturn17view0turn17view2 The custom implementation has the advantage that the post-bounce behavior can be optimized directly against `BALL-BNC` measurements without forcing all observed effects through a generic rigid-body solver.

**First touch should be a contact-selection problem, not a possession transition.** Suppose a fast pass arrives while the receiver is open to the desired exit direction. The action selector might choose “redirect/push,” define a feasible contact point, and request an outgoing ball velocity compatible with player skill. With the same incoming pass but a receiver facing away, it may choose “cushion/trap,” resulting in a lower outgoing speed and longer time until the next action. Those outcomes map directly onto the existing `TOUCH-FAST`, `TOUCH-BACK` and `TOUCH-90` measurements. fileciteturn0file1turn0file2

Dribbling can use the same abstraction. A controlled player is not defined by `ball.parent = player`. Instead:


\text{predict next feasible touch region}
\rightarrow
\text{steer body toward it}
\rightarrow
\text{contact}
\rightarrow
\text{new free-ball trajectory}.


This directly exposes the calibration variables the earlier research already identified: touch interval, foot-ball separation, ball speed after contact, movement speed with versus without the ball, and recovery when a touch runs too far. fileciteturn0file1

There is also a strong reason to keep **technical error separate from ball physics**. A bad pass should generally mean that the selected initial impulse differs from the intended one; it should not mean the ball obeys different friction after being kicked. That separation allows the ground-ball model to be calibrated once and pass accuracy independently.

## AI and tactics

The previous behavioral study already arrives at the right conceptual hierarchy: team state and tactical phase should constrain formation-relative targets; local responsibilities and individual preferences refine them; only then should reachability and locomotion determine what the player actually does. fileciteturn0file2 This is consistent with multi-agent soccer research. UT Austin Villa's RoboCup work used explicit dynamic role assignment and formation positioning to coordinate physically simulated soccer agents, rather than treating every player as an independent ball seeker. citeturn10search2turn10search8

For this project, the main AI design principle should be:

> **Tactics decides where and why; steering decides the local movement request; locomotion decides what is physically achievable.**

That separation is also consistent with Reynolds' steering hierarchy. citeturn10search0


| Technique                               | Decision                              | Suitability and problem solved                                                                                                                                                                                                                       | Engineering profile                                                                        | Recommended prototype and replaceable alternative                                                                                                                                     |
| --------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Formation anchors**                   | **RECOMMENDED FOR MVP**               | Prevents swarm behavior and gives each role a stable tactical reference. The reference research explicitly measures line depth, width, spacing and relative positions. fileciteturn0file1turn0file2                                              | C: Low; Perf: Very Low; Det risk: Low; Cal: **High**                                       | Normalized pitch-space anchor for every role, transformed by possession direction/team side.                                                                                          |
| **Dynamic shape deformation**           | **RECOMMENDED FOR MVP**               | Lets nominal formations shift toward the ball, compress, widen and change depth without abandoning structure.                                                                                                                                        | C: Med; Perf: Low; Det risk: Low; Cal: **High**                                            | Compute anchor offsets from ball zone, team phase, line membership and tactical parameters; clamp by role corridor.                                                                   |
| **Role-based behavior**                 | **RECOMMENDED FOR MVP**               | Makes players differ by responsibility rather than by simply changing attributes. Dynamic role/formation methods have strong precedent in simulated soccer. citeturn10search2turn10search7                                                       | C: Med; Perf: Low; Det risk: Low; Cal: High                                                | Roles expose preferred actions/regions; abilities determine how well they execute them. Keep role assignment separately replaceable from decision scoring.                            |
| **Utility AI**                          | **RECOMMENDED FOR MVP**               | Excellent fit for choosing among overlapping football intentions: support, run, hold, press, cover, intercept, mark. Scores are inspectable and numerically calibratable.                                                                            | C: Med; Perf: Low; Det risk: Low; Cal: **High**                                            | Compute several deterministic candidate utilities from common features; add hysteresis to prevent decision oscillation.                                                               |
| **Behavior trees**                      | **LATER**                             | Behavior Trees are modular/reactive structures for switching among tasks and become valuable when multi-stage behaviors grow complex. citeturn10academia48                                                                                        | C: Med; Perf: Low; Det risk: Low; Cal: Low–Med                                             | Consider BTs later for keeper sequences, set pieces or complex action execution. Keep high-level football scoring outside the BT so a future planner/utility system remains possible. |
| **Local steering**                      | **RECOMMENDED FOR MVP**               | Converts tactical targets to movement requests while supporting arrival, separation and pursuit. Reynolds' steering work provides the canonical separation from locomotion. citeturn10search0                                                     | C: Med; Perf: Low; Det risk: Low; Cal: Med–High                                            | Arrival + target-velocity + soft separation. Locomotion controller applies inertia.                                                                                                   |
| **Passing-lane evaluation**             | **RECOMMENDED FOR MVP**               | Passing should depend on whether ball travel intersects defender reachability, not only distance to teammate. Research on pass availability combines ball trajectories and player reach probabilities for exactly this purpose. citeturn12search0 | C: Med; Perf: Low–Med; Det risk: Low; Cal: High                                            | Predict ball ETA along candidate trajectory; compare with receiver and defender reach-time estimates; score interception margin.                                                      |
| **Space occupation / dominant regions** | **RECOMMENDED FOR MVP, coarse model** | Enables support, defensive coverage and run targeting. Kinematics-aware dominant-region research shows why position-only Voronoi space can overstate control when velocity and acceleration are ignored. citeturn12search1                        | C: Med; Perf: Med; Det risk: Low; Cal: Med–High                                            | Coarse grid of reach-time/control margin using each player's current position, velocity and locomotion capacities. Voronoi remains a cheap baseline/debug view.                       |
| **Pressing**                            | **RECOMMENDED FOR MVP**               | Must be coordinated: ball pressure, lane blocking and shape compression should be distinct jobs. The existing PES-like reference specifically calls for first presser, supporting pressure and block recovery. fileciteturn0file2                 | C: Med–High; Perf: Low; Det risk: Low; Cal: **High**                                       | Assign a small number of pressure roles using cost/reachability; everyone else modifies formation targets.                                                                            |
| **Transition states**                   | **RECOMMENDED FOR MVP**               | A loss of possession is not equivalent to settled defense, and recovery is not immediately settled attack. This is directly measurable using first-press and shape-rebuild times. fileciteturn0file1turn0file2                                   | C: Med; Perf: Very Low; Det risk: Low; Cal: **High**                                       | Explicit possession/phase states with entry timestamps and measurable exit criteria.                                                                                                  |
| **Full learned tactical policy / RL**   | **AVOID UNTIL NEEDED**                | Can potentially learn rich team policies but obscures why behaviors occur and introduces a large training/validation problem before the reference envelopes are established.                                                                         | C: **Very High**; Perf: variable; Det risk: Med; Cal: Low for direct PES-envelope matching | Keep the observation/action boundaries suitable for learning later, but implement interpretable football rules first.                                                                 |


A useful MVP tactical target can remain conceptually simple:


T_i =
A_i
+\Delta_{\rm ball}
+\Delta_{\rm phase}
+\Delta_{\rm team\ tactic}
+\Delta_{\rm role}
+\Delta_{\rm local}.


Here A_i is the formation anchor and the deltas deform it. This is not intended as the final formula; it illustrates why a formation should behave like a **field of preferred positions** rather than a set of hard points.

The measured tactical quantities are particularly friendly to calibration. Defensive-line height can tune the longitudinal deformation. Compactness can tune inter-line and lateral compression. Support-range measurements constrain typical teammate distances. Transition measurements constrain how fast phase terms take over. fileciteturn0file1 These are much easier to fit than an end-to-end objective such as “make match possession percentage look right,” where many unrelated errors can compensate for each other.

**Utility AI is preferable to a large behavior tree as the first tactical decision mechanism.** A utility model can score, for example:


U_{\rm press}
=w_1(\text{reach advantage})
+w_2(\text{role suitability})
+w_3(\text{cover behind})
-w_4(\text{shape damage})
+w_5(\text{transition urgency}).


All terms can be logged. Their impact can be measured. A threshold can be calibrated. And hysteresis can prevent a player from switching between press and recover every decision tick.

Behavior Trees remain valuable, just for a different problem. Research formalizes them as modular, reactive structures for switching between tasks. citeturn10academia48 That makes them attractive for **sequencing** behavior—approach ball → set body → execute tackle → recover—or keeper decision flows. They are less attractive as the first representation of continuous choices such as “how worthwhile is this support run compared with holding shape?” Hence **LATER**, not “never.”

Passing-lane evaluation should also remain relatively mechanical at first. A sophisticated research system can learn probability distributions over ball movement and player reachability; one published availability model combines predicted ball trajectories with the probability that receivers and defenders can reach candidate locations. citeturn12search0 The engine does not require its neural-network machinery. The transferable idea is the decomposition:

## 
\text{pass safety}
\approx
\text{ball arrival time}

\text{opponent reach time}.


The engine already has something better suited to its own needs: its own calibrated locomotion model. Therefore defender reachability can be estimated with the same acceleration, turning and orientation constraints used by actual simulated players. That creates useful internal consistency: a defender should not be judged capable of intercepting a pass that the locomotion simulation would then make impossible to reach.

The same applies to space. Real-football research on dominant regions found that incorporating position, velocity and acceleration yields materially different control regions from plain Voronoi partitions and can leave genuinely uncontrolled free space. citeturn12search1 For this project, that argues for a coarse **reach-time field**, not for importing a machine-learning model. On a fixed grid, each cell can contain something like:

# 
C(x)

## \min_{j\in opponent} T_j(x)

\min_{i\in team} T_i(x).


Positive and negative margins then provide support-space, danger-space and passing-lane features.

Pressing should operate through assignments, not an extra steering force applied to everyone. RoboCup research provides strong precedent for dynamic role assignment and role-based marking in simulated soccer. citeturn10search2turn10search7 A PES-like pressing prototype should identify perhaps a primary ball presser, a lane/receiver cover responsibility, and a block-compression response. The exact number is tactical data, not a hard-coded truth. The test should be whether `PRESS-GG` and `PRESS-REC` distributions match, not whether a theoretically optimal press emerges. fileciteturn0file1

Finally, **do not use ORCA as the tactical solution to player congestion**. Reciprocal collision-avoidance methods are engineered to obtain collision-free multi-agent trajectories. citeturn13search3turn13search7 Football congestion is partly the point: screening, shoulder contact, blocked runs and contested channels should survive. Soft steering separation should reduce accidental clipping; the physical-contact layer should resolve intentional congestion.

## Animation and simulation-state separation

The existing research already proposes separating a continuous simulation state from a visual animation state. fileciteturn0file2 That should be treated as a hard MVP decision because it protects every other calibration effort.

If animation root motion owns player position, changing a clip or transition changes stopping distance, turn radius and pass-preparation position. Those are precisely the observables the measurement project intends to calibrate. If simulation owns them, animation can be replaced repeatedly without invalidating the football model.


| Technique                                          | Decision                                                        | Suitability and problem solved                                                                                                                                                                                                                                                                                | Engineering profile                                                                | Recommended prototype and replaceable alternative                                                                                               |
| -------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Simulation state separate from animation state** | **RECOMMENDED FOR MVP**                                         | Prevents visual content from silently changing football mechanics and supports headless calibration. fileciteturn0file0turn0file2                                                                                                                                                                         | C: Low; Perf: Low; Det risk: **Low**; Cal: **Very High**                           | Simulation owns canonical position, velocity, body orientation, ball and contacts. Animation consumes snapshots/interpolated state.             |
| **Animation state machine**                        | **RECOMMENDED FOR MVP, small**                                  | Handles genuinely discrete actions—locomotion, turn plant, receive, pass, shot, tackle, stumble.                                                                                                                                                                                                              | C: Med; Perf: Low; Det risk: Low if non-authoritative; Cal: Med                    | Keep animation transitions independent from gameplay state transitions where possible.                                                          |
| **Blend tree / parametric blending**               | **RECOMMENDED FOR MVP**                                         | Continuous velocity, movement direction and turn rate need smooth visual interpolation. Parametric motion research demonstrates real-time synthesis/blending across continuous motion spaces. citeturn14search0                                                                                            | C: Med; Perf: Low–Med; Det risk: Irrelevant to simulation if visual only; Cal: Med | Blend locomotion clips from normalized speed, local movement angle and turning demand.                                                          |
| **Motion matching**                                | **LATER**                                                       | Potentially excellent for contextual football transitions and varied first-touch/body responses, but requires a large curated motion database, feature design and trajectory/pose matching. Modern environment-aware work explicitly couples pose and trajectory during runtime search. citeturn10search10 | C: High; Perf: Med; Det risk: Low for sim if presentation-only; Cal: Low–Med       | Preserve simulation trajectory/body-state inputs so a motion matcher can later replace the blend-tree selector without changing game mechanics. |
| **Procedural pose corrections / IK**               | **LATER, targeted**                                             | Useful when simulation contact position and authored clip do not perfectly align—for example foot-to-ball contact or torso orientation. Constraint-based motion research shows how motion can be adapted while preserving important properties. citeturn14search2turn14search3                            | C: Med–High; Perf: Med; Det risk: Low if visual; Cal: Low                          | Start with small one-way corrections. Do not feed IK results back into authoritative ball/player state.                                         |
| **Foot placement / foot locking**                  | **LATER but likely important before visual polish is complete** | Prevents visually obvious foot skating as kinematic trajectories are blended or retimed. Footskate-cleanup research demonstrates explicit satisfaction of foot-plant constraints. citeturn14search4                                                                                                        | C: Med; Perf: Low–Med; Det risk: Low; Cal: Low                                     | Detect expected stance phases and lock planted foot with IK/root visual offset.                                                                 |
| **Physics-driven full-body animation**             | **AVOID UNTIL NEEDED**                                          | Offers physically responsive recoveries and contact but requires substantially more control machinery. Physics-based imitation research can generate robust recoveries, which demonstrates capability rather than MVP suitability. citeturn11academia38                                                    | C: Very High; Perf: High; Det risk: Med; Cal: Low                                  | Consider only for falls, goalkeeper dives or special contact states after normal locomotion is stable.                                          |


The minimum animation inputs should be simulation observables such as:

`speed`, `moveDirectionRelativeToBody`, `bodyTurnRate`, `acceleration`, `locomotionPhase`, `ballControlled`, `actionState`, `contactState`, and desired contact geometry.

That is enough for an ordinary locomotion blend tree and later sufficient as part of a motion-matching query. Parametric Motion Graph research shows that high-quality interactive movement can be generated by organizing and blending motion examples over continuous parameter spaces. citeturn14search0 Task-based locomotion goes further and demonstrates that pivots, side steps and task-specific foot patterns can be planned around task requirements. citeturn14search5 Both reinforce the same conclusion: the simulation should expose rich motion intent, but it does not need to surrender canonical movement to the animation system.

**Motion matching is especially attractive later for this football project**, because the target contains many contextual transitions: run→cut, receive→turn, receive→pass, tackle recovery, body-opposed dribbling and stumble recoveries. Recent environment-aware motion-matching work searches using both pose and trajectory context while accounting for surrounding obstacles/agents. citeturn10search10 That is conceptually close to football. The reasons not to start there are practical: motion-data coverage, contact labeling and feature tuning become another large variable while locomotion physics is still being calibrated.

A blend tree has the opposite property. It is less visually powerful but much easier to debug. When a 90° turn is wrong, one can first inspect the simulation trajectory. After the trajectory is correct, animation quality can be judged independently. That debugging isolation is extremely valuable during Research 3.

Procedural correction should follow the same rule. A foot IK solver can visually place the striking foot on the ball, but the **simulation contact tick and ball impulse must already be determined**. Otherwise the animation solver becomes a hidden second ball-physics system.

Foot locking is likely to become important earlier than more exotic animation systems. Motion editing research identifies footskate as a particularly distracting artifact and demonstrates explicit foot-plant constraints to eliminate it. citeturn14search4 In a football game built around inertia and body orientation, planted feet are visually meaningful during braking and cuts. But the relevant sequence is still: calibrate the movement trajectory first, then fix the visual plant.

## Deterministic simulation and browser execution

The vision already calls for a fixed simulation loop, desired determinism, browser execution and a headless-friendly separation between simulation and renderer. fileciteturn0file0 These choices are not merely infrastructure. Automatic calibration depends on them: an optimizer cannot reliably compare parameter sets if repeated executions of the same scenario drift because of frame rate, randomness or iteration order.

### Fixed-step simulation

**RECOMMENDED FOR MVP.**

Do not make simulation `dt` equal to the interval delivered by `requestAnimationFrame`. Maintain an accumulator and advance the authoritative world in identical fixed steps. Rapier itself exposes `dt` as an integration parameter, defaults to 1/60 s, and notes that larger steps worsen integration approximation and increase the chance of missed fast collisions. citeturn16view4

A strong prototype starting point is therefore:


dt_{\rm sim} = \frac{1}{60}\ {\rm s}


with rendering interpolated independently.

That is a **prototype value, not the final specification**. A 120 Hz simulation can later be benchmarked against 60 Hz using exactly the same measured metrics. The deciding question should be whether the higher rate materially improves ball/contact accuracy or calibration residuals.

Fast-ball collision deserves special handling rather than forcing all 22 players and tactical AI to run at a much higher tick rate. Rapier's CCD documentation describes swept/continuous collision handling precisely as a defense against fast objects tunneling between discrete steps, with additional computational cost. citeturn16view3 A custom ball can similarly use swept sphere tests against the pitch, posts and active foot/body contact primitives, or selectively substep the ball.

### Deterministic RNG

**RECOMMENDED FOR MVP.**

`Math.random()` should not enter authoritative simulation. Instead, the match should own an explicit RNG state. PCG was designed as a small, fast pseudorandom-generator family with explicit state and well-defined algorithms, making it a reasonable candidate for seeded simulation. citeturn18view3

The important design is the API, not the specific PRNG:

```text
seed
nextUint32()
nextFloat01()
snapshotState()
restoreState()
```

For even better reproducibility, randomness should eventually be split into deterministic streams—such as technical execution, AI variation and match events—so introducing one new random call in AI does not change every later pass-error draw.

**RECOMMENDED FOR MVP:** explicit seeded PRNG.

**LATER:** stream partitioning/jump-ahead if random-consumption coupling becomes troublesome.

**AVOID:** global, implicit randomness.

### Reproducibility discipline

Determinism is larger than RNG. A practical MVP should ensure:

1. identical fixed-step count;
2. stable entity identifiers;
3. stable update order;
4. stable collision-pair/contact-event ordering;
5. explicit RNG state;
6. no wall-clock time in game logic;
7. serialization or hashing of canonical world state at selected ticks.

Rapier's own determinism requirements are instructive: its current JavaScript/WASM documentation states that the same version and same initial conditions can produce exact results across machines, but it requires bodies, colliders and joints to be created/removed in the same order and warns that nondeterministic initialization destroys that guarantee. citeturn16view1 The transferable lesson is that **deterministic algorithms are insufficient if event ordering is not deterministic**.

For this project, player-player contacts should therefore be collected and sorted by stable IDs before resolution rather than depending on whatever order a broad-phase or container happens to emit.

### Browser floating point

JavaScript `Number` is specified as IEEE-754 binary64. citeturn9search0 Basic simulation arithmetic is therefore a perfectly reasonable starting point; fixed-point arithmetic is not automatically required.

But “JavaScript uses doubles” does **not** by itself guarantee bit-identical cross-browser game simulation. Rapier's deterministic documentation specifically warns that transcendental operations such as `Math.sin` and `Math.cos` should not be assumed cross-platform deterministic for initialization. citeturn16view1

It is useful to define three determinism targets separately:


| Level                                | Recommendation           | Meaning                                                                                      |
| ------------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------- |
| **Repeatable local/headless replay** | **RECOMMENDED FOR MVP**  | Same build, same seed, same inputs → identical state hashes in the primary test environment. |
| **Cross-browser reproducibility**    | **LATER but test early** | Chrome/Firefox/Safari produce matching or tightly bounded authoritative states.              |
| **Bit-exact multiplayer lockstep**   | **LATER**                | All supported machines remain exactly synchronized over long matches.                        |


This avoids prematurely paying for a networking requirement the vision explicitly places later. fileciteturn0file0

Should exact cross-platform lockstep become necessary, there are several later options: use a deterministic physics backend such as Rapier's supported deterministic JS/WASM path, limit/replace transcendental operations in authoritative logic, quantize selected state after updates, or move critical arithmetic to an explicitly controlled WebAssembly implementation. Rapier currently documents its JS/WASM build as cross-platform deterministic under its stated conditions. citeturn16view1

WebAssembly itself should not be treated as a magic determinism switch. The current WebAssembly core specification documents some implementation-dependent NaN behavior in the full profile and separately defines a deterministic profile that canonicalizes such behavior and fixes relaxed-vector semantics. citeturn19search0turn19search1

### Physics engine choice

For **the ball**, the decision material favors:

**RECOMMENDED FOR MVP:** custom one-ball integrator with explicit rolling, drag, spin, bounce and contact impulses.

**LATER / replaceable:** Rapier sphere rigid body for comparison or for generalized environmental collision.

Rapier is technically capable and browser-supported. citeturn16view0 But a custom ball provides direct control over the exact parameters the measurement dataset observes. Because there is only one ball, a generic constraint solver is not automatically the simpler system.

For **players**:

**RECOMMENDED FOR MVP:** custom kinematic football controller with simple collision geometry.

**AVOID UNTIL NEEDED:** fully dynamic player rigid bodies.

**LATER:** Rapier for auxiliary collision queries, sensors, goal geometry or special dynamic states.

Rapier's own generic character controller illustrates why: it computes corrected translations through shape/ray casts, and its current built-in implementation does not handle rotational movement. citeturn16view2 The football model needs body heading as a first-class variable, not an incidental transform.

### ECS versus simpler state organization

**A full generic ECS is not necessary for the MVP.**

The envisioned match has a very small and stable set of core simulation entities—22 outfield/goalkeeper characters plus one ball—with known domain types and systems. fileciteturn0file0 At that scale, a generic entity-component framework does not solve the project's hardest problems. Locomotion calibration, ball contacts and tactical logic do.

**RECOMMENDED FOR MVP:** explicit world state with data-oriented arrays/records and explicit systems. For example, player positions and velocities can be iterated in stable player-ID order, while richer per-player tactical/action state remains structured.

**LATER:** adopt a formal ECS if the project accumulates many transient entities, effects, training agents or generic gameplay objects and profiling demonstrates an organizational/performance benefit.

**AVOID UNTIL NEEDED:** forcing every concept—including formation roles, ball-contact histories and tactical phase—into generic components simply to satisfy an architectural pattern.

The key replacement requirement is more modest: systems should consume state through explicit boundaries so storage layout can change without rewriting football rules.

### Headless execution

**RECOMMENDED FOR MVP and arguably mandatory for calibration.**

The simulation should be invokable conceptually as:

```text
world = createScenario(config, seed)
world.applyInputs(inputFrame)
world.step()
metrics.observe(world)
```

without requiring DOM, canvas, animation or audio.

This follows directly from the project's existing renderer/simulation separation. fileciteturn0file0 It also turns the entire measurement methodology into an executable optimization loop:


\text{parameter set}
\rightarrow
\text{N deterministic simulations}
\rightarrow
\text{metric extractor}
\rightarrow
\text{loss}
\rightarrow
\text{next parameter set}.


The browser build can use the same simulation module.

### Web Workers and WebAssembly

**Web Worker: LATER unless profiling shows immediate need.**

The HTML standard defines Workers specifically to run scripts independently of user-interface scripts and notes their use for computationally expensive/background work. citeturn18view0 That makes a dedicated match-simulation worker a sensible future isolation boundary.

It should not be a prerequisite for the first prototype. Worker messaging and state transfer introduce another debugging boundary. First measure the actual cost of 22 locomotion controllers, one ball, contact resolution and tactical queries.

**WebAssembly: LATER / dependency-driven.**

Rapier already demonstrates a legitimate use case: a Wasm physics dependency available through browser JavaScript. citeturn16view0 A custom football core should not be rewritten in Rust/C++/Wasm before profiling establishes a need. The WebAssembly specification is designed for portable efficient execution, but moving language/runtime does not eliminate the underlying algorithmic calibration problem. citeturn19search13

The resulting simulation-technique decisions are:


| Simulation technique             | Status                              | C       | Perf                   | Det risk              | Cal           |
| -------------------------------- | ----------------------------------- | -------: | ----------------------: | ---------------------: | -------------: |
| Fixed timestep                   | **MVP**                             | Low     | Low                    | **Low**               | **High**      |
| Ball-only CCD/swept tests        | **MVP when fast collision appears** | Med     | Low                    | Low                   | High          |
| Seeded explicit RNG              | **MVP**                             | Low     | Very Low               | **Low**               | High          |
| Stable update/event ordering     | **MVP**                             | Low     | Very Low               | **Low**               | High          |
| State hash/snapshots             | **MVP**                             | Low     | Low                    | Low                   | High          |
| Bit-exact cross-browser lockstep | **LATER**                           | High    | Low–Med                | —                     | Med           |
| Full generic ECS                 | **AVOID UNTIL NEEDED**              | Med     | variable               | Med if order careless | Neutral       |
| Headless simulation              | **MVP**                             | Low–Med | beneficial             | Low                   | **Very High** |
| Dedicated Web Worker             | **LATER**                           | Med     | potentially beneficial | Low                   | Neutral       |
| Custom Wasm simulation rewrite   | **AVOID UNTIL PROFILED**            | High    | potentially beneficial | depends               | Neutral       |


## Decision matrix and prototype research path

The research points to a fairly clear priority ordering without requiring a final technical architecture.

### Consolidated technique decisions


| Area        | Technique                                                | Decision                                |
| ----------- | -------------------------------------------------------- | --------------------------------------- |
| Locomotion  | Continuous desired/current velocity separation           | **RECOMMENDED FOR MVP**                 |
| Locomotion  | Asymmetric acceleration/braking curves                   | **RECOMMENDED FOR MVP**                 |
| Locomotion  | Speed-dependent turning/lateral acceleration constraints | **RECOMMENDED FOR MVP**                 |
| Locomotion  | Separate movement and body heading                       | **RECOMMENDED FOR MVP**                 |
| Locomotion  | Small macro locomotion/action state machine              | **RECOMMENDED FOR MVP**                 |
| Locomotion  | Short-horizon trajectory targets                         | **RECOMMENDED FOR MVP**                 |
| Locomotion  | Optimization/MPC footsteps                               | **LATER**                               |
| Contact     | Kinematic players + custom contact perturbations         | **RECOMMENDED FOR MVP**                 |
| Contact     | Balance/stumble/recovery states                          | **RECOMMENDED FOR MVP**                 |
| Contact     | Geometric shielding and continuous duels                 | **RECOMMENDED FOR MVP**                 |
| Contact     | Fully dynamic humanoid players                           | **AVOID UNTIL NEEDED**                  |
| Ball        | Independent `position/velocity/angularVelocity`          | **RECOMMENDED FOR MVP**                 |
| Ball        | Empirically fitted rolling resistance                    | **RECOMMENDED FOR MVP**                 |
| Ball        | Restitution + simplified tangential bounce friction      | **RECOMMENDED FOR MVP**                 |
| Ball        | Quadratic drag + tunable Magnus-like force               | **RECOMMENDED FOR MVP**                 |
| Ball        | Detailed seam/turf/deformation simulation                | **AVOID UNTIL NEEDED**                  |
| Interaction | First touch as contextual contact selection              | **RECOMMENDED FOR MVP**                 |
| Interaction | Dribble as repeated free-ball micro-contacts             | **RECOMMENDED FOR MVP**                 |
| Interaction | Pass/shot impulses                                       | **RECOMMENDED FOR MVP**                 |
| Interaction | Standing-tackle contact window                           | **RECOMMENDED FOR MVP**                 |
| Interaction | Sliding tackle                                           | **LATER**                               |
| Interaction | Full aerial/header duel system                           | **LATER**                               |
| AI          | Formation anchors                                        | **RECOMMENDED FOR MVP**                 |
| AI          | Ball/phase/tactic-driven formation deformation           | **RECOMMENDED FOR MVP**                 |
| AI          | Role-based behavior                                      | **RECOMMENDED FOR MVP**                 |
| AI          | Utility scoring                                          | **RECOMMENDED FOR MVP**                 |
| AI          | Soft steering/arrival/separation                         | **RECOMMENDED FOR MVP**                 |
| AI          | Reach-time passing-lane evaluation                       | **RECOMMENDED FOR MVP**                 |
| AI          | Coarse reachability/control-space map                    | **RECOMMENDED FOR MVP**                 |
| AI          | Coordinated pressing assignments                         | **RECOMMENDED FOR MVP**                 |
| AI          | Explicit attack/defense transition phases                | **RECOMMENDED FOR MVP**                 |
| AI          | Behavior trees                                           | **LATER**                               |
| AI          | ORCA-style guaranteed avoidance                          | **AVOID UNTIL NEEDED**                  |
| AI          | End-to-end tactical RL                                   | **AVOID UNTIL NEEDED**                  |
| Animation   | Simulation/animation authority separation                | **RECOMMENDED FOR MVP**                 |
| Animation   | Small animation state machine                            | **RECOMMENDED FOR MVP**                 |
| Animation   | Parametric blend tree                                    | **RECOMMENDED FOR MVP**                 |
| Animation   | Motion matching                                          | **LATER**                               |
| Animation   | Procedural contact/pose corrections                      | **LATER**                               |
| Animation   | Foot locking/placement                                   | **LATER, probably before final polish** |
| Animation   | Full physics/RL character control                        | **AVOID UNTIL NEEDED**                  |
| Simulation  | Fixed timestep                                           | **RECOMMENDED FOR MVP**                 |
| Simulation  | Explicit deterministic RNG                               | **RECOMMENDED FOR MVP**                 |
| Simulation  | Stable event/update ordering                             | **RECOMMENDED FOR MVP**                 |
| Simulation  | Headless execution                                       | **RECOMMENDED FOR MVP**                 |
| Simulation  | Simple explicit/data-oriented world state                | **RECOMMENDED FOR MVP**                 |
| Simulation  | Generic ECS conversion                                   | **AVOID UNTIL NEEDED**                  |
| Simulation  | Web Worker                                               | **LATER after profiling**               |
| Simulation  | Custom WebAssembly rewrite                               | **AVOID UNTIL PROFILED**                |


The dominant pattern is worth emphasizing: **almost every MVP recommendation is a low-dimensional, explicit, inspectable mechanism whose outputs map directly to an existing measurement.** This is exactly what the earlier research requires. fileciteturn0file1turn0file2

### Prototype sequence as decision experiments

This should not yet be treated as the engine architecture. It is a sequence of experiments designed to eliminate uncertainty before the specification phase.


| Prototype experiment         | What to build                                                                                                    | Metrics / decision it resolves                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Locomotion laboratory**    | One kinematic player; desired velocity; acceleration/braking; heading; turn constraints; no animation dependency | Reproduce `LOC-ACC`, `LOC-MAX`, `LOC-DEC`, `LOC-REV`, `LOC-T45`, `LOC-T90`, `LOC-ORI`. Decide functional form of acceleration and turning curves. fileciteturn0file1 |
| **Ball laboratory**          | Independent 3D ball; gravity; roll; bounce; drag; spin; Magnus; fixed-step headless runner                       | Fit `BALL-GND`, `BALL-BNC`, `BALL-SPN`; decide whether custom physics is sufficient or a Rapier comparison is justified. fileciteturn0file1                          |
| **Touch laboratory**         | One moving player + ball; contextual contact selector; pass/shot impulses; repeated dribble contacts             | Fit first-touch distance/latency, with-ball movement, touch cadence, pass arrival speed and orientation penalties.                                                      |
| **Contact laboratory**       | Two players + ball; deterministic overlap/contact resolution; balance states; shielding; standing tackle         | Fit shoulder displacement, velocity loss, balance disturbance, possession retention and tackle windows.                                                                 |
| **Shape laboratory**         | 22 headless players with no animation; anchors, deformation, role utilities and phase changes                    | Fit width, depth, line gaps, centroid shift, support distances, pressing latency and transition recovery.                                                               |
| **Presentation adapter**     | Renderer reads simulation state; basic animation states and blend tree                                           | Verify that replacing/blending animation leaves headless kinematics unchanged.                                                                                          |
| **Full calibration harness** | Batch scenario runner + metric extraction + parameter optimizer                                                  | Determine whether parameter families can be fitted independently before jointly optimizing coupled subsystems.                                                          |


The calibration harness is especially important. The measurement study already recommends preserving raw observations, corrected trajectories, derived metrics and uncertainty independently. fileciteturn0file1 The simulator should mirror this by outputting its own raw trajectories and running **the same metric definitions** wherever possible. A metric should not have one implementation for PES footage and another convenient definition for the new engine.

For a parameter vector \theta, an initial loss can conceptually be:


L(\theta)=
\sum_j
w_j
\frac{
D(M_j^{\rm engine}(\theta),M_j^{\rm ref})
}{
\sigma_j^2+\epsilon
}
+
\lambda P(\theta),


where M_j is an observable distribution, D is a distribution/error measure, \sigma_j represents reference uncertainty, and P penalizes pathological solutions. The latter is important because the earlier behavioral research explicitly warns that matching one scalar can hide a compensating artifact—for example correct stopping time accompanied by an instant 180° body rotation. fileciteturn0file2

Automatic calibration should progress from simple to coupled methods:

**Grid/one-dimensional search** is enough for ball roll coefficients, maximum speed, acceleration timescale and similar isolated variables.

**Small multivariate derivative-free search** becomes useful for turning, first touch and contact because several parameters interact.

**CMA-ES is a credible later calibration tool once parameter definitions are stable.** The original CMA work develops covariance adaptation for continuous optimization, and importantly for this domain, UT Austin Villa used CMA-ES to optimize walking, turning, kicking and eventually roughly 100–150 interdependent parameters in simulated humanoid soccer. citeturn20search0turn20search1 That is strong evidence that staged derivative-free optimization can be useful for football-like interdependent skills. It is not evidence that the engine should expose 150 arbitrary tuning knobs.

The better principle is:

> **First make each parameter interpretable; then automate tuning. Do not use optimization to compensate for an unclear model.**

A particularly useful calibration order is:


\text{free locomotion}
\rightarrow
\text{free ball}
\rightarrow
\text{locomotion + ball}
\rightarrow
\text{contacts}
\rightarrow
\text{individual decisions}
\rightarrow
\text{team shape}
\rightarrow
\text{full match}.


That order minimizes parameter entanglement. For example, pass-lane AI should not be calibrated until ball travel times and player reach times are approximately correct, because those are its inputs. Pressing should not be tuned before individual locomotion is correct, because otherwise an apparently slow press may really be an acceleration error.

### Techniques that should remain deliberately replaceable

The specification phase should preserve several substitutions without yet deciding their final software form.

**Ball physics:** custom deterministic integrator ↔ Rapier rigid ball. Rapier is browser-capable, supports contacts and CCD, and currently documents cross-platform deterministic JavaScript/WASM behavior under deterministic initial conditions. citeturn16view0turn16view1turn16view3 The custom implementation is presently favored because its roll/bounce/curve parameters map more directly to reference measurements.

**Player contact:** deterministic custom capsule/disc resolver ↔ general rigid contact solver. The gameplay semantics—balance, shielding and ball access—must remain outside whichever collision primitive is chosen.

**Tactical decision mechanism:** utility scorer ↔ future Behavior Tree/planner/learned policy. Behavior Trees are demonstrably modular and reactive, making them a credible later replacement or sequencing layer. citeturn10academia48

**Space model:** simple reach-time grid ↔ probabilistic availability/control model. Football analytics research demonstrates that richer pass availability and kinematics-aware dominant regions can be computed from ball/player movement models. citeturn12search0turn12search1 The engine should begin with the simplest version that produces the target team behavior.

**Animation:** state machine/blend tree ↔ motion matching. Parametric blending already supports interactive continuous motion control, while newer motion-matching work demonstrates richer pose/trajectory-aware selection. citeturn14search0turn10search10 Neither should alter canonical simulation state.

**Storage/execution:** straightforward JavaScript state ↔ typed-array/data-oriented representation ↔ worker/Wasm execution. The HTML platform provides Workers specifically for running computational work independently of UI scripts, while WebAssembly provides a portable low-level execution format; neither needs to be committed before profiling. citeturn18view0turn19search13

### Research conclusion for the specification phase

The strongest evidence supports a **designed, calibrated football simulation rather than a maximal physical simulation**.

For players, the MVP should favor continuous kinematic state with explicit acceleration, braking, lateral-turn and orientation limits. This offers the highest calibration leverage against the existing locomotion tests and preserves the critical “immediate intention, delayed body” target. fileciteturn0file1turn0file2

For the ball, an independent custom rigid-sphere-like state with empirical ground roll, simple bounce/friction, spin, drag and Magnus-like forces provides the clearest mapping from measurements to implementation. Real soccer-ball research supports keeping speed/spin effects rather than constant curve hacks, while simultaneously showing enough aerodynamic complexity to make detailed real-world aerodynamics a poor MVP target. citeturn15search1turn15search0turn15search8

For player-ball interaction, the unifying primitive should be **contact events that alter the free ball**. First touch, dribbling, passing, shooting and tackling become different policies for selecting contact time, contact geometry and desired outgoing ball state rather than unrelated gameplay subsystems. That is highly compatible with the reference's emphasis on loose-ball behavior and contextual first touch. fileciteturn0file2

For physical player interaction, controlled kinematic bodies plus deterministic overlap/contact resolution and explicit balance states offer a substantially better fit than either ghost-like agents or full rigid humanoids. A general character controller or rigid-body solver should remain an implementation option, not the source of football behavior. Rapier's own character-controller design reinforces that such control remains game-specific and does not itself solve rotational football locomotion. citeturn16view2

For AI, the MVP should be **formation-first and role-first**, with utility scoring for local choices, soft steering for movement requests, reachability-aware passing/space estimates, coordinated pressing assignments and explicit transition states. Simulated-soccer research on dynamic role assignment and football research on pass availability/dominant regions provide strong independent precedent for those decompositions. citeturn10search2turn12search0turn12search1

For animation, canonical simulation and presentation must remain separate from the beginning. A small state machine and blend tree are sufficient to expose whether the calibrated football movement looks coherent. Motion matching, procedural contact adjustment and foot locking are powerful **later** improvements with strong research precedent, but they should not become hidden mechanics. citeturn14search0turn14search4turn10search10

For simulation infrastructure, fixed stepping, explicit seeded randomness, stable ordering, state hashing and headless execution are **MVP requirements**, not polish. They turn the PES-reference measurements into an optimization target and make regression testing possible. Current browser standards provide IEEE-754 binary64 JavaScript arithmetic and background Workers, while physics systems such as Rapier demonstrate that deterministic browser/Wasm rigid-body simulation is technically feasible if eventually required. citeturn9search0turn18view0turn16view1

The principal items to **AVOID UNTIL NEEDED** are therefore not “bad” technologies; they are technologies that introduce degrees of freedom before the measurable problem warrants them: fully dynamic humanoids, physics-based character RL, end-to-end tactical RL, guaranteed multi-agent collision avoidance, seam-level ball aerodynamics, giant locomotion FSMs, early generic ECS adoption, mandatory WebAssembly, and animation/root-motion ownership of game state. The current reference dataset can discriminate among much simpler models first. fileciteturn0file1

That leaves the specification phase with a much narrower and testable set of unresolved decisions: the exact functional families for acceleration/braking/turning; the custom-ball versus Rapier benchmark result; the reduced balance/contact model; the utility feature set and decision cadence; the resolution of the space/reachability grid; and the exact fixed-step/substep policy. Those are decisions that can be settled empirically against the existing test catalog rather than by guessing what a football engine “should” look like.

## Sources

Reconstructed from the document's citations (the `citeturnNsearchM` / `fileciteturnNfileM` markers that appear inline in the body are unresolved export artifacts; this list recovers the real titles and URLs they pointed to, but does not reassign a citation number to each individual inline marker). `fileciteturn0fileN` markers refer to the project's own prior research documents (this document's Vision, Reference Measurement, and Behavior research) rather than external sources, and are not listed below.

1. Reynolds, C. — "Steering Behaviors For Autonomous Characters" — https://www.red3d.com/cwr/papers/1999/gdc99steer.html
2. Rapier — "Character Controller" (docs) — https://rapier.rs/docs/user_guides/javascript/character_controller/
3. Peng, X. B. et al. — "DeepMimic: Example-Guided Deep Reinforcement Learning of Physics-Based Character Skills" (arXiv) — https://arxiv.org/abs/1804.02717
4. "Task-based Locomotion" (UBC Computer Graphics) — https://www.cs.ubc.ca/~van/papers/2016-TOG-taskBasedLocomotion/index.html
5. "Smooth and Collision-Free Navigation for Multiple Robots Under Differential-Drive Constraints (ORCA-DD)" — https://gamma-web.iacs.umd.edu/ORCA-DD/
6. Rapier — physics engine homepage — https://www.rapier.rs/
7. Rapier — "Colliders" (docs) — https://rapier.rs/docs/user_guides/javascript/colliders/
8. "Measurements of the Flight Trajectory of a Spinning Soccer Ball and the Magnus Force Acting on It" (MDPI) — https://www.mdpi.com/2504-3900/49/1/88
9. "Wind-tunnel Experiments and Trajectory Analyses for Five Nonspinning Soccer Balls" (ScienceDirect) — https://www.sciencedirect.com/science/article/pii/S1877705816306324
10. "A Method for Accurate Measurement of the Non-linear Rolling Friction Coefficient between an Instrumented Ball and a Surface" (ScienceDirect) — https://www.sciencedirect.com/science/article/pii/S1877705813010977
11. MacAlpine, P., Stone, P., et al. — "Positioning to Win: A Dynamic Role Assignment and Formation Positioning System" — https://www.cs.utexas.edu/~pstone/Papers/bib2html/b2hd-LNAI12-MacAlpine.html
12. "Behavior Trees in Robotics and AI: An Introduction" (arXiv) — https://arxiv.org/abs/1709.00084
13. "Who Can Receive the Pass? A Computational Model for Quantifying Availability in Soccer" (Data Mining and Knowledge Discovery, Springer) — https://link.springer.com/article/10.1007/s10618-022-00827-2
14. "Football Player Dominant Region Determined by a Novel Model Based on Instantaneous Kinematics Variables" (PMC) — https://pmc.ncbi.nlm.nih.gov/articles/PMC8440569/
15. "Parametric Motion Graphs" (Proceedings of the 2007 Symposium on Interactive 3D Graphics and Games) — https://doi.org/10.1145/1230100.1230123
16. "Environment-aware Motion Matching" (ÉTS Research Discovery Portal) — https://pure.etsmtl.ca/en/publications/environment-aware-motion-matching/
17. "Retargetting Motion to New Characters" (Proceedings of SIGGRAPH 1998) — https://doi.org/10.1145/280814.280820
18. Kovar, L., Schreiner, J. & Gleicher, M. — footskate cleanup / motion editing work (UW Graphics Group) — https://graphics.cs.wisc.edu/Papers/2002/KSG02/
19. Rapier — "Integration Parameters" (docs) — https://rapier.rs/docs/user_guides/rust/integration_parameters/
20. Rapier — "rigid_body_ccd" (docs) — https://rapier.rs/docs/user_guides/javascript/rigid_body_ccd
21. O'Neill, M. — "The PCG Paper: A Better Random Number Generator" — https://www.pcg-random.org/paper.html
22. Rapier — "Determinism" (docs) — https://rapier.rs/docs/user_guides/javascript/determinism/
23. ECMA International — "ECMAScript® 2026 Language Specification" (TC39) — https://tc39.es/ecma262/pr/3752/
24. "Profiles" (WebAssembly 3.0 Draft) — https://webassembly.github.io/memory64/core/appendix/profiles.html
25. WHATWG — "HTML Standard" (Workers section) — https://html.spec.whatwg.org/multipage/workers.html
26. "Introduction" (WebAssembly 3.0 Core Specification) — https://webassembly.github.io/spec/core/intro/introduction.html
27. "Research Numerics – Derandomized Evolution Strategies and Local Learning Algorithms" (CSE-Lab) — https://cse-lab.seas.harvard.edu/research-numerics-derandomized-evolution-strategies-and-local-learning-algorithms/
