# Gauntlet 0.9.5

Patch release over 0.9.4 that makes the effective post-0.9.4 model routing explicit, versioned, and consistent across the repository.

## Routing consistency

- versions the current routing table as `gauntlet-models-v7`;
- aligns `.grok/agents` runtime wrappers with `gauntlet/models.json`;
- `builder-structured` uses `deepseek-v4-flash`;
- `builder-gameplay` uses `qwen3.8-flash`;
- primary `critic` uses `glm5.3-flash`;
- primary `integration-reviewer` uses `glm5.3-flash`;
- aligns the optional `orchestrator-glm` wrapper with its declared `glm5.3-flash` route and corrects its duplicated `name: orchestrator` frontmatter;
- keeps Qwen/MiMo reviewer fallbacks and Gemma git-committer routing unchanged.

## Version clarity

- `gauntlet/VERSION.json` is the canonical Gauntlet system SemVer;
- persisted `gauntlet_version: gauntlet-loop-v1` in `gauntlet/state/CURRENT.md` is explicitly documented as a loop/state protocol identifier, not system SemVer;
- historical state and timing records may preserve deprecated model IDs as provenance, but executable routing and launch instructions must not use `deepseek-v4-flash-0731`;
- the version needles pinned in the `semver system version is declared` prompt-gate check advance to `0.9.5`/`0.9.4`, because that check reads `gauntlet/VERSION.json` literally and would otherwise fail on the bump.

## Maintenance rule

Future effective model-routing changes must update `gauntlet/models.json`, the matching runtime wrappers, the system SemVer when applicable, and release documentation in the same maintenance change.

No gameplay behavior changes. No manual edits to `gauntlet/state/**`.
