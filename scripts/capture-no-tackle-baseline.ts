#!/usr/bin/env npx tsx
/**
 * scripts/capture-no-tackle-baseline.ts
 *
 * Records the strictly-additive behaviour baseline for
 * HUMAN-DEFENSIVE-DUEL-CONTROL: per-tick committed world hashes for
 * tackle-free runs. The baseline is captured from a tree that has no tackle
 * action system at all, and
 * tests/unit/eval/HUMAN-DEFENSIVE-DUEL-CONTROL-binding.test.ts asserts the
 * current tree reproduces those hashes byte-for-byte (input bits 6/7 are
 * never pressed in these runs).
 *
 * Usage:
 *   pnpm exec tsx scripts/capture-no-tackle-baseline.ts \
 *     --out eval/scenarios/no-tackle-additivity-baseline.v1.json
 *
 * Node I/O is the whole point of this script; the simulation core never
 * reads what it writes.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runNoTackleAdditivityRuns,
  type NoTackleRunSpec,
} from "../eval/runners/no-tackle-additivity.js";
import type { ScenarioDefinition } from "../src/contracts/scenario.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadScenario(fileName: string): ScenarioDefinition {
  const raw = fs.readFileSync(
    path.join(repoRoot, "eval", "scenarios", fileName),
    "utf-8",
  );
  return JSON.parse(raw) as ScenarioDefinition;
}

function flag(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : fallback;
}

const OUT = flag("out", "eval/scenarios/no-tackle-additivity-baseline.v1.json");

const specs: NoTackleRunSpec[] = [
  {
    id: "foundation-move-and-roll",
    scenarioPath: "eval/scenarios/foundation-move-and-roll.v1.json",
    scenario: loadScenario("foundation-move-and-roll.v1.json"),
    ticks: 120,
    drive: "scenario-program",
  },
  {
    id: "two-player-duel",
    scenarioPath: "eval/scenarios/two-player-duel.v1.json",
    scenario: loadScenario("two-player-duel.v1.json"),
    ticks: 120,
    drive: "scenario-program",
  },
  {
    id: "duel-rejection-fixture",
    scenarioPath: "eval/scenarios/3v3-situation-driven-duel-rejection.v1.json",
    scenario: loadScenario("3v3-situation-driven-duel-rejection.v1.json"),
    ticks: 60,
    drive: "scenario-program",
  },
  {
    id: "human-vs-cpu-5v5-no-defensive-input",
    scenarioPath: "eval/scenarios/5v5-human-vs-cpu.v1.json",
    scenario: loadScenario("5v5-human-vs-cpu.v1.json"),
    ticks: 340,
    drive: "cpu-adapters",
  },
  {
    id: "ai-vs-ai-3v3-press-no-input",
    scenarioPath: "eval/scenarios/3v3-press-scenario.v1.json",
    scenario: loadScenario("3v3-press-scenario.v1.json"),
    ticks: 300,
    drive: "cpu-adapters",
  },
];

console.error(`[no-tackle-baseline] running ${specs.length} tackle-free control runs…`);
const runs = runNoTackleAdditivityRuns(specs);

const document = {
  schema_version: 1,
  id: "no-tackle-additivity-baseline-v1",
  note:
    "Per-tick committed world hashes for tackle-free runs, recorded from a tree " +
    "without the tackle action system. Input bits 6/7 (STANDING_TACKLE_BIT / " +
    "SLIDE_TACKLE_BIT) are never pressed here, so a strictly-additive tackle " +
    "implementation must reproduce these hashes byte-for-byte.",
  runs: runs.map((r) => ({
    id: r.id,
    scenario_path: r.scenarioPath,
    ticks: r.ticks,
    hash_count: r.hashes.length,
    hashes: r.hashes,
  })),
};

const outPath = path.isAbsolute(OUT) ? OUT : path.join(repoRoot, OUT);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`, "utf-8");
console.error(
  `[no-tackle-baseline] wrote ${path.relative(repoRoot, outPath)} (${runs.length} runs, ` +
    `${runs.reduce((n, r) => n + r.hashes.length, 0)} hashes)`,
);
