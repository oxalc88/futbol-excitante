import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { runVerificationBatch, type VerificationCommand, type VerificationRunner } from "../gauntlet/runtime/verification-batch.js";

const DEFAULT_COMMANDS: VerificationCommand[] = [
  { id: "typecheck", command: ["mise", "run", "typecheck"] },
  { id: "node-tests", command: ["mise", "run", "test"] },
  { id: "browser-tests", command: ["mise", "run", "test-browser"] },
  { id: "build", command: ["pnpm", "run", "build"] },
];

function execute(command: VerificationCommand): Promise<{ exitCode: number; stdout: string; stderr: string; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(command.command[0]!, command.command.slice(1), {
      cwd: process.cwd(),
      env: { ...process.env, CI: "1", GAUNTLET_EVIDENCE_CAPTURE: "0", GAUNTLET_EVAL_DURABLE: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ exitCode: code ?? 1, stdout, stderr, durationMs: Date.now() - started }));
  });
}

const runner: VerificationRunner = { run: execute };
const result = await runVerificationBatch(DEFAULT_COMMANDS, runner);
const directory = path.join(process.cwd(), ".delivery-local", "verification");
await mkdir(directory, { recursive: true });
const output = path.join(directory, "latest.json");
for (const command of result.commands) command.artifactPath = command.artifactPath ?? output;
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ ...result, reportPath: path.relative(process.cwd(), output) }, null, 2)}\n`);
if (result.status === "FAIL") process.exitCode = 1;
