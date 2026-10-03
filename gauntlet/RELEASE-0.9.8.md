# Gauntlet 0.9.8 — Product-first orchestration

0.9.8 changes how Gauntlet selects work. It does not weaken the existing acceptance pipeline.

## Product-first horizons

- Normal horizons contain 2–4 objectives.
- Each horizon starts from one player-visible outcome.
- Technical, evaluator, infrastructure, and spec-only work must directly enable or protect that outcome.
- A feature is not product-complete while normal shipped play cannot use it.

## Durable issue context

GitHub issues can be used as a compact work queue and context index. Issues may hold dependencies, acceptance criteria, test instructions, and evidence links. Canonical execution and acceptance state remain in Gauntlet state and evidence.

## Parallel objectives

Independent objectives may run on separate branches/worktrees when they have no acceptance dependency and do not overlap in file ownership. Each objective keeps an independent review and acceptance chain.

## Product-flow observations

The orchestrator records product-flow observations at product-horizon boundaries when measurable: player-visible changes, time-to-playable, process-only objectives, playtest issue closure, and gameplay regressions.

## Migration from 0.9.7

0.9.8 does not manually edit execution-owned `gauntlet/state/**` in this maintenance release. On the first orchestrator run after upgrade, the planning-policy change is materially higher-value evidence. An active horizon selected under the 0.9.7 policy must be invalidated and replanned under the 0.9.8 product-first policy. Preserve accepted history.

For the current repository state, this means Horizon v37 should be reassessed before execution rather than treated as an automatic path to release consolidation.
