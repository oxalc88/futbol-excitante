---
schema_version: 1
topic_key: architecture/core-adapter-boundary
type: architecture
status: active
summary: "Simulation outcomes stay in the synchronous deterministic core; devices, AI, rendering, and orchestration remain adapters around explicit contracts."
canonical_refs:
  - specs/TECHNICAL_SPEC.md
evidence:
  - src/contracts/index.ts
supersedes: []
superseded_by: ""
source_digest: "sha256:48c1169d97ce55c995a65b1e6197959c22f20717c32d03cf1e82e37e31544f9b"
updated_at: "2026-09-05"
---

Current knowledge: the simulation core is synchronous and isolated from DOM, devices, network, filesystem, and renderer state. Input enters through tick-indexed contracts and presentation leaves through immutable snapshots.

Why: deterministic gameplay remains testable and rendering cannot change football outcomes.

Enforcement: start with the technical specification, then inspect contract exports and the relevant implementation/tests.

Retrieval hints: dependency direction, deterministic core, InputFrame, PresentationSnapshot, ball independence.
