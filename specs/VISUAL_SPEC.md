# Football Simulation Engine — Visual Specification

**Status:** Project-level visual constraints and evaluation contract; implementation choices and numeric thresholds remain provisional

**Date:** 2026-08-12

**Scope:** Browser presentation for gameplay, replay, visual laboratories, and representative 11v11 scenes

**Specification version:** `visual-spec-v1`

## 1. Purpose and authority

This document converts the visual-direction and browser-architecture research into project-level visual constraints, configurable presentation contracts, experiments, and evaluation targets. It governs what the renderer and art pipeline must preserve while leaving unsupported implementation choices open.

The governing project rule is **gameplay first, rendering second**. Simulation state and canonical action/contact timing are authoritative; visuals present that state and MUST NOT change a football outcome. [VISION §2](../VISION.md#2-principio-principal) [TECHNICAL_SPEC §13–14](./TECHNICAL_SPEC.md#13-simulation-to-presentation-boundary)

The research audit supersedes conflicting or overly specific visual recommendations. The corpus supports a stylized, non-photorealistic presentation based on limited palettes, readable silhouettes, restrained texture noise, and strong team/ball contrast. It does **not** yet support freezing the exact shader, outlines, LODs, camera, crowd, asset budgets, performance targets, or numeric readability thresholds. [RESEARCH_AUDIT F-15–F-16](../research/RESEARCH_AUDIT.md#f-15--the-visual-document-both-locks-and-defers-the-shading-model) [RESEARCH_AUDIT F-34–F-39](../research/RESEARCH_AUDIT.md#f-34--visual-role-silhouettes-are-an-unsupported-gameplay-assumption)

The terms **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative only where this document marks a decision `REQUIRED` or `PREFERRED` as defined below.

## 2. Commitment levels

Every visual statement belongs to exactly one level:

| Level | Meaning | Project treatment |
|---|---|---|
| `REQUIRED` | Supported project constraint or architecture invariant. | Must be satisfied by every shippable visual configuration unless a narrower test fixture documents non-applicability. |
| `PREFERRED` | Current art direction with a supported rationale but more than one acceptable realization. | Default direction; deviation requires a documented readability, production, or performance reason. |
| `EXPERIMENT` | Hypothesis that needs a representative scene, task-based perceptual study, or target-device measurement. | Must remain switchable/configurable during the experiment and cannot become a production gate before its decision rule is met. |
| `DEFERRED` | Decision intentionally postponed until a named prerequisite exists. | Must not be embedded irreversibly in asset authoring or renderer contracts now. |

Numeric values shown in experimental fixtures define controlled conditions, not quality thresholds. All final contrast, timing, distance, polygon, texture, rig, frame-time, memory, and load-time thresholds are `TBD` until measured and versioned.

## 3. Visual objective and priority order

The visual objective is a clear, original, stylized football presentation that makes the match state easy to parse at gameplay speed and at the actual camera scale. It does not attempt to reproduce PES 2017 assets or presentation, and photorealism is not a project target.

When visual goals conflict, use this priority order:

1. Preserve truthful presentation of authoritative simulation state.
2. Keep the ball locatable and its motion interpretable.
3. Distinguish the two teams, goalkeepers, referee/officials when present, and the controlled player.
4. Make actions, orientation, contact, and groundedness readable.
5. Preserve individual player identity and spatial depth.
6. Maintain the project's graphic, non-photorealistic cohesion.
7. Add environmental richness and close-up detail.

Performance is a feasibility constraint across all seven priorities. It is not permission to compromise simulation authority or silently remove a required readability channel; a lower quality tier must use an explicit fallback.

## 4. Overall visual direction

### 4.1 Required constraints

- The presentation MUST be non-photorealistic and visually coherent across players, ball, pitch, goals, and environment.
- Primary forms MUST read before surface detail. A gameplay-critical object MUST NOT depend on facial features, fabric weave, a small logo, or another high-frequency detail as its only identification cue.
- The scene MUST use controlled color and value relationships so that players and the ball remain distinct from the pitch and stadium at the active gameplay camera.
- Texture, geometry, lighting, effects, and background detail MUST remain subordinate to ball, team, controlled-player, and action readability.
- Visual assets MUST be original or have documented project-compatible licenses. The project MUST NOT copy Mark of the Ninja subject matter, characters, environments, iconography, or another game's proprietary visual identity.

### 4.2 Preferred direction

- Favor bold illustrative forms, limited palettes, deliberate color blocks, low-frequency surface treatment, and broad lighting responses.
- Favor low-to-medium apparent complexity over either raw primitive placeholders or realistic micro-detail.
- Use exaggeration only when it improves recognition of physical form, orientation, or action without misrepresenting canonical timing or capability.
- Keep the pitch as a clear, restrained spatial plane; keep player/ball accents more salient and distant stadium elements quieter in contrast, saturation, and spatial frequency.

### 4.3 Mark of the Ninja boundary

The visual research explicitly recommends adopting three transferable principles from Mark of the Ninja: **silhouette clarity**, **controlled palette/value**, and **detail subordinated to the primary form**. Those principles inform the constraints above.

The following observations are not requirements for this football game:

- solid-black player rendering in shadow;
- light versus darkness as a danger or information state;
- fog of war, view-edge darkness, or hidden opponents;
- visualized sound ripples or stealth icons;
- the game's subject matter, palette, environment, or character design.

Any such treatment requires an independent football-readability experiment and cannot be justified solely by the reference game.

## 5. Character silhouette and proportion

### 5.1 Silhouette principles — `REQUIRED`

- Head, torso, pelvis, upper/lower limbs, and foot direction MUST form a legible hierarchy in idle, locomotion, turn, kick, tackle, jump/header, contact, stumble, and recovery poses used by the current milestone.
- Left/right body orientation and major limb separation MUST remain interpretable at the provisional gameplay camera wherever the action depends on them.
- A silhouette MUST remain stable enough through animation blending that anticipation, contact, and follow-through are not visually collapsed into an ambiguous pose.
- Accessories and kit geometry MUST NOT obscure foot/ball contacts, merge both legs into a persistent block, or create a false ball-like shape.
- Every production character and LOD representation MUST be checked in monochrome from representative broadcast directions. Monochrome review is diagnostic; it does not by itself prove recognition.

### 5.2 Body and proportion strategy

`PREFERRED`:

- Use a shared stylized anatomy language with slightly emphasized head, shoulder, knee, lower-leg, and foot masses where this helps orientation and action reading.
- Maintain a small, controlled family of physical archetypes such as short/average/tall and light/average/heavy, with interpolation or modular variation rather than a unique topology for every player.
- Preserve believable football movement ranges. Exaggerated proportions should clarify rather than turn players into position stereotypes.

`REQUIRED`:

- Visual body proportions MUST be sourced from explicit presentation/profile data or a documented fictional archetype assignment. Nominal tactical position MUST NOT silently determine body mass, collider size, acceleration, contact strength, or any other simulation property.
- Visual scale, root offsets, and limb proportions MUST NOT alter canonical player position, contact time, ball impulse, reach, or collision geometry.
- If physical dimensions later affect simulation, they MUST enter through a versioned simulation capability/dimension contract and not be inferred from rendered mesh bounds.
- Every character rig, visual body profile, and applicable LOD MUST have an accepted `EmbodimentMapping` to each supported simulation body/reach profile. The mapping names semantic contact anchors, compatible canonical dimensions, scale policy, action pose envelopes, and maximum translation/angle correction.
- Import validation MUST exercise head, foot, leg, and hand contact samples used by the active milestone at pose-envelope extremes. An asset/profile pairing that cannot reach those samples within its declared correction limits is rejected; neither simulation reach nor mesh scale is silently changed.

`EXPERIMENT`:

- Compare role-coded silhouettes (for example, blockier defenders or leaner forwards) against neutral physical archetypes. The hypothesis is accepted only if blinded task results improve useful recognition without causing systematic capability/role misclassification. Until then, position-coded shape language is not an asset rule.

## 6. Player individuality

### 6.1 Required constraints

- Player identity MUST be composable from data rather than hard-coded to one team or roster.
- At gameplay distance, individuality MUST use at least one medium- or large-scale cue that survives the active LOD, such as body archetype, height class, head/hair silhouette, sleeve/sock block, or a permitted accessory.
- Jersey number and name MAY reinforce identity but MUST NOT be the only gameplay-distance cue.
- Individual variation MUST remain subordinate to team grouping and MUST NOT weaken the kit-clash solution.
- Cosmetics MUST NOT imply a gameplay capability that the profile does not contain, and MUST NOT modify simulation state.

### 6.2 Preferred direction

- Build individuality from a restrained combination of body archetype, head shape, hair silhouette, skin/hair palette, facial-hair block, sleeve style, and a small accessory vocabulary.
- Reserve fine facial features, fabric detail, and small emblems for close replay/cutaway distances where they are visible and affordable.
- Use stable procedural seeds or explicit authored selections so the same player has reproducible visuals in captures and replays.

### 6.3 Deferred decisions

- face fidelity, face textures, likeness support, and close-up facial animation;
- branded players, clubs, badges, sponsors, and real-world kit reproduction pending data and legal decisions;
- the final number of body, head, hair, accessory, and material variants.

## 7. Kit and team readability

### 7.1 Kit data contract — `REQUIRED`

Neutral presentation data MUST be able to provide, at minimum:

```text
TeamVisualProfile
  teamVisualId / version
  outfieldKits[]
    kitId
    role: primary | alternate | additional
    shirt/shorts/socks palette and value metadata
    large-scale pattern metadata
    number/name colors
  goalkeeperKits[]
  optional accessibility variants[]

OfficialVisualProfile (when officials are rendered)
  kit choices and palette/value metadata

PresentationMatchConfig
  bindings from stable simulation team/player IDs to visual-profile IDs
  selected outfield/GK/official kit and asset-manifest IDs
  embodiment mapping per player
  accessibility mode and local-control-slot indicator profiles
  VisualConfig ID/version
```

The browser composition layer owns `PresentationMatchConfig` and passes it to the renderer alongside immutable `PresentationSnapshot`s. It validates all shared IDs before the match/capture and records the config and resolved asset hashes as presentation provenance. The configuration is never inserted into canonical gameplay state, and the renderer MUST NOT fetch provider data or infer a visual profile from mutable globals. [TECHNICAL_SPEC §13.1.1](./TECHNICAL_SPEC.md#1311-presentation-match-configuration)

Color metadata MUST be represented in a defined color space in the implementation contract. The exact storage color space and numeric contrast formula are `TBD` and must be selected before automated clash scoring becomes a gate.

### 7.2 Matchup selection — `REQUIRED`

- The presentation adapter MUST choose among available outfield and goalkeeper kits for the actual matchup; it MUST NOT assume globally fixed team colors.
- Selection MUST consider rendered hue/value separation, large-scale pattern separation, goalkeeper/outfield separation, officials when present, and supported color-vision simulations.
- Team classification MUST have at least two usable channels among value, hue, and large-scale pattern. Hue alone is insufficient.
- A controlled-player indicator MUST remain independent of team-kit hue and MUST be testable in every supported color-vision condition.
- If no available combination satisfies the current validated policy, the renderer MUST surface an explicit clash failure or apply a documented accessibility fallback; it MUST NOT silently select the least-bad pair.
- Kit choice, accessibility mode, controlled-player indicator variant, and clash-policy version MUST be captured in screenshot/replay provenance.

### 7.3 Preferred direction

- Use two or three dominant color/value regions per kit at gameplay distance.
- Keep patterns broad enough to survive minification and LOD changes.
- Treat numbers, trim, crests, and sponsors as secondary/tertiary information rather than team classification infrastructure.

Exact palette pairs and numeric clash thresholds remain experimental; the blue/gold versus red/white example in the visual research is illustrative only.

## 8. Geometry and detail strategy

### 8.1 Required constraints

- Geometry MUST spend complexity on the outer contour, major joint articulation, foot/ball relationship, and deformations visible at the gameplay camera before spending it on hidden or sub-pixel surface detail.
- Mesh, normals, materials, and textures MUST avoid high-frequency noise that shimmers, aliases, or masks limb/ball separation in motion.
- Goals, posts, net, corner flags, and field markings MUST preserve their gameplay-relevant shape and location relative to the authoritative pitch template.
- Collision and physics MUST NOT read renderer mesh bounds as canonical gameplay geometry.
- Production budgets MUST be derived from the representative asset and 22-player benchmark in §19; this specification MUST NOT invent polygon or texture limits before that benchmark.

### 8.2 Preferred direction

- Favor clean planes, broad curvature, deliberate hard/soft normal boundaries, and a small material set.
- Express folds, panels, badges, and seams through low-frequency color blocks or simplified normal treatment only when they survive the intended view.
- Prefer atlas/mask-driven kit variation and shared reusable materials where profiling confirms that they reduce memory or draw cost without causing visible color bleeding or loss of identity.

### 8.3 Deferred decisions

- exact triangle/vertex counts per player and per LOD;
- exact texture dimensions, channel packing, compression, atlases, and material count;
- high-detail sculpt/retopology as a mandatory production step;
- baked ambient occlusion or pre-lighting as a universal authoring requirement.

## 9. Shading and outlines

### 9.1 Shading

`REQUIRED`:

- Shading MUST preserve the limited-palette, readable-form direction and MUST NOT introduce realistic specular noise, skin/fabric micro-response, or gradients that erase kit value grouping.
- Materials MUST remain readable under every supported match-lighting preset and quality tier.
- The ball, players, pitch, and environment MUST use a consistent visual grammar even if their exact material implementations differ.
- Material selection and parameters MUST be presentation-only and versioned in capture provenance.

`PREFERRED`:

- Use broad shadow, midtone, and highlight regions or an equivalently restrained stylized response.
- Keep specular response broad and quiet unless a local cue has a demonstrated readability purpose.
- Prefer a small set of authored value ramps over uncontrolled physically realistic range.

`EXPERIMENT`:

- Compare minimal stylized PBR, two/three-band cel shading, and any hybrid NPR candidate in the same representative scene and lighting.
- Evaluate not only preference but ball/team/action recognition, temporal stability, authoring requirements, and target-device cost.

The exact shader model and band count remain unresolved until that experiment is accepted.

### 9.2 Outlines

Outlines are `EXPERIMENT`, not a baseline requirement.

- Test outlines off/on for player exterior silhouettes, selected internal creases, and the ball independently; a single global outline decision is not required.
- Compare geometry/inverted-hull, material/normal-based, and screen-space approaches only when needed to answer cost or stability questions.
- Any candidate MUST be checked for camera-distance thickness, resolution dependence, temporal shimmer, overlap ambiguity, LOD popping, color bleeding, and GPU cost.
- Outline width and color MUST be configurable in screen-relative terms or through a documented distance response during the experiment.
- An outline MUST NOT make the ball appear materially larger, hide the contact gap, or merge adjacent opposing players.

If outlines are rejected, the fallback direction is controlled value separation and an optional restrained rim/edge light. The fallback itself must pass the same perceptual tasks.

## 10. Lighting and shadows

### 10.1 Lighting — `REQUIRED`

- Gameplay lighting MUST support rapid reading of players, ball, pitch markings, goals, and depth; atmosphere is secondary.
- The active light rig MUST preserve kit separation and ball contrast across the playable pitch, including camera-facing and camera-away orientations.
- Lighting MUST NOT encode hidden gameplay state or make a simulated visible player intentionally unreadable.
- Exposure, tone mapping, and post-processing MUST avoid clipping team color differences or pitch markings.
- Gameplay lighting parameters MUST be reproducible and included in visual-test provenance.

### 10.2 Preferred lighting direction

- Favor one simple dominant illumination structure plus restrained ambient/fill over many competing local lights.
- Favor broad, stable value regions and a slightly quieter, darker/desaturated stadium than the play surface.
- Day and night may use distinct presets, but both should preserve the same readability hierarchy.

### 10.3 Shadows

`REQUIRED`:

- The ball MUST have a grounded, state-derived shadow/contact cue sufficient to judge its relationship to the pitch when ordinary geometric shadowing is ambiguous.
- Shadow presentation MUST derive from rendered/simulation transforms and MUST NOT move, delay, or predict canonical ball state.
- Player and ball shadows MUST NOT hide the ball, field markings, foot contacts, or team classification at the active camera.
- Every quality tier MUST define a shadow fallback rather than silently losing the ball-ground cue.

`EXPERIMENT`:

- Compare conventional shadow maps, simplified hard/soft stylized shadows, and blob/contact shadows for players and ball.
- Measure readability, temporal stability, overlap behavior, and p95 render cost in the representative scene.

Exact light counts, shadow casters, map resolutions, softness, cascades, and baked-versus-real-time policy are deferred to the lighting/shadow and target-device experiments.

## 11. Ball readability

The ball is the primary visual target.

### 11.1 Required constraints

- The baseline ball MUST use a size-appropriate, high-contrast material plus a grounded shadow/contact cue. It MUST be tested against every supported pitch/marking, kit matchup, lighting preset, and quality tier.
- Ball visibility MUST remain sufficient during stationary, rolling, bouncing, aerial, fast-pass, shot, partial-occlusion, crowd-side, and goalmouth conditions.
- Surface markings MUST be broad enough to remain temporally stable; they MUST NOT create flicker that is mistaken for spin or speed.
- Ball scale, render offset, shadow, and optional effects MUST NOT modify authoritative position, radius, contact timing, or trajectory.
- Physics evaluation MUST use state-space evidence. Visual effects MUST NOT be used to make a physically incorrect trajectory pass a gameplay evaluation.

### 11.2 Experiments and deferred effects

Ball outline, glow, halo, airborne spotlight, motion trail, afterimage, contact flash, and speed lines are `DEFERRED` until baseline contrast and shadow have been evaluated with a stable camera and ball model.

When reconsidered, each effect MUST be tested independently on/off over identical replays for:

- acquisition time and tracking continuity;
- perceived speed, height, curve, and contact-time bias;
- clutter and overlap with players/markings;
- accessibility and photosensitivity concerns;
- target-device cost.

An effect may be adopted only if it improves a defined perceptual task without a material misreading of ball behavior under the accepted study policy.

## 12. Pitch treatment

### 12.1 Required constraints

- Pitch geometry and markings MUST be generated or validated against the configurable pitch/rules template; no visual layer may assume one universal pitch size.
- The playing surface MUST use low-frequency treatment that does not camouflage the ball or feet and does not introduce unstable shimmer at camera distance.
- Touchlines, goal lines, halfway line, center circle, penalty areas, goal areas, penalty marks, and corner arcs required by the active rules template MUST remain spatially clear.
- Visual mowing bands, wear, decals, or gradients MUST NOT be required to infer gameplay state and MUST NOT resemble a ball, player indicator, or boundary.
- Pitch visuals MUST not affect ball friction, bounce, rules, or player locomotion unless a separately specified authoritative surface type exists in simulation data.

### 12.2 Preferred direction

- Use a restrained mid-value green family, gentle low-frequency variation, and crisp field markings.
- Keep field-line treatment stable rather than glowing or overexposed; increase width/contrast only through a tested camera-aware presentation policy.
- Use wear and variation sparingly and primarily in close views.

Exact grass technique, mowing pattern, line width in pixels, anisotropy, decals, and weather treatment remain deferred.

## 13. Stadium and environment treatment

### 13.1 Required constraints

- The environment MUST frame the match without competing with players, ball, goals, pitch markings, or HUD.
- Distant stands/crowd MUST have lower effective detail and visual salience than gameplay actors at the active camera.
- Environment motion, emissive signage, flags, and spectators MUST NOT produce repeated ball-sized high-contrast targets near the pitch.
- Goals, posts, nets, advertising boundaries, benches, flags, and stadium collision-adjacent objects MUST visually agree with the authoritative pitch and rules geometry where relevant.
- Environment assets and branding MUST be original or appropriately licensed.

### 13.2 Preferred direction

- Treat distant stands and crowd as simplified masses, grouped color areas, or other low-frequency representations rather than individually legible spectators.
- Use team-color accents sparingly and keep them distinguishable from active kits.
- Add close-view detail to goals, benches, and tunnel areas only after gameplay-camera readability and performance targets are met.

### 13.3 Deferred decisions

- crowd representation technique, density, animation, impostors, audio-reactive behavior, and polycount;
- stadium variety, weather, time-of-day set, signage, broadcast dressing, and cinematic presentation;
- vignettes, fog, bloom, depth of field, motion blur, volumetric effects, and other post-processing.

Fog of war or intentional hiding of visible opponents is outside the preferred football direction and would require a separate gameplay/design decision.

## 14. Animation readability

### 14.1 Required constraints

- Animation MUST present the semantic locomotion, action, contact, balance, and rule states supplied by `PresentationSnapshot`.
- Canonical translation, body heading, action/contact tick, ball outcome, and rules events remain simulation-owned. Root motion, blend state, IK, pose correction, or mesh collision MUST NOT create an unrecorded gameplay result.
- Major actions MUST expose a readable preparation/anticipation, active/contact, and recovery/follow-through progression when those phases exist in simulation state.
- Kicks, passes, shots, tackles, headers, turns, braking, shielding, stumbles, and recoveries MUST be distinguishable in motion at their intended gameplay distance before close-up polish is accepted.
- Animation blending MUST NOT visibly teleport feet or ball, reverse body orientation without a turn, erase a canonical contact, or imply an extra contact.
- Any visual contact correction MUST be bounded, presentation-only, configurable, and observable in debug/capture data.

### 14.2 Preferred direction

- Use strong key poses and restrained exaggeration of torso lean, plant, limb extension, and follow-through where it clarifies an action.
- Spend animation fidelity on action onset, contact continuity, directional changes, and balance recovery before idle variety.
- Favor a compact state machine and parametric blend tree consistent with the Technical Spec.

### 14.3 Experimental and deferred animation

- The degree of pose/timing exaggeration is experimental and must be compared over identical canonical events.
- Motion matching, procedural foot locking, advanced IK, ragdolls, physics-driven animation, and high-fidelity facial animation are deferred.
- More animation frames are not inherently a requirement; temporal sampling and blending must be selected by visible continuity and cost.

## 15. Camera-distance behavior

### 15.1 Required constraints

- All gameplay-readability claims MUST name the camera preset, viewport, device scale factor, quality tier, and observed on-screen actor/ball size. “Readable at distance” without these conditions is not an acceptance claim.
- Assets MUST be evaluated at near, representative gameplay, far gameplay, and overlap/occlusion conditions produced by the provisional camera candidate.
- At far gameplay distance, priority is ball, team, controlled player, facing/action class, and location. Individual face, crest, and number recognition are not required.
- At representative gameplay distance, team, controlled player, ball, broad body orientation, and major action state MUST not depend on close-only detail.
- At close replay distance, additional detail MAY appear but the silhouette, palette hierarchy, and material grammar MUST remain consistent with gameplay view.
- Camera zoom or transition MUST NOT cause an unhandled readability gap, a missing required cue, or persistent LOD/material oscillation.

### 15.2 Camera status

Camera height, pitch, FOV/orthographic zoom, target, lead, smoothing, lag, framing, dynamic zoom, replay behavior, and transition curves are `EXPERIMENT`. A single provisional fixed gameplay preset must be selected through the Camera Laboratory before representative visual thresholds or production art budgets can be frozen. [TECHNICAL_SPEC §13.4](./TECHNICAL_SPEC.md#134-camera-and-visual-cues)

Dynamic and replay cameras are `DEFERRED` until that preset is stable.

## 16. LOD strategy

### 16.1 Required constraints

- LOD is a renderer-owned presentation mechanism and MUST NOT change canonical entity identity, transform, action/contact state, ball state, physics, AI, or rules.
- Every LOD/fallback used in a supported quality tier MUST preserve team classification, controlled-player cue, broad action silhouette, and stable ground placement.
- LOD selection MUST use documented presentation inputs and MUST be reproducible for visual tests.
- Transitions MUST be evaluated for popping, silhouette jumps, palette shifts, foot sliding, animation discontinuity, and rapid threshold oscillation.
- Asset exports MUST retain stable player/material/rig identifiers across applicable representations so captures and debugging remain attributable.

### 16.2 Experimental candidates

The existence, count, technique, and switch thresholds of production LODs remain experimental. Candidate representations include:

- full rigged mesh for close/representative views;
- simplified rigged mesh/material for farther gameplay views;
- highly simplified mesh or impostor for exceptional full-field/replay views.

A capsule or billboard is not an assumed LOD2 requirement. It is acceptable only if the relevant distance tasks pass and transitions remain coherent.

### 16.3 Deferred decisions

- exact number of LOD levels and hysteresis/cross-fade policy;
- automated versus authored reduction;
- impostor/billboard technique;
- per-LOD geometry, rig, bone, material, and texture budgets.

## 17. Asset-pipeline constraints

### 17.1 Required pipeline contract

Each production visual asset or asset family MUST provide:

```text
Asset identity
  stable assetId
  sourceVersion and exportVersion
  author/license/source record

Compatibility
  renderer/material profile version
  rig/skeleton profile where applicable
  supported quality tiers / candidate LODs
  accepted EmbodimentMapping IDs and simulation body-profile versions
  semantic contact anchors, scale policy, pose envelopes, and per-LOD correction limits

Presentation metadata
  bounding information for culling only
  sockets/anchors used only for presentation
  team-color masks or material slots where applicable
  intended camera-distance class

Validation artifacts
  neutral-light turntable
  monochrome silhouette sheet
  gameplay-camera capture
  relevant action/contact capture
  performance measurements when representative
```

- Source and exported assets MUST be versioned so a replay/capture can identify the presentation configuration used.
- Runtime assets MUST use browser-compatible formats supported by the provisional Three.js adapter; the exact format and compression profile remain implementation decisions until benchmarked.
- Character visual variation SHOULD share reusable animation/rig contracts where feasible, but a particular skeleton, bone count, or GPU-skinning implementation is not yet normative.
- Team-color replacement MUST use explicit masks/material metadata and MUST not rely on ad hoc texture editing per matchup.
- Automated LOD, atlas, compression, or baking tools MUST be deterministic enough to reproduce an export from pinned sources/tool versions, or their generated outputs MUST be versioned as source artifacts.
- Asset import validation MUST reject missing IDs, incompatible profiles, invalid numeric data, missing required kit masks/slots, references to unavailable materials/textures, absent semantic anchors, and any body/reach/action contact fixture that exceeds the declared pose envelope or visual-correction bound.

### 17.2 Pipeline experiment

Before production art begins, build one representative original rigged character with one kit system, the actions needed by the current milestone, the ball, and candidate material/LOD variants. Use it in the 22-player benchmark to derive actual budgets and authoring rules.

### 17.3 Deferred pipeline choices

- DCC package and source-file conventions;
- exact runtime container, mesh compression, texture compression, and animation compression;
- common skeleton topology, bone count, skin influence count, and clip sampling rate;
- texture resolution, atlas layout, normal-map use, and material-slot limits;
- automated LOD and build-farm tooling.

## 18. Configurable visual parameters

Visual behavior MUST be supplied through a versioned `VisualConfig` (or equivalent composed records), never scattered as untracked shader/scene constants. A visual test capture MUST record the config version/hash plus any overrides.

At minimum, the contract MUST have configurable fields for:

| Domain | Configurable parameters | Current status |
|---|---|---|
| Quality | quality tier, resolution scale, antialiasing, feature fallbacks | Values/tiers `DEFERRED` |
| Matchup | selected outfield/GK/official kits, clash-policy version, accessibility mode | Contract `REQUIRED`; algorithm/thresholds `EXPERIMENT` |
| Player | archetype/variant IDs, palette/masks, accessory set, controlled-player indicator | Contract `REQUIRED`; catalogs `DEFERRED` |
| Materials | shader profile, value ramp/bands, roughness/specular stylization, normal/detail toggles | `EXPERIMENT` |
| Outlines | enable per object class, technique, width response, color/opacity | `EXPERIMENT` |
| Lighting | preset, light transforms/intensities/colors, ambient/fill, exposure/tone mapping | Contract `REQUIRED`; values `EXPERIMENT` |
| Shadows | player/ball modes, contact-shadow mode, softness/opacity, quality settings | Ball-ground cue `REQUIRED`; technique `EXPERIMENT` |
| Ball | visual scale policy, material/marking, contrast treatment, optional cue toggles | Baseline `REQUIRED`; VFX `DEFERRED` |
| Pitch | surface palette, low-frequency variation, marking treatment, optional wear/pattern | Constraints `REQUIRED`; look `PREFERRED/DEFERRED` |
| Environment | crowd/stand detail, motion, signage, environment contrast/saturation | Constraints `REQUIRED`; technique `DEFERRED` |
| Animation | blend profile, visual exaggeration, correction/IK limits, debug pose mode | Basic contract `REQUIRED`; advanced features `DEFERRED` |
| Camera | preset, projection/FOV/zoom, height/pitch, target/lead, smoothing/lag, transitions | `EXPERIMENT` |
| LOD | representation set, selection metric, thresholds, hysteresis/fade | `EXPERIMENT` |
| Post/VFX | bloom, vignette, fog, motion blur, depth of field, trails/glow/flash | `DEFERRED` |
| Debug | monochrome, flat/unlit, outline-only, shadow-only, LOD lock, color-vision preview, actor labels | Tooling `REQUIRED` for applicable tests |

Experimental parameters MUST support controlled on/off or A/B configurations over the same replay and exact capture ticks. A renderer default is provisional until it points to accepted experiment evidence.

## 19. Visual test scenes

Visual tests use versioned declarative scenarios shared with the browser test bridge. They MUST run through the deterministic `PresentationSession`: reset all temporal state, await the renderer-ready barrier, advance from controlled simulation snapshots, and capture a declared rational interpolation phase. A direct render at simulation tick `t` without session reset/readiness/advancement is invalid for repeatable evidence.

Every artifact records renderer/session versions, before/after presentation-state hashes, presentation seed, asset-ready receipt, capture coordinate, browser, viewport, device scale, camera, visual-config, presentation-match-config, asset, kit, lighting, and quality-tier provenance. Exact capture replay uses a compatible presentation checkpoint or reset plus deterministic reconstruction; animation, camera, LOD, particles, and temporal post-processing never use wall-clock history in test mode. Playwright is the selected capture path. [TECHNICAL_SPEC §§13.5, 15.3, and 19](./TECHNICAL_SPEC.md#135-deterministic-presentation-session)

| Scene ID | Required contents and variants | Primary questions | Artifacts |
|---|---|---|---|
| `VIS-BASE-001` | One player, one independent ball, pitch, goal; idle/run/turn/touch/pass/shot | Is state presented truthfully and is the basic hierarchy readable? | exact-tick stills, frame strips, short video, config manifest |
| `VIS-SIL-001` | Representative body archetypes and required action poses; multiple broadcast directions; near/gameplay/far; monochrome and lit | Which forms/orientations/actions survive silhouette and scale? | silhouette sheets and task images |
| `VIS-BODY-001` | Neutral physical archetypes versus role-coded variants, assignments blinded | Do position-coded shapes help or mislead? | randomized task set and response data |
| `VIS-KIT-001` | Two outfield teams, both goalkeepers, controlled indicators, official if present; normal and adversarial palettes/patterns; color-vision previews | Can users classify team/GK/official/controlled player, and does fallback work? | stills, clash diagnostics, task data |
| `VIS-BALL-001` | Ball stationary, rolling, bouncing, aerial, fast, near lines, in goalmouth, against kits, and partially occluded | How quickly and accurately is the ball acquired/tracked without motion-distorting VFX? | exact replay clips, acquisition/tracking data |
| `VIS-OVERLAP-001` | Two and several players contesting/shielding/tackling around the ball from opposing teams | Do silhouettes, depth, feet, ball, contact actor, and possession-independent ball remain legible? | frame strips around canonical contacts |
| `VIS-ACTION-001` | Matched canonical events for run, turn, brake, pass, shot, tackle, header, stumble, recovery | Are preparation, active/contact, direction, and recovery recognized at gameplay speed? | randomized clips and confusion matrix |
| `VIS-WIDE-001` | 22 active footballers plus ball in representative formation, transition, set-piece-like congestion, and goalmouth phases | Do team, ball, controlled player, broad actions, depth, and environment hierarchy survive full scale? | screenshots/video plus performance trace |
| `VIS-SHADE-001` | Same representative player/kit/ball under minimal stylized PBR, cel/hybrid candidates, outlines independently on/off | Which material/outline pipeline wins on readability, stability, authoring, and cost? | paired captures, task data, GPU/CPU trace |
| `VIS-LIGHT-001` | Accepted shader candidates under provisional day/night and difficult pitch orientations; shadow candidates | Are contrast, groundedness, contacts, and markings stable across the pitch? | stills/video, diagnostic masks, performance trace |
| `VIS-CAMERA-001` | Identical replay under fixed camera candidates varying FOV/zoom, height, pitch, target lead, lag, and smoothing | Which provisional preset best balances spatial awareness, perceived speed, ball/action readability, and comfort? | synchronized videos and task/preference data |
| `VIS-LOD-001` | Camera traversal and forced LOD locks across representative actors/actions/kit pairs | Are transitions stable, and which cues survive each representation? | traversal video, LOD-locked stills, cost/memory data |
| `VIS-ENV-001` | Minimal stadium and environment/crowd candidates over the same full-match replay | Does atmosphere add distraction, false ball targets, or team-color confusion? | salience/task captures and cost data |
| `VIS-PERF-001` | One representative rigged character family instantiated as 22 players, ball, pitch, camera, accepted candidate lighting/shadows/materials; controlled animation load | What budgets and quality fallbacks work on the target matrix? | p50/p95 frame cost, dropped frames, memory, load size/time, visual captures |

`VIS-PERF-001` targets exactly 22 active footballers plus one ball. Officials, substitutes, and crowd entities are separately counted and reported; they MUST NOT be hidden inside an accidental 44-player assumption.

## 20. Perceptual evaluation dimensions and targets

Image metrics are diagnostics until validated against human task performance. Pixel overlap, edge count, spatial-frequency estimates, and color-distance calculations MUST NOT become promotion gates merely because they are automatable. [RESEARCH_AUDIT F-36](../research/RESEARCH_AUDIT.md#f-36--visual-evaluation-proposals-are-not-yet-valid-metrics)

### 20.1 Task-based dimensions

| Dimension | Evaluation task | Desired target | Threshold status |
|---|---|---|---|
| Ball acquisition | Locate the ball after a randomized still/clip onset. | Minimize correct-acquisition time while preserving truthful size/trajectory. | Numeric target `TBD` |
| Ball tracking | Follow the ball through motion, height changes, overlap, and contact. | Minimize loss/reacquisition and trajectory/height misclassification. | `TBD` |
| Team classification | Identify each visible player's team in randomized frames/clips. | High accuracy across supported kit and color-vision conditions. | `TBD` |
| Goalkeeper/official classification | Distinguish goalkeeper and official from both outfield teams. | High accuracy without relying on labels. | `TBD` |
| Controlled-player localization | Locate the controlled player immediately after view onset or control switch. | Minimize correct-localization time independent of kit hue. | `TBD` |
| Facing/orientation | Classify broad body-facing direction. | Low angular-class confusion at gameplay distance. | `TBD` |
| Action recognition | Classify locomotion, turn/brake, pass, shot, tackle, header, stumble/recovery and phase where applicable. | High action/phase accuracy with low confusion at canonical timing. | `TBD` |
| Contact comprehension | Identify contact actor, approximate contact moment, and resulting ball direction from a short clip. | Low actor/timing/outcome error without renderer-created contacts. | `TBD` |
| Groundedness/depth | Judge whether ball/player is grounded or airborne and their relevant ordering/overlap. | Low height/depth-order error. | `TBD` |
| Individual recognition | Match a player across views using gameplay-distance cues. | Better than kit/position-only guessing where individuality is a product goal. | `TBD`; not an early hard gate |
| Silhouette stability | Recognize actor/action across angle, pose, monochrome, and LOD. | No material recognition drop at supported transitions/distances. | `TBD` |
| Temporal stability | Detect shimmer, popping, palette shifts, shadow jumps, or animation discontinuity. | Minimize reported artifacts and measured oscillation. | `TBD` |
| Environmental distraction | Complete ball/team/action tasks with environment candidates. | No material degradation versus the accepted minimal environment. | `TBD` |
| Visual comfort | Report discomfort from camera motion, flicker, contrast, or effects. | No unacceptable comfort/accessibility regression. | Policy `TBD` |

### 20.2 Study controls — `REQUIRED`

Every perceptual result used to decide a visual experiment MUST record:

- study/protocol version and hypothesis;
- participant count and relevant inclusion/exclusion criteria;
- display/viewport/device scale and viewing conditions to the extent controlled;
- browser, camera, quality tier, visual config, assets, lighting, kits, and color-vision transform;
- randomized stimulus order and identical underlying replays for A/B candidates;
- response accuracy, response time where relevant, uncertainty/confidence interval, and raw anonymized responses;
- predeclared decision rule and known confounds.

Thresholds MUST be derived from repeated baselines and deliberately degraded visual mutants before they gate promotion. Until then, results are comparative evidence and visual criteria return `NEEDS_PERCEPTUAL_REVIEW`, not an invented pass.

### 20.3 Diagnostic image dimensions

The renderer SHOULD expose captures for:

- luminance/value separation among ball, pitch, each kit region, goalkeeper, official, and indicator;
- supported color-vision previews;
- silhouette/edge masks at locked LODs;
- object-ID/depth/normal views for overlap diagnosis;
- spatial-frequency or texture-noise comparisons;
- shadow-only, unlit, outline-only, and effects-off views.

These help explain failures. They do not replace the task-based dimensions above until a versioned validation demonstrates predictive value.

## 21. Experiment register and decision gates

| Experiment ID | Open decision | Required comparison | Evidence required to resolve |
|---|---|---|---|
| `VEXP-SHADER-001` | Minimal stylized PBR vs cel bands vs hybrid NPR | `VIS-SHADE-001`, representative asset, identical lighting/replay | Task results, temporal review, authoring impact, and target-device p95 cost |
| `VEXP-OUTLINE-001` | Outlines off/on and technique | Player/ball independently across scale, overlap, LOD, and color cases | Readability gain without material contact/scale bias, instability, or unacceptable cost |
| `VEXP-ROLE-SHAPE-001` | Role-coded versus neutral physical archetypes | Blinded `VIS-BODY-001` | Useful recognition gain without capability/role misinformation; no simulation coupling |
| `VEXP-KIT-001` | Clash algorithm, accessibility fallback, and thresholds | Normal/adversarial dynamic matchups in `VIS-KIT-001` | Task performance across supported color-vision cases plus validated diagnostic relationship |
| `VEXP-BALL-BASE-001` | Whether baseline material + grounded shadow is sufficient | `VIS-BALL-001`, effects off | Ball acquisition/tracking and perceived-trajectory results under accepted camera/pitch/light candidates |
| `VEXP-BALL-VFX-001` | Optional outline/glow/trail/airborne cues | One effect at a time over accepted baseline | Meaningful task improvement without speed/height/curve/contact bias, clutter, comfort, or cost failure |
| `VEXP-LIGHT-001` | Lighting and shadow implementation | Accepted shader candidates across `VIS-LIGHT-001` and full scene | Readability/groundedness, stability, and target-device performance |
| `VEXP-CAMERA-001` | One provisional fixed gameplay preset | Fixed candidates over identical replay | Spatial, ball/action, perceived-speed, comfort, and preference results with full provenance |
| `VEXP-LOD-001` | Need, count, representations, and transitions | Locked/traversal `VIS-LOD-001` at accepted camera | Cue preservation, transition stability, memory/load, and p95 improvement |
| `VEXP-ENV-001` | Crowd/stadium representation | Minimal versus candidate environments | No material task degradation or false ball targets; justified atmosphere/performance tradeoff |
| `VEXP-ASSET-001` | Production geometry/texture/rig/material budgets | `VIS-PERF-001` on target matrix | Measured budgets and quality fallbacks meeting versioned performance/readability policy |
| `VEXP-ANIM-001` | Degree of animation exaggeration/correction | Matched canonical actions with candidate presentation profiles | Better action/contact comprehension without timing/outcome misreading |

An experiment is resolved only when its artifact manifest, raw measurements, analysis, and decision are versioned. The resulting rule must update this specification or a versioned visual profile; a default hidden in code is not a decision record.

All experiment captures inherit the §19 presentation-session contract. Paired candidates MUST begin from independent resets with the same presentation seed and capture coordinates; reuse of animation, camera, LOD, effect, or temporal-post state across candidates invalidates the pair.

## 22. Required visual constraints summary

The following are the minimum project-level gates now:

1. Renderer, animation, camera, LOD, assets, and effects cannot change canonical simulation outcomes.
2. Presentation is non-photorealistic, uses controlled palette/value, readable primary silhouettes, restrained texture noise, and original/licensed assets.
3. Ball has high-contrast baseline treatment and a grounded state-derived shadow/contact cue, with no physics-distorting VFX required.
4. Team kits are selected dynamically from metadata; team/GK/official separation and color-vision cases are considered; the controlled-player cue is independent of kit hue.
5. Fine detail is never the sole gameplay-readability channel.
6. Body shape and tactical role do not silently define one another or change simulation physics.
7. Pitch markings and gameplay geometry agree with the configurable authoritative pitch template; surface visuals do not change gameplay implicitly.
8. Stadium/environment remains subordinate and avoids ball-like distractors.
9. Animation truthfully presents simulation-owned actions and contacts with readable phase/pose progression.
10. Camera, visual config, kit, assets, lighting, quality tier, and viewport are versioned capture provenance.
11. LOD/fallbacks preserve identity, team, controlled-player, action silhouette, and ground placement without affecting authoritative state.
12. Visual claims are evaluated in exact repeatable test scenes; human task metrics precede unvalidated image proxies.

## 23. Preferred direction summary

Unless an experiment supports a deviation, the project should use:

- bold illustrative forms and a small stylized anatomy vocabulary;
- low-to-medium apparent geometric complexity concentrated on contour and articulation;
- broad color blocks, restrained surface detail, and simple stylized lighting;
- two or three dominant kit regions, broad patterns, and medium/large identity cues;
- a quiet, low-frequency pitch and a darker/desaturated simplified stadium;
- strong readable animation key poses with restrained exaggeration;
- a reusable modular player/kit/material/animation pipeline;
- details that progressively disappear with camera distance without changing primary cues.

## 24. Decisions that remain experimental

- exact shader family and cel-band/value-ramp implementation;
- whether outlines are used, on which objects, with what technique and distance response;
- role-coded body shapes versus neutral physical archetypes;
- dynamic kit-clash scoring, accessibility fallback, and numeric thresholds;
- provisional fixed gameplay camera values;
- lighting rig and shadow implementation;
- degree of animation exaggeration and visual contact correction;
- whether production LOD is needed, its representations, transitions, and thresholds;
- crowd/stadium representation candidate;
- representative asset and quality-tier budgets;
- perceptual thresholds and any image metric proposed as a proxy;
- optional ball readability effects after the baseline is stable.

## 25. Deferred decisions

The following MUST remain deferred until their prerequisites are met:

| Decision | Reconsider when |
|---|---|
| Production polygon, texture, rig, material, animation, shadow, and load budgets | Representative original asset, provisional camera, target browser/device matrix, and `VIS-PERF-001` results exist. |
| Final renderer choice or Babylon.js spike | The provisional Three.js adapter lacks a concrete required capability or comparative evidence justifies migration. |
| WebGPU | WebGL2 profiling shows a material GPU bottleneck and the support matrix permits adoption. |
| Renderer worker, OffscreenCanvas, SharedArrayBuffer, and cross-origin isolation | Representative profiling proves a bottleneck and deployment constraints are known. |
| Ball trails, glow, spotlight, afterimages, and contact effects | Base ball material/shadow, camera, lighting, and physics are stable and `VEXP-BALL-BASE-001` is complete. |
| Dynamic/replay/cinematic cameras | One provisional fixed gameplay camera is stable. |
| Motion matching, advanced foot locking/IK, ragdolls, and physics-driven animation | The baseline state machine/blend tree passes action/contact readability and profiling exposes a concrete need. |
| High-detail faces, likenesses, branded teams/kits/logos, and commercial visual identity | Product need, legal/data review, and gameplay-view priorities justify them. |
| Detailed/animated crowd, weather, volumetrics, depth of field, motion blur, heavy bloom, and cinematic post-processing | Gameplay readability and target-device budgets are established. |
| Final asset authoring toolchain and automated LOD/compression pipeline | Accepted renderer/material/LOD profiles and production budgets exist. |

## 26. Traceability

| Specification decision | Research basis |
|---|---|
| Non-photorealistic, limited-palette, silhouette-first direction | [Visual Direction §Overall and transferable principles](../research/06-visual-direction.md#transferable-mark-of-the-ninja-principles); narrowed by [AUDIT F-15](../research/RESEARCH_AUDIT.md#f-15--the-visual-document-both-locks-and-defers-the-shading-model) |
| Mark of the Ninja contributes principles, not copied presentation rules | [Visual Direction §Transferable principles and originality](../research/06-visual-direction.md#transferable-mark-of-the-ninja-principles) |
| Simulation-authoritative presentation and animation | [TECHNICAL_SPEC §13](./TECHNICAL_SPEC.md#13-simulation-to-presentation-boundary); [AUDIT F-19](../research/RESEARCH_AUDIT.md#f-19--animationcontact-authority-is-not-consistently-resolved) |
| Position-coded silhouettes remain experimental | [AUDIT F-34](../research/RESEARCH_AUDIT.md#f-34--visual-role-silhouettes-are-an-unsupported-gameplay-assumption) |
| Dynamic kits and independent controlled-player indicator | [AUDIT F-35](../research/RESEARCH_AUDIT.md#f-35--fixed-team-palettes-conflict-with-arbitrary-team-data); [TECHNICAL_SPEC §14.2](./TECHNICAL_SPEC.md#142-visual-baseline) |
| Shader, outlines, lighting/shadow details, LOD, and budgets require representative experiments | [AUDIT F-15–F-16](../research/RESEARCH_AUDIT.md#f-15--the-visual-document-both-locks-and-defers-the-shading-model); [AUDIT F-38](../research/RESEARCH_AUDIT.md#f-38--asset-lod-rig-and-shader-budgets-remain-tbd) |
| Ball baseline is high contrast plus grounded shadow; VFX deferred | [TECHNICAL_SPEC §13.4](./TECHNICAL_SPEC.md#134-camera-and-visual-cues); [AUDIT F-39](../research/RESEARCH_AUDIT.md#f-39--ball-visibility-effects-may-distort-the-behavior-being-evaluated) |
| Camera is an early experiment and required test condition | [AUDIT F-37](../research/RESEARCH_AUDIT.md#f-37--camera-behavior-is-a-major-unresolved-dependency) |
| Task-based visual evaluation precedes automated image gates | [AUDIT F-36](../research/RESEARCH_AUDIT.md#f-36--visual-evaluation-proposals-are-not-yet-valid-metrics) |
| 22 active players plus one ball in representative benchmark | [TECHNICAL_SPEC §8.1](./TECHNICAL_SPEC.md#81-world-root); [AUDIT F-17](../research/RESEARCH_AUDIT.md#f-17--player-count-assumptions-contain-an-error) |
| Provisional Three.js/WebGL2 adapter and browser capture path | [TECHNICAL_SPEC §14–15 and §21](./TECHNICAL_SPEC.md#14-renderer-integration); browser alternatives and profiling context in [Browser Architecture §Renderer and performance](../research/05-browser-architecture.md#renderer-recommendation) |

## 27. Resulting visual contract

The project is committed to a stylized, original, silhouette-first football presentation whose hierarchy is ball, teams, control, action, individuality, and then environment. It is not committed to a particular cel shader, outline, camera, LOD count, crowd technique, ball VFX package, or asset budget. Those choices are deliberately converted into reproducible renderer scenes and task-based experiments.

This separation lets primitive laboratory visuals evolve into production art without moving football authority into meshes, animation, shaders, or cameras—and without presenting unsettled visual hypotheses as research-backed requirements.
