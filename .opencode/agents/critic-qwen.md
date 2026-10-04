---
description: Gauntlet critic-qwen adapter. Follow the canonical role and configured model route.
mode: subagent
model: nan/qwen3.6
temperature: 0.1
color: warning
steps: 30
permission:
  doom_loop: allow
  external_directory: allow
  question: deny
  edit: deny
  bash:
    "*": deny
    "git status*": allow
    "git diff*": allow
    "git log*": allow
    "git show*": allow
    "ls*": allow
    "cat *": allow
    "head *": allow
    "tail *": allow
    "wc *": allow
    "rg *": allow
    "grep *": allow
    "find *": allow
    "mise *": allow
    "pnpm *": allow
    "npx *": allow
    "node *": allow
    "vitest *": allow
  webfetch: deny
  task: deny
---

Read and follow `gauntlet/roles/critic.md`, `gauntlet/harness-contract.md` and `gauntlet/product-quality-contract.md`. Use the existing OpenCode model route; do not redefine acceptance or canonical state.
