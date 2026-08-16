# Gauntlet Loop

Grok Build orchestration for this football simulation. It is project-specific. It is not a generic agent framework.

The loop is:

```text
orchestrator → builder → required evidence → critic → fix/retry → integration → evidence gate → accept → next horizon objective
```

The orchestrator is Grok 4.6 (`grok-4.6`), not Grok 4 or another 4.x ID. High-token implementation, testing, fixing, experimentation, and repeated criticism stay on NaN models.

All Gauntlet agents, the `/gauntlet` skill, and model routing live **in this repository**. They are not installed into `~/.grok/agents/`, oxStack, or a global plugin. Grok loads them from project `.grok/agents/` and `.grok/skills/` when the working directory is this repo.

NaN model endpoints cannot live in the repo. Register them once in `~/.grok/config.toml` (see [NaN models](#nan-models)). Runtime auth is `NAN_API_KEY`. Grok cannot reuse an OpenCode persisted `nan` login.

An empty implementation is a valid start. `BOOTSTRAP-01` is the initial objective only while the toolchain and `src/` are missing. Strategic reassessment occurs at rolling-horizon boundaries; ordinary acceptance advances to the next validated horizon entry.

`.opencode/` and `opencode.json` are unused leftovers from the OpenCode harness. Do not launch this loop with `opencode`.

## Gauntlet system version

The Gauntlet is versioned as a complete harness under SemVer in `gauntlet/VERSION.json`: prompts + agents + skills + routing + deterministic tooling/evals + evidence/timing contracts + acceptance/state-audit machinery. Legacy changelog labels such as `v6-browser-evidence-model-tracking` are prompt-generation names, not SemVer releases. The normalized predecessor is `0.6.0`; the published release before this PR is `0.7.0`, while this checkout declares the candidate `0.8.0`.

`gauntlet/VERSION.json` identifies the version represented by a checkout. A version becomes a published Gauntlet release only after merge to `main` and creation of the immutable `gauntlet-vX.Y.Z` tag. `.github/workflows/publish-gauntlet-tag.yml` only publishes the tag when `gauntlet/VERSION.json` changes on `main`; it does not infer SemVer and does not rerun Gauntlet evaluation.

Canonical acceptance philosophy lives in `gauntlet/principles.md` and is referenced by runtime prompts rather than duplicated into every agent. v0.8 remains deterministic-first and critic-always: scripts establish facts, bounded ambiguity can be sent cheaply to `aux`/Gemma (Qwen fallback), but every candidate still reaches an independent qualitative critic before integration and final acceptance.

Run the pre-review audit with `pnpm run gauntlet:audit`; candidate acceptance persistence uses `pnpm run gauntlet:acceptance:persist`; post-bookkeeping consistency remains `pnpm run gauntlet:eval:state`.

## Launch

From the repository root:

```bash
export NAN_API_KEY=...   # required for Qwen, MiMo, DeepSeek, Gemma
grok --agent orchestrator --always-approve
```

Then run:

```text
/gauntlet
```

That is the single prompt. The orchestrator inspects the tree and starts the next iteration.

Equivalent explicit launches:

```bash
grok --agent orchestrator --always-approve
```

```bash
grok --agent orchestrator --always-approve --prompt-file gauntlet/PROMPT.md
```

Optional extra focus after `/gauntlet`:

```text
/gauntlet continue from BOOTSTRAP-07 only
```

`--always-approve` skips permission prompts. Project `.grok/config.toml` still denies `git rebase`, `sudo`, and `rm -rf /`. `git commit` / `git push` are allowed only so `git-committer` can run them; the orchestrator and builders must not. Do not start Grok on the built-in `general-purpose` agent for this loop unless you then run `/gauntlet` and stay on Grok 4.6.

## Canonical role contracts

Shared role behavior is stored once:

- orchestrator: `gauntlet/PROMPT.md`
- critic: `gauntlet/roles/critic.md`
- integration reviewer: `gauntlet/roles/integration-reviewer.md`
- structured builder: `gauntlet/roles/builder-structured.md`
- gameplay builder: `gauntlet/roles/builder-gameplay.md`

Project `.grok/agents/*.md` files are thin runtime wrappers: frontmatter, model binding, and only behavior genuinely specific to that runtime/model. Shared rules belong in the canonical role contract, not duplicated into fallback wrappers.

Two deterministic checks protect this split: each wrapper must reference an existing canonical contract, and its frontmatter model must match `gauntlet/models.json`.

## Agents

| Agent | Kind | Default model | Writes | Job |
|---|---|---|---|---|
| `orchestrator` | primary | `grok-4.6` | `gauntlet/state/**`, `gauntlet/objectives.md` | Follow canonical orchestration. Hands off at 89% SuperGrok weekly usage (`/usage`). |
| `orchestrator-deepseek` | primary (overflow) | `deepseek-v4-flash` | `gauntlet/state/**`, `gauntlet/objectives.md` | Same canonical loop. Picks up from `HANDOFF.md` + `CURRENT.md` + `HORIZON.md`. |
| `builder-structured` | subagent | `qwen3.6` | implementation files | Toolchain, contracts, determinism, replay, evaluators, tests, structured TypeScript |
| `builder-gameplay` | subagent | `mimo-v2.5` | implementation files | Gameplay, ball/control/team behavior, presentation-facing gameplay integration |
| `critic` | subagent | `deepseek-v4-flash-0731` | none | Preferred independent evaluation of builder evidence |
| `critic-flash` | fallback subagent | `deepseek-v4-flash` | none | Current-Flash critic fallback when 0731 is unavailable/out of allowance |
| `critic-qwen` | fallback subagent | `qwen3.6` | none | Independent Qwen fallback critic |
| `critic-mimo` | fallback subagent | `mimo-v2.5` | none | Independent MiMo fallback critic |
| `integration-reviewer` | subagent | `deepseek-v4-flash-0731` | none | Preferred architecture and neighboring-regression review after critic accept |
| `integration-reviewer-flash` | fallback subagent | `deepseek-v4-flash` | none | Current-Flash integration fallback when 0731 is unavailable/out of allowance |
| `aux` | subagent | `gemma4` | none | Cheap summaries, file lists, bounded semantic audit |
| `git-committer` | subagent | `gemma4` | git only | Atomic conventional commits and push when explicitly asked |

Exact IDs are in `gauntlet/models.json` and must match `.grok/agents/<name>.md` frontmatter `model`. The user-level `~/.grok/config.toml` only needs to register the custom model endpoints themselves.

The orchestrator delegates with `spawn_subagent`. `subagent_type` is the agent name. Builders use `capability_mode: all`. Critics, integration reviewers, `aux`, and `git-committer` use `capability_mode: execute`. Route DeepSeek reviewer fallback by agent type: if the 0731 role fails specifically for model availability, allowance exhaustion, or model-specific capacity/rate limiting, spawn `critic-flash` or `integration-reviewer-flash`. Do **not** retry `critic` or `integration-reviewer` with an in-place `model: deepseek-v4-flash` override. Do not change models for authentication, network, context, test, or ordinary task failures. A child that inherits `grok-4.6` is a routing bug. Commits go to `git-committer` / `gemma4`, never to the orchestrator.

Project-local agent frontmatter owns the agent → model binding. For example, `grok --agent aux --always-approve` resolves the `model: gemma4` declared in `.grok/agents/aux.md`; an explicit `--model` override is only for intentional runtime override/debugging.

### Builder choice

The orchestrator chooses one builder role per objective by responsibility, not by provider:

- `builder-structured` for toolchain, contracts, determinism, serialization, input, replay, evaluator registries, tests, and CLI glue.
- `builder-gameplay` for locomotion, ball integration, controls, passing/shooting/contact, gameplay-coupled team behavior, presentation-facing gameplay integration, or large-spec gameplay work.

If an objective spans both responsibilities, choose the dominant one or decompose it. Do not add another builder role until a concrete recurring responsibility requires it.

Grok 4.6 never implements. If builders repeatedly fail, Grok must reconsider/decompose, apply critic feedback, reroute only when the other existing role genuinely fits, or mark the objective blocked with evidence.

### Parallel builders

Allow two builders only when all of these are true:

- their file sets do not overlap
- they do not both change world/schema/config contracts
- `gauntlet/objectives.md` lists the pair as isolatable

Critics may run in parallel; they are read-only.

## Model routing

| Role | Exact model | Fallback |
|---|---|---|
| Orchestrator | `grok-4.6` | `orchestrator-deepseek` at ≥89% SuperGrok weekly usage (`/usage`) |
| Overflow orchestrator | `deepseek-v4-flash` (high reasoning) | explicit relaunch on `deepseek-v4-flash-0731` only for model-specific availability/allowance/capacity failure |
| Structured builder | `qwen3.6` | no implicit model swap; reroute/decompose by responsibility |
| Gameplay builder | `mimo-v2.5` | no implicit model swap; reroute/decompose by responsibility |
| Primary critic | `critic` / `deepseek-v4-flash-0731` | `critic-flash` / current Flash, then independent Qwen/MiMo |
| Integration reviewer | `integration-reviewer` / `deepseek-v4-flash-0731` | `integration-reviewer-flash` / current Flash, then a model different from the builder |
| Cheap auxiliary | `gemma4` | `qwen3.6` |
| Git committer | `gemma4` | `qwen3.6` |

Hard rule: the critic model must differ from the implementation model for that candidate.

Use NaN models for high-token implementation, test fixing, experimentation, and repeated criticism. Use `gemma4` for summaries and git commits. Use Grok 4.6 for orchestration until **SuperGrok weekly usage** (`/usage`, not the context footer) hits **89%**. Then continue on `orchestrator-deepseek` using current `deepseek-v4-flash` from `gauntlet/state/HANDOFF.md`. Auto-compact is still 65% of the 500k **context** window (`~/.grok/config.toml` `[session] auto_compact_threshold_percent = 65`). That setting lives in the user config, not project `.grok/config.toml`.

Overflow launch (always pass `--model`):

```bash
grok --agent orchestrator-deepseek --model deepseek-v4-flash --reasoning-effort high --always-approve
```

Then `/gauntlet-continue`.

If current Flash itself fails with a model-specific availability, allowance, or capacity failure, explicitly relaunch the same overflow role once with the 0731 snapshot:

```bash
grok --agent orchestrator-deepseek --model deepseek-v4-flash-0731 --always-approve
```

## NaN models

Grok loads custom model endpoint definitions from user `~/.grok/config.toml`; those global entries only make models such as `qwen3.6`, `mimo-v2.5`, `deepseek-v4-flash`, `deepseek-v4-flash-0731`, and `gemma4` available. Agent → model selection is project-local in each `.grok/agents/*.md` frontmatter and mirrored by `gauntlet/models.json` for Gauntlet routing/auditability. No user-level `[subagents.models]` migration is required for 0.8.

Confirm with `grok models`. The process must have `NAN_API_KEY` set. A missing key registers the names but every NaN request fails with 401.

## Loop

```text
OBJECTIVE
  ↓
BUILDER ROLE
  ↓
tests + class-specific artifacts
  ↓
gauntlet:audit (deterministic facts)
  ├─ FAIL/builder → retry builder
  ├─ FAIL/orchestrator → repair state and re-audit
  └─ REVIEW_REQUIRED → bounded aux/Gemma audit → re-enter gate
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
ACCEPT → next horizon objective / replan
```

Deterministic and cheap semantic audits can block progression but cannot accept an objective. See `gauntlet/principles.md`, `gauntlet/evidence-classes.md`, `gauntlet/evidence-contract.md`, and `gauntlet/evidence-manifest-contract.md`.

Reviewer fallback, rolling-horizon planning, retry/revert semantics, SuperGrok handoff, and builder/critic model independence remain unchanged.

## What counts as success

Authoritative specs:

- `specs/TECHNICAL_SPEC.md`
- `specs/GAMEPLAY_EVALUATION_SPEC.md`
- `specs/VISUAL_SPEC.md`

While a bootstrap candidate is selected, success is that candidate's acceptance criteria from `BOOTSTRAP_PLAN.md`. Bootstrap results use `BOOTSTRAP-*` invariants only.

After that, milestone verdicts follow the Gameplay Evaluation Spec:

- required hard invariants can `PASS` or `FAIL`
- missing PES targets are `BLOCKED_MISSING_REFERENCE`
- missing perceptual rubrics are `NEEDS_PERCEPTUAL_REVIEW`
- no invented regression `PASS`

## Files

```text
gauntlet/
  README.md
  VERSION.json
  PROMPT.md
  principles.md
  models.json
  roles/                     canonical reusable role contracts
  objectives.md
  evidence-contract.md
  evidence-manifest-contract.md
  state/
  evals/
  artifacts/

.grok/agents/               thin project-local runtime/model wrappers
.grok/skills/               project-local user-invocable skills
.grok/config.toml           project deny rules
AGENTS.md                   repository rules for every agent
```

Do not add these agents under `~/.grok/agents/`. That would make them appear in every Grok project on the machine.

## Change model routing later

1. Edit `gauntlet/models.json`.
2. Change the matching `.grok/agents/<name>.md` frontmatter `model`.
3. If a NaN API id or endpoint changes, update the matching user-level `[model.*]` block; agent → model routing remains project-local in the corresponding wrapper frontmatter and `gauntlet/models.json`.
4. Keep role behavior in `gauntlet/roles/**` / `gauntlet/PROMPT.md`; do not duplicate a canonical contract merely to change models.
5. Confirm with `pnpm run gauntlet:eval` that wrapper-contract and model-routing consistency pass.
6. Record semantic routing/rule changes in `docs/gauntlet-changelog.md`; do not write them into generated live state solely for documentation.

## Permissions

Unattended Gauntlet is the intended mode. Launch with `grok --agent orchestrator --always-approve`.

- Orchestrator cannot edit `src/`, `eval/`, or specs. It writes Gauntlet state only. That limit is in the agent prompt; Grok project denies are session-wide and would also block builders if pointed at `src/`.
- Builders can create and edit implementation files. They cannot edit specs, research, `.grok/agents/`, or canonical Gauntlet role/routing contracts.
- Critics and the integration reviewer cannot edit files. They may run read-only validation (`git`, `mise`, `pnpm`, `npx`, `node`, `vitest`, and inspect commands).
- Orchestrator, builders, critics, and `aux` must not `git commit`, `git push`, `git rebase`, `sudo`, or `rm -rf /`.
- After critic + integration ACCEPT and the orchestrator evidence gate, `git-committer` creates the candidate snapshot commit. After persistence/bookkeeping/state audit, it creates the separate final acceptance commit. Push only when the parent explicitly asks.
- Builders must run installs non-interactively (`CI=1`, `mise trust --all` after writing `mise.toml`).
