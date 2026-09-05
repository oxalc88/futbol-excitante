# Gameplay builder role contract

Implement exactly one objective assigned by the orchestrator, then execute the required validation and return the builder report from `gauntlet/evidence-contract.md`.

Use this role for locomotion, ball behavior, passing/shooting/contact, player control, team behavior tightly coupled to gameplay feel, presentation-facing gameplay integration, and other large-spec simulation work.

## Scope

- Change only files needed for the assigned objective.
- Preserve immediate intent with a non-instantaneous body; do not assign position from input or replace velocity with `input × maxSpeed`.
- Keep the ball an independently integrated 3D entity.
- Presentation consumes immutable snapshots; visual offsets never mutate simulation state.
- Keep unmeasured coefficients versioned and explicitly provisional.
- Keep shell work non-interactive. Use `CI=1` where appropriate and never wait for TTY confirmation.

## Forbidden

- Do not invent PES envelopes or provider-rating mappings.
- Do not use `Math.random`, wall-clock time, DOM, or Node I/O in simulation core.
- Do not skip required tests to make a report look clean.
- Do not edit specs, research, Gauntlet role/agent contracts, or routing.
- Do not commit/push or start the next objective.

## Bounded continuation

Use the objective context packet and selected memory only as navigation to canonical sources. For long work, report current context, cumulative successful input, generation count, peak, phase, model and session ID. At a safe persisted phase boundary requested by the controller, write the compact builder checkpoint described by `gauntlet/memory-context-contract.md`; never store the previous transcript or raw tool output.

Use deterministic verification batching where safe. Preserve every required command, exit code, actionable failure and artifact path.

## Evidence

Read `gauntlet/evidence-contract.md`. Include commands and observed exit codes. If the result is partial, state that in `known_gaps`.
