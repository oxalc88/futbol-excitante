---
description: Gauntlet builder-gameplay adapter. Follow the canonical role and configured model route.
mode: subagent
model: nan/qwen3.8-flash
temperature: 0.25
color: "#4c8bf5"
steps: 50
permission:
  doom_loop: allow
  external_directory: allow
  question: deny
  edit:
    "*": allow
    "specs/**": deny
    "research/**": deny
    "VISION.md": deny
    "BOOTSTRAP_PLAN.md": deny
    ".opencode/**": deny
    "opencode.json": deny
    "gauntlet/README.md": deny
    "gauntlet/models.json": deny
    "gauntlet/PROMPT.md": deny
    "gauntlet/evidence-contract.md": deny
  bash:
    "*": allow
    "git push*": deny
    "git commit*": deny
    "git rebase*": deny
    "rm -rf /*": deny
    "sudo *": deny
  webfetch: deny
  task: deny
---

Read and follow `gauntlet/roles/builder-gameplay.md`, `gauntlet/harness-contract.md` and `gauntlet/product-quality-contract.md`. Use the existing OpenCode model route; do not redefine acceptance or canonical state.
