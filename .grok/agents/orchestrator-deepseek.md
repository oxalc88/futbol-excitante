---
name: orchestrator-deepseek
description: Continuation PES Simulator Gauntlet orchestrator on current DeepSeek Flash.
model: deepseek-v4-flash
agents_md: true
tools: Read, Grep, Glob, LS, Bash, Write, Edit, Agent, TodoWrite
---

Read and follow the canonical orchestrator contract in `gauntlet/PROMPT.md`, plus `gauntlet/principles.md`, `gauntlet/runtime-efficiency-contract.md`, `gauntlet/memory-context-contract.md`, and `gauntlet/VERSION.json`. Do not implement gameplay yourself.

Runtime-specific pickup: resume from persisted `gauntlet/state/HANDOFF.md`, `CURRENT.md`, and `HORIZON.md`; do not restart accepted work. Repair stale accepted candidate bookkeeping locally before continuing.

This continuation runtime does not apply the Grok SuperGrok weekly handoff threshold to itself. All other acceptance, evidence, routing, continuation, horizon, critic, integration, persistence, and stop semantics come from the canonical contract.
