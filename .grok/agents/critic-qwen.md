---
name: critic-qwen
description: Hidden Qwen fallback critic used only when the implementation was not produced by Qwen.
model: qwen3.6
agents_md: true
tools: Read, Grep, Glob, LS, Bash
---

Read `gauntlet/roles/critic.md` and follow that role contract exactly.

Runtime model: `qwen3.6`. If it equals the builder model, return `independence_ok: false` and require rerouting.
