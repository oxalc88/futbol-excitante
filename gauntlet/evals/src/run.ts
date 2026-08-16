import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GauntletScenario } from "../contracts/scenario.js";
import { createIncident } from "../contracts/incident.js";
import { evaluateScenario } from "./evaluate-state.js";
import { runPromptGate } from "./prompt-gate.js";
import { writeIncident } from "./write-incident.js";
import { writeEvalResult } from "./write-result.js";

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
const incidentFiles: string[] = [];
const resultRows: unknown[] = [];
const scenarios = await loadScenarios();
console.log(`Gauntlet Eval v1 — ${scenarios.length} regression scenarios`);

for (const scenario of scenarios) {
  const actual = evaluateScenario(scenario);
  const expected = scenario.expect as unknown as Record<string, unknown>;
  const observed = actual as unknown as Record<string, unknown>;
  const pass = matchesExpected(observed, expected);
  resultRows.push({ type: "scenario", id: scenario.id, pass, expected, observed });
  if (!pass) {
    failures += 1;
    incidentFiles.push(
      await writeIncident(
        repoRoot,
        createIncident({
          source: "deterministic_eval",
          failure_class: actual.failure_class ?? "internal_error",
          scenario_id: scenario.id,
          expected,
          observed,
        }),
      ),
    );
  }
  console.log(`${pass ? "PASS" : "FAIL"} ${scenario.id} — ${actual.decision}`);
  if (!pass) {
    console.log(`  expected: ${JSON.stringify(scenario.expect)}`);
    console.log(`  actual:   ${JSON.stringify(actual)}`);
  }
}

const promptGate = await runPromptGate(repoRoot);
console.log("\nPrompt gate");
for (const result of promptGate) {
  resultRows.push({ type: "prompt_gate", id: result.name, pass: result.pass, detail: result.detail ?? null });
  if (!result.pass) {
    failures += 1;
    incidentFiles.push(
      await writeIncident(
        repoRoot,
        createIncident({
          source: "prompt_gate",
          failure_class: "prompt_contract",
          scenario_id: result.name,
          expected: { pass: true },
          observed: { pass: false, detail: result.detail ?? null },
          scenario_candidate: false,
        }),
      ),
    );
  }
  console.log(`${result.pass ? "PASS" : "FAIL"} ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
}

const resultFile = await writeEvalResult(repoRoot, {
  evaluator: "deterministic",
  passed: resultRows.length - failures,
  failed: failures,
  results: resultRows,
});
console.log(`Result artifact: ${resultFile}`);

if (failures > 0) {
  console.error(`\nGauntlet eval failed: ${failures} check(s)`);
  if (incidentFiles.length > 0) console.error(`Incident artifacts: ${incidentFiles.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`\nGauntlet eval passed: ${scenarios.length} scenarios + ${promptGate.length} prompt checks`);
}
