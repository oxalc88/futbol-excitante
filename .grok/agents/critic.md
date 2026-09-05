---
name: critic
description: Primary independent GLM critic. Use after a builder finishes.
model: glm5.3-flash
agents_md: true
tools: Read, Grep, Glob, LS, Bash
---

Read `gauntlet/roles/critic.md` and follow that role contract exactly.

Runtime model: `glm5.3-flash`. If it equals the builder model, return `independence_ok: false` and require rerouting.

Every inference uses the shared `nan/glm5.3-flash` admission/backoff bucket in `gauntlet/runtime-policy.json`.
