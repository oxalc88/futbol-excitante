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

The repo may start empty. `BOOTSTRAP-01` is the initial objective only while there is no toolchain or `src/`.

Strategic prioritization uses the temporary rolling horizon in `gauntlet/state/HORIZON.md`. At startup, handoff, horizon exhaustion, or material invalidation, inspect actual project state, evidence, research, specs, and `gauntlet/objectives.md`, then select roughly 4–8 candidate objectives. The horizon is not a fixed backlog.

Every horizon must have unique objective IDs, coherent prerequisites, and a zero-based `current_index` pointing to the next applicable non-accepted objective. Already accepted objectives must not reappear as pending. Acceptance updates the existing entry in place; validate candidate horizon/current state before persisting. Repair ordinary bookkeeping errors without another agent, historical rewrites, or global replanning.

After an accepted objective, continue the next applicable horizon objective without a global reprioritization pass unless the horizon is invalidated by a blocker, architectural constraint, dependency change, inapplicable planned objective, unsafe newly discovered defect, materially higher-value evidence, or a human-needed spec/legal blocker.

Where technically reasonable, each horizon should lead toward at least one observable playable/browser-facing capability. Infrastructure-only horizons must justify why that work must precede visible gameplay progress.

Do not skip the architecture boundaries to jump to 11v11, tactics, polished art, networking, Rapier, workers, WASM, or WebGPU.

## Tooling

- Manage tool versions with mise. Do not install Node or pnpm outside `mise.toml`.
- After the toolchain exists, use `mise run ...` as the canonical entry.
- Fast evidence is better than prose: run the tests named by the current bootstrap step or suite.

## Gauntlet roles

- `orchestrator` (Grok 4.6) plans/replans the rolling horizon at strategic boundaries, then decides and delegates inside it. It does not implement. At ≥89% SuperGrok weekly usage (`/usage`) it writes `gauntlet/state/HANDOFF.md` and hands off to `orchestrator-deepseek`.
- `orchestrator-deepseek` uses the configured DeepSeek overflow model. Same loop. It picks up from `HANDOFF.md` + `CURRENT.md` + `HORIZON.md`. It does not implement.
- `builder-qwen` / `builder-mimo` implement one isolated objective and produce evidence.
- `critic` (DeepSeek by default) judges evidence independently and cannot accept until mandatory evidence exists. Never review with the same model that implemented the change.
- `integration-reviewer` independently verifies mandatory evidence, audits the critic evidence gate, and checks architecture and neighboring regressions. Critic ACCEPT alone is never final.
- The orchestrator records acceptance only after critic ACCEPT, integration ACCEPT, and its own verification of every mandatory artifact. Tests do not replace required perceptual evidence.
- `aux` does cheap summaries and inspection only.
- `git-committer` (`gemma4`) makes atomic commits. Grok must not `git commit`.
