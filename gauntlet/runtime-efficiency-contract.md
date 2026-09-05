# Gauntlet runtime efficiency contract

This control-plane contract changes scheduling and context transport only. It does not change builder independence, critic or integration authority, evidence classes, acceptance, persisted state, publication, model routing, or command semantics. `gauntlet/runtime-policy.json` is the executable policy and `gauntlet/runtime/**` contains deterministic reference implementations for runtime adapters.

## Event-driven child waiting

After a child starts, the host runtime owns waiting. Progress events and status heartbeats update the UI without invoking the parent model. A child terminal event wakes the parent once; duplicate terminal events are coalesced. A user may interrupt a child without a parent inference, and a user message remains eligible to wake the parent subject to safe provider backoff.

The parent must not poll, time out, and generate only to request another wait. If a host cannot subscribe to child events, it must coalesce polling in the host process and deliver only a terminal or meaningful intervention event to the model.

## Shared GLM admission and backoff

All traffic assigned to the `nan/glm5.3-flash` bucket in `runtime-policy.json` shares one process/credential-level rolling ledger. The initial roles are `orchestrator-glm`, `critic`, and `integration-reviewer`; Qwen, DeepSeek, MiMo, and Gemma are outside this bucket absent new provider evidence.

Before submission, the adapter estimates the prompt, applies the configured reservation multiplier, and reserves it. Admission waits when successful input in the preceding 60 seconds plus outstanding reservations plus the new reservation would exceed 675,000 input tokens. The observed 800,000 provider limit remains the hard fact; the soft ceiling is operational headroom, not a provider guarantee. Actual successful input replaces the reservation. Cached input remains reported separately but is not subtracted from processed input because provider TPM cache treatment is unknown.

A GLM 429 opens shared model-bucket backoff. Child/tool completions, every queued wake, and safe user continuations cannot create a new logical retry budget or bypass the delay. The same incident uses the existing bounded 2/5/10/20/40-second schedule with ±20% jitter and stops after five failures. Runtime stop/interrupt controls remain available without inference. Success clears the incident and releases one coalesced wake.

## Builder soft budgets and phase rotation

Every child records exact model, role, session ID, current phase, current and peak context, cumulative successful processed input, generation count, duration, retries, rate limits, and compactions when exposed. Initial builder soft budgets are 180,000 context tokens, 12,000,000 cumulative successful input tokens, or 80 generations.

Crossing a soft budget never fails or rejects an objective. At a safe, persisted, materially different phase boundary, it requests:

```text
focused implementation/validation
→ write valid builder checkpoint
→ start fresh builder session
→ broad regression or neighbour-test disposition
```

Do not rotate during an unsafe edit, before changes and evidence are durable in the worktree, without a valid checkpoint, or merely because a small session changed tools. A fresh builder gets the current objective contract, context packet, checkpoint, up to three selected memory topics, and canonical references. It never gets the previous conversation.

## Verification batching

Deterministic commands may run as one controller batch and return one bounded result with each command, exit code, PASS/FAIL, actionable failure excerpts, duration, and artifact path. Batching does not skip checks, convert failures into passes, truncate the only actionable diagnostic, or replace reviewer judgment. The model wakes once after the batch, not once per successful command.

## Telemetry

Local operational telemetry lives under ignored `.delivery-local/` paths and feeds the next honest `gauntlet/state/TIMING.md` refresh when runtime data is available. It records per model/role/session generation usage, cached input, context peak, cumulative processed input, retries, rate-limit events, compactions, phase boundaries and rotations. GLM adds rolling-60 maximum, admission waits and backoff events. Builder rotations add old/fresh context and checkpoint size. Mapping adds mapper input/output, topics retrieved, canonical files selected, packet size, builder initial context, and measurable continuation re-reads.

Processed input is not described as billed input unless a provider exposes that billing field. Missing metrics remain `n/a`; the existence of memory or mapping is not itself evidence of savings.
