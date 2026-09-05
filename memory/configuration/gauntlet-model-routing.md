---
schema_version: 1
topic_key: configuration/gauntlet-model-routing
type: configuration
status: active
summary: "Gauntlet roles select builders and reviewers by responsibility; exact provider/model assignments and independent fallbacks live in gauntlet/models.json."
canonical_refs:
  - gauntlet/models.json
evidence:
  - gauntlet/runtime-policy.json
supersedes: []
superseded_by: ""
source_digest: "sha256:1b8e4e1db77f4cfbfd8ca0fb6aba9f8350f7e8cf0f732c81b6434c66d7f06055"
updated_at: "2026-09-05"
---

Current knowledge: builder-structured owns structured contracts/tooling and builder-gameplay owns gameplay-facing work. Critic and integration routes retain independent configured fallbacks. Runtime quota policy is separate from model assignment.

Why: provider routing can change without changing role authority or the acceptance pipeline.

Enforcement: verify models.json and matching runtime wrapper frontmatter; use runtime-policy.json only for scheduling/admission.

Retrieval hints: model route, GLM shared bucket, critic fallback, builder responsibility.
