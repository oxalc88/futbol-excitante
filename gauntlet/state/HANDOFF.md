# Gauntlet handoff

Overflow pickup file. The DeepSeek orchestrator reads this before `CURRENT.md`.
Grok 4.6 rewrites this when SuperGrok weekly usage (`/usage`) hits 89%. That is not the 500k context footer.

```yaml
handoff_version: 1
written_at: 2026-08-15
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
export NAN_API_KEY=...
grok --agent orchestrator-deepseek --model deepseek-v4-flash-0731 --always-approve
```

Then `/gauntlet-continue`. Always pass `--model`.

## Board

- last accepted: PLAYABLE-DUELS-SUITE (critic + integration ACCEPT)
- `next_objective_id`: PLAYABLE-MUTANT-1V1
- PLAYABLE_1V1 still cannot PASS (`ARCH-DIFF-001` NEEDS_PERCEPTUAL_REVIEW; `MUTANT_1V1` / blinded comparison NOT_EVALUATED)
- Do not invent a perceptual rubric or PES envelopes
- `git-committer` is `gemma4`

## After DUELS commits land

Working tree should be clean of eval/duels candidate files. If any remain, they are leftover — inspect before starting MUTANT_1V1.
