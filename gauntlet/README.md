# Gauntlet Loop

Grok Build orchestration for this football simulation. It is project-specific. It is not a generic agent framework.

The loop is:

```text
orchestrator → builder → required evidence → deterministic audit → critic → integration → candidate provenance → durable acceptance → next horizon objective
```

The orchestrator is Grok 4.6 (`grok-4.6`), not Grok 4 or another 4.x ID. High-token implementation, testing, fixing, experimentation, and repeated criticism stay on NaN models.

All Gauntlet agents, the `/gauntlet` skill, and model routing live **in this repository**. They are not installed into `~/.grok/agents/`, oxStack, or a global plugin. Grok loads them from project `.grok/agents/` and `.grok/skills/` when the working directory is this repo.

NaN model endpoints cannot live in the repo. Register them once in `~/.grok/config.toml` (see [NaN models](#nan-models)). Runtime auth is `NAN_API_KEY`. Grok cannot reuse an OpenCode persisted `nan` login.

An empty implementation is a valid start. `BOOTSTRAP-01` is the initial objective only while the toolchain and `src/` are missing. Strategic reassessment occurs at rolling-horizon boundaries; ordinary acceptance advances to the next validated horizon entry.

`.opencode/` and `opencode.json` are unused leftovers from the OpenCode harness. Do not launch this loop with `opencode`.

## Gauntlet system version

The Gauntlet is versioned as a complete harness under SemVer in `gauntlet/VERSION.json`: prompts + agents + skills + routing + deterministic tooling/evals + evidence/timing contracts + acceptance/state-audit machinery. Legacy changelog labels such as `v6-browser-evidence-model-tracking` are prompt-generation names, not SemVer releases. The previous system version is `0.7.0`; this architecture is **`0.8.0`**.

Canonical acceptance philosophy lives in `gauntlet/principles.md` and is referenced by runtime prompts rather than duplicated into every agent. 0.8 remains deterministic-first and critic-always: scripts establish facts, bounded ambiguity can be sent cheaply to `aux`/Gemma (Qwen fallback), but every candidate still reaches an independent qualitative critic before integration and final acceptance.

0.8 adds durable evidence provenance. Every newly accepted objective gets `docs/evidence/<objective-id>/manifest.json`; local screenshots/trajectory/audit/sequence evidence is SHA-256 hashed and byte-bound to a reviewed candidate commit. `DYNAMIC_VISUAL` objectives require 3–5 semantic frames. Historical pre-0.8 evidence is preserved rather than retroactively rewritten.

Run the pre-review audit with `pnpm run gauntlet:audit`; candidate acceptance persistence uses `pnpm run gauntlet:acceptance:persist`; post-bookkeeping consistency remains `pnpm run gauntlet:eval:state`. Optional video metadata uses `pnpm run gauntlet:video:reference`; milestone summaries use `pnpm run gauntlet:milestone:bundle`.

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

## Agents

| Agent | Kind | Default model | Writes | Job |
|---|---|---|---|---|
| `orchestrator` | primary | `grok-4.6` | `gauntlet/state/**`, `gauntlet/objectives.md` | Inspect, prioritize, delegate, accept/revert, choose the next objective. Hands off at 89% SuperGrok weekly usage (`/usage`). |
| `orchestrator-deepseek` | primary (overflow) | `deepseek-v4-flash` | `gauntlet/state/**`, `gauntlet/objectives.md` | Same loop on current Flash. Picks up from `HANDOFF.md` + `CURRENT.md` after Grok hits the ceiling. |
| `builder-qwen` | subagent | `qwen3.6` | implementation files | Structured TypeScript, toolchain, contracts, tests, registries |
| `builder-mimo` | subagent | `mimo-v2.5` | implementation files | Large-context gameplay/presentation work |
| `critic` | subagent | `deepseek-v4-flash-0731` | none | Preferred independent evaluation of builder evidence |
| `critic-flash` | fallback subagent | `deepseek-v4-flash` | none | Explicit current-Flash critic fallback when 0731 is unavailable/out of allowance |
| `critic-qwen` | fallback subagent | `qwen3.6` | none | Fallback critic when DeepSeek is unavailable and Qwen did not implement |
| `critic-mimo` | fallback subagent | `mimo-v2.5` | none | Fallback critic when DeepSeek is unavailable and MiMo did not implement |
| `integration-reviewer` | subagent | `deepseek-v4-flash-0731` | none | Preferred architecture and neighboring-regression review after critic accept |
| `integration-reviewer-flash` | fallback subagent | `deepseek-v4-flash` | none | Explicit current-Flash integration fallback when 0731 is unavailable/out of allowance |
| `aux` | subagent | `gemma4` | none | Cheap summaries, bounded semantic evidence review, artifact condensation |
| `git-committer` | subagent | `gemma4` | git only | Candidate provenance snapshots plus atomic acceptance commits (and push when asked). Not Grok. |

Exact IDs are in `gauntlet/models.json` and must match `.grok/agents/<name>.md` frontmatter `model` plus the `[model.*]` blocks in `~/.grok/config.toml`.

The orchestrator delegates with `spawn_subagent`. `subagent_type` is the agent name. Builders use `capability_mode: all`. Critics, integration reviewers, `aux`, and `git-committer` use `capability_mode: execute`. Route DeepSeek reviewer fallback by agent type: if the 0731 role fails specifically for model availability, allowance exhaustion, or model-specific capacity/rate limiting, spawn `critic-flash` or `integration-reviewer-flash`. Do **not** retry `critic` or `integration-reviewer` with an in-place `model: deepseek-v4-flash` override. Do not change models for authentication, network, context, test, or ordinary task failures. A child that inherits `grok-4.6` is a routing bug. Commits go to `git-committer` / `gemma4`, never to the orchestrator.

Direct CLI launches of a NaN agent must also set `--model`, because `--agent` alone keeps the session default:

```bash
grok --agent aux --model gemma4 --always-approve
```

### Builder choice

The orchestrator chooses one builder per objective.

- Prefer `builder-qwen` for toolchain, contracts, determinism, serialization, input, replay, evaluator registries, tests, and CLI glue.
- Prefer `builder-mimo` for locomotion feel, ball integration, later presentation, or any task that needs a large spec window.
- After a failed attempt, switch builder if the critic says the approach is structurally wrong. Keep the same builder if the fix list is local.

Grok 4.6 never implements. If Qwen and MiMo repeatedly fail, Grok must reconsider or decompose the objective, apply critic feedback, try another appropriate NaN model/agent, or mark the objective blocked with evidence.

### Parallel builders

Allow two builders only when all of these are true:

- their file sets do not overlap
- they do not both change world/schema/config contracts
- `gauntlet/objectives.md` lists the pair as isolatable

The usual isolatable pair is `BOOTSTRAP-07` and `BOOTSTRAP-08` once input exists. Critics may run in parallel; they are read-only.

## Model routing

| Role | Exact model | Fallback |
|---|---|---|
| Orchestrator | `grok-4.6` | `orchestrator-deepseek` at ≥89% SuperGrok weekly usage (`/usage`). Do not fall back to Grok 4, 4.5, or 4.20. |
| Overflow orchestrator | `deepseek-v4-flash` (high reasoning) | explicit relaunch on `deepseek-v4-flash-0731` only for model-specific availability/allowance/capacity failure |
| Primary builders | `qwen3.6` and `mimo-v2.5` | the other builder |
| Primary critic | `critic` / `deepseek-v4-flash-0731` | `critic-flash` / `deepseek-v4-flash`, then `critic-mimo` if the builder was Qwen or `critic-qwen` if the builder was MiMo |
| Integration reviewer | `integration-reviewer` / `deepseek-v4-flash-0731` | `integration-reviewer-flash` / `deepseek-v4-flash`, then a NaN model that is not the builder under review |
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

Grok loads custom models only from user `~/.grok/config.toml`, not from project `.grok/config.toml`. Add these blocks once per machine:

```toml
# Quote keys that contain dots. Unquoted [model.qwen3.6] is a nested table.
[model."qwen3.6"]
model = "qwen3.6"
base_url = "https://api.nan.builders/v1"
name = "Qwen 3.6 (NaN)"
env_key = "NAN_API_KEY"
context_window = 262144
api_backend = "chat_completions"

[model."mimo-v2.5"]
model = "mimo-v2.5"
base_url = "https://api.nan.builders/v1"
name = "Xiaomi MiMo V2.5 (NaN)"
env_key = "NAN_API_KEY"
context_window = 500000
api_backend = "chat_completions"

[model."deepseek-v4-flash"]
model = "deepseek-v4-flash"
base_url = "https://api.nan.builders/v1"
name = "DeepSeek V4-Flash (NaN)"
env_key = "NAN_API_KEY"
context_window = 500000
api_backend = "chat_completions"

[model."deepseek-v4-flash-0731"]
model = "deepseek-v4-flash-0731"
base_url = "https://api.nan.builders/v1"
name = "DeepSeek V4-Flash 0731 (NaN)"
env_key = "NAN_API_KEY"
context_window = 500000
api_backend = "chat_completions"

[model."gemma4"]
model = "gemma4"
base_url = "https://api.nan.builders/v1"
name = "Gemma 4 (NaN)"
env_key = "NAN_API_KEY"
context_window = 262144
api_backend = "chat_completions"
```

Also add this per-type map in the same user file so spawned agents do not inherit `grok-4.6`:

```toml
[subagents.models]
builder-qwen = "qwen3.6"
builder-mimo = "mimo-v2.5"
critic = "deepseek-v4-flash-0731"
critic-flash = "deepseek-v4-flash"
critic-qwen = "qwen3.6"
critic-mimo = "mimo-v2.5"
integration-reviewer = "deepseek-v4-flash-0731"
integration-reviewer-flash = "deepseek-v4-flash"
aux = "gemma4"
git-committer = "gemma4"
orchestrator-deepseek = "deepseek-v4-flash"

[session]
auto_compact_threshold_percent = 65
```

Confirm with `grok models`. The process must have `NAN_API_KEY` set. A missing key registers the names but every NaN request fails with 401.

## Loop

```text
OBJECTIVE
  ↓
BUILDER
  ↓
tests + class-specific artifacts
  ↓
gauntlet:audit (deterministic facts; persists audit.json)
  ├─ FAIL/builder → retry builder
  ├─ FAIL/orchestrator → repair state and re-audit
  └─ REVIEW_REQUIRED → bounded aux/Gemma audit → re-enter gate
  ↓
mandatory independent CRITIC (reference-bar quality)
  ↓
INTEGRATION REVIEWER
  ↓
FINAL EVIDENCE GATE
  ↓
CANDIDATE SNAPSHOT COMMIT (code + exact reviewed evidence)
  ↓
acceptance:persist → objective manifest.json + acceptance result
  ↓
update CURRENT/HISTORY/HORIZON/TIMING
  ↓
gauntlet:eval:state
  ↓
FINAL ACCEPTANCE COMMIT
  ↓
ACCEPT → next horizon objective / strategic reassessment
```

A candidate snapshot is not acceptance. The orchestrator may only claim an objective is fully accepted/committed after durable result + manifest + accepted state + state audit + final commit exist. Deterministic and cheap semantic audits can block progression but cannot accept an objective. See `gauntlet/principles.md`, `gauntlet/evidence-classes.md`, `gauntlet/evidence-contract.md`, and `gauntlet/evidence-manifest-contract.md`.

Reviewer fallback, rolling-horizon planning, retry/revert semantics, SuperGrok handoff, and builder/critic model independence remain unchanged. Horizon exhaustion triggers strategic reassessment and continuation; it is not a normal stop.

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
  VERSION.json              authoritative Gauntlet SemVer
  README.md                 this document
  PROMPT.md                 the /gauntlet prompt body
  models.json               exact role → model map
  objectives.md             candidate objectives / prioritization guide
  evidence-contract.md      evidence-class and review contract
  evidence-manifest-contract.md durable objective/video/milestone provenance
  state/CURRENT.md          live board
  state/HISTORY.md          append-only iteration log
  state/TIMING.md           session wall-clock, tokens, model grades
  state/HANDOFF.md          overflow pickup for orchestrator-deepseek
  evals/                    deterministic audits/regression scenarios/results
  artifacts/                generated, gitignored

docs/evidence/<objective>/  trajectory/audit/manifest/video metadata
docs/screenshots/<objective>/ screenshots + optional semantic sequence

.grok/agents/               project-local agent prompts (not global)
.grok/skills/gauntlet/      /gauntlet skill
.grok/config.toml           project deny rules
AGENTS.md                   repository rules for every agent
```

Do not add these agents under `~/.grok/agents/`. That would make them appear in every Grok project on the machine.

## Change model routing later

1. Edit `gauntlet/models.json`.
2. Copy the same Grok slugs into `.grok/agents/<name>.md` frontmatter `model`.
3. If a NaN API id or endpoint changes, update the matching `[model.*]` block and `[subagents.models]` map in `~/.grok/config.toml`.
4. Keep the default orchestrator on `grok-4.6`. Overflow `orchestrator-deepseek` defaults to current `deepseek-v4-flash`; the 0731 snapshot is only its explicit model-specific fallback. Critic/integration fallback between 0731 and current Flash uses distinct agent types, never an in-place model override.
5. Confirm with `grok models` that the IDs exist.
6. Record semantic routing changes in `docs/gauntlet-changelog.md`; do not write routing-rule changes into generated live state solely for documentation.

Do not put builder work on Grok by editing only the builder frontmatter. If a NaN model ID changes, update both builders and the matching fallback critics so independence rules still resolve.

## Permissions

Unattended Gauntlet is the intended mode. Launch with `grok --agent orchestrator --always-approve`.

- Orchestrator cannot edit `src/`, `eval/`, or specs. It writes Gauntlet state only. That limit is in the agent prompt; Grok project denies are session-wide and would also block builders if pointed at `src/`.
- Builders can create and edit implementation files. They cannot edit specs, research, or `.grok/agents/`.
- Critics and the integration reviewer cannot edit files. They may run read-only validation (`git`, `mise`, `pnpm`, `npx`, `node`, `vitest`, and inspect commands).
- Orchestrator, builders, critics, and `aux` must not `git commit`, `git push`, `git rebase`, `sudo`, or `rm -rf /`. After critic + integration ACCEPT and the orchestrator evidence gate, the orchestrator may delegate a **candidate snapshot commit** to `git-committer`; after persistence + state audit it delegates the separate final acceptance/bookkeeping commit. `git-committer` may push only when the parent prompt says so.
- Builders must run installs non-interactively (`CI=1`, `mise trust --all` after writing `mise.toml`).
