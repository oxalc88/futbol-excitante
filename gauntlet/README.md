# Gauntlet Loop

Grok Build orchestration for this football simulation. It is project-specific. It is not a generic agent framework.

The loop is:

```text
orchestrator → builder → evidence → critic → fix/retry → acceptance → regression → next objective
```

The orchestrator is Grok 4.6 (`grok-4.6`), not Grok 4 or another 4.x ID. High-token implementation, testing, fixing, experimentation, and repeated criticism stay on NaN models.

All Gauntlet agents, the `/gauntlet` skill, and model routing live **in this repository**. They are not installed into `~/.grok/agents/`, oxStack, or a global plugin. Grok loads them from project `.grok/agents/` and `.grok/skills/` when the working directory is this repo.

NaN model endpoints cannot live in the repo. Register them once in `~/.grok/config.toml` (see [NaN models](#nan-models)). Runtime auth is `NAN_API_KEY`. Grok cannot reuse an OpenCode persisted `nan` login.

An empty implementation is a valid start. `BOOTSTRAP-01` is the initial objective only while the toolchain and `src/` are missing. After each accepted objective the orchestrator reassesses from actual project state, evidence, research, and specs.

`.opencode/` and `opencode.json` are unused leftovers from the OpenCode harness. Do not launch this loop with `opencode`.

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

`--always-approve` skips permission prompts. Project `.grok/config.toml` still denies `git push`, `git commit`, `git rebase`, `sudo`, and `rm -rf /`. Do not start Grok on the built-in `general-purpose` agent for this loop unless you then run `/gauntlet` and stay on Grok 4.6.

## Agents

| Agent | Kind | Default model | Writes | Job |
|---|---|---|---|---|
| `orchestrator` | primary | `grok-4.6` | `gauntlet/state/**`, `gauntlet/objectives.md` | Inspect, prioritize, delegate, accept/revert, choose the next objective |
| `builder-qwen` | subagent | `qwen3.6` | implementation files | Structured TypeScript, toolchain, contracts, tests, registries |
| `builder-mimo` | subagent | `mimo-v2.5` | implementation files | Large-context gameplay/presentation work |
| `critic` | subagent | `deepseek-v4-flash-0731` | none | Independent evaluation of builder evidence |
| `critic-qwen` | fallback subagent | `qwen3.6` | none | Fallback critic when DeepSeek is unavailable and Qwen did not implement |
| `critic-mimo` | fallback subagent | `mimo-v2.5` | none | Fallback critic when DeepSeek is unavailable and MiMo did not implement |
| `integration-reviewer` | subagent | `deepseek-v4-flash-0731` | none | Architecture and neighboring-regression review after critic accept |
| `aux` | subagent | `gemma4` | none | Cheap summaries, file lists, artifact condensation |

Exact IDs are in `gauntlet/models.json` and must match `.grok/agents/<name>.md` frontmatter `model` plus the `[model.*]` blocks in `~/.grok/config.toml`.

The orchestrator delegates with `spawn_subagent`. `subagent_type` is the agent name. Builders use `capability_mode: all`. Critics, the integration reviewer, and `aux` use `capability_mode: execute`. Pass `model` from `gauntlet/models.json`. A child that inherits `grok-4.6` is a routing bug.

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
| Orchestrator | `grok-4.6` | none. Do not fall back to Grok 4, 4.5, or 4.20. |
| Primary builders | `qwen3.6` and `mimo-v2.5` | the other builder |
| Primary critic | `deepseek-v4-flash-0731` | `critic-mimo` if the builder was Qwen; `critic-qwen` if the builder was MiMo |
| Integration reviewer | `deepseek-v4-flash-0731` | a NaN model that is not the builder under review |
| Cheap auxiliary | `gemma4` | `qwen3.6` |

Hard rule: the critic model must differ from the implementation model for that candidate.

Use NaN models for high-token implementation, test fixing, experimentation, and repeated criticism. Use Grok 4.6 for orchestration, prioritization, delegation, integration decisions, and what happens next.

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
critic-qwen = "qwen3.6"
critic-mimo = "mimo-v2.5"
integration-reviewer = "deepseek-v4-flash-0731"
aux = "gemma4"
```

Confirm with `grok models`. The process must have `NAN_API_KEY` set. A missing key registers the names but every NaN request fails with 401.

## Loop

```text
inspect repo + CURRENT.md
        │
        ▼
select next objective
        │
        ▼
choose builder (Qwen or MiMo)
        │
        ▼
builder implements and runs evidence
        │
        ▼
independent critic
   ├── RETRY ──► same or switched builder (max 3)
   ├── REJECT ─► revert candidate files, new hypothesis
   └── ACCEPT
        │
        ▼
integration-reviewer
   ├── REJECT ─► revert, return to builder
   └── ACCEPT
        │
        ▼
record acceptance, reassess, next objective
```

Details:

1. Inspect `git status`, the tree, `gauntlet/state/CURRENT.md`, current evidence, research, and specs.
2. Choose the highest-value next gap. `gauntlet/objectives.md` and milestones guide that choice; they are not a fixed backlog. Use `BOOTSTRAP-01` only while the repo is empty of toolchain/`src/`.
3. Delegate one coherent change. Quote the spec sections and acceptance tests in the task.
4. Require the builder report in `gauntlet/evidence-contract.md`. Commands must have been executed.
5. Invoke `critic` with the report, diff, and required tests. Default model is DeepSeek.
6. On `RETRY`/`REJECT`, keep previously accepted work. Revert only the failed candidate files, then send `required_fixes` back.
7. Critic `ACCEPT` is not final. Run `integration-reviewer`.
8. After both pass, update `CURRENT.md` and append `HISTORY.md`.
9. Reassess from the new project state and choose the next objective. Stop only for a human-needed legal/spec blocker or when a repeatedly failed objective is marked blocked with evidence.

Retry budget per objective: 3, then switch NaN builder. If both still fail, Grok decomposes, reroutes to another NaN agent, or blocks the objective. Grok does not implement.

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
  README.md                 this document
  PROMPT.md                 the /gauntlet prompt body
  models.json               exact role → model map
  objectives.md             candidate objectives / prioritization guide
  evidence-contract.md      builder/critic/review report shape
  state/CURRENT.md          live board
  state/HISTORY.md          append-only iteration log
  artifacts/                generated, gitignored

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
4. Keep the orchestrator on `grok-4.6`. Do not point it at Grok 4, 4.5, 4.20, or another non-4.6 ID.
5. Confirm with `grok models` that the IDs exist.
6. Record the change in `gauntlet/state/HISTORY.md`.

Do not put builder work on Grok by editing only the builder frontmatter. If a NaN model ID changes, update both builders and the matching fallback critics so independence rules still resolve.

## Permissions

Unattended Gauntlet is the intended mode. Launch with `grok --agent orchestrator --always-approve`.

- Orchestrator cannot edit `src/`, `eval/`, or specs. It writes Gauntlet state only. That limit is in the agent prompt; Grok project denies are session-wide and would also block builders if pointed at `src/`.
- Builders can create and edit implementation files. They cannot edit specs, research, or `.grok/agents/`.
- Critics and the integration reviewer cannot edit files. They may run read-only validation (`git`, `mise`, `pnpm`, `npx`, `node`, `vitest`, and inspect commands).
- Nobody in this loop should `git push`, `git commit`, `git rebase`, `sudo`, or `rm -rf /`. Commits are optional and outside the default loop; accepted work stays in the working tree.
- Builders must run installs non-interactively (`CI=1`, `mise trust --all` after writing `mise.toml`).
