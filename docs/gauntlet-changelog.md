# Gauntlet changelog

Human-readable history of meaningful Gauntlet orchestration changes.

This changelog records changes to orchestration semantics, role responsibilities, model-routing behavior, acceptance/evidence rules, and prompt-loading behavior. It does **not** record normal objective execution or the live state produced by the running Gauntlet.

Git remains the source of truth for exact file contents and diffs.

## v2-rolling-horizon — 2026-08-15

**Status:** current

**Introduced by:** `7886a88ea0edeb677f2d261c001725d56ade9896`

**First merged to `main`:** `0e7755006d21e7ff7cda264c461ec8e2e736505d`

### Changed

- Separated strategic planning from routine objective execution.
- Replaced global project reprioritization after every accepted objective with a temporary rolling horizon of roughly 4–8 objectives.
- Added `gauntlet/state/HORIZON.md` as concise planning state.
- A valid horizon now advances directly to the next applicable objective after acceptance.
- Strategic reassessment now happens at startup, handoff, horizon exhaustion, or material invalidation.
- Added explicit early-replan conditions for blockers, architectural invalidation, dependency changes, inapplicable objectives, unsafe defects, materially higher-value evidence, and human-needed spec/legal blockers.
- Added a product-progress rule: where technically reasonable, a horizon should lead toward at least one observable playable/browser-facing capability; infrastructure-only horizons require justification.
- Added context-discipline rules so routine orchestration prefers concise persisted state and directly relevant evidence/specs over repeated global rereads.
- Preserved the adversarial acceptance loop unchanged: `builder → critic → fix/retry → critic → integration-reviewer → accept`.

### Why

The original workflow performed a broad project reassessment after every acceptance. Session telemetry showed substantial parent-orchestrator overhead and repeated processing of a large accumulated context. The rolling horizon reduces unnecessary global planning while keeping critic and integration independence, evidence requirements, retries, blockers, and dynamic replanning when evidence materially changes the plan.

### Orchestration surface changed

- `gauntlet/PROMPT.md`
- `.grok/agents/orchestrator.md`
- `.grok/agents/orchestrator-deepseek.md`
- `.grok/skills/gauntlet/SKILL.md`
- `.grok/skills/gauntlet-continue/SKILL.md`
- `AGENTS.md`
- `gauntlet/state/HORIZON.md` (new)

### Compare with v1

```bash
git diff 8d04d6240556e94f6e7fff0cf829e4acaf34aec1..0e7755006d21e7ff7cda264c461ec8e2e736505d -- \
  gauntlet/PROMPT.md \
  .grok/agents/orchestrator.md \
  .grok/agents/orchestrator-deepseek.md \
  .grok/skills/gauntlet/SKILL.md \
  .grok/skills/gauntlet-continue/SKILL.md \
  AGENTS.md \
  gauntlet/state/HORIZON.md
```

---

## v1-global-replan — baseline before 2026-08-15 rolling-horizon change

**Reference commit:** `8d04d6240556e94f6e7fff0cf829e4acaf34aec1`

### Behavior

- After every accepted objective, the active orchestrator inspected the current project state, evidence, research, and specs again.
- It selected the highest-value next objective from that fresh global reassessment.
- `gauntlet/objectives.md` remained prioritization guidance rather than a fixed backlog.
- The adversarial execution loop already required builder implementation, independent critic acceptance, and independent integration acceptance before an objective became accepted.

### Limitation addressed by v2

Because strategic prioritization happened after every objective, routine execution repeatedly reopened global planning and contributed to parent-context growth and orchestration overhead.

---

## Changelog policy

Add a new entry here when a change materially alters any of the following:

- when or how strategic planning happens;
- role responsibilities or agent boundaries;
- model-routing/fallback semantics;
- builder/critic/integration independence;
- retry, reject, block, or acceptance semantics;
- evidence requirements;
- prompt or skill loading behavior;
- persisted orchestration-state format.

For every new entry include:

1. a stable version/change name;
2. date;
3. introducing commit and, when applicable, merge commit;
4. what changed;
5. why it changed;
6. affected orchestration files;
7. migration or compatibility notes when relevant.

Do not add normal Gauntlet objective progress here. `gauntlet/state/CURRENT.md`, `HISTORY.md`, `TIMING.md`, `HANDOFF.md`, and `HORIZON.md` remain execution-state files and may continue to be written by the running Gauntlet.
