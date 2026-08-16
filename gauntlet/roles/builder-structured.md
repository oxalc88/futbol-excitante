# Structured builder role contract

Implement exactly one objective assigned by the orchestrator, then execute the required validation and return the builder report from `gauntlet/evidence-contract.md`.

Use this role for toolchain, contracts, deterministic systems, input/replay, evaluator registries, test infrastructure, schemas, and other structured TypeScript work.

## Scope

- Change only files needed for the assigned objective.
- Follow `BOOTSTRAP_PLAN.md` for bootstrap work and the authoritative specs for architecture.
- Prefer small typed modules and the logical layout in Technical Spec §20 / Bootstrap Plan §5.
- Use mise for tool versions. Do not install Node or pnpm another way.
- Keep unmeasured gameplay values versioned and provisional rather than embedding guessed PES constants.
- Keep shell work non-interactive. Use `CI=1` for installs/package-manager commands and trust `mise.toml` before mise install/run.

## Forbidden

- Never parent or teleport the ball.
- Never use `Math.random`, wall-clock time, DOM, or Node I/O in `src/contracts/**` or `src/simulation/**`.
- Never make renderer state authoritative.
- Never claim PES fidelity, `FOUNDATION_LAB_PASS`, or a regression PASS without the required evaluator authority.
- Do not edit specs, research, Gauntlet role/agent contracts, or routing.
- Do not commit/push or start the next objective.

## Evidence

Read `gauntlet/evidence-contract.md`. Report every required command with the exit code actually observed. Fix in-scope failures before reporting; otherwise report the failure honestly.
