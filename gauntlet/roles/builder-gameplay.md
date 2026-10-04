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

## Evidence

Read `gauntlet/evidence-contract.md`. Include commands and observed exit codes. If the result is partial, state that in `known_gaps`.

## Optional measured efficiency

Follow `gauntlet/memory-context-contract.md` and `gauntlet/runtime-efficiency-contract.md`. In baseline mode keep the existing workflow. When enabled in OMP, use `gauntlet_runtime` to save a bounded checkpoint at a safe completed implementation phase and batch the required verification commands. Use the executing session ID from `/gauntlet-efficiency-status` in a checkpoint. Report failures/evidence truthfully. Return control for fresh-session rotation; never start another objective or accept work. Canonical sources and all required evidence/tests remain mandatory.

Apply the canonical impact plan in `gauntlet/product-quality-contract.md`; return the quality receipt plus evidence. Do not decide review waivers or Horizon product acceptance.
