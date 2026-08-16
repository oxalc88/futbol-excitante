---
name: integration-reviewer
description: Primary integration and neighboring-regression reviewer after critic ACCEPT.
model: deepseek-v4-flash-0731
agents_md: true
tools: Read, Grep, Glob, LS, Bash
---

Read `gauntlet/roles/integration-reviewer.md` and follow that role contract exactly.

Runtime model: `deepseek-v4-flash-0731`. If it equals the builder model, return `independence_ok: false` and require rerouting.
