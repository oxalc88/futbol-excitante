# Gauntlet 0.9.9 — Issue-gated parallel execution

0.9.9 makes parallel implementation mechanically controlled.

## Sequential work

GitHub Issues remain optional when only one implementation objective runs.

## Parallel work

Before parallel implementation:

1. create a parallel plan;
2. synchronize one GitHub issue per candidate objective;
3. resolve dependencies;
4. check expected file ownership;
5. classify each issue as `READY` or `BLOCKED`;
6. start only synchronized `READY` objectives.

If GitHub write capability is unavailable, Gauntlet runs the objectives sequentially.

## OMP enforcement

The OMP adapter now:

- limits implementation fan-out to five workers;
- limits NaN provider requests to six in flight;
- limits task recursion depth to one;
- uses isolated workspaces for parallel builders;
- disables asynchronous background task fan-out;
- blocks invalid parallel builder batches with a project `tool_call` hook.

The NaN base plan allows seven simultaneous requests per API key. The project keeps one request of headroom.

## OMP reviewer independence

OMP uses:

- orchestrator: `glm5.3-flash`;
- structured builder: `deepseek-v4-flash`;
- gameplay builder: `qwen3.8-flash`;
- critic: `mimo-v2.6-flash`;
- critic fallback: `glm5.3-flash`;
- integration reviewer: `glm5.3-flash`;
- integration fallback: `mimo-v2.6-flash`.

This keeps the critic model different from both current builder models.

## Completion

Issue state does not accept an objective.

Only after the canonical Gauntlet acceptance is persisted and remotely durable can the issue move to `ACCEPTED` and close.

## Compatibility

The canonical Gauntlet policy remains harness-neutral. Grok and OpenCode can implement the same issue admission contract with their own runtime adapters.
