# Project memory

Persist compact knowledge with links to canonical files; no runtime state or conversations. Memory is non-authoritative. Use directories `architecture`, `decisions`, `patterns`, `discoveries`, `bugfixes`, or `configuration`. One Markdown topic per stable `topic_key` has this frontmatter:

```yaml
schema_version: 1
topic_key: core-adapter-boundary
type: architecture
status: active
summary: Simulation outcomes belong to the synchronous core.
canonical_refs: ["AGENTS.md", "specs/TECHNICAL_SPEC.md"]
evidence: ["tests/unit/determinism/canonical.test.ts"]
supersedes: []
superseded_by: ""
source_digest: sha256:<digest of sorted path + NUL + bytes + NUL>
updated_at: YYYY-MM-DD
```

Types: architecture, decision, pattern, discovery, bugfix, configuration. Statuses: proposed, active, needs_review, superseded. Active topics require evidence. A changed source digest excludes a topic until reviewed. Bound summary to 600 characters, body to 4,000; do not store credentials, provider limits as facts, reasoning, full logs or conversation history. `mise run gauntlet-memory-validate` validates this store. Search and retrieval remain disabled until runtime efficiency is explicitly enabled after a measured baseline.
