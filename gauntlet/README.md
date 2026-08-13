# Gauntlet Loop

OpenCode orchestration for this football simulation. It is project-specific. It is not a generic agent framework.

The loop is:

```text
orchestrator → builder → evidence → critic → fix/retry → acceptance → regression → next objective
```

The orchestrator is Grok 4.6 (`xai/grok-4.6`), not Grok 4 or another 4.x ID. High-token implementation, testing, fixing, experimentation, and repeated criticism stay on NaN models.

All Gauntlet agents, the `/gauntlet` command, and model routing live **in this repository**. They are not installed into `~/.config/opencode/agents/`, `~/.agents/`, or oxStack. OpenCode loads them from project `.opencode/` and `opencode.json` when the working directory is this repo.

An empty implementation is a valid start. `BOOTSTRAP-01` is the initial objective only while the toolchain and `src/` are missing. After each accepted objective the orchestrator reassesses from actual project state, evidence, research, and specs.

## Launch

From the repository root:

```bash
opencode
```

This project sets `default_agent` to `orchestrator`. Then run:

```text
/gauntlet
```

That is the single prompt. The orchestrator inspects the tree and starts the next iteration.

Equivalent explicit launches:

```bash
opencode --agent orchestrator
```

```bash
opencode run --agent orchestrator "$(cat gauntlet/PROMPT.md)"
```

Optional extra focus after `/gauntlet`:

```text
/gauntlet continue from BOOTSTRAP-07 only
```

Do not start OpenCode on the built-in `build` agent for this loop. Tab to `orchestrator` if the session is on another primary agent.

## Agents

| Agent | Kind | Default model | Writes | Job |
|---|---|---|---|---|
| `orchestrator` | primary | `xai/grok-4.6` | `gauntlet/state/**`, `gauntlet/objectives.md` | Inspect, prioritize, delegate, accept/revert, choose the next objective |
| `builder-qwen` | subagent | `nan/qwen3.6` | implementation files | Structured TypeScript, toolchain, contracts, tests, registries |
| `builder-mimo` | subagent | `nan/mimo-v2.5` | implementation files | Large-context gameplay/presentation work |
| `critic` | subagent | `nan/deepseek-v4-flash-0731` | none | Independent evaluation of builder evidence |
| `critic-qwen` | hidden subagent | `nan/qwen3.6` | none | Fallback critic when DeepSeek is unavailable and Qwen did not implement |
| `critic-mimo` | hidden subagent | `nan/mimo-v2.5` | none | Fallback critic when DeepSeek is unavailable and MiMo did not implement |
| `integration-reviewer` | subagent | `nan/deepseek-v4-flash-0731` | none | Architecture and neighboring-regression review after critic accept |
| `aux` | subagent | `nan/gemma4` | none | Cheap summaries, file lists, artifact condensation |

Exact IDs are in `gauntlet/models.json` and must match `opencode.json` plus the agent frontmatter.

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
| Orchestrator | `xai/grok-4.6` | `xai/grok-4.6-fast` only. Do not fall back to Grok 4, 4.5, or 4.20. |
| Primary builders | `nan/qwen3.6` and `nan/mimo-v2.5` | the other builder |
| Primary critic | `nan/deepseek-v4-flash-0731` | `critic-mimo` if the builder was Qwen; `critic-qwen` if the builder was MiMo |
| Integration reviewer | `nan/deepseek-v4-flash-0731` | a NaN model that is not the builder under review |
| Cheap auxiliary | `nan/gemma4` | `nan/qwen3.6` |

Hard rule: the critic model must differ from the implementation model for that candidate.

Use NaN models for high-token implementation, test fixing, experimentation, and repeated criticism. Use Grok 4.6 for orchestration, prioritization, delegation, integration decisions, and what happens next.

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

.opencode/agents/           project-local agent prompts (not global)
.opencode/commands/gauntlet.md
opencode.json               project default agent, models, NaN provider
AGENTS.md                   repository rules for every agent
```

Do not add these agents under `~/.config/opencode/`. That would make them appear in every OpenCode project on the machine.

## Change model routing later

1. Edit `gauntlet/models.json`.
2. Copy the same `provider/model` IDs into:
   - `opencode.json` → `agent.<name>.model`
   - `.opencode/agents/<name>.md` → frontmatter `model`
3. Keep `small_model` on a cheap NaN model (`nan/gemma4` or `nan/qwen3.6`).
4. Keep the orchestrator on `xai/grok-4.6`. Do not point it at Grok 4, 4.5, 4.20, or another non-4.6 ID.
5. Confirm with `opencode models` that the IDs exist.
6. Record the change in `gauntlet/state/HISTORY.md`.

Do not put builder work on Grok by editing only the builder frontmatter. If a NaN model ID changes, update both builders and the matching hidden critics so independence rules still resolve.

## Permissions

- Orchestrator cannot edit `src/`, `eval/`, or specs. It writes Gauntlet state only.
- Builders can create and edit implementation files. They cannot edit specs, research, or `.opencode/agents/`.
- Critics and the integration reviewer cannot edit files.
- Nobody in this loop should `git push`. Commits are optional and outside the default loop; accepted work stays in the working tree.
