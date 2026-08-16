# Evidence contract

Every builder, critic, and integration review uses this shape. Prose without commands, exit codes, and file paths is not evidence.

## Mandatory evidence gate

Required evidence is an acceptance gate, not advisory guidance. For each objective, the builder, critic, integration reviewer, and orchestrator must determine the applicable evidence from this contract and the assigned acceptance criteria.

- Tests demonstrate executable behavior but never substitute for required perceptual artifacts.
- For gameplay/presentation changes, at least one screenshot is mandatory. The artifact must exist under `docs/screenshots/<objective-id>/`; listing a nonexistent path is not evidence.
- Any objective whose acceptance criteria require browser-visible or browser-interactive behavior is screenshot-required even when the implementation is primarily URL routing, input wiring, state selection, or other browser glue. A browser objective is not exempt merely because its code is not in the renderer.
- If a required behavior cannot reasonably be demonstrated by a still image, require supported dynamic evidence only when the repository already contains a committed capture command and rule for it. Do not invent video tooling or a video requirement.
- Screenshots or dynamic captures are diagnostic evidence. They do not establish PES fidelity, a perceptual `PASS`, or a protected regression `PASS` without the required versioned oracle/review policy.
- Missing mandatory evidence prevents `ACCEPT` at every review and orchestration stage.

## Builder report

The builder must return this block and nothing else as its final answer:

```markdown
## Builder report
- objective_id:
- builder_agent:
- builder_model:
- hypothesis:
- files_changed:
- commands_run:
  - cmd: 
    exit_code:
- tests_run:
  - name:
    result:
- required_evidence:
- artifacts:
- spec_sections:
- acceptance_criteria_met:
- known_gaps:
- claims_not_made:
```

Rules:

- Run the tests or commands required by the assigned objective. Do not only describe them.
- `claims_not_made` must explicitly refuse PES fidelity, `FOUNDATION_LAB_PASS`, invented reference envelopes, and regression `PASS` unless those registries exist and passed.
- If a required command cannot run because the toolchain is not there yet, that is a failed objective unless the objective *is* creating that toolchain.
- Do not commit, push, or rewrite specs, research, or Gauntlet agents.
- For gameplay/presentation changes and browser-visible/browser-interactive objectives, capture at least one screenshot via `WIP_SECTION=<objective-id> pnpm run capture-wip` and list the files under `docs/screenshots/<objective-id>/` in `artifacts`.

## Critic verdict

```markdown
## Critic verdict
- objective_id:
- critic_agent:
- critic_model:
- builder_agent:
- builder_model:
- independence_ok: true|false
- evidence_reviewed:
- required_evidence:
- evidence_presence:
- mandatory_evidence_ok: true|false
- criteria:
  - id:
    class:
    outcome: PASS|FAIL|NOT_EVALUATED|BLOCKED_MISSING_REFERENCE|NEEDS_PERCEPTUAL_REVIEW|INVALID_RUN
    note:
- architecture_violations:
- verdict: ACCEPT|REJECT|RETRY
- required_fixes:
```

Rules:

- `independence_ok` must be `true`. If `critic_model` equals `builder_model`, abort and ask the orchestrator to reroute.
- Determine required evidence from this contract before judging the implementation. Verify every mandatory artifact actually exists; never infer its existence from passing tests, implementation quality, or the builder report.
- `mandatory_evidence_ok` must be `true` for `ACCEPT`. Missing evidence is `INVALID_RUN` plus `RETRY` when it can be produced, or `REJECT` when the evidence claim is false/dishonest or the candidate cannot satisfy the contract; it is never a pass.
- `BLOCKED_MISSING_REFERENCE` is not a builder failure. Do not demand invented PES numbers.
- `RETRY` means the same objective can be fixed from the listed `required_fixes`. `REJECT` means the hypothesis or implementation is wrong enough to revert.

## Integration review

```markdown
## Integration review
- objective_id:
- reviewer_agent:
- reviewer_model:
- builder_model:
- independence_ok: true|false
- dependency_direction: PASS|FAIL
- neighboring_regressions:
- required_evidence:
- evidence_presence:
- mandatory_evidence_ok: true|false
- critic_evidence_gate_ok: true|false
- presentation_authority: PASS|FAIL|NOT_APPLICABLE
- evaluator_integrity: PASS|FAIL|NOT_APPLICABLE
- verdict: ACCEPT|REJECT
- required_fixes:
```

Rules:

- Independently determine and verify the mandatory evidence; do not rely only on the critic's statement.
- Verify the critic did not return `ACCEPT` while mandatory evidence was missing. If it did, set `critic_evidence_gate_ok: false` and `REJECT`.
- Both evidence gate fields must be `true` for `ACCEPT`. Tests alone are not a substitute for required screenshots or other supported perceptual evidence.

`ACCEPT` here means the candidate may proceed to the orchestrator's final mandatory-evidence gate. `REJECT` means return to a builder/reviewer with concrete `required_fixes` under the existing retry/revert policy.
