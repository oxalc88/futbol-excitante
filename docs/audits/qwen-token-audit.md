# Qwen 3.8 Flash token audit: `5V5-KICKOFF-ANTI-HUDDLE`

Audit date: 2026-09-04  
Scope: repository configuration plus local Grok session/runtime records on this VPS  
Mode: forensic/read-only, except for writing this report  
Reference: `gauntlet-token-audit.md` on `audit/glm-token-usage-2026-09-04`

## Executive finding

The approximately 118M Qwen input tokens were **not caused by repeated compaction**. There were **zero formal prompt-context compactions** in either contributing Qwen session. The configured Qwen context window is 1,000,000 tokens, not 250,000, so the global 65% auto-compaction threshold was 650,000 tokens. The observed peak was 570,597 tokens and never reached that threshold.

The dominant pattern was 371 sequential model/tool generations over one continuously growing context lineage. Of the 117,964,999 successful input tokens, 116,439,679 (98.71%) came from calls above 100K input and 113,771,718 (96.45%) came from calls above 150K. The follow-up resumed the original builder at roughly 445K tokens and then made 94 more generations; repeatedly carrying that inherited prefix accounts for a counterfactual lower bound of 41,829,436 input tokens.

## 1. Qwen sessions

Exactly two `qwen3.8-flash` builder session IDs contributed. The second is explicitly marked `effective_context_source: resumed` and `resumed_from` the first.

| Phase | Session ID | Start (UTC) | End (UTC) | Duration | Successful generations | Input | Output | Cached input | Peak context/input | Formal compactions |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Initial implementation | `01a06ad6-2055-78c3-9d78-5a8bd1528b9c` | 05:13:33.034 | 08:24:10.884 | 3h 10m 37.851s | 277 | 69,545,469 | 205,727 | 68,117,888 | 444,994 | 0 |
| Neighbor-test disposition, resumed | `01a06b86-74a6-7673-970a-cee3e006043e` | 08:26:09.375 | 09:39:58.908 | 1h 13m 49.962s | 94 | 48,419,530 | 47,556 | 47,155,072 | 570,597 | 0 |
| **Reconciled total** | two IDs, one resumed lineage | 05:13:33.034 | 09:39:58.908 | **4h 24m 27.813s active** | **371** | **117,964,999** | **253,283** | **115,272,960** | **570,597** | **0** |

The total exactly reconciles the earlier 117.96M measurement. The wall-clock span, including the roughly two-minute handoff gap, was 4h 26m 25.874s. Cached input was 97.72% of reported input. It is a subset of input, not additional tokens; provider billing/compute discounts cannot be inferred from these local records.

## 2. Verify context and compaction configuration

### EXACT CONFIG

- `/home/ubuntu/.grok/config.toml` declares `[model."qwen3.8-flash"] context_window = 1000000`.
- The same file declares global `[session] auto_compact_threshold_percent = 65`.
- Effective configured prompt auto-compaction threshold: **650,000 tokens**.
- Both subagent spawn records in `unified.jsonl` record `effective_model: qwen3.8-flash` and `context_window: 1000000`.
- `gauntlet/models.json` routes `builder_gameplay` to `qwen3.8-flash`; it does not override Qwen's context window or add a builder-specific compaction percentage.

### OBSERVED RUNTIME BEHAVIOR

- Initial context/input grew from 7,291 to 444,994 tokens.
- The resumed child began at 450,352, demonstrating that the prior context was carried forward, then grew to 570,597.
- No `recap_requests` or other recap/compaction artifact directory exists in either session.
- Their formal event types contain model loops, tool calls, permissions and turns, but no prompt compaction/recap event.
- Their session update types contain no compaction/recap update.
- The unified log contains no prompt compaction record for either ID.
- No drop in the recorded prompt-token series indicates a hidden context reset.

### INFERENCE

Because 570,597 is below 650,000, the configured auto-compaction policy was not expected to activate. The filesystem, event stream, update stream and monotonic token progression all agree that it did not activate.

**Is the 250K / 65% hypothesis correct? No.** The actual local runtime configuration is 1M / 65%, not 250K / 65%. A provider-side limit lower than the runtime declaration is not evidenced here; the provider accepted prompts above 500K.

## 3. Compaction timeline

There is no formal compaction timeline: **zero events, zero compaction model calls, and therefore no before/after generation boundary**.

Representative context growth:

| Session phase | Generation | Timestamp (UTC) | Input/context tokens |
|---|---:|---:|---:|
| Initial | 1 | 05:13:37.957 | 7,291 |
| Initial | 50 | 05:31:06.548 | 138,504 |
| Initial | 100 | 05:47:17.964 | 197,745 |
| Initial | 150 | 06:48:36.654 | 279,066 |
| Initial | 200 | 07:05:15.451 | 333,381 |
| Initial | 250 | 07:36:19.329 | 398,068 |
| Initial | 277 | 08:24:10.690 | 444,994 |
| Resumed follow-up | 1 | 08:26:22.999 | 450,352 |
| Resumed follow-up | 30 | 08:43:09.054 | 496,663 |
| Resumed follow-up | 60 | 08:52:42.917 | 529,550 |
| Resumed follow-up | 94 | 09:39:58.713 | 570,597 |

Consequently, there was no post-compaction rereading, searching, test-output reload or knowledge reconstruction to audit. Reads and searches did occur during ordinary implementation, but none follows a compaction boundary because no such boundary exists.

The `shell.image_budget` records seen in later visual sessions are unrelated image-payload accounting and are not prompt-context compaction. They also report `needs_image_compaction: false`.

## 4. Token attribution

The runtime stores aggregate prompt usage per generation, not token attribution per message or tool result. The following categories are therefore deliberately marked exact, proxy or counterfactual; overlapping causal views must not be summed.

| Category | Measurement | Classification | Interpretation |
|---|---:|---|---|
| Successful builder generations | 117,964,999 input | **EXACT** | All 371 successful Qwen generations; this includes retained conversation and tool/test material. |
| Formal compaction generations | 0 | **EXACT** | No compaction model call or artifact. |
| Post-compaction reconstruction | 0 attributable to compaction | **EXACT** | No compaction boundary existed. |
| Repeated inherited prefix in follow-up | at least 41,829,436 input | **EXACT COUNTERFACTUAL FLOOR** | 444,994 prior-final-context tokens × 94 follow-up generations. This is 86.39% of follow-up input and 35.46% of the objective's Qwen input. A real fresh handoff would still need a much smaller prompt. |
| Initial phase above a constant 7,291-token baseline | 67,525,862 input | **EXACT COUNTERFACTUAL** | Shows triangular accumulated-context amplification; it is not all avoidable because implementation state was legitimately added. |
| Tool-result material inserted into chat | 921,001 raw characters | **MEASURABLE PROXY** | Initial 697,869; follow-up-only 223,132. The tokenizer-level contribution and its repeated future resends are not stored per message. |
| Largest single tool result | 26,196 characters | **EXACT PROXY** | No tool result exceeded 50K characters; there was no single enormous test dump in context. |
| Net recorded context growth | 563,306 tokens | **EXACT** | 570,597 final minus 7,291 initial. Its repeated presence across later calls, rather than its one-time ingestion, produced the large aggregate. |
| Retry/failure usage | one failed Qwen request; tokens unavailable | **EXACT COUNT / UNKNOWN TOKENS** | A 429 occurred at 07:21:12.975 and backed off once. Adjacent successful contexts were 376,275 and 376,815 tokens. Failed-request usage is excluded from 117,964,999 and cannot be invented. |

All successful records report `attempts: 1`. The sole retry state says `Too many requests in flight; waiting 2s before trying again`; the next request succeeded. Retry amplification was therefore minor relative to 118M, even if the failed request transmitted approximately the adjacent context size.

## 5. Generation amplification

| Metric | Value |
|---|---:|
| Successful generations | 371 |
| Average input/generation | 317,964.96 |
| Median input/generation | 313,783 |
| p90 input/generation | 524,482 |
| Peak input/context | 570,597 |
| Calls above 100K | 342 |
| Input from calls above 100K | 116,439,679 (98.71%) |
| Calls above 150K | 320 |
| Input from calls above 150K | 113,771,718 (96.45%) |
| Calls above 200K | 268 |
| Input from calls above 200K | 104,821,109 (88.86%) |
| Calls at or below 100K | 29 |
| Input from calls at or below 100K | 1,525,320 (1.29%) |

Per phase, the initial builder averaged 251,066.68 input tokens/generation (median 261,373; p90 398,068). The resumed phase averaged 515,101.38 (median 518,059.5; p90 553,513); every one of its 94 calls exceeded 200K.

This distribution establishes the primary mechanism: a large accumulated prompt was sent again on almost every tool loop.

## 6. Tool and test loops

### Confirmed measurable amplifiers

- The initial phase made 277 generations and 278 tool calls. The follow-up added 94 generations and 93 new tool calls. Across the lineage this is 371 generations and 371 tool calls: effectively one fresh Qwen generation per tool-result cycle.
- There were 14 terminal commands containing `pnpm run typecheck` (12 initial, 2 follow-up).
- There were 72 terminal commands containing `vitest` (42 initial, 30 follow-up). Shell loops mean this count is lower than the number of individual Vitest processes.
- The initial phase ran all 12 node shards and all four browser shards, then reran selected node shards. The follow-up ran all 12 node shards again and all four browser shards, with browser shards 2 and 3 repeated after earlier combined/timeout attempts.
- The full neighbor-test disposition was an explicit second phase, not a compaction recovery. It added 94 generations and 48,419,530 input tokens while preserving the prior 445K-token context.

### Present but not shown to be the primary cause

- Tool results were controlled with `--silent`, `grep`, `head` and `tail`; total raw tool-result text was 921,001 characters and the largest result was 26,196 characters. Large unbounded test-output ingestion is not supported by the evidence.
- `cpu-adapter.ts` was directly read 13 times under two equivalent path spellings. It was also being edited throughout the phase, so the records do not establish 13 unchanged duplicate reads. No exact terminal command string was duplicated; many commands differed by target or shard.
- The initial phase issued 108 terminal commands matching repository-search patterns and the follow-up 45, but this regex overlaps compound test/status commands. It establishes high navigation activity, not 153 proven redundant searches.
- No Qwen child waiting/polling loop was found. Long tests occupied tool execution; there was no repeated builder generation merely asking whether its own test was finished.

The broad objective combined a large adapter change, deterministic multi-tick evidence, capture construction, full node/browser verification and neighbor compatibility. The parent then explicitly expanded the same carried-context lineage into dispositioning roughly 16 neighbor failures. Scope and generation count—not output size or compaction—were the material amplifiers.

## 7. Comparison with one healthy Qwen builder

Comparison objective: `BROWSER-5V5-ANTI-HUDDLE-DYNAMIC-EVIDENCE`, session `01a06cfd-d1b7-7082-bcb5-7296a3c835bd`. It was a recent successful `qwen3.8-flash` builder with a new context.

| Metric | 5V5 kickoff anti-huddle lineage | Healthy browser-evidence builder |
|---|---:|---:|
| Duration | 4h 24m 27.813s active | 1h 18m 58.547s |
| Successful generations | 371 | 135 |
| Total input | 117,964,999 | 29,658,402 |
| Peak context | 570,597 | 362,098 |
| Formal prompt compactions | 0 | 0 |
| Average input/generation | 317,964.96 | 219,691.87 |

The healthy objective used 74.86% fewer input tokens. It began as a new session, was narrower, made 236 fewer generations, and never inherited a 445K prompt for a second repair/test phase. Both sessions had zero compactions, further excluding compaction as the differentiator.

## 8. Final verdict

- **Why approximately 118M?** Because 371 model/tool loops repeatedly submitted a context that grew from 7K to 571K tokens. A 94-generation follow-up resumed at 450K rather than starting from a compact handoff.
- **Was repeated compaction the primary cause?** No. It was not a cause at all in the recorded sessions.
- **How many compactions occurred?** Zero formal prompt-context compactions.
- **Did post-compaction rebuilding materially amplify usage?** No; there was no post-compaction period. Ordinary continued reading/testing added context, but it did not rebuild after compaction.
- **Was repeated large-context generation bigger than compaction?** Yes. Calls above 150K account for 96.45% of successful input; calls above 200K account for 88.86%.
- **Is 65% too low or too high?** It is not the main issue here. At the actual 1M context window, 65% was never reached. Lowering it might reduce context size but could introduce the very compaction/reconstruction cycle hypothesized; this trace does not demonstrate that such a change would be beneficial.
- **Was the objective too large for one Qwen session?** Yes, for one continuously carried context lineage. The implementation/evidence/full-suite phase plus the neighbor-disposition phase should not have shared a 445K working transcript.
- **Single highest-leverage change:** start the test-disposition/fix follow-up as a fresh builder session using a compact structured checkpoint instead of resuming the full implementation transcript. For this trace, the inherited-prefix resend floor alone was 41.83M tokens.

### Recommendations for Gauntlet 0.9.7

1. At a safe implementation/evidence checkpoint, launch any broad repair or neighbor-test phase as a fresh builder with a compact persisted handoff; do not resume a builder already carrying hundreds of thousands of tokens.
2. Batch deterministic verification so full node/browser shards and typecheck return one bounded result per phase, waking Qwen only when the batch completes or a discriminating failure needs judgment.
3. Record per-child prompt size, cumulative input and phase boundary in `TIMING.md`; warn before a gameplay builder exceeds a soft processed-token/context budget. A small persisted checkpoint is sufficient—no new memory architecture is needed.

`gauntlet/state/TIMING.md` currently records this objective as about 4h30m total/about 4h builder time but leaves prompt/completion as `n/a`; it contains no compaction telemetry. The local session and unified logs were required for this diagnosis.
