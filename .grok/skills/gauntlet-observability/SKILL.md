---
name: gauntlet-observability
description: Apply the repository-local Gauntlet observability/evaluation contract when adding orchestration events, incidents, traces, failure classes, runtime evals or CI enforcement.
user-invocable: false
disable-model-invocation: false
model: gemma4
---

Read these local references before changing Gauntlet evaluation or observability behavior:

- `gauntlet/evals/references/charter.md`
- `gauntlet/evals/references/failure-taxonomy.md`
- `gauntlet/evals/references/naming-and-lifecycle.md`
- `gauntlet/evals/references/enforcement.md`
- `gauntlet/evals/references/ai-agent-tracing.md`

Principles adapted from `oxalc88/aws-observability-instrumentation`:

1. Closed contracts and bounded classifications beat free-form labels.
2. One lifecycle boundary owns a terminal event.
3. Correlate with stable IDs; do not encode identifiers into event names.
4. Static gates catch obvious contract bypasses; executable scenarios prove behavior.
5. Prefer deterministic evaluation; use model judges only when deterministic state/trajectory checks cannot answer the question.
6. Do not persist prompt content, hidden reasoning, credentials or arbitrary tool payloads in operational traces.
7. Turn confirmed real incidents into permanent regression scenarios.
