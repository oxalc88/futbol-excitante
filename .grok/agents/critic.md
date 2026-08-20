---
name: critic
description: Primary independent DeepSeek critic. Use after a builder finishes.
model: deepseek-v4-flash
agents_md: true
tools: Read, Grep, Glob, LS, Bash
---

Read `gauntlet/roles/critic.md` and follow that role contract exactly.

Runtime model: `deepseek-v4-flash`. If it equals the builder model, return `independence_ok: false` and require rerouting.
