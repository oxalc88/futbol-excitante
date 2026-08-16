# Gauntlet changelog

Human-readable history of meaningful changes to the Gauntlet's **rules, prompts, role boundaries, routing, evidence requirements, prompt-loading behavior, and orchestration-eval contract**.

This changelog does **not** record normal gameplay objectives or routine live-state updates produced by the running Gauntlet. Git remains the source of truth for exact file contents and diffs.

## 2026-08-16 — Durable evidence provenance and acceptance continuation

**Gauntlet system version (SemVer):** `0.8.0`  
**Previous system version:** `0.7.0`

### Changed

- Added one immutable `docs/evidence/<objective-id>/manifest.json` for every objective newly accepted under 0.8. The manifest indexes the objective, evidence class, candidate commit, acceptance date, screenshots, semantic sequence, trajectory, metrics, optional video reference, deterministic audit, semantic audit when used, critic, integration review, and acceptance record.
- Added artifact ↔ commit provenance. Screenshots, trajectories, deterministic-audit artifacts, and sequence metadata are SHA-256 hashed and must be byte-identical to the artifacts stored in the candidate commit. The manifest also records the corresponding Git blob.
- Split committing into a reviewed **candidate snapshot commit** and a later acceptance/bookkeeping commit. The candidate snapshot exists only to bind reviewed code and evidence to an exact SHA; it is not itself final acceptance.
- Added semantic visual sequences for `DYNAMIC_VISUAL` objectives. Dynamic behavior now requires 3–5 labeled frames plus `sequence.json`; static browser/presentation objectives may still use one screenshot.
- `gauntlet:audit` now persists its structured result beside objective evidence as `audit.json`.
- Added durable optional video metadata through `video-reference.json` and `gauntlet:video:reference`, recording objective, provider artifact ID/name, creation/expiration metadata, and candidate commit while allowing the binary video itself to remain external/ephemeral.
- Added `gauntlet:milestone:bundle` to build derived evidence packages for important milestones such as playable 2v2, 5v5, and 11v11 without mutating source objective evidence.
- Added `ORCH-REG-014` to reject verbal "fully accepted/committed" claims that are not backed by durable acceptance record, objective manifest, accepted state, and candidate commit.
- Added `ORCH-REG-015` so a finalized objective cannot terminate the loop: a remaining objective continues immediately and an exhausted horizon triggers strategic reassessment and continuation.
- Added `ORCH-REG-016` for mandatory 0.8 objective manifests and provenance, and `ORCH-REG-017` for required semantic sequences on dynamic visual behavior.
- Extended the live state audit so, once 0.8 acceptance records exist, the latest accepted objective must also have an acceptance-complete objective manifest.
- Preserved all pre-0.8 evidence as historical evidence. No migration rewrites, replaces, or cleans old screenshots/manifests retroactively; imperfect "before" evidence remains part of the project history.
- Centralized shared role behavior: `gauntlet/PROMPT.md` is the canonical orchestrator contract, while critic and integration-reviewer behavior moved to `gauntlet/roles/`. `.grok/agents/` now keeps thin runtime/model wrappers instead of duplicated review prompts.
- Replaced model-named builders with responsibility-named roles: `builder-structured` for tooling/contracts/deterministic/evaluator/test work and `builder-gameplay` for gameplay/ball/control/team-behavior/presentation-facing integration. Model assignment remains routing data in `gauntlet/models.json`.
- Added only two deterministic guards for the role refactor: wrappers must reference an existing canonical role contract, and wrapper frontmatter models must match `gauntlet/models.json`. No extra scenario/eval matrix was added.
- Added a post-merge release workflow that only publishes the immutable `gauntlet-v<version>` tag when `gauntlet/VERSION.json` changes on `main`. The workflow does not decide SemVer and does not rerun Gauntlet evaluation.

### Why

A live overflow run received critic fallback `ACCEPT` and then stated that `BROWSER-2V2-PLAYABLE` was "fully accepted and committed" before stopping. A subsequent Git check showed local `main` and `origin/main` still at `ec3a177`, whose persisted state only accepted `BROWSER-2V2-MATCH-KEYBOARD`; the next objective remained pending. 0.8 therefore makes acceptance claims depend on durable facts rather than conversational conclusions and separately protects post-acceptance continuation.

The richer provenance is also intended to make project history reconstructable without reading all of `HISTORY.md` and to provide stable material for progress posts: exact code version, exact evidence, how it was audited, and what changed before/after.

The role refactor keeps the same runtime responsibilities while removing prompt drift between model fallbacks. Builder specialization is intentionally limited to the two responsibilities already demonstrated by the existing Qwen/MiMo prompts; additional builder roles are deferred until a concrete recurring need appears.

### Acceptance pipeline

`builder → tests/artifacts → deterministic audit → optional bounded cheap semantic audit → mandatory critic → integration reviewer → final evidence gate → candidate snapshot commit → persist acceptance + objective manifest → bookkeeping → state audit → final acceptance commit → ACCEPT → next objective/replan`

### Preserved Gauntlet philosophy

The canonical 0.7 principle remains unchanged: deterministic tooling may invalidate evidence/state but never substitutes for the qualitative critic against the reference bar. 0.8 changes durability, provenance, and prompt/routing organization, not who judges gameplay quality.

### Migration/runtime notes

- Applies prospectively to objectives accepted under 0.8; pre-0.8 evidence is not backfilled automatically.
- No manual `gauntlet/state/**` rewrite is part of this release.
- Existing video binaries may remain external or ephemeral; when a future objective uses video, durable metadata records how to find/download it before provider expiration.
- User-level `~/.grok/config.toml` must rename the builder mappings from `builder-qwen` / `builder-mimo` to `builder-structured = "qwen3.6"` and `builder-gameplay = "mimo-v2.5"`. Model endpoint definitions themselves do not change.
- `gauntlet/VERSION.json` represents the checkout; the published release is the immutable `gauntlet-vX.Y.Z` tag created after merge to `main`.

### Prompt/rule/tooling surface

- `gauntlet/VERSION.json`
- `gauntlet/PROMPT.md`
- `gauntlet/README.md`
- `gauntlet/roles/**`
- `gauntlet/models.json`
- `gauntlet/evidence-contract.md`
- `gauntlet/evidence-manifest-contract.md`
- `.grok/agents/**`
- `.grok/skills/gauntlet*/SKILL.md`
- `gauntlet/evals/**`
- `.github/workflows/publish-gauntlet-tag.yml`
- `tests/browser/capture-wip.browser.test.ts`
- `package.json`

---

## 2026-08-16 — Deterministic audit and semantic escalation

**Gauntlet system version (SemVer):** `0.7.0`  
**Previous normalized system version:** `0.6.0`  
**Legacy predecessor prompt generation:** `v6-browser-evidence-model-tracking`

### Changed

- Formalized SemVer for the complete project-local Gauntlet harness via `gauntlet/VERSION.json`; version now covers prompts, agents, skills, model routing, deterministic tooling/evals, evidence/timing contracts, acceptance persistence, and state audit.
- Added canonical `gauntlet/principles.md` so the acceptance philosophy is not duplicated token-for-token across agents. Runtime surfaces reference it and deterministic prompt gates enforce the operational consequences.
- Added class-based evidence requirements (`HEADLESS`, `BROWSER_VISIBLE`, `MULTI_TICK`, `DYNAMIC_VISUAL`, `PRESENTATION`, `BOOKKEEPING`).
- Added `gauntlet:audit`, a pre-critic deterministic gate for tests, evidence existence, screenshot SHA reuse, trajectory/integration requirements, CURRENT/HORIZON consistency, TIMING consistency, v0.7 result freshness, and optional slot/player wiring invariants.
- Added bounded semantic escalation: only `REVIEW_REQUIRED` findings go to existing `aux`/Gemma (Qwen fallback), under a closed `VALID|INVALID|INSUFFICIENT_CONTEXT` contract. This role cannot accept an objective or replace reference-bar criticism.
- Added `gauntlet:acceptance:persist`, which refuses candidate persistence unless deterministic audit passed, optional semantic review is valid, critic and integration both accepted, and builder/critic models are independent.
- Extended live state audit to check accepted-list consistency, CURRENT/HORIZON alignment, TIMING tracking/clock consistency, and v0.7 acceptance-result freshness. Historical v0.6-and-earlier objectives are a legacy baseline until the first v0.7 acceptance record exists.
- Added `ORCH-REG-008` through `ORCH-REG-013`, including a protected regression that deterministic/cheap audit success cannot bypass the critic.

### Acceptance pipeline

`builder → tests/artifacts → deterministic audit → optional bounded cheap semantic audit → mandatory critic → integration reviewer → final evidence gate → persist candidate result → bookkeeping → state audit → ACCEPT → next objective`

### Preserved Gauntlet philosophy

The qualitative critic remains the judge against the reference bar. Deterministic tooling removes mechanical work and can invalidate bad evidence/state; it does not convert the Gauntlet into CI or grant acceptance. The canonical wording is intentionally stored once in `gauntlet/principles.md`.

### Migration/runtime notes

No manual rewrite of `gauntlet/state/**` is part of this release. Existing state defects are surfaced by the new audit and must be repaired by the running orchestrator. Existing `aux = gemma4` routing is reused for bounded semantic audit, so no new user-level subagent mapping is required.

### Prompt/rule/tooling surface

- `gauntlet/VERSION.json`
- `gauntlet/principles.md`
- `gauntlet/PROMPT.md`
- `gauntlet/README.md`
- `gauntlet/evidence-contract.md`
- `gauntlet/evidence-classes.md`
- `gauntlet/semantic-audit-contract.md`
- `.grok/agents/orchestrator*.md`
- `.grok/skills/gauntlet*/SKILL.md`
- `gauntlet/evals/**`
- `gauntlet/models.json`
- `package.json`

---

## 2026-08-15 — Browser evidence and model tracking gates

**Prompt version:** `v6-browser-evidence-model-tracking`  
**Core eval/tracking commit:** `1a1113f5e0e076226a637d629bfd24ee0fa2c142`  
**PR:** `#7`

### Changed

- Extended mandatory screenshot evidence beyond the generic gameplay/presentation flag: any objective whose acceptance criteria require browser-visible or browser-interactive behavior is now explicitly screenshot-required.
- Added `ORCH-REG-005` so a browser objective cannot be accepted without the required screenshot even when the scenario is not otherwise classified as gameplay/presentation.
- Added `gauntlet/timing-contract.md`, making `TIMING.md` refresh part of acceptance persistence rather than optional bookkeeping.
- Added machine-readable tracking markers (`last_tracked_objective`, `usage_aggregates_through`, `model_evaluation_through`) that must match the latest accepted objective.
- Required each accepted objective to refresh its per-step timing/token usage, by-model usage aggregates, builder performance grade, and a reviewer/orchestrator route-and-catches row. Missing metrics must be `n/a` with a reason; timing, token, cost, or quality numbers may not be invented.
- Added `ORCH-REG-006` for incomplete TIMING/model tracking.
- Added `pnpm run gauntlet:eval:state`, a live persisted-state audit that compares `CURRENT.md` with TIMING tracking markers and required usage/evaluation rows.
- Kept `gauntlet:eval` deterministic and independent of mutable live state; the live state audit is instead a mandatory acceptance-time gate before `git-committer` receives the acceptance commit.
- Updated Grok and DeepSeek orchestrators plus `/gauntlet` and `/gauntlet-continue` so tracking repair is local bookkeeping and is not a reason to stop or send an accepted implementation back to a builder.

### Why

The existing screenshot regression covered gameplay/presentation work, but did not independently encode the stronger rule that a browser-visible/browser-interactive objective needs browser evidence. That left browser routing/input/state objectives dependent on correct informal classification.

`TIMING.md` already tracks per-step wall time/tokens, by-model usage, and model performance, but the orchestration evals did not verify that it was refreshed. The committed state demonstrates the gap: `CURRENT.md` records `CPU-BALL-PURSUIT` as the latest accepted objective while the existing TIMING snapshot predates that objective and does not evaluate it. This change deliberately does not rewrite generated state; `gauntlet:eval:state` should expose the stale tracking until the running orchestrator refreshes TIMING from real session/review data.

### Prompt/rule surface

- `gauntlet/PROMPT.md`
- `gauntlet/evidence-contract.md`
- `gauntlet/timing-contract.md` (new)
- `.grok/agents/orchestrator.md`
- `.grok/agents/orchestrator-deepseek.md`
- `.grok/skills/gauntlet/SKILL.md`
- `.grok/skills/gauntlet-continue/SKILL.md`
- `.grok/skills/gauntlet-eval/SKILL.md`
- `gauntlet/evals/**`
- `package.json`

---

## 2026-08-15 — Orchestration evals and continuation regression guard

**Prompt version:** `v5-continuation-regression-evals`  
**Eval foundation commit:** `32f796606e7b891f9b64feab69360f2156198460`  
**Continuation fix commit:** `8e0dd8b805294a40ce5185eaaa56ac288e332bf6`  
**Runtime/model eval commit:** `695838277d4b997ce542f6a60cc0f4bdd76f022b`

### Changed

- Added a project-local Gauntlet evaluation surface under `gauntlet/evals/`, separate from the football/gameplay evaluator under `eval/`.
- Adapted observability patterns from `aws-observability-instrumentation`: closed event/stop/failure taxonomies, stable naming, ownership boundaries, static enforcement, and structured agent-trace metadata without prompt/chain-of-thought capture.
- Added deterministic regression scenarios for mandatory screenshot evidence, duplicate horizon entries, explicit DeepSeek reviewer fallback, and stale accepted `active_candidate` continuation.
- Added `pnpm gauntlet:eval`, a static prompt contract gate, `/gauntlet-eval`, and a project-local Gauntlet observability skill.
- Added optional `pnpm gauntlet:eval:model` / `/gauntlet-eval-model` so the real configured orchestrator/model can be exercised against synthetic read-only scenarios. The returned structured decision is checked deterministically against scenario expectations.
- Added compact gitignored incident artifacts for deterministic, prompt-gate, and model-eval failures. They retain bounded metadata and expected/observed results, not complete prompts, transcripts, credentials, or chain-of-thought.
- Wired the zero-cost deterministic Gauntlet suite into `test-all`; model-backed evals remain opt-in because they consume model allowance/tokens.
- Made acceptance a single transition: clear the accepted objective from `active_candidate`, persist accepted/current/horizon state, commit, then continue to the indexed next objective.
- Defined an `active_candidate` that already appears in accepted state as stale bookkeeping. Pickup repairs it locally instead of attempting to resume an already accepted objective.
- Declared successful acceptance commits, stale-state repair, and horizon exhaustion as non-stop conditions. Horizon exhaustion triggers immediate strategic reassessment and continuation unless an explicit stop condition applies.
- Deliberately did not add a session-end hook in v1: Grok Build documents lifecycle hooks/`PreToolUse`, but this implementation does not depend on an unverified session-end blocking event contract.

### Why

A live run accepted `BROWSER-MATCH-PHASE-DISPLAY` and advanced `next_objective_id`/`HORIZON.current_index`, but `CURRENT.active_candidate` still pointed at the accepted objective. The newer pickup rules simultaneously said to resume an active candidate and not restart accepted work, creating a contradictory state that could end orchestration instead of launching the next objective.

The regression was a prompt/state-machine problem, so the fix is guarded like code: a deterministic fixture captures the known failure, static prompt checks prevent removal of the continuation semantics, and the optional model-backed runner can verify how the actual configured orchestrator/model interprets the same synthetic scenarios.

### Preserved

- Rolling-horizon strategic planning.
- Independent critic and integration-review gates.
- Mandatory evidence enforcement.
- Explicit `0731 → current Flash → independent Qwen/MiMo` reviewer routing.
- Generated `CURRENT/HISTORY/TIMING/HANDOFF/HORIZON` state is not manually rewritten by this change.

### Prompt/rule surface

- `gauntlet/PROMPT.md`
- `.grok/agents/orchestrator.md`
- `.grok/agents/orchestrator-deepseek.md`
- `.grok/skills/gauntlet/SKILL.md`
- `.grok/skills/gauntlet-continue/SKILL.md`
- `.grok/skills/gauntlet-eval/SKILL.md`
- `.grok/skills/gauntlet-eval-model/SKILL.md`
- `.grok/skills/gauntlet-observability/SKILL.md`
- `gauntlet/evals/**`

---

## 2026-08-15 — Explicit DeepSeek fallback agents

**Prompt version:** `v4-explicit-deepseek-fallback-agents`

### Changed

- Replaced the critic/reviewer fallback pattern that attempted to reuse the same agent type with a different model override.
- Added `critic-flash`, explicitly bound to current `deepseek-v4-flash`, as the fallback for the primary `critic` on `deepseek-v4-flash-0731`.
- Added `integration-reviewer-flash`, explicitly bound to current `deepseek-v4-flash`, as the corresponding integration-review fallback.
- Updated `gauntlet/models.json` so fallback routing references the explicit agent types rather than a raw model ID for the same role.
- Updated both orchestrator prompts and the main Gauntlet prompt so a 0731 model-specific availability/allowance/capacity failure spawns the explicit current-Flash fallback agent. They must not retry `critic` or `integration-reviewer` by overriding that agent's model in place.
- Preserved later Qwen/MiMo reviewer fallbacks and the requirement that the review model differ from the builder model.
- Kept the overflow orchestrator itself on current `deepseek-v4-flash`; this change is specifically about spawned critic/integration roles.

### Why

During a live run, `deepseek-v4-flash-0731` correctly returned allowance exhaustion while the current `deepseek-v4-flash` overflow orchestrator continued to work. The attempted critic fallback to current Flash then resolved back to the exhausted 0731 role before falling through to MiMo. Repository history showed that the fallback rule existed, but the critic and integration agent types remained pinned to 0731. This exposed a latent routing ambiguity/regression: an in-place model override for a spawned agent was not a reliable way to change the model selected for that agent type.

Using separate agent types makes the fallback unambiguous to Grok Build while preserving the intended `0731 → current Flash → independent Qwen/MiMo` fallback behavior.

### Prompt/rule surface

- `gauntlet/models.json`
- `gauntlet/PROMPT.md`
- `.grok/agents/orchestrator.md`
- `.grok/agents/orchestrator-deepseek.md`
- `.grok/agents/critic-flash.md` (new)
- `.grok/agents/integration-reviewer-flash.md` (new)

### User-level configuration

The repository cannot edit `~/.grok/config.toml`. Machines running this Gauntlet should add the explicit agent mappings under `[subagents.models]`:

```toml
critic-flash = "deepseek-v4-flash"
integration-reviewer-flash = "deepseek-v4-flash"
```

The existing `critic = "deepseek-v4-flash-0731"` and `integration-reviewer = "deepseek-v4-flash-0731"` mappings remain valid because 0731 is still the preferred primary review model when its allowance is available.

---

## 2026-08-15 — Mandatory evidence and horizon invariant gates

**Prompt version:** `v3-evidence-horizon-gates`
**Implementation commit:** `220bb47b18f1ada4325e62da96d9d3f17c52aada`

### Changed

- Made mandatory evidence an explicit acceptance gate. Gameplay/presentation objectives require an existing screenshot artifact; tests alone cannot substitute for perceptual evidence.
- Required critics to determine applicable evidence, verify artifact existence, and return `mandatory_evidence_ok: true` before `ACCEPT`.
- Required integration reviewers to repeat that check independently and reject a critic `ACCEPT` issued while mandatory evidence was missing.
- Required orchestrators to verify both reviewer gates and mandatory artifacts before recording acceptance, advancing the horizon, or delegating the acceptance commit.
- Added deterministic rolling-horizon invariants: unique objective IDs, no accepted objective pending, coherent prerequisites, zero-based `current_index`, and agreement between the indexed and selected next objective.
- Required acceptance to update the existing horizon entry in place. Candidate bookkeeping is repaired and revalidated before persistence without another agent, historical rewrites, or global strategic reassessment.
- Corrected stale global-reassessment wording in `gauntlet/README.md` so it matches the rolling-horizon rules.

### Why

Commit `0dba0b8e405563c015c83b24e4f33db03444a014` accepted the browser/presentation objective `BROWSER-SCOREBOARD` without the screenshot required by the evidence contract. The same commit inserted a second `BROWSER-SCOREBOARD` horizon entry instead of updating the existing entry. The implementation was not retroactively changed; the future acceptance and horizon-generation rules were corrected.

The instruction-regression audit found that `eba48b211fc0661beda289f04d722876427b9d46` added the screenshot rule only to builder-report guidance. The later rolling-horizon change retained that rule but did not propagate it to critic, integration, or orchestrator gates. Horizon validation was also absent from the initial rolling-horizon rules, while the README retained one stale global-replan sentence. This change closes those gaps without reverting rolling horizons.

### Preserved

- Builder/critic model separation and independent integration review.
- Adversarial retries, max retries, blockers, deterministic tests, state persistence, protected-oracle/PES-claim restrictions, and the rolling strategic horizon.
- Existing generated state, evidence, screenshots, artifacts, and the accepted `BROWSER-SCOREBOARD` objective.

### Prompt/rule surface

- `gauntlet/PROMPT.md`
- `gauntlet/README.md`
- `gauntlet/evidence-contract.md`
- `.grok/agents/orchestrator.md`
- `.grok/agents/orchestrator-deepseek.md`
- `.grok/agents/critic*.md`
- `.grok/agents/integration-reviewer.md`
- `.grok/skills/gauntlet/SKILL.md`
- `.grok/skills/gauntlet-continue/SKILL.md`
- `AGENTS.md`

---

## 2026-08-15 — Rolling strategic horizon

**Introduced by:** `7886a88ea0edeb677f2d261c001725d56ade9896`  
**Merged to `main`:** `0e7755006d21e7ff7cda264c461ec8e2e736505d`

### Changed

- Separated strategic planning from routine objective execution.
- Replaced global project reprioritization after every accepted objective with a temporary rolling horizon of roughly 4–8 objectives.
- Added `gauntlet/state/HORIZON.md` as concise planning state.
- Strategic reassessment now happens at startup, handoff, horizon exhaustion, or material invalidation rather than after every acceptance.
- Added explicit early-replan conditions.
- Added a rule that horizons should, where technically reasonable, lead to observable playable/browser-facing progress; infrastructure-only horizons require justification.
- Added context-discipline rules so routine orchestration uses concise persisted state and directly relevant evidence/specs rather than repeatedly rebuilding global context.
- Preserved the adversarial acceptance loop: `builder → critic → fix/retry → critic → integration-reviewer → accept`.

### Why

The prior prompt caused a broad planning pass after every accepted objective and contributed to parent-context growth and orchestration overhead. The rolling horizon keeps dynamic planning while reducing repeated global reassessment.

### Prompt/rule surface

- `gauntlet/PROMPT.md`
- `.grok/agents/orchestrator.md`
- `.grok/agents/orchestrator-deepseek.md`
- `.grok/skills/gauntlet/SKILL.md`
- `.grok/skills/gauntlet-continue/SKILL.md`
- `AGENTS.md`
- `gauntlet/state/HORIZON.md`

---

## 2026-08-15 — Visual evidence capture rule

**Capture support:** `c1c2b3512cbfd090dea07ad418118594fb3c8e70`  
**Evidence-rule change:** `eba48b211fc0661beda289f04d722876427b9d46`

### Changed

- Added reusable browser screenshot capture support for work-in-progress evidence.
- Added `capture-wip` and persisted screenshots under `docs/screenshots/<objective-id>/`.
- Updated `gauntlet/evidence-contract.md` so gameplay/presentation changes must capture at least one screenshot and list it in the builder evidence artifacts.
- Visual captures are diagnostic/evidence artifacts; they do not by themselves justify PES fidelity or milestone claims.

### Note on video

The repository history reviewed for this changelog contains the screenshot rule and screenshot capture tooling above. I did **not** find a committed Gauntlet rule or prompt that requires or implements saved video/MP4/WebM evidence. If video capture existed only in an uncommitted/local prompt, it is not recoverable from the Git history currently in the repository.

### Prompt/rule surface

- `gauntlet/evidence-contract.md`
- supporting capture tooling/tests introduced by `c1c2b35`

---

## 2026-08-15 — Current DeepSeek Flash overflow routing

**Initial fallback change:** `5f0c2348ad91d04454196ff6fd31fc50b161e5a3`  
**Prefer-current change:** `aec632c72b7f2b94a57947a32e7c6917da8fa116`  
**Routing correction:** `7b263aa623ad8485827879e589311faa3ac23b87`  
**Merged via PR #2:** `2908e04dc881b893a8fd3db959f900a3fb8f2e35`

### Changed

- Updated overflow orchestration/model-control rules so the current `deepseek-v4-flash` model could be used instead of always depending on the `0731` snapshot.
- Follow-up commits corrected/scoped the change so it affected model routing rather than accidentally changing unrelated orchestration semantics.
- Preserved builder/critic independence and the existing Gauntlet loop while changing which DeepSeek deployment is selected for the overflow role.

### Why

The older `0731` deployment had availability/allowance constraints. The routing rules needed a controlled path to the current Flash model without treating ordinary failures as a reason to arbitrarily switch models.

### Prompt/rule surface

- `.grok/agents/orchestrator-deepseek.md`
- `.grok/skills/gauntlet-continue/SKILL.md`
- `gauntlet/PROMPT.md`
- `gauntlet/README.md`
- model-routing configuration/documentation

---

## 2026-08-15 — DeepSeek overflow identity/pickup correction

**Commit:** `49663cde259f3b8eee8c7c257cebb3e4d65926f7`

### Changed

- Corrected DeepSeek overflow instructions so the runtime/product label did not make the agent misidentify itself and stop or hand off incorrectly.
- Removed stale manual API-key export instructions from the handoff guidance.

### Why

The overflow orchestrator needed to continue from persisted state as `orchestrator-deepseek` even when the Grok CLI used generic product/runtime wording.

---

## 2026-08-15 — Handoff semantics corrected

**Commits:** `29228d8301c67a4f82167ec23c5ad93a6c343cf0`, `342c18fa990b972da702b352beda4446516aa444`

### Changed

- Corrected the Grok → DeepSeek handoff trigger to **89% of the SuperGrok weekly `/usage` limit**.
- Explicitly separated that quota threshold from the 500k context-window footer.
- Kept auto-compaction at 65% of context as a separate mechanism.
- Removed the incorrect rule that DeepSeek itself should hand off again at 95% context.

### Why

The first overflow prompt conflated account usage quota with conversation context. They are different controls and require different behavior.

---

## 2026-08-15 — DeepSeek overflow orchestrator added

**Commit:** `02c1df165e7368b456f9064f18d64d6ecf208d75`

### Changed

- Added `orchestrator-deepseek` as an overflow primary orchestrator.
- Added `/gauntlet-continue` to resume from persisted state rather than restart the project.
- Added `HANDOFF.md`-based pickup semantics.
- Kept the same builder → critic → integration workflow under the overflow orchestrator.

### Historical note

The initial commit used a 95%-of-context handoff concept. That rule was corrected immediately afterward by the handoff-semantics commits above.

### Prompt/rule surface

- `.grok/agents/orchestrator-deepseek.md`
- `.grok/skills/gauntlet-continue/SKILL.md`
- `gauntlet/PROMPT.md`
- `gauntlet/README.md`
- handoff state/rules

---

## 2026-08-14 — Git commits routed away from Grok

**Commit:** `e93f814fe72d3728a699213f20867227e0070293`

### Changed

- Added a dedicated `git-committer` agent on `gemma4`.
- Changed orchestration rules so Grok does not spend parent-model calls on conventional commit/push bookkeeping.
- Kept implementation and acceptance decisions outside the committer role.

### Why

Git bookkeeping does not require the expensive strategic orchestrator and was contributing unnecessary Grok token usage.

---

## 2026-08-14 — Gauntlet retargeted from OpenCode to Grok Build

**Commit:** `90cf1e8f826530ee052979fba7a83ba6ad25daa6`

### Changed

- Replaced the active OpenCode launch/routing instructions with Grok Build semantics.
- Updated model IDs and delegation rules to use `grok-4.6`, project-local `.grok/agents/`, and `spawn_subagent`.
- Updated `AGENTS.md` and Gauntlet documentation to point at the Grok Build agent surface.

### Why

The Gauntlet execution harness moved from the earlier OpenCode setup to Grok Build while preserving the project-specific builder/critic/integration design.

---

## 2026-08-13 — Initial Gauntlet rule/prompt system

**Core orchestration commit:** `7ae832ee836659c000564927bd29ca53733613fc`

Related setup commits include `603603d2b0973ce75bc25f8511ad9d8b1db3c19d`, `834d56f65b73a65d927672efc7d78f15fe4c18ef`, and `06161fe18c16ed6fd458d5a1a4430b3e9cbdca4d`.

### Introduced

- Project-specific Gauntlet orchestration rules.
- Grok as primary orchestrator and NaN models as builders/critics.
- Dynamic objective selection instead of a rigid backlog.
- Independent critic plus integration-reviewer acceptance semantics.
- Repository-level agent rules in `AGENTS.md`.
- Project-local agent prompts and a single `/gauntlet` launcher.
- Persisted CURRENT/HISTORY state for continuation and auditability.

This is the baseline from which the later prompt/rule changes in this changelog evolved.

---

## Changelog policy

Add an entry here when a change materially alters **rules or prompts**, including:

- strategic planning or objective-selection rules;
- role responsibilities or agent boundaries;
- model routing, fallback, or handoff semantics;
- builder/critic/integration independence;
- retry, reject, block, or acceptance semantics;
- evidence/artifact requirements, including visual evidence rules;
- prompt, skill, or agent loading behavior;
- persisted orchestration-state format when that state changes how prompts behave;
- orchestration-eval contract, regression scenarios, or enforcement behavior.

For every new entry include the date, introducing commit(s), what changed, why it changed, and the affected prompt/rule surface when useful.

Do **not** add normal gameplay objective progress or routine `CURRENT.md` / `HISTORY.md` / `TIMING.md` updates here.
