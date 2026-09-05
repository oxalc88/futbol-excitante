# Project memory

This directory is a bounded navigation aid for stable project knowledge. It is not an authority, acceptance record, task tracker, transcript store, or replacement for current repository sources. The precedence in `AGENTS.md` and the canonical specifications remains unchanged.

## Retrieval

Never preload this directory. Start with a bounded preview search:

```bash
mise run memory:search -- "settled ball"
```

The command returns at most five previews. Select no more than three relevant topics initially, then verify their `canonical_refs` whenever a claim affects implementation or review. Expand only when the first bounded set is insufficient.

## Topic format

Topics live in `architecture/`, `decisions/`, `patterns/`, `discoveries/`, `bugfixes/`, or `configuration/`. One Markdown file represents one stable topic. Required frontmatter:

```yaml
---
schema_version: 1
topic_key: gameplay/example
type: pattern
status: active
summary: "A concise locator and explanation."
canonical_refs:
  - specs/TECHNICAL_SPEC.md
evidence:
  - src/example.ts
supersedes: []
superseded_by: ""
source_digest: "sha256:<digest of canonical_refs>"
updated_at: "2026-09-05"
---
```

Lifecycle states are `proposed`, `active`, `needs_review`, and `superseded`. A canonical-source digest mismatch invalidates an active topic and requires a human/agent review; validation never rewrites the topic automatically. A superseded topic identifies its replacement topic key in `superseded_by`; an active replacement lists prior keys in `supersedes`.

The body says what is known, why it exists, where it is enforced, retrieval hints, and supersession details. Keep it concise. Do not store temporary progress, copied specifications, session histories, model reasoning, tool dumps, credentials, provider logs, or acceptance claims here.

Validate all topics with:

```bash
mise run memory:check
```
