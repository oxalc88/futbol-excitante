# Gauntlet evaluation charter

Adapted from the instrumentation charter pattern in `aws-observability-instrumentation`.

## Invariants

1. Define orchestration events and failure classes once in a closed registry.
2. Keep gameplay evaluation under `eval/`; keep orchestration evaluation under `gauntlet/evals/`.
3. Prefer deterministic checks when state or trajectory can answer the question without an LLM.
4. Emit or record terminal events at the lifecycle boundary that knows the final outcome.
5. Use stable correlation fields (`run_id`, `horizon_id`, `objective_id`, `attempt_id`) instead of encoding identifiers in event names.
6. Do not persist complete prompts, hidden reasoning, arbitrary tool results, credentials or unbounded provider errors in operational incident records.
7. Every real orchestration bug should become a compact regression scenario.
8. A prompt/model change must not remove a previously passing invariant without an explicit versioned contract change.
9. A session may stop only for a declared stop reason.
10. When a deterministic evaluator can decide PASS/FAIL, an LLM judge is unnecessary.
