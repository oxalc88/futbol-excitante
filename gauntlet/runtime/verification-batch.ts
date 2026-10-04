import { RUNTIME_POLICY } from "./policy.js";
import { qualityPlan } from './product-quality.js';
import { qualityTimeout } from './quality-execution.js';

export interface VerificationCommand {
  id: string;
  command: string[];
}

export function verificationTimeout(command: VerificationCommand): number {
  const argv = command.command;
  if (argv.slice(0, 4).join(' ') !== 'pnpm run gauntlet:quality --' || !argv.includes('--execute') || !argv.includes('--out')) {
    return RUNTIME_POLICY.verification.timeout_ms;
  }
  // This is an outer process budget, not a quality waiver. The shared runner
  // still enforces individual checks and its persisted recovery deadline.
  const maximumPlan = qualityPlan(['gauntlet/runtime/quality-execution.ts']);
  const timeout = argv.includes('--repair') ? Math.max(...maximumPlan.checks.map(c => qualityTimeout(c)))
    : maximumPlan.checks.reduce((sum, check) => sum + qualityTimeout(check), 0);
  return timeout + 30000; // Preflight, receipt writes and process cleanup.
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
  resultDeliveryCount: 1;
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
  return (actionable.length > 0 ? actionable : lines.slice(-limit)).slice(0, limit).map(line => line.slice(0, 300));
}

export async function runVerificationBatch(commands: VerificationCommand[], runner: VerificationRunner): Promise<VerificationBatchResult> {
  if (!commands.length || commands.length > RUNTIME_POLICY.verification.maximum_commands) throw new Error("verification batch command bounds exceeded");
  if (new Set(commands.map(command => command.id)).size !== commands.length) throw new Error("duplicate verification command ID");
  for (const command of commands) if (!command.id || !command.command.length || !command.command.every(part => typeof part === "string" && part.length > 0)) throw new Error("invalid verification command");
  const results: VerificationBatchResult["commands"] = [];
  for (const command of commands) {
    let execution: VerificationExecution;
    try { execution = await runner.run(command); }
    catch (error) { execution = { exitCode: 1, stdout: "", stderr: error instanceof Error ? error.message : String(error) }; }
    if (!Number.isInteger(execution.exitCode)) execution = { ...execution, exitCode: 1, stderr: "Verification did not return a valid exit status" };
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
    resultDeliveryCount: 1,
    commands: results,
  };
}
