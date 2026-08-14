/**
 * @module failure-exit-tests
 *
 * Failure-exit paths for the headless runner and artifact writer:
 * - replayVerifier returning false → runHeadless success=false
 * - Artifact write failure → writeRunArtifacts throws, caught by caller
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import type { ReplayV1 } from "../../src/contracts/replay.js";
import { runHeadless } from "../../src/apps/headless/run.js";
import { evaluate } from "../../eval/runners/evaluate.js";
import { writeRunArtifacts, createManifest, type TickHashRecord, type EventRecord } from "../../src/apps/headless/artifacts.js";
import { verifyReplay } from "../../eval/recording/verifier.js";
import { checkFiniteNumber } from "../../eval/invariants/finite.js";
import { makeInputFrame } from "../unit/contracts.fixture.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(name: string): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(__dirname, `../../eval/scenarios/${name}`);
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

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

// ---------------------------------------------------------------------------
// Failure exits
// ---------------------------------------------------------------------------

describe("Failure exits: replayVerifier and artifact write", () => {
  it("replayVerifier returning false → runHeadless success=false", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(5, "slot-1");
    modified.durationTicks = 5;

    // A replayVerifier that always returns false simulates divergence.
    const result = runHeadless({
      scenario: modified,
      simulationVersion: modified.simulationVersion,
      runtimeIdentity: "test",
      configVersion: modified.configVersion,
      configHash: "test-config-hash",
      pitchRulesHash: "test-pitch-hash",
      rosterCapabilityHash: "",
      scenarioHash: "test-scenario-hash",
      runId: "replay-fail-test",
      replayVerifier: () => false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Replay divergence");
  });

  it("replayVerifier returning true → runHeadless success=true (no false-positive)", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(5, "slot-1");
    modified.durationTicks = 5;

    const result = runHeadless({
      scenario: modified,
      simulationVersion: modified.simulationVersion,
      runtimeIdentity: "test",
      configVersion: modified.configVersion,
      configHash: "test-config-hash",
      pitchRulesHash: "test-pitch-hash",
      rosterCapabilityHash: "",
      scenarioHash: "test-scenario-hash",
      runId: "replay-ok-test",
      safetyBounds: modified.safetyBounds,
      replayVerifier: (_replay, _scenario) => true,
    });

    expect(result.success).toBe(true);
  });

  it("writeRunArtifacts throws when output dir is a file (not a directory)", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(3, "slot-1");
    modified.durationTicks = 3;

    const runResult = evaluate({ scenario: modified });
    const hashes: TickHashRecord[] = [...runResult.hashes].map(
      ([k, v]) => ({ tick: Number(k), hash: v }),
    );
    const manifest = createManifest({
      scenario: modified,
      simulationVersion: modified.simulationVersion,
      runtimeIdentity: "test",
      configVersion: modified.configVersion,
      configHash: "test",
    });

    // Create a temp file at the path we want as outDir.
    const fakeDirPath = join("/tmp", `pes-fake-outdir-file-${Date.now()}`);
    try {
      // Create it as a file (not a directory).
      writeFileSync(fakeDirPath, "not a directory");

      // writeRunArtifacts should throw because mkdirSync with recursive
      // can create dirs but the parent path is a file.
      expect(() =>
        writeRunArtifacts({
          outDir: fakeDirPath,
          scenario: modified,
          observations: runResult.observations,
          hashes,
          events: [],
          metrics: runResult.metrics,
          invariants: runResult.invariants,
          finalStateHash: runResult.finalStateHash,
          replay: {
            header: {
              replayVersion: "replay-v1",
              schemaVersion: modified.schemaVersion,
              simulationVersion: modified.simulationVersion,
              runtimeIdentity: "test",
              configVersion: modified.configVersion,
              configHash: "",
              pitchRulesHash: "",
              rosterCapabilityHash: "",
              scenarioHash: "",
              initialStateHash: "",
              prngAlgorithmId: modified.prngAlgorithmId,
              prngSeed: modified.seed,
              prngState: {
                algorithmId: modified.prngAlgorithmId,
                seed: modified.seed,
                state: {},
              },
              recordedAt: "2026-01-01T00:00:00.000Z",
              runId: "test",
            },
            inputs: [],
            scheduledEvents: [],
            hashes: hashes.map((h) => ({ tick: h.tick, stateHash: h.hash })),
            checkpoints: [],
            checkpointsState: [],
          },
          finalState: runResult.finalState,
          manifest,
        }),
      ).toThrow();
    } finally {
      if (existsSync(fakeDirPath)) {
        rmSync(fakeDirPath, { force: true });
      }
    }
  });

  it("headless CLI would exit 1 on artifact write failure", () => {
    // This test simulates what the CLI does: try to write artifacts,
    // catch the error, and mark the run as failed.
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildInputProgram(3, "slot-1");
    modified.durationTicks = 3;

    const runResult = evaluate({ scenario: modified });
    const hashes: TickHashRecord[] = [...runResult.hashes].map(
      ([k, v]) => ({ tick: Number(k), hash: v }),
    );
    const manifest = createManifest({
      scenario: modified,
      simulationVersion: modified.simulationVersion,
      runtimeIdentity: "test",
      configVersion: modified.configVersion,
      configHash: "test",
    });

    const fakeDirPath = join("/tmp", `pes-cli-fail-${Date.now()}`);
    try {
      writeFileSync(fakeDirPath, "not a dir");

      // Simulate what CLI does: write artifacts with error handling.
      let artifactSuccess = false;
      try {
        writeRunArtifacts({
          outDir: fakeDirPath,
          scenario: modified,
          observations: runResult.observations,
          hashes,
          events: [],
          metrics: runResult.metrics,
          invariants: runResult.invariants,
          finalStateHash: runResult.finalStateHash,
          replay: {
            header: {
              replayVersion: "replay-v1",
              schemaVersion: modified.schemaVersion,
              simulationVersion: modified.simulationVersion,
              runtimeIdentity: "test",
              configVersion: modified.configVersion,
              configHash: "",
              pitchRulesHash: "",
              rosterCapabilityHash: "",
              scenarioHash: "",
              initialStateHash: "",
              prngAlgorithmId: modified.prngAlgorithmId,
              prngSeed: modified.seed,
              prngState: {
                algorithmId: modified.prngAlgorithmId,
                seed: modified.seed,
                state: {},
              },
              recordedAt: "2026-01-01T00:00:00.000Z",
              runId: "test",
            },
            inputs: [],
            scheduledEvents: [],
            hashes: hashes.map((h) => ({ tick: h.tick, stateHash: h.hash })),
            checkpoints: [],
            checkpointsState: [],
          },
          finalState: runResult.finalState,
          manifest,
        });
        artifactSuccess = true;
      } catch {
        // writeRunArtifacts threw — CLI should exit 1.
        artifactSuccess = false;
      }

      expect(artifactSuccess).toBe(false);
    } finally {
      if (existsSync(fakeDirPath)) {
        rmSync(fakeDirPath, { force: true });
      }
    }
  });
});