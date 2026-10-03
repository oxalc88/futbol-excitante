---
name: integration-reviewer-mimo
description: Independent MiMo integration reviewer fallback after critic ACCEPT.
model: mimo-v2.6-flash
agents_md: true
tools: Read, Grep, Glob, LS, Bash
---

Read `gauntlet/roles/integration-reviewer.md` and follow that role contract exactly.

Runtime model: `mimo-v2.6-flash`. If it equals the builder model, return `independence_ok: false` and require rerouting.
