---
schema_version: 1
topic_key: patterns/fresh-objective-continuation
type: pattern
status: active
summary: "Fresh Gauntlet sessions reconstruct an objective from canonical state, a bounded context packet, an optional builder checkpoint, selected memory, and persisted evidence."
canonical_refs:
  - gauntlet/PROMPT.md
  - gauntlet/runtime-efficiency-contract.md
  - gauntlet/memory-context-contract.md
evidence:
  - .grok/skills/gcont/SKILL.md
supersedes: []
superseded_by: ""
source_digest: "sha256:10c7dfd82d0e0d6e0fdf3a4633c0e967dc32243ee24afa4af8f5ecd42ced7491"
updated_at: "2026-09-05"
---

Current knowledge: a context packet navigates the current objective, while a builder checkpoint carries compact implementation-phase state. Selected project-memory topics locate stable knowledge. Canonical state and evidence still prove the current facts.

Why: safe phase rotation avoids repeatedly resending a very large prior conversation during materially different validation work.

Enforcement: the objective ID and source digests must match; reviewers independently inspect canonical references and evidence.

Retrieval hints: continuation, builder rotation, phase boundary, checkpoint, context packet.
