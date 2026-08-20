# Gauntlet 0.9.4

Patch release over 0.9.3 focused on current-model routing and timing-bookkeeping consistency.

## Model routing

- removes deprecated `deepseek-v4-flash-0731` routing;
- `deepseek-v4-flash` is now the only DeepSeek Flash route used by the Gauntlet;
- removes duplicate `critic-flash` and `integration-reviewer-flash` wrappers;
- keeps independent Qwen/MiMo critic fallbacks and adds explicit Qwen/MiMo integration-reviewer fallbacks;
- classifies unsupported modality failures such as `No endpoints found that support image input.` as `MODEL_CAPABILITY_MISMATCH`;
- preserves the exact objective/review step on capability mismatch and only reroutes to an explicitly compatible route.

## Timing durability

- adds `clock_aggregates_through` to the timing bookkeeping contract;
- state audit now rejects advanced tracking markers when global Clock/session aggregates have not been refreshed through the latest accepted objective;
- stale aggregates are orchestrator-owned bookkeeping repair, not gameplay regression.

## Regression coverage

- current DeepSeek Flash reviewer fallback;
- unsupported image-input capability mismatch;
- stale global timing aggregates despite otherwise-current tracking markers.

No gameplay behavior changes. No manual edits to `gauntlet/state/**`.
