# Gauntlet 0.11.2 — bounded quality failure recovery

Patch over 0.11.1. A failing quality check previously allowed later expensive checks to run, and the next invocation could repeat the complete battery without proving a repair. Canonical `gauntlet:quality` now stops at the first failure and records remaining checks as NOT_RUN/null. A persisted local failure requires written diagnosis and a passing focused repair before one fresh full gate. After two identical failures, repair expands to the whole failed check to detect interactions.

Pinned Node/pnpm and lockfile-local Vite preflight runs from the repository root. Commands use the existing 20-minute verification budget, stream complete logs to unique per-objective run directories, preserve CI/non-durable evidence flags and terminate test-server descendants on POSIX. Windows falls back to terminating the immediate child; native Windows descendant cleanup is not exercised. A previous receipt is invalidated before preflight or recovery refusal. Unknown/partial Vitest failure summaries conservatively select the whole failed check.

REPAIR_PASS is diagnostic only and cannot be accepted. Repair proof binds the actual source scope/hashes, base/HEAD, plan and pinned toolchain; changes invalidate it, and one full retry consumes it. Every required check is rerun for the final full PASS. Existing receipt validation still requires all checks and now rejects diagnostic/incomplete statuses. Historical receipts without the new optional fields keep their original validation; no accepted state/evidence is migrated or rewritten.

OMP, Grok and OpenCode consume the same canonical recovery rule. Optional runtime verification batching, provider retries/backoff/concurrency, role/model routes, critic/integration requirements, impact plan and gameplay oracles are unchanged. Local recovery files do not control Horizon state or replace acceptance evidence. No new task taxonomy, scheduler or LLM classifier is added.

## Verification

Node tests exercise first-failure stopping, explicit NOT_RUN, crashes/invalid results, real process timeout/launch/log errors, ANSI/duration-normalized signatures, conservative failure-file parsing, escalation after repetition, diagnostic rejection and multi-session command recovery with stale-proof and poisoned-command rejection. Existing product/runtime/architecture/candidate tests, deterministic scenarios, prompt gates, state audit, typecheck and build remain in Gauntlet maintenance CI; Chromium is not needed for this patch. Known historical accepted-evidence mismatches remain subject to the unchanged main/head classifier. No live OMP/provider session or repaired application capture run was executed here.

## Next implementation run

The reported capture-test defect is intentionally left for the next implementation run. Toolchain preflight cannot correct a test that starts a nested server from the wrong directory or waits on an unreliable output regex. After merging and updating the checkout, start a fresh OMP session with:

```text
/skill:gauntlet Resume from persisted state using Gauntlet 0.11.2. Diagnose the capture-test launcher failures in tests/capture-wip.node.test.ts and tests/difficulty-capture.node.test.ts using the prior logs. Launch the pinned local Vite from the repository root and establish reliable server readiness. Do not weaken oracles or increase timeouts to hide the defect. Verify those two files first. If a 0.11.2 recovery record exists, use the canonical --repair flow; otherwise run focused tests before the first full gate. After repair passes, run one fresh canonical quality gate. Diagnose any further failures through focused recovery, then continue required reviews, evidence and durable acceptance before advancing the dependent task.
```

Publish the immutable version tag through the existing release workflow after merge to main.
