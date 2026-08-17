import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const checks = [
  { id: "gauntlet-eval", command: ["pnpm", "run", "gauntlet:eval"] },
  { id: "typecheck", command: ["pnpm", "run", "typecheck"] },
  { id: "test", command: ["pnpm", "run", "test"] },
  { id: "test-browser", command: ["pnpm", "run", "test-browser"] },
  { id: "sim-smoke", command: ["pnpm", "run", "sim-smoke"] },
  { id: "build", command: ["pnpm", "run", "build"] },
];

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function normalizeLine(line) {
  return stripAnsi(line)
    .replaceAll(process.cwd(), "<repo>")
    .replaceAll("/home/ubuntu/projects/oxDeveloop/pes-simulator", "<repo>")
    .replace(/\((\d+),(\d+)\)/g, "(*,*)")
    .replace(/:(\d+):(\d+)/g, ":*:*")
    .replace(/\b\d+(?:\.\d+)?ms\b/g, "<duration>")
    .replace(/\bpid:\s*\d+/g, "pid:<pid>")
    .replace(/\b20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z\b/g, "<timestamp>")
    .trim();
}

function relevantLines(output) {
  const lines = stripAnsi(output).split(/\r?\n/).map(normalizeLine).filter(Boolean);
  const selected = lines.filter((line) =>
    /error TS\d+|\bFAIL\b|AssertionError|\bError:|ELIFECYCLE|Process completed with exit code|×|failed:/i.test(line),
  );
  return (selected.length > 0 ? selected : lines.slice(-20)).slice(0, 40);
}

function signature(checkId, output) {
  const material = relevantLines(output).join("\n");
  return createHash("sha256").update(`${checkId}\n${material}`).digest("hex");
}

const reportPath = resolve(process.env.CI_REPORT_PATH ?? "artifacts/ci/validation.json");
const targetSha = process.env.CI_TARGET_SHA ?? null;
const results = [];

for (const check of checks) {
  console.log(`\n=== ${check.id} ===`);
  const result = spawnSync(check.command[0], check.command.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  process.stdout.write(output);
  const exitCode = result.status ?? 1;
  const failed = exitCode !== 0;
  results.push({
    check_id: check.id,
    status: failed ? "FAIL" : "PASS",
    exit_code: exitCode,
    signature: failed ? signature(check.id, output) : null,
    summary: failed ? relevantLines(output) : [],
  });
}

const report = {
  schema_version: "ci-validation-v1",
  target_sha: targetSha,
  checks: results,
};
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
