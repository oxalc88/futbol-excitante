# Product quality execution (0.11.0)

Before delegation inspect the explicit map, or preview expected paths with `mise exec -- pnpm run gauntlet:quality -- --base <accepted-head> --expected-paths <paths.json>` (a JSON array). Preview is advisory only and cannot execute or grant a waiver. After edits, inspect actual impact with `--base <candidate-parent>`. Before the candidate snapshot, run the same command with `--execute --out docs/evidence/<objective>/quality.json`. It runs the existing commands and records every exit code; cancellation, crash, absent tests and missing checks cannot pass. Keep full logs in ignored artifacts. Verification batching may run this single command.

## Failed quality execution (0.11.2)

The canonical runner stops after the first failed check. Remaining required checks are `NOT_RUN` with null exits, never PASS. Each command has the existing 20-minute verification timeout and runs from the repository root with pinned Node/pnpm and lockfile-local Vite preflight, CI/non-durable evidence flags and descendant-process cleanup. Preflight checks tool resolution, not readiness of servers spawned inside individual tests; repair test launchers to establish actual readiness. A new run invalidates the previous receipt before preflight or recovery refusal. Complete logs remain in unique per-objective run directories.

After failure, do not rerun the complete gate. Read the failed log and diagnose the cause. Repair the implementation or test harness without weakening an oracle, increasing a timeout to hide a startup defect, or treating critic/integration ACCEPT as a quality override. Write `{ "diagnosis": "Observed cause, repaired files and why the repair addresses it" }` to `.delivery-local/quality/<objective>/diagnosis.json`, then run:

```sh
mise exec -- pnpm run gauntlet:quality -- --base <candidate-parent> --execute --repair .delivery-local/quality/<objective>/diagnosis.json --out docs/evidence/<objective>/quality.json
```

The runner derives the focused command from its previous failure, not an arbitrary LLM-provided command. Complete Vitest failure summaries allow rerunning all identified failed files; unknown/partial output reruns the whole failed check. After two identical failures it always reruns the whole failed check to detect interaction failures. This is quality-check recovery, not provider retry/backoff or a new workflow taxonomy. Persisted local failure/proof records survive session restarts. They are non-authoritative diagnostics and never advance objective/Horizon state; do not clear them to bypass recovery.

`REPAIR_PASS` is diagnostic only. It cannot be accepted and leaves the acceptance receipt's required checks unrun. Repair proof binds the base/HEAD, actual scope/source hashes, plan and pinned toolchain; changed sources invalidate it. A passing repair unlocks one fresh full invocation of the normal command, which reruns every required check from the beginning. No earlier PASS is reused. Another failure consumes the proof and requires repair again. Only the new full PASS permits candidate persistence. SIGINT/SIGTERM, timeouts, crashes and missing results cannot become accepted PASS.

Always-on baseline: typecheck, build, node regression tests (including architecture boundaries), Gauntlet contract checks, state audit and browser regression tests. No known accepted regression may survive. Simulation smoke and affected suite assurance apply to protected changes. A presentation leaf needs browser/playtest evidence but no unrelated new physics evidence.

`gauntlet/runtime/product-quality.ts` maps repository paths to protected properties and the existing `eval/contracts/suites.ts` registry. This is an explicit dependency map, not an AI classifier or task taxonomy. Ball changes affect contact, duels, keepers and rule consequences; locomotion affects actions and team behavior; rules/fouls affect both rules and fouls; input/replay/state/core changes run broad assurance. Team tests verify the current declared/deferred status without adding a registered suite or fabricating PASS. Unknown paths and changed evaluator/test/architecture contracts select full assurance.

Both critic and integration review are mandatory when protected gameplay, deterministic/core simulation, rules, replay, persistence, architecture boundaries or elevated regression evidence can change. Ambiguous impact runs both. Existing accepted evidence edits are elevated risk. `--elevated-risk` and `--architecture-changed` can only add assurance.

Fresh per-objective screenshot/audit artifacts accompany the actual code scope without adding unrelated impact. Evidence-only objectives still require both reviews; edits to existing accepted evidence always elevate risk.

Only the closed, explicit presentation/document leaf allowlist can waive these reviews. Record each waived review as `verdict: NOT_REQUIRED`, with the deterministic plan in the acceptance record. If a reviewer is invoked, ACCEPT and a model independent of the builder remain required. Milestone qualitative review remains mandatory under the existing milestone contract.

Acceptance recomputes scope from the candidate's actual parent and changed paths, validates the receipt's exact plan, source hashes and every required exit code, then validates reviews. It does not trust an LLM-supplied impact label. `quality.json` is hashed into the immutable candidate manifest. Selection/playable events and trajectory outcomes are canonical bookkeeping: the working-tree planner excludes them and canonical state, while candidate verification refuses snapshots containing acceptance bookkeeping. Publish them with the appropriate state/bookkeeping commit, never as candidate implementation evidence.

Candidate snapshots, evidence classes, semantic audits, state audits, serialized publication, remote durability and issue-gated parallel execution keep their existing meanings. Past acceptance records are read as historical records, never migrated in place.
