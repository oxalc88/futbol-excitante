# Methodology

## Evidence discovery and source formats

Grok Build stores sessions under
`~/.grok/sessions/<encoded-working-directory>/<session-id>/`. The extractor
indexes every encoded working directory because Gauntlet children can run from
temporary worktrees as well as the primary repository.

The inspected files and their meanings are:

| Source | Format | Meaning used here |
|---|---|---|
| `summary.json` | JSON | Session creation/update metadata, current agent/model, title and summary. |
| `chat_history.jsonl` | JSONL | Model-visible system/user/reasoning/assistant/tool-result records. Compaction can rewrite this file, so it is not an immutable history. |
| `events.jsonl` | JSONL | Timestamped `turn_started`, `loop_started`, `first_token`, `tool_started`, `tool_completed`, and `turn_ended` events. This defines generation boundaries and wall time. |
| `updates.jsonl` | JSONL/ACP updates | Streaming token meter (`_meta.totalTokens`), prompt ID, tool calls, retry markers, completion status, and turn-level usage/cache/model-call aggregates. |
| `prompt_context.json` | JSON | Injected AGENTS/workspace/environment context references. |
| `system_prompt.txt` | text | Harness system prompt. Its bytes are measured only through model-visible history; text is not exported. |
| `signals.json` | JSON | Session counters, context window, tool/model use, error and compaction counters. |
| `subagents/<id>/meta.json` | JSON | Parent/child link, subagent type, exact routed model, timestamps, status, duration, and failure metadata. |
| `subagents/<id>/output.json` | JSON | Final child status/output metadata; raw output is not exported. |
| `compaction_checkpoints/*.json` | JSON | Pre/post-compaction checkpoint evidence. |
| `compaction_requests/*.json` and legacy `recap_requests/*` | JSON | Compaction/recap request evidence. |
| `terminal_logs/*` | text | Terminal capture. It was identified but is not copied or used as a raw dataset. |

Parent/child relations come from `subagents/*/meta.json`, not timing overlap.
Every child is attributed to its own role and model. Child tokens are never
added to a parent request.

## Scope and cutoff

The roots are the 18 top-level Gauntlet continuation sessions identified from
TIMING, titles, model routes, state references and child metadata. Their full
recursive child closure was selected. Sessions created before the Gauntlet
start or after the fixed cutoff were excluded; specifically, two clearly linked
children created at 05:03 and 05:04 UTC were outside the cutoff. The resulting
scope is 552 sessions. The latest included model activity is 04:49:41 UTC.

The fixed cutoff prevents concurrent appends from changing the study and avoids
interfering with the live `orchestrator-deepseek` process. No process was
signalled, resumed, paused, or otherwise controlled by the analysis.

## Per-request reconstruction

A request row begins at each `loop_started`. Its end is the first subsequent
`tool_started` or `turn_ended` before the next loop; `first_token` is retained
separately. This yields 15,731 model-visible generation loops. Forty loops have
no token meter, and 134 have no terminal event before the cutoff; their missing
fields are null/unknown.

`prompt_input_tokens` is the first persisted `_meta.totalTokens` in the loop.
This is the model-visible context meter at generation start. Validation against
a completed child gave 4,576,630 summed loop starts versus 4,572,790 persisted
turn input tokens (<0.1% difference). `completion_output_tokens` is the increase
from the first to maximum meter in the loop and is explicitly an estimate.
Turn-level exact usage and cache totals are included in `sessions.csv`; Grok
does not safely allocate them to individual generation rows, so request cache
fields remain null.

No provider request ID was persisted. Grok prompt IDs are retained as
`request_id`; `provider_request_id` is null. Provider endpoint hostnames are not
exported. Models configured through the custom OpenAI-compatible backend use
the provider label `custom-openai-compatible`; Grok routes use `xAI`.

## Context and repetition

For uncompacted parent sessions, each assistant/reasoning block is aligned to
its loop and its preceding model-visible record prefix is measured. Content
characters/bytes, compact serialized size, record count, prior tool calls,
reasoning-summary characters and tool-argument characters are exported. The
content itself is not.

Compacted `chat_history.jsonl` contains the current rewritten window, not every
historical prefix. Historical token meters/events remain usable, but exact old
category bytes are irrecoverable. Those rows are marked
`unavailable_after_compaction`. Context-category tokens use the documented
`characters / 4` approximation; they are not provider tokenization.

Adjacent-request repetition uses the conservative size bound
`min(previous_context_tokens, current_context_tokens)`. The percentage is that
bound divided by current context. This accurately demonstrates repeated window
exposure but cannot prove byte identity for compacted prefixes. Where an exact
uncompacted prefix exists, category repetition is likewise bounded by adjacent
category size. Therefore repetition figures are labeled estimates and should
not be interpreted as billing after cache discounts.

Compaction is detected when context drops by at least 20% between adjacent
requests and is cross-checked with checkpoint/signals files. A new top-level
session also resets context but is not mislabeled as an in-session compaction.

## Roles, objectives, and activity classes

Roles are mapped from exact subagent type: builders, critics, integration
reviewers, auxiliary, and bookkeeping/committer. Top-level sessions are
`parent/orchestrator`; their model determines `orchestrator` versus
`orchestrator-deepseek` per request.

Objective IDs are restricted to IDs found in complete `HISTORY.md`, `CURRENT.md`
and `HORIZON.md`. Child metadata/prompt references are high-confidence.
Parent attribution follows explicit single-objective tool metadata and persists
that state until a new objective is explicit. Multi-objective horizon planning
is classified as between-objective and leaves the objective null. Parent
objective attribution remains heuristic and is marked medium when inherited.

Parent generations are classified from emitted tool metadata as strategic
decision, wait/result-processing, acceptance/bookkeeping, strategic horizon
planning, provider-error recovery, or substantive orchestration. The
`new_decision_high_confidence` flag is only set where the tool/action pattern is
clear; it does not attempt semantic judgment over private prose.

Objective wall time spans attributed request activity, unlike TIMING's merged
child-active intervals. The two metrics are intentionally not substituted for
one another.

## TIMING cross-check

`gauntlet/state/TIMING.md` was read completely. Its own contract says it is a
living snapshot, not a provider invoice. Exact matches include the legacy Grok
committer population (81 sessions, 649 calls, 6.405M prompt, 468,913 estimated
completion) and its ~400k parent peak. The old 160.12M/781-call Grok parent row
is stale relative to this cutoff: 174.92M/847 calls. Rows described as estimates
or `n/a` remain estimates; this extraction does not retrofit invented values.

The current 1.224B prompt total is not directly comparable to TIMING's ~526M:
the latter is measured/refreshed earlier, excludes the new DeepSeek parent
history, and states several later objectives only as estimates. Possible gaps
remain for hidden internal calls (`modelCalls` can exceed visible loops),
post-cutoff work, and exact pre-compaction bytes. Double counting is prevented
at the role/session level, but TIMING totals must not be added to this dataset.

## Sanitization

The exporter never emits raw user/system/assistant text, tool inputs/results,
subagent prompts/output, terminal logs, environment values, provider hosts, or
configuration secrets. Only approved IDs, timestamps, model/role labels,
counts, numeric sizes, categories and SHA-256 digests are written. Error strings
are restricted to short provider/harness status messages and passed through
patterns for authorization/cookies, API keys, tokens, passwords, signed URLs,
and common credential prefixes. Source paths replace the encoded directory with
`<encoded-cwd>`.

Before publication, all generated text is scanned again for authorization
headers, cookies, credentials, token/key patterns, private keys, and signed URL
parameters. CSV/JSON/JSONL parsing and schema consistency are validated.

## Limitations

- The harness exposes a token meter, not the exact serialized HTTP request or
  provider tokenizer. Exact provider payloads and request IDs cannot be recovered.
- Hidden/internal calls appear in turn-level `modelCalls` but not always as
  model-visible assistant generations.
- Exact category/byte repetition is unavailable after compaction.
- Objective attribution for inherited parent loops is heuristic; null is used
  during identifiable between-objective planning.
- A `tool_completed` non-success can be an expected diagnostic command. It is
  retained in `errors.csv` but not counted as a provider failure.
- Cache usage exists only as turn/session aggregates and cannot be assigned
  safely to one request.
