import { RUNTIME_POLICY } from "./policy.js";

export interface VerificationCommand {
  id: string;
  command: string[];
}

export interface VerificationExecution {
  exitCode: number;
  stdout: string;
  stderr: string;
  artifactPath?: string;
  durationMs?: number;
}

export interface VerificationRunner {
  run(command: VerificationCommand): Promise<VerificationExecution>;
}

export interface VerificationBatchResult {
  schemaVersion: 1;
  status: "PASS" | "FAIL";
  modelWakeCount: 1;
  commands: Array<{
    id: string;
    command: string[];
    status: "PASS" | "FAIL";
    exitCode: number;
    failureExcerpt: string[];
    artifactPath: string | null;
    durationMs: number | null;
  }>;
}

function conciseFailure(output: string, limit: number): string[] {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const actionable = lines.filter((line) => /fail|error|assert|timeout|exit code|ELIFECYCLE/i.test(line));
  return (actionable.length > 0 ? actionable : lines.slice(-limit)).slice(0, limit);
}

export async function runVerificationBatch(commands: VerificationCommand[], runner: VerificationRunner): Promise<VerificationBatchResult> {
  const results: VerificationBatchResult["commands"] = [];
  for (const command of commands) {
    const execution = await runner.run(command);
    const failed = execution.exitCode !== 0;
    results.push({
      id: command.id,
      command: [...command.command],
      status: failed ? "FAIL" : "PASS",
      exitCode: execution.exitCode,
      failureExcerpt: failed ? conciseFailure(`${execution.stdout}\n${execution.stderr}`, RUNTIME_POLICY.verification.failure_excerpt_lines) : [],
      artifactPath: execution.artifactPath ?? null,
      durationMs: execution.durationMs ?? null,
    });
  }
  return {
    schemaVersion: 1,
    status: results.some((result) => result.status === "FAIL") ? "FAIL" : "PASS",
    modelWakeCount: 1,
    commands: results,
  };
}
