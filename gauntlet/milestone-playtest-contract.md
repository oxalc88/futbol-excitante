# Milestone playtest contract

## Goal

A capability test proves an isolated property. A gameplay situation proves that several capabilities compose into recognizable football behavior. A milestone playtest judges whether several applicable gameplay situations work together at the product stage represented by a normative milestone.

```text
capability test
  -> gameplay situation
  -> milestone playtest
  -> later full-match playtest
```

A milestone is never passed merely because player cardinality increased or because all objectives in a temporary horizon were accepted.

## Authoritative inputs

- `VISION.md`
- `specs/GAMEPLAY_EVALUATION_SPEC.md`
- `specs/TECHNICAL_SPEC.md`
- `specs/VISUAL_SPEC.md`
- `research/04-autonomous-evaluation.md`
- `research/06-visual-direction.md`
- `gauntlet/gameplay-situations.json`
- executable registries under `eval/contracts/`

The gameplay-situation registry must not invent PES constants, acceptance thresholds, or regulation milestones that the authoritative specs intentionally defer.

## Three evaluation layers

### Capability test

Answers whether an isolated property works under its executable scenario/oracle. State and telemetry are authoritative for simulation behavior.

### Gameplay situation

Combines capabilities around a recognizable football event or phase, for example:

```text
pass contact -> free ball -> receiver approach -> first touch -> continuation
```

or:

```text
possession loss -> immediate role change -> transition -> recovered shape
```

### Milestone playtest

Runs the situations required by that milestone and separates:

- deterministic facts;
- gameplay/perceptual judgment;
- visual/readability judgment;
- missing/deferred requirements.

The existing critic remains the qualitative judge. Deterministic scripts and cheap semantic auditors cannot produce the qualitative milestone ACCEPT by themselves.

## Evidence selection

Use the smallest evidence that actually demonstrates the claim:

- state/trajectory for physical and geometric facts;
- event logs for causal ordering;
- event-centered semantic frame sequences for temporal browser-visible behavior;
- video only when longer perceptual continuity adds value;
- metrics only when a protected target/policy exists.

Do not use elapsed time alone as evidence of gameplay. A frame at an arbitrary tick is weak evidence when the criterion is an event or transition.

If a criterion is both temporal and browser-visible, the strictest applicable objective evidence class is `DYNAMIC_VISUAL`, not `MULTI_TICK`.

For event-driven `DYNAMIC_VISUAL` evidence, `sequence.json` should center the frames on the event and consequence, e.g. `before -> event -> transition -> result`, with objective-appropriate labels allowed.

## Visual/readability applicability

Visual review is scoped by the gameplay present at the milestone. It uses the normative principles from `VISUAL_SPEC.md`:

- silhouette clarity;
- controlled palette/value;
- detail subordinated to primary form;
- gameplay readability.

It does not use “looks like Mark of the Ninja” as a criterion.

Typical applicability progresses from ball/facing/grounding in FOUNDATION, to action/contact/control readability in 1v1, to team classification/congestion/shape/camera readability in small-sided play, and eventually 22-player readability in the final product stage.

## Milestone verdict rules

A milestone playtest may report:

- `PASS` — all required executable facts/situations passed and required qualitative reviews accepted;
- `FAIL` — a required executable fact or reviewed situation failed;
- `NOT_EVALUATED` — required executable material is missing;
- `NEEDS_PERCEPTUAL_REVIEW` — an explicitly required perceptual gate remains unresolved.

Missing or deferred capabilities never count as PASS.

A temporary horizon completion is evidence of implementation progress, not a milestone verdict.

## Historical evidence

Gauntlet 0.9 does not backfill or rewrite accepted 0.8.x objective evidence. Older evidence remains historical. New milestone bundles may reference it while explicitly reporting what it does and does not demonstrate.
