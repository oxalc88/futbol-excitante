# PES Simulator — agent rules

This repository is a browser-playable, headless football simulation engine. Gameplay is authoritative. Rendering, data sources, and agent orchestration are adapters.

## Authoritative documents

Use these in this order. Do not invent a competing architecture.

1. `specs/TECHNICAL_SPEC.md`
2. `specs/GAMEPLAY_EVALUATION_SPEC.md`
3. `specs/VISUAL_SPEC.md`
4. `BOOTSTRAP_PLAN.md` as bootstrap guidance, not a forced backlog
5. `VISION.md` and `research/` as background. If research documents conflict, `research/RESEARCH_AUDIT.md` governs.

The Gauntlet loop lives in `gauntlet/`. Launch and model routing are documented in `gauntlet/README.md`. Project agents are in `.grok/agents/`.

## Hard boundaries

- Simulation core is synchronous, DOM-free, and pinned-runtime deterministic.
- The core must not read the wall clock, DOM, devices, network, filesystem, or renderer internals.
- The ball is an independent 3D entity. Never parent it to a player, teleport it between controllers, or treat possession as physical attachment.
- Input is tick-indexed `InputFrame`. Devices, AI, replay, and tests all enter through that contract.
- Renderer consumes immutable `PresentationSnapshot` only. Visuals must not change football outcomes.
- Unmeasured PES 2017 values stay versioned provisional configuration. Never hard-code a guessed PES constant as truth.
- Do not claim `FOUNDATION_LAB_PASS`, PES fidelity, or a regression `PASS` unless the executable evaluator registries and policies actually exist and pass.
- Missing reference targets are `BLOCKED_MISSING_REFERENCE`. Do not invent envelopes or tolerances to make a test pass.
- Catalog prose is not executable. `PASS`/`FAIL` requires versioned bindings, schemas, and protected oracles.
- Goalkeepers, regulation rules, and full-match ecology stay deferred until their dedicated specs and suites exist.
- External provider ratings must not become gameplay values.

## Prioritization

The repo may start empty. `BOOTSTRAP-01` is the initial objective only while there is no toolchain or `src/`. After each accepted objective, inspect the actual project, evidence, research, and specs, then pick the highest-value next gap. Milestones in `gauntlet/objectives.md` guide that choice; they do not force a predetermined order.

Do not skip the architecture boundaries to jump to 11v11, tactics, polished art, networking, Rapier, workers, WASM, or WebGPU.

## Tooling

- Manage tool versions with mise. Do not install Node or pnpm outside `mise.toml`.
- After the toolchain exists, use `mise run ...` as the canonical entry.
- Fast evidence is better than prose: run the tests named by the current bootstrap step or suite.

## Gauntlet roles

- `orchestrator` (Grok 4.6) decides and delegates. It does not implement.
- `builder-qwen` / `builder-mimo` implement one isolated objective and produce evidence.
- `critic` (DeepSeek by default) judges evidence independently. Never review with the same model that implemented the change.
- `integration-reviewer` checks architecture and neighboring regressions after acceptance.
- `aux` does cheap summaries and inspection only.
- `git-committer` (`gemma4`) makes atomic commits. Grok must not `git commit`.
