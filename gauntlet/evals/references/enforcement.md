# Enforcement

Use two inexpensive layers before model-driven evaluation.

## Static gate

The prompt gate checks that critical orchestration surfaces still reference required review, evidence, fallback and continuation semantics. It is intentionally simple and should not pretend to understand arbitrary prose.

## Deterministic scenarios

Regression scenarios encode known failures and expected decisions. They run without model/API calls and should be the default CI signal.

## Runtime/model evaluation

Use the real model only when the behavior being tested depends on model interpretation. Prefer code-based trajectory/state assertions over an LLM judge. A cheap independent judge may classify ambiguous outcomes; strategic-quality judgments may require a stronger model or human review.
