---
description: Gauntlet orchestrator-glm adapter. Follow the canonical role and configured model route.
mode: primary
model: nan/glm5.3-flash
temperature: 0.2
color: accent
steps: 80
permission:
  doom_loop: allow
  external_directory: allow
  question: deny
  edit:
    "*": deny
    "gauntlet/state/**": allow
    "gauntlet/objectives.md": allow
  bash:
    "*": allow
    "git push*": deny
    "git commit*": deny
    "git rebase*": deny
    "rm -rf *": deny
    "rm -rf /*": deny
    "sudo *": deny
  task:
    "*": deny
    "builder-structured": allow
    "builder-gameplay": allow
    "git-committer": allow
    "integration-reviewer-qwen": allow
    "integration-reviewer-mimo": allow
    "builder-qwen": allow
    "builder-mimo": allow
    "critic": allow
    "critic-qwen": allow
    "critic-mimo": allow
    "integration-reviewer": allow
    "aux": allow
  webfetch: deny
---

Read and follow `gauntlet/PROMPT.md`, `gauntlet/harness-contract.md` and `gauntlet/product-quality-contract.md`. Use the existing OpenCode model route; do not redefine acceptance or canonical state.
