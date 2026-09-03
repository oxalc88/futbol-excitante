# Gauntlet 0.9.6

Patch release over 0.9.5 correcting continuation routing and stale agent-role instructions.

## Equivalent orchestrator continuation

- keeps `/gauntlet`, `/gauntlet-continue`, and `/gcont` as continuation-capable entry points over the same persisted Gauntlet work;
- the entry point selects the parent orchestrator model: Grok 4.6, DeepSeek Flash, or GLM 5.3 Flash;
- makes `orchestrator-deepseek` and `orchestrator-glm` use the same pickup/resume wrapper semantics apart from model identity;
- moves `/gcont` to a user-invocable skill, matching the invocation model already used by `/gauntlet` and `/gauntlet-continue`;
- all three entry points accept optional trailing focus text without bypassing horizon, prerequisite, evidence, review, acceptance, or publication rules;
- keeps `gauntlet/state/HANDOFF.md` execution-owned and does not rewrite historical/runtime handoff state in this maintenance release.

## Routing instructions

- synchronizes `AGENTS.md` with `gauntlet-models-v7` routing;
- removes hard-coded reviewer model IDs from `gauntlet/PROMPT.md` so critic and integration-reviewer routing is resolved from `gauntlet/models.json`;
- records both DeepSeek and GLM as continuation orchestrators rather than giving them different workflow semantics;
- keeps timing/model statistics separated by exact model ID and role so equivalent orchestration can be compared across parent models.

No gameplay behavior changes. No manual edits to `gauntlet/state/**`.
