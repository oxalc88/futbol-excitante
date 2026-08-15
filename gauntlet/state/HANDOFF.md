# Gauntlet handoff

Overflow pickup file. The DeepSeek orchestrator reads this before `CURRENT.md`.
Grok 4.6 rewrites this when the parent window hits 95% (475k of 500k).

```yaml
handoff_version: 1
written_at: 2026-08-15
from_orchestrator: orchestrator
to_orchestrator: orchestrator-deepseek
from_model: grok-4.6
to_model: deepseek-v4-flash-0731
parent_window: 500000
handoff_at_percent: 95
auto_compact_percent: 65
```

## How to continue

```bash
cd /home/ubuntu/projects/oxDeveloop/pes-simulator
export NAN_API_KEY=...
grok --agent orchestrator-deepseek --model deepseek-v4-flash-0731 --always-approve
```

Then `/gauntlet-continue`.

`--agent` alone keeps the session default (`grok-4.6`). Always pass `--model`.

## Board at last Grok write

- `next_objective_id`: PLAYABLE-DUELS-SUITE (in flight)
- last accepted: PLAYABLE-TOUCH-ACTIONS-SUITE (`3bd282a` docs commit; suite on `main`)
- `active_candidate.last_verdict` was REJECT (shared `computeOutcome` masked FAIL), then a post-REJECT hypothesis restored FAIL-if-any-fail
- Independent critic **ACCEPT** on that post-REJECT hypothesis
- Integration review was started and **cancelled** — next action is `integration-reviewer` on the dirty tree, not a new builder
- Do not claim PLAYABLE_1V1_PASS or PES
- Do not restart touch_and_actions

## Dirty tree (do not revert unless REJECT)

In-flight DUELS candidate (leave it):

- `eval/contracts/bindings.ts`
- `eval/contracts/common-criteria.ts`
- `eval/contracts/invariant-definitions.ts`
- `eval/contracts/policies.ts`
- `eval/contracts/scenarios.ts`
- `eval/contracts/suites.ts`
- `eval/contracts/types.ts`
- `eval/oracles/wire.ts`
- `eval/oracles/player-contact.ts` (untracked)
- `eval/runners/foundation-evaluator.ts`
- `tests/unit/eval/eval-registry.test.ts`
- `tests/unit/eval/playable-evaluator.test.ts`
- `tests/unit/eval/duels-suite.test.ts` (untracked)
- `gauntlet/state/CURRENT.md` (retry bookkeeping only)

## Do not redo

Accepted bootstrap, foundation lab, playable 1v1 pieces through TOUCH-ACTIONS-SUITE.
`git-committer` is `gemma4`. Orchestrator must not `git commit`.

## After you accept DUELS

Atomic commits + push via `git-committer`. Then reassess. PLAYABLE_1V1 still cannot PASS (`ARCH-DIFF-001` NEEDS_PERCEPTUAL_REVIEW, `MUTANT_1V1` / blinded comparison NOT_EVALUATED). Next executable gap is likely `PLAYABLE-MUTANT-1V1` or fail-closed unknown archetypes — inspect, do not assume.
