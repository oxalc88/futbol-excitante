import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GauntletScenario } from "../contracts/scenario.js";
import { createIncident } from "../contracts/incident.js";
import { writeIncident } from "./write-incident.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const scenariosDir = path.join(repoRoot, "gauntlet/evals/scenarios");

const agent = process.env.GAUNTLET_EVAL_AGENT ?? "orchestrator-deepseek";
const model = process.env.GAUNTLET_EVAL_MODEL ?? "deepseek-v4-flash";
const only = new Set(
  (process.env.GAUNTLET_EVAL_SCENARIOS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

function matchesExpected(actual: Record<string, unknown>, expected: Record<string, unknown>): boolean {
  return Object.entries(expected).every(([key, value]) => JSON.stringify(actual[key]) === JSON.stringify(value));
}

function extractJson(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error(`model output did not contain a JSON object: ${cleaned.slice(0, 300)}`);
  return JSON.parse(cleaned.slice(first, last + 1)) as Record<string, unknown>;
}

async function loadScenarios(): Promise<GauntletScenario[]> {
  const names = (await readdir(scenariosDir)).filter((name) => name.endsWith(".json")).sort();
  const scenarios = await Promise.all(
    names.map(async (name) => JSON.parse(await readFile(path.join(scenariosDir, name), "utf8")) as GauntletScenario),
  );
  return only.size === 0 ? scenarios : scenarios.filter((scenario) => only.has(scenario.id));
}

function buildPrompt(scenario: GauntletScenario): string {
  return [
    "This is a read-only synthetic Gauntlet regression evaluation.",
    "Do not call tools, spawn agents, edit files, inspect live state, or continue the real project.",
    "Use the orchestration rules loaded for this agent and decide what the orchestrator SHOULD do for the synthetic scenario below.",
    "Return exactly one JSON object and no prose.",
    "Allowed fields: decision, failure_class, next_objective, next_agent, clear_active_candidate.",
    "Allowed decisions: reject_acceptance, allow_review_result, reject_state, state_valid, fallback, do_not_model_fallback, repair_and_continue, continue, replan, stop.",
    "Omit fields that do not apply.",
    `Scenario: ${JSON.stringify({ id: scenario.id, kind: scenario.kind, input: scenario.input })}`,
  ].join("\n");
}

const scenarios = await loadScenarios();
if (scenarios.length === 0) {
  console.error("No model-eval scenarios selected.");
  process.exit(2);
}

console.log(`Gauntlet Model Eval — agent=${agent} model=${model} scenarios=${scenarios.length}`);
let failures = 0;
const incidentFiles: string[] = [];

for (const scenario of scenarios) {
  const result = spawnSync(
    "grok",
    [
      "--no-auto-update",
      "--agent",
      agent,
      "--model",
      model,
      "--no-plan",
      "--no-subagents",
      "--no-memory",
      "--disable-web-search",
      "--max-turns",
      "1",
      "--output-format",
      "plain",
      "-p",
      buildPrompt(scenario),
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: Number(process.env.GAUNTLET_EVAL_TIMEOUT_MS ?? 120_000),
      env: process.env,
    },
  );

  const expected = scenario.expect as unknown as Record<string, unknown>;
  let observed: Record<string, unknown>;

  if (result.error || result.status !== 0) {
    observed = {
      runner_error: result.error?.message ?? null,
      exit_status: result.status,
      stderr: (result.stderr ?? "").trim().slice(0, 500),
    };
  } else {
    try {
      observed = extractJson(result.stdout ?? "");
    } catch (error) {
      observed = {
        parse_error: error instanceof Error ? error.message : String(error),
        stdout: (result.stdout ?? "").trim().slice(0, 500),
      };
    }
  }

  const pass = matchesExpected(observed, expected);
  if (!pass) {
    failures += 1;
    incidentFiles.push(
      await writeIncident(
        repoRoot,
        createIncident({
          source: "model_eval",
          failure_class: "state_transition",
          scenario_id: scenario.id,
          agent,
          model,
          expected,
          observed,
        }),
      ),
    );
  }

  console.log(`${pass ? "PASS" : "FAIL"} ${scenario.id}`);
  if (!pass) {
    console.log(`  expected: ${JSON.stringify(expected)}`);
    console.log(`  observed: ${JSON.stringify(observed)}`);
  }
}

if (failures > 0) {
  console.error(`\nGauntlet model eval failed: ${failures}/${scenarios.length}`);
  if (incidentFiles.length > 0) console.error(`Incident artifacts: ${incidentFiles.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`\nGauntlet model eval passed: ${scenarios.length}/${scenarios.length}`);
}
