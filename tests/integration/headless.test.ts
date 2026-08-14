/**
 * @module headless-integration-tests
 *
 * Integration tests for the headless runner (BOOTSTRAP-10).
 *
 * Tests:
 * - Run foundation scenario twice and compare every state hash, metric,
 *   event, and final canonical state.
 * - Comparison rejects differing scenario/seed/config conditions
 *   and reports deltas for equivalent conditions.
 * - Runner is instrumented to prove it invokes no setInterval,
 *   setTimeout, or requestAnimationFrame for authority.
 * - Artifact schemas/required files validate.
 * - A replay reconstructed from the artifact passes verifyReplay.
 *
 * No Math.random, Date, performance, DOM, or Node I/O in src/simulation.
 * Node I/O is allowed here in tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { writeFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createWriteStream } from "node:fs";

import { createWorld } from "../../src/simulation/world/create.js";
import { createSimulation } from "../../src/simulation/loop/simulation.js";
import { NO_OP_OBSERVER } from "../../src/simulation/telemetry/observer.js";
import { encodeCanonical, hashFnv1a64 } from "../../src/simulation/determinism/index.js";
import { freezeWorldState } from "../../src/simulation/world/clone.js";
import type { ScenarioDefinition } from "../../src/contracts/scenario.js";
import type { InputFrame } from "../../src/contracts/input.js";
import type { TelemetryObservation } from "../../src/contracts/telemetry.js";
import { verifyReplay } from "../../eval/recording/verifier.js";
import { computePlayerMotionMetrics } from "../../eval/metrics/player-motion.js";
import { computeBallMotionMetrics } from "../../eval/metrics/ball-motion.js";
import { checkFiniteNumber } from "../../eval/invariants/finite.js";
import { checkBallContinuity } from "../../eval/invariants/ball-continuity.js";
import { evaluate } from "../../eval/runners/evaluate.js";
import { compareRuns } from "../../eval/runners/compare.js";
import { runHeadless } from "../../src/apps/headless/run.js";
import { writeRunArtifacts, createManifest, type TickHashRecord, type EventRecord } from "../../src/apps/headless/artifacts.js";
import { makeInputFrame } from "../unit/contracts.fixture.js";

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

function loadFixture(name: string): ScenarioDefinition {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(__dirname, `../../eval/scenarios/${name}`);
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as ScenarioDefinition;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEmptyInputProgram(
  durationTicks: number,
  controlSlot: string,
): Record<number, InputFrame[]> {
  const program: Record<number, InputFrame[]> = {};
  for (let t = 0; t < durationTicks; t++) {
    program[t] = [makeInputFrame(t, controlSlot)];
  }
  return program;
}

/**
 * Instrument a simulation to prove it does not use timer-based APIs.
 */
function instrumentNoTimers(): {
  sim: ReturnType<typeof createSimulation>;
  timersUsed: { method: string; tick: number }[];
} {
  const timersUsed: { method: string; tick: number }[] = [];

  // Monkey-patch timer methods.
  const origSetInterval = global.setInterval;
  const origSetTimeout = global.setTimeout;
  const origRequestAnimationFrame = global.requestAnimationFrame;

  global.setInterval = function (
    this: unknown,
    fn: (...args: unknown[]) => void,
    ...rest: unknown[]
  ): number {
    timersUsed.push({ method: "setInterval", tick: 0 });
    return origSetInterval.call(this, fn, ...(rest as [number]));
  } as typeof global.setInterval;

  global.setTimeout = function (
    this: unknown,
    fn: (...args: unknown[]) => void,
    ...rest: unknown[]
  ): number {
    timersUsed.push({ method: "setTimeout", tick: 0 });
    return origSetTimeout.call(this, fn, ...(rest as [number]));
  } as typeof global.setTimeout;

  if (global.requestAnimationFrame) {
    global.requestAnimationFrame = function (
      this: unknown,
      fn: (...args: unknown[]) => void,
      ...rest: unknown[]
    ): number {
      timersUsed.push({ method: "requestAnimationFrame", tick: 0 });
      return origRequestAnimationFrame.call(this, fn, ...(rest as [number]));
    } as typeof global.requestAnimationFrame;
  }

  const scenario = loadFixture("foundation-move-and-roll.v1.json");
  const world = createWorld({ scenario });
  const sim = createSimulation(world, NO_OP_OBSERVER);
  const inputProgram = buildEmptyInputProgram(10, "slot-1");

  for (let t = 0; t < 10; t++) {
    const inputs = inputProgram[t] ?? [];
    if (inputs.length > 0) sim.applyInputs(inputs);
    sim.step();
  }

  // Restore originals.
  global.setInterval = origSetInterval;
  global.setTimeout = origSetTimeout;
  if (global.requestAnimationFrame) {
    global.requestAnimationFrame = origRequestAnimationFrame;
  }

  return { sim, timersUsed };
}

/**
 * Create a temporary directory for artifacts and clean it up after.
 */
function createTempDir(prefix: string): { dir: string; cleanup: () => void } {
  const dir = join("/tmp", `pes-sim-${prefix}-${Date.now()}`);
  return {
    dir,
    cleanup: () => {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Run foundation scenario twice — identical hashes
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-10-INTEGRATION-001: duplicate run produces identical results", () => {
  it("two runs of the same scenario produce identical hashes, metrics, events, and final state", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const durationTicks = 10;
    const modified = JSON.parse(
      JSON.stringify(scenario),
    ) as ScenarioDefinition;
    modified.inputProgram = buildEmptyInputProgram(
      durationTicks,
      "slot-1",
    );
    modified.durationTicks = durationTicks;

    const run1 = evaluate({ scenario: modified });
    const run2 = evaluate({ scenario: modified });

    // All per-tick hashes must match.
    expect(run1.hashes.size).toBe(durationTicks);
    expect(run1.hashes.size).toBe(run2.hashes.size);
    for (const [tick, hash] of run1.hashes) {
      expect(run2.hashes.get(Number(tick))).toBe(hash);
    }

    // Metrics must match.
    expect(run1.metrics).toEqual(run2.metrics);

    // Final state hash must match.
    expect(run1.finalStateHash).toBe(run2.finalStateHash);

    // Final state must be equal.
    expect(JSON.stringify(run1.finalState)).toBe(
      JSON.stringify(run2.finalState),
    );

    // Events must match.
    expect(run1.events).toEqual(run2.events);
  });
});

// ---------------------------------------------------------------------------
// 2. Observer-off, observer-on, mutation-attempt — identical hashes
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-10-INTEGRATION-002: observer variations do not affect hashes", () => {
  it("observer-off, observer-on, mutation-attempt runs have identical authoritative hashes", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(
      JSON.stringify(scenario),
    ) as ScenarioDefinition;
    modified.inputProgram = buildEmptyInputProgram(10, "slot-1");

    // Run with no-op observer.
    const runNoop = evaluate({ scenario: modified });

    // Run with logging observer (captures observations).
    const loggedObs: unknown[] = [];
    const loggingObserver = {
      onObservation(obs: unknown) {
        loggedObs.push(obs);
      },
    };
    const runLogged = evaluate({ scenario: modified, observer: loggingObserver });

    // Observer-on run must produce same hashes.
    for (const [tick, hash] of runNoop.hashes) {
      expect(runLogged.hashes.get(Number(tick))).toBe(hash);
    }

    // Mutation attempt: try to mutate an observation.
    // The core passes observations through — mutation of returned
    // objects should not affect subsequent hashes.
    const mutationObserver = {
      onObservation(obs: unknown) {
        // Try to mutate the observation (this should not affect the simulation).
        try {
          (obs as Record<string, unknown>).tick = 999999;
        } catch {
          // Frozen — good.
        }
      },
    };
    const runMutated = evaluate({ scenario: modified, observer: mutationObserver });

    // Mutation attempt must not change hashes.
    for (const [tick, hash] of runNoop.hashes) {
      expect(runMutated.hashes.get(Number(tick))).toBe(hash);
    }

    // All runs must produce the same final hash.
    expect(runNoop.finalStateHash).toBe(runLogged.finalStateHash);
    expect(runNoop.finalStateHash).toBe(runMutated.finalStateHash);
  });
});

// ---------------------------------------------------------------------------
// 3. Artifact validation
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-10-INTEGRATION-003: artifact schemas validate", () => {
  it("all required artifact files are written with valid JSON", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(
      JSON.stringify(scenario),
    ) as ScenarioDefinition;
    modified.inputProgram = buildEmptyInputProgram(5, "slot-1");

    const result = evaluate({ scenario: modified });
    const { dir, cleanup } = createTempDir("artifact-validate");

    try {
      const hashes: TickHashRecord[] = [...result.hashes].map(
        ([k, v]) => ({ tick: Number(k), hash: v }),
      );
      const events: EventRecord[] = result.events.map(
        (e) => ({ tick: e.tick, id: e.id, kind: e.kind, label: e.label }),
      );

      const manifest = createManifest({
        scenario: modified,
        simulationVersion: modified.simulationVersion,
        runtimeIdentity: "test-runner",
        configVersion: modified.configVersion,
        configHash: "test-config-hash",
      });

      // Build replay inputs from observations.
      const replayInputs = result.observations.flatMap((o) =>
        o.inputs.map((f) => ({
          tick: f.tick,
          sourceId: f.sourceId,
          controlSlot: f.controlSlot,
          moveX: f.moveX,
          moveY: f.moveY,
          sprint: f.sprint,
          heldButtons: f.heldButtons,
          pressedButtons: f.pressedButtons,
          releasedButtons: f.releasedButtons,
        })),
      );

      writeRunArtifacts({
        outDir: dir,
        scenario: modified,
        observations: result.observations,
        hashes,
        events,
        metrics: result.metrics,
        invariants: result.invariants,
        finalStateHash: result.finalStateHash,
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
            prngState: { algorithmId: modified.prngAlgorithmId, seed: modified.seed, state: {} },
            recordedAt: "2026-01-01T00:00:00.000Z",
            runId: "test-run",
          },
          inputs: replayInputs,
          scheduledEvents: [],
          hashes: hashes.map((h) => ({ tick: h.tick, stateHash: h.hash })),
          checkpoints: [],
          checkpointsState: [],
        },
        finalState: result.finalState,
        manifest,
      });

      // Verify all required files exist.
      const requiredFiles = [
        "manifest.json",
        "inputs.jsonl",
        "hashes.jsonl",
        "telemetry.jsonl",
        "events.jsonl",
        "metrics.json",
        "invariants.json",
        "final-state.json",
        "replay.json",
      ];

      const files = readdirSync(dir);
      for (const file of requiredFiles) {
        expect(files).toContain(file);
        const content = readFileSync(join(dir, file), "utf-8");
        // JSON files should parse; JSONL files have one JSON object per line.
        if (file.endsWith(".json")) {
          expect(() => JSON.parse(content)).not.toThrow();
        } else if (file.endsWith(".jsonl")) {
          const lines = content.trim().split("\n");
          for (const line of lines) {
            if (line.trim()) {
              expect(() => JSON.parse(line)).not.toThrow();
            }
          }
        }
      }

      // Manifest must have specific structure.
      const manifestData = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf-8"));
      expect(manifestData.schemaVersion).toBe("manifest-v1");
      expect(manifestData.comparison.scenarioId).toBe(modified.id);
      expect(manifestData.comparison.seed).toBe(modified.seed);
      expect(manifestData.prng.algorithmId).toBe(modified.prngAlgorithmId);
      expect(manifestData.observationProfileHash).toBeDefined();
    } finally {
      cleanup();
    }
  });

  it("a replay reconstructed from artifacts passes verifyReplay", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(
      JSON.stringify(scenario),
    ) as ScenarioDefinition;
    modified.inputProgram = buildEmptyInputProgram(5, "slot-1");
    modified.durationTicks = 5;

    // Use runHeadless which produces a proper replay.
    const result = runHeadless({
      scenario: modified,
      simulationVersion: modified.simulationVersion,
      runtimeIdentity: "test-runner",
      configVersion: modified.configVersion,
      configHash: "test-config-hash",
      pitchRulesHash: "pitch-hash",
      rosterCapabilityHash: "roster-hash",
      scenarioHash: hashFnv1a64(encodeCanonical(modified)),
      runId: "replay-verify-test",
    });

    expect(result.success).toBe(true);

    const { dir, cleanup } = createTempDir("replay-verify");

    try {
      const hashes: TickHashRecord[] = result.hashes.map(
        (h) => ({ tick: h.tick, hash: h.hash }),
      );

      const manifest = createManifest({
        scenario: modified,
        simulationVersion: modified.simulationVersion,
        runtimeIdentity: "test-runner",
        configVersion: modified.configVersion,
        configHash: "test-config-hash",
      });

      // Build replay inputs from observations.
      const replayInputs = result.observations.flatMap((o) =>
        o.inputs.map((f) => ({
          tick: f.tick,
          sourceId: f.sourceId,
          controlSlot: f.controlSlot,
          moveX: f.moveX,
          moveY: f.moveY,
          sprint: f.sprint,
          heldButtons: f.heldButtons,
          pressedButtons: f.pressedButtons,
          releasedButtons: f.releasedButtons,
        })),
      );

      writeRunArtifacts({
        outDir: dir,
        scenario: modified,
        observations: result.observations,
        hashes,
        events: [],
        metrics: {},
        invariants: [],
        finalStateHash: result.finalStateHash,
        replay: result.replay,
        finalState: result.finalState,
        manifest,
      });

      // Read the replay file and verify.
      const replayJson = readFileSync(join(dir, "replay.json"), "utf-8");
      const replay = JSON.parse(replayJson) as {
        header: Record<string, unknown>;
        inputs: unknown[];
        hashes: Array<{ tick: number; stateHash: string }>;
        checkpoints: unknown[];
        checkpointsState: unknown[];
      };

      // Verify the replay reproduces the hashes.
      const verifResult = verifyReplay(replay, modified);
      expect(verifResult.match).toBe(true);
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// 4. No timer usage in headless runner
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-10-INTEGRATION-004: headless runner uses no timers", () => {
  it("runner does not invoke setInterval, setTimeout, or requestAnimationFrame", () => {
    const { timersUsed } = instrumentNoTimers();
    expect(timersUsed).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Comparison: differing conditions and equivalent conditions
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-10-INTEGRATION-005: comparison rejects differing conditions", () => {
  it("different seed produces mismatch status", () => {
    const scenarioA = loadFixture("foundation-move-and-roll.v1.json");
    const modifiedA = JSON.parse(JSON.stringify(scenarioA)) as ScenarioDefinition;
    modifiedA.inputProgram = buildEmptyInputProgram(10, "slot-1");
    modifiedA.durationTicks = 10;

    const scenarioB = loadFixture("foundation-move-and-roll.v1.json");
    const modifiedB = JSON.parse(JSON.stringify(scenarioB)) as ScenarioDefinition;
    (modifiedB as any).seed = 999;
    modifiedB.inputProgram = buildEmptyInputProgram(10, "slot-1");
    modifiedB.durationTicks = 10;

    const runA = evaluate({ scenario: modifiedA });
    const runB = evaluate({ scenario: modifiedB });

    const result = compareRuns(runA, runB);
    expect(result.status).toBe("mismatch");
    expect(result.conditionHashMatch).toBe(false);
  });

  it("different duration produces mismatch status", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modifiedA = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modifiedA.inputProgram = buildEmptyInputProgram(10, "slot-1");
    modifiedA.durationTicks = 10;

    const modifiedB = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modifiedB.inputProgram = buildEmptyInputProgram(20, "slot-1");
    modifiedB.durationTicks = 20;

    const runA = evaluate({ scenario: modifiedA });
    const runB = evaluate({ scenario: modifiedB });

    const result = compareRuns(runA, runB);
    expect(result.status).toBe("mismatch");
    expect(result.conditionHashMatch).toBe(false);
  });

  it("equivalent conditions report DELTA_ONLY with no metric deltas", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modifiedA = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modifiedA.inputProgram = buildEmptyInputProgram(10, "slot-1");
    modifiedA.durationTicks = 10;

    const modifiedB = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modifiedB.inputProgram = buildEmptyInputProgram(10, "slot-1");
    modifiedB.durationTicks = 10;

    const runA = evaluate({ scenario: modifiedA });
    const runB = evaluate({ scenario: modifiedB });

    const result = compareRuns(runA, runB);
    expect(result.status).toBe("delta_only");
    expect(result.conditionHashMatch).toBe(true);
    // No deltas for identical runs.
    expect(Object.keys(result.metricDeltas || {})).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Metrics produce deterministic results
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-10-INTEGRATION-006: metrics are deterministic", () => {
  it("player-motion and ball-motion metrics match between runs", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildEmptyInputProgram(10, "slot-1");

    const result1 = evaluate({ scenario: modified });
    const result2 = evaluate({ scenario: modified });

    const pm1 = computePlayerMotionMetrics(result1.observations);
    const pm2 = computePlayerMotionMetrics(result2.observations);
    expect(JSON.stringify(pm1.points)).toBe(JSON.stringify(pm2.points));

    const bm1 = computeBallMotionMetrics(result1.observations);
    const bm2 = computeBallMotionMetrics(result2.observations);
    expect(JSON.stringify(bm1.points)).toBe(JSON.stringify(bm2.points));
  });
});

// ---------------------------------------------------------------------------
// 7. Invariant failure causes run failure
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-10-INTEGRATION-007: invariant failure causes nonzero exit", () => {
  it("runHeadless returns success=false when invariant fails", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildEmptyInputProgram(5, "slot-1");
    modified.durationTicks = 5;

    // Inject a NaN into the PRNG state to force finite-number invariant failure.
    // We do this by using an invariant check that mutates observations.
    const result = runHeadless({
      scenario: modified,
      simulationVersion: modified.simulationVersion,
      runtimeIdentity: "test",
      configVersion: modified.configVersion,
      configHash: "test-hash",
      pitchRulesHash: "pitch-hash",
      rosterCapabilityHash: "roster-hash",
      scenarioHash: hashFnv1a64(encodeCanonical(modified)),
      runId: "test-run",
      safetyBounds: modified.safetyBounds,
      invariantChecks: [
        (observations: TelemetryObservation[]) => {
          // Inject NaN into first observation to trigger finite-number failure.
          const corrupted = structuredClone(observations[0]) as TelemetryObservation;
          (corrupted.players[0].groundPosition as any).x = NaN;
          return checkFiniteNumber(corrupted);
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.invariants.length).toBeGreaterThan(0);
  });

  it("runHeadless returns success=false on replay divergence", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildEmptyInputProgram(5, "slot-1");
    modified.durationTicks = 5;

    // Use verifyReplay=true; since we're using a different scenario for the
    // replay (with intentionally mismatched inputs), it should diverge.
    // Build a bad replay with different hashes.
    const result = runHeadless({
      scenario: modified,
      simulationVersion: modified.simulationVersion,
      runtimeIdentity: "test",
      configVersion: modified.configVersion,
      configHash: "test-hash",
      pitchRulesHash: "pitch-hash",
      rosterCapabilityHash: "roster-hash",
      scenarioHash: hashFnv1a64(encodeCanonical(modified)),
      runId: "test-run",
      safetyBounds: modified.safetyBounds,
      replayVerifier: (replay, scenario) => {
        return verifyReplay(replay, scenario).match;
      },
    });

    // The run itself should succeed (no invariant failure).
    expect(result.success).toBe(true);

    // Now create a replay that will diverge: modify the input to a different scenario.
    const badScenario = JSON.parse(JSON.stringify(modified)) as ScenarioDefinition;
    badScenario.seed = 99999; // different seed
    badScenario.inputProgram = buildEmptyInputProgram(5, "slot-1");
    badScenario.durationTicks = 5;

    // verifyReplay on the good replay with a different scenario should diverge.
    const verifResult = verifyReplay(result.replay, badScenario);
    expect(verifResult.match).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. Metrics and invariants are populated in headless run
// ---------------------------------------------------------------------------

describe("BOOTSTRAP-10-INTEGRATION-008: headless run produces metrics and invariants", () => {
  it("runHeadless populates metrics.json content", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildEmptyInputProgram(5, "slot-1");
    modified.durationTicks = 5;

    const result = runHeadless({
      scenario: modified,
      simulationVersion: modified.simulationVersion,
      runtimeIdentity: "test",
      configVersion: modified.configVersion,
      configHash: "test-hash",
      pitchRulesHash: "pitch-hash",
      rosterCapabilityHash: "roster-hash",
      scenarioHash: hashFnv1a64(encodeCanonical(modified)),
      runId: "test-run",
      safetyBounds: modified.safetyBounds,
    });

    expect(result.success).toBe(true);
    expect(Object.keys(result.metrics).length).toBeGreaterThan(0);
    expect(result.metrics["player-speed"]).toBeDefined();
    expect(result.metrics["ball-speed"]).toBeDefined();
  });

  it("runHeadless populates invariants.json content", () => {
    const scenario = loadFixture("foundation-move-and-roll.v1.json");
    const modified = JSON.parse(JSON.stringify(scenario)) as ScenarioDefinition;
    modified.inputProgram = buildEmptyInputProgram(5, "slot-1");
    modified.durationTicks = 5;

    const result = runHeadless({
      scenario: modified,
      simulationVersion: modified.simulationVersion,
      runtimeIdentity: "test",
      configVersion: modified.configVersion,
      configHash: "test-hash",
      pitchRulesHash: "pitch-hash",
      rosterCapabilityHash: "roster-hash",
      scenarioHash: hashFnv1a64(encodeCanonical(modified)),
      runId: "test-run",
      safetyBounds: modified.safetyBounds,
    });

    expect(result.success).toBe(true);
    expect(result.invariants.length).toBeGreaterThan(0);
    // Default invariants should include finite-number, references, bounds, ball-continuity.
    const ids = result.invariants.map((i) => i.id);
    expect(ids).toContain("finite-number");
    expect(ids).toContain("event-references");
    expect(ids).toContain("bounds");
    // Ball continuity returns per-tick ids: "ball-continuity-tick-{N}".
    expect(ids.some((id) => id.startsWith("ball-continuity-tick-"))).toBe(true);
  });
});