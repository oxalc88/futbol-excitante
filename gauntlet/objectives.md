# Gauntlet objective catalog

This is prioritization guidance, not a fixed implementation backlog.

After each accepted objective the orchestrator must inspect the actual repository, evidence, research, and specs, then choose the highest-value next gap. Milestone names may inform that choice. They must not force a predetermined order when evidence says another objective is more important.

`BOOTSTRAP-01` is the valid initial objective only while the repository has no pinned toolchain or `src/`.

Record the chosen objective and why in `gauntlet/state/CURRENT.md`. Do not rewrite this catalog just to change order.

## Candidate objectives — bootstrap

Source: `BOOTSTRAP_PLAN.md`. Dependencies below are capability prerequisites, not a script.

| ID | Objective | Builder preference | Typical prerequisite |
|---|---|---|---|
| `BOOTSTRAP-01` | Pin mise/Node/pnpm and create the executable TypeScript skeleton | Qwen | empty repo / no toolchain |
| `BOOTSTRAP-02` | Portable contracts and versioned foundation config | Qwen | installable TypeScript skeleton |
| `BOOTSTRAP-03` | Deterministic PRNG, canonical encoding, hash, finite checks | Qwen | contracts exist |
| `BOOTSTRAP-04` | World/scenario startup for one player and one ball | Qwen | determinism primitives exist |
| `BOOTSTRAP-05` | Synchronous fixed-step `Simulation` API | Qwen | world startup exists |
| `BOOTSTRAP-06` | Normalized input and one stable control slot | Qwen | simulation API exists |
| `BOOTSTRAP-07` | One-player kinematic locomotion | MiMo preferred, Qwen acceptable | input exists |
| `BOOTSTRAP-08` | Primitive independent 3D ball | MiMo preferred, Qwen acceptable | simulation API exists |
| `BOOTSTRAP-09` | Checkpoints, input recording, replay verification | Qwen | locomotion and ball exist if those are the replay subjects |
| `BOOTSTRAP-10` | Telemetry, bootstrap invariants, metrics, headless runner | Qwen | replay/checkpoints exist |
| `BOOTSTRAP-11` | Primitive browser composition and Three.js renderer | MiMo preferred for presentation, Qwen for test bridge | headless runner exists |
| `BOOTSTRAP-12` | Automated `mise` tasks, README, `test-all` gate | Qwen | browser composition exists |

Parallel builders remain allowed only when file sets do not overlap. `BOOTSTRAP-07` and `BOOTSTRAP-08` are the usual isolatable pair once input exists.

## Candidate objectives — foundation laboratory

Source: `specs/GAMEPLAY_EVALUATION_SPEC.md` milestone `FOUNDATION_LAB`.

Do not call this `FOUNDATION_LAB_PASS` until required hard invariants pass on both required execution paths.

| ID | Objective | Builder preference | Typical prerequisite |
|---|---|---|---|
| `FOUNDATION-REGISTRIES` | Materialize `eval/contracts` registries and bindings for `fast`, `locomotion`, `ball` | Qwen | enough core exists to bind |
| `FOUNDATION-ORACLES` | Protected evaluator oracles and core mutant/canary suite | Qwen | registries exist |
| `FOUNDATION-BROWSER` | Required browser cases `BROWSER-CORE-RESET-001` and `BROWSER-CORE-STEP-001` | Qwen | browser composition exists |
| `FOUNDATION-HARD` | Required `HARD_INVARIANT` criteria for the foundation suites | same builder as the failing family | registries, oracles, and browser smoke exist |

## Later milestone guidance

These are product milestones, not an automatic next-item list.

| ID | Milestone | Notes |
|---|---|---|
| `PLAYABLE-1V1` | First touch, basic actions, duels, local control slots, fictional archetypes | Requires `ENGINE_DESIGN_TARGET` profile. Still no PES claim. |
| `SMALL-SIDED` | Team tactics, transition phases, small-sided cardinality | Requires a team decision profile. |
| `REGULATION` | Not a current objective | Needs dedicated goalkeeper and rules specs first. |

## Never-objectives

These are not valid next improvements:

- inventing PES envelopes or provider-rating mappings
- treating `BLOCKED_MISSING_REFERENCE` as a builder bug
- 11v11, networking, Rapier, ECS, workers, WASM, WebGPU
- copying PES or other commercial assets
- making the renderer own contact, rules, or locomotion
- rewriting Gauntlet agents to weaken critic independence
- assigning implementation to Grok
