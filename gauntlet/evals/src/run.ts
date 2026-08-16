import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GauntletScenario } from "../contracts/scenario.js";
import { evaluateScenario } from "./evaluate-state.js";
import { runPromptGate } from "./prompt-gate.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const scenariosDir = path.join(repoRoot, "gauntlet/evals/scenarios");

function matchesExpected(actual: Record<string, unknown>, expected: Record<string, unknown>): boolean {
  return Object.entries(expected).every(([key, value]) => JSON.stringify(actual[key]) === JSON.stringify(value));
}

async function loadScenarios(): Promise<GauntletScenario[]> {
  const names = (await readdir(scenariosDir)).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(
    names.map(async (name) => JSON.parse(await readFile(path.join(scenariosDir, name), "utf8")) as GauntletScenario),
  );
}

let failures = 0;
const scenarios = await loadScenarios();
console.log(`Gauntlet Eval v1 — ${scenarios.length} regression scenarios`);

for (const scenario of scenarios) {
  const actual = evaluateScenario(scenario);
  const pass = matchesExpected(actual as unknown as Record<string, unknown>, scenario.expect as unknown as Record<string, unknown>);
  if (!pass) failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"} ${scenario.id} — ${actual.decision}`);
  if (!pass) {
    console.log(`  expected: ${JSON.stringify(scenario.expect)}`);
    console.log(`  actual:   ${JSON.stringify(actual)}`);
  }
}

const promptGate = await runPromptGate(repoRoot);
console.log("\nPrompt gate");
for (const result of promptGate) {
  if (!result.pass) failures += 1;
  console.log(`${result.pass ? "PASS" : "FAIL"} ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
}

if (failures > 0) {
  console.error(`\nGauntlet eval failed: ${failures} check(s)`);
  process.exitCode = 1;
} else {
  console.log(`\nGauntlet eval passed: ${scenarios.length} scenarios + ${promptGate.length} prompt checks`);
}
