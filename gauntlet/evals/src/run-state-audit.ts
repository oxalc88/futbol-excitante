import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeEvalResult } from "./write-result.js";

interface StateAuditResult {
  name: string;
  pass: boolean;
  detail?: string;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

function latestAcceptedObjective(current: string): string | null {
  const heading = "## Last accepted objective";
  const start = current.indexOf(heading);
  if (start < 0) return null;
  const after = current.slice(start + heading.length);
  const line = after.split("\n").map((value) => value.trim()).find(Boolean);
  if (!line) return null;
  return line.split(/\s+—\s+|\s+-\s+/)[0]?.trim() || null;
}

function section(content: string, heading: string, nextHeadingPrefix: string): string {
  const start = content.indexOf(heading);
  if (start < 0) return "";
  const afterStart = start + heading.length;
  const next = content.indexOf(`\n${nextHeadingPrefix}`, afterStart);
  return content.slice(afterStart, next < 0 ? content.length : next);
}

function yamlValue(content: string, key: string): string | null {
  const match = content.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, "m"));
  return match?.[1]?.trim() ?? null;
}

function rowContains(sectionText: string, objective: string): boolean {
  return sectionText.split("\n").some((line) => line.trimStart().startsWith(`| ${objective} |`));
}

const current = await readFile(path.join(repoRoot, "gauntlet/state/CURRENT.md"), "utf8");
const timing = await readFile(path.join(repoRoot, "gauntlet/state/TIMING.md"), "utf8");
const objective = latestAcceptedObjective(current);
const results: StateAuditResult[] = [];

if (!objective) {
  results.push({ name: "resolve latest accepted objective", pass: false, detail: "CURRENT.md has no parseable Last accepted objective" });
} else {
  const markerKeys = ["last_tracked_objective", "usage_aggregates_through", "model_evaluation_through"];
  for (const key of markerKeys) {
    const value = yamlValue(timing, key);
    results.push({ name: `${key} matches latest accepted objective`, pass: value === objective, detail: value === objective ? undefined : `expected ${objective}, found ${value ?? "missing"}` });
  }

  const version = yamlValue(timing, "tracking_contract_version");
  results.push({ name: "tracking contract version is present", pass: version === "1", detail: version === "1" ? undefined : "expected tracking_contract_version: 1" });

  const usageSection = section(timing, "## Per-step time and tokens", "## ");
  results.push({ name: "latest accepted objective has per-step usage row", pass: rowContains(usageSection, objective), detail: rowContains(usageSection, objective) ? undefined : `${objective} missing from Per-step time and tokens` });

  const gradeSection = section(timing, "### Per-objective grade", "### ");
  results.push({ name: "latest accepted objective has builder model evaluation row", pass: rowContains(gradeSection, objective), detail: rowContains(gradeSection, objective) ? undefined : `${objective} missing from Per-objective grade` });

  const reviewerSection = section(timing, "### Reviewer route and catches", "### ");
  results.push({ name: "latest accepted objective has reviewer/orchestrator evaluation row", pass: rowContains(reviewerSection, objective), detail: rowContains(reviewerSection, objective) ? undefined : `${objective} missing from Reviewer route and catches` });
}

console.log(`Gauntlet live state audit — latest accepted=${objective ?? "unknown"}`);
let failures = 0;
for (const result of results) {
  if (!result.pass) failures += 1;
  console.log(`${result.pass ? "PASS" : "FAIL"} ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
}

const resultFile = await writeEvalResult(repoRoot, {
  evaluator: "state_audit",
  passed: results.length - failures,
  failed: failures,
  results: [{ objective, checks: results }],
});
console.log(`Result artifact: ${resultFile}`);

if (failures > 0) {
  console.error(`\nGauntlet live state audit failed: ${failures} check(s). Refresh TIMING.md through the orchestrator; do not invent metrics.`);
  process.exitCode = 1;
} else {
  console.log(`\nGauntlet live state audit passed: ${results.length} checks`);
}
