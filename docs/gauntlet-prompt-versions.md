# Gauntlet prompt versions

This file is a human-readable index of meaningful Gauntlet orchestration prompt versions.

Git remains the source of truth for the exact prompt text. Do not copy historical prompts back into the live Gauntlet state files. This document is not written or maintained by the running Gauntlet.

## Version history

| Version | Baseline commit | Meaning |
|---|---|---|
| `v1-global-replan` | `8d04d6240556e94f6e7fff0cf829e4acaf34aec1` | Original orchestration: after each accepted objective, inspect/reassess the project globally and choose the next highest-value objective. |
| `v2-rolling-horizon` | `0e7755006d21e7ff7cda264c461ec8e2e736505d` | Rolling planning horizon: strategic reassessment only at startup/handoff/horizon exhaustion or material invalidation; execute roughly 4–8 planned objectives between assessments. |

`v2-rolling-horizon` was introduced by commit `7886a88ea0edeb677f2d261c001725d56ade9896` and merged to `main` by `0e7755006d21e7ff7cda264c461ec8e2e736505d`.

## Files that define orchestration behavior

When comparing versions, inspect these together rather than only `gauntlet/PROMPT.md`:

- `gauntlet/PROMPT.md`
- `.grok/agents/orchestrator.md`
- `.grok/agents/orchestrator-deepseek.md`
- `.grok/skills/gauntlet/SKILL.md`
- `.grok/skills/gauntlet-continue/SKILL.md`
- `AGENTS.md`
- `gauntlet/state/HORIZON.md` (introduced in v2)

The running Gauntlet may update `gauntlet/state/CURRENT.md`, `HISTORY.md`, `TIMING.md`, `HANDOFF.md`, and `HORIZON.md`; those files are execution state, not the immutable prompt-version record.

## Exact before/after

Show the main prompt before rolling horizons:

```bash
git show 8d04d6240556e94f6e7fff0cf829e4acaf34aec1:gauntlet/PROMPT.md
```

Show the v2 prompt as first merged to `main`:

```bash
git show 0e7755006d21e7ff7cda264c461ec8e2e736505d:gauntlet/PROMPT.md
```

Compare the complete orchestration surface:

```bash
git diff 8d04d6240556e94f6e7fff0cf829e4acaf34aec1..0e7755006d21e7ff7cda264c461ec8e2e736505d -- \
  gauntlet/PROMPT.md \
  .grok/agents/orchestrator.md \
  .grok/agents/orchestrator-deepseek.md \
  .grok/skills/gauntlet/SKILL.md \
  .grok/skills/gauntlet-continue/SKILL.md \
  AGENTS.md \
  gauntlet/state/HORIZON.md
```

## Rule for future versions

Create a new version entry here only for a meaningful change in orchestration semantics, role responsibilities, model-routing semantics, evidence/acceptance rules, or prompt-loading behavior.

For each new version record:

1. a short stable version name;
2. the first commit on `main` containing that behavior;
3. a one-paragraph description of what changed and why;
4. any newly introduced or removed orchestration files.

Do not version ordinary Gauntlet execution-state updates here.
