# Gauntlet Loop

Harness-neutral orchestration for this football simulation through Grok, OMP and OpenCode. It is project-specific, not a generic agent framework.

The loop is:

```text
player problem → smallest playable slice → build → baseline + affected assurance → normal play → materially better? accept : iterate
```

All Gauntlet agents, skills, routing, deterministic evals, and contracts live in this repository. NaN endpoint registration/auth remains user-level runtime configuration; the repo only declares which registered model IDs each role uses.

## Gauntlet system version

`gauntlet/VERSION.json` is the canonical SemVer declaration for the complete harness. A version becomes a published release after merge to `main` and publication of the immutable `gauntlet-vX.Y.Z` tag.

Current candidate: **0.13.2** over 0.13.1.

0.13.2 recovers rebased execution provenance using verified whole-tree identity and permits one full current certification of changed product inputs behind an unattested legacy import. Historical UNKNOWN and consumed recovery remain unchanged. See `RELEASE-0.13.2.md`.

0.12.0 separates durable objective acceptance from whole-repository milestone/release certification. Each objective runs baseline plus deterministic affected checks; high-risk/unknown changes still require complete checks. Content-addressed check proofs avoid repeating unchanged valid checks after repair. Supported unrelated harness certification failures preserve bounded same-Horizon progress; known product/unknown failures block it, and certification is mandatory before a fifth uncertified objective. All three adapters load the same policy. Timeouts/recovery limits and application behavior are unchanged. See `RELEASE-0.12.0.md` and `product-quality-contract.md`. No measured speedup is claimed.

0.11.3 adds a scoped 40-minute whole Node check and a persisted two-attempt/90-minute recovery budget. Exhaustion produces `RECOVERY_BLOCKED` across OMP, Grok and OpenCode. The verification-batch wrapper allows the canonical runner to enforce these inner limits. See `RELEASE-0.11.3.md` and `product-quality-contract.md`.

0.11.2 stops canonical quality execution at the first failure and requires a diagnosed, source-bound repair check before one fresh full gate. It adds pinned-toolchain/root preflight, bounded processes and diagnostic-only recovery across all harnesses. See `RELEASE-0.11.2.md` and `product-quality-contract.md`.

0.11.1 adds the installed-version/active-role/model startup announcement to the OMP skill, matching Grok. New trajectory records read the canonical version instead of hardcoding 0.11.0. See `RELEASE-0.11.1.md`.

0.11.0 makes a materially better normal-play result the Horizon success criterion. It adds a frozen historical trajectory baseline, deterministic impact-based assurance/review requirements, and append-only selection/first-play/outcome measurements. See `RELEASE-0.11.0.md`, `product-quality-contract.md` and `trajectory-contract.md`. No measured speedup is claimed.

0.10.0 adds runtime-connected OMP telemetry first, then opt-in bounded memory/context, builder checkpoints/rotation and verification batching. All optimizations are disabled until a measured baseline is reviewed. See `gauntlet/runtime-efficiency-contract.md`; current routing and acceptance guarantees remain unchanged.

0.9.9 keeps product-first planning and adds issue-gated parallel execution. GitHub issues are optional for sequential work and mandatory for parallel implementation work. Parallel workers start only from synchronized `READY` issues. OMP also applies conservative NaN concurrency limits and blocks invalid parallel builder batches.

`gauntlet/state/CURRENT.md` uses `gauntlet_version: gauntlet-loop-v1` as the persisted loop/state protocol identifier; it is not the Gauntlet system SemVer. The canonical release version remains `gauntlet/VERSION.json`.

## Launch and continuation

All three user-facing entry points continue the same persisted Gauntlet work and preserve the same horizon, evidence, review, acceptance, publication, and timing rules. Choose the entry point by the parent orchestrator model you want to use. Optional trailing text is a focus/priority hint only.

### Grok 4.6

```bash
export NAN_API_KEY=...
grok --agent orchestrator --always-approve
```

Then:

```text
/gauntlet [optional focus]
```

### DeepSeek Flash

```bash
grok --agent orchestrator-deepseek --model deepseek-v4-flash --reasoning-effort high --always-approve
```

Then:

```text
/gauntlet-continue [optional focus]
```

The Grok 4.6 quota handoff still points to this DeepSeek continuation route, but the route is also valid as a direct continuation entry point when DeepSeek is the available parent model.

### GLM 5.3 Flash

```bash
grok --agent orchestrator-glm --model glm5.3-flash --reasoning-effort high --always-approve
```

Then:

```text
/gcont [optional focus]
```

There is no deprecated DeepSeek `0731` snapshot fallback in current Gauntlet routing. Historical state/timing records may retain an exact old model ID as provenance, but executable routing and launch instructions must use current model IDs.

## Canonical role contracts

Shared behavior lives once:

- orchestrator: `gauntlet/PROMPT.md`
- critic: `gauntlet/roles/critic.md`
- integration reviewer: `gauntlet/roles/integration-reviewer.md`
- structured builder: `gauntlet/roles/builder-structured.md`
- gameplay builder: `gauntlet/roles/builder-gameplay.md`
- git committer: `gauntlet/roles/git-committer.md`

`.grok/agents/*.md` files are thin runtime wrappers containing frontmatter/model binding plus only runtime-specific behavior. Shared rules belong in the canonical role contracts.

Two deterministic checks protect this split: wrappers must reference an existing canonical contract, and wrapper frontmatter models must match `gauntlet/models.json`.

## Current agents

| Agent | Kind | Model | Job |
|---|---|---|---|
| `orchestrator` | primary | `grok-4.6` | canonical orchestration; hands off at the configured weekly threshold |
| `orchestrator-deepseek` | continuation primary | `deepseek-v4-flash` | resumes the same persisted Gauntlet work with DeepSeek |
| `orchestrator-glm` | continuation primary | `glm5.3-flash` | resumes the same persisted Gauntlet work with GLM |
| `builder-structured` | subagent | `deepseek-v4-flash` | toolchain, contracts, determinism, evaluators, tests, structured TypeScript |
| `builder-gameplay` | subagent | `qwen3.8-flash` | gameplay, ball/control/team behavior, presentation-facing integration |
| `critic` | subagent | `glm5.3-flash` | primary independent qualitative critic |
| `critic-qwen` | fallback critic | `qwen3.6` | independent critic fallback |
| `critic-mimo` | fallback critic | `mimo-v2.6-flash` | independent critic fallback |
| `integration-reviewer` | subagent | `glm5.3-flash` | primary integration/neighbouring-regression review |
| `integration-reviewer-qwen` | fallback integration | `qwen3.6` | independent integration fallback |
| `integration-reviewer-mimo` | fallback integration | `mimo-v2.6-flash` | independent integration fallback |
| `aux` | subagent | `gemma4` | cheap summaries and bounded semantic audit |
| `git-committer` | subagent | `gemma4` | atomic conventional commits and requested publication |

Exact IDs and fallback ordering live in `gauntlet/models.json`. The preserved routing generation is `gauntlet-models-v9`. The same file also declares harness routes for Grok, OMP, and OpenCode; `gauntlet/harness-contract.md` defines how adapters consume them.

## Model routing

Current registered model IDs used by the Gauntlet are:

- `deepseek-v4-flash`
- `qwen3.8-flash`
- `glm5.3-flash`
- `qwen3.6`
- `mimo-v2.6-flash`
- `gemma4`
- `grok-4.6` for the parent orchestrator

`deepseek-v4-flash-0731` is deprecated and is not part of current executable Gauntlet routing.

Primary reviewer routing:

| Role | Primary | Fallbacks |
|---|---|---|
| Critic | `critic` / `glm5.3-flash` | `critic-qwen`, then `critic-mimo` |
| Integration reviewer | `integration-reviewer` / `glm5.3-flash` | `integration-reviewer-qwen`, then `integration-reviewer-mimo` |
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

## Harness adapters

Gauntlet core is harness-neutral. Canonical roles, evidence rules, product policy, and acceptance rules live under `gauntlet/`. Runtime directories such as `.grok/`, `.omp/`, and `.opencode/` are adapters.

The current orchestrator routes are:

- Grok: `grok-4.6`;
- OMP: `glm5.3-flash` with high reasoning;
- OpenCode: `grok-4.6`.

OMP has no Grok dependency. Its project adapter uses NaN models only. See `.omp/README.md`.

## Product-first planning

Read `gauntlet/product-flow-contract.md`.

A normal horizon starts from one player-visible result. The orchestrator selects 1–4 internal objectives only as necessary to deliver or protect the smallest playable slice. It reaches normal play early, records the comparison, and iterates when the result is not materially better. Accepted objectives alone do not complete a Horizon. A feature is not product-complete if it exists only in fixtures, test bridges, capture paths, or gated code that normal shipped play does not use.

GitHub issues can hold compact task context, dependencies, acceptance criteria, and links to evidence. They are optional for sequential execution and mandatory for parallel implementation execution. Canonical execution and acceptance state remain in `gauntlet/state/**` and accepted evidence.

Before parallel fan-out, create a plan from `gauntlet/parallel-plan.example.json` and run `pnpm run gauntlet:parallel:sync -- --plan artifacts/gauntlet/parallel-plan.json`. Only synchronized `READY` objectives may start. If GitHub write access is unavailable, execute sequentially. Each parallel objective uses an isolated workspace/worktree and keeps its own review and acceptance chain.

OMP limits implementation fan-out to five workers and NaN provider requests to six in flight. The NaN base plan allows seven simultaneous requests per API key, so this leaves one request of headroom.

0.9.9 does not rewrite execution-owned `gauntlet/state/**`. An existing valid product-first horizon remains valid. Issue synchronization is required only when the orchestrator selects parallel implementation.

## Acceptance pipeline

```text
OBJECTIVE
  ↓
BUILDER ROLE
  ↓
always-on baseline + affected-domain assurance + class-specific artifacts
  ↓
gauntlet:audit
  ↓
impact-required independent CRITIC / deterministic NOT_REQUIRED
  ↓
impact-required INTEGRATION REVIEWER / deterministic NOT_REQUIRED
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
objective ACCEPT → enabling objective or normal play
  ↓
product comparison + append-only trajectory
  ↓
Horizon ACCEPT / ITERATE
```

Deterministic and bounded semantic audits may invalidate or request more evidence but cannot substitute for an impact-required qualitative critic. The baseline always applies; only explicit trivial leaf changes with no protected or elevated risk may waive both reviews.

## Timing bookkeeping

`gauntlet/state/TIMING.md` is acceptance persistence. 0.9.9 requires all four tracking markers to reach the latest accepted objective:

```yaml
last_tracked_objective: <objective-id>
usage_aggregates_through: <objective-id>
model_evaluation_through: <objective-id>
clock_aggregates_through: <objective-id>
```

The global Clock/session aggregates must be refreshed when their source rows change. Advancing the other markers while leaving old global totals is a state-audit failure owned by the orchestrator, not a gameplay regression. See `gauntlet/timing-contract.md`.

Timing/model statistics remain separated by exact model ID and role so work performed under Grok, DeepSeek, and GLM orchestration can be compared without changing the Gauntlet workflow.

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

1. Edit `gauntlet/models.json` and increment its routing-generation version when the effective mapping changes.
2. Change the matching `.grok/agents/<name>.md` frontmatter model in the same change, for every route declared in `gauntlet/models.json` — optional primary routes included.
3. Add/remove fallback wrappers only when the fallback actually uses a different model/route.
4. Keep shared role behavior in `gauntlet/roles/**` / `gauntlet/PROMPT.md`.
5. Update capability declarations only from observed/provider-backed facts; unknown capability stays unknown.
6. Update `gauntlet/VERSION.json` when routing behavior changes after a published Gauntlet release, and advance the version needles pinned in the `semver system version is declared` check in `gauntlet/evals/src/prompt-gate.ts`.
7. Run `pnpm run gauntlet:eval` and Maintenance PR CI.
8. Record release/routing changes in the Gauntlet release notes/changelog.

Authoritative product specs remain:

- `specs/TECHNICAL_SPEC.md`
- `specs/GAMEPLAY_EVALUATION_SPEC.md`
- `specs/VISUAL_SPEC.md`
