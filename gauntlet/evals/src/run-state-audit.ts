import path from "node:path";
import { fileURLToPath } from "node:url";
import { runStateChecks } from "./audit-state-core.js";
import { writeEvalResult } from "./write-result.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const { objective, checks } = await runStateChecks(repoRoot);
const failures = checks.filter((c) => !c.pass);

console.log(`Gauntlet live state audit — latest accepted=${objective ?? "unknown"}`);
for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
const resultFile = await writeEvalResult(repoRoot, { evaluator: "state_audit", passed: checks.length - failures.length, failed: failures.length, results: [{ objective, checks }] });
console.log(`Result artifact: ${resultFile}`);
if (failures.length) {
  console.error(`\nGauntlet live state audit failed: ${failures.length} check(s). Repair bookkeeping/tracking through the orchestrator; do not send a valid implementation back to a builder for state-only failures.`);
  process.exitCode = 1;
} else console.log(`\nGauntlet live state audit passed: ${checks.length} checks`);
