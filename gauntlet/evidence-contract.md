# Evidence contract

Every builder, critic, and integration review uses this shape. Prose without commands, exit codes, and file paths is not evidence.

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
- Judge the assigned acceptance criteria and produced evidence. Missing evidence is `INVALID_RUN` or `RETRY`, not a pass.
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
- presentation_authority: PASS|FAIL|NOT_APPLICABLE
- evaluator_integrity: PASS|FAIL|NOT_APPLICABLE
- verdict: ACCEPT|REJECT
- required_fixes:
```

`ACCEPT` here means the candidate may remain in the tree. `REJECT` means revert and return to a builder.
