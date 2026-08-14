# PES Simulator

A headless, deterministic football simulation engine built for laboratory evaluation. Simulation is authoritative; rendering, replay, and evaluation are adapters.

## Architecture boundaries

- **Simulation core** (`src/simulation/`): Synchronous, DOM-free, deterministic. Never reads the wall clock, DOM, devices, network, filesystem, or renderer internals. Uses a seeded PRNG and no `Math.random`.
- **Ball** (`src/simulation/ball/`): Independent 3D entity. Never parented to a player, never teleported between controllers. Evolves through gravity, restitution, ground resistance, and spin decay.
- **Input** (`src/contracts/input.ts`, `src/simulation/input/`): Tick-indexed `InputFrame` structs. Devices, AI, replay, and tests all enter through this contract.
- **Presentation** (`src/contracts/presentation.ts`): One-way contract. The renderer consumes an immutable `PresentationSnapshot` only. Visuals never change football outcomes.
- **Eval layer** (`eval/`): Reads headless artifacts (replays, hashes, metrics, invariants). Never mutates simulation state. Produces comparison reports in `delta_only` or `mismatch` status — never claims regression pass.

## Quick start

```bash
# Trust the mise configuration and install pinned tools
mise trust --all
CI=1 mise install --locked

# Install Node dependencies
CI=1 mise exec -- pnpm install --frozen-lockfile
```

## mise tasks (canonical entry)

| Task | Description |
|---|---|
| `mise run dev` | Start the Vite browser laboratory |
| `mise run sim-smoke` | Run the versioned foundation scenario headlessly |
| `mise run replay-verify -- <replay>` | Verify deterministic replay reconstruction |
| `mise run eval-compare -- <dir-a> <dir-b>` | Compare two artifact directories |
| `mise run test` | Run Node Vitest project |
| `mise run test-browser` | Run browser Vitest + Playwright |
| `mise run test-all` | Full check: frozen-install, typecheck, all tests, smoke, production build |

Equivalent `pnpm run ...` scripts exist in `package.json` for editor and CI integration. `mise run ...` is the canonical entry so tool pinning cannot be bypassed.

## Iteration loop

The canonical workflow for any change:

1. **Edit** one mechanism or config file.
2. **`mise run test`** — verify fast unit and Node integration tests pass.
3. **`mise run sim-smoke`** — create a candidate headless artifact.
4. **`mise run eval-compare -- <baseline> <candidate>`** — compare against a chosen immutable artifact. Inspect the output for deltas.
5. **`mise run replay-verify -- <candidate>/replay.json`** — verify deterministic reconstruction from the artifact.
6. **`mise run test-browser`** — optional: inspect browser capture for visual correctness.
7. **Retain or reject** the change based on delta inspection.

Never claim a result is `FOUNDATION_LAB_PASS`, a PES match, or a regression `PASS`. The comparison output is the ground truth.

## Artifact file list

A headless run writes to its output directory (default `artifacts/<run-id>/`):

| File | Format | Description |
|---|---|---|
| `manifest.json` | JSON | Run metadata: scenario, config hashes, PRNG identity |
| `inputs.jsonl` | JSON Lines | One `InputFrame` per line |
| `hashes.jsonl` | JSON Lines | One `{tick, hash}` per line |
| `telemetry.jsonl` | JSON Lines | One `TelemetryObservation` per line |
| `events.jsonl` | JSON Lines | One event per line |
| `metrics.json` | JSON | Computed metrics (player-speed, ball-distance, etc.) |
| `invariants.json` | JSON | Array of invariant check results |
| `final-state.json` | JSON | Frozen final world state |
| `replay.json` | JSON | Full replay structure for reconstruction verification |

## Troubleshooting

### mise errors

- **`mise: command not found`** — install mise via the official installer at https://mise.jdx.dev/.
- **`mise.toml not trusted`** — run `mise trust --all` (or `mise trust mise.toml`).
- **Tool version mismatch** — run `CI=1 mise install --locked` to reinstall pinned versions from `mise.lock`.

### pnpm errors

- **Lockfile mismatch** — run `CI=1 pnpm install --frozen-lockfile`. If the lockfile needs updating, commit the new lockfile.
- **Missing peer dependencies** — run `pnpm install` (without `--frozen-lockfile`).

### Playwright

- **Browser not installed** — run `npx playwright install chromium` or `CI=1 pnpm exec playwright install chromium`.
- **System dependencies missing** — run `CI=1 pnpm exec playwright install-deps chromium`.

### TypeScript

- **Type errors** — run `mise run typecheck` to verify all three tsconfigs compile cleanly.