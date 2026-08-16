# Naming and lifecycle

Use lowercase dot-separated event names such as `objective.accepted`, `horizon.advanced` and `orchestrator.stopped`.

Treat the event name, purpose, required fields and field meanings as immutable within contract v1. If meaning changes incompatibly, create a v2 contract rather than silently reusing the same field with a different meaning.

Identifiers are fields, not event-name suffixes. Prefer `objective_id: BROWSER-GOAL-EFFECT` instead of an event name such as `objective.BROWSER-GOAL-EFFECT.accepted`.
