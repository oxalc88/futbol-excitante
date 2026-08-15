# Gauntlet changelog

Human-readable history of meaningful changes to the Gauntlet's **rules, prompts, role boundaries, routing, evidence requirements, and prompt-loading behavior**.

This changelog does **not** record normal gameplay objectives or routine live-state updates produced by the running Gauntlet. Git remains the source of truth for exact file contents and diffs.

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
- Added a rule that horizons should, where technically reasonable, lead toward observable playable/browser-facing progress; infrastructure-only horizons require justification.
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
- persisted orchestration-state format when that state changes how prompts behave.

For every new entry include the date, introducing commit(s), what changed, why it changed, and the affected prompt/rule surface when useful.

Do **not** add normal gameplay objective progress or routine `CURRENT.md` / `HISTORY.md` / `TIMING.md` updates here.
