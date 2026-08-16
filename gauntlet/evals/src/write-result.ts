import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

export interface EvalResultRecord {
  schema_version: 1;
  evaluator: "deterministic" | "state_audit" | "model";
  run_id: string;
  created_at: string;
  commit: string;
  agent?: string;
  model?: string;
  passed: number;
  failed: number;
  results: unknown[];
}

function safeTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export async function writeEvalResult(
  repoRoot: string,
  input: Omit<EvalResultRecord, "schema_version" | "run_id" | "created_at" | "commit">,
  now = new Date(),
): Promise<string> {
  let commit = "unknown";
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    // Keep the result usable even outside a git checkout.
  }

  const stamp = safeTimestamp(now);
  const runId = `${stamp}-${input.evaluator}`;
  const day = now.toISOString().slice(0, 10);
  const dir = path.join(repoRoot, "gauntlet/evals/results", day);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${runId}.json`);
  const record: EvalResultRecord = {
    schema_version: 1,
    evaluator: input.evaluator,
    run_id: runId,
    created_at: now.toISOString(),
    commit,
    agent: input.agent,
    model: input.model,
    passed: input.passed,
    failed: input.failed,
    results: input.results,
  };
  await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return path.relative(repoRoot, file);
}
