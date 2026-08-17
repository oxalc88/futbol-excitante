# Gauntlet 0.9.1 — provider/harness failure resilience

Gauntlet 0.9.1 is a backward-compatible orchestration hardening release. It does not change gameplay acceptance semantics, builder/critic responsibilities, evidence classes, or live generated `gauntlet/state/**`.

## Incident basis

On 2026-08-17, two consecutive NaN `deepseek-v4-flash` calls produced the literal assistant content:

```text
HTTP 403: System error, please try again later.
```

The Grok CLI streamed and persisted that text as an assistant message and marked each turn completed. The raw HTTP status line, response headers, provider request ID, and JSON error body were not persisted. Therefore 0.9.1 deliberately describes the observed fact as a provider/harness failure signature in assistant content; it does not claim that the Gauntlet directly observed a structured HTTP 403 response.

Follow-up probes with the same running-process credential succeeded, supporting retryability for this exact NaN signature without making all HTTP 403 conditions retryable.

## Provider failure contract

`gauntlet/provider-failure-contract.md` makes provider, transport, quota, authentication, and harness failures non-progress events.

A CLI `completed` status is no longer sufficient as an orchestration success condition when returned content is a recognized failure signature. Such output cannot become a builder result, critic/integration verdict, acceptance input, gameplay evidence, or reason to advance the horizon.

## Bounded exponential backoff

Retryable rate-limit/transient failures preserve the same logical objective and role and use bounded exponential backoff with jitter:

- base delays: 2s, 5s, 10s, 20s, 40s;
- jitter: +/-20%;
- maximum attempts: 5.

After exhaustion, the work is paused/blocked with provider-failure evidence rather than spinning indefinitely. Authentication and persistent entitlement failures do not enter an indefinite retry loop.

The exact observed NaN text is classified as retryable. Arbitrary 403 responses are not automatically classified as transient.

## Deterministic regression gate

The existing prompt gate now protects the provider-failure contract, including:

- completed-turn + literal NaN 403 error text cannot masquerade as successful inference;
- transient/rate failures require bounded exponential backoff;
- authentication failures do not retry indefinitely;
- retry exhaustion preserves the objective and blocks/pauses;
- failure(s) followed by success resume the same objective without duplicate acceptance/history transitions.

## Canonical principles

`gauntlet/principles.md` now requires the provider-failure contract to be enforced before child/agent output is consumed as a valid orchestration decision. Existing runtime prompts already load these principles, keeping the policy provider- and harness-agnostic.

## Version/baseline

- Version: `0.9.1`
- Previous version: `0.9.0`
- Baseline: `729fbd316220ca84217da1604035064b11f6cf23` (`MATCH-TIMER-ENFORCEMENT` accepted on `main`)

No generated state file is manually rewritten by this release.
