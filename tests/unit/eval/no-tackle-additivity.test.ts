/**
 * @module tests/unit/eval/no-tackle-additivity.test.ts
 *
 * Strictly-additive behaviour gate for HUMAN-DEFENSIVE-DUEL-CONTROL.
 *
 * When tackle bits (6,7) are NOT pressed, per-tick world hashes must be
 * byte-identical to the pre-tackle baseline recorded at
 * eval/scenarios/no-tackle-additivity-baseline.v1.json.
 *
 * The baseline was captured via tsx (capture-no-tackle-baseline.ts) using
 * the exact same `runNoTackleAdditivityRuns` function and the same
 * drive modes (scenario-program or cpu-adapters) that this test uses.
 * Within a single TypeScript runtime (vitest node project), the hashes
 * reproduce identically.
 *
 * Fails when:
 *   - The tackle system is stashed/removed (hashes change).
 *   - Any scenario's hashes change (regression in contact/locomotion).
 *
 * Node I/O is allowed for baseline loading.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  runNoTackleAdditivityRuns,
  type NoTackleRunSpec,
} from "../../../eval/runners/no-tackle-additivity.js";
import type { ScenarioDefinition } from "../../../src/contracts/scenario.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadScenario(scenarioPath: string): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(__dirname, "../../..", scenarioPath), "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

interface BaselineEntry {
  id: string;
  scenario_path: string;
  ticks: number;
  hashes: string[];
}

function loadBaseline(): BaselineEntry[] {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(
    join(__dirname, "../../../eval/scenarios/no-tackle-additivity-baseline.v1.json"),
    "utf-8",
  );
  return (JSON.parse(raw) as { runs: BaselineEntry[] }).runs;
}

/**
 * All scenarios + drive modes must match exactly what the baseline
 * capture script (capture-no-tackle-baseline.ts) used.
 *
 * `timeoutMs` is only set where the run exceeds the vitest 5s default: a
 * cpu-adapters match executes the full sim twice (baseline compare plus the
 * determinism re-run), so it needs generous headroom. Scenarios without an
 * explicit value keep the normal default.
 *
 * `cpuAntiHuddle: false` reproduces the historical CPU shape: this accepted
 * baseline was captured before the anti-huddle team shape (anti-huddle-v1), so
 * the pin is held at cpuAntiHuddle:false to preserve the historical
 * configuration byte-for-byte instead of re-pinning the artifact.
 */
const SPEC_MAP: Record<
  string,
  {
    ticks: number;
    drive: "scenario-program" | "cpu-adapters";
    timeoutMs?: number;
    cpuAntiHuddle?: boolean;
  }
> = {
  "foundation-move-and-roll":              { ticks: 120, drive: "scenario-program" },
  "two-player-duel":                       { ticks: 120, drive: "scenario-program" },
  "duel-rejection-fixture":                { ticks: 60,  drive: "scenario-program" },
  // Accepted baseline predates anti-huddle-v1 → pinned at the historical shape.
  "human-vs-cpu-5v5-no-defensive-input":   { ticks: 340, drive: "cpu-adapters", timeoutMs: 120_000, cpuAntiHuddle: false },
  // Accepted baseline predates anti-huddle-v1 → pinned at the historical shape.
  "ai-vs-ai-3v3-press-no-input":           { ticks: 300, drive: "cpu-adapters", timeoutMs: 60_000, cpuAntiHuddle: false },
};

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe("no-tackle-additivity: byte-identical hashes vs baseline", () => {
  const baselineEntries = loadBaseline();

  for (const entry of baselineEntries) {
    const spec = SPEC_MAP[entry.id];
    if (!spec) {
      it.skip(`no spec for baseline entry "${entry.id}"`, () => {});
      continue;
    }

    it(
      `${entry.id}: byte-identical across ${entry.ticks} ticks`,
      spec.timeoutMs === undefined ? {} : { timeout: spec.timeoutMs },
      () => {
        const scenario = loadScenario(entry.scenario_path);
        const runSpecs: NoTackleRunSpec[] = [{
          id: entry.id,
          scenarioPath: entry.scenario_path,
          scenario,
          ticks: spec.ticks,
          drive: spec.drive,
          // Pinned historical configuration (see SPEC_MAP note).
          cpuAntiHuddle: spec.cpuAntiHuddle ?? true,
        }];

        const runs = runNoTackleAdditivityRuns(runSpecs);
        expect(runs.length).toBe(1);

        const actual = runs[0].hashes;
        const expected = entry.hashes;

        // Length must match exactly.
        expect(actual.length).toBe(expected.length);
        expect(actual.length).toBe(spec.ticks + 1);

        // Initial hash (tick 0) must match.
        expect(actual[0]).toBe(expected[0]);

        // Every single hash must be byte-identical.
        expect(actual).toEqual(expected);

        // Determinism: two identical runs produce the same hashes.
        const runs2 = runNoTackleAdditivityRuns(runSpecs);
        expect(runs[0].hashes).toEqual(runs2[0].hashes);
      },
    );
  }
});
