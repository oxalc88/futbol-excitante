/**
 * @module cli-exit-tests
 *
 * Tests that the headless CLI exits with code 1 when replay verification
 * detects divergence, and exits 0 on a valid run.
 *
 * Node I/O allowed (test adapter layer).
 * Simulation core never reads I/O.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import { runCli } from "../../src/apps/headless/cli.js";
import { makeInputFrame } from "../unit/contracts.fixture.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

function buildInputProgram(
  durationTicks: number,
  controlSlot: string,
): Record<number, InputFrame[]> {
  const program: Record<number, InputFrame[]> = {};
  for (let t = 0; t < durationTicks; t++) {
    program[t] = [makeInputFrame(t, controlSlot)];
  }
  return program;
}

function loadFixture(name: string): ScenarioDefinition {
  const fixturePath = join(__dirname, `../../eval/scenarios/${name}`);
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

/**
 * Write a scenario file to a temp directory.
 */
function writeScenario(scenario: ScenarioDefinition, tmpDir: string): string {
  const path = join(tmpDir, "scenario.json");
  writeFileSync(path, JSON.stringify(scenario, null, 2));
  return path;
}

/**
 * Spawn the CLI process and return { stdout, stderr, code }.
 */
function spawnCli(scenarioPath: string, outDir: string): Promise<{
  stdout: string;
  stderr: string;
  code: number | null;
}> {
  return new Promise((resolve) => {
    // __dirname is tests/integration/
    // The project root is two levels up.
    const projectRoot = join(__dirname, "../..");
    const cliPath = join(projectRoot, "src", "apps", "headless", "cli.ts");
    const tsxCjs = join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
    const nodeBin = process.execPath;
    const child = spawn(
      nodeBin,
      [tsxCjs, cliPath, "--scenario", scenarioPath, "--out", outDir],
      {
        cwd: projectRoot,
        env: { ...process.env, CI: "1" },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout!.on("data", (d: Buffer) => stdout.push(d));
    child.stderr!.on("data", (d: Buffer) => stderr.push(d));
    child.on("close", (code) => {
      resolve({
        stdout: Buffer.concat(stdout).toString(),
        stderr: Buffer.concat(stderr).toString(),
        code,
      });
    });
    child.on("error", (_err) => {
      resolve({ stdout: "", stderr: "", code: null });
    });
  });
}

// ---------------------------------------------------------------------------
// Temp directory lifecycle
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeAll(() => {
  tmpDir = join("/tmp", `pes-cli-exit-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterAll(() => {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CLI exit code: replay divergence", () => {
  it("valid run exits 0 (process spawn)", async () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const scenarioPath = writeScenario(scenario, tmpDir);
    const outDir = join(tmpDir, "valid-out");

    const result = await spawnCli(scenarioPath, outDir);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Run complete");
    expect(result.stderr).toBe("");
  });

  it("divergent replayVerifier causes runCli to exit 1", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(5, "slot-1");
    modified.durationTicks = 5;

    const scenarioPath = writeScenario(modified, tmpDir);
    const outDir = join(tmpDir, "diverge-out");

    // Inject a failing replayVerifier to force divergence.
    const exitCode = runCli(
      ["tsx", "cli.ts", "--scenario", scenarioPath, "--out", outDir],
      { replayVerifier: () => false },
    );

    expect(exitCode).toBe(1);
  });

  it("divergent replayVerifier prints error to stderr", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(5, "slot-1");
    modified.durationTicks = 5;

    const scenarioPath = writeScenario(modified, tmpDir);
    const outDir = join(tmpDir, "diverge-err-out");

    // Capture console.error by temporarily overriding it.
    const originalError = console.error;
    const errors: string[] = [];
    console.error = (...args: unknown[]) => errors.push(args.join(" "));

    try {
      runCli(
        ["tsx", "cli.ts", "--scenario", scenarioPath, "--out", outDir],
        { replayVerifier: () => false },
      );

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("Run failed");
    } finally {
      console.error = originalError;
    }
  });
});