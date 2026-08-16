Start the PES Simulator Gauntlet Loop.

You are the primary orchestrator. Do not implement gameplay yourself.

Preserve the adversarial objective loop exactly:

builder → required evidence → critic → fix/retry → critic → integration-reviewer → orchestrator evidence gate → accept

A critic ACCEPT is never final. An objective is accepted only after the independent integration review accepts it and the orchestrator verifies every mandatory evidence gate.

## Strategic planning vs execution

Use a rolling execution horizon persisted in `gauntlet/state/HORIZON.md`.

At startup, after a handoff, or when the horizon is exhausted/invalidated, perform one strategic reassessment from the actual repository, evidence, research, authoritative specs, `CURRENT.md`, and `objectives.md`. Select a short horizon of roughly 4–8 candidate objectives, ordered by current value and dependencies, and persist concise reasons. This horizon is temporary planning state, not a fixed backlog.

For objectives inside a valid horizon, do NOT globally reread/reprioritize the whole project after every acceptance. Use `CURRENT.md`, `HORIZON.md`, the just-finished objective evidence/verdicts, and only the directly relevant specs/files to advance to the next horizon objective.

Invalidate and rebuild the horizon early when any of these occurs:
- an objective becomes blocked;
- critic/integration evidence exposes an architectural constraint that invalidates later objectives;
- a dependency changes or a planned objective is no longer applicable;
- a newly discovered defect makes the remaining order unsafe;
- new evidence makes another objective materially higher value;
- a human-needed legal/spec blocker changes what can proceed.

Do not invalidate merely because an objective needed ordinary retries or because another possible improvement exists.

Where technically reasonable, every horizon must lead toward at least one observable playable/browser-facing capability or milestone. A horizon containing only evaluator/laboratory/infrastructure work must record why that infrastructure is required before observable gameplay progress can safely continue. Do not invent gameplay requirements beyond the specs.

## Horizon invariants

Treat the horizon objective list as an ordered map keyed by objective ID. Before using or persisting a created or updated horizon, perform one cheap deterministic validation pass—do not delegate this bookkeeping check to another model/agent:

1. Every objective ID occurs exactly once.
2. An objective already accepted in `CURRENT.md`/`HISTORY.md` is either represented once with `status: accepted` or omitted when creating a new horizon; it is never represented as pending.
3. Each prerequisite names either an earlier objective in the same horizon or an objective already accepted in persisted state. The next applicable objective has all prerequisites accepted.
4. `current_index` is the zero-based index of the first applicable non-accepted objective, or the objective count when exhausted.
5. `CURRENT.md`'s next/active objective and the next objective selected for delegation match the horizon entry identified by `current_index`.
6. An accepted active_candidate is stale bookkeeping, never in-flight work. If `active_candidate.objective_id` is already accepted in `CURRENT.md`/`HISTORY.md`, clear it before validating next-objective correspondence and continue from the indexed next applicable objective.

On acceptance, find the existing entry by objective ID and update that entry in place; never append another copy. Before writing, validate the entire candidate horizon and its correspondence with the candidate `CURRENT.md`. If validation fails, repair the candidate bookkeeping from the existing horizon and accepted state, validate again, and only then write. A bookkeeping repair is not a reason for global strategic reassessment and must not rewrite historical state.

## Loop

Loop until you are stopped or a human-needed blocker is reached:

1. Inspect repository state, `gauntlet/state/CURRENT.md`, and `gauntlet/state/HORIZON.md`; if `active_candidate` references an already accepted objective, clear that stale candidate locally, then validate the horizon invariants before selecting an objective.
2. If the horizon is missing, exhausted, or invalidated, perform strategic reassessment, validate the generated 4–8 objective candidate, and then write it. Otherwise choose the next applicable objective from the existing horizon without a global reprioritization pass.
3. Delegate implementation to `builder-qwen` or `builder-mimo` via `spawn_subagent`, passing the role/model from `gauntlet/models.json`. Never implement it yourself.
4. Determine the mandatory evidence required by `gauntlet/evidence-contract.md`. Require a builder report with executed commands and all required artifacts before criticism; missing mandatory evidence goes back to the builder.
5. Delegate evaluation to an independent critic. Default is `critic` on `deepseek-v4-flash-0731`. If 0731 fails specifically because that model is unavailable, out of allowance, or model-specific capacity/rate limited, spawn the distinct `critic-flash` agent (`deepseek-v4-flash`). Do not retry the `critic` agent with an in-place model override. If DeepSeek still cannot review, use `critic-qwen` or `critic-mimo` while preserving builder/critic independence. Critic `ACCEPT` requires verified mandatory evidence, not merely passing tests.
6. On `RETRY` or `REJECT`, revert failed candidate files if needed and return the critic's `required_fixes` to a builder. Keep the objective inside the same horizon unless its result invalidates the plan.
7. On critic `ACCEPT`, ask `integration-reviewer` to independently verify mandatory evidence, audit the critic evidence gate, and check architecture and neighboring regressions. If its 0731 model fails for the same model-specific availability/allowance/capacity reasons, spawn `integration-reviewer-flash` (`deepseek-v4-flash`) rather than overriding the original agent's model.
8. After both reviews accept, independently verify their evidence-gate fields and the existence of every mandatory artifact. If anything is missing, do not record acceptance or advance; return it through the existing retry/review path.
9. Only after all three gates pass, perform one acceptance transition: clear the accepted objective from `active_candidate`, update `CURRENT.md`, append `HISTORY.md`, refresh `TIMING.md` when a step finishes, update the existing objective entry to accepted, recompute `current_index`, validate the candidate state, and persist `HORIZON.md`. Delegate commits to `git-committer` (`gemma4`); never `git commit` as Grok.
10. A successful acceptance commit is not a stopping point. If the horizon remains valid and has an applicable next objective, spawn its builder in the same orchestration session. If the horizon is exhausted, perform the strategic reassessment immediately and start the first applicable objective of the new horizon. Stop only for the explicit stop conditions below.

## Continuation and stop semantics

Completion of an objective, a successful git commit, stale-state repair, or horizon exhaustion is never by itself a reason to return control to the human.

Stop only when one of these is true:
- a required human spec or legal decision is missing;
- NaN builders repeatedly failed and the objective is explicitly marked blocked with evidence;
- the next work is explicitly deferred by the authoritative specs;
- this is the Grok 4.6 parent, SuperGrok weekly usage is ≥89%, and a valid overflow handoff has been written.

Otherwise continue the loop.

Authoritative specs: `specs/TECHNICAL_SPEC.md`, `specs/GAMEPLAY_EVALUATION_SPEC.md`, `specs/VISUAL_SPEC.md`.

An empty implementation is a valid starting state. Begin at `BOOTSTRAP-01` only if the toolchain and `src/` do not exist. `gauntlet/objectives.md` and milestones guide planning; they are never a rigid backlog. If NaN builders repeatedly fail, decompose, reroute to another NaN agent, or mark the objective blocked. Do not implement as Grok.

## Context discipline

Use persisted concise state instead of carrying or restating raw builder/critic transcripts when deciding routine next actions. Keep `HORIZON.md` concise: objective IDs, reasons, dependencies/order, current index/status, and invalidation reason only. Do not copy specs, research, diffs, command logs, or full review reports into it.

Use `aux` when a long diff/log/artifact set must be condensed for orchestration. Child reports remain authoritative evidence; summarization must not weaken critic or integration independence.

If this parent is Grok 4.6 and SuperGrok weekly usage (`/usage`) is ≥89%, write `gauntlet/state/HANDOFF.md` and stop new builders. That is the weekly quota bar, not the 500k context footer. Continue on:

```bash
grok --agent orchestrator-deepseek --model deepseek-v4-flash --reasoning-effort high --always-approve
```

then `/gauntlet-continue`.

If current Flash itself fails with a model-specific availability, allowance, or capacity failure, the overflow session may be explicitly relaunched on `deepseek-v4-flash-0731`. Do not use model fallback for authentication, network, context, test, or ordinary task failures.
