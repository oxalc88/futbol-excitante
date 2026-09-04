# Gauntlet runtime token audit — GLM 5.3 Flash

Audit cutoff: **2026-09-04T12:35:48.818Z** (07:35:48 PET, UTC-5). This is a read-only forensic snapshot of `/home/ubuntu/projects/oxDeveloop/pes-simulator` and `/home/ubuntu/.grok`; the repository path in the request (`oxDevelop`) was resolved to the live workspace path (`oxDeveloop`). The running Gauntlet process was not stopped, restarted, or reconfigured.

Measurements labeled **exact** are copied or summed from `~/.grok/logs/unified.jsonl`, session `summary.json`, child `meta.json`, and repository state. A failed 429 request does not persist its input-token count, so failed-call sizes are explicitly proxies or `n/a`.

## Executive numeric findings

| Finding | Value | Evidence quality |
|---|---:|---|
| Latest GLM 800K TPM terminal failure | 2026-09-04T11:53:05.041Z (06:53:05 PET) | Exact |
| Successful GLM input in the preceding completion-timestamp 60 s | **895,223** | Exact local ledger |
| Successful GLM input + output in that window | **896,255** | Exact local ledger |
| Current parent context, last completed call | **242,167 tokens** at 12:33:39.653Z | Exact |
| Configured GLM context window / effective 65% auto-compact point | 1,000,000 / 650,000 | Exact config |
| Parent successful generations in this session | **197** | Exact; excludes failed calls |
| Parent terminal 429 generation cycles | **10** | Exact; failed input tokens unavailable |
| Current-session successful GLM traffic, all GLM roles | **31,634,875 input + 159,569 output = 31,794,444** | Exact; failed requests excluded |
| Current-session successful traffic, all recorded roles | **185,392,481 input** | Exact at cutoff; failed requests excluded |
| Accepted `5V5-KICKOFF-ANTI-HUDDLE` prompt input | **133,628,307** | Exact successful-call lower bound |
| Same objective vs documented typical 3–12M | **11.1× the upper bound; 44.5× the lower bound** | Exact comparison |
| Shallow parent wait polls during anti-huddle builder phases | **26 calls / 4,862,905 input / 1,352 output** | Exact |
| Current ball-fix parent calls after child spawn, by cutoff | **5 calls / 1,118,208 input** | Exact |
| Formal compactions in current parent session | **0 found** | Exact artifact/log search |

## 1. Current runtime

The live parent session is `01a06a22-ab92-7ff2-b070-d1c8e499658a`:

- Created `2026-09-04T01:57:32.188777471Z`; still active at the audit cutoff.
- `current_model_id`: `glm5.3-flash`; `reasoning_effort`: `high`.
- Runtime summary identifies the generic agent type as `grok-build-plan`. The repository route and the `/gcont` continuation wrapper bind this use to `orchestrator-glm`; the session metadata does not separately persist that wrapper name.
- Repository/head at session start/current summary: branch `main`, commit `25c0e13804ba6bb8a28059c146a587427a793def`.
- 1,320 session messages and 524 chat messages at 12:33:20Z.
- Last completed parent request at the cutoff: 242,167 input/context tokens, 53 output tokens, 18,816 ms, completed `12:33:39.653Z`.
- Parent context peak in the session is also 242,167. The first completed parent request was 19,850, so the successful-call context range is 19,850–242,167.

The most recently created and active child is `01a06c4c-2965-7e50-a680-65a9a3bab4e1`:

- Role: `builder-gameplay`.
- Model: `qwen3.8-flash`.
- Status at cutoff: `running`.
- Started: `2026-09-04T12:02:05.809393355Z`.
- Task: `Implement settled-ball regime fix`.

No other child `meta.json` under this parent had `status: running` at the cutoff. The current repository objective is `BALL-SETTLED-REGIME-FIX` (Horizon v24 index 1). `CURRENT.md` names it as `next_objective_id`; live child metadata proves execution has begun even though the persisted `builder_in_use` field is still null.

The latest GLM limit incident was:

```text
2026-09-04T11:53:05.041Z
API error (status 429 Too Many Requests): None: glm5.3-flash rate limit:
800000 tokens/min exceeded. Retry shortly.
```

It is a provider TPM limit, not a context-window error. The current parent was only at about 24.2% of its locally configured 1M context window.

## 2. Last GLM calls

The table below is the last 50 persisted GLM call outcomes ending with the latest failure. Aliases: `P` = parent `01a06a22-ab92-7ff2-b070-d1c8e499658a`; `I` = integration reviewer `01a06bd8-c7a8-7b33-84fd-bb362c159c6d`. Input equals the request's recorded prompt/context size. `cached` is included for diagnosis but is not subtracted from processed input. Delta is seconds since the prior GLM outcome in this 50-row slice.

| Timestamp UTC | Role/session | Loop | Input/context | Output | Total | Cached | Duration ms | Result | Retry | Delta s |
|---|---|---:|---:|---:|---:|---:|---:|---|---|---:|
| 09:56:14.076 | orchestrator/P | 161 | 172,222 | 120 | 172,342 | 165,888 | 9,725 | OK | no | n/a |
| 09:56:15.191 | integration/I | 2 | 8,109 | 271 | 8,380 | 0 | 6,411 | OK | no | 1 |
| 09:56:29.795 | integration/I | 3 | 9,848 | 1,349 | 11,197 | 5,696 | 13,492 | OK | no | 14 |
| 09:57:17.276 | integration/I | 4 | 25,161 | 2,832 | 27,993 | 4,608 | 45,214 | OK | no | 48 |
| 09:58:39.284 | integration/I | 5 | 33,576 | 1,813 | 35,389 | 25,344 | 80,369 | OK | no | 82 |
| 10:00:58.108 | integration/I | 6 | 38,477 | 1,186 | 39,663 | 0 | 19,924 | OK | no | 139 |
| 10:02:03.508 | integration/I | 7 | 42,262 | 2,531 | 44,793 | 29,952 | 41,270 | OK | no | 65 |
| 10:02:23.047 | integration/I | 8 | 47,654 | 1,734 | 49,388 | 39,168 | 18,147 | OK | no | 20 |
| 10:03:23.457 | integration/I | 9 | 50,933 | 1,845 | 52,778 | 43,776 | 59,196 | OK | no | 60 |
| 10:04:36.044 | integration/I | 10 | 54,341 | 1,519 | 55,860 | 48,384 | 57,595 | OK | no | 73 |
| 10:05:34.006 | integration/I | 11 | 56,387 | 1,701 | 58,088 | 0 | 39,817 | OK | no | 58 |
| 10:06:23.345 | orchestrator/P | 162 | 173,284 | 437 | 173,721 | 0 | 48,845 | OK | no | 49 |
| 10:06:54.348 | orchestrator/P | 163 | 216,294 | 836 | 217,130 | 0 | 30,126 | OK | no | 31 |
| 10:06:59.373 | orchestrator/P | 164 | 175,116 | 51 | 175,167 | 170,496 | 4,532 | OK | no | 5 |
| 10:07:33.789 | orchestrator/P | 165 | 217,540 | 572 | 218,112 | 216,256 | 16,959 | OK | no | 34 |
| 10:07:59.087 | orchestrator/P | 166 | 176,716 | 896 | 177,612 | 172,800 | 22,090 | OK | no | 26 |
| 10:08:06.696 | orchestrator/P | 167 | 177,664 | 31 | 177,695 | 172,800 | 7,237 | OK | no | 7 |
| 10:08:26.884 | orchestrator/P | 168 | 179,199 | 962 | 180,161 | 0 | 19,858 | OK | no | 20 |
| 10:08:36.710 | orchestrator/P | 169 | 180,179 | 655 | 180,834 | 175,104 | 9,463 | OK | no | 10 |
| 10:08:48.633 | orchestrator/P | 170 | 222,985 | 118 | 223,103 | 217,536 | 11,589 | OK | no | 12 |
| 10:08:56.128 | orchestrator/P | 171 | 180,988 | 395 | 181,383 | 177,408 | 7,224 | OK | no | 8 |
| 10:09:05.114 | orchestrator/P | 172 | 181,401 | 519 | 181,920 | 177,408 | 8,629 | OK | no | 9 |
| 10:09:09.344 | orchestrator/P | 173 | 181,985 | 30 | 182,015 | 177,408 | 3,953 | OK | no | 4 |
| 10:09:13.934 | orchestrator/P | — | n/a | n/a | n/a | n/a | n/a | 429 | yes | 4 |
| 10:09:19.164 | orchestrator/P | — | n/a | n/a | n/a | n/a | n/a | 429 | yes | 6 |
| 10:09:33.397 | orchestrator/P | — | n/a | n/a | n/a | n/a | n/a | 429 | yes | 14 |
| 10:09:49.193 | orchestrator/P | 1 | 180,537 | 619 | 181,156 | 145,152 | 15,496 | OK | yes (2 attempts) | 16 |
| 10:10:02.524 | orchestrator/P | 2 | 181,173 | 106 | 181,279 | 177,408 | 12,825 | OK | no | 13 |
| 10:10:22.296 | orchestrator/P | 3 | 181,296 | 1,398 | 182,694 | 177,408 | 19,206 | OK | no | 20 |
| 10:10:36.430 | orchestrator/P | 4 | 182,711 | 1,083 | 183,794 | 177,408 | 13,691 | OK | no | 14 |
| 10:11:22.463 | orchestrator/P | 5 | 228,084 | 1,949 | 230,033 | 0 | 45,679 | OK | no | 46 |
| 10:11:33.565 | orchestrator/P | 6 | 230,055 | 233 | 230,288 | 222,976 | 10,701 | OK | no | 11 |
| 10:11:40.498 | orchestrator/P | 7 | 186,028 | 173 | 186,201 | 179,712 | 6,570 | OK | no | 7 |
| 10:11:47.544 | orchestrator/P | 8 | 186,219 | 450 | 186,669 | 182,016 | 6,707 | OK | no | 7 |
| 10:11:52.424 | orchestrator/P | — | n/a | n/a | n/a | n/a | n/a | 429 | yes | 5 |
| 10:11:57.352 | orchestrator/P | — | n/a | n/a | n/a | n/a | n/a | 429 | yes | 5 |
| 10:12:01.940 | orchestrator/P | — | n/a | n/a | n/a | n/a | n/a | 429 | yes | 4 |
| 10:12:07.604 | orchestrator/P | — | n/a | n/a | n/a | n/a | n/a | 429 | yes | 6 |
| 10:12:11.507 | orchestrator/P | — | n/a | n/a | n/a | n/a | n/a | 429 | yes | 4 |
| 10:12:16.564 | orchestrator/P | — | n/a | n/a | n/a | n/a | n/a | 429 | yes | 5 |
| 11:49:26.578 | orchestrator/P | 1 | 187,060 | 617 | 187,677 | 0 | 16,951 | OK | no | 5,830 |
| 11:50:48.548 | orchestrator/P | 2 | 232,130 | 232 | 232,362 | 0 | 81,552 | OK | no | 82 |
| 11:50:58.853 | orchestrator/P | 3 | 187,945 | 58 | 188,003 | 184,320 | 9,921 | OK | no | 10 |
| 11:51:18.481 | orchestrator/P | 4 | 188,372 | 855 | 189,227 | 184,320 | 15,115 | OK | no | 20 |
| 11:51:23.657 | orchestrator/P | 5 | 189,245 | 49 | 189,294 | 184,320 | 4,705 | OK | no | 5 |
| 11:52:17.923 | orchestrator/P | 6 | 233,996 | 575 | 234,571 | 0 | 51,458 | OK | no | 54 |
| 11:52:26.040 | orchestrator/P | 7 | 234,694 | 52 | 234,746 | 233,984 | 7,730 | OK | no | 9 |
| 11:52:51.983 | orchestrator/P | 8 | 235,057 | 358 | 235,415 | 0 | 13,857 | OK | no | 25 |
| 11:52:58.808 | orchestrator/P | 9 | 191,476 | 47 | 191,523 | 186,624 | 5,372 | OK | no | 7 |
| 11:53:05.041 | orchestrator/P | — | n/a | n/a | n/a | n/a | n/a | 429 | yes | 7 |

Exact failed-request input is not stored. Closest measurable proxies are the immediately adjacent successful parent contexts: about 180–230K during the 10:09–10:12 cluster and 191–235K at the latest failure. These are proxies, not recovered failed-call token counts.

The runtime's summary for the failed 11:49–11:53 user turn independently agrees with the nine successful parent rows: `glm5.3-flash` used exactly 1,879,975 input, 2,843 output, 1,882,818 total, 973,568 cached-read tokens, nine model calls, and 206,856 ms API time. Six concurrent `gemma4` git-committer calls were reported separately and are not counted as GLM traffic.

## 3. TPM reconstruction

### Latest failure: completion-timestamp ledger

For the rolling interval ending at the first 429 signal (`11:52:01.433Z` through `11:53:01.433Z`), four successful parent GLM calls completed:

| Completion UTC | Input | Output | Total | Cumulative input |
|---|---:|---:|---:|---:|
| 11:52:17.923 | 233,996 | 575 | 234,571 | 233,996 |
| 11:52:26.040 | 234,694 | 52 | 234,746 | 468,690 |
| 11:52:51.983 | 235,057 | 358 | 235,415 | 703,747 |
| 11:52:58.808 | 191,476 | 47 | 191,523 | **895,223** |

**Exact local measurement:** the completion-timestamp ledger crosses 800,000 on the fourth row at `11:52:58.808Z`, reaching 895,223 input and 896,255 total tokens.

### Latest failure: provider-admission interpretation

Providers normally make an admission decision when a request begins, while the local token count is only logged when a successful request finishes. In the 60 seconds before rejected call 10 began at `11:52:59.704Z`, three known successful requests began at `11:52:18.309Z`, `11:52:38.125Z`, and `11:52:53.435Z`. Their eventually recorded input was 234,694 + 235,057 + 191,476 = **661,227**.

The rejected call's exact input is absent. Using adjacent context as a proxy (191,476–235,057), provider reservation would have reached **852,703–896,284**, over the 800,000 threshold. This is an **estimate/inference**, but it is consistent with both the explicit error and the exact completion ledger.

The error is therefore fully explainable by repeated large-context parent calls. It does not require Qwen traffic, and no Qwen token has been included in either calculation.

### Earlier confirming burst

In the 60 seconds ending at the first parent failure around `10:09:10Z`, six successful parent calls completed with 1,126,737 input and 2,679 output (1,129,416 total). The local completion ledger crossed 800K at `10:09:05.114Z`, when cumulative input reached 944,752. This earlier burst confirms the same failure mode independently.

At `09:41:01Z` and `09:41:04Z`, the critic child itself received the same named GLM rate limit after the parent had sent multiple ~205–209K GLM contexts in rapid succession. This is strong evidence that parent/critic/integration GLM roles consume a shared per-model/provider allowance under this runtime credential. It is not evidence that Qwen or Gemma traffic shares that limit.

## 4. Context growth

Parent context progression, selected exact points:

| UTC | Parent input/context | Event |
|---|---:|---|
| 02:07:09 | 19,850 | First completed parent generation |
| 05:12:45 | 166,210 | Before anti-huddle delegation |
| 05:54:52 | 170,427 | Repeated builder wait loop |
| 07:50:41 | 192,007 | Repeated builder wait loop |
| 09:40:56 | 208,916 | Critic launch/review transition |
| 09:41:25 | 209,596 | Parent waiting during critic |
| 10:08:48 | 222,985 | Dense acceptance/tool loop |
| 10:11:33 | 230,055 | Dense acceptance/tool loop |
| 11:52:51 | 235,057 | Acceptance publication/tool loop |
| 12:02:58 | 241,480 | New objective, waiting on builder |
| 12:33:39 | **242,167** | Latest completed parent poll at cutoff |

There are 197 successful parent generations plus 10 terminal failed parent generation cycles. Parent `inference_retry` appears 11 times: ten terminal failures and one request that succeeded on its second attempt at `10:09:49.193Z`.

The context is repeatedly resent. Evidence includes 19 nearly empty 52-output-token parent polls during the first anti-huddle builder phase, consuming 3,448,162 input, and seven more during its follow-up phase, consuming 1,414,743 input. These 26 calls produced only 1,352 output tokens while processing 4,862,905 input tokens.

Polling was model-driven. Parent chat history contains repeated `get_command_or_subagent_output(... timeout_ms: 600000)` calls—19 equivalent calls for the anti-huddle implementation child (split between formatting variants), plus similar series for the previous legend builder and current ball-fix builder. Each 600-second timeout returned control to the parent and triggered a new full GLM generation to issue another wait. The live ball-fix sequence already did this at `12:02:58`, `12:13:08`, `12:23:20`, and `12:33:39`.

No formal compaction occurred:

- No `compaction_requests/` or `recap_requests/` directory exists under the parent session.
- No parent compaction/recap events exist in `unified.jsonl`.
- Token-count drops (for example 209,817 to 170,483) are request-shape variation, because the context later rebounds and there is no compaction artifact. They must not be presented as compaction.

Local config sets GLM's context window to 1,000,000 and global auto-compaction to 65%, or about 650,000 tokens. The session peak of 242,167 never approached that threshold, so the configured policy did not affect this session. Also, `gauntlet/models.json` places `auto_compact_percent: 65` only on the Grok 4.6 orchestrator entry; the GLM route has no route-specific compaction field and relies on the local session policy.

## 5. Token cost by role

Exact successful-call totals for parent session `01a06a22...` through the cutoff:

| Role | Model | Successful calls | Input | Output | Total | Peak request context |
|---|---|---:|---:|---:|---:|---:|
| orchestrator-glm | glm5.3-flash | 197 | 29,274,046 | 101,318 | 29,375,364 | 242,167 |
| builder-gameplay | qwen3.8-flash | 639 | 153,515,168 | 416,357 | 153,931,525 | 570,597 |
| critic | glm5.3-flash | 43 | 1,847,580 | 35,205 | 1,882,785 | 91,195 |
| integration-reviewer | glm5.3-flash | 19 | 513,249 | 23,046 | 536,295 | 56,387 |
| git-committer | gemma4 | 32 | 242,438 | 4,117 | 246,555 | 9,887 |
| builder-structured | — | 0 | 0 | 0 | 0 | — |
| aux | — | 0 | 0 | 0 | 0 | — |

GLM-only successful traffic is 259 calls, 31,634,875 input, and 159,569 output. Twelve GLM terminal failed records (ten parent, two critic) are excluded because their input counts were not persisted.

Qwen dominates total session processing, but the provider error explicitly names `glm5.3-flash`. The evidence does not show Qwen sharing GLM's 800K TPM quota; Qwen is therefore relevant to total session expense, not to the GLM rate-limit calculation.

For the recently accepted `5V5-KICKOFF-ANTI-HUDDLE` interval, exact successful prompt input is:

- Parent orchestration: 13,822,645.
- Qwen builder plus follow-up: 117,964,999.
- GLM critic: 1,382,436.
- GLM integration: 372,557.
- Gemma candidate/acceptance commits: 85,670.
- Total: **133,628,307 prompt input**, plus 321,707 output = 133,950,014.

This is a lower bound because rejected requests have no token count. It is 11.1 times `TIMING.md`'s documented 12M upper end for a typical accepted objective.

## 6. Retry and wake-up analysis

### Confirmed waste: parent wake-ups while builders run

- From `05:14:08Z` to `08:23:02Z`, 19 parent calls returned almost only another wait tool call (52 output tokens each) while the Qwen anti-huddle builder was still running. Cost: 3,448,162 input.
- From `08:36:56Z` to `09:38:39Z`, seven more 52-token parent calls waited on the Qwen follow-up. Cost: 1,414,743 input.
- During the current ball-fix child, calls at `12:02:37`, `12:02:58`, `12:13:08`, `12:23:20`, and `12:33:39` processed 1,118,208 input after the child spawned. Four were effectively shallow wait continuations (53 output each).

This is not passive waiting: every timeout wakes the parent model and resends its full context.

### Confirmed waste: queued wakes defeating rate-limit backoff

The contract requires 2s, 5s, 10s, 20s, 40s bounded exponential backoff with jitter and no indefinite spin. Parent runtime behavior diverged:

- `10:09:13.934Z`: original long turn terminates on 429.
- `10:09:14.148Z`: queued `task-completed-call_7d1...` begins a new parent prompt almost immediately; it fails at `10:09:19.164Z`.
- `10:09:19.300Z`: queued `task-completed-call_e653...` begins immediately; it fails at `10:09:33.397Z`.
- `10:09:33.510Z`: queued `task-completed-call_2f5...` begins immediately; its request retries and finally succeeds at `10:09:49.193Z`.
- A later burst fails at `10:11:52.424Z`, followed by queued task-completion prompts beginning at `10:11:52.730`, `10:11:57.748`, `10:12:02.335`, `10:12:07.955`, and `10:12:11.762Z`; all terminate on 429 through `10:12:16.564Z`.

The result was nine parent terminal 429 cycles in about 183 seconds, plus one internally retried success. The log advertises `max_retries: 15` at inference retry sites, while the repository contract specifies a maximum of five attempts. In practice the individual parent turn terminalized after one internal retry, but queued task wakes created new logical turns and bypassed the intended global backoff budget.

### Better behavior observed in the critic

Critic `01a06bca...` failed at `09:41:01.000Z` and `09:41:04.110Z`. The runtime recorded `shell.turn.subagent_rate_limit_backoff` attempts 1 and 2, waited until `09:41:21.179Z`, then succeeded in the same loop. This is a useful counterexample: the child-specific backoff path recovered without spawning a series of new prompt turns.

### Repeated inspection and large reads

No exact duplicate direct `read_file` call to the same path was found in the parent history: `PROMPT.md`, `CURRENT.md`, `HORIZON.md`, reviewer contracts, and related files were each directly read once in this session. Several `git status`/evidence progress inspections occurred between long builder waits, but the records show changing worktree/evidence state, so labeling all of them unnecessary would be speculation.

The larger confirmed context burden is retention and retransmission: full delegation prompts, full child reports, long tool results, and verbose state/history remain in the parent context and are resent on every subsequent tool loop. The parent also restates substantial builder material in critic and integration prompts. That is semantically useful to reviewers but need not remain verbatim in every later parent request.

No critic/integration verdict retry loop occurred for the two recent accepted objectives; both reviewers accepted on the first substantive pass. Reviewer token use is comparatively small. The waste is predominantly parent orchestration and long-running Qwen builder tool loops, not repeated qualitative verdict rounds.

No literal current-session `stop_failure` record was found. The applicable records are `shell.turn.inference_failed`, `turn.terminal_failure`, and `stop_reason: rate_limit`.

## 7. Comparison with `gauntlet/state/TIMING.md`

`TIMING.md` is only partially current:

- It was measured at `2026-09-04T10:07:00Z` and its four markers reach `5V5-KICKOFF-ANTI-HUDDLE`, so the latest accepted objective is represented.
- The in-flight `BALL-SETTLED-REGIME-FIX` is not represented as an accepted timing row, which is correct.
- The two newest accepted per-step rows record prompt and completion as `n/a` even though local runtime logs contain reconstructable usage.
- The `By model` aggregate explicitly says it was refreshed `2026-08-15`; it contains no `glm5.3-flash` or `qwen3.8-flash` usage rows and is therefore not current despite `usage_aggregates_through` claiming the latest accepted objective.
- The file declares `tracking_contract_version: 1`, while `gauntlet/timing-contract.md` requires version 2.
- Its persisted `session_id` is the older long-running Gauntlet lineage `019ffdda...`, not this continuation parent `01a06a22...`; the file does not expose a continuation-session breakdown.

The historical statement that parent context is re-sent on every tool loop still matches current behavior exactly. The 26 shallow wait calls processing 4.86M input are direct evidence.

The accepted anti-huddle objective's exact successful prompt lower bound is 133.63M, far above the stated typical 3–12M: 11.1× above the typical upper bound. Most of that objective's processing was Qwen builder traffic (117.96M), while the parent alone processed 13.82M.

Repository timing telemetry is insufficient for TPM burst diagnosis. `TIMING.md` has no per-call timestamp/status/cache/retry ledger, no rolling 60-second maxima, and no failed-request input. The local unified log is good enough to reconstruct successful calls, but precise provider admission accounting remains impossible because rejected request tokens are not stored.

## 8. Root cause

### Confirmed

1. **Repeated large parent contexts in a dense tool loop.** Four completed parent requests in the final 60-second ledger processed 895,223 input tokens. The next request was rejected.
2. **A real model-specific provider limit.** The provider explicitly returned `glm5.3-flash rate limit: 800000 tokens/min exceeded`; this is not a context-window error.
3. **No rolling GLM TPM admission control.** The runtime began another parent request 0.896 seconds after the 191,476-token call completed, despite the locally observable rolling total already exceeding 800K.
4. **Parent retry/wake queue amplification.** Task-completion prompts repeatedly started immediately after terminal 429s at 10:09–10:12, bypassing the repository's intended global exponential backoff.
5. **Polling invokes the parent model.** Ten-minute child waits are followed by full-context GLM generations. This spent 4.86M prompt tokens in 26 shallow waits during the accepted anti-huddle builder phases alone.
6. **Auto-compaction did not activate.** Parent peak context was 242,167, well below the effective 650K threshold. The policy therefore offered no protection against TPM bursts caused by several sub-threshold calls.

### High confidence

1. **The GLM allowance is shared across GLM roles/sessions on this runtime credential.** The critic received the same GLM limit while the parent alone was generating >800K/min. Exact provider quota scope is not logged, but the cross-session timing strongly supports a shared GLM model/key bucket.
2. **Verbose parent retention raises every later call.** Full child prompts/reports and tool outputs remain in history; context increased from ~20K to >200K and is resent even for one-line wait decisions.
3. **The current continuation flow's stop/continue semantics encourage model-mediated idling.** Persisted continuation is valuable, but it is currently implemented with repeated live model wake-ups rather than a runtime-level event wait.

### Possible

1. Cached-read tokens may receive different billing treatment while still counting fully or partly toward provider TPM. The local logs show 973,568 cached-read tokens in the failed turn, but do not document the provider's TPM cache rule. The explicit failure proves caching did not prevent the burst.
2. The failed call's requested context was probably ~191–235K, but its exact input was not persisted. That range is a proxy only.
3. Provider-side accounting may use reservation at start, completion time, or another sliding implementation. Both local reconstructions exceed the threshold once the rejected request is included, but the exact provider crossing instant is not exposed.

These are three separate dimensions:

- **Provider rate limit:** 800K GLM tokens/min; actually hit.
- **Context-window limit:** 1M configured; not approached and not the failure.
- **Total session spend:** 185.39M successful input across all roles at cutoff; large, but not itself a per-minute error.

## 9. Recommendations

Ordered from smallest/highest leverage to broader operational changes:

1. **Add one shared rolling GLM TPM admission gate for parent, critic, and integration calls.** Reserve the next request's estimated context before submission and wait until the prior 60-second total plus reservation is safely below 800K (for example a 650–700K operational ceiling). Do not include Qwen/Gemma unless provider evidence later proves the quota is shared.
2. **Coalesce/gate all wake-ups during GLM backoff.** A 429 should block user/task/tool wake queues from launching another GLM turn until the contract's 2/5/10/20/40-second backoff permits it. Count retries globally per logical inference, not separately per queued prompt.
3. **Prevent parent generations while a child is still running.** Make subagent waiting event-driven at the runtime layer. A timeout/heartbeat may update the UI, but it should not call the parent model merely to issue the same wait again. This preserves builder independence and removes the measured 4.86M anti-huddle polling cost.
4. **Use a compact structured handoff after each child and accepted objective.** Keep objective ID, child session ID/model, changed-file digest, commands/evidence pointers, verdict, required fixes, and state checkpoint; do not carry full transcripts into routine orchestration. Reviewers still inspect source/evidence independently, so critic and integration strength is preserved.
5. **Start a fresh GLM parent only at a safe persisted checkpoint.** After acceptance is committed, pushed, remotely verified, and `CURRENT/HORIZON/HANDOFF/TIMING` are durable, continue in a fresh parent session from the structured checkpoint. Do not reset mid-pipeline. This retains continuation while bounding parent context.
6. **Lower GLM parent compaction from an unreachable relative threshold to a role-appropriate absolute/relative trigger.** A 150–200K parent threshold (or about 20–25% of the configured 1M window) would have acted here. Compact only after writing a structured checkpoint, since automatic lossy compaction must not erase evidence or pipeline phase.
7. **Avoid repeated large-file payloads by identity.** Record file hash/path/line scope in the parent and reread only after a hash/state change. This session did not show exact duplicate direct reads, so this is preventive, not the primary finding.
8. **Persist call-level telemetry.** For every generation store timestamp, provider/model, role/session, prompt, cached prompt, output/reasoning, duration, status, retry attempt, failed-request estimated/actual size if exposed, and rolling-60 model total. Refresh `TIMING.md` by exact continuation session/model/role, and align it to timing contract v2.

None of these recommendations removes builder independence, mandatory critic review, integration review, evidence gates, or durable continuation. They change scheduling and context transport, not acceptance authority.

## 10. Final verdict

**Is the current flow spending too many processed tokens? Yes.** The recent accepted objective processed at least 133.63M prompt tokens against a documented typical 3–12M, and the current session had already processed 185.39M successful input tokens by the cutoff. Qwen builder work is the largest total-spend component, while GLM parent polling and dense tool loops are independently excessive.

**Is the 800K TPM failure explained by the current orchestration pattern? Yes.** The exact local final-window ledger contains 895,223 successful GLM input tokens, and the next large parent call was submitted immediately. No cross-model attribution is needed.

**Primary diagnosis:** an orchestrator-context-and-scheduling problem meeting a real provider limit. The parent repeatedly resends ~180–242K context on each tool loop without a per-model TPM governor. The provider ceiling is the immediate enforcement event; queued retry/wake amplification is an important secondary defect. It is not a context-window limit.

**Highest-leverage fix:** put every GLM role behind one rolling-60-second admission/backoff gate and make child waiting event-driven so a running child cannot wake a full parent generation. The gate prevents the 429 immediately; event-driven waiting removes the largest clearly unnecessary parent token stream.
