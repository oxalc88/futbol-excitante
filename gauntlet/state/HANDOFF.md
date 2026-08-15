# Gauntlet handoff

Overflow pickup file. The DeepSeek orchestrator reads this before `CURRENT.md`.
Grok 4.6 rewrites this when SuperGrok weekly usage (`/usage`) hits 89%. That is not the 500k context footer.

## Standing instructions (human, 2026-08-15)

Passed on `/gauntlet-continue`. Apply them every iteration, no exceptions:

- After finishing a unit (accepted objective): make atomic commits **and push** via `git-committer` (`gemma4`). Explicitly tell the committer to push.
- Update the timing: refresh `gauntlet/state/TIMING.md` when a step finishes — append the per-step row and recompute the builder scoreboard.
- Always delegate tasks to the proper agent role: builder → critic → integration-reviewer → git-committer. Never let the orchestrator sit between roles. In particular, `git-committer` is `gemma4`; the legacy `grok-4.6` git-committer routing bug must not recur. Every commit goes to `git-committer`.

```yaml
handoff_version: 1
written_at: 2026-08-15 (refresh: pickup confirmed + standing instructions)
from_orchestrator: orchestrator
to_orchestrator: orchestrator-deepseek
from_model: grok-4.6
to_model: deepseek-v4-flash-0731
parent_window: 500000
handoff_at_percent: 89
handoff_metric: super_grok_weekly_usage
auto_compact_percent: 65
```

## How to continue

```bash
cd /home/ubuntu/projects/oxDeveloop/pes-simulator
grok --agent orchestrator-deepseek --model deepseek-v4-flash-0731 --always-approve
```

Then `/gauntlet-continue`. Always pass `--model`. The workstation `grok`
wrapper supplies `NAN_API_KEY`; do not export or paste the credential manually.

## Board (confirmed at pickup)

- last accepted: PLAYABLE-DUELS-SUITE (critic + integration ACCEPT)
- `next_objective_id`: PLAYABLE-MUTANT-1V1
- git working tree is **clean**; duels commits are on `main` (cf51d83, 7083e24, 10fefa1, 4342cae)
- PLAYABLE_1V1 still cannot PASS (`ARCH-DIFF-001` NEEDS_PERCEPTUAL_REVIEW; `MUTANT_1V1` / blinded comparison NOT_EVALUATED)
- Do not invent a perceptual rubric or PES envelopes
- `git-committer` is `gemma4`

## Start MUTANT-1V1

Inspect `eval/runners/playable-evaluator.ts` exit prerequisites (`MUTANT_1V1_PASS`, `ARCHETYPE_BLINDED_COMPARISON_PASS`) and the protected mutant registry (`eval/oracles/mutant-registry.ts`) before delegating. The gap: an executable 1v1 mutant/canary path that can FAIL, so `MUTANT_1V1` stops being a static NOT_EVALUATED exit prerequisite. Do not fake a perceptual rubric.
