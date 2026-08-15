# Gauntlet history

Append one record per finished iteration. Do not rewrite earlier records.

<!--
## Iteration N — YYYY-MM-DD

- objective_id:
- builder:
- critic:
- verdict:
- integration:
- result: accepted | reverted | escalated
- notes:
-->

## Iteration 1 — 2026-08-13

- objective_id: BOOTSTRAP-01
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 1)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: 2d22a2995ae074108219c103fe318cf6cb566eac
- notes: Pinned mise Node 24.18.0 and pnpm 11.10.0, private ESM package, core/node/browser tsconfigs, Vite/Vitest skeleton, honest isolation/version/build/smoke tests, artifacts/.gitkeep. First critic RETRY for theatrical tests; rewrite plus clean-env `mise install --locked` evidence accepted. No PES fidelity or FOUNDATION_LAB_PASS claimed.

## Iteration 2 — 2026-08-13

- objective_id: BOOTSTRAP-02
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: 6d40bc2caaa8172215fdec25cf73f04827b45dd5
- notes: Portable contracts (Vec2/Vec3, InputFrame, control assignment, PlayerState, independent BallState, WorldState, ScenarioDefinition, SimulationEvent, PresentationSnapshot, telemetry, ReplayV1), immutable versioned FOUNDATION_CONFIG with provisional locomotion/ball coefficients, and table-driven validation. 90 node tests. No PES fidelity or FOUNDATION_LAB_PASS claimed.

## Iteration 3 — 2026-08-13

- objective_id: BOOTSTRAP-03
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 1)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: 2b402c361be74b5360b403220a0bbe1d53bd32b3
- notes: Determinism substrate — mulberry32-v1, canonical-json-v1, fnv1a64-v1, UTF-8 encoder, finite checks, core-boundary scan. First critic RETRY for non-canonical Mulberry32, FNV offset rounding, and UTF-8 surrogate bug. Retry aligned algorithms to cited references. 143 node tests. No PES fidelity claimed.

## Iteration 4 — 2026-08-13

- objective_id: BOOTSTRAP-04
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: 900aa50596654df57d10880ed606014842926248
- notes: Deterministic createWorld from declarative scenario + config + seed. Fixture foundation-move-and-roll.v1. Same-start hash identity. Advisory: createWorld currently discards input-uniqueness errors; must be closed when the loop consumes inputProgram.

## Iteration 5 — 2026-08-13

- objective_id: BOOTSTRAP-05
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: 7853fc26bf258432c71e49007608078f2f6bea65
- notes: Synchronous Simulation API (tick, applyInputs, step, snapshot, presentation, restore, stateHash). System-free locomotion/ball stages. createWorld uniqueness fail-closed. 194 node tests. Non-blocking: cross-call applyInputs duplicates and scheduledEvents wiring for BOOTSTRAP-06.

## Iteration 6 — 2026-08-13

- objective_id: BOOTSTRAP-06
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 2)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: 1b80cc23528a525e06ae13863c5f3bf236d15979
- notes: Normalized InputFrame, one stable slot, REPEAT_HELD_WITH_ZERO_EDGES, sourceId provenance-only. First two critic RETRYs: dead slot wiring, then double tick resolution and false unassigned. 233 node tests. No locomotion yet.

## Iteration 7 — 2026-08-13

- objective_id: BOOTSTRAP-07
- builder: builder-mimo / mimo-v2.5
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: 9fb016fbffe8f6a9b97f56e44ba317b35ddfb60e
- notes: One-player kinematic locomotion. Desired velocity/heading immediate; actual converges under provisional accel/brake/turn/maxSpeed. Position from velocity. Sprint multiplier unused (known gap). 247 node tests. No PES/LOC claim.

## Iteration 8 — 2026-08-13

- objective_id: BOOTSTRAP-08
- builder: builder-mimo / mimo-v2.5
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: bb1556d82395252daf2f2df4cd90f0b7a06419e4
- notes: Independent 3D ball with gravity, swept pitch impact, bounce, non-reversing ground resistance, spin decay. Pitch-contact events with incoming/outgoing snapshots. 264 node tests. No PES ball claim.

## Iteration 9 — 2026-08-13

- objective_id: BOOTSTRAP-09
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 1)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: c96de25d8a4f44136b1efae8b7aa16d98239b93c
- notes: ReplayV1 codec, recorder, reusable verifyReplay with earliest divergence + state slice, restore-capable checkpoints. First critic RETRY for missing verifier/full checkpoints. 318 node tests. No alternative physics.

## Iteration 10 — 2026-08-14

- objective_id: BOOTSTRAP-10
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 3)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: 9aa5f77d72f76795fccfdcedae6e63491b021e66
- notes: Headless runner, telemetry sink, eval metrics/invariants, compare=DELTA_ONLY. Three critic RETRYs for theatrical canaries and CLI replay verify. 370 node tests. Advisory: headless replay initialStateHash uses tick-1 not tick-0. No FOUNDATION_LAB_PASS or PES claim.

## Iteration 11 — 2026-08-14

- objective_id: BOOTSTRAP-11
- builder: builder-mimo / mimo-v2.5
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 2)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commit: 09cd9fff62cb08a3d97a78c7b1b0622e57154941
- notes: Keyboard adapter, Three.js primitive renderer, test-bridge, browser hashes match headless. Two critic RETRYs for theatrical screenshot smoke. 409 node + 16 browser tests. No PES visual claim.

### Critic verdict (retry 2 follow-up — ACCEPT)

```markdown
## Critic verdict
- objective_id: BOOTSTRAP-11
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-mimo
- builder_model: mimo-v2.5
- independence_ok: true
- evidence_reviewed:
  - tests/browser/core-smoke.browser.test.ts (SCREENSHOT-SMOKE-001)
  - src/adapters/renderer-three/renderer.ts
  - src/apps/browser/test-bridge.ts
  - src/simulation/loop/simulation.ts (isControlled from controlAssignments)
  - Re-ran: typecheck exit 0; node 409/409; CI=1 browser 16/16
- criteria:
  - id: SCREENSHOT-SMOKE-001-named-objects
    class: bootstrap-executable
    outcome: PASS
  - id: SCREENSHOT-SMOKE-001-non-blank
    class: bootstrap-executable
    outcome: PASS
    note: luminance variance > 50 and distinct colors >= 20 fail a black/blank frame
  - id: BROWSER-CORE-RESET/STEP/RENDER
    class: bootstrap-executable
    outcome: PASS
  - id: prior-retry-fixes
    class: bootstrap
    outcome: PASS
  - id: toolchain-and-arch
    class: bootstrap
    outcome: PASS
- architecture_violations: none
- verdict: ACCEPT
- required_fixes: none
```

Prior critic passes on this objective: RETRY (missing screenshot smoke, vite-resolve timeout regression, incomplete reset, tests did not drive test-bridge); RETRY (screenshot still theatrical; black frame would pass).

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: BOOTSTRAP-11
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: mimo-v2.5
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: PASS
  - typecheck exit 0 (core, node, browser)
  - node 409/409 (BOOTSTRAP-01–10 suites + keyboard 39)
  - browser 16/16 (RESET-001, STEP-001 hashes match headless, RENDER-001 hash unchanged, SCREENSHOT-SMOKE-001)
  - locomotion, ball independence, InputFrame contract, replay hashes intact
- presentation_authority: PASS
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 12 — 2026-08-14

- objective_id: BOOTSTRAP-12
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 1)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: edcaf04 feat(headless) CLIs; 6899492 chore mise/test-all gate; ab568a6 docs README
- notes: mise tasks, README iteration loop, test-all frozen-lockfile+typecheck+node+browser+sim-smoke+build. First critic RETRY for argv offset (parseArgs started at 3; documented `mise run <task> -- <args>` skipped the path) and eval-compare baseline/candidate swap. Retry fixed argv[2] and removed embedded flags. 409 node + 16 browser. No FOUNDATION_LAB_PASS or PES claim.

### Critic verdict (retry 1 — RETRY)

```markdown
## Critic verdict
- objective_id: BOOTSTRAP-12
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- evidence_reviewed:
  - Read BOOTSTRAP_PLAN.md §6 Step 12, mise.toml, package.json, README.md,
    replay-verify-cli.ts, eval-compare-cli.ts, verifier.ts, compare.ts.
  - Re-ran test-all (0), test (409), test-browser (16), replay-verify and
    eval-compare (identical / mismatch / crafted metric-delta).
- criteria:
  - BOOTSTRAP-12-mise-tasks: PASS
  - BOOTSTRAP-12-replay-verify: FAIL (documented single `--` form skips the path)
  - BOOTSTRAP-12-eval-compare: FAIL (same argv bug plus swapped baseline/candidate)
  - BOOTSTRAP-12-test-all: PASS
  - BOOTSTRAP-12-readme-loop: PASS
  - BOOTSTRAP-12-no-forbidden-names: PASS
  - BOOTSTRAP-12-fresh-install: PASS (global mise lock noise is pre-existing)
  - BOOTSTRAP-12-no-neighboring-regression: PASS
- architecture_violations: none
- verdict: RETRY
- required_fixes:
  - Fix parseArgs so user args start at argv[2] under pnpm/tsx
  - Remove value-less `--baseline --candidate` from the eval-compare script
  - Re-prove the documented single-`--` forms, including metric-delta order
```

### Critic verdict (retry 1 follow-up — ACCEPT)

```markdown
## Critic verdict
- objective_id: BOOTSTRAP-12 (retry 1)
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- evidence_reviewed: git diff (mise.toml, package.json), src/apps/headless/replay-verify-cli.ts, src/apps/headless/eval-compare-cli.ts, eval/recording/verifier.ts, src/contracts/telemetry.ts (status enum), README.md, BOOTSTRAP_PLAN.md §6 Step 12; re-ran all documented single-`--` forms plus test/test-all.
- criteria:
  - id: MISE_TASKS
    class: executable
    outcome: PASS
  - id: REPLAY_VERIFY_SINGLE_DASH
    class: executable
    outcome: PASS
    note: `CI=1 mise run replay-verify -- artifacts/sim-smoke/replay.json` exits 0; parseArgs starts at argv[2]; verifyReplay imported from eval/recording/verifier.ts.
  - id: EVAL_COMPARE_IDENTICAL
    class: executable
    outcome: PASS
    note: exit 0, delta_only, never a PASS name.
  - id: EVAL_COMPARE_MISMATCH
    class: executable
    outcome: PASS
    note: exit 1, condition hash mismatch.
  - id: EVAL_COMPARE_ORDER
    class: executable
    outcome: PASS
    note: expected=baseline 0.176..., actual=candidate 0.999; order proven.
  - id: NODE_TESTS
    class: executable
    outcome: PASS
    note: 409/409
  - id: TEST_ALL_GATE
    class: executable
    outcome: PASS
    note: frozen-lockfile, typecheck, 409 node, 16 browser, sim-smoke, vite build.
  - id: README_LOOP
    class: documentation
    outcome: PASS
    note: Optional nit: troubleshooting mentions `mise run typecheck`, which is not a mise task.
  - id: NO_FORBIDDEN_PASS_NAMES
    class: executable
    outcome: PASS
- architecture_violations: None
- verdict: ACCEPT
- required_fixes: None
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: BOOTSTRAP-12
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: qwen3.6 (builder-qwen)
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: None. Re-ran `mise run test` (409, exit 0), `mise run test-browser` (16, exit 0), `mise run test-all` (exit 0). Exercised sim-smoke, replay-verify single-`--`, eval-compare identical (delta_only) and mismatch (exit 1). No changes to src/simulation, src/contracts, adapters, or eval/. Pre-existing advisory: replay-verify prints initial hash match false (tick-1 vs tick-0); not a candidate regression.
- presentation_authority: NOT_APPLICABLE
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 13 — 2026-08-14

- objective_id: FOUNDATION-REGISTRIES
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: d1c7de9 types/profile/suites; e153414 definitions/policies; bc3ae90 bindings/loader; 1c7c746 tests
- notes: First builder session died HTTP 499 mid-write; retry finished loader/bindings/tests. 441 node tests. MEASURED_TARGET stays BLOCKED_MISSING_REFERENCE. No FOUNDATION_LAB_PASS or PES claim. Optional nits: COMMON-* criterion_bindings all map to finite-number; expansion manifests still placeholder hash.

### Critic verdict (ACCEPT)

```markdown
## Critic verdict
- objective_id: FOUNDATION-REGISTRIES
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- evidence_reviewed:
  - eval/contracts loader/bindings/policies/types/suites/reference-targets and related registry modules
  - tests/unit/eval/eval-registry.test.ts (32 tests)
  - Re-ran typecheck 0; mise run test 441/441; eval-registry 32/32; sim-smoke 0
- criteria:
  - bindings-complete: PASS (16 unique test_ids bound)
  - common-criteria-bind-to-existing-invariants: PASS
  - measured-target-blocked: PASS (never PASS/RESOLVED)
  - loader-rejects-invalid: PASS
  - expansion-none-closure: PASS
  - content-hash-deterministic: PASS (canonical-json-v1 + fnv1a64-v1)
  - no-invented-pes-envelopes: PASS
  - core-and-renderer-untouched: PASS
  - claimed-commands-reproduce: PASS
  - no-forbidden-claims: PASS
- architecture_violations: none
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: FOUNDATION-REGISTRIES
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: qwen3.6
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: none — mise run test 441/441; locomotion, ball, input, replay, architecture, evaluator intact
- presentation_authority: NOT_APPLICABLE
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 14 — 2026-08-14

- objective_id: FOUNDATION-ORACLES
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after RETRY, RETRY, REJECT, post-reject ACCEPT)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: d51b9d6 telemetry; 5122f7e sim observationCoreHash; a8a63bc oracles; 81eab71 oracle tests; 3074d89 PRNG mutant
- notes: Protected oracle registry + implementable mutants (finite, snap, decay, teleport, possession, camera-hash, genuine PRNG via snapshot/restore). Deferred contact/team/transition = not_evaluated. First RETRY: theatrical camera-hash, decay missed constant speed, deferred no-ops. Second RETRY: camera-hash always-fail, deferred named fail, hash-injection as nondeterminism. Retry 3 REJECT: ungated mutatePrng + theatrical PRNG test (passed with identity mutator). Post-reject removed hook, rewrite via restore. 487 node tests. No FOUNDATION_LAB_PASS or PES claim.

### Critic verdict (final — ACCEPT)

```markdown
## Critic verdict
- objective_id: FOUNDATION-ORACLES
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- evidence_reviewed: mutatePrng absent; snapshot/restore XOR prng.state; identity restore zero divergence; camera-hash clean pass; deferred not_evaluated; typecheck 0; 487/487
- verdict: ACCEPT
- required_fixes: none
```

Prior critic passes: RETRY (theatrical camera-hash / wrong decay / no-op deferred); RETRY (always-fail camera-hash / deferred as fail / hash-injection as RNG); REJECT (mutatePrng public hook + PRNG test independent of mutation).

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: FOUNDATION-ORACLES
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: qwen3.6
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 487/487; typecheck PASS; sim-smoke PASS; mutatePrng absent
- presentation_authority: PASS
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 15 — 2026-08-14

- objective_id: FOUNDATION-HARD
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 3)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: 16718e9 criteria/bindings; f265a84 possession pass; 0dd1085 evaluator; f19c6df tests
- notes: Catalog HARD_INVARIANTs (CONT/POSS/CONTACT/FREE) execute through protected oracles. First RETRY: only COMMON-* ran. Second RETRY: POSS empty→NOT_EVALUATED, invented TELEPORT test_id. Third RETRY: LOC-BALL-001-FREE not bound. 508 node tests. MEASURED_TARGET stays BLOCKED_MISSING_REFERENCE. No FOUNDATION_LAB_PASS.

### Critic verdict (retry 3 — ACCEPT)

```markdown
## Critic verdict
- objective_id: FOUNDATION-HARD (retry 3, last)
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- evidence_reviewed: bindings, evaluator, oracles, 508/508 tests, empirical evaluateFoundation
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: FOUNDATION-HARD
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: qwen3.6
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 508/508
- presentation_authority: NOT_APPLICABLE
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 16 — 2026-08-14

- objective_id: FOUNDATION-BROWSER
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 3)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: e588033 registry; 3adc812 evaluator gate; 963ebdd tests
- notes: Required RESET/STEP cases gate evaluateFoundation. First RETRY: {passed:true} stubs. Second RETRY: dummy hashes still PASS. Third RETRY: unused __BROWSER_CASE_EVIDENCE__ export. Evidence hashes now cross-checked against headless reference. Dummy INVALID_RUN. passed:false FAIL. 533 node + 16 browser. No FOUNDATION_LAB_PASS.

### Critic verdict (retry 3 — ACCEPT)

```markdown
## Critic verdict
- objective_id: FOUNDATION-BROWSER (retry 3, last)
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: FOUNDATION-BROWSER
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: qwen3.6
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 533/533; test-browser 16/16
- presentation_authority: PASS
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 17 — 2026-08-14

- objective_id: FOUNDATION-DETERMINISTIC
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: cd23a34 two-run evaluator; 7acc394 tests
- notes: compareAndEvaluateFoundation runs evaluate() twice; COMMON-DETERMINISTIC PASS on hash match, FAIL on PRNG snapshot/restore divergence. Single-run path still NOT_EVALUATED. 541 node tests. MEASURED_TARGET stays BLOCKED_MISSING_REFERENCE. No FOUNDATION_LAB_PASS. Advisory: evidence labels are schematic jsonl names; FAIL tests call compareRuns not the wrapper end-to-end.

### Critic verdict (ACCEPT)

```markdown
## Critic verdict
- objective_id: FOUNDATION-DETERMINISTIC
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: FOUNDATION-DETERMINISTIC
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: qwen3.6
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 541/541
- presentation_authority: NOT_APPLICABLE
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 18 — 2026-08-14

- objective_id: FOUNDATION-MUTANT-REDUCTION
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 1)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: 50a7453 clean-pass; 8d2f49a prng-order+registry; b3e5428 reducer; 8084f79 tests
- notes: evaluateMutantCore PASS only when all 7 implementable mutants clean-PASS and poison-FAIL. First RETRY: skip test theatrical; INVALID_RUN dead. Retry added skipMutationIds and INVALID_RUN precedence. Deferred NOT_EVALUATED. 570 node tests. No FOUNDATION_LAB_PASS.

### Critic verdict (retry 1 — ACCEPT)

```markdown
## Critic verdict
- objective_id: FOUNDATION-MUTANT-REDUCTION (retry 1)
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: FOUNDATION-MUTANT-REDUCTION
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: qwen3.6
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 570/570
- presentation_authority: NOT_APPLICABLE
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 19 — 2026-08-14

- objective_id: FOUNDATION-PROMOTION
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 1)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: 4f5b8bc skipBrowserValidation; 2823952 reducer; 60c502a tests
- notes: evaluateFoundationLab joins HARD_INVARIANT suites, browser-case hashes, COMMON-DETERMINISTIC, MUTANT_CORE. First RETRY: FAIL checked before INVALID_RUN. Retry swapped precedence. Happy path milestoneVerdict PASS on foundation scenario for required HARD_INVARIANT class. MEASURED_TARGET stays BLOCKED. Not a PES claim. 590 node tests.

### Critic verdict (retry 1 — ACCEPT)

```markdown
## Critic verdict
- objective_id: FOUNDATION-PROMOTION (retry 1)
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: FOUNDATION-PROMOTION
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: qwen3.6
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 590/590; test-browser 16/16
- presentation_authority: NOT_APPLICABLE
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 20 — 2026-08-14

- objective_id: CAPABILITY-DESIGN-PROFILE
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: 11eb171 types; c122196 profile+loader; d4a7fc7 tests
- notes: capability-design-v1 with transient-acceleration IMPLEMENTED (no runner → NOT_EVALUATED) and four DEFERRED axes. Loader rejects PES language. Not wired into loadRegistrySet (optional follow-up). 622 node tests. No PES claim.

### Critic verdict (ACCEPT)

```markdown
## Critic verdict
- objective_id: CAPABILITY-DESIGN-PROFILE
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: CAPABILITY-DESIGN-PROFILE
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: qwen3.6
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 622/622
- presentation_authority: NOT_APPLICABLE
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 21 — 2026-08-14

- objective_id: PLAYABLE-FIRST-TOUCH
- builder: builder-mimo / mimo-v2.5
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: 7a99632 contracts; 8b2a7ab FOUNDATION_CONTACT_V1; 57f7cd5 contact system; 8e19fcc tests
- notes: Proximity + FIRST_TOUCH_BIT emits player-ball-contact, sets lastTouchRef, impulse velocity only. Ball never parented/teleported. 651 node + 16 browser. Advisory: KeyJ actionBit 0 now equals FIRST_TOUCH_BIT. No PES claim.

### Critic verdict (ACCEPT)

```markdown
## Critic verdict
- objective_id: PLAYABLE-FIRST-TOUCH
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-mimo
- builder_model: mimo-v2.5
- independence_ok: true
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: PLAYABLE-FIRST-TOUCH
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: mimo-v2.5
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 651/651; test-browser 16/16
- presentation_authority: PASS
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 22 — 2026-08-14

- objective_id: PLAYABLE-BASIC-PASS
- builder: builder-mimo / mimo-v2.5
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 1)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: 4d88fff PASS_BIT; f64e999 impulse; 4ded7ca KeyJ/KeyK; 8992fa6 oracle; 0cb5527 tests
- notes: Directed pass along heading. First RETRY: browser still mapped J to first-touch; possession oracle ignored kind pass. Retry imported DEFAULT_KEYBOARD_CONFIG and recognized pass evidence. 672 node + 16 browser. No PES claim.

### Critic verdict (retry 1 — ACCEPT)

```markdown
## Critic verdict
- objective_id: PLAYABLE-BASIC-PASS
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-mimo
- builder_model: mimo-v2.5
- independence_ok: true
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: PLAYABLE-BASIC-PASS
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: mimo-v2.5
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 672/672; test-browser 16/16
- presentation_authority: PASS
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 23 — 2026-08-14

- objective_id: PLAYABLE-BASIC-SHOT
- builder: builder-mimo / mimo-v2.5
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: b5079e4 SHOT_BIT; c91ce18 impulse; 6da76d5 KeyL; 9961259 oracle; 3228f48 tests
- notes: Lofted shot along heading. Priority shot > pass > first-touch. 689 node + 16 browser. No PES claim.

### Critic verdict (ACCEPT)

```markdown
## Critic verdict
- objective_id: PLAYABLE-BASIC-SHOT
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-mimo
- builder_model: mimo-v2.5
- independence_ok: true
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: PLAYABLE-BASIC-SHOT
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: mimo-v2.5
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 689/689; test-browser 16/16
- presentation_authority: PASS
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 24 — 2026-08-14

- objective_id: PLAYABLE-SECOND-SLOT
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 1)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: 69a98b5 scenario; 09f37c9 slot-2 keys; 132dff0 fixture export; 48f6f32 selector+adapter; 0578f03 tests
- notes: Two HUMAN slots on opposite teams. Browser `?scenario=two-player` or `?slots=2` binds slot-2 KeyboardAdapter. First critic RETRY: default path still loaded one-player; theatrical ball test. Retry wired selector and fixed the assertion. 718 node + 16 browser. No PES claim.

### Critic verdict (retry 0 — RETRY)

```markdown
## Critic verdict
- objective_id: PLAYABLE-SECOND-SLOT
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- verdict: RETRY
- required_fixes:
  - Wire the browser composition so the two-player scenario is actually loaded and reachable so hasTwoSlots becomes true and the slot-2 KeyboardAdapter is actually created; remove or use the unused FOUNDATION_SCENARIO_TWO_PLAYER import.
  - Fix the "creates world with exactly one ball" test to actually assert the ball (it currently asserts players.length === 2).
```

### Critic verdict (retry 1 — ACCEPT)

```markdown
## Critic verdict
- objective_id: PLAYABLE-SECOND-SLOT
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: PLAYABLE-SECOND-SLOT
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: qwen3.6
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 718/718; test-browser 16/16
- presentation_authority: PASS
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 25 — 2026-08-14

- objective_id: PLAYABLE-CLOSE-CONTROL
- builder: builder-mimo / mimo-v2.5
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 1)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: f6563b2 config; 9809c45 dribble-touch; 48ca933 restore cooldown; 639d0f8 tests
- notes: Held FIRST_TOUCH applies repeated velocity-only micro-contacts with versioned cooldown. First critic RETRY: restore() cleared cooldown so mid-dribble checkpoints diverged. Retry rebuilds the map from committed dribble-touch events. 744 node + 16 browser. No PES claim.

### Critic verdict (retry 0 — RETRY)

```markdown
## Critic verdict
- objective_id: PLAYABLE-CLOSE-CONTROL
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-mimo
- builder_model: mimo-v2.5
- independence_ok: true
- verdict: RETRY
- required_fixes:
  - restore() must not discard dribble-touch cooldown state. Reconstruct from state.events or serialize the map so checkpoint/restore continuation matches the uninterrupted run.
  - Add a test asserting checkpoint/restore hash-equality while dribbling.
```

### Critic verdict (retry 1 — ACCEPT)

```markdown
## Critic verdict
- objective_id: PLAYABLE-CLOSE-CONTROL
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-mimo
- builder_model: mimo-v2.5
- independence_ok: true
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: PLAYABLE-CLOSE-CONTROL
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: mimo-v2.5
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 744/744; test-browser 16/16
- presentation_authority: PASS
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 26 — 2026-08-14

- objective_id: PLAYABLE-PLAYER-DUEL
- builder: builder-mimo / mimo-v2.5
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 1)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: dc6533e event kind; 3e394aa config; b87b056 resolver; fb5cd75 loop; 73dd78c tests
- notes: Symmetric planar disc contact after locomotion. First critic RETRY: pair order followed array index. Retry sorts by stable player IDs and tests 3-player shuffle. 769 node + 16 browser. No PES claim.

### Critic verdict (retry 0 — RETRY)

```markdown
## Critic verdict
- objective_id: PLAYABLE-PLAYER-DUEL
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-mimo
- builder_model: mimo-v2.5
- independence_ok: true
- verdict: RETRY
- required_fixes:
  - Sort pair candidates by stable player IDs before applying corrections.
  - Strengthen the ordering test to 3+ overlapping players in shuffled array order.
```

### Critic verdict (retry 1 — ACCEPT)

```markdown
## Critic verdict
- objective_id: PLAYABLE-PLAYER-DUEL
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-mimo
- builder_model: mimo-v2.5
- independence_ok: true
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: PLAYABLE-PLAYER-DUEL
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: mimo-v2.5
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 769/769; test-browser 16/16
- presentation_authority: PASS
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 27 — 2026-08-14

- objective_id: PLAYABLE-ENGINE-DESIGN-RUNNER
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: b3947f9 coeff; c287991 bonus; 3c966e7 override; dc847a3 runner; 7505476 tests
- notes: Transient-acceleration hook + runner. t10 speed 2.0 vs 3.52; plateau both 7.0. DEFERRED axes stay DEFERRED. 781 node + 16 browser. No PES claim.

### Critic verdict (ACCEPT)

```markdown
## Critic verdict
- objective_id: PLAYABLE-ENGINE-DESIGN-RUNNER
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: PLAYABLE-ENGINE-DESIGN-RUNNER
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: qwen3.6
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 781/781; test-browser 16/16
- presentation_authority: PASS
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 28 — 2026-08-14

- objective_id: PLAYABLE-FICTIONAL-ARCHETYPES
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: 4e24bcb contracts; f387d94 registry; c4d3c80 createWorld; 13a7250 locomotion; 2bd5fcc tests
- notes: Per-player burst vs steady. t10 burst faster, shared 7.0 plateau. Capability runner still 2.0 vs 3.52. 795 node + 16 browser. Unknown archetype fail-open is advisory. No PES claim.

### Critic verdict (ACCEPT)

```markdown
## Critic verdict
- objective_id: PLAYABLE-FICTIONAL-ARCHETYPES
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: PLAYABLE-FICTIONAL-ARCHETYPES
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: qwen3.6
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 795/795; test-browser 16/16
- presentation_authority: PASS
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 29 — 2026-08-14

- objective_id: PLAYABLE-BROWSER-1V1
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: c4fa809 scenario; 3313612 registry; 2777c7d bridge; bb7a247 tests
- notes: BROWSER-1V1-CONTROL-001 hash parity + slot isolation. ARCH-DIFF-001 NEEDS_PERCEPTUAL_REVIEW, not PASS. 795 node + 24 browser. No PES claim.

### Critic verdict (ACCEPT)

```markdown
## Critic verdict
- objective_id: PLAYABLE-BROWSER-1V1
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: PLAYABLE-BROWSER-1V1
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: qwen3.6
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 795/795; test-browser 24/24
- presentation_authority: PASS
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 30 — 2026-08-14

- objective_id: PLAYABLE-1V1-PROFILE
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- commits: d311ab8 profile; 8c8eb06 runner; f0c37ea tests
- notes: PLAYABLE_1V1 profile + evaluatePlayable1v1. milestoneVerdict cannot be PASS (ARCH-DIFF + missing suites + exit prereqs). 831 node + 24 browser. No PLAYABLE_1V1_PASS claim.

### Critic verdict (ACCEPT)

```markdown
## Critic verdict
- objective_id: PLAYABLE-1V1-PROFILE
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- verdict: ACCEPT
- required_fixes: none
```

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: PLAYABLE-1V1-PROFILE
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: qwen3.6
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: mise run test 831/831; test-browser 24/24
- presentation_authority: NOT_APPLICABLE
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```

## Iteration 31 — 2026-08-15

- objective_id: PLAYABLE-TOUCH-ACTIONS-SUITE
- builder: builder-qwen / qwen3.6
- critic: critic / deepseek-v4-flash-0731
- verdict: ACCEPT (after retry 2)
- integration: ACCEPT (integration-reviewer / deepseek-v4-flash-0731)
- result: accepted
- notes: Versioned `touch_and_actions` suite. TOUCH-SLOW-001-CONTACT executes via possession-evidence (FAIL if lastTouchRef changes without a touch event). PASS/SHOT impulse criteria and unimplemented HEAD-FREE / TOUCH-WF / SHOT-SWV / CROSS-HI stay NOT_EVALUATED. PHY-SHLD and HEAD-DUEL removed from this non-duel suite. First critic RETRY: contact/impulse mapped to ball-continuity, suite never executed, empty input programs. Retry 1 critic RETRY: four catalog tests still silent-PASS; stale binding said ball-continuity. 841 node tests. Advisory: compare-foundation retains inert impulse→ball-continuity entries unused by FOUNDATION_LAB. No PLAYABLE_1V1_PASS or PES claim.

### Critic verdict (retry 2 — ACCEPT)

```markdown
## Critic verdict
- objective_id: PLAYABLE-TOUCH-ACTIONS-SUITE (retry 2 of 3)
- critic_agent: critic
- critic_model: deepseek-v4-flash-0731
- builder_agent: builder-qwen
- builder_model: qwen3.6
- independence_ok: true
- verdict: ACCEPT
- required_fixes: none
```

Prior critic passes: RETRY (dishonest ball-continuity mappings, catalog-only suite, empty inputs, PHY-SHLD/HEAD-DUEL); RETRY (HEAD-FREE/TOUCH-WF/SHOT-SWV/CROSS-HI silent PASS; stale CONTACT binding).

### Integration review (ACCEPT)

```markdown
## Integration review
- objective_id: PLAYABLE-TOUCH-ACTIONS-SUITE
- reviewer_agent: integration-reviewer
- reviewer_model: deepseek-v4-flash-0731
- builder_model: qwen3.6
- independence_ok: true
- dependency_direction: PASS
- neighboring_regressions: typecheck 0; mise run test 841/841; browser 24/24
- presentation_authority: PASS
- evaluator_integrity: PASS
- verdict: ACCEPT
- required_fixes: none
```


