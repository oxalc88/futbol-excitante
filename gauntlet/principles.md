# Gauntlet principles

This file is the canonical source for the acceptance philosophy. Runtime prompts should reference it instead of copying it verbatim.

1. **Deterministic audits may invalidate evidence or state, but they must never replace the Gauntlet critic's qualitative comparison against the reference bar.**
2. **Scripts establish facts. Cheap auditors resolve bounded ambiguity. Critics judge quality against the bar.**
3. A deterministic `PASS` is permission to proceed to criticism, never permission to accept an objective.
4. A cheap semantic-auditor verdict is advisory input to the critic. It can clear or reject a bounded ambiguity, but it cannot accept an objective.
5. Every accepted implementation must have an independent critic verdict and an independent integration-review verdict before the final acceptance transition.
6. Bookkeeping/audit defects are repaired by the orchestrator and re-audited; they do not send already-valid gameplay back to a builder unless implementation evidence itself is defective.
7. **Provider, transport, quota, authentication, and harness failures are non-progress events.** Before consuming any child/agent response as a builder result, critic verdict, integration verdict, or orchestration decision, enforce `gauntlet/provider-failure-contract.md`. A CLI-reported `completed` turn is not sufficient when the assistant content is a provider/harness failure signature.
8. Retryable inference failures resume the same logical inference under the bounded exponential-backoff policy in `gauntlet/provider-failure-contract.md`; they never advance objective state, create acceptance evidence, or duplicate history/bookkeeping transitions.
