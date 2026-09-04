# Session / model failure investigation — 2026-08-13 to 2026-08-20

**Window:** 2026-08-13 00:00 UTC through 2026-08-20 (today).  
**Sources:** Grok session `updates.jsonl` / `summary.json` under `~/.grok/sessions/.../pes-simulator/` (686 session dirs, ~166k update lines), `gauntlet/models.json`, `gauntlet/model-capability-contract.md`, `gauntlet/state/{CURRENT,HANDOFF,HORIZON}.md`, screenshot of the overflow TUI.  
**Scope:** Provider/harness failures that stopped or retried turns. Not gameplay verdicts.

## Verdict (the screenshot)

The yellow TUI error

```text
Not found (404) — None: No endpoints found that support image input.
Run /model to pick another.
```

is **not** a critic or integration REJECT and **not** a gameplay failure.

It is `MODEL_CAPABILITY_MISMATCH` on the **parent orchestrator model `deepseek-v4-flash` (NaN)**. That route is declared `capabilities.image_input: false`. The Grok TUI still attached at least one image to the parent turn (phone screenshot of the session, and/or browser-evidence PNGs already in the conversation). NaN returned HTTP 404 because **no DeepSeek Flash endpoint on that key accepts image parts**.

The footer in the screenshot (`DeepSeek V4-Flash (NaN) (high) · always-approve`) matches overflow session `01a01d7c-3f3f-78f0-92cb-37a086a1d8cd`.

`mimo-v2.5`, `qwen3.6`, `gemma4`, and `grok-4.6` did **not** emit this 404. They appear on the same failed turns only because subagents had already run before the **parent** DeepSeek call tried to continue with the image attached.

## Which models caused the problems

Ranked by how often they actually stopped work this week.

| Rank | Model | Provider | Failure class | Retry events | What it did |
| --- | --- | --- | ---: | ---: | --- |
| 1 | **`deepseek-v4-flash-0731`** | NaN | `quota_exhausted`, then `model_unauthorized` / `invalid_model_name` | 20× 402 + 3× 500 cap + 4× 401 “no access” + 1× 400 invalid name | Burned the 500M-token allowance (`500,447,721 / 500,000,000`), then the snapshot was removed from the key. Stale critic launches still target 0731. |
| 2 | **`deepseek-v4-flash`** | NaN | `model_capability_mismatch` (404 image), plus auth connector flakes | **4 terminal 404s** (2 sessions × 2) | Current overflow orchestrator / primary critic / primary integrator. Text-only on NaN. Kills the parent turn when any image is in context. |
| 3 | **`mimo-v2.5`** | NaN | `invalid_request_400` | 13 | Gameplay builder and critic-mimo. Turns die with `Invalid request. Check your request parameters.` All 13 sampled sessions ended `stop_reason=error`. |
| 4 | NaN auth plane (0731 and Flash) | NaN | `auth_failure` 401 | 8 | Connector DB login / `'NoneType' object has no attribute 'get'` / “all connection attempts failed”. Transient; not a model-capability bug. |
| — | `qwen3.6` | NaN | none as the failing parent | 0 | Present on mixed error turns as a successful subagent, not the 404 source. |
| — | `gemma4` | NaN | none as the failing parent | 0 | Same: git-committer / aux on mixed turns. |
| — | `grok-4.6` | xAI | early 401 when pointed at NaN | session-level | 2026-08-13 migration session: NaN rejected a grok.com token until `NAN_API_KEY` was set. Not the screenshot bug. |

**Direct answer:** the screenshot problem is **`deepseek-v4-flash`**. The week-long quota/routing problem is **`deepseek-v4-flash-0731`**. The secondary builder/critic flake is **`mimo-v2.5` 400**.

## Screenshot session reconstruction

Local TUI times are UTC−5 (matches candidate commit `Thu Aug 20 06:31:04 2026 -0500`).

| Local | UTC | Session | What happened |
| --- | --- | --- | --- |
| 2026-08-19 23:44 | 2026-08-20 04:44 | `01a01d7c-…` created | Overflow `/gauntlet-continue` on `deepseek-v4-flash` high. Title: “Continue Gauntlet Session Execution”. |
| ~05:14 (TUI) | ~10:14 | same | User prompt `/gauntlet-continue` visible in the screenshot. |
| 05:31 | 10:31 | candidate `847d6ee` then amended `8c7c467` | ARCH-DIFF-001-RUBRIC candidate snapshot. |
| ~06:50 | 11:50:43 | **404 #1** | After critic-mimo ACCEPT (523s) and while integration-reviewer-mimo was in flight / completing. TUI: `post_tool_use_failure` then the 404. Turn usage mixed: `deepseek-v4-flash` 39 calls, `mimo-v2.5` 111, `qwen3.6` 59, `gemma4` 4 — then parent continuation with image failed. Prompt id `subagent-completed-01a01eb3-…` (BROWSER-CORE-EVIDENCE builder, which had also 400’d). |
| 06:57 (TUI) | ~11:57 | same | Orchestrator still printed `Integration ACCEPT (972s, 0 regressions)` for `integration-reviewer-mimo` / ARCH-DIFF-001-RUBRIC and started unstaging out-of-scope `BROWSER-CORE-EVIDENCE` screenshots. |
| 06:59 | 11:59:00 | **404 #2 (session death)** | After amending the candidate with `audit.json`. Turn usage is **only** `deepseek-v4-flash` (7 calls, 1.83M input tokens). This proves the parent model, not MiMo/Qwen/Gemma, is the 404. Session `last_active_at` = this timestamp. |

TUI also showed:

```text
This request failed over its images (or was too large); 1 image(s) were left out of the retry.
```

The retry still 404’d: dropping one image is not enough when the remaining attachment (or the route itself) has no image-capable endpoint.

Gauntlet already documents this exact string as `MODEL_CAPABILITY_MISMATCH` (`gauntlet/model-capability-contract.md`, scenario `MODEL-CAPABILITY-MISMATCH`, routing in `gauntlet/models.json`). The TUI does not honor that contract: it retries the **same** parent model instead of stripping all images or switching to a vision-capable parent (`grok-4.6`).

Same 404 pair on the previous overflow parent:

| UTC | Session | Usage on failed turn |
| --- | --- | --- |
| 2026-08-19 21:44:31 | `01a019dc-092a-70a1-8946-eaf6b3ce353e` | Flash 144 + MiMo 244 + Gemma 19 (46.8M input) |
| 2026-08-19 22:17:25 | same | Flash 24 + MiMo 33 (11.9M input) — session last-active |

Both overflow parents were `current_model_id: deepseek-v4-flash`, agent `grok-build-plan`, reasoning `high`.

## Week timeline (orchestration + provider)

### 2026-08-13 — Grok parent, NaN not wired

- Parents `019ff9a0`, `019ff9be`, `019ff9d6`, `019ffb99` on **`grok-4.6`**.
- Migration session last summary: `401 is NaN rejecting grok.com token; set NAN_API_KEY`.
- Bootstrap objectives recorded critics as `deepseek-v4-flash-0731`.

### 2026-08-14 — SuperGrok handoff onto 0731

- Parent `019ffdda-1b40-7b90-91ae-cc7f3ad623b0` started 01:19 UTC as the main Gauntlet build (581 chat / 9098 messages).
- Ended 2026-08-15 05:34 UTC telling the operator to relaunch `orchestrator-deepseek --model deepseek-v4-flash-0731`.
- `HANDOFF.md` still records `to_model: deepseek-v4-flash-0731` (stale vs 0.9.4).

### 2026-08-15 — Overflow on 0731, then unsuffixed Flash

- `01a003eb`, `01a003f4` still `deepseek-v4-flash-0731`.
- From ~15:43 UTC parents switch to **`deepseek-v4-flash`** (`01a00617`, `01a006f8`, `01a007cd`, …).
- TIMING.md notes overflow continued 05:46 UTC; later work used the unsuffixed Flash id.

### 2026-08-16 — 0731 allowance exhausted (largest outage class)

NaN:

```text
API error (status 402 Payment Required):
deepseek-v4-flash-0731 allowance exhausted:
500,447,721 of 500,000,000 tokens used in the current period, 0 left.
```

Also seen as `500 monthly_cap_reached` with the same counter. Cluster 01:16–19:14 UTC, then drip through 18 Aug. Any role still bound to **0731** (old critic wrappers, leftover `--model` flags) hard-stopped.

Same day: first **`mimo-v2.5` 400 Invalid request** on builder-mimo sessions.

### 2026-08-17 — Transient Flash 403 (separate incident)

Documented in `docs/incidents/2026-08-17-gauntlet-nan-403.md`:

```text
HTTP 403: System error, please try again later.
```

Streamed as **assistant content** from `deepseek-v4-flash` (not 0731), turn marked completed. Follow-up probes with the same key succeeded → transient NaN gate, classified `TRANSIENT_PROVIDER_FAILURE` in `gauntlet/provider-failure-contract.md`.

0731 cap errors continue (`01a00f84` 11:38, `01a01012` 14:20). More MiMo 400s on 3v3 / player-indicator builders.

### 2026-08-18 — 0731 cap still firing; prompt-gate screenshot incident

- 02:43 and 22:17 UTC: 0731 `monthly_cap_reached`.
- Durable eval incident `2026-08-18T06-58-00-943Z-prompt_gate-acceptance-persistence-rejects-blank-screenshots` (`failure_class: prompt_contract`) — evidence contract, not a model 404.

### 2026-08-19 — 0731 removed from the key; first image 404s

| UTC | Class | Detail |
| --- | --- | --- |
| 12:48 | `invalid_model_name` | Critic launched as `deepseek-v4-flash-0731`: `Invalid model name passed in model=deepseek-v4-flash-0731` |
| 17:13–17:14 | `auth_failure` | NaN connector DB `FATAL: server login has been failing` on parent `01a019dc` and a MiMo child |
| 21:44, 22:17 | **`image_capability_mismatch`** | Parent `01a019dc` dies twice on image 404 |
| 22:15 | MiMo 400 | builder-gameplay `01a01c0f` |

0.9.4 routing already forbids 0731; leftover agent frontmatter / spawn args still used it.

### 2026-08-20 — screenshot day; 0731 401 “no access”; Flash image 404 kills overflow

| UTC | Class | Session / role |
| --- | --- | --- |
| 04:44 | parent start | `01a01d7c` `deepseek-v4-flash` — the screenshot tab |
| 04:54, 04:55, 05:38 | `model_unauthorized` | Critics still spawned as **0731**: `This API key does not have access to the requested model` |
| 09:25 | `auth_failure` | Parent Flash: connector `NoneType.get` + DB login fatal |
| 10:40–11:02 | MiMo 400 ×6 | BROWSER-CORE-EVIDENCE builder-gameplay + critic-mimo retries (`01a01eb3`, `01a01ec2`, `01a01eca`, `01a01ecf`, `01a01ed1`, `01a01ed5`) |
| 10:56 | 0731 401 again | `critic` retry `01a01ed0` (“Critic-flash retry BROWSER-CORE-EVIDENCE”) |
| **11:50, 11:59** | **image 404** | Parent dies after ARCH-DIFF-001-RUBRIC integration ACCEPT |

Board at death: PLAYABLE-1V1-PROFILE-EVALUATION accepted; horizon v7 `playable-1v1-browser-evidence` created; `next_objective_id: BROWSER-CORE-EVIDENCE`. Working tree left with unstaged `BROWSER-CORE-EVIDENCE` frame deletions (matches git status at the start of this diagnostic session).

This diagnostic session (`01a01f36`, `grok-4.6`) is a new parent; it is **not** the crashed overflow tab.

## Failure-class totals (retry_state, 13–20 Aug, empty retries excluded)

| Class | Count | Models |
| --- | ---: | --- |
| `quota_exhausted` | 23 | `deepseek-v4-flash-0731` only |
| `invalid_request_400` | 13 | `mimo-v2.5` builders/critics |
| `auth_failure` | 8 | Flash parent + 0731 + one MiMo connector |
| `image_capability_mismatch` | 4 | parent `deepseek-v4-flash` only |
| `model_unauthorized` | 4 | `deepseek-v4-flash-0731` critic |
| `invalid_model_name` | 1 | `deepseek-v4-flash-0731` |
| `http_499` | 1 | client abort |
| empty `retry_state` | 118 | noise / cancelled polls (13th:9, 14th:2, 15th:24, 16th:4, 17th:18, 18th:40, 19th:16, 20th:5) |

## Why the TUI shows `post_tool_use_failure` then `stop_failure`

Observed sequence on `01a01d7c`:

1. Orchestrator spawns `integration-reviewer-mimo` (vision-unknown but **not** the 404 source).
2. A background subagent completion injects into the parent (`<system-reminder> Background subagent 01a01ed0 … completed`).
3. Parent turn includes conversation images.
4. NaN Chat Completions for `deepseek-v4-flash` returns 404 “no endpoints support image input”.
5. Grok TUI classifies that as `retry_state` / `post_tool_use_failure`, retries once with “1 image left out”, still 404, then `stop_reason: error` / `stop_failure`.

Integration ACCEPT already existed in the transcript; the 404 did not reverse it. Persistence/bookkeeping of ARCH-DIFF-001-RUBRIC was interrupted mid-amend (`audit.json` staged, BROWSER-CORE-EVIDENCE frames unstaged).

## Capability matrix (as configured today)

From `gauntlet/models.json` (`gauntlet-models-v6`):

| Role | Model | `image_input` |
| --- | --- | --- |
| orchestrator | `grok-4.6` | not declared here; xAI parent **does** accept the screenshot (this diagnostic session) |
| orchestrator-deepseek | `deepseek-v4-flash` | **false** |
| critic / integration-reviewer | `deepseek-v4-flash` | **false** |
| critic-qwen / integration-reviewer-qwen | `qwen3.6` | unknown (do not assume) |
| critic-mimo / integration-reviewer-mimo / builder-gameplay | `mimo-v2.5` | unknown; currently failing with 400 on several turns |
| git-committer / aux | `gemma4` | unused for vision |

Contract rule: on `MODEL_CAPABILITY_MISMATCH`, preserve the pipeline step and reroute only to an **explicitly** image-capable independent model. If none is configured for that role, surface a human perceptual-review blocker. Do **not** convert the 404 into ACCEPT/RETRY/REJECT.

`compatible_fallback_agents` in scenario `MODEL-CAPABILITY-MISMATCH` is currently `[]` — there is no declared vision-capable NaN reviewer.

## What is not the cause

- Not `qwen3.6` or `gemma4`.
- Not a SuperGrok quota on `grok-4.6` in the screenshot tab (that tab is NaN DeepSeek).
- Not the ARCH-DIFF-001-RUBRIC critic/integration verdicts (both ACCEPT on MiMo).
- Not blank-screenshot prompt-gate (18 Aug, different class).
- Not Bedrock (all failing inference is `https://api.nan.builders/v1/chat/completions`).

## Operator actions

1. **Do not continue the dead overflow tab with images attached.** `/gauntlet-continue` on `deepseek-v4-flash` will 404 again if any image remains in context. Start a **text-only** overflow session, or parent on `grok-4.6` until SuperGrok budget allows.
2. **Never pass `--model deepseek-v4-flash-0731`.** It is deprecated in 0.9.4, allowance-exhausted, and now unauthorized / invalid on the key. Rewrite `gauntlet/state/HANDOFF.md` launch snippet to `deepseek-v4-flash`.
3. **Stop spawning primary `critic` / `integration-reviewer` while 0731 is still in leftover wrappers.** Today those spawns 401. Use `critic-qwen` / `critic-mimo` (independence vs builder still required). Session `01a01d7c` already did this for ARCH-DIFF-001-RUBRIC after Flash/0731 failed.
4. **Treat `mimo-v2.5` 400 as a separate NaN request-shape bug**, especially on BROWSER-CORE-EVIDENCE critic-mimo. If it keeps killing reviewers, use `critic-qwen` (`qwen3.6`) when independence allows.
5. **For perceptual / screenshot objectives (BROWSER-CORE-EVIDENCE, ARCH-DIFF-001), do not attach PNGs to a DeepSeek parent.** Route vision to `grok-4.6` or keep images on disk and cite paths in text.

## Evidence index

| Kind | ID / path |
| --- | --- |
| Screenshot overflow parent | `01a01d7c-3f3f-78f0-92cb-37a086a1d8cd` |
| Prior overflow parent with same 404 | `01a019dc-092a-70a1-8946-eaf6b3ce353e` |
| Original Groklong session | `019ffdda-1b40-7b90-91ae-cc7f3ad623b0` |
| 17 Aug Flash 403 writeup | `docs/incidents/2026-08-17-gauntlet-nan-403.md` |
| Capability contract | `gauntlet/model-capability-contract.md` |
| Routing | `gauntlet/models.json` |
| Eval scenario | `gauntlet/evals/scenarios/MODEL-CAPABILITY-MISMATCH.json` |
| This diagnostic parent | `01a01f36-7c45-7b70-ba5c-5bb4df658ab6` (`grok-4.6`) |
