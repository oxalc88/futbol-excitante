# Gauntlet Loop

Grok Build orchestration for this football simulation. It is project-specific, not a generic agent framework.

The loop is:

```text
orchestrator → builder → required evidence → critic → fix/retry → integration → evidence gate → candidate commit → acceptance/bookkeeping → remote verification → next horizon objective
```

All Gauntlet agents, skills, routing, deterministic evals, and contracts live in this repository. NaN endpoint registration/auth remains user-level runtime configuration; the repo only declares which registered model IDs each role uses.

## Gauntlet system version

`gauntlet/VERSION.json` is the canonical SemVer declaration for the complete harness. A version becomes a published release after merge to `main` and publication of the immutable `gauntlet-vX.Y.Z` tag.

Current candidate: **0.9.4** over 0.9.3.

0.9.4 does not change gameplay. It updates model routing and strengthens timing-bookkeeping consistency.

## Launch

From the repository root:

```bash
export NAN_API_KEY=...
grok --agent orchestrator --always-approve
```

Then:

```text
/gauntlet
```

When the Grok 4.6 parent reaches the configured SuperGrok handoff threshold, continue with:

```bash
grok --agent orchestrator-deepseek --model deepseek-v4-flash --reasoning-effort high --always-approve
```

then `/gauntlet-continue`.

There is no deprecated DeepSeek snapshot fallback in 0.9.4.

## Canonical role contracts

Shared behavior lives once:

- orchestrator: `gauntlet/PROMPT.md`
- critic: `gauntlet/roles/critic.md`
- integration reviewer: `gauntlet/roles/integration-reviewer.md`
- structured builder: `gauntlet/roles/builder-structured.md`
- gameplay builder: `gauntlet/roles/builder-gameplay.md`

`.grok/agents/*.md` files are thin runtime wrappers containing frontmatter/model binding plus only runtime-specific behavior. Shared rules belong in the canonical role contracts.

Two deterministic checks protect this split: wrappers must reference an existing canonical contract, and wrapper frontmatter models must match `gauntlet/models.json`.

## Current agents

| Agent | Kind | Model | Job |
|---|---|---|---|
| `orchestrator` | primary | `grok-4.6` | canonical orchestration; hands off at the configured weekly threshold |
| `orchestrator-deepseek` | overflow primary | `deepseek-v4-flash` | resumes from persisted handoff/state |
| `builder-structured` | subagent | `qwen3.6` | toolchain, contracts, determinism, evaluators, tests, structured TypeScript |
| `builder-gameplay` | subagent | `mimo-v2.5` | gameplay, ball/control/team behavior, presentation-facing integration |
| `critic` | subagent | `deepseek-v4-flash` | primary independent qualitative critic |
| `critic-qwen` | fallback critic | `qwen3.6` | independent critic fallback |
| `critic-mimo` | fallback critic | `mimo-v2.5` | independent critic fallback |
| `integration-reviewer` | subagent | `deepseek-v4-flash` | primary integration/neighbouring-regression review |
| `integration-reviewer-qwen` | fallback integration | `qwen3.6` | independent integration fallback |
| `integration-reviewer-mimo` | fallback integration | `mimo-v2.5` | independent integration fallback |
| `aux` | subagent | `gemma4` | cheap summaries and bounded semantic audit |
| `git-committer` | subagent | `gemma4` | atomic conventional commits and requested publication |

Exact IDs and fallback ordering live in `gauntlet/models.json`.

## Model routing

Current registered model IDs used by the Gauntlet are:

- `deepseek-v4-flash`
- `qwen3.6`
- `mimo-v2.5`
- `gemma4`
- `grok-4.6` for the parent orchestrator

`deepseek-v4-flash-0731` is deprecated and is not part of current Gauntlet routing.

Primary reviewer routing:

| Role | Primary | Fallbacks |
|---|---|---|
| Critic | `critic` / `deepseek-v4-flash` | `critic-qwen`, then `critic-mimo` |
| Integration reviewer | `integration-reviewer` / `deepseek-v4-flash` | `integration-reviewer-qwen`, then `integration-reviewer-mimo` |
| Cheap auxiliary | `gemma4` | `qwen3.6` |
| Git committer | `gemma4` | `qwen3.6` |

Hard rule: the critic/reviewer model used for a candidate must remain independent from the builder model where the applicable role contract requires independence.

### Model capability routing

Availability is not the same as capability. Follow `gauntlet/model-capability-contract.md`.

The observed error:

```text
No endpoints found that support image input.
```

is `MODEL_CAPABILITY_MISMATCH`. It is not a gameplay failure and not a reviewer verdict. Preserve the same objective and review step. Reroute only to a model explicitly known to support the required modality. If none is configured, keep the perceptual review pending and surface the human-needed blocker rather than discarding prior progress or restarting the builder.

DeepSeek Flash is explicitly treated as not accepting image attachments on the currently observed NaN endpoint. Capability of other NaN routes is not assumed unless explicitly established by runtime/provider configuration.

## Builder choice

Choose one builder by responsibility, not provider:

- `builder-structured` for toolchain, contracts, determinism, serialization, input/replay, evaluator registries, tests, and CLI glue.
- `builder-gameplay` for locomotion, ball integration, controls, passing/shooting/contact, gameplay-coupled team behavior, and presentation-facing gameplay integration.

If an objective spans both, choose the dominant responsibility or decompose it. Do not add another builder role merely to switch models.

## Acceptance pipeline

```text
OBJECTIVE
  ↓
BUILDER ROLE
  ↓
tests + class-specific artifacts
  ↓
gauntlet:audit
  ↓
mandatory independent CRITIC
  ↓
INTEGRATION REVIEWER
  ↓
FINAL EVIDENCE GATE
  ↓
candidate snapshot commit
  ↓
persist acceptance + objective manifest
  ↓
update CURRENT/HISTORY/HORIZON/TIMING
  ↓
gauntlet:eval:state
  ↓
final acceptance commit
  ↓
push + origin/main durability verification
  ↓
ACCEPT → next horizon objective / replan
```

Deterministic and bounded semantic audits may invalidate or request more evidence but cannot substitute for the qualitative critic.

## Timing bookkeeping

`gauntlet/state/TIMING.md` is acceptance persistence. 0.9.4 requires all four tracking markers to reach the latest accepted objective:

```yaml
last_tracked_objective: <objective-id>
usage_aggregates_through: <objective-id>
model_evaluation_through: <objective-id>
clock_aggregates_through: <objective-id>
```

The global Clock/session aggregates must be refreshed when their source rows change. Advancing the other markers while leaving old global totals is a state-audit failure owned by the orchestrator, not a gameplay regression. See `gauntlet/timing-contract.md`.

## Evidence and observability

Repository evidence is canonical and observer tooling remains read-only. See:

- `gauntlet/evidence-contract.md`
- `gauntlet/evidence-manifest-contract.md`
- `gauntlet/observability-contract.md`
- `gauntlet/milestone-playtest-contract.md`

Normal regression tests must not rewrite accepted historical evidence. Durable capture is explicit; temporary test artifacts remain ephemeral.

## Permissions

Unattended Gauntlet is the intended mode.

- Orchestrator does not implement gameplay.
- Builders may edit implementation/test files within their assigned scope, not Gauntlet contracts/specs.
- Critics/integration reviewers are read-only.
- Only `git-committer` performs candidate/acceptance commits and requested pushes.
- `gauntlet/state/**` is owned by the running orchestrator/bookkeeping flow, not maintenance PRs.

## Change model routing later

1. Edit `gauntlet/models.json`.
2. Change the matching `.grok/agents/<name>.md` frontmatter model.
3. Add/remove fallback wrappers only when the fallback actually uses a different model/route.
4. Keep shared role behavior in `gauntlet/roles/**` / `gauntlet/PROMPT.md`.
5. Update capability declarations only from observed/provider-backed facts; unknown capability stays unknown.
6. Run `pnpm run gauntlet:eval` and Maintenance PR CI.
7. Record release/routing changes in the Gauntlet release notes/changelog.

Authoritative product specs remain:

- `specs/TECHNICAL_SPEC.md`
- `specs/GAMEPLAY_EVALUATION_SPEC.md`
- `specs/VISUAL_SPEC.md`
