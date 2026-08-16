---
name: gauntlet
description: Start or continue the PES Simulator Gauntlet Loop as the orchestrator. Use when the user runs /gauntlet.
user-invocable: true
disable-model-invocation: true
model: grok-4.6
argument-hint: optional focus, e.g. continue from BOOTSTRAP-07 only
---

Start the PES Simulator Gauntlet Loop now. Do not implement gameplay yourself.

Read `gauntlet/PROMPT.md`, `gauntlet/principles.md`, `gauntlet/VERSION.json`, `CURRENT.md`, and `HORIZON.md`. Follow the validated rolling horizon and existing model routing.

For each candidate: builder → tests/artifacts → `pnpm run gauntlet:audit` → optional bounded `aux`/Gemma(Qwen fallback) semantic audit only on `REVIEW_REQUIRED` → mandatory independent critic → integration reviewer → final evidence gate → `GAUNTLET_ACCEPTANCE_JSON=... pnpm run gauntlet:acceptance:persist` → bookkeeping → `pnpm run gauntlet:eval:state` → accept.

Critic ACCEPT alone is never final, and deterministic/cheap-auditor success never bypasses the critic. Audit failures owned by state/bookkeeping are repaired by the orchestrator; implementation/evidence failures return to the builder.

Persist/validate acceptance exactly as `gauntlet/PROMPT.md` specifies, then continue to the next horizon objective. A successful acceptance commit, tracking repair, or horizon exhaustion is not a stop condition. Preserve the existing SuperGrok ≥89% handoff rule.

If the user supplies extra focus, apply it only to objective selection; never skip deterministic audit, critic, integration review, persistence, or state audit.
