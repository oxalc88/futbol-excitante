# Gauntlet project memory and objective context contract

Project memory, objective context packets, and builder checkpoints are three separate aids. None can choose product architecture, alter requirements, accept/reject an objective, replace evidence, or override canonical sources.

## Project memory

`memory/` holds concise, reusable knowledge about stable architecture, decisions, patterns, discoveries, bug fixes, and configuration. Memory locates and explains knowledge; the authority order in `AGENTS.md`, current specifications/contracts, executable code/tests, and accepted evidence prove what is current.

Retrieval is progressive:

```text
objective keywords
→ memory:search (maximum five previews)
→ select maximum three topics
→ read selected topics
→ verify canonical_refs when the claim matters
```

Agents never preload the directory. A digest change marks an active topic invalid for review; it never rewrites the knowledge automatically. `memory:check` validates schema/lifecycle, uniqueness, size, paths, digests, supersession, active-topic duplication, prohibited history/log material, credentials, and authority claims.

## Objective context packet

`.delivery-local/context/<objective-id>.json` is an ignored, disposable navigation packet targeting roughly 1,000–1,500 tokens and capped at 1,500. Its digest covers only its selected files, canonical references, and tests. A change to one of those inputs invalidates it; an unrelated repository change does not.

The packet is not authoritative and is not acceptance evidence. Reviewers use it to navigate and independently verify canonical sources. It contains summaries and paths, never copied source/spec/test bodies. Fresh continuation reconstructs from canonical Gauntlet state, the current objective, this packet, an optional checkpoint, bounded memory, and persisted evidence/reviewer state—never from an old conversation.

## Bounded context mapper

For a complex objective, a read-only repository view may perform at most four searches and select/read at most twelve relevant files before it must re-plan. It may read bounded memory previews/topics, canonical files, implementation, tests and dependency locations, then return only a context packet plus mapping metrics. Its interface has no product write or acceptance operation. The caller may write the returned packet only under `.delivery-local/context/`.

When no search is needed and at most three obvious files cover the task, bypass the mapper. Mapping is overhead and must be measured, not invoked ceremonially.

## Builder checkpoint

`.delivery-local/checkpoints/<objective-id>.json` stores compact operational continuation state: phase, changed files, implemented behavior, commands and exit codes, residual failures, evidence paths, next action, relevant files, and a source digest. It is capped at 1,000 estimated tokens.

It excludes conversations, hidden reasoning, raw tool output, large logs, and temporary speculation. A fresh builder seed must match the objective IDs and explicitly records that the previous transcript was not included.
