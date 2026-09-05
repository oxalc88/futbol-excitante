# Provider failure resilience contract

Gauntlet must not treat a provider, transport, quota, authentication, or harness failure as a valid agent decision merely because the surrounding CLI reports a completed turn.

## Boundary rule

Agent output is valid only after Gauntlet has checked that the returned content is not a provider/harness failure signature. A completed CLI turn is not sufficient evidence of a successful inference.

The incident signature observed on 2026-08-17 was literal assistant content:

```text
HTTP 403: System error, please try again later.
```

The raw HTTP status line, response headers, and provider JSON body were not captured, so Gauntlet must not claim that the CLI exposed a structured HTTP 403 response. The safe fact is that this exact error text appeared as streamed assistant content and the turn was marked completed.

## Classification

Classify recognized failures before any objective, review, acceptance, or bookkeeping transition:

- `AUTH_FAILURE`: credentials are absent/invalid or authentication is explicitly rejected. Pause; do not retry indefinitely.
- `ACCESS_FAILURE`: persistent entitlement/tier denial. Pause after bounded confirmation; do not advance state.
- `RATE_LIMIT`: explicit quota/rate-limit signal such as HTTP 429. Retry with bounded exponential backoff and jitter.
- `TRANSIENT_PROVIDER_FAILURE`: retryable provider/server/network failure such as retryable 5xx, timeout/reset, or the exact NaN transient signature `HTTP 403: System error, please try again later.` Retry with bounded exponential backoff and jitter.
- `UNKNOWN_INFERENCE_FAILURE`: unclassified failure text or malformed agent response. Do not treat it as a verdict; gather bounded diagnostics and pause or retry only when evidence supports retryability.

Do not classify every 403 as transient. Only a documented/observed transient signature or equivalent provider-specific evidence may use the transient path.

## Retry policy

For `RATE_LIMIT` and `TRANSIENT_PROVIDER_FAILURE`, retry the same logical inference, preserving the same objective and role. Use bounded exponential backoff with jitter:

```text
base delays: 2s, 5s, 10s, 20s, 40s
jitter: +/- 20%
maximum attempts: 5
```

The exact sleep may vary inside the jitter window. Do not reset the objective, create a new candidate, duplicate an acceptance record, or mutate `CURRENT.md`, `HISTORY.md`, `HORIZON.md`, or `TIMING.md` merely because an inference retry occurred.

After the retry budget is exhausted, mark the active work blocked/paused with provider-failure evidence and return control according to the normal stop semantics. Never spin indefinitely.

For a model/provider bucket declared in `gauntlet/runtime-policy.json`, backoff is shared across every assigned role and queued wake source. A queued child completion, tool completion, parent wakeup, or safe user continuation cannot create a new logical inference budget. It waits behind the active incident. Retry count resets only after successful model recovery, not after a new host turn or queued event.

The `nan/glm5.3-flash` bucket also applies rolling-60-second admission before submission. The adapter reserves its estimated prompt and delays when recent successful processed input plus reservations would cross the configured soft ceiling.

## State invariants

A provider/harness failure must never by itself:

- count as critic or integration `ACCEPT`, `RETRY`, or `REJECT`;
- advance the current objective;
- create or update acceptance results or objective manifests;
- append a successful iteration to history;
- mark a horizon objective accepted;
- trigger strategic replanning unless the failure materially blocks the current horizon;
- be persisted as qualitative evidence about gameplay quality.

A sequence `failure -> retry -> success` resumes the same logical inference and continues normally from the successful response.

## Deterministic regression expectations

The deterministic prompt/eval gate must preserve at least these cases:

1. CLI status completed + assistant content exactly `HTTP 403: System error, please try again later.` => inference failure, no state advancement, retryable.
2. HTTP/rate-limit 429 signal => retryable with bounded exponential backoff.
3. explicit authentication failure => non-retry loop; pause without state advancement.
4. five retryable failures => retry budget exhausted; block/pause, objective preserved.
5. retryable failure(s) followed by valid response => same objective resumes, with no duplicate acceptance/history transition.

This contract is provider-agnostic. Provider-specific signatures may be added only when backed by observed evidence or provider documentation.
