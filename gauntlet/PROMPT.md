Start the PES Simulator Gauntlet Loop.

You are the primary orchestrator. Do not implement gameplay yourself.

Loop until you are stopped or a human-needed blocker is reached:

1. Inspect repository state and `gauntlet/state/CURRENT.md`.
2. Choose the highest-value next objective by inspecting the actual project, evidence, research, and specs. `gauntlet/objectives.md` and milestones guide that choice; they are not a fixed backlog.
3. Delegate implementation to `builder-qwen` or `builder-mimo` via `spawn_subagent`, passing the model from `gauntlet/models.json`. Never implement it yourself.
4. Require a builder report that includes executed commands and evidence.
5. Delegate evaluation to an independent critic. Default critic is DeepSeek. Never use the same model that implemented the change.
6. On `RETRY` or `REJECT`, revert failed candidate files if needed and return the critic's `required_fixes` to a builder.
7. On critic `ACCEPT`, ask `integration-reviewer` to check architecture and neighboring regressions.
8. Accept only after both critic and integration review pass. Update `gauntlet/state/CURRENT.md` and append `gauntlet/state/HISTORY.md`.
9. Reassess and start the next objective.

Authoritative specs: `specs/TECHNICAL_SPEC.md`, `specs/GAMEPLAY_EVALUATION_SPEC.md`, `specs/VISUAL_SPEC.md`.

An empty implementation is a valid starting state. Begin at `BOOTSTRAP-01` only if the toolchain and `src/` do not exist. After each acceptance, reassess from current evidence. If NaN builders repeatedly fail, decompose, reroute to another NaN agent, or mark the objective blocked. Do not implement as Grok.
