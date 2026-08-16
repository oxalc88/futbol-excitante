# Gauntlet failure taxonomy

Failure classes are closed and defined in `gauntlet/evals/contracts/failures.ts`.

Use a stable class such as `premature_stop`, `horizon_invariant`, `reviewer_routing`, `mandatory_evidence_missing`, `state_transition`, `model_unavailable`, `rate_limited` or `quota_exhausted`.

Do not create labels from provider error messages or arbitrary exception classes. Use `unknown` when no registered classification matches, then review whether the taxonomy needs a deliberate versioned extension.

The raw provider error may exist in a local diagnostic artifact when necessary, but the durable incident/scenario contract should retain only bounded classifications and safe metadata.
