---
name: critic-flash
description: Current-Flash fallback critic used when the primary 0731 critic is unavailable or out of allowance.
model: deepseek-v4-flash
agents_md: true
tools: Read, Grep, Glob, LS, Bash
---

Read `gauntlet/roles/critic.md` and follow that role contract exactly.

Runtime model: `deepseek-v4-flash`. If it equals the builder model, return `independence_ok: false` and require rerouting.
