# Evidence contract

Every builder, critic, and integration review uses this shape. Prose without commands, exit codes, and file paths is not evidence. Evidence classes are defined in `gauntlet/evidence-classes.md`; acceptance philosophy is canonical in `gauntlet/principles.md`.

## Mandatory evidence gate

Required evidence is an acceptance gate, not advisory guidance.

- The orchestrator selects the strictest applicable evidence class from the objective's acceptance criteria before review.
- `HEADLESS`: executed tests.
- `BROWSER_VISIBLE`: executed tests plus at least one screenshot under `docs/screenshots/<objective-id>/`.
- `MULTI_TICK`: executed tests, a relevant integration-test pass, and `docs/evidence/<objective-id>/trajectory.json`.
- `DYNAMIC_VISUAL`: all `MULTI_TICK` evidence plus an objective screenshot.
- `PRESENTATION`: executed tests plus an objective screenshot.
- `BOOKKEEPING`: deterministic state/tooling audit; no screenshot is required unless the criteria are also browser-visible/presentation.
- If acceptance explicitly depends on slot/player ownership or routing, the objective audit must include the slot-wiring invariant result.
- Video is optional diagnostic evidence. It never replaces a required trajectory or screenshot.
- Screenshot byte duplication is `REVIEW_REQUIRED`, not automatic `PASS` or `FAIL`; bounded semantic review follows `gauntlet/semantic-audit-contract.md`.
- Tests and deterministic checks establish facts. They never replace the independent critic's qualitative comparison against the applicable reference bar.
- Missing mandatory evidence prevents `ACCEPT` at every review and orchestration stage.

Before the critic, run `pnpm run gauntlet:audit -- --objective <id> --class <class> ...`. `FAIL` must be repaired by the owner reported by the audit. `REVIEW_REQUIRED` invokes the bounded cheap semantic audit. Only `PASS` proceeds to the critic.

## Builder report

```markdown
## Builder report
- objective_id:
- builder_agent:
- builder_model:
- evidence_class: HEADLESS|BROWSER_VISIBLE|MULTI_TICK|DYNAMIC_VISUAL|PRESENTATION|BOOKKEEPING
- hypothesis:
- files_changed:
- commands_run:
  - cmd:
    exit_code:
- tests_run:
  - name:
    result:
- integration_test_result:
- slot_wiring_result:
- required_evidence:
- artifacts:
- spec_sections:
- acceptance_criteria_met:
- known_gaps:
- claims_not_made:
```

Rules:

- Run the commands required by the assigned objective; do not only describe them.
- `claims_not_made` must refuse PES fidelity, invented reference envelopes, and protected regression `PASS` unless the required oracle/review exists and passed.
- If a required command cannot run because the toolchain is absent, that is a failed objective unless the objective is creating that toolchain.
- Builders do not commit/push or edit specs/research/Gauntlet agent prompts.
- When a screenshot is required, capture it via `WIP_SECTION=<objective-id> pnpm run capture-wip` and list the files under `docs/screenshots/<objective-id>/`.
- When a trajectory is required, capture it with the repository-supported command and persist `docs/evidence/<objective-id>/trajectory.json`.

## Critic verdict

```markdown
## Critic verdict
- objective_id:
- critic_agent:
- critic_model:
- builder_agent:
- builder_model:
- independence_ok: true|false
- deterministic_audit: PASS|FAIL|REVIEW_REQUIRED
- semantic_audit: NOT_REQUIRED|VALID|INVALID|INSUFFICIENT_CONTEXT
- evidence_reviewed:
- required_evidence:
- evidence_presence:
- mandatory_evidence_ok: true|false
- reference_bar_reviewed:
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

- `independence_ok` must be true and the critic model must differ from the builder model.
- The critic is mandatory even after deterministic/semantic audit success.
- Verify mandatory artifacts and inspect the candidate against the applicable reference bar; do not merely repeat script output.
- `mandatory_evidence_ok` must be true for `ACCEPT`.
- `BLOCKED_MISSING_REFERENCE` is not a builder failure and must not be converted into invented reference numbers.

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
- deterministic_audit: PASS
- critic_verdict_verified: true|false
- required_evidence:
- evidence_presence:
- mandatory_evidence_ok: true|false
- critic_evidence_gate_ok: true|false
- presentation_authority: PASS|FAIL|NOT_APPLICABLE
- evaluator_integrity: PASS|FAIL|NOT_APPLICABLE
- verdict: ACCEPT|REJECT
- required_fixes:
```

Integration must independently verify mandatory evidence and confirm that the critic actually ran and accepted. A deterministic or cheap-auditor result can never substitute for the critic.
