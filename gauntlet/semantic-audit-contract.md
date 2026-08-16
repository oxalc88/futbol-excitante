# Cheap semantic audit contract

Invoke this only when `pnpm run gauntlet:audit` returns `REVIEW_REQUIRED`.

Use `aux` (`gemma4`, fallback `qwen3.6`) with only the bounded finding, objective acceptance criterion, relevant artifact metadata, and the minimum previous-artifact context needed to decide the ambiguity. Do not ask it to re-review the whole objective or compare gameplay quality against the reference bar.

The response must be one JSON object:

```json
{
  "verdict": "VALID|INVALID|INSUFFICIENT_CONTEXT",
  "finding": "EVIDENCE_DUPLICATE_SHA",
  "reason": "short evidence-grounded reason"
}
```

- `VALID`: the bounded concern is cleared; continue to the mandatory critic.
- `INVALID`: repair/capture new evidence and rerun the deterministic audit.
- `INSUFFICIENT_CONTEXT`: collect the missing bounded context; it is not an acceptance verdict.

This auditor can never produce objective `ACCEPT`.
