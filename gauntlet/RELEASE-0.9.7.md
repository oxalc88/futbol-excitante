# Gauntlet 0.9.7

Focused efficiency, continuation, and bounded project-context release over 0.9.6. It does not change gameplay, model assignments, command meaning, persisted authority, evidence requirements, critic review, integration review, or acceptance/publication gates.

## Forensic problem

The 2026-09-04 audits found two independent retransmission failures:

- GLM parent prompts reached roughly 180K–242K. Twenty-six shallow child-wait calls processed 4.86M input, and a rolling minute reached 895,223 successful GLM input against the observed 800K provider limit. Queued completions could reopen turns during intended backoff.
- One Qwen objective processed exactly 117,964,999 successful input across 371 generations. Its second phase resumed around 445K context for 94 more generations, creating an inherited-prefix resend floor near 41.83M. Neither incident involved formal context compaction.

These values are baselines, not promised savings.

## Runtime scheduling and protection

- Child waiting is event-driven at the runtime-adapter boundary: progress/heartbeats update UI without parent inference, terminal events wake once, and duplicate terminal events coalesce.
- `orchestrator-glm`, `critic`, and `integration-reviewer` share a rolling 60-second `nan/glm5.3-flash` admission bucket. The initial 675K input soft ceiling reserves estimated prompts below the observed 800K hard limit.
- A GLM 429 creates shared model-level backoff. Child/tool/parent/user wake queues cannot reset the logical incident or bypass the bounded 2/5/10/20/40-second retry policy.
- Runtime telemetry records rolling maximum, admission waits, retries and backoff events without treating processed input as billed input.

## Bounded continuation

- Repository-native `memory/` topics hold concise stable locators with canonical references, evidence paths, lifecycle, and source digests. Memory is not an authority or autonomous decision maker.
- `memory:check` validates topic safety/currentness and `memory:search` returns at most five previews. Agents initially load at most three selected topics.
- Ignored objective context packets provide a roughly 1,000–1,500-token navigation aid whose digest covers only selected inputs.
- A read-only context mapper is capped at four searches and twelve relevant files; obvious tasks of at most three files bypass it.
- Compact ignored builder checkpoints record operational phase state without conversation history, hidden reasoning, raw logs, or large tool results.
- Builder soft budgets (initially 180K context, 12M cumulative successful input, or 80 generations) request a fresh session only at a safe persisted boundary and a materially different phase.
- Fresh builders receive the objective contract, packet, checkpoint, selected memory and canonical/evidence pointers—not the old conversation.
- Deterministic verification batching runs all required commands and wakes the model once with exact verdicts, actionable failure excerpts and artifact paths.

## Compatibility and limitations

`/gauntlet`, `/gauntlet-continue`, and `/gcont` continue the same persisted work and preserve model selection semantics. Host runtimes must integrate the repository controller hooks to enforce inference admission and event delivery; repository tests prove the reference controller behavior but do not claim deployed provider performance. Engram/MCP is not included.

Post-deployment measurement must compare parent wait generations/input, GLM rolling-60 maximum/429s/admission waits, builder context/cumulative input/generations, rotation starting context/checkpoint size, mapper cost, memory topics/files selected, verification wake count, and continuation re-reads against the audited GLM and Qwen baselines above.
