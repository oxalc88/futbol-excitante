# Gauntlet 0.11.0 — playable product outcomes

Base: main at `d3dccf77c565102de531bc5aa981bea9aca009c3` (0.10.0). This release changes Gauntlet and its tooling only. Application code, gameplay oracles, model routes, accepted state/evidence and prior releases are unchanged.

## Product loop

A Horizon selects the biggest current player-visible problem and the smallest useful playable slice. Internal decomposition is limited to what directly enables or protects that slice. Reach ordinary shipped play early, compare before/after evidence, and iterate when the player result is not materially better. Accepted technical objectives alone cannot complete a Horizon.

Every surviving change retains typecheck, build, node/browser regressions, architecture checks, Gauntlet contracts and state audit. Actual candidate paths select deeper existing assurance through an explicit conservative map backed by the suite registry. Protected gameplay/core, rules, replay/persistence, architecture, ambiguous impact and elevated risk require both independent reviews. Only closed trivial presentation/document leaves may persist deterministic NOT_REQUIRED waivers. Candidate persistence recomputes impact and binds the quality receipt to exact source bytes and the candidate parent.

`gauntlet:trajectory` records selection, first usable normal play and append-only comparisons for each future Horizon. Results persist player changes, play method, improvements, remaining problems, issues, regressions and 18 provenance-aware metrics. Failed comparisons can be recorded before candidate acceptance; unavailable time or usage stays null. Horizon ACCEPT requires a useful normal-play result, quality and remote-durable accepted work. State audit gates completion on the latest product outcome.

Grok, OMP and OpenCode use the same canonical contracts and commands. Runtime telemetry, optional memory/context/checkpoints/rotation/batching, parallel admission, model routing, deterministic/gameplay evals, evidence and remote/state durability remain supported. Optimizations retain their existing measured-baseline rollout guard. No AI task classifier or new workflow taxonomy is introduced.

## Frozen before-state

The first change froze `trajectory/baseline-0.10.0/` before behavior edits: 38 historical Horizon snapshots and 452 hashed contract/eval/manifest sources, reconstructed from git history and repository timing/session-audit evidence. Older Horizons have mixed system versions; they are not all 0.10 runs.

Every value is MEASURED, RECONSTRUCTED_EXACT, RECONSTRUCTED_ESTIMATE or UNAVAILABLE. Source-code delta proxies and rounded timing rows are estimates. Raw server Grok/subagent and OMP sessions were inaccessible; their missing measurements are explicitly unavailable. Grok included-cache input and OMP additive cache buckets are not combined. The baseline is sealed and reproducible; accepted historical data is not migrated.

This establishes the experiment. There is no real post-change Horizon throughput execution in this release, and no claim that 0.11 is faster. Future v39/v40/v41 records can be compared only with matching measurement definitions and coverage.

## Verification

Implementation preflight: [full frozen-main/head comparison](https://github.com/oxalc88/futbol-excitante/actions/runs/37172692965). The unchanged regression classifier found no PR regressions. Final command/adapter refinements also pass local product tests and typecheck; final version/contract checks pass: 47 scenarios, 45 prompt gates and 14 state-audit checks, plus 53 product/runtime/contract tests.

| Coverage | Result |
|---|---|
| Gauntlet deterministic scenarios / prompt checks | 47 / 45 pass (original 39 scenarios preserved) |
| New product/impact/trajectory/candidate tests | 36 pass, including real canonical CLI/git durability fixtures; fixtures are not a live game speed measurement |
| 0.10 runtime / telemetry; parallel admission | Pass |
| Typecheck, build, sim smoke; architecture and candidate-scope guards | Pass |
| Browser regressions | 278 pass across 54 files on both base and head |
| Full node suite | Head 3,765 pass; base 3,729 pass; same three failing files and two skipped tests |
| Worktree hygiene / historical state and evidence diff | Pass / unchanged |
| Historical accepted-evidence hash check | Same pre-existing failures on both base and head |

The raw full suite is **not entirely green**. Both revisions retain node capture-WIP/difficulty before-hook timeouts and a stale 0.9.8 release-binding expectation (`NAMED-NOT-REGISTERED` after advantage registration). The historical evidence check also retains basename-path missing files and a press/support trajectory hash mismatch. These failures remain visible and are classified PREEXISTING_REGRESSION by the existing policy; no application/test oracle or accepted manifest was weakened to hide them.

Full node coverage includes fast, locomotion, ball, touch/actions, duels, goalkeepers, rules/fouls, current team-suite status, milestone reduction, evidence/provenance, acceptance durability, candidate scope and parallel/runtime checks. Passing regression tests do not promote gameplay suite or milestone verdicts: existing NOT_EVALUATED, missing-reference and deferred team statuses retain their meanings.

Publication uses the existing immutable tag workflow after merge to main. This PR does not rewrite older release documents or accepted state.
