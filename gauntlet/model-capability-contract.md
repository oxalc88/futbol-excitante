# Model capability routing contract

Model availability and model capability are separate facts. A provider route can be healthy for text inference while rejecting a request that includes an unsupported modality.

## Observed failure class

The observed NaN failure text is:

```text
No endpoints found that support image input.
```

Treat this as `MODEL_CAPABILITY_MISMATCH`, not as gameplay/test failure and not as a valid reviewer verdict.

## Routing rule

Before sending image input to a reviewer, the route must be explicitly known to support image input. Unknown capability is not permission to assume support.

On `MODEL_CAPABILITY_MISMATCH`:

1. preserve the same objective and exact pipeline step;
2. do not rerun the builder, critic, or prior successful work merely because the route rejected the modality;
3. if an explicitly compatible independent fallback route exists, reroute that same review step;
4. if no compatible route is configured, preserve the review as pending and surface a human-needed perceptual-review blocker rather than fabricating a visual verdict;
5. never convert the capability error into ACCEPT/RETRY/REJECT.

Current DeepSeek Flash routes are explicitly text-only for image attachment purposes because image input was observed to fail on the active endpoint. Other NaN routes remain capability-unknown unless the runtime/provider configuration explicitly proves image support.

This classification is independent from `model_unavailable`, `rate_limited`, `quota_exhausted`, authentication, and ordinary task failures.
