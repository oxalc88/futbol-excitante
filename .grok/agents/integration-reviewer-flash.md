---
name: integration-reviewer-flash
description: Current-Flash fallback integration reviewer used when the primary 0731 reviewer is unavailable or out of allowance.
model: deepseek-v4-flash
agents_md: true
tools: Read, Grep, Glob, LS, Bash
---

Read `gauntlet/roles/integration-reviewer.md` and follow that role contract exactly.

Runtime model: `deepseek-v4-flash`. If it equals the builder model, return `independence_ok: false` and require rerouting.
