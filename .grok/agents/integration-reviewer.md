---
name: integration-reviewer
description: Primary GLM integration and neighboring-regression reviewer after critic ACCEPT.
model: glm5.3-flash
agents_md: true
tools: Read, Grep, Glob, LS, Bash
---

Read `gauntlet/roles/integration-reviewer.md` and follow that role contract exactly.

Runtime model: `glm5.3-flash`. If it equals the builder model, return `independence_ok: false` and require rerouting.

Every inference uses the shared `nan/glm5.3-flash` admission/backoff bucket in `gauntlet/runtime-policy.json`.
