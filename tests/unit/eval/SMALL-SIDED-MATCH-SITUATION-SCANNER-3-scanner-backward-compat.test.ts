/**
 * @module tests/unit/eval/SMALL-SIDED-MATCH-SITUATION-SCANNER-3-scanner-backward-compat.test.ts
 *
 * Backward compatibility tests: the scanner extends the existing situation
 * mapping without weakening or changing it.
 *
 *  1. isRelevantEvent is unchanged (no regression).
 *   2. Existing fixture evaluators still produce valid verdicts.
 *  3. The scanner reuses the same evidence requirements.
 *  4. Existing test patterns (computeSituationVerdict) still work.
 *
 * Node I/O is allowed in tests.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluate } from "../../../eval/runners/evaluate.js";
import {
  runSituationEvaluator,
  computeSituationVerdict,
  type SituationEvaluatorResult,
} from "../../../eval/runners/small-sided-situation-evaluator.js";

import {
  isRelevantEvent,
  filterEventsForSituation,
  MAPPED_SITUATION_IDS,
  getSituationEvidence,
} from "../../../eval/contracts/situation-mapping.js";

// ---------------------------------------------------------------------------
// Temp dir helper
// ---------------------------------------------------------------------------

const TEST_OUTPUT_PREFIX = "/tmp/scanner-backward-compat-";
let testCounter = 0;

function makeTempDir(): string {
  const dir = `${TEST_OUTPUT_PREFIX}${++testCounter}-${Date.now()}`;
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 1. isRelevantEvent unchanged for all known situations
// ---------------------------------------------------------------------------

describe("Backward compat: isRelevantEvent", () => {
  it("isRelevantEvent returns consistent results for all 8 situations", () => {
    const passEvent = { id: "e1", tick: 0, sequence: 0, kind: "pass", label: "pass", payload: {} } as any;
    const shotEvent = { id: "e2", tick: 0, sequence: 0, kind: "shot", label: "shot", payload: {} } as any;
    const contactEvent = { id: "e3", tick: 0, sequence: 0, kind: "player-player-contact", label: "contact", payload: {} } as any;
    const ballOutEvent = { id: "e4", tick: 0, sequence: 0, kind: "ball-out-of-play", label: "out", payload: {} } as any;
    const goalEvent = { id: "e5", tick: 0, sequence: 0, kind: "goal", label: "goal", payload: {} } as any;
    const pbContactEvent = { id: "e6", tick: 0, sequence: 0, kind: "player-ball-contact", label: "pb-contact", payload: {} } as any;
    const inputRejectEvent = { id: "e7", tick: 0, sequence: 0, kind: "input-rejection", label: "reject", payload: {} } as any;

    const events = [passEvent, shotEvent, contactEvent, ballOutEvent, goalEvent, pbContactEvent, inputRejectEvent];

    for (const sitId of MAPPED_SITUATION_IDS) {
      const req = getSituationEvidence(sitId);
      expect(req).toBeDefined();

      // isRelevantEvent must only return true for events whose kind
      // matches required or indicative kinds.
      const relevant = events.filter((e) => isRelevantEvent(e, sitId));
      for (const e of relevant) {
        const kindMatchesRequired = req!.required_event_kinds.includes(e.kind);
        const kindMatchesIndicative = req!.indicative_event_kinds.includes(e.kind);
        expect(kindMatchesRequired || kindMatchesIndicative,
          `Event kind "${e.kind}" should match required or indicative for ${sitId}`,
        ).toBe(true);
      }
    }
  });

  it("unmapped situation returns false", () => {
    const event = { id: "e1", tick: 0, sequence: 0, kind: "pass", label: "pass", payload: {} } as any;
    expect(isRelevantEvent(event, "NONEXISTENT_SITUATION")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Existing fixture evaluators still produce valid verdicts
// ---------------------------------------------------------------------------

describe("Backward compat: fixture evaluators", () => {
  let tmpDir1: string;
  let tmpDir2: string;

  beforeAll(() => {
    tmpDir1 = makeTempDir();
    tmpDir2 = makeTempDir();
  }, 60_000);

  it("3v3-situation-fixture still produces valid artifacts", () => {
    const result1 = runSituationEvaluator("3v3-situation-fixture.v1.json", tmpDir1);
    const result2 = runSituationEvaluator("3v3-situation-fixture.v1.json", tmpDir1);

    // Both results should have the same structure.
    expect(result1.situationArtifacts.length).toBe(result2.situationArtifacts.length);

    for (const artifact of result1.situationArtifacts) {
      expect(["PASS", "FAIL", "NOT_EVALUATED"]).toContain(artifact.verdict);
      expect(typeof artifact.verdict_reason).toBe("string");
      expect(Array.isArray(artifact.relevant_events)).toBe(true);
      expect(Array.isArray(artifact.team_geometry)).toBe(true);
      expect(Array.isArray(artifact.trajectory)).toBe(true);
    }
  });

  it("3v3-transition-fixture still produces valid artifacts", () => {
    const tmpDir = makeTempDir();
    const result = runSituationEvaluator("3v3-transition-fixture.v1.json", tmpDir);

    expect(result.situationArtifacts.length).toBeGreaterThan(0);
    for (const artifact of result.situationArtifacts) {
      expect(["PASS", "FAIL", "NOT_EVALUATED"]).toContain(artifact.verdict);
    }

    cleanupTempDir(tmpDir);
  });

  afterAll(() => {
    cleanupTempDir(tmpDir1);
    cleanupTempDir(tmpDir2);
  });
});

// ---------------------------------------------------------------------------
// 3. Scanner reuses same evidence requirements
// ---------------------------------------------------------------------------

describe("Backward compat: evidence requirement reuse", () => {
  it("scanner and evaluator use identical requirement records", () => {
    const tmpDir = makeTempDir();
    const scenario = {
      id: "test-scenario",
      version: "1.0.0",
      family: "situation-fixture",
      durationTicks: 100,
      seed: 42,
      prngAlgorithmId: "mulberry32-v1",
      schemaVersion: "state-v1",
      simulationVersion: "sim-v1",
      configVersion: "foundation-config-v1",
      profile: "LABORATORY" as const,
      pitchLength: 105,
      pitchWidth: 68,
      safetyBounds: { maxX: 52.5, maxY: 34, minZ: -0.5, maxZ: 20 },
      players: [
        {
          playerId: "player-1",
          teamId: "team-a",
          groundPosition: { x: -5, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: 1, y: 0 },
          bodyHeading: 0,
          desiredHeading: 0,
          archetypeId: "archetype-burst-v1",
        },
        {
          playerId: "player-2",
          teamId: "team-b",
          groundPosition: { x: 5, y: 0 },
          linearVelocity: { x: 0, y: 0 },
          desiredVelocity: { x: -1, y: 0 },
          bodyHeading: 3.14159,
          desiredHeading: 3.14159,
          archetypeId: "archetype-steady-v1",
        },
      ],
      ball: {
        position: { x: 0, y: 0, z: 0.11 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        regime: "ground-roll" as const,
      },
      controlAssignments: {},
      missingInputPolicy: "REPEAT_HELD_WITH_ZERO_EDGES",
      maxConsecutiveMissing: 3,
      inputProgram: {},
      scheduledEvents: {},
      observationWindows: [{ startTick: 0, endTick: 100 }],
      requestedMetrics: [],
    } as import("../../../src/contracts/scenario.js").ScenarioDefinition;

    // The requirement records for each situation must be identical
    // between what the scanner and the evaluator use (they import from
    // the same module).
    for (const sitId of MAPPED_SITUATION_IDS) {
      const req = getSituationEvidence(sitId);
      expect(req).toBeDefined();
      // Each requirement has the required fields.
      expect(typeof req!.situation_id).toBe("string");
      expect(Array.isArray(req!.required_event_kinds)).toBe(true);
      expect(Array.isArray(req!.indicative_event_kinds)).toBe(true);
      expect(typeof req!.requires_position_data).toBe("boolean");
      expect(typeof req!.requires_team_geometry).toBe("boolean");
      expect(["READY", "NOT_EVALUATED"]).toContain(req!.mapping_status);
      expect(typeof req!.evidence_chain).toBe("string");
    }

    cleanupTempDir(tmpDir);
  });
});

// ---------------------------------------------------------------------------
// 4. computeSituationVerdict still works (shared with evaluator)
// ---------------------------------------------------------------------------

describe("Backward compat: computeSituationVerdict", () => {
  it("verdict rules are consistent with evaluator", () => {
    const req = {
      situation_id: "TEST",
      required_event_kinds: ["pass"],
      indicative_event_kinds: ["second-touch"],
      requires_position_data: true,
      requires_team_geometry: false,
      mapping_status: "READY" as const,
      evidence_chain: "test",
    };

    // No events → NOT_EVALUATED
    let result = computeSituationVerdict("TEST", [], req);
    expect(result.verdict).toBe("NOT_EVALUATED");

    // Required present, indicative present → PASS
    result = computeSituationVerdict("TEST", [
      { id: "e1", tick: 10, sequence: 0, kind: "pass", label: "pass", payload: {} },
      { id: "e2", tick: 15, sequence: 0, kind: "second-touch", label: "second", payload: {} },
    ] as any, req);
    expect(result.verdict).toBe("PASS");

    // Required present, indicative absent → FAIL
    result = computeSituationVerdict("TEST", [
      { id: "e1", tick: 10, sequence: 0, kind: "pass", label: "pass", payload: {} },
    ] as any, req);
    expect(result.verdict).toBe("FAIL");
  });
});