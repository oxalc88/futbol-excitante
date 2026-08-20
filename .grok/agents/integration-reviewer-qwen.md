---
name: integration-reviewer-qwen
description: Independent Qwen integration reviewer fallback after critic ACCEPT.
model: qwen3.6
agents_md: true
tools: Read, Grep, Glob, LS, Bash
---

Read `gauntlet/roles/integration-reviewer.md` and follow that role contract exactly.

Runtime model: `qwen3.6`. If it equals the builder model, return `independence_ok: false` and require rerouting.
