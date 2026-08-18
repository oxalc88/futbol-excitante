#!/usr/bin/env python3
"""Read-only forensic extractor for PES Simulator Grok Build sessions.

The script reads Grok's append-only session store and writes only sanitized,
aggregate artifacts below analysis/grok-build-sessions/. It intentionally does
not copy prompts, conversations, tool output, endpoint URLs, or credentials.
"""

from __future__ import annotations

import csv
import bisect
import datetime as dt
import hashlib
import json
import math
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


REPO = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SESSION_STORE = Path.home() / ".grok" / "sessions"
START = dt.datetime.fromisoformat("2026-08-14T01:19:17+00:00")
CUTOFF = dt.datetime.fromisoformat("2026-08-18T04:52:46+00:00")

# Top-level Gauntlet continuations found by inspecting summary.json, titles,
# chat model IDs, child metadata, and the session ID recorded in TIMING.md.
PARENT_SESSION_IDS = {
    "019ffdda-1b40-7b90-91ae-cc7f3ad623b0",
    "01a003eb-913c-7852-98e0-8d40a0befc03",
    "01a003f4-87c6-7272-9862-ec96e12c4df2",
    "01a005b1-e45c-7203-bd4d-c2c48569ef0e",
    "01a005e5-baf3-7741-b6ad-b294bb028977",
    "01a00617-6615-7b33-b602-42448d96c29c",
    "01a006f8-fdd1-7be2-b304-5f321f04c2fb",
    "01a007cd-36da-7a33-953d-732ebbff0da7",
    "01a0081d-b393-7320-83f9-4b24e297030d",
    "01a008f4-5695-7811-a365-16219ca00a83",
    "01a00976-1039-7012-8979-deb31695400a",
    "01a00ae6-0a6f-7631-b4c6-8eb852e36c33",
    "01a00aef-0efd-71d3-9a67-ccd74de1f8e1",
    "01a00b87-ab36-7323-b222-e2220a1122e2",
    "01a00be4-52a6-7520-b555-e494029a4c5b",
    "01a00e2b-cb4a-7c50-a739-09a79d824530",
    "01a00ff2-6d45-7282-a90b-582c44b30b65",
    "01a012a4-7322-7c82-8b2d-6ff45639080c",
}

SECRET_PATTERNS = [
    re.compile(r"(?i)\b(authorization|proxy-authorization|cookie|set-cookie)\s*[:=]\s*\S+"),
    re.compile(r"(?i)\b(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)\s*[:=]\s*\S+"),
    re.compile(r"\b(?:sk|xai|ghp|github_pat|glpat|AKIA)[-_A-Za-z0-9]{12,}\b"),
    re.compile(r"https?://[^\s?]+\?[^\s]*(?:X-Amz-|Signature=|sig=|token=)[^\s]*", re.I),
]
HTTP_ERROR = re.compile(r"^HTTP\s+(?P<status>[45]\d\d):\s*(?P<message>.*)$", re.S)
OBJECTIVE_REGEX_CACHE: dict[tuple[str, ...], re.Pattern[str]] = {}


def parse_ts(value: Any) -> dt.datetime | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        # Grok updates use integer seconds while metadata often uses ms.
        if value > 10_000_000_000:
            value /= 1000
        return dt.datetime.fromtimestamp(value, tz=dt.timezone.utc)
    if isinstance(value, str):
        try:
            return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def iso(value: dt.datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def read_json(path: Path, default: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    try:
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                try:
                    item = json.loads(line)
                except json.JSONDecodeError:
                    # A concurrently appended trailing line is outside the fixed
                    # cutoff and is not treated as evidence.
                    continue
                if isinstance(item, dict):
                    rows.append(item)
    except OSError:
        pass
    return rows


def read_jsonl_head(path: Path, limit: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    try:
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                try:
                    item = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if isinstance(item, dict):
                    rows.append(item)
                    if len(rows) >= limit:
                        break
    except OSError:
        pass
    return rows


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="replace")).hexdigest()


def sanitize(value: str) -> str:
    result = value
    for pattern in SECRET_PATTERNS:
        result = pattern.sub("[REDACTED]", result)
    return result


def json_compact(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def strings_in(value: Any, *, include_keys: bool = False) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from strings_in(item, include_keys=include_keys)
    elif isinstance(value, dict):
        for key, item in value.items():
            if include_keys:
                yield str(key)
            yield from strings_in(item, include_keys=include_keys)


def content_text(record: dict[str, Any]) -> str:
    content = record.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, (dict, list)):
        return "".join(strings_in(content))
    return ""


def reasoning_text(record: dict[str, Any]) -> str:
    summary = record.get("summary")
    return "".join(strings_in(summary)) if isinstance(summary, (dict, list, str)) else ""


def tool_call_payload(record: dict[str, Any]) -> str:
    calls = record.get("tool_calls")
    return json_compact(calls) if isinstance(calls, list) and calls else ""


def record_content_size(record: dict[str, Any]) -> tuple[int, int]:
    text = content_text(record)
    return len(text), len(text.encode("utf-8", errors="replace"))


def record_serialized_size(record: dict[str, Any]) -> tuple[int, int]:
    text = json_compact(record)
    return len(text), len(text.encode("utf-8", errors="replace"))


def provider_for(model: str | None) -> str | None:
    if not model:
        return None
    if model.startswith("grok-"):
        return "xAI"
    # Configured through Grok Build's OpenAI-compatible chat-completions
    # backend. Hostname is deliberately not exported.
    return "custom-openai-compatible"


def normalized_model(model: str | None) -> str | None:
    return model or None


def role_from_subagent(agent: str | None) -> str:
    a = (agent or "").lower()
    if a.startswith("builder"):
        return "builder"
    if a.startswith("critic"):
        return "critic"
    if a.startswith("integration"):
        return "integration reviewer"
    if a == "git-committer":
        return "bookkeeping/committer"
    if a in {"aux", "general-purpose"}:
        return "auxiliary"
    return "auxiliary"


def request_agent(role: str, model: str | None, fallback: str | None) -> str:
    if role == "parent/orchestrator":
        return "orchestrator" if (model or "").startswith("grok-") else "orchestrator-deepseek"
    return fallback or "unknown"


def build_session_index() -> dict[str, Path]:
    result: dict[str, Path] = {}
    for group in SESSION_STORE.iterdir() if SESSION_STORE.exists() else []:
        if not group.is_dir():
            continue
        for session_dir in group.iterdir():
            if session_dir.is_dir() and (session_dir / "summary.json").exists():
                result.setdefault(session_dir.name, session_dir)
    return result


def collect_scope(index: dict[str, Path]) -> tuple[set[str], dict[str, dict[str, Any]]]:
    scoped = set(PARENT_SESSION_IDS)
    child_meta: dict[str, dict[str, Any]] = {}
    queue = list(PARENT_SESSION_IDS)
    while queue:
        sid = queue.pop()
        directory = index.get(sid)
        if not directory:
            continue
        for meta_path in (directory / "subagents").glob("*/meta.json"):
            meta = read_json(meta_path, {})
            child = meta.get("child_session_id")
            if not child:
                continue
            child_meta[child] = meta
            if child not in scoped:
                scoped.add(child)
                queue.append(child)
    return scoped, child_meta


def parse_history() -> tuple[set[str], dict[str, dict[str, Any]]]:
    text = (REPO / "gauntlet/state/HISTORY.md").read_text(encoding="utf-8")
    blocks = re.split(r"(?=^## Iteration \d+\s+—)", text, flags=re.M)
    known: set[str] = set()
    metadata: dict[str, dict[str, Any]] = {}
    for block in blocks:
        match = re.search(r"^- objective_id:[ \t]*([^\s]+)", block, re.M)
        if not match:
            continue
        objective = match.group(1).strip("` ")
        if objective == "-":
            continue
        known.add(objective)
        date_match = re.search(r"^## Iteration (\d+)\s+—\s+(\d{4}-\d{2}-\d{2})", block, re.M)
        result_match = re.search(r"^- result:\s*([^\n]+)", block, re.M)
        verdict_match = re.search(r"^- verdict:\s*([^\n]+)", block, re.M)
        integration_match = re.search(r"^- integration:\s*([^\n]+)", block, re.M)
        critic_retries = 0
        verdict = verdict_match.group(1) if verdict_match else ""
        retry_values = [int(v) for v in re.findall(r"retry\s+(\d+)", verdict, re.I)]
        if retry_values:
            critic_retries = max(retry_values)
        elif "after retry" in verdict.lower():
            critic_retries = 1
        integration = integration_match.group(1) if integration_match else ""
        integration_retries = max([int(v) for v in re.findall(r"retry\s+(\d+)", integration, re.I)] or [0])
        metadata[objective] = {
            "history_iteration": int(date_match.group(1)) if date_match else None,
            "history_date": date_match.group(2) if date_match else None,
            "final_result": result_match.group(1).strip() if result_match else "unknown",
            "critic_retries": critic_retries,
            "integration_retries": integration_retries,
            "first_pass": critic_retries == 0,
        }
    for path in [REPO / "gauntlet/state/HORIZON.md", REPO / "gauntlet/state/CURRENT.md"]:
        extra = path.read_text(encoding="utf-8")
        known.update(re.findall(r"(?m)^\s*- id:\s*([A-Z][A-Z0-9-]+)", extra))
        next_match = re.search(r"next_objective_id:\s*([A-Z][A-Z0-9-]+)", extra)
        if next_match:
            known.add(next_match.group(1))
    return known, metadata


def objective_mentions(text: str, known: set[str]) -> list[str]:
    # One compiled alternation avoids rescanning every request once per catalog
    # objective. Longest-first alternation prevents partial ID overlap.
    key = tuple(sorted(known, key=lambda value: (-len(value), value)))
    pattern = OBJECTIVE_REGEX_CACHE.get(key)
    if pattern is None:
        alternatives = "|".join(re.escape(value) for value in key)
        pattern = re.compile(rf"(?<![A-Z0-9-])(?:{alternatives})(?![A-Z0-9-])")
        OBJECTIVE_REGEX_CACHE[key] = pattern
    return [match.group(0) for match in pattern.finditer(text)]


def infer_session_objective(
    sid: str,
    directory: Path,
    summary: dict[str, Any],
    meta: dict[str, Any] | None,
    known: set[str],
) -> tuple[str | None, str]:
    fields = [summary.get("generated_title", ""), summary.get("session_summary", "")]
    if meta:
        fields.extend([meta.get("description", ""), meta.get("prompt", "")])
    mentions = objective_mentions("\n".join(str(v) for v in fields if v), known)
    if mentions:
        return mentions[0], "high"
    # Fallback to the first user prompt, without exporting its text.
    history = read_jsonl_head(directory / "chat_history.jsonl", 8)
    for record in history:
        if record.get("type") == "user":
            mentions = objective_mentions(content_text(record), known)
            if mentions:
                return mentions[0], "medium"
    return None, "unknown"


def update_time(update: dict[str, Any]) -> dt.datetime | None:
    params = update.get("params", {})
    meta = params.get("_meta", {}) if isinstance(params, dict) else {}
    return parse_ts(meta.get("agentTimestampMs") or update.get("timestamp"))


def event_time(event: dict[str, Any]) -> dt.datetime | None:
    return parse_ts(event.get("ts"))


def tool_details_from_updates(updates: list[dict[str, Any]], start: dt.datetime, end: dt.datetime) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for update in updates:
        when = update_time(update)
        if when is None or when < start or when >= end:
            continue
        params = update.get("params", {})
        meta = params.get("_meta", {}) if isinstance(params, dict) else {}
        if meta.get("updateType") != "ToolCall":
            continue
        body = params.get("update", {})
        tool_meta = body.get("_meta", {}).get("x.ai/tool", {}) if isinstance(body, dict) else {}
        raw = body.get("rawInput", {}) if isinstance(body, dict) else {}
        name = tool_meta.get("name") or tool_meta.get("kind") or "unknown"
        result.append({"name": name, "raw": raw if isinstance(raw, dict) else {}})
    return result


def classify_activity(
    role: str,
    tools: list[dict[str, Any]],
    immediately_after_child: bool,
    prior_error: bool,
) -> tuple[str, bool | None]:
    if role != "parent/orchestrator":
        return "role_work", None
    names = [str(tool.get("name", "")) for tool in tools]
    raw_text = "\n".join(json_compact(tool.get("raw", {})) for tool in tools)
    if prior_error:
        return "provider_error_recovery", True
    if "spawn_subagent" in names:
        return "strategic_decision", True
    if "get_command_or_subagent_output" in names or immediately_after_child:
        return "wait/result-processing", False
    if "HORIZON.md" in raw_text or "horizon" in raw_text.lower() and any(n in names for n in ["write", "search_replace"]):
        return "strategic_horizon_planning", True
    if any(term in raw_text for term in ["gauntlet/state/CURRENT.md", "gauntlet/state/HISTORY.md", "gauntlet:acceptance:persist"]):
        return "acceptance/bookkeeping", False
    if names and all(n in {"read_file", "grep", "run_terminal_command", "todo_write"} for n in names):
        if "git " in raw_text or "gauntlet:audit" in raw_text or "gauntlet:eval:state" in raw_text:
            return "acceptance/bookkeeping", False
    return "substantive_orchestration", None


def category_for_record(record: dict[str, Any], tool_name: str | None = None, tool_raw: dict[str, Any] | None = None) -> str:
    kind = record.get("type")
    text = content_text(record)
    lower = text.lower()
    raw_text = json_compact(tool_raw or {})
    combined = f"{raw_text}\n{text}"
    if kind == "system":
        return "system/harness instructions"
    if "agents.md" in lower or "<workspace_rules>" in lower or "agent rules" in lower:
        return "AGENTS/instructions"
    if "gauntlet/prompt.md" in combined.lower() or "canonical orchestration contract" in lower:
        return "Gauntlet canonical prompt"
    if re.search(r"gauntlet/state/(CURRENT|HORIZON|HANDOFF|HISTORY|TIMING)\.md", combined, re.I):
        return "CURRENT/HORIZON/HANDOFF/state"
    if re.search(r"(?:^|[\s\"'])specs/", combined, re.I):
        return "specs"
    if kind == "user" and record.get("synthetic_reason") == "subagent_completed":
        return "child-agent reports"
    if tool_name in {"get_command_or_subagent_output", "wait_for_subagents"}:
        if "critic" in lower:
            return "critic reports"
        if "integration" in lower:
            return "integration reports"
        return "child-agent reports"
    if "critic" in lower and ("verdict" in lower or "required_fixes" in lower):
        return "critic reports"
    if "integration" in lower and ("accept" in lower or "reject" in lower):
        return "integration reports"
    if tool_name == "run_terminal_command":
        cmd = raw_text.lower()
        if re.search(r"\b(vitest|pnpm (?:run )?(?:test|typecheck|build)|mise run|gauntlet:eval)\b", cmd):
            return "test output"
        if re.search(r"\bgit\s+(?:status|diff|log|show|rev-parse|branch|fetch|push|commit)\b", cmd):
            return "git output"
    if tool_name in {"read_file", "grep", "list_dir"}:
        pathish = raw_text.lower()
        if any(part in pathish for part in ["src/", "tests/", "scripts/", "package.json", "mise.toml"]):
            return "source-code reads"
    if kind == "tool_result":
        if re.search(r"\b(test files|tests\s+\d+|vitest|typecheck|exit:\s*[1-9])\b", lower):
            return "test output"
        if re.search(r"\b(commit|branch|working tree|diff --git|git status)\b", lower):
            return "git output"
        return "tool results"
    if kind in {"assistant", "reasoning", "user"}:
        return "historical conversation/turns"
    return "other"


def chat_generation_blocks(chat: list[dict[str, Any]]) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for index, record in enumerate(chat):
        if record.get("type") != "assistant":
            continue
        start = index - 1 if index > 0 and chat[index - 1].get("type") == "reasoning" else index
        blocks.append({"assistant_index": index, "context_end": start, "assistant": record})
    return blocks


def retry_markers(updates: list[dict[str, Any]]) -> list[tuple[dt.datetime, int, str]]:
    result = []
    for update in updates:
        body = update.get("params", {}).get("update", {})
        marker = body.get("event_name") or body.get("type") or body.get("kind")
        if marker != "retrying":
            continue
        when = update_time(update)
        if when:
            result.append((when, int(body.get("attempt") or 1), sanitize(str(body.get("reason") or "retry"))))
    return result


def turn_usage_aggregate(directory: Path) -> dict[str, int]:
    fields = [
        "inputTokens", "outputTokens", "totalTokens", "cachedReadTokens",
        "cacheCreationTokens", "reasoningTokens", "modelCalls", "apiDurationMs", "numTurns",
    ]
    totals = {field: 0 for field in fields}
    for update in read_jsonl(directory / "updates.jsonl"):
        when = update_time(update)
        if when is None or when > CUTOFF:
            continue
        body = update.get("params", {}).get("update", {})
        usage = body.get("usage") if isinstance(body, dict) else None
        if not isinstance(usage, dict):
            continue
        for field in fields:
            if isinstance(usage.get(field), (int, float)):
                totals[field] += int(usage[field])
    return totals


def extract_requests_for_session(
    sid: str,
    directory: Path,
    summary: dict[str, Any],
    meta: dict[str, Any] | None,
    known_objectives: set[str],
    session_objective: str | None,
    objective_confidence: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    events = [event for event in read_jsonl(directory / "events.jsonl") if (event_time(event) or CUTOFF) <= CUTOFF]
    updates = [update for update in read_jsonl(directory / "updates.jsonl") if (update_time(update) or CUTOFF) <= CUTOFF]
    signals = read_json(directory / "signals.json", {}) or {}
    role = "parent/orchestrator" if sid in PARENT_SESSION_IDS else role_from_subagent((meta or {}).get("subagent_type") or summary.get("agent_name"))
    chat = read_jsonl(directory / "chat_history.jsonl") if role == "parent/orchestrator" else []
    base_agent = (meta or {}).get("subagent_type") or summary.get("agent_name") or "unknown"
    parent_sid = None if sid in PARENT_SESSION_IDS else (meta or {}).get("parent_session_id") or summary.get("parent_session_id")
    compaction_count = int(signals.get("compactionCount") or 0)
    checkpoint_count = len(list((directory / "compaction_checkpoints").glob("*.json")))
    has_compaction = max(compaction_count, checkpoint_count) > 0

    timeline = sorted(
        [(event_time(event), event) for event in events if event_time(event)],
        key=lambda pair: pair[0],
    )
    timeline_times = [pair[0] for pair in timeline]
    update_timeline = sorted(
        [(update_time(update), update) for update in updates if update_time(update)],
        key=lambda pair: pair[0],
    )
    update_times = [pair[0] for pair in update_timeline]
    loops: list[dict[str, Any]] = []
    current_turn: dict[str, Any] = {}
    global_index = 0
    turn_sequence = -1
    for when, event in timeline:
        if event.get("type") == "turn_started":
            turn_sequence += 1
            current_turn = {
                "turn_sequence": turn_sequence,
                "prompt_id": None,
                "model": event.get("model_id"),
                "conversation_message_count": event.get("conversation_message_count"),
                "turn_number": event.get("turn_number"),
            }
        elif event.get("type") == "loop_started":
            loops.append({
                "timestamp_start_dt": when,
                "loop_index": event.get("loop_index"),
                "request_sequence": global_index,
                **current_turn,
            })
            global_index += 1

    # Prompt IDs and exact metering are attached to streamed session updates.
    token_updates: list[tuple[dt.datetime, int, str | None, str | None]] = []
    for update in updates:
        params = update.get("params", {})
        meta_update = params.get("_meta", {}) if isinstance(params, dict) else {}
        if meta_update.get("totalTokens") is None:
            continue
        when = update_time(update)
        if when:
            token_updates.append((when, int(meta_update["totalTokens"]), meta_update.get("promptId"), meta_update.get("updateType")))
    token_updates.sort(key=lambda row: row[0])
    token_times = [row[0] for row in token_updates]

    blocks = chat_generation_blocks(chat)
    # Current chat_history is rewritten by compaction. In uncompacted sessions,
    # assistant blocks are append-only: a fixed-cutoff extraction can safely map
    # the first N blocks even if the live session later appended more blocks.
    # Full category reconstruction is intentionally scoped to orchestrators,
    # the population for which context repetition is the study's priority.
    # Child request token meters remain complete without duplicating their text.
    chat_exact = role == "parent/orchestrator" and not has_compaction and len(blocks) >= max(0, len(loops) - 1)
    if chat_exact and len(blocks) < len(loops):
        # The final loop is in flight at the cutoff.
        blocks = blocks + [None]  # type: ignore[list-item]

    retries = retry_markers(updates)
    child_completion_times: list[dt.datetime] = []
    for update in updates:
        body = update.get("params", {}).get("update", {})
        if body.get("status") in {"completed", "failed"} and body.get("child_session_id"):
            when = update_time(update)
            if when:
                child_completion_times.append(when)

    request_rows: list[dict[str, Any]] = []
    context_rows: list[dict[str, Any]] = []
    error_rows: list[dict[str, Any]] = []
    prior_context_tokens: int | None = None
    prior_context_categories: dict[str, int] = {}
    prior_failed = False
    cumulative_tools = 0
    current_objective = session_objective
    between_objectives = False

    for position, loop in enumerate(loops):
        start = loop["timestamp_start_dt"]
        next_start = loops[position + 1]["timestamp_start_dt"] if position + 1 < len(loops) else CUTOFF + dt.timedelta(microseconds=1)
        event_lo = bisect.bisect_left(timeline_times, start)
        event_hi = bisect.bisect_left(timeline_times, next_start)
        interval_events = timeline[event_lo:event_hi]
        update_lo = bisect.bisect_left(update_times, start)
        update_hi = bisect.bisect_left(update_times, next_start)
        interval_updates = [update for _, update in update_timeline[update_lo:update_hi]]
        end_candidates = [when for when, event in interval_events if event.get("type") in {"tool_started", "turn_ended"}]
        end = min(end_candidates) if end_candidates else None
        if end and end > CUTOFF:
            end = None
        first_token_candidates = [when for when, event in interval_events if event.get("type") == "first_token"]
        first_token = min(first_token_candidates) if first_token_candidates else None
        tool_events = [event for _, event in interval_events if event.get("type") == "tool_started"]
        tools_from_events = [event.get("tool_name") or "unknown" for event in tool_events]
        details = tool_details_from_updates(interval_updates, start, next_start)
        if not details and tools_from_events:
            details = [{"name": name, "raw": {}} for name in tools_from_events]

        meter_lo = bisect.bisect_left(token_times, start)
        meter_hi = bisect.bisect_left(token_times, next_start)
        meter = token_updates[meter_lo:meter_hi]
        context_before = meter[0][1] if meter else None
        context_after_generation = max((item[1] for item in meter), default=None)
        completion_est = None
        if context_before is not None and context_after_generation is not None:
            completion_est = max(0, context_after_generation - context_before)
        prompt_id = next((item[2] for item in meter if item[2]), loop.get("prompt_id"))

        block = blocks[position] if chat_exact and position < len(blocks) else None
        context_records: list[dict[str, Any]] | None = None
        assistant: dict[str, Any] | None = None
        if block:
            context_records = chat[: block["context_end"]]
            assistant = block["assistant"]
        model = normalized_model((assistant or {}).get("model_id") or loop.get("model") or (meta or {}).get("effective_model_id") or summary.get("current_model_id"))
        agent = request_agent(role, model, base_agent)

        content_chars = content_bytes = serialized_chars = serialized_bytes = None
        record_count = tool_context_count = tool_args_chars = reasoning_chars = None
        context_hash = None
        category_sizes: dict[str, dict[str, int]] = {}
        if context_records is not None:
            content_chars = sum(record_content_size(record)[0] for record in context_records)
            content_bytes = sum(record_content_size(record)[1] for record in context_records)
            serialized_chars = sum(record_serialized_size(record)[0] for record in context_records)
            serialized_bytes = sum(record_serialized_size(record)[1] for record in context_records)
            record_count = len(context_records)
            tool_context_count = sum(len(record.get("tool_calls") or []) for record in context_records)
            tool_args_chars = sum(len(tool_call_payload(record)) for record in context_records)
            reasoning_chars = sum(len(reasoning_text(record)) for record in context_records)
            context_hash = sha256_text("\n".join(sha256_text(json_compact(record)) for record in context_records))

            call_by_id: dict[str, tuple[str, dict[str, Any]]] = {}
            for record in context_records:
                if record.get("type") == "assistant":
                    for call in record.get("tool_calls") or []:
                        call_id = call.get("id")
                        fn = call.get("function", {})
                        name = fn.get("name") or call.get("name") or "unknown"
                        arguments = fn.get("arguments") or call.get("arguments") or {}
                        if isinstance(arguments, str):
                            try:
                                arguments = json.loads(arguments)
                            except json.JSONDecodeError:
                                arguments = {"opaque_args_chars": len(arguments)}
                        if call_id:
                            call_by_id[call_id] = (name, arguments if isinstance(arguments, dict) else {})
            for record in context_records:
                linked_name = None
                linked_raw = None
                if record.get("type") == "tool_result":
                    linked_name, linked_raw = call_by_id.get(record.get("tool_call_id"), (None, None))
                category = category_for_record(record, linked_name, linked_raw)
                c_chars, c_bytes = record_content_size(record)
                # Tool arguments and reasoning summaries are reported separately
                # but included in the category's structural size.
                structural = 0
                if record.get("type") == "assistant":
                    structural = len(tool_call_payload(record))
                elif record.get("type") == "reasoning":
                    structural = len(reasoning_text(record))
                bucket = category_sizes.setdefault(category, {"characters": 0, "bytes": 0, "structural_characters": 0})
                bucket["characters"] += c_chars
                bucket["bytes"] += c_bytes
                bucket["structural_characters"] += structural

        emitted_calls = len((assistant or {}).get("tool_calls") or []) if assistant is not None else len(tools_from_events)
        emitted_names = []
        if assistant:
            for call in assistant.get("tool_calls") or []:
                emitted_names.append(call.get("function", {}).get("name") or call.get("name") or "unknown")
        if not emitted_names:
            emitted_names = tools_from_events
        immediately_after_child = any(dt.timedelta(0) <= start - when <= dt.timedelta(seconds=3) for when in child_completion_times)

        activity, decision = classify_activity(role, details, immediately_after_child, prior_failed)
        raw_for_objective = "\n".join(json_compact(tool.get("raw", {})) for tool in details)
        req_mentions = objective_mentions(raw_for_objective, known_objectives)
        unique_mentions = list(dict.fromkeys(req_mentions))
        tool_names = {str(tool.get("name", "")) for tool in details}
        horizon_transition = role == "parent/orchestrator" and len(unique_mentions) > 1 and (
            "todo_write" in tool_names or "horizon" in raw_for_objective.lower()
        )
        if horizon_transition:
            activity = "strategic_horizon_planning"
            decision = True
            current_objective = None
            between_objectives = True
        elif len(unique_mentions) == 1:
            current_objective = unique_mentions[0]
            between_objectives = False
        objective = None if between_objectives else current_objective
        confidence = "high" if len(unique_mentions) == 1 else ("medium" if objective else "unknown")

        error_message = None
        http_status = None
        error_type = None
        success: bool | None = None if end is None else True
        if assistant and isinstance(assistant.get("content"), str):
            match = HTTP_ERROR.match(assistant["content"].strip())
            if match:
                success = False
                http_status = int(match.group("status"))
                error_type = "provider_http_error"
                error_message = sanitize(assistant["content"].strip())
        if error_message is None:
            streamed_chunks: list[str] = []
            for update in interval_updates:
                when = update_time(update)
                if when is None:
                    continue
                params = update.get("params", {})
                if params.get("_meta", {}).get("updateType") != "AgentMessageChunk":
                    continue
                body = params.get("update", {})
                content = body.get("content") if isinstance(body, dict) else None
                if isinstance(content, str):
                    streamed_chunks.append(content)
                elif isinstance(content, dict) and isinstance(content.get("text"), str):
                    streamed_chunks.append(content["text"])
            streamed_text = "".join(streamed_chunks).strip()
            match = HTTP_ERROR.match(streamed_text)
            if match:
                success = False
                http_status = int(match.group("status"))
                error_type = "provider_http_error"
                error_message = sanitize(streamed_text)
        retry_number = max([attempt for when, attempt, _ in retries if start <= when < next_start] or [0])
        if retry_number:
            error_type = error_type or "provider_retry"

        compaction_happened = False
        compaction_before = compaction_after = None
        if prior_context_tokens and context_before is not None and context_before < prior_context_tokens * 0.80:
            compaction_happened = True
            compaction_before = prior_context_tokens
            compaction_after = context_before

        repeated_tokens = repeated_pct = None
        if prior_context_tokens is not None and context_before:
            repeated_tokens = min(prior_context_tokens, context_before)
            repeated_pct = round(100 * repeated_tokens / context_before, 4)

        request_key = f"{sid}:{loop['request_sequence']:05d}"
        row = {
            "request_key": request_key,
            "timestamp_start": iso(start),
            "timestamp_first_token": iso(first_token),
            "timestamp_end": iso(end),
            "duration_ms": int((end - start).total_seconds() * 1000) if end else None,
            "session_id": sid,
            "parent_session_id": parent_sid,
            "request_id": prompt_id,
            "provider_request_id": None,
            "request_sequence": loop["request_sequence"],
            "turn_sequence": loop.get("turn_sequence"),
            "loop_index": loop.get("loop_index"),
            "agent": agent,
            "role": role,
            "model": model,
            "provider": provider_for(model),
            "api_backend": "chat_completions" if model and not model.startswith("grok-") else "responses/unknown",
            "gauntlet_objective_id": objective,
            "objective_attribution_confidence": confidence,
            "prompt_input_tokens": context_before,
            "completion_output_tokens": completion_est,
            "total_tokens": (context_before + completion_est) if context_before is not None and completion_est is not None else None,
            "token_measurement": "grok_context_meter_at_generation_start; completion_delta_estimate",
            "context_window_tokens_before": context_before,
            "context_window_tokens_after": context_after_generation,
            "record_count": record_count,
            "tool_calls_in_context": tool_context_count,
            "tool_calls_emitted": emitted_calls,
            "tool_names_emitted": emitted_names,
            "context_content_characters": content_chars,
            "context_content_bytes": content_bytes,
            "context_serialized_characters": serialized_chars,
            "context_serialized_bytes": serialized_bytes,
            "tool_argument_characters_in_context": tool_args_chars,
            "reasoning_summary_characters_in_context": reasoning_chars,
            "context_sha256": context_hash,
            "reasoning_effort": summary.get("reasoning_effort") or ("high" if model == "deepseek-v4-flash" and role == "parent/orchestrator" else None),
            "cache_hit": None,
            "cached_read_tokens": None,
            "cache_creation_tokens": None,
            "compaction_happened": compaction_happened,
            "compaction_size_before_tokens": compaction_before,
            "compaction_size_after_tokens": compaction_after,
            "retry_number": retry_number,
            "http_provider_status": http_status,
            "error_type": error_type,
            "success": success,
            "immediately_after_child_finished": immediately_after_child,
            "activity_class": activity,
            "new_decision_high_confidence": decision,
            "repeated_context_tokens_estimate": repeated_tokens,
            "repeated_context_percentage_estimate": repeated_pct,
            "context_reconstruction": "exact_current_chat_prefix" if context_records is not None else ("unavailable_after_compaction" if has_compaction else "unavailable/in_flight"),
        }
        request_rows.append(row)

        if category_sizes:
            total_category_chars = sum(v["characters"] + v["structural_characters"] for v in category_sizes.values())
            for category, sizes in sorted(category_sizes.items()):
                category_chars = sizes["characters"] + sizes["structural_characters"]
                prior_chars = prior_context_categories.get(category, 0)
                repeated_chars = min(prior_chars, category_chars)
                context_rows.append({
                    "request_key": request_key,
                    "timestamp_start": iso(start),
                    "session_id": sid,
                    "agent": agent,
                    "role": role,
                    "model": model,
                    "gauntlet_objective_id": objective,
                    "category": category,
                    "content_characters": sizes["characters"],
                    "structural_characters": sizes["structural_characters"],
                    "total_characters": category_chars,
                    "bytes": sizes["bytes"],
                    "estimated_tokens_chars_div_4": round(category_chars / 4),
                    "percentage_of_classified_characters": round(100 * category_chars / total_category_chars, 4) if total_category_chars else None,
                    "repeated_characters_vs_previous_estimate": repeated_chars,
                    "repeated_percentage_vs_previous_estimate": round(100 * repeated_chars / category_chars, 4) if category_chars else None,
                    "content_sha256": sha256_text(f"{request_key}:{category}:{category_chars}:{sizes['bytes']}"),
                    "estimate_note": "Token estimate is characters/4; not provider tokenization. Repetition is bounded by previous category size.",
                })
            prior_context_categories = {category: values["characters"] + values["structural_characters"] for category, values in category_sizes.items()}

        if error_type:
            error_rows.append({
                "error_id": sha256_text(f"{request_key}:{error_type}:{error_message or retry_number}")[:20],
                "timestamp": iso(end or start),
                "session_id": sid,
                "parent_session_id": parent_sid,
                "request_key": request_key,
                "agent": agent,
                "role": role,
                "model": model,
                "gauntlet_objective_id": objective,
                "layer": "provider",
                "http_status": http_status,
                "error_type": error_type,
                "sanitized_message": error_message or "provider retry marker",
                "retry_number": retry_number,
                "harness_turn_outcome": "completed/end_turn" if http_status == 502 and sid == "01a012a4-7322-7c82-8b2d-6ff45639080c" else None,
                "source_reference": f"~/.grok/sessions/<encoded-cwd>/{sid}/chat_history.jsonl",
            })
        prior_failed = success is False
        if context_before is not None:
            prior_context_tokens = context_before
        cumulative_tools += emitted_calls

    # Harness/tool failures are retained without raw command/output payloads.
    for when, event in timeline:
        if event.get("type") != "tool_completed" or event.get("outcome") in {None, "success"}:
            continue
        error_rows.append({
            "error_id": sha256_text(f"{sid}:{iso(when)}:{event.get('tool_call_id')}:{event.get('outcome')}")[:20],
            "timestamp": iso(when),
            "session_id": sid,
            "parent_session_id": parent_sid,
            "request_key": None,
            "agent": base_agent,
            "role": role,
            "model": summary.get("current_model_id"),
            "gauntlet_objective_id": session_objective,
            "layer": "tool/harness",
            "http_status": None,
            "error_type": "tool_failure",
            "sanitized_message": f"{event.get('tool_name', 'unknown')} outcome={event.get('outcome')}",
            "retry_number": None,
            "harness_turn_outcome": None,
            "source_reference": f"~/.grok/sessions/<encoded-cwd>/{sid}/events.jsonl",
        })

    if meta and meta.get("status") == "failed":
        raw_error = sanitize(str(meta.get("error") or "subagent failed"))
        status_match = re.search(r"status\s+(\d{3})|\b([45]\d\d)\b", raw_error, re.I)
        status = int(next(group for group in status_match.groups() if group)) if status_match else None
        error_rows.append({
            "error_id": sha256_text(f"{sid}:meta:{raw_error}")[:20],
            "timestamp": meta.get("completed_at"),
            "session_id": sid,
            "parent_session_id": parent_sid,
            "request_key": None,
            "agent": base_agent,
            "role": role,
            "model": meta.get("effective_model_id") or summary.get("current_model_id"),
            "gauntlet_objective_id": session_objective,
            "layer": "subagent/harness",
            "http_status": status,
            "error_type": "subagent_failed",
            "sanitized_message": raw_error[:500],
            "retry_number": None,
            "harness_turn_outcome": meta.get("status"),
            "source_reference": f"~/.grok/sessions/<encoded-cwd>/{parent_sid}/subagents/{sid}/meta.json",
        })
    return request_rows, context_rows, error_rows


def csv_value(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (list, dict)):
        return json_compact(value)
    return value


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str] | None = None) -> None:
    if fields is None:
        fields = list(rows[0].keys()) if rows else []
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: csv_value(row.get(field)) for field in fields})


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json_compact(row) + "\n")


def percentile(values: list[int], p: float) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, math.ceil(p * len(ordered)) - 1))
    return ordered[index]


def main() -> None:
    index = build_session_index()
    scoped, child_meta = collect_scope(index)
    known_objectives, history_meta = parse_history()
    session_info: dict[str, dict[str, Any]] = {}
    all_requests: list[dict[str, Any]] = []
    all_context: list[dict[str, Any]] = []
    all_errors: list[dict[str, Any]] = []

    for sid in sorted(scoped):
        directory = index.get(sid)
        if not directory:
            continue
        summary = read_json(directory / "summary.json", {}) or {}
        created = parse_ts(summary.get("created_at"))
        if created and (created < START or created > CUTOFF):
            continue
        meta = child_meta.get(sid)
        objective, confidence = infer_session_objective(sid, directory, summary, meta, known_objectives)
        requests, context, errors = extract_requests_for_session(
            sid, directory, summary, meta, known_objectives, objective, confidence
        )
        usage = turn_usage_aggregate(directory)
        all_requests.extend(requests)
        all_context.extend(context)
        all_errors.extend(errors)
        role = "parent/orchestrator" if sid in PARENT_SESSION_IDS else role_from_subagent((meta or {}).get("subagent_type") or summary.get("agent_name"))
        session_info[sid] = {
            "session_id": sid,
            "parent_session_id": None if sid in PARENT_SESSION_IDS else (meta or {}).get("parent_session_id") or summary.get("parent_session_id"),
            "agent": "orchestrator/mixed" if sid in PARENT_SESSION_IDS else ((meta or {}).get("subagent_type") or summary.get("agent_name") or "unknown"),
            "role": role,
            "model_routes": sorted({row["model"] for row in requests if row.get("model")}),
            "gauntlet_objective_ids": sorted({row["gauntlet_objective_id"] for row in requests if row.get("gauntlet_objective_id")} or ({objective} if objective else set())),
            "objective_attribution_confidence": confidence,
            "timestamp_start": min((row["timestamp_start"] for row in requests), default=summary.get("created_at")),
            "timestamp_end": max((row["timestamp_end"] or row["timestamp_start"] for row in requests), default=min(summary.get("updated_at") or iso(CUTOFF), iso(CUTOFF))),
            "duration_ms": (meta or {}).get("duration_ms"),
            "status": (meta or {}).get("status") or ("active_at_cutoff" if (parse_ts(summary.get("updated_at")) or START) >= CUTOFF - dt.timedelta(minutes=15) else "completed/closed"),
            "model_requests": len(requests),
            "prompt_tokens_processed": sum(row.get("prompt_input_tokens") or 0 for row in requests),
            "completion_tokens_estimate": sum(row.get("completion_output_tokens") or 0 for row in requests),
            "turn_usage_input_tokens": usage["inputTokens"],
            "turn_usage_output_tokens": usage["outputTokens"],
            "turn_usage_total_tokens": usage["totalTokens"],
            "turn_usage_cached_read_tokens": usage["cachedReadTokens"],
            "turn_usage_cache_creation_tokens": usage["cacheCreationTokens"],
            "turn_usage_reasoning_tokens": usage["reasoningTokens"],
            "turn_usage_model_calls": usage["modelCalls"],
            "turn_usage_api_duration_ms": usage["apiDurationMs"],
            "turn_usage_scope": "turn-level aggregate; not safely allocatable to individual request rows",
            "tool_calls_emitted": sum(row.get("tool_calls_emitted") or 0 for row in requests),
            "provider_errors": sum(row.get("success") is False for row in requests),
            "tool_or_harness_errors": sum(error.get("session_id") == sid and error.get("layer") != "provider" for error in errors),
            "compactions_detected": sum(bool(row.get("compaction_happened")) for row in requests),
            "context_peak_tokens": max((row.get("context_window_tokens_before") or 0 for row in requests), default=0),
            "context_median_tokens": round(statistics.median([row["context_window_tokens_before"] for row in requests if row.get("context_window_tokens_before") is not None])) if any(row.get("context_window_tokens_before") is not None for row in requests) else None,
            "context_p95_tokens": percentile([row["context_window_tokens_before"] for row in requests if row.get("context_window_tokens_before") is not None], 0.95),
            "source_path": f"~/.grok/sessions/<encoded-cwd>/{sid}/",
        }

    all_requests.sort(key=lambda row: (row["timestamp_start"], row["session_id"], row["request_sequence"]))
    all_context.sort(key=lambda row: (row["timestamp_start"], row["request_key"], row["category"]))
    # Stable de-duplication retains separate request/tool/meta evidence while
    # removing exact duplicate rows generated from mirrored metadata.
    deduped_errors: list[dict[str, Any]] = []
    seen_errors: set[str] = set()
    for error in sorted(all_errors, key=lambda row: (row.get("timestamp") or "", row["error_id"])):
        if error["error_id"] not in seen_errors:
            deduped_errors.append(error)
            seen_errors.add(error["error_id"])
    all_errors = deduped_errors

    session_rows = sorted(session_info.values(), key=lambda row: (row["timestamp_start"] or "", row["session_id"]))

    objective_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for request in all_requests:
        if request.get("gauntlet_objective_id"):
            objective_groups[request["gauntlet_objective_id"]].append(request)
    objective_rows: list[dict[str, Any]] = []
    for objective in sorted(objective_groups, key=lambda key: min(row["timestamp_start"] for row in objective_groups[key])):
        rows = objective_groups[objective]
        starts = [parse_ts(row["timestamp_start"]) for row in rows]
        ends = [parse_ts(row["timestamp_end"] or row["timestamp_start"]) for row in rows]
        starts = [value for value in starts if value]
        ends = [value for value in ends if value]
        by_role = defaultdict(list)
        for row in rows:
            by_role[row["role"]].append(row)
        def role_sum(role: str, field: str) -> int:
            return sum(row.get(field) or 0 for row in by_role.get(role, []))
        hist = history_meta.get(objective, {})
        models = sorted({f"{row['role']}:{row['model']}" for row in rows if row.get("model")})
        objective_rows.append({
            "objective_id": objective,
            "timestamp_start": iso(min(starts)) if starts else None,
            "timestamp_end": iso(max(ends)) if ends else None,
            "total_wall_time_ms": int((max(ends) - min(starts)).total_seconds() * 1000) if starts and ends else None,
            "parent_orchestrator_requests": len(by_role.get("parent/orchestrator", [])),
            "parent_orchestrator_prompt_tokens": role_sum("parent/orchestrator", "prompt_input_tokens"),
            "parent_orchestrator_completion_tokens_estimate": role_sum("parent/orchestrator", "completion_output_tokens"),
            "builder_requests": len(by_role.get("builder", [])),
            "builder_prompt_tokens": role_sum("builder", "prompt_input_tokens"),
            "critic_requests": len(by_role.get("critic", [])),
            "critic_prompt_tokens": role_sum("critic", "prompt_input_tokens"),
            "integration_requests": len(by_role.get("integration reviewer", [])),
            "integration_prompt_tokens": role_sum("integration reviewer", "prompt_input_tokens"),
            "auxiliary_requests": len(by_role.get("auxiliary", [])),
            "auxiliary_prompt_tokens": role_sum("auxiliary", "prompt_input_tokens"),
            "committer_requests": len(by_role.get("bookkeeping/committer", [])),
            "committer_prompt_tokens": role_sum("bookkeeping/committer", "prompt_input_tokens"),
            "total_processed_prompt_tokens": sum(row.get("prompt_input_tokens") or 0 for row in rows),
            "total_completion_tokens_estimate": sum(row.get("completion_output_tokens") or 0 for row in rows),
            "total_processed_tokens": sum(row.get("total_tokens") or 0 for row in rows),
            "critic_retries": hist.get("critic_retries"),
            "integration_retries": hist.get("integration_retries"),
            "provider_failures": sum(row.get("success") is False for row in rows),
            "compactions": sum(bool(row.get("compaction_happened")) for row in rows),
            "final_result": hist.get("final_result", "in_progress/unknown"),
            "first_pass": hist.get("first_pass"),
            "model_routing_used": models,
            "history_iteration": hist.get("history_iteration"),
            "timing_cross_reference": "TIMING.md row present" if objective in (REPO / "gauntlet/state/TIMING.md").read_text(encoding="utf-8") else "not present in TIMING.md",
            "attribution_note": "Parent attribution is heuristic outside child intervals; role-session objective IDs are high confidence when present in child metadata.",
        })

    request_fields = [
        "request_key", "timestamp_start", "timestamp_first_token", "timestamp_end", "duration_ms",
        "session_id", "parent_session_id", "request_id", "provider_request_id", "request_sequence",
        "turn_sequence", "loop_index", "agent", "role", "model", "provider", "api_backend",
        "gauntlet_objective_id", "objective_attribution_confidence", "prompt_input_tokens",
        "completion_output_tokens", "total_tokens", "token_measurement", "context_window_tokens_before",
        "context_window_tokens_after", "record_count", "tool_calls_in_context", "tool_calls_emitted",
        "tool_names_emitted", "context_content_characters", "context_content_bytes",
        "context_serialized_characters", "context_serialized_bytes", "tool_argument_characters_in_context",
        "reasoning_summary_characters_in_context", "context_sha256", "reasoning_effort", "cache_hit",
        "cached_read_tokens", "cache_creation_tokens", "compaction_happened",
        "compaction_size_before_tokens", "compaction_size_after_tokens", "retry_number",
        "http_provider_status", "error_type", "success", "immediately_after_child_finished",
        "activity_class", "new_decision_high_confidence", "repeated_context_tokens_estimate",
        "repeated_context_percentage_estimate", "context_reconstruction",
    ]
    write_csv(OUT / "requests.csv", all_requests, request_fields)
    write_jsonl(OUT / "requests.jsonl", all_requests)
    write_csv(OUT / "sessions.csv", session_rows)
    write_csv(OUT / "objectives.csv", objective_rows)
    write_csv(OUT / "context-breakdown.csv", all_context)
    write_csv(OUT / "errors.csv", all_errors)

    manifest = {
        "generated_at": iso(dt.datetime.now(dt.timezone.utc)),
        "analysis_start": iso(START),
        "analysis_cutoff": iso(CUTOFF),
        "sessions_analyzed": len(session_rows),
        "model_requests_analyzed": len(all_requests),
        "context_breakdown_rows": len(all_context),
        "errors_observed": len(all_errors),
        "objectives_attributed": len(objective_rows),
        "source_session_ids_sha256": sha256_text("\n".join(sorted(session_info))),
    }
    (OUT / "dataset-manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
