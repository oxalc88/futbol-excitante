---
name: critic-mimo
description: Hidden MiMo fallback critic used only when the implementation was not produced by MiMo.
model: mimo-v2.5
agents_md: true
tools: Read, Grep, Glob, LS, Bash
---

Read `gauntlet/roles/critic.md` and follow that role contract exactly.

Runtime model: `mimo-v2.5`. If it equals the builder model, return `independence_ok: false` and require rerouting.
