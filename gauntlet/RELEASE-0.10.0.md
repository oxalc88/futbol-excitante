# Gauntlet 0.10.0 — runtime telemetry and measured efficiency

Canonical base: main / 0.9.9. First implementation commit connects OMP runtime telemetry; all efficiency capabilities start disabled.

- Measure real parent/child provider events and exact role/model/objective usage, including cached input, retries/rate limits, wait-only calls, context, runtime handoff sizes and time through remote-verified acceptance. Report processed input tokens per accepted objective only with measured usage and attribution.
- Add opt-in validated project memory, bounded context packets/read-only mapper, digest-bound builder checkpoints, fresh OMP builder tasks at safe phase boundaries and one-result verification batches.
- Require a complete measured baseline before enabling capabilities. This release ships instrumentation, not a fabricated live-provider baseline or a claimed token saving.
- Omit the historical TPM governor, shared backoff and wait controller because OMP owns native admission, retries and settlement. Preserve current model routing and issue-gated parallel execution.
- Preserve product-first planning, independent critic/integration review, evidence/provenance, serialized acceptance/state audit and remote durability. Do not rewrite live Gauntlet state or import historical releases/routing.

Source history is selectively adapted from 66be461; audit evidence from 1a45539 is historical. See `runtime-efficiency-contract.md` for rollout, limitations and measurement procedure.
