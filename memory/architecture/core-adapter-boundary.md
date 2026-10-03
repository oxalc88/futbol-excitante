---
schema_version: 1
topic_key: core-adapter-boundary
type: architecture
status: active
summary: Gameplay outcomes belong to the synchronous simulation core; presentation and input are adapters.
canonical_refs: ["AGENTS.md", "specs/TECHNICAL_SPEC.md"]
evidence: ["tests/unit/determinism/canonical.test.ts"]
supersedes: []
superseded_by: ""
source_digest: sha256:3498c73ceb09d306b1ca615ea46ffc40ddba01e4583c82b4b123c6ea4583f785
updated_at: 2026-10-03
---
The synchronous core remains DOM-free and deterministic. Input enters as tick-indexed InputFrame; rendering consumes immutable PresentationSnapshot. Inspect the canonical sources before implementing behavior.
